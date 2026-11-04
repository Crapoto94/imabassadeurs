-- 009_contribution_fields.sql — champs complémentaires facultatifs des contributions.
-- Tous nullables : aucun remplissage rétroactif nécessaire.

-- Ressources documentaires
ALTER TABLE charte_ia.resources
  ADD COLUMN IF NOT EXISTS source VARCHAR(300),
  ADD COLUMN IF NOT EXISTS published_at DATE,
  ADD COLUMN IF NOT EXISTS content_type VARCHAR(30),
  ADD COLUMN IF NOT EXISTS reading_effort VARCHAR(20),
  ADD COLUMN IF NOT EXISTS related_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS related_id INTEGER;

-- Expérimentations
ALTER TABLE charte_ia.experiments
  ADD COLUMN IF NOT EXISTS owner_service VARCHAR(200),
  ADD COLUMN IF NOT EXISTS ai_tool VARCHAR(200),
  ADD COLUMN IF NOT EXISTS ai_hosting VARCHAR(100),
  ADD COLUMN IF NOT EXISTS personal_data BOOLEAN,
  ADD COLUMN IF NOT EXISTS expected_benefits TEXT,
  ADD COLUMN IF NOT EXISTS feedback TEXT,
  ADD COLUMN IF NOT EXISTS related_risk_id INTEGER REFERENCES charte_ia.risks(id) ON DELETE SET NULL;

-- Risques
ALTER TABLE charte_ia.risks
  ADD COLUMN IF NOT EXISTS mitigation TEXT,
  ADD COLUMN IF NOT EXISTS affected_data TEXT,
  ADD COLUMN IF NOT EXISTS related_experiment_id INTEGER REFERENCES charte_ia.experiments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_ref TEXT;

-- Votes
ALTER TABLE charte_ia.vote_sessions
  ADD COLUMN IF NOT EXISTS context TEXT;
ALTER TABLE charte_ia.vote_options
  ADD COLUMN IF NOT EXISTS justification TEXT;

-- Commentaires
ALTER TABLE charte_ia.comments
  ADD COLUMN IF NOT EXISTS source_ref VARCHAR(500);
