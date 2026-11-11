const { db, SCHEMA } = require('../../pg_db');

// Pondération des actions contributives (calculées à la volée, aucune table de points).
const POINTS = {
  resource: 25,             // proposer une ressource publiée
  experiment: 35,           // proposer une expérimentation
  join_experiment: 10,      // rejoindre une expérimentation
  risk: 25,                 // proposer un risque
  lecture: 10,              // consulter une ressource (progress 100 %)
  lecture_mandatory_bonus: 10, // ressource « Parcours obligatoire » consultée (+10)
  comment: 5,               // commenter
  reply: 8,                 // répondre à un commentaire
  vote: 5,                  // voter
  vote_option: 10,          // proposer une option de vote (write-in)
  rating: 5,                // noter une ressource
};

// Bonus d'impact : la qualité/reconnaissance reçue sur mes contributions.
const IMPACT_POINTS = {
  like_received: 2,          // un like reçu sur un commentaire
  rating_received: 2,        // une note reçue sur une ressource
  participant: 5,            // un agent rejoint une de mes expérimentations
  completed_experiment: 20,  // une de mes expérimentations passe à « terminée »
  risk_amended: 10,          // un de mes risques est amendé
  adopted_link: 15,          // une de mes contributions est reliée à un principe adopté
  praised_resource: 10,      // une de mes ressources est plébiscitée (≥3 notes, moyenne ≥3,5)
};

// Seuils cumulés des niveaux (numériques, sans noms).
const LEVEL_THRESHOLDS = [0, 60, 180, 400, 750, 1200, 1800, 2600, 3600, 4800];

function levelFor(points) {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (points >= LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  return level;
}

const BADGES = [
  { key: 'first_resource', label: 'Première ressource', icon: 'article' },
  { key: 'first_risk', label: 'Premier risque', icon: 'warning' },
  { key: 'first_experiment', label: 'Première expérimentation', icon: 'science' },
  { key: 'first_comment', label: 'Premier commentaire', icon: 'chat_bubble_outline' },
  { key: 'first_vote', label: 'Premier vote', icon: 'how_to_vote' },
  { key: 'curious', label: 'Curieux', icon: 'menu_book' },
  { key: 'explorer', label: 'Explorateur', icon: 'explore' },
  { key: 'vigie', label: 'Vigie', icon: 'shield' },
  { key: 'pedagogue', label: 'Pédagogue', icon: 'school' },
  { key: 'parcours', label: 'Parcours accompli', icon: 'verified' },
];

const emptySummary = () => ({
  enabled: false,
  points: 0,
  base_points: 0,
  impact_points: 0,
  points_adjustment: 0,
  level: 1,
  level_label: 'Niveau 1',
  current_level_points: 0,
  next_level_points: null,
  progress_pct: 0,
  axes: [],
  impact: [],
  badges: BADGES.map((b) => ({ ...b, earned: false, current: 0, target: 1 })),
  next_steps: [],
  breakdown: {},
  parcours: { total: 0, lu: 0 },
});

async function computeFor(userId) {
  const count = async (sql, p = []) => (await db.get(sql, p))?.n || 0;

  // ── Base : actions réalisées ──
  const resources = await count(
    `SELECT count(*)::int AS n FROM ${SCHEMA}.resources WHERE proposed_by=$1 AND status='published'`, [userId]);
  const experiments = await count(
    `SELECT count(*)::int AS n FROM ${SCHEMA}.experiments WHERE created_by=$1`, [userId]);
  const joined = await count(
    `SELECT count(*)::int AS n FROM ${SCHEMA}.experiment_participants WHERE user_id=$1`, [userId]);
  const risks = await count(
    `SELECT count(*)::int AS n FROM ${SCHEMA}.risks WHERE proposed_by=$1`, [userId]);
  const topComments = await count(
    `SELECT count(*)::int AS n FROM ${SCHEMA}.comments WHERE author_id=$1 AND parent_id IS NULL`, [userId]);
  const replies = await count(
    `SELECT count(*)::int AS n FROM ${SCHEMA}.comments WHERE author_id=$1 AND parent_id IS NOT NULL`, [userId]);
  const votes = await count(
    `SELECT count(*)::int AS n FROM ${SCHEMA}.vote_responses WHERE user_id=$1`, [userId]);
  const voteOptions = await count(
    `SELECT count(*)::int AS n FROM ${SCHEMA}.vote_options WHERE proposed_by=$1`, [userId]);
  const ratings = await count(
    `SELECT count(*)::int AS n FROM ${SCHEMA}.resource_ratings WHERE user_id=$1`, [userId]);
  const lectures = await count(
    `SELECT count(*)::int AS n FROM ${SCHEMA}.resource_progress WHERE user_id=$1 AND progress_pct >= 100`, [userId]);
  const lecturesMandatory = await count(
    `SELECT count(*)::int AS n FROM ${SCHEMA}.resource_progress p
       JOIN ${SCHEMA}.resources r ON r.id = p.resource_id
      WHERE p.user_id=$1 AND p.progress_pct >= 100 AND r.is_mandatory = true`, [userId]);
  const mandatoryTotal = await count(
    `SELECT count(*)::int AS n FROM ${SCHEMA}.resources WHERE is_mandatory = true`);

  // ── Impact : reconnaissance reçue ──
  const likesReceived = await count(
    `SELECT count(*)::int AS n FROM ${SCHEMA}.comment_likes l JOIN ${SCHEMA}.comments c ON c.id = l.comment_id WHERE c.author_id=$1`, [userId]);
  const ratingsReceived = await count(
    `SELECT count(*)::int AS n FROM ${SCHEMA}.resource_ratings rr JOIN ${SCHEMA}.resources r ON r.id = rr.resource_id WHERE r.proposed_by=$1`, [userId]);
  const participants = await count(
    `SELECT count(*)::int AS n FROM ${SCHEMA}.experiment_participants p JOIN ${SCHEMA}.experiments e ON e.id = p.experiment_id WHERE e.created_by=$1 AND p.user_id <> $1`, [userId]);
  const completedExperiments = await count(
    `SELECT count(*)::int AS n FROM ${SCHEMA}.experiments WHERE created_by=$1 AND status='completed'`, [userId]);
  const risksAmended = await count(
    `SELECT count(DISTINCT a.risk_id)::int AS n FROM ${SCHEMA}.risk_amendments a JOIN ${SCHEMA}.risks r ON r.id = a.risk_id WHERE r.proposed_by=$1`, [userId]);
  const adoptedLinks = await count(
    `SELECT count(*)::int AS n FROM ${SCHEMA}.idea_links l
       JOIN ${SCHEMA}.charter_principles p ON p.id = l.target_id AND l.target_type='principle' AND p.status='adopted'
      WHERE (l.source_type='resource' AND l.source_id IN (SELECT id FROM ${SCHEMA}.resources WHERE proposed_by=$1))
         OR (l.source_type='risk' AND l.source_id IN (SELECT id FROM ${SCHEMA}.risks WHERE proposed_by=$1))
         OR (l.source_type='experiment' AND l.source_id IN (SELECT id FROM ${SCHEMA}.experiments WHERE created_by=$1))
         OR (l.source_type='comment' AND l.source_id IN (SELECT id FROM ${SCHEMA}.comments WHERE author_id=$1))`, [userId]);
  const praisedResources = await count(
    `SELECT count(*)::int AS n FROM ${SCHEMA}.resources r WHERE r.proposed_by=$1
       AND (SELECT round(avg(stars)::numeric,2) FROM ${SCHEMA}.resource_ratings rr WHERE rr.resource_id=r.id) >= 3.5
       AND (SELECT count(*) FROM ${SCHEMA}.resource_ratings rr WHERE rr.resource_id=r.id) >= 3`, [userId]);

  const user = await db.get(
    `SELECT gamification_hidden, gamification_points_adjustment FROM ${SCHEMA}.users WHERE id=$1`, [userId]);
  const adjustment = user?.gamification_points_adjustment || 0;

  const lecturePoints = lectures * POINTS.lecture + lecturesMandatory * POINTS.lecture_mandatory_bonus;
  const commentPoints = topComments * POINTS.comment + replies * POINTS.reply;
  const votePoints = votes * POINTS.vote + voteOptions * POINTS.vote_option;

  const basePoints =
    resources * POINTS.resource + experiments * POINTS.experiment + joined * POINTS.join_experiment
    + risks * POINTS.risk + lecturePoints + commentPoints + votePoints + ratings * POINTS.rating;

  const impact = [
    { key: 'like_received', label: 'Likes reçus', count: likesReceived, points: likesReceived * IMPACT_POINTS.like_received },
    { key: 'rating_received', label: 'Notes reçues', count: ratingsReceived, points: ratingsReceived * IMPACT_POINTS.rating_received },
    { key: 'participant', label: 'Participants à vos expérimentations', count: participants, points: participants * IMPACT_POINTS.participant },
    { key: 'completed_experiment', label: 'Expérimentations terminées', count: completedExperiments, points: completedExperiments * IMPACT_POINTS.completed_experiment },
    { key: 'risk_amended', label: 'Risques amendés', count: risksAmended, points: risksAmended * IMPACT_POINTS.risk_amended },
    { key: 'adopted_link', label: 'Contributions reliées à un principe adopté', count: adoptedLinks, points: adoptedLinks * IMPACT_POINTS.adopted_link },
    { key: 'praised_resource', label: 'Ressources plébiscitées', count: praisedResources, points: praisedResources * IMPACT_POINTS.praised_resource },
  ];
  const impactPoints = impact.reduce((s, i) => s + i.points, 0);

  const axes = [
    { key: 'documentation', label: 'Documentation', count: resources + lectures + ratings, points: resources * POINTS.resource + lecturePoints + ratings * POINTS.rating },
    { key: 'usecases', label: "Cas d'usage", count: experiments + joined, points: experiments * POINTS.experiment + joined * POINTS.join_experiment },
    { key: 'risks', label: 'Risques', count: risks, points: risks * POINTS.risk },
    { key: 'participation', label: 'Participation', count: topComments + replies + votes + voteOptions, points: commentPoints + votePoints },
  ].map((a) => ({ ...a, level: levelFor(a.points), level_label: `Niveau ${levelFor(a.points)}` }));

  const total = Math.max(0, basePoints + impactPoints + adjustment);
  const level = levelFor(total);
  const currentMin = LEVEL_THRESHOLDS[level - 1];
  const nextThreshold = level < LEVEL_THRESHOLDS.length ? LEVEL_THRESHOLDS[level] : null;
  const progress_pct = nextThreshold == null
    ? 100
    : Math.min(100, Math.round(((total - currentMin) / (nextThreshold - currentMin)) * 100));

  const badges = BADGES.map((b) => {
    let current = 0, target = 1;
    switch (b.key) {
      case 'first_resource': target = 1; current = Math.min(resources, 1); break;
      case 'first_risk': target = 1; current = Math.min(risks, 1); break;
      case 'first_experiment': target = 1; current = Math.min(experiments, 1); break;
      case 'first_comment': target = 1; current = Math.min(topComments + replies, 1); break;
      case 'first_vote': target = 1; current = Math.min(votes + voteOptions, 1); break;
      case 'curious': target = 5; current = Math.min(lectures, 5); break;
      case 'explorer': target = 3; current = Math.min(experiments + joined, 3); break;
      case 'vigie': target = 5; current = Math.min(risks, 5); break;
      case 'pedagogue': target = 5; current = Math.min(resources, 5); break;
      case 'parcours': target = mandatoryTotal > 0 ? mandatoryTotal : 1; current = Math.min(lecturesMandatory, target); break;
    }
    const earned = b.key === 'parcours' ? (mandatoryTotal > 0 && lecturesMandatory >= mandatoryTotal) : current >= target;
    return { ...b, earned, current, target };
  });

  const next_steps = [];
  if (risks === 0) next_steps.push({ key: 'risk', label: 'Déclarer votre premier risque', icon: 'warning', href: '/risques' });
  if (resources === 0) next_steps.push({ key: 'resource', label: 'Proposer une ressource documentaire', icon: 'article', href: '/ressources' });
  if (experiments + joined === 0) next_steps.push({ key: 'experiment', label: 'Proposer ou rejoindre une expérimentation', icon: 'science', href: '/experimentations' });
  if (mandatoryTotal > 0 && lecturesMandatory < mandatoryTotal) next_steps.push({ key: 'parcours', label: `Lire le parcours obligatoire (${lecturesMandatory}/${mandatoryTotal})`, icon: 'menu_book', href: '/ressources' });
  if (votes + voteOptions === 0) next_steps.push({ key: 'vote', label: 'Voter sur une consultation', icon: 'how_to_vote', href: '/votes' });
  if (topComments + replies === 0) next_steps.push({ key: 'comment', label: 'Commenter une contribution', icon: 'chat_bubble_outline', href: '/' });

  return {
    points: total,
    base_points: basePoints,
    impact_points: impactPoints,
    points_adjustment: adjustment,
    level,
    level_label: `Niveau ${level}`,
    current_level_points: currentMin,
    next_level_points: nextThreshold,
    progress_pct,
    axes,
    impact,
    badges,
    next_steps,
    breakdown: {
      resources: { count: resources, points: resources * POINTS.resource },
      experiments: { count: experiments, points: experiments * POINTS.experiment },
      joined: { count: joined, points: joined * POINTS.join_experiment },
      risks: { count: risks, points: risks * POINTS.risk },
      comments: { count: topComments + replies, points: commentPoints },
      votes: { count: votes + voteOptions, points: votePoints },
      ratings: { count: ratings, points: ratings * POINTS.rating },
      lectures: { count: lectures, points: lecturePoints },
    },
    parcours: { total: mandatoryTotal, lu: lecturesMandatory },
  };
}

async function summaryFor(userId) {
  const settings = await db.get(`SELECT gamification_enabled FROM ${SCHEMA}.app_settings WHERE id=1`);
  const user = await db.get(`SELECT gamification_hidden FROM ${SCHEMA}.users WHERE id=$1`, [userId]);
  if (settings?.gamification_enabled === false || user?.gamification_hidden === true) return emptySummary();
  return { enabled: true, ...(await computeFor(userId)) };
}

module.exports = { summaryFor, computeFor, POINTS, IMPACT_POINTS, LEVEL_THRESHOLDS };
