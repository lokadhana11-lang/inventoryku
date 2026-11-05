// Uji Chromium: pintasan Dashboard (aplikasi 0.50.0, butir 464–466, telaah desain butir 7). Ubin "Di bawah stok minimum"
// membuka Daftar belanja di Laporan (#/laporan?bagian=belanja: digulir ke kartunya, judulnya difokus); Stock opname dan HPP dan
// food cost sebagai kartu tautan berikon. Delapan ukuran, Staff, dan gerak.
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
const rapi = (t) => String(t).replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

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
  await page.evaluate((x) => { location.hash = x; }, opsi.rute || '#/dashboard');
  await page.waitForTimeout(1600);
  return { ctx, page };
}

const posisiBelanja = (page) => page.evaluate(() => {
  const k = document.querySelector('#layar .laporan-belanja');
  const b = k ? k.getBoundingClientRect() : null;
  return {
    hash: location.hash,
    ada: !!k,
    atas: b ? Math.round(b.top) : null,
    tinggiLayar: innerHeight,
    gulir: Math.round(scrollY),
    fokus: document.activeElement ? document.activeElement.textContent : '',
    menu: (document.querySelector('#menu-grup [aria-current="page"]') || {}).textContent || ''
  };
});

// A. HP Pengelola: ubin membuka Daftar belanja; kartu tautan Stock opname dan HPP.
{
  const { ctx, page } = await buka(390, 844);
  const ubin = page.locator('#layar a.ubin-belanja');
  cek(await ubin.count() === 1 && await ubin.getAttribute('href') === '#/laporan?bagian=belanja', 'ubin Di bawah stok minimum berupa tautan');
  const label = await ubin.getAttribute('aria-label');
  cek(/^Di bawah stok minimum: \d+ item\. Buka Daftar belanja$/.test(label), 'nama tautan ubin', label);
  cek(/item · Daftar belanja/.test(rapi(await ubin.innerText())), 'keterangan ubin menyebut Daftar belanja', await ubin.innerText());
  // Ubin lain tetap bukan tautan.
  cek(await page.locator('#layar .angka-ringkas a').count() === 1, 'hanya satu ubin yang bisa diketuk');

  const kartu = page.locator('#layar nav[aria-label="Pintasan"] a.kartu-tautan');
  cek(await kartu.count() === 2 && await kartu.nth(0).getAttribute('href') === '#/opname' && await kartu.nth(1).getAttribute('href') === '#/hpp', 'dua kartu tautan');
  const op = rapi(await kartu.nth(0).innerText());
  const hpp = rapi(await kartu.nth(1).innerText());
  cek(/^Stock opname Belum ada stock opname$/.test(op) && await kartu.nth(0).locator('.tanda-status').count() === 1 &&
    await kartu.nth(0).locator('.ubin-ikon-tinjau').count() === 1, 'Stock opname: belum ada, Perlu ditinjau', op);
  cek(/^HPP dan food cost \S+ [\d,]+% sementara · target 35%$/.test(hpp) && await kartu.nth(1).locator('.tanda-status').count() === 0 &&
    await kartu.nth(1).locator('.ubin-ikon-biasa').count() === 1, 'HPP: food cost di bawah target, tanpa tanda', hpp);
  cek(await page.locator('#layar .dashboard-pintas .tombol').count() === 0, 'tombol garis lama tidak ada lagi');

  await ubin.click();
  await page.waitForTimeout(1600);
  const p = await posisiBelanja(page);
  cek(p.hash === '#/laporan?bagian=belanja' && p.ada && p.menu === 'Laporan', 'membuka Laporan', p);
  cek(p.gulir > 0 && p.atas >= 0 && p.atas < 120, 'digulir ke Daftar belanja', p);
  cek(p.fokus === 'Daftar belanja', 'judul Daftar belanja difokus', p);

  await page.evaluate(() => { location.hash = '#/dashboard'; });
  await page.waitForTimeout(1400);
  await page.locator('#layar a.kartu-tautan[href="#/opname"]').click();
  await page.waitForTimeout(1400);
  cek(await page.evaluate(() => location.hash) === '#/opname', 'kartu Stock opname membuka Stock opname');
  // Laporan tanpa ?bagian: tetap di atas.
  await page.evaluate(() => { location.hash = '#/laporan'; });
  await page.waitForTimeout(1400);
  cek((await posisiBelanja(page)).gulir === 0, 'Laporan biasa tidak digulir');
  await ctx.close();
}

// B. Food cost di atas target: kartu HPP bertanda Perlu ditinjau.
{
  const { ctx, page } = await buka(390, 844);
  await page.route('https://api.uji/**', async (route) => {
    const out = H.aksi(JSON.parse(route.request().postData() || '{}'));
    if (out.ok && out.data && out.data.hpp) out.data.hpp.target = 10;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
  });
  await page.evaluate(() => { location.hash = '#/laporan'; });
  await page.waitForTimeout(1000);
  await page.evaluate(() => { location.hash = '#/dashboard'; });
  await page.waitForTimeout(1800);
  const kartu = page.locator('#layar a.kartu-tautan[href="#/hpp"]');
  cek(await kartu.locator('.tanda-status').count() === 1 && await kartu.locator('.ubin-ikon-tinjau').count() === 1 &&
    /target 10%/.test(rapi(await kartu.innerText())), 'HPP di atas target: tanda Perlu ditinjau', await kartu.innerText());
  await ctx.close();
}

// C. Delapan ukuran: tanpa gulir samping, kartu tautan ≥ 56 px (bersusun di HP, berdampingan mulai 600 px), ubin ≥ 44 px,
// dan dari ubin ke Daftar belanja yang terlihat.
for (const [w, h] of [[320, 568], [360, 740], [390, 844], [430, 932], [768, 1024], [1024, 768], [1366, 768], [1920, 1080]]) {
  const { ctx, page } = await buka(w, h);
  const m = await page.evaluate(() => {
    const r = (e) => { const b = e.getBoundingClientRect(); return { kiri: Math.round(b.left), atas: Math.round(b.top), kanan: Math.round(b.right), tinggi: Math.round(b.height) }; };
    return {
      gulir: document.documentElement.scrollWidth - innerWidth,
      kartu: [...document.querySelectorAll('#layar a.kartu-tautan')].map(r),
      ubin: r(document.querySelector('#layar a.ubin-belanja')),
      ketUbin: (() => { const k = document.querySelector('#layar .ubin-ket-tautan'); const u = document.querySelector('#layar a.ubin-belanja'); return k.getBoundingClientRect().right <= u.getBoundingClientRect().right + 1; })()
    };
  });
  cek(m.gulir <= 0 && m.kartu.every((k) => k.tinggi >= 56 && k.kanan <= w) && m.ubin.tinggi >= 44 && m.ketUbin, `${w}: tanpa gulir samping, ukuran sentuh`, m);
  cek(w >= 600 ? m.kartu[0].atas === m.kartu[1].atas && m.kartu[1].kiri > m.kartu[0].kanan : m.kartu[1].atas > m.kartu[0].atas && m.kartu[0].kiri === m.kartu[1].kiri,
    `${w}: kartu ${w >= 600 ? 'berdampingan' : 'bersusun'}`, m.kartu);
  await page.locator('#layar a.ubin-belanja').click();
  await page.waitForTimeout(1600);
  const p = await posisiBelanja(page);
  cek(p.ada && p.atas >= 0 && p.atas < p.tinggiLayar - 100, `${w}: Daftar belanja terlihat`, p);
  await ctx.close();
}

// D. Staff membuka alamat yang sama: Laporan biasa tanpa galat dan tanpa digulir.
{
  const { ctx, page } = await buka(390, 844, { nama: 'Rina', pin: '730264', rute: '#/laporan?bagian=belanja' });
  const p = await posisiBelanja(page);
  cek(!p.ada && p.gulir === 0 && await page.locator('#layar .laporan-pdf').count() === 1, 'Staff: Laporan biasa', p);
  await ctx.close();
}

// E. Gerak menyala.
{
  const { ctx, page } = await buka(1366, 768, { gerak: true });
  await page.locator('#layar a.ubin-belanja').click();
  await page.waitForTimeout(1800);
  const p = await posisiBelanja(page);
  cek(p.ada && p.atas >= 0 && p.atas < p.tinggiLayar && p.fokus === 'Daftar belanja', 'gerak: Daftar belanja terlihat dan difokus', p);
  await ctx.close();
}

console.log('lulus', lulus, 'gagal', gagal, 'galat konsol', galat, 'ERR log', H.logs.filter((l) => l.startsWith('ERR')));
await browser.close();
srv.close();
