import { useEffect, useState } from 'react';
import { User as UserIcon, Bell } from 'lucide-react';
import { Card, PageTitle, Spinner, Alert, Badge, Select, Field } from '../components/ui';
import { getAccount, setPreference } from '../api/endpoints';
import { errMsg } from '../api/client';

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'app', label: 'L’application en elle-même (annonces générales)' },
  { key: 'comment_replies', label: 'Une réponse à l’un de mes commentaires' },
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
  const [data, setData] = useState<{ user: any; preferences: Record<string, string> } | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  async function load() { try { setData(await getAccount()); } catch (e) { setError(errMsg(e)); } }
  useEffect(() => { load(); }, []);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!data) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <div>
      <PageTitle title="Mon compte" subtitle="Vos informations et vos préférences de notification." />
      <Card className="mb-6 p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold"><UserIcon size={16} /> Informations</h2>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div><span className="text-slate-500">Nom :</span> {data.user.display_name}</div>
          <div><span className="text-slate-500">Identifiant :</span> {data.user.ad_username}</div>
          <div><span className="text-slate-500">Email :</span> {data.user.email || '—'}</div>
          <div><span className="text-slate-500">Direction :</span> {data.user.direction || '—'}</div>
          <div><span className="text-slate-500">Service :</span> {data.user.service || '—'}</div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Rôles :</span>
            {data.user.roles?.length ? data.user.roles.map((r: string) => <Badge key={r} color="blue">{r}</Badge>) : <Badge>Lecteur</Badge>}
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-400">Les rôles sont gérés par les administrateurs depuis le module Admin.</p>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold"><Bell size={16} /> Préférences de notification</h2>
        <div className="space-y-4">
          {CATEGORIES.map((c) => (
            <div key={c.key} className="grid items-center gap-2 sm:grid-cols-2">
              <span className="text-sm text-slate-700">{c.label}</span>
              <Select value={data.preferences[c.key] || 'daily'} onChange={async (e) => {
                try { const prefs = await setPreference(c.key, e.target.value); setData({ ...data, preferences: prefs }); setSaved(c.key); }
                catch (err) { setError(errMsg(err)); }
              }}>
                {FREQUENCIES.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </Select>
            </div>
          ))}
        </div>
        {saved && <p className="mt-3 text-sm text-emerald-600">Préférence enregistrée.</p>}
      </Card>
    </div>
  );
}
