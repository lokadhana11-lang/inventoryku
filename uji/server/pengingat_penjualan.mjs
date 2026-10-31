// Uji server: pengingat penjualan dan porsi di Dashboard juga memeriksa bulan lalu (Code.gs v0.41), apa pun tanggal uji dijalankan.
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';
let lulus = 0, gagal = 0;
function cek(label, k, info) { if (k) lulus++; else { gagal++; console.log('GAGAL:', label, info !== undefined ? JSON.stringify(info).slice(0, 900) : ''); } }
const HARI_MS = 86400000;
const tgl = (n) => new Date(Date.now() + H.geserWaktu + n * HARI_MS).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const namaBulan = (t) => BULAN[Number(t.slice(5, 7)) - 1];
seed();
let n = 0; const sid = () => 'pj-' + (++n) + '-' + Math.random().toString(36).slice(2, 8);
let T = null;
const masuk = () => { T = H.aksi({ action: 'login', nama: 'Budi', pin: '482915' }).data.token; };
const A = (action, b) => H.aksi(Object.assign({ action, token: T }, b));
const PORSI = [{ menu: 'Ayam geprek', porsi: 20 }, { menu: 'Telur balado', porsi: 10 }];
const jual = (tanggal, porsi = PORSI) => {
  const r = A('simpanPenjualan', { tanggal, penjualan: 900000, catatan: '', submissionId: sid(), porsi });
  if (!r.ok) cek('catat penjualan ' + tanggal, false, r.pesan);
};
const pengingat = () => A('dashboard', { tanggal: tgl(0) }).data.perhatian.filter((p) => p.jenis === 'penjualan');
// Hari pertama bulan berikut dari tanggal t, dalam jumlah hari dari hari ini (geser 0).
const keTanggal = (target) => {
  H.aturGeser(0);
  const hariIni = tgl(0);
  const selisih = Math.round((Date.UTC(...target.split('-').map((x, i) => Number(x) - (i === 1 ? 1 : 0))) -
    Date.UTC(...hariIni.split('-').map((x, i) => Number(x) - (i === 1 ? 1 : 0)))) / HARI_MS);
  H.aturGeser(selisih * HARI_MS);
  masuk();
  if (tgl(0) !== target) cek('jam uji di ' + target, false, tgl(0));
};
const awalBulanBerikut = (t) => {
  const [y, m] = t.split('-').map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
};

masuk();
const D0 = tgl(0); // seed mencatat penjualan sampai kemarin
const B1 = awalBulanBerikut(D0); // tanggal 1 bulan berikut
const AKHIR = new Date(Date.parse(B1) - HARI_MS).toISOString().slice(0, 10); // hari terakhir bulan D0
// Semua hari sampai sebelum hari terakhir bulan itu tercatat, jadi hanya hari terakhir yang kosong.
for (let d = D0; d < AKHIR; d = new Date(Date.parse(d) + HARI_MS).toISOString().slice(0, 10)) jual(d);

// 1. Tanggal 1: kemarin (hari terakhir bulan lalu) belum dicatat → "Penjualan kemarin belum dicatat"
keTanggal(B1);
let p = pengingat();
cek('tanggal 1: butir penjualan kemarin', p.length === 1 && p[0].judul === 'Penjualan kemarin belum dicatat', p);
cek('tanggal 1: tanggal dan bulan lalu disebut', p[0] && p[0].ket === 'Tanggal ' + Number(AKHIR.slice(8)) + '. Food cost ' + namaBulan(AKHIR) +
  ' dihitung setelah semua hari tercatat.', p[0] && p[0].ket);
cek('tanggal 1: tautan ke tanggal itu', p[0] && p[0].data.tanggal === AKHIR, p[0]);

// 2. Tanggal 3: hari terakhir bulan lalu serta tanggal 1 dan 2 bulan ini
const B3 = new Date(Date.parse(B1) + 2 * HARI_MS).toISOString().slice(0, 10);
keTanggal(B3);
p = pengingat();
cek('tanggal 3: tiga hari', p.length === 1 && p[0].judul === 'Penjualan 3 hari belum dicatat', p);
cek('tanggal 3: dua bulan dengan namanya', p[0] && p[0].ket === 'Tanggal ' + Number(AKHIR.slice(8)) + ' ' + namaBulan(AKHIR) + ' serta 1 dan 2 ' +
  namaBulan(B1) + '. Food cost ' + namaBulan(AKHIR) + ' dan bulan ini dihitung setelah semua hari tercatat.', p[0] && p[0].ket);

// 3. Hari terakhir bulan lalu dicatat tanpa porsi: tetap diingatkan untuk porsinya
jual(AKHIR, []);
p = pengingat();
cek('porsi bulan lalu: tetap disebut', p.length === 1 && p[0].judul === 'Penjualan 3 hari belum dicatat' &&
  /\(porsi per menu tanggal \d+\)/.test(p[0].ket) && p[0].ket.indexOf('(porsi per menu tanggal ' + Number(AKHIR.slice(8)) + ')') >= 0, p[0] && p[0].ket);

// 4. Bulan lalu lengkap: teks seperti sebelum v0.41
const r = A('simpanPenjualan', { tanggal: AKHIR, penjualan: 900000, catatan: '', submissionId: sid(), porsi: PORSI });
cek('lengkapi porsi bulan lalu', r.ok, r.pesan);
p = pengingat();
cek('bulan lalu lengkap: hanya bulan ini', p.length === 1 && p[0].judul === 'Penjualan 2 hari belum dicatat' &&
  p[0].ket === 'Tanggal 1 dan 2. Food cost bulan ini dihitung setelah semua hari tercatat.', p[0]);
jual(B1);
jual(new Date(Date.parse(B1) + HARI_MS).toISOString().slice(0, 10));
cek('semua tercatat: tanpa butir', pengingat().length === 0, pengingat());

// 5. Dua bulan kemudian: hari bulan yang sudah lewat dua bulan tidak diingatkan lagi
const B2 = awalBulanBerikut(B1);
keTanggal(B2);
p = pengingat();
const AKHIR2 = new Date(Date.parse(B2) - HARI_MS).toISOString().slice(0, 10);
cek('tanggal 1 bulan berikutnya: hanya bulan lalu', p.length === 1 && p[0].data.tanggal === AKHIR2 &&
  new RegExp('Food cost ' + namaBulan(AKHIR2) + ' dihitung').test(p[0].ket) && !new RegExp(namaBulan(AKHIR) + '\\b').test(p[0].ket), p[0]);

console.log('lulus', lulus, 'gagal', gagal);
