import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, History } from 'lucide-react';
import { Card, PageTitle, Spinner, Alert, Badge, Button, Select, Textarea, Field } from '../components/ui';
import AiPanel from '../components/AiPanel';
import CommentThread from '../components/CommentThread';
import { amendRisk, getRisk, synthRisk } from '../api/endpoints';
import { errMsg } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import type { Risk } from '../types';

export default function RiskDetail() {
  const { id } = useParams();
  const rid = Number(id);
  const { isIanimateur } = useAuth();
  const [r, setR] = useState<Risk | null>(null);
  const [error, setError] = useState('');
  const [importance, setImportance] = useState(1);
  const [probability, setProbability] = useState(1);
  const [reason, setReason] = useState('');

  async function load() {
    try { const data = await getRisk(rid); setR(data); setImportance(data.importance); setProbability(data.probability); }
    catch (e) { setError(errMsg(e)); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [rid]);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!r) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <div>
      <Link to="/risques" className="mb-4 inline-flex items-center gap-1 text-sm text-ville-600 hover:underline"><ArrowLeft size={16} /> Retour</Link>
      <PageTitle title={r.title} subtitle={`Proposé par ${r.proposed_by_name}`}
        action={<div className="flex gap-2"><Badge color="red">Importance {r.importance}/4</Badge><Badge color="amber">Probabilité {r.probability}/4</Badge></div>} />

      <Card className="mb-6 p-5"><p className="whitespace-pre-wrap text-slate-700">{r.description}</p>
        {!r.concerns_ivry && <p className="mt-2 text-sm text-slate-500">Ce risque ne concerne pas directement Ivry.</p>}
      </Card>

      {isIanimateur && (
        <Card className="mb-6 space-y-3 p-5">
          <h3 className="font-semibold">Amender (IAnimateur)</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Importance"><Select value={importance} onChange={(e) => setImportance(Number(e.target.value))}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}★</option>)}</Select></Field>
            <Field label="Probabilité"><Select value={probability} onChange={(e) => setProbability(Number(e.target.value))}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}★</option>)}</Select></Field>
          </div>
          <Field label="Motif"><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <Button onClick={async () => { await amendRisk(rid, { importance, probability, reason }); setReason(''); load(); }}>Enregistrer l’amendement</Button>
        </Card>
      )}

      {r.amendments && r.amendments.length > 0 && (
        <Card className="mb-6 p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold"><History size={16} /> Historique des amendements</h3>
          <ul className="space-y-2 text-sm">
            {r.amendments.map((a) => (
              <li key={a.id} className="border-l-2 border-slate-200 pl-3">
                <span className="font-medium">{a.amended_by_name}</span> — importance {a.importance}/4, probabilité {a.probability}/4
                <span className="text-slate-500"> le {new Date(a.created_at).toLocaleDateString('fr-FR')}</span>
                {a.reason && <div className="text-slate-600">« {a.reason} »</div>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mb-6"><AiPanel label="Synthétiser le risque et son débat" run={() => synthRisk(rid)} /></div>
      <CommentThread entityType="risk" entityId={rid} />
    </div>
  );
}
