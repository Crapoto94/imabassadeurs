import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Pagination from '../components/Pagination';
import CommentThread from '../components/CommentThread';
import AiPanel from '../components/AiPanel';
import StarRating from '../components/StarRating';
import { createResource, getResources, rateResource, synthResource, synthResourceThread } from '../api/endpoints';
import { errMsg, API_URL } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import {
  Avatar, Modal, PrimaryButton, SectionCard, StitchAlert, StitchEmpty, StitchField, StitchInput,
  StitchSpinner, StitchTextarea, timeAgo, useToast,
} from '../components/stitch';
import type { Resource } from '../types';

function ResourceCard({ res, onChanged }: { res: Resource; onChanged: () => void }) {
  const { canInteract } = useAuth();
  const { show, Toast } = useToast();
  const [forumOpen, setForumOpen] = useState(false);
  const [aiDoc, setAiDoc] = useState(false);
  const [aiThread, setAiThread] = useState(false);

  async function rate(stars: number) {
    await rateResource(res.id, stars);
    show(`Merci ! Votre note (${stars}/4) a été prise en compte.`);
    onChanged();
  }

  const downloadHref = res.kind === 'pdf' && res.file_path ? `${API_URL}/uploads/${res.file_path}` : res.url || undefined;

  return (
    <article className="bg-surface-container-lowest rounded-2xl p-6 shadow-card hover:shadow-card-hover transition-shadow flex flex-col gap-4">
      {Toast}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar name={res.proposed_by_name} size={44} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-headline text-headline-sm text-on-surface">{res.proposed_by_name}</span>
            </div>
            <p className="font-body text-body-sm text-on-surface-variant">Partagé {timeAgo(res.created_at)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-surface-container text-on-surface-variant rounded-lg font-headline text-label-sm shrink-0">
          <span className={`material-symbols-outlined text-[18px] ${res.kind === 'pdf' ? 'text-error' : 'text-secondary'}`}>
            {res.kind === 'pdf' ? 'picture_as_pdf' : 'open_in_new'}
          </span>
          <span>{res.kind === 'pdf' ? 'PDF' : 'Lien externe vérifié'}</span>
        </div>
      </div>

      <div>
        <h2 className="font-headline text-headline-md text-primary font-bold hover:text-secondary transition-colors">
          <Link to={`/ressources/${res.id}`}>{res.title}</Link>
        </h2>
        <p className="font-body text-body-md text-on-surface-variant mt-1.5 line-clamp-2">{res.description}</p>
      </div>

      <div className="bg-surface-container-low rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-headline text-label-md text-on-surface">Utilité perçue :</span>
          <StarRating value={Math.round(res.my_rating || res.avg_stars || 0)} onRate={canInteract ? rate : undefined} />
          <span className="font-headline text-headline-sm text-primary font-bold">
            {res.avg_stars ? `${Number(res.avg_stars).toFixed(1)} / 4` : '— / 4'}
          </span>
          <span className="font-body text-body-sm text-outline">({res.ratings_count} avis d'agents)</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/ressources/${res.id}`}
            className="px-2.5 py-1 bg-surface-container-lowest hover:bg-surface-container rounded-md font-headline text-label-sm text-on-surface-variant flex items-center gap-1 shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">visibility</span> Consulter
          </Link>
          {downloadHref && (
            <a
              className="px-3 py-1 bg-primary text-on-primary hover:bg-primary-container rounded-md font-headline text-label-sm flex items-center gap-1 shadow-sm transition-all"
              href={downloadHref} target="_blank" rel="noopener noreferrer"
            >
              <span className="material-symbols-outlined text-[16px]">{res.kind === 'pdf' ? 'download' : 'arrow_outward'}</span>
              {res.kind === 'pdf' ? 'Télécharger' : 'Ouvrir'}
            </a>
          )}
        </div>
      </div>

      <div className="bg-surface-variant/40 rounded-xl p-4 flex items-start gap-3">
        <span className="material-symbols-outlined text-secondary text-[22px] shrink-0 mt-0.5">verified_user</span>
        <div className="flex flex-col gap-0.5">
          <span className="font-headline text-label-md text-primary font-bold">Pourquoi ce document est clé pour Ivry-sur-Seine :</span>
          <p className="font-body text-body-sm text-on-surface-variant italic line-clamp-3">« {res.description} »</p>
        </div>
      </div>

      {canInteract && (
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-primary-container to-secondary text-on-primary rounded-full font-headline text-label-md shadow-sm hover:opacity-95 transition-all"
            onClick={() => { setAiDoc((v) => !v); setAiThread(false); }} type="button"
          >
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            <span>Synthétiser ce document par IA</span>
          </button>
          <button
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-surface-container hover:bg-surface-container-high text-primary rounded-full font-headline text-label-md transition-all"
            onClick={() => { setAiThread((v) => !v); setAiDoc(false); }} type="button"
          >
            <span className="material-symbols-outlined text-[18px]">psychology</span>
            <span>Synthétiser la discussion</span>
          </button>
          <button
            className="ml-auto flex items-center gap-1.5 px-3.5 py-1.5 bg-surface-container-low hover:bg-surface-container text-on-surface-variant rounded-full font-headline text-label-md transition-all"
            onClick={() => setForumOpen((v) => !v)} type="button"
          >
            <span className="material-symbols-outlined text-[18px]">chat_bubble_outline</span>
            <span>Mini-forum ({res.comments_count})</span>
          </button>
        </div>
      )}

      {aiDoc && (
        <AiPanel label="Synthèse certifiée par IA APM Ivry" run={() => synthResource(res.id)} />
      )}
      {aiThread && (
        <AiPanel label="Synthèse IA des retours de la communauté" run={() => synthResourceThread(res.id)} />
      )}
      {forumOpen && (
        <div className="pt-2 border-t border-surface-container-low">
          <CommentThread entityType="resource" entityId={res.id} />
        </div>
      )}
    </article>
  );
}

function CreateResourceModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { show, Toast } = useToast();
  const [kind, setKind] = useState<'pdf' | 'link'>('link');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setTitle(''); setDescription(''); setUrl(''); setFile(null); setError(''); setKind('link'); } }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const form = new FormData();
      form.append('title', title);
      form.append('description', description);
      form.append('kind', kind);
      if (kind === 'link') form.append('url', url);
      if (kind === 'pdf' && file) form.append('file', file);
      await createResource(form);
      onClose();
      show('Votre ressource a été soumise à la file de modération !');
      onDone();
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Proposer une nouvelle ressource" icon="post_add">
      {Toast}
      <p className="font-body text-body-sm text-on-surface-variant -mt-2">
        Partagez vos lectures et cas d'usage avec le réseau des IAmbassadeurs d'Ivry.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <StitchField label="Titre de la ressource *">
          <StitchInput value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Ex: Rapport sur la gouvernance éthique des algorithmes municipaux" />
        </StitchField>
        <StitchField label="Type de source">
          <div className="flex items-center gap-4 pt-1">
            <label className="flex items-center gap-1.5 font-body text-body-sm text-on-surface cursor-pointer">
              <input type="radio" name="kind" className="accent-secondary" checked={kind === 'pdf'} onChange={() => setKind('pdf')} />
              <span>Fichier PDF</span>
            </label>
            <label className="flex items-center gap-1.5 font-body text-body-sm text-on-surface cursor-pointer">
              <input type="radio" name="kind" className="accent-secondary" checked={kind === 'link'} onChange={() => setKind('link')} />
              <span>Lien URL externe</span>
            </label>
          </div>
        </StitchField>
        {kind === 'pdf' ? (
          <StitchField label="Fichier du document (PDF, 5 Mo max)">
            <label className="bg-surface-container-low hover:bg-surface-container rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all">
              <span className="material-symbols-outlined text-[36px] text-secondary mb-1">upload_file</span>
              <span className="font-headline text-label-md text-primary font-bold">{file ? file.name : 'Cliquez pour choisir votre PDF'}</span>
              <input type="file" accept="application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} required={!file} />
            </label>
          </StitchField>
        ) : (
          <StitchField label="Adresse URL du document *">
            <StitchInput type="url" value={url} onChange={(e) => setUrl(e.target.value)} required placeholder="https://…" />
          </StitchField>
        )}
        <div className="bg-surface-variant/30 p-3.5 rounded-xl">
          <StitchField label="Pourquoi ce document est intéressant pour Ivry-sur-Seine ? *">
            <StitchTextarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} required
              placeholder="Ex: Ce retour d'expérience permet d'éviter les pièges de profilage des usagers pour notre futur guichet unique…" />
          </StitchField>
        </div>
        {error && <StitchAlert kind="error">{error}</StitchAlert>}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-5 py-2 rounded-full font-headline text-label-md text-on-surface-variant hover:bg-surface-container transition-all">
            Annuler
          </button>
          <PrimaryButton icon="send" disabled={busy}>{busy ? 'Envoi…' : 'Transmettre pour modération'}</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

export default function Resources() {
  const { canInteract, isIanimateur } = useAuth();
  const [items, setItems] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 12;
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'published' | 'pending'>('published');
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  async function load() {
    setLoading(true); setError('');
    try {
      setItems(await getResources({ limit, offset, search: search || undefined, status: tab }));
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [offset, tab]);

  const top = useMemo(
    () => [...items].filter((r) => r.avg_stars).sort((a, b) => Number(b.avg_stars) - Number(a.avg_stars)).slice(0, 3),
    [items]
  );
  const pendingCount = tab === 'pending' ? items.length : 0;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 lg:px-6 py-6 flex flex-col gap-6">
      {/* Bandeau titre */}
      <SectionCard className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 bg-primary-fixed text-on-primary-fixed-variant rounded-full font-headline text-label-sm uppercase tracking-wider">Base de Connaissances</span>
            <span className="flex items-center gap-1 font-headline text-label-sm text-tertiary">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary-fixed-dim" />
              {items.length} ressource(s) mutualisée(s)
            </span>
          </div>
          <h1 className="font-headline text-headline-lg-mobile lg:text-headline-lg text-primary tracking-tight mt-1">Base Documentaire Collaborative</h1>
          <p className="font-body text-body-sm text-on-surface-variant">Explorez, notez et synthétisez les lectures clés pour co-construire la Charte Éthique de l'IA à Ivry-sur-Seine.</p>
        </div>
        {canInteract && (
          <PrimaryButton icon="add_circle" onClick={() => setModalOpen(true)} className="shrink-0 py-2.5 px-5">
            Proposer une ressource
          </PrimaryButton>
        )}
      </SectionCard>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <section className="xl:col-span-8 flex flex-col gap-5">
          {/* Onglets + filtre */}
          <SectionCard className="p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-full">
                <button
                  className={`px-4 py-1.5 rounded-full font-headline text-label-md transition-all flex items-center gap-2 ${tab === 'published' ? 'bg-surface-container-lowest shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                  onClick={() => { setTab('published'); setOffset(0); }} type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                  <span>Ressources validées</span>
                </button>
                <button
                  className={`px-4 py-1.5 rounded-full font-headline text-label-md transition-all flex items-center gap-2 ${tab === 'pending' ? 'bg-surface-container-lowest shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                  onClick={() => { setTab('pending'); setOffset(0); }} type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">rule</span>
                  <span>File de modération</span>
                </button>
              </div>
              <div className="relative w-full sm:w-64">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">filter_list</span>
                <input
                  className="w-full pl-9 pr-3 py-1.5 bg-surface-container-low rounded-full font-body text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest shadow-inner transition-all"
                  placeholder="Filtrer en direct…" value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (setOffset(0), load())}
                />
              </div>
            </div>
          </SectionCard>

          {tab === 'pending' && isIanimateur && pendingCount > 0 && (
            <div className="bg-surface-container-highest rounded-2xl p-4 text-on-surface shadow-card flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined">gavel</span>
                </div>
                <div>
                  <p className="font-headline text-headline-sm text-primary">Vue spéciale IAnimateur municipal</p>
                  <p className="font-body text-body-sm text-on-surface-variant">{pendingCount} document(s) soumis par les ambassadeurs requièrent votre validation avant diffusion publique.</p>
                </div>
              </div>
            </div>
          )}

          {error && <StitchAlert kind="error">{error}</StitchAlert>}
          {loading ? <StitchSpinner />
            : items.length === 0 ? <StitchEmpty icon="folder_open">Aucune ressource pour ces critères.</StitchEmpty>
            : items.map((r) => <ResourceCard key={r.id} res={r} onChanged={load} />)}
          <Pagination offset={offset} limit={limit} count={items.length} onChange={setOffset} />
        </section>

        {/* Colonne droite */}
        <aside className="xl:col-span-4 flex flex-col gap-6">
          {top.length > 0 && (
            <SectionCard className="p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="font-headline text-headline-sm text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-[20px]">trending_up</span>
                  Ressources les plus plébiscitées
                </h3>
                <span className="font-headline text-label-sm text-outline">Top Ivry</span>
              </div>
              <div className="flex flex-col gap-3">
                {top.map((r, i) => (
                  <Link key={r.id} to={`/ressources/${r.id}`} className="group flex items-start gap-3 p-2.5 rounded-lg hover:bg-surface-container-low transition-colors">
                    <span className={`w-6 h-6 rounded-full ${i === 0 ? 'bg-secondary' : i === 1 ? 'bg-secondary/80' : 'bg-secondary/60'} text-on-secondary font-headline text-label-sm flex items-center justify-center shrink-0`}>{i + 1}</span>
                    <div className="flex flex-col min-w-0">
                      <span className="font-headline text-label-md text-on-surface group-hover:text-secondary truncate">{r.title}</span>
                      <span className="font-body text-body-sm text-on-surface-variant">Note : {Number(r.avg_stars).toFixed(1)}/4 • {r.ratings_count} avis</span>
                    </div>
                  </Link>
                ))}
              </div>
            </SectionCard>
          )}

          <div className="bg-gradient-to-br from-primary via-primary-container to-secondary rounded-2xl p-6 text-on-primary shadow-card flex flex-col gap-4 relative overflow-hidden">
            <div className="relative z-10 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px]">lightbulb</span>
                <span className="font-headline text-label-md tracking-wider uppercase opacity-90">Co-construction Ivry</span>
              </div>
              <h4 className="font-headline text-headline-md font-bold leading-tight">Vous avez lu une étude percutante ?</h4>
              <p className="font-body text-body-sm opacity-90">
                Chaque ressource alimente le corpus d'apprentissage du Comité Éthique municipal et des IAmbassadeurs d'Ivry.
              </p>
              {canInteract && (
                <button
                  className="mt-2 w-full py-2.5 px-4 bg-surface-container-lowest text-primary hover:bg-surface-bright rounded-full font-headline text-label-md font-bold shadow-sm transition-all flex items-center justify-center gap-2"
                  onClick={() => setModalOpen(true)} type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                  <span>Soumettre un document</span>
                </button>
              )}
            </div>
            <svg className="absolute -right-10 -bottom-10 opacity-15 w-48 h-48 pointer-events-none" fill="currentColor" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="80" />
              <circle cx="100" cy="100" r="50" />
            </svg>
          </div>
        </aside>
      </div>

      <CreateResourceModal open={modalOpen} onClose={() => setModalOpen(false)} onDone={() => { setTab('published'); setOffset(0); load(); }} />
    </div>
  );
}
