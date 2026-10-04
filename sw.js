/* InventoryKu service worker: menyimpan halaman aplikasi supaya bisa dibuka
   tanpa sinyal (spesifikasi sistem Bagian 11).
   SETIAP RILIS: naikkan VERSI di sini DAN VERSI_APLIKASI di app.js (nilainya
   sama). Nama cache ikut berubah, jadi HP mengambil versi baru dan cache lama
   dibuang. Permintaan ke API (POST ke Apps Script) tidak disentuh. */
'use strict';

var VERSI = '0.4.0';
var AWALAN_CACHE = 'inventoryku-';
var CACHE = AWALAN_CACHE + VERSI;

var FILE_APLIKASI = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './config.js',
  './manifest.webmanifest',
  './fonts/barlow-latin-400-normal.woff2',
  './fonts/barlow-latin-500-normal.woff2',
  './fonts/barlow-latin-600-normal.woff2',
  './fonts/barlow-condensed-latin-600-normal.woff2',
  './icons/ikon-180.png',
  './icons/ikon-192.png',
  './icons/ikon-512.png',
  './icons/ikon-maskable-192.png',
  './icons/ikon-maskable-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) {
        // cache: 'reload' supaya yang tersimpan adalah file terbaru dari server, bukan dari cache HTTP.
        return cache.addAll(FILE_APLIKASI.map(function (url) {
          return new Request(url, { cache: 'reload' });
        }));
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (nama) {
        return Promise.all(nama.filter(function (n) {
          return n.indexOf(AWALAN_CACHE) === 0 && n !== CACHE;
        }).map(function (n) {
          return caches.delete(n);
        }));
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // config.js (alamat API) bisa diubah pemilik tanpa rilis baru: ambil dari jaringan dulu.
  if (url.pathname.slice(-10) === '/config.js') {
    event.respondWith(jaringanDulu(req));
    return;
  }

  // Halaman: selalu index.html dari cache (aplikasi satu halaman).
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html', { cacheName: CACHE }).then(function (res) {
        return res || fetch(req);
      })
    );
    return;
  }

  event.respondWith(
    caches.match(req, { ignoreSearch: true, cacheName: CACHE }).then(function (res) {
      return res || fetch(req);
    })
  );
});

/** Jaringan dulu dengan batas 4 detik; jika gagal, pakai salinan di cache. */
function jaringanDulu(req) {
  return new Promise(function (selesai) {
    var sudah = false;
    function pakaiCache() {
      if (sudah) return;
      caches.match(req, { ignoreSearch: true, cacheName: CACHE }).then(function (res) {
        if (res && !sudah) {
          sudah = true;
          selesai(res);
        }
      });
    }
    var penghitung = setTimeout(pakaiCache, 4000);
    fetch(req, { cache: 'no-cache' }).then(function (res) {
      clearTimeout(penghitung);
      if (res && res.ok) {
        var salinan = res.clone();
        caches.open(CACHE).then(function (cache) {
          cache.put(req, salinan);
        });
      }
      if (!sudah) {
        sudah = true;
        selesai(res);
      }
    }).catch(function () {
      clearTimeout(penghitung);
      caches.match(req, { ignoreSearch: true, cacheName: CACHE }).then(function (res) {
        if (!sudah) {
          sudah = true;
          selesai(res || Response.error());
        }
      });
    });
  });
}
