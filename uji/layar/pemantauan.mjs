// Uji Chromium: pemantauan pemasangan (aplikasi 0.43.0, Code.gs v0.42): peringatan di Beranda dan Dashboard Pengelola yang
// membuka Pengaturan → Outlet dan jadwal, kartu Versi dan salinan, server lama, Staff, simpan, delapan ukuran, dan gerak.
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';
import { muatChromium } from '../alat/peramban.mjs';
const chromium = await muatChromium();
let gagal = 0, lulus = 0;
const cek = (k, label, x) => { if (k) lulus++; else { gagal++; console.log('GAGAL:', label, x !== undefined ? JSON.stringify(x).slice(0, 700) : ''); } };
// Peringatan pemasangan di Beranda: baris di daftar Perlu ditindaklanjuti yang membuka Outlet dan jadwal (aplikasi 0.47.0, butir 456).
const barisPasang = (page) => page.locator('#layar .beranda-tindak a.daftar-baris[href="#/pengaturan/outlet"]');
const teksPasang = async (page) => (await barisPasang(page).allInnerTexts()).join('\n');
seed();
const VERSI = H.ambil('VERSI_KODE');
// Versi tidak ditulis tetap: uji ini tetap benar sesudah Code.gs dan aplikasi naik versi.
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const VERSI_APP = (await import('node:fs')).readFileSync(new URL('../../app.js', import.meta.url), 'utf8').match(/VERSI_APLIKASI = '([^']+)'/)[1];
const lalu = (menit) => new Date(Date.now() + H.geserWaktu - menit * 60000).toISOString();
const status = (as, surel, brevo) => { H.supabaseUji.statusSistem = { appsScript: as, surel: surel || { menunggu: 0, sejak: null }, brevo: !!brevo }; };
const susunan = (teks) => {
  const sh = H.ss.getSheetByName('M_Konfigurasi');
  const v = sh.getDataRange().getValues();
  sh.getRange(v.findIndex((b) => b[0] === 'susunan_sheet') + 1, 2).setValue(teks);
};

const srv = H.layani(0);
await new Promise((r) => (srv.listening ? r() : srv.once('listening', r)));
const PORT = srv.address().port;
const browser = await chromium.launch();
const galat = [];

async function buka(w, h, rute, opsi = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'Asia/Jakarta', locale: 'id-ID', serviceWorkers: 'block',
    reducedMotion: opsi.gerak ? 'no-preference' : 'reduce' });
  const permintaan = [];
  await ctx.route('https://api.uji/**', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    permintaan.push(body);
    const out = H.aksi(body);
    if (opsi.serverLama && out.ok && out.data) {
      delete out.data.statusSistem;
      delete out.data.peringatanPemasangan;
      if (out.data.beranda) delete out.data.beranda.peringatanPemasangan;
    }
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
  if (rute) {
    await page.evaluate((r) => { location.hash = r; }, rute);
    await page.waitForTimeout(1500);
  }
  return { ctx, page, permintaan };
}
const layar = (page) => page.locator('#layar');
const kartu = (page) => page.locator('section.status-sistem');
const ukur = (page) => page.evaluate(() => {
  const keluar = [...document.querySelectorAll('#layar *')].filter((e) => {
    const b = e.getBoundingClientRect();
    return b.width && (b.right > innerWidth + 1 || b.left < -1);
  }).map((e) => e.tagName + '.' + e.className).slice(0, 5);
  return { lebar: document.documentElement.scrollWidth, keluar };
});

// A. Salinan berhenti dan versi berbeda: Beranda Pengelola, ketuk ke Outlet dan jadwal.
status({ versi: 'v0.41', salinan: lalu(45) }, { menunggu: 1, sejak: lalu(40) });
{
  const { ctx, page } = await buka(390, 844, null);
  cek(await barisPasang(page).count() === 2, 'Beranda: dua baris server dan salinan di Perlu ditindaklanjuti');
  const t = await teksPasang(page);
  cek(/Salinan ke Google Sheets berhenti/.test(t) && /\(45 menit lalu\)\. Selama berhenti, email laporan tidak terkirim/.test(t) &&
    /1 email menunggu dikirim/.test(t) && /Versi Code\.gs berbeda/.test(t) && new RegExp('Apps Script masih v0\\.41, sedangkan Supabase ' + esc(VERSI)).test(t),
    'Beranda: dua peringatan dengan teks', t);
  const tautan = barisPasang(page);
  cek(await tautan.count() === 2 && (await tautan.first().getAttribute('href')) === '#/pengaturan/outlet', 'Beranda: baris membuka Outlet dan jadwal');
  cek(!/Rinciannya di tab M_Konfigurasi/.test(t), 'Beranda: tanpa akhiran M_Konfigurasi', t);
  await tautan.first().click();
  await page.waitForTimeout(1500);
  cek(/#\/pengaturan\/outlet$/.test(page.url()), 'ketuk: pindah ke Outlet dan jadwal', page.url());
  const k = await kartu(page).innerText().catch(() => '');
  cek(/Versi dan salinan/.test(k) && /Salinan ke Google Sheets berhenti\./.test(k) && /Versi Code\.gs berbeda\./.test(k), 'kartu: dua peringatan', k);
  cek(new RegExp('Aplikasi di perangkat ini\\s*' + esc(VERSI_APP)).test(k) && new RegExp('Server\\s*Code\\.gs ' + esc(VERSI) + ' di Supabase').test(k) && /Apps Script\s*Code\.gs v0\.41/.test(k) &&
    /Salinan ke Google Sheets\s*\d+ [A-Z][a-z]{2} \d\d\.\d\d \(45 menit lalu\)/.test(k) && /Email menunggu dikirim\s*1 email, sejak \d+ [A-Z][a-z]{2}/.test(k) &&
    /Susunan tab dan kolom\s*Lengkap/.test(k), 'kartu: daftar nilai', k);
  cek(await kartu(page).locator('.pesan-formulir.masalah').count() === 1 && await kartu(page).locator('.pesan-formulir.tinjau').count() === 1,
    'kartu: tingkat masalah dan tinjau');
  // Kartu ada di atas kartu Outlet.
  const urut = await layar(page).locator('section.kartu .kartu-judul').allInnerTexts();
  cek(urut[0] === 'Versi dan salinan' && urut[1] === 'Outlet', 'kartu di atas Outlet', urut);
  // Simpan tetap berjalan dan kartu digambar lagi.
  const nama = layar(page).getByLabel('Nama outlet');
  await nama.fill('Dapur Contoh Pusat');
  await layar(page).getByRole('button', { name: 'Simpan' }).click();
  await page.waitForTimeout(1500);
  cek(/Versi dan salinan/.test(await kartu(page).innerText().catch(() => '')) && /Outlet dan jadwal tersimpan/.test(await page.locator('.toast').first().innerText().catch(() => '')),
    'simpan: tersimpan, kartu tetap ada');
  await nama.fill('Dapur Contoh');
  await layar(page).getByRole('button', { name: 'Simpan' }).click();
  await page.waitForTimeout(1200);
  await ctx.close();
}

// B. Dashboard: butir pemasangan membuka Outlet dan jadwal.
{
  const { ctx, page } = await buka(1366, 768, '#/dashboard');
  await page.waitForTimeout(800);
  const butir = layar(page).getByRole('link', { name: /Salinan ke Google Sheets berhenti/ });
  cek(await butir.count() === 1 && (await butir.getAttribute('href')) === '#/pengaturan/outlet', 'Dashboard: butir salinan berhenti');
  const versi = layar(page).getByRole('link', { name: /Versi Code\.gs berbeda/ });
  cek(await versi.count() === 1, 'Dashboard: butir versi');
  cek(await butir.locator('.ubin-ikon-masalah').count() === 1 && await versi.locator('.ubin-ikon-tinjau').count() === 1, 'Dashboard: ubin masalah dan tinjau');
  await ctx.close();
}

// C. Staff: tanpa grup; Outlet dan jadwal tidak terbuka.
{
  const { ctx, page } = await buka(390, 844, null, { nama: 'Rina', pin: '730264' });
  cek(await barisPasang(page).count() === 0, 'Staff: tanpa peringatan pemasangan');
  await ctx.close();
}

// D. Semua berjalan: tanpa grup, kartu "berjalan".
status({ versi: VERSI, salinan: lalu(2) });
{
  const { ctx, page } = await buka(390, 844, null);
  cek(await barisPasang(page).count() === 0, 'berjalan: Beranda tanpa grup');
  await page.evaluate(() => { location.hash = '#/pengaturan/outlet'; });
  await page.waitForTimeout(1500);
  const k = await kartu(page).innerText().catch(() => '');
  cek(/Salinan ke Google Sheets berjalan dan versinya sama\./.test(k) && new RegExp('Apps Script\\s*Code\\.gs ' + esc(VERSI)).test(k) && /\(2 menit lalu\)/.test(k) &&
    /Email menunggu dikirim\s*Tidak ada/.test(k), 'berjalan: kartu baik', k);
  await ctx.close();
}

// E. Belum ada kontak, Brevo, susunan belum lengkap.
status(null, null, true);
susunan('Kurang: M_Resep: kolom Catatan');
{
  const { ctx, page } = await buka(390, 844, '#/pengaturan/outlet');
  const k = await kartu(page).innerText().catch(() => '');
  cek(/Apps Script\s*Belum tercatat/.test(k) && /Salinan ke Google Sheets\s*Belum tercatat/.test(k) && !/Email menunggu/.test(k) &&
    /Susunan tab dan kolom\s*Belum lengkap/.test(k) && /Susunan Sheet belum lengkap\. Belum ada: M_Resep: kolom Catatan\. Pemilik Sheet perlu menjalankan setupSpreadsheet/.test(k),
    'kartu: belum tercatat, Brevo, susunan', k);
  await page.evaluate(() => { location.hash = '#/'; });
  await page.waitForTimeout(1500);
  const t = await teksPasang(page);
  cek(/Susunan Sheet belum lengkap/.test(t), 'Beranda: susunan', t);
  await ctx.close();
}
status(null);
susunan('');
{
  const { ctx, page } = await buka(390, 844, '#/pengaturan/outlet');
  const k = await kartu(page).innerText().catch(() => '');
  cek(/Kontak dari Apps Script tercatat paling lambat 5 menit/.test(k) && /Susunan tab dan kolom\s*Belum diperiksa/.test(k), 'kartu: belum diperiksa', k);
  await ctx.close();
}
susunan('Lengkap');

// F. Server lama (tanpa statusSistem dan peringatanPemasangan): tanpa kartu dan tanpa grup.
status({ versi: 'v0.41', salinan: lalu(45) });
{
  const { ctx, page } = await buka(390, 844, null, { serverLama: true });
  cek(await barisPasang(page).count() === 0, 'server lama: Beranda tanpa grup');
  await page.evaluate(() => { location.hash = '#/pengaturan/outlet'; });
  await page.waitForTimeout(1500);
  cek(await kartu(page).count() === 0 && /Outlet/.test(await layar(page).innerText()), 'server lama: tanpa kartu, layar tetap ada');
  await ctx.close();
}

// G. Delapan ukuran (teks terpanjang: salinan berhenti, email, versi, susunan), Beranda dan Outlet dan jadwal.
status({ salinan: lalu(60 * 50) }, { menunggu: 12, sejak: lalu(60 * 49) });
susunan('Kurang: tab Data_PenjualanMenu; M_Resep: kolom Catatan; Data_Stock: kolom Sisa Dihitung, Pemasok, Harga Beli (Rp)');
for (const [w, h] of [[320, 568], [360, 740], [390, 844], [430, 932], [768, 1024], [1024, 768], [1366, 768], [1920, 1080]]) {
  const { ctx, page } = await buka(w, h, null);
  const mb = await ukur(page);
  const ada = await barisPasang(page).count() >= 1;
  const tinggi = await barisPasang(page).first().evaluate((e) => e.getBoundingClientRect().height).catch(() => 0);
  await page.evaluate(() => { location.hash = '#/pengaturan/outlet'; });
  await page.waitForTimeout(1500);
  const mo = await ukur(page);
  const dd = await kartu(page).locator('dd').evaluateAll((d) => d.map((x) => x.getBoundingClientRect().width));
  cek(ada && tinggi >= 44 && mb.lebar <= w && !mb.keluar.length && mo.lebar <= w && !mo.keluar.length && dd.length === 6 && dd.every((x) => x > 40),
    `ukuran ${w}x${h}`, { ada, tinggi, mb, mo, dd });
  await ctx.close();
}

// H. Gerak menyala: tanpa galat, kartu tetap sama.
{
  const { ctx, page } = await buka(1366, 768, '#/pengaturan/outlet', { gerak: true });
  await page.waitForTimeout(600);
  const k = await kartu(page).innerText().catch(() => '');
  cek(/Salinan ke Google Sheets berhenti\./.test(k) && /\(2 hari lalu\)/.test(k) && /Apps Script\s*Code\.gs sebelum v0\.42/.test(k) && /12 email, sejak/.test(k),
    'gerak: kartu di desktop dua panel', k);
  const posisi = await page.evaluate(() => {
    const panel = document.querySelector('#layar .panel-samping');
    const k = document.querySelector('section.status-sistem');
    return panel && k && getComputedStyle(panel).display !== 'none'
      ? { panelKanan: panel.getBoundingClientRect().right, kartuKiri: k.getBoundingClientRect().left } : null;
  });
  cek(posisi && posisi.panelKanan <= posisi.kartuKiri, 'desktop: kartu di kolom isi, kanan panel samping', posisi);
  await ctx.close();
}

delete H.supabaseUji.statusSistem;
if (process.env.GAMBAR) {
  for (const [w, h] of [[320, 568], [1366, 768]]) {
    const { ctx, page } = await buka(w, h, '#/pengaturan/outlet');
    await page.screenshot({ path: process.env.GAMBAR + '/outlet-' + w + '.png', fullPage: false });
    await page.evaluate(() => { location.hash = '#/'; });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: process.env.GAMBAR + '/beranda-' + w + '.png', fullPage: true });
    await ctx.close();
  }
}
console.log('lulus', lulus, 'gagal', gagal, 'galat konsol', galat, 'ERR log', H.logs.filter((l) => l.startsWith('ERR')));
await browser.close();
srv.close();
