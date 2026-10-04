# CLAUDE.md — InventoryKu

Baca file ini lebih dulu di setiap sesi.

## Ringkasan proyek

InventoryKu adalah aplikasi web (PWA) pengganti 4 form operasional kitchen berbahan kertas:
Stock Inventory Harian, Pengecekan Suhu Chiller & Freezer, Prep List, dan Pencatatan Waste,
ditambah form kustom buatan Pengelola. Skala: 1 outlet, 4 staff, dua role (Staff dan
Pengelola). Frontend statis ditayangkan dari GitHub Pages; backend berupa Apps Script yang
menempel pada Google Sheet dan dideploy sebagai Web App (API `doPost`). Data tersimpan di
Google Sheets, laporan PDF di Google Drive, laporan harian dikirim lewat Gmail.
Sumber kebenaran ada di folder `spesifikasi/`. Jika kedua file berbeda soal fungsi, file
sistem yang berlaku. Hal yang tidak diatur: pilih yang paling sederhana dan catat di bagian
"Keputusan tambahan" di bawah. Jangan menambah fitur di luar spesifikasi.

## Susunan folder

```
/                      frontend (ditayangkan GitHub Pages dari akar repo)
├── index.html
├── app.css
├── app.js
├── config.js          satu baris: alamat API (URL Web App)
├── .nojekyll          kosong; mencegah GitHub Pages memproses repo dengan Jekyll
├── fonts/             Barlow 400/500/600 dan Barlow Condensed 600 (woff2, subset latin) + lisensi OFL
├── apps-script/
│   └── Code.gs        SELURUH kode backend (ditempel tangan ke editor Apps Script)
├── spesifikasi/
│   ├── spesifikasi_web_inventory_harian_v2.md   sistem: data, role, alur, arsitektur
│   └── spesifikasi_tampilan_ui.md               tampilan: warna, huruf, tata letak, layar, teks
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
- Gerak mengikuti Bagian 8 spesifikasi tampilan: hanya CSS, hanya transform dan opacity, dan mati saat perangkat diatur "kurangi gerak". Grafik digambar dengan SVG. Tanpa library animasi dan tanpa library grafik.
- Huruf Barlow dan Barlow Condensed disimpan di repo (folder fonts/), bukan dari CDN. Ambil file woff2 dari paket npm @fontsource/barlow dan @fontsource/barlow-condensed. Jika tidak bisa diunduh, pakai huruf sistem dan catat di CLAUDE.md.
- Jangan membuat file di .github/workflows.
- Uji frontend dengan API tiruan sebelum selesai. Kamu tidak bisa menguji sambungan ke akun Google saya; itu saya uji sendiri dari HP.

## Kesepakatan API (berlaku untuk semua aksi)

- Permintaan: `POST` ke `API_URL`, body `JSON.stringify({ action: '<nama>', ...isi })`,
  header hanya `Content-Type: text/plain;charset=utf-8`. Mulai Tahap 1 token sesi ikut di body.
- Jawaban selalu JSON:
  - berhasil: `{ "ok": true, "data": { ... } }`
  - gagal: `{ "ok": false, "pesan": "Pesan berbahasa Indonesia yang siap ditampilkan." }`
- Di Code.gs, aksi didaftarkan di objek `AKSI_`. Kesalahan yang boleh dilihat pengguna dilempar
  dengan `galatPengguna_(pesan)`; kesalahan lain dicatat di log dan dibalas pesan umum.
- Di frontend, semua panggilan lewat `panggilApi(aksi, isi)` di `app.js`, yang mengembalikan
  `data` atau melempar `Error` berpesan bahasa Indonesia.
- Aksi yang ada: `ping` → `{ namaSpreadsheet, waktuServer }` (waktu ISO UTC). Tanpa token.

## Tahap dan status

| Tahap | Isi | Status |
|---|---|---|
| 0 | Fondasi: spesifikasi dipindah, CLAUDE.md, halaman uji sambungan, `doPost`/`doGet`/`ping`, `setupSpreadsheet` | Kode selesai (Code.gs v0.1). Menunggu pemilik: jalankan setupSpreadsheet, deploy, isi config.js, uji dari HP |
| 1 | Kerangka PWA dan akses (manifest, service worker, pemasangan pertama, login PIN, sesi, Ganti pengguna, Lupa PIN, role, zona waktu, Pengaturan → Staff dan Penerima Email, pola tata letak dan gerak) | Belum |
| 2 | Form Stock Inventory Harian (termasuk rumus `Harian_Stock` dan blok Stock di tab Dashboard) | Belum |
| 3 | Riwayat, pemeriksaan, dan koreksi | Belum |
| 4 | Laporan PDF dan email harian, cadangan mingguan | Belum |
| 5 | Form Waste dan Suhu | Belum |
| 6 | Prep List dan resep | Belum |
| 7 | Dashboard di aplikasi dan pengelolaan master | Belum |
| 8 | Stock opname dan daftar belanja | Belum |
| 9 | Form kustom | Belum |
| 10 | Rekap bulanan | Belum |
| 11 | Opsional: foto bukti waste, arsip tahunan, outlet tambahan | Belum |

## Keputusan tambahan

Hal yang tidak diatur spesifikasi, dipilih yang paling sederhana:

1. **Nama file spesifikasi.** File unggahan bernama `... (4).md`; saat dipindah ke `spesifikasi/`
   akhiran ` (4)` dibuang supaya sesuai nama yang dirujuk di dalam spesifikasi.
2. **Huruf.** Hanya subset `latin` dan bobot yang dipakai spesifikasi tampilan Bagian 3:
   Barlow 400, 500, 600 dan Barlow Condensed 600 (dari @fontsource 5.3.0). Subset latin sudah
   memuat °, −, dan …. Lisensi OFL disimpan di `fonts/`.
3. **Halaman Tahap 0** hanya berisi kepala navy (ikon buku + nama aplikasi) dan satu kartu
   "Sambungan ke server" dengan tombol "Uji sambungan". Saat memproses, tombol nonaktif,
   bertuliskan "Menguji…", dan menampilkan indikator putar. Hasil tampil sebagai tanda status
   "Tersambung" (Baik) atau "Gagal tersambung" (Masalah) beserta rinciannya. Halaman ini
   diganti di Tahap 1.
4. **Favicon** berupa SVG ikon buku yang ditanam langsung di `index.html` (data URI), supaya
   browser tidak meminta `/favicon.ico` yang tidak ada. Ikon PWA (192/512/180 px) dibuat di Tahap 1.
5. **Batas waktu panggilan API** 30 detik di frontend.
6. **Isi config.js** adalah `const API_URL = '...';` (satu baris).
7. **Format di spreadsheet:** tanggal `yyyy-mm-dd`, waktu `yyyy-mm-dd hh:mm:ss`, angka
   `#,##0.00`, suhu `0.0`, rupiah `"Rp "#,##0`, kolom teks berformat teks biasa (`@`).
   Pemisah desimal di Sheet mengikuti setelan lokal spreadsheet.
8. **Warna tab** (amber tidak dipakai di spreadsheet): Dashboard Navy Pass `#0B1F3A`, Harian
   Biru Malam `#16335C`, Data dan `Stock_Harian` Rel Padam `#5A6F8F`, Master Teks di Navy
   `#A9B8CF`, `Log_Perubahan` Garis `#C5CEDA`.
9. **Proteksi:** tab Data, `Stock_Harian`, `Log_Perubahan`, Harian, Dashboard, `M_Staff`, dan
   `M_Konfigurasi` hanya bisa diubah pemilik (script berjalan sebagai pemilik). Sel pemilih
   di tab Harian (tanggal, kategori) dan Dashboard (periode) dibiarkan bisa diubah. Tab
   master lain diberi proteksi peringatan saja, karena di Tahap 0 master awal diisi langsung
   di Sheet.
10. **Kolom tambahan di tab Data** yang dibutuhkan alur di spesifikasi tetapi tidak ditulis
    sebagai field form:
    - `Data_Stock`: `Masuk Diketik` (angka asli dalam satuan besar, misalnya "2 dus").
    - `Data_Prep`: `Hasil per 1 Resep`; `Data_PrepBahan`: `Jumlah Resep`, `Qty per 1 Resep`,
      `Qty Terpakai`, dan kolom sistem `prep_row_id` (penghubung ke baris `Data_Prep`).
      Keduanya perlu agar koreksi Jumlah Resep memakai resep yang tercatat saat prep dibuat.
    - `Data_Penyesuaian` dan `Data_Opname`: `Kategori` dan `Satuan` (untuk urutan tanggal →
      kategori → item dan keterbacaan).
    - `Data_Nihil`: `Tanggal`, `ID Form`, `Nama Form`; "siapa" dan "kapan" memakai kolom
      sistem `submitted_by` dan `timestamp_server`.
    - Semua tab `Data_*` memakai 13 kolom sistem Bagian 5.0 yang sama. `Stock_Harian` hanya
      memakai `outlet` dan `timestamp_server`.
    - Kolom `Nama Staff` di Suhu, Prep, dan Waste tetap ada di sisi form (sesuai daftar field),
      walau isinya sama dengan `submitted_by`.
11. **M_Konfigurasi** berbentuk tabel `Kunci | Nilai | Keterangan`; kolom Nilai berformat teks.
    Kunci: `kode_pemasangan`, `zona_waktu` (kosong sampai terdeteksi), `jam_closing` 21:30,
    `jeda_laporan_menit` 45, `suhu_chiller_min` 1, `suhu_chiller_maks` 5, `suhu_freezer_maks`
    -18, `jadwal_opname` mingguan, `hari_cadangan` Minggu (spesifikasi tidak menyebut harinya).
12. **Kode Pemasangan:** 8 karakter dari `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (tanpa 0/O/1/I/L),
    sumber acak `Utilities.getUuid()` di-hash SHA-256. Dibuat hanya jika baris
    `kode_pemasangan` belum ada; menjalankan ulang setupSpreadsheet tidak membuat kode baru.
    Kode baru untuk pemulihan dibuat oleh `buatKodePemasangan` (Tahap 1).
13. **Form bawaan di M_Form:** ID `STOCK`, `SUHU`, `PREP`, `WASTE`; nama mengikuti tiket di
    spesifikasi tampilan: "Stock", "Suhu", "Prep list", "Waste"; jenis `bawaan`, jadwal
    `harian`, urutan 1–4, aktif.
14. **M_Outlet** satu baris, email penerima dipisah koma dalam satu sel. Nama outlet diisi lewat
    layar pemasangan (Tahap 1), jadi `setupSpreadsheet` tidak mengisinya.
15. **Tab Harian dan Dashboard di Tahap 0** baru berisi tata letak: judul, kotak info
    (`Nama Outlet` B3, pemilih tanggal B4 — kosong berarti hari ini, tanggal tampil B5,
    pemilih kategori B6 khusus `Harian_Stock`), judul tabel navy di baris 8, dan tulisan
    "Belum ada data."; Dashboard berisi pemilih periode (B3) dan judul tiap blok. Rumus isinya
    dipasang di tahap formnya masing-masing (Stock di Tahap 2, dst.), karena belum bisa diuji
    tanpa data. Tata letak hanya ditulis saat tab masih kosong.
16. **Menjalankan ulang setupSpreadsheet:** tab yang hilang dibuat; judul kolom yang hilang
    ditambahkan di kanan; format dan dropdown dipasang ulang (tidak mengubah isi sel);
    proteksi, filter, dan pelipatan kolom sistem hanya dipasang jika belum ada; baris awal
    hanya ditambahkan jika kuncinya belum ada; urutan tab dirapikan. Lembar bawaan
    "Sheet1"/"Lembar1" dihapus hanya jika benar-benar kosong.
17. **Aturan "tanggal terbaru di atas" dan warna berselang per hari** di tab Data dipasang
    oleh kode penulis data di tahap formnya (mulai Tahap 2), bukan oleh setupSpreadsheet.
