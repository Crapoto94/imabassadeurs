import { useEffect, useState } from 'react';
import { ThumbsUp, Reply, Send } from 'lucide-react';
import { Button, Textarea, Spinner, EmptyState, Alert } from './ui';
import { addComment, getComments, likeComment } from '../api/endpoints';
import { errMsg } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import type { Comment } from '../types';

function CommentItem({ comment, onChanged }: { comment: Comment; onChanged: () => void }) {
  const { canInteract, user } = useAuth();
  const [replying, setReplying] = useState(false);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  async function submitReply() {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await addComment((comment as any).entity_type, (comment as any).entity_id, body, comment.id);
      setBody(''); setReplying(false); onChanged();
    } finally { setBusy(false); }
  }

  async function toggleLike() {
    await likeComment(comment.id);
    onChanged();
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="font-medium text-slate-700">{comment.author_name}</span>
          <span>{new Date(comment.created_at).toLocaleString('fr-FR')}</span>
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{comment.body}</p>
        {canInteract && (
          <div className="mt-2 flex items-center gap-3 text-xs">
            <button onClick={toggleLike} className={`inline-flex items-center gap-1 ${comment.liked ? 'text-ville-600 font-medium' : 'text-slate-500 hover:text-slate-700'}`}>
              <ThumbsUp size={14} aria-hidden /> {comment.likes}
            </button>
            {!comment.parent_id && (
              <button onClick={() => setReplying((v) => !v)} className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700">
                <Reply size={14} aria-hidden /> Répondre
              </button>
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
          {comment.replies.map((r) => (
            <div key={r.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-medium text-slate-700">{r.author_name}</span>
                <span>{new Date(r.created_at).toLocaleString('fr-FR')}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{r.body}</p>
              {canInteract && (
                <button onClick={() => { likeComment(r.id).then(onChanged); }} className={`mt-2 inline-flex items-center gap-1 text-xs ${r.liked ? 'text-ville-600 font-medium' : 'text-slate-500'}`}>
                  <ThumbsUp size={14} aria-hidden /> {r.likes}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommentThread({ entityType, entityId }: { entityType: string; entityId: number }) {
  const { canInteract, user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await getComments(entityType, entityId);
      // On enrichit pour l'ajout de réponses.
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
