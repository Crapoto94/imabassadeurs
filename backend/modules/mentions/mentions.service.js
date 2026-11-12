const { db, SCHEMA } = require('../../pg_db');
const { ApiError } = require('../../utils/errors');
const notifications = require('../../services/notifications');

// Un tag est stocké dans le texte sous la forme @[Nom affiché](id) ou @[tout le monde](all).
const TOKEN = /@\[([^\]\n]{1,80})\]\((\d+|all)\)/g;
const EVERYONE = 'tout le monde';

const canTagEveryone = (u) => u.roles.includes('admin') || u.roles.includes('ianimateur');

// Tags d'un texte : { ids: Set<number>, everyone: boolean }.
function extract(body) {
  const ids = new Set();
  let everyone = false;
  for (const m of String(body || '').matchAll(TOKEN)) {
    if (m[2] === 'all') everyone = true; else ids.add(parseInt(m[2], 10));
  }
  return { ids, everyone };
}

// Texte sans balisage : « @Marc Chevalier » (synthèses IA, aperçus, e-mails).
const toPlain = (body) => String(body || '').replace(TOKEN, (_, name) => `@${name}`);

// Valide les tags d'un texte et le réécrit avec les vrais noms (un tag ne peut pas usurper un nom).
// Un id inconnu redevient du texte simple ; « tout le monde » est réservé aux admins et IAnimateurs.
async function normalize(author, body) {
  const { ids, everyone } = extract(body);
  if (everyone && !canTagEveryone(author)) throw new ApiError(403, '« @tout le monde » est réservé aux administrateurs et aux IAnimateurs');
  const known = new Map();
  if (ids.size) {
    const rows = await db.all(`SELECT id, display_name FROM ${SCHEMA}.users WHERE id = ANY($1::int[])`, [[...ids]]);
    for (const r of rows) known.set(r.id, r.display_name);
  }
  const valid = new Set();
  const text = String(body).replace(TOKEN, (_, name, id) => {
    if (id === 'all') return `@[${EVERYONE}](all)`;
    const real = known.get(parseInt(id, 10));
    if (!real) return `@${name}`;
    valid.add(parseInt(id, 10));
    return `@[${real.replace(/[\]\n]/g, ' ')}](${id})`;
  });
  return { body: text, ids: valid, everyone };
}

// Prévient les personnes citées (ou tout le monde). `skip` : identifiants déjà prévenus autrement.
async function notify({ author, ids, everyone, entityType, entityId, where, skip = [] }) {
  let recipients;
  if (everyone) {
    recipients = (await db.all(`SELECT id FROM ${SCHEMA}.users WHERE id <> $1`, [author.id])).map((r) => r.id);
  } else {
    recipients = [...ids];
  }
  recipients = recipients.filter((id) => id !== author.id && !skip.includes(id));
  if (!recipients.length) return;
  const msg = everyone
    ? `${author.display_name} a écrit à tout le monde ${where}.`
    : `${author.display_name} vous a cité ${where}.`;
  await notifications.notifier(recipients, 'comment_replies', entityType, entityId, msg).catch(() => {});
}

// Utilisateurs dont le nom ou l'identifiant contient `q` (saisie semi-automatique).
async function search(q) {
  const term = String(q || '').trim().slice(0, 40).replace(/[\\%_]/g, (c) => `\\${c}`);
  return db.all(
    `SELECT id, display_name, direction, (extract(epoch FROM avatar_updated_at) * 1000)::bigint AS avatar_v
       FROM ${SCHEMA}.users
      WHERE display_name ILIKE $1 OR ad_username ILIKE $1
      ORDER BY (display_name ILIKE $2) DESC, display_name
      LIMIT 8`,
    [`%${term}%`, `${term}%`]
  );
}

module.exports = { extract, toPlain, normalize, notify, search, canTagEveryone };
