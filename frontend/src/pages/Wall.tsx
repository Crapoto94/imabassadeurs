import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createWallComment, createWallPost, deleteWallComment, deleteWallPost, getWall,
  reactWallPost, updateWallComment, updateWallPost,
} from '../api/endpoints';
import { errMsg } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { Avatar, EditedAt, GhostButton, Modal, PageHeader, PrimaryButton, SectionCard, StitchAlert, StitchEmpty, StitchSpinner, inputCls, timeAgo, useToast } from '../components/stitch';
import { MentionField, MentionText, decodeMentions, encodeMentions, plainMentions } from '../components/Mentions';
import type { Mention } from '../components/Mentions';
import type { WallComment, WallPost } from '../types';

const MAX = 2000;
const REFRESH_MS = 30_000;

// Smileys proposés dans le sélecteur du composeur.
const EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🙂', '😉', '😊', '😇', '🥰', '😍', '😘', '😋',
  '😎', '🤓', '🤔', '🧐', '😐', '🙄', '😏', '😮', '😲', '😢', '😭', '😡', '🥳', '🤯', '😴', '🤗',
  '👍', '👎', '👏', '🙌', '🙏', '💪', '👀', '🤝', '✌️', '👋', '❤️', '💙', '💡', '🔥', '⭐', '🎉',
  '✅', '❌', '❓', '❗', '🚀', '🤖', '🧠', '⚖️', '🔒', '🌍', '📚', '💬',
];

// Raccourcis texte → smiley (convertis à l'envoi, uniquement entre espaces).
const SHORTCUTS: [RegExp, string][] = [
  [/(^|\s):-?\)(?=\s|$)/g, '$1🙂'], [/(^|\s):-?D(?=\s|$)/g, '$1😄'], [/(^|\s);-?\)(?=\s|$)/g, '$1😉'],
  [/(^|\s):-?\((?=\s|$)/g, '$1🙁'], [/(^|\s):-?[pP](?=\s|$)/g, '$1😛'], [/(^|\s)<3(?=\s|$)/g, '$1❤️'],
  [/(^|\s):-?O(?=\s|$)/g, '$1😮'],
];
const withSmileys = (t: string) => SHORTCUTS.reduce((acc, [re, to]) => acc.replace(re, to), t);

// Grille de smileys (popover).
function EmojiGrid({ onPick, items = EMOJIS, cols = 8 }: { onPick: (e: string) => void; items?: string[]; cols?: number }) {
  return (
    <div className="grid gap-0.5 p-2 bg-surface-container-lowest rounded-xl shadow-modal border border-surface-container" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {items.map((e) => (
        <button key={e} type="button" onClick={() => onPick(e)} className="w-9 h-9 rounded-lg text-[20px] hover:bg-surface-container" aria-label={`Smiley ${e}`}>{e}</button>
      ))}
    </div>
  );
}

// Zone de saisie : texte, smileys.
function Composer({ initial = '', submitLabel = 'Publier', placeholder = "Exprimez-vous : une question, un avis… Tapez @ pour citer quelqu'un.", rows = 3, onSubmit, onCancel, autoFocus }: {
  initial?: string; submitLabel?: string; placeholder?: string; rows?: number;
  onSubmit: (text: string) => Promise<void>; onCancel?: () => void; autoFocus?: boolean;
}) {
  const decoded = useRef(decodeMentions(initial));
  const mentionsRef = useRef<Mention[]>(decoded.current.mentions);
  const [text, setText] = useState(decoded.current.text);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement | null>(null);

  const insert = (emoji: string) => {
    const el = area.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    setPicker(false);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + emoji.length, start + emoji.length); });
  };

  const submit = async () => {
    const value = withSmileys(text).trim();
    if (!value || busy) return;
    setBusy(true); setErr(null);
    try { await onSubmit(encodeMentions(value, mentionsRef.current)); setText(''); mentionsRef.current = []; } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-2">
      {err && <StitchAlert kind="error">{err}</StitchAlert>}
      <MentionField
        multiline textareaRef={area} mentionsRef={mentionsRef} className={inputCls}
        rows={rows} maxLength={MAX} value={text} autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={setText}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } }}
      />
      <div className="relative flex flex-wrap items-center gap-2">
        <GhostButton icon="add_reaction" onClick={() => setPicker((v) => !v)}>Smiley</GhostButton>
        {picker && <div className="absolute left-0 bottom-full mb-2 z-20 w-[19rem]"><EmojiGrid onPick={insert} /></div>}
        <span className="font-body text-body-sm text-outline">{text.length} / {MAX} · Ctrl+Entrée pour envoyer</span>
        <div className="ml-auto flex gap-2">
          {onCancel && <GhostButton onClick={onCancel}>Annuler</GhostButton>}
          <PrimaryButton icon="send" onClick={submit} disabled={busy || !text.trim()}>{submitLabel}</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

// Un commentaire, présenté « à la Facebook » sous son message.
function Comment({ comment, meId, canModerate, onChange, onError }: {
  comment: WallComment; meId: number; canModerate: boolean;
  onChange: (p: WallPost) => void; onError: (m: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const mine = comment.author_id === meId;

  const remove = async () => {
    if (!window.confirm(mine ? 'Supprimer ce commentaire ?' : 'Supprimer ce commentaire (modération) ?')) return;
    try { onChange(await deleteWallComment(comment.id)); } catch (e) { onError(errMsg(e)); }
  };

  return (
    <div className="flex items-start gap-2">
      <Avatar name={comment.author_name} size={30} userId={comment.author_id} v={comment.author_avatar_v} />
      <div className="min-w-0 flex-1">
        {editing ? (
          <Composer
            autoFocus rows={2} initial={comment.body} submitLabel="Enregistrer" placeholder="Modifier le commentaire…"
            onCancel={() => setEditing(false)}
            onSubmit={async (t) => { onChange(await updateWallComment(comment.id, t)); setEditing(false); }}
          />
        ) : (
          <div className="rounded-2xl bg-surface-container-low px-3 py-1.5">
            <span className="font-headline text-label-sm text-on-surface">{comment.author_name || 'Ancien membre'}</span>
            <p className="font-body text-body-sm text-on-surface whitespace-pre-wrap break-words"><MentionText text={comment.body} /></p>
          </div>
        )}
        {!editing && (
          <div className="mt-0.5 flex flex-wrap items-center gap-2 pl-2 font-body text-body-sm text-outline">
            <time dateTime={comment.created_at} title={new Date(comment.created_at).toLocaleString('fr-FR')}>{timeAgo(comment.created_at)}</time>
            <EditedAt editedAt={comment.edited_at} />
            {(mine || canModerate) && (
              <button
                type="button" onClick={() => setEditing(true)}
                title={mine ? 'Modifier mon commentaire' : 'Modifier ce commentaire (modération)'}
                className="inline-flex items-center gap-0.5 font-headline text-label-sm hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[16px]">edit</span>{mine ? 'Modifier' : 'Modifier (modération)'}
              </button>
            )}
            {(mine || canModerate) && (
              <button
                type="button" onClick={remove}
                title={mine ? 'Supprimer mon commentaire' : 'Supprimer ce commentaire (modération)'}
                className="inline-flex items-center gap-0.5 font-headline text-label-sm hover:text-error"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>{mine ? 'Supprimer' : 'Supprimer (modération)'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Post({ post, quickReactions, meId, canModerate, onChange, onRemoved, onComment, onError }: {
  post: WallPost; quickReactions: string[]; meId: number; canModerate: boolean;
  onChange: (p: WallPost) => void; onRemoved: (id: number) => void; onComment: (p: WallPost) => void; onError: (m: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [picker, setPicker] = useState(false);
  const mine = post.author_id === meId;
  const hidden = post.comment_count - post.comments.length;

  const react = async (emoji: string) => {
    setPicker(false);
    try { onChange(await reactWallPost(post.id, emoji)); } catch (e) { onError(errMsg(e)); }
  };
  const remove = async () => {
    if (!window.confirm('Supprimer ce message ?')) return;
    try { await deleteWallPost(post.id); onRemoved(post.id); } catch (e) { onError(errMsg(e)); }
  };

  return (
    <article id={`mur-${post.id}`} className="group bg-surface-container-lowest rounded-2xl shadow-card p-4">
      <div className="flex items-start gap-3">
        <Avatar name={post.author_name} size={40} userId={post.author_id} v={post.author_avatar_v} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-headline text-label-lg text-on-surface">{post.author_name || 'Ancien membre'}</span>
            <time className="font-body text-body-sm text-outline" dateTime={post.created_at} title={new Date(post.created_at).toLocaleString('fr-FR')}>{timeAgo(post.created_at)}</time>
            <span className="font-body text-body-sm"><EditedAt editedAt={post.edited_at} /></span>
          </div>

          {post.quote && (
            <a href={post.quote.deleted ? undefined : `#mur-${post.quote.id}`} className="mt-1.5 block rounded-lg border-l-4 border-secondary bg-surface-container-low px-3 py-1.5">
              <span className="font-headline text-label-sm text-secondary">{post.quote.author_name || 'Un membre'}</span>
              <p className={`font-body text-body-sm line-clamp-2 ${post.quote.deleted ? 'italic text-outline' : 'text-on-surface-variant'}`}>
                {post.quote.deleted ? 'Message supprimé' : post.quote.excerpt}
              </p>
            </a>
          )}

          {editing ? (
            <div className="mt-2">
              <Composer
                autoFocus initial={post.body} submitLabel="Enregistrer" onCancel={() => setEditing(false)}
                onSubmit={async (t) => { onChange(await updateWallPost(post.id, t)); setEditing(false); }}
              />
            </div>
          ) : (
            <p className="mt-1.5 font-body text-body-md text-on-surface whitespace-pre-wrap break-words"><MentionText text={post.body} /></p>
          )}

          {/* Réactions + actions */}
          <div className="relative mt-2 flex flex-wrap items-center gap-1.5">
            {post.reactions.map((r) => (
              <button
                key={r.emoji} type="button" onClick={() => react(r.emoji)} title={r.names.join(', ')}
                aria-pressed={r.mine} aria-label={`${r.emoji} ${r.count}`}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[14px] transition-colors ${r.mine ? 'border-secondary bg-secondary-fixed/40' : 'border-surface-container hover:bg-surface-container-low'}`}
              >
                <span>{r.emoji}</span><span className="font-headline text-label-sm text-on-surface-variant">{r.count}</span>
              </button>
            ))}
            <button type="button" aria-label="Ajouter une réaction" title="Réagir" onClick={() => setPicker((v) => !v)}
              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-outline hover:bg-surface-container hover:text-on-surface">
              <span className="material-symbols-outlined text-[18px]">add_reaction</span>
            </button>
            {picker && <div className="absolute left-0 top-full mt-1 z-20 w-[15rem]"><EmojiGrid items={quickReactions} cols={6} onPick={react} /></div>}
            <span className="ml-auto flex items-center gap-0.5 text-outline">
              <button type="button" title="Commenter" aria-label="Commenter ce message" onClick={() => onComment(post)} className="flex items-center gap-1 p-1 rounded-full hover:bg-surface-container hover:text-on-surface">
                <span className="material-symbols-outlined text-[18px]">comment</span>
                {post.comment_count > 0 && <span className="font-headline text-label-sm">{post.comment_count}</span>}
              </button>
              {mine && !editing && (
                <button type="button" title="Modifier" aria-label="Modifier" onClick={() => setEditing(true)} className="p-1 rounded-full hover:bg-surface-container hover:text-on-surface">
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                </button>
              )}
              {(mine || canModerate) && (
                <button type="button" title="Supprimer" aria-label="Supprimer" onClick={remove} className="p-1 rounded-full hover:bg-error-container/40 hover:text-error">
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              )}
            </span>
          </div>

          {/* Fil de commentaires, sous le message */}
          {post.comment_count > 0 && (
            <div className="mt-2.5 space-y-2.5 border-t border-surface-container pt-2.5">
              {hidden > 0 && (
                <p className="font-body text-body-sm text-outline">{hidden} commentaire{hidden > 1 ? 's' : ''} plus ancien{hidden > 1 ? 's' : ''} non affiché{hidden > 1 ? 's' : ''}</p>
              )}
              {post.comments.map((c) => (
                <Comment key={c.id} comment={c} meId={meId} canModerate={canModerate} onChange={onChange} onError={onError} />
              ))}
            </div>
          )}
          <button
            type="button" onClick={() => onComment(post)}
            className="mt-2.5 flex w-full items-center gap-2 rounded-full bg-surface-container-low px-3 py-1.5 text-left font-body text-body-sm text-outline hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[18px]">comment</span>
            Écrire un commentaire…
          </button>
        </div>
      </div>
    </article>
  );
}

// Le Mur de l'IA : fil d'échange libre, commentaires imbriqués sous chaque message.
export default function Wall() {
  const { user, isIanimateur } = useAuth();
  const { show, Toast } = useToast();
  const [posts, setPosts] = useState<WallPost[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [quickReactions, setQuickReactions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [commentTarget, setCommentTarget] = useState<WallPost | null>(null);

  // Charge la première page ; au rafraîchissement, fusionne sans perdre les pages déjà dépliées.
  const refresh = useCallback(async () => {
    try {
      const r = await getWall();
      setQuickReactions(r.reactions);
      setPosts((cur) => {
        if (!cur) { setHasMore(r.has_more); return r.items; }
        const fresh = new Map(r.items.map((p) => [p.id, p]));
        const oldest = r.items.length ? r.items[r.items.length - 1].id : 0;
        const kept = cur.filter((p) => !fresh.has(p.id) && p.id < oldest);
        return [...r.items, ...kept];
      });
    } catch (e) { setError(errMsg(e)); }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, REFRESH_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const more = async () => {
    if (!posts?.length) return;
    setLoadingMore(true);
    try {
      const r = await getWall(posts[posts.length - 1].id);
      setPosts((cur) => [...(cur || []), ...r.items.filter((p) => !(cur || []).some((c) => c.id === p.id))]);
      setHasMore(r.has_more);
    } catch (e) { setError(errMsg(e)); } finally { setLoadingMore(false); }
  };

  const replace = (p: WallPost) => setPosts((cur) => (cur || []).map((x) => (x.id === p.id ? p : x)));

  // Message publié depuis la modale (et non depuis un commentaire).
  const publish = async (text: string) => {
    const p = await createWallPost(text);
    setPosts((cur) => [p, ...(cur || [])]);
    setComposerOpen(false);
    show('Message publié');
  };

  // Commentaire ajouté depuis la modale : il reste sous son message.
  const comment = async (text: string) => {
    if (!commentTarget) return;
    replace(await createWallComment(commentTarget.id, text));
    setCommentTarget(null);
    show('Commentaire publié');
  };

  return (
    <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 space-y-5">
      <PageHeader
        title="Le Mur de l'IA"
        subtitle="Un espace libre pour échanger sur l'IA : une idée, une question, une trouvaille. Commentez les messages et réagissez avec un smiley."
      />
      <SectionCard className="p-3">
        <div className="flex items-center gap-3">
          <Avatar name={user?.display_name} size={40} userId={user?.id} v={user?.avatar_v} />
          <button
            type="button" onClick={() => setComposerOpen(true)}
            className="flex-1 rounded-full bg-surface-container-low px-4 py-2.5 text-left font-body text-body-md text-outline hover:bg-surface-container"
          >
            Quoi de neuf ? Lancez la conversation…
          </button>
          <PrimaryButton icon="edit" onClick={() => setComposerOpen(true)} className="hidden sm:inline-flex">Publier</PrimaryButton>
        </div>
      </SectionCard>
      {error && <StitchAlert kind="error">{error}</StitchAlert>}
      {!posts ? (
        <div className="flex justify-center py-10"><StitchSpinner /></div>
      ) : !posts.length ? (
        <StitchEmpty icon="forum">Le mur est vide : lancez la conversation !</StitchEmpty>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <Post
              key={p.id} post={p} quickReactions={quickReactions} meId={user?.id ?? 0} canModerate={isIanimateur}
              onChange={replace} onRemoved={(id) => setPosts((cur) => (cur || []).filter((x) => x.id !== id))}
              onComment={setCommentTarget} onError={setError}
            />
          ))}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <GhostButton icon="expand_more" onClick={more} disabled={loadingMore}>Voir les messages plus anciens</GhostButton>
            </div>
          )}
        </div>
      )}

      <Modal open={composerOpen} onClose={() => setComposerOpen(false)} title="Nouveau message" icon="forum">
        <Composer autoFocus submitLabel="Publier" onCancel={() => setComposerOpen(false)} onSubmit={publish} />
      </Modal>

      <Modal open={!!commentTarget} onClose={() => setCommentTarget(null)} title="Commenter" icon="comment">
        {commentTarget && (
          <div className="space-y-3">
            <div className="rounded-xl bg-surface-container-low px-3 py-2">
              <span className="font-headline text-label-sm text-secondary">{commentTarget.author_name || 'Un membre'}</span>
              <p className="font-body text-body-sm text-on-surface-variant line-clamp-3">{plainMentions(commentTarget.body)}</p>
            </div>
            <Composer
              autoFocus rows={2} submitLabel="Commenter" placeholder="Votre commentaire…"
              onCancel={() => setCommentTarget(null)} onSubmit={comment}
            />
          </div>
        )}
      </Modal>
      {Toast}
    </div>
  );
}
