-- 016_section_visits.sql — Dernière visite de chaque utilisateur par rubrique (pastilles « nouveau » du menu).
CREATE TABLE IF NOT EXISTS charte_ia.user_section_visits (
  user_id  INTEGER NOT NULL REFERENCES charte_ia.users(id) ON DELETE CASCADE,
  section  VARCHAR(20) NOT NULL,
  seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, section)
);
