const CACHE_NAME = 'sikependudukan-v2';
const STATIC_ASSETS = [
  '/login',
];

// Install: hanya cache halaman login (aman untuk offline)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: hapus cache versi lama
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isNavigation = event.request.mode === 'navigate';
  const isApi = url.pathname.startsWith('/api/');

  // API: selalu network, jangan cache
  if (isApi) return;

  // Navigasi (halaman): NETWORK FIRST
  // - Coba ambil dari network dulu (supaya middleware & auth selalu jalan)
  // - Kalau offline, baru fallback ke cache
  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            // Jangan cache halaman utama (butuh auth check setiap kali)
            // Cache halaman login saja
            if (url.pathname === '/login') {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse.clone());
              });
            }
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline: cek cache
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            // Fallback ke login jika offline
            return caches.match('/login');
          });
        })
    );
    return;
  }

  // Static assets (_next, images, dll): CACHE FIRST
  if (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/logo')) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        if (response) return response;
        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) return networkResponse;
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        }).catch(() => {
          return new Response('Offline', { status: 503 });
        });
      })
    );
    return;
  }

  // Lainnya: NETWORK FIRST dengan cache fallback
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) return networkResponse;
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((response) => {
          if (response) return response;
          return new Response('Offline', { status: 503 });
        });
      })
  );
});
