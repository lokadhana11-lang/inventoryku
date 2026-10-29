// Uji Chromium: Daftar belanja per pemasok, Kirim ke WhatsApp, pesanan, dan Pesanan menunggu di form Stock (aplikasi 0.29.0).
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';
import { muatChromium } from '../alat/peramban.mjs';
const chromium = await muatChromium();
let gagal = 0, lulus = 0;
const cek = (k, label, x) => { if (k) lulus++; else { gagal++; console.log('GAGAL:', label, x !== undefined ? JSON.stringify(x).slice(0, 600) : ''); } };
const s = seed();
const T = s.token;
const hari = (n) => new Date(Date.now() + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const hariIni = hari(0);
const A = (action, b) => H.aksi(Object.assign({ action, token: T }, b));
const akhir = (nama) => A('formStock', { tanggal: hariIni }).data.item.find((i) => i.nama === nama).akhir;
// Ayam fillet (pemasok terakhir Toko Ayam Jaya) dan Air mineral di bawah minimum
A('kirimStock', { submissionId: crypto.randomUUID(), tanggal: hariIni, kategori: 'x', waktuPerangkat: new Date().toISOString(),
  baris: [{ item: 'Ayam fillet', keluar: akhir('Ayam fillet') - 2 }, { item: 'Air mineral', keluar: 40 }] });
const barisStock = () => {
  const v = H.ss.getSheetByName('Data_Stock').getDataRange().getValues();
  return v.slice(1).filter((r) => r[0] !== '' && r[0] != null).map((r) => Object.fromEntries(v[0].map((j, i) => [j, r[i]])));
};
const barisPesanan = () => {
  const sh = H.ss.getSheetByName('Data_Pesanan');
  const v = sh.getDataRange().getValues();
  return v.slice(1).filter((r) => r[0] !== '' && r[0] != null).map((r) => Object.fromEntries(v[0].map((j, i) => [j, r[i]])));
};

const srv = H.layani(0); // port kosong mana pun
await new Promise((r) => (srv.listening ? r() : srv.once('listening', r)));
const PORT = srv.address().port;
const browser = await chromium.launch();
const galat = [];

async function buka(w, h, siapa, opsi = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'Asia/Jakarta', locale: 'id-ID', serviceWorkers: 'block', reducedMotion: 'reduce' });
  const permintaan = [];
  const wa = [];
  await ctx.route('https://wa.me/**', async (route) => { wa.push(route.request().url()); await route.fulfill({ status: 200, contentType: 'text/html', body: '<p>wa</p>' }); });
  await ctx.route('https://api.uji/**', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    permintaan.push(body);
    if (opsi.putus && opsi.putus(body)) { await route.abort('internetdisconnected'); return; }
    const out = H.aksi(body);
    if (opsi.serverLama && out.ok && out.data) {
      if (body.action === 'daftarBelanja') ['pemasok', 'pesananSiap', 'pilihanPemasok', 'menunggu', 'outlet'].forEach((k) => delete out.data[k]);
      if (body.action === 'formStock') { delete out.data.pesanan; delete out.data.pesananSiap; }
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
  });
  const page = await ctx.newPage();
  page.on('popup', (p) => { setTimeout(() => p.close().catch(() => {}), 200); });
  page.on('pageerror', (e) => galat.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/wa\.me|ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(m.text())) galat.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: new RegExp(siapa) }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type({ Budi: '482915', Rina: '730264', Sari: '916205', Andi: '305718' }[siapa], { delay: 30 });
  await page.waitForTimeout(1500);
  await page.evaluate((r) => { location.hash = r; }, opsi.rute || '#/laporan');
  await page.waitForTimeout(1800);
  return { ctx, page, permintaan, wa };
}
const kunci = (page, nama, jenis) => page.locator(`[data-kunci="${nama}|${jenis}"]`);
const kelompok = (page, nama) => page.locator('.belanja-kelompok', { has: page.locator('h3.judul-sub', { hasText: new RegExp('^' + nama + '$') }) });
const orderDi = (page, nama) => page.locator('.belanja-baris', { has: page.locator('.daftar-baris-judul', { hasText: new RegExp('^' + nama + '$') }) }).locator('input');
const teksWa = (href) => decodeURIComponent(String(href).split('?text=')[1] || '');
const antrean = (page, nama) => page.evaluate((n) => JSON.parse(localStorage.getItem('inventoryku:p:' + n + ':antrean') || '[]'), nama);

// A. Pengelola HP: kelompok per pemasok, Order awal, isi pesan WhatsApp
let idSumber;
{
  const { ctx, page, permintaan, wa } = await buka(390, 844, 'Budi');
  const judul = await page.locator('.belanja-kelompok > h3.judul-sub').allTextContents();
  cek(judul[0] === 'Toko Ayam Jaya' && judul[judul.length - 1] === 'Belum ada pemasok', 'kelompok per pemasok', judul);
  cek(await orderDi(page, 'Ayam fillet').inputValue() === '18', 'Order awal = saran di kelompok pemasok', await orderDi(page, 'Ayam fillet').inputValue());
  cek(await orderDi(page, 'Tomat').inputValue() === '', 'Order kosong di Belum ada pemasok');
  const linkAyam = kelompok(page, 'Toko Ayam Jaya').locator('a.belanja-wa');
  const hrefAyam = await linkAyam.getAttribute('href');
  cek(/^https:\/\/wa\.me\/\?text=/.test(hrefAyam) && teksWa(hrefAyam) === 'Halo Toko Ayam Jaya, kami dari Dapur Contoh mau pesan:\n- Ayam fillet 18 kg\nTerima kasih.', 'pesan WA tanpa nomor', teksWa(hrefAyam));
  cek(/belum berisi nomor HP/.test(await kelompok(page, 'Toko Ayam Jaya').locator('.kolom-bantuan').last().innerText()), 'keterangan tanpa nomor');
  // Belum ada pemasok: tombol nonaktif sampai Order diisi
  const kosong = kelompok(page, 'Belum ada pemasok');
  const linkKosong = kosong.locator('a.belanja-wa');
  cek(await linkKosong.getAttribute('aria-disabled') === 'true', 'tombol nonaktif tanpa Order');
  await linkKosong.click({ force: true });
  await page.waitForTimeout(300);
  cek(/Isi Order minimal untuk satu item/.test(await kosong.locator('.pesan-formulir').innerText()) && wa.length === 0, 'ketuk tanpa Order tidak membuka WA', wa);
  await orderDi(page, 'Tomat').fill('abc');
  await page.waitForTimeout(100);
  await linkKosong.click({ force: true });
  await page.waitForTimeout(300);
  cek(/Periksa angka Order Tomat/.test(await kosong.locator('.pesan-formulir').innerText()) && wa.length === 0, 'Order salah tidak membuka WA');
  await orderDi(page, 'Tomat').fill('5');
  await orderDi(page, 'Air mineral').fill('3');
  await kosong.locator('select').selectOption('Sumber Segar');
  await page.waitForTimeout(200);
  const href = await linkKosong.getAttribute('href');
  cek(/^https:\/\/wa\.me\/6281200001111\?text=/.test(href) && teksWa(href) === 'Halo Sumber Segar, kami dari Dapur Contoh mau pesan:\n- Tomat 5 kg\n- Air mineral 3 dus\nTerima kasih.', 'pesan WA ke Sumber Segar', teksWa(href));
  await linkKosong.click();
  await page.waitForTimeout(1500);
  cek(wa.length === 1 && wa[0].indexOf('6281200001111') > 0, 'WA terbuka', wa);
  const catat = permintaan.filter((p) => p.action === 'catatPesanan');
  idSumber = catat[0] && catat[0].submissionId;
  cek(catat.length === 1 && catat[0].pemasok === 'Sumber Segar' && catat[0].baris.length === 2 && catat[0].baris.find((b) => b.item === 'Air mineral').satuanOrder === 'besar' &&
    catat[0].baris.find((b) => b.item === 'Tomat').jumlah === 5, 'catatPesanan dikirim', catat);
  cek(barisPesanan().filter((x) => x.Keadaan === 'Menunggu').length === 2, 'tercatat di server');
  cek((await antrean(page, 'budi')).length === 0, 'antrean bersih sesudah tercatat');
  cek(/Pesanan ke Sumber Segar dicatat \(2 item\)\./.test(await page.locator('#judul-belanja + .pesan-formulir').innerText()), 'pesan dicatat', await page.locator('#judul-belanja + .pesan-formulir').innerText());
  // Kartu digambar ulang: Tomat di kelompok Sumber Segar, Order kosong, tanda Dipesan; Pesanan belum datang
  cek(await kelompok(page, 'Sumber Segar').count() === 1 && await orderDi(page, 'Tomat').inputValue() === '', 'Tomat pindah, Order kosong');
  cek(/Dipesan 5 kg/.test(await kelompok(page, 'Sumber Segar').innerText()), 'tanda Dipesan');
  const menunggu = await page.locator('.belanja-menunggu').innerText();
  cek(/Pesanan belum datang/.test(menunggu) && /Sumber Segar/.test(menunggu) && /Tomat 5 kg, Air mineral 3 dus|Air mineral 3 dus, Tomat 5 kg/.test(menunggu) && /Dipesan Budi lewat WhatsApp/.test(menunggu), 'Pesanan belum datang', menunggu);
  // Ketuk dua kali dengan isi sama (Ayam): satu pesanan
  await linkAyam.click();
  await page.waitForTimeout(150);
  await kelompok(page, 'Toko Ayam Jaya').locator('a.belanja-wa').click().catch(() => {});
  await page.waitForTimeout(1500);
  const ayam = barisPesanan().filter((x) => x['Nama Item'] === 'Ayam fillet');
  cek(ayam.length === 1, 'ketukan ganda satu pesanan', ayam.length);
  // PDF memakai Order di layar
  await ctx.close();
}

// B. Sinyal putus saat mencatat: tersimpan di antrean, terkirim saat sinyal kembali
{
  let putus = true;
  const { ctx, page } = await buka(390, 844, 'Sari', { putus: (b) => putus && b.action === 'catatPesanan' });
  const kosong = kelompok(page, 'Belum ada pemasok');
  await orderDi(page, 'Bawang merah').fill('2');
  await kosong.locator('select').selectOption('Sumber Segar');
  await kosong.locator('a.belanja-wa').click();
  await page.waitForTimeout(1500);
  const a = await antrean(page, 'sari');
  cek(a.length === 1 && a[0].aksi === 'catatPesanan' && a[0].formId === null && a[0].judul === 'Pesanan · Sumber Segar', 'antrean berisi pesanan', a);
  cek(/tersimpan di HP/.test(await kosong.locator('.pesan-formulir').innerText()), 'pesan antrean');
  cek(!barisPesanan().some((x) => x['Nama Item'] === 'Bawang merah'), 'belum tercatat');
  putus = false;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(2000);
  cek((await antrean(page, 'sari')).length === 0 && barisPesanan().some((x) => x['Nama Item'] === 'Bawang merah' && x.Keadaan === 'Menunggu' && x.submitted_by === 'Sari'), 'terkirim dari antrean');
  await ctx.close();
}

// C. Staff: Pesanan menunggu di form Stock, Isi dari pesanan, kirim menyelesaikan pesanan
{
  const { ctx, page, permintaan } = await buka(390, 844, 'Rina', { rute: '#/stock' });
  const kartu = page.locator('.pesanan-stock');
  const teks = await kartu.innerText();
  cek(/Pesanan menunggu/.test(teks) && /Sumber Segar/.test(teks) && /Dipesan Budi lewat WhatsApp/.test(teks), 'kartu Pesanan menunggu', teks);
  cek(await kartu.getByRole('button', { name: /Tutup pesanan/ }).count() === 0, 'Staff tanpa Tutup pesanan');
  // Draft berisi Tambah masuk tanpa pemasok: ditolak
  await kunci(page, 'Telur', 'masuk').fill('10');
  await page.waitForTimeout(100);
  await kartu.getByRole('button', { name: 'Isi dari pesanan Sumber Segar' }).first().click();
  await page.waitForTimeout(300);
  cek(/sudah berisi Tambah masuk Telur \(Protein\) tanpa pemasok\. Kirim atau kosongkan dulu, supaya barang itu tidak tercatat dari Sumber Segar\./.test(await kartu.locator('.pesan-formulir').innerText()), 'ditolak jika ada masuk lain', await kartu.locator('.pesan-formulir').innerText());
  await kunci(page, 'Telur', 'masuk').fill('');
  await page.waitForTimeout(100);
  // Pilih kategori Sayur dan cari: Isi dari pesanan kembali ke Semua kategori dan mengosongkan pencarian
  await page.selectOption('#pilih-kategori', 'Sayur');
  await page.fill('#cari-item-stock', 'tom');
  await page.waitForTimeout(200);
  const tombolIsi = kartu.getByRole('button', { name: 'Isi dari pesanan Sumber Segar' });
  // Pesanan terbaru (Sari, Bawang merah) dan pesanan Budi (Tomat, Air mineral)
  const jumlahTombol = await tombolIsi.count();
  cek(jumlahTombol === 2, 'dua pesanan Sumber Segar', jumlahTombol);
  await tombolIsi.nth(1).click();
  await page.waitForTimeout(400);
  cek(await page.locator('#pilih-kategori').inputValue() === '' && await page.locator('#cari-item-stock').inputValue() === '', 'Semua kategori dan cari kosong');
  cek(await kunci(page, 'Tomat', 'masuk').inputValue() === '5' && await kunci(page, 'Air mineral', 'masuk').inputValue() === '3' &&
    await kunci(page, 'Air mineral', 'satuan').inputValue() === 'besar', 'Tambah masuk terisi (dus)', [await kunci(page, 'Air mineral', 'masuk').inputValue(), await kunci(page, 'Air mineral', 'satuan').inputValue()]);
  cek(await page.locator('#pilih-pemasok').inputValue() === 'Sumber Segar', 'pemasok terisi');
  cek(/diisi dari pesanan Sumber Segar\. Periksa jumlah yang datang/.test(await kartu.locator('.pesan-formulir').innerText()), 'pesan isi');
  cek(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-kunci')) === 'Air mineral|masuk' ||
    await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-kunci')) === 'Tomat|masuk', 'fokus ke kolom yang diisi');
  // Isi lagi: item yang sudah diisi dilewati
  await tombolIsi.nth(1).click();
  await page.waitForTimeout(300);
  cek(/Tidak ada item yang bisa diisi/.test(await kartu.locator('.pesan-formulir').innerText()), 'isi lagi dilewati');
  // Tomat datang 4 kg saja
  await kunci(page, 'Tomat', 'masuk').fill('4');
  await page.getByRole('button', { name: 'Kirim stock' }).click();
  await page.waitForTimeout(2500);
  const ks = permintaan.filter((p) => p.action === 'kirimStock');
  const semua = ks.flatMap((p) => p.baris);
  cek(ks.length === 2 && ks.every((p) => p.pemasok === 'Sumber Segar') && semua.find((b) => b.item === 'Tomat').pesanan === idSumber &&
    semua.find((b) => b.item === 'Air mineral').pesanan === idSumber && semua.find((b) => b.item === 'Tomat').masuk === 4, 'kiriman membawa tautan', ks.map((p) => [p.kategori, p.pemasok, p.baris]));
  const pf = await page.locator('.layar-form > .pesan-formulir').innerText();
  cek(/tercatat datang/.test(pf) && /Sumber Segar/.test(pf), 'pesan tercatat datang', pf);
  cek(await page.locator('#pilih-pemasok').inputValue() === '', 'pemasok kembali kosong');
  const sisa = await page.locator('.pesanan-stock').innerText().catch(() => '');
  cek(!/Tomat 5 kg/.test(sisa), 'pesanan Budi hilang dari kartu', sisa);
  cek(barisPesanan().filter((x) => x.submission_id === idSumber).every((x) => x.Keadaan === 'Datang' && x['Selesai Oleh'] === 'Rina'), 'pesanan Datang');
  await ctx.close();
}

// D. Dua HP: Sari mengisi dari pesanan dan membetulkan angkanya dengan Backspace, Andi mengirim lebih dulu: masuk Sari tidak dicatat dua kali
{
  const sari = await buka(390, 844, 'Sari', { rute: '#/stock' });
  await sari.page.locator('.pesanan-stock').getByRole('button', { name: 'Isi dari pesanan Sumber Segar' }).first().click();
  await sari.page.waitForTimeout(300);
  cek(await kunci(sari.page, 'Bawang merah', 'masuk').inputValue() === '2', 'Sari terisi Bawang merah');
  // Betulkan 2 → 1 seperti di HP: hapus lalu ketik (kolom sempat kosong, tanpa meninggalkan kolom)
  const km = kunci(sari.page, 'Bawang merah', 'masuk');
  await km.click();
  await sari.page.keyboard.press('End');
  await sari.page.keyboard.press('Backspace');
  await sari.page.keyboard.type('1');
  await sari.page.waitForTimeout(150);
  const tautSari = await sari.page.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => /:draft:stock$/.test(x));
    const d = JSON.parse(localStorage.getItem(k)).data;
    return Object.values(d.isian).map((kat) => kat['Bawang merah']).filter(Boolean)[0];
  });
  cek(tautSari && tautSari.masuk === '1' && tautSari.pesanan, 'Backspace tidak melepas tautan', tautSari);
  // Mengosongkan lalu meninggalkan kolom: tautan dilepas (dicoba di Andi)
  const andi = await buka(390, 844, 'Andi', { rute: '#/stock' });
  await andi.page.locator('.pesanan-stock').getByRole('button', { name: 'Isi dari pesanan Sumber Segar' }).first().click();
  await andi.page.waitForTimeout(300);
  await andi.page.getByRole('button', { name: 'Kirim stock' }).click();
  await andi.page.waitForTimeout(2000);
  cek(!/Sumber Segar/.test(await andi.page.locator('.pesanan-stock').innerText().catch(() => '')), 'Andi: pesanan Sumber Segar hilang sesudah kirim');
  const sebelum = barisStock().filter((x) => x['Nama Item'] === 'Bawang merah' && Number(x['Stock Masuk']) > 0).length;
  await sari.page.getByRole('button', { name: 'Kirim stock' }).click();
  await sari.page.waitForTimeout(2000);
  const pf = await sari.page.locator('.layar-form > .pesan-formulir').innerText();
  cek(/Tambah masuk Bawang merah tidak dicatat: pesanan Sumber Segar sudah dicatat datang oleh Andi, \d+ \w+ \d\d\.\d\d\./.test(pf) &&
    /Jika ini kiriman lain, catat lagi Tambah masuk-nya tanpa Isi dari pesanan\./.test(pf), 'Sari: masuk tidak dicatat dua kali', pf);
  const ks0 = sari.permintaan.filter((p) => p.action === 'kirimStock');
  cek(ks0.length === 1 && ks0[0].baris[0].pesanan && ks0[0].baris[0].masuk === 1, 'kiriman Sari membawa tautan', ks0.map((k) => k.baris));
  cek(barisStock().filter((x) => x['Nama Item'] === 'Bawang merah' && Number(x['Stock Masuk']) > 0).length === sebelum, 'tidak ada masuk kedua');
  cek(await kunci(sari.page, 'Bawang merah', 'masuk').inputValue() === '', 'draft Sari dikosongkan');
  // Ketik lagi = kiriman lain (tanpa tautan) diterima
  await kunci(sari.page, 'Bawang merah', 'masuk').fill('1');
  await sari.page.getByRole('button', { name: 'Kirim stock' }).click();
  await sari.page.waitForTimeout(2000);
  const ks = sari.permintaan.filter((p) => p.action === 'kirimStock');
  cek(ks.length === 2 && !ks[1].baris[0].pesanan, 'ketik lagi tanpa tautan', ks.map((k) => k.baris));
  await sari.ctx.close();
  await andi.ctx.close();
}

// E. Tutup pesanan dari Laporan dan dari form Stock (Pengelola); Kemarin tanpa kartu
{
  const r1 = A('catatPesanan', { submissionId: crypto.randomUUID(), tanggal: hariIni, waktuPerangkat: new Date().toISOString(), pemasok: 'Sumber Segar', baris: [{ item: 'Cabai merah', jumlah: 1 }] });
  const r2 = A('catatPesanan', { submissionId: crypto.randomUUID(), tanggal: hariIni, waktuPerangkat: new Date().toISOString(), pemasok: 'Toko Ayam Jaya', baris: [{ item: 'Daging sapi', jumlah: 2 }] });
  cek(r1.ok && r2.ok, 'siapkan pesanan');
  const { ctx, page } = await buka(390, 844, 'Budi');
  const baris = page.locator('.belanja-menunggu li', { hasText: 'Cabai merah' });
  await baris.getByRole('button', { name: /Tutup pesanan/ }).click();
  await page.waitForTimeout(300);
  cek(/Tutup pesanan Sumber Segar, \d+ \w+\?/.test(await page.locator('.lembar').innerText()), 'konfirmasi tutup');
  await page.locator('.lembar-aksi').getByRole('button', { name: 'Tutup pesanan' }).click();
  await page.waitForTimeout(1500);
  cek(barisPesanan().find((x) => x['Nama Item'] === 'Cabai merah' && x.submission_id === r1.data.id).Keadaan === 'Ditutup', 'ditutup dari Laporan');
  cek(!/Cabai merah 1 kg/.test(await page.locator('.belanja').innerText()) && /ditutup/.test(await page.locator('#judul-belanja + .pesan-formulir').innerText()), 'kartu diperbarui');
  await page.evaluate(() => { location.hash = '#/stock'; });
  await page.waitForTimeout(1800);
  const kartu = page.locator('.pesanan-stock');
  cek(/Toko Ayam Jaya/.test(await kartu.innerText()), 'kartu Stock Pengelola');
  await kartu.locator('li', { hasText: 'Daging sapi' }).getByRole('button', { name: 'Tutup pesanan Toko Ayam Jaya' }).click();
  await page.waitForTimeout(300);
  await page.locator('.lembar-aksi').getByRole('button', { name: 'Tutup pesanan' }).click();
  await page.waitForTimeout(1500);
  cek(barisPesanan().find((x) => x.submission_id === r2.data.id).Keadaan === 'Ditutup', 'ditutup dari form Stock');
  cek(!/Daging sapi/.test(await page.locator('.pesanan-stock').innerText().catch(() => '')), 'kartu Stock diperbarui');
  // Kemarin: tanpa kartu
  A('catatPesanan', { submissionId: crypto.randomUUID(), tanggal: hariIni, waktuPerangkat: new Date().toISOString(), pemasok: 'Sumber Segar', baris: [{ item: 'Bawang putih', jumlah: 2 }] });
  await page.reload();
  await page.waitForTimeout(2000);
  cek(await page.locator('.pesanan-stock').count() === 1, 'kartu hari ini');
  await page.locator('label.pilihan', { hasText: 'Kemarin' }).click();
  await page.waitForTimeout(1500);
  cek(await page.locator('.pesanan-stock').count() === 0, 'Kemarin tanpa kartu');
  await ctx.close();
}

// F. Server lama: per kategori tanpa WhatsApp; form Stock tanpa kartu
{
  const { ctx, page } = await buka(390, 844, 'Budi', { serverLama: true });
  cek(await page.locator('.belanja-kelompok').count() === 0 && await page.locator('a.belanja-wa').count() === 0 && await page.locator('.belanja h3.judul-sub').count() > 0, 'server lama per kategori');
  cek(/hanya untuk cetakan/.test(await page.locator('.laporan-kartu').first().innerText().catch(() => '')) || /hanya untuk cetakan/.test(await page.locator('.belanja').locator('xpath=..').innerText()), 'teks lama');
  await page.evaluate(() => { location.hash = '#/stock'; });
  await page.waitForTimeout(1800);
  cek(await page.locator('.pesanan-stock').count() === 0, 'server lama tanpa kartu pesanan');
  await ctx.close();
}

// G. PDF dari kartu per pemasok mengirim Order semua item
{
  const { ctx, page, permintaan } = await buka(1366, 768, 'Budi');
  await orderDi(page, 'Ayam fillet').fill('20');
  await page.locator('.laporan-kartu', { has: page.locator('#judul-belanja') }).getByRole('button', { name: 'Unduh PDF' }).click();
  await page.waitForTimeout(1500);
  const p = permintaan.filter((x) => x.action === 'unduhPdfBelanja').pop();
  const nBaris = await page.locator('.belanja-baris').count();
  cek(p && p.order['Ayam fillet'] === '20' && Object.keys(p.order).length === nBaris && nBaris >= 3, 'order PDF semua item', [nBaris, p && p.order]);
  await ctx.close();
}

// H. Delapan ukuran: Laporan (kelompok, Pesanan belum datang) dan form Stock (kartu pesanan)
A('catatPesanan', { submissionId: crypto.randomUUID(), tanggal: hariIni, waktuPerangkat: new Date().toISOString(), pemasok: 'Sumber Segar', baris: [{ item: 'Telur', jumlah: 150 }, { item: 'Tomat', jumlah: 5 }] });
for (const [w, h] of [[320, 568], [360, 740], [390, 844], [430, 932], [768, 1024], [1024, 768], [1366, 768], [1920, 1080]]) {
  for (const rute of ['#/laporan', '#/stock']) {
    const { ctx, page } = await buka(w, h, 'Budi', { rute });
    const m = await page.evaluate((r) => {
      const akar = document.querySelector(r === '#/stock' ? '.layar-form' : '.belanja');
      const lebar = document.documentElement.scrollWidth;
      const pilih = r === '#/stock' ? '.pesanan-stock button, .pesanan-stock a' : '.belanja button, .belanja a, .belanja input, .belanja select';
      const kecil = [...document.querySelectorAll(pilih)].filter((e) => e.offsetParent).map((e) => [e.textContent || e.tagName, e.getBoundingClientRect().height]).filter((x) => x[1] < 44);
      const keluar = [...akar.querySelectorAll('*')].filter((e) => {
        if (e.closest('.tabel-bingkai')) return false;
        const b = e.getBoundingClientRect();
        return b.width && (b.right > innerWidth + 1 || b.left < -1);
      }).map((e) => e.className).slice(0, 5);
      const ada = r === '#/stock' ? !!document.querySelector('.pesanan-stock') : !!document.querySelector('.belanja-kelompok') && !!document.querySelector('.belanja-menunggu');
      return { lebar, kecil, keluar, ada };
    }, rute);
    cek(m.ada && m.lebar <= w && !m.kecil.length && !m.keluar.length, `ukuran ${w}x${h} ${rute}`, m);
    await ctx.close();
  }
}

console.log('lulus', lulus, 'gagal', gagal, 'galat konsol', galat, 'ERR log', H.logs.filter((l) => l.startsWith('ERR')));
await browser.close();
srv.close();
