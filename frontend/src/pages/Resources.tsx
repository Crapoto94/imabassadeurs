import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Pagination from '../components/Pagination';
import ResourceCard from '../components/ResourceCard';
import { createResource, getResources, getThemes } from '../api/endpoints';
import { errMsg } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import {
  LEVELS, LEVEL_META, Modal, PrimaryButton, SectionCard, StitchAlert, StitchEmpty,
  StitchField, StitchInput, StitchSelect, StitchSpinner, StitchTextarea, useToast,
} from '../components/stitch';
import { ThemePicker } from '../components/Themes';
import type { Resource, Theme } from '../types';

function CreateResourceModal({ open, onClose, onDone, themes }: { open: boolean; onClose: () => void; onDone: () => void; themes: Theme[] }) {
  const { show, Toast } = useToast();
  const [kind, setKind] = useState<'pdf' | 'link'>('link');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [level, setLevel] = useState<string>('debutant');
  const [themeIds, setThemeIds] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setTitle(''); setDescription(''); setUrl(''); setFile(null); setError(''); setKind('link'); setLevel('debutant'); setThemeIds([]); } }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const form = new FormData();
      form.append('title', title);
      form.append('description', description);
      form.append('kind', kind);
      form.append('level', level);
      form.append('theme_ids', JSON.stringify(themeIds));
      if (kind === 'link') form.append('url', url);
      if (kind === 'pdf' && file) form.append('file', file);
      await createResource(form);
      onClose();
      show('Votre ressource a été publiée !');
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
        <StitchField label="Niveau de lecture" hint="Attribué par vous, pour guider vos collègues.">
          <StitchSelect value={level} onChange={(e) => setLevel(e.target.value)}>
            {LEVELS.map((k) => <option key={k} value={k}>{LEVEL_META[k].label}</option>)}
          </StitchSelect>
        </StitchField>
        <StitchField label="Thèmes">
          <ThemePicker themes={themes} value={themeIds} onChange={setThemeIds} />
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
          <PrimaryButton type="submit" icon="send" disabled={busy}>{busy ? 'Envoi…' : 'Publier la ressource'}</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

export default function Resources() {
  const { canInteract } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [items, setItems] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 12;
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'created' | 'level' | 'rating'>('created');
  const [themeFilter, setThemeFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [mandatoryOnly, setMandatoryOnly] = useState(false);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => { getThemes({ scope: 'resource' }).then(setThemes).catch(() => {}); }, []);

  const openCreateResource = Boolean((location.state as { openCreateResource?: boolean } | null)?.openCreateResource);
  useEffect(() => {
    if (!openCreateResource) return;
    setModalOpen(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [openCreateResource, location.pathname, navigate]);

  async function load() {
    setLoading(true); setError('');
    try {
      setItems(await getResources({
        limit, offset, search: search || undefined, sort,
        theme: themeFilter || undefined,
        level: levelFilter || undefined,
        mandatory: mandatoryOnly || undefined,
      }));
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [offset, sort, themeFilter, levelFilter, mandatoryOnly, search]);

  const hasActiveFilters = search.trim() !== '' || sort !== 'created' || themeFilter !== '' || levelFilter !== '' || mandatoryOnly;

  function resetFilters() {
    setSearch('');
    setSort('created');
    setThemeFilter('');
    setLevelFilter('');
    setMandatoryOnly(false);
    setOffset(0);
  }

  const top = useMemo(
    () => [...items].filter((r) => r.avg_stars).sort((a, b) => Number(b.avg_stars) - Number(a.avg_stars)).slice(0, 3),
    [items]
  );

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
          {/* Filtre */}
          <SectionCard className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                aria-expanded={filtersOpen}
                aria-controls="resources-filters"
                className="flex min-w-0 items-center gap-2 text-left"
              >
                <span className="material-symbols-outlined text-primary text-[20px]">filter_list</span>
                <span className="font-headline text-headline-sm text-on-surface">Filtrer les ressources</span>
                <span className={`material-symbols-outlined text-[24px] text-primary transition-transform ${filtersOpen ? 'rotate-180' : ''}`}>
                  arrow_drop_down
                </span>
              </button>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="font-body text-body-sm text-outline hover:text-primary transition-colors"
                >
                  Réinitialiser
                </button>
              )}
            </div>
            {filtersOpen && (
              <div id="resources-filters" className="flex items-center gap-2 flex-wrap">
                <div className="relative w-full sm:w-56">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
                  <input
                    className="w-full pl-9 pr-3 py-1.5 bg-surface-container-low rounded-full font-body text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest shadow-inner transition-all"
                    placeholder="Rechercher..." value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (setOffset(0), load())}
                  />
                </div>
                <label className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-outline text-[18px]">sort</span>
                  <StitchSelect
                    className="!w-auto !py-1.5 !rounded-full !bg-surface-container-low"
                    value={sort}
                    onChange={(e) => { setSort(e.target.value as any); setOffset(0); }}
                    aria-label="Trier les ressources"
                  >
                    <option value="created">Plus récentes</option>
                    <option value="level">Par niveau</option>
                    <option value="rating">Mieux notées</option>
                  </StitchSelect>
                </label>
                <label className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-outline text-[18px]">sell</span>
                  <StitchSelect
                    className="!w-auto !py-1.5 !rounded-full !bg-surface-container-low"
                    value={themeFilter}
                    onChange={(e) => { setThemeFilter(e.target.value); setOffset(0); }}
                    aria-label="Filtrer par thème"
                  >
                    <option value="">Tous les thèmes</option>
                    {themes.map((t) => <option key={t.id} value={t.slug}>{t.label}</option>)}
                  </StitchSelect>
                </label>
                <label className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-outline text-[18px]">signal_cellular_alt</span>
                  <StitchSelect
                    className="!w-auto !py-1.5 !rounded-full !bg-surface-container-low"
                    value={levelFilter}
                    onChange={(e) => { setLevelFilter(e.target.value); setOffset(0); }}
                    aria-label="Filtrer par niveau de lecture"
                  >
                    <option value="">Tous les niveaux</option>
                    {LEVELS.map((k) => <option key={k} value={k}>{LEVEL_META[k].label}</option>)}
                  </StitchSelect>
                </label>
                <button
                  type="button"
                  aria-pressed={mandatoryOnly}
                  onClick={() => { setMandatoryOnly((v) => !v); setOffset(0); }}
                  className={`flex h-[33px] w-fit shrink-0 items-center gap-1.5 !py-0 px-3.5 rounded-full border-0 font-body text-body-md outline-none transition-colors ${
                    mandatoryOnly
                      ? 'bg-error/15 text-error hover:bg-error/20'
                      : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {mandatoryOnly ? 'check_box' : 'check_box_outline_blank'}
                  </span>
                  Parcours obligatoire
                </button>
              </div>
            )}
          </SectionCard>

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
        </aside>
      </div>

      <CreateResourceModal open={modalOpen} onClose={() => setModalOpen(false)} onDone={() => { setOffset(0); load(); }} themes={themes} />
    </div>
  );
}
