import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { getGamificationMe } from '../api/endpoints';
import type { GamificationSummary } from '../types';

// Progression gamifiée partagée (points, niveau, badges), chargée une seule fois
// pour toute l'application authentifiée. `refresh()` est rappelé après une contribution.
interface GamificationContextValue {
  summary: GamificationSummary | null;
  refresh: () => Promise<void>;
}

const GamificationContext = createContext<GamificationContextValue>(null as any);

export function GamificationProvider({ children }: { children: ReactNode }) {
  const [summary, setSummary] = useState<GamificationSummary | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSummary(await getGamificationMe());
    } catch {
      // silencieux : la gamification ne doit jamais bloquer l'usage du site
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo(() => ({ summary, refresh }), [summary, refresh]);
  return <GamificationContext.Provider value={value}>{children}</GamificationContext.Provider>;
}

export const useGamification = () => useContext(GamificationContext);
