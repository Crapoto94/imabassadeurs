const express = require('express');
const { db, SCHEMA } = require('../../pg_db');
const notifications = require('../../services/notifications');
const { requireAuth } = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/errors');

const router = express.Router();
const CATEGORIES = notifications.CATEGORIES;
const FREQUENCIES = ['instant', 'daily', 'weekly', 'never'];

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  res.json({ user: req.user, preferences: await notifications.getPreferences(req.user.id) });
}));

router.put('/preferences', requireAuth, asyncHandler(async (req, res) => {
  const { category, frequency } = req.body || {};
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: 'Catégorie invalide' });
  if (!FREQUENCIES.includes(frequency)) return res.status(400).json({ error: 'Fréquence invalide' });
  await db.run(
    `INSERT INTO ${SCHEMA}.notification_preferences (user_id, category, frequency)
     VALUES ($1,$2,$3)
     ON CONFLICT (user_id, category) DO UPDATE SET frequency = $3`,
    [req.user.id, category, frequency]
  );
  res.json(await notifications.getPreferences(req.user.id));
}));

module.exports = router;
