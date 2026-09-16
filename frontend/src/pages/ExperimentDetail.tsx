import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, UserPlus, UserMinus, Pencil, Trash2, Save } from 'lucide-react';
import { Card, PageTitle, Spinner, Alert, Badge, Button, Select, Input, Textarea, Field } from '../components/ui';
import AiPanel from '../components/AiPanel';
import CommentThread from '../components/CommentThread';
import { deleteExperiment, getExperiment, joinExperiment, synthExperiment, updateExperiment, updateExperimentStatus } from '../api/endpoints';
import { errMsg } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import type { Experiment } from '../types';

const STATUS: Record<string, { label: string; color: string }> = {
  planned: { label: 'Planifiée', color: 'blue' },
  ongoing: { label: 'En cours', color: 'amber' },
  completed: { label: 'Terminée', color: 'green' },
  abandoned: { label: 'Abandonnée', color: 'red' },
};

export default function ExperimentDetail() {
  const { id } = useParams();
  const eid = Number(id);
  const navigate = useNavigate();
  const { user, canInteract, isIanimateur } = useAuth();
  const [e, setE] = useState<Experiment | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', objective: '', target_date: '', status: 'planned' });

  async function load() {
    try {
      const data = await getExperiment(eid);
      setE(data);
      setForm({ title: data.title, description: data.description, objective: data.objective, target_date: data.target_date || '', status: data.status });
    } catch (err) { setError(errMsg(err)); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [eid]);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!e) return <div className="flex justify-center py-12"><Spinner /></div>;

  const canEdit = isIanimateur || e.created_by === user?.id;

  async function save() {
    try { await updateExperiment(eid, { ...form, target_date: form.target_date || null }); setEditing(false); load(); }
    catch (err) { setError(errMsg(err)); }
  }
  async function remove() {
    if (!window.confirm('Supprimer définitivement cette expérimentation et sa discussion ?')) return;
    try { await deleteExperiment(eid); navigate('/experimentations'); }
    catch (err) { setError(errMsg(err)); }
  }

  return (
    <div>
      <Link to="/experimentations" className="mb-4 inline-flex items-center gap-1 text-sm text-ville-600 hover:underline"><ArrowLeft size={16} /> Retour</Link>
      <PageTitle title={e.title} subtitle={`Créée par ${e.created_by_name}`}
        action={
          <div className="flex items-center gap-2">
            <Badge color={STATUS[e.status].color}>{STATUS[e.status].label}</Badge>
            {canEdit && !editing && <Button variant="secondary" onClick={() => setEditing(true)}><Pencil size={16} /> Éditer</Button>}
            {canEdit && <Button variant="danger" onClick={remove}><Trash2 size={16} /> Supprimer</Button>}
          </div>
        } />

      {editing ? (
        <Card className="mb-6 space-y-3 p-5">
          <Field label="Titre"><Input value={form.title} onChange={(ev) => setForm({ ...form, title: ev.target.value })} /></Field>
          <Field label="Quoi ?"><Textarea rows={3} value={form.description} onChange={(ev) => setForm({ ...form, description: ev.target.value })} /></Field>
          <Field label="Pourquoi ?"><Textarea rows={3} value={form.objective} onChange={(ev) => setForm({ ...form, objective: ev.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Pour quand ?"><Input type="date" value={form.target_date || ''} onChange={(ev) => setForm({ ...form, target_date: ev.target.value })} /></Field>
            <Field label="Statut">
              <Select value={form.status} onChange={(ev) => setForm({ ...form, status: ev.target.value })}>
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </Select>
            </Field>
          </div>
          <div className="flex gap-2">
            <Button onClick={save}><Save size={16} /> Enregistrer</Button>
            <Button variant="secondary" onClick={() => setEditing(false)}>Annuler</Button>
          </div>
        </Card>
      ) : (
        <Card className="mb-6 space-y-4 p-5">
          <div><div className="text-sm font-medium text-slate-500">Quoi</div><p className="whitespace-pre-wrap text-slate-800">{e.description}</p></div>
          <div><div className="text-sm font-medium text-slate-500">Pourquoi</div><p className="whitespace-pre-wrap text-slate-800">{e.objective}</p></div>
          {e.target_date && <div className="text-sm text-slate-600">Pour quand : {new Date(e.target_date).toLocaleDateString('fr-FR')}</div>}
          <div>
            <div className="mb-1 flex items-center gap-1 text-sm font-medium text-slate-500"><Users size={15} /> Participants ({e.participants?.length || 0})</div>
            <div className="flex flex-wrap gap-2">{(e.participants || []).map((p) => <Badge key={p.id} color="blue">{p.display_name}</Badge>)}</div>
          </div>
          {canInteract && (
            <Button variant={e.joined ? 'secondary' : 'primary'} onClick={async () => { await joinExperiment(eid); load(); }}>
              {e.joined ? <><UserMinus size={16} /> Me retirer</> : <><UserPlus size={16} /> Rejoindre</>}
            </Button>
          )}
          {canEdit && (
            <div className="max-w-xs">
              <label className="mb-1 block text-sm font-medium text-slate-700">Changer le statut</label>
              <Select value={e.status} onChange={async (ev) => { await updateExperimentStatus(eid, ev.target.value); load(); }}>
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </Select>
            </div>
          )}
        </Card>
      )}

      <div className="mb-6"><AiPanel label="Synthétiser l’expérimentation" run={() => synthExperiment(eid)} /></div>
      <CommentThread entityType="experiment" entityId={eid} />
    </div>
  );
}
