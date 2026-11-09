import { useState } from 'react';
import { useInstall } from '../hooks/useInstall';

const KEY = 'install_prompt_dismissed';

function recentlyDismissed() {
  try {
    const t = Number(localStorage.getItem(KEY) || 0);
    return Date.now() - t < 30 * 24 * 3600 * 1000;
  } catch { return false; }
}

// Consigne d'installation pour iOS (pas d'invite native).
export function IosHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-surface-container-lowest p-5 shadow-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-headline text-headline-sm text-primary mb-2">Installer l'application</h3>
        <ol className="list-decimal pl-5 space-y-1.5 font-body text-body-md text-on-surface-variant">
          <li>Touchez le bouton <b>Partager</b> <span className="material-symbols-outlined align-middle text-[18px]">ios_share</span> de Safari.</li>
          <li>Choisissez <b>Sur l'écran d'accueil</b>.</li>
          <li>Validez avec <b>Ajouter</b>.</li>
        </ol>
        <button type="button" onClick={onClose} className="mt-4 w-full rounded-full bg-primary-container py-2 font-headline text-label-md text-on-primary-container">
          Compris
        </button>
      </div>
    </div>
  );
}

// Action d'installation réutilisable (bandeau et entrée de menu).
export function useInstallAction() {
  const { available, canPrompt, ios, install } = useInstall();
  const [help, setHelp] = useState(false);
  const run = () => { if (canPrompt) install(); else if (ios) setHelp(true); };
  return { available, run, help, closeHelp: () => setHelp(false) };
}

// Bandeau discret en bas d'écran, mobile uniquement, masquable (30 jours).
export default function InstallPrompt({ available, run }: { available: boolean; run: () => void }) {
  const [hidden, setHidden] = useState(recentlyDismissed);

  function dismiss() {
    try { localStorage.setItem(KEY, String(Date.now())); } catch { /* stockage indisponible */ }
    setHidden(true);
  }

  if (!available || hidden) return null;
  return (
    <div className="no-print md:hidden fixed inset-x-3 bottom-3 z-40 flex items-center gap-3 rounded-2xl bg-primary px-4 py-3 text-on-primary shadow-modal">
      <img src="/icon-192.png" alt="" className="h-10 w-10 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="font-headline text-label-lg leading-tight">Installer IAmbassadeurs</p>
        <p className="font-body text-body-sm opacity-80 leading-tight">Accès direct depuis votre écran d'accueil</p>
      </div>
      <button type="button" onClick={run} className="shrink-0 rounded-full bg-secondary px-3.5 py-1.5 font-headline text-label-md text-on-secondary">
        Installer
      </button>
      <button type="button" onClick={dismiss} aria-label="Plus tard" className="shrink-0 -mr-1 flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10">
        <span className="material-symbols-outlined text-[20px]">close</span>
      </button>
    </div>
  );
}
