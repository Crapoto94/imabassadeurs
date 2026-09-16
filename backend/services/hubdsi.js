const axios = require('axios');

// API métier Hub DSI (APPDSI) : jeton distinct (dsk_…), header X-API-Key, préfixe /api.
const HUB_URL = process.env.HUBDSI_API_URL;
const HUB_KEY = process.env.HUBDSI_API_KEY;

async function get(path) {
  if (!HUB_URL || !HUB_KEY) throw new Error('Configuration HUBDSI_API_URL / HUBDSI_API_KEY manquante.');
  const { data } = await axios.get(`${HUB_URL}${path}`, {
    headers: { 'X-API-Key': HUB_KEY },
    timeout: 20000,
  });
  return data;
}

const directionsServices = () => get('/api/directions-services');
const villeConfig = () => get('/api/ville/config');
const elus = () => get('/api/ville/elus');
const sites = () => get('/api/ville/sites');
const ecoles = () => get('/api/ville/ecoles');

module.exports = { get, directionsServices, villeConfig, elus, sites, ecoles };
