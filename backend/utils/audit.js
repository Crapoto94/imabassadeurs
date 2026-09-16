const { pool, SCHEMA } = require('../pg_db');

// Journal d'audit — best effort, ne doit jamais faire échouer la requête métier.
async function logAction(userId, action, entityType = null, entityId = null, details = null) {
  try {
    await pool.query(
      `INSERT INTO ${SCHEMA}.audit_log (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId || null, action, entityType, entityId, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    console.error('[AUDIT] échec écriture journal :', err.message);
  }
}

module.exports = { logAction };
