const { db, SCHEMA } = require('../../pg_db');
const ia = require('../../services/ia');
const comments = require('../comments/comments.service');
const { pageParams } = require('../../utils/pagination');
const { logAction } = require('../../utils/audit');

const canEdit = (user, exp) =>
  user.roles.includes('ianimateur') || user.roles.includes('admin') || exp.created_by === user.id;

async function list(user, query) {
  const { limit, offset } = pageParams(query);
  const params = [user.id];
  let where = '1=1';
  if (query.status) { params.push(query.status); where += ` AND e.status = $${params.length}`; }
  params.push(limit, offset);
  return db.all(
    `SELECT e.*, u.display_name AS created_by_name,
            (SELECT count(*)::int FROM ${SCHEMA}.experiment_participants p WHERE p.experiment_id = e.id) AS participants_count,
            EXISTS(SELECT 1 FROM ${SCHEMA}.experiment_participants p WHERE p.experiment_id = e.id AND p.user_id = $1) AS joined,
            (SELECT count(*)::int FROM ${SCHEMA}.comments c WHERE c.entity_type='experiment' AND c.entity_id=e.id) AS comments_count
       FROM ${SCHEMA}.experiments e JOIN ${SCHEMA}.users u ON u.id = e.created_by
      WHERE ${where}
      ORDER BY e.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
}

async function getById(id, user) {
  const e = await db.get(
    `SELECT e.*, u.display_name AS created_by_name FROM ${SCHEMA}.experiments e
       JOIN ${SCHEMA}.users u ON u.id = e.created_by WHERE e.id = $1`,
    [id]
  );
  if (!e) throw Object.assign(new Error('Expérimentation introuvable'), { status: 404 });
  e.participants = await db.all(
    `SELECT us.id, us.display_name FROM ${SCHEMA}.experiment_participants p
       JOIN ${SCHEMA}.users us ON us.id = p.user_id WHERE p.experiment_id = $1`,
    [id]
  );
  e.joined = e.participants.some((p) => p.id === user.id);
  return e;
}

async function create(user, data) {
  const { title, description, objective, target_date } = data;
  if (!title || !description || !objective) throw Object.assign(new Error('Titre, description et objectif requis'), { status: 400 });
  const row = await db.get(
    `INSERT INTO ${SCHEMA}.experiments (title, description, objective, target_date, created_by)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [title, description, objective, target_date || null, user.id]
  );
  await logAction(user.id, 'experiment_create', 'experiment', row.id, null);
  return row.id;
}

async function updateStatus(user, id, status) {
  const exp = await db.get(`SELECT created_by FROM ${SCHEMA}.experiments WHERE id=$1`, [id]);
  if (!exp) throw Object.assign(new Error('Expérimentation introuvable'), { status: 404 });
  if (!canEdit(user, exp)) throw Object.assign(new Error('Droits insuffisants'), { status: 403 });
  if (!['planned', 'ongoing', 'completed', 'abandoned'].includes(status)) throw Object.assign(new Error('Statut invalide'), { status: 400 });
  await db.run(`UPDATE ${SCHEMA}.experiments SET status=$2 WHERE id=$1`, [id, status]);
  await logAction(user.id, 'experiment_status', 'experiment', id, { status });
  return { id, status };
}

async function toggleJoin(user, id) {
  const existing = await db.get(
    `SELECT 1 FROM ${SCHEMA}.experiment_participants WHERE experiment_id=$1 AND user_id=$2`,
    [id, user.id]
  );
  if (existing) {
    await db.run(`DELETE FROM ${SCHEMA}.experiment_participants WHERE experiment_id=$1 AND user_id=$2`, [id, user.id]);
    return { joined: false };
  }
  await db.run(`INSERT INTO ${SCHEMA}.experiment_participants (experiment_id, user_id) VALUES ($1,$2)`, [id, user.id]);
  return { joined: true };
}

async function synthesize(user, id) {
  const e = await getById(id, user);
  const fil = await comments.threadText('experiment', id);
  return ia.executerActionIA('experiment_summary', {
    experimentation: `${e.title} — ${e.description} — objectif : ${e.objective}`,
    commentaires: fil || '(aucun commentaire)',
  });
}

module.exports = { list, getById, create, updateStatus, toggleJoin, synthesize, canEdit };
