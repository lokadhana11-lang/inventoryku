// Uji server Pengingat sebelum closing (Code.gs v0.31) di atas Spreadsheet tiruan supabase/src.
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';

let lulus = 0, gagal = 0;
function cek(label, kondisi, info) {
  if (kondisi) lulus++;
  else { gagal++; console.log('GAGAL:', label, info !== undefined ? JSON.stringify(info).slice(0, 700) : ''); }
}
const tglJkt = (ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const hari = (n) => tglJkt(Date.now() + H.geserWaktu + n * 86400000);
function keWaktu(tanggal, jam, menit) {
  const sasaran = Date.parse(tanggal + 'T' + String(jam).padStart(2, '0') + ':' + String(menit || 0).padStart(2, '0') + ':00+07:00');
  H.aturGeser(sasaran - Date.now());
}
let n = 0; const sid = () => 'closing-' + (++n) + '-' + Math.random().toString(36).slice(2, 10);
const s = seed();
const HARI0 = hari(0);
let T, TR;
const masuk = () => {
  T = H.aksi({ action: 'login', nama: 'Budi', pin: '482915' }).data.token;
  TR = H.aksi({ action: 'login', nama: 'Rina', pin: '730264' }).data.token;
};
masuk();
const A = (action, b, tok) => H.aksi(Object.assign({ action, token: tok || T }, b));
const konf = (k) => { const r = H.ss.getSheetByName('M_Konfigurasi').getDataRange().getValues().find((x) => x[0] === k); return r ? r : null; };
const pemicu = () => H.jadwalUji().daftar.filter((t) => t.fungsi === 'pengingatClosing' || t.nama === 'pengingatClosing');

H.opsiUji.vapid = 'kunci-uji';
const sub = A('aturNotifikasi', { aktif: true, langganan: { endpoint: 'https://push.uji/1', keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) } } });
cek('langganan Pengelola', sub.ok, sub);
const sub2 = A('aturNotifikasi', { aktif: true, langganan: { endpoint: 'https://push.uji/2', keys: { p256dh: 'C'.repeat(87), auth: 'D'.repeat(22) } } }, TR);
cek('langganan Staff', sub2.ok, sub2);

/* 1. Nilai awal */
{
  cek('baris belum ada', konf('pengingat_closing_menit') === null);
  const o = A('bacaOutletJadwal', {});
  cek('awal 30 menit', o.ok && o.data.pengingatClosingMenit === 30, o.data);
  const inf = A('infoNotifikasi', { endpoint: 'https://push.uji/2' }, TR);
  cek('infoNotifikasi Staff: 21:00', inf.data.pengingatClosing === '21:00', inf.data);
}

/* 2. Isi notifikasi */
{
  keWaktu(HARI0, 21, 0);
  masuk();
  const form = A('beranda', { tanggal: HARI0 }).data.form;
  console.log('Form hari ini:', form.map((f) => f.id + ':' + f.status + (f.wajib ? '*' : '')).join(' '));
  H.opsiUji.push.length = 0;
  const isi = H.fungsi('pengingatClosing');
  const kurang = form.filter((f) => f.wajib && (f.status === 'belum' || f.status === 'sebagian') && f.id !== 'SUHU');
  if (kurang.length) {
    cek('dikirim ke 2 HP (semua role)', H.opsiUji.push.length === 2, H.opsiUji.push.length);
    cek('judul Closing 21.30', isi && /^Closing 21\.30: \d+ form belum/.test(isi.judul), isi);
    cek('isi menyebut form yang belum', kurang.every((f) => isi.isi.indexOf(f.nama) >= 0), isi);
    cek('Suhu disebut: Middle belum (walau pengingat cek suhu Closing menyala)', /Suhu \(3 dari 9 pengecekan\)/.test(isi.isi), isi);
    cek('url Beranda, tag', isi.url === '#/' && isi.tag === 'pengingat-closing' && isi.ttl === 10800, isi);
  } else cek('ada form belum lengkap di data contoh', false, form);
  // Pengingat cek suhu Closing dimatikan: Suhu yang belum lengkap ikut disebut.
  const o = A('simpanOutletJadwal', { jamCekClosing: '' });
  cek('matikan pengingat suhu Closing', o.ok, o);
  const isi2 = H.fungsi('pengingatClosing');
  const suhu = form.find((f) => f.id === 'SUHU');
  if (suhu && suhu.status !== 'terkirim') cek('Suhu disebut saat pengingat suhu mati', isi2 && /Suhu/.test(isi2.isi), isi2);
  A('simpanOutletJadwal', { jamCekClosing: '21:00' });
}

/* 2b. Suhu: Opening dan Middle lengkap → tidak disebut selama pengingat suhu Closing menyala; tanpa unit aktif → tidak disebut. */
{
  const m = A('kirimSuhu', { submissionId: sid(), tanggal: HARI0, waktuCek: 'Middle', waktuPerangkat: new Date().toISOString(),
    baris: [{ unit: 'Chiller 1', suhu: 3 }, { unit: 'Chiller 2', suhu: 4 }, { unit: 'Freezer 1', suhu: -20 }] }, TR);
  cek('kirim Middle', m.ok, m);
  const isi = H.fungsi('pengingatClosing');
  cek('hanya Closing kurang: Suhu tidak disebut', isi && !/Suhu/.test(isi.isi), isi);
  A('simpanOutletJadwal', { jamCekClosing: '' });
  const isi2 = H.fungsi('pengingatClosing');
  cek('pengingat suhu mati: Suhu (6 dari 9) disebut', isi2 && /Suhu \(6 dari 9 pengecekan\)/.test(isi2.isi), isi2);
  const unit = A('daftarUnit', {}).data.unit.filter((u) => u.aktif).map((u) => u.nama);
  unit.forEach((u) => A('aturUnitAktif', { nama: u, aktif: false }));
  const isi3 = H.fungsi('pengingatClosing');
  cek('tanpa unit aktif: Suhu tidak disebut', isi3 && !/Suhu/.test(isi3.isi), isi3);
  unit.forEach((u) => A('aturUnitAktif', { nama: u, aktif: true }));
  A('simpanOutletJadwal', { jamCekClosing: '21:00' });
}

/* 3. Semua lengkap: tidak dikirim. Tandai nihil semua form yang belum. */
{
  const form = A('beranda', { tanggal: HARI0 }).data.form;
  form.filter((f) => f.wajib && f.status === 'belum' && f.id !== 'SUHU').forEach((f) => {
    const r = A('tandaiNihil', { submissionId: sid(), formId: f.id, tanggal: HARI0, waktuPerangkat: new Date().toISOString() });
    cek('nihil ' + f.id, r.ok, r);
  });
  H.opsiUji.push.length = 0;
  const sisa = A('beranda', { tanggal: HARI0 }).data.form.filter((f) => f.wajib && f.status === 'sebagian' && f.id !== 'SUHU');
  const isi = H.fungsi('pengingatClosing');
  if (!sisa.length) cek('semua lengkap (selain Suhu): tidak dikirim', isi === null && H.opsiUji.push.length === 0, isi);
  // Hanya sebagian: judul "belum lengkap" — uji dengan fungsi isi langsung lewat Suhu (pengingat suhu mati).
  A('simpanOutletJadwal', { jamCekClosing: '' });
  const isi3 = H.fungsi('pengingatClosing');
  const sh = A('beranda', { tanggal: HARI0 }).data.form.find((f) => f.id === 'SUHU');
  if (sh.status === 'sebagian') cek('hanya Suhu sebagian: "belum lengkap" dan detail', isi3 && /form belum lengkap$/.test(isi3.judul) && /Suhu \(\d+ dari \d+ pengecekan\)/.test(isi3.isi), isi3);
  else if (sh.status === 'belum') cek('hanya Suhu belum: "belum diisi"', isi3 && /form belum diisi$/.test(isi3.judul), isi3);
  cek('hanya Suhu: tanpa ajakan Tidak ada hari ini', isi3 && !/Tidak ada hari ini/.test(isi3.isi), isi3);
  A('simpanOutletJadwal', { jamCekClosing: '21:00' });
}

/* 4. Hari libur */
{
  const hapusNihil = null;
  A('simpanLibur', { tanggal: HARI0, keterangan: 'Uji' });
  H.opsiUji.push.length = 0; H.logs.length = 0;
  A('simpanOutletJadwal', { jamCekClosing: '' });
  const isi = H.fungsi('pengingatClosing');
  cek('hari libur: tidak dikirim', isi === null && H.opsiUji.push.length === 0 && H.logs.some((l) => /Hari libur; pengingat closing dilewati/.test(l)), H.logs.slice(-3));
  A('hapusLibur', { tanggal: HARI0 });
  A('simpanOutletJadwal', { jamCekClosing: '21:00' });
}

/* 5. Lewat tengah malam: sebelum 06.00 untuk kemarin. */
{
  keWaktu(hari(1), 0, 15);
  masuk();
  A('simpanLibur', { tanggal: hari(-1), keterangan: '' }); // kemarin (menurut jam baru = HARI0)
  H.logs.length = 0;
  A('simpanOutletJadwal', { jamCekClosing: '' });
  H.fungsi('pengingatClosing');
  cek('00.15: memakai tanggal kemarin (libur → dilewati)', H.logs.some((l) => /Hari libur; pengingat closing dilewati/.test(l)), H.logs.slice(-3));
  A('hapusLibur', { tanggal: hari(-1) });
  const isiK = H.fungsi('pengingatClosing');
  cek('00.15: isi diawali Untuk <tanggal kemarin>', isiK && /^Untuk \S+, \d+ \S+ \d{4}\./.test(isiK.isi), isiK);
  A('simpanOutletJadwal', { jamCekClosing: '21:00' });
  keWaktu(HARI0, 21, 5);
  masuk();
}

/* 6. Outlet dan jadwal, pasangTrigger */
{
  H.fungsi('pasangTrigger');
  let p = pemicu();
  cek('pasangTrigger: satu jadwal pengingatClosing 21:00', p.length === 1 && p[0].jam === 21 && p[0].menit === 0, H.jadwalUji().daftar);
  const o = A('simpanOutletJadwal', { pengingatClosingMenit: 60 });
  cek('simpan 60', o.ok && o.data.pengingatClosingMenit === 60 && String(konf('pengingat_closing_menit')[1]) === '60', o);
  p = pemicu();
  cek('jadwal dipasang ulang 20:30', p.length === 1 && p[0].jam === 20 && p[0].menit === 30, p);
  const o2 = A('simpanOutletJadwal', { jamClosing: '00:10' });
  p = pemicu();
  cek('jam closing 00:10 → pengingat 23:10', o2.ok && p.length === 1 && p[0].jam === 23 && p[0].menit === 10, p);
  const inf = A('infoNotifikasi', { endpoint: 'https://push.uji/1' });
  cek('infoNotifikasi 23:10', inf.data.pengingatClosing === '23:10', inf.data);
  A('simpanOutletJadwal', { jamClosing: '21:30' });
  const o3 = A('simpanOutletJadwal', { pengingatClosingMenit: 0 });
  p = pemicu();
  cek('mati: tidak ada jadwal', o3.ok && o3.data.pengingatClosingMenit === 0 && p.length === 0, p);
  const inf2 = A('infoNotifikasi', { endpoint: 'https://push.uji/1' });
  cek('infoNotifikasi mati: ""', inf2.data.pengingatClosing === '', inf2.data);
  const o4 = A('simpanOutletJadwal', { pengingatClosingMenit: 45 });
  cek('45 ditolak', !o4.ok && /15, 30, atau 60/.test(o4.pesan), o4);
  const o5 = A('simpanOutletJadwal', { pengingatClosingMenit: 15 }, TR);
  cek('Staff ditolak', !o5.ok, o5);
  const o6 = A('simpanOutletJadwal', { pengingatClosingMenit: 15 });
  cek('simpan 15 → 21:15', o6.ok && pemicu()[0].jam === 21 && pemicu()[0].menit === 15, pemicu());
  // Nilai tidak terbaca di Sheet dibaca 30.
  const r = H.ss.getSheetByName('M_Konfigurasi');
  const baris = r.getDataRange().getValues().findIndex((x) => x[0] === 'pengingat_closing_menit') + 1;
  r.getRange(baris, 2).setValue('abc');
  cek('nilai tidak terbaca → 30', A('bacaOutletJadwal', {}).data.pengingatClosingMenit === 30);
  r.getRange(baris, 2).setValue('');
  cek('kosong → mati', A('bacaOutletJadwal', {}).data.pengingatClosingMenit === 0);
  const pt = konf('pasang_trigger');
  H.fungsi('pasangTrigger');
  cek('pasangTrigger tanpa pengingat closing saat mati', pemicu().length === 0);
}

/* 7. Tanpa notifikasi */
{
  H.opsiUji.vapid = '';
  H.logs.length = 0;
  const isi = H.fungsi('pengingatClosing');
  cek('tanpa kunci notifikasi: diam', isi === null && H.logs.some((l) => /Notifikasi tidak tersedia; pengingat closing/.test(l)), H.logs.slice(-2));
}

const err = H.logs.filter((l) => /^ERR/.test(l));
console.log('lulus', lulus, 'gagal', gagal, 'ERR log:', JSON.stringify(err.slice(0, 3)));
