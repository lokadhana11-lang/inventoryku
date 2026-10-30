// Uji server: catatan resep (kolom Catatan di M_Resep) dan stock hasil prep di jawaban kirimPrep (Code.gs v0.39).
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';
let gagal = 0, lulus = 0;
const cek = (k, label, x) => { if (k) lulus++; else { gagal++; console.log('GAGAL:', label, x !== undefined ? JSON.stringify(x).slice(0, 600) : ''); } };
const s = seed();
const T = s.token;
const TR = H.aksi({ action: 'login', nama: 'Rina', pin: '730264' }).data.token;
const hari = (n) => new Date(Date.now() + H.geserWaktu + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const uid = () => crypto.randomUUID();
const hariIni = hari(0), kemarin = hari(-1);
const A = (action, b, tok = T) => H.aksi(Object.assign({ action, token: tok }, b));
const resepSambal = (d) => d.resep.find((r) => r.itemHasil === 'Sambal dasar');
const bahanSambal = [{ item: 'Cabai merah', qty: 1 }, { item: 'Bawang merah', qty: 0.5 }, { item: 'Tomat', qty: 0.5 }, { item: 'Minyak goreng', qty: 0.3 }];
const simpan = (ekstra = {}) => A('simpanResep', Object.assign({ baru: false, itemHasil: 'Sambal dasar', hasil: 2, masaSimpan: '3', bahan: bahanSambal }, ekstra));
const sel = () => {
  const v = H.ss.getSheetByName('M_Resep').getDataRange().getValues();
  const i = v[0].indexOf('Catatan');
  const r = v.find((x) => x[0] === 'Sambal dasar');
  return { kolom: i, nilai: i >= 0 ? r[i] : undefined, hasil: r[v[0].indexOf('Hasil per 1 Resep')] };
};
const stockAkhir = (nama, tg = hariIni) => A('formStock', { tanggal: tg }).data.item.find((i) => i.nama === nama).akhir;
const kirimPrep = (baris, ekstra = {}, tok = TR) => A('kirimPrep', Object.assign({ submissionId: uid(), tanggal: hariIni, shift: 'Pagi',
  waktuPerangkat: new Date().toISOString(), baris }, ekstra), tok);

// 1. Kolom dan bentuk awal
{
  const d = A('daftarResep', {}).data;
  cek(d.catatanSiap === true, 'catatanSiap sesudah setupSpreadsheet', d.catatanSiap);
  cek(resepSambal(d).catatan === '', 'catatan awal kosong', resepSambal(d));
  cek(sel().kolom >= 0, 'kolom Catatan ada di M_Resep');
  const f = A('formPrep', { tanggal: hariIni }, TR).data;
  cek(f.resep.find((r) => r.item === 'Sambal dasar').catatan === '', 'formPrep membawa catatan');
}

// 2. Simpan, ubah, aplikasi lama, kosongkan, terlalu panjang, teks berawalan =
{
  let r = simpan({ catatan: '  Air 1,2 liter per 1 kg beras.  Rendam 30 menit. ' });
  cek(r.ok && resepSambal(r.data).catatan === 'Air 1,2 liter per 1 kg beras. Rendam 30 menit.', 'catatan tersimpan dan dirapikan', r.ok ? resepSambal(r.data) : r.pesan);
  cek(sel().nilai === 'Air 1,2 liter per 1 kg beras. Rendam 30 menit.', 'sel M_Resep', sel());
  cek(A('formPrep', { tanggal: hariIni }, TR).data.resep.find((x) => x.item === 'Sambal dasar').catatan === 'Air 1,2 liter per 1 kg beras. Rendam 30 menit.', 'Staff melihat catatan di Prep List');
  r = simpan({ hasil: 2.5 });
  cek(r.ok && resepSambal(r.data).catatan === 'Air 1,2 liter per 1 kg beras. Rendam 30 menit.' && sel().hasil === 2.5, 'aplikasi lama (tanpa catatan) tidak mengubah catatan', sel());
  r = simpan({ hasil: 2, catatan: '' });
  cek(r.ok && resepSambal(r.data).catatan === '' && sel().nilai === '', 'catatan dikosongkan', sel());
  r = simpan({ catatan: 'x'.repeat(201) });
  cek(!r.ok && /paling panjang 200/.test(r.pesan), 'lebih dari 200 huruf ditolak', r.pesan);
  r = simpan({ catatan: 'x'.repeat(200) });
  cek(r.ok, '200 huruf boleh');
  r = simpan({ catatan: '=1+1' });
  cek(r.ok && resepSambal(r.data).catatan === '=1+1' && sel().nilai === '=1+1', 'teks berawalan = tetap teks', sel());
  r = A('simpanResep', { baru: false, itemHasil: 'Sambal dasar', hasil: 2, masaSimpan: '3', bahan: bahanSambal, catatan: 'Staff' }, TR);
  cek(!r.ok, 'Staff tidak bisa menyimpan resep');
  simpan({ catatan: 'Aduk terus supaya tidak gosong.' });
}

// 3. Sheet tanpa kolom Catatan (setupSpreadsheet belum dijalankan)
{
  const sh = H.ss.getSheetByName('M_Resep');
  const judul = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const kol = judul.indexOf('Catatan') + 1;
  sh.getRange(1, kol).setValue('Catatan lama');
  const d = A('daftarResep', {}).data;
  cek(d.catatanSiap === false && resepSambal(d).catatan === '', 'tanpa kolom: catatanSiap false, catatan kosong', [d.catatanSiap, resepSambal(d).catatan]);
  const r = simpan({ hasil: 3, catatan: 'Baru' });
  cek(!r.ok && /setupSpreadsheet/.test(r.pesan) && sel().hasil === 2, 'catatan ditolak tanpa menulis apa pun', [r.pesan, sel().hasil]);
  cek(simpan({ hasil: 2, catatan: '' }).ok && simpan({ hasil: 2 }).ok, 'tanpa kolom: catatan kosong dan aplikasi lama tetap bisa');
  cek(A('formPrep', { tanggal: hariIni }, TR).ok, 'formPrep tetap jalan tanpa kolom');
  sh.getRange(1, kol).setValue('Catatan');
  H.fungsi('setupSpreadsheet');
  cek(A('daftarResep', {}).data.catatanSiap === true && resepSambal(A('daftarResep', {}).data).catatan === 'Aduk terus supaya tidak gosong.', 'kolom kembali, catatan lama terbaca');
}

// 4. Resep baru dengan catatan
{
  const r = A('simpanResep', { baru: true, itemHasil: 'Nasi putih', hasil: 10, masaSimpan: '0', bahan: [{ item: 'Telur', qty: 1 }],
    catatan: 'Air 1,2 liter per 1 kg beras.' });
  cek(r.ok && r.data.resep.find((x) => x.itemHasil === 'Nasi putih').catatan === 'Air 1,2 liter per 1 kg beras.', 'resep baru dengan catatan', r.pesan);
  A('aturResepAktif', { itemHasil: 'Nasi putih', aktif: false });
}

// 5. kirimPrep: stockHasil dan tanpaResep
{
  const sebelum = stockAkhir('Sambal dasar');
  const r = kirimPrep([
    { item: 'Sambal dasar', jumlahResep: 1, qty: '', keterangan: '' },
    { item: 'Bawang putih', jumlahResep: '', qty: 0.5, keterangan: '' },
    { item: 'Sambal dasar', jumlahResep: 0.5, qty: '', keterangan: '' },
    { item: 'Bawang putih', jumlahResep: '', qty: 0.2, keterangan: '' }
  ]);
  cek(r.ok, 'kirimPrep', r.pesan);
  const sh = r.data.stockHasil;
  cek(Array.isArray(sh) && sh.length === 1 && sh[0].item === 'Sambal dasar' && sh[0].tambah === 3 && sh[0].satuan === 'kg', 'stockHasil dijumlah per item (2 + 1)', sh);
  cek(sh[0].akhir === stockAkhir('Sambal dasar') && sh[0].akhir === sebelum + 3, 'akhir = Stock Akhir sesudah dicatat', [sh[0].akhir, sebelum]);
  cek(JSON.stringify(r.data.tanpaResep) === '["Bawang putih"]', 'tanpaResep sekali per item', r.data.tanpaResep);
  // Kiriman ulang dengan submissionId yang sama: dari baris yang sudah tercatat
  const sid = uid();
  const isi = [{ item: 'Sambal dasar', jumlahResep: 2, qty: '', keterangan: '' }];
  const a = kirimPrep(isi, { submissionId: sid });
  const b = kirimPrep(isi, { submissionId: sid });
  cek(a.ok && b.ok && b.data.sudahTerkirim === true && b.data.stockHasil.length === 1 && b.data.stockHasil[0].tambah === 4 &&
    b.data.stockHasil[0].akhir === a.data.stockHasil[0].akhir && b.data.tanpaResep.length === 0, 'kiriman ulang: stockHasil dari baris tercatat', b.data);
}

// 6. Hasil aktual: tambah = hasil aktual; hasil aktual 0 tidak disebut dan bukan "tanpa resep"
{
  const r = kirimPrep([{ item: 'Sambal dasar', jumlahResep: 1, qty: '', hasilAktual: 1.8, keterangan: '' }]);
  cek(r.ok && r.data.stockHasil[0].tambah === 1.8, 'hasil aktual dipakai', r.data && r.data.stockHasil);
  const n = kirimPrep([{ item: 'Sambal dasar', jumlahResep: 1, qty: '', hasilAktual: 0, keterangan: '' }]);
  cek(n.ok && n.data.stockHasil.length === 0 && n.data.tanpaResep.length === 0, 'hasil aktual 0: tidak disebut', n.data && [n.data.stockHasil, n.data.tanpaResep]);
}

// 7. Tanggal kemarin: akhir pada tanggal itu
{
  const r = kirimPrep([{ item: 'Sambal dasar', jumlahResep: 1, qty: '', keterangan: '' }], { tanggal: kemarin }, T);
  cek(r.ok && r.data.stockHasil[0].akhir === stockAkhir('Sambal dasar', kemarin), 'kemarin: Stock Akhir kemarin', r.data && r.data.stockHasil);
}

console.log('lulus', lulus, 'gagal', gagal);
