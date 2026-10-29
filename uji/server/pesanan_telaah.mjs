// Uji server untuk temuan telaah butir 4 (Code.gs v0.29): tautan basi tidak menolak kiriman, waktu di HP, barang masuk
// yang sudah dipakai, pesanan yang lebih baru, nomor WhatsApp, email, PDF.
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';
let gagal = 0, lulus = 0;
const cek = (k, label, x) => { if (k) lulus++; else { gagal++; console.log('GAGAL:', label, x !== undefined ? JSON.stringify(x).slice(0, 700) : ''); } };
const s = seed();
const T = s.token;
const TR = H.aksi({ action: 'login', nama: 'Rina', pin: '730264' }).data.token;
const TS = H.aksi({ action: 'login', nama: 'Sari', pin: '916205' }).data.token;
const hariIni = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const uid = () => crypto.randomUUID();
const lalu = (menit) => new Date(Date.now() - menit * 60000).toISOString();
const A = (action, b, tok = T) => H.aksi(Object.assign({ action, token: tok }, b));
const kirim = (baris, ekstra = {}, tok = TR) => A('kirimStock', Object.assign({ submissionId: uid(), tanggal: hariIni, kategori: 'x', waktuPerangkat: new Date().toISOString(), baris }, ekstra), tok);
const pesan = (pemasok, baris, ekstra = {}, tok = T) => A('catatPesanan', Object.assign({ submissionId: uid(), tanggal: hariIni, waktuPerangkat: new Date().toISOString(), pemasok, baris }, ekstra), tok);
const barisPesanan = () => {
  const v = H.ss.getSheetByName('Data_Pesanan').getDataRange().getValues();
  return v.slice(1).filter((r) => r[0] !== '' && r[0] != null).map((r) => Object.fromEntries(v[0].map((j, i) => [j, r[i]])));
};
const barisStock = () => {
  const v = H.ss.getSheetByName('Data_Stock').getDataRange().getValues();
  return v.slice(1).filter((r) => r[0] !== '' && r[0] != null).map((r) => Object.fromEntries(v[0].map((j, i) => [j, r[i]])));
};
const akhir = (nama) => A('formStock', { tanggal: hariIni }).data.item.find((i) => i.nama === nama).akhir;
const keadaan = (id, item) => (barisPesanan().find((x) => x.submission_id === id && x['Nama Item'] === item) || {}).Keadaan;

// 1. Kiriman dari antrean yang bertautan ke pesanan yang ditutup: dicatat biasa, tidak macet
{
  const id = uid();
  pesan('Sumber Segar', [{ item: 'Bawang merah', jumlah: 2 }], { submissionId: id });
  const sid = uid();
  const isi = { submissionId: sid, tanggal: hariIni, kategori: 'Bumbu', waktuPerangkat: lalu(10), pemasok: 'Sumber Segar',
    baris: [{ item: 'Bawang merah', masuk: 2, pesanan: id }, { item: 'Bawang putih', keluar: 0.1 }] };
  const a0 = akhir('Bawang merah');
  cek(A('tutupPesanan', { id }).data.ditutup === 1, 'tutup');
  const r = A('kirimStock', isi, TR);
  cek(r.ok && r.data.jumlah === 2 && !r.data.pesananSudahDatang && !r.data.pesananDatang, 'ditutup: kiriman diterima utuh', r);
  cek(Math.abs(akhir('Bawang merah') - a0 - 2) < 1e-9, 'barang masuk tercatat', [a0, akhir('Bawang merah')]);
  cek(keadaan(id, 'Bawang merah') === 'Ditutup', 'pesanan tetap Ditutup');
  const r2 = A('kirimStock', isi, TR);
  cek(r2.ok && r2.data.sudahTerkirim, 'kirim ulang = sudahTerkirim');
  // tutup lagi: 0
  cek(A('tutupPesanan', { id }).data.ditutup === 0, 'tutup kedua kali: 0');
}

// 2. Pesanan sudah dicatat datang dari HP lain: masuk tidak dicatat lagi, baris lain tetap; tanpa baris lain jumlah 0
{
  const id = uid();
  pesan('Sumber Segar', [{ item: 'Cabai merah', jumlah: 1 }, { item: 'Tomat', jumlah: 3 }], { submissionId: id });
  const a0 = akhir('Cabai merah');
  const r1 = kirim([{ item: 'Cabai merah', masuk: 1, pesanan: id }], { pemasok: 'Sumber Segar' }, T);
  cek(r1.ok && r1.data.pesananDatang && r1.data.pesananDatang.length === 1, 'HP pertama menyelesaikan', r1.data);
  const n = barisStock().length;
  const r2 = kirim([{ item: 'Cabai merah', masuk: 1, hargaBeli: 60000, pesanan: id }], { pemasok: 'Sumber Segar' }, TS);
  cek(r2.ok && r2.data.jumlah === 0 && r2.data.pesananSudahDatang && r2.data.pesananSudahDatang[0].item === 'Cabai merah' &&
    r2.data.pesananSudahDatang[0].oleh === 'Budi' && !r2.data.sudahTerkirim, 'hanya masuk dari pesanan yang sudah datang: jumlah 0', r2);
  cek(barisStock().length === n && Math.abs(akhir('Cabai merah') - a0 - 1) < 1e-9, 'tidak ditulis, stock sekali', [n, barisStock().length, a0, akhir('Cabai merah')]);
  // dengan sisa: sisa dihitung tanpa masuk yang dilewati
  const st = akhir('Cabai merah');
  const r3 = kirim([{ item: 'Cabai merah', masuk: 1, sisa: st - 0.2, pesanan: id }], { pemasok: 'Sumber Segar' }, TS);
  const b = barisStock().filter((x) => x.submission_id === r3.sid || true).slice(-1)[0];
  cek(r3.ok && r3.data.jumlah === 1 && r3.data.pesananSudahDatang && Math.abs(akhir('Cabai merah') - (st - 0.2)) < 1e-9 &&
    Number(b['Stock Masuk']) === 0 && b['Pemasok'] === '' && b['Harga Beli (Rp)'] === '', 'sisa tanpa masuk yang dilewati', [r3.data && r3.data.jumlah, akhir('Cabai merah'), st, b]);
  // Tomat dari pesanan yang sama masih menunggu dan bisa diselesaikan
  const r4 = kirim([{ item: 'Tomat', masuk: 3, pesanan: id }], { pemasok: 'Sumber Segar' });
  cek(r4.ok && r4.data.pesananDatang && r4.data.pesananDatang[0].item === 'Tomat' && keadaan(id, 'Tomat') === 'Datang', 'item lain pesanan itu');
}

// 3. Diganti pesanan dari pemasok yang sama yang sudah datang: masuk tidak dicatat dua kali
{
  const id1 = uid(), id2 = uid();
  pesan('Sumber Segar', [{ item: 'Bawang putih', jumlah: 2 }], { submissionId: id1 });
  pesan('Sumber Segar', [{ item: 'Bawang putih', jumlah: 3 }], { submissionId: id2 });
  cek(keadaan(id1, 'Bawang putih') === 'Diganti' && keadaan(id2, 'Bawang putih') === 'Menunggu', 'pengganti menunggu');
  kirim([{ item: 'Bawang putih', masuk: 3, pesanan: id2 }], { pemasok: 'Sumber Segar' });
  const r = kirim([{ item: 'Bawang putih', masuk: 2, pesanan: id1 }, { item: 'Telur', keluar: 1 }], { pemasok: 'Sumber Segar' }, TS);
  cek(r.ok && r.data.jumlah === 1 && r.data.pesananSudahDatang && r.data.pesananSudahDatang[0].item === 'Bawang putih', 'rantai diganti → datang', r.data);
  // diganti pesanan ke pemasok lain: masuk biasa, pesanan pemasok lain tetap menunggu
  const id3 = uid(), id4 = uid();
  pesan('Sumber Segar', [{ item: 'Daging sapi', jumlah: 2 }], { submissionId: id3 });
  pesan('Toko Ayam Jaya', [{ item: 'Daging sapi', jumlah: 2 }], { submissionId: id4 });
  const r2 = kirim([{ item: 'Daging sapi', masuk: 2, pesanan: id3 }], { pemasok: 'Sumber Segar' });
  cek(r2.ok && r2.data.jumlah === 1 && !r2.data.pesananDatang && !r2.data.pesananSudahDatang && keadaan(id4, 'Daging sapi') === 'Menunggu', 'diganti pemasok lain: masuk biasa', r2.data);
  A('tutupPesanan', { id: id4 });
}

// 4. Barang masuk yang dicatat di HP sebelum pesanan diketuk tidak menyelesaikan pesanan itu
{
  const id = uid();
  pesan('Sumber Segar', [{ item: 'Tomat', jumlah: 5 }], { submissionId: id, waktuPerangkat: lalu(60) });
  const r = kirim([{ item: 'Tomat', masuk: 2 }], { waktuPerangkat: lalu(180) }, TR);
  cek(r.ok && !r.data.pesananDatang && keadaan(id, 'Tomat') === 'Menunggu', 'lintas HP: pesanan lebih baru tetap menunggu', r.data);
  const r2 = kirim([{ item: 'Tomat', masuk: 5 }], { waktuPerangkat: lalu(1) }, TR);
  cek(r2.ok && r2.data.pesananDatang && keadaan(id, 'Tomat') === 'Datang', 'barang sesudah pesanan menyelesaikan');
  // jam HP lebih cepat dari server: tidak dianggap sesudah
  const id2 = uid();
  pesan('Sumber Segar', [{ item: 'Bawang merah', jumlah: 1 }], { submissionId: id2 });
  const r3 = kirim([{ item: 'Bawang merah', masuk: 1 }], { waktuPerangkat: new Date(Date.now() + 3600e3).toISOString() }, TR);
  cek(r3.ok && r3.data.pesananDatang && keadaan(id2, 'Bawang merah') === 'Datang', 'jam HP lebih cepat dibatasi waktu server');
}

// 5. Pesanan terlambat dari antrean: satu HP (barang masuk dicatat dulu di HP, pesanan sesudahnya)
{
  const sidMasuk = uid();
  A('kirimStock', { submissionId: sidMasuk, tanggal: hariIni, kategori: 'Bumbu', waktuPerangkat: lalu(30), pemasok: 'Sumber Segar',
    baris: [{ item: 'Minyak goreng', masuk: 1, satuanMasuk: 'besar' }] });
  const id = uid();
  const r = pesan('Sumber Segar', [{ item: 'Minyak goreng', jumlah: 2, satuanOrder: 'besar' }], { submissionId: id, waktuPerangkat: lalu(24) });
  cek(r.ok && r.data.sudahDatang.length === 0 && keadaan(id, 'Minyak goreng') === 'Menunggu', 'satu HP: masuk sebelum ketukan tidak dihitung', r.data);
  A('tutupPesanan', { id });
}

// 6. Barang masuk yang sudah menyelesaikan pesanan lain tidak dipakai lagi
{
  const id1 = uid();
  pesan('Sumber Segar', [{ item: 'Cabai merah', jumlah: 1 }], { submissionId: id1, waktuPerangkat: lalu(120) });
  // pesanan 2 diketuk 60 menit lalu (antrean), barang untuk pesanan 1 dicatat 30 menit lalu
  const sidM = uid();
  A('kirimStock', { submissionId: sidM, tanggal: hariIni, kategori: 'Bumbu', waktuPerangkat: lalu(30), pemasok: 'Sumber Segar',
    baris: [{ item: 'Cabai merah', masuk: 1, pesanan: id1 }] }, TR);
  cek(keadaan(id1, 'Cabai merah') === 'Datang', 'pesanan 1 datang');
  const id2 = uid();
  const r = pesan('Sumber Segar', [{ item: 'Cabai merah', jumlah: 2 }], { submissionId: id2, waktuPerangkat: lalu(60) });
  cek(r.ok && r.data.sudahDatang.length === 0 && keadaan(id2, 'Cabai merah') === 'Menunggu', 'barang masuk yang sudah dipakai tidak dipakai lagi', [r.data && r.data.sudahDatang, keadaan(id2, 'Cabai merah')]);
  // barang masuk lain sesudah ketukan pesanan 2: dipakai
  A('tutupPesanan', { id: id2 });
  const id3 = uid();
  const sidN = uid();
  A('kirimStock', { submissionId: sidN, tanggal: hariIni, kategori: 'Bumbu', waktuPerangkat: lalu(5), baris: [{ item: 'Air mineral', masuk: 2, satuanMasuk: 'besar' }] }, TR);
  const r2 = pesan('Sumber Segar', [{ item: 'Air mineral', jumlah: 2, satuanOrder: 'besar' }], { submissionId: id3, waktuPerangkat: lalu(10) });
  const b = barisPesanan().find((x) => x.submission_id === id3);
  cek(r2.ok && r2.data.sudahDatang.join() === 'Air mineral' && b.Keadaan === 'Datang' && b['Kiriman Stock'] === sidN, 'pesanan terlambat: barang sesudahnya dipakai', [r2.data && r2.data.sudahDatang, b]);
}

// 7. Pesanan dari antrean yang didahului pesanan lebih baru: langsung Diganti
{
  const idBaru = uid(), idLama = uid();
  pesan('Toko Ayam Jaya', [{ item: 'Ayam fillet', jumlah: 8 }], { submissionId: idBaru, waktuPerangkat: lalu(120) }, TS);
  const r = pesan('Sumber Segar', [{ item: 'Ayam fillet', jumlah: 5 }, { item: 'Telur', jumlah: 30 }], { submissionId: idLama, waktuPerangkat: lalu(240) });
  cek(r.ok && r.data.lebihBaru && r.data.lebihBaru.length === 1 && r.data.lebihBaru[0].item === 'Ayam fillet' && r.data.lebihBaru[0].pemasok === 'Toko Ayam Jaya' &&
    r.data.lebihBaru[0].oleh === 'Sari' && r.data.diganti.length === 0, 'lebihBaru', r.data && [r.data.lebihBaru, r.data.diganti]);
  cek(keadaan(idBaru, 'Ayam fillet') === 'Menunggu' && keadaan(idLama, 'Ayam fillet') === 'Diganti' && keadaan(idLama, 'Telur') === 'Menunggu', 'yang lebih baru tetap menunggu');
  const f = A('formStock', { tanggal: hariIni }, TR).data.pesanan;
  cek(f.find((p) => p.id === idBaru) && f.find((p) => p.id === idLama).item.map((x) => x.nama).join() === 'Telur', 'form Stock menawarkan yang terbaru', f.map((p) => [p.pemasok, p.item.map((x) => x.nama)]));
  // pesanan biasa yang lebih baru tetap mengganti
  const id5 = uid();
  const r2 = pesan('Sumber Segar', [{ item: 'Ayam fillet', jumlah: 6 }], { submissionId: id5 });
  cek(r2.ok && r2.data.diganti.length === 1 && keadaan(idBaru, 'Ayam fillet') === 'Diganti' && keadaan(id5, 'Ayam fillet') === 'Menunggu', 'pesanan baru tetap mengganti');
  A('tutupPesanan', { id: id5 });
  A('tutupPesanan', { id: idLama });
}

// 8. nomorWa_: nomor HP didahulukan
{
  const w = H.ambil('nomorWa_');
  [['Telp 021-5551234, WA 0812-3456-7890', '6281234567890'], ['(021) 555 1234 / 0812 3456 7890', '6281234567890'],
    ['Kantor 0274 512345 HP 081234567890', '6281234567890'], ['Telp (0274) 512345', '62274512345'], ['+62 812 0000 1111', '6281200001111'],
    ['0812 3456 7890 / 021 5551 2345', '6281234567890'], ['+1 (555) 123-4567', '15551234567'], ['', '']]
    .forEach(([a, b]) => cek(w(a) === b, 'nomorWa ' + a, w(a)));
}

// 9. Email: kalimat stock aman tetap ada walau ada pesanan
{
  // luruskan stock supaya tidak ada yang minus atau di bawah minimum
  A('formStock', { tanggal: hariIni }).data.item.forEach((it) => {
    const mn = it.stokMin || 0;
    if (it.akhir < mn + 1) A('sesuaikanStock', { submissionId: uid(), item: it.nama, tanggal: hariIni, stockSebenarnya: mn + 5, alasan: 'Hasil hitung ulang', catatan: '' });
  });
  pesan('Sumber Segar', [{ item: 'Tomat', jumlah: 2 }]);
  A('simpanPenerima', { email: ['uji@contoh.invalid'] });
  H.surel.length = 0;
  H.fungsi('kirimLaporanSekarang');
  const isi = H.surel.map((x) => x.htmlBody || x.html || JSON.stringify(x)).join(' ');
  cek(/Tidak ada Stock Akhir minus dan semua stock di atas batas minimum/.test(isi) && /Pesanan belum datang \(1\)/.test(isi), 'email: kalimat aman dan pesanan', isi.slice(isi.indexOf('>Stock<'), isi.indexOf('>Stock<') + 500));
}

// 10. PDF: Order kosong menulis sebab dan saran
{
  // buat satu item di bawah minimum lagi
  A('sesuaikanStock', { submissionId: uid(), item: 'Telur', tanggal: hariIni, stockSebenarnya: 10, alasan: 'Hasil hitung ulang', catatan: '' });
  const d = A('daftarBelanja', {}).data;
  const order = {};
  d.pemasok.forEach((g) => g.item.forEach((i) => { order[i.nama] = ''; }));
  H.pdfHtml.length = 0;
  const r = A('unduhPdfBelanja', { order });
  const html = H.pdfHtml[0] || '';
  const g = d.pemasok.find((x) => x.item.some((i) => i.nama === 'Telur'));
  const sebab = g.nama ? '' : 'belum ada pemasok · ';
  cek(r.ok && html.indexOf('–<br><span class="kecil">' + sebab + 'saran 170 butir</span>') > 0 && /sebab dan sarannya tertulis kecil/.test(html) && !/tidak diberi saran \(–\)/.test(html), 'PDF Order kosong', html.slice(html.indexOf('Telur'), html.indexOf('Telur') + 300));
  // aplikasi lama (tanpa order): saran tertulis seperti dulu
  H.pdfHtml.length = 0;
  A('unduhPdfBelanja', {});
  cek(/170 butir<\/td>/.test(H.pdfHtml[0] || '') && !/jumlah order diubah/.test(H.pdfHtml[0] || ''), 'PDF aplikasi lama');
}

console.log('lulus', lulus, 'gagal', gagal, 'ERR log:', H.logs.filter((l) => /galat|Error/i.test(l)).slice(0, 3));
process.exit(gagal ? 1 : 0);
