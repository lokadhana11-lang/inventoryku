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
// Bulan berjalan dinilai sampai kemarin: "1–28 Okt" (bukan tanggal tetap).
const RENTANG = '1–' + pendek(hari(-1));

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
    if (opsi.serverLama && out.ok && out.data) {
      const buang = (o) => {
        if (!o || typeof o !== 'object') return;
        delete o.foodCostSementara;
        if (o.hpp) delete o.hpp.foodCostSementara;
        (o.grafik || []).forEach((g) => { delete g.sementara; });
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
const h = A('hpp', { bulan: hariIni.slice(0, 7) }).data;
const S = h.foodCostSementara;
const persen = (x) => x.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
cek(S && h.foodCost === null, 'data uji punya food cost sementara', S);

// A. Dashboard
{
  const { ctx, page } = await buka(390, 844, 'Budi', { rute: '#/dashboard' });
  await page.waitForTimeout(1200);
  const t = await teks(page);
  cek(new RegExp('Oktober ' + persen(S.foodCost).replace('.', '\\.') + ' sementara · target 35%').test(t), 'dashboard: sementara', t.slice(0, 1500));
  await ctx.close();
}
// B. Layar HPP
{
  const { ctx, page } = await buka(390, 844, 'Budi', { rute: '#/hpp' });
  await page.waitForTimeout(1500);
  const t = await teks(page);
  cek(t.includes('Food cost sementara ' + RENTANG), 'kepala: label sementara', t.slice(0, 600));
  cek(t.includes(persen(S.foodCost)), 'kepala: angka sementara');
  cek(new RegExp('Dari ' + S.hari + ' dari ' + S.jumlahHari + ' hari yang penjualannya tercatat').test(t), 'kepala: keterangan hari');
  cek(new RegExp('Food cost sementara ' + persen(S.foodCost).replace('.', '\\.') + ' dihitung dari ' + S.hari + ' hari yang sudah tercatat saja').test(t), 'kartu menunggu: kalimat', t.slice(0, 2500));
  cek(/Batang pucat: sementara, penjualan belum lengkap\./.test(t), 'grafik: ringkasan');
  cek(/Angka miring: sementara/.test(t), 'grafik: keterangan bawah');
  const g = await page.evaluate(() => ({
    sem: document.querySelectorAll('.grafik-fc-svg .batang.sementara').length,
    nilai: [...document.querySelectorAll('.grafik-fc-nilai span')].map((x) => [x.textContent, x.className]),
    aria: document.querySelector('.grafik-fc').getAttribute('aria-label')
  }));
  cek(g.sem === 1 && g.nilai[5][1].includes('sementara') && g.nilai[5][0] !== '–', 'grafik: batang dan angka sementara', g);
  cek(/Oktober 2026 [\d,]+% sementara/.test(g.aria), 'grafik: uraian pembaca layar', g.aria);
  await ctx.close();
}
// C. Server lama: seperti dulu
{
  const { ctx, page } = await buka(390, 844, 'Budi', { rute: '#/hpp', serverLama: true });
  await page.waitForTimeout(1500);
  const t = await teks(page);
  cek(/"–": penjualan bulan itu belum lengkap/.test(t), 'server lama: keterangan grafik lama');
  cek(!/sementara/i.test(t) && t.includes('Food cost ' + RENTANG) && /Food cost dihitung setelah semua hari tercatat/.test(t), 'server lama: tanpa sementara', t.slice(0, 800));
  await ctx.close();
  const b = await buka(390, 844, 'Budi', { rute: '#/dashboard', serverLama: true });
  await b.page.waitForTimeout(1200);
  cek(/Oktober: penjualan belum lengkap/.test(await teks(b.page)), 'server lama: dashboard seperti dulu');
  await b.ctx.close();
}
// D. Delapan ukuran
for (const [w, hh] of [[320, 568], [360, 740], [390, 844], [430, 932], [768, 1024], [1024, 768], [1366, 768], [1920, 1080]]) {
  for (const rute of ['#/hpp', '#/dashboard']) {
    const x = await buka(w, hh, 'Budi', { rute });
    await x.page.waitForTimeout(1200);
    const m = await x.page.evaluate(() => {
      const lebar = document.documentElement.scrollWidth;
      const akar = document.querySelector('#layar');
      const keluar = [...akar.querySelectorAll('*')].filter((e) => { const b = e.getBoundingClientRect(); return b.width && (b.right > innerWidth + 1 || b.left < -1) && !e.closest('.tabel-bingkai'); })
        .map((e) => e.className || e.tagName).slice(0, 5);
      const potong = [...akar.querySelectorAll('.kepala-nilai-label, .kepala-nilai-ket, .grafik-fc-nilai span')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent).slice(0, 3);
      return { lebar, keluar, potong };
    });
    cek(m.lebar <= w && !m.keluar.length && !m.potong.length, `ukuran ${w}x${hh} ${rute}`, m);
    await x.ctx.close();
  }
}
console.log('lulus', lulus, 'gagal', gagal, 'galat konsol', galat, 'ERR log', H.logs.filter((l) => l.startsWith('ERR')));
await browser.close();
srv.close();
