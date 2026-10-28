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
- Aksi tanpa token: `ping` → `{ namaSpreadsheet, waktuServer }`; `infoLogin` → `{ perluPemasangan,
  namaOutlet, staff: [{ nama, pengelola, punyaPin }] }`; `login {nama, pin}`, `pasang {kode,
  namaOutlet, nama, role, pin, zonaWaktu}`, `pulihkan {kode, nama, pin}` → `{ token,
  berlakuSampai, pengguna: { nama, role, pengelola }, namaOutlet, keluarOtomatisMenit }` (sejak Code.gs v0.14 ketiganya
  menerima juga `tanggal` dan `alamatAplikasi`; dengan `tanggal`, jawabannya ditambah `beranda` = jawaban aksi `beranda`); `lupaPin {nama}` →
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
- Aksi Tahap 11 (foto bukti waste): `kirimWaste.baris[]` boleh membawa `foto` (base64 JPEG/PNG/WebP, boleh berawalan data URL,
  paling besar 2 MB per foto dan 15 MB per kiriman) → jawaban ditambah `foto` (jumlah yang tersimpan) dan `fotoGagal: [nama item]`.
  `riwayat`/`detailKiriman`/jawaban pemeriksaan: baris Waste membawa `foto: true|false` untuk semua role dan `fotoUrl` (tautan
  Drive) hanya untuk Pengelola.
- Arah premium (aplikasi 0.14.0) dan bar, logo, serta gerak versi 1.8 (aplikasi 0.15.0) tidak mengubah API.
- Pindah ke Supabase (Code.gs v0.15, aplikasi 0.16.0): aksi aplikasi tidak berubah. Apps Script yang sudah pindah menjawab
  setiap aksi `{ ok: false, pesan, pindahKe: alamat }`; `panggilApi` lalu memakai alamat itu selama `config.js` di HP masih
  berisi alamat lama (`inventoryku:pindahApi`). Aksi pemilik di Edge Function (diawali `__`, butuh `rahasia` = secret
  `RAHASIA_SINKRON`): `__impor {langkah: mulai|baris|selesai, ...}`, `__sinkron {versi}` → `{ tab: [{ nama, versi, urutan,
  lebar, penuh, nilai } | { ..., langkah, barisLama }], selesai }`, `__sinkronSelesai {versi}`, `__berkas` → `{ salin, buang }`,
  `__berkasTersalin {salin, buang}`, `__surel`, `__surelTerkirim {hasil}`, `__fungsi {nama, argumen}` → `{ keluaran, catatan }`;
  `__jadwal {nama, syarat, rahasia}` dari pg_cron memakai rahasia jadwal di tabel `info`. Nilai sel di semua aksi pemilik:
  tanggal `{ "$d": ms }`. Fungsi editor baru: `pindahKeSupabase`, `sinkronDariSupabase` (trigger 5 menit).
- Riwayat harga item (11 Oktober 2026): `gantiHarga {nama, harga, berlakuMulai: 'yyyy-mm-dd'}` (khusus Pengelola; hari ini atau
  tanggal lewat) → jawaban `daftarItem` ditambah `hargaDisimpan: { nama, harga, berlakuMulai, mengganti }`. `daftarItem` ditambah
  `riwayatHargaSiap` dan per item `hargaSejak` ('' = sejak awal, null = belum punya riwayat), `riwayatHarga: [{ berlakuMulai, harga,
  beda, oleh, waktu }]` (10 terakhir, terbaru dulu), `jumlahRiwayatHarga`; `harga` = harga yang berlaku hari ini. `simpanItem` hanya
  menulis harga untuk item yang belum punya harga (harga berbeda untuk item berharga ditolak). `formWaste.item[].harga` dan
  `formOpname.item[].harga` = harga yang berlaku pada `tanggal`. `dashboard.nilaiStock` ditambah `selisihHarga: { dari, sampai, total,
  item: [{ nama, kategori, satuan, selisih, perubahan: [{ tanggal, dari, ke, stock, selisih }] }] }` (bulan berjalan).
- HPP dan food cost (Code.gs v0.16, 17 Oktober 2026; semua khusus Pengelola): `hpp {bulan: 'yyyy-mm'}` → `{ bulan, nama, dari,
  sampai, berjalan, hariIni, target, bahanKecilPersen, pemakaian: { terpakai, waste, selisihStock, total, wasteBarangJadi, stokPembuka },
  cekSilang: { awal, masuk, stokPembuka, akhir, selisihHarga, tanggalAwal, tanggalAkhir, beda, cocok }, penjualan: { total, hari,
  jumlahHari, kurang: [tanggal], terakhir: [{ tanggal, nilai, catatan, oleh }], pernah }, foodCost, perKategori: [{ kategori, nilai }],
  bahanTerbesar: [{ nama, satuan, qty, nilai }], tanpaHarga: [nama], grafik: [{ bulan, foodCost, pemakaian, penjualan, lengkap }],
  menu: [menu HPP], siap: { menu, penjualan } }`; `daftarMenu` → `{ siap, hariIni, menu: [{ nama, hargaJual, aktif, bahan: [{ item, qty,
  hasilBersih, satuan, harga, hargaDariResep, beli, biaya }], biayaBahan, bahanKecil, hpp, foodCost, margin, hargaTarget, diAtasTarget,
  lengkap, tanpaHarga, masalah }], item, target, bahanKecilPersen }`; `simpanMenu {baru, namaLama, nama, hargaJual, bahan: [{ item, qty,
  hasilBersih }]}` (+ `disimpan`) dan `aturMenuAktif {nama, aktif}` (+ `diubah`) → jawaban `daftarMenu`; `simpanPenjualan {tanggal,
  penjualan, catatan, submissionId, bulan?}` → `{ tanggal, penjualan, catatan, mengganti, hpp? }`. `bacaOutletJadwal`/`simpanOutletJadwal`
  ditambah `targetFoodCost` dan `bahanKecilPersen`; `dashboard` ditambah `hpp: { bulan, nama, foodCost, target }` dan `perhatian[]` berjenis
  `menu` dan `penjualan` (`data.tanggal`); `daftarItem.item[]` ditambah `dipakaiMenu`. Nominal rupiah waste untuk Staff: `formWaste` (dan
  `kirimWaste.form`) tanpa `item[].harga`, `kiriman.totalRp`, `baris[].estimasi`, ditambah `tanpaRupiah: true`; `riwayat`/`detailKiriman`
  Waste tanpa kolom berjenis `rupiah`.
- Hapus item (Code.gs v0.16.1, 17 Oktober 2026; khusus Pengelola): `hapusItem {nama}` → jawaban `daftarItem` ditambah `dihapus: nama`.
  `daftarItem.item[]` ditambah `sebabTidakBisaHapus` ('' = bisa dihapus setelah nonaktif; selain itu kalimat sebabnya).
- Penjualan per menu (Code.gs v0.18, 17 Oktober 2026; khusus Pengelola): `penjualanTanggal {tanggal}` → `{ tanggal, penjualan: { nilai,
  catatan } | null, menu: [{ nama, hargaJual, aktif, porsi | null }], siap: { porsi }, pernahPorsi }`; `simpanPenjualan` menerima juga
  `porsi: [{ menu, porsi }]` dan menjawab `porsi` (jumlah menu yang dikirim). `hpp` ditambah `teoritis: { siap, pernah, lengkap, kurang,
  porsi, kecilPersen, perMenu: [{ nama, porsi }], seharusnya: { bahan, kecil, total }, nyata, selisih, selisihPersen, foodCostSeharusnya,
  bahanMenu: { seharusnya, nyata }, bahanLain: { seharusnya, nyata }, item: [{ nama, satuan, seharusnya, nyata, selisih, nilaiSeharusnya,
  nilaiNyata, selisihRp }], jumlahItem, tanpaHarga, tidakBisa, menuTakDikenal }`, `menu[].porsi` (null sebelum porsi pernah dicatat), dan
  `siap.porsi`.
- Notifikasi ke HP (Code.gs v0.19, 17 Oktober 2026; bertoken, semua role): `infoNotifikasi {endpoint?}` → `{ tersedia, kunciPublik,
  aktif, atasNama, pengelola, pengingat: [{ waktu, jam }] }`; `aturNotifikasi {aktif: true, langganan: { endpoint, keys: { p256dh, auth } }}`
  atau `{aktif: false, endpoint}` → jawaban yang sama; `ujiNotifikasi {endpoint}` → `{ terkirim }`. `bacaOutletJadwal`/`simpanOutletJadwal`
  ditambah `jamCekOpening`, `jamCekMiddle`, `jamCekClosing` ('' = mati) dan (baca) `notifikasiTersedia`. Fungsi trigger:
  `pengingatSuhuOpening`, `pengingatSuhuMiddle`, `pengingatSuhuClosing` (juga di `FUNGSI_JADWAL` server.js). Isi notifikasi (JSON di
  dalam Web Push): `{ judul, isi, url, tag, mendesak?, ttl? }`.
- Arsip tahunan (Code.gs v0.20, 17 Oktober 2026): tidak ada aksi baru. Fungsi trigger `arsipTahunan` (tiap jam; juga di `FUNGSI_JADWAL`
  dan `FUNGSI_PEMILIK` server.js). `M_Konfigurasi` mendapat `arsip_sampai` (yyyy-mm-dd) dan `arsip_terakhir` (dibuat otomatis; "Gagal …"
  ikut `beranda.peringatanSistem` dan butir `sistem` Dashboard). Aksi yang menerima tanggal sebelum `arsip_sampai` (isian, `riwayat`,
  `unduhPdf`, `simpanPdfDrive`, `unduhPdfRekap`, `hpp`, `simpanPenjualan`) menjawab `{ ok: false, pesan }` yang menyebut folder arsip.
- Keamanan login (Code.gs v0.17, 17 Oktober 2026): `beranda` (Pengelola) ditambah `terkunci: [{ nama, sampai, panjang }]` (akun aktif
  yang sedang terkunci karena PIN salah); `daftarStaff.staff[]` (dan jawaban aksi staff lain) ditambah `terkunciSampai` dan
  `kunciPanjang`; `dashboard.perhatian[]` boleh berjenis `terkunci` (`data.nama`). `pasang`, `pulihkan`, `tambahStaff`, dan `aturPin`
  menolak PIN yang terlalu mudah ditebak; `login` tidak.
- Kartu stok (Code.gs v0.21, 18 Oktober 2026; bertoken, semua role): `riwayatItem` ditambah `transaksi: [{ tanggal, waktu, jenis:
  Stock|Hasil prep|Dipakai prep|Waste|Penyesuaian|Stock opname, formId (STOCK|PREP|WASTE|null), submissionId, rowId, oleh, dikoreksi,
  masuk, keluar, saldo, ket }]` untuk tanggal-tanggal di `rekap`, urut tanggal lalu waktu diterima server (lama ke baru).
- Pengingat stock (Code.gs v0.22, 18 Oktober 2026): `bacaOutletJadwal`/`simpanOutletJadwal` ditambah `jamPengingatStock`
  ('' = mati); `infoNotifikasi` ditambah `pengingatStock` (jam atau ''). Fungsi trigger `pengingatStock` (juga di `FUNGSI_JADWAL`
  server.js); isi notifikasi `{ judul: 'Stock hari ini: …', isi, url: '#/dashboard', tag: 'pengingat-stock', ttl }`.
- Pemasok dan harga beli (Code.gs v0.23, 18 Oktober 2026): `formStock` ditambah `pembelianSiap` dan `pemasok: [nama aktif]`;
  `kirimStock` menerima `pemasok` (satu per kiriman, tidak wajib) dan `baris[].hargaBeli` (per satuan yang diketik, tidak wajib).
  Khusus Pengelola: `daftarPemasok` → `{ siap, hariIni, dari, pemasok: [{ nama, kontak, catatan, aktif, punyaCatatan, bulanIni: {
  kiriman, item, nilai, tanpaHarga } | null }], tanpaPemasok }`; `simpanPemasok {baru, namaLama, nama, kontak, catatan}` (+ `disimpan`)
  dan `aturPemasokAktif {nama, aktif}` (+ `diubah`) → jawaban `daftarPemasok`; `abaikanHargaBeli {nama}` → `{ diabaikan }`. `riwayat`/
  `detailKiriman` Stock: `kepala[]` ditambah `pemasok`, `kolom[]` ditambah `hargaBeli` (jenis `rupiah`, koreksi, opsional, `bantuan`).
  `dashboard.perhatian[]` boleh berjenis `hargaBeli` (`data.item: [{ nama, satuan, hargaBeli, harga, tanggal, pemasok, oleh }]`).
  Rekap bulanan: `pembelian: { ada, pemasok: [{ nama, kiriman, item, baris, nilai, tanpaHarga }], total }`.
- Hasil prep aktual (Code.gs v0.24, 18 Oktober 2026): `kirimPrep.baris[].hasilAktual` (tidak wajib, item beresep); `formPrep` ditambah
  `hasilAktualSiap` dan `kiriman.baris[].hasilAktual`, `hasilStandar`. `riwayat`/`detailKiriman` Prep: `kolom[]` ditambah `hasilAktual`
  (koreksi, opsional, `jikaKolom: 'jumlahResep'` = hanya untuk baris yang kolom itu berisi). Rekap bulanan `prep.aktual: { catatan,
  aktual, standar }` dan `prep.item[].standar`.
- Masa simpan barang masuk (Code.gs v0.25, 19 Oktober 2026): `daftarItem` ditambah `masaSimpanSiap` dan `item[].masaSimpan` (hari atau
  null); `simpanItem` menerima `masaSimpan` (hari bulat 0–365, '' = tanpa; tidak dikirim = tidak diubah). `formStock` ditambah
  `masaSimpanSiap` dan `item[].masaSimpan`; `kirimStock.baris[].baikSampai` (yyyy-mm-dd, tidak wajib; kosong = tanggal + masa simpan
  item). `riwayat`/`detailKiriman` Stock: `kolom[]` ditambah `baikSampai` (jenis `tanggal`, koreksi, opsional); properti kolom baru
  `jikaPositif` (kolom hanya untuk baris yang kolom acuannya > 0; juga di `hargaBeli`). `beranda.masaSimpan`, Dashboard, pengingat
  stock, dan email kini juga memuat barang masuk.
- Pemulihan cadangan (Code.gs v0.26, 19 Oktober 2026; aksi aplikasi tidak berubah): selama pemulihan semua aksi aplikasi dijawab
  `{ ok: false, pesan, cobaLagi: true }` dan `panggilApi` melemparnya sebagai galat sambungan (`err.jaringan`, isian masuk antrean).
  Aksi pemilik baru `__pulihkan {langkah: tutup|buka, berkas}` → `{ baris, setengah }` / `{ dibuka }`; `__impor` menerima `pemulihan:
  true` (mulai: Script Properties dan info tetap; selesai `{ harapan: { tab: jumlah baris } }` → `{ versi: {}, jumlah }`). Fungsi
  `buatCadanganSebelumPulih` (lewat `__fungsi`, satu-satunya yang boleh saat aplikasi ditutup). Cadangan JSON format 2 (`jenis`,
  `format`, `nama`, `tab[].meta`, tanggal `{ "$d": ms }`). Fungsi editor Apps Script: `periksaCadangan`, `ujiPemulihanCadangan`,
  `pulihkanCadangan` (Script Property `PULIHKAN_CADANGAN`).
- Tandai diperiksa sekaligus (Code.gs v0.27, 19 Oktober 2026; khusus Pengelola): `tandaiDiperiksaBanyak {formId, submissionId: [id]}`
  (paling banyak 300) → `{ diperiksa, sudah, dilewati: [{ id, sebab: dilaporkan|tidakAda }], kiriman: [kiriman lengkap seperti
  `detailKiriman.kiriman`] }`. `riwayat` ditambah `periksaBanyak: true` (aplikasi menampilkan tombol per tanggal hanya jika ada).
- Hitung sisa (Code.gs v0.28, 20 Oktober 2026; bertoken, semua role): `kirimStock.baris[]` boleh membawa `sisa` menggantikan `keluar`
  (`keluar` bukan nol bersama `sisa` ditolak); server menulis Stock Keluar = Stock Akhir tercatat pada `tanggal` saat diterima + masuk
  (satuan dasar) − sisa dan sisanya di kolom baru `Data_Stock.Sisa Dihitung`; sisa yang sama dengan stock tetap dicatat (keluar 0); sisa
  yang lebih banyak tidak menolak kiriman: keluar 0, sisa tidak disimpan, jawaban ditambah `sisaLebih: [{ item, sisa, tercatat, masuk,
  satuan }]` (juga `jumlah: 0` tanpa menulis jika tidak ada baris lain). `formStock` ditambah `sisaSiap` (kolom ada). `riwayat`/
  `detailKiriman` Stock: `kolom[]` ditambah `sisa` (tidak dikoreksi, `jikaAda`). Form Stock "Semua kategori" tetap memakai `kirimStock`
  satu kiriman per kategori (aplikasi).
- Pesanan ke pemasok (Code.gs v0.29, 21 Oktober 2026): `daftarBelanja` ditambah `outlet`, `pembelianSiap`, `pesananSiap`, `pemasok: [{ nama
  ('' = belum ada pemasok), kontak, wa, item: [item belanja + kategori, terakhir: { pemasok, tanggal, nonaktif } | null, dipesan:
  { id, pemasok, nama, kategori, jumlah, satuanOrder, dasar, satuan, tanggal, oleh } | null] }]`, `pilihanPemasok: [{ nama, wa }]`,
  dan `menunggu: [pesanan]` (`kategori` tetap untuk aplikasi lama). Pesanan = `{ id, pemasok, tanggal, oleh, waktu, item: [{ nama,
  kategori, jumlah, satuanOrder, dasar, satuan }] }`. Khusus Pengelola: `catatPesanan {submissionId, tanggal, waktuPerangkat,
  pemasok, baris: [{ item, jumlah, satuanOrder: besar|dasar }]}` → `{ sudahTerkirim, id, pemasok, jumlah, diganti: [{ item,
  pemasok, tanggal, oleh }], sudahDatang: [nama], lebihBaru?: [{ item, pemasok, tanggal, oleh }], belanja }`; `tutupPesanan {id,
  tanggal?}` → `{ ditutup (0 = sudah tidak menunggu), belanja, form? }`. `formStock` ditambah `pesananSiap` dan `pesanan: [pesanan]`
  (menunggu, pemasok aktif, paling lama 14 hari); `kirimStock.baris[]` boleh membawa `pesanan` (id; kiriman tidak pernah ditolak
  karenanya) dan jawabannya ditambah `pesananDatang: [{ pemasok, item }]` dan `pesananSudahDatang: [{ item, pemasok, oleh, waktu }]`
  (Tambah masuk dari pesanan yang sudah dicatat datang, tidak dicatat lagi; tanpa baris lain `jumlah: 0` tanpa menulis).
  `unduhPdfBelanja.order` boleh berisi semua item (aplikasi 0.29 mengirim semuanya).
- Hari libur (Code.gs v0.30, 22 Oktober 2026): khusus Pengelola `daftarLibur` → `{ siap, hariIni, batasDepan, arsipSampai, libur: [{ tanggal,
  keterangan, oleh, waktu }] }` (urut tanggal; tanggal sebelum `arsip_sampai` tidak ikut); `simpanLibur {tanggal, keterangan}` (hari ini,
  tanggal lewat yang belum diarsip, atau paling jauh 366 hari ke depan; keterangan paling panjang 40; tanggal yang sudah libur diganti
  keterangannya) → jawaban `daftarLibur` + `disimpan: { tanggal, keterangan, baru, isian: [nama form berisian] }`; `hapusLibur {tanggal}` →
  jawaban `daftarLibur` + `dihapus: tanggal | null`. `beranda` (semua role) ditambah `libur` dan `liburBesok` (`{ tanggal, keterangan,
  oleh, waktu } | null`); `dashboard`, `formKustom` (dan `kirimKustom.form`), dan `penjualanTanggal` ditambah `libur`; pada hari libur semua
  `form[].wajib` dan `formKustom.wajib` false. `hpp.penjualan` (juga `simpanPenjualan.hpp`) ditambah `libur: [tanggal]` (hari libur tanpa
  catatan penjualan; tidak masuk `jumlahHari` dan `kurang`). `M_Konfigurasi.laporan_terakhir` boleh diawali `Dilewati <waktu> untuk
  <tanggal>: hari libur`. `setupSpreadsheet` di Supabase menjawab `VERSI_KODE`.
- Pengingat sebelum closing (Code.gs v0.31, 28 Oktober 2026): `bacaOutletJadwal`/`simpanOutletJadwal` ditambah
  `pengingatClosingMenit` (0 = mati, 15, 30, 60); `infoNotifikasi` ditambah `pengingatClosing` (jam atau ''). Fungsi trigger
  `pengingatClosing` (juga di `FUNGSI_JADWAL` server.js); isi notifikasi `{ judul: 'Closing 21.30: 3 form belum diisi', isi, url: '#/',
  tag: 'pengingat-closing', ttl }`. `M_Konfigurasi` baris `pengingat_closing_menit` (belum ada = 30).
- Staff membetulkan isiannya sendiri (Code.gs v0.32, 28 Oktober 2026): `koreksi` kini untuk semua role; Staff hanya baris yang
  `submitted_by`-nya dirinya, dalam 15 menit sesudah `timestamp_server`, selama belum Diperiksa (selain itu `{ ok: false, pesan }`).
  `riwayat.kiriman[]`, `detailKiriman.kiriman`, dan `kiriman` di jawaban koreksi/laporkan ditambah `betulkanSampai` (ISO) hanya untuk
  pengisinya (Staff) selama batas belum lewat. `tandaiDiperiksa` menerima `terlihat` (ISO koreksi terbaru yang tampil, '' jika belum
  pernah) dan `tandaiDiperiksaBanyak` menerima `terlihat: { id: ISO }`; kiriman yang dikoreksi sesudahnya ditolak / dilewati
  (`sebab: 'berubah'`).
- Ubah banyak item sekaligus (Code.gs v0.33, 28 Oktober 2026; khusus Pengelola): `gantiHargaBanyak {berlakuMulai, harga: [{ nama,
  harga }]}` → jawaban `daftarItem` ditambah `hargaDisimpan: { berlakuMulai, jumlah, mengganti, pertama: [nama], sama: [nama] }`;
  `tambahItemBanyak {baris: [{ nama, kategori, satuan, satuanBesar, isiSatuanBesar, harga, stokMin, stokMaks, masaSimpan }]}` →
  jawaban `daftarItem` ditambah `ditambah: [nama]`. Keduanya paling banyak 300 baris dan menolak semuanya jika satu salah.
  `daftarItem` ditambah `ubahBanyakSiap`.
- Food cost sementara (Code.gs v0.34, 28 Oktober 2026; khusus Pengelola): `hpp` (juga `simpanPenjualan.hpp`) ditambah
  `foodCostSementara: { foodCost, pemakaian, penjualan, hari, jumlahHari } | null` dan `grafik[].sementara` (persen atau null);
  `dashboard.hpp` ditambah `foodCostSementara` (bentuk sama). Hanya ada selama `foodCost` null karena penjualan belum lengkap dan
  sudah ada penjualan yang tercatat bulan itu.
- Nilai stock barang jadi dari resep (Code.gs v0.36, 28 Oktober 2026): `dashboard.nilaiStock` ditambah `dariResep: [{ nama, kategori,
  satuan, stock, harga, nilai }]` dan `tanpaHarga[].resepKurang`; `daftarItem.item[]` ditambah `hargaResep` (harga dari resep hari ini
  untuk item tanpa harga satuan, atau null).
- Email harian (Code.gs v0.35, 28 Oktober 2026): tidak ada aksi baru. Email laporan harian ditambah bagian "Barang masuk" dan
  (sejak penjualan pernah dicatat) "Penjualan dan food cost".
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
| 10+ | Perbaikan tiga penyimpangan butir 150 (7 Oktober 2026): urutan `Data_Suhu` menurut waktu cek, sakelar Aktif/Nonaktif di layar ubah staff, geser kartu Waste untuk menghapus | Kode selesai (Code.gs v0.11.1, aplikasi 0.11.1), diuji dengan API tiruan (Code.gs di Node, 8 uji server) dan Chromium (22 uji alur dengan sentuhan tiruan, delapan ukuran, "kurangi gerak"). Rumus Sheet belum bisa diuji di sini. Menunggu pemilik: tempel Code.gs, jalankan `setupSpreadsheet` sekali (rumus `Harian_Suhu` baru), deploy versi baru, uji dari HP |
| 11+ | Riwayat harga item (keputusan pemilik 11 Oktober 2026): `M_HargaItem`, Ganti harga dan Riwayat harga di Pengaturan → Item, harga yang berlaku pada tanggal untuk waste/penyesuaian/opname/nilai stock/resep/rekap, selisih karena perubahan harga di Dashboard dan rekap bulanan, rumus bahan terpakai di tab Dashboard | Kode selesai (Code.gs v0.13, aplikasi 0.13.0), diuji dengan API tiruan (Code.gs di Node, 26 uji harga + 32 pemeriksaan regresi) dan Chromium. Rumus Sheet belum bisa diuji di sini. Menunggu pemilik: tempel Code.gs, jalankan `setupSpreadsheet` sekali (tab `M_HargaItem` dan harga awal), deploy versi baru, uji dari HP |
| 11++ | Arah premium, spesifikasi tampilan 1.7 (dipilih pemilik dari pratinjau 11 Oktober 2026): kepala navy berisi ringkasan di setiap layar, bayangan lembut, tekstur navy, angka utama besar, tiket berikon dengan sobek, Nilai stock di kepala Dashboard dan ubin menggantung, grafik tangga harga, grafik kosong bersumbu | Kode selesai (aplikasi 0.14.0; Code.gs tidak berubah), diuji di Chromium (13 uji alur, sapuan semua rute Pengelola dan Staff pada delapan ukuran dan "kurangi gerak": 292 pemeriksaan). Menunggu pemilik: uji dari HP (cukup buka aplikasi; tidak perlu tempel Code.gs atau setupSpreadsheet) |
| 11+++ | Bar, logo, nama, dan gerak, spesifikasi tampilan 1.8 (permintaan pemilik 12 Oktober 2026): bar bawah mengambang dengan pil menu aktif, bar atas dengan pil dan nama outlet, logo lencana buku terbuka, nama dua warna, baris merek di kepala Beranda, isi layar naik bertahap, muncul saat digulir, angka dan grafik naik, cahaya navy pelan | Kode selesai (aplikasi 0.15.0; Code.gs tidak berubah), diuji di Chromium (11 uji gerak baru, 13 uji alur lama, sapuan 292 pemeriksaan). Menunggu pemilik: uji dari HP (cukup buka aplikasi; tidak perlu tempel Code.gs atau setupSpreadsheet) |
| 11++++ | Memuat lebih cepat (keluhan pemilik 12 Oktober 2026): login membawa Beranda, tiap tab dibaca sekali per permintaan, jawaban Beranda disimpan 2 menit di server, lama aksi di log, `config.js` dari salinan di HP | Kode selesai (Code.gs v0.14, aplikasi 0.15.1), diuji dengan API tiruan (11 uji server baru, jawaban 12 aksi sama dengan sebelum, 26 uji harga dan 32 pemeriksaan regresi) dan Chromium (4 uji baru, uji lama, sapuan delapan ukuran). Waktu di Google asli belum bisa diukur di sini. Menunggu pemilik: tempel Code.gs, deploy versi baru, uji dari HP (setupSpreadsheet tidak perlu) |
| 12 | Pindah ke Supabase (keputusan pemilik 15 Oktober 2026): Edge Function menjalankan Code.gs di atas Postgres, PDF jsPDF, Storage, email Brevo atau Gmail, jadwal pg_cron, cadangan JSON, salinan ke Sheets tiap 5 menit per baris, berkas ke Drive, `pindahKeSupabase`, pengalihan HP | Kode selesai (Code.gs v0.15, aplikasi 0.16.0, skema.sql v0.2), diuji dengan Postgres 16 lokal dan Deno (Edge Function rakitan), uji ujung-ke-ujung Sheet tiruan → Supabase → Sheet (35 pemeriksaan), Brevo tiruan, pembanding 91 langkah dengan tiruan Apps Script, beban satu tahun, Chromium pengalihan. Dipasang pemilik 16 Oktober 2026 (butir 213): aplikasi, salinan ke Sheet, email lewat Gmail, dan tiga jadwal pg_cron berjalan |
| 12+ | Login lebih bersih, spesifikasi tampilan 1.9 (dipilih pemilik dari pratinjau 17 Oktober 2026, cara 3): HP mengingat pengguna terakhir dan Login langsung menyapanya dengan papan PIN, daftar nama berupa lingkaran inisial lewat "Ganti nama" | Kode selesai (aplikasi 0.16.1; Code.gs tidak berubah), diuji di Chromium dengan API tiruan (delapan ukuran untuk sapaan dan daftar nama, alur pilih nama/PIN salah/login/ingat, nama yang tidak bisa masuk lagi, keterangan keluar otomatis, nama panjang, "kurangi gerak"). Digabung dan diuji pemilik dari HP 17 Oktober 2026: tampilan sesuai |
| 12++ | Perbaikan jadwal Supabase (laporan harian 16 Oktober 2026 tidak terkirim): pg_cron memanggil Edge Function dengan `Content-Type: application/json`; peringatan di Beranda/Dashboard Pengelola jika laporan harian tidak berjalan | Kode selesai (Code.gs v0.15.1; aplikasi tetap 0.16.1), diuji dengan Postgres 16 lokal (tiruan `net.http_post` dengan pemeriksaan Supabase: versi lama gagal dengan pesan yang sama, versi baru lolos untuk tiga jadwal), pelayan Edge Function dengan body JSON, dan 13 skenario waktu peringatan. Dipasang dan diuji pemilik 17 Oktober 2026 (butir 222): Edge Function dan Code.gs ditempel, `pasangTrigger` dijalankan, jadwal cadangan yang dijalankan manual dijawab 200 `dilewati` |
| 12+++ | HPP dan food cost (dipilih pemilik dari pratinjau 17 Oktober 2026): Pengaturan → Menu (takaran bersih, hasil bersih, bahan kecil, Salin menu), layar HPP dan food cost dari Dashboard (pemakaian bahan, cek silang, per kategori, grafik 6 bulan, Per menu), penjualan harian, bagian HPP di rekap bulanan, nominal rupiah waste hanya untuk Pengelola | Kode selesai (Code.gs v0.16, aplikasi 0.17.0), diuji dengan API tiruan (Code.gs di Node di atas Spreadsheet tiruan `supabase/src`, 18 uji server dengan angka dihitung tangan, 34 jawaban aksi lama sama dengan v0.15.1) dan Chromium (13 uji alur, delapan ukuran, "kurangi gerak", 28 layar lama sama piksel per piksel dengan versi sebelumnya). Menunggu pemilik: tempel `supabase/functions/api/index.ts` ke `rapid-action` dan Deploy, tempel Code.gs, jalankan `setupSpreadsheet` sekali (tab `M_Menu`, `M_MenuBahan`, `Data_Penjualan`, dua baris konfigurasi), uji dari HP |
| 12++++ | Hapus item yang belum punya catatan (permintaan pemilik 17 Oktober 2026): tombol Hapus di layar ubah item untuk item nonaktif tanpa catatan stock, resep, menu, atau isian form kustom; baris `M_Item` dan riwayat harganya dihapus | Kode selesai (Code.gs v0.16.1, aplikasi 0.17.1), diuji dengan API tiruan (Code.gs di Node di atas Spreadsheet tiruan `supabase/src`, 8 uji server) dan Chromium (alur nonaktifkan → Batal → Hapus, sebab tidak bisa dihapus, delapan ukuran). Menunggu pemilik: tempel `supabase/functions/api/index.ts` ke `rapid-action` dan Deploy, tempel Code.gs, uji dari HP (setupSpreadsheet tidak perlu) |
| 12+++++ | Pola navy, bar, dan kartu, spesifikasi tampilan 1.11 (dipilih pemilik dari pratinjau 17 Oktober 2026, pola C): cahaya dan butiran menggantikan tekstur garis di kepala Beranda, kepala layar, Login, pita rel, dan bar atas; bar bawah kaca buram; kartu bergaris rambut | Kode selesai (aplikasi 0.17.2; Code.gs tidak berubah), diuji di Chromium dengan Code.gs asli di atas Spreadsheet tiruan `supabase/src` (sapuan 10 rute pada delapan ukuran dan "kurangi gerak", kontras kata menu di atas kaca). Digabung dan diuji pemilik dari HP 17 Oktober 2026: tampilan sesuai |
| 12++++++ | Perpindahan layar yang mulus dan angka berhitung naik, spesifikasi tampilan 1.12 (dipilih pemilik dari pratinjau 17 Oktober 2026); ATURAN TETAP gerak dicabut | Kode selesai (aplikasi 0.18.0; Code.gs tidak berubah), diuji di Chromium dengan Code.gs asli di atas Spreadsheet tiruan (buka, tutup, maju, mundur, desktop, tanpa View Transitions, "kurangi gerak", angka tengah dan akhir, sapuan delapan ukuran). Digabung dan diuji pemilik dari HP 17 Oktober 2026: tampilan sesuai |
| 12+++++++ | Keamanan login (permintaan pemilik 17 Oktober 2026, dari telaah keamanan): kunci PIN bertingkat (kunci ketiga dalam 24 jam berlangsung 24 jam), akun terkunci di Beranda, Dashboard, Staff dan PIN, dan email harian Pengelola, PIN baru yang terlalu mudah ditebak ditolak | Kode selesai (Code.gs v0.17, aplikasi 0.18.1), diuji dengan Code.gs asli di atas Spreadsheet tiruan `supabase/src` (15 uji server, 15 jawaban aksi sama dengan v0.16.1 selain kolom baru) dan Chromium (pemberitahuan, lembar PIN, Dashboard, Staff dan PIN, delapan ukuran). Menunggu pemilik: tempel `supabase/functions/api/index.ts` ke `rapid-action` dan Deploy, tempel Code.gs, uji dari HP (setupSpreadsheet tidak perlu) |
| 12++++++++ | Penjualan per menu (permintaan pemilik 17 Oktober 2026): porsi terjual per menu di lembar Catat penjualan (`Data_PenjualanMenu`), pemakaian bahan seharusnya vs nyata di layar HPP, porsi terjual di Per menu, pengingat Dashboard, rekap bulanan PDF dan email | Kode selesai (Code.gs v0.18, aplikasi 0.19.0), diuji dengan Code.gs asli di atas Spreadsheet tiruan `supabase/src` (10 uji server dengan angka dihitung tangan, 10 jawaban aksi lama sama dengan v0.17) dan Chromium (alur catat porsi, galat porsi, server lama, delapan ukuran). Menunggu pemilik: tempel `supabase/functions/api/index.ts` ke `rapid-action` dan Deploy, tempel Code.gs, jalankan `setupSpreadsheet` sekali (tab `Data_PenjualanMenu`), uji dari HP |
| 12+++++++++ | Notifikasi ke HP (permintaan pemilik 17 Oktober 2026): Web Push dari Supabase (kunci VAPID di tabel `info`, enkripsi aes128gcm tanpa library), suhu di luar standar, reset PIN, dan akun terkunci ke HP Pengelola, pengingat cek suhu ke semua HP, lembar Notifikasi di HP ini, jam pengingat di Outlet dan jadwal | Kode selesai (Code.gs v0.19, aplikasi 0.20.0), diuji: enkripsi didekripsi `http_ece` (library milik `web-push`), 12 uji server Code.gs, runtime asli di atas Postgres 16 lokal (kirim sesudah tersimpan, 410 dibuang, `__jadwal`, `pasangTrigger`), service worker tiruan, dan Chromium (layanan push browser ditiru, delapan ukuran). Menunggu pemilik: tempel `supabase/functions/api/index.ts` ke `rapid-action` dan Deploy, tempel Code.gs, jalankan `pasangTrigger` sekali, nyalakan notifikasi dari HP (iPhone: pasang ke Layar Utama dulu) |
| 12++++++++++ | Arsip tahunan (keputusan pemilik 17 Oktober 2026): tab menyimpan tahun berjalan dan tahun lalu; baris lebih tua (tab Data, `Stock_Harian`, `Log_Perubahan`) pindah ke `Laporan Kitchen/<Outlet>/Arsip/<Tahun>/` sebagai JSON dan Google Sheets "Arsip InventoryKu <Tahun>", rekap terakhir tiap item tetap, trigger tiap jam, tanggal yang sudah diarsip ditolak | Kode selesai (Code.gs v0.20; aplikasi tetap 0.20.0), diuji: 10 uji server Code.gs (juga dengan batas 2 baris per jalan), arsip ke Google Sheets dengan tiruan, runtime asli di atas Postgres 16 lokal (69.250 baris per tab, paling lama 0,9 detik per jalan, stock tetap), jawaban aksi lama sama dengan v0.19. Menunggu pemilik: tempel `supabase/functions/api/index.ts` ke `rapid-action` dan Deploy, tempel Code.gs, jalankan `pasangTrigger` sekali (setupSpreadsheet tidak perlu) |
| 12+++++++++++ | Bacaan database lebih ringkas di Supabase (permintaan pemilik 17 Oktober 2026, saran 2 dari "memuat lebih cepat lagi"): bacaan awal tiap permintaan dan kunci tulis dalam satu kali bolak-balik, tab dimuat sekaligus, `aksi_tab` sekali per isolate, kunci notifikasi dimuat bersamaan | Kode selesai (hanya `supabase/src`; Code.gs tetap v0.20, aplikasi tetap 0.20.0), diuji dengan Postgres 16 lokal: 35 langkah jawaban dan isi database sama dengan sebelumnya, proksi jeda 25 ms per arah (login 1,24 → 0,39 detik, permintaan pertama isolate 1,93 → 0,34 detik), dua runtime menulis bersamaan, urutan kunci, dan file rakitan dijalankan utuh. Menunggu pemilik: tempel `supabase/functions/api/index.ts` ke `rapid-action` dan Deploy (Code.gs di Apps Script tidak perlu ditempel ulang) |
| 12++++++++++++ | Function di region database (permintaan pemilik 17 Oktober 2026, pilihan A): database pemilik di Sydney, `config.js` diberi `?forceFunctionRegion=ap-southeast-2` supaya Edge Function berjalan di samping database | Kode selesai (hanya `config.js` dan dokumen; Code.gs, aplikasi, dan rakitan tidak berubah), diuji di Chromium dengan API tiruan (POST ke alamat berparameter, hanya header Content-Type, Login tampil). Belum diuji di Supabase asli (jaringan sesi ini tidak menjangkau Supabase). Menunggu pemilik: gabungkan PR, periksa header `x-sb-edge-region` (PANDUAN), opsional ubah Script Property `SUPABASE_API` |
| 12+++++++++++++ | Kartu stok per transaksi (permintaan pemilik 18 Oktober 2026, dari usulan fitur INV-04): lembar riwayat per item mendapat tampilan "Transaksi" (tiap catatan yang menggerakkan stock, siapa, jam, keterangan, dan saldo sesudahnya), ketuk tanggal di rekap untuk melompat ke transaksinya, ketuk transaksi Stock/Prep/Waste untuk membuka isiannya di Riwayat | Kode selesai (Code.gs v0.21, aplikasi 0.21.0), diuji dengan Code.gs asli di atas Spreadsheet tiruan `supabase/src` (urutan, saldo cocok dengan rekap, koreksi, isian terlambat, Staff) dan Chromium (alur HP, Staff dari Riwayat, server lama, delapan ukuran, "kurangi gerak"). Menunggu pemilik: tempel `supabase/functions/api/index.ts` ke `rapid-action` dan Deploy, tempel Code.gs, uji dari HP (setupSpreadsheet tidak perlu) |
| 12++++++++++++++ | Pengingat stock ke HP Pengelola (permintaan pemilik 18 Oktober 2026, dari usulan fitur SYS-07): notifikasi pagi (jam diatur di Outlet dan jadwal, awal 07.00) berisi item minus, di bawah stok minimum, lewat masa simpan, dan habis besok, hanya jika ada | Kode selesai (Code.gs v0.22, aplikasi 0.22.0), diuji dengan Code.gs asli di atas Spreadsheet tiruan `supabase/src` (isi dan penerima, tanpa kiriman jika aman, jam diubah/dimatikan dan jadwalnya, tanpa kunci notifikasi, pengingat suhu tetap) dan Chromium (Outlet dan jadwal, lembar Notifikasi Pengelola dan Staff, server lama, delapan ukuran). Menunggu pemilik: tempel `supabase/functions/api/index.ts` ke `rapid-action` dan Deploy, tempel Code.gs, jalankan `pasangTrigger` sekali |
| 12+++++++++++++++ | Pemasok dan harga beli (keputusan pemilik 18 Oktober 2026, dari usulan fitur INV-07, INV-09, RPT-02): `M_Pemasok` dan Pengaturan → Pemasok, pilihan pemasok dan harga beli (tidak wajib, semua role) di form Stock, harga beli berbeda ditinjau Pengelola di Dashboard (Pakai / Abaikan), koreksi harga beli, kartu stok, bagian Pembelian di rekap bulanan | Kode selesai (Code.gs v0.23, aplikasi 0.23.0), diuji dengan Code.gs asli di atas Spreadsheet tiruan `supabase/src` (server sebelum dan sesudah setupSpreadsheet) dan Chromium (Staff HP, desktop, antrean, server lama, Pengaturan → Pemasok, Dashboard, koreksi, delapan ukuran). Menunggu pemilik: tempel `supabase/functions/api/index.ts` ke `rapid-action` dan Deploy, tempel Code.gs, jalankan `setupSpreadsheet` sekali (tab `M_Pemasok`, dua kolom `Data_Stock`) |
| 12++++++++++++++++ | Hasil prep aktual (permintaan pemilik 18 Oktober 2026, dari usulan fitur KIT-06): kolom "Hasil aktual" (tidak wajib) di Prep List; stock memakai hasil aktual, hasil menurut resep tetap terlihat di layar, Riwayat, PDF, kartu stok, dan rekap bulanan; perbaikan kiriman Stock di Sheet yang belum menjalankan setupSpreadsheet sejak v0.23 | Kode selesai (Code.gs v0.24, aplikasi 0.24.0), diuji dengan Code.gs asli di atas Spreadsheet tiruan `supabase/src` (stock, koreksi, PDF, rekap, Sheet lama) dan Chromium (Staff HP, desktop, server lama, Riwayat dan koreksi, delapan ukuran). Menunggu pemilik: tempel `supabase/functions/api/index.ts` ke `rapid-action` dan Deploy, tempel Code.gs, jalankan `setupSpreadsheet` sekali (kolom `Hasil Aktual` di `Data_Prep`) |
| 12+++++++++++++++++ | Masa simpan barang masuk (keputusan pemilik 19 Oktober 2026, dari usulan fitur): "Masa simpan (hari)" per item di Pengaturan → Item, "Baik sampai" otomatis (boleh diubah) saat Tambah masuk di form Stock, kolom `Baik Sampai` di `Data_Stock`, pengingat lewat masa simpan dan habis besok untuk barang masuk di Beranda, Dashboard, pengingat stock, dan email, koreksi di Riwayat, kartu stok | Kode selesai (Code.gs v0.25, aplikasi 0.25.0), diuji dengan Code.gs asli di atas Spreadsheet tiruan `supabase/src` (pembagian stock, prep dan barang masuk bersama, koreksi, Sheet lama) dan Chromium (Pengaturan → Item, Staff HP, desktop, server lama, Riwayat, Beranda, delapan ukuran). Menunggu pemilik: tempel `supabase/functions/api/index.ts` ke `rapid-action` dan Deploy, tempel Code.gs, jalankan `setupSpreadsheet` sekali (kolom `Masa Simpan (hari)` di `M_Item` dan `Baik Sampai` di `Data_Stock`) |
| 12++++++++++++++++++ | Uji dan pemulihan cadangan (permintaan pemilik 19 Oktober 2026, dari usulan fitur SYS-04): `periksaCadangan`, `ujiPemulihanCadangan`, dan `pulihkanCadangan` dari editor Apps Script membaca cadangan JSON dari Drive dan memulihkannya ke Supabase; aplikasi ditutup selama pemulihan (isian masuk antrean HP), isi sebelum pemulihan selalu dicadangkan, jumlah baris dicocokkan, pemulihan setengah jalan tidak membuka aplikasi; cadangan format 2; langkah di PANDUAN | Kode selesai (Code.gs v0.26, aplikasi 0.26.0), diuji ujung ke ujung: runtime dan pelayan asli `supabase/src` di atas Postgres 16 lokal, Apps Script tiruan (Drive, curl ke server) dengan Code.gs asli (pulihkan, batalkan, uji, format 1, cadangan rusak, putus di tengah, jumlah tidak cocok, project baru), dan Chromium (isian masuk antrean saat server ditutup). Menunggu pemilik: tempel `supabase/functions/api/index.ts` ke `rapid-action` dan Deploy, tempel Code.gs, jalankan `ujiPemulihanCadangan` sekali pada jam sepi (setupSpreadsheet tidak perlu) |
| 12+++++++++++++++++++ | Tabel Stock muat di laptop dan teks lama dari masa Apps Script (permintaan pemilik 19 Oktober 2026, butir 1 dari telaah aplikasi): harga beli dan baik sampai pindah ke bawah angka Tambah Masuk seperti di kartu HP, sehingga Stock Akhir selalu terlihat tanpa menggeser tabel mulai 1.024 px; teks yang keliru sesudah pindah ke Supabase (toleransi Google, salinan spreadsheet, perintah pasangTrigger yang tidak perlu, isi tab M_Item/M_Unit, alamat Web App /exec) diganti | Kode selesai (aplikasi 0.26.1; Code.gs tidak berubah), diuji dengan Code.gs asli di atas Spreadsheet tiruan `supabase/src` dan Chromium (lebar tabel di 1024, 1280, 1366, 1920 px untuk lima kategori sebelum dan sesudah Tambah masuk diisi, urutan Tab, draft, kartu HP dan tablet sama piksel per piksel dengan 0.26.0). Menunggu pemilik: gabungkan PR, uji dari laptop (tidak perlu tempel Code.gs atau Edge Function) |
| 12++++++++++++++++++++ | Tandai diperiksa sekaligus (permintaan pemilik 19 Oktober 2026, butir 2 dari telaah aplikasi): tombol "Tandai diperiksa (n)" di judul tiap tanggal di daftar Riwayat untuk Pengelola, konfirmasi, isian yang dilaporkan keliru tidak ikut | Kode selesai (Code.gs v0.27, aplikasi 0.27.0), diuji dengan Code.gs asli di atas Spreadsheet tiruan `supabase/src` (30 uji server: dilaporkan, id ganda dan tak dikenal, ulang, Staff ditolak, batas, lima jenis form, Beranda; sel yang berubah sama dengan Tandai diperiksa satu per satu) dan Chromium (27 uji: HP, desktop dengan detail kanan, Staff, server lama, tanpa sinyal, galat server, delapan ukuran, gerak; 30 uji perbaikan sesudah telaah: tanpa tombol selama filter kategori/item, kalimat filter pengisi, simpanan penuh, tombol 48 px). Menunggu pemilik: gabungkan PR, tempel `supabase/functions/api/index.ts` ke `rapid-action` dan Deploy, tempel Code.gs (setupSpreadsheet tidak perlu) |
| 12+++++++++++++++++++++ | Isi form Stock lebih cepat (permintaan pemilik 20 Oktober 2026, butir 3 dari telaah aplikasi): "Semua kategori" di form Stock (satu kiriman per kategori), kotak "Cari item" di form Stock dan Stock opname, "Catat pemakaian: Hitung sisa" (hari ini saja; Stock Keluar dihitung server dari sisa, sisa disimpan di `Sisa Dihitung` dan ikut dikoreksi) | Kode selesai (Code.gs v0.28, aplikasi 0.28.0), diuji dengan Code.gs asli di atas Spreadsheet tiruan `supabase/src` (43 uji server; jawaban jalur Tambah keluar sama dengan v0.27 selain kolom `sisa` di Riwayat) dan Chromium (87 uji: HP, desktop 1024/1366, antrean, satu kategori ditolak, server lama, pencarian, opname, Kemarin, sisa lama, kirim terkunci, delapan ukuran). Digabung dan dipasang pemilik 21 Oktober 2026 (Edge Function, Code.gs, `setupSpreadsheet`) |
| 12++++++++++++++++++++++ | Daftar belanja per pemasok dan pesanan (keputusan pemilik 21 Oktober 2026, butir 4 dari telaah aplikasi): kelompok per pemasok (pesanan yang menunggu, lalu pemasok barang masuk terakhir), "Kirim ke WhatsApp" ke nomor di Kontak, pesanan tercatat di `Data_Pesanan` lewat antrean HP, "Pesanan belum datang" dan "Tutup pesanan", kartu "Pesanan menunggu" dengan "Isi dari pesanan" di form Stock (semua role), barang masuk menyelesaikan pesanan, PDF per pemasok, email | Kode selesai (Code.gs v0.29, aplikasi 0.29.0), diuji dengan Code.gs asli di atas Spreadsheet tiruan `supabase/src` (120 uji server, jawaban aksi lama sama dengan v0.28 selain PDF daftar belanja) dan Chromium (103 uji: Laporan dan form Stock, antrean, dua HP, server lama, delapan ukuran; uji lama tetap lulus), termasuk perbaikan sesudah telaah berlawanan; lihat butir 328–338. Digabung dan dipasang pemilik 22 Oktober 2026 (Edge Function, Code.gs, `setupSpreadsheet`) |
| 12+++++++++++++++++++++++ | Hari libur (keputusan pemilik 22 Oktober 2026, dari telaah aplikasi): `M_HariLibur` dan Pengaturan → Hari libur (hari ini, tanggal lewat, atau sampai setahun ke depan; hapus), tidak ada form yang ditagih dan tidak ada suhu terlewat pada hari libur (Beranda, Dashboard, email, rekap bulanan, blok Kepatuhan Sheets), penjualan dan porsi tidak perlu dicatat, laporan harian tanpa email (PDF berisian tetap ke Drive) dan pengingat cek suhu dilewati | Kode selesai (Code.gs v0.30, aplikasi 0.30.0), diuji dengan Code.gs asli di atas Spreadsheet tiruan `supabase/src` (100 uji server, rumus Kepatuhan, jawaban aksi lama sama dengan v0.29 selain field baru) dan Chromium (82 uji: HP, desktop, Staff, tanpa sinyal, server lama, delapan ukuran; uji lama tetap lulus). Digabung dan dipasang pemilik 28 Oktober 2026 (Edge Function, Code.gs, `setupSpreadsheet`) |
| 12++++++++++++++++++++++++ | Pengingat sebelum closing (permintaan pemilik 28 Oktober 2026, dari telaah aplikasi): notifikasi ke semua HP 15, 30, atau 60 menit sebelum jam closing (awal 30) berisi form wajib yang belum diisi atau belum lengkap, kecuali hari libur; kartu di Outlet dan jadwal, baris di lembar Notifikasi | Kode selesai (Code.gs v0.31, aplikasi 0.31.0), diuji dengan Code.gs asli di atas Spreadsheet tiruan `supabase/src` (39 uji server) dan Chromium (24 uji: Outlet dan jadwal, server lama, lembar Notifikasi Staff dan Pengelola, delapan ukuran). Digabung dan dipasang pemilik 28 Oktober 2026 (Edge Function, Code.gs, `pasangTrigger`) |
| 12+++++++++++++++++++++++++ | Staff membetulkan isiannya sendiri (permintaan pemilik 28 Oktober 2026, dari telaah aplikasi): tombol "Betulkan" di detail Riwayat untuk isian sendiri selama 15 menit sesudah dikirim dan belum diperiksa, kolom dan aturan sama dengan Koreksi Pengelola, tanda "Bisa dibetulkan sampai …" | Kode selesai (Code.gs v0.32, aplikasi 0.32.0), diuji dengan Code.gs asli di atas Spreadsheet tiruan `supabase/src` (43 uji server) dan Chromium (24 uji: HP, desktop, Staff lain, Pengelola, lewat batas, Tandai diperiksa dari layar lama, delapan ukuran). Digabung dan dipasang pemilik 28 Oktober 2026 (Edge Function, Code.gs) |
| 12++++++++++++++++++++++++++ | Ubah banyak item sekaligus (permintaan pemilik 28 Oktober 2026, dari telaah aplikasi): "Ganti harga beberapa item" (satu tanggal berlaku, item tanpa harga mendapat harga pertama sejak awal) dan "Tambah dari Excel/Sheets" (tempelan dengan pratinjau dan baris salah ditandai) dari Pengaturan → Item | Kode selesai (Code.gs v0.33, aplikasi 0.33.0), diuji dengan Code.gs asli di atas Spreadsheet tiruan `supabase/src` (43 uji server; 300 item dengan riwayat panjang 0,1 detik) dan Chromium (60 uji: dua layar, draft, tanggal lain, baris judul dan tanpa judul, sel berkutip, angka ribuan, baris salah tersisa, server lama, delapan ukuran), termasuk perbaikan sesudah telaah berlawanan (butir 368). Digabung dan dipasang pemilik 28 Oktober 2026 (Edge Function, Code.gs) |
| 12+++++++++++++++++++++++++++ | Food cost sementara (permintaan pemilik 28 Oktober 2026, dari telaah aplikasi): selama penjualan bulan itu belum lengkap, perkiraan dari hari yang penjualannya sudah tercatat (pemakaian bahan hari-hari itu ÷ penjualannya), bertanda sementara di kepala layar HPP, kartu Menunggu, grafik 6 bulan (batang pucat), Dashboard, rekap bulanan PDF, dan email rekap | Kode selesai (Code.gs v0.34, aplikasi 0.34.0), diuji dengan Code.gs asli di atas Spreadsheet tiruan `supabase/src` (20 uji server dengan angka dihitung dari data) dan Chromium (29 uji: Dashboard, layar HPP, grafik, server lama, delapan ukuran). Digabung dan dipasang pemilik 28 Oktober 2026 (Edge Function, Code.gs) |
| 12++++++++++++++++++++++++++++ | Email harian lebih lengkap (permintaan pemilik 28 Oktober 2026, dari telaah aplikasi): bagian "Barang masuk" (per pemasok, harga beli, total) dan "Penjualan dan food cost" (penjualan dan porsi hari itu, food cost bulan berjalan sampai tanggal laporan atau sementara) | Kode selesai (Code.gs v0.35; aplikasi tetap 0.34.0), diuji dengan Code.gs asli di atas Spreadsheet tiruan `supabase/src` (27 uji server, email dirender di Chromium). Digabung dan dipasang pemilik 28 Oktober 2026 (Edge Function, Code.gs) |
| 12+++++++++++++++++++++++++++++ | Perlu perhatian dikelompokkan (permintaan pemilik 28 Oktober 2026, dari telaah aplikasi): daftar di Dashboard dibagi "Hari ini" dan "Rutin" (bisa dilipat, terlipat selama ada butir Hari ini, pilihan diingat di HP) | Kode selesai (aplikasi 0.35.0; Code.gs tidak berubah), diuji di Chromium dengan Code.gs asli di atas Spreadsheet tiruan `supabase/src` (20 uji: kelompok, terlipat dan diingat, papan ketik, butir Rutin membuka Riwayat, hanya Rutin, hanya Hari ini, jenis baru, kosong, delapan ukuran). Digabung pemilik 28 Oktober 2026 |
| 12++++++++++++++++++++++++++++++ | Nilai stock barang jadi dari resep (permintaan pemilik 28 Oktober 2026, dari telaah aplikasi): barang jadi tanpa harga satuan dinilai dengan harga dari resepnya pada tanggal itu di nilai stock Dashboard dan rekap bulanan (juga masuk dan penyesuaiannya), "Harga dari resep" di lembar Nilai stock, "dari resep" di Pengaturan → Item | Kode selesai (Code.gs v0.36, aplikasi 0.36.0), diuji dengan Code.gs asli di atas Spreadsheet tiruan `supabase/src` (24 uji server dengan harga resep dihitung tangan) dan Chromium (19 uji: lembar, resep kurang, daftar dan kepala item, server lama, delapan ukuran). Menunggu pemilik: tempel `supabase/functions/api/index.ts` ke `rapid-action` dan Deploy, tempel Code.gs, gabungkan PR |
| 11 | Opsional: foto bukti waste, arsip tahunan, outlet tambahan | Foto bukti waste: kode selesai (Code.gs v0.12, aplikasi 0.12.0), diuji dengan API tiruan (Code.gs di Node dengan Drive tiruan, 12 uji server) dan Chromium (13 uji alur, delapan ukuran). Unggahan ke Drive asli belum bisa diuji di sini. Menunggu pemilik: tempel Code.gs, deploy versi baru, uji dari HP (setupSpreadsheet tidak perlu). Arsip tahunan: lihat baris 12++++++++++. Outlet tambahan: belum |

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
    tanpa rilis (sejak aplikasi 0.15.1: salinan di cache dipakai langsung dan diperbarui di latar, butir 196); navigasi selalu dijawab `index.html`. POST ke API tidak disentuh. Versi baru
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
    dan kolom Penerima email. PIN tidak pernah disimpan di HP. Foto bukti waste disimpan di IndexedDB, bukan
    localStorage (Tahap 11, butir 159).
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
    sejak aplikasi 0.11.1 benar-benar sakelar (butir 152); sebelumnya tombol "Nonaktifkan" / "Aktifkan lagi".
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
    Dibangun di Tahap 11 (butir 156–163).
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
    Chiller). Urutan tab: tanggal terbaru, nama unit, waktu kirim (sejak Code.gs v0.11.1: tanggal, unit, waktu cek, butir 151).
    Tidak ada email seketika.
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
    dan perkiraan biaya di Pengaturan → Resep. Penyesuaian stock tetap memakai harga item itu sendiri saja. Sejak Code.gs v0.13
    harga bahan diambil dari riwayat harga pada tanggal yang dinilai (tanggal waste; hari ini untuk Pengaturan → Resep), butir 164.
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
111. **Nilai stock** (`nilaiStock_` dan blok Nilai stock di Sheet, cara hitung sama): Stock Akhir pada tanggal itu × harga yang berlaku
    pada tanggal itu (riwayat harga, butir 164; untuk hari ini sama dengan Harga Satuan di `M_Item`, yang dipakai Sheet). Dihitung: item aktif, dan item nonaktif yang stock-nya belum nol. Item tanpa harga tidak dihitung dan didaftar terpisah.
    Harga barang jadi dari resep (butir 98) tidak dipakai di sini supaya aplikasi dan Sheet sama; barang jadi tanpa harga muncul di
    daftar "belum punya harga" (dicabut sejak Code.gs v0.36: aplikasi memakai harga dari resep, butir 381). Stock minus ikut dihitung apa adanya (nilainya minus). Nilai bahan terpakai (hanya di Sheet) =
    (Stock Keluar + Dipakai Prep) tiap hari × harga yang berlaku hari itu menurut `M_HargaItem` (sejak Code.gs v0.13, butir 168),
    untuk item yang tidak punya baris aktif di `M_Resep`, dalam periode B3.
112. **Pengaturan → Item** (`#/pengaturan/item`, `-baru`, `/<nama>`): daftar per kategori (urutan kategori) lalu kelompok Nonaktif,
    dengan pencarian; tanda Nonaktif, Belum punya harga, Kategori nonaktif. Layar ubah: nama, kategori dan satuan dasar (`<select>`;
    pilihan nonaktif hanya tampil jika itu nilai sekarang), sakelar "Datang dalam kemasan besar" (`role=switch`, kata Ya/Tidak) dengan
    kalimat "1 [dus] berisi [12] botol", harga (2 angka di belakang koma; sejak Code.gs v0.13 hanya untuk harga pertama, butir 167 dan 169), stok minimum, stok maksimum. Draft `draft:item:<nama>` /
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
      sebagai nilai. Sejak Code.gs v0.13 (butir 167): nilai = jumlah per hari (dari rekap `Stock_Harian` bulan itu) × harga yang
      berlaku pada hari itu, bukan harga sekarang. Bahan terpakai = (Stock Keluar + Dipakai Prep) × harga untuk item tanpa resep
      aktif (Bagian 8.5, butir 111). Penyesuaian termasuk hasil stock opname. Kolom "Selisih harga (Rp)" per kategori dan total
      (Bagian 8.5). Nilai stock akhir bulan = `nilaiStock_` pada tanggal terakhir, dengan harga yang berlaku pada tanggal itu. Kategori yang semua
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
    - ~~Foto bukti waste (sistem 5.4, tampilan 5.3): belum dibangun, digabung dengan Tahap 11 (butir 81).~~ Beres di Code.gs v0.12,
      aplikasi 0.12.0 (butir 156–163).
    - Arsip data tahunan (sistem 8.4) dan outlet tambahan (sistem 3): Tahap 11 (opsional).
    - ~~Waste: "geser kartu ke kiri" untuk menghapus baris (tampilan 5.3) tidak dibangun; yang ada ikon tempat sampah. Kartu yang
      mengikuti jari butuh gerak yang dihitung JavaScript tiap bingkai, yang dilarang Bagian 8.2 butir 1.~~ Beres di aplikasi
      0.11.1 (butir 153).
    - Pengaturan → Form: urutan diubah dengan tombol naik/turun lalu "Simpan urutan" (butir 137), bukan pegangan geser (tampilan
      5.7), dengan alasan yang sama dan supaya bisa dipakai dengan papan ketik.
    - ~~Pengaturan → Staff: "sakelar Aktif/Nonaktif" (tampilan 5.7) berupa tombol "Nonaktifkan" (dengan konfirmasi) / "Aktifkan
      lagi" (butir 76).~~ Beres di aplikasi 0.11.1 (butir 152).
    - PDF stock semua kategori satu halaman per kategori (sistem 9.1) baru berlaku setelah pemilik menjalankan
      `ujiPemisahHalamanPdf` dan hasilnya "ya"; bawaannya satu tabel bersambung (butir 77).
    - ~~Urutan `Data_Suhu`: tanggal, unit, lalu waktu kirim (butir 86), bukan unit lalu waktu cek (sistem 8.4); Opening, Middle,
      Closing biasanya dikirim berurutan, jadi hasilnya hampir selalu sama.~~ Beres di Code.gs v0.11.1 (butir 151).
    - Menu Laporan Pengelola punya tiga tombol utama (satu per kartu: Laporan harian, Daftar belanja yang memang disebut "tombol
      utama" di tampilan 5.9, dan Rekap bulanan), padahal tampilan Bagian 6 menyebut tombol utama satu per layar.
    - Rekap bulanan, kelengkapan Suhu, dan pengecekan terlewat memakai unit aktif dan jadwal form **sekarang**, bukan keadaan
      pada bulan itu (spesifikasi tidak mengatur; tidak ada riwayat perubahan master).
    - Belum bisa diuji di sini: hasil rumus dan grafik di Google Sheets, konversi HTML ke PDF milik Google (termasuk h2/h3 rekap),
      pengiriman email asli, trigger asli, huruf perangkat diperbesar 200% (tampilan Bagian 9), dan pemasangan PWA di HP.
    - Catatan rapi: nomor butir 118–121 di CLAUDE.md dipakai dua kali (perbaikan Dashboard v0.8.1 dan Tahap 8); rujukan lama
      tetap, jadi tidak dinomori ulang.

### Perbaikan tiga penyimpangan butir 150 (Code.gs v0.11.1, aplikasi 0.11.1, 7 Oktober 2026)

151. **Urutan `Data_Suhu`** (sistem Bagian 8.4): tanggal terbaru di atas, lalu nama unit (huruf besar/kecil tidak dibedakan),
    lalu waktu cek Opening, Middle, Closing, Cek ulang; beberapa cek ulang menurut `timestamp_server`, lalu urutan baris semula.
    Waktu cek yang tidak dikenal di urutan terakhir. `Range.sort` tidak mengenal urutan khusus, jadi `urutkanSuhu_` (dipanggil
    `aksiKirimSuhu_` menggantikan `urutkanTabel_`) membaca semua kolom yang ada, mengurutkan di memori, lalu menulis balik hanya
    rentang baris yang berpindah (tidak menulis apa pun jika sudah urut). Yang ditulis hanya nilai, jadi format kolom, format
    bersyarat, dan filter tetap; teks yang diawali `=`, `+`, `-`, atau `@` ditulis lagi lewat `teksAman_` supaya tetap teks seperti
    saat dicatat. Baris tanpa tanggal turun ke bawah seperti pada `Range.sort` (butir 38). Seluruh tab diurutkan setiap kiriman
    Suhu baru (kiriman ganda dan kiriman yang ditolak tidak menulis), jadi data lama ikut rapi pada kiriman berikutnya tanpa
    menjalankan `setupSpreadsheet`. **Tidak bergantung pada urutan baris:** blok Suhu di Dashboard dan kolom Suhu di blok Kepatuhan
    memakai COUNTIFS/AVERAGEIFS/MINIFS/MAXIFS dan "terakhir" dari `MAXIFS(timestamp_server)`; layar isi Suhu, grafik Dashboard,
    PDF, dan email mengurutkan sendiri menurut waktu kirim. Rumus `Harian_Suhu` (A9) diubah supaya juga tidak bergantung: Nama
    Staff dan Tindakan Korektif kini disusun Opening, Middle, Closing (dulu menurut urutan baris), dan baris cek ulang diurutkan
    `SORT` menurut `timestamp_server`. Nama LET baru `nm` dan `tk` (butir 120). Rumus itu baru terpasang setelah
    `setupSpreadsheet` dijalankan sekali; sampai itu, rumus lama tetap benar karena urutan tab menjaga cek ulang tetap urut waktu
    kirim. "Diisi oleh" di bawah tabel Harian (bersama semua tab Harian) tetap berupa daftar nama menurut urutan baris.
152. **Sakelar Aktif/Nonaktif** (tampilan 5.7) di kartu "Keadaan akun" layar ubah staff, memakai komponen `sakelarTampil` (kini
    juga menerima `kataYa`/`kataTidak` untuk kata selain Tampil/Disembunyikan): label "Akun Rina", kata "Aktif"/"Nonaktif", lalu
    kalimat keadaannya. Mematikan sakelar membuka konfirmasi yang sama seperti tombol lama ("Nonaktifkan Rina?"); Batal
    mengembalikan sakelar ke Aktif. Menyalakan langsung tersimpan (sakelar nonaktif selama menyimpan; gagal → kembali ke Nonaktif
    dengan pesan). Fokus papan ketik kembali ke sakelar setelah layar digambar ulang. Kartu ini kini juga tampil untuk akun
    sendiri: sakelar nonaktif (jalur pudar, kata tetap terbaca) dengan keterangan di bawahnya (`aria-describedby`). Sebab
    diperiksa dengan urutan yang sama dengan server (butir 76): Pengelola aktif terakhir (aktif, punya PIN, Head Kitchen atau
    Manager, dihitung dari jawaban `daftarStaff`) → "Kamu / Sari adalah Head Kitchen atau Manager aktif yang terakhir. Tambah
    atau aktifkan …"; akun sendiri → "Keadaan akunmu sendiri diubah oleh Head Kitchen atau Manager lain." Kalimat di kartu Role
    untuk akun sendiri menjadi "Role akunmu sendiri diubah …" supaya tidak berulang. Aturan dan letak Hapus tidak berubah.
153. **Geser kartu Waste ke kiri untuk menghapus** (tampilan 5.3), `pasangGeserHapus(kartu, hapus)` di app.js, dipasang pada kartu
    ringkas dan kartu terbuka di HP dan tablet (tidak pada tabel laptop/desktop). Pointer Events, hanya sentuhan dan pena (bukan
    tetikus), hanya jari pertama. Kelas `.kartu-geser` memberi `touch-action: pan-y pinch-zoom` (gulir tegak dan cubit-perbesar
    tetap milik browser). Arah diputuskan setelah 10 px: tegak atau ke kanan dilepas ke browser; ke kiri diambil (pointer capture)
    dan kartu mengikuti jari lewat `transform` inline (masukan langsung, bukan animasi yang dihitung tiap bingkai, Bagian 8.2 butir
    1). Lepas setelah lebih dari sepertiga lebar kartu: kelas `.geser-keluar` (transform ke −100% dan opacity 0, 200 ms ease-in),
    lalu pada `transitionend` (cadangan 250 ms) dipanggil `hapusBaris` yang sama dengan ikon tempat sampah (draft, penghitung, dan
    pesan "Tomat dihapus dari isian."). Lepas sebelum batas atau `pointercancel`: kembali ke tempat (`.geser-kembali`, 150 ms
    ease-out). Klik yang menyusul geseran ditahan 400 ms supaya kartu ringkas tidak terbuka. Geseran yang dimulai di `input`,
    `textarea`, `select`, atau `[contenteditable]` diabaikan. "Kurangi gerak": kartu tidak mengikuti jari (juga dijaga CSS) dan
    `hapusBaris` langsung dipanggil saat jari dilepas melewati batas (aturan lepas sama, hanya tanpa gerak). Ikon tempat sampah
    tetap ada (bisa dipakai dengan papan ketik dan pembaca layar).
154. **Versi:** Code.gs v0.11.1 (`VERSI_KODE` juga), aplikasi 0.11.1 (`VERSI_APLIKASI` dan `VERSI` di sw.js). Tidak ada aksi API,
    tab, atau kolom baru.
155. **Uji** (di luar repo): Code.gs dijalankan di Node dengan tiruan SpreadsheetApp yang meniru kutip di depan teks dan `=` sebagai
    rumus (8 uji server: data lama urutan Tahap 5 dirapikan oleh kiriman berikutnya, 35 kiriman Suhu acak di empat tanggal dengan
    cek ulang berulang tersusun sesuai butir 151 setelah tiap kiriman, isi sel tetap sama termasuk teks diawali `-` dan `=`, kiriman
    ganda, tolak waktu cek yang sudah diisi tanpa menulis, tab yang sudah urut tidak ditulis, layar isi/Riwayat/PDF/Beranda/Dashboard
    Suhu tetap jalan, rumus `Harian_Suhu` seimbang dan tanpa nama LET beda huruf; uji yang sama gagal pada Code.gs v0.11). Frontend
    di Chromium dengan API tiruan yang memanggil `doPost` asli: 11 uji staff (aktif, Batal, nonaktif dengan konfirmasi, aktifkan
    langsung, papan ketik, akun sendiri, akun sendiri sebagai Pengelola terakhir, Pengelola terakhir bukan akun sendiri dengan data
    `daftarStaff` yang diubah, penolakan server, delapan ukuran untuk staff aktif, nonaktif, dan akun sendiri) dan 11 uji Waste
    dengan sentuhan CDP (lewat batas dengan pemeriksaan transisi 200 ms ease-in, kurang dari batas, ikon sampah, mulai di kolom
    isian, gulir tegak, "kurangi gerak", tablet 768, tabel 1366, tetikus, delapan ukuran), ditambah sapuan 16 rute pada 390 dan
    1366 px tanpa masalah tata letak atau galat konsol.

### Tahap 11: foto bukti waste (Code.gs v0.12, aplikasi 0.12.0, 7 Oktober 2026)

156. **Versi:** Code.gs v0.12 (`VERSI_KODE` juga), aplikasi 0.12.0 (`VERSI_APLIKASI` dan `VERSI` di sw.js). Tidak ada tab, kolom,
    atau rumus Sheet baru (kolom `Foto Bukti` sudah ada sejak Tahap 0), jadi `setupSpreadsheet` tidak perlu dijalankan ulang.
    Izin Google tidak bertambah: DriveApp (buat folder dan file) sudah dipakai sejak Tahap 4.
157. **Layar Waste** (tampilan 5.3): tiap item boleh punya satu foto bukti (tidak wajib), di bawah Alasan / keterangan, berjudul
    "Foto bukti (tidak wajib)". Perangkat sentuh: dua tombol, "Ambil foto" (`<input type=file accept="image/*"
    capture="environment">`, langsung kamera belakang) dan "Pilih dari galeri" (tanpa `capture`, karena `capture` di Android dan
    iPhone melewati galeri); laptop/desktop satu tombol "Pilih foto". Tombol berupa label berisi input file yang tersembunyi tetapi
    tetap bisa difokus papan ketik. Sesudah dipilih: pratinjau 64 px, "Foto tersimpan di HP", ukurannya, dan "Hapus foto"; memilih
    lagi mengganti foto lama. Kartu ringkas menulis "· ada foto"; tabel laptop/desktop punya kolom "Foto bukti" (tanpa kalimat
    "Foto tersimpan di HP" supaya ringkas). Pesan per item (memproses, tidak terbaca, terlalu besar, penyimpanan penuh) tampil di
    bawah tombol foto. Menghapus baris (ikon sampah atau geser) ikut membuang fotonya.
158. **Diperkecil di HP** (`perkecilFoto`): semua perangkat, bukan hanya HP (aturan sama, lebih sederhana). Gambar dibuka lewat
    `<img>` dari object URL lalu digambar ke canvas: sisi terpanjang paling banyak 1280 px (gambar kecil tidak diperbesar), latar
    putih (untuk PNG transparan), `toDataURL('image/jpeg', 0.7)`. Arah foto mengikuti EXIF karena browser modern menerapkannya saat
    gambar digambar ke canvas. Gambar yang tidak bisa dibuka browser (misalnya HEIC di browser yang tidak mendukungnya): "Foto tidak
    bisa dibaca. Coba foto lain, atau ambil dengan kamera." Hasil di atas 2 MB ditolak di HP dengan batas yang sama dengan server.
159. **Foto di HP: IndexedDB** (`FotoHp`), basis data `inventoryku-foto`, satu tempat `foto`, kunci `<nama pengguna>|<id>`, isi
    `{ data (base64), mime, ukuran, waktu }`. Draft Waste (`draft:waste`) hanya menyimpan `foto: { id, ukuran }`, antrean hanya
    `fotoId` per baris, sehingga localStorage tetap kecil. `kirimIsian(aksi, isi)` (app.js) dipakai layar Waste dan antrean: foto
    dibaca dari IndexedDB, dikirim sebagai `foto` (base64) per baris, batas waktu panggilan ditambah 20 detik per foto (paling lama
    3 menit), dan foto dihapus dari HP hanya setelah server menjawab berhasil (termasuk `sudahTerkirim`). Tanpa sinyal, kiriman dan
    fotonya menunggu di HP; foto ikut hilang saat isian antrean yang gagal dihapus dari lembar "Isian di HP". Judul isian di antrean
    menyebut jumlah fotonya ("Waste · 2 item, 1 foto"). Foto yang sudah hilang dari HP saat dikirim (data browser dibersihkan) dikirim
    tanpa foto dan disebut di pesan sesudah terkirim. Saat layar Waste dibuka, foto milik pengguna itu yang tidak dirujuk draft atau
    antrean lagi dibuang (`FotoHp.bersihkan`); foto pengguna lain tidak disentuh. **IndexedDB tidak tersedia** (atau ditolak browser):
    tombol foto diganti "Foto bukti tidak bisa disimpan di HP ini, karena penyimpanan browser tidak tersedia. Waste tetap bisa
    dikirim tanpa foto." Penyimpanan penuh saat menyimpan foto: "Foto tidak bisa disimpan di HP (ruang penyimpanan mungkin penuh).
    Waste tetap bisa dikirim tanpa foto."
160. **Server** (`aksiKirimWaste_`, `bacaFotoWaste_`, `simpanFotoWaste_`): `foto` per baris boleh berawalan data URL; jenisnya
    dikenali dari isi file (JPEG, PNG, WebP; lainnya "Foto bukti Tomat tidak terbaca. Hapus fotonya, lalu ambil lagi."). Batas
    2 MB per foto (`BATAS_FOTO_BYTE`, "Foto bukti Selada terlalu besar (3 MB). Batasnya 2 MB. …", diperiksa dari panjang base64
    sebelum dibuka) dan 15 MB per kiriman (`BATAS_FOTO_KIRIMAN_BYTE`). Semua pemeriksaan (item, qty, kategori, foto) selesai sebelum
    apa pun ditulis, jadi kiriman yang ditolak tidak meninggalkan file. Urutan: kiriman ganda dikenali lebih dulu (tanpa menyimpan
    foto lagi) → foto disimpan ke Drive **sebelum** kunci diambil, supaya penulis lain tidak menunggu unggahan → di dalam kunci
    `submission_id` diperiksa lagi, baris ditulis, stock dihitung ulang. Folder `Laporan Kitchen/{Nama Outlet}/Foto waste/{YYYY}/{MM
    Bulan}/` (`folderFotoWaste_`, memakai `folderOutlet_` bersama folder laporan), nama file `{tanggal}_{Item}_{8 huruf awal
    submissionId}-{no baris}.{jpg|png|webp}`. Nama itu tetap untuk kiriman yang sama, jadi kiriman yang diulang setelah terputus di
    tengah (foto sudah tersimpan, baris belum) memakai file yang ada. Kolom `Foto Bukti` berisi tautan file (`getUrl()`), teks
    biasa yang bisa diklik di Sheet. File tidak dibagikan khusus: yang bisa membukanya adalah akun yang diberi akses ke folder
    `Laporan Kitchen` (sistem 7.3). Jika Drive gagal menyimpan foto, waste tetap tercatat (stock tetap turun) tanpa foto itu, dan
    jawaban `fotoGagal` membuat HP menulis "Waste terkirim. Foto bukti Tomat gagal disimpan ke Drive, jadi waste itu tercatat tanpa
    foto." (di layar, atau di pesan "n isian terkirim." untuk antrean).
161. **Riwayat Waste** (keputusan): semua role melihat tanda foto (ikon kamera di daftar, "Ada foto bukti" di detail), tetapi
    **tautan ke Drive hanya untuk Pengelola** ("Lihat foto", tab baru). Staff membaca "Ada foto bukti (dilihat Head Kitchen atau
    Manager)." karena Staff tidak punya akses ke folder Drive (sistem 7.3 dan 9.1), jadi tautan hanya akan membuka halaman tolak
    akses. Tautan tidak dikirim server ke Staff sama sekali: `doPost` mencatat pengguna aksi di `PENGGUNA_AKSI_`, dan
    `barisRiwayat_` hanya mengisi `fotoUrl` jika pengguna itu Pengelola (berlaku untuk `riwayat`, `detailKiriman`, dan jawaban
    laporkan/koreksi/periksa). Foto tidak bisa ditambah, diganti, atau dihapus dari Riwayat (koreksi Waste tidak menyentuh kolom
    `Foto Bukti`); foto yang keliru diurus pemilik langsung di Drive.
162. **PDF Waste:** baris yang punya foto diberi tulisan kecil "(ada foto bukti)" di bawah nama item, dan catatan di bawah tabel
    menyebut folder Drive-nya. Foto tidak dimasukkan ke PDF (ukuran file). Email harian dan tab `Harian_Waste` tidak berubah.
163. **Uji Tahap 11** (di luar repo): Code.gs di Node dengan tiruan SpreadsheetApp dan Drive (folder dan file di memori): 12 uji server
    (tanpa foto, dua foto JPEG dan PNG di folder dan nama yang benar, kiriman ganda, kiriman diulang setelah foto tersimpan,
    terlalu besar, bukan gambar, batas 15 MB per kiriman, Drive gagal, Riwayat/detail/laporan kekeliruan Staff tanpa tautan dan
    Pengelola dengan tautan, koreksi tidak mengubah foto, PDF, kiriman Staff). Chromium dengan API tiruan yang memanggil `doPost`
    asli dan PNG 2400×1600 (10 MB): 13 uji (tombol kamera/galeri dan `capture`, foto diperkecil ke 1280×853 JPEG di IndexedDB,
    tetap ada setelah layar dibuka lagi, Hapus foto, kirim dengan dan tanpa foto, tanpa sinyal lalu sinyal kembali, jawaban putus
    sesudah server menyimpan lalu kirim ulang tanpa file ganda, foto 3 MB ditolak di layar dan di antrean lalu Hapus membuang
    fotonya, Riwayat Pengelola dan Staff, tanpa IndexedDB, hapus baris dan pembersihan foto yatim, tabel laptop, delapan ukuran
    untuk layar Waste berfoto dan detail Riwayat berfoto). Uji Suhu, staff, geser kartu Waste, dan sapuan 16 rute tetap lulus.

### Riwayat harga item (Code.gs v0.13, aplikasi 0.13.0, 11 Oktober 2026)

164. **Keputusan pemilik:** harga satuan punya riwayat (tab master `M_HargaItem`: Nama Item, Berlaku Mulai, Harga Satuan (Rp),
    Dicatat Oleh, Dicatat Pada; spesifikasi sistem Bagian 5.1 dan 8.5, tampilan Bagian 5.6 dan 5.7). Satu fungsi bersama:
    `bacaRiwayatHarga_()` membaca tab sekali per permintaan (`MEMO_HARGA_`, dibuang `resetMemoForm_` dan setiap kali harga
    ditulis), `hargaPada_(m, tanggal)` memberi harga yang berlaku (baris dengan Berlaku Mulai terbesar yang tidak melewati tanggal;
    kosong = sejak awal), `itemPadaTanggal_(tanggal)` memberi salinan master dengan harga tanggal itu. Item yang sama sekali belum
    punya baris riwayat (tab belum dibuat, atau item diisi tangan di Sheet) memakai Harga Satuan `M_Item` untuk semua tanggal,
    sama dengan rumus Sheet. Dua baris item yang sama dengan tanggal yang sama (diisi tangan): yang lebih atas dipakai.
    Baris yang tanggalnya tidak terbaca atau harganya bukan angka dilewati.
165. **Yang memakai harga tanggal:** estimasi waste (`formWaste` dan `kirimWaste`, tanggal waste; harga barang jadi dari resep
    memakai harga bahan tanggal itu), Nilai Selisih penyesuaian dan opname (tanggal penyesuaian/opname; `formOpname.item[].harga`
    juga), nilai stock (`nilaiStock_` pada tanggal yang dinilai), Pengaturan → Resep (hari ini), Dashboard aplikasi, dan rekap
    bulanan. Nilai yang sudah tersimpan (Harga Satuan dan Estimasi Kerugian di `Data_Waste`, Nilai Selisih di `Data_Penyesuaian`
    dan `Data_Opname`) tidak dihitung ulang saat riwayat diubah; koreksi Waste tetap memakai harga yang tercatat di baris (butir 84).
    Email harian tidak menghitung harga (total waste memakai estimasi yang tersimpan), jadi tidak berubah.
166. **Mengganti harga** (aksi `gantiHarga`, khusus Pengelola): harga wajib (0 atau lebih, 2 angka di belakang koma), Berlaku Mulai
    hari ini atau tanggal yang sudah lewat (masa depan ditolak di HP dan server). Tanggal yang sudah punya baris untuk item itu:
    Harga Satuan, Dicatat Oleh, dan Dicatat Pada baris itu ditimpa, dan `Log_Perubahan` mencatat Tab `M_HargaItem`, row_id
    "Tomat · 2026-10-06", kolom Harga Satuan (Rp) (dan Dicatat Oleh jika orangnya berbeda); harga yang sama persis ditolak dengan
    pesan. Item tanpa riwayat tetapi berharga di `M_Item` mendapat baris harga awal (Berlaku Mulai kosong, Dicatat Oleh "Harga
    awal") lebih dulu, supaya harga lamanya tetap berlaku sebelum tanggal itu. Sesudahnya Harga Satuan `M_Item` disamakan dengan
    harga hari ini (`samakanHargaMItem_`). Baris harga awal (sejak awal) tidak bisa dibetulkan dari aplikasi, karena lembar Ganti
    harga hanya menawarkan Hari ini atau tanggal lain; pemilik Sheet membetulkannya langsung di `M_HargaItem` (proteksi peringatan).
    Riwayat tidak bisa dihapus dari aplikasi.
167. **Harga pertama dan `simpanItem`:** item baru, atau item lama yang belum punya harga sama sekali, mengisi harga di isian item
    seperti dulu; harga itu ditulis ke `M_Item` dan satu baris `M_HargaItem` dengan Berlaku Mulai kosong (sejak awal, oleh
    pengguna itu). Item yang sudah punya harga: isian harga diganti kartu "Harga satuan" (lihat butir 169) dan `simpanItem`
    mengabaikan harga yang kosong atau sama dengan harga sekarang (aplikasi lama mengirim harga sekarang), dan menolak harga yang
    berbeda ("... diganti lewat tombol Ganti harga ..."). Mengganti nama item (hanya selama belum punya catatan, butir 112) ikut
    mengganti nama di semua baris `M_HargaItem` item itu.
    **Rekap bulanan:** gerakan per hari (masuk, bahan terpakai, penyesuaian) × harga yang berlaku hari itu; hari tanpa harga tidak
    dihitung dan itemnya disebut di catatan ("belum punya harga pada sebagian atau semua harinya"). Kolom baru "Selisih harga (Rp)"
    per kategori dan total (bertanda +), dari perubahan harga yang berlaku mulai tanggal di bulan itu; "–" untuk kategori tanpa
    perubahan harga. Catatan PDF dan ringkasan email ("Selisih karena perubahan harga: +Rp 182.000 (2 item berganti harga)")
    diperbarui. Angka bulan lalu berubah hanya jika riwayat harga untuk tanggal di bulan itu diubah (diuji).
168. **Selisih karena perubahan harga** (`selisihHarga_(master, rekap, dari, sampai)`): untuk tiap dua baris riwayat berurutan
    (h0, lalu h1 yang berlaku mulai D, D di dalam periode, h1 ≠ h0): Stock Akhir pada D−1 × (h1 − h0); perubahan dari belum punya
    harga ke harga pertama tidak ada (tidak ada h0). Selisih per perubahan dan per item dibulatkan ke rupiah, total dari nilai
    tanpa bulat. Item urut nilai selisih terbesar (mutlak). Dashboard aplikasi: bulan berjalan (tanggal 1 sampai tanggal Dashboard).
    **Rumus tab Dashboard** (blok Nilai stock, `letNilaiStock_`): nilai stock tetap Stock Akhir × Harga Satuan `M_Item` (= harga hari
    ini); bahan terpakai per periode B3 kini memakai harga harian: baris `Stock_Harian` dalam periode difilter sekali (`prS`, `prT`,
    `prI`, `prK`, `prD`), satu MAP menghitung harga tiap baris (`prH`: `MAXIFS` Berlaku Mulai ≤ tanggal, lalu `FILTER` harga dengan
    tanggal itu; MAXIFS 0 dan sel kosong sama dengan 0, jadi baris harga awal ikut ketemu; item tanpa baris riwayat memakai `M_Item`
    lewat `XLOOKUP` skalar), lalu `SUMPRODUCT` per item. Tanpa LAMBDA bersarang dan tanpa `XLOOKUP(1,(…)*(…))` (butir 120a); nama
    LET baru (`hgM`, `rwN`, `rwT`, `rwH`, `rwM`, `pr*`) tidak bertabrakan beda huruf (butir 120b). Rumus baru terpasang setelah
    `setupSpreadsheet`; hasilnya di Google Sheets belum bisa diuji di sini.
169. **Pengaturan → Item** (tampilan 5.7): item berharga menampilkan kartu "Harga satuan": "Harga sekarang Rp 15.000 (sejak 7 Okt)"
    (tanpa "sejak" untuk harga awal; tahun ditulis jika bukan tahun ini), keterangan per satuan, tombol "Ganti harga", lalu "Riwayat
    harga" (10 terakhir, terbaru di atas: harga, "naik Rp 2.000"/"turun Rp 500"/"sama" dalam kata, "Mulai 7 Okt" atau "Sejak awal",
    pencatat; jika lebih dari 10: "10 perubahan terakhir dari 13. Semuanya ada di tab M_HargaItem."). Lembar "Ganti harga Tomat":
    harga sekarang, "Harga baru (Rp)", "Berlaku mulai" (Hari ini / Tanggal lain dengan pemilih tanggal, maksimal hari ini), dan
    kalimat akibat yang berubah langsung: "Harga Rp 15.000 yang berlaku mulai 7 Okt diganti." (tanggal yang sudah punya harga),
    "Harga lama Rp 13.000 tetap dipakai untuk catatan sebelum tanggal ini." (ditambah "Harga Rp 15.000 tetap berlaku mulai 12 Okt."
    jika ada perubahan sesudahnya), atau "Sebelum tanggal ini Tomat belum punya harga."; tombol "Batal" dan "Simpan harga"; galat
    tampil di lembar. Sesudah tersimpan: pesan "Harga Tomat tersimpan." dan layar digambar ulang (isian yang sedang diketik tetap).
    Butuh sinyal (tidak masuk antrean), seperti Pengaturan lain.
170. **Lembar Nilai stock** (Dashboard): baris "Selisih karena perubahan harga bulan ini" (nilai bertanda, "n item berganti harga
    sejak 1 Okt. Ketuk untuk rinciannya." atau "Tidak ada harga yang berganti sejak 1 Okt." sebagai baris diam). Ketukan membuka
    lembar "Selisih harga +Rp 139.000": penjelasan rumus, lalu per item tiap perubahan ("6 Okt: Rp 13.000 → Rp 15.000 per kg, stock
    26 kg, +Rp 52.000") dan selisih item; tombol "Kembali" membuka lagi lembar Nilai stock. **Layar Waste:** tidak berubah; ia sudah
    memuat ulang `formWaste` saat tanggal diganti, jadi perkiraan estimasi di HP memakai harga tanggal waste. Tanpa sinyal untuk
    tanggal yang belum pernah dimuat, HP memakai harga dari data terakhir (perkiraan saja; server menghitung ulang saat menerima).
171. **setupSpreadsheet:** membuat tab `M_HargaItem` (master, warna dan proteksi peringatan seperti master lain, dropdown Nama Item
    dari `M_Item`, format tanggal, rupiah, dan waktu; masuk `KUNCI_MASTER`, jadi ikut dirapikan butir 79), lalu `isiHargaAwal_`
    menambah satu baris harga awal (Berlaku Mulai kosong, Dicatat Oleh "Harga awal") untuk tiap item yang punya Harga Satuan di
    `M_Item` tetapi belum punya baris riwayat. Menjalankan ulang tidak menggandakan baris. Sebelum setupSpreadsheet dijalankan,
    aplikasi tetap jalan dengan harga `M_Item` (butir 164); Ganti harga dan harga pertama item menolak dengan petunjuk menjalankan
    setupSpreadsheet.
172. **Uji** (di luar repo; tiruan Apps Script ditulis ulang karena tiruan tahap sebelumnya tidak tersimpan): Code.gs di Node dengan
    tiruan SpreadsheetApp/Utilities/Properties/Drive/Mail dan data September–Oktober dengan harga Tomat berubah tiap minggu: 26 uji
    (harga per tanggal, waste kemarin dengan harga kemarin, ganti harga mundur, membetulkan tanggal yang sama dengan Log_Perubahan,
    rekap September dihitung tangan termasuk selisih harga, rekap bulan lalu tetap setelah harga Oktober diganti dan berubah jika
    harga September diubah, selisih harga Dashboard, item belum punya harga, harga barang jadi dari resep pada tiga tanggal,
    penyesuaian dan opname, setupSpreadsheet dua kali, harga awal untuk item yang diisi tangan, simpanItem menolak harga berbeda,
    ganti nama, Staff ditolak, rumus seimbang dan nama LET aman) ditambah 32 pemeriksaan regresi (Beranda, semua form, Riwayat,
    koreksi Waste, PDF harian, rekap, belanja, opname, email harian dan rekap). Chromium dengan API tiruan yang memanggil `doPost`
    asli: lihat butir 173.
173. **Uji Chromium** (di luar repo; API tiruan lewat `context.route` yang memanggil `doPost` asli di tiruan Node): 11 uji (kartu
    harga dan riwayat dengan naik/turun; lembar Ganti harga dengan kalimat akibat untuk tanggal yang sudah punya harga, tanggal
    lain, dan perubahan sesudahnya, tanggal masa depan ditolak, simpan; angka salah dan penolakan server tampil di lembar; item
    tanpa harga tetap punya isian harga; item baru lalu kartu harga; riwayat lebih dari 10; lembar Nilai stock dengan baris selisih
    dan rinciannya (+Rp 139.000 dihitung tangan); Waste hari ini Rp 29.000 vs kemarin Rp 30.000 untuk 2 kg; delapan ukuran
    Bagian 4.6 untuk layar item, lembar Ganti harga (tombol Simpan harga terlihat), lembar Nilai stock, rincian selisih, dan Waste;
    "kurangi gerak" tanpa animasi; tanpa galat konsol), ditambah sapuan 22 rute pada 390 dan 1366 px tanpa gulir ke samping, kotak
    galat, atau galat konsol.
174. **Belum terpenuhi atau menyimpang** (riwayat harga): hasil rumus bahan terpakai di tab Dashboard belum bisa diuji di Google
    Sheets (butir 168; jika galat, `periksaSelRumus_` mencatatnya di log setupSpreadsheet); baris harga awal (sejak awal) tidak bisa
    dibetulkan dari aplikasi (butir 166); blok Nilai stock di Sheet tetap memakai Harga Satuan `M_Item`, jadi selisih karena
    perubahan harga hanya ada di aplikasi dan rekap bulanan, tidak di tab Dashboard (spesifikasi tidak memintanya di Sheet).

### Arah premium, spesifikasi tampilan 1.7 (aplikasi 0.14.0, 11 Oktober 2026)

175. **Asal:** pemilik memilih "pakai arah ini" dari pratinjau perbandingan (artifact "InventoryKu Tampilan Premium"). Spesifikasi
    tampilan naik ke versi 1.7: Bagian 1 (sinematik di kepala setiap layar), 2 (token Garis Halus, Navy Dalam, Navy Lapis, Garis
    Navy; bayangan lembut menggantikan garis tepi kartu; tekstur garis halus hanya di navy), 3 (angka utama Barlow Condensed,
    judul layar 34 px, hari di atas tanggal Beranda), 4.2/4.3 dan Bagian baru 4.7 (kepala navy setiap layar), 4.4 (sudut tiket 6,
    kartu 14, isian dan tombol 10), 5.2 (tiket berikon, potongan sobek, rel 6 px), 5.6 (Nilai stock di kepala, ubin berikon yang
    menggantung, cincin Form terisi, ubin ikon di Perlu perhatian, grafik kosong bersumbu), 5.7 (grafik tangga harga, garis waktu
    naik/turun), 6 (komponen), 10 dan 11. Code.gs tidak berubah.
176. **Kepala navy bersama** (`pasangKepalaLayar` di router, dipanggil setelah `rute.layar`): layar tetap menulis `tautanKembali`,
    `h1.judul-layar` atau `.kepala-isi` (judul + Tambah), dan `.kepala-ringkas` di awal `.layar-isi`; router MEMINDAHKAN (bukan
    menyalin) ketiganya ke `header.kepala-layar` selebar layar, jadi rujukan layar ke judul tetap hidup. Layar tanpa h1 (detail
    Riwayat di HP) mendapat judul dari bar (`data-dari-bar`, ikut `aturJudul`). `.layar-isi.kepala-gantung` membuat kepala
    `gantung` (Dashboard). Beranda tetap punya `beranda-kepala` sendiri. Kelas `ada-kepala` di `#aplikasi`: di HP dan tablet
    bar atas disembunyikan seperti di Beranda (kepala ikut bergulir, judul tidak lagi menempel di atas; bar navigasi bawah tetap),
    status sinyal ada di baris atas kepala; di desktop bar atas tetap dan sinyal kepala disembunyikan. Pita sinyal ditaruh di
    atas kepala navy (`tempatkanPita`). Tombol utama di kepala (Tambah) berlatar Kertas dengan teks Navy Pass.
177. **Ringkasan di kepala** hanya untuk dua layar: Pengaturan → Item (chip kategori, satuan, keadaan; Stock hari ini dan Harga
    sekarang dengan "sejak …"; diperbarui `perbaruiRingkas` juga saat isian sedang diketik) dan Dashboard (`kotakNilaiStock`:
    nilai, selisih harga bulan ini, item tanpa harga; tombol membuka lembar Nilai stock; penanda "Memperbarui…" ikut di kepala
    supaya ubin tetap menempel di tepinya). Layar lain cukup judul.
178. **Dashboard:** ubin Nilai stock pindah ke kepala, jadi angka ringkas tinggal lima ubin berikon (HP dan tablet dua kolom dengan
    "Form terisi" selebar dua kolom dan cincin kemajuan; desktop lima sejajar, cincin disembunyikan) yang menumpuk 40 px (desktop
    56 px) di tepi kepala dengan bayangan tiket. Perlu perhatian: tiap baris diawali `ubinIkon(tingkat, ikon)` menurut jenis
    (`IKON_PERHATIAN`), judulnya tebal dengan kata tingkat untuk pembaca layar ("Perlu ditinjau: …"); tanda status kapsul tidak
    dipakai lagi di daftar ini. Grafik waste kosong menggambar garis dasar dan nama hari dengan kalimatnya di tengah; grafik suhu
    kosong menggambar pita batas unit aktif tanpa titik.
179. **Grafik tangga harga:** anak tangga sama lebar per harga (urutan, bukan skala waktu, supaya perubahan yang berdekatan tetap
    terbaca), dari 10 riwayat yang dikirim server; garis SVG `preserveAspectRatio="none"` dengan `vector-effect:
    non-scaling-stroke`, label harga terendah/tertinggi, tanggal awal dan "Hari ini", serta titik harga sekarang berupa HTML
    supaya tidak gepeng; `role="img"` dengan uraian lengkap. Tampil jika ada dua harga atau lebih.
180. **Tekstur navy:** `repeating-linear-gradient` garis 1 px tiap 28 px (Garis Navy 55%) ditutup lapisan `::after` yang memudar dari
    navy di atas, di `beranda-kepala`, `kepala-layar`, dan pita di bawah rel. Hanya di permukaan navy (Bagian 2 versi 1.7).
181. **Uji** (di luar repo): 13 uji alur Chromium (11 uji riwayat harga yang disesuaikan dengan struktur baru, kepala navy pada 21 rute
    di 390 dan 1366 px tanpa judul ganda, Beranda/Dashboard 1.7) dan sapuan semua rute Pengelola (26) dan Staff (4) pada delapan
    ukuran Bagian 4.6 plus "kurangi gerak" di 390 dan 1366 px: 292 pemeriksaan tanpa gulir ke samping, elemen keluar layar
    (selain bingkai gulir tabel dan pilihan form), teks terpotong, sasaran sentuh di bawah 44 px, tombol yang menimpa judul,
    animasi saat "kurangi gerak", atau galat konsol. Uji server riwayat harga tetap lulus.
182. **Belum diuji di sini:** tampilan di HP asli (poni dan jarak aman, papan ketik iPhone dengan kepala yang kini ikut bergulir),
    huruf perangkat diperbesar 200%, dan PWA terpasang.

### Bar, logo, nama, dan gerak, spesifikasi tampilan 1.8 (aplikasi 0.15.0, 12 Oktober 2026)

183. **Asal:** pemilik meminta menu bar, task bar, logo, dan nama dibuat premium, serta "website full animasi agar tidak
    monoton". Permintaan ini bertentangan dengan Bagian 8 versi 1.7 (gerak hanya sebagai jawaban atas tindakan; tanpa animasi
    masuk tiap kartu, animasi saat menggulir, dan latar bergerak), jadi spesifikasi tampilan naik ke 1.8: Bagian 1 butir 5,
    2 (cahaya navy), 4.2, 4.3, 4.5, 5.2, 8 (ditulis ulang), 10, dan 11. Yang dipertahankan dari ATURAN TETAP: hanya CSS, hanya
    `transform` dan `opacity`, mati saat "kurangi gerak", tanpa library. "Full animasi" ditafsirkan sebagai gerak di setiap layar
    (masuk, gulir, angka, grafik, latar navy), bukan angka yang berhitung naik atau paralaks (butuh JavaScript tiap bingkai).
    Code.gs tidak berubah.
184. **Bar bawah mengambang** (HP dan tablet): `.menu` kini lapisan tembus (`pointer-events: none`) dan `.menu-grup` berupa kapsul
    (sudut 20, tepi Garis Navy, bayangan tiket) 12 px dari tepi dan `--jarak-menu` (8 px, 6 px di layar pendek, 0 di desktop) di
    atas jarak aman. Token baru `--ruang-menu` = tinggi menu + jarak aman + jarak, dipakai `.layar` (ditambah 8 px), bilah kirim,
    pesan singkat, dan `scroll-padding-bottom`. Pil menu aktif `.menu-pil` (dibuat `gambarMenu`, digeser `letakkanPenanda`):
    karena semua menu di bar bawah sama lebar, lebarnya diatur langsung dan hanya `transform` yang bertransisi; kali pertama dan
    `tanpaGerak` tanpa transisi. Desktop: pil per menu lewat `::before` yang memudar dan membesar dari 90%, garis amber di bawah
    (6 px dari tepi), bar bertepi bawah Garis Navy. Ikon menu yang baru aktif melonjak sekali (`ikon-lonjak`).
185. **Logo dan nama:** `lencana(kelas)` dan `namaMerek(kelas, tag)` di app.js; `index.html` memuat lencana yang sama di bar atas
    dengan `.lencana-buka` (gerak saat bar pertama tampil) dan `#merek-outlet` (nama outlet; diisi `gambarMenu`,
    `perbaruiPengguna`, dan setelah nama outlet disimpan; dipotong dengan elipsis di 180 px, nama lengkap tetap di Beranda dan
    Login). `aria-label` merek tetap "InventoryKu, ke Beranda"; isi merek `aria-hidden`. Kepala Beranda dibuka `.beranda-merek`
    (HP dan tablet); `.beranda-kepala-isi` kini flex kolom dan baris merek memakai `margin-bottom: auto`, sehingga tanggal dan rel
    tetap di bawah. Ikon PWA tidak berubah. Perbaikan kecil: teks tombol nama di Login kini di tengah tegak (`align-content`).
186. **Gerak masuk:** router memasang `.layar-masuk` seperti dulu dan kini melepasnya setelah 900 ms (dijaga `nomorLayar`), jadi
    hanya isi pertama layar yang bergerak; data yang digambar ulang sesudahnya diam. CSS: anak `.kepala-layar-isi` dan delapan
    anak pertama `.layar-isi` (serta pemberitahuan Beranda) memakai `naik-masuk` dengan jeda bertambah. Tiket kini turun setiap
    Beranda dibuka (`gerak = !tiketSudahTampil`), pembuka (lencana, tanggal, rel terbentang) tetap sekali. Login: `.login-buka`
    sekali per pemuatan halaman (`loginBukaSudah`) dan dilepas setelah 1,5 detik, jadi berganti langkah tidak mengulang gerak.
    Angka utama (`kepala-nilai-angka`, `ubin-nilai`, `kemajuan-angka`, dan `kepala-angka-nilai` hanya saat masuk layar karena
    ringkasan item diperbarui saat mengetik) memakai `angka-naik`. Momen selesai menambah `.rel.kilau` (sekali, bukan setiap
    Beranda dibuka).
187. **Muncul saat digulir** (`pasangUngkap`, dipanggil `mulai`): `MutationObserver` pada `#layar` (diperiksa di microtask, sebelum
    layar dilukis) memberi `data-ungkap` pada calon (`PILIH_UNGKAP`: anak `.layar-isi` selain bilah kirim, ringkasan kepala, dan
    penanda memperbarui; `.kartu`; `.kartu-item` (kartu item form); `.kelompok` (kelompok per tanggal di Riwayat dan
    per kategori di Pengaturan); `.tabel-bingkai`; anak `.beranda-bawah`), lalu `.ungkap` hanya pada yang seluruhnya di bawah
    layar, tidak menempel (`sticky`/`fixed`), dan tidak berada di dalam calon lain yang belum tampil. `IntersectionObserver`
    memberi `.ungkap-tampil`, dan 600 ms kemudian kedua kelas dilepas supaya gerak tekan kembali normal. Transisi hanya pada
    `.ungkap.ungkap-tampil`, jadi menyembunyikan tidak memudar. Grafik di bagian yang belum tampil menunda geraknya sampai tampil.
    Tidak dipasang saat "kurangi gerak" atau tanpa `IntersectionObserver`.
188. **Grafik:** batang waste tumbuh (`.batang.tumbuh`, `--i`) hanya pada gambar pertama; mengetuk kolom menggambar ulang tanpa
    gerak (`gambarBatang(pilih, awal)`). Titik suhu muncul bertahap (`--i` pada `.suhu-titik-satu`, paling banyak 7 jeda), cincin
    Form terisi berputar masuk (svg-nya, bukan lingkaran yang ber-atribut `transform`), grafik harga naik. `svgEl` kini melewati
    atribut bernilai `null`.
189. **Cahaya navy:** `::before` di `.beranda-kepala`, `.kepala-layar` (keduanya kini `overflow: hidden`; lapisan pudar `::after`
    turun ke `z-index: -2`), dan layar Login (`.masuk:not(.terang)`, `position: fixed`), animasi `cahaya-geser` 16 detik bolak-balik,
    hanya `transform`. Saat "kurangi gerak" bercaknya diam. Arahan tetikus mengangkat tiket, ubin bertombol, dan kotak Nilai stock
    3 px. Kurva bersama `--ayun-masuk` dan `--ayun-lembut` (sedikit melewati tempatnya, hanya untuk benda kecil, Bagian 8.2 butir 4).
190. **Uji** (di luar repo, `uji_gerak.js`): 11 uji Chromium dengan API tiruan yang memanggil `doPost` asli: semua `@keyframes` dan
    transisi di stylesheet hanya `transform`/`opacity` (latar hanya keadaan tekan); kapsul bar bawah 12 px dari tepi dan 8 px dari
    bawah, pil tepat di menu aktif dan bergeser 320 ms dengan ikon melonjak; isi terakhir tidak tertutup kapsul dan kapsul di dalam
    layar pada 320×568, 390×844, 768×1024, dan 844×390 untuk empat layar; merek desktop (lencana, "Ku" amber, outlet, pil
    `::before`, merek Beranda tersembunyi); merek Beranda HP dan pembukanya, tiket turun lagi saat kembali ke Beranda tanpa
    pembuka; ganti layar bertahap lalu kelas dilepas; muncul saat digulir di Dashboard 390 (tersembunyi, tampil saat digulir,
    batang tumbuh saat itu, kelas dilepas, ketukan kolom tanpa gerak); angka naik dan arahan tetikus 3 px di desktop; Login
    sekali; "kurangi gerak" tanpa animasi atau transisi yang berjalan, tanpa `.ungkap`, pil langsung pindah; gerak yang terus
    berjalan hanya `cahaya-geser`; tanpa galat konsol. 13 uji alur lama dan sapuan 292 pemeriksaan (delapan ukuran, semua rute,
    "kurangi gerak") tetap lulus.
191. **Belum diuji di sini:** rasa gerak di HP asli (terutama HP Android murah: cahaya navy dan muncul saat digulir dibuat hanya
    dengan `transform`/`opacity`, tetapi kelancarannya perlu dilihat langsung), kapsul bar bawah di iPhone dengan garis beranda
    (jarak aman), dan PWA terpasang. Jika terasa berat atau berlebihan, gerak bisa dikurangi tanpa mengubah tata letak.
192. **Logo buku terbuka** (pemilik memilih pilihan B dari pratinjau logo, artifact "Logo InventoryKu", 12 Oktober 2026;
    spesifikasi tampilan Bagian 1, 4.5, 8.1, dan 11). Bentuk di viewBox 64: halaman kiri dan kanan berupa bidang padat yang
    melengkung dari tengah (`.ikon-buku-kiri` Kertas, `.ikon-buku-kanan` Garis Halus), tiga garis tulisan di halaman kiri
    (`.ikon-buku-garis`, Teks di Navy), dan pita Lampu Pass di halaman kanan (`.ikon-buku-pembatas`). Lencana memakai viewBox
    `7 11 50 44` supaya buku mengisi lencana; ukuran gambar 28 px (bar), 50 px (Login), 22 px (Beranda). Gerak pembuka:
    lencana membesar, kedua halaman membuka dari tengah (`halaman-buka`, `transform-box: fill-box` dengan titik asal di tulang
    buku), garis muncul, pita turun. **Ikon PWA** dibuat ulang dari `icons/ikon.svg` (sumber: sudut 112, cahaya radial dan
    garis navy tiap 64 px, buku 72% lebar) lewat Chromium: `ikon-192/512` (sudut membulat, pojok tembus), `ikon-maskable-192/512`
    (penuh, buku diperkecil ke 78% supaya di dalam 80% tengah), `ikon-180` (penuh, buku 92%; iOS membulatkan sendiri). Favicon
    di `index.html`: buku terbuka tanpa garis tulisan di atas Navy Pass bersudut 14. Nama berkas tidak berubah, jadi
    `manifest.webmanifest` dan `sw.js` tetap; versi aplikasi tetap 0.15.0 karena 0.15.0 belum dirilis. HP yang sudah memasang
    aplikasi bisa tetap menampilkan ikon lama sampai aplikasi dipasang ulang dari browser.
193. **Login penuh gerak** (permintaan pemilik 12 Oktober 2026: "halaman login masih terlihat sederhana dan monoton";
    spesifikasi tampilan Bagian 5.1, 8.1, 8.2 butir 6, dan 8.4). `latarLogin()` menaruh `.login-latar` (fixed, `aria-hidden`,
    `pointer-events: none`, di bawah `.login` yang kini `z-index: 1`) berisi cahaya hangat, rel tiket (garis amber dan lima
    `.latar-tiket` yang berayun dari klipnya, posisi lewat `nth-child`), dan tujuh `.latar-uap`. Rel tidak tampil di layar
    setinggi di bawah 700 px (di sana Login dipadatkan dan tiket menimpa lencana). Lencana dibungkus `.lencana-panggung` dengan
    `.lencana-halo` (lingkar amber, mulai 1,5 detik, lalu tiap 3,4 detik); aturan layar pendek kini menyembunyikan panggungnya.
    `namaMerekHuruf()`: h1 ber-`aria-label` "InventoryKu", huruf `aria-hidden` dengan `--i`. Tombol nama: `.tombol-nama-inisial`
    (`aria-hidden`; `aria-label` tombol tetap nama) dan `.tombol-nama-teks`. Langkah: `.login-siapa` dan tombol nama setelah
    "Ganti nama" (`keadaan.gerakNama`, kelas `.langkah-masuk` di grid) memakai `langkah-masuk`; titik dan tombol angka diberi
    `--i` dan memakai `titik-masuk`/`angka-masuk`. Desktop (≥ 1.024 × 700): `.login` menjadi panel; `#masuk` di Login
    `display: flow-root` supaya margin panel tidak memperlihatkan latar terang. "Kurangi gerak": aturan umum mematikan semua
    animasi; uap dan halo berkeadaan awal `opacity: 0` sehingga tidak tampil, tiket diam. Layar terang (Pemasangan pertama,
    Pulihkan akses) tidak berubah. Uji (di luar repo, `uji_gerak.js`, kini 14): suasana tidak bisa disentuh dan tidak menutupi
    tombol, gerak yang terus berjalan di Login hanya kelima jenis itu, jeda huruf dan tombol, langkah PIN dan Ganti nama,
    delapan ukuran (tanpa gulir samping, isi tidak keluar layar, tiket tidak menimpa isi, panel hanya di desktop), dan
    "kurangi gerak" di Login.

### Memuat lebih cepat (Code.gs v0.14, aplikasi 0.15.1, 12 Oktober 2026)

194. **Asal:** pemilik mengeluh membuka aplikasi lama (juga di iPhone) dan bertanya apakah karena Apps Script, atau perlu
    pindah ke Supabase/Firebase. Dipilih "Saran 1": percepat Apps Script yang ada dulu; pindah backend (Supabase dengan
    salinan ke Google Sheets) baru dipertimbangkan jika masih lambat. Spesifikasi sistem Bagian 4.2 dan 11. Tampilan tidak
    berubah.
195. **Penyebab yang ditemukan** (diukur dengan tiruan Sheet yang menghitung panggilan baca; satu panggilan di Google asli
    biasanya puluhan sampai ratusan ms): Beranda Pengelola 73 panggilan baca (`M_Konfigurasi` 7 kali, `M_Staff` 6, `M_Form`
    5; tiap baca 2–4 panggilan: `getLastRow`, `getLastColumn`, judul, isi), Beranda Staff 39, Dashboard 85, login 12 lalu
    Beranda lagi; ditambah `config.js` yang ditunggu sampai 4 detik di sinyal lemah, dan keluar otomatis 5 menit yang membuat
    hampir setiap pembukaan dimulai dari login.
196. **Aplikasi (0.15.1):** service worker memakai `config.js` dari cache langsung (`cacheLaluPerbarui`, pembaruan di latar
    dengan `event.waitUntil`; tanpa salinan tetap `jaringanDulu`). Login, pemasangan, dan pemulihan mengirim `tanggal` dan
    `alamatAplikasi` (`isiBerandaLogin`); `simpanSesiBaru` menyimpan `data.beranda` ke `cache:beranda` dan mencatat waktunya,
    lalu `muatData` dengan `cukupSimpanan: pakaiBerandaLogin` menggambar Beranda dari situ tanpa memanggil server (sekali,
    paling lama 30 detik sesudah login). Membuka Beranda lagi memanggil server seperti biasa. Server lama (tanpa `beranda`)
    tetap jalan: Beranda dimuat seperti dulu.
197. **Server (Code.gs v0.14):** `nilaiTab_(sheet)` membaca seluruh tab dengan satu `getDataRange().getValues()`; pada aksi
    `bacaSaja` (ditandai di `AKSI_`), `login`, dan `keluar` hasilnya disimpan di `MEMO_TAB_` selama permintaan (salinan per
    baris dikembalikan, jadi pemanggil boleh mengubahnya). `denganKunci_` menaikkan `DALAM_KUNCI_`, membuang simpanan saat masuk
    dan keluar, dan simpanan tidak dipakai di dalamnya, jadi semua penulisan membaca isi terbaru. `judulTab_` (dipakai
    `posisiKolom_` dan `posisiKolomOpsional_`) memakai simpanan jika ada, selain itu tetap hanya membaca baris 1 (supaya
    penulisan ke tab besar tidak membaca seluruh tab). Diubah memakai `nilaiTab_`: `bacaTabel_` (dulu tiga panggilan),
    `bacaStaff_` (`posisiKolomJudul_`), `bacaKonfigurasi_`, `namaOutlet_`, `bacaDaftarForm_`, M_Unit di `statusSuhu_`,
    `bacaBarisTanggal_`. Zona waktu spreadsheet lewat `zonaSheet_()` (sekali per permintaan; dibuang saat zona diganti).
    `doPost` mematikan simpanan di akhir permintaan.
198. **Simpanan Beranda di server:** `aksiBeranda_` memakai CacheService (`beranda|<versi data>|<tanggal>|<nama>|<role>`,
    120 detik, isi `{ h: jawaban, a: alamat aplikasi }`); `berandaBaru_` menghitung seperti dulu. Setiap keluar dari
    `denganKunci_` mengganti `versi_data` (`tandaiDataBerubah_`), kecuali login (`denganKunci_(fn, true)`, hanya menulis sesi),
    jadi kiriman, koreksi, perubahan staff, Lupa PIN, dan pengaturan langsung terlihat. Yang tidak lewat kunci (ketikan
    langsung di Sheet, trigger yang menulis tanpa kunci) terlihat paling lambat 2 menit. `pengguna` di jawaban selalu diganti
    hasil `periksaSesi_` yang baru. CacheService tidak butuh izin Google baru.
199. **Login membawa Beranda** (`lampirkanBeranda_`): dihitung sesudah kunci dilepas, hanya jika `tanggal` sah; galat dicatat
    di log dan login tetap berhasil tanpa `beranda`. Berlaku untuk `login`, `pasang`, dan `pulihkan`.
200. **Log lama aksi:** setiap `doPost` menulis `Aksi <nama>: <ms> ms` (ditambah "(gagal)") ke log Eksekusi Apps Script.
201. **Hasil di tiruan** (jumlah panggilan baca ke Sheet; sebelum → sesudah): infoLogin 10 → 2, login 12 → 17 (sekarang
    termasuk Beranda; dulu login 12 + Beranda 73), Beranda Pengelola 69–73 → 11 (1 jika diambil dari simpanan), Beranda Staff
    39 → 10, formStock 23 → 6, formWaste 21 → 7, Riwayat 48 → 10, Dashboard 85 → 14, daftarItem 49 → 24, kirimStock 66 → 26.
    Jawaban 12 aksi sama persis dengan Code.gs v0.13 (selain milidetik waktu kirim uji). Waktu di Google asli belum bisa
    diukur di sini; lihat log Eksekusi sesudah deploy.
202. **Uji** (di luar repo): `uji_muat.js` (11 uji Node: simpanan Beranda dan penggantian versi oleh kiriman, Lupa PIN, ubah
    role, ketikan langsung di Sheet sesudah simpanan habis, login dengan dan tanpa tanggal, PIN salah tetap dihitung, Beranda
    rusak tidak menggagalkan login, login tidak mengganti versi data, batas jumlah baca, isi terbaru di dalam kunci, log), tiruan
    Sheet kini menghitung panggilan baca dan mencatat setiap penulisan yang terjadi saat simpanan baca dipakai (nol di semua uji),
    `ukur_muat.js` (jumlah baca dan perbandingan jawaban), `uji_muat_chromium.js` (4 uji: login tanpa panggilan Beranda kedua dan
    membuka Beranda lagi memanggil server, server lama tanpa `beranda`, `config.js` yang ditunda 6 detik tidak menahan pembukaan
    kedua (service worker 0.15.0: 4.041 ms, 0.15.1: di bawah 2 detik), pembukaan pertama tetap dari jaringan), ditambah uji lama.

### Pindah ke Supabase (Code.gs v0.15, aplikasi 0.16.0, 15 Oktober 2026)

203. **Asal dan keputusan pemilik.** Sesudah "memuat lebih cepat" (butir 194) pemilik memilih pindah ke Supabase. Jawaban atas
    pertanyaan: PDF, email harian, rekap bulanan, dan cadangan **pindah semua ke Supabase**; salinan ke Google Sheets **tiap 5
    menit** oleh Apps Script; **Sheets hanya untuk dicek** (satu arah, ketikan langsung tertimpa). Spesifikasi sistem Bagian 4.5,
    9.4, dan 10. Spesifikasi tampilan tidak berubah.
204. **Satu sumber logika.** Code.gs tidak ditulis ulang. `supabase/src/bungkus.js` membungkus Code.gs menjadi fungsi pembuat
    (`new Function('G', …)`) sehingga setiap permintaan mendapat variabel global baru seperti satu eksekusi Apps Script, dengan
    `DI_SUPABASE = true`. Di Code.gs, `DI_SUPABASE_` hanya dipakai untuk: urutan `Data_Suhu` tidak ditulis (salinan ke Sheets
    mengurutkannya, butir 151), PDF selalu dengan pemisah halaman, cadangan berupa JSON, jadwal dipasang ulang otomatis saat
    Pengaturan → Outlet dan jadwal berubah, dan `setupSpreadsheet` melewati rumus, grafik, dan pemeriksaan rumus.
205. **Tiruan Sheet di Postgres** (`sheet.js`, `penyimpanan.js`, `skema.sql`): `tab_meta` (nama, urutan, meta, versi) dan
    `tab_baris` (pos, nilai jsonb, rumus, `diubah` dari sequence `urut_ubah`). Teks berawalan kutip disimpan tanpa kutip. Hanya
    baris yang berubah yang ditulis; posisi ditulis ulang hanya jika struktur berubah. `Range.sort` atas seluruh data menyimpan
    aturan di `meta.urutan` dan diterapkan setiap tab dimuat. Script Properties di tabel `properti`; zona, nama, alamat Sheet,
    jadwal di `info`. Runtime: tab master selalu dimuat, tab lain dipelajari per aksi (`aksi_tab`); tab yang belum dimuat
    menghentikan Code.gs, dimuat, lalu aksi diulang dari awal (paling banyak 40 kali). Aksi tulis memakai
    `pg_advisory_xact_lock(4207)`, aksi `bacaSaja` transaksi `repeatable read`. Isi tab disimpan di memori isolate per versi.
    `Utilities.formatDate` menyimpan hasilnya (tanggal yang sama diformat berulang).
206. **Layanan pengganti** (`layanan.js`, `adaptor.js`): Drive = tabel `folder`/`berkas` + Storage bucket `arsip` (nama objek = id;
    `getUrl` = `https://berkas.inventoryku/<id>`, diganti tautan bertanda tangan 6 jam di jawaban API, jadi `fotoUrl` tetap hanya
    untuk Pengelola); MailApp = antrean `surel_keluar` yang ditulis dalam transaksi yang sama, dikirim lewat Brevo sesudah tersimpan
    (jika `BREVO_API_KEY` dan `SUREL_PENGIRIM`), atau oleh Apps Script dari Gmail; kegagalan dicatat lewat `catatSurelGagal_`
    (laporan_terakhir atau rekap_terakhir). ScriptApp = daftar trigger di `info.jadwal`, dipasang sebagai pg_cron
    `inventoryku-<fungsi>` (UTC dari zona tersimpan; mingguan/bulanan dijalankan harian dengan `syarat` hari/tanggal yang diperiksa
    Edge Function). LockService dan CacheService tanpa efek.
207. **PDF** (`pdf.js`): pengurai kecil untuk HTML `htmlLaporan_` (kelas kepala, info, data, bawah, kategori, total, cek-ulang,
    angka, akhir, tengah, masalah, kecil, catatan, kaki, halaman-baru), jsPDF 2.5.2, A4 tegak, margin 36 pt, Helvetica dengan huruf
    WinAnsi (− menjadi -, → menjadi ->), judul kolom tabel diulang di halaman baru, judul kolom yang sempit diperkecil sampai 6 pt.
208. **Salinan ke Sheets** (`sinkron.js`, `sinkronDariSupabase`): urutan berkas → tab → email. Tab Harian_* dan Dashboard tidak
    disalin. Keadaan per tab di tabel `sinkron` (id baris menurut urutan Sheet, nomor `diubah` terakhir, kiriman "tertunda" sampai
    Apps Script memastikan lewat `__sinkronSelesai`). Langkah: hapus, sisip, ubah per rentang baris; urutan baris lama berubah atau
    perubahan > separuh tab → salin penuh. Apps Script memeriksa `barisKunciTerakhir_(sheet, 1)` = `barisLama`; jika tidak cocok
    (ketikan langsung) tab disalin penuh; sekali sehari sesudah 02.00 semua tab penuh (`SINKRON_PENUH`). Master dulu (dropdown
    `setAllowInvalid(false)` merujuknya). Tab `Data_K_` baru dibuat dengan `siapkanTabKustom_`. Teks berawalan `= + - @` diberi
    kutip; tautan berkas diganti tautan Drive (baris yang memuatnya ditandai berubah saat berkasnya tersalin).
209. **Impor** (`pindahKeSupabase`): Script Property `SUDAH_PINDAH` diisi lebih dulu (aplikasi ditolak) di dalam kunci, semua tab
    (Harian/Dashboard hanya nama dan meta, termasuk gid untuk tautan Dashboard) dan Script Properties kecuali milik Apps Script
    (`SUPABASE_API`, `RAHASIA_SINKRON`, `SUDAH_PINDAH`, `SINKRON_VERSI`, `SINKRON_PENUH`, `TIMPA_SUPABASE`, `SPREADSHEET_ID`)
    dikirim per 2.000 baris; gagal → `SUDAH_PINDAH` dihapus lagi. Supabase menolak impor jika sudah berisi data, kecuali
    `TIMPA_SUPABASE` = ya. Sesudahnya trigger Apps Script diganti salinan 5 menit, `pasangTrigger` dijalankan di Supabase, dan
    satu salinan langsung.
210. **Rakit** (`node supabase/rakit.mjs`): tiap modul `src` dibungkus IIFE, impor antarmodul menjadi destrukturisasi, Code.gs
    disisipkan sebagai string, impor `npm:postgres@3.4.5`, `npm:jspdf@2.5.2`, `node:buffer`, `node:crypto`; `// @ts-nocheck`.
    Jalankan setiap kali Code.gs atau `supabase/src` berubah, dan commit hasilnya. Secret otomatis Supabase yang dipakai:
    `SUPABASE_DB_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; dari pemilik: `RAHASIA_SINKRON`, `BREVO_API_KEY`,
    `SUREL_PENGIRIM` (opsional), `ALAMAT_API` (opsional, jika nama function bukan `api`). Koneksi Postgres `prepare: false`
    (pooler transaksi).
211. **Uji** (di luar repo): Postgres 16 lokal dan Node 22; Edge Function rakitan dijalankan dengan Deno 2 (ping, setup lewat
    `__fungsi`, pasang, kirim, unduh PDF). `uji_pindah.js` (35 pemeriksaan): data dibuat di tiruan Apps Script lama, `pindahKeSupabase`
    lewat curl ke server uji (Edge Function di Node + Storage tiruan + tabel cron tiruan), isi Sheet sama dengan Supabase sesudah impor
    dan sesudah tiap putaran (kiriman lima form, koreksi, resep ditulis ulang, staff dihapus, form kustom dan tab barunya, harga,
    foto, PDF, email Gmail, kode pemasangan, cadangan, ketikan langsung di Sheet, `setupSpreadsheet` sesudah pindah), hanya baris
    yang berubah dikirim, sesi dan PIN lama berlaku, jadwal pg_cron 15.15 UTC, rahasia salah ditolak. `uji_brevo.mjs`: email lewat
    Brevo tiruan dan kegagalannya di `laporan_terakhir`. `banding.mjs`: 91 langkah, jawaban sama dengan tiruan Apps Script kecuali
    yang memang berubah (teks `=1+1` tetap teks, PDF stock per kategori berhalaman, jadwal otomatis, properti milik Apps Script).
    Beban satu tahun (18.250 baris Stock_Harian dan Data_Stock): beranda 90–120 ms, kirimStock ~400 ms, dashboard ~200 ms;
    CPU laporan harian 0,5–1,1 detik, rekap 0,25–0,7, cadangan 0,3–0,7. `uji_pindah_chromium.js`: alamat lama dipanggil sekali,
    sesudah itu langsung ke alamat baru, juga setelah dimuat ulang.
212. **Belum bisa diuji di sini:** Supabase asli (Edge Function di dashboard, `new Function` di edge-runtime, batas CPU 2 detik,
    pooler, Storage, pg_cron/pg_net), Brevo asli, Google asli (UrlFetchApp, kuota trigger, validasi dropdown saat menyalin), dan
    tampilan PDF jsPDF di HP. Jika laporan harian kelak melewati batas CPU karena data bertahun-tahun, arsip tahunan (Tahap 11)
    menjadi jalan keluarnya.
213. **Dipasang pemilik (16 Oktober 2026).** Tanpa Brevo: email lewat Gmail pemilik (Apps Script, paling lambat 5 menit). Edge
    Function di project pemilik bernama `rapid-action` (nama otomatis Supabase), jadi secret `ALAMAT_API` berisi alamat itu dan
    `config.js` menunjuk ke `.../functions/v1/rapid-action`. Langkah 10–12 PANDUAN berhasil: isian dari HP tersalin ke Sheet,
    email "[Uji]" dan PDF ke Drive sampai, tiga jadwal `inventoryku-...` ada di `cron.job` dengan `alamatApi` yang benar.
    Setiap rilis Code.gs berikutnya: tempel `supabase/functions/api/index.ts` ke function `rapid-action`.

### Login lebih bersih, spesifikasi tampilan 1.9 (aplikasi 0.16.1, 17 Oktober 2026)

214. **Asal:** pemilik bertanya apakah Login bisa tanpa daftar nama, atau dengan nama dan PIN, supaya lebih bersih. Tiga cara
    dibandingkan di pratinjau (artifact "Pilihan Login InventoryKu"): PIN saja (PIN harus unik dan kuncian 5 kali salah tidak
    bisa per orang lagi), ketik nama + PIN (lambat dan rawan salah ketik di dapur), dan HP mengingat pengguna terakhir. Pemilik
    memilih cara 3. Spesifikasi tampilan naik ke 1.9 (Bagian 5.1, 8.4, 11). Code.gs dan aksi API tidak berubah.
215. **Ingatan di HP:** `simpanSesiBaru` menulis `inventoryku:penggunaTerakhir` (nama, per perangkat, bukan per pengguna) setiap
    login, pemasangan pertama, dan pemulihan berhasil. `keluar()` dan keluar otomatis tidak menghapusnya. `gambarLogin` memulai
    dengan `mulaiLangkah()`: jika `infoLogin` sudah ada (dari HP atau server) dan nama itu ada di daftar staff yang bisa masuk
    (huruf besar/kecil tidak dibedakan), langsung `tampilPin`; selain itu daftar nama. `keadaan.ingat` mati setelah "Ganti nama",
    jadi `infoLogin` yang datang sesudahnya tidak melompat kembali ke langkah PIN. Jika nama itu tidak bisa masuk lagi saat
    langkah PIN tampil, aturan lama berlaku (kembali ke daftar dengan pesan).
216. **Tampilan:** langkah PIN memakai merek ringkas satu baris (`.login.langkah-pin .login-merek`, lencana 40 px), sapaan
    `.login-sapa` (inisial 64 px, "Halo, Rina", "Masukkan PIN untuk masuk", jumlah isian di HP jika ada), titik PIN, papan
    angka, lalu `.login-pilihan`: "Bukan Rina? Ganti nama" (nama depan saja, supaya nama panjang tidak membuat dua baris) dan
    "Lupa PIN?". Lingkaran inisial disembunyikan pada tinggi 500–619 px dan pada layar mendatar pendek (≤ 499 px). Daftar nama
    "Siapa yang masuk?": `.tombol-nama` berupa lingkaran inisial 64 px dengan nama di bawahnya, tiga kolom; `.terakhir` bertepi
    Lampu Pass dan berketerangan "Terakhir masuk". Keterangan keluar otomatis tampil di atas sapaan (atau di atas daftar nama)
    dan hilang setelah "Ganti nama" atau nama dipilih. Gerak tetap sama (sapaan masuk dari kanan seperti `login-siapa` dulu).
217. **Uji** (di luar repo, `uji_login.js`): Chromium dengan API tiruan (`context.route`), delapan ukuran Bagian 4.6 untuk sapaan
    dan daftar nama (tanpa gulir ke samping, elemen keluar layar, teks terpotong, sasaran di bawah 44 px, dan papan angka selalu
    muat di layar), HP tanpa ingatan → daftar → pilih → PIN salah → login → nama tersimpan → Login berikutnya menyapa orang itu,
    nama yang sudah tidak bisa masuk → daftar, keterangan keluar otomatis di atas sapaan lalu hilang setelah Ganti nama, nama
    panjang di 320 × 568, "kurangi gerak" tanpa animasi berjalan, tanpa galat konsol. Belum diuji di HP asli.

### Perbaikan jadwal Supabase (Code.gs v0.15.1, 17 Oktober 2026)

218. **Asal:** laporan harian Jumat, 16 Oktober 2026 (malam pertama dengan jadwal Supabase) tidak terkirim. Hasil query pemilik:
    ketiga jadwal `inventoryku-...` di `cron.job_run_details` berstatus `failed` dengan `Content-Type header must be
    "application/json"` dari `net.http_post`. pg_net mengirim body `jsonb` dan menolak header lain; `pasangJadwal` (adaptor.js)
    memakai `text/plain;charset=utf-8` meniru panggilan aplikasi. Uji butir 211 memakai tabel cron tiruan yang tidak menjalankan
    perintahnya, jadi tidak menangkap ini; email "[Uji]" (langkah 11 PANDUAN) lewat jalur lain (`__fungsi` dari Apps Script).
219. **Perbaikan:** jadwal memakai `Content-Type: application/json`. Edge Function membaca body sebagai teks apa pun headernya,
    jadi tidak ada perubahan lain. Jadwal yang sudah tersimpan di `cron.job` baru berubah setelah `pasangTrigger` dijalankan lagi
    (dari editor Apps Script, diteruskan ke Supabase) dengan Edge Function versi baru; sebelum itu bisa dibetulkan langsung dengan
    `cron.alter_job` di SQL Editor.
220. **Peringatan laporan yang tidak berjalan** (`laporanTerlambat_`, dipakai `peringatanSistem_`, jadi tampil di Beranda Pengelola
    dan butir `sistem` Perlu perhatian di Dashboard): laporan untuk tanggal D dijadwalkan D + jam closing + jeda (boleh lewat tengah
    malam) dan dianggap terlambat 60 menit sesudahnya. Jika `laporan_terakhir` belum mencakup tanggal terbaru yang sudah lewat
    batasnya, tampil "Laporan harian: laporan untuk Jumat, 16 Oktober 2026 belum terkirim. Jadwal otomatis mungkin berhenti. Pemilik
    Sheet perlu menjalankan pasangTrigger di editor Apps Script." Kiriman yang tercatat lebih dari 30 menit sebelum jadwal (uji
    `kirimLaporanSekarang` pagi hari) tidak mencakup tanggal itu. Tidak tampil jika `laporan_terakhir` kosong (belum pernah ada
    laporan) atau sudah diawali "Gagal" (peringatan lama sudah tampil). Berlaku juga untuk Apps Script yang belum pindah.
    Hanya laporan harian: cadangan mingguan dan rekap bulanan jarang berjalan, jadi tidak diberi pemeriksaan serupa.
221. **Uji** (di luar repo): Postgres 16 lokal dengan `cron.job` dan `net.http_post` tiruan yang meniru pemeriksaan header Supabase;
    `pasangJadwal` dari adaptor.js lama: tiga jadwal gagal dengan pesan yang sama dengan milik pemilik; versi baru: tiga jadwal lolos,
    body berisi `action`, `nama`, `syarat`, dan `rahasia`. Pelayan Edge Function menerima `__jadwal` ber-`application/json`. Code.gs
    dimuat di Node: 13 skenario `laporanTerlambat_` (uji pagi, sebelum dan sesudah batas, nearMinute lebih awal, dua malam terlewat,
    jam laporan lewat tengah malam, nilai bawaan, belum pernah, Gagal) dan `peringatanSistem_` tanpa peringatan ganda. Hasil rakitan
    lolos pemeriksaan sintaks. Belum bisa diuji di sini: pg_cron dan pg_net asli.
222. **Dipasang dan diuji pemilik (17 Oktober 2026).** Edge Function `rapid-action` diganti hasil rakitan Code.gs v0.15.1 dan
    di-Deploy, Code.gs ditempel ke Apps Script, lalu `pasangTrigger` dijalankan. Uji tanpa efek samping di SQL Editor: perintah
    `inventoryku-buatCadangan` dijalankan manual lewat `execute (select command from cron.job ...)` pada hari Sabtu, dan
    `net._http_response` mencatat status 200 dengan `{"ok":true,"data":{"dilewati":true}}` (jalur pg_cron → pg_net → Edge
    Function → rahasia jadwal → syarat hari). Laporan harian dari jadwal belum teramati saat butir ini ditulis; jalurnya sama,
    dan pembuatan laporan serta email lewat Gmail sudah terbukti dengan uji "[Uji]" 16 Oktober.

### HPP dan food cost (Code.gs v0.16, aplikasi 0.17.0, 17 Oktober 2026)

223. **Asal dan keputusan pemilik.** Pemilik bertanya fitur apa yang perlu ditambah, termasuk HPP untuk Head Kitchen dan Manager.
    Rancangan dan pratinjau (artifact "Rancangan HPP InventoryKu") lalu dipilih dengan jawaban: penjualan dicatat per hari, harga
    jual dan penjualan tanpa pajak dan service, bahan kecil 3%, target food cost 35%, nominal Rp waste tidak terlihat Staff, kasir
    buatan sendiri (penjualan per menu belum dibangun). Susut bahan (hasil bersih) per baris bahan menu dan "Salin menu" untuk versi
    bungkus juga dipilih; biaya operasional tidak masuk HPP per porsi. Spesifikasi sistem Bagian 5.9 (baru), 5.1, 5.4, 7.1, 8.2, 9.3,
    10, 12, 13; spesifikasi tampilan versi 1.10 (Bagian 4.7, 5.3, 5.6, 5.7, 5.10 baru, 7, 11).
224. **Data.** `M_Menu` (Nama Menu, Harga Jual (Rp), Aktif) dan `M_MenuBahan` (Nama Menu, Item Bahan, Qty per Porsi, Hasil Bersih
    (%)) masuk `TAB_MASTER` dan `KUNCI_MASTER` (kunci Nama Menu); `Data_Penjualan` (Tanggal, Penjualan (Rp), Catatan + kolom sistem)
    masuk `TAB_DATA`, satu baris per tanggal, urut tanggal terbaru. `M_Konfigurasi`: `target_food_cost` 35 dan `bahan_kecil_persen` 3
    (nilai kosong atau di luar 1–100 / 0–15 dibaca nilai awal; ditulis dengan koma). Sebelum `setupSpreadsheet` dijalankan ulang,
    `daftarMenu.siap` false, `hpp` dan `dashboard` tetap jalan, `simpanMenu` dan `simpanPenjualan` menolak dengan petunjuk.
225. **Menu** (`bacaMenu_`, `hppMenu_`, `dataMenu_`): bahan aktif, tidak ganda, takaran bersih > 0 (3 angka di belakang koma), hasil
    bersih di atas 0 sampai 100 dengan satu desimal (kosong = 100). HPP = Σ(takaran ÷ hasil × harga yang berlaku pada tanggal) ×
    (1 + bahan kecil %), barang jadi tanpa harga dari resepnya (`lengkapiHargaResep_`); satu bahan tanpa harga → `lengkap: false`.
    Food cost dibulatkan satu desimal, harga untuk target dibulatkan ke atas ke Rp 100. Nama boleh diganti (bahan ditulis ulang
    seperti `tulisBahanResep_`); perubahan nama dan harga jual dicatat di `Log_Perubahan` (Tab `M_Menu`, row_id nama baru).
    Mengaktifkan lagi ditolak jika ada bahan nonaktif. Item yang masih bahan menu aktif tidak bisa dinonaktifkan (`aturItemAktif`) dan
    namanya tidak bisa diganti jika dipakai menu mana pun (`simpanItem`, `bisaGantiNama`).
226. **Pemakaian bahan** (`pemakaianBahan_`): dari rekap `Stock_Harian`, hanya item tanpa resep aktif, per hari × `hargaPada_`. Terpakai =
    Keluar + Dipakai Prep − Hasil Prep; waste bahan; selisih stock = −(Penyesuaian − stok pembuka). **Stok pembuka** (`stokPembuka_`,
    `Data_Penyesuaian` beralasan "Stok pembuka") tidak dihitung sebagai selisih, karena barangnya sudah ada sebelum dicatat; tanpa ini
    food cost bulan pertama pemakaian aplikasi akan terlihat jauh terlalu rendah. Waste barang jadi diambil dari estimasi yang
    tercatat di `Data_Waste` (`nilaiWasteTercatat_`). Cek silang = nilai stock bahan sehari sebelum periode + masuk + stok pembuka −
    nilai stock bahan akhir + selisih harga item bahan (`selisihHarga_`); `cocok` jika beda ≤ 1 rupiah per item berganti harga
    (pembulatan per item). Bulan berjalan dinilai sampai kemarin; pada tanggal 1, periode kosong.
227. **Food cost** (`foodCostBulan_`, `dataHpp_`): pemakaian ÷ penjualan, hanya jika setiap hari periode punya catatan (`kurang` kosong)
    dan penjualan > 0. Grafik 6 bulan sampai bulan yang dipilih. HPP menu di layar memakai harga hari ini untuk bulan berjalan dan
    harga hari terakhir untuk bulan lalu. `simpanPenjualan` dengan `bulan` menjawab `hpp` bulan itu, jadi layar tidak memanggil
    server dua kali.
228. **Dashboard** (`ringkasHppDashboard_`): `hpp` food cost bulan ini; Perlu perhatian `menu` (Perlu ditinjau, menu aktif di atas
    target) dan `penjualan` (Menunggu, hari bulan ini sampai kemarin yang belum dicatat, mulai penjualan pertama yang pernah dicatat;
    "Penjualan kemarin belum dicatat" jika hanya kemarin). Rekap bulanan: `hasil.hpp`, bagian "HPP dan food cost" di PDF
    (`isiPdfRekapHpp_`, setelah Kepatuhan) dan email.
229. **Nominal Rp waste untuk Staff** (`rupiahWasteTerlihat_` = tanpa pengguna atau Pengelola): `dataFormWaste_` tanpa harga dan
    estimasi (+ `tanpaRupiah`), `defRiwayat_('WASTE')` tanpa kolom `rupiah` (Riwayat, detail, jawaban laporkan), `isiPdfWaste_` tanpa
    kolom dan total rupiah. Trigger, email, Drive tetap lengkap. Di HP, layar Waste memakai role sesi (`rupiah = pengelola`), jadi
    data lama di HP Staff pun tidak menampilkan rupiah.
230. **Aplikasi (0.17.0):** rute `#/hpp` dan `#/hpp/menu` (menu Dashboard), `#/pengaturan/menu`, `-baru`, `/<nama>`. Dashboard:
    `.dashboard-pintas` berisi Stock opname dan HPP dan food cost (dua kolom di desktop). Layar HPP: pilihan bulan (`cache:hpp-pilihan`),
    `grupPilihan` Bulan/Per menu (alamat ikut berganti), jawaban per bulan di `cache:hpp:<bulan>`; grafik food cost SVG dengan batang
    `tumbuh`; batang kategori lewat `transform: scaleX` (kelas `kat-*`; `bar-isi` sudah dipakai bar navigasi). Lembar
    `bukaCatatPenjualan` (juga dari Perlu perhatian). Pengaturan → Menu: draft `draft:menu:<nama>`/`+baru`, `cache:menu`, perkiraan
    dihitung di HP dengan rumus yang sama, "Salin menu" mengisi layar menu baru lewat `salinanMenu`. Outlet dan jadwal: kartu "HPP dan
    food cost". Item: keterangan dan "Buka menu" jika dipakai menu.
231. **Uji** (di luar repo; tiruan kini memakai `supabase/src/sheet.js` dan `layanan.js` di memori, jadi tidak perlu tiruan Apps Script
    sendiri): `uji_hpp.mjs` 18 uji server dengan data September–Oktober (harga Ayam berganti 10 Okt, stok pembuka, opname, prep beresep,
    waste barang jadi, bahan tanpa harga; pemakaian Rp 541.000 dan food cost 33,8% dihitung tangan), `banding.mjs` 34 jawaban aksi lama
    sama dengan Code.gs v0.15.1 selain `dipakaiMenu`, `uji_chromium.mjs` 13 uji (Dashboard, HPP Bulan/Per menu, catat penjualan,
    penjualan belum lengkap, menu ubah dan perkiraan, Salin menu, sakelar, Outlet, item dipakai menu, Waste Staff HP dan desktop,
    delapan ukuran Bagian 4.6 untuk 9 rute dan lembar penjualan, "kurangi gerak"), dan `banding_layar.mjs`: 14 layar lama × 2 ukuran
    sama piksel per piksel dengan versi sebelumnya (uji ini menangkap bentrok kelas `bar-isi` yang merusak bar atas desktop).
232. **Belum diuji di sini:** Supabase dan Google asli (tab baru tersalin ke Sheets, `setupSpreadsheet` di Sheet), tampilan di HP asli,
    dan PDF rekap jsPDF dengan bagian baru.

### Hapus item yang belum punya catatan (Code.gs v0.16.1, aplikasi 0.17.1, 17 Oktober 2026)

233. **Asal:** pemilik bertanya apakah item bisa dihapus dari daftar stock, lalu meminta hapus untuk item yang belum punya
    catatan (misalnya item yang salah dibuat). Aturan "master tidak pernah dihapus" (sistem Bagian 5.1) kini punya
    pengecualian kedua selain staff. Spesifikasi sistem Bagian 3, 5.1, 13; tampilan versi 1.10 tambahan (Bagian 5.7, 7, 11).
234. **Syarat** (`rujukanItem_`, `sebabTidakBisaHapus_`, dipakai `dataItem_` dan `aksiHapusItem_` sehingga HP dan server sama):
    item sudah nonaktif (seperti hapus staff: "Nonaktifkan dulu untuk bisa menghapus."), tidak punya catatan stock
    (`itemBercatatan_`: `Stock_Harian`, semua `SUMBER_STOCK`, `Data_Opname`), tidak punya resep (aktif atau nonaktif), tidak
    menjadi bahan resep atau menu mana pun (aktif atau nonaktif, karena barisnya menyimpan nama item), dan tidak pernah dipilih
    di kolom Item form kustom mana pun (termasuk form dan kolom yang dihapus/diarsipkan). Urutan sebab: catatan stock, resep
    sendiri, bahan resep, bahan menu, form kustom.
235. **Hapus** (`hapusItem`): semua baris `M_HargaItem` item itu (riwayat harga tanpa pemakaian tidak berarti apa-apa, dan
    jika dibiarkan, item baru dengan nama yang sama akan mewarisinya) lalu baris `M_Item` dihapus dengan `deleteRow`; satu
    baris `Log_Perubahan` (Tab `M_Item`, row_id nama, Kolom Nama Item, Nilai Lama nama, Nilai Baru "(dihapus)"). Nama itu
    boleh dipakai item baru. Isian di antrean HP yang masih memuat item itu akan ditolak server (item tidak ada); karena item
    harus nonaktif dulu dan belum punya catatan, hal ini hanya mungkin untuk isian yang dibuat sebelum dinonaktifkan.
236. **Layar** (Pengaturan → Item, ubah): bagian `.bagian-hapus` paling bawah seperti hapus staff. Nonaktif tanpa sebab:
    tombol "Hapus" (bahaya) → konfirmasi → kembali ke daftar dengan "Tomat dihapus dari daftar item." (draft item dibuang).
    Aktif tanpa sebab: "Item ini belum punya catatan. Nonaktifkan dulu untuk bisa menghapus." Nonaktif dengan sebab: kalimat
    sebabnya. Aktif dengan sebab: tidak tampil. Server lama (tanpa `sebabTidakBisaHapus`): tidak tampil. Kalimat di daftar
    item diganti menjadi "Item yang sudah punya catatan cukup dinonaktifkan, …; item yang belum punya catatan bisa dihapus."
237. **Uji** (di luar repo): Code.gs di Node di atas Spreadsheet tiruan `supabase/src` (8 uji: sebab kosong dan aktif ditolak;
    hapus membersihkan `M_Item` dan `M_HargaItem` dua baris, log, nama dipakai lagi tanpa mewarisi harga; catatan stock; bahan
    dan hasil resep nonaktif; bahan menu nonaktif; form kustom termasuk sesudah diarsipkan; Staff ditolak; setupSpreadsheet,
    formStock, dashboard, beranda sesudahnya). Chromium dengan API tiruan yang memanggil `doPost` asli: alur aktif →
    Nonaktifkan → Hapus → Batal → Hapus → daftar, item bercatatan, aktif lagi, delapan ukuran tanpa gulir samping dan tombol
    ≥ 44 px, tanpa galat konsol. Belum diuji di Supabase asli dan salinan ke Sheets (baris master yang dihapus; jalurnya sama
    dengan baris `Stock_Harian` yang dihapus `hitungUlangStock_`).

### Pola navy, bar, dan kartu, spesifikasi tampilan 1.11 (aplikasi 0.17.2, 17 Oktober 2026)

238. **Asal:** pemilik meminta pola garis diganti supaya tampilan terlihat profesional dan premium. Lima pola dibandingkan di
    pratinjau (artifact "Pilihan Pola InventoryKu": garis sekarang, kisi titik, cincin halus, cahaya dan butiran, kisi cetak biru)
    beserta bar bawah dan kartu. Pemilik memilih pola C untuk semua permukaan navy, bar bawah kaca buram, dan kartu bergaris
    rambut. Pertanyaan pemilik soal library dan gerak baru dijawab terpisah dan belum diputuskan, jadi ATURAN TETAP tidak berubah.
    Spesifikasi tampilan Bagian 2, 4.2, 4.7, 6, 10, 11. Code.gs tidak berubah.
239. **Permukaan navy** (app.css, token `--cahaya-navy` dan `--butiran`): `.beranda-kepala`, `.kepala-layar`, dan `.masuk:not(.terang)`
    memakai `background-image: var(--butiran), var(--cahaya-navy)` dengan `background-blend-mode: overlay` untuk butiran. Butiran =
    SVG `feTurbulence` di data URI (ubin 160 px, putih 22%). Gradasi tegak berakhir di Navy Pass, jadi pita di bawah rel
    (`.beranda-tiket::before`, Navy Pass + butiran) menyambung tanpa sambungan. `.bar` juga mendapat butiran (di HP dan tablet
    yang punya kepala, `background: none` lama tetap menang). Lapisan pudar `::after` versi 1.7 dihapus; cahaya pelan `::before`
    versi 1.8 tetap. Login memakai `background-attachment: fixed` supaya gradasinya selebar layar, bukan sepanjang halaman.
    **Ikon PWA dan favicon tidak diubah** (masih bertekstur garis di `icons/ikon.svg`; mengganti ikon tidak sampai ke HP yang sudah
    memasang aplikasi), jadi Bagian 4.5 tetap.
240. **Bar bawah kaca buram:** `.menu-grup` di dalam `@supports (backdrop-filter)` berlatar Navy Pass 86% dengan `blur(16px)
    saturate(150%)`, tepi `rgba(169,184,207,.16)`, kilau `inset 0 1px 0` putih 8%. Pratinjau memakai 78%; dinaikkan ke 86% karena
    kata menu (Teks di Navy) di atas kartu putih yang terburam hanya sekitar 4,3:1 pada 78%. Desktop mematikan `backdrop-filter`
    (menu di bar atas). Pil menu aktif bergradasi `#1D3A66` → Navy Lapis dengan kilau tepi atas. Tanpa dukungan buram: Navy Pass
    padat seperti dulu. Catatan uji: di Chromium tanpa layar, isi yang sedang bergerak masuk (`.ungkap`) sesaat tampak tajam di
    belakang kaca pada tangkapan layar; setelah geraknya selesai buramnya benar.
241. **Kartu garis rambut:** satu perubahan token, `--bayang-kartu` = `0 0 0 1px var(--garis-rambut)` (Navy Pass 7%), `0 1px 2px` 4%,
    `0 12px 32px -12px` 18%. Berlaku untuk semua pemakai token (kartu, bingkai tabel, kartu form, menu nama pengguna, dan lainnya).
    `.kartu-item.masalah` tetap menaruh tepi Masalah lebih dulu.
242. **Uji** (di luar repo): server Node yang menjalankan Code.gs asli di atas `supabase/src/sheet.js` dan `layanan.js` di memori
    (setupSpreadsheet, pemasangan, staff, item, unit, kiriman Stock/Suhu/Waste), aplikasi dibuka di Chromium dengan alamat API
    https tiruan yang dialihkan `context.route`. Tangkapan sebelum/sesudah (Login, Beranda, Dashboard, Item, Riwayat di 390 dan
    1366 px); sapuan 10 rute pada delapan ukuran Bagian 4.6 dan "kurangi gerak" di 390 dan 1366 px: tanpa gulir samping, kotak
    galat, atau galat konsol, kepala berbutiran tanpa garis, kaca hanya di bar bawah, kartu bergaris rambut, tanpa animasi saat
    "kurangi gerak". Belum diuji di HP asli: kelancaran buram kaca saat menggulir di HP Android murah (jika berat, kaca bisa
    dimatikan dengan menghapus satu blok `@supports`), dan tampilan butiran di layar HP.

### Perpindahan layar dan angka berhitung, spesifikasi tampilan 1.12 (aplikasi 0.18.0, 17 Oktober 2026)

243. **Asal dan keputusan pemilik.** Sesudah pola navy (butir 238) pemilik bertanya bagaimana jika ada library dan gerak
    baru. Pratinjau (artifact "Pratinjau Gerak InventoryKu") menunjukkan perpindahan layar dengan View Transitions dan angka
    yang berhitung naik dalam tiga kecepatan. Pemilik memilih keduanya, kecepatan sedang (900 ms), dan **mencabut ATURAN TETAP
    gerak tanpa batasan**, supaya library bisa dipakai kelak. ATURAN TETAP kini: gerak boleh JavaScript, View Transitions, dan
    library animasi/grafik; library disimpan di repo (alasan teknis: PWA tanpa sinyal dan tanpa langkah build); "kurangi gerak"
    tetap dihormati. Rilis ini sendiri tidak memakai library. Spesifikasi tampilan Bagian 8.1–8.3, 8.5 (baru), 10, 11.
244. **Perpindahan layar** (`jalankanRute` → `gambarRute`, app.js): `jenisPindah(lama, menuLama, baru, menuBaru)` memberi
    `buka` (`/` → rute form, `POLA_FORM`), `tutup` (kebalikannya), `maju`/`mundur` (urutan menu di `#menu-grup`; di menu yang
    sama: jumlah segmen alamat), atau `ganti`. Tanpa perpindahan mulus jika: belum ada layar sebelumnya (`jalurTampil`, dikosongkan
    `tampilMode` saat bukan mode aplikasi), alamat sama, `document.startViewTransition` tidak ada, "kurangi gerak", atau halaman
    tersembunyi; saat itu `gambarRute(..., true)` memasang `.layar-masuk` seperti dulu. Dengan perpindahan mulus, `.layar-masuk`
    tidak dipasang (supaya tidak dobel) dan tiket Beranda tidak turun (`transisiAktif`). `html.vt-<jenis>` memilih animasi
    `::view-transition-old/new(root)` di app.css: layar lama memudar dulu 120–150 ms, layar baru masuk 200–300 ms sesudah jeda
    60–100 ms (tanpa jeda, isi kedua layar bertumpuk dan sulit dibaca). `.menu` (HP/tablet) dan `.bar` (desktop) punya
    `view-transition-name` sendiri; gambar lamanya disembunyikan dan gambar barunya hidup, jadi pil menu tetap bergeser lewat
    transisi CSS-nya. Buka/tutup: `namaiPindah` memberi `view-transition-name: judul-form` pada `.tiket-nama` tiket form itu
    (`data-form`, dari `LAYAR_FORM` atau `/form/<ID>`) dan pada judul kepala layar form; nama dilepas sesudahnya. Perpindahan yang
    disusul perpindahan lain tidak menggambar layarnya (`nomorPindah`). Selama perpindahan, kaca bar bawah tidak memburam isi di
    belakangnya (gambar bar dirender terpisah), sekitar 0,3 detik.
245. **Angka berhitung** (`pasangHitungNaik`, `hitungNaik`): MutationObserver pada `#layar` (microtask, sebelum dilukis) mencari
    `.kepala-nilai-angka`, `.ubin-nilai`, `.kemajuan-angka`, `.kepala-angka-nilai` yang muncul dalam 900 ms sesudah layar digambar
    (`layarBaruSampai`) dan belum bertanda `data-hitung`. Angka = teks pertama di luar `<small>` yang cocok `POLA_ANGKA` (ribuan
    titik, desimal koma); awalan dan akhiran ("Rp ", "%", "−") tetap. 900 ms, kurva `1 − (1 − t)³`, format `Intl.NumberFormat
    ('id-ID')` dengan jumlah desimal yang sama; di akhir teks asli dikembalikan persis. Selama berhitung elemennya `aria-hidden`
    dan teks akhirnya ada di `<span class="sr">` di sebelahnya. Angka 0 dan "–" tidak berhitung. CSS: animasi `angka-naik` untuk
    keempat kelas itu dihapus (tanggal pembuka Beranda tetap), ditambah `tabular-nums`.
246. **Uji** (di luar repo; server dan Chromium seperti butir 242): Beranda → Riwayat (`vt-maju`), kembali (`vt-mundur`), tiket
    Stock (`vt-buka`, nama tiket bernama sebelum, judul "Stock Inventory" sesudah, nama dilepas), kembali ke Beranda (`vt-tutup`,
    tidak ada nama tersisa), Dashboard: angka di tengah (Rp 385.902, "1 dari 4") dan akhir persis (Rp 548.500, "2 dari 4"), tanpa
    `aria-hidden` tersisa; tanpa perpindahan setelah login; "kurangi gerak": tanpa View Transitions dan angka langsung akhir;
    `startViewTransition` dihapus: `.layar-masuk` seperti dulu dan angka tetap berhitung; desktop 1366 maju, mundur, buka Waste;
    tanpa galat konsol; sapuan 10 rute pada delapan ukuran dan "kurangi gerak". Belum diuji di HP asli (rasa geraknya dan Safari
    iPhone).

### Keamanan login: kunci bertingkat dan PIN yang mudah ditebak (Code.gs v0.17, aplikasi 0.18.1, 17 Oktober 2026)

247. **Asal:** pemilik meminta telaah aplikasi (fitur, keamanan login, saran lain), lalu memilih dua saran keamanan login: kunci
    bertingkat dan PIN yang terlalu mudah ditebak. Alasan: kunci 15 menit yang berulang tanpa batas membolehkan 480 tebakan per hari
    per nama, sedangkan alamat aplikasi dan API publik dan `infoLogin` memberi daftar nama tanpa login (dengan 4 nama, sekitar 50%
    peluang menebak salah satu PIN dalam setahun). Sesudahnya 15 tebakan per nama per sekitar 25 jam. Spesifikasi sistem Bagian 7.2
    dan 10, tampilan Bagian 5.1, 5.2, 5.7, dan 7.
248. **Kunci bertingkat** (`keadaanGagal_`, `bacaGagal_`, `catatGagal_(…, bertingkat)`, Script Property `GAGAL_PIN_<hash nama>`):
    isinya kini `{ j, s, k: [waktu mulai tiap kunci], p: kunci 24 jam }`; `k` hanya menyimpan kunci dalam 24 jam terakhir
    (`JENDELA_KUNCI_MS`). Kunci ke-3 (`KUNCI_KE_PANJANG`) dalam 24 jam berlangsung 24 jam (`LAMA_KUNCI_PANJANG_MS`); setelah itu
    semua kunci lama sudah lewat 24 jam, jadi kunci berikutnya kembali 15 menit. `keadaanGagal_` murni (tidak menulis), `bacaGagal_`
    hanya menghapus catatan yang sudah kosong, dan `bersihkanCatatanLama_` tidak menghapus catatan yang kuncinya habis tetapi masih
    punya kunci dalam 24 jam. Catatan versi lama (tanpa `k`) tetap terbaca. Login benar, reset PIN, pemulihan, dan hapus staff
    menghapus catatannya seperti dulu. Kode Pemasangan tetap 15 menit tanpa tingkat (8 huruf dari 31, tidak mungkin ditebak).
    Pesan: "PIN salah. Sisa 1 percobaan. Jika salah lagi, akun terkunci 24 jam.", "PIN salah 5 kali lagi. Akun terkunci 24 jam,
    atau sampai Head Kitchen atau Manager mereset PIN.", dan sisa waktu dalam jam jika lebih dari 60 menit (`sisaWaktu_`). Kunci
    baru mengganti versi data (`tandaiDataBerubah_`), supaya simpanan Beranda 2 menit di Apps Script tidak menyembunyikannya.
249. **Akun terkunci untuk Pengelola** (`akunTerkunci_`: satu `getProperties`, staff aktif yang punya PIN, urut abjad, tanpa menulis):
    Beranda `terkunci` (yang masih terkunci) tampil di bawah permintaan reset PIN, tanda Perlu ditinjau "Rina terkunci karena PIN
    salah", ketuk membuka lembar reset PIN (`hrefStaff(nama, true)`); setelah PIN direset, `hapusPermintaanDiBeranda` membuang
    keduanya dari Beranda tersimpan. Dashboard: butir `terkunci` tingkat Perlu ditinjau sesudah `resetPin`, ikon kunci, dengan
    "Terbuka sendiri 18 Okt 12.54". Email harian (bagian "Untuk Head Kitchen dan Manager"): akun yang terkunci dalam 24 jam terakhir,
    berapa kali, sampai kapan, dan untuk lebih dari sekali "mungkin ada yang mencoba menebaknya". Staff dan PIN: tanda di kartu PIN
    menyebut lama kunci dan jam terbukanya.
250. **PIN yang terlalu mudah ditebak** (`pinLemah_` di Code.gs, `pinLemah` di app.js dengan aturan yang sama): berulang tiap 1, 2,
    atau 3 angka, berurutan naik atau turun (dengan putaran 9→0, misalnya 890123), atau di `PIN_LEMAH_LAIN` (112233, 111222, 123321,
    147258, 258369, 159753, 147852, 102030): 1.118 dari 1.000.000 PIN. Diperiksa `periksaPinBaru_` di `pasang`, `pulihkan`,
    `tambahStaff`, dan `aturPin`, dan di HP oleh `periksaPinGanda` (dipakai keempat layar itu) sebelum server dipanggil. `login`
    tetap memakai `periksaFormatPin_`, jadi PIN lama yang lemah tetap bisa masuk sampai direset.
251. **Uji** (di luar repo): Code.gs asli di Node di atas `supabase/src/sheet.js` dan `layanan.js` dengan jam tiruan: 15 uji server
    (PIN lemah ditolak di keempat aksi tanpa memakai Kode Pemasangan, PIN lama lemah tetap login, kunci 15 menit lalu 15 menit lalu
    24 jam dengan pesan peringatan, sisa "23 jam", Beranda/Dashboard/Staff dan PIN, Staff tanpa `terkunci`, email harian, login orang
    lain tidak menghapus kunci, kunci 24 jam terbuka lalu kembali 15 menit, reset PIN membuka kunci, catatan versi lama, Kode
    Pemasangan tetap 15 menit), 15 jawaban aksi dibanding Code.gs v0.16.1 (hanya kolom baru yang berbeda; pesan PIN salah,
    Dashboard, dan email lain sama), dan Chromium dengan API tiruan yang memanggil `doPost` asli (pemberitahuan di Beranda, ketuk
    membuka lembar PIN, PIN 123456 ditolak di HP, reset membuka kunci dan pemberitahuan hilang, tanda kunci 24 jam di Staff dan PIN,
    butir Dashboard membuka lembar PIN, delapan ukuran tanpa gulir samping dan pemberitahuan ≥ 44 px, tanpa galat konsol). Hasil
    rakitan lolos pemeriksaan sintaks. Belum diuji di Supabase asli dan di HP.

### Penjualan per menu dan pemakaian seharusnya (Code.gs v0.18, aplikasi 0.19.0, 17 Oktober 2026)

252. **Asal dan keputusan pemilik:** dari telaah aplikasi, pemilik meminta tiga fitur (penjualan per menu, notifikasi HP, arsip
    tahunan) dan memilih: porsi per menu dicatat **per hari** oleh Pengelola dari laporan kasir; notifikasi ke semua HP yang
    mengaktifkan (pengingat cek suhu) dan ke HP Pengelola (lainnya); arsip menyimpan tahun berjalan dan tahun lalu; **satu fitur per
    PR**. Butir ini fitur pertama. Spesifikasi sistem Bagian 5.9, 9.3, 10, 13; tampilan Bagian 5.10 dan 7.
253. **Data:** `Data_PenjualanMenu` (`TAB_DATA`, dibuat `setupSpreadsheet`): Tanggal, Nama Menu, Porsi (format bulat), Harga Jual (Rp)
    (tersalin saat baris dibuat, sebagai catatan), kolom sistem; urut tanggal terbaru, nama menu. `simpanPenjualan` dengan `porsi`
    menulis porsi lebih dulu (`tulisPorsiMenu_`, di dalam kunci yang sama): menu harus ada di `M_Menu` (aktif atau nonaktif), porsi
    bilangan bulat 0–100.000 (`periksaPorsi_`), menu ganda ditolak; baris yang ada ditimpa (`Log_Perubahan` kolom Porsi), menu yang
    tidak dikirim tetap. Tanpa tab: `simpanPenjualan` dengan porsi menolak dengan petunjuk setupSpreadsheet, tanpa porsi tetap jalan.
    Ganti nama menu mengganti Nama Menu di `Data_PenjualanMenu` (`gantiNamaMenuPenjualan_`).
254. **Hitungan** (`bahanMentahMenu_`, `pemakaianTeoritis_`, `bandingTeoritis_`): bahan mentah per porsi = takaran bersih ÷ hasil
    bersih; bahan yang punya resep aktif dipecah ke bahan resepnya (qty ÷ hasil × qty bahan, bertingkat; resep tanpa hasil/bahan atau
    melingkar masuk `tidakBisa`). Item "bahan" = predikat yang sama dengan `pemakaianBahan_` (tidak punya resep aktif), jadi kedua sisi
    menilai item yang sama. Harga `hargaPada_` hari itu. `pemakaianBahan_` kini juga mengisi `peta` (qty dan nilai per bahan) untuk
    perbandingan per item. Bahan lain (dipakai nyata tetapi tidak ada di menu mana pun) dibanding bahan kecil %. Lengkap = setiap hari
    periode punya porsi, kecuali hari penjualan Rp 0 (`porsiKurang_`). Food cost seharusnya hanya jika penjualan juga lengkap. Resep
    menu yang dipakai: yang sekarang (tidak ada riwayat resep, sama dengan HPP per menu).
255. **Layar** (app.js): `bukaCatatPenjualan` memanggil `penjualanTanggal` setiap tanggal diganti (nomor muat menjaga jawaban yang
    terlambat), mengisi penjualan dan catatan yang sudah tercatat jika belum diketik, dan menampilkan daftar porsi (`.porsi-*` di
    app.css). Gagal memuat (server lama, tanpa sinyal): penjualan tetap bisa disimpan tanpa porsi. Kartu `kartuTeoritis` di layar HPP
    (kolom kiri, sesudah Pemakaian bahan); `BATAS_SELISIH_PORSI` = 2 (%) memilih tanda Baik atau Perlu ditinjau (keputusan tambahan:
    spesifikasi tidak menyebut batas). Per menu: `m.porsi` (kolom Terjual di desktop). Kepala: "Seharusnya 43,9% menurut porsi terjual".
256. **Dashboard dan rekap:** `ringkasHppDashboard_` menggabungkan hari tanpa penjualan dan hari tanpa porsi (sejak porsi pertama) ke
    pengingat `penjualan`, dengan "(porsi per menu tanggal …)" di keterangannya. Rekap bulanan: `hasil.hpp.teoritis`, bagian PDF
    `isiPdfRekapTeoritis_` (tabel seharusnya/nyata/selisih, catatan cara hitung, 10 bahan) sebelum "Menu di atas target", dan satu
    baris di email. Sebelum porsi pernah dicatat, rekap dan email sama persis dengan v0.17.
257. **Uji** (di luar repo): Code.gs asli di Node di atas `supabase/src/sheet.js` dan `layanan.js` dengan jam tiruan dan data Oktober
    (Ayam hasil bersih 80%, Nasi, Sambal dari resep Cabai, Minyak di luar menu, 50 porsi): seharusnya Rp 659.200 (640.000 + bahan kecil
    3%), nyata Rp 701.200, selisih +Rp 42.000 (+6,4%), food cost seharusnya 43,9% vs 46,7%, per bahan Ayam +1 kg +Rp 40.000, dihitung
    tangan. 10 uji server (validasi porsi, belum lengkap, hari tutup, Log_Perubahan, ganti nama menu, rekap PDF, Staff ditolak, tanpa
    tab), 10 jawaban aksi lama (hpp dua bulan, dashboard, daftarMenu, beranda, formStock, riwayat, simpanPenjualan, email harian dan
    rekap, isi PDF rekap) sama dengan v0.17. Chromium: alur kartu Menunggu → Catat porsi 16 Okt → porsi 2,5 ditolak → simpan → kartu
    lengkap dan kepala, lembar dibuka lagi terisi, Per menu dan tabel desktop, Dashboard tanpa pengingat, server lama tanpa
    `penjualanTanggal`, delapan ukuran (tanpa gulir samping, elemen keluar layar, sasaran < 44 px), tanpa galat konsol. Belum diuji di
    Supabase asli dan di HP.

### Notifikasi ke HP (Code.gs v0.19, aplikasi 0.20.0, 17 Oktober 2026)

258. **Asal:** fitur kedua dari permintaan butir 252 (pemilik memilih pengingat cek suhu ke semua HP yang menyalakan notifikasi, sisanya
    ke HP Pengelola). Spesifikasi sistem Bagian 7.2, 10.1 (baru), 12, 13; tampilan Bagian 4.3, 5.2, 5.7, 5.11 (baru), 7.
259. **Pengiriman (Supabase saja)** `supabase/src/push.js`: Web Push RFC 8030/8291/8292 dengan WebCrypto (`crypto.subtle`), tanpa
    library (rakitan tetap satu file). Kunci VAPID ECDSA P-256 dibuat sekali dan disimpan di `inventoryku.info` kunci `vapid`
    (`{ publik, privat: JWK }`), jadi pemilik tidak memasang secret; JWT ES256 per origin layanan push (aud), berlaku 12 jam, disimpan
    1 jam, `sub` = alamat Edge Function (`ALAMAT_API`). Isi JSON dienkripsi aes128gcm (rs 4096, satu rekaman). Header `TTL` (bawaan
    1 hari, pengingat 3 jam), `Urgency` high untuk suhu dan kunci 24 jam. `kirimSemua` mengirim bersamaan; 404/410 = langganan hilang.
260. **Alur** (`layanan.js` `NotifikasiHp`, `runtime.js`): runtime memuat kunci publik sebelum transaksi (`k.info.vapidPublik`); Code.gs
    memanggil `NotifikasiHp.kirim(langganan, isi)` yang hanya menitip ke `k.push`; sesudah transaksi tersimpan runtime memanggil
    `push.kirimSemua`, lalu menjalankan `hapusLanggananPush_` untuk yang hilang. Aksi yang gagal sebelum commit tidak mengirim apa pun;
    galat dari `doPost` yang ditangkap (misalnya PIN salah yang mengunci) tetap tersimpan dan mengirim. Di Apps Script `NotifikasiHp`
    tidak ada (`typeof`), jadi semua fungsi notifikasi diam (`notifikasiTersedia_`).
261. **Code.gs:** langganan per HP di Script Properties `PUSH_<sha256 endpoint 32>` = `{ endpoint, keys, nama, waktu }` (tidak tersalin ke
    Sheets); paling banyak 50, yang paling lama dibuang. `kirimNotifikasi_(sasaran, isi)`: `pengelola` = staff aktif ber-PIN dengan role
    Pengelola saat dikirim, `semua` = staff aktif ber-PIN. Pemicu: `aksiKirimSuhu_` (ada suhu di luar standar; satu notifikasi berisi
    semua unit itu), `aksiLupaPin_` (permintaan baru saja), kunci PIN baru di `aksiLogin_`, `pengingatSuhu_(waktu)` (form Suhu tampil,
    ada unit aktif, dan waktu cek itu belum diisi semua unit hari ini). Jam pengingat `M_Konfigurasi` `jam_cek_opening/middle/closing`
    (baris belum ada = 08:00/14:00/21:00; kosong = mati; `jamPengingat_`). `pasangTrigger` memasang trigger harian `pengingatSuhu*`
    hanya `DI_SUPABASE_`; mengubah jam pengingat di Outlet dan jadwal langsung memasang ulang jadwal di Supabase (tanpa "Perlu
    dijalankan"). `__jadwal` menjalankan pengingat dengan `muat: 'master'` supaya ringan.
262. **HP:** `sw.js` menangani `push` (ikon 192, `tag` + `renotify`, `data.url`) dan `notificationclick` (jendela aplikasi yang ada
    difokus lalu `navigate`, selain itu `openWindow`). Menu nama pengguna kini dua pilihan, "Notifikasi" (ikon `lonceng`, difokus
    pertama) dan "Keluar", dengan panah atas/bawah. `bukaNotifikasi` (app.js): dukungan dicek (`serviceWorker`, `PushManager`,
    `Notification`; iPhone di Safari tanpa Layar Utama mendapat petunjuk pasang), `navigator.serviceWorker.ready` dengan batas 6 detik,
    `infoNotifikasi` dengan endpoint HP ini. Menyalakan: `Notification.requestPermission()` dipanggil pertama di dalam ketukan (syarat
    Safari), lalu `subscribe({ userVisibleOnly, applicationServerKey })` (langganan lama dengan kunci lain dibuang dulu), lalu
    `aturNotifikasi`. Mematikan: server dulu, lalu `unsubscribe`. Keluar tidak mematikan notifikasi HP itu (keputusan tambahan: HP dapur
    dipakai bersama, dan pengingat suhu memang untuk HP, bukan orang). Outlet dan jadwal: kartu "Pengingat cek suhu" hanya jika server
    mengirim `jamCekOpening` (server lama: tidak tampil dan tidak dikirim).
263. **Uji** (di luar repo): (1) `push.js`: kunci tersimpan dan dibaca ulang oleh isolate baru, isi didekripsi sesuai RFC 8291 dan oleh
    `http_ece@1.2.0` (library yang dipakai `web-push`), JWT diverifikasi dengan kunci publik, garam berbeda tiap kiriman, 410 → hilang,
    500 dan galat jaringan dicatat. (2) 12 uji Code.gs di atas Spreadsheet tiruan `supabase/src` (sasaran Pengelola/semua, isi suhu,
    Lupa PIN sekali, kunci, pengingat lengkap/kurang/form disembunyikan/staff nonaktif, uji, HP berpindah pemilik, hapus, jadwal dan
    Outlet, server tanpa kunci). (3) Runtime asli (`runtime.js`, `server.js`, `push.js`) di atas Postgres 16 lokal dengan skema.sql:
    notifikasi suhu dikirim sesudah tersimpan dan didekripsi `http_ece`, langganan 410 hilang dari tabel `properti`, `__jadwal`
    pengingat dengan rahasia benar/salah, `pasangTrigger` menyimpan tiga jadwal pengingat. (4) `sw.js` di lingkungan service worker
    tiruan (tampil, isi bukan JSON, ketuk tanpa jendela dan dengan jendela). (5) Chromium dengan layanan push browser ditiru: nyalakan,
    uji, tutup-buka, matikan; Staff; iPhone Safari; izin diblokir; server tanpa notifikasi; Outlet dan jadwal; menu dengan panah; delapan
    ukuran. Jawaban aksi lama sama dengan v0.18 kecuali `bacaOutletJadwal` (kolom baru). Belum diuji: layanan push asli (Google FCM,
    Apple, Mozilla) dan HP asli, terutama iPhone dengan aplikasi di Layar Utama.

### Arsip tahunan (Code.gs v0.20, 17 Oktober 2026)

264. **Asal:** fitur ketiga dari permintaan butir 252. Pemilik memilih: simpan 2 tahun (tahun berjalan dan tahun lalu), arsip berupa
    berkas per tahun yang juga dibuka sebagai Google Sheets di Drive, Riwayat dan rekap tahun yang sudah diarsip tidak dibuka dari
    aplikasi, dan stock akhir terbawa. Spesifikasi sistem Bagian 8.4, 8.6 (baru), 12, 13; tampilan Bagian 7 (satu pesan).
265. **Yang dipindah** (`tabArsip_`, `arsipkanTab_`): baris semua tab `Data_*` (termasuk `Data_K_<ID>`), `Stock_Harian`, dan
    `Log_Perubahan` yang tanggalnya (kolom Tanggal, atau Waktu) sebelum `batasArsip_()` = 1 Januari tahun lalu menurut zona tersimpan.
    **Stock terbawa:** Stock Awal berasal dari rekap terakhir sebelumnya (`hitungUlangStock_`), jadi rekap terakhir tiap item sebelum
    batas tetap di `Stock_Harian`; tahun berikutnya rekap itu ikut pindah jika sudah ada rekap yang lebih baru. Baris dihapus per
    rentang berurutan dari bawah (`deleteRows`). Tab master, Harian, dan Dashboard tidak disentuh. Data lama yang dibaca fitur lain
    (opname terakhir, isian Suhu pertama untuk "terlewat", penjualan pertama) kini dihitung dari data yang tersisa.
266. **Berkas** `Laporan Kitchen/{Outlet}/Arsip/{Tahun}/Arsip_{Tahun}_{Tab}_{batas}[_{bagian}].json` berisi `{ jenis: 'arsip-inventoryku',
    tahun, tab, batas, dibuat, outlet, judul, baris }`; tanggal ditulis teks `yyyy-mm-dd` (atau dengan jam). Berkas bernama sama yang
    sudah ada dibuang lebih dulu (jalan ulang sesudah gagal). **Google Sheets:** `arsipJsonKeSheets_` menulis isinya ke
    "Arsip InventoryKu {Tahun}" di folder yang sama (satu tab per tab data, judul tebal dan dibekukan, ditambahkan di bawah per 5.000
    baris); tab "Keterangan" mencatat nama berkas yang sudah ditulis supaya tidak ganda. Di Apps Script (belum pindah) dipanggil
    langsung; di Supabase oleh `salinBerkasKeDrive_` (salinan 5 menit) untuk berkas `Arsip_<tahun>_…json`, dan kegagalannya hanya
    dicatat di log (berkas JSON tetap tersalin).
267. **Jalannya** (`arsipTahunan`, trigger `everyHours(1)` dari `pasangTrigger`; di Supabase pg_cron menit 7 tiap jam, `setiapJam` di
    adaptor.js): jika `arsip_sampai` ≥ batas, selesai tanpa menulis (hanya `M_Konfigurasi` dibaca; server.js menjalankannya dengan
    `muat: 'master'` dan runtime.js tidak memuat atau mempelajari `aksi_tab` untuk fungsi itu, jadi tab besar dimuat hanya saat ada
    pekerjaan: 2 ms di Postgres lokal). Kemajuan di Script Property `ARSIP_PROSES` `{ batas, selesai: [tab], baris, bagian: { tab: n } }`.
    Supabase: satu tab per jalan dan paling banyak `BARIS_ARSIP_PER_JALAN` (20.000) baris, yang tertua dulu, sisanya bagian berikutnya
    (batas CPU Edge Function); Apps Script: tab demi tab sampai 4 menit. Tiap tab di dalam `denganKunci_`. Setelah semua tab selesai:
    `arsip_sampai` = batas dan `arsip_terakhir` "Berhasil … (n baris) …"; galat: `arsip_terakhir` "Gagal …", dicoba lagi jam berikutnya.
    Selama bertahap (di Supabase beberapa jam di awal Januari), Riwayat tahun yang sedang dipindah bisa belum lengkap; tanggalnya baru
    ditolak sesudah `arsip_sampai` diisi. `sheet.js` `deleteRows` kini satu `splice`.
268. **Penolakan** (`periksaBelumDiarsip_`): `periksaTanggalIsian_` (semua isian), `rentangRiwayat_` (tanggal `dari`), `aksiUnduhPdf_`,
    `aksiSimpanPdfDrive_`, `aksiUnduhPdfRekap_` dan `dataHpp_` (tanggal 1 bulan itu), `aksiSimpanPenjualan_`: "Data sebelum 1 Januari
    2026 sudah dipindah ke arsip tahunan (Google Drive: Laporan Kitchen/<Outlet>/Arsip). Pilih tanggal yang lebih baru." Aplikasi
    tidak berubah: pesan server tampil seperti galat lain (bulan rekap dan HPP yang sudah diarsip tetap ada di pilihan bulan).
    Arsip tidak bisa dikembalikan dari aplikasi; pemilik memasukkannya sendiri jika perlu, seperti memulihkan cadangan.
269. **Uji** (di luar repo): (1) Code.gs asli di Node di atas `supabase/src/sheet.js` dan `layanan.js` dengan jam tiruan dan data 2024–2026:
    10 uji (satu tab per jalan lalu tidak bekerja lagi, baris 2024 hilang dan 2025–2026 tetap, satu rekap terbawa per item dan stock
    serta pemakaian HPP sama, isi berkas, penolakan tujuh aksi, hitung ulang stock sesudah arsip memakai rekap terbawa, setahun kemudian
    2025 diarsip dan rekap terbawa 2024 pindah, peringatan Gagal, `pasangTrigger`), diulang dengan batas 2 baris per jalan (berkas `_2`,
    yang tertua dulu). (2) `arsipJsonKeSheets_` dengan SpreadsheetApp/DriveApp tiruan (Sheets dibuat, ditambahkan, berkas sama tidak
    ditulis dua kali). (3) Runtime asli di atas Postgres 16 lokal lewat `__jadwal`: 50 item × 1.385 hari (69.250 baris per tab), dua tahun
    diarsip dalam 14 jalan, paling lama 922 ms, jalan tanpa pekerjaan 2 ms, 50 rekap terbawa, stock tetap, enam berkas terunggah.
    Jawaban 25 aksi lama sama dengan v0.19; uji PIN, porsi, notifikasi, dan runtime push tetap lulus. Belum diuji: Supabase dan Google
    asli (Drive, pembuatan Google Sheets, batas waktu Apps Script).

### Bacaan database lebih ringkas di Supabase (17 Oktober 2026)

270. **Asal:** pemilik bertanya apakah aplikasi bisa dimuat lebih cepat lagi dan memilih saran 2: mengurangi bolak-balik ke
    database di Edge Function. Code.gs, aplikasi, dan skema tidak berubah; jawaban semua aksi sama.
271. **Yang diubah** (`penyimpanan.js`, `runtime.js`): (a) `muatAwal` membaca daftar tab, Script Properties, dan info dalam satu
    query tanpa parameter (dulu tiga query ditambah `aksi_tab` berparameter). Dengan `prepare: false`, postgres.js mengirim query
    berparameter dalam dua kali bolak-balik (meminta jenis parameter dulu), dan di dalam `sql.begin` query tidak dikirim beruntun,
    jadi hanya query tanpa parameter yang hemat. (b) Aksi tulis: `select pg_advisory_xact_lock(4207)` dikirim di kiriman yang
    sama dengan bacaan awal (dua perintah dalam satu query sederhana). Postgres menjalankannya berurutan dan, pada read committed,
    bacaan memakai keadaan sesudah kunci didapat (diuji: penulis lain yang memegang kunci terlihat isinya). (c) `aksi_tab` dibaca
    sekali per isolate dan diperbarui di memori saat tab baru dipelajari; isolate lain yang mempelajari tab baru hanya
    menyebabkan satu percobaan ulang. (d) Tab yang belum ada di simpanan isolate dibaca dalam satu query (`muatTabBanyak`), bukan
    satu query per tab; ini yang paling terasa saat isolate baru menyala (semua tab master dimuat). (e) `muatDrive` satu kiriman.
    (f) Kunci publik notifikasi dimuat bersamaan dengan transaksi, bukan sebelumnya. Bolak-balik aksi baca yang sudah hangat:
    7 → 3 (begin, bacaan awal, commit). Penulisan perubahan (`tulis`) tetap satu query berparameter per perintah.
272. **jsPDF tetap dimuat saat Edge Function menyala.** Memuatnya hanya saat membuat PDF butuh `import()` dinamis, dan dukungannya
    pada Edge Function yang dideploy (dibungkus eszip) tidak bisa dipastikan dari dokumentasi atau diuji di sini; jika gagal,
    PDF dan laporan harian rusak. Penghematannya hanya saat isolate baru menyala.
273. **Uji** (di luar repo; Postgres 16 lokal dengan tabel `skema.sql`, Code.gs asli, jam tiruan): 35 langkah (setupSpreadsheet,
    pasang, staff, kategori, item, unit, Stock, kiriman ganda, Suhu, Waste, Beranda, Riwayat, Dashboard, PDF, HPP, PIN salah,
    login, laporan harian, keluar) dengan jawaban dan isi `tab_baris`, `tab_meta`, `aksi_tab` sama dengan versi sebelumnya (selain
    UUID dan garam PIN acak, yang juga berbeda antara dua jalan versi lama); proksi TCP jeda 25 ms per arah: isolate baru
    infoLogin 1.927 → 336 ms, login 1.240 → 393 ms, Beranda 478 → 268 ms, kirimStock 1.128 → 697 ms, Beranda hangat 370 →
    164 ms; dua runtime (dua isolate) mengirim 6 kiriman Stock dan 6 Beranda bersamaan (tiga kali): stock naik tepat 6, tanpa
    posisi baris ganda; kunci tulis menunggu penulis lain dan melihat isinya; file rakitan dijalankan utuh di Node (postgres dan
    jspdf dari npm, `Deno` tiruan) termasuk PDF. Belum diuji di Supabase asli: besar penghematan bergantung pada jarak Edge
    Function ke database (log `Aksi <nama>: <ms> ms` menunjukkan waktu Code.gs saja; sisanya waktu menunggu database dan jaringan).

### Function di region database (17 Oktober 2026)

274. **Asal:** database Supabase pemilik ada di Oceania (Sydney). Edge Function biasanya berjalan di region terdekat dengan
    HP (kemungkinan Singapore), jadi setiap bacaan database (3 per aksi baca sesudah butir 271, lebih banyak saat isolate baru
    menyala) menyeberang Singapore–Sydney. Region project tidak bisa diganti di tempat (harus project baru dan pindah data).
    Pemilik memilih pilihan A: memaksa function berjalan di region database.
275. **Caranya:** `config.js` = alamat function ditambah `?forceFunctionRegion=ap-southeast-2` (parameter alamat dari Supabase
    untuk permintaan yang headernya tidak bisa diatur; aturan "hanya header Content-Type" tetap terpenuhi). `panggilApi` memakai
    alamat itu apa adanya, dan service worker sudah memperbarui `config.js` di latar (butir 196), jadi HP memakai alamat baru
    mulai pembukaan berikutnya. Edge Function tidak membaca alamat permintaan, jadi tidak ada perubahan di `supabase/src`.
    Secret `ALAMAT_API` (jadwal pg_cron, `sub` notifikasi) tidak diubah karena pg_net memanggil dari region database;
    Script Property `SUPABASE_API` di Apps Script boleh diberi akhiran yang sama (opsional, salinan ke Sheet). Jika region
    itu gangguan, permintaan tidak dialihkan otomatis; parameter dihapus dari `config.js` untuk sementara. Langkah dan cara
    memeriksa (`x-sb-edge-region`) di `supabase/PANDUAN.md`.
276. **Uji** (di luar repo): Chromium dengan repo disajikan di `/inventoryku/` dan API tiruan lewat `context.route`: aplikasi
    mengirim `POST` ke alamat berparameter dengan satu-satunya header `Content-Type: text/plain;charset=utf-8`, Login tampil
    dengan nama staff, tanpa galat konsol. Belum diuji di Supabase asli: apakah function benar berjalan di `ap-southeast-2`
    dan berapa waktu yang dihemat.

### Kartu stok per transaksi (Code.gs v0.21, aplikasi 0.21.0, 18 Oktober 2026)

277. **Asal:** pemilik membandingkan aplikasi dengan dokumen usulan fitur ("InventoryKu Usulan Fitur Perbandingan") dan memilih
    INV-04 (kartu stok / riwayat mutasi) lebih dulu. Lembar riwayat per item sebelumnya hanya menampilkan rekap harian. Tidak ada
    tab, kolom, atau aksi baru; spesifikasi sistem Bagian 6 dan tampilan Bagian 5.4.
278. **Server** (`transaksiItem_`, dipanggil `dataRiwayatItem_`, jadi ikut di `riwayatItem` dan jawaban `sesuaikanStock`): membaca
    `SUMBER_STOCK` (sumber yang sama dengan `hitungUlangStock_`) untuk tanggal-tanggal 7 rekap yang dikirim, urut tanggal lalu
    `timestamp_server` (sama: urutan sumber dan baris). Saldo mulai dari Stock Awal rekap hari itu, jadi saldo terakhir tiap hari =
    Stock Akhir rekap (diuji). Jenis: Stock (Masuk dan Keluar dalam satu baris, ket "Masuk diketik 2 dus"), Hasil prep (ket jumlah
    resep dan shift), Dipakai prep (ket "Untuk Sauce bolognese (1,5 resep)"), Waste (kategori dan alasan), Penyesuaian (alasan dan
    catatan; selisih plus = masuk), Stock opname (penyesuaian beralasan Stock opname). Baris yang tidak menggerakkan stock (angka nol
    setelah koreksi, prep tanpa resep) dilewati. `oleh` = `submitted_by` (pengisi asli); `dikoreksi` = `updated_by` berisi.
    `formId`/`submissionId` hanya untuk Stock, Prep (juga baris bahan, karena `submission_id`-nya sama), dan Waste.
279. **Lembar** (`bukaRiwayatItem`): pilihan "Rekap harian" (bawaan, tabel lama) / "Transaksi" di atas isi, hanya jika jawaban punya
    `transaksi` (server lama: seperti dulu). Tanggal di tabel rekap menjadi `tabel-tombol` yang memilih Transaksi dan menggulir ke
    judul tanggal itu (fokus papan ketik ikut). Transaksi dikelompokkan per tanggal (lama ke baru, seperti tabel), judul berisi
    "Awal 30 kg"; baris: "Jenis · Oleh, jam" (tanggal ikut jika jam diterima berbeda hari dengan tanggal isian), keterangan dan
    "Pernah dikoreksi", lalu di kanan "+2 kg"/"−0,5 kg" dan "Saldo 31,5" (merah jika minus). Baris Stock/Prep/Waste berupa tautan
    `#/riwayat/<form>/<sid>` (lembar tertutup oleh router); penyesuaian dan opname baris diam. Warna masuk/keluar tidak dipakai
    (tanda + dan − saja), karena warna di aplikasi bermakna status.
280. **Uji** (di luar repo): Code.gs asli di Node di atas `supabase/src/sheet.js` dan `layanan.js`: urutan jenis dan tanggal, saldo
    per transaksi dihitung tangan, saldo akhir hari = rekap, koreksi Stock Masuk (dikoreksi, saldo baru), penyesuaian dan opname
    sebelum koreksi, hasil prep dengan ket, Staff, jawaban `sesuaikanStock`, item tanpa rekap, isian terlambat untuk kemarin.
    Chromium (zona Asia/Jakarta, API tiruan memanggil `doPost` asli): ketuk tanggal → Transaksi dan fokus, isi baris, tautan Waste
    membuka detail Riwayat dan lembar tertutup, Staff dari detail Riwayat tanpa Sesuaikan stock, server lama tanpa pilihan, delapan
    ukuran Bagian 4.6 (tanpa gulir samping, isi tidak melebar, sasaran ≥ 44 px, teks tidak terpotong) dan "kurangi gerak", tanpa
    galat konsol. Belum diuji di Supabase asli dan di HP.

### Pengingat stock ke HP Pengelola (Code.gs v0.22, aplikasi 0.22.0, 18 Oktober 2026)

281. **Asal dan keputusan pemilik:** butir kedua dari usulan fitur (SYS-07, notifikasi stok minimum dan kedaluwarsa). Pemilik
    memilih: hanya ke HP Pengelola, sekali pagi pada jam yang diatur (bukan seketika saat kiriman). Spesifikasi sistem Bagian 10.1,
    tampilan Bagian 5.7 dan 5.11.
282. **Server:** `PENGINGAT_STOCK` (kunci `jam_pengingat_stock`, awal 07:00, field `jamPengingatStock`, keterangan sendiri) berbentuk
    sama dengan `PENGINGAT_SUHU`; `PENGINGAT_JAM` = keduanya, dipakai pemeriksaan dan penulisan Outlet dan jadwal serta `pasangTrigger`
    (hanya `DI_SUPABASE_`; log/`pasang_trigger` menyebut "pengingat stock 07:00"). `pengingatStock_` → `isiPengingatStock_(hari ini)`:
    `ringkasStockHari_` (item aktif minus dan di bawah stok minimum, sama dengan Dashboard dan email) dan `masaSimpan_` (lewat dan habis
    besok). Item minus tidak diulang di "di bawah minimum". Judul "Stock hari ini: 1 minus, 3 di bawah minimum, 1 lewat masa simpan,
    1 habis besok" (bagian yang nol tidak ditulis), isi per bagian dengan `daftarNamaSingkat_`, ketuk membuka Dashboard, TTL 12 jam,
    urgensi biasa. Tidak dikirim jika semuanya kosong. Penerima `kirimNotifikasi_('pengelola')`. Di server.js `pengingatStock` masuk
    `FUNGSI_JADWAL` dan `JADWAL_RINGAN` (tab dimuat saat dibutuhkan). Jadwal baru baru terpasang setelah `pasangTrigger` dijalankan sekali
    (atau jam pengingat apa pun diubah di Outlet dan jadwal).
283. **Aplikasi:** Outlet dan jadwal punya kartu "Pengingat stock" (pemilih jam; kosong = mati) di bawah Pengingat cek suhu, hanya jika
    server mengirim `jamPengingatStock`. Lembar Notifikasi untuk Pengelola menambah baris "Pengingat stock (07.00), jika ada item di bawah
    minimum, minus, atau lewat masa simpan" atau "(sedang dimatikan)".
284. **Uji** (di luar repo): Code.gs asli di Node di atas `supabase/src/sheet.js` dan `layanan.js` (NotifikasiHp tiruan menampung kiriman):
    tanpa kiriman saat stock aman; isi dan judul untuk minus, di bawah minimum, lewat masa simpan (masa simpan 1 hari, prep 3 hari lalu),
    dan habis besok (prep kemarin); hanya HP Head Kitchen dan Manager, Staff dan Pengelola nonaktif tidak; jam awal 07:00, "06.30"
    tersimpan 06:30 dengan trigger 6:30, kosong menghapus trigger (tiga pengingat suhu tetap), jam salah ditolak, `infoNotifikasi`;
    tanpa kunci notifikasi diam; pengingat suhu tetap. Chromium: kartu di Outlet dan jadwal (ubah, simpan, kosongkan), lembar Notifikasi
    Pengelola dan Staff, server lama tanpa kartu, delapan ukuran, tanpa galat konsol. Belum diuji: layanan push asli dan pg_cron asli.

### Pemasok dan harga beli (Code.gs v0.23, aplikasi 0.23.0, 18 Oktober 2026)

285. **Asal dan keputusan pemilik:** butir ketiga dari usulan fitur (INV-07 data pemasok, INV-09 penerimaan, RPT-02 laporan
    pembelian). Spesifikasi Bagian 9.2 sebelumnya menulis "tidak mencatat pemasok"; kini diubah. Pemilik memilih: daftar
    master pemasok; harga beli yang berbeda diputuskan Pengelola (tidak otomatis menjadi harga satuan); semua role boleh mengisi,
    tidak wajib; laporan diserahkan ke saran (kartu stok, ringkasan bulan ini di Pengaturan → Pemasok, bagian Pembelian di rekap
    bulanan). Tidak dibangun: PO dan persetujuan pembelian, batch, harga per pemasok per item (spesifikasi sistem Bagian 5.1, 5.5,
    9.2, 9.3; tampilan Bagian 5.3, 5.4, 5.6, 5.7).
286. **Data:** `M_Pemasok` (Nama Pemasok, Kontak, Catatan, Aktif; `TAB_MASTER`, `KUNCI_MASTER`) dan dua kolom baru di `Data_Stock`:
    `Pemasok` (hanya di baris yang punya Stock Masuk) dan `Harga Beli (Rp)` (per satuan dasar, 2 angka di belakang koma; masuk dalam
    satuan besar: harga per dus ÷ isi). Pemasok satu per kiriman, harga beli per baris. `pembelianSiap_()` = tab dan kedua kolom ada;
    sebelum `setupSpreadsheet` dijalankan, form Stock dan Riwayat seperti dulu (kolom tidak dikirim), `kirimStock` dengan pemasok atau
    harga beli dan `simpanPemasok` menolak dengan petunjuk. Pemasok dicari tanpa membedakan huruf besar/kecil dan ditulis dengan
    ejaan master; pemasok nonaktif tetap diterima (antrean). Nama hanya bisa diganti (selain huruf besar/kecil) selama belum tercatat
    di `Data_Stock`. Kontak dan catatan lewat `teksAman_` (nomor "+62…" tetap teks di Sheet).
287. **Harga beli berbeda** (`hargaBeliBerbeda_`, Dashboard butir `hargaBeli`, Perlu ditinjau): pembelian terakhir tiap item aktif
    dengan harga beli dalam 31 hari (`HARI_HARGA_BELI`) dibanding `hargaPada_` pada tanggal beli (item tanpa harga juga masuk; beda
    < Rp 0,005 dianggap sama). "Pakai" memanggil `gantiHarga` (harga beli berlaku mulai tanggal beli; riwayat harga butir 166),
    "Abaikan" menyimpan waktu di Script Property `HARGA_BELI_DITINJAU` `{ namaKecil: ms }` sehingga pembelian yang dicatat sebelum
    waktu itu tidak ditandai lagi (item yang sudah tidak ada dibuang dari catatan). Tidak ada di Beranda atau email harian.
288. **Riwayat dan koreksi:** kepala Stock ditambah Pemasok (aplikasi menulis "dari Sumber Segar", `teksKepalaKiriman`); kolom `hargaBeli`
    memakai `ubah`/`normal` (jalur form kustom) sehingga kosong boleh; `periksaKoreksi` menolak harga beli pada baris tanpa Stock Masuk.
    Di aplikasi kolom koreksi berjenis `rupiah` dibaca `bacaRupiah`. Pemasok kiriman tidak bisa dikoreksi. Kartu stok: "Dari … · Harga
    beli Rp …/kg".
289. **`bacaRupiah`** (keputusan tambahan): titik di antara kelompok tiga angka adalah pemisah ribuan ("16.000" = 16000, "1.250.000,5"),
    selain itu sama dengan `bacaAngka`. Hanya untuk harga beli; Ganti harga dan isian lain tetap butir 35.
290. **Rekap bulanan:** `ringkasPembelian_` per pemasok (kiriman, item, baris, nilai = Σ round(masuk × harga beli), tanpa harga), tanpa
    pemasok paling bawah. Bagian PDF "Pembelian" (sesudah HPP) dan email hanya jika bulan itu ada pemasok atau harga beli yang dicatat,
    jadi rekap bulan sebelum fitur ini sama seperti dulu. Catatan PDF menjelaskan bedanya dengan nilai Masuk di bagian Stock (harga
    satuan).
291. **Uji** (di luar repo): Code.gs asli di Node di atas `supabase/src/sheet.js` dan `layanan.js`: Pengaturan → Pemasok (validasi, ganda,
    Staff ditolak), kiriman dengan pemasok huruf kecil, harga "16000", satuan besar 204.000/12 = 17.000, baris keluar tanpa pemasok,
    pemasok tak dikenal dan harga minus ditolak, Riwayat dan koreksi (ubah, kosongkan, tolak tanpa masuk), Staff melihat harga beli,
    kartu stok, Dashboard (dua item, Pakai, Abaikan, pembelian berikutnya muncul lagi, item tanpa harga), bulan ini per pemasok, ganti
    nama ditolak dan huruf besar boleh, nonaktif dan antrean, rekap (nilai dihitung tangan) dan PDF, server tanpa tab/kolom lalu
    `setupSpreadsheet`. Chromium: Staff HP (pilihan pemasok, kolom harga muncul setelah masuk, galat, draft setelah dimuat ulang, kirim,
    tanpa sinyal lalu antrean), tabel desktop, server lama, Pengaturan → Pemasok (tambah, nonaktifkan, nama terkunci), Dashboard (Pakai,
    Abaikan, lembar tertutup dan dimuat ulang), koreksi "15.500", delapan ukuran untuk tiga layar, tanpa galat konsol; uji kartu stok dan
    pengingat stock tetap lulus. Belum diuji: Supabase asli, salinan kolom baru ke Sheets, HP asli.

### Hasil prep aktual (Code.gs v0.24, aplikasi 0.24.0, 18 Oktober 2026)

292. **Asal:** butir keempat dari usulan fitur (KIT-06, perintah produksi dan hasil aktual). Pemilik meminta dilanjutkan tanpa pilihan
    tambahan, jadi dipilih yang paling sederhana: satu kolom tidak wajib, semua role, tanpa batch produksi atau perintah produksi.
    Kalimat lama spesifikasi "Hasil selalu mengikuti resep" diganti (sistem Bagian 5.3 dan 9.3, tampilan Bagian 5.3 dan 5.4).
293. **Data:** kolom `Hasil Aktual` di `Data_Prep` (di akhir kolom isian, ditambahkan `setupSpreadsheet`). `Hasil` tetap kolom yang
    menggerakkan stock (`SUMBER_STOCK`, masa simpan, tab Harian, HPP tidak berubah): `Hasil Aktual` jika diisi, selain itu Jumlah Resep ×
    Hasil per 1 Resep. Hasil menurut resep tidak disimpan (dihitung dari dua kolom yang ada). Bahan tetap menurut resep, Baik Sampai
    tidak berubah. Item tanpa resep: `hasilAktual` diabaikan saat kiriman (Qty sudah hasil nyatanya), ditolak saat koreksi.
    `hasilAktualSiap_()` = kolom ada; sebelumnya layar tidak menampilkan kolom dan kiriman yang membawanya ditolak dengan petunjuk.
294. **Koreksi:** kolom Riwayat `hasilAktual` memakai `ubah`/`normal` (kosong boleh) dan `turunan` Prep kini memilih hasil aktual. Mengoreksi
    Jumlah Resep pada baris berhasil aktual tidak mengubah Hasil (bahan tetap dihitung ulang). Properti kolom baru `jikaKolom` (dikirim
    `infoKolom_`): kolom hanya tampil dan bisa dikoreksi pada baris yang kolom acuannya berisi (`kolomBerlaku` di app.js). Perbaikan
    bersama `nilaiKolom`: kolom `jikaAda`/`opsional` yang kosong ditulis "–" juga setelah dikoreksi (dulu "0"), dan nilai lama yang kosong
    "(kosong)".
295. **Tampilan hasil menurut resep:** kartu stok "2 resep · hasil aktual (standar 10 liter)", PDF Prep "9,2" dengan "standar 10" kecil di
    bawahnya, baris Tercatat di layar "(9,2 liter, resep 10)". Rekap bulanan: kolom "Hasil standar" dan kalimat "Pada n catatan dengan
    hasil aktual, hasilnya 92% dari standar resep (…)" serta satu baris email, hanya jika bulan itu ada hasil aktual (rekap lama tetap).
296. **Perbaikan v0.23:** `susunBaris_` menolak kunci yang kolomnya belum ada, sehingga `kirimStock` (yang selalu mengisi Pemasok dan Harga
    Beli) gagal di Sheet yang belum menjalankan `setupSpreadsheet` sejak v0.23. Kini kolom versi baru ditulis lewat `kolomAda_` (Stock) atau
    hanya jika kolomnya ada (Prep). Pemilik sudah menjalankan `setupSpreadsheet`, jadi di produksi tidak terjadi; uji Sheet lama kini menamai
    ulang judul kolom, bukan menghapus tab saja.
297. **Uji** (di luar repo): Code.gs asli di Node di atas `supabase/src/sheet.js` dan `layanan.js`: kiriman dengan dan tanpa hasil aktual (stock
    9,2 + 5, bahan 4 + 2 menurut resep), item tanpa resep, angka minus ditolak, Riwayat `jikaKolom`, koreksi kosongkan (kembali 10) dan isi
    lagi, koreksi jumlah resep (hasil tetap, bahan dihitung ulang), tolak pada baris tanpa resep, PDF harian, rekap (56,7%) dan email,
    Sheet tanpa kolom lalu `setupSpreadsheet`, kiriman Stock di Sheet tanpa kolom pemasok. Chromium: Staff HP (kolom hanya untuk item beresep,
    persen, galat, kirim, Tercatat), tabel desktop, server lama, Riwayat kartu dan koreksi (kosongkan → "–"), delapan ukuran; semua uji
    fitur 18 Oktober lain tetap lulus. Belum diuji di Supabase asli dan HP.

### Masa simpan barang masuk (Code.gs v0.25, aplikasi 0.25.0, 19 Oktober 2026)

298. **Asal dan keputusan pemilik:** butir kelima dari usulan fitur. Pemilik memilih masa simpan per item: Pengelola mengisi
    "Masa simpan (hari)" di Pengaturan → Item, saat barang masuk "Baik sampai" terisi otomatis dan boleh diubah, Staff tidak perlu
    mengetik tanggal. Tidak dibangun: nomor batch, tanggal kedaluwarsa per kemasan, atau pelacakan per kiriman. Spesifikasi sistem
    Bagian 5.1, 5.3, 5.5; tampilan Bagian 5.2, 5.3, 5.4, 5.7.
299. **Data:** kolom `Masa Simpan (hari)` (bulat) di akhir `M_Item` dan `Baik Sampai` (tanggal) di akhir `Data_Stock`, ditambahkan
    `setupSpreadsheet`. `masaSimpanItemSiap_()` = kedua kolom ada; sebelumnya layar tidak menampilkan isian, `kirimStock` dengan
    `baikSampai` dan `simpanItem` dengan masa simpan berisi ditolak dengan petunjuk, kiriman tanpa keduanya tetap jalan (kolom ditulis
    lewat `kolomAda_`, butir 296). Masa simpan item: 0–365 seperti resep (`masaSimpanIsian_`); `simpanItem` tanpa field `masaSimpan`
    (aplikasi lama) tidak mengubah kolomnya.
300. **Baik sampai** (`baikSampaiMasuk_`): hanya baris yang punya Stock Masuk. Tanggal dari HP (Staff juga) jika ada; kosong = tanggal
    isian + masa simpan item saat server menerima (item tanpa masa simpan: kosong). Tanggal sebelum tanggal isian atau lebih dari 365
    hari sesudahnya ditolak. HP hanya mengirim tanggal yang diubah, jadi kiriman di antrean memakai masa simpan item saat diterima.
    Barang jadi yang dibeli jadi memakai masa simpan item; hasil prep tetap memakai masa simpan resep.
301. **Hitungan** (`masaSimpan_`): baris `Data_Prep` (Hasil) dan `Data_Stock` (Stock Masuk > 0) per item digabung, lalu stock tersisa
    dibagikan mulai yang paling baru (tanggal, lalu waktu diterima), seperti butir 103. Jadi barang masuk dengan Baik Sampai lewat
    hanya dihitung sebanyak bagian stock yang diperkirakan masih berasal darinya. Beranda, Dashboard (judul kini "n item lewat masa
    simpan" / "n item habis besok"), pengingat stock, dan email harian ("Tidak ada barang yang lewat …") memakainya tanpa perubahan lain.
302. **Riwayat:** kolom `baikSampai` (jenis `tanggal`, `ubah`/`normal` dengan teks yyyy-mm-dd; `aksiKoreksi_` menulis kolom berjenis
    tanggal sebagai tanggal sel dan teks ke `Log_Perubahan`); `periksaKoreksi` menolak tanggal sebelum tanggal isian. Tidak ditolak saat
    Stock Masuk dikoreksi menjadi 0 (baris itu tidak lagi dihitung). Properti kolom baru `jikaPositif: 'masuk'` (juga untuk harga beli):
    `kolomBerlaku` di app.js menyembunyikan kolom pada baris tanpa barang masuk. Lembar Koreksi memakai `<input type=date>` dengan
    `min` tanggal isian; nilai lama tanggal ditulis "22 Okt". Kartu stok: "Baik sampai 22 Okt".
303. **Layar:** Pengaturan → Item: isian "Masa simpan (hari, tidak wajib)" di kartu stok minimum/maksimum (hanya jika `masaSimpanSiap`),
    draft lama tanpa masa simpan diisi dari server. Form Stock: kolom "Baik sampai" (pemilih tanggal bawaan, `isian-tanggal`) muncul
    setelah Tambah masuk diisi, nilai awal tanggal + masa simpan; draft menyimpan `isian.baik` hanya jika berbeda dari hitungan otomatis
    (dikosongkan = kembali otomatis); tabel desktop punya kolom "Baik Sampai" hanya jika kategori itu punya item bermasa simpan, sehingga
    tabel di 1366 px bisa bergeser di dalam bingkainya (halaman tidak). Kata "barang jadi" pada masa simpan di Dashboard, email, Outlet
    dan jadwal diganti "item"/"barang".
304. **Uji** (di luar repo): Code.gs asli di Node di atas `supabase/src/sheet.js` dan `layanan.js`: Pengaturan → Item (validasi, aplikasi
    lama, kosongkan, Staff ditolak), kiriman otomatis/diubah/ditolak (sebelum tanggal masuk, > 365 hari, tidak terbaca), baris keluar
    tanpa baik sampai, pembagian stock 3 + 4 + 1 (lewat 5 kg hari ini; kemarin lewat 1 dan habis besok 4), Beranda Staff, Dashboard,
    pengingat stock, prep dan barang masuk bersama untuk satu item, Riwayat dan koreksi (ubah, tolak, kosongkan, Log_Perubahan), kartu
    stok, Sheet tanpa kolom lalu `setupSpreadsheet`. Chromium: Pengaturan → Item, Staff HP (otomatis, galat, ubah, draft setelah dimuat
    ulang, kirim), tabel desktop, server lama, koreksi tanggal di Riwayat, Beranda, delapan ukuran untuk tiga layar; uji fitur 18 Oktober
    lain tetap lulus. Belum diuji di Supabase asli, salinan kolom baru ke Sheets, dan pemilih tanggal di HP asli.

### Uji dan pemulihan cadangan (Code.gs v0.26, aplikasi 0.26.0, 19 Oktober 2026)

305. **Asal:** butir terakhir dari usulan fitur (SYS-04). Sebelumnya cadangan JSON mingguan dibuat dan disalin ke Drive, tetapi tidak
    ada cara memulihkannya ke Postgres ("dilakukan pemilik dengan tangan"). Spesifikasi sistem Bagian 9.4; `supabase/PANDUAN.md`
    bagian "Cadangan dan pemulihan". Tidak ada layar baru; aplikasi hanya membaca `cobaLagi`.
306. **Tiga fungsi editor** (Apps Script, sesudah pindah): `periksaCadangan` (baca dan periksa, mencatat jumlah baris per tab dibanding
    Sheet, tanpa menulis), `pulihkanCadangan` (nama berkas di Script Property `PULIHKAN_CADANGAN` sebagai konfirmasi, karena fungsi
    editor tidak menerima argumen; tanpa property hanya mendaftar cadangan; property dihapus sesudah berhasil), dan
    `ujiPemulihanCadangan` (mencadangkan isi sekarang lalu memulihkan berkas itu dari Drive: menguji jalur nyata Drive → Apps Script →
    Supabase tanpa kehilangan isian). Cadangan dibaca dari Drive, bukan dari Storage, supaya jalur yang sama berlaku saat project
    Supabase hilang. Pemeriksaan isi (`periksaIsiCadangan_`): daftar tab, isi berupa larik, tab ganda, `M_Staff`/`M_Konfigurasi`/`M_Item`
    berisi; tab versi sekarang yang tidak ada di cadangan lama hanya dicatat (setupSpreadsheet membuatnya lagi).
307. **Urutan pemulihan** (`jalankanPemulihan_`, di dalam kunci script supaya salinan 5 menit tidak berjalan): `__pulihkan tutup` (info
    `pemulihan`; runtime menolak aksi aplikasi dan jadwal sebelum menjalankan Code.gs, tanpa bacaan tambahan karena info sudah ikut bacaan
    awal) → `buatCadanganSebelumPulih` di Supabase ("Cadangan sebelum pemulihan yyyy-MM-dd HHmmss.json", nama unik, tidak ikut dibuang
    cadangan mingguan) dan disalin ke Drive → baca dan periksa → `__impor mulai` (pemulihan: properti dan info tetap, meta tab lama
    digabung, versi tab dimulai di atas versi lama supaya isolate lain tidak memakai isi lama) → `baris` per 2.000 → `selesai` (jumlah
    baris tiap tab harus sama dengan `harapan`, keadaan salinan tidak disimpan sehingga Sheet disalin penuh, info `pemulihan` dihapus) →
    `setupSpreadsheet` dan `pasangTrigger` diteruskan → `sinkronDariSupabase`. Database kosong (project baru): tanpa cadangan sebelum
    pemulihan.
308. **Kegagalan:** sebelum `mulai`, aplikasi dibuka lagi (`buka`). Sesudah `mulai`, info `pemulihan` diberi `impor: true` di transaksi yang
    sama: aplikasi tetap ditutup, `buka` ditolak (`dibuka: false`), dan pemulihan berikutnya tidak mencadangkan isi setengah itu
    (`setengah`; uji ditolak). Pemulihan dijalankan tanpa `ping`, karena `ping` adalah aksi aplikasi yang ikut ditolak.
309. **Format cadangan 2** (`isiCadanganJson_`): `jenis: 'cadangan-inventoryku'`, `format`, `nama`, `tab[].meta { id, beku }`, tanggal `{ $d }`
    (`nilaiKeSupabase_`). Format 1 (teks ISO) tetap bisa dipulihkan: teks yang persis berbentuk `yyyy-mm-ddThh:mm:ss.sssZ` dibaca sebagai
    tanggal (teks isian tidak pernah berbentuk begitu).
310. **Yang tidak dipulihkan:** Script Properties Supabase (kunci PIN, sesi, langganan notifikasi; sengaja tidak ikut cadangan, karena hash
    PIN dengan kuncinya bisa ditebak dari berkas cadangan), isi Storage, dan baris status yang ditulis sesudah cadangan dibuat. Pemulihan
    di project yang sama: PIN dan sesi tetap. Project baru: PIN tidak berlaku, jalur `buatKodePemasangan` (butir 21).
311. **Uji** (di luar repo): Postgres 16 lokal dengan `skema.sql`, `runtime.js`/`server.js`/`sinkron.js` asli sebagai server HTTP (Storage di
    memori), Apps Script tiruan dengan Code.gs asli (Drive di memori, UrlFetchApp lewat curl, Sheet = Spreadsheet tiruan `supabase/src`):
    salinan ke Sheet dan cadangan ke Drive, periksa tanpa menulis, aplikasi ditutup (`cobaLagi`, fungsi lain dan jadwal ditolak), pulihkan
    (isi database sama dengan saat cadangan per tab, simpanan isolate tidak basi, PIN dan sesi tetap, Sheet disalin penuh, teks berawalan
    `+`/`=` tetap teks), batalkan lewat cadangan sebelum pemulihan, uji (isi sama persis), format 1, cadangan rusak (dibatalkan, aplikasi
    dibuka), nama tidak ada, putus di tengah (tetap ditutup, ulang berhasil), jumlah tidak cocok (ditolak, `buka` ditolak, uji ditolak,
    pulihkan berhasil), project baru (data, zona, jadwal; PIN lama ditolak). Chromium: kirim Stock saat server ditutup masuk antrean
    (bukan "Gagal kirim"), terkirim sesudah dibuka. Uji fitur 18–19 Oktober lain tetap lulus. Belum diuji di Supabase dan Google asli
    (batas 6 menit Apps Script untuk data besar, ukuran berkas cadangan).

### Tabel Stock muat di laptop dan teks lama (aplikasi 0.26.1, 19 Oktober 2026)

312. **Asal:** telaah aplikasi oleh Claude (19 Oktober 2026), butir 1 yang dipilih pemilik. Sejak harga beli (0.23.0) dan baik sampai
    (0.25.0) mendapat kolom sendiri, tabel isian Stock di laptop/desktop selebar 1.285 px di bingkai 1.152 px (976 px di 1.024 px) di
    semua lebar layar, jadi kolom Stock Akhir dan tanda "Stock akhir minus" baru terlihat setelah tabel digeser. Spesifikasi tampilan
    Bagian 5.3 diubah.
313. **Tabel Stock** (`layarStock`, kelas `tabel-stock`): kolom kembali No, Nama Item, Stock Awal, Tercatat Hari Ini, Tambah Masuk,
    Tambah Keluar, Stock Akhir, Satuan. Harga beli ("Harga beli per kg (tidak wajib)", awalan Rp) dan baik sampai (pemilih tanggal dan
    keterangannya) memakai elemen kartu yang sama (`kolomHarga`, `kolomBaik`) di sel Tambah Masuk (`sel-masuk`) dengan aturan tampil
    yang sama: harga beli setelah Tambah masuk diisi atau jika harganya sudah diketik, baik sampai setelah Tambah masuk diisi. Label
    kini memakai `for` di kedua tampilan; di tabel `aria-label` dengan nama item tetap dipakai. Sel Tambah Masuk berlebar tetap jika
    harga beli atau baik sampai bisa muncul (`ada-tambahan-masuk`: 184 px, 240 px mulai 1.280 px dengan kolom angka 104 px supaya
    pilihan satuan besar seperti "jerigen" tetap sebaris), sehingga kolom tidak melebar saat mengetik; teks di sel itu boleh turun
    baris (sel tabel memakai `nowrap`). Tanda di kolom Stock Akhir boleh turun baris (`white-space: normal`, sudut 12 px yang sama
    bulatnya untuk satu baris), supaya tabel muat di 1.024 px walau ada item minus. Kartu HP/tablet tidak berubah.
314. **Teks lama dari masa Apps Script** (benar di kedua mode): jam laporan di Outlet dan jadwal tanpa "(toleransi Google sekitar 15
    menit)"; bantuan hari cadangan "Cadangan semua data dibuat dini hari itu, sekitar pukul 03.00, dan disimpan di Google Drive
    (Laporan Kitchen/Cadangan)." (di Supabase cadangannya berkas JSON, bukan salinan spreadsheet); kalimat tetap "berlaku setelah
    pemilik Sheet menjalankan pasangTrigger" di kartu Jadwal diganti "Laporan harian dan cadangan mengikuti jam closing, jeda, hari
    cadangan, dan zona waktu ini."; pesan sesudah Simpan kini memakai `perluPasangTrigger` (dulu `jadwalBerubah`, yang juga bernilai
    true di Supabase walau jadwal sudah dipasang ulang otomatis, sehingga pemilik disuruh menjalankan pasangTrigger tanpa perlu);
    layar Stock dan Suhu tanpa item atau unit menunjuk ke Pengaturan (Pengelola) atau Head Kitchen/Manager (Staff), bukan ke tab
    `M_Item`/`M_Kategori`/`M_Unit` yang kini tertimpa salinan; pesan sambungan (`PESAN.alamatBukanHttps`, `tidakTerhubung`, `ditolak`,
    `jawabanTidakDikenal`) tanpa "Web App", "/exec", dan "akses: Anyone"; label pembaca layar "Lihat foto" tanpa "di Google Drive"
    (di Supabase tautannya Storage bertanda tangan). `PESAN_PASANG_TRIGGER` dan petunjuk menjalankan fungsi di editor Apps Script
    tetap, karena masih benar (hanya tampil jika `perluPasangTrigger`, dan editor meneruskan fungsi ke Supabase).
315. **Uji** (di luar repo): Code.gs asli di atas `supabase/src/sheet.js` dan `layanan.js` di memori dengan data contoh 12 hari, Chromium
    dengan API tiruan: lebar tabel di 1024, 1280, 1366, dan 1920 px untuk lima kategori (dengan harga beli, baik sampai, satuan besar,
    item minus, di bawah minimum) sebelum dan sesudah Tambah masuk diisi semua baris (tabel = bingkai, Stock Akhir di dalam bingkai,
    lebar sel Tambah Masuk tetap), urutan Tab, label satuan besar, aturan tampil, draft setelah dimuat ulang, tanpa galat konsol;
    kartu Stock di 320, 390, dan 768 px sama piksel per piksel dengan 0.26.0 (tiga kategori, Tambah masuk diisi); `simpanOutletJadwal`
    di mode Supabase menjawab `jadwalBerubah: true` dan `perluPasangTrigger: false`. Belum diuji di laptop pemilik.

### Tandai diperiksa sekaligus (Code.gs v0.27, aplikasi 0.27.0, 19 Oktober 2026)

316. **Asal:** telaah aplikasi oleh Claude (19 Oktober 2026), butir 2 yang dipilih pemilik. Pemeriksaan hanya bisa per kiriman
    (buka detail, Tandai diperiksa); data contoh 12 hari sudah berisi 64 isian belum diperiksa, dan dapur sungguhan (Stock per
    kategori, Suhu tiga kali, Prep, Waste) bisa lebih dari 300 per bulan, sehingga angka "belum diperiksa" di Beranda, Dashboard,
    dan email cenderung diabaikan. Spesifikasi sistem Bagian 6.2 butir 4; tampilan Bagian 5.4 dan 7.
317. **Tempat dan cakupan** (keputusan tambahan, kini dicatat di spesifikasi sistem 6.2 butir 4 dan tampilan 5.4): satu tombol per
    tanggal di daftar Catatan Riwayat, bukan satu tombol untuk seluruh daftar, supaya Pengelola tetap membaca isian hari itu sebelum
    menandainya (makna "Diperiksa oleh" di PDF). Hanya form yang sedang dipilih (Riwayat memang per form). Yang dikirim ke server
    adalah id kiriman yang tampil di daftar, jadi isian yang masuk sesudah daftar dimuat tidak ikut tertandai tanpa terlihat.
    **Filter:** selama filter kategori atau item dipakai, tombol tidak ada. Server menyusun kiriman Riwayat hanya dari baris yang
    cocok filter, jadi HP tidak tahu apakah baris yang tidak tampil dilaporkan keliru (tombol akan menghitung isian yang pasti
    dilewati server), dan menandai kiriman utuh akan mengunci baris yang tidak pernah terlihat. Filter pengisi dan status menyaring
    kiriman utuh, jadi tombol tetap ada dan konfirmasinya menulis "yang tampil dengan filter ini dan belum diperiksa".
318. **Server** (`aksiTandaiDiperiksaBanyak_`): id dirapikan (ganda dibuang), kosong ditolak ("Tidak ada isian yang dipilih. Muat ulang
    Riwayat."), lebih dari `BATAS_PERIKSA_BANYAK` (300) ditolak. Di dalam satu `denganKunci_`, tab dibaca sekali dan baris dikelompokkan
    per `submission_id`; kiriman yang masih punya baris `flagged_by` dilewati (`dilaporkan`), yang tidak ada dilewati (`tidakAda`),
    yang semua barisnya sudah Diperiksa dihitung `sudah`, sisanya ditulis seperti `aksiTandaiDiperiksa_` (status, checked_by,
    checked_at lewat `tulisSel_`; `Log_Perubahan` tidak ditulis, sama seperti Tandai diperiksa satu per satu). Satu kiriman yang
    dilewati tidak menggagalkan yang lain (berbeda dengan tombol satuan, yang menolak dengan pesan). `kiriman` di jawaban dibentuk
    `susunKiriman_` dari baris yang sama (termasuk `rincian` Prep), sehingga sama dengan `detailKiriman`. Versi data diganti saat
    keluar dari kunci, jadi Beranda dan Dashboard langsung ikut.
319. **Aplikasi** (`kepalaTanggal`, `tandaiTanggal`, `teksHasilPeriksa` di `layarRiwayat`): `.kelompok-kepala` (flex, turun baris jika
    sempit) berisi judul tanggal dan `.tombol-periksa-tanggal` (tombol kedua 48 px, padding samping lebih kecil) dengan `aria-label` "Tandai diperiksa (3), Minggu,
    18 Oktober". Jumlahnya = kiriman tanggal itu yang tidak berstatus Diperiksa dan `dilaporkan` 0; tanpa itu atau tanpa
    `periksaBanyak` (server lama) atau untuk Staff, judul seperti dulu. Tanpa sinyal: pesan "Tidak ada sinyal…" tanpa lembar. Lembar
    `konfirmasi` memanggil server; galat tampil di lembar. Sesudah berhasil, `perbaruiKiriman` (kini menerima daftar) mengganti kiriman
    di data layar (`gantiKirimanDi`, aturan baris tersaring yang sama dengan `gantiKirimanTersimpan`) lalu di simpanan Riwayat, dan
    menggambar ulang daftar serta detail kanan desktop. Dulu data layar diambil lagi dari simpanan, sehingga saat localStorage penuh
    daftar tetap basi (tombol dan tanda Terkirim tetap) atau berganti ke jawaban kueri lain. Pesan singkat `teksHasilPeriksa` (jenis
    info jika ada yang dilewati). Fokus papan ketik sesudah daftar digambar ulang jatuh ke halaman, sama dengan Tandai diperiksa dan
    Buka kunci di detail kanan; belum diperbaiki untuk semua aksi Riwayat.
320. **Uji** (di luar repo): Code.gs asli di atas `supabase/src/sheet.js` dan `layanan.js` dengan data contoh 12 hari: 30 uji server
    (riwayat `periksaBanyak`, Staff ditolak, satu kiriman dilaporkan keliru dilewati dan tetap Terkirim, id ganda dan tak dikenal,
    `Log_Perubahan` tetap, Beranda turun satu, ulang = `sudah`, koreksi baris terkunci ditolak lalu Buka kunci, daftar kosong/bukan
    larik/301 id/form tak dikenal, Suhu/Prep (dengan rincian)/Waste/form kustom), pembanding dengan `tandaiDiperiksa` (sel yang berubah
    sama: `status`, `checked_by`, `checked_at`; bentuk kiriman sama; jawaban = `detailKiriman`). Chromium dengan API tiruan: 27 uji (HP:
    tombol per tanggal, tanggal berlaporan "(1)" dan kalimatnya, Batal, Tandai, pesan, tanda, muat ulang, tanpa sinyal; desktop: detail
    kanan berganti ke Buka kunci; Staff dan server lama tanpa tombol; galat server di lembar; delapan ukuran Bagian 4.6 tanpa gulir
    samping, tombol ≥ 44 px di dalam layar, judul dan tombol tidak bertumpuk, teks tidak terpotong; dengan gerak), tanpa galat konsol.
    Sesudah telaah berlawanan (empat penelaah dan empat pemeriksa: server, aplikasi, teks, dokumen) ditambah 30 uji Chromium: filter
    item/kategori pada Waste dan Stock tanpa tombol, kiriman Waste yang dilaporkan tanpa filter tidak dihitung, filter pengisi dengan
    kalimat "yang tampil dengan filter ini" dan hanya kiriman Rina yang ditandai di server, localStorage penuh untuk simpanan Riwayat
    (tombol dan tanda tetap benar, daftar Satu tanggal tidak berganti ke kueri lama), tombol 48 px dan 16 px di 320 dan 1366 px, serta
    Tandai diperiksa dan Buka kunci di detail kanan desktop tetap memperbarui hitungan; 11 di antaranya gagal pada versi sebelum
    perbaikan. Temuan yang tidak diubah: penghapusan id ganda kuadratik (bukan bug pemakaian; tetap diganti peta objek) dan fokus
    sesudah daftar digambar ulang (butir 319). Belum diuji di Supabase asli dan di HP.

### Isi form Stock lebih cepat (Code.gs v0.28, aplikasi 0.28.0, 20 Oktober 2026)

321. **Asal:** telaah aplikasi oleh Claude (19 Oktober 2026), butir 3 yang dipilih pemilik: "Isi sisa", cari item, dan semua
    kategori di form Stock (juga cari item di Stock opname). Sebelumnya satu kiriman hanya untuk satu kategori tanpa kotak cari
    (5 kategori = 5 kali pilih dan kirim), dan pemakaian hanya bisa diketik sebagai Tambah keluar. Spesifikasi sistem Bagian 5.5;
    tampilan Bagian 5.3, 5.8, dan 7.
322. **Semua kategori** (keputusan tambahan): pilihan pertama di `<select>` Kategori (nilai ''), bawaan untuk draft tanpa kategori;
    draft lama yang sudah memilih kategori tetap di kategorinya. Item urut kategori (`data.kategori`) lalu nama, dikelompokkan di
    `section.stock-kelompok` dengan h2 nama kategori dan nama item h3 (pola Stock opname); di laptop/desktop satu tabel per kategori,
    nomor berlanjut. Satu kategori tetap seperti dulu (tanpa judul kategori, nama item h2). Draft tetap per kategori
    (`draft.isian[kategori][nama]`, `draft.sid[kategori]`), jadi kirim membuat satu kiriman per kategori yang diisi dengan
    `submissionId` sendiri: Riwayat (kepala Kategori), pemeriksaan, Diisi oleh di PDF per kategori, dan antrean tidak berubah,
    dan server tidak perlu aksi baru. Kiriman dikirim satu per satu (`kirimDari`); galat sambungan atau sesi habis: kategori itu
    dan sesudahnya masuk antrean; galat server: dicatat dengan nama kategori dan kategori berikutnya tetap dicoba. Pemasok kiriman
    berlaku untuk tiap kiriman kategori.
323. **Cari item:** `<input type=search>` di kotak info, hanya menyaring tampilan (tidak disimpan di draft). Penghitung, validasi, dan
    kirim memakai semua item di cakupan (kategori atau semua), jadi isian yang tersembunyi tetap terkirim dan keterangan di bawah
    kotak cari menyebut jumlahnya. Galat pada item tersembunyi mengosongkan pencarian lalu memfokuskan kolomnya. Stock opname memakai
    cara yang sama (hitungan tersembunyi tetap ikut Lanjut dan disimpan). `.kolom-cari` diberi `align-content: start` karena baris
    grid kotak info meninggikan kotak cari (55 px) di samping "Catat pemakaian".
324. **Hitung sisa** (server): `sisa` per baris; `angkaIsian_` (0 atau lebih, 3 desimal); keluar = `posisiStock_(rekap, tanggal).akhir`
    + masuk (satuan dasar, sesudah dus dikonversi) − sisa, dibaca di dalam kunci tulis sebelum kiriman ditulis. Keputusan: dihitung
    server, bukan HP, supaya kiriman lain yang masuk sesudah form dibuka (Staff lain, antrean) tidak terhitung dua kali dan Stock
    Akhir tanggal itu sama dengan sisa yang dihitung. Sisa > stock + masuk ditolak seluruh kiriman (pesan menyebut angkanya;
    meluruskan stock = penyesuaian Pengelola); sisa sama: baris dilewati, dan jika tidak ada baris tersisa "Sisa sama dengan stock
    tercatat, jadi tidak ada pemakaian yang perlu dikirim."; `keluar` dan `sisa` sekaligus ditolak; item yang sama dua kali dalam
    satu kiriman ditolak jika salah satunya membawa sisa (sisa dihitung dari stock sebelum kiriman). Sisa tidak disimpan sebagai
    kolom (tanpa setupSpreadsheet): yang tercatat Stock Keluar biasa, jadi Riwayat, koreksi, kartu stok, HPP, dan rekap tidak
    berubah, dan Stock Akhir di rekap sudah menunjukkan hitungannya. `formStock.sisaSiap` = server mengenal `sisa`.
    (Sebagian keputusan di butir ini diganti sesudah telaah, lihat butir 327.)
325. **Hitung sisa** (aplikasi): `grupPilihan` "Catat pemakaian" (Tambah keluar / Hitung sisa) tampil hanya jika `sisaSiap`;
    pilihannya `draft.cara` (per pengguna, tetap antar hari). `hitung()` memberi `sisa`, `keluar` (perkiraan HP dari stock yang
    dimuat), `tersedia`, `sisaSalah`, `sisaLebih`; Stock akhir = sisa. Kartu: label "Sisa sekarang", keterangan `.ket-keluar`
    (`aria-describedby`); tabel: kolom "Sisa Sekarang" dengan keterangan pendek (`td.sel-sisa`, 13 px, paling lebar 120 px, jadi tabel
    tetap muat mulai 1.024 px). Baris dengan sisa dikirim `{ sisa }` tanpa `keluar`; sisa yang sama dengan stock tanpa masuk tidak
    dikirim. Mengganti cara mengubah angka yang sudah diketik di semua kategori draft dengan rumus yang sama (`gantiCara`; angka
    salah dipindah apa adanya, hasil minus menjadi angka salah yang harus dibetulkan), supaya tidak ada isian yang diam-diam tidak
    terkirim. Server lama: pilihan tidak tampil dan form memakai Tambah keluar. `dataStockDariHp` kini juga membawa `masaSimpanSiap`
    (dulu terlewat) dan `sisaSiap`.
326. **Uji** (di luar repo): Code.gs asli di atas `supabase/src/sheet.js` dan `layanan.js`: 25 uji server (sisa saja, sisa + masuk
    dus, lebih ditolak tanpa menulis, sama dilewati dan pesan khusus, keluar + sisa, minus dan huruf, item ganda, kiriman lain di
    antaranya, kemarin dan hari ini ikut turun, kiriman ulang, koreksi baris sisa) dan jawaban jalur Tambah keluar (formStock,
    empat kiriman termasuk dus, pemasok, galat, Riwayat, rekap, kartu stok) sama persis dengan Code.gs v0.27. Chromium dengan API
    tiruan: 73 uji (Semua kategori bawaan dan urutan judul, cari dan fokus, isian tersembunyi ikut terkirim sebagai dua kiriman
    berbeda id, Hitung sisa dengan konversi dua arah, keterangan, sisa lebih ditolak di HP dengan fokus, sisa sama, kiriman membawa
    sisa dan Stock Akhir server = sisa, pilihan tersimpan, antrean dua kategori lalu terkirim, satu kategori ditolak server, tabel
    per kategori muat di 1024 dan 1366 px, server lama, galat pada item tersembunyi, draft satu kategori seperti dulu, cari di
    opname, delapan ukuran untuk Stock dan opname), uji Tandai diperiksa sekaligus, tabel Stock butir 312, dan sapuan 55 layar
    tetap lulus. Belum diuji di Supabase asli dan di HP.
327. **Perbaikan sesudah telaah berlawanan** (empat penelaah dan empat pemeriksa: server, aplikasi, teks, dokumen; 13 dari 17 temuan
    terbukti). (a) **Antrean tidak macet:** sisa yang lebih banyak dari stock saat diterima dulu menolak seluruh kiriman, jadi kiriman
    dari antrean yang stock-nya bergerak (Staff lain mencatat keluar) menjadi "Gagal kirim" selamanya dan barang masuk di kiriman itu
    hilang. Kini baris itu ditulis dengan Stock Keluar 0 (barang masuk, harga beli, pemasok tetap), jawaban membawa `sisaLebih`, dan
    HP menulis "Sisa … tidak dicatat: …" (juga di pesan antrean); jika tidak ada baris lain, `jumlah: 0` tanpa menulis. (b) **Sisa
    disimpan** di kolom `Sisa Dihitung` (`sisaStockSiap_`, `kolomAda_`, ditambahkan setupSpreadsheet; sebelum itu `sisaSiap` false dan
    `kirimStock` dengan sisa menolak dengan petunjuk), tampil di Riwayat (kolom `sisa`, tidak dikoreksi) dan kartu stok ("Keluar
    dihitung dari sisa 7,5 kg"). `turunan` Stock kini menerima `(gabungan, sebelum)` (`aksiKoreksi_` mengirim nilai sebelum koreksi):
    koreksi Stock Masuk menggeser Stock Keluar sebesar selisihnya (minus: keluar 0 dan sisa dikosongkan), koreksi Stock Keluar langsung
    mengosongkan sisa; keduanya tercatat di `Log_Perubahan`. Dulu koreksi masuk 20 → 2 pada baris sisa membuat Stock Akhir −15.
    (c) **Sisa sama dengan stock dicatat** sebagai baris keluar 0 bersisa (tanda sudah dihitung, kelengkapan terisi), bukan dilewati;
    dulu baris itu tertinggal di draft dan esoknya terkirim sebagai pemakaian palsu terhadap stock baru. (d) **HP tidak memutuskan
    dengan stock basi:** sisa yang tampak lebih banyak hanya peringatan ("Jika tetap dikirim, keluarnya tidak dicatat."), dan semua
    sisa yang diketik dikirim; dulu HP menolak sisa sah atau membuang sisa yang "sama" padahal stock di server sudah berubah. (e) **Ganti
    cara tidak mengonversi:** konversi memakai stock di HP yang bisa basi (keluar 0,2 menjadi keluar 2,2) dan angka minus hilang saat
    bolak-balik; kini ganti ditolak selama ada angka di cara lama ("Kirim atau kosongkan dulu …"). (f) **Hanya hari ini:** `modeSisa`
    mensyaratkan tanggal = hari ini (draft kemarin yang terbuka di "Kemarin" dengan "Sisa sekarang" membuat pemakaian terhitung dua
    kali); pilihan nonaktif untuk tanggal lain, sisa hari ini tetap di draft dan disebut di keterangan. `draft.sisaHari`: sisa yang
    diketik pada hari lain dikosongkan saat form dibuka, dengan pesan info. (g) Kotak info dan daftar item `inert` selama kiriman
    berurutan (angka yang diketik saat itu dulu hilang bersama kategori yang terkirim). (h) Mengetik di Cari item tidak menghapus pesan
    galat kiriman (`gambarItem({ simpanPesan })`); tanpa hasil "Tidak ada item dengan nama itu." (kata kunci 45 huruf dulu membuat
    halaman 320 px bergulir 89 px); `autocapitalize`/`spellcheck` sama dengan kotak cari lain. (i) Kalimat: bantuan Hitung sisa "Catat
    prep dan waste lebih dulu. …", "stock tercatat ditambah masuk" jika ada Tambah masuk (dulu masuk disebut "tercatat"), spesifikasi
    sistem 5.5 (Stock Akhir = sisa hanya saat diterima; gerakan yang dicatat sesudahnya mengurangi lagi; susut masuk Stock Keluar),
    Bagian 3, 5.7, dan tampilan 5.3. Tidak diubah: kiriman yang semua sisanya kebetulan sama dulu dinilai bukan masalah (kini tetap
    tercatat), kolom tabel antar kategori yang tidak segaris, dan tombol Cari di papan ketik (pola sama dengan kotak cari lain).
    Uji: 43 uji server (termasuk antrean, sisa lebih + masuk dengan pemasok dan harga beli, sisa sama, koreksi masuk dan keluar dengan
    log, kartu stok, Sheet tanpa kolom lalu setupSpreadsheet) dan jalur Tambah keluar sama dengan v0.27 selain kolom `sisa`; 87 uji
    Chromium (ganti cara ditolak, sisa lebih dikirim dan dilaporkan, pesan tetap saat mencari, sisa sama, Kemarin, sisa lama dibuang,
    inert selama kirim, antrean tidak macet dan barang masuk tercatat, kata kunci panjang di 320 px). Versi tetap Code.gs v0.28 dan
    aplikasi 0.28.0 (belum dirilis).

### Daftar belanja per pemasok dan pesanan (Code.gs v0.29, aplikasi 0.29.0, 21 Oktober 2026)

328. **Asal dan keputusan pemilik:** butir 4 dari telaah aplikasi (19 Oktober 2026). Pemilik memilih: item mengikuti **pemasok
    terakhir** (dari barang masuk, tanpa isian baru di Pengaturan), "Kirim ke WhatsApp" ke **nomor di Kontak** pemasok, dan
    **pesanan tersimpan** di server supaya Staff yang menerima barang melihatnya di form Stock (bukan hanya di HP Pengelola).
    Spesifikasi sistem Bagian 5.0, 5.5, 7.1, 8.2, 9.2, 10, 11, 12; tampilan Bagian 5.3, 5.9, 7. Tidak dibangun: PO dan
    persetujuan, harga di pesan WhatsApp, pesanan tanpa pemasok yang tercatat, jumlah datang dibanding jumlah pesanan,
    kedaluwarsa otomatis, pesanan di Riwayat atau Dashboard.
329. **Data:** `Data_Pesanan` (`TAB_DATA`, dibuat `setupSpreadsheet`): Tanggal, Pemasok, Nama Item, Kategori, Jumlah, Satuan Order,
    Jumlah Dasar, Satuan, Keadaan (Menunggu, Datang, Diganti, Ditutup; teks biasa, tanpa dropdown), Selesai Oleh, Selesai Pada,
    Kiriman Stock, lalu 13 kolom sistem (`status` tetap Terkirim dan tidak dipakai; pemeriksaan Riwayat hanya membaca tab form).
    Satu baris per item; `submission_id` = id pesanan. Urut tanggal terbaru, pemasok, item. `pesananSiap_()` = tab ada. Arsip
    tahunan, cadangan, dan salinan ke Sheets ikut dengan sendirinya (tab `Data_`). `bacaPesanan_` membaca baris dengan nomornya;
    `tandaiPesanan_` menulis keadaan sebelum tab diurutkan.
330. **Catat pesanan** (`aksiCatatPesanan_`, khusus Pengelola, di dalam kunci, `submission_id` diperiksa lebih dulu): pemasok wajib
    dan harus ada di `M_Pemasok` (nonaktif diterima, dari antrean), item di `M_Item`, jumlah > 0 (3 desimal), `besar` hanya untuk item
    bersatuan besar, item ganda ditolak, paling banyak 200 baris. **Satu pesanan menunggu per item:** baris Menunggu item yang sama
    (pemasok mana pun) menjadi Diganti; rancangan awal mengganti semua pesanan menunggu pemasok itu, dan telaah rancangan (butir 336)
    menunjukkan pesanan yang masih di jalan ikut hilang. **Pesanan yang terlambat dari antrean:** barang masuk item itu yang dicatat
    di HP sejak `waktuPerangkat` (paling lama 7 hari, `HARI_PESANAN_TERLAMBAT`), dengan pemasok yang sama atau tanpa pemasok, membuat
    baris langsung Datang (Selesai Oleh/Pada dan Kiriman Stock dari barang masuk itu), dan jawabannya menyebutnya di `sudahDatang`.
    Waktu pembanding dan barang masuk yang sudah dipakai: butir 338.
331. **Barang masuk menyelesaikan pesanan** (`selesaikanPesanan_`, di dalam kunci `kirimStock` sesudah baris ditulis): tiap item dengan
    Stock Masuk > 0. Baris yang membawa `pesanan` (dari "Isi dari pesanan") menyelesaikan pesanan itu; baris lain menyelesaikan
    pesanan menunggu paling lama untuk item itu dengan pemasok yang sama (huruf besar/kecil tidak dibedakan), atau pemasok mana pun
    jika kiriman tanpa pemasok, tanggal pesanan tidak sesudah tanggal kiriman, dan diketuk sebelum barang itu dicatat di HP
    (butir 338). Kiriman tanpa pemasok ikut menyelesaikan karena pemasok di form Stock tidak wajib: tanpa itu pesanan yang barangnya
    sudah datang tetap ditawarkan dan "Isi dari pesanan" membuat stock palsu. **Tautan** (`barisPesananTertaut_`, sebelum apa pun
    ditulis; sejak perbaikan butir 338 tidak pernah menolak kiriman): pesanan yang sudah Datang → Tambah masuk baris itu tidak dicatat
    (`pesananSudahDatang`), supaya isian dari dua HP tidak tercatat dua kali; Ditutup, diganti pesanan ke pemasok lain, atau id yang
    tidak dikenal → dianggap tanpa tautan; diganti pesanan dari pemasok yang sama → pesanan terbaru itu (menunggu: diselesaikan;
    sudah datang: seperti Datang). Jawaban `pesananDatang`. Koreksi kiriman sesudahnya tidak membuka pesanan lagi.
332. **Daftar belanja** (`dataBelanja_`): kelompok = pemasok pesanan menunggu item itu, lalu pemasok barang masuk terakhir
    (`pemasokTerakhir_`, dari `bacaPembelian_` semua tanggal), hanya pemasok aktif; selain itu kelompok '' ("Belum ada pemasok").
    Kelompok urut nama, '' paling bawah; item urut kategori (urutan `M_Kategori`) lalu nama. `menunggu` = semua pesanan yang masih
    punya baris Menunggu (umur dan pemasok mana pun). `kategori` tetap ada untuk aplikasi 0.28. **Nomor WhatsApp** (`nomorWa_`):
    deret angka yang panjang (boleh berisi spasi, tanda hubung, titik, kurung, dan + di depan); 0 di depan → 62, 8xx → 628xx,
    10–15 angka; nomor HP (628…) didahulukan, lalu nomor pertama yang sah, selain itu ''.
333. **Kartu Daftar belanja** (`kartuDaftarBelanja`, aplikasi): "Pesanan belum datang" di atas kelompok (Tutup pesanan dengan
    konfirmasi, butuh sinyal); tiap kelompok h3 nama pemasok dan "Kontak …"; Order awal = saran, kecuali item yang sudah dipesan dan
    kelompok "Belum ada pemasok" (kosong, supaya tidak terpesan dua kali atau ke pemasok yang salah; di awal hampir semua item belum
    punya pemasok). "Pesan ke" untuk kelompok itu. "Kirim ke WhatsApp" adalah `<a href="https://wa.me/<nomor>?text=…"
    target=_blank>` yang href-nya diperbarui setiap Order diubah; tanpa item atau dengan angka salah `aria-disabled` dan ketukannya
    dicegah. Ketukan yang sah: **entri antrean ditulis lebih dulu** (formId null, judul "Pesanan · Sumber Segar") lalu `catatPesanan`
    dikirim lewat `jagaProses`, sehingga pesanan tetap tercatat walau halaman dihentikan HP atau keluar otomatis berjalan selama
    WhatsApp terbuka; berhasil → entri dihapus, Order item itu kembali kosong, kartu digambar ulang dari `belanja`; galat sambungan →
    tetap di antrean; ditolak server → entri dihapus dan pesannya tampil. Isi yang sama memakai `submissionId` yang sama selama
    pesanan itu belum tercatat (ketukan ganda satu pesanan; butir 338). Order tetap hanya di memori; PDF menerima Order semua item (`orderCetak`), server memakai nilai awal yang
    sama untuk menghitung "diubah". Server lama (tanpa `pemasok`): tampilan per kategori seperti dulu.
334. **Form Stock** (`gambarPesanan`, `isiDariPesanan`, `tutupPesanan` di `layarStock`): kartu "Pesanan menunggu" hanya untuk hari
    ini dan hanya jika server mengirim `pesanan` (data dari HP untuk tanggal lain tidak membawa pesanan). "Isi dari pesanan" ditolak
    jika draft berisi Tambah masuk dan pemasok draft berbeda (kosong = berbeda); item yang sudah diisi, sudah ada di kiriman Stock yang
    menunggu kirim dengan tautan ke pesanan itu, tidak ada di form, atau satuannya berubah (satuan order bukan satuan besar item
    sekarang dan satuan dasar berbeda) dilewati dan disebut. Isian mendapat `pesanan` (id), yang dilepas saat Tambah masuk
    ditinggalkan kosong (butir 338). Pengelola punya "Tutup pesanan" di kartu yang sama (butir 338). **Pemasok kembali kosong**
    sesudah kiriman (juga ke antrean) jika tidak ada lagi Tambah masuk di draft, supaya pemasok dari pesanan tadi tidak menempel pada
    barang berikutnya (telaah rancangan). Pesan sesudah kiriman: "Pesanan Tomat dari Sumber Segar tercatat datang." (juga untuk
    antrean).
335. **Nama, hapus, PDF, email:** ganti nama item atau pemasok menulis ulang `Data_Pesanan` (`gantiNamaPesanan_`, seperti
    `M_HargaItem`), bukan memblokir ganti nama; hapus item menutup pesanannya yang menunggu. PDF daftar belanja per pemasok (baris
    judul kelompok dengan kontak, kolom Kategori, "dipesan 5 kg, 21 Okt" kecil di bawah nama); kalimat lama "hanya untuk cetakan" dan
    "Aplikasi tidak memesan apa pun" diganti. Email harian: "Pesanan belum datang (n)" di bagian Stock (lihat juga butir 338).
336. **Telaah rancangan** (tiga penelaah sebelum kode ditulis: data, alur dapur di HP, kompatibilitas): temuan yang mengubah rancangan:
    Diganti per pemasok menghapus pesanan yang masih di jalan (→ per item); Order terisi saran untuk item yang sudah dipesan (→ kosong);
    pesanan yang barangnya dicatat tanpa pemasok tetap menunggu dan "Isi dari pesanan" membuat stock palsu (→ kiriman tanpa pemasok
    menyelesaikan, tautan ditolak jika sudah datang); pemasok draft menempel (→ kembali kosong); catatPesanan "tanpa menunggu" hilang
    saat halaman dihentikan (→ antrean lebih dulu, pesanan terlambat dicek ke barang masuk); kelompok "Belum ada pemasok" berisi hampir
    semua item dengan Order terisi (→ kosong); ganti nama dan hapus item yang pernah dipesan terkunci (→ ditulis ulang); server lama
    dan cache 0.28 (→ tampilan lama); teks "dikirim"/"dipesan" (→ "Dipesan Budi lewat WhatsApp" dengan umurnya di kartu Pesanan
    belum datang, kartu Pesanan menunggu di form Stock, dan email; tanda baris item dan PDF tetap ringkas "Dipesan 5 kg").
    Tidak diubah: WhatsApp dari PWA di Layar Utama memakai `https://wa.me` (tautan resmi WhatsApp); perilakunya di iPhone dan Android
    yang dipasang belum bisa diuji di sini.
337. **Uji** (di luar repo): Code.gs asli di atas `supabase/src/sheet.js` dan `layanan.js` dengan data contoh: `uji_pesanan.mjs` 84 uji
    (bentuk daftarBelanja, kelompok, nomor WhatsApp, validasi catatPesanan, Diganti per item, pesanan terlambat, kirimStock
    menyelesaikan dengan dan tanpa pemasok, tautan dua HP dan diganti, tutup, ganti nama item dan pemasok, hapus item, PDF, email, Sheet
    tanpa tab), `uji_pesanan_telaah.mjs` 36 uji untuk butir 338 (antrean bertautan ke pesanan yang ditutup, sudah datang dengan dan
    tanpa baris lain, dengan Hitung sisa, rantai Diganti, waktu di HP lintas HP dan satu HP, jam HP terlalu cepat, barang masuk yang
    sudah dipakai, pesanan lebih baru, nomor HP didahulukan, kalimat email, PDF Order kosong dan aplikasi lama); jawaban aksi lama
    sama dengan Code.gs v0.28 selain PDF daftar belanja; uji Hitung sisa (43) dan Tandai diperiksa sekaligus (30) tetap lulus. Chromium
    dengan API tiruan: `uji_pesanan_ui.mjs` 74 uji (kelompok dan Order awal, isi pesan WhatsApp, antrean saat sinyal putus, Staff
    mengisi dari pesanan, dua HP dengan Backspace, Tutup dari Laporan dan form Stock, server lama, PDF, delapan ukuran) dan
    `uji_pesanan_ui2.mjs` 29 uji (kartu diperbarui sesudah antrean terkirim, memesan lagi sesudah Tutup, Tutup pesanan yang sudah
    datang, Tutup dari form Stock mengosongkan isian, penolakan menyebut item, antrean bertautan tidak macet, nama tombol unik, klik
    tengah, nama pemasok 40 huruf di 320 px); uji form Stock (87), Tandai diperiksa (27 + 30), dan lebar tabel Stock tetap lulus.
    Belum diuji: Supabase asli, salinan `Data_Pesanan` ke Sheets, dan WhatsApp dari PWA yang dipasang di HP.
338. **Perbaikan sesudah telaah berlawanan** (empat penelaah: server, aplikasi, teks, dokumen; satu temuan diperiksa ulang oleh
    pemeriksa, sisanya oleh Claude dengan skrip pengulangnya karena pemeriksa terhenti di batas pemakaian). (a) **Antrean tidak
    macet** (ditemukan keempat penelaah): kirimStock dulu menolak seluruh kiriman yang bertautan ke pesanan yang sudah Datang, Ditutup,
    atau Diganti, padahal kiriman di antrean HP tidak bisa diubah ("Kirim ulang" mengirim isi yang sama), jadi barang masuk dan baris
    lain kategori itu hilang, seperti butir 327a. Kini `barisPesananTertaut_` tidak pernah menolak (butir 331); untuk Ditutup dan
    Diganti saran lama "Kosongkan Tambah masuk … jika barangnya sama" malah membuang barang yang belum pernah dicatat. (b) **Backspace
    melepas tautan:** `ubah('masuk', '')` melepas tautan pada setiap ketikan, jadi membetulkan 5 → 4 dengan menghapus lalu mengetik
    membuat barang yang sama tercatat dua kali dari dua HP; kini tautan dilepas pada `change` (kolom ditinggalkan kosong). (c) **Waktu
    di HP:** pesanan dan barang masuk dari antrean bisa sampai jauh sesudah dibuat, jadi `selesaikanPesanan_` hanya memakai pesanan
    yang diketuk sebelum barang itu dicatat di HP, dan `aksiCatatPesanan_` membandingkan waktu barang masuk di HP (bukan waktu
    diterima server) dengan waktu ketukan; `waktuHp_` = `timestamp_device` tetapi tidak sesudah `timestamp_server` (jam HP yang
    terlalu cepat). `bacaPesanan_` dan `bacaPembelian_` ditambah `tw` (dan `kiriman`). (d) **Barang masuk yang sudah dipakai:**
    barang masuk yang sudah menjadi Kiriman Stock pesanan Datang lain tidak membuat pesanan terlambat Datang. (e) **Pesanan lebih
    baru:** pesanan dari antrean tidak lagi mengganti pesanan menunggu yang diketuk sesudahnya; itemnya langsung Diganti dan jawaban
    `lebihBaru` menyebutnya. (f) **Id pesanan dipakai ulang:** `sidPesanan` disimpan selama satu kunjungan layar, jadi memesan isi
    yang sama lagi (sesudah Tutup atau diganti) dijawab `sudahTerkirim` tanpa menulis tetapi kartu menulis "dicatat"; kini id dibuang
    sesudah tercatat, dan `sudahTerkirim` ditulis "Pesanan ke … ini sudah tercatat.". (g) **Kartu basi sesudah antrean:** layar
    Laporan tidak punya `segarkanLayar`, jadi pesanan yang terkirim dari antrean tidak muncul (mengundang pesanan kedua); kini kartu
    Daftar belanja memasang `segarkanLayar` (juga saat aplikasi dibuka lagi), menggambar ulang hanya jika isinya berubah, dan Order
    pesanan yang sudah keluar dari antrean kembali kosong. (h) **Tutup yang tidak menutup:** `ditutup: 0` kini ditulis "sudah tidak
    menunggu: barangnya sudah dicatat datang, atau pesanannya sudah ditutup." (Laporan dan form Stock). (i) **Tutup di form Stock**
    mengosongkan Tambah masuk (dan harga beli, baik sampai) yang diisi dari pesanan itu, pemasok kembali kosong jika tidak ada masuk
    lain, dan konfirmasi serta pesan singkatnya menyebutnya. (j) **Penolakan Isi dari pesanan** menyebut item penghalang dan
    kategorinya, lalu pindah ke Semua kategori dengan pencarian kosong (di satu kategori, Kirim stock tidak mengirim item kategori lain).
    (k) **PDF:** Order kosong dari kelompok "Belum ada pemasok" atau item yang sudah dipesan dicetak "–" dengan sebab dan saran kecil di
    bawahnya; catatan lama "tidak diberi saran (–)" membuat "–" dibaca sebagai tanpa stok maksimum. Item yang tidak dikirim (aplikasi
    0.28) tetap dicetak saran. (l) **Email:** kalimat "Tidak ada Stock Akhir minus …" tetap ada walau hanya ada pesanan yang belum
    datang. (m) **Nomor WhatsApp:** nomor HP didahulukan (telepon kantor yang ditulis lebih dulu dulu dipakai). (n) **Teks:** catatan
    kartu kini "Ketukan Kirim ke WhatsApp mencatat pesanan ke pemasok itu; jika pesannya tidak jadi dikirim, ketuk Tutup pesanan."
    (dulu "Yang dicatat hanya pesanan yang dikirim lewat WhatsApp"), klik tengah ikut mencatat, keterangan "Belum ada pemasok"
    menyebut pemasok aktif, nama tombol Isi dari pesanan dan Tutup pesanan untuk pembaca layar memuat tanggal dan item (dua pesanan
    pemasok yang sama dulu bernama sama; label yang terlihat kini di awal nama), fokus sesudah kartu digambar ulang ke pesan kartu,
    nama pemasok satu kata panjang boleh dipatah (`overflow-wrap: anywhere`), dan spesifikasi sistem 5.5, 9.2, kepala (Bagian 12),
    serta tampilan 5.3, 5.9, dan 7 disamakan dengan kode. Versi tetap Code.gs v0.29 dan aplikasi 0.29.0 (belum dirilis).

### Hari libur (Code.gs v0.30, aplikasi 0.30.0, 22 Oktober 2026)

339. **Asal dan keputusan pemilik:** butir 5 dari telaah aplikasi (19 Oktober 2026). Sebelumnya hari dapur tutup tercatat sebagai
    belum lengkap di Beranda, email, Dashboard, dan rekap, kecuali tiap form ditandai "Tidak ada hari ini" dan penjualan diisi 0.
    Pemilik memilih: Pengelola menandai, juga untuk tanggal ke depan (Lebaran) dan tanggal lewat, dan bisa membatalkan; tidak ada hari
    tutup tetap per minggu; tidak ada pengecekan suhu yang ditagih atau terlewat; email harian dan pengingat cek suhu tidak dikirim.
    Dari itu: tidak ada form yang ditagih dan penjualan tidak perlu dicatat. Spesifikasi sistem Bagian 3, 5.1, 5.8, 5.9, 6.1, 7.1, 8.2,
    8.5, 9.1, 9.3, 10, 10.1, 12, 13; tampilan Bagian 5.2, 5.3, 5.6, 5.7, 5.10, 5.11, 7, 11. Tidak dibangun: rentang tanggal sekaligus,
    hari tutup mingguan, tanda hari libur di Riwayat, jenis Perlu perhatian baru, perubahan jadwal opname dan masa simpan.
340. **Data:** tab master `M_HariLibur` (Tanggal (tanggal), Keterangan, Dicatat Oleh, Dicatat Pada; `TAB_MASTER`, `KUNCI_MASTER` kunci
    Tanggal), dibuat `setupSpreadsheet`. Master dipilih (bukan tab Data atau baris `M_Konfigurasi`) karena tab berawalan `M_` selalu
    dimuat di Supabase (jadwal ringan `muat: 'master'` membacanya tanpa percobaan ulang), tidak diarsip (tanggal ke depan aman), ikut
    salinan ke Sheets (rumus Kepatuhan cukup `COUNTIF`), ikut cadangan, dan menyimpan siapa/kapan. Satu baris per tanggal; menghapus =
    `deleteRow` semua baris bertanggal itu + satu baris `Log_Perubahan` (`(dihapus)`), pengecualian ketiga "master tidak dihapus".
    Pembaca `bacaLibur_` (memo `MEMO_LIBUR_`, dibuang `resetMemoForm_` dan setiap tanda ditulis): tanggal dibaca `teksTanggal_` dengan
    `zonaSheet_`, teks yang bukan tanggal dilewati, baris ganda yang lebih atas dipakai; tab belum ada = tanpa hari libur (jalur baca
    memakai `bacaTabel_`, bukan `ambilTab_`). `liburPada_(tanggal)` dan `liburUntukJawaban_` dipakai semua tempat.
341. **Aksi** (khusus Pengelola, pesan per aksi untuk Staff): `daftarLibur`, `simpanLibur` (`periksaTanggalLibur_`: tanggal sah, paling
    jauh `BATAS_LIBUR_DEPAN_HARI` 366, `periksaBelumDiarsip_`; keterangan `teksMaster_` 40 huruf; ditulis `tambahBarisMaster_` dengan
    `tanggalSel_`; tanggal yang sudah libur: keterangan diganti dengan `Log_Perubahan`, sama persis: tidak menulis), `hapusLibur`
    (tanggal sah dan belum diarsip; tanpa batas depan supaya tanggal yang diketik tangan tetap bisa dihapus; yang sudah bukan libur:
    `dihapus: null`, bukan galat, untuk dua HP). Ketiganya butuh sinyal dan tanpa `submissionId` (simpan bersifat idempoten). Lewat
    `denganKunci_`, jadi simpanan Beranda 2 menit di Apps Script langsung terbuang. `disimpan.isian` = nama form yang sudah berisian
    pada tanggal itu (`kelengkapanForm_`, hanya untuk tanggal sampai hari ini), supaya tanggal yang salah pilih langsung ketahuan.
    `dataLibur_` tidak mengirim tanggal sebelum `arsip_sampai` (tidak bisa dihapus lagi).
342. **Penagihan:** `wajibPada_` = `!liburPada_(tanggal) && wajibMenurutJadwal_(f, tanggal)` (aturan jadwal lama). Dengan itu Beranda,
    Dashboard (`formWajib` 0, butir `formBelum` hilang), email, `formKustom.wajib`, dan Kepatuhan rekap ikut. Status form tetap dari
    isian (Terkirim, Nihil, sebagian); isian, tanda nihil, dan notifikasi suhu di luar standar pada hari libur diterima seperti biasa
    dan tetap dihitung belum diperiksa. Suhu terlewat dilewati pada hari libur di `suhuTerlewat_` (Riwayat) dan `dataRekapBulan_`.
    `beranda.liburBesok` (semua role): Pengelola melihat "Besok hari libur", dan HP tanpa sinyal esok hari memakainya.
343. **Laporan harian** (`jalankanLaporanHarian_`, tanggal laporan, jadi laporan yang berjalan lewat tengah malam memeriksa kemarin):
    hari libur dan bukan uji → PDF form berstatus terkirim/sebagian tetap disimpan ke Drive (keputusan tambahan dari telaah: tanpa
    itu isian hari libur tidak pernah masuk Drive atau email mana pun), email tidak dikirim, `laporan_terakhir` = "Dilewati <waktu> untuk
    <tanggal>: hari libur (ket); n PDF disimpan ke Drive." kecuali nilainya diawali "Gagal" (kegagalan hari kerja tetap terlihat).
    `kirimLaporanSekarang` (uji) tetap mengirim, dengan "Hari libur: …" di kepala email dan "Tidak ada isian (hari libur)"
    (`teksStatusForm_(f, libur)`). Keterangan `laporan_terakhir` kini konstanta bersama `KETERANGAN_LAPORAN_TERAKHIR` (teksnya
    berubah sekali pada laporan pertama sesudah pasang). `laporanTerlambat_` menerima awalan "Dilewati" tanpa melangkah mundur melewati
    hari libur: jadwal yang berjalan selalu menulis "Dilewati", jadi hari libur tanpa catatan itu berarti jadwalnya berhenti; peringatannya
    "jadwal laporan tidak berjalan pada … (hari libur, catatan Dilewati tidak ada)". Rekap bulanan tanggal 1 tetap dikirim.
344. **Pengingat:** `pengingatSuhu_` berhenti pada hari libur (`hariIni_`) sebelum `Data_Suhu` dibaca (di jadwal ringan Supabase tab itu
    tidak sempat diminta). Pengingat stock, notifikasi suhu di luar standar, reset PIN, dan akun terkunci tetap dikirim.
345. **Penjualan dan porsi:** `penjualanRentang_` melewati hari libur tanpa catatan (dianggap Rp 0, tidak masuk `jumlahHari` dan
    `kurang`, disebut di `libur`), jadi `hari + kurang.length = jumlahHari` tetap dan food cost dihitung jika hari lain lengkap; catatan
    yang tetap ada pada hari libur dihitung. `porsiKurang_`: hari libur tanpa catatan penjualan tidak perlu porsi (hari libur dengan
    penjualan > 0 tetap perlu; aturan lama Rp 0 = tutup tetap). Pemakaian bahan hari libur tetap dihitung (cek silang tetap cocok).
    Pengingat penjualan Dashboard dan kartu HPP ikut dengan sendirinya. Galat penjualan kosong: "Isi penjualan. Isi 0 jika tidak ada
    penjualan." Bulan yang semua harinya libur: food cost "–" dengan alasannya (PDF, email, kartu Penjualan).
346. **Rekap bulanan:** `hasil.kepatuhan.libur` dan `hasil.suhu.libur` (tanggal), `kepatuhan.form[].liburDitagih` (hari yang ditagih menurut
    jadwal tetapi libur). Hari yang dinilai tetap hari kalender: "(31 hari, termasuk 2 hari libur: 23 dan 24)" atau ", semuanya hari libur";
    form yang tidak ditagih karena libur "Hari libur, tidak ditagih"; catatan Suhu dan Kepatuhan; daftar lebih dari 8 tanggal "antara lain
    …" (`teksHariBulanSingkat_`); HPP "n dari m hari tercatat, k hari libur" dan catatan; email "(2 hari libur)". Tanpa hari libur di bulan
    itu PDF dan email sama persis dengan v0.29. Rekap yang sudah terkirim tidak berubah; yang diunduh sesudah tanda diubah mengikutinya.
347. **Rumus tab Dashboard** (`pasangBlokKepatuhanDashboard_`, berlaku sesudah `setupSpreadsheet` di Apps Script): `hlT` = kolom Tanggal
    `M_HariLibur`, `lb,COUNTIF(hlT,d)>0` di LET per hari; kolom B–E dan I lewat `lib()` (dibuat di JS, tanpa LAMBDA bersarang): belum
    diisi/"Tidak ada unit"/"0 dari …" → "Libur", sebagian → "Libur (3 dari 9)" (sama dengan Beranda); F = 0 pada hari libur; G dan H tetap.
    Ringkasan menyebut "(termasuk n hari libur)" dari `SUMPRODUCT((A<>"")*(COUNTIF(hlT,A)>0))` (tanggal ganda tetap satu hari). Format
    bersyarat memakai `LEFT(…,5)<>"Libur"`. Nama LET baru `hlT`, `lb`, `hl` (butir 120b). Hasil di Google Sheets belum bisa diuji di sini.
348. **`setupSpreadsheet` sesudah pindah memeriksa versi:** Supabase menjawab `VERSI_KODE`; jika berbeda dengan Code.gs di Apps Script
    (Edge Function belum di-Deploy), berhenti dengan pesan sebelum Sheet diubah, supaya Sheet tidak punya tab yang tidak ada di
    Supabase (dari telaah kompatibilitas). Urutan pemasangan yang aman ditulis di PANDUAN ("Versi baru").
349. **Perbaikan runtime Supabase:** tiruan `Utilities.formatDate` (`supabase/src/layanan.js`) tidak mengenal pola `'H'`, sehingga
    `kirimLaporanHarian` di Supabase selalu memakai tanggal hari itu walau berjalan sebelum 06.00 (laporan yang dijadwalkan lewat tengah
    malam ditulis untuk hari yang salah). Ditemukan oleh uji hari libur; kini `'H'` = jam tanpa nol di depan.
350. **Aplikasi (0.30.0):** rute `#/pengaturan/libur(/yyyy-mm-dd)` (`layarHariLibur`, pola Unit; tanggal di alamat membuka lembar Tambah
    atau ubah untuk tanggal itu, dipakai tautan "Tandai 21 Okt sebagai hari libur" di Catat penjualan), baris "Hari libur" di
    Pengaturan, ikon `kalender`. Lembar Tambah tanpa pilihan awal ("Hari ini, 23 Okt" / "Besok, 24 Okt" / "Tanggal lain", hari ini
    dan batas menurut server), kalimat akibat bertanggal, peringatan jika hari ini sudah berisian (Beranda tersimpan), dan sesudah
    menyimpan Tambah berikutnya memilih hari sesudahnya dengan keterangan yang sama. Kata "Hapus" (bukan "Batalkan") supaya tidak
    berdampingan dengan tombol "Batal" konfirmasi. Beranda: kemajuan "Hari libur: …" dengan ikon kalender tanpa rel dan tanpa momen
    selesai, tiket "Hari libur", pemberitahuan Pengelola hari ini/besok di bawah reset PIN dan akun terkunci; data tersimpan dari
    tanggal lain menghitung `wajib` dari jadwal (`wajibMenurutJadwal`, juga `dataKustomDariHp`) dan memakai `liburBesok` kemarin;
    `aturLiburDiBeranda` memperbarui Beranda tersimpan sesudah simpan/hapus. Dashboard ubin "Libur". Server lama: kalimat "Server belum
    diperbarui…" di layar Hari libur; field baru dianggap null. Keterangan panjang satu kata: `.ket-pecah` dan `.kemajuan-teks.libur`.
351. **Uji** (di luar repo, `scratchpad/uji`): Code.gs asli di atas `supabase/src/sheet.js` dan `layanan.js`: `uji_libur.mjs` 100 uji (tanpa tab
    lalu `setupSpreadsheet` dua kali, validasi, simpan/ubah/hapus dan `Log_Perubahan`, baris ganda dan teks diketik tangan, Beranda
    Pengelola dan Staff, `liburBesok`, simpanan Beranda, Dashboard, kemarin libur tanpa butir penjualan, HPP dan porsi, form kustom, isian
    dan tanda nihil pada hari libur, laporan dilewati dengan PDF ke Drive, Gagal tidak ditimpa, laporan 01.00 untuk kemarin, uji dari editor,
    `laporanTerlambat_` (jadwal berhenti tetap diperingatkan), pengingat suhu dan stock, notifikasi suhu di luar standar, Riwayat Suhu,
    arsip, rekap PDF dan email, form hari tertentu, daftar panjang); `uji_libur_rumus.mjs` (rumus seimbang, nama LET tanpa bentrok, gaya
    titik koma); `uji_libur_banding.mjs` (11 aksi dan email harian/rekap tanpa hari libur sama dengan v0.29 selain field baru; urutan cek
    suhu yang dikirim pada milidetik yang sama juga berbeda antara dua jalan v0.29). Chromium `uji_libur_ui.mjs` 82 uji (Pengaturan, lembar
    Tambah dan ubah, hapus, Beranda Pengelola dan Staff, Dashboard, form kustom, tanpa sinyal dari simpanan kemarin, Catat penjualan dan
    tautan Tandai, server lama, tanpa sinyal di layar Hari libur, delapan ukuran dengan keterangan 40 huruf satu kata); uji lama (pesanan
    84 + 36 + 74 + 29, Hitung sisa 43, form Stock 87, Tandai diperiksa 30 + 27 + 30) tetap lulus. Belum diuji: Supabase dan Google asli
    (rumus Kepatuhan di Sheets, pg_cron yang melewati laporan), dan HP asli.
352. **Telaah:** rancangan ditelaah tiga penelaah (alur dapur, kompatibilitas, server) dan temuannya sudah masuk butir 339–350.
    Telaah berlawanan atas kode yang sudah jadi terhenti di batas pemakaian sebelum melapor, jadi diganti telaah ulang oleh Claude atas
    diff Code.gs (simpan/ubah/hapus dan baris ganda, laporan harian, rumus Kepatuhan) dan layar Hari libur; tidak ada temuan baru.

### Pengingat sebelum closing (Code.gs v0.31, aplikasi 0.31.0, 28 Oktober 2026)

353. **Asal:** telaah aplikasi 19 Oktober, bagian "Pelengkap", dipilih pemilik sesudah Hari libur. Spesifikasi sistem Bagian 10.1;
    tampilan Bagian 5.7 dan 5.11. Tidak ada tab, kolom, atau aksi baru.
354. **Pengaturan (keputusan tambahan):** disimpan sebagai menit sebelum jam closing (`pengingat_closing_menit`, pilihan 0/15/30/60),
    bukan jam sendiri seperti pengingat stock, supaya jamnya ikut bergeser saat jam closing diubah. Baris yang belum ada = 30 (menyala
    sejak pasang, seperti pengingat cek suhu); kosong atau 0 = mati; nilai lain yang tidak terbaca = 30. Jam = jam closing − menit,
    boleh mundur lewat tengah malam (`jamPengingatClosing_`, `jamSebelumClosing` di app.js). `pasangTrigger` memasang trigger harian
    `pengingatClosing` hanya `DI_SUPABASE_`; mengubah menitnya di Outlet dan jadwal memasang ulang jadwal di Supabase (jalur
    `pengingatBerubah`), mengubah jam closing juga (jalur `jadwalBerubah`).
355. **Isi** (`isiPengingatClosing_`): form `kelengkapanForm_` yang `wajib` dan berstatus belum atau sebagian; judul "Closing 21.30: n form
    belum diisi" (atau "belum lengkap" jika ada yang sebagian), isi "Belum diisi: …. Belum lengkap: Suhu (3 dari 9 pengecekan)." dan
    "Jika memang tidak ada, ketuk Tidak ada hari ini di formnya." (hanya jika ada form selain Suhu yang belum diisi; Suhu tidak punya
    tanda nihil). Ketuk membuka Beranda. TTL 3 jam, urgensi biasa. Sasaran `semua` (yang mengisi form adalah Staff). **Suhu**
    (`suhuPerluDiingatkan_`, keputusan tambahan): tanpa unit aktif tidak disebut (Suhu tidak pernah lengkap, butir 25); selama
    pengingat cek suhu Closing menyala hanya disebut jika Opening atau Middle belum lengkap untuk semua unit aktif, karena dengan nilai
    awal keduanya berbunyi pukul 21.00 dan Closing sudah dikabarkan pengingat itu. Tidak dikirim jika tidak ada yang kurang, pada hari
    libur, atau tanpa kunci notifikasi. Pengingat yang berjalan sebelum 06.00 memakai tanggal kemarin dan isinya diawali "Untuk Selasa,
    27 Oktober 2026." (Beranda sudah menampilkan hari baru). Aturan 06.00 dinilai pada jam pengingat, sedangkan laporan harian
    menilainya pada jam closing + jeda; keduanya hanya berbeda untuk jam closing sekitar 05.00–06.30. Di server.js masuk
    `FUNGSI_JADWAL` dan `JADWAL_RINGAN`.
356. **Aplikasi:** kartu "Pengingat sebelum closing" di Outlet dan jadwal, di antara Pengingat cek suhu dan Pengingat stock: `grupPilihan`
    "Kirim sebelum jam closing" (Mati, 15, 30, 60 menit) dan "Dikirim sekitar pukul 21.00." yang ikut berubah saat jam closing diketik;
    hanya jika server mengirim `pengingatClosingMenit` (server lama: tidak tampil dan tidak dikirim). Lembar Notifikasi (semua role):
    "Pengingat sebelum closing (21.00), jika masih ada form yang belum lengkap, kecuali hari libur" atau "(sedang dimatikan)".
357. **Uji** (di luar repo): Code.gs asli di atas `supabase/src/sheet.js` dan `layanan.js`: `uji_closing.mjs` 39 uji (nilai awal, isi dan
    penerima Staff dan Pengelola, Suhu disebut saat Middle belum lengkap, tidak saat hanya Closing, ikut saat pengingat suhu Closing
    mati, tanpa unit aktif, tanpa ajakan Tidak ada hari ini untuk Suhu, semua lengkap, hanya sebagian, hari libur, 00.15 memakai
    kemarin dan menyebut tanggalnya, `pasangTrigger` 21:00, simpan 60 → 20:30, jam closing 00:10 → 23:10, mati tanpa jadwal, 45 dan Staff ditolak, nilai tidak
    terbaca dan kosong, tanpa kunci notifikasi). Chromium `uji_closing_ui.mjs` 24 uji (kartu dan jam yang ikut jam closing, simpan 60
    dan Mati, server lama, lembar Notifikasi Staff dan Pengelola, delapan ukuran). Belum diuji di Supabase asli (pg_cron) dan HP asli.
358. **Telaah berlawanan** (satu penelaah atas server dan aplikasi): tidak ada bug besar. Diperbaiki: Suhu yang Opening atau Middle-nya
    terlewat tidak disebut kedua pengingat (dulu Suhu selalu dibuang selama pengingat cek suhu Closing menyala); outlet tanpa unit aktif
    mendapat "Belum diisi: Suhu" tiap hari; ajakan "Tidak ada hari ini" juga untuk Suhu; pengingat sesudah tengah malam tanpa
    tanggal. Tidak diubah: aturan 06.00 yang dinilai pada jam pengingat (butir 355) dan nilai awal 30 yang tampil di Outlet dan
    jadwal sebelum `pasangTrigger` dijalankan (sama dengan pengingat stock; langkah pemilik menyebut pasangTrigger).

### Staff membetulkan isiannya sendiri (Code.gs v0.32, aplikasi 0.32.0, 28 Oktober 2026)

359. **Asal dan keputusan pemilik:** telaah aplikasi 19 Oktober, bagian "Pelengkap". Pemilik memilih saran Claude: batas 15 menit
    sesudah dikirim dan selama belum diperiksa, kolom yang sama dengan koreksi Pengelola, hanya pengisinya sendiri. Aturan "Staff
    tidak bisa mengubah data setelah submit" (sistem Bagian 3, 6.2, 6.3, 7.1) kini punya pengecualian ini. Spesifikasi tampilan
    Bagian 5.4 dan 7. Tidak ada tab, kolom, atau aksi baru.
360. **Server:** `koreksi` tanpa `pengelola: true`; `aksiKoreksi_` memanggil `periksaBetulkanSendiri_` untuk non-Pengelola sesudah
    pemeriksaan Diperiksa (pesan Staff tanpa "Buka kunci"). Pengisi = `submitted_by` baris itu (huruf besar/kecil tidak dibedakan),
    batas = `timestamp_server` + `BATAS_BETULKAN_MENIT` (15), jadi kiriman dari antrean dihitung sejak sampai di server. Sisanya
    jalur koreksi yang sama: `turunan`, `periksaKoreksi`, `setelahKoreksi`, `Log_Perubahan` atas nama Staff, `updated_by`; tanda
    dilaporkan keliru hanya dibersihkan jika yang mengoreksi Pengelola (butir 363). `susunKiriman_` menambah `betulkanSampai` (`batasBetulkan_`, memakai `PENGGUNA_AKSI_`) untuk
    pengisinya selama batas belum lewat dan kiriman belum Diperiksa, sehingga ikut di `riwayat`, `detailKiriman`, dan jawaban aksi
    Riwayat lain; Pengelola tidak mendapatnya (Koreksi tanpa batas waktu).
361. **Aplikasi:** `bisaDibetulkan(k)` (status, batas dibanding jam HP; server memeriksa lagi). `tandaKiriman` menambah tanda Menunggu
    "Bisa dibetulkan sampai 21.45" (daftar dan detail). `gambarDetailKiriman`: petunjuk "Salah ketik? …" di kotak info dan tombol
    "Betulkan" per baris (Staff) menggantikan "Koreksi" (Pengelola); `bukaKoreksi(info, b, selesai, betulkan)` berjudul "Betulkan …",
    tombol "Simpan", pesan "Isian dibetulkan.". Tombol tidak hilang sendiri saat batas lewat selagi layar terbuka; penolakan server
    tampil di lembar.
362. **Uji** (di luar repo): Code.gs asli di atas `supabase/src/sheet.js` dan `layanan.js`: `uji_betulkan.mjs` 29 uji (betulkanSampai
    hanya untuk pengisi, bukan Staff lain atau Pengelola, detailKiriman; Stock keluar 10 → 1 dan stock dihitung ulang, Log_Perubahan
    atas nama Rina; Staff lain dan isian Pengelola ditolak; sesudah 16 menit ditolak, Pengelola tetap bisa; sudah diperiksa ditolak
    dengan pesan Staff; Waste tanpa rupiah di jawaban dan estimasi di Sheet dihitung ulang; Suhu di luar standar tanpa tindakan
    ditolak; antrean dihitung sejak diterima; form kustom). Chromium `uji_betulkan_ui.mjs` 21 uji (tanda di daftar, petunjuk, tombol,
    lembar, kiriman, pesan, Dikoreksi Rina; Andi tanpa Betulkan, Budi Koreksi; lewat batas tanpa tombol; batas lewat saat lembar
    terbuka; Tandai diperiksa dari layar lama; desktop; delapan ukuran; kini 24). Uji server kini 43 (butir 363). Uji lama (Tandai diperiksa, Hitung sisa, pesanan, Hari libur, pengingat closing) tetap lulus.
    Belum diuji di Supabase asli dan HP asli.
363. **Telaah berlawanan** (satu penelaah; dua temuan diulang dengan skrip): (a) Staff yang membetulkan baris yang dilaporkan rekan
    menghapus laporan itu tanpa jejak (`laporkanKeliru` tidak menulis `Log_Perubahan`), sehingga Pengelola tidak pernah melihatnya;
    kini hanya koreksi Pengelola yang membersihkan tanda dilaporkan keliru. (b) Staff bisa membatalkan koreksi Pengelola di dalam 15
    menit; kini baris yang `updated_by`-nya orang lain ditolak ("Baris ini sudah dikoreksi Budi, …") dan tombol Betulkan tidak tampil
    di baris itu. (c) Tandai diperiksa (satu per satu dan sekaligus) bisa menandai angka yang dibetulkan Staff sesudah layar Pengelola
    dimuat; kini aplikasi mengirim `terlihat` (koreksi terbaru yang tampil, `koreksiTerlihat`), dan server (`berubahSesudahDilihat_`,
    toleransi 1 detik untuk milidetik yang hilang di Sheets) menolak dengan "Isian ini baru saja dibetulkan, …" atau melewatinya
    ("n isian dilewati karena baru dibetulkan."); aplikasi lama tanpa `terlihat` tetap seperti dulu. (d) Suhu yang dikoreksi atau
    dibetulkan menjadi di luar standar kini mengirim notifikasi ke HP Pengelola seperti isian baru ("… Dikoreksi Rina."). Tidak diubah:
    pesanan yang sudah Datang tetap Datang jika Tambah masuk-nya dibetulkan menjadi 0 (sama dengan koreksi Pengelola, butir 331), dan
    jam HP yang meleset (server memeriksa lagi).

### Ubah banyak item sekaligus (Code.gs v0.33, aplikasi 0.33.0, 28 Oktober 2026)

364. **Asal:** telaah aplikasi 19 Oktober, bagian "Pembelian dan data master": sejak pindah ke Supabase, Sheet hanya salinan, jadi item
    dan harga hanya bisa diubah satu per satu dari aplikasi. Pemilik memilih butir ini tanpa pilihan tambahan, jadi dipilih yang paling
    sederhana (keputusan tambahan): kategori dan satuan tidak dibuat otomatis, tempelan hanya untuk item baru (tidak mengubah item
    yang ada), tanpa stok awal di tempelan (stok pembuka tetap lewat layar item, karena HPP membedakan alasan Stok pembuka), dan hanya
    item aktif di Ganti harga. Spesifikasi sistem Bagian 5.1; tampilan Bagian 5.7. Tidak ada tab atau kolom baru.
365. **Server:** inti `aksiGantiHarga_` dipindah ke `tulisHargaBaru_(m, mulai, harga, pengguna, kini)` (baris harga awal, menimpa tanggal
    yang sama dengan `Log_Perubahan`, `samakanHargaMItem_`; `{ sama: true }` tanpa menulis), dipakai `gantiHarga` (yang tetap menolak harga
    sama pada tanggal yang sama) dan `aksiGantiHargaBanyak_`. Bulk: tanggal sama aturannya, semua baris diperiksa sebelum kunci (angka) dan
    di dalam kunci (item ada, tidak ganda); item tanpa harga dan tanpa riwayat mendapat harga pertama sejak awal (`pertama`); harga yang
    sama dengan `hargaPada_` tanggal itu dilewati (`sama`). `aksiTambahItemBanyak_`: aturan item baru `simpanItem` per baris di dalam satu
    kunci (`periksaNama_`, `pilihTempelan_` untuk kategori/satuan/satuan besar yang menyebut tulisan tempelan, `angkaOpsional_`,
    `masaSimpanIsian_`), galat diberi awalan "Baris n (nama): ", lalu semua baris ditulis (`tambahBarisMaster_`, harga pertama
    `tambahBarisHarga_`). `BATAS_UBAH_BANYAK` 300.
366. **Aplikasi:** `layarItemHargaBanyak` dan `layarItemTempel` (rute `#/pengaturan/item-harga` dan `-tempel`, tautan di daftar item hanya
    jika `ubahBanyakSiap`). Harga dibaca `bacaRupiah` (titik ribuan). Tempelan: `uraiTempelan` (tab, atau titik koma jika tidak ada tab;
    baris pertama yang berisi judul nama memetakan kolom lewat `JUDUL_TEMPEL`, selain itu `URUTAN_TEMPEL`), pemeriksaan per baris di HP
    dengan aturan server, hanya baris yang benar dikirim; sesudah berhasil, baris yang salah dan baris judulnya tetap di kotak. Draft
    `draft:item-harga` dan `draft:item-tempel`. CSS `.harga-banyak-*` dan `.isian-tempel`.
367. **Uji** (di luar repo): Code.gs asli di atas `supabase/src/sheet.js` dan `layanan.js`: `uji_ubah_banyak.mjs` 41 uji (harga baru, sama
    dilewati, harga pertama sejak awal, harga kemarin tetap, menimpa tanggal yang sama dan `Log_Perubahan`, tanggal lewat, item tak dikenal
    dan ganda menolak semuanya, minus, masa depan, kosong, Staff; `gantiHarga` lama tetap; tambah dengan ejaan master, satuan besar, masa
    simpan, form Stock, sepuluh penolakan dengan nomor baris, ganda di tempelan, kategori nonaktif, 301 baris, 120 item sekaligus).
    Chromium `uji_ubah_banyak_ui.mjs` 46 uji (tautan dan server lama, keterangan naik/harga pertama/salah, draft sesudah dimuat ulang,
    fokus ke angka salah, isian tersembunyi karena cari, konfirmasi, tanggal lain, tempelan dengan judul dan baris salah, sisa baris
    salah, tanpa judul, item yang sudah ada, delapan ukuran untuk tiga layar). Belum diuji di Supabase asli dan di HP (menempel dari
    Excel/Sheets di HP asli).
368. **Telaah berlawanan** (satu penelaah atas server dan aplikasi; temuan diulang dengan skrip): (a) **Angka tempelan:**
    spreadsheet menyalin angka seperti yang tampil, jadi stok "1.000" terbaca 1 dan harga "15,000" terbaca Rp 15. Kini
    `angkaTempel` (app.js, dipakai tempelan dan Ganti harga beberapa item): titik dan koma sekaligus = yang terakhir desimal, satu
    jenis berulang atau titik lalu tiga angka = ribuan, koma lalu tepat tiga angka ditolak ("bisa dibaca dua cara"), lainnya
    `bacaAngka`. (b) **Nomor baris:** pesan server memakai urutan kiriman (baris salah tidak ikut dikirim, jadi nomornya berbeda
    dengan pratinjau); kini aplikasi mengirim `no` per baris dan server memakainya. Sesudah server menolak, daftar item dimuat ulang
    supaya pratinjau ikut benar (misalnya item yang sama baru ditambah dari HP lain). (c) **Kecepatan:** `gantiHargaBanyak` menulis
    per item dan membaca ulang `M_HargaItem` dan `M_Item` tiap kali; 300 item dengan riwayat 20 harga butuh 20 detik di tiruan
    (batas CPU Edge Function sekitar 2 detik). Kini riwayat dibaca sekali, perubahan dihitung di memori, baris baru ditulis dalam
    satu rentang (`tambahBanyakBarisMaster_`), log sekaligus, dan Harga Satuan `M_Item` hanya untuk sel yang berubah
    (`samakanHargaMItemBanyak_`): 103 ms; `tambahItemBanyak` juga menulis sekaligus. Isi `M_HargaItem`, `M_Item`, dan
    `Log_Perubahan` sesudah skenario campuran (harga awal untuk item diisi tangan, harga pertama, tanggal lewat, menimpa tanggal
    yang sama oleh orang lain, sama) sama persis dengan versi sebelumnya. (d) **Harga pada tanggal berlaku:** keterangan naik/turun
    dan konfirmasi membandingkan dengan harga hari ini, padahal server membandingkan dengan harga pada tanggal berlaku; kini
    `hargaPadaHp` membaca `riwayatHarga` (10 terakhir; lebih tua dari itu: "Mengganti harga yang berlaku pada …") dan keterangannya
    ikut berubah saat tanggal diganti. (e) Tombol Simpan harga aktif sebelum daftar item dimuat (draft berisi): kini nonaktif. (f)
    Baris judul dikenali dari satu sel saja, jadi item bernama "Item" atau "Barang" di baris pertama hilang; kini butuh judul nama
    dan satu judul kolom lain. (g) Sel berkutip dari spreadsheet (ganti baris di dalam sel, kutip ganda) terpecah; kini
    `pecahTempelan` membacanya, dan baris salah yang memakai beberapa baris teks tetap utuh di kotak. (h) Semua harga sama:
    "Harga 0 item tersimpan" diganti "Tidak ada harga yang berubah. …". Uji: `uji_ubah_banyak.mjs` kini 43, `uji_ubah_banyak_ui.mjs`
    60 (harga pada tanggal lain, koma ribuan, tombol selama dimuat, judul palsu, sel berkutip, angka ribuan dan desimal, nomor baris
    dari server dan pratinjau dimuat ulang, sisa baris salah), `ukur_banyak.mjs` dan `banding_banyak.mjs`; uji fitur 28 Oktober dan
    sebelumnya tetap lulus. Versi tetap Code.gs v0.33 dan aplikasi 0.33.0 (belum dirilis).

### Food cost sementara (Code.gs v0.34, aplikasi 0.34.0, 28 Oktober 2026)

369. **Asal:** telaah aplikasi 19 Oktober, bagian "Pelengkap": food cost tampil "–" selama ada satu hari tanpa catatan
    penjualan, sehingga kepala layar HPP, Dashboard, dan grafik 6 bulan kosong hampir sepanjang bulan. Pemilik memilih butir ini
    tanpa pilihan tambahan. Spesifikasi sistem Bagian 5.9; tampilan Bagian 5.6, 5.10, dan 7. Tidak ada tab, kolom, atau aksi baru.
370. **Hitungan** (keputusan tambahan): hanya hari yang penjualannya sudah tercatat (termasuk hari libur yang tetap dicatat), yaitu
    pemakaian bahan hari-hari itu ÷ penjualannya. Dipilih daripada pemakaian sebulan ÷ penjualan yang tercatat (food cost jauh terlalu
    tinggi selama banyak hari belum dicatat) dan daripada perkiraan penjualan hari yang kosong (menebak angka). `pemakaianBahan_`
    menerima `hariSaja` (rekap dan waste barang jadi di luar hari itu dilewati; cek silang tidak dipakai), `foodCostBulan_` menjawab
    `sementara: { foodCost, pemakaian, penjualan, hari, jumlahHari }` hanya jika `foodCost` null, ada hari yang kurang, dan penjualan
    tercatat > 0. `foodCost` tidak berubah, jadi aplikasi lama tetap seperti dulu. Food cost seharusnya (porsi terjual) tidak diberi
    angka sementara.
371. **Tampilan:** kepala layar HPP "Food cost sementara 1–27 Oktober", angkanya, dan "Dari 11 dari 27 hari yang penjualannya
    tercatat" (tanda "Di atas target" juga untuk angka sementara); kartu Menunggu menjelaskan cara hitungnya; grafik 6 bulan memakai
    angka sementara untuk bulan yang belum lengkap (batang `.sementara`: isi pucat 38% dan garis tepi putus-putus non-scaling,
    angka miring, kalimat "Batang pucat: sementara, penjualan belum lengkap.", uraian pembaca layar "… 20,4% sementara"), dan
    keterangan di bawah grafik kini menyebut angka miring (server lama: kalimat lama). Dashboard: "Oktober 20,4% sementara · target 35%" (`foodCostTampil`,
    bertanda Perlu ditinjau jika di atas target). Rekap bulanan PDF: baris Food cost "20,4% (sementara)" dan catatan cara hitungnya;
    email rekap: "…; sementara 20,4% dari hari yang tercatat (target 35%)". Pemakaian bahan di kepala tetap pemakaian sebulan.
372. **Uji** (di luar repo): `uji_fc_sementara.mjs` 20 uji (sementara dari data contoh = pemakaian ÷ penjualan, grafik, waste pada hari
    tanpa penjualan naik di pemakaian bulan tetapi tidak di sementara, penjualan hari itu dicatat lalu ikut, Dashboard, rekap PDF dan
    email, penjualan lengkap: food cost tetap dan sementara hilang, bulan tanpa penjualan); `uji_fc_sementara_ui.mjs` 29 uji Chromium
    (Dashboard, kepala, kartu Menunggu, grafik dan uraiannya, server lama seperti dulu, delapan ukuran untuk layar HPP dan Dashboard).
    Uji fitur 28 Oktober dan sebelumnya tetap lulus. Belum diuji di Supabase asli dan HP.

### Email harian: barang masuk, penjualan, dan food cost (Code.gs v0.35, 28 Oktober 2026)

373. **Asal:** telaah aplikasi 19 Oktober, bagian "Pelengkap": email harian belum memuat penjualan, food cost, dan barang yang dibeli
    hari itu. Pemilik memilih butir ini tanpa pilihan tambahan. Spesifikasi sistem Bagian 10. Aplikasi tidak berubah (tetap 0.34.0).
374. **Barang masuk** (`ringkasBarangMasukHari_`, dari `bacaPembelian_` tanggal itu, jadi hanya baris dengan Stock Masuk): bagian
    "Barang masuk" sesudah Stock, selalu tampil ("Tidak ada barang masuk tercatat." jika kosong). Per pemasok urut nama, "Tanpa pemasok"
    paling bawah, item urut nama: "Tomat 5 kg × Rp 16.000" (jumlah dalam satuan dasar; harga beli per satuan dasar). Total dari harga
    beli yang dicatat dan "n baris tanpa harga beli"; nilai per pemasok hanya jika lebih dari satu pemasok; tanpa harga beli sama
    sekali: "Harga beli belum dicatat." Bagian lain email tidak berubah.
375. **Penjualan dan food cost** (`ringkasPenjualanHari_`, sebelum "Untuk Head Kitchen dan Manager"): hanya jika `Data_Penjualan`
    pernah berisi (keputusan tambahan: outlet yang tidak memakai HPP tidak mendapat bagian kosong). Penjualan hari itu dan catatannya,
    "belum dicatat. Catat dari Dashboard → HPP dan food cost.", atau pada hari libur (hanya lewat uji dari editor) "tidak perlu
    dicatat"; porsi terjual (menu berporsi 0 tidak disebut, paling banyak 8) jika porsi per menu pernah dicatat; food cost bulan
    itu "sampai 28 Okt": `foodCostBulan_` dengan `ctx.hari` = tanggal laporan + 1, karena email dikirim sesudah closing sehingga
    tanggal laporan ikut dinilai (layar HPP menilai sampai kemarin); angka tetap, sementara "(penjualan baru tercatat 12 dari 28
    hari; target 35%)", atau "belum dihitung". Di atas target: merah tebal. `penjualanUntukEmail_` menangkap galat supaya email
    tetap terkirim (galat dicatat di log), kecuali galat tab belum dimuat Supabase yang harus diteruskan ke runtime.
376. **Uji** (di luar repo): `uji_email_harian.mjs` 27 uji (barang masuk dua pemasok dan tanpa pemasok dengan total dan urutan, baris
    keluar saja tidak ikut, satu pemasok, tanpa harga beli, tanpa barang masuk; penjualan belum dicatat, dicatat dengan porsi,
    tanggal lalu, sementara sampai tanggal laporan, di atas target, penjualan lengkap dengan angka dari `foodCostBulan_`, akhir bulan
    lalu tanpa penjualan, outlet tanpa penjualan tanpa bagian, bagian lama tetap); email dirender di Chromium dan diperiksa.
    Uji fitur sebelumnya tetap lulus. Belum diuji: email asli (Gmail dari Apps Script) dan waktu CPU di Supabase asli.

### Perlu perhatian: Hari ini dan Rutin (aplikasi 0.35.0, 28 Oktober 2026)

377. **Asal:** telaah aplikasi 19 Oktober, bagian "Pelengkap": daftar Perlu perhatian di Dashboard bisa sampai 12 butir, sehingga
    yang mendesak tenggelam di antara pekerjaan berkala. Pemilik memilih butir ini tanpa pilihan tambahan. Spesifikasi tampilan
    Bagian 5.6. Hanya aplikasi (Code.gs, aksi, dan email tidak berubah).
378. **Pembagian** (keputusan tambahan, `PERHATIAN_RUTIN` di app.js): Rutin = `belumDiperiksa`, `opname`, `hargaBeli`, `menu`,
    `tanpaHarga` (pekerjaan berkala yang tidak terikat hari itu; jumlah belum diperiksa juga ada di ubin atas). Jenis lain, termasuk
    jenis baru dari server kelak, masuk Hari ini, supaya butir baru tidak tersembunyi. Urutan tingkat dari server tetap di dalam
    tiap kelompok.
379. **Tampilan** (`daftarPerhatian`, `barisPerhatian`): subjudul "Hari ini" (`judul-sub`) lalu daftarnya atau "Tidak ada yang
    mendesak hari ini."; Rutin berupa `<details class="perhatian-rutin">` dengan ringkasan "Rutin", "5 butir", panah (berputar
    200 ms, mati saat "kurangi gerak"), dan keterangan, tinggi minimal 44 px. Bawaannya terlipat jika ada butir Hari ini dan terbuka
    jika tidak; membuka atau melipat disimpan di `cache:perhatian-rutin` (per pengguna) dan dipakai saat Dashboard digambar ulang.
    Daftar memakai `role=group` dengan `aria-labelledby` ke subjudulnya. Tanpa butir: kotak kosong lama.
380. **Uji** (di luar repo): `uji_perhatian_ui.mjs` 20 uji Chromium (data contoh dengan dua kelompok, Rutin terlipat, dibuka dan diingat
    sesudah dimuat ulang, Enter menutup, butir Rutin membuka Riwayat, hanya Rutin terbuka dengan kalimat kosong, hanya Hari ini tanpa
    Rutin dan jenis baru di Hari ini, kosong, delapan ukuran tanpa gulir samping dan ringkasan ≥ 44 px), tampilan HP dan desktop
    diperiksa dari tangkapan layar. Belum diuji di HP asli.

### Nilai stock barang jadi dari resep (Code.gs v0.36, aplikasi 0.36.0, 28 Oktober 2026)

381. **Asal:** telaah aplikasi 19 Oktober, bagian "Pelengkap": Sambal dasar punya resep, tetapi terus ditandai "belum punya harga"
    dan tidak ikut nilai stock. Pemilik memilih butir ini tanpa pilihan tambahan. Keputusan butir 111 ("harga barang jadi dari resep
    tidak dipakai di nilai stock supaya sama dengan Sheet") dicabut: sejak pindah ke Supabase, Sheet hanya salinan untuk dicek, jadi
    aplikasi yang benar lebih penting. Spesifikasi sistem Bagian 8.5; tampilan Bagian 5.6 dan 5.7.
382. **Server:** `nilaiStock_` memakai `lengkapiHargaResep_(itemPadaTanggal_(tanggal, master), resep)`, jadi harga bahan pada tanggal
    yang dinilai (sama dengan estimasi waste, butir 98). Barang jadi yang dinilai dari resep masuk `dariResep` (dan per kategori serta
    total); yang resepnya punya bahan tanpa harga tetap di `tanpaHarga` dengan `resepKurang: true`. Item yang punya Harga Satuan tetap
    memakai harganya sendiri. Rekap bulanan: nilai stock akhir bulan ikut, gerakan barang jadi tanpa harga (masuk, penyesuaian)
    dinilai dengan harga resep hari itu (`hargaResep` disimpan per tanggal), `stock.dariResep` dan satu kalimat di catatan Stock.
    `daftarItem.item[].hargaResep` (hari ini). Penyesuaian dan opname tetap menulis Nilai Selisih dari Harga Satuan saja (butir 40,
    120); HPP tidak berubah (barang jadi memang tidak dihitung lagi di pemakaian bahan). Blok Nilai stock di tab Dashboard Sheets
    tidak diubah (rumusnya hanya membaca `M_Item`), jadi bisa lebih kecil dari aplikasi; dicatat di spesifikasi.
383. **Aplikasi:** lembar Nilai stock: kalimat pembuka (hanya jika server mengirim `dariResep`), "Harga dari resep (n)" dengan nilai dan
    tautan ke resep, dan "Ada bahan resep yang belum punya harga. Ketuk untuk membuka resepnya." untuk `resepKurang`. Daftar item: "Rp
    45.875 per kg dari resep" tanpa tanda Belum punya harga; kepala layar item: harga itu dengan "Dari resep". Server lama: seperti dulu.
384. **Uji** (di luar repo): `uji_nilai_resep.mjs` 24 uji (harga resep Rp 45.875 dihitung tangan, nilai, per kategori, total, ringkas,
    Perlu perhatian, daftarItem, harga bahan berganti hari ini dan kemarin tetap, rekap PDF dan data, penyesuaian barang jadi di rekap
    1 × Rp 47.125, bahan resep tanpa harga, resep nonaktif, harga satuan sendiri menang); `uji_nilai_resep_ui.mjs` 19 uji Chromium
    (lembar, membuka resep, resep kurang, daftar dan kepala item, server lama, delapan ukuran). Uji fitur sebelumnya tetap lulus.
