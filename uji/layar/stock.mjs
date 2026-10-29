// Uji Chromium: Semua kategori, cari item, dan hitung sisa di form Stock; cari item di Stock opname (aplikasi 0.28.0).
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';
import { muatChromium } from '../alat/peramban.mjs';
const chromium = await muatChromium();
let gagal = 0, lulus = 0;
const cek = (k, label, x) => { if (k) lulus++; else { gagal++; console.log('GAGAL:', label, x !== undefined ? JSON.stringify(x).slice(0, 500) : ''); } };
const s = seed();
const T = s.token;
const hari = (n) => new Date(Date.now() + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const hariIni = hari(0);
// Stock cukup supaya sisa masuk akal
H.aksi({ action: 'kirimStock', token: T, submissionId: crypto.randomUUID(), tanggal: hariIni, kategori: 'Protein', waktuPerangkat: new Date().toISOString(),
  baris: [{ item: 'Ayam fillet', masuk: 10, keluar: '' }, { item: 'Telur', masuk: 200, keluar: '' }, { item: 'Daging sapi', masuk: 5, keluar: '' }] });
const akhirServer = (nama) => H.aksi({ action: 'formStock', token: T, tanggal: hariIni }).data.item.find((i) => i.nama === nama).akhir;
const jumlahItem = H.aksi({ action: 'formStock', token: T, tanggal: hariIni }).data.item.length;

const srv = H.layani(0); // port kosong mana pun
await new Promise((r) => (srv.listening ? r() : srv.once('listening', r)));
const PORT = srv.address().port;
const browser = await chromium.launch();
const galat = [];

async function buka(w, h, siapa, opsi = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'Asia/Jakarta', locale: 'id-ID', serviceWorkers: 'block', reducedMotion: 'reduce' });
  const permintaan = [];
  await ctx.route('https://api.uji/**', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    if (body.action === 'kirimStock') permintaan.push(body);
    if (opsi.ubah) {
      const r = opsi.ubah(body);
      if (r) { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r) }); return; }
    }
    const out = H.aksi(body);
    if (opsi.serverLama && body.action === 'formStock' && out.ok) delete out.data.sisaSiap;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
  });
  if (opsi.draft) {
    await ctx.addInitScript(([k, v]) => { if (!sessionStorage.getItem('__draft')) { localStorage.setItem(k, v); sessionStorage.setItem('__draft', '1'); } },
      ['inventoryku:p:' + siapa.toLowerCase() + ':draft:stock', JSON.stringify({ data: opsi.draft, waktu: Date.now() })]);
  }
  const page = await ctx.newPage();
  page.on('pageerror', (e) => galat.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') galat.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: new RegExp(siapa) }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type({ Budi: '482915', Rina: '730264', Sari: '916205', Andi: '305718' }[siapa], { delay: 30 });
  await page.waitForTimeout(1500);
  await page.evaluate((r) => { location.hash = r; }, opsi.rute || '#/stock');
  await page.waitForTimeout(1500);
  return { ctx, page, permintaan };
}
const kunci = (page, nama, jenis) => page.locator(`[data-kunci="${nama}|${jenis}"]`);
const toastTeks = (page) => page.locator('.toast, .pesan-singkat, [role="status"]').allInnerTexts();
const pesanForm = (page) => page.locator('.layar-form > .pesan-formulir').innerText();

// A–C. HP Staff tanpa draft: Semua kategori, cari, kirim per kategori
{
  const { ctx, page, permintaan } = await buka(390, 844, 'Rina');
  cek(await page.locator('#pilih-kategori').inputValue() === '', 'bawaan Semua kategori');
  const judul = await page.locator('.stock-kelompok > h2.kelompok-judul').allTextContents();
  cek(judul.join('|') === 'Protein|Sayur|Bumbu|Minuman|Barang jadi', 'judul kategori urut', judul);
  cek(await page.locator('.stock-kelompok h3.kartu-item-nama').count() === jumlahItem, 'semua item tampil sebagai h3', await page.locator('.stock-kelompok h3.kartu-item-nama').count());
  cek(new RegExp('0 dari ' + jumlahItem + ' item terisi').test(await page.locator('.penghitung').innerText()), 'penghitung semua item');
  // Cari
  await page.fill('#cari-item-stock', 'tel');
  await page.waitForTimeout(200);
  cek(await page.locator('.kartu-item').count() === 1 && (await page.locator('.kartu-item-nama').innerText()) === 'Telur', 'cari tel → Telur', await page.locator('.kartu-item-nama').allTextContents());
  cek(/1 dari 11 item tampil\./.test(await page.locator('#info-cari-stock').innerText()), 'info cari', await page.locator('#info-cari-stock').innerText());
  cek(await page.locator('#cari-item-stock').evaluate((e) => e === document.activeElement), 'fokus tetap di kotak cari');
  await kunci(page, 'Telur', 'keluar').fill('12');
  await page.fill('#cari-item-stock', '');
  await page.waitForTimeout(200);
  await kunci(page, 'Tomat', 'masuk').fill('2');
  await page.fill('#cari-item-stock', 'ayam');
  await page.waitForTimeout(200);
  cek(/2 item terisi yang tidak tampil tetap ikut dikirim\./.test(await page.locator('#info-cari-stock').innerText()), 'info item tersembunyi terisi', await page.locator('#info-cari-stock').innerText());
  await page.fill('#cari-item-stock', 'zzz');
  await page.waitForTimeout(200);
  cek(/Tidak ada item dengan nama itu\./.test(await page.locator('.layar-form').innerText()), 'cari tanpa hasil');
  await page.fill('#cari-item-stock', 'ayam');
  await page.waitForTimeout(200);
  // Kirim dengan pencarian aktif: semua isian ikut, satu kiriman per kategori
  await page.getByRole('button', { name: 'Kirim stock' }).click();
  await page.waitForTimeout(1500);
  cek(permintaan.length === 2, 'dua kiriman', permintaan.map((p) => p.kategori));
  cek(permintaan[0] && permintaan[0].kategori === 'Protein' && permintaan[1].kategori === 'Sayur' && permintaan[0].submissionId !== permintaan[1].submissionId, 'kategori dan id berbeda', permintaan.map((p) => [p.kategori, p.submissionId]));
  cek(permintaan[0] && permintaan[0].baris.length === 1 && permintaan[0].baris[0].item === 'Telur' && permintaan[0].baris[0].keluar === 12, 'isi kiriman Protein', permintaan[0] && permintaan[0].baris);
  cek((await toastTeks(page)).some((t) => /2 kategori terkirim\./.test(t)), 'pesan 2 kategori', await toastTeks(page));
  const draftSesudah = await page.evaluate(() => JSON.parse(localStorage.getItem('inventoryku:p:rina:draft:stock')).data.isian);
  cek(!draftSesudah.Protein && !draftSesudah.Sayur, 'draft kategori terkirim kosong', draftSesudah);
  await ctx.close();
}
// D–G. Hitung sisa (HP Staff)
{
  const { ctx, page, permintaan } = await buka(390, 844, 'Rina');
  const legenda = page.locator('fieldset legend', { hasText: 'Catat pemakaian' });
  cek(await legenda.count() === 1, 'pilihan Catat pemakaian tampil');
  // Ganti cara ditolak selama ada angka Tambah keluar; angka tidak diubah
  const aDaging = akhirServer('Daging sapi');
  await kunci(page, 'Daging sapi', 'keluar').fill('1');
  await page.locator('label.pilihan', { hasText: 'Hitung sisa' }).click();
  await page.waitForTimeout(300);
  const galatCara = (await page.locator('.kotak-info .kolom-galat').allInnerTexts()).join(' ');
  cek(/Kirim atau kosongkan dulu angka Tambah keluar yang sudah diketik \(1 item\)\./.test(galatCara), 'ganti cara ditolak', galatCara);
  cek(await page.locator('label.pilihan', { hasText: 'Tambah keluar' }).locator('input').isChecked() && await kunci(page, 'Daging sapi', 'keluar').inputValue() === '1', 'tetap Tambah keluar, angka utuh');
  await kunci(page, 'Daging sapi', 'keluar').fill('');
  await page.locator('label.pilihan', { hasText: 'Hitung sisa' }).click();
  await page.waitForTimeout(300);
  cek(await page.locator('label.pilihan', { hasText: 'Hitung sisa' }).locator('input').isChecked() && await kunci(page, 'Daging sapi', 'sisa').count() === 1, 'sesudah dikosongkan: Hitung sisa');
  cek(/Catat prep dan waste lebih dulu\. Ketik jumlah yang ada sekarang/.test(await page.locator('.kotak-info').innerText()), 'bantuan hitung sisa');
  cek(await page.locator('.stock-kelompok label', { hasText: 'Sisa sekarang' }).count() === jumlahItem, 'label Sisa sekarang di semua kartu');
  // Sisa Ayam: keluar dihitung, Stock akhir = sisa
  const aAyam = akhirServer('Ayam fillet');
  const kartuAyam = page.locator('article.kartu-item', { has: page.locator('.kartu-item-nama', { hasText: 'Ayam fillet' }) });
  await kunci(page, 'Ayam fillet', 'sisa').fill('7,5');
  await page.waitForTimeout(150);
  const ket = await kartuAyam.locator('.ket-keluar').innerText();
  cek(ket === 'Keluar ' + String(aAyam - 7.5).replace('.', ',') + ' kg.', 'keterangan keluar', { ket, aAyam });
  cek((await kartuAyam.locator('.stock-akhir-angka').innerText()).replace(/\s+/g, ' ').trim() === '7,5 kg', 'stock akhir = sisa');
  const describedby = await kunci(page, 'Ayam fillet', 'sisa').getAttribute('aria-describedby');
  cek(describedby && (await page.locator('#' + describedby).innerText()) === ket, 'aria-describedby ke keterangan');
  // Sisa lebih banyak: peringatan saja (stock di HP bisa basi); dikirim, server tidak mencatat keluarnya
  await kunci(page, 'Ayam fillet', 'sisa').fill(String(aAyam + 3).replace('.', ','));
  await page.waitForTimeout(150);
  const ketLebih = await kartuAyam.locator('.ket-keluar').innerText();
  cek(/Sisa lebih banyak dari stock tercatat .* Jika tetap dikirim, keluarnya tidak dicatat\. Isi Tambah masuk jika ada barang datang/.test(ketLebih) &&
    await kartuAyam.evaluate((e) => e.classList.contains('masalah')) && await kunci(page, 'Ayam fillet', 'sisa').getAttribute('aria-invalid') === 'false', 'sisa lebih: peringatan', ketLebih);
  await kunci(page, 'Ayam fillet', 'masuk').fill('1');
  await page.waitForTimeout(150);
  cek(/stock tercatat ditambah masuk .* Periksa hitungannya, atau minta Pengelola/.test(await kartuAyam.locator('.ket-keluar').innerText()), 'sisa lebih + masuk: kalimat ditambah masuk', await kartuAyam.locator('.ket-keluar').innerText());
  await kunci(page, 'Ayam fillet', 'sisa').fill(String(aAyam + 5).replace('.', ','));
  await page.getByRole('button', { name: 'Kirim stock' }).click();
  await page.waitForTimeout(1500);
  cek(permintaan.length === 1 && permintaan[0].baris[0].sisa === aAyam + 5 && permintaan[0].baris[0].masuk === 1, 'sisa lebih tetap dikirim', permintaan.map((p) => p.baris));
  cek(/Sisa Ayam fillet .* tidak dicatat: lebih banyak dari stock tercatat ditambah masuk .* Periksa hitungannya/.test(await pesanForm(page)), 'pesan sisa tidak dicatat', await pesanForm(page));
  cek(Math.abs(akhirServer('Ayam fillet') - (aAyam + 1)) < 1e-9, 'server: masuk 1 tercatat, keluar 0', akhirServer('Ayam fillet'));
  // Cari item tidak menghapus pesan
  await page.fill('#cari-item-stock', 'ayam');
  await page.waitForTimeout(200);
  cek(/tidak dicatat/.test(await pesanForm(page)), 'pesan tetap sesudah mengetik di Cari item');
  await page.fill('#cari-item-stock', '');
  await page.waitForTimeout(200);
  // Sisa sama dengan stock: dikirim, dicatat keluar 0
  const aAyam2 = akhirServer('Ayam fillet');
  const n0 = permintaan.length;
  await kunci(page, 'Ayam fillet', 'sisa').fill(String(aAyam2).replace('.', ','));
  await page.getByRole('button', { name: 'Kirim stock' }).click();
  await page.waitForTimeout(1500);
  cek(permintaan.length === n0 + 1 && permintaan[n0].baris[0].sisa === aAyam2, 'sisa sama dikirim');
  cek((await toastTeks(page)).some((t) => /Stock terkirim\./.test(t)) && Math.abs(akhirServer('Ayam fillet') - aAyam2) < 1e-9, 'sisa sama: terkirim, stock tetap');
  // Kirim sisa sungguhan
  await kunci(page, 'Ayam fillet', 'sisa').fill('7,5');
  await page.getByRole('button', { name: 'Kirim stock' }).click();
  await page.waitForTimeout(1500);
  const terakhir = permintaan[permintaan.length - 1];
  cek(terakhir.baris.length === 1 && terakhir.baris[0].sisa === 7.5 && !('keluar' in terakhir.baris[0]), 'kiriman membawa sisa', terakhir.baris);
  cek(Math.abs(akhirServer('Ayam fillet') - 7.5) < 1e-9, 'server: stock akhir 7,5', akhirServer('Ayam fillet'));
  // Pilihan cara tetap sesudah dimuat ulang
  await page.reload();
  await page.waitForTimeout(2000);
  cek(await page.locator('label.pilihan', { hasText: 'Hitung sisa' }).locator('input').isChecked(), 'cara tersimpan di draft');
  // Kemarin: Hitung sisa tidak berlaku, sisa hari ini tidak ikut terkirim, tetap di draft
  await kunci(page, 'Telur', 'sisa').fill('50');
  await page.locator('label.pilihan', { hasText: 'Kemarin' }).click();
  await page.waitForTimeout(1500);
  const bantu = await page.locator('.kotak-info').innerText();
  cek(/Hitung sisa hanya untuk hari ini\./.test(bantu) && /1 sisa yang diketik untuk hari ini tidak ikut dikirim untuk tanggal ini\./.test(bantu), 'kemarin: bantuan', bantu);
  cek(await page.locator('label.pilihan', { hasText: 'Hitung sisa' }).locator('input').isDisabled() &&
    await page.locator('label.pilihan', { hasText: 'Tambah keluar' }).locator('input').isChecked() && await kunci(page, 'Telur', 'keluar').count() === 1, 'kemarin: Tambah keluar, pilihan nonaktif');
  const n1 = permintaan.length;
  await kunci(page, 'Bawang putih', 'keluar').fill('0,1');
  await page.getByRole('button', { name: 'Kirim stock' }).click();
  await page.waitForTimeout(1500);
  cek(permintaan.length === n1 + 1 && permintaan[n1].tanggal === hari(-1) && permintaan[n1].baris.every((b) => !('sisa' in b)), 'kemarin: kiriman tanpa sisa', permintaan[n1]);
  await page.locator('label.pilihan', { hasText: 'Hari ini' }).click();
  await page.waitForTimeout(1500);
  cek(await kunci(page, 'Telur', 'sisa').inputValue() === '50', 'hari ini lagi: sisa Telur masih ada');
  await ctx.close();
}
// D2. Sisa yang diketik kemarin dibuang dari draft saat form dibuka hari ini
{
  const { ctx, page } = await buka(390, 844, 'Andi', { draft: { tanggal: hari(0), kategori: '', cara: 'sisa', sisaHari: hari(-1), sid: {},
    isian: { Protein: { 'Ayam fillet': { masuk: '2', keluar: '', sisa: '5', besar: false, harga: '', baik: '' } } } } });
  cek(await kunci(page, 'Ayam fillet', 'sisa').inputValue() === '' && await kunci(page, 'Ayam fillet', 'masuk').inputValue() === '2', 'sisa lama dibuang, masuk tetap');
  cek(/Sisa yang diketik .* sudah dikosongkan, karena sisa hanya berlaku saat dihitung\. Hitung lagi untuk hari ini\./.test(await pesanForm(page)), 'pesan sisa lama', await pesanForm(page));
  await ctx.close();
}
// D3. Selama kiriman berurutan, isian tidak bisa diubah
{
  const { ctx, page } = await buka(390, 844, 'Sari', {
    ubah: (b) => { if (b.action === 'kirimStock') { const t = Date.now() + 700; while (Date.now() < t) { /* tunda */ } } return null; }
  });
  await kunci(page, 'Telur', 'keluar').fill('1');
  await kunci(page, 'Bawang putih', 'keluar').fill('0,1');
  await page.getByRole('button', { name: 'Kirim stock' }).click();
  await page.waitForTimeout(200);
  const saat = await page.evaluate(() => [document.querySelector('.layar-form .kotak-info').inert, document.querySelector('.layar-form .grid-item').closest('div:not(.grid-item)').inert]);
  await page.waitForTimeout(2500);
  const sesudah = await page.evaluate(() => [document.querySelector('.layar-form .kotak-info').inert]);
  cek(saat[0] === true && saat[1] === true && sesudah[0] === false, 'inert selama kirim', { saat, sesudah });
  await ctx.close();
}
// D4. Antrean: sisa yang lebih banyak saat sampai di server tidak membuat antrean macet; barang masuk tetap tercatat
{
  const { ctx, page, permintaan } = await buka(390, 844, 'Rina');
  await page.locator('label.pilihan', { hasText: 'Hitung sisa' }).click();
  await page.waitForTimeout(300);
  const aD = akhirServer('Daging sapi');
  await kunci(page, 'Daging sapi', 'masuk').fill('2');
  await kunci(page, 'Ayam fillet', 'sisa').fill(String(akhirServer('Ayam fillet') - 0.5).replace('.', ','));
  await ctx.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.getByRole('button', { name: 'Kirim stock' }).click();
  await page.waitForTimeout(400);
  // Orang lain mencatat keluar 2 sebelum sinyal kembali
  H.aksi({ action: 'kirimStock', token: T, submissionId: crypto.randomUUID(), tanggal: hariIni, kategori: 'Protein', waktuPerangkat: new Date().toISOString(), baris: [{ item: 'Ayam fillet', masuk: '', keluar: 2 }] });
  await ctx.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(2500);
  const antre = await page.evaluate(() => JSON.parse(localStorage.getItem('inventoryku:p:rina:antrean') || '[]'));
  cek(antre.length === 0, 'antrean tidak macet', antre);
  cek(Math.abs(akhirServer('Daging sapi') - (aD + 2)) < 1e-9, 'barang masuk Daging sapi tercatat', akhirServer('Daging sapi'));
  cek((await toastTeks(page)).some((t) => /1 isian terkirim\. Sisa Ayam fillet .* tidak dicatat/.test(t)), 'pesan antrean menyebut sisa tidak dicatat', await toastTeks(page));
  await ctx.close();
}
// H. Tanpa sinyal: dua kategori ke antrean, lalu terkirim
{
  const { ctx, page, permintaan } = await buka(390, 844, 'Rina');
  await page.locator('label.pilihan', { hasText: 'Tambah keluar' }).click();
  await page.waitForTimeout(200);
  await kunci(page, 'Telur', 'keluar').fill('3');
  await kunci(page, 'Bawang putih', 'keluar').fill('0,1');
  await ctx.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.getByRole('button', { name: 'Kirim stock' }).click();
  await page.waitForTimeout(500);
  const antre = await page.evaluate(() => JSON.parse(localStorage.getItem('inventoryku:p:rina:antrean') || '[]'));
  cek(antre.length === 2 && antre.map((e) => e.judul).join('|') === 'Stock · Protein|Stock · Bumbu', 'dua entri antrean', antre.map((e) => e.judul));
  cek((await toastTeks(page)).some((t) => /Tersimpan di HP/.test(t)), 'pesan antrean');
  await ctx.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(2500);
  const antre2 = await page.evaluate(() => JSON.parse(localStorage.getItem('inventoryku:p:rina:antrean') || '[]'));
  cek(antre2.length === 0 && permintaan.length === 2, 'antrean terkirim saat sinyal kembali', { sisa: antre2.length, kiriman: permintaan.length });
  await ctx.close();
}
// I. Satu kategori ditolak server: yang lain tetap terkirim, galat menyebut kategori
{
  const { ctx, page, permintaan } = await buka(390, 844, 'Rina', {
    ubah: (b) => (b.action === 'kirimStock' && b.kategori === 'Bumbu' ? { ok: false, pesan: 'Tanggal ini sudah terlalu lama.' } : null)
  });
  await kunci(page, 'Telur', 'keluar').fill('2');
  await kunci(page, 'Bawang putih', 'keluar').fill('0,1');
  await page.getByRole('button', { name: 'Kirim stock' }).click();
  await page.waitForTimeout(1500);
  cek(permintaan.length === 2, 'dua dicoba');
  cek(/Bumbu: Tanggal ini sudah terlalu lama\./.test(await pesanForm(page)), 'galat per kategori', await pesanForm(page));
  cek((await toastTeks(page)).some((t) => /1 kategori terkirim\./.test(t)), 'pesan 1 terkirim', await toastTeks(page));
  cek(await kunci(page, 'Bawang putih', 'keluar').inputValue() === '0,1' && await kunci(page, 'Telur', 'keluar').inputValue() === '', 'yang gagal tetap di draft, yang terkirim kosong');
  await ctx.close();
}
// J. Desktop: tabel per kategori, kolom Sisa Sekarang, muat tanpa digeser
for (const w of [1024, 1366]) {
  const { ctx, page } = await buka(w, 900, 'Rina');
  await page.locator('label.pilihan', { hasText: 'Hitung sisa' }).click();
  await page.waitForTimeout(300);
  const tabel = page.locator('.stock-kelompok table.tabel-stock');
  cek(await tabel.count() === 5, 'lima tabel ' + w, await tabel.count());
  const kepala = await page.locator('.stock-kelompok table.tabel-stock').first().locator('th').allTextContents();
  cek(kepala[5] === 'Sisa Sekarang', 'kepala Sisa Sekarang ' + w, kepala);
  for (const nama of ['Ayam fillet', 'Telur', 'Tomat', 'Air mineral', 'Minyak goreng']) {
    await kunci(page, nama, 'masuk').fill('3');
    await kunci(page, nama, 'sisa').fill(nama === 'Telur' ? '9999' : '1');
  }
  await page.waitForTimeout(300);
  const lebar = await page.evaluate(() => [...document.querySelectorAll('.stock-kelompok .tabel-bingkai')].map((b) => [b.scrollWidth, b.clientWidth]));
  cek(lebar.every(([a, b]) => a <= b + 1), 'tabel muat di bingkai ' + w, lebar);
  cek(await page.evaluate(() => document.documentElement.scrollWidth) <= w, 'tanpa gulir samping ' + w);
  const ketTelur = await page.locator('tr', { has: kunci(page, 'Telur', 'sisa') }).locator('.ket-keluar').innerText();
  cek(/Lebih dari stock/.test(ketTelur), 'ket ringkas di tabel ' + w, ketTelur);
  await page.screenshot({ path: `shot/stock_sisa_${w}.png`, fullPage: true });
  await ctx.close();
}
// K. Server lama: tanpa pilihan Catat pemakaian, semua kategori tetap per kategori dengan keluar
{
  const { ctx, page, permintaan } = await buka(390, 844, 'Andi', { serverLama: true });
  cek(!(await page.locator('fieldset legend', { hasText: 'Catat pemakaian' }).isVisible()), 'server lama: pilihan tersembunyi');
  await kunci(page, 'Telur', 'keluar').fill('1');
  await page.getByRole('button', { name: 'Kirim stock' }).click();
  await page.waitForTimeout(1200);
  cek(permintaan.length === 1 && permintaan[0].baris[0].keluar === 1 && !('sisa' in permintaan[0].baris[0]), 'server lama: kiriman keluar', permintaan.map((p) => p.baris));
  await ctx.close();
}
// L. Galat pada item yang disembunyikan pencarian: pencarian dikosongkan, fokus ke kolomnya
{
  const { ctx, page } = await buka(390, 844, 'Rina');
  await page.locator('label.pilihan', { hasText: 'Tambah keluar' }).click();
  await page.waitForTimeout(200);
  await kunci(page, 'Tomat', 'masuk').fill('2x');
  await page.fill('#cari-item-stock', 'telur');
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Kirim stock' }).click();
  await page.waitForTimeout(300);
  cek(await page.locator('#cari-item-stock').inputValue() === '' && await kunci(page, 'Tomat', 'masuk').evaluate((e) => e === document.activeElement), 'pencarian dikosongkan dan fokus ke Tomat');
  cek(/Periksa angka Tambah masuk Tomat/.test(await pesanForm(page)), 'pesan galat masuk', await pesanForm(page));
  await kunci(page, 'Tomat', 'masuk').fill('');
  await ctx.close();
}
// M. Draft lama dengan satu kategori: susunan seperti dulu (tanpa judul kategori, nama item h2)
{
  const { ctx, page } = await buka(390, 844, 'Sari', { draft: { kategori: 'Protein', isian: {}, sid: {} } });
  cek(await page.locator('#pilih-kategori').inputValue() === 'Protein', 'draft lama: Protein');
  cek(await page.locator('.stock-kelompok').count() === 0 && await page.locator('h2.kartu-item-nama').count() === 3, 'satu kategori: tanpa kelompok, nama h2');
  await ctx.close();
}
// N. Stock opname: cari item, hitungan tersembunyi tetap ikut
{
  const { ctx, page } = await buka(390, 844, 'Budi', { rute: '#/opname' });
  const isianHitung = (nama) => page.locator(`[data-kunci="${nama.toLowerCase()}"]`);
  await isianHitung('Ayam fillet').fill('7');
  await page.fill('#cari-item-opname', 'tom');
  await page.waitForTimeout(200);
  cek(await page.locator('.kartu-opname').count() === 1, 'opname cari tom → 1', await page.locator('.kartu-opname .kartu-item-nama').allTextContents());
  cek(/1 item terhitung yang tidak tampil tetap ikut disimpan\./.test(await page.locator('#info-cari-opname').innerText()), 'info opname', await page.locator('#info-cari-opname').innerText());
  await isianHitung('Tomat').fill('3');
  await page.getByRole('button', { name: 'Lanjut' }).click();
  await page.waitForTimeout(500);
  const ring = await page.locator('.opname-kartu').innerText();
  cek(/Ringkasan opname/.test(ring) && /\b2\b/.test(ring), 'ringkasan memuat 2 item dihitung', ring.slice(0, 300));
  await page.getByRole('button', { name: 'Kembali' }).click();
  await page.waitForTimeout(300);
  await isianHitung('Tomat').fill('3x');
  await page.fill('#cari-item-opname', 'ayam');
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Lanjut' }).click();
  await page.waitForTimeout(300);
  cek(await page.locator('#cari-item-opname').inputValue() === '' && await isianHitung('Tomat').evaluate((e) => e === document.activeElement), 'opname: galat tersembunyi → cari dikosongkan, fokus');
  await ctx.close();
}
// O. Delapan ukuran: Stock semua kategori + hitung sisa, dan opname dengan cari
for (const [w, h] of [[320, 568], [360, 740], [390, 844], [430, 932], [768, 1024], [1024, 768], [1366, 768], [1920, 1080]]) {
  for (const rute of ['#/stock', '#/opname']) {
    const { ctx, page } = await buka(w, h, 'Budi', { rute });
    const panjang = w === 320 ? 'abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrs' : 'a';
    if (rute === '#/stock') {
      await page.locator('label.pilihan', { hasText: 'Hitung sisa' }).click();
      await page.waitForTimeout(200);
      await kunci(page, 'Ayam fillet', 'sisa').fill('99999');
      await page.fill('#cari-item-stock', panjang);
    } else {
      await page.fill('#cari-item-opname', panjang);
    }
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => {
      const lebar = document.documentElement.scrollWidth;
      const kecil = [...document.querySelectorAll('.layar-form input:not([type=radio]), .layar-form select, .layar-form button')]
        .filter((e) => e.offsetParent).map((e) => e.getBoundingClientRect()).filter((r) => r.height < 44).length;
      const keluar = [...document.querySelectorAll('.layar-form *')].filter((e) => {
        if (e.closest('.tabel-bingkai')) return false;
        const r = e.getBoundingClientRect();
        return r.width && (r.right > innerWidth + 1 || r.left < -1);
      }).length;
      return { lebar, kecil, keluar };
    });
    cek(m.lebar <= w && m.kecil === 0 && m.keluar === 0, `ukuran ${w}x${h} ${rute}`, m);
    await ctx.close();
  }
}
console.log('lulus', lulus, 'gagal', gagal, 'galat konsol', galat);
await browser.close();
srv.close();
