import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Users, UserPlus, UserMinus } from 'lucide-react';
import { Card, PageTitle, Spinner, Alert, Badge, Button, Select } from '../components/ui';
import AiPanel from '../components/AiPanel';
import CommentThread from '../components/CommentThread';
import { getExperiment, joinExperiment, synthExperiment, updateExperimentStatus } from '../api/endpoints';
import { errMsg } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import type { Experiment } from '../types';

const STATUS: Record<string, { label: string; color: string }> = {
  planned: { label: 'Planifiée', color: 'blue' },
  ongoing: { label: 'En cours', color: 'amber' },
  completed: { label: 'Terminée', color: 'green' },
  abandoned: { label: 'Abandonnée', color: 'red' },
};

export default function ExperimentDetail() {
  const { id } = useParams();
  const eid = Number(id);
  const { user, canInteract, isIanimateur } = useAuth();
  const [e, setE] = useState<Experiment | null>(null);
  const [error, setError] = useState('');

  async function load() { try { setE(await getExperiment(eid)); } catch (err) { setError(errMsg(err)); } }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [eid]);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!e) return <div className="flex justify-center py-12"><Spinner /></div>;

  const canEdit = isIanimateur || e.created_by === user?.id;

  return (
    <div>
      <Link to="/experimentations" className="mb-4 inline-flex items-center gap-1 text-sm text-ville-600 hover:underline"><ArrowLeft size={16} /> Retour</Link>
      <PageTitle title={e.title} subtitle={`Créée par ${e.created_by_name}`} action={<Badge color={STATUS[e.status].color}>{STATUS[e.status].label}</Badge>} />

      <Card className="mb-6 space-y-4 p-5">
        <div><div className="text-sm font-medium text-slate-500">Quoi</div><p className="whitespace-pre-wrap text-slate-800">{e.description}</p></div>
        <div><div className="text-sm font-medium text-slate-500">Pourquoi</div><p className="whitespace-pre-wrap text-slate-800">{e.objective}</p></div>
        {e.target_date && <div className="text-sm text-slate-600">Pour quand : {new Date(e.target_date).toLocaleDateString('fr-FR')}</div>}
        <div>
          <div className="mb-1 flex items-center gap-1 text-sm font-medium text-slate-500"><Users size={15} /> Participants ({e.participants?.length || 0})</div>
          <div className="flex flex-wrap gap-2">{(e.participants || []).map((p) => <Badge key={p.id} color="blue">{p.display_name}</Badge>)}</div>
        </div>
        {canInteract && (
          <Button variant={e.joined ? 'secondary' : 'primary'} onClick={async () => { await joinExperiment(eid); load(); }}>
            {e.joined ? <><UserMinus size={16} /> Me retirer</> : <><UserPlus size={16} /> Rejoindre</>}
          </Button>
        )}
        {canEdit && (
          <div className="max-w-xs">
            <label className="mb-1 block text-sm font-medium text-slate-700">Changer le statut</label>
            <Select value={e.status} onChange={async (ev) => { await updateExperimentStatus(eid, ev.target.value); load(); }}>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </div>
        )}
      </Card>

      <div className="mb-6"><AiPanel label="Synthétiser l’expérimentation" run={() => synthExperiment(eid)} /></div>
      <CommentThread entityType="experiment" entityId={eid} />
    </div>
  );
}
