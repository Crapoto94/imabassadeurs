import { Button } from './ui';

export default function Pagination({
  offset, limit, count, onChange,
}: { offset: number; limit: number; count: number; onChange: (offset: number) => void }) {
  const page = Math.floor(offset / limit) + 1;
  const hasNext = count === limit;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
      <Button variant="secondary" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>Précédent</Button>
      <span>Page {page}</span>
      <Button variant="secondary" disabled={!hasNext} onClick={() => onChange(offset + limit)}>Suivant</Button>
    </div>
  );
}
