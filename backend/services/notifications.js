const crypto = require('crypto');
const { db, SCHEMA } = require('../pg_db');
const apm = require('./apm');
const ia = require('./ia');

const CATEGORIES = ['app', 'comment_replies', 'resources', 'risks', 'my_experiments', 'other_experiments'];

async function getSettings() {
  return db.get(`SELECT * FROM ${SCHEMA}.app_settings WHERE id = 1`);
}

async function getFooter() {
  const s = await getSettings();
  return {
    footer1: s?.footer_line1 || "Ville d'Ivry-sur-Seine",
    footer2: s?.footer_line2 || 'Direction des Systèmes d’Information',
    footer3: s?.footer_line3 || '',
    footerColor: s?.footer_color || '#0055A4',
  };
}

// Enregistre un événement de notification pour un ou plusieurs destinataires.
async function notifier(userIds, category, entityType, entityId, message) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  for (const userId of ids) {
    await db.run(
      `INSERT INTO ${SCHEMA}.notification_events (user_id, category, entity_type, entity_id, message)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, category, entityType, entityId, message]
    );
  }
}

async function getPreferences(userId) {
  const rows = await db.all(
    `SELECT category, frequency FROM ${SCHEMA}.notification_preferences WHERE user_id = $1`,
    [userId]
  );
  const map = Object.fromEntries(rows.map((r) => [r.category, r.frequency]));
  return CATEGORIES.reduce((acc, c) => ({ ...acc, [c]: map[c] || 'daily' }), {});
}

// Envoi instantané (job ~ toutes les 5 min).
async function sendInstant() {
  const events = await db.all(`
    SELECT e.*, u.email, u.display_name, p.frequency
      FROM ${SCHEMA}.notification_events e
      JOIN ${SCHEMA}.users u ON u.id = e.user_id
      LEFT JOIN ${SCHEMA}.notification_preferences p
        ON p.user_id = e.user_id AND p.category = e.category
     WHERE e.sent_at IS NULL AND COALESCE(p.frequency, 'daily') = 'instant'
     ORDER BY e.user_id, e.created_at
  `);
  const footer = await getFooter();
  let sent = 0;
  for (const ev of events) {
    if (!ev.email) continue;
    try {
      await apm.envoyerMail({
        to: ev.email,
        subject: 'IAmbassadeurs — nouvelle activité',
        content: `<p>Bonjour ${ev.display_name},</p><p>${ev.message}</p>`,
        ...footer,
      });
      await db.run(`UPDATE ${SCHEMA}.notification_events SET sent_at = now() WHERE id = $1`, [ev.id]);
      sent++;
    } catch (err) {
      console.error('[NOTIF] envoi instantané échoué :', err.message);
    }
  }
  return sent;
}

// Digests quotidien / hebdomadaire rédigés par l'IA (une page).
async function sendDigests(period) {
  const rows = await db.all(`
    SELECT e.user_id, u.email, u.display_name, u.ad_username,
           COALESCE(p.frequency, 'daily') AS frequency,
           array_agg(e.message ORDER BY e.created_at) AS messages,
           array_agg(e.id ORDER BY e.created_at) AS ids
      FROM ${SCHEMA}.notification_events e
      JOIN ${SCHEMA}.users u ON u.id = e.user_id
      LEFT JOIN ${SCHEMA}.notification_preferences p
        ON p.user_id = e.user_id AND p.category = e.category
     WHERE e.sent_at IS NULL AND COALESCE(p.frequency, 'daily') = $1
     GROUP BY e.user_id, u.email, u.display_name, u.ad_username
  `, [period]);
  const footer = await getFooter();
  const appUrl = process.env.APP_URL || '';
  let sent = 0;
  for (const row of rows) {
    if (!row.email) continue;
    const prenom = (row.display_name || row.ad_username || '').split(' ')[0];
    let html;
    try {
      const ai = await ia.executerActionIA(period === 'weekly' ? 'digest_weekly' : 'digest_daily', {
        prenom,
        evenements: row.messages.join('\n- '),
      });
      html = `<p>${String(ai.response || '').replace(/\n/g, '<br/>')}</p>`;
    } catch (err) {
      html = `<p>Bonjour ${prenom},</p><p>Voici l'activité récente :</p><ul>${row.messages
        .map((m) => `<li>${m}</li>`)
        .join('')}</ul>`;
    }
    const token = crypto.randomUUID();
    const digest = await db.get(
      `INSERT INTO ${SCHEMA}.notification_digests (user_id, period, content_html, rating_token)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [row.user_id, period, html, token]
    );
    const ratingLinks = [1, 2, 3, 4, 5]
      .map((n) => `<a href="${appUrl}/digest/rate/${token}?note=${n}">${n}★</a>`)
      .join(' ');
    try {
      await apm.envoyerMail({
        to: row.email,
        subject: `IAmbassadeurs — votre résumé ${period === 'weekly' ? 'hebdomadaire' : 'quotidien'}`,
        content: `${html}<hr/><p>Qualité de ce résumé : ${ratingLinks}</p>`,
        ...footer,
      });
      await db.run(
        `UPDATE ${SCHEMA}.notification_events SET sent_at = now() WHERE id = ANY($1::int[])`,
        [row.ids]
      );
      sent++;
    } catch (err) {
      console.error('[NOTIF] envoi digest échoué :', err.message);
    }
  }
  return sent;
}

async function rateDigest(token, note) {
  const n = parseInt(note, 10);
  if (!(n >= 1 && n <= 5)) throw new Error('Note invalide');
  const updated = await db.get(
    `UPDATE ${SCHEMA}.notification_digests
        SET quality_rating = $2, rated_at = now()
      WHERE rating_token = $1 RETURNING id`,
    [token, n]
  );
  return !!updated;
}

module.exports = { CATEGORIES, notifier, getPreferences, sendInstant, sendDigests, rateDigest, getFooter };
