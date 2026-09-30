import { useEffect, useState } from 'react';
import { addComment, deleteComment, getComments, likeComment, updateComment } from '../api/endpoints';
import { errMsg } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { Avatar, EditedAt, StitchAlert, StitchEmpty, StitchSpinner, timeAgo } from './stitch';
import type { Comment } from '../types';

function CommentItem({ comment, onChanged, isReply = false }: { comment: Comment; onChanged: () => void; isReply?: boolean }) {
  const { canInteract, user } = useAuth();
  const [replying, setReplying] = useState(false);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);

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
      <div className="flex items-start gap-2.5">
        <Avatar name={comment.author_name} size={isReply ? 28 : 32} />
        <div className={`p-3 rounded-xl flex-1 space-y-1 ${isReply ? 'bg-surface-container-lowest' : 'bg-surface-container-lowest'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="font-headline text-label-md text-on-surface">{comment.author_name}</span>
              {user?.id === comment.author_id && (
                <span className="px-1.5 py-0.5 bg-tertiary-fixed text-on-tertiary-fixed text-[10px] rounded font-headline font-bold">Moi</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-body text-body-sm text-outline text-[11px]">{timeAgo(comment.created_at)}</span>
              {comment.edited_at && <EditedAt editedAt={comment.edited_at} />}
            </div>
          </div>
          {editing ? (
            <div className="space-y-2 pt-1">
              <textarea
                rows={2} value={editBody} onChange={(e) => setEditBody(e.target.value)}
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg font-body text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/20"
              />
              <div className="flex gap-2">
                <button className="px-3 py-1 bg-secondary text-on-secondary rounded-full font-headline text-label-sm disabled:opacity-50" onClick={saveEdit} disabled={busy} type="button">Enregistrer</button>
                <button className="px-3 py-1 bg-surface-container text-on-surface-variant rounded-full font-headline text-label-sm" onClick={() => { setEditing(false); setEditBody(comment.body); }} type="button">Annuler</button>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap font-body text-body-sm text-on-surface-variant">{comment.body}</p>
          )}
          {canInteract && !editing && (
            <div className="flex items-center gap-3 pt-1 text-[12px] font-headline text-label-sm text-outline">
              <button
                onClick={async () => { await likeComment(comment.id); onChanged(); }}
                className={`inline-flex items-center gap-1 ${comment.liked ? 'text-secondary font-bold' : 'hover:text-secondary'}`}
                type="button"
              >
                <span className={`material-symbols-outlined text-[15px] ${comment.liked ? 'filled' : ''}`}>thumb_up</span> Aimer ({comment.likes})
              </button>
              {!comment.parent_id && !isReply && (
                <button onClick={() => setReplying((v) => !v)} className="hover:text-secondary" type="button">Répondre</button>
              )}
              {peutModerer && (
                <>
                  <button onClick={() => setEditing(true)} className="hover:text-primary" type="button">Éditer</button>
                  <button onClick={remove} className="hover:text-error" type="button">Supprimer</button>
                </>
              )}
            </div>
          )}
          {replying && (
            <div className="flex items-center gap-2 pt-2">
              <input
                className="flex-1 pl-3 pr-3 py-2 bg-surface-container-low rounded-full font-body text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-secondary/20"
                placeholder="Votre réponse…" value={body} onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitReply()}
              />
              <button className="p-1.5 text-secondary hover:text-secondary-container disabled:opacity-50" onClick={submitReply} disabled={busy || !body.trim()} aria-label="Envoyer" type="button">
                <span className="material-symbols-outlined text-[20px]">send</span>
              </button>
            </div>
          )}
        </div>
      </div>
      {comment.replies?.length > 0 && (
        <div className="ml-6 sm:ml-10 space-y-2">
          {comment.replies.map((r) => <CommentItem key={r.id} comment={r} onChanged={onChanged} isReply />)}
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
    <div className="space-y-3">
      <h3 className="font-headline text-headline-sm text-primary flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px]">forum</span>
        Échanges &amp; retours d'expérience
      </h3>
      {error && <StitchAlert kind="error">{error}</StitchAlert>}
      {loading ? <StitchSpinner />
        : comments.length === 0 ? <StitchEmpty icon="forum">Aucun commentaire pour l'instant.</StitchEmpty>
        : <div className="space-y-3 bg-surface-container-low/50 p-3 rounded-xl">{comments.map((c) => <CommentItem key={c.id} comment={c} onChanged={load} />)}</div>}
      {canInteract ? (
        <div className="flex items-center gap-2">
          <Avatar name={user?.display_name} size={28} />
          <div className="relative flex-1">
            <input
              className="w-full pl-3 pr-9 py-2 bg-surface-container-lowest rounded-full font-body text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-secondary/20 shadow-sm"
              placeholder="Ajouter une observation bienveillante…" value={body} onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
            <button
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-secondary hover:text-secondary-container disabled:opacity-50"
              onClick={submit} disabled={busy || !body.trim()} aria-label="Publier" type="button"
            >
              <span className="material-symbols-outlined text-[20px]">send</span>
            </button>
          </div>
        </div>
      ) : (
        <p className="font-body text-body-sm text-on-surface-variant">Seuls les IAmbassadeurs et assimilés peuvent commenter. Vous êtes en lecture seule.</p>
      )}
    </div>
  );
}
