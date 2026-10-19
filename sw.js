/* InventoryKu service worker: menyimpan halaman aplikasi supaya bisa dibuka
   tanpa sinyal (spesifikasi sistem Bagian 11).
   SETIAP RILIS: naikkan VERSI di sini DAN VERSI_APLIKASI di app.js (nilainya
   sama). Nama cache ikut berubah, jadi HP mengambil versi baru dan cache lama
   dibuang. Permintaan ke API (POST ke Apps Script) tidak disentuh. */
'use strict';

var VERSI = '0.25.0';
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

  // config.js (alamat API) bisa diubah pemilik tanpa rilis baru. Salinan di HP dipakai langsung
  // supaya aplikasi tidak menunggu jaringan saat dibuka (aplikasi 0.15.1); salinannya diperbarui
  // di latar, jadi alamat baru terpakai pada pembukaan berikutnya.
  if (url.pathname.slice(-10) === '/config.js') {
    event.respondWith(cacheLaluPerbarui(event, req));
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

/** Salinan di cache langsung dipakai dan diperbarui dari jaringan di latar; tanpa salinan, jaringan dulu. */
function cacheLaluPerbarui(event, req) {
  return caches.match(req, { ignoreSearch: true, cacheName: CACHE }).then(function (simpanan) {
    if (!simpanan) return jaringanDulu(req);
    event.waitUntil(fetch(req, { cache: 'no-cache' }).then(function (res) {
      if (res && res.ok) {
        return caches.open(CACHE).then(function (cache) { return cache.put(req, res); });
      }
    }).catch(function () { /* tanpa sinyal: salinan lama tetap dipakai */ }));
    return simpanan;
  });
}

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

/* Notifikasi ke HP (aplikasi 0.20.0): isi dari server berupa JSON { judul, isi, url, tag }. */
self.addEventListener('push', function (event) {
  var d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch (err) {
    d = { judul: 'InventoryKu', isi: event.data ? event.data.text() : '' };
  }
  event.waitUntil(self.registration.showNotification(d.judul || 'InventoryKu', {
    body: d.isi || '',
    icon: './icons/ikon-192.png',
    badge: './icons/ikon-192.png',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    data: { url: d.url || '#/' },
    lang: 'id'
  }));
});

/** Ketuk notifikasi: buka aplikasi (jendela yang sudah ada dipakai) di alamat tujuannya. */
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var hash = (event.notification.data && event.notification.data.url) || '#/';
  var tujuan = new URL('./' + (hash.charAt(0) === '#' ? hash : '#/'), self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (jendela) {
    for (var i = 0; i < jendela.length; i++) {
      var j = jendela[i];
      if (j.url.indexOf(self.registration.scope) === 0 && 'focus' in j) {
        return j.focus().then(function (fokus) {
          return fokus && 'navigate' in fokus ? fokus.navigate(tujuan) : fokus;
        });
      }
    }
    return self.clients.openWindow(tujuan);
  }));
});
