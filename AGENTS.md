# AGENTS.md — IAmbassadeurs (Charte Éthique IA, Ville d'Ivry-sur-Seine)

Instructions durables pour tout agent/contributeur qui reprend le projet.
Pour l'**état courant** et les **dernières décisions**, lire aussi `HANDOFF.md`.

## En bref

- **Backend** : Node.js + Express 5, modulaire, PostgreSQL (schéma `charte_ia`), Swagger.
- **Frontend** : React 18 + TypeScript + Vite + Tailwind, thème « Ivry IA Citoyenne ».
- **Ports** : backend `5310`, frontend `5311`, PostgreSQL `5432`.
- **Docs de référence** : `README.md` (install/architecture),
  `CAHIER_DES_CHARGES_CHARTE_ETHIQUE_IA_IVRY.md` (spec fonctionnelle),
  `GUIDE_NOUVELLE_APP_VILLE.md` (conventions infra Ville).

## Démarrage local

Prérequis : Node 24+, npm, Docker (pour PostgreSQL en local).

```powershell
# 1. Base PostgreSQL (conteneur Docker, dev uniquement)
docker start iambassadeurs-db

# 2. Backend  → http://localhost:5310  (applique les migrations au démarrage)
cd backend; npm install; npm run dev

# 3. Frontend → http://localhost:5311
cd frontend; npm install; npm run dev
```

- Variables : `backend/.env` et `frontend/.env` (non committés). Voir les `.env.example`.
- Compte local de dev : `admin` / `admin` (`LOCAL_LOGIN_ENABLED=true`).
- Santé API : `GET http://localhost:5310/api/status` ; doc : `http://localhost:5310/api-docs`.

> ⚠️ Backend et frontend tournent **tous deux sous `node`**. Un `Stop-Process -Name node`
> les tue tous les deux : relancer les deux ensuite.

## Structure

```
backend/
  server.js                 routes + middlewares + démarrage (migrations)
  pg_db.js                  pool pg + runner de migrations + helpers db.all/get/run/query
  middleware/auth.js        requireAuth / requireInteract / requireIanimateur / requireAdmin
  modules/<feature>/        <feature>.routes.js + .service.js (+ .controller.js)
  services/                 apm.js (AD/mail/IA), ia.js, notifications.js, scheduler.js
  utils/                    audit.js, errors.js, pagination.js, polymorphic.js
  migrations/NNN_*.sql      migrations versionnées
  uploads/                  fichiers PDF (ignorés par git)

frontend/src/
  api/client.ts, api/endpoints.ts   appels API centralisés
  components/                       Layout, stitch.tsx, ui.tsx, Themes, VideoEmbed, PdfEmbed, PdfThumb, …
  pages/                            Home, Resources(+Detail), Experiments(+Detail), Risks(+Detail),
                                    Votes(+Detail), Mapping, Analytics, Admin, Account, Login, RateDigest
  types.ts                          types partagés
  index.css                         Tailwind + Material Symbols
```

## Base de données & migrations

- Schéma dédié `charte_ia` (variable `POSTGRES_SCHEMA`).
- Migrations `backend/migrations/NNN_nom.sql`, appliquées **au démarrage** du backend
  (ordre alphabétique, dans une transaction, tracées dans `schema_migrations`).
- **Ne jamais modifier une migration déjà appliquée** : en créer une nouvelle (`005_…`).
- Accès SQL via `pg_db.js` (`db.all/get/run/query`), requêtes **paramétrées** (`$1, $2…`).

## Authentification & rôles

- JWT applicatif : `POST /api/v1/auth/login` → `{ token, user }`.
- Rôles cumulables : `admin`, `iambassadeur`, `iaeclaireur`, `ianimateur`.
- Middlewares : `requireAuth`, `requireInteract` (rôles nommés), `requireIanimateur`
  (ianimateur **+ admin**), `requireAdmin`.
- `auth.controller.js` fait un **repli local** si l'APM est injoignable ou sans clé
  (`LOCAL_LOGIN_ENABLED` ou hors production) — le compte seedé `admin/admin` sert alors.

## Conventions

- **UI en français**, libellés et messages en français. Code lisible, court.
- Commentaires **uniquement si utiles**, en français.
- Backend : `routes → service` ; valider les entrées, lever `ApiError`/erreurs typées
  (`utils/errors.js`) ; tracer les actions sensibles via `logAction` (`utils/audit.js`).
- Frontend : **centraliser les appels** dans `api/endpoints.ts`, les types dans `types.ts`.
- **Design system** : tokens dans `frontend/tailwind.config.js` ; privilégier les composants
  de `components/stitch.tsx` (`SectionCard`, `PrimaryButton`, `GhostButton`, `Avatar`,
  `LevelBadge`, `EditedAt`, `StitchInput/Select/Textarea`, `Modal`, `useToast`…).
  `components/ui.tsx` est l'ancienne bibliothèque, restylée sur le même thème (API conservée).
- Couleurs : `primary`, `secondary`, `tertiary`, `error`, `warning`, `surface-*`,
  `on-*`. Icônes via `<span className="material-symbols-outlined">…</span>`.
- Chips transverses : `LevelBadge` (niveau doc), `ThemeChips` / `ThemePicker` (thèmes),
  `RoleBadge` (rôles).
- Commits : **conventional commits en français** (ex. `feat(resources): …`,
  `fix(auth): …`). Ne committer que sur demande explicite.

## Pièges connus (Windows)

- **Encodage** : sous PowerShell 5.1, `Set-Content`/`Add-Content` **sans**
  `-Encoding UTF8` corrompt les accents UTF-8. Préférer l'outil d'édition de fichiers,
  ou `.NET` `[IO.File]::WriteAllText($p, $txt, (New-Object Text.UTF8Encoding $false))`.
  Vérifier l'absence de mojibake (`Ã`, `â€`) et de BOM avant commit.
- **Ports** : `5432` = PostgreSQL (pas le site). Le site est sur `5311`.
- `APM_API_KEY` / `HUBDSI_API_KEY` vides en local : pas d'AD/mail/IA réels, mais les API
  d'Ivry sont joignables sur le réseau ; renseigner les clés pour les activer.
- **pdfjs-dist** : le worker est importé via `pdfjs-dist/build/pdf.worker.min.mjs?url`
  (voir `PdfThumb.tsx`) ; il ajoute un chunk séparé (le bundle principal grossit).

## Vérifications avant commit

```powershell
# Frontend : typecheck + build
cd frontend; npm run lint; npm run build
# Backend : pas de suite de tests ; vérifier le démarrage et /api/status
```

Contrôler aussi : diff sans corruption d'accents, pas de `.env`/secrets/`uploads` ajoutés.

## API (préfixe `/api/v1`)

`/auth`, `/admin` (users, rôles, paramètres, prompts IA, audit), `/themes`,
`/resources` (+`/:id/review`, `/:id/rate`, `/:id/synthesize`), `/experiments`
(+`/:id/status`, `/:id/join`, `/:id/synthesize`), `/risks` (+`/:id/amend`,
`/:id/synthesize`), `/votes`, `/mapping` (graph, principles, links, clusters, consensus),
`/analytics` (kpi, activity, interactions, digest-quality), `/account`, `/comments`.

## Tables principales

`users`, `user_roles`, `comments`, `comment_likes`, `resources` (`level`, `edited_at`),
`resource_ratings`, `experiments`, `experiment_participants`, `risks`, `risk_amendments`,
`vote_sessions/options/responses`, `charter_principles`, `idea_links`,
`idea_clusters(+/items)`, `themes`, `entity_themes`, `ai_prompts`,
`notification_*`, `app_settings`, `audit_log`.
