const cron = require('node-cron');
const notifications = require('./notifications');

// Les jobs désactivés par défaut : ils envoient de vrais e-mails via l'APM.
// Activer avec NOTIFICATIONS_ENABLED=true (production / recette).
const ENABLED = process.env.NOTIFICATIONS_ENABLED === 'true';

function start() {
  if (!ENABLED) {
    console.log('[CRON] désactivé (NOTIFICATIONS_ENABLED != true)');
    return;
  }
  cron.schedule('*/5 * * * *', () => notifications.sendInstant().catch((e) => console.error(e)), { timezone: 'Europe/Paris' });
  cron.schedule('0 7 * * *', () => notifications.sendDigests('daily').catch((e) => console.error(e)), { timezone: 'Europe/Paris' });
  cron.schedule('0 7 * * 1', () => notifications.sendDigests('weekly').catch((e) => console.error(e)), { timezone: 'Europe/Paris' });
  console.log('[CRON] jobs de notification planifiés');
}

module.exports = { start, ENABLED };
