const jwt = require('jsonwebtoken');
const { db, SCHEMA } = require('../pg_db');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

async function loadUser(userId) {
  const user = await db.get(
    `SELECT id, ad_username, display_name, email, direction, service
       FROM ${SCHEMA}.users WHERE id = $1`,
    [userId]
  );
  if (!user) return null;
  const roles = await db.all(
    `SELECT role FROM ${SCHEMA}.user_roles WHERE user_id = $1`,
    [userId]
  );
  return { ...user, roles: roles.map((r) => r.role) };
}

// Authentifie via JWT applicatif et recharge l'utilisateur + ses rôles.
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.token;
  if (!token) return res.status(401).json({ error: 'Authentification requise' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await loadUser(payload.sub);
    if (!user) return res.status(401).json({ error: 'Utilisateur inconnu' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Jeton invalide ou expiré' });
  }
}

// Union : au moins un des rôles listés. Admin a toujours accès.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentification requise' });
    const ok = req.user.roles.includes('admin') || req.user.roles.some((r) => roles.includes(r));
    if (!ok) return res.status(403).json({ error: 'Droits insuffisants' });
    next();
  };
}

const requireAdmin = requireRole('admin');
const requireInteract = requireRole('iambassadeur', 'iaeclaireur', 'ianimateur');
const requireIanimateur = requireRole('ianimateur');

module.exports = { signToken, loadUser, requireAuth, requireRole, requireAdmin, requireInteract, requireIanimateur };
