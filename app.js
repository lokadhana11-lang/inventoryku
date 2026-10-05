/* InventoryKu — frontend (Tahap 1: kerangka PWA dan akses; Tahap 2: form Stock;
   Tahap 3: Riwayat, pemeriksaan, dan koreksi; Tahap 4: laporan PDF;
   5 Oktober 2026: tombol Keluar, keluar otomatis, hapus staff, PDF stock per kategori;
   Tahap 5: form Waste dan Suhu; Tahap 6: Prep List, resep, masa simpan;
   Tahap 7: Dashboard dan Pengaturan → Item, Unit, Kategori dan satuan, Outlet dan jadwal).
   Tanpa framework, tanpa langkah build. Semua teks antarmuka mengikuti
   spesifikasi tampilan Bagian 7. */
(function () {
  'use strict';

  /** Versi aplikasi. SETIAP RILIS naikkan ini DAN VERSI di sw.js (nilainya sama). */
  var VERSI_APLIKASI = '0.8.0';

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

  function alamatApi() {
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

  /**
   * Memanggil satu aksi API. Body berupa JSON.stringify dengan satu-satunya
   * header Content-Type: text/plain;charset=utf-8, supaya browser tidak
   * mengirim preflight CORS (Apps Script tidak melayaninya). Token sesi ikut
   * di dalam body.
   * Berhasil: mengembalikan isi field "data". Gagal: melempar Error berisi
   * pesan berbahasa Indonesia yang siap ditampilkan; err.sesiBerakhir = true
   * jika server menolak token.
   */
  function panggilApi(aksi, isi) {
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
    }, BATAS_WAKTU_MS);

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
    kotak: '<path d="M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4z"/><path d="M3.5 7.5 12 11.5l8.5-4M12 11.5v9"/>',
    label: '<path d="M3.5 12.5v-8h8l9 9-8 8z"/><circle cx="8" cy="9" r="1.5"/>'
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

  /** PIN 6 angka dan ulangannya sama. */
  function periksaPinGanda(kPin, kUlang) {
    var pin = kPin.input.value;
    if (!/^\d{6}$/.test(pin)) {
      kPin.galat(PESAN.pinHarus6);
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
    grup.appendChild(el('span', { class: 'menu-penanda', 'aria-hidden': 'true' }));
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

  /** Garis amber digeser dengan transform (bukan left/width) supaya ringan. */
  function letakkanPenanda(tanpaGerak) {
    var grup = $('#menu-grup');
    var penanda = grup && grup.querySelector('.menu-penanda');
    if (!penanda) return;
    var aktif = grup.querySelector('[aria-current="page"]');
    penanda.classList.toggle('tanpa-gerak', !!tanpaGerak);
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
    { pola: /^\/riwayat(?:\?(.*))?$/, menu: 'riwayat', layar: layarRiwayat },
    { pola: /^\/riwayat\/([A-Z0-9_]+)\/([A-Za-z0-9-]+)$/, menu: 'riwayat', layar: layarRiwayatDetail },
    { pola: /^\/laporan$/, menu: 'laporan', layar: layarLaporan },
    { pola: /^\/dashboard$/, menu: 'dashboard', pengelola: true, layar: layarDashboard },
    { pola: /^\/pengaturan$/, menu: 'pengaturan', pengelola: true, layar: layarPengaturan },
    { pola: /^\/pengaturan\/staff$/, menu: 'pengaturan', pengelola: true, layar: layarStaff },
    { pola: /^\/pengaturan\/staff\/([^/]+)(\/pin)?$/, menu: 'pengaturan', pengelola: true, layar: layarStaffDetail },
    { pola: /^\/pengaturan\/penerima$/, menu: 'pengaturan', pengelola: true, layar: layarPenerima },
    { pola: /^\/pengaturan\/outlet$/, menu: 'pengaturan', pengelola: true, layar: layarOutletJadwal },
    { pola: /^\/pengaturan\/item$/, menu: 'pengaturan', pengelola: true, layar: layarItem },
    { pola: /^\/pengaturan\/item-baru$/, menu: 'pengaturan', pengelola: true, layar: layarItemUbah },
    { pola: /^\/pengaturan\/item\/([^/]+)$/, menu: 'pengaturan', pengelola: true, layar: layarItemUbah },
    { pola: /^\/pengaturan\/unit$/, menu: 'pengaturan', pengelola: true, layar: layarUnit },
    { pola: /^\/pengaturan\/kategori$/, menu: 'pengaturan', pengelola: true, layar: layarKategoriSatuan },
    { pola: /^\/pengaturan\/resep$/, menu: 'pengaturan', pengelola: true, layar: layarResep },
    { pola: /^\/pengaturan\/resep-baru$/, menu: 'pengaturan', pengelola: true, layar: layarResepUbah },
    { pola: /^\/pengaturan\/resep\/([^/]+)$/, menu: 'pengaturan', pengelola: true, layar: layarResepUbah }
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
    nomorLayar++;
    bersihkanLayar();
    var main = $('#layar');
    kosongkanLayar();
    main.classList.remove('layar-masuk');
    void main.offsetWidth; // mulai ulang gerak ganti layar
    main.classList.add('layar-masuk');
    $('#aplikasi').classList.toggle('di-beranda', rute.menu === 'beranda' && jalur === '/');
    aturMenuAktif(rute.menu);
    rute.layar({ wadah: main, cocok: cocok, sesi: sesi });
    tempatkanPita();
    aturSinyal();
    window.scrollTo(0, 0);
  }

  /** Pita sinyal di bawah kepala layar. Di Beranda: di atas kepala navy, supaya tiket tetap tergantung di rel. */
  function tempatkanPita() {
    var kepalaBeranda = $('#layar .beranda-kepala');
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

  /** Sesi baru dari login, pemasangan pertama, atau pemulihan akses. */
  function simpanSesiBaru(data) {
    Sesi.tulis({
      token: data.token,
      berlakuSampai: data.berlakuSampai,
      pengguna: data.pengguna,
      namaOutlet: data.namaOutlet
    });
    simpanMenitKeluarOtomatis(data.keluarOtomatisMenit);
    catatDipakai(true);
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

  /* ---------- Menu nama pengguna: satu pilihan, "Keluar" ----------
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
    var item = el('button', { type: 'button', class: 'menu-pengguna-item', role: 'menuitem' }, [
      ikon('keluar'),
      el('span', { text: 'Keluar' })
    ]);
    var menu = el('div', { class: 'menu-pengguna', role: 'menu', 'aria-label': 'Menu ' + sesi.pengguna.nama }, item);
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
        }
      }
    };
    menuPenggunaKini = m;
    asal.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', m.diLuar, true);
    document.addEventListener('keydown', m.tombolKeyboard, true);
    window.addEventListener('resize', m.tutup);
    window.addEventListener('scroll', m.tutup, true);
    item.focus({ preventScroll: true });
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

  function merekLogin(namaOutlet) {
    var outlet = el('p', { class: 'login-outlet', text: namaOutlet || '' });
    var t = document.createElement('template');
    t.innerHTML = '<svg class="ikon-buku" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path class="ikon-buku-sampul" d="M5 6a1.5 1.5 0 0 1 1.5-1.5H19v12H6.5A1.5 1.5 0 0 0 5 18z"/>' +
      '<path class="ikon-buku-sampul" d="M5 18a1.5 1.5 0 0 0 1.5 1.5H19v-3"/>' +
      '<path class="ikon-buku-pembatas" d="M11 4.5h3v5.25l-1.5-1.1-1.5 1.1z"/></svg>';
    return {
      wadah: el('div', { class: 'login-merek' }, [
        t.content.firstChild,
        el('h1', { class: 'login-nama-aplikasi', text: 'InventoryKu' }),
        outlet
      ]),
      outlet: outlet
    };
  }

  /**
   * Layar Login: pilih nama (tombol besar), lalu PIN di papan angka.
   * Setelah angka keenam, login langsung diproses. keterangan: satu baris di
   * atas pilihan nama setelah keluar otomatis; hilang setelah nama dipilih.
   */
  function gambarLogin(info, pesanAwal, memuat, keterangan) {
    var wadah = $('#masuk');
    wadah.className = 'masuk';
    kosongkan(wadah);
    aturJudulDokumen('Masuk');

    var keadaan = { info: info, nama: '', pin: '', sibuk: false, keterangan: keterangan || '' };
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
    var kotakLogin = el('div', { class: 'login' }, [kiri, kanan, bawah]);
    wadah.appendChild(kotakLogin);

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

    /** "Keluar otomatis karena 5 menit tidak dipakai. …" di atas pilihan nama. */
    function tambahKeterangan() {
      if (!keadaan.keterangan) return;
      kanan.appendChild(el('p', { class: 'pesan-login keterangan-login', role: 'status' }, [
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
        el('p', { class: 'login-label', text: 'Pilih nama' }),
        penanda
      ]));
      if (!keadaan.info) {
        var kerangka = el('div', { class: 'nama-grid', 'aria-hidden': 'true' });
        for (var i = 0; i < 4; i++) kerangka.appendChild(el('span', { class: 'kerangka', style: 'height:56px' }));
        kanan.appendChild(kerangka);
        return;
      }
      var grid = el('div', { class: 'nama-grid' });
      namaBisaMasuk().forEach(function (s) {
        var tunggu = Antrean.jumlah(s.nama);
        grid.appendChild(el('button', {
          type: 'button',
          class: 'tombol-nama',
          'aria-label': s.nama + (tunggu ? ', ' + tunggu + ' isian menunggu kirim' : ''),
          onclick: function () {
            if (keadaan.sibuk) return;
            tulisPesanLogin('');
            keadaan.keterangan = '';
            tampilPin(s.nama);
          }
        }, [
          el('span', { text: s.nama }),
          // Isian di antrean menunggu sampai pengisinya masuk lagi (Bagian 7.2).
          tunggu ? el('span', { class: 'tombol-nama-ket', text: tunggu + ' isian menunggu kirim' }) : null
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
      kiri.appendChild(el('div', { class: 'login-siapa' }, [
        el('div', {}, [
          el('p', { class: 'login-label', text: 'Masuk sebagai' }),
          el('p', { class: 'login-siapa-nama', text: nama })
        ]),
        el('button', {
          type: 'button',
          class: 'login-tautan',
          text: 'Ganti nama',
          onclick: function () {
            if (keadaan.sibuk) return;
            tulisPesanLogin('');
            tampilNama();
          }
        })
      ]));
      titikGrup = el('div', { class: 'titik-grup', role: 'img', 'aria-label': 'PIN: 0 dari 6 angka' });
      for (var i = 0; i < PANJANG_PIN; i++) titikGrup.appendChild(el('span', { class: 'titik' }));
      kiri.appendChild(titikGrup);
      kiri.appendChild(pesan);

      kosongkan(kanan);
      tombolAngka = [];
      var papan = el('div', { class: 'papan', role: 'group', 'aria-label': 'Papan angka PIN' });
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'hapus'].forEach(function (k) {
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
        papan.appendChild(t);
      });
      kanan.appendChild(papan);
      kanan.appendChild(el('div', {}, el('button', {
        type: 'button',
        class: 'login-tautan',
        text: 'Lupa PIN?',
        onclick: mintaResetPin
      })));
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
      panggilApi('login', { nama: keadaan.nama, pin: keadaan.pin }).then(function (data) {
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
          tampilNama();
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
        kanan.appendChild(el('div', { class: 'deret-tombol' }, el('p', { class: 'login-label', text: 'Pilih nama' })));
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

    tampilNama();
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
        zonaWaktu: zona
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
        pin: kPin.input.value
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

    var kepala = el('section', { class: 'beranda-kepala', 'aria-label': 'Hari ini' }, el('div', { class: 'beranda-kepala-isi' }, [
      el('p', { class: 'beranda-tanggal', text: tanggalPanjang(new Date()) }),
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
      gambarPemberitahuan(data.permintaanReset || [], data.pemeriksaan || null, data.peringatanSistem || [], data.masaSimpan || null);
      dataTerakhir = data;
    }
    var dataTerakhir = null;

    function gambarTiket(form) {
      kosongkan(grid);
      if (!form.length) {
        grid.appendChild(kotakKosong('Belum ada form yang tampil. Pengelola mengatur form di Pengaturan.'));
        return;
      }
      var gerak = pembuka && !tiketSudahTampil;
      form.forEach(function (f, i) {
        var st = STATUS_TIKET[f.status] || STATUS_TIKET.belum;
        var tanda = tandaStatus(st.jenis, st.kata || f.detail || 'Belum diisi');
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
        var tiket = el('button', {
          type: 'button',
          class: 'tiket' + (gerak && i < 8 ? ' gerak' : ''),
          'data-form': f.id,
          style: gerak && i < 8 ? '--urut:' + i : null,
          onclick: function () {
            if (LAYAR_FORM[f.id]) location.hash = LAYAR_FORM[f.id];
            else toast(PESAN.formBelumDibangun, 'info');
          }
        }, [
          el('span', { class: 'tiket-nama', text: f.nama }),
          tanda,
          ket.length ? el('span', { class: 'tiket-ket', text: ket.join(' · ') }) : null
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
        kemajuanTeks.appendChild(el('span', { text: lengkap + ' dari ' + wajib.length + ' form terisi' }));
      }
      // Momen selesai: tulisan berganti dengan memudar, sekali.
      if (selesai && selesaiSebelum === false) {
        kemajuanTeks.classList.remove('ganti');
        void kemajuanTeks.offsetWidth;
        kemajuanTeks.classList.add('ganti');
      }
      selesaiSebelum = selesai;
    }

    /**
     * Pengelola: "NAMA meminta reset PIN" (paling atas; ketuk untuk membuka
     * layar reset PIN staff itu), lalu jumlah isian belum diperiksa dan baris
     * dilaporkan keliru (ketuk untuk membuka Riwayat dengan filter itu).
     */
    function gambarPemberitahuan(permintaan, pemeriksaan, peringatan, masaSimpan) {
      kosongkan(bawah);
      // Lewat masa simpan dan Habis besok: untuk semua role (Tahap 6).
      var simpan = barisMasaSimpan(masaSimpan);
      if (simpan) bawah.appendChild(simpan);
      var baris = barisAntrean();
      if (baris) bawah.appendChild(baris);
      if (!sesiKini().pengguna.pengelola) return;
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
      if (!permintaan.length) return;
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
      bawah.insertBefore(daftar, bawah.firstChild);
    }

    function muat() {
      return muatData({
        kunciCache: 'beranda',
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
    return daftar.reduce(function (janji, e) {
      return janji.then(function () {
        if (berhenti) return null;
        return panggilApi(e.aksi, e.isi).then(function () {
          Antrean.hapus(nama, e.id);
          terkirim++;
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
        toast(terkirim + ' isian terkirim.');
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
      var waktu = Draft.simpan('stock', { tanggal: tanggal, kategori: draft.kategori, isian: draft.isian, sid: draft.sid });
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
      draft.isian[kat][nama] = draft.isian[kat][nama] || { masuk: '', keluar: '', besar: false };
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
      var besar = isian.besar && it.satuanBesar;
      var masukDasar = masuk > 0 ? (besar ? masuk * it.isiSatuanBesar : masuk) : 0;
      return {
        masukSalah: masuk !== null && isNaN(masuk),
        keluarSalah: keluar !== null && isNaN(keluar),
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

      function perbarui() {
        var h = hitung(it, isian);
        inMasuk.setAttribute('aria-invalid', h.masukSalah ? 'true' : 'false');
        inKeluar.setAttribute('aria-invalid', h.keluarSalah ? 'true' : 'false');
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
        label[1].setAttribute('for', inKeluar.id);
        inMasuk.removeAttribute('aria-label');
        inKeluar.removeAttribute('aria-label');
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
          el('thead', {}, el('tr', {}, ['No', 'Nama Item', 'Stock Awal', 'Tercatat Hari Ini', 'Tambah Masuk', 'Tambah Keluar', 'Stock Akhir', 'Satuan']
            .map(function (j, i) { return el('th', { scope: 'col', class: [0, 2, 6].indexOf(i) >= 0 ? 'angka' : null, text: j }); }))),
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
      gambarStatus();
      gambarItem();
    }

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
        if (h.masukSalah || h.keluarSalah) {
          if (!salah) salah = { it: it, jenis: h.masukSalah ? 'masuk' : 'keluar' };
          return;
        }
        var masuk = bacaAngka(isian.masuk) || 0;
        var keluar = bacaAngka(isian.keluar) || 0;
        if (!masuk && !keluar) return; // item yang kedua kolomnya kosong tidak ikut terkirim
        baris.push({ item: it.nama, masuk: masuk, keluar: keluar, satuanMasuk: isian.besar && it.satuanBesar ? 'besar' : 'dasar' });
      });
      if (salah) {
        tulisPesan(pesan, 'Periksa angka ' + (salah.jenis === 'masuk' ? 'Tambah masuk' : 'Tambah keluar') + ' ' +
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

  function layarWaste(k) {
    aturJudul('Waste');
    var pengelola = !!k.sesi.pengguna.pengelola;
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
      simpanDraft();
      gambarBaris();
      toast(b.item + ' dihapus dari isian.');
    }

    function bukaBaris(id) {
      draft.terbuka = id;
      simpanDraft();
      gambarBaris();
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
      return { it: it, gKat: gKat, inQty: inQty, idQty: idQty, galatQty: galatQty, kAlasan: kAlasan, estimasi: estimasi, hapus: hapus };
    }

    /** Ringkasan satu baris (HP dan tablet): item yang sudah diisi diringkas; ketuk untuk membuka. */
    function barisRingkas(b) {
      var it = infoItem(b.item);
      var h = periksa(b);
      var bagian = [b.kategori || 'Kategori belum dipilih'];
      if (h.qty > 0) bagian.push(formatAngka(h.qty) + (it.satuan ? ' ' + it.satuan : ''));
      if (h.qty > 0 && it.harga != null) bagian.push(formatRupiah(h.qty * it.harga));
      return el('div', { class: 'kartu-item waste-ringkas' }, [
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
    }

    function kartuTerbuka(b, nomor) {
      var x = isianBaris(b, nomor);
      return el('article', { class: 'kartu-item', 'aria-label': b.item }, [
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
        el('div', { class: 'stock-akhir' }, [el('span', { class: 'otomatis', text: 'Estimasi kerugian' }), x.estimasi]),
        draft.baris.length > 1 ? tombol('Selesai', 'tautan', { onclick: function () { bukaBaris(''); } }) : null
      ]);
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
        el('td', { class: 'angka otomatis' }, x.estimasi),
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
          el('thead', {}, el('tr', {}, ['No', 'Item / Produk', 'Kategori waste', 'Qty', 'Alasan / keterangan', 'Estimasi kerugian', '']
            .map(function (j, i) { return el('th', { scope: 'col', class: i === 0 || i === 5 ? 'angka' : null, text: j }); }))),
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
              el('span', { class: 'daftar-baris-ket', text: [it.kategori, it.satuan, it.harga != null ? formatRupiah(it.harga) + ' per ' + it.satuan : 'tanpa harga']
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
            '. Estimasi kerugian ' + formatRupiah(kr.totalRp) + '.' })]));
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
        return { item: b.item, kategori: b.kategori, qty: bacaAngka(b.qty), alasan: String(b.alasan || '').trim() };
      });
      var isi = { submissionId: draft.sid, tanggal: tanggal, shift: draft.shift, waktuPerangkat: new Date().toISOString(), baris: baris };
      var entri = { id: isi.submissionId, aksi: 'kirimWaste', isi: isi, formId: 'WASTE',
        judul: 'Waste · ' + baris.length + ' item', tanggal: tanggal };
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
      aturTombolProses(tombolKirim, true, 'Mengirim…');
      jagaProses(panggilApi('kirimWaste', isi)).then(function (hasil) {
        aturTombolProses(tombolKirim, false);
        kosongkanIsian();
        Cache.tulis('waste', hasil.form);
        if (hasil.form.tanggal === tanggal) gambar(hasil.form);
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

    /** Hasil pemeriksaan satu baris: { resep, jumlah, qty, salah: 'jumlah' | 'qty' | '' }. */
    function periksa(b) {
      var r = resepUntuk(b.item);
      if (r) {
        var j = bacaAngka(b.jumlah);
        return { resep: r, jumlah: j, salah: j === null || isNaN(j) || !(j > 0) ? 'jumlah' : '' };
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
          if (h.salah) {
            x.hasil.textContent = 'Hasil per 1 resep ' + formatAngka(r.hasil) + ' ' + it.satuan + '. Pilih jumlah resep.';
            return;
          }
          x.hasil.appendChild(document.createTextNode('Hasil '));
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
        x.hasil, x.baik || null, x.bahan || null, x.peringatan || null,
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
      return el('tr', {}, [
        el('td', { class: 'angka', text: String(nomor) }),
        el('td', { class: 'nama-item' }, el('span', { class: 'daftar-baris-judul', text: b.item })),
        el('td', { class: 'sel-jumlah-prep' }, x.isian),
        el('td', { class: 'otomatis sel-hasil-prep' }, [x.hasil, x.bahan || null, x.peringatan || null]),
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
          el('thead', {}, el('tr', {}, ['No', 'Item / Menu Prep', 'Jumlah resep atau Qty', 'Hasil dan bahan', 'Baik sampai', 'Keterangan', '']
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
      var b = { id: buatId(), item: nama, jumlah: '', ketik: false, qty: '', keterangan: '' };
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
            ? formatAngka(b.jumlahResep) + ' resep (' + formatAngka(b.hasil) + ' ' + b.satuan + ')'
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
          : 'Isi Qty ' + salah.b.item + ' lebih dari 0, misalnya 2,5.', 'masalah');
        var kolom = wadahBaris.querySelector('[data-kunci="' + salah.b.id + '|' + salah.jenis + '"]');
        if (kolom) kolom.focus();
        return;
      }
      if (!draft.sid) draft.sid = buatId();
      var baris = draft.baris.map(function (b) {
        var h = periksa(b);
        return h.resep
          ? { item: b.item, jumlahResep: h.jumlah, qty: '', keterangan: String(b.keterangan || '').trim() }
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
        kol.jenis === 'angka' ? formatAngka(lama || 0) + (satuan ? ' ' + satuan : '')
          : (kol.jenis === 'rupiah' ? formatRupiah(lama) : (kor.lama || '–'))
      ]));
      isi.push(' ');
    }
    if (kol.jikaAda && v == null && !kor) isi.push(el('span', { class: 'otomatis', text: '–' }));
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
      if (k.jenis === 'angka' && !v && !kor && (!k.akhiran || k.jikaAda)) return;
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
      var kepala = (data.kepala || []).map(function (kp) { return kr.kepala[kp.kunci]; }).filter(Boolean).join(', ');
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
        ket = p.jumlahItem + ' item dihitung, ' + p.berselisih + ' berselisih. ' + ket;
      }
      var isiBaris = [
        el('span', { class: 'ikon-peristiwa' }, ikon(namaIkon)),
        el('span', { class: 'daftar-baris-isi' }, [el('span', {}, judul), el('span', { class: 'daftar-baris-ket', text: ket })])
      ];
      if (klik) {
        isiBaris.push(ikon('kanan'));
        return el('button', { type: 'button', class: 'daftar-baris peristiwa', onclick: klik, 'aria-label': 'Riwayat ' + p.item }, isiBaris);
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
    var kepala = (info.kepala || []).map(function (kp) { return kr.kepala[kp.kunci]; }).filter(Boolean).join(', ');
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
      if (nama && nama.jenis === 'item' && v) return tombolNamaItem(v);
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
            return k !== nama && !(k.jikaAda && b.nilai[k.kunci] == null && !(b.koreksi && b.koreksi[k.kunci]));
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
    var kolom = (info.kolom || []).filter(function (k) { return k.koreksi && !(k.jikaAda && b.nilai[k.kunci] == null); });
    var nama = kolomNama(info.kolom || []);
    var namaBaris = nama ? b.nilai[nama.kunci] : '';
    var kolomIsi = kolom.map(function (k) {
      if (k.pilihan) {
        // Pilihan tetap (kategori waste): tombol berjajar, bukan ketikan bebas.
        var g = grupPilihan(k.label, k.pilihan, b.nilai[k.kunci] || '');
        return { k: k, pilihan: g, kolom: { wadah: g.wadah } };
      }
      var kI = kolomIsian({
        label: k.label + (k.satuan && b.satuan ? ' (' + b.satuan + ')' : (k.akhiran ? ' (' + k.akhiran + ')' : '')),
        inputmode: k.jenis === 'angka' ? 'decimal' : null,
        kelas: k.jenis === 'angka' ? 'isian-angka' : null,
        nilai: k.jenis === 'angka' ? String(b.nilai[k.kunci] || 0).replace('.', ',') : (b.nilai[k.kunci] || ''),
        bantuan: b.asli && b.asli[k.kunci] ? 'Diketik ' + b.asli[k.kunci] + '. Koreksi ditulis dalam ' + b.satuan + '.' : (k.bantuan || null)
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
          ok = x.pilihan.galat(p ? '' : 'Pilih ' + x.k.label.toLowerCase() + '.') && ok;
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
        } else if (x.k.jenis === 'angka') {
          var n = bacaAngka(v);
          if (n !== null && isNaN(n)) {
            ok = x.kolom.galat('Isi angka 0 atau lebih, misalnya 2,5.') && ok;
            return;
          }
          x.kolom.galat('');
          nilai[x.k.kunci] = n === null ? 0 : n;
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
   * Riwayat per item (tampilan Bagian 5.4): 7 rekap terakhir dalam lembar.
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
      var badan = el('tbody');
      d.rekap.slice().reverse().forEach(function (r) {
        function sel(n) {
          return el('td', { class: 'angka' }, n ? angkaSatuan(n) : el('span', { class: 'otomatis', text: '–' }));
        }
        badan.appendChild(el('tr', { class: r.akhir < 0 ? 'minus' : null }, [
          el('th', { scope: 'row', text: tanggalPendek(r.tanggal) }),
          sel(r.awal),
          el('td', { class: 'angka' }, [r.masuk ? angkaSatuan(r.masuk) : el('span', { class: 'otomatis', text: '–' }),
            r.masukAsli ? el('span', { class: 'nilai-asli blok', text: '(' + r.masukAsli + ')' }) : null]),
          sel(r.hasilPrep), sel(r.keluar), sel(r.dipakaiPrep), sel(r.waste), sel(r.penyesuaian),
          el('td', { class: 'angka stock-akhir-sel' + (r.akhir < 0 ? ' minus' : '') }, [angkaSatuan(r.akhir),
            r.akhir < 0 ? el('span', { class: 'blok' }, tandaStatus('masalah', 'Minus')) : null])
        ]));
      });
      wadah.appendChild(el('div', { class: 'tabel-bingkai' }, el('table', { class: 'tabel tabel-riwayat-item' }, [
        el('caption', { class: 'sr', text: '7 rekap terakhir ' + it.nama + ', dalam ' + it.satuan }),
        el('thead', {}, el('tr', {}, ['Tanggal', 'Awal', 'Masuk', 'Hasil Prep', 'Keluar', 'Dipakai Prep', 'Waste', 'Penyesuaian', 'Akhir']
          .map(function (j, i) { return el('th', { scope: 'col', class: i ? 'angka' : null, text: j }); }))),
        badan
      ])));
      wadah.appendChild(el('p', { class: 'kolom-bantuan', text: 'Angka dalam ' + it.satuan + '. Hari tanpa gerakan tidak punya rekap.' }));
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
   * permintaan, jenis, label }. Server menjawab { namaFile, mime, data (base64) }.
   * Android, laptop, desktop: file langsung tersimpan, lalu "PDF diunduh.".
   * iPhone dan iPad: dua langkah. PDF diambil dulu, tombol berganti menjadi
   * "Simpan PDF"; ketukan berikutnya langsung membuka lembar bagikan tanpa
   * menunggu apa pun. Tanpa dukungan berbagi file: pesan cadangan, tanpa
   * tombol "Simpan PDF". Hasil: { tombol, pesan, reset() }.
   */
  function unduhPdf(opsi) {
    var ios = apakahIos();
    var t = tombol('Unduh PDF', opsi.jenis || 'utama', opsi.label ? { 'aria-label': opsi.label } : null);
    var pesan = el('p', { class: 'pesan-formulir', role: 'status', 'aria-live': 'polite' });
    var file = null;

    function reset() {
      file = null;
      aturTombolProses(t, false);
      gantiTeksTombol(t, 'Unduh PDF');
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
      ])
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
          tulisPesan(pesanDrive, 'Tersimpan di Drive: ' + h.lokasi + '/' + h.namaFile, 'baik');
          toast('PDF tersimpan di Drive.');
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
    Object.keys(atribut || {}).forEach(function (k) { e.setAttribute(k, String(atribut[k])); });
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
      kartu.appendChild(el('p', { class: 'grafik-ringkas', text: 'Belum ada waste dalam 7 hari terakhir.' }));
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

    function gambarBatang(pilih) {
      while (gambarSvg.firstChild) gambarSvg.removeChild(gambarSvg.firstChild);
      hari.forEach(function (x, i) {
        if (i === pilih) {
          gambarSvg.appendChild(svgEl('rect', { class: 'kolom-pilih', x: i * LEBAR_KOLOM, y: 0, width: LEBAR_KOLOM, height: TINGGI }));
        }
        if (!(x.rp > 0) || !maks) return;
        var h = Math.max(3, Math.round(x.rp / maks.rp * (TINGGI - 8)));
        gambarSvg.appendChild(svgEl('rect', { class: 'batang', x: i * LEBAR_KOLOM + 22, y: TINGGI - h, width: LEBAR_KOLOM - 44, height: h }));
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
    gambarBatang(-1);
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
      return kartu;
    }
    kartu.appendChild(el('p', { class: 'grafik-ringkas', text: g.luar
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
      u.cek.forEach(function (c) {
        var f = posisi(c.suhu);
        var p = penandaSuhu(c.luar);
        var bungkus = el('span', { class: 'suhu-titik-satu' + (f === 0 || f === 1 ? ' tepi' : ''), style: 'left:' + (f * 100).toFixed(2) + '%' });
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
    var isi = [
      el('p', { class: 'kartu-teks', text: 'Stock Akhir × harga satuan yang berlaku sekarang. Item tanpa harga tidak ikut dihitung.' }),
      tabel,
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
      case 'resetPin': return { href: hrefStaff(data.nama, true) };
      case 'formBelum': return { href: '#/' };
      case 'jadwal': return { href: '#/pengaturan/outlet' };
      case 'tanpaHarga': return { klik: function () { bukaNilaiStock(d.nilaiStock); } };
      default: return null;
    }
  }

  function daftarPerhatian(d) {
    var butir = d.perhatian || [];
    if (!butir.length) return kotakKosong('Tidak ada yang perlu perhatian. Form, suhu, dan stock dalam keadaan baik.', 'centang');
    return el('div', { class: 'daftar', role: 'group', 'aria-label': 'Perlu perhatian' }, butir.map(function (p) {
      var isi = el('span', { class: 'daftar-baris-isi' }, [
        tandaStatus(p.tingkat, p.judul),
        p.ket ? el('span', { class: 'daftar-baris-ket', text: p.ket }) : null
      ]);
      var tujuan = tujuanPerhatian(p, d);
      if (!tujuan) return el('div', { class: 'daftar-baris peristiwa tetap' }, isi);
      if (tujuan.href) return el('a', { class: 'daftar-baris pemberitahuan', href: tujuan.href }, [isi, ikon('kanan')]);
      return el('button', { type: 'button', class: 'daftar-baris pemberitahuan', 'aria-haspopup': 'dialog', onclick: tujuan.klik }, [isi, ikon('kanan')]);
    }));
  }

  /** Angka ringkas hari ini (tampilan Bagian 5.6). Nilai stock membuka rinciannya. */
  function angkaRingkas(d) {
    var r = d.ringkas || {};
    var tanpa = d.nilaiStock && d.nilaiStock.tanpaHarga ? d.nilaiStock.tanpaHarga.length : 0;
    function ubin(label, nilai, ket, klik) {
      var isi = [
        el('span', { class: 'ubin-label', text: label }),
        el('span', { class: 'ubin-nilai', text: nilai }),
        el('span', { class: 'ubin-ket', text: ket })
      ];
      if (!klik) return el('div', { class: 'ubin' }, isi);
      return el('button', { type: 'button', class: 'ubin ubin-tombol', 'aria-haspopup': 'dialog', onclick: klik }, isi.concat(ikon('kanan')));
    }
    return el('section', { class: 'angka-ringkas', 'aria-label': 'Angka ringkas hari ini' }, [
      ubin('Form terisi', (r.formLengkap || 0) + ' dari ' + (r.formWajib || 0), 'hari ini'),
      ubin('Belum diperiksa', String(r.belumDiperiksa || 0), 'isian, ' + BATAS_RIWAYAT_HARI + ' hari terakhir'),
      ubin('Suhu di luar standar', String(r.suhuLuar || 0), 'pengecekan hari ini'),
      ubin('Di bawah stok minimum', String(r.bawahMinimum || 0), 'item'),
      ubin('Total waste', formatRupiah(r.wasteRp || 0), r.wasteCatatan ? r.wasteCatatan + ' catatan hari ini' : 'hari ini'),
      ubin('Nilai stock', formatRupiah(r.nilaiStock || 0), tanpa ? tanpa + ' item belum punya harga' : 'semua item punya harga',
        function () { bukaNilaiStock(d.nilaiStock || {}); })
    ]);
  }

  function layarDashboard(k) {
    aturJudul('Dashboard');
    var penanda = el('span', { class: 'memperbarui', role: 'status' });
    var wadah = el('div', { class: 'dashboard' });
    k.wadah.appendChild(el('div', { class: 'layar-isi' }, [
      el('h1', { class: 'judul-layar', text: 'Dashboard' }),
      penanda,
      wadah
    ]));

    function gambar(d) {
      kosongkan(wadah);
      if (d.tanggal && d.tanggal !== tanggalIso(new Date())) {
        wadah.appendChild(el('p', { class: 'kolom-bantuan', text: 'Data ' + tanggalJudul(d.tanggal) + '.' }));
      }
      wadah.appendChild(angkaRingkas(d));
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
      for (var i = 0; i < 6; i++) ubin.appendChild(el('span', { class: 'ubin kerangka kerangka-ubin' }));
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
        el('a', { class: 'daftar-baris', href: '#/pengaturan/unit' }, [
          ikon('termometer'),
          el('span', { class: 'daftar-baris-isi' }, [
            el('span', { class: 'daftar-baris-judul', text: 'Unit' }),
            el('span', { class: 'daftar-baris-ket', text: 'Chiller dan freezer untuk form Suhu.' })
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
            el('span', { class: 'daftar-baris-ket', text: 'Nama outlet, zona waktu, jam closing, jadwal opname dan cadangan, keluar otomatis.' })
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
        hariCadangan: d.hariCadangan || 'Minggu', keluarOtomatisMenit: Number(d.keluarOtomatisMenit) || KELUAR_OTOMATIS_AWAL
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

      simpan.addEventListener('click', function () {
        if (simpan.disabled) return;
        tulisPesan(pesan, '');
        var ok = [
          kNama.galat(isi.namaOutlet.trim() ? '' : 'Isi nama outlet.'),
          kJam.galat(/^\d{1,2}:\d{2}$/.test(isi.jamClosing) ? '' : 'Isi jam closing, misalnya 21:30.'),
          kJeda.galat(/^\d{1,3}$/.test(isi.jedaLaporanMenit) && Number(isi.jedaLaporanMenit) <= 240 ? '' : 'Isi menit bulat, 0 sampai 240.')
        ];
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
      el('p', { class: 'kartu-teks', text: 'Bahan dan barang jadi yang dipakai semua form. Item tidak dihapus, hanya dinonaktifkan, supaya riwayatnya tetap terbaca.' }),
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
    k.wadah.appendChild(el('div', { class: 'layar-isi layar-sempit' }, [
      tautanKembali('Item', '#/pengaturan/item'),
      judul,
      catatanDraft,
      penanda,
      wadah
    ]));

    var data = null;
    var itemKini = null;
    var isi = null; // { nama, kategori, satuan, besar, satuanBesar, isi, harga, stokMin, stokMaks }
    var d = Draft.baca(kunciDraft);
    if (d && d.data) {
      isi = d.data;
      catatanDraft.textContent = 'Draft tersimpan ' + jam(new Date(d.waktu).toISOString());
    }

    function simpanDraft() {
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
        var harga = angka(isi.harga);
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
      wadah.appendChild(el('section', { class: 'kartu formulir' }, [kHarga.wadah, kMin.wadah, kMaks.wadah]));
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
          if (alasan) {
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
      }
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
                  gambarIsian();
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
        if (isi && data) {
          data = hasil;
          var baruKini = baru ? null : cari(namaAwal);
          if (baruKini) itemKini = baruKini;
          return;
        }
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
      if (s.terkunci) tandaPin.push(tandaStatus('masalah', 'Terkunci karena PIN salah 5 kali'));
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
        diriSendiri ? el('p', { class: 'kartu-teks', text: 'Role dan keadaan akunmu sendiri diubah oleh Head Kitchen atau Manager lain.' }) : null,
        gRole.wadah,
        simpanRole
      ]));

      // Kartu keadaan akun
      if (!diriSendiri) {
        var tombolAktif = s.aktif
          ? tombol('Nonaktifkan', 'bahaya', { onclick: nonaktifkan })
          : tombol('Aktifkan lagi', 'kedua', { onclick: aktifkan });
        wadah.appendChild(el('section', { class: 'kartu' }, [
          el('h2', { class: 'kartu-judul', text: 'Keadaan akun' }),
          el('p', { class: 'kartu-teks', text: s.aktif
            ? 'Aktif. ' + s.nama + ' bisa masuk dan mengisi form.'
            : 'Nonaktif. ' + s.nama + ' tidak tampil di layar Login. Isian lamanya tetap tersimpan.' }),
          tombolAktif
        ]));

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

    function nonaktifkan() {
      var s = staffKini;
      konfirmasi({
        judul: 'Nonaktifkan ' + s.nama + '?',
        teks: s.nama + ' tidak bisa masuk sampai diaktifkan lagi. Isian lamanya tetap tersimpan.',
        teksYa: 'Nonaktifkan',
        bahaya: true,
        jalankan: function () { return panggilApi('ubahStaff', { nama: s.nama, aktif: false }); }
      }).then(function (hasil) {
        if (!hasil) return;
        Cache.tulis('staff', hasil);
        gambar(hasil);
        toast(s.nama + ' dinonaktifkan.');
      });
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

    function aktifkan(e) {
      var s = staffKini;
      var t = e.currentTarget;
      aturTombolProses(t, true, 'Menyimpan…');
      panggilApi('ubahStaff', { nama: s.nama, aktif: true }).then(function (hasil) {
        Cache.tulis('staff', hasil);
        gambar(hasil);
        toast(s.nama + ' aktif lagi.');
      }).catch(function (err) {
        aturTombolProses(t, false);
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

  /** Setelah PIN direset, pemberitahuan di Beranda langsung hilang (server juga menandainya selesai). */
  function hapusPermintaanDiBeranda(nama) {
    var beranda = Cache.baca('beranda');
    if (!beranda || !beranda.data.permintaanReset) return;
    beranda.data.permintaanReset = beranda.data.permintaanReset.filter(function (p) {
      return p.nama.toLowerCase() !== nama.toLowerCase();
    });
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
