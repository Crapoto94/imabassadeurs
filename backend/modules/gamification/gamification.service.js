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

// Seuils cumulés des niveaux (niveaux numériques, sans noms pour ne pas
// concurrencer le rôle « IAmbassadeur »).
const LEVEL_THRESHOLDS = [0, 60, 180, 400, 750, 1200];

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
  level: 1,
  level_label: 'Niveau 1',
  current_level_points: 0,
  next_level_points: null,
  progress_pct: 0,
  badges: BADGES.map((b) => ({ ...b, earned: false })),
  breakdown: {},
  parcours: { total: 0, lu: 0 },
});

async function summaryFor(userId) {
  const settings = await db.get(`SELECT gamification_enabled FROM ${SCHEMA}.app_settings WHERE id=1`);
  if (settings?.gamification_enabled === false) return emptySummary();

  const count = async (sql, p = []) => (await db.get(sql, p))?.n || 0;

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

  const breakdown = {
    resources: { count: resources, points: resources * POINTS.resource },
    experiments: { count: experiments, points: experiments * POINTS.experiment },
    joined: { count: joined, points: joined * POINTS.join_experiment },
    risks: { count: risks, points: risks * POINTS.risk },
    comments: { count: topComments + replies, points: topComments * POINTS.comment + replies * POINTS.reply },
    votes: { count: votes + voteOptions, points: votes * POINTS.vote + voteOptions * POINTS.vote_option },
    ratings: { count: ratings, points: ratings * POINTS.rating },
    lectures: { count: lectures, points: lectures * POINTS.lecture + lecturesMandatory * POINTS.lecture_mandatory_bonus },
  };

  const points = Object.values(breakdown).reduce((sum, b) => sum + b.points, 0);
  const level = levelFor(points);
  const currentMin = LEVEL_THRESHOLDS[level - 1];
  const nextThreshold = level < LEVEL_THRESHOLDS.length ? LEVEL_THRESHOLDS[level] : null;
  const progress_pct = nextThreshold == null
    ? 100
    : Math.min(100, Math.round(((points - currentMin) / (nextThreshold - currentMin)) * 100));

  const badges = BADGES.map((b) => {
    let earned = false;
    switch (b.key) {
      case 'first_resource': earned = resources >= 1; break;
      case 'first_risk': earned = risks >= 1; break;
      case 'first_experiment': earned = experiments >= 1; break;
      case 'first_comment': earned = topComments + replies >= 1; break;
      case 'first_vote': earned = votes + voteOptions >= 1; break;
      case 'curious': earned = lectures >= 5; break;
      case 'explorer': earned = experiments + joined >= 3; break;
      case 'vigie': earned = risks >= 5; break;
      case 'pedagogue': earned = resources >= 5; break;
      case 'parcours': earned = mandatoryTotal > 0 && lecturesMandatory >= mandatoryTotal; break;
    }
    return { ...b, earned };
  });

  return {
    enabled: true,
    points,
    level,
    level_label: `Niveau ${level}`,
    current_level_points: currentMin,
    next_level_points: nextThreshold,
    progress_pct,
    badges,
    breakdown,
    parcours: { total: mandatoryTotal, lu: lecturesMandatory },
  };
}

module.exports = { summaryFor, POINTS, LEVEL_THRESHOLDS };
