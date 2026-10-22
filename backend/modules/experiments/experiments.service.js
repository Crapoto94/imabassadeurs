const { db, SCHEMA } = require('../../pg_db');
const fs = require('fs');
const path = require('path');
const ia = require('../../services/ia');
const comments = require('../comments/comments.service');
const { pageParams } = require('../../utils/pagination');
const { logAction } = require('../../utils/audit');
const { supprimerReferences } = require('../../utils/polymorphic');
const themes = require('../themes/themes.service');

const canEdit = (user, exp) =>
  user.roles.includes('ianimateur') || user.roles.includes('admin') || exp.created_by === user.id;

async function list(user, query) {
  const { limit, offset } = pageParams(query);
  const params = [user.id];
  let where = '1=1';
  if (query.status) { params.push(query.status); where += ` AND e.status = $${params.length}`; }
  if (query.theme) { params.push(query.theme); where += ` AND ${themes.themeFilterClause('experiment', params.length, 'e')}`; }
  params.push(limit, offset);
  const rows = await db.all(
    `SELECT e.*, u.display_name AS created_by_name,
            (SELECT count(*)::int FROM ${SCHEMA}.experiment_participants p WHERE p.experiment_id = e.id) AS participants_count,
            EXISTS(SELECT 1 FROM ${SCHEMA}.experiment_participants p WHERE p.experiment_id = e.id AND p.user_id = $1) AS joined,
            (SELECT count(*)::int FROM ${SCHEMA}.comments c WHERE c.entity_type='experiment' AND c.entity_id=e.id) AS comments_count,
            (SELECT count(*)::int FROM ${SCHEMA}.experiment_attachments a WHERE a.experiment_id = e.id) AS attachments_count
       FROM ${SCHEMA}.experiments e JOIN ${SCHEMA}.users u ON u.id = e.created_by
      WHERE ${where}
      ORDER BY e.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  const themeMap = await themes.themesForEntities('experiment', rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, themes: themeMap[r.id] || [] }));
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
  e.attachments = await listAttachments(id);
  const themeMap = await themes.themesForEntities('experiment', [id]);
  e.themes = themeMap[id] || [];
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
  await themes.setEntityThemes('experiment', row.id, data.theme_ids);
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

// ── Pièces jointes (documents) : auteur, IAnimateur ou admin (canEdit) ──
async function listAttachments(experimentId) {
  return db.all(
    `SELECT a.id, a.file_path, a.original_name, a.mime_type, a.size_bytes, a.created_at,
            u.display_name AS uploaded_by_name
       FROM ${SCHEMA}.experiment_attachments a
       JOIN ${SCHEMA}.users u ON u.id = a.uploaded_by
      WHERE a.experiment_id = $1
      ORDER BY a.created_at ASC`,
    [experimentId]
  );
}

async function addAttachment(user, id, file) {
  if (!file) throw Object.assign(new Error('Fichier requis'), { status: 400 });
  const exp = await db.get(`SELECT created_by FROM ${SCHEMA}.experiments WHERE id=$1`, [id]);
  if (!exp) throw Object.assign(new Error('Expérimentation introuvable'), { status: 404 });
  if (!canEdit(user, exp)) throw Object.assign(new Error('Droits insuffisants'), { status: 403 });
  const row = await db.get(
    `INSERT INTO ${SCHEMA}.experiment_attachments (experiment_id, file_path, original_name, mime_type, size_bytes, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [id, file.filename, file.originalname, file.mimetype, file.size, user.id]
  );
  await logAction(user.id, 'experiment_attachment_add', 'experiment', id, { attachment_id: row.id, name: file.originalname });
  return { id: row.id };
}

async function removeAttachment(user, id, attachmentId) {
  const exp = await db.get(`SELECT created_by FROM ${SCHEMA}.experiments WHERE id=$1`, [id]);
  if (!exp) throw Object.assign(new Error('Expérimentation introuvable'), { status: 404 });
  if (!canEdit(user, exp)) throw Object.assign(new Error('Droits insuffisants'), { status: 403 });
  const att = await db.get(
    `SELECT file_path FROM ${SCHEMA}.experiment_attachments WHERE id=$1 AND experiment_id=$2`,
    [attachmentId, id]
  );
  if (!att) throw Object.assign(new Error('Pièce jointe introuvable'), { status: 404 });
  await db.run(`DELETE FROM ${SCHEMA}.experiment_attachments WHERE id=$1`, [attachmentId]);
  fs.promises.unlink(path.join(__dirname, '..', '..', 'uploads', att.file_path)).catch(() => {});
  await logAction(user.id, 'experiment_attachment_delete', 'experiment', id, { attachment_id: attachmentId });
  return { id: attachmentId, deleted: true };
}

async function synthesize(user, id) {
  const e = await getById(id, user);
  const fil = await comments.threadText('experiment', id);
  return ia.executerActionIA('experiment_summary', {
    experimentation: `${e.title} — ${e.description} — objectif : ${e.objective}`,
    commentaires: fil || '(aucun commentaire)',
  });
}

// Édition/suppression : auteur, IAnimateur ou admin (cf. canEdit).
async function update(user, id, data) {
  const exp = await db.get(`SELECT created_by FROM ${SCHEMA}.experiments WHERE id=$1`, [id]);
  if (!exp) throw Object.assign(new Error('Expérimentation introuvable'), { status: 404 });
  if (!canEdit(user, exp)) throw Object.assign(new Error('Droits insuffisants'), { status: 403 });
  const { title, description, objective, target_date, status } = data;
  if (!title || !description || !objective) throw Object.assign(new Error('Titre, description et objectif requis'), { status: 400 });
  if (status && !['planned', 'ongoing', 'completed', 'abandoned'].includes(status)) {
    throw Object.assign(new Error('Statut invalide'), { status: 400 });
  }
  await db.run(
    `UPDATE ${SCHEMA}.experiments
        SET title=$2, description=$3, objective=$4, target_date=$5, status=COALESCE($6, status), edited_at=now()
      WHERE id=$1`,
    [id, title, description, objective, target_date || null, status || null]
  );
  await logAction(user.id, 'experiment_update', 'experiment', id, null);
  if (data.theme_ids !== undefined) await themes.setEntityThemes('experiment', id, data.theme_ids);
  return getById(id, user);
}

async function remove(user, id) {
  const exp = await db.get(`SELECT created_by FROM ${SCHEMA}.experiments WHERE id=$1`, [id]);
  if (!exp) throw Object.assign(new Error('Expérimentation introuvable'), { status: 404 });
  if (!canEdit(user, exp)) throw Object.assign(new Error('Droits insuffisants'), { status: 403 });
  await supprimerReferences('experiment', id);
  await db.run(`DELETE FROM ${SCHEMA}.experiments WHERE id=$1`, [id]);
  await logAction(user.id, 'experiment_delete', 'experiment', id, null);
  return { id, deleted: true };
}

module.exports = { list, getById, create, updateStatus, toggleJoin, synthesize, update, remove, canEdit, addAttachment, removeAttachment };
