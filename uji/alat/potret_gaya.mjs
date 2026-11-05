// Potret gaya terhitung untuk perapian CSS (butir 473): posisi, ukuran, dan sekitar 80 properti CSS setiap elemen (dan
// ::before/::after) di 31 layar × 7 ukuran ditambah beberapa keadaan (kotak info terbuka, lembar Filter, kursor di atas menu,
// layar Staff), dengan "kurangi gerak" dan jam uji tetap. Perapian yang tidak mengubah tampilan harus memberi potret yang sama:
//   node uji/alat/potret_gaya.mjs /tmp/sebelum.json     (sebelum CSS diubah)
//   node uji/alat/potret_gaya.mjs /tmp/sesudah.json     (sesudah)
//   node uji/alat/banding_gaya.mjs /tmp/sebelum.json /tmp/sesudah.json   → "0 perbedaan"
// UKURAN=390x844,1366x768 untuk ukuran tertentu saja. Sekitar 8 menit. Gerak (tanpa "kurangi gerak") tidak dipotret.
import * as H from './harness.mjs';
import { seed } from './seed.mjs';
import { seedPrep } from './seed_prep.mjs';
import { muatChromium } from './peramban.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';
const OUT = process.argv[2];
const chromium = await muatChromium();
const s = seed(); seedPrep(s.token);
const srv = H.layani(0); await new Promise((r) => (srv.listening ? r() : srv.once('listening', r)));
const browser = await chromium.launch();
const RUTE = ['#/', '#/stock', '#/waste', '#/suhu', '#/prep', '#/riwayat', '#/laporan', '#/dashboard', '#/opname', '#/hpp', '#/hpp/menu',
  '#/pengaturan', '#/pengaturan/staff', '#/pengaturan/penerima', '#/pengaturan/form', '#/pengaturan/form-baru', '#/pengaturan/outlet',
  '#/pengaturan/item', '#/pengaturan/item-baru', '#/pengaturan/item-harga', '#/pengaturan/item-tempel', '#/pengaturan/unit',
  '#/pengaturan/pemasok', '#/pengaturan/libur', '#/pengaturan/kategori', '#/pengaturan/resep', '#/pengaturan/resep-baru',
  '#/pengaturan/menu', '#/pengaturan/menu-baru', '#/pengaturan/item/Ayam%20fillet', '#/pengaturan/staff/Rina'];
const UKURAN = (process.env.UKURAN || '390x844,320x568,768x1024,1024x768,1366x768,1920x1080,740x400').split(',').map((u) => u.split('x').map(Number));
const PROP = ['display', 'position', 'top', 'right', 'bottom', 'left', 'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis', 'order', 'grid-template-columns', 'grid-template-rows',
  'grid-template-areas', 'grid-row-start', 'grid-row-end', 'grid-column-start', 'grid-column-end', 'row-gap', 'column-gap',
  'align-items', 'align-self', 'align-content', 'justify-content', 'justify-items', 'justify-self', 'font-family', 'font-size',
  'font-weight', 'line-height', 'letter-spacing', 'color', 'background-color', 'background-image', 'border-top-width', 'border-top-color',
  'border-bottom-width', 'border-bottom-color', 'border-left-width', 'border-right-width', 'border-top-left-radius', 'box-shadow', 'opacity',
  'transform', 'visibility', 'overflow-x', 'overflow-y', 'white-space', 'z-index', 'text-align', 'text-decoration-line', 'cursor',
  'transition-property', 'transition-duration', 'animation-name', 'view-transition-name', 'isolation', 'content', 'list-style-type',
  'overflow-wrap', 'scroll-padding-top', 'scroll-padding-bottom'];
const gaya = {};
const potret = {};
async function ambil(nama, page) {
  const data = await page.evaluate((PROP) => {
    const hasil = [];
    const jalur = (e) => { const p = []; while (e && e !== document.body) { const i = Array.prototype.indexOf.call(e.parentNode.children, e); p.unshift(e.tagName.toLowerCase() + i); e = e.parentNode; } return p.join('/'); };
    const css = (cs) => PROP.map((p) => cs.getPropertyValue(p)).join('|');
    [document.documentElement, document.body, ...document.body.querySelectorAll('*')].forEach((e) => {
      if (e.closest('svg') && e.tagName.toLowerCase() !== 'svg') return;
      const b = e.getBoundingClientRect();
      const r = [b.x, b.y, b.width, b.height].map((v) => Math.round(v * 2) / 2).join(',');
      const cs = getComputedStyle(e);
      const sb = getComputedStyle(e, '::before'), sa = getComputedStyle(e, '::after');
      hasil.push([e === document.documentElement ? 'html' : e === document.body ? 'body' : jalur(e), r, css(cs),
        sb.content !== 'none' ? css(sb) : '', sa.content !== 'none' ? css(sa) : '', (e.children.length ? '' : (e.textContent || '').trim().slice(0, 30))]);
    });
    return { lebar: document.documentElement.scrollWidth, tinggi: document.documentElement.scrollHeight, hasil };
  }, PROP);
  const daftar = data.hasil.map(([k, r, a, b, c, t]) => {
    const h = (x) => { if (!x) return ''; const id = crypto.createHash('sha1').update(x).digest('hex').slice(0, 12); gaya[id] = x; return id; };
    return [k, r, h(a), h(b), h(c), t];
  });
  potret[nama] = { lebar: data.lebar, tinggi: data.tinggi, el: daftar };
}
async function sesi(w, h, nama, pin) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'Asia/Jakarta', locale: 'id-ID', serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.route('https://api.uji/**', async (route) => { const out = H.aksi(JSON.parse(route.request().postData() || '{}')); await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) }); });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${srv.address().port}/`); await page.waitForTimeout(900);
  await ambil(w + 'x' + h + ' login ' + nama, page);
  await page.getByRole('button', { name: new RegExp(nama) }).first().click(); await page.waitForTimeout(300);
  await page.keyboard.type(pin, { delay: 20 }); await page.waitForTimeout(1500);
  await page.mouse.move(0, h - 1);
  return { ctx, page };
}
const ke = async (page, r) => { await page.evaluate((x) => { location.hash = x; }, r); await page.waitForTimeout(1300); await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(150); };
for (const [w, h] of UKURAN) {
  const { ctx, page } = await sesi(w, h, 'Budi', '482915');
  for (const r of RUTE) { await ke(page, r); await ambil(w + 'x' + h + ' ' + r, page); }
  // Keadaan khusus
  await ke(page, '#/stock');
  const ubah = page.locator('#layar .kotak-ringkas-tombol');
  if (await ubah.isVisible()) { await ubah.click(); await page.waitForTimeout(250); await ambil(w + 'x' + h + ' stock terbuka', page); }
  await ke(page, '#/riwayat');
  await page.locator('#layar .riwayat-alat button', { hasText: /^Filter/ }).click(); await page.waitForTimeout(500);
  await ambil(w + 'x' + h + ' riwayat lembar filter', page);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  if (w >= 1024) {
    await ke(page, '#/dashboard');
    await page.locator('#menu-grup a[data-menu="laporan"]').hover(); await page.waitForTimeout(400);
    await ambil(w + 'x' + h + ' hover menu', page);
    await page.locator('#layar a.kartu-tautan').first().hover(); await page.waitForTimeout(300);
    await ambil(w + 'x' + h + ' hover kartu tautan', page);
    await page.mouse.move(0, h - 1);
    await ke(page, '#/pengaturan/item'); await page.evaluate(() => window.scrollTo(0, 400)); await page.waitForTimeout(300);
    await ambil(w + 'x' + h + ' item digulir', page);
  }
  await ctx.close();
  const st = await sesi(w, h, 'Rina', '730264');
  for (const r of ['#/', '#/stock', '#/riwayat', '#/laporan']) { await ke(st.page, r); await ambil(w + 'x' + h + ' staff ' + r, st.page); }
  await st.ctx.close();
}
await browser.close(); srv.close();
fs.writeFileSync(OUT, JSON.stringify({ gaya, potret }));
console.log('selesai', Object.keys(potret).length, 'potret,', Object.keys(gaya).length, 'gaya unik');
