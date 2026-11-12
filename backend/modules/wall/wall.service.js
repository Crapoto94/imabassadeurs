const { db, SCHEMA } = require('../../pg_db');
const { ApiError } = require('../../utils/errors');
const { logAction } = require('../../utils/audit');
const notifications = require('../../services/notifications');
const mentions = require('../mentions/mentions.service');

const MAX_BODY = 2000;
// Réactions rapides proposées (liste fermée : pas de texte libre dans la colonne emoji).
const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '👏', '🤔', '🙏', '🔥', '💡', '👀'];

const canModerate = (u) => u.roles.includes('admin') || u.roles.includes('ianimateur');
const clean = (v) => String(v ?? '').replace(/\r\n/g, '\n').trim();

// Messages visibles (avec auteur, citation et réactions agrégées), du plus récent au plus ancien.
async function fetchPosts(user, where, args, limit = 1) {
  const rows = await db.all(
    `SELECT p.id, p.body, p.created_at, p.edited_at, p.author_id, u.display_name AS author_name,
            (extract(epoch FROM u.avatar_updated_at) * 1000)::bigint AS author_avatar_v,
            q.id AS q_id, q.body AS q_body, q.deleted_at AS q_deleted, qu.display_name AS q_author
       FROM ${SCHEMA}.wall_posts p
       LEFT JOIN ${SCHEMA}.users u ON u.id = p.author_id
       LEFT JOIN ${SCHEMA}.wall_posts q ON q.id = p.quote_id
       LEFT JOIN ${SCHEMA}.users qu ON qu.id = q.author_id
      WHERE p.deleted_at IS NULL ${where}
      ORDER BY p.id DESC
      LIMIT ${Number(limit)}`,
    args
  );
  const ids = rows.map((r) => r.id);
  const reacts = ids.length ? await db.all(
    `SELECT r.post_id, r.emoji, u.id AS user_id, u.display_name
       FROM ${SCHEMA}.wall_reactions r JOIN ${SCHEMA}.users u ON u.id = r.user_id
      WHERE r.post_id = ANY($1::int[]) ORDER BY r.created_at`,
    [ids]
  ) : [];
  return rows.map((r) => {
    const mine = reacts.filter((x) => x.post_id === r.id);
    const byEmoji = new Map();
    for (const x of mine) {
      const e = byEmoji.get(x.emoji) || { emoji: x.emoji, count: 0, mine: false, names: [] };
      e.count += 1;
      e.mine = e.mine || x.user_id === user.id;
      if (e.names.length < 8) e.names.push(x.display_name);
      byEmoji.set(x.emoji, e);
    }
    const quoted = r.q_id
      ? { id: r.q_id, author_name: r.q_author, deleted: !!r.q_deleted, excerpt: r.q_deleted ? '' : mentions.toPlain(r.q_body).slice(0, 200) }
      : null;
    return {
      id: r.id, body: r.body, created_at: r.created_at, edited_at: r.edited_at,
      author_id: r.author_id, author_name: r.author_name, author_avatar_v: r.author_avatar_v,
      quote: quoted, reactions: [...byEmoji.values()],
    };
  });
}

async function list(user, { before, limit }) {
  const n = Math.min(Math.max(limit, 1), 100);
  const args = [];
  let where = '';
  if (before) { args.push(before); where = `AND p.id < $${args.length}`; }
  // On lit n+1 lignes pour savoir s'il en reste.
  const rows = await fetchPosts(user, where, args, n + 1);
  return { items: rows.slice(0, n), has_more: rows.length > n, reactions: REACTIONS };
}

async function create(user, body) {
  const m = await mentions.normalize(user, clean(body.body));
  const text = m.body;
  if (!text) throw new ApiError(400, 'Message vide');
  if (mentions.toPlain(text).length > MAX_BODY) throw new ApiError(400, `Le message ne doit pas dépasser ${MAX_BODY} caractères`);
  let quote = null;
  if (body.quote_id) {
    quote = await db.get(`SELECT id, author_id FROM ${SCHEMA}.wall_posts WHERE id = $1 AND deleted_at IS NULL`, [parseInt(body.quote_id, 10)]);
    if (!quote) throw new ApiError(400, 'Le message cité n’existe plus');
  }
  const row = await db.get(
    `INSERT INTO ${SCHEMA}.wall_posts (author_id, body, quote_id) VALUES ($1,$2,$3) RETURNING id`,
    [user.id, text, quote?.id || null]
  );
  if (quote?.author_id && quote.author_id !== user.id) {
    await notifications.notifier([quote.author_id], 'comment_replies', 'wall', row.id,
      `${user.display_name} a cité votre message sur le Mur de l'IA.`).catch(() => {});
  }
  await mentions.notify({
    author: user, ids: m.ids, everyone: m.everyone, entityType: 'wall', entityId: row.id,
    where: "sur le Mur de l'IA", skip: quote?.author_id ? [quote.author_id] : [],
  });
  return (await fetchPosts(user, 'AND p.id = $1', [row.id]))[0];
}

async function ownPost(user, id) {
  const post = await db.get(`SELECT id, author_id FROM ${SCHEMA}.wall_posts WHERE id = $1 AND deleted_at IS NULL`, [id]);
  if (!post) throw new ApiError(404, 'Message introuvable');
  return post;
}

async function update(user, id, body) {
  const post = await ownPost(user, id);
  if (post.author_id !== user.id) throw new ApiError(403, 'Seul l’auteur peut modifier son message');
  const m = await mentions.normalize(user, clean(body.body));
  const text = m.body;
  if (!text) throw new ApiError(400, 'Message vide');
  if (mentions.toPlain(text).length > MAX_BODY) throw new ApiError(400, `Le message ne doit pas dépasser ${MAX_BODY} caractères`);
  const before = mentions.extract((await db.get(`SELECT body FROM ${SCHEMA}.wall_posts WHERE id = $1`, [id])).body);
  await db.run(`UPDATE ${SCHEMA}.wall_posts SET body = $2, edited_at = now() WHERE id = $1`, [id, text]);
  // Seules les personnes nouvellement citées sont prévenues.
  await mentions.notify({
    author: user, ids: new Set([...m.ids].filter((x) => !before.ids.has(x))), everyone: m.everyone && !before.everyone,
    entityType: 'wall', entityId: id, where: "sur le Mur de l'IA",
  });
  return (await fetchPosts(user, 'AND p.id = $1', [id]))[0];
}

async function remove(user, id) {
  const post = await ownPost(user, id);
  if (post.author_id !== user.id && !canModerate(user)) throw new ApiError(403, 'Droits insuffisants');
  await db.run(`UPDATE ${SCHEMA}.wall_posts SET deleted_at = now(), body = '' WHERE id = $1`, [id]);
  if (post.author_id !== user.id) await logAction(user.id, 'wall.moderate_delete', 'wall', id, { author_id: post.author_id });
  return { id, deleted: true };
}

async function toggleReaction(user, id, emoji) {
  if (!REACTIONS.includes(emoji)) throw new ApiError(400, 'Réaction non proposée');
  await ownPost(user, id);
  const del = await db.get(
    `DELETE FROM ${SCHEMA}.wall_reactions WHERE post_id = $1 AND user_id = $2 AND emoji = $3 RETURNING 1 AS ok`,
    [id, user.id, emoji]
  );
  if (!del) {
    await db.run(`INSERT INTO ${SCHEMA}.wall_reactions (post_id, user_id, emoji) VALUES ($1,$2,$3)`, [id, user.id, emoji]);
  }
  return (await fetchPosts(user, 'AND p.id = $1', [id]))[0];
}

module.exports = { list, create, update, remove, toggleReaction };
