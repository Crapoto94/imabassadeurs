import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Vote as VoteIcon } from 'lucide-react';
import { Card, PageTitle, Button, Field, Input, Textarea, Select, Badge, Spinner, EmptyState, Alert } from '../components/ui';
import { createVote, getVotes } from '../api/endpoints';
import { errMsg } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import type { VoteSession } from '../types';

export default function Votes() {
  const { isIanimateur } = useAuth();
  const [items, setItems] = useState<VoteSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    try { setItems(await getVotes()); } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  return (
    <div>
      <PageTitle title="Vote" subtitle="Sessions de vote de la démarche — résultats visibles de tous."
        action={isIanimateur && <Button onClick={() => setShowForm((v) => !v)}><Plus size={16} /> Nouvelle session</Button>} />
      {showForm && <CreateForm onDone={() => { setShowForm(false); load(); }} onCancel={() => setShowForm(false)} />}
      {error && <Alert kind="error">{error}</Alert>}
      {loading ? <div className="flex justify-center py-8"><Spinner /></div>
        : items.length === 0 ? <EmptyState>Aucune session de vote.</EmptyState>
        : <div className="grid gap-4 sm:grid-cols-2">
            {items.map((s) => (
              <Link key={s.id} to={`/votes/${s.id}`}>
                <Card className="h-full p-5 transition hover:border-ville-500 hover:shadow-md">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 font-semibold text-slate-900"><VoteIcon size={18} className="text-ville-500" /> {s.question}</div>
                    <Badge color={s.status === 'open' ? 'green' : 'slate'}>{s.status === 'open' ? 'Ouvert' : 'Clos'}</Badge>
                  </div>
                  <div className="text-xs text-slate-500">
                    Mode {s.mode === 'open' ? 'libre' : 'fermé'} · {s.total_votes} vote(s) · {s.options.length} option(s)
                    {s.my_option_id && <span className="ml-2 text-ville-600">Vous avez voté</span>}
                  </div>
                </Card>
              </Link>
            ))}
          </div>}
    </div>
  );
}

function CreateForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [question, setQuestion] = useState('');
  const [mode, setMode] = useState<'closed' | 'open'>('closed');
  const [allowWriteIn, setAllowWriteIn] = useState(false);
  const [options, setOptions] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await createVote({
        question, mode, allow_write_in: allowWriteIn,
        options: mode === 'closed' ? options.split('\n').map((s) => s.trim()).filter(Boolean) : [],
        closes_at: closesAt || null,
      });
      onDone();
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  }

  return (
    <Card className="mb-6 p-5">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Question"><Input value={question} onChange={(e) => setQuestion(e.target.value)} required /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Mode">
            <Select value={mode} onChange={(e) => setMode(e.target.value as any)}>
              <option value="closed">Fermé (options prédéfinies)</option>
              <option value="open">Libre (options proposées par les votants)</option>
            </Select>
          </Field>
          <Field label="Date de clôture"><Input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} /></Field>
        </div>
        {mode === 'closed' && (
          <>
            <Field label="Options (une par ligne, min. 2)"><Textarea rows={4} value={options} onChange={(e) => setOptions(e.target.value)} required /></Field>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={allowWriteIn} onChange={(e) => setAllowWriteIn(e.target.checked)} /> Autoriser une réponse libre en plus
            </label>
          </>
        )}
        {error && <Alert kind="error">{error}</Alert>}
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>{busy ? 'Création…' : 'Créer la session'}</Button>
          <Button variant="secondary" onClick={onCancel}>Annuler</Button>
        </div>
      </form>
    </Card>
  );
}
