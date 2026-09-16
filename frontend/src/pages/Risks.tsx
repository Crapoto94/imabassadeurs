import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ShieldAlert, MessageSquare } from 'lucide-react';
import { Card, PageTitle, Button, Field, Input, Textarea, Select, Badge, Spinner, EmptyState, Alert } from '../components/ui';
import Pagination from '../components/Pagination';
import { createRisk, getRisks } from '../api/endpoints';
import { errMsg } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import type { Risk } from '../types';

export default function Risks() {
  const { canInteract } = useAuth();
  const [items, setItems] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 12;
  const [concerns, setConcerns] = useState('');
  const [minImp, setMinImp] = useState('');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setItems(await getRisks({ limit, offset, concerns_ivry: concerns || undefined, min_importance: minImp || undefined }));
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [offset, concerns, minImp]);

  return (
    <div>
      <PageTitle title="Gestion des risques" subtitle="Recensez, qualifiez et débattez des risques liés à l’IA."
        action={canInteract && <Button onClick={() => setShowForm((v) => !v)}><Plus size={16} /> Proposer un risque</Button>} />
      {showForm && <CreateForm onDone={() => { setShowForm(false); setOffset(0); load(); }} onCancel={() => setShowForm(false)} />}
      <div className="mb-4 flex flex-wrap gap-4">
        <Field label="Concerne Ivry">
          <Select value={concerns} onChange={(e) => { setConcerns(e.target.value); setOffset(0); }}>
            <option value="">Tous</option><option value="true">Oui</option><option value="false">Non</option>
          </Select>
        </Field>
        <Field label="Importance minimale">
          <Select value={minImp} onChange={(e) => { setMinImp(e.target.value); setOffset(0); }}>
            <option value="">—</option>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}★</option>)}
          </Select>
        </Field>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {loading ? <div className="flex justify-center py-8"><Spinner /></div>
        : items.length === 0 ? <EmptyState>Aucun risque.</EmptyState>
        : <div className="grid gap-4 sm:grid-cols-2">
            {items.map((r) => (
              <Link key={r.id} to={`/risques/${r.id}`}>
                <Card className="h-full p-5 transition hover:border-ville-500 hover:shadow-md">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 font-semibold text-slate-900"><ShieldAlert size={18} className="text-amber-500" /> {r.title}</div>
                    {!r.concerns_ivry && <Badge color="slate">Hors Ivry</Badge>}
                  </div>
                  <p className="line-clamp-2 text-sm text-slate-600">{r.description}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <Badge color="red">Importance {r.importance}/4</Badge>
                    <Badge color="amber">Probabilité {r.probability}/4</Badge>
                    <span className="inline-flex items-center gap-1"><MessageSquare size={14} /> {r.comments_count}</span>
                    {r.amendments_count > 0 && <span>{r.amendments_count} amendement(s)</span>}
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
  const [concerns, setConcerns] = useState('true');
  const [importance, setImportance] = useState(2);
  const [probability, setProbability] = useState(2);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { await createRisk({ title, description, concerns_ivry: concerns === 'true', importance, probability } as any); onDone(); }
    catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  }

  return (
    <Card className="mb-6 p-5">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Titre"><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></Field>
        <Field label="Description"><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} required /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Concerne Ivry"><Select value={concerns} onChange={(e) => setConcerns(e.target.value)}><option value="true">Oui</option><option value="false">Non</option></Select></Field>
          <Field label="Importance (1-4)"><Select value={importance} onChange={(e) => setImportance(Number(e.target.value))}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}★</option>)}</Select></Field>
          <Field label="Probabilité (1-4)"><Select value={probability} onChange={(e) => setProbability(Number(e.target.value))}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}★</option>)}</Select></Field>
        </div>
        {error && <Alert kind="error">{error}</Alert>}
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>{busy ? 'Envoi…' : 'Proposer'}</Button>
          <Button variant="secondary" onClick={onCancel}>Annuler</Button>
        </div>
      </form>
    </Card>
  );
}
