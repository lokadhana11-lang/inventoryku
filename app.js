/* InventoryKu — frontend (Tahap 1: kerangka PWA dan akses; Tahap 2: form Stock).
   Tanpa framework, tanpa langkah build. Semua teks antarmuka mengikuti
   spesifikasi tampilan Bagian 7. */
(function () {
  'use strict';

  /** Versi aplikasi. SETIAP RILIS naikkan ini DAN VERSI di sw.js (nilainya sama). */
  var VERSI_APLIKASI = '0.3.0';

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
    memperbarui: 'Memperbarui…'
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
    bawah: '<path d="m6 9 6 6 6-6"/>',
    hapusAngka: '<path d="M9 5h11v14H9l-6-7z"/><path d="m12.5 9.5 5 5M17.5 9.5l-5 5"/>',
    centang: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/>',
    seru: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/>',
    tiket: '<path d="M5 4h14v16H5z"/><path d="M8.5 9h7M8.5 13h7M8.5 17h4"/>'
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
   * opsi: { judul, isi: Node|Node[], aksi: [{ teks, jenis, klik(tombol, lembar) }], diTutup() }
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
    var lembar = el('div', { class: 'lembar', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': idJudul }, [
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
   * Konfirmasi dengan aksi yang butuh server. opsi: { judul, teks, teksYa,
   * teksProses, bahaya, jalankan() → Promise }. Hasil: Promise berisi
   * jawaban jalankan(), atau null jika dibatalkan.
   */
  function konfirmasi(opsi) {
    return new Promise(function (selesai) {
      var sudah = false;
      var pesan = el('p', { class: 'pesan-formulir masalah', role: 'alert' });
      var lembar = bukaLembar({
        judul: opsi.judul,
        isi: [opsi.teks ? el('p', { text: opsi.teks }) : null, pesan],
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

  /** Pesan di dalam formulir. jenis: masalah | baik | tinjau. */
  function tulisPesan(wadah, teks, jenis) {
    kosongkan(wadah);
    wadah.className = wadah.className.replace(/\b(masalah|baik|tinjau)\b/g, '').trim();
    if (!teks) return;
    wadah.classList.add(jenis || 'masalah');
    wadah.appendChild(ikon(jenis === 'baik' ? 'centang' : (jenis === 'tinjau' ? 'info' : 'seru')));
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
      tombolBar.setAttribute('aria-label', p.nama + ', ganti pengguna');
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
    { pola: /^\/riwayat$/, menu: 'riwayat', layar: layarBelumDibangun('Riwayat') },
    { pola: /^\/laporan$/, menu: 'laporan', layar: layarBelumDibangun('Laporan') },
    { pola: /^\/dashboard$/, menu: 'dashboard', pengelola: true, layar: layarBelumDibangun('Dashboard') },
    { pola: /^\/pengaturan$/, menu: 'pengaturan', pengelola: true, layar: layarPengaturan },
    { pola: /^\/pengaturan\/staff$/, menu: 'pengaturan', pengelola: true, layar: layarStaff },
    { pola: /^\/pengaturan\/staff\/([^/]+)(\/pin)?$/, menu: 'pengaturan', pengelola: true, layar: layarStaffDetail },
    { pola: /^\/pengaturan\/penerima$/, menu: 'pengaturan', pengelola: true, layar: layarPenerima }
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

  /** Keluar di HP saja (sesi dihapus), lalu kembali ke layar Login. */
  function keluarLokal(pesan) {
    Sesi.hapus();
    nomorLayar++;
    bersihkanLayar();
    if (lembarKini) lembarKini.tutup(true);
    kosongkanLayar();
    menuAktif = null;
    mulaiMasuk(pesan);
  }

  /** "Ganti pengguna": mengeluarkan pengguna saat ini dan kembali ke layar Login. */
  function bukaGantiPengguna() {
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
          teks: 'Ganti pengguna',
          jenis: 'utama',
          klik: function (t, l) {
            panggilApi('keluar', { token: sesi.token }).catch(function () { /* sesi tetap habis sendiri */ });
            l.tutup(true);
            keluarLokal('');
          }
        }
      ]
    });
  }

  /* =======================================================================
   * Layar Login (spesifikasi tampilan Bagian 5.1)
   * ===================================================================== */

  var login = null; // keadaan layar Login yang sedang tampil
  var ketikLoginKini = null; // pendengar keyboard layar Login yang terpasang

  function mulaiMasuk(pesan) {
    tampilMode('masuk');
    var info = Simpan.baca(AWALAN + 'infoLogin');
    if (info && !info.perluPemasangan) {
      gambarLogin(info, pesan, true);
    } else {
      gambarLogin(null, pesan, true);
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
   * Setelah angka keenam, login langsung diproses.
   */
  function gambarLogin(info, pesanAwal, memuat) {
    var wadah = $('#masuk');
    wadah.className = 'masuk';
    kosongkan(wadah);
    aturJudulDokumen('Masuk');

    var keadaan = { info: info, nama: '', pin: '', sibuk: false };
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

    /* ----- Langkah 1: pilih nama ----- */
    function tampilNama() {
      keadaan.nama = '';
      keadaan.pin = '';
      kotakLogin.classList.remove('langkah-pin');
      kosongkan(kiri).appendChild(merek.wadah);
      kiri.appendChild(pesan);
      kosongkan(kanan);
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
        Sesi.tulis({
          token: data.token,
          berlakuSampai: data.berlakuSampai,
          pengguna: data.pengguna,
          namaOutlet: data.namaOutlet
        });
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
        Sesi.tulis({
          token: data.token,
          berlakuSampai: data.berlakuSampai,
          pengguna: data.pengguna,
          namaOutlet: data.namaOutlet
        });
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
        Sesi.tulis({
          token: data.token,
          berlakuSampai: data.berlakuSampai,
          pengguna: data.pengguna,
          namaOutlet: data.namaOutlet
        });
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
          'aria-haspopup': 'dialog',
          'aria-label': sesi.pengguna.nama + ', ganti pengguna',
          onclick: bukaGantiPengguna
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
          })
        });
      }
      if (data.namaOutlet) outlet.textContent = data.namaOutlet;
      if (!dariHp && data.pengguna) perbaruiPengguna(data.pengguna, data.namaOutlet);

      var form = data.form || [];
      gambarTiket(form);
      gambarKemajuan(form);
      gambarPemberitahuan(data.permintaanReset || []);
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

    /** Pengelola: "NAMA meminta reset PIN", ketuk untuk membuka layar reset PIN staff itu. */
    function gambarPemberitahuan(permintaan) {
      kosongkan(bawah);
      var baris = barisAntrean();
      if (baris) bawah.appendChild(baris);
      if (!sesiKini().pengguna.pengelola || !permintaan.length) return;
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
          return panggilApi('beranda', { tanggal: tanggalIso(new Date()) });
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
  var LAYAR_FORM = { STOCK: '#/stock' };

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
            kirimAntrean().then(function (n) {
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
      panggilApi('tandaiNihil', isi).then(function (hasil) {
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
      var sesuaikan = pengelola ? tombol('Sesuaikan stock', 'tautan', {
        'aria-label': 'Sesuaikan stock ' + it.nama,
        onclick: function () { bukaSesuaikan(it); }
      }) : null;

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
          el('td', { class: 'nama-item' }, [el('span', { class: 'daftar-baris-judul', text: it.nama }), sesuaikan ? el('br') : null, sesuaikan]),
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
          wadahPeringatan,
          sesuaikan
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
      panggilApi('kirimStock', isi).then(function (hasil) {
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

    /** Sesuaikan stock satu item (spesifikasi sistem Bagian 5.7), hanya Pengelola. */
    function bukaSesuaikan(it) {
      var kSebenarnya = kolomIsian({ label: 'Stock sebenarnya (' + it.satuan + ')', inputmode: 'decimal', kelas: 'isian-angka' });
      var gAlasan = grupPilihan('Alasan', ['Stok pembuka', 'Hasil hitung ulang', 'Lainnya'], '');
      var kCatatan = kolomIsian({ label: 'Catatan', maxlength: 200, bantuan: 'Wajib untuk alasan Lainnya.' });
      var ringkas = el('p', { class: 'pesan-formulir tinjau', 'aria-live': 'polite' });
      var pesanLembar = el('p', { class: 'pesan-formulir', role: 'alert' });
      var sid = buatId();
      function perbaruiRingkas() {
        var n = bacaAngka(kSebenarnya.input.value);
        if (n === null || isNaN(n)) {
          tulisPesan(ringkas, 'Tercatat ' + formatAngka(it.akhir) + ' ' + it.satuan + '.', 'tinjau');
          return;
        }
        var selisih = bulat3(n - it.akhir);
        tulisPesan(ringkas, 'Tercatat ' + formatAngka(it.akhir) + ' ' + it.satuan + ', sebenarnya ' + formatAngka(n) + ' ' +
          it.satuan + '. Selisih ' + (selisih > 0 ? '+' : '') + formatAngka(selisih) + ' ' + it.satuan + '.', 'tinjau');
      }
      kSebenarnya.input.addEventListener('input', perbaruiRingkas);
      perbaruiRingkas();
      var form = el('form', { class: 'formulir', novalidate: true }, [
        el('p', { class: 'kolom-bantuan', text: 'Tanggal ' + tanggalPendek(tanggal) + '. Selisihnya dicatat sebagai penyesuaian.' }),
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
          l.tutup();
          terapkanJawaban(hasil.form);
          toast('Stock ' + it.nama + ' disesuaikan. Selisih ' + (hasil.selisih > 0 ? '+' : '') +
            formatAngka(hasil.selisih) + ' ' + it.satuan + '.');
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
   * Menu yang dibangun di tahap berikutnya
   * ===================================================================== */

  function layarBelumDibangun(judul) {
    return function (k) {
      aturJudul(judul);
      k.wadah.appendChild(el('div', { class: 'layar-isi layar-sempit' }, [
        el('h1', { class: 'judul-layar', text: judul }),
        kotakKosong(judul + ' dibangun di tahap berikutnya.', judul === 'Riwayat' ? 'riwayat' : (judul === 'Laporan' ? 'laporan' : 'dashboard'))
      ]));
    };
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
            el('span', { class: 'daftar-baris-ket', text: 'Tambah staff, ubah role, buat atau reset PIN, nonaktifkan.' }),
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
        ])
      ])
    ]));
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
        var baris = el('tr', { class: 'bisa-diketuk' }, [
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

  /** Satu staff: PIN, role, aktif. Dari pemberitahuan Beranda, lembar reset PIN langsung terbuka. */
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
      if (!Sesi.baca()) {
        keluarLokal(PESAN.sesiBerakhir);
        return;
      }
      kirimAntrean().then(function (n) {
        if (!n && segarkanLayar) segarkanLayar();
      });
    });
    $('#bar-pengguna').addEventListener('click', bukaGantiPengguna);

    if (Sesi.baca()) {
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
