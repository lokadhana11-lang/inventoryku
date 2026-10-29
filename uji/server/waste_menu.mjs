// Uji server: waste per porsi menu (Code.gs v0.37).
import crypto from 'node:crypto';
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';
let lulus = 0, gagal = 0;
const cek = (label, k, x) => { if (k) lulus++; else { gagal++; console.log('GAGAL:', label, x !== undefined ? JSON.stringify(x).slice(0, 900) : ''); } };
const s = seed();
const T = H.aksi({ action: 'login', nama: 'Budi', pin: '482915' }).data.token;
const TR = H.aksi({ action: 'login', nama: 'Rina', pin: '730264' }).data.token;
const A = (action, b, tok = T) => H.aksi(Object.assign({ action, token: tok }, b));
const hari = (n) => new Date(Date.now() + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const HARI = hari(0), KEMARIN = hari(-1);
const uid = () => crypto.randomUUID();
const akhir = (tg, nama) => A('formStock', { tanggal: tg }).data.item.find((i) => i.nama === nama).akhir;
const waste = (tg, baris, tok = T) => A('kirimWaste', { submissionId: uid(), tanggal: tg, shift: 'Malam', waktuPerangkat: new Date().toISOString(), baris }, tok);
const barisWaste = () => {
  const v = H.ss.getSheetByName('Data_Waste').getDataRange().getValues();
  return v.slice(1).map((r) => Object.fromEntries(v[0].map((j, i) => [j, r[i]])));
};
const hppHari = (nama, tg) => H.fungsi('hppSemuaMenu_', tg, true).find((m) => m.nama === nama).hpp;

// 1. formWaste
const fw = A('formWaste', { tanggal: HARI }).data;
const ag = fw.menu.find((m) => m.nama === 'Ayam geprek');
cek('formWaste: menuSiap dan menu aktif dengan HPP', fw.menuSiap === true && ag && ag.hpp === hppHari('Ayam geprek', HARI) && ag.hpp > 0, fw.menu);
const fwS = A('formWaste', { tanggal: HARI }, TR).data;
cek('formWaste Staff: menu tanpa HPP', fwS.menuSiap === true && fwS.menu.length === fw.menu.length && fwS.menu.every((m) => m.hpp === undefined), fwS.menu);

// 2. kirim menu + item kemarin
const ayam0 = akhir(KEMARIN, 'Ayam fillet'), nasi0 = akhir(KEMARIN, 'Nasi putih'), tomat0 = akhir(KEMARIN, 'Tomat');
const hppK = hppHari('Ayam geprek', KEMARIN);
const r1 = waste(KEMARIN, [{ menu: 'ayam geprek', kategori: 'Kesalahan Order', qty: 2, alasan: 'Pesanan meja 4 tertukar' }, { item: 'Tomat', kategori: 'Rusak', qty: 0.5, alasan: '' }]);
cek('kirim menu + item berhasil', r1.ok && r1.data.jumlah === 2, r1);
const bw = barisWaste();
const bm = bw.find((b) => b['Item / Produk'] === 'Ayam geprek');
cek('baris menu: porsi, satuan, HPP, estimasi, Menu Ya', bm && bm.Qty === 2 && bm.Satuan === 'porsi' && bm['Harga Satuan (Rp)'] === hppK && bm['Estimasi Kerugian (Rp)'] === Math.round(2 * hppK) && bm.Menu === 'Ya' && bm['Kategori Waste'] === 'Kesalahan Order', bm);
const bt = bw.filter((b) => b['Item / Produk'] === 'Tomat').pop();
cek('baris item: Menu kosong', bt && bt.Menu === '', bt);
cek('stock bahan menu tidak bergerak', akhir(KEMARIN, 'Ayam fillet') === ayam0 && akhir(KEMARIN, 'Nasi putih') === nasi0, [ayam0, akhir(KEMARIN, 'Ayam fillet')]);
cek('stock item waste turun', Math.abs(akhir(KEMARIN, 'Tomat') - (tomat0 - 0.5)) < 1e-9);
cek('Stock_Harian tanpa rekap Ayam geprek', !H.ss.getSheetByName('Stock_Harian').getDataRange().getValues().some((r) => r.includes('Ayam geprek')));
cek('formWaste kiriman memuat menu', r1.data.form.kiriman.baris.some((b) => b.item === 'Ayam geprek' && b.satuan === 'porsi' && b.qty === 2));

// 3. penolakan
cek('porsi pecahan ditolak', /bilangan bulat/.test(waste(KEMARIN, [{ menu: 'Ayam geprek', kategori: 'Rusak', qty: 1.5 }]).pesan || ''));
cek('porsi 0 ditolak', /lebih dari 0/.test(waste(KEMARIN, [{ menu: 'Ayam geprek', kategori: 'Rusak', qty: 0 }]).pesan || ''));
cek('porsi > 1000 ditolak', /terlalu banyak/.test(waste(KEMARIN, [{ menu: 'Ayam geprek', kategori: 'Rusak', qty: 1001 }]).pesan || ''));
cek('menu tak dikenal ditolak', /tidak ada di daftar menu/.test(waste(KEMARIN, [{ menu: 'Soto', kategori: 'Rusak', qty: 1 }]).pesan || ''));
cek('Lainnya tanpa alasan ditolak', /alasan/.test(waste(KEMARIN, [{ menu: 'Ayam geprek', kategori: 'Lainnya', qty: 1 }]).pesan || ''));
cek('ditolak tidak menulis', barisWaste().length === bw.length);

// 4. Staff boleh, menu nonaktif dari antrean diterima
const rS = waste(HARI, [{ menu: 'Telur balado', kategori: 'Lainnya', qty: 1, alasan: 'Dikembalikan pelanggan: terlalu pedas' }], TR);
cek('Staff kirim menu', rS.ok && rS.data.form.kiriman.baris.every((b) => b.estimasi === undefined), rS);
A('aturMenuAktif', { nama: 'Telur balado', aktif: false });
cek('menu nonaktif tidak di formWaste', !A('formWaste', { tanggal: HARI }).data.menu.some((m) => m.nama === 'Telur balado'));
cek('menu nonaktif dari antrean diterima', waste(HARI, [{ menu: 'Telur balado', kategori: 'Rusak', qty: 1 }], TR).ok);
A('aturMenuAktif', { nama: 'Telur balado', aktif: true });

// 5. Riwayat dan koreksi
const rw = A('riwayat', { formId: 'WASTE', dari: KEMARIN, sampai: KEMARIN, tampilan: 'catatan' }).data;
const rb = rw.kiriman.flatMap((k) => k.baris).find((b) => b.nilai.item === 'Ayam geprek');
const rbT = rw.kiriman.flatMap((k) => k.baris).find((b) => b.nilai.item === 'Tomat');
cek('Riwayat: baris menu bertanda menu, satuan porsi', rb && rb.menu === true && rb.satuan === 'porsi' && rb.nilai.estimasi === Math.round(2 * hppK), rb);
cek('Riwayat: baris item tanpa tanda menu', rbT && rbT.menu === undefined, rbT);
const k1 = A('koreksi', { formId: 'WASTE', rowId: rb.rowId, nilai: { qty: '3' } });
cek('koreksi porsi 3', k1.ok && k1.data.kiriman.baris.find((b) => b.rowId === rb.rowId).nilai.estimasi === Math.round(3 * hppK), k1);
cek('koreksi porsi pecahan ditolak', /bilangan bulat/.test(A('koreksi', { formId: 'WASTE', rowId: rb.rowId, nilai: { qty: '2,5' } }).pesan || ''));
cek('stock tetap sesudah koreksi', akhir(KEMARIN, 'Ayam fillet') === ayam0);
const rwS = A('riwayat', { formId: 'WASTE', dari: KEMARIN, sampai: KEMARIN, tampilan: 'catatan' }, TR).data;
cek('Riwayat Staff tanpa rupiah, tetap bertanda menu', rwS.kiriman.flatMap((k) => k.baris).some((b) => b.menu === true) && !rwS.kolom.some((k) => k.jenis === 'rupiah'));

// 6. kartu stok tidak memuat waste menu
const tr = A('riwayatItem', { item: 'Ayam fillet' }).data.transaksi;
cek('kartu stok Ayam fillet tanpa waste menu', !tr.some((x) => x.jenis === 'Waste'), tr.filter((x) => x.jenis === 'Waste'));

// 7. Menu bernama sama dengan item: stock item tidak bergerak, kartu stok dan hapus item tidak terganggu
cek('menu bernama Tomat', A('simpanMenu', { baru: true, nama: 'Tomat', hargaJual: 10000, bahan: [{ item: 'Tomat', qty: 0.2 }] }).ok);
const tomat1 = akhir(HARI, 'Tomat');
const tPorsi = waste(HARI, [{ menu: 'Tomat', kategori: 'Kesalahan Order', qty: 2 }]);
cek('waste menu Tomat', tPorsi.ok, tPorsi);
cek('stock item Tomat tidak bergerak oleh menu Tomat', akhir(HARI, 'Tomat') === tomat1);
A('sesuaikanStock', { submissionId: uid(), item: 'Tomat', tanggal: HARI, stockSebenarnya: tomat1 + 1, alasan: 'Hasil hitung ulang', catatan: '' });
cek('hitung ulang Tomat sesudahnya tetap benar', Math.abs(akhir(HARI, 'Tomat') - (tomat1 + 1)) < 1e-9, [akhir(HARI, 'Tomat'), tomat1]);
cek('kartu stok Tomat tanpa baris menu', !A('riwayatItem', { item: 'Tomat' }).data.transaksi.some((x) => x.tanggal === HARI && x.jenis === 'Waste'));
A('simpanItem', { baru: true, nama: 'Es teh', kategori: 'Bumbu', satuan: 'kg', satuanBesar: '', isiSatuanBesar: '', harga: '', stokMin: '', stokMaks: '' });
A('simpanMenu', { baru: true, nama: 'Es teh', hargaJual: 5000, bahan: [{ item: 'Tomat', qty: 0.01 }] });
waste(HARI, [{ menu: 'Es teh', kategori: 'Rusak', qty: 1 }]);
A('aturItemAktif', { nama: 'Es teh', aktif: false });
const esTeh = A('daftarItem', {}).data.item.find((i) => i.nama === 'Es teh');
cek('item Es teh tetap bisa dihapus (waste menu bukan catatan item)', esTeh && esTeh.sebabTidakBisaHapus === '' , esTeh);
const em = H.fungsi('ringkasWasteHari_', HARI);
cek('email: menu Tomat dan item Tomat tidak dijumlah', JSON.stringify(em).match(/"item":"Tomat"/g).length >= 1, em);

// 8. HPP: wasteMenu dilaporkan, porsi terbuang di teoritis; food cost tidak berubah karena waste menu
const bulan = KEMARIN.slice(0, 7);
const h = A('hpp', { bulan }).data;
cek('hpp.pemakaian.wasteMenu kemarin (3 porsi Ayam geprek)', h.pemakaian.wasteMenu && h.pemakaian.wasteMenu.porsi >= 3 && h.pemakaian.wasteMenu.nilai >= Math.round(3 * hppK), h.pemakaian.wasteMenu);
cek('hpp.teoritis.wastePorsi', h.teoritis.wastePorsi && h.teoritis.wastePorsi.porsi === h.pemakaian.wasteMenu.porsi, h.teoritis.wastePorsi);
const kode = H.fungsi('pemakaianBahan_', H.fungsi('konteksHpp_'), bulan + '-01', KEMARIN);
cek('wasteBarangJadi tidak memuat menu', kode.wasteBarangJadi === h.pemakaian.wasteBarangJadi && kode.total === h.pemakaian.total);

// 9. Dashboard dan rekap
const d = A('dashboard', { tanggal: KEMARIN }).data;
const rpK = barisWaste().filter((b) => b.Tanggal instanceof Date && b.Tanggal.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) === KEMARIN).reduce((a, b) => a + (Number(b['Estimasi Kerugian (Rp)']) || 0), 0);
cek('Dashboard waste Rp memuat menu', d.ringkas.wasteRp === Math.round(rpK), [d.ringkas.wasteRp, rpK]);
H.pdfHtml.length = 0;
cek('unduh rekap', A('unduhPdfRekap', { bulan }).ok);
cek('rekap: catatan waste menu', /Waste menu \d+ porsi/.test(H.pdfHtml.join('')), H.pdfHtml.join('').match(/Waste[^<]{0,120}/g));
const dr = H.fungsi('dataRekapBulan_', bulan);
cek('rekap: Ayam geprek di item waste dengan satuan porsi', dr.waste.item.some((x) => x.item === 'Ayam geprek' && x.satuan === 'porsi'), dr.waste.item);

// 10. PDF harian Waste
H.pdfHtml.length = 0;
cek('PDF waste kemarin', A('unduhPdf', { formId: 'WASTE', tanggal: KEMARIN }).ok && /Ayam geprek/.test(H.pdfHtml.join('')) && /porsi/.test(H.pdfHtml.join('')));

// 11. Sheet tanpa kolom Menu
{
  const sh = H.ss.getSheetByName('Data_Waste');
  const judul = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  sh.getRange(1, judul.indexOf('Menu') + 1).setValue('Kolom Lain');
  const f = A('formWaste', { tanggal: HARI }).data;
  cek('tanpa kolom: menuSiap false, menu kosong', f.menuSiap === false && f.menu.length === 0);
  const r = waste(HARI, [{ menu: 'Ayam geprek', kategori: 'Rusak', qty: 1 }]);
  cek('tanpa kolom: menu ditolak dengan petunjuk', !r.ok && /setupSpreadsheet/.test(r.pesan), r);
  cek('tanpa kolom: item tetap jalan', waste(HARI, [{ item: 'Tomat', kategori: 'Rusak', qty: 0.1 }]).ok);
  sh.getRange(1, judul.indexOf('Menu') + 1).setValue('Menu');
}
// 12. setupSpreadsheet ulang tidak menggandakan kolom
H.fungsi('setupSpreadsheet');
const j2 = H.ss.getSheetByName('Data_Waste').getRange(1, 1, 1, H.ss.getSheetByName('Data_Waste').getLastColumn()).getValues()[0];
cek('setupSpreadsheet: satu kolom Menu', j2.filter((x) => x === 'Menu').length === 1, j2);

console.log('lulus', lulus, 'gagal', gagal);
process.exit(gagal ? 1 : 0);
