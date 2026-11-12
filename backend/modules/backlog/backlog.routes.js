const express = require('express');
const service = require('./backlog.service');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/errors');

const router = express.Router();

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
