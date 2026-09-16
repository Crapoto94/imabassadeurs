import { FormEvent, useEffect, useState } from 'react';
import { Settings, Users, Sparkles, ScrollText, Save, Play } from 'lucide-react';
import { Card, PageTitle, Field, Input, Textarea, Select, Button, Badge, Spinner, Alert } from '../components/ui';
import { getAiModels, getAudit, getPrompts, getSettings, getUsers, grantRole, revokeRole, testPrompt, updatePrompt, updateSettings } from '../api/endpoints';
import { errMsg } from '../api/client';
import type { AiResult } from '../types';

const ROLES = ['admin', 'iambassadeur', 'iaeclaireur', 'ianimateur'];
const TABS = [
  { key: 'settings', label: 'Paramètres', icon: Settings },
  { key: 'users', label: 'Utilisateurs & rôles', icon: Users },
  { key: 'prompts', label: 'Prompts IA', icon: Sparkles },
  { key: 'audit', label: 'Journal d’audit', icon: ScrollText },
];

export default function Admin() {
  const [tab, setTab] = useState('settings');
  return (
    <div>
      <PageTitle title="Administration" subtitle="Paramètres techniques, comptes, prompts IA et audit." />
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${tab === key ? 'bg-ville-500 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>
      {tab === 'settings' && <SettingsTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'prompts' && <PromptsTab />}
      {tab === 'audit' && <AuditTab />}
    </div>
  );
}

function SettingsTab() {
  const [s, setS] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { getSettings().then(setS).catch((e) => setError(errMsg(e))); }, []);
  if (!s) return <div className="flex justify-center py-8"><Spinner /></div>;
  async function save(e: FormEvent) {
    e.preventDefault(); setError(''); setSaved(false);
    try { await updateSettings(s); setSaved(true); } catch (err) { setError(errMsg(err)); }
  }
  return (
    <Card className="p-5">
      <form onSubmit={save} className="space-y-4">
        <Field label="Nom de l’organisation"><Input value={s.org_name || ''} onChange={(e) => setS({ ...s, org_name: e.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Pied de page 1"><Input value={s.footer_line1 || ''} onChange={(e) => setS({ ...s, footer_line1: e.target.value })} /></Field>
          <Field label="Pied de page 2"><Input value={s.footer_line2 || ''} onChange={(e) => setS({ ...s, footer_line2: e.target.value })} /></Field>
          <Field label="Pied de page 3"><Input value={s.footer_line3 || ''} onChange={(e) => setS({ ...s, footer_line3: e.target.value })} /></Field>
        </div>
        <Field label="Couleur du pied de page"><Input type="color" value={s.footer_color || '#0055A4'} onChange={(e) => setS({ ...s, footer_color: e.target.value })} /></Field>
        {error && <Alert kind="error">{error}</Alert>}
        {saved && <Alert kind="success">Paramètres enregistrés.</Alert>}
        <Button type="submit"><Save size={16} /> Enregistrer</Button>
      </form>
    </Card>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  async function load() { try { setUsers(await getUsers({ search: search || undefined })); } catch (e) { setError(errMsg(e)); } }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [search]);
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-end gap-2">
        <Field label="Rechercher"><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom ou identifiant" /></Field>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      <div className="space-y-3">
        {users.map((u) => (
          <div key={u.id} className="rounded-lg border border-slate-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium">{u.display_name} <span className="text-xs text-slate-400">({u.ad_username})</span></div>
                <div className="text-xs text-slate-500">{u.direction || '—'} · {u.service || '—'} · {u.email || '—'}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((role) => {
                  const has = u.roles?.includes(role);
                  return (
                    <button key={role} onClick={async () => { has ? await revokeRole(u.id, role) : await grantRole(u.id, role); load(); }}
                      className={`rounded-full px-2.5 py-0.5 text-xs ${has ? 'bg-ville-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {role}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
        {users.length === 0 && <p className="text-sm text-slate-400">Aucun utilisateur.</p>}
      </div>
    </Card>
  );
}

function PromptsTab() {
  const [prompts, setPrompts] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [test, setTest] = useState<Record<string, AiResult | undefined>>({});
  useEffect(() => {
    getPrompts().then(setPrompts).catch((e) => setError(errMsg(e)));
    getAiModels().then((d) => setModels(Array.isArray(d) ? d : [])).catch(() => setModels([]));
  }, []);
  function update(key: string, patch: any) { setPrompts((ps) => ps.map((p) => p.action_key === key ? { ...p, ...patch } : p)); }
  return (
    <div className="space-y-4">
      {error && <Alert kind="error">{error}</Alert>}
      <Alert kind="info">Le modèle préférentiel est optionnel : laissé vide, le modèle par défaut de l’APM est utilisé.</Alert>
      {prompts.map((p) => (
        <Card key={p.action_key} className="p-5">
          <div className="mb-2 flex items-center justify-between"><Badge color="purple">{p.action_key}</Badge></div>
          <div className="space-y-3">
            <Field label="Libellé"><Input value={p.label} onChange={(e) => update(p.action_key, { label: e.target.value })} /></Field>
            <Field label="Gabarit du prompt (variables {{...}})"><Textarea rows={5} value={p.prompt_template} onChange={(e) => update(p.action_key, { prompt_template: e.target.value })} /></Field>
            <Field label="Modèle préférentiel">
              <Select value={p.preferred_model || ''} onChange={(e) => update(p.action_key, { preferred_model: e.target.value || null })}>
                <option value="">Modèle par défaut APM</option>
                {models.map((m) => <option key={m.id} value={m.id}>{m.provider_label || m.provider} — {m.name}{m.active === false ? ' (inactif)' : ''}</option>)}
              </Select>
            </Field>
            <div className="flex gap-2">
              <Button onClick={async () => { await updatePrompt(p.action_key, p); }}><Save size={16} /> Enregistrer</Button>
              <Button variant="secondary" onClick={async () => {
                try { const r = await testPrompt(p.action_key, {}); setTest((t) => ({ ...t, [p.action_key]: r })); }
                catch (e) { setError(errMsg(e)); }
              }}><Play size={16} /> Tester</Button>
            </div>
            {test[p.action_key] && (
              <Alert kind="success">{test[p.action_key]!.response}</Alert>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

function AuditTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { getAudit({ limit: 100 }).then(setRows).catch((e) => setError(errMsg(e))); }, []);
  return (
    <Card className="p-5">
      {error && <Alert kind="error">{error}</Alert>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <th className="px-2 py-2">Date</th><th className="px-2 py-2">Utilisateur</th><th className="px-2 py-2">Action</th><th className="px-2 py-2">Entité</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="px-2 py-2">{new Date(r.created_at).toLocaleString('fr-FR')}</td>
                <td className="px-2 py-2">{r.user_name || '—'}</td>
                <td className="px-2 py-2">{r.action}</td>
                <td className="px-2 py-2">{r.entity_type || '—'} {r.entity_id ? `#${r.entity_id}` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
