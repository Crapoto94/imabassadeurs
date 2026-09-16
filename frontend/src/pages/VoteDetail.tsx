import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Lock, Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import { Card, PageTitle, Spinner, Alert, Badge, Button, Input, Textarea, Field } from '../components/ui';
import { addVoteOption, castVote, closeVote, deleteVote, deleteVoteOption, getVote, updateVote } from '../api/endpoints';
import { errMsg } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import type { VoteSession } from '../types';

export default function VoteDetail() {
  const { id } = useParams();
  const sid = Number(id);
  const navigate = useNavigate();
  const { canInteract, isIanimateur } = useAuth();
  const [s, setS] = useState<VoteSession | null>(null);
  const [error, setError] = useState('');
  const [newOption, setNewOption] = useState('');
  const [editing, setEditing] = useState(false);
  const [question, setQuestion] = useState('');

  async function load() {
    try { const data = await getVote(sid); setS(data); setQuestion(data.question); }
    catch (e) { setError(errMsg(e)); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [sid]);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!s) return <div className="flex justify-center py-12"><Spinner /></div>;

  const total = s.options.reduce((a, o) => a + o.votes, 0);
  const canAddOption = s.status === 'open' && canInteract && (s.mode === 'open' || s.allow_write_in);

  async function saveQuestion() {
    try { await updateVote(sid, { question, closes_at: s?.closes_at ?? null }); setEditing(false); load(); }
    catch (e) { setError(errMsg(e)); }
  }
  async function removeSession() {
    if (!window.confirm('Supprimer définitivement cette session de vote ?')) return;
    try { await deleteVote(sid); navigate('/votes'); }
    catch (e) { setError(errMsg(e)); }
  }

  return (
    <div>
      <Link to="/votes" className="mb-4 inline-flex items-center gap-1 text-sm text-ville-600 hover:underline"><ArrowLeft size={16} /> Retour</Link>
      <PageTitle title={s.question} subtitle={`Session ${s.mode === 'open' ? 'libre' : 'fermée'} · créée par ${s.created_by_name}`}
        action={
          <div className="flex items-center gap-2">
            <Badge color={s.status === 'open' ? 'green' : 'slate'}>{s.status === 'open' ? 'Ouvert' : 'Clos'}</Badge>
            {isIanimateur && !editing && <Button variant="secondary" onClick={() => setEditing(true)}><Pencil size={16} /> Éditer</Button>}
            {isIanimateur && <Button variant="danger" onClick={removeSession}><Trash2 size={16} /> Supprimer</Button>}
          </div>
        } />

      {editing && (
        <Card className="mb-6 space-y-3 p-5">
          <Field label="Question"><Textarea rows={2} value={question} onChange={(e) => setQuestion(e.target.value)} /></Field>
          <div className="flex gap-2">
            <Button onClick={saveQuestion}><Save size={16} /> Enregistrer</Button>
            <Button variant="secondary" onClick={() => { setEditing(false); setQuestion(s.question); }}><X size={16} /> Annuler</Button>
          </div>
        </Card>
      )}

      <Card className="mb-6 space-y-3 p-5">
        {s.options.length === 0 && <p className="text-sm text-slate-500">Aucune option proposée pour l’instant.</p>}
        {s.options.map((o) => {
          const pct = total ? Math.round((o.votes / total) * 100) : 0;
          const mine = s.my_option_id === o.id;
          return (
            <div key={o.id} className={`rounded-lg border p-3 ${mine ? 'border-ville-500 bg-ville-50' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {canInteract && s.status === 'open' ? (
                    <Button variant={mine ? 'primary' : 'secondary'} onClick={async () => { await castVote(sid, o.id); load(); }}>
                      {mine ? <><CheckCircle2 size={16} /> Mon vote</> : 'Voter'}
                    </Button>
                  ) : <span className="text-sm">{mine ? <Badge color="green">Votre vote</Badge> : null}</span>}
                  <span className="font-medium text-slate-800">{o.label}</span>
                  {o.proposed_by_name && <span className="text-xs text-slate-400">proposé par {o.proposed_by_name}</span>}
                  {isIanimateur && (
                    <button title="Supprimer cette option" onClick={async () => { if (window.confirm('Supprimer cette option ?')) { await deleteVoteOption(o.id); load(); } }} className="text-slate-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <span className="text-sm font-semibold text-slate-700">{o.votes} ({pct}%)</span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-slate-100" role="img" aria-label={`${o.label} : ${pct}%`}>
                <div className="h-2 rounded-full bg-ville-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
        <p className="text-xs text-slate-500">Total : {total} vote(s). Les résultats sont visibles pendant le vote.</p>
      </Card>

      {canAddOption && (
        <Card className="mb-6 p-5">
          <h3 className="mb-2 flex items-center gap-2 font-semibold"><Plus size={16} /> Proposer une option</h3>
          <div className="flex gap-2">
            <Input value={newOption} onChange={(e) => setNewOption(e.target.value)} placeholder="Votre proposition" />
            <Button onClick={async () => { if (newOption.trim()) { await addVoteOption(sid, newOption); setNewOption(''); load(); } }}>Ajouter</Button>
          </div>
        </Card>
      )}

      {isIanimateur && s.status === 'open' && (
        <Button variant="danger" onClick={async () => { await closeVote(sid); load(); }}><Lock size={16} /> Clôturer la session</Button>
      )}
    </div>
  );
}
