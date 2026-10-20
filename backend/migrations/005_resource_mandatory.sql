-- Tag « obligatoire » sur les ressources documentaires (réservé au compte Admin).
ALTER TABLE charte_ia.resources
  ADD COLUMN IF NOT EXISTS is_mandatory BOOLEAN NOT NULL DEFAULT false;
