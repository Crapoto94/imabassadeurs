const { db, SCHEMA } = require('../../pg_db');
const notifications = require('../../services/notifications');

const ENTITY_TABLES = {
  resource: { table: 'resources', owner: 'proposed_by', category: 'resources' },
  experiment: { table: 'experiments', owner: 'created_by', category: 'other_experiments' },
  risk: { table: 'risks', owner: 'proposed_by', category: 'risks' },
};

async function entityAuthor(entityType, entityId) {
  const meta = ENTITY_TABLES[entityType];
  if (!meta) return null;
  const row = await db.get(
    `SELECT ${meta.owner} AS owner FROM ${SCHEMA}.${meta.table} WHERE id = $1`,
    [entityId]
  );
  return row?.owner || null;
}

async function list(entityType, entityId, currentUserId) {
  const comments = await db.all(
    `SELECT c.id, c.entity_type, c.entity_id, c.parent_id, c.body, c.created_at, c.edited_at,
            c.author_id, u.display_name AS author_name,
            (SELECT count(*)::int FROM ${SCHEMA}.comment_likes l WHERE l.comment_id = c.id) AS likes,
            EXISTS(SELECT 1 FROM ${SCHEMA}.comment_likes l WHERE l.comment_id = c.id AND l.user_id = $3) AS liked
       FROM ${SCHEMA}.comments c
       JOIN ${SCHEMA}.users u ON u.id = c.author_id
      WHERE c.entity_type = $1 AND c.entity_id = $2
      ORDER BY c.created_at ASC`,
    [entityType, entityId, currentUserId || 0]
  );
  const byId = Object.fromEntries(comments.map((c) => [c.id, { ...c, replies: [] }]));
  const roots = [];
  for (const c of comments) {
    if (c.parent_id && byId[c.parent_id]) byId[c.parent_id].replies.push(byId[c.id]);
    else roots.push(byId[c.id]);
  }
  return roots;
}

async function add(user, entityType, entityId, body, parentId = null) {
  if (!ENTITY_TABLES[entityType]) throw Object.assign(new Error('Type d’entité invalide'), { status: 400 });
  if (!body || !body.trim()) throw Object.assign(new Error('Commentaire vide'), { status: 400 });

  const row = await db.get(
    `INSERT INTO ${SCHEMA}.comments (entity_type, entity_id, parent_id, author_id, body)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [entityType, entityId, parentId || null, user.id, body.trim()]
  );

  const ownerId = await entityAuthor(entityType, entityId);
  const recipients = [];
  if (parentId) {
    const parent = await db.get(`SELECT author_id FROM ${SCHEMA}.comments WHERE id = $1`, [parentId]);
    if (parent?.author_id) recipients.push({ userId: parent.author_id, category: 'comment_replies', msg: `${user.display_name} a répondu à votre commentaire.` });
  }
  if (ownerId && ownerId !== user.id) {
    recipients.push({ userId: ownerId, category: ENTITY_TABLES[entityType].category, msg: `${user.display_name} a commenté votre contenu.` });
  }
  for (const r of recipients) {
    await notifications.notifier([r.userId], r.category, entityType, entityId, r.msg);
  }
  return row.id;
}

async function toggleLike(userId, commentId) {
  const existing = await db.get(
    `SELECT 1 FROM ${SCHEMA}.comment_likes WHERE comment_id = $1 AND user_id = $2`,
    [commentId, userId]
  );
  if (existing) {
    await db.run(`DELETE FROM ${SCHEMA}.comment_likes WHERE comment_id = $1 AND user_id = $2`, [commentId, userId]);
    return { liked: false };
  }
  await db.run(`INSERT INTO ${SCHEMA}.comment_likes (comment_id, user_id) VALUES ($1, $2)`, [commentId, userId]);
  return { liked: true };
}

// Texte du fil, utilisé pour les synthèses IA.
async function threadText(entityType, entityId) {
  const rows = await db.all(
    `SELECT u.display_name AS author, c.body, c.created_at
       FROM ${SCHEMA}.comments c JOIN ${SCHEMA}.users u ON u.id = c.author_id
      WHERE c.entity_type = $1 AND c.entity_id = $2
      ORDER BY c.created_at ASC`,
    [entityType, entityId]
  );
  return rows.map((r) => `${r.author} : ${r.body}`).join('\n');
}

module.exports = { list, add, toggleLike, threadText, entityAuthor };
