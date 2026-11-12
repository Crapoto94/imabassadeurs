import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getBadges, markSectionSeen } from '../api/endpoints';
import type { BadgeCounts } from '../api/endpoints';

// Rubrique du menu correspondant à une URL (null = pas de pastille « nouveau »).
const sectionOf = (path: string): keyof BadgeCounts | null => {
  const seg = path.split('/')[1];
  switch (seg) {
    case 'ressources': return 'ressources';
    case 'experimentations': return 'experimentations';
    case 'risques': return 'risques';
    case 'votes': return 'votes';
    case 'mur': return 'mur';
    default: return null;
  }
};

const REFRESH_MS = 60_000;

// Nombre de nouveautés par rubrique depuis la dernière visite. Entrer dans une rubrique (et la quitter)
// la marque comme vue ; tant qu'on y reste, sa pastille est à zéro.
export function useBadges(): { counts: BadgeCounts; current: keyof BadgeCounts | null } {
  const { pathname } = useLocation();
  const current = sectionOf(pathname);
  const [counts, setCounts] = useState<BadgeCounts>({});

  const load = useCallback(() => { getBadges().then(setCounts).catch(() => { /* jamais bloquant */ }); }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!current) return;
    const seen = () => markSectionSeen(current).catch(() => {});
    seen();
    setCounts((c) => ({ ...c, [current]: 0 }));
    return () => { seen().then(load); };
  }, [current, load]);

  // Sur la rubrique ouverte, on ne compte pas ce qui arrive pendant la visite.
  return { counts: current ? { ...counts, [current]: 0 } : counts, current };
}
