-- 015_wall.sql — Le Mur de l'IA : espace d'échange libre (forum à fil unique).

CREATE TABLE IF NOT EXISTS charte_ia.wall_posts (
  id          SERIAL PRIMARY KEY,
  author_id   INTEGER REFERENCES charte_ia.users(id) ON DELETE SET NULL,
  body        TEXT        NOT NULL,
  quote_id    INTEGER REFERENCES charte_ia.wall_posts(id) ON DELETE SET NULL,  -- message cité
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at   TIMESTAMPTZ,
  deleted_at  TIMESTAMPTZ                                                      -- suppression logique : une citation reste lisible
);
CREATE INDEX IF NOT EXISTS idx_wall_posts_feed ON charte_ia.wall_posts(id DESC) WHERE deleted_at IS NULL;

-- Réactions « à la Teams » : un emoji par utilisateur et par message (cliquer à nouveau le retire).
CREATE TABLE IF NOT EXISTS charte_ia.wall_reactions (
  post_id     INTEGER NOT NULL REFERENCES charte_ia.wall_posts(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES charte_ia.users(id) ON DELETE CASCADE,
  emoji       VARCHAR(16) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id, emoji)
);
