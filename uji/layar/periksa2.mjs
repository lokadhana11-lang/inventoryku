// Uji perbaikan sesudah telaah: filter kategori/item, kalimat filter pengisi, simpanan penuh, ukuran tombol.
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';
import { muatChromium } from '../alat/peramban.mjs';
const chromium = await muatChromium();
let gagal = 0, lulus = 0;
const cek = (k, label, x) => { if (k) lulus++; else { gagal++; console.log('GAGAL:', label, x !== undefined ? JSON.stringify(x).slice(0, 400) : ''); } };
const s = seed();
const T = s.token;
const TR = H.aksi({ action: 'login', nama: 'Rina', pin: '730264' }).data.token;
const hari = (n) => new Date(Date.now() + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
// Waste hari ini: Tomat + Cabai merah, baris Cabai dilaporkan keliru
const sidW = crypto.randomUUID();
cek(H.aksi({ action: 'kirimWaste', token: TR, submissionId: sidW, tanggal: hari(0), shift: 'Pagi', waktuPerangkat: new Date().toISOString(), baris: [{ item: 'Tomat', kategori: 'Rusak', qty: 0.2, alasan: '' }, { item: 'Cabai merah', kategori: 'Rusak', qty: 0.1, alasan: '' }] }).ok, 'kirim waste');
const dW = H.aksi({ action: 'detailKiriman', token: T, formId: 'WASTE', submissionId: sidW }).data.kiriman;
const rowCabai = dW.baris.find((b) => JSON.stringify(b.nilai).includes('Cabai')).rowId;
cek(H.aksi({ action: 'laporkanKeliru', token: TR, formId: 'WASTE', rowId: rowCabai, catatan: 'qty salah' }).ok, 'lapor cabai');
// Stock hari ini milik Budi (Bumbu) di samping kiriman Rina, untuk filter pengisi
cek(H.aksi({ action: 'kirimStock', token: TR, submissionId: crypto.randomUUID(), tanggal: hari(0), kategori: 'Protein', waktuPerangkat: new Date().toISOString(), baris: [{ item: 'Ayam fillet', masuk: '', keluar: 1, satuanMasuk: 'dasar' }] }).ok, 'stock rina');
cek(H.aksi({ action: 'kirimStock', token: T, submissionId: crypto.randomUUID(), tanggal: hari(0), kategori: 'Bumbu', waktuPerangkat: new Date().toISOString(), baris: [{ item: 'Bawang putih', masuk: '', keluar: 0.1, satuanMasuk: 'dasar' }] }).ok, 'stock budi');

const srv = H.layani(0); // port kosong mana pun
await new Promise((r) => (srv.listening ? r() : srv.once('listening', r)));
const PORT = srv.address().port;
const browser = await chromium.launch();
const galat = [];
const KUNCI_PILIH = 'inventoryku:p:budi:cache:riwayat-pilihan';

async function buka(w, h, opsi = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'Asia/Jakarta', locale: 'id-ID', serviceWorkers: 'block', reducedMotion: 'reduce' });
  await H.pasangRute(ctx);
  if (opsi.penuh) {
    // localStorage penuh untuk simpanan Riwayat saja (kunci cache:riwayat persis).
    await ctx.addInitScript(() => {
      const asli = Storage.prototype.setItem;
      Storage.prototype.setItem = function (kunci, nilai) {
        if (window.__penuh && /:cache:riwayat$/.test(kunci)) throw new DOMException('penuh', 'QuotaExceededError');
        return asli.call(this, kunci, nilai);
      };
    });
  }
  const page = await ctx.newPage();
  page.on('pageerror', (e) => galat.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') galat.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: /Budi/ }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type('482915', { delay: 30 });
  await page.waitForTimeout(1500);
  return { ctx, page };
}
async function riwayat(page, pilih) {
  await page.evaluate(([k, p]) => {
    localStorage.setItem(k, JSON.stringify({ data: Object.assign({ formId: 'STOCK', tampilan: 'catatan', tanggal: '7 hari terakhir', dari: '', sampai: '', kategori: '', item: '', pengisi: '', status: '' }, p), waktu: Date.now() }));
    if (location.hash === '#/riwayat') location.hash = '#/';
  }, [KUNCI_PILIH, pilih]);
  await page.waitForTimeout(300);
  await page.evaluate(() => { location.hash = '#/riwayat'; });
  await page.waitForTimeout(1800);
}
const tombolPeriksa = (page) => page.locator('.tombol-periksa-tanggal');
const permintaan = (page) => { const r = []; page.on('request', (q) => { const d = q.postData(); if (d && d.includes('tandaiDiperiksaBanyak')) r.push(JSON.parse(d)); }); return r; };

// A. Filter item / kategori: tidak ada tombol; tanpa filter: tombol muncul dengan hitungan benar
{
  const { ctx, page } = await buka(390, 844);
  const req = permintaan(page);
  await riwayat(page, { formId: 'WASTE', item: 'Tomat' });
  cek((await page.locator('.kiriman-baris').count()) > 0, 'filter item: daftar ada');
  cek((await tombolPeriksa(page).count()) === 0, 'filter item Waste: tanpa tombol', await tombolPeriksa(page).allTextContents());
  await riwayat(page, { formId: 'WASTE', kategori: 'Sayur' });
  cek((await page.locator('.kiriman-baris').count()) > 0, 'filter kategori: daftar ada');
  cek((await tombolPeriksa(page).count()) === 0, 'filter kategori Waste: tanpa tombol');
  await riwayat(page, { formId: 'STOCK', item: 'Ayam fillet' });
  cek((await tombolPeriksa(page).count()) === 0, 'filter item Stock: tanpa tombol');
  await riwayat(page, { formId: 'STOCK', kategori: 'Protein' });
  cek((await tombolPeriksa(page).count()) === 0, 'filter kategori Stock: tanpa tombol');
  // Tanpa filter: kiriman Waste hari ini (dilaporkan) tidak dihitung
  await riwayat(page, { formId: 'WASTE', tanggal: 'Satu tanggal', dari: hari(0) });
  cek((await tombolPeriksa(page).count()) === 0, 'Waste hari ini tanpa filter: satu-satunya kiriman dilaporkan, tanpa tombol', await tombolPeriksa(page).allTextContents());
  await riwayat(page, { formId: 'WASTE' });
  const t = await tombolPeriksa(page).allTextContents();
  cek(t.length >= 1 && t.every((x) => /^Tandai diperiksa \(\d+\)$/.test(x.trim())), 'Waste 7 hari tanpa filter: tombol ada', t);
  cek(req.length === 0, 'tidak ada panggilan sekaligus');
  await ctx.close();
}
// B. Filter pengisi: kalimat "yang tampil dengan filter ini"; hanya kiriman Rina yang ditandai
{
  const { ctx, page } = await buka(390, 844);
  const req = permintaan(page);
  await riwayat(page, { formId: 'STOCK', tanggal: 'Satu tanggal', dari: hari(0), pengisi: 'Rina' });
  const tb = tombolPeriksa(page);
  cek((await tb.count()) === 1 && (await tb.textContent()).trim() === 'Tandai diperiksa (1)', 'pengisi Rina: (1)', await tb.allTextContents());
  await tb.click();
  await page.waitForTimeout(400);
  const isi = (await page.locator('[role="dialog"]').innerText()).replace(/\s+/g, ' ');
  cek(/yang tampil dengan filter ini dan belum diperiksa ditandai diperiksa atas nama Budi/.test(isi), 'kalimat filter', isi);
  await page.locator('[role="dialog"]').getByRole('button', { name: 'Tandai diperiksa' }).click();
  await page.waitForTimeout(1200);
  cek(req.length === 1 && req[0].submissionId.length === 1, 'satu id dikirim', req);
  const rw = H.aksi({ action: 'riwayat', token: T, formId: 'STOCK', dari: hari(0), sampai: hari(0), tampilan: 'catatan' }).data;
  const st = rw.kiriman.map((k) => k.oleh + ':' + k.status).sort();
  cek(st.includes('Rina:Diperiksa') && st.includes('Budi:Terkirim'), 'server: Rina diperiksa, Budi tetap', st);
  // Tanpa filter: kalimat biasa
  await riwayat(page, { formId: 'STOCK', tanggal: 'Satu tanggal', dari: hari(0) });
  await tombolPeriksa(page).click();
  await page.waitForTimeout(400);
  const isi2 = (await page.locator('[role="dialog"]').innerText()).replace(/\s+/g, ' ');
  cek(/\d+ Oktober yang belum diperiksa ditandai/.test(isi2) && !/filter/.test(isi2), 'tanpa filter: kalimat biasa', isi2);
  await page.locator('[role="dialog"]').getByRole('button', { name: 'Batal' }).click();
  await page.waitForTimeout(300);
  await ctx.close();
}
// C. Simpanan Riwayat penuh: daftar tetap diperbarui dari memori
{
  const { ctx, page } = await buka(390, 844, { penuh: true });
  await page.evaluate(() => { window.__penuh = true; });
  await riwayat(page, { formId: 'SUHU' });
  const sebelum = await tombolPeriksa(page).count();
  cek(sebelum >= 2, 'suhu: ada tombol', sebelum);
  const g = page.locator('section.kelompok').filter({ has: page.locator('.tombol-periksa-tanggal') }).first();
  const judul = await g.locator('.kelompok-judul').textContent();
  await g.locator('.tombol-periksa-tanggal').click();
  await page.waitForTimeout(300);
  await page.locator('[role="dialog"]').getByRole('button', { name: 'Tandai diperiksa' }).click();
  await page.waitForTimeout(1200);
  cek((await tombolPeriksa(page).count()) === sebelum - 1, 'penuh: tombol berkurang satu', { sebelum, sesudah: await tombolPeriksa(page).count() });
  const g2 = page.locator('section.kelompok').filter({ has: page.locator('.kelompok-judul', { hasText: judul }) }).first();
  const tanda = await g2.locator('.kiriman-baris').allInnerTexts();
  cek(tanda.length > 0 && tanda.every((x) => /Diperiksa/.test(x)), 'penuh: tanda Diperiksa', tanda);
  // Simpanan lama kueri lain: daftar tidak berganti ke kueri lama
  await page.evaluate(() => { window.__penuh = false; });
  await riwayat(page, { formId: 'STOCK' });
  const semuaTanggal = (await page.locator('.kelompok-judul').count());
  await page.evaluate(() => { window.__penuh = true; });
  await riwayat(page, { formId: 'STOCK', tanggal: 'Satu tanggal', dari: hari(-3) });
  cek((await page.locator('.kelompok-judul').count()) === 1, 'satu tanggal: satu kelompok');
  await tombolPeriksa(page).click();
  await page.waitForTimeout(300);
  await page.locator('[role="dialog"]').getByRole('button', { name: 'Tandai diperiksa' }).click();
  await page.waitForTimeout(1200);
  cek((await page.locator('.kelompok-judul').count()) === 1, 'sesudah tandai tetap satu tanggal (bukan kueri lama)', { semuaTanggal, sekarang: await page.locator('.kelompok-judul').count() });
  cek((await tombolPeriksa(page).count()) === 0, 'tombol tanggal itu hilang');
  await ctx.close();
}
// D. Ukuran tombol 48 px / 16 px di 320 dan 1366; desktop: Tandai diperiksa satuan dan Buka kunci masih memperbarui daftar
{
  for (const [w, h] of [[320, 568], [1366, 900]]) {
    const { ctx, page } = await buka(w, h);
    await riwayat(page, { formId: 'PREP' });
    const ukuran = await tombolPeriksa(page).first().evaluate((e) => { const r = e.getBoundingClientRect(); return { t: r.height, f: getComputedStyle(e).fontSize, kanan: r.right, lebar: innerWidth }; });
    cek(ukuran.t >= 48 && ukuran.f === '16px' && ukuran.kanan <= ukuran.lebar, 'ukuran tombol ' + w, ukuran);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    cek(sw <= w, 'tanpa gulir samping ' + w, sw);
    if (w === 1366) {
      const g0 = page.locator('section.kelompok').filter({ has: page.locator('.tombol-periksa-tanggal') }).first();
      const judulG = await g0.locator('.kelompok-judul').textContent();
      const g = page.locator('section.kelompok').filter({ has: page.locator('.kelompok-judul', { hasText: judulG }) }).first();
      const sebelum = await g.locator('.tombol-periksa-tanggal').textContent();
      await g.locator('.kiriman-baris').first().click();
      await page.waitForTimeout(800);
      await page.locator('.detail-kepala').getByRole('button', { name: 'Tandai diperiksa' }).click();
      await page.waitForTimeout(1200);
      const n = (x) => Number((x || '').match(/\((\d+)\)/)?.[1] || 0);
      const sesudahT = await g.locator('.tombol-periksa-tanggal').count() ? await g.locator('.tombol-periksa-tanggal').textContent() : '';
      cek(n(sesudahT) === n(sebelum) - 1, 'satuan di detail: hitungan tombol turun', { sebelum, sesudahT });
      await page.locator('.detail-kepala').getByRole('button', { name: 'Buka kunci' }).click();
      await page.waitForTimeout(400);
      const dlg = page.locator('[role="dialog"]');
      if (await dlg.count()) { await dlg.getByRole('button', { name: /Buka kunci/ }).click(); await page.waitForTimeout(1200); }
      const lagi = await g.locator('.tombol-periksa-tanggal').count() ? await g.locator('.tombol-periksa-tanggal').textContent() : '';
      cek(n(lagi) === n(sebelum), 'Buka kunci: hitungan kembali', { sebelum, lagi });
    }
    await ctx.close();
  }
}
console.log('lulus', lulus, 'gagal', gagal, 'galat konsol', galat);
await browser.close();
srv.close();
