import * as H from './harness.mjs';
const ok = (r, label) => { if (!r.ok) { console.log('GAGAL', label, r.pesan); } return r.data; };
const hari = (n) => { const d = new Date(Date.now() + H.geserWaktu + n * 86400000); return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }); };
let n = 0; const sid = () => 'sid-' + (++n) + '-' + Math.random().toString(36).slice(2, 10);

export function seed() {
  H.fungsi('setupSpreadsheet');
  const kode = H.ss.getSheetByName('M_Konfigurasi').getDataRange().getValues().find((r) => r[0] === 'kode_pemasangan')[1];
  const d = ok(H.aksi({ action: 'pasang', kode, namaOutlet: 'Dapur Contoh', nama: 'Budi', role: 'Head Kitchen', pin: '482915', zonaWaktu: 'Asia/Jakarta' }), 'pasang');
  const T = d.token;
  const A = (action, b) => ok(H.aksi(Object.assign({ action, token: T }, b)), action);
  A('tambahStaff', { nama: 'Rina', role: 'Staff', pin: '730264' });
  A('tambahStaff', { nama: 'Sari', role: 'Manager', pin: '916205' });
  A('tambahStaff', { nama: 'Andi', role: 'Staff', pin: '305718' });
  ['Protein', 'Sayur', 'Bumbu', 'Minuman', 'Barang jadi'].forEach((k) => A('simpanKategori', { baru: true, nama: k }));
  const items = [
    ['Ayam fillet', 'Protein', 'kg', '', '', 52000, 5, 20, 3],
    ['Daging sapi', 'Protein', 'kg', '', '', 135000, 3, 10, 3],
    ['Telur', 'Protein', 'butir', '', '', 2200, 60, 180, 14],
    ['Tomat', 'Sayur', 'kg', '', '', 15000, 2, 6, 5],
    ['Bawang merah', 'Bumbu', 'kg', '', '', 38000, 1, 4, 30],
    ['Bawang putih', 'Bumbu', 'kg', '', '', 34000, 1, 4, 30],
    ['Cabai merah', 'Bumbu', 'kg', '', '', 60000, 1, 3, 7],
    ['Minyak goreng', 'Bumbu', 'liter', 'jerigen', 18, 17500, 10, 36, ''],
    ['Air mineral', 'Minuman', 'botol', 'dus', 24, 3500, 24, 96, ''],
    ['Sambal dasar', 'Barang jadi', 'kg', '', '', '', 1, 3, ''],
    ['Nasi putih', 'Barang jadi', 'porsi', '', '', 4000, '', '', ''],
  ];
  items.forEach(([nama, kategori, satuan, besar, isi, harga, mn, mx, ms]) => {
    const b = { baru: true, nama, kategori, satuan, satuanBesar: besar, isiSatuanBesar: isi, harga, stokMin: mn, stokMaks: mx };
    if (ms !== '') b.masaSimpan = ms;
    A('simpanItem', b);
  });
  ['Chiller 1', 'Chiller 2'].forEach((u) => A('simpanUnit', { baru: true, nama: u, tipe: 'Chiller' }));
  A('simpanUnit', { baru: true, nama: 'Freezer 1', tipe: 'Freezer' });
  A('simpanPemasok', { baru: true, nama: 'Sumber Segar', kontak: '+62 812 0000 1111', catatan: 'Sayur dan bumbu' });
  A('simpanPemasok', { baru: true, nama: 'Toko Ayam Jaya', kontak: '', catatan: '' });
  A('simpanResep', { baru: true, itemHasil: 'Sambal dasar', hasil: 2, masaSimpan: 3, bahan: [{ item: 'Cabai merah', qty: 1 }, { item: 'Bawang merah', qty: 0.5 }, { item: 'Tomat', qty: 0.5 }, { item: 'Minyak goreng', qty: 0.3 }] });
  A('simpanMenu', { baru: true, nama: 'Ayam geprek', hargaJual: 28000, bahan: [{ item: 'Ayam fillet', qty: 0.15, hasilBersih: 90 }, { item: 'Sambal dasar', qty: 0.04 }, { item: 'Nasi putih', qty: 1 }, { item: 'Minyak goreng', qty: 0.05 }] });
  A('simpanMenu', { baru: true, nama: 'Telur balado', hargaJual: 15000, bahan: [{ item: 'Telur', qty: 2 }, { item: 'Sambal dasar', qty: 0.05 }, { item: 'Nasi putih', qty: 1 }] });
  // Stok pembuka 12 hari lalu
  H.aturGeser(-12 * 86400000);
  const T0 = T;
  const pembuka = { 'Ayam fillet': 10, 'Daging sapi': 4, 'Telur': 120, 'Tomat': 4, 'Bawang merah': 3, 'Bawang putih': 2, 'Cabai merah': 2, 'Minyak goreng': 20, 'Air mineral': 48, 'Nasi putih': 0.0001 };
  Object.entries(pembuka).forEach(([item, q]) => { if (item !== 'Nasi putih') A('sesuaikanStock', { submissionId: sid(), item, tanggal: hari(0), stockSebenarnya: q, alasan: 'Stok pembuka', catatan: '' }); });
  for (let i = 11; i >= 1; i--) {
    H.aturGeser(-i * 86400000);
    const tg = hari(0);
    A('kirimStock', { submissionId: sid(), tanggal: tg, kategori: 'Protein', waktuPerangkat: new Date().toISOString(), pemasok: i % 3 === 0 ? 'Toko Ayam Jaya' : '', baris: [{ item: 'Ayam fillet', masuk: i % 3 === 0 ? 8 : '', keluar: 2.5, satuanMasuk: 'dasar', hargaBeli: i % 3 === 0 ? (i === 3 ? 54000 : 52000) : '' }, { item: 'Telur', masuk: '', keluar: 12 }] });
    A('kirimStock', { submissionId: sid(), tanggal: tg, kategori: 'Bumbu', waktuPerangkat: new Date().toISOString(), baris: [{ item: 'Bawang putih', masuk: '', keluar: 0.2 }, { item: 'Cabai merah', masuk: i % 4 === 0 ? 2 : '', keluar: '' }] });
    ['Opening', 'Middle', 'Closing'].forEach((w, j) => {
      if (i === 5 && w === 'Middle') return;
      const baris = [{ unit: 'Chiller 1', suhu: i === 2 && w === 'Middle' ? 8 : 3.5 }, { unit: 'Chiller 2', suhu: 4 }, { unit: 'Freezer 1', suhu: -19 }];
      if (i === 2 && w === 'Middle') baris[0].tindakan = 'Pintu tidak rapat, ditutup';
      A('kirimSuhu', { submissionId: sid(), tanggal: tg, waktuCek: w, waktuPerangkat: new Date().toISOString(), baris });
    });
    if (i % 2 === 0) A('kirimPrep', { submissionId: sid(), tanggal: tg, shift: 'Pagi', waktuPerangkat: new Date().toISOString(), baris: [{ item: 'Sambal dasar', jumlahResep: 1, qty: '', keterangan: '' }] });
    if (i % 3 === 1) A('kirimWaste', { submissionId: sid(), tanggal: tg, shift: 'Malam', waktuPerangkat: new Date().toISOString(), baris: [{ item: 'Tomat', kategori: 'Rusak', qty: 0.3, alasan: '' }] });
    A('simpanPenjualan', { tanggal: tg, penjualan: 950000 + i * 10000, catatan: '', submissionId: sid(), porsi: [{ menu: 'Ayam geprek', porsi: 25 }, { menu: 'Telur balado', porsi: 12 }] });
  }
  H.aturGeser(0);
  // hari ini: sebagian
  A('kirimSuhu', { submissionId: sid(), tanggal: hari(0), waktuCek: 'Opening', waktuPerangkat: new Date().toISOString(), baris: [{ unit: 'Chiller 1', suhu: 3 }, { unit: 'Chiller 2', suhu: 4.5 }, { unit: 'Freezer 1', suhu: -20 }] });
  // Staff: lupa PIN
  H.aksi({ action: 'lupaPin', nama: 'Andi' });
  return { token: T };
}
