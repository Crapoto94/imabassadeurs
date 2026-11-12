import { Fragment, MutableRefObject, ReactNode, useEffect, useRef, useState } from 'react';
import { searchMentions } from '../api/endpoints';
import { useAuth } from '../hooks/useAuth';
import { Avatar } from './stitch';

// Un tag est stocké dans le texte sous la forme @[Nom affiché](id) ou @[tout le monde](all).
// Dans la zone de saisie, l'utilisateur voit et édite du texte simple « @Nom » ; les tags sont
// reconstitués à l'envoi (encodeMentions) et relus à l'édition (decodeMentions).
export type Mention = { id: number | 'all'; name: string };

export const EVERYONE: Mention = { id: 'all', name: 'tout le monde' };
const TOKEN = /@\[([^\]\n]{1,80})\]\((\d+|all)\)/g;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Texte saisi + tags choisis → texte balisé à envoyer. */
export function encodeMentions(text: string, mentions: Mention[]): string {
  let out = text;
  for (const m of [...mentions].sort((a, b) => b.name.length - a.name.length)) {
    const re = new RegExp(`@${escapeRe(m.name)}(?![\\p{L}\\p{N}])`, 'gu');
    out = out.replace(re, `@[${m.name}](${m.id})`);
  }
  return out;
}

/** Texte balisé → texte simple pour la saisie, avec la liste des tags qu'il contient. */
export function decodeMentions(body: string): { text: string; mentions: Mention[] } {
  const mentions: Mention[] = [];
  const text = body.replace(TOKEN, (_, name: string, id: string) => {
    if (!mentions.some((m) => String(m.id) === id)) mentions.push({ id: id === 'all' ? 'all' : Number(id), name });
    return `@${name}`;
  });
  return { text, mentions };
}

/** Texte balisé → texte brut (aperçus, citations). */
export const plainMentions = (body: string) => body.replace(TOKEN, (_, name: string) => `@${name}`);

/** Affiche un texte balisé : les tags deviennent des pastilles ; ceux qui vous visent sont mis en avant. */
export function MentionText({ text }: { text: string }) {
  const { user } = useAuth();
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(TOKEN)) {
    const start = m.index ?? 0;
    if (start > last) nodes.push(<Fragment key={key++}>{text.slice(last, start)}</Fragment>);
    const toMe = m[2] === 'all' || Number(m[2]) === user?.id;
    nodes.push(
      <span
        key={key++}
        className={`rounded px-1 font-semibold ${toMe ? 'bg-secondary-fixed text-on-secondary-fixed-variant' : 'bg-surface-container text-secondary'}`}
      >
        @{m[1]}
      </span>
    );
    last = start + m[0].length;
  }
  if (last < text.length) nodes.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  return <>{nodes}</>;
}

type Suggestion = { id: number | 'all'; name: string; sub?: string | null; avatar_v?: number | null };

// « @ » + début de nom (au plus un espace) juste avant le curseur.
const TRIGGER = /(^|[\s(])@([\p{L}'’-]*(?: [\p{L}'’-]*)?)$/u;

type FieldProps = {
  value: string;
  onChange: (v: string) => void;
  /** Tags choisis (conservés par le parent pour encodeMentions). */
  mentionsRef: MutableRefObject<Mention[]>;
  multiline?: boolean;
  className?: string;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  textareaRef?: MutableRefObject<HTMLTextAreaElement | null>;
};

// Champ de saisie (une ou plusieurs lignes) avec suggestions de personnes après « @ ».
export function MentionField({ value, onChange, mentionsRef, multiline, className = '', textareaRef, onKeyDown, ...rest }: FieldProps) {
  const { isIanimateur } = useAuth();
  const el = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(0);

  const caretQuery = () => {
    const node = el.current;
    if (!node) return null;
    const pos = node.selectionStart ?? node.value.length;
    const m = TRIGGER.exec(node.value.slice(0, pos));
    return m ? m[2] : null;
  };
  const refreshQuery = () => setQuery(caretQuery());

  // Suggestions : « tout le monde » (admins et IAnimateurs) puis les personnes correspondantes.
  useEffect(() => {
    if (query === null) { setItems([]); return; }
    let alive = true;
    const t = setTimeout(async () => {
      const q = query.trim().toLowerCase();
      const list: Suggestion[] = [];
      if (isIanimateur && EVERYONE.name.startsWith(q)) list.push({ id: 'all', name: EVERYONE.name, sub: 'Prévient tous les utilisateurs' });
      try {
        const users = await searchMentions(query.trim());
        list.push(...users.map((u) => ({ id: u.id, name: u.display_name, sub: u.direction, avatar_v: u.avatar_v })));
      } catch { /* sans suggestions */ }
      if (alive) { setItems(list); setActive(0); }
    }, 150);
    return () => { alive = false; clearTimeout(t); };
  }, [query, isIanimateur]);

  const pick = (s: Suggestion) => {
    const node = el.current;
    if (!node) return;
    const pos = node.selectionStart ?? node.value.length;
    const before = node.value.slice(0, pos);
    const m = TRIGGER.exec(before);
    if (!m) return;
    const atIndex = before.length - m[2].length - 1;
    const insert = `@${s.name} `;
    const next = node.value.slice(0, atIndex) + insert + node.value.slice(pos);
    if (!mentionsRef.current.some((x) => x.id === s.id)) mentionsRef.current = [...mentionsRef.current, { id: s.id, name: s.name }];
    onChange(next);
    setQuery(null);
    const caret = atIndex + insert.length;
    requestAnimationFrame(() => { node.focus(); node.setSelectionRange(caret, caret); });
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (query !== null && items.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % items.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + items.length) % items.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(items[active]); return; }
      if (e.key === 'Escape') { e.preventDefault(); setQuery(null); return; }
    }
    onKeyDown?.(e);
  };

  const common = {
    value,
    className,
    placeholder: rest.placeholder,
    maxLength: rest.maxLength,
    autoFocus: rest.autoFocus,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { onChange(e.target.value); requestAnimationFrame(refreshQuery); },
    onKeyDown: handleKey,
    onKeyUp: (e: React.KeyboardEvent) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') refreshQuery(); },
    onClick: refreshQuery,
    onBlur: () => setTimeout(() => setQuery(null), 150),
    role: 'combobox' as const,
    'aria-expanded': query !== null && items.length > 0,
    'aria-autocomplete': 'list' as const,
  };

  return (
    <div className="relative">
      {multiline ? (
        <textarea
          {...common} rows={rest.rows}
          ref={(n) => { el.current = n; if (textareaRef) textareaRef.current = n; }}
        />
      ) : (
        <input {...common} ref={(n) => { el.current = n; }} />
      )}
      {query !== null && items.length > 0 && (
        <ul role="listbox" className="absolute left-0 top-full mt-1 z-30 w-72 max-w-[90vw] overflow-hidden rounded-xl border border-surface-container bg-surface-container-lowest shadow-modal">
          {items.map((s, i) => (
            <li key={String(s.id)} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); pick(s); }}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left ${i === active ? 'bg-surface-container' : ''}`}
              >
                {s.id === 'all'
                  ? <span className="material-symbols-outlined text-[28px] text-secondary">groups</span>
                  : <Avatar name={s.name} size={28} userId={s.id as number} v={s.avatar_v} />}
                <span className="min-w-0">
                  <span className="block truncate font-headline text-label-md text-on-surface">{s.id === 'all' ? '@tout le monde' : s.name}</span>
                  {s.sub && <span className="block truncate font-body text-body-sm text-outline">{s.sub}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
