const { db, SCHEMA } = require('../../pg_db');
const { logAction } = require('../../utils/audit');

async function optionsWithCounts(sessionId) {
  return db.all(
    `SELECT o.id, o.label, o.proposed_by, us.display_name AS proposed_by_name,
            (SELECT count(*)::int FROM ${SCHEMA}.vote_responses v WHERE v.option_id = o.id) AS votes
       FROM ${SCHEMA}.vote_options o
       LEFT JOIN ${SCHEMA}.users us ON us.id = o.proposed_by
      WHERE o.session_id = $1
      ORDER BY votes DESC, o.id ASC`,
    [sessionId]
  );
}

async function listSessions(user, query) {
  const where = query.status ? 'WHERE s.status = $1' : '';
  const params = query.status ? [query.status] : [];
  const sessions = await db.all(
    `SELECT s.*, u.display_name AS created_by_name,
            (SELECT count(*)::int FROM ${SCHEMA}.vote_responses v WHERE v.session_id = s.id) AS total_votes
       FROM ${SCHEMA}.vote_sessions s JOIN ${SCHEMA}.users u ON u.id = s.created_by
       ${where} ORDER BY s.opens_at DESC`,
    params
  );
  for (const s of sessions) {
    s.options = await optionsWithCounts(s.id);
    const mine = await db.get(
      `SELECT option_id FROM ${SCHEMA}.vote_responses WHERE session_id=$1 AND user_id=$2`,
      [s.id, user.id]
    );
    s.my_option_id = mine?.option_id || null;
  }
  return sessions;
}

async function getSession(id, user) {
  const s = await db.get(
    `SELECT s.*, u.display_name AS created_by_name FROM ${SCHEMA}.vote_sessions s
       JOIN ${SCHEMA}.users u ON u.id = s.created_by WHERE s.id = $1`,
    [id]
  );
  if (!s) throw Object.assign(new Error('Session de vote introuvable'), { status: 404 });
  s.options = await optionsWithCounts(id);
  const mine = await db.get(
    `SELECT option_id FROM ${SCHEMA}.vote_responses WHERE session_id=$1 AND user_id=$2`,
    [id, user.id]
  );
  s.my_option_id = mine?.option_id || null;
  return s;
}

async function create(user, data) {
  if (!(user.roles.includes('ianimateur') || user.roles.includes('admin'))) {
    throw Object.assign(new Error('Réservé aux IAnimateurs'), { status: 403 });
  }
  const { question, mode, allow_write_in, options, closes_at } = data;
  if (!question) throw Object.assign(new Error('Question requise'), { status: 400 });
  if (!['closed', 'open'].includes(mode)) throw Object.assign(new Error('Mode invalide'), { status: 400 });
  if (mode === 'closed' && !(Array.isArray(options) && options.length >= 2)) {
    throw Object.assign(new Error('Au moins deux options sont requises en mode fermé'), { status: 400 });
  }
  const s = await db.get(
    `INSERT INTO ${SCHEMA}.vote_sessions (question, mode, allow_write_in, created_by, closes_at)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [question, mode, !!allow_write_in, user.id, closes_at || null]
  );
  if (mode === 'closed') {
    for (const label of options) {
      if (label && String(label).trim()) {
        await db.run(
          `INSERT INTO ${SCHEMA}.vote_options (session_id, label, proposed_by) VALUES ($1,$2,NULL)`,
          [s.id, String(label).trim()]
        );
      }
    }
  }
  await logAction(user.id, 'vote_create', 'vote_session', s.id, { mode });
  return s.id;
}

async function addOption(user, sessionId, label) {
  if (!label || !String(label).trim()) throw Object.assign(new Error('Libellé requis'), { status: 400 });
  const s = await db.get(`SELECT mode, status, allow_write_in FROM ${SCHEMA}.vote_sessions WHERE id=$1`, [sessionId]);
  if (!s) throw Object.assign(new Error('Session introuvable'), { status: 404 });
  if (s.status !== 'open') throw Object.assign(new Error('Session close'), { status: 400 });
  const allowed = s.mode === 'open' || (s.mode === 'closed' && s.allow_write_in);
  if (!allowed) throw Object.assign(new Error('Ajout d’option non autorisé pour cette session'), { status: 403 });
  const row = await db.get(
    `INSERT INTO ${SCHEMA}.vote_options (session_id, label, proposed_by) VALUES ($1,$2,$3) RETURNING id`,
    [sessionId, String(label).trim(), user.id]
  );
  return { id: row.id };
}

async function vote(user, sessionId, optionId) {
  const s = await db.get(`SELECT status FROM ${SCHEMA}.vote_sessions WHERE id=$1`, [sessionId]);
  if (!s) throw Object.assign(new Error('Session introuvable'), { status: 404 });
  if (s.status !== 'open') throw Object.assign(new Error('Session close'), { status: 400 });
  const opt = await db.get(`SELECT id FROM ${SCHEMA}.vote_options WHERE id=$1 AND session_id=$2`, [optionId, sessionId]);
  if (!opt) throw Object.assign(new Error('Option invalide'), { status: 400 });
  await db.run(
    `INSERT INTO ${SCHEMA}.vote_responses (session_id, user_id, option_id) VALUES ($1,$2,$3)
     ON CONFLICT (session_id, user_id) DO UPDATE SET option_id = $3, created_at = now()`,
    [sessionId, user.id, optionId]
  );
  return { session_id: sessionId, option_id: optionId };
}

async function close(user, sessionId) {
  if (!(user.roles.includes('ianimateur') || user.roles.includes('admin'))) {
    throw Object.assign(new Error('Réservé aux IAnimateurs'), { status: 403 });
  }
  await db.run(`UPDATE ${SCHEMA}.vote_sessions SET status='closed' WHERE id=$1`, [sessionId]);
  await logAction(user.id, 'vote_close', 'vote_session', sessionId, null);
  return { id: sessionId, status: 'closed' };
}

async function votesText() {
  const rows = await db.all(
    `SELECT s.question, o.label, count(v.user_id)::int AS voix
       FROM ${SCHEMA}.vote_sessions s
       JOIN ${SCHEMA}.vote_options o ON o.session_id = s.id
       LEFT JOIN ${SCHEMA}.vote_responses v ON v.option_id = o.id
      GROUP BY s.id, s.question, o.id, o.label
      ORDER BY s.id DESC`
  );
  return rows.map((r) => `${r.question} — ${r.label} : ${r.voix} voix`).join('\n');
}

module.exports = { listSessions, getSession, create, addOption, vote, close, votesText };
