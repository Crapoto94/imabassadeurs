// Notation 1-4 étoiles (thème Stitch). `onRate` absent => lecture seule.
export default function StarRating({ value, onRate, max = 4, size = 20 }: { value: number; onRate?: (v: number) => void; max?: number; size?: number }) {
  return (
    <div className="flex items-center gap-1 text-secondary" role={onRate ? 'radiogroup' : undefined} aria-label={`Note ${value} sur ${max}`}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onRate}
          onClick={() => onRate?.(n)}
          aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
          className={onRate ? 'cursor-pointer transition-transform hover:scale-125' : 'cursor-default'}
        >
          <span
            className={`material-symbols-outlined ${n <= value ? 'filled' : 'text-outline-variant'}`}
            style={{ fontSize: size }}
          >
            star
          </span>
        </button>
      ))}
    </div>
  );
}
