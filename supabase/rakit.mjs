// Merakit Edge Function "api" menjadi SATU file (supabase/functions/api/index.ts) yang bisa ditempel di
// Supabase → Edge Functions → editor, berisi: modul supabase/src/*.js dan Code.gs utuh.
// Jalankan: node supabase/rakit.mjs   (sesudah Code.gs atau supabase/src berubah)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dasar = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(dasar, 'src');
const urutan = ['sheet', 'layanan', 'penyimpanan', 'pdf', 'bungkus', 'runtime', 'sinkron', 'adaptor', 'server'];

function ubahModul(nama, teks) {
  const ekspor = [];
  let isi = teks.replace(/^import\s*\{([^}]*)\}\s*from\s*'\.\/([a-z]+)\.js';\s*$/gm, (m, daftar, asal) => {
    const nama2 = daftar.split(',').map((x) => x.trim()).filter(Boolean).map((x) => x.replace(/\s+as\s+/, ': '));
    return 'const { ' + nama2.join(', ') + ' } = __' + asal + ';';
  });
  if (/^import\s/m.test(isi)) throw new Error('Impor yang tidak dikenal di ' + nama + '.js');
  isi = isi.replace(/^export\s+(async\s+function|function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm, (m, jenis, n) => {
    ekspor.push(n);
    return jenis + ' ' + n;
  });
  if (/^export\s/m.test(isi)) throw new Error('Ekspor yang tidak dikenal di ' + nama + '.js');
  return 'const __' + nama + ' = (() => {\n' + isi + '\nreturn { ' + ekspor.join(', ') + ' };\n})();\n';
}

const kodeGs = fs.readFileSync(path.join(dasar, '..', 'apps-script', 'Code.gs'), 'utf8');
const versiGs = (kodeGs.split('\n')[0].match(/v[\d.]+/) || ['?'])[0];
const modul = urutan.map((n) => ubahModul(n, fs.readFileSync(path.join(src, n + '.js'), 'utf8'))).join('\n');

const hasil = `// InventoryKu Edge Function "api" (Code.gs ${versiGs}). FILE INI DIRAKIT OTOMATIS oleh supabase/rakit.mjs:
// jangan diubah di sini; ubah supabase/src/*.js atau apps-script/Code.gs, lalu jalankan node supabase/rakit.mjs.
// Tempel seluruh isi file ini di Supabase → Edge Functions → api → Code, lalu Deploy. Matikan "Verify JWT".
// @ts-nocheck

import postgres from 'npm:postgres@3.4.5';
import { jsPDF } from 'npm:jspdf@2.5.2';
import { Buffer } from 'node:buffer';
import * as nodeCrypto from 'node:crypto';

${modul}
const KODE_GS = ${JSON.stringify(kodeGs)};

const env = (n) => (Deno.env.get(n) || '').trim();
const sql = postgres(env('SUPABASE_DB_URL'), { prepare: false, max: 4, idle_timeout: 20, onnotice: () => {} });
const pabrik = new Function('G', __bungkus.bungkusKodeGs(KODE_GS));
const alamatApi = env('ALAMAT_API') || env('SUPABASE_URL') + '/functions/v1/api';
const adaptor = __adaptor.buatAdaptor({
  sql, url: env('SUPABASE_URL'), kunci: env('SUPABASE_SERVICE_ROLE_KEY'), brevo: env('BREVO_API_KEY'),
  pengirim: env('SUREL_PENGIRIM'), alamatApi
});
const runtime = __runtime.buatRuntime({
  sql, buatKodeGs: pabrik, crypto: nodeCrypto, Buffer, htmlKePdf: __pdf.buatHtmlKePdf(jsPDF),
  unggah: adaptor.unggah, alamatBerkas: adaptor.alamatBerkas, hapusBerkas: adaptor.hapusBerkas,
  kirimSurel: adaptor.kirimSurel, pasangJadwal: adaptor.pasangJadwal, tambahan: { alamatApi }
});
Deno.serve(__server.buatPelayan({ runtime, sql, adaptor, rahasiaSinkron: env('RAHASIA_SINKRON') }));
`;

const tujuan = path.join(dasar, 'functions', 'api', 'index.ts');
fs.mkdirSync(path.dirname(tujuan), { recursive: true });
fs.writeFileSync(tujuan, hasil);
console.log('Dirakit: ' + path.relative(path.join(dasar, '..'), tujuan) + ' (' + Math.round(hasil.length / 1024) + ' KB, Code.gs ' + versiGs + ')');
