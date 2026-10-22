-- 007_experiment_attachments.sql — Pièces jointes (documents) d'une expérimentation.
-- Mêmes contraintes que la base documentaire : PDF, 5 Mo max, stockés dans backend/uploads.

CREATE TABLE IF NOT EXISTS charte_ia.experiment_attachments (
  id            SERIAL PRIMARY KEY,
  experiment_id INTEGER NOT NULL REFERENCES charte_ia.experiments(id) ON DELETE CASCADE,
  file_path     TEXT NOT NULL,
  original_name VARCHAR(300) NOT NULL,
  mime_type     VARCHAR(100),
  size_bytes    INTEGER,
  uploaded_by   INTEGER NOT NULL REFERENCES charte_ia.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_experiment_attachments_exp ON charte_ia.experiment_attachments(experiment_id);
