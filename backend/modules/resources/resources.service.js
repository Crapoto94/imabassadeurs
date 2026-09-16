const fs = require('fs');
const path = require('path');
const { db, SCHEMA } = require('../../pg_db');
const ia = require('../../services/ia');
const comments = require('../comments/comments.service');
const { pageParams } = require('../../utils/pagination');
const { logAction } = require('../../utils/audit');
const { supprimerReferences } = require('../../utils/polymorphic');

const isModerator = (user) => user.roles.includes('ianimateur') || user.roles.includes('admin');

// Extrait le texte d'un PDF (best effort) pour l'alimentation des prompts IA.
async function extraireTexte(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return '';
  try {
    const pdfParse = require('pdf-parse');
    const buf = fs.readFileSync(filePath);
    const data = await pdfParse(buf);
    return (data.text || '').slice(0, 15000);
  } catch (err) {
    console.warn('[PDF] extraction impossible :', err.message);
    return '';
  }
}

async function list(user, query) {
  const { limit, offset } = pageParams(query);
  const params = [user.id];
  let where = `(r.status = 'published' OR r.proposed_by = $1)`;
  if (isModerator(user)) where = `(r.status = 'published' OR r.proposed_by = $1 OR $2::bool)`;
  const isMod = isModerator(user);
  if (isMod) params.push(true);
  if (query.status) {
    params.push(query.status);
    where += ` AND r.status = $${params.length}`;
  }
  if (query.search) {
    params.push(`%${query.search}%`);
    where += ` AND (r.title ILIKE $${params.length} OR r.description ILIKE $${params.length})`;
  }
  params.push(limit, offset);
  const rows = await db.all(
    `SELECT r.*, u.display_name AS proposed_by_name,
            (SELECT round(avg(stars)::numeric, 2) FROM ${SCHEMA}.resource_ratings rr WHERE rr.resource_id = r.id) AS avg_stars,
            (SELECT count(*)::int FROM ${SCHEMA}.resource_ratings rr WHERE rr.resource_id = r.id) AS ratings_count,
            (SELECT count(*)::int FROM ${SCHEMA}.comments c WHERE c.entity_type='resource' AND c.entity_id=r.id) AS comments_count
       FROM ${SCHEMA}.resources r
       JOIN ${SCHEMA}.users u ON u.id = r.proposed_by
      WHERE ${where}
      ORDER BY r.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows;
}

async function getById(id, user) {
  const r = await db.get(
    `SELECT r.*, u.display_name AS proposed_by_name,
            (SELECT round(avg(stars)::numeric, 2) FROM ${SCHEMA}.resource_ratings rr WHERE rr.resource_id = r.id) AS avg_stars,
            (SELECT count(*)::int FROM ${SCHEMA}.resource_ratings rr WHERE rr.resource_id = r.id) AS ratings_count
       FROM ${SCHEMA}.resources r JOIN ${SCHEMA}.users u ON u.id = r.proposed_by
      WHERE r.id = $1`,
    [id]
  );
  if (!r) throw Object.assign(new Error('Ressource introuvable'), { status: 404 });
  if (r.status !== 'published' && r.proposed_by !== user.id && !isModerator(user)) {
    throw Object.assign(new Error('Accès refusé'), { status: 403 });
  }
  const myRating = await db.get(
    `SELECT stars FROM ${SCHEMA}.resource_ratings WHERE resource_id = $1 AND user_id = $2`,
    [id, user.id]
  );
  return { ...r, my_rating: myRating?.stars || null };
}

async function create(user, data, file) {
  const { title, description, kind, url } = data;
  if (!title || !description) throw Object.assign(new Error('Titre et description requis'), { status: 400 });
  if (kind === 'pdf' && !file) throw Object.assign(new Error('Fichier PDF requis'), { status: 400 });
  if (kind === 'link' && !url) throw Object.assign(new Error('URL requise'), { status: 400 });

  const status = isModerator(user) ? 'published' : 'pending';
  const row = await db.get(
    `INSERT INTO ${SCHEMA}.resources (title, description, kind, file_path, url, proposed_by, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [title, description, kind, file ? file.filename : null, kind === 'link' ? url : null, user.id, status]
  );
  await logAction(user.id, 'resource_create', 'resource', row.id, { status });
  return row.id;
}

async function review(user, id, status, note) {
  if (!isModerator(user)) throw Object.assign(new Error('Réservé aux IAnimateurs'), { status: 403 });
  if (!['published', 'rejected'].includes(status)) throw Object.assign(new Error('Statut invalide'), { status: 400 });
  await db.run(
    `UPDATE ${SCHEMA}.resources SET status=$2, review_note=$3, reviewed_by=$4, reviewed_at=now() WHERE id=$1`,
    [id, status, note || null, user.id]
  );
  await logAction(user.id, 'resource_review', 'resource', id, { status, note });
  return { id, status };
}

async function rate(user, id, stars) {
  const s = parseInt(stars, 10);
  if (!(s >= 1 && s <= 4)) throw Object.assign(new Error('Note entre 1 et 4'), { status: 400 });
  await db.run(
    `INSERT INTO ${SCHEMA}.resource_ratings (resource_id, user_id, stars)
     VALUES ($1,$2,$3)
     ON CONFLICT (resource_id, user_id) DO UPDATE SET stars=$3, updated_at=now()`,
    [id, user.id, s]
  );
  return { resource_id: id, stars: s };
}

async function synthesizeDocument(user, id) {
  const r = await getById(id, user);
  const contenu = await extraireTexte(r.file_path ? path.join(__dirname, '..', '..', 'uploads', r.file_path) : null);
  return ia.executerActionIA('resource_synthesis', {
    titre: r.title,
    description: r.description,
    contenu_extrait: contenu || r.description,
  });
}

async function synthesizeThread(user, id) {
  const r = await getById(id, user);
  const fil = await comments.threadText('resource', id);
  return ia.executerActionIA('thread_synthesis', { titre_entite: r.title, commentaires: fil || '(aucun commentaire)' });
}

// ───────────────────────── Modération (édition / suppression) ───────────────
// Édite le titre/description/url : admin, IAnimateur ou auteur.
async function update(user, id, data) {
  const r = await db.get(`SELECT proposed_by, kind FROM ${SCHEMA}.resources WHERE id=$1`, [id]);
  if (!r) throw Object.assign(new Error('Ressource introuvable'), { status: 404 });
  const autorise = user.roles.includes('admin') || user.roles.includes('ianimateur') || r.proposed_by === user.id;
  if (!autorise) throw Object.assign(new Error('Droits insuffisants'), { status: 403 });
  const { title, description, url } = data;
  if (!title || !description) throw Object.assign(new Error('Titre et description requis'), { status: 400 });
  await db.run(
    `UPDATE ${SCHEMA}.resources SET title=$2, description=$3, url=$4 WHERE id=$1`,
    [id, title, description, r.kind === 'link' ? (url || null) : null]
  );
  await logAction(user.id, 'resource_update', 'resource', id, null);
  return getById(id, user);
}

// Supprime une ressource (et son contenu lié) : admin ou IAnimateur.
async function remove(user, id) {
  if (!isModerator(user)) throw Object.assign(new Error('Réservé aux administrateurs/IAnimateurs'), { status: 403 });
  const r = await db.get(`SELECT file_path FROM ${SCHEMA}.resources WHERE id=$1`, [id]);
  if (!r) throw Object.assign(new Error('Ressource introuvable'), { status: 404 });
  await supprimerReferences('resource', id);
  await db.run(`DELETE FROM ${SCHEMA}.resources WHERE id=$1`, [id]);
  if (r.file_path) {
    const file = path.join(__dirname, '..', '..', 'uploads', r.file_path);
    fs.promises.unlink(file).catch(() => {});
  }
  await logAction(user.id, 'resource_delete', 'resource', id, null);
  return { id, deleted: true };
}

module.exports = {
  list, getById, create, review, rate, synthesizeDocument, synthesizeThread,
  update, remove, isModerator,
};
