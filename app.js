/* InventoryKu — frontend (Tahap 0: uji sambungan ke API). */
(function () {
  'use strict';

  var TEKS_BELUM_DIISI = 'GANTI_DENGAN_URL_WEB_APP';
  var BATAS_WAKTU_MS = 30000;

  var PESAN = {
    configTidakTermuat: 'File config.js tidak termuat. Pastikan config.js ada di samping index.html.',
    alamatBelumDiisi: 'Alamat API belum diisi di config.js',
    alamatBukanHttps: 'Alamat API di config.js harus diawali https://. Salin ulang alamat Web App dari Apps Script.',
    tidakAdaSinyal: 'Tidak ada sinyal. Periksa sambungan internet, lalu coba lagi.',
    tidakTerhubung: 'Server tidak bisa dihubungi. Periksa sinyal, alamat API di config.js, dan setelan deploy Web App (akses: Anyone), lalu coba lagi.',
    terlaluLama: 'Server tidak menjawab dalam 30 detik. Coba lagi.',
    ditolak: 'Server menolak permintaan. Periksa alamat API di config.js: harus alamat Web App yang berakhiran /exec.',
    jawabanTidakDikenal: 'Jawaban server tidak dikenali. Periksa alamat API di config.js: harus alamat Web App yang berakhiran /exec.',
    gagalUmum: 'Server menolak permintaan. Coba lagi.'
  };

  /* ---------- API ---------- */

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
   * mengirim preflight CORS (Apps Script tidak melayaninya).
   * Berhasil: mengembalikan isi field "data". Gagal: melempar Error berisi
   * pesan berbahasa Indonesia yang siap ditampilkan.
   */
  function panggilApi(aksi, isi) {
    var alamat;
    try {
      alamat = alamatApi();
    } catch (err) {
      return Promise.reject(err);
    }
    if (navigator.onLine === false) {
      return Promise.reject(new Error(PESAN.tidakAdaSinyal));
    }

    var body = Object.assign({}, isi || {}, { action: aksi });
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
        if (!respons.ok) throw new Error(PESAN.ditolak);
        return respons.text();
      }, function () {
        throw new Error(habisWaktu ? PESAN.terlaluLama : PESAN.tidakTerhubung);
      })
      .then(function (teks) {
        var json;
        try {
          json = JSON.parse(teks);
        } catch (err) {
          throw new Error(PESAN.jawabanTidakDikenal);
        }
        if (!json || typeof json !== 'object' || typeof json.ok !== 'boolean') {
          throw new Error(PESAN.jawabanTidakDikenal);
        }
        if (!json.ok) {
          throw new Error(typeof json.pesan === 'string' && json.pesan ? json.pesan : PESAN.gagalUmum);
        }
        return json.data || {};
      })
      .catch(function (err) {
        if (habisWaktu) throw new Error(PESAN.terlaluLama);
        throw err;
      })
      .finally(function () {
        clearTimeout(penghitung);
      });
  }

  /* ---------- Tampilan ---------- */

  var IKON_CENTANG = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.5 8.5l3 3 6-7"/></svg>';
  var IKON_SERU = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="6.25"/><path d="M8 4.75v3.75M8 11.25v.01"/></svg>';

  function buatTandaStatus(jenis, kata) {
    var tanda = document.createElement('span');
    tanda.className = 'tanda-status tanda-' + jenis;
    tanda.innerHTML = jenis === 'baik' ? IKON_CENTANG : IKON_SERU;
    var teks = document.createElement('span');
    teks.textContent = kata;
    tanda.appendChild(teks);
    return tanda;
  }

  function formatJamServer(nilai) {
    var tanggal = new Date(nilai);
    if (!nilai || isNaN(tanggal.getTime())) return String(nilai || '-');
    try {
      return new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).format(tanggal);
    } catch (err) {
      return tanggal.toString();
    }
  }

  function tampilkanBerhasil(wadah, data) {
    wadah.textContent = '';
    wadah.appendChild(buatTandaStatus('baik', 'Tersambung'));

    var rincian = document.createElement('dl');
    rincian.className = 'hasil-rincian';
    [
      ['Spreadsheet', data.namaSpreadsheet ? String(data.namaSpreadsheet) : '-'],
      ['Jam server', formatJamServer(data.waktuServer)]
    ].forEach(function (baris) {
      var kelompok = document.createElement('div');
      var dt = document.createElement('dt');
      var dd = document.createElement('dd');
      dt.textContent = baris[0];
      dd.textContent = baris[1];
      kelompok.appendChild(dt);
      kelompok.appendChild(dd);
      rincian.appendChild(kelompok);
    });
    wadah.appendChild(rincian);
  }

  function tampilkanGagal(wadah, pesan) {
    wadah.textContent = '';
    wadah.appendChild(buatTandaStatus('masalah', 'Gagal tersambung'));
    var p = document.createElement('p');
    p.className = 'hasil-pesan';
    p.textContent = pesan;
    wadah.appendChild(p);
  }

  function aturTombolProses(tombol, sedangProses, teksProses) {
    var teks = tombol.querySelector('.tombol-teks');
    if (!tombol.dataset.teksAsli) tombol.dataset.teksAsli = teks.textContent;
    tombol.disabled = sedangProses;
    tombol.classList.toggle('sedang-proses', sedangProses);
    tombol.setAttribute('aria-busy', sedangProses ? 'true' : 'false');
    teks.textContent = sedangProses ? teksProses : tombol.dataset.teksAsli;
  }

  function mulai() {
    var tombol = document.getElementById('tombol-uji');
    var hasil = document.getElementById('hasil');
    if (!tombol || !hasil) return;

    tombol.addEventListener('click', function () {
      if (tombol.disabled) return;
      hasil.textContent = '';
      aturTombolProses(tombol, true, 'Menguji…');
      panggilApi('ping')
        .then(function (data) {
          tampilkanBerhasil(hasil, data);
        })
        .catch(function (err) {
          tampilkanGagal(hasil, (err && err.message) || PESAN.gagalUmum);
        })
        .finally(function () {
          aturTombolProses(tombol, false);
        });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mulai);
  } else {
    mulai();
  }
})();
