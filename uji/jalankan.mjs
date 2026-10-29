// Menjalankan uji InventoryKu satu per satu dan meringkas hasilnya.
//   node uji/jalankan.mjs              semua uji server (cepat, tanpa peramban)
//   node uji/jalankan.mjs --layar      uji server lalu uji layar (Chromium lewat Playwright)
//   node uji/jalankan.mjs libur pesanan   hanya uji yang namanya memuat kata itu (server dan layar)
// Keluar dengan kode 1 jika ada uji yang gagal.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const argumen = process.argv.slice(2);
const layar = argumen.includes('--layar');
const saring = argumen.filter((a) => !a.startsWith('--'));
const daftar = (sub) => fs.readdirSync(path.join(DIR, sub)).filter((f) => f.endsWith('.mjs')).sort().map((f) => path.join(sub, f));
let berkas = daftar('server');
if (layar || saring.length) berkas = berkas.concat(daftar('layar'));
if (saring.length) berkas = berkas.filter((f) => saring.some((s) => f.includes(s)));
if (!berkas.length) {
  console.log('Tidak ada uji yang cocok.');
  process.exit(1);
}

let totalLulus = 0, totalGagal = 0;
const bermasalah = [];
for (const f of berkas) {
  const mulai = Date.now();
  const r = spawnSync(process.execPath, [path.join(DIR, f)], { encoding: 'utf8', timeout: 20 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
  const keluaran = (r.stdout || '') + (r.stderr || '');
  const baris = keluaran.split('\n');
  const ringkas = baris.filter((b) => /lulus\s+\d+\s+gagal\s+\d+/i.test(b)).pop() || '';
  const m = ringkas.match(/lulus\s+(\d+)\s+gagal\s+(\d+)/i);
  const lulus = m ? Number(m[1]) : 0;
  const gagal = m ? Number(m[2]) : 0;
  // Galat konsol peramban atau galat server yang tercatat juga dihitung gagal.
  const galatLain = /galat konsol \[(?!\])/.test(ringkas) || /ERR log:? \[(?!\])/.test(ringkas);
  const ok = !!m && !gagal && !galatLain && r.status === 0;
  totalLulus += lulus;
  totalGagal += gagal;
  const detik = ((Date.now() - mulai) / 1000).toFixed(0);
  console.log((ok ? 'LULUS ' : 'GAGAL ') + f + ' (' + lulus + ' lulus, ' + gagal + ' gagal, ' + detik + ' detik)');
  if (!ok) {
    bermasalah.push(f);
    const rinci = baris.filter((b) => /GAGAL|Error|galat konsol|ERR log/.test(b)).slice(0, 15);
    (rinci.length ? rinci : baris.slice(-15)).forEach((b) => console.log('    ' + b.slice(0, 400)));
    if (r.error) console.log('    ' + r.error.message);
  }
}
console.log('\n' + berkas.length + ' berkas uji: ' + totalLulus + ' pemeriksaan lulus, ' + totalGagal + ' gagal.' +
  (bermasalah.length ? ' Bermasalah: ' + bermasalah.join(', ') : ''));
process.exit(bermasalah.length ? 1 : 0);
