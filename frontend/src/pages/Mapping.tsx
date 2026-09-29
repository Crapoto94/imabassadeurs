import { useEffect, useMemo, useState } from 'react';
import ForceGraph, { GraphNode } from '../components/ForceGraph';
import {
  createLink, createPrinciple, deletePrinciple, generateClusters, getConsensus, getGraph,
  getPrinciples, getStats, setPrincipleStatus, updatePrinciple,
} from '../api/endpoints';
import { errMsg } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import {
  GhostButton, PrimaryButton, SectionCard, StitchAlert, StitchField, StitchInput, StitchSelect,
  StitchSpinner, StitchTextarea,
} from '../components/stitch';
import type { GraphData, Principle } from '../types';

const TYPE_LABELS: Record<string, string> = {
  resource: 'Ressources', risk: 'Risques', experiment: 'Expérimentations', comment: 'Commentaires', principle: 'Principes', cluster: 'Thèmes IA',
};

type View = 'graph' | 'cloud' | 'timeline' | 'controversy';

export default function Mapping() {
  const { canInteract, isIanimateur } = useAuth();
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [principles, setPrinciples] = useState<Principle[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('graph');
  const [typeFilter, setTypeFilter] = useState<string[]>(['resource', 'risk', 'experiment', 'principle', 'cluster', 'comment']);
  const [direction, setDirection] = useState('');
  const [service, setService] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [consensus, setConsensus] = useState<any>(null);
  const [busyIa, setBusyIa] = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const [g, p, s] = await Promise.all([getGraph(), getPrinciples(), getStats()]);
      setGraph(g); setPrinciples(p); setStats(s);
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }
  useEffect(() => { loadAll(); }, []);

  const directions = useMemo(() => [...new Set((graph?.nodes || []).map((n) => n.direction).filter(Boolean))] as string[], [graph]);
  const services = useMemo(() => [...new Set((graph?.nodes || []).map((n) => n.service).filter(Boolean))] as string[], [graph]);

  const filteredNodes = useMemo(() => {
    if (!graph) return [];
    return graph.nodes.filter((n) => {
      if (!typeFilter.includes(n.type)) return false;
      if (direction && n.direction !== direction) return false;
      if (service && n.service !== service) return false;
      if (search && !String(n.label || '').toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [graph, typeFilter, direction, service, search]);

  const nodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);
  const filteredEdges = useMemo(() => (graph?.edges || []).filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target)), [graph, nodeIds]);

  const conceptCloud = useMemo(() => {
    const words = new Map<string, number>();
    (graph?.nodes || []).forEach((n) => {
      String(n.label || '').toLowerCase().split(/[^\p{L}]+/u).forEach((w) => {
        if (w.length > 3) words.set(w, (words.get(w) || 0) + 1);
      });
    });
    return [...words.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
  }, [graph]);

  const timeline = useMemo(() => {
    const months = new Map<string, number>();
    (graph?.nodes || []).forEach((n) => {
      if (!n.created_at) return;
      const m = new Date(n.created_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'short' });
      months.set(m, (months.get(m) || 0) + 1);
    });
    return [...months.entries()].slice(-12);
  }, [graph]);

  async function runClusters() {
    setBusyIa(true); setError('');
    try { setGraph(await generateClusters()); await loadAll(); }
    catch (e) { setError(errMsg(e)); } finally { setBusyIa(false); }
  }
  async function runConsensus() {
    setBusyIa(true); setError('');
    try { setConsensus(await getConsensus()); setView('controversy'); }
    catch (e) { setError(errMsg(e)); } finally { setBusyIa(false); }
  }

  const countByType = (t: string) => (graph?.nodes || []).filter((n) => n.type === t).length;
  const adopted = principles.filter((p) => p.status === 'adopted').length;

  const views: { k: View; icon: string; label: string }[] = [
    { k: 'graph', icon: 'account_tree', label: 'Graphe de connaissances' },
    { k: 'cloud', icon: 'cloud', label: 'Nuage de concepts' },
    { k: 'timeline', icon: 'timeline', label: 'Frise chronologique' },
    { k: 'controversy', icon: 'bolt', label: 'Carte des controverses' },
  ];

  return (
    <div>
      {/* Barre d'outils */}
      <div className="w-full bg-surface-container-low px-4 lg:px-8 py-4 shadow-sm">
        <div className="max-w-[1720px] mx-auto flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full">
              <span className="material-symbols-outlined text-[18px]">hub</span>
              <span className="font-headline text-label-sm uppercase tracking-wider font-bold">Cartographie &amp; Charte</span>
            </div>
            <div className="flex items-center gap-1.5 bg-surface-container p-1 rounded-full shadow-inner overflow-x-auto">
              {views.map(({ k, icon, label }) => (
                <button
                  key={k}
                  className={`px-3.5 py-1.5 rounded-full font-headline text-label-md transition-all flex items-center gap-1.5 whitespace-nowrap ${view === k ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'}`}
                  onClick={() => setView(k)} type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto justify-start xl:justify-end">
            <div className="flex items-center gap-1 bg-surface-container-lowest rounded-full px-3 py-1.5 shadow-sm text-on-surface">
              <span className="material-symbols-outlined text-outline text-[16px]">corporate_fare</span>
              <select className="bg-transparent font-headline text-label-sm text-on-surface focus:outline-none cursor-pointer pr-1" value={direction} onChange={(e) => setDirection(e.target.value)}>
                <option value="">Toutes les directions</option>
                {directions.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1 bg-surface-container-lowest rounded-full px-3 py-1.5 shadow-sm text-on-surface">
              <span className="material-symbols-outlined text-outline text-[16px]">badge</span>
              <select className="bg-transparent font-headline text-label-sm text-on-surface focus:outline-none cursor-pointer pr-1" value={service} onChange={(e) => setService(e.target.value)}>
                <option value="">Tous les services</option>
                {services.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1 bg-surface-container-lowest rounded-full px-3 py-1.5 shadow-sm text-on-surface">
              <span className="material-symbols-outlined text-outline text-[16px]">search</span>
              <input
                className="bg-transparent font-headline text-label-sm text-on-surface focus:outline-none w-32"
                placeholder="Mot-clé…" value={search} onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {isIanimateur && (
              <button
                className="flex items-center gap-2 bg-gradient-to-r from-secondary to-primary-container text-on-secondary hover:brightness-110 px-4 py-2 rounded-full font-headline text-label-md shadow-md transition-all active:scale-95 disabled:opacity-50"
                onClick={runClusters} disabled={busyIa} type="button"
              >
                <span className={`material-symbols-outlined text-[18px] ${busyIa ? 'animate-spin' : ''}`}>{busyIa ? 'sync' : 'auto_awesome'}</span>
                <span>Lancer la détection thématique IA</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="w-full max-w-[1720px] mx-auto p-4 lg:p-6 grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 flex flex-col gap-4">
          {error && <StitchAlert kind="error">{error}</StitchAlert>}

          {/* Filtres de types */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(TYPE_LABELS).map(([type, label]) => (
              <button
                key={type}
                onClick={() => setTypeFilter((f) => f.includes(type) ? f.filter((x) => x !== type) : [...f, type])}
                className={`rounded-full px-3 py-1 font-headline text-label-sm transition-colors ${typeFilter.includes(type) ? 'bg-secondary text-on-secondary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
                type="button"
              >
                {label} ({countByType(type)})
              </button>
            ))}
          </div>

          {/* Vue principale */}
          <SectionCard className="p-4 sm:p-6 min-h-[500px] flex flex-col overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 z-10 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-tertiary-fixed-dim animate-pulse" />
                  <span className="font-headline text-headline-sm text-primary">Constellation Interactive de la Charte</span>
                  <span className="font-headline text-label-sm bg-surface-container-high text-primary px-2.5 py-0.5 rounded-full">en direct</span>
                </div>
                <p className="font-body text-body-sm text-on-surface-variant">Convergence des contributions citoyennes et municipales vers les piliers normatifs.</p>
              </div>
              {canInteract && view !== 'controversy' && (
                <GhostButton icon="psychology" onClick={runConsensus} disabled={busyIa}>
                  Analyser consensus &amp; controverses (IA)
                </GhostButton>
              )}
            </div>

            {loading ? <StitchSpinner /> : view === 'graph' && (
              <ForceGraph nodes={filteredNodes} edges={filteredEdges} onSelect={setSelected} selectedId={selected?.id} />
            )}

            {view === 'cloud' && (
              <div className="flex-1 bg-surface-container-low/50 rounded-xl p-8 flex flex-wrap items-center justify-center gap-3">
                {conceptCloud.length === 0 && <p className="font-body text-body-md text-on-surface-variant">Aucun concept à afficher.</p>}
                {conceptCloud.map(([w, c]) => (
                  <span
                    key={w}
                    style={{ fontSize: 13 + Math.min(c, 6) * 4 }}
                    className="font-headline font-bold text-primary hover:text-secondary transition-colors cursor-default"
                    title={`${c} occurrence(s)`}
                  >
                    {w}
                  </span>
                ))}
              </div>
            )}

            {view === 'timeline' && (
              <div className="flex-1 bg-surface-container-low/50 rounded-xl p-6 space-y-2">
                {timeline.length === 0 && <p className="font-body text-body-md text-on-surface-variant">Aucune activité enregistrée.</p>}
                {timeline.map(([m, c]) => (
                  <div key={m} className="flex items-center gap-3">
                    <span className="w-24 font-headline text-label-sm text-on-surface-variant text-right">{m}</span>
                    <div className="flex-1 bg-surface-container-high h-4 rounded-full overflow-hidden">
                      <div className="bg-secondary h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, c * 10)}%` }} />
                    </div>
                    <span className="font-headline text-label-sm text-primary font-bold w-8">{c}</span>
                  </div>
                ))}
              </div>
            )}

            {view === 'controversy' && (
              consensus ? <ConsensusPanel data={consensus} /> : (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16">
                  <span className="material-symbols-outlined text-[40px] text-outline">bolt</span>
                  <p className="font-body text-body-md text-on-surface-variant text-center max-w-md">
                    Lancez l'analyse IA « consensus &amp; controverses » pour cartographier les points d'accord et de friction du débat.
                  </p>
                  {canInteract && <PrimaryButton icon="psychology" onClick={runConsensus} disabled={busyIa}>Lancer l'analyse</PrimaryButton>}
                </div>
              )
            )}

            {/* Carte de l'élément sélectionné */}
            {selected && view === 'graph' && (
              <NodeInspector node={selected} principles={principles} onLinked={loadAll} canInteract={canInteract} />
            )}
          </SectionCard>

          {/* Faisceau de tendances */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-surface-container-lowest rounded-xl shadow-card flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-primary-fixed/50 text-primary">
                  <span className="material-symbols-outlined text-[20px]">psychology</span>
                </div>
                <div>
                  <span className="font-headline text-label-sm uppercase text-outline">Idées émises</span>
                  <p className="font-headline text-headline-sm text-on-surface mt-0.5">{stats.ideas_total} contributions</p>
                  <p className="font-body text-body-sm text-on-surface-variant mt-1">{stats.ideas_retained} déjà retenues pour nourrir la Charte.</p>
                </div>
              </div>
              <div className="p-4 bg-surface-container-lowest rounded-xl shadow-card flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-secondary-fixed text-on-secondary-fixed-variant">
                  <span className="material-symbols-outlined text-[20px]">diversity_3</span>
                </div>
                <div>
                  <span className="font-headline text-label-sm uppercase text-outline">Convergence</span>
                  <p className="font-headline text-headline-sm text-on-surface mt-0.5">{stats.consensus_rate}% de consensus</p>
                  <p className="font-body text-body-sm text-on-surface-variant mt-1">Taux d'accord mesuré sur les sujets débattus.</p>
                </div>
              </div>
              <div className="p-4 bg-surface-container-lowest rounded-xl shadow-card flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-tertiary-fixed text-on-tertiary-fixed">
                  <span className="material-symbols-outlined text-[20px]">task_alt</span>
                </div>
                <div>
                  <span className="font-headline text-label-sm uppercase text-on-tertiary-fixed">Validations collégiales</span>
                  <p className="font-headline text-headline-sm text-on-surface mt-0.5">{stats.principles_adopted} principe(s) adopté(s)</p>
                  <p className="font-body text-body-sm text-on-surface-variant mt-1">Stabilisés par le collectif IAmbassadeurs.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Volet droit : principes en co-rédaction */}
        <div className="xl:col-span-4 flex flex-col gap-5">
          <PrinciplesPanel principles={principles} adopted={adopted} onChanged={loadAll} canInteract={canInteract} isIanimateur={isIanimateur} />
        </div>
      </div>
    </div>
  );
}

function NodeInspector({ node, principles, onLinked, canInteract }: { node: GraphNode; principles: Principle[]; onLinked: () => void; canInteract: boolean }) {
  const [target, setTarget] = useState('');
  const [sourceType, sourceId] = node.id.split(':');
  return (
    <div className="mt-2 p-3.5 bg-surface-container-low rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold font-headline text-label-sm shrink-0">
          {TYPE_LABELS[node.type]?.[0] || '?'}
        </div>
        <div className="min-w-0">
          <p className="font-headline text-headline-sm text-on-surface truncate">{node.label || `#${sourceId}`}</p>
          <p className="font-body text-body-sm text-on-surface-variant">
            {TYPE_LABELS[node.type] || node.type}{node.author_name ? ` • par ${node.author_name}` : ''}{node.direction ? ` • ${node.direction}` : ''}
          </p>
        </div>
      </div>
      {canInteract && node.type !== 'cluster' && (
        <div className="flex items-center gap-2 shrink-0">
          <StitchSelect className="!w-44 !py-1.5" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Principe cible">
            <option value="">Lier à un principe…</option>
            {principles.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </StitchSelect>
          <PrimaryButton
            icon="link"
            onClick={async () => { if (target) { await createLink({ source_type: sourceType, source_id: Number(sourceId), target_type: 'principle', target_id: Number(target) }); setTarget(''); onLinked(); } }}
          >
            Lier
          </PrimaryButton>
        </div>
      )}
    </div>
  );
}

function ConsensusPanel({ data }: { data: any }) {
  const p = data.parsed;
  return (
    <div className="flex-1 bg-surface-container-low/50 rounded-xl p-6 space-y-4 overflow-y-auto">
      <h3 className="font-headline text-headline-sm text-primary flex items-center gap-2">
        <span className="material-symbols-outlined text-[20px] text-secondary">bolt</span>
        Consensus &amp; controverses détectés
      </h3>
      {p ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {p.consensus && <ConsensusSection title="Idées consensuelles" items={p.consensus} tone="bg-tertiary-fixed/40" icon="handshake" />}
          {p.controverses && <ConsensusSection title="Sujets controversés" items={p.controverses} tone="bg-error-container/40" icon="bolt" />}
          {p.insuffisants && <ConsensusSection title="Sujets insuffisamment débattus" items={p.insuffisants} tone="bg-secondary-fixed/50" icon="hourglass_empty" />}
          {p.prioritaires && <ConsensusSection title="Sujets prioritaires" items={p.prioritaires} tone="bg-primary-fixed/50" icon="priority_high" />}
        </div>
      ) : <p className="whitespace-pre-wrap font-body text-body-md text-on-surface">{data.raw}</p>}
      <p className="font-body text-body-sm text-secondary">Analyse générée par IA — à vérifier.</p>
    </div>
  );
}

function ConsensusSection({ title, items, tone, icon }: { title: string; items: any[]; tone: string; icon: string }) {
  return (
    <div className={`rounded-xl p-4 ${tone}`}>
      <div className="flex items-center gap-2 font-headline text-label-md text-on-surface mb-2">
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
        {title}
      </div>
      <ul className="list-disc pl-5 font-body text-body-sm text-on-surface-variant space-y-1">
        {items.map((it, i) => <li key={i}>{typeof it === 'string' ? it : it.label || JSON.stringify(it)}</li>)}
      </ul>
    </div>
  );
}

function PrinciplesPanel({ principles, adopted, onChanged, canInteract, isIanimateur }: {
  principles: Principle[]; adopted: number; onChanged: () => void; canInteract: boolean; isIanimateur: boolean;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');

  return (
    <SectionCard className="p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[22px]">gavel</span>
          <h2 className="font-headline text-headline-md text-primary">Principes en co-rédaction</h2>
        </div>
        <span className="font-headline text-label-sm px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-bold">{adopted}/{principles.length} adoptés</span>
      </div>
      <p className="font-body text-body-sm text-on-surface-variant">Suivi du consensus municipal et intégration progressive des recommandations citoyennes.</p>

      <div className="flex flex-col gap-3.5 max-h-[520px] overflow-y-auto pr-1">
        {principles.length === 0 && <p className="font-body text-body-sm text-outline">Aucun principe proposé pour l'instant.</p>}
        {principles.map((p) => (
          <div key={p.id} className={`p-3.5 rounded-xl transition-all ${p.status === 'adopted' ? 'bg-surface-container-low hover:bg-surface-container' : 'bg-surface-container-high'}`}>
            {editId === p.id ? (
              <div className="space-y-2">
                <StitchInput value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                <StitchTextarea rows={3} value={editBody} onChange={(e) => setEditBody(e.target.value)} />
                <div className="flex gap-2">
                  <PrimaryButton icon="save" onClick={async () => { await updatePrinciple(p.id, { title: editTitle, body: editBody }); setEditId(null); onChanged(); }}>Enregistrer</PrimaryButton>
                  <GhostButton icon="close" onClick={() => setEditId(null)}>Annuler</GhostButton>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-headline text-label-sm font-bold text-primary shrink-0">#{String(p.id).padStart(2, '0')}</span>
                    <h3 className="font-headline text-headline-sm text-on-surface">{p.title}</h3>
                  </div>
                  {p.status === 'adopted' ? (
                    <span className="inline-flex items-center gap-1 font-headline text-label-sm px-2.5 py-0.5 rounded-full bg-tertiary-container text-on-tertiary-container shrink-0">
                      <span className="material-symbols-outlined text-[14px]">verified</span>
                      <span>Adopté</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-headline text-label-sm px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-bold shrink-0">
                      <span className="material-symbols-outlined text-[14px]">forum</span>
                      <span>En débat</span>
                    </span>
                  )}
                </div>
                <p className="font-body text-body-sm text-on-surface-variant mt-2">{p.body}</p>
                <div className="mt-3 pt-3 flex flex-wrap items-center justify-between gap-2 font-headline text-label-sm text-outline">
                  <span className="flex items-center gap-1 text-on-surface">
                    <span className="material-symbols-outlined text-[15px] text-secondary">link</span>
                    {p.links_count} contribution(s) reliée(s)
                  </span>
                  <span className="text-outline">par {p.created_by_name}</span>
                </div>
                {isIanimateur && (
                  <div className="mt-2 flex flex-wrap items-center gap-3 font-headline text-label-sm">
                    {p.status === 'draft' ? (
                      <button className="inline-flex items-center gap-1 text-tertiary hover:underline" onClick={async () => { await setPrincipleStatus(p.id, 'adopted'); onChanged(); }}>
                        <span className="material-symbols-outlined text-[15px]">check</span> Adopter
                      </button>
                    ) : (
                      <button className="inline-flex items-center gap-1 text-on-surface-variant hover:underline" onClick={async () => { await setPrincipleStatus(p.id, 'draft'); onChanged(); }}>
                        <span className="material-symbols-outlined text-[15px]">undo</span> Repasser en débat
                      </button>
                    )}
                    <button className="inline-flex items-center gap-1 text-on-surface-variant hover:text-primary" onClick={() => { setEditId(p.id); setEditTitle(p.title); setEditBody(p.body); }}>
                      <span className="material-symbols-outlined text-[15px]">edit</span> Éditer
                    </button>
                    <button className="inline-flex items-center gap-1 text-on-surface-variant hover:text-error" onClick={async () => { if (window.confirm('Supprimer ce principe ?')) { await deletePrinciple(p.id); onChanged(); } }}>
                      <span className="material-symbols-outlined text-[15px]">delete</span> Supprimer
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {canInteract && (
        <div className="space-y-2 pt-3 border-t border-surface-container-low">
          <span className="font-headline text-label-md text-on-surface">Proposer un nouveau principe</span>
          <StitchInput placeholder="Titre du principe" value={title} onChange={(e) => setTitle(e.target.value)} />
          <StitchTextarea rows={2} placeholder="Proposition de rédaction" value={body} onChange={(e) => setBody(e.target.value)} />
          <PrimaryButton
            icon="add"
            onClick={async () => { if (title && body) { await createPrinciple({ title, body }); setTitle(''); setBody(''); onChanged(); } }}
          >
            Proposer un principe
          </PrimaryButton>
        </div>
      )}
    </SectionCard>
  );
}
