const CACHE_NAME = 'cyber-tmsah-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['/'])).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((names) => Promise.all(
        names.filter((n) => n.startsWith('cyber-tmsah-') && n !== CACHE_NAME).map((n) => caches.delete(n))
      )),
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (new URL(event.request.url).origin !== self.location.origin) return;
  const isNavigation = event.request.mode === 'navigate' || event.request.destination === 'document';
  const isAsset = ['script', 'style', 'font', 'image'].includes(event.request.destination);
  if (!isNavigation && !isAsset) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        // A script, stylesheet or image must never receive the app's HTML fallback.
        if (!isNavigation) return Response.error();
        const rootCached = await caches.match('/');
        if (rootCached) return rootCached;
        return new Response('<!DOCTYPE html><html lang="ar" dir="rtl"><head><title>CYBER TMSAH</title></head><body><div id="root"></div></body></html>', {
          headers: { 'Content-Type': 'text/html' }
        });
      })
  );
});
