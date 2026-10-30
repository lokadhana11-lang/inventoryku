// Uji server: item yang dinonaktifkan stock-nya dinolkan, PDF Stock tanpa item nonaktif, baris nonaktif abu-abu di tab master (Code.gs v0.40).
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';
let gagal = 0, lulus = 0;
const cek = (k, label, x) => { if (k) lulus++; else { gagal++; console.log('GAGAL:', label, x !== undefined ? JSON.stringify(x).slice(0, 600) : ''); } };
const s = seed();
const T = s.token;
const TR = H.aksi({ action: 'login', nama: 'Rina', pin: '730264' }).data.token;
const hari = (n) => new Date(Date.now() + H.geserWaktu + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const uid = () => crypto.randomUUID();
const hariIni = hari(0);
const A = (action, b, tok = T) => H.aksi(Object.assign({ action, token: tok }, b));
const item = (nama) => A('daftarItem', {}).data.item.find((i) => i.nama === nama);
const nilai = () => A('dashboard', { tanggal: hariIni }).data.nilaiStock;
const penyesuaian = () => {
  const v = H.ss.getSheetByName('Data_Penyesuaian').getDataRange().getValues();
  return v.slice(1).filter((b) => b[0] !== '').map((b) => Object.fromEntries(v[0].map((j, i) => [j, b[i]])));
};
const dinolkanRow = (nama) => penyesuaian().find((b) => b['Nama Item'] === nama && /dinonaktifkan/.test(b['Catatan']));
const aturAktifLangsung = (nama, aktif) => {
  // Seperti item yang dinonaktifkan sebelum Code.gs v0.40: kolom Aktif diubah tanpa menolkan stock.
  const sh = H.ss.getSheetByName('M_Item');
  const v = sh.getDataRange().getValues();
  const r = v.findIndex((b) => b[0] === nama);
  sh.getRange(r + 1, v[0].indexOf('Aktif') + 1).setValue(aktif);
};
const pdfStock = (kategori) => {
  H.pdfHtml.length = 0;
  const r = A('unduhPdf', Object.assign({ formId: 'STOCK', tanggal: hariIni }, kategori ? { kategori } : {}));
  return { r, html: H.pdfHtml.join('') };
};

// 1. Item dengan stock: dinolkan saat dinonaktifkan
{
  cek(A('daftarItem', {}).data.nolkanSaatNonaktif === true, 'daftarItem.nolkanSaatNonaktif');
  const awal = nilai();
  const jumlahAwal = penyesuaian().length;
  cek(item('Daging sapi').stock === 4, 'stock awal Daging sapi 4', item('Daging sapi'));
  const r = A('aturItemAktif', { nama: 'Daging sapi', aktif: false });
  cek(r.ok && r.data.diubah.aktif === false, 'nonaktifkan Daging sapi', r.pesan);
  cek(r.ok && JSON.stringify(r.data.dinolkan) === '{"stock":4,"satuan":"kg"}', 'dinolkan: 4 kg', r.data && r.data.dinolkan);
  const it = r.data.item.find((i) => i.nama === 'Daging sapi');
  cek(it.aktif === false && it.stock === 0, 'daftarItem: nonaktif, stock 0', it);
  const p = penyesuaian();
  const baru = dinolkanRow('Daging sapi') || {};
  cek(p.length === jumlahAwal + 1, 'satu baris penyesuaian baru', p.length - jumlahAwal);
  const tgl = baru['Tanggal'] instanceof Date ? baru['Tanggal'].toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) : String(baru['Tanggal']);
  cek(baru['Nama Item'] === 'Daging sapi' && tgl === hariIni && baru['Stock Tercatat'] === 4 && baru['Stock Sebenarnya'] === 0 &&
    baru['Selisih'] === -4 && baru['Nilai Selisih (Rp)'] === -540000 && baru['Alasan'] === 'Lainnya' &&
    baru['Catatan'] === 'Stock dinolkan karena item dinonaktifkan.' && baru['submitted_by'] === 'Budi' && baru['Satuan'] === 'kg' &&
    /^[0-9a-f-]{36}$/.test(String(baru['submission_id'])), 'isi baris penyesuaian', baru);
  const sesudah = nilai();
  cek(sesudah.total === awal.total - 540000, 'nilai stock turun 4 × 135.000', [awal.total, sesudah.total]);
  const riwayat = A('riwayatItem', { item: 'Daging sapi' });
  cek(riwayat.ok && riwayat.data.tercatat === 0 && JSON.stringify(riwayat.data).includes('Stock dinolkan karena item dinonaktifkan.'),
    'riwayat item mencatat penyesuaian', riwayat.ok ? JSON.stringify(riwayat.data).slice(0, 400) : riwayat.pesan);
}

// 2. Sudah nonaktif dan stock 0: tidak ada penyesuaian lagi; aktif lagi tetap 0
{
  const n = penyesuaian().length;
  const r = A('aturItemAktif', { nama: 'Daging sapi', aktif: false });
  cek(r.ok && r.data.dinolkan === null && penyesuaian().length === n, 'nonaktif lagi tanpa stock: dinolkan null', r.data && r.data.dinolkan);
  const a = A('aturItemAktif', { nama: 'Daging sapi', aktif: true });
  cek(a.ok && a.data.dinolkan === null && item('Daging sapi').aktif === true && item('Daging sapi').stock === 0 && penyesuaian().length === n,
    'aktif lagi: stock tetap 0', item('Daging sapi'));
  A('aturItemAktif', { nama: 'Daging sapi', aktif: false });
}

// 3. Stock minus juga dinolkan
{
  const minus = item('Bawang putih').stock;
  cek(minus < 0, 'Bawang putih minus', minus);
  const r = A('aturItemAktif', { nama: 'Bawang putih', aktif: false });
  cek(r.ok && r.data.dinolkan.stock === minus && item('Bawang putih').stock === 0, 'stock minus dinolkan', r.data && r.data.dinolkan);
  const baru = dinolkanRow('Bawang putih') || {};
  cek(baru['Selisih'] === Math.round(-minus * 1000) / 1000 && baru['Stock Sebenarnya'] === 0, 'selisih positif', baru['Selisih']);
}

// 4. Masih dipakai resep aktif: ditolak tanpa menolkan
{
  const n = penyesuaian().length;
  const st = item('Cabai merah').stock;
  const r = A('aturItemAktif', { nama: 'Cabai merah', aktif: false });
  cek(!r.ok && /resep Sambal dasar/.test(r.pesan) && penyesuaian().length === n && item('Cabai merah').stock === st && item('Cabai merah').aktif,
    'dipakai resep: ditolak, stock tetap', r.pesan);
  const rs = A('aturItemAktif', { nama: 'Air mineral', aktif: false }, TR);
  cek(!rs.ok && item('Air mineral').aktif && penyesuaian().length === n, 'Staff tidak bisa menonaktifkan', rs.pesan);
}

// 5. Item nonaktif lama yang stock-nya belum nol (sebelum v0.40): tetap ikut nilai stock sampai dinolkan
{
  const k = A('kirimStock', { submissionId: uid(), tanggal: hariIni, kategori: 'Minuman', waktuPerangkat: new Date().toISOString(),
    baris: [{ item: 'Air mineral', masuk: '', keluar: 2 }] });
  cek(k.ok, 'Air mineral keluar 2 hari ini', k.pesan);
  const kp = A('kirimStock', { submissionId: uid(), tanggal: hariIni, kategori: 'Protein', waktuPerangkat: new Date().toISOString(),
    baris: [{ item: 'Ayam fillet', masuk: '', keluar: 1 }] });
  cek(kp.ok, 'Ayam fillet keluar 1 hari ini', kp.pesan);
  aturAktifLangsung('Air mineral', false);
  const it = item('Air mineral');
  cek(it.aktif === false && it.stock === 46, 'Air mineral nonaktif, stock 46', it);
  const awal = nilai();
  cek(!awal.tanpaHarga.some((x) => x.nama === 'Air mineral'), 'Air mineral punya harga');

  // PDF Stock hari ini: Daging sapi, Bawang putih, dan Air mineral bergerak tetapi nonaktif
  const semua = pdfStock();
  cek(semua.r.ok && /<td>Ayam fillet<\/td>/.test(semua.html), 'PDF Stock memuat item aktif', semua.r.pesan);
  cek(!/<td>(Air mineral|Daging sapi|Bawang putih)<\/td>/.test(semua.html), 'PDF Stock tanpa item nonaktif');
  cek(/3 item nonaktif yang bergerak pada tanggal ini tidak ditampilkan\./.test(semua.html), 'catatan 3 item nonaktif');
  const protein = pdfStock('Protein');
  cek(protein.r.ok && /1 item nonaktif yang bergerak/.test(protein.html) && /<td>Ayam fillet<\/td>/.test(protein.html), 'kategori Protein: 1 item nonaktif');
  const sayur = pdfStock('Sayur');
  cek(!sayur.r.ok || !/item nonaktif/.test(sayur.html), 'kategori Sayur: tanpa catatan', sayur.r.pesan);
  const minuman = pdfStock('Minuman');
  cek(minuman.r.ok && !/<td>Air mineral<\/td>/.test(minuman.html) && /1 item nonaktif yang bergerak/.test(minuman.html),
    'kategori Minuman: ada kiriman, tabel tanpa Air mineral', minuman.r.pesan);

  // Tombol Nolkan stock di aplikasi memanggil aturItemAktif lagi
  const r = A('aturItemAktif', { nama: 'Air mineral', aktif: false });
  cek(r.ok && r.data.dinolkan.stock === 46 && item('Air mineral').stock === 0, 'Nolkan stock item nonaktif lama', r.data && r.data.dinolkan);
  cek(nilai().total === awal.total - 46 * 3500, 'nilai stock turun 46 × 3.500', [awal.total, nilai().total]);
  cek(pdfStock().html.includes('3 item nonaktif'), 'PDF tetap menyebut 3 item nonaktif');
}

// 6. setupSpreadsheet: aturan abu-abu di tab master yang punya kolom Aktif
{
  const proto = Object.getPrototypeOf(H.ss.getSheetByName('M_Item'));
  const asli = proto.setConditionalFormatRules;
  const dipasang = {};
  proto.setConditionalFormatRules = function (aturan) {
    dipasang[this.getName()] = aturan.map((a) => a.getRanges().map((g) => g.getA1Notation()).join(' '));
    return this;
  };
  try {
    H.fungsi('setupSpreadsheet');
  } finally {
    proto.setConditionalFormatRules = asli;
  }
  ['M_Item', 'M_Resep', 'M_Menu', 'M_Pemasok', 'M_Kategori', 'M_Unit'].forEach((n) => {
    cek(dipasang[n] && dipasang[n].length === 1 && /(^|!)(A2:|R2C1:)/.test(dipasang[n][0]), 'aturan abu-abu di ' + n, dipasang[n]);
  });
  cek(!dipasang['M_HargaItem'] && !dipasang['M_Konfigurasi'], 'tab master tanpa kolom Aktif tidak diberi aturan', Object.keys(dipasang));
  cek(A('daftarItem', {}).ok, 'aplikasi tetap jalan sesudah setupSpreadsheet');
}

console.log('lulus', lulus, 'gagal', gagal);
