const CACHE_NAME = 'routine-v2-shell-2026-11-10-r3-frequency';
const SHELL = [
  './', './index.html', './styles.css?v=2.2.0', './app.js?v=2.2.0', './storage.js', './metrics.js',
  './manifest.webmanifest', './assets/favicon-green-ring.png', './assets/icon-green-ring-192.png',
  './assets/icon-green-ring-512.png', './assets/apple-touch-icon-green-ring.png',
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('routine-v2-shell-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) { const clone = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put('./index.html', clone)); }
      return response;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok) { const clone = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put(request, clone)); }
    return response;
  })));
});
