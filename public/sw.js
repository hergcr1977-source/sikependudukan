// Self-unregistering Service Worker
// File ini hanya bertugas MENGHAPUS service worker lama dari browser
// Browser akan secara berkala cek update SW → mendapat file ini → unregister

self.addEventListener('install', function(event) {
  // Skip waiting, langsung aktivasi tanpa menunggu tab ditutup
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  // Hapus semua cache yang pernah dibuat
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.map(function(name) {
          return caches.delete(name);
        })
      );
    }).then(function() {
      // Unregister diri sendiri
      return self.registration.unregister();
    }).then(function() {
      // Beritahu semua clients untuk me-reload tanpa SW
      return self.clients.matchAll();
    }).then(function(clients) {
      clients.forEach(function(client) {
        client.postMessage({ type: 'SW_UNREGISTERED' });
      });
    })
  );
});

// Tangkap semua fetch dan jangan cache apapun
self.addEventListener('fetch', function(event) {
  // Pass through ke network, tanpa cache
  event.respondWith(fetch(event.request));
});
