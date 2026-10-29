// Uji server: ubah banyak item sekaligus (Code.gs v0.33).
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';
let lulus = 0, gagal = 0;
function cek(label, k, info) { if (k) lulus++; else { gagal++; console.log('GAGAL:', label, info !== undefined ? JSON.stringify(info).slice(0, 700) : ''); } }
const tgl = (n) => new Date(Date.now() + H.geserWaktu + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
seed();
const TB = H.aksi({ action: 'login', nama: 'Budi', pin: '482915' }).data.token;
const TR = H.aksi({ action: 'login', nama: 'Rina', pin: '730264' }).data.token;
const A = (action, b, tok) => H.aksi(Object.assign({ action, token: tok || TB }, b));
const item = (d, n) => d.item.find((x) => x.nama === n);
const barisHarga = (n) => H.ss.getSheetByName('M_HargaItem').getDataRange().getValues().filter((r) => r[0] === n);
const HARI = tgl(0);

/* gantiHargaBanyak */
{
  const d0 = A('daftarItem', {}).data;
  cek('ubahBanyakSiap', d0.ubahBanyakSiap === true);
  const r = A('gantiHargaBanyak', { berlakuMulai: HARI, harga: [{ nama: 'Tomat', harga: 16000 }, { nama: 'cabai merah', harga: '62000' }, { nama: 'Sambal dasar', harga: 45000 }, { nama: 'Telur', harga: 2200 }] });
  cek('berhasil', r.ok, r);
  const h = r.data.hargaDisimpan;
  cek('jumlah 3, sama Telur, pertama Sambal', h.jumlah === 3 && h.sama.join() === 'Telur' && h.pertama.join() === 'Sambal dasar', h);
  cek('Tomat 16000 hari ini', item(r.data, 'Tomat').harga === 16000 && item(r.data, 'Tomat').hargaSejak === HARI, item(r.data, 'Tomat'));
  cek('Cabai 62000', item(r.data, 'Cabai merah').harga === 62000);
  cek('Sambal harga pertama sejak awal', item(r.data, 'Sambal dasar').harga === 45000 && item(r.data, 'Sambal dasar').hargaSejak === '', item(r.data, 'Sambal dasar'));
  cek('Tomat: harga lama tetap kemarin (2 baris)', barisHarga('Tomat').length === 2);
  const w = A('formWaste', { tanggal: tgl(-1) }).data;
  cek('harga kemarin tetap 15000', w.item.find((x) => x.nama === 'Tomat').harga === 15000);
  // tanggal sama lagi: mengganti, Log_Perubahan
  const r2 = A('gantiHargaBanyak', { berlakuMulai: HARI, harga: [{ nama: 'Tomat', harga: 16500 }] });
  cek('mengganti tanggal yang sama', r2.ok && r2.data.hargaDisimpan.mengganti === 1 && barisHarga('Tomat').length === 2, r2.data && r2.data.hargaDisimpan);
  const log = H.ss.getSheetByName('Log_Perubahan').getDataRange().getValues().filter((x) => x[2] === 'M_HargaItem' && /Tomat/.test(x[3]));
  cek('Log_Perubahan harga', log.length === 1 && log[0][5] === '16000' && log[0][6] === '16500', log);
  // Tanggal lewat
  const r3 = A('gantiHargaBanyak', { berlakuMulai: tgl(-5), harga: [{ nama: 'Bawang putih', harga: 30000 }] });
  cek('tanggal lewat', r3.ok && item(r3.data, 'Bawang putih').harga === 30000 && barisHarga('Bawang putih').length === 2, r3);
  // Penolakan, semuanya atau tidak sama sekali
  const sebelum = barisHarga('Daging sapi').length;
  const t1 = A('gantiHargaBanyak', { berlakuMulai: HARI, harga: [{ nama: 'Daging sapi', harga: 140000 }, { nama: 'Tidak ada', harga: 1 }] });
  cek('item tak dikenal: tolak semua', !t1.ok && /Tidak ada tidak ditemukan/.test(t1.pesan) && barisHarga('Daging sapi').length === sebelum, t1);
  const t2 = A('gantiHargaBanyak', { berlakuMulai: HARI, harga: [{ nama: 'Daging sapi', harga: 140000 }, { nama: 'daging sapi', harga: 141000 }] });
  cek('ganda ditolak', !t2.ok && /dua kali/.test(t2.pesan), t2);
  const t3 = A('gantiHargaBanyak', { berlakuMulai: HARI, harga: [{ nama: 'Daging sapi', harga: -1 }] });
  cek('minus ditolak', !t3.ok && /Harga Daging sapi harus angka/.test(t3.pesan), t3);
  const t4 = A('gantiHargaBanyak', { berlakuMulai: tgl(1), harga: [{ nama: 'Daging sapi', harga: 1 }] });
  cek('masa depan ditolak', !t4.ok && /belum tiba/.test(t4.pesan), t4);
  cek('kosong ditolak', !A('gantiHargaBanyak', { berlakuMulai: HARI, harga: [] }).ok);
  cek('harga kosong ditolak', /Isi harga baru untuk Daging sapi/.test(A('gantiHargaBanyak', { berlakuMulai: HARI, harga: [{ nama: 'Daging sapi', harga: '' }] }).pesan));
  const t5 = A('gantiHargaBanyak', { berlakuMulai: HARI, harga: [{ nama: 'Tomat', harga: 1 }] }, TR);
  cek('Staff ditolak', !t5.ok && /Head Kitchen atau Manager/.test(t5.pesan), t5);
  // gantiHarga satu per satu tetap sama
  const g = A('gantiHarga', { nama: 'Tomat', harga: 16500, berlakuMulai: HARI });
  cek('gantiHarga lama: sama ditolak', !g.ok && /sudah Rp 16.500/.test(g.pesan), g);
  const g2 = A('gantiHarga', { nama: 'Tomat', harga: 17000, berlakuMulai: HARI });
  cek('gantiHarga lama: mengganti', g2.ok && g2.data.hargaDisimpan.mengganti === true, g2.data && g2.data.hargaDisimpan);
}

/* tambahItemBanyak */
{
  const r = A('tambahItemBanyak', { baris: [
    { nama: 'Wortel', kategori: 'sayur', satuan: 'KG', harga: 12000, stokMin: 1, stokMaks: 5, masaSimpan: '7' },
    { nama: 'Sirup', kategori: 'Minuman', satuan: 'botol', satuanBesar: 'dus', isiSatuanBesar: 12, harga: '', stokMin: '', stokMaks: '' }
  ] });
  cek('tambah 2', r.ok && r.data.ditambah.join() === 'Wortel,Sirup', r);
  const w = item(r.data, 'Wortel');
  cek('Wortel lengkap (ejaan master)', w && w.kategori === 'Sayur' && w.satuan === 'kg' && w.harga === 12000 && w.hargaSejak === '' && w.masaSimpan === 7 && w.aktif && w.stokMaks === 5, w);
  const s = item(r.data, 'Sirup');
  cek('Sirup satuan besar, tanpa harga', s && s.satuanBesar === 'dus' && s.isiSatuanBesar === 12 && s.harga == null, s);
  cek('riwayat harga Wortel', barisHarga('Wortel').length === 1 && barisHarga('Sirup').length === 0);
  cek('form Stock memuat Wortel', A('formStock', { tanggal: HARI }).data.item.some((x) => x.nama === 'Wortel'));
  const nItem = () => H.ss.getSheetByName('M_Item').getDataRange().getValues().filter((x) => x[0]).length;
  const n0 = nItem();
  const bad = [
    [{ nama: 'Tomat', kategori: 'Sayur', satuan: 'kg' }, /Baris 1 \(Tomat\): Item Tomat sudah ada/],
    [{ nama: 'A1', kategori: 'Buah', satuan: 'kg' }, /Baris 1 \(A1\): Kategori "Buah" tidak ada/],
    [{ nama: 'A1', kategori: 'Sayur', satuan: 'ons' }, /Satuan "ons" tidak ada/],
    [{ nama: 'A1', kategori: 'Sayur', satuan: 'kg', satuanBesar: 'kg', isiSatuanBesar: 2 }, /Satuan besar harus berbeda/],
    [{ nama: 'A1', kategori: 'Sayur', satuan: 'botol', satuanBesar: 'dus', isiSatuanBesar: '' }, /Isi berapa botol dalam 1 dus/],
    [{ nama: 'A1', kategori: 'Sayur', satuan: 'kg', stokMin: 5, stokMaks: 2 }, /Stok maksimum harus/],
    [{ nama: 'A1', kategori: 'Sayur', satuan: 'kg', masaSimpan: '400' }, /Masa simpan diisi/],
    [{ nama: '=A1', kategori: 'Sayur', satuan: 'kg' }, /tidak boleh diawali/],
    [{ nama: '', kategori: 'Sayur', satuan: 'kg' }, /Baris 1: Isi nama item/],
    [{ nama: 'A1', kategori: 'Sayur', satuan: 'kg', harga: -5 }, /Harga satuan harus angka/],
  ];
  bad.forEach(([b, re], i) => {
    const x = A('tambahItemBanyak', { baris: [b] });
    cek('tolak ' + i, !x.ok && re.test(x.pesan), x.pesan);
  });
  const x = A('tambahItemBanyak', { baris: [{ nama: 'Kol', kategori: 'Sayur', satuan: 'kg' }, { nama: 'kol', kategori: 'Sayur', satuan: 'kg' }] });
  cek('ganda di tempelan: tolak semua', !x.ok && /Baris 2 \(kol\): Nama ini tertulis dua kali/.test(x.pesan) && nItem() === n0, x.pesan);
  A('simpanKategori', { baru: true, nama: 'Kemasan' });
  const nk = A('aturKategoriAktif', { nama: 'Kemasan', aktif: false });
  const y = A('tambahItemBanyak', { baris: [{ nama: 'Teh', kategori: 'Kemasan', satuan: 'botol' }] });
  cek('kategori nonaktif ditolak', nk.ok && !y.ok && /Kategori Kemasan nonaktif/.test(y.pesan), [nk.pesan, y.pesan]);
  cek('Staff ditolak', !A('tambahItemBanyak', { baris: [{ nama: 'Teh', kategori: 'Sayur', satuan: 'kg' }] }, TR).ok);
  const big = Array.from({ length: 301 }, (_, i) => ({ nama: 'X' + i, kategori: 'Sayur', satuan: 'kg' }));
  cek('301 baris ditolak', /Paling banyak 300/.test(A('tambahItemBanyak', { baris: big }).pesan));
  const big2 = Array.from({ length: 120 }, (_, i) => ({ nama: 'Bahan ' + i, kategori: 'Sayur', satuan: 'kg', harga: 1000 + i }));
  const z = A('tambahItemBanyak', { baris: big2 });
  cek('120 item sekaligus', z.ok && z.data.ditambah.length === 120 && nItem() === n0 + 120, z.pesan);
  const nb = A('tambahItemBanyak', { baris: [{ no: 3, nama: 'Selada', kategori: 'Sayur', satuan: 'kg' }, { no: 7, nama: 'Jeruk', kategori: 'Buah', satuan: 'kg' }] });
  cek('nomor baris dari tempelan', !nb.ok && /^Baris 7 \(Jeruk\): Kategori "Buah"/.test(nb.pesan), nb.pesan);
  cek('no salah: urutan kiriman', /^Baris 2 /.test(A('tambahItemBanyak', { baris: [{ nama: 'Selada', kategori: 'Sayur', satuan: 'kg' }, { no: 'x', nama: 'Jeruk', kategori: 'Buah', satuan: 'kg' }] }).pesan));
  const s2 = A('setupSpreadsheet' in {} ? 'x' : 'beranda', { tanggal: HARI });
  cek('beranda tetap', s2.ok);
}
console.log('lulus', lulus, 'gagal', gagal, 'ERR log:', JSON.stringify(H.logs.filter((l) => /^ERR/.test(l)).slice(0, 3)));
