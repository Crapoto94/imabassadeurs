import { useEffect, useState } from 'react';
import { dismissAnnouncement, getActiveAnnouncements } from '../api/endpoints';
import type { Announcement } from '../types';
import { Modal, PrimaryButton } from './stitch';

// Annonces publiées par les admins : bandeau défilant sous l'en-tête et modale à l'ouverture.
// « Ne plus afficher » est enregistré côté serveur (par utilisateur et par annonce).
// Fermer sans cocher masque la modale pour la session seulement (sessionStorage).
const SEEN_KEY = 'announcements.seen';

const readSeen = (): number[] => {
  try { return JSON.parse(sessionStorage.getItem(SEEN_KEY) || '[]'); } catch { return []; }
};
const markSeen = (id: number) => {
  try { sessionStorage.setItem(SEEN_KEY, JSON.stringify([...readSeen(), id])); } catch { /* sans stockage : réaffichée */ }
};

export default function Announcements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [seen, setSeen] = useState<number[]>(readSeen);
  const [never, setNever] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () => { getActiveAnnouncements().then((r) => { if (alive) setItems(r); }).catch(() => { /* jamais bloquant */ }); };
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const hide = (id: number) => {
    setItems((cur) => cur.filter((a) => a.id !== id));
    dismissAnnouncement(id).catch(() => { /* réapparaîtra au prochain chargement */ });
  };

  const bandeaux = items.filter((a) => a.kind === 'bandeau');
  const modale = items.find((a) => a.kind === 'modale' && !seen.includes(a.id));

  const closeModal = () => {
    if (!modale) return;
    if (never) hide(modale.id);
    markSeen(modale.id);
    setSeen(readSeen());
    setNever(false);
  };

  return (
    <>
      {bandeaux.map((a) => (
        <div key={a.id} role="status" aria-live="polite" className="no-print flex items-stretch bg-warning-container text-on-warning-container border-b border-warning/40">
          <span className="flex shrink-0 items-center gap-1.5 px-3 font-headline text-label-sm uppercase tracking-wider bg-warning/30">
            <span className="material-symbols-outlined text-[18px]">campaign</span> Information
          </span>
          <p className="min-w-0 flex-1 px-3 py-2 font-body text-body-md font-semibold">
            {a.title && <span className="mr-2">{a.title} —</span>}{a.message}
          </p>
          <button
            type="button" className="px-3 hover:bg-warning/30" aria-label="Ne plus afficher ce message" title="Ne plus afficher ce message"
            onClick={() => hide(a.id)}
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      ))}
      {modale && (
        <Modal open onClose={closeModal} title={modale.title || 'Information'} icon="campaign">
          <p className="font-body text-body-md text-on-surface whitespace-pre-line">{modale.message}</p>
          <label className="flex items-center gap-2 font-body text-body-sm text-on-surface-variant cursor-pointer">
            <input type="checkbox" checked={never} onChange={(e) => setNever(e.target.checked)} />
            Ne plus afficher ce message
          </label>
          <div className="flex justify-end">
            <PrimaryButton onClick={closeModal}>Fermer</PrimaryButton>
          </div>
        </Modal>
      )}
    </>
  );
}
