-- 020_resource_video.sql — ressources vidéo (lien externe + miniature téléversée).

ALTER TABLE charte_ia.resources DROP CONSTRAINT IF EXISTS resources_kind_check;
ALTER TABLE charte_ia.resources
  ADD CONSTRAINT resources_kind_check CHECK (kind IN ('pdf', 'link', 'presentation', 'video'));

ALTER TABLE charte_ia.resources
  ADD COLUMN IF NOT EXISTS thumbnail_path VARCHAR(300);
