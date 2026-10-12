// Service worker: geymir sjálft appið svo það opnist hratt.
// Gögnin (Supabase) eru alltaf sótt beint og aldrei geymd hér.
// Hækkaðu VERSION þegar ný útgáfa er sett út.
const VERSION = 'fv-v2';
const SHELL = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/app.js', 'js/data.js', 'js/util.js', 'js/config.js',
  'icons/apple-touch-icon.png', 'icons/icon-192.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // Supabase-forritasafnið af CDN: geymt eftir fyrstu notkun
  if (url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(caches.open(VERSION).then(async (c) => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) c.put(e.request, res.clone());
      return res;
    }));
    return;
  }

  if (url.origin !== self.location.origin) return; // gögn → beint á netið

  // Appið sjálft: nýjasta af netinu, annars úr geymslu
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) caches.open(VERSION).then((c) => c.put(e.request, res.clone()));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))),
  );
});
