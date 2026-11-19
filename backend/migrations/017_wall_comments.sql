-- 017_wall_comments.sql — commentaires rattachés aux messages du Mur (affichage « à la Facebook »).

CREATE TABLE IF NOT EXISTS charte_ia.wall_comments (
  id          SERIAL PRIMARY KEY,
  post_id     INTEGER NOT NULL REFERENCES charte_ia.wall_posts(id) ON DELETE CASCADE,
  author_id   INTEGER REFERENCES charte_ia.users(id) ON DELETE SET NULL,
  body        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at   TIMESTAMPTZ,
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_wall_comments_post ON charte_ia.wall_comments(post_id, id) WHERE deleted_at IS NULL;
