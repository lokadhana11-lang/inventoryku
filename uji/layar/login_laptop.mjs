// Uji Chromium Login di laptop berlayar pendek (aplikasi 0.41.1, butir 417-419): panel Login di lebar 1.024 px ke atas
// dan tinggi 700-919 px dirapatkan, supaya langkah PIN sampai "Pulihkan akses Pengelola" dan versi terlihat tanpa digulir.
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';
import { muatChromium } from '../alat/peramban.mjs';
const chromium = await muatChromium();
let gagal = 0, lulus = 0;
const cek = (k, label, x) => { if (k) lulus++; else { gagal++; console.log('GAGAL:', label, x !== undefined ? JSON.stringify(x).slice(0, 700) : ''); } };
seed();

const srv = H.layani(0); // port kosong mana pun
await new Promise((r) => (srv.listening ? r() : srv.once('listening', r)));
const PORT = srv.address().port;
const browser = await chromium.launch();
const galat = [];

async function buka(w, h, opsi = {}) {
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
  await page.waitForTimeout(opsi.gerak ? 2000 : 1000);
  return { ctx, page };
}

/** Ukuran Login sekarang: gulir, panel, tombol, dan apakah tiap bagian penting di dalam layar. */
const ukur = (page) => page.evaluate(() => {
  const kotak = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { atas: b.top, bawah: b.bottom, kiri: b.left, kanan: b.right, tinggi: b.height, tampil: getComputedStyle(e).display !== 'none' }; };
  const dalam = (b) => !!b && b.atas >= 0 && b.bawah <= innerHeight + 0.5;
  const pulihkan = kotak('.login-bawah .login-tautan');
  const versi = kotak('.login-versi');
  const angka = [...document.querySelectorAll('.tombol-angka')].map((e) => e.getBoundingClientRect().height);
  return {
    gulirTegak: document.documentElement.scrollHeight - innerHeight,
    gulirSamping: document.documentElement.scrollWidth - innerWidth,
    panel: kotak('.login'),
    panelDalam: dalam(kotak('.login')),
    pulihkanDalam: dalam(pulihkan),
    versiDalam: dalam(versi),
    satuBaris: !!pulihkan && !!versi && Math.abs((pulihkan.atas + pulihkan.bawah) / 2 - (versi.atas + versi.bawah) / 2) < 2,
    papanDalam: dalam(kotak('.papan')),
    pilihanDalam: dalam(kotak('.login-pilihan')),
    angka: angka.length ? Math.round(Math.min(...angka)) : 0,
    inisial: !!(kotak('.login-sapa-inisial') || {}).tampil,
    pesan: (document.querySelector('.pesan-login:not(.keterangan-login)') || {}).textContent || '',
    keterangan: (document.querySelector('.keterangan-login') || {}).textContent || ''
  };
});

async function langkahPin(page) {
  await page.getByRole('button', { name: /Budi/ }).first().click();
  await page.waitForTimeout(500);
}

// A. Laptop dan desktop: panel utuh di dalam layar pada langkah nama dan langkah PIN
//    [lebar, tinggi, tombol angka (px), lingkaran inisial tampil, pulihkan dan versi satu baris]
for (const [w, h, angka, inisial, satuBaris] of [
  [1024, 768, 56, true, true], [1280, 700, 56, false, true], [1280, 720, 56, false, true], [1280, 760, 56, true, true],
  [1366, 768, 56, true, true], [1280, 800, 64, true, true], [1536, 864, 64, true, true], [1440, 900, 64, true, true],
  [1920, 919, 64, true, true], [1920, 920, 64, true, false], [1920, 1080, 64, true, false]
]) {
  const { ctx, page } = await buka(w, h);
  const n = await ukur(page);
  cek(n.gulirTegak <= 0 && n.gulirSamping <= 0 && n.panelDalam && n.pulihkanDalam && n.versiDalam, `${w}x${h} nama: utuh tanpa gulir`, n);
  await langkahPin(page);
  const p = await ukur(page);
  cek(p.gulirTegak <= 0 && p.gulirSamping <= 0 && p.panelDalam && p.papanDalam && p.pilihanDalam && p.pulihkanDalam && p.versiDalam,
    `${w}x${h} PIN: utuh tanpa gulir`, p);
  cek(p.angka === angka, `${w}x${h} PIN: tombol angka ${angka} px`, p.angka);
  cek(p.inisial === inisial, `${w}x${h} PIN: lingkaran inisial ${inisial ? 'tampil' : 'tidak tampil'}`, p.inisial);
  cek(p.satuBaris === satuBaris, `${w}x${h} PIN: Pulihkan dan versi ${satuBaris ? 'satu baris' : 'bertumpuk'}`, p);
  await ctx.close();
}

// B. 1.920 x 1.080 tidak berubah: panel tetap berjarak 6vh dari atas
{
  const { ctx, page } = await buka(1920, 1080);
  await langkahPin(page);
  const p = await ukur(page);
  cek(Math.round(p.panel.atas) === Math.round(1080 * 0.06) && p.angka === 64, '1920x1080: jarak atas dan tombol seperti sebelumnya', p.panel);
  await ctx.close();
}

// C. 1.366 x 768: PIN salah tampil di tempatnya, panel tetap utuh; papan ketik laptop tetap bisa dipakai
{
  const { ctx, page } = await buka(1366, 768);
  await langkahPin(page);
  const sebelum = await ukur(page);
  await page.keyboard.type('000000', { delay: 30 });
  await page.waitForTimeout(1500);
  const p = await ukur(page);
  cek(/PIN salah\. Sisa 4 percobaan\./.test(p.pesan), 'PIN salah tampil', p.pesan);
  cek(p.gulirTegak <= 0 && p.pulihkanDalam && p.versiDalam && Math.abs(p.panel.bawah - sebelum.panel.bawah) < 1, 'PIN salah: panel tidak bergeser', { sebelum: sebelum.panel, p: p.panel });
  await page.keyboard.type('482915', { delay: 30 });
  await page.waitForTimeout(2000);
  cek(await page.locator('#aplikasi').isVisible(), 'PIN benar dari papan ketik: masuk');
  await ctx.close();
}

// D. 1.366 x 768 dan 1.280 x 720: keterangan keluar otomatis (dua baris) tetap muat
for (const [w, h] of [[1366, 768], [1280, 720]]) {
  const { ctx, page } = await buka(w, h);
  await langkahPin(page);
  await page.keyboard.type('482915', { delay: 30 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => localStorage.setItem('inventoryku:terakhirDipakai', JSON.stringify(Date.now() - 6 * 60000)));
  await page.reload();
  await page.waitForTimeout(1500);
  const p = await ukur(page);
  cek(/Keluar otomatis karena 5 menit/.test(p.keterangan) && p.papanDalam !== undefined, `${w}x${h} keluar otomatis: keterangan tampil`, p.keterangan);
  cek(p.gulirTegak <= 0 && p.papanDalam && p.pilihanDalam && p.pulihkanDalam && p.versiDalam, `${w}x${h} keluar otomatis: utuh tanpa gulir`, p);
  await ctx.close();
}

// E. Dengan gerak (tanpa "kurangi gerak"): sesudah pembuka, panel tetap utuh di 1.366 x 768
{
  const { ctx, page } = await buka(1366, 768, { gerak: true });
  await langkahPin(page);
  await page.waitForTimeout(800);
  const p = await ukur(page);
  cek(p.gulirTegak <= 0 && p.panelDalam && p.pulihkanDalam && p.versiDalam, 'gerak: utuh tanpa gulir', p);
  await ctx.close();
}

// F. HP dan tablet tidak berubah: delapan ukuran tanpa gulir ke samping, papan angka dan "Lupa PIN?" terlihat
for (const [w, h] of [[320, 568], [360, 740], [390, 844], [430, 932], [768, 1024], [1024, 768], [1366, 768], [1920, 1080]]) {
  const { ctx, page } = await buka(w, h, { sentuh: w < 1024 });
  await langkahPin(page);
  const p = await ukur(page);
  cek(p.gulirSamping <= 0 && p.papanDalam && p.pilihanDalam && p.angka >= 48, `ukuran ${w}x${h}`, p);
  if (w < 1024) cek(p.angka === 64 && p.panel.atas === 0, `ukuran ${w}x${h}: tanpa panel, tombol 64 px`, p);
  await ctx.close();
}

console.log('lulus', lulus, 'gagal', gagal, 'galat konsol', galat, 'ERR log', H.logs.filter((l) => l.startsWith('ERR')));
await browser.close();
srv.close();
