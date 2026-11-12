const express = require('express');
const service = require('./mentions.service');
const { requireAuth } = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/errors');

const router = express.Router();

// GET /api/v1/mentions/search?q= — personnes que l'on peut citer avec « @ ».
router.get('/search', requireAuth, asyncHandler(async (req, res) => res.json(await service.search(req.query.q))));

module.exports = router;
