import { useCallback, useEffect, useState } from 'react';

// Installation de l'application (PWA) : Chrome/Android via beforeinstallprompt,
// iOS/Safari via consigne manuelle (« Sur l'écran d'accueil »).
interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }>; }

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as InstallEvent;
  listeners.forEach((l) => l());
});
window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach((l) => l()); });

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  const installed = isStandalone();
  const canPrompt = !!deferred;
  const ios = isIos();
  const available = !installed && (canPrompt || ios);

  const install = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    listeners.forEach((l) => l());
  }, []);

  return { available, canPrompt, ios, install };
}
