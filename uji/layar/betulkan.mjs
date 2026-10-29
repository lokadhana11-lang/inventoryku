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
const TR = H.aksi({ action: 'login', nama: 'Rina', pin: '730264' }).data.token;
const kirimRina = (keluar) => {
  const id = sid();
  const r = H.aksi({ action: 'kirimStock', token: TR, submissionId: id, tanggal: hariIni, kategori: 'Sayur', waktuPerangkat: new Date().toISOString(), baris: [{ item: 'Tomat', masuk: '', keluar }] });
  if (!r.ok) throw new Error(JSON.stringify(r));
  return id;
};

// A. Rina: detail di HP, tanda, petunjuk, Betulkan
{
  const id = kirimRina(10);
  const { ctx, page, permintaan } = await buka(390, 844, 'Rina', { rute: '#/riwayat' });
  const daftar = await page.locator('#layar').innerText();
  cek(/Bisa dibetulkan sampai \d{2}\.\d{2}/.test(daftar), 'tanda di daftar Riwayat', daftar.slice(0, 600));
  await page.evaluate((r) => { location.hash = r; }, '#/riwayat/STOCK/' + id);
  await page.waitForTimeout(1500);
  const isi = await page.locator('#layar').innerText();
  cek(/Salah ketik\? Kamu bisa membetulkan isian ini sampai \d{2}\.\d{2}\. Sesudah itu, laporkan kekeliruan\./.test(isi), 'petunjuk di detail', isi.slice(0, 800));
  const tb = page.getByRole('button', { name: 'Betulkan Tomat' });
  cek(await tb.count() === 1, 'tombol Betulkan Tomat');
  cek(await page.getByRole('button', { name: /^Koreksi/ }).count() === 0, 'tanpa tombol Koreksi');
  await tb.click();
  await page.waitForTimeout(400);
  const L = lembar(page);
  cek(/Betulkan Tomat/.test(await L.innerText()) && /Bisa dibetulkan sampai/.test(await L.innerText()), 'lembar Betulkan', await L.innerText());
  await L.getByLabel(/Tambah keluar|Stock Keluar|Keluar/).first().fill('1');
  await L.getByRole('button', { name: 'Simpan', exact: true }).click();
  await page.waitForTimeout(1500);
  const kor = permintaan.filter((b) => b.action === 'koreksi').pop();
  cek(kor && kor.nilai && Object.values(kor.nilai).includes(1), 'koreksi dikirim', kor);
  cek(/Isian dibetulkan\. Stock dihitung ulang\./.test(await page.locator('.toast').last().innerText().catch(() => '')), 'pesan Isian dibetulkan');
  cek(/Dikoreksi Rina/.test(await page.locator('#layar').innerText()), 'Dikoreksi Rina tampil');
  await ctx.close();
}

// B. Andi (Staff lain): tanpa Betulkan; Budi: Koreksi
{
  const id = kirimRina(2);
  const a = await buka(390, 844, 'Andi', { rute: '#/riwayat/STOCK/' + id });
  cek(await a.page.getByRole('button', { name: /^Betulkan/ }).count() === 0 && !/Salah ketik/.test(await a.page.locator('#layar').innerText()), 'Andi: tanpa Betulkan');
  await a.ctx.close();
  const b = await buka(390, 844, 'Budi', { rute: '#/riwayat/STOCK/' + id });
  cek(await b.page.getByRole('button', { name: 'Koreksi Tomat' }).count() === 1 && await b.page.getByRole('button', { name: /^Betulkan/ }).count() === 0, 'Budi: Koreksi');
  await b.ctx.close();
}

// C. Lewat 15 menit: tanpa Betulkan
{
  const id = kirimRina(3);
  H.aturGeser(16 * 60000);
  const { ctx, page } = await buka(390, 844, 'Rina', { rute: '#/riwayat/STOCK/' + id });
  cek(await page.getByRole('button', { name: /^Betulkan/ }).count() === 0 && !/Bisa dibetulkan/.test(await page.locator('#layar').innerText()), 'lewat 15 menit: tanpa Betulkan');
  await ctx.close();
  H.aturGeser(0);
}

// D. Batas lewat saat layar terbuka: server menolak dengan pesan di lembar
{
  const id = kirimRina(4);
  const { ctx, page } = await buka(390, 844, 'Rina', { rute: '#/riwayat/STOCK/' + id });
  await page.getByRole('button', { name: 'Betulkan Tomat' }).click();
  await page.waitForTimeout(400);
  H.aturGeser(16 * 60000);
  const L = lembar(page);
  await L.getByLabel(/Tambah keluar|Stock Keluar|Keluar/).first().fill('1');
  await L.getByRole('button', { name: 'Simpan', exact: true }).click();
  await page.waitForTimeout(1200);
  cek(/lebih dari 15 menit lalu, jadi tidak bisa dibetulkan lagi/.test(await L.innerText()), 'penolakan server di lembar', await L.innerText());
  H.aturGeser(0);
  await ctx.close();
}

// D2. Pengelola menandai diperiksa dari layar lama sesudah Rina membetulkan
{
  const id = kirimRina(6);
  const { ctx, page, permintaan } = await buka(390, 844, 'Budi', { rute: '#/riwayat/STOCK/' + id });
  const kr = H.aksi({ action: 'riwayat', token: TR, formId: 'STOCK', dari: hariIni, sampai: hariIni, tampilan: 'catatan' }).data.kiriman.find((k) => k.id === id);
  const kb = H.aksi({ action: 'koreksi', token: TR, formId: 'STOCK', rowId: kr.baris[0].rowId, nilai: { keluar: 0.5 } });
  cek(kb.ok, 'Rina membetulkan lewat API', kb);
  await page.getByRole('button', { name: 'Tandai diperiksa' }).click();
  await page.waitForTimeout(1200);
  const tp = permintaan.filter((b) => b.action === 'tandaiDiperiksa').pop();
  cek(tp && tp.terlihat === '', 'tandaiDiperiksa mengirim terlihat', tp);
  cek(/baru saja dibetulkan/.test(await page.locator('.toast').last().innerText().catch(() => '')), 'pesan baru dibetulkan');
  await ctx.close();
}

// E. Desktop dan delapan ukuran
{
  const id = kirimRina(5);
  const { ctx, page } = await buka(1366, 768, 'Rina', { rute: '#/riwayat/STOCK/' + id });
  cek(await page.getByRole('button', { name: 'Betulkan Tomat' }).count() === 1, 'desktop: Betulkan di detail');
  await ctx.close();
  for (const [w, h] of [[320, 568], [360, 740], [390, 844], [430, 932], [768, 1024], [1024, 768], [1366, 768], [1920, 1080]]) {
    const x = await buka(w, h, 'Rina', { rute: '#/riwayat/STOCK/' + id });
    const m = await x.page.evaluate(() => {
      const lebar = document.documentElement.scrollWidth;
      const akar = document.querySelector('#layar');
      const kecil = [...akar.querySelectorAll('button, a, input, select')].filter((e) => e.offsetParent && !e.closest('.menu') && e.type !== 'radio')
        .map((e) => [e.textContent.trim().slice(0, 30) || e.tagName, Math.round(e.getBoundingClientRect().height)]).filter((y) => y[1] < 44);
      const keluar = [...akar.querySelectorAll('*')].filter((e) => { if (e.closest('.tabel-bingkai')) return false; const b = e.getBoundingClientRect(); return b.width && (b.right > innerWidth + 1 || b.left < -1); })
        .map((e) => e.className || e.tagName).slice(0, 5);
      return { lebar, kecil, keluar, ada: !!akar.querySelector('[aria-label="Betulkan Tomat"]') };
    });
    cek(m.lebar <= w && !m.kecil.length && !m.keluar.length && m.ada, `ukuran ${w}x${h}`, m);
    await x.ctx.close();
  }
}

console.log('lulus', lulus, 'gagal', gagal, 'galat konsol', galat, 'ERR log', H.logs.filter((l) => l.startsWith('ERR')));
await browser.close();
srv.close();
