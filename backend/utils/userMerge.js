// Réaffectation de toutes les références d'un utilisateur vers un autre.
// Utilisé par scripts/merge-duplicate-users.js (fusion des doublons) et par
// la suppression d'un compte depuis le module Admin.
const { SCHEMA } = require('../pg_db');

// Colonnes référençant users(id), sans clé d'unicité liée à l'utilisateur.
const SIMPLE_REFS = [
  ['comments', 'author_id'],
  ['resources', 'proposed_by'],
  ['resources', 'reviewed_by'],
  ['experiments', 'created_by'],
  ['risks', 'proposed_by'],
  ['risk_amendments', 'amended_by'],
  ['vote_sessions', 'created_by'],
  ['vote_options', 'proposed_by'],
  ['charter_principles', 'created_by'],
  ['idea_links', 'created_by'],
  ['ai_prompts', 'updated_by'],
  ['audit_log', 'user_id'],
  ['notification_events', 'user_id'],
  ['notification_digests', 'user_id'],
  ['experiment_attachments', 'uploaded_by'],
  ['user_roles', 'granted_by'],
];

// Tables à clé composite (user_id + clé) : on supprime la ligne du doublon si le
// compte conservé possède déjà la même clé (sinon violation d'unicité à l'UPDATE).
const CONFLICT_REFS = [
  ['user_roles', 'user_id', 'role'],
  ['comment_likes', 'user_id', 'comment_id'],
  ['resource_ratings', 'user_id', 'resource_id'],
  ['experiment_participants', 'user_id', 'experiment_id'],
  ['vote_responses', 'user_id', 'session_id'],
  ['notification_preferences', 'user_id', 'category'],
];

// q : runner async (sql, params) => Promise (ex. client.query ou db.run).
async function reassignAll(q, dup, keep) {
  for (const [table, col] of SIMPLE_REFS) {
    await q(`UPDATE ${SCHEMA}.${table} SET ${col}=$1 WHERE ${col}=$2`, [keep, dup]);
  }
  for (const [table, ucol, key] of CONFLICT_REFS) {
    await q(
      `DELETE FROM ${SCHEMA}.${table} t
         USING ${SCHEMA}.${table} k
        WHERE t.${ucol}=$2 AND k.${ucol}=$1 AND t.${key}=k.${key}`,
      [keep, dup]
    );
    await q(`UPDATE ${SCHEMA}.${table} SET ${ucol}=$1 WHERE ${ucol}=$2`, [keep, dup]);
  }
  // Progression de lecture : on conserve le maximum par ressource.
  await q(
    `UPDATE ${SCHEMA}.resource_progress p
        SET progress_pct = GREATEST(p.progress_pct, d.progress_pct), updated_at = now()
       FROM ${SCHEMA}.resource_progress d
      WHERE p.user_id=$1 AND d.user_id=$2 AND p.resource_id=d.resource_id`,
    [keep, dup]
  );
  await q(
    `DELETE FROM ${SCHEMA}.resource_progress d
      WHERE d.user_id=$2
        AND EXISTS (SELECT 1 FROM ${SCHEMA}.resource_progress p WHERE p.user_id=$1 AND p.resource_id=d.resource_id)`,
    [keep, dup]
  );
  await q(`UPDATE ${SCHEMA}.resource_progress SET user_id=$1 WHERE user_id=$2`, [keep, dup]);
}

module.exports = { reassignAll, SIMPLE_REFS, CONFLICT_REFS };
