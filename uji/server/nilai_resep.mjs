// Uji server: nilai stock barang jadi dari resep (Code.gs v0.36).
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';
let lulus = 0, gagal = 0;
function cek(label, k, info) { if (k) lulus++; else { gagal++; console.log('GAGAL:', label, info !== undefined ? JSON.stringify(info).slice(0, 1200) : ''); } }
const tgl = (n) => new Date(Date.now() + H.geserWaktu + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
seed();
const T = H.aksi({ action: 'login', nama: 'Budi', pin: '482915' }).data.token;
const A = (action, b) => H.aksi(Object.assign({ action, token: T }, b));
const HARI = tgl(0);
const dash = (t) => A('dashboard', { tanggal: t || HARI }).data;

const d1 = dash();
const n1 = d1.nilaiStock;
const sambal = n1.dariResep.find((x) => x.nama === 'Sambal dasar');
const stockSambal = A('daftarItem', {}).data.item.find((x) => x.nama === 'Sambal dasar').stock;
cek('Sambal dasar dari resep Rp 45.875/kg', sambal && sambal.harga === 45875 && sambal.stock === stockSambal && sambal.nilai === Math.round(stockSambal * 45875), [sambal, stockSambal]);
cek('Sambal tidak lagi di tanpaHarga', !n1.tanpaHarga.some((x) => x.nama === 'Sambal dasar'), n1.tanpaHarga);
const bj = n1.perKategori.find((x) => x.kategori === 'Barang jadi');
cek('ikut per kategori Barang jadi', bj && bj.nilai === sambal.nilai, [bj, sambal]);
cek('total = jumlah per kategori', n1.total === n1.perKategori.reduce((a, x) => a + x.nilai, 0) || Math.abs(n1.total - n1.perKategori.reduce((a, x) => a + x.nilai, 0)) <= n1.perKategori.length, n1.total);
cek('ringkas Dashboard memakai total baru', d1.ringkas.nilaiStock === n1.total);
cek('Perlu perhatian tanpaHarga tanpa Sambal', !d1.perhatian.some((p) => p.jenis === 'tanpaHarga' && /Sambal/.test(p.ket)), d1.perhatian.filter((p) => p.jenis === 'tanpaHarga'));
const it = A('daftarItem', {}).data.item;
cek('daftarItem: hargaResep Sambal', it.find((x) => x.nama === 'Sambal dasar').hargaResep === 45875 && it.find((x) => x.nama === 'Tomat').hargaResep === null, it.find((x) => x.nama === 'Sambal dasar'));

// Harga bahan berganti hari ini: kemarin tetap harga lama.
cek('ganti harga Tomat', A('gantiHarga', { nama: 'Tomat', harga: 20000, berlakuMulai: HARI }).ok);
const sHari = dash().nilaiStock.dariResep.find((x) => x.nama === 'Sambal dasar');
const sKemarin = dash(tgl(-1)).nilaiStock.dariResep.find((x) => x.nama === 'Sambal dasar');
cek('hari ini harga resep baru Rp 47.125', sHari.harga === 47125, sHari);
cek('kemarin harga resep lama Rp 45.875', sKemarin.harga === 45875, sKemarin);
cek('daftarItem ikut harga hari ini', A('daftarItem', {}).data.item.find((x) => x.nama === 'Sambal dasar').hargaResep === 47125);

// Rekap PDF menyebut barang jadi dari resep.
H.pdfHtml.length = 0;
cek('unduh rekap', A('unduhPdfRekap', { bulan: HARI.slice(0, 7) }).ok);
cek('rekap: catatan dari resep', /Barang jadi tanpa harga satuan dinilai dari harga bahan resepnya pada tanggal itu \(juga masuk dan penyesuaiannya, dengan harga resep pada hari itu\): Sambal dasar\./.test(H.pdfHtml.join('')));
const dr = H.fungsi('dataRekapBulan_', HARI.slice(0, 7));
cek('rekap: tanpaHarga tanpa Sambal, nilai akhir termasuk', !dr.stock.tanpaHarga.includes('Sambal dasar') && dr.stock.dariResep.includes('Sambal dasar'), dr.stock.tanpaHarga);

// Penyesuaian barang jadi di rekap: dinilai dengan harga resep hari itu.
const ps = A('sesuaikanStock', { submissionId: 'nr-ps-12345678', item: 'Sambal dasar', tanggal: HARI, stockSebenarnya: stockSambal + 1, alasan: 'Hasil hitung ulang', catatan: '' });
cek('penyesuaian Sambal +1', ps.ok, ps.pesan);
const kat = H.fungsi('dataRekapBulan_', HARI.slice(0, 7)).stock.kategori.find((x) => x.kategori === 'Barang jadi');
cek('rekap: penyesuaian Barang jadi = 1 × Rp 47.125', kat && kat.penyesuaian === 47125, kat);

// Resep dengan bahan tanpa harga: kembali ke tanpaHarga dengan resepKurang.
A('simpanItem', { baru: true, nama: 'Garam', kategori: 'Bumbu', satuan: 'kg', satuanBesar: '', isiSatuanBesar: '', harga: '', stokMin: '', stokMaks: '' });
const r = A('simpanResep', { baru: false, itemHasil: 'Sambal dasar', hasil: 2, masaSimpan: 3, bahan: [{ item: 'Cabai merah', qty: 1 }, { item: 'Bawang merah', qty: 0.5 }, { item: 'Tomat', qty: 0.5 }, { item: 'Minyak goreng', qty: 0.3 }, { item: 'Garam', qty: 0.02 }] });
cek('resep diubah', r.ok, r.pesan);
const n2 = dash().nilaiStock;
const t2 = n2.tanpaHarga.find((x) => x.nama === 'Sambal dasar');
cek('bahan tanpa harga: Sambal di tanpaHarga dengan resepKurang', t2 && t2.resepKurang === true && !n2.dariResep.some((x) => x.nama === 'Sambal dasar'), [t2, n2.dariResep]);
cek('item tanpa resep: resepKurang false', n2.tanpaHarga.filter((x) => x.nama !== 'Sambal dasar').every((x) => x.resepKurang === false), n2.tanpaHarga);
cek('daftarItem: hargaResep null', A('daftarItem', {}).data.item.find((x) => x.nama === 'Sambal dasar').hargaResep === null);
A('simpanResep', { baru: false, itemHasil: 'Sambal dasar', hasil: 2, masaSimpan: 3, bahan: [{ item: 'Cabai merah', qty: 1 }, { item: 'Bawang merah', qty: 0.5 }, { item: 'Tomat', qty: 0.5 }, { item: 'Minyak goreng', qty: 0.3 }] });

// Resep nonaktif: tidak dipakai.
A('aturResepAktif', { itemHasil: 'Sambal dasar', aktif: false });
const n3 = dash().nilaiStock;
cek('resep nonaktif: belum punya harga, bukan resepKurang', n3.tanpaHarga.some((x) => x.nama === 'Sambal dasar' && x.resepKurang === false), n3.tanpaHarga);
A('aturResepAktif', { itemHasil: 'Sambal dasar', aktif: true });

// Barang jadi yang punya harga satuan: harga itu yang dipakai.
const hs = A('simpanItem', { baru: false, namaLama: 'Sambal dasar', nama: 'Sambal dasar', kategori: 'Barang jadi', satuan: 'kg', satuanBesar: '', isiSatuanBesar: '', harga: 50000, stokMin: 1, stokMaks: 3 });
cek('harga satuan Sambal diisi', hs.ok, hs.pesan);
const n4 = dash().nilaiStock;
cek('harga satuan menang atas resep', !n4.dariResep.some((x) => x.nama === 'Sambal dasar') && n4.perKategori.find((x) => x.kategori === 'Barang jadi').nilai === Math.round((stockSambal + 1) * 50000), n4.perKategori);
cek('daftarItem: harga 50.000, hargaResep null', (() => { const x = A('daftarItem', {}).data.item.find((y) => y.nama === 'Sambal dasar'); return x.harga === 50000 && x.hargaResep === null; })());
console.log('lulus', lulus, 'gagal', gagal, 'ERR log:', JSON.stringify(H.logs.filter((l) => /^ERR/.test(l)).slice(0, 3)));
