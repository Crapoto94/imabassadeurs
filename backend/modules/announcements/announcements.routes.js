const express = require('express');
const service = require('./announcements.service');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/errors');

const router = express.Router();
const id = (v) => parseInt(v, 10);

// GET /api/v1/announcements/active — annonces à afficher maintenant, hors celles masquées par l'utilisateur.
router.get('/active', requireAuth, asyncHandler(async (req, res) => {
  res.json(await service.active(req.user.id));
}));

// POST /api/v1/announcements/:id/dismiss — « ne plus afficher ce message ».
router.post('/:id/dismiss', requireAuth, asyncHandler(async (req, res) => {
  res.json(await service.dismiss(req.user.id, id(req.params.id)));
}));

// Gestion (admin).
router.get('/', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  res.json(await service.list());
}));
router.post('/', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  res.status(201).json(await service.create(req.user, req.body || {}));
}));
router.put('/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  res.json(await service.update(req.user, id(req.params.id), req.body || {}));
}));
router.delete('/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  res.json(await service.remove(req.user, id(req.params.id)));
}));

module.exports = router;
