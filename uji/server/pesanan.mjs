// Uji server: daftar belanja per pemasok dan pesanan (Code.gs v0.29).
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';
let gagal = 0, lulus = 0;
const cek = (k, label, x) => { if (k) lulus++; else { gagal++; console.log('GAGAL:', label, x !== undefined ? JSON.stringify(x).slice(0, 600) : ''); } };
const s = seed();
const T = s.token;
const TR = H.aksi({ action: 'login', nama: 'Rina', pin: '730264' }).data.token;
const TS = H.aksi({ action: 'login', nama: 'Sari', pin: '916205' }).data.token;
const hari = (n) => new Date(Date.now() + H.geserWaktu + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const uid = () => crypto.randomUUID();
const hariIni = hari(0), kemarin = hari(-1);
const A = (action, b, tok = T) => H.aksi(Object.assign({ action, token: tok }, b));
const belanja = (tok = T) => A('daftarBelanja', {}, tok).data;
const form = (tg = hariIni, tok = TR) => A('formStock', { tanggal: tg }, tok).data;
const kirim = (baris, ekstra = {}, tok = TR, tg = hariIni) => A('kirimStock', Object.assign({ submissionId: uid(), tanggal: tg, kategori: 'x', waktuPerangkat: new Date().toISOString(), baris }, ekstra), tok);
const pesan = (pemasok, baris, ekstra = {}, tok = T) => A('catatPesanan', Object.assign({ submissionId: uid(), tanggal: hariIni, waktuPerangkat: new Date().toISOString(), pemasok, baris }, ekstra), tok);
const barisPesanan = () => {
  const v = H.ss.getSheetByName('Data_Pesanan').getDataRange().getValues();
  return v.slice(1).filter((r) => r[0] !== '' && r[0] != null).map((r) => Object.fromEntries(v[0].map((j, i) => [j, r[i]])));
};
const jumlahStock = () => H.ss.getSheetByName('Data_Stock').getDataRange().getValues().slice(1).filter((r) => r[0] !== '' && r[0] != null).length;
const akhir = (nama) => form(hariIni, T).item.find((i) => i.nama === nama).akhir;
const kelompok = (d, nama) => d.pemasok.find((g) => g.nama === nama);
const itemDi = (d, item) => { for (const g of d.pemasok) { const it = g.item.find((i) => i.nama === item); if (it) return { g, it }; } return null; };

// Ayam fillet dan Air mineral di bawah minimum: Ayam pemasok terakhir Toko Ayam Jaya (dari seed).
cek(kirim([{ item: 'Ayam fillet', keluar: akhir('Ayam fillet') - 2 }, { item: 'Air mineral', keluar: 40 }], {}, T).ok, 'siapkan stock');

// 1. Bentuk daftarBelanja
{
  const d = belanja();
  cek(d.pesananSiap === true && Array.isArray(d.pemasok) && Array.isArray(d.kategori) && Array.isArray(d.menunggu) && d.menunggu.length === 0, 'bentuk daftarBelanja', d);
  cek(d.outlet === 'Dapur Contoh', 'outlet');
  const a = itemDi(d, 'Ayam fillet');
  cek(a && a.g.nama === 'Toko Ayam Jaya' && a.it.terakhir.pemasok === 'Toko Ayam Jaya' && a.it.dipesan === null, 'Ayam di kelompok pemasok terakhir', a);
  const kosong = kelompok(d, '');
  cek(kosong && d.pemasok[d.pemasok.length - 1] === kosong && kosong.item.some((i) => i.nama === 'Tomat'), 'Belum ada pemasok paling bawah', d.pemasok.map((g) => g.nama));
  // urut kategori lalu nama di kelompok ''
  const kat = kosong.item.map((i) => i.kategori);
  cek(kat.indexOf('Protein') < kat.lastIndexOf('Bumbu') && kat.indexOf('Minuman') > kat.indexOf('Bumbu'), 'urut kategori', kosong.item.map((i) => [i.kategori, i.nama]));
  cek(d.pilihanPemasok.find((p) => p.nama === 'Sumber Segar').wa === '6281200001111' && d.pilihanPemasok.find((p) => p.nama === 'Toko Ayam Jaya').wa === '', 'wa pilihanPemasok', d.pilihanPemasok);
  cek(kelompok(d, 'Toko Ayam Jaya').wa === '' && kelompok(d, 'Toko Ayam Jaya').kontak === '', 'kelompok tanpa nomor');
  // kategori lama tetap ada
  cek(d.kategori.some((g) => g.item.some((i) => i.nama === 'Ayam fillet')), 'kategori lama tetap');
}

// 2. nomorWa_
{
  const w = H.ambil('nomorWa_');
  const kasus = [['+62 812 0000 1111', '6281200001111'], ['0812-3456-7890', '6281234567890'], ['Pak Budi (0812) 3456.7890', '6281234567890'],
    ['812 3456 7890', '6281234567890'], ['6281234567890', '6281234567890'], ['+1 (555) 123-4567', '15551234567'], ['021 555', ''], ['', ''],
    ['email: toko@contoh.invalid', ''], ['0812 3456 7890 / 021 5551 2345', '6281234567890']];
  kasus.forEach(([a, b]) => cek(w(a) === b, 'nomorWa ' + a, w(a)));
}

// 3. Validasi catatPesanan
{
  cek(!pesan('Sumber Segar', [{ item: 'Tomat', jumlah: 5, satuanOrder: 'dasar' }], {}, TR).ok, 'Staff ditolak');
  cek(/Pilih pemasok/.test(pesan('', [{ item: 'Tomat', jumlah: 5 }]).pesan), 'tanpa pemasok');
  cek(/tidak ada di daftar pemasok/.test(pesan('Toko Hantu', [{ item: 'Tomat', jumlah: 5 }]).pesan), 'pemasok tak dikenal');
  cek(/minimal/.test(pesan('Sumber Segar', []).pesan), 'tanpa baris');
  cek(/dua kali/.test(pesan('Sumber Segar', [{ item: 'Tomat', jumlah: 5 }, { item: 'tomat', jumlah: 1 }]).pesan), 'item ganda');
  cek(/lebih dari 0/.test(pesan('Sumber Segar', [{ item: 'Tomat', jumlah: 0 }]).pesan), 'jumlah 0');
  cek(!pesan('Sumber Segar', [{ item: 'Tomat', jumlah: 'dua' }]).ok, 'jumlah huruf');
  cek(/satuan besar/.test(pesan('Sumber Segar', [{ item: 'Tomat', jumlah: 1, satuanOrder: 'besar' }]).pesan), 'besar tanpa satuan besar');
  cek(/tidak ada di daftar item/.test(pesan('Sumber Segar', [{ item: 'Durian', jumlah: 1 }]).pesan), 'item tak dikenal');
  cek(barisPesanan().length === 0, 'tidak ada yang tertulis');
}

// 4. Catat pesanan Sumber Segar: Tomat 5 kg, Air mineral 3 dus, Bawang merah 3,5 kg
let idA;
{
  idA = uid();
  const r = pesan('sumber segar', [{ item: 'Tomat', jumlah: 5, satuanOrder: 'dasar' }, { item: 'Air mineral', jumlah: 3, satuanOrder: 'besar' }, { item: 'Bawang merah', jumlah: '3,5', satuanOrder: 'dasar' }], { submissionId: idA });
  cek(r.ok && r.data.jumlah === 3 && r.data.pemasok === 'Sumber Segar' && r.data.diganti.length === 0 && r.data.sudahDatang.length === 0, 'catatPesanan ok', r);
  const b = barisPesanan();
  const air = b.find((x) => x['Nama Item'] === 'Air mineral');
  cek(b.length === 3 && b.every((x) => x.Keadaan === 'Menunggu' && x.Pemasok === 'Sumber Segar' && x.submission_id === idA && x.submitted_by === 'Budi'), 'baris Menunggu', b);
  cek(air.Jumlah === 3 && air['Satuan Order'] === 'dus' && air['Jumlah Dasar'] === 72 && air.Satuan === 'botol' && air.Kategori === 'Minuman', 'satuan besar dicatat', air);
  cek(b.find((x) => x['Nama Item'] === 'Bawang merah').Jumlah === 3.5, 'koma desimal');
  // ulang dengan id sama
  const u = pesan('Sumber Segar', [{ item: 'Tomat', jumlah: 5 }], { submissionId: idA });
  cek(u.ok && u.data.sudahTerkirim === true && barisPesanan().length === 3, 'kiriman ulang');
  const d = r.data.belanja;
  const t = itemDi(d, 'Tomat');
  cek(t.g.nama === 'Sumber Segar' && t.it.dipesan && t.it.dipesan.id === idA && t.it.dipesan.jumlah === 5 && t.it.dipesan.satuanOrder === 'kg' && t.it.dipesan.oleh === 'Budi', 'Tomat pindah ke kelompok pesanan', t);
  cek(kelompok(d, 'Sumber Segar').wa === '6281200001111' && kelompok(d, 'Sumber Segar').kontak === '+62 812 0000 1111', 'kelompok membawa wa');
  cek(d.menunggu.length === 1 && d.menunggu[0].id === idA && d.menunggu[0].item.length === 3 && d.menunggu[0].oleh === 'Budi' && d.menunggu[0].waktu, 'menunggu', d.menunggu);
}

// 5. formStock membawa pesanan (Staff juga), dan tidak untuk tanggal sebelum pesanan
{
  const f = form();
  cek(f.pesananSiap === true && f.pesanan.length === 1 && f.pesanan[0].pemasok === 'Sumber Segar' && f.pesanan[0].item.length === 3, 'formStock.pesanan', f.pesanan);
  const air = f.pesanan[0].item.find((i) => i.nama === 'Air mineral');
  cek(air.jumlah === 3 && air.satuanOrder === 'dus' && air.dasar === 72 && air.satuan === 'botol', 'item pesanan', air);
  cek(form(kemarin).pesanan.length === 0, 'kemarin tidak ada pesanan');
  cek(JSON.stringify(f.pesanan).indexOf('Rp') < 0 && !('harga' in air), 'tanpa rupiah');
}

// 6. Pesanan baru untuk item yang sudah dipesan: hanya item itu yang diganti
let idB;
{
  idB = uid();
  const r = pesan('Toko Ayam Jaya', [{ item: 'Tomat', jumlah: 4 }, { item: 'Ayam fillet', jumlah: 10 }], { submissionId: idB });
  cek(r.ok && r.data.diganti.length === 1 && r.data.diganti[0].item === 'Tomat' && r.data.diganti[0].pemasok === 'Sumber Segar', 'per item Diganti', r.data);
  const b = barisPesanan();
  cek(b.find((x) => x.submission_id === idA && x['Nama Item'] === 'Tomat').Keadaan === 'Diganti' &&
    b.find((x) => x.submission_id === idA && x['Nama Item'] === 'Air mineral').Keadaan === 'Menunggu', 'item lain tetap menunggu', b.map((x) => [x.submission_id === idA ? 'A' : 'B', x['Nama Item'], x.Keadaan]));
  const d = r.data.belanja;
  cek(itemDi(d, 'Tomat').g.nama === 'Toko Ayam Jaya' && d.menunggu.length === 2, 'Tomat ikut pesanan terbaru', d.menunggu.map((g) => [g.pemasok, g.item.length]));
}

// 7. kirimStock menyelesaikan pesanan
{
  // pemasok lain: tidak menyelesaikan
  let r = kirim([{ item: 'Ayam fillet', masuk: 2 }], { pemasok: 'Sumber Segar' });
  cek(r.ok && !r.data.pesananDatang, 'pemasok lain tidak menyelesaikan', r.data && r.data.pesananDatang);
  // pemasok sama (huruf kecil): selesai
  r = kirim([{ item: 'Ayam fillet', masuk: 10 }, { item: 'Telur', keluar: 1 }], { pemasok: 'toko ayam jaya' });
  cek(r.ok && r.data.pesananDatang && r.data.pesananDatang.length === 1 && r.data.pesananDatang[0].item === 'Ayam fillet' && r.data.pesananDatang[0].pemasok === 'Toko Ayam Jaya', 'pemasok sama menyelesaikan', r.data);
  const rowAyam = barisPesanan().find((x) => x['Nama Item'] === 'Ayam fillet');
  cek(rowAyam.Keadaan === 'Datang' && rowAyam['Selesai Oleh'] === 'Rina' && rowAyam['Selesai Pada'] instanceof Date && rowAyam['Kiriman Stock'], 'kolom selesai', rowAyam);
  // tanpa pemasok: menyelesaikan pesanan mana pun
  r = kirim([{ item: 'Bawang merah', masuk: 3.5 }]);
  cek(r.ok && r.data.pesananDatang && r.data.pesananDatang[0].pemasok === 'Sumber Segar', 'tanpa pemasok menyelesaikan', r.data && r.data.pesananDatang);
  // keluar saja / hitung sisa tanpa masuk: tidak menyelesaikan
  r = kirim([{ item: 'Tomat', keluar: 0.1 }]);
  cek(r.ok && !r.data.pesananDatang, 'keluar saja tidak menyelesaikan');
  cek(form().pesanan.map((g) => g.pemasok).sort().join() === 'Sumber Segar,Toko Ayam Jaya', 'form masih punya dua pesanan', form().pesanan);
}

// 8. Tautan pesanan: diisi dari dua HP
{
  const n0 = jumlahStock();
  const airA = barisPesanan().find((x) => x['Nama Item'] === 'Air mineral');
  const r1 = kirim([{ item: 'Air mineral', masuk: 3, satuanMasuk: 'besar', pesanan: idA }], { pemasok: 'Sumber Segar' });
  cek(r1.ok && r1.data.pesananDatang && r1.data.pesananDatang[0].item === 'Air mineral', 'tautan menyelesaikan', r1.data);
  const n1 = jumlahStock();
  const r2 = kirim([{ item: 'Air mineral', masuk: 3, satuanMasuk: 'besar', pesanan: idA }, { item: 'Telur', keluar: 1 }], { pemasok: 'Sumber Segar' }, TS);
  const sd = r2.data && r2.data.pesananSudahDatang;
  cek(r2.ok && r2.data.jumlah === 1 && sd && sd.length === 1 && sd[0].item === 'Air mineral' && sd[0].pemasok === 'Sumber Segar' && sd[0].oleh === 'Rina' && sd[0].waktu,
    'tautan kedua: masuk tidak dicatat, baris lain tetap', r2);
  cek(jumlahStock() === n1 + 1 && n1 === n0 + 1, 'hanya Telur yang tertulis', { n0, n1, n2: jumlahStock() });
  const airMasuk = H.ss.getSheetByName('Data_Stock').getDataRange().getValues().filter((x) => x[2] === 'Air mineral').length;
  cek(airMasuk >= 1 && !r2.data.pesananDatang, 'Air mineral tidak dicatat dua kali');
  // tautan ke pesanan yang diganti pesanan ke pemasok lain: dicatat sebagai barang masuk biasa
  const r3 = kirim([{ item: 'Tomat', masuk: 0.5, pesanan: idA }], { pemasok: 'Sumber Segar' });
  cek(r3.ok && r3.data.jumlah === 1 && !r3.data.pesananSudahDatang && !r3.data.pesananDatang, 'diganti ke pemasok lain: masuk biasa', r3);
  // tautan ke id tak dikenal: dianggap tanpa tautan
  const r4 = kirim([{ item: 'Telur', masuk: 6, pesanan: 'tidak-ada-12345' }]);
  cek(r4.ok, 'tautan tak dikenal diabaikan', r4);
}

// 9. Tautan ke pesanan yang diganti pesanan baru dari pemasok yang sama → pesanan baru
{
  const id1 = uid(), id2 = uid();
  pesan('Sumber Segar', [{ item: 'Cabai merah', jumlah: 1 }], { submissionId: id1 });
  pesan('Sumber Segar', [{ item: 'Cabai merah', jumlah: 2 }], { submissionId: id2 });
  const r = kirim([{ item: 'Cabai merah', masuk: 2, pesanan: id1 }], { pemasok: 'Sumber Segar' });
  const b = barisPesanan().filter((x) => x['Nama Item'] === 'Cabai merah');
  cek(r.ok && b.find((x) => x.submission_id === id1).Keadaan === 'Diganti' && b.find((x) => x.submission_id === id2).Keadaan === 'Datang', 'tautan dialihkan ke pesanan baru', b.map((x) => [x.submission_id === id1 ? 1 : 2, x.Keadaan]));
}

// 10. tutupPesanan
{
  cek(!A('tutupPesanan', { id: idB }, TR).ok, 'Staff tidak bisa menutup');
  const r = A('tutupPesanan', { id: idB, tanggal: hariIni });
  cek(r.ok && r.data.ditutup === 1 && r.data.form && r.data.belanja, 'tutup', r);
  cek(barisPesanan().find((x) => x.submission_id === idB && x['Nama Item'] === 'Tomat').Keadaan === 'Ditutup', 'Ditutup tertulis');
  const r2 = A('tutupPesanan', { id: idB });
  cek(r2.ok && r2.data.ditutup === 0 && !r2.data.form, 'tutup lagi 0');
  cek(form().pesanan.length === 0, 'form tanpa pesanan', form().pesanan);
}

// 11. Pesanan dari antrean yang terlambat: barang sudah dicatat masuk sejak tombol diketuk
{
  const ketuk = new Date(Date.now() - 1).toISOString();
  kirim([{ item: 'Bawang putih', masuk: 2 }]); // tanpa pemasok, sesudah ketuk
  kirim([{ item: 'Telur', masuk: 30 }], { pemasok: 'Toko Ayam Jaya' }); // pemasok lain
  const r = pesan('Sumber Segar', [{ item: 'Bawang putih', jumlah: 3 }, { item: 'Telur', jumlah: 60 }], { waktuPerangkat: ketuk });
  cek(r.ok && r.data.sudahDatang.length === 1 && r.data.sudahDatang[0] === 'Bawang putih', 'sudahDatang', r.data);
  const b = barisPesanan().filter((x) => x.submission_id === r.data.id);
  cek(b.find((x) => x['Nama Item'] === 'Bawang putih').Keadaan === 'Datang' && b.find((x) => x['Nama Item'] === 'Bawang putih')['Selesai Oleh'] === 'Rina' &&
    b.find((x) => x['Nama Item'] === 'Telur').Keadaan === 'Menunggu', 'Bawang putih langsung Datang, Telur menunggu', b.map((x) => [x['Nama Item'], x.Keadaan]));
  // waktu perangkat sangat lama: hanya 7 hari terakhir
  const lama = pesan('Sumber Segar', [{ item: 'Ayam fillet', jumlah: 3 }], { waktuPerangkat: new Date(Date.now() - 30 * 86400000).toISOString() });
  cek(lama.ok && lama.data.sudahDatang.length === 1, 'waktu lama dibatasi 7 hari: Ayam dari Sumber Segar tadi Datang', lama.data);
}

// 12. Ganti nama pemasok dan item ikut di Data_Pesanan; hapus item menutup pesanan
{
  A('simpanPemasok', { baru: true, nama: 'Pasar Pagi', kontak: '0811 222 333', catatan: '' });
  A('simpanItem', { baru: true, nama: 'Kemangi', kategori: 'Sayur', satuan: 'kg', satuanBesar: '', isiSatuanBesar: '', harga: 20000, stokMin: 1, stokMaks: 2 });
  const d0 = belanja();
  cek(itemDi(d0, 'Kemangi') && itemDi(d0, 'Kemangi').g.nama === '' && itemDi(d0, 'Kemangi').it.saran.jumlah === 2, 'item baru di Belum ada pemasok');
  const r = pesan('Pasar Pagi', [{ item: 'Kemangi', jumlah: 2 }]);
  cek(r.ok && itemDi(r.data.belanja, 'Kemangi').g.nama === 'Pasar Pagi' && kelompok(r.data.belanja, 'Pasar Pagi').wa === '62811222333', 'kelompok pemasok pesanan', kelompok(r.data.belanja, 'Pasar Pagi'));
  const g = A('simpanPemasok', { baru: false, namaLama: 'Pasar Pagi', nama: 'Pasar Subuh', kontak: '0811 222 333', catatan: '' });
  cek(g.ok && barisPesanan().some((x) => x.Pemasok === 'Pasar Subuh') && !barisPesanan().some((x) => x.Pemasok === 'Pasar Pagi'), 'ganti nama pemasok', g);
  const gi = A('simpanItem', { baru: false, namaLama: 'Kemangi', nama: 'Daun kemangi', kategori: 'Sayur', satuan: 'kg', satuanBesar: '', isiSatuanBesar: '', harga: 20000, stokMin: 1, stokMaks: 2 });
  cek(gi.ok && barisPesanan().some((x) => x['Nama Item'] === 'Daun kemangi'), 'ganti nama item', gi);
  cek(form().pesanan.some((p) => p.pemasok === 'Pasar Subuh' && p.item[0].nama === 'Daun kemangi'), 'form memakai nama baru');
  A('aturItemAktif', { nama: 'Daun kemangi', aktif: false });
  const h = A('hapusItem', { nama: 'Daun kemangi' });
  cek(h.ok, 'hapus item yang sudah dipesan', h);
  cek(barisPesanan().find((x) => x['Nama Item'] === 'Daun kemangi').Keadaan === 'Ditutup', 'pesanan item terhapus ditutup');
}

// 13. Pemasok nonaktif: pesanan tidak tampil di form Stock, tetap di menunggu
{
  const r = pesan('Toko Ayam Jaya', [{ item: 'Telur', jumlah: 30 }]);
  A('aturPemasokAktif', { nama: 'Toko Ayam Jaya', aktif: false });
  cek(!form().pesanan.some((p) => p.pemasok === 'Toko Ayam Jaya'), 'nonaktif tidak di form');
  const d = belanja();
  cek(d.menunggu.some((p) => p.pemasok === 'Toko Ayam Jaya') && !kelompok(d, 'Toko Ayam Jaya') && !d.pilihanPemasok.some((p) => p.nama === 'Toko Ayam Jaya'), 'nonaktif di menunggu, tanpa kelompok', d.pemasok.map((g) => g.nama));
  A('aturPemasokAktif', { nama: 'Toko Ayam Jaya', aktif: true });
  A('tutupPesanan', { id: r.data.id });
}

// 14. PDF per pemasok
{
  H.pdfHtml.length = 0;
  const d = belanja();
  const order = {};
  d.pemasok.forEach((g) => g.item.forEach((i) => { order[i.nama] = g.nama && !i.dipesan && i.saran ? String(i.saran.jumlah) : ''; }));
  const r = A('unduhPdfBelanja', { order });
  const html = H.pdfHtml[0] || '';
  cek(r.ok && (/Belum ada pemasok/.test(html) || !d.pemasok.some((g) => !g.nama)) && /<th[^>]*>Kategori<\/th>/.test(html) && !/hanya untuk cetakan/.test(html) && !/tidak memesan/.test(html), 'PDF per pemasok', [r.ok, r.pesan, /Belum ada pemasok/.test(html), /tidak memesan/.test(html), html.slice(html.indexOf('<table class="data">'), html.indexOf('<table class="data">')+900)]);
  cek(!/jumlah order diubah/.test(html), 'tanpa perubahan bila sama dengan bawaan layar');
  const satu = d.pemasok[0].item[0].nama;
  const r2 = A('unduhPdfBelanja', { order: Object.assign({}, order, { [satu]: '9' }) });
  cek(r2.ok && /1 jumlah order diubah/.test(H.pdfHtml[1] || ''), 'satu diubah');
  // aplikasi lama: tanpa order memakai saran
  cek(A('unduhPdfBelanja', {}).ok, 'aplikasi lama');
  const dp = d.pemasok.flatMap((g) => g.item).find((i) => i.dipesan);
  if (dp) cek(new RegExp('dipesan ').test(html), 'tanda dipesan di PDF');
}

// 15. Email harian memuat pesanan belum datang
{
  pesan('Sumber Segar', [{ item: 'Tomat', jumlah: 6 }]);
  A('simpanPenerima', { email: ['uji@contoh.invalid'] });
  H.surel.length = 0;
  H.fungsi('kirimLaporanSekarang');
  const isi = H.surel.map((x) => x.htmlBody || x.html || JSON.stringify(x)).join(' ');
  cek(/Pesanan belum datang/.test(isi) && /Tomat 6 kg/.test(isi) && /dipesan Budi lewat WhatsApp/.test(isi), 'email', isi.slice(isi.indexOf('Pesanan'), isi.indexOf('Pesanan') + 300));
}

// 16. Tanpa tab Data_Pesanan (sebelum setupSpreadsheet)
{
  const sh = H.ss.getSheetByName('Data_Pesanan');
  H.ss.deleteSheet(sh);
  const d = belanja();
  cek(d && d.pesananSiap === false && Array.isArray(d.pemasok) && d.menunggu.length === 0, 'daftarBelanja tanpa tab', d && d.pesananSiap);
  const f = form();
  cek(f.pesananSiap === false && f.pesanan.length === 0, 'formStock tanpa tab');
  cek(kirim([{ item: 'Tomat', masuk: 1, pesanan: idA }], { pemasok: 'Sumber Segar' }).ok, 'kirimStock tanpa tab');
  cek(/setupSpreadsheet/.test(pesan('Sumber Segar', [{ item: 'Tomat', jumlah: 1 }]).pesan), 'catatPesanan tanpa tab');
  H.fungsi('setupSpreadsheet');
  cek(belanja().pesananSiap === true && H.ss.getSheetByName('Data_Pesanan'), 'setupSpreadsheet membuat tab');
}

console.log('lulus', lulus, 'gagal', gagal, 'ERR log:', H.logs.filter((l) => l.startsWith('ERR')));
