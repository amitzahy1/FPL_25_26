const CACHE_NAME = 'fpl-tool-v12-draft-api-final';
const APP_SHELL = [
  './',
  './index.html',
  './FPL_Bootstrap_static.json',
  './manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => {
        // ⚠️ Clear all localStorage on activation to force fresh data
        return self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: 'CLEAR_LOCALSTORAGE' });
          });
        });
      })
      .then(() => self.clients.claim())
  );
});

const API_HOSTS = [
  'fpl-25-26.vercel.app',
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com'
];

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;

  // Network-first for APIs
  if (API_HOSTS.includes(url.hostname)) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // ⚠️ Network-first for script.js to ensure fresh code
  if (url.pathname.includes('script.js')) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for app shell
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
