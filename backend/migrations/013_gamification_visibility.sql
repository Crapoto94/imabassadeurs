-- 010_gamification_visibility.sql — Visibilité et ajustement de la gamification.
-- gamification_hidden : masque l'affichage pour un utilisateur donné (admin).
-- gamification_points_adjustment : ajustement (delta) ajouté au total calculé (tests admin).

ALTER TABLE charte_ia.users
  ADD COLUMN IF NOT EXISTS gamification_hidden BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gamification_points_adjustment INTEGER NOT NULL DEFAULT 0;
