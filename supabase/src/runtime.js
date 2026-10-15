// InventoryKu di Supabase: menjalankan Code.gs untuk satu permintaan.
// 1. Ambil kunci (pg_advisory_xact_lock) untuk aksi yang menulis, supaya penulisan berurutan
//    seperti LockService di Apps Script.
// 2. Muat tab yang biasa dibutuhkan aksi itu (dipelajari dari permintaan sebelumnya, tabel
//    aksi_tab) ditambah semua tab master (M_*).
// 3. Jalankan Code.gs. Jika ia membutuhkan tab yang belum dimuat, muat tab itu lalu ulangi dari awal
//    (semua perubahan percobaan sebelumnya dibuang, karena belum ada yang ditulis).
// 4. Tulis semua perubahan dalam transaksi yang sama, lalu kirim email dan pasang jadwal.

import { Spreadsheet, TAB_BELUM_DIMUAT } from './sheet.js';
import { buatLayanan, PENANDA_BERKAS } from './layanan.js';
import { buatPenyimpanan, uraiNilai } from './penyimpanan.js';

const KUNCI_TULIS = 4207;
const BATAS_ULANG = 40;

function salinData(baris) {
  return baris;
}

/**
 * dep: {
 *   sql: klien postgres.js,
 *   buatKodeGs(G) → objek fungsi Code.gs,
 *   crypto, Buffer, htmlKePdf(html) → Uint8Array,
 *   unggah(berkas) → Promise (isi berkas ke Storage), alamatBerkas([id]) → Promise<{ id: url }>,
 *   kirimSurel(opsi) → Promise, pasangJadwal(daftar, info) → Promise,
 *   Date (opsional, untuk uji), log (opsional)
 * }
 */
export function buatRuntime(dep) {
  const simpan = buatPenyimpanan();
  const KelasDate = dep.Date || Date;
  const log = dep.log || console;

  // Satu salinan Code.gs untuk membaca daftar AKSI_ (aksi mana yang hanya membaca).
  let daftarAksi = null;
  function infoAksi(nama) {
    if (!daftarAksi) {
      const kosong = buatLayanan({ ss: null, Date: KelasDate, props: {}, zona: () => 'Asia/Jakarta', info: {}, crypto: dep.crypto,
        Buffer: dep.Buffer, htmlKePdf: dep.htmlKePdf, drive: null, jadwal: { daftar: [], berubah: false }, surel: [], log,
        perluTab: new Set() });
      daftarAksi = dep.buatKodeGs(Object.assign(kosong, { DI_SUPABASE: true, SUPABASE_: {} })).__ambil('AKSI_');
    }
    return Object.prototype.hasOwnProperty.call(daftarAksi, nama) ? daftarAksi[nama] : null;
  }

  /**
   * kerja: { jenis: 'aksi', body } atau { jenis: 'fungsi', nama, argumen }.
   * Mengembalikan { keluaran (teks JSON untuk aksi, nilai kembali untuk fungsi), surel, jadwal, tabBerubah }.
   */
  async function jalankan(kerja) {
    let namaKunci;
    let tulis = true;
    if (kerja.jenis === 'aksi') {
      const a = kerja.body && typeof kerja.body.action === 'string' ? infoAksi(kerja.body.action) : null;
      namaKunci = 'aksi:' + (a ? kerja.body.action : '?');
      tulis = !(a && a.bacaSaja);
    } else {
      namaKunci = 'fungsi:' + kerja.nama;
    }

    const proses = async (tx) => {
      if (tulis) await tx`select pg_advisory_xact_lock(${KUNCI_TULIS})`;
      const metas = await simpan.muatMeta(tx);
      const versi = {};
      metas.forEach((m) => { versi[m.nama] = Number(m.versi); });
      const propsAwal = await simpan.muatProperti(tx);
      const info = await simpan.muatInfo(tx);
      const perlu = new Set(await simpan.tabAksi(tx, namaKunci));
      // Tab master selalu dimuat; fungsi terjadwal dan dari pemilik (setupSpreadsheet, laporan, rekap) memuat semua tab.
      metas.forEach((m) => { if (/^M_/.test(m.nama) || kerja.jenis === 'fungsi') perlu.add(m.nama); });
      const dataTab = {};
      let drive = null;
      const dipelajari = [];

      for (let ulang = 0; ulang < BATAS_ULANG; ulang++) {
        for (const nama of perlu) {
          if (nama === '__drive') {
            if (!drive) drive = await simpan.muatDrive(tx);
          } else if (!dataTab[nama] && Object.prototype.hasOwnProperty.call(versi, nama)) {
            dataTab[nama] = await simpan.muatTab(tx, nama, versi[nama]);
          }
        }
        const ss = new Spreadsheet({
          Date: KelasDate,
          tabMeta: metas.map((m) => ({ nama: m.nama, urutan: m.urutan, meta: m.meta })),
          dataTab,
          zona: info.zona || 'Asia/Jakarta',
          info: { nama: info.namaSpreadsheet, alamatSheet: info.alamatSheet }
        });
        const props = Object.assign({}, propsAwal);
        // ID spreadsheet selalu "ada": spreadsheet-nya adalah database ini.
        props.SPREADSHEET_ID = props.SPREADSHEET_ID || 'supabase';
        const driveKerja = drive ? {
          folder: new Set(drive.folder), folderBaru: new Set(),
          berkas: drive.berkas.map((b) => Object.assign({}, b))
        } : null;
        // Log tiap percobaan ditampung; hanya percobaan terakhir yang dicatat.
        const catatan = [];
        const logPercobaan = {
          log: (...a) => catatan.push(['log', a]), info: (...a) => catatan.push(['info', a]),
          warn: (...a) => catatan.push(['warn', a]), error: (...a) => catatan.push(['error', a])
        };
        const k = {
          ss, Date: KelasDate, props, propsAwal: Object.assign({ SPREADSHEET_ID: props.SPREADSHEET_ID }, propsAwal),
          zona: () => ss.getSpreadsheetTimeZone(), info: { emailPemilik: info.emailPemilik, alamatApi: info.alamatApi },
          crypto: dep.crypto, Buffer: dep.Buffer, htmlKePdf: dep.htmlKePdf, drive: driveKerja,
          jadwal: { daftar: (info.jadwal || []).slice(), berubah: false }, surel: [], log: logPercobaan, perluTab: ss.perluTab
        };
        const G = buatLayanan(k);
        G.DI_SUPABASE = true;
        G.SUPABASE_ = dep.tambahan || {};
        G.Date = KelasDate;
        const kode = dep.buatKodeGs(G);
        let keluaran;
        let galat = null;
        try {
          if (kerja.jenis === 'aksi') {
            keluaran = kode.doPost({ postData: { contents: JSON.stringify(kerja.body) } }).getContent();
          } else {
            keluaran = kode[kerja.nama].apply(null, kerja.argumen || []);
          }
        } catch (err) {
          galat = err;
        }
        const baru = [...ss.perluTab].filter((t) => !perlu.has(t) || (t === '__drive' ? !drive : !dataTab[t]));
        if (ss.perluTab.size && baru.length) {
          baru.forEach((t) => { perlu.add(t); dipelajari.push(t); });
          continue;
        }
        catatan.forEach(([j, a]) => (log[j] || log.log).apply(log, a));
        if (galat && !(galat.message || '').startsWith(TAB_BELUM_DIMUAT)) throw galat;
        if (dipelajari.length) await simpan.catatTabAksi(tx, namaKunci, dipelajari);
        k.propsAwal = Object.assign({}, propsAwal);
        if (!Object.prototype.hasOwnProperty.call(propsAwal, 'SPREADSHEET_ID') && k.props.SPREADSHEET_ID === 'supabase') {
          delete k.props.SPREADSHEET_ID;
        }
        const tabBerubah = await simpan.tulis(tx, k, dep.unggah || (async () => {}));
        return { keluaran, surel: k.surel, jadwal: k.jadwal, tabBerubah, info };
      }
      throw new Error('Aksi ' + namaKunci + ' membutuhkan terlalu banyak tab.');
    };

    let hasil;
    for (let coba = 0; ; coba++) {
      try {
        hasil = tulis
          ? await dep.sql.begin(proses)
          : await dep.sql.begin('isolation level repeatable read', proses);
        break;
      } catch (err) {
        // Bentrok dengan penulisan lain pada aksi baca: ulangi sekali.
        if (!tulis && coba < 2 && err && (err.code === '40001' || err.code === '40P01')) continue;
        throw err;
      }
    }

    // Sesudah tersimpan: email dan jadwal (kegagalannya dicatat, data tetap tersimpan).
    for (const s of hasil.surel) {
      try {
        await dep.kirimSurel(s);
      } catch (err) {
        log.error('Email gagal dikirim: ' + (err && err.message ? err.message : err));
        if (dep.surelGagal) await dep.surelGagal(s, err);
      }
    }
    if (hasil.jadwal.berubah && dep.pasangJadwal) await dep.pasangJadwal(hasil.jadwal.daftar, hasil.info);
    return hasil;
  }

  /** Mengganti penanda https://berkas.inventoryku/<id> di jawaban dengan tautan sementara yang ditandatangani. */
  async function gantiTautanBerkas(teks) {
    if (typeof teks !== 'string' || teks.indexOf(PENANDA_BERKAS) < 0 || !dep.alamatBerkas) return teks;
    const pola = /https:\/\/berkas\.inventoryku\/([0-9a-f-]{36})/g;
    const id = [...new Set([...teks.matchAll(pola)].map((m) => m[1]))];
    const peta = await dep.alamatBerkas(id);
    return teks.replace(pola, (m, x) => (peta[x] || ''));
  }

  return { jalankan, gantiTautanBerkas, simpan, infoAksi, uraiNilai, salinData };
}
