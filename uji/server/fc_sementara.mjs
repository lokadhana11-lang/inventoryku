// Uji server: food cost sementara (Code.gs v0.34).
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';
let lulus = 0, gagal = 0;
function cek(label, k, info) { if (k) lulus++; else { gagal++; console.log('GAGAL:', label, info !== undefined ? JSON.stringify(info).slice(0, 900) : ''); } }
const tgl = (n) => new Date(Date.now() + H.geserWaktu + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
seed();
const T = H.aksi({ action: 'login', nama: 'Budi', pin: '482915' }).data.token;
const A = (action, b) => H.aksi(Object.assign({ action, token: T }, b));
const HARI = tgl(0);
const BULAN = HARI.slice(0, 7);
let n = 0; const sid = () => 'fcs-' + (++n) + '-' + Math.random().toString(36).slice(2, 8);
const r1 = (x) => Math.round(x * 10) / 10;

const h1 = A('hpp', { bulan: BULAN }).data;
const s1 = h1.foodCostSementara;
cek('food cost tetap null (penjualan belum lengkap)', h1.foodCost === null && h1.penjualan.kurang.length > 0, h1.penjualan);
cek('ada food cost sementara', s1 && s1.hari === h1.penjualan.hari && s1.jumlahHari === h1.penjualan.jumlahHari && s1.penjualan === h1.penjualan.total, s1);
cek('semua pemakaian jatuh pada hari tercatat: sama dengan total', s1.pemakaian === h1.pemakaian.total, [s1.pemakaian, h1.pemakaian.total]);
cek('angka = pemakaian ÷ penjualan', s1.foodCost === r1(s1.pemakaian / s1.penjualan * 100), s1);
const g1 = h1.grafik[h1.grafik.length - 1];
cek('grafik bulan ini sementara', g1.sementara === s1.foodCost && g1.foodCost === null && !g1.lengkap, g1);
cek('grafik bulan lalu tanpa data', h1.grafik.slice(0, -1).every((x) => x.sementara === null && x.foodCost === null), h1.grafik);

// Waste pada hari tanpa catatan penjualan: masuk pemakaian bulan, tidak masuk sementara.
const tanpaJual = h1.penjualan.kurang[h1.penjualan.kurang.length - 1];
const w = A('kirimWaste', { submissionId: sid(), tanggal: tanpaJual, shift: 'Malam', waktuPerangkat: new Date().toISOString(), baris: [{ item: 'Ayam fillet', kategori: 'Rusak', qty: 1, alasan: '' }] });
cek('waste dicatat', w.ok, w.pesan);
const h2 = A('hpp', { bulan: BULAN }).data;
cek('pemakaian bulan naik Rp 52.000', h2.pemakaian.total === h1.pemakaian.total + 52000, [h1.pemakaian.total, h2.pemakaian.total]);
cek('sementara tidak berubah', h2.foodCostSementara.pemakaian === s1.pemakaian && h2.foodCostSementara.foodCost === s1.foodCost, h2.foodCostSementara);

// Penjualan hari itu dicatat: hari itu ikut sementara.
const p = A('simpanPenjualan', { tanggal: tanpaJual, penjualan: 500000, catatan: '', submissionId: sid(), bulan: BULAN });
const s3 = p.data.hpp.foodCostSementara;
cek('simpanPenjualan menjawab sementara baru', s3 && s3.hari === s1.hari + 1 && s3.penjualan === s1.penjualan + 500000 && s3.pemakaian === s1.pemakaian + 52000, s3);
cek('angka sementara baru', s3.foodCost === r1((s1.pemakaian + 52000) / (s1.penjualan + 500000) * 100), s3);

// Dashboard
const d = A('dashboard', { tanggal: HARI }).data;
cek('dashboard hpp.foodCostSementara', d.hpp.foodCost === null && d.hpp.foodCostSementara && d.hpp.foodCostSementara.foodCost === s3.foodCost, d.hpp);

// Rekap PDF dan email
H.pdfHtml.length = 0;
const u = A('unduhPdfRekap', { bulan: BULAN });
const html = H.pdfHtml.join('');
const persen = (x) => String(x).replace('.', ',') + '%';
cek('rekap PDF: baris food cost sementara', u.ok && html.includes(persen(s3.foodCost) + ' (sementara)'), u.pesan);
cek('rekap PDF: catatan cara hitung', /Food cost sementara [\d,]+% dihitung dari \d+ hari yang penjualannya tercatat saja/.test(html));
const dr = H.fungsi('dataRekapBulan_', BULAN);
const surel = H.fungsi('htmlEmailRekap_', dr, { outlet: 'Dapur', alamat: '' });
cek('email rekap: sementara', surel.includes('sementara <b>' + persen(s3.foodCost) + '</b>'), surel.match(/Food cost[^<]*/g));

// Penjualan lengkap: food cost tetap, sementara hilang.
A('hpp', { bulan: BULAN }).data.penjualan.kurang.forEach((t) => {
  const x = A('simpanPenjualan', { tanggal: t, penjualan: 0, catatan: 'tutup', submissionId: sid() });
  if (!x.ok) console.log('gagal simpan', t, x.pesan);
});
const h4 = A('hpp', { bulan: BULAN }).data;
cek('lengkap: food cost dihitung, tanpa sementara', h4.foodCost !== null && h4.foodCostSementara === null && h4.grafik[5].sementara === null, [h4.foodCost, h4.foodCostSementara]);
cek('lengkap: angka tetap = pemakaian bulan ÷ penjualan', h4.foodCost === r1(h4.pemakaian.total / h4.penjualan.total * 100), h4.foodCost);
H.pdfHtml.length = 0;
A('unduhPdfRekap', { bulan: BULAN });
cek('rekap lengkap tanpa kata sementara', !H.pdfHtml.join('').includes('sementara'));
const d2 = A('dashboard', { tanggal: HARI }).data;
cek('dashboard lengkap', d2.hpp.foodCost === h4.foodCost && d2.hpp.foodCostSementara === null, d2.hpp);

// Bulan tanpa penjualan sama sekali: tanpa sementara.
H.aturGeser(-40 * 86400000);
const lalu = tgl(0).slice(0, 7);
H.aturGeser(0);
const h5 = A('hpp', { bulan: lalu }).data;
cek('bulan tanpa penjualan: tanpa sementara', h5.foodCost === null && h5.foodCostSementara === null, h5.foodCostSementara);
console.log('lulus', lulus, 'gagal', gagal, 'ERR log:', JSON.stringify(H.logs.filter((l) => /^ERR/.test(l)).slice(0, 3)));
