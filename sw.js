/**
 * Cota do Climão — Service Worker
 * Estratégia: Stale-While-Revalidate para o shell
 * (dados climáticos ficam no IndexedDB, gerenciados pelo app — nunca cache-first
 *  de dados em Cache API para evitar mostrar dados velhos perigosos)
 */
const CACHE = 'cota-v2';

const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/api.js',
  './js/calculations.js',
  './js/factors.js',
  './js/risk.js',
  './js/recommendations.js',
  './js/storage.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  const url = new URL(req.url);

  // Nunca cachear chamadas de API — dados vão para IndexedDB com timestamp.
  if (url.hostname.includes('open-meteo.com')) return;

  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;

  // Stale-While-Revalidate para o shell
  ev.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});