// InventoryKu di Supabase: hubungan dengan Apps Script (Google Sheets dan Drive pemilik).
// - impor: data lama dari Google Sheets masuk ke Supabase (sekali, saat pindah).
// - sinkron: salinan ke Sheets tiap 5 menit. Hanya tab yang berubah, dan untuk tab yang sudah pernah disalin hanya
//   baris yang berubah (hapus, sisip, ubah), supaya kuota waktu Apps Script tidak habis.
// - berkas: laporan PDF, foto waste, dan cadangan disalin ke Drive pemilik.
// - surel: email yang belum terkirim lewat Brevo dikirim Apps Script dari Gmail pemilik.
// Sheets hanya untuk dicek: perubahan yang diketik langsung di Sheets tertimpa salinan berikutnya.

import { kodeNilai, uraiNilai } from './penyimpanan.js';
import { urutkanBaris } from './sheet.js';
import { formatTanggal, PENANDA_BERKAS } from './layanan.js';

const KUNCI_TULIS = 4207;
// Tab berumus milik Sheets (Harian_*, Dashboard) tidak disalin: rumusnya menghitung dari tab yang disalin.
export const tabDisalin = (nama) => !/^Harian_/.test(nama) && nama !== 'Dashboard';
const BATAS_SEL_KIRIM = 400000; // kira-kira; sisanya disalin pada putaran berikutnya
const WAKTU_CEK = ['opening', 'middle', 'closing', 'cek ulang'];

/* ---------- Impor dari Google Sheets ---------- */

/**
 * langkah "mulai": { tab: [{ nama, urutan, meta }], properti: { kunci: nilai }, info: { ... } } → menghapus isi lama.
 * langkah "baris": { nama, dari, nilai: [[...]] } (tanggal { $d: ms }) → menambah baris (dipotong per bagian).
 * langkah "selesai": versi semua tab dinaikkan dan keadaan salinan = isi sekarang (Sheets sudah sama).
 */
export async function impor(sql, body, simpan) {
  return sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(${KUNCI_TULIS})`;
    if (body.langkah === 'mulai') {
      await tx`delete from inventoryku.tab_meta`;
      await tx`delete from inventoryku.sinkron`;
      await tx`delete from inventoryku.aksi_tab`;
      await tx`delete from inventoryku.properti`;
      await tx`delete from inventoryku.info where kunci not in ('rahasiaJadwal', 'jadwal', 'alamatApi')`;
      for (const t of body.tab || []) {
        await tx`insert into inventoryku.tab_meta (nama, urutan, meta, versi)
          values (${String(t.nama)}, ${Number(t.urutan) || 0}, ${tx.json(t.meta || {})}, 1)`;
      }
      const prop = body.properti || {};
      for (const k of Object.keys(prop)) {
        await tx`insert into inventoryku.properti (kunci, nilai) values (${k}, ${String(prop[k])})`;
      }
      const info = body.info || {};
      for (const k of Object.keys(info)) {
        await tx`insert into inventoryku.info (kunci, nilai) values (${k}, ${tx.json(info[k])})
          on conflict (kunci) do update set nilai = excluded.nilai`;
      }
      simpan.cacheTab.clear();
      return { tab: (body.tab || []).length };
    }
    if (body.langkah === 'baris') {
      const dari = Number(body.dari) || 1;
      const data = (body.nilai || []).map((b, i) => {
        const v = (b || []).map((x) => kodeNilai(uraiNilai(x)));
        while (v.length && (v[v.length - 1] === '' || v[v.length - 1] == null)) v.pop();
        return { pos: dari + i, nilai: v };
      });
      if (data.length) {
        await tx`insert into inventoryku.tab_baris (tab, pos, nilai)
          select ${String(body.nama)}, x.pos, x.nilai from jsonb_to_recordset(${tx.json(data)}) as x(pos float8, nilai jsonb)`;
      }
      return { baris: data.length };
    }
    if (body.langkah === 'selesai') {
      await tx`update inventoryku.tab_meta set versi = versi + 1, diubah = now()`;
      simpan.cacheTab.clear();
      const metas = await tx`select nama, meta, versi from inventoryku.tab_meta`;
      const zonaRow = await tx`select nilai from inventoryku.info where kunci = 'zona'`;
      const zona = zonaRow.length && zonaRow[0].nilai ? zonaRow[0].nilai : 'Asia/Jakarta';
      const versi = {};
      for (const m of metas) {
        if (!tabDisalin(m.nama)) continue;
        const baris = await barisUrut(tx, simpan, m, zona);
        const r = await tx`select max(diubah) as tanda from inventoryku.tab_baris where tab = ${m.nama}`;
        const tanda = Number(r[0].tanda || 0);
        await tx`insert into inventoryku.sinkron (tab, versi, ids, tanda)
          values (${m.nama}, ${m.versi}, ${baris.map((b) => b.id)}, ${tanda})
          on conflict (tab) do update set versi = excluded.versi, ids = excluded.ids, tanda = excluded.tanda,
            tertunda_versi = null, tertunda_ids = null, tertunda_tanda = null`;
        versi[m.nama] = Number(m.versi);
      }
      return { versi };
    }
    throw new Error('Langkah impor tidak dikenal.');
  });
}

/* ---------- Salinan tab ke Sheets ---------- */

function urutkanSuhu(baris, zona) {
  const judul = (baris[0] || { v: [] }).v.map((x) => String(x));
  const kol = (n) => judul.indexOf(n);
  const kT = kol('Tanggal');
  const kU = kol('Nama Unit');
  const kW = kol('Waktu Cek');
  const kS = kol('timestamp_server');
  const teks = (v) => (v instanceof Date ? formatTanggal(v, zona, 'yyyy-MM-dd') : String(v == null ? '' : v).trim());
  const isi = baris.slice(1).map((b, i) => {
    const w = kW < 0 ? '' : String(b.v[kW] == null ? '' : b.v[kW]).trim().toLowerCase();
    const ts = kS < 0 ? null : b.v[kS];
    return {
      b, i,
      tanggal: kT < 0 ? '' : teks(b.v[kT]),
      unit: kU < 0 ? '' : String(b.v[kU] == null ? '' : b.v[kU]).trim().toLowerCase(),
      waktu: WAKTU_CEK.indexOf(w) >= 0 ? WAKTU_CEK.indexOf(w) : WAKTU_CEK.length,
      ts: ts instanceof Date && !isNaN(ts.getTime()) ? ts.getTime() : Infinity
    };
  });
  isi.sort((a, b) => {
    if (!a.tanggal !== !b.tanggal) return a.tanggal ? -1 : 1;
    if (a.tanggal !== b.tanggal) return a.tanggal < b.tanggal ? 1 : -1;
    if (a.unit !== b.unit) return a.unit < b.unit ? -1 : 1;
    if (a.waktu !== b.waktu) return a.waktu - b.waktu;
    if (a.ts !== b.ts) return a.ts < b.ts ? -1 : 1;
    return a.i - b.i;
  });
  return [baris[0]].concat(isi.map((x) => x.b));
}

/** Isi tab menurut urutan yang tampil di Sheets (aturan urut tab diterapkan, Data_Suhu menurut butir 151). */
async function barisUrut(tx, simpan, meta, zona) {
  const data = await simpan.muatTab(tx, meta.nama, Number(meta.versi));
  let baris = data.slice();
  // Baris di ujung bawah yang kolom A-nya kosong (sisa tab, kotak centang FALSE) tidak disalin, sama dengan
  // barisKunciTerakhir_ di Code.gs yang dipakai Apps Script untuk memeriksa salinannya.
  const kunciKosong = (x) => x === '' || x == null || x === false || (typeof x === 'string' && !x.trim());
  while (baris.length > 1 && kunciKosong(baris[baris.length - 1].v[0])) baris.pop();
  if (meta.meta && meta.meta.urutan) urutkanBaris(baris, meta.meta.urutan, 1);
  if (meta.nama === 'Data_Suhu' && baris.length > 2) baris = urutkanSuhu(baris, zona);
  return baris;
}

// Nilai sel untuk Sheets: tanggal { $d }, teks yang diawali = + - @ diberi kutip supaya tetap teks (seperti teksAman_),
// alamat berkas Supabase diganti alamat salinannya di Drive.
function nilaiSheets(v, driveUrl) {
  if (v instanceof Date) return { $d: v.getTime() };
  if (typeof v === 'string') {
    let s = v;
    if (s.indexOf(PENANDA_BERKAS) >= 0) {
      s = s.replace(/https:\/\/berkas\.inventoryku\/([0-9a-f-]{36})/g, (m, id) => driveUrl.get(id) || '(berkas belum disalin ke Drive)');
    }
    return /^[=+\-@]/.test(s) ? "'" + s : s;
  }
  if (typeof v === 'number' && !isFinite(v)) return '';
  return v == null ? '' : v;
}

function barisSheets(b, lebar, driveUrl) {
  const a = new Array(lebar);
  for (let i = 0; i < lebar; i++) a[i] = nilaiSheets(i < b.v.length ? b.v[i] : '', driveUrl);
  return a;
}

/**
 * Langkah perubahan dari isi lama (id menurut urutan di Sheets) ke isi baru. Hasil null jika urutan baris lama
 * berubah (jarang: misalnya tanggal dikoreksi), sehingga tab disalin penuh.
 * Langkah: { hapus: baris, jumlah } | { sisip: baris, nilai } | { ubah: baris, nilai }, dengan nomor baris Sheets
 * pada saat langkah itu dijalankan (langkah dijalankan berurutan).
 */
export function langkahUbah(lama, baru, berubah, lebar, driveUrl) {
  const adaBaru = new Set(baru.map((b) => b.id));
  const tetap = lama.filter((id) => adaBaru.has(id));
  const posBaru = new Map(baru.map((b, i) => [b.id, i]));
  for (let i = 1; i < tetap.length; i++) if (posBaru.get(tetap[i]) < posBaru.get(tetap[i - 1])) return null;
  const langkah = [];
  const tambah = (jenis, r, nilai) => {
    const akhir = langkah[langkah.length - 1];
    if (jenis === 'hapus') {
      if (akhir && akhir.hapus === r) akhir.jumlah++;
      else langkah.push({ hapus: r, jumlah: 1 });
    } else if (akhir && akhir[jenis] != null && akhir[jenis] + akhir.nilai.length === r) {
      akhir.nilai.push(nilai);
    } else {
      langkah.push({ [jenis]: r, nilai: [nilai] });
    }
  };
  let i = 0;
  let j = 0;
  let r = 1;
  let sel = 0;
  while (i < lama.length || j < baru.length) {
    if (i < lama.length && !adaBaru.has(lama[i])) {
      tambah('hapus', r);
      i++;
    } else if (j < baru.length && (i >= lama.length || baru[j].id !== lama[i])) {
      tambah('sisip', r, barisSheets(baru[j], lebar, driveUrl));
      sel += lebar;
      r++;
      j++;
    } else {
      if (berubah(baru[j])) {
        tambah('ubah', r, barisSheets(baru[j], lebar, driveUrl));
        sel += lebar;
      }
      r++;
      i++;
      j++;
    }
  }
  return { langkah, sel };
}

/**
 * versiKlien: { nama tab: versi yang sudah tertulis di Sheets }. Mengembalikan { tab: [...], selesai }.
 * Tiap tab: { nama, versi, urutan, lebar, penuh: true, nilai } atau { nama, versi, urutan, lebar, langkah }.
 * Keadaan yang dikirim disimpan "tertunda" sampai Apps Script memastikan sudah ditulis (sinkronSelesai).
 */
export async function sinkron(sql, body, simpan) {
  const versiKlien = body.versi || {};
  return sql.begin('isolation level repeatable read', async (tx) => {
    const metas = await tx`select nama, urutan, meta, versi from inventoryku.tab_meta order by urutan, nama`;
    const snapRows = await tx`select * from inventoryku.sinkron`;
    const snap = new Map(snapRows.map((s) => [s.tab, s]));
    const zonaRow = await tx`select nilai from inventoryku.info where kunci = 'zona'`;
    const zona = zonaRow.length && zonaRow[0].nilai ? zonaRow[0].nilai : 'Asia/Jakarta';
    const driveRows = await tx`select id, drive_url from inventoryku.berkas where drive_url is not null`;
    const driveUrl = new Map(driveRows.map((b) => [b.id, b.drive_url]));
    const hasil = [];
    let sel = 0;
    let selesai = true;
    for (const m of metas) {
      if (!tabDisalin(m.nama)) continue;
      const versi = Number(m.versi);
      let s = snap.get(m.nama);
      const klien = versiKlien[m.nama] == null ? null : Number(versiKlien[m.nama]);
      // Apps Script sudah menulis kiriman tertunda tetapi belum sempat memastikannya.
      if (s && s.tertunda_versi != null && klien === Number(s.tertunda_versi)) {
        s = Object.assign({}, s, { versi: s.tertunda_versi, ids: s.tertunda_ids, tanda: s.tertunda_tanda });
        await tx`update inventoryku.sinkron set versi = tertunda_versi, ids = tertunda_ids, tanda = tertunda_tanda,
          tertunda_versi = null, tertunda_ids = null, tertunda_tanda = null where tab = ${m.nama}`;
      }
      const sama = s && klien != null && klien === Number(s.versi);
      if (sama && Number(s.versi) === versi) continue;
      if (sel > BATAS_SEL_KIRIM) { selesai = false; continue; }
      const baris = await barisUrut(tx, simpan, m, zona);
      const lebar = baris.reduce((a, b) => {
        let n = b.v.length;
        while (n && (b.v[n - 1] === '' || b.v[n - 1] == null)) n--;
        return Math.max(a, n);
      }, 0);
      const ubahRows = await tx`select id, diubah from inventoryku.tab_baris where tab = ${m.nama}`;
      const diubah = new Map(ubahRows.map((x) => [Number(x.id), Number(x.diubah)]));
      const tanda = ubahRows.reduce((a, x) => Math.max(a, Number(x.diubah)), 0);
      let kirim = null;
      if (sama && s.ids) {
        const batas = Number(s.tanda);
        const lama = s.ids.map(Number);
        const l = langkahUbah(lama, baris, (b) => (diubah.get(b.id) || 0) > batas, lebar, driveUrl);
        // Kolom baru: judulnya ikut sebagai baris 1 yang berubah. Perubahan besar disalin penuh saja.
        if (l && l.sel < Math.max(2000, baris.length * lebar * 0.5)) {
          kirim = { nama: m.nama, versi, urutan: m.urutan, lebar, langkah: l.langkah, barisLama: lama.length };
          sel += l.sel;
        }
      }
      if (!kirim) {
        kirim = { nama: m.nama, versi, urutan: m.urutan, lebar, penuh: true, nilai: baris.map((b) => barisSheets(b, lebar, driveUrl)) };
        sel += baris.length * lebar;
      }
      hasil.push(kirim);
      await tx`insert into inventoryku.sinkron (tab, tertunda_versi, tertunda_ids, tertunda_tanda)
        values (${m.nama}, ${versi}, ${baris.map((b) => b.id)}, ${tanda})
        on conflict (tab) do update set tertunda_versi = excluded.tertunda_versi, tertunda_ids = excluded.tertunda_ids,
          tertunda_tanda = excluded.tertunda_tanda`;
    }
    return { tab: hasil, selesai, urutan: metas.filter((m) => tabDisalin(m.nama)).map((m) => m.nama) };
  });
}

/** versi: { nama tab: versi yang sudah ditulis Apps Script }. */
export async function sinkronSelesai(sql, body) {
  const versi = body.versi || {};
  let n = 0;
  for (const nama of Object.keys(versi)) {
    const r = await sql`update inventoryku.sinkron set versi = tertunda_versi, ids = tertunda_ids, tanda = tertunda_tanda,
      tertunda_versi = null, tertunda_ids = null, tertunda_tanda = null
      where tab = ${nama} and tertunda_versi = ${Number(versi[nama])} returning tab`;
    n += r.length;
  }
  return { tab: n };
}

/* ---------- Berkas ke Drive ---------- */

/** Berkas yang belum punya salinan di Drive (dengan tautan unduh sementara), dan salinan yang perlu dibuang. */
export async function berkasUntukDrive(sql, alamatBerkas) {
  const baru = await sql`select id, jalur, nama, mime, ukuran from inventoryku.berkas
    where drive_id is null and not dibuang order by dibuat limit 8`;
  const buang = await sql`select id, drive_id from inventoryku.berkas
    where dibuang and drive_id is not null and not drive_dibuang limit 30`;
  const url = baru.length ? await alamatBerkas(baru.map((b) => b.id), 3600) : {};
  return {
    salin: baru.filter((b) => url[b.id]).map((b) => ({ id: b.id, jalur: b.jalur, nama: b.nama, mime: b.mime, ukuran: b.ukuran, url: url[b.id] })),
    buang: buang.map((b) => ({ id: b.id, driveId: b.drive_id }))
  };
}

/** salin: [{ id, driveId, url }], buang: [id]. Baris yang memuat alamat berkas itu ditandai berubah supaya disalin ulang. */
export async function berkasTersalin(sql, body) {
  return sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(${KUNCI_TULIS})`;
    for (const b of body.salin || []) {
      const r = await tx`update inventoryku.berkas set drive_id = ${String(b.driveId)}, drive_url = ${String(b.url)}
        where id = ${String(b.id)} returning id`;
      if (!r.length) continue;
      const tab = await tx`update inventoryku.tab_baris set diubah = nextval('inventoryku.urut_ubah')
        where nilai::text like ${'%' + PENANDA_BERKAS + String(b.id) + '%'} returning tab`;
      const nama = [...new Set(tab.map((t) => t.tab))];
      if (nama.length) await tx`update inventoryku.tab_meta set versi = versi + 1 where nama = any(${nama})`;
    }
    for (const id of body.buang || []) {
      await tx`update inventoryku.berkas set drive_dibuang = true where id = ${String(id)}`;
    }
    return {};
  });
}

/* ---------- Email lewat Gmail pemilik (jika Brevo tidak dipasang) ---------- */

export async function surelUntukGmail(sql) {
  const r = await sql`select id, isi from inventoryku.surel_keluar
    where terkirim is null and galat is null and dibuat > now() - interval '3 days' order by id limit 5`;
  return r.map((x) => Object.assign({ id: Number(x.id) }, x.isi));
}

/** hasil: [{ id, galat? }]. Mengembalikan email yang gagal (untuk dicatat di M_Konfigurasi). */
export async function surelTerkirim(sql, body) {
  const gagal = [];
  for (const h of body.hasil || []) {
    if (h.galat) {
      const r = await sql`update inventoryku.surel_keluar set galat = ${String(h.galat)}, lewat = 'gmail'
        where id = ${Number(h.id)} returning asal`;
      if (r.length) gagal.push({ asal: r[0].asal, galat: String(h.galat) });
    } else {
      await sql`update inventoryku.surel_keluar set terkirim = now(), lewat = 'gmail' where id = ${Number(h.id)}`;
    }
  }
  return gagal;
}
