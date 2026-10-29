// Uji Chromium: Tambah item di Daftar belanja (aplikasi 0.38.0, Code.gs v0.38): tombol per kelompok, kelompok "Pemasok lain",
// hapus item tambahan, pesan WhatsApp, PDF, data server terbaru, server lama, dan delapan ukuran.
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';
import { muatChromium } from '../alat/peramban.mjs';
const chromium = await muatChromium();
let gagal = 0, lulus = 0;
const cek = (k, label, x) => { if (k) lulus++; else { gagal++; console.log('GAGAL:', label, x !== undefined ? JSON.stringify(x).slice(0, 600) : ''); } };
const s = seed();
const T = s.token;
const hari = (n) => new Date(Date.now() + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const hariIni = hari(0);
const A = (action, b) => H.aksi(Object.assign({ action, token: T }, b));
const akhir = (nama) => A('formStock', { tanggal: hariIni }).data.item.find((i) => i.nama === nama).akhir;
const uid = () => crypto.randomUUID();
// Ayam fillet (pemasok terakhir Toko Ayam Jaya) dan Air mineral di bawah minimum; Minyak goreng terakhir dari Sumber Segar.
A('kirimStock', { submissionId: uid(), tanggal: hariIni, kategori: 'x', waktuPerangkat: new Date().toISOString(),
  baris: [{ item: 'Ayam fillet', keluar: akhir('Ayam fillet') - 2 }, { item: 'Air mineral', keluar: 40 }] });
A('kirimStock', { submissionId: uid(), tanggal: hariIni, kategori: 'Bumbu', waktuPerangkat: new Date().toISOString(), pemasok: 'Sumber Segar',
  baris: [{ item: 'Minyak goreng', masuk: 1, satuanMasuk: 'dasar' }] });
const barisPesanan = () => {
  const v = H.ss.getSheetByName('Data_Pesanan').getDataRange().getValues();
  return v.slice(1).filter((r) => r[0] !== '' && r[0] != null).map((r) => Object.fromEntries(v[0].map((j, i) => [j, r[i]])));
};

const srv = H.layani(0);
await new Promise((r) => (srv.listening ? r() : srv.once('listening', r)));
const PORT = srv.address().port;
const browser = await chromium.launch();
const galat = [];

async function buka(w, h, siapa, opsi = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'Asia/Jakarta', locale: 'id-ID', serviceWorkers: 'block', reducedMotion: 'reduce' });
  const permintaan = [];
  await ctx.route('https://wa.me/**', async (route) => { await route.fulfill({ status: 200, contentType: 'text/html', body: '<p>wa</p>' }); });
  await ctx.route('https://api.uji/**', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    permintaan.push(body);
    const out = H.aksi(body);
    if (opsi.serverLama && out.ok && out.data && body.action === 'daftarBelanja') delete out.data.itemLain;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
  });
  const page = await ctx.newPage();
  page.on('popup', (p) => { setTimeout(() => p.close().catch(() => {}), 200); });
  page.on('pageerror', (e) => galat.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/wa\.me|Failed to load resource/.test(m.text())) galat.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: new RegExp(siapa) }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type({ Budi: '482915', Rina: '730264', Sari: '916205', Andi: '305718' }[siapa], { delay: 30 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { location.hash = '#/laporan'; });
  await page.waitForTimeout(1800);
  return { ctx, page, permintaan };
}
const kelompok = (page, nama) => page.locator('.belanja-kelompok', { has: page.locator('h3.judul-sub', { hasText: new RegExp('^' + nama + '$') }) });
const baris = (page, nama) => page.locator('.belanja-baris', { has: page.locator('.daftar-baris-judul', { hasText: new RegExp('^' + nama + '$') }) });
const judulKelompok = (page) => page.locator('.belanja-kelompok > h3.judul-sub').allTextContents();
const teksWa = (href) => decodeURIComponent(String(href).split('?text=')[1] || '');
async function tambah(page, kel, cari, nama) {
  await kelompok(page, kel).getByRole('button', { name: /^Tambah item ke/ }).click();
  await page.waitForTimeout(400);
  const dialog = page.getByRole('dialog');
  if (cari) await dialog.getByLabel('Cari item').fill(cari);
  await dialog.locator('.daftar-pilih-item button', { has: page.locator('.daftar-baris-judul', { hasText: new RegExp('^' + nama + '$') }) }).click();
  await page.waitForTimeout(400);
}

// A. HP: Tambah item ke kelompok Toko Ayam Jaya, isi Order, pesan WhatsApp, pesanan tercatat
{
  const { ctx, page, permintaan } = await buka(390, 844, 'Budi');
  const judul = await judulKelompok(page);
  cek(judul[0] === 'Toko Ayam Jaya' && judul[judul.length - 1] === 'Belum ada pemasok' && !judul.includes('Pemasok lain'), 'kelompok seperti dulu', judul);
  const nTombol = await page.locator('.belanja-kelompok').getByRole('button', { name: /^Tambah item ke/ }).count();
  cek(nTombol === judul.length, 'Tambah item di tiap kelompok', [nTombol, judul]);
  cek(/Item lain bisa ditambah lewat Tambah item/.test(await page.locator('.belanja > .kartu-teks').first().innerText()), 'kalimat pembuka menyebut Tambah item');
  await kelompok(page, 'Toko Ayam Jaya').getByRole('button', { name: 'Tambah item ke pesanan Toko Ayam Jaya' }).click();
  await page.waitForTimeout(400);
  const dialog = page.getByRole('dialog');
  cek(await dialog.locator('.lembar-judul').innerText() === 'Tambah item ke pesanan Toko Ayam Jaya', 'judul lembar');
  const pilihan = await dialog.locator('.daftar-pilih-item .daftar-baris-judul').allTextContents();
  cek(pilihan.includes('Daging sapi') && pilihan.includes('Nasi putih') && !pilihan.includes('Ayam fillet') && !pilihan.includes('Telur'), 'pilihan: item yang belum ada di daftar', pilihan);
  const ketSapi = await dialog.locator('.daftar-pilih-item button', { hasText: 'Daging sapi' }).locator('.daftar-baris-ket').innerText();
  cek(ketSapi === 'Protein · stock 4 kg', 'keterangan pilihan', ketSapi);
  await dialog.getByLabel('Cari item').fill('sapi');
  cek(await dialog.locator('.daftar-pilih-item button').count() === 1, 'cari menyaring');
  await dialog.locator('.daftar-pilih-item button').first().click();
  await page.waitForTimeout(400);
  const bSapi = kelompok(page, 'Toko Ayam Jaya').locator('.belanja-baris', { hasText: 'Daging sapi' });
  cek(await bSapi.count() === 1, 'Daging sapi masuk kelompok Toko Ayam Jaya');
  const fokus = await page.evaluate(() => document.activeElement && document.activeElement.dataset.item);
  cek(fokus === 'Daging sapi', 'fokus ke Order item baru', fokus);
  cek(await bSapi.locator('input').inputValue() === '', 'Order item tambahan kosong');
  const ketBaris = await bSapi.locator('.daftar-baris-ket').allTextContents();
  cek(ketBaris[0] === 'Stock 4 kg · minimum 3 kg' && ketBaris[1] === 'Saran 6 kg', 'keterangan baris tambahan', ketBaris);
  cek(await bSapi.getByRole('button', { name: 'Hapus Daging sapi dari pesanan Toko Ayam Jaya' }).count() === 1, 'ikon hapus');
  cek(await baris(page, 'Ayam fillet').getByRole('button', { name: /^Hapus/ }).count() === 0, 'item di bawah minimum tanpa ikon hapus');
  await page.keyboard.type('5');
  await page.waitForTimeout(200);
  const href = await kelompok(page, 'Toko Ayam Jaya').locator('a.belanja-wa').getAttribute('href');
  cek(teksWa(href) === 'Halo Toko Ayam Jaya, kami dari Dapur Contoh mau pesan:\n- Ayam fillet 18 kg\n- Daging sapi 5 kg\nTerima kasih.', 'pesan WA memuat item tambahan', teksWa(href));
  cek(/Pesan berisi 2 item/.test(await kelompok(page, 'Toko Ayam Jaya').locator('.kolom-bantuan').last().innerText()), 'Pesan berisi 2 item');
  // Lembar lagi: Daging sapi tidak ditawarkan
  await kelompok(page, 'Belum ada pemasok').getByRole('button', { name: /^Tambah item ke/ }).click();
  await page.waitForTimeout(400);
  const lagi = await page.getByRole('dialog').locator('.daftar-pilih-item .daftar-baris-judul').allTextContents();
  cek(!lagi.includes('Daging sapi'), 'item yang sudah ditambah tidak ditawarkan lagi', lagi);
  await page.getByRole('dialog').getByRole('button', { name: 'Tutup' }).click();
  await page.waitForTimeout(300);
  // Unduh PDF mengirim tambahan
  await page.locator('.laporan-kartu', { has: page.locator('#judul-belanja') }).getByRole('button', { name: 'Unduh PDF' }).click();
  await page.waitForTimeout(1500);
  const p = permintaan.filter((x) => x.action === 'unduhPdfBelanja').pop();
  cek(p && p.order['Daging sapi'] === '5' && JSON.stringify(p.tambahan) === JSON.stringify([{ pemasok: 'Toko Ayam Jaya', item: 'Daging sapi' }]), 'PDF membawa tambahan', p);
  // Kirim ke WhatsApp
  await kelompok(page, 'Toko Ayam Jaya').locator('a.belanja-wa').click();
  await page.waitForTimeout(1500);
  const cp = permintaan.filter((x) => x.action === 'catatPesanan').pop();
  cek(cp && cp.pemasok === 'Toko Ayam Jaya' && cp.baris.map((b) => b.item + ':' + b.jumlah).join(',') === 'Ayam fillet:18,Daging sapi:5', 'catatPesanan memuat item tambahan', cp);
  cek(barisPesanan().some((r) => r['Nama Item'] === 'Daging sapi' && r.Keadaan === 'Menunggu' && r.Pemasok === 'Toko Ayam Jaya'), 'Data_Pesanan Daging sapi');
  cek(await baris(page, 'Daging sapi').count() === 0, 'sesudah dipesan, Daging sapi keluar dari kelompok');
  cek(/Daging sapi 5 kg/.test(await page.locator('.belanja-menunggu').innerText()), 'Daging sapi di Pesanan belum datang');
  await ctx.close();
}

// B. Hapus item tambahan, Pesan ke diisi pemasok terakhir, data server terbaru membuang item yang kini di bawah minimum
{
  const { ctx, page, permintaan } = await buka(390, 844, 'Budi');
  await tambah(page, 'Toko Ayam Jaya', 'minyak', 'Minyak goreng');
  await page.keyboard.type('2');
  cek(await baris(page, 'Minyak goreng').locator('.satuan-tetap').innerText() === 'jerigen', 'satuan order besar');
  cek(await baris(page, 'Minyak goreng').locator('.konversi').innerText() === '= 36 liter', 'konversi satuan besar');
  await baris(page, 'Minyak goreng').getByRole('button', { name: 'Hapus Minyak goreng dari pesanan Toko Ayam Jaya' }).click();
  await page.waitForTimeout(400);
  cek(await baris(page, 'Minyak goreng').count() === 0, 'Minyak goreng dihapus');
  const f = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('aria-label'));
  cek(f === 'Tambah item ke pesanan Toko Ayam Jaya', 'fokus ke Tambah item kelompok itu', f);
  cek(/Minyak goreng dihapus dari pesanan/.test(await page.locator('.toast, [class*="toast"]').first().innerText().catch(() => '')), 'pesan singkat hapus');
  // Ke kelompok tanpa pemasok: Pesan ke diisi pemasok terakhirnya, Order lama tidak kembali
  await tambah(page, 'Belum ada pemasok', 'minyak', 'Minyak goreng');
  cek(await baris(page, 'Minyak goreng').locator('input').inputValue() === '', 'Order kosong lagi sesudah dihapus');
  cek(await kelompok(page, 'Belum ada pemasok').locator('select').inputValue() === 'Sumber Segar', 'Pesan ke diisi pemasok terakhir', await kelompok(page, 'Belum ada pemasok').locator('select').inputValue());
  cek(await kelompok(page, 'Belum ada pemasok').getByRole('button', { name: 'Hapus Minyak goreng dari kelompok Belum ada pemasok' }).count() === 1, 'nama hapus di kelompok tanpa pemasok');
  // Cabai merah ditambah ke Toko Ayam Jaya, lalu stock-nya turun di bawah minimum (HP lain); Kirim WA Toko Ayam Jaya memuat data baru
  await tambah(page, 'Toko Ayam Jaya', 'cabai', 'Cabai merah');
  A('sesuaikanStock', { submissionId: uid(), item: 'Cabai merah', tanggal: hariIni, stockSebenarnya: 0, alasan: 'Hasil hitung ulang', catatan: '' });
  await baris(page, 'Ayam fillet').locator('input').fill('3');
  await kelompok(page, 'Toko Ayam Jaya').locator('a.belanja-wa').click();
  await page.waitForTimeout(1500);
  const cp = permintaan.filter((x) => x.action === 'catatPesanan').pop();
  cek(cp && cp.baris.length === 1 && cp.baris[0].item === 'Ayam fillet', 'Cabai kosong tidak ikut dipesan', cp);
  cek(await baris(page, 'Cabai merah').count() === 1 && await baris(page, 'Cabai merah').getByRole('button', { name: /^Hapus/ }).count() === 0 &&
    await kelompok(page, 'Belum ada pemasok').locator('.belanja-baris', { hasText: 'Cabai merah' }).count() === 1, 'Cabai kini di bawah minimum: sekali, di kelompok server, bukan tambahan');
  cek(await baris(page, 'Minyak goreng').count() === 1, 'Minyak goreng tambahan tetap ada sesudah data baru');
  await ctx.close();
}

// C. Server lama (tanpa itemLain): tanpa Tambah item dan tanpa Pemasok lain
{
  const { ctx, page } = await buka(390, 844, 'Budi', { serverLama: true });
  cek(await page.locator('.belanja').getByRole('button', { name: /^Tambah item/ }).count() === 0, 'server lama tanpa Tambah item');
  cek(!(await judulKelompok(page)).includes('Pemasok lain'), 'server lama tanpa Pemasok lain');
  cek(!/Item lain bisa ditambah/.test(await page.locator('.belanja').innerText()), 'server lama tanpa kalimat Tambah item');
  await ctx.close();
}

// D. Delapan ukuran dengan item tambahan (tanpa gulir samping, sasaran sentuh ≥ 44 px, isi tidak keluar layar)
for (const [w, h] of [[320, 568], [360, 740], [390, 844], [430, 932], [768, 1024], [1024, 768], [1366, 768], [1920, 1080]]) {
  const { ctx, page } = await buka(w, h, 'Budi');
  await tambah(page, 'Toko Ayam Jaya', 'sambal', 'Sambal dasar');
  await page.keyboard.type('1,5');
  const m = await page.evaluate(() => {
    const akar = document.querySelector('.belanja');
    const lebar = document.documentElement.scrollWidth;
    const kecil = [...akar.querySelectorAll('button, a, input, select')].filter((e) => e.offsetParent).map((e) => [e.getAttribute('aria-label') || e.textContent || e.tagName, Math.round(e.getBoundingClientRect().height), Math.round(e.getBoundingClientRect().width)]).filter((x) => x[1] < 44 || x[2] < 44);
    const keluar = [...akar.querySelectorAll('*')].filter((e) => { const b = e.getBoundingClientRect(); return b.width && (b.right > innerWidth + 1 || b.left < -1); }).map((e) => e.className).slice(0, 5);
    const baris = [...akar.querySelectorAll('.belanja-baris')].find((b) => /Sambal dasar/.test(b.textContent));
    const hapus = baris && baris.querySelector('.belanja-hapus').getBoundingClientRect();
    const order = baris && baris.querySelector('input').getBoundingClientRect();
    return { lebar, kecil, keluar, tumpang: hapus && order && hapus.left < order.right && hapus.right > order.left && hapus.top < order.bottom && hapus.bottom > order.top };
  });
  cek(m.lebar <= w && !m.kecil.length && !m.keluar.length && !m.tumpang, `ukuran ${w}x${h}`, m);
  await ctx.close();
}

// E. Semua stock di atas minimum: kosong, lalu Pemasok lain dengan Tambah item, Pesan ke, PDF, dan WhatsApp
{
  A('daftarBelanja', {}).data.pemasok.forEach((g) => g.item.forEach((it) => {
    A('sesuaikanStock', { submissionId: uid(), item: it.nama, tanggal: hariIni, stockSebenarnya: it.stokMin + 1, alasan: 'Hasil hitung ulang', catatan: '' });
  }));
  const { ctx, page, permintaan } = await buka(320, 568, 'Budi');
  const kartu = page.locator('.laporan-kartu', { has: page.locator('#judul-belanja') });
  cek(/Semua stock di atas batas minimum/.test(await kartu.innerText()), 'kosong tetap tertulis');
  cek(JSON.stringify(await judulKelompok(page)) === '["Pemasok lain"]', 'hanya kelompok Pemasok lain', await judulKelompok(page));
  const pl = kelompok(page, 'Pemasok lain');
  cek(/Untuk pesanan ke pemasok lain: ketuk Tambah item/.test(await pl.innerText()) && await pl.locator('select').count() === 0 && await pl.locator('a.belanja-wa').count() === 0, 'Pemasok lain kosong: keterangan dan Tambah item saja');
  cek(await kartu.getByRole('button', { name: 'Unduh PDF' }).isDisabled(), 'Unduh PDF nonaktif tanpa item');
  await tambah(page, 'Pemasok lain', 'tomat', 'Tomat');
  cek(await kelompok(page, 'Pemasok lain').locator('select').inputValue() === '', 'Pesan ke kosong (Tomat tanpa pemasok terakhir)');
  await page.keyboard.type('3');
  await kelompok(page, 'Pemasok lain').locator('select').selectOption('Sumber Segar');
  await page.waitForTimeout(200);
  cek(!(await kartu.getByRole('button', { name: 'Unduh PDF' }).isDisabled()), 'Unduh PDF aktif dengan item tambahan');
  const href = await kelompok(page, 'Pemasok lain').locator('a.belanja-wa').getAttribute('href');
  cek(href.startsWith('https://wa.me/6281200001111?text=') && /- Tomat 3 kg/.test(teksWa(href)), 'WA ke nomor Sumber Segar', href);
  await kartu.getByRole('button', { name: 'Unduh PDF' }).click();
  await page.waitForTimeout(1500);
  const p = permintaan.filter((x) => x.action === 'unduhPdfBelanja').pop();
  const hasilPdf = p && H.aksi(Object.assign({ token: T, action: 'unduhPdfBelanja' }, { order: p.order, tambahan: p.tambahan }));
  cek(p && p.order.Tomat === '3' && JSON.stringify(p.tambahan) === '[{"pemasok":"","item":"Tomat"}]' && hasilPdf.ok, 'PDF hanya tambahan', p);
  cek(!(await kartu.locator('.pesan-formulir.masalah').count()), 'unduh tanpa galat');
  await kelompok(page, 'Pemasok lain').locator('a.belanja-wa').click();
  await page.waitForTimeout(1500);
  const cp = permintaan.filter((x) => x.action === 'catatPesanan').pop();
  cek(cp && cp.pemasok === 'Sumber Segar' && cp.baris[0].item === 'Tomat' && cp.baris[0].jumlah === 3, 'catatPesanan dari Pemasok lain', cp);
  cek(JSON.stringify(await judulKelompok(page)) === '["Pemasok lain"]' && await baris(page, 'Tomat').count() === 0, 'sesudah dipesan, kelompok kembali kosong');
  cek(/Pesanan ke Sumber Segar dicatat \(1 item\)/.test(await kartu.innerText()), 'pesan dicatat');
  await ctx.close();
}

console.log('lulus', lulus, 'gagal', gagal, 'galat konsol', galat, 'ERR log', H.logs.filter((l) => l.startsWith('ERR')));
await browser.close();
srv.close();
