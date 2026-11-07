// Uji Chromium: cara membuat resep (Pengaturan → Resep dan lembar di Prep List) dan Tempel resep (aplikasi 0.53.0, Code.gs v0.46):
// HP, desktop, server lama, delapan ukuran (butir 478–481).
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';
import { muatChromium } from '../alat/peramban.mjs';
const chromium = await muatChromium();
let gagal = 0, lulus = 0;
const cek = (k, label, x) => { if (k) lulus++; else { gagal++; console.log('GAGAL:', label, x !== undefined ? JSON.stringify(x).slice(0, 600) : ''); } };
const s = seed();
const T = s.token;
const A = (action, b) => H.aksi(Object.assign({ action, token: T }, b));
const resepServer = (nama) => A('daftarResep', {}).data.resep.find((r) => r.itemHasil === nama);
A('simpanItem', { baru: true, nama: 'Bumbu tabur', kategori: 'Barang jadi', satuan: 'kg' });
A('simpanItem', { baru: true, nama: 'Ayam bumbu', kategori: 'Barang jadi', satuan: 'kg' });

const srv = H.layani(0);
await new Promise((r) => (srv.listening ? r() : srv.once('listening', r)));
const PORT = srv.address().port;
const browser = await chromium.launch();
const galat = [];

async function buka(w, h, siapa, rute, opsi = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'Asia/Jakarta', locale: 'id-ID', serviceWorkers: 'block', reducedMotion: 'reduce' });
  const permintaan = [];
  await ctx.route('https://api.uji/**', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    permintaan.push(body);
    const out = H.aksi(body);
    if (opsi.serverLama && out.ok && out.data) {
      if (body.action === 'daftarResep') {
        delete out.data.langkahSiap;
        out.data.resep.forEach((r) => delete r.langkah);
      }
      if (body.action === 'formPrep') out.data.resep.forEach((r) => delete r.langkah);
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => galat.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(m.text())) galat.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: new RegExp(siapa) }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type({ Budi: '482915', Rina: '730264', Sari: '916205', Andi: '305718' }[siapa], { delay: 30 });
  await page.waitForTimeout(1500);
  await page.evaluate((r) => { location.hash = r; }, rute);
  await page.waitForTimeout(1800);
  return { ctx, page, permintaan };
}
async function tambahPrep(page, nama, cari) {
  await page.getByRole('button', { name: 'Tambah item', exact: true }).first().click();
  await page.waitForTimeout(400);
  const d = page.getByRole('dialog');
  await d.getByLabel('Cari item').fill(cari);
  await d.locator('.daftar-pilih-item button', { has: page.locator('.daftar-baris-judul', { hasText: new RegExp('^' + nama + '$') }) }).click();
  await page.waitForTimeout(400);
}
const LABEL = 'Cara membuat (tidak wajib)';

// A. Pengelola HP: isi cara membuat, draft, simpan, batas
{
  const { ctx, page, permintaan } = await buka(390, 844, 'Budi', '#/pengaturan/resep/Sambal%20dasar');
  const kolom = page.getByLabel(LABEL);
  cek(await kolom.count() === 1 && await kolom.inputValue() === '', 'kolom cara membuat kosong');
  const kartu = page.locator('.kolom', { has: kolom });
  cek(/Satu langkah per baris/.test(await kartu.innerText()) && /Belum ada langkah/.test(await kartu.innerText()), 'bantuan dan penghitung awal');
  await kolom.fill('1. Tumis cabai dan bawang.\n\n2. Blender halus.\n- Masak lagi 5 menit.');
  await page.waitForTimeout(300);
  cek(/3 langkah\./.test(await kartu.innerText()), 'penghitung 3 langkah', await kartu.innerText());
  await page.reload();
  await page.waitForTimeout(2000);
  cek(/Blender halus/.test(await page.getByLabel(LABEL).inputValue()), 'cara membuat tetap di draft sesudah dimuat ulang');
  // Lebih dari 30 langkah: ditolak di HP tanpa permintaan
  const sebelum = permintaan.length;
  await page.getByLabel(LABEL).fill(Array.from({ length: 31 }, (_, i) => 'Langkah ' + (i + 1)).join('\n'));
  await page.getByRole('button', { name: 'Simpan resep' }).click();
  await page.waitForTimeout(500);
  cek(/Paling banyak 30 langkah/.test(await page.locator('.kolom', { has: page.getByLabel(LABEL) }).innerText()) &&
    await page.getByLabel(LABEL).getAttribute('aria-invalid') === 'true' && !permintaan.slice(sebelum).some((x) => x.action === 'simpanResep'), '31 langkah ditolak di HP');
  await page.getByLabel(LABEL).fill('1. Tumis cabai dan bawang.\n\n2. Blender halus.\n- Masak lagi 5 menit.');
  await page.getByRole('button', { name: 'Simpan resep' }).click();
  await page.waitForTimeout(1500);
  const p = permintaan.filter((x) => x.action === 'simpanResep').pop();
  cek(p && JSON.stringify(p.langkah) === '["Tumis cabai dan bawang.","Blender halus.","Masak lagi 5 menit."]', 'simpanResep membawa langkah', p);
  cek(JSON.stringify(resepServer('Sambal dasar').langkah) === '["Tumis cabai dan bawang.","Blender halus.","Masak lagi 5 menit."]', 'langkah tersimpan di server');
  cek(/#\/pengaturan\/resep$/.test(page.url()) && /3 langkah/.test(await page.locator('.daftar-baris', { hasText: 'Sambal dasar' }).innerText()), 'daftar resep menyebut 3 langkah');
  await page.evaluate(() => { location.hash = '#/pengaturan/resep/Sambal%20dasar'; });
  await page.waitForTimeout(1500);
  cek(await page.getByLabel(LABEL).inputValue() === 'Tumis cabai dan bawang.\nBlender halus.\nMasak lagi 5 menit.', 'dibuka lagi: satu langkah per baris tanpa nomor');
  await ctx.close();
}

// B. Staff HP: tombol Cara membuat di Prep List, lembar untuk 1 dan 2 resep
{
  const { ctx, page } = await buka(390, 844, 'Rina', '#/prep');
  await tambahPrep(page, 'Sambal dasar', 'sambal');
  const t = page.getByRole('button', { name: 'Cara membuat Sambal dasar, 3 langkah' });
  cek(await t.count() === 1 && /Cara membuat · 3 langkah/.test(await t.innerText()), 'tombol Cara membuat di kartu');
  cek(await t.evaluate((e) => e.getBoundingClientRect().height) >= 44, 'tombol setinggi 44 px');
  await t.click();
  await page.waitForTimeout(400);
  let d = page.getByRole('dialog', { name: 'Cara membuat Sambal dasar' });
  cek(await d.count() === 1, 'lembar terbuka');
  cek(await d.locator('.cara-membuat-langkah li').count() === 3 && await d.locator('.cara-membuat-langkah li').first().innerText() === 'Tumis cabai dan bawang.', 'tiga langkah bernomor');
  let teks = await d.innerText();
  cek(/Bahan untuk 1 resep/.test(teks) && /Cabai merah 1 kg/.test(teks) && !/Kalikan|kalikan/.test(teks) && /hasil 2 kg/.test(teks) && /masa simpan 3 hari/.test(teks), 'lembar 1 resep', teks);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  cek(await page.getByRole('dialog').count() === 0 && await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('tombol-cara-membuat')), 'Escape menutup, fokus kembali ke tombol');
  await page.locator('.kartu-item', { hasText: 'Sambal dasar' }).locator('label.pilihan', { hasText: /^2$/ }).click();
  await t.click();
  await page.waitForTimeout(400);
  d = page.getByRole('dialog', { name: 'Cara membuat Sambal dasar' });
  teks = await d.innerText();
  cek(/Bahan untuk 2 resep/.test(teks) && /Cabai merah 2 kg/.test(teks) && /Minyak goreng 0,6 liter/.test(teks) && /kalikan 2/.test(teks) && /hasil 4 kg/.test(teks), 'lembar 2 resep', teks);
  await d.getByRole('button', { name: 'Tutup' }).click();
  await page.waitForTimeout(300);
  cek(await page.getByRole('dialog').count() === 0, 'Tutup menutup lembar');
  await ctx.close();
}

// C. Desktop: tombol di tabel Prep List
{
  const { ctx, page } = await buka(1366, 768, 'Rina', '#/prep');
  await tambahPrep(page, 'Sambal dasar', 'sambal');
  const t = page.locator('td.sel-hasil-prep .tombol-cara-membuat');
  cek(await t.count() === 1, 'tombol di kolom Hasil tabel');
  await t.click();
  await page.waitForTimeout(400);
  cek(await page.getByRole('dialog', { name: 'Cara membuat Sambal dasar' }).locator('.cara-membuat-langkah li').count() === 3, 'lembar dari tabel');
  await ctx.close();
}

// D. Tempel resep: pratinjau, satu resep salah, simpan, sisa di kotak tempel
const TEMPEL = [
  'Item hasil\tHasil\tMasa simpan\tBahan\tJumlah\tCatatan\tCara membuat',
  'Bumbu tabur\t0,5 kg\t30\tCabai merah\t0,2 kg\tSimpan tertutup.\t1. Blender semua bahan.',
  '\t\t\tBawang putih\t0,3\t\t2. Simpan berlabel.',
  'Ayam bumbu\t1,1\t\tAyam fillet\t1\t\t"Rendam di chiller 2 jam.\nTiriskan."',
  '\t\t\tBumbu tabur\t0,09\t\t',
  'Sambal dasar\t2,5\t\tCabai merah\t1,2\t\t',
  'Nasi putih\t10\t\tBeras\t1\t\t'
].join('\n');
{
  const { ctx, page, permintaan } = await buka(390, 844, 'Budi', '#/pengaturan/resep');
  const tautan = page.getByRole('link', { name: 'Tempel dari Excel/Sheets' });
  cek(await tautan.count() === 1 && await tautan.isVisible(), 'tautan Tempel dari Excel/Sheets di daftar resep');
  await tautan.click();
  await page.waitForTimeout(1500);
  cek(await page.locator('h1.judul-layar', { hasText: 'Tempel resep' }).count() >= 1 && /resep-tempel$/.test(page.url()), 'layar Tempel resep');
  await page.getByLabel('Tempel baris resep').fill(TEMPEL);
  await page.waitForTimeout(500);
  const baris = page.locator('.tempel-baris');
  cek(await baris.count() === 4, 'empat resep di pratinjau', await baris.count());
  const t0 = await baris.nth(0).innerText();
  cek(/Baris 2–3 · Bumbu tabur/.test(t0) && /0,5 kg · 2 bahan · masa simpan 30 hari · 2 langkah · dengan catatan/.test(t0) && /Cabai merah 0,2 kg, Bawang putih 0,3 kg/.test(t0) && /Resep baru/.test(t0), 'pratinjau Bumbu tabur', t0);
  const t1 = await baris.nth(1).innerText();
  cek(/Ayam bumbu/.test(t1) && /2 langkah/.test(t1) && /Resep baru/.test(t1), 'pratinjau Ayam bumbu (sel berganti baris = 2 langkah)', t1);
  const t2 = await baris.nth(2).innerText();
  cek(/Sambal dasar/.test(t2) && /masa simpan tetap 3 hari/.test(t2) && /Mengganti resep yang ada/.test(t2), 'pratinjau Sambal dasar diganti', t2);
  const t3 = await baris.nth(3).innerText();
  cek(/Nasi putih/.test(t3) && /Bahan Beras belum ada di Item/.test(t3), 'pratinjau Nasi putih salah', t3);
  cek(/3 resep siap, 1 salah\./.test(await page.locator('.bilah-kirim').innerText()), 'penghitung');
  await page.locator('.bilah-kirim').getByRole('button', { name: 'Simpan 3 resep' }).click();
  await page.waitForTimeout(400);
  const dlg = page.getByRole('dialog');
  cek(/1 resep yang salah tidak ikut/.test(await dlg.innerText()) && /2 resep baru langsung aktif/.test(await dlg.innerText()), 'konfirmasi', await dlg.innerText());
  await dlg.getByRole('button', { name: 'Simpan 3 resep' }).click();
  await page.waitForTimeout(1800);
  const p = permintaan.filter((x) => x.action === 'tempelResep').pop();
  cek(p && p.resep.length === 3 && p.resep[2].ganti === true && p.resep[0].ganti === false && p.resep[0].hasil === 0.5, 'tempelResep dikirim', p);
  cek(JSON.stringify(resepServer('Ayam bumbu').langkah) === '["Rendam di chiller 2 jam.","Tiriskan."]' && resepServer('Bumbu tabur').catatan === 'Simpan tertutup.' &&
    resepServer('Sambal dasar').hasil === 2.5 && resepServer('Sambal dasar').masaSimpan === 3, 'resep tersimpan di server');
  const sisa = await page.getByLabel('Tempel baris resep').inputValue();
  cek(sisa === TEMPEL.split('\n')[0] + '\n' + TEMPEL.split('\n').pop(), 'sisa: judul dan resep yang salah', sisa);
  cek(await page.locator('.tempel-baris').count() === 1, 'pratinjau hanya resep yang salah');
  await ctx.close();
}

// E. Server lama: tanpa tautan tempel, tanpa kolom cara membuat, tanpa tombol di Prep List
{
  const opsi = { serverLama: true };
  const a = await buka(390, 844, 'Budi', '#/pengaturan/resep', opsi);
  cek(!(await a.page.getByRole('link', { name: 'Tempel dari Excel/Sheets' }).isVisible()), 'server lama: tautan tempel tersembunyi');
  await a.page.evaluate(() => { location.hash = '#/pengaturan/resep/Sambal%20dasar'; });
  await a.page.waitForTimeout(1500);
  cek(await a.page.getByLabel(LABEL).count() === 0, 'server lama: tanpa kolom cara membuat');
  await a.page.evaluate(() => { location.hash = '#/pengaturan/resep-tempel'; });
  await a.page.waitForTimeout(1500);
  cek(/server masih versi lama/.test(await a.page.locator('.layar-isi').innerText()) && !(await a.page.getByLabel('Tempel baris resep').isVisible()), 'server lama: layar tempel memberi petunjuk');
  await a.ctx.close();
  const b = await buka(390, 844, 'Rina', '#/prep', opsi);
  await tambahPrep(b.page, 'Sambal dasar', 'sambal');
  cek(await b.page.locator('.tombol-cara-membuat').count() === 0, 'server lama: Prep List tanpa tombol');
  await b.ctx.close();
}

// F. Delapan ukuran: lembar dengan langkah panjang, layar tempel dengan pratinjau, dan layar ubah resep
A('simpanResep', { baru: false, itemHasil: 'Sambal dasar', hasil: 2, masaSimpan: '3',
  bahan: [{ item: 'Cabai merah', qty: 1 }, { item: 'Bawang merah', qty: 0.5 }, { item: 'Tomat', qty: 0.5 }, { item: 'Minyak goreng', qty: 0.3 }],
  langkah: ['Panjang' + 'x'.repeat(120) + ' lalu kalimat biasa untuk melihat bungkus baris.', 'Langkah kedua yang biasa saja.'] });
for (const [w, h] of [[320, 568], [360, 740], [390, 844], [430, 932], [768, 1024], [1024, 768], [1366, 768], [1920, 1080]]) {
  for (const rute of ['#/prep', '#/pengaturan/resep-tempel', '#/pengaturan/resep/Sambal%20dasar']) {
    const { ctx, page } = await buka(w, h, rute === '#/prep' ? 'Rina' : 'Budi', rute);
    if (rute === '#/prep') {
      await tambahPrep(page, 'Sambal dasar', 'sambal');
      await page.locator('.tombol-cara-membuat').first().click();
      await page.waitForTimeout(400);
    }
    if (rute === '#/pengaturan/resep-tempel') {
      await page.getByLabel('Tempel baris resep').fill(TEMPEL.replace('Nasi putih\t10\t\tBeras', 'Nasi putih\t10\t\tBahan' + 'x'.repeat(80)));
      await page.waitForTimeout(500);
    }
    const m = await page.evaluate((r) => {
      const lebar = document.documentElement.scrollWidth;
      const akar = r === '#/prep' ? document.querySelector('.lembar') : document.querySelector('.layar-isi');
      const keluar = akar ? [...akar.querySelectorAll('*')].filter((e) => {
        if (e.closest('.tabel-bingkai') || e.closest('textarea')) return false;
        const b = e.getBoundingClientRect();
        return b.width && (b.right > innerWidth + 1 || b.left < -1);
      }).map((e) => e.className).slice(0, 5) : ['tidak ada'];
      const ada = r === '#/prep' ? document.querySelectorAll('.lembar .cara-membuat-langkah li').length === 2
        : r === '#/pengaturan/resep-tempel' ? document.querySelectorAll('.tempel-baris').length === 4
          : !!document.querySelector('textarea.isian-langkah');
      return { lebar, keluar, ada };
    }, rute);
    cek(m.ada && m.lebar <= w && !m.keluar.length, `ukuran ${w}x${h} ${rute}`, m);
    await ctx.close();
  }
}

console.log('lulus', lulus, 'gagal', gagal, 'galat konsol', galat, 'ERR log', H.logs.filter((l) => l.startsWith('ERR')));
await browser.close();
srv.close();
