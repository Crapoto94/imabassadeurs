// Miniature cliquable d'une vidéo hébergée hors plateforme (SharePoint, Stream, etc.).
// Le bouton « Ouvrir la vidéo » et la mention « nouvel onglet » évitent la confusion avec un lecteur intégré.
export default function VideoThumb({ poster, href, onClick, className = '', large = false }: {
  poster?: string | null;
  href?: string | null;
  onClick?: () => void;
  className?: string;
  large?: boolean;
}) {
  let platform: string | null = null;
  if (href) {
    try {
      const host = new URL(href).hostname.toLowerCase();
      if (host.endsWith('sharepoint.com')) platform = 'SharePoint';
      else if (host.includes('stream')) platform = 'Stream';
    } catch { /* URL invalide : mention générique */ }
  }

  const content = (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-surface-container bg-surface-container-high">
      {poster ? (
        <img src={poster} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary via-primary-container to-secondary text-on-primary">
          <span className="material-symbols-outlined text-[52px] opacity-80">videocam</span>
        </div>
      )}
      <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/10 transition-colors group-hover:from-black/50" />
      <span
        className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-black/75 text-white shadow-lg backdrop-blur-sm transition-colors group-hover:bg-black/90 ${
          large ? 'px-5 py-3' : 'px-3.5 py-2'
        }`}
      >
        <span className={`material-symbols-outlined ${large ? 'text-[24px]' : 'text-[20px]'}`}>open_in_new</span>
        <span className={`font-headline whitespace-nowrap ${large ? 'text-label-lg' : 'text-label-md'}`}>Ouvrir la vidéo</span>
      </span>
      <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 font-body text-[11px] text-white">
        <span className="material-symbols-outlined text-[13px]">open_in_new</span>
        <span>{platform ? `Nouvel onglet · ${platform}` : 'Nouvel onglet'}</span>
      </span>
    </div>
  );

  if (!href) return <div className={className}>{content}</div>;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={onClick}
      title="Ouvrir la vidéo dans un nouvel onglet"
      aria-label="Ouvrir la vidéo dans un nouvel onglet"
      className={`group block shrink-0 no-underline ${className}`}
    >
      {content}
    </a>
  );
}
