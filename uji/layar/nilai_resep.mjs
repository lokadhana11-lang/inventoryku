// Uji Chromium fitur Hari libur (aplikasi 0.30.0), API tiruan memanggil doPost asli.
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';
import { muatChromium } from '../alat/peramban.mjs';
const chromium = await muatChromium();
let gagal = 0, lulus = 0;
const cek = (k, label, x) => { if (k) lulus++; else { gagal++; console.log('GAGAL:', label, x !== undefined ? JSON.stringify(x).slice(0, 700) : ''); } };
const s = seed();
const T = s.token;
const hari = (n) => new Date(Date.now() + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const hariIni = hari(0);
const A = (action, b) => H.aksi(Object.assign({ action, token: T }, b));
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const pendek = (t) => Number(t.slice(8)) + ' ' + BULAN[Number(t.slice(5, 7)) - 1];

const srv = H.layani(0); // port kosong mana pun
await new Promise((r) => (srv.listening ? r() : srv.once('listening', r)));
const PORT = srv.address().port;
const browser = await chromium.launch();
const galat = [];

async function buka(w, h, siapa, opsi = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'Asia/Jakarta', locale: 'id-ID', serviceWorkers: opsi.sw ? 'allow' : 'block',
    reducedMotion: opsi.gerak ? 'no-preference' : 'reduce', hasTouch: !!opsi.sentuh, isMobile: !!opsi.sentuh });
  const permintaan = [];
  await ctx.route('https://api.uji/**', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    permintaan.push(body);
    if (opsi.putus && opsi.putus(body)) { await route.abort('internetdisconnected'); return; }
    if (opsi.tunda && opsi.tunda(body)) await new Promise((r) => setTimeout(r, 2500));
    let out;
    if (false) out = null;
    else out = H.aksi(body);
    if (opsi.ubah && out.ok && out.data) opsi.ubah(out.data, body.action);
    if (opsi.serverLama && out.ok && out.data) {
      const buang = (o) => {
        if (!o || typeof o !== 'object') return;
        if (o.nilaiStock) delete o.nilaiStock.dariResep;
        (o.item || []).forEach((i) => { delete i.hargaResep; });
      };
      buang(out.data);
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => galat.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(m.text())) galat.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: new RegExp(siapa) }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type({ Budi: '482915', Rina: '730264', Sari: '916205', Andi: '305718' }[siapa], { delay: 30 });
  await page.waitForTimeout(1500);
  if (opsi.rute) {
    await page.evaluate((r) => { location.hash = r; }, opsi.rute);
    await page.waitForTimeout(1500);
  }
  return { ctx, page, permintaan };
}
const lembar = (page) => page.locator('.lembar');
const konf = (k) => { const r = H.ss.getSheetByName('M_Konfigurasi').getDataRange().getValues().find((x) => x[0] === k); return r ? String(r[1]) : null; };
let n = 0; const sid = () => 'betulUI-' + (++n) + '-' + Math.random().toString(36).slice(2, 10);
const toastTeks = async (page) => (await page.locator('.toast').allInnerTexts()).join(' | ');
const itemSrv = (n) => H.aksi({ action: 'daftarItem', token: T }).data.item.find((x) => x.nama === n);




const teks = async (page) => page.locator('#layar').innerText();
const bukaNilai = async (page) => { await page.locator('.kepala-nilai[aria-haspopup]').first().click(); await page.waitForTimeout(500); return (await page.locator('.lembar').innerText()).replace(/\u00a0/g, ' '); };
const stockS = A('daftarItem', {}).data.item.find((x) => x.nama === 'Sambal dasar').stock;
const fmt = (n) => n.toLocaleString('id-ID');

// A. Lembar Nilai stock
{
  const { ctx, page } = await buka(390, 844, 'Budi', { rute: '#/dashboard' });
  await page.waitForTimeout(1200);
  const t = await bukaNilai(page);
  cek(/Barang jadi tanpa harga satuan memakai harga dari resepnya\./.test(t), 'lembar: kalimat pembuka', t.slice(0, 400));
  cek(/Harga dari resep \(1\)/.test(t) && t.includes('Sambal dasar') && t.includes('× Rp 45.875 per kg') && t.includes('Rp ' + fmt(Math.round(stockS * 45875))), 'lembar: Harga dari resep', t);
  const belum = t.slice(t.indexOf('Belum punya harga'));
  cek(!/Sambal dasar/.test(belum), 'lembar: Sambal tidak di Belum punya harga', belum);
  const href = await page.locator('.lembar a.daftar-baris', { hasText: 'Sambal dasar' }).getAttribute('href');
  cek(/#\/pengaturan\/resep\/Sambal/.test(href), 'tautan ke resep', href);
  await page.locator('.lembar a.daftar-baris', { hasText: 'Sambal dasar' }).click();
  await page.waitForTimeout(1500);
  cek(/#\/pengaturan\/resep\//.test(page.url()), 'membuka resep', page.url());
  await ctx.close();
}
// B. Resep kurang: tautan ke resep dan kalimatnya.
{
  const { ctx, page } = await buka(390, 844, 'Budi', { rute: '#/dashboard', ubah: (d, a) => {
    if (a !== 'dashboard') return;
    const s = d.nilaiStock.dariResep.shift();
    d.nilaiStock.tanpaHarga.push({ nama: s.nama, kategori: s.kategori, satuan: s.satuan, stock: s.stock, aktif: true, resepKurang: true });
  } });
  await page.waitForTimeout(1200);
  const t = await bukaNilai(page);
  cek(/Ada bahan resep yang belum punya harga\. Ketuk untuk membuka resepnya\./.test(t) && !/Harga dari resep/.test(t), 'resep kurang: kalimat', t);
  const href = await page.locator('.lembar a.daftar-baris', { hasText: 'Sambal dasar' }).getAttribute('href');
  cek(/resep/.test(href), 'resep kurang: tautan ke resep', href);
  await ctx.close();
}
// C. Pengaturan → Item
{
  const { ctx, page } = await buka(390, 844, 'Budi', { rute: '#/pengaturan/item' });
  await page.waitForTimeout(1500);
  const baris = await page.locator('a.daftar-baris', { hasText: 'Sambal dasar' }).innerText();
  cek(/Rp 45\.875 per kg dari resep/.test(baris) && !/Belum punya harga/.test(baris), 'daftar item: harga dari resep', baris);
  await page.locator('a.daftar-baris', { hasText: 'Sambal dasar' }).click();
  await page.waitForTimeout(1500);
  const k = await page.locator('.kepala-layar').innerText();
  cek(/Rp 45\.875\s*\/kg/.test(k) && /Dari resep/.test(k), 'kepala item: dari resep', k);
  await ctx.close();
}
// D. Server lama
{
  const { ctx, page } = await buka(390, 844, 'Budi', { rute: '#/dashboard', serverLama: true });
  await page.waitForTimeout(1200);
  const t = await bukaNilai(page);
  cek(!/resep/i.test(t.split('Belum punya harga')[0]) && /Stock Akhir × harga satuan yang berlaku sekarang\. Item tanpa harga/.test(t), 'server lama: lembar seperti dulu', t.slice(0, 300));
  await ctx.close();
  const b = await buka(390, 844, 'Budi', { rute: '#/pengaturan/item', serverLama: true });
  await b.page.waitForTimeout(1500);
  cek(/Belum punya harga/.test(await b.page.locator('a.daftar-baris', { hasText: 'Sambal dasar' }).innerText()), 'server lama: daftar item seperti dulu');
  await b.ctx.close();
}
// E. Delapan ukuran untuk lembar Nilai stock
for (const [w, hh] of [[320, 568], [360, 740], [390, 844], [430, 932], [768, 1024], [1024, 768], [1366, 768], [1920, 1080]]) {
  const x = await buka(w, hh, 'Budi', { rute: '#/dashboard' });
  await x.page.waitForTimeout(1200);
  await bukaNilai(x.page);
  const m = await x.page.evaluate(() => {
    const l = document.querySelector('.lembar');
    const keluar = [...l.querySelectorAll('*')].filter((e) => { const b = e.getBoundingClientRect(); return b.width && (b.right > innerWidth + 1 || b.left < -1) && !e.closest('.tabel-bingkai'); }).map((e) => e.className).slice(0, 3);
    const kecil = [...l.querySelectorAll('a.daftar-baris')].filter((e) => e.getBoundingClientRect().height < 44).length;
    return { lebar: document.documentElement.scrollWidth, keluar, kecil };
  });
  cek(m.lebar <= w && !m.keluar.length && !m.kecil, `ukuran ${w}x${hh}`, m);
  await x.ctx.close();
}
console.log('lulus', lulus, 'gagal', gagal, 'galat konsol', galat, 'ERR log', H.logs.filter((l) => l.startsWith('ERR')));
await browser.close();
srv.close();
