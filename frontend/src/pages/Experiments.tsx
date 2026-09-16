import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users, Calendar, MessageSquare } from 'lucide-react';
import { Card, PageTitle, Button, Field, Input, Textarea, Select, Badge, Spinner, EmptyState, Alert } from '../components/ui';
import Pagination from '../components/Pagination';
import { createExperiment, getExperiments } from '../api/endpoints';
import { errMsg } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import type { Experiment } from '../types';

const STATUS: Record<string, { label: string; color: string }> = {
  planned: { label: 'Planifiée', color: 'blue' },
  ongoing: { label: 'En cours', color: 'amber' },
  completed: { label: 'Terminée', color: 'green' },
  abandoned: { label: 'Abandonnée', color: 'red' },
};

export default function Experiments() {
  const { canInteract } = useAuth();
  const [items, setItems] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 12;
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    try { setItems(await getExperiments({ limit, offset, status: status || undefined })); }
    catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [offset, status]);

  return (
    <div>
      <PageTitle title="Expérimentations" subtitle="Suivi façon mode projet des expérimentations IA."
        action={canInteract && <Button onClick={() => setShowForm((v) => !v)}><Plus size={16} /> Nouvelle expérimentation</Button>} />
      {showForm && <CreateForm onDone={() => { setShowForm(false); setOffset(0); load(); }} onCancel={() => setShowForm(false)} />}
      <div className="mb-4">
        <Field label="Statut">
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setOffset(0); }}>
            <option value="">Tous</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
        </Field>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {loading ? <div className="flex justify-center py-8"><Spinner /></div>
        : items.length === 0 ? <EmptyState>Aucune expérimentation.</EmptyState>
        : <div className="grid gap-4 sm:grid-cols-2">
            {items.map((e) => (
              <Link key={e.id} to={`/experimentations/${e.id}`}>
                <Card className="h-full p-5 transition hover:border-ville-500 hover:shadow-md">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="font-semibold text-slate-900">{e.title}</div>
                    <Badge color={STATUS[e.status].color}>{STATUS[e.status].label}</Badge>
                  </div>
                  <p className="line-clamp-2 text-sm text-slate-600">{e.objective}</p>
                  <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1"><Users size={14} /> {e.participants_count}</span>
                    {e.target_date && <span className="inline-flex items-center gap-1"><Calendar size={14} /> {new Date(e.target_date).toLocaleDateString('fr-FR')}</span>}
                    <span className="inline-flex items-center gap-1"><MessageSquare size={14} /> {e.comments_count}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>}
      <Pagination offset={offset} limit={limit} count={items.length} onChange={setOffset} />
    </div>
  );
}

function CreateForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [objective, setObjective] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { await createExperiment({ title, description, objective, target_date: targetDate || null }); onDone(); }
    catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  }

  return (
    <Card className="mb-6 p-5">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Titre"><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></Field>
        <Field label="Quoi ? (description)"><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} required /></Field>
        <Field label="Pourquoi ? (objectif)"><Textarea rows={3} value={objective} onChange={(e) => setObjective(e.target.value)} required /></Field>
        <Field label="Pour quand ? (date cible)"><Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} /></Field>
        {error && <Alert kind="error">{error}</Alert>}
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>{busy ? 'Envoi…' : 'Créer'}</Button>
          <Button variant="secondary" onClick={onCancel}>Annuler</Button>
        </div>
      </form>
    </Card>
  );
}
