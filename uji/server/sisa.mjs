// Uji server: hitung sisa di kirimStock (Code.gs v0.28).
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';
let gagal = 0, lulus = 0;
const cek = (k, label, x) => { if (k) lulus++; else { gagal++; console.log('GAGAL:', label, x !== undefined ? JSON.stringify(x).slice(0, 400) : ''); } };
const s = seed();
const T = s.token;
const TR = H.aksi({ action: 'login', nama: 'Rina', pin: '730264' }).data.token;
const hari = (n) => new Date(Date.now() + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const uid = () => crypto.randomUUID();
const form = (tg, tok = TR) => H.aksi({ action: 'formStock', token: tok, tanggal: tg }).data;
const akhir = (tg, nama, tok = TR) => form(tg, tok).item.find((i) => i.nama === nama).akhir;
const kirim = (tg, baris, tok = TR, ekstra = {}) => H.aksi(Object.assign({ action: 'kirimStock', token: tok, submissionId: uid(), tanggal: tg, kategori: 'x', waktuPerangkat: new Date().toISOString(), baris }, ekstra));
const barisStock = () => {
  const sh = H.ss.getSheetByName('Data_Stock');
  const v = sh.getDataRange().getValues();
  return v.slice(1).filter((r) => r[0] !== '' && r[0] != null).length;
};
const hariIni = hari(0), kemarin = hari(-1);
const baris = () => {
  const sh = H.ss.getSheetByName('Data_Stock');
  const v = sh.getDataRange().getValues();
  return v.slice(1).filter((r) => r[0] !== '' && r[0] != null).map((r) => Object.fromEntries(v[0].map((j, i) => [j, r[i]])));
};

// 1. formStock membawa sisaSiap
cek(form(hariIni).sisaSiap === true, 'formStock.sisaSiap');

// 2. sisa saja: keluar = tercatat - sisa, Stock Akhir = sisa
{
  const a0 = akhir(hariIni, 'Ayam fillet');
  const r = kirim(hariIni, [{ item: 'Ayam fillet', masuk: '', sisa: 1.5, satuanMasuk: 'dasar' }]);
  cek(r.ok && r.data.jumlah === 1, 'kirim sisa ok', r);
  cek(Math.abs(akhir(hariIni, 'Ayam fillet') - 1.5) < 1e-9, 'Stock Akhir = sisa', { a0, akhir: akhir(hariIni, 'Ayam fillet') });
  const rw = H.aksi({ action: 'riwayat', token: T, formId: 'STOCK', dari: hariIni, sampai: hariIni, tampilan: 'catatan' }).data;
  const b = rw.kiriman.flatMap((k) => k.baris).find((x) => x.nilai.item === 'Ayam fillet' && Math.abs(Number(x.nilai.keluar) - (a0 - 1.5)) < 1e-9);
  cek(!!b, 'Riwayat: Stock Keluar = tercatat - sisa', { a0, baris: rw.kiriman.flatMap((k) => k.baris).filter((x) => x.nilai.item === 'Ayam fillet').map((x) => x.nilai) });
}
// 3. sisa + masuk satuan besar: keluar = tercatat + masuk*isi - sisa
{
  const a0 = akhir(hariIni, 'Air mineral');
  const r = kirim(hariIni, [{ item: 'Air mineral', masuk: 2, satuanMasuk: 'besar', sisa: 30 }]);
  cek(r.ok, 'sisa + masuk dus ok', r);
  cek(Math.abs(akhir(hariIni, 'Air mineral') - 30) < 1e-9, 'Air mineral akhir 30', { a0, akhir: akhir(hariIni, 'Air mineral') });
  const t = H.aksi({ action: 'riwayatItem', token: T, item: 'Air mineral' }).data.transaksi.filter((x) => x.tanggal === hariIni && x.jenis === 'Stock');
  const terakhir = t[t.length - 1];
  cek(terakhir && terakhir.masuk === 48 && Math.abs(terakhir.keluar - (a0 + 48 - 30)) < 1e-9, 'kartu stok: masuk 48, keluar dihitung', { a0, terakhir });
}
// 4. sisa lebih banyak dari stock: kiriman tidak ditolak; keluar tidak dicatat, baris lain dan barang masuk tetap
{
  const n0 = barisStock();
  const a0 = akhir(hariIni, 'Tomat');
  const aB = akhir(hariIni, 'Bawang putih');
  const r = kirim(hariIni, [{ item: 'Bawang putih', keluar: 0.1 }, { item: 'Tomat', sisa: a0 + 5 }]);
  cek(r.ok && r.data.jumlah === 1 && r.data.sisaLebih.length === 1 && r.data.sisaLebih[0].item === 'Tomat' &&
    Math.abs(r.data.sisaLebih[0].tercatat - a0) < 1e-9 && r.data.sisaLebih[0].masuk === 0 && r.data.sisaLebih[0].satuan === 'kg', 'sisa lebih: diterima dengan sisaLebih', r.data && r.data.sisaLebih);
  cek(barisStock() === n0 + 1 && Math.abs(akhir(hariIni, 'Tomat') - a0) < 1e-9 && Math.abs(akhir(hariIni, 'Bawang putih') - (aB - 0.1)) < 1e-9, 'Tomat tidak bergerak, Bawang putih tercatat', { n0, n: barisStock() });
  // Hanya sisa lebih, tanpa masuk: tidak menulis apa pun, tetap berhasil (antrean tidak macet)
  const n1 = barisStock();
  const r1 = kirim(hariIni, [{ item: 'Tomat', sisa: a0 + 5 }]);
  cek(r1.ok && r1.data.jumlah === 0 && r1.data.sisaLebih.length === 1 && barisStock() === n1, 'hanya sisa lebih: berhasil tanpa tulis', r1);
  // Sisa lebih dengan masuk: barang masuk, harga beli, pemasok tetap tercatat; keluar 0; sisa tidak disimpan
  const r2 = kirim(hariIni, [{ item: 'Tomat', masuk: 1, sisa: a0 + 5, hargaBeli: 16000 }], TR, { pemasok: 'Sumber Segar' });
  const bT = baris().filter((b) => b['Nama Item'] === 'Tomat').pop();
  cek(r2.ok && r2.data.sisaLebih.length === 1 && r2.data.sisaLebih[0].masuk === 1 && bT['Stock Masuk'] === 1 && bT['Stock Keluar'] === 0 &&
    bT['Sisa Dihitung'] === '' && bT['Pemasok'] === 'Sumber Segar' && bT['Harga Beli (Rp)'] === 16000, 'sisa lebih + masuk: masuk tercatat, keluar 0, sisa kosong', bT);
  const a1 = akhir(hariIni, 'Tomat');
  const r3 = kirim(hariIni, [{ item: 'Tomat', masuk: 6, sisa: a1 + 5 }]);
  const bT2 = baris().filter((b) => b['Nama Item'] === 'Tomat').pop();
  cek(r3.ok && r3.data.sisaLebih.length === 0 && Math.abs(akhir(hariIni, 'Tomat') - (a1 + 5)) < 1e-9 && bT2['Sisa Dihitung'] === a1 + 5, 'dengan masuk cukup: diterima, sisa disimpan', bT2);
}
// 5. sisa sama dengan stock: dicatat sebagai baris keluar 0 dengan Sisa Dihitung (tanda sudah dihitung)
{
  const a0 = akhir(hariIni, 'Daging sapi');
  const n0 = barisStock();
  const r = kirim(hariIni, [{ item: 'Daging sapi', sisa: a0 }]);
  const bD = baris().filter((b) => b['Nama Item'] === 'Daging sapi').pop();
  cek(r.ok && r.data.jumlah === 1 && barisStock() === n0 + 1 && bD['Stock Masuk'] === 0 && bD['Stock Keluar'] === 0 && bD['Sisa Dihitung'] === a0, 'sisa sama: baris keluar 0 bersisa', bD);
  cek(Math.abs(akhir(hariIni, 'Daging sapi') - a0) < 1e-9, 'sisa sama: stock tetap');
  const t = H.aksi({ action: 'riwayatItem', token: T, item: 'Daging sapi' }).data.transaksi.filter((x) => x.tanggal === hariIni && x.jenis === 'Stock' && !x.masuk && !x.keluar);
  cek(t.length === 0, 'kartu stok tidak memuat baris tanpa gerakan');
  const r2 = kirim(hariIni, [{ item: 'Daging sapi', sisa: a0 }, { item: 'Ayam fillet', sisa: 1 }]);
  cek(r2.ok && r2.data.jumlah === 2, 'campuran: dua baris', r2);
}
// 6. keluar dan sisa sekaligus ditolak; sisa minus/huruf ditolak; item ganda dengan sisa ditolak
{
  const r = kirim(hariIni, [{ item: 'Telur', keluar: 2, sisa: 10 }]);
  cek(!r.ok && /tidak keduanya/.test(r.pesan), 'keluar + sisa ditolak', r);
  const r2 = kirim(hariIni, [{ item: 'Telur', sisa: -1 }]);
  cek(!r2.ok && /Sisa Telur harus angka 0 atau lebih/.test(r2.pesan), 'sisa minus ditolak', r2);
  const r3 = kirim(hariIni, [{ item: 'Telur', sisa: 'abc' }]);
  cek(!r3.ok && /Sisa Telur/.test(r3.pesan), 'sisa huruf ditolak', r3);
  const r4 = kirim(hariIni, [{ item: 'Telur', keluar: 1 }, { item: 'Telur', sisa: 5 }]);
  cek(!r4.ok && /dua kali/.test(r4.pesan), 'item ganda dengan sisa ditolak', r4);
  const r5 = kirim(hariIni, [{ item: 'Telur', keluar: 1 }, { item: 'Telur', keluar: 1 }]);
  cek(r5.ok, 'item ganda tanpa sisa tetap diterima (seperti dulu)', r5);
}
// 7. Kiriman lain di antara memuat dan mengirim: dihitung dari stock saat diterima
{
  cek(kirim(hariIni, [{ item: 'Bawang merah', masuk: 5 }], T).ok, 'masuk bawang');
  const a0 = akhir(hariIni, 'Bawang merah');
  const lain = kirim(hariIni, [{ item: 'Bawang merah', keluar: 0.5 }], T);
  cek(lain.ok, 'kiriman lain');
  const r = kirim(hariIni, [{ item: 'Bawang merah', sisa: a0 - 1 }]);
  cek(r.ok && Math.abs(akhir(hariIni, 'Bawang merah') - (a0 - 1)) < 1e-9, 'Stock Akhir = sisa walau ada kiriman lain', { a0, akhir: akhir(hariIni, 'Bawang merah') });
}
// 8. Kemarin: keluar di kemarin, hari ini ikut turun
{
  const k0 = akhir(kemarin, 'Cabai merah');
  const h0 = akhir(hariIni, 'Cabai merah');
  const r = kirim(kemarin, [{ item: 'Cabai merah', sisa: k0 - 0.2 }]);
  cek(r.ok, 'sisa kemarin ok', r);
  cek(Math.abs(akhir(kemarin, 'Cabai merah') - (k0 - 0.2)) < 1e-9 && Math.abs(akhir(hariIni, 'Cabai merah') - (h0 - 0.2)) < 1e-9, 'kemarin = sisa, hari ini turun 0,2', { k0, h0, k: akhir(kemarin, 'Cabai merah'), h: akhir(hariIni, 'Cabai merah') });
}
// 9. Kiriman ulang (submissionId sama): sudahTerkirim, tidak menghitung lagi
{
  const sid = uid();
  const a0 = akhir(hariIni, 'Minyak goreng');
  const b = { action: 'kirimStock', token: TR, submissionId: sid, tanggal: hariIni, kategori: 'Bumbu', waktuPerangkat: new Date().toISOString(), baris: [{ item: 'Minyak goreng', sisa: a0 - 2 }] };
  const r1 = H.aksi(b);
  const r2 = H.aksi(b);
  cek(r1.ok && r2.ok && r2.data.sudahTerkirim === true && Math.abs(akhir(hariIni, 'Minyak goreng') - (a0 - 2)) < 1e-9, 'kiriman ulang tidak dihitung lagi', { r2: r2.data && r2.data.sudahTerkirim });
}
// 10. Koreksi Stock Keluar dari baris sisa tetap bisa
{
  const rw = H.aksi({ action: 'riwayat', token: T, formId: 'STOCK', dari: hariIni, sampai: hariIni, tampilan: 'catatan' }).data;
  const b = rw.kiriman.flatMap((k) => k.baris).find((x) => x.nilai.item === 'Minyak goreng');
  const r = H.aksi({ action: 'koreksi', token: T, formId: 'STOCK', rowId: b.rowId, nilai: { keluar: 1 } });
  cek(r.ok, 'koreksi keluar baris sisa', r);
}
// 11. Koreksi baris hitung sisa: Stock Masuk menggeser Stock Keluar; Stock Keluar langsung mengosongkan sisa
{
  const a0 = akhir(hariIni, 'Minyak goreng');
  const r = kirim(hariIni, [{ item: 'Minyak goreng', masuk: 20, sisa: 15 }]);
  cek(r.ok, 'kirim minyak masuk 20 sisa 15');
  const cari = () => H.aksi({ action: 'riwayat', token: T, formId: 'STOCK', dari: hariIni, sampai: hariIni, tampilan: 'catatan' }).data;
  let rw = cari();
  let b = rw.kiriman.flatMap((k) => k.baris).find((x) => x.nilai.item === 'Minyak goreng' && x.nilai.sisa === 15);
  cek(b && b.nilai.masuk === 20 && Math.abs(b.nilai.keluar - (a0 + 20 - 15)) < 1e-9, 'Riwayat: kolom sisa 15', b && b.nilai);
  cek(rw.kolom.some((k) => k.kunci === 'sisa' && !k.koreksi && k.jikaAda), 'kolom sisa tidak bisa dikoreksi, jikaAda');
  const kr = H.aksi({ action: 'koreksi', token: T, formId: 'STOCK', rowId: b.rowId, nilai: { masuk: 2 } });
  cek(kr.ok, 'koreksi masuk 20 → 2', kr);
  cek(Math.abs(akhir(hariIni, 'Minyak goreng') - 15) < 1e-9, 'Stock Akhir tetap 15 sesudah koreksi masuk', akhir(hariIni, 'Minyak goreng'));
  const bMin = baris().find((x) => x.row_id === b.rowId);
  cek(Math.abs(bMin['Stock Keluar'] - (a0 + 2 - 15)) < 1e-9 && bMin['Sisa Dihitung'] === 15, 'keluar bergeser, sisa tetap', bMin);
  const log = H.ss.getSheetByName('Log_Perubahan').getDataRange().getValues().filter((x) => String(x[3]) === b.rowId).map((x) => x[4]);
  cek(log.includes('Stock Masuk') && log.includes('Stock Keluar'), 'Log_Perubahan mencatat masuk dan keluar', log);
  // Koreksi masuk yang membuat keluar minus: keluar 0, sisa dikosongkan
  const kr2 = H.aksi({ action: 'koreksi', token: T, formId: 'STOCK', rowId: b.rowId, nilai: { masuk: 0 } });
  const bMin2 = baris().find((x) => x.row_id === b.rowId);
  const harap = a0 + 2 - 15 - 2;
  cek(kr2.ok && (harap < 0 ? bMin2['Stock Keluar'] === 0 && bMin2['Sisa Dihitung'] === '' : Math.abs(bMin2['Stock Keluar'] - harap) < 1e-9), 'masuk 0: keluar tidak minus', bMin2);
  // Koreksi keluar langsung: sisa dikosongkan
  const r3 = kirim(hariIni, [{ item: 'Bawang putih', masuk: 3, sisa: 1 }]);
  rw = cari();
  b = rw.kiriman.flatMap((k) => k.baris).find((x) => x.nilai.item === 'Bawang putih' && x.nilai.sisa === 1);
  const kr3 = H.aksi({ action: 'koreksi', token: T, formId: 'STOCK', rowId: b.rowId, nilai: { keluar: 0.5 } });
  const bBP = baris().find((x) => x.row_id === b.rowId);
  cek(r3.ok && kr3.ok && bBP['Stock Keluar'] === 0.5 && bBP['Sisa Dihitung'] === '', 'koreksi keluar: sisa dikosongkan', bBP);
  // Kartu stok: keterangan sisa
  const t = H.aksi({ action: 'riwayatItem', token: T, item: 'Air mineral' }).data.transaksi.filter((x) => /Keluar dihitung dari sisa 30 botol/.test(x.ket));
  cek(t.length === 1, 'kartu stok: Keluar dihitung dari sisa', t);
}
// 12. Sheet tanpa kolom Sisa Dihitung (setupSpreadsheet belum dijalankan): sisaSiap false, sisa ditolak, keluar tetap jalan
{
  const sh = H.ss.getSheetByName('Data_Stock');
  const judul = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const i = judul.indexOf('Sisa Dihitung');
  sh.getRange(1, i + 1).setValue('Kolom Lain');
  cek(form(hariIni).sisaSiap === false, 'tanpa kolom: sisaSiap false');
  const r = kirim(hariIni, [{ item: 'Telur', sisa: 5 }]);
  cek(!r.ok && /setupSpreadsheet/.test(r.pesan), 'tanpa kolom: sisa ditolak dengan petunjuk', r);
  const r2 = kirim(hariIni, [{ item: 'Telur', keluar: 1 }]);
  cek(r2.ok, 'tanpa kolom: keluar tetap jalan', r2);
  const rw = H.aksi({ action: 'riwayat', token: T, formId: 'STOCK', dari: hariIni, sampai: hariIni, tampilan: 'catatan' }).data;
  cek(!rw.kolom.some((k) => k.kunci === 'sisa'), 'tanpa kolom: Riwayat tanpa kolom sisa');
  H.fungsi('setupSpreadsheet');
  const judul2 = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  cek(judul2.includes('Sisa Dihitung') && form(hariIni).sisaSiap === true, 'setupSpreadsheet menambah kolom', judul2);
}
// Jalur lama (keluar) sama dengan Code.gs v0.27: dibanding lewat uji_sisa_banding.mjs
console.log('lulus', lulus, 'gagal', gagal, 'ERR log:', H.logs.filter((l) => l.startsWith('ERR')).slice(0, 3));
