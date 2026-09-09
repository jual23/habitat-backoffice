// Constitution: Client Platform Requirements — PWA installability + faster
// repeat loads for static assets. Deliberately narrow scope: only ever
// intercepts GET requests for Next.js's own static build output and app
// icons. Page navigations, server actions, and every Supabase request are
// left untouched (the fetch handler returns early, so the browser handles
// them exactly as if there were no service worker) — this app has no offline
// requirement, and caching authenticated HTML would risk serving stale or
// wrong-user content.

const CACHE_NAME = 'habitat-static-v1';
const STATIC_PATH_PATTERNS = [/^\/_next\/static\//, /^\/icons\//];

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never touch cross-origin (Supabase) requests

  const isStaticAsset = STATIC_PATH_PATTERNS.some((pattern) => pattern.test(url.pathname));
  if (!isStaticAsset) return; // pages, server actions, everything else: network as normal

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    }),
  );
});
