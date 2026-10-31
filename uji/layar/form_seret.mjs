// Uji Chromium: urutan form di Pengaturan → Form diubah dengan menyeret pegangan (aplikasi 0.41.0): tetikus, sentuhan,
// papan ketik, ketuk tanpa seret, halaman ikut bergulir di tepi layar, data baru di tengah seretan, gerak, delapan ukuran.
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';
import { muatChromium } from '../alat/peramban.mjs';
const chromium = await muatChromium();
let gagal = 0, lulus = 0;
const cek = (k, label, x) => { if (k) lulus++; else { gagal++; console.log('GAGAL:', label, x !== undefined ? JSON.stringify(x).slice(0, 600) : ''); } };
const s = seed();
const T = s.token;
const A = (action, b) => H.aksi(Object.assign({ action, token: T }, b));
const urutServer = () => A('daftarForm', {}).data.form.map((f) => f.nama);

const srv = H.layani(0);
await new Promise((r) => (srv.listening ? r() : srv.once('listening', r)));
const PORT = srv.address().port;
const browser = await chromium.launch();
const galat = [];

async function buka(w, h, rute, opsi = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'Asia/Jakarta', locale: 'id-ID', serviceWorkers: 'block',
    reducedMotion: opsi.gerak ? 'no-preference' : 'reduce', hasTouch: !!opsi.sentuh });
  const permintaan = [];
  await ctx.route('https://api.uji/**', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    permintaan.push(body);
    const out = H.aksi(body);
    if (opsi.tunda && body.action === 'daftarForm') await new Promise((r) => setTimeout(r, opsi.tunda));
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
  await page.waitForTimeout(opsi.tungguMuat === undefined ? 1800 : opsi.tungguMuat);
  return { ctx, page, permintaan };
}
const namaTampil = (page) => page.locator('.daftar-seret .baris-form .daftar-baris-judul').allInnerTexts();
const pegangan = (page, i) => page.locator('.daftar-seret .pegangan-urut').nth(i);
async function tengah(loc) {
  const b = await loc.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
// Seret dengan tetikus dari pegangan baris dari ke tengah baris ke (dilewati sedikit ke arah gerak).
async function seretTetikus(page, dari, ke) {
  const p = await tengah(pegangan(page, dari));
  const t = await tengah(page.locator('.daftar-seret .baris-form').nth(ke));
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  const tujuan = t.y + (ke > dari ? 10 : -10);
  for (let i = 1; i <= 12; i++) await page.mouse.move(p.x, p.y + ((tujuan - p.y) * i) / 12);
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForTimeout(400);
}

const AWAL = urutServer();
cek(AWAL.length === 4, 'empat form bawaan', AWAL);

// A. HP: seret dengan tetikus, Simpan urutan, Beranda mengikuti
{
  const { ctx, page, permintaan } = await buka(390, 844, '#/pengaturan/form');
  cek(await page.locator('.daftar-seret .pegangan-urut').count() === 4 && await page.getByRole('button', { name: /^(Naikkan|Turunkan) / }).count() === 0,
    'empat pegangan, tanpa tombol naik/turun');
  cek(/tahan pegangan di kiri nama form lalu seret/.test(await page.locator('#bantuan-seret-form').innerText()), 'teks bantuan seret');
  cek(await pegangan(page, 0).getAttribute('aria-label') === 'Geser ' + AWAL[0] && await pegangan(page, 0).getAttribute('aria-describedby') === 'bantuan-seret-form',
    'label pegangan');
  const kp = await pegangan(page, 0).boundingBox();
  const kn = await page.locator('.daftar-seret .baris-form .daftar-baris-judul').first().boundingBox();
  cek(kp.width >= 44 && kp.height >= 44 && kp.x + kp.width <= kn.x + 1, 'pegangan 48 px di kiri nama', [kp, kn]);
  await seretTetikus(page, 0, 2);
  const baru = await namaTampil(page);
  cek(JSON.stringify(baru) === JSON.stringify([AWAL[1], AWAL[2], AWAL[0], AWAL[3]]), 'urutan tampil sesudah diseret', baru);
  cek(await page.getByRole('button', { name: 'Simpan urutan' }).isVisible(), 'Simpan urutan muncul');
  cek(await page.locator('.sr[aria-live]').innerText() === AWAL[0] + ' dipindah ke urutan 3 dari 4.', 'diumumkan', await page.locator('.sr[aria-live]').innerText());
  cek(await page.evaluate(() => !document.querySelector('.pegangan-urut:focus-visible')), 'tanpa cincin fokus sesudah diseret tetikus');
  cek(await page.locator('.daftar-seret .baris-urut[style*="transform"]').count() === 0 && await page.locator('.diseret, .sedang-diseret').count() === 0,
    'tanpa sisa transform sesudah dilepas');
  cek(urutServer().join() === AWAL.join(), 'belum tersimpan sebelum Simpan urutan');
  await page.getByRole('button', { name: 'Simpan urutan' }).click();
  await page.waitForTimeout(1200);
  const p = permintaan.filter((x) => x.action === 'urutForm').pop();
  cek(p && p.urutan.length === 4, 'urutForm dikirim', p);
  cek(urutServer().join() === baru.join(), 'server menyimpan urutan', urutServer());
  cek(/Urutan form tersimpan/.test(await page.locator('.toast').first().innerText().catch(() => '')), 'toast tersimpan');
  await page.evaluate(() => { location.hash = '#/'; });
  await page.waitForTimeout(1800);
  const tiket = await page.locator('.tiket-grid .tiket-nama').allInnerTexts();
  cek(JSON.stringify(tiket.slice(0, 4)) === JSON.stringify(baru), 'tiket Beranda mengikuti urutan', tiket);
  await ctx.close();
}

// B. Papan ketik: panah atas dua kali, fokus tetap di pegangan; Batal mengembalikan
{
  const { ctx, page } = await buka(1366, 768, '#/pengaturan/form');
  const awal = await namaTampil(page);
  await pegangan(page, 3).focus();
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(200);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(200);
  const baru = await namaTampil(page);
  cek(JSON.stringify(baru) === JSON.stringify([awal[0], awal[3], awal[1], awal[2]]), 'panah atas dua kali', baru);
  cek(await page.evaluate(() => document.activeElement.getAttribute('aria-label')) === 'Geser ' + awal[3], 'fokus tetap di pegangan');
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(200);
  cek((await namaTampil(page))[2] === awal[3], 'panah bawah');
  await pegangan(page, 0).focus();
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(200);
  cek((await namaTampil(page))[0] === awal[0], 'panah atas di baris pertama tidak memindah');
  await page.getByRole('button', { name: 'Batal' }).click();
  await page.waitForTimeout(300);
  cek(JSON.stringify(await namaTampil(page)) === JSON.stringify(awal) && await page.getByRole('button', { name: 'Simpan urutan' }).count() === 0, 'Batal mengembalikan');
  // C. Ketuk pegangan tanpa seret: tidak ada yang berubah
  const p = await tengah(pegangan(page, 1));
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x, p.y + 2);
  await page.mouse.up();
  await page.waitForTimeout(300);
  cek(JSON.stringify(await namaTampil(page)) === JSON.stringify(awal) && await page.getByRole('button', { name: 'Simpan urutan' }).count() === 0, 'ketuk tanpa seret');
  await ctx.close();
}

// D. Sentuhan (CDP): halaman tidak ikut bergulir saat pegangan diseret
{
  const { ctx, page } = await buka(360, 740, '#/pengaturan/form', { sentuh: true });
  const awal = await namaTampil(page);
  const cdp = await ctx.newCDPSession(page);
  const p = await tengah(pegangan(page, 0));
  const t = await tengah(page.locator('.daftar-seret .baris-form').nth(1));
  const gulirAwal = await page.evaluate(() => window.scrollY);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x, y: p.y + ((t.y + 12 - p.y) * i) / 10 }] });
    await page.waitForTimeout(20);
  }
  const selama = await page.evaluate(() => ({ diseret: !!document.querySelector('.baris-urut.diseret'), gulir: window.scrollY }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(400);
  const baru = await namaTampil(page);
  cek(selama.diseret && selama.gulir === gulirAwal, 'sentuhan: baris diseret, halaman tidak bergulir', selama);
  cek(JSON.stringify(baru) === JSON.stringify([awal[1], awal[0], awal[2], awal[3]]), 'sentuhan: urutan berubah', baru);
  await ctx.close();
}

// E. Daftar panjang di 320×568: seret baris terakhir ke tepi atas, halaman ikut bergulir sampai baris itu paling atas
for (let i = 1; i <= 10; i++) {
  const r = A('simpanForm', { baru: true, nama: 'Checklist area ' + i, tampil: i % 3 !== 0, keterangan: '', jadwal: 'harian', hari: [],
    kolom: [{ id: '', bagian: 'baris', label: 'Area', jenis: 'Teks', pilihan: [], wajib: true }] });
  if (!r.ok) cek(false, 'buat form kustom ' + i, r.pesan);
}
{
  const { ctx, page } = await buka(320, 568, '#/pengaturan/form');
  const awal = await namaTampil(page);
  cek(awal.length === 14, 'empat belas form', awal.length);
  const akhir = pegangan(page, 13);
  await akhir.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const gulirAwal = await page.evaluate(() => window.scrollY);
  const p = await tengah(akhir);
  const atas = await page.evaluate(() => document.querySelector('.bar').getBoundingClientRect().bottom);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(p.x, p.y + ((atas + 8 - p.y) * i) / 10);
  await page.waitForTimeout(3500);
  const gulirSelama = await page.evaluate(() => window.scrollY);
  await page.mouse.up();
  await page.waitForTimeout(500);
  const baru = await namaTampil(page);
  cek(gulirAwal > 300 && gulirSelama < gulirAwal - 300, 'halaman ikut bergulir ke atas', [gulirAwal, gulirSelama]);
  cek(baru[0] === awal[13] && baru.length === 14 && JSON.stringify(baru.slice(1)) === JSON.stringify(awal.slice(0, 13)), 'baris terakhir menjadi paling atas', baru);
  await page.getByRole('button', { name: 'Simpan urutan' }).click();
  await page.waitForTimeout(1200);
  cek(urutServer().join() === baru.join(), 'urutan 14 form tersimpan');
  await ctx.close();
}

// F. Gerak dinyalakan: baris lain bergeser dengan transisi; "kurangi gerak": tanpa transisi
for (const gerak of [true, false]) {
  const { ctx, page } = await buka(768, 1024, '#/pengaturan/form', { gerak });
  const awal = await namaTampil(page);
  const p = await tengah(pegangan(page, 0));
  const t = await tengah(page.locator('.daftar-seret .baris-form').nth(2));
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(p.x, p.y + ((t.y + 10 - p.y) * i) / 8);
  await page.waitForTimeout(250);
  const m = await page.evaluate(() => {
    const r = [...document.querySelectorAll('.daftar-seret .baris-urut')];
    return { diseret: r[0].classList.contains('diseret'), geser1: r[1].style.transform, geser3: r[3].style.transform,
      transisi: getComputedStyle(r[1]).transitionDuration, bayang: getComputedStyle(r[0]).boxShadow !== 'none' };
  });
  await page.mouse.up();
  await page.waitForTimeout(400);
  cek(m.diseret && m.bayang && /translateY\(-\d/.test(m.geser1) && m.geser3 === '', (gerak ? 'gerak' : 'kurangi gerak') + ': baris diangkat, baris lain bergeser', m);
  cek(gerak ? m.transisi === '0.15s' : /^0s/.test(m.transisi), (gerak ? 'gerak: transisi 150 ms' : 'kurangi gerak: tanpa transisi'), m.transisi);
  cek((await namaTampil(page))[2] === awal[0], (gerak ? 'gerak' : 'kurangi gerak') + ': urutan berubah');
  await ctx.close();
}

// H. Data dari server datang di tengah seretan: daftar tidak digambar ulang sampai dilepas, urutan tetap dipakai
{
  const opsi = { tunda: 0 };
  const { ctx, page, permintaan } = await buka(390, 844, '#/pengaturan/form', opsi);
  // Sekali dimuat (tersimpan di HP), lalu dibuka lagi dengan jawaban server yang lambat.
  opsi.tunda = 2500;
  permintaan.length = 0;
  await page.evaluate(() => { location.hash = '#/pengaturan'; });
  await page.waitForTimeout(800);
  await page.evaluate(() => { location.hash = '#/pengaturan/form'; });
  await page.waitForTimeout(600);
  const awal = await namaTampil(page);
  cek(awal.length === 14, 'data tersimpan di HP tampil dulu', awal.length);
  const p = await tengah(pegangan(page, 0));
  const t = await tengah(page.locator('.daftar-seret .baris-form').nth(1));
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(p.x, p.y + ((t.y + 10 - p.y) * i) / 6);
  await page.waitForTimeout(3000);
  const masihDiseret = await page.locator('.baris-urut.diseret').count();
  await page.mouse.up();
  await page.waitForTimeout(500);
  const baru = await namaTampil(page);
  cek(permintaan.some((x) => x.action === 'daftarForm') && masihDiseret === 1, 'jawaban server datang selama diseret', masihDiseret);
  cek(baru[0] === awal[1] && baru[1] === awal[0] && await page.getByRole('button', { name: 'Simpan urutan' }).isVisible(), 'urutan dari seretan tetap dipakai', baru);
  await ctx.close();
}

// G. Delapan ukuran: tanpa gulir ke samping, pegangan di dalam layar
for (const [w, h] of [[320, 568], [360, 740], [390, 844], [430, 932], [768, 1024], [1024, 768], [1366, 768], [1920, 1080]]) {
  const { ctx, page } = await buka(w, h, '#/pengaturan/form');
  const m = await page.evaluate(() => {
    const keluar = [...document.querySelectorAll('.layar-isi *')].filter((e) => {
      const b = e.getBoundingClientRect();
      return b.width && (b.right > innerWidth + 1 || b.left < -1);
    }).map((e) => e.className).slice(0, 5);
    const p = [...document.querySelectorAll('.pegangan-urut')].map((e) => e.getBoundingClientRect());
    return { lebar: document.documentElement.scrollWidth, keluar, jumlah: p.length, dalam: p.every((b) => b.left >= 0 && b.right <= innerWidth && b.width >= 44) };
  });
  cek(m.lebar <= w && !m.keluar.length && m.jumlah === 14 && m.dalam, `ukuran ${w}x${h}`, m);
  await ctx.close();
}

console.log('lulus', lulus, 'gagal', gagal, 'galat konsol', galat, 'ERR log', H.logs.filter((l) => l.startsWith('ERR')));
await browser.close();
srv.close();
