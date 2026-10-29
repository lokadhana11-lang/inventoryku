// Uji server fitur Hari libur (Code.gs v0.30) di atas Spreadsheet tiruan supabase/src.
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';

let lulus = 0, gagal = 0;
function cek(label, kondisi, info) {
  if (kondisi) lulus++;
  else { gagal++; console.log('GAGAL:', label, info !== undefined ? JSON.stringify(info).slice(0, 600) : ''); }
}
const tglJkt = (ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const hari = (n) => tglJkt(Date.now() + H.geserWaktu + n * 86400000);
/** Jam tiruan: tanggal (yyyy-mm-dd) pukul hh:mm WIB. */
function keWaktu(tanggal, jam, menit) {
  const sasaran = Date.parse(tanggal + 'T' + String(jam).padStart(2, '0') + ':' + String(menit || 0).padStart(2, '0') + ':00+07:00');
  H.aturGeser(sasaran - Date.now());
}
let n = 0; const sid = () => 'libur-' + (++n) + '-' + Math.random().toString(36).slice(2, 10);

const s = seed();
let T = s.token;
const HARI0 = hari(0);
const A = (action, b, tok) => H.aksi(Object.assign({ action, token: tok || T }, b));
let TR = H.aksi({ action: 'login', nama: 'Rina', pin: '730264' }).data.token;
const konf = (k) => { const r = H.ss.getSheetByName('M_Konfigurasi').getDataRange().getValues().find((x) => x[0] === k); return r ? String(r[1]) : ''; };
const barisLibur = () => H.ss.getSheetByName('M_HariLibur').getDataRange().getValues().slice(1).filter((r) => r[0] !== '' && r[0] != null);
const logLibur = () => H.ss.getSheetByName('Log_Perubahan').getDataRange().getValues().filter((r) => r[2] === 'M_HariLibur');

/* ---------- 1. Sebelum setupSpreadsheet (tab belum ada) ---------- */
{
  H.ss.deleteSheet(H.ss.getSheetByName('M_HariLibur'));
  const b = A('beranda', { tanggal: HARI0 });
  cek('tanpa tab: beranda.libur null', b.ok && b.data.libur === null, b);
  cek('tanpa tab: wajib seperti biasa', b.data.form.every((f) => f.wajib), b.data.form);
  const d = A('daftarLibur', {});
  cek('tanpa tab: daftarLibur siap false', d.ok && d.data.siap === false && d.data.libur.length === 0, d);
  const sl = A('simpanLibur', { tanggal: HARI0, keterangan: 'x' });
  cek('tanpa tab: simpanLibur ditolak', !sl.ok && /M_HariLibur belum ada/.test(sl.pesan), sl);
  const hl = A('hapusLibur', { tanggal: HARI0 });
  cek('tanpa tab: hapusLibur dihapus null', hl.ok && hl.data.dihapus === null, hl);
  const dash = A('dashboard', { tanggal: HARI0 });
  cek('tanpa tab: dashboard jalan', dash.ok && dash.data.libur === null, dash.pesan);
  H.fungsi('setupSpreadsheet');
  H.fungsi('setupSpreadsheet');
  const tabs = H.ss.getSheets().map((x) => x.getName()).filter((x) => x === 'M_HariLibur');
  cek('setupSpreadsheet membuat tab sekali', tabs.length === 1, tabs);
  const judul = H.ss.getSheetByName('M_HariLibur').getDataRange().getValues()[0];
  cek('kolom M_HariLibur', JSON.stringify(judul) === JSON.stringify(['Tanggal', 'Keterangan', 'Dicatat Oleh', 'Dicatat Pada']), judul);
}

/* ---------- 2. Validasi ---------- */
{
  const bad = ['2026-02-30', 'x', '', null];
  bad.forEach((t) => {
    const r = A('simpanLibur', { tanggal: t, keterangan: '' });
    cek('tanggal tidak sah ditolak: ' + t, !r.ok && /Tanggal tidak terbaca/.test(r.pesan), r);
  });
  const jauh = A('simpanLibur', { tanggal: hari(367), keterangan: '' });
  cek('+367 ditolak', !jauh.ok && /setahun ke depan/.test(jauh.pesan), jauh);
  const batas = A('simpanLibur', { tanggal: hari(366), keterangan: '' });
  cek('+366 diterima', batas.ok && batas.data.batasDepan === hari(366), batas);
  A('hapusLibur', { tanggal: hari(366) });
  const ket41 = A('simpanLibur', { tanggal: hari(5), keterangan: 'x'.repeat(41) });
  cek('keterangan 41 ditolak', !ket41.ok && /40 huruf/.test(ket41.pesan), ket41);
  const rumus = A('simpanLibur', { tanggal: hari(5), keterangan: '=SUM(1)' });
  cek('keterangan rumus tersimpan sebagai teks', rumus.ok && rumus.data.libur.find((x) => x.tanggal === hari(5)).keterangan === '=SUM(1)', rumus);
  A('hapusLibur', { tanggal: hari(5) });
  ['daftarLibur', 'simpanLibur', 'hapusLibur'].forEach((a) => {
    const r = A(a, { tanggal: HARI0, keterangan: '' }, TR);
    cek('Staff ditolak: ' + a, !r.ok && /Head Kitchen atau Manager/.test(r.pesan), r);
  });
  cek('Staff tidak menulis', barisLibur().length === 0, barisLibur());
}

/* ---------- 3. Simpan, ubah, hapus ---------- */
{
  const r = A('simpanLibur', { tanggal: hari(3), keterangan: 'Lebaran' });
  cek('simpan baru', r.ok && r.data.disimpan.baru === true && r.data.disimpan.isian.length === 0, r);
  const b = barisLibur();
  cek('baris baru: Tanggal Date, Dicatat Oleh/Pada', b.length === 1 && b[0][0] instanceof Date && b[0][2] === 'Budi' && b[0][3] instanceof Date, b);
  const logAwal = logLibur().length;
  const ulang = A('simpanLibur', { tanggal: hari(3), keterangan: 'Lebaran' });
  cek('simpan ulang sama: tidak menulis', ulang.ok && ulang.data.disimpan.baru === false && logLibur().length === logAwal && barisLibur().length === 1, ulang);
  const ganti = A('simpanLibur', { tanggal: hari(3), keterangan: 'Idul Fitri' });
  cek('ganti keterangan: sel berubah + log', ganti.ok && barisLibur()[0][1] === 'Idul Fitri' && logLibur().length === logAwal + 1 &&
    logLibur().slice(-1)[0][4] === 'Keterangan', logLibur().slice(-1));
  const hp = A('hapusLibur', { tanggal: hari(3) });
  cek('hapus: baris hilang + log', hp.ok && hp.data.dihapus === hari(3) && barisLibur().length === 0 && /\(dihapus\)/.test(logLibur().slice(-1)[0][6]), logLibur().slice(-1));
  const hp2 = A('hapusLibur', { tanggal: hari(3) });
  cek('hapus lagi: dihapus null', hp2.ok && hp2.data.dihapus === null, hp2);
  // Diketik tangan: dua baris bertanggal sama dan satu baris teks bukan tanggal.
  const sh = H.ss.getSheetByName('M_HariLibur');
  sh.getRange(2, 1, 3, 4).setValues([[new Date(Date.parse(hari(4) + 'T00:00:00+07:00')), 'A', 'Pemilik', ''],
    ['bukan tanggal', 'B', '', ''], [hari(4), 'C', 'Pemilik', '']]);
  const d = A('daftarLibur', {});
  cek('baris ganda: yang atas dipakai; teks bukan tanggal dilewati', d.data.libur.length === 1 && d.data.libur[0].keterangan === 'A', d.data.libur);
  A('hapusLibur', { tanggal: hari(4) });
  cek('baris ganda: keduanya terhapus', barisLibur().length === 1 && barisLibur()[0][0] === 'bukan tanggal', barisLibur());
  sh.deleteRow(2);
}

/* ---------- 4. Beranda ---------- */
{
  A('kirimStock', { submissionId: sid(), tanggal: HARI0, kategori: 'Protein', waktuPerangkat: new Date().toISOString(), baris: [{ item: 'Telur', masuk: '', keluar: 2 }] });
  const sebelum = A('beranda', { tanggal: HARI0 });
  const belumDiperiksa = sebelum.data.pemeriksaan.belumDiperiksa;
  const r = A('simpanLibur', { tanggal: HARI0, keterangan: 'Lebaran' });
  cek('simpan hari ini: isian disebut', r.ok && JSON.stringify(r.data.disimpan.isian) === JSON.stringify(['Stock', 'Suhu']), r.data.disimpan);
  const b = A('beranda', { tanggal: HARI0 });
  cek('beranda: libur terisi', b.data.libur && b.data.libur.keterangan === 'Lebaran' && b.data.libur.oleh === 'Budi', b.data.libur);
  cek('beranda: semua wajib false', b.data.form.every((f) => f.wajib === false), b.data.form);
  const st = Object.fromEntries(b.data.form.map((f) => [f.id, f.status]));
  cek('beranda: status tetap dari isian', st.STOCK === 'terkirim' && st.SUHU === 'sebagian' && st.PREP === 'belum', st);
  cek('beranda: pemeriksaan tetap', b.data.pemeriksaan.belumDiperiksa === belumDiperiksa, [b.data.pemeriksaan, belumDiperiksa]);
  const bs = A('beranda', { tanggal: HARI0 }, TR);
  cek('beranda Staff: libur terisi, liburBesok ada (null)', bs.data.libur && bs.data.libur.tanggal === HARI0 && bs.data.liburBesok === null, bs.data);
  A('simpanLibur', { tanggal: hari(1), keterangan: 'Lebaran hari 2' });
  const bb = A('beranda', { tanggal: HARI0 });
  cek('beranda Pengelola: liburBesok', bb.data.liburBesok && bb.data.liburBesok.tanggal === hari(1), bb.data.liburBesok);
  A('hapusLibur', { tanggal: hari(1) });
  A('hapusLibur', { tanggal: HARI0 });
  const sesudah = A('beranda', { tanggal: HARI0 });
  cek('sesudah hapus: wajib kembali, libur null', sesudah.data.libur === null && sesudah.data.form.every((f) => f.wajib), sesudah.data.form);
  // Simpanan Beranda 2 menit: tanda baru langsung terlihat (versi data berganti).
  A('simpanLibur', { tanggal: HARI0, keterangan: '' });
  const lagi = A('beranda', { tanggal: HARI0 });
  cek('simpanan Beranda terbuang setelah simpan', lagi.data.libur && lagi.data.libur.keterangan === '', lagi.data.libur);
  A('hapusLibur', { tanggal: HARI0 });
}

/* ---------- 5. Dashboard, penjualan, porsi ---------- */
{
  A('simpanLibur', { tanggal: HARI0, keterangan: 'Lebaran' });
  const d = A('dashboard', { tanggal: HARI0 });
  cek('dashboard: formWajib 0, tanpa formBelum, libur', d.data.ringkas.formWajib === 0 && !d.data.perhatian.some((p) => p.jenis === 'formBelum') &&
    d.data.libur && d.data.libur.tanggal === HARI0, [d.data.ringkas, d.data.perhatian.map((p) => p.jenis)]);
  A('hapusLibur', { tanggal: HARI0 });
  // Besok: hari ini (tanpa penjualan) menjadi "kemarin".
  H.aturGeser(86400000);
  const besok = hari(0);
  const T2 = H.aksi({ action: 'login', nama: 'Budi', pin: '482915' }).data.token;
  let dd = A('dashboard', { tanggal: besok }, T2);
  const adaJual = (x) => x.data.perhatian.filter((p) => p.jenis === 'penjualan');
  cek('kemarin tanpa penjualan: butir penjualan', adaJual(dd).length === 1 && /kemarin/i.test(adaJual(dd)[0].judul), adaJual(dd));
  A('simpanLibur', { tanggal: HARI0, keterangan: '' }, T2);
  dd = A('dashboard', { tanggal: besok }, T2);
  cek('kemarin libur: tanpa butir penjualan', adaJual(dd).length === 0, adaJual(dd));
  const h = A('hpp', { bulan: HARI0.slice(0, 7) }, T2);
  cek('hpp: libur di penjualan.libur, bukan kurang', h.ok && h.data.penjualan.libur.indexOf(HARI0) >= 0 && h.data.penjualan.kurang.indexOf(HARI0) < 0, h.data && h.data.penjualan);
  cek('hpp: hari + kurang = jumlahHari', h.data.penjualan.hari + h.data.penjualan.kurang.length === h.data.penjualan.jumlahHari, h.data.penjualan);
  cek('hpp: cek silang tetap cocok', h.data.cekSilang.cocok === true, h.data.cekSilang);
  // Hari libur dengan penjualan > 0 tanpa porsi: porsi tetap ditagih.
  const pj = A('simpanPenjualan', { tanggal: HARI0, penjualan: 250000, catatan: 'katering', submissionId: sid() }, T2);
  cek('simpanPenjualan pada hari libur diterima', pj.ok, pj);
  const h2 = A('hpp', { bulan: HARI0.slice(0, 7) }, T2);
  cek('libur dengan penjualan: dihitung, bukan libur', h2.data.penjualan.libur.indexOf(HARI0) < 0 && h2.data.penjualan.total === h.data.penjualan.total + 250000, h2.data.penjualan);
  cek('libur dengan penjualan > 0 tanpa porsi: porsi kurang', h2.data.teoritis.kurang.indexOf(HARI0) >= 0, h2.data.teoritis.kurang);
  const pt = A('penjualanTanggal', { tanggal: HARI0 }, T2);
  cek('penjualanTanggal: libur', pt.ok && pt.data.libur && pt.data.libur.tanggal === HARI0, pt.data);
  const kosong = A('simpanPenjualan', { tanggal: HARI0, penjualan: '', submissionId: sid() }, T2);
  cek('galat penjualan kosong', !kosong.ok && kosong.pesan === 'Isi penjualan. Isi 0 jika tidak ada penjualan.', kosong);
  A('hapusLibur', { tanggal: HARI0 }, T2);
  H.aturGeser(0);
  T = H.aksi({ action: 'login', nama: 'Budi', pin: '482915' }).data.token;
  TR = H.aksi({ action: 'login', nama: 'Rina', pin: '730264' }).data.token;
}

/* ---------- 6. Form kustom dan isian pada hari libur ---------- */
{
  const f = A('simpanForm', { baru: true, nama: 'Checklist kebersihan', tampil: true, keterangan: '', jadwal: 'harian', hari: [],
    kolom: [{ bagian: 'baris', label: 'Area', jenis: 'Teks', pilihan: [], wajib: true }] });
  cek('form kustom dibuat', f.ok, f);
  const id = f.data.disimpan.id;
  A('simpanLibur', { tanggal: HARI0, keterangan: 'Lebaran' });
  const fk = A('formKustom', { formId: id, tanggal: HARI0 }, TR);
  cek('formKustom: wajib false, libur', fk.ok && fk.data.wajib === false && fk.data.libur && fk.data.libur.tanggal === HARI0, fk.data && { wajib: fk.data.wajib, libur: fk.data.libur });
  const kolId = fk.data.form.kolom[0].id;
  const kk = A('kirimKustom', { formId: id, submissionId: sid(), tanggal: HARI0, waktuPerangkat: new Date().toISOString(), kepala: {}, baris: [{ [kolId]: 'Dapur' }] }, TR);
  cek('kirimKustom pada hari libur diterima', kk.ok && kk.data.jumlah === 1, kk);
  const nh = A('tandaiNihil', { submissionId: sid(), formId: 'WASTE', tanggal: HARI0, waktuPerangkat: new Date().toISOString() }, TR);
  cek('tandaiNihil pada hari libur diterima', nh.ok, nh);
  const ks = A('kirimSuhu', { submissionId: sid(), tanggal: HARI0, waktuCek: 'Middle', waktuPerangkat: new Date().toISOString(),
    baris: [{ unit: 'Chiller 1', suhu: 3 }, { unit: 'Chiller 2', suhu: 4 }, { unit: 'Freezer 1', suhu: -19 }] }, TR);
  cek('kirimSuhu pada hari libur diterima', ks.ok, ks);
  const b = A('beranda', { tanggal: HARI0 });
  const kus = b.data.form.find((x) => x.id === id);
  cek('beranda: form kustom terkirim dan tidak wajib', kus && kus.status === 'terkirim' && kus.wajib === false, kus);
  A('hapusLibur', { tanggal: HARI0 });
  const fk2 = A('formKustom', { formId: id, tanggal: HARI0 }, TR);
  cek('formKustom sesudah hapus: wajib true', fk2.data.wajib === true && fk2.data.libur === null, fk2.data.libur);
}

/* ---------- 7. Email harian ---------- */
{
  const KEMARIN = hari(-1);
  cek('penerima email', A('simpanPenerima', { email: ['laporan@contoh.invalid'] }).ok);
  // Hari libur hari ini pukul 22.20: laporan dilewati, PDF yang berisian disimpan ke Drive.
  A('simpanLibur', { tanggal: HARI0, keterangan: 'Lebaran' });
  keWaktu(HARI0, 22, 20);
  const nSurel = H.surel.length;
  const nBerkas = H.driveUji().berkas.length;
  const h = H.fungsi('kirimLaporanHarian');
  cek('hari libur: tanpa email', H.surel.length === nSurel && h.dilewati === true, h);
  cek('hari libur: PDF disimpan ke Drive', H.driveUji().berkas.length > nBerkas && h.pdf.length > 0, [H.driveUji().berkas.length, nBerkas, h.pdf.length]);
  const lap = konf('laporan_terakhir');
  cek('laporan_terakhir Dilewati', new RegExp('^Dilewati ' + HARI0 + ' 22:20 untuk ' + HARI0 + ': hari libur \\(Lebaran\\); \\d+ PDF disimpan ke Drive\\.$').test(lap), lap);
  // Gagal sebelumnya tidak ditimpa.
  H.fungsi('tulisKonfigurasi_', 'laporan_terakhir', 'Gagal ' + KEMARIN + ' 22:15 untuk ' + KEMARIN + ': uji.', 'x');
  H.fungsi('kirimLaporanHarian');
  cek('Gagal tidak ditimpa', /^Gagal /.test(konf('laporan_terakhir')), konf('laporan_terakhir'));
  // Pukul 01.00 esok: laporan untuk kemarin (= HARI0, libur) dilewati.
  keWaktu(hari(1), 1, 0);
  H.fungsi('tulisKonfigurasi_', 'laporan_terakhir', '', 'x');
  const h2 = H.fungsi('kirimLaporanHarian');
  cek('01.00, kemarin libur: dilewati untuk kemarin', h2.dilewati === true && h2.tanggal === HARI0 && H.surel.length === nSurel, h2);
  H.aturGeser(0);
  // Kemarin bukan libur dan hari ini libur, pukul 01.00 hari ini: laporan kemarin terkirim.
  keWaktu(HARI0, 1, 0);
  const h3 = H.fungsi('kirimLaporanHarian');
  cek('01.00, kemarin kerja: terkirim untuk kemarin', h3.terkirim === true && h3.tanggal === KEMARIN && !h3.dilewati, h3);
  H.aturGeser(0);
  // Uji dari editor pada hari libur tetap mengirim, dengan keterangan.
  const n2 = H.surel.length;
  H.fungsi('kirimLaporanSekarang');
  const email = H.surel[H.surel.length - 1];
  cek('kirimLaporanSekarang pada hari libur terkirim', H.surel.length === n2 + 1 && /^\[Uji\]/.test(email.subject), email && email.subject);
  const html = email.htmlBody || '';
  cek('email uji: Hari libur: Lebaran', /Hari libur: Lebaran/.test(html), html.slice(0, 600));
  cek('email uji: Tidak ada isian (hari libur)', /Tidak ada isian \(hari libur\)/.test(html) && !/tidak dijadwalkan hari ini/.test(html), html.slice(0, 1500));
  A('hapusLibur', { tanggal: HARI0 });
}

/* ---------- 8. laporanTerlambat_ ---------- */
{
  const nilai = { jam_closing: '21:30', jeda_laporan_menit: '45' };
  const D = hari(0);
  keWaktu(D, 23, 30);
  T = H.aksi({ action: 'login', nama: 'Budi', pin: '482915' }).data.token;
  const lt = (lap) => H.ambil('laporanTerlambat_')(nilai, lap);
  cek('tanpa libur: Terkirim D-1 → terlambat D', lt('Terkirim ' + hari(-1) + ' 22:16 untuk ' + hari(-1)) === D, lt('Terkirim ' + hari(-1) + ' 22:16'));
  cek('tanpa libur: Terkirim D → tidak', lt('Terkirim ' + D + ' 22:16 untuk ' + D) === '');
  A('simpanLibur', { tanggal: D, keterangan: '' });
  cek('D libur tanpa Dilewati (jadwal berhenti): Terkirim D-1 → terlambat D', lt('Terkirim ' + hari(-1) + ' 22:16 untuk ' + hari(-1)) === D, lt('Terkirim ' + hari(-1) + ' 22:16'));
  cek('Dilewati D → tidak terlambat', lt('Dilewati ' + D + ' 22:15 untuk ' + D + ': hari libur.') === '');
  A('simpanLibur', { tanggal: hari(-1), keterangan: '' });
  A('simpanLibur', { tanggal: hari(-2), keterangan: '' });
  cek('tiga hari libur, jadwal berhenti: Terkirim D-3 → terlambat D', lt('Terkirim ' + hari(-3) + ' 22:16 untuk ' + hari(-3)) === D);
  cek('tiga hari libur, jadwal berjalan: Dilewati D → tidak', lt('Dilewati ' + D + ' 22:15 untuk ' + D + ': hari libur.') === '');
  A('hapusLibur', { tanggal: D });
  cek('hari kerja sesudah libur tanpa laporan → terlambat', lt('Dilewati ' + hari(-1) + ' 22:15 untuk ' + hari(-1) + ': hari libur.') === D);
  A('hapusLibur', { tanggal: hari(-1) });
  A('hapusLibur', { tanggal: hari(-2) });
  // Peringatan di Beranda tidak menulis Dilewati sebagai kegagalan.
  H.fungsi('tulisKonfigurasi_', 'laporan_terakhir', 'Dilewati ' + D + ' 22:15 untuk ' + D + ': hari libur.', 'x');
  const b = A('beranda', { tanggal: D });
  if (!b.ok) console.log('BERANDA', JSON.stringify(b));
  cek('Dilewati bukan peringatan Gagal', !(b.data.peringatanSistem || []).some((p) => /Dilewati/.test(p)), b.data.peringatanSistem);
  // Hari libur tanpa catatan Dilewati: peringatan menyebut jadwal yang tidak berjalan.
  A('simpanLibur', { tanggal: D, keterangan: '' });
  H.fungsi('tulisKonfigurasi_', 'laporan_terakhir', 'Terkirim ' + hari(-1) + ' 22:16 untuk ' + hari(-1) + ' ke 1 penerima, 0 PDF.', 'x');
  const b2 = A('beranda', { tanggal: D });
  cek('peringatan hari libur tanpa Dilewati', (b2.data.peringatanSistem || []).some((p) => /jadwal laporan tidak berjalan pada .*hari libur, catatan Dilewati tidak ada/.test(p)), b2.data.peringatanSistem);
  A('hapusLibur', { tanggal: D });
  H.aturGeser(0);
}

/* ---------- 9. Pengingat ---------- */
{
  TR = H.aksi({ action: 'login', nama: 'Rina', pin: '730264' }).data.token;
  H.opsiUji.vapid = 'kunci-uji';
  const sub = A('aturNotifikasi', { aktif: true, langganan: { endpoint: 'https://push.uji/1', keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) } } });
  cek('langganan notifikasi', sub.ok, sub);
  A('simpanLibur', { tanggal: HARI0, keterangan: 'Lebaran' });
  H.opsiUji.push.length = 0;
  H.logs.length = 0;
  H.fungsi('pengingatSuhuClosing');
  cek('pengingat suhu pada hari libur: tidak dikirim', H.opsiUji.push.length === 0 && H.logs.some((l) => /Hari libur; pengingat Closing dilewati/.test(l)), H.logs.slice(-3));
  H.fungsi('pengingatStock');
  cek('pengingat stock pada hari libur tetap dikirim', H.opsiUji.push.length === 1, H.opsiUji.push.map((p) => p.isi && p.isi.judul));
  A('hapusLibur', { tanggal: HARI0 });
  H.opsiUji.push.length = 0;
  H.fungsi('pengingatSuhuClosing');
  cek('pengingat suhu hari kerja: dikirim', H.opsiUji.push.length === 1, H.logs.slice(-3));
  // Notifikasi suhu di luar standar tetap dikirim pada hari libur.
  A('simpanLibur', { tanggal: HARI0, keterangan: '' });
  H.opsiUji.push.length = 0;
  A('kirimSuhu', { submissionId: sid(), tanggal: HARI0, waktuCek: 'Cek ulang', waktuPerangkat: new Date().toISOString(),
    baris: [{ unit: 'Chiller 1', suhu: 9, tindakan: 'Pintu ditutup' }] }, TR);
  cek('notifikasi suhu di luar standar tetap dikirim', H.opsiUji.push.some((p) => /suhu|Suhu/.test(p.isi.judul)), H.opsiUji.push.map((p) => p.isi.judul));
  A('hapusLibur', { tanggal: HARI0 });
  H.opsiUji.vapid = '';
}

/* ---------- 10. Riwayat Suhu ---------- */
{
  const r0 = A('riwayat', { formId: 'SUHU', dari: hari(-10), sampai: HARI0, tampilan: 'catatan' });
  const terlewat0 = r0.data.peristiwa.filter((p) => p.jenis === 'terlewat').map((p) => p.tanggal);
  cek('ada terlewat sebelum libur', terlewat0.length >= 1, terlewat0);
  terlewat0.forEach((t) => A('simpanLibur', { tanggal: t, keterangan: '' }));
  const r1 = A('riwayat', { formId: 'SUHU', dari: hari(-10), sampai: HARI0, tampilan: 'catatan' });
  cek('hari libur tanpa terlewat', !r1.data.peristiwa.some((p) => p.jenis === 'terlewat'), r1.data.peristiwa);
  cek('tidak ada jenis peristiwa baru', r1.data.peristiwa.every((p) => ['nihil', 'terlewat', 'penyesuaian', 'opname'].indexOf(p.jenis) >= 0), r1.data.peristiwa.map((p) => p.jenis));
  terlewat0.forEach((t) => A('hapusLibur', { tanggal: t }));
}

/* ---------- 10b. Tanggal yang sudah diarsip ---------- */
{
  A('simpanLibur', { tanggal: hari(-6), keterangan: 'lama' });
  H.fungsi('tulisKonfigurasi_', 'arsip_sampai', hari(-5), 'x');
  const d = A('daftarLibur', {});
  cek('libur sebelum arsip_sampai tidak tampil', d.data.arsipSampai === hari(-5) && !d.data.libur.some((x) => x.tanggal === hari(-6)), d.data);
  const r = A('simpanLibur', { tanggal: hari(-6), keterangan: '' });
  cek('simpan sebelum arsip ditolak', !r.ok && /arsip tahunan/.test(r.pesan), r);
  const h = A('hapusLibur', { tanggal: hari(-6) });
  cek('hapus sebelum arsip ditolak', !h.ok && /arsip tahunan/.test(h.pesan), h);
  H.fungsi('tulisKonfigurasi_', 'arsip_sampai', '', 'x');
  A('hapusLibur', { tanggal: hari(-6) });
}

/* ---------- 11. Rekap bulanan ---------- */
{
  const bulan = HARI0.slice(0, 7);
  const l1 = hari(-3), l2 = hari(-2);
  const r0 = H.ambil('dataRekapBulan_')(bulan);
  A('simpanLibur', { tanggal: l1, keterangan: '' });
  A('simpanLibur', { tanggal: l2, keterangan: '' });
  const r1 = H.ambil('dataRekapBulan_')(bulan);
  cek('rekap: kepatuhan.libur', JSON.stringify(r1.kepatuhan.libur) === JSON.stringify([l1, l2]), r1.kepatuhan.libur);
  cek('rekap: hariDinilai tetap', r1.kepatuhan.hariDinilai === r0.kepatuhan.hariDinilai, [r0.kepatuhan.hariDinilai, r1.kepatuhan.hariDinilai]);
  const stock0 = r0.kepatuhan.form.find((f) => f.id === 'STOCK'), stock1 = r1.kepatuhan.form.find((f) => f.id === 'STOCK');
  cek('rekap: ditagih berkurang 2', stock1.ditagih === stock0.ditagih - 2, [stock0.ditagih, stock1.ditagih]);
  cek('rekap: suhu.libur', JSON.stringify(r1.suhu.libur) === JSON.stringify([l1, l2]), r1.suhu.libur);
  cek('rekap: penjualan tercatat, jadi bukan libur penjualan', r1.hpp.penjualan.libur.length === 0, r1.hpp.penjualan);
  const html = H.ambil('isiPdfRekap_')(r1);
  const tgl = (t) => String(Number(t.slice(8)));
  cek('PDF: termasuk 2 hari libur', html.indexOf('termasuk 2 hari libur: ' + tgl(l1) + ' dan ' + tgl(l2)) >= 0, html.match(/Hari yang dinilai[^<]*/));
  cek('PDF: catatan Suhu hari libur', html.indexOf('Hari libur (' + tgl(l1) + ' dan ' + tgl(l2) + ') tidak dihitung.') >= 0);
  cek('PDF: catatan Kepatuhan', html.indexOf('Hari libur tidak ditagih.') >= 0);
  const em = H.ambil('htmlEmailRekap_')(r1, { outlet: 'Dapur' });
  cek('email rekap: (2 hari libur) atau daftar tidak lengkap', /2 hari libur/.test(em) || /Form tidak lengkap/.test(em), em.match(/Kepatuhan.{0,300}/));
  A('hapusLibur', { tanggal: l1 });
  A('hapusLibur', { tanggal: l2 });
  const r2 = H.ambil('dataRekapBulan_')(bulan);
  cek('rekap tanpa libur sama dengan sebelum', H.ambil('isiPdfRekap_')(r2) === H.ambil('isiPdfRekap_')(r0));
  // Form hari tertentu yang semua hari jadwalnya libur: "Hari libur, tidak ditagih".
  const HARI_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const namaHari = HARI_ID[new Date(hari(-3) + 'T12:00:00Z').getUTCDay()];
  const fm = A('simpanForm', { baru: true, nama: 'Cek mingguan', tampil: true, keterangan: '', jadwal: 'hari tertentu', hari: [namaHari],
    kolom: [{ bagian: 'baris', label: 'Butir', jenis: 'Teks', pilihan: [], wajib: true }] });
  cek('form hari tertentu dibuat', fm.ok, fm);
  const libHari = [hari(-3), hari(-10)].filter((t) => t.slice(0, 7) === bulan);
  libHari.forEach((t) => A('simpanLibur', { tanggal: t, keterangan: '' }));
  const r3 = H.ambil('dataRekapBulan_')(bulan);
  const cm = r3.kepatuhan.form.find((f) => f.nama === 'Cek mingguan');
  const html3 = H.ambil('isiPdfRekap_')(r3);
  cek('form hari tertentu: ditagih 0, liburDitagih', cm && cm.ditagih === 0 && cm.liburDitagih === libHari.length, cm);
  cek('PDF: Hari libur, tidak ditagih', /Cek mingguan<\/td><td[^>]*>0<\/td><td[^>]*>0<\/td><td[^>]*>Hari libur, tidak ditagih/.test(html3) || html3.indexOf('Hari libur, tidak ditagih') >= 0, html3.match(/Cek mingguan.{0,200}/));
  libHari.forEach((t) => A('hapusLibur', { tanggal: t }));
  // Daftar panjang: "antara lain".
  const panjang = [];
  for (let i = 1; i <= 9 && hari(-i).slice(0, 7) === bulan; i++) panjang.push(hari(-i));
  if (panjang.length > 8) {
    panjang.forEach((t) => A('simpanLibur', { tanggal: t, keterangan: '' }));
    const html4 = H.ambil('isiPdfRekap_')(H.ambil('dataRekapBulan_')(bulan));
    cek('daftar libur panjang dipotong', /hari libur: antara lain/.test(html4), html4.match(/Hari yang dinilai[^<]*/));
    panjang.forEach((t) => A('hapusLibur', { tanggal: t }));
  }
}

/* ---------- 12. Rumus Sheets ---------- */
{
  const dash = H.ss.getSheetByName('Dashboard');
  cek('tab Dashboard ada', !!dash);
}

console.log('Lulus', lulus, 'Gagal', gagal);
console.log(H.logs.filter((l) => /^ERR/.test(l)).slice(0, 5));
