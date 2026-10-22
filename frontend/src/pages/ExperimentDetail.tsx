import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, UserPlus, UserMinus, Pencil, Trash2, Save, FileText, Upload, Paperclip } from 'lucide-react';
import { Card, PageTitle, Spinner, Alert, Badge, Button, Select, Input, Textarea, Field } from '../components/ui';
import AiPanel from '../components/AiPanel';
import CommentThread from '../components/CommentThread';
import { deleteExperiment, getExperiment, getThemes, joinExperiment, synthExperiment, updateExperiment, updateExperimentStatus, addExperimentAttachment, deleteExperimentAttachment } from '../api/endpoints';
import { API_URL, errMsg } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { EditedAt } from '../components/stitch';
import { ThemePicker, ThemeChips } from '../components/Themes';
import type { Experiment, Theme } from '../types';

const STATUS: Record<string, { label: string; color: string }> = {
  planned: { label: 'Planifiée', color: 'blue' },
  ongoing: { label: 'En cours', color: 'amber' },
  completed: { label: 'Terminée', color: 'green' },
  abandoned: { label: 'Abandonnée', color: 'red' },
};

function fmtSize(bytes?: number | null): string {
  if (!bytes) return '';
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} Mo` : `${Math.round(bytes / 1024)} Ko`;
}

export default function ExperimentDetail() {
  const { id } = useParams();
  const eid = Number(id);
  const navigate = useNavigate();
  const { user, canInteract, isIanimateur } = useAuth();
  const [e, setE] = useState<Experiment | null>(null);
  const [allThemes, setAllThemes] = useState<Theme[]>([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState('');
  const [form, setForm] = useState({ title: '', description: '', objective: '', target_date: '', status: 'planned', theme_ids: [] as number[] });

  useEffect(() => { getThemes({ scope: 'experiment' }).then(setAllThemes).catch(() => {}); }, []);

  async function load() {
    try {
      const data = await getExperiment(eid);
      setE(data);
      setForm({ title: data.title, description: data.description, objective: data.objective, target_date: data.target_date || '', status: data.status, theme_ids: (data.themes || []).map((t) => t.id) });
    } catch (err) { setError(errMsg(err)); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [eid]);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!e) return <div className="flex justify-center py-12"><Spinner /></div>;

  const canEdit = isIanimateur || e.created_by === user?.id;

  async function save() {
    try { await updateExperiment(eid, { ...form, target_date: form.target_date || null }); setEditing(false); load(); }
    catch (err) { setError(errMsg(err)); }
  }
  async function remove() {
    if (!window.confirm('Supprimer définitivement cette expérimentation et sa discussion ?')) return;
    try { await deleteExperiment(eid); navigate('/experimentations'); }
    catch (err) { setError(errMsg(err)); }
  }
  async function uploadAttachment(file: File) {
    setFileError(''); setUploading(true);
    try { await addExperimentAttachment(eid, file); await load(); }
    catch (err) { setFileError(errMsg(err)); } finally { setUploading(false); }
  }
  async function removeAttachment(attachmentId: number) {
    if (!window.confirm('Supprimer ce document joint ?')) return;
    try { await deleteExperimentAttachment(eid, attachmentId); await load(); }
    catch (err) { setFileError(errMsg(err)); }
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 lg:px-8 py-8">
      <Link to="/experimentations" className="mb-4 inline-flex items-center gap-1 text-sm text-ville-600 hover:underline"><ArrowLeft size={16} /> Retour</Link>
      <PageTitle title={e.title} subtitle={`Créée par ${e.created_by_name}`}
        action={
          <div className="flex items-center gap-2">
            <Badge color={STATUS[e.status].color}>{STATUS[e.status].label}</Badge>
            {canEdit && !editing && <Button variant="secondary" onClick={() => setEditing(true)}><Pencil size={16} /> Éditer</Button>}
            {canEdit && <Button variant="danger" onClick={remove}><Trash2 size={16} /> Supprimer</Button>}
          </div>
        } />

      {editing ? (
        <Card className="mb-6 space-y-3 p-5">
          <Field label="Titre"><Input value={form.title} onChange={(ev) => setForm({ ...form, title: ev.target.value })} /></Field>
          <Field label="Quoi ?"><Textarea rows={3} value={form.description} onChange={(ev) => setForm({ ...form, description: ev.target.value })} /></Field>
          <Field label="Pourquoi ?"><Textarea rows={3} value={form.objective} onChange={(ev) => setForm({ ...form, objective: ev.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Pour quand ?"><Input type="date" value={form.target_date || ''} onChange={(ev) => setForm({ ...form, target_date: ev.target.value })} /></Field>
            <Field label="Statut">
              <Select value={form.status} onChange={(ev) => setForm({ ...form, status: ev.target.value })}>
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Thèmes">
            <ThemePicker themes={allThemes} value={form.theme_ids} onChange={(ids) => setForm({ ...form, theme_ids: ids })} />
          </Field>
          <div className="flex gap-2">
            <Button onClick={save}><Save size={16} /> Enregistrer</Button>
            <Button variant="secondary" onClick={() => setEditing(false)}>Annuler</Button>
          </div>
        </Card>
      ) : (
        <Card className="mb-6 space-y-4 p-5">
          <ThemeChips themes={e.themes} />
          <div><div className="text-sm font-medium text-slate-500">Quoi</div><p className="whitespace-pre-wrap text-slate-800">{e.description}</p></div>
          <div><div className="text-sm font-medium text-slate-500">Pourquoi</div><p className="whitespace-pre-wrap text-slate-800">{e.objective}</p></div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <EditedAt editedAt={e.edited_at} />
          </div>
          {e.target_date && <div className="text-sm text-slate-600">Pour quand : {new Date(e.target_date).toLocaleDateString('fr-FR')}</div>}
          <div>
            <div className="mb-1 flex items-center gap-1 text-sm font-medium text-slate-500"><Users size={15} /> Participants ({e.participants?.length || 0})</div>
            <div className="flex flex-wrap gap-2">{(e.participants || []).map((p) => <Badge key={p.id} color="blue">{p.display_name}</Badge>)}</div>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1 text-sm font-medium text-slate-500"><Paperclip size={15} /> Documents joints ({e.attachments?.length || 0})</div>
            {(e.attachments || []).length > 0 && (
              <ul className="mb-2 space-y-1">
                {(e.attachments || []).map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5">
                    <a href={`${API_URL}/uploads/${a.file_path}`} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-2 text-sm text-ville-600 hover:underline">
                      <FileText size={15} className="shrink-0" />
                      <span className="truncate">{a.original_name}</span>
                    </a>
                    <div className="flex shrink-0 items-center gap-2">
                      {a.size_bytes ? <span className="text-xs text-slate-400">{fmtSize(a.size_bytes)}</span> : null}
                      {canEdit && (
                        <button type="button" onClick={() => removeAttachment(a.id)} className="text-slate-400 hover:text-red-600" title="Supprimer" aria-label="Supprimer le document">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {canEdit && (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200">
                <Upload size={15} />
                <span>{uploading ? 'Envoi…' : 'Joindre un document (10 Mo max)'}</span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.odt,.ppt,.pptx,.odp,.xls,.xlsx,.ods,.rtf,.txt,.csv"
                  className="hidden" disabled={uploading}
                  onChange={(ev) => { const f = ev.target.files?.[0]; if (f) uploadAttachment(f); ev.target.value = ''; }}
                />
              </label>
            )}
            {fileError && <p className="mt-1 text-xs text-red-600">{fileError}</p>}
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
      )}

      <div className="mb-6"><AiPanel label="Synthétiser l’expérimentation" run={() => synthExperiment(eid)} /></div>
      <CommentThread entityType="experiment" entityId={eid} />
    </div>
  );
}
