# Cahier des charges — Plateforme collaborative « IAmbassadeurs »
## Élaboration de la Charte Éthique IA — Ville d'Ivry-sur-Seine

---

## 0. À l'attention de l'IA de code

Ce document est **le seul point d'entrée** à te fournir pour générer l'application.
Il est **nécessaire et suffisant** : toute information manquante y est explicitement
signalée comme hypothèse à valider (section 13) plutôt que laissée à ton
interprétation. Respecte-le à la lettre, dans l'ordre suivant :

1. Génère d'abord l'architecture (§5) et le schéma de base de données (§6).
2. Implémente l'authentification et le socle rôles/permissions (§3-4) — tout le reste en dépend.
3. Implémente le module Administration (§8.1) en premier parmi les modules métier :
   c'est lui qui permet de configurer tout le reste (prompts IA, utilisateurs).
4. Implémente ensuite les modules dans l'ordre de la section 8.
5. Respecte impérativement les conventions de la Ville décrites en section 2 — elles
   ne sont pas optionnelles : cette application doit s'intégrer à l'infrastructure
   existante de la DSI d'Ivry-sur-Seine (PostgreSQL partagé, API centrale APM, etc.).
6. À la fin, vérifie ton travail avec la checklist de la section 12.

Langue de l'application : **français**, exclusivement (interface, contenus,
e-mails). Aucune internationalisation n'est demandée.

---

## 1. Contexte et objectifs

La Ville d'Ivry-sur-Seine lance un parcours collectif de définition d'une **Charte
Éthique pour l'usage de l'IA** dans la collectivité. Ce parcours s'appuie sur une
communauté de contributeurs, les **IAmbassadeurs**, appuyés techniquement par des
agents de la DSI, les **ia.éclaireurs**, le tout animé par un ou plusieurs
**IAnimateurs**.

L'application à construire est **l'outil de travail collectif** de cette démarche :
elle permet à la communauté de partager des ressources, de débattre, de recenser des
risques, de suivre des expérimentations, de voter, et de faire émerger — avec l'appui
de l'IA — les points de consensus et de controverse qui nourriront la rédaction de la
Charte elle-même.

L'application n'est **pas** elle-même la Charte : elle est l'espace de travail qui
permet de la construire collectivement, in fine matérialisée par les **principes
éthiques** gérés dans le module Cartographie (§8.6).

---

## 2. Stack technique et conventions Ville

**Se conformer intégralement au document `GUIDE_NOUVELLE_APP_VILLE.md` fourni
séparément** (conventions DSI Ville d'Ivry, mis à jour avec la section IA de l'APM).
Résumé des points structurants pour cette application :

- **Backend** : Node.js + Express 5, modulaire (`modules/<feature>/*.controller.js`,
  `*.routes.js`, `*.service.js`, `*.repository.js`).
- **Frontend** : React 18 + TypeScript + Vite + Tailwind CSS, `react-router-dom`,
  `axios`, `lucide-react`, `framer-motion`.
- **Base de données** : PostgreSQL **partagé** de la Ville (`ivry_admin`) — nouveau
  schéma dédié **`charte_ia`** (nom proposé, à valider — voir §13), toutes les tables
  préfixées `charte_ia.*`, requêtes paramétrées (`$1, $2…`), migrations versionnées
  dans `migrations/`.
- **Docker Compose** : services `backend` + `frontend`, ports dédiés à choisir (ne
  pas réutiliser ceux d'apps existantes), `VITE_API_URL` injecté au build.
- **Intégrations via l'API centrale APM** (`https://api.ivry.local/api/v1/…`,
  header `X-API-KEY`) — **aucune intégration tierce réimplémentée en direct** :
  - Authentification des agents : `POST /api/v1/ad/authenticate` (permission `ad_auth`)
  - Lecture fiche agent (direction, service, mail) : `GET /api/v1/ad/user?identifier=`
    (permission `ad_read`)
  - Envoi d'e-mail : `POST /api/v1/mail/send` (permission `mail_send`)
  - Toute action IA (synthèse, clustering, rédaction…) : `POST /api/v1/ai/query`
    (permission `ai_query`) et `GET /api/v1/ai/models` (permission `ai_read`) —
    **voir §7, ne jamais appeler un fournisseur IA directement**
- **Intégration via l'API Hub DSI** (`dsk_…`, header `X-API-Key`) :
  - Référentiel organisation (directions/services), en lecture seule :
    `GET /api/directions-services` — utilisé pour le filtrage « par direction,
    métier ou groupe » du module Cartographie (§8.6).
- **Variables d'environnement** (`.env`, jamais committé) — reprendre exactement le
  modèle du guide (`POSTGRES_*`, `APM_API_URL`/`APM_API_KEY`, `HUBDSI_API_URL`/
  `HUBDSI_API_KEY`, `PORT`, `JWT_SECRET`, `NODE_ENV`), rien codé en dur.
- **Documentation** : `swagger-jsdoc` + `swagger-ui-express`, endpoint `/api-docs`.
- **Santé** : `GET /api/status` (état app + DB + APM).
- **Fuseau** : `Europe/Paris`, colonnes temporelles `TIMESTAMPTZ`.

---

## 3. Rôles et permissions

### 3.1 Principe général

Chaque personne qui se connecte via l'Active Directory (Ville) obtient
**automatiquement un compte** à sa première connexion, avec le rôle implicite
**Lecteur**. Le rôle Lecteur permet de **consulter l'ensemble de l'application**
(hors module Admin et hors module Analyse) **sans pouvoir interagir** (pas de
commentaire, pas de vote, pas de proposition).

Les interactions (proposer, commenter, voter, liker) sont réservées aux personnes
ayant reçu **au moins un** des rôles nommés suivants, attribués par un administrateur
depuis le module Admin :

| Rôle | Attribution |
|---|---|
| **Admin** | Accès technique complet + gestion utilisateurs/rôles/paramétrage |
| **IAmbassadeur** | Contributeur de la démarche |
| **ia.éclaireur** | Agent DSI en appui technique de la démarche |
| **IAnimateur** | Facilitateur/animateur de la démarche |

**Les rôles sont cumulables** : un même utilisateur peut porter plusieurs rôles à la
fois (ex. un agent DSI peut être à la fois `ia.éclaireur` et `IAnimateur`). Les
quatre rôles nommés donnent **les mêmes droits d'interaction de base** sur tous les
modules de contenu (proposer une ressource, commenter, liker, voter, proposer une
expérimentation ou un risque, participer aux votes). S'y ajoutent des droits propres
à certains rôles :

| Rôle | Droit propre supplémentaire |
|---|---|
| **IAnimateur** | Accès au module **Analyse** (§8.7) ; valide/rejette les ressources proposées (§8.2) ; crée les sessions de vote (§8.5) ; peut amender formellement l'importance/probabilité d'un risque (§8.4) |
| **Admin** | Accès au module **Admin** (§8.1) : paramètres techniques, gestion des comptes/rôles, paramétrage des prompts IA |

### 3.2 Matrice des permissions par module

| Module | Lecteur | IAmbassadeur / ia.éclaireur / IAnimateur / Admin (interaction de base) | IAnimateur (en plus) | Admin (en plus) |
|---|---|---|---|---|
| Base documentaire | Lecture | Proposer, commenter, liker, noter (1-4★) | Valider/rejeter les propositions | — |
| Expérimentations | Lecture | Créer, rejoindre, commenter, liker | — | — |
| Gestion des risques | Lecture | Proposer, qualifier, commenter, liker | Amender importance/probabilité | — |
| Vote | Lecture (résultats) | Voter, proposer une option (mode libre) | Créer une session de vote | — |
| Cartographie des idées | Lecture | Relier une idée à un principe/risque/expérimentation/ressource | Valider un principe de Charte | — |
| Analyse | *(invisible)* | *(invisible)* | Accès complet | — |
| Mon compte | Ses propres préférences | Ses propres préférences | Ses propres préférences | — |
| Admin | *(invisible)* | *(invisible)* | *(invisible)* | Accès complet |

### 3.3 Table des rôles (base de données)

Les rôles sont stockés comme des lignes indépendantes (un utilisateur peut en avoir
zéro — donc Lecteur implicite —, une ou plusieurs) :

```sql
CREATE TABLE charte_ia.user_roles (
  user_id     INTEGER NOT NULL REFERENCES charte_ia.users(id) ON DELETE CASCADE,
  role        VARCHAR(20) NOT NULL CHECK (role IN ('admin','iambassadeur','iaeclaireur','ianimateur')),
  granted_by  INTEGER REFERENCES charte_ia.users(id),
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);
```

---

## 4. Authentification et gestion des comptes

1. Connexion via formulaire (identifiant/mot de passe Ville) → backend appelle
   `POST /api/v1/ad/authenticate` (APM).
2. Si succès : upsert de l'utilisateur dans `charte_ia.users` (créer le compte au
   premier login, sinon mettre à jour `last_login_at`). Enrichir/rafraîchir
   `direction`/`service`/`email` via `GET /api/v1/ad/user?identifier=` (permission
   `ad_read`) — utile pour le filtrage du module Cartographie (§8.6).
3. Émission d'un **JWT applicatif** (signé avec `JWT_SECRET`), seul mécanisme de
   session de l'application ensuite (ne jamais redemander le mot de passe AD à
   chaque requête).
4. Un utilisateur sans ligne dans `user_roles` a le comportement **Lecteur** décrit
   en §3.1. Le middleware d'autorisation calcule l'ensemble des rôles de
   l'utilisateur à chaque requête (ou les inclut dans le JWT avec une durée de vie
   courte + refresh, au choix de l'implémentation).

```sql
CREATE TABLE charte_ia.users (
  id            SERIAL PRIMARY KEY,
  ad_username   VARCHAR(100) UNIQUE NOT NULL,
  display_name  VARCHAR(200) NOT NULL,
  email         VARCHAR(200),
  direction     VARCHAR(200),
  service       VARCHAR(200),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);
```

---

## 5. Architecture applicative

### 5.1 Backend (`backend/`)

```
backend/
  server.js
  pg_db.js                     # pool pg + création schéma charte_ia au démarrage
  services/
    apm.js                     # tous les appels APM (ad, mail, ai/*) centralisés
    hubdsi.js                  # appels Hub DSI (directions-services)
    ia.js                      # orchestration IA applicative (voir §7)
    notifications.js           # génération et envoi des notifications/digests
  modules/
    auth/                      # login, JWT, middleware d'autorisation par rôle
    admin/                     # paramètres techniques, users/rôles, prompts IA
    resources/                 # base documentaire
    experiments/               # expérimentations
    risks/                     # gestion des risques
    votes/                     # module de vote
    mapping/                   # cartographie des idées + charte
    analytics/                 # module Analyse (IAnimateur)
    account/                   # mon compte / préférences de notification
    comments/                  # forum générique réutilisé par resources/experiments/risks
  migrations/
    001_init.sql, 002_..., …
```

### 5.2 Frontend (`frontend/src/`)

```
frontend/src/
  pages/            # une page (ou groupe) par module, alignée sur le backend
  components/        # ui partagée (mini-forum, étoiles de notation, cartes, graphe…)
  hooks/              # useAuth, useRole, useApi…
  api/                # clients axios par domaine
  routes.tsx          # garde de route par rôle (masque Admin/Analyse)
```

### 5.3 Middleware d'autorisation

Un middleware `requireRole('iambassadeur','iaeclaireur','ianimateur','admin')`
(union — au moins un des rôles listés) protège toutes les routes d'écriture des
modules de contenu. `requireRole('ianimateur')` protège le module Analyse et la
validation des ressources/risques. `requireRole('admin')` protège le module Admin.
Les routes de lecture des modules de contenu ne requièrent qu'un JWT valide (tout
utilisateur connecté, y compris Lecteur).

---

## 6. Modèle de données (schéma `charte_ia`)

> DDL fourni à titre de **spécification fonctionnelle du modèle**, pas d'un script
> à copier tel quel : générer de vraies migrations numérotées avec types/contraintes
> adaptés, index sur les colonnes de filtre (voir §2), et `updated_at` où pertinent.

### 6.1 Forum générique (réutilisé par ressources, expérimentations, risques)

```sql
CREATE TABLE charte_ia.comments (
  id            SERIAL PRIMARY KEY,
  entity_type   VARCHAR(20) NOT NULL CHECK (entity_type IN ('resource','experiment','risk')),
  entity_id     INTEGER NOT NULL,
  parent_id     INTEGER REFERENCES charte_ia.comments(id),  -- réponse à un commentaire (1 niveau)
  author_id     INTEGER NOT NULL REFERENCES charte_ia.users(id),
  body          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at     TIMESTAMPTZ
);

CREATE TABLE charte_ia.comment_likes (
  comment_id  INTEGER NOT NULL REFERENCES charte_ia.comments(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES charte_ia.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);
```

### 6.2 Base documentaire

```sql
CREATE TABLE charte_ia.resources (
  id            SERIAL PRIMARY KEY,
  title         VARCHAR(300) NOT NULL,
  description   TEXT NOT NULL,             -- "pourquoi ce document est intéressant"
  kind          VARCHAR(10) NOT NULL CHECK (kind IN ('pdf','link')),
  file_path     TEXT,                       -- si kind = 'pdf' (upload via multer)
  url           TEXT,                       -- si kind = 'link'
  proposed_by   INTEGER NOT NULL REFERENCES charte_ia.users(id),
  status        VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','rejected')),
  reviewed_by   INTEGER REFERENCES charte_ia.users(id),
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE charte_ia.resource_ratings (
  resource_id INTEGER NOT NULL REFERENCES charte_ia.resources(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES charte_ia.users(id),
  stars       SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 4),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ,
  PRIMARY KEY (resource_id, user_id)
);
```

Règle métier : seules les ressources `status = 'published'` (publiées par un
IAnimateur) sont visibles de tous. Une ressource `pending` n'est visible que de son
auteur et des IAnimateurs (file d'attente de modération).

### 6.3 Expérimentations

```sql
CREATE TABLE charte_ia.experiments (
  id           SERIAL PRIMARY KEY,
  title        VARCHAR(300) NOT NULL,
  description  TEXT NOT NULL,         -- le "quoi"
  objective    TEXT NOT NULL,         -- le "pourquoi"
  target_date  DATE,                   -- le "pour quand"
  status       VARCHAR(15) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','ongoing','completed','abandoned')),
  created_by   INTEGER NOT NULL REFERENCES charte_ia.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE charte_ia.experiment_participants (
  experiment_id INTEGER NOT NULL REFERENCES charte_ia.experiments(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES charte_ia.users(id),
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (experiment_id, user_id)
);
```

### 6.4 Gestion des risques

```sql
CREATE TABLE charte_ia.risks (
  id            SERIAL PRIMARY KEY,
  title         VARCHAR(300) NOT NULL,
  description   TEXT NOT NULL,
  concerns_ivry BOOLEAN NOT NULL DEFAULT true,
  importance    SMALLINT NOT NULL CHECK (importance BETWEEN 1 AND 4),
  probability   SMALLINT NOT NULL CHECK (probability BETWEEN 1 AND 4),
  proposed_by   INTEGER NOT NULL REFERENCES charte_ia.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Historique des amendements d'importance/probabilité (traçabilité)
CREATE TABLE charte_ia.risk_amendments (
  id          SERIAL PRIMARY KEY,
  risk_id     INTEGER NOT NULL REFERENCES charte_ia.risks(id) ON DELETE CASCADE,
  importance  SMALLINT NOT NULL CHECK (importance BETWEEN 1 AND 4),
  probability SMALLINT NOT NULL CHECK (probability BETWEEN 1 AND 4),
  amended_by  INTEGER NOT NULL REFERENCES charte_ia.users(id),  -- IAnimateur
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Règle métier : `risks.importance`/`probability` reflètent toujours la **valeur
courante** ; chaque amendement par un IAnimateur insère une ligne dans
`risk_amendments` et met à jour `risks` en conséquence (traçabilité complète de
l'évolution du risque dans le temps, utile au module Analyse et à la Cartographie).

### 6.5 Vote

```sql
CREATE TABLE charte_ia.vote_sessions (
  id              SERIAL PRIMARY KEY,
  question        TEXT NOT NULL,
  mode            VARCHAR(10) NOT NULL CHECK (mode IN ('closed','open')),
  -- closed : options prédéfinies par l'IAnimateur, avec ou sans écriture libre
  -- open   : les utilisateurs proposent eux-mêmes les options (ex. proposer un nom)
  allow_write_in  BOOLEAN NOT NULL DEFAULT false,  -- pertinent seulement si mode = 'closed'
  status          VARCHAR(10) NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_by      INTEGER NOT NULL REFERENCES charte_ia.users(id),  -- IAnimateur
  opens_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  closes_at       TIMESTAMPTZ
);

CREATE TABLE charte_ia.vote_options (
  id          SERIAL PRIMARY KEY,
  session_id  INTEGER NOT NULL REFERENCES charte_ia.vote_sessions(id) ON DELETE CASCADE,
  label       VARCHAR(300) NOT NULL,
  proposed_by INTEGER REFERENCES charte_ia.users(id),  -- NULL = option prédéfinie par l'IAnimateur
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE charte_ia.vote_responses (
  session_id  INTEGER NOT NULL REFERENCES charte_ia.vote_sessions(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES charte_ia.users(id),
  option_id   INTEGER NOT NULL REFERENCES charte_ia.vote_options(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id)  -- un choix par utilisateur et par session, modifiable jusqu'à clôture
);
```

### 6.6 Cartographie des idées et Charte

```sql
CREATE TABLE charte_ia.charter_principles (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(300) NOT NULL,
  body        TEXT NOT NULL,
  status      VARCHAR(10) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','adopted')),
  created_by  INTEGER NOT NULL REFERENCES charte_ia.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Liens polymorphes entre tout contenu (idée = commentaire, ressource, risque,
-- expérimentation...) et un élément structurant de la Charte
CREATE TABLE charte_ia.idea_links (
  id           SERIAL PRIMARY KEY,
  source_type  VARCHAR(20) NOT NULL CHECK (source_type IN ('comment','resource','risk','experiment')),
  source_id    INTEGER NOT NULL,
  target_type  VARCHAR(20) NOT NULL CHECK (target_type IN ('principle','risk','experiment','resource')),
  target_id    INTEGER NOT NULL,
  created_by   INTEGER NOT NULL REFERENCES charte_ia.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Regroupements thématiques proposés par l'IA (clustering) — voir §7 et §8.6
CREATE TABLE charte_ia.idea_clusters (
  id                SERIAL PRIMARY KEY,
  label             VARCHAR(200) NOT NULL,
  description       TEXT,
  generated_by_ai   BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE charte_ia.idea_cluster_items (
  cluster_id   INTEGER NOT NULL REFERENCES charte_ia.idea_clusters(id) ON DELETE CASCADE,
  entity_type  VARCHAR(20) NOT NULL CHECK (entity_type IN ('comment','resource','risk','experiment')),
  entity_id    INTEGER NOT NULL,
  PRIMARY KEY (cluster_id, entity_type, entity_id)
);
```

Les **indicateurs** du module Cartographie (nombre d'idées émises/retenues/
abandonnées, taux de consensus, thématiques actives) sont **calculés à la volée**
par agrégation SQL sur ces tables (pas de table de snapshot dédiée), rafraîchis à
chaque affichage ou mis en cache court côté backend.

### 6.7 IA — prompts administrables

```sql
CREATE TABLE charte_ia.ai_prompts (
  action_key        VARCHAR(50) PRIMARY KEY,   -- voir liste figée en §7.2
  label              VARCHAR(200) NOT NULL,
  prompt_template    TEXT NOT NULL,              -- avec variables {{...}}
  preferred_model    VARCHAR(100),                -- id/clé de modèle APM, NULL = modèle par défaut APM
  updated_by         INTEGER REFERENCES charte_ia.users(id),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 6.8 Notifications et compte

```sql
CREATE TABLE charte_ia.notification_preferences (
  user_id     INTEGER NOT NULL REFERENCES charte_ia.users(id) ON DELETE CASCADE,
  category    VARCHAR(30) NOT NULL CHECK (category IN
                ('app','comment_replies','resources','risks','my_experiments','other_experiments')),
  frequency   VARCHAR(10) NOT NULL DEFAULT 'daily' CHECK (frequency IN ('instant','daily','weekly','never')),
  PRIMARY KEY (user_id, category)
);

-- File d'événements à agréger dans les notifications instantanées/digests
CREATE TABLE charte_ia.notification_events (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES charte_ia.users(id),
  category     VARCHAR(30) NOT NULL,
  entity_type  VARCHAR(20) NOT NULL,
  entity_id    INTEGER NOT NULL,
  message      TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at      TIMESTAMPTZ                -- renseigné à l'envoi (instantané ou inclusion dans un digest)
);

CREATE TABLE charte_ia.notification_digests (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES charte_ia.users(id),
  period           VARCHAR(10) NOT NULL CHECK (period IN ('daily','weekly')),
  content_html     TEXT NOT NULL,
  rating_token     UUID NOT NULL DEFAULT gen_random_uuid(),  -- lien de notation sans authentification
  quality_rating   SMALLINT CHECK (quality_rating BETWEEN 1 AND 5),
  rated_at         TIMESTAMPTZ,
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 6.9 Administration

```sql
CREATE TABLE charte_ia.app_settings (
  id                  SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- ligne unique
  org_name            VARCHAR(200) NOT NULL DEFAULT 'Ville d''Ivry-sur-Seine',
  footer_line1        VARCHAR(200),
  footer_line2        VARCHAR(200),
  footer_line3        VARCHAR(200),
  footer_color        VARCHAR(10) DEFAULT '#0055A4'
);

CREATE TABLE charte_ia.audit_log (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER REFERENCES charte_ia.users(id),
  action       VARCHAR(100) NOT NULL,
  entity_type  VARCHAR(30),
  entity_id    INTEGER,
  details      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 7. Intégration IA

### 7.1 Principe

**Toute action IA de l'application passe par l'API centrale APM**
(`POST /api/v1/ai/query`, voir `GUIDE_NOUVELLE_APP_VILLE.md` §3.5) — jamais
d'appel direct à un fournisseur (Groq/NVIDIA/Ollama). Le backend expose un module
`services/ia.js` avec une fonction unique :

```js
// services/ia.js
async function executerActionIA(actionKey, variables) {
  const prompt = await construirePrompt(actionKey, variables); // charge ai_prompts, remplace {{variables}}
  const { preferred_model } = await getPromptConfig(actionKey);
  return apm.interrogerIA(prompt, preferred_model || undefined); // cf. services/apm.js, §3.5 du guide
}
```

Chaque action IA de l'application (ci-dessous) a une entrée dans
`charte_ia.ai_prompts`, éditable dans le sous-menu **Paramétrage des prompts IA**
du module Admin (§8.1) : libellé, gabarit de prompt avec variables, modèle
préférentiel (optionnel, sinon modèle par défaut APM).

### 7.2 Liste figée des actions IA (à pré-remplir en base à l'installation)

| `action_key` | Déclenchement | Variables disponibles |
|---|---|---|
| `resource_synthesis` | Synthèse d'un document de la base documentaire | `{{titre}}`, `{{description}}`, `{{contenu_extrait}}` |
| `thread_synthesis` | Synthèse d'un fil de discussion (ressource/risque/expérimentation) | `{{titre_entite}}`, `{{commentaires}}` |
| `thematic_clustering` | Regroupement thématique (Cartographie, §8.6) | `{{contenus}}` (ressources, commentaires, risques, expérimentations) |
| `consensus_analysis` | Détection consensus/controverses (Cartographie §8.6 et Analyse §8.7) | `{{contenus}}`, `{{votes}}` |
| `risk_summary` | Synthèse d'un risque et de son débat | `{{risque}}`, `{{commentaires}}` |
| `experiment_summary` | Synthèse d'une expérimentation et de son débat | `{{experimentation}}`, `{{commentaires}}` |
| `digest_daily` | Rédaction de l'e-mail de synthèse quotidien personnalisé (§9) | `{{prenom}}`, `{{evenements}}` |
| `digest_weekly` | Rédaction de l'e-mail de synthèse hebdomadaire personnalisé (§9) | `{{prenom}}`, `{{evenements}}` |

### 7.3 Contraintes techniques

- Timeout HTTP applicatif large (≥ 5 min) sur tout appel à `/api/v1/ai/query`
  (un modèle local peut être lent — voir guide §3.5).
- Toujours gérer l'échec (503 APM = aucun modèle disponible) avec un message
  utilisateur clair et une possibilité de réessayer manuellement — ne jamais faire
  échouer toute une page pour un simple échec de synthèse IA.
- Les réponses IA affichées à l'utilisateur (synthèses, digests) sont **toujours
  identifiées comme générées par IA** dans l'interface.

---

## 8. Modules fonctionnels

### 8.1 Module Administration *(réservé Admin)*

- **Paramètres techniques** : `app_settings` (nom de l'organisation, pied de page
  des e-mails — footer1/2/3/couleur, réutilisés pour `POST /api/v1/mail/send`).
- **Gestion des utilisateurs** : liste des comptes (auto-provisionnés à la première
  connexion AD), attribution/retrait des rôles (`admin`, `iambassadeur`,
  `iaeclaireur`, `ianimateur`, cumulables — §3).
- **Sous-menu Paramétrage des prompts IA** : édition des gabarits de
  `charte_ia.ai_prompts` (§7.2) — libellé, texte du prompt (avec variables),
  modèle IA préférentiel (sélecteur alimenté par `GET /api/v1/ai/models`, §3.5 du
  guide), avec un bouton « Tester » qui exécute le prompt sur un exemple.
- **Journal d'audit** : consultation de `audit_log` (qui a fait quoi).

### 8.2 Module Base documentaire

- Un **IAnimateur** propose une ressource (fichier PDF via upload `multer`, ou
  lien) et rédige la description ( « pourquoi ce document est intéressant » ) →
  publiée directement (`status = 'published'`).
- Un **IAmbassadeur/ia.éclaireur** peut aussi proposer une ressource → elle entre
  en `status = 'pending'`, visible uniquement de son auteur et des IAnimateurs, qui
  la valident ou la rejettent (avec motif optionnel).
- Toute ressource publiée est **notable** de 1 à 4 étoiles par tout utilisateur
  interactant (une note par utilisateur, modifiable).
- **Mini-forum** attaché à chaque ressource : commentaires avec réponse (1 niveau
  d'imbrication), like façon Facebook (`comment_likes`).
- Action IA disponible sur chaque ressource : « Synthétiser ce document »
  (`resource_synthesis`) et « Synthétiser la discussion »
  (`thread_synthesis`).

### 8.3 Module Expérimentations

- Suivi façon mode projet : titre, **quoi** (description), **pourquoi**
  (objectif), **pour quand** (date cible), statut (planifiée/en cours/terminée/
  abandonnée), participants (les utilisateurs s'inscrivent ou sont inscrits).
- **Mini-forum** identique au modèle du §8.2 (commentaires + likes).
- Action IA : « Synthétiser la discussion » (`experiment_summary`).

### 8.4 Module Gestion des risques

- Tout utilisateur interagissant peut proposer un risque : titre, description,
  s'il concerne Ivry ou non (`concerns_ivry`), importance (1-4★) et probabilité
  a priori (1-4★) initiales.
- Un **IAnimateur** peut **amender** l'importance/probabilité par la suite (avec
  motif) — chaque amendement est tracé dans `risk_amendments` (§6.4), l'historique
  étant consultable sur la fiche du risque.
- **Mini-forum** identique au modèle du §8.2.
- Action IA : « Synthétiser le risque et son débat » (`risk_summary`).

### 8.5 Module Vote

- Un **IAnimateur** crée une session de vote avec une question, en choisissant un
  mode :
  - **Mode fermé** (`closed`) : il définit les options de réponse à l'avance, avec
    la possibilité d'autoriser (`allow_write_in`) ou non une réponse libre en plus
    des options prédéfinies.
  - **Mode libre** (`open`) : pas d'options prédéfinies — chaque utilisateur peut
    proposer une option (ex. proposer un nom), et tout le monde vote ensuite pour
    l'une des options déjà proposées.
- Un utilisateur vote **une fois par session**, son vote reste modifiable tant que
  la session est ouverte (`status = 'open'`). Les résultats agrégés (nombre de
  voix par option) sont visibles de tous, y compris des Lecteurs, une fois la
  session close (voir hypothèse §13 sur la visibilité en cours de vote).

### 8.6 Module Cartographie des idées *(capstone, version complète)*

Objectif : visualiser en temps réel l'ensemble des idées, propositions, débats,
risques, expérimentations et principes émergents, afin d'aider à la construction
collective de la Charte.

- **Carte visuelle interactive** : représentation graphique des contenus de la
  plateforme (ressources, commentaires, risques, expérimentations, principes de
  Charte), regroupement automatique par thématique (`idea_clusters`), navigation
  par zoom, **filtrage par direction, métier ou groupe** (`users.direction`/
  `service`, alimentés par l'AD/Hub DSI — §4 et §2). Bibliothèque suggérée côté
  frontend : un graphe de force (ex. type `react-force-graph` ou équivalent) —
  choix libre de l'IA de code tant que zoom/filtre/clustering sont assurés.
- **Détection IA des thématiques** (`thematic_clustering`, §7.2) : analyse
  périodique (job planifié, ex. nocturne) ou à la demande (bouton IAnimateur) de
  l'ensemble des contenus → propose des regroupements/thèmes/liens, stockés dans
  `idea_clusters`/`idea_cluster_items`.
- **Consensus et controverses** (`consensus_analysis`, §7.2) : à partir des votes
  (`resource_ratings`, `risk_amendments`, `vote_responses`) et du contenu des
  débats, l'IA identifie idées consensuelles, controversées, sujets insuffisamment
  débattus et sujets prioritaires — affiché en synthèse sur la carte.
- **Construction de la Charte** : toute idée (commentaire, ressource, risque,
  expérimentation) peut être **reliée** (`idea_links`) à un principe éthique
  (`charter_principles`), une proposition de rédaction pouvant elle-même devenir un
  principe `draft` puis `adopted` par un IAnimateur.
- **Indicateurs** (calculés à la volée, §6.6) : nombre d'idées émises / retenues
  (reliées à un principe adopté) / abandonnées, taux de consensus, thématiques les
  plus actives.
- **Visualisations** : carte mentale/graphe de connaissances (vue principale),
  nuage de concepts (mots/thèmes les plus fréquents, pondérés par occurrence —
  vue de synthèse rapide en complément du graphe), frise chronologique (activité
  dans le temps, via `created_at` des entités), vue « carte des controverses »
  (liste ou carte des sujets identifiés comme controversés par
  `consensus_analysis`).

### 8.7 Module Analyse *(réservé IAnimateur)*

- **Activité des IAmbassadeurs/ia.éclaireurs** : contributions (ressources,
  commentaires, votes, risques, expérimentations) par utilisateur/période, KPI
  d'engagement.
- **Interactions** : qui commente/répond à qui, réseaux d'échange par sujet.
- **Points de débat et de consensus** : réutilise `consensus_analysis` (§7.2/§8.6)
  sur un périmètre choisi par l'IAnimateur (tout, ou un module/thème en
  particulier).
- Tableaux de bord avec les KPI utiles à l'IAnimateur pour piloter la démarche
  (volume d'activité, taux de participation, ressources les mieux notées, risques
  les plus qualifiés, etc.).

### 8.8 Module Mon compte

- Informations du compte (nom, direction/service issus de l'AD, rôles portés —
  lecture seule, modification des rôles réservée à l'Admin).
- **Préférences de notification**, par catégorie (`notification_preferences`,
  §6.8), chacune réglable indépendamment via menu déroulant/toggle sur une
  fréquence :
  - **L'application en elle-même** (annonces générales)
  - **Une réponse à l'un de mes commentaires**
  - **Le module Ressources**
  - **Le module Risques**
  - **Mes expérimentations**
  - **Les autres expérimentations**

  Fréquences disponibles par catégorie : **à chaque nouveauté** (instantané),
  **résumé quotidien**, **résumé hebdomadaire**, ou **jamais** (voir §13).

---

## 9. Système de notifications e-mail

- Tout événement pertinent (nouvelle ressource publiée, réponse à un commentaire,
  nouveau risque, activité sur une expérimentation suivie…) est inséré dans
  `notification_events` avec sa/ses catégorie(s) et le(s) destinataire(s) concernés
  (déterminés selon qui suit/participe à l'entité concernée).
- **Fréquence instantanée** : un job (quasi temps réel, ex. toutes les 5 minutes)
  envoie un e-mail par événement non encore envoyé, via `POST /api/v1/mail/send`
  (APM), pour les utilisateurs ayant réglé `frequency = 'instant'` sur la
  catégorie concernée.
- **Résumés quotidien/hebdomadaire** : un job planifié (quotidien / hebdomadaire)
  regroupe, par utilisateur, tous les événements non envoyés des catégories
  réglées sur `daily`/`weekly`, et appelle `executerActionIA('digest_daily' |
  'digest_weekly', { prenom, evenements })` (§7.1) pour **rédiger un résumé
  personnel en français, tenant sur une seule page à l'impression** — cette
  contrainte de longueur doit être explicite dans le gabarit de prompt
  correspondant (`ai_prompts`, §6.7), à ajuster si nécessaire par l'Admin.
- Le résultat est enregistré dans `notification_digests` (avec un `rating_token`
  unique) puis envoyé par e-mail (template institutionnel APM, §3.3 du guide).
- **Chaque e-mail de synthèse inclut un lien de notation de sa qualité**
  (`https://<app>/digest/rate/{rating_token}?note=1..5`), cliquable **sans
  authentification** (le token fait foi), qui enregistre `quality_rating`/
  `rated_at` sur `notification_digests` — utile au pilotage de la qualité des
  prompts IA depuis le module Analyse (§8.7).

---

## 10. Exigences non fonctionnelles

Reprendre intégralement les sections 5 et 6 de `GUIDE_NOUVELLE_APP_VILLE.md`
(sécurité, organisation du code, conventions d'API, base de données, uploads,
qualité). Points spécifiques à cette application :

- **Accessibilité** : viser une interface utilisable sans souris (navigation
  clavier) et un contraste suffisant sur la carte de cartographie (§8.6), dont les
  éléments graphiques doivent rester compréhensibles en cas de daltonisme (ne pas
  coder l'information uniquement par la couleur).
- **RGPD** : les commentaires et votes sont nominatifs en base (traçabilité
  nécessaire à l'animation) ; prévoir un affichage du nom de l'auteur dans
  l'interface (pas d'anonymat), et une mention d'information sur le traitement des
  données personnelles (a minima un lien vers la politique de confidentialité de
  la Ville — contenu à fournir par la DSI, hors périmètre de cette app).
- **Performance** : pagination (`?limit=&offset=`) sur toutes les listes
  potentiellement longues (ressources, commentaires, expérimentations, risques,
  journal d'audit).
- **Jobs planifiés** : prévoir un scheduler interne (ex. `node-cron`) pour les
  digests (§9), le clustering IA périodique (§8.6) et le test de santé n'est **pas**
  à réimplémenter côté application (déjà assuré par l'APM sur ses modèles IA,
  §3.5 du guide).

---

## 11. Ce qui est explicitement hors périmètre

- Édition collaborative en temps réel (type Google Docs) du texte final de la
  Charte : ce document gère la **matière première** (idées, principes, liens) ;
  la mise en forme finale du document de Charte est un livrable ultérieur, hors
  périmètre de cette application.
- Application mobile native (l'interface web doit rester responsive, sans
  application dédiée).
- Traduction / autres langues que le français.

---

## 12. Checklist de livraison

- [ ] Repo `backend/` + `frontend/` conforme à `GUIDE_NOUVELLE_APP_VILLE.md`
- [ ] `docker-compose.yml`, `.env.example`, ports dédiés choisis et documentés
- [ ] Schéma `charte_ia` créé au démarrage, migrations numérotées, tables du §6
- [ ] Authentification AD (APM `ad_auth`) + auto-provisioning compte + JWT
      applicatif + middleware de rôles cumulables (§3-4)
- [ ] Module Admin opérationnel en premier (utilisateurs/rôles, prompts IA,
      paramètres) — §8.1
- [ ] `services/apm.js` centralisant tous les appels APM, y compris
      `POST /api/v1/ai/query` (jamais d'appel direct à un fournisseur IA)
- [ ] `services/ia.js` + table `ai_prompts` pré-remplie avec les 8 actions du §7.2
- [ ] Les 8 modules du §8 implémentés avec leurs mini-forums, notations, votes
- [ ] Système de notifications (instantané + digests IA une page + lien de
      notation qualité) — §9
- [ ] Swagger (`/api-docs`), `GET /api/status`, logs structurés, pagination
- [ ] README de démarrage complet (install, `.env.example`, commandes)

---

## 13. Hypothèses retenues — à valider avec la DSI avant développement

Ces points ont été tranchés par défaut pour permettre une génération « one-shot » ;
ils sont simples à ajuster mais **doivent être confirmés** :

1. **Nom du schéma PostgreSQL** : `charte_ia` — à valider ou remplacer selon la
   convention de nommage interne de la DSI.
2. **Nom d'application/domaine** : non fourni — à définir (ex.
   `https://charte-ia.ivry.local`) pour le reverse-proxy et les liens des e-mails
   (dont le lien de notation des digests, §9).
3. **Vote (§8.5)** : un utilisateur peut changer son vote tant que la session est
   ouverte, et les résultats agrégés restent visibles pendant le vote (pas
   seulement à la clôture) — à confirmer si un mode « résultats masqués jusqu'à la
   clôture » est souhaité pour certains votes.
4. **Fréquence de notification « jamais »** : ajoutée en plus des trois fréquences
   citées (instantané/quotidien/hebdomadaire) pour permettre de désactiver une
   catégorie — à confirmer.
5. **« Droits ad hoc » du module Admin** : interprétés comme l'attribution/retrait
   des quatre rôles nommés par utilisateur (cumulables, §3) plutôt qu'une matrice
   de permissions individuelle par utilisateur. Si une granularité plus fine est
   nécessaire (droits par utilisateur indépendants des rôles), le modèle de
   données (§3.3) devra être étendu.
6. **Filtrage « par direction, métier ou groupe » (§8.6)** : basé sur
   `users.direction`/`service`, alimentés par l'AD (APM) — à confirmer que ces
   champs AD sont bien renseignés pour tous les agents concernés, sinon prévoir un
   champ de saisie manuelle en complément.
7. **Threading des commentaires** : limité à un niveau de réponse (commentaire →
   réponse), pas de réponses en cascade illimitée — à confirmer.
8. **Upload de ressources** : limite de taille non spécifiée — reprendre par
   défaut la limite de 5 Mo déjà en usage côté APM pour les pièces jointes
   d'e-mail (cohérence Ville), ajustable.
