// Uji server cukup untuk berapa hari (Code.gs v0.43): rata-rata pemakaian (Keluar + Dipakai Prep + Waste) per hari buka dalam
// 14 hari sebelum tanggal itu, hari libur, rekap pertama, batas 3 hari buka, form Stock, riwayat item, Dashboard (hampir habis),
// Daftar belanja, pengingat stock, dan email harian. Angka dari data contoh seed.mjs (stok pembuka 12 hari lalu).
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';

let lulus = 0, gagal = 0;
function cek(label, kondisi, info) {
  if (kondisi) lulus++;
  else { gagal++; console.log('GAGAL:', label, info !== undefined ? JSON.stringify(info).slice(0, 900) : ''); }
}
const tglJkt = (ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const hari = (n) => tglJkt(Date.now() + H.geserWaktu + n * 86400000);
let n = 0; const sid = () => 'cukup-' + (++n) + '-' + Math.random().toString(36).slice(2, 8);
const s = seed();
const T = s.token;
const A = (action, b) => H.aksi(Object.assign({ action, token: T }, b));
const HARI = hari(0);
const w = () => new Date().toISOString();
const riwayat = (item) => A('riwayatItem', { item }).data;
const formItem = (nama, tanggal) => A('formStock', { tanggal: tanggal || HARI }).data.item.find((i) => i.nama === nama);
const dashboard = () => A('dashboard', {}).data;
const butir = (d, jenis) => d.perhatian.find((p) => p.jenis === jenis);

// 1. Teks dan hitungan dasar.
cek('teksCukup_', [null, 0, -1, 0.4, 0.9, 1, 2.8, 148].map((x) => H.fungsi('teksCukup_', x)).join('|') ===
  '|habis|habis|kurang dari 1 hari|kurang dari 1 hari|± 1 hari|± 2 hari|± 148 hari', [0, 0.4, 2.8].map((x) => H.fungsi('teksCukup_', x)));
cek('cukupHari_ tanpa rata-rata atau tanpa pemakaian: null', H.fungsi('cukupHari_', 5, null) === null &&
  H.fungsi('cukupHari_', 5, { rata: null }) === null && H.fungsi('cukupHari_', 5, { rata: 0 }) === null);
cek('cukupHari_ habis dan minus: 0', H.fungsi('cukupHari_', 0, { rata: 1 }) === 0 && H.fungsi('cukupHari_', -2, { rata: 1 }) === 0);
cek('cukupHari_ dibulatkan ke bawah satu angka', H.fungsi('cukupHari_', 6.5, { rata: 2.292 }) === 2.8 && H.fungsi('cukupHari_', 1, { rata: 0.5 }) === 2);

// 2. Ayam fillet: keluar 2,5 kg sehari selama 11 hari sejak stok pembuka 12 hari lalu (12 hari buka).
let r = riwayat('Ayam fillet');
cek('riwayat Ayam: total, hari, rata', r.pakai && r.pakai.total === 27.5 && r.pakai.hari === 12 && r.pakai.rata === 2.292 &&
  r.pakai.jendela === 14 && r.pakai.hariMin === 3, r.pakai);
cek('riwayat Ayam: cukup 2,8 hari', r.tercatat === 6.5 && r.cukupHari === 2.8, [r.tercatat, r.cukupHari]);
// Tomat: dipakai prep 5 × 0,5 + waste 4 × 0,3 = 3,7 kg.
r = riwayat('Tomat');
cek('riwayat Tomat: dipakai prep dan waste ikut dihitung', r.pakai.total === 3.7 && r.pakai.rata === 0.308 && r.cukupHari === 0.9, r.pakai);
r = riwayat('Air mineral');
cek('riwayat Air mineral: tidak terpakai', r.pakai && r.pakai.rata === 0 && r.cukupHari === null, r.pakai);
r = riwayat('Nasi putih');
cek('riwayat Nasi putih: tanpa rekap → pakai null', r.pakai === null && r.cukupHari === null, r.pakai);
r = riwayat('Telur');
cek('riwayat Telur minus: cukup 0', r.tercatat < 0 && r.cukupHari === 0 && r.pakai.rata === 11, [r.tercatat, r.pakai]);

// 3. Form Stock: pakaiHarian per item (null tanpa rata-rata).
cek('formStock pakaiHarian', formItem('Ayam fillet').pakaiHarian === 2.292 && formItem('Tomat').pakaiHarian === 0.308 &&
  formItem('Air mineral').pakaiHarian === 0 && formItem('Nasi putih').pakaiHarian === null,
  ['Ayam fillet', 'Tomat', 'Air mineral', 'Nasi putih'].map((x) => formItem(x).pakaiHarian));
cek('formStock kemarin: jendela sebelum kemarin (11 hari buka termasuk hari stok pembuka, 25 kg)', formItem('Ayam fillet', hari(-1)).pakaiHarian === 2.273,
  formItem('Ayam fillet', hari(-1)).pakaiHarian);

// 4. Gerakan hari ini tidak ikut rata-rata, tetapi mengubah cukup.
cek('kirim keluar Ayam hari ini', A('kirimStock', { submissionId: sid(), tanggal: HARI, kategori: 'Protein', waktuPerangkat: w(),
  baris: [{ item: 'Ayam fillet', masuk: '', keluar: 1 }] }).ok);
r = riwayat('Ayam fillet');
cek('hari ini tidak ikut rata-rata; cukup turun', r.pakai.rata === 2.292 && r.tercatat === 5.5 && r.cukupHari === 2.3, [r.pakai, r.tercatat, r.cukupHari]);

// 5. Hari libur dalam jendela tidak dihitung sebagai hari.
cek('tandai libur 3 hari lalu', A('simpanLibur', { tanggal: hari(-3), keterangan: 'Uji' }).ok);
r = riwayat('Ayam fillet');
cek('libur: 11 hari buka, rata 2,5', r.pakai.hari === 11 && r.pakai.rata === 2.5, r.pakai);
cek('hapus libur', A('hapusLibur', { tanggal: hari(-3) }).ok);
cek('libur dihapus: 12 hari lagi', riwayat('Ayam fillet').pakai.hari === 12);

// 6. Jendela 14 hari dan rekap pertama: item baru Kecap.
cek('item Kecap', A('simpanItem', { baru: true, nama: 'Kecap', kategori: 'Bumbu', satuan: 'botol', harga: 12000, stokMin: '', stokMaks: '' }).ok);
cek('stok pembuka Kecap 16 hari lalu', A('sesuaikanStock', { submissionId: sid(), item: 'Kecap', tanggal: hari(-16), stockSebenarnya: 9,
  alasan: 'Stok pembuka', catatan: '' }).ok);
const keluarKecap = (t, q) => A('kirimStock', { submissionId: sid(), tanggal: t, kategori: 'Bumbu', waktuPerangkat: w(), baris: [{ item: 'Kecap', masuk: '', keluar: q }] });
cek('keluar Kecap 15, 14, dan 1 hari lalu', keluarKecap(hari(-15), 5).ok && keluarKecap(hari(-14), 1).ok && keluarKecap(hari(-1), 1).ok);
r = riwayat('Kecap');
cek('15 hari lalu di luar jendela, 14 hari lalu di dalam; semua 14 hari dihitung', r.pakai.total === 2 && r.pakai.hari === 14 &&
  r.pakai.rata === 0.143 && r.tercatat === 2 && r.cukupHari === 13.9, r.pakai);
// Item yang rekap pertamanya baru 2 hari lalu: belum ada rata-rata.
cek('item Saus', A('simpanItem', { baru: true, nama: 'Saus tiram', kategori: 'Bumbu', satuan: 'botol', harga: 15000, stokMin: '', stokMaks: '' }).ok);
cek('stok pembuka Saus 2 hari lalu', A('sesuaikanStock', { submissionId: sid(), item: 'Saus tiram', tanggal: hari(-2), stockSebenarnya: 6,
  alasan: 'Stok pembuka', catatan: '' }).ok);
cek('keluar Saus kemarin', A('kirimStock', { submissionId: sid(), tanggal: hari(-1), kategori: 'Bumbu', waktuPerangkat: w(), baris: [{ item: 'Saus tiram', masuk: '', keluar: 5 }] }).ok);
r = riwayat('Saus tiram');
cek('2 hari buka: rata null, cukup null', r.pakai.hari === 2 && r.pakai.rata === null && r.cukupHari === null && formItem('Saus tiram').pakaiHarian === null, r.pakai);
cek('stok pembuka Saus jadi 3 hari lalu', A('sesuaikanStock', { submissionId: sid(), item: 'Saus tiram', tanggal: hari(-3), stockSebenarnya: 6,
  alasan: 'Stok pembuka', catatan: '' }).ok);
r = riwayat('Saus tiram');
// Penyesuaian 2 hari lalu (+6) tetap tercatat, jadi stock 6 + 6 − 5 = 7.
cek('3 hari buka: rata ada', r.pakai.hari === 3 && r.pakai.total === 5 && r.pakai.rata === 1.667 && r.tercatat === 7 && r.cukupHari === 4.1, [r.pakai, r.tercatat, r.cukupHari]);
cek('keluar Saus 6 hari ini', A('kirimStock', { submissionId: sid(), tanggal: HARI, kategori: 'Bumbu', waktuPerangkat: w(), baris: [{ item: 'Saus tiram', masuk: '', keluar: 6 }] }).ok);
cek('Saus: cukup 0,5 hari (1 ÷ 1,667 dibulatkan ke bawah)', riwayat('Saus tiram').cukupHari === 0.5, riwayat('Saus tiram').cukupHari);

// 7. Dashboard: hampir habis untuk item yang tidak di bawah stok minimum, urut dari yang paling cepat habis.
let d = dashboard();
let hh = butir(d, 'hampirHabis');
const nama = (b) => b.data.item.map((x) => x.nama).join(',');
cek('hampirHabis ada, tingkat tinjau', hh && hh.tingkat === 'tinjau', d.perhatian.map((p) => p.jenis));
cek('hampirHabis: Saus, lalu Ayam dan Cabai (urut cukup, lalu nama)', nama(hh) === 'Saus tiram,Ayam fillet,Cabai merah', nama(hh));
cek('hampirHabis judul dan ket', hh.judul === '3 item hampir habis' &&
  hh.ket === 'Cukup kurang dari 3 hari menurut pemakaian 14 hari terakhir: Saus tiram kurang dari 1 hari, Ayam fillet ± 2 hari, dan Cabai merah ± 2 hari.', hh);
const ayam = hh.data.item.find((x) => x.nama === 'Ayam fillet');
cek('hampirHabis data item', ayam.stock === 5.5 && ayam.cukupHari === 2.3 && ayam.pakaiHarian === 2.292 && ayam.satuan === 'kg' && ayam.stokMin === 5, ayam);
const bm = butir(d, 'bawahMinimum');
cek('item di bawah minimum tidak diulang di hampir habis', !hh.data.item.some((x) => bm.data.item.some((y) => y.nama === x.nama)), [nama(hh), nama(bm)]);
cek('bawahMinimum membawa cukupHari', bm.data.item.find((x) => x.nama === 'Tomat').cukupHari === 0.9 && bm.data.item.find((x) => x.nama === 'Telur').cukupHari === 0,
  bm.data.item);
cek('minus tidak masuk hampir habis', !/Telur|Bawang putih/.test(nama(hh)));
const iBm = d.perhatian.indexOf(bm);
cek('hampirHabis tepat sesudah bawahMinimum', d.perhatian.indexOf(hh) === iBm + 1, d.perhatian.map((p) => p.jenis));
// Stock tepat 0 dengan pemakaian: "habis".
cek('Kecap keluar 2 hari ini (stock 0)', keluarKecap(HARI, 2).ok);
hh = butir(dashboard(), 'hampirHabis');
cek('stock 0: hampir habis "habis", paling atas', hh.data.item[0].nama === 'Kecap' && hh.data.item[0].cukupHari === 0 && /: Kecap habis, /.test(hh.ket), hh);

// 8. Daftar belanja: cukupHari dan pakaiHarian di item kelompok dan itemLain.
const b = A('daftarBelanja', {}).data;
const semua = b.pemasok.flatMap((g) => g.item).concat(b.itemLain);
const it = (x) => semua.find((i) => i.nama === x);
cek('belanja Tomat', it('Tomat').cukupHari === 0.9 && it('Tomat').pakaiHarian === 0.308, it('Tomat'));
cek('itemLain Ayam dan Minyak', it('Ayam fillet').cukupHari === 2.3 && it('Minyak goreng').cukupHari === 148 && it('Minyak goreng').pakaiHarian === 0.125,
  [it('Ayam fillet'), it('Minyak goreng')].map((x) => [x.cukupHari, x.pakaiHarian]));
cek('itemLain tanpa pemakaian: null', it('Daging sapi').cukupHari === null && it('Daging sapi').pakaiHarian === 0 &&
  it('Nasi putih').cukupHari === null && it('Nasi putih').pakaiHarian === null, [it('Daging sapi'), it('Nasi putih')]);

// 9. Pengingat stock: sama dengan Dashboard.
H.opsiUji.vapid = 'kunci-uji';
const isi = H.fungsi('isiPengingatStock_', HARI);
cek('pengingat: judul menyebut hampir habis', /, 4 hampir habis/.test(isi.judul), isi.judul);
cek('pengingat: isi hampir habis', /Hampir habis: Kecap habis, Saus tiram kurang dari 1 hari, Ayam fillet ± 2 hari, dan 1 lainnya\./.test(isi.isi), isi.isi);
H.opsiUji.vapid = '';

// 10. Email harian.
cek('penerima', A('simpanPenerima', { email: ['laporan@contoh.invalid'] }).ok);
const lap = H.fungsi('jalankanLaporanHarian_', { tanggal: HARI });
cek('laporan terkirim', lap.terkirim, lap.galat);
const html = lap.html || '';
cek('email: blok hampir habis', /<b>Hampir habis: 4 item cukup kurang dari 3 hari<\/b>/.test(html), html.match(/Hampir habis[^<]*/));
cek('email: baris hampir habis', html.includes('Ayam fillet: 5,5 kg, cukup ± 2 hari (pemakaian 2,292 kg per hari)') &&
  html.includes('Kecap: 0 botol, habis (pemakaian 0,143 botol per hari)'), html.match(/Ayam fillet: [^<]*/));
cek('email: daftar belanja menyebut cukup', html.includes('Tomat: 0,3 kg (minimum 2, cukup kurang dari 1 hari), saran order') &&
  html.includes('Telur: −12 butir (minimum'), html.match(/Tomat: [^<]*/));
cek('email: Telur minus tanpa "cukup"', !/Telur: −12 butir \(minimum [^)]*cukup/.test(html), html.match(/Telur: [^<]*/g));

console.log('lulus', lulus, 'gagal', gagal);
