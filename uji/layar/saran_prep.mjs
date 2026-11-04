// Uji Chromium: saran prep di Prep List (aplikasi 0.45.0, Code.gs v0.44): kartu Saran prep (urutan, teks, Tambahkan dengan jumlah
// cepat dan jumlah ketik, Sudah di daftar), pilihan Tambah item, kirim lalu saran turun, Kemarin tanpa kartu, server lama, delapan
// ukuran, dan gerak. Data contoh: uji/alat/seed_prep.mjs.
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';
import { seedPrep } from '../alat/seed_prep.mjs';
import { muatChromium } from '../alat/peramban.mjs';
const chromium = await muatChromium();
let gagal = 0, lulus = 0;
const cek = (k, label, x) => { if (k) lulus++; else { gagal++; console.log('GAGAL:', label, x !== undefined ? JSON.stringify(x).slice(0, 700) : ''); } };
const s = seed();
seedPrep(s.token);

const srv = H.layani(0);
await new Promise((r) => (srv.listening ? r() : srv.once('listening', r)));
const PORT = srv.address().port;
const browser = await chromium.launch();
const galat = [];
// "2 kg" dan "± 1 hari" memakai spasi tak terputus; uji membandingkan dengan spasi biasa.
const rapi = (t) => String(t).replace(/ /g, ' ');

async function buka(w, h, opsi = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'Asia/Jakarta', locale: 'id-ID', serviceWorkers: 'block',
    reducedMotion: opsi.gerak ? 'no-preference' : 'reduce' });
  const kirim = [];
  await ctx.route('https://api.uji/**', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    if (body.action === 'kirimPrep') kirim.push(body);
    const out = H.aksi(body);
    if (opsi.serverLama && out.ok && out.data) {
      const buang = (d) => { if (d && Array.isArray(d.resep)) d.resep.forEach((r) => { delete r.saran; }); };
      buang(out.data);
      buang(out.data.form);
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => galat.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(m.text())) galat.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: new RegExp(opsi.nama || 'Rina') }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type(opsi.pin || '730264', { delay: 30 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { location.hash = '#/prep'; });
  await page.waitForTimeout(1800);
  return { ctx, page, kirim };
}
const kartu = (page) => page.locator('section.saran-prep');
const baris = (page, nama) => kartu(page).locator('.saran-prep-baris', { has: page.locator('.daftar-baris-judul', { hasText: nama }) });
const ukur = (page) => page.evaluate(() => {
  const keluar = [...document.querySelectorAll('#layar *, [role="dialog"] *')].filter((e) => {
    const b = e.getBoundingClientRect();
    return b.width && (b.right > innerWidth + 1 || b.left < -1);
  }).map((e) => e.tagName + '.' + e.className).slice(0, 5);
  return { lebar: document.documentElement.scrollWidth, keluar };
});

// A. HP (Staff): kartu, Tambahkan, pilihan Tambah item, kirim.
{
  const { ctx, page, kirim } = await buka(390, 844);
  cek(await kartu(page).count() === 1, 'kartu Saran prep tampil');
  const jarak = await page.evaluate(() => Math.round(document.querySelector('.saran-prep').getBoundingClientRect().top -
    document.querySelector('.kotak-info').getBoundingClientRect().bottom));
  cek(jarak === 16, 'jarak kartu dari kotak info 16 px (aplikasi 0.45.1)', jarak);
  const judul = (await kartu(page).locator('.saran-prep-baris .daftar-baris-judul').allInnerTexts()).map(rapi);
  cek(JSON.stringify(judul) === JSON.stringify(['Saus tomat 2½ resep', 'Bumbu kuning ½ resep', 'Saus kacang ½ resep']), 'urutan dari yang paling cepat habis', judul);
  const ket = async (nama) => rapi(await baris(page, nama).locator('.daftar-baris-ket').innerText());
  cek(await ket('Saus tomat') === 'Stock 0 kg · habis · pakai 0,54 kg per hari', 'ket Saus tomat', await ket('Saus tomat'));
  cek(await ket('Bumbu kuning') === 'Stock 0,5 kg · cukup kurang dari 1 hari · pakai 0,8 kg per hari · untuk 1 hari (masa simpan)', 'ket Bumbu kuning',
    await ket('Bumbu kuning'));
  cek(await ket('Saus kacang') === 'Stock 1 kg · cukup ± 1 hari · pakai 0,9 kg per hari', 'ket Saus kacang', await ket('Saus kacang'));
  const teks = rapi(await kartu(page).innerText());
  cek(/Belum perlu: Kaldu ayam \(cukup ± 6 hari\)\./.test(teks), 'belum perlu', teks);
  cek(/Belum ada saran untuk Sambal dasar: pemakaiannya belum tercatat selama 3 hari buka/.test(teks), 'tanpa saran', teks);
  cek(/Saran = cukup untuk 2 hari menurut rata-rata pemakaian 14 hari terakhir/.test(teks), 'penjelasan', teks);
  // Tambahkan: ½ dari tombol cepat.
  await baris(page, 'Saus kacang').getByRole('button', { name: 'Tambahkan Saus kacang ½ resep' }).click();
  await page.waitForTimeout(500);
  const kartuItem = page.locator('#layar .kartu-item', { has: page.locator('.kartu-item-nama', { hasText: 'Saus kacang' }) });
  cek(await kartuItem.count() === 1 && await kartuItem.locator('input[type="radio"][value="0.5"]').isChecked(), 'baris Saus kacang dengan ½ terpilih');
  cek(rapi(await page.locator('.toast').first().innerText().catch(() => '')) === 'Saus kacang ½ resep ditambahkan ke daftar.', 'pesan singkat');
  cek(await baris(page, 'Saus kacang').locator('.saran-prep-ada').innerText() === 'Sudah di daftar' &&
    await baris(page, 'Saus kacang').getByRole('button').count() === 0, 'Sudah di daftar menggantikan Tambahkan');
  cek(await kartu(page).count() === 1 && await page.locator('#layar .saran-prep').evaluate((e) => e.getBoundingClientRect().top < 900), 'kartu tetap di tempatnya');
  // Tambahkan: 2½ diketik di kolom Lain.
  await baris(page, 'Saus tomat').getByRole('button', { name: /^Tambahkan/ }).click();
  await page.waitForTimeout(500);
  const kt = page.locator('#layar .kartu-item', { has: page.locator('.kartu-item-nama', { hasText: 'Saus tomat' }) });
  cek(await kt.locator('.isian-jumlah-lain').inputValue() === '2,5' && await kt.locator('input[type="radio"]:checked').count() === 0,
    'baris Saus tomat dengan 2,5 diketik', await kt.locator('.isian-jumlah-lain').inputValue());
  cek(/Hasil menurut resep 1,25\s*kg/.test(rapi(await kt.innerText())), 'hasil dihitung dari 2½ resep', rapi(await kt.innerText()).slice(0, 300));
  // Tambah item: pilihan menyebut saran.
  await page.getByRole('button', { name: 'Tambah item' }).click();
  await page.waitForTimeout(500);
  const dlg = page.getByRole('dialog');
  const kb = rapi(await dlg.locator('.daftar-pilih-item button', { hasText: 'Bumbu kuning' }).locator('.daftar-baris-ket').innerText());
  const kk = rapi(await dlg.locator('.daftar-pilih-item button', { hasText: 'Kaldu ayam' }).locator('.daftar-baris-ket').innerText());
  cek(kb === 'Barang jadi · kg · resep: hasil 1 kg · saran ½ resep' && kk === 'Barang jadi · kg · resep: hasil 3 kg', 'pilihan Tambah item', [kb, kk]);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  // Kirim: saran turun.
  await page.locator('label.pilihan', { hasText: 'Pagi' }).click();
  await page.getByRole('button', { name: 'Kirim prep list' }).click();
  await page.waitForTimeout(2500);
  cek(kirim.length === 1 && kirim[0].baris.map((b) => b.item + ':' + b.jumlahResep).join(',') === 'Saus kacang:0.5,Saus tomat:2,5' ||
    kirim.length === 1 && kirim[0].baris.map((b) => b.item + ':' + String(b.jumlahResep).replace(',', '.')).join(',') === 'Saus kacang:0.5,Saus tomat:2.5',
    'kiriman membawa jumlah saran', kirim.map((k) => k.baris));
  const judul2 = (await kartu(page).locator('.saran-prep-baris .daftar-baris-judul').allInnerTexts()).map(rapi);
  cek(JSON.stringify(judul2) === JSON.stringify(['Bumbu kuning ½ resep']), 'sesudah kirim: hanya Bumbu kuning', judul2);
  cek(/Belum perlu: .*Kaldu ayam .*Saus kacang .*Saus tomat/.test(rapi(await kartu(page).innerText())), 'sesudah kirim: belum perlu bertambah',
    rapi(await kartu(page).innerText()));
  await ctx.close();
}

// B. Kemarin (Pengelola): tanpa kartu dan tanpa saran di Tambah item.
{
  const { ctx, page } = await buka(390, 844, { nama: 'Budi', pin: '482915' });
  cek(await kartu(page).count() === 1, 'Pengelola hari ini: kartu ada');
  await page.locator('label.pilihan', { hasText: 'Kemarin' }).click();
  await page.waitForTimeout(1800);
  cek(await kartu(page).count() === 0, 'Kemarin: tanpa kartu');
  await page.getByRole('button', { name: 'Tambah item' }).click();
  await page.waitForTimeout(500);
  cek(!/saran/.test(await page.getByRole('dialog').innerText()), 'Kemarin: Tambah item tanpa saran');
  await page.keyboard.press('Escape');
  await page.locator('label.pilihan', { hasText: 'Hari ini' }).click();
  await page.waitForTimeout(1800);
  await ctx.close();
}

// C. Server lama: tanpa kartu.
{
  const { ctx, page } = await buka(390, 844, { serverLama: true });
  cek(await kartu(page).count() === 0 && /Prep List/.test(await page.locator('#layar').innerText()), 'server lama: tanpa kartu');
  await ctx.close();
}

// D. Delapan ukuran.
for (const [w, h] of [[320, 568], [360, 740], [390, 844], [430, 932], [768, 1024], [1024, 768], [1366, 768], [1920, 1080]]) {
  const { ctx, page } = await buka(w, h);
  const m = await ukur(page);
  const tombolT = await kartu(page).getByRole('button', { name: /^Tambahkan/ }).first().evaluate((e) => e.getBoundingClientRect().height).catch(() => 0);
  const ada = await kartu(page).locator('.saran-prep-baris').count();
  cek(ada >= 1 && tombolT >= 44 && m.lebar <= w && !m.keluar.length, `ukuran ${w}x${h}`, { ada, tombolT, m });
  await ctx.close();
}

// E. Gerak menyala.
{
  const { ctx, page } = await buka(1366, 768, { gerak: true });
  await page.waitForTimeout(600);
  cek(await kartu(page).locator('.saran-prep-baris').count() >= 1, 'gerak: kartu tampil');
  await ctx.close();
}

if (process.env.GAMBAR) {
  for (const [w, h] of [[320, 568], [390, 844], [1366, 768]]) {
    const { ctx, page } = await buka(w, h);
    await kartu(page).screenshot({ path: process.env.GAMBAR + '/saran-prep-' + w + '.png' });
    await ctx.close();
  }
}

console.log('lulus', lulus, 'gagal', gagal, 'galat konsol', galat, 'ERR log', H.logs.filter((l) => l.startsWith('ERR')));
await browser.close();
srv.close();
