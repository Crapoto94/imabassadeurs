import { Star } from 'lucide-react';

// Notation 1-4 étoiles. `onRate` absent => lecture seule.
export default function StarRating({ value, onRate, max = 4, size = 18 }: { value: number; onRate?: (v: number) => void; max?: number; size?: number }) {
  return (
    <div className="flex items-center gap-1" role={onRate ? 'radiogroup' : undefined} aria-label={`Note ${value} sur ${max}`}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onRate}
          onClick={() => onRate?.(n)}
          aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
          className={onRate ? 'cursor-pointer' : 'cursor-default'}
        >
          <Star size={size} className={n <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} />
        </button>
      ))}
    </div>
  );
}
