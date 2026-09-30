export interface VideoEmbedInfo {
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
    if (id) return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${id}` };
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

  return (
    <div className={`aspect-video w-full overflow-hidden rounded-xl bg-black ${className}`}>
      <iframe
        src={info.embedUrl}
        className="h-full w-full"
        title="Vidéo intégrée"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}
