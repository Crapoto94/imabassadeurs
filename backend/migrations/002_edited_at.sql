-- 002_edited_at.sql — Suivi de la dernière modification des contributions
-- Permet d'afficher discrètement qu'une contribution a été éditée (et quand),
-- notamment pour les corrections de coquilles après validation.

ALTER TABLE charte_ia.resources   ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE charte_ia.experiments ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE charte_ia.risks       ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
