// Uji server saran prep (Code.gs v0.44): saranPrep_ (target 2 hari, paling lama masa simpan resep, stock minus = 0, dibulatkan ke
// atas ke ½ resep), formPrep.resep[].saran untuk berbagai keadaan (data contoh uji/alat/seed_prep.mjs), sesudah prep
// dikirim, dan tanggal kemarin.
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';
import { seedPrep } from '../alat/seed_prep.mjs';

let lulus = 0, gagal = 0;
function cek(label, kondisi, info) {
  if (kondisi) lulus++;
  else { gagal++; console.log('GAGAL:', label, info !== undefined ? JSON.stringify(info).slice(0, 900) : ''); }
}
const hari = (n) => new Date(Date.now() + H.geserWaktu + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const s = seed();
const A = (action, b) => H.aksi(Object.assign({ action, token: s.token }, b));
const sp = (r, stock, pakai) => H.fungsi('saranPrep_', r, stock, pakai);

// 1. Hitungan.
let x = sp({ hasil: 2, masaSimpan: null }, 1, { rata: 0.9 });
cek('½ resep: target 2 hari 1,8 − stock 1', x && x.jumlahResep === 0.5 && x.targetHari === 2 && x.target === 1.8 && x.stock === 1 &&
  x.pakaiHarian === 0.9 && x.cukupHari === 1.1, x);
cek('stock cukup: 0', sp({ hasil: 2, masaSimpan: null }, 1.8, { rata: 0.9 }).jumlahResep === 0 && sp({ hasil: 2 }, 5, { rata: 0.9 }).jumlahResep === 0);
cek('kurang tepat 1 resep: tidak dibulatkan naik lagi', sp({ hasil: 2 }, 0, { rata: 1 }).jumlahResep === 1);
cek('kurang 2,1 dengan hasil 2: 1½', sp({ hasil: 2 }, 0, { rata: 1.05 }).jumlahResep === 1.5);
cek('stock minus dihitung 0', sp({ hasil: 2 }, -3, { rata: 0.9 }).jumlahResep === 1 && sp({ hasil: 2 }, -3, { rata: 0.9 }).cukupHari === 0);
x = sp({ hasil: 1, masaSimpan: 1 }, 0.5, { rata: 0.8 });
cek('masa simpan 1 hari: target 1 hari', x.targetHari === 1 && x.target === 0.8 && x.jumlahResep === 0.5, x);
cek('masa simpan 0: tetap 1 hari', sp({ hasil: 1, masaSimpan: 0 }, 0, { rata: 0.8 }).targetHari === 1);
cek('masa simpan 5: tetap 2 hari', sp({ hasil: 1, masaSimpan: 5 }, 0, { rata: 0.8 }).targetHari === 2);
cek('tanpa rata-rata atau tanpa pemakaian: null', sp({ hasil: 2 }, 1, null) === null && sp({ hasil: 2 }, 1, { rata: null }) === null &&
  sp({ hasil: 2 }, 1, { rata: 0 }) === null && sp({ hasil: 0 }, 1, { rata: 1 }) === null);

// 2. formPrep dengan data contoh tambahan.
seedPrep(s.token);
const saran = (tanggal) => {
  const f = A('formPrep', { tanggal: tanggal || hari(0) }).data;
  const o = {};
  f.resep.forEach((r) => { o[r.item] = r.saran; });
  return o;
};
let o = saran();
cek('Sambal dasar (keluar tidak pernah dicatat): saran null', o['Sambal dasar'] === null, o['Sambal dasar']);
cek('Saus kacang ½ resep', o['Saus kacang'] && o['Saus kacang'].jumlahResep === 0.5 && o['Saus kacang'].stock === 1 && o['Saus kacang'].pakaiHarian === 0.9 &&
  o['Saus kacang'].targetHari === 2, o['Saus kacang']);
cek('Bumbu kuning ½ resep untuk 1 hari', o['Bumbu kuning'] && o['Bumbu kuning'].jumlahResep === 0.5 && o['Bumbu kuning'].targetHari === 1 &&
  o['Bumbu kuning'].pakaiHarian === 0.8 && o['Bumbu kuning'].cukupHari === 0.6, o['Bumbu kuning']);
cek('Saus tomat 2½ resep, habis', o['Saus tomat'] && o['Saus tomat'].jumlahResep === 2.5 && o['Saus tomat'].stock === 0 && o['Saus tomat'].cukupHari === 0 &&
  o['Saus tomat'].pakaiHarian === 0.54, o['Saus tomat']);
cek('Kaldu ayam belum perlu', o['Kaldu ayam'] && o['Kaldu ayam'].jumlahResep === 0 && o['Kaldu ayam'].stock === 5 && o['Kaldu ayam'].cukupHari === 6, o['Kaldu ayam']);

// 3. Sesudah prep dikirim, stock bertambah dan saran ikut turun.
const k = A('kirimPrep', { submissionId: crypto.randomUUID(), tanggal: hari(0), shift: 'Pagi', waktuPerangkat: new Date().toISOString(),
  baris: [{ item: 'Saus kacang', jumlahResep: 0.5, qty: '', keterangan: '' }, { item: 'Saus tomat', jumlahResep: 1, qty: '', keterangan: '' }] });
cek('kirim prep', k.ok, k.pesan);
o = saran();
cek('Saus kacang sesudah ½ resep: stock 2, belum perlu', o['Saus kacang'].stock === 2 && o['Saus kacang'].jumlahResep === 0, o['Saus kacang']);
cek('Saus tomat sesudah 1 resep: stock 0,5, sisa 1 resep', o['Saus tomat'].stock === 0.5 && o['Saus tomat'].jumlahResep === 1.5, o['Saus tomat']);

// 4. Tanggal kemarin: dihitung terhadap tanggal itu (stock dan jendela kemarin).
o = saran(hari(-1));
cek('kemarin: Saus kacang stock 3 (sebelum keluar hari ini), belum perlu', o['Saus kacang'].stock === 3 && o['Saus kacang'].jumlahResep === 0, o['Saus kacang']);

console.log('lulus', lulus, 'gagal', gagal);
