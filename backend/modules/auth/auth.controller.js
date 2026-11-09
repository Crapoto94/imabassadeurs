const bcrypt = require('bcryptjs');
const { db, SCHEMA } = require('../../pg_db');
const apm = require('../../services/apm');
const { signToken, loadUser } = require('../../middleware/auth');
const { logAction } = require('../../utils/audit');

const texte = (v) => (Array.isArray(v) ? v[0] : v) || null;

// « DUPONT-MARTIN » / « marc » -> « Dupont-Martin » / « Marc » ; une casse mixte est conservée.
function soigner(v) {
  const t = String(v || '').trim();
  if (!t || (t !== t.toUpperCase() && t !== t.toLowerCase())) return t;
  return t.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (m, sep, c) => sep + c.toUpperCase());
}

// Libellé tout en capitales de plusieurs mots -> « Direction des systemes d'information » ;
// un sigle seul (« DSI ») est conservé tel quel.
function phrase(v) {
  const t = String(v || '').trim();
  if (!t || !/\s/.test(t) || t !== t.toUpperCase()) return t || null;
  return t.charAt(0) + t.slice(1).toLowerCase();
}

// Premier OU « métier » du DN : OU=DSI,OU=Utilisateurs W10,OU=IVRY,… -> « DSI ».
function serviceDepuisDn(dn) {
  const ou = String(dn || '').match(/OU=([^,]+)/gi)?.map((s) => s.slice(3)) || [];
  return ou.find((o) => !/^(utilisateurs|ivry|users)/i.test(o)) || null;
}

// Normalise la fiche renvoyée par l'APM (/api/v1/ad/user). L'APM renvoie une LISTE de comptes
// proches (recherche par sous-chaîne) : on ne garde que celui dont le sAMAccountName correspond exactement.
function normaliserAgent(agent, username) {
  const liste = Array.isArray(agent) ? agent : agent ? [agent.user || agent] : [];
  const login = String(username).toLowerCase();
  const a = liste.find((x) => String(texte(x?.sAMAccountName) || '').toLowerCase() === login)
    || (liste.length === 1 ? liste[0] : null);
  if (!a) return {};
  const prenom = soigner(texte(a.givenName));
  const nom = soigner(texte(a.sn));
  const direction = phrase(texte(a.company) || texte(a.description) || texte(a.department));
  const service = phrase(texte(a.department)) || serviceDepuisDn(texte(a.distinguishedName) || texte(a.dn));
  return {
    // Prénom Nom (plutôt que le cn de l'AD, au format « NOM Prénom » ou technique).
    display_name: [prenom, nom].filter(Boolean).join(' ') || texte(a.displayName) || texte(a.cn) || username,
    email: texte(a.mail) || texte(a.userPrincipalName),
    // AD Ivry : company = direction, department = service, title = fonction.
    direction,
    service: service && service !== direction ? service : null,
    job_title: phrase(texte(a.title)),
  };
}

async function upsertUser(adUsername, info) {
  const existing = await db.get(
    `SELECT id FROM ${SCHEMA}.users WHERE lower(ad_username) = $1 ORDER BY id ASC LIMIT 1`,
    [adUsername]
  );
  if (existing) {
    await db.run(
      `UPDATE ${SCHEMA}.users
          SET display_name = COALESCE($2, display_name),
              email = COALESCE($3, email),
              direction = COALESCE($4, direction),
              service = COALESCE($5, service),
              job_title = COALESCE($6, job_title),
              last_login_at = now()
        WHERE id = $1`,
      [existing.id, info.display_name, info.email, info.direction, info.service, info.job_title]
    );
    return existing.id;
  }
  const created = await db.get(
    `INSERT INTO ${SCHEMA}.users (ad_username, display_name, email, direction, service, job_title, last_login_at)
     VALUES ($1, $2, $3, $4, $5, $6, now()) RETURNING id`,
    [adUsername, info.display_name || adUsername, info.email, info.direction, info.service, info.job_title]
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
  const rawUsername = String(req.body?.username || '').trim();
  const password = req.body?.password;
  if (!rawUsername || !password) return res.status(400).json({ error: 'Identifiant et mot de passe requis' });

  // Clé applicative canonique : insensible à la casse (l'AD l'est aussi).
  // Évite qu'un même agent obtienne deux comptes (« LRigoulat » vs « lrigoulat »).
  const username = rawUsername.toLowerCase();

  const auth = await apm.authentifierAgent(rawUsername, password);
  let userId = null;

  if (auth.success) {
    const agent = await apm.getAgent(rawUsername);
    const info = normaliserAgent(agent, rawUsername);
    userId = await upsertUser(username, info);
  } else if (process.env.NODE_ENV !== 'production' || process.env.LOCAL_LOGIN_ENABLED === 'true') {
    // Repli de développement, ou compte de secours en production si
    // LOCAL_LOGIN_ENABLED=true (compte local seedé, AD/APM injoignable).
    const local = await db.get(
      `SELECT id, password_hash FROM ${SCHEMA}.users WHERE lower(ad_username) = $1 ORDER BY id ASC LIMIT 1`,
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

module.exports = { login, me, upsertUser, normaliserAgent };
