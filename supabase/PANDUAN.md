# Pindah ke Supabase: langkah pemilik

InventoryKu kini bisa berjalan di Supabase (lebih cepat dibuka daripada Apps Script). Google Sheet
tetap ada sebagai salinan yang diperbarui tiap 5 menit, hanya untuk dicek. Rinciannya di
spesifikasi sistem Bagian 4.5.

Jangan pernah menulis kata sandi, kunci, atau `RAHASIA_SINKRON` ke dalam repo ini (repo public).
Semua rahasia hanya diisi di Supabase (Secrets) dan di Apps Script (Script Properties).

Lama pengerjaan: sekitar 30 menit, lebih mudah dari laptop. Selama langkah 8 berjalan (1–3 menit),
aplikasi menolak isian baru; pilih waktu di luar jam sibuk.

## A. Supabase

1. **Buat project.** Masuk ke https://supabase.com, buat project baru (Region: Southeast Asia
   (Singapore)). Simpan kata sandi database di tempat aman; tidak dipakai di langkah berikutnya.
2. **Buat tabel.** Menu **SQL Editor** → New query → tempel seluruh isi `supabase/skema.sql` dari repo
   ini → **Run**. Harus selesai tanpa galat. Aman dijalankan ulang.
3. **Buat Edge Function.** Menu **Edge Functions** → **Deploy a new function** → **Via Editor**.
   - Nama function: `api` (harus persis).
   - Hapus contoh kodenya, lalu tempel seluruh isi `supabase/functions/api/index.ts` dari repo ini
     (buka file itu di GitHub → tombol **Raw** → pilih semua → salin).
   - **Deploy**.
   - Buka function `api` → **Details** (atau Settings) → matikan **Enforce JWT Verification /
     Verify JWT**, lalu simpan. Tanpa ini aplikasi ditolak.
4. **Rahasia.** Menu **Edge Functions** → **Secrets** → tambahkan:
   - `RAHASIA_SINKRON`: kalimat acak yang panjang (minimal 32 huruf dan angka, misalnya dari
     pengelola kata sandi). Dipakai Apps Script untuk menyalin data; jangan dibagikan.
   - Email lewat Brevo (boleh dilewati; tanpa ini email dikirim dari Gmail pemilik lewat Apps Script,
     paling lambat 5 menit sesudah waktunya):
     - `BREVO_API_KEY`: kunci API dari https://www.brevo.com (SMTP & API → API Keys).
     - `SUREL_PENGIRIM`: alamat pengirim yang sudah diverifikasi di Brevo (Senders).
5. **Alamat API.** Alamat function: `https://<ID-PROJECT>.supabase.co/functions/v1/api` (ID project ada
   di Project Settings → General). Buka alamat itu di browser: harus tertulis
   `InventoryKu API aktif`.

## B. Apps Script (di Google Sheet yang sekarang)

6. Buka Google Sheet → Extensions → Apps Script. Ganti seluruh isi `Code.gs` dengan `apps-script/Code.gs`
   dari repo ini (baris pertama: `// InventoryKu Code.gs v0.15 ...`), lalu simpan.
7. **Project Settings** (ikon roda) → **Script Properties** → tambahkan:
   - `SUPABASE_API`: alamat dari langkah 5.
   - `RAHASIA_SINKRON`: sama persis dengan langkah 4.
8. Kembali ke editor, pilih fungsi **`pindahKeSupabase`** → **Run**. Izinkan akses baru ("connect to an
   external service"). Log menulis tab yang dipindah lalu `Selesai.` Yang terjadi:
   - semua isi Sheet dan Script Properties pindah ke Supabase (PIN dan login yang sedang berjalan tetap
     berlaku);
   - trigger lama dihapus; trigger baru `sinkronDariSupabase` tiap 5 menit dipasang;
   - jadwal laporan harian, cadangan mingguan, dan rekap bulanan dipasang di Supabase.

## C. Aplikasi

9. Ubah `config.js` di repo menjadi alamat dari langkah 5:
   `const API_URL = 'https://<ID-PROJECT>.supabase.co/functions/v1/api';`
   (atau minta Claude mengubahnya). HP yang masih memakai alamat lama dialihkan otomatis.
10. Buka aplikasi dari HP: login, Beranda, kirim satu isian. Dalam 5 menit isian itu muncul di Sheet.

## D. Pemeriksaan

11. Di editor Apps Script jalankan `kirimLaporanSekarang` (diteruskan ke Supabase). Email "[Uji]"
    harus masuk (lewat Brevo langsung, atau dari Gmail dalam 5 menit). Laporan PDF muncul di Drive
    `Laporan Kitchen/...` dalam 5 menit.
12. Di Supabase: **Database → Cron Jobs** (atau SQL: `select * from cron.job;`) berisi tiga jadwal
    `inventoryku-...`.

## Sesudah pindah

- **Sheet hanya untuk dicek.** Ketikan langsung di Sheet tertimpa. Ubah data lewat aplikasi.
- **Fungsi editor** `setupSpreadsheet`, `pasangTrigger`, `kirimLaporanSekarang`, `kirimRekapSekarang`, dan
  `buatKodePemasangan` tetap dijalankan dari editor Apps Script; semuanya diteruskan ke Supabase.
- **Jadwal** mengikuti Pengaturan → Outlet dan jadwal secara otomatis.
- **Versi baru:** jika `Code.gs` berubah, tempel `Code.gs` ke Apps Script **dan** tempel ulang
  `supabase/functions/api/index.ts` ke function `api` lalu Deploy (file itu dirakit dari Code.gs dengan
  `node supabase/rakit.mjs`). Jika `skema.sql` berubah, jalankan lagi di SQL Editor.
- **Log:** Supabase → Edge Functions → api → Logs (lama tiap aksi: "Aksi beranda: 12 ms").

## Kembali ke Apps Script (jika perlu)

Sheet berisi salinan lengkap (paling lambat 5 menit). Untuk kembali: tunggu satu salinan 5 menit,
hapus Script Property `SUDAH_PINDAH`, jalankan `pasangTrigger` di editor (trigger laporan Apps Script
dipasang lagi dan salinan 5 menit berhenti), matikan jadwal Supabase di SQL Editor
(`select cron.unschedule(jobname) from cron.job where jobname like 'inventoryku-%';`), lalu kembalikan
`config.js` ke alamat Web App Apps Script.
Untuk pindah lagi sesudahnya, isi Script Property `TIMPA_SUPABASE` dengan `ya`, lalu jalankan
`pindahKeSupabase` (isi Supabase ditimpa isi Sheet).
