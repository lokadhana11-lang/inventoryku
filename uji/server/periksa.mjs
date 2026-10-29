import crypto from 'node:crypto';
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';
let gagal = 0, lulus = 0;
const cek = (kond, label, extra) => { if (kond) lulus++; else { gagal++; console.log('GAGAL:', label, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : ''); } };
const s = seed();
const T = s.token;
const login = (nama, pin) => H.aksi({ action: 'login', nama, pin }).data.token;
const TR = login('Rina', '730264');
const A = (action, b, tok) => H.aksi(Object.assign({ action, token: tok || T }, b));
const hari = (n) => new Date(Date.now() + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

// 1. Riwayat Stock: periksaBanyak dan kiriman
let r = A('riwayat', { formId: 'STOCK', dari: hari(-6), sampai: hari(0), tampilan: 'catatan' });
cek(r.ok && r.data.periksaBanyak === true, 'riwayat.periksaBanyak');
const tgl = hari(-2);
let kirTgl = r.data.kiriman.filter((k) => k.tanggal === tgl);
cek(kirTgl.length === 2, 'dua kiriman Stock pada tanggal', kirTgl.length);
// 2. Rina melaporkan satu baris di kiriman pertama
const lapor = kirTgl[0];
let lk = A('laporkanKeliru', { formId: 'STOCK', rowId: lapor.baris[0].rowId, catatan: 'Keluar seharusnya 2' }, TR);
cek(lk.ok, 'laporkanKeliru oleh Staff', lk);
// 3. Staff ditolak
let st = A('tandaiDiperiksaBanyak', { formId: 'STOCK', submissionId: kirTgl.map((k) => k.id) }, TR);
cek(!st.ok && /hanya bisa dilakukan Head Kitchen atau Manager/.test(st.pesan), 'Staff ditolak', st);
// 4. Pengelola: dua kiriman + id ganda + id tak dikenal
const sebelumBeranda = A('beranda', { tanggal: hari(0) }).data.pemeriksaan.belumDiperiksa;
const jmlLogSebelum = H.ss.getSheetByName('Log_Perubahan').getDataRange().getValues().length;
let h = A('tandaiDiperiksaBanyak', { formId: 'STOCK', submissionId: [kirTgl[0].id, kirTgl[1].id, kirTgl[1].id, 'tidak-ada-123'] });
cek(h.ok, 'tandaiDiperiksaBanyak berhasil', h);
cek(h.data.diperiksa === 1 && h.data.sudah === 0, 'diperiksa 1 sudah 0', h.data);
cek(JSON.stringify(h.data.dilewati) === JSON.stringify([{ id: kirTgl[0].id, sebab: 'dilaporkan' }, { id: 'tidak-ada-123', sebab: 'tidakAda' }]), 'dilewati', h.data.dilewati);
cek(h.data.kiriman.length === 2, 'kiriman dikembalikan untuk dua id yang ada', h.data.kiriman.length);
const k1 = h.data.kiriman.find((k) => k.id === kirTgl[1].id), k0 = h.data.kiriman.find((k) => k.id === kirTgl[0].id);
cek(k1 && k1.status === 'Diperiksa' && k1.diperiksa && k1.diperiksa.oleh === 'Budi', 'kiriman kedua Diperiksa oleh Budi', k1 && { s: k1.status, d: k1.diperiksa });
cek(k0 && k0.status === 'Terkirim' && k0.dilaporkan === 1, 'kiriman dilaporkan tetap Terkirim', k0 && { s: k0.status, d: k0.dilaporkan });
cek(H.ss.getSheetByName('Log_Perubahan').getDataRange().getValues().length === jmlLogSebelum, 'Log_Perubahan tidak bertambah (sama dengan tombol satuan)');
const sesudahBeranda = A('beranda', { tanggal: hari(0) }).data.pemeriksaan.belumDiperiksa;
cek(sesudahBeranda === sebelumBeranda - 1, 'Beranda belum diperiksa turun 1', [sebelumBeranda, sesudahBeranda]);
// 5. Ulang: sudah
h = A('tandaiDiperiksaBanyak', { formId: 'STOCK', submissionId: [kirTgl[1].id] });
cek(h.ok && h.data.diperiksa === 0 && h.data.sudah === 1 && h.data.dilewati.length === 0, 'ulang: sudah 1', h.data);
// 6. Koreksi baris terkunci ditolak, bukaKunci jalan
let ko = A('koreksi', { formId: 'STOCK', rowId: k1.baris[0].rowId, nilai: { keluar: 1 } });
cek(!ko.ok && /terkunci/.test(ko.pesan), 'koreksi terkunci ditolak', ko);
let bk = A('bukaKunci', { formId: 'STOCK', submissionId: k1.id });
cek(bk.ok && bk.data.kiriman.status === 'Terkirim', 'bukaKunci', bk.data && bk.data.kiriman.status);
// 7. Galat masukan
let e1 = A('tandaiDiperiksaBanyak', { formId: 'STOCK', submissionId: [] });
cek(!e1.ok && /Tidak ada isian yang dipilih/.test(e1.pesan), 'daftar kosong', e1);
let e2 = A('tandaiDiperiksaBanyak', { formId: 'STOCK', submissionId: 'bukan-larik' });
cek(!e2.ok && /Tidak ada isian/.test(e2.pesan), 'bukan larik', e2);
let e3 = A('tandaiDiperiksaBanyak', { formId: 'STOCK', submissionId: Array.from({ length: 301 }, (_, i) => 'x' + i) });
cek(!e3.ok && /Terlalu banyak/.test(e3.pesan), 'lebih dari 300', e3);
let e4 = A('tandaiDiperiksaBanyak', { formId: 'TIDAKADA', submissionId: ['a'] });
cek(!e4.ok, 'form tidak dikenal', e4);
let e5 = A('tandaiDiperiksaBanyak', { formId: 'STOCK', submissionId: ['a'] });
cek(e5.ok && e5.data.diperiksa === 0 && e5.data.dilewati[0].sebab === 'tidakAda' && e5.data.kiriman.length === 0, 'semua tidak ada', e5.data);
// 8. Form lain
for (const f of ['SUHU', 'PREP', 'WASTE']) {
  const rr = A('riwayat', { formId: f, dari: hari(-6), sampai: hari(0), tampilan: 'catatan' });
  const ids = rr.data.kiriman.filter((k) => k.status === 'Terkirim').map((k) => k.id);
  const hh = A('tandaiDiperiksaBanyak', { formId: f, submissionId: ids });
  cek(hh.ok && hh.data.diperiksa === ids.length && hh.data.kiriman.every((k) => k.status === 'Diperiksa'), f + ' semua diperiksa', hh.ok ? { d: hh.data.diperiksa, n: ids.length } : hh);
  if (f === 'PREP') cek(hh.data.kiriman.every((k) => Array.isArray(k.baris[0].rincian)), 'PREP rincian bahan ikut', hh.data.kiriman[0] && hh.data.kiriman[0].baris[0]);
  const rr2 = A('riwayat', { formId: f, dari: hari(-6), sampai: hari(0), tampilan: 'catatan', status: 'terkirim' });
  cek(rr2.data.kiriman.length === 0, f + ' filter terkirim kosong sesudahnya', rr2.data.kiriman.length);
}
// 9. Form kustom
const sf = A('simpanForm', { baru: true, nama: 'Checklist kebersihan', tampil: true, keterangan: '', jadwal: 'harian', hari: [], kolom: [{ id: '', bagian: 'baris', label: 'Area', jenis: 'Teks', pilihan: [], wajib: true }] });
cek(sf.ok, 'simpanForm kustom', sf);
const fid = sf.data.disimpan.id;
const df = A('detailForm', { formId: fid });
const idKol = df.data.form.kolom[0].id;
const kus = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
for (let i = 0; i < 3; i++) { const kk = A('kirimKustom', { formId: fid, submissionId: kus[i], tanggal: hari(0), waktuPerangkat: new Date().toISOString(), kepala: {}, baris: [{ [idKol]: 'Dapur ' + i }] }, TR); if (!kk.ok) console.log('kirimKustom', kk.pesan); }
const hk = A('tandaiDiperiksaBanyak', { formId: fid, submissionId: kus });
cek(hk.ok && hk.data.diperiksa === 3, 'form kustom 3 diperiksa', hk);
// 10. PDF Diperiksa oleh pada tanggal Stock (satu kiriman masih dilaporkan)
const pdfRw = A('riwayat', { formId: 'STOCK', dari: tgl, sampai: tgl, tampilan: 'catatan' });
cek(pdfRw.data.kiriman.filter((k) => k.status === 'Diperiksa').length === 0, 'sesudah buka kunci: 0 diperiksa di tanggal itu');
console.log('lulus', lulus, 'gagal', gagal);
console.log('ERR log:', H.logs.filter((l) => l.startsWith('ERR')).slice(0, 3));
