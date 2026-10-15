import { useMemo } from 'react';
import type { Theme } from '../types';

// Sélecteur multi-thèmes (chips), groupé par group_label si présent.
export function ThemePicker({ themes, value, onChange, empty }: {
  themes: Theme[]; value: number[]; onChange: (ids: number[]) => void; empty?: string;
}) {
  const groups = useMemo(() => {
    const m = new Map<string, Theme[]>();
    for (const t of themes) {
      const k = t.group_label || '';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    }
    return [...m.entries()];
  }, [themes]);

  if (!themes.length) {
    return empty ? <p className="font-body text-body-sm text-outline italic">{empty}</p> : null;
  }

  const toggle = (id: number) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div className="space-y-3">
      {groups.map(([group, list]) => (
        <div key={group || '_'}>
          {group && <div className="font-headline text-label-sm text-outline uppercase tracking-wider mb-1.5">{group}</div>}
          <div className="flex flex-wrap gap-1.5">
            {list.map((t) => {
              const on = value.includes(t.id);
              return (
                <button
                  key={t.id} type="button" onClick={() => toggle(t.id)} aria-pressed={on}
                  className={`px-2.5 py-1 rounded-full font-headline text-label-sm border transition-colors ${
                    on
                      ? 'bg-secondary text-on-secondary border-secondary'
                      : 'bg-surface-container-low text-on-surface-variant border-transparent hover:bg-surface-container'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// Affichage (lecture seule) des thèmes d'un contenu.
export function ThemeChips({ themes, className = '' }: { themes?: Theme[]; className?: string }) {
  if (!themes?.length) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {themes.map((t) => (
        <span key={t.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-headline text-label-sm">
          <span className="material-symbols-outlined text-[13px] text-secondary">sell</span>
          {t.label}
        </span>
      ))}
    </div>
  );
}
