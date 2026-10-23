/* eslint-disable no-console */
// Fusionne les comptes users en doublon (même ad_username, casse différente).
// Usage :
//   node scripts/merge-duplicate-users.js            (dry-run : n'écrit rien)
//   node scripts/merge-duplicate-users.js --apply     (fusionne puis crée l'index)
//
// Choix du compte conservé : celui qui a des rôles, puis le plus de contributions,
// puis le plus ancien. Les contributions/roles de l'autre compte sont réaffectés.
require('dotenv').config();
const { pool, SCHEMA } = require('../pg_db');
const { reassignAll } = require('../utils/userMerge');

const APPLY = process.argv.includes('--apply');

async function score(client, id) {
  const { rows } = await client.query(
    `SELECT
       (SELECT count(*)::int FROM ${SCHEMA}.user_roles WHERE user_id=$1) AS roles,
       ((SELECT count(*) FROM ${SCHEMA}.resources WHERE proposed_by=$1)
      + (SELECT count(*) FROM ${SCHEMA}.experiments WHERE created_by=$1)
      + (SELECT count(*) FROM ${SCHEMA}.risks WHERE proposed_by=$1)
      + (SELECT count(*) FROM ${SCHEMA}.comments WHERE author_id=$1)
      + (SELECT count(*) FROM ${SCHEMA}.vote_responses WHERE user_id=$1))::int AS contributions`,
    [id]
  );
  return rows[0];
}

async function main() {
  const client = await pool.connect();
  try {
    const { rows: groups } = await client.query(
      `SELECT lower(ad_username) AS key, array_agg(id ORDER BY id) AS ids
         FROM ${SCHEMA}.users
        GROUP BY lower(ad_username)
       HAVING count(*) > 1
        ORDER BY 1`
    );

    console.log(APPLY ? '=== FUSION (--apply) ===' : '=== DRY-RUN (aucune écriture) ===');
    if (!groups.length) {
      console.log('Aucun doublon détecté.');
    } else {
      console.log(`${groups.length} groupe(s) de doublons :\n`);
      for (const g of groups) {
        const { rows: users } = await client.query(
          `SELECT id, ad_username, display_name, created_at, last_login_at
             FROM ${SCHEMA}.users WHERE id = ANY($1::int[]) ORDER BY id`,
          [g.ids]
        );
        const scored = [];
        for (const u of users) scored.push({ ...u, ...(await score(client, u.id)) });
        scored.sort((a, b) =>
          b.roles - a.roles
          || b.contributions - a.contributions
          || new Date(a.created_at) - new Date(b.created_at)
        );
        const keep = scored[0];
        const dups = scored.slice(1);

        console.log(`Groupe "${g.key}" :`);
        console.log(`  CONSERVER  id=${keep.id}  ad_username="${keep.ad_username}"  rôles=${keep.roles}  contributions=${keep.contributions}`);
        for (const d of dups) {
          console.log(`  FUSIONNER  id=${d.id}  ad_username="${d.ad_username}"  rôles=${d.roles}  contributions=${d.contributions}  -> ${keep.id}`);
        }

        if (APPLY) {
          await client.query('BEGIN');
          try {
            for (const d of dups) await reassignAll((sql, p) => client.query(sql, p), d.id, keep.id);
            for (const d of dups) await client.query(`DELETE FROM ${SCHEMA}.users WHERE id=$1`, [d.id]);
            await client.query('COMMIT');
            console.log('  -> fusion appliquée.\n');
          } catch (e) {
            await client.query('ROLLBACK');
            console.error('  -> ÉCHEC, groupe annulé :', e.message, '\n');
            throw e;
          }
        } else {
          console.log("  (dry-run : rien n'est modifié)\n");
        }
      }
    }

    if (APPLY) {
      await client.query('BEGIN');
      try {
        const norm = await client.query(`UPDATE ${SCHEMA}.users SET ad_username = lower(btrim(ad_username))`);
        console.log(`ad_username normalisés en minuscules : ${norm.rowCount} compte(s).`);
        await client.query(
          `CREATE UNIQUE INDEX IF NOT EXISTS uq_users_ad_username_lower ON ${SCHEMA}.users (lower(ad_username))`
        );
        await client.query('COMMIT');
        console.log('Index unique uq_users_ad_username_lower en place.');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    } else {
      console.log('Dry-run terminé. Relancer avec --apply pour fusionner.');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error('Erreur :', e); process.exit(1); });
