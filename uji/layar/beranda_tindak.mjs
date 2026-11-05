// Uji Chromium: pemberitahuan Beranda dalam satu daftar "Perlu ditindaklanjuti" berikon (aplikasi 0.47.0, butir 456): urutan,
// ubin ikon per tingkat, kata tingkat untuk pembaca layar, tautan, Catat sebagai waste, peringatan sistem, isian di HP, Staff,
// tanpa pemberitahuan, garis kiri (juga 1200 px), delapan ukuran, dan gerak.
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
const rapi = (t) => String(t).replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

/** opsi.ubah(data beranda) mengubah jawaban server; opsi.antrean diisi ke HP sebelum masuk. */
async function buka(w, h, opsi = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'Asia/Jakarta', locale: 'id-ID', serviceWorkers: 'block',
    reducedMotion: opsi.gerak ? 'no-preference' : 'reduce' });
  await ctx.route('https://api.uji/**', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    if (/^kirim/.test(body.action)) { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, pesan: 'Contoh galat.' }) }); return; }
    const out = H.aksi(body);
    if (opsi.ubah && body.action === 'beranda' && out.ok) opsi.ubah(out.data);
    if (opsi.ubah && body.action === 'login' && out.ok && out.data && out.data.beranda) opsi.ubah(out.data.beranda);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
  });
  if (opsi.antrean) {
    await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch (e) { /* abaikan */ } },
      ['inventoryku:p:' + (opsi.nama || 'Budi').toLowerCase() + ':antrean', JSON.stringify(opsi.antrean)]);
  }
  const page = await ctx.newPage();
  page.on('pageerror', (e) => galat.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(m.text())) galat.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: new RegExp(opsi.nama || 'Budi') }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type(opsi.pin || '482915', { delay: 30 });
  await page.waitForTimeout(1800);
  return { ctx, page };
}

const baca = (page) => page.evaluate(() => {
  const bagian = document.querySelector('#layar .beranda-tindak');
  const baris = bagian ? [...bagian.querySelectorAll('.daftar > .daftar-baris')] : [];
  return {
    ada: !!bagian,
    anakBawah: document.querySelector('#layar .beranda-bawah').children.length,
    judul: bagian ? bagian.querySelector('h2').textContent : '',
    namaGrup: bagian ? (() => { const g = bagian.querySelector('.daftar'); return document.getElementById(g.getAttribute('aria-labelledby')).textContent; })() : '',
    baris: baris.map((b) => ({
      tag: b.tagName,
      href: b.getAttribute('href'),
      judul: b.querySelector('.daftar-baris-judul').textContent,
      ket: (b.querySelector('.daftar-baris-ket') || {}).textContent || '',
      ubin: (b.querySelector('.ubin-ikon') || { className: '' }).className,
      tombol: (b.querySelector('.tombol') || { textContent: '' }).textContent.trim()
    }))
  };
});

// A. Pengelola di HP: satu daftar berurutan, ubin ikon menurut tingkat, tautan.
{
  const { ctx, page } = await buka(390, 844);
  const d = await baca(page);
  cek(d.ada && d.anakBawah === 1 && d.judul === 'Perlu ditindaklanjuti' && d.namaGrup === 'Perlu ditindaklanjuti', 'satu bagian Perlu ditindaklanjuti', d);
  const judul = d.baris.map((b) => b.judul);
  cek(JSON.stringify(judul) === JSON.stringify(['Perlu ditinjau: Andi meminta reset PIN', 'Menunggu: ' + judul[1].replace(/^Menunggu: /, ''),
    'Perlu ditinjau: Belum ada stock opname', 'Masalah: Lewat masa simpan', 'Perlu ditinjau: Habis besok']) && /isian belum diperiksa$/.test(judul[1]),
  'urutan dan kata tingkat', judul);
  cek(d.baris.map((b) => b.ubin.replace('ubin-ikon ubin-ikon-', '')).join() === 'tinjau,menunggu,tinjau,masalah,tinjau', 'ubin ikon per tingkat', d.baris.map((b) => b.ubin));
  cek(d.baris[0].href === '#/pengaturan/staff/Andi/pin' && /^#\/riwayat\?form=/.test(d.baris[1].href) && d.baris[2].href === '#/opname', 'tautan', d.baris.map((b) => b.href));
  cek(d.baris[3].tag === 'DIV' && d.baris[3].tombol === 'Catat sebagai waste' && /Sambal dasar: sekitar 8 kg lewat masa simpan/.test(rapi(d.baris[3].ket)), 'masa simpan dengan tombol', d.baris[3]);
  cek(/Diminta .*Ketuk untuk membuat PIN baru\./.test(d.baris[0].ket) && d.baris[2].ket === 'Jadwal mingguan. Ketuk untuk membuka Stock opname.', 'keterangan', d.baris);
  // Tanda status lama (chip) tidak dipakai lagi di daftar ini.
  cek(await page.locator('#layar .beranda-tindak .tanda-status').count() === 0, 'tanpa chip tanda status');
  await page.getByRole('button', { name: 'Catat Sambal dasar sebagai waste' }).click();
  await page.waitForTimeout(1500);
  cek(await page.evaluate(() => location.hash) === '#/waste', 'Catat sebagai waste membuka Waste');
  await page.evaluate(() => { location.hash = '#/'; });
  await page.waitForTimeout(1400);
  await page.locator('#layar .beranda-tindak a[href="#/opname"]').click();
  await page.waitForTimeout(1400);
  cek(await page.evaluate(() => location.hash) === '#/opname', 'baris opname membuka Stock opname');
  await ctx.close();
}

// B. Peringatan sistem dan hari libur besok: masalah tanpa tautan, judul dari awalan pesan.
{
  const besok = await (async () => { const p = await browser.newPage(); const t = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }); await p.close(); return t; })();
  const { ctx, page } = await buka(390, 844, { ubah: (b) => {
    b.peringatanSistem = ['Laporan harian: Gagal mengirim email (contoh).', 'Pesan tanpa awalan'];
    b.liburBesok = { tanggal: besok, keterangan: 'Contoh libur', oleh: 'Budi' };
  } });
  const d = await baca(page);
  const p = d.baris.filter((b) => /perlu perhatian|^Masalah: Perlu perhatian/.test(b.judul));
  cek(p.length === 2 && p[0].judul === 'Masalah: Laporan harian perlu perhatian' && p[0].ket === 'Gagal mengirim email (contoh). Rinciannya di tab M_Konfigurasi.' &&
    p[0].tag === 'DIV' && p[0].ubin === 'ubin-ikon ubin-ikon-masalah', 'peringatan sistem', p);
  cek(p[1].judul === 'Masalah: Perlu perhatian' && p[1].ket === 'Pesan tanpa awalan Rinciannya di tab M_Konfigurasi.', 'peringatan tanpa awalan', p[1]);
  const libur = d.baris.find((b) => b.href === '#/pengaturan/libur');
  cek(libur && libur.judul === 'Menunggu: Besok hari libur' && /^Contoh libur\. Ditandai Budi/.test(libur.ket) && d.baris.indexOf(libur) === 1, 'hari libur di bawah reset PIN', libur);
  await ctx.close();
}

// C. Isian di HP (gagal kirim) di urutan terakhir, membuka lembar isian.
{
  const { ctx, page } = await buka(390, 844, { antrean: [{ id: 'uji-antrean-1', formId: 'WASTE', judul: 'Waste', tanggal: '2026-10-20', status: 'gagal',
    pesan: 'Contoh galat.', aksi: 'kirimWaste', isi: { baris: [] }, dibuat: Date.now() }] });
  const d = await baca(page);
  const akhir = d.baris[d.baris.length - 1];
  cek(akhir.tag === 'BUTTON' && akhir.judul === 'Masalah: 1 isian gagal kirim' && akhir.ubin === 'ubin-ikon ubin-ikon-masalah' &&
    akhir.ket === 'Tersimpan di HP. Ketuk untuk melihat atau mengirim ulang.', 'baris isian di HP', akhir);
  await page.locator('#layar .beranda-tindak button.daftar-baris').click();
  await page.waitForTimeout(500);
  cek(await page.getByRole('dialog').count() === 1 && /Gagal kirim/.test(await page.getByRole('dialog').innerText()), 'lembar isian di HP');
  await ctx.close();
}

// D. Staff: hanya masa simpan; tanpa pemberitahuan: tanpa judul.
{
  const { ctx, page } = await buka(390, 844, { nama: 'Rina', pin: '730264' });
  const d = await baca(page);
  cek(d.ada && d.baris.map((b) => b.judul).join('|') === 'Masalah: Lewat masa simpan|Perlu ditinjau: Habis besok', 'Staff: masa simpan saja', d.baris.map((b) => b.judul));
  await ctx.close();
  const k = await buka(390, 844, { ubah: (b) => {
    b.permintaanReset = []; b.pemeriksaan = null; b.peringatanSistem = []; b.masaSimpan = null; b.opname = null; b.terkunci = [];
    b.liburBesok = null; b.peringatanPemasangan = [];
  } });
  const e = await baca(k.page);
  cek(!e.ada && e.anakBawah === 0, 'tanpa pemberitahuan: tanpa judul dan daftar', e);
  await k.ctx.close();
}

// E. Delapan ukuran (dan 1200 px): tanpa gulir samping, garis kiri sama dengan merek di desktop, tombol ≥ 44 px, tombol di kanan
// mulai 600 px dan di bawah teks (sejajar teks) di HP.
for (const [w, h] of [[320, 568], [360, 740], [390, 844], [430, 932], [768, 1024], [1024, 768], [1200, 800], [1366, 768], [1920, 1080]]) {
  const { ctx, page } = await buka(w, h);
  const m = await page.evaluate(() => {
    const r = (e) => { const b = e.getBoundingClientRect(); return { kiri: Math.round(b.left), kanan: Math.round(b.right), atas: Math.round(b.top), bawah: Math.round(b.bottom), tinggi: Math.round(b.height) }; };
    const daftar = document.querySelector('#layar .beranda-tindak .daftar');
    const aksi = document.querySelector('#layar .baris-tindak-aksi');
    const merek = document.querySelector('.merek');
    return {
      gulir: document.documentElement.scrollWidth - innerWidth,
      daftar: r(daftar),
      judul: r(document.querySelector('#layar .beranda-tindak h2')),
      tiket: r(document.querySelector('#layar .tiket-grid')),
      merek: merek && merek.getClientRects().length ? r(merek) : null,
      baris: [...daftar.children].map((b) => r(b).tinggi),
      tombol: r(aksi.querySelector('.tombol')),
      isi: r(aksi.querySelector('.daftar-baris-isi'))
    };
  });
  cek(m.gulir <= 0 && m.baris.every((t) => t >= 56), `${w}: tanpa gulir samping, baris ≥ 56 px`, m);
  cek(m.tombol.tinggi >= 44 && m.tombol.kanan <= m.daftar.kanan, `${w}: tombol Catat sebagai waste ≥ 44 px di dalam kartu`, m);
  // Teks selalu di samping ubin ikon (tidak turun ke bawahnya, juga di 320 px).
  cek(m.isi.kiri - m.daftar.kiri === 68, `${w}: teks di samping ubin ikon`, { isi: m.isi, daftar: m.daftar });
  cek(w >= 600 ? m.tombol.atas < m.isi.bawah && m.tombol.kiri > m.isi.kiri + 100 : m.tombol.atas >= m.isi.bawah && m.tombol.kiri === m.isi.kiri,
    `${w}: tombol ${w >= 600 ? 'di kanan teks' : 'di bawah teks, sejajar'}`, { tombol: m.tombol, isi: m.isi });
  cek(m.daftar.kiri === m.judul.kiri && m.daftar.kiri === m.tiket.kiri && m.daftar.kanan === m.tiket.kanan, `${w}: daftar sejajar tiket`, m);
  if (w >= 1024) cek(m.merek && m.daftar.kiri === m.merek.kiri, `${w}: daftar di garis kiri merek`, { daftar: m.daftar, merek: m.merek });
  await ctx.close();
}

// F. Gerak menyala.
{
  const { ctx, page } = await buka(390, 844, { gerak: true });
  await page.waitForTimeout(800);
  cek((await baca(page)).baris.length === 5, 'gerak: daftar tampil');
  await ctx.close();
}

if (process.env.GAMBAR) {
  for (const [w, h] of [[390, 844], [1366, 768]]) {
    const { ctx, page } = await buka(w, h);
    await page.mouse.move(1, 1);
    await page.locator('#layar .beranda-bawah').screenshot({ path: process.env.GAMBAR + '/beranda-tindak-' + w + '.png' });
    await ctx.close();
  }
}

console.log('lulus', lulus, 'gagal', gagal, 'galat konsol', galat, 'ERR log', H.logs.filter((l) => l.startsWith('ERR')));
await browser.close();
srv.close();
