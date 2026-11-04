// Uji server pemantauan pemasangan (Code.gs v0.42): salinan Apps Script yang berhenti atau gagal, versi Code.gs yang berbeda,
// email yang tertahan, susunan tab dan kolom, Beranda, Dashboard, Outlet dan jadwal, dan notifikasi sesudah laporan harian.
// SUPABASE_.statusSistem diisi seperti runtime.js (H.supabaseUji); bagian Postgres-nya diuji terpisah (catatan/keputusan.md).
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';

let lulus = 0, gagal = 0;
function cek(label, kondisi, info) {
  if (kondisi) lulus++;
  else { gagal++; console.log('GAGAL:', label, info !== undefined ? JSON.stringify(info).slice(0, 900) : ''); }
}
seed();
const T = H.aksi({ action: 'login', nama: 'Budi', pin: '482915' }).data.token;
const TR = H.aksi({ action: 'login', nama: 'Rina', pin: '730264' }).data.token;
const A = (action, b, tok) => H.aksi(Object.assign({ action, token: tok || T }, b));
const kini = () => Date.now() + H.geserWaktu;
const lalu = (menit) => new Date(kini() - menit * 60000).toISOString();
const VERSI = H.ambil('VERSI_KODE');
const status = (as, surel, brevo) => { H.supabaseUji.statusSistem = { appsScript: as, surel: surel || { menunggu: 0, sejak: null }, brevo: !!brevo }; };
const cekP = () => H.fungsi('cekPemasangan_');
const jenis = (daftar) => daftar.map((p) => p.jenis);
const konf = (k) => { const r = H.ss.getSheetByName('M_Konfigurasi').getDataRange().getValues().find((x) => x[0] === k); return r ? r[1] : undefined; };

// 1. Runtime tanpa statusSistem (atau Apps Script): tanpa peringatan, susunan lengkap sesudah setupSpreadsheet.
cek('versi kode v0.42 atau lebih baru', /^v0\.(4[2-9]|[5-9]\d)/.test(VERSI), VERSI);
cek('tanpa statusSistem: tidak ada peringatan', cekP().length === 0, cekP());
cek('susunan_sheet Lengkap sesudah setupSpreadsheet', konf('susunan_sheet') === 'Lengkap', konf('susunan_sheet'));
let o = A('bacaOutletJadwal', {});
cek('bacaOutletJadwal.statusSistem ada', o.ok && o.data.statusSistem && o.data.statusSistem.versiServer === VERSI, o.data && o.data.statusSistem);
cek('statusSistem tanpa runtime: appsScript dan surel null, susunan lengkap',
  o.data.statusSistem.appsScript === null && o.data.statusSistem.surel === null && o.data.statusSistem.susunan.lengkap === true &&
  o.data.statusSistem.diSupabase === true && o.data.statusSistem.peringatan.length === 0, o.data.statusSistem);
let b = A('beranda', {});
cek('Beranda Pengelola: peringatanPemasangan kosong', b.ok && Array.isArray(b.data.peringatanPemasangan) && !b.data.peringatanPemasangan.length, b.data && b.data.peringatanPemasangan);
cek('Beranda Staff tanpa peringatanPemasangan', A('beranda', {}, TR).data.peringatanPemasangan === undefined);
cek('bacaOutletJadwal hanya Pengelola', !A('bacaOutletJadwal', {}, TR).ok);

// 2. Salinan berjalan, versi sama: tidak ada peringatan.
status({ versi: VERSI, salinan: lalu(3), galat: '' });
cek('salinan 3 menit lalu, versi sama: tanpa peringatan', cekP().length === 0, cekP());
o = A('bacaOutletJadwal', {}).data.statusSistem;
cek('statusSistem.appsScript', o.appsScript && o.appsScript.versi === VERSI && o.appsScript.berhenti === false && o.appsScript.salinan, o.appsScript);
cek('statusSistem.surel lewat Gmail', o.surel && o.surel.menunggu === 0 && o.surel.lewatGmail === true, o.surel);
status({ versi: VERSI, salinan: lalu(29), galat: '' });
cek('29 menit: belum dianggap berhenti', cekP().length === 0, cekP());

// 3. Salinan berhenti.
status({ versi: VERSI, salinan: lalu(45), galat: '' }, { menunggu: 2, sejak: lalu(40) });
let p = cekP();
cek('45 menit: salinanBerhenti masalah', p.length === 1 && p[0].jenis === 'salinanBerhenti' && p[0].tingkat === 'masalah', p);
cek('teks berhenti: waktu, lama, akibat, email menunggu, pasangTrigger',
  /^Terakhir berjalan \d+ [A-Z][a-z]{2} \d\d\.\d\d \(45 menit lalu\)\. Selama berhenti, email laporan tidak terkirim, PDF dan foto tidak masuk Google Drive, dan Google Sheets tidak diperbarui\. 2 email menunggu dikirim\. Pemilik Sheet perlu menjalankan pasangTrigger di editor Apps Script; jika masih berhenti, lihat menu Eksekusi di sana\.$/.test(p[0].ket), p[0].ket);
cek('berhenti: email tertahan tidak disebut dua kali', jenis(p).indexOf('surelTertahan') < 0, p);
status({ versi: VERSI, salinan: lalu(60 * 5), galat: 'tab: Exception: x' }, null, true);
p = cekP();
cek('Brevo: email tidak disebut, lama dalam jam, galat tidak ditambah', p.length === 1 && /\(5 jam lalu\)\. Selama berhenti, PDF dan foto/.test(p[0].ket), p);
status({ versi: VERSI, salinan: lalu(60 * 50) });
cek('lama dalam hari', /\(2 hari lalu\)/.test(cekP()[0].ket), cekP());
cek('statusSistem.appsScript.berhenti', A('bacaOutletJadwal', {}).data.statusSistem.appsScript.berhenti === true);

// 4. Email tertahan tanpa salinan berhenti.
status({ versi: VERSI, salinan: lalu(2) }, { menunggu: 1, sejak: lalu(90) });
p = cekP();
cek('email 90 menit: surelTertahan', p.length === 1 && p[0].jenis === 'surelTertahan' && p[0].judul === '1 email belum terkirim' &&
  /^Menunggu sejak \d+ [A-Z][a-z]{2} \d\d\.\d\d\. Email dikirim dari Gmail pemilik Sheet oleh salinan Apps Script tiap 5 menit\. Pemilik Sheet perlu melihat menu Eksekusi di editor Apps Script\.$/.test(p[0].ket), p);
status({ versi: VERSI, salinan: lalu(2) }, { menunggu: 1, sejak: lalu(30) });
cek('email 30 menit: belum tertahan', cekP().length === 0, cekP());

// 5. Salinan gagal.
status({ versi: VERSI, salinan: lalu(2), galat: 'tab: Exception: Batas sel terlampaui.' });
p = cekP();
cek('salinanGagal dengan pesan dan petunjuk', p.length === 1 && p[0].jenis === 'salinanGagal' &&
  p[0].ket === 'tab: Exception: Batas sel terlampaui. Pemilik Sheet perlu melihat menu Eksekusi di editor Apps Script.', p);

// 6. Versi berbeda.
status({ versi: 'v0.41', salinan: lalu(2) });
p = cekP();
cek('Apps Script lebih lama', p.length === 1 && p[0].jenis === 'versi' && p[0].tingkat === 'tinjau' &&
  p[0].ket === 'Apps Script masih v0.41, sedangkan Supabase ' + VERSI + '. Pemilik Sheet perlu menempel apps-script/Code.gs terbaru ke editor Apps Script.', p);
status({ salinan: lalu(2) });
p = cekP();
cek('Apps Script sebelum v0.42 (tanpa versi)', p.length === 1 && /^Apps Script masih memakai Code\.gs sebelum v0\.42, sedangkan Supabase /.test(p[0].ket), p);
status({ versi: 'v9.0', salinan: lalu(2) });
p = cekP();
cek('Supabase lebih lama', p.length === 1 && p[0].ket === 'Supabase masih ' + VERSI + ', sedangkan Apps Script v9.0. Pemilik Sheet perlu menempel supabase/functions/api/index.ts ke Edge Function di Supabase, lalu Deploy.', p);
status({ versi: 'v0.8.1', salinan: lalu(2) });
cek('banding versi bertingkat (v0.8.1 lebih lama)', /^Apps Script masih v0\.8\.1,/.test(cekP()[0].ket), cekP());
status(null);
cek('belum pernah ada kontak: tanpa peringatan versi atau berhenti', cekP().length === 0, cekP());
status({ versi: 'v0.41' });
cek('versi tanpa waktu salinan (hanya dari editor): tanpa peringatan', cekP().length === 0, cekP());
cek('statusSistem.appsScript null tanpa waktu salinan', A('bacaOutletJadwal', {}).data.statusSistem.appsScript === null);

// 7. Beranda dan Dashboard.
status({ versi: 'v0.41', salinan: lalu(45) }, { menunggu: 1, sejak: lalu(40) });
b = A('beranda', {}).data;
cek('Beranda: dua peringatan, berhenti dulu', jenis(b.peringatanPemasangan).join() === 'salinanBerhenti,versi', b.peringatanPemasangan);
cek('Beranda: peringatanSistem lama tetap tanpa butir baru', Array.isArray(b.peringatanSistem) && !b.peringatanSistem.some((x) => /Salinan/.test(x)), b.peringatanSistem);
let d = A('dashboard', {}).data;
const pm = d.perhatian.filter((x) => x.jenis === 'pemasangan');
cek('Dashboard: butir pemasangan masalah dan tinjau', pm.length === 2 && pm[0].tingkat === 'masalah' && pm[0].data.kode === 'salinanBerhenti' &&
  pm[1].tingkat === 'tinjau' && pm[1].data.kode === 'versi' && pm[0].judul === 'Salinan ke Google Sheets berhenti', pm);
const iMasalah = d.perhatian.findIndex((x) => x.data && x.data.kode === 'salinanBerhenti');
const iTinjau = d.perhatian.findIndex((x) => x.data && x.data.kode === 'versi');
cek('Dashboard: masalah sebelum tinjau', iMasalah >= 0 && iTinjau > iMasalah, d.perhatian.map((x) => x.jenis));
status({ versi: VERSI, salinan: lalu(2) });

// 8. Susunan tab dan kolom.
const resep = H.ss.getSheetByName('M_Resep');
const judulResep = resep.getRange(1, 1, 1, resep.getLastColumn()).getValues()[0];
const kolCatatan = judulResep.indexOf('Catatan') + 1;
cek('M_Resep punya kolom Catatan', kolCatatan > 0, judulResep);
resep.getRange(1, kolCatatan).setValue('Catatan lama');
H.ss.deleteSheet(H.ss.getSheetByName('Data_PenjualanMenu'));
const kurang = H.fungsi('periksaSusunan_');
cek('periksaSusunan_: tab dan kolom yang hilang', JSON.stringify(kurang) === JSON.stringify(['tab Data_PenjualanMenu', 'M_Resep: kolom Catatan']), kurang);
cek('Beranda belum berubah sebelum diperiksa (tidak memuat semua tab)', A('beranda', {}).data.peringatanPemasangan.length === 0);
A('simpanPenerima', { email: ['laporan@contoh.invalid'] });
H.surel.length = 0;
const lap = H.fungsi('kirimLaporanHarian');
cek('laporan harian tetap terkirim', lap && lap.terkirim, lap && lap.galat);
cek('susunan_sheet Kurang sesudah laporan harian', konf('susunan_sheet') === 'Kurang: tab Data_PenjualanMenu; M_Resep: kolom Catatan', konf('susunan_sheet'));
p = cekP();
cek('peringatan susunan', p.length === 1 && p[0].jenis === 'susunan' && p[0].tingkat === 'tinjau' &&
  p[0].ket === 'Belum ada: tab Data_PenjualanMenu; M_Resep: kolom Catatan. Pemilik Sheet perlu menjalankan setupSpreadsheet sekali di editor Apps Script.', p);
o = A('bacaOutletJadwal', {}).data.statusSistem;
cek('statusSistem.susunan kurang', o.susunan.lengkap === false && o.susunan.kurang.join('|') === 'tab Data_PenjualanMenu|M_Resep: kolom Catatan', o.susunan);
cek('Beranda: peringatan susunan', jenis(A('beranda', {}).data.peringatanPemasangan).join() === 'susunan');
const ubahAwal = H.ss.getSheetByName('M_Konfigurasi').getDataRange().getValues().length;
H.fungsi('kirimLaporanHarian');
cek('laporan berikutnya tidak menambah baris konfigurasi', H.ss.getSheetByName('M_Konfigurasi').getDataRange().getValues().length === ubahAwal);
H.logs.length = 0;
H.fungsi('setupSpreadsheet');
cek('setupSpreadsheet: susunan Lengkap lagi', konf('susunan_sheet') === 'Lengkap' && H.fungsi('periksaSusunan_').length === 0, konf('susunan_sheet'));
cek('setupSpreadsheet: peringatan susunan hilang', cekP().length === 0, cekP());

// 9. Notifikasi ke HP Pengelola sesudah laporan harian.
H.opsiUji.vapid = 'kunci-uji';
cek('langganan Pengelola', A('aturNotifikasi', { aktif: true, langganan: { endpoint: 'https://push.uji/p', keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) } } }).ok);
cek('langganan Staff', A('aturNotifikasi', { aktif: true, langganan: { endpoint: 'https://push.uji/s', keys: { p256dh: 'C'.repeat(87), auth: 'D'.repeat(22) } } }, TR).ok);
H.opsiUji.push.length = 0;
H.fungsi('kirimLaporanHarian');
cek('salinan berjalan: tanpa notifikasi', H.opsiUji.push.length === 0, H.opsiUji.push);
status({ versi: VERSI, salinan: lalu(50) });
H.opsiUji.push.length = 0;
H.fungsi('kirimLaporanHarian');
cek('salinan berhenti: satu notifikasi ke HP Pengelola', H.opsiUji.push.length === 1 && H.opsiUji.push[0].langganan.endpoint === 'https://push.uji/p', H.opsiUji.push);
const n1 = H.opsiUji.push[0] && H.opsiUji.push[0].isi;
cek('notifikasi email tertahan', n1 && n1.judul === 'Email laporan harian tertahan' && n1.url === '#/pengaturan/outlet' && n1.tag === 'salinan' &&
  /^Salinan Apps Script tidak berjalan sejak \d+ [A-Z][a-z]{2} \d\d\.\d\d, jadi email laporan belum terkirim\. Ketuk untuk melihat\.$/.test(n1.isi), n1);
status({ versi: VERSI, salinan: lalu(50) }, null, true);
H.opsiUji.push.length = 0;
H.fungsi('kirimLaporanHarian');
const n2 = H.opsiUji.push[0] && H.opsiUji.push[0].isi;
cek('Brevo: notifikasi salinan berhenti', n2 && n2.judul === 'Salinan ke Google Sheets berhenti' && /tidak berjalan sejak .+\. Ketuk untuk melihat\.$/.test(n2.isi), n2);
A('simpanPenerima', { email: [] });
status({ versi: VERSI, salinan: lalu(50) });
H.opsiUji.push.length = 0;
H.fungsi('kirimLaporanHarian');
const n3 = H.opsiUji.push[0] && H.opsiUji.push[0].isi;
cek('email tidak terkirim (tanpa penerima): judul salinan berhenti', n3 && n3.judul === 'Salinan ke Google Sheets berhenti', n3);

// 10. Hari libur: laporan dilewati, susunan tetap diperiksa dan notifikasi tetap dikirim.
const hariIni = new Date(kini()).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
cek('tandai hari libur', A('simpanLibur', { tanggal: hariIni, keterangan: 'Uji' }).ok);
resep.getRange(1, resep.getRange(1, 1, 1, resep.getLastColumn()).getValues()[0].indexOf('Catatan') + 1).setValue('Catatan x');
H.opsiUji.push.length = 0;
const lib = H.fungsi('kirimLaporanHarian');
cek('libur: laporan dilewati', lib && lib.dilewati, lib);
cek('libur: susunan tetap diperiksa', /^Kurang: M_Resep: kolom Catatan$/.test(konf('susunan_sheet')), konf('susunan_sheet'));
cek('libur: notifikasi salinan berhenti', H.opsiUji.push.length === 1 && H.opsiUji.push[0].isi.judul === 'Salinan ke Google Sheets berhenti', H.opsiUji.push);
H.opsiUji.vapid = '';
delete H.supabaseUji.statusSistem;

console.log('lulus', lulus, 'gagal', gagal);
