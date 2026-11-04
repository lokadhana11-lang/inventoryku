// Uji Chromium: tata letak ringkas (aplikasi 0.46.0, butir 451–454). Kepala navy ringkas kecuali Beranda dan Dashboard,
// satu garis kiri di desktop (merek, judul, isi, panel Pengaturan), bar menu bawah tidak tampil di layar isian dan layar
// dalam (HP dan tablet), kotak info form: ringkasan dengan Ubah di HP, tiga kolom di desktop. Delapan ukuran dan gerak.
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
  await page.getByRole('button', { name: new RegExp(opsi.nama || 'Budi') }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type(opsi.pin || '482915', { delay: 30 });
  await page.waitForTimeout(1500);
  return { ctx, page };
}
const ke = async (page, hash) => { await page.evaluate((x) => { location.hash = x; }, hash); await page.waitForTimeout(1400); };

/** Ukuran kepala, menu, garis kiri, dan kotak info layar yang sedang tampil. */
const ukur = (page) => page.evaluate(() => {
  const kotak = (s) => { const e = typeof s === 'string' ? document.querySelector(s) : s; if (!e) return null; const b = e.getBoundingClientRect();
    return { kiri: Math.round(b.left), kanan: Math.round(b.right), atas: Math.round(b.top), bawah: Math.round(b.bottom), tinggi: Math.round(b.height), lebar: Math.round(b.width) }; };
  const tampil = (s) => { const e = document.querySelector(s); return !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'; };
  const kepala = document.querySelector('#layar .kepala-layar');
  const pertama = document.querySelector('#layar .panel-samping') ||
    [...document.querySelectorAll('#layar .layar-isi > *')].find((e) => e.getClientRects().length && !e.matches('.catatan-draft, .memperbarui, .judul-layar, .tautan-kembali'));
  // Bagian kepala navy tidak keluar layar (deret pilihan dan tabel lebar punya wadah gulir sendiri, jadi tidak dihitung).
  const keluar = [...document.querySelectorAll('#layar .kepala-layar *')].filter((e) => { const b = e.getBoundingClientRect(); return b.width && (b.right > innerWidth + 1 || b.left < -1); })
    .map((e) => e.tagName + '.' + e.className).slice(0, 5);
  return {
    kepala: kotak(kepala),
    gantung: !!kepala && kepala.classList.contains('gantung'),
    satuBaris: !!document.querySelector('#layar .kepala-layar-atas.tanpa-kembali .judul-layar, #layar .kepala-layar-atas.tanpa-kembali .kepala-isi'),
    judul: kotak('#layar .kepala-layar .judul-layar'),
    sinyal: kotak('#layar .kepala-layar .sinyal'),
    kembali: !!document.querySelector('#layar .kepala-layar .tautan-kembali'),
    menu: tampil('#menu-grup'),
    tanpaMenu: document.documentElement.classList.contains('tanpa-menu-bawah'),
    pil: (() => { const p = document.querySelector('.menu-pil'); return p ? { terlihat: p.classList.contains('terlihat'), lebar: parseFloat(p.style.width) || 0 } : null; })(),
    merek: kotak('.merek'),
    tanggalBeranda: kotak('#layar .beranda-tanggal'),
    pertama: kotak(pertama),
    bilah: kotak('#layar .bilah-kirim'),
    tinggi: innerHeight,
    gulirSamping: document.documentElement.scrollWidth - innerWidth,
    keluar
  };
});

const LAYAR_UTAMA = ['#/', '#/riwayat', '#/laporan', '#/dashboard', '#/pengaturan'];
const LAYAR_DALAM = ['#/stock', '#/waste', '#/suhu', '#/prep', '#/pengaturan/item', '#/opname'];

// A. Delapan ukuran: kepala, menu bawah, garis kiri, tanpa gulir ke samping.
for (const [w, h] of [[320, 568], [360, 740], [390, 844], [430, 932], [768, 1024], [1024, 768], [1366, 768], [1920, 1080]]) {
  const { ctx, page } = await buka(w, h);
  const desktop = w >= 1024;
  for (const r of LAYAR_UTAMA.concat(LAYAR_DALAM)) {
    await ke(page, r);
    const m = await ukur(page);
    const dalam = LAYAR_DALAM.includes(r);
    cek(m.gulirSamping <= 0 && !m.keluar.length, `${w}: ${r} tanpa gulir ke samping`, m);
    // Menu: desktop selalu di bar atas (kelasnya tetap dipasang, supaya jendela yang dikecilkan ikut benar);
    // HP dan tablet tidak tampil di layar dalam.
    cek(m.tanpaMenu === dalam && (desktop ? m.menu : m.menu === !dalam), `${w}: ${r} menu ${desktop || !dalam ? 'tampil' : 'tidak tampil'}`, m);
    if (r === '#/') { cek(!m.kepala, `${w}: Beranda tanpa kepala layar`); continue; }
    if (r === '#/dashboard') { cek(m.gantung && !m.satuBaris, `${w}: Dashboard tetap kepala gantung`, m); continue; }
    // Kepala ringkas: satu baris (judul dan Online) tanpa tautan kembali; dua baris dengan tautan kembali.
    cek(m.kembali === dalam, `${w}: ${r} tautan kembali`, m);
    if (!dalam) {
      cek(m.satuBaris, `${w}: ${r} judul dan Online satu baris`, m);
      if (!desktop) cek(m.sinyal && Math.abs((m.judul.atas + m.judul.bawah) / 2 - (m.sinyal.atas + m.sinyal.bawah) / 2) <= 3, `${w}: ${r} Online sebaris judul`, m);
    }
    const batas = r === '#/pengaturan/item' ? 130 : (dalam ? 104 : 72);
    cek(m.kepala && m.kepala.tinggi <= batas, `${w}: ${r} tinggi kepala ≤ ${batas} px`, m.kepala);
    // Satu garis kiri di desktop: merek, judul, dan isi pertama (atau panel Pengaturan) mulai di x yang sama.
    if (desktop) {
      cek(Math.abs(m.judul.kiri - m.merek.kiri) <= 1 && Math.abs(m.pertama.kiri - m.merek.kiri) <= 1, `${w}: ${r} satu garis kiri`,
        { merek: m.merek.kiri, judul: m.judul.kiri, isi: m.pertama });
    }
  }
  if (desktop) {
    await ke(page, '#/');
    const b = await ukur(page);
    cek(Math.abs(b.tanggalBeranda.kiri - b.merek.kiri) <= 1, `${w}: Beranda sejajar merek`, { merek: b.merek, tanggal: b.tanggalBeranda });
  }
  // Bilah Kirim Stock: di HP dan tablet mengambang 8 px dari bawah (tanpa bar menu); di desktop menempel di bawah.
  await ke(page, '#/stock');
  const s = await ukur(page);
  const jarakBawah = s.tinggi - s.bilah.bawah;
  cek(desktop ? jarakBawah === 0 : jarakBawah === 8, `${w}: bilah Kirim ${desktop ? 'menempel di bawah' : '8 px dari bawah'}`, { jarakBawah, bilah: s.bilah });
  // Di laptop, baris item pertama Stock tampil di layar pertama (tidak tertutup bilah Kirim).
  if (desktop) {
    const baris = await page.locator('#layar .tabel-stock tbody tr').first().boundingBox();
    cek(baris && baris.y + 40 <= s.bilah.atas, `${w}: baris item pertama Stock terlihat tanpa digulir`, { baris, bilah: s.bilah });
  }
  await ctx.close();
}

// B. HP: kotak info Stock dilipat menjadi ringkasan dengan Ubah.
{
  const { ctx, page } = await buka(390, 844);
  await ke(page, '#/stock');
  const ringkas = page.locator('#layar .kotak-ringkas-teks');
  const ubah = page.locator('#layar .kotak-ringkas-tombol');
  const fieldTanggal = page.locator('#layar .kotak-info fieldset', { has: page.locator('legend', { hasText: 'Tanggal' }) });
  cek(rapi(await ringkas.innerText()) === 'Hari ini · Semua kategori · Tambah keluar', 'ringkasan awal', await ringkas.innerText());
  cek(await page.locator('#layar .kotak-ringkas-teks strong').innerText() === 'Hari ini', 'tanggal ditebalkan');
  cek(await ubah.getAttribute('aria-expanded') === 'false' && rapi(await ubah.innerText()) === 'Ubah', 'tombol Ubah tertutup');
  cek(!(await fieldTanggal.isVisible()) && !(await page.locator('#pilih-kategori').isVisible()) && !(await page.locator('#pilih-pemasok').isVisible()),
    'Tanggal, Kategori, Pemasok terlipat');
  cek(await page.locator('#cari-item-stock').isVisible() && await page.locator('#layar .kotak-info .status-form').isVisible(), 'Cari item dan status tetap tampil');
  const t = await ubah.boundingBox();
  cek(t.height >= 44, 'Ubah setinggi 44 px', t);
  const kendali = (await ubah.getAttribute('aria-controls')).split(' ');
  cek(kendali.length === 4 && (await page.evaluate((ids) => ids.every((i) => !!document.getElementById(i)), kendali)), 'aria-controls menunjuk empat kolom', kendali);

  // Kotak info di HP jauh lebih pendek: item pertama tampil di layar pertama.
  const kotakTinggi = await page.locator('#layar .kotak-info').evaluate((e) => e.getBoundingClientRect().height);
  cek(kotakTinggi <= 240, 'kotak info terlipat ≤ 240 px', kotakTinggi);

  await ubah.click();
  await page.waitForTimeout(200);
  cek(await ubah.getAttribute('aria-expanded') === 'true' && rapi(await ubah.innerText()) === 'Tutup', 'tombol jadi Tutup');
  cek(await fieldTanggal.isVisible() && await page.locator('#pilih-kategori').isVisible() && await page.locator('#pilih-pemasok').isVisible(), 'kolom terbuka');
  await fieldTanggal.getByText('Kemarin', { exact: true }).click();
  await page.waitForTimeout(1500);
  await page.locator('#pilih-kategori').selectOption('Protein');
  await page.waitForTimeout(300);
  await page.locator('#pilih-pemasok').selectOption({ label: 'Toko Ayam Jaya' });
  await page.waitForTimeout(300);
  cek(rapi(await ringkas.innerText()) === 'Kemarin · Protein · Tambah keluar · Toko Ayam Jaya', 'ringkasan ikut berubah', await ringkas.innerText());
  await ubah.click();
  await page.waitForTimeout(200);
  cek(!(await fieldTanggal.isVisible()) && await ubah.getAttribute('aria-expanded') === 'false', 'Tutup melipat lagi');

  // Draft menyimpan pilihan; saat dibuka lagi ringkasannya dibaca dari kolom.
  await ke(page, '#/');
  await ke(page, '#/stock');
  cek(rapi(await page.locator('#layar .kotak-ringkas-teks').innerText()) === 'Kemarin · Protein · Tambah keluar · Toko Ayam Jaya', 'ringkasan dari draft',
    await page.locator('#layar .kotak-ringkas-teks').innerText());
  await ctx.close();
}

// C. HP: form lain hanya melipat Tanggal; Shift tetap tampil.
{
  const { ctx, page } = await buka(390, 844);
  for (const [r, lain] of [['#/waste', 'Shift'], ['#/prep', 'Shift'], ['#/suhu', null]]) {
    await ke(page, r);
    cek(rapi(await page.locator('#layar .kotak-ringkas-teks').innerText()) === 'Tanggal: Hari ini', `${r}: ringkasan Tanggal`,
      await page.locator('#layar .kotak-ringkas-teks').innerText());
    const tgl = page.locator('#layar .kotak-info fieldset', { has: page.locator('legend', { hasText: 'Tanggal' }) });
    cek(!(await tgl.isVisible()), `${r}: Tanggal terlipat`);
    if (lain) cek(await page.locator('#layar .kotak-info fieldset', { has: page.locator('legend', { hasText: lain }) }).isVisible(), `${r}: ${lain} tetap tampil`);
    await page.locator('#layar .kotak-ringkas-tombol').click();
    await page.waitForTimeout(200);
    cek(await tgl.isVisible(), `${r}: Ubah membuka Tanggal`);
  }
  await ctx.close();
}

// D. Tablet dan desktop: tidak ada yang dilipat; desktop tiga kolom dengan status sejajar kotak isian.
for (const [w, h] of [[768, 1024], [1024, 768], [1366, 768]]) {
  const { ctx, page } = await buka(w, h);
  await ke(page, '#/stock');
  cek(!(await page.locator('#layar .kotak-ringkas').isVisible()) && await page.locator('#pilih-kategori').isVisible(), `${w}: tanpa ringkasan, kolom tampil`);
  const sel = await page.evaluate(() => [...document.querySelectorAll('#layar .kotak-info > :not(.kotak-ringkas)')].filter((e) => e.getClientRects().length)
    .map((e) => { const b = e.getBoundingClientRect(); const k = e.querySelector('.pilihan span, select, input:not([type="radio"]), .status-form');
      return { kelas: e.className, kiri: Math.round(b.left), atas: Math.round(b.top), kendali: k ? Math.round(k.getBoundingClientRect().top) : null,
        kendaliTinggi: k ? Math.round(k.getBoundingClientRect().height) : 0 }; }));
  const kolom = new Set(sel.map((s) => s.kiri)).size;
  if (w >= 1024) {
    cek(kolom === 3 && sel[0].atas === sel[1].atas && sel[1].atas === sel[2].atas, `${w}: tiga kolom, Tanggal-Kategori-Cari sebaris`, sel);
    // Status kiriman di sel ketiga baris kedua, tengahnya sejajar tombol dan kotak isian di baris itu (tingginya 48 px).
    const st = sel.find((s) => /lebar-penuh/.test(s.kelas));
    const sebaris = sel.filter((s) => s !== st && s.kendali !== null).sort((a, b) => Math.abs(a.kendali - st.kendali) - Math.abs(b.kendali - st.kendali))[0];
    cek(st && sebaris && sebaris.atas > sel[0].atas && Math.abs((st.kendali + st.kendaliTinggi / 2) - (sebaris.kendali + 24)) <= 4,
      `${w}: status sejajar kotak isian`, { st, sebaris });
  } else {
    cek(kolom === 2, `${w}: dua kolom`, sel);
  }
  await ctx.close();
}

// E. Menu kembali tampil setelah layar dalam, dengan penanda di menu aktif; Pengelola dan Staff.
for (const [nama, pin] of [['Budi', '482915'], ['Rina', '730264']]) {
  const { ctx, page } = await buka(390, 844, { nama, pin });
  await page.locator('#layar .tiket[data-form="STOCK"]').click();
  await page.waitForTimeout(1400);
  let m = await ukur(page);
  cek(!m.menu && m.tanpaMenu, `${nama}: menu tidak tampil di Stock`, m);
  await page.locator('#layar .kepala-layar .tautan-kembali').click();
  await page.waitForTimeout(1400);
  m = await ukur(page);
  cek(m.menu && !m.tanpaMenu && m.pil && m.pil.terlihat && m.pil.lebar > 40, `${nama}: menu tampil lagi dengan penanda`, m);
  await page.locator('#menu-grup a[data-menu="riwayat"]').click();
  await page.waitForTimeout(1400);
  m = await ukur(page);
  cek(m.menu && m.satuBaris && m.kepala.tinggi <= 72, `${nama}: Riwayat satu baris, menu tampil`, m);
  await ctx.close();
}

// F. Keluar dari layar dalam: menu tampil lagi setelah masuk.
{
  const { ctx, page } = await buka(390, 844);
  await ke(page, '#/stock');
  await page.evaluate(() => { location.hash = '#/'; });
  await page.waitForTimeout(800);
  cek(!(await page.evaluate(() => document.documentElement.classList.contains('tanpa-menu-bawah'))), 'Beranda: kelas tanpa menu dilepas');
  await ctx.close();
}

// G. Gerak menyala: pindah layar tanpa galat, menu tetap benar.
{
  const { ctx, page } = await buka(390, 844, { gerak: true });
  await ke(page, '#/stock');
  await ke(page, '#/');
  const m = await ukur(page);
  cek(m.menu && m.pil && m.pil.terlihat, 'gerak: menu tampil di Beranda', m);
  await ctx.close();
}

if (process.env.GAMBAR) {
  for (const [w, h] of [[390, 844], [1366, 768]]) {
    const { ctx, page } = await buka(w, h);
    for (const r of ['#/stock', '#/laporan', '#/pengaturan/item']) {
      await ke(page, r);
      await page.screenshot({ path: process.env.GAMBAR + '/desain-' + w + '-' + r.replace(/[#/]+/g, '-').replace(/^-|-$/g, '') + '.png' });
    }
    await ctx.close();
  }
}

console.log('lulus', lulus, 'gagal', gagal, 'galat konsol', galat, 'ERR log', H.logs.filter((l) => l.startsWith('ERR')));
await browser.close();
srv.close();
