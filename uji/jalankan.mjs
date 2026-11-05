// Menjalankan uji InventoryKu dan meringkas hasilnya.
//   node uji/jalankan.mjs              semua uji server (cepat, tanpa peramban)
//   node uji/jalankan.mjs --layar      uji server lalu uji layar (Chromium lewat Playwright)
//   node uji/jalankan.mjs libur pesanan   hanya uji yang namanya memuat kata itu (server dan layar)
//   UJI_PARALEL=1 node uji/jalankan.mjs --layar   satu berkas sekaligus (bawaan: sebanyak inti prosesor, paling banyak 4)
// Berkas dijalankan beberapa sekaligus, masing-masing di prosesnya sendiri (port acak, data di memori), tetapi hasilnya
// dicetak dalam urutan nama berkas. Keluar dengan kode 1 jika ada uji yang gagal.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
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

const inti = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
const paralel = Math.max(1, Number(process.env.UJI_PARALEL) || Math.min(4, inti));
const BATAS_MS = 20 * 60 * 1000;

/** Satu berkas uji di proses Node sendiri; hasilnya { status, keluaran, galat, detik }. */
function jalankanBerkas(f) {
  return new Promise((selesai) => {
    const mulai = Date.now();
    const anak = spawn(process.execPath, [path.join(DIR, f)], { stdio: ['ignore', 'pipe', 'pipe'] });
    let keluaran = '';
    let galat = null;
    anak.stdout.on('data', (d) => { keluaran += d; });
    anak.stderr.on('data', (d) => { keluaran += d; });
    const waktu = setTimeout(() => { galat = new Error('Melewati batas ' + BATAS_MS / 60000 + ' menit; dihentikan.'); anak.kill('SIGKILL'); }, BATAS_MS);
    anak.on('error', (e) => { galat = e; });
    anak.on('close', (status) => {
      clearTimeout(waktu);
      selesai({ status, keluaran, galat, detik: ((Date.now() - mulai) / 1000).toFixed(0) });
    });
  });
}

let totalLulus = 0, totalGagal = 0;
const bermasalah = [];

function cetak(f, r) {
  const baris = r.keluaran.split('\n');
  const ringkas = baris.filter((b) => /lulus\s+\d+\s+gagal\s+\d+/i.test(b)).pop() || '';
  const m = ringkas.match(/lulus\s+(\d+)\s+gagal\s+(\d+)/i);
  const lulus = m ? Number(m[1]) : 0;
  const gagal = m ? Number(m[2]) : 0;
  // Galat konsol peramban atau galat server yang tercatat juga dihitung gagal.
  const galatLain = /galat konsol \[(?!\])/.test(ringkas) || /ERR log:? \[(?!\])/.test(ringkas);
  const ok = !!m && !gagal && !galatLain && r.status === 0 && !r.galat;
  totalLulus += lulus;
  totalGagal += gagal;
  console.log((ok ? 'LULUS ' : 'GAGAL ') + f + ' (' + lulus + ' lulus, ' + gagal + ' gagal, ' + r.detik + ' detik)');
  if (!ok) {
    bermasalah.push(f);
    const rinci = baris.filter((b) => /GAGAL|Error|galat konsol|ERR log/.test(b)).slice(0, 15);
    (rinci.length ? rinci : baris.slice(-15)).forEach((b) => console.log('    ' + b.slice(0, 400)));
    if (r.galat) console.log('    ' + r.galat.message);
  }
}

// Antrean: paling banyak `paralel` berkas berjalan sekaligus; hasil dicetak begitu semua berkas sebelumnya sudah dicetak.
const mulaiSemua = Date.now();
const hasil = new Array(berkas.length);
let berikut = 0;
let dicetak = 0;
function cetakYangSiap() {
  while (dicetak < berkas.length && hasil[dicetak]) {
    cetak(berkas[dicetak], hasil[dicetak]);
    dicetak++;
  }
}
async function pekerja() {
  while (berikut < berkas.length) {
    const i = berikut++;
    hasil[i] = await jalankanBerkas(berkas[i]);
    cetakYangSiap();
  }
}
await Promise.all(Array.from({ length: Math.min(paralel, berkas.length) }, pekerja));

const ms = Date.now() - mulaiSemua;
const lama = ms < 60000 ? Math.round(ms / 1000) + ' detik' : (ms / 60000).toFixed(1).replace('.', ',') + ' menit';
console.log('\n' + berkas.length + ' berkas uji: ' + totalLulus + ' pemeriksaan lulus, ' + totalGagal + ' gagal.' +
  (bermasalah.length ? ' Bermasalah: ' + bermasalah.join(', ') : '') + ' (' + paralel + ' sekaligus, ' + lama + ')');
process.exit(bermasalah.length ? 1 : 0);
