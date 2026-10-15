const { db, SCHEMA } = require('../../pg_db');
const { logAction } = require('../../utils/audit');

// Le scope d'un thème = le type d'entité auquel il s'applique (polymorphe).
const SCOPES = ['resource', 'experiment', 'risk'];

function normalizeIds(themeIds) {
  let v = themeIds;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { v = []; } }
  if (!Array.isArray(v)) return [];
  return v.map((n) => parseInt(n, 10)).filter((n) => Number.isInteger(n));
}

function slugify(s) {
  return String(s).trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

async function list(scope, includeInactive = false) {
  const params = [];
  const clauses = [];
  if (!includeInactive) clauses.push('active = true');
  if (scope && SCOPES.includes(scope)) { params.push(scope); clauses.push(`scope = $${params.length}`); }
  const where = clauses.length ? clauses.join(' AND ') : '1=1';
  return db.all(
    `SELECT id, slug, label, scope, group_label, group_position, position, active
       FROM ${SCHEMA}.themes
      WHERE ${where}
      ORDER BY scope, group_position, position, id`,
    params
  );
}

async function create(user, data) {
  const { scope, label, group_label } = data;
  if (!SCOPES.includes(scope)) throw Object.assign(new Error('Scope invalide'), { status: 400 });
  if (!label) throw Object.assign(new Error('Libellé requis'), { status: 400 });
  const slug = slugify(data.slug || label);
  const gp = parseInt(data.group_position, 10) || 0;
  const pos = parseInt(data.position, 10) || 0;
  const row = await db.get(
    `INSERT INTO ${SCHEMA}.themes (scope, slug, label, group_label, group_position, position)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (slug) DO UPDATE SET label = EXCLUDED.label
     RETURNING id`,
    [scope, slug, label, group_label || null, gp, pos]
  );
  await logAction(user.id, 'theme_create', 'theme', row.id, { scope, slug });
  return row.id;
}

async function update(user, id, data) {
  const t = await db.get(`SELECT id FROM ${SCHEMA}.themes WHERE id=$1`, [id]);
  if (!t) throw Object.assign(new Error('Thème introuvable'), { status: 404 });
  const { label, group_label, group_position, position, active } = data;
  await db.run(
    `UPDATE ${SCHEMA}.themes
        SET label = COALESCE($2, label),
            group_label = $3,
            group_position = COALESCE($4, group_position),
            position = COALESCE($5, position),
            active = COALESCE($6, active)
      WHERE id=$1`,
    [
      id,
      label || null,
      group_label ?? null,
      group_position != null ? parseInt(group_position, 10) : null,
      position != null ? parseInt(position, 10) : null,
      typeof active === 'boolean' ? active : null,
    ]
  );
  await logAction(user.id, 'theme_update', 'theme', id, null);
  return { id };
}

async function remove(user, id) {
  const t = await db.get(`SELECT id FROM ${SCHEMA}.themes WHERE id=$1`, [id]);
  if (!t) throw Object.assign(new Error('Thème introuvable'), { status: 404 });
  await db.run(`DELETE FROM ${SCHEMA}.themes WHERE id=$1`, [id]);
  await logAction(user.id, 'theme_delete', 'theme', id, null);
  return { id, deleted: true };
}

// ── Association contenu ↔ thèmes (polymorphe) ──
// entityType ∈ SCOPES. Remplace l'ensemble des thèmes d'un contenu.
async function setEntityThemes(entityType, entityId, themeIds) {
  if (!SCOPES.includes(entityType)) return;
  await db.run(
    `DELETE FROM ${SCHEMA}.entity_themes WHERE entity_type=$1 AND entity_id=$2`,
    [entityType, entityId]
  );
  const ids = normalizeIds(themeIds);
  if (!ids.length) return;
  const valid = await db.all(
    `SELECT id FROM ${SCHEMA}.themes WHERE scope=$1 AND id = ANY($2::int[])`,
    [entityType, ids]
  );
  for (const row of valid) {
    await db.run(
      `INSERT INTO ${SCHEMA}.entity_themes (entity_type, entity_id, theme_id)
       VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [entityType, entityId, row.id]
    );
  }
}

// Retourne { [entity_id]: Theme[] } pour une liste d'ids.
async function themesForEntities(entityType, ids) {
  if (!ids || !ids.length) return {};
  const rows = await db.all(
    `SELECT et.entity_id, t.id, t.slug, t.label, t.scope, t.group_label, t.position
       FROM ${SCHEMA}.entity_themes et
       JOIN ${SCHEMA}.themes t ON t.id = et.theme_id
      WHERE et.entity_type = $1 AND et.entity_id = ANY($2::int[])
      ORDER BY t.group_position, t.position, t.id`,
    [entityType, ids]
  );
  const map = {};
  for (const r of rows) {
    (map[r.entity_id] ||= []).push({
      id: r.id, slug: r.slug, label: r.label, scope: r.scope,
      group_label: r.group_label, position: r.position,
    });
  }
  return map;
}

// Clause SQL de filtre par thème (id ou slug) pour un alias d'entité.
function themeFilterClause(entityType, paramIndex, entityAlias) {
  return `EXISTS (
      SELECT 1 FROM ${SCHEMA}.entity_themes et
      JOIN ${SCHEMA}.themes t ON t.id = et.theme_id
     WHERE et.entity_type = '${entityType}' AND et.entity_id = ${entityAlias}.id
       AND (t.slug = $${paramIndex} OR t.id::text = $${paramIndex})
    )`;
}

module.exports = { SCOPES, list, create, update, remove, setEntityThemes, themesForEntities, themeFilterClause };
