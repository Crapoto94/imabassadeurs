const express = require('express');
const service = require('./experiments.service');
const { requireAuth, requireInteract } = require('../../middleware/auth');
const { asyncHandler, ApiError } = require('../../utils/errors');

const router = express.Router();

router.get('/', requireAuth, asyncHandler(async (req, res) => res.json(await service.list(req.user, req.query))));
router.get('/:id', requireAuth, asyncHandler(async (req, res) => res.json(await service.getById(parseInt(req.params.id, 10), req.user))));
router.post('/', requireAuth, requireInteract, asyncHandler(async (req, res) => {
  res.status(201).json({ id: await service.create(req.user, req.body) });
}));
router.put('/:id', requireAuth, requireInteract, asyncHandler(async (req, res) => {
  res.json(await service.update(req.user, parseInt(req.params.id, 10), req.body));
}));
router.delete('/:id', requireAuth, requireInteract, asyncHandler(async (req, res) => {
  res.json(await service.remove(req.user, parseInt(req.params.id, 10)));
}));
router.patch('/:id/status', requireAuth, requireInteract, asyncHandler(async (req, res) => {
  res.json(await service.updateStatus(req.user, parseInt(req.params.id, 10), req.body.status));
}));
router.post('/:id/join', requireAuth, requireInteract, asyncHandler(async (req, res) => {
  res.json(await service.toggleJoin(req.user, parseInt(req.params.id, 10)));
}));
router.post('/:id/synthesize', requireAuth, requireInteract, asyncHandler(async (req, res) => {
  try {
    res.json(await service.synthesize(req.user, parseInt(req.params.id, 10)));
  } catch (err) {
    throw new ApiError(502, "Échec de la synthèse IA : " + err.message);
  }
}));

module.exports = router;
