const express = require('express');
const service = require('./gamification.service');
const { requireAuth } = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/errors');

const router = express.Router();
router.use(requireAuth);

// Synthèse personnelle de progression (points, niveau, badges).
router.get('/me', asyncHandler(async (req, res) => res.json(await service.summaryFor(req.user.id))));

module.exports = router;
