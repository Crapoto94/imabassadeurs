-- 001_init.sql — Schéma charte_ia de l'application IAmbassadeurs
-- Convention Ville : un schéma = une application, tables préfixées charte_ia.*

CREATE SCHEMA IF NOT EXISTS charte_ia;

-- ───────────────────────────── Comptes & rôles ─────────────────────────────
CREATE TABLE IF NOT EXISTS charte_ia.users (
  id            SERIAL PRIMARY KEY,
  ad_username   VARCHAR(100) UNIQUE NOT NULL,
  display_name  VARCHAR(200) NOT NULL,
  email         VARCHAR(200),
  direction     VARCHAR(200),
  service       VARCHAR(200),
  password_hash VARCHAR(255),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS charte_ia.user_roles (
  user_id    INTEGER NOT NULL REFERENCES charte_ia.users(id) ON DELETE CASCADE,
  role       VARCHAR(20) NOT NULL CHECK (role IN ('admin','iambassadeur','iaeclaireur','ianimateur')),
  granted_by INTEGER REFERENCES charte_ia.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

-- ───────────────────────── Forum générique (partagé) ───────────────────────
CREATE TABLE IF NOT EXISTS charte_ia.comments (
  id          SERIAL PRIMARY KEY,
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('resource','experiment','risk')),
  entity_id   INTEGER NOT NULL,
  parent_id   INTEGER REFERENCES charte_ia.comments(id) ON DELETE CASCADE,
  author_id   INTEGER NOT NULL REFERENCES charte_ia.users(id),
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_comments_entity ON charte_ia.comments(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS charte_ia.comment_likes (
  comment_id INTEGER NOT NULL REFERENCES charte_ia.comments(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES charte_ia.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

-- ───────────────────────────── Base documentaire ───────────────────────────
CREATE TABLE IF NOT EXISTS charte_ia.resources (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(300) NOT NULL,
  description TEXT NOT NULL,
  kind        VARCHAR(10) NOT NULL CHECK (kind IN ('pdf','link')),
  file_path   TEXT,
  url         TEXT,
  proposed_by INTEGER NOT NULL REFERENCES charte_ia.users(id),
  status      VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','rejected')),
  review_note TEXT,
  reviewed_by INTEGER REFERENCES charte_ia.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_resources_status ON charte_ia.resources(status);

CREATE TABLE IF NOT EXISTS charte_ia.resource_ratings (
  resource_id INTEGER NOT NULL REFERENCES charte_ia.resources(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES charte_ia.users(id),
  stars       SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 4),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ,
  PRIMARY KEY (resource_id, user_id)
);

-- ───────────────────────────── Expérimentations ────────────────────────────
CREATE TABLE IF NOT EXISTS charte_ia.experiments (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(300) NOT NULL,
  description TEXT NOT NULL,
  objective   TEXT NOT NULL,
  target_date DATE,
  status      VARCHAR(15) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','ongoing','completed','abandoned')),
  created_by  INTEGER NOT NULL REFERENCES charte_ia.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON charte_ia.experiments(status);

CREATE TABLE IF NOT EXISTS charte_ia.experiment_participants (
  experiment_id INTEGER NOT NULL REFERENCES charte_ia.experiments(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES charte_ia.users(id),
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (experiment_id, user_id)
);

-- ───────────────────────────── Gestion des risques ─────────────────────────
CREATE TABLE IF NOT EXISTS charte_ia.risks (
  id            SERIAL PRIMARY KEY,
  title         VARCHAR(300) NOT NULL,
  description   TEXT NOT NULL,
  concerns_ivry BOOLEAN NOT NULL DEFAULT true,
  importance    SMALLINT NOT NULL CHECK (importance BETWEEN 1 AND 4),
  probability   SMALLINT NOT NULL CHECK (probability BETWEEN 1 AND 4),
  proposed_by   INTEGER NOT NULL REFERENCES charte_ia.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_risks_importance ON charte_ia.risks(importance);

CREATE TABLE IF NOT EXISTS charte_ia.risk_amendments (
  id          SERIAL PRIMARY KEY,
  risk_id     INTEGER NOT NULL REFERENCES charte_ia.risks(id) ON DELETE CASCADE,
  importance  SMALLINT NOT NULL CHECK (importance BETWEEN 1 AND 4),
  probability SMALLINT NOT NULL CHECK (probability BETWEEN 1 AND 4),
  amended_by  INTEGER NOT NULL REFERENCES charte_ia.users(id),
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ───────────────────────────────── Vote ────────────────────────────────────
CREATE TABLE IF NOT EXISTS charte_ia.vote_sessions (
  id             SERIAL PRIMARY KEY,
  question       TEXT NOT NULL,
  mode           VARCHAR(10) NOT NULL CHECK (mode IN ('closed','open')),
  allow_write_in BOOLEAN NOT NULL DEFAULT false,
  status         VARCHAR(10) NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_by     INTEGER NOT NULL REFERENCES charte_ia.users(id),
  opens_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  closes_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS charte_ia.vote_options (
  id          SERIAL PRIMARY KEY,
  session_id  INTEGER NOT NULL REFERENCES charte_ia.vote_sessions(id) ON DELETE CASCADE,
  label       VARCHAR(300) NOT NULL,
  proposed_by INTEGER REFERENCES charte_ia.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vote_options_session ON charte_ia.vote_options(session_id);

CREATE TABLE IF NOT EXISTS charte_ia.vote_responses (
  session_id INTEGER NOT NULL REFERENCES charte_ia.vote_sessions(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES charte_ia.users(id),
  option_id  INTEGER NOT NULL REFERENCES charte_ia.vote_options(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);

-- ───────────────────── Cartographie des idées & Charte ─────────────────────
CREATE TABLE IF NOT EXISTS charte_ia.charter_principles (
  id         SERIAL PRIMARY KEY,
  title      VARCHAR(300) NOT NULL,
  body       TEXT NOT NULL,
  status     VARCHAR(10) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','adopted')),
  created_by INTEGER NOT NULL REFERENCES charte_ia.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_principles_status ON charte_ia.charter_principles(status);

CREATE TABLE IF NOT EXISTS charte_ia.idea_links (
  id          SERIAL PRIMARY KEY,
  source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('comment','resource','risk','experiment')),
  source_id   INTEGER NOT NULL,
  target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('principle','risk','experiment','resource')),
  target_id   INTEGER NOT NULL,
  created_by  INTEGER NOT NULL REFERENCES charte_ia.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS idx_idea_links_source ON charte_ia.idea_links(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_idea_links_target ON charte_ia.idea_links(target_type, target_id);

CREATE TABLE IF NOT EXISTS charte_ia.idea_clusters (
  id              SERIAL PRIMARY KEY,
  label           VARCHAR(200) NOT NULL,
  description     TEXT,
  generated_by_ai BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS charte_ia.idea_cluster_items (
  cluster_id  INTEGER NOT NULL REFERENCES charte_ia.idea_clusters(id) ON DELETE CASCADE,
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('comment','resource','risk','experiment')),
  entity_id   INTEGER NOT NULL,
  PRIMARY KEY (cluster_id, entity_type, entity_id)
);

-- ─────────────────────── IA — prompts administrables ───────────────────────
CREATE TABLE IF NOT EXISTS charte_ia.ai_prompts (
  action_key      VARCHAR(50) PRIMARY KEY,
  label           VARCHAR(200) NOT NULL,
  prompt_template TEXT NOT NULL,
  preferred_model VARCHAR(100),
  updated_by      INTEGER REFERENCES charte_ia.users(id),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────── Notifications / compte ────────────────────────
CREATE TABLE IF NOT EXISTS charte_ia.notification_preferences (
  user_id   INTEGER NOT NULL REFERENCES charte_ia.users(id) ON DELETE CASCADE,
  category  VARCHAR(30) NOT NULL CHECK (category IN
              ('app','comment_replies','resources','risks','my_experiments','other_experiments')),
  frequency VARCHAR(10) NOT NULL DEFAULT 'daily' CHECK (frequency IN ('instant','daily','weekly','never')),
  PRIMARY KEY (user_id, category)
);

CREATE TABLE IF NOT EXISTS charte_ia.notification_events (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES charte_ia.users(id),
  category    VARCHAR(30) NOT NULL,
  entity_type VARCHAR(20) NOT NULL,
  entity_id   INTEGER NOT NULL,
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_notif_events_user ON charte_ia.notification_events(user_id, sent_at);

CREATE TABLE IF NOT EXISTS charte_ia.notification_digests (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES charte_ia.users(id),
  period         VARCHAR(10) NOT NULL CHECK (period IN ('daily','weekly')),
  content_html   TEXT NOT NULL,
  rating_token   UUID NOT NULL,
  quality_rating SMALLINT CHECK (quality_rating BETWEEN 1 AND 5),
  rated_at       TIMESTAMPTZ,
  sent_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_digests_token ON charte_ia.notification_digests(rating_token);

-- ─────────────────────────────── Administration ────────────────────────────
CREATE TABLE IF NOT EXISTS charte_ia.app_settings (
  id           SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  org_name     VARCHAR(200) NOT NULL DEFAULT 'Ville d''Ivry-sur-Seine',
  footer_line1 VARCHAR(200),
  footer_line2 VARCHAR(200),
  footer_line3 VARCHAR(200),
  footer_color VARCHAR(10) DEFAULT '#0055A4'
);

CREATE TABLE IF NOT EXISTS charte_ia.audit_log (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES charte_ia.users(id),
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(30),
  entity_id   INTEGER,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON charte_ia.audit_log(created_at DESC);

-- ───────────────────────────── Données de départ ───────────────────────────
INSERT INTO charte_ia.app_settings (id, org_name, footer_line1, footer_line2, footer_line3, footer_color)
VALUES (1, 'Ville d''Ivry-sur-Seine', 'Ville d''Ivry-sur-Seine',
        'Direction des Systèmes d''Information', 'charte-ia@ivry94.fr', '#0055A4')
ON CONFLICT (id) DO NOTHING;

INSERT INTO charte_ia.ai_prompts (action_key, label, prompt_template) VALUES
('resource_synthesis', 'Synthèse d''un document de la base documentaire',
 'Tu es un assistant de la Ville d''Ivry-sur-Seine. Résume en français, en 5 à 8 phrases, le document intitulé « {{titre}} ». Description fournie : {{description}}. Contenu du document : {{contenu_extrait}}. Reste factuel, ne rien inventer.'),
('thread_synthesis', 'Synthèse d''un fil de discussion',
 'Synthétise en français, en 5 à 8 phrases, la discussion portant sur « {{titre_entite}} ». Fais ressortir les arguments principaux, les points d''accord et les points de désaccord. Discussion : {{commentaires}}.'),
('thematic_clustering', 'Regroupement thématique (Cartographie)',
 'Voici une liste de contenus (ressources, commentaires, risques, expérimentations) de la démarche Charte Éthique IA. Regroupe-les en 4 à 8 thématiques en français. Réponds STRICTEMENT en JSON : un tableau d''objets {"label": "...", "description": "...", "items": [{"type": "resource|comment|risk|experiment", "id": 123}]}. Contenus : {{contenus}}.'),
('consensus_analysis', 'Détection consensus / controverses',
 'À partir des contenus et des votes ci-dessous, identifie en français les idées consensuelles, les sujets controversés, les sujets insuffisamment débattus et les sujets prioritaires. Réponds en JSON : {"consensus": [...], "controverses": [...], "insuffisants": [...], "prioritaires": [...]}. Contenus : {{contenus}}. Votes : {{votes}}.'),
('risk_summary', 'Synthèse d''un risque et de son débat',
 'Synthétise en français, en 4 à 6 phrases, le risque « {{risque}} » et son débat. Risque : {{risque}}. Discussion : {{commentaires}}.'),
('experiment_summary', 'Synthèse d''une expérimentation et de son débat',
 'Synthétise en français, en 4 à 6 phrases, l''expérimentation « {{experimentation}} » et son débat. Discussion : {{commentaires}}.'),
('digest_daily', 'Rédaction du digest quotidien',
 'Tu rédiges un e-mail de synthèse quotidien en français pour {{prenom}}, tenant sur une seule page à l''impression. Résume de manière claire et concise les événements de la démarche Charte Éthique IA. Événements : {{evenements}}. Commence par « Bonjour {{prenom}}, » et termine par une formule de politesse.'),
('digest_weekly', 'Rédaction du digest hebdomadaire',
 'Tu rédiges un e-mail de synthèse hebdomadaire en français pour {{prenom}}, tenant sur une seule page à l''impression. Résume de manière claire et concise les événements de la semaine de la démarche Charte Éthique IA. Événements : {{evenements}}. Commence par « Bonjour {{prenom}}, » et termine par une formule de politesse.')
ON CONFLICT (action_key) DO NOTHING;
