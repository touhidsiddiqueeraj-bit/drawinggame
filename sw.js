/*
 * Draw & Learn — sw.js
 * Cache-first offline shell. Bump CACHE_VERSION to force refresh.
 */
var CACHE_VERSION = 'draw-learn-v1.1.0';
var CORE = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/data.js',
  './js/audio.js',
  './js/fx.js',
  './js/game.js',
  './js/app.js',
  './assets/fonts/fredoka.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

var VOICE_CLIPS = (self.VOICE_CLIPS_LIST) || [];
/* audio files are cached lazily on first fetch (see fetch handler) */

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return cache.addAll(CORE).catch(function () { return Promise.resolve(); });
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_VERSION; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  // cache-first, then network (and cache the response for next time)
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(function (cached) {
      if (cached) return cached;
      return fetch(e.request).then(function (resp) {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          var copy = resp.clone();
          caches.open(CACHE_VERSION).then(function (cache) { cache.put(e.request, copy); });
        }
        return resp;
      }).catch(function () {
        return caches.match('./index.html');
      });
    })
  );
});
