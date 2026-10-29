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
    if (opsi.serverLama && out.ok && out.data) {
      const buang = (o) => { if (o && typeof o === 'object') { delete o.ubahBanyakSiap; } };
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

// A. Daftar item: dua tautan; server lama tanpa tautan
{
  const a = await buka(390, 844, 'Budi', { rute: '#/pengaturan/item' });
  cek(await a.page.getByRole('link', { name: 'Ganti harga beberapa item' }).isVisible() && await a.page.getByRole('link', { name: 'Tambah dari Excel/Sheets' }).isVisible(), 'dua tautan');
  await a.ctx.close();
  const b = await buka(390, 844, 'Budi', { rute: '#/pengaturan/item', serverLama: true });
  cek(!(await b.page.getByRole('link', { name: 'Ganti harga beberapa item' }).isVisible()), 'server lama: tanpa tautan');
  await b.ctx.close();
}

// B. Ganti harga beberapa item
{
  const { ctx, page, permintaan } = await buka(390, 844, 'Budi', { rute: '#/pengaturan/item-harga' });
  const isi = await page.locator('#layar').innerText();
  cek(/Sekarang Rp 15\.000 per kg/.test(isi) && /Sekarang belum punya harga/.test(isi), 'baris harga sekarang', isi.slice(0, 500));
  cek(/Belum ada harga baru/.test(isi) && await page.getByRole('button', { name: 'Simpan harga' }).isDisabled(), 'awal: tombol nonaktif');
  await page.getByLabel('Harga baru Tomat per kg').fill('16.000');
  await page.getByLabel('Harga baru Sambal dasar per kg').fill('45000');
  await page.getByLabel('Harga baru Telur per butir').fill('abc');
  await page.waitForTimeout(200);
  const t2 = await page.locator('#layar').innerText();
  cek(/Naik Rp 1\.000\./.test(t2) && /Harga pertama, berlaku sejak awal\./.test(t2) && /3 item, 1 angkanya salah\./.test(t2), 'keterangan per baris', t2.slice(0, 900));
  // Draft tetap sesudah dimuat ulang
  await page.reload();
  await page.waitForTimeout(1800);
  cek(await page.getByLabel('Harga baru Tomat per kg').inputValue() === '16.000', 'draft sesudah dimuat ulang');
  await page.getByRole('button', { name: 'Simpan harga' }).click();
  await page.waitForTimeout(300);
  cek(/Angka harga Telur salah/.test(await page.locator('#layar').innerText()), 'angka salah ditolak di HP');
  cek(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('aria-label')) === 'Harga baru Telur per butir', 'fokus ke kolom salah');
  await page.getByLabel('Harga baru Telur per butir').fill('');
  // Cari: isian tersembunyi tetap ikut
  await page.getByLabel('Cari item').fill('tom');
  await page.waitForTimeout(200);
  cek(/1 harga baru yang sudah diketik tidak tampil karena pencarian/.test(await page.locator('#layar').innerText()), 'keterangan tersembunyi');
  await page.getByRole('button', { name: 'Simpan harga' }).click();
  await page.waitForTimeout(400);
  const L = lembar(page);
  const tl = await L.innerText();
  cek(/Simpan harga 2 item\?/.test(tl) && /Tomat: Rp 15\.000 → Rp 16\.000/.test(tl) && /Sambal dasar: harga pertama Rp 45\.000/.test(tl), 'konfirmasi', tl);
  await L.getByRole('button', { name: 'Simpan harga' }).click();
  await page.waitForTimeout(1500);
  const kirim = permintaan.filter((b) => b.action === 'gantiHargaBanyak').pop();
  cek(kirim && kirim.harga.length === 2 && kirim.harga.find((x) => x.nama === 'Tomat').harga === 16000, 'yang dikirim', kirim);
  cek(/Harga 2 item tersimpan/.test(await toastTeks(page)) && /#\/pengaturan\/item$/.test(page.url()), 'pesan dan kembali ke daftar', [await toastTeks(page), page.url()]);
  cek(itemSrv('Tomat').harga === 16000 && itemSrv('Sambal dasar').harga === 45000, 'server');
  await ctx.close();
}

// C. Tanggal lain
{
  const { ctx, page, permintaan } = await buka(390, 844, 'Budi', { rute: '#/pengaturan/item-harga' });
  await page.getByText('Tanggal lain').click();
  const kemarin = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  await page.getByLabel('Tanggal berlaku').fill(kemarin);
  await page.getByLabel('Harga baru Telur per butir').fill('2300');
  await page.getByRole('button', { name: 'Simpan harga' }).click();
  await page.waitForTimeout(300);
  await lembar(page).getByRole('button', { name: 'Simpan harga' }).click();
  await page.waitForTimeout(1500);
  const kirim = permintaan.filter((b) => b.action === 'gantiHargaBanyak').pop();
  cek(kirim && kirim.berlakuMulai === kemarin, 'tanggal lain dikirim', kirim);
  await ctx.close();
}

// D. Tempel dengan baris judul dan satu baris salah
{
  const { ctx, page, permintaan } = await buka(390, 844, 'Budi', { rute: '#/pengaturan/item-tempel' });
  const teks = 'Nama Item\tKategori\tSatuan\tHarga\tStok minimum\nWortel\tSayur\tkg\tRp 12.000\t1,5\nApel\tBuah\tkg\t20000\t\nSirup\tMinuman\tbotol\t\t2';
  await page.getByLabel('Tempel baris item').fill(teks);
  await page.waitForTimeout(300);
  const isi = await page.locator('#layar').innerText();
  cek(/Baris 2 · Wortel/.test(isi) && /Sayur · kg · Rp 12\.000 · minimum 1,5/.test(isi) && /Kategori "Buah" tidak ada/.test(isi) && /2 item siap, 1 baris salah/.test(isi), 'pratinjau', isi.slice(0, 900));
  await page.getByRole('button', { name: 'Tambah 2 item' }).click();
  await page.waitForTimeout(300);
  cek(/1 baris yang salah tidak ikut/.test(await lembar(page).innerText()), 'konfirmasi menyebut baris salah');
  await lembar(page).getByRole('button', { name: 'Tambah 2 item' }).click();
  await page.waitForTimeout(1500);
  const kirim = permintaan.filter((b) => b.action === 'tambahItemBanyak').pop();
  cek(kirim && kirim.baris.length === 2 && kirim.baris[0].harga === 12000 && kirim.baris[0].stokMin === 1.5, 'yang dikirim', kirim);
  cek(itemSrv('Wortel') && itemSrv('Sirup') && itemSrv('Wortel').harga === 12000, 'server menambah');
  const sisa = await page.getByLabel('Tempel baris item').inputValue();
  cek(sisa === 'Nama Item\tKategori\tSatuan\tHarga\tStok minimum\nApel\tBuah\tkg\t20000\t', 'sisa baris salah dengan judul', sisa);
  cek(/2 item ditambahkan\. 1 baris yang salah masih di kotak tempel/.test(await toastTeks(page)), 'pesan');
  // Tanpa judul: urutan tetap
  await page.getByLabel('Tempel baris item').fill('Kol\tSayur\tkg\t8000\t1\t4\t\t\t5');
  await page.waitForTimeout(300);
  cek(/Sayur · kg · Rp 8\.000 · minimum 1 · maksimum 4 · masa simpan 5 hari/.test(await page.locator('#layar').innerText()), 'tanpa judul');
  await page.getByLabel('Tempel baris item').fill('Wortel\tSayur\tkg');
  await page.waitForTimeout(300);
  cek(/Item Wortel sudah ada/.test(await page.locator('#layar').innerText()) && await page.getByRole('button', { name: 'Tambah item' }).isDisabled(), 'sudah ada → nonaktif');
  await ctx.close();
}


// F. Perbaikan sesudah telaah (butir 368)
{
  // Harga dibanding harga pada tanggal berlaku; koma ribuan ditolak; semua sama.
  const { ctx, page, permintaan } = await buka(390, 844, 'Budi', { rute: '#/pengaturan/item-harga' });
  const kemarin = hari(-1);
  await page.getByLabel('Harga baru Tomat per kg').fill('16000');
  await page.waitForTimeout(200);
  cek(/Sama dengan harga sekarang, jadi tidak berubah\./.test(await page.locator('#layar').innerText()), 'hari ini: sama dengan sekarang');
  await page.getByText('Tanggal lain').click();
  await page.getByLabel('Tanggal berlaku').fill(kemarin);
  await page.waitForTimeout(200);
  const t1 = await page.locator('#layar').innerText();
  cek(new RegExp('Naik Rp 1\\.000 dari harga pada ' + pendek(kemarin) + ' \\(Rp 15\\.000\\)\\.').test(t1), 'tanggal lain: dibanding harga pada tanggal itu', t1.slice(0, 700));
  await page.getByLabel('Harga baru Tomat per kg').fill('15000');
  await page.getByLabel('Harga baru Daging sapi per kg').fill('15,000');
  await page.waitForTimeout(200);
  const t2 = await page.locator('#layar').innerText();
  cek(new RegExp('Sama dengan harga pada ' + pendek(kemarin) + ', jadi tidak berubah').test(t2) && /"15,000" bisa dibaca dua cara/.test(t2) && /2 item, 1 angkanya salah/.test(t2), 'sama pada tanggal itu dan koma ribuan', t2.slice(0, 900));
  await page.getByLabel('Harga baru Daging sapi per kg').fill('');
  await page.getByRole('button', { name: 'Simpan harga' }).click();
  await page.waitForTimeout(300);
  cek(/Tomat: Rp 15\.000 → Rp 15\.000/.test(await lembar(page).innerText()), 'konfirmasi memakai harga pada tanggal itu', await lembar(page).innerText());
  await lembar(page).getByRole('button', { name: 'Simpan harga' }).click();
  await page.waitForTimeout(1500);
  cek(/Tidak ada harga yang berubah\. Tomat tidak berubah karena harganya sama/.test(await toastTeks(page)), 'pesan semua sama', await toastTeks(page));
  await ctx.close();
}
{
  // Tombol Simpan nonaktif selama daftar item belum dimuat, walau draft berisi.
  H.aksi({ action: 'login', nama: 'Budi', pin: '482915' });
  const { ctx, page } = await buka(390, 844, 'Budi', { tunda: (b) => b.action === 'daftarItem' });
  await page.evaluate(() => {
    localStorage.setItem('inventoryku:p:budi:draft:item-harga', JSON.stringify({ data: { tanggal: '', harga: { tomat: '17000' } }, waktu: Date.now() }));
    location.hash = '#/pengaturan/item-harga';
  });
  await page.waitForTimeout(800);
  cek(await page.getByRole('button', { name: 'Simpan harga' }).isDisabled(), 'tombol nonaktif sebelum data dimuat');
  await page.waitForTimeout(3000);
  cek(!(await page.getByRole('button', { name: 'Simpan harga' }).isDisabled()), 'aktif sesudah data dimuat (draft)');
  await ctx.close();
}
{
  // Tempelan: angka ribuan, judul palsu, sel berkutip, nomor baris dari server, pratinjau dimuat ulang.
  const { ctx, page, permintaan } = await buka(390, 844, 'Budi', { rute: '#/pengaturan/item-tempel' });
  await page.getByLabel('Tempel baris item').fill('Item\tSayur\tkg\nLabu\tSayur\tkg\t15,000');
  await page.waitForTimeout(300);
  const t1 = await page.locator('#layar').innerText();
  cek(/Baris 1 · Item/.test(t1) && /Harga "15,000" bisa dibaca dua cara/.test(t1), 'judul palsu dan koma ribuan', t1.slice(0, 700));
  const teks = 'Nama\tKategori\tSatuan\tHarga\tStok minimum\tStok maksimum\n"Saus ""khusus""\nrumah"\tSayur\tkg\t1.250.000\t1.000\t2.000\n"Jeruk\nbali"\tBuah\tkg\nTalas\tSayur\tkg\t2500\t0.250\t0,5\nPepaya\tSayur\tkg';
  await page.getByLabel('Tempel baris item').fill(teks);
  await page.waitForTimeout(300);
  const t2 = await page.locator('#layar').innerText();
  cek(/Baris 2 · Saus "khusus" rumah/.test(t2) && /Rp 1\.250\.000 · minimum 1\.000 · maksimum 2\.000/.test(t2) && /Baris 4 · Jeruk bali/.test(t2) &&
    /Baris 6 · Talas/.test(t2) && /Rp 2\.500 · minimum 0,25 · maksimum 0,5/.test(t2) && /Baris 7 · Pepaya/.test(t2), 'sel berkutip dan angka', t2.slice(t2.indexOf('Baris 6'), t2.indexOf('Baris 6') + 200));
  // Pepaya ditambah dari HP lain: server menolak dengan nomor baris tempelan, pratinjau ikut dimuat ulang.
  A('tambahItemBanyak', { baris: [{ nama: 'Pepaya', kategori: 'Sayur', satuan: 'kg' }] });
  await page.getByRole('button', { name: 'Tambah 3 item' }).click();
  await page.waitForTimeout(300);
  await lembar(page).getByRole('button', { name: 'Tambah 3 item' }).click();
  await page.waitForTimeout(1500);
  const kirim = permintaan.filter((b) => b.action === 'tambahItemBanyak').pop();
  cek(kirim.baris.map((b) => b.no).join() === '2,6,7' && kirim.baris[0].harga === 1250000 && kirim.baris[0].stokMin === 1000, 'no dan angka dikirim', kirim);
  cek(/Baris 7 \(Pepaya\): Item Pepaya sudah ada/.test(await lembar(page).innerText()), 'pesan server memakai nomor baris tempelan', await lembar(page).innerText());
  await lembar(page).getByRole('button', { name: 'Batal' }).click();
  await page.waitForTimeout(300);
  const t3 = await page.locator('#layar').innerText();
  cek(/Item Pepaya sudah ada/.test(t3) && /2 item siap, 2 baris salah/.test(t3), 'pratinjau dimuat ulang', t3.slice(0, 1200));
  await page.getByRole('button', { name: 'Tambah 2 item' }).click();
  await page.waitForTimeout(300);
  await lembar(page).getByRole('button', { name: 'Tambah 2 item' }).click();
  await page.waitForTimeout(1500);
  const sisa = await page.getByLabel('Tempel baris item').inputValue();
  cek(sisa === 'Nama\tKategori\tSatuan\tHarga\tStok minimum\tStok maksimum\n"Jeruk\nbali"\tBuah\tkg\nPepaya\tSayur\tkg', 'sisa: judul dan baris salah utuh', sisa);
  cek(itemSrv('Saus "khusus" rumah') && itemSrv('Talas').stokMin === 0.25, 'server');
  await ctx.close();
}

// E. Delapan ukuran
for (const [w, h] of [[320, 568], [360, 740], [390, 844], [430, 932], [768, 1024], [1024, 768], [1366, 768], [1920, 1080]]) {
  for (const rute of ['#/pengaturan/item', '#/pengaturan/item-harga', '#/pengaturan/item-tempel']) {
    const x = await buka(w, h, 'Budi', { rute });
    if (rute.endsWith('tempel')) {
      await x.page.getByLabel('Tempel baris item').fill('Nama\tKategori\tSatuan\nBahanDenganNamaYangSangatPanjangSekali1234567\tBuahTidakAdaSamaSekaliDiDaftar\tkg\nLabu\tSayur\tkg');
      await x.page.waitForTimeout(300);
    }
    if (rute.endsWith('harga')) {
      await x.page.getByLabel('Harga baru Tomat per kg').fill('xyz');
      await x.page.waitForTimeout(200);
    }
    const m = await x.page.evaluate(() => {
      const lebar = document.documentElement.scrollWidth;
      const akar = document.querySelector('#layar');
      const kecil = [...akar.querySelectorAll('button, a, input, select, textarea')].filter((e) => e.offsetParent && !e.closest('.menu') && e.type !== 'radio')
        .map((e) => [e.textContent.trim().slice(0, 30) || e.tagName, Math.round(e.getBoundingClientRect().height)]).filter((y) => y[1] < 44);
      const keluar = [...akar.querySelectorAll('*')].filter((e) => { if (e.closest('textarea')) return false; const b = e.getBoundingClientRect(); return b.width && (b.right > innerWidth + 1 || b.left < -1); })
        .map((e) => e.className || e.tagName).slice(0, 5);
      return { lebar, kecil, keluar };
    });
    cek(m.lebar <= w && !m.kecil.length && !m.keluar.length, `ukuran ${w}x${h} ${rute}`, m);
    await x.ctx.close();
  }
}

console.log('lulus', lulus, 'gagal', gagal, 'galat konsol', galat, 'ERR log', H.logs.filter((l) => l.startsWith('ERR')));
await browser.close();
srv.close();
