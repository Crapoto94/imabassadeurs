import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { castVote, getExperiments, getPrinciples, getResources, getRisks, getStats, getThemes, getVotes, joinExperiment } from '../api/endpoints';
import { useAuth } from '../hooks/useAuth';
import CommentThread from '../components/CommentThread';
import VideoEmbed, { detectVideo } from '../components/VideoEmbed';
import PdfThumb from '../components/PdfThumb';
import { API_URL } from '../api/client';
import {
  Avatar, GhostButton, LevelBadge, MandatoryBadge, Modal, PrimaryButton, RoleBadge, SectionCard, StitchInput,
  StitchSelect, StitchSpinner, timeAgo, useToast,
} from '../components/stitch';
import type { Experiment, Principle, Resource, Risk, Theme, VoteSession } from '../types';

type FeedItem =
  | { kind: 'experiment'; date: string; data: Experiment }
  | { kind: 'risk'; date: string; data: Risk }
  | { kind: 'resource'; date: string; data: Resource }
  | { kind: 'vote'; date: string; data: VoteSession };

const feedThemes = (item: FeedItem): Theme[] => item.kind === 'vote' ? [] : item.data.themes || [];

const feedTitle = (item: FeedItem) => {
  switch (item.kind) {
    case 'vote': return item.data.question;
    case 'experiment':
    case 'risk':
    case 'resource': return item.data.title;
  }
};

const feedText = (item: FeedItem) => {
  switch (item.kind) {
    case 'vote': return `${item.data.question} ${item.data.created_by_name}`;
    case 'experiment': return `${item.data.title} ${item.data.description} ${item.data.created_by_name}`;
    case 'risk':
    case 'resource': return `${item.data.title} ${item.data.description} ${item.data.proposed_by_name}`;
  }
};

const feedRating = (item: FeedItem) =>
  item.kind === 'resource' && item.data.avg_stars != null ? Number(item.data.avg_stars) : -1;

type FeedKind = FeedItem['kind'];

const FEED_TYPE_OPTIONS: { kind: FeedKind; label: string }[] = [
  { kind: 'experiment', label: 'Expérimentations' },
  { kind: 'risk', label: 'Risques' },
  { kind: 'resource', label: 'Ressources' },
  { kind: 'vote', label: 'Votes' },
];

const THEME_SCOPES: { scope: Theme['scope']; label: string }[] = [
  { scope: 'experiment', label: 'Expérimentations' },
  { scope: 'risk', label: 'Risques' },
  { scope: 'resource', label: 'Ressources' },
];

// ── Cartes du fil ──

function ExperimentCard({ exp, onJoined }: { exp: Experiment; onJoined: () => void }) {
  const { canInteract } = useAuth();
  const { show, Toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function join() {
    setBusy(true);
    try { await joinExperiment(exp.id); show('Candidature transmise au porteur du test'); onJoined(); }
    finally { setBusy(false); }
  }

  return (
    <SectionCard className="p-4 space-y-3 hover:shadow-card-hover transition-shadow">
      {Toast}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Avatar name={exp.created_by_name} size={36} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-headline text-headline-sm text-on-surface">{exp.created_by_name}</h3>
              <span className="text-outline font-body text-body-sm">•</span>
              <span className="font-body text-body-sm text-outline">{timeAgo(exp.created_at)}</span>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 mt-1 rounded-full bg-secondary-fixed/60 text-on-secondary-fixed-variant font-headline text-label-sm">
              <span className="material-symbols-outlined text-[14px]">science</span>
              <span>Expérimentation de terrain</span>
            </span>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <h4 className="font-headline text-headline-sm text-primary">
          <Link to={`/experimentations/${exp.id}`} className="hover:underline">{exp.title}</Link>
        </h4>
        <p className="font-body text-body-sm text-on-surface-variant line-clamp-2">{exp.description}</p>
      </div>
      <div className="flex items-center justify-between text-outline font-body text-body-sm pt-1">
        <span className="text-on-surface-variant font-medium">{exp.participants_count} agent(s) inscrit(s)</span>
        <span>{exp.comments_count} commentaire(s)</span>
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-surface-container-low">
        <button
          className="flex-1 py-2 px-3 rounded-lg hover:bg-surface-container-low text-on-surface-variant font-headline text-label-md flex items-center justify-center gap-2 transition-colors"
          onClick={() => setOpen((v) => !v)} type="button"
        >
          <span className="material-symbols-outlined text-[20px]">chat_bubble_outline</span>
          <span>Débattre</span>
        </button>
        <Link
          to={`/experimentations/${exp.id}`}
          className="flex-1 py-2 px-3 rounded-lg hover:bg-surface-container-low text-on-surface-variant font-headline text-label-md flex items-center justify-center gap-2 transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">open_in_new</span>
          <span>Détails</span>
        </Link>
        {canInteract && !exp.joined && (
          <button
            className="py-2 px-4 bg-secondary hover:bg-secondary-container text-on-secondary font-headline text-label-md rounded-lg flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
            onClick={join} disabled={busy} type="button"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>Rejoindre le test</span>
          </button>
        )}
        {exp.joined && (
          <span className="py-2 px-4 bg-tertiary-fixed/60 text-on-tertiary-fixed-variant font-headline text-label-md rounded-lg flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px] filled">check_circle</span>
            <span>Inscrit(e)</span>
          </span>
        )}
      </div>
      {open && (
        <div className="pt-3 bg-surface-container-low/50 p-3 rounded-xl">
          <CommentThread entityType="experiment" entityId={exp.id} />
        </div>
      )}
    </SectionCard>
  );
}

function VoteCard({ vote, onVoted }: { vote: VoteSession; onVoted: () => void }) {
  const { canInteract } = useAuth();
  const { show, Toast } = useToast();
  const [busy, setBusy] = useState(false);
  const max = Math.max(0, ...vote.options.map((o) => o.votes));

  async function vote_(optionId: number) {
    setBusy(true);
    try { await castVote(vote.id, optionId); show('Vote enregistré, merci pour votre participation'); onVoted(); }
    finally { setBusy(false); }
  }

  return (
    <SectionCard className="p-4 space-y-3 hover:shadow-card-hover transition-shadow">
      {Toast}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center text-on-secondary shrink-0 shadow-sm">
            <span className="material-symbols-outlined text-[22px]">how_to_vote</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-headline text-headline-sm text-on-surface">{vote.created_by_name}</h3>
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-headline text-label-sm">Consultation</span>
            </div>
            <div className="flex items-center gap-2 text-outline font-body text-body-sm text-[12px]">
              <span>Ouvert le {new Date(vote.opens_at).toLocaleDateString('fr-FR')}</span>
              {vote.closes_at && (<><span>•</span><span className="text-error font-medium">Clôture le {new Date(vote.closes_at).toLocaleDateString('fr-FR')}</span></>)}
            </div>
          </div>
        </div>
        <span className="px-2.5 py-1 bg-secondary-fixed text-on-secondary-fixed-variant rounded-full font-headline text-label-sm font-bold">
          {vote.status === 'open' ? 'En cours' : 'Clôturé'}
        </span>
      </div>
      <div className="space-y-2">
        <h4 className="font-headline text-headline-sm text-on-surface">
          <Link to={`/votes/${vote.id}`} className="hover:underline">{vote.question}</Link>
        </h4>
      </div>
      <div className="space-y-3 pt-2">
        {vote.options.map((opt) => {
          const pct = vote.total_votes > 0 ? Math.round((opt.votes / vote.total_votes) * 100) : 0;
          const mine = vote.my_option_id === opt.id;
          const leading = opt.votes === max && max > 0;
          const barCls = mine ? 'bg-primary-fixed/70' : leading ? 'bg-primary-fixed/40' : 'bg-surface-container-high';
          return (
            <div
              key={opt.id}
              className="relative bg-surface-container-low hover:bg-surface-container rounded-xl p-3.5 transition-colors overflow-hidden cursor-pointer"
              onClick={() => { if (canInteract && vote.status === 'open' && !busy) vote_(opt.id); }}
              role={canInteract && vote.status === 'open' ? 'button' : undefined}
            >
              <div className={`absolute inset-y-0 left-0 ${barCls} rounded-xl transition-all duration-700`} style={{ width: `${pct}%` }} />
              <div className="relative flex items-center justify-between z-10 gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`material-symbols-outlined text-[20px] ${mine ? 'text-primary filled' : 'text-outline'}`}>
                    {mine ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                  <span className="font-headline text-label-md text-on-surface">{opt.label}</span>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-headline text-headline-sm text-primary font-bold">{pct}%</span>
                  <p className="text-[11px] text-on-surface-variant font-headline">{opt.votes} vote(s)</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between pt-2">
        <span className="font-body text-body-sm text-outline">
          {vote.total_votes} agent(s) exprimé(s){vote.my_option_id ? ' • Vous avez voté' : ''}
        </span>
        <Link
          to={`/votes/${vote.id}`}
          className="px-3 py-1.5 bg-surface-container hover:bg-surface-container-high text-on-surface font-headline text-label-md rounded-lg flex items-center gap-1 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">add_comment</span>
          <span>Voir le détail</span>
        </Link>
      </div>
    </SectionCard>
  );
}

function RiskCard({ risk }: { risk: Risk }) {
  const [open, setOpen] = useState(false);
  return (
    <SectionCard className="p-4 space-y-3 hover:shadow-card-hover transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Avatar name={risk.proposed_by_name} size={36} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-headline text-headline-sm text-on-surface">{risk.proposed_by_name}</h3>
              <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-headline text-label-sm font-semibold">Signalement Risque</span>
            </div>
            <div className="flex items-center gap-2 text-outline font-body text-body-sm text-[12px]">
              <span>{timeAgo(risk.created_at)}</span>
              {risk.concerns_ivry && (<><span>•</span><span className="text-error font-medium">Concerne Ivry</span></>)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-lg">
          <div className="text-center">
            <span className="block text-[10px] uppercase font-bold text-outline">Impact</span>
            <span className="font-headline text-headline-sm text-error">{risk.importance}/4</span>
          </div>
          <span className="text-outline">|</span>
          <div className="text-center">
            <span className="block text-[10px] uppercase font-bold text-outline">Probabilité</span>
            <span className="font-headline text-headline-sm text-on-surface">{risk.probability}/4</span>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <h4 className="font-headline text-headline-sm text-error">
          <Link to={`/risques/${risk.id}`} className="hover:underline">{risk.title}</Link>
        </h4>
        <p className="font-body text-body-sm text-on-surface-variant line-clamp-2">{risk.description}</p>
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-surface-container-low">
        <button
          className="flex-1 py-2 px-3 rounded-lg hover:bg-surface-container-low text-on-surface-variant font-headline text-label-md flex items-center justify-center gap-2 transition-colors"
          onClick={() => setOpen((v) => !v)} type="button"
        >
          <span className="material-symbols-outlined text-[20px]">comment</span>
          <span>Apporter un cas d'usage ({risk.comments_count})</span>
        </button>
        <Link
          to={`/risques/${risk.id}`}
          className="py-2 px-3 rounded-lg hover:bg-surface-container-low text-primary font-headline text-label-md flex items-center gap-1.5 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">open_in_new</span>
          <span>Détails</span>
        </Link>
      </div>
      {open && (
        <div className="pt-3 bg-surface-container-low/50 p-3 rounded-xl">
          <CommentThread entityType="risk" entityId={risk.id} />
        </div>
      )}
    </SectionCard>
  );
}

function ResourceCard({ res }: { res: Resource }) {
  const [open, setOpen] = useState(false);
  const isVideo = res.kind === 'link' && !!res.url && !!detectVideo(res.url);
  return (
    <SectionCard className="p-4 space-y-3 hover:shadow-card-hover transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Avatar name={res.proposed_by_name} size={36} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-headline text-headline-sm text-on-surface">{res.proposed_by_name}</h3>
              <span className="text-outline font-body text-body-sm">•</span>
              <span className="font-body text-body-sm text-outline">{timeAgo(res.created_at)}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary font-headline text-label-sm">
                <span className="material-symbols-outlined text-[14px]">{res.kind === 'pdf' ? 'picture_as_pdf' : isVideo ? 'play_circle' : 'link'}</span>
                <span>{res.kind === 'pdf' ? 'Document PDF' : isVideo ? 'Vidéo' : 'Ressource en ligne'}</span>
              </span>
              <LevelBadge level={res.level} />
              {res.is_mandatory && <MandatoryBadge />}
            </div>
          </div>
        </div>
      </div>
      <div className="flex gap-3">
        {res.kind === 'pdf' && res.file_path && (
          <PdfThumb src={`${API_URL}/uploads/${res.file_path}`} to={`/ressources/${res.id}`} />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <h4 className="font-headline text-headline-sm text-primary">
            <Link to={`/ressources/${res.id}`} className="hover:underline">{res.title}</Link>
          </h4>
          <p className="font-body text-body-sm text-on-surface-variant line-clamp-2">{res.description}</p>
        </div>
      </div>
      {isVideo && res.url && <VideoEmbed url={res.url} />}
      <div className="flex items-center justify-between text-outline font-body text-body-sm pt-1">
        <span className="flex items-center gap-1 text-on-surface-variant font-medium">
          <span className="material-symbols-outlined text-[16px] text-secondary filled">star</span>
          {res.avg_stars ? `${Number(res.avg_stars).toFixed(1)}/5` : 'Pas encore noté'} ({res.ratings_count})
        </span>
        <span>{res.comments_count} commentaire(s)</span>
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-surface-container-low">
        <button
          className="flex-1 py-2 px-3 rounded-lg hover:bg-surface-container-low text-on-surface-variant font-headline text-label-md flex items-center justify-center gap-2 transition-colors"
          onClick={() => setOpen((v) => !v)} type="button"
        >
          <span className="material-symbols-outlined text-[20px]">chat_bubble_outline</span>
          <span>Débattre</span>
        </button>
        <Link
          to={`/ressources/${res.id}`}
          className="flex-1 py-2 px-3 rounded-lg hover:bg-surface-container-low text-on-surface-variant font-headline text-label-md flex items-center justify-center gap-2 transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">open_in_new</span>
          <span>Consulter</span>
        </Link>
      </div>
      {open && (
        <div className="pt-3 bg-surface-container-low/50 p-3 rounded-xl">
          <CommentThread entityType="resource" entityId={res.id} />
        </div>
      )}
    </SectionCard>
  );
}

// ── Page d'accueil : fil d'actualité 3 colonnes ──

export default function Home() {
  const { user, canInteract } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [stats, setStats] = useState<any>(null);
  const [principles, setPrinciples] = useState<Principle[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [votes, setVotes] = useState<VoteSession[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [filterTypes, setFilterTypes] = useState<FeedKind[]>([]);
  const [filterThemes, setFilterThemes] = useState<string[]>([]);
  const [filterQuery, setFilterQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'alpha' | 'rating'>('date_desc');
  const filterMenuRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const [s, p, e, r, res, v, t] = await Promise.all([
        getStats().catch(() => null),
        getPrinciples().catch(() => []),
        getExperiments().catch(() => []),
        getRisks().catch(() => []),
        getResources({ status: 'published' }).catch(() => []),
        getVotes().catch(() => []),
        getThemes().catch(() => []),
      ]);
      setStats(s); setPrinciples(p); setExperiments(e); setRisks(r); setResources(res); setVotes(v); setThemes(t);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const openComposer = Boolean((location.state as { openComposer?: boolean } | null)?.openComposer);
  useEffect(() => {
    if (!openComposer) return;
    setComposerOpen(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [openComposer, location.pathname, navigate]);

  useEffect(() => {
    if (!filterMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) setFilterMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFilterMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [filterMenuOpen]);

  const hasActiveFilters = filterTypes.length > 0 || filterThemes.length > 0 || filterQuery.trim() !== '' || sortBy !== 'date_desc';

  function resetFilters() {
    setFilterTypes([]);
    setFilterThemes([]);
    setFilterQuery('');
    setSortBy('date_desc');
    setFilterMenuOpen(false);
  }

  function toggleType(kind: FeedKind) {
    const next = filterTypes.includes(kind) ? filterTypes.filter((k) => k !== kind) : [...filterTypes, kind];
    setFilterTypes(next);
    if (next.length) {
      const allowed = new Set(themes.filter((t) => next.includes(t.scope)).map((t) => t.slug));
      setFilterThemes((prev) => prev.filter((slug) => allowed.has(slug)));
    }
  }

  function toggleTheme(slug: string) {
    setFilterThemes((prev) => prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]);
  }

  const filteredFeed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [
      ...experiments.map((data) => ({ kind: 'experiment' as const, date: data.created_at, data })),
      ...risks.map((data) => ({ kind: 'risk' as const, date: data.created_at, data })),
      ...resources.map((data) => ({ kind: 'resource' as const, date: data.created_at, data })),
      ...votes.map((data) => ({ kind: 'vote' as const, date: data.opens_at, data })),
    ];
    const q = filterQuery.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (filterTypes.length > 0 && !filterTypes.includes(item.kind)) return false;
      if (filterThemes.length > 0 && !feedThemes(item).some((t) => filterThemes.includes(t.slug))) return false;
      if (q && !feedText(item).toLowerCase().includes(q)) return false;
      return true;
    });
    filtered.sort((a, b) => {
      if (sortBy === 'date_asc') return +new Date(a.date) - +new Date(b.date);
      if (sortBy === 'alpha') return feedTitle(a).localeCompare(feedTitle(b), 'fr', { sensitivity: 'base' });
      if (sortBy === 'rating') {
        const diff = feedRating(b) - feedRating(a);
        if (diff !== 0) return diff;
      }
      return +new Date(b.date) - +new Date(a.date);
    });
    return filtered;
  }, [experiments, risks, resources, votes, filterTypes, filterThemes, filterQuery, sortBy]);

  const feed = useMemo(() => filteredFeed.slice(0, 12), [filteredFeed]);

  const openVotes = votes.filter((v) => v.status === 'open');
  const featuredVote = openVotes[0];
  const adopted = principles.filter((p) => p.status === 'adopted').length;
  const firstName = user?.display_name?.split(' ')[0] || '';
  const composerTargets = [
    { icon: 'lightbulb', label: 'Expérimentation', full: 'Proposer une expérimentation', to: '/experimentations', color: 'text-secondary' },
    { icon: 'warning', label: 'Risque IA', full: 'Déclarer un risque IA', to: '/risques', color: 'text-error' },
    { icon: 'article', label: 'Document', full: 'Partager un document ou un lien', to: '/ressources', color: 'text-primary' },
    { icon: 'how_to_vote', label: 'Vote', full: 'Lancer une consultation ou un vote', to: '/votes', color: 'text-tertiary-container' },
  ];

  const visibleThemeScopes = filterTypes.length > 0
    ? THEME_SCOPES.filter((s) => filterTypes.includes(s.scope))
    : THEME_SCOPES;
  const themeGroups = visibleThemeScopes
    .map((s) => ({ ...s, themes: themes.filter((t) => t.scope === s.scope) }))
    .filter((g) => g.themes.length > 0);
  const themesOnlyForVotes = filterTypes.length > 0 && visibleThemeScopes.length === 0;
  const filterSelectionLabel = filterTypes.length === 0 && filterThemes.length === 0
    ? 'Tous les types et thèmes'
    : [
        filterTypes.length > 0 ? `${filterTypes.length} type(s)` : 'Tous les types',
        filterThemes.length > 0 ? `${filterThemes.length} thème(s)` : 'Tous les thèmes',
      ].join(' · ');

  return (
    <div className="w-full max-w-[1440px] mx-auto px-3 sm:px-4 lg:px-6 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── COLONNE 1 : profil & raccourcis ── */}
        <aside className="lg:col-span-3 space-y-4">
          <SectionCard className="p-5 space-y-4">
            <div className="flex items-start gap-3.5">
              <Avatar name={user?.display_name} size={56} />
              <div className="min-w-0 flex-1">
                <h2 className="font-headline text-headline-sm text-on-surface truncate">{user?.display_name}</h2>
                <p className="font-body text-body-sm text-on-surface-variant truncate">{user?.direction || user?.service || user?.email}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {user?.roles?.length ? user.roles.map((r) => <RoleBadge key={r} role={r} />)
                    : <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-headline text-label-sm">Lecteur</span>}
                </div>
              </div>
            </div>
            <Link
              to="/compte"
              className="w-full py-2 px-3 text-center bg-surface-container hover:bg-surface-container-high text-primary font-headline text-label-md rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">badge</span>
              <span>Mon compte</span>
            </Link>
          </SectionCard>

          <nav aria-label="Raccourcis rapides" className="bg-surface-container-lowest rounded-2xl p-3 shadow-card space-y-1">
            {[
              { to: '/ressources', icon: 'folder', label: 'Base documentaire', badge: resources.length ? String(resources.length) : null, tint: 'bg-surface-container-highest text-on-surface-variant' },
              { to: '/experimentations', icon: 'science', label: 'Expérimentations', badge: experiments.length ? `${experiments.length}` : null, tint: 'bg-tertiary-fixed/60 text-tertiary' },
              { to: '/risques', icon: 'warning', label: 'Alertes Risques', badge: risks.length ? `${risks.length}` : null, tint: 'bg-error-container/60 text-error' },
              { to: '/votes', icon: 'how_to_vote', label: 'Consultations & Votes', badge: openVotes.length ? `${openVotes.length} ouverts` : null, tint: 'bg-secondary-fixed text-on-secondary-fixed-variant' },
              { to: '/cartographie', icon: 'hub', label: 'Cartographie dynamique', badge: null, tint: 'bg-primary-fixed/50 text-primary' },
            ].map(({ to, icon, label, badge, tint }) => (
              <Link key={to} to={to} className="flex items-center justify-between p-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tint}`}>
                    <span className="material-symbols-outlined text-[18px]">{icon}</span>
                  </div>
                  <span className="font-headline text-label-md">{label}</span>
                </div>
                {badge && <span className="px-2 py-0.5 rounded-full bg-surface-container-high font-headline text-label-sm text-on-surface-variant">{badge}</span>}
              </Link>
            ))}
          </nav>

          {principles.length > 0 && (
            <div className="bg-gradient-to-br from-primary to-primary-container text-on-primary rounded-2xl p-5 shadow-card space-y-3 relative overflow-hidden">
              <div className="absolute -right-4 -bottom-4 w-28 h-28 bg-surface-container-lowest/10 rounded-full blur-xl pointer-events-none" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary-fixed text-[20px]">verified</span>
                  <span className="font-headline text-label-sm tracking-wider uppercase text-secondary-fixed">Cap Charte</span>
                </div>
                <span className="font-headline text-headline-sm font-bold text-on-primary">{adopted} / {principles.length}</span>
              </div>
              <p className="font-body text-body-sm text-primary-fixed leading-snug">
                {adopted} principe(s) adopté(s) par le collectif sur {principles.length} proposé(s).
              </p>
              <div className="space-y-1.5 pt-1">
                <div className="w-full bg-on-primary/20 h-2 rounded-full overflow-hidden">
                  <div className="bg-tertiary-fixed-dim h-full rounded-full" style={{ width: `${principles.length ? (adopted / principles.length) * 100 : 0}%` }} />
                </div>
                <div className="flex justify-between font-headline text-label-sm text-primary-fixed text-[11px]">
                  <span>Validation progressive</span>
                  <span>{principles.length ? Math.round((adopted / principles.length) * 100) : 0}% d'avancement</span>
                </div>
              </div>
              <Link to="/cartographie" className="inline-flex items-center gap-1.5 font-headline text-label-md text-secondary-fixed hover:text-white pt-2 transition-colors">
                <span>Explorer les principes en débat</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Link>
            </div>
          )}
        </aside>

        {/* ── COLONNE 2 : fil d'actualité ── */}
        <div className="lg:col-span-6 space-y-5">
          {/* Composer */}
          {canInteract && (
            <div className="flex items-stretch gap-2.5">
              <SectionCard className="min-w-0 flex-1 p-3 sm:p-3.5 space-y-1.5">
                <div className="flex flex-col items-center gap-0.5">
                  <PrimaryButton icon="add_circle" onClick={() => setComposerOpen(true)} className="py-1.5">
                    Proposer une contribution
                  </PrimaryButton>
                  <p className="font-body text-body-sm text-on-surface-variant text-[12px] text-center">
                    Partagez une idée, un risque, un document ou un vote, {firstName}.
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                  {composerTargets.map(({ icon, label, to, color }) => (
                    <button
                      key={to + label}
                      className="flex flex-col items-center justify-center gap-0.5 py-1 px-1.5 rounded-lg hover:bg-surface-container-low transition-colors text-on-surface-variant text-center"
                      onClick={() => navigate(to)} type="button"
                    >
                      <span className={`material-symbols-outlined text-[18px] ${color}`}>{icon}</span>
                      <span className="font-headline text-label-sm leading-tight">{label}</span>
                    </button>
                  ))}
                </div>
              </SectionCard>
              <div className="flex w-[24%] max-w-[140px] shrink-0 flex-col justify-center gap-1.5">
                <button
                  type="button"
                  onClick={() => { setFiltersOpen((v) => !v); setFilterMenuOpen(false); }}
                  aria-expanded={filtersOpen}
                  aria-controls="home-feed-filters"
                  className={`relative inline-flex w-full items-center justify-center gap-1 px-2 py-2 rounded-full font-headline text-[11px] sm:text-label-md leading-tight shadow-sm transition-colors ${
                    filtersOpen || hasActiveFilters
                      ? 'bg-primary text-on-primary hover:bg-primary-container'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">filter_list</span>
                  <span>Trier / filtrer</span>
                  {hasActiveFilters && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-tertiary-fixed-dim" />
                  )}
                </button>
                <GhostButton
                  onClick={resetFilters}
                  disabled={!hasActiveFilters}
                  className="!px-2 !py-1 !text-[11px] leading-tight w-full"
                >
                  Réinitialiser
                </GhostButton>
              </div>
            </div>
          )}

          {filtersOpen && (
            <div id="home-feed-filters">
              <SectionCard className="p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-headline text-label-md text-on-surface">
                    Trier et filtrer les contributions
                  </h3>
                  <span className="font-body text-body-sm text-outline">
                    {filteredFeed.length} contribution(s)
                  </span>
                </div>
                <div className="space-y-3">
                  <label className="block relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
                    <StitchInput
                      value={filterQuery}
                      onChange={(e) => setFilterQuery(e.target.value)}
                      placeholder="Rechercher un titre, une description ou un auteur…"
                      aria-label="Rechercher une contribution"
                      className="!pl-9"
                    />
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="sm:col-span-2 space-y-1.5" ref={filterMenuRef}>
                      <span className="block font-headline text-label-sm text-on-surface-variant uppercase tracking-wider">Types et thèmes</span>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setFilterMenuOpen((v) => !v)}
                          aria-expanded={filterMenuOpen}
                          aria-haspopup="true"
                          className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 bg-surface-container-low hover:bg-surface-container rounded-lg font-body text-body-md text-on-surface transition-colors"
                        >
                          <span className={filterTypes.length === 0 && filterThemes.length === 0 ? 'text-outline' : ''}>{filterSelectionLabel}</span>
                          <span className="text-[10px] text-outline">▼</span>
                        </button>
                        {filterMenuOpen && (
                          <div className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-surface-container bg-surface-container-lowest p-2 space-y-3 shadow-modal">
                            <div>
                              <p className="px-1.5 font-headline text-[11px] uppercase tracking-wider text-outline">Types</p>
                              {FEED_TYPE_OPTIONS.map((opt) => (
                                <label key={opt.kind} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-surface-container cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={filterTypes.includes(opt.kind)}
                                    onChange={() => toggleType(opt.kind)}
                                    className="h-3.5 w-3.5 accent-primary"
                                  />
                                  <span className="font-body text-body-sm text-on-surface">{opt.label}</span>
                                </label>
                              ))}
                              <p className="px-1.5 pt-0.5 font-body text-[11px] text-outline">Aucun type coché = tous les types.</p>
                            </div>
                            <div>
                              <p className="px-1.5 font-headline text-[11px] uppercase tracking-wider text-outline">
                                Thèmes{filterThemes.length > 0 ? ` (${filterThemes.length})` : ''}
                              </p>
                              {themesOnlyForVotes ? (
                                <p className="px-1.5 font-body text-body-sm text-outline">Les votes ne sont pas associés à des thèmes.</p>
                              ) : themeGroups.length === 0 ? (
                                <p className="px-1.5 font-body text-body-sm text-outline">Aucun thème disponible pour cette sélection.</p>
                              ) : themeGroups.map((group) => (
                                <div key={group.scope} className="mt-1.5 first:mt-0">
                                  <p className="px-1.5 font-headline text-[11px] uppercase tracking-wider text-on-surface-variant">{group.label}</p>
                                  {group.themes.map((t) => (
                                    <label key={t.id} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-surface-container cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={filterThemes.includes(t.slug)}
                                        onChange={() => toggleTheme(t.slug)}
                                        className="h-3.5 w-3.5 accent-secondary"
                                      />
                                      <span className="font-body text-body-sm text-on-surface">{t.label}</span>
                                    </label>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <label className="block space-y-1.5">
                      <span className="block font-headline text-label-sm text-on-surface-variant uppercase tracking-wider">Tri</span>
                      <StitchSelect
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                        aria-label="Trier les contributions"
                      >
                        <option value="date_desc">Plus récentes</option>
                        <option value="date_asc">Plus anciennes</option>
                        <option value="alpha">A → Z</option>
                        <option value="rating">Mieux notées</option>
                      </StitchSelect>
                    </label>
                  </div>
                </div>
              </SectionCard>
            </div>
          )}

          {loading ? <StitchSpinner /> : feed.length === 0 ? (
            <SectionCard className="p-8 text-center space-y-3">
              <p className="font-body text-body-md text-on-surface-variant">
                {hasActiveFilters
                  ? 'Aucune contribution ne correspond à ces critères.'
                  : "Aucune contribution pour l'instant. Soyez le premier agent à partager une idée !"}
              </p>
              {hasActiveFilters && (
                <GhostButton onClick={resetFilters} icon="filter_list_off" className="!text-label-sm">
                  Réinitialiser les filtres
                </GhostButton>
              )}
            </SectionCard>
          ) : feed.map((item) => {
            switch (item.kind) {
              case 'experiment': return <ExperimentCard key={`e${item.data.id}`} exp={item.data} onJoined={load} />;
              case 'vote': return <VoteCard key={`v${item.data.id}`} vote={item.data} onVoted={load} />;
              case 'risk': return <RiskCard key={`r${item.data.id}`} risk={item.data} />;
              case 'resource': return <ResourceCard key={`d${item.data.id}`} res={item.data} />;
            }
          })}
        </div>

        {/* ── COLONNE 3 : widgets d'action & collectif ── */}
        <aside className="lg:col-span-3 space-y-5">
          {featuredVote && (
            <SectionCard className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-headline text-label-sm tracking-wider uppercase text-error font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-error animate-ping" />
                  Consultation prioritaire
                </span>
              </div>
              <h3 className="font-headline text-headline-sm text-on-surface leading-snug">{featuredVote.question}</h3>
              <div className="flex items-center gap-4 py-1">
                {(() => {
                  const top = Math.max(0, ...featuredVote.options.map((o) => o.votes));
                  const pct = featuredVote.total_votes > 0 ? Math.round((top / featuredVote.total_votes) * 100) : 0;
                  return (
                    <>
                      <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                        <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 36 36">
                          <path className="text-surface-container-high" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.5" />
                          <path className="text-secondary" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray={`${pct}, 100`} strokeLinecap="round" strokeWidth="3.5" />
                        </svg>
                        <span className="absolute font-headline text-headline-sm font-bold text-on-surface text-[14px]">{pct}%</span>
                      </div>
                      <div>
                        <p className="font-headline text-label-md text-on-surface font-semibold">Option en tête</p>
                        <p className="font-body text-body-sm text-outline">{featuredVote.total_votes} agent(s) ont participé</p>
                      </div>
                    </>
                  );
                })()}
              </div>
              <Link
                to={`/votes/${featuredVote.id}`}
                className="w-full py-2.5 px-4 bg-secondary hover:bg-secondary-container text-on-secondary rounded-lg font-headline text-label-md transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">how_to_vote</span>
                <span>{featuredVote.my_option_id ? 'Voir mon vote' : 'Voter maintenant'}</span>
              </Link>
            </SectionCard>
          )}

          {stats && (
            <SectionCard className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-headline text-headline-sm text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-[20px]">emoji_events</span>
                  <span>Dynamique collective</span>
                </h3>
              </div>
              <div className="space-y-3">
                {[
                  { icon: 'lightbulb', label: 'Idées émises', value: stats.ideas_total, tint: 'bg-secondary-fixed text-on-secondary-fixed-variant' },
                  { icon: 'check_circle', label: 'Idées retenues', value: stats.ideas_retained, tint: 'bg-tertiary-fixed/60 text-tertiary' },
                  { icon: 'verified', label: 'Principes adoptés', value: stats.principles_adopted, tint: 'bg-primary-fixed/50 text-primary' },
                ].map(({ icon, label, value, tint }, i) => (
                  <div key={label} className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low">
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full ${tint} font-bold text-[12px] flex items-center justify-center shadow-sm`}>{i + 1}</span>
                      <p className="font-headline text-label-md text-on-surface">{label}</p>
                    </div>
                    <span className="font-headline text-label-md text-primary font-bold">{value}</span>
                  </div>
                ))}
              </div>
              {stats.active_themes?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {stats.active_themes.map((t: any) => (
                    <span key={t.label} className="px-2 py-0.5 rounded-full bg-secondary-fixed/60 text-on-secondary-fixed-variant font-headline text-label-sm">
                      #{t.label} · {t.items}
                    </span>
                  ))}
                </div>
              )}
              <p className="font-body text-body-sm text-outline text-[12px] text-center">
                Bravo à toutes les équipes pour l'acculturation partagée.
              </p>
            </SectionCard>
          )}

          <div className="bg-gradient-to-br from-primary via-primary-container to-secondary rounded-2xl p-6 text-on-primary shadow-card flex flex-col gap-4 relative overflow-hidden">
            <div className="relative z-10 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px]">lightbulb</span>
                <span className="font-headline text-label-md tracking-wider uppercase opacity-90">Co-construction Ivry</span>
              </div>
              <h4 className="font-headline text-headline-md font-bold leading-tight">Vous avez lu une étude percutante ?</h4>
              <p className="font-body text-body-sm opacity-90">
                Chaque ressource alimente le corpus d'apprentissage du Comité Éthique municipal et des IAmbassadeurs d'Ivry.
              </p>
              {canInteract && (
                <Link
                  to="/ressources"
                  state={{ openCreateResource: true }}
                  className="mt-2 w-full py-2.5 px-4 bg-surface-container-lowest text-primary hover:bg-surface-bright rounded-full font-headline text-label-md font-bold shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                  <span>Soumettre un document</span>
                </Link>
              )}
            </div>
            <svg className="absolute -right-10 -bottom-10 opacity-15 w-48 h-48 pointer-events-none" fill="currentColor" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="80" />
              <circle cx="100" cy="100" r="50" />
            </svg>
          </div>
        </aside>
      </div>

      {/* Modale de contribution : renvoie vers le module adapté */}
      <Modal open={composerOpen} onClose={() => setComposerOpen(false)} title="Nouvelle contribution" icon="edit_note">
        <p className="font-body text-body-md text-on-surface-variant">
          Choisissez le type de contribution : vous serez redirigé vers le formulaire dédié du module.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {composerTargets.map(({ icon, full, to, color }) => (
            <button
              key={to + full}
              className="flex items-center gap-3 p-4 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors text-left"
              onClick={() => { setComposerOpen(false); navigate(to); }} type="button"
            >
              <span className={`material-symbols-outlined text-[24px] ${color}`}>{icon}</span>
              <span className="font-headline text-label-md text-on-surface">{full}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between pt-3">
          <span className="font-body text-body-sm text-outline text-[12px] flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px] text-tertiary">lock</span>
            Modéré par le Comité d'Ivry
          </span>
        </div>
      </Modal>
    </div>
  );
}
