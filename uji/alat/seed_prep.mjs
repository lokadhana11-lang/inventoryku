// Data tambahan untuk uji saran prep (Code.gs v0.44): empat barang jadi beresep dengan pemakaian tercatat, di atas seed.mjs.
// Pakai sesudah seed(); token Pengelola. Hasil tiap item (stock dan rata-rata pemakaian) ditulis di samping.
import * as H from './harness.mjs';

export function seedPrep(token) {
  const A = (action, b) => {
    const r = H.aksi(Object.assign({ action, token }, b));
    if (!r.ok) throw new Error(action + ': ' + r.pesan);
    return r.data;
  };
  const hari = (n) => new Date(Date.now() + H.geserWaktu + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  const w = () => new Date().toISOString();
  const keluar = (item, n, q) => A('kirimStock', { submissionId: crypto.randomUUID(), tanggal: hari(n), kategori: 'Barang jadi', waktuPerangkat: w(),
    baris: [{ item, masuk: '', keluar: q }] });
  const pembuka = (item, n, q) => A('sesuaikanStock', { submissionId: crypto.randomUUID(), item, tanggal: hari(n), stockSebenarnya: q,
    alasan: 'Stok pembuka', catatan: '' });
  const item = (nama) => A('simpanItem', { baru: true, nama, kategori: 'Barang jadi', satuan: 'kg', harga: '', stokMin: '', stokMaks: '' });
  // Saus kacang: hasil 2 kg; pembuka 12 kg 10 hari lalu, keluar 1 kg sehari 9 hari, 2 kg hari ini → stock 1, rata 0,9 → ½ resep.
  item('Saus kacang');
  A('simpanResep', { baru: true, itemHasil: 'Saus kacang', hasil: 2, masaSimpan: 3, bahan: [{ item: 'Cabai merah', qty: 0.2 }] });
  pembuka('Saus kacang', -10, 12);
  for (let i = 9; i >= 1; i--) keluar('Saus kacang', -i, 1);
  keluar('Saus kacang', 0, 2);
  // Bumbu kuning: hasil 1 kg, masa simpan 1 hari; pembuka 5 kg 5 hari lalu, keluar 1 kg sehari 4 hari, 0,5 hari ini → stock 0,5,
  // rata 0,8; target 1 hari 0,8 → ½ resep.
  item('Bumbu kuning');
  A('simpanResep', { baru: true, itemHasil: 'Bumbu kuning', hasil: 1, masaSimpan: 1, bahan: [{ item: 'Bawang putih', qty: 0.1 }] });
  pembuka('Bumbu kuning', -5, 5);
  for (let i = 4; i >= 1; i--) keluar('Bumbu kuning', -i, 1);
  keluar('Bumbu kuning', 0, 0.5);
  // Saus tomat: hasil 0,5 kg; pembuka 10 kg 10 hari lalu, keluar 0,6 kg sehari 9 hari, 4,6 hari ini → stock 0, rata 0,54;
  // target 1,08 → 2½ resep.
  item('Saus tomat');
  A('simpanResep', { baru: true, itemHasil: 'Saus tomat', hasil: 0.5, bahan: [{ item: 'Tomat', qty: 0.1 }] });
  pembuka('Saus tomat', -10, 10);
  for (let i = 9; i >= 1; i--) keluar('Saus tomat', -i, 0.6);
  keluar('Saus tomat', 0, 4.6);
  // Kaldu ayam: hasil 3 kg; pembuka 10 kg 6 hari lalu, keluar 1 kg sehari 5 hari → stock 5, rata 0,833 → belum perlu (± 6 hari).
  item('Kaldu ayam');
  A('simpanResep', { baru: true, itemHasil: 'Kaldu ayam', hasil: 3, bahan: [{ item: 'Ayam fillet', qty: 0.5 }] });
  pembuka('Kaldu ayam', -6, 10);
  for (let i = 5; i >= 1; i--) keluar('Kaldu ayam', -i, 1);
}
