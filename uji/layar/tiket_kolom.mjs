// Uji Chromium: susunan tiket Beranda tanpa satu tiket sendirian di baris terakhir (aplikasi 0.48.0, butir 459, telaah desain
// butir 5). Tablet 3 → 4 → 2 kolom, laptop 4 → 5 → 3 kolom, HP tetap 2. Diuji dengan 4, 5, 7, dan 9 form pada delapan ukuran
// dan 600 px, tanpa gulir samping dan tanpa isi tiket yang terpotong, lalu gerak menyala.
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';
import { muatChromium } from '../alat/peramban.mjs';
const chromium = await muatChromium();
let gagal = 0, lulus = 0;
const cek = (k, label, x) => { if (k) lulus++; else { gagal++; console.log('GAGAL:', label, x !== undefined ? JSON.stringify(x).slice(0, 900) : ''); } };
const s = seed();
const A = (action, b) => H.aksi(Object.assign({ action, token: s.token }, b));

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
  await page.waitForTimeout(1800);
  return { ctx, page };
}

const ukur = (page) => page.evaluate(() => {
  const tiket = [...document.querySelectorAll('#layar .tiket-grid > .tiket:not(.kerangka)')];
  const kiri = tiket.map((t) => Math.round(t.getBoundingClientRect().left));
  const atas = tiket.map((t) => Math.round(t.getBoundingClientRect().top));
  const kolom = new Set(kiri).size;
  const barisAkhir = atas.filter((a) => a === atas[atas.length - 1]).length;
  return {
    n: tiket.length,
    kolom,
    barisAkhir,
    lebar: Math.min(...tiket.map((t) => Math.round(t.getBoundingClientRect().width))),
    // Isi tiket (ikon, nama, tanda status, baris sobek) tidak keluar dari tiketnya. scrollWidth tidak dipakai: takik setengah
    // lingkaran di tepi baris sobek memang menjorok keluar 3 px di tiap sisi.
    terpotong: tiket.filter((t) => {
      const b = t.getBoundingClientRect();
      return [...t.querySelectorAll('*')].some((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > b.right + 1 || r.left < b.left - 1); }) ||
        [...t.querySelectorAll('.tiket-nama')].some((e) => e.scrollWidth > e.clientWidth + 1);
    }).map((t) => t.getAttribute('data-form')),
    gulir: document.documentElement.scrollWidth - innerWidth
  };
});

const UKURAN = [[320, 568], [360, 740], [390, 844], [430, 932], [600, 900], [768, 1024], [1024, 768], [1366, 768], [1920, 1080]];
// Kolom yang diharapkan per jumlah form: HP 2, tablet (600–1.023 px), laptop (1.024 px ke atas).
const HARAP = { 4: { tablet: 4, laptop: 4 }, 5: { tablet: 3, laptop: 5 }, 7: { tablet: 4, laptop: 4 }, 9: { tablet: 3, laptop: 5 } };

let dibuat = 0;
for (const n of [4, 5, 7, 9]) {
  while (4 + dibuat < n) {
    dibuat++;
    const r = A('simpanForm', { baru: true, nama: 'Checklist area ' + dibuat, tampil: true, keterangan: '', jadwal: 'harian', hari: [],
      kolom: [{ id: '', bagian: 'baris', label: 'Area', jenis: 'Teks', pilihan: [], wajib: true }] });
    if (!r.ok) cek(false, 'buat form kustom ' + dibuat, r.pesan);
  }
  for (const [w, h] of UKURAN) {
    const { ctx, page } = await buka(w, h);
    const m = await ukur(page);
    const harap = w < 600 ? 2 : (w < 1024 ? HARAP[n].tablet : HARAP[n].laptop);
    cek(m.n === n && m.kolom === Math.min(harap, n), `${n} form, ${w}: ${harap} kolom`, m);
    if (w >= 600) cek(m.n <= m.kolom || m.barisAkhir !== 1, `${n} form, ${w}: tidak ada tiket sendirian di baris terakhir`, m);
    cek(m.gulir <= 0 && !m.terpotong.length && m.lebar >= 120, `${n} form, ${w}: tanpa gulir samping, isi tiket utuh, lebar ≥ 120 px`, m);
    await ctx.close();
  }
}

// Gerak menyala: tiket tetap tersusun benar (9 form).
{
  const { ctx, page } = await buka(768, 1024, { gerak: true });
  await page.waitForTimeout(800);
  const m = await ukur(page);
  cek(m.n === 9 && m.kolom === 3 && m.barisAkhir === 3, 'gerak: 9 form tiga kolom', m);
  await ctx.close();
}

console.log('lulus', lulus, 'gagal', gagal, 'galat konsol', galat, 'ERR log', H.logs.filter((l) => l.startsWith('ERR')));
await browser.close();
srv.close();
