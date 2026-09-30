import { useEffect, useState } from 'react';
import { getAccount, setPreference } from '../api/endpoints';
import { errMsg } from '../api/client';
import {
  Avatar, RoleBadge, SectionCard, StitchAlert, StitchSelect, StitchSpinner, useToast,
} from '../components/stitch';

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'app', label: "L'application en elle-même (annonces générales)" },
  { key: 'comment_replies', label: "Une réponse à l'un de mes commentaires" },
  { key: 'resources', label: 'Le module Ressources' },
  { key: 'risks', label: 'Le module Risques' },
  { key: 'my_experiments', label: 'Mes expérimentations' },
  { key: 'other_experiments', label: 'Les autres expérimentations' },
];
const FREQUENCIES = [
  { key: 'instant', label: 'À chaque nouveauté' },
  { key: 'daily', label: 'Résumé quotidien' },
  { key: 'weekly', label: 'Résumé hebdomadaire' },
  { key: 'never', label: 'Jamais' },
];

export default function Account() {
  const { show, Toast } = useToast();
  const [data, setData] = useState<{ user: any; preferences: Record<string, string> } | null>(null);
  const [error, setError] = useState('');

  async function load() { try { setData(await getAccount()); } catch (e) { setError(errMsg(e)); } }
  useEffect(() => { load(); }, []);

  if (error) return <div className="max-w-7xl mx-auto px-4 py-8"><StitchAlert kind="error">{error}</StitchAlert></div>;
  if (!data) return <div className="flex justify-center py-12"><StitchSpinner /></div>;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 lg:px-8 py-8">
      {Toast}
      <div className="mb-6">
        <h1 className="font-headline text-headline-lg-mobile lg:text-headline-lg text-primary tracking-tight">Mon compte</h1>
        <p className="mt-1 font-body text-body-md text-on-surface-variant">Vos informations et vos préférences de notification.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Profil */}
        <SectionCard className="lg:col-span-4 p-6 flex flex-col items-center text-center gap-4">
          <Avatar name={data.user.display_name} size={80} />
          <div>
            <h2 className="font-headline text-headline-md text-on-surface">{data.user.display_name}</h2>
            <p className="font-body text-body-sm text-on-surface-variant">{data.user.email || data.user.ad_username}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {data.user.roles?.length
              ? data.user.roles.map((r: string) => <RoleBadge key={r} role={r} />)
              : <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-headline text-label-sm">Lecteur</span>}
          </div>
          <p className="font-body text-body-sm text-outline">Les rôles sont gérés par les administrateurs depuis le module Admin.</p>
        </SectionCard>

        {/* Informations */}
        <div className="lg:col-span-8 space-y-6">
          <SectionCard className="p-6">
            <h2 className="mb-4 font-headline text-headline-sm text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">person</span>
              Informations
            </h2>
            <dl className="grid gap-x-6 gap-y-3 font-body text-body-md sm:grid-cols-2">
              {[
                { label: 'Identifiant', value: data.user.ad_username },
                { label: 'Email', value: data.user.email || '—' },
                { label: 'Direction', value: data.user.direction || '—' },
                { label: 'Service', value: data.user.service || '—' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-surface-container-low rounded-xl px-4 py-3">
                  <dt className="font-headline text-label-sm text-outline uppercase tracking-wider">{label}</dt>
                  <dd className="text-on-surface mt-0.5">{value}</dd>
                </div>
              ))}
            </dl>
          </SectionCard>

          <SectionCard className="p-6">
            <h2 className="mb-1 font-headline text-headline-sm text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              Préférences de notification
            </h2>
            <p className="mb-5 font-body text-body-sm text-on-surface-variant">
              Choisissez la fréquence à laquelle vous souhaitez être notifié pour chaque type d'activité.
            </p>
            <div className="space-y-4">
              {CATEGORIES.map((c) => (
                <div key={c.key} className="grid items-center gap-2 sm:grid-cols-2">
                  <span className="font-body text-body-md text-on-surface">{c.label}</span>
                  <StitchSelect
                    value={data.preferences[c.key] || 'daily'}
                    onChange={async (e) => {
                      try {
                        const prefs = await setPreference(c.key, e.target.value);
                        setData({ ...data, preferences: prefs });
                        show('Préférence enregistrée');
                      } catch (err) { setError(errMsg(err)); }
                    }}
                  >
                    {FREQUENCIES.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </StitchSelect>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
