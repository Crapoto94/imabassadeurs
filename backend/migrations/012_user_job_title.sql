-- 012_user_job_title.sql — fonction de l'agent (attribut AD « title »), affichée dans l'annuaire.
ALTER TABLE charte_ia.users ADD COLUMN IF NOT EXISTS job_title VARCHAR(200);
