// CourseKit service worker: keeps the app working with no signal, and keeps map squares you've viewed.
const VERSION = '65ba0f0d45';
const APP = `coursekit-app-${VERSION}`;
const TILES = 'coursekit-tiles';
const MAX_TILES = 3000;
const SHELL = ['app.html', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-32.png'];
const TILE_HOSTS = /(^|\.)(arcgisonline\.com|opentopomap\.org|openstreetmap\.org)$/;

self.addEventListener('install', e => { e.waitUntil(caches.open(APP).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('coursekit-app-') && k !== APP).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function trim() {
  const c = await caches.open(TILES), keys = await c.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await c.delete(keys[i]);
}

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Map squares: use the saved copy if there is one, otherwise fetch and save it.
  if (TILE_HOSTS.test(url.hostname)) {
    e.respondWith(caches.open(TILES).then(async c => {
      const hit = await c.match(req); if (hit) return hit;
      const res = await fetch(req); if (res.ok || res.type === 'opaque') { c.put(req, res.clone()); trim(); }
      return res;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  // The app itself: try the network first so updates arrive, fall back to the saved copy offline.
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(APP).then(c => c.put(req, copy)); }
    return res;
  }).catch(async () => (await caches.match(req)) || (req.mode === 'navigate' ? caches.match('app.html') : Response.error())));
});
