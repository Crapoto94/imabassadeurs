export default function PdfEmbed({ src, height = 560, className = '' }: { src: string; height?: number; className?: string }) {
  return (
    <div className={`w-full overflow-hidden rounded-xl border border-surface-container bg-surface-container-low ${className}`}>
      <iframe
        src={src}
        className="w-full"
        style={{ height }}
        title="Aperçu du document PDF"
      />
    </div>
  );
}
