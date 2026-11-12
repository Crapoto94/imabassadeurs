const { db, SCHEMA } = require('../../pg_db');
const { ApiError } = require('../../utils/errors');
const { logAction } = require('../../utils/audit');
const notifications = require('../../services/notifications');

const TYPES = ['bug', 'evolution'];
const STATUSES = ['demandee', 'acceptee', 'refusee', 'realisee'];
const LABEL = { demandee: 'en attente', acceptee: 'acceptée', refusee: 'refusée', realisee: 'réalisée' };
const KIND = { bug: 'Votre signalement', evolution: 'Votre idée' };

const SELECT = `
  SELECT b.id, b.type, b.title, b.description, b.app_version, b.status, b.reason, b.created_at, b.treated_at,
         b.author_id, a.display_name AS author_name, t.display_name AS treated_by_name
    FROM ${SCHEMA}.backlog_items b
    LEFT JOIN ${SCHEMA}.users a ON a.id = b.author_id
    LEFT JOIN ${SCHEMA}.users t ON t.id = b.treated_by`;

async function create(user, body) {
  const type = String(body.type || '');
  const title = String(body.title || '').replace(/\s+/g, ' ').trim();
  const description = String(body.description || '').trim();
  if (!TYPES.includes(type)) throw new ApiError(400, 'Type invalide');
  if (title.length < 3 || title.length > 200) throw new ApiError(400, 'Le titre doit faire de 3 à 200 caractères');
  if (description.length < 3 || description.length > 5000) throw new ApiError(400, 'La description doit faire de 3 à 5000 caractères');
  const version = body.app_version ? String(body.app_version).slice(0, 20) : null;
  const row = await db.get(
    `INSERT INTO ${SCHEMA}.backlog_items (type, title, description, app_version, author_id)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [type, title, description, version, user.id]
  );
  await logAction(user.id, 'backlog.create', 'backlog', row.id, { type, title });
  return db.get(`${SELECT} WHERE b.id = $1`, [row.id]);
}

async function list({ authorId, status } = {}) {
  const args = [];
  const where = [];
  if (authorId) { args.push(authorId); where.push(`b.author_id = $${args.length}`); }
  if (status) {
    if (!STATUSES.includes(status)) throw new ApiError(400, 'Statut invalide');
    args.push(status); where.push(`b.status = $${args.length}`);
  }
  return db.all(`${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY b.created_at DESC, b.id DESC LIMIT 500`, args);
}

async function setStatus(admin, id, { status, reason }) {
  if (!STATUSES.includes(status)) throw new ApiError(400, 'Statut invalide');
  const cur = await db.get(`SELECT * FROM ${SCHEMA}.backlog_items WHERE id = $1`, [id]);
  if (!cur) throw new ApiError(404, 'Demande introuvable');
  if (cur.status === status) throw new ApiError(400, `La demande est déjà « ${LABEL[status]} »`);
  if (status === 'realisee' && cur.status === 'refusee') throw new ApiError(400, 'Une demande refusée doit d’abord être acceptée');
  const motif = String(reason || '').trim();
  if (status === 'refusee' && motif.length < 3) throw new ApiError(400, 'Un refus doit être motivé');
  await db.run(
    `UPDATE ${SCHEMA}.backlog_items SET status = $2, reason = $3, treated_by = $4, treated_at = now() WHERE id = $1`,
    [id, status, motif || null, admin.id]
  );
  await logAction(admin.id, `backlog.${status}`, 'backlog', id, { from: cur.status, reason: motif || null });
  // Prévient le demandeur via le système de notifications (catégorie « app »).
  if (cur.author_id && cur.author_id !== admin.id) {
    const suite = motif ? ` Motif : ${motif}` : '';
    await notifications.notifier([cur.author_id], 'app', 'backlog', id,
      `${KIND[cur.type]} « ${cur.title} » est ${LABEL[status]}.${suite}`).catch(() => {});
  }
  return db.get(`${SELECT} WHERE b.id = $1`, [id]);
}

async function remove(admin, id) {
  const row = await db.get(`DELETE FROM ${SCHEMA}.backlog_items WHERE id = $1 RETURNING id, title`, [id]);
  if (!row) throw new ApiError(404, 'Demande introuvable');
  await logAction(admin.id, 'backlog.delete', 'backlog', id, { title: row.title });
  return { id, deleted: true };
}

module.exports = { create, list, setStatus, remove };
