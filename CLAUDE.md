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
- Aksi Tahap 6 (bertoken): `formPrep {tanggal}` → `{ tanggal, shift, item: [{ nama, kategori, satuan, aktif, stock }],
  resep: [{ item, hasil, masaSimpan, bahan: [{ item, qty }] }], kiriman: { jumlah, terakhir, baris: [{ item, jumlahResep, hasil,
  qty, satuan, baikSampai, oleh, waktu }] }, nihil }`; `kirimPrep {submissionId, tanggal, shift, waktuPerangkat, baris: [{ item,
  jumlahResep, qty, keterangan }]}` → `{ sudahTerkirim, jumlah, form, baikSampai: [{ item, tanggal }], peringatan: [{ item, akhir,
  satuan }] }`. `beranda` (semua role) ditambah `masaSimpan: { lewat: [{ item, satuan, qty, baikSampai }], habisBesok: [...] }`.
  Khusus Pengelola: `daftarResep` → `{ resep: [{ itemHasil, satuan, hasil, masaSimpan, aktif, bahan: [{ item, qty, satuan, harga }],
  biaya, hargaPerSatuan, tanpaHarga, masalah }], item: [{ nama, kategori, satuan, harga, hargaDariResep, aktif, punyaResep }] }`;
  `simpanResep {baru, itemHasil, hasil, masaSimpan, bahan: [{ item, qty }]}` dan `aturResepAktif {itemHasil, aktif}` → jawaban
  `daftarResep`; `aturItemAktif {nama, aktif}` → jawaban `daftarItem` ditambah `diubah: { nama, aktif }` (sejak Tahap 7).
  `riwayat`/`detailKiriman`: `kolom[]` boleh berjenis `tanggal` dan membawa `jikaAda` dan `bantuan`; baris prep membawa
  `rincian: [{ item, qty, satuan, minus }]`.
- Aksi Tahap 7 (semua khusus Pengelola): `dashboard {tanggal}` → `{ tanggal, ringkas: { formLengkap, formWajib, belumDiperiksa,
  suhuLuar, bawahMinimum, wasteRp, wasteCatatan, nilaiStock }, nilaiStock: { total, jumlahItem, perKategori: [{ kategori, nilai,
  jumlahItem }], tanpaHarga: [{ nama, kategori, satuan, stock, aktif }] }, perhatian: [{ jenis, tingkat: masalah|tinjau|menunggu,
  judul, ket, data }], grafikWaste: { hari: [{ tanggal, rp, catatan }] }, grafikSuhu: { batas, jumlah, luar, unit: [{ nama, tipe,
  nonaktif?, cek: [{ waktuCek, suhu, luar, tindakan, oleh, waktu }] }] }, alamatSheet }`; `daftarItem` → `{ hariIni, item: [{ nama,
  kategori, satuan, satuanBesar, isiSatuanBesar, harga, stokMin, stokMaks, aktif, stock, punyaCatatan, bisaGantiNama, resepAktif,
  dipakaiResep }], kategori: [{ nama, aktif }], satuan: [{ satuan, jenis, aktif }] }`; `simpanItem {baru, namaLama, nama, kategori,
  satuan, satuanBesar, isiSatuanBesar, harga, stokMin, stokMaks}` → `daftarItem` + `disimpan`; `daftarKategoriSatuan` → `{ kategori:
  [{ nama, urutan, aktif, jumlahItem, jumlahItemAktif }], satuan: [{ satuan, jenis, aktif, jumlahItem, jumlahItemAktif }],
  jenisSatuan }`; `simpanKategori {baru, namaLama, nama}`, `aturKategoriAktif {nama, aktif}`, `urutKategori {urutan: [nama]}`,
  `simpanSatuan {baru, satuanLama, satuan, jenis}`, `aturSatuanAktif {satuan, aktif}` → jawaban `daftarKategoriSatuan` (simpan:
  + `disimpan`); `daftarUnit` → `{ unit: [{ nama, tipe, aktif, punyaCatatan }], batas }`; `simpanUnit {baru, namaLama, nama, tipe}`,
  `aturUnitAktif {nama, aktif}` → jawaban `daftarUnit`. `bacaOutletJadwal` kini → `{ namaOutlet, zonaWaktu, jamClosing,
  jedaLaporanMenit, jadwalOpname, hariCadangan, keluarOtomatisMenit, perluPasangTrigger }`; `simpanOutletJadwal` menerima field
  mana pun dari daftar itu (hanya yang dikirim yang ditulis) dan menjawab sama ditambah `jadwalBerubah`.
- Aksi Tahap 8 (semua khusus Pengelola): `formOpname {tanggal}` → `{ tanggal, kategori: [nama], item: [{ nama, kategori, satuan, harga,
  tercatat }], status }`; `simpanOpname {submissionId, tanggal, waktuPerangkat, baris: [{ item, hitung }]}` → `{ sudahTerkirim, id, tanggal,
  oleh, waktu, jumlah, berselisih, totalNilai, tanpaHarga, baris: [{ item, kategori, satuan, tercatat, hitung, selisih, nilai }] }`;
  `detailOpname {submissionId}` → jawaban yang sama tanpa `sudahTerkirim`; `unduhPdfOpname {submissionId}` dan `unduhPdfBelanja {order: {
  namaItem: teks }}` → `{ namaFile, mime, data }`; `daftarBelanja` → `{ tanggal, jumlah, kategori: [{ nama, item: [{ nama, satuan,
  satuanBesar, isiSatuanBesar, stock, stokMin, stokMaks, saran: { jumlah, satuan, dasar, teks } | null }] }] }`. `status` opname = `{
  terakhir: { id, tanggal, oleh, waktu } | null, jadwal, batasHari, hariLalu, lewat }`, juga di `beranda.opname` (Pengelola) dan
  `dashboard.opname`; `dashboard.perhatian[]` boleh berjenis `opname`; `riwayat.peristiwa[]` opname ditambah `id` dan `nilai`.
- Aksi Tahap 9 (bertoken, semua role): `formKustom {formId, tanggal}` → `{ formId, tanggal, form: { id, nama, jenis, keterangan,
  jadwal: harian|hari tertentu|sewaktu-waktu, hari: [nama hari], aktif, kolom: [{ id, bagian: kepala|baris, label, jenis:
  Teks|Angka|Pilihan|Ya/Tidak|Item|Jam, pilihan, wajib, aktif }] }, item: [{ nama, kategori, satuan }], kiriman: { jumlah, baris,
  terakhir }, nihil, wajib }`; `kirimKustom {formId, submissionId, tanggal, waktuPerangkat, kepala: { idKolom: nilai }, baris: [{
  idKolom: nilai }]}` → `{ sudahTerkirim, jumlah, form }`. Khusus Pengelola: `daftarForm` → `{ form: [{ id, nama, jenis, keterangan,
  jadwal, hari, aktif, urutan, jumlahKolom, diarsipkan }], arsip: [...], jumlahKustom, batasForm, batasKolom, siap }`; `detailForm
  {formId?}` → `{ form (kolom termasuk yang dihapus, aktif: false) | null, adaIsian, kolomBawaan: [label], item, jumlahKustom,
  batasForm, batasKolom, siap }`; `simpanForm {baru, formId, nama, tampil, keterangan, jadwal, hari, kolom: [{ id, bagian, label,
  jenis, pilihan, wajib }]}`, `aturFormTampil {formId, tampil}`, `urutForm {urutan: [id]}`, `arsipkanForm {formId}`, `pulihkanForm
  {formId}` → jawaban `daftarForm` (simpan: + `disimpan: { id, nama, tampil }`). `beranda.form[]` ditambah `jadwal` dan `hari`;
  `riwayat.daftarForm[]` dan `infoLaporan.form[]` ditambah `tampil` (form yang disembunyikan tetap ada di Riwayat dan Laporan);
  `riwayat.kolom[]` boleh membawa `opsional` dan `waktu`.
- Aksi Tahap 10 (khusus Pengelola): `unduhPdfRekap {bulan: 'yyyy-mm'}` → `{ namaFile, mime, data }` (rekap bulanan, Bagian 9.3;
  tidak menambah file di Drive). Fungsi dari editor atau trigger: `kirimRekapBulanan` (trigger tanggal 1) dan `kirimRekapSekarang`
  (uji dari editor). `M_Konfigurasi` mendapat baris `rekap_terakhir` (dibuat otomatis); nilai yang diawali "Gagal" ikut
  `beranda.peringatanSistem` dan butir `sistem` di `dashboard.perhatian`.
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
| 5 | Form Waste dan Suhu (layar isi, Data_Waste/Data_Suhu, waste mengurangi stock, Riwayat dan koreksi, PDF, email, tab Harian_Waste/Harian_Suhu, blok Waste dan Suhu di Dashboard) | Kode selesai (Code.gs v0.6, aplikasi 0.6.0; rumus sesuai lokalitas di Code.gs v0.6.1, butir 93), diuji dengan API tiruan dan Chromium. Rumus Sheet belum bisa diuji di sini. Foto bukti waste ditunda (butir 81). Menunggu pemilik: tempel Code.gs, jalankan `setupSpreadsheet`, deploy versi baru, uji dari HP |
| 6 | Prep List dan resep (Pengaturan → Resep, pengaman resep, form Prep List, Data_Prep/Data_PrepBahan, gerakan stock, koreksi jumlah resep, masa simpan di Beranda dan email, harga barang jadi dari resep, Riwayat, PDF, tab Harian_Prep, blok Prep List di Dashboard) | Kode selesai (Code.gs v0.7, aplikasi 0.7.0), diuji dengan API tiruan dan Chromium. Rumus Sheet belum bisa diuji di sini. Menunggu pemilik: tempel Code.gs, jalankan `setupSpreadsheet`, deploy versi baru, uji dari HP |
| 7 | Dashboard di aplikasi dan pengelolaan master (menu Dashboard dengan dua grafik SVG, nilai stock, Pengaturan → Item, Unit, Kategori dan satuan, Outlet dan jadwal lengkap, aturan menonaktifkan master, blok Nilai stock dan Kepatuhan serta grafik tiap blok di tab Dashboard) | Kode selesai (Code.gs v0.8, aplikasi 0.8.0), diuji dengan API tiruan (Code.gs di Node) dan Chromium pada delapan ukuran. Rumus dan grafik Sheet belum bisa diuji di sini. Perbaikan warna dan rumus tab Dashboard di Code.gs v0.8.1 (butir 118–121). Menunggu pemilik: tempel Code.gs, jalankan `setupSpreadsheet`, deploy versi baru, uji dari HP |
| 8 | Stock opname dan daftar belanja (layar Stock opname dari Dashboard, Data_Opname dan penyesuaian "Stock opname", laporan selisih PDF, opname di Riwayat, pengingat jadwal di Beranda/Dashboard/email, blok Stock opname di tab Dashboard, Daftar belanja di Laporan dengan PDF dan ringkasan di email) | Kode selesai (Code.gs v0.9, aplikasi 0.9.0), diuji dengan API tiruan (Code.gs di Node) dan Chromium pada delapan ukuran. Rumus dan grafik Sheet belum bisa diuji di sini. Menunggu pemilik: tempel Code.gs, jalankan `setupSpreadsheet`, deploy versi baru, uji dari HP |
| 9 | Form kustom (Pengaturan → Form, susun form dan pratinjau, jadwal form, M_Form/M_FormKolom, tab Data_K_<ID>, layar isi umum, Beranda, Riwayat dan koreksi, PDF umum, email, kolom Form kustom di blok Kepatuhan) | Kode selesai (Code.gs v0.10, aplikasi 0.10.0), diuji dengan API tiruan (Code.gs di Node) dan Chromium pada delapan ukuran. Rumus Sheet belum bisa diuji di sini. Menunggu pemilik: tempel Code.gs, jalankan `setupSpreadsheet`, deploy versi baru, uji dari HP |
| 10 | Rekap bulanan (PDF enam bagian Bagian 9.3, unduh dari menu Laporan untuk Pengelola, simpan ke Drive, email dan trigger tanggal 1, `kirimRekapSekarang`) dan pemeriksaan akhir terhadap kedua spesifikasi | Kode selesai (Code.gs v0.11, aplikasi 0.11.0), diuji dengan API tiruan (Code.gs di Node, 61 uji server), Chromium (28 uji alur termasuk iPhone, delapan ukuran) dan sapuan semua layar pada delapan ukuran (274 pemeriksaan) serta "kurangi gerak". Konversi PDF Google dan email asli belum bisa diuji di sini. Menunggu pemilik: tempel Code.gs, jalankan `pasangTrigger` dan `kirimRekapSekarang`, deploy versi baru, uji dari HP. setupSpreadsheet tidak perlu dijalankan ulang |
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
    Pengaturan hanya menampilkan bagian yang sudah dibangun (sejak Tahap 7: Staff dan PIN, Penerima email,
    Item, Resep, Unit, Kategori dan satuan, Outlet dan jadwal; sejak Tahap 9 juga Form, sesudah Penerima email).
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
    Daftar belanja dibangun di Tahap 8 (butir 124); Rekap bulanan di Tahap 10 (butir 143).
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

### Perbaikan rumus sesuai lokalitas spreadsheet (Code.gs v0.6.1)

93. **Rumus mengikuti lokalitas file.** Di spreadsheet berlokalitas desimal koma (misalnya Indonesia),
    rumus dari `setFormula` diurai dengan pemisah argumen `;`, desimal `,`, dan pemisah kolom array `\`,
    sehingga rumus bergaya en-US (koma) tampil `#ERROR!` "Error mengurai formula". Rumus di Code.gs tetap
    ditulis bergaya en-US; `setupSpreadsheet` menentukan gaya yang diterima file dengan rumus uji
    `=IF(TRUE,SUM(1.5,COLUMNS({1,2})),0)` di tab sementara (`deteksiGayaRumus_`, tab dihapus lagi), lalu
    semua rumus sel dan rumus format bersyarat ditulis lewat `rumusLokal_` / `ubahGayaRumus_` (teks dalam
    `"…"` dan nama tab dalam `'…'` tidak diubah). Lokalitas file tidak diubah. Rumus kotak info tab Harian
    (B3 Nama Outlet, B5 Tanggal) kini ditulis ulang setiap `setupSpreadsheet`, seperti A9; sel kotak info dan
    A9 hanya ditimpa jika kosong, berumus, bernilai galat (`#ERROR!` dan sejenisnya), atau berisi teks bawaan
    "Belum ada data." (`bolehDiberiRumus_`). Di akhir, `periksaSelRumus_` membaca kembali semua sel berumus di
    semua tab dan mencatat di log sel yang menampilkan `#ERROR!`, `#NAME?`, atau `#REF!` (atau "tidak ada
    yang …"). Rumus format bersyarat tidak bisa dibaca hasilnya oleh script, jadi tidak ikut diperiksa.

### Tahap 6

94. **Versi:** Code.gs v0.7, aplikasi 0.7.0 (`VERSI_APLIKASI` dan `VERSI` di sw.js).
95. **Satu resep per item hasil.** `M_Resep` satu baris per Item Hasil; bahan di `M_ResepBahan` dihubungkan lewat Item Hasil
    (tanpa ID resep). Karena itu "satu item hasil hanya punya satu resep aktif" berlaku dengan sendirinya: item yang sudah punya
    resep (aktif atau nonaktif) diubah lewat resep itu, dan Item Hasil resep yang sudah ada tidak bisa diganti. Jika baris ganda
    diisi tangan, baris yang aktif dipakai. Menyimpan resep menulis ulang baris `M_ResepBahan` item itu (baris item lain tetap,
    urutannya tidak berubah); master tidak dihapus, resep hanya dinonaktifkan. `M_Resep` dan `M_ResepBahan` masuk `KUNCI_MASTER`
    (kunci Item Hasil), jadi dirapikan `setupSpreadsheet` seperti butir 79. Resep yang dipakai Prep List: aktif, hasil > 0, dan
    punya bahan. Masa simpan: bilangan bulat 0–365 hari atau kosong. Bahan harus item aktif, tidak boleh ganda, tidak boleh item
    hasilnya sendiri.
96. **Resep melingkar** diperiksa server dari resep aktif (dengan resep yang disimpan sudah dipasang), saat menyimpan resep aktif
    dan saat mengaktifkan lagi. Pesan: "Sauce dasar sudah memakai Sauce bolognese sebagai bahan." dan untuk jalur panjang
    "..., lewat Sauce dasar." Resep nonaktif tidak ikut dihitung; mengaktifkan memeriksa lagi item dan bahan yang nonaktif.
97. **Item yang masih dipakai resep aktif** (sebagai bahan atau hasil) tidak bisa dinonaktifkan: aksi `aturItemAktif` (Pengelola)
    memeriksanya di server; sejak Tahap 7 dipakai Pengaturan → Item (butir 112). Resep yang memakai item nonaktif (misalnya
    dinonaktifkan di Sheet dengan tangan) ditandai "Perlu ditinjau" di Pengaturan → Resep.
98. **Harga barang jadi** (Bagian 5.3): Harga Satuan kosong dihitung dari harga bahan satu resep aktif dibagi hasil per resep
    (`lengkapiHargaResep_`, bahan barang jadi ikut dihitung dari resepnya; dibulatkan 2 angka di belakang koma). Jika ada bahan
    tanpa harga, harganya tetap kosong. Dipakai estimasi waste (`formWaste`, `kirimWaste`, tersalin ke `Data_Waste` saat dicatat)
    dan perkiraan biaya di Pengaturan → Resep. Penyesuaian stock tetap memakai Harga Satuan `M_Item` saja.
99. **Data_Prep:** satu baris per item. Item beresep: Jumlah Resep, Hasil per 1 Resep, Hasil, Baik Sampai (tanggal + masa simpan,
    kosong jika resep tanpa masa simpan), Qty kosong. Item tanpa resep: Qty saja (Hasil kosong, jadi stock tidak bergerak).
    `Data_PrepBahan`: satu baris per bahan per baris prep (Jumlah Resep, Qty per 1 Resep, Qty Terpakai, Satuan), `prep_row_id` =
    `row_id` baris `Data_Prep`, `submission_id` sama dengan kiriman prep. Resep yang dipakai: yang berlaku saat server menerima
    kiriman. Kiriman dari antrean ditolak (Gagal kirim) jika resep berubah keadaan: item beresep tanpa jumlah resep ("... sekarang
    punya resep") atau jumlah resep untuk item tanpa resep aktif. Urutan tab: tanggal terbaru, item, waktu kirim (PrepBahan: tanggal,
    item hasil, item bahan). Setelah ditulis, `hitungUlangStock_` untuk item hasil dan semua bahan mulai tanggal prep. Pemeriksaan
    (Tandai diperiksa, laporkan) hanya pada `Data_Prep`; status baris `Data_PrepBahan` tetap Terkirim.
100. **Stock bahan tidak cukup:** di HP, tiap bahan dibandingkan dengan stock tercatat pada tanggal itu (dari `formPrep`), dengan
    kebutuhan baris itu ditambah baris di atasnya yang memakai bahan yang sama ("Stock Tomat tercatat 1 kg, resep ini butuh 1,5
    kg." / "... isian ini butuh 2 kg bersama item di atasnya."). Server tidak menolak; jawabannya memuat bahan yang Stock Akhir-nya
    minus, ditulis di pesan setelah terkirim. Di Riwayat Prep, bahan yang Stock Akhir-nya minus pada tanggal itu ditulis merah
    dengan tanda "Stock Tomat minus"; rekap Stock tetap menandai minus seperti Tahap 3.
101. **Layar Prep List** (`#/prep`): Tanggal, Shift (wajib), "Tambah item" (lembar pencarian bersama `bukaPilihItem`, dipakai juga
    Pengaturan → Resep). Item beresep: tombol ½, 1, 1½, 2 dan kolom "Lain" untuk angka yang diketik, lalu Hasil, "Baik sampai 8 Okt"
    (tebal), Bahan, dan peringatan. Item tanpa resep: Qty dan "Tanpa resep: stock tidak bergerak." Keterangan opsional (200 huruf).
    HP dan tablet: satu kartu per item (semua terbuka, tidak diringkas seperti Waste); laptop/desktop: tabel (No, Item, Jumlah resep
    atau Qty, Hasil dan bahan, Baik sampai, Keterangan, hapus). Setelah terkirim, pesan di layar mengulang "Tulis di label wadah:
    Sauce bolognese baik sampai 8 Okt." (juga saat masuk antrean, dihitung di HP). Draft `draft:prep`, jawaban `cache:prep`
    (resep ikut tersimpan, jadi form bisa dibuka tanpa sinyal).
102. **Koreksi Prep** (Riwayat): Jumlah Resep untuk baris beresep, Qty untuk baris tanpa resep (kolom `jikaAda`: kolom kosong tidak
    tampil di kartu dan tidak bisa dikoreksi), dan Keterangan. Hasil dihitung ulang dari Hasil per 1 Resep yang tercatat di baris
    itu; baris `Data_PrepBahan` dihitung ulang dari Qty per 1 Resep yang tersalin (bukan resep sekarang), dicatat di
    `Log_Perubahan` (tab `Data_PrepBahan`), lalu stock item hasil dan bahan dihitung ulang mulai tanggal prep. Jumlah resep 0
    membatalkan gerakan stock (seperti butir 50). `setelahKoreksi` kini menerima `(baris, pengguna, kini)`.
103. **Masa simpan** (`masaSimpan_`): stock tercatat item pada tanggal itu dibagikan ke prep (Hasil > 0) mulai yang paling baru;
    bagian dari prep dengan Baik Sampai sebelum tanggal itu = "Lewat masa simpan", Baik Sampai sama dengan tanggal itu = "Habis
    besok" (hari ini hari terakhir baik dipakai, besok sudah tidak). Prep tanpa Baik Sampai ikut dihitung sebagai stock terbaru.
    Satu baris per item; tanggal "baik sampai" yang ditulis adalah yang terbaru di bagian itu. Beranda (semua role): di bawah
    pemberitahuan Pengelola, di atas baris antrean; tombol "Catat sebagai waste" menambah item itu ke draft Waste dengan kategori
    Expired terpilih (Qty dikosongkan) lalu membuka `#/waste`. Email harian: bagian "Prep list" dan "Masa simpan".
104. **Harian_Prep** (rumus A9): No, Item / Menu Prep, Nama Staff, Shift, Jumlah Resep, Hasil atau Qty, Satuan, Keterangan, urut
    waktu kirim, lalu Diisi oleh dan Diperiksa oleh. **Dashboard blok Prep List** (26 baris, `TINGGI_BLOK_PREP`): ringkasan periode
    B3 (catatan dan jumlah resep); total resep dan hasil per item per minggu (7 hari terakhir, 8–14, 15–21 hari lalu; hasil item
    tanpa resep = Qty; paling banyak 10 item); pemakaian bahan selama periode B3 (10 terbanyak: qty dan jumlah catatan); beban
    kerja per staff per shift (jumlah item prep). Nilai rupiah bahan terpakai menyusul di blok Nilai stock (Tahap 7).
105. **PDF Prep List:** No, Item / Menu Prep (bahan ditulis kecil di bawahnya), Nama Staff, Shift, Jumlah Resep, Hasil atau Qty,
    Satuan, Baik Sampai, Keterangan; kotak info "Jumlah item"; nama file `{tanggal}_Prep_list.pdf`.
106. **Pengaturan → Resep** (`#/pengaturan/resep`, `#/pengaturan/resep-baru`, `#/pengaturan/resep/<item>`): daftar "Sauce
    bolognese, 5 liter" (jumlah bahan, masa simpan, harga per satuan hasil; tanda Nonaktif dan Perlu ditinjau). Layar ubah: item
    hasil (baru: pilih dari item aktif yang belum punya resep), hasil per 1 resep, masa simpan, bahan (qty dan satuan otomatis),
    perkiraan biaya yang dihitung langsung dari harga item, catatan "Perubahan berlaku untuk prep berikutnya. Catatan lama tidak
    berubah.", dan kartu Keadaan resep (Nonaktifkan dengan konfirmasi / Aktifkan lagi). Draft per resep `draft:resep:<item>` atau
    `draft:resep:+baru`; jawaban `cache:resep`. Butuh sinyal untuk menyimpan.

### Tahap 7

107. **Versi:** Code.gs v0.8, aplikasi 0.8.0 (`VERSI_APLIKASI` dan `VERSI` di sw.js).
108. **Menu Dashboard** (`#/dashboard`, aksi `dashboard`, satu panggilan; jawaban terakhir di `cache:dashboard`). Tanggal = tanggal
    perangkat (tidak boleh lewat hari ini menurut server). Angka ringkas berupa enam ubin: Form terisi (x dari y, aturan Bagian 5.8),
    Belum diperiksa (kiriman, 31 hari seperti Beranda), Suhu di luar standar (pengecekan hari ini, termasuk cek ulang), Di bawah stok
    minimum (item aktif), Total waste (Rp hari ini), dan Nilai stock (ketuk: lembar per kategori, total, dan daftar "Belum punya
    harga" yang membuka item itu di Pengaturan). "Satu baris" berlaku di desktop; HP dua kolom, tablet tiga kolom (lebar 320 px
    tidak muat enam ubin). Tombol "Stock opname" (Bagian 5.6) sejak Tahap 8 (butir 123).
109. **Perlu perhatian** disusun server (`perhatianDashboard_`), urut tingkat: Masalah (unit yang pengecekan terakhirnya hari ini
    masih di luar standar, Stock Akhir minus, lewat masa simpan, laporan/cadangan gagal), Perlu ditinjau (baris dilaporkan keliru,
    permintaan reset PIN, di bawah stok minimum dengan saran order, habis besok, jadwal yang menunggu `pasangTrigger`), Menunggu
    (form wajib belum lengkap, isian belum diperiksa, item belum punya harga). Suhu yang sudah dibereskan dengan cek ulang normal
    tidak masuk daftar (tetap terlihat di grafik). Ketukan: suhu → `#/suhu`; minus dan di bawah minimum → lembar daftar item yang
    membuka riwayat per item (Sesuaikan stock); masa simpan → lembar dengan "Catat sebagai waste"; laporan dan belum diperiksa →
    Riwayat dengan filter (seperti Beranda); reset PIN → layar PIN; form belum lengkap → Beranda; jadwal → Outlet dan jadwal; tanpa
    harga → lembar nilai stock.
110. **Grafik** (SVG buatan sendiri, tanpa animasi, ringkasan teks di atasnya). Waste: `viewBox` 700×120 dengan
    `preserveAspectRatio="none"` (hanya persegi, jadi tidak terdistorsi), batang Biru Malam, hari tanpa nilai rupiah tidak punya
    batang (hari yang punya waste tetapi harganya kosong: tanpa batang, detail "harga item belum diisi"); tujuh tombol transparan
    menutupi kolom dan nama hari (lebar sasaran ±41 px di layar 320 px, lebih kecil dari 44 px karena tujuh kolom; tingginya 148 px);
    ketukan menandai kolom (latar Baja) dan menulis tanggal, nilai, dan jumlah catatan. Suhu: unit aktif (urutan `M_Unit`) ditambah
    unit nonaktif yang punya isian hari itu; pita normal (latar Baik, tepi Baik) di jalur garis; titik lingkaran Biru Malam, di luar
    standar segitiga Masalah, memakai status yang tersimpan; skala Chiller batas ± 4 °C, Freezer batas −12 sampai +4 (−30 sampai −14);
    di luar skala ditaruh di tepi. Penanda adalah SVG kecil yang diletakkan dengan `left: %` (lingkaran tidak gepeng). Di bawah
    480 px pita turun ke baris kedua. Ketuk baris: daftar jam, suhu, status, pengisi, dan tindakan.
111. **Nilai stock** (`nilaiStock_` dan blok Nilai stock di Sheet, cara hitung sama): Stock Akhir terkini × Harga Satuan di `M_Item`
    sekarang. Dihitung: item aktif, dan item nonaktif yang stock-nya belum nol. Item tanpa harga tidak dihitung dan didaftar terpisah.
    Harga barang jadi dari resep (butir 98) tidak dipakai di sini supaya aplikasi dan Sheet sama; barang jadi tanpa harga muncul di
    daftar "belum punya harga". Stock minus ikut dihitung apa adanya (nilainya minus). Nilai bahan terpakai (hanya di Sheet) =
    (Stock Keluar + Dipakai Prep) × harga, untuk item yang tidak punya baris aktif di `M_Resep`, dalam periode B3.
112. **Pengaturan → Item** (`#/pengaturan/item`, `-baru`, `/<nama>`): daftar per kategori (urutan kategori) lalu kelompok Nonaktif,
    dengan pencarian; tanda Nonaktif, Belum punya harga, Kategori nonaktif. Layar ubah: nama, kategori dan satuan dasar (`<select>`;
    pilihan nonaktif hanya tampil jika itu nilai sekarang), sakelar "Datang dalam kemasan besar" (`role=switch`, kata Ya/Tidak) dengan
    kalimat "1 [dus] berisi [12] botol", harga (2 angka di belakang koma), stok minimum, stok maksimum. Draft `draft:item:<nama>` /
    `draft:item:+baru`, jawaban `cache:item`. Nama hanya bisa diganti selama item belum punya catatan stock (Stock_Harian, semua
    sumber gerakan termasuk prep tanpa resep, Data_Opname) dan belum dirujuk resep apa pun; satuan dasar terkunci setelah ada
    catatan stock (keduanya tampil terkunci berlatar Baja; server juga menolak). Isian yang belum diketik digambar ulang dengan data
    server. Kartu Stock (stock hari ini, "Riwayat stock" → lembar riwayat per item dan Sesuaikan stock) dan kartu Keadaan item:
    Nonaktifkan dengan konfirmasi (stock belum nol: peringatan Perlu ditinjau di konfirmasi, tetap boleh), atau keterangan "Tidak
    bisa dinonaktifkan: masih dipakai resep …" dengan tombol Buka resep. Setelah item baru tersimpan, layar item itu terbuka dengan
    lembar "Isi stok pembuka sekarang?" (Nanti / Isi stok pembuka) yang membuka Sesuaikan stock (tanggal hari ini) dengan alasan
    Stok pembuka sudah terpilih. Item baru langsung aktif, ditulis lewat `tambahBarisMaster_` (butir 79; `M_Item`, `M_Kategori`,
    `M_Unit` kini juga di `KUNCI_MASTER` dan ikut dirapikan setupSpreadsheet).
113. **Kategori dan satuan** (`#/pengaturan/kategori`): kategori dengan tombol naik/turun (urutan lokal, lalu "Simpan urutan"
    menulis Urutan 1..n untuk semua kategori; ditolak jika daftar berubah); kategori baru di urutan terakhir. Satuan dikelompokkan per
    jenis. Nama kategori dan satuan hanya bisa diganti selama belum dipakai item (huruf besar/kecil selalu boleh di server). Kategori
    atau satuan (dasar maupun besar) yang masih dipakai item aktif tidak bisa dinonaktifkan, supaya item tidak hilang dari form
    tanpa disadari. Ubah dan keadaan lewat lembar.
114. **Unit** (`#/pengaturan/unit`): daftar menurut urutan `M_Unit` (unit baru di bawah; tidak ada pengatur urutan), ubah lewat
    lembar. Nama terkunci setelah unit punya catatan di `Data_Suhu`; tipe boleh diganti (catatan lama menyimpan tipe dan statusnya).
    Unit nonaktif tidak tampil di form Suhu dan tidak dihitung kelengkapan.
115. **Outlet dan jadwal** kini lengkap: nama outlet, zona waktu (WIB/WITA/WIT, ditambah zona tersimpan dan zona perangkat bila
    berbeda; juga dipasang sebagai zona spreadsheet), jam closing (`<input type=time>`), jeda laporan (menit 0–240, dengan perkiraan
    jam laporan), jadwal stock opname (mingguan/bulanan; dipakai Tahap 8), hari cadangan, keluar otomatis. Satu tombol Simpan,
    hanya field yang berubah dikirim. Mengubah zona waktu, jam closing, jeda, atau hari cadangan mengisi `M_Konfigurasi`
    `pasang_trigger` = "Perlu dijalankan …"; selama itu Beranda dan Dashboard Pengelola menampilkan peringatan dan layar ini menulis
    "Jadwal sudah diubah, tetapi trigger belum dipasang ulang…". `pasangTrigger` menulis "Terpasang …" sehingga peringatan hilang.
116. **Tab Dashboard di Sheet.** Pemilih periode B3 sudah ada (7 hari, 30 hari, Bulan berjalan). Baru: blok **Nilai stock**
    (20 baris, `TINGGI_BLOK_NILAI`: ringkasan nilai, jumlah tanpa harga, dan bahan terpakai; per kategori nilai stock dan bahan
    terpakai, 15 baris; daftar item belum punya harga, 15 baris), blok **Kepatuhan** (36 baris: satu baris per hari periode B3,
    lama ke baru, status Stock/Suhu/Prep list/Waste menurut Bagian 5.8 — Suhu "x dari y" dengan unit aktif sekarang, form yang
    disembunyikan "–" — jumlah form belum lengkap, kiriman belum diperiksa, baris dilaporkan keliru; judul kolom form dari `M_Form`;
    form kustom menyusul di Tahap 9), dan ringkasan **Keadaan item** di G7:H10 blok Stock. **Grafik** (EmbeddedChart, kolom J, di
    kanan tabel bloknya, dibuat ulang setiap setupSpreadsheet menurut judulnya): Keadaan item stock (pai, warna makna status),
    Nilai stock per kategori (batang), Estimasi kerugian waste per bulan (kolom), Rata-rata suhu per unit 7 hari terakhir (garis,
    baris dan kolom ditukar), Jumlah resep per item 7 hari terakhir (batang), Kepatuhan per hari (kolom). Blok Stock opname dan
    grafiknya sejak Tahap 8 (butir 126). Rumus ditulis gaya en-US lewat `rumusLokal_`; operasi larik di dalam LET dibungkus ARRAYFORMULA.
117. **Uji Tahap 7** (di luar repo): Code.gs dijalankan di Node dengan tiruan SpreadsheetApp/Utilities/Properties/Lock/Charts
    (24 uji server: master, aturan nonaktif, nilai stock, Perlu perhatian, grafik, outlet dan jadwal, penolakan Staff, rumus
    seimbang dan bisa diubah ke gaya titik koma), dan frontend di Chromium dengan API tiruan yang memanggil `doPost` asli (16 uji
    alur dan delapan ukuran layar Bagian 4.6 tanpa gulir ke samping, teks terpotong, atau galat konsol).

### Perbaikan tab Dashboard di Sheet (Code.gs v0.8.1, 5 Oktober 2026)

118. **Versi:** Code.gs v0.8.1; aplikasi tetap 0.8.0 (frontend tidak berubah). Yang berubah hanya yang dijalankan
    `setupSpreadsheet`, jadi cukup tempel Code.gs dan jalankan `setupSpreadsheet`; deploy versi baru tidak wajib.
119. **Isi blok Dashboard polos.** `insertRowsBefore` memberi baris baru format baris di posisi sisip, yaitu baris judul blok
    berikutnya (latar navy, kolom A putih tebal), sehingga isi blok yang diberi ruang tampil navy dan tidak terbaca (terlihat di
    sheet pemilik). `ruangBlokDashboard_` dan `pasangBlokStockDashboard_` kini memanggil `polosIsiBlokDashboard_` setiap
    `setupSpreadsheet`: baris di bawah judul blok sampai sebelum judul blok berikutnya (kolom A–H) kembali tanpa latar, warna teks
    bawaan, dan tidak tebal; gaya baris ringkasan dan baris judul tabel dipasang lagi sesudahnya oleh fungsi bloknya. Format angka
    dan format bersyarat tidak disentuh. Dashboard yang sudah terlanjur navy pulih saat `setupSpreadsheet` dijalankan ulang. Blok
    Stock opname (belum dibangun) tidak disentuh.
120. **Dua aturan rumus Sheet**, dari galat di sheet pemilik. (a) `XLOOKUP(1,(…)*(…),…)` di luar ARRAYFORMULA tidak menghitung
    syarat gandanya sebagai larik dan hasilnya #N/A; rekap satu item pada satu tanggal kini dicari dengan
    `IFERROR(INDEX(FILTER(kolom,shI=x,shT=tgl),1),0)` (rumus `Harian_Stock`, blok Stock Inventory, `letNilaiStock_`). (b) Nama di
    LET dan LAMBDA tidak membedakan huruf besar dan kecil: `ku`/`kU`, `st`/`sT`, dan `ua`/`uA` membuat rumus #NAME? (tabel per
    kategori blok Nilai stock, tabel blok Kepatuhan). Nama pengganti: `katAda`, `urut`, `katUrut`, `stForm`, `unitAktif`. Rumus
    baru harus bebas dari kedua pola itu. `periksaSelRumus_` hanya membaca sel berumus, jadi galat di sel hasil limpahan
    (misalnya #N/A di kolom Stock Akhir) tidak tercatat di log.
121. **Uji v0.8.1** (di luar repo): fungsi pemasang tab Dashboard dan Harian dijalankan di Node dengan tiruan Sheet yang meniru
    pewarisan format `insertRowsBefore`, pada tata letak Tahap 0, tata letak sekarang, dan sheet yang sudah terlanjur navy: tidak
    ada sel isi blok berformat judul, judul blok dan format angka tetap, tidak ada penyisipan saat dijalankan ulang, 46 rumus
    seimbang dan tanpa nama ganda. Hasil rumus di Google Sheets tetap belum bisa diuji di sini.

### Tahap 8

118. **Versi:** Code.gs v0.9, aplikasi 0.9.0 (`VERSI_APLIKASI` dan `VERSI` di sw.js).
119. **Layar Stock opname** (`#/opname`, khusus Pengelola, dibuka dari tombol "Stock opname" di Dashboard, pengingat di Beranda, atau
    butir Perlu perhatian). Tanggal opname = hari ini menurut HP (tidak ada pilihan tanggal; server menolak tanggal masa depan).
    Kategori: "Semua kategori" (bawaan; item dikelompokkan dengan judul kategori) atau satu kategori aktif. Item: aktif di kategori
    aktif, urut kategori lalu nama. HP/tablet kartu ("Tercatat 8,5" dan kolom Hitung), laptop/desktop tabel (No, Nama Item, Tercatat,
    Hitung, Selisih, Satuan). Selisih tampil saat diketik: bukan nol tanda Perlu ditinjau ("Selisih −0,5 kg"), nol tanda Baik "Sesuai".
    Hitungan per item disimpan di draft `draft:opname` (kategori, hitung per nama item huruf kecil, submissionId); hitungan kategori
    lain tetap di draft saat kategori diganti, tetapi yang dikirim hanya item yang tampil. "Lanjut" membuka ringkasan (item dihitung,
    berselisih, total nilai dari harga di HP, daftar item berselisih) dengan "Kembali" dan "Simpan opname". Menyimpan butuh sinyal (tidak
    masuk antrean); gagal sambungan: hitungan tetap di draft, kirim ulang memakai submissionId yang sama. Sesudah tersimpan: "Opname
    tersimpan. 3 item diluruskan.", item yang stock tercatatnya berubah sejak layar dibuka disebut (pesan info), hasil dari server, dan
    "Unduh laporan selisih"; draft dihapus. Jawaban `formOpname` terakhir di `cache:opname`.
120. **Simpan opname di server** (`aksiSimpanOpname_`): stock tercatat = Stock Akhir pada tanggal opname SAAT disimpan (`posisiStock_`).
    Semua item yang dihitung (termasuk yang sesuai) satu baris di `Data_Opname` (Kategori, Satuan, Nilai Selisih = selisih × Harga
    Satuan `M_Item`, kosong jika harga kosong; harga barang jadi dari resep tidak dipakai, sama dengan penyesuaian). Item berselisih juga
    satu baris `Data_Penyesuaian` beralasan "Stock opname" dengan `submission_id` yang sama, lalu `hitungUlangStock_` mulai tanggal opname,
    sehingga Stock Akhir hari itu = hasil hitung. "Stock opname" bukan pilihan alasan di lembar Sesuaikan stock. Hitungan minus atau
    bukan angka ditolak; item yang sama dua kali ditolak; item yang tidak ada di `M_Item` ditolak. Satu opname = satu `submission_id`.
    `Data_Opname` diurutkan tanggal terbaru, kategori, item, waktu.
121. **Riwayat Stock:** satu baris "Stock opname" per opname pada tanggalnya ("3 item dihitung, 1 berselisih, nilai selisih Rp −45.000");
    baris `Data_Penyesuaian` beralasan "Stock opname" tidak tampil terpisah (sudah terwakili opname). Pengelola mengetuknya untuk lembar
    rincian (semua item yang dihitung) dengan "Unduh laporan selisih". Filter kategori/item menyaring baris opname seperti sebelumnya.
122. **Laporan selisih PDF** (dibuat saat diunduh, tidak disimpan ke Drive dan tidak ikut email): judul "Laporan Selisih Stock Opname",
    kotak info Kategori (nama atau "n kategori"), Item dihitung, Item berselisih; tabel No, Nama Item, Stock Tercatat, Hasil Hitung,
    Selisih (bertanda +), Satuan, Nilai Selisih (Rp), dikelompokkan per kategori jika lebih dari satu, baris total; "Dihitung oleh"
    menggantikan Diisi/Diperiksa oleh. Nama file `{YYYY-MM-DD}_Selisih_opname_{HHmm}.pdf` (jam opname). `htmlLaporan_` kini menerima
    `isi.judul` dan `isi.bawah` untuk laporan yang bukan form harian.
123. **Jadwal opname:** lewat jika belum pernah ada opname, atau hari sejak opname terakhir lebih dari 7 (mingguan) atau 31 (bulanan);
    nilai `jadwal_opname` lain dibaca mingguan. Opname terakhir = tanggal terbaru di `Data_Opname`. Pengingat: Beranda Pengelola (di
    bawah pemeriksaan: "Stock opname terakhir 9 hari lalu." atau "Belum ada stock opname.", ketuk membuka Stock opname), Dashboard
    (butir Perlu ditinjau; di samping tombol Stock opname "Terakhir 3 Okt (3 hari lalu)", bertanda Perlu ditinjau jika lewat), dan email
    harian (bagian "Untuk Head Kitchen dan Manager").
124. **Daftar belanja** (kartu kedua di menu Laporan, khusus Pengelola; `cache:belanja`): item aktif dengan Stock Akhir hari ini di bawah
    Stok Minimum, per kategori (urutan `M_Kategori`), nama abjad. Baris: nama, "Stock 4 botol · minimum 6 botol", "Saran 2 dus (24 botol)"
    atau "Tanpa saran: stok maksimum kosong", dan kolom Order dalam satuan order (satuan besar jika item punya, dengan konversi
    "= 24 botol"). Saran = pembulatan ke atas (Stok Maksimum − Stock Akhir) / isi satuan besar (`saranOrderAngka_`, juga dipakai
    `saranOrder_` untuk email dan Dashboard). Jumlah yang diubah hanya ada di memori layar dan dikirim sebagai `order` saat "Unduh PDF"
    (yang tidak diubah memakai saran, kosong dicetak "–"; mengubah angka mengembalikan tombol iPhone ke "Unduh PDF"). PDF "Daftar Belanja":
    No, Nama Item, Stock Sekarang, Stok Minimum, Order per kategori; catatan jumlah yang diubah; "Dicetak oleh"; nama file
    `{YYYY-MM-DD}_Daftar_belanja.pdf`. Kosong: "Semua stock di atas batas minimum." dan tombol nonaktif. Email harian: subjudul stock
    menjadi "Daftar belanja: n item di bawah stok minimum" dengan saran ordernya (item tanpa saran ditulis begitu).
125. **`unduhPdf(opsi)`** menerima `opsi.teks` (teks tombol, bawaan "Unduh PDF"; dipakai "Unduh laporan selisih"); aturan iPhone tetap sama.
126. **Blok Stock opname di tab Dashboard** (15 baris, `TINGGI_BLOK_OPNAME`, disisipkan sekali sebelum blok Waste): ringkasan (opname
    terakhir yyyy-mm-dd dan berapa hari lalu, jumlah opname dan total nilai selisih dalam periode B3, atau "Belum ada stock opname.");
    tabel per opname dalam periode (10 terbaru, urut lama ke baru: tanggal, item dihitung, item berselisih, nilai selisih); 10 item paling
    sering berselisih dalam periode (berapa kali, total nilai selisih). Grafik kolom "Nilai selisih tiap opname" di kolom J (Dashboard
    kini 7 grafik).
127. **Uji Tahap 8** (di luar repo): 23 uji server (opname sebagian, selisih plus/minus, Stock Akhir = hasil hitung, barang masuk di antara
    membuka dan menyimpan, kiriman ulang, validasi, jadwal mingguan/bulanan, Riwayat, PDF, saran 20/12 → 2 dus, tanpa stok maksimum,
    email, penolakan Staff, rumus seimbang), 16 uji alur Chromium (termasuk iPhone dengan lembar bagikan tiruan), dan delapan ukuran
    Bagian 4.6; uji Tahap 7 tetap lulus.

### Tahap 9

128. **Versi:** Code.gs v0.10, aplikasi 0.10.0 (`VERSI_APLIKASI` dan `VERSI` di sw.js). `VERSI_KODE` di Code.gs masih tertulis
    `v0.8.1` sejak Tahap 8 (baris pertama sudah v0.9); kini keduanya v0.10.
129. **Kolom baru di master** (ditambahkan `setupSpreadsheet` di kanan): `M_Form` `Hari` (nama hari dipisah koma, untuk jadwal
    "hari tertentu") dan `Diarsipkan` (waktu); `M_FormKolom` `ID Kolom`. `M_FormKolom` masuk `KUNCI_MASTER` (kunci ID Form) dan ikut
    dirapikan. Selama kolom itu belum ada, Pengaturan → Form menulis "pemilik Sheet perlu menjalankan ulang setupSpreadsheet" dan
    server menolak membuat form kustom; menyembunyikan, mengurutkan, dan mengganti nama form bawaan tetap bisa.
130. **Tampil, sembunyi, dan hapus.** `Aktif` di `M_Form` = tampil di Beranda. Form yang disembunyikan (bawaan atau kustom) tidak
    punya tiket, tidak ditagih, tidak bisa ditandai nihil, dan layar isinya menolak dibuka ("sedang disembunyikan"), tetapi tetap ada
    di pilihan Riwayat dan Laporan, dan kiriman dari antrean tetap diterima. Hapus form kustom = arsip: `Diarsipkan` diisi waktu,
    form hilang dari Beranda, Riwayat, Laporan, dan email; tab datanya tetap dengan tanda arsip (warna tab Garis dan catatan "ARSIP:
    …" di sel A1). "Pulihkan" (bagian "Form yang dihapus" di daftar form) mengosongkan `Diarsipkan`, menaruh form di urutan terakhir
    dengan keadaan tampil seperti sebelum dihapus, dan ditolak jika sudah ada 10 form kustom atau nama yang sama. Form bawaan tidak
    bisa dihapus. Kolom yang dihapus tidak bisa dipulihkan dari aplikasi (buat kolom baru dengan label lain).
131. **ID form kustom** dibuat dari nama saat form dibuat ("Checklist kebersihan" → `CHECKLIST_KEBERSIHAN`, huruf A–Z, angka, dan
    `_`, paling panjang 20, diberi `_2` dan seterusnya jika sudah dipakai) dan tidak berubah lagi, jadi tab `Data_K_<ID>` tetap
    bernama sama walau form diganti nama. Nama form unik (huruf besar/kecil tidak dibedakan) di antara semua form, termasuk yang
    diarsipkan, paling panjang 40 huruf; keterangan paling panjang 120.
132. **Susunan kolom.** Batas diperiksa server: 10 form kustom yang belum dihapus dan 15 kolom aktif (kepala + baris) per form.
    Minimal satu kolom baris (form tanpa baris tidak didukung; checklist cukup satu baris). Label unik per form termasuk kolom yang
    sudah dihapus (kolomnya masih ada di tab), paling panjang 40, tidak boleh `Tanggal`, `Nama Staff`, `No`, atau nama kolom sistem.
    Pilihan: 2–20, masing-masing paling panjang 40, disimpan dipisah ` | ` di `M_FormKolom`. Kolom tidak bisa dipindah antara kepala
    dan baris. Jenis kolom yang sudah ada tidak bisa diganti setelah form punya isian (kiriman di tab datanya); sebelum itu boleh.
    Kolom baru diberi ID `K<n>`. Kolom yang tidak dikirim lagi oleh layar susun menjadi `Aktif` kosong (dihapus = disembunyikan).
133. **Tab `Data_K_<ID>`** dibuat saat form disimpan pertama kali, tepat sesudah tab Data terakhir: `Tanggal`, `Nama Staff`, kolom
    kepala, `No` (nomor baris dalam satu kiriman), kolom baris, lalu 13 kolom sistem (dilipat), dengan format, filter, proteksi, dan
    warna berselang yang sama dengan tab Data lain. Judul kolom = label. Kolom baru disisipkan tepat sebelum kolom sistem (isian lama
    kosong di situ). Mengganti label menulis ulang judul kolom di tab itu dan nama kolom di `Log_Perubahan` untuk tab itu, supaya
    jejak koreksinya tetap terbaca. Kolom Angka berformat angka, lainnya teks. Urutan tab: tanggal terbaru, waktu kirim, No.
    `setupSpreadsheet` membuat atau melengkapi tab semua form kustom (juga yang diarsipkan) dan menaruhnya di kelompok tab Data. Gaya
    rumus (butir 93) dicatat di Script Property `GAYA_RUMUS`, supaya aplikasi bisa memasang warna berselang tanpa tab uji.
134. **Nilai isian** (sama di HP, kiriman, dan koreksi): Teks paling panjang 200 (diawali `=`, `+`, `-`, `@` diberi kutip); Angka 0
    atau lebih (butir 35, tanpa minus); Pilihan dan Ya/Tidak salah satu pilihannya (disimpan "Ya"/"Tidak"); Item nama di `M_Item`
    (di HP dipilih lewat lembar pencarian, satuannya tampil di samping; di Sheet hanya nama item); Jam `hh:mm` (boleh diketik "7.05").
    Kosong selalu boleh untuk kolom tidak wajib. Baris yang semua kolomnya kosong tidak dikirim; minimal satu baris berisi. Pesan:
    "Pilih Area.", "Isi Butir di baris 2.", "Isi minimal satu baris.". Nilai kolom yang sudah dihapus tetap ditulis jika datang dari
    antrean; kolom wajib diperiksa dengan definisi saat server menerima kiriman.
135. **Jadwal dan penagihan** (Bagian 5.8, `wajibPada_`): form bawaan yang tampil selalu ditagih; form kustom "Setiap hari" setiap
    hari, "Hari tertentu" hanya pada hari yang dipilih (menurut tanggal isian), "Sewaktu-waktu" tidak pernah. Form yang tidak ditagih
    tetap punya tiket (bisa diisi kapan saja) tanpa ruas rel; tiketnya menulis "Sewaktu-waktu" atau "Tidak dijadwalkan hari ini"
    (bukan "Belum diisi") selama belum ada isian. Email harian: "Tidak ada isian (sewaktu-waktu, tidak ditagih)" / "(tidak dijadwalkan
    hari ini)", tanpa warna merah. Lampiran email juga untuk form kustom yang terkirim.
136. **Layar isi form kustom** (`#/form/<ID>`): Tanggal (aturan Bagian 5.0), kolom kepala di kotak info, status kiriman dan "Tidak ada
    hari ini", lalu baris: kartu "Baris 1, 2, …" (HP satu kolom, tablet dua) atau tabel (No, kolom baris, hapus) di laptop/desktop.
    Label kolom wajib diberi "(wajib)". Pilihan ≤ 4 tombol berjajar, > 4 dropdown. Bilah bawah: penghitung "2 dari 3 baris lengkap",
    "Tambah baris", dan "Kirim <nama form huruf kecil>". Sesudah terkirim, baris dikosongkan dan kolom kepala tetap (seperti shift di
    Waste). Draft `draft:kustom:<ID>` (tanggal, kepala, baris per ID kolom, submissionId); jawaban `formKustom` di `cache:kustom:<ID>`
    sehingga form yang pernah dibuka bisa diisi tanpa sinyal; tanpa sinyal dan belum pernah dibuka: "Form ini belum pernah dibuka di
    HP ini…". Antrean dan kiriman ganda memakai pola yang sama dengan form lain (aksi `kirimKustom`).
137. **Pengaturan → Form** (`#/pengaturan/form`, `-baru`, `/<ID>`): daftar semua form dalam urutan Beranda (nama, tanda
    Bawaan/Kustom, jadwal dan jumlah kolom, sakelar Tampil/Disembunyikan yang langsung tersimpan, tombol naik/turun lalu "Simpan
    urutan" seperti kategori), "Buat form" (hilang jika sudah 10), "n dari 10 form kustom dipakai", dan "Form yang dihapus". Layar
    susun: nama, keterangan, jadwal (Setiap hari / Hari tertentu dengan tujuh tombol hari / Sewaktu-waktu), sakelar tampil, kolom
    kepala, kolom baris (menu titik tiga: Ubah, Geser ke atas/bawah, Hapus kolom dengan konfirmasi), lembar kolom (label, jenis enam
    tombol, pilihan satu per baris, sakelar Wajib), "Lihat pratinjau" (lembar/dialog lebar berisi layar isi yang sama persis; Kirim
    hanya memeriksa isian dan menulis bahwa ini pratinjau), "Simpan form" ("Form tersimpan dan sudah tampil di Beranda."), dan "Hapus
    form" (konfirmasi Bagian 5.7). Perubahan kolom baru tersimpan saat "Simpan form". Form bawaan: nama dan sakelar tampil saja,
    daftar kolomnya ditampilkan terkunci. Draft `draft:form:<ID>` / `draft:form:+baru`; `cache:form-daftar`, `cache:form:<ID>`.
138. **Riwayat, koreksi, dan PDF form kustom.** `defRiwayat_` membentuk definisi dari `M_FormKolom` (`defRiwayatKustom_`): kolom kepala
    tampil di kepala kiriman (tidak dikoreksi; kepala yang salah dilaporkan lewat baris), kolom baris bisa dikoreksi Pengelola dengan
    aturan nilai butir 134 (kolom tidak wajib boleh dikosongkan; Pilihan dan Ya/Tidak lewat tombol; Jam pemilih waktu; Item diketik
    sesuai nama di daftar item), tercatat di `Log_Perubahan`. Kolom yang sudah dihapus tampil "Label (dihapus)" hanya di baris yang
    berisi dan tidak bisa dikoreksi. Kolom pertama (Item, atau Teks) menjadi nama baris; nilai lamanya kini juga ditulis dicoret
    (perbaikan bersama `gambarDetailKiriman`). Filter Kategori dan Item tersedia jika form punya kolom Item. PDF umum
    (`laporanPdf_`, `isiPdfKustom_`): judul = nama form, kotak info (Keterangan, Jumlah isian, Jumlah baris), tabel No, Nama Staff,
    Jam, kolom kepala, kolom baris (kolom yang dihapus hanya jika berisi pada tanggal itu), Diisi oleh dan Diperiksa oleh; nama file
    `{tanggal}_{Nama_form}.pdf`.
139. **Blok Kepatuhan di tab Dashboard**: kolom I "Form kustom" ("Terkirim", "1 dari 2", atau "–" jika tidak ada form kustom yang
    ditagih hari itu) dan form kustom ikut dihitung di Form belum lengkap, Isian belum diperiksa, dan Baris dilaporkan keliru. Tab
    `Data_K_<ID>` dibaca lewat `INDIRECT` dari daftar form kustom yang tampil dan belum dihapus di `M_Form` (kolom dicari menurut
    judulnya), jadi form yang dibuat dari aplikasi langsung ikut tanpa menjalankan `setupSpreadsheet`. Nama LET diawali `kf`/`ku`
    (butir 120).
140. **Uji Tahap 9** (di luar repo): Code.gs dijalankan di Node dengan tiruan SpreadsheetApp/Utilities/Properties/Drive/Mail (12 uji
    server: buat form tiga kolom dan tabnya, kirim dan kiriman ganda, Riwayat, PDF, laporkan, koreksi dengan log, diperiksa dan buka
    kunci, tambah/ganti label/hapus kolom setelah ada isian, jenis terkunci, batas 10 form dan 15 kolom, jadwal hari tertentu dan
    sewaktu-waktu di Beranda dan email, Item dan Jam, arsip dan pulihkan, sembunyikan Waste, urutan, penolakan Staff, setupSpreadsheet
    ulang dan rumus seimbang), lalu frontend di Chromium dengan API tiruan yang memanggil `doPost` asli (8 uji alur termasuk pratinjau,
    antrean tanpa sinyal, unduh PDF dari Riwayat dan Laporan, Staff tanpa menu Pengaturan; delapan ukuran Bagian 4.6 untuk daftar
    form, susun form, pratinjau, lembar kolom, form bawaan, dua layar isi, dan Beranda; uji regresi layar lama).

### Tahap 10

141. **Versi:** Code.gs v0.11 (`VERSI_KODE` juga), aplikasi 0.11.0 (`VERSI_APLIKASI` dan `VERSI` di sw.js). Tidak ada tab, kolom,
    atau rumus Sheet baru, jadi `setupSpreadsheet` tidak perlu dijalankan ulang. Baris `rekap_terakhir` di `M_Konfigurasi` dibuat
    otomatis saat rekap pertama berjalan (seperti `laporan_terakhir`).
142. **Isi rekap bulanan** (`dataRekapBulan_`, satu kali baca per tab; `isiPdfRekap_`; judul "Rekap Bulanan September 2026", kotak
    info Nama Outlet, Bulan, Periode). Bulan berjalan: data sampai hari ini, Periode "1–6 Oktober 2026 (bulan berjalan)";
    kelengkapan form dan pengecekan terlewat dinilai sampai kemarin. Bulan masa depan ditolak; bulan tanpa isian sama sekali tetap
    menghasilkan PDF dengan "Keterangan: Belum ada isian pada bulan ini." dan kalimat kosong di tiap bagian.
    - **Stock:** satu baris per kategori (urutan `M_Kategori`): item bergerak, Masuk, Bahan terpakai, Penyesuaian, dan Nilai stock
      akhir bulan, semuanya dalam rupiah, ditambah baris total. Satuan item berbeda-beda, jadi jumlah per kategori hanya bermakna
      sebagai nilai. Nilai = jumlah (dari rekap `Stock_Harian` bulan itu) × Harga Satuan **sekarang**, sama dengan nilai stock di
      Dashboard. Bahan terpakai = (Stock Keluar + Dipakai Prep) × harga untuk item tanpa resep aktif (Bagian 8.5, butir 111).
      Penyesuaian termasuk hasil stock opname. Nilai stock akhir bulan = `nilaiStock_` pada tanggal terakhir. Kategori yang semua
      itemnya belum punya harga ditulis "–"; nama item tanpa harga (yang bergerak atau stock-nya bukan nol) disebut di catatan.
    - **Stock opname:** satu baris per opname (tanggal, dihitung oleh, item dihitung, item berselisih, nilai selisih yang tercatat
      di `Data_Opname`), urut lama ke baru, dengan total; lalu paling banyak 10 item yang paling sering berselisih (berapa kali,
      total selisih dan satuannya, total nilai).
    - **Waste:** lima kategori waste (urutan form) dengan jumlah catatan dan estimasi kerugian yang tercatat; "jumlah" = jumlah
      catatan, karena qty item berbeda satuan. Catatan tanpa harga ditandai `*`. Lalu 10 item dengan nilai waste terbesar (qty,
      satuan, catatan, nilai); item tanpa harga diurutkan sesudahnya.
    - **Prep:** per item (urut nama): jumlah catatan, total jumlah resep (– untuk item tanpa resep), total Hasil atau Qty, satuan.
    - **Suhu:** per unit (unit aktif menurut urutan `M_Unit`, ditambah unit nonaktif yang punya isian bulan itu): jumlah
      pengecekan (termasuk cek ulang), di luar standar (merah tebal jika lebih dari 0), terlewat; lalu tabel tanggal yang punya
      pengecekan terlewat. Terlewat memakai aturan Riwayat (butir 87): unit aktif sekarang × Opening/Middle/Closing, sejak isian
      Suhu pertama.
    - **Kepatuhan:** per form yang belum dihapus (urutan Beranda): hari ditagih (`wajibPada_`), hari tidak lengkap dan tanggalnya
      ("5 dan 20", "10, 11, dan 15"), jumlah isian (kiriman), isian belum diperiksa, dan baris yang masih dilaporkan keliru saat
      rekap dibuat (laporan yang sudah dikoreksi atau ditutup tidak lagi tercatat di tab Data). Kelengkapan memakai aturan Bagian
      5.8 dengan jadwal dan keadaan tampil form **sekarang**; hari sebelum isian pertama di aplikasi tidak dihitung. Form yang
      disembunyikan atau sewaktu-waktu ditulis "tidak ditagih".
143. **Menu Laporan** (Pengelola): kartu ketiga "Rekap bulanan" di bawah Daftar belanja, berisi satu kalimat isi rekap, `<select>`
    "Bulan" (bulan berjalan dan 23 bulan sebelumnya, terbaru di atas, bulan berjalan bertanda "(bulan berjalan)"; nilai awal bulan
    lalu; pilihan tersimpan di `cache:rekap-pilihan`), dan "Unduh PDF" lewat `unduhPdf` bersama (aturan iPhone sama; mengganti
    bulan mengembalikan tombol ke "Unduh PDF"). Tiap kartu Laporan punya tombol utamanya sendiri (lihat butir 150). Staff tidak
    melihat kartu ini dan server menolak `unduhPdfRekap` dari Staff ("Rekap bulanan hanya untuk Head Kitchen dan Manager.").
144. **Otomatis tiap tanggal 1** (`kirimRekapBulanan` → `jalankanRekapBulanan_`): rekap bulan sebelumnya disimpan ke
    `Laporan Kitchen/{Nama Outlet}/{YYYY}/Rekap_{YYYY-MM}.pdf` (file rekap bulan yang sama yang sudah ada di folder itu dipindah ke
    tempat sampah Drive, supaya satu file per bulan), lalu satu email ke penerima `M_Outlet`: subjek "Rekap bulanan {Outlet},
    {September 2026}", ringkasan tiap bagian, lampiran PDF, tautan aplikasi. PDF tetap disimpan ke Drive walau email gagal; hasil
    dan kegagalan di `rekap_terakhir`. Nama file unduhan sama: `Rekap_{YYYY-MM}.pdf`. Baris "Dibuat oleh": nama pengunduh dan
    waktunya, "Otomatis, …" (trigger), atau "Uji dari editor Apps Script, …".
145. **`pasangTrigger`** kini memasang tiga trigger: laporan harian, cadangan mingguan, dan `kirimRekapBulanan` tiap tanggal 1
    pukul 07.00 (`JAM_REKAP`, `onMonthDay(1).atHour(7)`) dalam zona waktu tersimpan. Pukul 07.00 dipilih supaya isian closing
    hari terakhir bulan lalu yang dicatat larut malam sudah masuk. Jalankan `pasangTrigger` sekali setelah menempel Code.gs v0.11.
146. **`kirimRekapSekarang`** (dari editor): sama dengan trigger (rekap bulan lalu, simpan ke Drive, email), subjek diawali
    "[Uji]". Jika bulan lalu sama sekali belum punya isian (aplikasi baru dipakai), yang dibuat rekap bulan berjalan, dan log
    menyebutkannya. Rekap bulan itu yang dibuat sesudahnya menggantikan file uji di Drive.
147. **Uji Tahap 10** (di luar repo): Code.gs dijalankan di Node dengan tiruan SpreadsheetApp/Utilities/Properties/Drive/Mail/
    ScriptApp dan data contoh satu bulan (September 2026: Stock, Suhu dengan cek ulang dan pengecekan terlewat, Waste dengan dan
    tanpa harga, Prep beresep dan tanpa resep, tanda nihil, dua opname, form kustom berjadwal Senin, pemeriksaan, laporan
    kekeliruan): 61 uji server (angka tiap bagian, bulan tanpa data, bulan berjalan, masa depan, Staff dan tanpa token ditolak,
    trigger tanggal 1, file Drive tunggal, email, gagal tanpa penerima tampil di Beranda dan Dashboard, `kirimRekapSekarang`,
    `pasangTrigger` tidak menggandakan trigger). PDF dirender di Chromium dan diperiksa per bagian. Frontend: 28 uji alur di
    Chromium dengan API tiruan yang memanggil `doPost` asli (unduh Android, iPhone dengan lembar bagikan tiruan dan tanpa dukungan
    berbagi file, tanpa sinyal, Staff, delapan ukuran).

### Pemeriksaan akhir terhadap kedua spesifikasi (Tahap 10, 6 Oktober 2026)

148. **Cara periksa.** Kedua file spesifikasi dibaca ulang bagian demi bagian dan dibandingkan dengan kode. Semua layar (27 rute
    Pengelola, 3 rute Staff, Login pilih nama dan PIN, lembar nilai stock) diperiksa otomatis di Chromium pada delapan ukuran
    Bagian 4.6 (274 pemeriksaan): halaman tidak bergulir ke samping, tidak ada elemen keluar layar di luar bingkai gulir tabel,
    tidak ada teks terpotong, sasaran sentuh minimal 44 px, tanpa galat konsol. Gerak diperiksa terhadap Bagian 8: semua di CSS,
    hanya `transform` dan `opacity` (warna latar hanya pada keadaan tekan), lama sesuai tabel 8.1 (tekan 100 ms, penanda menu dan
    rel 200 ms, ganti layar 120 ms, lembar 200/150 ms, cap 150 ms, goyang PIN 300 ms, pembuka 400 ms dan tiket 150 ms berjeda
    50 ms, paling banyak 8 tiket, kerangka 1,2 detik), masuk `ease-out` dan keluar `ease-in`, grafik tanpa animasi. Dengan
    "kurangi gerak" (`prefers-reduced-motion`) tidak ada animasi atau transisi yang tersisa selain indikator putar.
149. **Diperbaiki di pemeriksaan ini:** nama yang bisa diketuk di tabel (`tabel-tombol`: nama item di detail Riwayat, nama staff
    di Pengaturan → Staff dan PIN) hanya setinggi 24 px; kini sasaran sentuhnya 44 px (padding dengan margin negatif, tinggi
    baris tabel tidak berubah), sesuai Bagian 9.
150. **Belum terpenuhi atau menyimpang** (sengaja tidak diubah di Tahap 10):
    - Foto bukti waste (sistem 5.4, tampilan 5.3): belum dibangun, digabung dengan Tahap 11 (butir 81).
    - Arsip data tahunan (sistem 8.4) dan outlet tambahan (sistem 3): Tahap 11 (opsional).
    - Waste: "geser kartu ke kiri" untuk menghapus baris (tampilan 5.3) tidak dibangun; yang ada ikon tempat sampah. Kartu yang
      mengikuti jari butuh gerak yang dihitung JavaScript tiap bingkai, yang dilarang Bagian 8.2 butir 1.
    - Pengaturan → Form: urutan diubah dengan tombol naik/turun lalu "Simpan urutan" (butir 137), bukan pegangan geser (tampilan
      5.7), dengan alasan yang sama dan supaya bisa dipakai dengan papan ketik.
    - Pengaturan → Staff: "sakelar Aktif/Nonaktif" (tampilan 5.7) berupa tombol "Nonaktifkan" (dengan konfirmasi) / "Aktifkan
      lagi" (butir 76).
    - PDF stock semua kategori satu halaman per kategori (sistem 9.1) baru berlaku setelah pemilik menjalankan
      `ujiPemisahHalamanPdf` dan hasilnya "ya"; bawaannya satu tabel bersambung (butir 77).
    - Urutan `Data_Suhu`: tanggal, unit, lalu waktu kirim (butir 86), bukan unit lalu waktu cek (sistem 8.4); Opening, Middle,
      Closing biasanya dikirim berurutan, jadi hasilnya hampir selalu sama.
    - Menu Laporan Pengelola punya tiga tombol utama (satu per kartu: Laporan harian, Daftar belanja yang memang disebut "tombol
      utama" di tampilan 5.9, dan Rekap bulanan), padahal tampilan Bagian 6 menyebut tombol utama satu per layar.
    - Rekap bulanan, kelengkapan Suhu, dan pengecekan terlewat memakai unit aktif dan jadwal form **sekarang**, bukan keadaan
      pada bulan itu (spesifikasi tidak mengatur; tidak ada riwayat perubahan master).
    - Belum bisa diuji di sini: hasil rumus dan grafik di Google Sheets, konversi HTML ke PDF milik Google (termasuk h2/h3 rekap),
      pengiriman email asli, trigger asli, huruf perangkat diperbesar 200% (tampilan Bagian 9), dan pemasangan PWA di HP.
    - Catatan rapi: nomor butir 118–121 di CLAUDE.md dipakai dua kali (perbaikan Dashboard v0.8.1 dan Tahap 8); rujukan lama
      tetap, jadi tidak dinomori ulang.
