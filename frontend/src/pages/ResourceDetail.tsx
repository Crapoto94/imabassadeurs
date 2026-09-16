import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText, ExternalLink, Check, X } from 'lucide-react';
import { Card, PageTitle, Spinner, Alert, Badge, Button, Textarea } from '../components/ui';
import StarRating from '../components/StarRating';
import AiPanel from '../components/AiPanel';
import CommentThread from '../components/CommentThread';
import { getResource, rateResource, reviewResource, synthResource, synthResourceThread } from '../api/endpoints';
import { API_URL, errMsg } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import type { Resource } from '../types';

export default function ResourceDetail() {
  const { id } = useParams();
  const rid = Number(id);
  const { canInteract, isIanimateur } = useAuth();
  const [r, setR] = useState<Resource | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  async function load() {
    try { setR(await getResource(rid)); } catch (e) { setError(errMsg(e)); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [rid]);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!r) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <div>
      <Link to="/ressources" className="mb-4 inline-flex items-center gap-1 text-sm text-ville-600 hover:underline"><ArrowLeft size={16} /> Retour</Link>
      <PageTitle
        title={r.title}
        subtitle={`Proposé par ${r.proposed_by_name} le ${new Date(r.created_at).toLocaleDateString('fr-FR')}`}
        action={<Badge color={r.status === 'published' ? 'green' : r.status === 'pending' ? 'amber' : 'red'}>{r.status}</Badge>}
      />

      <Card className="mb-6 space-y-4 p-5">
        <p className="whitespace-pre-wrap text-slate-700">{r.description}</p>
        {r.kind === 'pdf' && r.file_path && (
          <a href={`${API_URL}/uploads/${r.file_path}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-ville-600 hover:underline">
            <FileText size={16} /> Ouvrir le document PDF
          </a>
        )}
        {r.kind === 'link' && r.url && (
          <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-ville-600 hover:underline">
            <ExternalLink size={16} /> {r.url}
          </a>
        )}
        <div className="flex items-center gap-4 border-t border-slate-100 pt-4">
          <div>
            <div className="text-sm font-medium text-slate-700">Note moyenne : {r.avg_stars ?? '—'} / 4</div>
            {canInteract && (
              <div className="mt-1">
                <StarRating value={r.my_rating || 0} onRate={async (v) => { await rateResource(rid, v); load(); }} />
                <span className="text-xs text-slate-500">Votre note : {r.my_rating || '—'}</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {isIanimateur && r.status === 'pending' && (
        <Card className="mb-6 p-5">
          <h3 className="mb-2 font-semibold">Modération (IAnimateur)</h3>
          <Textarea rows={2} placeholder="Motif (optionnel)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="mt-2 flex gap-2">
            <Button onClick={async () => { await reviewResource(rid, 'published', note); load(); }}><Check size={16} /> Publier</Button>
            <Button variant="danger" onClick={async () => { await reviewResource(rid, 'rejected', note); load(); }}><X size={16} /> Rejeter</Button>
          </div>
        </Card>
      )}

      <div className="mb-6 grid gap-4">
        <AiPanel label="Synthétiser ce document" run={() => synthResource(rid)} />
        <AiPanel label="Synthétiser la discussion" run={() => synthResourceThread(rid)} />
      </div>

      <CommentThread entityType="resource" entityId={rid} />
    </div>
  );
}
