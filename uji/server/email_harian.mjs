// Uji server: email harian dengan barang masuk, penjualan, dan food cost (Code.gs v0.35).
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';
let lulus = 0, gagal = 0;
function cek(label, k, info) { if (k) lulus++; else { gagal++; console.log('GAGAL:', label, info !== undefined ? JSON.stringify(info).slice(0, 1200) : ''); } }
const tgl = (n) => new Date(Date.now() + H.geserWaktu + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
seed();
const T = H.aksi({ action: 'login', nama: 'Budi', pin: '482915' }).data.token;
const A = (action, b) => H.aksi(Object.assign({ action, token: T }, b));
const HARI = tgl(0);
let n = 0; const sid = () => 'em-' + (++n) + '-' + Math.random().toString(36).slice(2, 8);
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const pendek = (t) => Number(t.slice(8)) + ' ' + BLN[Number(t.slice(5, 7)) - 1];
const persen = (x) => String(Math.round(x * 10) / 10).replace('.', ',') + '%';
const lapor = (t) => H.fungsi('jalankanLaporanHarian_', { tanggal: t });
const bagian = (html, judul) => { const i = html.indexOf('>' + judul + '</h2>'); if (i < 0) return ''; const j = html.indexOf('<h2', i); return html.slice(i, j < 0 ? undefined : j); };
cek('penerima', A('simpanPenerima', { email: ['laporan@contoh.invalid'] }).ok);

// Barang masuk hari ini: dua pemasok dan tanpa pemasok.
const w = new Date().toISOString();
cek('kirim Sayur', A('kirimStock', { submissionId: sid(), tanggal: HARI, kategori: 'Sayur', waktuPerangkat: w, pemasok: 'Sumber Segar', baris: [{ item: 'Tomat', masuk: 5, keluar: '', satuanMasuk: 'dasar', hargaBeli: 16000 }] }).ok);
cek('kirim Bumbu', A('kirimStock', { submissionId: sid(), tanggal: HARI, kategori: 'Bumbu', waktuPerangkat: w, baris: [{ item: 'Cabai merah', masuk: 2, keluar: '', satuanMasuk: 'dasar' }, { item: 'Bawang putih', masuk: '', keluar: 0.2 }] }).ok);
cek('kirim Protein', A('kirimStock', { submissionId: sid(), tanggal: HARI, kategori: 'Protein', waktuPerangkat: w, pemasok: 'Toko Ayam Jaya', baris: [{ item: 'Ayam fillet', masuk: 4, keluar: 1, satuanMasuk: 'dasar', hargaBeli: 52000 }] }).ok);
const h1 = lapor(HARI);
cek('laporan terkirim', h1.terkirim, h1.galat);
const bm = bagian(h1.html, 'Barang masuk');
cek('barang masuk: total dan tanpa harga', /<b>Total Rp 288\.000<\/b> dari harga beli yang dicatat; 1 baris tanpa harga beli/.test(bm), bm);
cek('barang masuk: per pemasok urut nama, tanpa pemasok terakhir',
  /Sumber Segar<\/b> \(Rp 80\.000\): Tomat 5 kg × Rp 16\.000.*Toko Ayam Jaya<\/b> \(Rp 208\.000\): Ayam fillet 4 kg × Rp 52\.000.*Tanpa pemasok<\/b>: Cabai merah 2 kg/.test(bm), bm);
cek('barang masuk: baris keluar saja tidak ikut', !/Bawang putih/.test(bm), bm);
cek('urutan: Barang masuk sesudah Stock, sebelum Suhu', h1.html.indexOf('>Stock</h2>') < h1.html.indexOf('>Barang masuk</h2>') && h1.html.indexOf('>Barang masuk</h2>') < h1.html.indexOf('>Suhu</h2>'));

const pj = bagian(h1.html, 'Penjualan dan food cost');
const hpp = A('hpp', { bulan: HARI.slice(0, 7) }).data;
cek('penjualan belum dicatat', /Penjualan hari ini belum dicatat\. Catat dari Dashboard → HPP dan food cost\./.test(pj), pj);
cek('tanpa baris porsi saat penjualan belum dicatat', !/porsi/.test(pj), pj);
const jHari = Number(HARI.slice(8));
cek('food cost sementara sampai hari ini', new RegExp('Food cost Oktober sampai ' + pendek(HARI) + ': sementara <b>' + persen(hpp.foodCostSementara.foodCost).replace('.', '\\.') +
  '</b> \\(penjualan baru tercatat ' + hpp.foodCostSementara.hari + ' dari ' + jHari + ' hari; target 35%\\)').test(pj), [pj, hpp.foodCostSementara]);
cek('urutan: Penjualan sebelum Untuk Head Kitchen', h1.html.indexOf('>Penjualan dan food cost</h2>') < h1.html.indexOf('>Untuk Head Kitchen dan Manager</h2>'));

// Penjualan hari ini dicatat dengan porsi.
cek('simpan penjualan', A('simpanPenjualan', { tanggal: HARI, penjualan: 1000000, catatan: 'ramai', submissionId: sid(), porsi: [{ menu: 'Ayam geprek', porsi: 30 }, { menu: 'Telur balado', porsi: 0 }] }).ok);
const pj2 = bagian(lapor(HARI).html, 'Penjualan dan food cost');
cek('penjualan hari ini', /Penjualan hari ini <b>Rp 1\.000\.000<\/b> \(ramai\)/.test(pj2), pj2);
cek('porsi tanpa menu nol', /30 porsi terjual: Ayam geprek 30</.test(pj2), pj2);
cek('sementara kini 12 hari', new RegExp('tercatat ' + (hpp.foodCostSementara.hari + 1) + ' dari ' + jHari + ' hari').test(pj2), pj2);

// Tanggal lalu: barang masuk dengan satu pemasok (tanpa nilai per pemasok), penjualan dan porsi tercatat.
const t3 = tgl(-3);
const h3 = lapor(t3).html;
const bm3 = bagian(h3, 'Barang masuk');
cek('tanggal lalu: satu pemasok', /<b>Total Rp 432\.000<\/b><\/p>/.test(bm3) && /Toko Ayam Jaya<\/b>: Ayam fillet 8 kg × Rp 54\.000/.test(bm3), bm3);
const pj3 = bagian(h3, 'Penjualan dan food cost');
cek('tanggal lalu: penjualan dan porsi', /Penjualan hari ini <b>Rp 980\.000<\/b>/.test(pj3) && /37 porsi terjual: Ayam geprek 25, Telur balado 12/.test(pj3), pj3);
cek('tanggal lalu: food cost sampai tanggal itu', new RegExp('Food cost Oktober sampai ' + pendek(t3) + ': sementara').test(pj3), pj3);
// Tanpa barang masuk.
cek('tanpa barang masuk', /Tidak ada barang masuk tercatat\./.test(bagian(lapor(tgl(-1)).html, 'Barang masuk')));
// Barang masuk tanpa harga beli sama sekali.
A('kirimStock', { submissionId: sid(), tanggal: tgl(-2), kategori: 'Sayur', waktuPerangkat: w, baris: [{ item: 'Tomat', masuk: 1, keluar: '', satuanMasuk: 'dasar' }] });
const bm2 = bagian(lapor(tgl(-2)).html, 'Barang masuk');
cek('tanpa harga beli: tanpa total, catatan', !/Total/.test(bm2) && /Tanpa pemasok<\/b>: Tomat 1 kg/.test(bm2) && /Harga beli belum dicatat\./.test(bm2), bm2);

// Di atas target: merah tebal.
A('simpanOutletJadwal', { targetFoodCost: 10 });
const pj4 = bagian(lapor(HARI).html, 'Penjualan dan food cost');
cek('di atas target merah', /sementara <b style="color:[^"]+">[\d,]+%<\/b>.*target 10%\)/.test(pj4), pj4);
A('simpanOutletJadwal', { targetFoodCost: 35 });

// Penjualan lengkap: food cost tetap.
A('hpp', { bulan: HARI.slice(0, 7) }).data.penjualan.kurang.forEach((t) => A('simpanPenjualan', { tanggal: t, penjualan: 0, catatan: '', submissionId: sid() }));
const pj5 = bagian(lapor(HARI).html, 'Penjualan dan food cost');
const fc = H.fungsi('foodCostBulan_', Object.assign(H.fungsi('konteksHpp_'), { hari: tgl(1) }), HARI.slice(0, 7));
cek('lengkap: food cost tetap sampai hari ini', fc.foodCost != null && pj5.includes('Food cost Oktober sampai ' + pendek(HARI) + ': <b>' + persen(fc.foodCost) + '</b> (target 35%)') && !/sementara/.test(pj5), [pj5, fc.foodCost]);

// Hari terakhir bulan: rentang sampai akhir bulan.
const akhirSep = HARI.slice(0, 4) + '-09-30';
const pjS = bagian(lapor(akhirSep).html, 'Penjualan dan food cost');
cek('bulan lalu tanpa penjualan', /Food cost September sampai 30 Sep: belum dihitung, belum ada penjualan tercatat\./.test(pjS), pjS);

// Outlet yang tidak pernah mencatat penjualan: tanpa bagian.
const sh = H.ss.getSheetByName('Data_Penjualan');
sh.deleteRows(2, sh.getLastRow() - 1);
const h6 = lapor(HARI).html;
cek('tanpa penjualan pernah dicatat: tanpa bagian', !/Penjualan dan food cost/.test(h6) && /Barang masuk/.test(h6));
// Laporan dari jadwal tetap sama untuk bagian lain.
cek('bagian lama tetap', ['Form hari ini', 'Stock', 'Suhu', 'Waste', 'Prep list', 'Masa simpan', 'Untuk Head Kitchen dan Manager', 'Lampiran'].every((j) => h6.includes('>' + j + '</h2>')));
console.log('lulus', lulus, 'gagal', gagal, 'ERR log:', JSON.stringify(H.logs.filter((l) => /^ERR/.test(l)).slice(0, 3)));
