// Uji Chromium: satu penanda menu aktif di bar atas laptop dan desktop (aplikasi 0.52.0, butir 470–471, telaah desain butir 9).
// Desktop: menu aktif tanpa pil, hanya garis amber di bawahnya (dan teks Kertas); pil tipis hanya saat kursor di atas menu lain.
// HP dan tablet: bar bawah tetap dengan pil dan garis amber. Delapan ukuran dan gerak.
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
  await page.getByRole('button', { name: /Budi/ }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type('482915', { delay: 30 });
  await page.waitForTimeout(1600);
  await page.mouse.move(1, 700);
  return { ctx, page };
}

/** Keadaan penanda: pil (::before) tiap menu, garis amber, pil bar bawah. */
const baca = (page) => page.evaluate(() => {
  const item = [...document.querySelectorAll('#menu-grup .menu-item')];
  const aktif = item.find((a) => a.getAttribute('aria-current') === 'page');
  const garis = document.querySelector('#menu-grup .menu-penanda');
  const gb = garis.getBoundingClientRect();
  const ab = aktif.getBoundingClientRect();
  const pil = document.querySelector('#menu-grup .menu-pil');
  return {
    aktif: aktif.getAttribute('data-menu'),
    pilAktif: Number(getComputedStyle(aktif, '::before').opacity),
    pilLain: item.filter((a) => a !== aktif).map((a) => Number(getComputedStyle(a, '::before').opacity)),
    garis: { lebar: Math.round(gb.width), kiri: Math.round(gb.left), kanan: Math.round(gb.right), tinggi: Math.round(gb.height) },
    item: { kiri: Math.round(ab.left), kanan: Math.round(ab.right) },
    warnaAktif: getComputedStyle(aktif).color,
    warnaLain: getComputedStyle(item.find((a) => a !== aktif)).color,
    pilBawah: pil ? { tampil: getComputedStyle(pil).display !== 'none' && pil.classList.contains('terlihat'), lebar: parseFloat(pil.style.width) || 0 } : null
  };
});

// A. Laptop: hanya garis amber di bawah menu aktif; pindah menu memindahkan garisnya.
{
  const { ctx, page } = await buka(1366, 768);
  await page.waitForTimeout(400);
  let m = await baca(page);
  cek(m.aktif === 'beranda' && m.pilAktif === 0 && m.pilLain.every((o) => o === 0), 'laptop: tanpa pil di menu aktif', m);
  cek(m.garis.lebar > 30 && m.garis.kiri >= m.item.kiri && m.garis.kanan <= m.item.kanan, 'laptop: garis amber di bawah menu aktif', m);
  cek(m.warnaAktif !== m.warnaLain, 'laptop: teks menu aktif berbeda warna', m);
  await page.locator('#menu-grup a[data-menu="riwayat"]').click();
  await page.waitForTimeout(1600);
  await page.mouse.move(1, 700);
  await page.waitForTimeout(400);
  m = await baca(page);
  cek(m.aktif === 'riwayat' && m.pilAktif === 0 && m.garis.kiri >= m.item.kiri && m.garis.kanan <= m.item.kanan, 'laptop: garis pindah ke Riwayat', m);
  // Kursor di atas menu lain: pil tipis muncul sebagai tanda bisa diklik; di atas menu aktif: tetap tanpa pil.
  await page.locator('#menu-grup a[data-menu="laporan"]').hover();
  await page.waitForTimeout(400);
  const hover = await page.evaluate(() => Number(getComputedStyle(document.querySelector('#menu-grup a[data-menu="laporan"]'), '::before').opacity));
  cek(hover > 0 && hover < 1, 'laptop: pil tipis saat kursor di atas menu lain', hover);
  await page.locator('#menu-grup a[data-menu="riwayat"]').hover();
  await page.waitForTimeout(400);
  cek((await baca(page)).pilAktif === 0, 'laptop: kursor di atas menu aktif tetap tanpa pil');
  await ctx.close();
}

// B. Delapan ukuran: desktop satu penanda, HP dan tablet tetap pil dan garis di bar bawah.
for (const [w, h] of [[320, 568], [360, 740], [390, 844], [430, 932], [768, 1024], [1024, 768], [1366, 768], [1920, 1080]]) {
  const { ctx, page } = await buka(w, h);
  await page.waitForTimeout(400);
  const m = await baca(page);
  if (w >= 1024) cek(m.pilAktif === 0 && m.garis.lebar > 30 && m.garis.tinggi >= 3, `${w}: satu penanda (garis amber)`, m);
  else cek(m.pilBawah && m.pilBawah.tampil && m.pilBawah.lebar > 30 && m.garis.lebar > 0, `${w}: bar bawah tetap pil dan garis`, m);
  await ctx.close();
}

// C. Gerak menyala: garis bergeser ke menu baru, pil menu aktif tetap tidak tampil.
{
  const { ctx, page } = await buka(1366, 768, { gerak: true });
  await page.locator('#menu-grup a[data-menu="laporan"]').click();
  await page.waitForTimeout(1800);
  await page.mouse.move(1, 700);
  await page.waitForTimeout(500);
  const m = await baca(page);
  cek(m.aktif === 'laporan' && m.pilAktif === 0 && m.garis.kiri >= m.item.kiri && m.garis.kanan <= m.item.kanan, 'gerak: garis di bawah Laporan', m);
  await ctx.close();
}

console.log('lulus', lulus, 'gagal', gagal, 'galat konsol', galat, 'ERR log', H.logs.filter((l) => l.startsWith('ERR')));
await browser.close();
srv.close();
