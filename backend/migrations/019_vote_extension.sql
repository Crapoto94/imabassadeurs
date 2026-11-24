-- 019_vote_extension.sql — date de prolongation facultative d'une session de vote.

ALTER TABLE charte_ia.vote_sessions
  ADD COLUMN IF NOT EXISTS extended_closes_at TIMESTAMPTZ;
