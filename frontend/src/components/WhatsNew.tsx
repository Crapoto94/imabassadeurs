import { useEffect, useState } from 'react';
import { createBacklogItem, getMyBacklog } from '../api/endpoints';
import { errMsg } from '../api/client';
import { VERSION, VERSIONS } from '../changelog';
import type { BacklogItem, BacklogStatus, BacklogType } from '../types';
import { GhostButton, Modal, PrimaryButton, StitchAlert, StitchEmpty, StitchField, StitchInput, StitchSpinner, StitchTextarea } from './stitch';

export const STATUS_META: Record<BacklogStatus, { label: string; cls: string }> = {
  demandee: { label: 'En attente', cls: 'bg-surface-container text-on-surface-variant' },
  acceptee: { label: 'Acceptée', cls: 'bg-secondary-container/40 text-on-secondary-container' },
  refusee: { label: 'Refusée', cls: 'bg-error-container text-on-error-container' },
  realisee: { label: 'Réalisée', cls: 'bg-tertiary-fixed/60 text-on-tertiary-fixed-variant' },
};

export const TYPE_META: Record<BacklogType, { label: string; icon: string }> = {
  bug: { label: 'Bug', icon: 'bug_report' },
  evolution: { label: 'Idée', icon: 'lightbulb' },
};

const fmt = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

// Formulaire de dépôt d'un bug ou d'une idée.
function RequestForm({ type, onClose, onSent }: { type: BacklogType; onClose: () => void; onSent: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isBug = type === 'bug';

  const send = async () => {
    setBusy(true); setErr(null);
    try {
      await createBacklogItem({ type, title: title.trim(), description: description.trim(), app_version: VERSION });
      onSent();
    } catch (e) { setErr(errMsg(e)); setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={isBug ? 'Déclarer un bug' : 'Proposer une idée'} icon={TYPE_META[type].icon}>
      <div className="space-y-3">
        {err && <StitchAlert kind="error">{err}</StitchAlert>}
        <StitchField label="Titre">
          <StitchInput autoFocus maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        </StitchField>
        <StitchField label="Description" hint={`Version ${VERSION}. Vous suivrez la suite donnée dans « Mes demandes ».`}>
          <StitchTextarea
            rows={6} maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder={isBug ? 'Que s’est-il passé ? Sur quel écran ? Que deviez-vous obtenir ?' : 'Que souhaitez-vous pouvoir faire ? Pourquoi ?'}
          />
        </StitchField>
        <div className="flex justify-end gap-2 pt-1">
          <GhostButton onClick={onClose}>Annuler</GhostButton>
          <PrimaryButton onClick={send} disabled={busy || title.trim().length < 3 || description.trim().length < 3} icon="send">Envoyer</PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

function MyRequests({ reloadKey }: { reloadKey: number }) {
  const [items, setItems] = useState<BacklogItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setItems(null);
    getMyBacklog().then(setItems).catch((e) => setErr(errMsg(e)));
  }, [reloadKey]);
  if (err) return <StitchAlert kind="error">{err}</StitchAlert>;
  if (!items) return <div className="flex justify-center py-8"><StitchSpinner /></div>;
  if (!items.length) return <StitchEmpty icon="lightbulb">Vous n’avez encore rien déposé.</StitchEmpty>;
  return (
    <ul className="space-y-3">
      {items.map((x) => (
        <li key={x.id} className="rounded-xl border border-surface-container p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-secondary">{TYPE_META[x.type].icon}</span>
            <span className="font-headline text-label-lg text-on-surface">{x.title}</span>
            <span className={`ml-auto px-2 py-0.5 rounded-full font-headline text-label-sm ${STATUS_META[x.status].cls}`}>{STATUS_META[x.status].label}</span>
          </div>
          <p className="mt-1 font-body text-body-sm text-on-surface-variant whitespace-pre-line">{x.description}</p>
          {x.reason && (
            <p className="mt-1 font-body text-body-sm text-on-surface"><b>{x.status === 'refusee' ? 'Motif' : 'Précision'} :</b> {x.reason}</p>
          )}
          <p className="mt-1 font-body text-body-sm text-outline">Déposée le {fmt(x.created_at)}{x.app_version ? ` · version ${x.app_version}` : ''}</p>
        </li>
      ))}
    </ul>
  );
}

// Fenêtre « Nouveautés » : journal des versions, dépôt d'un bug / d'une idée, suivi de mes demandes.
export default function WhatsNew({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<'news' | 'mine'>('news');
  const [form, setForm] = useState<BacklogType | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [sent, setSent] = useState(false);

  useEffect(() => { if (open) { setTab('news'); setSent(false); } }, [open]);

  const tabCls = (on: boolean) =>
    `px-4 py-1.5 rounded-full font-headline text-label-md transition-colors ${on ? 'bg-primary-container text-on-primary-container font-semibold' : 'text-on-surface-variant hover:bg-surface-container'}`;

  return (
    <>
      <Modal open={open && !form} onClose={onClose} title="Nouveautés" icon="new_releases">
        <div className="flex flex-wrap gap-2">
          <GhostButton icon="bug_report" className="border border-surface-container" onClick={() => setForm('bug')}>Déclarer un bug</GhostButton>
          <GhostButton icon="lightbulb" className="border border-surface-container" onClick={() => setForm('evolution')}>Proposer une idée</GhostButton>
        </div>
        {sent && <StitchAlert kind="success">Merci, votre demande est enregistrée.</StitchAlert>}
        <div className="flex gap-1" role="tablist">
          <button role="tab" aria-selected={tab === 'news'} className={tabCls(tab === 'news')} onClick={() => setTab('news')} type="button">Versions</button>
          <button role="tab" aria-selected={tab === 'mine'} className={tabCls(tab === 'mine')} onClick={() => setTab('mine')} type="button">Mes demandes</button>
        </div>
        {tab === 'news' ? (
          <ol className="space-y-3">
            {VERSIONS.map((v) => (
              <li key={v.version} className="rounded-xl border border-surface-container p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-bold text-primary">{v.version}</span>
                  <span className={`px-2 py-0.5 rounded-full font-headline text-label-sm ${v.type === 'minor' ? 'bg-secondary-container/40 text-on-secondary-container' : 'bg-surface-container text-on-surface-variant'}`}>
                    {v.type === 'minor' ? 'Nouveauté' : 'Correctif'}
                  </span>
                  {v.version === VERSION && <span className="font-headline text-label-sm text-tertiary">Version actuelle</span>}
                  <time className="ml-auto font-body text-body-sm text-outline" dateTime={v.date}>{fmt(v.date)}</time>
                </div>
                <p className="mt-1 font-headline text-label-lg text-on-surface">{v.title}</p>
                <ul className="mt-1 list-disc pl-5 space-y-0.5 font-body text-body-sm text-on-surface-variant">
                  {v.items.map((it, i) => <li key={i}>{it}</li>)}
                </ul>
              </li>
            ))}
          </ol>
        ) : <MyRequests reloadKey={reloadKey} />}
      </Modal>
      {form && (
        <RequestForm
          type={form}
          onClose={() => setForm(null)}
          onSent={() => { setForm(null); setSent(true); setTab('mine'); setReloadKey((k) => k + 1); }}
        />
      )}
    </>
  );
}
