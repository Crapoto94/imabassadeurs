const express = require('express');
const service = require('./backlog.service');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/errors');

const router = express.Router();

// Export lu par le DSI Hub (transport HTTP, bases séparées) : en-tête X-API-Key = BACKLOG_EXPORT_KEY. Désactivé (404) tant que la clé n'est pas renseignée.
function cleExportOk(req, res) {
  const attendu = process.env.BACKLOG_EXPORT_KEY || '';
  if (!attendu) { res.status(404).json({ error: 'Route inconnue' }); return false; }
  const a = Buffer.from(String(req.headers['x-api-key'] || '')); const b = Buffer.from(attendu);
  if (a.length !== b.length || !require('crypto').timingSafeEqual(a, b)) { res.status(401).json({ error: 'Clé invalide' }); return false; }
  return true;
}

// GET /api/v1/backlog/export — clé d'export, pas de session (lu par le DSI Hub).
router.get('/export', asyncHandler(async (req, res) => {
  if (!cleExportOk(req, res)) return;
  res.json({ items: await service.exportContrat() });
}));

// POST /api/v1/backlog — tout utilisateur connecté déclare un bug ou propose une idée.
router.post('/', requireAuth, asyncHandler(async (req, res) => {
  res.status(201).json(await service.create(req.user, req.body || {}));
}));

// GET /api/v1/backlog/mine — mes demandes et leur état.
router.get('/mine', requireAuth, asyncHandler(async (req, res) => {
  res.json(await service.list({ authorId: req.user.id }));
}));

// GET /api/v1/backlog?status= — toutes les demandes (admin).
router.get('/', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  res.json(await service.list({ status: req.query.status }));
}));

// PUT /api/v1/backlog/:id — change l'état (acceptée, refusée avec motif, réalisée).
router.put('/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  res.json(await service.setStatus(req.user, parseInt(req.params.id, 10), req.body || {}));
}));

// DELETE /api/v1/backlog/:id — suppression (admin).
router.delete('/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  res.json(await service.remove(req.user, parseInt(req.params.id, 10)));
}));

module.exports = router;
