import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Lock, Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import { Card, PageTitle, Spinner, Alert, Badge, Button, Input, Textarea, Field } from '../components/ui';
import { addVoteOption, castVote, closeVote, deleteVote, deleteVoteOption, getVote, updateVote } from '../api/endpoints';
import { errMsg } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import type { VoteSession } from '../types';

// ISO → valeur d'un champ datetime-local (heure locale).
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
// Valeur d'un champ datetime-local → ISO (null si vide).
const toIso = (value: string) => (value ? new Date(value).toISOString() : null);
const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });

export default function VoteDetail() {
  const { id } = useParams();
  const sid = Number(id);
  const navigate = useNavigate();
  const { canInteract, isIanimateur } = useAuth();
  const [s, setS] = useState<VoteSession | null>(null);
  const [error, setError] = useState('');
  const [newOption, setNewOption] = useState('');
  const [newJustification, setNewJustification] = useState('');
  const [editing, setEditing] = useState(false);
  const [question, setQuestion] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [extendedAt, setExtendedAt] = useState('');

  async function load() {
    try {
      const data = await getVote(sid);
      setS(data);
      setQuestion(data.question);
      setClosesAt(toLocalInput(data.closes_at));
      setExtendedAt(toLocalInput(data.extended_closes_at));
    } catch (e) { setError(errMsg(e)); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [sid]);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!s) return <div className="flex justify-center py-12"><Spinner /></div>;

  const total = s.options.reduce((a, o) => a + o.votes, 0);
  const canAddOption = s.status === 'open' && canInteract && (s.mode === 'open' || s.allow_write_in);

  async function saveQuestion() {
    if (extendedAt && closesAt && new Date(extendedAt) <= new Date(closesAt)) {
      setError('La date de prolongation doit être postérieure à la date de clôture prévisionnelle.');
      return;
    }
    setError('');
    try {
      await updateVote(sid, { question, closes_at: toIso(closesAt), extended_closes_at: toIso(extendedAt) });
      setEditing(false);
      load();
    } catch (e) { setError(errMsg(e)); }
  }
  function cancelEdit() {
    if (!s) return;
    setEditing(false);
    setQuestion(s.question);
    setClosesAt(toLocalInput(s.closes_at));
    setExtendedAt(toLocalInput(s.extended_closes_at));
  }
  async function removeSession() {
    if (!window.confirm('Supprimer définitivement cette session de vote ?')) return;
    try { await deleteVote(sid); navigate('/votes'); }
    catch (e) { setError(errMsg(e)); }
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 lg:px-8 py-8">
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
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date de clôture prévisionnelle">
              <Input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
            </Field>
            <Field label="Prolongation (facultatif)" hint="Date supplémentaire : devient la date limite effective du scrutin.">
              <Input type="datetime-local" min={closesAt || undefined} value={extendedAt} onChange={(e) => setExtendedAt(e.target.value)} />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button onClick={saveQuestion}><Save size={16} /> Enregistrer</Button>
            <Button variant="secondary" onClick={cancelEdit}><X size={16} /> Annuler</Button>
          </div>
        </Card>
      )}

      <Card className="mb-6 space-y-3 p-5">
        {(s.closes_at || s.extended_closes_at) && (
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
            {s.closes_at && <span>Clôture prévisionnelle : {formatDate(s.closes_at)}</span>}
            {s.extended_closes_at && (
              <span className="font-medium text-amber-700">Prolongée jusqu’au {formatDate(s.extended_closes_at)}</span>
            )}
          </div>
        )}
        {s.context && <p className="text-sm text-slate-600">{s.context}</p>}
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
              {o.justification && <p className="mt-1 text-xs text-slate-500">{o.justification}</p>}
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
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input value={newOption} onChange={(e) => setNewOption(e.target.value)} placeholder="Votre proposition" />
              <Button onClick={async () => { if (newOption.trim()) { await addVoteOption(sid, newOption, newJustification.trim() || undefined); setNewOption(''); setNewJustification(''); load(); } }}>Ajouter</Button>
            </div>
            <Input value={newJustification} onChange={(e) => setNewJustification(e.target.value)} placeholder="Justification de l'option (facultatif)" />
          </div>
        </Card>
      )}

      {isIanimateur && s.status === 'open' && (
        <Button variant="danger" onClick={async () => { await closeVote(sid); load(); }}><Lock size={16} /> Clôturer la session</Button>
      )}
    </div>
  );
}
