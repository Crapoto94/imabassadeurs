const express = require('express');
const ctrl = require('./auth.controller');
const { requireAuth } = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/errors');

const router = express.Router();

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Connexion agent (Active Directory via APM)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { username: {type: string}, password: {type: string} }
 *     responses:
 *       200: { description: JWT applicatif + utilisateur }
 *       401: { description: Identifiants invalides }
 */
router.post('/login', asyncHandler(ctrl.login));

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: Utilisateur courant et ses rôles
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/me', requireAuth, asyncHandler(ctrl.me));

module.exports = router;
