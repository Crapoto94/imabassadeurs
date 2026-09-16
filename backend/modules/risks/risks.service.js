const { db, SCHEMA } = require('../../pg_db');
const ia = require('../../services/ia');
const comments = require('../comments/comments.service');
const { pageParams } = require('../../utils/pagination');
const { logAction } = require('../../utils/audit');

async function list(user, query) {
  const { limit, offset } = pageParams(query);
  const params = [];
  const clauses = [];
  if (query.concerns_ivry === 'true' || query.concerns_ivry === 'false') {
    params.push(query.concerns_ivry === 'true');
    clauses.push(`r.concerns_ivry = $${params.length}`);
  }
  if (query.min_importance) {
    params.push(parseInt(query.min_importance, 10));
    clauses.push(`r.importance >= $${params.length}`);
  }
  params.push(limit, offset);
  const where = clauses.length ? clauses.join(' AND ') : '1=1';
  return db.all(
    `SELECT r.*, u.display_name AS proposed_by_name,
            (SELECT count(*)::int FROM ${SCHEMA}.risk_amendments a WHERE a.risk_id = r.id) AS amendments_count,
            (SELECT count(*)::int FROM ${SCHEMA}.comments c WHERE c.entity_type='risk' AND c.entity_id=r.id) AS comments_count
       FROM ${SCHEMA}.risks r JOIN ${SCHEMA}.users u ON u.id = r.proposed_by
      WHERE ${where}
      ORDER BY (r.importance * r.probability) DESC, r.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
}

async function getById(id) {
  const r = await db.get(
    `SELECT r.*, u.display_name AS proposed_by_name FROM ${SCHEMA}.risks r
       JOIN ${SCHEMA}.users u ON u.id = r.proposed_by WHERE r.id = $1`,
    [id]
  );
  if (!r) throw Object.assign(new Error('Risque introuvable'), { status: 404 });
  r.amendments = await db.all(
    `SELECT a.*, u.display_name AS amended_by_name FROM ${SCHEMA}.risk_amendments a
       JOIN ${SCHEMA}.users u ON u.id = a.amended_by WHERE a.risk_id = $1 ORDER BY a.created_at ASC`,
    [id]
  );
  return r;
}

async function create(user, data) {
  const { title, description, concerns_ivry, importance, probability } = data;
  const imp = parseInt(importance, 10);
  const prob = parseInt(probability, 10);
  if (!title || !description) throw Object.assign(new Error('Titre et description requis'), { status: 400 });
  if (!(imp >= 1 && imp <= 4) || !(prob >= 1 && prob <= 4)) throw Object.assign(new Error('Importance et probabilité entre 1 et 4'), { status: 400 });
  const row = await db.get(
    `INSERT INTO ${SCHEMA}.risks (title, description, concerns_ivry, importance, probability, proposed_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [title, description, concerns_ivry !== false, imp, prob, user.id]
  );
  await logAction(user.id, 'risk_create', 'risk', row.id, null);
  return row.id;
}

// Amendement formel réservé aux IAnimateurs (traçabilité complète).
async function amend(user, id, importance, probability, reason) {
  if (!(user.roles.includes('ianimateur') || user.roles.includes('admin'))) {
    throw Object.assign(new Error('Réservé aux IAnimateurs'), { status: 403 });
  }
  const imp = parseInt(importance, 10);
  const prob = parseInt(probability, 10);
  if (!(imp >= 1 && imp <= 4) || !(prob >= 1 && prob <= 4)) throw Object.assign(new Error('Valeurs entre 1 et 4'), { status: 400 });
  const risk = await db.get(`SELECT id FROM ${SCHEMA}.risks WHERE id=$1`, [id]);
  if (!risk) throw Object.assign(new Error('Risque introuvable'), { status: 404 });
  await db.run(
    `INSERT INTO ${SCHEMA}.risk_amendments (risk_id, importance, probability, amended_by, reason)
     VALUES ($1,$2,$3,$4,$5)`,
    [id, imp, prob, user.id, reason || null]
  );
  await db.run(`UPDATE ${SCHEMA}.risks SET importance=$2, probability=$3 WHERE id=$1`, [id, imp, prob]);
  await logAction(user.id, 'risk_amend', 'risk', id, { importance: imp, probability: prob, reason });
  return { id, importance: imp, probability: prob };
}

async function synthesize(user, id) {
  const r = await getById(id);
  const fil = await comments.threadText('risk', id);
  return ia.executerActionIA('risk_summary', {
    risque: `${r.title} — ${r.description} (importance ${r.importance}/4, probabilité ${r.probability}/4)`,
    commentaires: fil || '(aucun commentaire)',
  });
}

module.exports = { list, getById, create, amend, synthesize };
