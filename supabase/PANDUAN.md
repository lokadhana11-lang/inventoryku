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
   - Nama function: `api`. Jika Supabase memberi nama lain (misalnya `rapid-action`), boleh dipakai: tambahkan secret
     `ALAMAT_API` berisi alamat function itu (langkah 4) dan pakai alamat itu di langkah 5, 7, dan 9.
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
    Sesudah jam laporan pertama (sekitar 22.15 WIB), pastikan jadwal itu benar-benar berjalan:
    `select j.jobname, d.status, d.return_message, d.start_time from cron.job_run_details d join cron.job j
    using (jobid) where j.jobname like 'inventoryku-%' order by d.start_time desc limit 5;` harus berstatus
    `succeeded`. Jika laporan tidak terkirim, Beranda Pengelola juga menulis "Laporan harian: laporan untuk …
    belum terkirim" (Code.gs v0.15.1).

## Sesudah pindah

- **Sheet hanya untuk dicek.** Ketikan langsung di Sheet tertimpa. Ubah data lewat aplikasi.
- **Fungsi editor** `setupSpreadsheet`, `pasangTrigger`, `kirimLaporanSekarang`, `kirimRekapSekarang`, dan
  `buatKodePemasangan` tetap dijalankan dari editor Apps Script; semuanya diteruskan ke Supabase. Cadangan dan
  pemulihan: lihat "Cadangan dan pemulihan" di bawah.
- **Jadwal** mengikuti Pengaturan → Outlet dan jadwal secara otomatis.
- **Versi baru:** jika `Code.gs` berubah, tempel `Code.gs` ke Apps Script **dan** tempel ulang
  `supabase/functions/api/index.ts` ke function `api` lalu Deploy (file itu dirakit dari Code.gs dengan
  `node supabase/rakit.mjs`). Jika `skema.sql` berubah, jalankan lagi di SQL Editor. Urutan yang aman:
  Deploy Edge Function lebih dulu, lalu tempel Code.gs, lalu (jika diminta) `setupSpreadsheet`. Sejak Code.gs
  v0.30, `setupSpreadsheet` berhenti dengan pesan jika Edge Function masih versi lama, supaya Sheet tidak
  punya tab yang tidak ada di Supabase.
- **Log:** Supabase → Edge Functions → api → Logs (lama tiap aksi: "Aksi beranda: 12 ms").

## Function di region yang sama dengan database

Edge Function biasanya berjalan di region terdekat dengan HP, sedangkan database tetap di region project
(Project Settings → General → Region). Jika keduanya berbeda (misalnya HP di Indonesia, database di Sydney),
setiap bacaan database menyeberang antarnegara. Karena itu alamat di `config.js` diberi
`?forceFunctionRegion=<kode region database>`, sehingga function berjalan di samping database dan HP cukup
menyeberang sekali per permintaan. Kode region: Sydney `ap-southeast-2`, Singapore `ap-southeast-1`.

- **Memeriksa** (dari laptop): buka alamat lengkap dari `config.js` di Chrome → klik kanan → Inspect → tab
  Network → muat ulang → klik permintaannya. Header jawaban `x-sb-edge-region` harus sama dengan kode region di
  alamat.
- **Opsional:** Script Property `SUPABASE_API` di Apps Script boleh diberi akhiran yang sama, supaya salinan ke
  Sheet (dari server Google) juga berjalan di samping database. Secret `ALAMAT_API` tidak perlu diubah: jadwal
  pg_cron sudah memanggil dari region database.
- **Jika region itu sedang gangguan:** permintaan tidak dialihkan otomatis ke region lain. Hapus
  `?forceFunctionRegion=...` dari `config.js` untuk sementara.
- **Pindah project ke region lain** tidak bisa dilakukan di tempat; harus membuat project baru dan memindahkan
  data (lihat dokumentasi Supabase "Change Project Region").

## Cadangan dan pemulihan

Cadangan mingguan berupa satu berkas JSON berisi semua tab, disalin ke Drive di `Laporan Kitchen/Cadangan`
(empat terbaru disimpan). Yang **tidak** ada di cadangan: Script Properties di Supabase (kunci PIN, sesi
login, langganan notifikasi HP) dan isi berkas PDF/foto (salinannya sudah ada di Drive). Ketiga fungsi di bawah
dijalankan dari editor Apps Script (pilih nama fungsi → **Run**), dan hasilnya dibaca di log eksekusi.

- **Periksa cadangan** (`periksaCadangan`, tidak mengubah apa pun): membaca cadangan terbaru dari Drive dan
  menulis jumlah baris tiap tab dibanding Sheet sekarang, lalu "Cadangan bisa dibaca dan dipulihkan".
- **Uji pemulihan sebulan sekali** (`ujiPemulihanCadangan`, pada jam sepi, sekitar 1–3 menit): aplikasi ditutup
  sebentar (isian dari HP menunggu di antrean HP), isi sekarang dicadangkan sebagai
  "Cadangan sebelum pemulihan …", berkas itu dibaca lagi dari Drive dan dipulihkan, lalu jumlah baris tiap tab
  dicocokkan. Tidak ada isian yang hilang. Berhasil jika log menulis "Uji pemulihan berhasil".
- **Memulihkan** (misalnya data terhapus atau rusak):
  1. Jalankan `periksaCadangan`. Log mendaftar semua cadangan di Drive; pilih yang akan dipulihkan.
  2. Project Settings → Script Properties → tambahkan `PULIHKAN_CADANGAN` berisi nama berkasnya persis
     (misalnya `Cadangan InventoryKu 2026-10-18 0300`). Jalankan `periksaCadangan` lagi untuk memeriksa berkas itu.
  3. Jalankan `pulihkanCadangan`. **Semua isian sesudah cadangan itu dibuat hilang**; isi sebelum pemulihan
     disimpan sebagai "Cadangan sebelum pemulihan …" (namanya ditulis di log). PIN, sesi, dan notifikasi tetap.
  4. Untuk membatalkan: pulihkan berkas "Cadangan sebelum pemulihan …" dengan cara yang sama.
  5. Buka Pengaturan → Hari libur di aplikasi: hari libur yang ditandai sesudah cadangan itu dibuat (misalnya
     Lebaran yang akan datang) ikut hilang dan perlu ditandai lagi.
  - Selama pemulihan, aplikasi di HP menulis "Server sedang dipulihkan…" dan isian masuk antrean HP. Peringatan
    "Laporan harian belum terkirim" bisa tampil sampai laporan harian berikutnya.
  - Jika pemulihan berhenti di tengah (misalnya waktu habis), aplikasi **tetap ditutup** supaya tidak ada isian
    yang masuk ke data yang belum lengkap. Jalankan lagi fungsi yang sama sampai berhasil.
- **Jika project Supabase hilang:** buat project baru (langkah 1–5), lalu di Apps Script ganti Script Property
  `SUPABASE_API` dengan alamat function baru (dan `RAHASIA_SINKRON` jika secret-nya berbeda), isi
  `PULIHKAN_CADANGAN`, dan jalankan `pulihkanCadangan`. Ganti `config.js` dengan alamat baru (langkah 9).
  Karena kunci PIN tidak ada di cadangan, semua PIN lama tidak berlaku: jalankan `buatKodePemasangan`, masuk
  lewat "Pulihkan akses Pengelola" di layar Login, lalu reset PIN staff lain dari Pengaturan → Staff dan PIN.
  Notifikasi HP perlu dinyalakan lagi dari tiap HP. Tautan foto waste di Riwayat tidak terbuka; fotonya tetap
  ada di Drive (`Laporan Kitchen/<Outlet>/Foto waste`).

## Kembali ke Apps Script (jika perlu)

Sheet berisi salinan lengkap (paling lambat 5 menit). Untuk kembali: tunggu satu salinan 5 menit,
hapus Script Property `SUDAH_PINDAH`, jalankan `pasangTrigger` di editor (trigger laporan Apps Script
dipasang lagi dan salinan 5 menit berhenti), matikan jadwal Supabase di SQL Editor
(`select cron.unschedule(jobname) from cron.job where jobname like 'inventoryku-%';`), lalu kembalikan
`config.js` ke alamat Web App Apps Script.
Untuk pindah lagi sesudahnya, isi Script Property `TIMPA_SUPABASE` dengan `ya`, lalu jalankan
`pindahKeSupabase` (isi Supabase ditimpa isi Sheet).
