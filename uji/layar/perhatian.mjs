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
    if (opsi.ubah && out.ok && out.data && body.action === 'dashboard') opsi.ubah(out.data);
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



const lihat = async (page) => page.evaluate(() => {
  const sek = document.querySelector('.dashboard-perhatian');
  const det = sek.querySelector('details.perhatian-rutin');
  const tampak = (e) => !!(e && e.checkVisibility() && e.getBoundingClientRect().height > 0);
  return {
    judul: [...sek.querySelectorAll('.judul-sub')].map((h) => h.textContent),
    hariIni: [...sek.querySelectorAll(':scope > .daftar .daftar-baris-judul')].map((x) => x.textContent),
    adaRutin: !!det, buka: det ? det.open : null,
    ringkas: det ? det.querySelector('summary').innerText : '',
    rutin: det ? [...det.querySelectorAll('.daftar-baris-judul')].map((x) => x.textContent) : [],
    rutinTampak: det ? tampak(det.querySelector('.daftar')) : false,
    kosong: (sek.querySelector('.perhatian-kosong') || {}).textContent || '',
    kotakKosong: /Tidak ada yang perlu perhatian/.test((sek.querySelector('.kosong') || {}).textContent || '')
  };
});
const d0 = A('dashboard', { tanggal: hariIni }).data;
const jenis = d0.perhatian.map((p) => p.jenis);
const RUTIN = ['belumDiperiksa', 'opname', 'hargaBeli', 'menu', 'tanpaHarga'];
cek(jenis.some((j) => RUTIN.includes(j)) && jenis.some((j) => !RUTIN.includes(j)), 'data uji punya dua kelompok', jenis);

// A. Bawaan: Hari ini terbuka, Rutin terlipat; dibuka diingat.
{
  const { ctx, page } = await buka(390, 844, 'Budi', { rute: '#/dashboard' });
  await page.waitForTimeout(1200);
  const v = await lihat(page);
  const nRutin = jenis.filter((j) => RUTIN.includes(j)).length;
  cek(v.judul[0] === 'Hari ini' && v.hariIni.length === jenis.length - nRutin, 'Hari ini berisi butir mendesak', v);
  cek(v.adaRutin && v.buka === false && !v.rutinTampak && new RegExp('Rutin\\s*' + nRutin + ' butir').test(v.ringkas) && v.rutin.length === nRutin, 'Rutin terlipat', v);
  cek(/Pemeriksaan isian, stock opname, harga, dan menu/.test(v.ringkas), 'keterangan Rutin');
  cek(v.rutin.every((t) => !/stock akhir minus|di luar standar/.test(t)), 'tidak ada butir mendesak di Rutin', v.rutin);
  await page.locator('details.perhatian-rutin > summary').click();
  await page.waitForTimeout(300);
  cek((await lihat(page)).rutinTampak, 'dibuka');
  await page.reload();
  await page.waitForTimeout(2000);
  const v2 = await lihat(page);
  cek(v2.buka === true && v2.rutinTampak, 'terbuka diingat sesudah dimuat ulang', v2);
  // Papan ketik: Enter pada ringkasan menutup.
  await page.locator('details.perhatian-rutin > summary').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  cek((await lihat(page)).buka === false, 'Enter menutup');
  // Butir Rutin tetap bisa diketuk: belum diperiksa → Riwayat.
  await page.locator('details.perhatian-rutin > summary').click();
  await page.waitForTimeout(200);
  const bd = page.locator('details.perhatian-rutin .daftar-baris', { hasText: 'belum diperiksa' }).first();
  if (await bd.count()) {
    await bd.click();
    await page.waitForTimeout(1200);
    cek(/#\/riwayat/.test(page.url()), 'butir Rutin membuka Riwayat', page.url());
  }
  await ctx.close();
}
// B. Hanya Rutin: kalimat kosong dan Rutin terbuka.
{
  const { ctx, page } = await buka(390, 844, 'Budi', { rute: '#/dashboard', ubah: (d) => { d.perhatian = d.perhatian.filter((p) => RUTIN.includes(p.jenis)); } });
  await page.waitForTimeout(1200);
  const v = await lihat(page);
  cek(v.kosong === 'Tidak ada yang mendesak hari ini.' && v.buka === true && v.rutinTampak, 'hanya Rutin: terbuka', v);
  await ctx.close();
}
// C. Hanya Hari ini, jenis baru masuk Hari ini.
{
  const { ctx, page } = await buka(390, 844, 'Budi', { rute: '#/dashboard', ubah: (d) => {
    d.perhatian = d.perhatian.filter((p) => !RUTIN.includes(p.jenis)).concat([{ jenis: 'jenisBaru', tingkat: 'tinjau', judul: 'Butir jenis baru', ket: '' }]);
  } });
  await page.waitForTimeout(1200);
  const v = await lihat(page);
  cek(!v.adaRutin && v.hariIni.some((t) => /Butir jenis baru/.test(t)), 'hanya Hari ini; jenis baru di Hari ini', v);
  await ctx.close();
}
// D. Kosong.
{
  const { ctx, page } = await buka(390, 844, 'Budi', { rute: '#/dashboard', ubah: (d) => { d.perhatian = []; } });
  await page.waitForTimeout(1200);
  const v = await lihat(page);
  cek(v.kotakKosong && !v.judul.length, 'kosong seperti dulu', v);
  await ctx.close();
}
// E. Delapan ukuran, Rutin terbuka.
for (const [w, hh] of [[320, 568], [360, 740], [390, 844], [430, 932], [768, 1024], [1024, 768], [1366, 768], [1920, 1080]]) {
  const x = await buka(w, hh, 'Budi', { rute: '#/dashboard' });
  await x.page.waitForTimeout(1200);
  await x.page.evaluate(() => { const d = document.querySelector('details.perhatian-rutin'); if (d) d.open = true; });
  await x.page.waitForTimeout(200);
  const m = await x.page.evaluate(() => {
    const lebar = document.documentElement.scrollWidth;
    const sek = document.querySelector('.dashboard-perhatian');
    const keluar = [...sek.querySelectorAll('*')].filter((e) => { const b = e.getBoundingClientRect(); return b.width && (b.right > innerWidth + 1 || b.left < -1); }).map((e) => e.className).slice(0, 3);
    const s = sek.querySelector('details > summary');
    return { lebar, keluar, tinggi: s ? s.getBoundingClientRect().height : 99 };
  });
  cek(m.lebar <= w && !m.keluar.length && m.tinggi >= 44, `ukuran ${w}x${hh}`, m);
  await x.ctx.close();
}
console.log('lulus', lulus, 'gagal', gagal, 'galat konsol', galat, 'ERR log', H.logs.filter((l) => l.startsWith('ERR')));
await browser.close();
srv.close();
