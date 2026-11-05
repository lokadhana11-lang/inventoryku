// Uji Chromium: daftar Pengaturan berkelompok dan Laporan dua kolom di laptop (aplikasi 0.49.0, butir 461–463, telaah desain
// butir 6). Kelompok dan urutannya, dua kolom Pengaturan di laptop dan satu kolom di HP/tablet, panel samping berkelompok,
// Laporan Pengelola dua kolom (Staff tetap satu kartu), garis kiri, delapan ukuran, dan gerak.
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';
import { muatChromium } from '../alat/peramban.mjs';
const chromium = await muatChromium();
let gagal = 0, lulus = 0;
const cek = (k, label, x) => { if (k) lulus++; else { gagal++; console.log('GAGAL:', label, x !== undefined ? JSON.stringify(x).slice(0, 900) : ''); } };
seed();

const srv = H.layani(0);
await new Promise((r) => (srv.listening ? r() : srv.once('listening', r)));
const PORT = srv.address().port;
const browser = await chromium.launch();
const galat = [];

async function buka(w, h, opsi = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'Asia/Jakarta', locale: 'id-ID', serviceWorkers: 'block',
    reducedMotion: opsi.gerak ? 'no-preference' : 'reduce' });
  await ctx.route('https://api.uji/**', async (route) => {
    const out = H.aksi(JSON.parse(route.request().postData() || '{}'));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => galat.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(m.text())) galat.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: new RegExp(opsi.nama || 'Budi') }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type(opsi.pin || '482915', { delay: 30 });
  await page.waitForTimeout(1500);
  return { ctx, page };
}
const ke = async (page, hash) => { await page.evaluate((x) => { location.hash = x; }, hash); await page.waitForTimeout(1400); };
const kotak = (page, pilih) => page.evaluate((p) => [...document.querySelectorAll(p)].filter((e) => e.getClientRects().length).map((e) => {
  const b = e.getBoundingClientRect(); return { kiri: Math.round(b.left), kanan: Math.round(b.right), atas: Math.round(b.top), bawah: Math.round(b.bottom) };
}), pilih);
const merekKiri = (page) => page.evaluate(() => Math.round(document.querySelector('.merek').getBoundingClientRect().left));
const gulir = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

const KELOMPOK = [
  ['Orang dan akses', ['Staff dan PIN', 'Penerima email']],
  ['Data dapur', ['Item', 'Resep', 'Menu', 'Unit', 'Pemasok', 'Kategori dan satuan']],
  ['Form dan jadwal', ['Form', 'Outlet dan jadwal', 'Hari libur']]
];

// A. Daftar Pengaturan di HP: tiga kelompok berjudul, berurutan, satu kolom.
{
  const { ctx, page } = await buka(390, 844);
  await ke(page, '#/pengaturan');
  const isi = await page.evaluate(() => [...document.querySelectorAll('#layar nav[aria-label="Bagian pengaturan"] .pengaturan-kelompok')].map((s) => ({
    judul: s.querySelector('h2').textContent,
    label: document.getElementById(s.getAttribute('aria-labelledby')).textContent,
    baris: [...s.querySelectorAll('a.daftar-baris .daftar-baris-judul')].map((e) => e.textContent)
  })));
  cek(JSON.stringify(isi.map((g) => [g.judul, g.baris])) === JSON.stringify(KELOMPOK) && isi.every((g) => g.label === g.judul), 'HP: tiga kelompok berurutan', isi);
  cek(await page.locator('a.daftar-baris').count() === 11, 'HP: sebelas bagian');
  cek(/1 permintaan reset PIN/.test(await page.locator('a.daftar-baris[href="#/pengaturan/staff"]').innerText()), 'HP: tanda reset PIN tetap di Staff dan PIN');
  const k = await kotak(page, '#layar .pengaturan-kelompok');
  cek(k[0].kiri === k[1].kiri && k[1].kiri === k[2].kiri && k[0].bawah < k[1].atas && k[1].bawah < k[2].atas, 'HP: satu kolom', k);
  await page.locator('a.daftar-baris[href="#/pengaturan/form"]').click();
  await page.waitForTimeout(1400);
  cek(await page.evaluate(() => location.hash) === '#/pengaturan/form', 'HP: ketuk Form membuka Form');
  await ctx.close();
}

// B. Laptop: Pengaturan dua kolom (Orang dan akses lalu Form dan jadwal di kiri, Data dapur di kanan), panel samping berkelompok.
for (const [w, h] of [[1024, 768], [1366, 768], [1920, 1080]]) {
  const { ctx, page } = await buka(w, h);
  await ke(page, '#/pengaturan');
  const k = await kotak(page, '#layar .pengaturan-kelompok');
  const m = await merekKiri(page);
  cek(k[0].kiri === m && k[2].kiri === m && k[1].kiri > k[0].kanan && k[0].atas === k[1].atas && k[2].atas > k[0].bawah && k[1].kanan <= w,
    `${w}: Pengaturan dua kolom di garis kiri`, { k, m });
  cek(await gulir(page) <= 0, `${w}: Pengaturan tanpa gulir samping`);
  await ke(page, '#/pengaturan/item');
  const panel = await page.evaluate(() => [...document.querySelectorAll('#layar .panel-samping .panel-samping-grup')].map((g) => ({
    peran: g.getAttribute('role'),
    label: document.getElementById(g.getAttribute('aria-labelledby')).textContent,
    baris: [...g.querySelectorAll('a .panel-samping-judul')].map((e) => e.textContent),
    aktif: [...g.querySelectorAll('a[aria-current]')].map((e) => e.textContent.trim())
  })));
  cek(JSON.stringify(panel.map((g) => [g.label, g.baris])) === JSON.stringify(KELOMPOK) && panel.every((g) => g.peran === 'group'), `${w}: panel samping berkelompok`, panel);
  cek(panel[1].aktif.length === 1 && panel[1].aktif[0] === 'Item' && !panel[0].aktif.length && !panel[2].aktif.length, `${w}: Item ditandai di Data dapur`, panel);
  // Label kelompok di panel hanya tampil di layar setinggi 820 px ke atas; di layar pendek panel muat di layar pertama.
  const label = await page.evaluate(() => getComputedStyle(document.querySelector('#layar .panel-samping-kelompok')).display);
  const [p0] = await kotak(page, '#layar .panel-samping');
  cek(h >= 820 ? label !== 'none' : label === 'none' && p0.bawah <= h, `${w}x${h}: label kelompok ${h >= 820 ? 'tampil' : 'tersembunyi, panel muat'}`, { label, p0 });
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(400);
  const p = await kotak(page, '#layar .panel-samping');
  cek(p[0].atas === 80 && p[0].bawah <= h, `${w}: panel lengket dan muat setelah digulir`, p);
  await ctx.close();
}

// C. Laporan Pengelola: dua kolom di laptop, satu kolom di HP dan tablet; Staff satu kartu selebar layar sempit.
for (const [w, h] of [[320, 568], [360, 740], [390, 844], [430, 932], [768, 1024], [1024, 768], [1366, 768], [1920, 1080]]) {
  const { ctx, page } = await buka(w, h);
  await ke(page, '#/laporan');
  const [pdf] = await kotak(page, '#layar .laporan-pdf');
  const [belanja] = await kotak(page, '#layar .laporan-belanja');
  const [rekap] = await kotak(page, '#layar .laporan-rekap');
  const [kepala] = await kotak(page, '#layar .kepala-layar');
  if (w >= 1024) {
    const m = await merekKiri(page);
    cek(pdf.kiri === m && belanja.kiri > pdf.kanan && pdf.atas === belanja.atas && rekap.kiri === pdf.kiri && rekap.atas > pdf.bawah &&
      Math.abs((pdf.kanan - pdf.kiri) - (belanja.kanan - belanja.kiri)) <= 1, `${w}: Laporan dua kolom`, { pdf, belanja, rekap, m });
    cek(pdf.atas - kepala.bawah === 24, `${w}: tanpa jarak kosong di atas kartu`, { pdf, kepala });
  } else {
    cek(pdf.kiri === belanja.kiri && belanja.kiri === rekap.kiri && pdf.bawah < belanja.atas && belanja.bawah < rekap.atas, `${w}: Laporan satu kolom`, { pdf, belanja, rekap });
  }
  cek(await gulir(page) <= 0, `${w}: Laporan tanpa gulir samping`);
  await ctx.close();
}
{
  const { ctx, page } = await buka(1366, 768, { nama: 'Rina', pin: '730264' });
  await ke(page, '#/laporan');
  const pdf = await kotak(page, '#layar .laporan-pdf');
  cek(pdf.length === 1 && pdf[0].kanan - pdf[0].kiri <= 720 && await page.locator('#layar .laporan-dua').count() === 0 &&
    await page.locator('#layar .laporan-belanja').count() === 0, 'Staff: satu kartu Laporan harian PDF', pdf);
  await ctx.close();
}

// D. Gerak menyala.
{
  const { ctx, page } = await buka(1366, 768, { gerak: true });
  await ke(page, '#/pengaturan');
  cek(await page.locator('#layar .pengaturan-kelompok').count() === 3, 'gerak: tiga kelompok');
  await ke(page, '#/laporan');
  cek(await page.locator('#layar .laporan-belanja').count() === 1, 'gerak: Laporan tampil');
  await ctx.close();
}

console.log('lulus', lulus, 'gagal', gagal, 'galat konsol', galat, 'ERR log', H.logs.filter((l) => l.startsWith('ERR')));
await browser.close();
srv.close();
