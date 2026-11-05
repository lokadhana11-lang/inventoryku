# CLAUDE.md — InventoryKu

Baca file ini lebih dulu di setiap sesi.

## Ringkasan proyek

InventoryKu adalah aplikasi web (PWA) pengganti 4 form operasional kitchen berbahan kertas:
Stock Inventory Harian, Pengecekan Suhu Chiller & Freezer, Prep List, dan Pencatatan Waste,
ditambah form kustom buatan Pengelola. Skala: 1 outlet, 4 staff, dua role (Staff dan
Pengelola). Frontend statis ditayangkan dari GitHub Pages; backend berupa Apps Script yang
menempel pada Google Sheet dan dideploy sebagai Web App (API `doPost`). Data tersimpan di
Google Sheets, laporan PDF di Google Drive, laporan harian dikirim lewat Gmail.
Sejak 15 Oktober 2026 (keputusan pemilik, butir 203) backend yang sama berjalan di **Supabase**:
Edge Function `api` menjalankan Code.gs di atas Postgres, Storage, Brevo, dan pg_cron; Google
Sheets menjadi salinan yang diperbarui Apps Script tiap 5 menit dan hanya untuk dicek.
Sumber kebenaran ada di folder `spesifikasi/`. Jika kedua file berbeda soal fungsi, file
sistem yang berlaku. Hal yang tidak diatur: pilih yang paling sederhana dan catat di bagian
"Keputusan tambahan" di bawah. Jangan menambah fitur di luar spesifikasi.

## Susunan folder

```
/                      frontend (ditayangkan GitHub Pages dari akar repo)
├── index.html
├── app.css            gaya bersama: token warna, tiga susunan lebar layar, komponen, gerak
├── app.js             seluruh frontend: API, penyimpanan per pengguna, komponen, router, layar
├── sw.js              service worker (cache halaman aplikasi; versi = VERSI_APLIKASI di app.js)
├── manifest.webmanifest
├── config.js          satu baris: alamat API (Edge Function Supabase; dulu URL Web App)
├── .nojekyll          kosong; mencegah GitHub Pages memproses repo dengan Jekyll
├── icons/             ikon PWA: ikon-192/512 (any), ikon-maskable-192/512, ikon-180 (iPhone), ikon.svg (sumber)
├── fonts/             Barlow 400/500/600 dan Barlow Condensed 600 (woff2, subset latin) + lisensi OFL
├── apps-script/
│   └── Code.gs        SELURUH logika backend (ditempel tangan ke editor Apps Script; dijalankan juga oleh Supabase)
├── supabase/
│   ├── skema.sql      tabel Postgres (skema inventoryku), bucket arsip, pg_cron/pg_net; ditempel di SQL Editor
│   ├── src/           runtime Edge Function: sheet.js (tiruan SpreadsheetApp), layanan.js (Drive, Mail, Properties,
│   │                  Utilities, ScriptApp), penyimpanan.js, runtime.js, pdf.js (HTML laporan → PDF), sinkron.js
│   │                  (impor, salinan ke Sheets, berkas, email), adaptor.js (Storage, Brevo, pg_cron), push.js
│   │                  (notifikasi Web Push: kunci VAPID, enkripsi aes128gcm), server.js (HTTP)
│   ├── rakit.mjs      node supabase/rakit.mjs → functions/api/index.ts (src + Code.gs dalam satu file)
│   ├── functions/api/index.ts   HASIL RAKITAN, ditempel tangan ke editor Edge Function; jangan diubah langsung
│   └── PANDUAN.md     langkah pemilik untuk pindah
├── uji/               uji otomatis: node uji/jalankan.mjs [--layar] (lihat uji/README.md)
│   ├── alat/          jam.mjs (jam uji tetap 20 Oktober 2026), harness.mjs (Code.gs di atas Spreadsheet tiruan supabase/src),
│   │                  seed.mjs, peramban.mjs
│   ├── server/        uji aksi Code.gs, satu berkas per fitur
│   └── layar/         uji alur aplikasi di Chromium (Playwright) dengan API tiruan
├── spesifikasi/
│   ├── spesifikasi_web_inventory_harian_v2.md   sistem: data, role, alur, arsitektur
│   └── spesifikasi_tampilan_ui.md               tampilan: warna, huruf, tata letak, layar, teks
├── catatan/           catatan kerja yang dipindah dari CLAUDE.md (29 Oktober 2026), dibaca saat perlu:
│   ├── api.md         daftar semua aksi API dan field-nya, per tahap
│   ├── status.md      tabel tahap dan status lengkap, satu baris per rilis
│   └── keputusan.md   Keputusan tambahan lengkap, butir 1 dan seterusnya (nomor dirujuk dari kode dan spesifikasi)
├── CLAUDE.md
└── README.md
```

## ATURAN TETAP

- Frontend: HTML, CSS, dan JavaScript murni. Tanpa framework dan tanpa langkah build. Harus jalan langsung dari GitHub Pages pada alamat https://NAMAUSER.github.io/NAMAREPO/, jadi semua path relatif (./) dan tidak ada path yang diawali garis miring.
- Backend: seluruh kode Apps Script berada dalam SATU file, apps-script/Code.gs, karena saya menempelkannya dengan tangan ke editor Apps Script. Baris pertama file itu adalah komentar versi, misalnya: // InventoryKu Code.gs v0.1 (Tahap 0). Naikkan versinya setiap kali file ini berubah.
- Script menempel pada Google Sheet (container-bound). Saat berjalan sebagai Web App, getActiveSpreadsheet() tidak tersedia. Karena itu semua kode membuka spreadsheet dengan openById memakai ID yang disimpan setupSpreadsheet() di Script Properties.
- Panggilan API dari frontend: fetch POST ke alamat di config.js, body berupa JSON.stringify, satu-satunya header adalah Content-Type: text/plain;charset=utf-8. Tanpa header lain. Token sesi dikirim di dalam body. Alasannya: Apps Script tidak melayani preflight CORS.
- Repo ini public. Jangan pernah menulis PIN, kata sandi, alamat email, atau ID spreadsheet ke dalam repo.
- Semua teks antarmuka berbahasa Indonesia dan mengikuti Bagian 7 spesifikasi tampilan.
- Tata letak mengikuti Bagian 4.6 spesifikasi tampilan: aplikasi yang sama untuk HP, tablet, laptop, dan desktop, dan halaman tidak pernah bergulir ke samping.
- Gerak mengikuti Bagian 8 spesifikasi tampilan. Sejak 17 Oktober 2026 (keputusan pemilik, butir 243) gerak tidak lagi dibatasi CSS, transform, dan opacity: JavaScript, View Transitions, library animasi, dan library grafik boleh dipakai. Library disimpan di repo (seperti huruf di fonts/), bukan dari CDN, supaya aplikasi tetap jalan tanpa sinyal dan tanpa langkah build. Gerak tetap mati saat perangkat diatur "kurangi gerak" (setelan aksesibilitas di HP pengguna).
- Huruf Barlow dan Barlow Condensed disimpan di repo (folder fonts/), bukan dari CDN. Ambil file woff2 dari paket npm @fontsource/barlow dan @fontsource/barlow-condensed. Jika tidak bisa diunduh, pakai huruf sistem dan catat di CLAUDE.md.
- Jangan membuat file di .github/workflows.
- Uji frontend dengan API tiruan sebelum selesai. Kamu tidak bisa menguji sambungan ke akun Google saya; itu saya uji sendiri dari HP.

## Kesepakatan API (berlaku untuk semua aksi)

- Permintaan: `POST` ke `API_URL`, body `JSON.stringify({ action: '<nama>', token, ...isi })`,
  header hanya `Content-Type: text/plain;charset=utf-8`. Token sesi ikut di body.
- Jawaban selalu JSON:
  - berhasil: `{ "ok": true, "data": { ... } }`
  - gagal: `{ "ok": false, "pesan": "Pesan berbahasa Indonesia yang siap ditampilkan." }`,
    ditambah `"sesiBerakhir": true` jika token tidak sah lagi (frontend kembali ke Login).
- Di Code.gs, aksi didaftarkan di objek `AKSI_` sebagai `{ jalankan(body, pengguna), tanpaToken?,
  pengelola? }`. `doPost` memeriksa token (dan role, untuk `pengelola: true`) sebelum
  `jalankan`. Kesalahan yang boleh dilihat pengguna dilempar dengan `galatPengguna_(pesan)`;
  kesalahan lain dicatat di log dan dibalas pesan umum. Penulisan memakai `denganKunci_`.
- Di frontend, semua panggilan lewat `panggilApi(aksi, isi)` di `app.js`, yang menambahkan token,
  mengembalikan `data`, atau melempar `Error` berpesan bahasa Indonesia (`err.sesiBerakhir`).
- Kiriman berisi `submissionId` yang dibuat di HP. Kiriman dengan `submissionId` yang sudah pernah
  masuk tidak ditulis lagi dan dijawab berhasil dengan `sudahTerkirim: true`, supaya antrean yang
  mengirim ulang menganggapnya selesai.
- Daftar semua aksi dan field-nya ada di `catatan/api.md`. Baca bagian yang menyangkut fitur yang sedang dikerjakan, dan tambahkan
  aksi atau field baru di sana.

## Cara kerja setiap perubahan

1. **Versi.** Code.gs: komentar baris 1 dan `VERSI_KODE` naik bersama. Aplikasi: `VERSI_APLIKASI` di `app.js` dan `VERSI` di
   `sw.js` selalu sama (pola `0.<n>.<perbaikan>`, butir 18). Versi aplikasi tampil di Login.
2. **Supabase.** Setiap Code.gs atau `supabase/src` berubah: `node supabase/rakit.mjs`, lalu commit `supabase/functions/api/index.ts`
   bersama perubahannya (butir 210). Code.gs berjalan di Supabase dengan `DI_SUPABASE_` true (butir 204). Tab master selalu dimuat;
   tab lain dimuat saat diminta, jadi galat `err.tabBelumDimuat` tidak boleh ditelan oleh `catch` (butir 205, 375).
3. **Tab dan kolom baru** dibuat `setupSpreadsheet` (tab baru, kolom baru di kanan, butir 16). Selama belum dijalankan, kode memeriksa
   keberadaannya (`…Siap_()`, `kolomAda_`) dan fitur baru ditolak dengan petunjuk, sedangkan fitur lama tetap jalan (butir 296). Aplikasi
   tidak menampilkan fitur yang field-nya tidak dikirim server lama.
4. **Jadwal baru** (fungsi trigger): daftarkan di `FUNGSI_JADWAL` `supabase/src/server.js` (dan pola `JADWAL_RINGAN` jika cukup tab master);
   pemilik menjalankan `pasangTrigger` sekali.
5. **Uji.** `node uji/jalankan.mjs --layar` sebelum PR (4 berkas sekaligus, sekitar 13 menit; butir 472), dan tambahkan berkas uji fitur baru di `uji/server` dan/atau `uji/layar` (lihat
   `uji/README.md`). Layar diuji pada delapan ukuran Bagian 4.6 (320×568, 360×740, 390×844, 430×932, 768×1024, 1024×768, 1366×768,
   1920×1080) dan dengan "kurangi gerak".
6. **Dokumen.** Spesifikasi sistem dan tampilan diberi catatan "Diperbarui/Tambahan <tanggal>" di kepalanya dan diubah di bagian yang
   menyangkut; aksi baru di `catatan/api.md`; satu baris di `catatan/status.md`; butir baru di `catatan/keputusan.md` (nomor
   melanjutkan butir terakhir); bagian "Status sekarang" di bawah diperbarui.
7. **PR** ditulis dalam bahasa Indonesia dengan langkah pemilik: tempel `supabase/functions/api/index.ts` ke Edge Function
   `rapid-action` lalu Deploy, tempel Code.gs ke Apps Script, jalankan `setupSpreadsheet` atau `pasangTrigger` jika perlu, gabungkan
   PR. Urutannya Edge Function dulu, karena `setupSpreadsheet` menolak jika versi Supabase berbeda (butir 348). Sambungan ke Google
   dan Supabase asli diuji pemilik dari HP.

## Status sekarang

- **Versi terakhir:** aplikasi 0.52.0 (satu penanda menu aktif di bar atas laptop, telaah desain butir 9; butir 470–471; Code.gs
  tidak berubah), digabung lewat PR #79 dan tayang (5 November 2026). Sesudahnya: uji dijalankan 4 berkas sekaligus (butir 472,
  PR #80), lalu aplikasi 0.52.1 (perapian `app.css` tanpa perubahan tampilan, butir 473), menunggu digabung. Sebelumnya aplikasi 0.51.0 (filter Riwayat ringkas, butir 467–469, PR #78), 0.50.0 (pintasan Dashboard, butir 464–466, PR #77),
  0.49.0 (Pengaturan berkelompok
  dan Laporan dua kolom, butir 461–463, PR #76), 0.48.0 (susunan tiket Beranda, butir 459–460, PR #75), 0.47.0 (pemberitahuan Beranda dalam satu daftar "Perlu ditindaklanjuti",
  butir 456–458, PR #74, 5 November 2026) dan 0.46.0 (tata letak ringkas dari telaah desain butir
  1–3: kepala navy ringkas, satu garis kiri, bar bawah hanya di layar menu, kotak info ringkas; butir 451–455) dan 0.45.1 (jarak
  kartu Saran prep, butir 450), digabung lewat PR #73 dan tayang (4 November 2026). Code.gs v0.44,
  aplikasi 0.45.0 (saran prep, 4 November 2026, butir 444–448), digabung lewat PR #71 dan terpasang (4 November 2026: Edge Function
  `rapid-action` dan Apps Script v0.44; kartu "Versi dan salinan" menunjukkan v0.44). Sebelumnya Code.gs v0.43, aplikasi 0.44.0 (cukup untuk
  berapa hari dan hampir habis, butir 437–443), digabung lewat PR #70 dan terpasang (4 November 2026; kartu "Versi dan salinan"
  menunjukkan v0.43). Sebelumnya Code.gs v0.42 dan aplikasi 0.43.0 (pemantauan, butir 428–436, PR #69, terpasang dengan
  `setupSpreadsheet`). Kartu "Versi dan salinan" di Pengaturan → Outlet dan jadwal adalah cara memeriksa apa yang terpasang. Riwayat
  tiap rilis: `catatan/status.md`.
- **Terpasang:** backend di Supabase sejak 16 Oktober 2026 (butir 203–213): Edge Function bernama `rapid-action`, database di
  Sydney (`config.js` memakai `?forceFunctionRegion=ap-southeast-2`, butir 274), email lewat Gmail pemilik oleh Apps Script (tanpa
  Brevo), salinan ke Google Sheets tiap 5 menit (Sheets hanya untuk dicek; ketikan langsung tertimpa), jadwal pg_cron.
- **Fitur yang ada:** form Stock (Semua kategori, cari, Hitung sisa, pemasok dan harga beli, masa simpan barang masuk, pesanan, cukup
  untuk berapa hari), Suhu,
  Prep List (resep dengan catatan, hasil aktual, pesan stock hasil prep, saran prep), Waste (foto, waste per porsi menu), form kustom; Riwayat (koreksi, Betulkan 15 menit untuk Staff,
  Tandai diperiksa sekaligus, kartu stok); laporan PDF, email harian, rekap bulanan, daftar belanja per pemasok (dengan Tambah item dan kelompok Pemasok lain); Dashboard (nilai
  stock, Perlu perhatian Hari ini/Rutin termasuk hampir habis, stock opname, HPP dan food cost, penjualan per menu); Pengaturan (staff, item termasuk ubah
  banyak dan riwayat harga, resep, menu, unit, kategori dan satuan, pemasok, form dengan urutan diseret, hari libur, outlet dan jadwal; dua panel di desktop); notifikasi ke HP;
  arsip tahunan; cadangan dan pemulihan; keamanan login; pemantauan pemasangan (salinan Apps Script, versi Code.gs, email tertahan,
  susunan Sheet; kartu "Versi dan salinan" di Outlet dan jadwal).
- **Belum dibangun atau sengaja berbeda** (dari butir 150): outlet tambahan (Tahap 11, opsional; pemilik memutuskan tidak dikerjakan,
  butir 449); PDF stock semua kategori satu halaman per kategori hanya jika `ujiPemisahHalamanPdf` berhasil (di Supabase
  selalu berhalaman); menu Laporan punya tiga tombol utama; rekap bulanan memakai unit dan jadwal form sekarang. Hasil rumus dan grafik
  di Google Sheets tidak bisa diuji di sini.
- **Telaah aplikasi 19 Oktober 2026:** semua butir yang dipilih pemilik sudah dibangun (terakhir: simpan uji di repo, ringkas CLAUDE.md).
- **Telaah desain 4 November 2026:** sembilan temuan; pemilik memilih butir 1–3 (kotak info form ringkas, bar bawah tidak tampil di
  layar isian dan layar dalam, kepala navy ringkas dengan satu garis kiri), dibangun di aplikasi 0.46.0, lalu butir 4 (pemberitahuan
  Beranda sebagai satu daftar) di 0.47.0, lalu butir 5 (tiket tanpa satu tiket sendirian di baris terakhir) di 0.48.0, lalu butir 6
  (Pengaturan berkelompok, Laporan dua kolom) di 0.49.0, lalu butir 7 (ubin ke Daftar belanja, kartu tautan) di 0.50.0, lalu butir 8
  (filter Riwayat ringkas) di 0.51.0, lalu butir 9 (satu penanda menu aktif) di 0.52.0. Semua butir telaah desain sudah dibangun.
- **Telaah aplikasi 5 November 2026:** semua PR digabung, 0.52.0 tayang, produksi 24 jam tanpa galat. Lima usul: (1) uji paralel,
  dikerjakan (butir 472); (2) satukan blok tambahan di akhir `app.css`; (3) kotak info Stock opname tiga kolom; (4) tombol tabel HPP
  per menu 44 px; (5) hapus 25 cabang lama yang sudah tergabung. Butir 2 dikerjakan (butir 473); butir 3–5 belum dipilih.
- **Telaah aplikasi 2 November 2026:** uji yang gagal karena tanggal diperbaiki dengan jam uji tetap (butir 424–427; Code.gs dan aplikasi
  tidak berubah). Uji baru tidak menulis nama bulan atau tanggal tetap (uji/README.md). Telaah kedua hari itu (semua PR sudah digabung,
  v0.41 terpasang): pemilik memilih pemantauan dulu (butir 428–436), lalu cukup untuk berapa hari (butir 437–443), lalu saran prep
  (butir 444–448). Tiga saran lain (tempel porsi terjual dari laporan kasir, foto nota di Tambah masuk, outlet tambahan) diputuskan
  pemilik tidak dikerjakan (4 November 2026, butir 449); jangan ditawarkan lagi kecuali pemilik memintanya.

## Keputusan tambahan

Hal yang tidak diatur spesifikasi, dipilih yang paling sederhana. Daftar lengkapnya (butir 1 dan seterusnya, dengan alasan dan ujinya)
ada di `catatan/keputusan.md`; butir baru ditulis di sana. Yang paling sering dibutuhkan:

- **Angka isian:** koma dan titik sama-sama desimal, titik bukan ribuan, minus ditolak, paling banyak 3 angka di belakang koma (butir
  35). Harga beli dan rupiah: titik di antara kelompok tiga angka adalah ribuan (`bacaRupiah`, butir 289). Tempelan dari spreadsheet:
  `angkaTempel` (butir 368). Tampilan memakai format Indonesia dan tanda −.
- **Tanggal:** tanggal isian dari HP; aturan tanggal dan "hari ini" di server memakai zona waktu `M_Konfigurasi` (butir 25, 39).
- **Antrean dan kiriman:** galat sambungan memasukkan isian ke antrean HP, galat server tampil di layar (butir 42). Kiriman dari antrean
  tidak bisa diubah, jadi server lebih baik menerima dan melaporkan bagian yang tidak dicatat daripada menolak seluruh kiriman (butir
  327a, 338a).
- **Penyimpanan di HP:** localStorage per pengguna lewat `Draft`, `Antrean`, `Cache` (butir 29); foto di IndexedDB (butir 159); PIN tidak
  pernah disimpan di HP.
- **Pola app.js:** router `RUTE`, `muatData`, `tombol`/`aturTombolProses`, `bukaLembar`, `konfirmasi`, `toast`, `kolomIsian`,
  `grupPilihan`, `tandaStatus`, `kotakKosong` (butir 30); kepala navy dipasang router dari judul layar (butir 176), ringkas kecuali
  Beranda dan Dashboard, dengan satu garis kiri; bar bawah hanya di layar menu (`aturMenuBawah`); kotak info form dilipat di HP
  dengan `lipatKotakInfo` (butir 451–454); pemberitahuan Beranda lewat `barisTindak` (butir 456); aturan CSS baru ditulis di bagian
  komponennya, bukan di akhir `app.css`, dan perapian CSS dibuktikan dengan `uji/alat/potret_gaya.mjs` (butir 473); gerak, View Transitions, dan angka berhitung mati saat "kurangi gerak" (butir 186–189,
  243–245).
- **Riwayat dan koreksi:** definisi per form di `RIWAYAT_FORM` dan `defRiwayat_` (butir 48), koreksi dicatat di `Log_Perubahan` (butir 50,
  51), Staff membetulkan isiannya sendiri 15 menit sesudah dikirim (butir 359–363).
- **Stock:** semua gerakan dari `SUMBER_STOCK`, dihitung ulang `hitungUlangStock_` di dalam `denganKunci_` (butir 37); baris waste menu
  dilewati (butir 388).
- **Harga:** harga punya riwayat (`M_HargaItem`, `hargaPada_`, butir 164–168); barang jadi tanpa harga dinilai dari resepnya (butir 98,
  381); nominal rupiah waste hanya untuk Pengelola (butir 229).
- **Master tidak dihapus**, hanya dinonaktifkan, kecuali staff nonaktif (butir 76), item nonaktif tanpa catatan (butir 233), dan hari
  libur (butir 340). Item yang dinonaktifkan stock-nya dinolkan dengan penyesuaian dan tidak tampil di PDF Stock (butir 406–409).
- **Rumus Sheet** ditulis gaya en-US lalu diubah ke gaya file (butir 93); tanpa `XLOOKUP(1,(…)*(…))` dan tanpa nama LET yang hanya beda
  huruf besar/kecil (butir 120). Rumus tab Harian dan Dashboard hanya dipasang di Apps Script.
- **Teks antarmuka** mengikuti Bagian 7 spesifikasi tampilan; data contoh di uji tidak memakai nama, nomor, atau alamat sungguhan (butir 393).
- **Catatan nomor:** butir 118–121 dipakai dua kali (perbaikan Dashboard v0.8.1 dan Tahap 8); rujukan lama tetap.
