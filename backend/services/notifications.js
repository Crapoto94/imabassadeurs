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

// ── Journal des e-mails envoyés (table mail_log, lisible par les admins) ──
const MAX_LOG_BODY = 20000;

async function logMail({ userId, to, subject, kind, content, status, error, durationMs }) {
  try {
    await db.run(
      `INSERT INTO ${SCHEMA}.mail_log (user_id, recipient, subject, kind, body, status, error, duration_ms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [userId || null, String(to), String(subject).slice(0, 300), kind,
        String(content || '').slice(0, MAX_LOG_BODY), status, error || null, durationMs ?? null]
    );
  } catch (e) {
    // Le journal ne doit jamais empêcher un envoi.
    console.error('[NOTIF] journalisation du mail impossible :', e.message);
  }
}

// Envoi tracé : une ligne de journal est écrite, que l'APM accepte ou refuse le message.
async function sendMail({ userId, to, subject, content, kind, footer }) {
  const started = Date.now();
  try {
    const result = await apm.envoyerMail({ to, subject, content, ...footer });
    await logMail({ userId, to, subject, kind, content, status: 'sent', durationMs: Date.now() - started });
    return result;
  } catch (err) {
    await logMail({ userId, to, subject, kind, content, status: 'error', error: err.message, durationMs: Date.now() - started });
    throw err;
  }
}

// Destinataires d'une activité de module : tous les utilisateurs sauf l'auteur,
// avec une préférence autre que « jamais » (défaut : résumé quotidien).
async function destinatairesCategorie(category, excludeUserId) {
  const rows = await db.all(
    `SELECT u.id
       FROM ${SCHEMA}.users u
       LEFT JOIN ${SCHEMA}.notification_preferences p
         ON p.user_id = u.id AND p.category = $1
      WHERE ($2::int IS NULL OR u.id <> $2)
        AND COALESCE(p.frequency, 'daily') <> 'never'`,
    [category, excludeUserId || null]
  );
  return rows.map((r) => r.id);
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
      await sendMail({
        userId: ev.user_id, to: ev.email, kind: 'instant',
        subject: 'IAmbassadeurs — nouvelle activité',
        content: `<p>Bonjour ${ev.display_name},</p><p>${ev.message}</p>`,
        footer,
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
      await sendMail({
        userId: row.user_id, to: row.email, kind: period,
        subject: `IAmbassadeurs — votre résumé ${period === 'weekly' ? 'hebdomadaire' : 'quotidien'}`,
        content: `${html}<hr/><p>Qualité de ce résumé : ${ratingLinks}</p>`,
        footer,
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

// ── Test d'envoi : récapitulatif des nouveautés du jour (bouton « Mes notifications ») ──
const TODAY = "(created_at AT TIME ZONE 'Europe/Paris')::date = (now() AT TIME ZONE 'Europe/Paris')::date";
const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Texte lisible d'un corps contenant des tags de mention @[Nom](id).
const plain = (t) => String(t || '').replace(/@\[([^\]\n]{1,80})\]\((\d+|all)\)/g, '$1').replace(/\s+/g, ' ').trim();

// Activité du jour : événements personnels non résumés + contenus publics créés aujourd'hui.
async function collectToday(user) {
  const [events, resources, experiments, risks, posts, comments] = await Promise.all([
    db.all(`SELECT message FROM ${SCHEMA}.notification_events
             WHERE user_id = $1 AND sent_at IS NULL AND ${TODAY} ORDER BY created_at`, [user.id]),
    db.all(`SELECT title FROM ${SCHEMA}.resources
             WHERE status = 'published' AND COALESCE(reviewed_at, created_at)::date = current_date ORDER BY id DESC`),
    db.all(`SELECT title FROM ${SCHEMA}.experiments WHERE ${TODAY} ORDER BY id DESC`),
    db.all(`SELECT title FROM ${SCHEMA}.risks WHERE ${TODAY} ORDER BY id DESC`),
    db.all(`SELECT p.body, u.display_name FROM ${SCHEMA}.wall_posts p
              LEFT JOIN ${SCHEMA}.users u ON u.id = p.author_id
             WHERE p.deleted_at IS NULL AND (p.created_at AT TIME ZONE 'Europe/Paris')::date = (now() AT TIME ZONE 'Europe/Paris')::date
               AND p.author_id IS DISTINCT FROM $1 ORDER BY p.id DESC LIMIT 10`, [user.id]),
    db.all(`SELECT c.body, u.display_name FROM ${SCHEMA}.wall_comments c
              LEFT JOIN ${SCHEMA}.users u ON u.id = c.author_id
             WHERE c.deleted_at IS NULL AND (c.created_at AT TIME ZONE 'Europe/Paris')::date = (now() AT TIME ZONE 'Europe/Paris')::date
               AND c.author_id IS DISTINCT FROM $1 ORDER BY c.id DESC LIMIT 10`, [user.id]),
  ]);
  return { events, resources, experiments, risks, posts, comments };
}

function todayHtml(user, data) {
  const prenom = (user.display_name || user.ad_username || '').split(' ')[0];
  const appUrl = process.env.APP_URL || '';
  const section = (title, items) => (items.length
    ? `<h3>${title}</h3><ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`
    : '');
  const total = Object.values(data).reduce((n, list) => n + list.length, 0);
  const novelties = total
    ? [
        section('Votre activité non encore résumée', data.events.map((e) => e.message)),
        section('Nouvelles ressources publiées', data.resources.map((r) => r.title)),
        section('Nouvelles expérimentations', data.experiments.map((e) => e.title)),
        section('Nouveaux risques', data.risks.map((r) => r.title)),
        section('Le Mur — nouveaux messages', data.posts.map((p) => `${p.display_name || 'Un membre'} : ${plain(p.body).slice(0, 160)}`)),
        section('Le Mur — nouveaux commentaires', data.comments.map((c) => `${c.display_name || 'Un membre'} : ${plain(c.body).slice(0, 160)}`)),
      ].join('')
    : "<p>Aucune nouveauté enregistrée aujourd'hui.</p>";
  return `<p>Bonjour ${esc(prenom)},</p>
<p>Voici les nouveautés du jour sur IAmbassadeurs. <strong>Ce message est un test</strong>, déclenché depuis vos préférences de notification.</p>
${novelties}
${appUrl ? `<p><a href="${esc(appUrl)}">Ouvrir IAmbassadeurs</a></p>` : ''}
<p>Si vous recevez ce message, l'envoi d'e-mails fonctionne : vos résumés partiront à la fréquence choisie.</p>`;
}

// Envoie à l'utilisateur connecté un e-mail de test avec l'activité du jour (sans marquer les événements comme envoyés).
async function sendTest(user) {
  if (!user.email) throw Object.assign(new Error("Aucune adresse e-mail n'est associée à votre compte"), { status: 400 });
  const data = await collectToday(user);
  await sendMail({
    userId: user.id, to: user.email, kind: 'test',
    subject: 'IAmbassadeurs — nouveautés du jour (test)',
    content: todayHtml(user, data), footer: await getFooter(),
  });
  return {
    sent: true, to: user.email,
    counts: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])),
  };
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

module.exports = {
  CATEGORIES, notifier, destinatairesCategorie, getPreferences,
  sendInstant, sendDigests, sendTest, rateDigest, getFooter,
};
