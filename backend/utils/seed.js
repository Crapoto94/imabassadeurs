const bcrypt = require('bcryptjs');
const { db, SCHEMA } = require('../pg_db');

// Compte de secours local (dev, ou production avec LOCAL_LOGIN_ENABLED=true).
// Le mot de passe est aligné sur SEED_ADMIN_PASSWORD à chaque démarrage, ce qui
// permet de le faire tourner via le .env sans toucher à la base.
async function seedAdmin() {
  const username = (process.env.SEED_ADMIN_USERNAME || '').trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!username || !password) return;

  const hash = await bcrypt.hash(password, 10);
  let user = await db.get(`SELECT id FROM ${SCHEMA}.users WHERE ad_username=$1`, [username]);
  if (!user) {
    user = await db.get(
      `INSERT INTO ${SCHEMA}.users (ad_username, display_name, email, password_hash)
       VALUES ($1,$1,$2,$3) RETURNING id`,
      [username, `${username}@ivry94.fr`, hash]
    );
  } else {
    await db.run(`UPDATE ${SCHEMA}.users SET password_hash=$2 WHERE id=$1`, [user.id, hash]);
  }
  await db.run(
    `INSERT INTO ${SCHEMA}.user_roles (user_id, role) VALUES ($1,'admin') ON CONFLICT DO NOTHING`,
    [user.id]
  );
  console.log(`[SEED] Compte de secours « ${username} » prêt`);
}

module.exports = { seedAdmin };
