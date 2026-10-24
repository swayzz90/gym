// Offline-Cache für die Gym-App. Bei Updates CACHE-Version erhöhen.
const CACHE = 'gym-v2';
const ASSETS = ['./', './index.html', './manifest.json', './icon-180.png', './icon-512.png'];
const EXTERNAL = ['fonts.googleapis.com', 'fonts.gstatic.com', 'raw.githubusercontent.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== 'gym-images').map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const external = EXTERNAL.includes(url.hostname);
  if (url.origin !== location.origin && !external) return;

  // Übungsbilder und Schriften: einmal laden, dann aus dem Cache (auch offline)
  if (external) {
    const store = url.hostname === 'raw.githubusercontent.com' ? 'gym-images' : CACHE;
    e.respondWith(caches.open(store).then(async cache => {
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      } catch (err) { return Response.error(); }
    }));
    return;
  }

  // App selbst: sofort aus dem Cache, im Hintergrund aktualisieren
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { e.waitUntil(network); return cached; }
    const res = await network;
    if (res) return res;
    if (req.mode === 'navigate') return cache.match('./index.html');
    return Response.error();
  }));
});
