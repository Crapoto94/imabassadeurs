import { useEffect, useMemo, useState } from 'react';
import { getAmbassadors } from '../api/endpoints';
import { errMsg } from '../api/client';
import { Avatar, RoleBadge, SectionCard, StitchAlert, StitchEmpty, StitchInput, StitchSpinner } from '../components/stitch';
import type { Ambassador } from '../types';

const ROLE_FILTERS: { key: string; label: string }[] = [
  { key: '', label: 'Tous' },
  { key: 'iambassadeur', label: 'IAmbassadeurs' },
  { key: 'iaeclaireur', label: 'IA.Éclaireurs' },
  { key: 'ianimateur', label: 'IAnimateurs' },
];

// Annuaire des IAmbassadeurs : photo, direction / service et petit mot.
export default function Ambassadors() {
  const [list, setList] = useState<Ambassador[] | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');

  useEffect(() => { getAmbassadors().then(setList).catch((e) => setError(errMsg(e))); }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (list || []).filter((a) =>
      (!role || a.roles.includes(role as any)) &&
      (!needle || [a.display_name, a.direction, a.service, a.bio].some((v) => (v || '').toLowerCase().includes(needle)))
    );
  }, [list, q, role]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="font-headline text-headline-lg-mobile lg:text-headline-lg text-primary tracking-tight">Les IAmbassadeurs</h1>
        <p className="mt-1 font-body text-body-md text-on-surface-variant">
          {list ? `${list.length} agent${list.length > 1 ? 's' : ''}` : 'Chargement…'} engagé{list && list.length > 1 ? 's' : ''} dans la co-construction de la Charte.
        </p>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="sm:w-80">
          <StitchInput type="search" placeholder="Rechercher un nom, un service, un mot…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ROLE_FILTERS.map((f) => (
            <button
              key={f.key} type="button" onClick={() => setRole(f.key)}
              className={`px-3 py-1.5 rounded-full font-headline text-label-md transition-colors ${
                role === f.key ? 'bg-primary-container text-on-primary-container font-bold' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <StitchAlert kind="error">{error}</StitchAlert>}
      {!list && !error && <div className="flex justify-center py-12"><StitchSpinner /></div>}
      {list && shown.length === 0 && <StitchEmpty icon="groups">Aucun IAmbassadeur ne correspond à cette recherche.</StitchEmpty>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {shown.map((a) => (
          <SectionCard key={a.id} className="p-5 flex gap-4 items-start">
            <Avatar name={a.display_name} size={64} userId={a.id} v={a.avatar_v} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <h2 className="font-headline text-headline-sm text-on-surface break-words">{a.display_name}</h2>
              {(a.direction || a.service) && (
                <p className="font-body text-body-sm text-on-surface-variant break-words">
                  {[a.direction, a.service].filter(Boolean).join(' · ')}
                </p>
              )}
              <div className="flex flex-wrap gap-1">{a.roles.map((r) => <RoleBadge key={r} role={r} />)}</div>
              {a.bio && <p className="pt-1 font-body text-body-md text-on-surface italic break-words">« {a.bio} »</p>}
            </div>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
