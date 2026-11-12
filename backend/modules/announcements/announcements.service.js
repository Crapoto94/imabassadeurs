const { db, SCHEMA } = require('../../pg_db');
const { ApiError } = require('../../utils/errors');
const { logAction } = require('../../utils/audit');

const KINDS = ['bandeau', 'modale'];

const withState = (r) => {
  const now = Date.now();
  const etat = !r.active ? 'desactive'
    : now < new Date(r.starts_at).getTime() ? 'programme'
    : now > new Date(r.ends_at).getTime() ? 'termine' : 'en_cours';
  return { ...r, etat };
};

function check(body, cur = {}) {
  const kind = body.kind ?? cur.kind;
  const title = body.title !== undefined ? String(body.title || '').trim() : (cur.title || '');
  const message = String(body.message ?? cur.message ?? '').trim();
  const starts = new Date(body.starts_at ?? cur.starts_at);
  const ends = new Date(body.ends_at ?? cur.ends_at);
  if (!KINDS.includes(kind)) throw new ApiError(400, 'Type d’annonce invalide (bandeau ou modale)');
  if (title.length > 120) throw new ApiError(400, 'Le titre ne doit pas dépasser 120 caractères');
  if (message.length < 3 || message.length > (kind === 'bandeau' ? 500 : 3000)) {
    throw new ApiError(400, `Le message doit faire de 3 à ${kind === 'bandeau' ? 500 : 3000} caractères`);
  }
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) throw new ApiError(400, 'Dates invalides');
  if (ends <= starts) throw new ApiError(400, 'La fin doit être postérieure au début');
  return {
    kind, title: title || null, message,
    starts_at: starts.toISOString(), ends_at: ends.toISOString(),
    active: body.active ?? cur.active ?? true,
  };
}

// Annonces en cours que l'utilisateur n'a pas masquées.
async function active(userId) {
  const items = await db.all(
    `SELECT a.id, a.kind, a.title, a.message, a.ends_at
       FROM ${SCHEMA}.announcements a
      WHERE a.active AND a.starts_at <= now() AND a.ends_at >= now()
        AND NOT EXISTS (SELECT 1 FROM ${SCHEMA}.announcement_dismissals d
                         WHERE d.announcement_id = a.id AND d.user_id = $1)
      ORDER BY a.starts_at, a.id`,
    [userId]
  );
  return { items };
}

async function dismiss(userId, id) {
  const exists = await db.get(`SELECT 1 AS ok FROM ${SCHEMA}.announcements WHERE id = $1`, [id]);
  if (!exists) throw new ApiError(404, 'Annonce introuvable');
  await db.run(
    `INSERT INTO ${SCHEMA}.announcement_dismissals (user_id, announcement_id) VALUES ($1,$2)
     ON CONFLICT DO NOTHING`,
    [userId, id]
  );
  return { id, dismissed: true };
}

async function list() {
  const rows = await db.all(
    `SELECT a.*, u.display_name AS created_by_name,
            (SELECT count(*)::int FROM ${SCHEMA}.announcement_dismissals d WHERE d.announcement_id = a.id) AS dismissed_count
       FROM ${SCHEMA}.announcements a LEFT JOIN ${SCHEMA}.users u ON u.id = a.created_by
      ORDER BY a.ends_at DESC, a.id DESC LIMIT 200`
  );
  return rows.map(withState);
}

async function create(user, body) {
  const v = check(body);
  const row = await db.get(
    `INSERT INTO ${SCHEMA}.announcements (kind, title, message, starts_at, ends_at, active, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [v.kind, v.title, v.message, v.starts_at, v.ends_at, v.active, user.id]
  );
  await logAction(user.id, 'announcement.create', 'announcement', row.id, v);
  return { id: row.id };
}

async function update(user, id, body) {
  const cur = await db.get(`SELECT * FROM ${SCHEMA}.announcements WHERE id = $1`, [id]);
  if (!cur) throw new ApiError(404, 'Annonce introuvable');
  const v = check(body, cur);
  await db.run(
    `UPDATE ${SCHEMA}.announcements
        SET kind=$2, title=$3, message=$4, starts_at=$5, ends_at=$6, active=$7, updated_at=now() WHERE id=$1`,
    [id, v.kind, v.title, v.message, v.starts_at, v.ends_at, v.active]
  );
  // Un message modifié doit être revu par tous : on efface les « ne plus afficher ».
  if (v.message !== cur.message) {
    await db.run(`DELETE FROM ${SCHEMA}.announcement_dismissals WHERE announcement_id = $1`, [id]);
  }
  await logAction(user.id, 'announcement.update', 'announcement', id, v);
  return { id };
}

async function remove(user, id) {
  const row = await db.get(`DELETE FROM ${SCHEMA}.announcements WHERE id = $1 RETURNING id`, [id]);
  if (!row) throw new ApiError(404, 'Annonce introuvable');
  await logAction(user.id, 'announcement.delete', 'announcement', id);
  return { id, deleted: true };
}

module.exports = { active, dismiss, list, create, update, remove };
