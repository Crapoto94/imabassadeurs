import { useEffect, useMemo, useState } from 'react';
import { Network, Sparkles, Plus, Check, Undo2, Lightbulb, Clock, Flame, Pencil, Trash2, Save, X } from 'lucide-react';
import { Card, PageTitle, Button, Select, Input, Badge, Spinner, Alert, Field, Textarea } from '../components/ui';
import ForceGraph, { GraphNode } from '../components/ForceGraph';
import { createLink, createPrinciple, deletePrinciple, generateClusters, getConsensus, getGraph, getPrinciples, getStats, setPrincipleStatus, updatePrinciple } from '../api/endpoints';
import { errMsg } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import type { GraphData, Principle } from '../types';

const TYPE_LABELS: Record<string, string> = {
  resource: 'Ressources', risk: 'Risques', experiment: 'Expérimentations', comment: 'Commentaires', principle: 'Principes', cluster: 'Thèmes IA',
};

export default function Mapping() {
  const { canInteract, isIanimateur } = useAuth();
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [principles, setPrinciples] = useState<Principle[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
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

  const directions = useMemo(() => [...new Set((graph?.nodes || []).map((n) => n.direction).filter(Boolean))], [graph]);
  const services = useMemo(() => [...new Set((graph?.nodes || []).map((n) => n.service).filter(Boolean))], [graph]);

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
    try { setConsensus(await getConsensus()); }
    catch (e) { setError(errMsg(e)); } finally { setBusyIa(false); }
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <div>
      <PageTitle title="Cartographie des idées" subtitle="Visualisez les idées, débats et principes qui nourrissent la Charte." />

      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Idées émises', value: stats.ideas_total },
            { label: 'Idées retenues', value: stats.ideas_retained },
            { label: 'Taux de consensus', value: `${stats.consensus_rate} %` },
            { label: 'Principes adoptés', value: stats.principles_adopted },
          ].map((s) => (
            <Card key={s.label} className="p-4"><div className="text-2xl font-semibold text-ville-600">{s.value}</div><div className="text-xs text-slate-500">{s.label}</div></Card>
          ))}
        </div>
      )}

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Rechercher"><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Mot-clé" /></Field>
          <Field label="Direction"><Select value={direction} onChange={(e) => setDirection(e.target.value)}><option value="">Toutes</option>{directions.map((d) => <option key={d} value={d}>{d}</option>)}</Select></Field>
          <Field label="Service / métier"><Select value={service} onChange={(e) => setService(e.target.value)}><option value="">Tous</option>{services.map((d) => <option key={d} value={d}>{d}</option>)}</Select></Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(TYPE_LABELS).map(([type, label]) => (
            <button key={type} onClick={() => setTypeFilter((f) => f.includes(type) ? f.filter((x) => x !== type) : [...f, type])}
              className={`rounded-full px-3 py-1 text-xs ${typeFilter.includes(type) ? 'bg-ville-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {isIanimateur && <Button variant="secondary" onClick={runClusters} disabled={busyIa}><Sparkles size={16} /> Générer les thèmes (IA)</Button>}
          {canInteract && <Button variant="secondary" onClick={runConsensus} disabled={busyIa}><Sparkles size={16} /> Analyser consensus & controverses (IA)</Button>}
        </div>
      </Card>

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ForceGraph nodes={filteredNodes} edges={filteredEdges} onSelect={setSelected} selectedId={selected?.id} />
        </div>
        <div className="space-y-4">
          <NodeInspector node={selected} principles={principles} onLinked={loadAll} canInteract={canInteract} />
          {consensus && <ConsensusPanel data={consensus} />}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold"><Lightbulb size={16} /> Nuage de concepts</h3>
          <div className="flex flex-wrap items-center gap-2">
            {conceptCloud.map(([w, c]) => (
              <span key={w} style={{ fontSize: 12 + Math.min(c, 6) * 3 }} className="text-ville-600" title={`${c} occurrence(s)`}>{w}</span>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold"><Clock size={16} /> Frise chronologique</h3>
          <div className="space-y-1 text-sm">
            {timeline.map(([m, c]) => (
              <div key={m} className="flex items-center gap-2">
                <span className="w-20 text-xs text-slate-500">{m}</span>
                <div className="h-3 rounded bg-ville-500" style={{ width: `${Math.min(100, c * 8)}%` }} />
                <span className="text-xs text-slate-500">{c}</span>
              </div>
            ))}
            {timeline.length === 0 && <span className="text-slate-400">Aucune activité.</span>}
          </div>
        </Card>
        <PrinciplesPanel principles={principles} onChanged={loadAll} canInteract={canInteract} isIanimateur={isIanimateur} />
      </div>
    </div>
  );
}

function NodeInspector({ node, principles, onLinked, canInteract }: { node: GraphNode | null; principles: Principle[]; onLinked: () => void; canInteract: boolean }) {
  const [target, setTarget] = useState('');
  if (!node) return <Card className="p-5 text-sm text-slate-500">Cliquez un élément du graphe pour afficher son détail.</Card>;
  const [sourceType, sourceId] = node.id.split(':');
  return (
    <Card className="p-5">
      <div className="mb-2"><Badge color="blue">{TYPE_LABELS[node.type] || node.type}</Badge></div>
      <h3 className="font-semibold text-slate-900">{node.label || `#${sourceId}`}</h3>
      {node.author_name && <p className="text-xs text-slate-500">par {node.author_name}{node.direction ? ` · ${node.direction}` : ''}</p>}
      {canInteract && node.type !== 'cluster' && (
        <div className="mt-3 space-y-2">
          <Field label="Relier à un principe de Charte">
            <Select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">— choisir —</option>
              {principles.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </Select>
          </Field>
          <Button onClick={async () => { if (target) { await createLink({ source_type: sourceType, source_id: Number(sourceId), target_type: 'principle', target_id: Number(target) }); setTarget(''); onLinked(); } }}>
            <Plus size={16} /> Créer le lien
          </Button>
        </div>
      )}
    </Card>
  );
}

function ConsensusPanel({ data }: { data: any }) {
  const p = data.parsed;
  return (
    <Card className="p-5">
      <h3 className="mb-2 flex items-center gap-2 font-semibold"><Flame size={16} /> Consensus & controverses</h3>
      {p ? (
        <div className="space-y-2 text-sm">
          {p.consensus && <Section title="Idées consensuelles" items={p.consensus} />}
          {p.controverses && <Section title="Sujets controversés" items={p.controverses} />}
          {p.insuffisants && <Section title="Sujets insuffisamment débattus" items={p.insuffisants} />}
          {p.prioritaires && <Section title="Sujets prioritaires" items={p.prioritaires} />}
        </div>
      ) : <p className="whitespace-pre-wrap text-sm text-slate-700">{data.raw}</p>}
      <p className="mt-2 text-xs text-purple-700">Analyse générée par IA — à vérifier.</p>
    </Card>
  );
}
function Section({ title, items }: { title: string; items: any[] }) {
  return (
    <div>
      <div className="font-medium text-slate-700">{title}</div>
      <ul className="list-disc pl-5 text-slate-600">{items.map((it, i) => <li key={i}>{typeof it === 'string' ? it : it.label || JSON.stringify(it)}</li>)}</ul>
    </div>
  );
}

function PrinciplesPanel({ principles, onChanged, canInteract, isIanimateur }: { principles: Principle[]; onChanged: () => void; canInteract: boolean; isIanimateur: boolean }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  return (
    <Card className="p-5">
      <h3 className="mb-3 flex items-center gap-2 font-semibold"><Network size={16} /> Principes de Charte</h3>
      <ul className="mb-3 space-y-2">
        {principles.map((p) => (
          <li key={p.id} className="rounded border border-slate-200 p-2 text-sm">
            {editId === p.id ? (
              <div className="space-y-2">
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                <Textarea rows={3} value={editBody} onChange={(e) => setEditBody(e.target.value)} />
                <div className="flex gap-2">
                  <Button onClick={async () => { await updatePrinciple(p.id, { title: editTitle, body: editBody }); setEditId(null); onChanged(); }}><Save size={14} /> Enregistrer</Button>
                  <Button variant="secondary" onClick={() => setEditId(null)}><X size={14} /> Annuler</Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{p.title}</span>
                  <Badge color={p.status === 'adopted' ? 'green' : 'slate'}>{p.status === 'adopted' ? 'Adopté' : 'Brouillon'}</Badge>
                </div>
                <p className="text-slate-600">{p.body}</p>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span>{p.links_count} lien(s)</span>
                  {isIanimateur && (p.status === 'draft'
                    ? <button className="inline-flex items-center gap-1 text-emerald-700" onClick={async () => { await setPrincipleStatus(p.id, 'adopted'); onChanged(); }}><Check size={13} /> Adopter</button>
                    : <button className="inline-flex items-center gap-1 text-slate-600" onClick={async () => { await setPrincipleStatus(p.id, 'draft'); onChanged(); }}><Undo2 size={13} /> Repasser en brouillon</button>)}
                  {isIanimateur && (
                    <>
                      <button className="inline-flex items-center gap-1 text-slate-500 hover:text-ville-600" onClick={() => { setEditId(p.id); setEditTitle(p.title); setEditBody(p.body); }}><Pencil size={13} /> Éditer</button>
                      <button className="inline-flex items-center gap-1 text-slate-500 hover:text-red-600" onClick={async () => { if (window.confirm('Supprimer ce principe ?')) { await deletePrinciple(p.id); onChanged(); } }}><Trash2 size={13} /> Supprimer</button>
                    </>
                  )}
                </div>
              </>
            )}
          </li>
        ))}
        {principles.length === 0 && <li className="text-slate-400">Aucun principe.</li>}
      </ul>
      {canInteract && (
        <div className="space-y-2">
          <Input placeholder="Titre du principe" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea rows={2} placeholder="Proposition de rédaction" value={body} onChange={(e) => setBody(e.target.value)} />
          <Button onClick={async () => { if (title && body) { await createPrinciple({ title, body }); setTitle(''); setBody(''); onChanged(); } }}><Plus size={16} /> Proposer un principe</Button>
        </div>
      )}
    </Card>
  );
}
