import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Pagination from '../components/Pagination';
import CommentThread from '../components/CommentThread';
import AiPanel from '../components/AiPanel';
import { createRisk, getRisks, getThemes, synthRisk } from '../api/endpoints';
import { errMsg } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import {
  Modal, PrimaryButton, SectionCard, StitchAlert, StitchEmpty, StitchField, StitchInput,
  StitchSelect, StitchSpinner, StitchTextarea, timeAgo, useToast,
} from '../components/stitch';
import { ThemePicker, ThemeChips } from '../components/Themes';
import type { Risk, Theme } from '../types';

function Stars({ value, tone }: { value: number; tone: 'error' | 'secondary' }) {
  return (
    <div className={`flex ${tone === 'error' ? 'text-error' : 'text-secondary'}`}>
      {[1, 2, 3, 4].map((n) => (
        <span key={n} className={`material-symbols-outlined text-[16px] ${n <= value ? 'filled' : ''}`}>star</span>
      ))}
    </div>
  );
}

function RiskCard({ risk }: { risk: Risk }) {
  const { canInteract } = useAuth();
  const [forumOpen, setForumOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  return (
    <article className="bg-surface-container-lowest rounded-2xl shadow-card p-4 hover:shadow-card-hover transition-shadow" id={`risk-${risk.id}`}>
      <div className="flex items-start justify-between gap-3 pb-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-fixed/50 text-primary flex items-center justify-center shrink-0">
            <span className="font-headline text-headline-sm">{risk.id}</span>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              {risk.concerns_ivry ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant font-headline text-label-sm font-bold">
                  <span className="material-symbols-outlined text-[15px]">location_on</span>
                  Concerne Ivry
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-headline text-label-sm">
                  Risque générique
                </span>
              )}
            </div>
            <h3 className="font-headline text-headline-sm text-on-surface font-bold">
              <Link to={`/risques/${risk.id}`} className="hover:text-secondary transition-colors">{risk.title}</Link>
            </h3>
            <p className="font-body text-body-sm text-outline">
              Signalé par <strong className="text-on-surface">{risk.proposed_by_name}</strong> • {timeAgo(risk.created_at)}
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 shrink-0 bg-surface-container-low p-2.5 rounded-xl">
          <div className="text-right">
            <div className="flex items-center justify-end gap-1">
              <span className="font-headline text-label-sm text-outline">Impact :</span>
              <span className="font-headline text-label-sm text-error font-bold">{risk.importance}/4</span>
            </div>
            <Stars value={risk.importance} tone="error" />
          </div>
          <div className="w-px h-6 bg-surface-container hidden sm:block" />
          <div className="text-right">
            <div className="flex items-center justify-end gap-1">
              <span className="font-headline text-label-sm text-outline">Probabilité :</span>
              <span className="font-headline text-label-sm text-secondary font-bold">{risk.probability}/4</span>
            </div>
            <Stars value={risk.probability} tone="secondary" />
          </div>
        </div>
      </div>

      <p className="py-1 font-body text-body-sm text-on-surface-variant line-clamp-2">{risk.description}</p>
      <ThemeChips themes={risk.themes} className="pb-1" />

      {risk.amendments_count > 0 && (
        <div className="mt-2 pt-3 bg-surface-container/40 p-3 rounded-lg flex items-start gap-2.5">
          <span className="material-symbols-outlined text-outline text-[18px] mt-0.5">history_edu</span>
          <div className="font-body text-body-sm text-on-surface-variant flex-1">
            <span className="font-headline text-label-sm font-bold text-primary">
              {risk.amendments_count} amendement(s) d'instruction par le collectif
            </span>
            {' '}— consultez le détail pour suivre les réévaluations de la cotation.
          </div>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {canInteract && (
          <button
            className="flex items-center gap-1 px-2.5 py-1 text-primary hover:bg-surface-container-low rounded-full font-headline text-label-sm transition-colors"
            onClick={() => setAiOpen((v) => !v)} type="button"
          >
            <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
            <span className="hidden md:inline">Résumer</span>
          </button>
        )}
        <button
          className="flex items-center gap-1 px-2.5 py-1 text-on-surface-variant hover:bg-surface-container-low rounded-full font-headline text-label-sm transition-colors"
          onClick={() => setForumOpen((v) => !v)} type="button"
        >
          <span className="material-symbols-outlined text-[16px]">forum</span>
          <span>{risk.comments_count}</span>
        </button>
        <Link
          to={`/risques/${risk.id}`}
          className="ml-auto flex items-center gap-1 px-2.5 py-1 text-on-surface-variant hover:bg-surface-container rounded-full font-headline text-label-sm transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">open_in_new</span>
          <span className="hidden sm:inline">Détails</span>
        </Link>
      </div>

      {aiOpen && <AiPanel label="Synthèse de l'assistant IA municipal" run={() => synthRisk(risk.id)} />}
      {forumOpen && (
        <div className="mt-4 pt-4 border-t border-surface-container-low">
          <CommentThread entityType="risk" entityId={risk.id} />
        </div>
      )}
    </article>
  );
}

function DeclareRiskModal({ open, onClose, onDone, themes }: { open: boolean; onClose: () => void; onDone: () => void; themes: Theme[] }) {
  const { show, Toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [concerns, setConcerns] = useState(true);
  const [importance, setImportance] = useState(2);
  const [probability, setProbability] = useState(2);
  const [themeIds, setThemeIds] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setTitle(''); setDescription(''); setConcerns(true); setImportance(2); setProbability(2); setThemeIds([]); setError(''); } }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await createRisk({ title, description, concerns_ivry: concerns, importance, probability, theme_ids: themeIds } as any);
      onClose();
      show('Risque soumis au collège des IAmbassadeurs');
      onDone();
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Déclarer un risque éthique ou technique" icon="add_alert">
      {Toast}
      <p className="font-body text-body-sm text-outline -mt-2">Co-construction de la Charte IA • Ivry-sur-Seine</p>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <StitchField label="Intitulé clair et précis du risque *">
          <StitchInput value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Ex : Erreur de diagnostic automatisé lors des bilans énergétiques municipaux…" />
        </StitchField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StitchField label="Importance / impact citoyen *">
            <StitchSelect value={importance} onChange={(e) => setImportance(Number(e.target.value))}>
              <option value={4}>4 ★★★★ Critique (droits fondamentaux, discrimination)</option>
              <option value={3}>3 ★★★☆ Élevé (rupture d'égalité, confidentialité)</option>
              <option value={2}>2 ★★☆☆ Modéré (gêne d'usage, lenteur administrative)</option>
              <option value={1}>1 ★☆☆☆ Faible (inconfort mineur)</option>
            </StitchSelect>
          </StitchField>
          <StitchField label="Probabilité estimée *">
            <StitchSelect value={probability} onChange={(e) => setProbability(Number(e.target.value))}>
              <option value={4}>4 ★★★★ Très forte / imminente</option>
              <option value={3}>3 ★★★☆ Élevée (cas déjà observé ou outil envisagé)</option>
              <option value={2}>2 ★★☆☆ Modérée (nécessite des conditions particulières)</option>
              <option value={1}>1 ★☆☆☆ Faible (hypothèse théorique)</option>
            </StitchSelect>
          </StitchField>
        </div>
        <label className="flex items-center gap-3 p-3 bg-surface-container-low rounded-xl cursor-pointer">
          <input type="checkbox" className="w-5 h-5 rounded text-secondary focus:ring-secondary" checked={concerns} onChange={(e) => setConcerns(e.target.checked)} />
          <span className="font-headline text-label-md text-on-surface">
            Ce risque concerne directement un service ou un usage de la Ville d'Ivry-sur-Seine
          </span>
        </label>
        <StitchField label="Description détaillée et cas concrets *">
          <StitchTextarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} required
            placeholder="Décrivez les usagers potentiellement impactés, les services municipaux concernés, et vos préconisations de précaution…" />
        </StitchField>
        <StitchField label="Thèmes">
          <ThemePicker themes={themes} value={themeIds} onChange={setThemeIds} />
        </StitchField>
        {error && <StitchAlert kind="error">{error}</StitchAlert>}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-full hover:bg-surface-container text-on-surface-variant font-headline text-label-md transition-colors">
            Annuler
          </button>
          <PrimaryButton type="submit" disabled={busy} className="py-2.5 px-6">{busy ? 'Envoi…' : 'Soumettre au collège des IAmbassadeurs'}</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

export default function Risks() {
  const { canInteract } = useAuth();
  const [items, setItems] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 12;
  const [scope, setScope] = useState<'all' | 'ivry' | 'general'>('all');
  const [sort, setSort] = useState<'severity' | 'recent' | 'debated'>('severity');
  const [themeFilter, setThemeFilter] = useState('');
  const [themes, setThemes] = useState<Theme[]>([]);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => { getThemes({ scope: 'risk' }).then(setThemes).catch(() => {}); }, []);

  async function load() {
    setLoading(true);
    try {
      setItems(await getRisks({
        limit, offset,
        concerns_ivry: scope === 'all' ? undefined : scope === 'ivry' ? 'true' : 'false',
        theme: themeFilter || undefined,
      }));
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [offset, scope, themeFilter]);

  const sorted = useMemo(() => {
    const arr = [...items];
    if (sort === 'severity') arr.sort((a, b) => b.importance * b.probability - a.importance * a.probability);
    if (sort === 'recent') arr.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    if (sort === 'debated') arr.sort((a, b) => b.comments_count - a.comments_count);
    return arr;
  }, [items, sort]);

  const criticalCount = items.filter((r) => r.concerns_ivry && r.importance >= 3).length;

  // Matrice 4×4 : ligne = impact (4 en haut), colonne = probabilité.
  const matrix = useMemo(() => {
    const cells: Record<string, Risk[]> = {};
    for (const r of items) {
      const key = `${r.importance}-${r.probability}`;
      (cells[key] ||= []).push(r);
    }
    return cells;
  }, [items]);

  return (
    <div>
      {/* Bandeau de vigilance */}
      <section className="w-full bg-surface-container-low py-8 px-4 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-error-container text-on-error-container flex items-center justify-center shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-[28px] filled">security_update_warning</span>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-headline text-label-sm uppercase tracking-wider text-secondary">Observatoire &amp; Co-construction</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-error text-on-error font-headline text-label-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-on-error animate-ping mr-1.5" />Vigilance Active
                </span>
              </div>
              <h1 className="font-headline text-headline-lg-mobile lg:text-headline-lg text-primary tracking-tight">Cartographie &amp; Vigilance des Risques IA</h1>
              <p className="font-body text-body-md text-on-surface-variant max-w-2xl">
                Recensement citoyen et paritaire des vulnérabilités éthiques, techniques et humaines.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-4 bg-surface-container-lowest px-4 py-2.5 rounded-xl shadow-card">
              <div className="text-right">
                <span className="font-headline text-headline-sm text-primary block leading-none">{items.length}</span>
                <span className="font-headline text-label-sm text-outline">Risques qualifiés</span>
              </div>
              <div className="w-px h-8 bg-surface-container" />
              <div className="text-right">
                <span className="font-headline text-headline-sm text-error block leading-none">{criticalCount}</span>
                <span className="font-headline text-label-sm text-outline">Critiques Ivry</span>
              </div>
            </div>
            {canInteract && (
              <PrimaryButton icon="add_alert" onClick={() => setModalOpen(true)} className="py-3 px-5 whitespace-nowrap">
                Déclarer un risque identifié
              </PrimaryButton>
            )}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto w-full px-4 lg:px-8 py-8 flex flex-col xl:flex-row gap-8">
        <div className="flex-1 flex flex-col gap-8 min-w-0">
          {/* Matrice 4×4 */}
          {items.length > 0 && (
            <SectionCard className="p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-6 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-secondary text-[20px]">grid_view</span>
                    <h2 className="font-headline text-headline-md text-on-surface">Matrice d'évaluation participative (4 × 4)</h2>
                  </div>
                  <p className="font-body text-body-sm text-on-surface-variant">Croisement de l'impact éthique/citoyen (1-4★) et de la probabilité d'occurrence (1-4★).</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1.5 font-headline text-label-sm text-on-surface-variant"><span className="w-3 h-3 rounded-full bg-error" /> Zone critique</span>
                  <span className="flex items-center gap-1.5 font-headline text-label-sm text-on-surface-variant"><span className="w-3 h-3 rounded-full bg-secondary" /> Vigilance</span>
                  <span className="flex items-center gap-1.5 font-headline text-label-sm text-on-surface-variant"><span className="w-3 h-3 rounded-full bg-surface-container-high" /> Risque modéré</span>
                </div>
              </div>
              <div className="relative bg-surface-container-low/50 p-4 sm:p-6 rounded-xl">
                <div className="flex gap-4">
                  <div className="hidden sm:flex flex-col justify-between items-center py-2 select-none">
                    <span className="font-headline text-label-sm text-outline [writing-mode:vertical-rl] rotate-180">IMPACT ↑</span>
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="grid grid-cols-4 gap-2">
                      {[4, 3, 2, 1].map((impact) =>
                        [1, 2, 3, 4].map((proba) => {
                          const cell = matrix[`${impact}-${proba}`] || [];
                          const severity = impact + proba;
                          const cls = severity >= 7
                            ? 'bg-error-container/60 hover:bg-error-container/80'
                            : severity >= 5
                              ? 'bg-surface-container-high hover:bg-surface-container-highest'
                              : 'bg-surface-container-low hover:bg-surface-container';
                          return (
                            <div key={`${impact}-${proba}`} className={`rounded-lg p-2 min-h-[64px] flex flex-col justify-between transition-colors ${cls}`}>
                              <span className={`font-headline text-label-sm ${severity >= 7 ? 'text-error font-bold' : 'text-on-surface-variant'}`}>
                                {cell.length > 0 ? `${cell.length}` : ''}
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {cell.slice(0, 4).map((r) => (
                                  <Link
                                    key={r.id} to={`/risques/${r.id}`} title={r.title}
                                    className={`w-6 h-6 rounded-full font-headline text-[10px] flex items-center justify-center hover:scale-110 transition-transform ${
                                      severity >= 7 ? 'bg-error text-on-error font-bold' : 'bg-secondary text-on-secondary'
                                    }`}
                                  >
                                    {r.id}
                                  </Link>
                                ))}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <div className="grid grid-cols-4 text-center pt-2">
                      <span className="font-headline text-label-sm text-on-surface-variant">Faible</span>
                      <span className="font-headline text-label-sm text-on-surface-variant">Modérée</span>
                      <span className="font-headline text-label-sm text-on-surface-variant">Élevée</span>
                      <span className="font-headline text-label-sm text-on-surface-variant">Imminente</span>
                    </div>
                    <div className="text-center">
                      <span className="font-headline text-label-sm text-outline tracking-wider">PROBABILITÉ D'OCCURRENCE →</span>
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>
          )}

          {/* Filtres */}
          <SectionCard className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4">
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-surface-container rounded-2xl sm:rounded-full w-full sm:w-auto sm:flex-nowrap sm:shrink-0">
              {([
                { k: 'all', label: 'Tous les risques', dot: false },
                { k: 'ivry', label: 'Spécifiques Ivry', dot: true },
                { k: 'general', label: 'Généraux', dot: false },
              ] as { k: 'all' | 'ivry' | 'general'; label: string; dot: boolean }[]).map(({ k, label, dot }) => (
                <button
                  key={k}
                  className={`px-4 py-2 rounded-full font-headline text-label-md transition-all flex items-center gap-1.5 whitespace-nowrap ${scope === k ? 'bg-surface-container-lowest text-primary shadow-sm font-bold' : 'text-on-surface-variant hover:text-on-surface'}`}
                  onClick={() => { setScope(k); setOffset(0); }} type="button"
                >
                  {dot && <span className="w-2 h-2 rounded-full bg-secondary" />}
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
              <span className="font-headline text-label-sm text-outline hidden md:inline">Trier par :</span>
              <StitchSelect className="!w-auto !py-1.5 !px-3 !rounded-lg text-body-sm" value={sort} onChange={(e) => setSort(e.target.value as any)}>
                <option value="severity">Gravité cumulée (Impact × Proba)</option>
                <option value="recent">Plus récents d'abord</option>
                <option value="debated">Plus débattus</option>
              </StitchSelect>
              <StitchSelect
                className="!w-auto !py-1.5 !px-3 !rounded-lg text-body-sm"
                value={themeFilter}
                onChange={(e) => { setThemeFilter(e.target.value); setOffset(0); }}
                aria-label="Filtrer par thème"
              >
                <option value="">Tous les thèmes</option>
                {themes.map((t) => <option key={t.id} value={t.slug}>{t.label}</option>)}
              </StitchSelect>
            </div>
          </SectionCard>

          {error && <StitchAlert kind="error">{error}</StitchAlert>}
          {loading ? <StitchSpinner />
            : sorted.length === 0 ? <StitchEmpty icon="security">Aucun risque pour ce filtre.</StitchEmpty>
            : sorted.map((r) => <RiskCard key={r.id} risk={r} />)}
          <Pagination offset={offset} limit={limit} count={items.length} onChange={setOffset} />
        </div>

        {/* Sidebar conseils */}
        <aside className="w-full xl:w-80 shrink-0 flex flex-col gap-6">
          <SectionCard className="p-5">
            <h3 className="font-headline text-headline-sm text-primary flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-secondary text-[20px]">tips_and_updates</span>
              Bien qualifier un risque
            </h3>
            <div className="space-y-4">
              {[
                { n: 1, t: 'Préciser le contexte local', d: 'Nommez le service (État-civil, CCAS, écoles, voirie) pour évaluer la réalité du risque à Ivry.' },
                { n: 2, t: "Distinguer impact et probabilité", d: "L'impact mesure la gravité sur les droits de l'usager ; la probabilité mesure la fréquence prévisible." },
                { n: 3, t: 'Proposer une mesure mitigeante', d: "Un bon signalement de risque inclut souvent l'ébauche d'une règle de prudence pour nos agents." },
              ].map(({ n, t, d }) => (
                <div key={n} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-surface-container text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">{n}</div>
                  <div>
                    <h4 className="font-headline text-label-md text-on-surface">{t}</h4>
                    <p className="font-body text-body-sm text-on-surface-variant">{d}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </aside>
      </div>

      <DeclareRiskModal open={modalOpen} onClose={() => setModalOpen(false)} onDone={() => { setOffset(0); load(); }} themes={themes} />
    </div>
  );
}
