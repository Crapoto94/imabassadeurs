const axios = require('axios');
const https = require('https');

// Tous les appels à l'API centrale APM sont centralisés ici.
// Doc : https://api.ivry.local/api-docs — header X-API-KEY, préfixe /api/v1.
const APM_URL = process.env.APM_API_URL || 'https://api.ivry.local';
const APM_KEY = process.env.APM_API_KEY;
const REJECT_UNAUTH = process.env.APM_TLS_REJECT_UNAUTHORIZED !== 'false';

const http = axios.create({
  baseURL: APM_URL,
  timeout: 310000, // l'IA locale peut être lente (jusqu'à 5 min côté APM)
  headers: { 'X-API-KEY': APM_KEY },
  httpsAgent: new https.Agent({ rejectUnauthorized: REJECT_UNAUTH }),
});

function assertKey() {
  if (!APM_KEY) throw new Error("Clé APM_API_KEY manquante (à demander à l'admin APM).");
}

async function authentifierAgent(username, password) {
  assertKey();
  try {
    const { data } = await http.post('/api/v1/ad/authenticate', { username, password });
    return { success: true, ...data };
  } catch (err) {
    const status = err.response?.status;
    return {
      success: false,
      status,
      error: err.response?.data?.error || err.message,
    };
  }
}

async function getAgent(identifier) {
  assertKey();
  try {
    const { data } = await http.get('/api/v1/ad/user', { params: { identifier } });
    return data;
  } catch (err) {
    return null;
  }
}

async function rechercherAgents(q) {
  assertKey();
  const { data } = await http.get('/api/v1/ad/search', { params: { q } });
  return data;
}

async function envoyerMail({ to, subject, content, footer1, footer2, footer3, footerColor, is_raw, attachments }) {
  assertKey();
  const { data } = await http.post('/api/v1/mail/send', {
    to, subject, content, footer1, footer2, footer3, footerColor, is_raw, attachments,
  });
  return data;
}

async function envoyerSms(mobile, message) {
  assertKey();
  const { data } = await http.post('/api/v1/sms/send', { mobile, message });
  return data;
}

async function listerModelesIA() {
  assertKey();
  const { data } = await http.get('/api/v1/ai/models');
  return data;
}

async function interrogerIA(prompt, model) {
  assertKey();
  const { data } = await http.post('/api/v1/ai/query', { prompt, model });
  return data;
}

async function demarrerIA(prompt, model) {
  assertKey();
  const { data } = await http.post('/api/v1/ai/query-async', { prompt, model });
  return data.queryId;
}

async function suivreIA(queryId) {
  assertKey();
  const { data } = await http.get(`/api/v1/ai/query-progress/${queryId}`);
  return data;
}

async function status() {
  try {
    const { data } = await axios.get(`${APM_URL}/api/status`, {
      timeout: 8000,
      httpsAgent: new https.Agent({ rejectUnauthorized: REJECT_UNAUTH }),
    });
    return { ok: true, ...data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  authentifierAgent, getAgent, rechercherAgents,
  envoyerMail, envoyerSms,
  listerModelesIA, interrogerIA, demarrerIA, suivreIA, status,
};
