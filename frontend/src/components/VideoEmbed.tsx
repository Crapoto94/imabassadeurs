import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface VideoEmbedInfo {
  id?: string; // identifiant YouTube
  type: 'youtube' | 'vimeo' | 'dailymotion' | 'direct';
  embedUrl?: string; // URL de l'iframe (plateformes)
  src?: string; // URL directe du média (<video>)
}

// Détecte si une URL pointe vers une vidéo connue et fournit la source d'intégration.
export function detectVideo(url: string | null | undefined): VideoEmbedInfo | null {
  if (!url) return null;
  let u: URL;
  try { u = new URL(url.trim()); } catch { return null; }
  const host = u.hostname.toLowerCase();

  // YouTube (youtube.com/watch?v=…, youtu.be/…, youtube.com/embed/…)
  if (/(^|\.)(youtube\.com|youtu\.be)$/.test(host)) {
    let id: string | null = null;
    if (host.endsWith('youtu.be')) {
      id = u.pathname.split('/').filter(Boolean)[0] || null;
    } else if (u.pathname.startsWith('/embed/')) {
      id = u.pathname.split('/').filter(Boolean)[0] || null;
    } else {
      id = u.searchParams.get('v');
    }
    if (id) return { type: 'youtube', id, embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1` };
    return null;
  }

  // Vimeo
  if (host.endsWith('vimeo.com')) {
    const id = u.pathname.split('/').filter(Boolean)[0] || null;
    if (id && /^\d+$/.test(id)) return { type: 'vimeo', embedUrl: `https://player.vimeo.com/video/${id}` };
    return null;
  }

  // Dailymotion (dailymotion.com/video/xxx, dai.ly/xxx)
  if (host.endsWith('dailymotion.com') || host.endsWith('dai.ly')) {
    const m = u.pathname.match(/\/video\/([a-zA-Z0-9]+)/) || (host.endsWith('dai.ly') ? u.pathname.match(/\/([a-zA-Z0-9]+)/) : null);
    if (m && m[1]) return { type: 'dailymotion', embedUrl: `https://www.dailymotion.com/embed/video/${m[1]}` };
    return null;
  }

  // Fichier vidéo direct
  if (/\.(mp4|webm|ogg|ogv|mov)$/.test(u.pathname.toLowerCase())) {
    return { type: 'direct', src: u.toString() };
  }

  return null;
}

const IFRAME_ALLOW = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
const isMobile = () => window.matchMedia('(max-width: 767px)').matches;

// YouTube : simple vignette (aucun lien vers la chaîne tant que la vidéo n'est pas lancée).
// Mobile : lecture dans un overlay plein écran ; ordinateur : lecture à la place de la vignette.
function YoutubeThumb({ info, className }: { info: VideoEmbedInfo; className: string }) {
  const [playing, setPlaying] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);

  function start() {
    if (isMobile()) setFull(true); else setPlaying(true);
  }
  function close() {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    setFull(false);
  }
  useEffect(() => {
    if (!full) return;
    document.body.style.overflow = 'hidden';
    overlayRef.current?.requestFullscreen?.().catch(() => {});
    const onFs = () => { if (!document.fullscreenElement) setFull(false); };
    document.addEventListener('fullscreenchange', onFs);
    return () => { document.body.style.overflow = ''; document.removeEventListener('fullscreenchange', onFs); };
  }, [full]);

  const frame = (
    <iframe
      src={info.embedUrl}
      className="h-full w-full"
      title="Vidéo intégrée"
      frameBorder="0"
      allow={IFRAME_ALLOW}
      allowFullScreen
    />
  );

  return (
    <div className={`relative aspect-video w-full overflow-hidden rounded-xl bg-black ${className}`}>
      {playing ? frame : (
        <button type="button" onClick={start} aria-label="Lire la vidéo" className="group absolute inset-0 h-full w-full">
          <img
            src={`https://i.ytimg.com/vi/${info.id}/hqdefault.jpg`}
            alt="" loading="lazy" referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 shadow-lg">
              <span className="material-symbols-outlined filled text-white text-[34px]">play_arrow</span>
            </span>
          </span>
        </button>
      )}
      {full && createPortal(
        <div ref={overlayRef} className="fixed inset-0 z-[100] bg-black flex flex-col">
          <button type="button" onClick={close} aria-label="Fermer la vidéo"
            className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
          <div className="m-auto aspect-video w-full max-h-full">{frame}</div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default function VideoEmbed({ url, className = '' }: { url: string; className?: string }) {
  const info = detectVideo(url);
  if (!info) return null;

  if (info.type === 'direct') {
    return (
      <div className={`aspect-video w-full overflow-hidden rounded-xl bg-black ${className}`}>
        <video src={info.src} controls preload="metadata" className="h-full w-full" />
      </div>
    );
  }

  if (info.type === 'youtube') return <YoutubeThumb info={info} className={className} />;

  return (
    <div className={`aspect-video w-full overflow-hidden rounded-xl bg-black ${className}`}>
      <iframe
        src={info.embedUrl}
        className="h-full w-full"
        title="Vidéo intégrée"
        frameBorder="0"
        allow={IFRAME_ALLOW}
        allowFullScreen
      />
    </div>
  );
}
