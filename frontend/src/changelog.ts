/**
 * Journal des versions (« Nouveautés »). Source unique affichée dans l'application.
 *
 * Convention :
 *   - x (mineure) : nouvelle fonctionnalité ou module  → 1.x.0
 *   - y (correctif) : correction ou amélioration sans nouveau module → 1.x.y
 * Pour publier : ajouter une entrée EN TÊTE de VERSIONS, puis aligner `version` dans
 * frontend/package.json et backend/package.json. VERSION se déduit de la première entrée.
 */

export type Release = { version: string; date: string; type: 'minor' | 'patch'; title: string; items: string[] };

export const VERSIONS: Release[] = [
  {
    version: '1.2.0', date: '2026-11-12', type: 'minor', title: 'Citer quelqu\'un avec @',
    items: [
      "Dans le Mur et dans les commentaires, tapez @ puis un nom pour citer un collègue : il est prévenu.",
      "Les administrateurs et IAnimateurs peuvent écrire @tout le monde pour prévenir tous les utilisateurs.",
    ],
  },
  {
    version: '1.1.0', date: '2026-11-12', type: 'minor', title: 'Pastilles de nouveautés dans le menu',
    items: [
      "Chaque rubrique du menu affiche une pastille avec le nombre de nouveautés depuis votre dernière visite (messages du Mur, ressources, expérimentations, risques, votes).",
      "Les administrateurs voient sur Admin le nombre de demandes du backlog en attente.",
    ],
  },

  {
    version: '1.0.0', date: '2026-11-12', type: 'minor', title: 'Première version',
    items: [
      "Base documentaire, expérimentations, risques, votes et cartographie de la Charte éthique de l'IA.",
      "Connexion avec le compte de la Ville ; rôles IAmbassadeur, IA.Éclaireur, IAnimateur et administrateur.",
      "Annuaire des IAmbassadeurs, gamification et application installable sur mobile.",
      "Le Mur de l'IA : un espace d'échange libre, avec citations et réactions par smileys.",
      "Nouveautés : numéro de version, journal des versions, signalement de bugs et idées d'évolution.",
      "Annonces : bandeau ou fenêtre d'information à l'ouverture, que chacun peut masquer.",
      "Cartographie et Analyse réservées aux administrateurs et aux IAnimateurs.",
    ],
  },
];

/** Version courante : celle de l'entrée la plus récente. */
export const VERSION = VERSIONS[0].version;
