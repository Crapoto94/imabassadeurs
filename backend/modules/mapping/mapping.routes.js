const express = require('express');
const service = require('./mapping.service');
const { requireAuth, requireInteract, requireIanimateur } = require('../../middleware/auth');
const { asyncHandler, ApiError } = require('../../utils/errors');

const router = express.Router();
const id = (v) => parseInt(v, 10);

router.get('/graph', requireAuth, asyncHandler(async (req, res) => res.json(await service.graph())));
router.get('/stats', requireAuth, asyncHandler(async (req, res) => res.json(await service.stats())));

router.get('/principles', requireAuth, asyncHandler(async (req, res) => res.json(await service.listPrinciples(req.user))));
router.post('/principles', requireAuth, requireInteract, asyncHandler(async (req, res) => {
  res.status(201).json(await service.createPrinciple(req.user, req.body));
}));
router.patch('/principles/:id/status', requireAuth, requireIanimateur, asyncHandler(async (req, res) => {
  res.json(await service.setPrincipleStatus(req.user, id(req.params.id), req.body.status));
}));

router.post('/links', requireAuth, requireInteract, asyncHandler(async (req, res) => {
  res.status(201).json(await service.createLink(req.user, req.body));
}));
router.delete('/links/:id', requireAuth, requireInteract, asyncHandler(async (req, res) => {
  res.json(await service.deleteLink(req.user, id(req.params.id)));
}));

router.post('/clusters/generate', requireAuth, requireIanimateur, asyncHandler(async (req, res) => {
  try {
    res.json(await service.generateClusters(req.user));
  } catch (err) {
    throw new ApiError(err.status || 502, "Échec de l'analyse IA : " + err.message);
  }
}));

router.get('/consensus', requireAuth, requireInteract, asyncHandler(async (req, res) => {
  try {
    res.json(await service.analyseConsensus(req.user));
  } catch (err) {
    throw new ApiError(err.status || 502, "Échec de l'analyse IA : " + err.message);
  }
}));

module.exports = router;
