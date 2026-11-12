import { useCallback, useEffect, useRef, useState } from 'react';
import { createWallPost, deleteWallPost, getWall, reactWallPost, updateWallPost } from '../api/endpoints';
import { errMsg } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { Avatar, EditedAt, GhostButton, PageHeader, PrimaryButton, SectionCard, StitchAlert, StitchEmpty, StitchSpinner, StitchTextarea, timeAgo, useToast } from '../components/stitch';
import type { WallPost } from '../types';

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

// Zone de saisie : texte, smileys, aperçu de la citation.
function Composer({ quote, onClearQuote, initial = '', submitLabel = 'Publier', onSubmit, onCancel, autoFocus }: {
  quote?: WallPost['quote'] | null; onClearQuote?: () => void; initial?: string; submitLabel?: string;
  onSubmit: (text: string) => Promise<void>; onCancel?: () => void; autoFocus?: boolean;
}) {
  const [text, setText] = useState(initial);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);

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
    try { await onSubmit(value); setText(''); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-2">
      {quote && (
        <div className="flex items-start gap-2 rounded-lg border-l-4 border-secondary bg-surface-container-low px-3 py-2">
          <div className="min-w-0 flex-1 font-body text-body-sm text-on-surface-variant">
            <span className="font-headline text-label-sm text-secondary">En réponse à {quote.author_name || 'un membre'}</span>
            <p className="truncate">{quote.excerpt}</p>
          </div>
          <button type="button" aria-label="Retirer la citation" onClick={onClearQuote} className="text-outline hover:text-on-surface">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}
      {err && <StitchAlert kind="error">{err}</StitchAlert>}
      <StitchTextarea
        ref={area} rows={3} maxLength={MAX} value={text} autoFocus={autoFocus}
        placeholder="Exprimez-vous : une question, un avis, une découverte sur l'IA…"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } }}
      />
      <div className="relative flex flex-wrap items-center gap-2">
        <GhostButton icon="add_reaction" onClick={() => setPicker((v) => !v)}>Smiley</GhostButton>
        {picker && <div className="absolute left-0 bottom-full mb-2 z-20 w-[19rem]"><EmojiGrid onPick={insert} /></div>}
        <span className="font-body text-body-sm text-outline">{text.length} / {MAX} · Ctrl+Entrée pour publier</span>
        <div className="ml-auto flex gap-2">
          {onCancel && <GhostButton onClick={onCancel}>Annuler</GhostButton>}
          <PrimaryButton icon="send" onClick={submit} disabled={busy || !text.trim()}>{submitLabel}</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

function Post({ post, quickReactions, meId, canModerate, onChange, onRemoved, onQuote, onError }: {
  post: WallPost; quickReactions: string[]; meId: number; canModerate: boolean;
  onChange: (p: WallPost) => void; onRemoved: (id: number) => void; onQuote: (p: WallPost) => void; onError: (m: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [picker, setPicker] = useState(false);
  const mine = post.author_id === meId;

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
            <p className="mt-1.5 font-body text-body-md text-on-surface whitespace-pre-wrap break-words">{post.body}</p>
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
              <button type="button" title="Citer" aria-label="Citer ce message" onClick={() => onQuote(post)} className="p-1 rounded-full hover:bg-surface-container hover:text-on-surface">
                <span className="material-symbols-outlined text-[18px]">format_quote</span>
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
        </div>
      </div>
    </article>
  );
}

// Le Mur de l'IA : fil de discussion unique, ouvert à tous les utilisateurs connectés.
export default function Wall() {
  const { user, isIanimateur } = useAuth();
  const { show, Toast } = useToast();
  const [posts, setPosts] = useState<WallPost[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [quickReactions, setQuickReactions] = useState<string[]>([]);
  const [quote, setQuote] = useState<WallPost | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const composerRef = useRef<HTMLDivElement>(null);

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
  const startQuote = (p: WallPost) => { setQuote(p); composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); };

  const publish = async (text: string) => {
    const p = await createWallPost(text, quote?.id);
    setPosts((cur) => [p, ...(cur || [])]);
    setQuote(null);
    show('Message publié');
  };

  return (
    <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 space-y-5">
      <PageHeader
        title="Le Mur de l'IA"
        subtitle="Un espace libre pour échanger sur l'IA : une idée, une question, une trouvaille. Citez un message, réagissez avec un smiley."
      />
      <div ref={composerRef}>
        <SectionCard className="p-4">
          <Composer
            quote={quote ? { id: quote.id, author_name: quote.author_name, excerpt: quote.body.slice(0, 200), deleted: false } : null}
            onClearQuote={() => setQuote(null)}
            onSubmit={publish}
          />
        </SectionCard>
      </div>
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
              onQuote={startQuote} onError={setError}
            />
          ))}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <GhostButton icon="expand_more" onClick={more} disabled={loadingMore}>Voir les messages plus anciens</GhostButton>
            </div>
          )}
        </div>
      )}
      {Toast}
    </div>
  );
}
