// Offline support for the kiosk: the menu keeps working if the internet drops.
const SHELL = 'boboy-shell-v2', MEDIA = 'boboy-media-v1';
const SHELL_FILES = ['/', '/css/style.css', '/js/app.js', '/img/brand/logo.png',
  '/img/art/caravan.webp'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => ![SHELL, MEDIA].includes(k)).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin')) return;       // always live
  if (url.pathname.startsWith('/uploads/') || url.pathname.startsWith('/img/') || url.pathname.startsWith('/fonts/')) {
    // photos & fonts: cache first
    e.respondWith(caches.open(MEDIA).then(async (c) => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) c.put(e.request, res.clone());
      return res;
    }));
    return;
  }
  // page, css, js: network first, cached copy when offline
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok) caches.open(SHELL).then((c) => c.put(e.request, res.clone()));
    return res;
  }).catch(() => caches.match(e.request).then((r) => r || caches.match('/'))));
});
