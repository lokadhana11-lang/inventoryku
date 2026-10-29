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
    let out;
    if (false) out = null;
    else out = H.aksi(body);
    if (opsi.serverLama && out.ok && out.data) {
      const buang = (o) => { if (o && typeof o === 'object') { delete o.pengingatClosingMenit; delete o.pengingatClosing; } };
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
  await page.keyboard.type({ Budi: '482915', Rina: '730264', Sari: '916205' }[siapa], { delay: 30 });
  await page.waitForTimeout(1500);
  if (opsi.rute) {
    await page.evaluate((r) => { location.hash = r; }, opsi.rute);
    await page.waitForTimeout(1500);
  }
  return { ctx, page, permintaan };
}
const lembar = (page) => page.locator('.lembar');
const konf = (k) => { const r = H.ss.getSheetByName('M_Konfigurasi').getDataRange().getValues().find((x) => x[0] === k); return r ? String(r[1]) : null; };
const kartu = (page) => page.locator('section.kartu', { has: page.getByRole('heading', { name: 'Pengingat sebelum closing' }) });

// A. Outlet dan jadwal: kartu, pilihan, jam ikut jam closing, simpan
{
  const { ctx, page, permintaan } = await buka(390, 844, 'Budi', { rute: '#/pengaturan/outlet' });
  const K = kartu(page);
  cek(await K.count() === 1, 'kartu Pengingat sebelum closing');
  const r = K.locator('input[type=radio]');
  cek(await r.count() === 4, 'empat pilihan');
  cek(await K.getByLabel('30 menit').isChecked(), '30 menit terpilih awal');
  const bantu = () => K.locator('.kolom-bantuan[aria-live]').innerText();
  cek(/sekitar pukul 21\.00\./.test(await bantu()), 'bantuan 21.00', await bantu());
  await page.getByLabel('Jam closing').fill('22:00');
  await page.waitForTimeout(150);
  cek(/sekitar pukul 21\.30\./.test(await bantu()), 'ikut jam closing 21.30', await bantu());
  await K.getByText('60 menit').click();
  await page.waitForTimeout(150);
  cek(/sekitar pukul 21\.00\./.test(await bantu()), '60 menit → 21.00', await bantu());
  await page.getByRole('button', { name: 'Simpan' }).click();
  await page.waitForTimeout(1200);
  const kirim = permintaan.filter((b) => b.action === 'simpanOutletJadwal').pop();
  cek(kirim && kirim.pengingatClosingMenit === 60 && kirim.jamClosing === '22:00', 'yang dikirim', kirim);
  cek(konf('pengingat_closing_menit') === '60' && konf('jam_closing') === '22:00', 'tersimpan di M_Konfigurasi', [konf('pengingat_closing_menit'), konf('jam_closing')]);
  cek(await kartu(page).getByLabel('60 menit').isChecked(), 'digambar ulang 60');
  await kartu(page).getByText('Mati').click();
  await page.waitForTimeout(150);
  cek(/sedang dimatikan/.test(await kartu(page).locator('.kolom-bantuan[aria-live]').innerText()), 'Mati: bantuan dimatikan');
  await page.getByRole('button', { name: 'Simpan' }).click();
  await page.waitForTimeout(1200);
  cek(konf('pengingat_closing_menit') === '0', 'Mati tersimpan 0', konf('pengingat_closing_menit'));
  A('simpanOutletJadwal', { jamClosing: '21:30', pengingatClosingMenit: 30 });
  await ctx.close();
}

// B. Server lama: kartu tidak tampil, field tidak dikirim
{
  const { ctx, page, permintaan } = await buka(390, 844, 'Budi', { rute: '#/pengaturan/outlet', serverLama: true });
  cek(await kartu(page).count() === 0, 'server lama: tanpa kartu');
  await page.getByLabel('Jeda laporan setelah closing (menit)').fill('50');
  await page.getByRole('button', { name: 'Simpan' }).click();
  await page.waitForTimeout(1200);
  const kirim = permintaan.filter((b) => b.action === 'simpanOutletJadwal').pop();
  cek(kirim && !('pengingatClosingMenit' in kirim) && kirim.jedaLaporanMenit === '50', 'server lama: field tidak dikirim', kirim);
  A('simpanOutletJadwal', { jedaLaporanMenit: 45 });
  await ctx.close();
}

// C. Lembar Notifikasi
{
  H.opsiUji.vapid = 'BPx' + 'A'.repeat(84);
  for (const siapa of ['Rina', 'Budi']) {
    const { ctx, page } = await buka(390, 844, siapa, { sw: true });
    await page.locator('.beranda-kepala button[aria-haspopup="menu"], button.pengguna-tombol').first().click().catch(() => {});
    await page.waitForTimeout(300);
    const item = page.getByRole('menuitem', { name: 'Notifikasi' });
    if (await item.count()) {
      await item.click();
      await page.waitForTimeout(2500);
      const t = await lembar(page).innerText().catch(() => '');
      cek(/Pengingat sebelum closing \(21\.00\), jika masih ada form yang belum lengkap, kecuali hari libur/.test(t), 'lembar Notifikasi ' + siapa, t.slice(0, 500));
    } else cek(false, 'menu Notifikasi ' + siapa);
    await ctx.close();
  }
  A('simpanOutletJadwal', { pengingatClosingMenit: 0 });
  const { ctx, page } = await buka(390, 844, 'Rina', { sw: true });
  await page.locator('.beranda-kepala button[aria-haspopup="menu"], button.pengguna-tombol').first().click().catch(() => {});
  await page.waitForTimeout(300);
  await page.getByRole('menuitem', { name: 'Notifikasi' }).click().catch(() => {});
  await page.waitForTimeout(2500);
  cek(/Pengingat sebelum closing \(sedang dimatikan\)/.test(await lembar(page).innerText().catch(() => '')), 'lembar Notifikasi: dimatikan');
  A('simpanOutletJadwal', { pengingatClosingMenit: 30 });
  await ctx.close();
}

// D. Delapan ukuran
for (const [w, h] of [[320, 568], [360, 740], [390, 844], [430, 932], [768, 1024], [1024, 768], [1366, 768], [1920, 1080]]) {
  const { ctx, page } = await buka(w, h, 'Budi', { rute: '#/pengaturan/outlet' });
  const m = await page.evaluate(() => {
    const lebar = document.documentElement.scrollWidth;
    const akar = document.querySelector('#layar');
    const kecil = [...akar.querySelectorAll('button, a, input, select')].filter((e) => e.offsetParent && !e.closest('.menu') && e.type !== 'radio')
      .map((e) => [e.textContent.trim().slice(0, 30) || e.tagName, Math.round(e.getBoundingClientRect().height)]).filter((x) => x[1] < 44);
    const keluar = [...akar.querySelectorAll('*')].filter((e) => { const b = e.getBoundingClientRect(); return b.width && (b.right > innerWidth + 1 || b.left < -1); })
      .map((e) => e.className || e.tagName).slice(0, 5);
    const pil = [...document.querySelectorAll('section.kartu')].find((s) => /Pengingat sebelum closing/.test(s.textContent));
    const label = pil ? [...pil.querySelectorAll('label')].filter((l) => l.scrollWidth > l.clientWidth + 1).map((l) => l.textContent) : ['tanpa kartu'];
    return { lebar, kecil, keluar, label };
  });
  cek(m.lebar <= w && !m.kecil.length && !m.keluar.length && !m.label.length, `ukuran ${w}x${h}`, m);
  await ctx.close();
}

console.log('lulus', lulus, 'gagal', gagal, 'galat konsol', galat, 'ERR log', H.logs.filter((l) => l.startsWith('ERR')));
await browser.close();
srv.close();
