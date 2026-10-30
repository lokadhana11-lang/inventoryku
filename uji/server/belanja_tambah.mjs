// Uji server: item tambahan di daftar belanja (Code.gs v0.38): daftarBelanja.itemLain, pilihanPemasok[].kontak,
// unduhPdfBelanja.tambahan, dan pesanan untuk item yang stock-nya tidak di bawah minimum.
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
const belanja = () => A('daftarBelanja', {}).data;
const akhir = (nama) => A('formStock', { tanggal: hariIni }).data.item.find((i) => i.nama === nama).akhir;
const kirim = (baris) => A('kirimStock', { submissionId: uid(), tanggal: hariIni, kategori: 'x', waktuPerangkat: new Date().toISOString(), baris });
const semuaNama = (d) => d.pemasok.flatMap((g) => g.item.map((i) => i.nama));
const pdf = (body) => {
  H.pdfHtml.length = 0;
  const r = A('unduhPdfBelanja', body);
  return { r, html: H.pdfHtml[0] || '' };
};
// Baris PDF untuk satu item: dari <tr> sampai </tr>.
const barisPdf = (html, nama) => (html.match(new RegExp('<tr><td class="angka">\\d+</td><td>' + nama + '[\\s\\S]*?</tr>')) || [''])[0];
// Judul kelompok PDF beserta urutannya.
const kelompokPdf = (html) => [...html.matchAll(/<tr class="kategori"><td colspan="6">([^<]*)<\/td><\/tr>/g)].map((m) => m[1]);

// Ayam fillet (pemasok terakhir Toko Ayam Jaya) dan Air mineral di bawah minimum.
cek(kirim([{ item: 'Ayam fillet', keluar: akhir('Ayam fillet') - 2 }, { item: 'Air mineral', keluar: 40 }]).ok, 'siapkan stock');

// 1. Bentuk itemLain dan pilihanPemasok
{
  const d = belanja();
  cek(Array.isArray(d.itemLain) && d.itemLain.length > 0, 'itemLain ada', d.itemLain);
  const diDaftar = semuaNama(d);
  const lain = d.itemLain.map((i) => i.nama);
  const master = A('daftarItem', {}).data.item.filter((i) => i.aktif).map((i) => i.nama);
  cek(master.every((n) => (diDaftar.includes(n) ? 1 : 0) + (lain.includes(n) ? 1 : 0) === 1), 'tiap item aktif tepat sekali', { diDaftar, lain });
  cek(!lain.includes('Ayam fillet') && !lain.includes('Air mineral'), 'item di bawah minimum tidak di itemLain');
  const urutKat = ['Protein', 'Sayur', 'Bumbu', 'Minuman', 'Barang jadi'];
  const kunci = d.itemLain.map((i) => urutKat.indexOf(i.kategori) * 1000);
  cek(d.itemLain.every((it, i) => i === 0 || kunci[i - 1] < kunci[i] || (kunci[i - 1] === kunci[i] && d.itemLain[i - 1].nama.localeCompare(it.nama, 'id') < 0)),
    'urut kategori lalu nama', d.itemLain.map((i) => [i.kategori, i.nama]));
  const nasi = d.itemLain.find((i) => i.nama === 'Nasi putih');
  cek(nasi && nasi.stokMin === null && nasi.saran === null && nasi.kategori === 'Barang jadi' && nasi.dipesan === null && nasi.terakhir === null, 'item tanpa stok minimum', nasi);
  const sapi = d.itemLain.find((i) => i.nama === 'Daging sapi');
  cek(sapi && sapi.stock === akhir('Daging sapi') && sapi.stokMin === 3 && sapi.stokMaks === 10 && sapi.satuan === 'kg' && sapi.saran && sapi.saran.jumlah === 6,
    'item Daging sapi lengkap (stock = Stock Akhir hari ini, saran ke stok maksimum)', sapi);
  const minyak = d.itemLain.find((i) => i.nama === 'Minyak goreng');
  cek(minyak && minyak.satuanBesar === 'jerigen' && minyak.isiSatuanBesar === 18, 'satuan besar ikut', minyak);
  const ss = d.pilihanPemasok.find((p) => p.nama === 'Sumber Segar');
  cek(ss && ss.kontak === '+62 812 0000 1111' && ss.wa === '6281200001111', 'pilihanPemasok membawa kontak', d.pilihanPemasok);
  // Item yang terakhir dibeli dari Toko Ayam Jaya membawa terakhir
  cek(d.pemasok.some((g) => g.nama === 'Toko Ayam Jaya'), 'kelompok Toko Ayam Jaya ada');
}

// 2. Item nonaktif tidak ditawarkan
{
  const r = A('aturItemAktif', { nama: 'Daging sapi', aktif: false });
  cek(r.ok, 'nonaktifkan Daging sapi', r.pesan);
  const d = belanja();
  cek(!d.itemLain.some((i) => i.nama === 'Daging sapi') && !semuaNama(d).includes('Daging sapi'), 'item nonaktif tidak ada');
  A('aturItemAktif', { nama: 'Daging sapi', aktif: true });
  // Sejak Code.gs v0.40 stock-nya dinolkan saat dinonaktifkan: isi lagi supaya bagian berikut tetap di atas minimum.
  cek(r.data.dinolkan && r.data.dinolkan.stock > 0, 'stock Daging sapi dinolkan', r.data.dinolkan);
  A('sesuaikanStock', { submissionId: uid(), tanggal: hariIni, waktuPerangkat: new Date().toISOString(), item: 'Daging sapi',
    stockSebenarnya: r.data.dinolkan.stock, alasan: 'Stok pembuka' });
}

// 3. PDF dengan item tambahan
{
  const d = belanja();
  const order = {};
  d.pemasok.forEach((g) => g.item.forEach((it) => { order[it.nama] = it.dipesan || !g.nama ? '' : (it.saran ? String(it.saran.jumlah) : ''); }));
  // Daging sapi ke kelompok Toko Ayam Jaya (sudah ada), Cabai merah ke Sumber Segar (belum punya kelompok), Nasi putih ke kelompok
  // tanpa pemasok, Minyak goreng ke pemasok tak dikenal (→ tanpa pemasok); Telur (di bawah minimum), Durian (tak dikenal), dan
  // Daging sapi kedua kali diabaikan.
  Object.assign(order, { 'Daging sapi': '5', 'Cabai merah': '2,5', 'Nasi putih': '', 'Minyak goreng': '1' });
  const tambahan = [
    { pemasok: 'Toko Ayam Jaya', item: 'Daging sapi' }, { pemasok: 'sumber segar', item: 'Cabai merah' }, { pemasok: '', item: 'Nasi putih' },
    { pemasok: 'Toko Hantu', item: 'Minyak goreng' }, { pemasok: 'Toko Ayam Jaya', item: 'Telur' }, { pemasok: '', item: 'Durian' },
    { pemasok: '', item: 'daging sapi' }
  ];
  const { r, html } = pdf({ order, tambahan });
  cek(r.ok, 'PDF dengan tambahan', r.pesan);
  const kel = kelompokPdf(html);
  cek(kel[0] === 'Sumber Segar · +62 812 0000 1111' && kel[1] === 'Toko Ayam Jaya' && /^(Belum ada pemasok|Pemasok lain)$/.test(kel[kel.length - 1]), 'kelompok dan urutannya', kel);
  const sapi = barisPdf(html, 'Daging sapi');
  cek(/ditambah di layar/.test(sapi) && /<td class="akhir">5 kg<\/td>/.test(sapi) && />3 kg</.test(sapi), 'Daging sapi ditambah dengan Order 5', sapi);
  const posSapi = html.indexOf('<td>Daging sapi');
  cek(posSapi > html.indexOf('>Toko Ayam Jaya<') && posSapi > html.indexOf('<td>Ayam fillet') && posSapi < html.lastIndexOf('<tr class="kategori">'),
    'Daging sapi di kelompok Toko Ayam Jaya, sesudah item server');
  const cabai = barisPdf(html, 'Cabai merah');
  cek(/ditambah di layar/.test(cabai) && /2,5 kg/.test(cabai), 'Cabai merah 2,5 kg', cabai);
  cek(html.indexOf('<td>Cabai merah') > html.indexOf('Sumber Segar ·') && html.indexOf('<td>Cabai merah') < html.indexOf('>Toko Ayam Jaya<'), 'Cabai merah di kelompok Sumber Segar');
  const nasi = barisPdf(html, 'Nasi putih');
  cek(/ditambah di layar/.test(nasi) && /<td class="angka">–<\/td>/.test(nasi) && /<td class="akhir">–<br><span class="kecil">tanpa saran<\/span>/.test(nasi),
    'Nasi putih: minimum –, Order – tanpa sebab', nasi);
  const minyak = barisPdf(html, 'Minyak goreng');
  cek(/1 jerigen \(18 liter\)/.test(minyak) && html.indexOf('<td>Minyak goreng') > html.lastIndexOf('<tr class="kategori">'), 'pemasok tak dikenal → kelompok tanpa pemasok', minyak);
  cek((html.match(/<td>Telur/g) || []).length === 1 && (html.match(/<td>Daging sapi/g) || []).length === 1 && !/Durian/.test(html) &&
    !/ditambah di layar/.test(barisPdf(html, 'Telur')), 'ganda, item di daftar, dan tak dikenal diabaikan');
  cek(kel[kel.length - 1] === 'Belum ada pemasok', 'kelompok tanpa pemasok dengan item server tetap Belum ada pemasok', kel);
  cek(/Item ditambah<\/td><td[^>]*>4</.test(html) || /Item ditambah[\s\S]{0,80}>4</.test(html), 'kotak info Item ditambah 4', html.slice(html.indexOf('Item ditambah') - 40, html.indexOf('Item ditambah') + 80));
  cek(/4 item bertanda ("|&quot;)ditambah("|&quot;) dipilih Pengelola/.test(html), 'catatan item ditambah');
  cek(!/jumlah order diubah/.test(html), 'item tambahan tidak dihitung sebagai diubah');
  // Tanpa tambahan: seperti dulu
  const lama = pdf({ order });
  cek(lama.r.ok && !/ditambah/.test(lama.html) && !/Item ditambah/.test(lama.html), 'PDF tanpa tambahan seperti dulu');
  cek(!/Pemasok lain/.test(lama.html), 'tanpa tambahan tidak ada Pemasok lain');
}

// 4. Pesanan untuk item yang stock-nya cukup, lalu tampil sebagai dipesan
{
  const sebelum = belanja().itemLain.find((i) => i.nama === 'Daging sapi');
  const r = A('catatPesanan', { submissionId: uid(), tanggal: hariIni, waktuPerangkat: new Date().toISOString(), pemasok: 'Toko Ayam Jaya',
    baris: [{ item: 'Daging sapi', jumlah: 5, satuanOrder: 'dasar' }] });
  cek(r.ok && r.data.jumlah === 1, 'catatPesanan item di atas minimum', r.pesan);
  const d = r.data.belanja;
  const sapi = d.itemLain.find((i) => i.nama === 'Daging sapi');
  cek(sebelum.dipesan === null && sapi && sapi.dipesan && sapi.dipesan.pemasok === 'Toko Ayam Jaya' && sapi.dipesan.jumlah === 5, 'Daging sapi bertanda dipesan', sapi);
  cek(d.menunggu.some((p) => p.item.some((x) => x.nama === 'Daging sapi')), 'Daging sapi di pesanan belum datang');
  cek(!semuaNama(d).includes('Daging sapi'), 'Daging sapi tetap di luar kelompok (stock cukup)');
  // Barang datang menyelesaikan pesanan
  const k = kirim([{ item: 'Daging sapi', masuk: 5 }]);
  cek(k.ok && (k.data.pesananDatang || []).some((x) => x.item === 'Daging sapi'), 'barang masuk menyelesaikan pesanan', k.data);
  cek(belanja().itemLain.find((i) => i.nama === 'Daging sapi').dipesan === null, 'sesudah datang tidak bertanda dipesan');
}

// 5. Semua stock di atas minimum: PDF hanya dengan tambahan
{
  const d0 = belanja();
  d0.pemasok.forEach((g) => g.item.forEach((it) => {
    const r = A('sesuaikanStock', { submissionId: uid(), item: it.nama, tanggal: hariIni, stockSebenarnya: it.stokMin + 1, alasan: 'Hasil hitung ulang', catatan: '' });
    cek(r.ok, 'naikkan ' + it.nama, r.pesan);
  }));
  const d = belanja();
  cek(d.jumlah === 0 && d.pemasok.length === 0 && d.itemLain.length === A('daftarItem', {}).data.item.filter((i) => i.aktif).length, 'tidak ada item di bawah minimum', d);
  const tanpa = A('unduhPdfBelanja', { order: {} });
  cek(!tanpa.ok && /Semua stock di atas batas minimum/.test(tanpa.pesan), 'tanpa tambahan ditolak seperti dulu', tanpa);
  const kosong = A('unduhPdfBelanja', { order: {}, tambahan: [{ pemasok: '', item: 'Durian' }] });
  cek(!kosong.ok, 'tambahan tak dikenal saja ditolak');
  const { r, html } = pdf({ order: { 'Tomat': '3' }, tambahan: [{ pemasok: '', item: 'Tomat' }, { pemasok: 'Sumber Segar', item: 'Cabai merah' }] });
  cek(r.ok, 'PDF hanya tambahan', r.pesan);
  const kel = kelompokPdf(html);
  cek(kel[0] === 'Sumber Segar · +62 812 0000 1111' && kel[1] === 'Pemasok lain' && kel.length === 2, 'kelompok Sumber Segar dan Pemasok lain', kel);
  cek(/Item di bawah stok minimum[\s\S]{0,80}>0</.test(html) && /Item ditambah[\s\S]{0,80}>2</.test(html), 'kotak info 0 dan 2');
  cek(/<td class="akhir">3 kg<\/td>/.test(barisPdf(html, 'Tomat')), 'Order Tomat 3 kg', barisPdf(html, 'Tomat'));
}

// 6. Staff tidak bisa
{
  cek(!A('daftarBelanja', {}, TR).ok && !A('unduhPdfBelanja', { tambahan: [{ pemasok: '', item: 'Tomat' }] }, TR).ok, 'Staff ditolak');
}

console.log('lulus', lulus, 'gagal', gagal);
