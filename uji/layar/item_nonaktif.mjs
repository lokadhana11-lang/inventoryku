// Uji Chromium: item yang dinonaktifkan stock-nya dinolkan (aplikasi 0.40.0, Code.gs v0.40): dialog Nonaktifkan, Nolkan stock
// untuk item nonaktif lama, stok pembuka saat aktif lagi, server lama, delapan ukuran.
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';
import { muatChromium } from '../alat/peramban.mjs';
const chromium = await muatChromium();
let gagal = 0, lulus = 0;
const cek = (k, label, x) => { if (k) lulus++; else { gagal++; console.log('GAGAL:', label, x !== undefined ? JSON.stringify(x).slice(0, 600) : ''); } };
const s = seed();
const T = s.token;
const A = (action, b) => H.aksi(Object.assign({ action, token: T }, b));
const item = (nama) => A('daftarItem', {}).data.item.find((i) => i.nama === nama);
const aturAktifLangsung = (nama, aktif) => {
  // Seperti item yang dinonaktifkan sebelum Code.gs v0.40: kolom Aktif diubah tanpa menolkan stock.
  const sh = H.ss.getSheetByName('M_Item');
  const v = sh.getDataRange().getValues();
  sh.getRange(v.findIndex((b) => b[0] === nama) + 1, v[0].indexOf('Aktif') + 1).setValue(aktif);
};

const srv = H.layani(0);
await new Promise((r) => (srv.listening ? r() : srv.once('listening', r)));
const PORT = srv.address().port;
const browser = await chromium.launch();
const galat = [];

async function buka(w, h, rute, opsi = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'Asia/Jakarta', locale: 'id-ID', serviceWorkers: 'block', reducedMotion: 'reduce' });
  const permintaan = [];
  await ctx.route('https://api.uji/**', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    permintaan.push(body);
    const out = H.aksi(body);
    if (opsi.serverLama && out.ok && out.data && Array.isArray(out.data.item)) {
      delete out.data.nolkanSaatNonaktif;
      delete out.data.dinolkan;
    }
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
  await page.waitForTimeout(1500);
  await page.evaluate((r) => { location.hash = r; }, rute);
  await page.waitForTimeout(1800);
  return { ctx, page, permintaan };
}
const layar = (page) => page.locator('#layar');
const teksToast = (page) => page.locator('.toast').first().innerText().catch(() => '');
const rute = (nama) => '#/pengaturan/item/' + encodeURIComponent(nama);

// A. Nonaktifkan item yang stock-nya 4 kg: dialog menjelaskan stock dinolkan, lalu stock 0
{
  const { ctx, page, permintaan } = await buka(390, 844, rute('Daging sapi'));
  await layar(page).getByRole('button', { name: 'Nonaktifkan', exact: true }).click();
  await page.waitForTimeout(400);
  const d = page.getByRole('dialog');
  const isi = await d.innerText();
  cek(/Nonaktifkan Daging sapi\?/.test(isi) && /masih tercatat 4\skg\. Stock ini dinolkan dan dicatat sebagai penyesuaian di Riwayat stock/.test(isi) &&
    /tidak ikut nilai stock dan laporan/.test(isi), 'dialog menyebut stock dinolkan', isi);
  await d.getByRole('button', { name: 'Nonaktifkan', exact: true }).click();
  await page.waitForTimeout(1200);
  cek(/Daging sapi dinonaktifkan\. Stock 4\skg dinolkan\./.test(await teksToast(page)), 'toast stock dinolkan', await teksToast(page));
  const t = await layar(page).innerText();
  cek(/Nonaktif\. Daging sapi tidak tampil di form/.test(t) && /Stock tercatat hari ini\s*0 kg/.test(t), 'layar: nonaktif, stock 0', t.slice(0, 800));
  cek(await layar(page).getByRole('button', { name: 'Nolkan stock' }).count() === 0, 'tanpa Nolkan stock sesudah stock 0');
  cek(permintaan.filter((p) => p.action === 'aturItemAktif').length === 1 && item('Daging sapi').stock === 0, 'server: satu panggilan, stock 0');

  // B. Aktif lagi: tawaran stok pembuka
  await layar(page).getByRole('button', { name: 'Aktifkan lagi' }).click();
  await page.waitForTimeout(1200);
  const d2 = page.getByRole('dialog');
  cek(await d2.count() === 1 && /Isi stok pembuka sekarang\?/.test(await d2.innerText()) && /mulai dari stock 0 kg/.test(await d2.innerText()),
    'aktif lagi: tawaran stok pembuka', await d2.innerText().catch(() => ''));
  await d2.getByRole('button', { name: 'Nanti' }).click();
  await page.waitForTimeout(500);
  cek(await page.getByRole('dialog').count() === 0 && item('Daging sapi').aktif === true, 'Nanti menutup tawaran');
  await ctx.close();
}

// C. Item nonaktif lama yang masih punya stock: peringatan dan tombol Nolkan stock
aturAktifLangsung('Air mineral', false);
{
  const { ctx, page, permintaan } = await buka(390, 844, rute('Air mineral'));
  const t = await layar(page).innerText();
  cek(/Stock Air mineral masih tercatat 48\sbotol dan masih ikut nilai stock\./.test(t), 'peringatan stock sisa', t.slice(0, 900));
  await layar(page).getByRole('button', { name: 'Nolkan stock' }).click();
  await page.waitForTimeout(400);
  const d = page.getByRole('dialog');
  cek(/Nolkan stock Air mineral\?/.test(await d.innerText()) && /Stock 48\sbotol dinolkan/.test(await d.innerText()), 'dialog Nolkan stock', await d.innerText());
  await d.getByRole('button', { name: 'Nolkan stock' }).click();
  await page.waitForTimeout(1200);
  cek(/^Stock 48\sbotol dinolkan\.$/.test((await teksToast(page)).trim()), 'toast Nolkan stock', await teksToast(page));
  const p = permintaan.filter((x) => x.action === 'aturItemAktif').pop();
  cek(p && p.nama === 'Air mineral' && p.aktif === false, 'memanggil aturItemAktif nonaktif', p);
  cek(item('Air mineral').stock === 0 && item('Air mineral').aktif === false, 'server: stock 0, tetap nonaktif');
  cek(await layar(page).getByRole('button', { name: 'Nolkan stock' }).count() === 0 && !/masih ikut nilai stock/.test(await layar(page).innerText()),
    'peringatan dan tombol hilang');
  await ctx.close();
}

// D. Server lama (tanpa nolkanSaatNonaktif): teks lama, tanpa Nolkan stock dan tanpa tawaran stok pembuka
aturAktifLangsung('Bawang putih', false);
{
  const { ctx, page } = await buka(390, 844, rute('Bawang putih'), { serverLama: true });
  cek(await layar(page).getByRole('button', { name: 'Nolkan stock' }).count() === 0, 'server lama: tanpa Nolkan stock');
  await layar(page).getByRole('button', { name: 'Aktifkan lagi' }).click();
  await page.waitForTimeout(1200);
  cek(await page.getByRole('dialog').count() === 0, 'server lama: tanpa tawaran stok pembuka');
  await layar(page).getByRole('button', { name: 'Nonaktifkan', exact: true }).click();
  await page.waitForTimeout(400);
  const isi = await page.getByRole('dialog').innerText();
  cek(/Stock itu tetap tercatat dan tetap ikut nilai stock\./.test(isi) && !/dinolkan/.test(isi), 'server lama: peringatan lama', isi);
  await page.getByRole('dialog').getByRole('button', { name: 'Batal' }).click();
  await page.waitForTimeout(400);
  cek(item('Bawang putih').aktif === true && item('Bawang putih').stock < 0, 'Batal: tidak ada yang berubah', item('Bawang putih'));
  await ctx.close();
}

// E. Delapan ukuran: layar item nonaktif dengan stock sisa dan dialog Nolkan stock
A('simpanItem', { baru: true, nama: 'Kecap manis botol besar untuk dapur', kategori: 'Bumbu', satuan: 'botol', harga: 21000, stokMin: '', stokMaks: '' });
A('sesuaikanStock', { submissionId: crypto.randomUUID(), item: 'Kecap manis botol besar untuk dapur', tanggal: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }),
  stockSebenarnya: 12345.5, alasan: 'Stok pembuka', catatan: '' });
aturAktifLangsung('Kecap manis botol besar untuk dapur', false);
for (const [w, h] of [[320, 568], [360, 740], [390, 844], [430, 932], [768, 1024], [1024, 768], [1366, 768], [1920, 1080]]) {
  const { ctx, page } = await buka(w, h, rute('Kecap manis botol besar untuk dapur'));
  const ukur = () => page.evaluate(() => {
    const keluar = [...document.querySelectorAll('#layar *, [role="dialog"] *')].filter((e) => {
      const b = e.getBoundingClientRect();
      return b.width && (b.right > innerWidth + 1 || b.left < -1);
    }).map((e) => e.className).slice(0, 5);
    return { lebar: document.documentElement.scrollWidth, keluar };
  });
  const m = await ukur();
  const ada = await layar(page).getByRole('button', { name: 'Nolkan stock' }).count() === 1;
  await layar(page).getByRole('button', { name: 'Nolkan stock' }).click();
  await page.waitForTimeout(400);
  const md = await ukur();
  cek(ada && m.lebar <= w && !m.keluar.length && md.lebar <= w && !md.keluar.length, `ukuran ${w}x${h}`, { m, md });
  await page.getByRole('dialog').getByRole('button', { name: 'Batal' }).click();
  await ctx.close();
}

console.log('lulus', lulus, 'gagal', gagal, 'galat konsol', galat, 'ERR log', H.logs.filter((l) => l.startsWith('ERR')));
await browser.close();
srv.close();
