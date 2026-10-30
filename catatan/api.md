# Daftar aksi API InventoryKu

Dipindah dari CLAUDE.md pada 29 Oktober 2026 (Ringkas CLAUDE.md), isinya tidak diubah. Kesepakatan umum (bentuk permintaan,
jawaban, `AKSI_`, `panggilApi`, `submissionId`) tetap di CLAUDE.md. Setiap aksi atau field baru ditambahkan di sini.

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
- Waste per porsi menu (Code.gs v0.37, 29 Oktober 2026; bertoken, semua role): `formWaste` ditambah `menuSiap` dan `menu: [{ nama,
  hpp (khusus Pengelola) }]` (menu aktif, HPP per porsi pada `tanggal`); `kirimWaste.baris[]` boleh membawa `menu` (nama menu) menggantikan
  `item`, `qty` = porsi bilangan bulat 1–1.000. `riwayat`/`detailKiriman` Waste: baris ditambah `menu: true` untuk baris menu. `hpp.pemakaian`
  ditambah `wasteMenu: { porsi, nilai }`, `hpp.teoritis` ditambah `wastePorsi: { porsi, nilai }`.
- Email harian (Code.gs v0.35, 28 Oktober 2026): tidak ada aksi baru. Email laporan harian ditambah bagian "Barang masuk" dan
  (sejak penjualan pernah dicatat) "Penjualan dan food cost".
- Tambah item di daftar belanja (Code.gs v0.38, 29 Oktober 2026; khusus Pengelola): `daftarBelanja` (juga `belanja` di jawaban
  `catatPesanan` dan `tutupPesanan`) ditambah `itemLain: [item belanja + kategori, terakhir, dipesan]` (item aktif yang tidak di bawah
  minimum, urut kategori lalu nama) dan `pilihanPemasok[].kontak`; `unduhPdfBelanja` menerima `tambahan: [{ pemasok ('' = tanpa
  pemasok), item }]` dan tidak lagi menolak saat tidak ada item di bawah minimum jika ada item tambahan.
- Catatan resep dan stock hasil prep (Code.gs v0.39, 30 Oktober 2026): `daftarResep` ditambah `catatanSiap` (kolom `Catatan` di
  `M_Resep` ada) dan `resep[].catatan`; `simpanResep` menerima `catatan` (paling panjang 200; tidak dikirim = tidak diubah; berisi tanpa
  kolom ditolak); `formPrep.resep[].catatan`. `kirimPrep` (juga kiriman ulang `sudahTerkirim`) ditambah `stockHasil: [{ item, tambah,
  akhir, satuan }]` (per item hasil yang Hasil-nya > 0, akhir = Stock Akhir pada `tanggal` sesudah dicatat) dan `tanpaResep: [nama]`.
- Item nonaktif (Code.gs v0.40, 30 Oktober 2026): `aturItemAktif` dengan `aktif: false` menolkan stock item hari ini jika belum nol
  (satu baris `Data_Penyesuaian`, alasan Lainnya, catatan "Stock dinolkan karena item dinonaktifkan."), juga untuk item yang sudah
  nonaktif (tombol Nolkan stock); jawabannya ditambah `dinolkan: { stock, satuan }` (stock sebelum dinolkan) atau `null`.
  `daftarItem` (dan semua jawaban yang memuatnya) ditambah `nolkanSaatNonaktif: true`. `unduhPdf` form Stock tidak memuat item nonaktif.
- Kiriman berisi `submissionId` yang dibuat di HP. Kiriman dengan `submissionId` yang sudah pernah
  masuk tidak ditulis lagi dan dijawab berhasil dengan `sudahTerkirim: true`, supaya antrean yang
  mengirim ulang menganggapnya selesai.
