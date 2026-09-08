// Bump this version on every release. Changing it purges ALL old caches on
// activate, guaranteeing users never get stuck on a stale app build.
const CACHE_VERSION = 'v3';
const CACHE_NAME = `clinic-emr-${CACHE_VERSION}`;

// Only the minimal offline shell is precached. App code (hashed JS/CSS) and
// API data are ALWAYS fetched from the network when online.
const STATIC_ASSETS = [
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install - precache offline shell, activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate - delete every old cache so poisoned/stale builds are removed
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never touch non-GET, API calls, or cross-origin requests
  if (request.method !== 'GET') return;
  if (url.pathname.startsWith('/api')) return;
  if (url.origin !== location.origin) return;

  // Navigations (HTML) and app code: NETWORK-ONLY, fall back to cache only when
  // truly offline. This prevents ever serving a stale app shell/build online.
  const isNavigation = request.mode === 'navigate';

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful static-asset responses for offline use, but do NOT
        // cache navigations (so the shell is always fresh online).
        if (response.status === 200 && !isNavigation) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          if (isNavigation) return caches.match('/index.html');
          return new Response('Offline', { status: 503 });
        })
      )
  );
});

// Push notifications (future use)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'Clinic EMR', {
        body: data.body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        vibrate: [100, 50, 100],
        data: { url: data.url || '/' }
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data.url || '/'));
});
