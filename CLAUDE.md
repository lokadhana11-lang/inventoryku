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
  berlakuSampai, pengguna: { nama, role, pengelola }, namaOutlet }`; `lupaPin {nama}` →
  `{ sudahAda, waktu }`; `keluar {token}` → `{}`.
- Aksi bertoken: `beranda {tanggal}` → `{ pengguna, namaOutlet, tanggal, form: [{ id, nama, jenis,
  wajib, status: belum|sebagian|terkirim|nihil, lengkap, detail, terakhir: { oleh, waktu } }],
  permintaanReset (khusus Pengelola): [{ nama, waktu }] }`.
- Aksi khusus Pengelola: `daftarStaff` → `{ staff: [{ nama, role, pengelola, aktif, punyaPin,
  permintaanReset, terkunci }] }`; `tambahStaff {nama, role, pin}`, `ubahStaff {nama, role?,
  aktif?}` → `{ staff }`; `aturPin {nama, pin}` → `{ staff, sesiBaru? }`; `bacaPenerima` dan
  `simpanPenerima {email: []}` → `{ email: [] }`.
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
- Kiriman berisi `submissionId` yang dibuat di HP. Kiriman dengan `submissionId` yang sudah pernah
  masuk tidak ditulis lagi dan dijawab berhasil dengan `sudahTerkirim: true`, supaya antrean yang
  mengirim ulang menganggapnya selesai.

## Tahap dan status

| Tahap | Isi | Status |
|---|---|---|
| 0 | Fondasi: spesifikasi dipindah, CLAUDE.md, halaman uji sambungan, `doPost`/`doGet`/`ping`, `setupSpreadsheet` | Selesai (config.js sudah diisi pemilik). Halaman uji sambungan dihapus di Tahap 1; aksi `ping` tetap |
| 1 | Kerangka PWA dan akses (manifest, service worker, pemasangan pertama, login PIN, sesi, Ganti pengguna, Lupa PIN, role, zona waktu, Pengaturan → Staff dan Penerima Email, pola tata letak dan gerak) | Kode selesai dan digabung (Code.gs v0.2, aplikasi 0.2.0) |
| 2 | Form Stock Inventory Harian (termasuk rumus `Harian_Stock` dan blok Stock di tab Dashboard) | Kode selesai (Code.gs v0.3, aplikasi 0.3.0), diuji dengan API tiruan. Rumus Sheet belum bisa diuji di sini |
| 3 | Riwayat, pemeriksaan, dan koreksi | Kode selesai (Code.gs v0.4, aplikasi 0.4.0), diuji dengan API tiruan (Code.gs dijalankan di Node dengan tiruan SpreadsheetApp). Menunggu pemilik: tempel Code.gs, deploy versi baru, uji dari HP |
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
    Pengaturan hanya menampilkan dua bagian yang sudah dibangun; bagian lain menyusul di tahapnya.
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

