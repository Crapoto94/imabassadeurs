-- 015_resources_kind_length.sql — 'presentation' dépasse VARCHAR(10).
ALTER TABLE charte_ia.resources ALTER COLUMN kind TYPE VARCHAR(20);
