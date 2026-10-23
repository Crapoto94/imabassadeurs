-- 008_users_case_insensitive.sql — Un seul compte par agent, quelle que soit la casse.
-- L'AD est insensible à la casse : l'unicité applicative de ad_username doit l'être aussi.
-- L'index n'est créé que s'il n'existe pas de doublons, pour ne jamais bloquer un
-- démarrage. Les doublons existants se nettoient avec scripts/merge-duplicate-users.js.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM (
      SELECT lower(ad_username) AS k
        FROM charte_ia.users
       GROUP BY lower(ad_username)
      HAVING count(*) > 1
    ) d
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_users_ad_username_lower ON charte_ia.users (lower(ad_username))';
  ELSE
    RAISE NOTICE 'Doublons d''ad_username détectés : index unique non créé. Lancer scripts/merge-duplicate-users.js.';
  END IF;
END $$;
