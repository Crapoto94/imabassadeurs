const bcrypt = require('bcryptjs');
const { db, SCHEMA } = require('../../pg_db');
const apm = require('../../services/apm');
const { signToken, loadUser } = require('../../middleware/auth');
const { logAction } = require('../../utils/audit');

// Normalise la fiche agent renvoyée par l'APM (/api/v1/ad/user) — noms de champs variables.
function normaliserAgent(agent, username) {
  if (!agent) return {};
  const a = agent.user || agent;
  return {
    display_name: a.displayName || a.display_name || a.cn || a.name || a.fullName || username,
    email: a.mail || a.email || a.userPrincipalName || null,
    direction: a.direction || a.department || a.service_direction || null,
    service: a.service || a.description || a.division || null,
  };
}

async function upsertUser(username, info) {
  const existing = await db.get(`SELECT id FROM ${SCHEMA}.users WHERE ad_username = $1`, [username]);
  if (existing) {
    await db.run(
      `UPDATE ${SCHEMA}.users
          SET display_name = COALESCE($2, display_name),
              email = COALESCE($3, email),
              direction = COALESCE($4, direction),
              service = COALESCE($5, service),
              last_login_at = now()
        WHERE id = $1`,
      [existing.id, info.display_name, info.email, info.direction, info.service]
    );
    return existing.id;
  }
  const created = await db.get(
    `INSERT INTO ${SCHEMA}.users (ad_username, display_name, email, direction, service, last_login_at)
     VALUES ($1, $2, $3, $4, $5, now()) RETURNING id`,
    [username, info.display_name || username, info.email, info.direction, info.service]
  );
  return created.id;
}

// Amorçage : les identifiants AD listés dans ADMIN_USERS (séparés par des virgules)
// reçoivent le rôle admin automatiquement. Indispensable en production : sans cela,
// aucun agent ne dispose du rôle admin après l'installation (pas de compte local).
async function bootstrapAdmin(userId, username) {
  const list = (process.env.ADMIN_USERS || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!list.includes(String(username).toLowerCase())) return;
  await db.run(
    `INSERT INTO ${SCHEMA}.user_roles (user_id, role, granted_by)
     VALUES ($1, 'admin', NULL) ON CONFLICT (user_id, role) DO NOTHING`,
    [userId]
  );
}

// POST /api/v1/auth/login — authentification AD via APM, puis JWT applicatif.
async function login(req, res) {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Identifiant et mot de passe requis' });

  const auth = await apm.authentifierAgent(username, password);
  let userId = null;

  if (auth.success) {
    const agent = await apm.getAgent(username);
    const info = normaliserAgent(agent, username);
    userId = await upsertUser(username, info);
  } else if (process.env.NODE_ENV !== 'production' || process.env.LOCAL_LOGIN_ENABLED === 'true') {
    // Repli de développement, ou compte de secours en production si
    // LOCAL_LOGIN_ENABLED=true (compte local seedé, AD/APM injoignable).
    const local = await db.get(
      `SELECT id, password_hash FROM ${SCHEMA}.users WHERE ad_username = $1`,
      [username]
    );
    if (local?.password_hash && (await bcrypt.compare(password, local.password_hash))) {
      await db.run(`UPDATE ${SCHEMA}.users SET last_login_at = now() WHERE id = $1`, [local.id]);
      userId = local.id;
    }
  }

  if (!userId) {
    return res.status(401).json({ error: auth.error || 'Identifiants invalides' });
  }

  await bootstrapAdmin(userId, username);

  const user = await loadUser(userId);
  await logAction(userId, 'login', 'user', userId, null);
  res.json({ token: signToken(userId), user });
}

// GET /api/v1/auth/me
async function me(req, res) {
  res.json({ user: req.user });
}

module.exports = { login, me, upsertUser };
