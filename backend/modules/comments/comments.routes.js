const express = require('express');
const service = require('./comments.service');
const { requireAuth, requireInteract } = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/errors');

const router = express.Router();

router.get('/:entityType/:entityId', requireAuth, asyncHandler(async (req, res) => {
  const data = await service.list(req.params.entityType, parseInt(req.params.entityId, 10), req.user.id);
  res.json(data);
}));

// IMPORTANT : la route de like doit être déclarée AVANT la route générique
// /:entityType/:entityId, sinon « /12/like » est capté par cette dernière
// (entityType="12", entityId="like") et le like ne fonctionne jamais.
router.post('/:commentId/like', requireAuth, requireInteract, asyncHandler(async (req, res) => {
  res.json(await service.toggleLike(req.user.id, parseInt(req.params.commentId, 10)));
}));

router.post('/:entityType/:entityId', requireAuth, requireInteract, asyncHandler(async (req, res) => {
  const id = await service.add(req.user, req.params.entityType, parseInt(req.params.entityId, 10), req.body.body, req.body.parent_id);
  res.status(201).json({ id });
}));

module.exports = router;
