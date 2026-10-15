-- 003_resource_level.sql — Niveau de lecture des ressources de la base documentaire.
-- Attribué par le contributeur : debutant / intermediaire / avance.

ALTER TABLE charte_ia.resources
  ADD COLUMN IF NOT EXISTS level VARCHAR(20) NOT NULL DEFAULT 'debutant'
  CHECK (level IN ('debutant','intermediaire','avance'));
