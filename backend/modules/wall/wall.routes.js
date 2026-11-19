const express = require('express');
const service = require('./wall.service');
const { requireAuth } = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/errors');

const router = express.Router();
const id = (v) => parseInt(v, 10);

// Tout utilisateur connecté peut lire et s'exprimer ; la modération revient aux admins et IAnimateurs.
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  res.json(await service.list(req.user, { before: id(req.query.before) || null, limit: id(req.query.limit) || 30 }));
}));

router.post('/', requireAuth, asyncHandler(async (req, res) => {
  res.status(201).json(await service.create(req.user, req.body || {}));
}));

router.put('/:id', requireAuth, asyncHandler(async (req, res) => {
  res.json(await service.update(req.user, id(req.params.id), req.body || {}));
}));

router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  res.json(await service.remove(req.user, id(req.params.id)));
}));

// Commentaires imbriqués sous un message (et non de nouveaux messages).
router.post('/:id/comments', requireAuth, asyncHandler(async (req, res) => {
  res.json(await service.createComment(req.user, id(req.params.id), req.body || {}));
}));

router.put('/comments/:id', requireAuth, asyncHandler(async (req, res) => {
  res.json(await service.updateComment(req.user, id(req.params.id), req.body || {}));
}));

router.delete('/comments/:id', requireAuth, asyncHandler(async (req, res) => {
  res.json(await service.removeComment(req.user, id(req.params.id)));
}));

// Bascule d'une réaction (ajoute, ou retire si déjà posée).
router.post('/:id/reactions', requireAuth, asyncHandler(async (req, res) => {
  res.json(await service.toggleReaction(req.user, id(req.params.id), req.body?.emoji));
}));

module.exports = router;
