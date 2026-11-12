const { db, SCHEMA } = require('../../pg_db');
const { ApiError } = require('../../utils/errors');

// Nouveautés par rubrique depuis la dernière visite de l'utilisateur ($1 = utilisateur, $2 = date de dernière visite).
// Ses propres contributions ne comptent pas.
const COUNTS = {
  ressources: `SELECT count(*)::int AS n FROM ${SCHEMA}.resources
                WHERE status = 'published' AND created_at > $2 AND proposed_by <> $1`,
  experimentations: `SELECT count(*)::int AS n FROM ${SCHEMA}.experiments
                      WHERE created_at > $2 AND created_by <> $1`,
  risques: `SELECT count(*)::int AS n FROM ${SCHEMA}.risks
             WHERE created_at > $2 AND proposed_by <> $1`,
  votes: `SELECT count(*)::int AS n FROM ${SCHEMA}.vote_sessions
           WHERE status = 'open' AND opens_at > $2 AND created_by <> $1`,
  mur: `SELECT count(*)::int AS n FROM ${SCHEMA}.wall_posts
         WHERE deleted_at IS NULL AND created_at > $2 AND author_id IS DISTINCT FROM $1`,
};
const SECTIONS = Object.keys(COUNTS);

async function get(user) {
  // Première visite d'une rubrique : on part de maintenant (pas de pastille sur l'historique existant).
  await db.run(
    `INSERT INTO ${SCHEMA}.user_section_visits (user_id, section)
     SELECT $1, s FROM unnest($2::text[]) AS s ON CONFLICT DO NOTHING`,
    [user.id, SECTIONS]
  );
  const visits = await db.all(`SELECT section, seen_at FROM ${SCHEMA}.user_section_visits WHERE user_id = $1`, [user.id]);
  const seen = Object.fromEntries(visits.map((v) => [v.section, v.seen_at]));
  const out = {};
  await Promise.all(SECTIONS.map(async (s) => {
    out[s] = (await db.get(COUNTS[s], [user.id, seen[s]])).n;
  }));
  // Admin : demandes du backlog en attente d'examen (pas liées à une visite).
  if (user.roles.includes('admin')) {
    out.admin = (await db.get(`SELECT count(*)::int AS n FROM ${SCHEMA}.backlog_items WHERE status = 'demandee'`)).n;
  }
  return out;
}

async function markSeen(user, section) {
  if (!SECTIONS.includes(section)) throw new ApiError(400, 'Rubrique inconnue');
  await db.run(
    `INSERT INTO ${SCHEMA}.user_section_visits (user_id, section, seen_at) VALUES ($1,$2,now())
     ON CONFLICT (user_id, section) DO UPDATE SET seen_at = now()`,
    [user.id, section]
  );
  return { section, seen: true };
}

module.exports = { get, markSeen, SECTIONS };
