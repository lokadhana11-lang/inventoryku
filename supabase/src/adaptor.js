// InventoryKu di Supabase: layanan luar yang dipakai runtime.
// - Storage (bucket "arsip"): isi berkas laporan PDF, foto bukti waste, cadangan. Nama objek = id berkas.
// - Brevo: email (hanya jika BREVO_API_KEY dipasang; jika tidak, Apps Script mengirim dari Gmail pemilik).
// - pg_cron + pg_net: jadwal laporan harian, cadangan mingguan, rekap bulanan.

import { selisihMenit } from './layanan.js';

const BUCKET = 'arsip';

/**
 * opsi: { sql, fetch, url (SUPABASE_URL), kunci (SUPABASE_SERVICE_ROLE_KEY), brevo (BREVO_API_KEY),
 *         pengirim (SUREL_PENGIRIM), alamatApi (alamat Edge Function ini), Date }
 */
export function buatAdaptor(o) {
  const ambil = o.fetch || fetch;
  const kepala = { Authorization: 'Bearer ' + o.kunci, apikey: o.kunci };

  async function unggah(b) {
    const r = await ambil(o.url + '/storage/v1/object/' + BUCKET + '/' + b.id, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': b.mime || 'application/octet-stream', 'x-upsert': 'true' }, kepala),
      body: b.isi
    });
    if (!r.ok) throw new Error('Berkas ' + b.nama + ' gagal disimpan (' + r.status + '): ' + (await r.text()).slice(0, 200));
  }

  /** Tautan unduh sementara: { id: url }. */
  async function alamatBerkas(id, detik) {
    if (!id.length) return {};
    const r = await ambil(o.url + '/storage/v1/object/sign/' + BUCKET, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, kepala),
      body: JSON.stringify({ expiresIn: detik || 6 * 3600, paths: id })
    });
    if (!r.ok) throw new Error('Tautan berkas gagal dibuat (' + r.status + ').');
    const daftar = await r.json();
    const hasil = {};
    for (const x of daftar) {
      if (x && x.signedURL && x.path) hasil[x.path] = o.url + '/storage/v1' + x.signedURL;
    }
    return hasil;
  }

  async function hapusBerkas(id) {
    if (!id.length) return;
    const r = await ambil(o.url + '/storage/v1/object/' + BUCKET, {
      method: 'DELETE',
      headers: Object.assign({ 'Content-Type': 'application/json' }, kepala),
      body: JSON.stringify({ prefixes: id })
    });
    if (!r.ok) throw new Error('Berkas gagal dihapus (' + r.status + ').');
  }

  async function kirimSurel(isi) {
    const tujuan = String(isi.to || '').split(',').map((x) => x.trim()).filter(Boolean);
    if (!tujuan.length) throw new Error('tanpa penerima');
    const body = {
      sender: { name: isi.name || 'InventoryKu', email: o.pengirim },
      to: tujuan.map((email) => ({ email })),
      subject: isi.subject || 'InventoryKu',
      textContent: isi.body || ' '
    };
    if (isi.htmlBody) body.htmlContent = isi.htmlBody;
    if (isi.attachments && isi.attachments.length) body.attachment = isi.attachments.map((a) => ({ name: a.nama, content: a.data }));
    const r = await ambil('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': o.brevo, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error('Brevo menolak (' + r.status + '): ' + (await r.text()).slice(0, 200));
  }

  /**
   * Trigger Code.gs (ScriptApp tiruan) menjadi jadwal pg_cron. pg_cron memakai UTC, jadi jam lokal diubah memakai
   * selisih zona waktu sekarang (Indonesia tanpa jam musim panas). Jadwal mingguan dan bulanan dijalankan tiap hari
   * pada jamnya, dan Edge Function memeriksa hari atau tanggalnya dalam zona waktu lokal (syarat).
   */
  async function pasangJadwal(daftar) {
    const KelasDate = o.Date || Date;
    await o.sql.begin(async (tx) => {
      let rahasia = await tx`select nilai from inventoryku.info where kunci = 'rahasiaJadwal'`;
      if (!rahasia.length) {
        const baru = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
        await tx`insert into inventoryku.info (kunci, nilai) values ('rahasiaJadwal', ${tx.json(baru)})`;
      }
      await tx`insert into inventoryku.info (kunci, nilai) values ('alamatApi', ${tx.json(o.alamatApi)})
        on conflict (kunci) do update set nilai = excluded.nilai`;
      const lama = await tx`select jobname from cron.job where jobname like 'inventoryku-%'`;
      for (const j of lama) await tx`select cron.unschedule(${j.jobname})`;
      for (const t of daftar) {
        const menitLokal = (Number(t.jam) || 0) * 60 + (Number(t.menit) || 0);
        const selisih = selisihMenit(new KelasDate().getTime(), t.zona || 'Asia/Jakarta');
        const utc = ((menitLokal - selisih) % 1440 + 1440) % 1440;
        const syarat = {};
        if (t.hariMinggu) syarat.hari = t.hariMinggu;
        if (t.tanggalBulan) syarat.tanggal = Number(t.tanggalBulan);
        const cronTeks = (t.setiapMenit ? '*/' + t.setiapMenit + ' * * * *' : (utc % 60) + ' ' + Math.floor(utc / 60) + ' * * *');
        const perintah = "select net.http_post(url := (select nilai #>> '{}' from inventoryku.info where kunci = 'alamatApi'), " +
          "body := jsonb_build_object('action', '__jadwal', 'nama', " + teksSql(t.fungsi) + ", 'syarat', " +
          teksSql(JSON.stringify(syarat)) + "::jsonb, 'rahasia', (select nilai #>> '{}' from inventoryku.info where kunci = 'rahasiaJadwal')), " +
          "headers := '{\"Content-Type\": \"text/plain;charset=utf-8\"}'::jsonb, timeout_milliseconds := 300000)";
        await tx`select cron.schedule(${'inventoryku-' + t.fungsi}, ${cronTeks}, ${perintah})`;
      }
    });
  }

  return { unggah, alamatBerkas, hapusBerkas, kirimSurel: o.brevo && o.pengirim ? kirimSurel : null, pasangJadwal };
}

function teksSql(s) {
  return "'" + String(s).replace(/'/g, "''") + "'";
}
