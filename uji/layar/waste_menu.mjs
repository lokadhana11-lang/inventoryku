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
    if (opsi.ubah && out.ok && out.data) opsi.ubah(out.data, body.action);
    if (opsi.serverLama && out.ok && out.data) {
      const buang = (o) => {
        if (!o || typeof o !== 'object') return;
        delete o.menu; delete o.menuSiap; if (o.form) { delete o.form.menu; delete o.form.menuSiap; }
        
      };
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
let n = 0; const sid = () => 'wmUI-' + (++n) + '-' + Math.random().toString(36).slice(2, 10);
const toastTeks = async (page) => (await page.locator('.toast').allInnerTexts()).join(' | ');
const teks = async (page) => (await page.locator('#layar').innerText()).replace(/ /g, ' ');
const fmt = (n) => 'Rp ' + Math.round(n).toLocaleString('id-ID');
const akhir = (tg, nama) => A('formStock', { tanggal: tg }).data.item.find((i) => i.nama === nama).akhir;
const barisWaste = () => {
  const v = H.ss.getSheetByName('Data_Waste').getDataRange().getValues();
  return v.slice(1).map((r) => Object.fromEntries(v[0].map((j, i) => [j, r[i]])));
};
const hpp = (nama) => H.fungsi('hppSemuaMenu_', hariIni, true).find((m) => m.nama === nama).hpp;
async function tambahMenu(page, nama) {
  await page.getByRole('button', { name: 'Tambah menu' }).click();
  await page.waitForTimeout(400);
  await page.locator('.lembar').getByRole('listitem').filter({ hasText: nama }).first().click();
  await page.waitForTimeout(400);
}

// A. Staff di HP
{
  const ayam0 = akhir(hariIni, 'Ayam fillet');
  const { ctx, page } = await buka(390, 844, 'Rina', { rute: '#/waste', sentuh: true });
  const tm = page.getByRole('button', { name: 'Tambah menu' });
  cek(await tm.isVisible(), 'Staff: tombol Tambah menu tampil');
  await tm.click();
  await page.waitForTimeout(400);
  const lt = (await page.locator('.lembar').innerText()).replace(/ /g, ' ');
  cek(/salah order atau dikembalikan pelanggan/.test(lt) && /tidak dikurangi lagi dari stock/.test(lt) && !/HPP|Rp/.test(lt) && /Ayam geprek/.test(lt), 'Staff: lembar menu tanpa rupiah', lt);
  await page.locator('.lembar').getByRole('listitem').filter({ hasText: 'Ayam geprek' }).click();
  await page.waitForTimeout(400);
  const kartu = page.locator('article.kartu-item');
  const kt = await kartu.innerText();
  cek(/Ayam geprek\s*Menu/.test(kt) && /Porsi/.test(kt) && /porsi/.test(kt) && /tidak dikurangi lagi dari stock/.test(kt) && !/Estimasi/.test(kt), 'Staff: kartu menu', kt);
  cek(await kartu.locator('input[type=radio][value="Kesalahan Order"]').isChecked(), 'Staff: Kesalahan Order terpilih');
  const inQ = kartu.locator('input.isian-angka');
  cek((await inQ.getAttribute('inputmode')) === 'numeric', 'porsi: papan angka bulat');
  await inQ.fill('1,5');
  await page.waitForTimeout(200);
  cek(/bilangan bulat/.test(await kartu.innerText()), 'porsi 1,5: galat bilangan bulat');
  await page.getByText('Malam', { exact: true }).click();
  await page.getByRole('button', { name: 'Kirim waste' }).click();
  await page.waitForTimeout(500);
  cek(/Isi porsi Ayam geprek dengan bilangan bulat/.test(await teks(page)), 'kirim ditolak di HP: porsi pecahan');
  await inQ.fill('2');
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Kirim waste' }).click();
  await page.waitForTimeout(1500);
  cek(/Waste terkirim/.test(await toastTeks(page)), 'Staff: terkirim', await toastTeks(page));
  const b = barisWaste().filter((x) => x['Item / Produk'] === 'Ayam geprek').pop();
  cek(b && b.Menu === 'Ya' && b.Qty === 2 && b.Satuan === 'porsi' && b['Nama Staff'] === 'Rina', 'server: baris menu tercatat', b);
  cek(akhir(hariIni, 'Ayam fillet') === ayam0, 'stock Ayam fillet tetap');
  cek(/Ayam geprek 2 porsi/.test(await teks(page)), 'status Tercatat menyebut porsi', (await teks(page)).slice(0, 600));
  await ctx.close();
}
// B. Pengelola desktop: tabel, HPP, item dan menu dalam satu kiriman
{
  const { ctx, page } = await buka(1366, 768, 'Budi', { rute: '#/waste' });
  await page.getByRole('button', { name: 'Tambah menu' }).click();
  await page.waitForTimeout(400);
  const lt = (await page.locator('.lembar').innerText()).replace(/ /g, ' ');
  cek(lt.includes('HPP ' + fmt(hpp('Ayam geprek')) + ' per porsi'), 'Pengelola: HPP per porsi di lembar', lt);
  await page.locator('.lembar').getByRole('listitem').filter({ hasText: 'Ayam geprek' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('textbox', { name: 'Porsi Ayam geprek' }).fill('3');
  await page.waitForTimeout(200);
  const tr = page.locator('table.tabel-waste tbody tr').first();
  const tt = (await tr.innerText()).replace(/ /g, ' ');
  cek(/Menu/.test(tt) && /Stock bahan tidak berubah/.test(tt) && tt.includes(fmt(3 * hpp('Ayam geprek'))) && /porsi/.test(tt), 'tabel: baris menu dengan estimasi HPP', tt);
  await page.getByRole('button', { name: 'Tambah item' }).click();
  await page.waitForTimeout(400);
  await page.locator('.lembar input[type=search]').fill('Tomat');
  await page.waitForTimeout(200);
  await page.locator('.lembar').getByRole('listitem').filter({ hasText: 'Tomat' }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole('textbox', { name: 'Qty Tomat' }).fill('0,2');
  await page.locator('table.tabel-waste tbody tr').nth(1).getByText('Rusak', { exact: true }).click();
  await page.getByText('Siang', { exact: true }).click();
  const n0 = barisWaste().length;
  await page.getByRole('button', { name: 'Kirim waste' }).click();
  await page.waitForTimeout(1500);
  const bw = barisWaste();
  cek(bw.length === n0 + 2 && bw.some((x) => x['Item / Produk'] === 'Ayam geprek' && x.Qty === 3 && x.Menu === 'Ya') && bw.some((x) => x['Item / Produk'] === 'Tomat' && x.Qty === 0.2 && x.Menu === ''), 'kiriman menu + item', bw.slice(-3));
  // Riwayat: nama menu tidak membuka riwayat item
  await page.evaluate(() => { location.hash = '#/riwayat'; });
  await page.waitForTimeout(1500);
  await page.locator('#layar').getByText('Waste', { exact: true }).first().click();
  await page.waitForTimeout(1200);
  const r = (await teks(page));
  cek(/Ayam geprek \(menu\)/.test(r), 'Riwayat daftar: (menu)', r.slice(0, 900));
  await page.getByText('Ayam geprek (menu)').first().click();
  await page.waitForTimeout(1200);
  const tombolMenuNama = await page.locator('button.tabel-tombol', { hasText: 'Ayam geprek' }).count();
  const tombolTomat = await page.locator('button.tabel-tombol', { hasText: 'Tomat' }).count();
  cek(tombolMenuNama === 0 && tombolTomat >= 1 && (await page.locator('.tanda-menu').count()) >= 1, 'detail Riwayat: menu tanpa tombol riwayat item', { tombolMenuNama, tombolTomat });
  await ctx.close();
}
// C. Server lama: tanpa Tambah menu
{
  const { ctx, page } = await buka(390, 844, 'Budi', { rute: '#/waste', serverLama: true });
  cek(!(await page.getByRole('button', { name: 'Tambah menu' }).isVisible()), 'server lama: tombol Tambah menu tersembunyi');
  cek(await page.getByRole('button', { name: 'Tambah item' }).isVisible(), 'server lama: Tambah item tetap');
  await ctx.close();
}
// D. Tanpa sinyal: masuk antrean dengan baris menu
{
  const { ctx, page, permintaan } = await buka(390, 844, 'Rina', { rute: '#/waste', sentuh: true, putus: (b) => b.action === 'kirimWaste' });
  await tambahMenu(page, 'Telur balado');
  await page.locator('article.kartu-item input.isian-angka').fill('1');
  await page.getByText('Pagi', { exact: true }).click();
  await page.getByRole('button', { name: 'Kirim waste' }).click();
  await page.waitForTimeout(1500);
  const antre = await page.evaluate(() => Object.keys(localStorage).filter((k) => /antrean/.test(k)).map((k) => localStorage.getItem(k)).join(''));
  cek(/Tersimpan di HP/.test(await toastTeks(page)) && /"menu":"Telur balado"/.test(antre), 'antrean: baris menu tersimpan', antre.slice(0, 300));
  await ctx.close();
}
// E. Layar HPP: waste menu dan porsi terbuang
{
  const kemarin = hari(-1);
  A('kirimWaste', { submissionId: sid(), tanggal: kemarin, shift: 'Malam', waktuPerangkat: new Date().toISOString(), baris: [{ menu: 'Ayam geprek', kategori: 'Kesalahan Order', qty: 2, alasan: '' }] });
  const h = A('hpp', { bulan: kemarin.slice(0, 7) }).data;
  const { ctx, page } = await buka(390, 844, 'Budi', { rute: '#/hpp' });
  await page.waitForTimeout(1500);
  const t = await teks(page);
  cek(new RegExp('Waste menu ' + h.pemakaian.wasteMenu.porsi + ' porsi').test(t) && /sudah termasuk di Terpakai/.test(t), 'HPP: waste menu di Pemakaian bahan', t.match(/Waste menu[^\n]*/));
  if (h.teoritis.lengkap) cek(/Termasuk di selisih: \d+ porsi terbuang/.test(t) && /Selisih tanpa porsi terbuang/.test(t), 'HPP: porsi terbuang di Seharusnya vs nyata', t.match(/Termasuk[^\n]*/));
  else cek(true, 'teoritis belum lengkap');
  await ctx.close();
}
// F. Delapan ukuran: layar Waste dengan baris menu terbuka
for (const [w, hh] of [[320, 568], [360, 740], [390, 844], [430, 932], [768, 1024], [1024, 768], [1366, 768], [1920, 1080]]) {
  const x = await buka(w, hh, 'Budi', { rute: '#/waste', sentuh: w < 1024 });
  await tambahMenu(x.page, 'Ayam geprek');
  const m = await x.page.evaluate(() => {
    const keluar = [...document.querySelectorAll('#layar *')].filter((e) => { const b = e.getBoundingClientRect(); return b.width && (b.right > innerWidth + 1 || b.left < -1) && !e.closest('.tabel-bingkai'); }).map((e) => e.className).slice(0, 3);
    const kecil = [...document.querySelectorAll('.deret-tambah .tombol')].filter((e) => e.getBoundingClientRect().height < 44).length;
    return { lebar: document.documentElement.scrollWidth, keluar, kecil, tanda: !!document.querySelector('.tanda-menu') };
  });
  cek(m.lebar <= w && !m.keluar.length && !m.kecil && m.tanda, `ukuran ${w}x${hh}`, m);
  await x.ctx.close();
}
console.log('lulus', lulus, 'gagal', gagal, 'galat konsol', galat, 'ERR log', H.logs.filter((l) => l.startsWith('ERR')));
await browser.close();
srv.close();
