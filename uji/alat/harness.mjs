// Server uji: Code.gs asli di atas Spreadsheet tiruan supabase/src, di memori.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';
const REPO = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');
const STATIS = process.env.STATIS || REPO;
const { Spreadsheet } = await import(REPO + '/supabase/src/sheet.js');
const { buatLayanan } = await import(REPO + '/supabase/src/layanan.js');
const { bungkusKodeGs } = await import(REPO + '/supabase/src/bungkus.js');
const teks = fs.readFileSync(process.env.KODE || (REPO + '/apps-script/Code.gs'), 'utf8');
const pembuat = new Function('G', bungkusKodeGs(teks));

export const ss = new Spreadsheet({ tabMeta: [], dataTab: {}, zona: 'Asia/Jakarta', info: { nama: 'InventoryKu Uji' } });
export const props = {};
const drive = { folder: new Set(), folderBaru: new Set(), berkas: [] };
const jadwal = { daftar: [], berubah: false };
export const surel = [];
export const logs = [];
export const pdfHtml = [];
export const opsiUji = { vapid: '', push: [] };
export const driveUji = () => drive;
export const jadwalUji = () => jadwal;
export let geserWaktu = 0; // ms
export function aturGeser(ms) { geserWaktu = ms; }
class D extends Date {
  constructor(...a) { if (a.length === 0) super(Date.now() + geserWaktu); else super(...a); }
  static now() { return Date.now() + geserWaktu; }
  static [Symbol.hasInstance](x) { return x instanceof Date; }
}
function kode() {
  const k = {
    ss, Date: D, props, propsAwal: {}, zona: () => ss.getSpreadsheetTimeZone(),
    info: { emailPemilik: 'pemilik@contoh.invalid', alamatApi: 'http://localhost/api', vapidPublik: opsiUji.vapid },
    push: opsiUji.push, crypto, Buffer, htmlKePdf: (h) => { pdfHtml.push(h); return new TextEncoder().encode('%PDF-1.4 uji ' + h.length); }, drive, jadwal, surel,
    log: { log: (...a) => logs.push(a.join(' ')), info: (...a) => logs.push(a.join(' ')), warn: (...a) => logs.push('WARN ' + a.join(' ')), error: (...a) => logs.push('ERR ' + a.join(' ')) },
    perluTab: ss.perluTab
  };
  const G = buatLayanan(k);
  G.DI_SUPABASE = true; G.SUPABASE_ = {}; G.Date = D;
  props.SPREADSHEET_ID = props.SPREADSHEET_ID || 'supabase';
  return pembuat(G);
}
export function aksi(body) {
  return JSON.parse(kode().doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
}
export function fungsi(nama, ...arg) { return kode()[nama](...arg); }
export function ambil(n) { return kode().__ambil(n); }

export function layani(port) {
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
  const srv = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url.startsWith('/api')) {
      let b = ''; req.on('data', (c) => { b += c; });
      req.on('end', () => {
        let out;
        try { out = JSON.stringify(aksi(JSON.parse(b))); } catch (e) { out = JSON.stringify({ ok: false, pesan: 'ERR ' + e.message }); logs.push('ERR ' + e.stack); }
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(out);
      });
      return;
    }
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    if (p === '/config.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); res.end("const API_URL = 'https://api.uji/exec';"); return; }
    const f = path.join(STATIS, p);
    if (!f.startsWith(STATIS) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
  });
  srv.listen(port);
  return srv;
}
export async function pasangRute(ctx) {
  await ctx.route('https://api.uji/**', async (route) => {
    let out;
    try { out = JSON.stringify(aksi(JSON.parse(route.request().postData() || '{}'))); } catch (e) { out = JSON.stringify({ ok: false, pesan: 'ERR ' + e.message }); logs.push('ERR ' + e.stack); }
    await route.fulfill({ status: 200, contentType: 'application/json', body: out, headers: { 'Access-Control-Allow-Origin': '*' } });
  });
}
