const { db, SCHEMA } = require('../pg_db');

// Les commentaires, liens d'idées et appartenances de cluster sont polymorphes
// (entity_type + entity_id, sans clé étrangère) : il faut les nettoyer
// explicitement lors de la suppression d'un contenu.
async function supprimerReferences(entityType, entityId) {
  await db.run(
    `DELETE FROM ${SCHEMA}.comments WHERE entity_type=$1 AND entity_id=$2`,
    [entityType, entityId]
  );
  await db.run(
    `DELETE FROM ${SCHEMA}.idea_links
      WHERE (source_type=$1 AND source_id=$2) OR (target_type=$1 AND target_id=$2)`,
    [entityType, entityId]
  );
  await db.run(
    `DELETE FROM ${SCHEMA}.idea_cluster_items WHERE entity_type=$1 AND entity_id=$2`,
    [entityType, entityId]
  );
}

module.exports = { supprimerReferences };
