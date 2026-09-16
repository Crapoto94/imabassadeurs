import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, History, Pencil, Trash2, Save } from 'lucide-react';
import { Card, PageTitle, Spinner, Alert, Badge, Button, Select, Textarea, Input, Field } from '../components/ui';
import AiPanel from '../components/AiPanel';
import CommentThread from '../components/CommentThread';
import { amendRisk, deleteRisk, getRisk, synthRisk, updateRisk } from '../api/endpoints';
import { errMsg } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import type { Risk } from '../types';

export default function RiskDetail() {
  const { id } = useParams();
  const rid = Number(id);
  const navigate = useNavigate();
  const { isIanimateur } = useAuth();
  const [r, setR] = useState<Risk | null>(null);
  const [error, setError] = useState('');
  const [importance, setImportance] = useState(1);
  const [probability, setProbability] = useState(1);
  const [reason, setReason] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', concerns_ivry: true, importance: 1, probability: 1, reason: '' });

  async function load() {
    try {
      const data = await getRisk(rid);
      setR(data); setImportance(data.importance); setProbability(data.probability);
      setForm({ title: data.title, description: data.description, concerns_ivry: data.concerns_ivry, importance: data.importance, probability: data.probability, reason: '' });
    } catch (e) { setError(errMsg(e)); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [rid]);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!r) return <div className="flex justify-center py-12"><Spinner /></div>;

  async function save() {
    try { await updateRisk(rid, form); setEditing(false); load(); }
    catch (e) { setError(errMsg(e)); }
  }
  async function remove() {
    if (!window.confirm('Supprimer définitivement ce risque et sa discussion ?')) return;
    try { await deleteRisk(rid); navigate('/risques'); }
    catch (e) { setError(errMsg(e)); }
  }

  return (
    <div>
      <Link to="/risques" className="mb-4 inline-flex items-center gap-1 text-sm text-ville-600 hover:underline"><ArrowLeft size={16} /> Retour</Link>
      <PageTitle title={r.title} subtitle={`Proposé par ${r.proposed_by_name}`}
        action={
          <div className="flex items-center gap-2">
            <Badge color="red">Importance {r.importance}/4</Badge>
            <Badge color="amber">Probabilité {r.probability}/4</Badge>
            {isIanimateur && !editing && <Button variant="secondary" onClick={() => setEditing(true)}><Pencil size={16} /> Éditer</Button>}
            {isIanimateur && <Button variant="danger" onClick={remove}><Trash2 size={16} /> Supprimer</Button>}
          </div>
        } />

      {editing ? (
        <Card className="mb-6 space-y-3 p-5">
          <Field label="Titre"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Description"><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Concerne Ivry">
              <Select value={form.concerns_ivry ? 'true' : 'false'} onChange={(e) => setForm({ ...form, concerns_ivry: e.target.value === 'true' })}>
                <option value="true">Oui</option><option value="false">Non</option>
              </Select>
            </Field>
            <Field label="Importance"><Select value={form.importance} onChange={(e) => setForm({ ...form, importance: Number(e.target.value) })}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}★</option>)}</Select></Field>
            <Field label="Probabilité"><Select value={form.probability} onChange={(e) => setForm({ ...form, probability: Number(e.target.value) })}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}★</option>)}</Select></Field>
          </div>
          <Field label="Motif (si importance/probabilité modifiées)"><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
          <div className="flex gap-2">
            <Button onClick={save}><Save size={16} /> Enregistrer</Button>
            <Button variant="secondary" onClick={() => setEditing(false)}>Annuler</Button>
          </div>
        </Card>
      ) : (
        <Card className="mb-6 p-5"><p className="whitespace-pre-wrap text-slate-700">{r.description}</p>
          {!r.concerns_ivry && <p className="mt-2 text-sm text-slate-500">Ce risque ne concerne pas directement Ivry.</p>}
        </Card>
      )}

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
