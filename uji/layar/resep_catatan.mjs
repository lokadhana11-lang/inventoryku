// Uji Chromium: catatan resep di Pengaturan → Resep dan Prep List, dan pesan stock sesudah Prep list dikirim
// (aplikasi 0.39.0, Code.gs v0.39): HP, antrean, desktop, server lama, delapan ukuran.
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';
import { muatChromium } from '../alat/peramban.mjs';
const chromium = await muatChromium();
let gagal = 0, lulus = 0;
const cek = (k, label, x) => { if (k) lulus++; else { gagal++; console.log('GAGAL:', label, x !== undefined ? JSON.stringify(x).slice(0, 600) : ''); } };
const s = seed();
const T = s.token;
const hariIni = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const A = (action, b) => H.aksi(Object.assign({ action, token: T }, b));
const stockAkhir = (nama) => A('formStock', { tanggal: hariIni }).data.item.find((i) => i.nama === nama).akhir;
const catatanServer = () => A('daftarResep', {}).data.resep.find((r) => r.itemHasil === 'Sambal dasar').catatan;
const angkaId = (n) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 }).format(n).replace('-', '−');

const srv = H.layani(0);
await new Promise((r) => (srv.listening ? r() : srv.once('listening', r)));
const PORT = srv.address().port;
const browser = await chromium.launch();
const galat = [];

async function buka(w, h, siapa, rute, opsi = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'Asia/Jakarta', locale: 'id-ID', serviceWorkers: 'block', reducedMotion: 'reduce' });
  const permintaan = [];
  await ctx.route('https://api.uji/**', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    permintaan.push(body);
    const out = H.aksi(body);
    if (opsi.serverLama && out.ok && out.data) {
      if (body.action === 'daftarResep') delete out.data.catatanSiap;
      if (body.action === 'daftarResep') out.data.resep.forEach((r) => delete r.catatan);
      if (body.action === 'formPrep' || body.action === 'kirimPrep') {
        const f = body.action === 'formPrep' ? out.data : out.data.form;
        f.resep.forEach((r) => delete r.catatan);
        delete out.data.stockHasil;
        delete out.data.tanpaResep;
      }
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => galat.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(m.text())) galat.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: new RegExp(siapa) }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type({ Budi: '482915', Rina: '730264', Sari: '916205', Andi: '305718' }[siapa], { delay: 30 });
  await page.waitForTimeout(1500);
  await page.evaluate((r) => { location.hash = r; }, rute);
  await page.waitForTimeout(1800);
  return { ctx, page, permintaan };
}
async function tambahPrep(page, nama, cari) {
  await page.getByRole('button', { name: 'Tambah item', exact: true }).first().click();
  await page.waitForTimeout(400);
  const d = page.getByRole('dialog');
  await d.getByLabel('Cari item').fill(cari);
  await d.locator('.daftar-pilih-item button', { has: page.locator('.daftar-baris-judul', { hasText: new RegExp('^' + nama + '$') }) }).click();
  await page.waitForTimeout(400);
}
const CATATAN = 'Aduk terus dengan api kecil supaya tidak gosong.';

// A. Pengelola HP: isi catatan di layar ubah resep, draft, simpan
{
  const { ctx, page, permintaan } = await buka(390, 844, 'Budi', '#/pengaturan/resep/Sambal%20dasar');
  const kolom = page.getByLabel('Catatan untuk juru masak (tidak wajib)');
  cek(await kolom.count() === 1 && await kolom.inputValue() === '', 'kolom catatan kosong');
  cek(/Tidak mengurangi stock apa pun/.test(await page.locator('.kolom', { has: kolom }).innerText()), 'bantuan catatan');
  cek(await kolom.getAttribute('maxlength') === '200', 'maxlength 200');
  await kolom.fill(CATATAN);
  await page.waitForTimeout(300);
  await page.reload();
  await page.waitForTimeout(2000);
  cek(await page.getByLabel('Catatan untuk juru masak (tidak wajib)').inputValue() === CATATAN, 'catatan tetap di draft sesudah dimuat ulang');
  await page.getByRole('button', { name: 'Simpan resep' }).click();
  await page.waitForTimeout(1500);
  const p = permintaan.filter((x) => x.action === 'simpanResep').pop();
  cek(p && p.catatan === CATATAN, 'simpanResep membawa catatan', p);
  cek(catatanServer() === CATATAN, 'catatan tersimpan di server', catatanServer());
  cek(/#\/pengaturan\/resep$/.test(page.url()), 'kembali ke daftar resep', page.url());
  await ctx.close();
}

// B. Staff HP: catatan tampil di Prep List; kirim → pesan stock dari server, item tanpa resep disebut
{
  const { ctx, page } = await buka(390, 844, 'Rina', '#/prep');
  await tambahPrep(page, 'Sambal dasar', 'sambal');
  const kartu = page.locator('.kartu-item', { hasText: 'Sambal dasar' });
  const cat = kartu.locator('.catatan-resep');
  cek(await cat.count() === 1 && (await cat.innerText()).trim() === 'Catatan resep: ' + CATATAN, 'catatan di kartu Prep List', await cat.innerText().catch(() => ''));
  const urut = await kartu.evaluate((k) => [...k.children].map((c) => c.className));
  cek(urut.indexOf('otomatis bahan-prep') >= 0 && urut.indexOf('catatan-resep') === urut.indexOf('otomatis bahan-prep') + 1, 'catatan tepat di bawah bahan', urut);
  await kartu.locator('label.pilihan', { hasText: /^1$/ }).click();
  await tambahPrep(page, 'Bawang putih', 'putih');
  const kb = page.locator('.kartu-item', { hasText: 'Bawang putih' });
  cek(await kb.locator('.catatan-resep').count() === 0, 'item tanpa resep tanpa catatan');
  await kb.locator('input[data-kunci$="|qty"]').fill('0,5');
  await page.locator('label.pilihan', { hasText: 'Pagi' }).first().click();
  const sebelum = stockAkhir('Sambal dasar');
  await page.getByRole('button', { name: 'Kirim prep list' }).click();
  await page.waitForTimeout(1800);
  const teks = await page.locator('.pesan-formulir').filter({ hasText: 'Prep list terkirim' }).first().innerText().catch(() => '');
  const akhir = stockAkhir('Sambal dasar');
  cek(akhir === sebelum + 2, 'stock server bertambah 2', [sebelum, akhir]);
  cek(teks.includes('Stock bertambah: Sambal dasar +2 kg (sekarang ' + angkaId(akhir) + ' kg).'), 'pesan stock dari server', teks);
  cek(/tidak perlu diisi lagi di Tambah masuk/.test(teks) && /Tanpa resep, stock tidak bergerak: Bawang putih\./.test(teks), 'pesan Tambah masuk dan tanpa resep', teks);
  cek(/Tulis di label wadah: Sambal dasar baik sampai/.test(teks), 'label wadah tetap', teks);
  await ctx.close();
}

// C. Tanpa sinyal: masuk antrean dengan perkiraan stock dari HP
{
  const { ctx, page } = await buka(390, 844, 'Rina', '#/prep');
  await tambahPrep(page, 'Sambal dasar', 'sambal');
  await page.locator('.kartu-item', { hasText: 'Sambal dasar' }).locator('label.pilihan', { hasText: /^1½$/ }).click();
  await page.locator('label.pilihan', { hasText: 'Pagi' }).first().click();
  await ctx.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.getByRole('button', { name: 'Kirim prep list' }).click();
  await page.waitForTimeout(800);
  const teks = await page.locator('.pesan-formulir.info').first().innerText().catch(() => '');
  cek(/Sesudah terkirim, stock bertambah: Sambal dasar 3 kg\./.test(teks), 'perkiraan saat masuk antrean', teks);
  await ctx.setOffline(false);
  await ctx.close();
}

// D. Desktop Staff: catatan di sel hasil tabel
{
  const { ctx, page } = await buka(1366, 768, 'Rina', '#/prep');
  await tambahPrep(page, 'Sambal dasar', 'sambal');
  const sel = page.locator('.tabel-prep td.sel-hasil-prep .catatan-resep');
  cek(await sel.count() === 1 && /Aduk terus/.test(await sel.innerText()), 'catatan di tabel desktop');
  await ctx.close();
}

// E. Server lama: tanpa kolom catatan dan pesan lama
{
  const { ctx, page, permintaan } = await buka(390, 844, 'Budi', '#/pengaturan/resep/Sambal%20dasar', { serverLama: true });
  cek(await page.getByLabel('Catatan untuk juru masak (tidak wajib)').count() === 0, 'server lama: tanpa kolom catatan');
  await page.getByRole('button', { name: 'Simpan resep' }).click();
  await page.waitForTimeout(1500);
  const p = permintaan.filter((x) => x.action === 'simpanResep').pop();
  cek(p && !('catatan' in p), 'server lama: simpanResep tanpa catatan', p);
  cek(catatanServer() === CATATAN, 'catatan tidak terhapus oleh aplikasi tanpa kolom');
  await page.evaluate(() => { localStorage.clear(); });
  await ctx.close();
  const b = await buka(390, 844, 'Rina', '#/prep', { serverLama: true });
  await tambahPrep(b.page, 'Sambal dasar', 'sambal');
  cek(await b.page.locator('.catatan-resep').count() === 0, 'server lama: Prep List tanpa catatan');
  await b.page.locator('.kartu-item', { hasText: 'Sambal dasar' }).locator('label.pilihan', { hasText: /^1$/ }).click();
  await b.page.locator('label.pilihan', { hasText: 'Pagi' }).first().click();
  await b.page.getByRole('button', { name: 'Kirim prep list' }).click();
  await b.page.waitForTimeout(1800);
  const teks = await b.page.locator('.pesan-formulir').filter({ hasText: 'Prep list terkirim' }).first().innerText().catch(() => '');
  cek(/Stock bahan dan barang jadi sudah diperbarui\./.test(teks) && !/Stock bertambah/.test(teks), 'server lama: pesan lama', teks);
  await b.ctx.close();
}

// G. Data resep tersimpan dari server lama, lalu server baru menjawab: kolom catatan muncul berisi catatan server
{
  const opsi = { serverLama: true };
  const { ctx, page } = await buka(390, 844, 'Budi', '#/pengaturan/resep/Sambal%20dasar', opsi);
  cek(await page.getByLabel('Catatan untuk juru masak (tidak wajib)').count() === 0, 'mula-mula server lama: tanpa kolom');
  opsi.serverLama = false;
  await page.evaluate(() => { location.hash = '#/pengaturan'; });
  await page.waitForTimeout(800);
  await page.evaluate(() => { location.hash = '#/pengaturan/resep/Sambal%20dasar'; });
  await page.waitForTimeout(2000);
  const kolom = page.getByLabel('Catatan untuk juru masak (tidak wajib)');
  cek(await kolom.count() === 1 && await kolom.inputValue() === CATATAN, 'kolom muncul dengan catatan server', await kolom.inputValue().catch(() => 'tidak ada'));
  await ctx.close();
}

// F. Delapan ukuran: catatan 200 huruf (satu kata panjang) di Prep List dan layar ubah resep
A('simpanResep', { baru: false, itemHasil: 'Sambal dasar', hasil: 2, masaSimpan: '3',
  bahan: [{ item: 'Cabai merah', qty: 1 }, { item: 'Bawang merah', qty: 0.5 }, { item: 'Tomat', qty: 0.5 }, { item: 'Minyak goreng', qty: 0.3 }],
  catatan: 'Panjang' + 'x'.repeat(150) + ' lalu kalimat biasa untuk melihat bungkus baris.' });
for (const [w, h] of [[320, 568], [360, 740], [390, 844], [430, 932], [768, 1024], [1024, 768], [1366, 768], [1920, 1080]]) {
  for (const rute of ['#/prep', '#/pengaturan/resep/Sambal%20dasar']) {
    const { ctx, page } = await buka(w, h, rute === '#/prep' ? 'Rina' : 'Budi', rute);
    if (rute === '#/prep') await tambahPrep(page, 'Sambal dasar', 'sambal');
    const m = await page.evaluate((r) => {
      const lebar = document.documentElement.scrollWidth;
      const akar = document.querySelector('.layar-isi');
      const keluar = [...akar.querySelectorAll('*')].filter((e) => {
        if (e.closest('.tabel-bingkai')) return false;
        const b = e.getBoundingClientRect();
        return b.width && (b.right > innerWidth + 1 || b.left < -1);
      }).map((e) => e.className).slice(0, 5);
      const ada = r === '#/prep' ? !!document.querySelector('.catatan-resep') : !!document.querySelector('input[maxlength="200"]');
      const cat = document.querySelector('.catatan-resep');
      const bingkai = cat && cat.closest('.tabel-bingkai');
      const lebarCat = cat ? cat.getBoundingClientRect().right : 0;
      return { lebar, keluar, ada, catDalam: !cat || !bingkai || lebarCat <= bingkai.getBoundingClientRect().right + 1 || bingkai.scrollWidth > bingkai.clientWidth };
    }, rute);
    cek(m.ada && m.lebar <= w && !m.keluar.length && m.catDalam, `ukuran ${w}x${h} ${rute}`, m);
    await ctx.close();
  }
}

console.log('lulus', lulus, 'gagal', gagal, 'galat konsol', galat, 'ERR log', H.logs.filter((l) => l.startsWith('ERR')));
await browser.close();
srv.close();
