import { useCallback, useEffect, useState } from 'react';
import { createAnnouncement, deleteAnnouncement, getAnnouncements, updateAnnouncement } from '../api/endpoints';
import type { AnnouncementInput } from '../api/endpoints';
import { errMsg } from '../api/client';
import { GhostButton, IconBtn, Modal, PrimaryButton, SectionCard, StitchAlert, StitchEmpty, StitchField, StitchInput, StitchSelect, StitchSpinner, StitchTextarea, useToast } from '../components/stitch';
import type { AnnouncementAdmin, AnnouncementKind } from '../types';

const ETAT: Record<AnnouncementAdmin['etat'], { label: string; cls: string }> = {
  en_cours: { label: 'Affichée', cls: 'bg-tertiary-fixed/60 text-on-tertiary-fixed-variant' },
  programme: { label: 'Programmée', cls: 'bg-secondary-container/40 text-on-secondary-container' },
  termine: { label: 'Terminée', cls: 'bg-surface-container text-on-surface-variant' },
  desactive: { label: 'Désactivée', cls: 'bg-warning-container text-on-warning-container' },
};
const KIND_LABEL: Record<AnnouncementKind, string> = { bandeau: 'Bandeau', modale: 'Fenêtre à l’ouverture' };

const dt = (iso: string) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
// ISO → valeur d'un champ datetime-local (heure locale).
const local = (iso: string) => {
  const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

function AnnouncementForm({ item, onClose, onSaved }: { item: AnnouncementAdmin | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    kind: (item?.kind ?? 'bandeau') as AnnouncementKind,
    title: item?.title ?? '',
    message: item?.message ?? '',
    starts_at: local(item?.starts_at ?? new Date().toISOString()),
    ends_at: local(item?.ends_at ?? new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()),
    active: item?.active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const max = f.kind === 'bandeau' ? 500 : 3000;
  const valid = f.message.trim().length >= 3 && f.message.length <= max && !!f.starts_at && !!f.ends_at && new Date(f.ends_at) > new Date(f.starts_at);

  const save = async () => {
    setBusy(true); setErr(null);
    const body: AnnouncementInput = {
      kind: f.kind, title: f.title.trim(), message: f.message.trim(),
      starts_at: new Date(f.starts_at).toISOString(), ends_at: new Date(f.ends_at).toISOString(), active: f.active,
    };
    try { if (item) await updateAnnouncement(item.id, body); else await createAnnouncement(body); onSaved(); }
    catch (e) { setErr(errMsg(e)); setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={item ? 'Modifier l’annonce' : 'Nouvelle annonce'} icon="campaign">
      <div className="space-y-3">
        {err && <StitchAlert kind="error">{err}</StitchAlert>}
        <StitchField label="Affichage">
          <StitchSelect value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as AnnouncementKind })}>
            <option value="bandeau">Bandeau sous l’en-tête</option>
            <option value="modale">Fenêtre à l’ouverture de l’application</option>
          </StitchSelect>
        </StitchField>
        <StitchField label="Titre (facultatif)">
          <StitchInput maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </StitchField>
        <StitchField label="Message" hint={`${f.message.length} / ${max} caractères`}>
          <StitchTextarea rows={f.kind === 'bandeau' ? 3 : 6} maxLength={max} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
        </StitchField>
        <div className="grid gap-3 sm:grid-cols-2">
          <StitchField label="Début">
            <StitchInput type="datetime-local" value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} />
          </StitchField>
          <StitchField label="Fin" hint="L’annonce disparaît à cette date.">
            <StitchInput type="datetime-local" min={f.starts_at} value={f.ends_at} onChange={(e) => setF({ ...f, ends_at: e.target.value })} />
          </StitchField>
        </div>
        {f.starts_at && f.ends_at && new Date(f.ends_at) <= new Date(f.starts_at) && (
          <p role="alert" className="font-body text-body-sm text-error">La fin doit être postérieure au début.</p>
        )}
        <label className="flex items-center gap-2 font-body text-body-md text-on-surface cursor-pointer">
          <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
          Active (décochez pour la masquer sans la supprimer)
        </label>
        <p className="font-body text-body-sm text-outline">Chaque utilisateur peut choisir de ne plus afficher l’annonce. Modifier le texte la fait réapparaître pour tous.</p>
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onClose}>Annuler</GhostButton>
          <PrimaryButton onClick={save} disabled={busy || !valid}>Enregistrer</PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

// Onglet Annonces : bandeau et fenêtre d'information à l'ouverture.
export default function AdminAnnouncements() {
  const { show, Toast } = useToast();
  const [items, setItems] = useState<AnnouncementAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<AnnouncementAdmin | 'new' | null>(null);

  const load = useCallback(() => { getAnnouncements().then(setItems).catch((e) => setError(errMsg(e))); }, []);
  useEffect(load, [load]);

  const remove = async (a: AnnouncementAdmin) => {
    if (!window.confirm('Supprimer cette annonce ?')) return;
    try { await deleteAnnouncement(a.id); show('Annonce supprimée'); load(); } catch (e) { setError(errMsg(e)); }
  };

  if (error && !items) return <StitchAlert kind="error">{error}</StitchAlert>;
  if (!items) return <div className="flex justify-center py-12"><StitchSpinner /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="font-body text-body-md text-on-surface-variant max-w-3xl">
          Publiez une information pour <b>tous les utilisateurs</b> entre deux dates : un <b>bandeau</b> sous l’en-tête
          ou une <b>fenêtre</b> affichée à l’ouverture. Chaque utilisateur peut la masquer définitivement.
        </p>
        <PrimaryButton icon="add" onClick={() => setEdit('new')}>Nouvelle annonce</PrimaryButton>
      </div>
      {error && <StitchAlert kind="error">{error}</StitchAlert>}
      <SectionCard className="overflow-x-auto !p-0">
        {!items.length ? <StitchEmpty icon="campaign">Aucune annonce.</StitchEmpty> : (
          <table className="w-full text-left font-body text-body-sm">
            <thead>
              <tr className="border-b border-surface-container text-outline font-headline text-label-sm uppercase tracking-wider">
                <th className="px-4 py-3">Annonce</th><th className="px-4 py-3">Affichage</th><th className="px-4 py-3">Période</th>
                <th className="px-4 py-3">État</th><th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className={`border-b border-surface-container align-top ${a.etat === 'termine' || a.etat === 'desactive' ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3 max-w-md">
                    {a.title && <div className="font-headline text-label-lg text-on-surface">{a.title}</div>}
                    <div className="whitespace-pre-line text-on-surface-variant">{a.message}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{KIND_LABEL[a.kind]}</td>
                  <td className="px-4 py-3 whitespace-nowrap">du {dt(a.starts_at)}<br />au {dt(a.ends_at)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-full font-headline text-label-sm ${ETAT[a.etat].cls}`}>{ETAT[a.etat].label}</span>
                    <div className="mt-1 text-outline">{a.dismissed_count} masquage(s)</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <IconBtn icon="edit" title="Modifier" onClick={() => setEdit(a)} />
                    <IconBtn icon="delete" tone="error" title="Supprimer" onClick={() => remove(a)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
      {edit && <AnnouncementForm item={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); show('Annonce enregistrée'); load(); }} />}
      {Toast}
    </div>
  );
}
