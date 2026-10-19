// InventoryKu di Supabase: pintu masuk HTTP Edge Function "api".
// - Aksi aplikasi: POST body JSON (Content-Type text/plain, tanpa preflight CORS), dijawab sama persis dengan Apps Script.
// - Aksi pemilik (diawali "__"): hanya dengan rahasia RAHASIA_SINKRON (dari Apps Script pemilik) atau rahasia jadwal
//   (dari pg_cron).

import { impor, sinkron, sinkronSelesai, berkasUntukDrive, berkasTersalin, surelUntukGmail, surelTerkirim } from './sinkron.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type'
};

// Fungsi Code.gs yang boleh dijalankan pemilik dari editor Apps Script (diteruskan) atau oleh jadwal.
const FUNGSI_PEMILIK = ['setupSpreadsheet', 'pasangTrigger', 'kirimLaporanSekarang', 'kirimRekapSekarang', 'buatKodePemasangan',
  'kirimLaporanHarian', 'buatCadangan', 'kirimRekapBulanan', 'arsipTahunan', 'buatCadanganSebelumPulih'];
// Satu-satunya fungsi yang boleh berjalan selama aplikasi ditutup untuk pemulihan cadangan.
const FUNGSI_SAAT_PULIH = ['buatCadanganSebelumPulih'];
const FUNGSI_JADWAL = ['kirimLaporanHarian', 'buatCadangan', 'kirimRekapBulanan', 'pengingatSuhuOpening', 'pengingatSuhuMiddle',
  'pengingatSuhuClosing', 'pengingatStock', 'arsipTahunan'];
// Jadwal yang cukup memuat tab master; tab lain dimuat saat dibutuhkan.
const JADWAL_RINGAN = /^(pengingatSuhu|pengingatStock$|arsipTahunan$)/;

function samaAman(a, b) {
  a = String(a || '');
  b = String(b || '');
  if (!a || !b || a.length !== b.length) return false;
  let beda = 0;
  for (let i = 0; i < a.length; i++) beda |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return beda === 0;
}

function jawab(teks, status) {
  return new Response(teks, { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, CORS) });
}

/**
 * dep: { runtime, sql, adaptor, rahasiaSinkron, log, Date, adaBrevo }
 */
export function buatPelayan(dep) {
  const log = dep.log || console;
  const KelasDate = dep.Date || Date;

  async function aksiPemilik(body) {
    const a = body.action;
    if (a === '__jadwal') {
      const r = await dep.sql`select nilai #>> '{}' as nilai from inventoryku.info where kunci = 'rahasiaJadwal'`;
      if (!r.length || !samaAman(body.rahasia, r[0].nilai)) throw Object.assign(new Error('Tidak diizinkan.'), { status: 403 });
      if (FUNGSI_JADWAL.indexOf(body.nama) < 0) throw new Error('Jadwal tidak dikenal.');
      const syarat = body.syarat || {};
      if (syarat.hari || syarat.tanggal) {
        const z = await dep.sql`select nilai #>> '{}' as nilai from inventoryku.info where kunci = 'zona'`;
        const zona = z.length && z[0].nilai ? z[0].nilai : 'Asia/Jakarta';
        const bagian = {};
        new Intl.DateTimeFormat('en-US', { timeZone: zona, weekday: 'long', day: 'numeric' })
          .formatToParts(new KelasDate()).forEach((p) => { bagian[p.type] = p.value; });
        if (syarat.hari && String(bagian.weekday).toUpperCase() !== String(syarat.hari).toUpperCase()) return { dilewati: true };
        if (syarat.tanggal && Number(bagian.day) !== Number(syarat.tanggal)) return { dilewati: true };
      }
      // Pengingat cek suhu cukup memuat tab master (tab lain dimuat saat dibutuhkan), supaya ringan.
      const h = await dep.runtime.jalankan({ jenis: 'fungsi', nama: body.nama, argumen: [],
        muat: JADWAL_RINGAN.test(body.nama) ? 'master' : undefined });
      return { catatan: h.catatan };
    }
    if (!dep.rahasiaSinkron) throw new Error('Secret RAHASIA_SINKRON belum dipasang di Supabase (Edge Functions → Secrets).');
    if (!samaAman(body.rahasia, dep.rahasiaSinkron)) throw Object.assign(new Error('Rahasia sinkron salah.'), { status: 403 });
    switch (a) {
      case '__impor':
        if (body.langkah === 'mulai' && !body.timpa) {
          const ada = await dep.sql`select count(*)::int as n from inventoryku.tab_baris`;
          if (ada[0].n > 0) {
            throw new Error('Supabase sudah berisi data. Untuk menimpanya dengan isi Sheet, isi Script Property TIMPA_SUPABASE dengan ya.');
          }
        }
        return impor(dep.sql, body, dep.runtime.simpan);
      case '__pulihkan':
        // Pemulihan cadangan (Code.gs v0.26): "tutup" menutup aplikasi (runtime menolak aksi dengan cobaLagi) dan menjawab
        // jumlah baris sekarang; "buka" membukanya lagi jika pemulihan batal sebelum isi diubah.
        // setengah: pemulihan sebelumnya berhenti sesudah isi database dihapus (impor "mulai"), jadi isinya belum lengkap:
        // tidak dicadangkan lagi, dan "buka" ditolak sampai pemulihan berhasil.
        if (body.langkah === 'tutup') {
          const lama = await dep.sql`select nilai from inventoryku.info where kunci = 'pemulihan'`;
          const setengah = !!(lama.length && lama[0].nilai && lama[0].nilai.impor);
          const isi = { mulai: new KelasDate().toISOString(), berkas: String(body.berkas || ''), impor: setengah };
          await dep.sql`insert into inventoryku.info (kunci, nilai) values ('pemulihan', ${dep.sql.json(isi)})
            on conflict (kunci) do update set nilai = excluded.nilai`;
          const n = await dep.sql`select count(*)::int as n from inventoryku.tab_baris`;
          return { baris: n[0].n, setengah };
        }
        if (body.langkah === 'buka') {
          const r = await dep.sql`delete from inventoryku.info where kunci = 'pemulihan' and not coalesce((nilai ->> 'impor')::boolean, false)
            returning kunci`;
          const sisa = await dep.sql`select 1 from inventoryku.info where kunci = 'pemulihan'`;
          return { dibuka: r.length > 0 || !sisa.length };
        }
        throw new Error('Langkah pemulihan tidak dikenal.');
      case '__sinkron':
        return sinkron(dep.sql, body, dep.runtime.simpan);
      case '__sinkronSelesai':
        return sinkronSelesai(dep.sql, body);
      case '__berkas':
        return berkasUntukDrive(dep.sql, dep.adaptor.alamatBerkas);
      case '__berkasTersalin':
        return berkasTersalin(dep.sql, body);
      case '__surel':
        return dep.adaptor.kirimSurel ? [] : surelUntukGmail(dep.sql);
      case '__surelTerkirim': {
        const gagal = await surelTerkirim(dep.sql, body);
        for (const g of gagal) await dep.runtime.catatSurelGagal(g.asal, g.galat);
        return {};
      }
      case '__fungsi': {
        if (FUNGSI_PEMILIK.indexOf(body.nama) < 0) throw new Error('Fungsi ' + body.nama + ' tidak bisa dijalankan dari sini.');
        const h = await dep.runtime.jalankan({ jenis: 'fungsi', nama: body.nama, argumen: body.argumen || [],
          muat: JADWAL_RINGAN.test(body.nama) ? 'master' : undefined, saatPulih: FUNGSI_SAAT_PULIH.indexOf(body.nama) >= 0 });
        return { keluaran: h.keluaran === undefined ? null : h.keluaran, catatan: h.catatan };
      }
      default:
        throw new Error('Aksi pemilik tidak dikenal.');
    }
  }

  return async function pelayan(req) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (req.method !== 'POST') {
      return new Response('InventoryKu API aktif', { headers: Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, CORS) });
    }
    const mulai = Date.now();
    let teks = '';
    let body = {};
    try {
      teks = await req.text();
      body = teks ? JSON.parse(teks) : {};
      if (!body || typeof body !== 'object') body = {};
    } catch (err) {
      body = {};
    }
    const nama = typeof body.action === 'string' ? body.action : '';
    if (nama.indexOf('__') === 0) {
      try {
        const data = await aksiPemilik(body);
        log.log('Pemilik ' + nama + (body.nama ? ' ' + body.nama : '') + ': ' + (Date.now() - mulai) + ' ms');
        return jawab(JSON.stringify({ ok: true, data: data == null ? {} : data }));
      } catch (err) {
        log.error('Pemilik ' + nama + ' gagal: ' + (err && err.stack ? err.stack : err));
        return jawab(JSON.stringify({ ok: false, pesan: err && err.message ? err.message : String(err) }), err && err.status ? err.status : 200);
      }
    }
    try {
      const h = await dep.runtime.jalankan({ jenis: 'aksi', body });
      return jawab(await dep.runtime.gantiTautanBerkas(h.keluaran));
    } catch (err) {
      // Aplikasi ditutup untuk pemulihan cadangan: HP memperlakukannya seperti tanpa sinyal (isian masuk antrean).
      if (err && err.pemulihan) return jawab(JSON.stringify({ ok: false, pesan: err.message, cobaLagi: true }));
      log.error('Aksi ' + (nama || '?') + ' gagal: ' + (err && err.stack ? err.stack : err));
      return jawab(JSON.stringify({ ok: false, pesan: 'Terjadi kesalahan di server. Coba lagi beberapa saat lagi.' }));
    }
  };
}
