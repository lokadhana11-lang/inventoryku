import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';
import { muatChromium } from '../alat/peramban.mjs';
const chromium = await muatChromium();
let gagal = 0, lulus = 0;
const cek = (k, label, x) => { if (k) lulus++; else { gagal++; console.log('GAGAL:', label, x !== undefined ? JSON.stringify(x).slice(0, 300) : ''); } };
const s = seed();
const TR = H.aksi({ action: 'login', nama: 'Rina', pin: '730264' }).data.token;
const hari = (n) => new Date(Date.now() + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
// Satu baris dilaporkan keliru pada tanggal -2
const rw = H.aksi({ action: 'riwayat', token: s.token, formId: 'STOCK', dari: hari(-6), sampai: hari(0), tampilan: 'catatan' }).data;
const kirLapor = rw.kiriman.filter((k) => k.tanggal === hari(-2))[0];
H.aksi({ action: 'laporkanKeliru', token: TR, formId: 'STOCK', rowId: kirLapor.baris[0].rowId, catatan: 'cek lagi' });
const srv = H.layani(0); // port kosong mana pun
await new Promise((r) => (srv.listening ? r() : srv.once('listening', r)));
const PORT = srv.address().port;
const browser = await chromium.launch();
const galat = [];

async function buka(w, h, siapa, opsi = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'Asia/Jakarta', locale: 'id-ID', serviceWorkers: 'block', reducedMotion: opsi.gerak ? 'no-preference' : 'reduce' });
  if (opsi.serverLama) {
    await ctx.route('https://api.uji/**', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      const out = H.aksi(body);
      if (body.action === 'riwayat' && out.ok) delete out.data.periksaBanyak;
      if (body.action === 'tandaiDiperiksaBanyak') { route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, pesan: 'Aksi tidak dikenal.' }) }); return; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
    });
  } else if (opsi.galatServer) {
    await ctx.route('https://api.uji/**', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      if (body.action === 'tandaiDiperiksaBanyak') { route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, pesan: 'Ada baris yang dilaporkan keliru. Koreksi barisnya atau tutup laporannya dulu.' }) }); return; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(H.aksi(body)) });
    });
  } else await H.pasangRute(ctx);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => galat.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') galat.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: new RegExp(siapa) }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type(siapa === 'Budi' ? '482915' : '730264', { delay: 30 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { location.hash = '#/riwayat'; });
  await page.waitForTimeout(1500);
  return { ctx, page };
}
const tombolPeriksa = (page) => page.locator('.tombol-periksa-tanggal');

// A. HP Pengelola: tombol per tanggal, tanggal dilaporkan (1), konfirmasi, hasil
{
  const { ctx, page } = await buka(390, 844, 'Budi');
  const teks = await tombolPeriksa(page).allTextContents();
  cek(teks.length >= 6, 'tombol per tanggal tampil', teks);
  const grup = page.locator('section.kelompok', { has: page.locator('.kelompok-judul', { hasText: /\d+ Oktober/ }) });
  const judulLapor = await page.evaluate((tg) => {
    const d = new Date(tg + 'T12:00:00+07:00');
    return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jakarta' }).replace('.', '');
  }, hari(-2));
  const g = page.locator('section.kelompok').filter({ has: page.locator('h2.kelompok-judul', { hasText: judulLapor.split(',')[1].trim() }) }).first();
  const tb = g.locator('.tombol-periksa-tanggal');
  cek((await tb.textContent()).trim() === 'Tandai diperiksa (1)', 'tanggal berlaporan: (1)', await tb.textContent());
  cek(/Tandai diperiksa \(1\), /.test(await tb.getAttribute('aria-label')), 'aria-label memuat teks tombol dan tanggal', await tb.getAttribute('aria-label'));
  await tb.click();
  await page.waitForTimeout(500);
  const lembar = page.locator('[role="dialog"]');
  const isiLembar = await lembar.innerText();
  cek(/Tandai 1 isian diperiksa\?/.test(isiLembar) && /1 isian yang punya baris dilaporkan keliru tidak ikut/.test(isiLembar) && /atas nama Budi/.test(isiLembar), 'teks konfirmasi', isiLembar);
  // Batal dulu
  await lembar.getByRole('button', { name: 'Batal' }).click();
  await page.waitForTimeout(400);
  cek((await g.locator('.tombol-periksa-tanggal').count()) === 1, 'Batal: tombol tetap');
  await g.locator('.tombol-periksa-tanggal').click();
  await page.waitForTimeout(400);
  await page.locator('[role="dialog"]').getByRole('button', { name: 'Tandai diperiksa' }).click();
  await page.waitForTimeout(1200);
  const toastTeks = await page.locator('.toast, .pesan-singkat, [role="status"]').allInnerTexts();
  cek(toastTeks.some((t) => /1 isian ditandai diperiksa\./.test(t)), 'pesan singkat sesudah tandai', toastTeks);
  cek((await g.locator('.tombol-periksa-tanggal').count()) === 0, 'tombol tanggal itu hilang (sisa hanya yang dilaporkan)');
  const tanda = await g.locator('.kiriman-baris').allInnerTexts();
  cek(tanda.filter((t) => /Diperiksa/.test(t)).length === 1 && tanda.filter((t) => /dilaporkan keliru/.test(t)).length === 1, 'satu Diperiksa satu dilaporkan', tanda);
  // Semua tanggal lain: tandai dua kiriman sekaligus
  const g2 = page.locator('section.kelompok').filter({ has: page.locator('.tombol-periksa-tanggal', { hasText: '(2)' }) }).first();
  await g2.locator('.tombol-periksa-tanggal').click();
  await page.waitForTimeout(300);
  await page.locator('[role="dialog"]').getByRole('button', { name: 'Tandai diperiksa' }).click();
  await page.waitForTimeout(1200);
  const t2 = await page.locator('.toast, .pesan-singkat, [role="status"]').allInnerTexts();
  cek(t2.some((t) => /2 isian ditandai diperiksa\./.test(t)), 'dua sekaligus', t2);
  // Muat ulang: tetap diperiksa (server)
  await page.reload();
  await page.waitForTimeout(2500);
  const sisa = await tombolPeriksa(page).count();
  cek(sisa === teks.length - 2, 'sesudah muat ulang dua tanggal tanpa tombol', { sebelum: teks.length, sisa });
  // Tanpa sinyal
  await ctx.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await tombolPeriksa(page).first().click();
  await page.waitForTimeout(400);
  const t3 = await page.locator('.toast, .pesan-singkat, [role="status"]').allInnerTexts();
  cek(t3.some((t) => /Tidak ada sinyal/.test(t)) && (await page.locator('[role="dialog"]').count()) === 0, 'tanpa sinyal: pesan, tanpa lembar', t3);
  await ctx.setOffline(false);
  await page.screenshot({ path: 'shot/periksa_390.png', fullPage: true });
  await ctx.close();
}
// B. Desktop: detail kanan ikut berubah
{
  const { ctx, page } = await buka(1366, 900, 'Budi');
  const g = page.locator('section.kelompok').filter({ has: page.locator('.tombol-periksa-tanggal') }).first();
  await g.locator('.kiriman-baris').first().click();
  await page.waitForTimeout(800);
  cek((await page.locator('.detail-kepala').getByRole('button', { name: 'Tandai diperiksa' }).count()) === 1, 'detail kanan: tombol satuan ada');
  await g.locator('.tombol-periksa-tanggal').click();
  await page.waitForTimeout(300);
  await page.locator('[role="dialog"]').getByRole('button', { name: 'Tandai diperiksa' }).click();
  await page.waitForTimeout(1200);
  cek((await page.locator('.detail-kepala').getByRole('button', { name: 'Buka kunci' }).count()) === 1, 'detail kanan: kini Buka kunci');
  const lebar = await page.evaluate(() => document.documentElement.scrollWidth);
  cek(lebar <= 1366, 'desktop tanpa gulir samping', lebar);
  await page.screenshot({ path: 'shot/periksa_1366.png' });
  await ctx.close();
}
// C. Staff: tanpa tombol
{
  const { ctx, page } = await buka(390, 844, 'Rina');
  cek((await tombolPeriksa(page).count()) === 0, 'Staff tanpa tombol');
  await ctx.close();
}
// D. Server lama: tanpa tombol
{
  const { ctx, page } = await buka(390, 844, 'Budi', { serverLama: true });
  cek((await tombolPeriksa(page).count()) === 0, 'server lama tanpa tombol');
  cek((await page.locator('.kelompok-kepala').count()) === 0, 'server lama: judul seperti dulu');
  await ctx.close();
}
// E. Galat server tampil di lembar
{
  const { ctx, page } = await buka(390, 844, 'Budi', { galatServer: true });
  await tombolPeriksa(page).first().click();
  await page.waitForTimeout(300);
  const lembar = page.locator('[role="dialog"]');
  await lembar.getByRole('button', { name: 'Tandai diperiksa' }).click();
  await page.waitForTimeout(800);
  cek(/Ada baris yang dilaporkan keliru/.test(await lembar.innerText()) && (await lembar.count()) === 1, 'galat di lembar, lembar tetap terbuka');
  await ctx.close();
}
// F. Delapan ukuran: tanpa gulir samping, tombol >= 44 px, tidak keluar layar, judul dan tombol tidak bertumpuk
for (const [w, hgt] of [[320, 568], [360, 740], [390, 844], [768, 1024], [1024, 768], [1280, 800], [1366, 768], [1920, 1080]]) {
  const { ctx, page } = await buka(w, hgt, 'Budi');
  const u = await page.evaluate(() => {
    const out = { scroll: document.documentElement.scrollWidth, vw: innerWidth, kecil: 0, keluar: 0, tumpuk: 0, terpotong: 0, n: 0 };
    document.querySelectorAll('.kelompok-kepala').forEach((kp) => {
      const h = kp.querySelector('h2').getBoundingClientRect(), b = kp.querySelector('button').getBoundingClientRect();
      out.n++;
      if (b.height < 44 || b.width < 44) out.kecil++;
      if (b.right > innerWidth || b.left < 0) out.keluar++;
      if (!(h.right <= b.left + 0.5 || h.bottom <= b.top + 0.5)) out.tumpuk++;
      const t = kp.querySelector('.tombol-teks');
      if (t.scrollWidth > t.clientWidth + 1) out.terpotong++;
    });
    return out;
  });
  cek(u.scroll <= u.vw && u.n > 0 && !u.kecil && !u.keluar && !u.tumpuk && !u.terpotong, 'ukuran ' + w + 'x' + hgt, u);
  if (w === 320) await page.screenshot({ path: 'shot/periksa_320.png' });
  await ctx.close();
}
// G. Gerak normal (tidak kurangi gerak): alur tetap jalan
{
  const { ctx, page } = await buka(390, 844, 'Budi', { gerak: true });
  const n0 = await tombolPeriksa(page).count();
  await tombolPeriksa(page).first().click();
  await page.waitForTimeout(500);
  await page.locator('[role="dialog"]').getByRole('button', { name: 'Tandai diperiksa' }).click();
  await page.waitForTimeout(1500);
  cek((await tombolPeriksa(page).count()) === n0 - 1, 'dengan gerak: tombol berkurang satu', { n0, n: await tombolPeriksa(page).count() });
  await ctx.close();
}
console.log('lulus', lulus, 'gagal', gagal, 'galat konsol', galat.slice(0, 5));
await browser.close(); srv.close();
