import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from './stitch';

const VIEW = 260; // taille d'affichage (px)
const OUT = 256; // taille de l'image envoyée (px)

// Recadrage de la photo de profil : glisser pour recentrer, curseur pour zoomer.
// L'image est réduite à 256 × 256 (JPEG) : quelle que soit la taille d'origine, l'envoi reste léger.
export default function AvatarCropper({ file, onCancel, onConfirm }: {
  file: File | null; onCancel: () => void; onConfirm: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bmp, setBmp] = useState<ImageBitmap | null>(null);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 }); // coin haut-gauche de l'image dans la vue
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  const base = bmp ? Math.max(VIEW / bmp.width, VIEW / bmp.height) : 1; // « cover »
  const scale = base * zoom;

  const clamp = useCallback((x: number, y: number, s: number) => {
    if (!bmp) return { x, y };
    return {
      x: Math.min(0, Math.max(VIEW - bmp.width * s, x)),
      y: Math.min(0, Math.max(VIEW - bmp.height * s, y)),
    };
  }, [bmp]);

  // Chargement (l'orientation EXIF des photos de téléphone est respectée).
  useEffect(() => {
    setBmp(null); setError(''); setZoom(1);
    if (!file) return;
    let alive = true;
    createImageBitmap(file, { imageOrientation: 'from-image' }).then((b) => {
      if (!alive) return;
      const s = Math.max(VIEW / b.width, VIEW / b.height);
      setBmp(b);
      setPos({ x: (VIEW - b.width * s) / 2, y: (VIEW - b.height * s) / 2 });
    }).catch(() => alive && setError("Impossible de lire cette image (formats acceptés : JPEG, PNG, WebP)."));
    return () => { alive = false; };
  }, [file]);

  function draw(ctx: CanvasRenderingContext2D, size: number) {
    if (!bmp) return;
    const k = size / VIEW;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, pos.x * k, pos.y * k, bmp.width * scale * k, bmp.height * scale * k);
  }

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) draw(ctx, VIEW);
  });

  function changeZoom(z: number) {
    if (!bmp) return;
    const nz = Math.min(4, Math.max(1, z));
    const ns = base * nz;
    // Garde le point central de la vue fixe pendant le zoom.
    const cx = (VIEW / 2 - pos.x) / scale;
    const cy = (VIEW / 2 - pos.y) / scale;
    setZoom(nz);
    setPos(clamp(VIEW / 2 - cx * ns, VIEW / 2 - cy * ns, ns));
  }

  function confirm() {
    const out = document.createElement('canvas');
    out.width = out.height = OUT;
    draw(out.getContext('2d')!, OUT);
    onConfirm(out.toDataURL('image/jpeg', 0.85));
  }

  return (
    <Modal open={!!file} onClose={onCancel} title="Ajuster ma photo" icon="photo_camera">
      {error ? (
        <p className="font-body text-body-md text-error">{error}</p>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="relative rounded-full overflow-hidden shadow-card touch-none select-none cursor-grab active:cursor-grabbing"
            style={{ width: VIEW, height: VIEW }}>
            <canvas
              ref={canvasRef} width={VIEW} height={VIEW}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = { px: e.clientX, py: e.clientY, ox: pos.x, oy: pos.y };
              }}
              onPointerMove={(e) => {
                const d = drag.current;
                if (d) setPos(clamp(d.ox + e.clientX - d.px, d.oy + e.clientY - d.py, scale));
              }}
              onPointerUp={() => { drag.current = null; }}
              onPointerCancel={() => { drag.current = null; }}
              onWheel={(e) => changeZoom(zoom - e.deltaY * 0.002)}
            />
          </div>
          <p className="font-body text-body-sm text-on-surface-variant">Glissez pour recentrer, utilisez le curseur pour zoomer.</p>
          <div className="flex w-full max-w-xs items-center gap-3">
            <span className="material-symbols-outlined text-[18px] text-outline">zoom_out</span>
            <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => changeZoom(Number(e.target.value))}
              className="w-full accent-[#0055a4]" aria-label="Zoom" />
            <span className="material-symbols-outlined text-[18px] text-outline">zoom_in</span>
          </div>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 font-headline text-label-md text-on-surface-variant hover:bg-surface-container">
          Annuler
        </button>
        {!error && (
          <button type="button" disabled={!bmp} onClick={confirm}
            className="rounded-full bg-secondary px-5 py-2 font-headline text-label-md text-on-secondary disabled:opacity-50">
            Valider
          </button>
        )}
      </div>
    </Modal>
  );
}
