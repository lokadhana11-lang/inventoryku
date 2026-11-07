// Uji Chromium: Tempel menu (aplikasi 0.54.0, Code.gs v0.47, butir 482–483): HP, server lama, delapan ukuran.
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';
import { muatChromium } from '../alat/peramban.mjs';
const chromium = await muatChromium();
let gagal = 0, lulus = 0;
const cek = (k, label, x) => { if (k) lulus++; else { gagal++; console.log('GAGAL:', label, x !== undefined ? JSON.stringify(x).slice(0, 600) : ''); } };
const s = seed();
const T = s.token;
const A = (action, b) => H.aksi(Object.assign({ action, token: T }, b));
const menuServer = (nama) => A('daftarMenu', {}).data.menu.find((m) => m.nama === nama);

const srv = H.layani(0);
await new Promise((r) => (srv.listening ? r() : srv.once('listening', r)));
const PORT = srv.address().port;
const browser = await chromium.launch();
const galat = [];

async function buka(w, h, siapa, rute, opsi = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'Asia/Jakarta', locale: 'id-ID', serviceWorkers: 'block', reducedMotion: 'reduce' });
  const permintaan = [];
  await ctx.route('https://api.uji/**', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    permintaan.push(body);
    const out = H.aksi(body);
    if (opsi.serverLama && out.ok && out.data) {
      if (body.action === 'daftarMenu') delete out.data.tempelSiap;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => galat.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(m.text())) galat.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: new RegExp(siapa) }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type({ Budi: '482915', Rina: '730264', Sari: '916205', Andi: '305718' }[siapa], { delay: 30 });
  await page.waitForTimeout(1500);
  await page.evaluate((r) => { location.hash = r; }, rute);
  await page.waitForTimeout(1800);
  return { ctx, page, permintaan };
}
async function tambahPrep(page, nama, cari) {
  await page.getByRole('button', { name: 'Tambah item', exact: true }).first().click();
  await page.waitForTimeout(400);
  const d = page.getByRole('dialog');
  await d.getByLabel('Cari item').fill(cari);
  await d.locator('.daftar-pilih-item button', { has: page.locator('.daftar-baris-judul', { hasText: new RegExp('^' + nama + '$') }) }).click();
  await page.waitForTimeout(400);
}

const TEMPEL = [
  'Menu\tHarga jual\tBahan\tTakaran\tHasil bersih',
  'Ayam goreng\tRp 25.000\tAyam fillet\t0,15 kg\t90%',
  '\t\tMinyak goreng\t0,05\t',
  '\t\tNasi putih\t1\t',
  'Ayam geprek\t\tAyam fillet\t0,2\t85',
  '\t\tSambal dasar\t0,05\t',
  'Sup tomat\t\tTomat\t0,2\t',
  'Mi goreng\t15.000\tMi\t1\t'
].join('\n');

// A. Tempel menu di HP: pratinjau, dua salah, simpan, sisa di kotak tempel
{
  const { ctx, page, permintaan } = await buka(390, 844, 'Budi', '#/pengaturan/menu');
  const tautan = page.getByRole('link', { name: 'Tempel dari Excel/Sheets' });
  cek(await tautan.count() === 1 && await tautan.isVisible(), 'tautan Tempel dari Excel/Sheets di daftar menu');
  await tautan.click();
  await page.waitForTimeout(1500);
  cek(/menu-tempel$/.test(page.url()) && await page.locator('h1.judul-layar', { hasText: 'Tempel menu' }).count() >= 1, 'layar Tempel menu');
  await page.getByLabel('Tempel baris menu').fill(TEMPEL);
  await page.waitForTimeout(500);
  const baris = page.locator('.tempel-baris');
  cek(await baris.count() === 4, 'empat menu di pratinjau', await baris.count());
  const t0 = await baris.nth(0).innerText();
  cek(/Baris 2–4 · Ayam goreng/.test(t0) && /Rp\s?25\.000 · 3 bahan/.test(t0) && /Ayam fillet 0,15 kg \(90%\), Minyak goreng 0,05 liter, Nasi putih 1 porsi/.test(t0) && /Menu baru/.test(t0), 'pratinjau Ayam goreng', t0);
  const t1 = await baris.nth(1).innerText();
  cek(/Ayam geprek/.test(t1) && /harga tetap Rp\s?28\.000/.test(t1) && /Mengganti menu yang ada/.test(t1), 'pratinjau Ayam geprek diganti', t1);
  const t2 = await baris.nth(2).innerText();
  cek(/Sup tomat/.test(t2) && /Isi harga jual/.test(t2), 'menu baru tanpa harga salah', t2);
  const t3 = await baris.nth(3).innerText();
  cek(/Mi goreng/.test(t3) && /Bahan Mi belum ada di Item/.test(t3), 'bahan tidak ada salah', t3);
  cek(/2 menu siap, 2 salah\./.test(await page.locator('.bilah-kirim').innerText()), 'penghitung');
  await page.locator('.bilah-kirim').getByRole('button', { name: 'Simpan 2 menu' }).click();
  await page.waitForTimeout(400);
  const dlg = page.getByRole('dialog');
  cek(/1 menu baru langsung aktif; 1 menu yang sudah ada diganti bahannya/.test(await dlg.innerText()) && /2 menu yang salah tidak ikut/.test(await dlg.innerText()), 'konfirmasi', await dlg.innerText());
  await dlg.getByRole('button', { name: 'Simpan 2 menu' }).click();
  await page.waitForTimeout(1800);
  const p = permintaan.filter((x) => x.action === 'tempelMenu').pop();
  cek(p && p.menu.length === 2 && p.menu[0].hargaJual === 25000 && p.menu[0].bahan[0].hasilBersih === 90 && p.menu[1].ganti === true && p.menu[1].hargaJual === '', 'tempelMenu dikirim', p);
  cek(menuServer('Ayam goreng').hargaJual === 25000 && menuServer('Ayam geprek').hargaJual === 28000 && menuServer('Ayam geprek').bahan.length === 2, 'menu tersimpan di server');
  const sisa = await page.getByLabel('Tempel baris menu').inputValue();
  const b = TEMPEL.split('\n');
  cek(sisa === [b[0], b[6], b[7]].join('\n'), 'sisa: judul dan menu yang salah', sisa);
  await ctx.close();
}

// B. Server lama: tautan tersembunyi dan layar tempel memberi petunjuk
{
  const a = await buka(390, 844, 'Budi', '#/pengaturan/menu', { serverLama: true });
  cek(!(await a.page.getByRole('link', { name: 'Tempel dari Excel/Sheets' }).isVisible()), 'server lama: tautan tempel tersembunyi');
  await a.page.evaluate(() => { location.hash = '#/pengaturan/menu-tempel'; });
  await a.page.waitForTimeout(1500);
  cek(/server masih versi lama/.test(await a.page.locator('.layar-isi').innerText()) && !(await a.page.getByLabel('Tempel baris menu').isVisible()), 'server lama: layar tempel memberi petunjuk');
  await a.ctx.close();
}

// C. Delapan ukuran: layar tempel dengan pratinjau dan kata panjang
for (const [w, h] of [[320, 568], [360, 740], [390, 844], [430, 932], [768, 1024], [1024, 768], [1366, 768], [1920, 1080]]) {
  const { ctx, page } = await buka(w, h, 'Budi', '#/pengaturan/menu-tempel');
  await page.getByLabel('Tempel baris menu').fill(TEMPEL.replace('Mi goreng\t15.000\tMi', 'Mi goreng\t15.000\tBahan' + 'x'.repeat(80)));
  await page.waitForTimeout(500);
  const m = await page.evaluate(() => {
    const lebar = document.documentElement.scrollWidth;
    const keluar = [...document.querySelector('.layar-isi').querySelectorAll('*')].filter((e) => {
      if (e.closest('textarea')) return false;
      const b = e.getBoundingClientRect();
      return b.width && (b.right > innerWidth + 1 || b.left < -1);
    }).map((e) => e.className).slice(0, 5);
    return { lebar, keluar, ada: document.querySelectorAll('.tempel-baris').length === 4 };
  });
  cek(m.ada && m.lebar <= w && !m.keluar.length, `ukuran ${w}x${h}`, m);
  await ctx.close();
}

console.log('lulus', lulus, 'gagal', gagal, 'galat konsol', galat, 'ERR log', H.logs.filter((l) => l.startsWith('ERR')));
await browser.close();
srv.close();
