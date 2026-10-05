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
├── app.css            gaya bersama: token warna, tiga susunan lebar layar, komponen, gerak
├── app.js             seluruh frontend: API, penyimpanan per pengguna, komponen, router, layar
├── sw.js              service worker (cache halaman aplikasi; versi = VERSI_APLIKASI di app.js)
├── manifest.webmanifest
├── config.js          satu baris: alamat API (URL Web App)
├── .nojekyll          kosong; mencegah GitHub Pages memproses repo dengan Jekyll
├── icons/             ikon PWA: ikon-192/512 (any), ikon-maskable-192/512, ikon-180 (iPhone), ikon.svg (sumber)
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
- Aksi tanpa token: `ping` → `{ namaSpreadsheet, waktuServer }`; `infoLogin` → `{ perluPemasangan,
  namaOutlet, staff: [{ nama, pengelola, punyaPin }] }`; `login {nama, pin}`, `pasang {kode,
  namaOutlet, nama, role, pin, zonaWaktu}`, `pulihkan {kode, nama, pin}` → `{ token,
  berlakuSampai, pengguna: { nama, role, pengelola }, namaOutlet, keluarOtomatisMenit }`; `lupaPin {nama}` →
  `{ sudahAda, waktu }`; `keluar {token}` → `{}`.
- Aksi bertoken: `beranda {tanggal}` → `{ pengguna, namaOutlet, tanggal, form: [{ id, nama, jenis,
  wajib, status: belum|sebagian|terkirim|nihil, lengkap, detail, terakhir: { oleh, waktu } }],
  permintaanReset (khusus Pengelola): [{ nama, waktu }], keluarOtomatisMenit }`.
- Aksi khusus Pengelola: `daftarStaff` → `{ staff: [{ nama, role, pengelola, aktif, punyaPin,
  permintaanReset, terkunci }] }`; `tambahStaff {nama, role, pin}`, `ubahStaff {nama, role?,
  aktif?}` → `{ staff }`; `aturPin {nama, pin}` → `{ staff, sesiBaru? }`; `bacaPenerima` dan
  `simpanPenerima {email: []}` → `{ email: [] }`. Sejak 5 Oktober 2026: `hapusStaff {nama}` →
  `{ staff }`; `bacaOutletJadwal` dan `simpanOutletJadwal {keluarOtomatisMenit: 5|10|15|30}` →
  `{ keluarOtomatisMenit }`.
- Aksi Tahap 2 (bertoken): `formStock {tanggal}` → `{ tanggal, kategori: [nama], item: [{ nama,
  kategori, satuan, satuanBesar, isiSatuanBesar, stokMin, awal, masuk, keluar, hasilPrep,
  dipakaiPrep, waste, penyesuaian, akhir }], kiriman: { jumlah, terakhir }, nihil }`;
  `kirimStock {submissionId, tanggal, kategori, waktuPerangkat, baris: [{ item, masuk, keluar,
  satuanMasuk: dasar|besar }]}` → `{ sudahTerkirim, jumlah, form }`; `tandaiNihil {submissionId,
  formId, tanggal, waktuPerangkat}` → `{ formId, tanggal, nihil: { oleh, waktu } }`. Khusus
  Pengelola: `sesuaikanStock {submissionId, item, tanggal, stockSebenarnya, alasan, catatan}` →
  `{ sudahTerkirim, tercatat, selisih, form }`.
- Aksi Tahap 3 (bertoken, semua role): `riwayat {formId, dari, sampai, tampilan: catatan|rekap,
  kategori, item, pengisi, status: terkirim|diperiksa|dilaporkan|dikoreksi}` → `{ formId, dari,
  sampai, tampilan, daftarForm: [{ id, nama, adaRiwayat, stock }], kepala: [{ kunci, label }],
  kolom: [{ kunci, label, singkat, jenis, koreksi, satuan }], kiriman: [{ id, tanggal, oleh, waktu,
  waktuPerangkat, kepala, status, diperiksa, jumlahBaris, dilaporkan, dikoreksi, baris: [{ rowId,
  nilai, asli, koreksi: { kunci: { lama, oleh, waktu } }, satuan, status, diperiksa, flag, dikoreksi
  }] }], peristiwa: [{ jenis: nihil|penyesuaian|opname, tanggal, oleh, waktu, ... }], rekap: [{
  tanggal, kategori, item, satuan, awal, masuk, hasilPrep, keluar, dipakaiPrep, waste, penyesuaian,
  akhir, stokMin, masukAsli }] | null, pilihan: { kategori, item: [{ nama, kategori }], pengisi } }`;
  `detailKiriman {formId, submissionId}` → `{ formId, namaForm, kepala, kolom, kiriman }`;
  `riwayatItem {item}` → `{ item, hariIni, tercatat, rekap (7 terakhir, terbaru dulu) }`;
  `laporkanKeliru {formId, rowId, catatan}` → `{ kiriman }`. Khusus Pengelola: `tandaiDiperiksa` dan
  `bukaKunci {formId, submissionId}`, `koreksi {formId, rowId, nilai: { kunci: nilai }}`,
  `tutupLaporan {formId, rowId}` → `{ kiriman }`. `beranda` untuk Pengelola ditambah `pemeriksaan:
  { dari, sampai, belumDiperiksa, dilaporkan, formBelum, formDilaporkan }`; `sesuaikanStock`
  ditambah `riwayatItem`.
- Aksi Tahap 4 (bertoken): `infoLaporan` → `{ hariIni, form: [{ id, nama, adaPdf, kategori? }] }`
  (`kategori: [nama]` hanya pada form yang bisa diunduh per kategori, yaitu Stock); `unduhPdf
  {formId, tanggal, kategori?}` → `{ namaFile, mime, data (base64) }`. Khusus Pengelola: `simpanPdfDrive {formId,
  tanggal}` → `{ namaFile, lokasi }`. `beranda` menerima `alamatAplikasi` dan, untuk Pengelola,
  menjawab juga `peringatanSistem: [teks]`. `riwayat.daftarForm[]` dan `detailKiriman` ditambah
  `adaPdf`. Fungsi yang dijalankan dari editor atau trigger: `kirimLaporanHarian`, `buatCadangan`,
  `pasangTrigger`, `kirimLaporanSekarang`, dan (5 Oktober 2026) `ujiPemisahHalamanPdf`.
- Aksi Tahap 5 (bertoken): `formWaste {tanggal}` → `{ tanggal, kategoriWaste, shift, item: [{ nama, kategori, satuan,
  harga }], kiriman: { jumlah, terakhir, totalRp, baris: [{ item, kategori, qty, satuan, estimasi, oleh, waktu }] }, nihil }`;
  `kirimWaste {submissionId, tanggal, shift, waktuPerangkat, baris: [{ item, kategori, qty, alasan }]}` → `{ sudahTerkirim,
  jumlah, form }`; `formSuhu {tanggal}` → `{ tanggal, waktuCek, batas: { chillerMin, chillerMaks, freezerMaks }, unit: [{ nama,
  tipe }], isian: [{ unit, tipe, waktuCek, suhu, status, tindakan, oleh, waktu }] }`; `kirimSuhu {submissionId, tanggal,
  waktuCek, waktuPerangkat, baris: [{ unit, suhu, tindakan }]}` → `{ sudahTerkirim, jumlah, luarStandar, form }`.
  `riwayat` dan `detailKiriman` ditambah `gerakStock`; `riwayat.pilihan` ditambah `labelItem` (Item | Unit); `kolom[]` boleh
  berjenis `rupiah` dan `status` dan membawa `minus`, `akhiran`, `pilihan`, `ringkas`; `peristiwa[]` ditambah jenis
  `terlewat { tanggal, kurang: [teks], total }` (Suhu).
- Kiriman berisi `submissionId` yang dibuat di HP. Kiriman dengan `submissionId` yang sudah pernah
  masuk tidak ditulis lagi dan dijawab berhasil dengan `sudahTerkirim: true`, supaya antrean yang
  mengirim ulang menganggapnya selesai.

## Tahap dan status

| Tahap | Isi | Status |
|---|---|---|
| 0 | Fondasi: spesifikasi dipindah, CLAUDE.md, halaman uji sambungan, `doPost`/`doGet`/`ping`, `setupSpreadsheet` | Selesai (config.js sudah diisi pemilik). Halaman uji sambungan dihapus di Tahap 1; aksi `ping` tetap |
| 1 | Kerangka PWA dan akses (manifest, service worker, pemasangan pertama, login PIN, sesi, Ganti pengguna (kini Keluar), Lupa PIN, role, zona waktu, Pengaturan → Staff dan Penerima Email, pola tata letak dan gerak) | Kode selesai dan digabung (Code.gs v0.2, aplikasi 0.2.0) |
| 2 | Form Stock Inventory Harian (termasuk rumus `Harian_Stock` dan blok Stock di tab Dashboard) | Kode selesai (Code.gs v0.3, aplikasi 0.3.0), diuji dengan API tiruan. Rumus Sheet belum bisa diuji di sini |
| 3 | Riwayat, pemeriksaan, dan koreksi | Kode selesai dan digabung (Code.gs v0.4, aplikasi 0.4.0), diuji dengan API tiruan (Code.gs dijalankan di Node dengan tiruan SpreadsheetApp) |
| 4 | Laporan PDF dan email harian, cadangan mingguan | Kode selesai (Code.gs v0.5, aplikasi 0.5.0), diuji dengan API tiruan (Drive, Gmail, dan trigger tiruan; template PDF dirender di Chromium). Konversi PDF Google dan email asli belum bisa diuji di sini. Menunggu pemilik: tempel Code.gs, jalankan `kirimLaporanSekarang` (izin baru), `pasangTrigger`, deploy versi baru, uji dari HP |
| 4+ | Perubahan 5 Oktober 2026 (spesifikasi tampilan 1.6): tombol Keluar, keluar otomatis, Pengaturan → Outlet dan jadwal, hapus staff, PDF stock per kategori | Kode selesai (Code.gs v0.5.3, aplikasi 0.5.1), diuji dengan API tiruan dan Chromium. Pemisah halaman pada konversi PDF Google belum bisa diuji di sini (butir 77). Menunggu pemilik: tempel Code.gs, jalankan `setupSpreadsheet` dan `ujiPemisahHalamanPdf`, deploy versi baru, uji dari HP |
| 5 | Form Waste dan Suhu (layar isi, Data_Waste/Data_Suhu, waste mengurangi stock, Riwayat dan koreksi, PDF, email, tab Harian_Waste/Harian_Suhu, blok Waste dan Suhu di Dashboard) | Kode selesai (Code.gs v0.6, aplikasi 0.6.0), diuji dengan API tiruan dan Chromium. Rumus Sheet belum bisa diuji di sini. Foto bukti waste ditunda (butir 81). Menunggu pemilik: tempel Code.gs, jalankan `setupSpreadsheet`, deploy versi baru, uji dari HP |
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
17. **Aturan "tanggal terbaru di atas"** di tab Data dijalankan oleh kode penulis data setiap kali
    menulis (mulai Tahap 2). **Warna berselang per hari** (diubah di Tahap 2, lihat butir 44)
    berupa format bersyarat yang dipasang setupSpreadsheet.

### Tahap 1

18. **Versi aplikasi** ditulis di dua tempat yang nilainya harus sama: `VERSI_APLIKASI` di
    `app.js` (tampil di layar Login) dan `VERSI` di `sw.js` (nama cache `inventoryku-<versi>`).
    Naikkan keduanya di setiap rilis frontend. Pola nomor: `0.<tahap+1>.<perbaikan>`; Tahap 1 = 0.2.0.
19. **Service worker:** file aplikasi (halaman, CSS, JS, huruf, ikon, manifest) diambil dari cache
    lebih dulu; `config.js` dari jaringan lebih dulu (batas 4 detik) supaya alamat API bisa diganti
    tanpa rilis; navigasi selalu dijawab `index.html`. POST ke API tidak disentuh. Versi baru
    langsung aktif (`skipWaiting`) dan halaman dimuat ulang otomatis hanya jika tidak ada lembar
    atau kolom yang sedang diisi; jika ada, versi baru dipakai saat aplikasi dibuka lagi.
20. **Sesi** disimpan di Script Properties (`SESI_<hash token>`; token mentahnya tidak disimpan),
    berlaku 12 jam. Setiap aksi membaca ulang role dan status aktif dari `M_Staff`, jadi perubahan
    role dan penonaktifan langsung berlaku. Sesi gugur saat PIN orang itu direset atau akunnya
    dinonaktifkan. Pengelola yang mereset PIN-nya sendiri langsung mendapat sesi baru. Sesi dan
    kunci yang sudah habis dibersihkan setiap ada login.
21. **Hash PIN:** `h1$<garam>$<HMAC-SHA256(garam:pin)>`, dengan kunci rahasia `PIN_RAHASIA` yang
    dibuat sekali di Script Properties (bukan di Sheet). Jika Script Properties terhapus, semua
    PIN tidak berlaku: jalankan `buatKodePemasangan`, pakai "Pulihkan akses Pengelola", lalu reset
    PIN staff lain dari Pengaturan.
22. **Hitungan salah** PIN (per staff, `GAGAL_PIN_*`) dan Kode Pemasangan (`GAGAL_KODE`, dipakai
    bersama layar pemasangan dan pemulihan) di Script Properties; lima kali berturut-turut mengunci
    15 menit. PIN yang bukan 6 angka ditolak tanpa dihitung. Login benar mengosongkan hitungan.
    Reset PIN oleh Pengelola dan pemulihan membuka kunci PIN; `buatKodePemasangan` membuka kunci kode.
23. **Pemasangan pertama** hanya bisa jika belum ada Pengelola aktif yang punya PIN. Jika nama yang
    diisi sudah ada di `M_Staff` (diisi tangan), baris itu yang dipakai. Zona waktu perangkat juga
    dipasang sebagai zona waktu spreadsheet, supaya `TODAY()` di tab Harian sama dengan server.
    Kode yang hangus dikosongkan dan keterangannya mencatat waktu pemakaian.
24. **Layar Login** menampilkan staff aktif yang punya PIN, urut abjad. "Pulihkan akses Pengelola"
    memilih nama dari Pengelola aktif. Di laptop, angka PIN juga bisa diketik di papan ketik.
    Pada layar setinggi 500–699 px, langkah PIN menyembunyikan ikon dan nama outlet supaya papan
    angka 64 px muat tanpa digulir.
25. **Tanggal Beranda** adalah tanggal perangkat (dikirim sebagai `tanggal`), sesuai Bagian 4.2.
    Kelengkapan Bagian 5.8 sudah dihitung server dari tab Data (`Data_Stock`, `Data_Suhu`,
    `Data_Prep`, `Data_Waste`, `Data_Nihil`, `Data_K_<ID Form>`), jadi rel langsung benar begitu
    form dibangun. Wajib = form bawaan yang tampil, atau form kustom berjadwal `harian`. Jadwal
    `hari tertentu` belum dihitung wajib karena daftar harinya belum punya tempat di `M_Form`
    (diatur di Tahap 9). Suhu tanpa unit aktif tidak pernah lengkap. Tiket Suhu: "x dari y
    pengecekan" selagi sebagian; setelah lengkap "Terkirim" dengan keterangan "y dari y pengecekan".
26. **Pemberitahuan "NAMA meminta reset PIN"** tampil di bawah tiket (paling atas di antara
    pemberitahuan), bukan di atas tiket, supaya tiket tetap tergantung di rel. Ketukan membuka
    `#/pengaturan/staff/<nama>/pin`, yang langsung membuka lembar reset PIN.
27. **Pengaturan → Staff dan PIN:** staff baru langsung dibuat dengan PIN. Nama tidak bisa diganti
    (nama dipakai sebagai `submitted_by`). Role dan keadaan akun sendiri tidak bisa diubah sendiri,
    supaya Pengelola tidak mengunci diri. Daftar staff memakai pola tabel lebar (kolom nama diam).
    Pengaturan hanya menampilkan bagian yang sudah dibangun (sejak 5 Oktober 2026 tiga: Staff dan PIN,
    Penerima email, Outlet dan jadwal); bagian lain menyusul di tahapnya.
28. **Penerima email** disimpan di `M_Outlet` kolom Email Penerima Laporan, dipisah koma; alamat
    ganda (huruf besar/kecil) dibuang.
29. **Penyimpanan di HP** (localStorage): `inventoryku:sesi`, `inventoryku:infoLogin`, dan per
    pengguna `inventoryku:p:<nama>:draft:<id>`, `:antrean`, `:cache:<layar>`. Lewat `Draft`,
    `Antrean`, dan `Cache` di app.js. Draft Tahap 1 dipakai di lembar Tambah staff (tanpa PIN)
    dan kolom Penerima email. PIN tidak pernah disimpan di HP.
30. **Pola bersama di app.js** untuk layar berikutnya: router `#/...` (`RUTE`, menu per role, rute
    `pengelola: true` dialihkan ke Beranda untuk Staff); `muatData` (data tersimpan dulu dengan
    "Memperbarui…", kerangka jika belum ada, tidak menggambar ulang jika jawaban server sama);
    `tombol` + `aturTombolProses`; `bukaLembar` dan `konfirmasi` (lembar bawah di HP/tablet,
    dialog di desktop); `toast`; `kolomIsian`, `kolomPin`, `grupPilihan`; `tandaStatus`;
    `kotakKosong`, `kotakGalat`; kelas CSS `tabel-bingkai`/`tabel`, `kartu`, `daftar-baris`.
    Menu Riwayat, Laporan, dan Dashboard sementara menampilkan "… dibangun di tahap berikutnya.".
31. **Papan ketik:** viewport `interactive-widget=resizes-content` (Android); di perangkat sentuh
    bar bawah disembunyikan selama kolom teks difokus; tinggi papan ketik yang menutupi layar
    (iPhone) dibaca dari `visualViewport` ke `--papan-ketik` untuk lembar dan pesan singkat.
32. **Pita sinyal** di Beranda berada di atas kepala navy (di layar lain di bawah bar), supaya tiket
    tetap tergantung di rel. Saat offline, "Belum diperbarui." tidak mengulang pesan pita.
33. **Ikon:** pembatas buku digambar sebagai bentuk isi amber (versi garis terbaca seperti huruf W
    di ukuran besar); favicon disesuaikan. Bilah status iPhone: `black-translucent`, isi memakai
    jarak aman atas.

### Tahap 2

34. **Layar isi Stock** ada di `#/stock`; tiket form yang sudah punya layar didaftarkan di
    `LAYAR_FORM` (app.js), tiket lain masih menampilkan "Form ini dibangun di tahap berikutnya.".
    Kategori dan item yang tampil: item aktif di kategori aktif, kategori urut `Urutan`, item urut
    nama. Pengelola memilih "Tanggal lain" dengan pemilih tanggal bawaan browser.
35. **Angka isian** menerima koma dan titik sebagai pemisah desimal ("2,5" = "2.5"); titik tidak
    dianggap pemisah ribuan ("1.250" = 1,25). Angka minus dan huruf ditolak. Disimpan paling
    banyak 3 angka di belakang koma. Tampilan memakai format Indonesia ("1.250,5") dan tanda −.
36. **Data_Stock:** satu baris per item yang diisi per kiriman; kategori dan satuan diambil dari
    `M_Item` saat ditulis. Satuan besar: Stock Masuk disimpan dalam satuan dasar, `Masuk Diketik`
    berisi angka aslinya ("2 dus"). Kiriman dari antrean untuk item yang sudah dinonaktifkan tetap
    diterima (data tidak hilang).
37. **Hitung ulang stock** (`hitungUlangStock_([{ item, dari }])`, Code.gs) membaca semua sumber di
    `SUMBER_STOCK`: `Data_Stock` (Stock Masuk, Stock Keluar), `Data_Prep` (Hasil → Hasil Prep),
    `Data_PrepBahan` (Qty Terpakai → Dipakai Prep), `Data_Waste` (Qty → Waste),
    `Data_Penyesuaian` (Selisih → Penyesuaian). Tahap 5 dan 6 cukup menulis kolom itu lalu memanggil
    fungsi ini. Rekap yang ada diperbarui di tempat, yang baru ditambahkan, dan tanggal yang tidak
    punya gerakan lagi dihapus; baris item lain tidak ditulis. Setelah itu `Stock_Harian` diurutkan
    (tanggal terbaru, kategori, nama item) supaya mudah dibaca; rumus tidak bergantung pada urutan.
38. **Tab penuh:** tab Sheet baru hanya punya 1.000 baris. `barisTulis_` menambah baris di dalam
    rentang (sebelum baris terakhir) supaya format, warna, dan filter ikut melebar; baris kosong
    yang tersisa hilang saat tab diurutkan.
39. **Aturan tanggal** diperiksa server dengan zona waktu `M_Konfigurasi`. Isian di antrean yang
    tanggalnya sudah terlalu lama bagi Staff ditolak server dan ditandai "Gagal kirim" di HP,
    lengkap dengan pesannya; isian itu tetap di HP sampai dikirim ulang atau dihapus.
40. **Penyesuaian stock** (hanya Pengelola). Sejak Tahap 3 tombolnya hanya ada di lembar riwayat
    per item (butir 52), tidak lagi di layar Stock; tanggalnya hari ini menurut HP.
    Stock tercatat = Stock Akhir pada tanggal itu menurut server; selisih nol ditolak dengan pesan.
    Nilai Selisih (Rp) = selisih × Harga Satuan, kosong jika harga kosong. Butuh sinyal (tidak
    masuk antrean). Catatan yang diawali =, +, -, atau @ diberi tanda kutip supaya tidak menjadi rumus.
41. **Tanda nihil** umum untuk semua form kecuali Suhu: aksi `tandaiNihil` dan komponen
    `bagianNihil` (app.js). Ditolak jika form sudah punya isian pada tanggal itu; menekan lagi
    tidak menambah baris. Tanpa sinyal, tanda nihil masuk antrean. Batal sendiri karena kelengkapan
    selalu mendahulukan kiriman (baris `Data_Nihil` tidak dihapus).
42. **Antrean kirim:** galat sambungan (sinyal, batas waktu, jawaban bukan dari API) memasukkan isian
    ke antrean; galat dari server (aturan, angka) tampil di layar dan draft tetap. Antrean dikirim
    saat aplikasi dibuka, setelah login, saat sinyal kembali, saat aplikasi dibuka lagi, dan tiap
    menit selama terbuka. Beranda menampilkan "N isian menunggu kirim" / "N isian gagal kirim" yang
    membuka lembar "Isian di HP" (Kirim ulang, Hapus untuk yang gagal); tiket form dan layar form
    menampilkan jumlahnya; tombol nama di Login menampilkan isian yang menunggu pengguna itu.
43. **Data form di HP:** jawaban `formStock` terakhir disimpan (`cache:stock`). Untuk tanggal lain
    tanpa sinyal, layar memakai data itu dengan anggapan stock tidak bergerak sejak itu, dengan
    tulisan "Belum diperbarui.". Draft Stock per pengguna menyimpan tanggal, kategori, isian per
    kategori, dan submissionId per kategori; draft yang tanggalnya sudah lewat kembali ke hari ini
    (isiannya tetap).
44. **Warna berselang per hari** di tab `Data_*` dan `Stock_Harian`: format bersyarat
    `=AND(ISNUMBER($A2),ISEVEN(INT($A2)))` berlatar Baja. Hari berurutan berganti warna; dua hari
    yang sama-sama genap tetapi tidak berurutan (ada hari kosong di antaranya) bisa berwarna sama.
45. **Harian_Stock:** satu rumus di A9 (LET/REDUCE/XLOOKUP). Semua item aktif di kategori aktif,
    dikelompokkan per kategori dengan baris judul (nama kategori di kolom Nama Item), No mulai dari
    1 di tiap kategori. Item tanpa rekap pada tanggal itu menampilkan Awal = Akhir = rekap terakhir
    sebelumnya dan gerakan kosong. Diisi oleh dan Diperiksa oleh menjadi bagian akhir hasil rumus
    (supaya tidak bertabrakan dengan tabel yang panjangnya berubah). Sorotan stok minimum memakai
    `INDIRECT` ke `M_Item`, karena format bersyarat tidak bisa merujuk tab lain secara langsung.
46. **Blok Stock Inventory di Dashboard:** baris 6 ringkasan (jumlah di bawah stok minimum dan
    minus), baris 7 judul, baris 8 tabel (Item, Stock Akhir terkini, Satuan, Masuk dan Keluar
    selama periode B3, Keterangan) dengan ruang tetap 150 baris (`TINGGI_BLOK_STOCK`). Dashboard
    Tahap 0 diberi ruang dengan menyisipkan 151 baris sebelum blok "Nilai stock" (hanya sekali).
47. **Tabel isian di laptop/desktop:** kolom No dan Nama Item diam saat tabel digeser. Di tabel,
    peringatan minus ditulis ringkas ("Stock akhir minus"); kalimat lengkapnya di kartu HP/tablet.
    "Perlu reorder" tampil jika Stock Akhir sementara lebih kecil dari Stok Minimum.

### Tahap 3

48. **Riwayat umum dari M_Form.** Server punya daftar `RIWAYAT_FORM` (Code.gs): tab data, kolom
    kepala, kolom baris (jenis, boleh dikoreksi, satuan, angka asli), kolom filter, dan
    `setelahKoreksi`. Frontend menggambar daftar, detail, laporan, dan koreksi dari susunan kolom yang
    dikirim server. Waste/Suhu (Tahap 5) dan Prep (Tahap 6, `setelahKoreksi` juga memperbarui
    `Data_PrepBahan`) cukup didaftarkan di situ; form kustom (Tahap 9) dibuat dari `M_FormKolom` di
    `defRiwayat_`. Form aktif yang belum terdaftar tetap tampil sebagai pilihan, dengan tulisan
    "Riwayat … dibangun di tahap berikutnya, bersama formnya."
49. **Pemeriksaan per kiriman** (`submission_id`): Tandai diperiksa dan Buka kunci mengubah semua
    baris kiriman itu; Laporkan kekeliruan, Koreksi, dan Tutup laporan per baris. Kiriman yang masih
    punya baris dilaporkan keliru tidak bisa ditandai diperiksa (koreksi atau tutup laporannya dulu).
    Baris Diperiksa terkunci: koreksi ditolak server sampai dibuka. Buka kunci mengembalikan status ke
    Terkirim dan mengosongkan `checked_by`/`checked_at`.
50. **Koreksi** hanya kolom yang ditandai `koreksi` (Stock: Stock Masuk dan Stock Keluar, dalam satuan
    dasar; kosong = 0). Item dan tanggal tidak bisa dikoreksi; untuk "membatalkan" catatan, koreksi
    angkanya menjadi 0. Koreksi Stock Masuk mengosongkan `Masuk Diketik` (ikut tercatat di log).
    Tanda dilaporkan keliru hilang setelah dikoreksi. Lalu `hitungUlangStock_` dari tanggal baris itu.
51. **Log_Perubahan:** satu baris per kolom yang berubah (Waktu, Oleh, Tab, row_id, Kolom, Nilai Lama,
    Nilai Baru; angka ditulis sebagai teks dengan titik desimal). Buka kunci (`status`) dan Tutup
    laporan (`flag_note`) juga dicatat. Riwayat menampilkan nilai sebelum koreksi pertama (dicoret),
    nilai sekarang, serta pengoreksi dan waktu koreksi terakhir.
52. **Riwayat per item** dibuka dengan mengetuk nama item (detail kiriman, rekap harian, penyesuaian).
    Tabelnya urut tanggal lama ke baru supaya Akhir → Awal hari berikutnya mudah diikuti. "Stock
    tercatat hari ini" di atas tabel. Lembar ini lebih lebar di desktop (`lebar: true` di `bukaLembar`).
53. **Laporan kekeliruan berikutnya** pada baris yang sama ditambahkan: `flagged_by` berisi nama-nama
    pelapor (dipisah koma), `flag_note` disambung " / Nama: catatan". Catatan paling panjang 200 huruf.
54. **Filter:** tanggal "7 hari terakhir" (bawaan), "Satu tanggal", atau "Rentang" (paling banyak 31
    hari, diperiksa di HP dan server). Kategori dan item menyaring baris (daftar hanya memuat baris
    yang cocok; detail selalu memuat semua baris kiriman). Status menyaring kiriman. Pengisi dan
    status tidak berlaku di Rekap harian. Saat status dipilih, tanda nihil dan penyesuaian tidak
    tampil. Pilihan Riwayat disimpan per pengguna (`cache:riwayat-pilihan`); jawaban terakhir di
    `cache:riwayat` hanya dipakai jika permintaannya sama.
55. **Beranda Pengelola:** "N isian belum diperiksa" (kiriman dengan baris berstatus Terkirim) dan
    "N baris dilaporkan keliru", dihitung dari 31 hari terakhir (rentang yang bisa dibuka sekali di
    Riwayat). Ketukan membuka Riwayat dengan rentang 31 hari itu, status yang sesuai, dan form pertama
    yang memilikinya. Letaknya di bawah permintaan reset PIN.
56. **Tampilan:** HP dan tablet: daftar per tanggal, detail di layar sendiri (`#/riwayat/<form>/<sid>`)
    dengan kartu per baris. Desktop: dua kolom (daftar kiri, detail kanan, alamat ikut berganti tanpa
    menggambar ulang daftar), tabel di detail dan rekap. Rekap harian di HP berupa daftar per kategori;
    di desktop satu tabel per tanggal dengan lebar kolom tetap. Tombol "Unduh PDF tanggal tersebut"
    menyusul di Tahap 4.
57. **Tanda:** Terkirim dan Diperiksa memakai tanda Baik ("Diperiksa Budi, 3 Okt 21.50" di detail),
    dilaporkan keliru Perlu ditinjau (ikon bendera di baris), pernah dikoreksi Menunggu. Rekap: Stock
    Akhir minus Masalah, di bawah stok minimum Perlu ditinjau ("Di bawah stok minimum", karena
    "Perlu reorder" kurang tepat untuk hari yang sudah lewat). Penyesuaian dan stock opname memakai
    ikon sendiri; tanda nihil memakai tanda Nihil.
58. **Antrean di Riwayat:** isian form terpilih yang masih di HP tampil paling atas ("Di HP, belum
    terkirim", tanda Menunggu kirim atau Gagal kirim), juga saat Riwayat gagal dimuat tanpa sinyal;
    ketukan membuka lembar "Isian di HP".
59. **Pesan penolakan per aksi:** entri `AKSI_` boleh punya `pesan`, dipakai `doPost` saat Staff
    memanggil aksi khusus Pengelola (misalnya koreksi: "Koreksi hanya bisa dilakukan Head Kitchen atau
    Manager. Laporkan kekeliruan supaya Pengelola mengoreksinya.").
60. **Perbaikan bersama:** `tambahAnak` (app.js) kini meratakan daftar bersarang, sehingga komponen
    boleh mengembalikan daftar elemen.

### Tahap 4

61. **Template PDF per form** di `LAPORAN_PDF` (Code.gs): `{ judul, isi(tanggal) }`, dengan `isi`
    mengembalikan `{ ada, info, tabel, catatan }`. Kepala ("InventoryKu · Outlet"), judul navy dengan
    garis bawah, kotak info (Nama Outlet, Tanggal, ditambah info form), baris "Diisi oleh" dan
    "Diperiksa oleh", dan kaki ("Dibuat … · InventoryKu") dibuat bersama oleh `htmlLaporan_`. Form
    berikutnya cukup menambah satu entri. HTML diubah ke PDF dengan
    `Utilities.newBlob(html, 'text/html').getAs('application/pdf')`; CSS-nya sederhana (tabel biasa,
    Arial 9 pt, tanpa amber).
62. **PDF Stock** meniru `Harian_Stock`: semua item aktif (ditambah item nonaktif yang bergerak hari
    itu), dikelompokkan per kategori dengan baris judul kategori berlatar Baja, No mulai 1 di tiap
    kategori. Gerakan nol dibiarkan kosong; item tanpa gerakan menampilkan Awal = Akhir. Stock Akhir
    minus merah tebal (tanda − ikut tertulis); di bawah stok minimum diberi tanda `*` dengan
    keterangan di bawah tabel (bukan warna saja). Stock Masuk yang diketik dalam satuan besar
    ditulis kecil di bawah angkanya: "(2 dus)".
63. **Diisi oleh** = nama pengisi kiriman hari itu dan jam kiriman terakhir. **Diperiksa oleh**
    (Bagian 6.2): semua kiriman diperiksa → "Budi, 3 Okt 21.50" (pemeriksa terakhir); belum semua →
    "2 dari 3 isian diperiksa"; tanpa kiriman → "Belum ada isian".
64. **Tanggal tanpa data:** PDF Stock dibuat jika ada kiriman `Data_Stock` atau rekap `Stock_Harian`
    pada tanggal itu; jika tidak: "Belum ada isian Stock pada Selasa, 15 September 2026. Pilih tanggal
    lain." Tanggal masa depan ditolak. Semua role boleh mengunduh tanggal mana pun.
65. **Nama file dan Drive:** unduhan `{YYYY-MM-DD}_{NamaForm}.pdf`; Drive
    `Laporan Kitchen/{Nama Outlet}/{YYYY}/{MM Bulan}/{YYYY-MM-DD}_{NamaForm}_{HHmm}.pdf` (folder bulan
    misalnya "10 Oktober", supaya urut dan terbaca). Spasi di nama form menjadi garis bawah
    ("Prep_list"). Unduhan dikirim sebagai base64 di dalam JSON dan tidak membuat file di Drive.
66. **Unduh PDF bersama** (`unduhPdf(opsi)` di app.js) → `{ tombol, pesan, reset() }`, dipakai
    Laporan dan detail Riwayat. iPhone/iPad dikenali dari `userAgent` (iPhone/iPad/iPod, atau
    Macintosh dengan `maxTouchPoints > 1`). Di iPhone/iPad dukungan berbagi file diperiksa dengan
    `navigator.canShare({ files })` sebelum meminta PDF (jika tidak didukung, server tidak dipanggil
    dan pesan cadangan tampil), lalu diperiksa lagi dengan file aslinya. Ketukan "Simpan PDF"
    memanggil `navigator.share` sebagai perintah pertama; setelah lembar bagikan ditutup (berhasil
    atau batal) tombol kembali "Unduh PDF". Ganti tanggal atau form juga mengembalikannya.
    Petunjuk "Ketuk Simpan PDF, …" memakai pesan berjenis baru `info` (warna Menunggu).
67. **Menu Laporan:** kartu "Laporan harian PDF" dengan pilihan tanggal (Hari ini, Kemarin, Tanggal
    lain), pilihan form (tombol berjajar dari `M_Form`, bisa digeser), "Unduh PDF", dan untuk
    Pengelola "Simpan ulang ke Drive" (hasilnya ditulis di bawah tombol beserta lokasi file). Form
    yang laporannya belum dibangun menonaktifkan tombol dengan tulisan "Laporan PDF … dibangun di
    tahap berikutnya, bersama formnya." Pilihan tersimpan per pengguna (`cache:laporan-pilihan`).
    Daftar belanja dan Rekap bulanan menyusul di Tahap 8 dan 10.
68. **Email harian** (`jalankanLaporanHarian_`, dipanggil `kirimLaporanHarian` dan
    `kirimLaporanSekarang`) lewat `MailApp` (izin kirim saja), nama pengirim "InventoryKu", subjek
    "Laporan harian {Outlet}, {Hari, tanggal}". Isi: status tiap form aktif menurut Bagian 5.8
    (Terkirim, Nihil, Belum lengkap x dari y, Belum diisi; yang wajib dan belum diisi merah), Stock
    Akhir minus, item di bawah stok minimum dengan saran order Bagian 9.2 (`saranOrder_`, dipakai
    lagi di Tahap 8), jumlah isian belum diperiksa, baris dilaporkan keliru, permintaan reset PIN,
    daftar lampiran, kegagalan cadangan, dan tautan aplikasi. Dilewati sampai tahapnya: suhu di luar
    standar dan total waste (Tahap 5), masa simpan (Tahap 6), pengingat opname (Tahap 8). Lampiran:
    PDF tiap form yang berstatus Terkirim dan punya template; tiap PDF juga disimpan ke Drive. PDF
    yang gagal disimpan ke Drive tetap dilampirkan dan disebut di email.
69. **Catatan kegagalan:** hasil laporan dan cadangan ditulis di `M_Konfigurasi` (`laporan_terakhir`,
    `cadangan_terakhir`; baris dibuat otomatis, tanpa setupSpreadsheet). Nilai yang diawali "Gagal"
    (tanpa penerima, kuota habis, email ditolak, salinan gagal) tampil di Beranda Pengelola sebagai
    "Perlu perhatian". Kegagalan cadangan juga disebut di setiap email harian sampai cadangan
    berikutnya berhasil.
70. **Alamat aplikasi** untuk tautan di email terdeteksi dari HP Pengelola (aksi `beranda`, seperti
    zona waktu) dan disimpan di `M_Konfigurasi` `alamat_aplikasi`; hanya ditulis jika berubah.
71. **Trigger** (`pasangTrigger`, dijalankan dari editor): menghapus semua trigger milik script ini,
    lalu memasang `kirimLaporanHarian` setiap hari pada jam closing + jeda (`nearMinute`, toleransi
    Google sekitar 15 menit) dan `buatCadangan` setiap `hari_cadangan` pukul 03.00, keduanya dalam
    zona waktu tersimpan. Jalankan ulang setelah mengubah jam closing, jeda, hari cadangan, atau zona
    waktu. Jika laporan berjalan sebelum pukul 06.00, laporannya untuk hari kemarin.
    `kirimLaporanSekarang` memakai data hari ini, subjek diawali "[Uji]", dan ikut menyimpan PDF ke
    Drive.
72. **Cadangan** bernama "Cadangan {nama spreadsheet} {YYYY-MM-DD HHmm}" di
    `Laporan Kitchen/Cadangan/`. Empat salinan terbaru dengan awalan itu disimpan; yang lebih lama
    dipindah ke tempat sampah Drive.

### Perubahan 5 Oktober 2026 (spesifikasi tampilan 1.6, spesifikasi sistem 5 Oktober)

73. **Tombol Keluar** (dulu "Ganti pengguna"). Ketukan nama pengguna membuka menu kecil (`role=menu`)
    tepat di bawah nama, berisi satu pilihan "Keluar"; pilihan itu membuka konfirmasi "Keluar dari
    akun Rina?" dengan "Batal" dan "Keluar" (plus pesan antrean jika ada isian di HP). HP dan tablet:
    nama di kepala Beranda; desktop (≥ 1.024 px): nama di bar atas pada semua layar, dan nama di
    kepala Beranda disembunyikan supaya tidak ada dua menu. Menu tertutup oleh Escape, ketukan di
    luar, ketukan kedua pada nama, guliran, ubah ukuran, dan pindah layar; tanpa bayangan, muncul
    dengan pudar 150 ms (mati saat "kurangi gerak"). `keluar()` di app.js dipakai tombol Keluar dan
    keluar otomatis: sesi di server dihapus jika ada sinyal, token dihapus dari HP, draft, antrean,
    dan data tersimpan per pengguna tetap.
74. **Keluar otomatis** dihitung di HP. `inventoryku:terakhirDipakai` (ms) dan
    `inventoryku:keluarOtomatisMenit` disimpan per perangkat, bukan per pengguna. Yang dihitung
    "dipakai": `pointerdown`, `touchstart`, `keydown`, `input`, `wheel`, `scroll` (ditangkap di
    `document`); waktu ditulis ke HP paling sering tiap 5 detik. Pemeriksaan: tiap 10 detik, saat
    `visibilitychange` (tampil lagi), `pageshow`, `focus`, saat aplikasi dibuka (sesi yang sudah
    terlalu lama diam langsung keluar dengan keterangan), dan sebelum ketukan dicatat (ketukan
    pertama setelah HP dinyalakan tidak menghidupkan sesi lagi). Hitungan berhenti lewat
    `jagaProses(janji)` selama mengirim isian yang dimulai pengguna (Kirim stock, Tidak ada hari ini,
    Kirim ulang di lembar Isian di HP) dan membuat PDF (Unduh PDF, Simpan ulang ke Drive), lalu mulai
    dari nol. Pengiriman antrean otomatis di latar (tiap menit, saat sinyal kembali) tidak menahan
    hitungan, supaya isian yang terus gagal karena sinyal lemah tidak membuat sesi tidak pernah
    habis. Keterangan di Login: satu baris berikon info, warna Teks di Navy, di atas "Pilih nama";
    hilang saat nama dipilih, tidak muncul lagi lewat "Ganti nama". Form tanpa draft (lembar koreksi,
    laporan kekeliruan) yang terbuka saat keluar otomatis ditutup tanpa disimpan.
75. **Lama keluar otomatis** di `M_Konfigurasi` baris `keluar_otomatis_menit` (teks, nilai awal "5";
    nilai kosong atau selain 5/10/15/30 dibaca 5). Dikirim saat login, pemasangan, pemulihan, dan di
    setiap jawaban `beranda` (perubahan dari Pengelola sampai ke perangkat lain tanpa login ulang).
    **Pengaturan → Outlet dan jadwal** (`#/pengaturan/outlet`) baru berisi pilihan "Keluar otomatis
    setelah tidak dipakai" (tombol berjajar 5/10/15/30 menit), keterangan "Berlaku untuk semua pengguna
    di semua perangkat.", dan tombol "Simpan" (nonaktif sampai pilihan berubah). Nama outlet, zona
    waktu, jam closing, dan jadwal opname menyusul di tahapnya.
76. **Hapus staff.** Kolom `Dihapus` (waktu) di `M_Staff`. `bacaStaff_()` melewati baris yang Dihapus
    berisi, jadi staff itu hilang dari Login, Pengaturan, sesi, dan pencarian nama, dan namanya boleh
    dipakai staff baru (baris baru). Selama kolom belum ada (setupSpreadsheet belum dijalankan ulang),
    semua staff dianggap belum dihapus dan `hapusStaff` menolak dengan petunjuk menjalankan
    setupSpreadsheet. Hapus: kolom Dihapus diisi waktu, hash PIN dan Permintaan Reset PIN dikosongkan,
    hitungan salah PIN dibuang; ditolak untuk staff aktif ("Nonaktifkan dulu untuk bisa menghapus.")
    dan untuk Staff (role diperiksa server). Pilihan "Pengisi" di filter Riwayat tetap memuat nama
    yang dihapus (isian lamanya masih ada). **Pengelola aktif terakhir** (aktif, punya PIN, Head
    Kitchen/Manager) tidak bisa dinonaktifkan atau diubah menjadi Staff; diperiksa sebelum aturan
    "akun sendiri", sehingga pesannya menjelaskan sebabnya. Daftar staff diurutkan server: aktif dulu,
    lalu nonaktif (teks Tinta Redup), masing-masing abjad. Di layar ubah staff, bagian paling bawah
    (dipisah garis): tombol "Hapus" (bahaya) untuk staff nonaktif, atau tulisan "Nonaktifkan dulu untuk
    bisa menghapus." untuk staff aktif; tidak tampil untuk akun sendiri. Setelah dihapus, layar kembali
    ke daftar dengan pesan "Rina dihapus dari daftar staff.". Sakelar Aktif/Nonaktif di Bagian 5.7
    tetap berupa tombol "Nonaktifkan" (dengan konfirmasi) / "Aktifkan lagi" yang sudah ada sejak
    Tahap 1; fungsinya sama.
77. **PDF stock per kategori.** Menu Laporan: saat form Stock dipilih, `<select>` "Kategori" (bentuk
    sama dengan layar isi Stock) di bawah pilihan form, nilai awal "Semua kategori", lalu kategori
    aktif menurut urutan `M_Kategori` (dari `infoLaporan`); pilihannya ikut tersimpan di
    `cache:laporan-pilihan`; mengganti kategori mengembalikan tombol iPhone ke "Unduh PDF". Server:
    `LAPORAN_PDF.STOCK.perKategori`; `buatPdf_(idForm, tanggal, { kategori })` memeriksa kategori aktif.
    Satu kategori: nama file `{tanggal}_Stock_{Kategori}.pdf` (spasi jadi garis bawah), kotak info
    "Kategori: Protein", tanpa baris judul kategori, "Diisi oleh/Diperiksa oleh" hanya dari kiriman
    kategori itu; kategori tanpa rekap dan tanpa kiriman pada tanggal itu ditolak: "Belum ada isian
    Stock kategori Sayur pada …. Pilih tanggal atau kategori lain." Semua kategori: kategori tanpa
    rekap pada tanggal itu dilewati (berlaku juga untuk PDF harian dan email); jika ada kiriman tetapi
    tidak ada gerakan sama sekali, tabel bertuliskan "Tidak ada gerakan stock pada tanggal ini.".
    **Pemisah halaman:** `htmlLaporan_` menerima `isi.bagian: [{ info, tabel }]`; bagian kedua dan
    seterusnya dibungkus `<div class="halaman-baru">` (`page-break-before:always`) dengan kepala, judul,
    kotak info, dan baris judul tabel diulang; Diisi/Diperiksa oleh, catatan, dan kaki sekali di akhir.
    Dukungannya pada `getAs('application/pdf')` belum bisa diuji di sini, jadi bawaannya **cadangan**
    Bagian 9.1 (satu tabel bersambung dengan baris judul kategori). Satu halaman per kategori aktif
    hanya jika Script Property `PDF_PEMISAH_HALAMAN` = `ya`; `ujiPemisahHalamanPdf()` (dari editor)
    membuat PDF uji 3 bagian di `Laporan Kitchen/Uji pemisah halaman PDF.pdf`, menghitung halamannya
    dari isi PDF, lalu mengisi property itu ("ya" untuk 3 halaman, "tidak" untuk 1); jika jumlahnya
    tidak terbaca, pemilik memeriksa filenya dan mengisi property sendiri. Unduh dari Riwayat, Simpan
    ulang ke Drive, PDF harian, dan lampiran email selalu satu file Stock berisi semua kategori.
78. **Versi:** Code.gs v0.5.3, aplikasi 0.5.1 (perbaikan di atas Tahap 4). Sejak Tahap 5 lihat butir 80.
79. **Baris baru tepat di bawah baris terakhir yang kolom kuncinya terisi** (v0.5.2, diperketat
    v0.5.3). Kotak centang yang tidak dicentang menyimpan FALSE dan dropdown bisa berisi pilihan
    tanpa data; `getLastRow()` menghitung keduanya, sehingga staff dari Pengaturan sempat tertulis di
    baris 1001 (atau gagal jika kotak centang sampai baris terakhir tab). Sekarang setiap tab yang
    ditulis aplikasi memakai kolom kunci yang selalu terisi pada baris data: `KUNCI_MASTER` (Nama di
    `M_Staff`, Satuan di `M_Satuan`, ID Form di `M_Form`, Kunci di `M_Konfigurasi`) lewat
    `barisBaruMaster_`, dan kolom A (Tanggal; Waktu di `Log_Perubahan`) untuk `Stock_Harian`, semua
    tab `Data_*`, dan `Log_Perubahan` lewat `barisTulis_`. Baris yang kolom kuncinya kosong bukan
    data. `rapikanTabMaster_` memindahkan baris berkunci ke atas mulai baris 2 tanpa mengubah urutan
    dan isinya, lalu mengosongkan isi baris tanpa kunci (validasi dan format tetap); dijalankan
    setupSpreadsheet untuk keempat tab master itu (dengan catatan di log, termasuk peringatan jika
    baris tanpa kunci berisi pilihan dropdown) dan setiap kali staff ditambah. Tab master yang belum
    ditulis aplikasi (`M_Item`, `M_Kategori`, `M_Unit`, `M_Resep`, `M_ResepBahan`, `M_FormKolom`)
    memakai cara yang sama saat ditulis dari Pengaturan di Tahap 7 dan 9.

### Tahap 5

80. **Versi:** Code.gs v0.6, aplikasi 0.6.0 (`VERSI_APLIKASI` dan `VERSI` di sw.js).
81. **Foto bukti waste** (opsional di spesifikasi) belum dibangun: butuh unggahan ke Drive dan ruang di HP, jadi digabung
    dengan Tahap 11 (opsional: foto bukti waste). Kolom `Foto Bukti` di `Data_Waste` sudah ada dan dibiarkan kosong.
82. **Layar Waste** (`#/waste`): Tanggal (Hari ini, Kemarin, Pengelola "Tanggal lain"), Shift (Pagi, Siang, Malam; wajib),
    "Tambah item" membuka lembar pencarian item aktif. Per item: Kategori waste (lima tombol), Qty (satuan dari `M_Item`),
    Alasan / keterangan (wajib hanya untuk Lainnya, paling panjang 200 huruf), dan Estimasi kerugian yang langsung dihitung
    (Qty × Harga Satuan; "Harga satuan belum diisi Pengelola" jika harga kosong). HP dan tablet: hanya item yang sedang diisi
    yang terbuka; item lain satu baris ringkas ("Rusak · 2 kg · Rp 90.000", tanda "Belum lengkap" jika kurang), ketuk untuk
    membuka. Laptop/desktop: tabel (No, Item / Produk, Kategori waste, Qty, Alasan / keterangan, Estimasi kerugian, hapus).
    Satu kiriman berisi semua item dengan satu shift; boleh berkali-kali sehari. Draft per pengguna `draft:waste`
    (tanggal, shift, baris, item terbuka, submissionId); jawaban terakhir di `cache:waste`.
83. **Data_Waste:** satu baris per item. Satuan dan Harga Satuan disalin dari `M_Item` saat dicatat; Estimasi Kerugian =
    pembulatan Qty × Harga Satuan (kosong jika harga kosong), dihitung server. Qty harus lebih dari 0 (paling banyak 3 angka
    di belakang koma, butir 35). Urutan tab: tanggal terbaru, nama item, waktu kirim. Setelah ditulis, `hitungUlangStock_`
    untuk item itu mulai tanggal waste, jadi rekap hari itu dibuat jika belum ada dan Stock Akhir sesudahnya ikut turun.
84. **Koreksi Waste** (Riwayat): Kategori waste (tombol pilihan), Qty, dan Alasan. Item dan tanggal tidak bisa dikoreksi.
    Estimasi dihitung ulang dari Harga Satuan yang tercatat di baris itu (bukan harga sekarang) dan ikut tercatat di
    `Log_Perubahan`; Lainnya tanpa alasan ditolak; lalu `hitungUlangStock_`. `RIWAYAT_FORM` mendapat `turunan` (kolom yang
    dihitung dari kolom lain setelah koreksi) dan `periksaKoreksi` (aturan isian yang sama dengan kiriman), dipakai juga Suhu
    dan form berikutnya. Kolom berjenis `rupiah` tampil "Rp 90.000"; tabel detail hanya punya kolom Satuan jika ada kolom
    angka bersatuan.
85. **Layar Suhu** (`#/suhu`): Tanggal, lalu Waktu cek (Opening, Middle, Closing, Cek ulang; yang sudah diisi untuk semua unit
    aktif diberi centang). Pilihan awal: waktu cek pertama yang belum lengkap. Satu kartu per unit aktif (urutan `M_Unit`):
    nama, tipe, batas normal, pengecekan yang sudah tercatat hari itu ("Opening 07.10: 4 °C, normal · Rina", cek ulang
    menjorok di bawahnya, tindakan korektif di bawah suhu yang di luar standar), lalu kolom suhu dengan tombol ± (Freezer mulai
    dengan "-"). Status tampil langsung di HP (perhitungan sama dengan server; yang disimpan tetap hitungan server); di luar
    standar: kartu bertanda Masalah dan kolom Tindakan korektif muncul (wajib). Unit yang waktu ceknya sudah diisi atau masih
    menunggu kirim di antrean tampil sebagai teks. Setelah kiriman berisi suhu di luar standar: pesan "Suhu Chiller 2 di luar
    standar. Catat cek ulang setelah tindakan korektif." dan tombol "Catat cek ulang" di kartu unit yang pengecekan terakhirnya
    di luar standar (memilih Cek ulang dan memfokuskan kolom unit itu). Unit yang dikosongkan tidak dikirim (Freezer yang
    hanya berisi "-" dianggap kosong), jadi satu waktu cek boleh diisi bertahap. Laptop/desktop: tabel (No, Unit, Tipe, Batas
    normal, Tercatat hari ini, Suhu, Tindakan korektif). Tidak ada tanda nihil. Draft `draft:suhu` (per waktu cek, per unit),
    `cache:suhu`.
86. **Data_Suhu:** satu baris per unit per kiriman. Opening, Middle, dan Closing sekali per unit per tanggal: jika salah satu
    unit dalam kiriman sudah punya isian waktu cek itu, seluruh kiriman ditolak ("Suhu Opening Chiller 1 sudah diisi Rina pukul
    07.10."), supaya tidak ada kiriman setengah masuk. Cek ulang boleh berkali-kali. Status (Normal / Di Luar Standar) dihitung
    server dari `M_Konfigurasi` (`suhu_chiller_min`, `suhu_chiller_maks`, `suhu_freezer_maks`; nilai kosong atau salah memakai 1,
    5, −18): Chiller normal jika di antara batas (termasuk), Freezer normal jika sama dengan atau lebih rendah. Suhu menerima
    koma, titik, "-" dan "−"; di luar −60 sampai 60 ditolak. Unit dibaca dari `M_Unit` (Tipe selain Freezer dianggap
    Chiller). Urutan tab: tanggal terbaru, nama unit, waktu kirim. Tidak ada email seketika.
87. **Koreksi Suhu:** Suhu (dengan tombol ±) dan Tindakan korektif. Status dihitung ulang dengan batas yang berlaku saat
    koreksi dan ikut tercatat di `Log_Perubahan`; suhu di luar standar tanpa tindakan ditolak. Riwayat Suhu memakai filter
    "Unit" (dari `M_Unit`) menggantikan Item, tanpa kategori. **Pengecekan terlewat** (Bagian 6.1): untuk tiap tanggal sejak
    isian Suhu pertama sampai kemarin, Riwayat menampilkan baris "Terlewat: 5 dari 9 pengecekan tidak diisi" dengan daftar unit
    dan waktu ceknya (unit aktif sekarang × Opening/Middle/Closing). Tidak tampil saat filter pengisi atau status dipakai.
88. **PDF:** Waste: No, Nama Staff, Shift, Item / Produk, Kategori Waste, Qty, Satuan, Alasan, Estimasi Kerugian (Rp), urut waktu
    kirim, baris total di bawah, kotak info "Jumlah item". Suhu: satu baris per unit (unit aktif ditambah unit yang punya isian),
    Opening/Middle/Closing berisi suhu dan jam diterima ("belum diisi" jika kosong), di luar standar merah tebal dengan `*`;
    tiap cek ulang satu baris di bawah unitnya; kotak info "Batas normal". Unduh menolak tanggal tanpa isian.
89. **Email harian:** lampiran PDF juga untuk form berstatus Sebagian (Suhu yang belum lengkap tetap dilampirkan). Bagian
    "Suhu": daftar pengecekan di luar standar (unit, waktu cek, jam, suhu, tindakan, hasil cek ulang sesudahnya),
    "Semua 9 pengecekan normal.", atau "Belum ada pengecekan suhu.". Bagian "Waste": jumlah item, total estimasi
    kerugian, dan rincian per item.
90. **Harian_Waste** (rumus A9): satu baris per item waste pada tanggal B5, urut waktu kirim, baris "Total estimasi kerugian"
    (latar Baja, tebal), lalu Diisi oleh dan Diperiksa oleh. **Harian_Suhu** (rumus A9): satu baris per unit (unit aktif menurut
    urutan `M_Unit`, ditambah unit yang punya isian hari itu) dengan suhu Opening, Middle, Closing, Nama Staff, dan Tindakan
    Korektif ("Opening: …"); tiap cek ulang menjadi baris sendiri di bawah unitnya ("Cek ulang 15.40" di kolom Tipe, suhunya di
    kolom Cek ulang). Kolom I–L (disembunyikan) berisi TRUE/FALSE "di luar standar" untuk kolom C–F, dipakai sorotan merah
    tebal, sehingga sorotan mengikuti status yang tersimpan. Rumus memakai LET/LAMBDA/MAP/REDUCE/MAKEARRAY seperti Harian_Stock.
91. **Dashboard:** blok Waste diberi ruang 17 baris (`TINGGI_BLOK_WASTE`) dan blok Suhu 26 baris (`TINGGI_BLOK_SUHU`) dengan
    menyisipkan baris sebelum blok berikutnya (hanya sekali; `ruangBlokDashboard_` mencari judul blok di kolom A). Waste
    (periode B3): ringkasan total estimasi; tabel per kategori waste (catatan, estimasi); 5 item paling sering (catatan, qty,
    estimasi); estimasi per bulan 6 bulan terakhir (tidak mengikuti B3); qty 5 item itu per minggu (7 hari terakhir, 8–14, dan
    15–21 hari lalu) sebagai "tren per item". Suhu (periode B3): ringkasan jumlah di luar standar; per unit aktif (paling banyak
    10): jumlah cek, di luar standar (merah jika > 0), rata-rata, terendah, tertinggi, suhu terakhir; lalu rata-rata suhu per
    unit per hari selama 7 hari terakhir.
92. **Layar bersama Tahap 5** (app.js): `pilihanTanggalIsian`, `tanggalDraft`, `formatRupiah`, `bacaAngkaSuhu`; kelas CSS
    `tombol-ikon` (hapus baris, 48 px), `tombol-tanda` (±), `deret-tambah`. Tiket Waste dan Suhu di Beranda membuka layarnya
    (`LAYAR_FORM`). Laporan PDF Waste dan Suhu otomatis aktif di menu Laporan dan detail Riwayat karena terdaftar di
    `LAPORAN_PDF`.

