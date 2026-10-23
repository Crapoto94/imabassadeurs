const { db, SCHEMA, pool } = require('../../pg_db');
const ia = require('../../services/ia');
const apm = require('../../services/apm');
const { pageParams } = require('../../utils/pagination');
const { logAction } = require('../../utils/audit');
const { reassignAll } = require('../../utils/userMerge');

const ROLES = ['admin', 'iambassadeur', 'iaeclaireur', 'ianimateur'];

async function getSettings() {
  return db.get(`SELECT * FROM ${SCHEMA}.app_settings WHERE id=1`);
}

async function updateSettings(user, data) {
  await db.run(
    `UPDATE ${SCHEMA}.app_settings
        SET org_name=$1, footer_line1=$2, footer_line2=$3, footer_line3=$4, footer_color=$5,
            gamification_enabled=$6
      WHERE id=1`,
    [data.org_name, data.footer_line1, data.footer_line2, data.footer_line3, data.footer_color,
      data.gamification_enabled !== false]
  );
  await logAction(user.id, 'settings_update', 'app_settings', 1, data);
  return getSettings();
}

async function listUsers(query) {
  const { limit, offset } = pageParams(query, { defaultLimit: 50 });
  const params = [limit, offset];
  const search = query.search ? `%${query.search}%` : null;
  if (search) params.unshift(search);
  const where = search ? 'WHERE u.display_name ILIKE $1 OR u.ad_username ILIKE $1' : '';
  const rows = await db.all(
    `SELECT u.id, u.ad_username, u.display_name, u.email, u.direction, u.service, u.last_login_at,
            COALESCE(array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}') AS roles
       FROM ${SCHEMA}.users u
       LEFT JOIN ${SCHEMA}.user_roles ur ON ur.user_id = u.id
       ${where}
       GROUP BY u.id
       ORDER BY u.display_name ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows;
}

async function grantRole(admin, userId, role) {
  if (!ROLES.includes(role)) throw Object.assign(new Error('Rôle invalide'), { status: 400 });
  await db.run(
    `INSERT INTO ${SCHEMA}.user_roles (user_id, role, granted_by) VALUES ($1,$2,$3)
     ON CONFLICT (user_id, role) DO NOTHING`,
    [userId, role, admin.id]
  );
  await logAction(admin.id, 'role_grant', 'user', userId, { role });
  return { user_id: userId, role, granted: true };
}

async function revokeRole(admin, userId, role) {
  if (role === 'admin') {
    const admins = await db.get(`SELECT count(*)::int AS n FROM ${SCHEMA}.user_roles WHERE role='admin'`);
    if (admins.n <= 1) throw Object.assign(new Error('Impossible de retirer le dernier administrateur'), { status: 400 });
  }
  await db.run(`DELETE FROM ${SCHEMA}.user_roles WHERE user_id=$1 AND role=$2`, [userId, role]);
  await logAction(admin.id, 'role_revoke', 'user', userId, { role });
  return { user_id: userId, role, granted: false };
}

// Suppression d'un compte : réaffecte ses contributions à un doublon insensible
// à la casse (ou à la cible fournie), puis supprime le compte.
async function removeUser(admin, userId, data) {
  if (userId === admin.id) throw Object.assign(new Error('Impossible de supprimer votre propre compte'), { status: 400 });
  const target = await db.get(`SELECT id, ad_username FROM ${SCHEMA}.users WHERE id=$1`, [userId]);
  if (!target) throw Object.assign(new Error('Utilisateur introuvable'), { status: 404 });

  const isAdmin = await db.get(`SELECT 1 FROM ${SCHEMA}.user_roles WHERE user_id=$1 AND role='admin'`, [userId]);
  if (isAdmin) throw Object.assign(new Error('Impossible de supprimer un compte administrateur'), { status: 403 });

  // Cible de réaffectation : doublon (même identifiant, casse différente) ou cible explicite.
  let keepId = data?.reassign_to ? parseInt(data.reassign_to, 10) : null;
  if (!keepId) {
    const dup = await db.get(
      `SELECT id FROM ${SCHEMA}.users WHERE lower(ad_username)=lower($1) AND id <> $2 ORDER BY id ASC LIMIT 1`,
      [target.ad_username, userId]
    );
    keepId = dup?.id || null;
  }
  if (keepId) {
    const keep = await db.get(`SELECT id FROM ${SCHEMA}.users WHERE id=$1`, [keepId]);
    if (!keep) throw Object.assign(new Error('Compte cible introuvable'), { status: 400 });
    if (keep.id === userId) throw Object.assign(new Error('Compte cible identique au compte supprimé'), { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (keepId) await reassignAll((sql, p) => client.query(sql, p), userId, keepId);
    await client.query(`DELETE FROM ${SCHEMA}.users WHERE id=$1`, [userId]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23503') {
      throw Object.assign(new Error('Ce compte possède des contributions : réaffectez-les avant de le supprimer'), { status: 409 });
    }
    throw e;
  } finally {
    client.release();
  }

  await logAction(admin.id, 'user_delete', 'user', userId, { reassigned_to: keepId || null });

  // S'il ne reste plus de doublons, crée l'index unique (filet de sécurité),
  // pour ne pas dépendre du script de fusion exécuté manuellement.
  try {
    const dup = await db.get(
      `SELECT count(*)::int AS n FROM (SELECT lower(ad_username) AS k FROM ${SCHEMA}.users GROUP BY 1 HAVING count(*) > 1) d`
    );
    if (dup.n === 0) {
      await db.run(`CREATE UNIQUE INDEX IF NOT EXISTS uq_users_ad_username_lower ON ${SCHEMA}.users (lower(ad_username))`);
    }
  } catch (e) {
    console.error('[ADMIN] création différée de l\'index unique :', e.message);
  }

  return { id: userId, deleted: true, reassigned_to: keepId || null };
}

async function listAudit(query) {
  const { limit, offset } = pageParams(query, { defaultLimit: 50 });
  return db.all(
    `SELECT a.*, u.display_name AS user_name FROM ${SCHEMA}.audit_log a
       LEFT JOIN ${SCHEMA}.users u ON u.id = a.user_id
      ORDER BY a.created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
}

async function listPrompts() {
  return db.all(`SELECT * FROM ${SCHEMA}.ai_prompts ORDER BY label ASC`);
}

async function updatePrompt(user, actionKey, data) {
  const { label, prompt_template, preferred_model } = data;
  if (!label || !prompt_template) throw Object.assign(new Error('Libellé et gabarit requis'), { status: 400 });
  await db.run(
    `UPDATE ${SCHEMA}.ai_prompts
        SET label=$2, prompt_template=$3, preferred_model=$4, updated_by=$5, updated_at=now()
      WHERE action_key=$1`,
    [actionKey, label, prompt_template, preferred_model || null, user.id]
  );
  await logAction(user.id, 'prompt_update', 'ai_prompt', null, { action_key: actionKey });
  return db.get(`SELECT * FROM ${SCHEMA}.ai_prompts WHERE action_key=$1`, [actionKey]);
}

async function testPrompt(user, actionKey, variables) {
  const res = await ia.executerActionIA(actionKey, variables || {});
  return res;
}

const listAiModels = () => apm.listerModelesIA();

module.exports = {
  ROLES, getSettings, updateSettings, listUsers, grantRole, revokeRole, removeUser,
  listAudit, listPrompts, updatePrompt, testPrompt, listAiModels,
};
