// Service worker minimal : requis pour l'installation (PWA). Aucune mise en cache :
// les données et l'application restent toujours celles du serveur.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
