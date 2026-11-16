/* Increment VERSION whenever the application files change. Private/API data is never cached. */
const VERSION = 'hochu-pwa-20261116-marketplace-v25';
const ASSETS = ['./offline.html', './icon/icon-192.png', './icon/icon-512.png', './icon/icon-180.png', './icon/maskable-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('hochu-pwa-') && key !== VERSION).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(new URL('./offline.html', self.registration.scope))));
    return;
  }
  if (ASSETS.some(path => url.href === new URL(path, self.registration.scope).href)) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
  }
});
