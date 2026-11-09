const express = require('express');
const { db, SCHEMA } = require('../../pg_db');
const { requireAuth } = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/errors');

const router = express.Router();

// Annuaire : agents ayant un rôle nommé (IAmbassadeur, IA.Éclaireur, IAnimateur).
// Aucune donnée sensible : ni e-mail ni identifiant AD.
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const rows = await db.all(
    `SELECT u.id, u.display_name, u.direction, u.service, u.bio,
            (extract(epoch FROM u.avatar_updated_at) * 1000)::bigint AS avatar_v,
            array_agg(r.role ORDER BY r.role) AS roles
       FROM ${SCHEMA}.users u
       JOIN ${SCHEMA}.user_roles r ON r.user_id = u.id
      WHERE r.role IN ('iambassadeur', 'iaeclaireur', 'ianimateur')
      GROUP BY u.id
      ORDER BY lower(u.display_name)`
  );
  res.json(rows);
}));

module.exports = router;
