require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');

const { pool, setupDb, SCHEMA } = require('./pg_db');
const swaggerSpec = require('./swagger');
const apm = require('./services/apm');
const { seedAdmin } = require('./utils/seed');
const scheduler = require('./services/scheduler');

const app = express();
const PORT = process.env.PORT || 5310;

// CORS restreint aux origines connues (CORS_ORIGIN = liste séparée par des virgules).
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5311')
  .split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) return cb(null, true);
    cb(null, false);
  },
  credentials: true,
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Logs serveur structurés (stdout capté par Docker).
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// Fichiers uploadés (PDF de la base documentaire).
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Documentation interactive.
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/swagger.json', (req, res) => res.json(swaggerSpec));

/**
 * @swagger
 * /api/status:
 *   get:
 *     summary: État de l'application et de ses dépendances
 *     tags: [Santé]
 *     security: []
 */
app.get('/api/status', async (req, res) => {
  const result = { app: 'charte-ia', status: 'ok', schema: SCHEMA, dependencies: {} };
  try {
    await pool.query('SELECT 1');
    result.dependencies.database = { ok: true };
  } catch (err) {
    result.dependencies.database = { ok: false, error: err.message };
    result.status = 'degraded';
  }
  const apmStatus = await apm.status();
  result.dependencies.apm = apmStatus;
  if (!apmStatus.ok) result.status = 'degraded';
  res.status(200).json(result);
});

// Routes métier versionnées.
app.use('/api/v1/auth', require('./modules/auth/auth.routes'));
app.use('/api/v1/admin', require('./modules/admin/admin.routes'));
app.use('/api/v1/resources', require('./modules/resources/resources.routes'));
app.use('/api/v1/experiments', require('./modules/experiments/experiments.routes'));
app.use('/api/v1/risks', require('./modules/risks/risks.routes'));
app.use('/api/v1/votes', require('./modules/votes/votes.routes'));
app.use('/api/v1/mapping', require('./modules/mapping/mapping.routes'));
app.use('/api/v1/analytics', require('./modules/analytics/analytics.routes'));
app.use('/api/v1/account', require('./modules/account/account.routes'));
app.use('/api/v1/comments', require('./modules/comments/comments.routes'));
app.use('/api/v1', require('./modules/public/public.routes'));

app.use((req, res) => res.status(404).json({ error: 'Route introuvable' }));

// Gestion d'erreurs normalisée.
app.use((err, req, res, next) => {
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  if (status >= 500) console.error('[ERREUR]', err);
  res.status(status).json({ error: err.message || 'Erreur serveur' });
});

async function start() {
  try {
    await setupDb();
    await seedAdmin();
    scheduler.start();
    app.listen(PORT, () => console.log(`[APP] IAmbassadeurs backend démarré sur le port ${PORT}`));
  } catch (err) {
    console.error('[APP] Démarrage impossible :', err.message);
    process.exit(1);
  }
}

start();

module.exports = app;
