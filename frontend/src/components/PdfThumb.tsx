import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const RENDER_SCALE = 2; // netteté (retina)

// Miniature cliquable de la 1re page entière d'un PDF, rendue au ratio via pdf.js.
export default function PdfThumb({ src, to, width = 96, className = '' }: {
  src: string; to?: string; width?: number; className?: string;
}) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setImgSrc(null);
    (async () => {
      let loadingTask: pdfjsLib.PDFDocumentLoadingTask | undefined;
      try {
        const res = await fetch(src);
        if (!res.ok) return;
        const buffer = await res.arrayBuffer();
        loadingTask = pdfjsLib.getDocument({ data: buffer });
        const doc = await loadingTask.promise;
        const page = await doc.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const scale = (width * RENDER_SCALE) / base.width;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        if (!cancelled) setImgSrc(canvas.toDataURL('image/png'));
      } catch {
        // aperçu indisponible : on n'affiche rien
      } finally {
        await loadingTask?.destroy();
      }
    })();
    return () => { cancelled = true; };
  }, [src, width]);

  if (!imgSrc) return null;

  const img = (
    <img
      src={imgSrc}
      alt=""
      className={`block h-auto w-full rounded-lg border border-surface-container bg-white shadow-sm ${className}`}
      style={{ width }}
    />
  );

  return to ? <Link to={to} className="shrink-0 no-underline" aria-label="Voir la ressource">{img}</Link> : img;
}
