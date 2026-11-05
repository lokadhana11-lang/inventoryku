// Uji Chromium: filter Riwayat ringkas di HP dan tombol pilihan seukuran isinya (aplikasi 0.51.0, butir 467–469, telaah desain
// butir 8). HP: pilihan Form lalu satu baris "7 hari terakhir · Catatan" dengan Filter; Tanggal dan Tampilan diubah dari lembar
// Filter (dengan galat tanggal di lembar). Mulai 600 px: Tanggal dan Tampilan di kotak, seukuran isinya. Delapan ukuran dan gerak.
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
const hari = (n) => new Date(Date.now() + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const BULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const pendek = (iso) => Number(iso.slice(8, 10)) + ' ' + BULAN_SINGKAT[Number(iso.slice(5, 7)) - 1];

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
  await page.evaluate(() => { location.hash = '#/riwayat'; });
  await page.waitForTimeout(1800);
  return { ctx, page };
}

const lembar = (page) => page.getByRole('dialog');
const ringkas = (page) => page.locator('#layar .riwayat-ringkas');
const grupDi = (akar, judul) => akar.locator('fieldset', { has: akar.page().locator('legend', { hasText: new RegExp('^' + judul + '$') }) });
async function bukaFilter(page) {
  await page.locator('#layar .riwayat-alat button', { hasText: /^Filter/ }).click();
  await page.waitForTimeout(400);
}
async function terapkan(page) {
  await lembar(page).getByRole('button', { name: 'Terapkan' }).click();
  await page.waitForTimeout(1600);
}

// A. HP: satu baris ringkasan, Tanggal dan Tampilan lewat lembar Filter.
{
  const { ctx, page } = await buka(390, 844);
  const kotak = page.locator('#layar .riwayat-atas');
  cek(await grupDi(kotak, 'Form').isVisible() && !(await grupDi(kotak, 'Tanggal').isVisible()) && !(await grupDi(kotak, 'Tampilan').isVisible()),
    'HP: Form tampil, Tanggal dan Tampilan tidak');
  cek(rapi(await ringkas(page).innerText()) === '7 hari terakhir · Catatan' && await page.locator('#layar .riwayat-ringkas strong').innerText() === '7 hari terakhir',
    'HP: ringkasan awal', await ringkas(page).innerText());
  const m = await page.evaluate(() => {
    const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { atas: b.top, bawah: b.bottom, tinggi: b.height, kanan: b.right }; };
    return { ringkas: r('#layar .riwayat-ringkas'), filter: r('#layar .riwayat-alat .tombol'), kotak: r('#layar .riwayat-atas') };
  });
  const tengah = (x) => (x.atas + x.bawah) / 2;
  cek(Math.abs(tengah(m.ringkas) - tengah(m.filter)) <= 2 && m.filter.tinggi >= 44 && m.filter.kanan <= m.kotak.kanan, 'HP: ringkasan dan Filter satu baris', m);
  cek(m.kotak.tinggi <= 210, 'HP: kotak Riwayat ≤ 210 px (dulu sekitar 400)', m.kotak);

  // Lembar Filter: Tanggal dan Tampilan di atas, lalu filter lain.
  await bukaFilter(page);
  const l = lembar(page);
  const legenda = (await l.locator('legend').allInnerTexts()).map(rapi);
  cek(legenda[0] === 'Tanggal' && legenda[1] === 'Tampilan' && legenda.includes('Status'), 'HP: lembar Filter berisi Tanggal dan Tampilan', legenda);
  await grupDi(l, 'Tanggal').getByText('Satu tanggal', { exact: true }).click();
  await l.getByLabel('Dari tanggal').fill(hari(-1));
  await grupDi(l, 'Tampilan').getByText('Rekap harian', { exact: true }).click();
  await terapkan(page);
  cek(await lembar(page).count() === 0 && rapi(await ringkas(page).innerText()) === pendek(hari(-1)) + ' · Rekap harian', 'HP: Satu tanggal dan Rekap harian diterapkan',
    await ringkas(page).innerText());
  // Kotak di atas ikut (tampil lagi jika layar diputar ke tablet).
  const sama = await page.evaluate(() => {
    const t = [...document.querySelectorAll('#layar .riwayat-tanggal input[type="radio"]')].find((i) => i.checked);
    return { tanggal: t && t.value, dari: document.querySelector('#layar .riwayat-tanggal input[type="date"]').value };
  });
  cek(sama.tanggal === 'Satu tanggal' && sama.dari === hari(-1), 'HP: kotak Tanggal ikut berubah', sama);
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(400);
  cek(await grupDi(kotak, 'Tanggal').isVisible() && await grupDi(kotak, 'Tampilan').locator('input[value="Rekap harian"]').isChecked(), 'diputar ke tablet: kotak menunjukkan pilihan yang sama');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);

  // Rentang terbalik: galat di lembar, lembar tetap terbuka.
  await bukaFilter(page);
  await grupDi(lembar(page), 'Tanggal').getByText('Rentang', { exact: true }).click();
  await lembar(page).getByLabel('Dari tanggal').fill(hari(-2));
  await lembar(page).getByLabel('Sampai tanggal').fill(hari(-4));
  await lembar(page).getByRole('button', { name: 'Terapkan' }).click();
  await page.waitForTimeout(400);
  cek(await lembar(page).count() === 1 && /Tanggal awal harus sebelum tanggal akhir\./.test(await lembar(page).innerText()), 'HP: galat rentang di lembar');
  await lembar(page).getByLabel('Sampai tanggal').fill(hari(-1));
  await grupDi(lembar(page), 'Tampilan').getByText('Catatan', { exact: true }).click();
  await terapkan(page);
  cek(rapi(await ringkas(page).innerText()) === pendek(hari(-2)) + '–' + pendek(hari(-1)) + ' · Catatan', 'HP: rentang diterapkan', await ringkas(page).innerText());

  // Form selain Stock: tanpa Tampilan.
  await grupDi(kotak, 'Form').getByText('Waste', { exact: true }).click();
  await page.waitForTimeout(1600);
  cek(rapi(await ringkas(page).innerText()) === pendek(hari(-2)) + '–' + pendek(hari(-1)), 'HP: Waste tanpa Tampilan', await ringkas(page).innerText());
  await bukaFilter(page);
  const leg2 = (await lembar(page).locator('legend').allInnerTexts()).map(rapi);
  cek(leg2[0] === 'Tanggal' && !leg2.includes('Tampilan'), 'HP: lembar Waste tanpa Tampilan', leg2);
  await grupDi(lembar(page), 'Tanggal').getByText('7 hari terakhir', { exact: true }).click();
  await terapkan(page);
  cek(rapi(await ringkas(page).innerText()) === '7 hari terakhir', 'HP: kembali ke 7 hari terakhir', await ringkas(page).innerText());
  await ctx.close();
}

// B. Laptop: Tanggal dan Tampilan di kotak, seukuran isinya; lembar Filter tanpa Tanggal.
{
  const { ctx, page } = await buka(1366, 768);
  const kotak = page.locator('#layar .riwayat-atas');
  cek(!(await ringkas(page).isVisible()) && await grupDi(kotak, 'Tanggal').isVisible() && await grupDi(kotak, 'Tampilan').isVisible(), 'laptop: Tanggal dan Tampilan di kotak');
  const lebar = await page.evaluate(() => [...document.querySelectorAll('#layar .riwayat-atas .pilih-tampilan .pilihan span, #layar .riwayat-atas .riwayat-tanggal .pilihan span')]
    .map((e) => Math.round(e.getBoundingClientRect().width)));
  cek(lebar.length === 5 && lebar.every((x) => x < 220), 'laptop: tombol Tanggal dan Tampilan seukuran isinya', lebar);
  const baris = await page.evaluate(() => {
    const t = document.querySelector('#layar .riwayat-atas .pilih-tampilan .pilihan span').getBoundingClientRect();
    const f = document.querySelector('#layar .riwayat-alat .tombol').getBoundingClientRect();
    return { tampilan: Math.round(t.top), filter: Math.round(f.top), tinggiT: Math.round(t.height), tinggiF: Math.round(f.height) };
  });
  cek(baris.tampilan === baris.filter && baris.tinggiT === baris.tinggiF, 'laptop: Tampilan dan Filter sebaris, sama tinggi', baris);
  await bukaFilter(page);
  const leg = (await lembar(page).locator('legend').allInnerTexts()).map(rapi);
  cek(!leg.includes('Tanggal') && !leg.includes('Tampilan'), 'laptop: lembar Filter tanpa Tanggal dan Tampilan', leg);
  await ctx.close();
}

// C. Delapan ukuran.
for (const [w, h] of [[320, 568], [360, 740], [390, 844], [430, 932], [768, 1024], [1024, 768], [1366, 768], [1920, 1080]]) {
  const { ctx, page } = await buka(w, h);
  const m = await page.evaluate(() => {
    const tampil = (s) => { const e = document.querySelector(s); return !!e && e.getClientRects().length > 0; };
    const f = document.querySelector('#layar .riwayat-alat .tombol').getBoundingClientRect();
    const k = document.querySelector('#layar .riwayat-atas').getBoundingClientRect();
    return { gulir: document.documentElement.scrollWidth - innerWidth, ringkas: tampil('#layar .riwayat-ringkas'), tanggal: tampil('#layar .riwayat-tanggal'),
      filterTinggi: Math.round(f.height), filterDalam: f.right <= k.right + 1 && f.left >= k.left - 1 };
  });
  const hp = w < 600;
  cek(m.gulir <= 0 && m.ringkas === hp && m.tanggal === !hp && m.filterTinggi >= 44 && m.filterDalam, `${w}: ${hp ? 'ringkasan' : 'Tanggal di kotak'}, tanpa gulir samping`, m);
  await ctx.close();
}

// D. Gerak menyala.
{
  const { ctx, page } = await buka(390, 844, { gerak: true });
  await bukaFilter(page);
  await grupDi(lembar(page), 'Tanggal').getByText('Satu tanggal', { exact: true }).click();
  await terapkan(page);
  await page.waitForTimeout(400);
  cek(rapi(await ringkas(page).innerText()) === pendek(hari(0)) + ' · Catatan', 'gerak: Satu tanggal hari ini', await ringkas(page).innerText());
  await ctx.close();
}

console.log('lulus', lulus, 'gagal', gagal, 'galat konsol', galat, 'ERR log', H.logs.filter((l) => l.startsWith('ERR')));
await browser.close();
srv.close();
