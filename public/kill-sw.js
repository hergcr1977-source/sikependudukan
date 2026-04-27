// kill-sw.js — File ini TIDAK di-cache oleh SW lama karena nama berbeda
// Bertugas: unregister SW lama + hapus semua cache + uninstall diri sendiri

self.addEventListener('install', function() {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(names.map(function(n) { return caches.delete(n); }));
    }).then(function() {
      return self.registration.unregister();
    })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(fetch(event.request));
});
