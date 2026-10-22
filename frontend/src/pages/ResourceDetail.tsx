import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, ExternalLink, Flag, Pencil, Trash2, Save } from 'lucide-react';
import { Card, PageTitle, Spinner, Alert, Button, Textarea, Input, Field, Select } from '../components/ui';
import StarRating from '../components/StarRating';
import AiPanel from '../components/AiPanel';
import CommentThread from '../components/CommentThread';
import VideoEmbed, { detectVideo } from '../components/VideoEmbed';
import PdfEmbed from '../components/PdfEmbed';
import { deleteResource, getResource, getThemes, rateResource, setResourceMandatory, synthResource, synthResourceThread, updateResource, completeResource } from '../api/endpoints';
import { API_URL, errMsg } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useGamification } from '../hooks/useGamification';
import { EditedAt, LevelBadge, MandatoryBadge, LEVELS, LEVEL_META } from '../components/stitch';
import { ThemePicker, ThemeChips } from '../components/Themes';
import type { Resource, Theme } from '../types';

export default function ResourceDetail() {
  const { id } = useParams();
  const rid = Number(id);
  const navigate = useNavigate();
  const { canInteract, isIanimateur, isAdmin, user } = useAuth();
  const { refresh } = useGamification();
  const [r, setR] = useState<Resource | null>(null);
  const [allThemes, setAllThemes] = useState<Theme[]>([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', url: '', level: 'debutant', theme_ids: [] as number[] });

  useEffect(() => { getThemes({ scope: 'resource' }).then(setAllThemes).catch(() => {}); }, []);

  async function load() {
    try {
      const data = await getResource(rid);
      setR(data);
      setForm({
        title: data.title,
        description: data.description,
        url: data.url || '',
        level: data.level || 'debutant',
        theme_ids: (data.themes || []).map((t) => t.id),
      });
    } catch (e) { setError(errMsg(e)); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [rid]);

  async function markRead() {
    if ((r?.my_progress ?? 0) >= 100) return;
    try { await completeResource(rid); await refresh(); load(); } catch { /* silencieux */ }
  }

  // Auto-marquage : l'ouverture d'un PDF vaut consultation (Phase 1).
  useEffect(() => {
    if (r?.kind === 'pdf' && r.file_path && (r.my_progress ?? 0) < 100) markRead();
    /* eslint-disable-next-line */
  }, [r?.id]);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!r) return <div className="flex justify-center py-12"><Spinner /></div>;

  const peutEditer = isAdmin || isIanimateur || r.proposed_by === user?.id;
  const peutSupprimer = isAdmin || isIanimateur;
  const isMandatory = Boolean(r.is_mandatory);

  async function save() {
    try { await updateResource(rid, form); setEditing(false); load(); }
    catch (e) { setError(errMsg(e)); }
  }
  async function remove() {
    if (!window.confirm('Supprimer définitivement cette ressource et sa discussion ?')) return;
    try { await deleteResource(rid); navigate('/ressources'); }
    catch (e) { setError(errMsg(e)); }
  }
  async function toggleMandatory() {
    try { await setResourceMandatory(rid, !isMandatory); load(); }
    catch (e) { setError(errMsg(e)); }
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 lg:px-8 py-8">
      <Link to="/ressources" className="mb-4 inline-flex items-center gap-1 text-sm text-ville-600 hover:underline"><ArrowLeft size={16} /> Retour</Link>
      <PageTitle
        title={r.title}
        subtitle={`Proposé par ${r.proposed_by_name} le ${new Date(r.created_at).toLocaleDateString('fr-FR')}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <Button variant={r.is_mandatory ? 'secondary' : 'danger'} onClick={toggleMandatory}>
                <Flag size={16} /> {r.is_mandatory ? 'Retirer du parcours obligatoire' : 'Ajouter au parcours obligatoire'}
              </Button>
            )}
            {peutEditer && !editing && <Button variant="secondary" onClick={() => setEditing(true)}><Pencil size={16} /> Éditer</Button>}
            {peutSupprimer && <Button variant="danger" onClick={remove}><Trash2 size={16} /> Supprimer</Button>}
          </div>
        }
      />

      {editing ? (
        <Card className="mb-6 space-y-3 p-5">
          <Field label="Titre"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Description"><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          {r.kind === 'link' && <Field label="URL"><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></Field>}
          <Field label="Niveau de lecture">
            <Select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
              {LEVELS.map((k) => <option key={k} value={k}>{LEVEL_META[k].label}</option>)}
            </Select>
          </Field>
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
          <div className="flex flex-wrap items-center gap-2">
            <LevelBadge level={r.level} />
            {r.is_mandatory && <MandatoryBadge />}
          </div>
          <ThemeChips themes={r.themes} />
          <p className="whitespace-pre-wrap text-slate-700">{r.description}</p>
          {r.kind === 'link' && r.url && detectVideo(r.url) && <VideoEmbed url={r.url} />}
          {r.kind === 'pdf' && r.file_path && <PdfEmbed src={`${API_URL}/uploads/${r.file_path}`} />}
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <EditedAt editedAt={r.edited_at} />
          </div>
          {r.kind === 'pdf' && r.file_path && (
            <a href={`${API_URL}/uploads/${r.file_path}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-ville-600 hover:underline">
              <FileText size={16} /> Ouvrir le document PDF
            </a>
          )}
          {r.kind === 'link' && r.url && (
            <a href={r.url} target="_blank" rel="noreferrer" onClick={markRead} className="inline-flex items-center gap-2 text-sm text-ville-600 hover:underline">
              <ExternalLink size={16} /> {r.url}
            </a>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {(r.my_progress ?? 0) >= 100 ? (
              <span className="inline-flex items-center gap-1.5 text-sm text-tertiary">
                <span className="material-symbols-outlined text-[18px]">check_circle</span> Consulté
              </span>
            ) : (
              <Button variant="secondary" onClick={markRead}>
                <span className="material-symbols-outlined text-[16px]">check_circle</span> Marquer comme lu
              </Button>
            )}
            {r.is_mandatory && <span className="text-xs text-outline">Ressource du parcours obligatoire</span>}
          </div>
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
      )}

      <div className="mb-6 grid gap-4">
        <AiPanel label="Synthétiser ce document" run={() => synthResource(rid)} />
        <AiPanel label="Synthétiser la discussion" run={() => synthResourceThread(rid)} />
      </div>

      <CommentThread entityType="resource" entityId={rid} />
    </div>
  );
}
