const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Tous les identifiants proviennent du .env — aucune valeur en dur.
const SCHEMA = process.env.POSTGRES_SCHEMA || 'charte_ia';

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB || 'ivry_admin',
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT || 5432,
  // Fuseau Ville : appliqué dès l'ouverture de la connexion (paramètre de démarrage).
  options: '-c timezone=Europe/Paris',
});

// Wrapper pratique (placeholders $1, $2…)
const db = {
  all: (sql, p = []) => pool.query(sql, p).then((r) => r.rows),
  get: (sql, p = []) => pool.query(sql, p).then((r) => r.rows[0]),
  run: (sql, p = []) => pool.query(sql, p).then((r) => ({ changes: r.rowCount, rows: r.rows })),
  query: (sql, p = []) => pool.query(sql, p),
};

// Runner de migrations versionnées (dossier migrations/, fichiers triés).
async function runMigrations(client) {
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA};`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${SCHEMA}.schema_migrations (
      filename   VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const { rows } = await client.query(`SELECT filename FROM ${SCHEMA}.schema_migrations`);
  const applied = new Set(rows.map((r) => r.filename));
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        `INSERT INTO ${SCHEMA}.schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING`,
        [file]
      );
      await client.query('COMMIT');
      console.log(`[DB] Migration ${file} appliquée`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${file} échouée : ${err.message}`);
    }
  }
}

async function setupDb() {
  const client = await pool.connect();
  try {
    await runMigrations(client);
    console.log(`[DB] Schéma ${SCHEMA} initialisé`);
  } finally {
    client.release();
  }
}

module.exports = { pool, db, setupDb, SCHEMA };
