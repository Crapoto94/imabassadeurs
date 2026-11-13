-- 014_resource_presentations.sql — présentations (PowerPoint/ODP) dans la base documentaire.
-- Le fichier original est conservé ; un PDF de prévisualisation peut être généré.

ALTER TABLE charte_ia.resources DROP CONSTRAINT IF EXISTS resources_kind_check;
ALTER TABLE charte_ia.resources
  ADD CONSTRAINT resources_kind_check CHECK (kind IN ('pdf','link','presentation'));

ALTER TABLE charte_ia.resources
  ADD COLUMN IF NOT EXISTS original_name VARCHAR(300),
  ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS size_bytes INTEGER,
  ADD COLUMN IF NOT EXISTS preview_path TEXT;
