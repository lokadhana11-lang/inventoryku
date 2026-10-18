/* InventoryKu — frontend (Tahap 1: kerangka PWA dan akses; Tahap 2: form Stock;
   Tahap 3: Riwayat, pemeriksaan, dan koreksi; Tahap 4: laporan PDF;
   5 Oktober 2026: tombol Keluar, keluar otomatis, hapus staff, PDF stock per kategori;
   Tahap 5: form Waste dan Suhu; Tahap 6: Prep List, resep, masa simpan;
   Tahap 7: Dashboard dan Pengaturan → Item, Unit, Kategori dan satuan, Outlet dan jadwal;
   Tahap 8: stock opname dan daftar belanja; Tahap 9: form kustom dan Pengaturan → Form;
   Tahap 10: rekap bulanan di menu Laporan).
   Tanpa framework, tanpa langkah build. Semua teks antarmuka mengikuti
   spesifikasi tampilan Bagian 7. */
(function () {
  'use strict';

  /** Versi aplikasi. SETIAP RILIS naikkan ini DAN VERSI di sw.js (nilainya sama). */
  var VERSI_APLIKASI = '0.24.0';

  var TEKS_BELUM_DIISI = 'GANTI_DENGAN_URL_WEB_APP';
  var BATAS_WAKTU_MS = 30000;
  var PANJANG_PIN = 6;
  var AWALAN = 'inventoryku:';

  var PESAN = {
    configTidakTermuat: 'File config.js tidak termuat. Pastikan config.js ada di samping index.html.',
    alamatBelumDiisi: 'Alamat API belum diisi di config.js',
    alamatBukanHttps: 'Alamat API di config.js harus diawali https://. Salin ulang alamat Web App dari Apps Script.',
    tidakAdaSinyal: 'Tidak ada sinyal. Periksa sambungan internet, lalu coba lagi.',
    tidakTerhubung: 'Server tidak bisa dihubungi. Periksa sinyal, alamat API di config.js, dan setelan deploy Web App (akses: Anyone), lalu coba lagi.',
    terlaluLama: 'Server tidak menjawab dalam 30 detik. Coba lagi.',
    ditolak: 'Server menolak permintaan. Periksa alamat API di config.js: harus alamat Web App yang berakhiran /exec.',
    jawabanTidakDikenal: 'Jawaban server tidak dikenali. Periksa alamat API di config.js: harus alamat Web App yang berakhiran /exec.',
    gagalUmum: 'Server menolak permintaan. Coba lagi.',
    sesiBerakhir: 'Sesi berakhir. Masuk lagi dengan PIN.',
    formBelumDibangun: 'Form ini dibangun di tahap berikutnya.',
    pinHarus6: 'PIN harus 6 angka.',
    pinTidakSama: 'Ulangi PIN tidak sama dengan PIN. Ketik ulang.',
    pinLemah: 'PIN ini terlalu mudah ditebak (angka sama, berurutan, atau berulang). Pilih 6 angka lain.',
    lupaPinTerkirim: 'Permintaan terkirim. Minta PIN baru ke Head Kitchen atau Manager.',
    memperbarui: 'Memperbarui…',
    iphoneTidakBisaSimpan: 'iPhone ini belum bisa menyimpan file dari aplikasi. Buka alamat website di Safari, lalu unduh dari sana.'
  };

  /* =======================================================================
   * Penyimpanan di HP (localStorage). Draft, antrean kirim, dan data yang
   * tersimpan selalu per pengguna, supaya HP yang dipakai bergantian tidak
   * memperlihatkan isian orang lain.
   * ===================================================================== */

  var Simpan = {
    baca: function (kunci) {
      try {
        var teks = window.localStorage.getItem(kunci);
        return teks == null ? null : JSON.parse(teks);
      } catch (err) {
        return null;
      }
    },
    tulis: function (kunci, nilai) {
      try {
        window.localStorage.setItem(kunci, JSON.stringify(nilai));
      } catch (err) {
        /* penyimpanan penuh atau dimatikan: aplikasi tetap jalan */
      }
    },
    hapus: function (kunci) {
      try {
        window.localStorage.removeItem(kunci);
      } catch (err) {
        /* abaikan */
      }
    }
  };

  function kunciPengguna(nama, bagian) {
    return AWALAN + 'p:' + encodeURIComponent(String(nama).toLowerCase()) + ':' + bagian;
  }

  /** Sesi di HP: { token, berlakuSampai, pengguna: { nama, role, pengelola }, namaOutlet }. */
  var Sesi = {
    baca: function () {
      var s = Simpan.baca(AWALAN + 'sesi');
      if (!s || !s.token || !s.pengguna || !s.pengguna.nama || !s.berlakuSampai) return null;
      if (!(Date.parse(s.berlakuSampai) > Date.now())) return null;
      return s;
    },
    tulis: function (s) {
      Simpan.tulis(AWALAN + 'sesi', s);
    },
    hapus: function () {
      Simpan.hapus(AWALAN + 'sesi');
    }
  };

  function penggunaKini() {
    var s = Sesi.baca();
    return s ? s.pengguna : null;
  }

  /** Draft per pengguna: { data, waktu }. */
  var Draft = {
    baca: function (id) {
      var p = penggunaKini();
      return p ? Simpan.baca(kunciPengguna(p.nama, 'draft:' + id)) : null;
    },
    simpan: function (id, data) {
      var p = penggunaKini();
      if (!p) return null;
      var isi = { data: data, waktu: Date.now() };
      Simpan.tulis(kunciPengguna(p.nama, 'draft:' + id), isi);
      return isi.waktu;
    },
    hapus: function (id) {
      var p = penggunaKini();
      if (p) Simpan.hapus(kunciPengguna(p.nama, 'draft:' + id));
    }
  };

  /**
   * Antrean kirim per pengguna (spesifikasi sistem Bagian 7.2 dan 11). Entri:
   * { id (= submissionId), aksi, isi, formId, judul, tanggal, dibuat,
   *   status: menunggu | gagal, pesan }. Isian selalu dikirim atas nama
   *   pengisinya: hanya antrean pengguna yang sedang masuk yang dikirim.
   */
  var Antrean = {
    daftar: function (nama) {
      var isi = Simpan.baca(kunciPengguna(nama, 'antrean'));
      return Array.isArray(isi) ? isi : [];
    },
    jumlah: function (nama) {
      return Antrean.daftar(nama).length;
    },
    simpan: function (nama, daftar) {
      Simpan.tulis(kunciPengguna(nama, 'antrean'), daftar);
    },
    tambah: function (nama, entri) {
      var daftar = Antrean.daftar(nama);
      if (!daftar.some(function (e) { return e.id === entri.id; })) daftar.push(entri);
      Antrean.simpan(nama, daftar);
    },
    hapus: function (nama, id) {
      Antrean.simpan(nama, Antrean.daftar(nama).filter(function (e) { return e.id !== id; }));
    },
    ubah: function (nama, id, perubahan) {
      Antrean.simpan(nama, Antrean.daftar(nama).map(function (e) {
        return e.id === id ? Object.assign({}, e, perubahan) : e;
      }));
    }
  };

  /**
   * Foto bukti waste di HP (Tahap 11). localStorage terlalu kecil untuk foto, jadi
   * foto disimpan di IndexedDB, satu catatan { data (base64 JPEG), mime, ukuran,
   * waktu } per foto dengan kunci "<pengguna>|<id>"; draft dan antrean hanya
   * menyimpan id-nya. FotoHp.siap: null (belum diperiksa), true, atau false
   * (IndexedDB tidak ada atau ditolak browser: foto tidak bisa ditambahkan,
   * waste tetap bisa dikirim tanpa foto).
   */
  var FotoHp = (function () {
    var NAMA_DB = 'inventoryku-foto';
    var TOKO = 'foto';
    var janji = null;
    var api = { siap: null };
    function buka() {
      if (janji) return janji;
      janji = new Promise(function (ok, gagal) {
        var r;
        try {
          if (!window.indexedDB) throw new Error('IndexedDB tidak tersedia');
          r = window.indexedDB.open(NAMA_DB, 1);
        } catch (err) {
          gagal(err);
          return;
        }
        r.onupgradeneeded = function () { r.result.createObjectStore(TOKO); };
        r.onsuccess = function () { ok(r.result); };
        r.onerror = function () { gagal(r.error || new Error('IndexedDB gagal dibuka')); };
        r.onblocked = function () { gagal(new Error('IndexedDB terhalang')); };
      });
      janji.then(function () { api.siap = true; }, function () { api.siap = false; });
      return janji;
    }
    function awalan() {
      var p = penggunaKini();
      return (p ? p.nama : '') + '|';
    }
    function jalankan(mode, kerja) {
      return buka().then(function (db) {
        return new Promise(function (ok, gagal) {
          var tx = db.transaction(TOKO, mode);
          var hasil;
          var r = kerja(tx.objectStore(TOKO));
          if (r) r.onsuccess = function () { hasil = r.result; };
          tx.oncomplete = function () { ok(hasil); };
          tx.onerror = tx.onabort = function () { gagal(tx.error || new Error('Penyimpanan foto gagal')); };
        });
      });
    }
    api.periksa = function () {
      return buka().then(function () { return true; }, function () { return false; });
    };
    api.simpan = function (id, isi) {
      return jalankan('readwrite', function (t) { return t.put(isi, awalan() + id); });
    };
    api.baca = function (id) {
      return jalankan('readonly', function (t) { return t.get(awalan() + id); }).catch(function () { return null; });
    };
    api.hapus = function (ids) {
      ids = [].concat(ids || []).filter(Boolean);
      if (!ids.length) return Promise.resolve();
      var a = awalan();
      return jalankan('readwrite', function (t) {
        ids.forEach(function (id) { t.delete(a + id); });
      }).catch(function () {});
    };
    /** Membuang foto pengguna ini yang tidak dirujuk draft atau antrean lagi. */
    api.bersihkan = function (dipakai) {
      var a = awalan();
      var pakai = {};
      dipakai.forEach(function (id) { pakai[a + id] = true; });
      return jalankan('readwrite', function (t) {
        var r = t.openCursor();
        r.onsuccess = function () {
          var c = r.result;
          if (!c) return;
          if (String(c.key).indexOf(a) === 0 && !pakai[c.key]) c.delete();
          c.continue();
        };
      }).catch(function () {});
    };
    return api;
  })();

  /** Data server yang tersimpan di HP per pengguna: { data, waktu }. */
  var Cache = {
    baca: function (kunci) {
      var p = penggunaKini();
      return p ? Simpan.baca(kunciPengguna(p.nama, 'cache:' + kunci)) : null;
    },
    tulis: function (kunci, data) {
      var p = penggunaKini();
      if (p) Simpan.tulis(kunciPengguna(p.nama, 'cache:' + kunci), { data: data, waktu: Date.now() });
    }
  };

  /* =======================================================================
   * API
   * ===================================================================== */

  // Server pindah (Apps Script → Supabase): server lama menjawab pindahKe; alamat baru dipakai selama config.js
  // di HP ini masih berisi alamat lama (config.js baru datang di latar, butir 196).
  var KUNCI_PINDAH_API = 'inventoryku:pindahApi';

  function alamatConfig() {
    if (typeof API_URL === 'undefined') {
      throw new Error(PESAN.configTidakTermuat);
    }
    var alamat = String(API_URL || '').trim();
    if (alamat === '' || alamat === TEKS_BELUM_DIISI) {
      throw new Error(PESAN.alamatBelumDiisi);
    }
    if (alamat.indexOf('https://') !== 0) {
      throw new Error(PESAN.alamatBukanHttps);
    }
    return alamat;
  }

  function alamatApi() {
    var alamat = alamatConfig();
    var pindah = Simpan.baca(KUNCI_PINDAH_API);
    if (pindah && pindah.dari === alamat && typeof pindah.ke === 'string' && pindah.ke.indexOf('https://') === 0) return pindah.ke;
    if (pindah) Simpan.hapus(KUNCI_PINDAH_API);
    return alamat;
  }

  /**
   * Memanggil satu aksi API. Body berupa JSON.stringify dengan satu-satunya
   * header Content-Type: text/plain;charset=utf-8, supaya browser tidak
   * mengirim preflight CORS (Apps Script tidak melayaninya; Supabase tidak membutuhkannya). Token sesi ikut
   * di dalam body.
   * Berhasil: mengembalikan isi field "data". Gagal: melempar Error berisi
   * pesan berbahasa Indonesia yang siap ditampilkan; err.sesiBerakhir = true
   * jika server menolak token.
   */
  function panggilApi(aksi, isi, opsi) {
    var alamat;
    try {
      alamat = alamatApi();
    } catch (err) {
      return Promise.reject(err);
    }
    if (navigator.onLine === false) {
      return Promise.reject(galatJaringan(PESAN.tidakAdaSinyal));
    }

    var body = Object.assign({}, isi || {}, { action: aksi });
    if (body.token === undefined) {
      var sesi = Sesi.baca();
      if (sesi) body.token = sesi.token;
    }
    var kendali = typeof AbortController === 'function' ? new AbortController() : null;
    var habisWaktu = false;
    var penghitung = setTimeout(function () {
      habisWaktu = true;
      if (kendali) kendali.abort();
    }, (opsi && opsi.batasWaktuMs) || BATAS_WAKTU_MS);

    return fetch(alamat, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      signal: kendali ? kendali.signal : undefined
    })
      .then(function (respons) {
        if (!respons.ok) throw galatJaringan(PESAN.ditolak);
        return respons.text();
      }, function () {
        throw galatJaringan(habisWaktu ? PESAN.terlaluLama : PESAN.tidakTerhubung);
      })
      .then(function (teks) {
        var json;
        try {
          json = JSON.parse(teks);
        } catch (err) {
          throw galatJaringan(PESAN.jawabanTidakDikenal);
        }
        if (!json || typeof json !== 'object' || typeof json.ok !== 'boolean') {
          throw galatJaringan(PESAN.jawabanTidakDikenal);
        }
        if (!json.ok && typeof json.pindahKe === 'string' && json.pindahKe.indexOf('https://') === 0 &&
            json.pindahKe !== alamat && !(opsi && opsi.dialihkan)) {
          Simpan.tulis(KUNCI_PINDAH_API, { dari: alamatConfig(), ke: json.pindahKe });
          return panggilApi(aksi, isi, Object.assign({}, opsi || {}, { dialihkan: true }));
        }
        if (!json.ok) {
          var galat = new Error(typeof json.pesan === 'string' && json.pesan ? json.pesan : PESAN.gagalUmum);
          if (json.sesiBerakhir) galat.sesiBerakhir = true;
          throw galat;
        }
        return json.data || {};
      })
      .catch(function (err) {
        if (habisWaktu) throw galatJaringan(PESAN.terlaluLama);
        throw err;
      })
      .finally(function () {
        clearTimeout(penghitung);
      });
  }

  /**
   * Galat sambungan (sinyal, batas waktu, jawaban bukan dari API). Isian yang
   * gagal karena ini masuk antrean dan dikirim ulang; server menolak kiriman
   * ganda lewat submissionId, jadi kirim ulang aman.
   */
  function galatJaringan(pesan) {
    var err = new Error(pesan);
    err.jaringan = true;
    return err;
  }

  /** Token ditolak server: kembali ke layar Login. Mengembalikan true jika ditangani. */
  function tanganiSesiBerakhir(err) {
    if (err && err.sesiBerakhir) {
      keluarLokal(PESAN.sesiBerakhir);
      return true;
    }
    return false;
  }

  function pesanGalat(err) {
    return (err && err.message) || PESAN.gagalUmum;
  }

  /* =======================================================================
   * DOM, ikon, dan format
   * ===================================================================== */

  function $(pilih, akar) {
    return (akar || document).querySelector(pilih);
  }

  /** Membuat elemen. Teks selalu lewat textContent; "html" hanya untuk SVG tetap di file ini. */
  function el(tag, atribut, anak) {
    var e = document.createElement(tag);
    if (atribut) {
      Object.keys(atribut).forEach(function (k) {
        var v = atribut[k];
        if (v == null || v === false) return;
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k.indexOf('on') === 0 && typeof v === 'function') e.addEventListener(k.slice(2), v);
        else if (v === true) e.setAttribute(k, '');
        else e.setAttribute(k, String(v));
      });
    }
    tambahAnak(e, anak);
    return e;
  }

  function tambahAnak(e, anak) {
    [].concat(anak == null ? [] : anak).forEach(function (c) {
      if (c == null || c === false) return;
      if (Array.isArray(c)) {
        tambahAnak(e, c); // daftar di dalam daftar ikut diratakan
        return;
      }
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }

  function kosongkan(e) {
    while (e.firstChild) e.removeChild(e.firstChild);
    return e;
  }

  var IKON = {
    beranda: '<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9v11h5v-6h3v6h5V9"/>',
    riwayat: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4.5v4h4"/><path d="M12 7.5V12l3 2"/>',
    laporan: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h6"/>',
    dashboard: '<path d="M3.5 20.5h17"/><path d="M6.5 17v-5M11 17V6.5M15.5 17v-8M20 17v-3"/>',
    pengaturan: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    pengguna: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
    staff: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8M17.5 14a6.5 6.5 0 0 1 4 6"/>',
    email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
    kanan: '<path d="m9 6 6 6-6 6"/>',
    kiri: '<path d="m15 6-6 6 6 6"/>',
    atas: '<path d="m6 15 6-6 6 6"/>',
    bawah: '<path d="m6 9 6 6 6-6"/>',
    hapusAngka: '<path d="M9 5h11v14H9l-6-7z"/><path d="m12.5 9.5 5 5M17.5 9.5l-5 5"/>',
    centang: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/>',
    seru: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/>',
    tiket: '<path d="M5 4h14v16H5z"/><path d="M8.5 9h7M8.5 13h7M8.5 17h4"/>',
    bendera: '<path d="M5.5 21V4"/><path d="M5.5 4.5h11l-2.5 4 2.5 4h-11"/>',
    filter: '<path d="M4 5.5h16l-6.25 7.5v5.5l-3.5 1.75V13z"/>',
    kunci: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/>',
    bukaKunci: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 6.8-1.2"/>',
    pensil: '<path d="M15.5 4.5l4 4L9 19H5v-4z"/><path d="M13 7l4 4"/>',
    sesuaikan: '<path d="M12 4v16M5 20h14"/><path d="M5 7.5h14"/><path d="M5 7.5 2.5 14h5zM19 7.5 16.5 14h5z"/>',
    nihil: '<circle cx="12" cy="12" r="8.5"/><path d="M6 18 18 6"/>',
    opname: '<path d="M8 4.5h8v3H8z"/><path d="M16 5.5h2.5V21h-13V5.5H8"/><path d="m9 14 2 2 4-4.5"/>',
    hp: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>',
    keluar: '<path d="M13.5 4.5h-7v15h7"/><path d="M10 12h10.5M17 8.5l3.5 3.5-3.5 3.5"/>',
    tambah: '<path d="M12 5v14M5 12h14"/>',
    sampah: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/><path d="M10.5 11v5.5M13.5 11v5.5"/>',
    termometer: '<path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z"/><path d="M12 9v7"/>',
    jam: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    resep: '<path d="M3.5 11.5h17"/><path d="M5 11.5v1.5a7 7 0 0 0 14 0v-1.5"/><path d="M9 4.5c-1 1.2 1 2.3 0 3.5M13 4.5c-1 1.2 1 2.3 0 3.5"/>',
    truk: '<path d="M2.5 6h11v10.5h-11z"/><path d="M13.5 9.5h4l3 3.5v3.5h-7"/><circle cx="6.5" cy="17.5" r="1.75"/><circle cx="16.5" cy="17.5" r="1.75"/>',
    kotak: '<path d="M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4z"/><path d="M3.5 7.5 12 11.5l8.5-4M12 11.5v9"/>',
    label: '<path d="M3.5 12.5v-8h8l9 9-8 8z"/><circle cx="8" cy="9" r="1.5"/>',
    titikTiga: '<path d="M12 5.5v.01M12 12v.01M12 18.5v.01" stroke-width="3"/>',
    segitiga: '<path d="M12 3.5 21.5 20h-19z"/><path d="M12 10v4.5M12 17.5h.01"/>',
    naik: '<path d="M7 17 17 7M9.5 7H17v7.5"/>',
    turun: '<path d="M7 7l10 10M17 9.5V17H9.5"/>',
    lonceng: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    kamera: '<path d="M3.5 8.5a2 2 0 0 1 2-2h2.5l1.5-2.5h5l1.5 2.5h2.5a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/>'
  };

  /** Ikon kecil 16 px untuk tanda status. */
  var IKON_STATUS = {
    baik: '<path d="M3.5 8.5l3 3 6-7"/>',
    masalah: '<circle cx="8" cy="8" r="6.25"/><path d="M8 4.75v3.75M8 11.25v.01"/>',
    tinjau: '<path d="M8 2.25 14.5 13.5h-13z"/><path d="M8 6.5v3M8 11.5v.01"/>',
    menunggu: '<circle cx="8" cy="8" r="6.25"/><path d="M8 4.75V8.25l2.25 1.5"/>'
  };

  function ikon(nama, kelas) {
    var t = document.createElement('template');
    t.innerHTML = '<svg class="ikon' + (kelas ? ' ' + kelas : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      IKON[nama] + '</svg>';
    return t.content.firstChild;
  }

  function ikonStatus(jenis) {
    var t = document.createElement('template');
    t.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' + IKON_STATUS[jenis] + '</svg>';
    return t.content.firstChild;
  }

  /** Tanda status: kapsul ikon + kata. jenis: baik | masalah | tinjau | menunggu. */
  function tandaStatus(jenis, kata) {
    return el('span', { class: 'tanda-status tanda-' + jenis }, [ikonStatus(jenis), el('span', { text: kata })]);
  }

  var NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  var NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus',
    'September', 'Oktober', 'November', 'Desember'];
  var BULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  function duaAngka(n) {
    return (n < 10 ? '0' : '') + n;
  }

  /** "Minggu, 4 Oktober" */
  function tanggalPanjang(d) {
    return NAMA_HARI[d.getDay()] + ', ' + d.getDate() + ' ' + NAMA_BULAN[d.getMonth()];
  }

  /** Tanggal hari ini menurut perangkat: "2026-10-04". */
  function tanggalIso(d) {
    return d.getFullYear() + '-' + duaAngka(d.getMonth() + 1) + '-' + duaAngka(d.getDate());
  }

  /** "08.10" (jam perangkat). */
  function jam(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return duaAngka(d.getHours()) + '.' + duaAngka(d.getMinutes());
  }

  /** "pukul 08.10" untuk hari ini, "3 Okt pukul 08.10" untuk hari lain. */
  function waktuSingkat(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    if (tanggalIso(d) === tanggalIso(new Date())) return 'pukul ' + jam(iso);
    return d.getDate() + ' ' + BULAN_SINGKAT[d.getMonth()] + ' pukul ' + jam(iso);
  }

  /** Isian angka: menerima koma maupun titik. Kosong → null; tidak sah → NaN. */
  function bacaAngka(teks) {
    var t = String(teks == null ? '' : teks).replace(/\s/g, '');
    if (t === '') return null;
    if (!/^\d+([.,]\d+)?$/.test(t)) return NaN;
    return Number(t.replace(',', '.'));
  }

  function bulat3(n) {
    return Math.round(n * 1000) / 1000;
  }

  /**
   * Rupiah yang diketik (harga beli): titik di antara kelompok tiga angka adalah pemisah ribuan
   * ("15.000" = 15000, "1.250.000,5"), selain itu sama dengan bacaAngka ("7,5", "7.5").
   * Kosong → null; tidak sah → NaN.
   */
  function bacaRupiah(teks) {
    var t = String(teks == null ? '' : teks).replace(/\s/g, '').replace(/^Rp\.?/i, '');
    if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(t)) return Number(t.replace(/\./g, '').replace(',', '.'));
    return bacaAngka(t);
  }

  var FORMAT_ANGKA = typeof Intl !== 'undefined' && Intl.NumberFormat
    ? new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 })
    : null;

  /** 1250.5 → "1.250,5"; minus memakai tanda − (spesifikasi tampilan Bagian 3). */
  function formatAngka(n) {
    if (n == null || !isFinite(n)) return '–';
    var r = bulat3(n);
    var teks = FORMAT_ANGKA ? FORMAT_ANGKA.format(Math.abs(r)) : String(Math.abs(r)).replace('.', ',');
    return (r < 0 ? '−' : '') + teks;
  }

  /** "12,5 kg" yang tidak pernah terpisah baris. */
  function angkaSatuan(n, satuan) {
    return el('span', { class: 'angka-satuan', text: formatAngka(n) + (satuan ? ' ' + satuan : '') });
  }

  /** Tanda pengenal kiriman (submission_id), dibuat di HP. */
  function buatId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }

  /** "3 Okt" */
  function tanggalPendek(iso) {
    var p = String(iso).split('-');
    return Number(p[2]) + ' ' + BULAN_SINGKAT[Number(p[1]) - 1];
  }

  /** "3 Okt 21.50" */
  function waktuPendek(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.getDate() + ' ' + BULAN_SINGKAT[d.getMonth()] + ' ' + jam(iso);
  }

  /** "Sabtu, 3 Oktober" dari "2026-10-03" (tahun ditulis jika bukan tahun ini). */
  function tanggalJudul(iso) {
    var p = String(iso).split('-');
    var teks = tanggalPanjang(new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
    return Number(p[0]) === new Date().getFullYear() ? teks : teks + ' ' + p[0];
  }

  function geserHari(iso, hari) {
    var p = String(iso).split('-');
    return tanggalIso(new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + hari));
  }

  function zonaWaktuPerangkat() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch (err) {
      return '';
    }
  }

  /* =======================================================================
   * Komponen bersama (spesifikasi tampilan Bagian 6). Dipakai semua layar.
   * ===================================================================== */

  /** Tombol dengan tempat indikator putar. jenis: utama | kedua | bahaya | tautan. */
  function tombol(teks, jenis, atribut) {
    var a = Object.assign({ type: 'button', class: 'tombol tombol-' + (jenis || 'kedua') }, atribut || {});
    if (atribut && atribut.class) a.class = 'tombol tombol-' + (jenis || 'kedua') + ' ' + atribut.class;
    return el('button', a, [
      el('span', { class: 'putar', 'aria-hidden': 'true' }),
      el('span', { class: 'tombol-teks', text: teks })
    ]);
  }

  /** Tombol saat memproses: langsung nonaktif, tulisan berganti, indikator putar tampil. */
  function aturTombolProses(t, sedangProses, teksProses) {
    var teks = t.querySelector('.tombol-teks');
    if (!t.dataset.teksAsli) t.dataset.teksAsli = teks.textContent;
    t.disabled = sedangProses;
    t.classList.toggle('sedang-proses', sedangProses);
    t.setAttribute('aria-busy', sedangProses ? 'true' : 'false');
    teks.textContent = sedangProses ? teksProses : t.dataset.teksAsli;
  }

  function gantiTeksTombol(t, teks) {
    t.dataset.teksAsli = teks;
    t.querySelector('.tombol-teks').textContent = teks;
  }

  /* ---------- Pesan singkat (toast): di atas bar navigasi, hilang setelah 4 detik ---------- */
  var toastKini = null;
  var toastPenghitung = null;

  function toast(pesan, jenis) {
    var wadah = $('#toast-wadah');
    if (toastKini) {
      toastKini.remove();
      clearTimeout(toastPenghitung);
    }
    var t = el('div', { class: 'toast muncul', role: 'status' }, [
      ikon(jenis === 'masalah' ? 'seru' : (jenis === 'info' ? 'info' : 'centang')),
      el('span', { text: pesan })
    ]);
    wadah.appendChild(t);
    toastKini = t;
    toastPenghitung = setTimeout(function () {
      t.classList.remove('muncul');
      t.classList.add('pergi');
      setTimeout(function () {
        t.remove();
        if (toastKini === t) toastKini = null;
      }, 210);
    }, 4000);
  }

  /* ---------- Lembar bawah (HP/tablet) dan dialog (desktop) ---------- */
  var lembarKini = null;

  /**
   * opsi: { judul, isi: Node|Node[], aksi: [{ teks, jenis, klik(tombol, lembar) }], diTutup(),
   *         lebar: true untuk tabel lebar (dialog desktop lebih lebar) }
   * Tombol aksi selalu terlihat; isi bergulir di dalam. Mengembalikan objek
   * { tutup(), sibuk(bool), elemen, tombol: [] }.
   */
  function bukaLembar(opsi) {
    if (lembarKini) lembarKini.tutup(true);
    var fokusSebelum = document.activeElement;
    var idJudul = 'lembar-judul-' + Date.now();
    var sedangSibuk = false;
    var tertutup = false;

    var isi = el('div', { class: 'lembar-isi' }, opsi.isi);
    var deretAksi = el('div', { class: 'lembar-aksi' });
    var lembar = el('div', { class: 'lembar' + (opsi.lebar ? ' lembar-lebar' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': idJudul }, [
      el('div', { class: 'lembar-kepala' }, el('h2', { class: 'lembar-judul', id: idJudul, text: opsi.judul })),
      isi,
      deretAksi
    ]);
    var lapisan = el('div', { class: 'lembar-lapisan' }, lembar);

    var hasil = {
      elemen: lembar,
      tombol: [],
      sibuk: function (b) {
        sedangSibuk = !!b;
      },
      tutup: function (langsung) {
        if (tertutup) return;
        tertutup = true;
        document.removeEventListener('keydown', tombolKeyboard, true);
        if (lembarKini === hasil) lembarKini = null;
        document.body.classList.remove('lembar-terbuka');
        function buang() {
          lapisan.remove();
        }
        if (langsung) {
          buang();
        } else {
          lapisan.classList.add('tutup');
          setTimeout(buang, 160);
        }
        if (fokusSebelum && document.contains(fokusSebelum) && typeof fokusSebelum.focus === 'function') {
          try {
            fokusSebelum.focus({ preventScroll: true });
          } catch (err) {
            fokusSebelum.focus();
          }
        }
        if (opsi.diTutup) opsi.diTutup();
      }
    };

    (opsi.aksi || []).forEach(function (a) {
      var t = tombol(a.teks, a.jenis || 'kedua');
      t.addEventListener('click', function () {
        if (t.disabled) return;
        if (a.klik) a.klik(t, hasil);
        else hasil.tutup();
      });
      deretAksi.appendChild(t);
      hasil.tombol.push(t);
    });

    function tombolKeyboard(e) {
      if (e.key === 'Escape' && !sedangSibuk) {
        e.preventDefault();
        hasil.tutup();
        return;
      }
      if (e.key === 'Tab') {
        var bisaFokus = Array.prototype.filter.call(
          lembar.querySelectorAll('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'),
          function (x) { return !x.disabled && x.offsetParent !== null; });
        if (!bisaFokus.length) return;
        var pertama = bisaFokus[0];
        var terakhir = bisaFokus[bisaFokus.length - 1];
        if (e.shiftKey && document.activeElement === pertama) {
          e.preventDefault();
          terakhir.focus();
        } else if (!e.shiftKey && document.activeElement === terakhir) {
          e.preventDefault();
          pertama.focus();
        }
      }
    }

    lapisan.addEventListener('click', function (e) {
      if (e.target === lapisan && !sedangSibuk) hasil.tutup();
    });
    document.addEventListener('keydown', tombolKeyboard, true);
    $('#lembar-wadah').appendChild(lapisan);
    document.body.classList.add('lembar-terbuka');
    lembarKini = hasil;

    var fokusAwal = lembar.querySelector('input:not([type=radio]):not(:disabled)') ||
      deretAksi.querySelector('button:last-child');
    if (fokusAwal) {
      // Di HP, papan ketik hanya dibuka jika pengguna mengetuk kolom.
      if (fokusAwal.tagName === 'INPUT' && apakahSentuh()) fokusAwal = deretAksi.querySelector('button:last-child');
      if (fokusAwal) fokusAwal.focus({ preventScroll: true });
    }
    return hasil;
  }

  /**
   * Konfirmasi dengan aksi yang butuh server. opsi: { judul, teks, peringatan
   * (teks tanda Perlu ditinjau, opsional), teksYa, teksProses, bahaya,
   * jalankan() → Promise }. Hasil: Promise berisi
   * jawaban jalankan(), atau null jika dibatalkan.
   */
  function konfirmasi(opsi) {
    return new Promise(function (selesai) {
      var sudah = false;
      var pesan = el('p', { class: 'pesan-formulir masalah', role: 'alert' });
      var lembar = bukaLembar({
        judul: opsi.judul,
        isi: [
          opsi.peringatan ? el('p', { class: 'pesan-formulir tinjau' }, [ikon('info'), el('span', { text: opsi.peringatan })]) : null,
          opsi.teks ? el('p', { text: opsi.teks }) : null,
          pesan
        ],
        aksi: [
          { teks: 'Batal', jenis: 'kedua' },
          {
            teks: opsi.teksYa,
            jenis: opsi.bahaya ? 'bahaya' : 'utama',
            klik: function (t, l) {
              if (!opsi.jalankan) {
                sudah = true;
                l.tutup();
                selesai(true);
                return;
              }
              tulisPesan(pesan, '');
              aturTombolProses(t, true, opsi.teksProses || 'Menyimpan…');
              l.sibuk(true);
              opsi.jalankan().then(function (data) {
                sudah = true;
                l.sibuk(false);
                l.tutup();
                selesai(data);
              }).catch(function (err) {
                l.sibuk(false);
                aturTombolProses(t, false);
                if (tanganiSesiBerakhir(err)) return;
                tulisPesan(pesan, pesanGalat(err), 'masalah');
              });
            }
          }
        ],
        diTutup: function () {
          if (!sudah) selesai(null);
        }
      });
      return lembar;
    });
  }

  /** Pesan di dalam formulir. jenis: masalah | baik | tinjau | info (petunjuk netral). */
  function tulisPesan(wadah, teks, jenis) {
    kosongkan(wadah);
    wadah.className = wadah.className.replace(/\b(masalah|baik|tinjau|info)\b/g, '').trim();
    if (!teks) return;
    wadah.classList.add(jenis || 'masalah');
    wadah.appendChild(ikon(jenis === 'baik' ? 'centang' : (jenis === 'tinjau' || jenis === 'info' ? 'info' : 'seru')));
    wadah.appendChild(el('span', { text: teks }));
  }

  /* ---------- Kolom isian ---------- */
  var nomorKolom = 0;

  /** Kolom isian berlabel. opsi: { label, type, inputmode, autocomplete, maxlength, bantuan, nilai, kelas, atribut } */
  function kolomIsian(opsi) {
    var id = 'kolom-' + (++nomorKolom);
    var atribut = Object.assign({
      id: id,
      class: 'isian' + (opsi.kelas ? ' ' + opsi.kelas : ''),
      type: opsi.type || 'text',
      inputmode: opsi.inputmode,
      autocomplete: opsi.autocomplete || 'off',
      maxlength: opsi.maxlength,
      'aria-describedby': id + '-galat' + (opsi.bantuan ? ' ' + id + '-bantuan' : '')
    }, opsi.atribut || {});
    var input = el('input', atribut);
    if (opsi.nilai != null) input.value = opsi.nilai;
    var galat = el('p', { class: 'kolom-galat', id: id + '-galat' });
    var wadah = el('div', { class: 'kolom' }, [
      el('label', { class: 'kolom-label', for: id, text: opsi.label }),
      opsi.bantuan ? el('p', { class: 'kolom-bantuan', id: id + '-bantuan', text: opsi.bantuan }) : null,
      input,
      galat
    ]);
    return {
      wadah: wadah,
      input: input,
      galat: function (pesan) {
        kosongkan(galat);
        input.setAttribute('aria-invalid', pesan ? 'true' : 'false');
        if (pesan) {
          galat.appendChild(ikonStatus('masalah'));
          galat.appendChild(el('span', { text: pesan }));
        }
        return !pesan;
      }
    };
  }

  function kolomPin(label) {
    return kolomIsian({
      label: label,
      type: 'password',
      inputmode: 'numeric',
      autocomplete: 'new-password',
      maxlength: PANJANG_PIN,
      kelas: 'isian-pin',
      atribut: { pattern: '[0-9]*' }
    });
  }

  var PIN_LEMAH_LAIN = ['112233', '111222', '123321', '147258', '258369', '159753', '147852', '102030'];

  /** PIN yang mudah ditebak; aturan sama dengan pinLemah_ di Code.gs (server tetap memeriksanya). */
  function pinLemah(pin) {
    for (var p = 1; p <= 3; p++) {
      if (pin.slice(p) === pin.slice(0, pin.length - p)) return true;
    }
    var naik = true;
    var turun = true;
    for (var i = 1; i < pin.length; i++) {
      var beda = pin.charCodeAt(i) - pin.charCodeAt(i - 1);
      if (beda !== 1 && beda !== -9) naik = false;
      if (beda !== -1 && beda !== 9) turun = false;
    }
    return naik || turun || PIN_LEMAH_LAIN.indexOf(pin) >= 0;
  }

  /** PIN 6 angka yang tidak mudah ditebak, dan ulangannya sama. */
  function periksaPinGanda(kPin, kUlang) {
    var pin = kPin.input.value;
    if (!/^\d{6}$/.test(pin)) {
      kPin.galat(PESAN.pinHarus6);
      kUlang.galat('');
      return false;
    }
    if (pinLemah(pin)) {
      kPin.galat(PESAN.pinLemah);
      kUlang.galat('');
      return false;
    }
    kPin.galat('');
    if (kUlang.input.value !== pin) {
      kUlang.galat(PESAN.pinTidakSama);
      return false;
    }
    kUlang.galat('');
    return true;
  }

  /** Pilihan berupa tombol berjajar (radio). */
  function grupPilihan(legenda, pilihan, nilai) {
    var nama = 'pilihan-' + (++nomorKolom);
    var input = [];
    var fieldset = el('fieldset', { class: 'pilihan-grup' }, [el('legend', { class: 'kolom-label', text: legenda })]);
    pilihan.forEach(function (p) {
      var i = el('input', { type: 'radio', name: nama, value: p });
      if (p === nilai) i.checked = true;
      input.push(i);
      fieldset.appendChild(el('label', { class: 'pilihan' }, [i, el('span', { text: p })]));
    });
    var galat = el('p', { class: 'kolom-galat' });
    var wadah = el('div', { class: 'kolom' }, [fieldset, galat]);
    return {
      wadah: wadah,
      input: input,
      nilai: function () {
        for (var i = 0; i < input.length; i++) if (input[i].checked) return input[i].value;
        return '';
      },
      nonaktif: function (b) {
        input.forEach(function (i) { i.disabled = b; });
      },
      galat: function (pesan) {
        kosongkan(galat);
        if (pesan) {
          galat.appendChild(ikonStatus('masalah'));
          galat.appendChild(el('span', { text: pesan }));
        }
        return !pesan;
      }
    };
  }

  /* ---------- Keadaan memuat ---------- */

  function kerangkaBaris(jumlah) {
    var wadah = el('div', { 'aria-hidden': 'true' });
    for (var i = 0; i < jumlah; i++) wadah.appendChild(el('span', { class: 'kerangka kerangka-baris' }));
    return wadah;
  }

  function kotakKosong(teks, namaIkon) {
    return el('div', { class: 'kosong' }, [ikon(namaIkon || 'info'), el('p', { text: teks })]);
  }

  function kotakGalat(teks, cobaLagi) {
    var t = tombol('Coba lagi', 'kedua', { onclick: cobaLagi });
    return el('div', { class: 'kosong', role: 'alert' }, [ikon('seru'), el('p', { text: teks }), t]);
  }

  /**
   * Pola bersama keadaan memuat (spesifikasi tampilan Bagian 6 dan
   * spesifikasi sistem Bagian 4.2):
   * 1. Ada data tersimpan di HP → langsung digambar, dengan tulisan kecil "Memperbarui…".
   * 2. Belum ada → kerangka abu-abu berbentuk kartu.
   * 3. Jawaban server digambar dan disimpan. Jika isinya sama dengan yang
   *    tersimpan, layar tidak digambar ulang (isian yang sedang diketik aman).
   *    Jika gagal, data lama tetap tampil dengan pesannya; tanpa data lama
   *    tampil pesan dan "Coba lagi".
   * opsi: { kunciCache, ambil() → Promise, gambar(data, dariHp), kerangka(),
   *         galat(pesan, cobaLagi), penanda: elemen .memperbarui,
   *         cukupSimpanan() → true jika data tersimpan baru saja datang dari server,
   *         dariHp() → data|null dan simpanHp(data) (pengganti kunciCache) }
   * Jawaban yang datang setelah pengguna pindah layar diabaikan.
   */
  function muatData(opsi) {
    var nomor = nomorLayar;
    var simpanan = null;
    if (opsi.dariHp) {
      var dariHp = opsi.dariHp();
      simpanan = dariHp ? { data: dariHp } : null;
    } else if (opsi.kunciCache) {
      simpanan = Cache.baca(opsi.kunciCache);
    }
    if (simpanan && opsi.cukupSimpanan && opsi.cukupSimpanan()) {
      // Data tersimpan baru saja datang dari server (misalnya bersama login): tidak perlu meminta lagi.
      opsi.gambar(simpanan.data, true);
      return Promise.resolve();
    }
    if (simpanan) {
      opsi.gambar(simpanan.data, true);
      if (opsi.penanda) opsi.penanda.textContent = PESAN.memperbarui;
    } else if (opsi.kerangka) {
      opsi.kerangka();
    }
    return opsi.ambil().then(function (data) {
      if (nomor !== nomorLayar) return;
      if (opsi.kunciCache) Cache.tulis(opsi.kunciCache, data);
      if (opsi.simpanHp) opsi.simpanHp(data);
      if (opsi.penanda) opsi.penanda.textContent = '';
      if (simpanan && JSON.stringify(simpanan.data) === JSON.stringify(data)) return;
      opsi.gambar(data, false);
    }).catch(function (err) {
      if (nomor !== nomorLayar) return;
      if (tanganiSesiBerakhir(err)) return;
      if (simpanan) {
        // Saat offline, pita sinyal sudah menjelaskan sebabnya.
        if (opsi.penanda) opsi.penanda.textContent = 'Belum diperbarui.' + (navigator.onLine === false ? '' : ' ' + pesanGalat(err));
      } else if (opsi.galat) {
        opsi.galat(pesanGalat(err), function () {
          muatData(opsi);
        });
      }
    });
  }

  /* =======================================================================
   * Sinyal, papan ketik, dan pita
   * ===================================================================== */

  function apakahSentuh() {
    return window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  }

  var pitaSinyal = null; // elemen pita; dipindah-pindah antara bar dan kepala Beranda

  function aturSinyal() {
    var online = navigator.onLine !== false;
    Array.prototype.forEach.call(document.querySelectorAll('.sinyal'), function (s) {
      s.textContent = online ? 'Online' : 'Offline';
      s.classList.toggle('online', online);
    });
    var pita = pitaSinyal;
    if (!pita) return;
    if (!online && pita.hidden) {
      pita.hidden = false;
      pita.classList.remove('pergi');
      pita.classList.add('muncul');
    } else if (online && !pita.hidden && !pita.classList.contains('pergi')) {
      pita.classList.remove('muncul');
      pita.classList.add('pergi');
      setTimeout(function () {
        if (navigator.onLine !== false) {
          pita.hidden = true;
          pita.classList.remove('pergi');
        }
      }, 210);
    }
  }

  function apakahIsianTeks(e) {
    if (!e || !e.tagName) return false;
    if (e.tagName === 'TEXTAREA' || e.isContentEditable) return true;
    return e.tagName === 'INPUT' &&
      !/^(checkbox|radio|button|submit|reset|range|color|file|hidden|image)$/i.test(e.type || '');
  }

  /** Kolom yang sedang diisi selalu terlihat utuh di atas papan ketik, bersama labelnya. */
  function jagaTerlihat(isian) {
    if (!isian || !document.contains(isian)) return;
    var kolom = isian.closest('.kolom') || isian;
    var r = kolom.getBoundingClientRect();
    var vv = window.visualViewport;
    var atas = vv ? vv.offsetTop : 0;
    var tinggi = vv ? vv.height : window.innerHeight;
    var bar = document.querySelector('.bar');
    var tutupAtas = bar && !$('#aplikasi').hidden ? bar.getBoundingClientRect().bottom : 0;
    var bawah = atas + tinggi;
    // Bilah kirim tidak boleh menutupi kolom yang sedang diisi.
    var bilah = !isian.closest('.lembar') && document.querySelector('#layar .bilah-kirim');
    if (bilah && bilah.offsetHeight) bawah = Math.min(bawah, bilah.getBoundingClientRect().top);
    if (r.top < atas + Math.max(0, tutupAtas) + 8 || r.bottom > bawah - 8) {
      kolom.scrollIntoView({ block: 'center' });
    }
  }

  /**
   * Papan ketik di HP: bar navigasi bawah disembunyikan selama kolom teks
   * difokus, dan tinggi papan ketik yang menutupi layar (iPhone) dicatat di
   * --papan-ketik supaya lembar bawah dan pesan singkat tetap di atasnya.
   */
  function pasangPapanKetik() {
    document.addEventListener('focusin', function (e) {
      if (!apakahSentuh() || !apakahIsianTeks(e.target)) return;
      document.body.classList.add('papan-ketik');
      setTimeout(function () { jagaTerlihat(e.target); }, 300);
    });
    document.addEventListener('focusout', function () {
      setTimeout(function () {
        if (!apakahIsianTeks(document.activeElement)) document.body.classList.remove('papan-ketik');
      }, 60);
    });
    var vv = window.visualViewport;
    if (!vv) return;
    var tertunda = null;
    function ukur() {
      var tutup = document.documentElement.clientHeight - (vv.height + vv.offsetTop);
      if (tutup < 80) tutup = 0;
      document.documentElement.style.setProperty('--papan-ketik', Math.round(tutup) + 'px');
      clearTimeout(tertunda);
      tertunda = setTimeout(function () {
        if (apakahIsianTeks(document.activeElement) && document.body.classList.contains('papan-ketik')) {
          jagaTerlihat(document.activeElement);
        }
      }, 100);
    }
    vv.addEventListener('resize', ukur);
    vv.addEventListener('scroll', ukur);
  }

  /* =======================================================================
   * Bingkai aplikasi: menu per role, penanda menu, judul
   * ===================================================================== */

  var MENU = [
    { id: 'beranda', label: 'Beranda', href: '#/', ikon: 'beranda' },
    { id: 'riwayat', label: 'Riwayat', href: '#/riwayat', ikon: 'riwayat' },
    { id: 'laporan', label: 'Laporan', href: '#/laporan', ikon: 'laporan' },
    { id: 'dashboard', label: 'Dashboard', href: '#/dashboard', ikon: 'dashboard', pengelola: true },
    { id: 'pengaturan', label: 'Pengaturan', href: '#/pengaturan', ikon: 'pengaturan', pengelola: true }
  ];

  var menuAktif = null;

  /** Menu yang bukan hak pengguna tidak ditampilkan sama sekali. */
  function gambarMenu() {
    var p = penggunaKini();
    var grup = kosongkan($('#menu-grup'));
    MENU.forEach(function (m) {
      if (m.pengelola && !(p && p.pengelola)) return;
      grup.appendChild(el('a', { class: 'menu-item', href: m.href, 'data-menu': m.id }, [
        ikon(m.ikon),
        el('span', { text: m.label })
      ]));
    });
    grup.insertBefore(el('span', { class: 'menu-pil', 'aria-hidden': 'true' }), grup.firstChild);
    grup.appendChild(el('span', { class: 'menu-penanda', 'aria-hidden': 'true' }));
    var outletMerek = $('#merek-outlet');
    if (outletMerek) outletMerek.textContent = (Sesi.baca() || {}).namaOutlet || '';
    var tombolBar = $('#bar-pengguna');
    kosongkan(tombolBar);
    if (p) {
      tombolBar.setAttribute('aria-label', p.nama + ', menu pengguna');
      tombolBar.setAttribute('aria-expanded', 'false');
      tambahAnak(tombolBar, [ikon('pengguna'), el('span', { text: p.nama }), ikon('bawah')]);
    }
    aturMenuAktif(menuAktif, true);
  }

  function aturMenuAktif(id, tanpaGerak) {
    menuAktif = id;
    var grup = $('#menu-grup');
    Array.prototype.forEach.call(grup.querySelectorAll('.menu-item'), function (a) {
      if (a.getAttribute('data-menu') === id) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    letakkanPenanda(tanpaGerak);
  }

  /**
   * Garis amber dan pil menu aktif digeser dengan transform (bukan left) supaya ringan.
   * Pil hanya di bar bawah (HP dan tablet), tempat semua menu sama lebar, jadi lebarnya
   * tidak ikut bergerak; di desktop pil tiap menu memudar di tempat (app.css).
   */
  function letakkanPenanda(tanpaGerak) {
    var grup = $('#menu-grup');
    var penanda = grup && grup.querySelector('.menu-penanda');
    if (!penanda) return;
    var aktif = grup.querySelector('[aria-current="page"]');
    var pil = grup.querySelector('.menu-pil');
    penanda.classList.toggle('tanpa-gerak', !!tanpaGerak);
    if (pil) {
      pil.classList.toggle('tanpa-gerak', !!tanpaGerak || !pil.classList.contains('terlihat'));
      if (aktif && aktif.offsetWidth) {
        pil.style.width = Math.max(0, aktif.offsetWidth - 8) + 'px';
        pil.style.transform = 'translateX(' + (aktif.offsetLeft + 4) + 'px)';
        pil.classList.add('terlihat');
      } else {
        pil.classList.remove('terlihat');
      }
    }
    if (!aktif || !aktif.offsetWidth) {
      penanda.style.transform = 'translateX(0) scaleX(0)';
      return;
    }
    var x = aktif.offsetLeft;
    var w = aktif.offsetWidth;
    if (window.matchMedia('(min-width: 1024px)').matches) {
      x += 12;
      w -= 24;
    } else {
      var lebar = Math.min(32, w);
      x += (w - lebar) / 2;
      w = lebar;
    }
    penanda.style.transform = 'translateX(' + x + 'px) scaleX(' + w + ')';
  }

  function aturJudul(judul) {
    $('#bar-judul').textContent = judul;
    document.title = judul === 'Beranda' ? 'InventoryKu' : judul + ' — InventoryKu';
    // Kepala layar tanpa judul sendiri memakai judul bar (pasangKepalaLayar).
    var dariBar = document.querySelector('#layar .kepala-layar .judul-layar[data-dari-bar]');
    if (dariBar) dariBar.textContent = judul;
  }

  /**
   * Kepala navy setiap layar (tampilan Bagian 4.7). Layar tetap menulis tautan kembali,
   * judul (h1.judul-layar atau .kepala-isi berisi judul dan tombol Tambah), dan ringkasan
   * (.kepala-ringkas) di awal .layar-isi seperti biasa; setelah layar digambar, ketiganya
   * dipindah (bukan disalin, jadi rujukan layar tetap hidup) ke kepala navy selebar layar
   * di atas isi. Layar tanpa judul sendiri memakai judul bar. Beranda punya kepalanya sendiri.
   */
  function pasangKepalaLayar(main) {
    var isi = null;
    for (var i = 0; i < main.children.length; i++) {
      if (main.children[i].classList.contains('layar-isi')) {
        isi = main.children[i];
        break;
      }
    }
    if (!isi) return false;
    var anak = function (kelas) {
      for (var j = 0; j < isi.children.length; j++) if (isi.children[j].classList.contains(kelas)) return isi.children[j];
      return null;
    };
    var kembali = anak('tautan-kembali');
    var judul = anak('kepala-isi') || anak('judul-layar');
    if (!judul) judul = el('h1', { class: 'judul-layar', 'data-dari-bar': '', text: $('#bar-judul').textContent });
    var ringkas = anak('kepala-ringkas');
    var kepalaIsi = el('div', { class: 'kepala-layar-isi' + (isi.classList.contains('layar-sempit') ? ' layar-sempit' : '') }, [
      el('div', { class: 'kepala-layar-atas' }, [kembali || el('span'), el('span', { class: 'sinyal' })]),
      judul,
      ringkas
    ]);
    main.insertBefore(el('header', { class: 'kepala-layar' + (isi.classList.contains('kepala-gantung') ? ' gantung' : '') }, kepalaIsi), isi);
    return true;
  }

  /**
   * Muncul saat digulir (tampilan Bagian 8, versi 1.8). Bagian layar yang berada di bawah
   * layar saat digambar diberi kelas .ungkap (pudar dan turun 16 px, app.css); begitu masuk
   * layar, .ungkap-tampil membuatnya naik ke tempatnya, sekali saja. JavaScript hanya
   * memasang kelas; geraknya CSS. Mati saat "kurangi gerak" atau tanpa IntersectionObserver.
   */
  var PILIH_UNGKAP = '.layar-isi > :not(.bilah-kirim):not(.kepala-ringkas):not(.memperbarui), ' +
    '.layar-isi .kartu, .layar-isi .kartu-item, .layar-isi .kelompok, .layar-isi .tabel-bingkai, .beranda-bawah > *';

  function pasangUngkap() {
    var main = $('#layar');
    if (!main || !window.IntersectionObserver || !window.MutationObserver) return;
    var kurangiGerak = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    var pengamat = new IntersectionObserver(function (catatan) {
      catatan.forEach(function (c) {
        if (!c.isIntersecting) return;
        var e = c.target;
        e.classList.add('ungkap-tampil');
        pengamat.unobserve(e);
        // Setelah naik, kelasnya dilepas supaya gerak tekan bagian itu kembali seperti biasa.
        setTimeout(function () { e.classList.remove('ungkap', 'ungkap-tampil'); }, 600);
      });
    }, { rootMargin: '0px 0px -24px 0px' });
    var tertunda = false;
    function periksa() {
      tertunda = false;
      if (kurangiGerak.matches) return;
      var batas = window.innerHeight;
      Array.prototype.forEach.call(main.querySelectorAll(PILIH_UNGKAP), function (e) {
        if (e.hasAttribute('data-ungkap')) return;
        e.setAttribute('data-ungkap', '');
        // Sudah ikut muncul bersama induknya, atau menempel (bilah bawah): tidak diungkap sendiri.
        if (e.parentElement && e.parentElement.closest('.ungkap:not(.ungkap-tampil)')) return;
        var r = e.getBoundingClientRect();
        if (!r.height || r.top < batas) return;
        var pos = getComputedStyle(e).position;
        if (pos === 'sticky' || pos === 'fixed') return;
        e.classList.add('ungkap');
        pengamat.observe(e);
      });
    }
    new MutationObserver(function () {
      if (tertunda) return;
      tertunda = true;
      // Microtask: sebelum layar dilukis, jadi tidak ada kedip.
      Promise.resolve().then(periksa);
    }).observe(main, { childList: true, subtree: true });
  }

  /** Mengganti alamat #/... tanpa memicu hashchange (layar digambar oleh pemanggil). */
  function gantiAlamat(hash) {
    if (location.hash === hash) return;
    try {
      history.replaceState(null, '', hash);
    } catch (err) {
      location.replace(hash);
    }
  }

  function tampilMode(mode) {
    if (mode !== 'aplikasi') jalurTampil = null; // layar pertama sesudah login tidak berpindah mulus
    $('#masuk').hidden = mode !== 'masuk';
    $('#aplikasi').hidden = mode !== 'aplikasi';
    document.body.classList.toggle('mode-masuk', mode === 'masuk');
  }

  /* =======================================================================
   * Router (alamat #/...)
   * ===================================================================== */

  var nomorLayar = 0;
  var segarkanLayar = null; // diisi layar yang bisa diperbarui saat aplikasi dibuka lagi
  var segarkanAntrean = null; // diisi layar yang menampilkan isian di antrean
  var pembersihLayar = []; // dijalankan saat layar ditinggalkan

  function bersihkanLayar() {
    pembersihLayar.splice(0).forEach(function (fn) {
      try {
        fn();
      } catch (err) {
        /* abaikan */
      }
    });
    segarkanLayar = null;
    segarkanAntrean = null;
  }

  var RUTE = [
    { pola: /^\/$/, menu: 'beranda', layar: layarBeranda },
    { pola: /^\/stock$/, menu: 'beranda', layar: layarStock },
    { pola: /^\/waste$/, menu: 'beranda', layar: layarWaste },
    { pola: /^\/suhu$/, menu: 'beranda', layar: layarSuhu },
    { pola: /^\/prep$/, menu: 'beranda', layar: layarPrep },
    { pola: /^\/form\/([A-Za-z0-9_%]+)$/, menu: 'beranda', layar: layarFormKustom },
    { pola: /^\/riwayat(?:\?(.*))?$/, menu: 'riwayat', layar: layarRiwayat },
    { pola: /^\/riwayat\/([A-Z0-9_]+)\/([A-Za-z0-9-]+)$/, menu: 'riwayat', layar: layarRiwayatDetail },
    { pola: /^\/laporan$/, menu: 'laporan', layar: layarLaporan },
    { pola: /^\/dashboard$/, menu: 'dashboard', pengelola: true, layar: layarDashboard },
    { pola: /^\/opname$/, menu: 'dashboard', pengelola: true, layar: layarOpname },
    { pola: /^\/hpp(\/menu)?$/, menu: 'dashboard', pengelola: true, layar: layarHpp },
    { pola: /^\/pengaturan$/, menu: 'pengaturan', pengelola: true, layar: layarPengaturan },
    { pola: /^\/pengaturan\/staff$/, menu: 'pengaturan', pengelola: true, layar: layarStaff },
    { pola: /^\/pengaturan\/staff\/([^/]+)(\/pin)?$/, menu: 'pengaturan', pengelola: true, layar: layarStaffDetail },
    { pola: /^\/pengaturan\/penerima$/, menu: 'pengaturan', pengelola: true, layar: layarPenerima },
    { pola: /^\/pengaturan\/form$/, menu: 'pengaturan', pengelola: true, layar: layarFormDaftar },
    { pola: /^\/pengaturan\/form-baru$/, menu: 'pengaturan', pengelola: true, layar: layarFormUbah },
    { pola: /^\/pengaturan\/form\/([^/]+)$/, menu: 'pengaturan', pengelola: true, layar: layarFormUbah },
    { pola: /^\/pengaturan\/outlet$/, menu: 'pengaturan', pengelola: true, layar: layarOutletJadwal },
    { pola: /^\/pengaturan\/item$/, menu: 'pengaturan', pengelola: true, layar: layarItem },
    { pola: /^\/pengaturan\/item-baru$/, menu: 'pengaturan', pengelola: true, layar: layarItemUbah },
    { pola: /^\/pengaturan\/item\/([^/]+)$/, menu: 'pengaturan', pengelola: true, layar: layarItemUbah },
    { pola: /^\/pengaturan\/unit$/, menu: 'pengaturan', pengelola: true, layar: layarUnit },
    { pola: /^\/pengaturan\/pemasok$/, menu: 'pengaturan', pengelola: true, layar: layarPemasok },
    { pola: /^\/pengaturan\/kategori$/, menu: 'pengaturan', pengelola: true, layar: layarKategoriSatuan },
    { pola: /^\/pengaturan\/resep$/, menu: 'pengaturan', pengelola: true, layar: layarResep },
    { pola: /^\/pengaturan\/resep-baru$/, menu: 'pengaturan', pengelola: true, layar: layarResepUbah },
    { pola: /^\/pengaturan\/resep\/([^/]+)$/, menu: 'pengaturan', pengelola: true, layar: layarResepUbah },
    { pola: /^\/pengaturan\/menu$/, menu: 'pengaturan', pengelola: true, layar: layarMenu },
    { pola: /^\/pengaturan\/menu-baru$/, menu: 'pengaturan', pengelola: true, layar: layarMenuUbah },
    { pola: /^\/pengaturan\/menu\/([^/]+)$/, menu: 'pengaturan', pengelola: true, layar: layarMenuUbah }
  ];

  function jalankanRute() {
    var sesi = Sesi.baca();
    if (!sesi) {
      keluarLokal(Simpan.baca(AWALAN + 'sesi') ? PESAN.sesiBerakhir : '');
      return;
    }
    var jalur = (location.hash || '').replace(/^#/, '') || '/';
    var rute = null;
    var cocok = null;
    for (var i = 0; i < RUTE.length; i++) {
      cocok = jalur.match(RUTE[i].pola);
      if (cocok) {
        rute = RUTE[i];
        break;
      }
    }
    if (!rute || (rute.pengelola && !sesi.pengguna.pengelola)) {
      gantiAlamat('#/');
      jalankanRute();
      return;
    }

    if (lembarKini) lembarKini.tutup(true);
    tutupMenuPengguna();
    kosongkan($('#lembar-wadah')); // lembar yang sedang menutup langsung hilang

    // Perpindahan mulus (tampilan Bagian 8, versi 1.12): hanya jika layar lama ada, alamatnya berbeda,
    // browser mendukung View Transitions, dan HP tidak diatur "kurangi gerak". Selain itu seperti dulu.
    var jalurLama = jalurTampil;
    var menuLama = menuAktif;
    jalurTampil = jalur;
    var jenis = jalurLama && jalurLama !== jalur && $('#aplikasi').hidden === false
      ? jenisPindah(jalurLama, menuLama, jalur, rute.menu) : null;
    if (!jenis || typeof document.startViewTransition !== 'function' || kurangiGerak() || document.hidden) {
      gambarRute(rute, cocok, sesi, jalur, true);
      return;
    }
    var akar = document.documentElement;
    var nomor = ++nomorPindah;
    var namaLama = namaiPindah(jenis, jalurLama, jalur, true);
    var namaBaru = [];
    akar.classList.add('vt-' + jenis);
    transisiAktif = true;
    var vt = document.startViewTransition(function () {
      lepasNamaPindah(namaLama);
      if (nomor !== nomorPindah) return; // sudah disusul perpindahan lain
      gambarRute(rute, cocok, sesi, jalur, false);
      namaBaru = namaiPindah(jenis, jalurLama, jalur, false);
    });
    var selesai = function () {
      akar.classList.remove('vt-' + jenis);
      lepasNamaPindah(namaBaru);
      if (nomor === nomorPindah) transisiAktif = false;
    };
    vt.ready.catch(function () { /* dilewati browser: layar tetap digambar */ });
    vt.updateCallbackDone.catch(function () { /* galatnya sudah tercatat di konsol */ });
    vt.finished.then(selesai, selesai);
  }

  /** Menggambar layar rute. gerakMasuk: isi naik bertahap (dipakai jika tidak ada perpindahan mulus). */
  function gambarRute(rute, cocok, sesi, jalur, gerakMasuk) {
    nomorLayar++;
    bersihkanLayar();
    var main = $('#layar');
    kosongkanLayar();
    main.classList.remove('layar-masuk');
    if (gerakMasuk) {
      void main.offsetWidth; // mulai ulang gerak ganti layar
      main.classList.add('layar-masuk');
    }
    // Gerak masuk dan angka berhitung hanya untuk isi pertama layar; isi yang digambar ulang sesudahnya
    // (data dari server) diam.
    var nomorMasuk = nomorLayar;
    layarBaruSampai = Date.now() + 900;
    setTimeout(function () { if (nomorMasuk === nomorLayar) main.classList.remove('layar-masuk'); }, 900);
    $('#aplikasi').classList.toggle('di-beranda', rute.menu === 'beranda' && jalur === '/');
    aturMenuAktif(rute.menu);
    rute.layar({ wadah: main, cocok: cocok, sesi: sesi });
    $('#aplikasi').classList.toggle('ada-kepala', pasangKepalaLayar(main));
    tempatkanPita();
    aturSinyal();
    window.scrollTo(0, 0);
  }

  /* -----------------------------------------------------------------------
   * Perpindahan layar yang mulus (View Transitions, tampilan Bagian 8.5)
   * --------------------------------------------------------------------- */

  var jalurTampil = null; // alamat layar yang sedang tampil
  var nomorPindah = 0;
  var transisiAktif = false; // selama perpindahan mulus: gerak masuk lain (tiket turun) tidak dipakai
  var POLA_FORM = /^\/(stock|waste|suhu|prep|form\/[^/?]+)$/;

  function kurangiGerak() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function kedalamanJalur(j) {
    return j.split('?')[0].split('/').filter(Boolean).length;
  }

  /**
   * buka: tiket Beranda → layar form; tutup: kebalikannya; maju/mundur: menu di kanan/kiri, atau layar
   * yang lebih dalam/dangkal di menu yang sama; ganti: selain itu (memudar).
   */
  function jenisPindah(lama, menuLama, baru, menuBaru) {
    if (lama === '/' && POLA_FORM.test(baru)) return 'buka';
    if (POLA_FORM.test(lama) && baru === '/') return 'tutup';
    if (menuLama && menuLama !== menuBaru) {
      var urut = Array.prototype.map.call($('#menu-grup').querySelectorAll('.menu-item'), function (a) {
        return a.getAttribute('data-menu');
      });
      return urut.indexOf(menuBaru) >= urut.indexOf(menuLama) ? 'maju' : 'mundur';
    }
    var dl = kedalamanJalur(lama);
    var db = kedalamanJalur(baru);
    return db > dl ? 'maju' : db < dl ? 'mundur' : 'ganti';
  }

  function idFormJalur(j) {
    var m = j.match(/^\/form\/([^/?]+)$/);
    if (m) {
      try { return decodeURIComponent(m[1]); } catch (err) { return m[1]; }
    }
    for (var id in LAYAR_FORM) if (LAYAR_FORM[id] === '#' + j) return id;
    return null;
  }

  /**
   * Nama tiket di Beranda terbang ke judul layar form (buka), atau sebaliknya (tutup). lama: dipanggil
   * sebelum layar diganti (menamai layar lama). Mengembalikan elemen yang diberi nama.
   */
  function namaiPindah(jenis, jalurLama, jalurBaru, lama) {
    if (jenis !== 'buka' && jenis !== 'tutup') return [];
    var diBeranda = (jenis === 'buka') === lama;
    var id = idFormJalur(jenis === 'buka' ? jalurBaru : jalurLama);
    var sasaran = null;
    if (diBeranda) {
      if (!id) return [];
      var tiket = Array.prototype.find.call($('#layar').querySelectorAll('.tiket'), function (t) {
        return t.getAttribute('data-form') === id;
      });
      sasaran = tiket && tiket.querySelector('.tiket-nama');
    } else {
      sasaran = $('#layar .kepala-layar .judul-layar') || $('#layar .kepala-layar h1');
    }
    if (!sasaran) return [];
    sasaran.style.viewTransitionName = 'judul-form';
    return [sasaran];
  }

  function lepasNamaPindah(daftar) {
    daftar.forEach(function (e) { e.style.viewTransitionName = ''; });
  }

  /* -----------------------------------------------------------------------
   * Angka utama berhitung naik (tampilan Bagian 8.5): dari 0 ke angkanya dalam 0,9 detik, melambat di
   * akhir. Hanya untuk angka yang muncul bersama isi pertama layar; mati saat "kurangi gerak".
   * --------------------------------------------------------------------- */

  var PILIH_HITUNG = '.kepala-nilai-angka, .ubin-nilai, .kemajuan-angka, .kepala-angka-nilai';
  var LAMA_HITUNG = 900;
  var POLA_ANGKA = /\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/;
  var layarBaruSampai = 0;
  var formatHitung = {};

  function teksHitung(n, desimal) {
    if (!formatHitung[desimal]) {
      formatHitung[desimal] = typeof Intl !== 'undefined' && Intl.NumberFormat
        ? new Intl.NumberFormat('id-ID', { minimumFractionDigits: desimal, maximumFractionDigits: desimal })
        : { format: function (x) { return x.toFixed(desimal).replace('.', ','); } };
    }
    return formatHitung[desimal].format(n);
  }

  function hitungNaik(wadah) {
    // Hanya angka pertama di luar <small>: "2 dari 4" berhitung 0 → 2, "dari 4" diam.
    var bagian = [];
    var jalan = document.createTreeWalker(wadah, NodeFilter.SHOW_TEXT, null);
    for (var n = jalan.nextNode(); n && !bagian.length; n = jalan.nextNode()) {
      if (n.parentNode.closest('small')) continue;
      var m = n.data.match(POLA_ANGKA);
      if (!m) continue;
      var koma = m[0].indexOf(',');
      var nilai = Number(m[0].replace(/\./g, '').replace(',', '.'));
      if (!nilai) continue;
      bagian.push({
        simpul: n, asli: n.data, nilai: nilai, desimal: koma < 0 ? 0 : m[0].length - koma - 1,
        depan: n.data.slice(0, m.index), belakang: n.data.slice(m.index + m[0].length)
      });
    }
    if (!bagian.length) return;
    // Pembaca layar langsung membaca angka akhirnya; angka yang berhitung disembunyikan darinya.
    var teksAkhir = el('span', { class: 'sr', text: wadah.textContent });
    wadah.setAttribute('aria-hidden', 'true');
    wadah.after(teksAkhir);
    var mulai = null;
    function langkah(kini) {
      if (mulai === null) mulai = kini;
      var t = Math.min(1, (kini - mulai) / LAMA_HITUNG);
      var e = 1 - Math.pow(1 - t, 3);
      var hidup = wadah.isConnected;
      bagian.forEach(function (b) {
        if (t >= 1 || !hidup) b.simpul.data = b.asli;
        else b.simpul.data = b.depan + teksHitung(b.nilai * e, b.desimal) + b.belakang;
      });
      if (t < 1 && hidup) {
        requestAnimationFrame(langkah);
        return;
      }
      wadah.removeAttribute('aria-hidden');
      teksAkhir.remove();
    }
    bagian.forEach(function (b) { b.simpul.data = b.depan + teksHitung(0, b.desimal) + b.belakang; });
    requestAnimationFrame(langkah);
  }

  function pasangHitungNaik() {
    var main = $('#layar');
    if (!main || !window.MutationObserver || !window.requestAnimationFrame) return;
    var tertunda = false;
    function periksa() {
      tertunda = false;
      if (Date.now() > layarBaruSampai || kurangiGerak()) return;
      Array.prototype.forEach.call(main.querySelectorAll(PILIH_HITUNG), function (e) {
        if (e.hasAttribute('data-hitung')) return;
        e.setAttribute('data-hitung', '');
        hitungNaik(e);
      });
    }
    new MutationObserver(function () {
      if (tertunda) return;
      tertunda = true;
      Promise.resolve().then(periksa); // sebelum dilukis: angka langsung mulai dari 0, tanpa kedip
    }).observe(main, { childList: true, subtree: true });
  }

  /** Pita sinyal di bawah kepala layar. Di Beranda: di atas kepala navy, supaya tiket tetap tergantung di rel. */
  function tempatkanPita() {
    var kepalaBeranda = $('#layar .beranda-kepala') || $('#layar .kepala-layar');
    if (kepalaBeranda) kepalaBeranda.prepend(pitaSinyal);
    else $('#bar').after(pitaSinyal);
  }

  /** Mengosongkan isi layar; pita sinyal dikembalikan dulu ke bawah bar. */
  function kosongkanLayar() {
    $('#bar').after(pitaSinyal);
    kosongkan($('#layar'));
  }

  /* =======================================================================
   * Masuk dan keluar
   * ===================================================================== */

  var pembukaSudah = false;

  function masukAplikasi(pesanSambutan) {
    pembukaSudah = false;
    tampilMode('aplikasi');
    gambarMenu();
    gantiAlamat('#/');
    jalankanRute();
    if (pesanSambutan) toast(pesanSambutan);
    kirimAntrean();
  }

  /**
   * Login, pemasangan, dan pemulihan meminta data Beranda sekaligus (Code.gs v0.14), jadi
   * Beranda tampil tanpa panggilan kedua: tanggal perangkat dan alamat aplikasi seperti aksi beranda.
   */
  function isiBerandaLogin() {
    return { tanggal: tanggalIso(new Date()), alamatAplikasi: location.origin + location.pathname };
  }

  var berandaDariLogin = 0; // waktu (ms) Beranda terakhir datang bersama login

  /** Sesi baru dari login, pemasangan pertama, atau pemulihan akses. */
  function simpanSesiBaru(data) {
    Sesi.tulis({
      token: data.token,
      berlakuSampai: data.berlakuSampai,
      pengguna: data.pengguna,
      namaOutlet: data.namaOutlet
    });
    simpanMenitKeluarOtomatis(data.keluarOtomatisMenit);
    // Login berikutnya di HP ini langsung menyapa orang ini (tampilan Bagian 5.1, versi 1.9).
    if (data.pengguna && data.pengguna.nama) Simpan.tulis(AWALAN + 'penggunaTerakhir', data.pengguna.nama);
    catatDipakai(true);
    berandaDariLogin = 0;
    if (data.beranda) {
      Cache.tulis('beranda', data.beranda);
      berandaDariLogin = Date.now();
    }
  }

  /** Beranda yang baru datang bersama login (30 detik terakhir) dipakai langsung, sekali, tanpa memanggil server lagi. */
  function pakaiBerandaLogin() {
    var segar = berandaDariLogin && Date.now() - berandaDariLogin < 30000;
    berandaDariLogin = 0;
    return !!segar;
  }

  /**
   * Keluar di HP saja (sesi dihapus), lalu kembali ke layar Login. Draft,
   * antrean kirim, dan data tersimpan milik pengguna itu tetap di HP.
   * keterangan: baris di atas pilihan nama (setelah keluar otomatis).
   */
  function keluarLokal(pesan, keterangan) {
    Sesi.hapus();
    nomorLayar++;
    bersihkanLayar();
    if (lembarKini) lembarKini.tutup(true);
    tutupMenuPengguna();
    kosongkanLayar();
    menuAktif = null;
    mulaiMasuk(pesan, keterangan);
  }

  /**
   * Keluar (spesifikasi sistem Bagian 7.2): token dihapus dari HP, dan sesinya
   * di server ikut dihapus jika ada sinyal. Dipakai tombol Keluar dan keluar otomatis.
   */
  function keluar(keterangan) {
    var sesi = Simpan.baca(AWALAN + 'sesi');
    if (sesi && sesi.token) {
      panggilApi('keluar', { token: sesi.token }).catch(function () { /* sesi tetap habis sendiri */ });
    }
    keluarLokal('', keterangan);
  }

  /** Konfirmasi tombol "Keluar" (tampilan Bagian 7). */
  function bukaKeluar() {
    var sesi = Sesi.baca();
    if (!sesi) return;
    var nama = sesi.pengguna.nama;
    var jumlahAntrean = Antrean.jumlah(nama);
    bukaLembar({
      judul: 'Keluar dari akun ' + nama + '?',
      isi: jumlahAntrean > 0
        ? el('p', { class: 'pesan-formulir tinjau' }, [ikon('info'), el('span', {
          text: jumlahAntrean + ' isian ' + nama + ' belum terkirim. Isian tetap tersimpan dan dikirim saat ' + nama + ' masuk lagi.'
        })])
        : el('p', { text: 'Pengguna berikutnya masuk dengan namanya sendiri dan PIN-nya.' }),
      aksi: [
        { teks: 'Batal', jenis: 'kedua' },
        {
          teks: 'Keluar',
          jenis: 'utama',
          klik: function (t, l) {
            l.tutup(true);
            keluar('');
          }
        }
      ]
    });
  }

  /* ---------- Menu nama pengguna: "Notifikasi" (sejak aplikasi 0.20.0) dan "Keluar" ----------
   * HP dan tablet: nama di kepala Beranda. Desktop: nama di bar atas, di semua
   * layar (spesifikasi tampilan Bagian 4.3 dan 5.2). */
  var menuPenggunaKini = null;

  function tutupMenuPengguna(kembalikanFokus) {
    var m = menuPenggunaKini;
    if (!m) return;
    menuPenggunaKini = null;
    m.asal.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', m.diLuar, true);
    document.removeEventListener('keydown', m.tombolKeyboard, true);
    window.removeEventListener('resize', m.tutup);
    window.removeEventListener('scroll', m.tutup, true);
    m.elemen.remove();
    if (kembalikanFokus && document.contains(m.asal)) m.asal.focus({ preventScroll: true });
  }

  function bukaMenuPengguna(e) {
    var asal = e.currentTarget;
    var tadi = menuPenggunaKini;
    tutupMenuPengguna();
    if (tadi && tadi.asal === asal) return; // ketukan kedua menutup menu
    var sesi = Sesi.baca();
    if (!sesi) return;
    var itemNotif = el('button', { type: 'button', class: 'menu-pengguna-item', role: 'menuitem', 'aria-haspopup': 'dialog' }, [
      ikon('lonceng'),
      el('span', { text: 'Notifikasi' })
    ]);
    var item = el('button', { type: 'button', class: 'menu-pengguna-item', role: 'menuitem' }, [
      ikon('keluar'),
      el('span', { text: 'Keluar' })
    ]);
    var daftarItem = [itemNotif, item];
    var menu = el('div', { class: 'menu-pengguna', role: 'menu', 'aria-label': 'Menu ' + sesi.pengguna.nama }, daftarItem);
    itemNotif.addEventListener('click', function () {
      tutupMenuPengguna();
      bukaNotifikasi();
    });
    item.addEventListener('click', function () {
      tutupMenuPengguna();
      bukaKeluar();
    });
    document.body.appendChild(menu);

    // Di bawah nama: rata kanan di bar desktop, rata kiri di kepala Beranda; selalu di dalam layar.
    var r = asal.getBoundingClientRect();
    var lebarLayar = document.documentElement.clientWidth;
    var lebar = menu.offsetWidth;
    var kiri = asal.classList.contains('bar-pengguna') ? r.right - lebar : r.left;
    menu.style.left = Math.max(8, Math.min(kiri, lebarLayar - lebar - 8)) + 'px';
    menu.style.top = Math.round(r.bottom + 4) + 'px';

    var m = {
      asal: asal,
      elemen: menu,
      tutup: function () { tutupMenuPengguna(); },
      diLuar: function (ev) {
        if (!menu.contains(ev.target) && !asal.contains(ev.target)) tutupMenuPengguna();
      },
      tombolKeyboard: function (ev) {
        if (ev.key === 'Escape') {
          ev.preventDefault();
          tutupMenuPengguna(true);
        } else if (ev.key === 'Tab') {
          tutupMenuPengguna();
        } else if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
          ev.preventDefault();
          var i = daftarItem.indexOf(document.activeElement);
          var n = daftarItem.length;
          daftarItem[((i < 0 ? 0 : i) + (ev.key === 'ArrowDown' ? 1 : n - 1)) % n].focus({ preventScroll: true });
        }
      }
    };
    menuPenggunaKini = m;
    asal.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', m.diLuar, true);
    document.addEventListener('keydown', m.tombolKeyboard, true);
    window.addEventListener('resize', m.tutup);
    window.addEventListener('scroll', m.tutup, true);
    itemNotif.focus({ preventScroll: true });
  }

  /* ---------- Notifikasi ke HP (aplikasi 0.20.0; spesifikasi sistem Bagian 10.1, tampilan Bagian 5.11) ----------
   * Satu langganan Web Push per HP, atas nama pengguna yang menyalakannya. Server (Supabase) mengirim
   * suhu di luar standar, permintaan reset PIN, dan akun terkunci ke HP Pengelola, dan pengingat cek
   * suhu ke semua HP. Di iPhone hanya untuk aplikasi yang dipasang di Layar Utama (iOS 16.4 ke atas). */

  function dukunganNotifikasi() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  function apakahTerpasang() {
    return navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  }

  function kunciPushBytes(b64) {
    var t = String(b64).replace(/-/g, '+').replace(/_/g, '/');
    var bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
    var hasil = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) hasil[i] = bin.charCodeAt(i);
    return hasil;
  }

  function samaBytes(a, b) {
    if (!a || !b) return false;
    a = new Uint8Array(a);
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  /** Service worker yang siap, paling lama 6 detik (tanpa service worker, notifikasi tidak bisa dipakai). */
  function swSiap() {
    return Promise.race([
      navigator.serviceWorker.ready,
      new Promise(function (_, gagal) {
        setTimeout(function () { gagal(new Error('Aplikasi di HP ini belum siap untuk notifikasi. Tutup aplikasi, buka lagi, lalu coba lagi.')); }, 6000);
      })
    ]);
  }

  function bukaNotifikasi() {
    var sesi = Sesi.baca();
    if (!sesi) return;
    var nama = sesi.pengguna.nama;
    var isi = el('div', { class: 'notif' }, el('p', { class: 'kolom-bantuan', text: 'Memeriksa notifikasi di HP ini…' }));
    var pesan = el('p', { class: 'pesan-formulir', role: 'status' });
    var lembar = bukaLembar({ judul: 'Notifikasi di HP ini', isi: [isi, pesan], aksi: [{ teks: 'Tutup', jenis: 'kedua' }] });
    var reg = null;
    var sub = null;

    function kalimat(teks, jenis) {
      return el('p', { class: 'pesan-formulir' + (jenis ? ' ' + jenis : '') }, [ikon('info'), el('span', { text: teks })]);
    }

    if (!dukunganNotifikasi()) {
      kosongkan(isi).appendChild(kalimat(apakahIos() && !apakahTerpasang()
        ? 'Di iPhone, notifikasi hanya bisa untuk aplikasi yang dipasang di Layar Utama. Buka alamat aplikasi di Safari, ketuk Bagikan, ' +
          'pilih Tambahkan ke Layar Utama, lalu buka InventoryKu dari ikonnya dan nyalakan notifikasi di sini.'
        : 'Browser ini belum bisa menerima notifikasi. Pakai Chrome di Android, atau di iPhone pasang aplikasi ke Layar Utama lalu buka dari ikonnya.',
      'tinjau'));
      return;
    }

    function gambar(d) {
      kosongkan(isi);
      if (!d.tersedia) {
        isi.appendChild(kalimat('Notifikasi belum tersedia di server ini. Pemilik perlu memasang versi server terbaru.', 'tinjau'));
        return;
      }
      var jam = d.pengingat.filter(function (p) { return p.jam; }).map(function (p) { return p.waktu + ' ' + p.jam.replace(':', '.'); });
      var daftar = [];
      if (d.pengelola) daftar.push('Suhu di luar standar', 'Permintaan reset PIN', 'Akun yang terkunci karena PIN salah');
      // Pengingat stock pagi (Code.gs v0.22); server lama tidak mengirim pengingatStock.
      if (d.pengelola && d.pengingatStock != null) {
        daftar.push(d.pengingatStock
          ? 'Pengingat stock (' + d.pengingatStock.replace(':', '.') + '), jika ada item di bawah minimum, minus, atau lewat masa simpan'
          : 'Pengingat stock (sedang dimatikan)');
      }
      daftar.push(jam.length ? 'Pengingat cek suhu (' + jam.join(', ') + '), jika belum lengkap' : 'Pengingat cek suhu (sedang dimatikan)');
      isi.appendChild(el('p', { class: 'kartu-teks', text: 'Yang dikirim ke HP ini, juga saat aplikasi tertutup:' }));
      isi.appendChild(el('ul', { class: 'notif-daftar' }, daftar.map(function (t) { return el('li', { text: t }); })));

      var diblokir = Notification.permission === 'denied';
      var aktif = d.aktif && !!sub;
      var sakelar = sakelarTampil({ teks: 'Notifikasi di HP ini', kataYa: 'Nyala', kataTidak: 'Mati', nilai: aktif,
        ubah: function (b) { if (b) nyalakan(sakelar); else matikan(sakelar); } });
      if (diblokir && !aktif) sakelar.input.disabled = true;
      isi.appendChild(el('div', { class: 'notif-sakelar' }, sakelar.wadah));
      if (diblokir && !aktif) {
        isi.appendChild(kalimat('Notifikasi diblokir untuk InventoryKu di HP ini. Izinkan notifikasi untuk aplikasi ini di setelan ' +
          'HP atau browser, lalu buka lembar ini lagi.', 'tinjau'));
      } else if (aktif && d.atasNama && d.atasNama.toLowerCase() !== nama.toLowerCase()) {
        var ganti = tombol('Terima untuk ' + nama, 'kedua');
        ganti.addEventListener('click', function () { nyalakan(sakelar, ganti); });
        isi.appendChild(kalimat('HP ini menerima notifikasi untuk ' + d.atasNama + '. Satu HP hanya untuk satu orang.', 'info'));
        isi.appendChild(el('div', {}, ganti));
      } else if (aktif) {
        isi.appendChild(el('p', { class: 'kolom-bantuan', text: 'Menyala untuk ' + nama + '.' }));
      }
      if (aktif) {
        var uji = tombol('Kirim notifikasi uji', 'kedua');
        uji.addEventListener('click', function () {
          tulisPesan(pesan, '');
          aturTombolProses(uji, true, 'Mengirim…');
          panggilApi('ujiNotifikasi', { endpoint: sub.endpoint }).then(function () {
            aturTombolProses(uji, false);
            tulisPesan(pesan, 'Notifikasi uji dikirim. Jika tidak muncul dalam satu menit, periksa setelan notifikasi HP.', 'info');
          }).catch(function (err) {
            aturTombolProses(uji, false);
            if (tanganiSesiBerakhir(err)) return;
            tulisPesan(pesan, pesanGalat(err), 'masalah');
          });
        });
        isi.appendChild(el('div', { class: 'notif-uji' }, uji));
      }
    }

    function gagal(sakelar, err, kembali) {
      if (sakelar) {
        sakelar.input.disabled = false;
        sakelar.atur(kembali);
      }
      if (tanganiSesiBerakhir(err)) return;
      tulisPesan(pesan, pesanGalat(err), 'masalah');
    }

    function nyalakan(sakelar, tombolGanti) {
      tulisPesan(pesan, '');
      sakelar.input.disabled = true;
      if (tombolGanti) aturTombolProses(tombolGanti, true, 'Menyimpan…');
      var data = null;
      // requestPermission dipanggil lebih dulu, masih di dalam ketukan (syarat Safari).
      Notification.requestPermission().then(function (izin) {
        if (izin !== 'granted') {
          throw new Error(izin === 'denied' ? 'Notifikasi diblokir. Izinkan notifikasi untuk InventoryKu di setelan HP atau browser.'
            : 'Izin notifikasi belum diberikan. Ketuk lagi, lalu pilih Izinkan.');
        }
        return panggilApi('infoNotifikasi', {});
      }).then(function (d) {
        data = d;
        var kunci = kunciPushBytes(d.kunciPublik);
        return reg.pushManager.getSubscription().then(function (lama) {
          if (lama && samaBytes(lama.options && lama.options.applicationServerKey, kunci)) return lama;
          return (lama ? lama.unsubscribe() : Promise.resolve()).then(function () {
            return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: kunci });
          });
        });
      }).then(function (baru) {
        sub = baru;
        return panggilApi('aturNotifikasi', { aktif: true, langganan: baru.toJSON() });
      }).then(function (d) {
        gambar(d);
        tulisPesan(pesan, 'Notifikasi menyala di HP ini.', 'baik');
      }).catch(function (err) {
        if (tombolGanti) aturTombolProses(tombolGanti, false);
        gagal(sakelar, err, false);
        if (data && !data.tersedia) gambar(data);
      });
    }

    function matikan(sakelar) {
      tulisPesan(pesan, '');
      sakelar.input.disabled = true;
      if (!sub) {
        sakelar.input.disabled = false;
        return;
      }
      var lama = sub;
      panggilApi('aturNotifikasi', { aktif: false, endpoint: lama.endpoint }).then(function (d) {
        return lama.unsubscribe().catch(function () { /* langganan di HP tetap dibuang server */ }).then(function () {
          sub = null;
          gambar(d);
          tulisPesan(pesan, 'Notifikasi di HP ini dimatikan.', 'info');
        });
      }).catch(function (err) {
        gagal(sakelar, err, true);
      });
    }

    swSiap().then(function (r) {
      reg = r;
      return reg.pushManager.getSubscription();
    }).then(function (s) {
      sub = s;
      return panggilApi('infoNotifikasi', { endpoint: s ? s.endpoint : '' });
    }).then(gambar).catch(function (err) {
      if (tanganiSesiBerakhir(err)) {
        lembar.tutup(true);
        return;
      }
      kosongkan(isi).appendChild(kalimat(pesanGalat(err), 'masalah'));
    });
  }

  /* =======================================================================
   * Keluar otomatis (spesifikasi sistem Bagian 7.2, tampilan Bagian 5.1).
   * Dihitung di perangkat dari ketukan, klik, ketikan, dan guliran. Jam
   * terakhir dipakai disimpan di HP, sehingga saat aplikasi dibuka lagi dari
   * latar belakang atau layar HP dinyalakan lagi, selisihnya tetap terhitung.
   * Selama aplikasi mengirim isian atau membuat PDF, hitungan berhenti, lalu
   * mulai lagi dari nol setelah proses itu selesai. Lamanya (menit) datang
   * dari server saat login dan di Beranda, dan disimpan di HP supaya tetap
   * berlaku saat offline.
   * ===================================================================== */

  var PILIHAN_KELUAR_OTOMATIS = [5, 10, 15, 30];
  var KELUAR_OTOMATIS_AWAL = 5;
  var KUNCI_MENIT_KELUAR = AWALAN + 'keluarOtomatisMenit';
  var KUNCI_TERAKHIR_DIPAKAI = AWALAN + 'terakhirDipakai';
  var terakhirDipakai = 0; // ms, salinan di memori
  var terakhirDitulis = 0;
  var prosesBerjalan = 0;

  function menitKeluarOtomatis() {
    var n = Number(Simpan.baca(KUNCI_MENIT_KELUAR));
    return PILIHAN_KELUAR_OTOMATIS.indexOf(n) >= 0 ? n : KELUAR_OTOMATIS_AWAL;
  }

  function simpanMenitKeluarOtomatis(n) {
    n = Number(n);
    if (PILIHAN_KELUAR_OTOMATIS.indexOf(n) >= 0) Simpan.tulis(KUNCI_MENIT_KELUAR, n);
  }

  function teksKeluarOtomatis(menit) {
    return 'Keluar otomatis karena ' + menit + ' menit tidak dipakai. Isian yang belum dikirim tetap tersimpan.';
  }

  /** Aplikasi dipakai sekarang. Ditulis ke HP paling sering tiap 5 detik (memori selalu terbaru). */
  function catatDipakai(paksa) {
    var kini = Date.now();
    terakhirDipakai = kini;
    if (paksa || kini - terakhirDitulis >= 5000) {
      terakhirDitulis = kini;
      Simpan.tulis(KUNCI_TERAKHIR_DIPAKAI, kini);
    }
  }

  /** Proses yang menahan hitungan (mengirim isian, membuat PDF). Mengembalikan janji yang sama. */
  function jagaProses(janji) {
    prosesBerjalan++;
    catatDipakai(true);
    var selesai = function () {
      prosesBerjalan = Math.max(0, prosesBerjalan - 1);
      catatDipakai(true); // hitungan mulai lagi dari nol
    };
    janji.then(selesai, selesai);
    return janji;
  }

  /** Ada sesi dan aplikasi sudah tidak dipakai selama waktu yang diatur. */
  function sudahDiam() {
    if (prosesBerjalan > 0 || !Sesi.baca()) return false;
    var terakhir = Math.max(Number(Simpan.baca(KUNCI_TERAKHIR_DIPAKAI)) || 0, terakhirDipakai);
    if (!terakhir) {
      catatDipakai(true);
      return false;
    }
    return Date.now() - terakhir >= menitKeluarOtomatis() * 60000;
  }

  function keluarOtomatis() {
    keluar(teksKeluarOtomatis(menitKeluarOtomatis()));
  }

  /** Diperiksa tiap 10 detik, saat aplikasi kembali dari latar belakang, dan sebelum ketukan dicatat. */
  function periksaDiam() {
    if ($('#aplikasi').hidden || !sudahDiam()) return false;
    keluarOtomatis();
    return true;
  }

  function pasangKeluarOtomatis() {
    var dipakai = function () {
      if ($('#aplikasi').hidden) return;
      // Ketukan setelah lama diam (misalnya HP baru dinyalakan) tidak menghidupkan sesi lagi.
      if (!periksaDiam()) catatDipakai(false);
    };
    ['pointerdown', 'keydown', 'wheel', 'touchstart', 'input', 'scroll'].forEach(function (jenis) {
      document.addEventListener(jenis, dipakai, { capture: true, passive: true });
    });
    setInterval(periksaDiam, 10000);
    window.addEventListener('pageshow', periksaDiam);
    window.addEventListener('focus', periksaDiam);
  }

  /* =======================================================================
   * Layar Login (spesifikasi tampilan Bagian 5.1)
   * ===================================================================== */

  var login = null; // keadaan layar Login yang sedang tampil
  var ketikLoginKini = null; // pendengar keyboard layar Login yang terpasang

  function mulaiMasuk(pesan, keterangan) {
    tampilMode('masuk');
    var info = Simpan.baca(AWALAN + 'infoLogin');
    if (info && !info.perluPemasangan) {
      gambarLogin(info, pesan, true, keterangan);
    } else {
      gambarLogin(null, pesan, true, keterangan);
    }
    ambilInfoLogin();
  }

  function ambilInfoLogin() {
    var nomor = ++nomorLayar;
    panggilApi('infoLogin').then(function (info) {
      if (nomor !== nomorLayar || Sesi.baca()) return;
      Simpan.tulis(AWALAN + 'infoLogin', info);
      if (info.perluPemasangan) {
        layarPasang(info);
        return;
      }
      if (login) login.perbarui(info);
      else gambarLogin(info, '', false);
    }).catch(function (err) {
      if (nomor !== nomorLayar || !login) return;
      login.gagalMuat(pesanGalat(err));
    });
  }

  /**
   * Logo (tampilan Bagian 4.5, versi 1.8): buku terbuka (halaman Kertas bergaris, pita amber)
   * di dalam lencana Navy Lapis berbingkai Garis Navy. Saat logo pertama tampil (.lencana-buka),
   * halaman membuka dari tengah lalu pita amber turun.
   */
  function lencana(kelas) {
    var t = document.createElement('template');
    t.innerHTML = '<span class="lencana' + (kelas ? ' ' + kelas : '') + '" aria-hidden="true">' +
      '<svg class="ikon-buku" viewBox="7 11 50 44" aria-hidden="true" focusable="false">' +
      '<path class="ikon-buku-kiri" d="M31 20.5C24.5 16 16 14.6 9 16v31c7-1.4 15.5 0 22 4.5z"/>' +
      '<path class="ikon-buku-kanan" d="M33 20.5C39.5 16 48 14.6 55 16v31c-7-1.4-15.5 0-22 4.5z"/>' +
      '<path class="ikon-buku-garis" d="M14 25.5c4.5-.4 8.6.6 12.5 2.6M14 31.5c4.5-.4 8.6.6 12.5 2.6M14 37.5c4.5-.4 8.6.6 12.5 2.6"/>' +
      '<path class="ikon-buku-pembatas" d="M39.5 18.2h7v18l-3.5-2.7-3.5 2.7z"/></svg></span>';
    return t.content.firstChild;
  }

  /** Nama aplikasi dua warna: "Inventory" Kertas, "Ku" Lampu Pass (hanya di atas navy). */
  function namaMerek(kelas, tag) {
    return el(tag || 'span', { class: kelas }, ['Inventory', el('span', { class: 'merek-ku', text: 'Ku' })]);
  }

  /**
   * Nama di Login: huruf demi huruf naik saat pembuka (tampilan Bagian 5.1, versi 1.8).
   * Pembaca layar membaca label utuhnya, bukan huruf satu per satu.
   */
  function namaMerekHuruf() {
    var anak = [];
    'InventoryKu'.split('').forEach(function (h, i) {
      anak.push(el('span', { class: 'huruf' + (i >= 9 ? ' merek-ku' : ''), style: '--i:' + i, 'aria-hidden': 'true', text: h }));
    });
    return el('h1', { class: 'login-nama-aplikasi', 'aria-label': 'InventoryKu' }, anak);
  }

  function merekLogin(namaOutlet) {
    var outlet = el('p', { class: 'login-outlet', text: namaOutlet || '' });
    return {
      wadah: el('div', { class: 'login-merek' }, [
        el('span', { class: 'lencana-panggung' }, [el('span', { class: 'lencana-halo', 'aria-hidden': 'true' }), lencana('lencana-besar')]),
        namaMerekHuruf(),
        outlet
      ]),
      outlet: outlet
    };
  }

  /**
   * Suasana di belakang Login (tampilan Bagian 5.1 dan 8, versi 1.8): rel dengan tiket yang
   * berayun pelan, uap dapur yang naik, dan cahaya kedua. Hiasan saja (aria-hidden, tidak bisa
   * disentuh), hanya transform dan opacity; diam (uap tidak tampil) saat "kurangi gerak".
   */
  function latarLogin() {
    var tiket = [];
    for (var i = 0; i < 5; i++) {
      tiket.push(el('span', { class: 'latar-tiket', style: '--i:' + i }, [el('span', { class: 'latar-tiket-klip' })]));
    }
    var uap = [];
    for (var j = 0; j < 7; j++) uap.push(el('span', { class: 'latar-uap', style: '--i:' + j }));
    return el('div', { class: 'login-latar', 'aria-hidden': 'true' }, [
      el('span', { class: 'latar-cahaya' }),
      el('div', { class: 'latar-rel' }, [el('span', { class: 'latar-rel-garis' })].concat(tiket)),
      el('div', { class: 'latar-uap-wadah' }, uap)
    ]);
  }

  /**
   * Layar Login (tampilan Bagian 5.1, versi 1.9): HP mengingat orang yang terakhir masuk,
   * jadi Login langsung menyapanya ("Halo, Rina") dengan papan angka PIN. Daftar nama
   * (lingkaran inisial) hanya tampil jika HP belum mengingat siapa pun, orang itu tidak bisa
   * masuk lagi, atau "Ganti nama" diketuk. Setelah angka keenam, login langsung diproses.
   * keterangan: satu baris setelah keluar otomatis; hilang setelah "Ganti nama" atau nama dipilih.
   */
  var loginBukaSudah = false;

  function gambarLogin(info, pesanAwal, memuat, keterangan) {
    var wadah = $('#masuk');
    wadah.className = 'masuk';
    kosongkan(wadah);
    aturJudulDokumen('Masuk');

    // ingat: langkah pertama menyapa pengguna terakhir; mati setelah "Ganti nama" diketuk.
    var keadaan = { info: info, nama: '', pin: '', sibuk: false, keterangan: keterangan || '', ingat: true };
    var merek = merekLogin(info ? info.namaOutlet : '');
    var kiri = el('div', { class: 'login-kiri' }, merek.wadah);
    var kanan = el('div', { class: 'login-kanan' });
    var pesan = el('p', { class: 'pesan-login', role: 'status', 'aria-live': 'polite' });
    var penanda = el('span', { class: 'memperbarui' });
    var pulihkan = el('button', { type: 'button', class: 'login-tautan', text: 'Pulihkan akses Pengelola' });
    var bawah = el('div', { class: 'login-bawah' }, [
      pulihkan,
      el('p', { class: 'login-versi', text: 'Versi ' + VERSI_APLIKASI })
    ]);
    var kotakLogin = el('div', { class: 'login' + (loginBukaSudah ? '' : ' login-buka') }, [kiri, kanan, bawah]);
    wadah.appendChild(latarLogin());
    wadah.appendChild(kotakLogin);
    // Pembuka Login (tampilan Bagian 8): sekali setiap aplikasi dibuka, tidak diulang saat berganti langkah.
    if (!loginBukaSudah) {
      loginBukaSudah = true;
      setTimeout(function () { kotakLogin.classList.remove('login-buka'); }, 1500);
    }

    pulihkan.addEventListener('click', function () {
      if (keadaan.sibuk) return;
      layarPulihkan(keadaan.info);
    });

    function tulisPesanLogin(teks, jenis) {
      kosongkan(pesan);
      if (!teks) return;
      if (jenis === 'proses') pesan.appendChild(el('span', { class: 'putar tampil', 'aria-hidden': 'true' }));
      else pesan.appendChild(ikon(jenis === 'baik' ? 'centang' : 'seru'));
      pesan.appendChild(el('span', { text: teks }));
    }

    function namaBisaMasuk() {
      return (keadaan.info && keadaan.info.staff || []).filter(function (s) { return s.punyaPin; });
    }

    /** Orang yang terakhir masuk di HP ini, jika masih bisa masuk (aktif dan punya PIN). */
    function penggunaTerakhir() {
      var nama = Simpan.baca(AWALAN + 'penggunaTerakhir');
      if (typeof nama !== 'string' || !nama) return null;
      var kecil = nama.toLowerCase();
      return namaBisaMasuk().filter(function (s) { return s.nama.toLowerCase() === kecil; })[0] || null;
    }

    /** Langkah pertama: sapa pengguna terakhir, atau daftar nama. */
    function mulaiLangkah() {
      var terakhir = keadaan.ingat && keadaan.info ? penggunaTerakhir() : null;
      if (terakhir) tampilPin(terakhir.nama);
      else tampilNama();
    }

    function inisial(nama) {
      return String(nama).trim().charAt(0).toUpperCase();
    }

    /** "Keluar otomatis karena 5 menit tidak dipakai. …" di atas pilihan nama atau sapaan. */
    function tambahKeterangan(tempat) {
      if (!keadaan.keterangan) return;
      (tempat || kanan).appendChild(el('p', { class: 'pesan-login keterangan-login', role: 'status' }, [
        ikon('info'),
        el('span', { text: keadaan.keterangan })
      ]));
    }

    /* ----- Langkah 1: pilih nama ----- */
    function tampilNama() {
      keadaan.nama = '';
      keadaan.pin = '';
      kotakLogin.classList.remove('langkah-pin');
      kosongkan(kiri).appendChild(merek.wadah);
      kiri.appendChild(pesan);
      kosongkan(kanan);
      tambahKeterangan();
      kanan.appendChild(el('div', { class: 'deret-tombol' }, [
        el('p', { class: 'login-tanya', text: 'Siapa yang masuk?' }),
        penanda
      ]));
      if (!keadaan.info) {
        var kerangka = el('div', { class: 'nama-grid', 'aria-hidden': 'true' });
        for (var i = 0; i < 3; i++) kerangka.appendChild(el('span', { class: 'kerangka', style: 'height:96px' }));
        kanan.appendChild(kerangka);
        return;
      }
      // Kembali dari langkah PIN: tombol nama masuk lagi bertahap (pembuka sudah lewat).
      var grid = el('div', { class: 'nama-grid' + (keadaan.gerakNama ? ' langkah-masuk' : '') });
      keadaan.gerakNama = false;
      var namaTerakhir = String(Simpan.baca(AWALAN + 'penggunaTerakhir') || '').toLowerCase();
      namaBisaMasuk().forEach(function (s, i) {
        var tunggu = Antrean.jumlah(s.nama);
        var terakhir = s.nama.toLowerCase() === namaTerakhir;
        grid.appendChild(el('button', {
          type: 'button',
          class: 'tombol-nama' + (terakhir ? ' terakhir' : ''),
          style: '--i:' + Math.min(i, 7),
          'aria-label': s.nama + (terakhir ? ', terakhir masuk' : '') + (tunggu ? ', ' + tunggu + ' isian menunggu kirim' : ''),
          onclick: function () {
            if (keadaan.sibuk) return;
            tulisPesanLogin('');
            keadaan.keterangan = '';
            tampilPin(s.nama);
          }
        }, [
          el('span', { class: 'tombol-nama-inisial', 'aria-hidden': 'true', text: inisial(s.nama) }),
          el('span', { class: 'tombol-nama-teks', 'aria-hidden': 'true' }, [
            el('span', { class: 'tombol-nama-nama', text: s.nama }),
            terakhir ? el('span', { class: 'tombol-nama-ket', text: 'Terakhir masuk' }) : null,
            // Isian di antrean menunggu sampai pengisinya masuk lagi (Bagian 7.2).
            tunggu ? el('span', { class: 'tombol-nama-ket', text: tunggu + ' isian menunggu kirim' }) : null
          ])
        ]));
      });
      kanan.appendChild(grid);
    }

    /* ----- Langkah 2: PIN ----- */
    var titikGrup = null;
    var tombolAngka = [];

    function tampilPin(nama) {
      keadaan.nama = nama;
      keadaan.pin = '';
      kotakLogin.classList.add('langkah-pin');
      kosongkan(kiri).appendChild(merek.wadah);
      tambahKeterangan(kiri);
      var tunggu = Antrean.jumlah(nama);
      kiri.appendChild(el('div', { class: 'login-sapa' }, [
        el('span', { class: 'login-sapa-inisial', 'aria-hidden': 'true', text: inisial(nama) }),
        el('h2', { class: 'login-sapa-nama', text: 'Halo, ' + nama }),
        el('p', { class: 'login-sapa-ket', text: 'Masukkan PIN untuk masuk' }),
        // Isian di antrean menunggu sampai pengisinya masuk lagi (Bagian 7.2).
        tunggu ? el('p', { class: 'login-sapa-ket', text: tunggu + ' isian menunggu kirim' }) : null
      ]));
      titikGrup = el('div', { class: 'titik-grup', role: 'img', 'aria-label': 'PIN: 0 dari 6 angka' });
      for (var i = 0; i < PANJANG_PIN; i++) titikGrup.appendChild(el('span', { class: 'titik', style: '--i:' + i }));
      kiri.appendChild(titikGrup);
      kiri.appendChild(pesan);

      kosongkan(kanan);
      tombolAngka = [];
      var papan = el('div', { class: 'papan', role: 'group', 'aria-label': 'Papan angka PIN' });
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'hapus'].forEach(function (k, ki) {
        var t;
        if (k === '') {
          t = el('span', { class: 'papan-kosong', 'aria-hidden': 'true' });
        } else if (k === 'hapus') {
          t = el('button', { type: 'button', class: 'tombol-angka', 'aria-label': 'Hapus satu angka' }, ikon('hapusAngka'));
          t.addEventListener('click', hapusAngka);
          tombolAngka.push(t);
        } else {
          t = el('button', { type: 'button', class: 'tombol-angka', text: k });
          t.addEventListener('click', function () { ketikAngka(k); });
          tombolAngka.push(t);
        }
        t.style.setProperty('--i', ki); // tombol angka masuk bertahap (app.css)
        papan.appendChild(t);
      });
      kanan.appendChild(papan);
      kanan.appendChild(el('div', { class: 'login-pilihan' }, [
        el('button', {
          type: 'button',
          class: 'login-tautan',
          // Nama depan saja, supaya nama panjang tidak membuat tautan dua baris.
          text: 'Bukan ' + String(nama).trim().split(/\s+/)[0] + '? Ganti nama',
          onclick: function () {
            if (keadaan.sibuk) return;
            tulisPesanLogin('');
            keadaan.ingat = false;
            keadaan.keterangan = '';
            keadaan.gerakNama = true;
            tampilNama();
          }
        }),
        el('button', {
          type: 'button',
          class: 'login-tautan',
          text: 'Lupa PIN?',
          onclick: mintaResetPin
        })
      ]));
      gambarTitik();
    }

    function gambarTitik() {
      if (!titikGrup) return;
      Array.prototype.forEach.call(titikGrup.children, function (t, i) {
        t.classList.toggle('isi', i < keadaan.pin.length);
      });
      titikGrup.setAttribute('aria-label', 'PIN: ' + keadaan.pin.length + ' dari 6 angka');
    }

    function ketikAngka(k) {
      if (keadaan.sibuk || !keadaan.nama || keadaan.pin.length >= PANJANG_PIN) return;
      if (keadaan.pin.length === 0) tulisPesanLogin('');
      keadaan.pin += k;
      gambarTitik();
      if (keadaan.pin.length === PANJANG_PIN) kirimPin();
    }

    function hapusAngka() {
      if (keadaan.sibuk || !keadaan.pin) return;
      keadaan.pin = keadaan.pin.slice(0, -1);
      gambarTitik();
    }

    function aturSibuk(b) {
      keadaan.sibuk = b;
      tombolAngka.forEach(function (t) { t.disabled = b; });
    }

    function kirimPin() {
      aturSibuk(true);
      tulisPesanLogin('Memeriksa PIN…', 'proses');
      panggilApi('login', Object.assign({ nama: keadaan.nama, pin: keadaan.pin }, isiBerandaLogin())).then(function (data) {
        login = null;
        document.removeEventListener('keydown', ketikKeyboard);
        ketikLoginKini = null;
        simpanSesiBaru(data);
        masukAplikasi();
      }).catch(function (err) {
        aturSibuk(false);
        keadaan.pin = '';
        gambarTitik();
        tulisPesanLogin(pesanGalat(err), 'masalah');
        titikGrup.classList.remove('goyang');
        void titikGrup.offsetWidth;
        titikGrup.classList.add('goyang');
      });
    }

    function mintaResetPin() {
      if (keadaan.sibuk) return;
      var nama = keadaan.nama;
      konfirmasi({
        judul: 'Lupa PIN?',
        teks: 'Kirim permintaan reset PIN untuk ' + nama + '?',
        teksYa: 'Kirim permintaan',
        teksProses: 'Mengirim…',
        jalankan: function () {
          return panggilApi('lupaPin', { nama: nama });
        }
      }).then(function (hasil) {
        if (!hasil) return;
        tulisPesanLogin(hasil.sudahAda
          ? 'Permintaan sudah dikirim ' + waktuSingkat(hasil.waktu) + '.'
          : PESAN.lupaPinTerkirim, 'baik');
      });
    }

    /* Laptop/desktop: angka bisa diketik di papan ketik. */
    function ketikKeyboard(e) {
      if (login !== kendali || lembarKini || !keadaan.nama || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        ketikAngka(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        hapusAngka();
      }
    }
    if (ketikLoginKini) document.removeEventListener('keydown', ketikLoginKini);
    ketikLoginKini = ketikKeyboard;
    document.addEventListener('keydown', ketikKeyboard);

    var kendali = {
      perbarui: function (infoBaru) {
        keadaan.info = infoBaru;
        merek.outlet.textContent = infoBaru.namaOutlet || '';
        penanda.textContent = '';
        if (!keadaan.nama) {
          mulaiLangkah();
          return;
        }
        var masihAda = namaBisaMasuk().some(function (s) { return s.nama === keadaan.nama; });
        if (!masihAda && !keadaan.sibuk) {
          tampilNama();
          tulisPesanLogin('Nama itu tidak bisa masuk lagi. Pilih nama lain atau minta bantuan Pengelola.', 'masalah');
        }
      },
      gagalMuat: function (teks) {
        if (keadaan.info) {
          penanda.textContent = 'Belum diperbarui.';
          if (!keadaan.nama) tulisPesanLogin(teks, 'masalah');
          return;
        }
        kosongkan(kanan);
        tambahKeterangan();
        kanan.appendChild(el('div', { class: 'deret-tombol' }, el('p', { class: 'login-tanya', text: 'Siapa yang masuk?' })));
        tulisPesanLogin(teks, 'masalah');
        kanan.appendChild(tombol('Coba lagi', 'kedua', {
          onclick: function () {
            tulisPesanLogin('');
            tampilNama();
            ambilInfoLogin();
          }
        }));
      }
    };
    login = kendali;

    mulaiLangkah();
    if (memuat && info) penanda.textContent = PESAN.memperbarui;
    if (pesanAwal) tulisPesanLogin(pesanAwal, 'masalah');
  }

  function aturJudulDokumen(judul) {
    document.title = judul + ' — InventoryKu';
  }

  /** Kepala navy tipis untuk layar terang tanpa sesi. */
  function kepalaMasuk(judul, kembali) {
    return el('header', { class: 'masuk-kepala' }, el('div', { class: 'masuk-kepala-isi' }, [
      kembali ? el('button', {
        type: 'button',
        class: 'tombol-kembali',
        'aria-label': 'Kembali ke layar Login',
        onclick: kembali
      }, ikon('kiri')) : null,
      el('h1', { text: judul })
    ]));
  }

  /* =======================================================================
   * Pemasangan pertama (spesifikasi sistem Bagian 7.2)
   * ===================================================================== */

  function layarPasang(info) {
    login = null;
    tampilMode('masuk');
    aturJudulDokumen('Pemasangan pertama');
    var wadah = $('#masuk');
    wadah.className = 'masuk terang';
    kosongkan(wadah);

    var zona = zonaWaktuPerangkat();
    var kKode = kolomIsian({
      label: 'Kode Pemasangan',
      bantuan: 'Ada di tab M_Konfigurasi di Google Sheet, baris kode_pemasangan.',
      kelas: 'isian-kode',
      maxlength: 12,
      atribut: { autocapitalize: 'characters', spellcheck: 'false' }
    });
    var kOutlet = kolomIsian({ label: 'Nama outlet', maxlength: 60, autocomplete: 'organization',
      nilai: info && info.namaOutlet ? info.namaOutlet : '' });
    var kNama = kolomIsian({ label: 'Nama kamu', maxlength: 40, autocomplete: 'name',
      bantuan: 'Nama ini tampil di layar Login.' });
    var gRole = grupPilihan('Role', ['Head Kitchen', 'Manager'], '');
    var kPin = kolomPin('PIN (6 angka)');
    var kUlang = kolomPin('Ulangi PIN');
    var pesan = el('p', { class: 'pesan-formulir', role: 'alert' });
    var kirim = tombol('Pasang InventoryKu', 'utama', { type: 'submit', class: 'tombol-lebar' });

    var form = el('form', { class: 'kartu formulir', novalidate: true }, [
      kKode.wadah, kOutlet.wadah, kNama.wadah, gRole.wadah, kPin.wadah, kUlang.wadah,
      el('p', { class: 'kolom-bantuan', text: 'Zona waktu: ' + (zona || 'tidak terdeteksi') + ' (dari perangkat ini).' }),
      pesan,
      kirim
    ]);

    wadah.appendChild(kepalaMasuk('Pemasangan pertama'));
    wadah.appendChild(el('div', { class: 'masuk-isi' }, [
      el('p', { class: 'kartu-teks', text: 'Belum ada akun Head Kitchen atau Manager. Isi data di bawah untuk memasang InventoryKu. Sesudah ini, semua akun dikelola dari Pengaturan.' }),
      form
    ]));

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (kirim.disabled) return;
      tulisPesan(pesan, '');
      var ok = [
        kKode.galat(kKode.input.value.trim() ? '' : 'Isi Kode Pemasangan.'),
        kOutlet.galat(kOutlet.input.value.trim() ? '' : 'Isi nama outlet.'),
        kNama.galat(kNama.input.value.trim() ? '' : 'Isi nama kamu.'),
        gRole.galat(gRole.nilai() ? '' : 'Pilih Head Kitchen atau Manager.'),
        periksaPinGanda(kPin, kUlang)
      ];
      if (ok.indexOf(false) >= 0) {
        var salah = form.querySelector('[aria-invalid="true"]');
        if (salah) salah.focus();
        return;
      }
      aturTombolProses(kirim, true, 'Memasang…');
      panggilApi('pasang', {
        kode: kKode.input.value,
        namaOutlet: kOutlet.input.value,
        nama: kNama.input.value,
        role: gRole.nilai(),
        pin: kPin.input.value,
        zonaWaktu: zona,
        tanggal: isiBerandaLogin().tanggal,
        alamatAplikasi: isiBerandaLogin().alamatAplikasi
      }).then(function (data) {
        Simpan.hapus(AWALAN + 'infoLogin');
        simpanSesiBaru(data);
        masukAplikasi('Pemasangan selesai. Selamat datang, ' + data.pengguna.nama + '.');
      }).catch(function (err) {
        aturTombolProses(kirim, false);
        tulisPesan(pesan, pesanGalat(err), 'masalah');
        if (/Pemasangan sudah selesai/.test(pesanGalat(err))) {
          kirim.hidden = true;
          pesan.after(tombol('Ke layar Login', 'kedua', {
            class: 'tombol-lebar',
            onclick: function () { mulaiMasuk(''); }
          }));
        }
      });
    });
  }

  /* =======================================================================
   * Pulihkan akses Pengelola (spesifikasi sistem Bagian 7.2)
   * ===================================================================== */

  function layarPulihkan(info) {
    login = null;
    nomorLayar++;
    aturJudulDokumen('Pulihkan akses Pengelola');
    var wadah = $('#masuk');
    wadah.className = 'masuk terang';
    kosongkan(wadah);
    function kembali() {
      mulaiMasuk('');
    }

    var pengelola = (info && info.staff || []).filter(function (s) { return s.pengelola; })
      .map(function (s) { return s.nama; });
    var kKode = kolomIsian({
      label: 'Kode Pemasangan baru',
      kelas: 'isian-kode',
      maxlength: 12,
      atribut: { autocapitalize: 'characters', spellcheck: 'false' }
    });
    var gNama = grupPilihan('Nama Head Kitchen atau Manager', pengelola, pengelola.length === 1 ? pengelola[0] : '');
    var kPin = kolomPin('PIN baru (6 angka)');
    var kUlang = kolomPin('Ulangi PIN baru');
    var pesan = el('p', { class: 'pesan-formulir', role: 'alert' });
    var kirim = tombol('Buat PIN baru', 'utama', { type: 'submit', class: 'tombol-lebar' });
    var form = el('form', { class: 'kartu formulir', novalidate: true }, [
      kKode.wadah,
      pengelola.length ? gNama.wadah : el('p', { class: 'pesan-formulir tinjau' }, [ikon('info'),
        el('span', { text: 'Belum ada nama Head Kitchen atau Manager yang aktif. Muat ulang layar Login.' })]),
      kPin.wadah, kUlang.wadah, pesan, kirim
    ]);

    wadah.appendChild(kepalaMasuk('Pulihkan akses Pengelola', kembali));
    wadah.appendChild(el('div', { class: 'masuk-isi' }, [
      el('p', { class: 'kartu-teks', text: 'Untuk keadaan darurat saat tidak ada Head Kitchen atau Manager yang bisa masuk. Pemilik Sheet menjalankan buatKodePemasangan di editor Apps Script; kode barunya ada di tab M_Konfigurasi.' }),
      form
    ]));

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (kirim.disabled) return;
      tulisPesan(pesan, '');
      var ok = [
        kKode.galat(kKode.input.value.trim() ? '' : 'Isi Kode Pemasangan.'),
        pengelola.length ? gNama.galat(gNama.nilai() ? '' : 'Pilih nama.') : false,
        periksaPinGanda(kPin, kUlang)
      ];
      if (ok.indexOf(false) >= 0) {
        var salah = form.querySelector('[aria-invalid="true"]');
        if (salah) salah.focus();
        return;
      }
      aturTombolProses(kirim, true, 'Menyimpan…');
      panggilApi('pulihkan', {
        kode: kKode.input.value,
        nama: gNama.nilai(),
        pin: kPin.input.value,
        tanggal: isiBerandaLogin().tanggal,
        alamatAplikasi: isiBerandaLogin().alamatAplikasi
      }).then(function (data) {
        simpanSesiBaru(data);
        masukAplikasi('PIN baru tersimpan. Selamat datang, ' + data.pengguna.nama + '.');
      }).catch(function (err) {
        aturTombolProses(kirim, false);
        tulisPesan(pesan, pesanGalat(err), 'masalah');
      });
    });
  }

  /* =======================================================================
   * Beranda: rel tiket dan kemajuan hari ini (spesifikasi tampilan Bagian 5.2)
   * ===================================================================== */

  /** Ikon tiap form bawaan di tiket (versi 1.7); form kustom memakai ikon lembar (laporan). */
  var IKON_FORM = { STOCK: 'kotak', SUHU: 'termometer', PREP: 'resep', WASTE: 'sampah' };

  var STATUS_TIKET = {
    belum: { jenis: 'menunggu', kata: 'Belum diisi' },
    sebagian: { jenis: 'menunggu', kata: '' }, // memakai detail, misalnya "7 dari 9 pengecekan"
    terkirim: { jenis: 'baik', kata: 'Terkirim' },
    nihil: { jenis: 'menunggu', kata: 'Nihil' }
  };

  function layarBeranda(k) {
    aturJudul('Beranda');
    var sesi = k.sesi;
    var cacheAwal = Cache.baca('beranda');
    var pembuka = !pembukaSudah;

    var penanda = el('span', { class: 'memperbarui', role: 'status' });
    var outlet = el('span', { class: 'beranda-outlet', text: sesi.namaOutlet || (cacheAwal && cacheAwal.data.namaOutlet) || '' });
    var namaPengguna = el('span', { text: sesi.pengguna.nama });
    var kemajuanTeks = el('p', { class: 'kemajuan-teks', role: 'status' });
    var rel = el('div', { class: 'rel', 'aria-hidden': 'true' });
    var grid = el('div', { class: 'tiket-grid', role: 'group', 'aria-label': 'Form hari ini' });
    var bawah = el('div', { class: 'beranda-bawah' });

    // Tanggal dua baris (tampilan Bagian 5.2, versi 1.7): nama hari, lalu tanggal besar.
    var bagianTanggal = tanggalPanjang(new Date()).split(', ');
    var kepala = el('section', { class: 'beranda-kepala', 'aria-label': 'Hari ini' }, el('div', { class: 'beranda-kepala-isi' }, [
      el('div', { class: 'beranda-merek', 'aria-hidden': 'true' }, [lencana(), namaMerek('beranda-merek-nama')]),
      el('p', { class: 'beranda-tanggal' }, [
        el('span', { class: 'beranda-hari', text: bagianTanggal[0] }),
        el('span', { class: 'sr', text: ', ' }),
        el('span', { text: bagianTanggal.slice(1).join(', ') })
      ]),
      el('div', { class: 'beranda-baris' }, [outlet, el('span', { class: 'sinyal' })]),
      el('div', { class: 'beranda-baris' }, [
        el('button', {
          type: 'button',
          class: 'beranda-pengguna',
          'aria-haspopup': 'menu',
          'aria-expanded': 'false',
          'aria-label': sesi.pengguna.nama + ', menu pengguna',
          onclick: bukaMenuPengguna
        }, [ikon('pengguna'), namaPengguna, ikon('bawah')]),
        penanda
      ]),
      el('div', { class: 'kemajuan' }, [kemajuanTeks, rel])
    ]));

    var root = el('div', { class: 'beranda' + (pembuka ? ' pembuka' : '') }, [
      kepala,
      el('section', { class: 'beranda-tiket' }, grid),
      bawah
    ]);
    k.wadah.appendChild(root);
    pembukaSudah = true;

    var tiketSudahTampil = false;
    var statusSebelum = {};
    var selesaiSebelum = null;

    function kerangka() {
      kosongkan(grid);
      for (var i = 0; i < 4; i++) grid.appendChild(el('span', { class: 'tiket kerangka kerangka-kartu', 'aria-hidden': 'true' }));
    }

    function gambar(data, dariHp) {
      // Data tersimpan dari hari lain: daftar form tetap, statusnya kembali "Belum diisi".
      if (data.tanggal !== tanggalIso(new Date())) {
        data = Object.assign({}, data, {
          form: (data.form || []).map(function (f) {
            return Object.assign({}, f, { status: 'belum', lengkap: false, detail: null, terakhir: null });
          }),
          masaSimpan: null
        });
      }
      if (data.namaOutlet) outlet.textContent = data.namaOutlet;
      if (!dariHp && data.pengguna) perbaruiPengguna(data.pengguna, data.namaOutlet);
      if (!dariHp) simpanMenitKeluarOtomatis(data.keluarOtomatisMenit);

      var form = data.form || [];
      gambarTiket(form);
      gambarKemajuan(form);
      gambarPemberitahuan(data.permintaanReset || [], data.pemeriksaan || null, data.peringatanSistem || [], data.masaSimpan || null,
        data.opname || null, data.terkunci || []);
      dataTerakhir = data;
    }
    var dataTerakhir = null;

    function gambarTiket(form) {
      kosongkan(grid);
      if (!form.length) {
        grid.appendChild(kotakKosong('Belum ada form yang tampil. Pengelola mengatur form di Pengaturan.'));
        return;
      }
      var gerak = !tiketSudahTampil && !transisiAktif;
      form.forEach(function (f, i) {
        var st = STATUS_TIKET[f.status] || STATUS_TIKET.belum;
        var kataTiket = st.kata || f.detail || 'Belum diisi';
        // Form kustom di luar jadwalnya tidak ditagih (Bagian 5.8): tiketnya tidak menulis "Belum diisi".
        if (f.status === 'belum' && !f.wajib) kataTiket = f.jadwal === 'sewaktu-waktu' ? 'Sewaktu-waktu' : 'Tidak dijadwalkan hari ini';
        var tanda = tandaStatus(st.jenis, kataTiket);
        var lama = statusSebelum[f.id];
        if (lama && lama !== f.status && (f.status === 'terkirim' || f.status === 'nihil')) {
          tanda.classList.add('cap');
        }
        statusSebelum[f.id] = f.status;
        var ket = [];
        if (f.status === 'terkirim' && f.detail) ket.push(f.detail);
        if (f.terakhir) ket.push(jam(f.terakhir.waktu) + ', ' + f.terakhir.oleh);
        var tunggu = antreanForm(f.id, tanggalIso(new Date())).length;
        if (tunggu) ket.push(tunggu + ' isian menunggu kirim');
        // Baris sobek (versi 1.7): siapa dan kapan terakhir mengisi, atau apakah form ditagih hari ini.
        if (!ket.length) ket.push(f.wajib ? 'Wajib hari ini' : 'Tidak ditagih hari ini');
        var tiket = el('button', {
          type: 'button',
          class: 'tiket' + (gerak && i < 8 ? ' gerak' : ''),
          'data-form': f.id,
          style: gerak && i < 8 ? '--urut:' + i : null,
          onclick: function () {
            if (LAYAR_FORM[f.id]) location.hash = LAYAR_FORM[f.id];
            else if (f.jenis === 'kustom') location.hash = hrefFormKustom(f.id);
            else toast(PESAN.formBelumDibangun, 'info');
          }
        }, [
          el('span', { class: 'tiket-ikon' }, ikon(IKON_FORM[f.id] || 'laporan')),
          el('span', { class: 'tiket-nama', text: f.nama }),
          tanda,
          el('span', { class: 'tiket-sobek' }, [el('span', { class: 'tiket-ket', text: ket.join(' · ') }), ikon('kanan')])
        ]);
        grid.appendChild(tiket);
      });
      tiketSudahTampil = true;
    }

    /** Rel: satu ruas per form wajib hari itu, dalam urutan tiket; menyala saat formnya lengkap. */
    function gambarKemajuan(form) {
      var wajib = form.filter(function (f) { return f.wajib; });
      var lengkap = wajib.filter(function (f) { return f.lengkap; }).length;
      var ruas = rel.children;
      if (ruas.length !== wajib.length) {
        kosongkan(rel);
        wajib.forEach(function (f) {
          rel.appendChild(el('span', { class: 'rel-ruas' + (f.lengkap ? ' nyala' : ''), 'data-form': f.id }));
        });
      } else {
        wajib.forEach(function (f, i) {
          ruas[i].setAttribute('data-form', f.id);
          ruas[i].classList.toggle('nyala', !!f.lengkap);
        });
      }
      rel.hidden = wajib.length === 0;

      var selesai = wajib.length > 0 && lengkap === wajib.length;
      rel.classList.toggle('selesai', selesai);
      kosongkan(kemajuanTeks);
      kemajuanTeks.classList.toggle('selesai', selesai);
      if (selesai) {
        kemajuanTeks.appendChild(ikon('centang'));
        kemajuanTeks.appendChild(el('span', { text: 'Semua form hari ini sudah terisi' }));
      } else if (wajib.length === 0) {
        kemajuanTeks.appendChild(el('span', { text: 'Tidak ada form wajib hari ini' }));
      } else {
        kemajuanTeks.appendChild(el('span', {}, [el('strong', { class: 'kemajuan-angka', text: String(lengkap) }),
          ' dari ' + wajib.length + ' form terisi']));
      }
      // Momen selesai: tulisan berganti dengan memudar, sekali.
      if (selesai && selesaiSebelum === false) {
        kemajuanTeks.classList.remove('ganti');
        void kemajuanTeks.offsetWidth;
        kemajuanTeks.classList.add('ganti');
        rel.classList.remove('kilau');
        void rel.offsetWidth;
        rel.classList.add('kilau'); // kilau sekali lewat di rel (versi 1.8)
      }
      selesaiSebelum = selesai;
    }

    /**
     * Pengelola: "NAMA meminta reset PIN" (paling atas; ketuk untuk membuka
     * layar reset PIN staff itu), lalu jumlah isian belum diperiksa dan baris
     * dilaporkan keliru (ketuk untuk membuka Riwayat dengan filter itu).
     */
    function gambarPemberitahuan(permintaan, pemeriksaan, peringatan, masaSimpan, opname, terkunci) {
      kosongkan(bawah);
      // Lewat masa simpan dan Habis besok: untuk semua role (Tahap 6).
      var simpan = barisMasaSimpan(masaSimpan);
      if (simpan) bawah.appendChild(simpan);
      var baris = barisAntrean();
      if (baris) bawah.appendChild(baris);
      if (!sesiKini().pengguna.pengelola) return;
      // Pengingat stock opname yang lewat jadwal (Tahap 8), di bawah pemeriksaan.
      var pengingat = barisPengingatOpname(opname);
      if (pengingat) bawah.insertBefore(pengingat, bawah.firstChild);
      var periksa = barisPemeriksaan(pemeriksaan);
      if (periksa) bawah.insertBefore(periksa, bawah.firstChild);
      // Email laporan harian atau cadangan mingguan yang gagal (Tahap 4).
      if (peringatan && peringatan.length) {
        bawah.insertBefore(el('div', { class: 'daftar', role: 'group', 'aria-label': 'Peringatan sistem' }, peringatan.map(function (p) {
          return el('div', { class: 'daftar-baris peristiwa tetap' }, el('span', { class: 'daftar-baris-isi' }, [
            tandaStatus('masalah', 'Perlu perhatian'),
            el('span', { class: 'daftar-baris-ket', text: p + ' Rinciannya di tab M_Konfigurasi.' })
          ]));
        })), bawah.firstChild);
      }
      if (!permintaan.length && !terkunci.length) return;
      var daftar = el('div', { class: 'daftar', role: 'group', 'aria-label': 'Pemberitahuan' });
      permintaan.forEach(function (p) {
        daftar.appendChild(el('a', {
          class: 'daftar-baris pemberitahuan',
          href: '#/pengaturan/staff/' + encodeURIComponent(p.nama) + '/pin'
        }, [
          el('span', { class: 'daftar-baris-isi' }, [
            tandaStatus('tinjau', p.nama + ' meminta reset PIN'),
            el('span', { class: 'daftar-baris-ket', text: 'Diminta ' + waktuSingkat(p.waktu) + '. Ketuk untuk membuat PIN baru.' })
          ]),
          ikon('kanan')
        ]));
      });
      // Akun yang terkunci karena PIN salah (Code.gs v0.17), di bawah permintaan reset PIN.
      terkunci.forEach(function (a) {
        daftar.appendChild(el('a', { class: 'daftar-baris pemberitahuan', href: hrefStaff(a.nama, true) }, [
          el('span', { class: 'daftar-baris-isi' }, [
            tandaStatus('tinjau', a.nama + ' terkunci karena PIN salah'),
            el('span', { class: 'daftar-baris-ket', text: (a.panjang ? 'Salah berulang kali dalam 24 jam. ' : '') +
              'Terbuka sendiri ' + waktuSingkat(a.sampai) + '. Ketuk untuk membuat PIN baru.' })
          ]),
          ikon('kanan')
        ]));
      });
      bawah.insertBefore(daftar, bawah.firstChild);
    }

    function muat() {
      return muatData({
        kunciCache: 'beranda',
        cukupSimpanan: pakaiBerandaLogin,
        ambil: function () {
          // Alamat aplikasi untuk tautan di email harian (server hanya menyimpannya dari Pengelola).
          return panggilApi('beranda', { tanggal: tanggalIso(new Date()), alamatAplikasi: location.origin + location.pathname });
        },
        gambar: gambar,
        kerangka: kerangka,
        galat: function (pesan, cobaLagi) {
          kosongkan(grid);
          grid.appendChild(kotakGalat(pesan, cobaLagi));
        },
        penanda: penanda
      });
    }

    muat();
    segarkanLayar = muat;
    segarkanAntrean = function () {
      if (dataTerakhir) gambar(dataTerakhir, true);
    };
  }

  function sesiKini() {
    return Sesi.baca() || { pengguna: {} };
  }

  /** Role bisa berubah di server: perbarui sesi di HP dan menu. */
  function perbaruiPengguna(pengguna, namaOutlet) {
    var sesi = Sesi.baca();
    if (!sesi) return;
    var berubah = sesi.pengguna.pengelola !== pengguna.pengelola || sesi.pengguna.role !== pengguna.role;
    sesi.pengguna = pengguna;
    if (namaOutlet) sesi.namaOutlet = namaOutlet;
    Sesi.tulis(sesi);
    if (berubah) gambarMenu();
    else if (namaOutlet && $('#merek-outlet')) $('#merek-outlet').textContent = namaOutlet;
  }

  /* =======================================================================
   * Antrean kirim (spesifikasi sistem Bagian 11): isian tanpa sinyal
   * menunggu di HP dan dikirim saat aplikasi terbuka dan sinyal kembali.
   * ===================================================================== */

  /** Form yang sudah punya layar isi. */
  var LAYAR_FORM = { STOCK: '#/stock', WASTE: '#/waste', SUHU: '#/suhu', PREP: '#/prep' };

  function antreanForm(formId, tanggal) {
    var p = penggunaKini();
    if (!p) return [];
    return Antrean.daftar(p.nama).filter(function (e) {
      return e.formId === formId && (!tanggal || e.tanggal === tanggal);
    });
  }

  function simpanKeAntrean(entri) {
    var p = penggunaKini();
    if (!p) return;
    Antrean.tambah(p.nama, Object.assign({ dibuat: Date.now(), status: 'menunggu' }, entri));
    if (segarkanAntrean) segarkanAntrean();
  }

  var antreanJalan = false;

  /** Id foto bukti (di IndexedDB) yang dirujuk isian kirim; hanya kiriman Waste yang punya foto. */
  function idFotoIsian(isi) {
    return ((isi && isi.baris) || []).map(function (b) { return b && b.fotoId; }).filter(Boolean);
  }

  /**
   * Mengirim satu isian (dari layar atau antrean). Foto bukti yang dirujuk lewat
   * fotoId dibaca dari IndexedDB dan dikirim sebagai base64 di "foto"; batas waktu
   * panggilan ditambah 20 detik per foto (unggahan dan simpan ke Drive). Foto
   * yang sudah tidak ada di HP dikirim tanpa foto (jawaban.fotoHilang berisi nama
   * itemnya). Setelah berhasil, fotonya dihapus dari HP.
   */
  function kirimIsian(aksi, isi) {
    var ids = idFotoIsian(isi);
    if (!ids.length) return panggilApi(aksi, isi);
    var hilang = [];
    return Promise.all(isi.baris.map(function (b) {
      if (!b.fotoId) return b;
      return FotoHp.baca(b.fotoId).then(function (f) {
        var x = Object.assign({}, b);
        delete x.fotoId;
        if (f && f.data) x.foto = f.data;
        else hilang.push(b.item);
        return x;
      });
    })).then(function (baris) {
      var ada = baris.filter(function (b) { return b.foto; }).length;
      return panggilApi(aksi, Object.assign({}, isi, { baris: baris }),
        { batasWaktuMs: Math.min(BATAS_WAKTU_MS + ada * 20000, 180000) });
    }).then(function (hasil) {
      FotoHp.hapus(ids);
      if (hilang.length) hasil.fotoHilang = hilang;
      return hasil;
    });
  }

  /** Pesan sesudah kiriman Waste yang membawa foto: foto yang gagal disimpan server atau hilang dari HP. */
  function pesanFotoKiriman(hasil) {
    var bagian = [];
    if (hasil && hasil.fotoGagal && hasil.fotoGagal.length) {
      bagian.push('Foto bukti ' + daftarNama(hasil.fotoGagal) + ' gagal disimpan ke Drive, jadi waste itu tercatat tanpa foto.');
    }
    if (hasil && hasil.fotoHilang && hasil.fotoHilang.length) {
      bagian.push('Foto bukti ' + daftarNama(hasil.fotoHilang) + ' sudah tidak ada di HP, jadi dikirim tanpa foto.');
    }
    return bagian.join(' ');
  }

  /** "Tomat", "Tomat dan Selada", "Tomat, Selada, dan Wortel". */
  function daftarNama(nama) {
    if (nama.length < 3) return nama.join(' dan ');
    return nama.slice(0, -1).join(', ') + ', dan ' + nama[nama.length - 1];
  }

  /**
   * Foto dari kamera atau galeri diperkecil di HP sebelum disimpan (Tahap 11):
   * sisi terpanjang paling banyak 1280 px, JPEG mutu 0,7, latar putih untuk
   * gambar transparan. Arah foto mengikuti data EXIF (browser menerapkannya saat
   * gambar digambar ke canvas). Hasil: { data (base64), mime, ukuran (byte) }.
   */
  var SISI_FOTO_MAKS = 1280;
  var MUTU_FOTO = 0.7;
  var BATAS_FOTO_BYTE = 2 * 1024 * 1024; // sama dengan batas di server
  function perkecilFoto(file) {
    return new Promise(function (ok, gagal) {
      var url;
      try {
        url = URL.createObjectURL(file);
      } catch (err) {
        gagal(new Error('Foto tidak bisa dibaca. Coba foto lain.'));
        return;
      }
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.naturalWidth;
        var h = img.naturalHeight;
        if (!w || !h) {
          gagal(new Error('Foto tidak bisa dibaca. Coba foto lain.'));
          return;
        }
        var skala = Math.min(1, SISI_FOTO_MAKS / Math.max(w, h));
        var kanvas = document.createElement('canvas');
        kanvas.width = Math.max(1, Math.round(w * skala));
        kanvas.height = Math.max(1, Math.round(h * skala));
        var g = kanvas.getContext('2d');
        g.fillStyle = '#FFFFFF';
        g.fillRect(0, 0, kanvas.width, kanvas.height);
        g.drawImage(img, 0, 0, kanvas.width, kanvas.height);
        var dataUrl = kanvas.toDataURL('image/jpeg', MUTU_FOTO);
        var data = dataUrl.slice(dataUrl.indexOf(',') + 1);
        var ukuran = Math.floor(data.length * 3 / 4);
        if (!data || dataUrl.indexOf('data:image/jpeg') !== 0) {
          gagal(new Error('Foto tidak bisa diperkecil di HP ini. Coba foto lain.'));
          return;
        }
        if (ukuran > BATAS_FOTO_BYTE) {
          gagal(new Error('Foto terlalu besar (' + teksMb(ukuran) + ') walau sudah diperkecil. Batasnya ' + teksMb(BATAS_FOTO_BYTE) + '.'));
          return;
        }
        ok({ data: data, mime: 'image/jpeg', ukuran: ukuran });
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        gagal(new Error('Foto tidak bisa dibaca. Coba foto lain, atau ambil dengan kamera.'));
      };
      img.src = url;
    });
  }

  /** "240 KB" atau "1,4 MB". */
  function teksMb(byte) {
    if (byte < 1024 * 1024) return Math.max(1, Math.round(byte / 1024)) + ' KB';
    return String(Math.round(byte / 104857.6) / 10).replace('.', ',') + ' MB';
  }

  /**
   * Mengirim antrean pengguna yang sedang masuk, satu per satu, dengan
   * tokennya sendiri. Berhenti jika sinyal putus. Jika sesi habis, isian
   * tetap di HP sampai pengguna itu masuk lagi. Isian yang ditolak server
   * ditandai gagal (tidak dikirim berulang-ulang) dan bisa dikirim ulang
   * atau dihapus dari daftar isian di HP.
   */
  function kirimAntrean() {
    var sesi = Sesi.baca();
    if (!sesi || antreanJalan || navigator.onLine === false) return Promise.resolve(0);
    var nama = sesi.pengguna.nama;
    var daftar = Antrean.daftar(nama).filter(function (e) { return e.status !== 'gagal'; });
    if (!daftar.length) return Promise.resolve(0);
    antreanJalan = true;
    var terkirim = 0;
    var berhenti = null;
    var pesanFoto = [];
    return daftar.reduce(function (janji, e) {
      return janji.then(function () {
        if (berhenti) return null;
        return kirimIsian(e.aksi, e.isi).then(function (hasil) {
          Antrean.hapus(nama, e.id);
          terkirim++;
          var pf = pesanFotoKiriman(hasil);
          if (pf) pesanFoto.push(pf);
        }, function (err) {
          if (err && (err.jaringan || err.sesiBerakhir)) {
            berhenti = err;
            return;
          }
          Antrean.ubah(nama, e.id, { status: 'gagal', pesan: pesanGalat(err) });
        });
      });
    }, Promise.resolve()).then(function () {
      antreanJalan = false;
      if (berhenti && berhenti.sesiBerakhir) {
        tanganiSesiBerakhir(berhenti);
        return terkirim;
      }
      if (terkirim) {
        toast(terkirim + ' isian terkirim.' + (pesanFoto.length ? ' ' + pesanFoto.join(' ') : ''));
        if (segarkanLayar) segarkanLayar();
      }
      if (segarkanAntrean) segarkanAntrean();
      return terkirim;
    });
  }

  /**
   * Masa simpan di Beranda (tampilan Bagian 5.2): "Lewat masa simpan" (tanda
   * Masalah) dan "Habis besok" (tanda Perlu ditinjau), tiap baris dengan
   * "Catat sebagai waste". Tidak tampil jika keduanya kosong.
   */
  function barisMasaSimpan(ms) {
    if (!ms || (!(ms.lewat || []).length && !(ms.habisBesok || []).length)) return null;
    var daftar = el('ul', { class: 'daftar daftar-masa-simpan', 'aria-label': 'Masa simpan barang jadi' });
    function baris(x, lewat) {
      daftar.appendChild(el('li', { class: 'baris-tetap' }, [
        el('span', { class: 'baris-tetap-teks daftar-baris-isi' }, [
          tandaStatus(lewat ? 'masalah' : 'tinjau', lewat ? 'Lewat masa simpan' : 'Habis besok'),
          el('span', { class: 'daftar-baris-ket', text: teksMasaSimpan(x, lewat) })
        ]),
        tombol('Catat sebagai waste', 'kedua', {
          'aria-label': 'Catat ' + x.item + ' sebagai waste',
          onclick: function () { catatSebagaiWaste(x.item); }
        })
      ]));
    }
    (ms.lewat || []).forEach(function (x) { baris(x, true); });
    (ms.habisBesok || []).forEach(function (x) { baris(x, false); });
    return daftar;
  }

  /** Baris ringkas di Beranda: "2 isian menunggu kirim" / "1 isian gagal kirim". */
  function barisAntrean() {
    var p = penggunaKini();
    if (!p) return null;
    var daftar = Antrean.daftar(p.nama);
    if (!daftar.length) return null;
    var gagal = daftar.filter(function (e) { return e.status === 'gagal'; }).length;
    var tunggu = daftar.length - gagal;
    return el('div', { class: 'daftar', role: 'group', 'aria-label': 'Isian di HP' }, el('button', {
      type: 'button',
      class: 'daftar-baris',
      onclick: bukaLembarAntrean
    }, [
      el('span', { class: 'daftar-baris-isi' }, [
        el('span', { class: 'deret-tombol' }, [
          tunggu ? tandaStatus('menunggu', tunggu + ' isian menunggu kirim') : null,
          gagal ? tandaStatus('masalah', gagal + ' isian gagal kirim') : null
        ]),
        el('span', { class: 'daftar-baris-ket', text: 'Tersimpan di HP. Ketuk untuk melihat atau mengirim ulang.' })
      ]),
      ikon('kanan')
    ]));
  }

  /** Daftar isian di HP: status tiap isian, Kirim ulang, dan Hapus untuk yang gagal. */
  function bukaLembarAntrean() {
    var p = penggunaKini();
    if (!p) return;
    var daftar = Antrean.daftar(p.nama);
    var isi = el('ul', { class: 'daftar' });
    daftar.forEach(function (e) {
      var gagal = e.status === 'gagal';
      isi.appendChild(el('li', { class: 'baris-tetap' }, [
        el('span', { class: 'baris-tetap-teks' }, [
          el('span', { class: 'daftar-baris-judul', text: e.judul + ', ' + tanggalPendek(e.tanggal) }),
          el('br'),
          gagal ? tandaStatus('masalah', 'Gagal kirim') : tandaStatus('menunggu', 'Menunggu kirim'),
          gagal && e.pesan ? el('span', { class: 'daftar-baris-ket', text: ' ' + e.pesan }) : null
        ]),
        gagal ? tombol('Hapus', 'bahaya', {
          'aria-label': 'Hapus isian ' + e.judul,
          onclick: function () {
            konfirmasi({
              judul: 'Hapus isian ini?',
              teks: e.judul + ', ' + tanggalPendek(e.tanggal) + ' belum pernah terkirim. Isian ini hilang dari HP.',
              teksYa: 'Hapus',
              bahaya: true
            }).then(function (ya) {
              if (!ya) return;
              Antrean.hapus(p.nama, e.id);
              FotoHp.hapus(idFotoIsian(e.isi));
              toast('Isian dihapus dari HP.');
              if (segarkanAntrean) segarkanAntrean();
            });
          }
        }) : null
      ]));
    });
    bukaLembar({
      judul: 'Isian di HP',
      isi: daftar.length ? isi : el('p', { text: 'Semua isian sudah terkirim.' }),
      aksi: [
        { teks: 'Tutup', jenis: 'kedua' },
        {
          teks: 'Kirim ulang',
          jenis: 'utama',
          klik: function (t, l) {
            if (navigator.onLine === false) {
              toast('Belum terkirim. Periksa sinyal, lalu ketuk Kirim ulang.', 'masalah');
              return;
            }
            Antrean.simpan(p.nama, Antrean.daftar(p.nama).map(function (e) {
              return Object.assign({}, e, { status: 'menunggu', pesan: '' });
            }));
            l.tutup();
            jagaProses(kirimAntrean()).then(function (n) {
              var sisa = Antrean.daftar(p.nama).length;
              if (!n && sisa) toast('Belum terkirim. Periksa sinyal, lalu ketuk Kirim ulang.', 'masalah');
            });
          }
        }
      ]
    });
  }

  /* =======================================================================
   * Tanda nihil (spesifikasi sistem Bagian 5.8), dipakai semua form kecuali Suhu
   * ===================================================================== */

  /**
   * opsi: { formId, namaForm, tanggal, nihil: { oleh, waktu } | null,
   *         adaIsian, menunggu: entri antrean nihil | null, selesai(nihil) }
   * Mengembalikan elemen: keterangan nihil, atau tombol "Tidak ada hari ini"
   * selama belum ada isian pada tanggal itu.
   */
  function bagianNihil(opsi) {
    if (opsi.nihil) {
      return el('p', { class: 'baris-nihil' }, [
        tandaStatus('menunggu', 'Nihil'),
        el('span', { text: ' Ditandai nihil oleh ' + opsi.nihil.oleh + ', ' + jam(opsi.nihil.waktu) })
      ]);
    }
    if (opsi.menunggu) {
      return el('p', { class: 'baris-nihil' }, [tandaStatus('menunggu', 'Nihil menunggu kirim')]);
    }
    if (opsi.adaIsian) return null;
    var t = tombol('Tidak ada hari ini', 'kedua');
    t.addEventListener('click', function () {
      if (t.disabled) return;
      var isi = { submissionId: buatId(), formId: opsi.formId, tanggal: opsi.tanggal, waktuPerangkat: new Date().toISOString() };
      var kapan = opsi.tanggal === tanggalIso(new Date()) ? 'hari ini' : tanggalPendek(opsi.tanggal);
      var keAntrean = function () {
        simpanKeAntrean({ id: isi.submissionId, aksi: 'tandaiNihil', isi: isi, formId: opsi.formId,
          judul: opsi.namaForm + ' (nihil)', tanggal: opsi.tanggal });
        toast('Tersimpan di HP. Dikirim saat ada sinyal.');
      };
      if (navigator.onLine === false) {
        keAntrean();
        return;
      }
      aturTombolProses(t, true, 'Menyimpan…');
      jagaProses(panggilApi('tandaiNihil', isi)).then(function (hasil) {
        toast(opsi.namaForm + ' ditandai nihil untuk ' + kapan + '.');
        opsi.selesai(hasil.nihil);
      }).catch(function (err) {
        aturTombolProses(t, false);
        if (err && err.jaringan) {
          keAntrean();
          return;
        }
        if (tanganiSesiBerakhir(err)) return;
        toast(pesanGalat(err), 'masalah');
      });
    });
    return el('div', { class: 'baris-nihil' }, t);
  }

  /* =======================================================================
   * Form Stock Inventory Harian (spesifikasi sistem Bagian 5.5, tampilan 5.3)
   * ===================================================================== */

  var DESKTOP = '(min-width: 1024px)';

  /**
   * Draft per pengguna: { tanggal, kategori, isian: { kategori: { item:
   * { masuk, keluar, besar } } }, sid: { kategori: submissionId } }.
   * submissionId dibuat saat form dibuka dan diganti setelah terkirim.
   */
  function bacaDraftStock() {
    var d = Draft.baca('stock');
    var data = d && d.data ? d.data : {};
    return {
      tanggal: data.tanggal || '',
      kategori: data.kategori || '',
      isian: data.isian || {},
      sid: data.sid || {},
      pemasok: data.pemasok || '',
      waktu: d ? d.waktu : null
    };
  }

  /** Data stock yang tersimpan di HP. Untuk tanggal lain, stock dianggap tidak bergerak sejak data itu. */
  function dataStockDariHp(tanggal) {
    var c = Cache.baca('stock');
    if (!c || !c.data || !c.data.item) return null;
    var d = c.data;
    if (d.tanggal === tanggal) return d;
    return {
      tanggal: tanggal,
      kategori: d.kategori,
      item: d.item.map(function (i) {
        var stock = d.tanggal < tanggal ? i.akhir : i.awal;
        return Object.assign({}, i, { awal: stock, masuk: 0, keluar: 0, hasilPrep: 0, dipakaiPrep: 0, waste: 0, penyesuaian: 0, akhir: stock });
      }),
      kiriman: { jumlah: 0, terakhir: null },
      nihil: null,
      pembelianSiap: d.pembelianSiap,
      pemasok: d.pemasok,
      turunan: true
    };
  }

  /** "Hari ini: masuk 5, dipakai prep 1,5, waste 0,5" — yang bernilai nol tidak ditulis. */
  function teksTercatat(it) {
    var bagian = [];
    [['masuk', 'masuk'], ['keluar', 'keluar'], ['hasilPrep', 'hasil prep'], ['dipakaiPrep', 'dipakai prep'], ['waste', 'waste']]
      .forEach(function (k) {
        if (it[k[0]]) bagian.push(k[1] + ' ' + formatAngka(it[k[0]]));
      });
    if (it.penyesuaian) bagian.push('penyesuaian ' + (it.penyesuaian > 0 ? '+' : '') + formatAngka(it.penyesuaian));
    return bagian.join(', ');
  }

  /** Kepala kiriman di Riwayat: "Sayur, dari Sumber Segar" (pemasok diberi "dari" supaya tidak terbaca sebagai kategori). */
  function teksKepalaKiriman(kepala, kr) {
    return (kepala || []).map(function (kp) {
      var v = kr.kepala[kp.kunci];
      return v && kp.kunci === 'pemasok' ? 'dari ' + v : v;
    }).filter(Boolean).join(', ');
  }

  function layarStock(k) {
    aturJudul('Stock');
    var pengelola = !!k.sesi.pengguna.pengelola;
    var draft = bacaDraftStock();
    var hariIni = tanggalIso(new Date());
    var kemarin = geserHari(hariIni, -1);
    // Draft yang tanggalnya sudah lewat kembali ke hari ini (isiannya tetap).
    var tanggal = draft.tanggal === kemarin || (pengelola && draft.tanggal && draft.tanggal <= hariIni) ? draft.tanggal : hariIni;
    var data = null;
    var mediaDesktop = window.matchMedia(DESKTOP);

    var catatanDraft = el('p', { class: 'catatan-draft', 'aria-live': 'polite' });
    var penanda = el('span', { class: 'memperbarui', role: 'status' });
    var statusForm = el('div', { class: 'status-form' });
    var wadahItem = el('div');
    var pesan = el('p', { class: 'pesan-formulir', role: 'alert' });
    var penghitung = el('span', { class: 'penghitung', 'aria-live': 'polite' });
    var tombolKirim = tombol('Kirim stock', 'utama');
    var pilihKategori = el('select', { class: 'isian', id: 'pilih-kategori' });
    // Pemasok (aplikasi 0.23.0): satu untuk kiriman, tidak wajib; tampil jika server sudah siap.
    var pilihPemasok = el('select', { class: 'isian', id: 'pilih-pemasok' });
    var bantuanPemasok = el('p', { class: 'kolom-bantuan', id: 'bantuan-pemasok' });
    var kolomPemasok = el('div', { class: 'kolom' }, [el('label', { class: 'kolom-label', for: 'pilih-pemasok', text: 'Pemasok (tidak wajib)' }),
      pilihPemasok, bantuanPemasok]);
    kolomPemasok.hidden = true;

    // Tanggal: Hari ini / Kemarin, Pengelola punya "Tanggal lain".
    var pilihan = ['Hari ini', 'Kemarin'].concat(pengelola ? ['Tanggal lain'] : []);
    var nilaiPilihan = tanggal === hariIni ? 'Hari ini' : (tanggal === kemarin ? 'Kemarin' : 'Tanggal lain');
    var gTanggal = grupPilihan('Tanggal', pilihan, nilaiPilihan);
    var tanggalLain = el('input', { type: 'date', class: 'isian', max: hariIni, 'aria-label': 'Tanggal lain' });
    tanggalLain.value = tanggal;
    tanggalLain.hidden = nilaiPilihan !== 'Tanggal lain';
    gTanggal.wadah.appendChild(tanggalLain);
    gTanggal.input.forEach(function (i) {
      i.addEventListener('change', function () {
        var v = gTanggal.nilai();
        tanggalLain.hidden = v !== 'Tanggal lain';
        if (v === 'Hari ini') gantiTanggal(hariIni);
        else if (v === 'Kemarin') gantiTanggal(kemarin);
        else if (tanggalLain.value) gantiTanggal(tanggalLain.value);
      });
    });
    tanggalLain.addEventListener('change', function () {
      if (tanggalLain.value && tanggalLain.value <= hariIni) gantiTanggal(tanggalLain.value);
    });

    var kotakInfo = el('section', { class: 'kartu kotak-info', 'aria-label': 'Kotak info' }, [
      gTanggal.wadah,
      el('div', { class: 'kolom' }, [el('label', { class: 'kolom-label', for: 'pilih-kategori', text: 'Kategori' }), pilihKategori]),
      kolomPemasok,
      el('div', { class: 'lebar-penuh' }, [penanda, statusForm])
    ]);

    k.wadah.appendChild(el('div', { class: 'layar-isi layar-form' }, [
      tautanKembali('Beranda', '#/'),
      el('h1', { class: 'judul-layar', text: 'Stock Inventory' }),
      catatanDraft,
      kotakInfo,
      wadahItem,
      pesan,
      el('div', { class: 'bilah-kirim' }, [penghitung, tombolKirim])
    ]));

    function simpanDraft() {
      var waktu = Draft.simpan('stock', { tanggal: tanggal, kategori: draft.kategori, isian: draft.isian, sid: draft.sid, pemasok: draft.pemasok });
      var adaIsian = Object.keys(draft.isian).some(function (kat) {
        return Object.keys(draft.isian[kat]).some(function (n) {
          var x = draft.isian[kat][n];
          return x.masuk || x.keluar;
        });
      });
      catatanDraft.textContent = adaIsian && waktu ? 'Draft tersimpan ' + jam(new Date(waktu).toISOString()) : '';
    }
    if (draft.waktu) catatanDraft.textContent = 'Draft tersimpan ' + jam(new Date(draft.waktu).toISOString());

    function isianItem(nama) {
      var kat = draft.kategori;
      draft.isian[kat] = draft.isian[kat] || {};
      draft.isian[kat][nama] = draft.isian[kat][nama] || { masuk: '', keluar: '', besar: false, harga: '' };
      return draft.isian[kat][nama];
    }

    function sidKategori() {
      if (!draft.sid[draft.kategori]) {
        draft.sid[draft.kategori] = buatId();
        simpanDraft();
      }
      return draft.sid[draft.kategori];
    }

    function itemKategori() {
      return (data && data.item || []).filter(function (it) { return it.kategori === draft.kategori; });
    }

    /** Stock Akhir sementara: yang sudah tercatat + yang sedang diketik. */
    function hitung(it, isian) {
      var masuk = bacaAngka(isian.masuk);
      var keluar = bacaAngka(isian.keluar);
      var harga = bacaRupiah(isian.harga);
      var besar = isian.besar && it.satuanBesar;
      var masukDasar = masuk > 0 ? (besar ? masuk * it.isiSatuanBesar : masuk) : 0;
      return {
        masukSalah: masuk !== null && isNaN(masuk),
        keluarSalah: keluar !== null && isNaN(keluar),
        // Harga beli hanya dikirim untuk item yang masuk.
        harga: masukDasar > 0 && harga !== null && !isNaN(harga) ? harga : null,
        hargaSalah: masukDasar > 0 && harga !== null && isNaN(harga),
        masukDasar: bulat3(masukDasar),
        akhir: bulat3(it.akhir + masukDasar - (keluar > 0 ? keluar : 0)),
        terisi: String(isian.masuk || '').trim() !== '' || String(isian.keluar || '').trim() !== ''
      };
    }

    function perbaruiPenghitung() {
      var semua = itemKategori();
      var terisi = semua.filter(function (it) { return hitung(it, isianItem(it.nama)).terisi; }).length;
      penghitung.textContent = terisi + ' dari ' + semua.length + ' item terisi';
    }

    /** Peringatan di layar: Stock Akhir minus, atau di bawah stok minimum. Isian tetap bisa dikirim. */
    function peringatan(it, akhir, ringkas) {
      if (akhir < 0 && ringkas) return tandaStatus('masalah', 'Stock akhir minus');
      if (akhir < 0) {
        return el('p', { class: 'pesan-formulir masalah peringatan' }, [ikon('seru'),
          el('span', { text: 'Stock akhir minus. Periksa angka yang diketik, atau minta Pengelola meluruskan stock.' })]);
      }
      if (it.stokMin != null && akhir < it.stokMin) return tandaStatus('tinjau', 'Perlu reorder');
      return null;
    }

    /** Kolom isian angka + (untuk Tambah masuk) pilihan satuan besar. */
    function isianAngka(it, jenis, label, idBantuan) {
      var isian = isianItem(it.nama);
      var input = el('input', {
        class: 'isian isian-angka',
        type: 'text',
        inputmode: 'decimal',
        autocomplete: 'off',
        'data-kunci': it.nama + '|' + jenis,
        'aria-label': label + ' ' + it.nama,
        'aria-describedby': idBantuan || null
      });
      input.value = isian[jenis] || '';
      return input;
    }

    /** Satu item: kartu (HP dan tablet) atau baris tabel (laptop dan desktop). */
    function buatItem(it, nomor, modeTabel) {
      var isian = isianItem(it.nama);
      var idKonversi = 'konversi-' + nomor;
      var inMasuk = isianAngka(it, 'masuk', 'Tambah masuk', it.satuanBesar ? idKonversi : null);
      var inKeluar = isianAngka(it, 'keluar', 'Tambah keluar');
      var pilihSatuan = null;
      if (it.satuanBesar) {
        pilihSatuan = el('select', { class: 'isian pilih-satuan', 'aria-label': 'Satuan Tambah masuk ' + it.nama, 'data-kunci': it.nama + '|satuan' }, [
          el('option', { value: 'dasar', text: it.satuan }),
          el('option', { value: 'besar', text: it.satuanBesar })
        ]);
        pilihSatuan.value = isian.besar ? 'besar' : 'dasar';
      }
      var konversi = el('span', { class: 'konversi', id: idKonversi });
      var akhirTeks = el('span', { class: 'stock-akhir-angka' });
      var wadahPeringatan = el('span', { class: 'wadah-peringatan' });
      // Harga beli (aplikasi 0.23.0): per satuan yang diketik di Tambah masuk; di kartu baru tampil setelah Tambah masuk diisi.
      var adaHarga = !!(data && data.pembelianSiap);
      var inHarga = adaHarga ? isianAngka(it, 'harga', 'Harga beli') : null;
      if (inHarga) inHarga.setAttribute('inputmode', 'numeric');
      var labelHarga = el('label', { class: 'kolom-label' });
      var kolomHarga = adaHarga ? el('div', { class: 'kolom kolom-harga-beli' }, [labelHarga,
        el('div', { class: 'baris-angka' }, [el('span', { class: 'satuan-tetap', text: 'Rp' }), inHarga])]) : null;
      function satuanHarga() {
        return isian.besar && it.satuanBesar ? it.satuanBesar : it.satuan;
      }

      function perbarui() {
        var h = hitung(it, isian);
        inMasuk.setAttribute('aria-invalid', h.masukSalah ? 'true' : 'false');
        inKeluar.setAttribute('aria-invalid', h.keluarSalah ? 'true' : 'false');
        if (inHarga) {
          inHarga.setAttribute('aria-invalid', h.hargaSalah ? 'true' : 'false');
          labelHarga.textContent = 'Harga beli per ' + satuanHarga() + ' (tidak wajib)';
          if (modeTabel) inHarga.setAttribute('aria-label', 'Harga beli per ' + satuanHarga() + ' ' + it.nama);
          if (kolomHarga && !modeTabel) kolomHarga.hidden = !(h.masukDasar > 0 || String(isian.harga || '').trim());
        }
        kosongkan(akhirTeks).appendChild(angkaSatuan(h.akhir, modeTabel ? '' : it.satuan));
        akhirTeks.classList.toggle('minus', h.akhir < 0);
        konversi.textContent = isian.besar && it.satuanBesar && h.masukDasar > 0
          ? '= ' + formatAngka(h.masukDasar) + ' ' + it.satuan : '';
        kosongkan(wadahPeringatan);
        var p = peringatan(it, h.akhir, modeTabel);
        if (p) wadahPeringatan.appendChild(p);
        if (kartu) kartu.classList.toggle('masalah', h.akhir < 0);
        perbaruiPenghitung();
      }
      function ubah(jenis, nilai) {
        isian[jenis] = nilai;
        simpanDraft();
        perbarui();
      }
      inMasuk.addEventListener('input', function () { ubah('masuk', inMasuk.value); });
      inKeluar.addEventListener('input', function () { ubah('keluar', inKeluar.value); });
      if (inHarga) inHarga.addEventListener('input', function () { ubah('harga', inHarga.value); });
      if (pilihSatuan) pilihSatuan.addEventListener('change', function () { ubah('besar', pilihSatuan.value === 'besar'); });

      var tercatat = teksTercatat(it);
      var awalanTercatat = tanggal === hariIni ? 'Hari ini: ' : 'Tercatat: ';
      var kartu = null;
      var hasil;
      if (modeTabel) {
        hasil = el('tr', {}, [
          el('td', { class: 'angka', text: String(nomor) }),
          el('td', { class: 'nama-item' }, el('span', { class: 'daftar-baris-judul', text: it.nama })),
          el('td', { class: 'angka otomatis' }, angkaSatuan(it.awal)),
          el('td', { class: 'otomatis tercatat', text: tercatat || '–' }),
          el('td', {}, el('div', { class: 'baris-angka' }, [inMasuk, pilihSatuan, konversi])),
          adaHarga ? el('td', {}, inHarga) : null,
          el('td', {}, inKeluar),
          el('td', { class: 'angka otomatis' }, [akhirTeks, el('br'), wadahPeringatan]),
          el('td', { class: 'otomatis', text: it.satuan })
        ]);
      } else {
        kartu = el('article', { class: 'kartu-item', 'aria-label': it.nama }, [
          el('div', { class: 'kartu-item-kepala' }, [
            el('h2', { class: 'kartu-item-nama', text: it.nama }),
            el('span', { class: 'kartu-item-satuan', text: it.satuan })
          ]),
          el('p', { class: 'otomatis' }, ['Awal ', angkaSatuan(it.awal, it.satuan)]),
          tercatat ? el('p', { class: 'otomatis', text: awalanTercatat + tercatat }) : null,
          el('div', { class: 'kolom' }, [
            el('label', { class: 'kolom-label', text: 'Tambah masuk' }),
            el('div', { class: 'baris-angka' }, [inMasuk, pilihSatuan || el('span', { class: 'satuan-tetap', text: it.satuan })]),
            konversi
          ]),
          kolomHarga,
          el('div', { class: 'kolom' }, [
            el('label', { class: 'kolom-label', text: 'Tambah keluar' }),
            el('div', { class: 'baris-angka' }, [inKeluar, el('span', { class: 'satuan-tetap', text: it.satuan })])
          ]),
          el('div', { class: 'stock-akhir' }, [el('span', { class: 'otomatis', text: 'Stock akhir' }), akhirTeks]),
          wadahPeringatan
        ]);
        // Label menunjuk ke kolomnya.
        var label = kartu.querySelectorAll('label');
        inMasuk.id = 'masuk-' + nomor;
        inKeluar.id = 'keluar-' + nomor;
        label[0].setAttribute('for', inMasuk.id);
        label[label.length - 1].setAttribute('for', inKeluar.id);
        inMasuk.removeAttribute('aria-label');
        inKeluar.removeAttribute('aria-label');
        if (inHarga) {
          inHarga.id = 'harga-' + nomor;
          labelHarga.setAttribute('for', inHarga.id);
          inHarga.removeAttribute('aria-label');
        }
        hasil = kartu;
      }
      perbarui();
      return hasil;
    }

    /** Menggambar ulang daftar item; kolom yang sedang diketik tetap aktif. */
    function gambarItem() {
      var aktif = document.activeElement;
      var kunciAktif = aktif && aktif.getAttribute ? aktif.getAttribute('data-kunci') : null;
      var posisi = kunciAktif && typeof aktif.selectionStart === 'number' ? aktif.selectionStart : null;
      kosongkan(wadahItem);
      tulisPesan(pesan, '');
      var semua = itemKategori();
      if (!semua.length) {
        wadahItem.appendChild(kotakKosong(data && data.item && data.item.length
          ? 'Belum ada item aktif di kategori ini.'
          : 'Belum ada item. Pengelola mengisi daftar item dan kategori di tab M_Item dan M_Kategori.'));
        perbaruiPenghitung();
        return;
      }
      if (mediaDesktop.matches) {
        var badan = el('tbody');
        semua.forEach(function (it, i) { badan.appendChild(buatItem(it, i + 1, true)); });
        wadahItem.appendChild(el('div', { class: 'tabel-bingkai tabel-isian-bingkai' }, el('table', { class: 'tabel tabel-isian' }, [
          el('thead', {}, el('tr', {}, ['No', 'Nama Item', 'Stock Awal', 'Tercatat Hari Ini', 'Tambah Masuk']
            .concat(data.pembelianSiap ? ['Harga Beli (Rp)'] : [], ['Tambah Keluar', 'Stock Akhir', 'Satuan'])
            .map(function (j) { return el('th', { scope: 'col', class: ['No', 'Stock Awal', 'Stock Akhir'].indexOf(j) >= 0 ? 'angka' : null, text: j }); }))),
          badan
        ])));
      } else {
        var grid = el('div', { class: 'grid-item' });
        semua.forEach(function (it, i) { grid.appendChild(buatItem(it, i + 1, false)); });
        wadahItem.appendChild(grid);
      }
      if (kunciAktif) {
        var baru = wadahItem.querySelector('[data-kunci="' + kunciAktif.replace(/"/g, '\\"') + '"]');
        if (baru) {
          baru.focus({ preventScroll: true });
          if (posisi != null && baru.setSelectionRange) {
            try { baru.setSelectionRange(posisi, posisi); } catch (err) { /* select */ }
          }
        }
      }
    }

    function gambarStatus() {
      kosongkan(statusForm);
      if (!data) return;
      var menunggu = antreanForm('STOCK', tanggal);
      var kirimMenunggu = menunggu.filter(function (e) { return e.aksi === 'kirimStock'; });
      var nihilMenunggu = menunggu.filter(function (e) { return e.aksi === 'tandaiNihil'; })[0] || null;
      if (data.kiriman.jumlah) {
        var t = data.kiriman.terakhir;
        statusForm.appendChild(el('p', {}, [tandaStatus('baik', 'Terkirim'),
          el('span', { class: 'kolom-bantuan', text: ' ' + data.kiriman.jumlah + ' kiriman' + (t ? ', terakhir ' + jam(t.waktu) + ', ' + t.oleh : '') })]));
      }
      if (kirimMenunggu.length) statusForm.appendChild(tandaStatus('menunggu', kirimMenunggu.length + ' isian menunggu kirim'));
      var nihil = bagianNihil({
        formId: 'STOCK',
        namaForm: 'Stock',
        tanggal: tanggal,
        nihil: data.nihil,
        adaIsian: data.kiriman.jumlah > 0 || kirimMenunggu.length > 0,
        menunggu: nihilMenunggu,
        selesai: function (n) {
          data.nihil = n;
          gambarStatus();
        }
      });
      if (nihil) statusForm.appendChild(nihil);
    }

    function gambar(d) {
      data = d;
      var kat = d.kategori || [];
      kosongkan(pilihKategori);
      kat.forEach(function (n) { pilihKategori.appendChild(el('option', { value: n, text: n })); });
      if (kat.indexOf(draft.kategori) < 0) draft.kategori = kat[0] || '';
      pilihKategori.value = draft.kategori;
      pilihKategori.disabled = !kat.length;
      gambarPemasok();
      gambarStatus();
      gambarItem();
    }

    /** Pilihan pemasok: pemasok aktif dari server, ditambah pilihan di draft yang sudah tidak aktif. */
    function gambarPemasok() {
      kolomPemasok.hidden = !data.pembelianSiap;
      if (!data.pembelianSiap) return;
      var daftar = (data.pemasok || []).slice();
      if (draft.pemasok && daftar.indexOf(draft.pemasok) < 0) draft.pemasok = '';
      kosongkan(pilihPemasok);
      pilihPemasok.appendChild(el('option', { value: '', text: daftar.length ? 'Tanpa pemasok' : 'Belum ada pemasok' }));
      daftar.forEach(function (n) { pilihPemasok.appendChild(el('option', { value: n, text: n })); });
      pilihPemasok.value = draft.pemasok;
      pilihPemasok.disabled = !daftar.length;
      bantuanPemasok.textContent = daftar.length ? 'Berlaku untuk semua item yang masuk di kiriman ini.'
        : (pengelola ? 'Tambah pemasok di Pengaturan → Pemasok.' : 'Head Kitchen atau Manager menambah daftar pemasok di Pengaturan.');
    }

    pilihPemasok.addEventListener('change', function () {
      draft.pemasok = pilihPemasok.value;
      simpanDraft();
    });

    function terapkanJawaban(form) {
      Cache.tulis('stock', form);
      if (form.tanggal === tanggal) gambar(form);
    }

    function gantiTanggal(baru) {
      if (baru === tanggal) return;
      tanggal = baru;
      simpanDraft();
      muat();
    }

    pilihKategori.addEventListener('change', function () {
      draft.kategori = pilihKategori.value;
      simpanDraft();
      gambarItem();
    });

    function kosongkanKategori(kat) {
      delete draft.isian[kat];
      draft.sid[kat] = buatId();
      simpanDraft();
    }

    tombolKirim.addEventListener('click', function () {
      if (tombolKirim.disabled || !data) return;
      tulisPesan(pesan, '');
      var baris = [];
      var salah = null;
      itemKategori().forEach(function (it) {
        var isian = isianItem(it.nama);
        var h = hitung(it, isian);
        if (h.masukSalah || h.keluarSalah || (data.pembelianSiap && h.hargaSalah)) {
          if (!salah) salah = { it: it, jenis: h.masukSalah ? 'masuk' : (h.keluarSalah ? 'keluar' : 'harga') };
          return;
        }
        var masuk = bacaAngka(isian.masuk) || 0;
        var keluar = bacaAngka(isian.keluar) || 0;
        if (!masuk && !keluar) return; // item yang kedua kolomnya kosong tidak ikut terkirim
        var b = { item: it.nama, masuk: masuk, keluar: keluar, satuanMasuk: isian.besar && it.satuanBesar ? 'besar' : 'dasar' };
        if (data.pembelianSiap && h.harga != null) b.hargaBeli = h.harga;
        baris.push(b);
      });
      if (salah) {
        tulisPesan(pesan, salah.jenis === 'harga'
          ? 'Periksa harga beli ' + salah.it.nama + '. Isi rupiah, misalnya 15000 atau 15.000.'
          : 'Periksa angka ' + (salah.jenis === 'masuk' ? 'Tambah masuk' : 'Tambah keluar') + ' ' +
          salah.it.nama + '. Isi angka, misalnya 2,5.', 'masalah');
        var kolom = wadahItem.querySelector('[data-kunci="' + (salah.it.nama + '|' + salah.jenis).replace(/"/g, '\\"') + '"]');
        if (kolom) kolom.focus();
        return;
      }
      if (!baris.length) {
        tulisPesan(pesan, 'Isi Tambah masuk atau Tambah keluar minimal untuk satu item.', 'masalah');
        return;
      }
      var kat = draft.kategori;
      var isi = { submissionId: sidKategori(), tanggal: tanggal, kategori: kat, waktuPerangkat: new Date().toISOString(), baris: baris };
      if (data.pembelianSiap && draft.pemasok) isi.pemasok = draft.pemasok;
      var entri = { id: isi.submissionId, aksi: 'kirimStock', isi: isi, formId: 'STOCK', judul: 'Stock · ' + kat, tanggal: tanggal };
      function keAntrean() {
        simpanKeAntrean(entri);
        kosongkanKategori(kat);
        gambarStatus();
        gambarItem();
        toast('Tersimpan di HP. Dikirim saat ada sinyal.');
      }
      if (navigator.onLine === false) {
        keAntrean();
        return;
      }
      aturTombolProses(tombolKirim, true, 'Mengirim…');
      jagaProses(panggilApi('kirimStock', isi)).then(function (hasil) {
        aturTombolProses(tombolKirim, false);
        kosongkanKategori(kat);
        terapkanJawaban(hasil.form);
        toast('Stock terkirim.');
      }).catch(function (err) {
        aturTombolProses(tombolKirim, false);
        if (err && err.jaringan) {
          keAntrean();
          return;
        }
        if (err && err.sesiBerakhir) {
          // Isian tidak pernah hilang karena sesi habis: menunggu sampai pengguna ini masuk lagi.
          simpanKeAntrean(entri);
          kosongkanKategori(kat);
          tanganiSesiBerakhir(err);
          return;
        }
        tulisPesan(pesan, pesanGalat(err), 'masalah');
      });
    });

    function muat() {
      return muatData({
        dariHp: function () { return dataStockDariHp(tanggal); },
        simpanHp: function (d) { Cache.tulis('stock', d); },
        ambil: function () { return panggilApi('formStock', { tanggal: tanggal }); },
        gambar: function (d) {
          if (d.tanggal === tanggal) gambar(d);
        },
        kerangka: function () {
          kosongkan(wadahItem).appendChild(kerangkaBaris(4));
        },
        galat: function (teks, cobaLagi) {
          kosongkan(wadahItem).appendChild(kotakGalat(teks, cobaLagi));
        },
        penanda: penanda
      });
    }

    function gantiSusunan() {
      if (data) gambarItem();
    }
    if (mediaDesktop.addEventListener) mediaDesktop.addEventListener('change', gantiSusunan);
    else if (mediaDesktop.addListener) mediaDesktop.addListener(gantiSusunan);
    pembersihLayar.push(function () {
      if (mediaDesktop.removeEventListener) mediaDesktop.removeEventListener('change', gantiSusunan);
      else if (mediaDesktop.removeListener) mediaDesktop.removeListener(gantiSusunan);
    });

    muat();
    segarkanLayar = muat;
    segarkanAntrean = gambarStatus;
  }

  /* =======================================================================
   * Bersama untuk form Tahap 5: tanggal isian, rupiah, angka suhu
   * ===================================================================== */

  /** "Rp 30.000" */
  function formatRupiah(n) {
    if (n === '' || n == null || !isFinite(n)) return '–';
    return 'Rp ' + formatAngka(Math.round(n));
  }

  /** Angka suhu: boleh minus dan desimal ("-18", "−18", "3,5"). null = kosong, NaN = salah. */
  function bacaAngkaSuhu(teks) {
    var t = String(teks == null ? '' : teks).replace(/\s/g, '').replace('−', '-');
    if (t === '' || t === '-') return null;
    if (!/^-?\d+([.,]\d+)?$/.test(t)) return NaN;
    return Number(t.replace(',', '.'));
  }

  /**
   * Pilihan tanggal isian (tampilan Bagian 5.3): Hari ini / Kemarin; Pengelola
   * punya "Tanggal lain". opsi: { pengelola, tanggal, ganti(tanggalBaru) }.
   */
  function pilihanTanggalIsian(opsi) {
    var hariIni = tanggalIso(new Date());
    var kemarin = geserHari(hariIni, -1);
    var pilihan = ['Hari ini', 'Kemarin'].concat(opsi.pengelola ? ['Tanggal lain'] : []);
    var nilai = opsi.tanggal === hariIni ? 'Hari ini' : (opsi.tanggal === kemarin ? 'Kemarin' : 'Tanggal lain');
    var g = grupPilihan('Tanggal', pilihan, nilai);
    var lain = el('input', { type: 'date', class: 'isian', max: hariIni, 'aria-label': 'Tanggal lain' });
    lain.value = opsi.tanggal;
    lain.hidden = nilai !== 'Tanggal lain';
    g.wadah.appendChild(lain);
    g.input.forEach(function (i) {
      i.addEventListener('change', function () {
        var v = g.nilai();
        lain.hidden = v !== 'Tanggal lain';
        if (v === 'Hari ini') opsi.ganti(hariIni);
        else if (v === 'Kemarin') opsi.ganti(kemarin);
        else if (lain.value) opsi.ganti(lain.value);
      });
    });
    lain.addEventListener('change', function () {
      if (lain.value && lain.value <= hariIni) opsi.ganti(lain.value);
    });
    return g;
  }

  /** Tanggal draft yang masih boleh dipakai: kemarin untuk semua, tanggal lama hanya Pengelola; selebihnya hari ini. */
  function tanggalDraft(tanggal, pengelola) {
    var hariIni = tanggalIso(new Date());
    var kemarin = geserHari(hariIni, -1);
    return tanggal === kemarin || (pengelola && tanggal && tanggal <= hariIni) ? tanggal : hariIni;
  }

  /* =======================================================================
   * Form Pencatatan Waste (spesifikasi sistem Bagian 5.4, tampilan 5.3)
   * ===================================================================== */

  var KATEGORI_WASTE = ['Expired', 'Rusak', 'Sisa Produksi', 'Kesalahan Order', 'Lainnya'];
  var SHIFT = ['Pagi', 'Siang', 'Malam'];

  /**
   * Draft per pengguna: { tanggal, shift, baris: [{ id, item, kategori, qty,
   * alasan }], terbuka (id baris yang sedang diisi), sid }.
   */
  function bacaDraftWaste() {
    var d = Draft.baca('waste');
    var data = d && d.data ? d.data : {};
    return {
      tanggal: data.tanggal || '',
      shift: data.shift || '',
      baris: Array.isArray(data.baris) ? data.baris : [],
      terbuka: data.terbuka || '',
      sid: data.sid || '',
      waktu: d ? d.waktu : null
    };
  }

  /** Data waste di HP. Untuk tanggal lain tanpa sinyal: daftar item yang sama, tanpa catatan. */
  function dataWasteDariHp(tanggal) {
    var c = Cache.baca('waste');
    if (!c || !c.data || !c.data.item) return null;
    if (c.data.tanggal === tanggal) return c.data;
    return Object.assign({}, c.data, {
      tanggal: tanggal,
      kiriman: { jumlah: 0, terakhir: null, totalRp: 0, baris: [] },
      nihil: null,
      turunan: true
    });
  }

  /**
   * Geser kartu ke kiri untuk menghapus barisnya (tampilan Bagian 5.3), hanya untuk kartu
   * di HP dan tablet. touch-action: pan-y (CSS .kartu-geser) membiarkan gulir tegak tetap
   * milik browser; geseran mendatar ke kiri diambil lewat Pointer Events. Selama jari
   * menempel kartu mengikuti jari lewat transform (masukan langsung, bukan animasi per
   * bingkai). Lepas setelah lebih dari sepertiga lebar kartu: kartu keluar dengan transisi
   * CSS (.geser-keluar, 200 ms ease-in), lalu hapus() dipanggil, sama dengan ikon tempat
   * sampah. Lepas sebelum batas: kartu kembali (.geser-kembali). "Kurangi gerak": kartu
   * tidak mengikuti jari dan hapus() langsung dipanggil saat dilepas melewati batas.
   * Geseran yang dimulai di kolom isian diabaikan. Hanya sentuhan dan pena, bukan tetikus.
   */
  function pasangGeserHapus(kartu, hapus) {
    var AMBANG = 10; // px sebelum arah geseran diputuskan
    var p = null;
    kartu.classList.add('kartu-geser');

    function kurangiGerak() {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    function lepas() {
      if (p && kartu.hasPointerCapture && kartu.hasPointerCapture(p.id)) kartu.releasePointerCapture(p.id);
      p = null;
    }
    function kembali() {
      if (!kartu.style.transform) return;
      kartu.classList.add('geser-kembali');
      kartu.style.transform = '';
      setTimeout(function () { kartu.classList.remove('geser-kembali'); }, 200);
    }
    kartu.addEventListener('pointerdown', function (e) {
      if (p || e.pointerType === 'mouse' || !e.isPrimary) return;
      if (e.target.closest('input, textarea, select, [contenteditable]')) return;
      p = { id: e.pointerId, x: e.clientX, y: e.clientY, arah: '', lebar: kartu.getBoundingClientRect().width, dx: 0 };
    });
    kartu.addEventListener('pointermove', function (e) {
      if (!p || e.pointerId !== p.id) return;
      var dx = e.clientX - p.x;
      var dy = e.clientY - p.y;
      if (!p.arah) {
        if (Math.abs(dx) < AMBANG && Math.abs(dy) < AMBANG) return;
        if (dx >= 0 || Math.abs(dy) >= Math.abs(dx)) {
          p = null; // gulir tegak atau geser ke kanan: bukan urusan kartu
          return;
        }
        p.arah = 'kiri';
        kartu.classList.remove('geser-kembali');
        if (kartu.setPointerCapture) kartu.setPointerCapture(p.id);
      }
      p.dx = Math.min(0, dx);
      if (!kurangiGerak()) kartu.style.transform = 'translateX(' + p.dx + 'px)';
    });
    kartu.addEventListener('pointerup', function (e) {
      if (!p || e.pointerId !== p.id) return;
      var g = p;
      lepas();
      if (!g.arah) return;
      // Klik yang mungkin menyusul geseran tidak boleh membuka atau menekan isi kartu.
      function tahan(ev) {
        ev.stopPropagation();
        ev.preventDefault();
      }
      kartu.addEventListener('click', tahan, true);
      setTimeout(function () { kartu.removeEventListener('click', tahan, true); }, 400);
      if (-g.dx <= g.lebar / 3) {
        kembali();
        return;
      }
      if (kurangiGerak()) {
        hapus();
        return;
      }
      var selesai = false;
      function akhiri() {
        if (selesai) return;
        selesai = true;
        hapus();
      }
      kartu.addEventListener('transitionend', function (ev) {
        if (ev.target === kartu) akhiri();
      });
      setTimeout(akhiri, 250); // cadangan jika transitionend tidak datang
      kartu.classList.add('geser-keluar');
      kartu.style.transform = '';
    });
    kartu.addEventListener('pointercancel', function (e) {
      if (!p || e.pointerId !== p.id) return;
      lepas();
      kembali();
    });
  }

  function layarWaste(k) {
    aturJudul('Waste');
    var pengelola = !!k.sesi.pengguna.pengelola;
    // Nominal rupiah waste hanya untuk Head Kitchen dan Manager (keputusan pemilik 17 Oktober 2026).
    var rupiah = pengelola;
    var draft = bacaDraftWaste();
    var tanggal = tanggalDraft(draft.tanggal, pengelola);
    var data = null;
    var mediaDesktop = window.matchMedia(DESKTOP);

    var catatanDraft = el('p', { class: 'catatan-draft', 'aria-live': 'polite' });
    var penanda = el('span', { class: 'memperbarui', role: 'status' });
    var statusForm = el('div', { class: 'status-form' });
    var wadahBaris = el('div');
    var pesan = el('p', { class: 'pesan-formulir', role: 'alert' });
    var penghitung = el('span', { class: 'penghitung', 'aria-live': 'polite' });
    var tombolKirim = tombol('Kirim waste', 'utama');
    var pratinjau = {}; // id foto → data URL (pratinjau yang sudah dibaca dari IndexedDB)
    var pesanFoto = {}; // id baris → { teks, jenis } pesan foto di baris itu
    var tombolTambah = tombol('Tambah item', 'kedua', { 'aria-haspopup': 'dialog' });
    tombolTambah.insertBefore(ikon('tambah'), tombolTambah.lastChild);

    var gTanggal = pilihanTanggalIsian({ pengelola: pengelola, tanggal: tanggal, ganti: gantiTanggal });
    var gShift = grupPilihan('Shift', SHIFT, draft.shift);
    gShift.input.forEach(function (i) {
      i.addEventListener('change', function () {
        draft.shift = gShift.nilai();
        gShift.galat('');
        simpanDraft();
      });
    });

    k.wadah.appendChild(el('div', { class: 'layar-isi layar-form' }, [
      tautanKembali('Beranda', '#/'),
      el('h1', { class: 'judul-layar', text: 'Pencatatan Waste' }),
      catatanDraft,
      el('section', { class: 'kartu kotak-info', 'aria-label': 'Kotak info' }, [
        gTanggal.wadah,
        gShift.wadah,
        el('div', { class: 'lebar-penuh' }, [penanda, statusForm])
      ]),
      wadahBaris,
      el('div', { class: 'deret-tambah' }, tombolTambah),
      pesan,
      el('div', { class: 'bilah-kirim' }, [penghitung, tombolKirim])
    ]));

    function simpanDraft() {
      var waktu = Draft.simpan('waste', { tanggal: tanggal, shift: draft.shift, baris: draft.baris, terbuka: draft.terbuka, sid: draft.sid });
      catatanDraft.textContent = draft.baris.length && waktu ? 'Draft tersimpan ' + jam(new Date(waktu).toISOString()) : '';
    }
    if (draft.waktu && draft.baris.length) catatanDraft.textContent = 'Draft tersimpan ' + jam(new Date(draft.waktu).toISOString());

    function infoItem(nama) {
      var daftar = data && data.item || [];
      for (var i = 0; i < daftar.length; i++) if (daftar[i].nama === nama) return daftar[i];
      return { nama: nama, satuan: '', harga: null, kategori: '' };
    }

    /** Hasil pemeriksaan satu baris: { qty, salah: 'kategori' | 'qty' | 'alasan' | '' }. */
    function periksa(b) {
      var qty = bacaAngka(b.qty);
      if (KATEGORI_WASTE.indexOf(b.kategori) < 0) return { qty: qty, salah: 'kategori' };
      if (qty === null || isNaN(qty) || !(qty > 0)) return { qty: qty, salah: 'qty' };
      if (b.kategori === 'Lainnya' && !String(b.alasan || '').trim()) return { qty: qty, salah: 'alasan' };
      return { qty: qty, salah: '' };
    }

    function teksEstimasi(b) {
      var it = infoItem(b.item);
      var qty = bacaAngka(b.qty);
      if (it.harga == null) return 'Harga satuan belum diisi Pengelola';
      return formatRupiah(qty > 0 ? qty * it.harga : 0);
    }

    function perbaruiPenghitung() {
      var lengkap = draft.baris.filter(function (b) { return !periksa(b).salah; }).length;
      penghitung.textContent = draft.baris.length
        ? lengkap + ' dari ' + draft.baris.length + ' item lengkap'
        : 'Belum ada item';
    }

    function hapusBaris(b) {
      draft.baris = draft.baris.filter(function (x) { return x !== b; });
      if (draft.terbuka === b.id) draft.terbuka = '';
      if (b.foto) FotoHp.hapus(b.foto.id);
      delete pesanFoto[b.id];
      simpanDraft();
      gambarBaris();
      toast(b.item + ' dihapus dari isian.');
    }

    function bukaBaris(id) {
      draft.terbuka = id;
      simpanDraft();
      gambarBaris();
    }

    /*
     * Foto bukti (opsional, satu per item; Tahap 11). Diambil dari kamera atau
     * galeri, diperkecil di HP, disimpan di IndexedDB (FotoHp); draft hanya
     * menyimpan { id, ukuran }.
     */
    var TEKS_TANPA_IDB = 'Foto bukti tidak bisa disimpan di HP ini, karena penyimpanan browser tidak tersedia. ' +
      'Waste tetap bisa dikirim tanpa foto.';

    function tampilkanPratinjau(img, b) {
      var id = b.foto.id;
      if (pratinjau[id]) {
        img.src = pratinjau[id];
        return;
      }
      FotoHp.baca(id).then(function (f) {
        if (!b.foto || b.foto.id !== id) return;
        if (f && f.data) {
          pratinjau[id] = 'data:' + (f.mime || 'image/jpeg') + ';base64,' + f.data;
          img.src = pratinjau[id];
          return;
        }
        // Foto sudah tidak ada di HP (data browser dibersihkan): rujukannya dilepas.
        b.foto = null;
        pesanFoto[b.id] = { teks: 'Foto bukti ' + b.item + ' sudah tidak ada di HP. Ambil lagi jika perlu.', jenis: 'tinjau' };
        simpanDraft();
        gambarBaris();
      });
    }

    function pasangFoto(b, file) {
      pesanFoto[b.id] = { teks: 'Memproses foto…', jenis: 'info' };
      gambarBaris();
      perkecilFoto(file).then(function (f) {
        var id = buatId();
        return FotoHp.simpan(id, { data: f.data, mime: f.mime, ukuran: f.ukuran, waktu: Date.now() }).then(function () {
          var lama = b.foto && b.foto.id;
          b.foto = { id: id, ukuran: f.ukuran };
          pratinjau[id] = 'data:' + f.mime + ';base64,' + f.data;
          if (lama) FotoHp.hapus(lama);
          delete pesanFoto[b.id];
          simpanDraft();
        }, function () {
          throw new Error(FotoHp.siap === false ? TEKS_TANPA_IDB
            : 'Foto tidak bisa disimpan di HP (ruang penyimpanan mungkin penuh). Waste tetap bisa dikirim tanpa foto.');
        });
      }).catch(function (err) {
        pesanFoto[b.id] = { teks: err.message, jenis: 'masalah' };
      }).then(function () {
        gambarBaris();
      });
    }

    function hapusFoto(b) {
      if (!b.foto) return;
      FotoHp.hapus(b.foto.id);
      delete pratinjau[b.foto.id];
      b.foto = null;
      delete pesanFoto[b.id];
      simpanDraft();
      gambarBaris();
      toast('Foto bukti ' + b.item + ' dihapus.');
    }

    /** Tombol ambil foto (kamera belakang) atau pilih dari galeri: label berisi input file. */
    function tombolFoto(b, teks, kamera) {
      var input = el('input', { type: 'file', accept: 'image/*', class: 'input-file', 'aria-label': teks + ' bukti ' + b.item });
      if (kamera) input.setAttribute('capture', 'environment');
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        input.value = '';
        if (file) pasangFoto(b, file);
      });
      return el('label', { class: 'tombol tombol-kedua tombol-file' }, [ikon('kamera'), el('span', { class: 'tombol-teks', text: teks }), input]);
    }

    /** Bagian foto bukti satu baris: pratinjau dengan Hapus foto, atau tombol ambil/pilih foto. */
    function bagianFoto(b, diTabel) {
      var isi = [];
      if (!diTabel) isi.push(el('span', { class: 'kolom-label', text: 'Foto bukti (tidak wajib)' }));
      if (b.foto) {
        var img = el('img', { class: 'foto-pratinjau', alt: 'Foto bukti ' + b.item, width: 64, height: 64 });
        tampilkanPratinjau(img, b);
        isi.push(el('div', { class: 'foto-ada' }, [
          img,
          el('span', { class: 'foto-ket' }, [
            diTabel ? null : el('span', { text: 'Foto tersimpan di HP' }),
            el('span', { class: 'kolom-bantuan', text: teksMb(b.foto.ukuran || 0) })
          ]),
          tombol('Hapus foto', 'tautan', { 'aria-label': 'Hapus foto bukti ' + b.item, onclick: function () { hapusFoto(b); } })
        ]));
      } else if (FotoHp.siap === false) {
        isi.push(el('p', { class: 'kolom-bantuan', text: TEKS_TANPA_IDB }));
      } else {
        var sentuh = apakahSentuh();
        isi.push(el('div', { class: 'deret-tombol' }, [
          sentuh ? tombolFoto(b, 'Ambil foto', true) : null,
          tombolFoto(b, sentuh ? 'Pilih dari galeri' : 'Pilih foto', false)
        ]));
      }
      var p = el('p', { class: 'pesan-formulir', 'aria-live': 'polite' });
      if (pesanFoto[b.id]) tulisPesan(p, pesanFoto[b.id].teks, pesanFoto[b.id].jenis);
      isi.push(p);
      return el('div', { class: 'foto-bukti' + (diTabel ? ' foto-bukti-tabel' : ''), role: 'group', 'aria-label': 'Foto bukti ' + b.item }, isi);
    }

    /** Isian satu baris; dipakai kartu (HP dan tablet) dan baris tabel (laptop dan desktop). */
    function isianBaris(b, nomor) {
      var it = infoItem(b.item);
      var gKat = grupPilihan('Kategori waste', KATEGORI_WASTE, b.kategori);
      gKat.wadah.querySelector('fieldset').classList.add('pilihan-kategori-waste');
      var idQty = 'qty-waste-' + nomor;
      var inQty = el('input', { class: 'isian isian-angka', id: idQty, type: 'text', inputmode: 'decimal', autocomplete: 'off',
        'data-kunci': b.id + '|qty' });
      inQty.value = b.qty || '';
      var galatQty = el('p', { class: 'kolom-galat' });
      var kAlasan = kolomIsian({ label: 'Alasan / keterangan', maxlength: 200, nilai: b.alasan || '',
        atribut: { 'data-kunci': b.id + '|alasan' } });
      var bantuanAlasan = el('p', { class: 'kolom-bantuan' });
      kAlasan.wadah.insertBefore(bantuanAlasan, kAlasan.input);
      var estimasi = el('span', { class: 'estimasi-angka' });

      function perbarui() {
        var h = periksa(b);
        var qtySalah = h.qty !== null && (isNaN(h.qty) || !(h.qty > 0));
        inQty.setAttribute('aria-invalid', qtySalah ? 'true' : 'false');
        kosongkan(galatQty);
        if (qtySalah) {
          galatQty.appendChild(ikonStatus('masalah'));
          galatQty.appendChild(el('span', { text: 'Isi angka lebih dari 0, misalnya 2,5.' }));
        }
        bantuanAlasan.textContent = b.kategori === 'Lainnya' ? 'Wajib diisi untuk kategori Lainnya.' : 'Tidak wajib.';
        estimasi.textContent = teksEstimasi(b);
        perbaruiPenghitung();
      }
      gKat.input.forEach(function (i) {
        i.addEventListener('change', function () {
          b.kategori = gKat.nilai();
          gKat.galat('');
          simpanDraft();
          perbarui();
        });
      });
      inQty.addEventListener('input', function () {
        b.qty = inQty.value;
        simpanDraft();
        perbarui();
      });
      kAlasan.input.addEventListener('input', function () {
        b.alasan = kAlasan.input.value;
        if (kAlasan.input.value.trim()) kAlasan.galat('');
        simpanDraft();
        perbarui();
      });
      perbarui();
      var hapus = el('button', { type: 'button', class: 'tombol-ikon', 'aria-label': 'Hapus ' + b.item + ' dari isian',
        onclick: function () { hapusBaris(b); } }, ikon('sampah'));
      return { it: it, gKat: gKat, inQty: inQty, idQty: idQty, galatQty: galatQty, kAlasan: kAlasan, estimasi: estimasi, hapus: hapus,
        foto: bagianFoto(b, mediaDesktop.matches) };
    }

    /** Ringkasan satu baris (HP dan tablet): item yang sudah diisi diringkas; ketuk untuk membuka. */
    function barisRingkas(b) {
      var it = infoItem(b.item);
      var h = periksa(b);
      var bagian = [b.kategori || 'Kategori belum dipilih'];
      if (h.qty > 0) bagian.push(formatAngka(h.qty) + (it.satuan ? ' ' + it.satuan : ''));
      if (rupiah && h.qty > 0 && it.harga != null) bagian.push(formatRupiah(h.qty * it.harga));
      if (b.foto) bagian.push('ada foto');
      var kartu = el('div', { class: 'kartu-item waste-ringkas' }, [
        el('button', { type: 'button', class: 'waste-ringkas-tombol', 'aria-expanded': 'false',
          'aria-label': b.item + ', ' + bagian.join(', ') + (h.salah ? ', belum lengkap' : '') + '. Ketuk untuk mengubah.',
          onclick: function () { bukaBaris(b.id); } }, [
          el('span', { class: 'kartu-item-nama', text: b.item }),
          el('span', { class: 'waste-ringkas-ket', text: bagian.join(' · ') }),
          h.salah ? tandaStatus('tinjau', 'Belum lengkap') : null
        ]),
        el('button', { type: 'button', class: 'tombol-ikon', 'aria-label': 'Hapus ' + b.item + ' dari isian',
          onclick: function () { hapusBaris(b); } }, ikon('sampah'))
      ]);
      pasangGeserHapus(kartu, function () { hapusBaris(b); });
      return kartu;
    }

    function kartuTerbuka(b, nomor) {
      var x = isianBaris(b, nomor);
      var kartu = el('article', { class: 'kartu-item', 'aria-label': b.item }, [
        el('div', { class: 'kartu-item-kepala' }, [
          el('h2', { class: 'kartu-item-nama', text: b.item }),
          x.hapus
        ]),
        x.gKat.wadah,
        el('div', { class: 'kolom' }, [
          el('label', { class: 'kolom-label', for: x.idQty, text: 'Qty' }),
          el('div', { class: 'baris-angka' }, [x.inQty, el('span', { class: 'satuan-tetap', text: x.it.satuan })]),
          x.galatQty
        ]),
        x.kAlasan.wadah,
        x.foto,
        rupiah ? el('div', { class: 'stock-akhir' }, [el('span', { class: 'otomatis', text: 'Estimasi kerugian' }), x.estimasi]) : null,
        draft.baris.length > 1 ? tombol('Selesai', 'tautan', { onclick: function () { bukaBaris(''); } }) : null
      ]);
      pasangGeserHapus(kartu, function () { hapusBaris(b); });
      return kartu;
    }

    function barisTabel(b, nomor) {
      var x = isianBaris(b, nomor);
      x.inQty.setAttribute('aria-label', 'Qty ' + b.item);
      x.kAlasan.wadah.querySelector('label').classList.add('sr');
      x.gKat.wadah.querySelector('legend').classList.add('sr');
      return el('tr', {}, [
        el('td', { class: 'angka', text: String(nomor) }),
        el('td', { class: 'nama-item' }, el('span', { class: 'daftar-baris-judul', text: b.item })),
        el('td', { class: 'sel-kategori-waste' }, x.gKat.wadah),
        el('td', {}, [el('div', { class: 'baris-angka' }, [x.inQty, el('span', { class: 'satuan-tetap', text: x.it.satuan })]), x.galatQty]),
        el('td', { class: 'sel-alasan' }, x.kAlasan.wadah),
        el('td', { class: 'sel-foto' }, x.foto),
        rupiah ? el('td', { class: 'angka otomatis' }, x.estimasi) : null,
        el('td', {}, x.hapus)
      ]);
    }

    function gambarBaris() {
      kosongkan(wadahBaris);
      tulisPesan(pesan, '');
      if (!draft.baris.length) {
        wadahBaris.appendChild(kotakKosong('Belum ada item waste. Ketuk Tambah item untuk mencatat barang yang terbuang.'));
        perbaruiPenghitung();
        return;
      }
      if (mediaDesktop.matches) {
        var badan = el('tbody');
        draft.baris.forEach(function (b, i) { badan.appendChild(barisTabel(b, i + 1)); });
        wadahBaris.appendChild(el('div', { class: 'tabel-bingkai tabel-isian-bingkai' }, el('table', { class: 'tabel tabel-isian tabel-waste' }, [
          el('thead', {}, el('tr', {}, ['No', 'Item / Produk', 'Kategori waste', 'Qty', 'Alasan / keterangan', 'Foto bukti', rupiah ? 'Estimasi kerugian' : null, '']
            .filter(function (j) { return j !== null; })
            .map(function (j, i) { return el('th', { scope: 'col', class: i === 0 || (rupiah && i === 6) ? 'angka' : null, text: j }); }))),
          badan
        ])));
      } else {
        var grid = el('div', { class: 'grid-item' });
        // Di HP dan tablet hanya item yang sedang diisi yang terbuka; yang lain diringkas.
        draft.baris.forEach(function (b, i) {
          grid.appendChild(b.id === draft.terbuka ? kartuTerbuka(b, i + 1) : barisRingkas(b));
        });
        wadahBaris.appendChild(grid);
      }
      perbaruiPenghitung();
    }

    /** Lembar "Tambah item": ketik beberapa huruf, pilih dari daftar (tampilan Bagian 5.3). */
    function bukaTambahItem() {
      var daftar = data && data.item || [];
      var kCari = kolomIsian({ label: 'Cari item', atribut: { type: 'search', autocapitalize: 'none', spellcheck: 'false' } });
      var hasil = el('div', { class: 'daftar daftar-pilih-item', role: 'list' });
      function saring() {
        var q = kCari.input.value.trim().toLowerCase();
        kosongkan(hasil);
        var cocok = daftar.filter(function (it) { return !q || it.nama.toLowerCase().indexOf(q) >= 0; });
        if (!cocok.length) {
          hasil.appendChild(kotakKosong(daftar.length ? 'Tidak ada item dengan nama itu.' : 'Daftar item belum termuat. Periksa sinyal, lalu buka lagi.'));
          return;
        }
        cocok.slice(0, 60).forEach(function (it) {
          hasil.appendChild(el('button', { type: 'button', class: 'daftar-baris', role: 'listitem',
            onclick: function () { tambahBaris(it.nama); lembar.tutup(); } }, [
            el('span', { class: 'daftar-baris-isi' }, [
              el('span', { class: 'daftar-baris-judul', text: it.nama }),
              el('span', { class: 'daftar-baris-ket', text: [it.kategori, it.satuan,
                rupiah ? (it.harga != null ? formatRupiah(it.harga) + ' per ' + it.satuan : 'tanpa harga') : '']
                .filter(Boolean).join(' · ') })
            ]),
            ikon('tambah')
          ]));
        });
      }
      kCari.input.addEventListener('input', saring);
      saring();
      var lembar = bukaLembar({ judul: 'Tambah item waste', isi: [kCari.wadah, hasil], aksi: [{ teks: 'Tutup', jenis: 'kedua' }] });
    }

    function tambahBaris(nama) {
      var b = { id: buatId(), item: nama, kategori: '', qty: '', alasan: '' };
      draft.baris.push(b);
      draft.terbuka = b.id;
      simpanDraft();
      gambarBaris();
      if (!apakahSentuh()) {
        var gk = wadahBaris.querySelector('[data-kunci="' + b.id + '|qty"]');
        if (gk) gk.focus();
      }
    }
    tombolTambah.addEventListener('click', bukaTambahItem);

    function gambarStatus() {
      kosongkan(statusForm);
      if (!data) return;
      var menunggu = antreanForm('WASTE', tanggal);
      var kirimMenunggu = menunggu.filter(function (e) { return e.aksi === 'kirimWaste'; });
      var nihilMenunggu = menunggu.filter(function (e) { return e.aksi === 'tandaiNihil'; })[0] || null;
      var kr = data.kiriman;
      if (kr.jumlah) {
        var t = kr.terakhir;
        statusForm.appendChild(el('p', {}, [tandaStatus('baik', 'Terkirim'),
          el('span', { class: 'kolom-bantuan', text: ' ' + kr.jumlah + ' kiriman' + (t ? ', terakhir ' + jam(t.waktu) + ', ' + t.oleh : '') +
            (rupiah && kr.totalRp != null ? '. Estimasi kerugian ' + formatRupiah(kr.totalRp) : '') + '.' })]));
        statusForm.appendChild(el('p', { class: 'kolom-bantuan lebar-penuh', text: 'Tercatat: ' + kr.baris.map(function (b) {
          return b.item + ' ' + formatAngka(b.qty) + (b.satuan ? ' ' + b.satuan : '') + ' (' + b.kategori.toLowerCase() + ')';
        }).join(', ') + '.' }));
      }
      if (kirimMenunggu.length) statusForm.appendChild(tandaStatus('menunggu', kirimMenunggu.length + ' isian menunggu kirim'));
      var nihil = bagianNihil({
        formId: 'WASTE',
        namaForm: 'Waste',
        tanggal: tanggal,
        nihil: data.nihil,
        adaIsian: kr.jumlah > 0 || kirimMenunggu.length > 0,
        menunggu: nihilMenunggu,
        selesai: function (n) {
          data.nihil = n;
          gambarStatus();
        }
      });
      if (nihil) statusForm.appendChild(nihil);
    }

    function gambar(d) {
      data = d;
      gambarStatus();
      gambarBaris();
    }

    function gantiTanggal(baru) {
      if (baru === tanggal) return;
      tanggal = baru;
      simpanDraft();
      muat();
    }

    tombolKirim.addEventListener('click', function () {
      if (tombolKirim.disabled) return;
      tulisPesan(pesan, '');
      if (!gShift.galat(draft.shift ? '' : 'Pilih shift.')) {
        gShift.input[0].focus();
        tulisPesan(pesan, 'Pilih shift: Pagi, Siang, atau Malam.', 'masalah');
        return;
      }
      if (!draft.baris.length) {
        tulisPesan(pesan, 'Tambah minimal satu item waste.', 'masalah');
        return;
      }
      var salah = null;
      draft.baris.forEach(function (b) {
        var h = periksa(b);
        if (h.salah && !salah) salah = { b: b, jenis: h.salah };
      });
      if (salah) {
        var teks = salah.jenis === 'kategori' ? 'Pilih kategori waste untuk ' + salah.b.item + '.'
          : (salah.jenis === 'qty' ? 'Isi Qty ' + salah.b.item + ' lebih dari 0, misalnya 2,5.'
            : 'Tulis alasan untuk ' + salah.b.item + ', karena kategorinya Lainnya.');
        if (!mediaDesktop.matches && draft.terbuka !== salah.b.id) bukaBaris(salah.b.id);
        tulisPesan(pesan, teks, 'masalah');
        var kunci = salah.jenis === 'kategori' ? null : salah.b.id + '|' + salah.jenis;
        var kolom = kunci ? wadahBaris.querySelector('[data-kunci="' + kunci + '"]') : null;
        if (kolom) kolom.focus();
        return;
      }
      if (!draft.sid) draft.sid = buatId();
      var baris = draft.baris.map(function (b) {
        var x = { item: b.item, kategori: b.kategori, qty: bacaAngka(b.qty), alasan: String(b.alasan || '').trim() };
        if (b.foto) x.fotoId = b.foto.id; // foto ikut ke antrean lewat id-nya (IndexedDB)
        return x;
      });
      var jumlahFoto = baris.filter(function (b) { return b.fotoId; }).length;
      var isi = { submissionId: draft.sid, tanggal: tanggal, shift: draft.shift, waktuPerangkat: new Date().toISOString(), baris: baris };
      var entri = { id: isi.submissionId, aksi: 'kirimWaste', isi: isi, formId: 'WASTE',
        judul: 'Waste · ' + baris.length + ' item' + (jumlahFoto ? ', ' + jumlahFoto + ' foto' : ''), tanggal: tanggal };
      // Foto tidak dihapus di sini: antrean masih merujuknya; kirimIsian menghapusnya setelah terkirim.
      function kosongkanIsian() {
        draft.baris = [];
        draft.terbuka = '';
        draft.sid = buatId();
        simpanDraft();
      }
      function keAntrean() {
        simpanKeAntrean(entri);
        kosongkanIsian();
        gambarStatus();
        gambarBaris();
        toast('Tersimpan di HP. Dikirim saat ada sinyal.');
      }
      if (navigator.onLine === false) {
        keAntrean();
        return;
      }
      aturTombolProses(tombolKirim, true, jumlahFoto ? 'Mengirim foto…' : 'Mengirim…');
      jagaProses(kirimIsian('kirimWaste', isi)).then(function (hasil) {
        aturTombolProses(tombolKirim, false);
        kosongkanIsian();
        Cache.tulis('waste', hasil.form);
        if (hasil.form.tanggal === tanggal) gambar(hasil.form);
        var pf = pesanFotoKiriman(hasil);
        if (pf) tulisPesan(pesan, 'Waste terkirim. ' + pf, 'tinjau');
        toast('Waste terkirim.');
      }).catch(function (err) {
        aturTombolProses(tombolKirim, false);
        if (err && err.jaringan) {
          keAntrean();
          return;
        }
        if (err && err.sesiBerakhir) {
          simpanKeAntrean(entri);
          kosongkanIsian();
          tanganiSesiBerakhir(err);
          return;
        }
        tulisPesan(pesan, pesanGalat(err), 'masalah');
      });
    });

    function muat() {
      return muatData({
        dariHp: function () { return dataWasteDariHp(tanggal); },
        simpanHp: function (d) { Cache.tulis('waste', d); },
        ambil: function () { return panggilApi('formWaste', { tanggal: tanggal }); },
        gambar: function (d) {
          if (d.tanggal === tanggal) gambar(d);
        },
        kerangka: function () {
          kosongkan(wadahBaris).appendChild(kerangkaBaris(3));
        },
        galat: function (teks, cobaLagi) {
          kosongkan(wadahBaris).appendChild(kotakGalat(teks, cobaLagi));
        },
        penanda: penanda
      });
    }

    function gantiSusunan() {
      gambarBaris();
    }
    if (mediaDesktop.addEventListener) mediaDesktop.addEventListener('change', gantiSusunan);
    else if (mediaDesktop.addListener) mediaDesktop.addListener(gantiSusunan);
    pembersihLayar.push(function () {
      if (mediaDesktop.removeEventListener) mediaDesktop.removeEventListener('change', gantiSusunan);
      else if (mediaDesktop.removeListener) mediaDesktop.removeListener(gantiSusunan);
    });

    gambarBaris();
    muat();
    segarkanLayar = muat;
    segarkanAntrean = gambarStatus;

    // IndexedDB diperiksa sekali; jika tidak ada, tombol foto diganti keterangan.
    // Foto yang tidak dirujuk draft atau antrean lagi (misalnya sisa draft lama) dibuang.
    FotoHp.periksa().then(function (ada) {
      if (!ada) {
        if (draft.baris.length) gambarBaris();
        return;
      }
      var p = penggunaKini();
      var dipakai = [];
      draft.baris.forEach(function (b) { if (b.foto) dipakai.push(b.foto.id); });
      if (p) Antrean.daftar(p.nama).forEach(function (e) { dipakai = dipakai.concat(idFotoIsian(e.isi)); });
      FotoHp.bersihkan(dipakai);
    });
  }

  /* =======================================================================
   * Form Pengecekan Suhu Chiller & Freezer (spesifikasi sistem Bagian 5.2,
   * tampilan Bagian 5.3)
   * ===================================================================== */

  var WAKTU_CEK = ['Opening', 'Middle', 'Closing', 'Cek ulang'];
  var WAKTU_CEK_WAJIB = ['Opening', 'Middle', 'Closing'];
  var CEK_ULANG = 'Cek ulang';

  /** Sama dengan statusSuhuNilai_ di Code.gs; status yang tersimpan tetap dihitung server. */
  function suhuNormal(tipe, suhu, batas) {
    return tipe === 'Freezer' ? suhu <= batas.freezerMaks : suhu >= batas.chillerMin && suhu <= batas.chillerMaks;
  }

  function teksBatasSuhu(tipe, batas) {
    return tipe === 'Freezer'
      ? 'Normal: ' + formatAngka(batas.freezerMaks) + ' °C atau lebih rendah'
      : 'Normal: ' + formatAngka(batas.chillerMin) + ' sampai ' + formatAngka(batas.chillerMaks) + ' °C';
  }

  /** "4 °C", "−18 °C" */
  function teksSuhu(n) {
    return formatAngka(n) + ' °C';
  }

  /** Draft per pengguna: { tanggal, waktu, nilai: { waktu: { unit: { suhu, tindakan } } }, sid: { waktu: id } }. */
  function bacaDraftSuhu() {
    var d = Draft.baca('suhu');
    var data = d && d.data ? d.data : {};
    return {
      tanggal: data.tanggal || '',
      waktu: WAKTU_CEK.indexOf(data.waktu) >= 0 ? data.waktu : '',
      nilai: data.nilai && typeof data.nilai === 'object' ? data.nilai : {},
      sid: data.sid && typeof data.sid === 'object' ? data.sid : {},
      waktuSimpan: d ? d.waktu : null
    };
  }

  /** Data suhu di HP. Untuk tanggal lain tanpa sinyal: unit dan batas yang sama, tanpa pengecekan. */
  function dataSuhuDariHp(tanggal) {
    var c = Cache.baca('suhu');
    if (!c || !c.data || !c.data.unit) return null;
    if (c.data.tanggal === tanggal) return c.data;
    return Object.assign({}, c.data, { tanggal: tanggal, isian: [], turunan: true });
  }

  function layarSuhu(k) {
    aturJudul('Suhu');
    var pengelola = !!k.sesi.pengguna.pengelola;
    var draft = bacaDraftSuhu();
    var tanggal = tanggalDraft(draft.tanggal, pengelola);
    var data = null;
    var mediaDesktop = window.matchMedia(DESKTOP);

    var catatanDraft = el('p', { class: 'catatan-draft', 'aria-live': 'polite' });
    var penanda = el('span', { class: 'memperbarui', role: 'status' });
    var statusForm = el('div', { class: 'status-form' });
    var wadahUnit = el('div');
    var pesan = el('p', { class: 'pesan-formulir', role: 'alert' });
    var penghitung = el('span', { class: 'penghitung', 'aria-live': 'polite' });
    var tombolKirim = tombol('Kirim suhu', 'utama');

    var gTanggal = pilihanTanggalIsian({ pengelola: pengelola, tanggal: tanggal, ganti: gantiTanggal });
    var gWaktu = grupPilihan('Waktu cek', WAKTU_CEK, draft.waktu);
    gWaktu.wadah.querySelector('fieldset').classList.add('pilihan-waktu-cek');
    gWaktu.input.forEach(function (i) {
      i.addEventListener('change', function () {
        draft.waktu = gWaktu.nilai();
        gWaktu.galat('');
        tulisPesan(pesan, '');
        simpanDraft();
        gambarUnit();
      });
    });

    k.wadah.appendChild(el('div', { class: 'layar-isi layar-form' }, [
      tautanKembali('Beranda', '#/'),
      el('h1', { class: 'judul-layar', text: 'Pengecekan Suhu' }),
      catatanDraft,
      el('section', { class: 'kartu kotak-info', 'aria-label': 'Kotak info' }, [
        gTanggal.wadah,
        el('div', { class: 'lebar-penuh' }, [penanda, statusForm])
      ]),
      gWaktu.wadah,
      wadahUnit,
      pesan,
      el('div', { class: 'bilah-kirim' }, [penghitung, tombolKirim])
    ]));

    function adaIsianDraft() {
      return Object.keys(draft.nilai).some(function (w) {
        return Object.keys(draft.nilai[w] || {}).some(function (u) {
          var x = draft.nilai[w][u];
          return x && bacaAngkaSuhu(x.suhu) !== null;
        });
      });
    }

    function simpanDraft() {
      var waktu = Draft.simpan('suhu', { tanggal: tanggal, waktu: draft.waktu, nilai: draft.nilai, sid: draft.sid });
      catatanDraft.textContent = adaIsianDraft() && waktu ? 'Draft tersimpan ' + jam(new Date(waktu).toISOString()) : '';
    }
    if (draft.waktuSimpan && adaIsianDraft()) catatanDraft.textContent = 'Draft tersimpan ' + jam(new Date(draft.waktuSimpan).toISOString());

    function isianUnit(waktu, unit) {
      draft.nilai[waktu] = draft.nilai[waktu] || {};
      return draft.nilai[waktu][unit] || null;
    }

    /** Isian draft unit itu untuk waktu cek terpilih; Freezer mulai dengan tanda minus. */
    function isianDraft(u) {
      var x = isianUnit(draft.waktu, u.nama);
      if (!x) {
        x = { suhu: u.tipe === 'Freezer' ? '-' : '', tindakan: '' };
        draft.nilai[draft.waktu][u.nama] = x;
      }
      return x;
    }

    /** Pengecekan yang tercatat di server dan yang masih di antrean HP, per unit, urut waktu. */
    function catatanUnit(nama) {
      var hasil = (data && data.isian || []).filter(function (r) { return r.unit === nama; })
        .map(function (r) { return Object.assign({ antre: false }, r); });
      antreanForm('SUHU', tanggal).forEach(function (e) {
        if (e.aksi !== 'kirimSuhu' || !e.isi) return;
        (e.isi.baris || []).forEach(function (b) {
          if (b.unit !== nama) return;
          var u = unitBernama(nama);
          var suhu = bacaAngkaSuhu(b.suhu);
          hasil.push({ unit: nama, waktuCek: e.isi.waktuCek, suhu: suhu, tindakan: b.tindakan,
            status: u && data && suhu != null && !isNaN(suhu) && !suhuNormal(u.tipe, suhu, data.batas) ? 'Di Luar Standar' : 'Normal',
            oleh: '', waktu: e.isi.waktuPerangkat, antre: true, gagal: e.status === 'gagal' });
        });
      });
      return hasil.sort(function (a, b) { return String(a.waktu).localeCompare(String(b.waktu)); });
    }

    function unitBernama(nama) {
      var daftar = data && data.unit || [];
      for (var i = 0; i < daftar.length; i++) if (daftar[i].nama === nama) return daftar[i];
      return null;
    }

    /** Waktu cek (Opening/Middle/Closing) yang sudah tercatat atau menunggu kirim untuk unit itu. */
    function sudahDicek(nama, waktu) {
      if (waktu === CEK_ULANG) return null;
      var c = catatanUnit(nama);
      for (var i = 0; i < c.length; i++) if (c[i].waktuCek === waktu) return c[i];
      return null;
    }

    /** Pengecekan terakhir unit itu di luar standar: tawarkan cek ulang. */
    function perluCekUlang(nama) {
      var c = catatanUnit(nama);
      return c.length > 0 && c[c.length - 1].status !== 'Normal';
    }

    /** Satu baris pengecekan tercatat: "Opening 07.10: 4 °C, normal · Rina". */
    function barisCatatan(r) {
      var luar = r.status !== 'Normal';
      var teks = r.waktuCek + (r.waktu ? ' ' + jam(r.waktu) : '') + ': ';
      return el('li', { class: 'catatan-suhu' + (r.waktuCek === CEK_ULANG ? ' cek-ulang' : '') }, [
        el('span', {}, [
          teks,
          el('span', { class: 'angka-satuan' + (luar ? ' nilai-masalah' : ''), text: teksSuhu(r.suhu) }),
          luar ? ', di luar standar' : ', normal',
          r.antre ? '' : (r.oleh ? ' · ' + r.oleh : '')
        ]),
        r.antre ? tandaStatus(r.gagal ? 'masalah' : 'menunggu', r.gagal ? 'Gagal kirim' : 'Menunggu kirim') : null,
        luar && r.tindakan ? el('span', { class: 'catatan-suhu-tindakan', text: 'Tindakan: ' + r.tindakan }) : null
      ]);
    }

    function daftarCatatan(nama) {
      var c = catatanUnit(nama);
      if (!c.length) return null;
      return el('ul', { class: 'daftar-catatan-suhu', 'aria-label': 'Tercatat hari ini' }, c.map(barisCatatan));
    }

    /** Hasil pemeriksaan isian satu unit: { suhu, salah: '' | 'angka' | 'tindakan', luar }. */
    function periksa(u, x) {
      var suhu = bacaAngkaSuhu(x.suhu);
      if (suhu === null) return { suhu: null, salah: '', luar: false };
      if (isNaN(suhu) || suhu < -60 || suhu > 60) return { suhu: suhu, salah: 'angka', luar: false };
      var luar = !suhuNormal(u.tipe, suhu, data.batas);
      return { suhu: suhu, salah: luar && !String(x.tindakan || '').trim() ? 'tindakan' : '', luar: luar };
    }

    /** Unit yang masih bisa diisi pada waktu cek terpilih. */
    function unitTerbuka() {
      if (!data || !draft.waktu) return [];
      return data.unit.filter(function (u) { return !sudahDicek(u.nama, draft.waktu); });
    }

    function perbaruiPenghitung() {
      if (!data) {
        penghitung.textContent = '';
        return;
      }
      if (!draft.waktu) {
        penghitung.textContent = 'Pilih waktu cek';
        return;
      }
      var buka = unitTerbuka();
      var terisi = buka.filter(function (u) { return periksa(u, isianDraft(u)).suhu !== null; }).length;
      penghitung.textContent = buka.length ? terisi + ' dari ' + buka.length + ' unit terisi' : 'Semua unit sudah dicek';
    }

    /** Kolom suhu dengan tombol ± (papan angka iPhone tidak punya tanda minus), status, dan tindakan korektif. */
    function isianSuhu(u, nomor) {
      var x = isianDraft(u);
      var idSuhu = 'suhu-' + nomor;
      var inSuhu = el('input', { class: 'isian isian-angka', id: idSuhu, type: 'text', inputmode: 'decimal', autocomplete: 'off',
        'data-kunci': u.nama + '|suhu' });
      inSuhu.value = x.suhu || '';
      var tombolTanda = el('button', { type: 'button', class: 'tombol-tanda', 'aria-label': 'Ganti tanda plus atau minus suhu ' + u.nama, text: '±' });
      var galatSuhu = el('p', { class: 'kolom-galat' });
      var status = el('div', { class: 'status-suhu', 'aria-live': 'polite' });
      var kTindakan = kolomIsian({ label: 'Tindakan korektif', maxlength: 200, nilai: x.tindakan || '',
        bantuan: 'Wajib diisi karena suhu di luar standar.', atribut: { 'data-kunci': u.nama + '|tindakan' } });
      var akar = null; // kartu atau baris tabel, diberi tanda Masalah saat di luar standar

      function perbarui() {
        var h = periksa(u, x);
        inSuhu.setAttribute('aria-invalid', h.salah === 'angka' ? 'true' : 'false');
        kosongkan(galatSuhu);
        if (h.salah === 'angka') {
          galatSuhu.appendChild(ikonStatus('masalah'));
          galatSuhu.appendChild(el('span', { text: 'Isi suhu berupa angka, misalnya 3,5 atau -18.' }));
        }
        kosongkan(status);
        if (h.suhu !== null && h.salah !== 'angka') {
          status.appendChild(h.luar ? tandaStatus('masalah', 'Di luar standar') : tandaStatus('baik', 'Normal'));
        }
        kTindakan.wadah.hidden = !h.luar;
        if (akar) akar.classList.toggle('masalah', h.luar);
        perbaruiPenghitung();
      }
      inSuhu.addEventListener('input', function () {
        x.suhu = inSuhu.value;
        simpanDraft();
        perbarui();
      });
      tombolTanda.addEventListener('click', function () {
        var t = String(inSuhu.value || '').replace('−', '-');
        inSuhu.value = t.charAt(0) === '-' ? t.slice(1) : '-' + t;
        x.suhu = inSuhu.value;
        simpanDraft();
        perbarui();
        inSuhu.focus();
      });
      kTindakan.input.addEventListener('input', function () {
        x.tindakan = kTindakan.input.value;
        if (kTindakan.input.value.trim()) kTindakan.galat('');
        simpanDraft();
        perbarui();
      });
      return {
        idSuhu: idSuhu,
        inSuhu: inSuhu,
        baris: el('div', { class: 'baris-angka baris-suhu' }, [tombolTanda, inSuhu, el('span', { class: 'satuan-tetap', text: '°C' })]),
        galatSuhu: galatSuhu,
        status: status,
        kTindakan: kTindakan,
        pasang: function (wadah) {
          akar = wadah;
          perbarui();
        }
      };
    }

    function tombolCekUlang(u) {
      return tombol('Catat cek ulang', 'kedua', { onclick: function () { mulaiCekUlang(u.nama); } });
    }

    function mulaiCekUlang(nama) {
      draft.waktu = CEK_ULANG;
      gWaktu.input.forEach(function (i) { i.checked = i.value === CEK_ULANG; });
      gWaktu.galat('');
      simpanDraft();
      gambarUnit();
      var kolom = wadahUnit.querySelector('[data-kunci="' + nama.replace(/"/g, '\\"') + '|suhu"]');
      if (kolom) kolom.focus();
    }

    function kartuUnit(u, nomor) {
      var sudah = sudahDicek(u.nama, draft.waktu);
      var kartu = el('article', { class: 'kartu-item kartu-suhu', 'aria-label': u.nama });
      kartu.appendChild(el('div', { class: 'kartu-item-kepala' }, [
        el('h2', { class: 'kartu-item-nama', text: u.nama }),
        el('span', { class: 'kartu-item-satuan', text: u.tipe })
      ]));
      kartu.appendChild(el('p', { class: 'otomatis batas-suhu', text: teksBatasSuhu(u.tipe, data.batas) }));
      var catatan = daftarCatatan(u.nama);
      if (catatan) kartu.appendChild(catatan);
      if (!draft.waktu) return kartu;
      if (sudah) {
        // Waktu cek ini sudah diisi: tampil sebagai teks, bukan kolom isian.
        if (sudah.status !== 'Normal') kartu.classList.add('masalah');
        if (perluCekUlang(u.nama)) kartu.appendChild(tombolCekUlang(u));
        return kartu;
      }
      var x = isianSuhu(u, nomor);
      kartu.appendChild(el('div', { class: 'kolom' }, [
        el('label', { class: 'kolom-label', for: x.idSuhu, text: draft.waktu === CEK_ULANG ? 'Suhu cek ulang' : 'Suhu ' + draft.waktu }),
        x.baris,
        x.galatSuhu
      ]));
      kartu.appendChild(x.status);
      kartu.appendChild(x.kTindakan.wadah);
      x.pasang(kartu);
      return kartu;
    }

    function barisTabelUnit(u, nomor) {
      var sudah = draft.waktu ? sudahDicek(u.nama, draft.waktu) : null;
      var catatan = daftarCatatan(u.nama);
      var tr = el('tr', {}, [
        el('td', { class: 'angka', text: String(nomor) }),
        el('td', { class: 'nama-item' }, el('span', { class: 'daftar-baris-judul', text: u.nama })),
        el('td', { text: u.tipe }),
        el('td', { class: 'otomatis batas-suhu', text: teksBatasSuhu(u.tipe, data.batas).replace('Normal: ', '') }),
        el('td', { class: 'otomatis tercatat' }, catatan || el('span', { text: '–' }))
      ]);
      if (!draft.waktu || sudah) {
        var sel = el('td', { colspan: '2' });
        if (sudah) {
          sel.appendChild(el('span', { class: 'otomatis', text: draft.waktu + ' sudah diisi.' }));
          if (sudah.status !== 'Normal') tr.classList.add('masalah');
        }
        if (draft.waktu && perluCekUlang(u.nama)) sel.appendChild(tombolCekUlang(u));
        tr.appendChild(sel);
        return tr;
      }
      var x = isianSuhu(u, nomor);
      x.inSuhu.setAttribute('aria-label', 'Suhu ' + u.nama);
      x.kTindakan.wadah.querySelector('label').classList.add('sr');
      tr.appendChild(el('td', {}, [x.baris, x.galatSuhu, x.status]));
      tr.appendChild(el('td', { class: 'sel-alasan' }, x.kTindakan.wadah));
      x.pasang(tr);
      return tr;
    }

    /** Centang pada tombol waktu cek yang sudah diisi untuk semua unit aktif. */
    function tandaiWaktuCek() {
      gWaktu.input.forEach(function (i) {
        var span = i.nextSibling;
        var w = i.value;
        var selesai = data && data.unit.length && w !== CEK_ULANG &&
          data.unit.every(function (u) { return sudahDicek(u.nama, w); });
        kosongkan(span);
        if (selesai) span.appendChild(ikon('centang'));
        span.appendChild(document.createTextNode(w));
        if (selesai) span.appendChild(el('span', { class: 'sr', text: ', sudah diisi' }));
      });
    }

    function gambarUnit() {
      kosongkan(wadahUnit);
      if (!data) return;
      tandaiWaktuCek();
      if (!data.unit.length) {
        wadahUnit.appendChild(kotakKosong('Belum ada unit chiller atau freezer yang aktif. Minta Pengelola menambah unit di tab M_Unit.'));
        perbaruiPenghitung();
        return;
      }
      if (draft.waktu) draft.nilai[draft.waktu] = draft.nilai[draft.waktu] || {};
      if (mediaDesktop.matches) {
        var badan = el('tbody');
        data.unit.forEach(function (u, i) { badan.appendChild(barisTabelUnit(u, i + 1)); });
        wadahUnit.appendChild(el('div', { class: 'tabel-bingkai tabel-isian-bingkai' }, el('table', { class: 'tabel tabel-isian tabel-suhu' }, [
          el('thead', {}, el('tr', {}, ['No', 'Unit', 'Tipe', 'Batas normal', 'Tercatat hari ini', 'Suhu', 'Tindakan korektif']
            .map(function (j, i) { return el('th', { scope: 'col', class: i === 0 ? 'angka' : null, text: j }); }))),
          badan
        ])));
      } else {
        var grid = el('div', { class: 'grid-item' });
        data.unit.forEach(function (u, i) { grid.appendChild(kartuUnit(u, i + 1)); });
        wadahUnit.appendChild(grid);
      }
      perbaruiPenghitung();
    }

    function gambarStatus() {
      kosongkan(statusForm);
      if (!data) return;
      var total = data.unit.length * WAKTU_CEK_WAJIB.length;
      var terisi = 0;
      data.unit.forEach(function (u) {
        WAKTU_CEK_WAJIB.forEach(function (w) {
          if ((data.isian || []).some(function (r) { return r.unit === u.nama && r.waktuCek === w; })) terisi++;
        });
      });
      var luar = (data.isian || []).filter(function (r) { return r.status !== 'Normal'; }).length;
      if (total) {
        statusForm.appendChild(el('p', {}, [
          terisi >= total ? tandaStatus('baik', 'Terkirim') : null,
          el('span', { class: 'kolom-bantuan', text: (terisi >= total ? ' ' : '') + terisi + ' dari ' + total + ' pengecekan' +
            (luar ? ', ' + luar + ' di luar standar' : '') + '.' })
        ]));
      }
      var menunggu = antreanForm('SUHU', tanggal).filter(function (e) { return e.aksi === 'kirimSuhu'; });
      if (menunggu.length) statusForm.appendChild(tandaStatus('menunggu', menunggu.length + ' isian menunggu kirim'));
    }

    function gambar(d) {
      data = d;
      if (!draft.waktu) {
        // Waktu cek awal: yang pertama belum lengkap untuk semua unit.
        draft.waktu = WAKTU_CEK_WAJIB.filter(function (w) {
          return !d.unit.every(function (u) { return sudahDicek(u.nama, w); });
        })[0] || '';
        gWaktu.input.forEach(function (i) { i.checked = i.value === draft.waktu; });
      }
      gambarStatus();
      gambarUnit();
    }

    function gantiTanggal(baru) {
      if (baru === tanggal) return;
      tanggal = baru;
      draft.nilai = {};
      draft.sid = {};
      simpanDraft();
      muat();
    }

    tombolKirim.addEventListener('click', function () {
      if (tombolKirim.disabled || !data) return;
      tulisPesan(pesan, '');
      var waktu = draft.waktu;
      if (!gWaktu.galat(waktu ? '' : 'Pilih waktu cek.')) {
        gWaktu.input[0].focus();
        tulisPesan(pesan, 'Pilih waktu cek: Opening, Middle, Closing, atau Cek ulang.', 'masalah');
        return;
      }
      var baris = [];
      var salah = null;
      unitTerbuka().forEach(function (u) {
        var x = isianDraft(u);
        var h = periksa(u, x);
        if (h.salah && !salah) salah = { u: u, jenis: h.salah };
        if (h.suhu !== null && !h.salah) baris.push({ unit: u.nama, suhu: h.suhu, tindakan: h.luar ? String(x.tindakan || '').trim() : '' });
      });
      if (salah) {
        tulisPesan(pesan, salah.jenis === 'angka'
          ? 'Suhu ' + salah.u.nama + ' harus angka, misalnya 3,5 atau -18.'
          : 'Suhu ' + salah.u.nama + ' di luar standar. Tulis tindakan korektif sebelum mengirim.', 'masalah');
        var kolom = wadahUnit.querySelector('[data-kunci="' + salah.u.nama.replace(/"/g, '\\"') + '|' + (salah.jenis === 'angka' ? 'suhu' : 'tindakan') + '"]');
        if (salah.jenis === 'tindakan') {
          var kt = kolom && kolom.closest('.kolom');
          if (kt) {
            var g = kt.querySelector('.kolom-galat');
            kosongkan(g).appendChild(ikonStatus('masalah'));
            g.appendChild(el('span', { text: 'Tulis tindakan korektif.' }));
            kolom.setAttribute('aria-invalid', 'true');
          }
        }
        if (kolom) kolom.focus();
        return;
      }
      if (!baris.length) {
        tulisPesan(pesan, unitTerbuka().length ? 'Isi suhu minimal untuk satu unit.' : 'Semua unit sudah dicek untuk ' + waktu + '. Pilih waktu cek lain.', 'masalah');
        return;
      }
      if (!draft.sid[waktu]) draft.sid[waktu] = buatId();
      var isi = { submissionId: draft.sid[waktu], tanggal: tanggal, waktuCek: waktu, waktuPerangkat: new Date().toISOString(), baris: baris };
      var entri = { id: isi.submissionId, aksi: 'kirimSuhu', isi: isi, formId: 'SUHU', judul: 'Suhu · ' + waktu, tanggal: tanggal };
      var luarDiHp = baris.filter(function (b) { return !suhuNormal(unitBernama(b.unit).tipe, b.suhu, data.batas); })
        .map(function (b) { return b.unit; });
      function kosongkanIsian() {
        draft.nilai[waktu] = {};
        draft.sid[waktu] = buatId();
        simpanDraft();
      }
      function tawaranCekUlang(nama) {
        if (!nama.length) return;
        tulisPesan(pesan, 'Suhu ' + nama.join(', ') + ' di luar standar. Catat cek ulang setelah tindakan korektif.', 'tinjau');
      }
      function keAntrean() {
        simpanKeAntrean(entri);
        kosongkanIsian();
        gambarStatus();
        gambarUnit();
        toast('Tersimpan di HP. Dikirim saat ada sinyal.');
        tawaranCekUlang(luarDiHp);
      }
      if (navigator.onLine === false) {
        keAntrean();
        return;
      }
      aturTombolProses(tombolKirim, true, 'Mengirim…');
      jagaProses(panggilApi('kirimSuhu', isi)).then(function (hasil) {
        aturTombolProses(tombolKirim, false);
        kosongkanIsian();
        Cache.tulis('suhu', hasil.form);
        if (hasil.form.tanggal === tanggal) gambar(hasil.form);
        toast('Suhu terkirim.');
        tawaranCekUlang(luarDiHp);
      }).catch(function (err) {
        aturTombolProses(tombolKirim, false);
        if (err && err.jaringan) {
          keAntrean();
          return;
        }
        if (err && err.sesiBerakhir) {
          simpanKeAntrean(entri);
          kosongkanIsian();
          tanganiSesiBerakhir(err);
          return;
        }
        tulisPesan(pesan, pesanGalat(err), 'masalah');
      });
    });

    function muat() {
      return muatData({
        dariHp: function () { return dataSuhuDariHp(tanggal); },
        simpanHp: function (d) { Cache.tulis('suhu', d); },
        ambil: function () { return panggilApi('formSuhu', { tanggal: tanggal }); },
        gambar: function (d) {
          if (d.tanggal === tanggal) gambar(d);
        },
        kerangka: function () {
          kosongkan(wadahUnit).appendChild(kerangkaBaris(3));
        },
        galat: function (teks, cobaLagi) {
          kosongkan(wadahUnit).appendChild(kotakGalat(teks, cobaLagi));
        },
        penanda: penanda
      });
    }

    function gantiSusunan() {
      gambarUnit();
    }
    if (mediaDesktop.addEventListener) mediaDesktop.addEventListener('change', gantiSusunan);
    else if (mediaDesktop.addListener) mediaDesktop.addListener(gantiSusunan);
    pembersihLayar.push(function () {
      if (mediaDesktop.removeEventListener) mediaDesktop.removeEventListener('change', gantiSusunan);
      else if (mediaDesktop.removeListener) mediaDesktop.removeListener(gantiSusunan);
    });

    muat();
    segarkanLayar = muat;
    segarkanAntrean = function () {
      gambarStatus();
      // Kolom yang sedang diketik tidak digambar ulang; daftar tercatat ikut diperbarui saat layar dimuat ulang.
      if (!wadahUnit.contains(document.activeElement)) gambarUnit();
    };
  }

  /* =======================================================================
   * Bersama untuk Tahap 6: pilih item dari daftar (Prep List dan Resep)
   * ===================================================================== */

  /**
   * Lembar "ketik beberapa huruf, pilih dari daftar" (tampilan Bagian 5.3).
   * opsi: { judul, daftar: [{ nama, ... }], ket(it) → teks, pilih(it),
   *         kosong: teks jika daftar kosong }
   */
  function bukaPilihItem(opsi) {
    var daftar = opsi.daftar || [];
    var kCari = kolomIsian({ label: 'Cari item', atribut: { type: 'search', autocapitalize: 'none', spellcheck: 'false' } });
    var hasil = el('div', { class: 'daftar daftar-pilih-item', role: 'list' });
    function saring() {
      var q = kCari.input.value.trim().toLowerCase();
      kosongkan(hasil);
      var cocok = daftar.filter(function (it) { return !q || it.nama.toLowerCase().indexOf(q) >= 0; });
      if (!cocok.length) {
        hasil.appendChild(kotakKosong(daftar.length ? 'Tidak ada item dengan nama itu.' : opsi.kosong));
        return;
      }
      cocok.slice(0, 60).forEach(function (it) {
        hasil.appendChild(el('button', { type: 'button', class: 'daftar-baris', role: 'listitem',
          onclick: function () { lembar.tutup(); opsi.pilih(it); } }, [
          el('span', { class: 'daftar-baris-isi' }, [
            el('span', { class: 'daftar-baris-judul', text: it.nama }),
            el('span', { class: 'daftar-baris-ket', text: opsi.ket(it) })
          ]),
          ikon('tambah')
        ]));
      });
    }
    kCari.input.addEventListener('input', saring);
    saring();
    var lembar = bukaLembar({ judul: opsi.judul, isi: [kCari.wadah, hasil], aksi: [{ teks: 'Tutup', jenis: 'kedua' }] });
    return lembar;
  }

  /** "Sauce bolognese: sekitar 1,5 liter lewat masa simpan (baik sampai 4 Okt)." (tampilan Bagian 7) */
  function teksMasaSimpan(x, lewat) {
    return x.item + ': sekitar ' + formatAngka(x.qty) + (x.satuan ? ' ' + x.satuan : '') +
      (lewat ? ' lewat masa simpan' : ' habis besok') + (x.baikSampai ? ' (baik sampai ' + tanggalPendek(x.baikSampai) + ')' : '') + '.';
  }

  /**
   * Jalan pintas "Catat sebagai waste" (Bagian 5.3): item itu masuk draft
   * Waste dengan kategori Expired sudah terpilih, lalu form Waste dibuka.
   */
  function catatSebagaiWaste(item) {
    var d = bacaDraftWaste();
    var ada = d.baris.filter(function (b) { return b.item === item && b.kategori === 'Expired'; })[0];
    if (!d.baris.length) d.tanggal = tanggalIso(new Date());
    if (!ada) {
      ada = { id: buatId(), item: item, kategori: 'Expired', qty: '', alasan: '' };
      d.baris.push(ada);
    }
    Draft.simpan('waste', { tanggal: d.tanggal, shift: d.shift, baris: d.baris, terbuka: ada.id, sid: d.sid });
    location.hash = '#/waste';
  }

  /* =======================================================================
   * Form Prep List (spesifikasi sistem Bagian 5.3, tampilan Bagian 5.3)
   * ===================================================================== */

  var JUMLAH_RESEP_CEPAT = [{ nilai: '0.5', label: '½' }, { nilai: '1', label: '1' }, { nilai: '1.5', label: '1½' }, { nilai: '2', label: '2' }];

  /**
   * Draft per pengguna: { tanggal, shift, baris: [{ id, item, jumlah, ketik,
   * qty, keterangan }], sid }. jumlah: jumlah resep (teks); ketik: true jika
   * diketik di kolom, bukan dipilih dari tombol cepat.
   */
  function bacaDraftPrep() {
    var d = Draft.baca('prep');
    var data = d && d.data ? d.data : {};
    return {
      tanggal: data.tanggal || '',
      shift: data.shift || '',
      baris: Array.isArray(data.baris) ? data.baris : [],
      sid: data.sid || '',
      waktu: d ? d.waktu : null
    };
  }

  /** Data prep di HP (resep ikut tersimpan). Tanggal lain tanpa sinyal: stock dianggap tidak bergerak sejak data itu. */
  function dataPrepDariHp(tanggal) {
    var c = Cache.baca('prep');
    if (!c || !c.data || !c.data.item) return null;
    if (c.data.tanggal === tanggal) return c.data;
    return Object.assign({}, c.data, {
      tanggal: tanggal,
      kiriman: { jumlah: 0, terakhir: null, baris: [] },
      nihil: null,
      turunan: true
    });
  }

  function layarPrep(k) {
    aturJudul('Prep list');
    var pengelola = !!k.sesi.pengguna.pengelola;
    var draft = bacaDraftPrep();
    var tanggal = tanggalDraft(draft.tanggal, pengelola);
    var data = null;
    var mediaDesktop = window.matchMedia(DESKTOP);
    var pembaru = []; // perbarui angka otomatis semua baris (peringatan bahan bergantung pada baris lain)

    var catatanDraft = el('p', { class: 'catatan-draft', 'aria-live': 'polite' });
    var penanda = el('span', { class: 'memperbarui', role: 'status' });
    var statusForm = el('div', { class: 'status-form' });
    var wadahBaris = el('div');
    var pesan = el('p', { class: 'pesan-formulir', role: 'alert' });
    var penghitung = el('span', { class: 'penghitung', 'aria-live': 'polite' });
    var tombolKirim = tombol('Kirim prep list', 'utama');
    var tombolTambah = tombol('Tambah item', 'kedua', { 'aria-haspopup': 'dialog' });
    tombolTambah.insertBefore(ikon('tambah'), tombolTambah.lastChild);

    var gTanggal = pilihanTanggalIsian({ pengelola: pengelola, tanggal: tanggal, ganti: gantiTanggal });
    var gShift = grupPilihan('Shift', SHIFT, draft.shift);
    gShift.input.forEach(function (i) {
      i.addEventListener('change', function () {
        draft.shift = gShift.nilai();
        gShift.galat('');
        simpanDraft();
      });
    });

    k.wadah.appendChild(el('div', { class: 'layar-isi layar-form' }, [
      tautanKembali('Beranda', '#/'),
      el('h1', { class: 'judul-layar', text: 'Prep List' }),
      catatanDraft,
      el('section', { class: 'kartu kotak-info', 'aria-label': 'Kotak info' }, [
        gTanggal.wadah,
        gShift.wadah,
        el('div', { class: 'lebar-penuh' }, [penanda, statusForm])
      ]),
      wadahBaris,
      el('div', { class: 'deret-tambah' }, tombolTambah),
      pesan,
      el('div', { class: 'bilah-kirim' }, [penghitung, tombolKirim])
    ]));

    function simpanDraft() {
      var waktu = Draft.simpan('prep', { tanggal: tanggal, shift: draft.shift, baris: draft.baris, sid: draft.sid });
      catatanDraft.textContent = draft.baris.length && waktu ? 'Draft tersimpan ' + jam(new Date(waktu).toISOString()) : '';
    }
    if (draft.waktu && draft.baris.length) catatanDraft.textContent = 'Draft tersimpan ' + jam(new Date(draft.waktu).toISOString());

    function infoItem(nama) {
      var daftar = data && data.item || [];
      for (var i = 0; i < daftar.length; i++) if (daftar[i].nama.toLowerCase() === String(nama).toLowerCase()) return daftar[i];
      return { nama: nama, satuan: '', stock: null };
    }

    function resepUntuk(nama) {
      var daftar = data && data.resep || [];
      for (var i = 0; i < daftar.length; i++) if (daftar[i].item.toLowerCase() === String(nama).toLowerCase()) return daftar[i];
      return null;
    }

    /** Hasil pemeriksaan satu baris: { resep, jumlah, aktual, qty, salah: 'jumlah' | 'aktual' | 'qty' | '' }. */
    function periksa(b) {
      var r = resepUntuk(b.item);
      if (r) {
        var j = bacaAngka(b.jumlah);
        // Hasil aktual (aplikasi 0.24.0): tidak wajib; kosong = hasil menurut resep.
        var a = data && data.hasilAktualSiap ? bacaAngka(b.aktual) : null;
        return { resep: r, jumlah: j, aktual: a !== null && !isNaN(a) ? a : null,
          salah: j === null || isNaN(j) || !(j > 0) ? 'jumlah' : (a !== null && isNaN(a) ? 'aktual' : '') };
      }
      var q = bacaAngka(b.qty);
      return { resep: null, qty: q, salah: q === null || isNaN(q) || !(q > 0) ? 'qty' : '' };
    }

    /**
     * Bahan yang terpakai tiap baris dan peringatan stock tidak cukup: stock
     * tercatat dibandingkan dengan kebutuhan baris itu ditambah baris di atasnya
     * yang memakai bahan yang sama. { idBaris: [{ item, qty, satuan, teks }] }.
     */
    function hitungBahan() {
      var pakai = {};
      var hasil = {};
      draft.baris.forEach(function (b) {
        var h = periksa(b);
        hasil[b.id] = [];
        if (!h.resep || h.salah) return;
        h.resep.bahan.forEach(function (x) {
          var it = infoItem(x.item);
          var qty = bulat3(h.jumlah * x.qty);
          var kunci = x.item.toLowerCase();
          var sebelum = pakai[kunci] || 0;
          var total = bulat3(sebelum + qty);
          pakai[kunci] = total;
          var teks = '';
          if (it.stock != null && total > it.stock) {
            var tercatat = 'Stock ' + x.item + ' tercatat ' + formatAngka(it.stock) + ' ' + it.satuan;
            teks = qty > it.stock
              ? tercatat + ', resep ini butuh ' + formatAngka(qty) + ' ' + it.satuan + '.'
              : tercatat + ', isian ini butuh ' + formatAngka(total) + ' ' + it.satuan + ' bersama item di atasnya.';
          }
          hasil[b.id].push({ item: x.item, qty: qty, satuan: it.satuan, teks: teks });
        });
      });
      return hasil;
    }

    function perbaruiSemua() {
      var bahan = hitungBahan();
      pembaru.forEach(function (fn) { fn(bahan); });
      perbaruiPenghitung();
    }

    function perbaruiPenghitung() {
      var lengkap = draft.baris.filter(function (b) { return !periksa(b).salah; }).length;
      penghitung.textContent = draft.baris.length
        ? lengkap + ' dari ' + draft.baris.length + ' item lengkap'
        : 'Belum ada item';
    }

    function hapusBaris(b) {
      draft.baris = draft.baris.filter(function (x) { return x !== b; });
      simpanDraft();
      gambarBaris();
      toast(b.item + ' dihapus dari isian.');
    }

    /** Isian satu baris; dipakai kartu (HP dan tablet) dan baris tabel (laptop dan desktop). */
    function isianBaris(b, nomor) {
      var it = infoItem(b.item);
      var r = resepUntuk(b.item);
      var x = { it: it, resep: r };
      x.hapus = el('button', { type: 'button', class: 'tombol-ikon', 'aria-label': 'Hapus ' + b.item + ' dari isian',
        onclick: function () { hapusBaris(b); } }, ikon('sampah'));
      x.kKet = kolomIsian({ label: 'Keterangan', maxlength: 200, nilai: b.keterangan || '', bantuan: 'Tidak wajib.',
        atribut: { 'data-kunci': b.id + '|keterangan' } });
      x.kKet.input.addEventListener('input', function () {
        b.keterangan = x.kKet.input.value;
        simpanDraft();
      });
      x.galat = el('p', { class: 'kolom-galat' });

      if (r) {
        // Jumlah resep: tombol cepat ½, 1, 1½, 2, atau diketik di kolom terakhir.
        var nama = 'jumlah-resep-' + (++nomorKolom);
        var idLain = 'jumlah-lain-' + nomorKolom;
        var radio = [];
        var fs = el('fieldset', { class: 'pilihan-grup pilihan-jumlah-resep' }, [el('legend', { class: 'kolom-label', text: 'Jumlah resep' })]);
        JUMLAH_RESEP_CEPAT.forEach(function (p) {
          var i = el('input', { type: 'radio', name: nama, value: p.nilai, 'aria-label': p.label + ' resep' });
          if (!b.ketik && b.jumlah === p.nilai) i.checked = true;
          radio.push(i);
          fs.appendChild(el('label', { class: 'pilihan' }, [i, el('span', { text: p.label, 'aria-hidden': 'true' })]));
        });
        var inLain = el('input', { class: 'isian isian-angka isian-jumlah-lain', id: idLain, type: 'text', inputmode: 'decimal',
          autocomplete: 'off', placeholder: 'Lain', 'aria-label': 'Jumlah resep lain untuk ' + b.item, 'data-kunci': b.id + '|jumlah' });
        if (b.ketik) inLain.value = b.jumlah || '';
        fs.appendChild(el('span', { class: 'jumlah-lain' }, inLain));
        radio.forEach(function (i) {
          i.addEventListener('change', function () {
            b.jumlah = i.value;
            b.ketik = false;
            inLain.value = '';
            simpanDraft();
            perbaruiSemua();
          });
        });
        inLain.addEventListener('input', function () {
          b.jumlah = inLain.value;
          b.ketik = true;
          radio.forEach(function (i) { i.checked = false; });
          simpanDraft();
          perbaruiSemua();
        });
        x.isian = el('div', { class: 'kolom' }, [fs, x.galat]);
        x.inputUtama = inLain;
        if (data && data.hasilAktualSiap) {
          var idAktual = 'aktual-prep-' + nomor;
          var inAktual = el('input', { class: 'isian isian-angka', id: idAktual, type: 'text', inputmode: 'decimal', autocomplete: 'off',
            'data-kunci': b.id + '|aktual', 'aria-describedby': idAktual + '-bantuan' });
          inAktual.value = b.aktual || '';
          x.bantuanAktual = el('p', { class: 'kolom-bantuan', id: idAktual + '-bantuan' });
          x.galatAktual = el('p', { class: 'kolom-galat' });
          x.aktual = el('div', { class: 'kolom kolom-hasil-aktual' }, [
            el('label', { class: 'kolom-label', for: idAktual, text: 'Hasil aktual (tidak wajib)' }),
            el('div', { class: 'baris-angka' }, [inAktual, el('span', { class: 'satuan-tetap', text: it.satuan })]),
            x.bantuanAktual,
            x.galatAktual
          ]);
          x.inputAktual = inAktual;
          inAktual.addEventListener('input', function () {
            b.aktual = inAktual.value;
            simpanDraft();
            perbaruiSemua();
          });
        }
        x.hasil = el('p', { class: 'otomatis hasil-prep' });
        x.baik = el('p', { class: 'baik-sampai' });
        x.bahan = el('p', { class: 'otomatis bahan-prep' });
        x.peringatan = el('div', { class: 'wadah-peringatan' });
        pembaru.push(function (semua) {
          var h = periksa(b);
          var salahKetik = b.ketik && h.jumlah !== null && (isNaN(h.jumlah) || !(h.jumlah > 0));
          inLain.setAttribute('aria-invalid', salahKetik ? 'true' : 'false');
          kosongkan(x.galat);
          if (salahKetik) {
            x.galat.appendChild(ikonStatus('masalah'));
            x.galat.appendChild(el('span', { text: 'Isi angka lebih dari 0, misalnya 1,5.' }));
          }
          kosongkan(x.hasil);
          kosongkan(x.baik);
          kosongkan(x.bahan);
          kosongkan(x.peringatan);
          if (x.inputAktual) {
            var aktualSalah = h.salah === 'aktual';
            x.inputAktual.setAttribute('aria-invalid', aktualSalah ? 'true' : 'false');
            kosongkan(x.galatAktual);
            if (aktualSalah) {
              x.galatAktual.appendChild(ikonStatus('masalah'));
              x.galatAktual.appendChild(el('span', { text: 'Isi angka 0 atau lebih, misalnya 7,5, atau kosongkan.' }));
            }
            var standar = h.jumlah > 0 ? bulat3(h.jumlah * r.hasil) : null;
            x.bantuanAktual.textContent = h.aktual != null && standar
              ? formatAngka(Math.round(h.aktual / standar * 1000) / 10) + '% dari hasil menurut resep. Stock bertambah ' +
                formatAngka(h.aktual) + ' ' + it.satuan + '.'
              : (x.dalamTabel ? 'Kosong = hasil resep.' : 'Yang benar-benar jadi. Kosongkan jika sama dengan hasil menurut resep.');
          }
          if (h.salah === 'jumlah') {
            x.hasil.textContent = 'Hasil per 1 resep ' + formatAngka(r.hasil) + ' ' + it.satuan + '. Pilih jumlah resep.';
            return;
          }
          x.hasil.appendChild(document.createTextNode(x.inputAktual ? 'Hasil menurut resep ' : 'Hasil '));
          x.hasil.appendChild(el('strong', { class: 'angka-satuan', text: formatAngka(bulat3(h.jumlah * r.hasil)) + ' ' + it.satuan }));
          if (r.masaSimpan != null) x.baik.textContent = (x.dalamTabel ? '' : 'Baik sampai ') + tanggalPendek(geserHari(tanggal, r.masaSimpan));
          var daftar = semua[b.id] || [];
          x.bahan.textContent = 'Bahan: ' + daftar.map(function (d) {
            return d.item + ' ' + formatAngka(d.qty) + (d.satuan ? ' ' + d.satuan : '');
          }).join(', ');
          daftar.forEach(function (d) {
            if (!d.teks) return;
            x.peringatan.appendChild(el('p', { class: 'pesan-formulir tinjau peringatan' }, [ikon('info'), el('span', { text: d.teks })]));
          });
        });
      } else {
        var idQty = 'qty-prep-' + nomor;
        var inQty = el('input', { class: 'isian isian-angka', id: idQty, type: 'text', inputmode: 'decimal', autocomplete: 'off',
          'data-kunci': b.id + '|qty' });
        inQty.value = b.qty || '';
        inQty.addEventListener('input', function () {
          b.qty = inQty.value;
          simpanDraft();
          perbaruiSemua();
        });
        x.isian = el('div', { class: 'kolom' }, [
          el('label', { class: 'kolom-label', for: idQty, text: 'Qty' }),
          el('div', { class: 'baris-angka' }, [inQty, el('span', { class: 'satuan-tetap', text: it.satuan })]),
          x.galat
        ]);
        x.inputUtama = inQty;
        x.hasil = el('p', { class: 'otomatis', text: 'Tanpa resep: stock tidak bergerak.' });
        pembaru.push(function () {
          var h = periksa(b);
          var salah = h.qty !== null && (isNaN(h.qty) || !(h.qty > 0));
          inQty.setAttribute('aria-invalid', salah ? 'true' : 'false');
          kosongkan(x.galat);
          if (salah) {
            x.galat.appendChild(ikonStatus('masalah'));
            x.galat.appendChild(el('span', { text: 'Isi angka lebih dari 0, misalnya 2,5.' }));
          }
        });
      }
      return x;
    }

    function kartu(b, nomor) {
      var x = isianBaris(b, nomor);
      return el('article', { class: 'kartu-item', 'aria-label': b.item }, [
        el('div', { class: 'kartu-item-kepala' }, [el('h2', { class: 'kartu-item-nama', text: b.item }), x.hapus]),
        x.isian,
        x.hasil, x.aktual || null, x.baik || null, x.bahan || null, x.peringatan || null,
        x.kKet.wadah
      ]);
    }

    function barisTabel(b, nomor) {
      var x = isianBaris(b, nomor);
      x.dalamTabel = true; // kolom Baik sampai: tanggalnya saja
      x.kKet.wadah.querySelector('label').classList.add('sr');
      var bantu = x.kKet.wadah.querySelector('.kolom-bantuan');
      if (bantu) bantu.remove();
      x.kKet.input.setAttribute('aria-label', 'Keterangan ' + b.item);
      if (!x.resep) {
        x.isian.querySelector('label').classList.add('sr');
        x.inputUtama.setAttribute('aria-label', 'Qty ' + b.item);
      } else {
        x.isian.querySelector('legend').classList.add('sr');
      }
      if (x.aktual) {
        x.aktual.querySelector('label').classList.add('sr');
        x.inputAktual.setAttribute('aria-label', 'Hasil aktual ' + b.item);
      }
      return el('tr', {}, [
        el('td', { class: 'angka', text: String(nomor) }),
        el('td', { class: 'nama-item' }, el('span', { class: 'daftar-baris-judul', text: b.item })),
        el('td', { class: 'sel-jumlah-prep' }, x.isian),
        el('td', { class: 'otomatis sel-hasil-prep' }, [x.hasil, x.bahan || null, x.peringatan || null]),
        data.hasilAktualSiap ? el('td', { class: 'sel-aktual-prep' }, x.aktual || el('span', { class: 'otomatis', text: '–' })) : null,
        el('td', { class: 'otomatis' }, x.baik || el('span', { text: '–' })),
        el('td', { class: 'sel-alasan' }, x.kKet.wadah),
        el('td', {}, x.hapus)
      ]);
    }

    function gambarBaris() {
      kosongkan(wadahBaris);
      pembaru = [];
      tulisPesan(pesan, '');
      if (!draft.baris.length) {
        wadahBaris.appendChild(kotakKosong('Belum ada item prep. Ketuk Tambah item untuk mencatat prep.'));
        perbaruiPenghitung();
        return;
      }
      if (mediaDesktop.matches) {
        var badan = el('tbody');
        draft.baris.forEach(function (b, i) { badan.appendChild(barisTabel(b, i + 1)); });
        wadahBaris.appendChild(el('div', { class: 'tabel-bingkai tabel-isian-bingkai' }, el('table', { class: 'tabel tabel-isian tabel-prep' }, [
          el('thead', {}, el('tr', {}, ['No', 'Item / Menu Prep', 'Jumlah resep atau Qty', 'Hasil dan bahan']
            .concat(data.hasilAktualSiap ? ['Hasil aktual'] : [], ['Baik sampai', 'Keterangan', ''])
            .map(function (j, i) { return el('th', { scope: 'col', class: i === 0 ? 'angka' : null, text: j }); }))),
          badan
        ])));
      } else {
        var grid = el('div', { class: 'grid-item' });
        draft.baris.forEach(function (b, i) { grid.appendChild(kartu(b, i + 1)); });
        wadahBaris.appendChild(grid);
      }
      perbaruiSemua();
    }

    function tambahBaris(nama) {
      var b = { id: buatId(), item: nama, jumlah: '', ketik: false, qty: '', keterangan: '', aktual: '' };
      draft.baris.push(b);
      simpanDraft();
      gambarBaris();
      if (!apakahSentuh()) {
        var kolom = wadahBaris.querySelector('[data-kunci="' + b.id + '|' + (resepUntuk(nama) ? 'jumlah' : 'qty') + '"]');
        if (kolom) kolom.focus();
      }
    }

    tombolTambah.addEventListener('click', function () {
      var daftar = (data && data.item || []).filter(function (it) { return it.aktif !== false; });
      bukaPilihItem({
        judul: 'Tambah item prep',
        daftar: daftar,
        kosong: 'Daftar item belum termuat. Periksa sinyal, lalu buka lagi.',
        ket: function (it) {
          var r = resepUntuk(it.nama);
          return [it.kategori, it.satuan, r ? 'resep: hasil ' + formatAngka(r.hasil) + ' ' + it.satuan : 'tanpa resep'].filter(Boolean).join(' · ');
        },
        pilih: function (it) { tambahBaris(it.nama); }
      });
    });

    function gambarStatus() {
      kosongkan(statusForm);
      if (!data) return;
      var menunggu = antreanForm('PREP', tanggal);
      var kirimMenunggu = menunggu.filter(function (e) { return e.aksi === 'kirimPrep'; });
      var nihilMenunggu = menunggu.filter(function (e) { return e.aksi === 'tandaiNihil'; })[0] || null;
      var kr = data.kiriman;
      if (kr.jumlah) {
        var t = kr.terakhir;
        statusForm.appendChild(el('p', {}, [tandaStatus('baik', 'Terkirim'),
          el('span', { class: 'kolom-bantuan', text: ' ' + kr.jumlah + ' kiriman' + (t ? ', terakhir ' + jam(t.waktu) + ', ' + t.oleh : '') + '.' })]));
        statusForm.appendChild(el('p', { class: 'kolom-bantuan lebar-penuh', text: 'Tercatat: ' + kr.baris.map(function (b) {
          return b.item + ' ' + (b.jumlahResep != null
            ? formatAngka(b.jumlahResep) + ' resep (' + formatAngka(b.hasil) + ' ' + b.satuan +
              (b.hasilAktual != null && b.hasilStandar != null ? ', resep ' + formatAngka(b.hasilStandar) : '') + ')'
            : formatAngka(b.qty) + (b.satuan ? ' ' + b.satuan : '')) +
            (b.baikSampai ? ', baik sampai ' + tanggalPendek(b.baikSampai) : '');
        }).join('; ') + '.' }));
      }
      if (kirimMenunggu.length) statusForm.appendChild(tandaStatus('menunggu', kirimMenunggu.length + ' isian menunggu kirim'));
      var nihil = bagianNihil({
        formId: 'PREP',
        namaForm: 'Prep list',
        tanggal: tanggal,
        nihil: data.nihil,
        adaIsian: kr.jumlah > 0 || kirimMenunggu.length > 0,
        menunggu: nihilMenunggu,
        selesai: function (n) {
          data.nihil = n;
          gambarStatus();
        }
      });
      if (nihil) statusForm.appendChild(nihil);
    }

    function gambar(d) {
      data = d;
      gambarStatus();
      gambarBaris();
    }

    function gantiTanggal(baru) {
      if (baru === tanggal) return;
      tanggal = baru;
      simpanDraft();
      muat();
    }

    tombolKirim.addEventListener('click', function () {
      if (tombolKirim.disabled) return;
      tulisPesan(pesan, '');
      if (!gShift.galat(draft.shift ? '' : 'Pilih shift.')) {
        gShift.input[0].focus();
        tulisPesan(pesan, 'Pilih shift: Pagi, Siang, atau Malam.', 'masalah');
        return;
      }
      if (!draft.baris.length) {
        tulisPesan(pesan, 'Tambah minimal satu item prep.', 'masalah');
        return;
      }
      var salah = null;
      draft.baris.forEach(function (b) {
        var h = periksa(b);
        if (h.salah && !salah) salah = { b: b, jenis: h.salah };
      });
      if (salah) {
        tulisPesan(pesan, salah.jenis === 'jumlah' ? 'Isi jumlah resep untuk ' + salah.b.item + '.'
          : (salah.jenis === 'aktual' ? 'Periksa hasil aktual ' + salah.b.item + '. Isi angka, misalnya 7,5, atau kosongkan.'
            : 'Isi Qty ' + salah.b.item + ' lebih dari 0, misalnya 2,5.'), 'masalah');
        var kolom = wadahBaris.querySelector('[data-kunci="' + salah.b.id + '|' + salah.jenis + '"]');
        if (kolom) kolom.focus();
        return;
      }
      if (!draft.sid) draft.sid = buatId();
      var baris = draft.baris.map(function (b) {
        var h = periksa(b);
        return h.resep
          ? Object.assign({ item: b.item, jumlahResep: h.jumlah, qty: '', keterangan: String(b.keterangan || '').trim() },
            h.aktual != null ? { hasilAktual: h.aktual } : {})
          : { item: b.item, jumlahResep: '', qty: h.qty, keterangan: String(b.keterangan || '').trim() };
      });
      // "Baik sampai" untuk label wadah, dihitung di HP (server menghitung ulang dengan resep yang berlaku).
      var labelHp = draft.baris.map(function (b) {
        var r = resepUntuk(b.item);
        return r && r.masaSimpan != null ? { item: b.item, tanggal: geserHari(tanggal, r.masaSimpan) } : null;
      }).filter(Boolean);
      var isi = { submissionId: draft.sid, tanggal: tanggal, shift: draft.shift, waktuPerangkat: new Date().toISOString(), baris: baris };
      var entri = { id: isi.submissionId, aksi: 'kirimPrep', isi: isi, formId: 'PREP',
        judul: 'Prep list · ' + baris.length + ' item', tanggal: tanggal };
      function teksLabel(daftar) {
        return daftar.length ? 'Tulis di label wadah: ' + daftar.map(function (x) {
          return x.item + ' baik sampai ' + tanggalPendek(x.tanggal);
        }).join(', ') + '.' : '';
      }
      function kosongkanIsian() {
        draft.baris = [];
        draft.sid = buatId();
        simpanDraft();
      }
      function keAntrean() {
        simpanKeAntrean(entri);
        kosongkanIsian();
        gambarStatus();
        gambarBaris();
        toast('Tersimpan di HP. Dikirim saat ada sinyal.');
        if (labelHp.length) tulisPesan(pesan, teksLabel(labelHp), 'info');
      }
      if (navigator.onLine === false) {
        keAntrean();
        return;
      }
      aturTombolProses(tombolKirim, true, 'Mengirim…');
      jagaProses(panggilApi('kirimPrep', isi)).then(function (hasil) {
        aturTombolProses(tombolKirim, false);
        kosongkanIsian();
        Cache.tulis('prep', hasil.form);
        if (hasil.form.tanggal === tanggal) gambar(hasil.form);
        else gambarBaris();
        toast('Prep list terkirim. Stock bahan dan barang jadi sudah diperbarui.');
        var teks = ['Prep list terkirim. Stock bahan dan barang jadi sudah diperbarui.'];
        var label = teksLabel(hasil.baikSampai || []);
        if (label) teks.push(label);
        (hasil.peringatan || []).forEach(function (p) {
          teks.push('Stock ' + p.item + ' sekarang tercatat ' + formatAngka(p.akhir) + (p.satuan ? ' ' + p.satuan : '') + '.');
        });
        if ((hasil.peringatan || []).length) teks.push('Minta Pengelola meluruskan stock jika angkanya keliru.');
        tulisPesan(pesan, teks.join(' '), (hasil.peringatan || []).length ? 'tinjau' : 'baik');
      }).catch(function (err) {
        aturTombolProses(tombolKirim, false);
        if (err && err.jaringan) {
          keAntrean();
          return;
        }
        if (err && err.sesiBerakhir) {
          simpanKeAntrean(entri);
          kosongkanIsian();
          tanganiSesiBerakhir(err);
          return;
        }
        tulisPesan(pesan, pesanGalat(err), 'masalah');
      });
    });

    function muat() {
      return muatData({
        dariHp: function () { return dataPrepDariHp(tanggal); },
        simpanHp: function (d) { Cache.tulis('prep', d); },
        ambil: function () { return panggilApi('formPrep', { tanggal: tanggal }); },
        gambar: function (d) {
          if (d.tanggal === tanggal) gambar(d);
        },
        kerangka: function () {
          kosongkan(wadahBaris).appendChild(kerangkaBaris(3));
        },
        galat: function (teks, cobaLagi) {
          kosongkan(wadahBaris).appendChild(kotakGalat(teks, cobaLagi));
        },
        penanda: penanda
      });
    }

    function gantiSusunan() {
      gambarBaris();
    }
    if (mediaDesktop.addEventListener) mediaDesktop.addEventListener('change', gantiSusunan);
    else if (mediaDesktop.addListener) mediaDesktop.addListener(gantiSusunan);
    pembersihLayar.push(function () {
      if (mediaDesktop.removeEventListener) mediaDesktop.removeEventListener('change', gantiSusunan);
      else if (mediaDesktop.removeListener) mediaDesktop.removeListener(gantiSusunan);
    });

    gambarBaris();
    muat();
    segarkanLayar = muat;
    segarkanAntrean = gambarStatus;
  }

  /* =======================================================================
   * Form kustom (spesifikasi sistem Bagian 5.6, tampilan Bagian 5.3): layar
   * isi umum yang dibentuk dari definisi form. Kolom kepala di kotak info,
   * kolom baris sebagai kartu (HP dan tablet) atau tabel (laptop dan
   * desktop). Dipakai juga pratinjau di Pengaturan → Form.
   * ===================================================================== */

  var JENIS_KOLOM = ['Teks', 'Angka', 'Pilihan', 'Ya/Tidak', 'Item', 'Jam'];
  var URUTAN_HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  var NAMA_JADWAL = { harian: 'Setiap hari', 'hari tertentu': 'Hari tertentu', 'sewaktu-waktu': 'Sewaktu-waktu' };

  /** "Setiap hari", "Senin, Kamis", atau "Sewaktu-waktu". */
  function teksJadwal(f) {
    if (f.jadwal === 'hari tertentu') return (f.hari || []).length ? f.hari.join(', ') : 'Hari tertentu';
    return NAMA_JADWAL[f.jadwal] || 'Setiap hari';
  }

  /** "Diisi tiap closing. Jadwal: Setiap hari." */
  function kalimatKeterangan(ket, jadwal) {
    var k = String(ket || '').trim();
    if (!k) return jadwal;
    return k + (/[.!?]$/.test(k) ? ' ' : '. ') + jadwal;
  }

  function hrefFormKustom(id) {
    return '#/form/' + encodeURIComponent(id);
  }

  /** "Isi" untuk kolom yang diketik, "Pilih" untuk pilihan dan item (pesan sama dengan server). */
  function kataIsi(c) {
    return c.jenis === 'Pilihan' || c.jenis === 'Ya/Tidak' || c.jenis === 'Item' ? 'Pilih ' : 'Isi ';
  }

  /** Nilai satu kolom: { kosong, salah (pesan) }. */
  function periksaNilaiKustom(c, v, letak) {
    var t = String(v == null ? '' : v).trim();
    if (!t) return { kosong: true, salah: '' };
    if (c.jenis === 'Angka') {
      var n = bacaAngka(t);
      if (n === null || isNaN(n)) return { kosong: false, salah: c.label + letak + ' diisi angka 0 atau lebih, misalnya 2,5.' };
    }
    if (c.jenis === 'Jam' && !/^\d{1,2}[:.]\d{2}$/.test(t)) return { kosong: false, salah: c.label + letak + ' diisi jam, misalnya 07:30.' };
    return { kosong: false, salah: '' };
  }

  /** Nilai untuk dikirim: angka sebagai bilangan, lainnya teks. */
  function nilaiKirimKustom(c, v) {
    var t = String(v == null ? '' : v).trim();
    if (!t) return '';
    return c.jenis === 'Angka' ? bacaAngka(t) : t;
  }

  /**
   * Isian satu kolom menurut jenisnya (tampilan Bagian 5.3): Teks dan Angka
   * kolom isian; Pilihan tombol berjajar jika empat atau kurang, selebihnya
   * dropdown; Ya/Tidak dua tombol; Item pencarian item; Jam pemilih waktu.
   * opsi: { nilai, ubah(v), item: [{ nama, kategori, satuan }], tabel: label
   *         hanya untuk pembaca layar, kunci: data-kunci untuk fokus }.
   * Mengembalikan { wadah, fokus(), galat(pesan) }.
   */
  function isianKolomKustom(c, opsi) {
    var label = c.label + (c.wajib ? ' (wajib)' : '');
    var nilai = opsi.nilai == null ? '' : String(opsi.nilai);
    var hasil;
    if (c.jenis === 'Ya/Tidak' || (c.jenis === 'Pilihan' && (c.pilihan || []).length <= 4)) {
      var g = grupPilihan(label, c.jenis === 'Ya/Tidak' ? ['Ya', 'Tidak'] : c.pilihan, nilai);
      if (opsi.tabel) g.wadah.querySelector('legend').classList.add('sr');
      g.wadah.querySelector('fieldset').classList.add('pilihan-kustom');
      g.input.forEach(function (i) {
        if (opsi.kunci) i.setAttribute('data-kunci', opsi.kunci);
        i.addEventListener('change', function () { g.galat(''); opsi.ubah(g.nilai()); });
      });
      hasil = { wadah: g.wadah, fokus: function () { g.input[0].focus(); }, galat: g.galat };
    } else if (c.jenis === 'Pilihan') {
      var kp = kolomPilih({ label: label, nilai: nilai, pilihan: [{ value: '', text: 'Pilih…' }].concat(c.pilihan.map(function (p) {
        return { value: p, text: p };
      })) });
      if (opsi.tabel) kp.wadah.querySelector('label').classList.add('sr');
      if (opsi.kunci) kp.input.setAttribute('data-kunci', opsi.kunci);
      kp.input.addEventListener('change', function () { kp.galat(''); opsi.ubah(kp.input.value); });
      hasil = { wadah: kp.wadah, fokus: function () { kp.input.focus(); }, galat: kp.galat };
    } else if (c.jenis === 'Item') {
      var daftar = opsi.item || [];
      var wadah = el('div', { class: 'kolom kolom-item' });
      var galatItem = el('p', { class: 'kolom-galat' });
      var gambarItem = function () {
        kosongkan(wadah);
        var it = daftar.filter(function (x) { return x.nama.toLowerCase() === nilai.toLowerCase(); })[0];
        var pilih = tombol(nilai ? 'Ganti item' : 'Pilih item', 'kedua', { 'aria-haspopup': 'dialog',
          'aria-label': (nilai ? 'Ganti ' : 'Pilih ') + c.label.toLowerCase() + (nilai ? ', sekarang ' + nilai : ''), 'data-kunci': opsi.kunci });
        pilih.addEventListener('click', function () {
          bukaPilihItem({
            judul: 'Pilih ' + c.label.toLowerCase(),
            daftar: daftar,
            kosong: 'Daftar item belum termuat. Periksa sinyal, lalu buka lagi.',
            ket: function (x) { return [x.kategori, x.satuan].filter(Boolean).join(' · '); },
            pilih: function (x) {
              nilai = x.nama;
              opsi.ubah(nilai);
              gambarItem();
              var t = wadah.querySelector('button');
              if (t) t.focus();
            }
          });
        });
        wadah.appendChild(el('span', { class: 'kolom-label' + (opsi.tabel ? ' sr' : ''), text: label }));
        if (nilai) {
          wadah.appendChild(el('p', { class: 'nilai-terpilih' }, [el('strong', { text: nilai }),
            it && it.satuan ? el('span', { class: 'otomatis', text: ' · ' + it.satuan }) : null]));
        }
        wadah.appendChild(el('div', { class: 'deret-tombol' }, [pilih, nilai && !c.wajib ? tombol('Kosongkan', 'tautan', {
          'aria-label': 'Kosongkan ' + c.label.toLowerCase(),
          onclick: function () { nilai = ''; opsi.ubah(''); gambarItem(); }
        }) : null]));
        wadah.appendChild(galatItem);
      };
      gambarItem();
      hasil = {
        wadah: wadah,
        fokus: function () { var t = wadah.querySelector('button'); if (t) t.focus(); },
        galat: function (pesan) {
          kosongkan(galatItem);
          if (pesan) {
            galatItem.appendChild(ikonStatus('masalah'));
            galatItem.appendChild(el('span', { text: pesan }));
          }
          return !pesan;
        }
      };
    } else {
      var ki = kolomIsian({
        label: label,
        type: c.jenis === 'Jam' ? 'time' : 'text',
        inputmode: c.jenis === 'Angka' ? 'decimal' : null,
        kelas: c.jenis === 'Angka' ? 'isian-angka' : (c.jenis === 'Jam' ? 'isian-jam' : null),
        maxlength: c.jenis === 'Teks' ? 200 : null,
        nilai: nilai,
        atribut: opsi.kunci ? { 'data-kunci': opsi.kunci } : null
      });
      if (opsi.tabel) ki.wadah.querySelector('label').classList.add('sr');
      ki.input.addEventListener('input', function () {
        if (ki.input.getAttribute('aria-invalid') === 'true') ki.galat('');
        opsi.ubah(ki.input.value);
      });
      hasil = { wadah: ki.wadah, fokus: function () { ki.input.focus(); }, galat: ki.galat };
    }
    return hasil;
  }

  /**
   * Isian form kustom: kolom kepala, baris (kartu atau tabel), penghitung,
   * pemeriksaan kolom wajib, dan isi kiriman. o: { def: { nama, kolom },
   * item, keadaan: { kepala: { id: nilai }, baris: [{ id, nilai: {} }] },
   * ubah() (dipanggil setiap isian berubah), wadahBaris, penghitung,
   * desktop() → bool }.
   */
  function isianFormKustom(o) {
    var kolomKepala = o.def.kolom.filter(function (c) { return c.bagian === 'kepala'; });
    var kolomBaris = o.def.kolom.filter(function (c) { return c.bagian === 'baris'; });
    var k = o.keadaan;
    if (!k.kepala) k.kepala = {};
    if (!Array.isArray(k.baris) || !k.baris.length) k.baris = [{ id: buatId(), nilai: {} }];
    var isianKepala = {};
    var isianBaris = {};

    function barisTerisi(b) {
      return kolomBaris.some(function (c) { return !periksaNilaiKustom(c, b.nilai[c.id], '').kosong; });
    }

    function barisLengkap(b) {
      return kolomBaris.every(function (c) {
        var h = periksaNilaiKustom(c, b.nilai[c.id], '');
        return !h.salah && !(c.wajib && h.kosong);
      });
    }

    function perbaruiPenghitung() {
      if (!o.penghitung) return;
      var terisi = k.baris.filter(barisTerisi);
      var lengkap = terisi.filter(barisLengkap).length;
      o.penghitung.textContent = terisi.length ? lengkap + ' dari ' + terisi.length + ' baris lengkap' : 'Belum ada baris terisi';
    }

    var kepala = kolomKepala.map(function (c) {
      var x = isianKolomKustom(c, {
        nilai: k.kepala[c.id], item: o.item, kunci: 'kepala|' + c.id,
        ubah: function (v) { k.kepala[c.id] = v; o.ubah(); }
      });
      isianKepala[c.id] = x;
      return x.wadah;
    });

    function hapusBaris(b) {
      k.baris = k.baris.filter(function (x) { return x !== b; });
      if (!k.baris.length) k.baris.push({ id: buatId(), nilai: {} });
      o.ubah();
      gambarBaris();
    }

    function isianSatuBaris(b, nomor, tabel) {
      var hasil = {};
      isianBaris[b.id] = hasil;
      return kolomBaris.map(function (c) {
        var x = isianKolomKustom(c, {
          nilai: b.nilai[c.id], item: o.item, tabel: tabel, kunci: b.id + '|' + c.id,
          ubah: function (v) { b.nilai[c.id] = v; o.ubah(); perbaruiPenghitung(); }
        });
        hasil[c.id] = x;
        return x;
      });
    }

    function tombolHapus(b, nomor) {
      return el('button', { type: 'button', class: 'tombol-ikon', 'aria-label': 'Hapus baris ' + nomor,
        onclick: function () { hapusBaris(b); } }, ikon('sampah'));
    }

    function gambarBaris() {
      kosongkan(o.wadahBaris);
      isianBaris = {};
      if (o.desktop()) {
        var badan = el('tbody');
        k.baris.forEach(function (b, i) {
          var x = isianSatuBaris(b, i + 1, true);
          badan.appendChild(el('tr', {}, [el('td', { class: 'angka', text: String(i + 1) })]
            .concat(x.map(function (y, j) { return el('td', { class: 'sel-kustom sel-' + kolomBaris[j].jenis.replace('/', '').toLowerCase() }, y.wadah); }))
            .concat([el('td', {}, tombolHapus(b, i + 1))])));
        });
        o.wadahBaris.appendChild(el('div', { class: 'tabel-bingkai tabel-isian-bingkai' }, el('table', { class: 'tabel tabel-isian tabel-kustom' }, [
          el('thead', {}, el('tr', {}, [el('th', { scope: 'col', class: 'angka', text: 'No' })]
            .concat(kolomBaris.map(function (c) { return el('th', { scope: 'col', text: c.label + (c.wajib ? ' (wajib)' : '') }); }))
            .concat([el('th', { scope: 'col' }, el('span', { class: 'sr', text: 'Hapus' }))]))),
          badan
        ])));
      } else {
        var grid = el('div', { class: 'grid-item' });
        k.baris.forEach(function (b, i) {
          var x = isianSatuBaris(b, i + 1, false);
          grid.appendChild(el('article', { class: 'kartu-item', 'aria-label': 'Baris ' + (i + 1) }, [
            el('div', { class: 'kartu-item-kepala' }, [el('h2', { class: 'kartu-item-nama', text: 'Baris ' + (i + 1) }), tombolHapus(b, i + 1)])
          ].concat(x.map(function (y) { return y.wadah; }))));
        });
        o.wadahBaris.appendChild(grid);
      }
      perbaruiPenghitung();
    }

    function tambahBaris() {
      var b = { id: buatId(), nilai: {} };
      k.baris.push(b);
      o.ubah();
      gambarBaris();
      var pertama = o.wadahBaris.querySelector('[data-kunci^="' + b.id + '|"]');
      if (pertama) {
        if (!apakahSentuh()) pertama.focus();
        else pertama.scrollIntoView({ block: 'center' });
      }
    }

    /** Pemeriksaan sebelum kirim: null jika sah, atau { pesan, fokus() }. */
    function periksa() {
      var salah = null;
      kolomKepala.forEach(function (c) {
        if (salah) return;
        var h = periksaNilaiKustom(c, k.kepala[c.id], '');
        var pesan = h.salah || (c.wajib && h.kosong ? kataIsi(c) + c.label + '.' : '');
        if (pesan) {
          isianKepala[c.id].galat(pesan);
          salah = { pesan: pesan, fokus: isianKepala[c.id].fokus };
        }
      });
      if (salah) return salah;
      var terisi = 0;
      k.baris.forEach(function (b, i) {
        if (salah || !barisTerisi(b)) return;
        terisi++;
        kolomBaris.forEach(function (c) {
          if (salah) return;
          var letak = ' di baris ' + (i + 1);
          var h = periksaNilaiKustom(c, b.nilai[c.id], letak);
          var pesan = h.salah || (c.wajib && h.kosong ? kataIsi(c) + c.label + letak + '.' : '');
          if (pesan) {
            var x = isianBaris[b.id] && isianBaris[b.id][c.id];
            if (x) x.galat(pesan);
            salah = { pesan: pesan, fokus: x ? x.fokus : function () {} };
          }
        });
      });
      if (salah) return salah;
      if (!terisi) return { pesan: 'Isi minimal satu baris.', fokus: function () {} };
      return null;
    }

    function kumpul() {
      var kp = {};
      kolomKepala.forEach(function (c) { kp[c.id] = nilaiKirimKustom(c, k.kepala[c.id]); });
      return {
        kepala: kp,
        baris: k.baris.filter(barisTerisi).map(function (b) {
          var isi = {};
          kolomBaris.forEach(function (c) { isi[c.id] = nilaiKirimKustom(c, b.nilai[c.id]); });
          return isi;
        })
      };
    }

    return { kepala: kepala, gambarBaris: gambarBaris, tambahBaris: tambahBaris, periksa: periksa, kumpul: kumpul,
      jumlahBaris: function () { return k.baris.filter(barisTerisi).length; } };
  }

  /** Draft per pengguna per form: { tanggal, kepala, baris: [{ id, nilai }], sid }. */
  function bacaDraftKustom(id) {
    var d = Draft.baca('kustom:' + id);
    var data = d && d.data ? d.data : {};
    return {
      tanggal: data.tanggal || '',
      kepala: data.kepala && typeof data.kepala === 'object' ? data.kepala : {},
      baris: Array.isArray(data.baris) ? data.baris : [],
      sid: data.sid || '',
      waktu: d ? d.waktu : null
    };
  }

  /** Definisi form di HP (Bagian 11: form bisa dibuka tanpa sinyal). Untuk tanggal lain: tanpa catatan. */
  function dataKustomDariHp(id, tanggal) {
    var c = Cache.baca('kustom:' + id);
    if (!c || !c.data || !c.data.form) return null;
    if (c.data.tanggal === tanggal) return c.data;
    return Object.assign({}, c.data, { tanggal: tanggal, kiriman: { jumlah: 0, baris: 0, terakhir: null }, nihil: null, turunan: true });
  }

  function layarFormKustom(k) {
    var idForm = '';
    try {
      idForm = decodeURIComponent(k.cocok[1]).toUpperCase();
    } catch (err) {
      idForm = String(k.cocok[1]).toUpperCase();
    }
    var pengelola = !!k.sesi.pengguna.pengelola;
    var simpanan = Cache.baca('kustom:' + idForm);
    var namaAwal = simpanan && simpanan.data && simpanan.data.form ? simpanan.data.form.nama : 'Form';
    aturJudul(namaAwal);
    var draft = bacaDraftKustom(idForm);
    var tanggal = tanggalDraft(draft.tanggal, pengelola);
    var data = null;
    var isian = null;
    var mediaDesktop = window.matchMedia(DESKTOP);

    var judul = el('h1', { class: 'judul-layar', text: namaAwal });
    var keterangan = el('p', { class: 'kolom-bantuan keterangan-form' });
    var catatanDraft = el('p', { class: 'catatan-draft', 'aria-live': 'polite' });
    var penanda = el('span', { class: 'memperbarui', role: 'status' });
    var statusForm = el('div', { class: 'status-form' });
    var wadahKepala = el('div', { class: 'kepala-kustom' });
    var wadahBaris = el('div');
    var pesan = el('p', { class: 'pesan-formulir', role: 'alert' });
    var penghitung = el('span', { class: 'penghitung', 'aria-live': 'polite' });
    var tombolKirim = tombol('Kirim ' + namaAwal.toLowerCase(), 'utama');
    var tombolTambah = tombol('Tambah baris', 'kedua');
    tombolTambah.insertBefore(ikon('tambah'), tombolTambah.lastChild);
    var gTanggal = pilihanTanggalIsian({ pengelola: pengelola, tanggal: tanggal, ganti: gantiTanggal });

    k.wadah.appendChild(el('div', { class: 'layar-isi layar-form layar-kustom' }, [
      tautanKembali('Beranda', '#/'),
      judul,
      keterangan,
      catatanDraft,
      el('section', { class: 'kartu kotak-info', 'aria-label': 'Kotak info' }, [
        gTanggal.wadah,
        wadahKepala,
        el('div', { class: 'lebar-penuh' }, [penanda, statusForm])
      ]),
      wadahBaris,
      pesan,
      el('div', { class: 'bilah-kirim' }, [penghitung, el('div', { class: 'deret-tombol bilah-kirim-tombol' }, [tombolTambah, tombolKirim])])
    ]));

    function simpanDraft() {
      var waktu = Draft.simpan('kustom:' + idForm, { tanggal: tanggal, kepala: draft.kepala, baris: draft.baris, sid: draft.sid });
      catatanDraft.textContent = waktu ? 'Draft tersimpan ' + jam(new Date(waktu).toISOString()) : '';
    }
    if (draft.waktu && draft.baris.length) catatanDraft.textContent = 'Draft tersimpan ' + jam(new Date(draft.waktu).toISOString());

    function gambarStatus() {
      kosongkan(statusForm);
      if (!data) return;
      var menunggu = antreanForm(idForm, tanggal);
      var kirimMenunggu = menunggu.filter(function (e) { return e.aksi === 'kirimKustom'; });
      var nihilMenunggu = menunggu.filter(function (e) { return e.aksi === 'tandaiNihil'; })[0] || null;
      var kr = data.kiriman || { jumlah: 0 };
      if (kr.jumlah) {
        var t = kr.terakhir;
        statusForm.appendChild(el('p', {}, [tandaStatus('baik', 'Terkirim'),
          el('span', { class: 'kolom-bantuan', text: ' ' + kr.jumlah + ' kiriman, ' + kr.baris + ' baris' +
            (t ? ', terakhir ' + jam(t.waktu) + ', ' + t.oleh : '') + '.' })]));
      }
      if (kirimMenunggu.length) statusForm.appendChild(tandaStatus('menunggu', kirimMenunggu.length + ' isian menunggu kirim'));
      var nihil = bagianNihil({
        formId: idForm,
        namaForm: data.form.nama,
        tanggal: tanggal,
        nihil: data.nihil,
        adaIsian: kr.jumlah > 0 || kirimMenunggu.length > 0,
        menunggu: nihilMenunggu,
        selesai: function (n) {
          data.nihil = n;
          gambarStatus();
        }
      });
      if (nihil) statusForm.appendChild(nihil);
    }

    function gambar(d) {
      var defBerubah = !data || JSON.stringify(data.form) !== JSON.stringify(d.form) || JSON.stringify(data.item) !== JSON.stringify(d.item);
      data = d;
      var f = d.form;
      aturJudul(f.nama);
      judul.textContent = f.nama;
      gantiTeksTombol(tombolKirim, 'Kirim ' + f.nama.toLowerCase());
      keterangan.textContent = kalimatKeterangan(f.keterangan, 'Jadwal: ' + teksJadwal(f) + (d.wajib ? '.' : ', tidak ditagih pada tanggal ini.'));
      gambarStatus();
      if (!defBerubah && isian) return;
      isian = isianFormKustom({
        def: f, item: d.item || [], keadaan: draft, wadahBaris: wadahBaris, penghitung: penghitung,
        desktop: function () { return mediaDesktop.matches; },
        ubah: function () { tulisPesan(pesan, ''); simpanDraft(); }
      });
      kosongkan(wadahKepala);
      tambahAnak(wadahKepala, isian.kepala);
      wadahKepala.hidden = !isian.kepala.length;
      isian.gambarBaris();
    }

    function gantiTanggal(baru) {
      if (baru === tanggal) return;
      tanggal = baru;
      simpanDraft();
      muat();
    }

    tombolTambah.addEventListener('click', function () {
      if (isian) isian.tambahBaris();
    });

    tombolKirim.addEventListener('click', function () {
      if (tombolKirim.disabled || !isian || !data) return;
      tulisPesan(pesan, '');
      var salah = isian.periksa();
      if (salah) {
        tulisPesan(pesan, salah.pesan, 'masalah');
        salah.fokus();
        return;
      }
      if (!draft.sid) draft.sid = buatId();
      var kumpul = isian.kumpul();
      var namaForm = data.form.nama;
      var isi = { formId: idForm, submissionId: draft.sid, tanggal: tanggal, waktuPerangkat: new Date().toISOString(),
        kepala: kumpul.kepala, baris: kumpul.baris };
      var entri = { id: isi.submissionId, aksi: 'kirimKustom', isi: isi, formId: idForm,
        judul: namaForm + ' · ' + kumpul.baris.length + ' baris', tanggal: tanggal };
      function kosongkanIsian() {
        // Kolom kepala tetap (seperti shift di Waste); baris dikosongkan.
        draft.baris = [{ id: buatId(), nilai: {} }];
        draft.sid = buatId();
        simpanDraft();
        isian = null;
      }
      function keAntrean() {
        simpanKeAntrean(entri);
        kosongkanIsian();
        gambar(data);
        toast('Tersimpan di HP. Dikirim saat ada sinyal.');
      }
      if (navigator.onLine === false) {
        keAntrean();
        return;
      }
      aturTombolProses(tombolKirim, true, 'Mengirim…');
      jagaProses(panggilApi('kirimKustom', isi)).then(function (hasil) {
        aturTombolProses(tombolKirim, false);
        kosongkanIsian();
        Cache.tulis('kustom:' + idForm, hasil.form);
        gambar(hasil.form.tanggal === tanggal ? hasil.form : data);
        toast(namaForm + ' terkirim.');
      }).catch(function (err) {
        aturTombolProses(tombolKirim, false);
        if (err && err.jaringan) {
          keAntrean();
          return;
        }
        if (err && err.sesiBerakhir) {
          simpanKeAntrean(entri);
          kosongkanIsian();
          tanganiSesiBerakhir(err);
          return;
        }
        tulisPesan(pesan, pesanGalat(err), 'masalah');
      });
    });

    function muat() {
      return muatData({
        dariHp: function () { return dataKustomDariHp(idForm, tanggal); },
        simpanHp: function (d) { Cache.tulis('kustom:' + idForm, d); },
        ambil: function () { return panggilApi('formKustom', { formId: idForm, tanggal: tanggal }); },
        gambar: function (d) {
          if (d.tanggal === tanggal) gambar(d);
        },
        kerangka: function () {
          kosongkan(wadahBaris).appendChild(kerangkaBaris(3));
        },
        galat: function (teks, cobaLagi) {
          kosongkan(wadahBaris).appendChild(kotakGalat(navigator.onLine === false
            ? 'Form ini belum pernah dibuka di HP ini. Buka sekali saat ada sinyal supaya bisa diisi tanpa sinyal.' : teks, cobaLagi));
        },
        penanda: penanda
      });
    }

    function gantiSusunan() {
      if (isian) isian.gambarBaris();
    }
    if (mediaDesktop.addEventListener) mediaDesktop.addEventListener('change', gantiSusunan);
    else if (mediaDesktop.addListener) mediaDesktop.addListener(gantiSusunan);
    pembersihLayar.push(function () {
      if (mediaDesktop.removeEventListener) mediaDesktop.removeEventListener('change', gantiSusunan);
      else if (mediaDesktop.removeListener) mediaDesktop.removeListener(gantiSusunan);
    });

    muat();
    segarkanLayar = muat;
    segarkanAntrean = gambarStatus;
  }

  /* =======================================================================
   * Riwayat, pemeriksaan, dan koreksi (spesifikasi sistem Bagian 6,
   * tampilan Bagian 5.4). Dibangun umum dari daftar form di M_Form: form
   * yang Riwayat-nya sudah didaftarkan di server (RIWAYAT_FORM di Code.gs)
   * langsung tampil, dengan susunan kolom yang dikirim server.
   * ===================================================================== */

  var STATUS_RIWAYAT = [
    { nilai: '', label: 'Semua' },
    { nilai: 'terkirim', label: 'Terkirim' },
    { nilai: 'diperiksa', label: 'Diperiksa' },
    { nilai: 'dilaporkan', label: 'Dilaporkan keliru' },
    { nilai: 'dikoreksi', label: 'Pernah dikoreksi' }
  ];
  var PILIHAN_TANGGAL = ['7 hari terakhir', 'Satu tanggal', 'Rentang'];
  var BATAS_RIWAYAT_HARI = 31; // sekali ambil paling banyak 31 hari (spesifikasi sistem Bagian 6.1)

  /** Pilihan Riwayat per pengguna: form, tampilan, tanggal, dan filter. */
  function bacaPilihanRiwayat() {
    var c = Cache.baca('riwayat-pilihan');
    return Object.assign({
      formId: '', tampilan: 'catatan', tanggal: PILIHAN_TANGGAL[0], dari: '', sampai: '',
      kategori: '', item: '', pengisi: '', status: ''
    }, c && c.data ? c.data : {});
  }

  function simpanPilihanRiwayat(p) {
    Cache.tulis('riwayat-pilihan', p);
  }

  /** Isi permintaan "riwayat" dari pilihan. Pengisi dan status hanya untuk tampilan Catatan. */
  function kueriRiwayat(p) {
    var hari = tanggalIso(new Date());
    var dari = geserHari(hari, -6);
    var sampai = hari;
    if (p.tanggal === 'Satu tanggal' && p.dari) {
      dari = p.dari;
      sampai = p.dari;
    } else if (p.tanggal === 'Rentang' && p.dari && p.sampai) {
      dari = p.dari;
      sampai = p.sampai;
    }
    var rekap = p.tampilan === 'rekap';
    return {
      formId: p.formId, tampilan: rekap ? 'rekap' : 'catatan', dari: dari, sampai: sampai,
      kategori: p.kategori, item: p.item, pengisi: rekap ? '' : p.pengisi, status: rekap ? '' : p.status
    };
  }

  function jumlahFilter(p) {
    var rekap = p.tampilan === 'rekap';
    return [p.kategori, p.item, rekap ? '' : p.pengisi, rekap ? '' : p.status].filter(Boolean).length;
  }

  function bacaKueriAlamat(teks) {
    var hasil = {};
    String(teks || '').split('&').forEach(function (b) {
      var i = b.indexOf('=');
      if (i <= 0) return;
      try {
        hasil[decodeURIComponent(b.slice(0, i))] = decodeURIComponent(b.slice(i + 1));
      } catch (err) {
        /* abaikan */
      }
    });
    return hasil;
  }

  /** Jawaban "riwayat" terakhir (di HP) yang cocok dengan permintaan ini. */
  function riwayatDariHp(kueri) {
    var c = Cache.baca('riwayat');
    if (!c || !c.data || JSON.stringify(c.data.kueri) !== JSON.stringify(kueri)) return null;
    return c.data.data;
  }

  /** Setelah pemeriksaan atau koreksi: kiriman di data Riwayat yang tersimpan ikut diganti. */
  function gantiKirimanTersimpan(formId, kiriman) {
    var c = Cache.baca('riwayat');
    if (!c || !c.data || !c.data.data || c.data.data.formId !== formId) return;
    var d = c.data.data;
    d.kiriman = (d.kiriman || []).map(function (k) {
      if (k.id !== kiriman.id) return k;
      // Kiriman di daftar bisa hanya memuat baris yang cocok dengan filter item.
      var ada = {};
      k.baris.forEach(function (b) { ada[b.rowId] = true; });
      var baris = kiriman.baris.filter(function (b) { return ada[b.rowId]; });
      return Object.assign({}, kiriman, { baris: baris.length ? baris : kiriman.baris });
    });
    Cache.tulis('riwayat', c.data);
  }

  function kirimanTersimpan(formId, sid) {
    var c = Cache.baca('riwayat');
    var d = c && c.data && c.data.data;
    if (!d || d.formId !== formId) return null;
    var k = (d.kiriman || []).filter(function (x) { return x.id === sid; })[0];
    if (!k) return null;
    var nama = formId;
    (d.daftarForm || []).forEach(function (f) { if (f.id === formId) nama = f.nama; });
    var adaPdf = (d.daftarForm || []).some(function (f) { return f.id === formId && f.adaPdf; });
    return { formId: formId, namaForm: nama, adaPdf: adaPdf, kepala: d.kepala || [], kolom: d.kolom || [], gerakStock: !!d.gerakStock, kiriman: k };
  }

  /** Tanda status satu kiriman: Terkirim / Diperiksa, dilaporkan keliru, pernah dikoreksi. */
  function tandaKiriman(k) {
    var tanda = [k.status === 'Diperiksa' ? tandaStatus('baik', 'Diperiksa') : tandaStatus('baik', 'Terkirim')];
    if (k.dilaporkan) tanda.push(tandaStatus('tinjau', k.dilaporkan + ' dilaporkan keliru'));
    if (k.dikoreksi) tanda.push(tandaStatus('menunggu', 'Pernah dikoreksi'));
    return tanda;
  }

  /** Kolom dengan jikaKolom (hasil aktual prep) hanya berlaku untuk baris yang kolom itu berisi (baris beresep). */
  function kolomBerlaku(k, b) {
    return !k.jikaKolom || b.nilai[k.jikaKolom] != null;
  }

  /** Nilai satu kolom: nilai lama dicoret (jika pernah dikoreksi), nilai sekarang, angka asli. */
  function nilaiKolom(b, kol) {
    var v = b.nilai[kol.kunci];
    var satuan = kol.satuan ? b.satuan : (kol.akhiran || '');
    var kor = b.koreksi && b.koreksi[kol.kunci];
    var isi = [];
    if (kor) {
      var lama = kor.lama === '' || kor.lama == null ? null : Number(kor.lama);
      isi.push(el('del', { class: 'nilai-lama' }, [
        el('span', { class: 'sr', text: 'Nilai lama ' }),
        kol.jenis === 'angka' ? (lama == null && (kol.jikaAda || kol.opsional) ? '(kosong)' : formatAngka(lama || 0) + (satuan ? ' ' + satuan : ''))
          : (kol.jenis === 'rupiah' ? formatRupiah(lama) : (kor.lama === '' || kor.lama == null ? '(kosong)' : kor.lama))
      ]));
      isi.push(' ');
    }
    // Kolom tidak wajib yang kosong (juga setelah dikosongkan lewat koreksi) ditulis "–", bukan 0.
    if ((kol.jikaAda || kol.opsional) && v == null) isi.push(el('span', { class: 'otomatis', text: '–' }));
    else if (kol.jenis === 'tanggal') isi.push(el('span', { class: 'angka-satuan', text: v ? tanggalPendek(v) : '–' }));
    else if (kol.jenis === 'angka') isi.push(angkaSatuan(v || 0, satuan));
    else if (kol.jenis === 'rupiah') isi.push(el('span', { class: 'angka-satuan', text: formatRupiah(v) }));
    else if (kol.jenis === 'status') isi.push(v ? tandaStatus(v === 'Normal' ? 'baik' : 'masalah', v === 'Normal' ? 'Normal' : 'Di luar standar') : '–');
    else isi.push(el('span', { text: v || '–' }));
    if (b.asli && b.asli[kol.kunci]) isi.push(' ', el('span', { class: 'nilai-asli', text: '(' + b.asli[kol.kunci] + ')' }));
    return isi;
  }

  function kolomNama(kolom) {
    return kolom.filter(function (k) { return k.jenis === 'item'; })[0] ||
      kolom.filter(function (k) { return k.jenis === 'teks'; })[0] || null;
  }

  /** "Tomat: masuk 5 kg, keluar 1 kg" — angka nol tidak ditulis, kecuali pernah dikoreksi. */
  function ringkasBaris(b, kolom) {
    var nama = kolomNama(kolom);
    var isi = [];
    if (nama) isi.push(el('span', { class: 'ringkas-nama', text: b.nilai[nama.kunci] || '–' }));
    var bagian = [];
    kolom.forEach(function (k) {
      if (k === nama || k.ringkas === false) return;
      var v = b.nilai[k.kunci];
      var kor = b.koreksi && b.koreksi[k.kunci];
      if (k.jenis === 'angka' && !v && !kor && (!k.akhiran || k.jikaAda || k.opsional)) return;
      if (k.jenis !== 'angka' && (v === '' || v == null)) return;
      // Status hanya ditulis jika bermasalah: "di luar standar".
      if (k.jenis === 'status') {
        if (v !== 'Normal') bagian.push([el('span', { class: 'nilai-masalah', text: 'di luar standar' })]);
        return;
      }
      bagian.push([k.singkat + ' '].concat(nilaiKolom(b, k)));
    });
    if (bagian.length) {
      isi.push(': ');
      bagian.forEach(function (x, i) {
        if (i) isi.push(', ');
        isi = isi.concat(x);
      });
    }
    var tanda = [];
    if (b.foto) tanda.push(el('span', { class: 'ikon-tanda', title: 'Ada foto bukti' }, [ikon('kamera'), el('span', { class: 'sr', text: 'Ada foto bukti' })]));
    if (b.flag) tanda.push(el('span', { class: 'ikon-tanda tinjau', title: 'Dilaporkan keliru' }, [ikon('bendera'), el('span', { class: 'sr', text: 'Dilaporkan keliru' })]));
    return el('span', { class: 'ringkas-baris' }, isi.concat(tanda));
  }

  /** Baris ringkas di Beranda Pengelola: isian belum diperiksa dan baris dilaporkan keliru. */
  function barisPemeriksaan(p) {
    if (!p || (!p.belumDiperiksa && !p.dilaporkan)) return null;
    var daftar = el('div', { class: 'daftar', role: 'group', 'aria-label': 'Pemeriksaan' });
    function tautan(status, formId) {
      return '#/riwayat?form=' + encodeURIComponent(formId || '') + '&status=' + status +
        '&dari=' + encodeURIComponent(p.dari || '') + '&sampai=' + encodeURIComponent(p.sampai || '');
    }
    if (p.belumDiperiksa) {
      daftar.appendChild(el('a', { class: 'daftar-baris pemberitahuan', href: tautan('terkirim', p.formBelum) }, [
        el('span', { class: 'daftar-baris-isi' }, [
          tandaStatus('menunggu', p.belumDiperiksa + ' isian belum diperiksa'),
          el('span', { class: 'daftar-baris-ket', text: BATAS_RIWAYAT_HARI + ' hari terakhir. Ketuk untuk membuka Riwayat.' })
        ]),
        ikon('kanan')
      ]));
    }
    if (p.dilaporkan) {
      daftar.appendChild(el('a', { class: 'daftar-baris pemberitahuan', href: tautan('dilaporkan', p.formDilaporkan) }, [
        el('span', { class: 'daftar-baris-isi' }, [
          tandaStatus('tinjau', p.dilaporkan + ' baris dilaporkan keliru'),
          el('span', { class: 'daftar-baris-ket', text: 'Ketuk untuk memeriksa dan mengoreksi.' })
        ]),
        ikon('kanan')
      ]));
    }
    return daftar;
  }

  /* ---------- Layar Riwayat: daftar (dan detail di kolom kanan pada desktop) ---------- */

  function layarRiwayatDetail(k) {
    var detail = { formId: k.cocok[1], sid: k.cocok[2] };
    if (window.matchMedia(DESKTOP).matches) {
      layarRiwayat(k, detail);
      return;
    }
    layarDetailHp(k, detail);
  }

  function layarRiwayat(k, detail) {
    aturJudul('Riwayat');
    var pengelola = !!k.sesi.pengguna.pengelola;
    var mediaDesktop = window.matchMedia(DESKTOP);
    var pilih = bacaPilihanRiwayat();
    var hariIni = tanggalIso(new Date());

    // Dari Beranda: #/riwayat?form=STOCK&status=terkirim&dari=...&sampai=...
    if (!detail && k.cocok && k.cocok[1]) {
      var q = bacaKueriAlamat(k.cocok[1]);
      pilih = Object.assign(pilih, {
        formId: q.form || pilih.formId, tampilan: 'catatan', status: q.status || '',
        kategori: '', item: '', pengisi: ''
      });
      if (q.dari && q.sampai) {
        pilih.tanggal = 'Rentang';
        pilih.dari = q.dari;
        pilih.sampai = q.sampai;
      }
      simpanPilihanRiwayat(pilih);
      gantiAlamat('#/riwayat');
    }
    if (detail) {
      if (pilih.formId !== detail.formId) {
        pilih.formId = detail.formId;
        simpanPilihanRiwayat(pilih);
      }
    }

    var data = null;
    var dipilih = detail ? detail.sid : '';
    var nomorMuat = 0;

    var penanda = el('span', { class: 'memperbarui', role: 'status' });
    var wadahForm = el('div', { class: 'riwayat-form' });
    var wadahAlat = el('div', { class: 'riwayat-alat' });
    var ringkasFilter = el('p', { class: 'ringkas-filter' });
    var wadahDaftar = el('div', { class: 'riwayat-daftar' });
    var wadahDetail = el('div', { class: 'riwayat-detail', 'aria-live': 'polite' });
    var isi = el('div', { class: 'riwayat-isi' }, [wadahDaftar, wadahDetail]);

    // Tanggal: 7 hari terakhir (bawaan), satu tanggal, atau rentang (paling banyak 31 hari).
    var gTanggal = grupPilihan('Tanggal', PILIHAN_TANGGAL, pilih.tanggal);
    var inDari = el('input', { type: 'date', class: 'isian', max: hariIni, 'aria-label': 'Dari tanggal' });
    var inSampai = el('input', { type: 'date', class: 'isian', max: hariIni, 'aria-label': 'Sampai tanggal' });
    var labelDari = el('label', { class: 'kolom-label' }, ['Dari', inDari]);
    var labelSampai = el('label', { class: 'kolom-label' }, ['Sampai', inSampai]);
    var galatTanggal = el('p', { class: 'kolom-galat', role: 'alert' });
    var deretTanggal = el('div', { class: 'deret-tanggal' }, [labelDari, labelSampai]);
    gTanggal.wadah.appendChild(deretTanggal);
    gTanggal.wadah.appendChild(galatTanggal);
    inDari.value = pilih.dari || hariIni;
    inSampai.value = pilih.sampai || hariIni;

    function aturTanggalTampil() {
      var mode = gTanggal.nilai();
      deretTanggal.hidden = mode === PILIHAN_TANGGAL[0];
      labelSampai.hidden = mode !== 'Rentang';
      labelDari.firstChild.textContent = mode === 'Rentang' ? 'Dari' : 'Tanggal';
    }
    aturTanggalTampil();

    function terapkanTanggal() {
      var mode = gTanggal.nilai();
      aturTanggalTampil();
      kosongkan(galatTanggal);
      var dari = inDari.value;
      var sampai = mode === 'Rentang' ? inSampai.value : dari;
      var salah = '';
      if (mode !== PILIHAN_TANGGAL[0]) {
        if (!dari || !sampai) salah = 'Pilih tanggalnya.';
        else if (dari > hariIni || sampai > hariIni) salah = 'Tanggal masa depan belum punya isian.';
        else if (dari > sampai) salah = 'Tanggal awal harus sebelum tanggal akhir.';
        else if (geserHari(dari, BATAS_RIWAYAT_HARI - 1) < sampai) salah = 'Riwayat paling banyak ' + BATAS_RIWAYAT_HARI + ' hari sekali ambil. Persempit rentangnya.';
      }
      if (salah) {
        galatTanggal.appendChild(ikonStatus('masalah'));
        galatTanggal.appendChild(el('span', { text: salah }));
        return;
      }
      pilih.tanggal = mode;
      pilih.dari = dari;
      pilih.sampai = sampai;
      gantiPilihan();
    }
    gTanggal.input.forEach(function (i) { i.addEventListener('change', terapkanTanggal); });
    inDari.addEventListener('change', terapkanTanggal);
    inSampai.addEventListener('change', terapkanTanggal);

    var tombolFilter = tombol('Filter', 'kedua', { 'aria-haspopup': 'dialog' });
    tombolFilter.insertBefore(ikon('filter'), tombolFilter.lastChild);
    tombolFilter.addEventListener('click', bukaFilter);

    k.wadah.appendChild(el('div', { class: 'layar-isi riwayat' }, [
      el('h1', { class: 'judul-layar', text: 'Riwayat' }),
      el('section', { class: 'kartu kotak-info riwayat-atas', 'aria-label': 'Pilih form dan tanggal' }, [
        wadahForm,
        gTanggal.wadah,
        el('div', { class: 'lebar-penuh' }, [wadahAlat, ringkasFilter])
      ]),
      penanda,
      isi
    ]));

    function gantiPilihan() {
      simpanPilihanRiwayat(pilih);
      dipilih = '';
      if (location.hash !== '#/riwayat') gantiAlamat('#/riwayat');
      muat();
    }

    function formTerpilih() {
      var daftar = data ? data.daftarForm || [] : [];
      return daftar.filter(function (f) { return f.id === (data && data.formId); })[0] || null;
    }

    /** Pilihan form: tombol berjajar, bisa digeser ke samping jika lebih dari empat. */
    function gambarPilihanForm() {
      kosongkan(wadahForm);
      var daftar = data ? data.daftarForm || [] : [];
      if (!daftar.length) return;
      var g = grupPilihan('Form', daftar.map(function (f) { return f.nama; }), (formTerpilih() || {}).nama);
      g.wadah.querySelector('fieldset').classList.add('pilihan-gulir');
      g.input.forEach(function (i, n) {
        i.addEventListener('change', function () {
          pilih.formId = daftar[n].id;
          pilih.kategori = '';
          pilih.item = '';
          if (!daftar[n].stock) pilih.tampilan = 'catatan';
          gantiPilihan();
        });
      });
      wadahForm.appendChild(g.wadah);
    }

    function gambarAlat() {
      kosongkan(wadahAlat);
      kosongkan(ringkasFilter);
      var f = formTerpilih();
      if (!f || !f.adaRiwayat) return;
      var n = jumlahFilter(pilih);
      gantiTeksTombol(tombolFilter, n ? 'Filter (' + n + ')' : 'Filter');
      var deret = el('div', { class: 'deret-tombol' }, [tombolFilter]);
      if (f.stock) {
        // Riwayat Stock punya dua tampilan (tampilan Bagian 5.4).
        var g = grupPilihan('Tampilan', ['Catatan', 'Rekap harian'], pilih.tampilan === 'rekap' ? 'Rekap harian' : 'Catatan');
        g.wadah.classList.add('pilih-tampilan');
        g.input.forEach(function (i) {
          i.addEventListener('change', function () {
            pilih.tampilan = g.nilai() === 'Rekap harian' ? 'rekap' : 'catatan';
            gantiPilihan();
          });
        });
        deret.insertBefore(g.wadah, deret.firstChild);
      }
      wadahAlat.appendChild(deret);
      var bagian = [];
      if (pilih.kategori) bagian.push('Kategori: ' + pilih.kategori);
      if (pilih.item) bagian.push('Item: ' + pilih.item);
      if (pilih.tampilan !== 'rekap' && pilih.pengisi) bagian.push('Pengisi: ' + pilih.pengisi);
      if (pilih.tampilan !== 'rekap' && pilih.status) {
        bagian.push('Status: ' + STATUS_RIWAYAT.filter(function (s) { return s.nilai === pilih.status; })[0].label);
      }
      if (bagian.length) {
        ringkasFilter.appendChild(el('span', { text: bagian.join(' · ') }));
        ringkasFilter.appendChild(tombol('Hapus filter', 'tautan', {
          onclick: function () {
            pilih.kategori = '';
            pilih.item = '';
            pilih.pengisi = '';
            pilih.status = '';
            gantiPilihan();
          }
        }));
      }
    }

    /** Lembar Filter: kategori, item, pengisi, status. */
    function bukaFilter() {
      var p = (data && data.pilihan) || { kategori: [], item: [], pengisi: [] };
      var rekap = pilih.tampilan === 'rekap';
      function pilihan(label, nilai, daftar, semua) {
        var id = 'filter-' + (++nomorKolom);
        var s = el('select', { class: 'isian', id: id }, [el('option', { value: '', text: semua })]);
        daftar.forEach(function (d) { s.appendChild(el('option', { value: d, text: d })); });
        s.value = daftar.indexOf(nilai) >= 0 ? nilai : '';
        return { pilih: s, wadah: el('div', { class: 'kolom' }, [el('label', { class: 'kolom-label', for: id, text: label }), s]) };
      }
      var fKat = p.kategori.length ? pilihan('Kategori', pilih.kategori, p.kategori, 'Semua kategori') : null;
      var labelItem = p.labelItem || 'Item';
      var fItem = p.item.length ? pilihan(labelItem, pilih.item, [], 'Semua ' + labelItem.toLowerCase()) : null;
      function isiItem() {
        if (!fItem) return;
        var kat = fKat ? fKat.pilih.value : '';
        var lama = fItem.pilih.value || pilih.item;
        kosongkan(fItem.pilih).appendChild(el('option', { value: '', text: 'Semua ' + labelItem.toLowerCase() }));
        var ada = false;
        p.item.forEach(function (it) {
          if (kat && it.kategori !== kat) return;
          fItem.pilih.appendChild(el('option', { value: it.nama, text: it.nama }));
          if (it.nama === lama) ada = true;
        });
        fItem.pilih.value = ada ? lama : '';
      }
      isiItem();
      if (fKat) fKat.pilih.addEventListener('change', isiItem);
      var fPengisi = !rekap ? pilihan('Pengisi', pilih.pengisi, p.pengisi, 'Semua pengisi') : null;
      var gStatus = !rekap ? grupPilihan('Status', STATUS_RIWAYAT.map(function (s) { return s.label; }),
        STATUS_RIWAYAT.filter(function (s) { return s.nilai === pilih.status; })[0].label) : null;
      bukaLembar({
        judul: 'Filter riwayat',
        isi: el('div', { class: 'formulir' }, [
          fKat ? fKat.wadah : null,
          fItem ? fItem.wadah : null,
          fPengisi ? fPengisi.wadah : null,
          gStatus ? gStatus.wadah : null,
          rekap ? el('p', { class: 'kolom-bantuan', text: 'Filter pengisi dan status berlaku di tampilan Catatan.' }) : null
        ]),
        aksi: [
          {
            teks: 'Hapus filter', jenis: 'kedua', klik: function (t, l) {
              pilih.kategori = '';
              pilih.item = '';
              pilih.pengisi = '';
              pilih.status = '';
              l.tutup();
              gantiPilihan();
            }
          },
          {
            teks: 'Terapkan', jenis: 'utama', klik: function (t, l) {
              pilih.kategori = fKat ? fKat.pilih.value : '';
              pilih.item = fItem ? fItem.pilih.value : '';
              if (!rekap) {
                pilih.pengisi = fPengisi.pilih.value;
                var label = gStatus.nilai();
                pilih.status = STATUS_RIWAYAT.filter(function (s) { return s.label === label; })[0].nilai;
              }
              l.tutup();
              gantiPilihan();
            }
          }
        ]
      });
    }

    /* ----- Isian di antrean HP: paling atas, tanda "menunggu kirim" ----- */
    function blokAntrean() {
      // Tetap tampil walau Riwayat belum termuat (misalnya tanpa sinyal).
      var formId = data ? data.formId : pilih.formId;
      var p = penggunaKini();
      var daftar = formId ? antreanForm(formId) : (p ? Antrean.daftar(p.nama) : []);
      if (!daftar.length) return null;
      var wadah = el('div', { class: 'daftar' });
      daftar.forEach(function (e) {
        var baris = (e.isi && e.isi.baris) || [];
        var gagal = e.status === 'gagal';
        wadah.appendChild(el('button', { type: 'button', class: 'daftar-baris kiriman-baris', onclick: bukaLembarAntrean }, [
          el('span', { class: 'daftar-baris-isi' }, [
            el('span', { class: 'kiriman-kepala' }, [
              el('span', { class: 'daftar-baris-judul', text: e.judul + ', ' + tanggalPendek(e.tanggal) }),
              gagal ? tandaStatus('masalah', 'Gagal kirim') : tandaStatus('menunggu', 'Menunggu kirim')
            ]),
            baris.length ? el('span', { class: 'kiriman-ringkas' }, baris.map(function (b) {
              var bagian = [];
              if (b.masuk) bagian.push('masuk ' + formatAngka(b.masuk) + (b.satuanMasuk === 'besar' ? ' (satuan besar)' : ''));
              if (b.keluar) bagian.push('keluar ' + formatAngka(b.keluar));
              return el('span', { class: 'ringkas-baris' }, [el('span', { class: 'ringkas-nama', text: b.item }), bagian.length ? ': ' + bagian.join(', ') : '']);
            })) : null,
            gagal && e.pesan ? el('span', { class: 'daftar-baris-ket', text: e.pesan }) : null
          ]),
          ikon('kanan')
        ]));
      });
      return el('section', { class: 'kelompok kelompok-antrean', 'aria-label': 'Isian di HP' }, [
        el('h2', { class: 'kelompok-judul' }, [ikon('hp'), el('span', { text: 'Di HP, belum terkirim' })]),
        wadah
      ]);
    }

    /* ----- Tampilan Catatan: kiriman dan peristiwa, dikelompokkan per tanggal ----- */
    function barisKiriman(kr) {
      var aktif = kr.id === dipilih;
      var kepala = teksKepalaKiriman(data.kepala, kr);
      return el('button', {
        type: 'button',
        class: 'daftar-baris kiriman-baris' + (aktif ? ' terpilih' : ''),
        'aria-current': aktif ? 'true' : null,
        'data-sid': kr.id,
        onclick: function () { pilihKiriman(kr.id); }
      }, [
        el('span', { class: 'daftar-baris-isi' }, [
          el('span', { class: 'kiriman-kepala' }, [
            el('span', { class: 'daftar-baris-judul', text: kr.oleh + ', ' + jam(kr.waktu) + (kepala ? ' · ' + kepala : '') }),
            el('span', { class: 'daftar-baris-ket', text: kr.jumlahBaris + ' baris' })
          ]),
          el('span', { class: 'tanda-deret bungkus' }, tandaKiriman(kr)),
          el('span', { class: 'kiriman-ringkas' }, kr.baris.map(function (b) { return ringkasBaris(b, data.kolom || []); }))
        ]),
        ikon('kanan')
      ]);
    }

    function barisPeristiwa(p) {
      var judul;
      var ket = p.oleh + ', ' + jam(p.waktu);
      var namaIkon = 'nihil';
      var klik = null;
      if (p.jenis === 'terlewat') {
        // Suhu: pengecekan wajib yang tidak diisi pada tanggal itu (spesifikasi sistem Bagian 6.1).
        namaIkon = 'termometer';
        judul = [tandaStatus('tinjau', 'Terlewat'), ' ', el('span', { text: p.kurang.length + ' dari ' + p.total + ' pengecekan tidak diisi' })];
        ket = p.kurang.join(', ') + '.';
      } else if (p.jenis === 'nihil') {
        judul = [tandaStatus('menunggu', 'Nihil'), ' ', el('span', { text: 'Ditandai tidak ada isian' })];
      } else if (p.jenis === 'penyesuaian') {
        namaIkon = 'sesuaikan';
        judul = [el('span', { class: 'daftar-baris-judul', text: 'Penyesuaian ' + p.item })];
        var selisih = (p.selisih > 0 ? '+' : '') + formatAngka(p.selisih) + ' ' + p.satuan;
        ket = 'Tercatat ' + formatAngka(p.tercatat) + ' ' + p.satuan + ', sebenarnya ' + formatAngka(p.sebenarnya) + ' ' +
          p.satuan + '. Selisih ' + selisih + '. ' + p.alasan + (p.catatan ? ': ' + p.catatan : '') + '. ' + ket;
        klik = function () { bukaRiwayatItem(p.item); };
      } else {
        namaIkon = 'opname';
        judul = [el('span', { class: 'daftar-baris-judul', text: 'Stock opname' })];
        ket = p.jumlahItem + ' item dihitung, ' + p.berselisih + ' berselisih' +
          (p.berselisih ? ', nilai selisih ' + formatRupiah(p.nilai || 0) : '') + '. ' + ket;
        // Rincian dan laporan selisih (khusus Pengelola, Tahap 8).
        if (pengelola && p.id) klik = function () { bukaDetailOpname(p.id); };
      }
      var isiBaris = [
        el('span', { class: 'ikon-peristiwa' }, ikon(namaIkon)),
        el('span', { class: 'daftar-baris-isi' }, [el('span', {}, judul), el('span', { class: 'daftar-baris-ket', text: ket })])
      ];
      if (klik) {
        isiBaris.push(ikon('kanan'));
        return el('button', { type: 'button', class: 'daftar-baris peristiwa', onclick: klik,
          'aria-label': p.jenis === 'opname' ? 'Rincian stock opname ' + jam(p.waktu) : 'Riwayat ' + p.item }, isiBaris);
      }
      return el('div', { class: 'daftar-baris peristiwa tetap' }, isiBaris);
    }

    function teksKosong() {
      var q = kueriRiwayat(pilih);
      var teks = q.dari === q.sampai ? 'Belum ada isian pada tanggal ini.' : 'Belum ada isian pada rentang tanggal ini.';
      return jumlahFilter(pilih) ? teks + ' Coba hapus filter.' : teks;
    }

    function gambarCatatan() {
      kosongkan(wadahDaftar);
      var antre = blokAntrean();
      if (antre) wadahDaftar.appendChild(antre);
      var perTanggal = {};
      (data.kiriman || []).forEach(function (kr) {
        (perTanggal[kr.tanggal] = perTanggal[kr.tanggal] || []).push({ waktu: kr.waktu, kiriman: kr });
      });
      (data.peristiwa || []).forEach(function (p) {
        (perTanggal[p.tanggal] = perTanggal[p.tanggal] || []).push({ waktu: p.waktu, peristiwa: p });
      });
      var tanggal = Object.keys(perTanggal).sort().reverse();
      if (!tanggal.length) {
        wadahDaftar.appendChild(kotakKosong(teksKosong(), 'riwayat'));
        return;
      }
      tanggal.forEach(function (tg) {
        var daftar = el('div', { class: 'daftar' });
        perTanggal[tg].sort(function (a, b) { return String(b.waktu || '').localeCompare(String(a.waktu || '')); })
          .forEach(function (x) { daftar.appendChild(x.kiriman ? barisKiriman(x.kiriman) : barisPeristiwa(x.peristiwa)); });
        wadahDaftar.appendChild(el('section', { class: 'kelompok' }, [
          el('h2', { class: 'kelompok-judul', text: tanggalJudul(tg) }),
          daftar
        ]));
      });
    }

    /* ----- Tampilan Rekap harian (Stock_Harian), per tanggal lalu per kategori ----- */
    function tandaRekap(r) {
      if (r.akhir < 0) return tandaStatus('masalah', 'Stock akhir minus');
      if (r.stokMin != null && r.akhir < r.stokMin) return tandaStatus('tinjau', 'Di bawah stok minimum');
      return null;
    }

    function sel(n) {
      return el('td', { class: 'angka' }, n ? angkaSatuan(n) : el('span', { class: 'otomatis', text: '–' }));
    }

    function gambarRekap() {
      kosongkan(wadahDaftar);
      var rekap = data.rekap || [];
      if (!rekap.length) {
        wadahDaftar.appendChild(kotakKosong(jumlahFilter(pilih)
          ? 'Belum ada rekap stock pada tanggal ini. Coba hapus filter.' : 'Belum ada rekap stock pada tanggal ini.', 'riwayat'));
        return;
      }
      var tabel = mediaDesktop.matches;
      var perTanggal = [];
      rekap.forEach(function (r) {
        var akhir = perTanggal[perTanggal.length - 1];
        if (!akhir || akhir.tanggal !== r.tanggal) perTanggal.push(akhir = { tanggal: r.tanggal, baris: [] });
        akhir.baris.push(r);
      });
      perTanggal.forEach(function (grup) {
        var bagian = el('section', { class: 'kelompok' }, el('h2', { class: 'kelompok-judul', text: tanggalJudul(grup.tanggal) }));
        if (tabel) {
          var badan = el('tbody');
          var kat = null;
          grup.baris.forEach(function (r) {
            if (r.kategori !== kat) {
              kat = r.kategori;
              badan.appendChild(el('tr', { class: 'baris-kategori' }, [el('th', { scope: 'rowgroup', text: kat || 'Tanpa kategori' }), el('td', { colspan: '10' })]));
            }
            var t = tandaRekap(r);
            badan.appendChild(el('tr', { class: r.akhir < 0 ? 'minus' : null }, [
              el('td', {}, tombolNamaItem(r.item)),
              sel(r.awal),
              el('td', { class: 'angka' }, [r.masuk ? angkaSatuan(r.masuk) : el('span', { class: 'otomatis', text: '–' }),
                r.masukAsli ? el('span', { class: 'nilai-asli blok', text: '(' + r.masukAsli + ')' }) : null]),
              sel(r.hasilPrep), sel(r.keluar), sel(r.dipakaiPrep), sel(r.waste),
              el('td', { class: 'angka' }, r.penyesuaian ? angkaSatuan(r.penyesuaian) : el('span', { class: 'otomatis', text: '–' })),
              el('td', { class: 'angka stock-akhir-sel' + (r.akhir < 0 ? ' minus' : '') }, angkaSatuan(r.akhir)),
              el('td', { text: r.satuan }),
              el('td', {}, t)
            ]));
          });
          bagian.appendChild(el('div', { class: 'tabel-bingkai' }, el('table', { class: 'tabel tabel-rekap' }, [
            el('thead', {}, el('tr', {}, ['Nama Item', 'Awal', 'Masuk', 'Hasil Prep', 'Keluar', 'Dipakai Prep', 'Waste', 'Penyesuaian', 'Akhir', 'Satuan', 'Tanda']
              .map(function (j, i) { return el('th', { scope: 'col', class: i >= 1 && i <= 8 ? 'angka' : null, text: j }); }))),
            badan
          ])));
        } else {
          var kat2 = null;
          var daftar = null;
          grup.baris.forEach(function (r) {
            if (r.kategori !== kat2) {
              kat2 = r.kategori;
              bagian.appendChild(el('h3', { class: 'kelompok-subjudul', text: kat2 || 'Tanpa kategori' }));
              daftar = el('div', { class: 'daftar' });
              bagian.appendChild(daftar);
            }
            var t = tandaRekap(r);
            var gerak = [];
            [['masuk', 'masuk'], ['hasilPrep', 'hasil prep'], ['keluar', 'keluar'], ['dipakaiPrep', 'dipakai prep'], ['waste', 'waste']].forEach(function (x) {
              if (!r[x[0]]) return;
              gerak.push(x[1] + ' ' + formatAngka(r[x[0]]) + (x[0] === 'masuk' && r.masukAsli ? ' (' + r.masukAsli + ')' : ''));
            });
            if (r.penyesuaian) gerak.push('penyesuaian ' + (r.penyesuaian > 0 ? '+' : '') + formatAngka(r.penyesuaian));
            daftar.appendChild(el('button', {
              type: 'button', class: 'daftar-baris rekap-baris' + (r.akhir < 0 ? ' minus' : ''), 'aria-haspopup': 'dialog',
              onclick: function () { bukaRiwayatItem(r.item); }
            }, [
              el('span', { class: 'daftar-baris-isi' }, [
                el('span', { class: 'kiriman-kepala' }, [
                  el('span', { class: 'daftar-baris-judul', text: r.item }),
                  el('span', { class: 'rekap-akhir' + (r.akhir < 0 ? ' minus' : '') }, ['Akhir ', angkaSatuan(r.akhir, r.satuan)])
                ]),
                el('span', { class: 'daftar-baris-ket' }, ['Awal ', angkaSatuan(r.awal, r.satuan), gerak.length ? ' · ' + gerak.join(', ') : '']),
                t
              ]),
              ikon('kanan')
            ]));
          });
        }
        wadahDaftar.appendChild(bagian);
      });
    }

    /* ----- Detail (desktop: kolom kanan) ----- */
    function infoDetail(kr) {
      var f = formTerpilih() || {};
      return { formId: data.formId, namaForm: f.nama || data.formId, adaPdf: !!f.adaPdf, kepala: data.kepala || [], kolom: data.kolom || [],
        gerakStock: !!data.gerakStock, kiriman: kr };
    }

    function gambarDetailKanan() {
      kosongkan(wadahDetail);
      if (!mediaDesktop.matches || !data || data.tampilan === 'rekap') return;
      var kr = (data.kiriman || []).filter(function (x) { return x.id === dipilih; })[0];
      if (!kr) {
        if (dipilih && detail && detail.sid === dipilih) {
          // Kiriman dari alamat yang tidak ada di daftar (filter lain): ambil langsung.
          ambilDetail(dipilih);
          return;
        }
        wadahDetail.appendChild(kotakKosong('Pilih isian di kiri untuk melihat detailnya.', 'riwayat'));
        return;
      }
      gambarDetailKiriman(wadahDetail, infoDetail(kr), {
        pengelola: pengelola,
        perbarui: perbaruiKiriman
      });
    }

    function ambilDetail(sid) {
      kosongkan(wadahDetail).appendChild(kerangkaBaris(3));
      panggilApi('detailKiriman', { formId: data.formId, submissionId: sid }).then(function (d) {
        if (dipilih !== sid) return;
        kosongkan(wadahDetail);
        gambarDetailKiriman(wadahDetail, d, { pengelola: pengelola, perbarui: perbaruiKiriman });
      }).catch(function (err) {
        if (tanganiSesiBerakhir(err)) return;
        kosongkan(wadahDetail).appendChild(kotakGalat(pesanGalat(err), function () { ambilDetail(sid); }));
      });
    }

    function perbaruiKiriman(kr) {
      gantiKirimanTersimpan(data.formId, kr);
      var c = Cache.baca('riwayat');
      if (c && c.data && c.data.data && c.data.data.formId === data.formId) data = c.data.data;
      gambarIsi();
    }

    function pilihKiriman(sid) {
      if (!mediaDesktop.matches) {
        location.hash = '#/riwayat/' + data.formId + '/' + encodeURIComponent(sid);
        return;
      }
      dipilih = sid;
      gantiAlamat('#/riwayat/' + data.formId + '/' + encodeURIComponent(sid));
      Array.prototype.forEach.call(wadahDaftar.querySelectorAll('.kiriman-baris[data-sid]'), function (b) {
        var ini = b.getAttribute('data-sid') === sid;
        b.classList.toggle('terpilih', ini);
        if (ini) b.setAttribute('aria-current', 'true');
        else b.removeAttribute('aria-current');
      });
      gambarDetailKanan();
    }

    function gambarIsi() {
      if (!data) return;
      var f = formTerpilih();
      gambarPilihanForm();
      gambarAlat();
      isi.classList.toggle('dua-kolom', !!(f && f.adaRiwayat && data.tampilan !== 'rekap'));
      if (!f) {
        kosongkan(wadahDaftar).appendChild(kotakKosong('Belum ada form yang tampil. Pengelola mengatur form di Pengaturan.', 'riwayat'));
        kosongkan(wadahDetail);
        return;
      }
      if (!f.adaRiwayat) {
        kosongkan(wadahDaftar).appendChild(kotakKosong('Riwayat ' + f.nama + ' dibangun di tahap berikutnya, bersama formnya.', 'riwayat'));
        kosongkan(wadahDetail);
        isi.classList.remove('dua-kolom');
        return;
      }
      if (data.tampilan === 'rekap') gambarRekap();
      else gambarCatatan();
      gambarDetailKanan();
    }

    function muat() {
      var kueri = kueriRiwayat(pilih);
      var nomor = ++nomorMuat;
      return muatData({
        dariHp: function () { return riwayatDariHp(kueri); },
        simpanHp: function (d) {
          if (nomor === nomorMuat) Cache.tulis('riwayat', { kueri: kueri, data: d });
        },
        ambil: function () { return panggilApi('riwayat', kueri); },
        gambar: function (d) {
          if (nomor !== nomorMuat) return;
          data = d;
          if (d.formId && d.formId !== pilih.formId) {
            pilih.formId = d.formId;
            simpanPilihanRiwayat(pilih);
          }
          gambarIsi();
        },
        kerangka: function () {
          kosongkan(wadahDaftar);
          var antre = blokAntrean();
          if (antre) wadahDaftar.appendChild(antre);
          wadahDaftar.appendChild(kerangkaBaris(4));
          kosongkan(wadahDetail);
        },
        galat: function (pesan, cobaLagi) {
          if (nomor !== nomorMuat) return;
          kosongkan(wadahDaftar);
          var antre = blokAntrean();
          if (antre) wadahDaftar.appendChild(antre);
          wadahDaftar.appendChild(kotakGalat(pesan, cobaLagi));
        },
        penanda: penanda
      });
    }

    function gantiSusunan() {
      jalankanRute();
    }
    if (mediaDesktop.addEventListener) mediaDesktop.addEventListener('change', gantiSusunan);
    else if (mediaDesktop.addListener) mediaDesktop.addListener(gantiSusunan);
    pembersihLayar.push(function () {
      if (mediaDesktop.removeEventListener) mediaDesktop.removeEventListener('change', gantiSusunan);
      else if (mediaDesktop.removeListener) mediaDesktop.removeListener(gantiSusunan);
    });

    muat();
    segarkanLayar = muat;
    segarkanAntrean = function () {
      if (data && data.tampilan !== 'rekap' && data.kiriman) gambarCatatan();
      else if (!data) {
        var lama = wadahDaftar.querySelector('.kelompok-antrean');
        if (lama) lama.remove();
        var antre = blokAntrean();
        if (antre) wadahDaftar.insertBefore(antre, wadahDaftar.firstChild);
      }
    };
  }

  /* ---------- Detail satu kiriman di HP dan tablet (layar sendiri) ---------- */

  function layarDetailHp(k, detail) {
    aturJudul('Detail isian');
    var penanda = el('span', { class: 'memperbarui', role: 'status' });
    var wadah = el('div', { class: 'riwayat-detail' });
    k.wadah.appendChild(el('div', { class: 'layar-isi layar-sempit' }, [
      tautanKembali('Riwayat', '#/riwayat'),
      penanda,
      wadah
    ]));
    var pengelola = !!k.sesi.pengguna.pengelola;
    var info = null;
    function gambar(d) {
      info = d;
      kosongkan(wadah);
      gambarDetailKiriman(wadah, d, {
        pengelola: pengelola,
        perbarui: function (kr) {
          gantiKirimanTersimpan(detail.formId, kr);
          gambar(Object.assign({}, info, { kiriman: kr }));
        }
      });
    }
    function muat() {
      return muatData({
        dariHp: function () { return kirimanTersimpan(detail.formId, detail.sid); },
        ambil: function () { return panggilApi('detailKiriman', { formId: detail.formId, submissionId: detail.sid }); },
        gambar: gambar,
        kerangka: function () { kosongkan(wadah).appendChild(kerangkaBaris(4)); },
        galat: function (pesan, cobaLagi) { kosongkan(wadah).appendChild(kotakGalat(pesan, cobaLagi)); },
        penanda: penanda
      });
    }
    var mediaDesktop = window.matchMedia(DESKTOP);
    function gantiSusunan() {
      if (mediaDesktop.matches) jalankanRute();
    }
    if (mediaDesktop.addEventListener) mediaDesktop.addEventListener('change', gantiSusunan);
    else if (mediaDesktop.addListener) mediaDesktop.addListener(gantiSusunan);
    pembersihLayar.push(function () {
      if (mediaDesktop.removeEventListener) mediaDesktop.removeEventListener('change', gantiSusunan);
      else if (mediaDesktop.removeListener) mediaDesktop.removeListener(gantiSusunan);
    });
    muat();
    segarkanLayar = muat;
  }

  /**
   * Detail satu kiriman (tampilan Bagian 5.4): tata letak seperti layar isi,
   * semua nilai berupa teks. Kartu di HP dan tablet, tabel di desktop.
   * Tombol: Laporkan kekeliruan (semua), Koreksi, Tutup laporan, Tandai
   * diperiksa, dan Buka kunci (Pengelola). info: { formId, namaForm, kepala,
   * kolom, kiriman }; opsi: { pengelola, perbarui(kiriman) }.
   */
  var capKiriman = '';

  function gambarDetailKiriman(wadah, info, opsi) {
    var kr = info.kiriman;
    var kolom = info.kolom || [];
    var nama = kolomNama(kolom);
    var terkunci = kr.status === 'Diperiksa';
    var desktop = window.matchMedia(DESKTOP).matches;
    var kepala = teksKepalaKiriman(info.kepala, kr);
    kosongkan(wadah);

    var waktuKirim = 'Dikirim ' + jam(kr.waktu);
    if (kr.waktuPerangkat && Math.abs(Date.parse(kr.waktu) - Date.parse(kr.waktuPerangkat)) > 10 * 60000) {
      waktuKirim += ' (diisi di HP ' + waktuPendek(kr.waktuPerangkat) + ')';
    }
    var tandaUtama = tandaKiriman(kr);
    if (terkunci && kr.diperiksa) {
      tandaUtama[0] = tandaStatus('baik', 'Diperiksa ' + kr.diperiksa.oleh + ', ' + waktuPendek(kr.diperiksa.waktu));
    }
    // Cap terkirim (tampilan Bagian 8.1): sekali, saat status baru saja menjadi Diperiksa.
    if (capKiriman === kr.id && terkunci) {
      tandaUtama[0].classList.add('cap');
      capKiriman = '';
    }

    var aksiKiriman = el('div', { class: 'deret-tombol' });
    if (opsi.pengelola && !terkunci) {
      aksiKiriman.appendChild(tombol('Tandai diperiksa', 'utama', { onclick: function (e) { tandaiDiperiksa(e.currentTarget); } }));
    }
    if (opsi.pengelola && terkunci) {
      var buka = tombol('Buka kunci', 'kedua', { onclick: bukaKunci });
      buka.insertBefore(ikon('bukaKunci'), buka.lastChild);
      aksiKiriman.appendChild(buka);
    }
    // Unduh PDF tanggal tersebut (spesifikasi sistem Bagian 6.1), semua role.
    var unduh = info.adaPdf ? unduhPdf({
      jenis: 'kedua',
      label: 'Unduh PDF ' + info.namaForm + ' ' + tanggalPendek(kr.tanggal),
      minta: function () { return { formId: info.formId, tanggal: kr.tanggal }; }
    }) : null;
    if (unduh) aksiKiriman.appendChild(unduh.tombol);

    wadah.appendChild(el('section', { class: 'kartu detail-kepala', 'aria-label': 'Kotak info' }, [
      el('h2', { class: 'kartu-judul', text: info.namaForm + (kepala ? ' · ' + kepala : '') }),
      el('p', { class: 'detail-tanggal', text: tanggalJudul(kr.tanggal) }),
      el('p', { class: 'otomatis', text: 'Diisi ' + kr.oleh + '. ' + waktuKirim + '. ' + kr.jumlahBaris + ' baris.' }),
      el('div', { class: 'tanda-deret bungkus' }, tandaUtama),
      terkunci && opsi.pengelola ? el('p', { class: 'kolom-bantuan' }, [ikon('kunci'), ' Terkunci karena sudah diperiksa. Buka kunci untuk mengoreksi.']) : null,
      aksiKiriman.childNodes.length ? aksiKiriman : null,
      unduh ? unduh.pesan : null
    ]));

    function aksiBaris(b) {
      var t = [];
      t.push(tombol('Laporkan kekeliruan', 'tautan', {
        'aria-label': 'Laporkan kekeliruan ' + (nama ? b.nilai[nama.kunci] : ''),
        'aria-haspopup': 'dialog',
        onclick: function () { bukaLaporkan(info, b, opsi.perbarui); }
      }));
      t[0].insertBefore(ikon('bendera'), t[0].lastChild);
      if (opsi.pengelola && !terkunci && kolom.some(function (k) { return k.koreksi; })) {
        var kor = tombol('Koreksi', 'tautan', {
          'aria-label': 'Koreksi ' + (nama ? b.nilai[nama.kunci] : ''),
          'aria-haspopup': 'dialog',
          onclick: function () { bukaKoreksi(info, b, opsi.perbarui); }
        });
        kor.insertBefore(ikon('pensil'), kor.lastChild);
        t.push(kor);
      }
      if (opsi.pengelola && b.flag) {
        t.push(tombol('Tutup laporan', 'tautan', {
          'aria-label': 'Tutup laporan ' + (nama ? b.nilai[nama.kunci] : ''),
          onclick: function () { tutupLaporan(b); }
        }));
      }
      return el('div', { class: 'aksi-baris' }, t);
    }

    function keteranganBaris(b) {
      var isi = [];
      // Bahan prep (salinan resep saat prep dibuat); bahan yang Stock Akhir-nya minus ditandai.
      if (b.rincian && b.rincian.length) {
        var minus = b.rincian.filter(function (x) { return x.minus; });
        isi.push(el('p', { class: 'kolom-bantuan rincian-bahan' }, ['Bahan: '].concat(b.rincian.map(function (x, i) {
          var teks = (i ? ', ' : '') + x.item + ' ' + formatAngka(x.qty) + (x.satuan ? ' ' + x.satuan : '');
          return x.minus ? el('span', { class: 'nilai-masalah', text: teks }) : teks;
        }))));
        if (minus.length) {
          isi.push(el('p', {}, tandaStatus('masalah', 'Stock ' + minus.map(function (x) { return x.item; }).join(', ') + ' minus')));
        }
      }
      // Foto bukti waste (Tahap 11): semua role melihat tandanya; tautan ke Drive hanya
      // dikirim server untuk Pengelola, karena Staff tidak punya akses ke folder Drive.
      if (b.foto) {
        isi.push(el('p', { class: 'kolom-bantuan foto-riwayat' }, [ikon('kamera'),
          el('span', { text: ' Ada foto bukti' + (b.fotoUrl ? '. ' : ' (dilihat Head Kitchen atau Manager).') }),
          b.fotoUrl ? el('a', { href: b.fotoUrl, target: '_blank', rel: 'noopener noreferrer', class: 'tautan-foto',
            'aria-label': 'Lihat foto bukti ' + (nama ? b.nilai[nama.kunci] : '') + ' di Google Drive' }, 'Lihat foto') : null]));
      }
      if (b.flag) {
        isi.push(el('p', { class: 'pesan-formulir tinjau catatan-flag' }, [ikon('bendera'),
          el('span', { text: 'Dilaporkan keliru oleh ' + b.flag.oleh + (b.flag.catatan ? ': ' + b.flag.catatan : '') })]));
      }
      if (b.dikoreksi) {
        isi.push(el('p', { class: 'kolom-bantuan', text: 'Dikoreksi ' + b.dikoreksi.oleh + ', ' + waktuPendek(b.dikoreksi.waktu) }));
      }
      return isi;
    }

    var namaItem = function (b) {
      var v = nama ? b.nilai[nama.kunci] : '';
      // Kolom nama form kustom boleh dikoreksi: nilai lamanya ditulis dicoret.
      var kor = nama && b.koreksi && b.koreksi[nama.kunci];
      if (nama && nama.jenis === 'item' && v) {
        return kor ? el('span', {}, [el('del', { class: 'nilai-lama' }, [el('span', { class: 'sr', text: 'Nilai lama ' }), kor.lama || '(kosong)']), ' ',
          tombolNamaItem(v)]) : tombolNamaItem(v);
      }
      if (kor) return el('span', { class: 'daftar-baris-judul' }, nilaiKolom(b, nama));
      return el('span', { class: 'daftar-baris-judul', text: v || '–' });
    };

    if (desktop) {
      var kolLain = kolom.filter(function (k) { return k !== nama; });
      var adaSatuan = kolom.some(function (k) { return k.satuan; });
      var badan = el('tbody');
      kr.baris.forEach(function (b, i) {
        badan.appendChild(el('tr', { class: b.flag ? 'dilaporkan' : null }, [
          el('td', { class: 'angka', text: String(i + 1) }),
          el('td', { class: 'nama-item' }, [namaItem(b)].concat(keteranganBaris(b), [aksiBaris(b)])),
          kolLain.map(function (k) { return el('td', { class: k.jenis === 'angka' || k.jenis === 'rupiah' ? 'angka' : null }, nilaiKolom(b, k)); }),
          adaSatuan ? el('td', { text: b.satuan || '' }) : null
        ]));
      });
      wadah.appendChild(el('div', { class: 'tabel-bingkai tabel-isian-bingkai' }, el('table', { class: 'tabel tabel-isian tabel-detail' }, [
        el('thead', {}, el('tr', {}, [el('th', { scope: 'col', class: 'angka', text: 'No' }),
          el('th', { scope: 'col', text: nama ? nama.label : '' })]
          .concat(kolLain.map(function (k) { return el('th', { scope: 'col', class: k.jenis === 'angka' || k.jenis === 'rupiah' ? 'angka' : null, text: k.label }); }))
          .concat(adaSatuan ? [el('th', { scope: 'col', text: 'Satuan' })] : []))),
        badan
      ])));
    } else {
      var grid = el('div', { class: 'grid-item' });
      kr.baris.forEach(function (b) {
        grid.appendChild(el('article', { class: 'kartu-item' + (b.flag ? ' dilaporkan' : '') }, [
          el('div', { class: 'kartu-item-kepala' }, [
            el('h3', { class: 'kartu-item-nama' }, namaItem(b)),
            b.satuan ? el('span', { class: 'kartu-item-satuan', text: b.satuan }) : null
          ]),
          el('dl', { class: 'nilai-daftar' }, kolom.filter(function (k) {
            return k !== nama && kolomBerlaku(k, b) && !(k.jikaAda && b.nilai[k.kunci] == null && !(b.koreksi && b.koreksi[k.kunci]));
          }).map(function (k) {
            return [el('dt', { text: k.label }), el('dd', {}, nilaiKolom(b, k))];
          })),
          keteranganBaris(b),
          aksiBaris(b)
        ]));
      });
      wadah.appendChild(grid);
    }

    function tandaiDiperiksa(t) {
      if (navigator.onLine === false) {
        toast(PESAN.tidakAdaSinyal, 'masalah');
        return;
      }
      aturTombolProses(t, true, 'Menyimpan…');
      panggilApi('tandaiDiperiksa', { formId: info.formId, submissionId: kr.id }).then(function (h) {
        capKiriman = kr.id;
        opsi.perbarui(h.kiriman);
        toast('Ditandai diperiksa.');
      }).catch(function (err) {
        aturTombolProses(t, false);
        if (tanganiSesiBerakhir(err)) return;
        toast(pesanGalat(err), 'masalah');
      });
    }

    function bukaKunci() {
      konfirmasi({
        judul: 'Buka kunci isian ini?',
        teks: 'Status kembali menjadi Terkirim dan barisnya bisa dikoreksi. Tandai diperiksa lagi setelah selesai.',
        teksYa: 'Buka kunci',
        jalankan: function () { return panggilApi('bukaKunci', { formId: info.formId, submissionId: kr.id }); }
      }).then(function (h) {
        if (!h) return;
        opsi.perbarui(h.kiriman);
        toast('Kunci dibuka. Isian bisa dikoreksi.');
      });
    }

    function tutupLaporan(b) {
      konfirmasi({
        judul: 'Tutup laporan kekeliruan?',
        teks: 'Pakai ini jika angkanya ternyata sudah benar. Laporan ' + b.flag.oleh + ' ditutup tanpa koreksi.',
        teksYa: 'Tutup laporan',
        jalankan: function () { return panggilApi('tutupLaporan', { formId: info.formId, rowId: b.rowId }); }
      }).then(function (h) {
        if (!h) return;
        opsi.perbarui(h.kiriman);
        toast('Laporan ditutup.');
      });
    }
  }

  function tombolNamaItem(nama) {
    return el('button', { type: 'button', class: 'tabel-tombol', text: nama, 'aria-haspopup': 'dialog',
      onclick: function () { bukaRiwayatItem(nama); } });
  }

  /** Laporkan kekeliruan (semua role): catatan singkat untuk Pengelola. */
  function bukaLaporkan(info, b, selesai) {
    var nama = kolomNama(info.kolom || []);
    var namaBaris = nama ? b.nilai[nama.kunci] : '';
    var kCatatan = kolomIsian({
      label: 'Catatan untuk Pengelola',
      maxlength: 200,
      bantuan: 'Misalnya: Stock Masuk seharusnya 5, bukan 50.'
    });
    var pesan = el('p', { class: 'pesan-formulir', role: 'alert' });
    var ringkas = el('p', { class: 'kartu-teks' }, [ringkasBaris(b, info.kolom || []),
      ' · ' + info.kiriman.oleh + ', ' + tanggalPendek(info.kiriman.tanggal) + ' ' + jam(info.kiriman.waktu)]);
    var form = el('form', { class: 'formulir', novalidate: true }, [
      ringkas,
      b.flag ? el('p', { class: 'pesan-formulir tinjau' }, [ikon('bendera'),
        el('span', { text: 'Sudah dilaporkan ' + b.flag.oleh + ': ' + b.flag.catatan + '. Laporanmu ditambahkan.' })]) : null,
      kCatatan.wadah,
      pesan
    ]);
    function kirim(t, l) {
      tulisPesan(pesan, '');
      var catatan = kCatatan.input.value.trim();
      if (!kCatatan.galat(catatan ? '' : 'Tulis catatan singkat tentang kekeliruannya.')) {
        kCatatan.input.focus();
        return;
      }
      aturTombolProses(t, true, 'Mengirim…');
      l.sibuk(true);
      panggilApi('laporkanKeliru', { formId: info.formId, rowId: b.rowId, catatan: catatan }).then(function (h) {
        l.sibuk(false);
        l.tutup();
        selesai(h.kiriman);
        toast('Laporan terkirim ke Pengelola.');
      }).catch(function (err) {
        l.sibuk(false);
        aturTombolProses(t, false);
        if (tanganiSesiBerakhir(err)) return;
        tulisPesan(pesan, pesanGalat(err), 'masalah');
      });
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      kirim(lembar.tombol[1], lembar);
    });
    var lembar = bukaLembar({
      judul: 'Laporkan kekeliruan' + (namaBaris ? ' ' + namaBaris : ''),
      isi: form,
      aksi: [
        { teks: 'Batal', jenis: 'kedua' },
        { teks: 'Kirim laporan', jenis: 'utama', klik: kirim }
      ]
    });
  }

  /**
   * Koreksi satu baris (Pengelola). Yang dikoreksi catatan sumbernya; untuk
   * Stock, Stock Akhir hari itu dan hari-hari sesudahnya dihitung ulang server.
   */
  function bukaKoreksi(info, b, selesai) {
    // Kolom "jikaAda" hanya untuk baris yang berisi (prep: jumlah resep atau Qty).
    var kolom = (info.kolom || []).filter(function (k) { return k.koreksi && kolomBerlaku(k, b) && !(k.jikaAda && b.nilai[k.kunci] == null); });
    var nama = kolomNama(info.kolom || []);
    var namaBaris = nama ? b.nilai[nama.kunci] : '';
    var kolomIsi = kolom.map(function (k) {
      if (k.pilihan) {
        // Pilihan tetap (kategori waste, pilihan form kustom): tombol berjajar, bukan ketikan bebas.
        var g = grupPilihan(k.label, k.pilihan, b.nilai[k.kunci] || '');
        return { k: k, pilihan: g, kolom: { wadah: g.wadah } };
      }
      var kosongBoleh = k.opsional && b.nilai[k.kunci] == null;
      // Rupiah yang bisa dikoreksi (harga beli Stock, aplikasi 0.23.0): dibaca dengan bacaRupiah.
      var rupiah = k.jenis === 'rupiah';
      var kI = kolomIsian({
        label: k.label + (rupiah ? ' (Rp' + (b.satuan ? ' per ' + b.satuan : '') + ')'
          : (k.satuan && b.satuan ? ' (' + b.satuan + ')' : (k.akhiran ? ' (' + k.akhiran + ')' : ''))),
        type: k.waktu ? 'time' : 'text',
        inputmode: rupiah ? 'numeric' : (k.jenis === 'angka' ? 'decimal' : null),
        kelas: k.jenis === 'angka' || rupiah ? 'isian-angka' : (k.waktu ? 'isian-jam' : null),
        nilai: rupiah ? (b.nilai[k.kunci] == null ? '' : String(b.nilai[k.kunci]).replace('.', ','))
          : k.jenis === 'angka' ? (kosongBoleh ? '' : String(b.nilai[k.kunci] || 0).replace('.', ',')) : (b.nilai[k.kunci] || ''),
        bantuan: b.asli && b.asli[k.kunci] ? 'Diketik ' + b.asli[k.kunci] + '. Koreksi ditulis dalam ' + b.satuan + '.'
          : (k.bantuan || (k.jenis === 'item' ? 'Tulis nama item persis seperti di daftar item.' : (k.opsional ? 'Tidak wajib; boleh dikosongkan.' : null)))
      });
      if (k.minus) {
        // Papan angka iPhone tidak punya tanda minus: tombol ± di samping kolom.
        var tanda = el('button', { type: 'button', class: 'tombol-tanda', 'aria-label': 'Ganti tanda plus atau minus', text: '±' });
        tanda.addEventListener('click', function () {
          var t = String(kI.input.value || '').replace('−', '-');
          kI.input.value = t.charAt(0) === '-' ? t.slice(1) : '-' + t;
          kI.input.focus();
        });
        var deret = el('div', { class: 'baris-angka' });
        kI.input.parentNode.insertBefore(deret, kI.input);
        deret.appendChild(tanda);
        deret.appendChild(kI.input);
      }
      return { k: k, kolom: kI };
    });
    var pesan = el('p', { class: 'pesan-formulir', role: 'alert' });
    var form = el('form', { class: 'formulir', novalidate: true }, [
      el('p', { class: 'kartu-teks', text: 'Isian ' + info.kiriman.oleh + ', ' + tanggalJudul(info.kiriman.tanggal) + ', ' + jam(info.kiriman.waktu) + '.' }),
      b.flag ? el('p', { class: 'pesan-formulir tinjau' }, [ikon('bendera'),
        el('span', { text: 'Dilaporkan ' + b.flag.oleh + ': ' + b.flag.catatan })]) : null
    ].concat(kolomIsi.map(function (x) { return x.kolom.wadah; })).concat([
      // Prep tanpa resep tidak menggerakkan stock.
      (info.gerakStock || info.formId === 'STOCK') && !(info.formId === 'PREP' && b.nilai.jumlahResep == null)
        ? el('p', { class: 'kolom-bantuan', text: 'Stock Akhir hari itu dan hari-hari sesudahnya dihitung ulang. Nilai lama tetap tercatat.' })
        : el('p', { class: 'kolom-bantuan', text: 'Nilai lama tetap tercatat.' }),
      pesan
    ]));
    function simpan(t, l) {
      tulisPesan(pesan, '');
      var nilai = {};
      var ok = true;
      kolomIsi.forEach(function (x) {
        if (x.pilihan) {
          var p = x.pilihan.nilai();
          ok = x.pilihan.galat(p || x.k.opsional ? '' : 'Pilih ' + x.k.label.toLowerCase() + '.') && ok;
          nilai[x.k.kunci] = p;
          return;
        }
        var v = x.kolom.input.value;
        if (x.k.minus) {
          var s = bacaAngkaSuhu(v);
          if (s === null || isNaN(s)) {
            ok = x.kolom.galat('Isi angka, misalnya 3,5 atau -18.') && ok;
            return;
          }
          x.kolom.galat('');
          nilai[x.k.kunci] = s;
        } else if (x.k.jenis === 'rupiah') {
          var r = bacaRupiah(v);
          if (r !== null && isNaN(r)) {
            ok = x.kolom.galat('Isi rupiah, misalnya 15000 atau 15.000, atau kosongkan.') && ok;
            return;
          }
          x.kolom.galat('');
          nilai[x.k.kunci] = r === null ? '' : r;
        } else if (x.k.jenis === 'angka') {
          var n = bacaAngka(v);
          if (n !== null && isNaN(n)) {
            ok = x.kolom.galat('Isi angka 0 atau lebih, misalnya 2,5.') && ok;
            return;
          }
          x.kolom.galat('');
          nilai[x.k.kunci] = n === null ? (x.k.opsional ? '' : 0) : n;
        } else {
          nilai[x.k.kunci] = v;
        }
      });
      if (!ok) return;
      aturTombolProses(t, true, 'Menyimpan…');
      l.sibuk(true);
      panggilApi('koreksi', { formId: info.formId, rowId: b.rowId, nilai: nilai }).then(function (h) {
        l.sibuk(false);
        l.tutup();
        selesai(h.kiriman);
        toast(info.gerakStock || info.formId === 'STOCK' ? 'Koreksi tersimpan. Stock dihitung ulang.' : 'Koreksi tersimpan.');
      }).catch(function (err) {
        l.sibuk(false);
        aturTombolProses(t, false);
        if (tanganiSesiBerakhir(err)) return;
        tulisPesan(pesan, pesanGalat(err), 'masalah');
      });
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      simpan(lembar.tombol[1], lembar);
    });
    var lembar = bukaLembar({
      judul: 'Koreksi' + (namaBaris ? ' ' + namaBaris : ''),
      isi: form,
      aksi: [
        { teks: 'Batal', jenis: 'kedua' },
        { teks: 'Simpan koreksi', jenis: 'utama', klik: simpan }
      ]
    });
  }

  /**
   * Riwayat per item (tampilan Bagian 5.4): 7 rekap terakhir dalam lembar, dan
   * kartu stok (tiap transaksi pada hari-hari itu, dengan saldo sesudahnya).
   * Di HP tabelnya digeser ke samping di dalam lembar; kolom tanggal diam.
   * Pengelola: "Sesuaikan stock". data: jawaban riwayatItem (opsional).
   */
  function bukaRiwayatItem(nama, data) {
    var wadah = el('div', { class: 'riwayat-item' }, kerangkaBaris(3));
    var pengelola = !!sesiKini().pengguna.pengelola;
    var info = null;
    var lembar = bukaLembar({
      judul: nama,
      isi: wadah,
      lebar: true,
      aksi: [{ teks: 'Tutup', jenis: 'kedua' }].concat(pengelola ? [{
        teks: 'Sesuaikan stock',
        jenis: 'utama',
        klik: function () {
          if (!info) return;
          bukaSesuaikanStock(info, function (hasil) {
            if (hasil.riwayatItem) bukaRiwayatItem(nama, hasil.riwayatItem);
          });
        }
      }] : [])
    });
    if (pengelola) lembar.tombol[1].disabled = true;

    function gambar(d) {
      info = d;
      if (pengelola) lembar.tombol[1].disabled = false;
      var it = d.item;
      kosongkan(wadah);
      var ket = [it.kategori, it.satuan].filter(Boolean).join(' · ');
      if (it.stokMin != null) ket += ' · Stok minimum ' + formatAngka(it.stokMin) + ' ' + it.satuan;
      wadah.appendChild(el('p', { class: 'kolom-bantuan', text: ket }));
      var sekarang = el('p', { class: 'riwayat-item-sekarang' }, ['Stock tercatat hari ini ',
        el('strong', { class: d.tercatat < 0 ? 'minus' : null }, angkaSatuan(d.tercatat, it.satuan))]);
      wadah.appendChild(sekarang);
      if (d.tercatat < 0) wadah.appendChild(tandaStatus('masalah', 'Stock akhir minus'));
      else if (it.stokMin != null && d.tercatat < it.stokMin) wadah.appendChild(tandaStatus('tinjau', 'Di bawah stok minimum'));
      if (!d.rekap.length) {
        wadah.appendChild(kotakKosong('Belum ada rekap untuk item ini.', 'riwayat'));
        return;
      }
      var adaTransaksi = Array.isArray(d.transaksi);
      var isiTampilan = el('div', { class: 'riwayat-item-tampilan' });
      var pilihTampilan = null;
      // Server lama (tanpa transaksi): hanya rekap harian.
      if (adaTransaksi) {
        pilihTampilan = grupPilihan('Tampilan', ['Rekap harian', 'Transaksi'], 'Rekap harian');
        pilihTampilan.wadah.classList.add('pilih-tampilan');
        pilihTampilan.input.forEach(function (i) {
          i.addEventListener('change', function () { gambarTampilan(); });
        });
        wadah.appendChild(pilihTampilan.wadah);
      }
      wadah.appendChild(isiTampilan);
      gambarTampilan();

      function gambarTampilan(fokusTanggal) {
        kosongkan(isiTampilan);
        if (pilihTampilan && pilihTampilan.nilai() === 'Transaksi') gambarTransaksi(fokusTanggal);
        else gambarRekap();
      }

      /** Ketuk tanggal di rekap: pindah ke kartu stok pada tanggal itu. */
      function bukaTanggal(tanggal) {
        pilihTampilan.input[1].checked = true;
        gambarTampilan(tanggal);
      }

      function gambarTransaksi(fokusTanggal) {
        if (!d.transaksi.length) {
          isiTampilan.appendChild(kotakKosong('Belum ada transaksi untuk item ini.', 'riwayat'));
          return;
        }
        var awal = {};
        d.rekap.forEach(function (r) { awal[r.tanggal] = r.awal; });
        var perTanggal = {};
        var urutan = [];
        d.transaksi.forEach(function (x) {
          if (!perTanggal[x.tanggal]) {
            perTanggal[x.tanggal] = [];
            urutan.push(x.tanggal);
          }
          perTanggal[x.tanggal].push(x);
        });
        var fokus = null;
        urutan.forEach(function (tg) {
          var judul = el('h3', { class: 'kelompok-judul', tabindex: '-1' }, [
            el('span', { text: tanggalJudul(tg) }),
            el('span', { class: 'kartu-stok-awal' }, ['Awal ', angkaSatuan(awal[tg] || 0, it.satuan)])
          ]);
          if (tg === fokusTanggal) fokus = judul;
          isiTampilan.appendChild(el('section', { class: 'kelompok kartu-stok' }, [
            judul,
            el('div', { class: 'daftar' }, perTanggal[tg].map(barisTransaksi))
          ]));
        });
        isiTampilan.appendChild(el('p', { class: 'kolom-bantuan', text: 'Urut menurut jam diterima server. Saldo = stock sesudah transaksi itu, dalam ' + it.satuan + '.' }));
        if (fokus) {
          fokus.scrollIntoView({ block: 'start' });
          fokus.focus({ preventScroll: true });
        }
      }

      function barisTransaksi(x) {
        var w = x.waktu ? (tanggalIso(new Date(x.waktu)) === x.tanggal ? jam(x.waktu) : waktuPendek(x.waktu)) : '';
        var judul = x.jenis + (x.oleh ? ' · ' + x.oleh : '') + (w ? ', ' + w : '');
        var ket = [x.ket, x.dikoreksi ? 'Pernah dikoreksi' : ''].filter(Boolean).join('. ');
        var gerak = [];
        if (x.masuk) gerak.push(el('span', { class: 'kartu-stok-masuk', text: '+' + formatAngka(x.masuk) + ' ' + it.satuan }));
        if (x.keluar) gerak.push(el('span', { class: 'kartu-stok-keluar', text: '−' + formatAngka(x.keluar) + ' ' + it.satuan }));
        var isi = [
          el('span', { class: 'daftar-baris-isi' }, [
            el('span', { class: 'daftar-baris-judul', text: judul }),
            ket ? el('span', { class: 'daftar-baris-ket', text: ket }) : null
          ]),
          el('span', { class: 'kartu-stok-angka' }, gerak.concat([
            el('span', { class: 'kartu-stok-saldo' + (x.saldo < 0 ? ' minus' : '') }, ['Saldo ', angkaSatuan(x.saldo)])
          ]))
        ];
        // Kiriman Stock, Prep, dan Waste membuka detailnya di Riwayat.
        if (x.formId && x.submissionId) {
          isi.push(ikon('kanan'));
          return el('a', {
            class: 'daftar-baris kartu-stok-baris',
            href: '#/riwayat/' + x.formId + '/' + encodeURIComponent(x.submissionId),
            'aria-label': judul + '. ' + gerak.map(function (g) { return g.textContent; }).join(', ') +
              '. Saldo ' + formatAngka(x.saldo) + ' ' + it.satuan + '. Buka isian di Riwayat.'
          }, isi);
        }
        return el('div', { class: 'daftar-baris kartu-stok-baris tetap' }, isi);
      }

      function gambarRekap() {
        var badan = el('tbody');
        d.rekap.slice().reverse().forEach(function (r) {
          function sel(n) {
            return el('td', { class: 'angka' }, n ? angkaSatuan(n) : el('span', { class: 'otomatis', text: '–' }));
          }
          badan.appendChild(el('tr', { class: r.akhir < 0 ? 'minus' : null }, [
            el('th', { scope: 'row' }, adaTransaksi
              ? el('button', { type: 'button', class: 'tabel-tombol', text: tanggalPendek(r.tanggal),
                'aria-label': 'Transaksi ' + tanggalJudul(r.tanggal), onclick: function () { bukaTanggal(r.tanggal); } })
              : tanggalPendek(r.tanggal)),
            sel(r.awal),
            el('td', { class: 'angka' }, [r.masuk ? angkaSatuan(r.masuk) : el('span', { class: 'otomatis', text: '–' }),
              r.masukAsli ? el('span', { class: 'nilai-asli blok', text: '(' + r.masukAsli + ')' }) : null]),
            sel(r.hasilPrep), sel(r.keluar), sel(r.dipakaiPrep), sel(r.waste), sel(r.penyesuaian),
            el('td', { class: 'angka stock-akhir-sel' + (r.akhir < 0 ? ' minus' : '') }, [angkaSatuan(r.akhir),
              r.akhir < 0 ? el('span', { class: 'blok' }, tandaStatus('masalah', 'Minus')) : null])
          ]));
        });
        isiTampilan.appendChild(el('div', { class: 'tabel-bingkai' }, el('table', { class: 'tabel tabel-riwayat-item' }, [
          el('caption', { class: 'sr', text: '7 rekap terakhir ' + it.nama + ', dalam ' + it.satuan }),
          el('thead', {}, el('tr', {}, ['Tanggal', 'Awal', 'Masuk', 'Hasil Prep', 'Keluar', 'Dipakai Prep', 'Waste', 'Penyesuaian', 'Akhir']
            .map(function (j, i) { return el('th', { scope: 'col', class: i ? 'angka' : null, text: j }); }))),
          badan
        ])));
        isiTampilan.appendChild(el('p', { class: 'kolom-bantuan', text: 'Angka dalam ' + it.satuan + '. Hari tanpa gerakan tidak punya rekap.' +
          (adaTransaksi ? ' Ketuk tanggal untuk melihat transaksinya.' : '') }));
      }
    }

    if (data) {
      gambar(data);
      return;
    }
    panggilApi('riwayatItem', { item: nama }).then(function (d) {
      if (lembarKini !== lembar) return;
      gambar(d);
    }).catch(function (err) {
      if (tanganiSesiBerakhir(err)) return;
      if (lembarKini !== lembar) return;
      kosongkan(wadah).appendChild(kotakGalat(pesanGalat(err), function () {
        bukaRiwayatItem(nama);
      }));
    });
  }

  /**
   * Sesuaikan stock satu item (spesifikasi sistem Bagian 5.7), hanya
   * Pengelola. Dibuka dari lembar riwayat per item; tanggalnya hari ini.
   * info: jawaban riwayatItem (atau { item, tercatat }). selesai(hasil) setelah
   * tersimpan. alasanAwal: alasan yang sudah terpilih (stok pembuka item baru).
   */
  function bukaSesuaikanStock(info, selesai, alasanAwal) {
    var it = info.item;
    var tanggal = tanggalIso(new Date());
    var tercatat = info.tercatat;
    var kSebenarnya = kolomIsian({ label: 'Stock sebenarnya (' + it.satuan + ')', inputmode: 'decimal', kelas: 'isian-angka' });
    var gAlasan = grupPilihan('Alasan', ['Stok pembuka', 'Hasil hitung ulang', 'Lainnya'], alasanAwal || '');
    var kCatatan = kolomIsian({ label: 'Catatan', maxlength: 200, bantuan: 'Wajib untuk alasan Lainnya.' });
    var ringkas = el('p', { class: 'pesan-formulir tinjau', 'aria-live': 'polite' });
    var pesanLembar = el('p', { class: 'pesan-formulir', role: 'alert' });
    var sid = buatId();
    function perbaruiRingkas() {
      var n = bacaAngka(kSebenarnya.input.value);
      if (n === null || isNaN(n)) {
        tulisPesan(ringkas, 'Tercatat ' + formatAngka(tercatat) + ' ' + it.satuan + '.', 'tinjau');
        return;
      }
      var selisih = bulat3(n - tercatat);
      tulisPesan(ringkas, 'Tercatat ' + formatAngka(tercatat) + ' ' + it.satuan + ', sebenarnya ' + formatAngka(n) + ' ' +
        it.satuan + '. Selisih ' + (selisih > 0 ? '+' : '') + formatAngka(selisih) + ' ' + it.satuan + '.', 'tinjau');
    }
    kSebenarnya.input.addEventListener('input', perbaruiRingkas);
    perbaruiRingkas();
    var form = el('form', { class: 'formulir', novalidate: true }, [
      el('p', { class: 'kolom-bantuan', text: 'Tanggal ' + tanggalPendek(tanggal) + ' (hari ini). Selisihnya dicatat sebagai penyesuaian.' }),
      kSebenarnya.wadah, ringkas, gAlasan.wadah, kCatatan.wadah, pesanLembar
    ]);
    function simpan(t, l) {
      tulisPesan(pesanLembar, '');
      var n = bacaAngka(kSebenarnya.input.value);
      var ok = [
        kSebenarnya.galat(n === null ? 'Isi stock sebenarnya.' : (isNaN(n) ? 'Isi angka, misalnya 2,5.' : '')),
        gAlasan.galat(gAlasan.nilai() ? '' : 'Pilih alasan.'),
        kCatatan.galat(gAlasan.nilai() === 'Lainnya' && !kCatatan.input.value.trim() ? 'Tulis catatan untuk alasan Lainnya.' : '')
      ];
      if (ok.indexOf(false) >= 0) return;
      aturTombolProses(t, true, 'Menyimpan…');
      l.sibuk(true);
      panggilApi('sesuaikanStock', {
        submissionId: sid,
        item: it.nama,
        tanggal: tanggal,
        stockSebenarnya: n,
        alasan: gAlasan.nilai(),
        catatan: kCatatan.input.value,
        waktuPerangkat: new Date().toISOString()
      }).then(function (hasil) {
        l.sibuk(false);
        l.tutup(true);
        if (hasil.form) Cache.tulis('stock', hasil.form);
        toast('Stock ' + it.nama + ' disesuaikan. Selisih ' + (hasil.selisih > 0 ? '+' : '') +
          formatAngka(hasil.selisih || 0) + ' ' + it.satuan + '.');
        if (selesai) selesai(hasil);
        if (segarkanLayar) segarkanLayar();
      }).catch(function (err) {
        l.sibuk(false);
        aturTombolProses(t, false);
        if (tanganiSesiBerakhir(err)) return;
        tulisPesan(pesanLembar, pesanGalat(err), 'masalah');
      });
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      simpan(lembar.tombol[1], lembar);
    });
    var lembar = bukaLembar({
      judul: 'Sesuaikan stock ' + it.nama,
      isi: form,
      aksi: [
        { teks: 'Batal', jenis: 'kedua' },
        { teks: 'Simpan penyesuaian', jenis: 'utama', klik: simpan }
      ]
    });
  }

  /* =======================================================================
   * Unduh PDF bersama (spesifikasi sistem Bagian 9.1, tampilan Bagian 5.5).
   * Dipakai menu Laporan, detail Riwayat, dan semua unduhan PDF berikutnya
   * (laporan selisih opname, daftar belanja, rekap bulanan).
   * ===================================================================== */

  /** iPhone dan iPad dikenali dari perangkatnya, termasuk iPad yang mengaku sebagai Mac. */
  function apakahIos() {
    var ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  }

  /** Lembar bagikan dengan file (Web Share API) didukung? */
  function bisaBagikanFile(file) {
    try {
      if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function' || typeof File !== 'function') return false;
      return !!navigator.canShare({ files: [file || new File(['%PDF'], 'uji.pdf', { type: 'application/pdf' })] });
    } catch (err) {
      return false;
    }
  }

  function blobDariBase64(data, mime) {
    var biner = window.atob(data);
    var isi = new Uint8Array(biner.length);
    for (var i = 0; i < biner.length; i++) isi[i] = biner.charCodeAt(i);
    return new Blob([isi], { type: mime || 'application/pdf' });
  }

  /**
   * Tombol "Unduh PDF". opsi: { aksi (bawaan 'unduhPdf'), minta() → isi
   * permintaan, jenis, label, teks (bawaan "Unduh PDF", misalnya "Unduh
   * laporan selisih") }. Server menjawab { namaFile, mime, data (base64) }.
   * Android, laptop, desktop: file langsung tersimpan, lalu "PDF diunduh.".
   * iPhone dan iPad: dua langkah. PDF diambil dulu, tombol berganti menjadi
   * "Simpan PDF"; ketukan berikutnya langsung membuka lembar bagikan tanpa
   * menunggu apa pun. Tanpa dukungan berbagi file: pesan cadangan, tanpa
   * tombol "Simpan PDF". Hasil: { tombol, pesan, reset() }.
   */
  function unduhPdf(opsi) {
    var ios = apakahIos();
    var teksAwal = opsi.teks || 'Unduh PDF';
    var t = tombol(teksAwal, opsi.jenis || 'utama', opsi.label ? { 'aria-label': opsi.label } : null);
    var pesan = el('p', { class: 'pesan-formulir', role: 'status', 'aria-live': 'polite' });
    var file = null;

    function reset() {
      file = null;
      aturTombolProses(t, false);
      gantiTeksTombol(t, teksAwal);
      t.classList.remove('siap-simpan');
      tulisPesan(pesan, '');
    }

    t.addEventListener('click', function () {
      if (t.disabled) return;
      if (file) {
        // Langsung di dalam ketukan: iPhone hanya membuka lembar bagikan dari ketukan pengguna.
        var f = file;
        var selesai = function () {
          if (file === f) reset();
        };
        navigator.share({ files: [f] }).then(selesai, selesai);
        return;
      }
      tulisPesan(pesan, '');
      if (ios && !bisaBagikanFile()) {
        tulisPesan(pesan, PESAN.iphoneTidakBisaSimpan, 'tinjau');
        return;
      }
      if (navigator.onLine === false) {
        tulisPesan(pesan, PESAN.tidakAdaSinyal, 'masalah');
        return;
      }
      aturTombolProses(t, true, 'Membuat PDF…');
      jagaProses(panggilApi(opsi.aksi || 'unduhPdf', opsi.minta())).then(function (h) {
        aturTombolProses(t, false);
        var blob = blobDariBase64(h.data, h.mime);
        if (ios) {
          var siap = new File([blob], h.namaFile, { type: h.mime || 'application/pdf' });
          if (!bisaBagikanFile(siap)) {
            tulisPesan(pesan, PESAN.iphoneTidakBisaSimpan, 'tinjau');
            return;
          }
          file = siap;
          gantiTeksTombol(t, 'Simpan PDF');
          t.classList.add('siap-simpan');
          tulisPesan(pesan, 'Ketuk Simpan PDF, lalu pilih Save to Files.', 'info');
          return;
        }
        var url = URL.createObjectURL(blob);
        var a = el('a', { href: url, download: h.namaFile, hidden: true });
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
        toast('PDF diunduh.');
      }).catch(function (err) {
        aturTombolProses(t, false);
        if (tanganiSesiBerakhir(err)) return;
        tulisPesan(pesan, pesanGalat(err), 'masalah');
      });
    });
    return { tombol: t, pesan: pesan, reset: reset };
  }

  /* =======================================================================
   * Laporan (spesifikasi tampilan Bagian 5.5): pilih tanggal, pilih form,
   * untuk Stock pilih kategori, lalu "Unduh PDF". Pengelola: "Simpan ulang
   * ke Drive" (selalu semua kategori, seperti PDF harian).
   * ===================================================================== */

  function layarLaporan(k) {
    aturJudul('Laporan');
    var pengelola = !!k.sesi.pengguna.pengelola;
    var hariIni = tanggalIso(new Date());
    var kemarin = geserHari(hariIni, -1);
    var simpanan = Cache.baca('laporan-pilihan');
    var pilih = Object.assign({ formId: '', tanggal: hariIni, kategori: '' }, simpanan && simpanan.data ? simpanan.data : {});
    if (!pilih.tanggal || pilih.tanggal > hariIni) pilih.tanggal = hariIni;
    var data = null;

    var penanda = el('span', { class: 'memperbarui', role: 'status' });
    var wadahForm = el('div');
    var wadahKategori = el('div');
    var keterangan = el('p', { class: 'pesan-formulir', role: 'status' });

    var nilaiAwal = pilih.tanggal === hariIni ? 'Hari ini' : (pilih.tanggal === kemarin ? 'Kemarin' : 'Tanggal lain');
    var gTanggal = grupPilihan('Tanggal', ['Hari ini', 'Kemarin', 'Tanggal lain'], nilaiAwal);
    var tanggalLain = el('input', { type: 'date', class: 'isian', max: hariIni, 'aria-label': 'Tanggal lain' });
    tanggalLain.value = pilih.tanggal;
    tanggalLain.hidden = nilaiAwal !== 'Tanggal lain';
    gTanggal.wadah.appendChild(tanggalLain);

    var unduh = unduhPdf({
      minta: function () {
        var isi = { formId: pilih.formId, tanggal: pilih.tanggal };
        if (kategoriForm().length && pilih.kategori) isi.kategori = pilih.kategori;
        return isi;
      }
    });
    var tombolDrive = pengelola ? tombol('Simpan ulang ke Drive', 'kedua') : null;
    var pesanDrive = el('p', { class: 'pesan-formulir', role: 'status' });

    k.wadah.appendChild(el('div', { class: 'layar-isi layar-sempit' }, [
      el('h1', { class: 'judul-layar', text: 'Laporan' }),
      penanda,
      el('section', { class: 'kartu laporan-kartu', 'aria-label': 'Laporan harian PDF' }, [
        el('h2', { class: 'kartu-judul', text: 'Laporan harian PDF' }),
        gTanggal.wadah,
        wadahForm,
        wadahKategori,
        keterangan,
        el('div', { class: 'deret-tombol laporan-aksi' }, [unduh.tombol, tombolDrive]),
        unduh.pesan,
        pengelola ? pesanDrive : null
      ]),
      // Daftar belanja (Tahap 8) dan Rekap bulanan (Tahap 10), khusus Pengelola.
      pengelola ? kartuDaftarBelanja() : null,
      pengelola ? kartuRekapBulanan() : null
    ]));

    function simpanPilihan() {
      Cache.tulis('laporan-pilihan', pilih);
    }

    function formKini() {
      return (data && data.form || []).filter(function (f) { return f.id === pilih.formId; })[0] || null;
    }

    /** Kategori aktif untuk form yang bisa diunduh per kategori (Stock); kosong untuk form lain. */
    function kategoriForm() {
      var f = formKini();
      return f && f.adaPdf && Array.isArray(f.kategori) ? f.kategori : [];
    }

    /** Pilihan "Kategori" (bentuknya sama dengan di layar isi Stock), hanya untuk form Stock. */
    function gambarKategori() {
      kosongkan(wadahKategori);
      var daftar = kategoriForm();
      if (!daftar.length) return;
      if (pilih.kategori && daftar.indexOf(pilih.kategori) < 0) pilih.kategori = '';
      var pilihKat = el('select', { class: 'isian', id: 'laporan-kategori' }, [el('option', { value: '', text: 'Semua kategori' })]
        .concat(daftar.map(function (n) { return el('option', { value: n, text: n }); })));
      pilihKat.value = pilih.kategori;
      pilihKat.addEventListener('change', function () {
        pilih.kategori = pilihKat.value;
        simpanPilihan();
        aturKeadaan();
      });
      wadahKategori.appendChild(el('div', { class: 'kolom' }, [
        el('label', { class: 'kolom-label', for: 'laporan-kategori', text: 'Kategori' }),
        pilihKat
      ]));
    }

    function aturKeadaan() {
      unduh.reset();
      tulisPesan(pesanDrive, '');
      var f = formKini();
      var bisa = !!(f && f.adaPdf);
      unduh.tombol.disabled = !bisa;
      if (tombolDrive) tombolDrive.disabled = !bisa;
      if (!data) tulisPesan(keterangan, '');
      else if (!f) tulisPesan(keterangan, 'Belum ada form yang tampil. Pengelola mengatur form di Pengaturan.', 'tinjau');
      else if (!bisa) tulisPesan(keterangan, 'Laporan PDF ' + f.nama + ' dibangun di tahap berikutnya, bersama formnya.', 'tinjau');
      else tulisPesan(keterangan, '');
    }

    function gantiTanggal(baru) {
      if (!baru || baru > hariIni) return;
      pilih.tanggal = baru;
      simpanPilihan();
      aturKeadaan();
    }
    gTanggal.input.forEach(function (i) {
      i.addEventListener('change', function () {
        var v = gTanggal.nilai();
        tanggalLain.hidden = v !== 'Tanggal lain';
        if (v === 'Hari ini') gantiTanggal(hariIni);
        else if (v === 'Kemarin') gantiTanggal(kemarin);
        else gantiTanggal(tanggalLain.value);
      });
    });
    tanggalLain.addEventListener('change', function () { gantiTanggal(tanggalLain.value); });

    function gambar(d) {
      data = d;
      var daftar = d.form || [];
      if (!daftar.some(function (f) { return f.id === pilih.formId; })) {
        var pertama = daftar.filter(function (f) { return f.adaPdf; })[0] || daftar[0];
        pilih.formId = pertama ? pertama.id : '';
      }
      kosongkan(wadahForm);
      if (daftar.length) {
        var g = grupPilihan('Form', daftar.map(function (f) { return f.nama; }), (formKini() || {}).nama);
        g.wadah.querySelector('fieldset').classList.add('pilihan-gulir');
        g.input.forEach(function (i, n) {
          i.addEventListener('change', function () {
            pilih.formId = daftar[n].id;
            simpanPilihan();
            gambarKategori();
            aturKeadaan();
          });
        });
        wadahForm.appendChild(g.wadah);
      }
      gambarKategori();
      aturKeadaan();
    }

    if (tombolDrive) {
      tombolDrive.addEventListener('click', function () {
        if (tombolDrive.disabled) return;
        tulisPesan(pesanDrive, '');
        if (navigator.onLine === false) {
          tulisPesan(pesanDrive, PESAN.tidakAdaSinyal, 'masalah');
          return;
        }
        aturTombolProses(tombolDrive, true, 'Menyimpan…');
        jagaProses(panggilApi('simpanPdfDrive', { formId: pilih.formId, tanggal: pilih.tanggal })).then(function (h) {
          aturTombolProses(tombolDrive, false);
          tulisPesan(pesanDrive, 'Tersimpan: ' + h.lokasi + '/' + h.namaFile + '. Salinannya muncul di Google Drive paling lambat 5 menit lagi.', 'baik');
          toast('PDF tersimpan.');
        }).catch(function (err) {
          aturTombolProses(tombolDrive, false);
          if (tanganiSesiBerakhir(err)) return;
          tulisPesan(pesanDrive, pesanGalat(err), 'masalah');
        });
      });
    }

    aturKeadaan();
    muatData({
      kunciCache: 'laporan',
      ambil: function () { return panggilApi('infoLaporan'); },
      gambar: gambar,
      kerangka: function () { kosongkan(wadahForm).appendChild(kerangkaBaris(1)); },
      galat: function (pesan, cobaLagi) { kosongkan(wadahForm).appendChild(kotakGalat(pesan, cobaLagi)); },
      penanda: penanda
    });
  }

  /* =======================================================================
   * Dashboard (khusus Pengelola; spesifikasi tampilan Bagian 5.6, sistem
   * Bagian 8.5): angka ringkas hari ini, Perlu perhatian, dua grafik kecil,
   * dan tombol ke tab Dashboard di Google Sheets. Semua datanya datang dalam
   * satu jawaban "dashboard". Grafik digambar dengan SVG tanpa library dan
   * tampil langsung, tanpa animasi.
   * ===================================================================== */

  var HARI_SINGKAT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  var SVG_NS = 'http://www.w3.org/2000/svg';

  /** Elemen SVG (grafik). */
  function svgEl(tag, atribut, anak) {
    var e = document.createElementNS(SVG_NS, tag);
    Object.keys(atribut || {}).forEach(function (k) { if (atribut[k] != null) e.setAttribute(k, String(atribut[k])); });
    [].concat(anak || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }

  function hariKe(iso) {
    var p = String(iso).split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])).getDay();
  }

  /** Penanda pengecekan suhu: lingkaran (normal) atau segitiga berwarna Masalah (di luar standar). */
  function penandaSuhu(luar) {
    return svgEl('svg', { class: 'penanda-suhu' + (luar ? ' luar' : ''), viewBox: '0 0 14 14', 'aria-hidden': 'true', focusable: 'false' },
      luar ? svgEl('path', { d: 'M7 1.2 13.2 12.6H.8z' }) : svgEl('circle', { cx: 7, cy: 7, r: 5.2 }));
  }

  function contohPita() {
    return svgEl('svg', { class: 'contoh-pita', viewBox: '0 0 20 14', 'aria-hidden': 'true', focusable: 'false' },
      svgEl('rect', { x: 1, y: 2, width: 18, height: 10 }));
  }

  /**
   * Grafik waste 7 hari terakhir: tujuh batang (hari ini paling kanan), tinggi
   * batang = estimasi kerugian hari itu, nama hari di bawahnya. Hari tanpa
   * waste tidak punya batang. Ketuk batang untuk melihat tanggal dan nilainya.
   */
  function grafikWaste(g) {
    var hari = (g && g.hari) || [];
    var total = 0;
    var catatan = 0;
    var maks = null;
    hari.forEach(function (x) {
      total += x.rp;
      catatan += x.catatan;
      if (x.rp > 0 && (!maks || x.rp > maks.rp)) maks = x;
    });
    var idJudul = 'judul-grafik-waste';
    var kartu = el('section', { class: 'kartu grafik-kartu', 'aria-labelledby': idJudul }, [
      el('h2', { class: 'kartu-judul', id: idJudul, text: 'Waste 7 hari terakhir' })
    ]);
    if (!catatan) {
      // Grafik kosong tetap menggambar sumbu dan nama hari (versi 1.7), kalimatnya di tengah.
      kartu.appendChild(el('div', { class: 'grafik-waste grafik-kosong' }, [
        el('div', { class: 'grafik-waste-area' }, [
          svgEl('svg', { class: 'grafik-waste-svg', viewBox: '0 0 700 120', preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' },
            svgEl('line', { class: 'garis-dasar', x1: 0, y1: 119.5, x2: 700, y2: 119.5 })),
          el('p', { class: 'grafik-kosong-teks' }, el('span', { text: 'Belum ada waste dalam 7 hari terakhir.' }))
        ]),
        el('div', { class: 'grafik-waste-hari', 'aria-hidden': 'true' }, hari.map(function (x, i) {
          return el('span', { class: i === hari.length - 1 ? 'hari-ini' : null, text: HARI_SINGKAT[hariKe(x.tanggal)] });
        }))
      ]));
      return kartu;
    }
    kartu.appendChild(el('p', { class: 'grafik-ringkas', text: maks
      ? formatRupiah(total) + ', tertinggi ' + NAMA_HARI[hariKe(maks.tanggal)]
      : 'Rp 0, harga item yang terbuang belum diisi' }));

    var TINGGI = 120;
    var LEBAR_KOLOM = 100;
    var gambarSvg = svgEl('svg', { class: 'grafik-waste-svg', viewBox: '0 0 ' + (LEBAR_KOLOM * hari.length) + ' ' + TINGGI,
      preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' });
    var detail = el('p', { class: 'grafik-detail', 'aria-live': 'polite', text: 'Ketuk batang untuk melihat tanggal dan nilainya.' });
    var kolom = el('div', { class: 'grafik-waste-kolom' });
    var label = el('div', { class: 'grafik-waste-hari', 'aria-hidden': 'true' });
    var tombolHari = [];

    function teksHari(x) {
      return tanggalJudul(x.tanggal) + ': ' + (x.catatan
        ? formatRupiah(x.rp) + ' dari ' + x.catatan + ' catatan' + (x.rp ? '' : ' (harga item belum diisi)')
        : 'tidak ada waste') + '.';
    }

    function gambarBatang(pilih, awal) {
      while (gambarSvg.firstChild) gambarSvg.removeChild(gambarSvg.firstChild);
      hari.forEach(function (x, i) {
        if (i === pilih) {
          gambarSvg.appendChild(svgEl('rect', { class: 'kolom-pilih', x: i * LEBAR_KOLOM, y: 0, width: LEBAR_KOLOM, height: TINGGI }));
        }
        if (!(x.rp > 0) || !maks) return;
        var h = Math.max(3, Math.round(x.rp / maks.rp * (TINGGI - 8)));
        gambarSvg.appendChild(svgEl('rect', { class: 'batang' + (awal ? ' tumbuh' : ''), style: awal ? '--i:' + i : null,
          x: i * LEBAR_KOLOM + 22, y: TINGGI - h, width: LEBAR_KOLOM - 44, height: h }));
      });
      gambarSvg.appendChild(svgEl('line', { class: 'garis-dasar', x1: 0, y1: TINGGI - 0.5, x2: LEBAR_KOLOM * hari.length, y2: TINGGI - 0.5 }));
      tombolHari.forEach(function (t, i) { t.setAttribute('aria-pressed', i === pilih ? 'true' : 'false'); });
    }

    hari.forEach(function (x, i) {
      var t = el('button', { type: 'button', class: 'grafik-waste-tombol', 'aria-label': teksHari(x), 'aria-pressed': 'false' });
      t.addEventListener('click', function () {
        gambarBatang(i);
        detail.textContent = teksHari(x);
      });
      tombolHari.push(t);
      kolom.appendChild(t);
      label.appendChild(el('span', { class: i === hari.length - 1 ? 'hari-ini' : null, text: HARI_SINGKAT[hariKe(x.tanggal)] }));
    });
    gambarBatang(-1, true);
    kartu.appendChild(el('div', { class: 'grafik-waste' }, [
      el('div', { class: 'grafik-waste-area' }, [gambarSvg, kolom]),
      label
    ]));
    kartu.appendChild(detail);
    return kartu;
  }

  /** Skala satu baris suhu: batas normal tipe unit itu, dilebarkan 4 °C ke tiap sisi (Freezer: −30 sampai −14 °C). */
  function skalaSuhu(tipe, batas) {
    if (tipe === 'Freezer') {
      return { bawah: batas.freezerMaks - 12, atas: batas.freezerMaks + 4, normalBawah: batas.freezerMaks - 12, normalAtas: batas.freezerMaks };
    }
    return { bawah: batas.chillerMin - 4, atas: batas.chillerMaks + 4, normalBawah: batas.chillerMin, normalAtas: batas.chillerMaks };
  }

  /**
   * Grafik suhu hari ini: satu baris per unit, pita batas normal, satu titik
   * per pengecekan (termasuk cek ulang) pada posisi suhunya, dan suhu terakhir
   * di kanan. Di luar standar: segitiga berwarna Masalah. Suhu di luar skala
   * ditaruh di tepi. Ketuk baris untuk melihat jam dan suhunya.
   */
  function grafikSuhu(g) {
    var idJudul = 'judul-grafik-suhu';
    var kartu = el('section', { class: 'kartu grafik-kartu', 'aria-labelledby': idJudul }, [
      el('h2', { class: 'kartu-judul', id: idJudul, text: 'Suhu hari ini' })
    ]);
    if (!g || !g.jumlah) {
      kartu.appendChild(el('p', { class: 'grafik-ringkas', text: 'Belum ada pengecekan suhu hari ini.' }));
      // Grafik kosong (versi 1.7): pita batas normal unit aktif tetap digambar, tanpa titik.
      if (!g || !g.unit || !g.unit.length) return kartu;
    } else kartu.appendChild(el('p', { class: 'grafik-ringkas', text: g.luar
      ? g.luar + ' pengecekan di luar standar'
      : 'Semua pengecekan normal' }));
    var daftar = el('div', { class: 'grafik-suhu' });
    (g.unit || []).forEach(function (u) {
      var s = skalaSuhu(u.tipe, g.batas);
      var rentang = s.atas - s.bawah;
      var posisi = function (n) { return Math.max(0, Math.min(1, (n - s.bawah) / rentang)); };
      var pita = svgEl('svg', { class: 'suhu-pita', viewBox: '0 0 100 28', preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' }, [
        svgEl('line', { class: 'suhu-jalur', x1: 0, y1: 14, x2: 100, y2: 14 }),
        svgEl('rect', { class: 'suhu-normal', x: posisi(s.normalBawah) * 100, y: 5,
          width: (posisi(s.normalAtas) - posisi(s.normalBawah)) * 100, height: 18 })
      ]);
      var titik = el('div', { class: 'suhu-titik' });
      u.cek.forEach(function (c, ci) {
        var f = posisi(c.suhu);
        var p = penandaSuhu(c.luar);
        var bungkus = el('span', { class: 'suhu-titik-satu' + (f === 0 || f === 1 ? ' tepi' : ''),
          style: 'left:' + (f * 100).toFixed(2) + '%;--i:' + Math.min(ci, 7) });
        bungkus.appendChild(p);
        titik.appendChild(bungkus);
      });
      var terakhir = u.cek[u.cek.length - 1];
      var jumlahLuar = u.cek.filter(function (c) { return c.luar; }).length;
      var nilai = el('span', { class: 'suhu-terakhir' + (terakhir && terakhir.luar ? ' nilai-masalah' : ''),
        text: terakhir ? teksSuhu(terakhir.suhu) : '–' });
      var idRinci = 'rinci-suhu-' + (++nomorKolom);
      var rinci = el('ul', { class: 'suhu-rinci', id: idRinci, hidden: true }, [
        el('li', { class: 'kolom-bantuan', text: teksBatasSuhu(u.tipe, g.batas) + (u.nonaktif ? ' · unit nonaktif' : '') })
      ].concat(u.cek.length ? u.cek.map(function (c) {
        return el('li', {}, [
          penandaSuhu(c.luar),
          el('span', { text: c.waktuCek + (c.waktu ? ' ' + jam(c.waktu) : '') + ': ' + teksSuhu(c.suhu) + ', ' +
            (c.luar ? 'di luar standar' : 'normal') + (c.oleh ? ' · ' + c.oleh : '') + (c.luar && c.tindakan ? '. Tindakan: ' + c.tindakan : '') })
        ]);
      }) : [el('li', { text: 'Belum ada pengecekan.' })]));
      var baris = el('button', {
        type: 'button',
        class: 'grafik-suhu-baris',
        'aria-expanded': 'false',
        'aria-controls': idRinci,
        'aria-label': u.nama + ': ' + (u.cek.length
          ? u.cek.length + ' pengecekan, terakhir ' + teksSuhu(terakhir.suhu) + (jumlahLuar ? ', ' + jumlahLuar + ' di luar standar' : ', semua normal')
          : 'belum ada pengecekan') + '. Ketuk untuk melihat jam dan suhunya.'
      }, [
        el('span', { class: 'suhu-nama', text: u.nama }),
        el('span', { class: 'suhu-strip' }, el('span', { class: 'suhu-strip-isi' }, [pita, titik])),
        nilai
      ]);
      baris.addEventListener('click', function () {
        var buka = rinci.hidden;
        rinci.hidden = !buka;
        baris.setAttribute('aria-expanded', buka ? 'true' : 'false');
      });
      daftar.appendChild(el('div', { class: 'grafik-suhu-unit' }, [baris, rinci]));
    });
    kartu.appendChild(daftar);
    kartu.appendChild(el('p', { class: 'grafik-legenda' }, [
      el('span', {}, [contohPita(), ' batas normal']),
      el('span', {}, [penandaSuhu(false), ' pengecekan']),
      el('span', {}, [penandaSuhu(true), ' di luar standar'])
    ]));
    return kartu;
  }

  /** Lembar nilai stock: per kategori, total, dan item yang belum punya harga (Bagian 8.5). */
  function bukaNilaiStock(n) {
    var badan = el('tbody');
    (n.perKategori || []).forEach(function (x) {
      badan.appendChild(el('tr', {}, [
        el('th', { scope: 'row', text: x.kategori }),
        el('td', { class: 'angka' }, el('span', { class: 'angka-satuan', text: formatRupiah(x.nilai) }))
      ]));
    });
    var tabel = (n.perKategori || []).length ? el('div', { class: 'tabel-bingkai' }, el('table', { class: 'tabel tabel-nilai' }, [
      el('caption', { class: 'sr', text: 'Nilai stock per kategori' }),
      el('thead', {}, el('tr', {}, [el('th', { scope: 'col', text: 'Kategori' }), el('th', { scope: 'col', class: 'angka', text: 'Nilai stock' })])),
      badan,
      el('tfoot', {}, el('tr', {}, [el('th', { scope: 'row', text: 'Total' }),
        el('td', { class: 'angka' }, el('strong', { class: 'angka-satuan', text: formatRupiah(n.total) }))]))
    ])) : kotakKosong('Belum ada item yang punya harga.');
    var tanpa = n.tanpaHarga || [];
    var sh = n.selisihHarga || null;
    var barisSelisih = null;
    if (sh) {
      var judulSelisih = 'Selisih karena perubahan harga bulan ini';
      var ketSelisih = sh.item.length
        ? sh.item.length + ' item berganti harga sejak ' + tanggalPendek(sh.dari) + '. Ketuk untuk rinciannya.'
        : 'Tidak ada harga yang berganti sejak ' + tanggalPendek(sh.dari) + '.';
      var isiSelisih = [
        el('span', { class: 'daftar-baris-isi' }, [
          el('span', { class: 'daftar-baris-judul', text: judulSelisih }),
          el('span', { class: 'daftar-baris-ket', text: ketSelisih })
        ]),
        el('strong', { class: 'angka-satuan', text: formatRupiahTanda(sh.total) })
      ];
      barisSelisih = sh.item.length
        ? el('button', { type: 'button', class: 'daftar-baris', 'aria-haspopup': 'dialog',
          onclick: function () { bukaSelisihHarga(n); } }, isiSelisih.concat([ikon('kanan')]))
        : el('div', { class: 'daftar-baris daftar-baris-diam' }, isiSelisih);
    }
    var isi = [
      el('p', { class: 'kartu-teks', text: 'Stock Akhir × harga satuan yang berlaku sekarang. Item tanpa harga tidak ikut dihitung.' }),
      tabel,
      barisSelisih ? el('div', { class: 'daftar', role: 'group', 'aria-label': 'Selisih karena perubahan harga' }, barisSelisih) : null,
      el('h3', { class: 'judul-sub', text: 'Belum punya harga (' + tanpa.length + ')' }),
      tanpa.length ? el('div', { class: 'daftar', role: 'group', 'aria-label': 'Item belum punya harga' }, tanpa.map(function (x) {
        return el('a', { class: 'daftar-baris', href: hrefItem(x.nama) }, [
          el('span', { class: 'daftar-baris-isi' }, [
            el('span', { class: 'daftar-baris-judul', text: x.nama }),
            el('span', { class: 'daftar-baris-ket', text: x.kategori + ' · stock ' + formatAngka(x.stock) + (x.satuan ? ' ' + x.satuan : '') +
              (x.aktif ? '' : ' · nonaktif') + '. Ketuk untuk mengisi harga.' })
          ]),
          ikon('kanan')
        ]);
      })) : el('p', { text: 'Semua item sudah punya harga.' })
    ];
    bukaLembar({ judul: 'Nilai stock ' + formatRupiah(n.total), isi: isi, aksi: [{ teks: 'Tutup', jenis: 'kedua' }] });
  }

  /** "+Rp 12.000", "Rp −4.500", atau "Rp 0". */
  function formatRupiahTanda(n) {
    return (Math.round(n) > 0 ? '+' : '') + formatRupiah(n);
  }

  /**
   * Rincian selisih karena perubahan harga bulan ini (spesifikasi sistem Bagian 8.5):
   * per item, tiap perubahan dengan harga lama dan baru, stock sehari sebelumnya, dan selisihnya.
   */
  function bukaSelisihHarga(n) {
    var sh = n.selisihHarga;
    var isi = [
      el('p', { class: 'kartu-teks', text: 'Tiap kali harga berganti: stock akhir sehari sebelumnya × (harga baru − harga lama). ' +
        'Positif berarti nilai stock naik karena harga naik. Perubahan sejak ' + tanggalPendek(sh.dari) + '.' }),
      el('div', { class: 'daftar', role: 'list', 'aria-label': 'Selisih harga per item' }, sh.item.map(function (x) {
        return el('div', { class: 'daftar-baris daftar-baris-diam', role: 'listitem' }, [
          el('span', { class: 'daftar-baris-isi' }, [
            el('span', { class: 'daftar-baris-judul', text: x.nama }),
            x.perubahan.map(function (c) {
              return el('span', { class: 'daftar-baris-ket', text: tanggalPendek(c.tanggal) + ': ' + formatRupiah(c.dari) + ' → ' +
                formatRupiah(c.ke) + ' per ' + x.satuan + ', stock ' + formatAngka(c.stock) + ' ' + x.satuan + ', ' +
                formatRupiahTanda(c.selisih) });
            })
          ]),
          el('strong', { class: 'angka-satuan', text: formatRupiahTanda(x.selisih) })
        ]);
      }))
    ];
    bukaLembar({
      judul: 'Selisih harga ' + formatRupiahTanda(sh.total),
      isi: isi,
      aksi: [{ teks: 'Kembali', jenis: 'kedua', klik: function (t, l) { l.tutup(true); bukaNilaiStock(n); } }]
    });
  }

  /** Lembar daftar item dari Perlu perhatian (stock minus, di bawah stok minimum); ketuk untuk riwayat item. */
  function bukaDaftarItemStock(p) {
    var item = (p.data && p.data.item) || [];
    bukaLembar({
      judul: p.judul,
      isi: [
        el('p', { class: 'kartu-teks', text: 'Ketuk item untuk melihat riwayatnya' + (p.jenis === 'minus' ? ' dan menyesuaikan stock.' : '.') }),
        el('div', { class: 'daftar', role: 'group', 'aria-label': p.judul }, item.map(function (x) {
          var ket = 'Stock tercatat ' + formatAngka(x.stock) + (x.satuan ? ' ' + x.satuan : '');
          if (x.stokMin != null) ket += ' · minimum ' + formatAngka(x.stokMin) + (x.satuan ? ' ' + x.satuan : '');
          if (x.saran) ket += ' · saran order ' + x.saran;
          return el('button', { type: 'button', class: 'daftar-baris', 'aria-haspopup': 'dialog', onclick: function () { bukaRiwayatItem(x.nama); } }, [
            el('span', { class: 'daftar-baris-isi' }, [
              el('span', { class: 'daftar-baris-judul', text: x.nama }),
              el('span', { class: 'daftar-baris-ket' + (x.stock < 0 ? ' nilai-masalah' : ''), text: ket })
            ]),
            ikon('kanan')
          ]);
        }))
      ],
      aksi: [{ teks: 'Tutup', jenis: 'kedua' }]
    });
  }

  /**
   * Harga beli yang berbeda dari harga satuan (aplikasi 0.23.0, tampilan Bagian 5.6): tiap item bisa
   * "Pakai Rp …" (harga satuan baru berlaku mulai tanggal pembelian, lewat gantiHarga) atau "Abaikan".
   */
  function bukaHargaBeli(p) {
    var item = (p.data && p.data.item) || [];
    var berubah = false;
    var daftar = el('div', { class: 'daftar', role: 'group', 'aria-label': p.judul });
    var pesan = el('p', { class: 'pesan-formulir', role: 'alert' });
    item.forEach(function (x) {
      var per = x.satuan ? '/' + x.satuan : '';
      var beda = x.harga == null ? 'Belum punya harga satuan.'
        : 'Harga satuan ' + formatRupiah(x.harga) + per + ' (' + (x.hargaBeli > x.harga ? 'beli lebih mahal ' : 'beli lebih murah ') +
          formatRupiah(Math.abs(x.hargaBeli - x.harga)) + ').';
      var ket = el('span', { class: 'daftar-baris-ket', text: 'Dibeli ' + formatRupiah(x.hargaBeli) + per + ' pada ' + tanggalPendek(x.tanggal) +
        (x.pemasok ? ' dari ' + x.pemasok : '') + (x.oleh ? ', dicatat ' + x.oleh : '') + '. ' + beda });
      var pakai = tombol('Pakai ' + formatRupiah(x.hargaBeli), 'kedua');
      var abaikan = tombol('Abaikan', 'kedua');
      var baris = el('div', { class: 'daftar-baris peristiwa tetap harga-beli-baris' }, [
        el('span', { class: 'daftar-baris-isi' }, [
          el('a', { class: 'daftar-baris-judul tautan-item', href: hrefItem(x.nama), text: x.nama }),
          ket,
          el('span', { class: 'deret-tombol' }, [pakai, abaikan])
        ])
      ]);
      function selesai(teks) {
        berubah = true;
        baris.remove();
        toast(teks);
        if (!daftar.children.length) {
          if (lembarKini) lembarKini.tutup();
        }
      }
      function gagal(t, err) {
        aturTombolProses(t, false);
        if (tanganiSesiBerakhir(err)) return;
        tulisPesan(pesan, pesanGalat(err), 'masalah');
      }
      pakai.addEventListener('click', function () {
        tulisPesan(pesan, '');
        aturTombolProses(pakai, true, 'Menyimpan…');
        panggilApi('gantiHarga', { nama: x.nama, harga: x.hargaBeli, berlakuMulai: x.tanggal }).then(function () {
          selesai('Harga ' + x.nama + ' ' + formatRupiah(x.hargaBeli) + ' berlaku mulai ' + tanggalPendek(x.tanggal) + '.');
        }).catch(function (err) { gagal(pakai, err); });
      });
      abaikan.addEventListener('click', function () {
        tulisPesan(pesan, '');
        aturTombolProses(abaikan, true, 'Menyimpan…');
        panggilApi('abaikanHargaBeli', { nama: x.nama }).then(function () {
          selesai('Harga beli ' + x.nama + ' diabaikan.');
        }).catch(function (err) { gagal(abaikan, err); });
      });
      daftar.appendChild(baris);
    });
    bukaLembar({
      judul: p.judul,
      isi: [
        el('p', { class: 'kartu-teks', text: '"Pakai" menjadikan harga beli sebagai harga satuan mulai tanggal pembelian itu. ' +
          'Harga lama tetap dipakai untuk catatan sebelumnya. "Abaikan" menyembunyikannya sampai ada pembelian berikutnya.' }),
        daftar,
        pesan
      ],
      aksi: [{ teks: 'Tutup', jenis: 'kedua' }],
      // Dashboard dimuat ulang setelah lembar ditutup, supaya butir ini hilang atau berkurang (tidak jika pindah ke layar item).
      diTutup: function () { if (berubah && /^#\/dashboard/.test(location.hash) && segarkanLayar) segarkanLayar(); }
    });
  }

  /** Tujuan ketukan satu butir Perlu perhatian: { href } atau { klik }; null jika hanya keterangan. */
  function tujuanPerhatian(p, d) {
    var data = p.data || {};
    function riwayat(status) {
      return '#/riwayat?form=' + encodeURIComponent(data.formId || '') + '&status=' + status +
        '&dari=' + encodeURIComponent(data.dari || '') + '&sampai=' + encodeURIComponent(data.sampai || '');
    }
    switch (p.jenis) {
      case 'suhu': return { href: '#/suhu' };
      case 'minus':
      case 'bawahMinimum': return { klik: function () { bukaDaftarItemStock(p); } };
      case 'lewatMasaSimpan':
      case 'habisBesok': return { klik: function () {
        bukaLembar({ judul: p.judul, isi: barisMasaSimpan({ lewat: data.lewat || [], habisBesok: data.habisBesok || [] }),
          aksi: [{ teks: 'Tutup', jenis: 'kedua' }] });
      } };
      case 'dilaporkan': return { href: riwayat('dilaporkan') };
      case 'belumDiperiksa': return { href: riwayat('terkirim') };
      case 'resetPin':
      case 'terkunci': return { href: hrefStaff(data.nama, true) };
      case 'formBelum': return { href: '#/' };
      case 'jadwal': return { href: '#/pengaturan/outlet' };
      case 'opname': return { href: '#/opname' };
      case 'tanpaHarga': return { klik: function () { bukaNilaiStock(d.nilaiStock); } };
      case 'menu': return { href: '#/hpp/menu' };
      case 'hargaBeli': return { klik: function () { bukaHargaBeli(p); } };
      case 'penjualan': return { klik: function () {
        bukaCatatPenjualan({ tanggal: data.tanggal, selesai: function () { if (segarkanLayar) segarkanLayar(); } });
      } };
      default: return null;
    }
  }

  /** Ikon ubin di daftar Perlu perhatian (versi 1.7), menurut jenis butirnya. */
  var IKON_PERHATIAN = {
    suhu: 'termometer', minus: 'kotak', bawahMinimum: 'kotak', lewatMasaSimpan: 'jam', habisBesok: 'jam', sistem: 'segitiga',
    dilaporkan: 'bendera', resetPin: 'kunci', terkunci: 'kunci', jadwal: 'jam', opname: 'opname', formBelum: 'tiket', belumDiperiksa: 'centang',
    tanpaHarga: 'label', menu: 'resep', penjualan: 'label', hargaBeli: 'truk'
  };
  var KATA_TINGKAT = { masalah: 'Masalah', tinjau: 'Perlu ditinjau', menunggu: 'Menunggu' };

  /** Ubin ikon (tampilan Bagian 6, versi 1.7): ikon dalam kotak berwarna makna status; selalu disertai teks. */
  function ubinIkon(jenis, namaIkon) {
    return el('span', { class: 'ubin-ikon ubin-ikon-' + jenis, 'aria-hidden': 'true' }, ikon(namaIkon));
  }

  function daftarPerhatian(d) {
    var butir = d.perhatian || [];
    if (!butir.length) return kotakKosong('Tidak ada yang perlu perhatian. Form, suhu, dan stock dalam keadaan baik.', 'centang');
    return el('div', { class: 'daftar', role: 'group', 'aria-label': 'Perlu perhatian' }, butir.map(function (p) {
      var isi = el('span', { class: 'daftar-baris-isi' }, [
        el('span', { class: 'daftar-baris-judul' }, [el('span', { class: 'sr', text: (KATA_TINGKAT[p.tingkat] || '') + ': ' }), p.judul]),
        p.ket ? el('span', { class: 'daftar-baris-ket', text: p.ket }) : null
      ]);
      var awal = ubinIkon(p.tingkat, IKON_PERHATIAN[p.jenis] || 'seru');
      var tujuan = tujuanPerhatian(p, d);
      if (!tujuan) return el('div', { class: 'daftar-baris peristiwa tetap' }, [awal, isi]);
      if (tujuan.href) return el('a', { class: 'daftar-baris pemberitahuan', href: tujuan.href }, [awal, isi, ikon('kanan')]);
      return el('button', { type: 'button', class: 'daftar-baris pemberitahuan', 'aria-haspopup': 'dialog', onclick: tujuan.klik },
        [awal, isi, ikon('kanan')]);
    }));
  }

  /**
   * Kotak Nilai stock di kepala navy Dashboard (tampilan Bagian 4.7 dan 5.6, versi 1.7): nilai,
   * selisih karena perubahan harga bulan ini, dan item yang belum punya harga. Membuka lembar Nilai stock.
   */
  function kotakNilaiStock(d) {
    var r = d.ringkas || {};
    var n = d.nilaiStock || {};
    var tanpa = n.tanpaHarga ? n.tanpaHarga.length : 0;
    var sh = n.selisihHarga;
    return el('button', { type: 'button', class: 'kepala-nilai', 'aria-haspopup': 'dialog', onclick: function () { bukaNilaiStock(n); } }, [
      el('span', { class: 'kepala-nilai-label', text: 'Nilai stock' }),
      el('span', { class: 'kepala-nilai-angka', text: formatRupiah(r.nilaiStock || 0) }),
      sh && sh.item && sh.item.length
        ? el('span', { class: 'kepala-nilai-selisih', text: formatRupiahTanda(sh.total) + ' karena harga bulan ini' }) : null,
      el('span', { class: 'kepala-nilai-ket', text: tanpa ? tanpa + ' item belum punya harga' : 'Semua item punya harga' }),
      ikon('kanan')
    ]);
  }

  /** Cincin kemajuan kecil untuk ubin Form terisi: Lampu Pass di atas jalur Garis Halus (angkanya tertulis di samping). */
  function cincinKemajuan(lengkap, wajib) {
    var r = 18;
    var keliling = 2 * Math.PI * r;
    var bagian = wajib ? Math.min(1, lengkap / wajib) : 0;
    return svgEl('svg', { class: 'cincin', viewBox: '0 0 46 46', 'aria-hidden': 'true', focusable: 'false' }, [
      svgEl('circle', { class: 'cincin-jalur', cx: 23, cy: 23, r: r }),
      svgEl('circle', { class: 'cincin-isi', cx: 23, cy: 23, r: r, transform: 'rotate(-90 23 23)',
        'stroke-dasharray': (bagian * keliling).toFixed(2) + ' ' + keliling.toFixed(2) })
    ]);
  }

  /** Angka ringkas hari ini (tampilan Bagian 5.6): ubin berikon yang menggantung di tepi kepala navy. */
  function angkaRingkas(d) {
    var r = d.ringkas || {};
    function ubin(label, nilai, ket, namaIkon) {
      return el('div', { class: 'ubin' }, [
        el('span', { class: 'ubin-atas' }, [el('span', { class: 'ubin-label', text: label }), ikon(namaIkon)]),
        el('span', { class: 'ubin-nilai', text: nilai }),
        el('span', { class: 'ubin-ket', text: ket })
      ]);
    }
    var lengkap = r.formLengkap || 0;
    var wajib = r.formWajib || 0;
    return el('section', { class: 'angka-ringkas', 'aria-label': 'Angka ringkas hari ini' }, [
      el('div', { class: 'ubin ubin-lebar' }, [
        cincinKemajuan(lengkap, wajib),
        el('span', { class: 'ubin-isi' }, [
          el('span', { class: 'ubin-label', text: 'Form terisi' }),
          el('span', { class: 'ubin-nilai' }, [String(lengkap), el('small', { text: ' dari ' + wajib })]),
          el('span', { class: 'ubin-ket', text: 'hari ini' })
        ])
      ]),
      ubin('Belum diperiksa', String(r.belumDiperiksa || 0), 'isian, ' + BATAS_RIWAYAT_HARI + ' hari terakhir', 'centang'),
      ubin('Suhu di luar standar', String(r.suhuLuar || 0), 'pengecekan hari ini', 'termometer'),
      ubin('Di bawah stok minimum', String(r.bawahMinimum || 0), 'item', 'kotak'),
      ubin('Total waste', formatRupiah(r.wasteRp || 0), r.wasteCatatan ? r.wasteCatatan + ' catatan hari ini' : 'hari ini', 'sampah')
    ]);
  }

  function layarDashboard(k) {
    aturJudul('Dashboard');
    var penanda = el('span', { class: 'memperbarui', role: 'status' });
    var wadah = el('div', { class: 'dashboard' });
    var nilaiKepala = el('div');
    // Penanda "Memperbarui…" ikut di kepala, supaya ubin tetap menggantung tepat di tepinya.
    k.wadah.appendChild(el('div', { class: 'layar-isi kepala-gantung' }, [
      el('h1', { class: 'judul-layar', text: 'Dashboard' }),
      el('div', { class: 'kepala-ringkas' }, [nilaiKepala, penanda]),
      wadah
    ]));

    function gambar(d) {
      kosongkan(wadah);
      kosongkan(nilaiKepala).appendChild(kotakNilaiStock(d));
      wadah.appendChild(angkaRingkas(d));
      if (d.tanggal && d.tanggal !== tanggalIso(new Date())) {
        wadah.appendChild(el('p', { class: 'kolom-bantuan', text: 'Data ' + tanggalJudul(d.tanggal) + '.' }));
      }
      // Tombol Stock opname dengan tanggal opname terakhir di sampingnya (Tahap 8).
      wadah.appendChild(el('div', { class: 'dashboard-pintas' }, [
        el('div', { class: 'dashboard-opname' }, [
          el('a', { class: 'tombol tombol-kedua', href: '#/opname' }, el('span', { class: 'tombol-teks', text: 'Stock opname' })),
          d.opname && d.opname.lewat
            ? tandaStatus('tinjau', teksOpnameTerakhir(d.opname))
            : el('span', { class: 'kolom-bantuan', text: teksOpnameTerakhir(d.opname) })
        ]),
        // HPP dan food cost (tampilan Bagian 5.6 dan 5.10), dengan food cost bulan ini di sampingnya.
        el('div', { class: 'dashboard-opname' }, [
          el('a', { class: 'tombol tombol-kedua', href: '#/hpp' }, el('span', { class: 'tombol-teks', text: 'HPP dan food cost' })),
          d.hpp && d.hpp.foodCost != null && d.hpp.foodCost > d.hpp.target
            ? tandaStatus('tinjau', teksFoodCostDashboard(d.hpp))
            : el('span', { class: 'kolom-bantuan', text: teksFoodCostDashboard(d.hpp) })
        ])
      ]));
      wadah.appendChild(el('div', { class: 'dashboard-isi' }, [
        el('section', { class: 'dashboard-perhatian', 'aria-labelledby': 'judul-perhatian' }, [
          el('h2', { class: 'judul-bagian', id: 'judul-perhatian', text: 'Perlu perhatian' }),
          daftarPerhatian(d)
        ]),
        el('div', { class: 'dashboard-grafik' }, [grafikWaste(d.grafikWaste), grafikSuhu(d.grafikSuhu)])
      ]));
      if (d.alamatSheet) {
        wadah.appendChild(el('div', { class: 'dashboard-bawah' }, [
          el('a', { class: 'tombol tombol-kedua', href: d.alamatSheet, target: '_blank', rel: 'noopener' },
            el('span', { class: 'tombol-teks', text: 'Buka dashboard di Google Sheets' })),
          el('p', { class: 'kolom-bantuan', text: 'Grafik lengkap dan pilihan periode ada di sana. Hanya terbuka bagi akun Google yang diberi akses pemilik Sheet.' })
        ]));
      }
    }

    function kerangka() {
      kosongkan(wadah);
      var ubin = el('div', { class: 'angka-ringkas', 'aria-hidden': 'true' });
      for (var i = 0; i < 5; i++) ubin.appendChild(el('span', { class: 'ubin kerangka kerangka-ubin' + (i ? '' : ' ubin-lebar') }));
      wadah.appendChild(ubin);
      wadah.appendChild(kerangkaBaris(4));
    }

    function muat() {
      return muatData({
        kunciCache: 'dashboard',
        ambil: function () { return panggilApi('dashboard', { tanggal: tanggalIso(new Date()) }); },
        gambar: gambar,
        kerangka: kerangka,
        galat: function (pesan, cobaLagi) {
          kosongkan(wadah).appendChild(kotakGalat(pesan, cobaLagi));
        },
        penanda: penanda
      });
    }
    muat();
    segarkanLayar = muat;
  }


  /* =======================================================================
   * Tahap 8: Stock opname (khusus Pengelola; spesifikasi tampilan Bagian 5.8,
   * sistem Bagian 5.7) dan Daftar belanja (tampilan Bagian 5.9, sistem 9.2)
   * ===================================================================== */

  /** "Stock opname terakhir 9 hari lalu." atau "Belum ada stock opname." (tampilan Bagian 5.2). */
  function teksPengingatOpname(s) {
    if (!s || !s.terakhir) return 'Belum ada stock opname.';
    return 'Stock opname terakhir ' + (s.hariLalu === 0 ? 'hari ini' : s.hariLalu + ' hari lalu') + '.';
  }

  /** "Oktober 34,0% · target 35%", di samping tombol HPP dan food cost di Dashboard. */
  function teksFoodCostDashboard(h) {
    if (!h) return 'Food cost bulan ini';
    var bulan = NAMA_BULAN[Number(h.bulan.slice(5, 7)) - 1];
    return h.foodCost == null ? bulan + ': penjualan belum lengkap' : bulan + ' ' + formatPersen(h.foodCost) + ' · target ' + formatPersen(h.target);
  }

  /** "Terakhir 3 Okt (3 hari lalu)", di samping tombol Stock opname di Dashboard. */
  function teksOpnameTerakhir(s) {
    if (!s || !s.terakhir) return 'Belum ada stock opname';
    var lalu = s.hariLalu === 0 ? 'hari ini' : (s.hariLalu === 1 ? 'kemarin' : s.hariLalu + ' hari lalu');
    return 'Terakhir ' + tanggalPendek(s.terakhir.tanggal) + ' (' + lalu + ')';
  }

  /** Beranda Pengelola: pengingat jika opname terakhir sudah lewat jadwal. */
  function barisPengingatOpname(s) {
    if (!s || !s.lewat) return null;
    return el('div', { class: 'daftar', role: 'group', 'aria-label': 'Pengingat stock opname' },
      el('a', { class: 'daftar-baris pemberitahuan', href: '#/opname' }, [
        el('span', { class: 'daftar-baris-isi' }, [
          tandaStatus('tinjau', teksPengingatOpname(s)),
          el('span', { class: 'daftar-baris-ket', text: 'Jadwal ' + s.jadwal + '. Ketuk untuk membuka Stock opname.' })
        ]),
        ikon('kanan')
      ]));
  }

  /** Pesan siap pakai (ikon dan warna seperti tulisPesan). */
  function pesanJadi(teks, jenis) {
    var p = el('p', { class: 'pesan-formulir', role: jenis === 'masalah' ? 'alert' : 'status' });
    tulisPesan(p, teks, jenis);
    return p;
  }

  /** "+1,5 kg" / "−0,5 kg" */
  function teksSelisih(n, satuan) {
    return (n > 0 ? '+' : '') + formatAngka(n) + (satuan ? ' ' + satuan : '');
  }

  /**
   * Daftar hasil opname: [{ item, satuan, tercatat, hitung, selisih, nilai }].
   * Laptop/desktop: tabel; HP/tablet: satu baris per item. Selisih bukan nol
   * memakai tanda Perlu ditinjau.
   */
  function daftarHasilOpname(baris, judul) {
    if (window.matchMedia(DESKTOP).matches) {
      return el('div', { class: 'tabel-bingkai' }, el('table', { class: 'tabel tabel-opname' }, [
        el('caption', { class: 'sr', text: judul }),
        el('thead', {}, el('tr', {}, ['Item', 'Tercatat', 'Hitung', 'Selisih', 'Nilai selisih'].map(function (j, i) {
          return el('th', { scope: 'col', class: i ? 'angka' : null, text: j });
        }))),
        el('tbody', {}, baris.map(function (b) {
          return el('tr', {}, [
            el('th', { scope: 'row', text: b.item }),
            el('td', { class: 'angka' }, angkaSatuan(b.tercatat, b.satuan)),
            el('td', { class: 'angka' }, angkaSatuan(b.hitung, b.satuan)),
            el('td', { class: 'angka' }, b.selisih ? tandaStatus('tinjau', teksSelisih(b.selisih, b.satuan)) : el('span', { class: 'otomatis', text: 'Sesuai' })),
            el('td', { class: 'angka' }, el('span', { class: 'angka-satuan', text: b.selisih ? formatRupiah(b.nilai) : '–' }))
          ]);
        }))
      ]));
    }
    return el('div', { class: 'daftar', role: 'group', 'aria-label': judul }, baris.map(function (b) {
      var ket = 'Tercatat ' + formatAngka(b.tercatat) + ' ' + b.satuan + ', hitung ' + formatAngka(b.hitung) + ' ' + b.satuan + '.';
      if (b.selisih) ket += ' Nilai ' + (b.nilai == null ? 'belum bisa dihitung: harga belum diisi' : formatRupiah(b.nilai)) + '.';
      return el('div', { class: 'daftar-baris peristiwa tetap' }, el('span', { class: 'daftar-baris-isi' }, [
        el('span', { class: 'opname-hasil-judul' }, [
          el('span', { class: 'daftar-baris-judul', text: b.item }),
          b.selisih ? tandaStatus('tinjau', 'Selisih ' + teksSelisih(b.selisih, b.satuan)) : tandaStatus('baik', 'Sesuai')
        ]),
        el('span', { class: 'daftar-baris-ket', text: ket })
      ]));
    }));
  }

  /** Angka ringkas opname: item dihitung, berselisih, total nilai selisih. */
  function ringkasOpname(jumlah, berselisih, total, dari) {
    return el('dl', { class: 'opname-ringkas' }, [
      el('div', {}, [el('dt', { text: 'Item dihitung' }), el('dd', { text: jumlah + (dari ? ' dari ' + dari : '') })]),
      el('div', {}, [el('dt', { text: 'Item berselisih' }), el('dd', { text: String(berselisih) })]),
      el('div', {}, [el('dt', { text: 'Total nilai selisih' }), el('dd', { text: formatRupiah(total) })])
    ]);
  }

  /** Rincian satu opname (dari Riwayat): semua item yang dihitung dan tombol laporan selisih. */
  function bukaDetailOpname(sid) {
    var wadah = el('div', { class: 'opname-detail' }, kerangkaBaris(3));
    var unduh = unduhPdf({ aksi: 'unduhPdfOpname', minta: function () { return { submissionId: sid }; }, teks: 'Unduh laporan selisih', jenis: 'kedua' });
    var lembar = bukaLembar({ judul: 'Stock opname', isi: [wadah], lebar: true, aksi: [{ teks: 'Tutup', jenis: 'kedua' }] });
    panggilApi('detailOpname', { submissionId: sid }).then(function (o) {
      if (lembar !== lembarKini) return;
      kosongkan(wadah);
      wadah.appendChild(el('p', { class: 'kartu-teks', text: tanggalJudul(o.tanggal) + ' · ' + o.oleh + (o.waktu ? ', ' + jam(o.waktu) : '') }));
      wadah.appendChild(ringkasOpname(o.jumlah, o.berselisih, o.totalNilai));
      if (o.tanpaHarga) wadah.appendChild(el('p', { class: 'kolom-bantuan', text: o.tanpaHarga + ' item berselisih belum punya harga, tidak ikut total nilai.' }));
      wadah.appendChild(daftarHasilOpname(o.baris, 'Hasil hitung'));
      wadah.appendChild(el('div', { class: 'deret-tombol' }, [unduh.tombol]));
      wadah.appendChild(unduh.pesan);
    }).catch(function (err) {
      if (lembar !== lembarKini) return;
      if (tanganiSesiBerakhir(err)) return;
      kosongkan(wadah).appendChild(kotakGalat(pesanGalat(err), function () { bukaDetailOpname(sid); }));
    });
  }

  function bacaDraftOpname() {
    var d = Draft.baca('opname');
    var data = d && d.data ? d.data : {};
    return {
      kategori: typeof data.kategori === 'string' ? data.kategori : '',
      hitung: data.hitung && typeof data.hitung === 'object' ? data.hitung : {},
      sid: data.sid || '',
      waktu: d ? d.waktu : null
    };
  }

  /**
   * Layar Stock opname (#/opname, dari Dashboard). Tiga keadaan: hitung (daftar
   * item dengan stock tercatat dan kolom Hitung; selisih muncul saat diketik),
   * ringkasan (item berselisih dan total nilainya, "Simpan opname"), selesai
   * ("Opname tersimpan. 3 item diluruskan." dan "Unduh laporan selisih").
   * Hitungan tersimpan sebagai draft per pengguna; menyimpan butuh sinyal.
   * Selisih yang disimpan dihitung server dari stock saat disimpan.
   */
  function layarOpname(k) {
    aturJudul('Stock opname');
    var hariIni = tanggalIso(new Date());
    var draft = bacaDraftOpname();
    var data = null;
    var tahap = 'hitung';
    var mediaDesktop = window.matchMedia(DESKTOP);

    var catatanDraft = el('p', { class: 'catatan-draft', 'aria-live': 'polite' });
    var penanda = el('span', { class: 'memperbarui', role: 'status' });
    var infoTerakhir = el('p', { class: 'kolom-bantuan' });
    var pilihKategori = el('select', { class: 'isian', id: 'opname-kategori' });
    var wadahItem = el('div');
    var pesan = el('p', { class: 'pesan-formulir', role: 'alert' });
    var penghitung = el('span', { class: 'penghitung', 'aria-live': 'polite' });
    var tombolLanjut = tombol('Lanjut', 'utama');

    var isiHitung = el('div', {}, [
      catatanDraft,
      el('section', { class: 'kartu kotak-info', 'aria-label': 'Kotak info' }, [
        el('div', { class: 'kolom' }, [el('label', { class: 'kolom-label', for: 'opname-kategori', text: 'Kategori' }), pilihKategori]),
        el('div', { class: 'kolom' }, [el('span', { class: 'kolom-label', text: 'Tanggal' }), el('p', { class: 'opname-tanggal', text: tanggalJudul(hariIni) })]),
        el('div', { class: 'lebar-penuh' }, [
          penanda,
          infoTerakhir,
          el('p', { class: 'kolom-bantuan', text: 'Hitung sebelum opening atau setelah closing, saat tidak ada barang bergerak. ' +
            'Item yang dikosongkan tidak dihitung dan stock-nya tidak diubah.' })
        ])
      ]),
      wadahItem,
      pesan,
      el('div', { class: 'bilah-kirim' }, [penghitung, tombolLanjut])
    ]);
    var isiLain = el('div', { hidden: true });
    k.wadah.appendChild(el('div', { class: 'layar-isi layar-form' }, [
      tautanKembali('Dashboard', '#/dashboard'),
      el('h1', { class: 'judul-layar', text: 'Stock opname' }),
      isiHitung,
      isiLain
    ]));

    function adaHitung() {
      return Object.keys(draft.hitung).some(function (n) { return String(draft.hitung[n] || '').trim() !== ''; });
    }
    function simpanDraft() {
      var waktu = Draft.simpan('opname', { kategori: draft.kategori, hitung: draft.hitung, sid: draft.sid });
      catatanDraft.textContent = adaHitung() && waktu ? 'Draft tersimpan ' + jam(new Date(waktu).toISOString()) : '';
    }
    if (draft.waktu && adaHitung()) catatanDraft.textContent = 'Draft tersimpan ' + jam(new Date(draft.waktu).toISOString());

    function itemTampil() {
      return (data && data.item || []).filter(function (it) { return !draft.kategori || it.kategori === draft.kategori; });
    }

    /** Isian Hitung satu item: { kosong, salah, angka, selisih, nilai }. */
    function nilaiHitung(it) {
      var n = bacaAngka(draft.hitung[it.nama.toLowerCase()]);
      var hasil = { kosong: n === null, salah: n !== null && isNaN(n), angka: n, selisih: null, nilai: null };
      if (!hasil.kosong && !hasil.salah) {
        hasil.selisih = bulat3(n - it.tercatat);
        hasil.nilai = it.harga == null ? null : Math.round(hasil.selisih * it.harga);
      }
      return hasil;
    }

    function dihitung() {
      return itemTampil().filter(function (it) { return !nilaiHitung(it).kosong; });
    }

    function perbaruiPenghitung() {
      penghitung.textContent = dihitung().length + ' dari ' + itemTampil().length + ' dihitung';
    }

    function tandaSelisih(h, satuan, ringkas) {
      if (h.kosong) return null;
      if (h.salah) {
        return ringkas ? tandaStatus('masalah', 'Angka salah') : pesanJadi('Isi angka 0 atau lebih, misalnya 2,5.', 'masalah');
      }
      if (!h.selisih) return tandaStatus('baik', 'Sesuai');
      return tandaStatus('tinjau', (ringkas ? '' : 'Selisih ') + teksSelisih(h.selisih, satuan));
    }

    /** Satu item: kartu (HP dan tablet) atau baris tabel (laptop dan desktop). */
    function buatItem(it, nomor, modeTabel) {
      var kunci = it.nama.toLowerCase();
      var input = el('input', {
        class: 'isian isian-angka',
        type: 'text',
        inputmode: 'decimal',
        autocomplete: 'off',
        id: 'hitung-' + nomor,
        'data-kunci': kunci,
        'aria-label': modeTabel ? 'Hitung ' + it.nama : null
      });
      input.value = draft.hitung[kunci] || '';
      var wadahSelisih = el('span', { class: 'wadah-peringatan' });
      var kartu = null;
      function perbarui() {
        var h = nilaiHitung(it);
        input.setAttribute('aria-invalid', h.salah ? 'true' : 'false');
        kosongkan(wadahSelisih);
        var t = tandaSelisih(h, it.satuan, modeTabel);
        if (t) wadahSelisih.appendChild(t);
        if (kartu) kartu.classList.toggle('dihitung', !h.kosong);
        perbaruiPenghitung();
      }
      input.addEventListener('input', function () {
        draft.hitung[kunci] = input.value;
        if (!input.value.trim()) delete draft.hitung[kunci];
        simpanDraft();
        tulisPesan(pesan, '');
        perbarui();
      });
      var hasil;
      if (modeTabel) {
        hasil = el('tr', {}, [
          el('td', { class: 'angka', text: String(nomor) }),
          el('td', { class: 'nama-item' }, el('span', { class: 'daftar-baris-judul', text: it.nama })),
          el('td', { class: 'angka otomatis' }, angkaSatuan(it.tercatat)),
          el('td', {}, input),
          el('td', { class: 'angka' }, wadahSelisih),
          el('td', { class: 'otomatis', text: it.satuan })
        ]);
      } else {
        kartu = el('article', { class: 'kartu-item kartu-opname', 'aria-label': it.nama }, [
          el('div', { class: 'kartu-item-kepala' }, [
            el('h3', { class: 'kartu-item-nama', text: it.nama }),
            el('span', { class: 'kartu-item-satuan', text: it.satuan })
          ]),
          el('div', { class: 'opname-baris' }, [
            el('p', { class: 'otomatis opname-tercatat' }, ['Tercatat ', angkaSatuan(it.tercatat)]),
            el('div', { class: 'opname-hitung' }, [
              el('label', { class: 'kolom-label', for: input.id, text: 'Hitung' }),
              input
            ])
          ]),
          wadahSelisih
        ]);
        hasil = kartu;
      }
      perbarui();
      return hasil;
    }

    /** Menggambar ulang daftar item; kolom yang sedang diketik tetap aktif. */
    function gambarItem() {
      var aktif = document.activeElement;
      var kunciAktif = aktif && aktif.getAttribute ? aktif.getAttribute('data-kunci') : null;
      var posisi = kunciAktif && typeof aktif.selectionStart === 'number' ? aktif.selectionStart : null;
      kosongkan(wadahItem);
      var semua = itemTampil();
      if (!semua.length) {
        wadahItem.appendChild(kotakKosong(data && data.item && data.item.length
          ? 'Belum ada item aktif di kategori ini.'
          : 'Belum ada item aktif. Tambahkan di Pengaturan → Item.'));
        perbaruiPenghitung();
        return;
      }
      var kelompok = [];
      semua.forEach(function (it) {
        var g = kelompok[kelompok.length - 1];
        if (!g || g.nama !== it.kategori) kelompok.push(g = { nama: it.kategori, item: [] });
        g.item.push(it);
      });
      var nomor = 0;
      kelompok.forEach(function (g) {
        var bagian = el('section', { class: 'kelompok opname-kelompok', 'aria-label': g.nama });
        if (!draft.kategori) bagian.appendChild(el('h2', { class: 'kelompok-judul', text: g.nama }));
        if (mediaDesktop.matches) {
          var badan = el('tbody');
          g.item.forEach(function (it) { badan.appendChild(buatItem(it, ++nomor, true)); });
          bagian.appendChild(el('div', { class: 'tabel-bingkai tabel-isian-bingkai' }, el('table', { class: 'tabel tabel-isian tabel-hitung' }, [
            el('thead', {}, el('tr', {}, ['No', 'Nama Item', 'Tercatat', 'Hitung', 'Selisih', 'Satuan'].map(function (j, i) {
              return el('th', { scope: 'col', class: [0, 2, 4].indexOf(i) >= 0 ? 'angka' : null, text: j });
            }))),
            badan
          ])));
        } else {
          var grid = el('div', { class: 'grid-item' });
          g.item.forEach(function (it) { grid.appendChild(buatItem(it, ++nomor, false)); });
          bagian.appendChild(grid);
        }
        wadahItem.appendChild(bagian);
      });
      perbaruiPenghitung();
      if (kunciAktif) {
        var baru = wadahItem.querySelector('[data-kunci="' + kunciAktif.replace(/"/g, '\\"') + '"]');
        if (baru) {
          baru.focus({ preventScroll: true });
          if (posisi != null && baru.setSelectionRange) {
            try { baru.setSelectionRange(posisi, posisi); } catch (err) { /* kolom tanpa kursor */ }
          }
        }
      }
    }

    function gambar(d) {
      data = d;
      kosongkan(pilihKategori);
      pilihKategori.appendChild(el('option', { value: '', text: 'Semua kategori' }));
      (d.kategori || []).forEach(function (n) { pilihKategori.appendChild(el('option', { value: n, text: n })); });
      if (draft.kategori && (d.kategori || []).indexOf(draft.kategori) < 0) draft.kategori = '';
      pilihKategori.value = draft.kategori;
      infoTerakhir.textContent = d.status && d.status.terakhir
        ? 'Opname terakhir ' + tanggalJudul(d.status.terakhir.tanggal) + ', ' + d.status.terakhir.oleh + '. Jadwal ' + d.status.jadwal + '.'
        : 'Belum ada stock opname. Jadwal ' + (d.status ? d.status.jadwal : 'mingguan') + '.';
      if (tahap === 'hitung') gambarItem();
    }

    pilihKategori.addEventListener('change', function () {
      draft.kategori = pilihKategori.value;
      simpanDraft();
      tulisPesan(pesan, '');
      gambarItem();
    });

    function tampilkan(baru) {
      tahap = baru;
      isiHitung.hidden = tahap !== 'hitung';
      isiLain.hidden = tahap === 'hitung';
      window.scrollTo(0, 0);
      if (tahap === 'hitung') gambarItem();
    }

    tombolLanjut.addEventListener('click', function () {
      if (!data) return;
      tulisPesan(pesan, '');
      var salah = itemTampil().filter(function (it) { return nilaiHitung(it).salah; })[0];
      if (salah) {
        tulisPesan(pesan, 'Periksa angka Hitung ' + salah.nama + '. Isi angka 0 atau lebih, misalnya 2,5.', 'masalah');
        var kolom = wadahItem.querySelector('[data-kunci="' + salah.nama.toLowerCase().replace(/"/g, '\\"') + '"]');
        if (kolom) kolom.focus();
        return;
      }
      if (!dihitung().length) {
        tulisPesan(pesan, 'Isi hasil hitung minimal untuk satu item.', 'masalah');
        return;
      }
      gambarRingkasan();
      tampilkan('ringkasan');
    });

    /** Ringkasan sebelum disimpan (perkiraan dari stock tercatat saat layar dibuka). */
    function gambarRingkasan() {
      kosongkan(isiLain);
      var semua = dihitung();
      var berselisih = [];
      var total = 0;
      var tanpaHarga = 0;
      semua.forEach(function (it) {
        var h = nilaiHitung(it);
        if (!h.selisih) return;
        berselisih.push({ item: it.nama, satuan: it.satuan, tercatat: it.tercatat, hitung: h.angka, selisih: h.selisih, nilai: h.nilai });
        if (h.nilai == null) tanpaHarga++;
        else total += h.nilai;
      });
      var pesanSimpan = el('p', { class: 'pesan-formulir', role: 'alert' });
      var tombolKembali = tombol('Kembali', 'kedua');
      var tombolSimpan = tombol('Simpan opname', 'utama');
      tombolKembali.addEventListener('click', function () { tampilkan('hitung'); });
      tombolSimpan.addEventListener('click', function () { simpan(tombolSimpan, pesanSimpan); });
      isiLain.appendChild(el('section', { class: 'kartu opname-kartu', 'aria-labelledby': 'judul-ringkasan-opname' }, [
        el('h2', { class: 'kartu-judul', id: 'judul-ringkasan-opname', text: 'Ringkasan opname' }),
        el('p', { class: 'kartu-teks', text: tanggalJudul(hariIni) + (draft.kategori ? ' · Kategori ' + draft.kategori : ' · Semua kategori') }),
        ringkasOpname(semua.length, berselisih.length, total, itemTampil().length),
        berselisih.length
          ? daftarHasilOpname(berselisih, 'Item berselisih')
          : el('p', {}, [tandaStatus('baik', 'Sesuai'), ' ', el('span', { text: 'Semua item yang dihitung sama dengan stock tercatat.' })]),
        tanpaHarga ? el('p', { class: 'kolom-bantuan', text: tanpaHarga + ' item berselisih belum punya harga, tidak ikut total nilai.' }) : null,
        el('p', { class: 'kolom-bantuan', text: 'Saat disimpan, selisih dihitung lagi dari stock tercatat saat itu. ' +
          'Item yang berselisih diluruskan dengan penyesuaian beralasan Stock opname.' }),
        pesanSimpan,
        el('div', { class: 'deret-tombol opname-aksi' }, [tombolKembali, tombolSimpan])
      ]));
    }

    function simpan(t, wadahPesan) {
      if (t.disabled) return;
      tulisPesan(wadahPesan, '');
      if (navigator.onLine === false) {
        tulisPesan(wadahPesan, 'Tidak ada sinyal. Hitungan tetap tersimpan di HP. Simpan lagi saat ada sinyal.', 'masalah');
        return;
      }
      if (!draft.sid) {
        draft.sid = buatId();
        simpanDraft();
      }
      var awal = {};
      itemTampil().forEach(function (it) { awal[it.nama.toLowerCase()] = it.tercatat; });
      var baris = dihitung().map(function (it) { return { item: it.nama, hitung: nilaiHitung(it).angka }; });
      aturTombolProses(t, true, 'Menyimpan…');
      jagaProses(panggilApi('simpanOpname', { submissionId: draft.sid, tanggal: hariIni, waktuPerangkat: new Date().toISOString(), baris: baris }))
        .then(function (h) {
          aturTombolProses(t, false);
          Draft.hapus('opname');
          draft = { kategori: draft.kategori, hitung: {}, sid: '', waktu: null };
          catatanDraft.textContent = '';
          gambarSelesai(h, awal);
          tampilkan('selesai');
          toast('Opname tersimpan.');
          muat();
        })
        .catch(function (err) {
          aturTombolProses(t, false);
          if (tanganiSesiBerakhir(err)) return;
          tulisPesan(wadahPesan, err && err.jaringan
            ? 'Opname belum tersimpan: ' + pesanGalat(err) + ' Hitungan tetap tersimpan di HP.'
            : pesanGalat(err), 'masalah');
        });
    }

    /** Sesudah disimpan: hasil dari server (selisih terhadap stock saat disimpan). */
    function gambarSelesai(o, awal) {
      kosongkan(isiLain);
      var berselisih = o.baris.filter(function (b) { return b.selisih; });
      var berubah = o.baris.filter(function (b) {
        var a = awal[b.item.toLowerCase()];
        return a != null && bulat3(a) !== bulat3(b.tercatat);
      });
      var unduh = unduhPdf({ aksi: 'unduhPdfOpname', minta: function () { return { submissionId: o.id }; }, teks: 'Unduh laporan selisih' });
      isiLain.appendChild(el('section', { class: 'kartu opname-kartu', 'aria-labelledby': 'judul-selesai-opname' }, [
        el('h2', { class: 'kartu-judul', id: 'judul-selesai-opname', text: 'Opname tersimpan' }),
        pesanJadi('Opname tersimpan. ' + (berselisih.length ? berselisih.length + ' item diluruskan.' : 'Semua item sesuai, tidak ada yang diluruskan.'), 'baik'),
        berubah.length ? pesanJadi('Stock tercatat ' + berubah.map(function (b) {
          return b.item + ' berubah sejak layar dibuka (' + formatAngka(awal[b.item.toLowerCase()]) + ' → ' + formatAngka(b.tercatat) + ' ' + b.satuan + ')';
        }).join(', ') + '. Selisih dihitung dari stock saat disimpan.', 'info') : null,
        ringkasOpname(o.jumlah, o.berselisih, o.totalNilai),
        berselisih.length ? daftarHasilOpname(berselisih, 'Item yang diluruskan') : null,
        o.tanpaHarga ? el('p', { class: 'kolom-bantuan', text: o.tanpaHarga + ' item berselisih belum punya harga, tidak ikut total nilai.' }) : null,
        el('div', { class: 'deret-tombol opname-aksi' }, [
          unduh.tombol,
          el('a', { class: 'tombol tombol-kedua', href: '#/dashboard' }, el('span', { class: 'tombol-teks', text: 'Kembali ke Dashboard' }))
        ]),
        unduh.pesan
      ]));
    }

    function muat() {
      return muatData({
        kunciCache: 'opname',
        ambil: function () { return panggilApi('formOpname', { tanggal: hariIni }); },
        gambar: gambar,
        kerangka: function () { kosongkan(wadahItem).appendChild(kerangkaBaris(4)); },
        galat: function (teks, cobaLagi) { kosongkan(wadahItem).appendChild(kotakGalat(teks, cobaLagi)); },
        penanda: penanda
      });
    }

    function gantiSusunan() {
      if (data && tahap === 'hitung') gambarItem();
    }
    if (mediaDesktop.addEventListener) mediaDesktop.addEventListener('change', gantiSusunan);
    else if (mediaDesktop.addListener) mediaDesktop.addListener(gantiSusunan);
    pembersihLayar.push(function () {
      if (mediaDesktop.removeEventListener) mediaDesktop.removeEventListener('change', gantiSusunan);
      else if (mediaDesktop.removeListener) mediaDesktop.removeListener(gantiSusunan);
    });

    muat();
    segarkanLayar = function () {
      if (tahap === 'hitung') return muat();
      return Promise.resolve();
    };
  }

  /** Angka untuk kolom isian: "2,5" (tanpa pemisah ribuan, karena titik dibaca sebagai koma desimal). */
  function teksIsianAngka(n) {
    return n == null ? '' : String(bulat3(n)).replace('.', ',');
  }

  /**
   * Kartu Daftar belanja di menu Laporan (Pengelola; tampilan Bagian 5.9):
   * item di bawah stok minimum per kategori, kolom Order terisi saran (dalam
   * satuan besar jika item punya), bisa diubah sebelum diunduh. Perubahan hanya
   * untuk cetakan: disimpan di memori layar saja dan dikirim bersama permintaan PDF.
   */
  function kartuDaftarBelanja() {
    var order = {};
    var data = null;
    var wadah = el('div', { class: 'belanja' });
    var catatan = el('p', { class: 'kolom-bantuan', text: 'Perubahan di sini hanya untuk cetakan.' });
    var unduh = unduhPdf({ aksi: 'unduhPdfBelanja', minta: function () { return { order: order }; } });
    var kartu = el('section', { class: 'kartu laporan-kartu', 'aria-labelledby': 'judul-belanja' }, [
      el('h2', { class: 'kartu-judul', id: 'judul-belanja', text: 'Daftar belanja' }),
      wadah,
      catatan,
      el('div', { class: 'deret-tombol laporan-aksi' }, [unduh.tombol]),
      unduh.pesan
    ]);

    function barisItem(it, nomor) {
      var satuanOrder = it.satuanBesar && it.isiSatuanBesar > 0 ? it.satuanBesar : it.satuan;
      var input = el('input', {
        class: 'isian isian-angka',
        type: 'text',
        inputmode: 'decimal',
        autocomplete: 'off',
        id: 'order-' + nomor,
        'aria-describedby': 'order-ket-' + nomor
      });
      input.value = Object.prototype.hasOwnProperty.call(order, it.nama) ? order[it.nama] : (it.saran ? teksIsianAngka(it.saran.jumlah) : '');
      var ket = el('span', { class: 'konversi', id: 'order-ket-' + nomor });
      function perbarui() {
        var n = bacaAngka(input.value);
        input.setAttribute('aria-invalid', n !== null && isNaN(n) ? 'true' : 'false');
        if (n !== null && isNaN(n)) ket.textContent = 'Isi angka, misalnya 2.';
        else if (n !== null && satuanOrder !== it.satuan) ket.textContent = '= ' + formatAngka(n * it.isiSatuanBesar) + ' ' + it.satuan;
        else if (n === null) ket.textContent = it.saran ? 'Kosong: dicetak tanpa jumlah.' : 'Tanpa saran: stok maksimum kosong.';
        else ket.textContent = '';
      }
      input.addEventListener('input', function () {
        order[it.nama] = input.value;
        unduh.reset();
        perbarui();
      });
      perbarui();
      var info = 'Stock ' + formatAngka(it.stock) + ' ' + it.satuan + ' · minimum ' + formatAngka(it.stokMin) + ' ' + it.satuan;
      return el('div', { class: 'daftar-baris peristiwa tetap belanja-baris' }, [
        el('span', { class: 'daftar-baris-isi' }, [
          el('span', { class: 'daftar-baris-judul', text: it.nama }),
          el('span', { class: 'daftar-baris-ket' + (it.stock < 0 ? ' nilai-masalah' : ''), text: info }),
          el('span', { class: 'daftar-baris-ket', text: it.saran ? 'Saran ' + it.saran.teks : 'Tanpa saran: stok maksimum kosong' })
        ]),
        el('div', { class: 'belanja-order' }, [
          el('label', { class: 'kolom-label', for: input.id, text: 'Order' }),
          el('div', { class: 'baris-angka' }, [input, el('span', { class: 'satuan-tetap', text: satuanOrder })]),
          ket
        ])
      ]);
    }

    function gambar(d) {
      data = d;
      kosongkan(wadah);
      unduh.reset();
      // Jumlah yang diubah untuk item yang tidak ada lagi di daftar dibuang.
      var ada = {};
      (d.kategori || []).forEach(function (g) { g.item.forEach(function (it) { ada[it.nama] = true; }); });
      Object.keys(order).forEach(function (n) { if (!ada[n]) delete order[n]; });
      unduh.tombol.disabled = !d.jumlah;
      catatan.hidden = !d.jumlah;
      if (!d.jumlah) {
        wadah.appendChild(kotakKosong('Semua stock di atas batas minimum.', 'centang'));
        return;
      }
      wadah.appendChild(el('p', { class: 'kartu-teks', text: d.jumlah + ' item di bawah stok minimum. Saran order = stok maksimum − stock akhir, ' +
        'dibulatkan ke atas ke satuan besar.' }));
      var nomor = 0;
      d.kategori.forEach(function (g) {
        wadah.appendChild(el('h3', { class: 'judul-sub', text: g.nama }));
        wadah.appendChild(el('div', { class: 'daftar', role: 'group', 'aria-label': g.nama }, g.item.map(function (it) {
          return barisItem(it, ++nomor);
        })));
      });
    }

    unduh.tombol.disabled = true;
    catatan.hidden = true;
    muatData({
      kunciCache: 'belanja',
      ambil: function () { return panggilApi('daftarBelanja'); },
      gambar: gambar,
      kerangka: function () { kosongkan(wadah).appendChild(kerangkaBaris(2)); },
      galat: function (teks, cobaLagi) { kosongkan(wadah).appendChild(kotakGalat(teks, cobaLagi)); }
    });
    return kartu;
  }

  /** Jumlah bulan yang bisa dipilih untuk rekap bulanan (bulan berjalan dan 23 bulan sebelumnya). */
  var BULAN_REKAP = 24;

  /**
   * Kartu Rekap bulanan di menu Laporan (Pengelola; tampilan Bagian 5.5,
   * sistem Bagian 9.3): pilih bulan, lalu "Unduh PDF" lewat unduhPdf bersama
   * (aturan iPhone sama). Nilai awal bulan lalu, karena itulah rekap yang
   * dikirim tiap tanggal 1. Pilihan tersimpan per pengguna (cache:rekap-pilihan).
   */
  function kartuRekapBulanan() {
    var kini = tanggalIso(new Date()).slice(0, 7);
    var bulan = [];
    var th = Number(kini.slice(0, 4));
    var bl = Number(kini.slice(5, 7));
    for (var i = 0; i < BULAN_REKAP; i++) {
      bulan.push(th + '-' + duaAngka(bl));
      bl--;
      if (!bl) { bl = 12; th--; }
    }
    var simpanan = Cache.baca('rekap-pilihan');
    var pilih = simpanan && simpanan.data && bulan.indexOf(simpanan.data.bulan) >= 0 ? simpanan.data.bulan : bulan[1];
    var pilihBulan = el('select', { class: 'isian', id: 'rekap-bulan' }, bulan.map(function (b, n) {
      var nama = NAMA_BULAN[Number(b.slice(5, 7)) - 1] + ' ' + b.slice(0, 4);
      return el('option', { value: b, text: n === 0 ? nama + ' (bulan berjalan)' : nama });
    }));
    pilihBulan.value = pilih;
    var unduh = unduhPdf({ aksi: 'unduhPdfRekap', minta: function () { return { bulan: pilihBulan.value }; } });
    pilihBulan.addEventListener('change', function () {
      Cache.tulis('rekap-pilihan', { bulan: pilihBulan.value });
      unduh.reset();
    });
    return el('section', { class: 'kartu laporan-kartu', 'aria-labelledby': 'judul-rekap' }, [
      el('h2', { class: 'kartu-judul', id: 'judul-rekap', text: 'Rekap bulanan' }),
      el('p', { class: 'kartu-teks', text: 'Stock, stock opname, waste, prep, suhu, dan kepatuhan selama satu bulan. ' +
        'Rekap bulan lalu juga dikirim ke penerima email tiap tanggal 1.' }),
      el('div', { class: 'kolom' }, [
        el('label', { class: 'kolom-label', for: 'rekap-bulan', text: 'Bulan' }),
        pilihBulan
      ]),
      el('div', { class: 'deret-tombol laporan-aksi' }, [unduh.tombol]),
      unduh.pesan
    ]);
  }

  /* =======================================================================
   * Pengaturan (khusus Pengelola; spesifikasi tampilan Bagian 5.7)
   * ===================================================================== */

  function tautanKembali(teks, href) {
    return el('a', { class: 'tautan-kembali', href: href }, [ikon('kiri'), el('span', { text: teks })]);
  }

  function layarPengaturan(k) {
    aturJudul('Pengaturan');
    var beranda = Cache.baca('beranda');
    var jumlahReset = beranda && beranda.data.permintaanReset ? beranda.data.permintaanReset.length : 0;
    k.wadah.appendChild(el('div', { class: 'layar-isi layar-sempit' }, [
      el('h1', { class: 'judul-layar', text: 'Pengaturan' }),
      el('nav', { class: 'daftar', 'aria-label': 'Bagian pengaturan' }, [
        el('a', { class: 'daftar-baris', href: '#/pengaturan/staff' }, [
          ikon('staff'),
          el('span', { class: 'daftar-baris-isi' }, [
            el('span', { class: 'daftar-baris-judul', text: 'Staff dan PIN' }),
            el('span', { class: 'daftar-baris-ket', text: 'Tambah staff, ubah role, buat atau reset PIN, nonaktifkan, hapus.' }),
            jumlahReset ? tandaStatus('tinjau', jumlahReset + ' permintaan reset PIN') : null
          ]),
          ikon('kanan')
        ]),
        el('a', { class: 'daftar-baris', href: '#/pengaturan/penerima' }, [
          ikon('email'),
          el('span', { class: 'daftar-baris-isi' }, [
            el('span', { class: 'daftar-baris-judul', text: 'Penerima email' }),
            el('span', { class: 'daftar-baris-ket', text: 'Alamat yang menerima laporan harian.' })
          ]),
          ikon('kanan')
        ]),
        el('a', { class: 'daftar-baris', href: '#/pengaturan/form' }, [
          ikon('tiket'),
          el('span', { class: 'daftar-baris-isi' }, [
            el('span', { class: 'daftar-baris-judul', text: 'Form' }),
            el('span', { class: 'daftar-baris-ket', text: 'Urutan dan tampil di Beranda, ganti nama, buat dan susun form kustom.' })
          ]),
          ikon('kanan')
        ]),
        el('a', { class: 'daftar-baris', href: '#/pengaturan/item' }, [
          ikon('kotak'),
          el('span', { class: 'daftar-baris-isi' }, [
            el('span', { class: 'daftar-baris-judul', text: 'Item' }),
            el('span', { class: 'daftar-baris-ket', text: 'Nama, kategori, satuan, kemasan besar, harga, stok minimum dan maksimum.' })
          ]),
          ikon('kanan')
        ]),
        el('a', { class: 'daftar-baris', href: '#/pengaturan/resep' }, [
          ikon('resep'),
          el('span', { class: 'daftar-baris-isi' }, [
            el('span', { class: 'daftar-baris-judul', text: 'Resep' }),
            el('span', { class: 'daftar-baris-ket', text: 'Barang jadi, hasil per resep, bahan, dan masa simpan untuk Prep List.' })
          ]),
          ikon('kanan')
        ]),
        el('a', { class: 'daftar-baris', href: '#/pengaturan/menu' }, [
          ikon('label'),
          el('span', { class: 'daftar-baris-isi' }, [
            el('span', { class: 'daftar-baris-judul', text: 'Menu' }),
            el('span', { class: 'daftar-baris-ket', text: 'Harga jual dan takaran bahan per porsi untuk menghitung HPP.' })
          ]),
          ikon('kanan')
        ]),
        el('a', { class: 'daftar-baris', href: '#/pengaturan/unit' }, [
          ikon('termometer'),
          el('span', { class: 'daftar-baris-isi' }, [
            el('span', { class: 'daftar-baris-judul', text: 'Unit' }),
            el('span', { class: 'daftar-baris-ket', text: 'Chiller dan freezer untuk form Suhu.' })
          ]),
          ikon('kanan')
        ]),
        el('a', { class: 'daftar-baris', href: '#/pengaturan/pemasok' }, [
          ikon('truk'),
          el('span', { class: 'daftar-baris-isi' }, [
            el('span', { class: 'daftar-baris-judul', text: 'Pemasok' }),
            el('span', { class: 'daftar-baris-ket', text: 'Daftar pemasok untuk barang masuk, dan pembelian bulan ini.' })
          ]),
          ikon('kanan')
        ]),
        el('a', { class: 'daftar-baris', href: '#/pengaturan/kategori' }, [
          ikon('label'),
          el('span', { class: 'daftar-baris-isi' }, [
            el('span', { class: 'daftar-baris-judul', text: 'Kategori dan satuan' }),
            el('span', { class: 'daftar-baris-ket', text: 'Kategori stock beserta urutannya, dan daftar satuan.' })
          ]),
          ikon('kanan')
        ]),
        el('a', { class: 'daftar-baris', href: '#/pengaturan/outlet' }, [
          ikon('jam'),
          el('span', { class: 'daftar-baris-isi' }, [
            el('span', { class: 'daftar-baris-judul', text: 'Outlet dan jadwal' }),
            el('span', { class: 'daftar-baris-ket', text: 'Nama outlet, zona waktu, jam closing, jadwal opname dan cadangan, keluar otomatis, target food cost.' })
          ]),
          ikon('kanan')
        ])
      ])
    ]));
  }

  /* ---------- Outlet dan jadwal (spesifikasi tampilan Bagian 5.7) ---------- */

  var ZONA_INDONESIA = [
    { value: 'Asia/Jakarta', text: 'WIB (Asia/Jakarta)' },
    { value: 'Asia/Makassar', text: 'WITA (Asia/Makassar)' },
    { value: 'Asia/Jayapura', text: 'WIT (Asia/Jayapura)' }
  ];
  var PESAN_PASANG_TRIGGER = 'Jadwal sudah diubah, tetapi trigger belum dipasang ulang. Pemilik Sheet perlu menjalankan pasangTrigger ' +
    'di editor Apps Script supaya laporan harian dan cadangan mengikuti jadwal baru.';

  /** Pilihan dropdown berlabel. pilihan: [{ value, text }] atau [{ grup, pilihan: [...] }]. */
  function kolomPilih(opsi) {
    var id = 'kolom-' + (++nomorKolom);
    var select = el('select', { class: 'isian', id: id, 'aria-describedby': id + '-galat' + (opsi.bantuan ? ' ' + id + '-bantuan' : '') });
    function opsiEl(p) { return el('option', { value: p.value, text: p.text }); }
    (opsi.pilihan || []).forEach(function (p) {
      if (p.grup) select.appendChild(el('optgroup', { label: p.grup }, p.pilihan.map(opsiEl)));
      else select.appendChild(opsiEl(p));
    });
    select.value = opsi.nilai == null ? '' : opsi.nilai;
    if (opsi.nonaktif) select.disabled = true;
    var galat = el('p', { class: 'kolom-galat', id: id + '-galat' });
    var bantuan = opsi.bantuan ? el('p', { class: 'kolom-bantuan', id: id + '-bantuan', text: opsi.bantuan }) : null;
    return {
      wadah: el('div', { class: 'kolom' }, [el('label', { class: 'kolom-label', for: id, text: opsi.label }), bantuan, select, galat]),
      input: select,
      bantuan: bantuan,
      galat: function (pesan) {
        kosongkan(galat);
        select.setAttribute('aria-invalid', pesan ? 'true' : 'false');
        if (pesan) {
          galat.appendChild(ikonStatus('masalah'));
          galat.appendChild(el('span', { text: pesan }));
        }
        return !pesan;
      }
    };
  }

  /** "Laporan harian dikirim sekitar pukul 22.15." dari jam closing dan jeda. */
  function teksJamLaporan(jamClosing, jeda) {
    var m = String(jamClosing || '').match(/^(\d{1,2}):(\d{2})$/);
    var j = /^\d{1,3}$/.test(String(jeda).trim()) ? Number(jeda) : NaN;
    if (!m || isNaN(j)) return 'Laporan harian dikirim setelah closing, ditambah jeda ini.';
    var menit = (Number(m[1]) * 60 + Number(m[2]) + j) % (24 * 60);
    return 'Laporan harian dikirim sekitar pukul ' + duaAngka(Math.floor(menit / 60)) + '.' + duaAngka(menit % 60) +
      ' (toleransi Google sekitar 15 menit).';
  }

  function layarOutletJadwal(k) {
    aturJudul('Outlet dan jadwal');
    var penanda = el('span', { class: 'memperbarui', role: 'status' });
    var wadah = el('div');
    var isi = null; // isian yang belum disimpan
    var data = null;
    k.wadah.appendChild(el('div', { class: 'layar-isi layar-sempit' }, [
      tautanKembali('Pengaturan', '#/pengaturan'),
      el('h1', { class: 'judul-layar', text: 'Outlet dan jadwal' }),
      penanda,
      wadah
    ]));

    function salin(d) {
      return {
        namaOutlet: d.namaOutlet || '', zonaWaktu: d.zonaWaktu || '', jamClosing: d.jamClosing || '21:30',
        jedaLaporanMenit: String(d.jedaLaporanMenit == null ? 45 : d.jedaLaporanMenit), jadwalOpname: d.jadwalOpname || 'mingguan',
        hariCadangan: d.hariCadangan || 'Minggu', keluarOtomatisMenit: Number(d.keluarOtomatisMenit) || KELUAR_OTOMATIS_AWAL,
        targetFoodCost: String(d.targetFoodCost == null ? 35 : d.targetFoodCost).replace('.', ','),
        bahanKecilPersen: String(d.bahanKecilPersen == null ? 3 : d.bahanKecilPersen).replace('.', ','),
        // Jam pengingat cek suhu (Code.gs v0.19); server lama tidak mengirimnya, jadi field tidak ikut dikirim.
        jamCekOpening: d.jamCekOpening == null ? null : d.jamCekOpening,
        jamCekMiddle: d.jamCekMiddle == null ? null : d.jamCekMiddle,
        jamCekClosing: d.jamCekClosing == null ? null : d.jamCekClosing,
        // Jam pengingat stock (Code.gs v0.22); sama: server lama tidak mengirimnya.
        jamPengingatStock: d.jamPengingatStock == null ? null : d.jamPengingatStock
      };
    }

    function gambar(d) {
      data = d;
      if (!isi) isi = salin(d);
      simpanMenitKeluarOtomatis(d.keluarOtomatisMenit);
      gambarIsian();
    }

    function gambarIsian() {
      kosongkan(wadah);
      var asli = salin(data);
      var pesan = el('p', { class: 'pesan-formulir', role: 'alert' });
      var simpan = tombol('Simpan', 'utama');

      function berubah() {
        return Object.keys(asli).filter(function (kk) { return String(isi[kk]) !== String(asli[kk]); });
      }
      function perbarui() {
        simpan.disabled = !berubah().length;
      }

      var kNama = kolomIsian({ label: 'Nama outlet', maxlength: 60, nilai: isi.namaOutlet, bantuan: 'Tampil di layar Login, laporan PDF, dan email.' });
      kNama.input.addEventListener('input', function () { isi.namaOutlet = kNama.input.value; perbarui(); });

      var zonaHp = zonaWaktuPerangkat();
      var pilihanZona = ZONA_INDONESIA.slice();
      [data.zonaWaktu, zonaHp].forEach(function (z) {
        if (z && !pilihanZona.some(function (p) { return p.value === z; })) pilihanZona.push({ value: z, text: z });
      });
      var kZona = kolomPilih({ label: 'Zona waktu', pilihan: pilihanZona, nilai: isi.zonaWaktu,
        bantuan: 'Dipakai untuk tanggal, jam di laporan, dan jadwal laporan. Zona perangkat ini: ' + (zonaHp || 'tidak terbaca') + '.' });
      kZona.input.addEventListener('change', function () { isi.zonaWaktu = kZona.input.value; perbarui(); });

      var kJam = kolomIsian({ label: 'Jam closing', type: 'time', nilai: isi.jamClosing });
      var kJeda = kolomIsian({ label: 'Jeda laporan setelah closing (menit)', inputmode: 'numeric', kelas: 'isian-angka', maxlength: 3,
        nilai: isi.jedaLaporanMenit, bantuan: teksJamLaporan(isi.jamClosing, isi.jedaLaporanMenit) });
      var bantuanJeda = kJeda.wadah.querySelector('.kolom-bantuan');
      function perbaruiJam() {
        bantuanJeda.textContent = teksJamLaporan(isi.jamClosing, isi.jedaLaporanMenit);
        perbarui();
      }
      kJam.input.addEventListener('input', function () { isi.jamClosing = kJam.input.value; perbaruiJam(); });
      kJeda.input.addEventListener('input', function () { isi.jedaLaporanMenit = kJeda.input.value.trim(); perbaruiJam(); });

      var gOpname = grupPilihan('Jadwal stock opname', ['Mingguan', 'Bulanan'], isi.jadwalOpname === 'bulanan' ? 'Bulanan' : 'Mingguan');
      gOpname.input.forEach(function (i) {
        i.addEventListener('change', function () { isi.jadwalOpname = gOpname.nilai().toLowerCase(); perbarui(); });
      });
      var kHari = kolomPilih({ label: 'Hari cadangan mingguan', nilai: isi.hariCadangan,
        pilihan: NAMA_HARI.map(function (h) { return { value: h, text: h }; }),
        bantuan: 'Salinan spreadsheet dibuat dini hari itu, sekitar pukul 03.00.' });
      kHari.input.addEventListener('change', function () { isi.hariCadangan = kHari.input.value; perbarui(); });

      var labelMenit = function (n) { return n + ' menit'; };
      var gKeluar = grupPilihan('Keluar otomatis setelah tidak dipakai', PILIHAN_KELUAR_OTOMATIS.map(labelMenit), labelMenit(isi.keluarOtomatisMenit));
      gKeluar.input.forEach(function (i) {
        i.addEventListener('change', function () { isi.keluarOtomatisMenit = parseInt(gKeluar.nilai(), 10); perbarui(); });
      });

      var kTarget = kolomIsian({ label: 'Target food cost (%)', inputmode: 'decimal', kelas: 'isian-angka', maxlength: 5,
        nilai: isi.targetFoodCost, bantuan: 'Menu dan bulan di atas angka ini ditandai di HPP dan food cost.' });
      kTarget.input.addEventListener('input', function () { isi.targetFoodCost = kTarget.input.value.trim(); perbarui(); });
      var kKecil = kolomIsian({ label: 'Bahan kecil (%)', inputmode: 'decimal', kelas: 'isian-angka', maxlength: 4,
        nilai: isi.bahanKecilPersen, bantuan: 'Ditambahkan ke HPP semua menu untuk bumbu, minyak, dan garnish yang sulit ditakar per porsi.' });
      kKecil.input.addEventListener('input', function () { isi.bahanKecilPersen = kKecil.input.value.trim(); perbarui(); });
      function persenSah(teks, min, maks) {
        var n = bacaAngka(teks);
        return n !== null && !isNaN(n) && n >= min && n <= maks;
      }

      // Pengingat cek suhu ke HP (aplikasi 0.20.0): kosong = tanpa pengingat untuk waktu cek itu.
      var adaPengingat = data.jamCekOpening != null;
      var kolomPengingat = [['jamCekOpening', 'Opening'], ['jamCekMiddle', 'Middle'], ['jamCekClosing', 'Closing']].map(function (x) {
        var kk = kolomIsian({ label: 'Pengingat ' + x[1], type: 'time', nilai: isi[x[0]] || '' });
        kk.input.addEventListener('input', function () { isi[x[0]] = kk.input.value; perbarui(); });
        return { field: x[0], k: kk };
      });
      // Pengingat stock pagi ke HP Pengelola (aplikasi 0.22.0): kosong = mati.
      var adaPengingatStock = data.jamPengingatStock != null;
      var kStock = kolomIsian({ label: 'Jam pengingat stock', type: 'time', nilai: isi.jamPengingatStock || '' });
      kStock.input.addEventListener('input', function () { isi.jamPengingatStock = kStock.input.value; perbarui(); });

      simpan.addEventListener('click', function () {
        if (simpan.disabled) return;
        tulisPesan(pesan, '');
        var ok = [
          kTarget.galat(persenSah(isi.targetFoodCost, 1, 100) ? '' : 'Isi persen 1 sampai 100, misalnya 35.'),
          kKecil.galat(persenSah(isi.bahanKecilPersen, 0, 15) ? '' : 'Isi persen 0 sampai 15, misalnya 3.'),
          kNama.galat(isi.namaOutlet.trim() ? '' : 'Isi nama outlet.'),
          kJam.galat(/^\d{1,2}:\d{2}$/.test(isi.jamClosing) ? '' : 'Isi jam closing, misalnya 21:30.'),
          kJeda.galat(/^\d{1,3}$/.test(isi.jedaLaporanMenit) && Number(isi.jedaLaporanMenit) <= 240 ? '' : 'Isi menit bulat, 0 sampai 240.')
        ].concat(adaPengingat ? kolomPengingat.map(function (x) {
          return x.k.galat(!isi[x.field] || /^\d{1,2}:\d{2}$/.test(isi[x.field]) ? '' : 'Isi jam, misalnya 08:00, atau kosongkan.');
        }) : []).concat(adaPengingatStock ? [
          kStock.galat(!isi.jamPengingatStock || /^\d{1,2}:\d{2}$/.test(isi.jamPengingatStock) ? '' : 'Isi jam, misalnya 07:00, atau kosongkan.')
        ] : []);
        if (ok.indexOf(false) >= 0) {
          var salah = wadah.querySelector('[aria-invalid="true"]');
          if (salah) salah.focus();
          return;
        }
        var kirim = {};
        berubah().forEach(function (kk) {
          kirim[kk] = kk === 'namaOutlet' ? isi.namaOutlet.trim().replace(/\s+/g, ' ') : isi[kk];
        });
        aturTombolProses(simpan, true, 'Menyimpan…');
        panggilApi('simpanOutletJadwal', kirim).then(function (hasil) {
          isi = null;
          Cache.tulis('outlet-jadwal', hasil);
          var sesi = Sesi.baca();
          if (sesi && hasil.namaOutlet) {
            sesi.namaOutlet = hasil.namaOutlet;
            Sesi.tulis(sesi);
            if ($('#merek-outlet')) $('#merek-outlet').textContent = hasil.namaOutlet;
          }
          gambar(hasil);
          toast(hasil.jadwalBerubah ? 'Tersimpan. Jalankan pasangTrigger supaya jadwal baru berlaku.' : 'Outlet dan jadwal tersimpan.',
            hasil.jadwalBerubah ? 'info' : null);
        }).catch(function (err) {
          aturTombolProses(simpan, false);
          if (tanganiSesiBerakhir(err)) return;
          tulisPesan(pesan, pesanGalat(err), 'masalah');
        });
      });
      perbarui();

      if (data.perluPasangTrigger) {
        wadah.appendChild(el('p', { class: 'pesan-formulir tinjau bagian' }, [ikon('info'), el('span', { text: PESAN_PASANG_TRIGGER })]));
      }
      wadah.appendChild(el('section', { class: 'kartu formulir' }, [el('h2', { class: 'kartu-judul', text: 'Outlet' }), kNama.wadah, kZona.wadah]));
      wadah.appendChild(el('section', { class: 'kartu formulir' }, [
        el('h2', { class: 'kartu-judul', text: 'Jadwal' }),
        kJam.wadah, kJeda.wadah,
        el('p', { class: 'kolom-bantuan', text: 'Jam closing, jeda, hari cadangan, dan zona waktu berlaku setelah pemilik Sheet menjalankan pasangTrigger.' }),
        gOpname.wadah, kHari.wadah
      ]));
      wadah.appendChild(el('section', { class: 'kartu formulir' }, [
        gKeluar.wadah,
        el('p', { class: 'kolom-bantuan', text: 'Berlaku untuk semua pengguna di semua perangkat.' })
      ]));
      wadah.appendChild(el('section', { class: 'kartu formulir' }, [
        el('h2', { class: 'kartu-judul', text: 'HPP dan food cost' }),
        kTarget.wadah, kKecil.wadah
      ]));
      if (adaPengingat) {
        wadah.appendChild(el('section', { class: 'kartu formulir' }, [
          el('h2', { class: 'kartu-judul', text: 'Pengingat cek suhu' }),
          el('p', { class: 'kartu-teks', text: 'Notifikasi ke semua HP yang menyalakan notifikasi, jika waktu cek itu belum diisi untuk semua unit. ' +
            'Kosongkan jam untuk mematikan pengingatnya.' })
        ].concat(kolomPengingat.map(function (x) { return x.k.wadah; }), [
          data.notifikasiTersedia ? null : el('p', { class: 'kolom-bantuan', text: 'Notifikasi belum tersedia di server ini, jadi pengingat belum terkirim.' })
        ])));
      }
      if (adaPengingatStock) {
        wadah.appendChild(el('section', { class: 'kartu formulir' }, [
          el('h2', { class: 'kartu-judul', text: 'Pengingat stock' }),
          el('p', { class: 'kartu-teks', text: 'Notifikasi pagi ke HP Head Kitchen dan Manager yang menyalakan notifikasi, hanya jika ada item ' +
            'di bawah stok minimum, stock minus, atau barang jadi yang lewat masa simpan atau habis besok. Kosongkan jam untuk mematikannya.' }),
          kStock.wadah,
          data.notifikasiTersedia ? null : el('p', { class: 'kolom-bantuan', text: 'Notifikasi belum tersedia di server ini, jadi pengingat belum terkirim.' })
        ]));
      }
      wadah.appendChild(el('section', { class: 'kartu formulir' }, [pesan, el('div', {}, simpan)]));
    }

    muatData({
      kunciCache: 'outlet-jadwal',
      ambil: function () { return panggilApi('bacaOutletJadwal'); },
      gambar: function (d) {
        // Isian yang sedang diubah tidak digambar ulang.
        if (isi && data && JSON.stringify(isi) !== JSON.stringify(salin(data))) {
          data = d;
          return;
        }
        isi = null;
        gambar(d);
      },
      kerangka: function () {
        kosongkan(wadah).appendChild(kerangkaBaris(4));
      },
      galat: function (pesan, cobaLagi) {
        kosongkan(wadah).appendChild(kotakGalat(pesan, cobaLagi));
      },
      penanda: penanda
    });
  }

  /* ---------- Item (spesifikasi sistem Bagian 5.1, tampilan Bagian 5.7) ---------- */

  function hrefItem(nama) {
    return '#/pengaturan/item/' + encodeURIComponent(nama);
  }

  var ajakanStokPembuka = ''; // item baru yang baru disimpan: tawarkan stok pembuka begitu layarnya terbuka

  function teksKemasan(it) {
    return it.satuanBesar ? '1 ' + it.satuanBesar + ' berisi ' + formatAngka(it.isiSatuanBesar) + ' ' + it.satuan : '';
  }

  function layarItem(k) {
    aturJudul('Item');
    var penanda = el('span', { class: 'memperbarui', role: 'status' });
    var wadah = el('div');
    var tambah = el('a', { class: 'tombol tombol-utama', href: '#/pengaturan/item-baru' }, el('span', { class: 'tombol-teks', text: 'Tambah' }));
    var kCari = kolomIsian({ label: 'Cari item', atribut: { type: 'search', autocapitalize: 'none', spellcheck: 'false' } });
    k.wadah.appendChild(el('div', { class: 'layar-isi layar-sempit' }, [
      tautanKembali('Pengaturan', '#/pengaturan'),
      el('div', { class: 'kepala-isi' }, [el('h1', { class: 'judul-layar', text: 'Item' }), tambah]),
      el('p', { class: 'kartu-teks', text: 'Bahan dan barang jadi yang dipakai semua form. Item yang sudah punya catatan cukup dinonaktifkan, supaya riwayatnya tetap terbaca; item yang belum punya catatan bisa dihapus.' }),
      kCari.wadah,
      penanda,
      wadah
    ]));
    var data = null;

    function baris(it, katNonaktif) {
      var ket = [it.satuan + (it.satuanBesar ? ' (' + teksKemasan(it) + ')' : '')];
      if (it.harga != null) ket.push(formatRupiah(it.harga) + ' per ' + it.satuan);
      if (it.stokMin != null) ket.push('minimum ' + formatAngka(it.stokMin));
      var tanda = [];
      if (!it.aktif) tanda.push(tandaStatus('menunggu', 'Nonaktif'));
      if (it.harga == null) tanda.push(tandaStatus('tinjau', 'Belum punya harga'));
      if (it.aktif && katNonaktif) tanda.push(tandaStatus('tinjau', 'Kategori nonaktif'));
      return el('a', { class: 'daftar-baris' + (it.aktif ? '' : ' nonaktif'), href: hrefItem(it.nama) }, [
        el('span', { class: 'daftar-baris-isi' }, [
          el('span', { class: 'daftar-baris-judul', text: it.nama }),
          el('span', { class: 'daftar-baris-ket', text: ket.join(' · ') }),
          tanda.length ? el('span', { class: 'tanda-deret bungkus' }, tanda) : null
        ]),
        ikon('kanan')
      ]);
    }

    function saring() {
      kosongkan(wadah);
      var semua = data.item || [];
      if (!semua.length) {
        wadah.appendChild(kotakKosong('Belum ada item. Ketuk Tambah untuk membuat item pertama.', 'kotak'));
        return;
      }
      var q = kCari.input.value.trim().toLowerCase();
      var item = semua.filter(function (it) { return !q || it.nama.toLowerCase().indexOf(q) >= 0; });
      if (!item.length) {
        wadah.appendChild(kotakKosong('Tidak ada item dengan nama itu.'));
        return;
      }
      // Item aktif dikelompokkan per kategori (urutan kategori), lalu kelompok Nonaktif.
      var kat = data.kategori || [];
      var nonaktifKat = {};
      kat.forEach(function (x) { if (!x.aktif) nonaktifKat[x.nama.toLowerCase()] = true; });
      var grup = [];
      var petaGrup = {};
      kat.forEach(function (x) {
        petaGrup[x.nama.toLowerCase()] = { judul: x.nama, item: [] };
        grup.push(petaGrup[x.nama.toLowerCase()]);
      });
      var lain = { judul: 'Tanpa kategori', item: [] };
      var nonaktif = { judul: 'Nonaktif', item: [] };
      item.forEach(function (it) {
        if (!it.aktif) nonaktif.item.push(it);
        else (petaGrup[String(it.kategori).toLowerCase()] || lain).item.push(it);
      });
      grup.concat([lain, nonaktif]).forEach(function (g) {
        if (!g.item.length) return;
        wadah.appendChild(el('section', { class: 'bagian' }, [
          el('h2', { class: 'judul-sub', text: g.judul + ' (' + g.item.length + ')' }),
          el('nav', { class: 'daftar', 'aria-label': 'Item ' + g.judul }, g.item.map(function (it) {
            return baris(it, nonaktifKat[String(it.kategori).toLowerCase()]);
          }))
        ]));
      });
    }

    kCari.input.addEventListener('input', function () { if (data) saring(); });
    muatData({
      kunciCache: 'item',
      ambil: function () { return panggilApi('daftarItem'); },
      gambar: function (d) {
        data = d;
        saring();
      },
      kerangka: function () {
        kosongkan(wadah).appendChild(kerangkaBaris(4));
      },
      galat: function (pesan, cobaLagi) {
        kosongkan(wadah).appendChild(kotakGalat(pesan, cobaLagi));
      },
      penanda: penanda
    });
  }

  /**
   * Tambah dan ubah item (tampilan Bagian 5.7): nama, kategori, satuan dasar,
   * sakelar "Datang dalam kemasan besar" (1 [dus] berisi [12] botol), harga
   * satuan, stok minimum, dan stok maksimum. Item baru menawarkan stok pembuka.
   * Satuan dasar terkunci setelah item punya catatan stock; nama terkunci
   * setelah item punya catatan stock atau dipakai resep. Isian tersimpan sebagai draft.
   */
  function layarItemUbah(k) {
    var baru = !k.cocok[1];
    var namaAwal = '';
    if (!baru) {
      try {
        namaAwal = decodeURIComponent(k.cocok[1]);
      } catch (err) {
        namaAwal = k.cocok[1];
      }
    }
    aturJudul(baru ? 'Item baru' : namaAwal);
    var kunciDraft = 'item:' + (baru ? '+baru' : namaAwal.toLowerCase());
    var penanda = el('span', { class: 'memperbarui', role: 'status' });
    var catatanDraft = el('p', { class: 'catatan-draft', 'aria-live': 'polite' });
    var wadah = el('div');
    var judul = el('h1', { class: 'judul-layar', text: baru ? 'Item baru' : namaAwal });
    // Ringkasan di kepala navy (tampilan Bagian 4.7): chip, stock hari ini, dan harga sekarang.
    var ringkasKepala = el('div', { class: 'kepala-ringkas' });
    k.wadah.appendChild(el('div', { class: 'layar-isi layar-sempit' }, [
      tautanKembali('Item', '#/pengaturan/item'),
      judul,
      ringkasKepala,
      catatanDraft,
      penanda,
      wadah
    ]));

    var data = null;
    var itemKini = null;
    var isi = null; // { nama, kategori, satuan, besar, satuanBesar, isi, harga, stokMin, stokMaks }
    var diketik = false; // isian sudah diubah pengguna (draft)
    var d = Draft.baca(kunciDraft);
    if (d && d.data) {
      isi = d.data;
      diketik = true;
      catatanDraft.textContent = 'Draft tersimpan ' + jam(new Date(d.waktu).toISOString());
    }

    function simpanDraft() {
      diketik = true;
      var waktu = Draft.simpan(kunciDraft, isi);
      if (waktu) catatanDraft.textContent = 'Draft tersimpan ' + jam(new Date(waktu).toISOString());
    }

    function cari(nama) {
      var daftar = (data && data.item) || [];
      for (var i = 0; i < daftar.length; i++) if (daftar[i].nama.toLowerCase() === String(nama).toLowerCase()) return daftar[i];
      return null;
    }

    function teksAngka(n) {
      return n == null ? '' : String(n).replace('.', ',');
    }

    function dariItem(it) {
      return {
        nama: it.nama, kategori: it.kategori, satuan: it.satuan, besar: !!it.satuanBesar, satuanBesar: it.satuanBesar || '',
        isi: teksAngka(it.isiSatuanBesar), harga: teksAngka(it.harga), stokMin: teksAngka(it.stokMin), stokMaks: teksAngka(it.stokMaks)
      };
    }

    function gambar(hasil, dariHp) {
      data = hasil;
      itemKini = baru ? null : cari(namaAwal);
      kosongkan(wadah);
      perbaruiRingkas();
      if (!baru && !itemKini) {
        if (!dariHp) wadah.appendChild(kotakKosong('Item ' + namaAwal + ' tidak ditemukan. Kembali ke daftar item.', 'kotak'));
        return;
      }
      if (!isi) {
        isi = baru ? { nama: '', kategori: '', satuan: '', besar: false, satuanBesar: '', isi: '', harga: '', stokMin: '', stokMaks: '' }
          : dariItem(itemKini);
      }
      gambarIsian();
      if (itemKini && ajakanStokPembuka && ajakanStokPembuka.toLowerCase() === itemKini.nama.toLowerCase()) {
        ajakanStokPembuka = '';
        tawarkanStokPembuka(itemKini);
      }
    }

    function pilihanSatuan(nilaiKini) {
      var grup = {};
      (data.satuan || []).forEach(function (s) {
        if (!s.aktif && s.satuan !== nilaiKini) return;
        var j = s.jenis || 'Lainnya';
        (grup[j] = grup[j] || []).push({ value: s.satuan, text: s.satuan + (s.aktif ? '' : ' (nonaktif)') });
      });
      return [{ value: '', text: 'Pilih satuan' }].concat(Object.keys(grup).map(function (j) { return { grup: j, pilihan: grup[j] }; }));
    }

    function gambarIsian() {
      kosongkan(wadah);
      var it = itemKini;
      var pesan = el('p', { class: 'pesan-formulir', role: 'alert' });
      var bisaNama = baru || it.bisaGantiNama;
      // Riwayat harga (spesifikasi sistem Bagian 5.1): item yang sudah punya harga menggantinya lewat
      // lembar Ganti harga; isian harga hanya untuk harga pertama.
      var punyaHarga = !baru && (it.harga != null || (it.jumlahRiwayatHarga || 0) > 0);
      var satuanTerkunci = !baru && it.punyaCatatan;

      var kNama = kolomIsian({ label: 'Nama item', maxlength: 60, nilai: isi.nama,
        bantuan: bisaNama ? 'Nama yang tampil di semua form, misalnya "Ayam fillet".'
          : 'Nama tidak bisa diganti karena item ini sudah ' + (it.punyaCatatan ? 'punya catatan stock' : 'dipakai resep') + '.' });
      if (!bisaNama) kNama.input.readOnly = true;
      kNama.input.addEventListener('input', function () { isi.nama = kNama.input.value; simpanDraft(); });

      var kKat = kolomPilih({
        label: 'Kategori',
        nilai: isi.kategori,
        pilihan: [{ value: '', text: 'Pilih kategori' }].concat((data.kategori || []).filter(function (x) {
          return x.aktif || x.nama === isi.kategori;
        }).map(function (x) { return { value: x.nama, text: x.nama + (x.aktif ? '' : ' (nonaktif)') }; }))
      });
      kKat.input.addEventListener('change', function () { isi.kategori = kKat.input.value; simpanDraft(); });

      var kSat = kolomPilih({
        label: 'Satuan dasar',
        nilai: isi.satuan,
        pilihan: pilihanSatuan(isi.satuan),
        nonaktif: satuanTerkunci,
        bantuan: satuanTerkunci ? 'Satuan dasar tidak bisa diganti karena item ini sudah punya catatan stock.'
          : 'Stock, waste, prep, dan harga item ini memakai satuan ini.'
      });

      // Sakelar "Datang dalam kemasan besar": 1 [dus] berisi [12] botol.
      var idSakelar = 'sakelar-' + (++nomorKolom);
      var sakelar = el('input', { type: 'checkbox', role: 'switch', class: 'sakelar-input', id: idSakelar });
      sakelar.checked = !!isi.besar;
      var kataSakelar = el('span', { class: 'sakelar-kata', text: isi.besar ? 'Ya' : 'Tidak' });
      var pilihBesar = el('select', { class: 'isian isian-pendek', 'aria-label': 'Satuan besar' });
      pilihanSatuan(isi.satuanBesar).forEach(function (p) {
        if (p.grup) pilihBesar.appendChild(el('optgroup', { label: p.grup }, p.pilihan.map(function (x) { return el('option', { value: x.value, text: x.text }); })));
        else pilihBesar.appendChild(el('option', { value: '', text: 'satuan besar' }));
      });
      pilihBesar.value = isi.satuanBesar;
      var inIsi = el('input', { class: 'isian isian-angka isian-pendek', type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': 'Isi per satuan besar' });
      inIsi.value = isi.isi;
      var satuanKalimat = el('span', { class: 'satuan-tetap', text: isi.satuan || 'satuan dasar' });
      var galatBesar = el('p', { class: 'kolom-galat' });
      var kalimat = el('div', { class: 'kalimat-kemasan', hidden: !isi.besar }, [
        el('span', { text: '1' }), pilihBesar, el('span', { text: 'berisi' }), inIsi, satuanKalimat
      ]);
      sakelar.addEventListener('change', function () {
        isi.besar = sakelar.checked;
        kataSakelar.textContent = isi.besar ? 'Ya' : 'Tidak';
        kalimat.hidden = !isi.besar;
        simpanDraft();
      });
      pilihBesar.addEventListener('change', function () { isi.satuanBesar = pilihBesar.value; simpanDraft(); });
      inIsi.addEventListener('input', function () { isi.isi = inIsi.value; simpanDraft(); });
      var bagianKemasan = el('div', { class: 'kolom' }, [
        el('label', { class: 'sakelar', for: idSakelar }, [
          sakelar,
          el('span', { class: 'sakelar-jalur', 'aria-hidden': 'true' }),
          el('span', { class: 'sakelar-teks', text: 'Datang dalam kemasan besar' }),
          kataSakelar
        ]),
        kalimat,
        el('p', { class: 'kolom-bantuan', text: 'Hanya untuk Tambah masuk di form Stock. Mengubah isinya tidak mengubah catatan lama.' }),
        galatBesar
      ]);

      var kHarga = kolomIsian({ label: 'Harga satuan (Rp)', inputmode: 'decimal', kelas: 'isian-angka', nilai: isi.harga, bantuan: ' ' });
      var kMin = kolomIsian({ label: 'Stok minimum', inputmode: 'decimal', kelas: 'isian-angka', nilai: isi.stokMin, bantuan: ' ' });
      var kMaks = kolomIsian({ label: 'Stok maksimum (tidak wajib)', inputmode: 'decimal', kelas: 'isian-angka', nilai: isi.stokMaks,
        bantuan: 'Dipakai untuk saran order: stok maksimum dikurangi stock akhir.' });
      var bantuanHarga = kHarga.wadah.querySelector('.kolom-bantuan');
      var bantuanMin = kMin.wadah.querySelector('.kolom-bantuan');
      function perbaruiSatuan() {
        var s = isi.satuan || 'satuan dasar';
        satuanKalimat.textContent = s;
        bantuanHarga.textContent = 'Per 1 ' + s + '. Item tanpa harga tidak ikut nilai stock dan estimasi waste.';
        bantuanMin.textContent = 'Dalam ' + s + '. Stock di bawah angka ini ditandai Perlu reorder.';
      }
      perbaruiSatuan();
      kSat.input.addEventListener('change', function () { isi.satuan = kSat.input.value; perbaruiSatuan(); simpanDraft(); });
      kHarga.input.addEventListener('input', function () { isi.harga = kHarga.input.value; simpanDraft(); });
      kMin.input.addEventListener('input', function () { isi.stokMin = kMin.input.value; simpanDraft(); });
      kMaks.input.addEventListener('input', function () { isi.stokMaks = kMaks.input.value; simpanDraft(); });

      var simpan = tombol('Simpan item', 'utama');
      simpan.addEventListener('click', function () {
        if (simpan.disabled) return;
        tulisPesan(pesan, '');
        var nama = String(isi.nama || '').trim().replace(/\s+/g, ' ');
        var angka = function (v) { return bacaAngka(v); };
        var harga = punyaHarga ? null : angka(isi.harga);
        var min = angka(isi.stokMin);
        var maks = angka(isi.stokMaks);
        var isiBesar = angka(isi.isi);
        var salahAngka = 'Isi angka 0 atau lebih, misalnya 2,5, atau kosongkan.';
        var ok = [
          kNama.galat(!nama ? 'Isi nama item.' : (/^[=+\-@]/.test(nama) ? 'Nama tidak boleh diawali tanda =, +, -, atau @.' : '')),
          kKat.galat(isi.kategori ? '' : 'Pilih kategori.'),
          kSat.galat(isi.satuan ? '' : 'Pilih satuan dasar.'),
          kHarga.galat(harga !== null && isNaN(harga) ? salahAngka : ''),
          kMin.galat(min !== null && isNaN(min) ? salahAngka : ''),
          kMaks.galat(maks !== null && isNaN(maks) ? salahAngka
            : (maks !== null && min !== null && !isNaN(min) && maks < min ? 'Stok maksimum harus sama dengan atau lebih besar dari stok minimum.' : ''))
        ];
        kosongkan(galatBesar);
        var pesanBesar = '';
        if (isi.besar) {
          if (!isi.satuanBesar) pesanBesar = 'Pilih satuan besar, misalnya dus.';
          else if (isi.satuanBesar === isi.satuan) pesanBesar = 'Satuan besar harus berbeda dari satuan dasar.';
          else if (isiBesar === null || isNaN(isiBesar) || !(isiBesar > 0)) pesanBesar = 'Isi berapa ' + (isi.satuan || 'satuan dasar') + ' dalam 1 ' + isi.satuanBesar + '.';
        }
        if (pesanBesar) {
          galatBesar.appendChild(ikonStatus('masalah'));
          galatBesar.appendChild(el('span', { text: pesanBesar }));
          ok.push(false);
        }
        if (ok.indexOf(false) >= 0) {
          var salah = wadah.querySelector('[aria-invalid="true"]') || (pesanBesar ? (isi.satuanBesar ? inIsi : pilihBesar) : null);
          if (salah) salah.focus();
          return;
        }
        aturTombolProses(simpan, true, 'Menyimpan…');
        panggilApi('simpanItem', {
          baru: baru,
          namaLama: baru ? '' : itemKini.nama,
          nama: nama,
          kategori: isi.kategori,
          satuan: isi.satuan,
          satuanBesar: isi.besar ? isi.satuanBesar : '',
          isiSatuanBesar: isi.besar ? isiBesar : '',
          harga: harga === null ? '' : harga,
          stokMin: min === null ? '' : min,
          stokMaks: maks === null ? '' : maks
        }).then(function (hasil) {
          Draft.hapus(kunciDraft);
          Cache.tulis('item', hasil);
          toast('Item ' + hasil.disimpan + ' tersimpan.');
          if (baru) {
            ajakanStokPembuka = hasil.disimpan;
            location.hash = hrefItem(hasil.disimpan);
          } else {
            location.hash = '#/pengaturan/item';
          }
        }).catch(function (err) {
          aturTombolProses(simpan, false);
          if (tanganiSesiBerakhir(err)) return;
          tulisPesan(pesan, pesanGalat(err), 'masalah');
        });
      });

      wadah.appendChild(el('section', { class: 'kartu formulir' }, [kNama.wadah, kKat.wadah, kSat.wadah, bagianKemasan]));
      if (punyaHarga) wadah.appendChild(kartuHarga(it));
      wadah.appendChild(el('section', { class: 'kartu formulir' }, punyaHarga ? [kMin.wadah, kMaks.wadah] : [kHarga.wadah, kMin.wadah, kMaks.wadah]));
      wadah.appendChild(el('section', { class: 'kartu formulir' }, [pesan, el('div', {}, simpan)]));

      if (!baru) {
        var riwayat = tombol('Riwayat stock', 'kedua', { 'aria-haspopup': 'dialog', onclick: function () { bukaRiwayatItem(it.nama); } });
        wadah.appendChild(el('section', { class: 'kartu' }, [
          el('h2', { class: 'kartu-judul', text: 'Stock' }),
          el('p', { class: 'riwayat-item-sekarang' }, ['Stock tercatat hari ini ',
            el('strong', { class: it.stock < 0 ? 'minus' : null }, angkaSatuan(it.stock, it.satuan))]),
          el('p', { class: 'kartu-teks', text: 'Untuk stok pembuka atau meluruskan stock, buka Riwayat stock lalu Sesuaikan stock.' }),
          riwayat
        ]));
        var keadaan = [el('h2', { class: 'kartu-judul', text: 'Keadaan item' })];
        if (it.aktif) {
          keadaan.push(el('p', { class: 'kartu-teks', text: 'Aktif. ' + it.nama + ' tampil di form.' }));
          var alasan = it.resepAktif ? 'Tidak bisa dinonaktifkan selama resep ' + it.nama + ' aktif.'
            : (it.dipakaiResep.length ? 'Tidak bisa dinonaktifkan: masih dipakai resep ' + it.dipakaiResep.join(', ') + '.' : '');
          var dipakaiMenu = it.dipakaiMenu || [];
          if (!alasan && dipakaiMenu.length) {
            keadaan.push(el('p', { class: 'pesan-formulir tinjau' }, [ikon('info'), el('span', {
              text: 'Tidak bisa dinonaktifkan: masih dipakai menu ' + dipakaiMenu.join(', ') + '. Ubah atau nonaktifkan menunya dulu.' })]));
            keadaan.push(el('a', { class: 'tombol tombol-kedua', href: hrefMenu(dipakaiMenu[0]) },
              el('span', { class: 'tombol-teks', text: 'Buka menu' })));
          } else if (alasan) {
            keadaan.push(el('p', { class: 'pesan-formulir tinjau' }, [ikon('info'), el('span', { text: alasan + ' Ubah atau nonaktifkan resepnya dulu.' })]));
            keadaan.push(el('a', { class: 'tombol tombol-kedua', href: it.resepAktif ? hrefResep(it.nama) : hrefResep(it.dipakaiResep[0]) },
              el('span', { class: 'tombol-teks', text: 'Buka resep' })));
          } else {
            keadaan.push(tombol('Nonaktifkan', 'bahaya', { onclick: nonaktifkan }));
          }
        } else {
          keadaan.push(el('p', { class: 'kartu-teks', text: 'Nonaktif. ' + it.nama + ' tidak tampil di form. Riwayatnya tetap tersimpan.' }));
          keadaan.push(tombol('Aktifkan lagi', 'kedua', { onclick: aktifkan }));
        }
        wadah.appendChild(el('section', { class: 'kartu' }, keadaan));

        // Hapus item (tampilan Bagian 5.7): paling bawah, terpisah, hanya untuk item nonaktif yang belum punya catatan.
        // Server lama tidak mengirim sebabTidakBisaHapus, jadi bagian ini tidak tampil.
        var sebabHapus = it.sebabTidakBisaHapus;
        if (typeof sebabHapus === 'string' && !(it.aktif && sebabHapus)) {
          wadah.appendChild(el('div', { class: 'bagian-hapus' }, sebabHapus
            ? el('p', { class: 'kolom-bantuan', text: sebabHapus })
            : (it.aktif
              ? el('p', { class: 'kolom-bantuan', text: 'Item ini belum punya catatan. Nonaktifkan dulu untuk bisa menghapus.' })
              : tombol('Hapus', 'bahaya', { onclick: hapusItem }))));
        }
      }
    }

    function perbaruiRingkas() {
      kosongkan(ringkasKepala);
      var it = itemKini;
      ringkasKepala.hidden = !it;
      if (!it) return;
      ringkasKepala.appendChild(el('div', { class: 'kepala-chip' }, [
        it.kategori ? el('span', { class: 'chip-navy', text: it.kategori }) : null,
        it.satuan ? el('span', { class: 'chip-navy', text: it.satuan }) : null,
        el('span', { class: 'chip-navy', text: it.aktif ? 'Aktif' : 'Nonaktif' })
      ]));
      ringkasKepala.appendChild(el('div', { class: 'kepala-angka' }, [
        el('div', {}, [
          el('span', { class: 'kepala-angka-label', text: 'Stock hari ini' }),
          el('span', { class: 'kepala-angka-nilai' }, [formatAngka(it.stock || 0), el('small', { text: it.satuan })])
        ]),
        el('div', {}, [
          el('span', { class: 'kepala-angka-label', text: 'Harga sekarang' }),
          it.harga == null
            ? el('span', { class: 'kepala-angka-nilai', text: '–' })
            : el('span', { class: 'kepala-angka-nilai' }, [formatRupiah(it.harga), el('small', { text: '/' + (it.satuan || 'satuan') })]),
          el('span', { class: 'kepala-angka-sub', text: it.harga == null ? 'Belum punya harga'
            : (it.hargaSejak ? 'sejak ' + tanggalHarga(it.hargaSejak) : (it.jumlahRiwayatHarga ? 'sejak awal' : '')) })
        ])
      ]));
    }

    /**
     * Grafik tangga harga (tampilan Bagian 5.7, versi 1.7): satu anak tangga per harga dari yang
     * paling lama sampai hari ini, sama lebar (urutan, bukan skala waktu), titik di harga sekarang.
     * Garis SVG direntang dengan non-scaling-stroke; label dan titik berupa HTML supaya tidak gepeng.
     */
    function grafikHarga(riwayatBaru) {
      var r = riwayatBaru.slice().reverse(); // lama ke baru
      if (r.length < 2) return null;
      var nilai = r.map(function (x) { return x.harga; });
      var min = Math.min.apply(null, nilai);
      var maks = Math.max.apply(null, nilai);
      var y = function (v) { return maks === min ? 50 : 10 + (1 - (v - min) / (maks - min)) * 80; };
      var n = r.length;
      var d = 'M0 ' + y(r[0].harga).toFixed(2);
      r.forEach(function (x, i) {
        if (i) d += ' V' + y(x.harga).toFixed(2);
        d += ' H' + ((i + 1) / n * 100).toFixed(2);
      });
      var akhir = y(r[n - 1].harga);
      return el('div', { class: 'grafik-harga', role: 'img', 'aria-label': 'Grafik harga ' + itemKini.nama + ': ' + r.map(function (x) {
        return (x.berlakuMulai ? tanggalHarga(x.berlakuMulai) : 'sejak awal') + ' ' + formatRupiah(x.harga);
      }).join(', ') + '.' }, [
        el('div', { class: 'grafik-harga-sumbu', 'aria-hidden': 'true' }, [
          el('span', { text: formatRupiah(maks) }),
          el('span', { text: formatRupiah(min) })
        ]),
        el('div', { class: 'grafik-harga-area', 'aria-hidden': 'true' }, [
          svgEl('svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'none', focusable: 'false' }, [
            svgEl('line', { class: 'grafik-harga-grid', x1: 0, y1: 10, x2: 100, y2: 10 }),
            svgEl('line', { class: 'grafik-harga-grid', x1: 0, y1: 90, x2: 100, y2: 90 }),
            svgEl('path', { class: 'grafik-harga-garis', d: d })
          ]),
          el('span', { class: 'grafik-harga-titik', style: 'top:' + akhir.toFixed(2) + '%' })
        ]),
        el('div', { class: 'grafik-harga-tanggal', 'aria-hidden': 'true' }, [
          el('span', { text: r[0].berlakuMulai ? tanggalHarga(r[0].berlakuMulai) : 'Sejak awal' }),
          el('span', { text: 'Hari ini' })
        ])
      ]);
    }

    /** "7 Okt", atau "7 Okt 2025" jika bukan tahun ini. */
    function tanggalHarga(iso) {
      return tanggalPendek(iso) + (iso.slice(0, 4) === String(new Date().getFullYear()) ? '' : ' ' + iso.slice(0, 4));
    }

    /** Kartu harga satuan: harga sekarang (sejak kapan), Ganti harga, dan 10 perubahan terakhir. */
    function kartuHarga(it) {
      var sekarang = it.harga == null ? 'belum ada'
        : formatRupiah(it.harga) + (it.hargaSejak ? ' (sejak ' + tanggalHarga(it.hargaSejak) + ')' : '');
      var riwayat = it.riwayatHarga || [];
      var isiKartu = [
        el('div', { class: 'kartu-kepala' }, [
          el('h2', { class: 'kartu-judul', text: 'Harga satuan' }),
          tombol('Ganti harga', 'kedua', { 'aria-haspopup': 'dialog', onclick: function () { bukaGantiHarga(it); } })
        ]),
        el('p', { class: 'riwayat-item-sekarang' }, ['Harga sekarang ', el('strong', { class: 'angka-satuan', text: sekarang })]),
        el('p', { class: 'kartu-teks', text: 'Per 1 ' + (it.satuan || 'satuan dasar') + '. Harga baru berlaku mulai tanggal yang dipilih; ' +
          'catatan sebelum tanggal itu tetap memakai harga lama.' })
      ];
      if (riwayat.length) {
        isiKartu.push(grafikHarga(riwayat));
        isiKartu.push(el('h3', { class: 'judul-sub', text: 'Riwayat harga' }));
        isiKartu.push(el('ul', { class: 'riwayat-harga', 'aria-label': 'Riwayat harga ' + it.nama }, riwayat.map(function (r) {
          var beda = null;
          if (r.beda === 0) beda = el('span', { class: 'riwayat-harga-beda', text: 'sama' });
          else if (r.beda) {
            beda = el('span', { class: 'riwayat-harga-beda ' + (r.beda > 0 ? 'beda-naik' : 'beda-turun') }, [
              ikon(r.beda > 0 ? 'naik' : 'turun'),
              el('span', { text: (r.beda > 0 ? 'naik ' : 'turun ') + formatRupiah(Math.abs(r.beda)) })
            ]);
          }
          return el('li', {}, [
            el('span', { class: 'riwayat-harga-titik', 'aria-hidden': 'true' }),
            el('span', { class: 'riwayat-harga-isi' }, [
              el('strong', { class: 'angka-satuan', text: formatRupiah(r.harga) }),
              el('span', { class: 'daftar-baris-ket', text: (r.berlakuMulai ? 'Mulai ' + tanggalHarga(r.berlakuMulai) : 'Sejak awal') +
                (r.oleh ? ' · ' + r.oleh : '') })
            ]),
            beda
          ]);
        })));
        if ((it.jumlahRiwayatHarga || 0) > riwayat.length) {
          isiKartu.push(el('p', { class: 'kolom-bantuan', text: riwayat.length + ' perubahan terakhir dari ' + it.jumlahRiwayatHarga +
            '. Semuanya ada di tab M_HargaItem.' }));
        }
      }
      return el('section', { class: 'kartu' }, isiKartu);
    }

    /**
     * Lembar Ganti harga (tampilan Bagian 5.7): harga baru, berlaku mulai (hari ini atau
     * tanggal yang sudah lewat), dan kalimat akibatnya terhadap catatan lama.
     */
    function bukaGantiHarga(it) {
      var hariIni = tanggalIso(new Date());
      var riwayat = (it.riwayatHarga || []).slice().reverse(); // lama ke baru
      var lengkap = (it.jumlahRiwayatHarga || 0) <= riwayat.length;
      var kHargaBaru = kolomIsian({ label: 'Harga baru (Rp)', inputmode: 'decimal', kelas: 'isian-angka',
        bantuan: 'Per 1 ' + (it.satuan || 'satuan dasar') + '.' });
      var gMulai = grupPilihan('Berlaku mulai', ['Hari ini', 'Tanggal lain'], 'Hari ini');
      var lain = el('input', { type: 'date', class: 'isian', max: hariIni, 'aria-label': 'Tanggal berlaku mulai' });
      lain.hidden = true;
      gMulai.wadah.appendChild(lain);
      var akibat = el('p', { class: 'kartu-teks', 'aria-live': 'polite' });
      var pesan = el('p', { class: 'pesan-formulir', role: 'alert' });

      function tanggalDipilih() {
        return gMulai.nilai() === 'Tanggal lain' ? lain.value : hariIni;
      }
      function perbaruiAkibat() {
        var tg = tanggalDipilih();
        if (!tg) {
          akibat.textContent = 'Pilih tanggal berlaku mulai.';
          return;
        }
        var sama = null;
        var sebelum = null;
        var sesudah = null;
        riwayat.forEach(function (r) {
          if (r.berlakuMulai === tg) sama = r;
          else if (r.berlakuMulai < tg) sebelum = r;
          else if (!sesudah) sesudah = r;
        });
        var teks;
        if (sama) {
          teks = 'Harga ' + formatRupiah(sama.harga) + ' yang berlaku mulai ' + tanggalHarga(tg) + ' diganti.';
        } else if (sebelum) {
          teks = 'Harga lama ' + formatRupiah(sebelum.harga) + ' tetap dipakai untuk catatan sebelum tanggal ini.';
        } else if (!riwayat.length && it.harga != null) {
          teks = 'Harga lama ' + formatRupiah(it.harga) + ' tetap dipakai untuk catatan sebelum tanggal ini.';
        } else if (lengkap) {
          teks = 'Sebelum tanggal ini ' + it.nama + ' belum punya harga.';
        } else {
          teks = 'Harga lama tetap dipakai untuk catatan sebelum tanggal ini.';
        }
        if (sesudah) {
          teks += ' Harga ' + formatRupiah(sesudah.harga) + ' tetap berlaku mulai ' + tanggalHarga(sesudah.berlakuMulai) + '.';
        }
        akibat.textContent = teks;
      }
      gMulai.input.forEach(function (i) {
        i.addEventListener('change', function () {
          lain.hidden = gMulai.nilai() !== 'Tanggal lain';
          perbaruiAkibat();
        });
      });
      lain.addEventListener('change', perbaruiAkibat);
      perbaruiAkibat();

      bukaLembar({
        judul: 'Ganti harga ' + it.nama,
        isi: [
          el('p', { class: 'kartu-teks', text: 'Harga sekarang ' + (it.harga == null ? 'belum ada' : formatRupiah(it.harga)) +
            (it.satuan ? ' per ' + it.satuan : '') + '.' }),
          kHargaBaru.wadah, gMulai.wadah, akibat, pesan
        ],
        aksi: [
          { teks: 'Batal', jenis: 'kedua' },
          {
            teks: 'Simpan harga',
            jenis: 'utama',
            klik: function (t, l) {
              tulisPesan(pesan, '');
              var harga = bacaAngka(kHargaBaru.input.value);
              var tg = tanggalDipilih();
              var ok = kHargaBaru.galat(harga === null ? 'Isi harga baru.'
                : (isNaN(harga) ? 'Isi angka 0 atau lebih, misalnya 15000.' : ''));
              var okTanggal = gMulai.galat(!tg ? 'Pilih tanggal berlaku mulai.'
                : (tg > hariIni ? 'Pilih hari ini atau tanggal yang sudah lewat.' : ''));
              if (!ok) {
                kHargaBaru.input.focus();
                return;
              }
              if (!okTanggal) {
                lain.focus();
                return;
              }
              aturTombolProses(t, true, 'Menyimpan…');
              l.sibuk(true);
              panggilApi('gantiHarga', { nama: it.nama, harga: harga, berlakuMulai: tg }).then(function (hasil) {
                l.sibuk(false);
                l.tutup();
                Cache.tulis('item', hasil);
                if (!diketik) isi = null;
                gambar(hasil);
                toast('Harga ' + it.nama + ' tersimpan.');
              }).catch(function (err) {
                l.sibuk(false);
                aturTombolProses(t, false);
                if (tanganiSesiBerakhir(err)) return;
                tulisPesan(pesan, pesanGalat(err), 'masalah');
              });
            }
          }
        ]
      });
    }

    function nonaktifkan() {
      var it = itemKini;
      konfirmasi({
        judul: 'Nonaktifkan ' + it.nama + '?',
        teks: it.nama + ' tidak tampil lagi di form. Riwayatnya tetap tersimpan dan bisa diaktifkan lagi.',
        peringatan: it.stock ? 'Stock ' + it.nama + ' masih tercatat ' + formatAngka(it.stock) + ' ' + it.satuan +
          '. Stock itu tetap tercatat dan tetap ikut nilai stock.' : '',
        teksYa: 'Nonaktifkan',
        bahaya: true,
        jalankan: function () { return panggilApi('aturItemAktif', { nama: it.nama, aktif: false }); }
      }).then(function (hasil) {
        if (!hasil) return;
        Cache.tulis('item', hasil);
        isi = null;
        gambar(hasil);
        toast(it.nama + ' dinonaktifkan.');
      });
    }

    function hapusItem() {
      var it = itemKini;
      konfirmasi({
        judul: 'Hapus ' + it.nama + ' dari daftar item?',
        teks: it.nama + ' belum punya catatan, jadi tidak ada riwayat yang hilang. Riwayat harganya ikut terhapus. ' +
          'Tindakan ini tidak bisa dibatalkan dari aplikasi.',
        teksYa: 'Hapus',
        teksProses: 'Menghapus…',
        bahaya: true,
        jalankan: function () { return panggilApi('hapusItem', { nama: it.nama }); }
      }).then(function (hasil) {
        if (!hasil) return;
        Draft.hapus(kunciDraft);
        Cache.tulis('item', hasil);
        location.hash = '#/pengaturan/item';
        toast(hasil.dihapus + ' dihapus dari daftar item.');
      });
    }

    function aktifkan(e) {
      var it = itemKini;
      var t = e.currentTarget;
      aturTombolProses(t, true, 'Menyimpan…');
      panggilApi('aturItemAktif', { nama: it.nama, aktif: true }).then(function (hasil) {
        Cache.tulis('item', hasil);
        isi = null;
        gambar(hasil);
        toast(it.nama + ' aktif lagi.');
      }).catch(function (err) {
        aturTombolProses(t, false);
        if (tanganiSesiBerakhir(err)) return;
        toast(pesanGalat(err), 'masalah');
      });
    }

    function tawarkanStokPembuka(it) {
      bukaLembar({
        judul: 'Isi stok pembuka sekarang?',
        isi: el('p', { text: it.nama + ' mulai dari stock 0 ' + it.satuan + '. Isi stock nyata yang ada sekarang supaya hitungan stock benar.' }),
        aksi: [
          { teks: 'Nanti', jenis: 'kedua' },
          {
            teks: 'Isi stok pembuka',
            jenis: 'utama',
            klik: function (t, l) {
              l.tutup(true);
              bukaSesuaikanStock({ item: it, tercatat: it.stock || 0 }, function (hasil) {
                if (hasil.riwayatItem && itemKini) {
                  itemKini.stock = hasil.riwayatItem.tercatat;
                  itemKini.punyaCatatan = true; // satuan dasar dan nama kini terkunci
                  itemKini.bisaGantiNama = false;
                  if (!diketik) isi = null;
                  gambar(data);
                }
              }, 'Stok pembuka');
            }
          }
        ]
      });
    }

    muatData({
      kunciCache: 'item',
      ambil: function () { return panggilApi('daftarItem'); },
      gambar: function (hasil, dariHp) {
        // Isian yang sedang diketik tidak digambar ulang; hanya data pendukungnya diperbarui.
        if (isi && data && diketik) {
          data = hasil;
          var baruKini = baru ? null : cari(namaAwal);
          if (baruKini) itemKini = baruKini;
          perbaruiRingkas();
          return;
        }
        // Belum ada yang diketik: gambar ulang dengan data server (stock, kunci nama dan satuan).
        isi = null;
        gambar(hasil, dariHp);
      },
      kerangka: function () {
        kosongkan(wadah).appendChild(kerangkaBaris(5));
      },
      galat: function (pesan, cobaLagi) {
        kosongkan(wadah).appendChild(kotakGalat(pesan, cobaLagi));
      },
      penanda: penanda
    });
  }

  /* ---------- Unit chiller dan freezer ---------- */

  function layarUnit(k) {
    aturJudul('Unit');
    var penanda = el('span', { class: 'memperbarui', role: 'status' });
    var wadah = el('div');
    var data = null;
    var tambah = tombol('Tambah', 'utama', { 'aria-haspopup': 'dialog', onclick: function () { bukaUbah(null); } });
    k.wadah.appendChild(el('div', { class: 'layar-isi layar-sempit' }, [
      tautanKembali('Pengaturan', '#/pengaturan'),
      el('div', { class: 'kepala-isi' }, [el('h1', { class: 'judul-layar', text: 'Unit' }), tambah]),
      el('p', { class: 'kartu-teks', text: 'Chiller dan freezer yang dicek di form Suhu, menurut urutan ini.' }),
      penanda,
      wadah
    ]));

    function gambar(d) {
      data = d;
      kosongkan(wadah);
      var unit = d.unit || [];
      if (!unit.length) {
        wadah.appendChild(kotakKosong('Belum ada unit. Ketuk Tambah untuk menambah chiller atau freezer.', 'termometer'));
        return;
      }
      var urut = unit.filter(function (u) { return u.aktif; }).concat(unit.filter(function (u) { return !u.aktif; }));
      wadah.appendChild(el('div', { class: 'daftar', role: 'group', 'aria-label': 'Daftar unit' }, urut.map(function (u) {
        return el('button', { type: 'button', class: 'daftar-baris' + (u.aktif ? '' : ' nonaktif'), 'aria-haspopup': 'dialog',
          onclick: function () { bukaUbah(u); } }, [
          el('span', { class: 'daftar-baris-isi' }, [
            el('span', { class: 'daftar-baris-judul', text: u.nama }),
            el('span', { class: 'daftar-baris-ket', text: u.tipe + ' · ' + teksBatasSuhu(u.tipe, d.batas) }),
            u.aktif ? null : el('span', { class: 'tanda-deret' }, tandaStatus('menunggu', 'Nonaktif'))
          ]),
          ikon('kanan')
        ]);
      })));
    }

    function bukaUbah(u) {
      var kNama = kolomIsian({ label: 'Nama unit', maxlength: 40, nilai: u ? u.nama : '',
        bantuan: u && u.punyaCatatan ? 'Nama tidak bisa diganti karena unit ini sudah punya catatan suhu.' : 'Misalnya Chiller 1 atau Freezer daging.' });
      if (u && u.punyaCatatan) kNama.input.readOnly = true;
      var gTipe = grupPilihan('Tipe', ['Chiller', 'Freezer'], u ? u.tipe : 'Chiller');
      var pesan = el('p', { class: 'pesan-formulir', role: 'alert' });
      var isiLembar = [kNama.wadah, gTipe.wadah,
        el('p', { class: 'kolom-bantuan', text: 'Chiller: ' + teksBatasSuhu('Chiller', data.batas).replace('Normal: ', 'normal ') +
          '. Freezer: ' + teksBatasSuhu('Freezer', data.batas).replace('Normal: ', 'normal ') + '.' }),
        pesan];
      if (u) {
        isiLembar.push(el('div', { class: 'bagian-hapus' }, [
          el('p', { class: 'kartu-teks', text: u.aktif ? 'Aktif. Tampil di form Suhu dan dihitung dalam kelengkapan Suhu.'
            : 'Nonaktif. Tidak tampil di form Suhu. Catatan lamanya tetap tersimpan.' }),
          u.aktif ? tombol('Nonaktifkan', 'bahaya', { onclick: function () { aturAktif(u, false); } })
            : tombol('Aktifkan lagi', 'kedua', { onclick: function () { aturAktif(u, true); } })
        ]));
      }
      function simpan(t, l) {
        tulisPesan(pesan, '');
        var nama = kNama.input.value.trim().replace(/\s+/g, ' ');
        if (!kNama.galat(nama ? '' : 'Isi nama unit.')) {
          kNama.input.focus();
          return;
        }
        aturTombolProses(t, true, 'Menyimpan…');
        l.sibuk(true);
        panggilApi('simpanUnit', { baru: !u, namaLama: u ? u.nama : '', nama: nama, tipe: gTipe.nilai() }).then(function (hasil) {
          Cache.tulis('unit', hasil);
          l.sibuk(false);
          l.tutup();
          gambar(hasil);
          toast('Unit ' + hasil.disimpan + ' tersimpan.');
        }).catch(function (err) {
          l.sibuk(false);
          aturTombolProses(t, false);
          if (tanganiSesiBerakhir(err)) return;
          tulisPesan(pesan, pesanGalat(err), 'masalah');
        });
      }
      bukaLembar({
        judul: u ? u.nama : 'Tambah unit',
        isi: el('form', { class: 'formulir', novalidate: true, onsubmit: function (e) { e.preventDefault(); } }, isiLembar),
        aksi: [{ teks: 'Batal', jenis: 'kedua' }, { teks: 'Simpan unit', jenis: 'utama', klik: simpan }]
      });
    }

    function aturAktif(u, aktif) {
      var jalankan = function () { return panggilApi('aturUnitAktif', { nama: u.nama, aktif: aktif }); };
      var janji = aktif ? jalankan() : konfirmasi({
        judul: 'Nonaktifkan ' + u.nama + '?',
        teks: u.nama + ' tidak tampil lagi di form Suhu dan tidak dihitung dalam kelengkapan Suhu. Catatan lamanya tetap tersimpan.',
        teksYa: 'Nonaktifkan',
        bahaya: true,
        jalankan: jalankan
      });
      janji.then(function (hasil) {
        if (!hasil) return;
        if (lembarKini) lembarKini.tutup(true);
        Cache.tulis('unit', hasil);
        gambar(hasil);
        toast(u.nama + (aktif ? ' aktif lagi.' : ' dinonaktifkan.'));
      }).catch(function (err) {
        if (tanganiSesiBerakhir(err)) return;
        toast(pesanGalat(err), 'masalah');
      });
    }

    muatData({
      kunciCache: 'unit',
      ambil: function () { return panggilApi('daftarUnit'); },
      gambar: gambar,
      kerangka: function () {
        kosongkan(wadah).appendChild(kerangkaBaris(3));
      },
      galat: function (pesan, cobaLagi) {
        kosongkan(wadah).appendChild(kotakGalat(pesan, cobaLagi));
      },
      penanda: penanda
    });
  }

  /* ---------- Pemasok (aplikasi 0.23.0; spesifikasi sistem Bagian 5.1, tampilan Bagian 5.7) ---------- */

  function layarPemasok(k) {
    aturJudul('Pemasok');
    var penanda = el('span', { class: 'memperbarui', role: 'status' });
    var wadah = el('div');
    var data = null;
    var tambah = tombol('Tambah', 'utama', { 'aria-haspopup': 'dialog', onclick: function () { bukaUbah(null); } });
    k.wadah.appendChild(el('div', { class: 'layar-isi layar-sempit' }, [
      tautanKembali('Pengaturan', '#/pengaturan'),
      el('div', { class: 'kepala-isi' }, [el('h1', { class: 'judul-layar', text: 'Pemasok' }), tambah]),
      el('p', { class: 'kartu-teks', text: 'Pemasok dipilih saat mengisi barang masuk di form Stock, bersama harga belinya. ' +
        'Keduanya tidak wajib.' }),
      penanda,
      wadah
    ]));

    /** "Bulan ini Rp 1.250.000 dari 4 kiriman" (pembelian bernilai saja; tanpa harga beli disebut terpisah). */
    function teksBulanIni(b) {
      if (!b) return 'Belum ada barang masuk bulan ini.';
      return 'Bulan ini ' + formatRupiah(b.nilai) + ' dari ' + b.kiriman + ' kiriman' +
        (b.tanpaHarga ? ' (' + b.tanpaHarga + ' item tanpa harga beli)' : '');
    }

    function gambar(d) {
      data = d;
      kosongkan(wadah);
      tambah.disabled = !d.siap;
      if (!d.siap) {
        wadah.appendChild(el('p', { class: 'pesan-formulir tinjau' }, [ikon('info'), el('span', {
          text: 'Pemasok dan harga beli belum bisa dicatat. Minta pemilik Sheet menjalankan ulang setupSpreadsheet di editor Apps Script.' })]));
        return;
      }
      var daftar = d.pemasok || [];
      if (!daftar.length) {
        wadah.appendChild(kotakKosong('Belum ada pemasok. Ketuk Tambah untuk menambah pemasok pertama.', 'truk'));
        return;
      }
      var urut = daftar.filter(function (p) { return p.aktif; }).concat(daftar.filter(function (p) { return !p.aktif; }));
      wadah.appendChild(el('div', { class: 'daftar', role: 'group', 'aria-label': 'Daftar pemasok' }, urut.map(function (p) {
        return el('button', { type: 'button', class: 'daftar-baris' + (p.aktif ? '' : ' nonaktif'), 'aria-haspopup': 'dialog',
          onclick: function () { bukaUbah(p); } }, [
          el('span', { class: 'daftar-baris-isi' }, [
            el('span', { class: 'daftar-baris-judul', text: p.nama }),
            p.kontak ? el('span', { class: 'daftar-baris-ket', text: p.kontak }) : null,
            el('span', { class: 'daftar-baris-ket', text: teksBulanIni(p.bulanIni) }),
            p.aktif ? null : el('span', { class: 'tanda-deret' }, tandaStatus('menunggu', 'Nonaktif'))
          ]),
          ikon('kanan')
        ]);
      })));
      if (d.tanpaPemasok) {
        wadah.appendChild(el('p', { class: 'kolom-bantuan bagian', text: 'Barang masuk tanpa pemasok bulan ini: ' +
          formatRupiah(d.tanpaPemasok.nilai) + ' dari ' + d.tanpaPemasok.kiriman + ' kiriman' +
          (d.tanpaPemasok.tanpaHarga ? ' (' + d.tanpaPemasok.tanpaHarga + ' item tanpa harga beli)' : '') + '.' }));
      }
      wadah.appendChild(el('p', { class: 'kolom-bantuan', text: 'Nilai = barang masuk × harga beli yang dicatat. Rekap per bulan ada di rekap bulanan (Laporan).' }));
    }

    function bukaUbah(p) {
      var kNama = kolomIsian({ label: 'Nama pemasok', maxlength: 40, nilai: p ? p.nama : '',
        bantuan: p && p.punyaCatatan ? 'Nama tidak bisa diganti karena pemasok ini sudah tercatat di barang masuk.' : 'Misalnya Toko Sumber Segar.' });
      if (p && p.punyaCatatan) kNama.input.readOnly = true;
      var kKontak = kolomIsian({ label: 'Kontak (tidak wajib)', maxlength: 60, nilai: p ? p.kontak : '', inputmode: 'tel',
        bantuan: 'Nomor HP atau nama sales.' });
      var kCatatan = kolomIsian({ label: 'Catatan (tidak wajib)', maxlength: 120, nilai: p ? p.catatan : '',
        bantuan: 'Misalnya hari kirim atau barang yang biasa dibeli.' });
      var pesan = el('p', { class: 'pesan-formulir', role: 'alert' });
      var isiLembar = [kNama.wadah, kKontak.wadah, kCatatan.wadah, pesan];
      if (p) {
        isiLembar.push(el('div', { class: 'bagian-hapus' }, [
          el('p', { class: 'kartu-teks', text: p.aktif ? 'Aktif. Bisa dipilih di form Stock.'
            : 'Nonaktif. Tidak bisa dipilih di form Stock. Catatan lamanya tetap tersimpan.' }),
          p.aktif ? tombol('Nonaktifkan', 'bahaya', { onclick: function () { aturAktif(p, false); } })
            : tombol('Aktifkan lagi', 'kedua', { onclick: function () { aturAktif(p, true); } })
        ]));
      }
      function simpan(t, l) {
        tulisPesan(pesan, '');
        var nama = kNama.input.value.trim().replace(/\s+/g, ' ');
        if (!kNama.galat(nama ? '' : 'Isi nama pemasok.')) {
          kNama.input.focus();
          return;
        }
        aturTombolProses(t, true, 'Menyimpan…');
        l.sibuk(true);
        panggilApi('simpanPemasok', { baru: !p, namaLama: p ? p.nama : '', nama: nama, kontak: kKontak.input.value,
          catatan: kCatatan.input.value }).then(function (hasil) {
          Cache.tulis('pemasok', hasil);
          l.sibuk(false);
          l.tutup();
          gambar(hasil);
          toast('Pemasok ' + hasil.disimpan + ' tersimpan.');
        }).catch(function (err) {
          l.sibuk(false);
          aturTombolProses(t, false);
          if (tanganiSesiBerakhir(err)) return;
          tulisPesan(pesan, pesanGalat(err), 'masalah');
        });
      }
      bukaLembar({
        judul: p ? p.nama : 'Tambah pemasok',
        isi: el('form', { class: 'formulir', novalidate: true, onsubmit: function (e) { e.preventDefault(); } }, isiLembar),
        aksi: [{ teks: 'Batal', jenis: 'kedua' }, { teks: 'Simpan pemasok', jenis: 'utama', klik: simpan }]
      });
    }

    function aturAktif(p, aktif) {
      var jalankan = function () { return panggilApi('aturPemasokAktif', { nama: p.nama, aktif: aktif }); };
      var janji = aktif ? jalankan() : konfirmasi({
        judul: 'Nonaktifkan ' + p.nama + '?',
        teks: p.nama + ' tidak bisa dipilih lagi di form Stock. Catatan barang masuk dari pemasok ini tetap tersimpan.',
        teksYa: 'Nonaktifkan',
        bahaya: true,
        jalankan: jalankan
      });
      janji.then(function (hasil) {
        if (!hasil) return;
        if (lembarKini) lembarKini.tutup(true);
        Cache.tulis('pemasok', hasil);
        gambar(hasil);
        toast(p.nama + (aktif ? ' aktif lagi.' : ' dinonaktifkan.'));
      }).catch(function (err) {
        if (tanganiSesiBerakhir(err)) return;
        toast(pesanGalat(err), 'masalah');
      });
    }

    muatData({
      kunciCache: 'pemasok',
      ambil: function () { return panggilApi('daftarPemasok'); },
      gambar: gambar,
      kerangka: function () {
        kosongkan(wadah).appendChild(kerangkaBaris(3));
      },
      galat: function (pesan, cobaLagi) {
        kosongkan(wadah).appendChild(kotakGalat(pesan, cobaLagi));
      },
      penanda: penanda
    });
  }

  /* ---------- Kategori (dengan urutan) dan satuan ---------- */

  function layarKategoriSatuan(k) {
    aturJudul('Kategori dan satuan');
    var penanda = el('span', { class: 'memperbarui', role: 'status' });
    var wadahKat = el('div');
    var wadahSat = el('div');
    var data = null;
    var urutan = null; // nama kategori menurut urutan yang belum disimpan
    var tambahKat = tombol('Tambah', 'utama', { 'aria-haspopup': 'dialog', 'aria-label': 'Tambah kategori', onclick: function () { bukaKategori(null); } });
    var tambahSat = tombol('Tambah', 'utama', { 'aria-haspopup': 'dialog', 'aria-label': 'Tambah satuan', onclick: function () { bukaSatuan(null); } });
    k.wadah.appendChild(el('div', { class: 'layar-isi layar-sempit' }, [
      tautanKembali('Pengaturan', '#/pengaturan'),
      el('h1', { class: 'judul-layar', text: 'Kategori dan satuan' }),
      penanda,
      el('section', { class: 'bagian', 'aria-labelledby': 'judul-kategori' }, [
        el('div', { class: 'kepala-isi' }, [el('h2', { class: 'judul-bagian', id: 'judul-kategori', text: 'Kategori' }), tambahKat]),
        el('p', { class: 'kartu-teks', text: 'Urutan ini dipakai form Stock, tab Harian, dan laporan PDF.' }),
        wadahKat
      ]),
      el('section', { class: 'bagian', 'aria-labelledby': 'judul-satuan' }, [
        el('div', { class: 'kepala-isi' }, [el('h2', { class: 'judul-bagian', id: 'judul-satuan', text: 'Satuan' }), tambahSat]),
        el('p', { class: 'kartu-teks', text: 'Satuan yang bisa dipilih untuk item. Tidak ada konversi antar satuan.' }),
        wadahSat
      ])
    ]));

    function cariKat(nama) {
      return (data.kategori || []).filter(function (x) { return x.nama === nama; })[0];
    }

    function gambar(d) {
      data = d;
      urutan = null;
      gambarKategori();
      gambarSatuan();
    }

    function gambarKategori() {
      kosongkan(wadahKat);
      var kat = data.kategori || [];
      if (!kat.length) {
        wadahKat.appendChild(kotakKosong('Belum ada kategori. Ketuk Tambah untuk membuat kategori pertama.', 'label'));
        return;
      }
      var nama = urutan || kat.map(function (x) { return x.nama; });
      var berubah = !!urutan && urutan.join('\n') !== kat.map(function (x) { return x.nama; }).join('\n');
      var daftar = el('ol', { class: 'daftar daftar-urut', 'aria-label': 'Urutan kategori' });
      nama.forEach(function (n, i) {
        var x = cariKat(n);
        if (!x) return;
        function geser(arah) {
          var baru = nama.slice();
          var j = i + arah;
          baru[i] = baru[j];
          baru[j] = n;
          urutan = baru;
          gambarKategori();
          var t = wadahKat.querySelector('[data-urut="' + (arah < 0 ? 'naik' : 'turun') + '-' + j + '"]');
          if (!t || t.disabled) t = wadahKat.querySelector('[data-urut="' + (arah < 0 ? 'turun' : 'naik') + '-' + j + '"]');
          if (t) t.focus();
        }
        daftar.appendChild(el('li', { class: 'baris-urut' + (x.aktif ? '' : ' nonaktif') }, [
          el('button', { type: 'button', class: 'baris-urut-nama', 'aria-haspopup': 'dialog', onclick: function () { bukaKategori(x); } }, [
            el('span', { class: 'daftar-baris-isi' }, [
              el('span', { class: 'daftar-baris-judul', text: x.nama }),
              el('span', { class: 'daftar-baris-ket', text: x.jumlahItem + ' item' + (x.jumlahItem !== x.jumlahItemAktif ? ', ' + x.jumlahItemAktif + ' aktif' : '') }),
              x.aktif ? null : el('span', { class: 'tanda-deret' }, tandaStatus('menunggu', 'Nonaktif'))
            ])
          ]),
          el('button', { type: 'button', class: 'tombol-ikon', 'data-urut': 'naik-' + i, 'aria-label': 'Naikkan ' + x.nama, disabled: i === 0,
            onclick: function () { geser(-1); } }, ikon('atas')),
          el('button', { type: 'button', class: 'tombol-ikon', 'data-urut': 'turun-' + i, 'aria-label': 'Turunkan ' + x.nama, disabled: i === nama.length - 1,
            onclick: function () { geser(1); } }, ikon('bawah'))
        ]));
      });
      wadahKat.appendChild(daftar);
      if (berubah) {
        var pesan = el('p', { class: 'pesan-formulir', role: 'alert' });
        var simpan = tombol('Simpan urutan', 'utama');
        var batal = tombol('Batal', 'kedua', { onclick: function () { urutan = null; gambarKategori(); } });
        simpan.addEventListener('click', function () {
          aturTombolProses(simpan, true, 'Menyimpan…');
          panggilApi('urutKategori', { urutan: urutan }).then(function (hasil) {
            Cache.tulis('kategori-satuan', hasil);
            gambar(hasil);
            toast('Urutan kategori tersimpan.');
          }).catch(function (err) {
            aturTombolProses(simpan, false);
            if (tanganiSesiBerakhir(err)) return;
            tulisPesan(pesan, pesanGalat(err), 'masalah');
          });
        });
        wadahKat.appendChild(el('div', { class: 'deret-tombol urut-aksi' }, [batal, simpan]));
        wadahKat.appendChild(pesan);
      }
    }

    function gambarSatuan() {
      kosongkan(wadahSat);
      var sat = data.satuan || [];
      if (!sat.length) {
        wadahSat.appendChild(kotakKosong('Belum ada satuan. Ketuk Tambah untuk menambah satuan.'));
        return;
      }
      var jenis = (data.jenisSatuan || []).slice();
      sat.forEach(function (s) { if (jenis.indexOf(s.jenis) < 0) jenis.push(s.jenis); });
      jenis.forEach(function (j) {
        var isi = sat.filter(function (s) { return s.jenis === j; });
        if (!isi.length) return;
        wadahSat.appendChild(el('h3', { class: 'judul-sub', text: j || 'Tanpa jenis' }));
        wadahSat.appendChild(el('div', { class: 'daftar', role: 'group', 'aria-label': 'Satuan ' + (j || 'tanpa jenis') }, isi.map(function (s) {
          return el('button', { type: 'button', class: 'daftar-baris' + (s.aktif ? '' : ' nonaktif'), 'aria-haspopup': 'dialog',
            onclick: function () { bukaSatuan(s); } }, [
            el('span', { class: 'daftar-baris-isi' }, [
              el('span', { class: 'daftar-baris-judul', text: s.satuan }),
              el('span', { class: 'daftar-baris-ket', text: s.jumlahItem ? 'Dipakai ' + s.jumlahItem + ' item' : 'Belum dipakai item' }),
              s.aktif ? null : el('span', { class: 'tanda-deret' }, tandaStatus('menunggu', 'Nonaktif'))
            ]),
            ikon('kanan')
          ]);
        })));
      });
    }

    /** Lembar ubah bersama kategori dan satuan. */
    function bukaLembarMaster(o) {
      var pesan = el('p', { class: 'pesan-formulir', role: 'alert' });
      var isi = o.kolom.concat([pesan]);
      if (o.lama) {
        var bisaNonaktif = !o.lama.jumlahItemAktif;
        isi.push(el('div', { class: 'bagian-hapus' }, o.lama.aktif ? [
          el('p', { class: 'kartu-teks', text: bisaNonaktif ? 'Aktif. ' + o.teksAktif
            : 'Tidak bisa dinonaktifkan: masih dipakai ' + o.lama.jumlahItemAktif + ' item aktif.' }),
          bisaNonaktif ? tombol('Nonaktifkan', 'bahaya', { onclick: function () { aturAktif(o, false); } }) : null
        ] : [
          el('p', { class: 'kartu-teks', text: 'Nonaktif. ' + o.teksNonaktif }),
          tombol('Aktifkan lagi', 'kedua', { onclick: function () { aturAktif(o, true); } })
        ]));
      }
      function simpan(t, l) {
        tulisPesan(pesan, '');
        var kirim = o.kumpul();
        if (!kirim) return;
        aturTombolProses(t, true, 'Menyimpan…');
        l.sibuk(true);
        panggilApi(o.aksiSimpan, kirim).then(function (hasil) {
          Cache.tulis('kategori-satuan', hasil);
          l.sibuk(false);
          l.tutup();
          gambar(hasil);
          toast(o.label + ' ' + hasil.disimpan + ' tersimpan.');
        }).catch(function (err) {
          l.sibuk(false);
          aturTombolProses(t, false);
          if (tanganiSesiBerakhir(err)) return;
          tulisPesan(pesan, pesanGalat(err), 'masalah');
        });
      }
      bukaLembar({
        judul: o.judul,
        isi: el('form', { class: 'formulir', novalidate: true, onsubmit: function (e) { e.preventDefault(); } }, isi),
        aksi: [{ teks: 'Batal', jenis: 'kedua' }, { teks: 'Simpan ' + o.label.toLowerCase(), jenis: 'utama', klik: simpan }]
      });
    }

    function aturAktif(o, aktif) {
      var jalankan = function () { return panggilApi(o.aksiAktif, o.isiAktif(aktif)); };
      var janji = aktif ? jalankan() : konfirmasi({
        judul: 'Nonaktifkan ' + o.nama + '?',
        teks: o.teksNonaktif,
        teksYa: 'Nonaktifkan',
        bahaya: true,
        jalankan: jalankan
      });
      janji.then(function (hasil) {
        if (!hasil) return;
        if (lembarKini) lembarKini.tutup(true);
        Cache.tulis('kategori-satuan', hasil);
        gambar(hasil);
        toast(o.label + ' ' + o.nama + (aktif ? ' aktif lagi.' : ' dinonaktifkan.'));
      }).catch(function (err) {
        if (tanganiSesiBerakhir(err)) return;
        toast(pesanGalat(err), 'masalah');
      });
    }

    function bukaKategori(x) {
      var terkunci = x && x.jumlahItem > 0;
      var kNama = kolomIsian({ label: 'Nama kategori', maxlength: 40, nilai: x ? x.nama : '',
        bantuan: terkunci ? 'Nama tidak bisa diganti karena sudah dipakai ' + x.jumlahItem + ' item.' : 'Misalnya Protein, Sayur, atau Bumbu.' });
      if (terkunci) kNama.input.readOnly = true;
      bukaLembarMaster({
        judul: x ? x.nama : 'Tambah kategori',
        label: 'Kategori',
        nama: x ? x.nama : '',
        lama: x,
        kolom: [kNama.wadah],
        teksAktif: 'Tampil sebagai pilihan di form Stock dan Pengaturan → Item.',
        teksNonaktif: 'Kategori nonaktif tidak tampil di form Stock dan tidak bisa dipilih untuk item. Catatan lamanya tetap tersimpan.',
        aksiSimpan: 'simpanKategori',
        aksiAktif: 'aturKategoriAktif',
        isiAktif: function (aktif) { return { nama: x.nama, aktif: aktif }; },
        kumpul: function () {
          var nama = kNama.input.value.trim().replace(/\s+/g, ' ');
          if (!kNama.galat(nama ? '' : 'Isi nama kategori.')) return null;
          return { baru: !x, namaLama: x ? x.nama : '', nama: nama };
        }
      });
    }

    function bukaSatuan(s) {
      var terkunci = s && s.jumlahItem > 0;
      var kNama = kolomIsian({ label: 'Satuan', maxlength: 20, nilai: s ? s.satuan : '',
        bantuan: terkunci ? 'Satuan tidak bisa diganti karena sudah dipakai ' + s.jumlahItem + ' item.' : 'Tulis singkat dengan huruf kecil, misalnya loyang.',
        atribut: { autocapitalize: 'none' } });
      if (terkunci) kNama.input.readOnly = true;
      var gJenis = grupPilihan('Jenis', data.jenisSatuan || ['Berat', 'Isi', 'Hitungan', 'Kemasan'], s ? s.jenis : 'Kemasan');
      bukaLembarMaster({
        judul: s ? s.satuan : 'Tambah satuan',
        label: 'Satuan',
        nama: s ? s.satuan : '',
        lama: s,
        kolom: [kNama.wadah, gJenis.wadah],
        teksAktif: 'Bisa dipilih untuk item.',
        teksNonaktif: 'Satuan nonaktif tidak bisa dipilih untuk item baru. Item yang sudah memakainya tidak berubah.',
        aksiSimpan: 'simpanSatuan',
        aksiAktif: 'aturSatuanAktif',
        isiAktif: function (aktif) { return { satuan: s.satuan, aktif: aktif }; },
        kumpul: function () {
          var nama = kNama.input.value.trim().replace(/\s+/g, ' ');
          var ok = [kNama.galat(nama ? '' : 'Isi satuan.'), gJenis.galat(gJenis.nilai() ? '' : 'Pilih jenis satuan.')];
          if (ok.indexOf(false) >= 0) return null;
          return { baru: !s, satuanLama: s ? s.satuan : '', satuan: nama, jenis: gJenis.nilai() };
        }
      });
    }

    muatData({
      kunciCache: 'kategori-satuan',
      ambil: function () { return panggilApi('daftarKategoriSatuan'); },
      gambar: function (d) {
        if (urutan && data) {
          data = d; // urutan yang sedang diatur tidak dibuang
          return;
        }
        gambar(d);
      },
      kerangka: function () {
        kosongkan(wadahKat).appendChild(kerangkaBaris(3));
        kosongkan(wadahSat).appendChild(kerangkaBaris(3));
      },
      galat: function (pesan, cobaLagi) {
        kosongkan(wadahKat).appendChild(kotakGalat(pesan, cobaLagi));
      },
      penanda: penanda
    });
  }

  /* ---------- Resep (spesifikasi sistem Bagian 5.3, tampilan Bagian 5.7) ---------- */

  function hrefResep(nama) {
    return '#/pengaturan/resep/' + encodeURIComponent(nama);
  }

  /** "Rp 145.000 per resep · Rp 29.000 per liter", atau keterangan bahan yang belum punya harga. */
  function teksBiayaResep(biaya, perSatuan, satuan, tanpaHarga) {
    if (tanpaHarga.length) {
      return 'Harga ' + tanpaHarga.join(', ') + ' belum diisi, jadi perkiraan biaya belum lengkap.';
    }
    return 'Perkiraan biaya satu resep ' + formatRupiah(biaya) +
      (perSatuan != null ? ' · ' + formatRupiah(perSatuan) + ' per ' + (satuan || 'satuan') : '') + '.';
  }

  function layarResep(k) {
    aturJudul('Resep');
    var penanda = el('span', { class: 'memperbarui', role: 'status' });
    var wadah = el('div');
    var tambah = el('a', { class: 'tombol tombol-utama', href: '#/pengaturan/resep-baru' }, el('span', { class: 'tombol-teks', text: 'Tambah' }));
    k.wadah.appendChild(el('div', { class: 'layar-isi layar-sempit' }, [
      tautanKembali('Pengaturan', '#/pengaturan'),
      el('div', { class: 'kepala-isi' }, [el('h1', { class: 'judul-layar', text: 'Resep' }), tambah]),
      el('p', { class: 'kartu-teks', text: 'Prep List diisi dalam jumlah resep. Stock barang jadi bertambah dan stock bahan berkurang otomatis.' }),
      penanda,
      wadah
    ]));

    function gambar(data) {
      kosongkan(wadah);
      var resep = data.resep || [];
      if (!resep.length) {
        wadah.appendChild(kotakKosong('Belum ada resep. Ketuk Tambah untuk membuat resep pertama.', 'resep'));
        return;
      }
      wadah.appendChild(el('nav', { class: 'daftar', 'aria-label': 'Daftar resep' }, resep.map(function (r) {
        var ket = [r.bahan.length + ' bahan'];
        if (r.masaSimpan != null) ket.push('masa simpan ' + r.masaSimpan + ' hari');
        if (r.hargaPerSatuan != null) ket.push(formatRupiah(r.hargaPerSatuan) + ' per ' + r.satuan);
        return el('a', { class: 'daftar-baris' + (r.aktif ? '' : ' nonaktif'), href: hrefResep(r.itemHasil) }, [
          el('span', { class: 'daftar-baris-isi' }, [
            el('span', { class: 'daftar-baris-judul', text: r.itemHasil + ', ' + formatAngka(r.hasil) + (r.satuan ? ' ' + r.satuan : '') }),
            el('span', { class: 'daftar-baris-ket', text: ket.join(' · ') }),
            !r.aktif || r.masalah.length ? el('span', { class: 'tanda-deret bungkus' }, [
              r.aktif ? null : tandaStatus('menunggu', 'Nonaktif'),
              r.masalah.length ? tandaStatus('tinjau', r.masalah[0]) : null
            ]) : null
          ]),
          ikon('kanan')
        ]);
      })));
    }

    muatData({
      kunciCache: 'resep',
      ambil: function () { return panggilApi('daftarResep'); },
      gambar: gambar,
      kerangka: function () {
        kosongkan(wadah).appendChild(kerangkaBaris(3));
      },
      galat: function (pesan, cobaLagi) {
        kosongkan(wadah).appendChild(kotakGalat(pesan, cobaLagi));
      },
      penanda: penanda
    });
  }

  /**
   * Buat dan ubah resep (tampilan Bagian 5.7): item hasil, hasil per 1 resep,
   * masa simpan (opsional), daftar bahan (qty per 1 resep dalam satuan dasar
   * tiap bahan), perkiraan biaya dari harga bahan, dan nonaktifkan. Item hasil
   * resep yang sudah ada tidak bisa diganti. Isian tersimpan sebagai draft.
   */
  function layarResepUbah(k) {
    var baru = !k.cocok[1];
    var namaAwal = '';
    if (!baru) {
      try {
        namaAwal = decodeURIComponent(k.cocok[1]);
      } catch (err) {
        namaAwal = k.cocok[1];
      }
    }
    aturJudul(baru ? 'Resep baru' : namaAwal);
    var kunciDraft = 'resep:' + (baru ? '+baru' : namaAwal.toLowerCase());
    var penanda = el('span', { class: 'memperbarui', role: 'status' });
    var catatanDraft = el('p', { class: 'catatan-draft', 'aria-live': 'polite' });
    var wadah = el('div');
    k.wadah.appendChild(el('div', { class: 'layar-isi layar-sempit' }, [
      tautanKembali('Resep', '#/pengaturan/resep'),
      el('h1', { class: 'judul-layar', text: baru ? 'Resep baru' : namaAwal }),
      catatanDraft,
      penanda,
      wadah
    ]));

    var data = null;
    var isi = null; // { itemHasil, hasil, masaSimpan, bahan: [{ id, item, qty }] }
    var resepKini = null;
    var d = Draft.baca(kunciDraft);
    if (d && d.data) {
      isi = d.data;
      catatanDraft.textContent = 'Draft tersimpan ' + jam(new Date(d.waktu).toISOString());
    }

    function simpanDraft() {
      var waktu = Draft.simpan(kunciDraft, isi);
      if (waktu) catatanDraft.textContent = 'Draft tersimpan ' + jam(new Date(waktu).toISOString());
    }

    function infoItem(nama) {
      var daftar = data && data.item || [];
      for (var i = 0; i < daftar.length; i++) if (daftar[i].nama.toLowerCase() === String(nama).toLowerCase()) return daftar[i];
      return { nama: nama, satuan: '', harga: null, aktif: true };
    }

    function cariResep(nama) {
      var daftar = data && data.resep || [];
      for (var i = 0; i < daftar.length; i++) if (daftar[i].itemHasil.toLowerCase() === String(nama).toLowerCase()) return daftar[i];
      return null;
    }

    function dariResep(r) {
      return {
        itemHasil: r.itemHasil,
        hasil: String(r.hasil).replace('.', ','),
        masaSimpan: r.masaSimpan == null ? '' : String(r.masaSimpan),
        bahan: r.bahan.map(function (b) { return { id: buatId(), item: b.item, qty: String(b.qty).replace('.', ',') }; })
      };
    }

    function gambar(hasil, dariHp) {
      data = hasil;
      resepKini = baru ? null : cariResep(namaAwal);
      kosongkan(wadah);
      if (!baru && !resepKini) {
        if (!dariHp) wadah.appendChild(kotakKosong('Resep ' + namaAwal + ' tidak ditemukan. Kembali ke daftar resep.', 'resep'));
        return;
      }
      if (!isi) isi = baru ? { itemHasil: '', hasil: '', masaSimpan: '', bahan: [] } : dariResep(resepKini);
      gambarIsian();
    }

    function gambarIsian() {
      kosongkan(wadah);
      var hasilItem = isi.itemHasil ? infoItem(isi.itemHasil) : null;
      var satuanHasil = hasilItem ? hasilItem.satuan : '';
      var pesan = el('p', { class: 'pesan-formulir', role: 'alert' });

      // Item hasil
      var bagianItem;
      if (baru) {
        var pilihHasil = tombol(isi.itemHasil ? 'Ganti item hasil' : 'Pilih item hasil', 'kedua', { 'aria-haspopup': 'dialog' });
        pilihHasil.addEventListener('click', function () {
          bukaPilihItem({
            judul: 'Pilih item hasil',
            daftar: (data.item || []).filter(function (it) { return it.aktif && !it.punyaResep; }),
            kosong: 'Semua item aktif sudah punya resep.',
            ket: function (it) { return [it.kategori, it.satuan].filter(Boolean).join(' · '); },
            pilih: function (it) {
              isi.itemHasil = it.nama;
              isi.bahan = isi.bahan.filter(function (b) { return b.item.toLowerCase() !== it.nama.toLowerCase(); });
              simpanDraft();
              gambarIsian();
            }
          });
        });
        bagianItem = el('div', { class: 'kolom' }, [
          el('span', { class: 'kolom-label', text: 'Item hasil' }),
          isi.itemHasil ? el('p', { class: 'nilai-terpilih' }, [el('strong', { text: isi.itemHasil }),
            el('span', { class: 'otomatis', text: ' · ' + [hasilItem.kategori, satuanHasil].filter(Boolean).join(' · ') })]) : null,
          el('p', { class: 'kolom-bantuan', text: 'Barang jadi yang dibuat lewat Prep List. Harus terdaftar di daftar item.' }),
          el('div', {}, pilihHasil)
        ]);
      } else {
        bagianItem = el('div', { class: 'kolom' }, [
          el('span', { class: 'kolom-label', text: 'Item hasil' }),
          el('p', { class: 'nilai-terpilih' }, [el('strong', { text: isi.itemHasil }),
            el('span', { class: 'otomatis', text: satuanHasil ? ' · ' + satuanHasil : '' })])
        ]);
      }

      var kHasil = kolomIsian({ label: 'Hasil per 1 resep' + (satuanHasil ? ' (' + satuanHasil + ')' : ''), inputmode: 'decimal',
        kelas: 'isian-angka', nilai: isi.hasil });
      var kMasa = kolomIsian({ label: 'Masa simpan (hari)', inputmode: 'numeric', kelas: 'isian-angka', nilai: isi.masaSimpan,
        bantuan: 'Tidak wajib. Berapa hari barang jadi masih baik dipakai sejak dibuat.', maxlength: 3 });
      kHasil.input.addEventListener('input', function () { isi.hasil = kHasil.input.value; simpanDraft(); perbaruiBiaya(); });
      kMasa.input.addEventListener('input', function () { isi.masaSimpan = kMasa.input.value; simpanDraft(); });

      // Bahan
      var daftarBahan = el('ul', { class: 'daftar daftar-bahan', 'aria-label': 'Bahan per 1 resep' });
      var kolomBahan = [];
      isi.bahan.forEach(function (b) {
        var it = infoItem(b.item);
        var id = 'bahan-' + (++nomorKolom);
        var inQty = el('input', { class: 'isian isian-angka', id: id, type: 'text', inputmode: 'decimal', autocomplete: 'off' });
        inQty.value = b.qty || '';
        var galat = el('p', { class: 'kolom-galat' });
        inQty.addEventListener('input', function () {
          b.qty = inQty.value;
          inQty.setAttribute('aria-invalid', 'false');
          kosongkan(galat);
          simpanDraft();
          perbaruiBiaya();
        });
        kolomBahan.push({ b: b, input: inQty, galat: galat });
        daftarBahan.appendChild(el('li', { class: 'baris-bahan' }, [
          el('label', { class: 'baris-bahan-nama', for: id }, [
            el('span', { class: 'daftar-baris-judul', text: b.item }),
            el('span', { class: 'sr', text: ', jumlah per 1 resep' }),
            it.aktif === false ? el('span', { class: 'blok' }, tandaStatus('tinjau', 'Nonaktif')) : null
          ]),
          el('div', { class: 'baris-angka' }, [inQty, el('span', { class: 'satuan-tetap', text: it.satuan })]),
          el('button', { type: 'button', class: 'tombol-ikon', 'aria-label': 'Hapus ' + b.item + ' dari bahan',
            onclick: function () {
              isi.bahan = isi.bahan.filter(function (x) { return x !== b; });
              simpanDraft();
              gambarIsian();
            } }, ikon('sampah')),
          galat
        ]));
      });
      var tambahBahan = tombol('Tambah bahan', 'kedua', { 'aria-haspopup': 'dialog' });
      tambahBahan.insertBefore(ikon('tambah'), tambahBahan.lastChild);
      tambahBahan.addEventListener('click', function () {
        var sudah = {};
        isi.bahan.forEach(function (b) { sudah[b.item.toLowerCase()] = true; });
        if (isi.itemHasil) sudah[isi.itemHasil.toLowerCase()] = true;
        bukaPilihItem({
          judul: 'Tambah bahan',
          daftar: (data.item || []).filter(function (it) { return it.aktif && !sudah[it.nama.toLowerCase()]; }),
          kosong: 'Tidak ada item lain yang bisa menjadi bahan.',
          ket: function (it) {
            return [it.kategori, it.satuan, it.harga != null ? formatRupiah(it.harga) + ' per ' + it.satuan + (it.hargaDariResep ? ' (dari resep)' : '') : 'tanpa harga']
              .filter(Boolean).join(' · ');
          },
          pilih: function (it) {
            var b = { id: buatId(), item: it.nama, qty: '' };
            isi.bahan.push(b);
            simpanDraft();
            gambarIsian();
            var input = wadah.querySelectorAll('.daftar-bahan input');
            if (input.length && !apakahSentuh()) input[input.length - 1].focus();
          }
        });
      });
      var biaya = el('p', { class: 'biaya-resep', 'aria-live': 'polite' });

      function perbaruiBiaya() {
        var total = 0;
        var tanpa = [];
        isi.bahan.forEach(function (b) {
          var it = infoItem(b.item);
          var q = bacaAngka(b.qty);
          if (it.harga == null) tanpa.push(b.item);
          else if (q > 0) total += q * it.harga;
        });
        var h = bacaAngka(isi.hasil);
        if (!isi.bahan.length) {
          biaya.textContent = 'Perkiraan biaya muncul setelah bahan ditambahkan.';
          return;
        }
        biaya.textContent = teksBiayaResep(total, h > 0 ? total / h : null, satuanHasil, tanpa);
      }
      perbaruiBiaya();

      var simpan = tombol('Simpan resep', 'utama');
      simpan.addEventListener('click', function () {
        if (simpan.disabled) return;
        tulisPesan(pesan, '');
        var ok = true;
        var h = bacaAngka(isi.hasil);
        if (!kHasil.galat(h === null ? 'Isi hasil per 1 resep.' : (isNaN(h) || !(h > 0) ? 'Isi angka lebih dari 0, misalnya 5.' : ''))) ok = false;
        var masa = String(isi.masaSimpan || '').trim();
        if (!kMasa.galat(masa !== '' && !/^\d{1,3}$/.test(masa) ? 'Isi jumlah hari dengan angka bulat, misalnya 3, atau kosongkan.' : '')) ok = false;
        kolomBahan.forEach(function (x) {
          var q = bacaAngka(x.b.qty);
          var salah = q === null || isNaN(q) || !(q > 0);
          x.input.setAttribute('aria-invalid', salah ? 'true' : 'false');
          kosongkan(x.galat);
          if (salah) {
            ok = false;
            x.galat.appendChild(ikonStatus('masalah'));
            x.galat.appendChild(el('span', { text: 'Isi jumlah ' + x.b.item + ' per 1 resep, lebih dari 0.' }));
          }
        });
        if (!isi.itemHasil) {
          tulisPesan(pesan, 'Pilih item hasil.', 'masalah');
          return;
        }
        if (!isi.bahan.length) {
          tulisPesan(pesan, 'Tambah minimal satu bahan.', 'masalah');
          return;
        }
        if (!ok) {
          var salahPertama = wadah.querySelector('[aria-invalid="true"]');
          if (salahPertama) salahPertama.focus();
          return;
        }
        aturTombolProses(simpan, true, 'Menyimpan…');
        panggilApi('simpanResep', {
          baru: baru,
          itemHasil: isi.itemHasil,
          hasil: h,
          masaSimpan: masa,
          bahan: isi.bahan.map(function (b) { return { item: b.item, qty: bacaAngka(b.qty) }; })
        }).then(function (hasil) {
          Draft.hapus(kunciDraft);
          Cache.tulis('resep', hasil);
          toast('Resep ' + isi.itemHasil + ' tersimpan.');
          location.hash = '#/pengaturan/resep';
        }).catch(function (err) {
          aturTombolProses(simpan, false);
          if (tanganiSesiBerakhir(err)) return;
          tulisPesan(pesan, pesanGalat(err), 'masalah');
        });
      });

      wadah.appendChild(el('section', { class: 'kartu formulir' }, [bagianItem, kHasil.wadah, kMasa.wadah]));
      wadah.appendChild(el('section', { class: 'kartu formulir' }, [
        el('h2', { class: 'kartu-judul', text: 'Bahan per 1 resep' }),
        el('p', { class: 'kolom-bantuan', text: 'Jumlah tiap bahan dalam satuan dasarnya.' }),
        isi.bahan.length ? daftarBahan : kotakKosong('Belum ada bahan. Ketuk Tambah bahan.'),
        el('div', {}, tambahBahan),
        biaya
      ]));
      wadah.appendChild(el('section', { class: 'kartu formulir' }, [
        baru ? null : el('p', { class: 'pesan-formulir info' }, [ikon('info'),
          el('span', { text: 'Perubahan berlaku untuk prep berikutnya. Catatan lama tidak berubah.' })]),
        pesan,
        el('div', {}, simpan)
      ]));

      if (!baru && resepKini) {
        var tombolAktif = resepKini.aktif
          ? tombol('Nonaktifkan', 'bahaya', { onclick: nonaktifkan })
          : tombol('Aktifkan lagi', 'kedua', { onclick: aktifkan });
        wadah.appendChild(el('section', { class: 'kartu' }, [
          el('h2', { class: 'kartu-judul', text: 'Keadaan resep' }),
          el('p', { class: 'kartu-teks', text: resepKini.aktif
            ? 'Aktif. Prep List ' + resepKini.itemHasil + ' memakai resep ini.'
            : 'Nonaktif. ' + resepKini.itemHasil + ' dicatat dengan Qty biasa di Prep List dan stock tidak bergerak.' }),
          resepKini.masalah.length ? el('div', { class: 'tanda-deret bungkus' }, resepKini.masalah.map(function (m) {
            return tandaStatus('tinjau', m);
          })) : null,
          tombolAktif
        ]));
      }
    }

    function nonaktifkan() {
      var r = resepKini;
      konfirmasi({
        judul: 'Nonaktifkan resep ' + r.itemHasil + '?',
        teks: r.itemHasil + ' dicatat dengan Qty biasa di Prep List dan stock tidak bergerak sampai resepnya aktif lagi. Catatan lama tidak berubah.',
        teksYa: 'Nonaktifkan',
        bahaya: true,
        jalankan: function () { return panggilApi('aturResepAktif', { itemHasil: r.itemHasil, aktif: false }); }
      }).then(function (hasil) {
        if (!hasil) return;
        Cache.tulis('resep', hasil);
        gambar(hasil);
        toast('Resep ' + r.itemHasil + ' dinonaktifkan.');
      });
    }

    function aktifkan(e) {
      var r = resepKini;
      var t = e.currentTarget;
      aturTombolProses(t, true, 'Menyimpan…');
      panggilApi('aturResepAktif', { itemHasil: r.itemHasil, aktif: true }).then(function (hasil) {
        Cache.tulis('resep', hasil);
        gambar(hasil);
        toast('Resep ' + r.itemHasil + ' aktif lagi.');
      }).catch(function (err) {
        aturTombolProses(t, false);
        if (tanganiSesiBerakhir(err)) return;
        toast(pesanGalat(err), 'masalah');
      });
    }

    muatData({
      kunciCache: 'resep',
      ambil: function () { return panggilApi('daftarResep'); },
      gambar: function (hasil, dariHp) {
        // Isian yang sedang diketik tidak digambar ulang; hanya data pendukungnya diperbarui.
        if (isi && data) {
          data = hasil;
          resepKini = baru ? null : cariResep(namaAwal);
          return;
        }
        gambar(hasil, dariHp);
      },
      kerangka: function () {
        kosongkan(wadah).appendChild(kerangkaBaris(4));
      },
      galat: function (pesan, cobaLagi) {
        kosongkan(wadah).appendChild(kotakGalat(pesan, cobaLagi));
      },
      penanda: penanda
    });
  }

  /* =======================================================================
   * HPP dan food cost (khusus Pengelola; spesifikasi tampilan Bagian 5.10,
   * sistem Bagian 5.9): layar HPP dari Dashboard, Pengaturan → Menu, dan
   * lembar Catat penjualan
   * ===================================================================== */

  /** Selisih seharusnya vs nyata (persen dari seharusnya) yang masih dianggap sesuai porsi terjual. */
  var BATAS_SELISIH_PORSI = 2;

  /** "35%" / "37,2%" */
  function formatPersen(n) {
    return n == null ? '–' : formatAngka(Math.round(n * 10) / 10) + '%';
  }

  function namaBulanIso(b) {
    return NAMA_BULAN[Number(b.slice(5, 7)) - 1] + ' ' + b.slice(0, 4);
  }

  /** "1–16 Oktober" dari dari dan sampai satu bulan. */
  function teksRentangBulan(dari, sampai) {
    var nama = NAMA_BULAN[Number(dari.slice(5, 7)) - 1];
    return Number(dari.slice(8, 10)) + '–' + Number(sampai.slice(8, 10)) + ' ' + nama;
  }

  /** "9 dan 14 Okt" / "3, 7, dan 12 Okt" */
  function teksTanggalBulan(daftar) {
    if (!daftar.length) return '';
    var n = daftar.map(function (t) { return String(Number(t.slice(8, 10))); });
    var bulan = tanggalPendek(daftar[daftar.length - 1]).replace(/^\d+\s*/, '');
    var gabung = n.length === 1 ? n[0] : (n.length === 2 ? n[0] + ' dan ' + n[1] : n.slice(0, -1).join(', ') + ', dan ' + n[n.length - 1]);
    return gabung + ' ' + bulan;
  }

  /** Tanda food cost menu: Di atas target (Perlu ditinjau), Sesuai target (Baik), atau Belum lengkap (Menunggu). */
  function tandaFoodCost(m) {
    if (!m.lengkap) return tandaStatus('menunggu', 'Belum lengkap');
    return m.diAtasTarget ? tandaStatus('tinjau', 'Di atas target') : tandaStatus('baik', 'Sesuai target');
  }

  function hrefMenu(nama) {
    return '#/pengaturan/menu/' + encodeURIComponent(nama);
  }

  /**
   * Lembar Catat penjualan (tampilan Bagian 5.10): tanggal (Kemarin atau tanggal lain), penjualan
   * dalam rupiah, catatan, dan (sejak aplikasi 0.19.0) porsi terjual per menu. Isian yang sudah
   * tercatat untuk tanggal itu dibaca dari server (aksi penjualanTanggal). Butuh sinyal.
   * selesai(hasil) dipanggil setelah tersimpan.
   */
  function bukaCatatPenjualan(opsi) {
    var hari = tanggalIso(new Date());
    var kemarin = tanggalIso(new Date(Date.now() - 86400000));
    var tanggal = opsi.tanggal || kemarin;
    var gTanggal = grupPilihan('Tanggal', ['Kemarin, ' + tanggalPendek(kemarin), 'Tanggal lain'],
      tanggal === kemarin ? 'Kemarin, ' + tanggalPendek(kemarin) : 'Tanggal lain');
    var kTanggal = kolomIsian({ label: 'Pilih tanggal', type: 'date', nilai: tanggal, atribut: { max: hari } });
    kTanggal.wadah.hidden = tanggal === kemarin;
    var sudah = el('p', { class: 'kolom-bantuan', 'aria-live': 'polite' });
    var kJual = kolomIsian({ label: 'Penjualan (Rp)', inputmode: 'numeric', kelas: 'isian-angka',
      bantuan: 'Total penjualan makanan dan minuman dari kasir, sebelum pajak dan service. Hari tutup: isi 0.' });
    var kCatatan = kolomIsian({ label: 'Catatan (tidak wajib)', maxlength: 200 });
    var pesan = el('p', { class: 'pesan-formulir', role: 'alert' });
    // Porsi per menu: diisi setelah daftar menu tanggal itu termuat.
    var porsiJudul = el('h3', { class: 'porsi-judul', text: 'Porsi terjual per menu' });
    var porsiIsi = el('div', { class: 'porsi-isi', 'aria-live': 'polite' });
    var porsiWadah = el('section', { class: 'porsi-wadah', 'aria-label': 'Porsi terjual per menu' }, [porsiJudul, porsiIsi]);
    var kolomPorsi = [];
    var nomorMuat = 0;
    var diketik = { jual: false, catatan: false };
    kJual.input.addEventListener('input', function () { diketik.jual = true; perbaruiJumlah(); });
    kCatatan.input.addEventListener('input', function () { diketik.catatan = true; });
    var jumlahHarga = el('p', { class: 'kolom-bantuan porsi-jumlah', 'aria-live': 'polite' });

    function tanggalTerpilih() {
      return gTanggal.nilai() === 'Tanggal lain' ? kTanggal.input.value : kemarin;
    }
    function bacaPorsi(teks) {
      var t = String(teks || '').trim();
      if (t === '') return null;
      return /^\d{1,6}$/.test(t) ? Number(t) : NaN;
    }
    /** "Menurut harga jual: Rp …", untuk memeriksa angka kasir. */
    function perbaruiJumlah() {
      var total = 0;
      var ada = false;
      kolomPorsi.forEach(function (x) {
        var n = bacaPorsi(x.k.input.value);
        if (n > 0 && x.menu.hargaJual > 0) total += n * x.menu.hargaJual;
        if (n != null && !isNaN(n)) ada = true;
      });
      jumlahHarga.textContent = ada ? 'Porsi × harga jual: ' + formatRupiah(total) + '. Bisa berbeda dari kasir karena diskon atau promo.' : '';
    }
    function gambarPorsi(d) {
      kosongkan(porsiIsi);
      kolomPorsi = [];
      if (!d.siap || !d.siap.porsi) {
        porsiIsi.appendChild(el('p', { class: 'kolom-bantuan', text: 'Tab Data_PenjualanMenu belum ada. Pemilik Sheet perlu menjalankan ulang setupSpreadsheet.' }));
        return;
      }
      if (!d.menu.length) {
        porsiIsi.appendChild(el('p', { class: 'kolom-bantuan', text: 'Belum ada menu aktif. Tambah menu di Pengaturan → Menu.' }));
        return;
      }
      porsiIsi.appendChild(el('p', { class: 'kolom-bantuan', text: 'Dari laporan kasir. Kosong: belum dicatat. 0: tidak terjual. ' +
        'Dipakai untuk menghitung pemakaian bahan seharusnya.' }));
      porsiIsi.appendChild(el('ul', { class: 'porsi-daftar' }, d.menu.map(function (m) {
        var id = 'porsi-' + (++nomorKolom);
        var input = el('input', { class: 'isian isian-angka', id: id, inputmode: 'numeric', autocomplete: 'off', maxlength: 6,
          pattern: '[0-9]*', 'aria-describedby': id + '-galat' });
        if (m.porsi != null) input.value = String(m.porsi);
        var galat = el('p', { class: 'kolom-galat', id: id + '-galat' });
        var k = {
          input: input,
          galat: function (teks) {
            kosongkan(galat);
            input.setAttribute('aria-invalid', teks ? 'true' : 'false');
            if (teks) {
              galat.appendChild(ikonStatus('masalah'));
              galat.appendChild(el('span', { text: teks }));
            }
            return !teks;
          }
        };
        input.addEventListener('input', function () {
          k.galat('');
          perbaruiJumlah();
        });
        kolomPorsi.push({ menu: m, k: k });
        return el('li', { class: 'porsi-baris' }, [
          el('label', { class: 'porsi-nama', for: id }, [
            el('span', { text: m.nama + (m.aktif ? '' : ' (nonaktif)') }),
            m.hargaJual > 0 ? el('small', { text: formatRupiah(m.hargaJual) }) : null
          ]),
          input,
          galat
        ]);
      })));
      porsiIsi.appendChild(jumlahHarga);
      perbaruiJumlah();
    }
    function muatTanggal() {
      var t = tanggalTerpilih();
      var nomor = ++nomorMuat;
      sudah.textContent = '';
      kosongkan(porsiIsi).appendChild(el('p', { class: 'kolom-bantuan', text: t ? 'Memuat menu…' : 'Pilih tanggal untuk mengisi porsi per menu.' }));
      kolomPorsi = [];
      if (!t) return;
      panggilApi('penjualanTanggal', { tanggal: t }).then(function (d) {
        if (nomor !== nomorMuat) return;
        if (d.penjualan) {
          sudah.textContent = 'Sudah tercatat ' + formatRupiah(d.penjualan.nilai) + '. Menyimpan akan menggantinya.';
          if (!diketik.jual) kJual.input.value = String(d.penjualan.nilai);
          if (!diketik.catatan) kCatatan.input.value = d.penjualan.catatan || '';
        } else {
          if (!diketik.jual) kJual.input.value = '';
          if (!diketik.catatan) kCatatan.input.value = '';
        }
        gambarPorsi(d);
      }).catch(function (err) {
        if (nomor !== nomorMuat) return;
        if (tanganiSesiBerakhir(err)) return;
        // Server lama tanpa aksi ini, atau tanpa sinyal: penjualan tetap bisa dicatat tanpa porsi.
        var ada = (opsi.terakhir || []).filter(function (x) { return x.tanggal === t; })[0];
        sudah.textContent = ada ? 'Sudah tercatat ' + formatRupiah(ada.nilai) + '. Menyimpan akan menggantinya.' : '';
        kosongkan(porsiIsi).appendChild(el('p', { class: 'kolom-bantuan', text: 'Daftar menu tidak termuat (' + pesanGalat(err).replace(/\.$/, '') +
          '). Penjualan tetap bisa disimpan tanpa porsi.' }));
      });
    }
    gTanggal.input.forEach(function (i) {
      i.addEventListener('change', function () {
        kTanggal.wadah.hidden = gTanggal.nilai() !== 'Tanggal lain';
        muatTanggal();
      });
    });
    kTanggal.input.addEventListener('change', muatTanggal);
    muatTanggal();

    bukaLembar({
      judul: 'Catat penjualan',
      isi: [gTanggal.wadah, kTanggal.wadah, kJual.wadah, sudah, kCatatan.wadah, porsiWadah, pesan],
      aksi: [
        { teks: 'Batal', jenis: 'kedua' },
        { teks: 'Simpan penjualan', jenis: 'utama', klik: function (t, lembar) {
          tulisPesan(pesan, '');
          var t1 = tanggalTerpilih();
          var okTanggal = kTanggal.galat(!t1 ? 'Pilih tanggal.' : (t1 > hari ? 'Penjualan hanya bisa dicatat untuk hari ini atau tanggal yang sudah lewat.' : ''));
          var teks = kJual.input.value.trim().replace(/^rp\s*/i, '').replace(/\./g, '');
          var nilai = bacaAngka(teks);
          var okJual = kJual.galat(nilai === null ? 'Isi penjualan. Hari tutup diisi 0.' : (isNaN(nilai) || nilai < 0 ? 'Isi angka 0 atau lebih, misalnya 3450000.' : ''));
          var porsi = [];
          var okPorsi = true;
          var salahPertama = null;
          kolomPorsi.forEach(function (x) {
            var n = bacaPorsi(x.k.input.value);
            var ok = x.k.galat(isNaN(n) ? 'Isi bilangan bulat 0 atau lebih, misalnya 12.' : '');
            if (!ok) {
              okPorsi = false;
              if (!salahPertama) salahPertama = x.k.input;
            } else if (n != null) {
              porsi.push({ menu: x.menu.nama, porsi: n });
            }
          });
          if (!okTanggal || !okJual || !okPorsi) {
            if (okTanggal && okJual && salahPertama) salahPertama.focus();
            return;
          }
          var isi = { tanggal: t1, penjualan: nilai, catatan: kCatatan.input.value.trim(), bulan: opsi.bulan, submissionId: buatId() };
          if (porsi.length) isi.porsi = porsi;
          aturTombolProses(t, true, 'Menyimpan…');
          jagaProses(panggilApi('simpanPenjualan', isi)).then(function (hasil) {
            lembar.tutup();
            toast('Penjualan ' + tanggalPendek(t1) + ' tersimpan' + (porsi.length ? ', dengan porsi ' + porsi.length + ' menu.' : '.'));
            if (opsi.selesai) opsi.selesai(hasil);
          }).catch(function (err) {
            aturTombolProses(t, false);
            if (tanganiSesiBerakhir(err)) return;
            tulisPesan(pesan, pesanGalat(err), 'masalah');
          });
        } }
      ]
    });
    if (!apakahSentuh()) kJual.input.focus();
  }

  /** Grafik food cost 6 bulan (SVG; batang di atas target berwarna Perlu ditinjau dan angkanya tertulis). */
  function grafikFoodCost(h) {
    var g = h.grafik || [];
    var idJudul = 'judul-grafik-fc';
    var kartu = el('section', { class: 'kartu grafik-kartu', 'aria-labelledby': idJudul }, [
      el('h2', { class: 'kartu-judul', id: idJudul, text: 'Food cost 6 bulan' })
    ]);
    var ada = g.filter(function (x) { return x.foodCost != null; });
    var tertinggi = null;
    ada.forEach(function (x) { if (!tertinggi || x.foodCost > tertinggi.foodCost) tertinggi = x; });
    kartu.appendChild(el('p', { class: 'grafik-ringkas', text: tertinggi
      ? 'Tertinggi ' + namaBulanIso(tertinggi.bulan).split(' ')[0] + ' ' + formatPersen(tertinggi.foodCost) + '. Garis putus-putus: target ' + formatPersen(h.target) + '.'
      : 'Belum ada bulan dengan penjualan lengkap. Garis putus-putus: target ' + formatPersen(h.target) + '.' }));
    var maks = Math.max(h.target * 1.3, ada.reduce(function (m, x) { return Math.max(m, x.foodCost); }, 0) * 1.1, 10);
    var TINGGI = 120;
    var LEBAR = 100;
    var svg = svgEl('svg', { class: 'grafik-fc-svg', viewBox: '0 0 ' + (LEBAR * g.length) + ' ' + TINGGI, preserveAspectRatio: 'none',
      'aria-hidden': 'true', focusable: 'false' });
    g.forEach(function (x, i) {
      if (x.foodCost == null) return;
      var tinggi = Math.max(3, Math.round(Math.min(x.foodCost, maks) / maks * TINGGI));
      svg.appendChild(svgEl('rect', { class: 'batang' + (x.foodCost > h.target ? ' di-atas' : '') + ' tumbuh', style: '--i:' + i,
        x: i * LEBAR + 24, y: TINGGI - tinggi, width: LEBAR - 48, height: tinggi }));
    });
    var yTarget = TINGGI - h.target / maks * TINGGI;
    svg.appendChild(svgEl('line', { class: 'garis-target', x1: 0, y1: yTarget, x2: LEBAR * g.length, y2: yTarget }));
    svg.appendChild(svgEl('line', { class: 'garis-dasar', x1: 0, y1: TINGGI - 0.5, x2: LEBAR * g.length, y2: TINGGI - 0.5 }));
    var uraian = g.map(function (x) {
      return namaBulanIso(x.bulan) + ' ' + (x.foodCost == null ? 'belum dihitung' : formatPersen(x.foodCost));
    }).join(', ');
    kartu.appendChild(el('div', { class: 'grafik-fc', role: 'img', 'aria-label': 'Food cost per bulan: ' + uraian + '. Target ' + formatPersen(h.target) + '.' }, [
      el('div', { class: 'grafik-fc-nilai', 'aria-hidden': 'true' }, g.map(function (x) {
        return el('span', { class: x.foodCost != null && x.foodCost > h.target ? 'di-atas' : null, text: x.foodCost == null ? '–' : formatAngka(x.foodCost) });
      })),
      svg,
      el('div', { class: 'grafik-waste-hari grafik-fc-bulan', 'aria-hidden': 'true' }, g.map(function (x, i) {
        return el('span', { class: i === g.length - 1 ? 'hari-ini' : null, text: NAMA_BULAN[Number(x.bulan.slice(5, 7)) - 1].slice(0, 3) });
      }))
    ]));
    kartu.appendChild(el('p', { class: 'kolom-bantuan', text: 'Bulan di atas target ditulis jingga. "–": penjualan bulan itu belum lengkap.' }));
    return kartu;
  }

  function barisNilai(label, nilai, kelas) {
    return el('div', { class: 'baris-nilai' + (kelas ? ' ' + kelas : '') }, [el('span', { text: label }), el('strong', { text: nilai })]);
  }

  /**
   * Layar HPP dan food cost (tampilan Bagian 5.10): pilihan bulan, kepala navy berisi food cost,
   * pemakaian bahan, dan penjualan; bagian Bulan (rincian, cek silang, per kategori, grafik,
   * penjualan) dan Per menu (HPP per porsi menu aktif).
   */
  function layarHpp(k) {
    aturJudul('HPP dan food cost');
    var penanda = el('span', { class: 'memperbarui', role: 'status' });
    var ringkasKepala = el('div', { class: 'kepala-hpp' });
    var wadah = el('div', { class: 'hpp' });
    var kini = tanggalIso(new Date()).slice(0, 7);
    var daftarBulan = [];
    var th = Number(kini.slice(0, 4));
    var bl = Number(kini.slice(5, 7));
    for (var i = 0; i < BULAN_REKAP; i++) {
      daftarBulan.push(th + '-' + duaAngka(bl));
      bl--;
      if (!bl) { bl = 12; th--; }
    }
    var pilihan = (Cache.baca('hpp-pilihan') || {}).data || {};
    var bulan = daftarBulan.indexOf(pilihan.bulan) >= 0 ? pilihan.bulan : kini;
    var bagian = k.cocok[1] ? 'menu' : 'bulan';
    var data = null;
    var mediaDesktop = window.matchMedia(DESKTOP);

    var pilihBulan = el('select', { class: 'isian', id: 'hpp-bulan' }, daftarBulan.map(function (b, n) {
      return el('option', { value: b, text: namaBulanIso(b) + (n === 0 ? ' (bulan berjalan)' : '') });
    }));
    pilihBulan.value = bulan;
    var gBagian = grupPilihan('Tampilkan', ['Bulan', 'Per menu'], bagian === 'menu' ? 'Per menu' : 'Bulan');
    gBagian.wadah.classList.add('hpp-bagian');
    gBagian.wadah.querySelector('legend').classList.add('sr');

    k.wadah.appendChild(el('div', { class: 'layar-isi' }, [
      tautanKembali('Dashboard', '#/dashboard'),
      el('h1', { class: 'judul-layar', text: 'HPP dan food cost' }),
      el('div', { class: 'kepala-ringkas' }, [ringkasKepala, penanda]),
      el('div', { class: 'hpp-pilih' }, [
        el('div', { class: 'kolom' }, [el('label', { class: 'kolom-label', for: 'hpp-bulan', text: 'Bulan' }), pilihBulan]),
        gBagian.wadah
      ]),
      wadah
    ]));

    function simpanPilihan() {
      Cache.tulis('hpp-pilihan', { bulan: bulan });
    }
    pilihBulan.addEventListener('change', function () {
      bulan = pilihBulan.value;
      simpanPilihan();
      muat();
    });
    gBagian.input.forEach(function (inp) {
      inp.addEventListener('change', function () {
        bagian = gBagian.nilai() === 'Per menu' ? 'menu' : 'bulan';
        simpanPilihan();
        gantiAlamat(bagian === 'menu' ? '#/hpp/menu' : '#/hpp');
        if (data) gambar(data);
      });
    });

    function gambarKepala(h) {
      kosongkan(ringkasKepala);
      var p = h.pemakaian;
      var jual = h.penjualan;
      var periode = h.sampai < h.dari ? namaBulanIso(h.bulan) : teksRentangBulan(h.dari, h.sampai);
      if (bagian === 'menu') {
        var diAtas = h.menu.filter(function (m) { return m.diAtasTarget; }).length;
        var belum = h.menu.filter(function (m) { return !m.lengkap; }).length;
        ringkasKepala.appendChild(el('div', { class: 'kepala-nilai kepala-nilai-diam' }, [
          el('span', { class: 'kepala-nilai-label', text: 'Menu di atas target ' + formatPersen(h.target) }),
          el('span', { class: 'kepala-nilai-angka' }, [String(diAtas), el('small', { text: ' dari ' + h.menu.length + ' menu' })]),
          el('span', { class: 'kepala-nilai-ket', text: (belum ? belum + ' menu belum lengkap · ' : '') +
            'harga bahan ' + (h.berjalan ? 'hari ini' : tanggalPendek(h.sampai)) })
        ]));
        return;
      }
      var fcSeharusnya = h.teoritis && h.teoritis.foodCostSeharusnya;
      ringkasKepala.appendChild(el('div', { class: 'kepala-nilai kepala-nilai-diam' }, [
        el('span', { class: 'kepala-nilai-label', text: 'Food cost ' + periode }),
        el('span', { class: 'kepala-nilai-angka' }, [formatPersen(h.foodCost), el('small', { text: ' target ' + formatPersen(h.target) })]),
        h.foodCost != null && h.foodCost > h.target ? el('span', { class: 'kepala-nilai-selisih', text: 'Di atas target' }) : null,
        fcSeharusnya != null ? el('span', { class: 'kepala-nilai-ket', text: 'Seharusnya ' + formatPersen(fcSeharusnya) + ' menurut porsi terjual' }) : null
      ]));
      ringkasKepala.appendChild(el('div', { class: 'kepala-angka' }, [
        el('div', {}, [
          el('span', { class: 'kepala-angka-label', text: 'Pemakaian bahan' }),
          el('span', { class: 'kepala-angka-nilai', text: formatRupiah(p.total) })
        ]),
        el('div', {}, [
          el('span', { class: 'kepala-angka-label', text: 'Penjualan' + (jual.kurang.length && jual.hari ? ', ' + jual.hari + ' hari' : '') }),
          el('span', { class: 'kepala-angka-nilai', text: jual.hari ? formatRupiah(jual.total) : '–' })
        ])
      ]));
    }

    function kartuPemakaian(h) {
      var p = h.pemakaian;
      return el('section', { class: 'kartu' }, [
        el('h2', { class: 'kartu-judul', text: 'Pemakaian bahan' }),
        el('p', { class: 'kartu-teks', text: 'Bahan mentah, dinilai dengan harga yang berlaku tiap hari.' }),
        el('div', { class: 'daftar-nilai' }, [
          barisNilai('Terpakai (keluar dan prep)', formatRupiah(p.terpakai)),
          barisNilai('Waste bahan', formatRupiah(p.waste)),
          barisNilai('Selisih stock (opname dan penyesuaian)', formatRupiah(p.selisihStock)),
          barisNilai('Pemakaian bahan', formatRupiah(p.total), 'total')
        ]),
        p.wasteBarangJadi ? el('p', { class: 'kolom-bantuan', text: 'Waste barang jadi ' + formatRupiah(p.wasteBarangJadi) +
          ' tidak ditambahkan, karena bahannya sudah terhitung saat prep.' }) : null,
        p.stokPembuka ? el('p', { class: 'kolom-bantuan', text: 'Stok pembuka ' + formatRupiah(p.stokPembuka) +
          ' tidak dihitung sebagai selisih stock.' }) : null
      ]);
    }

    /** Selisih bertanda: "+Rp 42.000" / "−Rp 3.000". */
    function rupiahBertanda(n) {
      return (n > 0 ? '+' : n < 0 ? '−' : '') + formatRupiah(Math.abs(n));
    }

    /**
     * Seharusnya vs nyata (spesifikasi sistem Bagian 5.9, sejak aplikasi 0.19.0): pemakaian bahan menurut porsi
     * terjual dibanding pemakaian nyata. Sebelum porsi per menu pernah dicatat: ajakan mencatatnya.
     */
    function kartuTeoritis(h) {
      var t = h.teoritis;
      if (!t || !t.siap) return null;
      var judul = el('h2', { class: 'kartu-judul', text: 'Seharusnya vs nyata' });
      function tombolCatat(teks, tanggal) {
        var b = tombol(teks, 'kedua', { 'aria-haspopup': 'dialog' });
        b.addEventListener('click', function () {
          bukaCatatPenjualan({ tanggal: tanggal, bulan: h.bulan, terakhir: h.penjualan.terakhir, selesai: function (hasil) { if (hasil.hpp) terima(hasil.hpp); } });
        });
        return el('div', {}, b);
      }
      if (!t.pernah) {
        return el('section', { class: 'kartu' }, [judul,
          el('p', { class: 'kartu-teks', text: 'Catat porsi terjual per menu saat mencatat penjualan. Aplikasi lalu menghitung bahan yang ' +
            'seharusnya terpakai dan membandingkannya dengan yang nyata terpakai, supaya bocor, porsi berlebih, atau pencatatan keliru terlihat.' }),
          tombolCatat('Catat penjualan', null)]);
      }
      if (!t.lengkap) {
        var daftar = t.kurang.length > 6 ? teksTanggalBulan(t.kurang.slice(0, 5)) + ', dan ' + (t.kurang.length - 5) + ' hari lain' : teksTanggalBulan(t.kurang);
        return el('section', { class: 'kartu kartu-menunggu' }, [judul,
          el('p', {}, tandaStatus('menunggu', 'Menunggu')),
          el('p', { class: 'kartu-teks', text: 'Porsi per menu belum dicatat untuk ' + t.kurang.length + ' hari: ' + daftar +
            '. Pemakaian seharusnya dibandingkan setelah semua hari tercatat (hari tutup tidak perlu).' }),
          tombolCatat('Catat porsi ' + tanggalPendek(t.kurang[0]), t.kurang[0])]);
      }
      var batas = Math.abs(t.selisihPersen == null ? 0 : t.selisihPersen) <= BATAS_SELISIH_PORSI;
      var tanda = batas ? tandaStatus('baik', 'Sesuai porsi terjual')
        : tandaStatus('tinjau', t.selisih > 0 ? 'Terpakai lebih banyak dari porsi terjual' : 'Terpakai lebih sedikit dari porsi terjual');
      var persen = t.selisihPersen == null ? '' : ' (' + (t.selisihPersen > 0 ? '+' : t.selisihPersen < 0 ? '−' : '') + formatPersen(Math.abs(t.selisihPersen)) + ')';
      return el('section', { class: 'kartu' }, [
        judul,
        el('p', { class: 'kartu-teks', text: t.porsi + ' porsi terjual. Bahan dinilai dengan harga yang berlaku tiap hari.' }),
        el('p', {}, tanda),
        el('div', { class: 'daftar-nilai' }, [
          barisNilai('Seharusnya, dari porsi terjual', formatRupiah(t.seharusnya.total)),
          barisNilai('Nyata, pemakaian bahan', formatRupiah(t.nyata)),
          barisNilai('Selisih', rupiahBertanda(t.selisih) + persen, 'total')
        ]),
        t.foodCostSeharusnya != null ? el('p', { class: 'kolom-bantuan', text: 'Food cost seharusnya ' + formatPersen(t.foodCostSeharusnya) +
          ', nyata ' + formatPersen(h.foodCost) + '.' }) : null,
        el('details', { class: 'hpp-rinci' }, [
          el('summary', { text: 'Bahan menu dan bahan lain' }),
          el('div', { class: 'daftar-nilai' }, [
            barisNilai('Bahan menu: seharusnya ' + formatRupiah(t.bahanMenu.seharusnya) + ', nyata ' + formatRupiah(t.bahanMenu.nyata),
              rupiahBertanda(t.bahanMenu.nyata - t.bahanMenu.seharusnya)),
            barisNilai('Bahan lain (bumbu, minyak, garnish): seharusnya bahan kecil ' + formatPersen(t.kecilPersen) + ' = ' +
              formatRupiah(t.bahanLain.seharusnya) + ', nyata ' + formatRupiah(t.bahanLain.nyata), rupiahBertanda(t.bahanLain.nyata - t.bahanLain.seharusnya))
          ])
        ]),
        t.item.length ? el('details', { class: 'hpp-rinci' }, [
          el('summary', { text: 'Selisih per bahan' + (t.jumlahItem > t.item.length ? ' (' + t.item.length + ' terbesar)' : '') }),
          el('ol', { class: 'daftar-nilai' }, t.item.map(function (x) {
            return el('li', {}, barisNilai(x.nama + ' · seharusnya ' + formatAngka(x.seharusnya) + ' ' + x.satuan + ', nyata ' +
              formatAngka(x.nyata) + ' ' + x.satuan, rupiahBertanda(x.selisihRp)));
          }))
        ]) : null,
        el('p', { class: 'kolom-bantuan', text: 'Seharusnya = porsi × bahan per porsi (takaran bersih ÷ hasil bersih; barang jadi dihitung dari ' +
          'bahan resepnya) + bahan kecil. Selisih plus: bocor, porsi berlebih, waste, atau pencatatan keliru. Barang jadi yang belum ' +
          'terjual di akhir periode ikut menambah selisih.' }),
        t.tanpaHarga.length ? el('p', { class: 'pesan-formulir tinjau' }, [ikon('info'), el('span', {
          text: t.tanpaHarga.join(', ') + ' belum punya harga pada sebagian hari, jadi tidak ikut dihitung.' })]) : null,
        t.menuTakDikenal.length ? el('p', { class: 'pesan-formulir tinjau' }, [ikon('info'), el('span', {
          text: 'Porsi ' + t.menuTakDikenal.join(', ') + ' tidak dihitung karena menunya tidak ada lagi di daftar menu.' })]) : null,
        t.tidakBisa.length ? el('p', { class: 'pesan-formulir tinjau' }, [ikon('info'), el('span', {
          text: 'Resep ' + t.tidakBisa.join(', ') + ' tidak bisa dipakai (hasil kosong atau tanpa bahan), jadi bahannya tidak ikut dihitung.' })]) : null
      ]);
    }

    function kartuCekSilang(h) {
      var c = h.cekSilang;
      return el('section', { class: 'kartu' }, [
        el('h2', { class: 'kartu-judul', text: 'Cocok dengan nilai stock' }),
        el('div', { class: 'daftar-nilai' }, [
          barisNilai('Stock bahan ' + tanggalPendek(c.tanggalAwal), formatRupiah(c.awal)),
          barisNilai('+ Barang masuk', formatRupiah(c.masuk)),
          c.stokPembuka ? barisNilai('+ Stok pembuka', formatRupiah(c.stokPembuka)) : null,
          barisNilai('− Stock bahan ' + tanggalPendek(c.tanggalAkhir), formatRupiah(c.akhir)),
          barisNilai((c.selisihHarga < 0 ? '− ' : '+ ') + 'Selisih karena harga ' + (c.selisihHarga < 0 ? 'turun' : 'naik'),
            formatRupiah(Math.abs(c.selisihHarga))),
          barisNilai('= Pemakaian bahan', formatRupiah(c.awal + c.masuk + (c.stokPembuka || 0) - c.akhir + c.selisihHarga), 'total')
        ]),
        c.cocok ? el('p', {}, tandaStatus('baik', 'Sama dengan rincian di atas'))
          : el('p', { class: 'pesan-formulir tinjau' }, [ikon('info'), el('span', { text: 'Beda ' + formatRupiah(Math.abs(c.beda)) +
            ' dengan rincian di atas, karena ada bahan yang belum punya harga pada sebagian hari.' })])
      ]);
    }

    function kartuKategori(h) {
      var daftar = h.perKategori || [];
      var total = h.pemakaian.total;
      var maks = daftar.reduce(function (m, x) { return Math.max(m, x.nilai); }, 0);
      return el('section', { class: 'kartu' }, [
        el('h2', { class: 'kartu-judul', text: 'Per kategori' }),
        daftar.length ? el('ul', { class: 'kat-daftar' }, daftar.map(function (x) {
          return el('li', { class: 'kat-baris' }, [
            el('span', { class: 'kat-atas' }, [el('span', { text: x.kategori }),
              el('span', { class: 'kat-nilai', text: formatRupiah(x.nilai) + (total > 0 ? ' · ' + Math.round(x.nilai / total * 100) + '%' : '') })]),
            el('span', { class: 'kat-jalur', 'aria-hidden': 'true' }, el('span', { class: 'kat-isi',
              style: 'transform:scaleX(' + (maks > 0 ? Math.max(0, x.nilai) / maks : 0).toFixed(3) + ')' }))
          ]);
        })) : el('p', { class: 'kartu-teks', text: 'Belum ada bahan terpakai pada bulan ini.' }),
        (h.bahanTerbesar || []).length ? el('details', { class: 'hpp-rinci' }, [
          el('summary', { text: 'Bahan dengan pemakaian terbesar' }),
          el('ol', { class: 'daftar-nilai' }, h.bahanTerbesar.map(function (x) {
            return el('li', {}, barisNilai(x.nama + ' · ' + formatAngka(x.qty) + ' ' + x.satuan, formatRupiah(x.nilai)));
          }))
        ]) : null,
        (h.tanpaHarga || []).length ? el('p', { class: 'pesan-formulir tinjau' }, [ikon('info'), el('span', {
          text: h.tanpaHarga.join(', ') + ' dipakai bulan ini tetapi belum punya harga, jadi tidak ikut dihitung.' })]) : null
      ]);
    }

    function kartuPenjualan(h) {
      var j = h.penjualan;
      var catat = tombol('Catat penjualan', 'kedua', { 'aria-haspopup': 'dialog' });
      catat.addEventListener('click', function () {
        bukaCatatPenjualan({ bulan: h.bulan, terakhir: j.terakhir, selesai: function (hasil) { if (hasil.hpp) terima(hasil.hpp); } });
      });
      return el('section', { class: 'kartu' }, [
        el('h2', { class: 'kartu-judul', text: 'Penjualan' }),
        el('p', { class: 'kartu-teks', text: j.jumlahHari ? j.hari + ' dari ' + j.jumlahHari + ' hari tercatat' : 'Belum ada hari yang selesai bulan ini.' }),
        j.terakhir.length ? el('div', { class: 'daftar-nilai' }, j.terakhir.map(function (x) {
          return barisNilai(tanggalJudul(x.tanggal) + (x.catatan ? ' · ' + x.catatan : ''), formatRupiah(x.nilai));
        })) : null,
        el('div', {}, catat)
      ]);
    }

    function kartuKurang(h) {
      var j = h.penjualan;
      if (!j.kurang.length || h.foodCost != null) return null;
      var catat = tombol('Catat penjualan ' + tanggalPendek(j.kurang[0]), 'utama', { 'aria-haspopup': 'dialog' });
      catat.addEventListener('click', function () {
        bukaCatatPenjualan({ tanggal: j.kurang[0], bulan: h.bulan, terakhir: j.terakhir, selesai: function (hasil) { if (hasil.hpp) terima(hasil.hpp); } });
      });
      var daftar = j.kurang.length > 6 ? teksTanggalBulan(j.kurang.slice(0, 5)) + ', dan ' + (j.kurang.length - 5) + ' hari lain' : teksTanggalBulan(j.kurang);
      return el('section', { class: 'kartu kartu-menunggu' }, [
        el('p', {}, tandaStatus('menunggu', 'Menunggu')),
        el('p', { class: 'kartu-teks', text: 'Penjualan belum dicatat untuk ' + j.kurang.length + ' hari: ' + daftar +
          '. Food cost dihitung setelah semua hari tercatat.' }),
        el('div', {}, catat)
      ]);
    }

    function gambarBulan(h) {
      if (h.sampai < h.dari) {
        wadah.appendChild(kotakKosong('Belum ada hari yang selesai di ' + namaBulanIso(h.bulan) + '. Food cost bulan ini terlihat mulai besok.'));
        wadah.appendChild(kartuPenjualan(h));
        return;
      }
      var kurang = kartuKurang(h);
      if (kurang) wadah.appendChild(kurang);
      wadah.appendChild(el('div', { class: 'hpp-kolom' }, [
        el('div', { class: 'hpp-kolom-isi' }, [kartuPemakaian(h), kartuTeoritis(h), kartuCekSilang(h), kartuKategori(h)]),
        el('div', { class: 'hpp-kolom-isi' }, [grafikFoodCost(h), kartuPenjualan(h)])
      ]));
    }

    function gambarMenu(h) {
      var menu = h.menu || [];
      // Porsi terjual bulan itu (sejak porsi per menu pernah dicatat).
      var adaPorsi = menu.some(function (m) { return m.porsi != null; });
      if (!h.siap.menu) {
        wadah.appendChild(el('p', { class: 'pesan-formulir tinjau' }, [ikon('info'),
          el('span', { text: 'Tab M_Menu belum ada. Pemilik Sheet perlu menjalankan ulang setupSpreadsheet.' })]));
        return;
      }
      if (!menu.length) {
        wadah.appendChild(kotakKosong('Belum ada menu. Tambah menu di Pengaturan → Menu.', 'resep'));
      } else if (mediaDesktop.matches) {
        wadah.appendChild(el('div', { class: 'tabel-bingkai' }, el('table', { class: 'tabel tabel-menu-hpp' }, [
          el('thead', {}, el('tr', {}, ['Menu'].concat(adaPorsi ? ['Terjual'] : [], ['Harga jual', 'HPP per porsi', 'Food cost', 'Margin kotor',
            'Harga untuk ' + formatPersen(h.target), 'Keadaan'])
            .map(function (j, i, semua) { return el('th', { class: i && i < semua.length - 1 ? 'angka' : null, scope: 'col', text: j }); }))),
          el('tbody', {}, menu.map(function (m) {
            return el('tr', {}, [
              el('th', { scope: 'row', class: 'nama-item' }, el('a', { class: 'tabel-tombol', href: hrefMenu(m.nama), text: m.nama })),
              adaPorsi ? el('td', { class: 'angka', text: formatAngka(m.porsi || 0) + ' porsi' }) : null,
              el('td', { class: 'angka', text: formatRupiah(m.hargaJual) }),
              el('td', { class: 'angka', text: m.hpp == null ? '–' : formatRupiah(m.hpp) }),
              el('td', { class: 'angka', text: formatPersen(m.foodCost) }),
              el('td', { class: 'angka', text: m.margin == null ? '–' : formatRupiah(m.margin) }),
              el('td', { class: 'angka', text: m.hargaTarget == null ? '–' : formatRupiah(m.hargaTarget) }),
              el('td', {}, [tandaFoodCost(m), m.lengkap ? null : el('span', { class: 'kolom-bantuan blok', text: m.tanpaHarga.join(', ') + ' belum punya harga' })])
            ]);
          }))
        ])));
      } else {
        wadah.appendChild(el('p', { class: 'kolom-bantuan', text: 'Urut dari food cost tertinggi. Ketuk menu untuk melihat bahannya.' }));
        wadah.appendChild(el('nav', { class: 'daftar', 'aria-label': 'HPP per menu' }, menu.map(function (m) {
          return el('a', { class: 'daftar-baris menu-hpp', href: hrefMenu(m.nama) }, [
            el('span', { class: 'daftar-baris-isi' }, [
              el('span', { class: 'daftar-baris-judul', text: m.nama }),
              el('span', { class: 'daftar-baris-ket', text: (m.lengkap ? 'Harga jual ' + formatRupiah(m.hargaJual) + ' · HPP ' + formatRupiah(m.hpp)
                : m.tanpaHarga.join(', ') + ' belum punya harga') + (m.porsi != null ? ' · ' + formatAngka(m.porsi) + ' porsi terjual' : '') }),
              el('span', { class: 'tanda-deret' }, tandaFoodCost(m))
            ]),
            el('strong', { class: 'menu-hpp-persen', text: formatPersen(m.foodCost) })
          ]);
        })));
      }
      wadah.appendChild(el('div', { class: 'deret-tombol' }, el('a', { class: 'tombol tombol-kedua', href: '#/pengaturan/menu' },
        el('span', { class: 'tombol-teks', text: 'Atur menu di Pengaturan' }))));
      wadah.appendChild(el('p', { class: 'kolom-bantuan', text: 'HPP per porsi = bahan (takaran bersih ÷ hasil bersih × harga) + bahan kecil ' +
        formatPersen(h.bahanKecilPersen) + '. Harga jual tanpa pajak dan service.' }));
    }

    function gambar(h) {
      data = h;
      gambarKepala(h);
      kosongkan(wadah);
      if (bagian === 'menu') gambarMenu(h);
      else gambarBulan(h);
    }

    function terima(h) {
      Cache.tulis('hpp:' + h.bulan, h);
      if (h.bulan === bulan) gambar(h);
    }

    function muat() {
      return muatData({
        kunciCache: 'hpp:' + bulan,
        ambil: function () { return panggilApi('hpp', { bulan: bulan }); },
        gambar: gambar,
        kerangka: function () {
          kosongkan(ringkasKepala);
          kosongkan(wadah).appendChild(kerangkaBaris(4));
        },
        galat: function (pesan, cobaLagi) {
          kosongkan(wadah).appendChild(kotakGalat(pesan, cobaLagi));
        },
        penanda: penanda
      });
    }
    function gantiSusunan() {
      if (data && bagian === 'menu') gambar(data);
    }
    if (mediaDesktop.addEventListener) mediaDesktop.addEventListener('change', gantiSusunan);
    else if (mediaDesktop.addListener) mediaDesktop.addListener(gantiSusunan);
    pembersihLayar.push(function () {
      if (mediaDesktop.removeEventListener) mediaDesktop.removeEventListener('change', gantiSusunan);
      else if (mediaDesktop.removeListener) mediaDesktop.removeListener(gantiSusunan);
    });

    muat();
    segarkanLayar = muat;
  }

  /* ---------- Pengaturan → Menu (tampilan Bagian 5.7, sistem Bagian 5.9) ---------- */

  function layarMenu(k) {
    aturJudul('Menu');
    var penanda = el('span', { class: 'memperbarui', role: 'status' });
    var wadah = el('div');
    var tambah = el('a', { class: 'tombol tombol-utama', href: '#/pengaturan/menu-baru' }, el('span', { class: 'tombol-teks', text: 'Tambah' }));
    var kCari = kolomIsian({ label: 'Cari menu', atribut: { type: 'search', autocapitalize: 'none', spellcheck: 'false' } });
    k.wadah.appendChild(el('div', { class: 'layar-isi layar-sempit' }, [
      tautanKembali('Pengaturan', '#/pengaturan'),
      el('div', { class: 'kepala-isi' }, [el('h1', { class: 'judul-layar', text: 'Menu' }), tambah]),
      el('p', { class: 'kartu-teks', text: 'Menu yang dijual, harga jualnya, dan takaran bahan per porsi untuk menghitung HPP. Menu tidak mengurangi stock.' }),
      kCari.wadah,
      penanda,
      wadah
    ]));
    var data = null;

    function saring() {
      kosongkan(wadah);
      if (!data.siap) {
        wadah.appendChild(el('p', { class: 'pesan-formulir tinjau' }, [ikon('info'),
          el('span', { text: 'Tab M_Menu dan M_MenuBahan belum ada. Pemilik Sheet perlu menjalankan ulang setupSpreadsheet.' })]));
        return;
      }
      var semua = data.menu || [];
      if (!semua.length) {
        wadah.appendChild(kotakKosong('Belum ada menu. Ketuk Tambah untuk membuat menu pertama.', 'resep'));
        return;
      }
      var q = kCari.input.value.trim().toLowerCase();
      var menu = semua.filter(function (m) { return !q || m.nama.toLowerCase().indexOf(q) >= 0; });
      if (!menu.length) {
        wadah.appendChild(kotakKosong('Tidak ada menu dengan nama itu.'));
        return;
      }
      wadah.appendChild(el('nav', { class: 'daftar', 'aria-label': 'Daftar menu' }, menu.map(function (m) {
        var ket = [formatRupiah(m.hargaJual), m.hpp == null ? 'HPP belum lengkap' : 'HPP ' + formatRupiah(m.hpp)];
        if (m.foodCost != null) ket.push('food cost ' + formatPersen(m.foodCost));
        var tanda = [];
        if (!m.aktif) tanda.push(tandaStatus('menunggu', 'Nonaktif'));
        else tanda.push(tandaFoodCost(m));
        if (m.masalah.length) tanda.push(tandaStatus('tinjau', m.masalah[0]));
        return el('a', { class: 'daftar-baris' + (m.aktif ? '' : ' nonaktif'), href: hrefMenu(m.nama) }, [
          el('span', { class: 'daftar-baris-isi' }, [
            el('span', { class: 'daftar-baris-judul', text: m.nama }),
            el('span', { class: 'daftar-baris-ket', text: ket.join(' · ') }),
            el('span', { class: 'tanda-deret bungkus' }, tanda)
          ]),
          ikon('kanan')
        ]);
      })));
    }
    kCari.input.addEventListener('input', function () { if (data) saring(); });

    muatData({
      kunciCache: 'menu',
      ambil: function () { return panggilApi('daftarMenu'); },
      gambar: function (d) { data = d; saring(); },
      kerangka: function () { kosongkan(wadah).appendChild(kerangkaBaris(4)); },
      galat: function (pesan, cobaLagi) { kosongkan(wadah).appendChild(kotakGalat(pesan, cobaLagi)); },
      penanda: penanda
    });
  }

  var salinanMenu = null; // isi menu yang disalin ("Salin menu"), dipakai layar menu baru sekali

  /**
   * Buat dan ubah menu (tampilan Bagian 5.7): nama, harga jual, bahan per porsi (takaran bersih
   * dan hasil bersih), perkiraan HPP yang berubah saat diketik, Salin menu, dan sakelar Aktif.
   * Isian tersimpan sebagai draft.
   */
  function layarMenuUbah(k) {
    var baru = !k.cocok[1];
    var namaAwal = '';
    if (!baru) {
      try {
        namaAwal = decodeURIComponent(k.cocok[1]);
      } catch (err) {
        namaAwal = k.cocok[1];
      }
    }
    aturJudul(baru ? 'Menu baru' : namaAwal);
    var kunciDraft = 'menu:' + (baru ? '+baru' : namaAwal.toLowerCase());
    var penanda = el('span', { class: 'memperbarui', role: 'status' });
    var catatanDraft = el('p', { class: 'catatan-draft', 'aria-live': 'polite' });
    var ringkasKepala = el('div', { class: 'kepala-ringkas', hidden: true });
    var judul = el('h1', { class: 'judul-layar', text: baru ? 'Menu baru' : namaAwal });
    var wadah = el('div');
    k.wadah.appendChild(el('div', { class: 'layar-isi layar-sempit' }, [
      tautanKembali('Menu', '#/pengaturan/menu'),
      judul,
      ringkasKepala,
      catatanDraft,
      penanda,
      wadah
    ]));

    var data = null;
    var isi = null; // { nama, hargaJual, bahan: [{ id, item, qty, hasil }] }
    var menuKini = null;
    var d = Draft.baca(kunciDraft);
    if (d && d.data) {
      isi = d.data;
      catatanDraft.textContent = 'Draft tersimpan ' + jam(new Date(d.waktu).toISOString());
    } else if (baru && salinanMenu) {
      isi = salinanMenu;
    }
    salinanMenu = null;

    function simpanDraft() {
      var waktu = Draft.simpan(kunciDraft, isi);
      if (waktu) catatanDraft.textContent = 'Draft tersimpan ' + jam(new Date(waktu).toISOString());
    }

    function infoItem(nama) {
      var daftar = data && data.item || [];
      for (var i = 0; i < daftar.length; i++) if (daftar[i].nama.toLowerCase() === String(nama).toLowerCase()) return daftar[i];
      return { nama: nama, satuan: '', harga: null, aktif: true };
    }

    function cariMenu(nama) {
      var daftar = data && data.menu || [];
      for (var i = 0; i < daftar.length; i++) if (daftar[i].nama.toLowerCase() === String(nama).toLowerCase()) return daftar[i];
      return null;
    }

    function dariMenu(m) {
      return {
        nama: m.nama,
        hargaJual: m.hargaJual == null ? '' : String(m.hargaJual).replace('.', ','),
        bahan: m.bahan.map(function (b) {
          return { id: buatId(), item: b.item, qty: String(b.qty).replace('.', ','),
            hasil: b.hasilBersih === 100 ? '' : String(b.hasilBersih).replace('.', ',') };
        })
      };
    }

    /** Perkiraan dari isian (sama dengan hitungan server): { bahan: [{ beli, biaya }], biayaBahan, kecil, hpp, foodCost, ... }. */
    function hitung() {
      var target = data ? data.target : 35;
      var persenKecil = data ? data.bahanKecilPersen : 3;
      var hasil = { bahan: [], biayaBahan: 0, lengkap: isi.bahan.length > 0, tanpaHarga: [], salah: false };
      isi.bahan.forEach(function (b) {
        var it = infoItem(b.item);
        var q = bacaAngka(b.qty);
        var h = b.hasil === '' || b.hasil == null ? 100 : bacaAngka(b.hasil);
        var x = { beli: null, biaya: null, harga: it.harga };
        if (q === null || isNaN(q) || !(q > 0) || h === null || isNaN(h) || !(h > 0) || h > 100) {
          hasil.salah = true;
          hasil.lengkap = false;
        } else {
          x.beli = q / (h / 100);
          if (it.harga == null) {
            hasil.lengkap = false;
            hasil.tanpaHarga.push(b.item);
          } else {
            x.biaya = x.beli * it.harga;
            hasil.biayaBahan += x.biaya;
          }
        }
        hasil.bahan.push(x);
      });
      var jual = bacaAngka(String(isi.hargaJual || '').replace(/\./g, ''));
      hasil.jual = jual > 0 ? jual : null;
      hasil.target = target;
      hasil.persenKecil = persenKecil;
      if (hasil.lengkap) {
        hasil.kecil = hasil.biayaBahan * persenKecil / 100;
        hasil.hpp = hasil.biayaBahan + hasil.kecil;
        hasil.foodCost = hasil.jual ? Math.round(hasil.hpp / hasil.jual * 1000) / 10 : null;
        hasil.margin = hasil.jual ? hasil.jual - hasil.hpp : null;
        hasil.hargaTarget = Math.ceil(hasil.hpp / (target / 100) / 100) * 100;
      }
      return hasil;
    }

    function perbaruiRingkas(x) {
      kosongkan(ringkasKepala);
      ringkasKepala.hidden = !isi;
      if (!isi) return;
      var chip = [el('span', { class: 'chip-navy', text: isi.bahan.length + ' bahan' })];
      if (menuKini) chip.push(el('span', { class: 'chip-navy', text: menuKini.aktif ? 'Aktif' : 'Nonaktif' }));
      if (x.foodCost != null) chip.push(el('span', { class: 'chip-navy', text: x.foodCost > x.target ? 'Di atas target' : 'Sesuai target' }));
      ringkasKepala.appendChild(el('div', { class: 'kepala-chip' }, chip));
      ringkasKepala.appendChild(el('div', { class: 'kepala-angka' }, [
        el('div', {}, [
          el('span', { class: 'kepala-angka-label', text: 'HPP per porsi' }),
          el('span', { class: 'kepala-angka-nilai', text: x.hpp == null ? '–' : formatRupiah(x.hpp) })
        ]),
        el('div', {}, [
          el('span', { class: 'kepala-angka-label', text: 'Food cost' }),
          el('span', { class: 'kepala-angka-nilai', text: formatPersen(x.foodCost) }),
          el('span', { class: 'kepala-angka-sub', text: 'target ' + formatPersen(x.target) })
        ])
      ]));
    }

    function gambar(hasil, dariHp) {
      data = hasil;
      menuKini = baru ? null : cariMenu(namaAwal);
      kosongkan(wadah);
      if (!data.siap) {
        wadah.appendChild(el('p', { class: 'pesan-formulir tinjau' }, [ikon('info'),
          el('span', { text: 'Tab M_Menu dan M_MenuBahan belum ada. Pemilik Sheet perlu menjalankan ulang setupSpreadsheet.' })]));
        return;
      }
      if (!baru && !menuKini) {
        if (!dariHp) wadah.appendChild(kotakKosong('Menu ' + namaAwal + ' tidak ditemukan. Kembali ke daftar menu.', 'resep'));
        return;
      }
      if (!isi) isi = baru ? { nama: '', hargaJual: '', bahan: [] } : dariMenu(menuKini);
      gambarIsian();
    }

    function gambarIsian() {
      kosongkan(wadah);
      var pesan = el('p', { class: 'pesan-formulir', role: 'alert' });
      var kNama = kolomIsian({ label: 'Nama menu', maxlength: 60, nilai: isi.nama });
      kNama.input.addEventListener('input', function () { isi.nama = kNama.input.value; simpanDraft(); });
      var kJual = kolomIsian({ label: 'Harga jual (Rp)', inputmode: 'numeric', kelas: 'isian-angka', nilai: isi.hargaJual,
        bantuan: 'Harga di daftar menu, tanpa pajak dan service.' });
      kJual.input.addEventListener('input', function () { isi.hargaJual = kJual.input.value; simpanDraft(); perbaruiPerkiraan(); });

      var daftarBahan = el('ul', { class: 'daftar daftar-bahan-menu', 'aria-label': 'Bahan per porsi' });
      var kolomBahan = [];
      isi.bahan.forEach(function (b, i) {
        var it = infoItem(b.item);
        var idQty = 'menu-qty-' + (++nomorKolom);
        var idHasil = 'menu-hasil-' + (++nomorKolom);
        var inQty = el('input', { class: 'isian isian-angka', id: idQty, type: 'text', inputmode: 'decimal', autocomplete: 'off' });
        inQty.value = b.qty || '';
        var inHasil = el('input', { class: 'isian isian-angka', id: idHasil, type: 'text', inputmode: 'decimal', autocomplete: 'off',
          placeholder: '100' });
        inHasil.value = b.hasil == null ? '' : b.hasil;
        var beli = el('span', { class: 'menu-beli' });
        var biaya = el('strong', { class: 'menu-biaya' });
        var galat = el('p', { class: 'kolom-galat' });
        [[inQty, 'qty'], [inHasil, 'hasil']].forEach(function (p) {
          p[0].addEventListener('input', function () {
            b[p[1]] = p[0].value;
            p[0].setAttribute('aria-invalid', 'false');
            kosongkan(galat);
            simpanDraft();
            perbaruiPerkiraan();
          });
        });
        kolomBahan.push({ b: b, inQty: inQty, inHasil: inHasil, beli: beli, biaya: biaya, galat: galat, it: it });
        daftarBahan.appendChild(el('li', { class: 'baris-bahan-menu' }, [
          el('div', { class: 'baris-bahan-menu-kepala' }, [
            el('span', { class: 'daftar-baris-judul', text: b.item }),
            it.aktif === false ? tandaStatus('tinjau', 'Nonaktif') : null,
            el('button', { type: 'button', class: 'tombol-ikon', 'aria-label': 'Hapus ' + b.item + ' dari bahan',
              onclick: function () {
                isi.bahan = isi.bahan.filter(function (x) { return x !== b; });
                simpanDraft();
                gambarIsian();
              } }, ikon('sampah'))
          ]),
          el('div', { class: 'baris-bahan-menu-isian' }, [
            el('div', { class: 'kolom' }, [
              el('label', { class: 'kolom-label', for: idQty }, ['Takaran bersih', el('span', { class: 'sr', text: ' ' + b.item })]),
              el('div', { class: 'baris-angka' }, [inQty, el('span', { class: 'satuan-tetap', text: it.satuan })])
            ]),
            it.hargaDariResep
              ? el('p', { class: 'kolom-bantuan menu-hasil-tetap', text: 'Hasil bersih: sudah di resep' })
              : el('div', { class: 'kolom' }, [
                el('label', { class: 'kolom-label', for: idHasil }, ['Hasil bersih', el('span', { class: 'sr', text: ' ' + b.item })]),
                el('div', { class: 'baris-angka' }, [inHasil, el('span', { class: 'satuan-tetap', text: '%' })])
              ])
          ]),
          el('div', { class: 'baris-bahan-menu-ket' }, [beli, biaya]),
          galat
        ]));
        if (it.hargaDariResep) b.hasil = '';
      });
      var tambahBahan = tombol('Tambah bahan', 'kedua', { 'aria-haspopup': 'dialog' });
      tambahBahan.insertBefore(ikon('tambah'), tambahBahan.lastChild);
      tambahBahan.addEventListener('click', function () {
        var sudah = {};
        isi.bahan.forEach(function (b) { sudah[b.item.toLowerCase()] = true; });
        bukaPilihItem({
          judul: 'Tambah bahan',
          daftar: (data.item || []).filter(function (it) { return it.aktif && !sudah[it.nama.toLowerCase()]; }),
          kosong: 'Semua item aktif sudah menjadi bahan menu ini.',
          ket: function (it) {
            return [it.kategori, it.satuan, it.harga != null ? formatRupiah(it.harga) + ' per ' + it.satuan + (it.hargaDariResep ? ' (dari resep)' : '') : 'tanpa harga']
              .filter(Boolean).join(' · ');
          },
          pilih: function (it) {
            isi.bahan.push({ id: buatId(), item: it.nama, qty: '', hasil: '' });
            simpanDraft();
            gambarIsian();
            var input = wadah.querySelectorAll('.daftar-bahan-menu input');
            if (input.length && !apakahSentuh()) input[it.hargaDariResep ? input.length - 1 : input.length - 2].focus();
          }
        });
      });

      var perkiraan = el('div', { class: 'daftar-nilai', 'aria-live': 'polite' });
      var tandaPerkiraan = el('p');
      function perbaruiPerkiraan() {
        var x = hitung();
        kolomBahan.forEach(function (kb, i) {
          var hb = x.bahan[i];
          kb.beli.textContent = kb.it.harga == null ? 'Belum punya harga'
            : (hb && hb.beli != null && Math.abs(hb.beli - bacaAngka(kb.b.qty)) > 1e-9
              ? 'Dibeli ' + formatAngka(Math.round(hb.beli * 1000) / 1000) + ' ' + kb.it.satuan + ' × ' : '') +
              formatRupiah(kb.it.harga) + ' per ' + kb.it.satuan + (kb.it.hargaDariResep ? ', harga dari resep' : '');
          kb.biaya.textContent = hb && hb.biaya != null ? formatRupiah(hb.biaya) : '';
        });
        kosongkan(perkiraan);
        if (!isi.bahan.length) {
          perkiraan.appendChild(el('p', { class: 'kartu-teks', text: 'Perkiraan HPP muncul setelah bahan ditambahkan.' }));
        } else if (!x.lengkap) {
          perkiraan.appendChild(el('p', { class: 'kartu-teks', text: x.tanpaHarga.length
            ? x.tanpaHarga.join(', ') + ' belum punya harga, jadi HPP belum lengkap.'
            : 'Isi takaran bersih dan hasil bersih semua bahan.' }));
        } else {
          perkiraan.appendChild(barisNilai('Bahan di atas', formatRupiah(x.biayaBahan)));
          perkiraan.appendChild(barisNilai('Bahan kecil (bumbu, minyak, garnish) ' + formatPersen(x.persenKecil), formatRupiah(x.kecil)));
          perkiraan.appendChild(barisNilai('HPP per porsi', formatRupiah(x.hpp), 'total'));
          perkiraan.appendChild(barisNilai('Food cost', formatPersen(x.foodCost)));
          perkiraan.appendChild(barisNilai('Margin kotor per porsi', x.margin == null ? '–' : formatRupiah(x.margin)));
          perkiraan.appendChild(barisNilai('Harga jual untuk food cost ' + formatPersen(x.target), formatRupiah(x.hargaTarget), 'total'));
        }
        kosongkan(tandaPerkiraan);
        if (x.foodCost != null) {
          tandaPerkiraan.appendChild(x.foodCost > x.target ? tandaStatus('tinjau', 'Di atas target') : tandaStatus('baik', 'Sesuai target'));
        }
        perbaruiRingkas(x);
      }

      var simpan = tombol('Simpan menu', 'utama');
      simpan.addEventListener('click', function () {
        if (simpan.disabled) return;
        tulisPesan(pesan, '');
        var ok = true;
        if (!kNama.galat(isi.nama.trim() ? '' : 'Isi nama menu.')) ok = false;
        var jual = bacaAngka(String(isi.hargaJual || '').replace(/\./g, ''));
        if (!kJual.galat(jual === null ? 'Isi harga jual.' : (isNaN(jual) || !(jual > 0) ? 'Isi angka lebih dari 0, misalnya 58000.' : ''))) ok = false;
        kolomBahan.forEach(function (x) {
          var q = bacaAngka(x.b.qty);
          var h = x.b.hasil === '' || x.b.hasil == null ? 100 : bacaAngka(x.b.hasil);
          var salahQty = q === null || isNaN(q) || !(q > 0);
          var salahHasil = h === null || isNaN(h) || !(h > 0) || h > 100;
          x.inQty.setAttribute('aria-invalid', salahQty ? 'true' : 'false');
          x.inHasil.setAttribute('aria-invalid', salahHasil ? 'true' : 'false');
          kosongkan(x.galat);
          if (salahQty || salahHasil) {
            ok = false;
            x.galat.appendChild(ikonStatus('masalah'));
            x.galat.appendChild(el('span', { text: salahQty ? 'Isi takaran ' + x.b.item + ' per porsi, lebih dari 0.'
              : 'Hasil bersih ' + x.b.item + ' diisi persen di atas 0 sampai 100, misalnya 85.' }));
          }
        });
        if (!isi.bahan.length) {
          tulisPesan(pesan, 'Tambah minimal satu bahan.', 'masalah');
          return;
        }
        if (!ok) {
          var salahPertama = wadah.querySelector('[aria-invalid="true"]');
          if (salahPertama) salahPertama.focus();
          return;
        }
        aturTombolProses(simpan, true, 'Menyimpan…');
        panggilApi('simpanMenu', {
          baru: baru,
          namaLama: baru ? '' : menuKini.nama,
          nama: isi.nama.trim().replace(/\s+/g, ' '),
          hargaJual: jual,
          bahan: isi.bahan.map(function (b) {
            return { item: b.item, qty: bacaAngka(b.qty), hasilBersih: b.hasil === '' || b.hasil == null ? '' : bacaAngka(b.hasil) };
          })
        }).then(function (hasil) {
          Draft.hapus(kunciDraft);
          Cache.tulis('menu', hasil);
          toast('Menu tersimpan.');
          location.hash = '#/pengaturan/menu';
        }).catch(function (err) {
          aturTombolProses(simpan, false);
          if (tanganiSesiBerakhir(err)) return;
          tulisPesan(pesan, pesanGalat(err), 'masalah');
        });
      });

      wadah.appendChild(el('section', { class: 'kartu formulir' }, [kNama.wadah, kJual.wadah]));
      wadah.appendChild(el('section', { class: 'kartu formulir' }, [
        el('h2', { class: 'kartu-judul', text: 'Bahan per porsi' }),
        el('p', { class: 'kolom-bantuan', text: 'Takaran bersih = yang masuk ke piring, dalam satuan dasar bahan. Hasil bersih = sisa setelah ' +
          'dikupas, dibuang tulang, atau dibersihkan; kosongkan jika 100%.' }),
        isi.bahan.length ? daftarBahan : kotakKosong('Belum ada bahan. Ketuk Tambah bahan.'),
        el('div', {}, tambahBahan)
      ]));
      wadah.appendChild(el('section', { class: 'kartu' }, [
        el('h2', { class: 'kartu-judul', text: 'Perkiraan' }),
        perkiraan,
        tandaPerkiraan,
        el('p', { class: 'kolom-bantuan', text: 'Persen bahan kecil berlaku untuk semua menu dan diatur di Pengaturan → Outlet dan jadwal. ' +
          'Menu tidak mengurangi stock; stock tetap berkurang lewat Stock keluar dan Prep list.' })
      ]));
      wadah.appendChild(el('section', { class: 'kartu formulir' }, [pesan, el('div', {}, simpan)]));
      if (!baru && menuKini) wadah.appendChild(kartuKeadaan());
      perbaruiPerkiraan();
    }

    function kartuKeadaan() {
      var m = menuKini;
      var s = sakelarTampil({ nilai: m.aktif, kataYa: 'Aktif', kataTidak: 'Nonaktif', labelSr: 'Menu ' + m.nama });
      var ket = el('p', { class: 'kartu-teks', text: m.aktif ? 'Aktif. Menu ini ikut dihitung di HPP dan food cost.'
        : 'Nonaktif. Menu ini tidak tampil di HPP per menu.' });
      s.input.addEventListener('change', function () {
        var aktif = s.input.checked;
        if (!aktif) {
          konfirmasi({
            judul: 'Nonaktifkan menu ' + m.nama + '?',
            teks: 'Menu ini tidak tampil di HPP per menu sampai diaktifkan lagi. Takaran bahannya tetap tersimpan.',
            teksYa: 'Nonaktifkan',
            bahaya: true,
            jalankan: function () { return panggilApi('aturMenuAktif', { nama: m.nama, aktif: false }); }
          }).then(function (hasil) {
            if (!hasil) { s.atur(true); return; }
            Cache.tulis('menu', hasil);
            gambar(hasil);
            toast('Menu ' + m.nama + ' dinonaktifkan.');
          });
          return;
        }
        s.input.disabled = true;
        panggilApi('aturMenuAktif', { nama: m.nama, aktif: true }).then(function (hasil) {
          Cache.tulis('menu', hasil);
          gambar(hasil);
          toast('Menu ' + m.nama + ' aktif lagi.');
        }).catch(function (err) {
          if (tanganiSesiBerakhir(err)) return;
          gambar(data);
          toast(pesanGalat(err), 'masalah');
        });
      });
      var salin = tombol('Salin menu', 'kedua');
      salin.addEventListener('click', function () {
        var x = dariMenu(m);
        x.nama = m.nama + ' (bungkus)';
        salinanMenu = x;
        Draft.hapus('menu:+baru');
        location.hash = '#/pengaturan/menu-baru';
      });
      return el('section', { class: 'kartu' }, [
        el('h2', { class: 'kartu-judul', text: 'Keadaan menu' }),
        s.wadah,
        ket,
        el('hr', { class: 'pemisah' }),
        el('div', {}, salin),
        el('p', { class: 'kolom-bantuan', text: 'Untuk versi bungkus dengan kemasan, misalnya "' + m.nama + ' (bungkus)", dengan harga jualnya sendiri.' })
      ]);
    }

    muatData({
      kunciCache: 'menu',
      ambil: function () { return panggilApi('daftarMenu'); },
      gambar: function (hasil, dariHp) {
        // Isian yang sedang diketik tidak digambar ulang; hanya data pendukungnya diperbarui.
        if (isi && data && data.siap) {
          data = hasil;
          menuKini = baru ? null : cariMenu(namaAwal);
          return;
        }
        gambar(hasil, dariHp);
      },
      kerangka: function () { kosongkan(wadah).appendChild(kerangkaBaris(4)); },
      galat: function (pesan, cobaLagi) { kosongkan(wadah).appendChild(kotakGalat(pesan, cobaLagi)); },
      penanda: penanda
    });
  }

  /* ---------- Pengaturan → Form (spesifikasi tampilan Bagian 5.7, sistem Bagian 5.6) ---------- */

  function hrefFormUbah(id) {
    return '#/pengaturan/form/' + encodeURIComponent(id);
  }

  /**
   * Sakelar (role=switch) yang selalu disertai kata keadaannya: bawaannya Tampil /
   * Disembunyikan; kataYa dan kataTidak untuk kata lain (Wajib, Aktif / Nonaktif).
   */
  function sakelarTampil(opsi) {
    var id = 'sakelar-' + (++nomorKolom);
    var input = el('input', { type: 'checkbox', role: 'switch', class: 'sakelar-input', id: id,
      'aria-label': opsi.labelSr || null });
    input.checked = !!opsi.nilai;
    var kata = el('span', { class: 'sakelar-kata', text: opsi.nilai ? (opsi.kataYa || 'Tampil') : (opsi.kataTidak || 'Disembunyikan') });
    input.addEventListener('change', function () {
      kata.textContent = input.checked ? (opsi.kataYa || 'Tampil') : (opsi.kataTidak || 'Disembunyikan');
      if (opsi.ubah) opsi.ubah(input.checked);
    });
    return {
      wadah: el('label', { class: 'sakelar' + (opsi.kelas ? ' ' + opsi.kelas : ''), for: id }, [
        input,
        el('span', { class: 'sakelar-jalur', 'aria-hidden': 'true' }),
        opsi.teks ? el('span', { class: 'sakelar-teks', text: opsi.teks }) : null,
        kata
      ]),
      input: input,
      atur: function (b) {
        input.checked = b;
        kata.textContent = b ? (opsi.kataYa || 'Tampil') : (opsi.kataTidak || 'Disembunyikan');
      }
    };
  }

  function ketFormDaftar(f) {
    if (f.jenis !== 'kustom') return 'Bawaan';
    return 'Kustom · ' + teksJadwal(f) + ' · ' + f.jumlahKolom + ' kolom';
  }

  /**
   * Daftar semua form dalam urutan Beranda: nama, tanda Bawaan/Kustom, sakelar
   * tampil/sembunyi, tombol naik/turun (lalu "Simpan urutan"). Form kustom yang
   * dihapus tampil di bawah dengan "Pulihkan".
   */
  function layarFormDaftar(k) {
    aturJudul('Form');
    var penanda = el('span', { class: 'memperbarui', role: 'status' });
    var wadah = el('div');
    var wadahArsip = el('div');
    var ketBatas = el('p', { class: 'kolom-bantuan' });
    var tambah = el('a', { class: 'tombol tombol-utama', href: '#/pengaturan/form-baru' }, el('span', { class: 'tombol-teks', text: 'Buat form' }));
    var pesanSiap = el('p', { class: 'pesan-formulir', role: 'status' });
    k.wadah.appendChild(el('div', { class: 'layar-isi layar-sempit' }, [
      tautanKembali('Pengaturan', '#/pengaturan'),
      el('div', { class: 'kepala-isi' }, [el('h1', { class: 'judul-layar', text: 'Form' }), tambah]),
      el('p', { class: 'kartu-teks', text: 'Urutan ini dipakai tiket di Beranda. Form yang disembunyikan tidak tampil di Beranda, tetapi isian lamanya tetap ada di Riwayat.' }),
      pesanSiap,
      penanda,
      wadah,
      ketBatas,
      wadahArsip
    ]));
    var data = null;
    var urutan = null;

    function cari(id) {
      return (data.form || []).filter(function (f) { return f.id === id; })[0];
    }

    function terima(d) {
      Cache.tulis('form-daftar', d);
      var lama = urutan;
      data = d;
      // Urutan yang belum disimpan tetap, selama daftarnya sama.
      var ids = (d.form || []).map(function (f) { return f.id; }).sort().join('\n');
      urutan = lama && lama.slice().sort().join('\n') === ids ? lama : null;
      gambarSemua();
    }

    function gambarSemua() {
      var penuh = data.jumlahKustom >= data.batasForm;
      tambah.hidden = penuh || data.siap === false;
      ketBatas.textContent = data.jumlahKustom + ' dari ' + data.batasForm + ' form kustom dipakai.' +
        (penuh ? ' Hapus form kustom yang tidak dipakai lagi untuk membuat form baru.' : '');
      tulisPesan(pesanSiap, data.siap === false ? 'Form kustom belum bisa dibuat: pemilik Sheet perlu menjalankan ulang setupSpreadsheet di editor Apps Script.' : '', 'tinjau');
      gambarDaftar();
      gambarArsip();
    }

    function gambarDaftar() {
      kosongkan(wadah);
      var semua = data.form || [];
      var ids = urutan || semua.map(function (f) { return f.id; });
      var berubah = !!urutan && urutan.join('\n') !== semua.map(function (f) { return f.id; }).join('\n');
      var daftar = el('ol', { class: 'daftar daftar-urut', 'aria-label': 'Urutan form di Beranda' });
      ids.forEach(function (id, i) {
        var f = cari(id);
        if (!f) return;
        function geser(arah) {
          var baru = ids.slice();
          baru[i] = baru[i + arah];
          baru[i + arah] = id;
          urutan = baru;
          gambarDaftar();
          var t = wadah.querySelector('[data-urut="' + (arah < 0 ? 'naik' : 'turun') + '-' + (i + arah) + '"]');
          if (!t || t.disabled) t = wadah.querySelector('[data-urut="' + (arah < 0 ? 'turun' : 'naik') + '-' + (i + arah) + '"]');
          if (t) t.focus();
        }
        var s = sakelarTampil({
          nilai: f.aktif,
          labelSr: 'Tampilkan ' + f.nama + ' di Beranda',
          ubah: function (b) {
            s.input.disabled = true;
            panggilApi('aturFormTampil', { formId: f.id, tampil: b }).then(function (d) {
              terima(d);
              toast(f.nama + (b ? ' tampil di Beranda.' : ' disembunyikan dari Beranda.'));
            }).catch(function (err) {
              s.input.disabled = false;
              s.atur(!b);
              if (tanganiSesiBerakhir(err)) return;
              toast(pesanGalat(err), 'masalah');
            });
          }
        });
        daftar.appendChild(el('li', { class: 'baris-urut baris-form' + (f.aktif ? '' : ' nonaktif') }, [
          el('div', { class: 'baris-form-isi' }, [
            el('a', { class: 'baris-urut-nama', href: hrefFormUbah(f.id) }, el('span', { class: 'daftar-baris-isi' }, [
              el('span', { class: 'daftar-baris-judul', text: f.nama }),
              el('span', { class: 'tanda-deret bungkus' }, [el('span', { class: 'tanda-jenis', text: f.jenis === 'kustom' ? 'Kustom' : 'Bawaan' })]),
              el('span', { class: 'daftar-baris-ket', text: f.jenis === 'kustom' ? teksJadwal(f) + ' · ' + f.jumlahKolom + ' kolom' : 'Kolom terkunci' })
            ])),
            s.wadah
          ]),
          el('button', { type: 'button', class: 'tombol-ikon', 'data-urut': 'naik-' + i, 'aria-label': 'Naikkan ' + f.nama, disabled: i === 0,
            onclick: function () { geser(-1); } }, ikon('atas')),
          el('button', { type: 'button', class: 'tombol-ikon', 'data-urut': 'turun-' + i, 'aria-label': 'Turunkan ' + f.nama, disabled: i === ids.length - 1,
            onclick: function () { geser(1); } }, ikon('bawah'))
        ]));
      });
      wadah.appendChild(semua.length ? daftar : kotakKosong('Belum ada form. Ketuk Buat form untuk membuat form pertama.', 'tiket'));
      if (berubah) {
        var pesan = el('p', { class: 'pesan-formulir', role: 'alert' });
        var simpan = tombol('Simpan urutan', 'utama');
        var batal = tombol('Batal', 'kedua', { onclick: function () { urutan = null; gambarDaftar(); } });
        simpan.addEventListener('click', function () {
          aturTombolProses(simpan, true, 'Menyimpan…');
          panggilApi('urutForm', { urutan: urutan }).then(function (d) {
            urutan = null;
            terima(d);
            toast('Urutan form tersimpan.');
          }).catch(function (err) {
            aturTombolProses(simpan, false);
            if (tanganiSesiBerakhir(err)) return;
            tulisPesan(pesan, pesanGalat(err), 'masalah');
          });
        });
        wadah.appendChild(el('div', { class: 'deret-tombol urut-aksi' }, [batal, simpan]));
        wadah.appendChild(pesan);
      }
    }

    function gambarArsip() {
      kosongkan(wadahArsip);
      var arsip = data.arsip || [];
      if (!arsip.length) return;
      wadahArsip.appendChild(el('section', { class: 'bagian', 'aria-labelledby': 'judul-arsip-form' }, [
        el('h2', { class: 'judul-bagian', id: 'judul-arsip-form', text: 'Form yang dihapus' }),
        el('p', { class: 'kartu-teks', text: 'Isian lamanya tetap tersimpan di spreadsheet. Pulihkan untuk memakainya lagi.' }),
        el('ul', { class: 'daftar' }, arsip.map(function (f) {
          var t = tombol('Pulihkan', 'kedua', { 'aria-label': 'Pulihkan ' + f.nama });
          t.addEventListener('click', function () {
            aturTombolProses(t, true, 'Memulihkan…');
            panggilApi('pulihkanForm', { formId: f.id }).then(function (d) {
              terima(d);
              toast('Form ' + f.nama + ' dipulihkan.');
            }).catch(function (err) {
              aturTombolProses(t, false);
              if (tanganiSesiBerakhir(err)) return;
              toast(pesanGalat(err), 'masalah');
            });
          });
          return el('li', { class: 'baris-tetap' }, [
            el('span', { class: 'baris-tetap-teks daftar-baris-isi' }, [
              el('span', { class: 'daftar-baris-judul', text: f.nama }),
              el('span', { class: 'daftar-baris-ket', text: 'Dihapus ' + (f.diarsipkan ? waktuPendek(f.diarsipkan) : '') + ' · ' + f.jumlahKolom + ' kolom' })
            ]),
            t
          ]);
        }))
      ]));
    }

    muatData({
      kunciCache: 'form-daftar',
      ambil: function () { return panggilApi('daftarForm'); },
      gambar: function (d) {
        data = d;
        gambarSemua();
      },
      kerangka: function () { kosongkan(wadah).appendChild(kerangkaBaris(4)); },
      galat: function (pesan, cobaLagi) { kosongkan(wadah).appendChild(kotakGalat(pesan, cobaLagi)); },
      penanda: penanda
    });
  }

  /**
   * Lembar tambah/ubah kolom (tampilan Bagian 5.7): label, jenis, pilihan (jika
   * Pilihan), dan sakelar wajib. opsi: { kolom (null = baru), bagian,
   * jenisTerkunci, labelLain: [label kecil yang sudah dipakai], simpan(kolom) }.
   */
  function bukaLembarKolom(opsi) {
    var c = opsi.kolom || { bagian: opsi.bagian, label: '', jenis: 'Teks', pilihan: [], wajib: false };
    var kLabel = kolomIsian({ label: 'Label', maxlength: 40, nilai: c.label,
      bantuan: opsi.bagian === 'kepala' ? 'Misalnya Shift atau Area.' : 'Misalnya Butir, Jumlah, atau Kondisi.' });
    var gJenis = null;
    var teksJenis = null;
    if (opsi.jenisTerkunci) {
      teksJenis = el('div', { class: 'kolom' }, [
        el('span', { class: 'kolom-label', text: 'Jenis kolom' }),
        el('p', { class: 'nilai-terpilih' }, [ikon('kunci'), ' ', el('strong', { text: c.jenis })]),
        el('p', { class: 'kolom-bantuan', text: 'Tidak bisa diganti karena form ini sudah punya isian. Hapus kolomnya, lalu buat kolom baru.' })
      ]);
    } else {
      gJenis = grupPilihan('Jenis kolom', JENIS_KOLOM, c.jenis);
      gJenis.wadah.querySelector('fieldset').classList.add('pilihan-jenis-kolom');
    }
    var idPilihan = 'kolom-' + (++nomorKolom);
    var inPilihan = el('textarea', { class: 'isian isian-catatan', id: idPilihan, rows: 4, 'aria-describedby': idPilihan + '-bantuan' });
    inPilihan.value = (c.pilihan || []).join('\n');
    var galatPilihan = el('p', { class: 'kolom-galat' });
    var bagianPilihan = el('div', { class: 'kolom' }, [
      el('label', { class: 'kolom-label', for: idPilihan, text: 'Pilihan' }),
      el('p', { class: 'kolom-bantuan', id: idPilihan + '-bantuan', text: 'Satu pilihan per baris, minimal dua. Empat atau kurang tampil sebagai tombol, selebihnya dropdown.' }),
      inPilihan,
      galatPilihan
    ]);
    var wajib = c.wajib;
    var sWajib = sakelarTampil({ nilai: c.wajib, teks: 'Wajib diisi', kataYa: 'Wajib', kataTidak: 'Tidak wajib', ubah: function (b) { wajib = b; } });
    var pesan = el('p', { class: 'pesan-formulir', role: 'alert' });
    function jenisKini() { return gJenis ? gJenis.nilai() : c.jenis; }
    function aturPilihan() { bagianPilihan.hidden = jenisKini() !== 'Pilihan'; }
    if (gJenis) gJenis.input.forEach(function (i) { i.addEventListener('change', function () { gJenis.galat(''); aturPilihan(); }); });
    aturPilihan();
    var CADANGAN = ['tanggal', 'nama staff', 'no'];

    function simpan(t, l) {
      tulisPesan(pesan, '');
      var label = kLabel.input.value.replace(/\s+/g, ' ').trim();
      var kecil = label.toLowerCase();
      var ok = true;
      var salahLabel = !label ? 'Isi label kolom.'
        : (/^[=+\-@]/.test(label) ? 'Label tidak boleh diawali tanda =, +, -, atau @.'
          : (CADANGAN.indexOf(kecil) >= 0 || /^(submission_id|row_id|outlet|timestamp_server|timestamp_device|submitted_by|status|checked_by|checked_at|updated_by|updated_at|flagged_by|flag_note)$/.test(kecil)
            ? 'Label ' + label + ' sudah dipakai sistem. Pakai label lain.'
            : (opsi.labelLain.indexOf(kecil) >= 0 ? 'Label ' + label + ' sudah dipakai kolom lain di form ini.' : '')));
      if (!kLabel.galat(salahLabel)) ok = false;
      var jenis = jenisKini();
      if (gJenis && !gJenis.galat(jenis ? '' : 'Pilih jenis kolom.')) ok = false;
      var pilihan = [];
      kosongkan(galatPilihan);
      if (jenis === 'Pilihan') {
        var sudah = {};
        inPilihan.value.split('\n').forEach(function (p) {
          var x = p.replace(/\s+/g, ' ').trim();
          if (x && !sudah[x.toLowerCase()]) { sudah[x.toLowerCase()] = true; pilihan.push(x); }
        });
        var salahPilihan = pilihan.length < 2 ? 'Tulis minimal dua pilihan, satu per baris.'
          : (pilihan.length > 20 ? 'Paling banyak 20 pilihan.'
            : (pilihan.some(function (x) { return x.length > 40; }) ? 'Tiap pilihan paling panjang 40 huruf.'
              : (pilihan.some(function (x) { return /^[=+\-@]/.test(x) || x.indexOf('|') >= 0; }) ? 'Pilihan tidak boleh diawali =, +, -, atau @, dan tidak boleh memuat tanda |.' : '')));
        if (salahPilihan) {
          ok = false;
          galatPilihan.appendChild(ikonStatus('masalah'));
          galatPilihan.appendChild(el('span', { text: salahPilihan }));
          inPilihan.setAttribute('aria-invalid', 'true');
        } else {
          inPilihan.setAttribute('aria-invalid', 'false');
        }
      }
      if (!ok) {
        var pertama = l.elemen.querySelector('[aria-invalid="true"]');
        if (pertama) pertama.focus();
        return;
      }
      l.tutup();
      opsi.simpan(Object.assign({}, c, { label: label, jenis: jenis, pilihan: jenis === 'Pilihan' ? pilihan : [], wajib: wajib }));
    }
    var form = el('form', { class: 'formulir', novalidate: true }, [kLabel.wadah, gJenis ? gJenis.wadah : teksJenis, bagianPilihan,
      el('div', { class: 'kolom' }, sWajib.wadah), pesan]);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      simpan(lembar.tombol[1], lembar);
    });
    var lembar = bukaLembar({
      judul: opsi.kolom ? 'Ubah kolom ' + c.label : (opsi.bagian === 'kepala' ? 'Tambah kolom kepala' : 'Tambah kolom baris'),
      isi: form,
      aksi: [{ teks: 'Batal', jenis: 'kedua' }, { teks: opsi.kolom ? 'Simpan kolom' : 'Tambah kolom', jenis: 'utama', klik: simpan }]
    });
  }

  /** Pratinjau: layar isi form persis seperti yang dilihat staff, tanpa mengirim apa pun. */
  function bukaPratinjauForm(def, item) {
    var keadaan = { kepala: {}, baris: [] };
    var wadahBaris = el('div');
    var penghitung = el('span', { class: 'penghitung' });
    var pesan = el('p', { class: 'pesan-formulir', role: 'alert' });
    var hariIni = tanggalIso(new Date());
    var gTanggal = pilihanTanggalIsian({ pengelola: false, tanggal: hariIni, ganti: function () {} });
    var isian = isianFormKustom({
      def: def, item: item || [], keadaan: keadaan, wadahBaris: wadahBaris, penghitung: penghitung,
      desktop: function () { return window.matchMedia(DESKTOP).matches; },
      ubah: function () { tulisPesan(pesan, ''); }
    });
    var tambahB = tombol('Tambah baris', 'kedua', { onclick: function () { isian.tambahBaris(); } });
    tambahB.insertBefore(ikon('tambah'), tambahB.lastChild);
    var kirimB = tombol('Kirim ' + (def.nama || 'form').toLowerCase(), 'utama', {
      onclick: function () {
        var salah = isian.periksa();
        if (salah) {
          tulisPesan(pesan, salah.pesan, 'masalah');
          salah.fokus();
          return;
        }
        tulisPesan(pesan, 'Isian lengkap. Ini pratinjau, jadi tidak ada yang dikirim.', 'info');
      }
    });
    isian.gambarBaris();
    var tanpaSisi = el('div', { class: 'layar-form layar-kustom pratinjau-form' }, [
      el('p', { class: 'pesan-formulir info' }, [ikon('info'), el('span', { text: 'Pratinjau. Isian di sini tidak disimpan dan tidak dikirim.' })]),
      el('h3', { class: 'kartu-judul', text: def.nama || 'Form tanpa nama' }),
      el('p', { class: 'kolom-bantuan keterangan-form', text: kalimatKeterangan(def.keterangan, 'Jadwal: ' + teksJadwal(def) + '.') }),
      el('section', { class: 'kartu kotak-info', 'aria-label': 'Kotak info' }, [gTanggal.wadah,
        isian.kepala.length ? el('div', { class: 'kepala-kustom' }, isian.kepala) : null,
        el('div', { class: 'lebar-penuh' }, el('div', { class: 'baris-nihil' }, tombol('Tidak ada hari ini', 'kedua', {
          onclick: function () { tulisPesan(pesan, 'Ini pratinjau. Tanda nihil tidak disimpan.', 'info'); }
        })))]),
      wadahBaris,
      pesan,
      el('div', { class: 'bilah-kirim bilah-pratinjau' }, [penghitung, el('div', { class: 'deret-tombol bilah-kirim-tombol' }, [tambahB, kirimB])])
    ]);
    bukaLembar({ judul: 'Pratinjau ' + (def.nama || 'form'), isi: tanpaSisi, lebar: true, aksi: [{ teks: 'Tutup pratinjau', jenis: 'kedua' }] });
  }

  /**
   * Layar susun form (tampilan Bagian 5.7): nama, keterangan, jadwal, tampil,
   * kolom kepala, kolom baris (menu titik tiga: ubah, geser, hapus), Lihat
   * pratinjau, Simpan form, dan Hapus form. Form bawaan: hanya nama dan
   * tampil/sembunyi; daftar kolomnya terkunci. Isian tersimpan sebagai draft.
   */
  function layarFormUbah(k) {
    var baru = !k.cocok[1];
    var idForm = '';
    if (!baru) {
      try {
        idForm = decodeURIComponent(k.cocok[1]).toUpperCase();
      } catch (err) {
        idForm = String(k.cocok[1]).toUpperCase();
      }
    }
    var daftarSimpan = Cache.baca('form-daftar');
    var dariDaftar = !baru && daftarSimpan && daftarSimpan.data ? (daftarSimpan.data.form || []).filter(function (f) { return f.id === idForm; })[0] : null;
    var judulAwal = baru ? 'Buat form' : (dariDaftar ? dariDaftar.nama : 'Ubah form');
    aturJudul(judulAwal);
    var kunciDraft = 'form:' + (baru ? '+baru' : idForm);
    var judul = el('h1', { class: 'judul-layar', text: judulAwal });
    var catatanDraft = el('p', { class: 'catatan-draft', 'aria-live': 'polite' });
    var penanda = el('span', { class: 'memperbarui', role: 'status' });
    var wadah = el('div');
    k.wadah.appendChild(el('div', { class: 'layar-isi layar-sempit layar-form' }, [
      tautanKembali('Form', '#/pengaturan/form'),
      judul,
      catatanDraft,
      penanda,
      wadah
    ]));

    var data = null;
    var isi = null; // { nama, keterangan, jadwal, hari, tampil, kolom: [{ kunci, id, bagian, label, jenis, pilihan, wajib }] }
    var d = Draft.baca(kunciDraft);
    if (d && d.data) {
      isi = d.data;
      catatanDraft.textContent = 'Draft tersimpan ' + jam(new Date(d.waktu).toISOString());
    }

    function simpanDraft() {
      var waktu = Draft.simpan(kunciDraft, isi);
      if (waktu) catatanDraft.textContent = 'Draft tersimpan ' + jam(new Date(waktu).toISOString());
    }

    function dariServer(f) {
      return {
        nama: f.nama, keterangan: f.keterangan || '', jadwal: f.jadwal || 'harian', hari: (f.hari || []).slice(), tampil: f.aktif !== false,
        kolom: (f.kolom || []).filter(function (c) { return c.aktif; }).map(function (c) {
          return { kunci: c.id, id: c.id, bagian: c.bagian, label: c.label, jenis: c.jenis, pilihan: (c.pilihan || []).slice(), wajib: !!c.wajib };
        })
      };
    }

    function gambar(hasil) {
      data = hasil;
      if (!baru && !hasil.form) {
        kosongkan(wadah).appendChild(kotakKosong('Form tidak ditemukan. Kembali ke daftar form.', 'tiket'));
        return;
      }
      if (!isi) isi = baru ? { nama: '', keterangan: '', jadwal: 'harian', hari: [], tampil: true, kolom: [] } : dariServer(hasil.form);
      if (!baru) {
        aturJudul(hasil.form.nama);
        judul.textContent = hasil.form.nama;
      }
      gambarIsian();
    }

    function kolomServer(id) {
      return (data.form && data.form.kolom || []).filter(function (c) { return c.id === id; })[0] || null;
    }

    function gambarIsian() {
      kosongkan(wadah);
      var bawaan = !baru && data.form.jenis === 'bawaan';
      var pesan = el('p', { class: 'pesan-formulir', role: 'alert' });
      var kNama = kolomIsian({ label: 'Nama form', maxlength: 40, nilai: isi.nama,
        bantuan: bawaan ? 'Nama yang tampil di tiket Beranda, Riwayat, dan laporan.' : 'Misalnya Checklist kebersihan.' });
      kNama.input.addEventListener('input', function () { isi.nama = kNama.input.value; kNama.galat(''); simpanDraft(); });
      var sTampil = sakelarTampil({ nilai: isi.tampil, teks: 'Tampil di Beranda', ubah: function (b) { isi.tampil = b; simpanDraft(); } });
      var bagianUtama = [kNama.wadah];
      var gJadwal = null;
      var galatHari = el('p', { class: 'kolom-galat' });
      if (!bawaan) {
        var kKet = kolomIsian({ label: 'Keterangan', maxlength: 120, nilai: isi.keterangan, bantuan: 'Tidak wajib. Misalnya Diisi tiap closing.' });
        kKet.input.addEventListener('input', function () { isi.keterangan = kKet.input.value; simpanDraft(); });
        var nilaiJadwal = { harian: 'Setiap hari', 'hari tertentu': 'Hari tertentu', 'sewaktu-waktu': 'Sewaktu-waktu' };
        gJadwal = grupPilihan('Jadwal', ['Setiap hari', 'Hari tertentu', 'Sewaktu-waktu'], nilaiJadwal[isi.jadwal] || 'Setiap hari');
        var hari = el('fieldset', { class: 'pilihan-grup pilihan-hari' }, [el('legend', { class: 'sr', text: 'Hari' })].concat(URUTAN_HARI.map(function (h) {
          var cb = el('input', { type: 'checkbox', value: h });
          cb.checked = isi.hari.indexOf(h) >= 0;
          cb.addEventListener('change', function () {
            isi.hari = URUTAN_HARI.filter(function (x) {
              var i = hari.querySelector('input[value="' + x + '"]');
              return i && i.checked;
            });
            kosongkan(galatHari);
            simpanDraft();
          });
          return el('label', { class: 'pilihan' }, [cb, el('span', { text: h.slice(0, 3), title: h, 'aria-label': h })]);
        })));
        var bantuJadwal = el('p', { class: 'kolom-bantuan' });
        function aturJadwal() {
          var v = gJadwal.nilai();
          hari.hidden = v !== 'Hari tertentu';
          bantuJadwal.textContent = v === 'Sewaktu-waktu' ? 'Diisi hanya saat perlu. Tidak pernah ditagih di Beranda dan email harian.'
            : (v === 'Hari tertentu' ? 'Hanya ditagih di Beranda dan email harian pada hari yang dipilih.' : 'Ditagih setiap hari di Beranda dan email harian.');
        }
        gJadwal.input.forEach(function (i) {
          i.addEventListener('change', function () {
            var v = gJadwal.nilai();
            isi.jadwal = v === 'Hari tertentu' ? 'hari tertentu' : (v === 'Sewaktu-waktu' ? 'sewaktu-waktu' : 'harian');
            aturJadwal();
            simpanDraft();
          });
        });
        aturJadwal();
        gJadwal.wadah.appendChild(hari);
        gJadwal.wadah.appendChild(bantuJadwal);
        gJadwal.wadah.appendChild(galatHari);
        bagianUtama.push(kKet.wadah, gJadwal.wadah);
      }
      bagianUtama.push(el('div', { class: 'kolom' }, sTampil.wadah));
      wadah.appendChild(el('section', { class: 'kartu formulir', 'aria-label': 'Nama dan jadwal' }, bagianUtama));

      if (bawaan) {
        wadah.appendChild(el('section', { class: 'kartu formulir', 'aria-labelledby': 'judul-kolom-bawaan' }, [
          el('h2', { class: 'kartu-judul', id: 'judul-kolom-bawaan', text: 'Kolom' }),
          el('p', { class: 'pesan-formulir info' }, [ikon('kunci'), el('span', { text: 'Kolom form bawaan terikat pada hitungan otomatis dan tidak bisa diubah. Form ini juga tidak bisa dihapus, hanya disembunyikan.' })]),
          el('ul', { class: 'daftar daftar-kolom-form' }, (data.kolomBawaan || []).map(function (l) {
            return el('li', { class: 'baris-kolom-form terkunci' }, el('span', { class: 'daftar-baris-judul', text: l }));
          }))
        ]));
      } else {
        wadah.appendChild(bagianKolom('kepala', 'Kolom kepala', 'Diisi sekali per isian, misalnya shift atau area. Tidak wajib ada.'));
        wadah.appendChild(bagianKolom('baris', 'Kolom baris', 'Diisi berulang, satu baris per butir, seperti tabel di form kertas. Minimal satu kolom.'));
        var jumlah = isi.kolom.length;
        wadah.appendChild(el('p', { class: 'kolom-bantuan catatan-kolom-form' }, 'Tanggal dan nama pengisi tercatat otomatis. ' + jumlah + ' dari ' + (data.batasKolom || 15) + ' kolom.'));
        if (data.adaIsian) {
          wadah.appendChild(el('p', { class: 'pesan-formulir info' }, [ikon('info'), el('span', {
            text: 'Form ini sudah punya isian. Jenis kolom yang sudah ada tidak bisa diganti. Kolom baru kosong di isian lama. Kolom yang dihapus tetap tersimpan di spreadsheet dan Riwayat.' })]));
        }
      }

      var simpan = tombol('Simpan form', 'utama');
      var lihat = bawaan ? null : tombol('Lihat pratinjau', 'kedua', { 'aria-haspopup': 'dialog' });
      if (lihat) {
        lihat.addEventListener('click', function () {
          bukaPratinjauForm({ nama: isi.nama.trim(), keterangan: isi.keterangan.trim(), jadwal: isi.jadwal, hari: isi.hari,
            kolom: isi.kolom.map(function (c) { return { id: c.kunci, bagian: c.bagian, label: c.label, jenis: c.jenis, pilihan: c.pilihan, wajib: c.wajib }; }) },
          data.item || []);
        });
      }
      simpan.addEventListener('click', function () {
        if (simpan.disabled) return;
        tulisPesan(pesan, '');
        var nama = isi.nama.replace(/\s+/g, ' ').trim();
        if (!kNama.galat(nama ? '' : 'Isi nama form.')) {
          kNama.input.focus();
          return;
        }
        if (!bawaan && isi.jadwal === 'hari tertentu' && !isi.hari.length) {
          galatHari.appendChild(ikonStatus('masalah'));
          galatHari.appendChild(el('span', { text: 'Pilih minimal satu hari.' }));
          tulisPesan(pesan, 'Pilih minimal satu hari untuk jadwal Hari tertentu.', 'masalah');
          return;
        }
        if (!bawaan && !isi.kolom.some(function (c) { return c.bagian === 'baris'; })) {
          tulisPesan(pesan, 'Tambah minimal satu kolom baris.', 'masalah');
          return;
        }
        if (navigator.onLine === false) {
          tulisPesan(pesan, PESAN.tidakAdaSinyal, 'masalah');
          return;
        }
        aturTombolProses(simpan, true, 'Menyimpan…');
        panggilApi('simpanForm', {
          baru: baru, formId: idForm, nama: nama, tampil: isi.tampil, keterangan: isi.keterangan, jadwal: isi.jadwal, hari: isi.hari,
          kolom: isi.kolom.map(function (c) {
            return { id: c.id || '', bagian: c.bagian, label: c.label, jenis: c.jenis, pilihan: c.pilihan, wajib: c.wajib };
          })
        }).then(function (hasil) {
          Draft.hapus(kunciDraft);
          Cache.tulis('form-daftar', hasil);
          var s = hasil.disimpan || {};
          toast(s.tampil ? 'Form tersimpan dan sudah tampil di Beranda.' : 'Form tersimpan. Form ini disembunyikan dari Beranda.');
          location.hash = '#/pengaturan/form';
        }).catch(function (err) {
          aturTombolProses(simpan, false);
          if (tanganiSesiBerakhir(err)) return;
          tulisPesan(pesan, pesanGalat(err), 'masalah');
        });
      });
      wadah.appendChild(pesan);
      wadah.appendChild(el('div', { class: 'bilah-kirim bilah-susun' }, [
        el('span', { class: 'penghitung', text: bawaan ? 'Form bawaan' : isi.kolom.length + ' kolom' }),
        el('div', { class: 'deret-tombol bilah-kirim-tombol' }, [lihat, simpan])
      ]));

      if (!baru && !bawaan) {
        wadah.appendChild(el('section', { class: 'kartu bagian-hapus-form' }, [
          el('h2', { class: 'kartu-judul', text: 'Hapus form' }),
          el('p', { class: 'kartu-teks', text: 'Form hilang dari aplikasi. Isian lamanya tetap tersimpan di spreadsheet dan bisa dipulihkan dari daftar form.' }),
          tombol('Hapus form', 'bahaya', { onclick: hapusForm })
        ]));
      }
    }

    function labelLain(kecuali) {
      var semua = isi.kolom.filter(function (c) { return c !== kecuali; }).map(function (c) { return c.label.toLowerCase(); });
      // Label kolom yang sudah dihapus tetap dipakai di tab datanya.
      (data.form && data.form.kolom || []).forEach(function (c) {
        if (!c.aktif) semua.push(c.label.toLowerCase());
      });
      return semua;
    }

    function bagianKolom(bagian, judulBagian, bantuan) {
      var kolom = isi.kolom.filter(function (c) { return c.bagian === bagian; });
      var penuh = isi.kolom.length >= (data.batasKolom || 15);
      var tambahK = tombol(bagian === 'kepala' ? 'Tambah kolom kepala' : 'Tambah kolom baris', 'kedua', { 'aria-haspopup': 'dialog', disabled: penuh });
      tambahK.insertBefore(ikon('tambah'), tambahK.lastChild);
      tambahK.addEventListener('click', function () {
        bukaLembarKolom({
          bagian: bagian, labelLain: labelLain(null),
          simpan: function (c) {
            c.kunci = 'baru-' + buatId();
            c.id = '';
            isi.kolom.push(c);
            simpanDraft();
            gambarIsian();
          }
        });
      });
      var daftar = el('ul', { class: 'daftar daftar-kolom-form', 'aria-label': judulBagian });
      kolom.forEach(function (c, i) {
        var ket = c.jenis + (c.jenis === 'Pilihan' ? ': ' + c.pilihan.join(', ') : '') + ' · ' + (c.wajib ? 'wajib' : 'tidak wajib');
        daftar.appendChild(el('li', { class: 'baris-kolom-form' }, [
          el('span', { class: 'daftar-baris-isi' }, [
            el('span', { class: 'daftar-baris-judul', text: c.label }),
            el('span', { class: 'daftar-baris-ket', text: ket })
          ]),
          el('button', { type: 'button', class: 'tombol-ikon', 'aria-haspopup': 'dialog', 'aria-label': 'Menu kolom ' + c.label,
            onclick: function () { menuKolom(c, kolom, i); } }, ikon('titikTiga'))
        ]));
      });
      return el('section', { class: 'kartu formulir', 'aria-label': judulBagian }, [
        el('h2', { class: 'kartu-judul', text: judulBagian }),
        el('p', { class: 'kolom-bantuan', text: bantuan }),
        kolom.length ? daftar : el('p', { class: 'otomatis', text: bagian === 'kepala' ? 'Belum ada kolom kepala.' : 'Belum ada kolom baris. Ketuk Tambah kolom baris.' }),
        el('div', {}, tambahK)
      ]);
    }

    /** Menu titik tiga satu kolom: ubah, geser naik/turun, hapus. */
    function menuKolom(c, sebagian, i) {
      function geser(arah) {
        var lain = sebagian[i + arah];
        var a = isi.kolom.indexOf(c);
        var b = isi.kolom.indexOf(lain);
        isi.kolom[a] = lain;
        isi.kolom[b] = c;
        simpanDraft();
        lembar.tutup(true);
        gambarIsian();
        var t = wadah.querySelector('[aria-label="Menu kolom ' + c.label.replace(/"/g, '\\"') + '"]');
        if (t) t.focus();
      }
      var server = c.id ? kolomServer(c.id) : null;
      var tombolMenu = [
        tombol('Ubah', 'kedua', { onclick: function () {
          lembar.tutup(true);
          bukaLembarKolom({
            kolom: c, bagian: c.bagian, labelLain: labelLain(c), jenisTerkunci: !!(server && data.adaIsian),
            simpan: function (baruK) {
              var j = isi.kolom.indexOf(c);
              if (j >= 0) isi.kolom[j] = baruK;
              simpanDraft();
              gambarIsian();
            }
          });
        } }),
        tombol('Geser ke atas', 'kedua', { disabled: i === 0, onclick: function () { geser(-1); } }),
        tombol('Geser ke bawah', 'kedua', { disabled: i === sebagian.length - 1, onclick: function () { geser(1); } }),
        tombol('Hapus kolom', 'bahaya', { onclick: function () {
          lembar.tutup(true);
          konfirmasi({
            judul: 'Hapus kolom ' + c.label + '?',
            teks: server
              ? 'Kolom hilang dari layar isi. Isian lamanya tetap tersimpan di spreadsheet dan Riwayat. Perubahan berlaku setelah Simpan form.'
              : 'Kolom ini belum pernah disimpan, jadi langsung hilang.',
            teksYa: 'Hapus',
            bahaya: true
          }).then(function (ya) {
            if (!ya) return;
            isi.kolom = isi.kolom.filter(function (x) { return x !== c; });
            simpanDraft();
            gambarIsian();
            toast('Kolom ' + c.label + ' dihapus. Ketuk Simpan form untuk menyimpan.');
          });
        } })
      ];
      var lembar = bukaLembar({
        judul: 'Kolom ' + c.label,
        isi: el('div', { class: 'menu-kolom' }, tombolMenu),
        aksi: [{ teks: 'Tutup', jenis: 'kedua' }]
      });
    }

    function hapusForm() {
      var nama = data.form.nama;
      konfirmasi({
        judul: 'Hapus form ' + nama + '?',
        teks: 'Form hilang dari aplikasi. Isian lamanya tetap tersimpan di spreadsheet.',
        teksYa: 'Hapus',
        teksProses: 'Menghapus…',
        bahaya: true,
        jalankan: function () { return panggilApi('arsipkanForm', { formId: idForm }); }
      }).then(function (hasil) {
        if (!hasil) return;
        Draft.hapus(kunciDraft);
        Cache.tulis('form-daftar', hasil);
        toast('Form ' + nama + ' dihapus.');
        location.hash = '#/pengaturan/form';
      });
    }

    muatData({
      kunciCache: 'form:' + (baru ? '+baru' : idForm),
      ambil: function () { return panggilApi('detailForm', { formId: idForm }); },
      gambar: function (hasil) {
        // Isian yang sedang diketik tidak digambar ulang; hanya data pendukungnya diperbarui.
        if (isi && data) {
          var ulang = JSON.stringify(data.form && data.form.kolom) !== JSON.stringify(hasil.form && hasil.form.kolom) || data.adaIsian !== hasil.adaIsian;
          data = hasil;
          if (ulang) gambarIsian();
          return;
        }
        gambar(hasil);
      },
      kerangka: function () { kosongkan(wadah).appendChild(kerangkaBaris(4)); },
      galat: function (pesan, cobaLagi) { kosongkan(wadah).appendChild(kotakGalat(pesan, cobaLagi)); },
      penanda: penanda
    });
  }

  /* ---------- Staff dan PIN ---------- */

  var ROLE = ['Staff', 'Head Kitchen', 'Manager'];

  function tandaKeadaanStaff(s) {
    var tanda = [s.aktif ? tandaStatus('baik', 'Aktif') : tandaStatus('menunggu', 'Nonaktif')];
    if (s.permintaanReset) tanda.push(tandaStatus('tinjau', 'Minta reset PIN'));
    if (!s.punyaPin) tanda.push(tandaStatus('menunggu', 'Belum punya PIN'));
    if (s.terkunci) tanda.push(tandaStatus('masalah', 'Terkunci'));
    return tanda;
  }

  function hrefStaff(nama, pin) {
    return '#/pengaturan/staff/' + encodeURIComponent(nama) + (pin ? '/pin' : '');
  }

  function layarStaff(k) {
    aturJudul('Staff dan PIN');
    var penanda = el('span', { class: 'memperbarui', role: 'status' });
    var wadah = el('div');
    var tambah = tombol('Tambah', 'utama', { onclick: bukaTambahStaff });
    k.wadah.appendChild(el('div', { class: 'layar-isi layar-sempit' }, [
      tautanKembali('Pengaturan', '#/pengaturan'),
      el('div', { class: 'kepala-isi' }, [el('h1', { class: 'judul-layar', text: 'Staff dan PIN' }), tambah]),
      penanda,
      wadah
    ]));

    function gambar(data) {
      kosongkan(wadah);
      var staff = data.staff || [];
      if (!staff.length) {
        wadah.appendChild(kotakKosong('Belum ada staff. Ketuk Tambah untuk menambah staff pertama.', 'staff'));
        return;
      }
      var badan = el('tbody');
      staff.forEach(function (s) {
        var baris = el('tr', { class: 'bisa-diketuk' + (s.aktif ? '' : ' nonaktif') }, [
          el('td', {}, el('button', {
            type: 'button',
            class: 'tabel-tombol',
            text: s.nama,
            onclick: function (e) {
              e.stopPropagation();
              location.hash = hrefStaff(s.nama);
            }
          })),
          el('td', { text: s.role }),
          el('td', {}, el('span', { class: 'tanda-deret' }, tandaKeadaanStaff(s)))
        ]);
        baris.addEventListener('click', function () {
          location.hash = hrefStaff(s.nama);
        });
        badan.appendChild(baris);
      });
      wadah.appendChild(el('div', { class: 'tabel-bingkai' }, el('table', { class: 'tabel' }, [
        el('thead', {}, el('tr', {}, [
          el('th', { scope: 'col', text: 'Nama' }),
          el('th', { scope: 'col', text: 'Role' }),
          el('th', { scope: 'col', text: 'Keadaan' })
        ])),
        badan
      ])));
    }

    function bukaTambahStaff() {
      var draft = Draft.baca('tambah-staff');
      var isiDraft = draft ? draft.data : {};
      var catatan = el('p', { class: 'catatan-draft', 'aria-live': 'polite' });
      var kNama = kolomIsian({ label: 'Nama', maxlength: 40, autocomplete: 'off', nilai: isiDraft.nama || '',
        bantuan: 'Nama ini tampil di layar Login dan di setiap isian.' });
      var gRole = grupPilihan('Role', ROLE, isiDraft.role || 'Staff');
      var kPin = kolomPin('PIN (6 angka)');
      var kUlang = kolomPin('Ulangi PIN');
      var pesan = el('p', { class: 'pesan-formulir', role: 'alert' });
      if (draft) catatan.textContent = 'Draft tersimpan ' + jam(new Date(draft.waktu).toISOString());

      function simpanDraft() {
        var waktu = Draft.simpan('tambah-staff', { nama: kNama.input.value, role: gRole.nilai() });
        if (waktu) catatan.textContent = 'Draft tersimpan ' + jam(new Date(waktu).toISOString());
      }
      kNama.input.addEventListener('input', simpanDraft);
      gRole.input.forEach(function (i) { i.addEventListener('change', simpanDraft); });

      var form = el('form', { class: 'formulir', novalidate: true }, [
        catatan, kNama.wadah, gRole.wadah, kPin.wadah, kUlang.wadah,
        el('p', { class: 'kolom-bantuan', text: 'Sampaikan PIN langsung ke orangnya. PIN tidak bisa dilihat lagi setelah disimpan.' }),
        pesan
      ]);

      function simpan(t, l) {
        tulisPesan(pesan, '');
        var ok = [
          kNama.galat(kNama.input.value.trim() ? '' : 'Isi nama.'),
          periksaPinGanda(kPin, kUlang)
        ];
        if (ok.indexOf(false) >= 0) {
          var salah = form.querySelector('[aria-invalid="true"]');
          if (salah) salah.focus();
          return;
        }
        var nama = kNama.input.value.trim().replace(/\s+/g, ' ');
        aturTombolProses(t, true, 'Menyimpan…');
        l.sibuk(true);
        panggilApi('tambahStaff', { nama: nama, role: gRole.nilai(), pin: kPin.input.value }).then(function (data) {
          Draft.hapus('tambah-staff');
          Cache.tulis('staff', data);
          l.sibuk(false);
          l.tutup();
          gambar(data);
          toast(nama + ' ditambahkan. Sampaikan PIN langsung ke ' + nama + '.');
        }).catch(function (err) {
          l.sibuk(false);
          aturTombolProses(t, false);
          if (tanganiSesiBerakhir(err)) return;
          tulisPesan(pesan, pesanGalat(err), 'masalah');
        });
      }
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        simpan(lembar.tombol[1], lembar);
      });

      var lembar = bukaLembar({
        judul: 'Tambah staff',
        isi: form,
        aksi: [
          { teks: 'Batal', jenis: 'kedua' },
          { teks: 'Simpan staff', jenis: 'utama', klik: simpan }
        ]
      });
    }

    muatData({
      kunciCache: 'staff',
      ambil: function () { return panggilApi('daftarStaff'); },
      gambar: gambar,
      kerangka: function () {
        kosongkan(wadah).appendChild(kerangkaBaris(3));
      },
      galat: function (pesan, cobaLagi) {
        kosongkan(wadah).appendChild(kotakGalat(pesan, cobaLagi));
      },
      penanda: penanda
    });
  }

  /** Head Kitchen atau Manager aktif (punya PIN) yang terakhir: tidak bisa dinonaktifkan (aturan server aksiUbahStaff_). */
  function pengelolaTerakhir(daftar, s) {
    function kelola(x) { return x.aktif && x.pengelola && x.punyaPin; }
    return kelola(s) && !daftar.some(function (x) { return x !== s && kelola(x); });
  }

  /** Satu staff: PIN, role, aktif, hapus. Dari pemberitahuan Beranda, lembar reset PIN langsung terbuka. */
  function layarStaffDetail(k) {
    var nama = '';
    try {
      nama = decodeURIComponent(k.cocok[1]);
    } catch (err) {
      nama = k.cocok[1];
    }
    var bukaPinLangsung = !!k.cocok[2];
    aturJudul(nama);
    var penanda = el('span', { class: 'memperbarui', role: 'status' });
    var wadah = el('div');
    k.wadah.appendChild(el('div', { class: 'layar-isi layar-sempit' }, [
      tautanKembali('Staff dan PIN', '#/pengaturan/staff'),
      el('h1', { class: 'judul-layar', text: nama }),
      penanda,
      wadah
    ]));
    var diriSendiri = sesiKini().pengguna.nama && sesiKini().pengguna.nama.toLowerCase() === nama.toLowerCase();
    var lembarPinSudah = false;
    var staffKini = null;
    var roleDipilih = ''; // pilihan role yang belum disimpan

    function cari(data) {
      var daftar = data.staff || [];
      for (var i = 0; i < daftar.length; i++) {
        if (daftar[i].nama.toLowerCase() === nama.toLowerCase()) return daftar[i];
      }
      return null;
    }

    function gambar(data, dariHp) {
      var s = cari(data);
      kosongkan(wadah);
      if (!s) {
        if (!dariHp) wadah.appendChild(kotakKosong('Staff ' + nama + ' tidak ditemukan. Kembali ke daftar staff.', 'staff'));
        return;
      }
      staffKini = s;

      // Kartu PIN
      var tombolPin = tombol(s.punyaPin ? 'Reset PIN' : 'Buat PIN', 'utama', { onclick: function () { bukaLembarPin(s); } });
      var tandaPin = [s.punyaPin ? tandaStatus('baik', 'PIN sudah dibuat') : tandaStatus('menunggu', 'Belum punya PIN')];
      if (s.permintaanReset) tandaPin.push(tandaStatus('tinjau', 'Meminta reset PIN ' + waktuSingkat(s.permintaanReset)));
      if (s.terkunci) {
        tandaPin.push(tandaStatus('masalah', (s.kunciPanjang ? 'Terkunci 24 jam karena PIN salah berulang kali' : 'Terkunci karena PIN salah 5 kali') +
          (s.terkunciSampai ? ', terbuka sendiri ' + waktuSingkat(s.terkunciSampai) : '')));
      }
      wadah.appendChild(el('section', { class: 'kartu' }, [
        el('h2', { class: 'kartu-judul', text: 'PIN' }),
        el('div', { class: 'deret-tombol', style: 'margin-bottom:16px' }, tandaPin),
        tombolPin
      ]));

      // Kartu role
      var gRole = grupPilihan('Pilih role', ROLE, roleDipilih || s.role);
      var simpanRole = tombol('Simpan role', 'kedua', { disabled: !roleDipilih || roleDipilih === s.role });
      gRole.input.forEach(function (i) {
        i.addEventListener('change', function () {
          roleDipilih = gRole.nilai();
          simpanRole.disabled = roleDipilih === s.role;
        });
      });
      simpanRole.addEventListener('click', function () {
        var role = gRole.nilai();
        aturTombolProses(simpanRole, true, 'Menyimpan…');
        panggilApi('ubahStaff', { nama: s.nama, role: role }).then(function (hasil) {
          roleDipilih = '';
          Cache.tulis('staff', hasil);
          gambar(hasil);
          toast('Role ' + s.nama + ' sekarang ' + role + '.');
        }).catch(function (err) {
          aturTombolProses(simpanRole, false);
          if (tanganiSesiBerakhir(err)) return;
          toast(pesanGalat(err), 'masalah');
        });
      });
      if (diriSendiri) {
        gRole.nonaktif(true);
        simpanRole.hidden = true;
      }
      wadah.appendChild(el('section', { class: 'kartu' }, [
        el('h2', { class: 'kartu-judul', text: 'Role' }),
        diriSendiri ? el('p', { class: 'kartu-teks', text: 'Role akunmu sendiri diubah oleh Head Kitchen atau Manager lain.' }) : null,
        gRole.wadah,
        simpanRole
      ]));

      // Kartu keadaan akun: sakelar Aktif / Nonaktif (tampilan Bagian 5.7). Pengelola aktif
      // terakhir diperiksa lebih dulu daripada akun sendiri, sama dengan urutan di server.
      var sebabKunci = pengelolaTerakhir(data.staff || [], s)
        ? (diriSendiri ? 'Kamu' : s.nama + ' adalah') + ' Head Kitchen atau Manager aktif yang terakhir. ' +
          'Tambah atau aktifkan Head Kitchen atau Manager lain dulu, supaya selalu ada yang bisa mengelola sistem.'
        : (diriSendiri ? 'Keadaan akunmu sendiri diubah oleh Head Kitchen atau Manager lain.' : '');
      var sAktif = sakelarTampil({
        nilai: s.aktif,
        teks: 'Akun ' + s.nama,
        kataYa: 'Aktif',
        kataTidak: 'Nonaktif',
        kelas: sebabKunci ? 'sakelar-terkunci' : '',
        labelSr: 'Akun ' + s.nama + ' aktif',
        ubah: function (b) {
          if (b) aktifkan(sAktif);
          else nonaktifkan(sAktif);
        }
      });
      if (sebabKunci) {
        sAktif.input.disabled = true;
        sAktif.input.setAttribute('aria-describedby', 'sebab-sakelar-aktif');
      }
      wadah.appendChild(el('section', { class: 'kartu' }, [
        el('h2', { class: 'kartu-judul', text: 'Keadaan akun' }),
        sAktif.wadah,
        el('p', { class: 'kartu-teks', text: s.aktif
          ? s.nama + ' bisa masuk dan mengisi form.'
          : s.nama + ' tidak tampil di layar Login. Isian lamanya tetap tersimpan.' }),
        sebabKunci ? el('p', { class: 'kolom-bantuan', id: 'sebab-sakelar-aktif', text: sebabKunci }) : null
      ]));

      if (!diriSendiri) {
        // Hapus (tampilan Bagian 5.7): paling bawah, terpisah, hanya untuk staff nonaktif.
        wadah.appendChild(el('div', { class: 'bagian-hapus' }, s.aktif
          ? el('p', { class: 'kolom-bantuan', text: 'Nonaktifkan dulu untuk bisa menghapus.' })
          : tombol('Hapus', 'bahaya', { onclick: hapusStaff })));
      }

      if (bukaPinLangsung && !lembarPinSudah && !lembarKini) {
        lembarPinSudah = true;
        bukaLembarPin(s);
      }
    }

    /** Sakelar dimatikan: konfirmasi dulu; dibatalkan, sakelar kembali ke Aktif. */
    function nonaktifkan(sakelar) {
      var s = staffKini;
      konfirmasi({
        judul: 'Nonaktifkan ' + s.nama + '?',
        teks: s.nama + ' tidak bisa masuk sampai diaktifkan lagi. Isian lamanya tetap tersimpan.',
        teksYa: 'Nonaktifkan',
        bahaya: true,
        jalankan: function () { return panggilApi('ubahStaff', { nama: s.nama, aktif: false }); }
      }).then(function (hasil) {
        if (!hasil) {
          sakelar.atur(true);
          return;
        }
        Cache.tulis('staff', hasil);
        gambarDenganFokus(hasil);
        toast(s.nama + ' dinonaktifkan.');
      });
    }

    /** Gambar ulang; fokus kembali ke sakelar keadaan akun jika tadi di sana. */
    function gambarDenganFokus(hasil) {
      var tadi = document.activeElement && document.activeElement.classList.contains('sakelar-input');
      gambar(hasil);
      var baru = wadah.querySelector('.sakelar-input');
      if (tadi && baru) baru.focus({ preventScroll: true });
    }

    function hapusStaff() {
      var s = staffKini;
      konfirmasi({
        judul: 'Hapus ' + s.nama + ' dari daftar staff?',
        teks: 'Namanya tetap tampil di riwayat. Tindakan ini tidak bisa dibatalkan dari aplikasi.',
        teksYa: 'Hapus',
        teksProses: 'Menghapus…',
        bahaya: true,
        jalankan: function () { return panggilApi('hapusStaff', { nama: s.nama }); }
      }).then(function (hasil) {
        if (!hasil) return;
        Cache.tulis('staff', hasil);
        hapusPermintaanDiBeranda(s.nama);
        location.hash = '#/pengaturan/staff';
        toast(s.nama + ' dihapus dari daftar staff.');
      });
    }

    /** Sakelar dinyalakan: langsung tersimpan; gagal, sakelar kembali ke Nonaktif. */
    function aktifkan(sakelar) {
      var s = staffKini;
      sakelar.input.disabled = true;
      panggilApi('ubahStaff', { nama: s.nama, aktif: true }).then(function (hasil) {
        Cache.tulis('staff', hasil);
        gambarDenganFokus(hasil);
        toast(s.nama + ' aktif lagi.');
      }).catch(function (err) {
        sakelar.input.disabled = false;
        sakelar.atur(false);
        if (tanganiSesiBerakhir(err)) return;
        toast(pesanGalat(err), 'masalah');
      });
    }

    function bukaLembarPin(s) {
      var kPin = kolomPin('PIN baru (6 angka)');
      var kUlang = kolomPin('Ulangi PIN baru');
      var pesan = el('p', { class: 'pesan-formulir', role: 'alert' });
      var form = el('form', { class: 'formulir', novalidate: true }, [
        s.punyaPin ? el('p', { class: 'pesan-formulir tinjau' }, [ikon('info'),
          el('span', { text: 'Reset PIN ' + s.nama + '? PIN lama langsung tidak berlaku.' })]) : null,
        kPin.wadah,
        kUlang.wadah,
        el('p', { class: 'kolom-bantuan', text: 'Sampaikan PIN baru langsung ke ' + s.nama + '.' }),
        pesan
      ]);
      function simpan(t, l) {
        tulisPesan(pesan, '');
        if (!periksaPinGanda(kPin, kUlang)) {
          var salah = form.querySelector('[aria-invalid="true"]');
          if (salah) salah.focus();
          return;
        }
        aturTombolProses(t, true, 'Menyimpan…');
        l.sibuk(true);
        panggilApi('aturPin', { nama: s.nama, pin: kPin.input.value }).then(function (hasil) {
          if (hasil.sesiBaru) {
            var sesi = Sesi.baca();
            if (sesi) {
              sesi.token = hasil.sesiBaru.token;
              sesi.berlakuSampai = hasil.sesiBaru.berlakuSampai;
              Sesi.tulis(sesi);
            }
          }
          Cache.tulis('staff', { staff: hasil.staff });
          hapusPermintaanDiBeranda(s.nama);
          l.sibuk(false);
          l.tutup();
          gambar({ staff: hasil.staff });
          toast('PIN ' + s.nama + ' sudah ' + (s.punyaPin ? 'direset' : 'dibuat') + '. Sampaikan langsung ke ' + s.nama + '.');
        }).catch(function (err) {
          l.sibuk(false);
          aturTombolProses(t, false);
          if (tanganiSesiBerakhir(err)) return;
          tulisPesan(pesan, pesanGalat(err), 'masalah');
        });
      }
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        simpan(lembar.tombol[1], lembar);
      });
      var lembar = bukaLembar({
        judul: (s.punyaPin ? 'Reset PIN ' : 'Buat PIN ') + s.nama,
        isi: form,
        aksi: [
          { teks: 'Batal', jenis: 'kedua' },
          { teks: s.punyaPin ? 'Reset PIN' : 'Buat PIN', jenis: 'utama', klik: simpan }
        ]
      });
    }

    muatData({
      kunciCache: 'staff',
      ambil: function () { return panggilApi('daftarStaff'); },
      gambar: gambar,
      kerangka: function () {
        kosongkan(wadah).appendChild(kerangkaBaris(3));
      },
      galat: function (pesan, cobaLagi) {
        kosongkan(wadah).appendChild(kotakGalat(pesan, cobaLagi));
      },
      penanda: penanda
    });
  }

  /** Setelah PIN direset, pemberitahuan di Beranda (minta reset dan terkunci) langsung hilang (server juga menandainya selesai). */
  function hapusPermintaanDiBeranda(nama) {
    var beranda = Cache.baca('beranda');
    if (!beranda) return;
    function bukanDia(p) { return p.nama.toLowerCase() !== nama.toLowerCase(); }
    if (beranda.data.permintaanReset) beranda.data.permintaanReset = beranda.data.permintaanReset.filter(bukanDia);
    if (beranda.data.terkunci) beranda.data.terkunci = beranda.data.terkunci.filter(bukanDia);
    Cache.tulis('beranda', beranda.data);
  }

  /* ---------- Penerima email ---------- */

  var POLA_EMAIL = /^[A-Za-z0-9][^\s@,;]*@[^\s@,;]+\.[^\s@,;]+$/;

  function layarPenerima(k) {
    aturJudul('Penerima email');
    var penanda = el('span', { class: 'memperbarui', role: 'status' });
    var wadahDaftar = el('div');
    var daftarKini = null;

    var draft = Draft.baca('penerima-baru');
    var kEmail = kolomIsian({
      label: 'Alamat email',
      type: 'email',
      inputmode: 'email',
      autocomplete: 'email',
      maxlength: 254,
      nilai: draft ? draft.data : '',
      atribut: { autocapitalize: 'none', spellcheck: 'false' }
    });
    kEmail.input.addEventListener('input', function () {
      if (kEmail.input.value.trim()) Draft.simpan('penerima-baru', kEmail.input.value);
      else Draft.hapus('penerima-baru');
    });
    var tambah = tombol('Tambah', 'utama', { type: 'submit' });
    var form = el('form', { class: 'form-tambah-email', novalidate: true }, [kEmail.wadah, tambah]);

    k.wadah.appendChild(el('div', { class: 'layar-isi layar-sempit' }, [
      tautanKembali('Pengaturan', '#/pengaturan'),
      el('h1', { class: 'judul-layar', text: 'Penerima email' }),
      el('p', { class: 'kartu-teks', text: 'Laporan harian dikirim ke alamat di bawah setelah closing.' }),
      el('section', { class: 'bagian' }, [penanda, wadahDaftar]),
      el('section', { class: 'bagian kartu' }, [el('h2', { class: 'kartu-judul', text: 'Tambah penerima' }), form])
    ]));

    function gambar(data) {
      daftarKini = data.email || [];
      kosongkan(wadahDaftar);
      if (!daftarKini.length) {
        wadahDaftar.appendChild(kotakKosong('Belum ada penerima. Tambahkan alamat email untuk menerima laporan harian.', 'email'));
        return;
      }
      var daftar = el('ul', { class: 'daftar', 'aria-label': 'Penerima laporan' });
      daftarKini.forEach(function (alamat) {
        daftar.appendChild(el('li', { class: 'baris-tetap' }, [
          el('span', { class: 'baris-tetap-teks', text: alamat }),
          tombol('Hapus', 'bahaya', { 'aria-label': 'Hapus ' + alamat, onclick: function () { hapus(alamat); } })
        ]));
      });
      wadahDaftar.appendChild(daftar);
    }

    function hapus(alamat) {
      konfirmasi({
        judul: 'Hapus penerima?',
        teks: 'Hapus ' + alamat + ' dari penerima laporan harian?',
        teksYa: 'Hapus',
        bahaya: true,
        jalankan: function () {
          return panggilApi('simpanPenerima', {
            email: daftarKini.filter(function (e) { return e !== alamat; })
          });
        }
      }).then(function (hasil) {
        if (!hasil) return;
        Cache.tulis('penerima', hasil);
        gambar(hasil);
        toast(alamat + ' dihapus dari penerima.');
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (tambah.disabled) return;
      var alamat = kEmail.input.value.trim();
      if (!kEmail.galat(!alamat ? 'Isi alamat email.' : (!POLA_EMAIL.test(alamat) || alamat.length > 254
        ? 'Alamat email tidak sah. Periksa penulisannya.' : ''))) {
        kEmail.input.focus();
        return;
      }
      var sekarang = daftarKini || [];
      if (sekarang.some(function (x) { return x.toLowerCase() === alamat.toLowerCase(); })) {
        kEmail.galat('Alamat ini sudah ada di daftar.');
        return;
      }
      aturTombolProses(tambah, true, 'Menyimpan…');
      panggilApi('simpanPenerima', { email: sekarang.concat([alamat]) }).then(function (hasil) {
        Draft.hapus('penerima-baru');
        Cache.tulis('penerima', hasil);
        kEmail.input.value = '';
        aturTombolProses(tambah, false);
        gambar(hasil);
        toast(alamat + ' ditambahkan ke penerima.');
      }).catch(function (err) {
        aturTombolProses(tambah, false);
        if (tanganiSesiBerakhir(err)) return;
        kEmail.galat(pesanGalat(err));
      });
    });

    muatData({
      kunciCache: 'penerima',
      ambil: function () { return panggilApi('bacaPenerima'); },
      gambar: gambar,
      kerangka: function () {
        kosongkan(wadahDaftar).appendChild(kerangkaBaris(2));
      },
      galat: function (pesan, cobaLagi) {
        kosongkan(wadahDaftar).appendChild(kotakGalat(pesan, cobaLagi));
      },
      penanda: penanda
    });
  }

  /* =======================================================================
   * Service worker: halaman bisa dibuka tanpa sinyal
   * ===================================================================== */

  function daftarkanServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    var lokal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (location.protocol !== 'https:' && !lokal) return;
    var adaPengendali = !!navigator.serviceWorker.controller;
    var sudahMuatUlang = false;
    // Versi baru aktif: muat ulang hanya jika tidak ada yang sedang diisi.
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!adaPengendali) {
        adaPengendali = true;
        return;
      }
      if (sudahMuatUlang || lembarKini || apakahIsianTeks(document.activeElement)) return;
      if (!$('#masuk').hidden && $('#masuk').classList.contains('terang')) return;
      sudahMuatUlang = true;
      location.reload();
    });
    navigator.serviceWorker.register('./sw.js').catch(function (err) {
      console.warn('Service worker tidak terpasang:', err);
    });
  }

  /* =======================================================================
   * Mulai
   * ===================================================================== */

  function mulai() {
    pitaSinyal = $('#pita-sinyal');
    pasangPapanKetik();
    pasangUngkap();
    pasangHitungNaik();
    window.addEventListener('online', function () {
      aturSinyal();
      // Antrean dikirim saat sinyal kembali; layar diperbarui sesudahnya.
      kirimAntrean().then(function (n) {
        if (!n && segarkanLayar) segarkanLayar();
      });
    });
    // Sinyal lemah tidak selalu memicu "online": coba lagi tiap menit selama aplikasi terbuka.
    setInterval(function () {
      if (document.visibilityState === 'visible' && !$('#aplikasi').hidden) kirimAntrean();
    }, 60000);
    window.addEventListener('offline', aturSinyal);
    window.addEventListener('hashchange', function () {
      if (!$('#aplikasi').hidden) jalankanRute();
    });
    window.addEventListener('resize', function () {
      letakkanPenanda(true);
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible' || $('#aplikasi').hidden) return;
      // Dibuka lagi dari latar belakang atau layar HP dinyalakan lagi: periksa keluar otomatis dulu.
      if (periksaDiam()) return;
      if (!Sesi.baca()) {
        keluarLokal(PESAN.sesiBerakhir);
        return;
      }
      kirimAntrean().then(function (n) {
        if (!n && segarkanLayar) segarkanLayar();
      });
    });
    $('#bar-pengguna').addEventListener('click', bukaMenuPengguna);
    pasangKeluarOtomatis();

    if (Sesi.baca() && sudahDiam()) {
      // Aplikasi dibuka lagi setelah lama tidak dipakai.
      keluarOtomatis();
    } else if (Sesi.baca()) {
      tampilMode('aplikasi');
      gambarMenu();
      if (!location.hash) gantiAlamat('#/');
      jalankanRute();
      kirimAntrean();
    } else {
      // Sesi yang sudah habis 12 jam: kembali ke Login dengan pesannya.
      var lama = Simpan.baca(AWALAN + 'sesi');
      if (lama) Sesi.hapus();
      mulaiMasuk(lama ? PESAN.sesiBerakhir : '');
    }
    aturSinyal();
    daftarkanServiceWorker();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mulai);
  } else {
    mulai();
  }
})();
