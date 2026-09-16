# IAmbassadeurs — Plateforme collaborative Charte Éthique IA

Application fullstack de la Ville d’Ivry-sur-Seine pour l’élaboration collective de la
Charte Éthique IA, conforme au `GUIDE_NOUVELLE_APP_VILLE.md` et au
`CAHIER_DES_CHARGES_CHARTE_ETHIQUE_IA_IVRY.md`.

## Architecture

- **Backend** : Node.js + Express 5, modulaire (`modules/<feature>/`), PostgreSQL partagé
  (schéma dédié **`charte_ia`**, migrations versionnées), Swagger (`/api-docs`).
- **Frontend** : React 18 + TypeScript + Vite + Tailwind CSS, routing par rôle.
- **Intégrations** : API centrale **APM** (`X-API-KEY`) pour l’AD, le mail et l’IA ;
  API **Hub DSI** (`dsk_…`) pour les référentiels Ville. Aucune intégration tierce
  n’est réimplémentée.

```
backend/    API Express (port 5310)
frontend/   SPA React (port 5311)
docker-compose.yml
```

## Démarrage en développement (local)

### 1. Backend

```bash
cd backend
cp .env.example .env      # renseigner POSTGRES_*, APM_*, HUBDSI_*, JWT_SECRET
npm install
npm run dev               # http://localhost:5310  (crée le schéma charte_ia au démarrage)
```

Vérifier : `GET http://localhost:5310/api/status` et la doc `http://localhost:5310/api-docs`.

### 2. Frontend

```bash
cd frontend
cp .env.example .env      # VITE_API_URL=http://localhost:5310
npm install
npm run dev               # http://localhost:5311
```

## Démarrage en production (Docker)

```bash
cp .env.example .env      # racine : APP_API_URL
docker compose up -d --build
```

- Backend : `http://<hôte>:5310` — Frontend : `http://<hôte>:5311`
- Le conteneur frontend (Nginx) **proxifie `/api` et `/uploads` vers le service
  `backend`** : le navigateur n’appelle que son origine → aucun problème de CORS ni
  de `localhost`. Laisser `APP_API_URL` vide dans `.env` (racine).
- En production, exposer l’app derrière un reverse-proxy (Nginx/Traefik) en HTTPS
  (ex. `https://charte-ia.ivry.local`) et adapter `APP_URL`.

## Comptes et authentification

- Connexion via **Active Directory** (`POST /api/v1/ad/authenticate` de l’APM).
  Tout agent obtient un compte automatiquement à sa première connexion (rôle implicite
  **Lecteur**).
- Les interactions (proposer, commenter, voter, liker) nécessitent un rôle nommé
  (`iambassadeur`, `iaeclaireur`, `ianimateur`) ou `admin`, attribué depuis le module Admin.
- **Amorçage en production** : définir `ADMIN_USERS=login1,login2` — ces identifiants
  AD reçoivent le rôle **admin** à leur première connexion. Sans cela, personne ne
  peut administrer l’application après l’installation. Ensuite, retirer le surplus.
- **Développement uniquement** : si `SEED_ADMIN_USERNAME`/`SEED_ADMIN_PASSWORD` sont
  définis et qu’aucun admin n’existe, un admin local est créé (repli si l’AD est
  injoignable). En local, `admin` / `admin` est seedé.

## Jetons à demander

| Jeton | Destinataire | Usage |
|---|---|---|
| `APM_API_KEY` (`X-API-KEY`) | admin APM | `ad_auth`, `ad_read`, `mail_send`, `ai_query`, `ai_read` |
| `HUBDSI_API_KEY` (`dsk_…`, scope `ville`) | admin Hub DSI | référentiels Ville (directions/services) |

La clé APM livrée dans `.env` est partagée (permissions `ad_*`, `mail_send`) : **demander
une clé dédiée incluant `ai_query`/`ai_read`** pour la production.

## Sécurité

- Secrets **uniquement** côté backend, dans `.env` (non committé).
- Le frontend ne connaît que l’URL de son propre backend (`VITE_API_URL`, injectée au build).
- Requêtes SQL paramétrées (`$1, $2…`), CORS restreint, uploads limités à 5 Mo (PDF).
- Les jobs de notification (`NOTIFICATIONS_ENABLED=false` par défaut) n’envoient de
  vrais e-mails que lorsqu’ils sont explicitement activés.
