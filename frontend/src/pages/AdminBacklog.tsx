import { useCallback, useEffect, useState } from 'react';
import { deleteBacklogItem, getBacklog, setBacklogStatus } from '../api/endpoints';
import { errMsg } from '../api/client';
import { GhostButton, IconBtn, Modal, PrimaryButton, SectionCard, StitchAlert, StitchEmpty, StitchField, StitchSpinner, StitchTextarea, useToast } from '../components/stitch';
import { STATUS_META, TYPE_META } from '../components/WhatsNew';
import type { BacklogItem, BacklogStatus } from '../types';

const dt = (iso: string) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

// Refus : le motif est obligatoire et transmis au demandeur.
function RefusalModal({ item, onClose, onDone }: { item: BacklogItem; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const refuse = async () => {
    setBusy(true); setErr(null);
    try { await setBacklogStatus(item.id, 'refusee', reason.trim()); onDone(); } catch (e) { setErr(errMsg(e)); setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`Refuser la demande n° ${item.id}`} icon="block">
      <p className="font-body text-body-md text-on-surface-variant">« {item.title} » — le motif sera transmis à {item.author_name || 'son auteur'}.</p>
      {err && <StitchAlert kind="error">{err}</StitchAlert>}
      <StitchField label="Motif du refus">
        <StitchTextarea autoFocus rows={4} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} />
      </StitchField>
      <div className="flex justify-end gap-2">
        <GhostButton onClick={onClose}>Annuler</GhostButton>
        <PrimaryButton onClick={refuse} disabled={busy || reason.trim().length < 3}>Refuser</PrimaryButton>
      </div>
    </Modal>
  );
}

// Onglet Backlog : bugs signalés et idées proposées par les utilisateurs.
export default function AdminBacklog() {
  const { show, Toast } = useToast();
  const [items, setItems] = useState<BacklogItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'' | BacklogStatus>('');
  const [refusing, setRefusing] = useState<BacklogItem | null>(null);

  const load = useCallback(() => {
    getBacklog().then(setItems).catch((e) => setError(errMsg(e)));
  }, []);
  useEffect(load, [load]);

  const change = async (x: BacklogItem, status: BacklogStatus) => {
    try { await setBacklogStatus(x.id, status); show(`Demande n° ${x.id} : ${STATUS_META[status].label.toLowerCase()}`); load(); }
    catch (e) { setError(errMsg(e)); }
  };
  const remove = async (x: BacklogItem) => {
    if (!window.confirm(`Supprimer définitivement la demande n° ${x.id} ?`)) return;
    try { await deleteBacklogItem(x.id); show('Demande supprimée'); load(); } catch (e) { setError(errMsg(e)); }
  };

  if (error && !items) return <StitchAlert kind="error">{error}</StitchAlert>;
  if (!items) return <div className="flex justify-center py-12"><StitchSpinner /></div>;

  const count = (s: BacklogStatus) => items.filter((x) => x.status === s).length;
  const rows = items.filter((x) => !filter || x.status === filter);
  const chip = (on: boolean) =>
    `px-3.5 py-1.5 rounded-full font-headline text-label-md whitespace-nowrap ${on ? 'bg-primary-container text-on-primary-container font-semibold' : 'text-on-surface-variant hover:bg-surface-container'}`;

  return (
    <div className="space-y-4">
      <p className="font-body text-body-md text-on-surface-variant max-w-3xl">
        Bugs signalés et idées proposées depuis les « Nouveautés ». Un changement d’état est notifié à l’auteur
        (selon ses préférences de notification) et visible dans « Mes demandes ».
      </p>
      {error && <StitchAlert kind="error">{error}</StitchAlert>}
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filtrer par état">
        <button role="tab" aria-selected={filter === ''} className={chip(filter === '')} onClick={() => setFilter('')} type="button">Toutes ({items.length})</button>
        {(Object.keys(STATUS_META) as BacklogStatus[]).map((s) => (
          <button key={s} role="tab" aria-selected={filter === s} className={chip(filter === s)} onClick={() => setFilter(s)} type="button">
            {STATUS_META[s].label} ({count(s)})
          </button>
        ))}
      </div>
      <SectionCard className="overflow-x-auto !p-0">
        {!rows.length ? <StitchEmpty icon="lightbulb">Aucune demande.</StitchEmpty> : (
          <table className="w-full text-left font-body text-body-sm">
            <thead>
              <tr className="border-b border-surface-container text-outline font-headline text-label-sm uppercase tracking-wider">
                <th className="px-4 py-3">N°</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Demande</th>
                <th className="px-4 py-3">Auteur</th><th className="px-4 py-3">État</th><th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.id} className="border-b border-surface-container align-top">
                  <td className="px-4 py-3 font-mono">{x.id}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1"><span className="material-symbols-outlined text-[16px] text-secondary">{TYPE_META[x.type].icon}</span>{TYPE_META[x.type].label}</span>
                  </td>
                  <td className="px-4 py-3 max-w-lg">
                    <div className="font-headline text-label-lg text-on-surface">{x.title}</div>
                    <div className="whitespace-pre-line text-on-surface-variant">{x.description}</div>
                    {x.app_version && <div className="text-outline">Version {x.app_version}</div>}
                    {x.reason && <div className="mt-1 text-on-surface"><b>{x.status === 'refusee' ? 'Motif' : 'Précision'} :</b> {x.reason}</div>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{x.author_name || '—'}<br /><span className="text-outline">{dt(x.created_at)}</span></td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-full font-headline text-label-sm ${STATUS_META[x.status].cls}`}>{STATUS_META[x.status].label}</span>
                    {x.treated_by_name && x.treated_at && <div className="mt-1 text-outline">{x.treated_by_name}, {dt(x.treated_at)}</div>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    {(x.status === 'demandee' || x.status === 'refusee') && <IconBtn icon="check" title="Accepter" onClick={() => change(x, 'acceptee')} />}
                    {(x.status === 'demandee' || x.status === 'acceptee') && <IconBtn icon="close" title="Refuser" onClick={() => setRefusing(x)} />}
                    {x.status === 'acceptee' && <IconBtn icon="task_alt" title="Déclarer réalisée" onClick={() => change(x, 'realisee')} />}
                    <IconBtn icon="delete" tone="error" title="Supprimer" onClick={() => remove(x)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
      {refusing && <RefusalModal item={refusing} onClose={() => setRefusing(null)} onDone={() => { setRefusing(null); show('Demande refusée'); load(); }} />}
      {Toast}
    </div>
  );
}
