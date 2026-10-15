const express = require('express');
const service = require('./themes.service');
const { requireAuth, requireIanimateur } = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/errors');

const router = express.Router();
const id = (v) => parseInt(v, 10);

// GET /api/v1/themes?scope=resource|experiment|risk&all=true (admin/IAnimateur)
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const isMod = req.user.roles.includes('admin') || req.user.roles.includes('ianimateur');
  const includeInactive = req.query.all === 'true' && isMod;
  res.json(await service.list(req.query.scope, includeInactive));
}));

router.post('/', requireAuth, requireIanimateur, asyncHandler(async (req, res) => {
  res.status(201).json({ id: await service.create(req.user, req.body) });
}));

router.put('/:id', requireAuth, requireIanimateur, asyncHandler(async (req, res) => {
  res.json(await service.update(req.user, id(req.params.id), req.body));
}));

router.delete('/:id', requireAuth, requireIanimateur, asyncHandler(async (req, res) => {
  res.json(await service.remove(req.user, id(req.params.id)));
}));

module.exports = router;
