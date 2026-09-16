import { useEffect, useState } from 'react';
import { BarChart3, Users, Star, ShieldAlert, Sparkles } from 'lucide-react';
import { Card, PageTitle, Field, Input, Spinner, Alert, Button } from '../components/ui';
import { getActivity, getConsensus, getDigestQuality, getInteractions, getKpis } from '../api/endpoints';
import { errMsg } from '../api/client';

export default function Analytics() {
  const [kpis, setKpis] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [digests, setDigests] = useState<any[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');
  const [consensus, setConsensus] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true); setError('');
    try {
      const [k, a, i, d] = await Promise.all([
        getKpis(),
        getActivity({ from: from || undefined, to: to || undefined }),
        getInteractions({ from: from || undefined, to: to || undefined }),
        getDigestQuality(),
      ]);
      setKpis(k); setActivity(a); setInteractions(i); setDigests(d);
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <div>
      <PageTitle title="Analyse" subtitle="Pilotage de la démarche — réservé aux IAnimateurs." />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      {kpis && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Comptes', value: kpis.users_total },
            { label: 'Comptes actifs', value: `${kpis.users_active} (${kpis.participation_rate}%)` },
            { label: 'Ressources', value: kpis.resources },
            { label: 'Commentaires', value: kpis.comments },
            { label: 'Risques', value: kpis.risks },
            { label: 'Expérimentations', value: kpis.experiments },
            { label: 'Sessions de vote', value: kpis.vote_sessions },
          ].map((s) => (
            <Card key={s.label} className="p-4"><div className="text-xl font-semibold text-ville-600">{s.value}</div><div className="text-xs text-slate-500">{s.label}</div></Card>
          ))}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <Field label="Du"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Au"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Button variant="secondary" onClick={load}>Filtrer</Button>
        <Button variant="secondary" disabled={busy} onClick={async () => {
          setBusy(true); setError('');
          try { setConsensus(await getConsensus()); } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
        }}><Sparkles size={16} /> Consensus & controverses (IA)</Button>
      </div>

      {consensus && (
        <Card className="mb-6 p-5">
          <h3 className="mb-2 font-semibold">Points de débat et de consensus</h3>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{consensus.parsed ? JSON.stringify(consensus.parsed, null, 2) : consensus.raw}</p>
          <p className="mt-2 text-xs text-purple-700">Généré par IA — à vérifier.</p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold"><BarChart3 size={16} /> Activité par utilisateur</h3>
          <TableRow titles={['Utilisateur', 'Ress.', 'Comm.', 'Risques', 'Expé.', 'Votes']}
            rows={activity.map((a) => [a.display_name, a.resources, a.comments, a.risks, a.experiments, a.votes])} />
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold"><Users size={16} /> Interactions (réponses à …)</h3>
          <TableRow titles={['De', 'Vers', 'Réponses']} rows={interactions.map((i) => [i.from, i.to, i.replies])} />
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold"><Star size={16} /> Ressources les mieux notées</h3>
          <TableRow titles={['Ressource', 'Note', 'Votes']} rows={(kpis?.top_resources || []).map((r: any) => [r.title, r.avg_stars, r.votes])} />
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold"><ShieldAlert size={16} /> Risques les plus qualifiés</h3>
          <TableRow titles={['Risque', 'Imp.', 'Prob.']} rows={(kpis?.top_risks || []).map((r: any) => [r.title, r.importance, r.probability])} />
        </Card>
        <Card className="p-5 lg:col-span-2">
          <h3 className="mb-3 font-semibold">Qualité des résumés IA (digests)</h3>
          <TableRow titles={['Période', 'Digests', 'Notés', 'Note moyenne']}
            rows={digests.map((d) => [d.period, d.digests, d.notes, d.moyenne ?? d.note_moyenne])} />
        </Card>
      </div>
    </div>
  );
}

function TableRow({ titles, rows }: { titles: string[]; rows: any[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500">{titles.map((t) => <th key={t} className="px-2 py-2">{t}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={titles.length} className="px-2 py-4 text-slate-400">Aucune donnée.</td></tr>}
          {rows.map((r, i) => <tr key={i} className="border-b border-slate-100">{r.map((c, j) => <td key={j} className="px-2 py-2">{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}
