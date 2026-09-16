import { useEffect, useState } from 'react';
import { ThumbsUp, Reply, Send, Pencil, Trash2, X, Check } from 'lucide-react';
import { Button, Textarea, Spinner, EmptyState, Alert } from './ui';
import { addComment, deleteComment, getComments, likeComment, updateComment } from '../api/endpoints';
import { errMsg } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import type { Comment } from '../types';

function CommentItem({ comment, onChanged, isReply = false }: { comment: Comment; onChanged: () => void; isReply?: boolean }) {
  const { canInteract, user } = useAuth();
  const [replying, setReplying] = useState(false);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);

  // L'auteur ou un administrateur peut éditer/supprimer.
  const peutModerer = user?.id === comment.author_id || user?.roles?.includes('admin');

  async function submitReply() {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await addComment((comment as any).entity_type, (comment as any).entity_id, body, comment.id);
      setBody(''); setReplying(false); onChanged();
    } finally { setBusy(false); }
  }

  async function saveEdit() {
    if (!editBody.trim()) return;
    setBusy(true);
    try { await updateComment(comment.id, editBody); setEditing(false); onChanged(); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!window.confirm('Supprimer ce commentaire ?')) return;
    await deleteComment(comment.id);
    onChanged();
  }

  return (
    <div className="space-y-2">
      <div className={`rounded-lg border p-3 ${isReply ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'}`}>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="font-medium text-slate-700">{comment.author_name}</span>
          <span>{new Date(comment.created_at).toLocaleString('fr-FR')}</span>
        </div>
        {editing ? (
          <div className="mt-2 space-y-2">
            <Textarea rows={2} value={editBody} onChange={(e) => setEditBody(e.target.value)} />
            <div className="flex gap-2">
              <Button onClick={saveEdit} disabled={busy}><Check size={14} /> Enregistrer</Button>
              <Button variant="secondary" onClick={() => { setEditing(false); setEditBody(comment.body); }}><X size={14} /> Annuler</Button>
            </div>
          </div>
        ) : (
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{comment.body}</p>
        )}
        {canInteract && !editing && (
          <div className="mt-2 flex items-center gap-3 text-xs">
            <button onClick={async () => { await likeComment(comment.id); onChanged(); }} className={`inline-flex items-center gap-1 ${comment.liked ? 'font-medium text-ville-600' : 'text-slate-500 hover:text-slate-700'}`}>
              <ThumbsUp size={14} aria-hidden /> {comment.likes}
            </button>
            {!comment.parent_id && !isReply && (
              <button onClick={() => setReplying((v) => !v)} className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700">
                <Reply size={14} aria-hidden /> Répondre
              </button>
            )}
            {peutModerer && (
              <>
                <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-slate-500 hover:text-ville-600">
                  <Pencil size={13} aria-hidden /> Éditer
                </button>
                <button onClick={remove} className="inline-flex items-center gap-1 text-slate-500 hover:text-red-600">
                  <Trash2 size={13} aria-hidden /> Supprimer
                </button>
              </>
            )}
          </div>
        )}
        {replying && (
          <div className="mt-2 space-y-2">
            <Textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Votre réponse…" />
            <Button onClick={submitReply} disabled={busy}><Send size={14} /> Envoyer</Button>
          </div>
        )}
      </div>
      {comment.replies?.length > 0 && (
        <div className="ml-6 space-y-2 border-l-2 border-slate-100 pl-4">
          {comment.replies.map((r) => <CommentItem key={r.id} comment={r} onChanged={onChanged} isReply />)}
        </div>
      )}
    </div>
  );
}

export default function CommentThread({ entityType, entityId }: { entityType: string; entityId: number }) {
  const { canInteract } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await getComments(entityType, entityId);
      const enrich = (c: Comment): Comment => ({ ...c, entity_type: entityType, entity_id: entityId, replies: c.replies.map(enrich) } as any);
      setComments(data.map(enrich));
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [entityType, entityId]);

  async function submit() {
    if (!body.trim()) return;
    setBusy(true);
    try { await addComment(entityType, entityId, body); setBody(''); await load(); }
    catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Discussion</h3>
      {error && <Alert kind="error">{error}</Alert>}
      {canInteract ? (
        <div className="space-y-2">
          <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Participez à la discussion…" />
          <Button onClick={submit} disabled={busy}><Send size={14} /> Publier</Button>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Seuls les IAmbassadeurs et assimilés peuvent commenter. Vous êtes en lecture seule.</p>
      )}
      {loading ? <div className="flex justify-center py-4"><Spinner /></div>
        : comments.length === 0 ? <EmptyState>Aucun commentaire pour l’instant.</EmptyState>
        : <div className="space-y-3">{comments.map((c) => <CommentItem key={c.id} comment={c} onChanged={load} />)}</div>}
    </div>
  );
}
