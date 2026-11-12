-- 014_backlog_announcements.sql — Backlog (bugs / idées) et annonces (bandeau / modale d'ouverture).

-- Demandes des utilisateurs : bug signalé ou idée d'évolution, traitées par les admins.
CREATE TABLE IF NOT EXISTS charte_ia.backlog_items (
  id           SERIAL PRIMARY KEY,
  type         VARCHAR(12)  NOT NULL CHECK (type IN ('bug', 'evolution')),
  title        VARCHAR(200) NOT NULL,
  description  TEXT         NOT NULL,
  app_version  VARCHAR(20),
  status       VARCHAR(12)  NOT NULL DEFAULT 'demandee'
               CHECK (status IN ('demandee', 'acceptee', 'refusee', 'realisee')),
  reason       TEXT,                                   -- motif (obligatoire pour un refus)
  author_id    INTEGER REFERENCES charte_ia.users(id) ON DELETE SET NULL,
  treated_by   INTEGER REFERENCES charte_ia.users(id) ON DELETE SET NULL,
  treated_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_backlog_status ON charte_ia.backlog_items(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backlog_author ON charte_ia.backlog_items(author_id);

-- Annonces affichées à tous entre deux dates : bandeau défilant ou modale à l'ouverture.
CREATE TABLE IF NOT EXISTS charte_ia.announcements (
  id          SERIAL PRIMARY KEY,
  kind        VARCHAR(10)  NOT NULL CHECK (kind IN ('bandeau', 'modale')),
  title       VARCHAR(120),
  message     TEXT         NOT NULL,
  starts_at   TIMESTAMPTZ  NOT NULL,
  ends_at     TIMESTAMPTZ  NOT NULL,
  active      BOOLEAN      NOT NULL DEFAULT true,       -- interrupteur : jamais affichée si false
  created_by  INTEGER REFERENCES charte_ia.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_announcements_window ON charte_ia.announcements(starts_at, ends_at);

-- Annonces que l'utilisateur a choisi de ne plus voir.
CREATE TABLE IF NOT EXISTS charte_ia.announcement_dismissals (
  user_id          INTEGER NOT NULL REFERENCES charte_ia.users(id) ON DELETE CASCADE,
  announcement_id  INTEGER NOT NULL REFERENCES charte_ia.announcements(id) ON DELETE CASCADE,
  dismissed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, announcement_id)
);
