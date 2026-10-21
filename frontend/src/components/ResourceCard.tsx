import { ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { rateResource, synthResource } from '../api/endpoints';
import { API_URL } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import AiPanel from './AiPanel';
import CommentThread from './CommentThread';
import PdfThumb from './PdfThumb';
import StarRating from './StarRating';
import VideoEmbed, { detectVideo } from './VideoEmbed';
import { Avatar, LevelBadge, MandatoryBadge, timeAgo, useToast } from './stitch';
import type { Resource } from '../types';

function ResourceTags({ res, isVideo }: { res: Resource; isVideo: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(3);
  const [overflow, setOverflow] = useState(false);
  const themeKey = (res.themes || []).map((theme) => theme.id).join(',');

  const tagCls = 'inline-flex h-5 items-center gap-1 px-2 rounded-full font-headline text-label-sm leading-none whitespace-nowrap';
  const tags: { key: string; node: ReactNode }[] = [
    {
      key: 'kind',
      node: (
        <span className={`${tagCls} bg-surface-container text-on-surface-variant`}>
          <span className={`material-symbols-outlined text-[12px] ${res.kind === 'pdf' ? 'text-error' : isVideo ? 'text-tertiary' : 'text-secondary'}`}>
            {res.kind === 'pdf' ? 'picture_as_pdf' : isVideo ? 'play_circle' : 'open_in_new'}
          </span>
          <span>{res.kind === 'pdf' ? 'PDF' : isVideo ? 'Vidéo' : 'Lien'}</span>
        </span>
      ),
    },
    ...(res.level ? [{ key: 'level', node: <LevelBadge level={res.level} className="!h-5 !px-2 !py-0 !leading-none !normal-case !tracking-normal !text-label-sm" /> }] : []),
    ...(res.is_mandatory ? [{ key: 'mandatory', node: <MandatoryBadge className="!h-5 !px-2 !py-0 !leading-none !normal-case !tracking-normal !text-label-sm" /> }] : []),
    ...(res.themes || []).map((theme) => ({
      key: `theme-${theme.id}`,
      node: (
        <span className={`${tagCls} bg-surface-container text-on-surface-variant`}>
          <span className="material-symbols-outlined text-[12px] text-secondary">sell</span>
          <span>{theme.label}</span>
        </span>
      ),
    })),
  ];

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const measure = measureRef.current;
    if (!wrap || !measure) return;

    const compute = () => {
      const nodes = Array.from(measure.querySelectorAll<HTMLElement>('[data-tag]'));
      if (!nodes.length) {
        setVisibleCount(0);
        setOverflow(false);
        return;
      }
      const available = wrap.clientWidth;
      const gap = 6;
      const moreWidth = 28;
      let used = 0;
      let count = 0;
      for (const node of nodes) {
        const width = node.offsetWidth;
        const next = used + (count ? gap : 0) + width;
        if (next > available) break;
        used = next;
        count++;
      }
      if (count < nodes.length) {
        while (count > 0 && used + gap + moreWidth > available) {
          count--;
          used = nodes.slice(0, count).reduce((sum, node, i) => sum + (i ? gap : 0) + node.offsetWidth, 0);
        }
      }
      setVisibleCount(count);
      setOverflow(count < nodes.length);
    };

    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [res.kind, res.level, res.is_mandatory, themeKey, isVideo]);

  return (
    <div ref={wrapRef} className="relative flex min-w-0 flex-1 items-center">
      <div ref={measureRef} aria-hidden className="pointer-events-none invisible absolute left-0 top-0 flex items-center gap-1.5 whitespace-nowrap">
        {tags.map((tag) => <span key={tag.key} data-tag className="flex items-center">{tag.node}</span>)}
      </div>
      <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
        {tags.slice(0, visibleCount).map((tag) => (
          <span key={tag.key} className="flex shrink-0 items-center">{tag.node}</span>
        ))}
      </div>
      {overflow && (
        <div className="group relative ml-1.5 shrink-0">
          <button
            type="button"
            aria-label="Afficher tous les tags"
            className="flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-container px-1 font-headline text-label-sm text-on-surface-variant hover:bg-surface-container-high"
          >
            ...
          </button>
          <div className="invisible absolute right-0 top-full z-20 flex w-max max-w-[min(16rem,80vw)] flex-wrap justify-end gap-1.5 rounded-lg border border-surface-container bg-surface-container-lowest p-2 shadow-modal group-hover:visible group-focus-within:visible">
            {tags.map((tag) => <span key={tag.key} className="flex items-center">{tag.node}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResourceCard({ res, onChanged }: { res: Resource; onChanged: () => void }) {
  const { canInteract } = useAuth();
  const { show, Toast } = useToast();
  const [forumOpen, setForumOpen] = useState(false);
  const [aiDoc, setAiDoc] = useState(false);

  async function rate(stars: number) {
    await rateResource(res.id, stars);
    show(`Merci ! Votre note (${stars}/4) a été prise en compte.`);
    onChanged();
  }

  const isVideo = res.kind === 'link' && !!res.url && !!detectVideo(res.url);

  return (
    <article className="bg-surface-container-lowest rounded-2xl p-3.5 shadow-card hover:shadow-card-hover transition-shadow flex flex-col gap-2.5">
      {Toast}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="min-w-0 flex-1 flex flex-col gap-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar name={res.proposed_by_name} size={20} />
            <span className="max-w-[9rem] shrink-0 truncate font-headline text-label-sm text-on-surface">{res.proposed_by_name}</span>
            <ResourceTags res={res} isVideo={isVideo} />
            <span className="shrink-0 whitespace-nowrap font-body text-[11px] text-outline">• {timeAgo(res.created_at)}</span>
          </div>

          <div className="flex gap-3">
            {res.kind === 'pdf' && res.file_path && (
              <PdfThumb src={`${API_URL}/uploads/${res.file_path}`} to={`/ressources/${res.id}`} width={80} />
            )}
            <div className="min-w-0 flex-1">
              <h2 className="font-headline text-headline-sm text-primary font-bold hover:text-secondary transition-colors">
                <Link to={`/ressources/${res.id}`}>{res.title}</Link>
              </h2>
              <p className="font-body text-body-sm text-on-surface-variant mt-1 line-clamp-2">{res.description}</p>
            </div>
          </div>

          {res.kind === 'link' && res.url && (
            <a
              href={res.url}
              target="_blank"
              rel="noreferrer"
              title={res.url}
              className="inline-flex max-w-full items-center gap-1.5 font-body text-body-sm text-primary hover:underline"
            >
              <span className="material-symbols-outlined shrink-0 text-[14px]">open_in_new</span>
              <span className="truncate">{res.url}</span>
            </a>
          )}

          {isVideo && res.url && (
            <div className="w-[70%]">
              <VideoEmbed url={res.url} />
            </div>
          )}
        </div>

        <aside className="flex shrink-0 flex-row flex-wrap items-center justify-end gap-2 border-t border-surface-container-low pt-2 sm:w-36 sm:flex-col sm:items-end sm:justify-start sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
          <div className="flex items-center gap-2">
            {canInteract && (
              <StarRating value={Math.round(res.my_rating || res.avg_stars || 0)} size={14} onRate={rate} />
            )}
            <span className="flex items-center gap-1 font-headline text-label-sm text-on-surface-variant" title={`${res.ratings_count} avis`}>
              <span className="material-symbols-outlined text-[15px] text-secondary filled">star</span>
              {res.avg_stars ? Number(res.avg_stars).toFixed(1) : '—'}
              <span className="text-outline">({res.ratings_count})</span>
            </span>
          </div>
          <div className="flex items-center gap-1 sm:w-full sm:flex-col sm:items-stretch">
            {canInteract && (
              <>
                <button
                  className="flex items-center justify-center gap-1 px-2.5 py-1 text-primary hover:bg-surface-container-low rounded-full font-headline text-label-sm transition-colors sm:justify-start"
                  onClick={() => setAiDoc((v) => !v)} type="button"
                  title="Synthétiser ce document par IA"
                >
                  <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                  <span>Résumer</span>
                </button>
                <button
                  className="flex items-center justify-center gap-1 px-2.5 py-1 text-on-surface-variant hover:bg-surface-container-low rounded-full font-headline text-label-sm transition-colors sm:justify-start"
                  onClick={() => setForumOpen((v) => !v)} type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">chat_bubble_outline</span>
                  <span>{res.comments_count}</span>
                </button>
              </>
            )}
            <Link
              to={`/ressources/${res.id}`}
              className="flex items-center justify-center gap-1 px-2.5 py-1 text-on-surface-variant hover:bg-surface-container rounded-full font-headline text-label-sm transition-colors sm:justify-start"
            >
              <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              <span>Consulter</span>
            </Link>
          </div>
        </aside>
      </div>

      {aiDoc && (
        <AiPanel label="Synthèse certifiée par IA APM Ivry" run={() => synthResource(res.id)} />
      )}
      {forumOpen && (
        <div className="pt-2 border-t border-surface-container-low">
          <CommentThread entityType="resource" entityId={res.id} />
        </div>
      )}
    </article>
  );
}
