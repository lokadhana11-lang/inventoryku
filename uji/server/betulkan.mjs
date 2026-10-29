// Uji server: Staff membetulkan isiannya sendiri (Code.gs v0.32).
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';
let lulus = 0, gagal = 0;
function cek(label, kondisi, info) { if (kondisi) lulus++; else { gagal++; console.log('GAGAL:', label, info !== undefined ? JSON.stringify(info).slice(0, 700) : ''); } }
const tglJkt = (ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const HARI0 = tglJkt(Date.now());
let n = 0; const sid = () => 'betul-' + (++n) + '-' + Math.random().toString(36).slice(2, 10);
seed();
// Siang hari supaya geser 16 menit tidak melewati tengah malam.
H.aturGeser(Date.parse(HARI0 + 'T12:00:00+07:00') - Date.now());
let TB, TR, TA;
const masuk = () => {
  TB = H.aksi({ action: 'login', nama: 'Budi', pin: '482915' }).data.token;
  TR = H.aksi({ action: 'login', nama: 'Rina', pin: '730264' }).data.token;
  TA = H.aksi({ action: 'login', nama: 'Andi', pin: '305718' }).data.token;
};
masuk();
const A = (action, b, tok) => H.aksi(Object.assign({ action, token: tok }, b));
const riwayat = (formId, tok) => A('riwayat', { formId, dari: HARI0, sampai: HARI0, tampilan: 'catatan' }, tok).data.kiriman;
const stockAkhir = (item) => A('riwayatItem', { item }, TB).data.tercatat;
const geser = (menit) => H.aturGeser(H.geserWaktu + menit * 60000);

/* 1. Stock: Rina membetulkan Tambah keluar */
const s1 = sid();
const k1 = A('kirimStock', { submissionId: s1, tanggal: HARI0, kategori: 'Sayur', waktuPerangkat: new Date().toISOString(), baris: [{ item: 'Tomat', masuk: '', keluar: 10 }] }, TR);
cek('kirim Stock Rina', k1.ok, k1);
const akhirSalah = stockAkhir('Tomat');
let kr = riwayat('STOCK', TR).find((k) => k.id === s1);
cek('betulkanSampai untuk Rina, +15 menit', kr && Math.abs(Date.parse(kr.betulkanSampai) - (Date.parse(kr.waktu) + 15 * 60000)) < 1000, kr && [kr.waktu, kr.betulkanSampai]);
cek('kiriman lama (seed, Budi) tanpa betulkanSampai bagi Rina', riwayat('STOCK', TR).filter((k) => k.id !== s1).every((k) => !k.betulkanSampai));
cek('Andi tidak mendapat betulkanSampai isian Rina', !riwayat('STOCK', TA).find((k) => k.id === s1).betulkanSampai);
cek('Pengelola tidak mendapat betulkanSampai', !riwayat('STOCK', TB).find((k) => k.id === s1).betulkanSampai);
const d1 = A('detailKiriman', { formId: 'STOCK', submissionId: s1 }, TR);
cek('detailKiriman membawa betulkanSampai', d1.ok && d1.data.kiriman.betulkanSampai === kr.betulkanSampai, d1.data && d1.data.kiriman);
const row = kr.baris[0].rowId;
const a = A('koreksi', { formId: 'STOCK', rowId: row, nilai: { keluar: 1 } }, TR);
cek('Rina membetulkan keluar 10 → 1', a.ok && a.data.kiriman.baris[0].nilai.keluar === 1, a);
cek('stock dihitung ulang (+9)', Math.abs(stockAkhir('Tomat') - akhirSalah - 9) < 1e-9, [akhirSalah, stockAkhir('Tomat')]);
cek('dikoreksi oleh Rina', a.data.kiriman.baris[0].dikoreksi && a.data.kiriman.baris[0].dikoreksi.oleh === 'Rina', a.data.kiriman.baris[0]);
cek('jawaban koreksi tetap membawa betulkanSampai', !!a.data.kiriman.betulkanSampai);
const log = H.ss.getSheetByName('Log_Perubahan').getDataRange().getValues().filter((r) => String(r[3]) === String(row));
cek('Log_Perubahan oleh Rina', log.length === 1 && log[0][1] === 'Rina' && log[0][4] === 'Stock Keluar', log);
const a2 = A('koreksi', { formId: 'STOCK', rowId: row, nilai: { keluar: 1.5 } }, TA);
cek('Andi ditolak: isianmu sendiri', !a2.ok && /hanya bisa membetulkan isianmu sendiri/.test(a2.pesan), a2);
const sB = sid();
A('kirimStock', { submissionId: sB, tanggal: HARI0, kategori: 'Sayur', waktuPerangkat: new Date().toISOString(), baris: [{ item: 'Tomat', masuk: '', keluar: 0.1 }] }, TB);
const seedRow = riwayat('STOCK', TR).find((k) => k.id === sB);
const a3 = A('koreksi', { formId: 'STOCK', rowId: seedRow.baris[0].rowId, nilai: { keluar: 0 } }, TR);
cek('Rina ditolak untuk isian Budi', !a3.ok && /isianmu sendiri/.test(a3.pesan), a3);

/* 2. Lewat 15 menit */
geser(16);
masuk();
cek('sesudah 16 menit: tanpa betulkanSampai', !riwayat('STOCK', TR).find((k) => k.id === s1).betulkanSampai);
const a4 = A('koreksi', { formId: 'STOCK', rowId: row, nilai: { keluar: 2 } }, TR);
cek('sesudah 16 menit: ditolak', !a4.ok && /lebih dari 15 menit lalu/.test(a4.pesan) && /Laporkan kekeliruan/.test(a4.pesan), a4);
const a5 = A('koreksi', { formId: 'STOCK', rowId: row, nilai: { keluar: 2 } }, TB);
cek('Pengelola tetap bisa mengoreksi', a5.ok, a5);

/* 3. Sudah diperiksa di dalam 15 menit */
const s2 = sid();
A('kirimStock', { submissionId: s2, tanggal: HARI0, kategori: 'Sayur', waktuPerangkat: new Date().toISOString(), baris: [{ item: 'Tomat', masuk: 2, keluar: '' }] }, TR);
const p = A('tandaiDiperiksa', { formId: 'STOCK', submissionId: s2 }, TB);
cek('diperiksa', p.ok, p);
const k2 = riwayat('STOCK', TR).find((k) => k.id === s2);
cek('diperiksa: tanpa betulkanSampai', k2 && !k2.betulkanSampai, k2);
const a6 = A('koreksi', { formId: 'STOCK', rowId: k2.baris[0].rowId, nilai: { masuk: 3 } }, TR);
cek('diperiksa: ditolak dengan pesan Staff', !a6.ok && /sudah diperiksa, jadi tidak bisa dibetulkan/.test(a6.pesan) && !/Buka kunci/.test(a6.pesan), a6);

/* 4. Waste Staff: qty, tanpa kolom rupiah */
const s3 = sid();
A('kirimWaste', { submissionId: s3, tanggal: HARI0, shift: 'Siang', waktuPerangkat: new Date().toISOString(), baris: [{ item: 'Tomat', kategori: 'Rusak', qty: 3, alasan: '' }] }, TR);
const w = riwayat('WASTE', TR).find((k) => k.id === s3);
const a7 = A('koreksi', { formId: 'WASTE', rowId: w.baris[0].rowId, nilai: { qty: 0.3 } }, TR);
cek('Waste dibetulkan 3 → 0,3', a7.ok && a7.data.kiriman.baris[0].nilai.qty === 0.3, a7);
cek('Waste Staff: tanpa nilai rupiah di jawaban', a7.ok && !JSON.stringify(a7.data.kiriman).match(/estimasi/i), a7.data && a7.data.kiriman.baris[0].nilai);
const est = H.ss.getSheetByName('Data_Waste').getDataRange().getValues();
const jd = est[0];
const bw = est.find((r) => r[jd.indexOf('submission_id')] === s3);
cek('estimasi dihitung ulang di Sheet (0,3 × 15.000)', Number(bw[jd.indexOf('Estimasi Kerugian (Rp)')]) === 4500, bw);

/* 5. Suhu: di luar standar tanpa tindakan ditolak juga untuk Staff */
const s4 = sid();
const ks = A('kirimSuhu', { submissionId: s4, tanggal: HARI0, waktuCek: 'Cek ulang', waktuPerangkat: new Date().toISOString(), baris: [{ unit: 'Chiller 1', suhu: 4 }] }, TR);
cek('kirim Suhu', ks.ok, ks);
const su = riwayat('SUHU', TR).find((k) => k.id === s4);
const a8 = A('koreksi', { formId: 'SUHU', rowId: su.baris[0].rowId, nilai: { suhu: 9 } }, TR);
cek('Suhu 9 tanpa tindakan ditolak', !a8.ok && /tindakan/i.test(a8.pesan), a8);
const a9 = A('koreksi', { formId: 'SUHU', rowId: su.baris[0].rowId, nilai: { suhu: 3.5 } }, TR);
cek('Suhu dibetulkan 4 → 3,5', a9.ok, a9);

/* 6. Antrean: diisi di HP 2 jam lalu, diterima sekarang → 15 menit sejak diterima */
const s5 = sid();
A('kirimStock', { submissionId: s5, tanggal: HARI0, kategori: 'Sayur', waktuPerangkat: new Date(Date.now() + H.geserWaktu - 2 * 3600000).toISOString(), baris: [{ item: 'Tomat', masuk: '', keluar: 0.5 }] }, TR);
const k5 = riwayat('STOCK', TR).find((k) => k.id === s5);
cek('antrean: betulkanSampai dari waktu diterima', k5 && k5.betulkanSampai && Date.parse(k5.betulkanSampai) > Date.now() + H.geserWaktu + 14 * 60000, k5 && k5.betulkanSampai);

/* 7. Form kustom */
const f = A('simpanForm', { baru: true, nama: 'Cek gas', tampil: true, keterangan: '', jadwal: 'harian', hari: [],
  kolom: [{ id: '', bagian: 'baris', label: 'Tabung', jenis: 'Teks', pilihan: [], wajib: true }, { id: '', bagian: 'baris', label: 'Isi', jenis: 'Angka', pilihan: [], wajib: false }] }, TB);
cek('form kustom dibuat', f.ok, f);
const idF = f.data.disimpan.id;
const det = A('detailForm', { formId: idF }, TB).data.form.kolom;
const s6 = sid();
const kk = A('kirimKustom', { formId: idF, submissionId: s6, tanggal: HARI0, waktuPerangkat: new Date().toISOString(), kepala: {}, baris: [{ [det[0].id]: 'Tabung 1', [det[1].id]: '5' }] }, TR);
cek('kirim kustom', kk.ok, kk);
const kc = riwayat(idF, TR).find((k) => k.id === s6);
const kunciIsi = A('riwayat', { formId: idF, dari: HARI0, sampai: HARI0, tampilan: 'catatan' }, TR).data.kolom.find((c) => c.label === 'Isi').kunci;
const a10 = A('koreksi', { formId: idF, rowId: kc.baris[0].rowId, nilai: { [kunciIsi]: '4' } }, TR);
cek('form kustom dibetulkan', a10.ok, a10);

/* 8. Telaah: laporan rekan tetap, koreksi Pengelola tidak dibatalkan, diperiksa sesudah dilihat, notifikasi suhu */
H.aturGeser(H.geserWaktu + 20 * 60000);
masuk();
{
  const id = sid();
  A('kirimStock', { submissionId: id, tanggal: HARI0, kategori: 'Sayur', waktuPerangkat: new Date().toISOString(), baris: [{ item: 'Tomat', masuk: '', keluar: 10 }] }, TR);
  const r = riwayat('STOCK', TR).find((k) => k.id === id).baris[0].rowId;
  const dl0 = A('beranda', { tanggal: HARI0 }, TB).data.pemeriksaan.dilaporkan;
  const lp = A('laporkanKeliru', { formId: 'STOCK', rowId: r, catatan: 'Harusnya 12' }, TA);
  cek('Andi melaporkan', lp.ok, lp);
  const bt = A('koreksi', { formId: 'STOCK', rowId: r, nilai: { keluar: 9 } }, TR);
  cek('Rina membetulkan baris yang dilaporkan', bt.ok, bt);
  cek('laporan Andi tetap', bt.ok && bt.data.kiriman.baris[0].flag && /Harusnya 12/.test(bt.data.kiriman.baris[0].flag.catatan), bt.data && bt.data.kiriman.baris[0].flag);
  cek('Beranda Pengelola masih menghitung laporannya', A('beranda', { tanggal: HARI0 }, TB).data.pemeriksaan.dilaporkan === dl0 + 1);
  const kp = A('koreksi', { formId: 'STOCK', rowId: r, nilai: { keluar: 12 } }, TB);
  cek('Pengelola mengoreksi: laporan hilang', kp.ok && !kp.data.kiriman.baris[0].flag, kp);
  const bt2 = A('koreksi', { formId: 'STOCK', rowId: r, nilai: { keluar: 9 } }, TR);
  cek('Rina tidak membatalkan koreksi Budi', !bt2.ok && /sudah dikoreksi Budi/.test(bt2.pesan), bt2);
}
{
  const id = sid();
  A('kirimStock', { submissionId: id, tanggal: HARI0, kategori: 'Sayur', waktuPerangkat: new Date().toISOString(), baris: [{ item: 'Tomat', masuk: '', keluar: 1 }] }, TR);
  const dilihat = riwayat('STOCK', TB).find((k) => k.id === id);
  const r = dilihat.baris[0].rowId;
  geser(0.05);
  cek('Rina membetulkan', A('koreksi', { formId: 'STOCK', rowId: r, nilai: { keluar: 2 } }, TR).ok);
  const t1 = A('tandaiDiperiksa', { formId: 'STOCK', submissionId: id, terlihat: '' }, TB);
  cek('Tandai diperiksa dari layar lama ditolak', !t1.ok && /baru saja dibetulkan/.test(t1.pesan), t1);
  const tb = A('tandaiDiperiksaBanyak', { formId: 'STOCK', submissionId: [id], terlihat: { [id]: '' } }, TB);
  cek('sekaligus: dilewati berubah', tb.ok && tb.data.diperiksa === 0 && tb.data.dilewati[0].sebab === 'berubah', tb.data);
  const baru = riwayat('STOCK', TB).find((k) => k.id === id);
  const lihat = baru.baris[0].dikoreksi.waktu;
  const t2 = A('tandaiDiperiksa', { formId: 'STOCK', submissionId: id, terlihat: lihat }, TB);
  cek('sesudah dimuat ulang: diperiksa', t2.ok && t2.data.kiriman.status === 'Diperiksa', t2);
  const id2 = sid();
  A('kirimStock', { submissionId: id2, tanggal: HARI0, kategori: 'Sayur', waktuPerangkat: new Date().toISOString(), baris: [{ item: 'Tomat', masuk: '', keluar: 1 }] }, TR);
  A('koreksi', { formId: 'STOCK', rowId: riwayat('STOCK', TR).find((k) => k.id === id2).baris[0].rowId, nilai: { keluar: 2 } }, TR);
  const t3 = A('tandaiDiperiksa', { formId: 'STOCK', submissionId: id2 }, TB);
  cek('aplikasi lama tanpa terlihat: tetap bisa', t3.ok, t3);
}
{
  H.opsiUji.vapid = 'kunci-uji';
  A('aturNotifikasi', { aktif: true, langganan: { endpoint: 'https://push.uji/b', keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) } } }, TB);
  const id = sid();
  A('kirimSuhu', { submissionId: id, tanggal: HARI0, waktuCek: 'Cek ulang', waktuPerangkat: new Date().toISOString(), baris: [{ unit: 'Chiller 2', suhu: 4 }] }, TR);
  const r = riwayat('SUHU', TR).find((k) => k.id === id).baris[0].rowId;
  H.opsiUji.push.length = 0;
  const kb = A('koreksi', { formId: 'SUHU', rowId: r, nilai: { suhu: 9, tindakan: 'Pintu ditutup' } }, TR);
  cek('Suhu dibetulkan ke 9 dengan tindakan', kb.ok, kb);
  const p = H.opsiUji.push.map((x) => x.isi);
  cek('notifikasi suhu di luar standar ke Pengelola', p.length === 1 && /Suhu di luar standar: Cek ulang/.test(p[0].judul) && /Chiller 2 9 °C \(Pintu ditutup\)\. Dikoreksi Rina\./.test(p[0].isi), p);
  H.opsiUji.push.length = 0;
  A('koreksi', { formId: 'SUHU', rowId: r, nilai: { suhu: 9.5 } }, TR);
  cek('tetap di luar standar: tanpa notifikasi kedua', H.opsiUji.push.length === 0);
}

console.log('lulus', lulus, 'gagal', gagal, 'ERR log:', JSON.stringify(H.logs.filter((l) => /^ERR/.test(l)).slice(0, 3)));
