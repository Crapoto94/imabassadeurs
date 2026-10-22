import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Pagination from '../components/Pagination';
import CommentThread from '../components/CommentThread';
import AiPanel from '../components/AiPanel';
import { createExperiment, getExperiments, getThemes, joinExperiment, synthExperiment } from '../api/endpoints';
import { errMsg } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import {
  Avatar, Modal, PrimaryButton, SectionCard, StitchAlert, StitchEmpty, StitchField, StitchInput,
  StitchSelect, StitchSpinner, StitchTextarea, useToast,
} from '../components/stitch';
import { ThemePicker, ThemeChips } from '../components/Themes';
import type { Experiment, Theme } from '../types';

const STATUS_META: Record<string, { label: string; chip: string; bar: string }> = {
  planned: { label: 'Idée planifiée', chip: 'bg-secondary-fixed text-on-secondary-fixed-variant', bar: 'from-secondary to-secondary-container' },
  ongoing: { label: 'En cours de test', chip: 'bg-tertiary-fixed/30 text-tertiary', bar: 'from-tertiary to-tertiary-fixed-dim' },
  completed: { label: 'Retour terminé', chip: 'bg-primary-fixed text-on-primary-fixed-variant', bar: 'from-primary to-primary-container' },
  abandoned: { label: 'Inadaptée / abandonnée', chip: 'bg-surface-container-high text-on-surface-variant', bar: 'from-outline to-outline-variant' },
};

function ExperimentCard({ exp, onChanged }: { exp: Experiment; onChanged: () => void }) {
  const { canInteract } = useAuth();
  const { show, Toast } = useToast();
  const [forumOpen, setForumOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const meta = STATUS_META[exp.status] || STATUS_META.planned;

  async function join() {
    setBusy(true);
    try { await joinExperiment(exp.id); show('Vous êtes inscrit(e) au banc d\'essai !'); onChanged(); }
    finally { setBusy(false); }
  }

  return (
    <article className="bg-surface-container-lowest rounded-2xl p-4 shadow-card hover:shadow-card-hover transition-shadow flex flex-col gap-3 relative overflow-hidden">
      {Toast}
      <div className={`absolute top-0 left-0 h-1.5 w-full bg-gradient-to-r ${meta.bar}`} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant font-headline text-label-sm font-bold">
              Expérimentation #{exp.id}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full font-headline text-label-sm font-semibold flex items-center gap-1 ${meta.chip}`}>
              {exp.status === 'ongoing' && <span className="w-1.5 h-1.5 rounded-full bg-tertiary-fixed-dim animate-pulse" />}
              {meta.label}
            </span>
            {exp.attachments_count ? (
              <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-headline text-label-sm flex items-center gap-1" title="Documents joints">
                <span className="material-symbols-outlined text-[14px]">attach_file</span>
                {exp.attachments_count}
              </span>
            ) : null}
          </div>
          <h2 className="font-headline text-headline-sm lg:text-headline-md text-primary tracking-tight">
            <Link to={`/experimentations/${exp.id}`} className="hover:underline">{exp.title}</Link>
          </h2>
        </div>
        {exp.target_date && (
          <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-full">
            <span className="material-symbols-outlined text-outline text-[18px]">event</span>
            <span className="font-headline text-label-sm text-on-surface">
              Cible : <strong>{new Date(exp.target_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
            </span>
          </div>
        )}
      </div>

      <ThemeChips themes={exp.themes} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-surface-container-low/60 p-3 rounded-xl">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-primary font-headline text-headline-sm">
            <span className="material-symbols-outlined text-[20px]">help_center</span>
            <span>Le QUOI (le test concret)</span>
          </div>
          <p className="font-body text-body-sm text-on-surface-variant line-clamp-2">{exp.description}</p>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-tertiary font-headline text-headline-sm">
            <span className="material-symbols-outlined text-[20px]">verified</span>
            <span>Le POURQUOI (l'impact attendu)</span>
          </div>
          <p className="font-body text-body-sm text-on-surface-variant line-clamp-2">{exp.objective}</p>
        </div>
      </div>

      {canInteract && (
        <>
          <div className="bg-surface-container-highest/40 p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-[24px]">auto_awesome</span>
              </div>
              <div>
                <div className="font-headline text-headline-sm text-on-surface">Synthèse IA des retours de terrain</div>
                <div className="font-body text-body-sm text-on-surface-variant">{exp.comments_count} retour(s) d'agents agrégés</div>
              </div>
            </div>
            <button
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container-lowest hover:bg-surface-container text-secondary font-headline text-label-md shadow-sm transition-all"
              onClick={() => setAiOpen((v) => !v)} type="button"
            >
              <span className="material-symbols-outlined text-[18px]">psychology</span>
              <span>Consulter l'analyse IA</span>
            </button>
          </div>
          {aiOpen && <AiPanel label="Analyse IA de l'expérimentation" run={() => synthExperiment(exp.id)} />}
        </>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div className="flex items-center gap-3">
          <Avatar name={exp.created_by_name} size={36} />
          <div className="flex flex-col">
            <span className="font-headline text-label-sm text-on-surface font-semibold">{exp.participants_count} agent(s) expérimentateur(s)</span>
            <span className="font-body text-body-sm text-outline">Porté par {exp.created_by_name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canInteract && !exp.joined && (
            <button
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-secondary hover:bg-secondary-container text-on-secondary font-headline text-label-md transition-colors disabled:opacity-50"
              onClick={join} disabled={busy} type="button"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              <span>Rejoindre l'expérimentation</span>
            </button>
          )}
          {exp.joined && (
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-tertiary-fixed/60 text-on-tertiary-fixed-variant font-headline text-label-md">
              <span className="material-symbols-outlined text-[18px] filled">check_circle</span>
              <span>Inscrit(e)</span>
            </span>
          )}
          <button
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-headline text-label-md transition-colors"
            onClick={() => setForumOpen((v) => !v)} type="button"
          >
            <span className="material-symbols-outlined text-[18px]">forum</span>
            <span>Retours ({exp.comments_count})</span>
          </button>
        </div>
      </div>

      {forumOpen && (
        <div className="bg-surface-container-low p-4 rounded-2xl">
          <CommentThread entityType="experiment" entityId={exp.id} />
        </div>
      )}
    </article>
  );
}

function CreateExperimentModal({ open, onClose, onDone, themes }: { open: boolean; onClose: () => void; onDone: () => void; themes: Theme[] }) {
  const { show, Toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [objective, setObjective] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [consent, setConsent] = useState(false);
  const [themeIds, setThemeIds] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setTitle(''); setDescription(''); setObjective(''); setTargetDate(''); setConsent(false); setThemeIds([]); setError(''); } }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await createExperiment({ title, description, objective, target_date: targetDate || null, theme_ids: themeIds });
      onClose();
      show('Fiche projet transmise pour arbitrage par le Comité IAmbassadeurs');
      onDone();
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Proposer une nouvelle expérimentation" icon="add_circle">
      {Toast}
      <p className="font-body text-body-sm text-on-surface-variant -mt-2">
        Vous identifiez une tâche répétitive ou un besoin citoyen où une IA frugale pourrait assister vos équipes ? Renseignez cette première fiche.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <StitchField label="Titre de l'expérimentation *">
          <StitchInput value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Ex: Tri automatique des courriels d'état civil…" />
        </StitchField>
        <StitchField label="Pour quand ? (date cible)">
          <StitchInput type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        </StitchField>
        <StitchField label="Le QUOI : description du cas d'usage *">
          <StitchTextarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} required placeholder="Quel outil et quel cas d'usage concret souhaitez-vous tester ?" />
        </StitchField>
        <StitchField label="Le POURQUOI : bénéfices pour le service public ivryen *">
          <StitchTextarea rows={2} value={objective} onChange={(e) => setObjective(e.target.value)} required placeholder="Gains de temps escomptés, amélioration pour les administrés…" />
        </StitchField>
        <StitchField label="Thèmes">
          <ThemePicker themes={themes} value={themeIds} onChange={setThemeIds} />
        </StitchField>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="rounded text-secondary focus:ring-0 w-4 h-4" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
          <span className="font-body text-body-sm text-outline">
            Je m'engage à respecter les principes éthiques et la confidentialité RGPD municipale.
          </span>
        </label>
        {error && <StitchAlert kind="error">{error}</StitchAlert>}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-5 py-2 rounded-full font-headline text-label-md text-on-surface-variant hover:bg-surface-container transition-all">
            Annuler
          </button>
          <PrimaryButton type="submit" disabled={busy}>{busy ? 'Envoi…' : 'Soumettre la fiche projet'}</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

export default function Experiments() {
  const { canInteract } = useAuth();
  const [items, setItems] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 12;
  const [status, setStatus] = useState('');
  const [themeFilter, setThemeFilter] = useState('');
  const [themes, setThemes] = useState<Theme[]>([]);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => { getThemes({ scope: 'experiment' }).then(setThemes).catch(() => {}); }, []);

  async function load() {
    setLoading(true);
    try { setItems(await getExperiments({ limit, offset, status: status || undefined, theme: themeFilter || undefined })); }
    catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [offset, status, themeFilter]);

  const hasActiveFilters = status !== '' || themeFilter !== '';
  function resetFilters() {
    setStatus('');
    setThemeFilter('');
    setOffset(0);
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { planned: 0, ongoing: 0, completed: 0, abandoned: 0 };
    if (!status) items.forEach((e) => { c[e.status] = (c[e.status] || 0) + 1; });
    return c;
  }, [items, status]);

  const stats = [
    { key: 'planned', label: 'Idées planifiées', icon: 'calendar_clock', cls: 'text-secondary', bar: 'bg-secondary-container' },
    { key: 'ongoing', label: 'En cours de test', icon: 'science', cls: 'text-tertiary-fixed-dim', bar: 'bg-tertiary-fixed-dim' },
    { key: 'completed', label: 'Retours terminés', icon: 'task_alt', cls: 'text-primary', bar: 'bg-primary' },
    { key: 'abandoned', label: 'Abandonnées / Inadaptées', icon: 'pause_circle', cls: 'text-outline', bar: 'bg-outline' },
  ];

  return (
    <div>
      {/* Hero compact */}
      <div className="relative w-full overflow-hidden bg-surface-container-low py-6 px-4 sm:px-6 lg:px-8">
        <div className="absolute -right-20 -top-20 w-96 h-96 rounded-full bg-secondary-fixed/30 blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 -bottom-24 w-80 h-80 rounded-full bg-tertiary-fixed/20 blur-3xl pointer-events-none" />
        <div className="relative max-w-7xl mx-auto flex flex-col gap-5">
          {/* Ligne 1 : titre aligné sur la largeur de la liste, bouton sur la colonne latérale */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-secondary text-on-secondary font-headline text-label-sm uppercase tracking-wider">Programme Terrain</span>
                <span className="font-body text-body-sm text-on-surface-variant flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-tertiary-fixed-dim inline-block" />
                  Ivry-sur-Seine • Laboratoire Vivant
                </span>
              </div>
              <h1 className="font-headline text-headline-lg-mobile lg:text-headline-lg text-primary tracking-tight">Expérimentations IA en mode projet</h1>
              <p className="font-body text-body-md text-on-surface-variant mt-1 line-clamp-2">
                Banc d'essai participatif de la démarche IAmbassadeurs : les directions municipales éprouvent des outils d'IA frugale et éthique, mesurent les gains réels et évaluent les risques avant tout déploiement pérenne.
              </p>
            </div>
            <div className="flex shrink-0 justify-start lg:w-80 lg:justify-end">
              {canInteract && (
                <PrimaryButton icon="add_circle" onClick={() => setModalOpen(true)} className="shrink-0 py-2.5 px-5">
                  Proposer une expérimentation
                </PrimaryButton>
              )}
            </div>
          </div>
          {/* Ligne 2 : tuiles de statistiques alignées sur la largeur de la liste */}
          <div className="flex gap-4 lg:gap-8">
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
              {stats.map(({ key, label, icon, cls, bar }) => (
                <div key={key} className="bg-surface-container-lowest p-3 rounded-xl shadow-card flex flex-col gap-2 hover:shadow-card-hover transition-shadow">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-headline text-label-sm text-on-surface-variant truncate">{label}</span>
                    <span className={`material-symbols-outlined text-[18px] ${cls}`}>{icon}</span>
                  </div>
                  <div className="font-headline text-headline-md text-on-surface leading-none">{counts[key] ?? 0}</div>
                  <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                    <div className={`${bar} h-full rounded-full`} style={{ width: `${Math.min(100, (counts[key] ?? 0) * 20)}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden shrink-0 lg:block lg:w-80" aria-hidden="true" />
          </div>
        </div>
      </div>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 flex flex-col gap-6">
            {/* Filtres */}
            <SectionCard className="p-4 sm:p-5 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFiltersOpen((v) => !v)}
                    aria-expanded={filtersOpen}
                    aria-controls="experiments-filters"
                    className="flex min-w-0 items-center gap-2 text-left"
                  >
                    <span className="material-symbols-outlined text-primary text-[20px]">filter_list</span>
                    <span className="font-headline text-headline-sm text-on-surface">Filtrer les bancs d'essai</span>
                    <span className={`material-symbols-outlined text-[24px] text-primary transition-transform ${filtersOpen ? 'rotate-180' : ''}`}>arrow_drop_down</span>
                  </button>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="font-body text-body-sm text-outline hover:text-primary transition-colors"
                    >
                      Réinitialiser
                    </button>
                  )}
                </div>
              </div>
              {filtersOpen && (
                <div id="experiments-filters" className="flex flex-wrap items-center gap-2 pt-1 justify-between">
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={`px-3.5 py-1.5 rounded-full font-headline text-label-md transition-all ${status === '' ? 'bg-primary-container text-on-primary-container font-bold shadow-sm' : 'bg-surface-container text-on-surface-variant hover:text-on-surface'}`}
                      onClick={() => { setStatus(''); setOffset(0); }} type="button"
                    >
                      Tous
                    </button>
                    {Object.entries(STATUS_META).map(([k, v]) => (
                      <button
                        key={k}
                        className={`px-3.5 py-1.5 rounded-full font-headline text-label-md transition-all ${status === k ? 'bg-primary-container text-on-primary-container font-bold shadow-sm' : 'bg-surface-container text-on-surface-variant hover:text-on-surface'}`}
                        onClick={() => { setStatus(k); setOffset(0); }} type="button"
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                  <label className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-outline text-[18px]">sell</span>
                    <StitchSelect
                      className="!w-auto !py-1.5 !rounded-full !bg-surface-container-low"
                      value={themeFilter}
                      onChange={(e) => { setThemeFilter(e.target.value); setOffset(0); }}
                      aria-label="Filtrer par thème"
                    >
                      <option value="">Tous les thèmes</option>
                      {themes.map((t) => <option key={t.id} value={t.slug}>{t.label}</option>)}
                    </StitchSelect>
                  </label>
                </div>
              )}
            </SectionCard>

            {error && <StitchAlert kind="error">{error}</StitchAlert>}
            {loading ? <StitchSpinner />
              : items.length === 0 ? <StitchEmpty icon="science">Aucune expérimentation pour ce filtre.</StitchEmpty>
              : items.map((e) => <ExperimentCard key={e.id} exp={e} onChanged={load} />)}
            <Pagination offset={offset} limit={limit} count={items.length} onChange={setOffset} />
          </div>

          {/* Sidebar */}
          <aside className="w-full lg:w-80 shrink-0 flex flex-col gap-6">
            <SectionCard className="p-6 rounded-3xl flex flex-col gap-4">
              <div className="flex items-center gap-2 text-primary">
                <span className="material-symbols-outlined text-[24px]">school</span>
                <h3 className="font-headline text-headline-sm">Participer à un banc d'essai</h3>
              </div>
              <div className="space-y-3 pt-2">
                {[
                  'Choisissez un projet et cliquez sur « Rejoindre ».',
                  'Testez pendant quelques semaines et partagez vos avis concrets de terrain.',
                ].map((txt, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant font-headline text-label-sm font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <p className="font-body text-body-sm text-on-surface">{txt}</p>
                  </div>
                ))}
              </div>
            </SectionCard>

            <div className="bg-surface-container-low p-6 rounded-3xl shadow-card flex flex-col gap-4">
              <div className="flex items-center gap-2 text-tertiary">
                <span className="material-symbols-outlined text-[24px]">verified_user</span>
                <h3 className="font-headline text-headline-sm">Garde-fous de la Charte</h3>
              </div>
              <p className="font-body text-body-sm text-on-surface-variant leading-relaxed">
                Chaque banc d'essai est conditionné au respect du <strong>cadre d'usage minimum</strong> :
              </p>
              <div className="space-y-2 font-body text-body-sm">
                {[
                  { icon: 'security', label: 'Souveraineté des données (RGPD)', tip: "Aucune donnée personnelle ne doit être envoyée sur internet." },
                  { icon: 'visibility', label: 'Transparence vis-à-vis des usagers', tip: "L'usage de l'IA est annoncé clairement. Chaque usager peut savoir quand un outil automatique intervient et obtenir une explication compréhensible des décisions qui le concernent." },
                  { icon: 'person_check', label: 'Contrôle humain systématique', tip: "Aucune décision administrative n'est déléguée à l'IA : un agent garde toujours la main et peut vérifier, corriger ou refuser une proposition automatique." },
                  { icon: 'description', label: "Documentation des cas d'usage", tip: "Chaque expérimentation est décrite et archivée (périmètre, outils, données, résultats, limites) pour garantir la traçabilité et la reproductibilité." },
                  { icon: 'handshake', label: 'Respect des métiers de chacun', tip: "Les cas d'usage sont identifiés dans vos propres champs d'expertise, dans le respect de l'expertise métier de chacun et des processus internes des services." },
                ].map(({ icon, label, tip }) => (
                  <div key={label} className="group relative flex items-center gap-2.5 rounded-xl bg-surface-container-lowest p-2">
                    <span className="material-symbols-outlined text-secondary text-[20px]">{icon}</span>
                    <span className="text-on-surface font-medium">{label}</span>
                    <span role="tooltip" className="pointer-events-none absolute bottom-full left-0 z-20 mb-1 w-64 rounded-lg bg-inverse-surface px-3 py-2 font-body text-body-sm font-normal leading-snug text-inverse-on-surface opacity-0 shadow-modal transition-opacity duration-150 group-hover:opacity-100">
                      {tip}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>

      <CreateExperimentModal open={modalOpen} onClose={() => setModalOpen(false)} onDone={() => { setOffset(0); load(); }} themes={themes} />
    </div>
  );
}
