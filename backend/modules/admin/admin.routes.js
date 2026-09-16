const express = require('express');
const service = require('./admin.service');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const { asyncHandler, ApiError } = require('../../utils/errors');

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get('/settings', asyncHandler(async (req, res) => res.json(await service.getSettings())));
router.put('/settings', asyncHandler(async (req, res) => res.json(await service.updateSettings(req.user, req.body))));

router.get('/users', asyncHandler(async (req, res) => res.json(await service.listUsers(req.query))));
router.post('/users/:id/roles', asyncHandler(async (req, res) => res.json(await service.grantRole(req.user, parseInt(req.params.id, 10), req.body.role))));
router.delete('/users/:id/roles/:role', asyncHandler(async (req, res) => res.json(await service.revokeRole(req.user, parseInt(req.params.id, 10), req.params.role))));

router.get('/audit', asyncHandler(async (req, res) => res.json(await service.listAudit(req.query))));

router.get('/prompts', asyncHandler(async (req, res) => res.json(await service.listPrompts())));
router.put('/prompts/:actionKey', asyncHandler(async (req, res) => res.json(await service.updatePrompt(req.user, req.params.actionKey, req.body))));
router.post('/prompts/:actionKey/test', asyncHandler(async (req, res) => {
  try {
    res.json(await service.testPrompt(req.user, req.params.actionKey, req.body.variables));
  } catch (err) {
    throw new ApiError(err.response?.status === 503 ? 503 : 502, "Échec du test IA : " + err.message);
  }
}));

router.get('/ai-models', asyncHandler(async (req, res) => {
  try {
    res.json(await service.listAiModels());
  } catch (err) {
    throw new ApiError(502, "Modèles IA indisponibles : " + err.message);
  }
}));

module.exports = router;
