import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  createTheme, deleteTheme, getAiModels, getAudit, getPrompts, getSettings, getThemes, getUsers,
  grantRole, revokeRole, testPrompt, updatePrompt, updateSettings, updateTheme,
} from '../api/endpoints';
import { errMsg } from '../api/client';
import {
  Avatar, GhostButton, PrimaryButton, SectionCard, StitchAlert, StitchField, StitchInput,
  StitchSelect, StitchSpinner, StitchTextarea, useToast,
} from '../components/stitch';
import type { AiResult, Theme, ThemeScope } from '../types';

const ROLES = [
  { key: 'admin', label: 'Admin' },
  { key: 'iambassadeur', label: 'IAmbassadeur' },
  { key: 'iaeclaireur', label: 'IA.Éclaireur' },
  { key: 'ianimateur', label: 'IAnimateur' },
];

const SCOPE_LABELS: Record<string, string> = {
  resource: 'Base documentaire',
  experiment: 'Expérimentations',
  risk: 'Risques',
};

type TabKey = 'users' | 'prompts' | 'themes' | 'settings' | 'audit';

export default function Admin() {
  const [tab, setTab] = useState<TabKey>('users');
  const tabs: { key: TabKey; icon: string; label: string }[] = [
    { key: 'users', icon: 'group', label: 'Utilisateurs & Rôles' },
    { key: 'prompts', icon: 'psychology', label: 'Paramétrage Prompts IA' },
    { key: 'themes', icon: 'sell', label: 'Thèmes' },
    { key: 'settings', icon: 'tune', label: 'Paramètres Généraux & Footer' },
    { key: 'audit', icon: 'receipt_long', label: "Journal d'Audit" },
  ];

  return (
    <div>
      {/* Bannière système */}
      <div className="w-full bg-surface-container-low px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-sm">
              <span className="material-symbols-outlined text-[26px]">admin_panel_settings</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-headline text-headline-lg-mobile lg:text-headline-lg text-primary tracking-tight">Console d'Administration</h1>
                <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-headline text-label-sm font-semibold tracking-wide uppercase">Accès Réservé</span>
              </div>
              <p className="font-body text-body-sm text-on-surface-variant">Direction des Systèmes d'Information • Ville d'Ivry-sur-Seine</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-surface-container-lowest rounded-xl shadow-card">
              <span className="w-2.5 h-2.5 rounded-full bg-tertiary-fixed-dim animate-pulse" />
              <div className="flex flex-col">
                <span className="font-headline text-label-sm text-outline">Passerelle AD APM</span>
                <span className="font-headline text-label-md text-on-surface font-semibold">Fédération des comptes</span>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-surface-container-lowest rounded-xl shadow-card">
              <span className="material-symbols-outlined text-primary-container text-[20px]">security</span>
              <div className="flex flex-col">
                <span className="font-headline text-label-sm text-outline">Audit Log Actif</span>
                <span className="font-headline text-label-md text-on-surface font-semibold">Traçabilité nominative</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div className="w-full bg-surface-container-lowest shadow-sm sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-1 sm:space-x-4 overflow-x-auto py-2.5" aria-label="Onglets d'administration">
            {tabs.map(({ key, icon, label }) => (
              <button
                key={key}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-headline text-label-md transition-all whitespace-nowrap ${tab === key ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm' : 'text-on-surface-variant hover:bg-surface-container'}`}
                onClick={() => setTab(key)} type="button"
              >
                <span className="material-symbols-outlined text-[18px]">{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {tab === 'users' && <UsersTab />}
        {tab === 'prompts' && <PromptsTab />}
        {tab === 'themes' && <ThemesTab />}
        {tab === 'settings' && <SettingsTab />}
        {tab === 'audit' && <AuditTab />}
      </div>
    </div>
  );
}

// ── Onglet Utilisateurs & rôles ──

function UsersTab() {
  const { show, Toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try { setUsers(await getUsers({ search: search || undefined })); }
    catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [search]);

  const filtered = useMemo(
    () => users.filter((u) => !roleFilter || u.roles?.includes(roleFilter)),
    [users, roleFilter]
  );

  async function toggle(u: any, role: string, grant: boolean) {
    try {
      if (grant) await grantRole(u.id, role); else await revokeRole(u.id, role);
      show(`${grant ? 'Rôle attribué' : 'Rôle retiré'} : ${role} → ${u.display_name}`);
      load();
    } catch (e) { setError(errMsg(e)); }
  }

  return (
    <div className="flex flex-col space-y-6">
      {Toast}
      <SectionCard className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="font-headline text-headline-md text-primary font-bold">Comptes &amp; Cumul des Rôles</h2>
          <p className="font-body text-body-sm text-on-surface-variant mt-1">
            Les comptes sont créés à la première connexion des agents. Cochez les privilèges cumulables pour actualiser leurs droits applicatifs.
          </p>
        </div>
      </SectionCard>

      <SectionCard className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        <div className="md:col-span-8 relative">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span>
          <input
            className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low rounded-xl font-body text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary/30 transition-all"
            placeholder="Rechercher par identifiant, nom d'agent, e-mail…"
            value={search} onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="md:col-span-4">
          <StitchSelect value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">Tous les rôles actifs</option>
            {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </StitchSelect>
        </div>
      </SectionCard>

      {error && <StitchAlert kind="error">{error}</StitchAlert>}

      <SectionCard className="overflow-hidden">
        {loading ? <StitchSpinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-body text-body-sm">
              <thead className="bg-surface-container text-on-surface-variant font-headline text-label-md">
                <tr>
                  <th className="py-3.5 px-4 font-semibold" scope="col">Agent</th>
                  <th className="py-3.5 px-4 font-semibold" scope="col">Direction &amp; Service</th>
                  {ROLES.map((r) => <th key={r.key} className="py-3.5 px-4 font-semibold text-center" scope="col">{r.label}</th>)}
                  <th className="py-3.5 px-4 font-semibold" scope="col">Dernière session</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container text-on-surface">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-container-low/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.display_name} size={36} />
                        <div>
                          <div className="font-headline text-headline-sm text-on-surface">{u.display_name}</div>
                          <div className="font-body text-body-sm text-outline">{u.ad_username}{u.email ? ` • ${u.email}` : ''}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-on-surface">{u.direction || '—'}</div>
                      <div className="font-body text-body-sm text-on-surface-variant">{u.service || '—'}</div>
                    </td>
                    {ROLES.map((r) => (
                      <td key={r.key} className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded accent-secondary cursor-pointer"
                          checked={u.roles?.includes(r.key) || false}
                          onChange={(e) => toggle(u, r.key, e.target.checked)}
                          aria-label={`${r.label} pour ${u.display_name}`}
                        />
                      </td>
                    ))}
                    <td className="py-3.5 px-4">
                      <span className="font-headline text-label-sm text-on-surface">
                        {u.last_login_at ? new Date(u.last_login_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Jamais connecté'}
                      </span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="py-8 text-center text-outline">Aucun utilisateur pour ces critères.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="p-4 bg-surface-container flex flex-col sm:flex-row items-center justify-between gap-3 font-body text-body-sm text-on-surface-variant">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-tertiary-container">verified_user</span>
            <span>Chaque bascule de rôle génère immédiatement une entrée d'audit nominative.</span>
          </div>
          <span className="font-headline text-label-md">{filtered.length} agent(s) affiché(s)</span>
        </div>
      </SectionCard>
    </div>
  );
}

// ── Onglet Prompts IA ──

function PromptsTab() {
  const { show, Toast } = useToast();
  const [prompts, setPrompts] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [test, setTest] = useState<Record<string, AiResult | undefined>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getPrompts(), getAiModels().catch(() => [])])
      .then(([p, m]) => {
        setPrompts(p);
        setModels(Array.isArray(m) ? m : []);
        if (p.length) setActive(p[0].action_key);
      })
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, []);

  function update(key: string, patch: any) {
    setPrompts((ps) => ps.map((p) => p.action_key === key ? { ...p, ...patch } : p));
  }

  const current = prompts.find((p) => p.action_key === active);

  return (
    <div className="flex flex-col space-y-6">
      {Toast}
      <SectionCard className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-headline text-headline-md text-primary font-bold">Catalogue des Actions IA ({prompts.length})</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant font-headline text-label-sm font-bold">APM LLM Engine</span>
          </div>
          <p className="font-body text-body-sm text-on-surface-variant mt-1">
            Les clés d'actions sont normalisées. Affinez le template de consigne et routez l'inférence vers les modèles certifiés de la Ville.
          </p>
        </div>
      </SectionCard>

      {error && <StitchAlert kind="error">{error}</StitchAlert>}
      {loading ? <StitchSpinner /> : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Liste des actions */}
          <div className="lg:col-span-4 bg-surface-container-lowest p-3 rounded-2xl shadow-card flex flex-col space-y-1">
            <div className="px-3 py-2 font-headline text-label-sm uppercase tracking-wider text-outline">Actions Algorithmiques Système</div>
            {prompts.map((p) => (
              <button
                key={p.action_key}
                className={`text-left p-3 rounded-xl flex items-center justify-between transition-colors ${active === p.action_key ? 'bg-primary-fixed/40' : 'hover:bg-surface-container-low'}`}
                onClick={() => setActive(p.action_key)} type="button"
              >
                <div>
                  <div className={`font-headline text-headline-sm ${active === p.action_key ? 'text-primary' : 'text-on-surface'}`}>{p.label}</div>
                  <div className="font-mono text-label-sm text-outline">{p.action_key}</div>
                </div>
                <span className={`material-symbols-outlined text-[20px] ${active === p.action_key ? 'text-primary' : 'text-outline'}`}>chevron_right</span>
              </button>
            ))}
          </div>

          {/* Éditeur */}
          <div className="lg:col-span-8 flex flex-col space-y-4">
            {current && (
              <SectionCard className="p-6 flex flex-col space-y-5">
                <div className="pb-4 border-b border-surface-container">
                  <span className="font-headline text-label-sm px-2.5 py-0.5 rounded-full bg-secondary text-on-secondary font-bold">Action Active</span>
                  <h3 className="font-headline text-headline-md text-primary mt-1">{current.label} ({current.action_key})</h3>
                </div>
                <StitchField label="Libellé">
                  <StitchInput value={current.label} onChange={(e) => update(current.action_key, { label: e.target.value })} />
                </StitchField>
                <StitchField label="Gabarit du prompt (variables {{...}})">
                  <StitchTextarea rows={8} className="font-mono !text-body-sm" value={current.prompt_template} onChange={(e) => update(current.action_key, { prompt_template: e.target.value })} />
                </StitchField>
                <StitchField label="Modèle préférentiel" hint="Laissé vide, le modèle par défaut de l'APM est utilisé.">
                  <StitchSelect value={current.preferred_model || ''} onChange={(e) => update(current.action_key, { preferred_model: e.target.value || null })}>
                    <option value="">Modèle par défaut APM</option>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>{m.provider_label || m.provider} — {m.name}{m.active === false ? ' (inactif)' : ''}</option>
                    ))}
                  </StitchSelect>
                </StitchField>
                <div className="flex items-center gap-2 pt-2">
                  <PrimaryButton
                    icon="save"
                    onClick={async () => { await updatePrompt(current.action_key, current); show(`Template « ${current.label} » enregistré`); }}
                  >
                    Enregistrer le template
                  </PrimaryButton>
                  <GhostButton
                    icon="play_arrow"
                    onClick={async () => {
                      try {
                        const r = await testPrompt(current.action_key, {});
                        setTest((t) => ({ ...t, [current.action_key]: r }));
                      } catch (e) { setError(errMsg(e)); }
                    }}
                  >
                    Tester l'inférence
                  </GhostButton>
                </div>
                {test[current.action_key] && (
                  <div className="bg-tertiary-fixed/30 rounded-xl p-4 space-y-2">
                    <span className="font-headline text-label-md text-on-tertiary-fixed-variant font-bold flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                      Réponse de test{test[current.action_key]!.model_name ? ` — ${test[current.action_key]!.model_name}` : ''}
                    </span>
                    <p className="whitespace-pre-wrap font-body text-body-sm text-on-surface">{test[current.action_key]!.response}</p>
                  </div>
                )}
              </SectionCard>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Onglet Paramètres ──

function SettingsTab() {
  const { show, Toast } = useToast();
  const [s, setS] = useState<any>(null);
  const [error, setError] = useState('');
  useEffect(() => { getSettings().then(setS).catch((e) => setError(errMsg(e))); }, []);
  if (!s) return <StitchSpinner />;

  async function save(e: FormEvent) {
    e.preventDefault(); setError('');
    try { await updateSettings(s); show('Paramètres enregistrés'); }
    catch (err) { setError(errMsg(err)); }
  }

  return (
    <SectionCard className="p-6">
      {Toast}
      <h2 className="font-headline text-headline-md text-primary font-bold mb-1">Paramètres Généraux</h2>
      <p className="font-body text-body-sm text-on-surface-variant mb-5">Identité de l'organisation et pied de page des communications (e-mails, exports).</p>
      <form onSubmit={save} className="space-y-4">
        <StitchField label="Nom de l'organisation">
          <StitchInput value={s.org_name || ''} onChange={(e) => setS({ ...s, org_name: e.target.value })} />
        </StitchField>
        <div className="grid gap-4 sm:grid-cols-3">
          <StitchField label="Pied de page 1">
            <StitchInput value={s.footer_line1 || ''} onChange={(e) => setS({ ...s, footer_line1: e.target.value })} />
          </StitchField>
          <StitchField label="Pied de page 2">
            <StitchInput value={s.footer_line2 || ''} onChange={(e) => setS({ ...s, footer_line2: e.target.value })} />
          </StitchField>
          <StitchField label="Pied de page 3">
            <StitchInput value={s.footer_line3 || ''} onChange={(e) => setS({ ...s, footer_line3: e.target.value })} />
          </StitchField>
        </div>
        <StitchField label="Couleur du pied de page">
          <input
            type="color" value={s.footer_color || '#0055A4'}
            onChange={(e) => setS({ ...s, footer_color: e.target.value })}
            className="w-16 h-10 rounded-lg border border-outline-variant cursor-pointer bg-surface-container-lowest"
          />
        </StitchField>
        <div className="flex items-center gap-3 rounded-xl bg-surface-container-low px-4 py-3">
          <input
            id="gamification-enabled"
            type="checkbox"
            checked={s.gamification_enabled !== false}
            onChange={(e) => setS({ ...s, gamification_enabled: e.target.checked })}
            className="h-4 w-4 accent-secondary"
          />
          <label htmlFor="gamification-enabled" className="cursor-pointer">
            <span className="block font-headline text-label-md text-on-surface">Activer la gamification (points et niveaux)</span>
            <span className="block font-body text-body-sm text-on-surface-variant">
              Désactiver masque la progression personnelle sans supprimer les contributions.
            </span>
          </label>
        </div>
        {error && <StitchAlert kind="error">{error}</StitchAlert>}
        <PrimaryButton type="submit" icon="save">Enregistrer</PrimaryButton>
      </form>
    </SectionCard>
  );
}

// ── Onglet Journal d'audit ──

function AuditTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getAudit({ limit: 100 }).then(setRows).catch((e) => setError(errMsg(e))).finally(() => setLoading(false));
  }, []);

  return (
    <SectionCard className="p-6">
      <h2 className="font-headline text-headline-md text-primary font-bold mb-1">Journal d'Audit</h2>
      <p className="font-body text-body-sm text-on-surface-variant mb-5">100 dernières actions tracées sur la plateforme.</p>
      {error && <StitchAlert kind="error">{error}</StitchAlert>}
      {loading ? <StitchSpinner /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-left font-body text-body-sm">
            <thead className="bg-surface-container text-on-surface-variant font-headline text-label-md">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Date</th>
                <th className="px-3 py-2.5 font-semibold">Utilisateur</th>
                <th className="px-3 py-2.5 font-semibold">Action</th>
                <th className="px-3 py-2.5 font-semibold">Entité</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-surface-container-low/60 transition-colors">
                  <td className="px-3 py-2 text-on-surface-variant whitespace-nowrap">{new Date(r.created_at).toLocaleString('fr-FR')}</td>
                  <td className="px-3 py-2 text-on-surface">{r.user_name || '—'}</td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 rounded-full bg-surface-container font-headline text-label-sm text-on-surface-variant">{r.action}</span>
                  </td>
                  <td className="px-3 py-2 text-on-surface-variant">{r.entity_type || '—'} {r.entity_id ? `#${r.entity_id}` : ''}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-outline">Aucune entrée d'audit.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}


// ── Onglet Thèmes ──
const THEME_SCOPES: ThemeScope[] = ['resource', 'experiment', 'risk'];

function ThemesTab() {
  const { show, Toast } = useToast();
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState<Record<number, { label: string; group_label: string }>>({});
  const [newLabel, setNewLabel] = useState<Record<string, string>>({});
  const [newGroup, setNewGroup] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    try {
      const data = await getThemes({ all: true });
      setThemes(data);
      const d: Record<number, { label: string; group_label: string }> = {};
      data.forEach((t) => { d[t.id] = { label: t.label, group_label: t.group_label || '' }; });
      setDrafts(d);
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const scopeThemes = (scope: ThemeScope) =>
    themes.filter((t) => t.scope === scope).sort((a, b) =>
      (a.group_position || 0) - (b.group_position || 0) || (a.position || 0) - (b.position || 0) || a.id - b.id);

  async function saveTheme(t: Theme) {
    const d = drafts[t.id];
    if (!d) return;
    try { await updateTheme(t.id, { label: d.label, group_label: d.group_label || null }); show(`Thème « ${d.label} » enregistré`); load(); }
    catch (e) { setError(errMsg(e)); }
  }
  async function toggleActive(t: Theme) {
    try { await updateTheme(t.id, { active: !t.active }); load(); } catch (e) { setError(errMsg(e)); }
  }
  async function removeTheme(t: Theme) {
    if (!window.confirm(`Supprimer le thème « ${t.label} » ? Il sera retiré de tous les contenus associés.`)) return;
    try { await deleteTheme(t.id); show('Thème supprimé'); load(); } catch (e) { setError(errMsg(e)); }
  }
  async function addTheme(scope: ThemeScope) {
    const label = (newLabel[scope] || '').trim();
    if (!label) return;
    try {
      await createTheme({ scope, label, group_label: scope === 'experiment' ? ((newGroup[scope] || '').trim() || null) : null, position: scopeThemes(scope).length + 1 });
      setNewLabel((s) => ({ ...s, [scope]: '' }));
      show('Thème créé'); load();
    } catch (e) { setError(errMsg(e)); }
  }
  async function move(t: Theme, dir: -1 | 1, siblings: Theme[]) {
    const idx = siblings.findIndex((x) => x.id === t.id);
    const j = idx + dir;
    if (j < 0 || j >= siblings.length) return;
    const reordered = [...siblings];
    [reordered[idx], reordered[j]] = [reordered[j], reordered[idx]];
    try { await Promise.all(reordered.map((x, i) => updateTheme(x.id, { position: i + 1 }))); load(); }
    catch (e) { setError(errMsg(e)); }
  }

  function ThemeRow({ t, siblings }: { t: Theme; siblings: Theme[] }) {
    const d = drafts[t.id] || { label: t.label, group_label: t.group_label || '' };
    return (
      <div className={`flex flex-wrap items-center gap-2 p-2 rounded-xl ${t.active ? 'bg-surface-container-low' : 'bg-surface-container opacity-70'}`}>
        <div className="flex flex-col">
          <button onClick={() => move(t, -1, siblings)} className="text-outline hover:text-primary" aria-label="Monter"><span className="material-symbols-outlined text-[16px]">keyboard_arrow_up</span></button>
          <button onClick={() => move(t, 1, siblings)} className="text-outline hover:text-primary" aria-label="Descendre"><span className="material-symbols-outlined text-[16px]">keyboard_arrow_down</span></button>
        </div>
        <input
          className="flex-1 min-w-[180px] px-3 py-1.5 bg-surface-container-lowest rounded-lg font-body text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/20"
          value={d.label}
          onChange={(e) => setDrafts((s) => ({ ...s, [t.id]: { ...d, label: e.target.value } }))}
        />
        {t.scope === 'experiment' && (
          <input
            className="w-44 px-3 py-1.5 bg-surface-container-lowest rounded-lg font-body text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/20"
            value={d.group_label} placeholder="Sous-groupe"
            onChange={(e) => setDrafts((s) => ({ ...s, [t.id]: { ...d, group_label: e.target.value } }))}
          />
        )}
        <span className="font-mono text-label-sm text-outline hidden lg:inline">{t.slug}</span>
        <label className="flex items-center gap-1 font-headline text-label-sm text-on-surface-variant cursor-pointer">
          <input type="checkbox" className="accent-secondary w-4 h-4" checked={!!t.active} onChange={() => toggleActive(t)} /> actif
        </label>
        <button onClick={() => saveTheme(t)} className="px-2.5 py-1 bg-secondary text-on-secondary rounded-full font-headline text-label-sm" title="Enregistrer">Enregistrer</button>
        <button onClick={() => removeTheme(t)} className="px-2.5 py-1 text-error hover:bg-error-container/40 rounded-full font-headline text-label-sm" title="Supprimer">Supprimer</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Toast}
      <SectionCard className="p-6">
        <h2 className="font-headline text-headline-md text-primary font-bold mb-1">Groupes thématiques</h2>
        <p className="font-body text-body-sm text-on-surface-variant">
          Trois nomenclatures indépendantes (base documentaire, expérimentations, risques). Créez, renommez, réordonnez, activez/désactivez ou supprimez les thèmes.
        </p>
      </SectionCard>

      {error && <StitchAlert kind="error">{error}</StitchAlert>}
      {loading ? <StitchSpinner /> : THEME_SCOPES.map((scope) => {
        const list = scopeThemes(scope);
        const groups = scope === 'experiment'
          ? [...new Set(list.map((t) => t.group_label || 'Autres'))]
          : [null];
        return (
          <SectionCard key={scope} className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[20px]">sell</span>
              <h3 className="font-headline text-headline-sm text-primary">{SCOPE_LABELS[scope]}</h3>
              <span className="font-headline text-label-sm text-outline">({list.length} thèmes)</span>
            </div>

            {groups.map((g) => {
              const siblings = g === null ? list : list.filter((t) => (t.group_label || 'Autres') === g);
              return (
                <div key={g ?? '_'} className="space-y-2">
                  {g !== null && <div className="font-headline text-label-sm text-outline uppercase tracking-wider">{g}</div>}
                  {siblings.map((t) => <ThemeRow key={t.id} t={t} siblings={siblings} />)}
                  {siblings.length === 0 && <p className="font-body text-body-sm text-outline italic">Aucun thème.</p>}
                </div>
              );
            })}

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-surface-container-low">
              <input
                className="flex-1 min-w-[200px] px-3 py-2 bg-surface-container-low rounded-lg font-body text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/20"
                placeholder="Nouveau thème…" value={newLabel[scope] || ''}
                onChange={(e) => setNewLabel((s) => ({ ...s, [scope]: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && addTheme(scope)}
              />
              {scope === 'experiment' && (
                <input
                  className="w-48 px-3 py-2 bg-surface-container-low rounded-lg font-body text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/20"
                  placeholder="Sous-groupe (facultatif)" value={newGroup[scope] || ''}
                  onChange={(e) => setNewGroup((s) => ({ ...s, [scope]: e.target.value }))}
                />
              )}
              <PrimaryButton icon="add" onClick={() => addTheme(scope)}>Ajouter</PrimaryButton>
            </div>
          </SectionCard>
        );
      })}
    </div>
  );
}
