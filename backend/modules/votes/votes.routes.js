const express = require('express');
const service = require('./votes.service');
const { requireAuth, requireInteract, requireIanimateur } = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/errors');

const router = express.Router();

router.get('/', requireAuth, asyncHandler(async (req, res) => res.json(await service.listSessions(req.user, req.query))));
router.get('/:id', requireAuth, asyncHandler(async (req, res) => res.json(await service.getSession(parseInt(req.params.id, 10), req.user))));
router.post('/', requireAuth, requireIanimateur, asyncHandler(async (req, res) => {
  res.status(201).json({ id: await service.create(req.user, req.body) });
}));
router.post('/:id/options', requireAuth, requireInteract, asyncHandler(async (req, res) => {
  res.status(201).json(await service.addOption(req.user, parseInt(req.params.id, 10), req.body.label));
}));
router.post('/:id/vote', requireAuth, requireInteract, asyncHandler(async (req, res) => {
  res.json(await service.vote(req.user, parseInt(req.params.id, 10), parseInt(req.body.option_id, 10)));
}));
router.post('/:id/close', requireAuth, requireIanimateur, asyncHandler(async (req, res) => {
  res.json(await service.close(req.user, parseInt(req.params.id, 10)));
}));

module.exports = router;
