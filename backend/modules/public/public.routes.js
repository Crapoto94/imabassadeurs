const express = require('express');
const notifications = require('../../services/notifications');
const { asyncHandler } = require('../../utils/errors');

const router = express.Router();

function page(title, message) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${title}</title>
  <style>body{font-family:system-ui,sans-serif;background:#f8fafc;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
  .card{background:#fff;padding:2rem;border-radius:1rem;box-shadow:0 10px 30px rgba(0,0,0,.08);max-width:32rem;text-align:center}</style>
  </head><body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`;
}

// GET /api/v1/digest/rate/:token?note=1..5 — sans authentification (le token fait foi).
router.get('/digest/rate/:token', asyncHandler(async (req, res) => {
  const ok = await notifications.rateDigest(req.params.token, req.query.note);
  res
    .status(ok ? 200 : 400)
    .type('html')
    .send(ok
      ? page('Merci !', 'Votre évaluation du résumé a bien été enregistrée.')
      : page('Lien invalide', "Ce lien de notation est invalide ou a déjà été utilisé."));
}));

module.exports = router;
