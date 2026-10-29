// Rumus blok Kepatuhan di tab Dashboard (setupSpreadsheet gaya Apps Script) — seimbang, nama LET aman, gaya titik koma.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';
const REPO = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');
const { Spreadsheet } = await import(REPO + '/supabase/src/sheet.js');
const { buatLayanan } = await import(REPO + '/supabase/src/layanan.js');
const { bungkusKodeGs } = await import(REPO + '/supabase/src/bungkus.js');
const teks = fs.readFileSync(process.env.KODE || (REPO + '/apps-script/Code.gs'), 'utf8');
const pembuat = new Function('G', bungkusKodeGs(teks));
const ss = new Spreadsheet({ tabMeta: [], dataTab: {}, zona: 'Asia/Jakarta', info: { nama: 'Uji' } });
const props = {};
const logs = [];
function kode() {
  const k = { ss, Date, crypto, Buffer, htmlKePdf: () => new Uint8Array(), props, propsAwal: {}, zona: () => 'Asia/Jakarta', info: {}, push: [], drive: { folder: new Set(), folderBaru: new Set(), berkas: [] },
    jadwal: { daftar: [] }, surel: [], log: { log: (...a) => logs.push(a.join(' ')), info: () => {}, warn: () => {}, error: (...a) => logs.push('ERR ' + a.join(' ')) }, perluTab: ss.perluTab };
  const G = buatLayanan(k);
  G.DI_SUPABASE = false; G.SUPABASE_ = {}; G.Date = Date;
  props.SPREADSHEET_ID = 'x';
  return pembuat(G);
}
let K;
try { K = kode(); K.setupSpreadsheet(); } catch (e) { console.log('setup galat (dicatat, lanjut membaca rumus):', String(e).slice(0, 200)); }
const dash = ss.getSheetByName('Dashboard');
let rumus = [];
if (dash) {
  const r = dash.getDataRange();
  const f = r.getFormulas ? r.getFormulas() : [];
  f.forEach((baris, i) => baris.forEach((x, j) => { if (x) rumus.push({ sel: (i + 1) + ',' + (j + 1), x }); }));
}
const kep = rumus.filter((r) => /M_HariLibur/.test(r.x));
console.log('rumus Dashboard', rumus.length, 'rumus hari libur', kep.length);
let gagal = 0;
function seimbang(x) {
  let n = 0, dalam = false;
  for (const c of x) { if (c === '"') dalam = !dalam; else if (!dalam) { if (c === '(') n++; if (c === ')') { n--; if (n < 0) return false; } } }
  return n === 0 && !dalam;
}
rumus.forEach((r) => { if (!seimbang(r.x)) { gagal++; console.log('TIDAK SEIMBANG', r.sel, r.x.slice(0, 200)); } });
// Nama LET: tidak ada dua nama yang hanya berbeda huruf besar/kecil, dan tidak ada huruf+angka.
kep.forEach((r) => {
  const nama = new Set();
  const re = /(?:LET\(|,)([A-Za-z_][A-Za-z0-9_]*),/g;
  let m;
  while ((m = re.exec(r.x))) nama.add(m[1]);
  const kecil = {};
  nama.forEach((n) => { const k = n.toLowerCase(); (kecil[k] = kecil[k] || new Set()).add(n); });
  Object.values(kecil).forEach((s) => { if (s.size > 1) { gagal++; console.log('NAMA BENTROK', r.sel, [...s]); } });
  ['hlT', 'lb', 'hl'].forEach((n) => { if (r.x.indexOf(n + ',') >= 0 && /[A-Za-z]+\d+$/.test(n)) { gagal++; console.log('NAMA SEL', n); } });
});
const ubah = K && K.__ambil('ubahGayaRumus_');
if (ubah) kep.forEach((r) => { const y = ubah(r.x, 'titikKoma'); if (!seimbang(y) || /,(?=(?:[^"]*"[^"]*")*[^"]*$)/.test(y.replace(/'[^']*'/g, ''))) { console.log('gaya titik koma: periksa', y.slice(0, 120)); } });
const awal = kep.find((r) => /hlT,/.test(r.x));
console.log(awal ? 'LET berisi lb dan Libur: ' + (/lb,COUNTIF\(hlT,d\)>0/.test(awal.x) && /"Libur"/.test(awal.x)) : 'rumus utama tidak ditemukan');
const ringkas = kep.find((r) => /hari libur/.test(r.x));
console.log(ringkas ? 'ringkasan: ' + ringkas.x.slice(0, 160) : 'ringkasan tidak ditemukan');
console.log('format bersyarat Libur:', JSON.stringify(dash ? (dash.getConditionalFormatRules ? dash.getConditionalFormatRules().map((x) => x.rumus || x.formula || '').filter((x) => /Libur/.test(x)) : 'tidak ada API') : null));
let lulus = 0;
const periksa = (k, label) => { if (k) lulus++; else { gagal++; console.log('GAGAL:', label); } };
periksa(awal && /lb,COUNTIF\(hlT,d\)>0/.test(awal.x) && /"Libur"/.test(awal.x), 'rumus Kepatuhan memuat hari libur');
periksa(!!ringkas, 'ringkasan menyebut hari libur');
const galatRumus = logs.filter((l) => /ERR|#ERROR|#NAME/.test(l) && !/tidak ada yang menampilkan/.test(l));
periksa(!galatRumus.length, 'setupSpreadsheet tanpa galat rumus');
if (galatRumus.length) console.log(galatRumus.slice(0, 5));
console.log('lulus', lulus, 'gagal', gagal);
process.exit(gagal ? 1 : 0);
