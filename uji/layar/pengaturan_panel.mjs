// Uji Chromium Pengaturan dua panel di laptop dan desktop (aplikasi 0.42.0, butir 420-423): setiap layar di dalam Pengaturan,
// kecuali daftar Pengaturan sendiri, menampilkan daftar bagian di kiri dan isi bagian di kanan pada lebar 1.024 px ke atas.
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';
import { muatChromium } from '../alat/peramban.mjs';
const chromium = await muatChromium();
let gagal = 0, lulus = 0;
const cek = (k, label, x) => { if (k) lulus++; else { gagal++; console.log('GAGAL:', label, x !== undefined ? JSON.stringify(x).slice(0, 700) : ''); } };
const s = seed();
const T = s.token;
const A = (action, b) => H.aksi(Object.assign({ action, token: T }, b));

const srv = H.layani(0); // port kosong mana pun
await new Promise((r) => (srv.listening ? r() : srv.once('listening', r)));
const PORT = srv.address().port;
const browser = await chromium.launch();
const galat = [];

async function buka(w, h, rute, opsi = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'Asia/Jakarta', locale: 'id-ID', serviceWorkers: 'block',
    reducedMotion: opsi.gerak ? 'no-preference' : 'reduce', hasTouch: !!opsi.sentuh, isMobile: !!opsi.sentuh });
  await ctx.route('https://api.uji/**', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(H.aksi(body)) });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => galat.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) galat.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: /Budi/ }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type('482915', { delay: 30 });
  await page.waitForTimeout(1500);
  if (rute) {
    await page.evaluate((r) => { location.hash = r; }, rute);
    await page.waitForTimeout(1400);
  }
  return { ctx, page };
}

/** Keadaan panel samping dan kolom isi. */
const ukur = (page) => page.evaluate(() => {
  const kotak = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { kiri: Math.round(b.left), kanan: Math.round(b.right), atas: Math.round(b.top), bawah: Math.round(b.bottom), lebar: Math.round(b.width) }; };
  const panel = document.querySelector('#layar .panel-samping');
  const tampil = !!panel && getComputedStyle(panel).display !== 'none';
  const baris = panel ? [...panel.querySelectorAll('a')] : [];
  const aktif = baris.filter((a) => a.hasAttribute('aria-current'));
  return {
    ada: !!panel,
    tampil,
    panel: kotak(panel),
    isi: kotak(document.querySelector('#layar .layar-isi')),
    judul: kotak(document.querySelector('#layar .kepala-layar .judul-layar, #layar .kepala-layar .kepala-isi')),
    baris: baris.map((a) => a.textContent.trim()),
    href: baris.map((a) => a.getAttribute('href')),
    aktif: aktif.map((a) => a.textContent.trim()),
    aktifJenis: aktif.map((a) => a.getAttribute('aria-current')),
    gulirSamping: document.documentElement.scrollWidth - innerWidth,
    posisi: panel ? getComputedStyle(panel).position : '',
    kembali: (document.querySelector('#layar .kepala-layar .tautan-kembali') || {}).textContent || ''
  };
});

const BAGIAN = ['Staff dan PIN', 'Penerima email', 'Form', 'Item', 'Resep', 'Menu', 'Unit', 'Pemasok', 'Kategori dan satuan', 'Outlet dan jadwal', 'Hari libur'];

// A. 1.366 x 768: daftar Pengaturan tetap satu kolom tanpa panel samping; layar bagian dua panel
{
  const { ctx, page } = await buka(1366, 768, '#/pengaturan');
  const akar = await ukur(page);
  cek(!akar.ada, 'daftar Pengaturan tanpa panel samping', akar);
  cek(await page.locator('a.daftar-baris').count() === 11, 'daftar Pengaturan 11 bagian');

  await page.locator('a.daftar-baris[href="#/pengaturan/item"]').click();
  await page.waitForTimeout(1400);
  const m = await ukur(page);
  cek(m.tampil && JSON.stringify(m.baris.map((t) => t.replace(/\d+ permintaan reset PIN/, '').trim())) === JSON.stringify(BAGIAN), 'panel samping 11 bagian berurutan', m.baris);
  cek(m.aktif.length === 1 && m.aktif[0] === 'Item' && m.aktifJenis[0] === 'page', 'Item ditandai aktif (page)', m);
  cek(m.panel.kanan + 24 <= m.isi.kiri + 1 && m.isi.lebar >= 640, 'panel di kiri, isi di kanan selebar layar sempit', m);
  cek(Math.abs(m.judul.kiri - m.isi.kiri) <= 1, 'judul di kepala navy sejajar kolom isi', { judul: m.judul, isi: m.isi });
  cek(m.posisi === 'sticky' && m.gulirSamping <= 0, 'panel lengket, tanpa gulir ke samping', m);
  cek(/Pengaturan/.test(m.kembali), 'tautan kembali ke Pengaturan tetap ada', m.kembali);
  cek(/1 permintaan reset PIN/.test(m.baris[0]), 'tanda permintaan reset PIN di Staff dan PIN', m.baris[0]);

  // Pindah bagian langsung dari panel samping, tanpa kembali ke daftar
  await page.locator('.panel-samping a[href="#/pengaturan/pemasok"]').click();
  await page.waitForTimeout(1400);
  const p = await ukur(page);
  cek(await page.evaluate(() => location.hash) === '#/pengaturan/pemasok' && p.aktif[0] === 'Pemasok', 'pindah ke Pemasok dari panel', p.aktif);
  cek(/Pemasok/.test(await page.locator('#layar .kepala-layar').innerText()), 'judul Pemasok');

  // Panel tetap terlihat saat isi digulir (Item punya daftar panjang)
  await page.locator('.panel-samping a[href="#/pengaturan/item"]').click();
  await page.waitForTimeout(1400);
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(500);
  const g = await ukur(page);
  cek(await page.evaluate(() => scrollY) === 500 && g.panel.atas === 80 && g.panel.bawah <= 768, 'panel tetap terlihat setelah digulir (16 px di bawah bar)', g.panel);

  // Layar lebih dalam: ubah item → Item tetap ditandai (bukan halaman itu sendiri)
  await page.locator('#layar .layar-isi a[href^="#/pengaturan/item/"]').first().click();
  await page.waitForTimeout(1400);
  const d = await ukur(page);
  cek(d.tampil && d.aktif[0] === 'Item' && d.aktifJenis[0] === 'true', 'ubah item: Item ditandai (lokasi)', d);
  cek(/Item/.test(d.kembali), 'ubah item: kembali ke Item', d.kembali);
  await ctx.close();
}

// B. Alamat lain di dalam Pengaturan menandai bagian induknya
for (const [rute, bagian] of [['#/pengaturan/item-baru', 'Item'], ['#/pengaturan/item-harga', 'Item'], ['#/pengaturan/form-baru', 'Form'],
  ['#/pengaturan/resep-baru', 'Resep'], ['#/pengaturan/menu-baru', 'Menu'], ['#/pengaturan/staff/Rina', 'Staff dan PIN'],
  ['#/pengaturan/kategori', 'Kategori dan satuan'], ['#/pengaturan/outlet', 'Outlet dan jadwal'], ['#/pengaturan/libur', 'Hari libur']]) {
  const { ctx, page } = await buka(1366, 768, rute);
  const m = await ukur(page);
  cek(m.tampil && m.aktif.length === 1 && m.aktif[0].startsWith(bagian), `${rute}: ${bagian} ditandai`, m.aktif);
  await ctx.close();
}

// C. HP dan tablet tegak: tidak ada panel samping yang terlihat, tata letak tetap
for (const [w, h] of [[390, 844], [768, 1024]]) {
  const { ctx, page } = await buka(w, h, '#/pengaturan/item', { sentuh: true });
  const m = await ukur(page);
  cek(!m.tampil && m.gulirSamping <= 0, `${w}x${h}: panel samping tidak tampil`, m);
  cek(await page.getByRole('navigation', { name: 'Bagian pengaturan' }).count() === 0, `${w}x${h}: panel tidak terbaca pembaca layar`);
  await ctx.close();
}

// D. Memutar tablet: 768 → 1.024 px menampilkan panel, kembali menyembunyikannya
{
  const { ctx, page } = await buka(768, 1024, '#/pengaturan/unit', { sentuh: true });
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(400);
  const m = await ukur(page);
  cek(m.tampil && m.aktif[0] === 'Unit' && m.gulirSamping <= 0, 'diputar ke 1.024 px: panel tampil', m);
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(400);
  cek(!(await ukur(page)).tampil, 'diputar kembali: panel tersembunyi');
  await ctx.close();
}

// E. Papan ketik: fokus di panel terlihat (garis 2 px), Enter membuka bagian
{
  const { ctx, page } = await buka(1366, 768, '#/pengaturan/staff');
  await page.keyboard.press('Tab');
  await page.locator('.panel-samping a[href="#/pengaturan/unit"]').focus();
  const garis = await page.evaluate(() => { const a = document.activeElement; return a.matches(':focus-visible') ? getComputedStyle(a).outlineWidth : ''; });
  cek(garis === '2px', 'fokus panel terlihat', garis);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1400);
  cek(await page.evaluate(() => location.hash) === '#/pengaturan/unit', 'Enter di panel membuka Unit');
  await ctx.close();
}

// F. Dengan gerak (View Transitions): pindah bagian tetap menampilkan satu panel dengan tanda yang benar
{
  const { ctx, page } = await buka(1366, 768, '#/pengaturan/staff', { gerak: true });
  await page.locator('.panel-samping a[href="#/pengaturan/resep"]').click();
  await page.waitForTimeout(1500);
  const m = await ukur(page);
  cek(await page.locator('.panel-samping').count() === 1 && m.aktif[0] === 'Resep', 'gerak: satu panel, Resep aktif', m.aktif);
  await page.locator('#layar .kepala-layar .tautan-kembali').click();
  await page.waitForTimeout(1500);
  cek(!(await ukur(page)).ada && await page.locator('a.daftar-baris').count() === 11, 'gerak: kembali ke daftar Pengaturan tanpa panel');
  await ctx.close();
}

// G. Permintaan reset PIN selesai: tanda hilang dari panel sesudah Beranda diperbarui
{
  const r = A('aturPin', { nama: 'Andi', pin: '615283' });
  cek(r.ok, 'aturPin Andi', r);
  const { ctx, page } = await buka(1366, 768, '#/pengaturan/unit');
  const m = await ukur(page);
  cek(!/reset PIN/.test(m.baris[0]), 'tanpa permintaan reset: tanpa tanda', m.baris[0]);
  await ctx.close();
}

// H. Delapan ukuran: tanpa gulir ke samping; di 1.024 px ke atas panel dan isi tidak bertumpuk dan muat di layar
for (const [w, h] of [[320, 568], [360, 740], [390, 844], [430, 932], [768, 1024], [1024, 768], [1366, 768], [1920, 1080]]) {
  const { ctx, page } = await buka(w, h, '#/pengaturan/outlet', { sentuh: w < 1024 });
  const m = await ukur(page);
  const lebar = w >= 1024;
  cek(m.gulirSamping <= 0 && m.tampil === lebar, `ukuran ${w}x${h}: panel ${lebar ? 'tampil' : 'tersembunyi'}`, m);
  if (lebar) cek(m.panel.kiri >= 0 && m.isi.kanan <= w && m.panel.kanan <= m.isi.kiri && m.panel.bawah <= h, `ukuran ${w}x${h}: panel dan isi muat`, m);
  await ctx.close();
}

console.log('lulus', lulus, 'gagal', gagal, 'galat konsol', galat, 'ERR log', H.logs.filter((l) => l.startsWith('ERR')));
await browser.close();
srv.close();
