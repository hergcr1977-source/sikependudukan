const CACHE_NAME = 'sikependudukan-v3';

// Install: hapus SEMUA cache lama, hanya cache /login
self.addEventListener('install', (event) => {
  // Hapus semua cache lama termasuk v1 dan v2
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.map((name) => caches.delete(name))
      );
    }).then(() => {
      return caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(['/login']);
      });
    })
  );
  self.skipWaiting();
});

// Activate: hapus cache lama dan claim semua clients segera
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      // Force take control dari semua tabs segera
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Hanya handle GET
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // API: selalu network, jangan cache sama sekali
  if (url.pathname.startsWith('/api/')) return;

  // Navigasi (halaman): NETWORK FIRST
  // Selalu coba network dulu supaya auth/middleware selalu jalan
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && (response.status === 200 || response.status === 302 || response.status === 307)) {
            // Jangan cache halaman selain /login
            if (url.pathname === '/login') {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, response.clone());
              });
            }
          }
          return response;
        })
        .catch(() => {
          // Offline: fallback ke /login dari cache
          return caches.match('/login').then((cached) => {
            return cached || new Response('Tidak ada koneksi internet', { status: 503 });
          });
        })
    );
    return;
  }

  // Static assets (_next, images, dll): CACHE FIRST
  if (url.pathname.startsWith('/_next/') || url.pathname.includes('/logo') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (!response || response.status !== 200) return response;
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, response.clone());
          });
          return response;
        }).catch(() => new Response('Offline', { status: 503 }));
      })
    );
    return;
  }

  // Lainnya: network first dengan cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response || response.status !== 200) return response;
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, response.clone());
        });
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Listen for messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
