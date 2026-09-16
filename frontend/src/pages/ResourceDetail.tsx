import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, ExternalLink, Check, X, Pencil, Trash2, Save } from 'lucide-react';
import { Card, PageTitle, Spinner, Alert, Badge, Button, Textarea, Input, Field } from '../components/ui';
import StarRating from '../components/StarRating';
import AiPanel from '../components/AiPanel';
import CommentThread from '../components/CommentThread';
import { deleteResource, getResource, rateResource, reviewResource, synthResource, synthResourceThread, updateResource } from '../api/endpoints';
import { API_URL, errMsg } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import type { Resource } from '../types';

export default function ResourceDetail() {
  const { id } = useParams();
  const rid = Number(id);
  const navigate = useNavigate();
  const { canInteract, isIanimateur, isAdmin, user } = useAuth();
  const [r, setR] = useState<Resource | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', url: '' });

  async function load() {
    try {
      const data = await getResource(rid);
      setR(data);
      setForm({ title: data.title, description: data.description, url: data.url || '' });
    } catch (e) { setError(errMsg(e)); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [rid]);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!r) return <div className="flex justify-center py-12"><Spinner /></div>;

  const peutEditer = isAdmin || isIanimateur || r.proposed_by === user?.id;
  const peutSupprimer = isAdmin || isIanimateur;

  async function save() {
    try { await updateResource(rid, form); setEditing(false); load(); }
    catch (e) { setError(errMsg(e)); }
  }
  async function remove() {
    if (!window.confirm('Supprimer définitivement cette ressource et sa discussion ?')) return;
    try { await deleteResource(rid); navigate('/ressources'); }
    catch (e) { setError(errMsg(e)); }
  }

  return (
    <div>
      <Link to="/ressources" className="mb-4 inline-flex items-center gap-1 text-sm text-ville-600 hover:underline"><ArrowLeft size={16} /> Retour</Link>
      <PageTitle
        title={r.title}
        subtitle={`Proposé par ${r.proposed_by_name} le ${new Date(r.created_at).toLocaleDateString('fr-FR')}`}
        action={
          <div className="flex items-center gap-2">
            <Badge color={r.status === 'published' ? 'green' : r.status === 'pending' ? 'amber' : 'red'}>{r.status}</Badge>
            {peutEditer && !editing && <Button variant="secondary" onClick={() => setEditing(true)}><Pencil size={16} /> Éditer</Button>}
            {peutSupprimer && <Button variant="danger" onClick={remove}><Trash2 size={16} /> Supprimer</Button>}
          </div>
        }
      />

      {editing ? (
        <Card className="mb-6 space-y-3 p-5">
          <Field label="Titre"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Description"><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          {r.kind === 'link' && <Field label="URL"><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></Field>}
          <div className="flex gap-2">
            <Button onClick={save}><Save size={16} /> Enregistrer</Button>
            <Button variant="secondary" onClick={() => setEditing(false)}>Annuler</Button>
          </div>
        </Card>
      ) : (
        <Card className="mb-6 space-y-4 p-5">
          <p className="whitespace-pre-wrap text-slate-700">{r.description}</p>
          {r.kind === 'pdf' && r.file_path && (
            <a href={`${API_URL}/uploads/${r.file_path}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-ville-600 hover:underline">
              <FileText size={16} /> Ouvrir le document PDF
            </a>
          )}
          {r.kind === 'link' && r.url && (
            <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-ville-600 hover:underline">
              <ExternalLink size={16} /> {r.url}
            </a>
          )}
          <div className="flex items-center gap-4 border-t border-slate-100 pt-4">
            <div>
              <div className="text-sm font-medium text-slate-700">Note moyenne : {r.avg_stars ?? '—'} / 4</div>
              {canInteract && (
                <div className="mt-1">
                  <StarRating value={r.my_rating || 0} onRate={async (v) => { await rateResource(rid, v); load(); }} />
                  <span className="text-xs text-slate-500">Votre note : {r.my_rating || '—'}</span>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {isIanimateur && r.status === 'pending' && (
        <Card className="mb-6 p-5">
          <h3 className="mb-2 font-semibold">Modération (IAnimateur)</h3>
          <Textarea rows={2} placeholder="Motif (optionnel)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="mt-2 flex gap-2">
            <Button onClick={async () => { await reviewResource(rid, 'published', note); load(); }}><Check size={16} /> Publier</Button>
            <Button variant="danger" onClick={async () => { await reviewResource(rid, 'rejected', note); load(); }}><X size={16} /> Rejeter</Button>
          </div>
        </Card>
      )}

      <div className="mb-6 grid gap-4">
        <AiPanel label="Synthétiser ce document" run={() => synthResource(rid)} />
        <AiPanel label="Synthétiser la discussion" run={() => synthResourceThread(rid)} />
      </div>

      <CommentThread entityType="resource" entityId={rid} />
    </div>
  );
}
