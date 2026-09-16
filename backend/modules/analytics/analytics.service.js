const { db, SCHEMA } = require('../../pg_db');
const mapping = require('../mapping/mapping.service');

function periodClause(alias, from, to, params) {
  const clauses = [];
  if (from) { params.push(from); clauses.push(`${alias} >= $${params.length}`); }
  if (to) { params.push(to); clauses.push(`${alias} <= $${params.length}`); }
  return clauses;
}

// Contributions par utilisateur sur une période.
async function activityByUser(query) {
  const params = [];
  const from = query.from; const to = query.to;
  const c = (alias) => periodClause(alias, from, to, params);
  const and = (clauses) => (clauses.length ? 'AND ' + clauses.join(' AND ') : '');
  // Les alias de colonnes ne peuvent pas être utilisés dans une expression d'ORDER BY :
  // on enveloppe le calcul d'activité dans une sous-requête.
  return db.all(`
    SELECT * FROM (
      SELECT u.id, u.display_name, u.direction, u.service,
        (SELECT count(*)::int FROM ${SCHEMA}.resources r WHERE r.proposed_by=u.id ${and(c('r.created_at'))}) AS resources,
        (SELECT count(*)::int FROM ${SCHEMA}.comments cm WHERE cm.author_id=u.id ${and(c('cm.created_at'))}) AS comments,
        (SELECT count(*)::int FROM ${SCHEMA}.risks rk WHERE rk.proposed_by=u.id ${and(c('rk.created_at'))}) AS risks,
        (SELECT count(*)::int FROM ${SCHEMA}.experiments e WHERE e.created_by=u.id ${and(c('e.created_at'))}) AS experiments,
        (SELECT count(*)::int FROM ${SCHEMA}.vote_responses v WHERE v.user_id=u.id ${and(c('v.created_at'))}) AS votes
      FROM ${SCHEMA}.users u
    ) t
    ORDER BY (t.resources + t.comments + t.risks + t.experiments + t.votes) DESC
    LIMIT 100`, params);
}

// Qui répond à qui (réseau d'échange).
async function interactions(query) {
  const params = [];
  const clauses = periodClause('c.created_at', query.from, query.to, params);
  if (clauses.length) clauses.unshift('c.parent_id IS NOT NULL');
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : 'WHERE c.parent_id IS NOT NULL';
  return db.all(`
    SELECT parent_u.display_name AS "from", author_u.display_name AS "to", count(*)::int AS replies
      FROM ${SCHEMA}.comments c
      JOIN ${SCHEMA}.comments parent ON parent.id = c.parent_id
      JOIN ${SCHEMA}.users parent_u ON parent_u.id = parent.author_id
      JOIN ${SCHEMA}.users author_u ON author_u.id = c.author_id
      ${where}
      GROUP BY parent_u.display_name, author_u.display_name
      ORDER BY replies DESC LIMIT 100`, params);
}

async function kpis() {
  const totals = await db.get(`
    SELECT
      (SELECT count(*)::int FROM ${SCHEMA}.users) AS users_total,
      (SELECT count(*)::int FROM ${SCHEMA}.resources WHERE status='published') AS resources,
      (SELECT count(*)::int FROM ${SCHEMA}.comments) AS comments,
      (SELECT count(*)::int FROM ${SCHEMA}.risks) AS risks,
      (SELECT count(*)::int FROM ${SCHEMA}.experiments) AS experiments,
      (SELECT count(*)::int FROM ${SCHEMA}.vote_sessions) AS vote_sessions`);
  const active = await db.get(`
    SELECT count(DISTINCT uid)::int AS n FROM (
      SELECT proposed_by AS uid FROM ${SCHEMA}.resources
      UNION SELECT author_id FROM ${SCHEMA}.comments
      UNION SELECT proposed_by FROM ${SCHEMA}.risks
      UNION SELECT created_by FROM ${SCHEMA}.experiments
      UNION SELECT user_id FROM ${SCHEMA}.vote_responses
    ) t`);
  const topResources = await db.all(`
    SELECT r.id, r.title, round(avg(rr.stars)::numeric,2) AS avg_stars, count(rr.user_id)::int AS votes
      FROM ${SCHEMA}.resources r JOIN ${SCHEMA}.resource_ratings rr ON rr.resource_id=r.id
     WHERE r.status='published'
     GROUP BY r.id, r.title ORDER BY avg_stars DESC, votes DESC LIMIT 5`);
  const topRisks = await db.all(`
    SELECT id, title, importance, probability FROM ${SCHEMA}.risks
     ORDER BY (importance*probability) DESC LIMIT 5`);
  return {
    ...totals,
    users_active: active.n,
    participation_rate: totals.users_total ? Math.round((active.n / totals.users_total) * 100) : 0,
    top_resources: topResources,
    top_risks: topRisks,
  };
}

// Qualité des digests (notes 1-5 laissées via les liens des e-mails).
async function digestQuality() {
  return db.all(`
    SELECT period, count(*)::int AS digests,
           count(quality_rating)::int AS notes,
           round(avg(quality_rating)::numeric,2) AS note_moyenne
      FROM ${SCHEMA}.notification_digests GROUP BY period`);
}

async function consensus(user) {
  return mapping.analyseConsensus(user);
}

module.exports = { activityByUser, interactions, kpis, digestQuality, consensus };
