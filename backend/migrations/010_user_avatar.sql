-- 010_user_avatar.sql — photo / avatar facultatif des utilisateurs (image réduite côté client).
ALTER TABLE charte_ia.users
  ADD COLUMN IF NOT EXISTS avatar BYTEA,
  ADD COLUMN IF NOT EXISTS avatar_mime VARCHAR(20),
  ADD COLUMN IF NOT EXISTS avatar_updated_at TIMESTAMPTZ;
