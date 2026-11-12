const express = require('express');
const service = require('./badges.service');
const { requireAuth } = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/errors');

const router = express.Router();
router.use(requireAuth);

// GET /api/v1/badges — nombre de nouveautés par rubrique pour l'utilisateur connecté.
router.get('/', asyncHandler(async (req, res) => res.json(await service.get(req.user))));

// POST /api/v1/badges/:section/seen — marque la rubrique comme vue.
router.post('/:section/seen', asyncHandler(async (req, res) => res.json(await service.markSeen(req.user, req.params.section))));

module.exports = router;
