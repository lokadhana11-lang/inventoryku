// Uji Chromium: cukup untuk berapa hari (aplikasi 0.44.0, Code.gs v0.43): form Stock (kartu dan tabel, ikut angka yang diketik),
// lembar riwayat item, Dashboard (butir hampir habis dan lembar item), Daftar belanja dan Tambah item, server lama, delapan ukuran,
// dan gerak. Angka dari data contoh: Ayam fillet 6,5 kg dengan pemakaian 2,292 kg per hari (cukup ± 2 hari).
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';
import { muatChromium } from '../alat/peramban.mjs';
const chromium = await muatChromium();
let gagal = 0, lulus = 0;
const cek = (k, label, x) => { if (k) lulus++; else { gagal++; console.log('GAGAL:', label, x !== undefined ? JSON.stringify(x).slice(0, 700) : ''); } };
seed();

const srv = H.layani(0);
await new Promise((r) => (srv.listening ? r() : srv.once('listening', r)));
const PORT = srv.address().port;
const browser = await chromium.launch();
const galat = [];

/** Server lama (sebelum Code.gs v0.43): tanpa pakaiHarian, cukupHari, pakai, dan butir hampirHabis. */
function buangField(x) {
  if (Array.isArray(x)) return x.forEach(buangField);
  if (!x || typeof x !== 'object') return;
  delete x.pakaiHarian; delete x.cukupHari; delete x.pakai;
  if (Array.isArray(x.perhatian)) x.perhatian = x.perhatian.filter((p) => p.jenis !== 'hampirHabis');
  Object.keys(x).forEach((k) => buangField(x[k]));
}

async function buka(w, h, rute, opsi = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'Asia/Jakarta', locale: 'id-ID', serviceWorkers: 'block',
    reducedMotion: opsi.gerak ? 'no-preference' : 'reduce' });
  await ctx.route('https://api.uji/**', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    const out = H.aksi(body);
    if (opsi.serverLama && out.ok) buangField(out.data);
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
  await page.evaluate((r) => { location.hash = r; }, rute);
  await page.waitForTimeout(1800);
  return { ctx, page };
}
// "± 2 hari" memakai spasi tak terputus supaya tidak terpecah baris; uji membandingkan dengan spasi biasa.
const rapi = (t) => String(t).replace(/\u00a0/g, ' ');
const kartuItem = (page, nama) => page.locator('article.kartu-item', { has: page.locator('.kartu-item-nama', { hasText: new RegExp('^' + nama + '$') }) });
const kunci = (page, nama, jenis) => page.locator(`[data-kunci="${nama}|${jenis}"]`);
const ukur = (page) => page.evaluate(() => {
  const keluar = [...document.querySelectorAll('#layar *, [role="dialog"] *')].filter((e) => {
    const b = e.getBoundingClientRect();
    return b.width && (b.right > innerWidth + 1 || b.left < -1);
  }).map((e) => e.tagName + '.' + e.className).slice(0, 5);
  return { lebar: document.documentElement.scrollWidth, keluar };
});

// A. Form Stock di HP (Staff): kartu menunjukkan cukup, ikut angka yang diketik.
{
  const { ctx, page } = await buka(390, 844, '#/stock', { nama: 'Rina', pin: '730264' });
  const ayam = kartuItem(page, 'Ayam fillet');
  const cukup = ayam.locator('.stock-cukup');
  cek(await cukup.innerText().then(rapi) === 'Cukup ± 2 hari', 'kartu Ayam: Cukup ± 2 hari', await cukup.innerText().then(rapi));
  const posisi = await ayam.evaluate((k) => {
    const a = k.querySelector('.stock-akhir-angka').getBoundingClientRect();
    const c = k.querySelector('.stock-cukup').getBoundingClientRect();
    return { bawah: c.top >= a.bottom - 1, kanan: Math.abs(c.right - a.right) < 2 };
  });
  cek(posisi.bawah && posisi.kanan, 'cukup di bawah angka Stock akhir, rata kanan', posisi);
  await kunci(page, 'Ayam fillet', 'keluar').fill('3');
  cek(await cukup.innerText().then(rapi) === 'Cukup ± 1 hari', 'keluar 3: ± 1 hari', await cukup.innerText().then(rapi));
  await kunci(page, 'Ayam fillet', 'keluar').fill('6');
  cek(await cukup.innerText().then(rapi) === 'Cukup kurang dari 1 hari', 'keluar 6: kurang dari 1 hari', await cukup.innerText().then(rapi));
  await kunci(page, 'Ayam fillet', 'keluar').fill('7');
  cek(await cukup.innerText().then(rapi) === '' && !(await cukup.isVisible()) && /Stock akhir minus/.test(await ayam.innerText().then(rapi)), 'minus: tanpa cukup, peringatan minus');
  await kunci(page, 'Ayam fillet', 'masuk').fill('20');
  cek(await cukup.innerText().then(rapi) === 'Cukup ± 8 hari', 'masuk 20, keluar 7: 19,5 kg ± 8 hari', await cukup.innerText().then(rapi));
  await kunci(page, 'Ayam fillet', 'masuk').fill('');
  await kunci(page, 'Ayam fillet', 'keluar').fill('');
  cek(await kartuItem(page, 'Air mineral').locator('.stock-cukup').innerText().then(rapi) === '', 'Air mineral tidak terpakai: tanpa cukup');
  cek(await kartuItem(page, 'Nasi putih').locator('.stock-cukup').innerText().then(rapi) === '', 'Nasi putih tanpa rekap: tanpa cukup');
  cek(await kartuItem(page, 'Minyak goreng').locator('.stock-cukup').innerText().then(rapi) === 'Cukup ± 148 hari', 'Minyak goreng ± 148 hari');
  await ctx.close();
}

// B. Form Stock di laptop: tabel, "cukup ± 2 hari" di bawah angka, peringatan minus di baris sendiri.
{
  const { ctx, page } = await buka(1366, 768, '#/stock');
  const sel = (nama) => page.locator('table.tabel-stock tr', { has: page.locator('.daftar-baris-judul', { hasText: new RegExp('^' + nama + '$') }) }).locator('td').nth(6);
  cek(await sel('Ayam fillet').locator('.stock-cukup').innerText().then(rapi) === 'cukup ± 2 hari', 'tabel Ayam: cukup ± 2 hari', await sel('Ayam fillet').innerText().then(rapi));
  const tata = await sel('Telur').evaluate((td) => {
    const a = td.querySelector('.stock-akhir-angka').getBoundingClientRect();
    const p = td.querySelector('.wadah-peringatan').getBoundingClientRect();
    return { turun: p.top >= a.bottom - 1, cukup: td.querySelector('.stock-cukup').textContent };
  });
  cek(tata.turun && tata.cukup === '', 'tabel Telur minus: peringatan di bawah angka, tanpa cukup', tata);
  const tAyam = await sel('Ayam fillet').evaluate((td) => {
    const a = td.querySelector('.stock-akhir-angka').getBoundingClientRect();
    const c = td.querySelector('.stock-cukup').getBoundingClientRect();
    return c.top >= a.bottom - 1;
  });
  cek(tAyam, 'tabel Ayam: cukup di baris bawah angka');
  const tPeringatan = await sel('Tomat').evaluate((td) => {
    const c = td.querySelector('.stock-cukup').getBoundingClientRect();
    const p = td.querySelector('.wadah-peringatan').getBoundingClientRect();
    return { urut: p.top >= c.bottom - 1, cukup: td.querySelector('.stock-cukup').textContent, tanda: td.querySelector('.wadah-peringatan').textContent };
  });
  cek(tPeringatan.urut && tPeringatan.cukup === 'cukup kurang dari 1 hari' && /Perlu reorder/.test(tPeringatan.tanda), 'tabel Tomat: angka, cukup, lalu Perlu reorder', tPeringatan);
  await ctx.close();
}

// C. Dashboard: butir hampir habis, lembar item, riwayat item.
{
  const { ctx, page } = await buka(390, 844, '#/dashboard');
  const butir = page.getByRole('button', { name: /2 item hampir habis/ });
  cek(await butir.count() === 1, 'Dashboard: butir 2 item hampir habis');
  const teks = await butir.innerText().then(rapi);
  cek(/Cukup kurang dari 3 hari menurut pemakaian 14 hari terakhir: Cabai merah ± 2 hari dan Ayam fillet ± 2 hari\./.test(teks), 'keterangan butir', teks);
  cek(await butir.locator('.ubin-ikon-tinjau').count() === 1, 'ubin Perlu ditinjau');
  await butir.click();
  await page.waitForTimeout(500);
  const dlg = page.getByRole('dialog');
  const isi = await dlg.innerText().then(rapi);
  cek(/Item ini belum di bawah stok minimum, jadi belum masuk Daftar belanja/.test(isi), 'lembar: petunjuk Daftar belanja dan stok minimum', isi);
  const ketAyam = await dlg.locator('button.daftar-baris', { hasText: 'Ayam fillet' }).locator('.daftar-baris-ket').innerText().then(rapi);
  cek(ketAyam === 'Stock tercatat 6,5 kg · minimum 5 kg · cukup ± 2 hari · pakai 2,292 kg per hari', 'lembar: baris Ayam', ketAyam);
  await dlg.locator('button.daftar-baris', { hasText: 'Ayam fillet' }).click();
  await page.waitForTimeout(1200);
  const riw = await page.getByRole('dialog').locator('.riwayat-item-cukup').innerText().then(rapi).catch(() => '');
  cek(riw === 'Cukup ± 2 hari. Pemakaian rata-rata 2,292 kg per hari (keluar, dipakai prep, dan waste; 12 hari buka terakhir).', 'riwayat item: kalimat pemakaian', riw);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const bm = page.getByRole('button', { name: /item di bawah stok minimum/ });
  await bm.click();
  await page.waitForTimeout(500);
  const ketTomat = await page.getByRole('dialog').locator('button.daftar-baris', { hasText: 'Tomat' }).locator('.daftar-baris-ket').innerText().then(rapi);
  const ketTelur = await page.getByRole('dialog').locator('button.daftar-baris', { hasText: 'Telur' }).locator('.daftar-baris-ket').innerText().then(rapi);
  cek(/· minimum 2 kg · cukup kurang dari 1 hari · saran order/.test(ketTomat) && /· minimum 60 butir · habis · saran order/.test(ketTelur),
    'lembar di bawah minimum: cukup dan habis', [ketTomat, ketTelur]);
  await ctx.close();
}

// D. Riwayat item untuk item yang tidak terpakai dan item baru (kurang dari 3 hari buka).
{
  const T = H.aksi({ action: 'login', nama: 'Budi', pin: '482915' }).data.token;
  const hari = (n) => new Date(Date.now() + H.geserWaktu + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  H.aksi({ action: 'simpanItem', token: T, baru: true, nama: 'Kecap', kategori: 'Bumbu', satuan: 'botol', harga: 12000, stokMin: '', stokMaks: '' });
  H.aksi({ action: 'sesuaikanStock', token: T, submissionId: crypto.randomUUID(), item: 'Kecap', tanggal: hari(-2), stockSebenarnya: 5, alasan: 'Stok pembuka', catatan: '' });
  const { ctx, page } = await buka(390, 844, '#/stock');
  // Lembar riwayat dari Pengaturan → Item → (item) → Riwayat stock.
  const buka1 = async (nama) => {
    await page.evaluate((r) => { location.hash = r; }, '#/pengaturan/item/' + encodeURIComponent(nama));
    await page.waitForTimeout(1500);
    await page.locator('#layar').getByRole('button', { name: 'Riwayat stock' }).click();
    await page.waitForTimeout(1200);
    const t = await page.getByRole('dialog').locator('.riwayat-item-cukup').innerText().then(rapi);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    return t;
  };
  cek(await buka1('Air mineral') === 'Tidak terpakai dalam 14 hari terakhir.', 'riwayat Air mineral: tidak terpakai');
  cek(await buka1('Kecap') === 'Rata-rata pemakaian dihitung setelah 3 hari buka (baru 2 hari).', 'riwayat Kecap: baru 2 hari');
  cek(await buka1('Tomat') === 'Cukup kurang dari 1 hari. Pemakaian rata-rata 0,308 kg per hari (keluar, dipakai prep, dan waste; 12 hari buka terakhir).',
    'riwayat Tomat');
  await ctx.close();
}

// E. Daftar belanja (Laporan): baris dan pilihan Tambah item.
{
  const { ctx, page } = await buka(390, 844, '#/laporan');
  const baris = (nama) => page.locator('.belanja-baris', { has: page.locator('.daftar-baris-judul', { hasText: new RegExp('^' + nama + '$') }) });
  const kt = await baris('Tomat').locator('.daftar-baris-ket').first().innerText().then(rapi);
  cek(kt === 'Stock 0,3 kg · minimum 2 kg · cukup kurang dari 1 hari', 'baris Tomat', kt);
  const kb = await baris('Bawang merah').locator('.daftar-baris-ket').first().innerText().then(rapi);
  cek(kb === 'Stock 0,5 kg · minimum 1 kg · cukup ± 2 hari', 'baris Bawang merah', kb);
  await page.locator('.belanja').getByRole('button', { name: /^Tambah item/ }).first().click();
  await page.waitForTimeout(500);
  const dlg = page.getByRole('dialog');
  const ka = await dlg.locator('.daftar-pilih-item button', { hasText: 'Ayam fillet' }).locator('.daftar-baris-ket').innerText().then(rapi);
  const ks = await dlg.locator('.daftar-pilih-item button', { hasText: 'Daging sapi' }).locator('.daftar-baris-ket').innerText().then(rapi);
  cek(ka === 'Protein · stock 6,5 kg · cukup ± 2 hari' && ks === 'Protein · stock 4 kg', 'Tambah item: cukup hanya jika ada pemakaian', [ka, ks]);
  await ctx.close();
}

// F. Server lama: tidak ada teks cukup di mana pun, tanpa galat.
{
  const { ctx, page } = await buka(390, 844, '#/stock', { serverLama: true });
  cek(await page.locator('.stock-cukup:not(:empty)').count() === 0, 'server lama: form Stock tanpa cukup');
  await page.evaluate(() => { location.hash = '#/dashboard'; });
  await page.waitForTimeout(1500);
  cek(await page.getByRole('button', { name: /hampir habis/ }).count() === 0, 'server lama: tanpa butir hampir habis');
  await page.evaluate(() => { location.hash = '#/laporan'; });
  await page.waitForTimeout(1500);
  cek(!/cukup/.test(await page.locator('.belanja').innerText().then(rapi)), 'server lama: Daftar belanja tanpa cukup');
  await ctx.close();
}

// G. Delapan ukuran: form Stock dan lembar hampir habis di Dashboard.
for (const [w, h] of [[320, 568], [360, 740], [390, 844], [430, 932], [768, 1024], [1024, 768], [1366, 768], [1920, 1080]]) {
  const { ctx, page } = await buka(w, h, '#/stock');
  const ada = await page.locator('.stock-cukup:not(:empty)').count();
  const ms = await ukur(page);
  await page.evaluate(() => { location.hash = '#/dashboard'; });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /item hampir habis/ }).click();
  await page.waitForTimeout(500);
  const md = await ukur(page);
  cek(ada >= 4 && ms.lebar <= w && !ms.keluar.length && md.lebar <= w && !md.keluar.length, `ukuran ${w}x${h}`, { ada, ms, md });
  await ctx.close();
}

// H. Gerak menyala: tanpa galat, teks sama.
{
  const { ctx, page } = await buka(1366, 768, '#/stock', { gerak: true });
  await page.waitForTimeout(600);
  cek(/cukup ± 2 hari/.test((await page.locator('table.tabel-stock').allInnerTexts().then((a) => a.map(rapi))).join(' ')), 'gerak: tabel menampilkan cukup');
  await ctx.close();
}

console.log('lulus', lulus, 'gagal', gagal, 'galat konsol', galat, 'ERR log', H.logs.filter((l) => l.startsWith('ERR')));
await browser.close();
srv.close();
