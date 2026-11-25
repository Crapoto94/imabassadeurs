import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, ExternalLink, Flag, Pencil, Trash2, Save, X } from 'lucide-react';
import { Card, PageTitle, Spinner, Alert, Button, Textarea, Input, Field, Select } from '../components/ui';
import StarRating from '../components/StarRating';
import AiPanel from '../components/AiPanel';
import CommentThread from '../components/CommentThread';
import VideoEmbed, { detectVideo } from '../components/VideoEmbed';
import VideoThumb from '../components/VideoThumb';
import PdfEmbed from '../components/PdfEmbed';
import { deleteResource, getExperiments, getResource, getRisks, getThemes, rateResource, setResourceMandatory, synthResource, synthResourceThread, updateResource, completeResource } from '../api/endpoints';
import { API_URL, errMsg } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useGamification } from '../hooks/useGamification';
import { EditedAt, LevelBadge, MandatoryBadge, LEVELS, LEVEL_META } from '../components/stitch';
import { ThemePicker, ThemeChips } from '../components/Themes';
import type { Resource, Theme } from '../types';

const fmtSize = (bytes: number) => bytes >= 1024 * 1024
  ? `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`
  : `${Math.max(1, Math.round(bytes / 1024))} Ko`;

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
  const [form, setForm] = useState({
    title: '', description: '', url: '', level: 'debutant', theme_ids: [] as number[],
    source: '', published_at: '', content_type: '', reading_effort: '', related_value: '',
  });
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newThumbnail, setNewThumbnail] = useState<File | null>(null);
  const [experiments, setExperiments] = useState<any[]>([]);
  const [risks, setRisks] = useState<any[]>([]);

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
        source: data.source || '',
        published_at: data.published_at || '',
        content_type: data.content_type || '',
        reading_effort: data.reading_effort || '',
        related_value: data.related_type && data.related_id ? `${data.related_type}:${data.related_id}` : '',
      });
      setNewFile(null);
      setNewThumbnail(null);
    } catch (e) { setError(errMsg(e)); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [rid]);

  async function markRead() {
    if ((r?.my_progress ?? 0) >= 100) return;
    try { await completeResource(rid); await refresh(); load(); } catch { /* silencieux */ }
  }

  // Auto-marquage : l'ouverture d'un PDF ou d'un aperçu de présentation vaut consultation.
  useEffect(() => {
    const consultable = (r?.kind === 'pdf' && r.file_path) || (r?.kind === 'presentation' && r.preview_path);
    if (consultable && (r.my_progress ?? 0) < 100) markRead();
    /* eslint-disable-next-line */
  }, [r?.id]);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!r) return <div className="flex justify-center py-12"><Spinner /></div>;

  const peutEditer = isAdmin || isIanimateur || r.proposed_by === user?.id;
  const peutSupprimer = isAdmin || isIanimateur;
  const isMandatory = Boolean(r.is_mandatory);

  async function save() {
    const fd = new FormData();
    fd.append('title', form.title);
    fd.append('description', form.description);
    fd.append('level', form.level);
    fd.append('theme_ids', JSON.stringify(form.theme_ids));
    fd.append('source', form.source);
    fd.append('published_at', form.published_at);
    fd.append('content_type', form.content_type);
    fd.append('reading_effort', form.reading_effort);
    const [rt, ridVal] = (form.related_value || '').split(':');
    fd.append('related_type', rt || '');
    fd.append('related_id', ridVal || '');
    if (r?.kind === 'link' || r?.kind === 'video') fd.append('url', form.url);
    if (newFile) fd.append('file', newFile);
    if (newThumbnail) fd.append('thumbnail', newThumbnail);
    try { await updateResource(rid, fd); setEditing(false); load(); }
    catch (e) { setError(errMsg(e)); }
  }
  function startEdit() {
    setEditing(true);
    getExperiments().then(setExperiments).catch(() => {});
    getRisks().then(setRisks).catch(() => {});
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
            {peutEditer && !editing && <Button variant="secondary" onClick={startEdit}><Pencil size={16} /> Éditer</Button>}
            {peutSupprimer && <Button variant="danger" onClick={remove}><Trash2 size={16} /> Supprimer</Button>}
          </div>
        }
      />

      {editing ? (
        <Card className="mb-6 space-y-3 p-5">
          <Field label="Titre *"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Description *"><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          {(r.kind === 'link' || r.kind === 'video') && <Field label="URL *"><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></Field>}
          <Field label="Niveau de lecture">
            <Select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
              {LEVELS.map((k) => <option key={k} value={k}>{LEVEL_META[k].label}</option>)}
            </Select>
          </Field>
          <Field label="Thèmes">
            <ThemePicker themes={allThemes} value={form.theme_ids} onChange={(ids) => setForm({ ...form, theme_ids: ids })} />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Source / auteur-éditeur">
              <Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Ex : CNIL, INRIA, ministère…" />
            </Field>
            <Field label="Date de publication de la source">
              <Input type="date" value={form.published_at} onChange={(e) => setForm({ ...form, published_at: e.target.value })} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Sous-type de contenu">
              <Select value={form.content_type} onChange={(e) => setForm({ ...form, content_type: e.target.value })}>
                <option value="">Non précisé</option>
                <option value="article">Article</option>
                <option value="rapport">Rapport / étude</option>
                <option value="video">Vidéo</option>
                <option value="mooc">MOOC / formation</option>
                <option value="jurisprudence">Jurisprudence / texte officiel</option>
                <option value="presentation">Présentation / diaporama</option>
                <option value="autre">Autre</option>
              </Select>
            </Field>
            <Field label="Durée / effort de lecture">
              <Select value={form.reading_effort} onChange={(e) => setForm({ ...form, reading_effort: e.target.value })}>
                <option value="">Non précisé</option>
                <option value="court">Rapide (moins de 15 min)</option>
                <option value="moyen">Moyen (15 à 45 min)</option>
                <option value="long">Long (plus de 45 min)</option>
              </Select>
            </Field>
          </div>
          <Field label="Entité liée">
            <Select value={form.related_value} onChange={(e) => setForm({ ...form, related_value: e.target.value })}>
              <option value="">Aucune</option>
              {experiments.length > 0 && (
                <optgroup label="Expérimentations">
                  {experiments.map((x) => <option key={`e${x.id}`} value={`experiment:${x.id}`}>{x.title}</option>)}
                </optgroup>
              )}
              {risks.length > 0 && (
                <optgroup label="Risques">
                  {risks.map((x) => <option key={`r${x.id}`} value={`risk:${x.id}`}>{x.title}</option>)}
                </optgroup>
              )}
            </Select>
          </Field>

          {(r.kind === 'pdf' || r.kind === 'presentation') && (
            <Field label={r.kind === 'pdf' ? 'Remplacer le fichier PDF' : 'Remplacer la présentation (.pptx, .ppt ou .odp)'}>
              <Input type="file" accept={r.kind === 'pdf' ? 'application/pdf' : '.pptx,.ppt,.odp'} onChange={(e) => setNewFile(e.target.files?.[0] || null)} />
            </Field>
          )}
          {r.kind === 'video' && (
            <Field label="Remplacer la miniature (JPG, PNG ou WebP, 2 Mo max)">
              <Input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={(e) => setNewThumbnail(e.target.files?.[0] || null)} />
            </Field>
          )}

          <div className="flex gap-2">
            <Button onClick={save}><Save size={16} /> Enregistrer</Button>
            <Button variant="secondary" onClick={() => { setEditing(false); setNewFile(null); setNewThumbnail(null); }}><X size={16} /> Annuler</Button>
          </div>
        </Card>
      ) : (
        <Card className="mb-6 space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <LevelBadge level={r.level} />
            {(r.kind === 'presentation' || r.content_type === 'presentation') && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2.5 py-0.5 font-headline text-label-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-[14px] text-tertiary">co_present</span>
                Présentation
              </span>
            )}
            {r.kind === 'video' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2.5 py-0.5 font-headline text-label-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-[14px] text-tertiary">play_circle</span>
                Vidéo
              </span>
            )}
            {r.is_mandatory && <MandatoryBadge />}
          </div>
          <ThemeChips themes={r.themes} />
          <p className="whitespace-pre-wrap text-slate-700">{r.description}</p>
          {r.kind === 'link' && r.url && detectVideo(r.url) && <VideoEmbed url={r.url} />}
          {r.kind === 'video' && (
            <VideoThumb
              poster={r.thumbnail_path ? `${API_URL}/uploads/${r.thumbnail_path}` : null}
              href={r.url}
              onClick={markRead}
              className="w-full max-w-3xl"
              large
            />
          )}
          {r.kind === 'pdf' && r.file_path && <PdfEmbed src={`${API_URL}/uploads/${r.file_path}`} />}
          {r.kind === 'presentation' && r.preview_path && (
            <PdfEmbed src={`${API_URL}/uploads/${r.preview_path}`} />
          )}
          {r.kind === 'presentation' && !r.preview_path && (
            <div className="flex items-start gap-3 rounded-xl border border-surface-container bg-surface-container-low p-4">
              <span className="material-symbols-outlined text-[28px] text-tertiary">co_present</span>
              <div>
                <p className="font-headline text-label-md text-on-surface">Aperçu non disponible pour ce format</p>
                <p className="font-body text-body-sm text-on-surface-variant">
                  Téléchargez la présentation pour la consulter dans PowerPoint ou LibreOffice.
                </p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <EditedAt editedAt={r.edited_at} />
          </div>
          {r.kind === 'pdf' && r.file_path && (
            <a href={`${API_URL}/uploads/${r.file_path}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-ville-600 hover:underline">
              <FileText size={16} /> Ouvrir le document PDF
            </a>
          )}
          {r.kind === 'presentation' && r.file_path && (
            <a
              href={`${API_URL}/uploads/${r.file_path}`}
              target="_blank"
              rel="noreferrer"
              download={r.original_name || true}
              onClick={markRead}
              className="inline-flex items-center gap-2 text-sm text-ville-600 hover:underline"
            >
              <FileText size={16} />
              Télécharger la présentation{r.original_name ? ` (${r.original_name}${r.size_bytes ? ` · ${fmtSize(r.size_bytes)}` : ''})` : ''}
            </a>
          )}
          {(r.kind === 'link' || r.kind === 'video') && r.url && (
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
