// Uji Chromium untuk temuan telaah butir 4 (aplikasi 0.29.0).
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
const pesanServer = (pemasok, baris, ekstra = {}) => A('catatPesanan', Object.assign({ submissionId: crypto.randomUUID(), tanggal: hariIni, waktuPerangkat: new Date().toISOString(), pemasok, baris }, ekstra));
const toastTeks = (page) => page.locator('.toast').last().innerText().catch(() => '');

// P. Pesanan dari antrean terkirim: kartu Daftar belanja ikut diperbarui
{
  let putus = true;
  const { ctx, page } = await buka(390, 844, 'Sari', { putus: (b) => putus && b.action === 'catatPesanan' });
  const kosong = kelompok(page, 'Belum ada pemasok');
  cek(/belum punya pemasok aktif dari barang masuk/.test(await kosong.innerText()), 'keterangan Belum ada pemasok');
  cek(/Ketukan Kirim ke WhatsApp mencatat pesanan ke pemasok itu; jika pesannya tidak jadi dikirim, ketuk Tutup pesanan\./.test(await page.locator('.belanja ~ .kolom-bantuan').innerText()), 'catatan kartu');
  await orderDi(page, 'Bawang merah').fill('2');
  await kosong.locator('select').selectOption('Sumber Segar');
  await kosong.locator('a.belanja-wa').click();
  await page.waitForTimeout(1500);
  cek(/tersimpan di HP/.test(await kosong.locator('.pesan-formulir').innerText()), 'pesan antrean');
  putus = false;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(2500);
  const menunggu = await page.locator('.belanja-menunggu').innerText().catch(() => '');
  cek(/Bawang merah 2 kg/.test(menunggu), 'Pesanan belum datang diperbarui', menunggu);
  cek(await orderDi(page, 'Bawang merah').inputValue() === '' && /Dipesan 2 kg/.test(await page.locator('.belanja').innerText()), 'Order kosong dan bertanda Dipesan');
  cek(!/tersimpan di HP/.test(await page.locator('.belanja').innerText()), 'pesan antrean hilang');
  await ctx.close();
}

// Q. Memesan isi yang sama lagi sesudah Tutup pesanan: pesanan baru tercatat
{
  const { ctx, page, permintaan } = await buka(390, 844, 'Budi');
  const kosong = () => kelompok(page, 'Belum ada pemasok');
  await orderDi(page, 'Tomat').fill('5');
  await kosong().locator('select').selectOption('Sumber Segar');
  await kosong().locator('a.belanja-wa').click();
  await page.waitForTimeout(1500);
  const id1 = permintaan.filter((p) => p.action === 'catatPesanan')[0].submissionId;
  const baris = page.locator('.belanja-menunggu li', { hasText: 'Tomat' });
  await baris.getByRole('button', { name: /Tutup pesanan/ }).click();
  await page.waitForTimeout(300);
  await page.locator('.lembar-aksi').getByRole('button', { name: 'Tutup pesanan' }).click();
  await page.waitForTimeout(1500);
  const pk = page.locator('#judul-belanja + .pesan-formulir');
  cek(/Pesanan Sumber Segar, \d+ \w+ ditutup\./.test(await pk.innerText()) && await page.evaluate(() => document.activeElement && document.activeElement.matches('#judul-belanja + .pesan-formulir')), 'tutup: pesan dan fokus', await pk.innerText());
  await orderDi(page, 'Tomat').fill('5');
  await kosong().locator('select').selectOption('Sumber Segar');
  await kosong().locator('a.belanja-wa').click();
  await page.waitForTimeout(1500);
  const cp = permintaan.filter((p) => p.action === 'catatPesanan');
  cek(cp.length === 2 && cp[1].submissionId !== id1, 'id baru untuk pesanan kedua', cp.map((p) => p.submissionId));
  cek(barisPesanan().some((x) => x['Nama Item'] === 'Tomat' && x.Keadaan === 'Menunggu' && x.submission_id === cp[1].submissionId), 'pesanan kedua menunggu');
  cek(/Pesanan ke Sumber Segar dicatat \(1 item\)\./.test(await pk.innerText()), 'pesan dicatat', await pk.innerText());
  A('tutupPesanan', { id: cp[1].submissionId });
  await ctx.close();
}

// R. Tutup pesanan yang sudah dicatat datang di HP lain: pesannya jujur
{
  const r = pesanServer('Toko Ayam Jaya', [{ item: 'Telur', jumlah: 100 }]);
  const { ctx, page } = await buka(390, 844, 'Budi');
  A('kirimStock', { submissionId: crypto.randomUUID(), tanggal: hariIni, kategori: 'Protein', waktuPerangkat: new Date().toISOString(), pemasok: 'Toko Ayam Jaya', baris: [{ item: 'Telur', masuk: 100 }] });
  cek(barisPesanan().find((x) => x.submission_id === r.data.id).Keadaan === 'Datang', 'Telur datang di server');
  const baris = page.locator('.belanja-menunggu li', { hasText: 'Telur' });
  const nama = await baris.getByRole('button', { name: /Tutup pesanan/ }).getAttribute('aria-label');
  cek(/^Tutup pesanan Toko Ayam Jaya, \d+ \w+: Telur 100 butir$/.test(nama), 'nama tombol tutup berisi tanggal dan item', nama);
  await baris.getByRole('button', { name: /Tutup pesanan/ }).click();
  await page.waitForTimeout(300);
  await page.locator('.lembar-aksi').getByRole('button', { name: 'Tutup pesanan' }).click();
  await page.waitForTimeout(1500);
  cek(/sudah tidak menunggu: barangnya sudah dicatat datang, atau pesanannya sudah ditutup\./.test(await page.locator('#judul-belanja + .pesan-formulir').innerText()), 'ditutup 0: pesan info');
  cek(barisPesanan().find((x) => x.submission_id === r.data.id).Keadaan === 'Datang', 'tetap Datang');
  await ctx.close();
}

// S. Tutup pesanan dari form Stock mengosongkan Tambah masuk yang diisi dari pesanan itu
{
  const { ctx, page } = await buka(390, 844, 'Budi', { rute: '#/stock' });
  const li = page.locator('.pesanan-stock li', { hasText: 'Bawang merah' });
  await li.getByRole('button', { name: /Isi dari pesanan/ }).click();
  await page.waitForTimeout(300);
  cek(await kunci(page, 'Bawang merah', 'masuk').inputValue() === '2' && await page.locator('#pilih-pemasok').inputValue() === 'Sumber Segar', 'terisi');
  await li.getByRole('button', { name: /Tutup pesanan/ }).click();
  await page.waitForTimeout(300);
  const lembar = await page.locator('.lembar').innerText();
  cek(/Tambah masuk Bawang merah yang diisi dari pesanan ini dikosongkan\./.test(lembar), 'konfirmasi menyebut pengosongan', lembar);
  await page.locator('.lembar-aksi').getByRole('button', { name: 'Tutup pesanan' }).click();
  await page.waitForTimeout(1500);
  cek(await kunci(page, 'Bawang merah', 'masuk').inputValue() === '' && await page.locator('#pilih-pemasok').inputValue() === '', 'masuk dan pemasok kosong');
  cek(/ditutup\. Tambah masuk Bawang merah dikosongkan\./.test(await toastTeks(page)), 'pesan singkat', await toastTeks(page));
  cek(await page.evaluate(() => document.activeElement && document.activeElement !== document.body), 'fokus tidak jatuh ke halaman');
  await ctx.close();
}

// T. Isi dari pesanan ditolak di satu kategori: item penghalang disebut dan ditampilkan
{
  pesanServer('Sumber Segar', [{ item: 'Cabai merah', jumlah: 1 }]);
  const { ctx, page } = await buka(390, 844, 'Rina', { rute: '#/stock' });
  await page.selectOption('#pilih-kategori', 'Protein');
  await page.waitForTimeout(200);
  await kunci(page, 'Telur', 'masuk').fill('10');
  await page.selectOption('#pilih-kategori', 'Sayur');
  await page.fill('#cari-item-stock', 'tom');
  await page.waitForTimeout(200);
  await page.locator('.pesanan-stock li', { hasText: 'Cabai merah' }).getByRole('button', { name: /Isi dari pesanan/ }).click();
  await page.waitForTimeout(300);
  const t = await page.locator('.pesanan-stock .pesan-formulir').innerText();
  cek(/Form ini sudah berisi Tambah masuk Telur \(Protein\) tanpa pemasok\./.test(t), 'pesan menyebut item dan kategori', t);
  cek(await page.locator('#pilih-kategori').inputValue() === '' && await page.locator('#cari-item-stock').inputValue() === '' && await kunci(page, 'Telur', 'masuk').isVisible(), 'Semua kategori, Telur terlihat');
  cek(await kunci(page, 'Cabai merah', 'masuk').inputValue() === '', 'Cabai tidak diisi');
  await kunci(page, 'Telur', 'masuk').fill('');
  await ctx.close();
}

// U. Kiriman di antrean bertautan ke pesanan yang lalu ditutup: tetap terkirim
{
  const r = pesanServer('Sumber Segar', [{ item: 'Bawang putih', jumlah: 2 }]);
  let putus = true;
  const { ctx, page } = await buka(390, 844, 'Rina', { rute: '#/stock', putus: (b) => putus && b.action === 'kirimStock' });
  await page.locator('.pesanan-stock li', { hasText: 'Bawang putih' }).getByRole('button', { name: /Isi dari pesanan/ }).click();
  await page.waitForTimeout(300);
  await kunci(page, 'Cabai merah', 'keluar').fill('0,1');
  await page.getByRole('button', { name: 'Kirim stock' }).click();
  await page.waitForTimeout(1500);
  const a0 = await antrean(page, 'rina');
  cek(a0.length === 1 && a0[0].isi.baris.some((b) => b.item === 'Bawang putih' && b.pesanan === r.data.id), 'di antrean dengan tautan', a0.map((e) => e.isi.baris));
  A('tutupPesanan', { id: r.data.id });
  const n0 = barisStock().filter((x) => x['Nama Item'] === 'Bawang putih' && Number(x['Stock Masuk']) > 0).length;
  putus = false;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(2500);
  const a1 = await antrean(page, 'rina');
  cek(a1.length === 0, 'antrean kosong (tidak Gagal kirim)', a1);
  cek(barisStock().filter((x) => x['Nama Item'] === 'Bawang putih' && Number(x['Stock Masuk']) > 0).length === n0 + 1, 'barang masuk tercatat');
  await ctx.close();
}

// W. Dua pesanan dari pemasok yang sama: nama tombol berbeda; klik tengah di laptop ikut mencatat
{
  pesanServer('Sumber Segar', [{ item: 'Minyak goreng', jumlah: 2, satuanOrder: 'besar' }]);
  const { ctx, page, permintaan } = await buka(1366, 768, 'Budi');
  const nama = await page.locator('.belanja-menunggu').getByRole('button', { name: /Tutup pesanan Sumber Segar/ }).evaluateAll((b) => b.map((x) => x.getAttribute('aria-label')));
  cek(nama.length >= 2 && new Set(nama).size === nama.length, 'nama tombol unik', nama);
  const kosong = kelompok(page, 'Belum ada pemasok');
  await orderDi(page, 'Tomat').fill('4');
  await kosong.locator('select').selectOption('Sumber Segar');
  await kosong.locator('a.belanja-wa').click({ button: 'middle' });
  await page.waitForTimeout(1500);
  const cp = permintaan.filter((p) => p.action === 'catatPesanan');
  cek(cp.length === 1 && cp[0].baris[0].item === 'Tomat', 'klik tengah mencatat', cp);
  if (cp[0]) A('tutupPesanan', { id: cp[0].submissionId });
  await ctx.close();
}

// V. Nama pemasok satu kata panjang di 320 px
{
  const panjang = 'Pemasokdengannamapanjangsekalitanpaspasi';
  A('simpanPemasok', { baru: true, nama: panjang, kontak: '0812 1111 2222', catatan: '' });
  pesanServer(panjang, [{ item: 'Tomat', jumlah: 5 }]);
  for (const rute of ['#/laporan', '#/stock']) {
    const { ctx, page } = await buka(320, 568, 'Budi', { rute });
    const m = await page.evaluate((r) => {
      const akar = document.querySelector(r === '#/stock' ? '.pesanan-stock' : '.belanja');
      const kartu = akar.closest('.kartu').getBoundingClientRect();
      const keluar = [...akar.querySelectorAll('*')].filter((e) => {
        const b = e.getBoundingClientRect();
        return b.width && (b.right > kartu.right + 1 || b.left < kartu.left - 1 || e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible');
      }).map((e) => e.className + ':' + (e.textContent || '').slice(0, 20));
      return { lebar: document.documentElement.scrollWidth, keluar: keluar.slice(0, 5), ada: akar.innerText.indexOf('Pemasokdengannamapanjang') >= 0 };
    }, rute);
    cek(m.ada && m.lebar <= 320 && !m.keluar.length, 'nama panjang 320 ' + rute, m);
    await ctx.close();
  }
}

console.log('lulus', lulus, 'gagal', gagal, 'galat konsol', galat, 'ERR log', H.logs.filter((l) => l.startsWith('ERR')));
await browser.close();
srv.close();
