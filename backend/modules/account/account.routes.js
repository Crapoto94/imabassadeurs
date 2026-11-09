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

// --- Avatar : image JPEG/PNG/WebP réduite côté client (≤ 200 Ko), servie derrière l'auth. ---
const MAX_AVATAR_BYTES = 200 * 1024;
const MIMES = { 'image/jpeg': [0xff, 0xd8, 0xff], 'image/png': [0x89, 0x50, 0x4e, 0x47], 'image/webp': [0x52, 0x49, 0x46, 0x46] };

router.put('/avatar', requireAuth, asyncHandler(async (req, res) => {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(req.body?.image || '');
  if (!m) return res.status(400).json({ error: 'Image invalide (JPEG, PNG ou WebP)' });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length === 0 || buf.length > MAX_AVATAR_BYTES) return res.status(400).json({ error: 'Image trop volumineuse (200 Ko max)' });
  if (!MIMES[m[1]].every((b, i) => buf[i] === b)) return res.status(400).json({ error: "Le contenu ne correspond pas au type d'image" });
  const row = await db.get(
    `UPDATE ${SCHEMA}.users SET avatar = $1, avatar_mime = $2, avatar_updated_at = now()
      WHERE id = $3 RETURNING (extract(epoch FROM avatar_updated_at) * 1000)::bigint AS avatar_v`,
    [buf, m[1], req.user.id]
  );
  res.json({ avatar_v: row.avatar_v });
}));

router.delete('/avatar', requireAuth, asyncHandler(async (req, res) => {
  await db.run(`UPDATE ${SCHEMA}.users SET avatar = NULL, avatar_mime = NULL, avatar_updated_at = NULL WHERE id = $1`, [req.user.id]);
  res.json({ avatar_v: null });
}));

router.get('/avatar/:id', requireAuth, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const row = Number.isInteger(id) ? await db.get(`SELECT avatar, avatar_mime FROM ${SCHEMA}.users WHERE id = $1`, [id]) : null;
  if (!row || !row.avatar) return res.status(404).json({ error: 'Pas de photo' });
  res.set({ 'Content-Type': row.avatar_mime, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, max-age=86400' });
  res.send(row.avatar);
}));

module.exports = router;
