-- 018_mail_log.sql — journal des e-mails envoyés (consultable par les administrateurs uniquement).

CREATE TABLE IF NOT EXISTS charte_ia.mail_log (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES charte_ia.users(id) ON DELETE SET NULL,
  recipient   VARCHAR(200) NOT NULL,
  subject     VARCHAR(300) NOT NULL,
  kind        VARCHAR(20)  NOT NULL,   -- instant | daily | weekly | test
  body        TEXT,
  status      VARCHAR(10)  NOT NULL CHECK (status IN ('sent','error')),
  error       TEXT,
  duration_ms INTEGER,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mail_log_created ON charte_ia.mail_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mail_log_user ON charte_ia.mail_log(user_id, created_at DESC);
