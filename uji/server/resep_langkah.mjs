// Uji server: cara membuat resep (kolom Cara Membuat di M_Resep) dan tempelResep (Code.gs v0.46, butir 478–481).
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';
let gagal = 0, lulus = 0;
const cek = (k, label, x) => { if (k) lulus++; else { gagal++; console.log('GAGAL:', label, x !== undefined ? JSON.stringify(x).slice(0, 600) : ''); } };
const s = seed();
const T = s.token;
const TR = H.aksi({ action: 'login', nama: 'Rina', pin: '730264' }).data.token;
const hari = (n) => new Date(Date.now() + H.geserWaktu + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const hariIni = hari(0);
const A = (action, b, tok = T) => H.aksi(Object.assign({ action, token: tok }, b));
const resep = (d, nama) => d.resep.find((r) => r.itemHasil === nama);
const bahanSambal = [{ item: 'Cabai merah', qty: 1 }, { item: 'Bawang merah', qty: 0.5 }, { item: 'Tomat', qty: 0.5 }, { item: 'Minyak goreng', qty: 0.3 }];
const simpan = (ekstra = {}) => A('simpanResep', Object.assign({ baru: false, itemHasil: 'Sambal dasar', hasil: 2, masaSimpan: '3', bahan: bahanSambal }, ekstra));
const baris = (nama) => {
  const v = H.ss.getSheetByName('M_Resep').getDataRange().getValues();
  const r = v.find((x) => x[0] === nama);
  const kol = (j) => v[0].indexOf(j);
  return r ? { langkah: kol('Cara Membuat') >= 0 ? r[kol('Cara Membuat')] : undefined, hasil: r[kol('Hasil per 1 Resep')],
    masa: r[kol('Masa Simpan (hari)')], aktif: r[kol('Aktif')], catatan: r[kol('Catatan')] } : null;
};
const bahanDi = (nama) => H.ss.getSheetByName('M_ResepBahan').getDataRange().getValues().filter((x) => x[0] === nama).map((x) => x[1] + ' ' + x[2]);
const stockAkhir = (nama) => A('formStock', { tanggal: hariIni }).data.item.find((i) => i.nama === nama).akhir;

// Item hasil baru untuk tempelan
A('simpanItem', { baru: true, nama: 'Bumbu tabur', kategori: 'Barang jadi', satuan: 'kg' });
A('simpanItem', { baru: true, nama: 'Ayam bumbu', kategori: 'Barang jadi', satuan: 'kg' });
A('simpanItem', { baru: true, nama: 'Telur rebus', kategori: 'Barang jadi', satuan: 'butir' });

// 1. Kolom dan bentuk awal
{
  const d = A('daftarResep', {}).data;
  cek(d.langkahSiap === true, 'langkahSiap sesudah setupSpreadsheet', d.langkahSiap);
  cek(Array.isArray(resep(d, 'Sambal dasar').langkah) && resep(d, 'Sambal dasar').langkah.length === 0, 'langkah awal kosong', resep(d, 'Sambal dasar'));
  cek(baris('Sambal dasar').langkah !== undefined, 'kolom Cara Membuat ada di M_Resep');
  const f = A('formPrep', { tanggal: hariIni }, TR).data;
  cek(JSON.stringify(f.resep.find((r) => r.item === 'Sambal dasar').langkah) === '[]', 'formPrep membawa langkah');
}

// 2. Simpan, rapikan, aplikasi lama, kosongkan, batas
{
  let r = simpan({ langkah: ['1. Tumis cabai dan bawang  sampai layu.', '  ', '- Blender   halus.', '3) Masak lagi 5 menit.', '=SUM(A1)', '• Dinginkan.'] });
  const harap = ['Tumis cabai dan bawang sampai layu.', 'Blender halus.', 'Masak lagi 5 menit.', '=SUM(A1)', 'Dinginkan.'];
  cek(r.ok && JSON.stringify(resep(r.data, 'Sambal dasar').langkah) === JSON.stringify(harap), 'langkah tersimpan dan dirapikan', r.ok ? resep(r.data, 'Sambal dasar').langkah : r.pesan);
  cek(baris('Sambal dasar').langkah === harap.join('\n'), 'sel Cara Membuat: satu langkah per baris', baris('Sambal dasar'));
  const f = A('formPrep', { tanggal: hariIni }, TR).data;
  cek(JSON.stringify(f.resep.find((x) => x.item === 'Sambal dasar').langkah) === JSON.stringify(harap), 'Staff melihat langkah di Prep List');
  r = simpan({ hasil: 2.5 });
  cek(r.ok && resep(r.data, 'Sambal dasar').langkah.length === 5 && baris('Sambal dasar').hasil === 2.5, 'tanpa field langkah: tidak diubah');
  r = simpan({ hasil: 2, catatan: 'Aduk terus.' });
  cek(r.ok && resep(r.data, 'Sambal dasar').langkah.length === 5 && resep(r.data, 'Sambal dasar').catatan === 'Aduk terus.', 'catatan tanpa langkah: langkah tetap');
  r = simpan({ langkah: [] });
  cek(r.ok && resep(r.data, 'Sambal dasar').langkah.length === 0 && baris('Sambal dasar').langkah === '', 'langkah dikosongkan', baris('Sambal dasar'));
  r = simpan({ langkah: Array.from({ length: 31 }, (_, i) => 'Langkah ' + i) });
  cek(!r.ok && /paling banyak 30 langkah/.test(r.pesan), '31 langkah ditolak', r.pesan);
  r = simpan({ langkah: Array.from({ length: 30 }, (_, i) => 'Langkah ' + i) });
  cek(r.ok && resep(r.data, 'Sambal dasar').langkah.length === 30, '30 langkah boleh');
  r = simpan({ langkah: ['a', 'x'.repeat(301)] });
  cek(!r.ok && /Langkah 2 paling panjang 300/.test(r.pesan), 'langkah 301 huruf ditolak', r.pesan);
  r = simpan({ langkah: ['x'.repeat(300)] });
  cek(r.ok, '300 huruf boleh');
  r = simpan({ langkah: 'Tumis' });
  cek(!r.ok && /tidak terbaca/.test(r.pesan), 'langkah bukan daftar ditolak', r.pesan);
  r = A('simpanResep', { baru: false, itemHasil: 'Sambal dasar', hasil: 2, masaSimpan: '3', bahan: bahanSambal, langkah: ['Staff'] }, TR);
  cek(!r.ok, 'Staff tidak bisa menyimpan langkah');
  simpan({ langkah: ['Tumis cabai.', 'Blender halus.'] });
}

// 3. Sheet tanpa kolom Cara Membuat (setupSpreadsheet belum dijalankan)
{
  const sh = H.ss.getSheetByName('M_Resep');
  const judul = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const kol = judul.indexOf('Cara Membuat') + 1;
  sh.getRange(1, kol).setValue('Cara Membuat lama');
  const d = A('daftarResep', {}).data;
  cek(d.langkahSiap === false && resep(d, 'Sambal dasar').langkah.length === 0, 'tanpa kolom: langkahSiap false, langkah kosong', [d.langkahSiap, resep(d, 'Sambal dasar').langkah]);
  let r = simpan({ hasil: 3, langkah: ['Baru'] });
  cek(!r.ok && /setupSpreadsheet/.test(r.pesan) && baris('Sambal dasar').hasil === 2, 'langkah ditolak tanpa menulis apa pun', [r.pesan, baris('Sambal dasar').hasil]);
  cek(simpan({ hasil: 2, langkah: [] }).ok && simpan({ hasil: 2 }).ok, 'tanpa kolom: langkah kosong dan aplikasi lama tetap bisa');
  r = A('tempelResep', { resep: [{ no: 1, ganti: false, itemHasil: 'Telur rebus', hasil: 10, masaSimpan: '', bahan: [{ item: 'Telur', qty: 10 }], langkah: ['Rebus'] }] });
  cek(!r.ok && /Cara membuat belum bisa disimpan/.test(r.pesan) && !baris('Telur rebus'), 'tempelResep dengan langkah tanpa kolom ditolak', r.pesan);
  cek(A('formPrep', { tanggal: hariIni }, TR).ok, 'formPrep tetap jalan tanpa kolom');
  sh.getRange(1, kol).setValue('Cara Membuat');
  H.fungsi('setupSpreadsheet');
  cek(JSON.stringify(resep(A('daftarResep', {}).data, 'Sambal dasar').langkah) === '["Tumis cabai.","Blender halus."]', 'kolom kembali, langkah lama terbaca');
}

// 4. tempelResep: resep baru, resep yang diganti, dan yang tetap
{
  A('simpanResep', { baru: false, itemHasil: 'Sambal dasar', hasil: 2, masaSimpan: '3', bahan: bahanSambal, catatan: 'Pakai cabai segar.' });
  const kirim = [
    { no: 2, ganti: false, itemHasil: 'Bumbu tabur', hasil: '0,5', masaSimpan: '30', catatan: 'Simpan di box tertutup.',
      langkah: ['1. Blender semua bahan.', 'Simpan berlabel.'], bahan: [{ item: 'Cabai merah', qty: 0.2 }, { item: 'Bawang putih', qty: 0.3 }] },
    { no: 4, ganti: false, itemHasil: 'Ayam bumbu', hasil: 1.1, masaSimpan: '', bahan: [{ item: 'Ayam fillet', qty: 1 }, { item: 'Bumbu tabur', qty: 0.09 }],
      langkah: [] },
    { no: 6, ganti: true, itemHasil: 'sambal dasar', hasil: 2.5, masaSimpan: '', catatan: '', langkah: [],
      bahan: [{ item: 'Cabai merah', qty: 1.2 }, { item: 'Bawang merah', qty: 0.5 }] }
  ];
  let r = A('tempelResep', { resep: kirim }, TR);
  cek(!r.ok, 'Staff tidak bisa tempelResep');
  r = A('tempelResep', { resep: kirim });
  cek(r.ok && JSON.stringify(r.data.tempel) === '{"baru":["Bumbu tabur","Ayam bumbu"],"diganti":["Sambal dasar"]}', 'jawaban tempel', r.ok ? r.data.tempel : r.pesan);
  const d = r.data;
  const bt = resep(d, 'Bumbu tabur');
  cek(bt && bt.aktif && bt.hasil === 0.5 && bt.masaSimpan === 30 && bt.catatan === 'Simpan di box tertutup.' &&
    JSON.stringify(bt.langkah) === '["Blender semua bahan.","Simpan berlabel."]', 'resep baru lengkap', bt);
  cek(JSON.stringify(bahanDi('Bumbu tabur')) === '["Cabai merah 0.2","Bawang putih 0.3"]', 'bahan resep baru di M_ResepBahan', bahanDi('Bumbu tabur'));
  const ab = resep(d, 'Ayam bumbu');
  cek(ab && ab.aktif && ab.masaSimpan === null && ab.langkah.length === 0 && ab.catatan === '', 'resep baru tanpa masa simpan, catatan, langkah', ab);
  const sd = resep(d, 'Sambal dasar');
  cek(sd.hasil === 2.5 && sd.masaSimpan === 3 && sd.catatan === 'Pakai cabai segar.' && JSON.stringify(sd.langkah) === '["Tumis cabai.","Blender halus."]' && sd.aktif,
    'resep diganti: hasil dan bahan baru; masa simpan, catatan, langkah tetap', sd);
  cek(JSON.stringify(bahanDi('Sambal dasar')) === '["Cabai merah 1.2","Bawang merah 0.5"]', 'bahan resep diganti', bahanDi('Sambal dasar'));
  // Resep tempelan dipakai Prep List: stock bergerak
  const sebelum = stockAkhir('Ayam fillet');
  const p = A('kirimPrep', { submissionId: crypto.randomUUID(), tanggal: hariIni, shift: 'Pagi', waktuPerangkat: new Date().toISOString(),
    baris: [{ item: 'Ayam bumbu', jumlahResep: 2, qty: '', keterangan: '' }] }, TR);
  cek(p.ok && p.data.stockHasil[0].tambah === 2.2 && Math.abs(stockAkhir('Ayam fillet') - (sebelum - 2)) < 1e-9, 'prep resep tempelan menggerakkan stock', p.ok ? p.data.stockHasil : p.pesan);
}

// 5. Resep nonaktif yang diganti tetap nonaktif; masa simpan dan langkah terisi menggantikan
{
  A('aturResepAktif', { itemHasil: 'Ayam bumbu', aktif: false });
  const r = A('tempelResep', { resep: [{ no: 2, ganti: true, itemHasil: 'Ayam bumbu', hasil: 1, masaSimpan: '2', langkah: ['Rendam 2 jam.'],
    bahan: [{ item: 'Ayam fillet', qty: 1 }, { item: 'Bumbu tabur', qty: 0.1 }] }] });
  const ab = r.ok && resep(r.data, 'Ayam bumbu');
  cek(ab && !ab.aktif && ab.masaSimpan === 2 && JSON.stringify(ab.langkah) === '["Rendam 2 jam."]' && baris('Ayam bumbu').aktif === false,
    'resep nonaktif diganti tetap nonaktif', ab || r.pesan);
  A('aturResepAktif', { itemHasil: 'Ayam bumbu', aktif: true });
}

// 6. Penolakan: satu resep salah menolak semuanya
{
  const sebelum = JSON.stringify(bahanDi('Sambal dasar'));
  const baik = { no: 2, ganti: false, itemHasil: 'Telur rebus', hasil: 10, masaSimpan: '1', bahan: [{ item: 'Telur', qty: 10 }] };
  let r = A('tempelResep', { resep: [baik, { no: 5, ganti: false, itemHasil: 'Nasi putih', hasil: 10, masaSimpan: '', bahan: [{ item: 'Beras', qty: 1 }] }] });
  cek(!r.ok && /^Resep Nasi putih \(baris 5\): Bahan Beras tidak ada/.test(r.pesan) && !baris('Telur rebus'), 'bahan tidak ada: semua ditolak dengan nomor baris', r.pesan);
  r = A('tempelResep', { resep: [baik, Object.assign({}, baik, { no: 9 })] });
  cek(!r.ok && /baris 9.*tertulis dua kali di tempelan/.test(r.pesan) && !baris('Telur rebus'), 'item hasil dua kali ditolak', r.pesan);
  r = A('tempelResep', { resep: [{ no: 3, ganti: false, itemHasil: 'Sambal dasar', hasil: 2, masaSimpan: '', bahan: bahanSambal }] });
  cek(!r.ok && /ternyata sudah punya resep/.test(r.pesan) && JSON.stringify(bahanDi('Sambal dasar')) === sebelum, 'resep yang sudah ada tanpa ganti ditolak', r.pesan);
  r = A('tempelResep', { resep: [{ no: 2, ganti: true, itemHasil: 'Bumbu tabur', hasil: 1, masaSimpan: '', bahan: [{ item: 'Ayam bumbu', qty: 1 }] }] });
  cek(!r.ok && /Bumbu tabur \(baris 2\): Ayam bumbu sudah memakai Bumbu tabur/.test(r.pesan), 'melingkar dengan resep tersimpan ditolak', r.pesan);
  r = A('tempelResep', { resep: [
    { no: 2, ganti: false, itemHasil: 'Telur rebus', hasil: 10, masaSimpan: '', bahan: [{ item: 'Nasi putih', qty: 1 }] },
    { no: 4, ganti: false, itemHasil: 'Nasi putih', hasil: 10, masaSimpan: '', bahan: [{ item: 'Telur rebus', qty: 1 }] }
  ] });
  cek(!r.ok && /melingkar|sudah memakai/.test(r.pesan) && !baris('Telur rebus') && !baris('Nasi putih'), 'melingkar di antara resep tempelan ditolak', r.pesan);
  r = A('tempelResep', { resep: [Object.assign({}, baik, { hasil: 0 })] });
  cek(!r.ok && /Hasil per 1 resep harus lebih dari 0/.test(r.pesan), 'hasil 0 ditolak', r.pesan);
  r = A('tempelResep', { resep: [Object.assign({}, baik, { catatan: 'x'.repeat(201) })] });
  cek(!r.ok && /paling panjang 200/.test(r.pesan), 'catatan 201 huruf ditolak', r.pesan);
  r = A('tempelResep', { resep: Array.from({ length: 51 }, (_, i) => Object.assign({}, baik, { no: i + 1 })) });
  cek(!r.ok && /Paling banyak 50 resep/.test(r.pesan), 'lebih dari 50 resep ditolak', r.pesan);
  r = A('tempelResep', { resep: [] });
  cek(!r.ok && /Tidak ada resep/.test(r.pesan), 'tempelan kosong ditolak', r.pesan);
  r = A('tempelResep', { resep: [baik] });
  cek(r.ok && resep(r.data, 'Telur rebus').masaSimpan === 1 && JSON.stringify(r.data.tempel.baru) === '["Telur rebus"]', 'sesudah dibetulkan: tersimpan');
}

console.log('lulus', lulus, 'gagal', gagal);
