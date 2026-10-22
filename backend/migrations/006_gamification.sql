-- 006_gamification.sql — Gamification de l'usage (points, niveaux, badges).
-- Progression personnelle, calculée à la volée depuis les tables existantes.
-- Seul nouvel événement tracé : la consultation d'une ressource (monter en compétence).

-- Interrupteur global de la gamification (géré côté Admin).
ALTER TABLE charte_ia.app_settings
  ADD COLUMN IF NOT EXISTS gamification_enabled BOOLEAN NOT NULL DEFAULT true;

-- Progression de lecture d'une ressource (0-100), par utilisateur.
CREATE TABLE IF NOT EXISTS charte_ia.resource_progress (
  resource_id  INTEGER NOT NULL REFERENCES charte_ia.resources(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES charte_ia.users(id) ON DELETE CASCADE,
  progress_pct SMALLINT NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (resource_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_resource_progress_user ON charte_ia.resource_progress(user_id);
