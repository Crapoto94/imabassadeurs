const express = require('express');
const service = require('./analytics.service');
const { requireAuth, requireIanimateur } = require('../../middleware/auth');
const { asyncHandler, ApiError } = require('../../utils/errors');

const router = express.Router();
router.use(requireAuth, requireIanimateur);

router.get('/activity', asyncHandler(async (req, res) => res.json(await service.activityByUser(req.query))));
router.get('/interactions', asyncHandler(async (req, res) => res.json(await service.interactions(req.query))));
router.get('/kpis', asyncHandler(async (req, res) => res.json(await service.kpis())));
router.get('/digest-quality', asyncHandler(async (req, res) => res.json(await service.digestQuality())));
router.get('/consensus', asyncHandler(async (req, res) => {
  try {
    res.json(await service.consensus(req.user));
  } catch (err) {
    throw new ApiError(502, "Échec de l'analyse IA : " + err.message);
  }
}));

module.exports = router;
