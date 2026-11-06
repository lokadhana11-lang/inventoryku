// Uji Chromium: kotak info Stock opname tiga kolom di laptop dan tombol nama di tabel setinggi 44 px (aplikasi 0.52.2,
// butir 474–475, telaah aplikasi 5 November 2026 butir 3 dan 4).
// Stock opname: mulai 1.024 px Kategori, Tanggal, dan Cari item satu baris, kolomnya sejajar kolom kotak info Stock; keterangan
// di bawahnya selebar kotak. Tablet dua kolom, HP satu kolom, seperti sebelumnya.
// Tombol nama di tabel (.tabel-tombol): HPP per menu, Riwayat, kartu stok, Staff ≥ 44 px tanpa keluar dari barisnya.
// Delapan ukuran dan gerak.
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
const UKURAN = [[320, 568], [360, 740], [390, 844], [430, 932], [768, 1024], [1024, 768], [1366, 768], [1920, 1080]];

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
  await page.waitForTimeout(1500);
  return { ctx, page };
}

async function ke(page, rute) {
  await page.evaluate((x) => { location.hash = x; }, rute);
  await page.waitForTimeout(1500);
}

/** Kotak info layar ini: kotak dan anak yang tampil, dengan kotak batasnya. */
const bacaKotak = (page) => page.evaluate(() => {
  const r = (e) => { const b = e.getBoundingClientRect(); return { kiri: Math.round(b.left), atas: Math.round(b.top), kanan: Math.round(b.right), bawah: Math.round(b.bottom) }; };
  const kotak = document.querySelector('#layar .kotak-info');
  const anak = [...kotak.children].filter((c) => getComputedStyle(c).display !== 'none');
  return {
    gulir: document.documentElement.scrollWidth - innerWidth,
    kotak: r(kotak),
    pad: parseFloat(getComputedStyle(kotak).paddingLeft),
    anak: anak.map((c) => Object.assign({ kelas: c.className, label: (c.querySelector('.kolom-label') || {}).textContent || '' }, r(c)))
  };
});

/** Semua .tabel-tombol yang tampil: tinggi dan apakah tetap di dalam barisnya. */
const bacaTombol = (page, akar) => page.evaluate((akar) => [...document.querySelectorAll(akar + ' .tabel-tombol')]
  .filter((e) => e.getClientRects().length).map((e) => {
    const b = e.getBoundingClientRect();
    const tr = e.closest('tr').getBoundingClientRect();
    return { teks: e.textContent, tag: e.tagName, tinggi: +b.height.toFixed(2), diBaris: b.top >= tr.top - 0.5 && b.bottom <= tr.bottom + 0.5,
      tinggiBaris: +tr.height.toFixed(2), lebarCukup: b.width >= 44 || e.textContent.length > 2 };
  }), akar);

// A. Laptop: Stock opname tiga kolom, sejajar kolom kotak info Stock; mencari item tidak mengubah susunan.
{
  const { ctx, page } = await buka(1366, 768);
  await ke(page, '#/opname');
  let m = await bacaKotak(page);
  const [kat, tgl, cari, ket] = m.anak;
  cek(m.anak.length === 4 && kat.label === 'Kategori' && tgl.label === 'Tanggal' && cari.label === 'Cari item' && /lebar-penuh/.test(ket.kelas),
    'opname: empat bagian kotak info', m.anak);
  cek(kat.atas === tgl.atas && tgl.atas === cari.atas && kat.kanan < tgl.kiri && tgl.kanan < cari.kiri, 'opname: tiga kolom satu baris', m.anak);
  cek(ket.atas > kat.bawah && ket.kiri === kat.kiri && ket.kanan === cari.kanan, 'opname: keterangan di bawah, selebar kotak', m.anak);
  cek(Math.abs((kat.kanan - kat.kiri) / (tgl.kanan - tgl.kiri) - 4 / 3) < 0.05 && Math.abs((tgl.kanan - tgl.kiri) - (cari.kanan - cari.kiri)) <= 1,
    'opname: kolom 4 : 3 : 3', m.anak);
  // Tinggi kolom tidak lagi dua baris: kotak lebih pendek dari susunan dua kolom (Kategori | Tanggal, Cari di baris kedua).
  cek(cari.atas === kat.atas && m.kotak.bawah - m.kotak.atas < 230, 'opname: kotak info lebih pendek', m.kotak);

  // Kolom sejajar kotak info Stock (Tanggal | Kategori | Cari item).
  await ke(page, '#/stock');
  const s = await bacaKotak(page);
  const tepiStock = s.anak.filter((a) => a.atas === s.anak[0].atas && !/kotak-ringkas/.test(a.kelas)).map((a) => [a.kiri, a.kanan]);
  cek(tepiStock.length === 3 && tepiStock.every((t, i) => Math.abs(t[0] - m.anak[i].kiri) <= 1 && Math.abs(t[1] - m.anak[i].kanan) <= 1),
    'opname: kolom sejajar kotak info Stock', { stock: tepiStock, opname: m.anak.slice(0, 3) });

  // Mencari: keterangan "n dari m item tampil" di bawah kotak cari; kolom lain tetap di tempatnya.
  await ke(page, '#/opname');
  await page.locator('#cari-item-opname').fill('a');
  await page.waitForTimeout(400);
  const info = await page.locator('#info-cari-opname').innerText();
  m = await bacaKotak(page);
  cek(/\d+ dari \d+ item tampil/.test(info) && m.anak[0].atas === m.anak[2].atas && m.anak[1].atas === m.anak[2].atas &&
    m.anak[0].kiri === kat.kiri && m.anak[2].kiri === cari.kiri, 'opname: mencari tidak mengubah susunan', { info, anak: m.anak });
  // Urutan Tab tetap: Kategori lalu Cari item.
  await page.locator('#opname-kategori').focus();
  await page.keyboard.press('Tab');
  cek(await page.evaluate(() => document.activeElement.id) === 'cari-item-opname', 'opname: Tab dari Kategori ke Cari item');
  await ctx.close();
}

// B. Delapan ukuran: tanpa gulir samping; laptop tiga kolom, tablet dua kolom, HP satu kolom.
for (const [w, h] of UKURAN) {
  const { ctx, page } = await buka(w, h);
  await ke(page, '#/opname');
  const m = await bacaKotak(page);
  const [kat, tgl, cari, ket] = m.anak;
  cek(m.gulir <= 0 && m.anak.every((a) => a.kanan <= m.kotak.kanan && a.kiri >= m.kotak.kiri), `${w}: opname tanpa gulir samping`, m);
  if (w >= 1024) cek(kat.atas === tgl.atas && tgl.atas === cari.atas && ket.atas > cari.bawah, `${w}: opname tiga kolom`, m.anak);
  else if (w >= 600) cek(kat.atas === tgl.atas && cari.atas > kat.bawah && cari.kiri === kat.kiri && ket.atas > cari.bawah, `${w}: opname dua kolom`, m.anak);
  else cek(tgl.atas > kat.bawah && cari.atas > tgl.bawah && ket.atas > cari.bawah && kat.kiri === cari.kiri && kat.kanan === cari.kanan,
    `${w}: opname satu kolom`, m.anak);
  await ctx.close();
}

// C. Tombol nama di tabel ≥ 44 px dan tetap di dalam barisnya: HPP per menu (laptop dan desktop), Riwayat, kartu stok, Staff.
for (const [w, h] of UKURAN.filter(([w]) => w >= 1024)) {
  const { ctx, page } = await buka(w, h);
  await ke(page, '#/hpp/menu');
  const t = await bacaTombol(page, '#layar .tabel-menu-hpp');
  cek(t.length >= 2 && t.every((x) => x.tag === 'A' && x.tinggi >= 44 && x.diBaris), `${w}: HPP per menu ≥ 44 px`, t);
  await ctx.close();
}
{
  const { ctx, page } = await buka(1366, 768);
  // Riwayat Stock: nama item di tabel detail membuka riwayat item; tanggal di rekap hariannya membuka transaksinya.
  await ke(page, '#/riwayat');
  await page.locator('#layar .daftar-baris').first().click();
  await page.waitForTimeout(1400);
  const tr = await bacaTombol(page, '#layar');
  cek(tr.length >= 1 && tr.every((x) => x.tag === 'BUTTON' && x.tinggi >= 44 && x.diBaris), 'Riwayat: nama item ≥ 44 px', tr);
  await page.locator('#layar .tabel-tombol').first().click();
  await page.waitForTimeout(1400);
  const ks = await bacaTombol(page, '.lembar');
  cek(ks.length >= 1 && ks.every((x) => x.tinggi >= 44 && x.diBaris), 'kartu stok: tanggal ≥ 44 px', ks);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await ke(page, '#/pengaturan/staff');
  const st = await bacaTombol(page, '#layar');
  cek(st.length >= 2 && st.every((x) => x.tinggi >= 44 && x.diBaris), 'Staff: nama ≥ 44 px', st);
  // Fokus papan ketik tetap terlihat di tombol HPP per menu.
  await ke(page, '#/hpp/menu');
  await page.locator('#layar .tabel-menu-hpp .tabel-tombol').first().focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  const garis = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle + ' ' + document.activeElement.className);
  cek(/^solid tabel-tombol/.test(garis), 'HPP per menu: garis fokus', garis);
  await ctx.close();
}

// D. Gerak menyala: susunan sama.
{
  const { ctx, page } = await buka(1366, 768, { gerak: true });
  await ke(page, '#/opname');
  const m = await bacaKotak(page);
  cek(m.anak[0].atas === m.anak[1].atas && m.anak[1].atas === m.anak[2].atas, 'gerak: opname tiga kolom', m.anak);
  await ke(page, '#/hpp/menu');
  const t = await bacaTombol(page, '#layar .tabel-menu-hpp');
  cek(t.length >= 2 && t.every((x) => x.tinggi >= 44), 'gerak: HPP per menu ≥ 44 px', t);
  await ctx.close();
}

console.log('lulus', lulus, 'gagal', gagal, 'galat konsol', galat, 'ERR log', H.logs.filter((l) => l.startsWith('ERR')));
await browser.close();
srv.close();
