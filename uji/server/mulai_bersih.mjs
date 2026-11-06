// Uji mulai bersih (Code.gs v0.45, butir 476): isian uji dihapus sekali sebelum aplikasi dipakai sungguhan.
// A. kosongkanIsian di Supabase: periksa saja (tidak mengubah apa pun), lalu hapus sesudah cadangan; master, PIN, konfigurasi tetap;
//    stock 0, Stock opname hari pertama menjadi stock awal; cadangan bisa dipulihkan; dijalankan lagi tidak menghapus apa pun.
// B. server.js: kosongkanIsian boleh dijalankan pemilik lewat __fungsi.
// C. mulaiBersih di editor Apps Script: jalan pertama hanya mencatat; dengan MULAI_BERSIH=ya menghapus, menghapus Script Property
//    itu, dan meminta salinan penuh; Edge Function lama dijawab dengan petunjuk.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';

const REPO = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');
let gagal = 0, lulus = 0;
const cek = (k, label, x) => { if (k) lulus++; else { gagal++; console.log('GAGAL:', label, x !== undefined ? JSON.stringify(x).slice(0, 900) : ''); } };

const { token: T } = seed();
const A = (action, b) => H.aksi(Object.assign({ action, token: T }, b || {}));
const tabIsian = () => H.ambil('tabArsip_')();
const jumlahBaris = (nama) => { const sh = H.ss.getSheetByName(nama); return sh ? sh.getLastRow() : -1; };
const potretMaster = () => ['M_Item', 'M_HargaItem', 'M_Staff', 'M_Resep', 'M_ResepBahan', 'M_Menu', 'M_MenuBahan', 'M_Unit', 'M_Pemasok',
  'M_Kategori', 'M_Satuan', 'M_Form', 'M_FormKolom', 'M_Konfigurasi'].map((n) => n + ':' + JSON.stringify(H.ss.getSheetByName(n).getDataRange().getValues()));
const berkasCadangan = () => H.driveUji().berkas.filter((b) => /^Cadangan sebelum mulai bersih .*\.json$/.test(b.nama || (b.getName && b.getName()) || ''));
const isiBerkas = (b) => {
  const d = b.isi != null ? b.isi : (b.data != null ? b.data : b.blob);
  if (typeof d === 'string') return d;
  if (d && d.getDataAsString) return d.getDataAsString();
  if (d instanceof Uint8Array || Buffer.isBuffer(d)) return Buffer.from(d).toString('utf8');
  return d && d.bytes ? Buffer.from(d.bytes).toString('utf8') : '';
};
const hariIni = new Date(Date.now()).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

// Form kustom dengan isian, supaya tab Data_K_* ikut dihapus.
{
  const f = A('simpanForm', { baru: true, nama: 'Checklist kebersihan', tampil: true, keterangan: '', jadwal: 'harian', hari: [], kolom: [{ id: '', bagian: 'baris', label: 'Area', jenis: 'Teks', pilihan: [], wajib: true }] });
  const id = f.ok ? f.data.disimpan.id : '';
  const fk = id ? A('formKustom', { formId: id, tanggal: hariIni }) : { ok: false, pesan: f.pesan };
  const kol = fk.ok ? fk.data.form.kolom.find((k) => k.label === 'Area') : null;
  const kk = kol ? A('kirimKustom', { formId: id, submissionId: 'sid-kustom-1', tanggal: hariIni, waktuPerangkat: new Date().toISOString(), kepala: {}, baris: [{ [kol.id]: 'Dapur' }] }) : fk;
  cek(kk.ok && tabIsian().some((n) => /^Data_K_/.test(n) && jumlahBaris(n) > 1), 'form kustom berisi isian', kk.pesan || tabIsian());
}
const isiAwal = Object.fromEntries(tabIsian().map((n) => [n, jumlahBaris(n) - 1]));
const totalAwal = Object.values(isiAwal).reduce((a, b) => a + b, 0);
cek(isiAwal.Data_Stock > 0 && isiAwal.Data_Suhu > 0 && isiAwal.Data_Waste > 0 && isiAwal.Data_Prep > 0 && isiAwal.Stock_Harian > 0, 'data contoh berisi isian', isiAwal);
const masterAwal = potretMaster();
const konfAwal = H.ss.getSheetByName('M_Konfigurasi').getDataRange().getValues();
const pinRina = H.aksi({ action: 'login', nama: 'Rina', pin: '730264' });
cek(pinRina.ok, 'login Rina sebelum');

// A1. Periksa saja: tidak ada yang berubah, tidak ada cadangan.
H.logs.length = 0;
const p = H.fungsi('kosongkanIsian', true);
cek(p.periksa === true && p.baris === totalAwal && p.terakhir === hariIni && !p.cadangan, 'periksa: jumlah dan tanggal terbaru', { p: Object.assign({}, p, { tab: undefined }), totalAwal, hariIni });
cek(p.tab.every((t) => t.baris === isiAwal[t.nama]) && p.tab.length === Object.values(isiAwal).filter(Boolean).length, 'periksa: per tab', p.tab);
cek(tabIsian().every((n) => jumlahBaris(n) - 1 === isiAwal[n]) && !berkasCadangan().length, 'periksa: tidak mengubah apa pun');
const logPeriksa = H.logs.join('\n');
cek(/Isian yang akan dihapus: \d+ baris di \d+ tab, yang terbaru bertanggal/.test(logPeriksa) && /- Data_Stock: \d+ baris, terakhir \d{4}-\d{2}-\d{2}/.test(logPeriksa) &&
  /Tetap \(tidak dihapus\): .*M_Staff 4/.test(logPeriksa) && /Tetap .*M_Item 11/.test(logPeriksa), 'periksa: log isian dan master', logPeriksa.slice(0, 900));
cek(H.fungsi('kosongkanIsian').periksa === true, 'tanpa argumen = periksa saja');

// A2. Hapus.
H.logs.length = 0;
const h = H.fungsi('kosongkanIsian', false);
cek(h.periksa === false && h.baris === totalAwal && /^Cadangan sebelum mulai bersih \d{4}-\d{2}-\d{2} \d{6}\.json$/.test(h.cadangan), 'hapus: hasil', Object.assign({}, h, { tab: undefined }));
cek(tabIsian().every((n) => jumlahBaris(n) === 1), 'hapus: tab isian tinggal judul', Object.fromEntries(tabIsian().map((n) => [n, jumlahBaris(n)])));
cek(tabIsian().every((n) => String(H.ss.getSheetByName(n).getRange(1, 1).getValue()).trim() !== ''), 'hapus: baris judul tetap');
cek(JSON.stringify(potretMaster().filter((x) => !x.startsWith('M_Konfigurasi'))) === JSON.stringify(masterAwal.filter((x) => !x.startsWith('M_Konfigurasi'))), 'hapus: tab master tidak berubah');
const konf = H.ss.getSheetByName('M_Konfigurasi').getDataRange().getValues();
const barisBersih = konf.find((r) => r[0] === 'mulai_bersih');
cek(barisBersih && /^Berhasil .*: \d+ baris isian uji dihapus \(terbaru \d{4}-\d{2}-\d{2}\)\. Isi sebelumnya: .*Cadangan sebelum mulai bersih/.test(barisBersih[1]), 'hapus: dicatat di M_Konfigurasi', barisBersih);
cek(JSON.stringify(konf.filter((r) => r[0] !== 'mulai_bersih')) === JSON.stringify(konfAwal), 'konfigurasi lain tetap');

// Cadangan: satu berkas, berisi isian lama, dan lolos pemeriksaan pemulihan.
const cad = berkasCadangan();
cek(cad.length === 1, 'cadangan: satu berkas', H.driveUji().berkas.map((b) => b.nama));
let dataCad = null;
try { dataCad = JSON.parse(isiBerkas(cad[0])); } catch (e) { console.log('cadangan tidak terbaca:', e.message, Object.keys(cad[0] || {})); }
const tabCad = dataCad ? Object.fromEntries(dataCad.tab.map((t) => [t.nama, t.nilai.length - 1])) : {};
cek(dataCad && tabIsian().every((n) => tabCad[n] === isiAwal[n]), 'cadangan: berisi isian sebelum dihapus', tabCad);
const periksaCad = dataCad ? H.ambil('periksaIsiCadangan_')(dataCad) : { masalah: ['tidak terbaca'] };
cek(!periksaCad.masalah.length, 'cadangan: bisa dipulihkan', periksaCad.masalah);
cek(/Cadangan isi sebelum dihapus: Cadangan sebelum mulai bersih/.test(H.logs.join('\n')), 'hapus: log menyebut cadangan');

// Aplikasi sesudahnya: PIN tetap, stock 0, Riwayat kosong, Dashboard tanpa nilai stock, lalu opname hari pertama = stock awal.
const login = H.aksi({ action: 'login', nama: 'Rina', pin: '730264' });
cek(login.ok, 'login Rina sesudah (PIN tetap)', login.pesan);
const fs0 = A('formStock', { tanggal: hariIni });
cek(fs0.ok && fs0.data.item.length === 11 && fs0.data.kiriman.jumlah === 0 && fs0.data.item.every((i) => i.awal === 0 && i.akhir === 0), 'form Stock: 11 item, stock 0, belum ada kiriman',
  fs0.ok ? { kiriman: fs0.data.kiriman, item: fs0.data.item.slice(0, 2) } : fs0.pesan);
const op0 = A('formOpname', { tanggal: hariIni });
cek(op0.ok && op0.data.item.every((i) => i.tercatat === 0) && op0.data.status.terakhir === null, 'opname: semua tercatat 0, belum pernah opname', op0.ok ? op0.data.status : op0.pesan);
const rw = A('riwayat', { formId: 'STOCK', dari: hariIni, sampai: hariIni });
cek(rw.ok && !(rw.data.kiriman || []).length, 'Riwayat Stock kosong', rw.ok ? Object.keys(rw.data) : rw.pesan);
const db = A('dashboard', {});
cek(db.ok && !db.data.nilaiStock.total && db.data.opname.terakhir === null, 'Dashboard: nilai stock 0, belum ada opname', db.ok ? db.data.nilaiStock : db.pesan);
const so = A('simpanOpname', { submissionId: 'sid-bersih-1', tanggal: hariIni, waktuPerangkat: new Date().toISOString(),
  baris: [{ item: 'Ayam fillet', hitung: 8.5 }, { item: 'Telur', hitung: 90 }, { item: 'Tomat', hitung: 3 }] });
cek(so.ok && so.data.berselisih === 3, 'opname hari pertama tersimpan', so.ok ? so.data : so.pesan);
const op1 = A('formOpname', { tanggal: hariIni });
const tercatat = op1.ok ? Object.fromEntries(op1.data.item.map((i) => [i.nama, i.tercatat])) : {};
cek(tercatat['Ayam fillet'] === 8.5 && tercatat.Telur === 90 && tercatat.Tomat === 3 && tercatat['Daging sapi'] === 0, 'opname menjadi stock awal', tercatat);
cek(A('dashboard', {}).data.nilaiStock.total > 0, 'Dashboard: nilai stock dari opname');

// A3. Dijalankan lagi: isian baru (opname hari pertama) juga terhitung; tanpa izin hanya mencatat.
const p2 = H.fungsi('kosongkanIsian', true);
cek(p2.baris > 0 && berkasCadangan().length === 1 && jumlahBaris('Data_Opname') > 1, 'periksa lagi: isian baru terlihat, tidak dihapus', Object.assign({}, p2, { tab: undefined }));

// A4. Tab kosong: tidak ada cadangan baru.
H.fungsi('kosongkanIsian', false);
const nCad = berkasCadangan().length;
H.logs.length = 0;
const kosong = H.fungsi('kosongkanIsian', false);
cek(kosong.baris === 0 && !kosong.cadangan && berkasCadangan().length === nCad && /tidak ada yang perlu dihapus/.test(H.logs.join('\n')), 'tanpa isian: tidak ada yang dihapus atau dicadangkan', kosong);

// B. server.js: __fungsi kosongkanIsian diteruskan ke runtime; fungsi lain tetap ditolak.
{
  const { buatPelayan } = await import(REPO + '/supabase/src/server.js');
  const dipanggil = [];
  const pelayan = buatPelayan({ rahasiaSinkron: 'rahasia-uji', log: { log: () => {}, error: () => {} },
    runtime: { jalankan: async (k) => { dipanggil.push(k); return { keluaran: { baris: 0 }, catatan: ['ok'] }; } } });
  const kirim = (b) => pelayan(new Request('http://uji/', { method: 'POST', body: JSON.stringify(Object.assign({ rahasia: 'rahasia-uji' }, b)) })).then((r) => r.json());
  const r1 = await kirim({ action: '__fungsi', nama: 'kosongkanIsian', argumen: [true] });
  cek(r1.ok && dipanggil.length === 1 && dipanggil[0].nama === 'kosongkanIsian' && dipanggil[0].argumen[0] === true && dipanggil[0].muat === undefined && !dipanggil[0].saatPulih,
    'server.js: kosongkanIsian diteruskan, memuat semua tab', { r1, k: dipanggil[0] });
  const r2 = await kirim({ action: '__fungsi', nama: 'hapusSemua' });
  cek(!r2.ok && /tidak bisa dijalankan dari sini/.test(r2.pesan) && dipanggil.length === 1, 'server.js: fungsi lain ditolak', r2);
  const r3 = await pelayan(new Request('http://uji/', { method: 'POST', body: JSON.stringify({ action: '__fungsi', rahasia: 'salah', nama: 'kosongkanIsian' }) }));
  cek(r3.status === 403 && dipanggil.length === 1, 'server.js: tanpa rahasia ditolak', r3.status);
}

// C. Editor Apps Script: mulaiBersih memanggil Supabase (di sini: Code.gs uji di atas) lewat UrlFetchApp tiruan.
{
  // Isian lagi untuk dihapus.
  const s = A('formSuhu', { tanggal: hariIni });
  cek(s.ok, 'form Suhu terbaca', s.pesan);
  A('simpanOpname', { submissionId: 'sid-bersih-2', tanggal: hariIni, waktuPerangkat: new Date().toISOString(), baris: [{ item: 'Telur', hitung: 30 }] });
  const sebelum = jumlahBaris('Data_Opname');
  cek(sebelum > 1, 'ada isian untuk editor');

  const { Spreadsheet } = await import(REPO + '/supabase/src/sheet.js');
  const { buatLayanan } = await import(REPO + '/supabase/src/layanan.js');
  const { bungkusKodeGs } = await import(REPO + '/supabase/src/bungkus.js');
  const pembuat = new Function('G', bungkusKodeGs(fs.readFileSync(REPO + '/apps-script/Code.gs', 'utf8')));
  const ssAs = new Spreadsheet({ tabMeta: [], dataTab: {}, zona: 'Asia/Jakarta', info: { nama: 'Salinan Uji' } });
  const propsAs = { SPREADSHEET_ID: 'x', SUDAH_PINDAH: '2026-10-16', SUPABASE_API: 'https://supabase.uji/functions/v1/api', RAHASIA_SINKRON: 'rahasia-uji',
    SINKRON_VERSI: '{"Data_Stock":5}' };
  const logAs = [];
  const panggilan = [];
  let fungsiDiizinkan = true;
  globalThis.UrlFetchApp = {
    fetch(url, opsi) {
      const body = JSON.parse(opsi.payload);
      panggilan.push(body.action + (body.nama ? ' ' + body.nama : ''));
      let data;
      if (body.action === '__fungsi') {
        if (!fungsiDiizinkan) return { getContentText: () => JSON.stringify({ ok: false, pesan: 'Fungsi ' + body.nama + ' tidak bisa dijalankan dari sini.' }), getResponseCode: () => 200 };
        const awal = H.logs.length;
        const keluaran = H.fungsi(body.nama, ...(body.argumen || []));
        data = { keluaran, catatan: H.logs.slice(awal) };
      } else if (body.action === '__berkas') data = { salin: [], buang: [] };
      else if (body.action === '__sinkron') data = { tab: [], selesai: true };
      else if (body.action === '__surel') data = [];
      else data = {};
      return { getContentText: () => JSON.stringify({ ok: true, data }), getResponseCode: () => 200 };
    }
  };
  const editor = () => {
    const k = { ss: ssAs, Date, crypto, Buffer, htmlKePdf: () => new Uint8Array(), props: propsAs, propsAwal: {}, zona: () => 'Asia/Jakarta', info: {}, push: [],
      drive: { folder: new Set(), folderBaru: new Set(), berkas: [] }, jadwal: { daftar: [] }, surel: [],
      log: { log: (...a) => logAs.push(a.join(' ')), info: (...a) => logAs.push(a.join(' ')), warn: (...a) => logAs.push(a.join(' ')), error: (...a) => logAs.push('ERR ' + a.join(' ')) },
      perluTab: ssAs.perluTab };
    const G = buatLayanan(k);
    G.DI_SUPABASE = false; G.SUPABASE_ = {}; G.Date = Date;
    return pembuat(G);
  };

  // Di Supabase tidak bisa dijalankan.
  let galatSupabase = '';
  try { H.fungsi('mulaiBersih'); } catch (e) { galatSupabase = e.message; }
  cek(/dijalankan dari editor Apps Script/.test(galatSupabase), 'mulaiBersih ditolak di Supabase', galatSupabase);

  // C1. Tanpa MULAI_BERSIH: hanya mencatat.
  const r1 = editor().mulaiBersih();
  const log1 = logAs.join('\n');
  cek(r1.periksa === true && r1.baris > 0 && jumlahBaris('Data_Opname') === sebelum && panggilan.join(',') === '__fungsi kosongkanIsian', 'editor: jalan pertama hanya mencatat', { panggilan, r1: Object.assign({}, r1, { tab: undefined }) });
  cek(/Isian yang akan dihapus/.test(log1) && /isi Script Property MULAI_BERSIH dengan ya/.test(log1) && propsAs.SINKRON_VERSI === '{"Data_Stock":5}', 'editor: petunjuk di log', log1.slice(-600));

  // C2. Isian selain "ya" tetap hanya mencatat.
  propsAs.MULAI_BERSIH = 'iya kah';
  cek(editor().mulaiBersih().periksa === true && jumlahBaris('Data_Opname') === sebelum && propsAs.MULAI_BERSIH === 'iya kah', 'editor: hanya "ya" yang menghapus');

  // C3. Edge Function lama: petunjuk menempel index.ts, tidak ada yang berubah.
  propsAs.MULAI_BERSIH = 'Ya';
  fungsiDiizinkan = false;
  let galatLama = '';
  try { editor().mulaiBersih(); } catch (e) { galatLama = e.message; }
  cek(/Edge Function di Supabase masih versi lama/.test(galatLama) && propsAs.MULAI_BERSIH === 'Ya' && jumlahBaris('Data_Opname') === sebelum, 'editor: Edge Function lama', galatLama);
  fungsiDiizinkan = true;

  // C4. Dengan MULAI_BERSIH=Ya: hapus, Script Property dihapus, salinan penuh diminta, berkas disalin dulu, lalu salinan ke Sheet.
  panggilan.length = 0;
  logAs.length = 0;
  const r4 = editor().mulaiBersih();
  const log4 = logAs.join('\n');
  cek(r4.periksa === false && r4.baris > 0 && /^Cadangan sebelum mulai bersih/.test(r4.cadangan) && tabIsian().every((n) => jumlahBaris(n) === 1), 'editor: isian dihapus', Object.assign({}, r4, { tab: undefined }));
  cek(!('MULAI_BERSIH' in propsAs) || propsAs.MULAI_BERSIH == null, 'editor: MULAI_BERSIH dihapus', propsAs.MULAI_BERSIH);
  cek(panggilan[0] === '__fungsi kosongkanIsian' && panggilan.indexOf('__berkas') > 0 && panggilan.indexOf('__sinkron') > panggilan.indexOf('__berkas'), 'editor: urutan hapus, salin berkas, salin tab', panggilan);
  cek(/Selesai: \d+ baris isian uji dihapus\. Untuk membatalkan: isi Script Property PULIHKAN_CADANGAN dengan "Cadangan sebelum mulai bersih/.test(log4) &&
    /Stock opname semua kategori/.test(log4) && !/ERR/.test(log4), 'editor: log selesai', log4.slice(-700));
  // Salinan diminta penuh (versi kosong) pada panggilan __sinkron pertama sesudah penghapusan.
  cek(propsAs.SINKRON_VERSI === '{}', 'editor: salinan penuh diminta', propsAs.SINKRON_VERSI);

  // C5. Jalan lagi (MULAI_BERSIH sudah dihapus): hanya mencatat, tanpa isian.
  logAs.length = 0;
  const r5 = editor().mulaiBersih();
  cek(r5.periksa === true && r5.baris === 0 && /tidak ada yang perlu dihapus/.test(logAs.join('\n')), 'editor: jalan lagi tanpa isian', r5);
  delete globalThis.UrlFetchApp;
}

console.log('lulus', lulus, 'gagal', gagal, 'ERR log', H.logs.filter((l) => l.startsWith('ERR')));
