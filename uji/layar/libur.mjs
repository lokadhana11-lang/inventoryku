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
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'Asia/Jakarta', locale: 'id-ID', serviceWorkers: 'block',
    reducedMotion: opsi.gerak ? 'no-preference' : 'reduce', hasTouch: !!opsi.sentuh, isMobile: !!opsi.sentuh });
  const permintaan = [];
  await ctx.route('https://api.uji/**', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    permintaan.push(body);
    if (opsi.putus && opsi.putus(body)) { await route.abort('internetdisconnected'); return; }
    let out;
    if (opsi.serverLama && /Libur$/.test(body.action)) out = { ok: false, pesan: 'Aksi tidak dikenal. Muat ulang aplikasi, lalu coba lagi.' };
    else out = H.aksi(body);
    if (opsi.serverLama && out.ok && out.data) {
      const buang = (o) => { if (o && typeof o === 'object') { delete o.libur; delete o.liburBesok; if (o.beranda) buang(o.beranda); if (o.penjualan) delete o.penjualan.libur; } };
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
  await page.keyboard.type({ Budi: '482915', Rina: '730264', Sari: '916205' }[siapa], { delay: 30 });
  await page.waitForTimeout(1500);
  if (opsi.rute) {
    await page.evaluate((r) => { location.hash = r; }, opsi.rute);
    await page.waitForTimeout(1500);
  }
  return { ctx, page, permintaan };
}
const toastTeks = (page) => page.locator('.toast').last().innerText().catch(() => '');
const lembar = (page) => page.locator('.lembar');

// A. Pengaturan → Hari libur kosong, Tambah hari ini dengan keterangan
{
  const { ctx, page } = await buka(390, 844, 'Budi', { rute: '#/pengaturan' });
  const baris = page.locator('a.daftar-baris[href="#/pengaturan/libur"]');
  cek(await baris.count() === 1 && /Hari libur/.test(await baris.innerText()), 'baris Pengaturan');
  await baris.click();
  await page.waitForTimeout(1200);
  cek(/Belum ada hari libur\. Ketuk Tambah/.test(await page.locator('.kosong').innerText()), 'kotak kosong');
  await page.getByRole('button', { name: 'Tambah' }).click();
  await page.waitForTimeout(400);
  const L = lembar(page);
  cek(/Tambah hari libur/.test(await L.innerText()), 'lembar Tambah');
  const radio = L.locator('input[type=radio]');
  cek(await radio.count() === 3 && !(await radio.evaluateAll((r) => r.some((x) => x.checked))), 'tanpa pilihan awal');
  cek(await L.getByText('Hari ini, ' + pendek(hariIni)).count() === 1 && await L.getByText('Besok, ' + pendek(hari(1))).count() === 1, 'label bertanggal');
  await L.getByRole('button', { name: 'Simpan hari libur' }).click();
  await page.waitForTimeout(300);
  cek(/Pilih tanggal libur/.test(await L.innerText()), 'galat tanpa tanggal');
  await L.getByText('Hari ini, ' + pendek(hariIni)).click();
  await page.waitForTimeout(200);
  const akibat = await L.locator('.kolom-bantuan[aria-live]').innerText();
  cek(/Staff melihat Hari libur di Beranda/.test(akibat), 'kalimat akibat hari ini', akibat);
  cek(/sudah ada isian Suhu/.test(await L.innerText()), 'peringatan isian hari ini', await L.innerText());
  await L.getByLabel('Keterangan (tidak wajib)').fill('Lebaran');
  await L.getByRole('button', { name: 'Simpan hari libur' }).click();
  await page.waitForTimeout(1200);
  const t = await toastTeks(page);
  cek(/tersimpan\. Tanggal ini sudah punya isian Suhu; isiannya tetap tersimpan\./.test(t), 'toast simpan + isian', t);
  const isi = await page.locator('.layar-isi').innerText();
  cek(/Akan datang/.test(isi) && /Lebaran · Ditandai Budi/.test(isi) && /Hari ini/.test(isi), 'daftar Akan datang', isi);
  // Tambah berikutnya: besok dengan keterangan yang sama
  await page.getByRole('button', { name: 'Tambah' }).click();
  await page.waitForTimeout(400);
  const L2 = lembar(page);
  const pilihBesok = await L2.locator('input[type=radio]').nth(1).isChecked();
  cek(pilihBesok && await L2.getByLabel('Keterangan (tidak wajib)').inputValue() === 'Lebaran', 'Tambah berikutnya: besok dan keterangan sama');
  await L2.getByRole('button', { name: 'Simpan hari libur' }).click();
  await page.waitForTimeout(1200);
  cek(A('daftarLibur', {}).data.libur.length === 2, 'dua hari libur tersimpan');
  await ctx.close();
}

// B. Beranda Pengelola dan Staff pada hari libur
{
  const { ctx, page } = await buka(390, 844, 'Budi');
  const kem = await page.locator('.kemajuan-teks').innerText();
  cek(/Hari libur: Lebaran/.test(kem), 'kemajuan Hari libur', kem);
  cek(await page.locator('.rel').isHidden(), 'rel tersembunyi');
  const tiket = await page.locator('.tiket[data-form="PREP"]').innerText();
  cek(/Hari libur/.test(tiket) && /Tidak ditagih hari ini/.test(tiket), 'tiket Prep', tiket);
  cek(/sebagian|3 dari 9/i.test(await page.locator('.tiket[data-form="SUHU"]').innerText()), 'tiket Suhu tetap sebagian');
  const hl = page.locator('a.daftar-baris[href="#/pengaturan/libur"]');
  cek(await hl.count() === 1 && /Hari ini hari libur/.test(await hl.innerText()) && /Lebaran\. Ditandai Budi/.test(await hl.innerText()) && /Ditandai Budi/.test(await hl.innerText()), 'baris Hari ini hari libur', await hl.innerText().catch(() => ''));
  await ctx.close();
  const st = await buka(390, 844, 'Rina');
  cek(/Hari libur: Lebaran/.test(await st.page.locator('.kemajuan-teks').innerText()), 'Staff: kemajuan Hari libur');
  cek(await st.page.locator('a[href="#/pengaturan/libur"]').count() === 0, 'Staff: tanpa baris Pengaturan');
  await st.ctx.close();
}

// C. Dashboard
{
  const { ctx, page } = await buka(390, 844, 'Budi', { rute: '#/dashboard' });
  const ubin = await page.locator('.ubin-lebar').innerText();
  cek(/Libur/.test(ubin) && /tidak ada form yang ditagih/.test(ubin), 'ubin Form terisi Libur', ubin);
  cek(!/form belum lengkap/i.test(await page.locator('.dashboard').innerText()), 'tanpa butir form belum lengkap');
  await ctx.close();
}

// D. Lembar ubah dan hapus (besok), lalu hari ini dengan semua form lengkap: tanpa kilau
{
  const { ctx, page } = await buka(390, 844, 'Budi', { rute: '#/pengaturan/libur' });
  // Baris kedua (besok)
  await page.locator('button.daftar-baris').nth(1).click();
  await page.waitForTimeout(400);
  let L = lembar(page);
  cek(/Ditandai Budi/.test(await L.innerText()) && await L.getByRole('button', { name: 'Simpan' }).isEnabled(), 'lembar ubah: Simpan aktif');
  await L.getByLabel('Keterangan (tidak wajib)').fill('Lebaran hari 2');
  await L.getByRole('button', { name: 'Simpan' }).click();
  await page.waitForTimeout(1000);
  cek(/Lebaran hari 2/.test(await page.locator('.layar-isi').innerText()), 'keterangan diubah');
  await page.locator('button.daftar-baris').nth(1).click();
  await page.waitForTimeout(400);
  await lembar(page).getByRole('button', { name: 'Hapus hari libur' }).click();
  await page.waitForTimeout(400);
  L = lembar(page);
  cek(/Hapus hari libur .*\?/.test(await L.locator('.lembar-judul').innerText()) && /ditagih lagi seperti hari biasa/.test(await L.innerText()), 'konfirmasi besok');
  await L.getByRole('button', { name: 'Batal' }).click();
  await page.waitForTimeout(400);
  cek(A('daftarLibur', {}).data.libur.length === 2, 'Batal: tetap');
  await page.locator('button.daftar-baris').nth(1).click();
  await page.waitForTimeout(400);
  await lembar(page).getByRole('button', { name: 'Hapus hari libur' }).click();
  await page.waitForTimeout(400);
  await lembar(page).getByRole('button', { name: 'Hapus hari libur' }).click();
  await page.waitForTimeout(1200);
  cek(/dihapus\./.test(await toastTeks(page)) && A('daftarLibur', {}).data.libur.length === 1, 'hapus besok');
  // Hari ini: konfirmasi menyebut pengingat yang sudah lewat
  await page.locator('button.daftar-baris').first().click();
  await page.waitForTimeout(400);
  await lembar(page).getByRole('button', { name: 'Hapus hari libur' }).click();
  await page.waitForTimeout(400);
  cek(/Pengingat cek suhu yang jamnya sudah lewat tidak dikirim ulang/.test(await lembar(page).innerText()), 'konfirmasi hari ini');
  await lembar(page).getByRole('button', { name: 'Batal' }).click();
  await ctx.close();
}

// E. Tanggal lain: jauh ditolak, tanggal lewat menampilkan kalimat rekap, tanggal yang sudah libur
{
  const { ctx, page } = await buka(1366, 768, 'Budi', { rute: '#/pengaturan/libur' });
  await page.getByRole('button', { name: 'Tambah' }).click();
  await page.waitForTimeout(400);
  const L = lembar(page);
  await L.getByText('Tanggal lain').click();
  const tgl = L.locator('input[type=date]');
  cek(await tgl.isVisible() && await tgl.getAttribute('max') === hari(366), 'pemilih tanggal dengan max');
  await tgl.fill(hari(-4));
  await page.waitForTimeout(200);
  cek(/Email dan rekap yang sudah terkirim tidak berubah/.test(await L.innerText()), 'kalimat tanggal lewat');
  await tgl.fill(hariIni);
  await page.waitForTimeout(200);
  cek(/sudah hari libur/.test(await L.innerText()), 'kalimat sudah libur');
  await tgl.fill(hari(400));
  await L.getByRole('button', { name: 'Simpan hari libur' }).click();
  await page.waitForTimeout(400);
  cek(/paling jauh setahun/.test(await L.innerText()), 'tanggal jauh ditolak di HP');
  await L.getByRole('button', { name: 'Batal' }).click();
  await ctx.close();
}

// F. Form kustom pada hari libur, dan Beranda/formKustom tanpa sinyal dari simpanan kemarin
{
  const f = A('simpanForm', { baru: true, nama: 'Checklist kebersihan', tampil: true, keterangan: '', jadwal: 'harian', hari: [],
    kolom: [{ bagian: 'baris', label: 'Area', jenis: 'Teks', pilihan: [], wajib: true }] });
  const id = f.data.disimpan.id;
  const { ctx, page } = await buka(390, 844, 'Rina', { rute: '#/form/' + id });
  cek(/Jadwal: Setiap hari\. Hari libur, tidak ditagih\./.test(await page.locator('.layar-isi').innerText()), 'form kustom hari libur');
  // Simpanan Beranda kemarin (hari libur kemarin, liburBesok = hari ini) dipakai tanpa sinyal.
  await page.evaluate(({ kemarin, hariIni }) => {
    const k = 'inventoryku:p:rina:cache:beranda';
    const c = JSON.parse(localStorage.getItem(k));
    c.data.tanggal = kemarin;
    c.data.libur = { tanggal: kemarin, keterangan: 'Kemarin', oleh: 'Budi', waktu: null };
    c.data.liburBesok = null;
    c.data.form.forEach((x) => { x.wajib = false; });
    localStorage.setItem(k, JSON.stringify(c));
  }, { kemarin: hari(-1), hariIni });
  await ctx.setOffline(true);
  await page.evaluate(() => { location.hash = '#/'; });
  await page.waitForTimeout(1500);
  const kem = await page.locator('.kemajuan-teks').innerText();
  cek(!/Hari libur/.test(kem) && /dari 5 form terisi/.test(kem), 'tanpa sinyal: simpanan hari libur kemarin → ditagih menurut jadwal', kem);
  await page.evaluate(({ kemarin, hariIni }) => {
    const k = 'inventoryku:p:rina:cache:beranda';
    const c = JSON.parse(localStorage.getItem(k));
    c.data.libur = null;
    c.data.liburBesok = { tanggal: hariIni, keterangan: 'Lebaran', oleh: 'Budi', waktu: null };
    localStorage.setItem(k, JSON.stringify(c));
  }, { kemarin: hari(-1), hariIni });
  await page.evaluate(() => { location.hash = '#/riwayat'; });
  await page.waitForTimeout(600);
  await page.evaluate(() => { location.hash = '#/'; });
  await page.waitForTimeout(1500);
  cek(/Hari libur: Lebaran/.test(await page.locator('.kemajuan-teks').innerText()), 'tanpa sinyal: liburBesok kemarin = hari ini libur');
  await ctx.close();
}

// G. Catat penjualan: tanggal libur, dan tautan Tandai hari libur
{
  A('hapusLibur', { tanggal: hariIni });
  A('simpanLibur', { tanggal: hari(-1), keterangan: 'Tutup mendadak' });
  const { ctx, page } = await buka(390, 844, 'Budi', { rute: '#/hpp' });
  await page.getByRole('button', { name: 'Catat penjualan', exact: true }).first().click();
  await page.waitForTimeout(1200);
  const L = lembar(page);
  // Kemarin sudah punya penjualan (data contoh) → tidak menyebut libur.
  cek(/Sudah tercatat/.test(await L.innerText()), 'kemarin sudah tercatat');
  cek(/Tandai sebagai hari libur, atau isi 0/.test(await L.innerText()), 'bantuan baru');
  await L.getByText('Tanggal lain').click();
  await L.locator('input[type=date]').fill(hariIni);
  await L.locator('input[type=date]').dispatchEvent('change');
  await page.waitForTimeout(1200);
  const tautan = L.locator('a.tombol-tautan[href="#/pengaturan/libur/' + hariIni + '"]');
  cek(await tautan.count() === 1, 'tautan Tandai hari libur');
  await tautan.click();
  await page.waitForTimeout(1800);
  const L2 = lembar(page);
  cek(/Tambah hari libur/.test(await L2.innerText()) && await L2.locator('input[type=radio]').first().isChecked(), 'lembar Tambah terbuka dengan hari ini');
  await L2.getByRole('button', { name: 'Simpan hari libur' }).click();
  await page.waitForTimeout(1200);
  await page.evaluate(() => { location.hash = '#/hpp'; });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Catat penjualan', exact: true }).first().click();
  await page.waitForTimeout(800);
  await lembar(page).getByText('Tanggal lain').click();
  await lembar(page).locator('input[type=date]').fill(hariIni);
  await lembar(page).locator('input[type=date]').dispatchEvent('change');
  await page.waitForTimeout(1200);
  cek(/Hari libur\. Penjualan tidak perlu dicatat\./.test(await lembar(page).innerText()), 'tanggal libur: tidak perlu dicatat', await lembar(page).innerText());
  await ctx.close();
}

// H. Server lama
{
  const { ctx, page } = await buka(390, 844, 'Budi', { serverLama: true });
  const kem = await page.locator('.kemajuan-teks').innerText();
  cek(!/Hari libur/.test(kem), 'server lama: Beranda tanpa libur', kem);
  await page.evaluate(() => { location.hash = '#/pengaturan/libur'; });
  await page.waitForTimeout(1500);
  cek(/Server belum diperbarui/.test(await page.locator('.layar-isi').innerText()) && await page.getByRole('button', { name: 'Tambah' }).isDisabled(), 'server lama: layar Hari libur');
  await ctx.close();
}

// I. Tanpa sinyal di layar Hari libur
{
  let putus = false;
  const { ctx, page } = await buka(390, 844, 'Budi', { rute: '#/pengaturan/libur', putus: (b) => putus && /Libur$/.test(b.action) });
  putus = true;
  await page.getByRole('button', { name: 'Tambah' }).click();
  await page.waitForTimeout(400);
  await lembar(page).getByText('Besok, ' + pendek(hari(1))).click();
  await lembar(page).getByRole('button', { name: 'Simpan hari libur' }).click();
  await page.waitForTimeout(1500);
  cek(await lembar(page).count() === 1 && /sinyal|tersambung|jaringan/i.test(await lembar(page).locator('.pesan-formulir').innerText()), 'tanpa sinyal: galat di lembar', await lembar(page).innerText());
  await ctx.close();
}

// J. Delapan ukuran
A('simpanLibur', { tanggal: hariIni, keterangan: 'Renovasidapurbesarbesaranbersamatukang40x'.slice(0, 40) });
A('simpanLibur', { tanggal: hari(1), keterangan: 'Lebaran' });
for (const [w, h] of [[320, 568], [360, 740], [390, 844], [430, 932], [768, 1024], [1024, 768], [1366, 768], [1920, 1080]]) {
  for (const rute of ['#/', '#/pengaturan/libur', '#/dashboard', 'tambah', 'ubah']) {
    const { ctx, page } = await buka(w, h, 'Budi', { rute: rute.startsWith('#') ? rute : '#/pengaturan/libur' });
    if (rute === 'tambah') { await page.getByRole('button', { name: 'Tambah' }).click(); await page.waitForTimeout(400); await lembar(page).getByText('Tanggal lain').click(); await page.waitForTimeout(200); }
    if (rute === 'ubah') { await page.locator('button.daftar-baris').first().click(); await page.waitForTimeout(400); }
    const m = await page.evaluate((r) => {
      const lebar = document.documentElement.scrollWidth;
      const akar = r === 'tambah' || r === 'ubah' ? document.querySelector('.lembar') : document.querySelector('#layar');
      const pilih = 'button, a, input, select';
      const kecil = [...akar.querySelectorAll(pilih)].filter((e) => e.offsetParent && !e.closest('.menu') && e.type !== 'radio')
        .map((e) => [e.textContent.trim().slice(0, 30) || e.tagName, Math.round(e.getBoundingClientRect().height)]).filter((x) => x[1] < 44);
      const keluar = [...akar.querySelectorAll('*')].filter((e) => {
        if (e.closest('.tabel-bingkai') || e.closest('.pilihan-form')) return false;
        const b = e.getBoundingClientRect();
        return b.width && (b.right > innerWidth + 1 || b.left < -1);
      }).map((e) => e.className || e.tagName).slice(0, 5);
      return { lebar, kecil, keluar };
    }, rute);
    cek(m.lebar <= w && !m.kecil.length && !m.keluar.length, `ukuran ${w}x${h} ${rute}`, m);
    await ctx.close();
  }
}

console.log('lulus', lulus, 'gagal', gagal, 'galat konsol', galat, 'ERR log', H.logs.filter((l) => l.startsWith('ERR')));
await browser.close();
srv.close();
