-- 004_themes.sql — Groupes thématiques attribuables par module.
-- Trois nomenclatures distinctes selon le type de contenu (scope) :
--   resource   → base documentaire (apprentissage de l'IA)
--   experiment → expérimentations (finalité métier / nature technique)
--   risk       → risques IA (nature du risque)

CREATE TABLE IF NOT EXISTS charte_ia.themes (
  id            SERIAL PRIMARY KEY,
  scope         VARCHAR(20) NOT NULL CHECK (scope IN ('resource','experiment','risk')),
  slug          VARCHAR(60) NOT NULL UNIQUE,
  label         VARCHAR(120) NOT NULL,
  group_label   VARCHAR(60),
  group_position SMALLINT NOT NULL DEFAULT 0,
  position      SMALLINT NOT NULL DEFAULT 0,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_themes_scope ON charte_ia.themes(scope, active);

CREATE TABLE IF NOT EXISTS charte_ia.entity_themes (
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('resource','experiment','risk')),
  entity_id   INTEGER NOT NULL,
  theme_id    INTEGER NOT NULL REFERENCES charte_ia.themes(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_type, entity_id, theme_id)
);
CREATE INDEX IF NOT EXISTS idx_entity_themes_entity ON charte_ia.entity_themes(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_themes_theme ON charte_ia.entity_themes(theme_id);

-- ── Nomenclature « base documentaire » (6 catégories apprenantes) ──
INSERT INTO charte_ia.themes (scope, slug, label, group_label, group_position, position) VALUES
  ('resource', 'comprendre-ia',                 'Comprendre l''IA',                          NULL, 0, 1),
  ('resource', 'monter-en-competences',         'Monter en compétences',                     NULL, 0, 2),
  ('resource', 'actualite-veille',              'Suivre l''actualité',                       NULL, 0, 3),
  ('resource', 'enjeux-societe-ethique',        'Enjeux de société & éthique',               NULL, 0, 4),
  ('resource', 'cadre-juridique-donnees-securite','Cadre juridique, données & sécurité',     NULL, 0, 5),
  ('resource', 'retours-experience',            'Retours d''expérience & cas concrets',      NULL, 0, 6)
ON CONFLICT (slug) DO NOTHING;

-- ── Nomenclature « expérimentations » (finalité métier / nature technique) ──
INSERT INTO charte_ia.themes (scope, slug, label, group_label, group_position, position) VALUES
  ('experiment', 'exp-accueil-usagers',        'Accueil & relation aux usagers',           'Finalité métier', 1, 1),
  ('experiment', 'exp-gestion-documentaire',   'Gestion documentaire & rédaction',         'Finalité métier', 1, 2),
  ('experiment', 'exp-ressources-humaines',    'Ressources humaines & organisation',       'Finalité métier', 1, 3),
  ('experiment', 'exp-action-sociale',         'Action sociale & solidarités',             'Finalité métier', 1, 4),
  ('experiment', 'exp-education-enfance',      'Éducation, enfance & jeunesse',            'Finalité métier', 1, 5),
  ('experiment', 'exp-communication',          'Communication & information publique',     'Finalité métier', 1, 6),
  ('experiment', 'exp-proprete-voirie',        'Propreté, voirie & cadre de vie',          'Finalité métier', 1, 7),
  ('experiment', 'exp-democratie-participation','Démocratie locale & participation',       'Finalité métier', 1, 8),
  ('experiment', 'exp-traitement-langage',     'Traitement du langage (LLM)',              'Nature technique', 2, 1),
  ('experiment', 'exp-vision-images',          'Vision & analyse d''images/vidéos',        'Nature technique', 2, 2),
  ('experiment', 'exp-aide-decision-donnees',  'Aide à la décision & analyse de données',  'Nature technique', 2, 3),
  ('experiment', 'exp-automatisation-taches',  'Automatisation de tâches répétitives',     'Nature technique', 2, 4)
ON CONFLICT (slug) DO NOTHING;

-- ── Nomenclature « risques » (nature du risque) ──
INSERT INTO charte_ia.themes (scope, slug, label, group_label, group_position, position) VALUES
  ('risk', 'risk-biais-discrimination',     'Biais & discrimination',                    NULL, 0, 1),
  ('risk', 'risk-protection-donnees',       'Protection des données & vie privée',       NULL, 0, 2),
  ('risk', 'risk-securite-fuite',           'Sécurité & fuite de données',               NULL, 0, 3),
  ('risk', 'risk-opacite-explicabilite',    'Opacité & défaut d''explicabilité',         NULL, 0, 4),
  ('risk', 'risk-decision-automatisee',     'Décision automatisée & perte de maîtrise',  NULL, 0, 5),
  ('risk', 'risk-surveillance-libertes',    'Surveillance & libertés publiques',         NULL, 0, 6),
  ('risk', 'risk-desinformation',           'Désinformation & manipulation',             NULL, 0, 7),
  ('risk', 'risk-deshumanisation',          'Déshumanisation du service public',         NULL, 0, 8),
  ('risk', 'risk-exclusion-numerique',      'Exclusion & fracture numérique',            NULL, 0, 9),
  ('risk', 'risk-dependance-souverainete',  'Dépendance & souveraineté',                 NULL, 0, 10),
  ('risk', 'risk-fiabilite-erreurs',        'Fiabilité & erreurs',                       NULL, 0, 11),
  ('risk', 'risk-impact-environnemental',   'Impact environnemental',                    NULL, 0, 12),
  ('risk', 'risk-responsabilite-juridique', 'Responsabilité juridique',                  NULL, 0, 13),
  ('risk', 'risk-detournement-usage',       'Détournement d''usage',                     NULL, 0, 14)
ON CONFLICT (slug) DO NOTHING;
