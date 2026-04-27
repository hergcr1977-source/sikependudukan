// sw.js v3 — Aggressive update: hapus cache, network-only, reload semua tab
// Browser SELALU fetch file ini dari network (bypass cache SW lama) untuk cek update

self.addEventListener('install', function() {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(names.map(function(n) { return caches.delete(n); }));
    }).then(function() {
      return self.clients.claim();
    }).then(function() {
      return self.clients.matchAll();
    }).then(function(clients) {
      clients.forEach(function(client) {
        // Kirim pesan ke semua tab untuk reload
        client.postMessage({ type: 'SW_UPDATED' });
      });
    })
  );
});

self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// FETCH: navigasi selalu ke network, tidak cache apapun
self.addEventListener('fetch', function(event) {
  event.respondWith(fetch(event.request));
});
