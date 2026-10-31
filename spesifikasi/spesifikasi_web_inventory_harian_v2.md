# Spesifikasi Sistem: InventoryKu — Form Operasional Kitchen Berbasis Web (v2)

> Dokumen ini berisi spesifikasi untuk membangun sistem form operasional kitchen berbasis
> web yang terintegrasi dengan Google Sheets, Google Drive, dan Gmail.
> Versi 2 (3 Oktober 2026) mengoreksi kesalahan teknis di v1, melengkapi struktur data,
> menambah fitur yang sebelumnya belum ada, dan memuat keputusan pemilik sistem (Bagian 3).
> Daftar perubahan dari v1 ada di Bagian 14.
>
> Diperbarui 4 Oktober 2026: Stock Akhir dihitung otomatis tanpa hitung fisik, resep yang
> menggerakkan stock, satuan besar, form kustom buatan Pengelola, dan Lupa PIN.
> Telaah menyeluruh pada tanggal yang sama menambahkan: catatan gerakan stock, penyesuaian
> dan stock opname, tanda nihil, cek ulang suhu, daftar belanja, nilai stock, masa simpan,
> cadangan mingguan, dan rekap bulanan.
> Disesuaikan dengan spesifikasi tampilan versi 1.4: tampilan untuk tablet, kemajuan hari
> ini di Beranda, dan dua grafik kecil di Dashboard aplikasi.
> Ditambah aturan unduh PDF di iPhone dan iPad (Bagian 9.1).
> Diperbarui 5 Oktober 2026: tombol Keluar dan keluar otomatis (Bagian 7.2), hapus staff
> yang sudah nonaktif (Bagian 5.1), dan PDF stock per kategori (Bagian 9.1).
> Diperbarui 11 Oktober 2026: riwayat harga item. Harga satuan punya riwayat (`M_HargaItem`,
> Bagian 5.1); setiap nilai rupiah memakai harga yang berlaku pada tanggalnya (Bagian 8.5),
> dan selisih karena perubahan harga dilaporkan (Bagian 8.5 dan 9.3).
> Diperbarui 12 Oktober 2026: memuat lebih cepat (Bagian 4.2 "Waktu tanggap" dan Bagian 11).
> Login membawa data Beranda, server membaca tiap tab sekali per permintaan dan menyimpan
> jawaban Beranda sebentar, dan alamat API diambil dari salinan di HP.
> Diperbarui 15 Oktober 2026: pindah ke Supabase (Bagian 4.5). Aplikasi memakai Supabase Edge
> Function dan database Postgres; Google Sheets menjadi salinan yang diperbarui tiap 5 menit dan
> hanya untuk dicek. PDF, email, rekap bulanan, dan cadangan dibuat di Supabase.
> Diperbarui 17 Oktober 2026 (dipilih pemilik dari pratinjau "Rancangan HPP InventoryKu"): HPP dan
> food cost (Bagian 5.9): menu dengan takaran per porsi, HPP per porsi, penjualan harian, dan food
> cost per bulan, khusus Pengelola. Nominal rupiah waste kini hanya terlihat oleh Pengelola
> (Bagian 5.4).
> Diperbarui 17 Oktober 2026 (permintaan pemilik): item nonaktif yang belum punya catatan apa pun,
> misalnya item yang salah dibuat, bisa dihapus (Bagian 5.1).
> Diperbarui 17 Oktober 2026 (permintaan pemilik): notifikasi ke HP (Web Push) untuk suhu di luar
> standar, permintaan reset PIN, akun terkunci, dan pengingat cek suhu (Bagian 7.2, 10.1, 12, 13).
> Diperbarui 17 Oktober 2026 (permintaan pemilik): penjualan per menu dan pemakaian bahan seharusnya
> dibanding nyata (Bagian 5.9, 9.3, dan 10).
> Diperbarui 17 Oktober 2026 (permintaan pemilik, dari telaah keamanan): kunci PIN bertingkat
> (kunci ketiga dalam 24 jam berlangsung 24 jam), akun terkunci terlihat oleh Pengelola, dan PIN
> baru yang terlalu mudah ditebak ditolak (Bagian 7.2 dan 10).
> Diperbarui 17 Oktober 2026 (keputusan pemilik): arsip tahunan. Tab hanya menyimpan tahun berjalan
> dan tahun lalu; data yang lebih tua dipindah otomatis ke berkas arsip per tahun di Drive
> (Bagian 8.6, 12, dan 13).
> Diperbarui 18 Oktober 2026 (permintaan pemilik, dari usulan fitur INV-04): kartu stok. Riwayat per
> item menampilkan setiap transaksi yang menggerakkan stock beserta saldo sesudahnya (Bagian 6).
> Diperbarui 18 Oktober 2026 (permintaan pemilik, dari usulan fitur SYS-07): pengingat stock pagi ke
> HP Pengelola untuk item di bawah stok minimum, stock minus, dan masa simpan (Bagian 10.1).
> Diperbarui 28 Oktober 2026 (permintaan pemilik, dari telaah aplikasi): pengingat sebelum closing ke
> semua HP untuk form wajib yang belum lengkap (Bagian 10.1).
> Diperbarui 28 Oktober 2026 (permintaan pemilik, dari telaah aplikasi): Staff boleh membetulkan
> isiannya sendiri dalam 15 menit sesudah dikirim, selama belum diperiksa (Bagian 3, 5.5, 6.2, 6.3, 7.1).
> Diperbarui 28 Oktober 2026 (permintaan pemilik, dari telaah aplikasi): ubah banyak item sekaligus, yaitu
> harga beberapa item dengan satu tanggal berlaku dan item baru dari tempelan Excel/Google Sheets (Bagian 5.1).
> Diperbarui 28 Oktober 2026 (permintaan pemilik, dari telaah aplikasi): food cost sementara selama penjualan
> belum lengkap (Bagian 5.9).
> Diperbarui 28 Oktober 2026 (permintaan pemilik, dari telaah aplikasi): email laporan harian memuat barang
> masuk hari itu, dan penjualan serta food cost bulan berjalan (Bagian 10).
> Diperbarui 28 Oktober 2026 (permintaan pemilik, dari telaah aplikasi): nilai stock barang jadi tanpa harga
> satuan memakai harga dari resepnya (Bagian 8.5).
> Diperbarui 29 Oktober 2026 (permintaan pemilik, dari telaah aplikasi): waste per porsi menu untuk salah
> order atau makanan yang dikembalikan, dinilai dengan HPP per porsi, tanpa mengurangi stock lagi
> (Bagian 5.4 dan 5.9).
> Diperbarui 29 Oktober 2026 (permintaan pemilik): daftar belanja bisa ditambah item yang stock-nya tidak
> di bawah minimum, per kelompok pemasok, sebelum dikirim ke WhatsApp (Bagian 9.2).
> Diperbarui 30 Oktober 2026 (permintaan pemilik): catatan resep untuk juru masak yang tampil di Prep List,
> dan pesan stock hasil prep sesudah Prep List dikirim (Bagian 5.1 dan 5.3).
> Diperbarui 30 Oktober 2026 (permintaan pemilik): item nonaktif tidak lagi muncul di laporan. Stock item
> yang dinonaktifkan dinolkan dengan penyesuaian, PDF stock tidak memuat item nonaktif, dan baris nonaktif
> di tab master Google Sheets ditulis abu-abu (Bagian 5.1, 8.2, dan 9.1).
> Diperbarui 31 Oktober 2026 (perbaikan): pengingat penjualan di Dashboard juga memeriksa bulan lalu, supaya
> "Penjualan kemarin belum dicatat" tetap muncul pada tanggal 1 (Bagian 5.9).
> Diperbarui 18 Oktober 2026 (keputusan pemilik, dari usulan fitur INV-07, INV-09, RPT-02): pemasok
> dan harga beli. Daftar pemasok (`M_Pemasok`), pemasok dan harga beli tidak wajib saat barang
> masuk, harga beli yang berbeda dari harga satuan ditinjau Pengelola, dan bagian Pembelian di
> rekap bulanan (Bagian 5.1, 5.5, 9.2, 9.3).
> Diperbarui 18 Oktober 2026 (permintaan pemilik, dari usulan fitur KIT-06): hasil prep aktual. Hasil
> yang benar-benar jadi boleh dicatat (tidak wajib) dan dipakai untuk stock; hasil menurut resep
> tetap terlihat sebagai pembanding (Bagian 5.3 dan 9.3).
> Diperbarui 19 Oktober 2026 (keputusan pemilik): masa simpan barang masuk. Item boleh punya masa
> simpan; saat barang masuk, tanggal "Baik sampai" terisi otomatis dan boleh diubah, lalu ikut
> pengingat masa simpan bersama barang jadi (Bagian 5.1, 5.3, 5.5).
> Diperbarui 19 Oktober 2026 (dari usulan fitur SYS-04): pemeriksaan, uji, dan pemulihan cadangan dari
> editor Apps Script; selama pemulihan aplikasi ditutup dan isian menunggu di antrean HP (Bagian 9.4).
> Diperbarui 19 Oktober 2026 (permintaan pemilik, dari telaah aplikasi): tandai diperiksa sekaligus per
> tanggal di daftar Riwayat untuk Head Kitchen atau Manager; isian yang dilaporkan keliru tidak ikut
> (Bagian 6.2).
> Diperbarui 20 Oktober 2026 (permintaan pemilik, dari telaah aplikasi): form Stock bisa diisi untuk
> semua kategori sekaligus (tetap dikirim satu kiriman per kategori), punya kotak cari item, dan
> pemakaian boleh dicatat dengan menghitung sisa; Stock Keluar dihitung server (Bagian 5.5).
> Diperbarui 21 Oktober 2026 (keputusan pemilik, dari telaah aplikasi): daftar belanja per pemasok
> dengan "Kirim ke WhatsApp". Pesanan yang dikirim lewat WhatsApp tercatat (`Data_Pesanan`), dan form
> Stock semua orang menampilkan pesanan yang belum datang untuk mengisi Tambah masuk (Bagian 5.0, 5.5,
> 7.1, 8.2, 9.2, 10, 11, 12).
> Diperbarui 22 Oktober 2026 (keputusan pemilik, dari telaah aplikasi): hari libur. Pengelola menandai
> tanggal dapur tutup (hari ini, tanggal lewat, atau sampai setahun ke depan); pada hari itu tidak ada
> form yang ditagih, penjualan tidak perlu dicatat, dan email harian serta pengingat cek suhu tidak
> dikirim (Bagian 3, 5.1, 5.8, 5.9, 6.1, 7.1, 8.2, 8.5, 9.1, 9.3, 10, 10.1, 12, 13).
>
> Dokumen ini mengatur **sistem**: data, role, alur, dan arsitektur. Tampilan (warna, huruf,
> tata letak, layar) diatur di dokumen terpisah: `spesifikasi_tampilan_ui.md`.
>
> Catatan nama: v1 berjudul "Web Inventory Harian", padahal cakupannya 4 form. Judul
> diganti agar sesuai cakupan. Stock Inventory Harian tetap menjadi form pertama yang dibangun.

---

## 1. Latar Belakang

Awalnya dibuat 4 form operasional kitchen dalam format Word (.docx):

1. Form Pengecekan Suhu Chiller & Freezer
2. Form Prep List
3. Form Pencatatan Waste
4. Form Stock Inventory Harian

Setiap form kertas berisi kotak info (outlet, tanggal, dan sejenisnya), tabel banyak baris,
dan baris "Diperiksa oleh" di bagian bawah.

Kebutuhan berkembang: form-form ini perlu menjadi **sistem web** yang:

- Bisa diisi dari HP, laptop, maupun desktop, dan bisa di-install di HP seperti aplikasi (PWA)
- Menyimpan data otomatis ke Google Sheets
- Menampilkan dashboard dari data yang masuk
- Menghasilkan laporan harian PDF yang bisa diunduh ke device dan tersimpan di Google Drive
- Mengirim laporan harian lewat email (Gmail) ke penerima yang ditentukan

---

## 2. Tujuan Utama

- [ ] Satu sistem input data berbasis web, menggantikan form kertas
- [ ] Data tersentralisasi otomatis di Google Sheets (tanpa input ulang)
- [ ] Bisa di-install di HP (PWA) dan tetap bisa mengisi form saat sinyal putus
- [ ] Akses berbasis role: staff hanya mengisi form dan mengunduh laporan; Head Kitchen dan
      Manager mengelola seluruh sistem
- [ ] Pengelola bisa membuat, mengubah, dan menghapus form sendiri (form kustom) tanpa
      mengubah kode
- [ ] Alur **"Diperiksa oleh"**: Head Kitchen/Manager memeriksa dan mengesahkan data
- [ ] Menu **Riwayat** untuk melihat kembali isian semua form di hari sebelumnya dan
      menemukan kekeliruan
- [ ] Laporan **harian** PDF per form, tersimpan di Google Drive dan bisa diunduh ke device
- [ ] Satu email **laporan harian otomatis** setelah closing, yang juga berfungsi sebagai
      pengingat form yang belum diisi
- [ ] Spreadsheet yang dibuat otomatis dan tersusun rapi: tampilan harian per form dan
      dashboard internal untuk Head Kitchen dan Manager
- [ ] Angka stock yang bisa dipercaya: stock opname berkala meluruskan catatan dengan
      barang nyata dan melaporkan selisihnya
- [ ] Daftar belanja otomatis dari item yang stock-nya di bawah minimum
- [ ] Rekap bulanan PDF dan cadangan data otomatis tiap minggu

---

## 3. Keputusan yang Sudah Ditetapkan

| Topik | Keputusan |
|---|---|
| Akun Google pemilik script | Akun Gmail biasa |
| Skala | 1 outlet, 4 staff |
| Outlet | Satu outlet. Namanya diisi saat pemasangan dan bisa diganti Pengelola. Kolom outlet tetap disimpan di data agar outlet lain bisa ditambah kelak. |
| Role | Dua tingkat: **Staff** dan **Pengelola** (Head Kitchen, Manager) |
| Hak Staff | Mengisi form (Stock Inventory, Suhu, Prep List, Waste, dan form kustom yang aktif), melihat riwayat, melaporkan kekeliruan, dan mengunduh laporan PDF per form |
| Hak Pengelola | Mengakses dan mengubah seluruh sistem |
| Login | PIN 6 angka, dibuat oleh Manager/Head Kitchen. Sesi berlaku paling lama 12 jam. Ada tombol "Keluar" untuk perangkat yang dipakai bergantian. |
| Keluar otomatis | Aplikasi keluar sendiri setelah 5 menit tidak dipakai, untuk semua role. Lamanya bisa diubah Pengelola. Isian yang belum dikirim tidak hilang (Bagian 7.2). |
| Menghapus staff | Hanya untuk staff yang sudah nonaktif. Namanya hilang dari aplikasi, tetapi tetap terbaca di riwayat (Bagian 5.1). |
| Menghapus item | Hanya untuk item nonaktif yang belum punya catatan apa pun, misalnya item yang salah dibuat (Bagian 5.1). |
| Hari libur | Pengelola menandai tanggal dapur tutup di Pengaturan → Hari libur: hari ini, tanggal yang sudah lewat, atau sampai setahun ke depan. Tidak ada hari tutup tetap per minggu. Pada hari libur tidak ada form yang ditagih, penjualan tidak perlu dicatat, dan email harian serta pengingat cek suhu tidak dikirim (Bagian 5.8). |
| Tanggal isian | Staff boleh mengisi untuk hari ini dan kemarin. Tanggal lebih lama hanya Pengelola. Tanggal masa depan ditolak. |
| PWA | Perlu |
| Jam closing | 21:30 |
| Laporan otomatis | Sekitar 22:15, yaitu 45 menit setelah closing |
| Zona waktu dan tanggal | Otomatis mengikuti perangkat (Bagian 4.2) |
| Batas jam pengisian form | Tidak ada |
| Batas suhu | Chiller 1°C sampai 5°C; Freezer −18°C atau lebih rendah. Tepat −18°C dianggap normal. |
| Suhu di luar standar | Tampil merah di layar dan Tindakan Korektif wajib diisi. Tanpa email instan. |
| Email alert instan | Tidak ada, baik untuk suhu maupun waste |
| Pengingat pengisian form | Bagian "belum diisi" di email laporan harian sekitar 22:15 (tidak pada hari libur). Tidak ada email pengingat lain. |
| Penerima email | Ditambahkan dari halaman Pengaturan di website |
| Stock Inventory | Tidak wajib hitung fisik harian; pemakaian boleh dicatat dengan menghitung sisa (Bagian 5.5). Stock Akhir dihitung otomatis: Awal + Masuk + Hasil Prep − Keluar − Dipakai Prep − Waste + Penyesuaian. Form boleh dikirim berkali-kali sehari; tiap kiriman menambah, tidak menimpa. |
| Stock opname | Berkala, oleh Pengelola. Hasil hitung barang nyata meluruskan stock dan menghasilkan laporan selisih (Bagian 5.7). |
| Daftar belanja | Otomatis dari item di bawah stok minimum, dengan saran jumlah order. Hanya Pengelola. |
| Nilai stock | Nilai rupiah stock dan pemakaian bahan tampil di dashboard. Hanya Pengelola. Harga satuan punya riwayat: setiap nilai rupiah memakai harga yang berlaku pada tanggal gerakan atau tanggal yang dinilai (Bagian 8.5). |
| Masa simpan | Tiap resep dan tiap item bisa punya masa simpan. Aplikasi mengingatkan barang jadi dan barang masuk yang lewat masa simpan (Bagian 5.3). |
| Tanda nihil | Form yang memang kosong hari itu ditandai "Tidak ada hari ini", supaya tidak dilaporkan belum diisi (Bagian 5.8). |
| Cadangan data | Salinan spreadsheet otomatis tiap minggu; empat salinan terakhir disimpan |
| Rekap bulanan | PDF otomatis tiap awal bulan, dikirim lewat email. Hanya Pengelola. |
| Gerakan barang | Setiap gerakan dicatat sekali, di form asalnya: barang datang di Stock Masuk, prep di Prep List, barang terbuang di Form Waste, pemakaian langsung di Stock Keluar |
| Resep | Pengelola mengisi Master Resep. Prep List diisi dalam jumlah resep; stock barang jadi bertambah dan stock bahan berkurang otomatis (Bagian 5.3). |
| Satuan | Satu item satu satuan dasar, tanpa konversi umum (kg ke gr). Satuan besar opsional per item untuk barang datang, misalnya 1 dus = 12 botol (Bagian 5.1). |
| Kategori stock | Dikelola Pengelola. Form, tab Harian, dan PDF stock tersusun per kategori. PDF stock bisa diunduh untuk satu kategori saja (Bagian 9.1). |
| Nominal waste | Estimasi kerugian (Rp) = qty × harga satuan yang berlaku pada tanggal waste. Harga satuan diisi Pengelola di master Item dan punya riwayat (Bagian 5.1). |
| Waste dan stock | Waste punya form sendiri dan langsung mengurangi stock. Stock Keluar yang diketik staff hanya pemakaian langsung, di luar prep dan waste. |
| Koreksi data | Oleh Pengelola, kapan pun. Staff hanya membetulkan isiannya sendiri dalam 15 menit sesudah dikirim, selama belum diperiksa (Bagian 6.3). |
| Menu Riwayat | Ada, untuk semua role. Staff hanya melihat. |
| Tombol "Laporkan Kekeliruan" | Ada, untuk staff dan Pengelola |
| Lupa PIN | Ada di layar Login. Permintaan muncul sebagai pemberitahuan di aplikasi Pengelola, tanpa email. |
| Form kustom | Pengelola bisa membuat, mengubah, dan menghapus form sendiri dari Pengaturan (Bagian 5.6) |
| Spreadsheet dan dashboard | Dibuat otomatis oleh script, mengikuti kolom form, tersusun per form per hari (Bagian 8) |
| Tampilan harian di spreadsheet | Satu tab per form dengan pemilih tanggal, bukan satu tab per hari |
| Urutan tab Data | Tanggal terbaru di atas |
| Warna laporan PDF dan tab Harian | Navy, seragam dengan website |
| Nama aplikasi | InventoryKu, dengan ikon buku |
| Tampilan UI | Diatur di dokumen terpisah `spesifikasi_tampilan_ui.md` |
| Hosting frontend | GitHub Pages |
| Dashboard | Internal, hanya Pengelola, termasuk dashboard di Google Sheets |
| Form pertama | Stock Inventory Harian |

---

## 4. Arsitektur

> **Sejak 15 Oktober 2026 backend berjalan di Supabase (Bagian 4.5).** Bagian 4.2–4.4 di bawah
> menjelaskan susunan awal dengan Apps Script; aturan isinya (satu pintu `doPost`, POST
> `text/plain` tanpa preflight, token di body, kunci tulis, token wajib) tetap berlaku, karena
> kode yang sama (`Code.gs`) kini dijalankan Supabase.

Karena PWA diperlukan, sistem dibangun sebagai **frontend statis + Apps Script sebagai API**.
Apps Script HTML Service murni tidak bisa dipakai: halamannya berjalan di dalam iframe
milik Google, sehingga service worker dan manifest tidak bisa dipasang.

```
PWA (HTML/CSS/JS statis, di hosting statis ber-HTTPS)
   │  service worker: cache halaman dan master data, antrean submit saat offline
   │
   │  fetch POST ke URL Web App (text/plain, token sesi di dalam body)
   ▼
Apps Script Web App (API, fungsi doPost)
   ├─▶ Login PIN → token sesi + role
   ├─▶ Validasi + tulis ke Google Sheets (database utama)
   ├─▶ Generate PDF → simpan ke Drive dan/atau kirim balik ke browser
   └─▶ Kelola staff, PIN, penerima email, master data, form kustom (khusus Pengelola)

Trigger berbasis waktu
   ├─▶ Harian, sekitar 22:15 (setelah closing 21:30): PDF harian ke Drive + email harian
   ├─▶ Mingguan: salinan cadangan spreadsheet
   └─▶ Bulanan, tanggal 1: rekap bulanan PDF + email

Google Sheets
   └─▶ Sheet Dashboard (QUERY / pivot / chart), hanya untuk Pengelola
```

### 4.1 Frontend (PWA)

- File statis: HTML, CSS, JavaScript, `manifest.json`, service worker. Tanpa framework dan
  tanpa langkah build, supaya bisa ditayangkan langsung dari repo.
- Susunan repo: frontend di akar repo, kode Apps Script di `apps-script/Code.gs`, dan
  kedua file spesifikasi di folder `spesifikasi/`.
- Website tayang di alamat `https://NAMAUSER.github.io/NAMAREPO/`, jadi semua path di
  frontend relatif.
- Hosting: **GitHub Pages** (gratis, HTTPS, yang wajib untuk service worker). Pada akun
  GitHub gratis, repo untuk GitHub Pages harus public.
- Frontend tidak menyimpan rahasia apa pun. Kodenya boleh terlihat publik; pengamanan ada
  di API (Bagian 7).
- Viewport diset dengan tag meta HTML biasa (`<meta name="viewport" ...>`), dengan
  `viewport-fit=cover` supaya jarak aman tepi layar HP bisa dipakai.
- Tanpa library animasi dan tanpa library grafik. Gerak dibuat dengan CSS, grafik digambar
  dengan SVG. Aturannya ada di `spesifikasi_tampilan_ui.md`, Bagian 5.6 dan 8.

### 4.2 Backend (Apps Script sebagai API)

- Satu fungsi `doPost` menerima semua permintaan, dibedakan dengan field `action`
  (misalnya `login`, `submitStock`, `getMaster`, `downloadPdf`).
- **Batasan CORS:** Apps Script Web App hanya melayani GET dan POST, dan tidak menjawab
  permintaan preflight (OPTIONS). Karena itu setiap permintaan harus berupa POST dengan
  `Content-Type: text/plain` tanpa header kustom; token sesi dikirim di dalam body.
  Ini diuji paling awal, di Tahap 0, dari HP sungguhan.
- Penulisan ke Sheet memakai `LockService` agar dua submit bersamaan tidak saling menimpa.
- Script menempel pada Google Sheet (dibuat lewat Extensions → Apps Script). Saat berjalan
  sebagai Web App, `getActiveSpreadsheet()` tidak tersedia, sehingga `setupSpreadsheet`
  menyimpan ID spreadsheet ke Script Properties dan semua kode membukanya lewat ID itu.
- Seluruh kode Apps Script berada dalam satu file, `Code.gs`, karena ditempel dengan
  tangan ke editor. Baris pertamanya memuat nomor versi.
- Setiap perubahan kode dirilis dengan memperbarui deployment yang sama (versi baru),
  supaya URL API tidak berubah.
- **Token wajib.** Semua aksi menuntut token sesi yang sah, kecuali: daftar nama untuk
  layar Login, login, Lupa PIN, pemasangan pertama, pemulihan akses, dan `ping`.
- **Waktu tanggap.** Satu panggilan ke Apps Script bisa makan beberapa detik. Karena itu
  aplikasi menampilkan data yang tersimpan di HP lebih dulu, lalu memperbaruinya setelah
  server menjawab; dan beberapa data yang dibutuhkan satu layar diminta dalam satu panggilan.
  Diperbarui 12 Oktober 2026 (pemilik: membuka aplikasi terasa lama, juga di iPhone):
  - **Login membawa Beranda.** Login, pemasangan pertama, dan pemulihan akses menerima tanggal
    perangkat dan langsung menjawab data Beranda, jadi sesudah PIN benar tidak ada panggilan
    kedua. Jika Beranda gagal dihitung, login tetap berhasil dan HP memuatnya sendiri.
  - **Setiap tab dibaca sekali per permintaan,** dalam satu panggilan ke Sheet. Pada aksi yang
    hanya membaca, isi tab disimpan selama permintaan itu, sehingga tab yang sama tidak dibaca
    berulang. Penulisan selalu membaca isi terbaru.
  - **Jawaban Beranda disimpan 2 menit di server** per pengguna dan tanggal, dan langsung tidak
    terpakai begitu ada penulisan apa pun dari aplikasi. Perubahan yang diketik langsung di Sheet
    terlihat paling lambat 2 menit kemudian.
  - **Lama tiap aksi dicatat** di log Eksekusi Apps Script ("Aksi beranda: 1840 ms"), supaya bagian
    yang lambat bisa dilihat pemilik.
  - **Lama keluar otomatis** (Bagian 7.2) ikut menentukan seberapa sering orang harus login lagi;
    Pengelola bisa menaikkannya ke 15 atau 30 menit.

**Setelan deploy:**

- Akun pemilik script: akun Gmail biasa. Email laporan terkirim dari alamat ini.
- Execute as: **Me** (pemilik script). Semua penulisan Sheet, file Drive, dan email
  berjalan atas nama pemilik.
- Who has access: **Anyone**. Pengamanan dilakukan dengan PIN dan token sesi (Bagian 7).

**Zona waktu dan tanggal (otomatis):**

- Tanggal di form terisi otomatis dengan tanggal hari ini menurut perangkat.
- Zona waktu sistem terdeteksi otomatis dari perangkat Pengelola saat login pertama pada
  pemasangan awal, lalu disimpan di `M_Konfigurasi`. Tidak perlu diketik.
- Zona waktu tersimpan itu dipakai server untuk trigger laporan harian, jam di laporan
  dan email, serta nama file PDF. Jam closing 21:30 dibaca dalam zona waktu ini.
- Server butuh satu zona waktu tetap agar trigger 22:15 tidak bergeser. Jika outlet
  pindah zona waktu, Pengelola mengubahnya di Pengaturan.

**Catatan trigger (koreksi dari v1):**

- `onFormSubmit` hanya berlaku untuk Google Form.
- `onEdit` hanya jalan saat orang mengedit Sheet secara manual, tidak saat script menulis.
- Di sistem ini, data masuk lewat `doPost`. Trigger hanya dipakai untuk pekerjaan
  terjadwal: laporan harian, cadangan mingguan, dan rekap bulanan. Ketiganya dipasang
  oleh fungsi `pasangTrigger`.

### 4.3 Kuota Apps Script

Sumber: dokumentasi resmi Google, dicek 3 Oktober 2026; angka bisa berubah.
https://developers.google.com/apps-script/guides/services/quotas

| Kuota | Akun Gmail biasa (dipakai) | Google Workspace |
|---|---|---|
| Penerima email per hari | 100 | 1.500 |
| Waktu jalan per eksekusi | 6 menit | 6 menit |
| Total waktu jalan trigger per hari | 90 menit | 6 jam |
| Eksekusi bersamaan per user | 30 | 30 |
| Jumlah trigger per user per script | 20 | 20 |

Untuk 1 outlet dengan 4 staff, satu trigger harian, dan satu email harian, pemakaian jauh
di bawah batas.

### 4.4 Opsi yang tidak dipilih

- **Apps Script HTML Service murni.** Paling sederhana, tetapi tidak bisa PWA, tidak
  otomatis responsif (viewport harus diset lewat `addMetaTag` di server), dan menampilkan
  banner Google pada akun Gmail biasa.
- **Backend sendiri (Node.js/Python + Google API).** Paling fleksibel, tetapi butuh
  hosting server dan waktu development lebih lama. Dua hal yang perlu diketahui jika
  kelak pindah ke sini: Gmail tidak bisa dikirim lewat Service Account untuk akun
  @gmail.com biasa (butuh Workspace dengan domain-wide delegation, OAuth atas nama user,
  atau SMTP), dan file yang diunggah Service Account menjadi milik akun tersebut.

### 4.5 Supabase (sejak 15 Oktober 2026)

Pemilik mengeluh membuka aplikasi lama, juga sesudah perbaikan 12 Oktober (Bagian 4.2). Waktu
satu panggilan Apps Script sebagian besar adalah waktu Google membuka script dan Sheet, yang
tidak bisa dipercepat dari kode. Keputusan pemilik: pindah ke Supabase; PDF, email, rekap
bulanan, dan cadangan juga dibuat di Supabase; data tetap tersalin ke Google Sheets tiap 5 menit;
Sheets hanya untuk dicek.

```
PWA (GitHub Pages, sama seperti sebelumnya)
   │  fetch POST ke Supabase Edge Function "api" (text/plain, token di body)
   ▼
Supabase Edge Function "api" (Deno)
   ├─▶ menjalankan Code.gs yang sama di atas tiruan SpreadsheetApp/Drive/Mail
   ├─▶ Postgres (skema inventoryku): satu baris tab Sheet = satu baris tabel
   ├─▶ Storage (bucket arsip): laporan PDF, foto bukti waste, cadangan
   ├─▶ Brevo: email laporan harian dan rekap bulanan (jika dipasang)
   └─▶ pg_cron + pg_net: laporan harian, cadangan mingguan, rekap bulanan

Apps Script (menempel di Google Sheet yang sama)
   └─▶ tiap 5 menit: salin tab yang berubah ke Sheet, salin berkas ke Drive,
       kirim email dari Gmail jika Brevo tidak dipasang
```

- **Satu sumber logika.** Seluruh aturan (role, validasi, hitung ulang stock, PDF, email) tetap di
  `apps-script/Code.gs`. Edge Function membungkus Code.gs dan menyediakan pengganti layanan Google
  (`supabase/src/`): tab Sheet disimpan sebagai baris JSON di Postgres, Drive sebagai tabel berkas
  dan Storage, MailApp sebagai antrean email, trigger sebagai jadwal pg_cron. Karena itu jawaban API
  sama dengan sebelumnya dan frontend hanya perlu alamat baru di `config.js`.
- **Kunci tulis.** Aksi yang menulis memakai `pg_advisory_xact_lock` (pengganti LockService), jadi
  penulisan berurutan; aksi baca berjalan bersamaan dalam transaksi `repeatable read`.
- **Memuat tab seperlunya.** Tiap aksi memuat tab master dan tab yang biasa dibutuhkannya (dipelajari
  otomatis); isi tab disimpan di memori Edge Function selama versinya sama.
- **PDF** dibuat dari HTML laporan yang sama (Bagian 9) dengan jsPDF, huruf Helvetica, A4. Pemisah
  halaman PDF stock per kategori selalu dipatuhi.
- **Email** lewat Brevo jika `BREVO_API_KEY` dan `SUREL_PENGIRIM` dipasang; jika tidak, email menunggu
  di antrean dan Apps Script mengirimnya dari Gmail pemilik paling lambat 5 menit. Email yang gagal
  dicatat seperti sebelumnya (Beranda Pengelola, `laporan_terakhir`/`rekap_terakhir`).
- **Jadwal** dipasang ulang otomatis begitu Pengelola mengubah jam closing, jeda, hari cadangan, atau
  zona waktu; tidak perlu menjalankan `pasangTrigger` lagi. pg_cron memakai UTC; jam lokal diubah
  dengan zona waktu tersimpan.
- **Salinan ke Google Sheets tiap 5 menit** (`sinkronDariSupabase`). Hanya tab yang berubah; untuk
  tab yang sudah disalin, hanya baris yang dihapus, disisipkan, atau diubah, supaya kuota waktu Apps
  Script (90 menit per hari) cukup. Tab Harian dan Dashboard tidak disalin: rumusnya menghitung dari
  tab yang disalin, jadi tetap jalan. Sheets hanya untuk dicek: ketikan langsung di Sheet tertimpa;
  jika jumlah baris Sheet tidak cocok, tab itu disalin penuh, dan sekali sehari (sesudah pukul 02.00)
  semua tab disalin penuh.
- **Berkas di Drive.** Laporan PDF, foto bukti waste, dan cadangan disalin ke folder Drive yang sama
  seperti sebelumnya (`Laporan Kitchen/...`); kolom Foto Bukti di Sheet berisi tautan Drive. Di
  aplikasi, Pengelola membuka foto lewat tautan sementara dari Storage.
- **Cadangan mingguan** berupa satu berkas JSON berisi semua tab (`Cadangan … .json`), empat terakhir
  disimpan, dan ikut tersalin ke Drive. Google Sheets sendiri juga menjadi salinan.
- **Pindah sekali** (`pindahKeSupabase`, dari editor Apps Script): isi semua tab dan Script Properties
  (termasuk rahasia PIN dan sesi, jadi PIN dan login yang sedang berjalan tetap berlaku) dikirim ke
  Supabase, trigger lama dihapus, dan salinan 5 menit dipasang. Sesudah itu Apps Script menolak aksi
  aplikasi dan menjawab alamat baru (`pindahKe`); HP yang masih memakai alamat lama langsung beralih.
  Fungsi editor (`setupSpreadsheet`, `pasangTrigger`, `kirimLaporanSekarang`, `kirimRekapSekarang`,
  `buatKodePemasangan`) diteruskan ke Supabase.
- **Rahasia** (`RAHASIA_SINKRON`, kunci Brevo, kunci Supabase) hanya di Supabase Secrets dan Script
  Properties, tidak pernah di repo. Skema `inventoryku` tidak dibuka ke API publik Supabase; hanya
  Edge Function yang membacanya.
- **Batas.** Edge Function dibatasi sekitar 2 detik waktu CPU per permintaan. Dengan data satu tahun
  (diuji), aksi aplikasi memakai 0,1–0,8 detik dan laporan harian sekitar 0,6–1,1 detik. Arsip
  tahunan (Bagian 8.6) menjaga data paling banyak dua tahun, jadi angka ini tetap rendah.

---

## 5. Struktur Data

### 5.0 Prinsip umum

- **Satu submit = satu header + banyak baris.** Header berisi kotak info form (tanggal,
  shift, dan sejenisnya); baris berisi item. Disimpan datar di Sheet: satu baris Sheet per
  item, dengan header diulang di tiap baris.
- **Satu sheet data per form:** `Data_Suhu`, `Data_Prep`, `Data_Waste`, `Data_Stock`,
  dan satu sheet untuk tiap form kustom (Bagian 5.6).
- **Sheet pendukung:** `Data_PrepBahan` (bahan yang terpakai tiap prep), `Stock_Harian`
  (rekap stock per tanggal dan item), `Data_Penyesuaian`, `Data_Opname`, `Data_Nihil`,
  `Data_Penjualan` dan `Data_PenjualanMenu` (penjualan harian, Bagian 5.9), dan `Data_Pesanan`
  (pesanan ke pemasok, Bagian 9.2).
- **Outlet terisi otomatis.** Karena hanya ada satu outlet, staff tidak memilihnya. Nama
  outlet tetap tampil di form dan laporan, dan tetap disimpan di setiap baris data.
- **Semua pilihan memakai dropdown dari master data.** Teks bebas membuat "Ayam Fillet" dan
  "ayam filet" terhitung sebagai dua item dan merusak dashboard.
- **Tanggal isian.** Tanggal terisi otomatis dengan hari ini. Staff boleh menggantinya ke
  kemarin, misalnya untuk isian closing yang baru sempat dicatat esok paginya. Tanggal yang
  lebih lama hanya bisa diisi Pengelola. Tanggal masa depan ditolak server.
- **Kolom sistem di setiap sheet data** (diisi otomatis, tidak tampil sebagai input):

| Kolom | Keterangan |
|---|---|
| `submission_id` | ID unik per submit, dibuat di HP saat form dibuka. Dipakai untuk menolak submit ganda. |
| `row_id` | ID unik per baris |
| `outlet` | Nama outlet (otomatis) |
| `timestamp_server` | Waktu data diterima server |
| `timestamp_device` | Waktu staff menekan Submit di HP (bisa lebih awal jika dikirim dari antrean offline) |
| `submitted_by` | Staff yang login dengan PIN |
| `status` | `Terkirim` / `Diperiksa` |
| `checked_by`, `checked_at` | Pengelola yang memeriksa dan waktunya |
| `updated_by`, `updated_at` | Terisi jika baris pernah dikoreksi |
| `flagged_by`, `flag_note` | Terisi jika baris dilaporkan keliru lewat menu Riwayat (Bagian 6.3) |

### 5.1 Master Data

Master data wajib ada sebelum form dibangun. Dropdown, validasi suhu, estimasi kerugian,
dan tanda reorder semuanya bergantung padanya. Hanya Pengelola yang bisa mengubahnya.

| Sheet | Kolom | Dipakai untuk |
|---|---|---|
| `M_Outlet` | Nama Outlet, Email Penerima Laporan (bisa lebih dari satu) | Nama di form dan laporan, penerima email |
| `M_Unit` | Nama Unit, Tipe (Chiller/Freezer), Aktif | Dropdown unit, validasi suhu |
| `M_Pemasok` (18 Oktober 2026) | Nama Pemasok, Kontak, Catatan, Aktif | Pilihan pemasok saat barang masuk (Bagian 5.5); pembelian per pemasok |
| `M_Staff` | Nama, Role (Staff / Head Kitchen / Manager), PIN (tersimpan sebagai hash), Aktif, Permintaan Reset PIN (waktu), Dihapus (waktu) | Login, `submitted_by`, `checked_by`, pemberitahuan Lupa PIN |
| `M_Item` | Nama Item, Kategori, Satuan (dasar), Satuan Besar (opsional), Isi per Satuan Besar, Harga Satuan (Rp), Stok Minimum, Stok Maksimum (opsional), Aktif, Masa Simpan dalam hari (opsional, 19 Oktober 2026) | Dropdown item, estimasi kerugian, tanda reorder, konversi barang datang, baik sampai barang masuk |
| `M_HargaItem` | Nama Item, Berlaku Mulai (tanggal), Harga Satuan (Rp), Dicatat Oleh, Dicatat Pada | Riwayat harga; harga yang berlaku pada suatu tanggal |
| `M_Resep` | Item Hasil, Hasil per 1 Resep, Masa Simpan dalam hari (opsional), Aktif, Catatan (opsional, 30 Oktober 2026) | Barang jadi yang dibuat lewat Prep List; pengingat masa simpan |
| `M_ResepBahan` | Item Hasil, Item Bahan, Qty per 1 Resep | Bahan yang dikurangi dari stock saat prep |
| `M_Menu` | Nama Menu, Harga Jual (Rp), Aktif | Menu yang dijual dan harganya, untuk HPP (Bagian 5.9) |
| `M_MenuBahan` | Nama Menu, Item Bahan, Qty per Porsi, Hasil Bersih (%) | Takaran bahan satu porsi dan susutnya |
| `M_Kategori` | Nama Kategori, Urutan, Aktif | Dropdown kategori di Stock Inventory; urutan kelompok di tab Harian dan PDF |
| `M_Form` | ID Form, Nama, Jenis (bawaan / kustom), Keterangan, Jadwal (harian / hari tertentu / sewaktu-waktu), Urutan, Aktif | Daftar form yang tampil di Beranda, Riwayat, dan Laporan |
| `M_FormKolom` | ID Form, Urutan, Label, Jenis Kolom, Pilihan, Wajib, Bagian (kepala / baris), Aktif | Susunan kolom tiap form kustom |
| `M_HariLibur` (22 Oktober 2026) | Tanggal, Keterangan (tidak wajib, paling panjang 40 huruf), Dicatat Oleh, Dicatat Pada | Hari libur (Bagian 5.8) |
| `M_Satuan` | Satuan, Jenis (Berat / Isi / Hitungan / Kemasan), Aktif | Daftar satuan yang sah |
| `M_Konfigurasi` | Kode Pemasangan (sekali pakai), zona waktu (terdeteksi otomatis), jam closing (21:30), jeda laporan setelah closing (45 menit), batas suhu Chiller (1 sampai 5), batas suhu Freezer (−18 atau lebih rendah), jadwal stock opname (mingguan atau bulanan), hari cadangan mingguan, lama keluar otomatis (5 menit), target food cost (35%), bahan kecil (3%) | Trigger terjadwal, validasi suhu, pengingat opname, keluar otomatis, HPP |

**Riwayat harga item (`M_HargaItem`):**

- Harga yang berlaku pada tanggal T = baris item itu dengan Berlaku Mulai terbesar yang tidak
  melewati T. Baris dengan Berlaku Mulai kosong berlaku sejak awal. Sebelum baris pertama,
  item belum punya harga.
- Kolom Harga Satuan di `M_Item` tetap ada dan selalu sama dengan harga yang berlaku hari ini
  (diperbarui aplikasi), supaya rumus Sheet dan tampilan "harga sekarang" tetap sederhana.
- Mengganti harga = menambah baris baru dengan tanggal berlaku mulai: hari ini atau tanggal yang
  sudah lewat (misalnya tanggal faktur), tidak boleh masa depan. Tanggal yang sama dengan baris
  yang sudah ada menggantikan baris itu (untuk membetulkan salah ketik) dan tercatat di
  `Log_Perubahan`. Riwayat harga tidak bisa dihapus dari aplikasi.
- Harga awal: saat pertama dipasang, tiap item yang sudah punya harga mendapat satu baris dengan
  Berlaku Mulai kosong, artinya berlaku sejak awal.

**Ubah banyak item sekaligus** (28 Oktober 2026, khusus Pengelola):

- **Ganti harga beberapa item:** satu tanggal berlaku mulai (aturan sama dengan mengganti harga
  satu item) untuk banyak item aktif sekaligus. Harga yang sama dengan harga yang berlaku pada
  tanggal itu dilewati. Item yang belum punya harga sama sekali mendapat harga pertama yang
  berlaku sejak awal, seperti harga yang diisi di layar item. Satu item yang salah (tidak ada,
  ganda, angka salah) menolak semuanya, supaya tidak ada separuh perubahan yang tersimpan.
- **Tambah item dari tempelan Excel atau Google Sheets:** baris yang disalin dari lembar kerja
  ditempel di aplikasi. Kolom: Nama, Kategori, Satuan, Harga, Stok minimum, Stok maksimum,
  Satuan besar, Isi satuan besar, Masa simpan (hari); hanya tiga yang pertama wajib. Baris judul
  boleh ikut dan menentukan urutan kolom (dikenali jika berisi judul nama dan paling sedikit satu
  judul kolom lain). Sel berkutip dari spreadsheet (berisi ganti baris atau tanda kutip) dibaca
  utuh. Angka yang pemisah ribuannya tidak jelas ("15,000") ditolak supaya tidak tersimpan seribu
  kali lebih kecil. Aturannya sama dengan item baru satu per satu: nama
  unik (juga di antara baris tempelan), kategori dan satuan harus sudah ada dan aktif (tidak
  dibuat otomatis), harga berlaku sejak awal, item langsung aktif, stock 0 sampai stok pembuka
  diisi. Aplikasi menandai baris yang salah sebelum menyimpan dan hanya mengirim baris yang
  benar; server memeriksa lagi dan menolak semuanya jika ada yang salah. Paling banyak 300 item
  sekaligus (juga untuk ganti harga).

**Daftar satuan awal** (diisi `setupSpreadsheet`; Pengelola bisa menambah):

| Jenis | Satuan |
|---|---|
| Berat | kg, gr |
| Isi | liter, ml |
| Hitungan | pcs, butir, buah, ikat, lembar, ekor, porsi |
| Kemasan | pack, botol, kaleng, sachet, dus, karung, jerigen |

**Aturan satuan:**

- **Satu item, satu satuan dasar.** Satuan dikunci ke `M_Item`: staff memilih item, satuan
  terisi otomatis dan tidak bisa diubah. Stock, waste, prep, dan harga item itu semuanya
  memakai satuan dasar ini.
- **Tidak ada konversi umum** seperti kg ke gr atau liter ke ml. Pecahan ditulis dengan
  desimal, misalnya 0,5 kg.
- **Satuan besar (opsional, per item)** untuk barang yang datang dalam kemasan. Pengelola
  mengisi satuan besar dan isinya, misalnya dus berisi 12 botol. Di kolom Stock Masuk,
  staff boleh mengetik dalam satuan besar; server mengalikannya menjadi satuan dasar.
  - Hanya berlaku di Stock Masuk. Keluar, waste, dan prep selalu dalam satuan dasar.
  - Yang disimpan adalah satuan dasar. Angka asli yang diketik ikut dicatat (misalnya
    "2 dus") dan tampil di Riwayat, supaya mudah diperiksa.
  - Mengubah isi satuan besar di kemudian hari tidak mengubah catatan lama.
- **Perubahan bentuk** (beras menjadi nasi, bahan menjadi sauce) tidak ditangani dengan
  konversi satuan, tetapi dengan resep (Bagian 5.3).

**Aturan menonaktifkan master:**

- Master tidak pernah dihapus, hanya dinonaktifkan, supaya riwayat tetap terbaca.
  Yang punya tombol "Hapus" hanya staff dan item yang belum punya catatan, dengan aturan
  di bawah, dan hari libur: menghapus tanda hari libur menghapus barisnya di `M_HariLibur`
  dan tercatat di `Log_Perubahan` (Bagian 5.8).
- Item tidak bisa dinonaktifkan selama masih menjadi bahan atau hasil resep yang aktif, atau
  bahan menu yang aktif (Bagian 5.9).
- Item yang stock-nya belum nol menampilkan peringatan saat dinonaktifkan. Sejak 30 Oktober 2026
  stock itu **dinolkan** saat item dinonaktifkan: satu baris `Data_Penyesuaian` pada hari itu (Stock
  Sebenarnya 0, alasan Lainnya, catatan "Stock dinolkan karena item dinonaktifkan."). Dengan begitu
  item nonaktif tidak ikut nilai stock, daftar "belum punya harga", dan laporan, sementara riwayatnya
  tetap utuh. Item nonaktif yang stock-nya belum nol dari sebelum tanggal itu punya tombol
  "Nolkan stock" di layar itemnya. Mengaktifkan lagi item yang stock-nya 0 menawarkan stok pembuka.
- Satuan dasar sebuah item tidak bisa diganti setelah item itu punya catatan stock.

**Menghapus item** (17 Oktober 2026, untuk item yang salah dibuat):

- Hanya untuk item yang sudah nonaktif dan belum punya catatan apa pun: tidak punya catatan
  stock (rekap `Stock_Harian`, gerakan stock, prep, waste, penyesuaian, stock opname), tidak
  punya resep, tidak menjadi bahan resep atau menu mana pun (aktif maupun nonaktif), dan
  tidak pernah dipilih di kolom Item form kustom. Item yang sudah punya catatan cukup
  dinonaktifkan.
- Baris item di `M_Item` dan semua baris riwayat harganya di `M_HargaItem` dihapus. Penghapusan
  tercatat di `Log_Perubahan`. Nama itu boleh dipakai lagi untuk item baru.
- Hapus tidak bisa dibatalkan dari aplikasi; item yang terhapus dibuat ulang sebagai item baru.

**Menonaktifkan dan menghapus staff:**

- **Staff nonaktif** tidak tampil di layar Login dan tidak bisa masuk. Ia masih tampil di
  Pengaturan → Staff dengan tanda "Nonaktif" dan bisa diaktifkan lagi.
- Pengelola aktif yang terakhir tidak bisa dinonaktifkan, supaya selalu ada yang bisa
  mengelola sistem.
- **Menghapus staff** hanya bisa dilakukan pada staff yang sudah nonaktif. Staff yang
  dihapus hilang dari Pengaturan → Staff dan dari layar Login.
- Barisnya **tetap ada** di `M_Staff`: kolom Dihapus diisi waktunya dan hash PIN-nya
  dikosongkan. Karena itu nama staff tersebut tetap terbaca di Riwayat, laporan PDF, dan
  `Log_Perubahan`. Permintaan reset PIN miliknya ditutup.
- Hapus tidak bisa dibatalkan dari aplikasi. Pemilik Sheet bisa memulihkannya dengan
  mengosongkan kolom Dihapus; staff itu kembali sebagai staff nonaktif dan PIN-nya harus
  dibuat ulang.
- Nama yang sama boleh dipakai untuk staff baru. Staff baru itu menjadi akun tersendiri.

### 5.2 Form Pengecekan Suhu Chiller & Freezer

Satu record per pengecekan, bukan satu record berisi tiga suhu. Opening, Middle, dan
Closing diisi pada waktu berbeda dan bisa oleh staff berbeda.

| Field | Tipe | Keterangan |
|---|---|---|
| Nama Unit | Dropdown | Dari `M_Unit` |
| Tipe Unit | Otomatis | Chiller/Freezer, dari `M_Unit` |
| Tanggal | Date | Default: hari ini |
| Waktu Cek | Dropdown | Opening / Middle / Closing / Cek ulang |
| Suhu | Number (°C) | Boleh negatif dan desimal |
| Nama Staff | Otomatis | Dari login PIN |
| Status Suhu | Otomatis | Normal / Di Luar Standar |
| Tindakan Korektif | Text | Wajib diisi jika status Di Luar Standar |

- Batas: Chiller normal jika 1°C sampai 5°C. Freezer normal jika −18°C atau lebih rendah;
  tepat −18°C termasuk normal.
- Suhu di luar standar tampil merah di layar. **Tidak ada email alert instan**; kejadiannya
  dimuat di laporan harian dan dashboard.
- Satu record per kombinasi unit + tanggal + waktu cek untuk Opening, Middle, dan Closing.
  Submit kedua untuk kombinasi yang sama ditolak.
- **Cek ulang** boleh dicatat berkali-kali. Dipakai setelah suhu di luar standar, untuk
  membuktikan tindakan korektifnya berhasil. Setelah isian di luar standar terkirim,
  aplikasi menawarkan "Catat cek ulang" untuk unit itu.
- Laporan harian PDF dan tab Harian menyusun satu baris per unit dengan kolom Opening,
  Middle, Closing. Cek ulang ditulis di bawah baris unitnya, lengkap dengan jamnya.

### 5.3 Form Prep List dan Resep

Prep mengubah bahan menjadi barang jadi, misalnya bahan menjadi sauce atau beras menjadi
nasi. Hubungan itu disimpan sebagai **resep**, dan Prep List yang dikirim langsung
menggerakkan stock.

**Master Resep (diisi Pengelola di Pengaturan → Resep):**

| Yang diisi | Keterangan | Contoh |
|---|---|---|
| Item hasil | Barang jadi. Harus terdaftar di `M_Item` dengan satuannya sendiri. | Sauce bolognese (liter) |
| Hasil per 1 resep | Berapa banyak barang jadi dari satu resep | 5 liter |
| Bahan per 1 resep | Daftar item bahan dan jumlahnya, masing-masing dalam satuan dasar bahan itu | Tomat 3 kg, daging giling 1 kg, bawang 0,5 kg |
| Masa simpan (opsional) | Berapa hari barang jadi masih baik dipakai sejak dibuat | 3 hari |
| Catatan (opsional) | 30 Oktober 2026. Teks untuk juru masak, paling panjang 200 huruf, tampil di Prep List di bawah bahan. Tidak menggerakkan stock apa pun. | Air 1,2 liter per 1 kg beras |

Contoh lain: resep Nasi putih, hasil 2,2 kg nasi, bahan beras 1 kg. Air tidak dicatat sebagai bahan,
karena tidak punya stock (stock-nya akan selalu minus); takarannya ditulis di Catatan. Angka pada contoh
hanya ilustrasi; Pengelola mengisinya dari takaran dapur sendiri.

- Barang jadi boleh menjadi bahan resep lain, misalnya sauce dipakai di resep lain.
- Resep tidak boleh melingkar: jika A adalah bahan B, B tidak boleh menjadi bahan A, baik
  langsung maupun lewat resep lain. Server menolaknya.
- Satu item hasil hanya punya satu resep aktif.
- Jika Harga Satuan barang jadi dikosongkan, sistem menghitungnya dari harga bahan satu
  resep dibagi hasil per resep, memakai harga bahan yang berlaku pada tanggal yang dinilai
  (Bagian 5.1). Harga ini dipakai untuk estimasi kerugian waste.

**Form Prep List:**

| Field | Tipe | Keterangan |
|---|---|---|
| Tanggal | Date | Header, default hari ini |
| Shift | Dropdown | Header. Pagi / Siang / Malam |
| Nama Staff | Otomatis | Dari login PIN |
| Item / Menu Prep | Dropdown | Per baris, dari `M_Item` |
| Jumlah Resep | Number | Per baris, untuk item yang punya resep. Boleh pecahan: ½, 1, 1½, 2, dan seterusnya. |
| Hasil | Otomatis | Hasil Aktual jika diisi; selain itu Jumlah Resep × Hasil per 1 Resep (hasil menurut resep), dalam satuan item hasil. Inilah yang menambah stock. |
| Hasil Aktual | Number (opsional) | 18 Oktober 2026. Per baris beresep: yang benar-benar jadi, misalnya setelah ditimbang. 0 atau lebih; kosong berarti sama dengan hasil menurut resep. |
| Baik Sampai | Otomatis | Tanggal prep + masa simpan. Kosong jika resep tidak punya masa simpan. |
| Qty | Number | Hanya untuk item tanpa resep, dalam satuan item itu |
| Keterangan | Text (opsional) | Per baris |

**Yang terjadi saat Prep List dikirim (item yang punya resep):**

1. Stock item hasil **bertambah** sebesar Hasil (hasil aktual jika dicatat). Ini tampil di kolom Hasil
   Prep pada Stock Inventory.
2. Stock tiap bahan **berkurang** sebesar Jumlah Resep × Qty per 1 Resep. Ini tampil di
   kolom Dipakai Prep.
3. Bahan yang terpakai dicatat per baris di `Data_PrepBahan`, memakai resep yang berlaku
   saat itu. Mengubah resep di kemudian hari tidak mengubah catatan lama.

Contoh: ½ resep Sauce bolognese menambah 2,5 liter sauce, dan mengurangi tomat 1,5 kg,
daging giling 0,5 kg, serta bawang 0,25 kg.

- **Pesan sesudah dikirim** (30 Oktober 2026): layar menyebut stock tiap item hasil sesudah dicatat
  menurut server ("Stock bertambah: Sauce bolognese +2,5 liter (sekarang 7,5 liter)"), bahwa hasil prep
  sudah tercatat di form Stock sehingga tidak perlu diisi lagi di Tambah masuk (supaya tidak terhitung
  dua kali), dan item tanpa resep yang stock-nya tidak bergerak. Saat kiriman masuk antrean HP, layar
  menulis perkiraannya ("Sesudah terkirim, stock bertambah: …").

- **Item tanpa resep** tetap bisa dicatat di Prep List dengan Qty biasa. Stock tidak bergerak.
- **Stock bahan tidak cukup menurut catatan:** layar menampilkan peringatan, tetapi prep
  tetap bisa dikirim. Stock Akhir bahan itu menjadi minus dan ditandai di Riwayat.
- **Hasil aktual** (18 Oktober 2026): bahan tetap berkurang menurut resep, tetapi stock barang
  jadi bertambah sebesar hasil aktual jika diisi, sehingga susut atau lebih dari takaran tidak
  menumpuk sebagai selisih opname. Layar, Riwayat, laporan PDF, dan kartu stok menampilkan hasil
  menurut resep sebagai pembanding; rekap bulanan menulis persentase hasil aktual terhadap resep.
  Pengelola bisa mengisi, mengubah, atau mengosongkan hasil aktual lewat koreksi Riwayat. Jika
  hasil nyata selalu berbeda, Pengelola tetap sebaiknya memperbaiki Hasil per 1 Resep.

**Masa simpan barang jadi dan barang masuk:**

- Saat prep dikirim, layar menampilkan tanggal "Baik sampai", untuk ditulis di label wadah.
- Barang masuk (keputusan pemilik 19 Oktober 2026): item boleh punya "Masa simpan (hari)" di
  Pengaturan → Item (misalnya ayam 3 hari). Saat Stock Masuk diisi, "Baik sampai" terisi tanggal
  masuk + masa simpan dan boleh diubah (misalnya mengikuti tanggal di kemasan). Staff tidak perlu
  mengetik tanggal. Item tanpa masa simpan tidak punya kolom ini. Pengelola bisa mengoreksi atau
  mengosongkan "Baik sampai" lewat Riwayat (Bagian 6.3). Barang jadi yang dibeli jadi (Stock
  Masuk) memakai masa simpan item; hasil prep tetap memakai masa simpan resepnya.
- Sistem tidak melacak tiap wadah atau tiap kiriman. Ia memperkirakan dengan anggapan yang datang
  atau dibuat lebih dulu dipakai lebih dulu: stock yang tersisa dianggap berasal dari prep dan
  barang masuk paling baru.
- Jika stock tersisa masih mencakup prep atau barang masuk yang sudah lewat tanggal "Baik
  sampai", item itu masuk daftar **Lewat masa simpan**, lengkap dengan perkiraan jumlahnya. Yang
  habis masa simpannya besok masuk daftar **Habis besok**.
- Kedua daftar tampil di Beranda untuk semua role dan di email harian. Dari daftar itu ada
  jalan pintas "Catat sebagai waste" dengan kategori Expired sudah terpilih.

### 5.4 Form Pencatatan Waste

| Field | Tipe | Keterangan |
|---|---|---|
| Tanggal | Date | Header |
| Shift | Dropdown | Header. Pagi / Siang / Malam |
| Nama Staff | Otomatis | Dari login PIN |
| Item / Produk | Dropdown | Per baris, dari `M_Item` |
| Kategori Waste | Dropdown | Expired / Rusak / Sisa Produksi / Kesalahan Order / Lainnya |
| Qty | Number | Per baris |
| Satuan | Otomatis | Dari `M_Item` |
| Alasan / Keterangan | Text | Wajib jika kategori "Lainnya" |
| Harga Satuan (Rp) | Otomatis | Harga yang berlaku pada **tanggal waste** (bukan hari ini, Bagian 5.1), disalin saat dicatat. Sesudahnya tidak berubah lagi walau riwayat harga diubah kemudian. |
| Estimasi Kerugian (Rp) | Otomatis | Qty × Harga Satuan |
| Foto Bukti | File (opsional) | Disimpan ke Drive, link dicatat di Sheet |

Waste tidak memicu email. Totalnya dimuat di laporan harian dan dashboard. Waste yang
dikirim **langsung mengurangi stock** item itu dan tampil di kolom Waste pada Stock Inventory.

**Waste per porsi menu** (29 Oktober 2026, semua role): menu yang terbuang, misalnya salah order
atau dikembalikan pelanggan, dicatat di form yang sama lewat "Tambah menu": pilih menu aktif dari
`M_Menu` (Bagian 5.9), jumlah **porsi** (bilangan bulat 1–1.000), kategori waste (Kesalahan Order
terpilih lebih dulu; makanan yang dikembalikan boleh Lainnya dengan alasannya), alasan, dan foto
bukti seperti baris item. Satu kiriman boleh berisi item dan menu.
- Disimpan di `Data_Waste` satu baris per menu: Item / Produk = nama menu, Qty = porsi, Satuan
  "porsi", Harga Satuan = HPP per porsi menu pada tanggal waste (termasuk bahan kecil %; kosong jika
  ada bahan tanpa harga), Estimasi Kerugian = porsi × HPP, dan kolom **Menu** berisi "Ya" (kosong
  untuk baris item; kolom ditambahkan `setupSpreadsheet`).
- **Tidak mengurangi stock.** Bahan menu itu sudah keluar dari stock saat dimasak (Stock Keluar, atau
  Hitung sisa), jadi mengurangi lagi akan menghitungnya dua kali. Baris menu tidak ikut rekap
  `Stock_Harian`, kartu stok, dan catatan stock item (item yang bernama sama dengan menu tidak
  terpengaruh).
- Koreksi di Riwayat sama dengan baris item (kategori, porsi bilangan bulat, alasan; estimasi
  dihitung ulang dari HPP yang tercatat). Nama menu di Riwayat tidak membuka riwayat item.
- Ikut total waste di Dashboard, email, PDF, Sheets, dan rekap bulanan (satuan "porsi"). Nama menu
  yang diganti kemudian tidak mengubah baris waste lama.

**Nominal rupiah hanya untuk Pengelola** (keputusan pemilik 17 Oktober 2026). Staff tidak
melihat harga satuan dan estimasi kerugian: layar Waste, Riwayat Waste, dan PDF Waste yang
diunduh Staff tidak memuat kolom rupiah, dan server tidak mengirim angkanya ke Staff.
`Data_Waste` tetap menyimpan keduanya untuk kiriman Staff; email harian, PDF di Drive, Sheets,
Dashboard, dan rekap bulanan tetap lengkap.

### 5.5 Form Stock Inventory Harian

Stock tidak wajib dihitung fisik setiap hari. Setiap gerakan barang dicatat sekali, di form
asalnya, dan Stock Akhir dihitung sistem. Kecocokannya dengan barang nyata dijaga lewat
stock opname berkala (Bagian 5.7). Sejak 20 Oktober 2026 staff boleh mencatat pemakaian
dengan menghitung sisa (lihat "Hitung sisa" di bawah).

**Yang diisi staff (catatan gerakan, disimpan di `Data_Stock`):**

| Field | Tipe | Keterangan |
|---|---|---|
| Tanggal | Date | Header. Hari ini atau kemarin (Bagian 5.0). |
| Kategori | Dropdown | Header, dari `M_Kategori`, atau "Semua kategori" (20 Oktober 2026): semua item aktif tampil dikelompokkan per kategori. Kiriman tetap satu per kategori (satu `submission_id` per kategori yang diisi), jadi Riwayat, pemeriksaan, dan PDF tetap per kategori. |
| Nama Item | Otomatis | Semua item aktif di kategori itu tampil sebagai baris siap isi. Kotak cari item (20 Oktober 2026) hanya menyaring tampilan; isian item yang tidak tampil tetap ikut terkirim. |
| Stock Masuk | Number | Barang datang. Boleh diketik dalam satuan besar jika item punya (Bagian 5.1). |
| Stock Keluar | Number | Pemakaian langsung yang diketik, **di luar** prep dan waste; atau (Hitung sisa) semua yang berkurang selain prep dan waste yang sudah tercatat, termasuk susut dan barang hilang. |
| Sisa | Number, pilihan | Hitung sisa (20 Oktober 2026): jumlah yang ada sekarang, menggantikan Stock Keluar untuk baris itu. Disimpan di kolom `Sisa Dihitung`; Stock Keluar baris itu dihitung darinya. |
| Pemasok | Dropdown, tidak wajib | Header (18 Oktober 2026), dari `M_Pemasok` yang aktif. Disimpan di baris yang punya Stock Masuk. Sejak 21 Oktober 2026 pilihannya kembali kosong sesudah kiriman, jika tidak ada lagi Tambah masuk di form. |
| Harga Beli | Rupiah, tidak wajib | Per baris yang punya Stock Masuk (18 Oktober 2026): harga per satuan yang diketik (per dus jika masuk dalam satuan besar), disimpan per satuan dasar di kolom `Harga Beli (Rp)`. |
| Baik Sampai | Tanggal, otomatis | Per baris yang punya Stock Masuk, hanya untuk item yang punya masa simpan (19 Oktober 2026): tanggal masuk + masa simpan item, boleh diubah (tidak sebelum tanggal masuk, paling lama 365 hari sesudahnya). |

- **Pemasok dan harga beli** (keputusan pemilik 18 Oktober 2026) boleh diisi semua role dan
  tidak wajib. Harga beli **tidak** langsung mengubah harga satuan: Dashboard Pengelola
  menandai item yang harga beli terakhirnya (31 hari terakhir) berbeda dari harga satuan yang
  berlaku pada tanggal beli. Pengelola memilih "Pakai" (harga beli menjadi harga satuan mulai
  tanggal beli, lewat riwayat harga Bagian 5.1) atau "Abaikan" (disembunyikan sampai pembelian
  berikutnya). Pengelola bisa mengoreksi harga beli lewat Riwayat (Bagian 6.3); pemasok kiriman
  tidak bisa dikoreksi. Nama pemasok hanya bisa diganti selama belum tercatat di barang masuk.
- **Pesanan menunggu** (21 Oktober 2026, semua role, hanya untuk tanggal hari ini): pesanan ke
  pemasok yang dicatat dari Daftar belanja (Bagian 9.2) dan belum datang tampil di form Stock (pemasok
  aktif, paling lama 14 hari). "Isi dari pesanan" mengisi Tambah masuk dengan jumlah pesanan (satuan
  besar jika dipesan dalam satuan besar) dan memilih pemasoknya; staff lalu membetulkan jumlah yang
  benar-benar datang. Item yang Tambah masuk-nya sudah diketik, sudah menunggu kirim di HP itu, sudah
  tidak aktif, atau satuannya berubah dilewati. Ditolak jika form sudah berisi Tambah masuk dari
  pemasok lain atau tanpa pemasok; pesannya menyebut item itu, dan form pindah ke Semua kategori
  supaya item itu terlihat. Pengelola juga bisa menutup pesanan dari kartu ini; Tambah masuk yang
  diisi dari pesanan itu ikut dikosongkan.
  - Barang masuk menyelesaikan pesanan menunggu item itu ("Datang"): yang diisi dari pesanan
    menyelesaikan pesanan itu; selain itu pesanan menunggu paling lama dengan pemasok yang sama, atau
    pemasok mana pun jika kiriman tanpa pemasok, dengan tanggal pesanan tidak sesudah tanggal kiriman
    dan diketuk sebelum barang itu dicatat di HP (kiriman dari antrean bisa sampai jauh sesudahnya).
    Jumlah yang datang tidak dibandingkan dengan jumlah pesanan. Koreksi kiriman sesudahnya tidak
    membuka pesanan lagi.
  - Kiriman tidak pernah ditolak karena pesanannya, supaya kiriman yang menunggu di antrean HP selalu
    bisa terkirim. Barang yang diisi dari pesanan yang ternyata sudah dicatat datang (misalnya dari
    HP lain): Tambah masuk baris itu tidak dicatat, supaya tidak masuk dua kali, dan aplikasi
    menyebutnya; baris lain kiriman itu tetap tercatat. Pesanan yang sudah ditutup, atau diganti
    pesanan ke pemasok lain: barangnya dicatat masuk seperti biasa. Pesanan yang diganti pesanan baru
    dari pemasok yang sama: pesanan baru itu yang dipakai. Mengosongkan Tambah masuk lalu meninggalkan
    kolomnya melepas tautannya (diketik lagi = kiriman lain); membetulkan angkanya tidak.
- **Hitung sisa** (20 Oktober 2026, semua role, pilihan per pengguna "Catat pemakaian: Tambah
  keluar / Hitung sisa", **hanya untuk tanggal hari ini**): staff mengetik jumlah yang ada
  sekarang. Server menghitung Stock Keluar = Stock Akhir tercatat pada tanggal itu **saat kiriman
  diterima** + Stock Masuk baris itu − Sisa, dan menyimpan sisanya di `Sisa Dihitung`. Jadi Stock
  Akhir saat kiriman diterima sama dengan sisa, walau ada kiriman lain sesudah form dibuka. Prep,
  waste, dan isian tanggal sebelumnya yang dicatat **sesudahnya** tetap mengurangi stock lagi
  (seperti stock opname, Bagian 5.7), jadi catat prep dan waste yang sudah terjadi lebih dulu.
  - Sisa yang sama dengan stock tercatat tetap dicatat (Stock Keluar 0), sebagai tanda sudah dihitung.
  - Sisa yang lebih banyak dari stock tercatat + masuk saat diterima **tidak menolak kiriman**
    (kiriman dari antrean tidak boleh macet dan barang masuknya hilang): Stock Keluar baris itu 0,
    sisanya tidak disimpan, barang masuk di baris itu tetap tercatat, dan HP menulis bahwa sisa itu
    tidak dicatat. Meluruskan stock tetap lewat penyesuaian atau opname Pengelola (Bagian 5.7).
  - Di HP, sisa yang tampak lebih banyak dari stock yang dimuat hanya peringatan, karena stock di
    HP bisa sudah basi; server yang memutuskan.
  - Susut, tumpah, dan barang hilang yang tertangkap Hitung sisa tercatat sebagai Stock Keluar,
    jadi tidak muncul lagi sebagai penyesuaian, selisih opname, atau selisih stock di HPP (masuk
    ke "terpakai", Bagian 5.9).
  - Koreksi Stock Masuk baris hitung sisa (Bagian 6.3) menggeser Stock Keluar sebesar selisihnya,
    supaya Stock Akhir tetap sama dengan sisa; jika Stock Keluar menjadi minus, Stock Keluar 0 dan
    sisanya dikosongkan. Koreksi Stock Keluar langsung mengosongkan sisanya (bukan hasil hitung lagi).
  - Kiriman yang menunggu di antrean HP dihitung dari stock saat sampai di server. Sisa yang diketik
    dan belum dikirim sampai esok hari dibuang dari draft di HP, karena sisa hanya berlaku saat dihitung.
- **Boleh dikirim berkali-kali sehari.** Tiap kiriman adalah catatan gerakan tersendiri dan
  **menambah**, tidak menimpa kiriman sebelumnya. Contoh: barang datang pagi 5 kg dan sore
  3 kg, lewat dua kiriman, menjadi Masuk 8 kg pada hari itu.
- Item yang Masuk dan Keluar-nya (atau Sisa-nya) dikosongkan tidak ikut terkirim.
- Jika salah ketik, staff membetulkannya sendiri lewat Riwayat dalam 15 menit; sesudah itu
  staff melaporkannya dan Pengelola mengoreksi catatan gerakan itu (Bagian 6.3). Staff tidak
  mengirim angka minus untuk membatalkan.

**Rekap harian per item (dihitung server, disimpan di `Stock_Harian`):**

| Kolom | Asal |
|---|---|
| Stock Awal | Stock Akhir pada rekap terakhir item itu. Item baru mulai dari nol sampai Pengelola mengisi stok pembuka (Bagian 5.7). |
| Stock Masuk | Jumlah semua Masuk dari form Stock pada tanggal itu |
| Hasil Prep | Barang jadi yang dihasilkan Prep List pada tanggal itu |
| Stock Keluar | Jumlah semua Keluar dari form Stock pada tanggal itu |
| Dipakai Prep | Bahan yang terpakai oleh Prep List pada tanggal itu |
| Waste | Total dari Form Waste pada tanggal itu |
| Penyesuaian | Dari stock opname atau penyesuaian Pengelola; bisa plus atau minus |
| Stock Akhir | Awal + Masuk + Hasil Prep − Keluar − Dipakai Prep − Waste + Penyesuaian |
| Satuan | Satuan dasar dari `M_Item` |

- **Satu rekap per tanggal + item**, ditulis server sebagai angka, bukan rumus. Rekap
  dihitung ulang setiap ada gerakan baru atau koreksi, hanya untuk item yang terkait, mulai
  dari tanggal yang berubah sampai rekap terakhir item itu.
- **Rekap bisa dibuat oleh form mana pun.** Prep List, Waste, atau penyesuaian yang dikirim
  langsung membuat atau memperbarui rekap item terkait, walau form Stock belum diisi hari itu.
- **Rekap terakhir, bukan selalu kemarin.** Jika suatu hari terlewat, Stock Awal diambil
  dari Stock Akhir pada tanggal terakhir item itu punya rekap.
- **Item yang tidak bergerak** pada suatu hari tidak punya rekap untuk hari itu; stock-nya
  tetap sama dengan rekap terakhir.
- **Tersusun per kategori.** Di form, staff memilih satu kategori atau Semua kategori. Di form
  Semua kategori, tab Harian, dan PDF, item dikelompokkan di bawah judul kategorinya. Kategori
  dikelola Pengelola.
- **Yang tampil di layar isi** untuk tiap item: Stock Awal, yang sudah tercatat hari ini
  (Masuk, Keluar, Hasil Prep, Dipakai Prep, Waste), dan Stock Akhir sementara yang berubah
  saat staff mengetik.
- **Peringatan di layar:** Stock Akhir minus. Itu tanda salah ketik, gerakan yang belum
  dicatat, atau stock yang perlu diluruskan. Isian tetap bisa dikirim, dan barisnya
  ditandai di Riwayat.
- Item dengan Stock Akhir di bawah Stok Minimum (`M_Item`) ditandai "perlu reorder".
- Form kertas tidak punya kolom staff atau shift, dan form web juga tidak menampilkannya.
  Siapa yang mengisi tetap tercatat otomatis di `submitted_by`.

### 5.6 Form Kustom (dibuat Pengelola)

Pengelola bisa menambah form sendiri dari Pengaturan → Form tanpa mengubah kode, misalnya
checklist kebersihan atau catatan penerimaan barang.

**Yang bisa dilakukan Pengelola:**

| Tindakan | Form bawaan (Stock, Suhu, Prep List, Waste) | Form kustom |
|---|---|---|
| Mengganti nama form | Ya | Ya |
| Menyembunyikan atau menampilkan form | Ya | Ya |
| Mengubah urutan form di Beranda | Ya | Ya |
| Menambah, mengubah, dan menghapus kolom | Tidak. Kolomnya terikat pada hitungan otomatis. | Ya |
| Menghapus form | Tidak, hanya bisa disembunyikan | Ya |

**Susunan form kustom:**

- Nama form dan keterangan singkat.
- **Kolom kepala** (opsional): diisi sekali per isian, misalnya shift atau area.
- **Kolom baris:** diisi berulang, satu baris per butir, seperti tabel di form kertas.
- Tanggal dan nama pengisi selalu ada otomatis dan tidak perlu dibuat.
- Tiap kolom punya label, jenis, dan tanda wajib atau opsional.

| Jenis kolom | Isi | Contoh pemakaian |
|---|---|---|
| Teks | Tulisan bebas | Catatan, nama pemasok |
| Angka | Bilangan, boleh desimal | Jumlah, berat |
| Pilihan | Satu dari daftar yang ditulis Pengelola | Kondisi: Baik / Rusak |
| Ya/Tidak | Centang | Checklist kebersihan |
| Item | Dipilih dari `M_Item`; satuan ikut otomatis | Barang yang diterima |
| Jam | Waktu | Jam pengecekan |

- Batas: paling banyak 10 form kustom dan 15 kolom per form.

**Yang otomatis didapat form kustom:** tiket di Beranda, layar isi (kartu di HP, tabel di
laptop/desktop), draft dan antrean offline, kolom sistem, menu Riwayat, Laporkan
Kekeliruan, koreksi dengan jejak perubahan, "Diperiksa oleh", laporan PDF, serta status
sudah atau belum diisi di email harian.

**Yang tidak didapat:** hitungan otomatis antar kolom, tab Harian, dan grafik di
Dashboard. Form kustom hanya masuk blok Kepatuhan (sudah diisi atau belum, sudah diperiksa
atau belum).

**Penyimpanan:**

- Definisi form di `M_Form` dan `M_FormKolom`.
- Data tiap form kustom di tab sendiri, `Data_K_<ID Form>`, yang dibuat server secara
  otomatis saat form dibuat. Susunannya sama dengan tab Data lain: kolom form di kiri,
  kolom sistem di kanan.

**Aturan perubahan, agar data lama tidak rusak:**

| Perubahan | Akibat |
|---|---|
| Menambah kolom | Kolom baru muncul di kanan; isian lama kosong di kolom itu |
| Mengganti label kolom | Boleh kapan saja |
| Mengganti jenis kolom | Tidak bisa setelah form punya isian |
| Menghapus kolom | Kolom hilang dari layar isi; isian lamanya tetap ada di spreadsheet dan Riwayat |
| Menghapus form | Form hilang dari website; tab datanya tetap ada di spreadsheet dengan tanda arsip, dan bisa dipulihkan Pengelola |

**Jadwal form.** Tiap form kustom punya jadwal: harian, hari tertentu dalam seminggu, atau
sewaktu-waktu. Jadwal menentukan kapan form ditagih di Beranda dan email harian
(Bagian 5.8). Form sewaktu-waktu tidak pernah ditagih.

### 5.7 Penyesuaian Stock dan Stock Opname

Stock dihitung dari catatan, jadi angkanya bisa menyimpang dari barang nyata: pemakaian
yang lupa dicatat, takaran yang tidak pas, tumpah, atau susut. Dua alat berikut
meluruskannya. Keduanya hanya untuk Pengelola. (Hitung sisa di form Stock, Bagian 5.5, juga
menyamakan stock dengan barang nyata, tetapi selisihnya tercatat sebagai Stock Keluar, bukan
penyesuaian.)

**Penyesuaian stock (satu item):**

- Pengelola membuka item dari Riwayat per item, lalu mengisi "Stock sebenarnya". Server
  menghitung selisihnya terhadap stock tercatat dan menyimpannya sebagai gerakan
  Penyesuaian, plus atau minus.
- Alasan wajib dipilih: Stok pembuka / Hasil hitung ulang / Lainnya (dengan catatan).
- **Stok pembuka.** Sebelum sistem mulai dipakai, dan setiap kali menambah item baru,
  Pengelola mengisi stock nyata item itu dengan alasan "Stok pembuka".
- Penyesuaian adalah gerakan baru pada tanggalnya. Rekap hari-hari sebelumnya tidak diubah.
- Disimpan di `Data_Penyesuaian`: tanggal, item, stock tercatat, stock sebenarnya,
  selisih, nilai selisih (Rp), alasan, catatan, dan kolom sistem.
- **Nilai selisih (Rp)** penyesuaian dan opname = selisih × harga yang berlaku pada tanggal
  penyesuaian atau opname (Bagian 5.1), disalin saat dicatat seperti waste: tidak berubah lagi
  walau riwayat harga diubah kemudian.

**Stock opname (banyak item sekaligus):**

1. Pengelola membuka Stock opname dan memilih satu kategori atau semua kategori.
2. Aplikasi menampilkan daftar item beserta stock tercatat. Pengelola menghitung barang
   nyata dan mengisi "Hasil hitung". Item yang dikosongkan dianggap tidak dihitung.
3. Layar ringkasan menampilkan item yang berselisih, selisih jumlahnya, dan nilainya (Rp).
4. Setelah disimpan, server menghitung selisih terhadap stock tercatat **saat itu**,
   membuat Penyesuaian beralasan "Stock opname" untuk tiap item yang berselisih, dan
   mencatat seluruh hasil hitung di `Data_Opname`.

- **Jadwal:** mingguan (bawaan) atau bulanan, diatur di Pengaturan. Jika opname terakhir
  sudah lewat jadwal, pengingat muncul di Beranda Pengelola dan di email harian.
- **Waktu yang tepat:** sebelum opening atau setelah closing, saat tidak ada barang
  bergerak, supaya hasil hitung tidak tertukar dengan gerakan yang belum dicatat.
- Isian opname tersimpan sebagai draft di perangkat; menyimpannya butuh sinyal.
- **Laporan selisih:** tiap opname menghasilkan PDF berisi stock tercatat, hasil hitung,
  selisih, dan nilainya per item. Dashboard menampilkan nilai selisih tiap opname dan item
  yang paling sering berselisih. Selisih yang terus berulang pada item yang sama menunjuk
  ke pencatatan yang bocor atau takaran resep yang perlu dibetulkan.

### 5.8 Kelengkapan Form dan Tanda Nihil

Aturan ini menentukan kapan sebuah form dianggap sudah diisi pada suatu hari. Dipakai oleh
tiket di Beranda, email harian, blok Kepatuhan di dashboard, dan rekap bulanan.

| Form | Dianggap lengkap pada suatu hari jika |
|---|---|
| Stock Inventory | Ada minimal satu kiriman, atau ditandai nihil |
| Suhu | Semua unit aktif punya isian Opening, Middle, dan Closing. Cek ulang tidak dihitung. |
| Prep List | Ada minimal satu kiriman, atau ditandai nihil |
| Waste | Ada minimal satu kiriman, atau ditandai nihil |
| Form kustom | Pada hari yang sesuai jadwalnya: ada minimal satu kiriman, atau ditandai nihil |

- **Tanda nihil.** Tombol "Tidak ada hari ini" di layar isi form mencatat bahwa form itu
  memang kosong pada tanggal tersebut, misalnya tidak ada waste. Semua role bisa menekannya.
  Dicatat di `Data_Nihil`: tanggal, form, siapa, dan kapan.
- Tanda nihil batal sendiri jika kemudian ada kiriman untuk form dan tanggal itu.
- Suhu tidak punya tanda nihil.
- Tiket Suhu menampilkan kemajuannya, misalnya "7 dari 9 pengecekan".
- **Kemajuan hari ini** di kepala Beranda: jumlah form yang lengkap dari jumlah form yang
  wajib hari itu, misalnya "1 dari 4 form terisi". Yang dihitung wajib: form bawaan dan
  form kustom yang tampil dan dijadwalkan untuk hari itu. Form kustom berjadwal
  "Sewaktu-waktu", form di luar jadwalnya, dan form yang disembunyikan tidak dihitung.

**Hari libur** (keputusan pemilik 22 Oktober 2026). Pengelola menandai tanggal dapur tutup di
Pengaturan → Hari libur, satu tanggal per tindakan: hari ini, tanggal yang sudah lewat (yang
belum diarsip), atau paling jauh setahun ke depan, misalnya Lebaran. Tidak ada hari tutup tetap
per minggu. Tanda disimpan di `M_HariLibur` (satu baris per tanggal, keterangan tidak wajib) dan
bisa dihapus; penghapusannya tercatat di `Log_Perubahan`. Staff tidak bisa menandai atau menghapus.

- Pada hari libur **tidak ada form yang ditagih**: form bawaan, form kustom harian, dan form
  kustom yang hari itu dijadwalkan. Tidak ada yang dihitung belum lengkap di Beranda, Dashboard,
  email, blok Kepatuhan di tab Dashboard, dan rekap bulanan, dan tidak ada pengecekan suhu yang
  terlewat (Bagian 6.1).
- Isian yang tetap dikirim pada hari libur diterima seperti biasa, tetap terlihat (Terkirim,
  Nihil, atau sebagian), dan tetap perlu diperiksa. Tanda nihil tetap boleh.
- Kemajuan hari ini di Beranda bertuliskan "Hari libur" (dengan keterangannya). Pengelola melihat
  hari libur hari ini dan besok di Beranda, supaya tanggal yang salah masih bisa dihapus.
- Tanggal yang sudah punya isian boleh ditandai libur; isiannya tetap tersimpan.
- Menandai atau menghapus hari libur pada tanggal yang sudah lewat mengubah Kepatuhan, food cost,
  dan rekap yang dibuat sesudahnya, bukan email atau rekap yang sudah terkirim.
- Penjualan hari libur tidak perlu dicatat (Bagian 5.9). Email harian dan pengingat cek suhu ke
  HP tidak dikirim (Bagian 10 dan 10.1).

### 5.9 Menu, HPP, dan Food Cost (Pengelola)

Keputusan pemilik 17 Oktober 2026. Pengelola melihat dua hal: berapa persen penjualan yang
habis untuk bahan (**food cost**), dan berapa biaya bahan tiap menu (**HPP per porsi**).
Semuanya khusus Pengelola dan diperiksa di server.

**Master dan data:**

| Sheet | Kolom | Keterangan |
|---|---|---|
| `M_Menu` | Nama Menu, Harga Jual (Rp), Aktif | Harga jual tanpa pajak dan service |
| `M_MenuBahan` | Nama Menu, Item Bahan, Qty per Porsi, Hasil Bersih (%) | Takaran bersih per porsi; Hasil Bersih kosong = 100% |
| `Data_Penjualan` | Tanggal, Penjualan (Rp), Catatan, ditambah kolom sistem Bagian 5.0 | Satu baris per tanggal |
| `Data_PenjualanMenu` | Tanggal, Nama Menu, Porsi, Harga Jual (Rp), ditambah kolom sistem Bagian 5.0 | Satu baris per menu per tanggal; harga jual tersalin saat dicatat |
| `M_Konfigurasi` | `target_food_cost` (persen, awal 35), `bahan_kecil_persen` (persen, awal 3) | Diubah dari Pengaturan → Outlet dan jadwal |

**Aturan menu:**

- Menu bukan item stock: tidak punya stock, tidak tampil di form mana pun, dan tidak
  menggerakkan stock. Stock tetap berkurang lewat Stock Keluar dan Prep List.
- Bahan menu boleh bahan mentah atau barang jadi. Barang jadi yang harganya kosong memakai
  harga dari resepnya (Bagian 5.3).
- **Takaran bersih** = yang masuk ke piring, dalam satuan dasar bahan, tanpa konversi (0,18 kg,
  bukan 180 gr).
- **Hasil bersih (%)** per baris bahan: bagian yang tersisa setelah dikupas, dibuang tulang,
  atau dibersihkan; di atas 0 sampai 100, satu angka di belakang koma, kosong berarti 100.
  Diisi per baris menu, bukan per item, karena bahan yang sama bisa disiapkan berbeda. Barang
  jadi tidak punya isian ini: susutnya sudah tercakup di "Hasil per 1 resep".
- **Bahan kecil:** bumbu, minyak, dan garnish yang sulit ditakar per porsi ditambahkan sebagai
  satu persen untuk semua menu (0 sampai 15%). Bahan yang memang ditakar boleh tetap ditulis
  sebagai bahan biasa.
- **Kemasan bungkus:** item biasa. Versi bungkus dibuat dengan "Salin menu", misalnya
  "Chicken steak (bungkus)", dengan harga jualnya sendiri.
- Harga jual tidak punya riwayat; perubahan harga jual dan nama menu tercatat di `Log_Perubahan`.
- Nama menu unik dan boleh diganti. Menu tidak dihapus, hanya dinonaktifkan; mengaktifkan
  lagi ditolak jika ada bahan yang nonaktif.
- Biaya operasional (gas, listrik, sewa, gaji) **tidak** masuk HPP per porsi: biaya itu tetap per
  bulan, jadi bagiannya per porsi berubah setiap kali jumlah porsi terjual berubah.

**Rumus HPP per porsi** (harga bahan yang berlaku pada tanggal yang dinilai, Bagian 5.1):

- Biaya bahan = jumlah (takaran bersih ÷ hasil bersih × harga bahan)
- HPP per porsi = biaya bahan × (1 + bahan kecil %)
- Food cost menu = HPP per porsi ÷ harga jual × 100%
- Margin kotor = harga jual − HPP per porsi
- Harga jual untuk target = HPP per porsi ÷ target, dibulatkan ke atas ke Rp 100
- Jika satu bahan belum punya harga, HPP menu itu "belum lengkap" dan tidak dihitung.
- Menu di atas target ditandai Perlu ditinjau.

**Food cost per bulan:**

- Periode satu bulan kalender. Bulan berjalan dihitung sampai kemarin (hari ini belum closing).
- **Pemakaian bahan** = jumlah per hari, untuk item yang bukan hasil resep aktif:
  (Stock Keluar + Dipakai Prep − Hasil Prep) + Waste − Penyesuaian, × harga yang berlaku hari
  itu. Dirinci menjadi terpakai (keluar dan prep), waste bahan, dan selisih stock (opname dan
  penyesuaian; stock yang hilang menambah pemakaian, stock yang ternyata lebih menguranginya).
- Penyesuaian beralasan **Stok pembuka** tidak dihitung sebagai selisih stock: barang itu sudah
  ada sebelum dicatat.
- Barang jadi tidak dihitung lagi, karena biayanya terhitung saat bahannya dipakai prep. Waste
  barang jadi (estimasi yang tercatat) hanya ditampilkan sebagai keterangan. Akibatnya barang jadi
  yang masih tersisa di akhir bulan sudah dihitung sebagai pemakaian bulan itu.
- Waste per porsi menu (Bagian 5.4, 29 Oktober 2026) juga hanya keterangan: bahannya sudah termasuk
  di terpakai, karena tercatat keluar saat dimasak.
- **Cek silang:** nilai stock bahan awal + nilai barang masuk + stok pembuka − nilai stock bahan
  akhir + selisih karena perubahan harga (Bagian 8.5) = pemakaian bahan. Jika berbeda (bahan tanpa
  harga pada sebagian hari), selisihnya disebut.
- Bahan tanpa harga pada suatu hari tidak dihitung untuk hari itu dan namanya disebut.
- **Food cost %** = pemakaian bahan ÷ penjualan × 100%. Dihitung hanya jika setiap hari dalam
  periode punya catatan penjualan, kecuali hari libur (Bagian 5.8) yang tidak dicatat: hari itu
  dianggap Rp 0 dan disebut terpisah ("25 dari 25 hari tercatat · 2 hari libur"). Penjualan yang
  tetap dicatat pada hari libur ikut dihitung. Hari tutup yang tidak ditandai libur dicatat Rp 0.
  Jika ada yang kosong, food cost tidak ditampilkan dan tanggalnya disebut. Pemakaian bahan pada
  hari libur tetap dihitung.
- **Food cost sementara** (28 Oktober 2026): selama penjualan belum lengkap, perkiraan dari hari
  yang penjualannya sudah tercatat saja: pemakaian bahan pada hari-hari itu ÷ penjualan hari-hari
  itu × 100%, supaya keduanya sebanding (pemakaian pada hari tanpa catatan penjualan, misalnya
  waste atau opname, tidak ikut). Selalu ditandai "sementara" dan tidak menggantikan food cost:
  begitu semua hari tercatat, food cost dihitung seperti di atas dan angka sementara hilang. Tidak
  ada angka sementara jika belum ada penjualan yang tercatat pada bulan itu. Tampil di layar HPP
  (kepala dan grafik 6 bulan), Dashboard, rekap bulanan, dan email rekap.
- Rincian: per kategori item, 10 bahan dengan pemakaian terbesar, dan food cost 6 bulan sampai
  bulan yang dipilih.

**Penjualan:**

- Dicatat Pengelola: satu angka per tanggal, total penjualan sebelum pajak dan service dari
  kasir. Hari ini atau tanggal yang sudah lewat; masa depan ditolak. Butuh sinyal.
- Menyimpan tanggal yang sudah punya catatan menimpa angkanya; perubahannya tercatat di
  `Log_Perubahan`.
- Pengingat di Dashboard ("Perlu perhatian", Menunggu): hari bulan lalu dan bulan ini sampai kemarin
  yang belum punya catatan penjualan, dihitung mulai penjualan pertama yang pernah dicatat, supaya
  tidak ada pengingat sebelum fitur ini dipakai. Hari libur tanpa catatan penjualan tidak diingatkan.
  Bulan lalu ikut diperiksa (31 Oktober 2026): pada tanggal 1 "kemarin" ada di bulan lalu, dan food
  cost bulan lalu baru lengkap setelah semua harinya tercatat. Hari dua bulan lalu atau lebih tidak
  diingatkan lagi. Jika daftar memuat dua bulan, tanggal dan kalimat food cost menyebut nama
  bulannya: "Tanggal 31 Oktober serta 1 dan 2 November. Food cost Oktober dan bulan ini dihitung
  setelah semua hari tercatat."
- Kasir outlet buatan sendiri; angkanya diketik dari laporan kasir harian.

**Penjualan per menu dan pemakaian seharusnya** (keputusan pemilik 17 Oktober 2026):

- Bersama penjualan harian, Pengelola mengetik **porsi terjual per menu** (bilangan bulat 0 atau
  lebih) di lembar yang sama. Kosong berarti belum dicatat; 0 berarti tidak terjual. Menu yang
  tidak diisi tidak berubah. Menimpa porsi yang sudah ada tercatat di `Log_Perubahan`. Total
  penjualan (Rp) tetap diketik sendiri, karena diskon dan promo membuatnya berbeda dari porsi ×
  harga jual; aplikasi hanya menampilkan porsi × harga jual sebagai pembanding.
- **Pemakaian seharusnya** = jumlah per hari (porsi terjual × bahan per porsi × harga yang berlaku
  hari itu), ditambah bahan kecil %. Bahan per porsi = takaran bersih ÷ hasil bersih. Bahan barang
  jadi dipecah menjadi bahan resepnya (qty ÷ hasil per 1 resep × qty bahan, bertingkat), supaya sama
  dengan pemakaian nyata yang menghitung bahan saat dipakai prep. Dipakai resep menu yang berlaku
  sekarang.
- **Seharusnya vs nyata:** dibandingkan dengan pemakaian bahan (di atas) hanya jika setiap hari dalam
  periode punya porsi per menu; hari dengan penjualan Rp 0 (tutup) dan hari libur tanpa catatan
  penjualan tidak perlu (hari libur yang tetap punya penjualan lebih dari 0 perlu porsinya). Selisih = nyata −
  seharusnya; plus berarti bahan terpakai lebih banyak dari porsi yang terjual (bocor, porsi
  berlebih, waste, atau pencatatan keliru). Selisih paling banyak 2% dari seharusnya dianggap sesuai.
  Porsi yang terbuang (waste per porsi menu, nilai HPP yang tercatat) disebut sebagai bagian dari
  selisih, beserta selisih tanpa porsi terbuang.
  Barang jadi yang belum terjual di akhir periode ikut menambah selisih.
- Rincian: bahan menu (seharusnya vs nyata), bahan lain yang tidak ada di menu mana pun (bumbu,
  minyak, garnish) dibanding bahan kecil %, 10 bahan dengan selisih rupiah terbesar (qty seharusnya,
  nyata, selisih), food cost seharusnya, dan porsi terjual per menu.
- Pengingat penjualan di Dashboard ikut menyebut hari yang belum punya porsi per menu, dihitung
  mulai porsi pertama yang pernah dicatat, untuk rentang yang sama (bulan lalu dan bulan ini sampai
  kemarin).
- Menu yang diganti nama membawa catatan porsinya. Porsi menu yang sudah tidak ada di `M_Menu`
  (diubah tangan di Sheet) tidak dihitung dan namanya disebut.

---

## 6. Riwayat, Pemeriksaan, dan Koreksi Data

### 6.1 Menu Riwayat

Tujuan: melihat kembali isian semua form di hari-hari sebelumnya, terutama untuk
menemukan kekeliruan pengisian inventory.

- **Siapa yang bisa membuka:** semua role. Staff hanya melihat. Pengelola juga bisa
  memeriksa dan mengoreksi langsung dari sini.
- **Cakupan:** semua form, termasuk form kustom, dan isian semua pengisi (bukan hanya
  isian sendiri).
- **Filter:**

| Filter | Keterangan |
|---|---|
| Form | Stock Inventory / Suhu / Prep List / Waste / form kustom |
| Tanggal | Satu tanggal atau rentang. Default: 7 hari terakhir. |
| Kategori dan item | Untuk Stock Inventory, Waste, Prep List |
| Unit | Untuk Suhu |
| Pengisi | Nama staff |
| Status | Terkirim / Diperiksa / Dilaporkan keliru / Pernah dikoreksi |

- **Tampilan daftar:** satu baris per submit, berisi tanggal, form, pengisi, jam kirim,
  jumlah baris, status, serta tanda "pernah dikoreksi" dan "dilaporkan keliru". Tanda
  nihil, penyesuaian stock, dan stock opname ikut tampil pada tanggalnya.
- **Tampilan detail:** tabel seperti form aslinya, hanya-baca, lengkap dengan kolom hitung.

**Bantuan untuk menemukan kekeliruan:**

- **Stock Inventory**
  - Riwayat Stock punya dua tampilan: **catatan gerakan** (tiap kiriman, siapa dan
    kapan) dan **rekap harian** per kategori (dari `Stock_Harian`).
  - Stock Akhir yang minus disorot.
  - Stock Masuk yang diketik dalam satuan besar menampilkan angka aslinya, misalnya
    "24 botol (2 dus)".
  - Item dengan Stock Akhir di bawah stok minimum ditandai.
  - **Riwayat per item:** ketuk satu item untuk melihat tabel 7 rekap terakhir item itu
    (Awal, Masuk, Hasil Prep, Keluar, Dipakai Prep, Waste, Penyesuaian, Akhir), sehingga
    hari yang janggal langsung terlihat. Dari sini Pengelola bisa menekan "Sesuaikan stock".
  - **Kartu stok** (18 Oktober 2026): di riwayat per item yang sama, setiap catatan yang
    menggerakkan stock item itu pada hari-hari tersebut (Stock masuk/keluar, hasil prep, bahan
    dipakai prep, waste, penyesuaian, stock opname), urut jam diterima server, dengan siapa yang
    mencatat, keterangan, jumlah masuk atau keluar, dan saldo sesudah transaksi itu. Saldo
    terakhir tiap hari sama dengan Stock Akhir rekapnya. Catatan Stock, Prep List, dan Waste bisa
    dibuka untuk melihat isiannya di Riwayat. Tidak ada data baru: semuanya dibaca dari tab Data.
- **Suhu:** suhu di luar standar tampil merah; waktu cek yang tidak diisi diberi tanda, kecuali pada
  hari libur (Bagian 5.8).
- **Semua form:** baris yang pernah dikoreksi menampilkan nilai lama, siapa yang
  mengubah, dan kapan (diambil dari `Log_Perubahan`).

**Tombol di tampilan detail:**

| Tombol | Staff | Pengelola |
|---|---|---|
| Unduh PDF tanggal tersebut | Ya | Ya |
| Laporkan Kekeliruan | Ya | Ya |
| Koreksi | Isiannya sendiri, 15 menit sesudah dikirim ("Betulkan") | Ya |
| Tandai Diperiksa | Tidak | Ya |

**Catatan teknis:**

- Riwayat butuh sinyal, karena datanya diambil dari server.
- Sekali ambil maksimal 31 hari, supaya tetap cepat di HP.
- Isian yang masih di antrean offline tampil paling atas dengan tanda "menunggu kirim".

### 6.2 Pemeriksaan ("Diperiksa oleh")

Form kertas diakhiri dengan "Diperiksa oleh". Padanannya di web:

1. Staff submit → status **Terkirim**.
2. Head Kitchen atau Manager membuka submit tersebut di menu Riwayat, memeriksa, lalu
   menekan "Tandai Diperiksa" → status **Diperiksa**, `checked_by` dan `checked_at` terisi.
3. Nama pemeriksa dan waktunya tercetak di laporan PDF pada baris "Diperiksa oleh".
4. **Tandai diperiksa sekaligus** (19 Oktober 2026): di daftar Riwayat, judul tiap tanggal punya
   tombol "Tandai diperiksa (n)" untuk Head Kitchen atau Manager. Setelah konfirmasi, semua isian
   form itu pada tanggal itu yang tampil dan belum diperiksa ditandai Diperiksa sekaligus, dengan
   aturan yang sama dengan langkah 2. Isian yang masih punya baris dilaporkan keliru tidak ikut,
   dan isian yang dikirim sesudah daftar dimuat juga tidak ikut. Tombol ini tidak ada selama daftar
   disaring menurut kategori atau item, karena isian hanya tampil sebagian barisnya. Tujuannya
   pemeriksaan harian: Pengelola membaca daftar hari itu, lalu menandainya dalam satu ketukan.

Satu hari bisa punya beberapa kiriman untuk form yang sama. Jika semuanya sudah diperiksa,
PDF mencantumkan pemeriksa terakhir dan waktunya. Jika belum, PDF menulis jumlahnya,
misalnya "2 dari 3 isian diperiksa".

### 6.3 Laporan kekeliruan dan koreksi

- **Staff membetulkan isiannya sendiri** (28 Oktober 2026): selama 15 menit sesudah server
  menerima kiriman (kiriman dari antrean dihitung sejak sampai) dan selama kiriman belum
  diperiksa, pengisinya bisa membetulkan kolom yang sama dengan yang bisa dikoreksi Pengelola,
  dengan aturan yang sama (stock dihitung ulang, `Log_Perubahan` mencatat namanya). Isian orang
  lain tidak bisa dibetulkan, begitu juga baris yang sudah dikoreksi Pengelola. Laporan
  kekeliruan dari rekan pada baris itu tetap ada sampai Pengelola mengoreksi atau menutupnya.
  Batas waktu menjaga angka yang sudah dipakai orang lain (stock, laporan) tidak berubah
  diam-diam. Tandai diperiksa (satu per satu atau sekaligus) tidak menandai isian yang dibetulkan
  sesudah layar Pengelola dimuat; Pengelola memuat ulang dan memeriksanya lagi.
- **Sesudah itu staff tidak bisa mengubah data.** Jika menemukan kekeliruan di Riwayat,
  staff menekan "Laporkan Kekeliruan" pada baris itu dan menulis catatan singkat
  (misalnya "Stock Masuk seharusnya 5, bukan 50"). Baris mendapat tanda "dilaporkan keliru".
- Pengelola melihat semua baris yang dilaporkan lewat filter status, lalu mengoreksinya.
  Tanda hilang setelah baris dikoreksi atau laporan ditutup.
- Pengelola bisa mengoreksi baris kapan pun. Setelah status Diperiksa, baris terkunci
  sampai Pengelola membukanya kembali.
- Setiap koreksi dicatat di sheet `Log_Perubahan`: waktu, siapa, baris mana, nilai lama,
  nilai baru.
- **Yang dikoreksi adalah catatan sumbernya**, bukan rekap: catatan gerakan stock, baris
  Prep List, atau baris Waste. Rekap `Stock_Harian` tidak pernah diubah langsung.
- **Koreksi berantai pada stock.** Stock Akhir satu rekap menjadi Stock Awal rekap
  berikutnya. Setelah catatan sumber dikoreksi, rekap hari itu dan semua rekap sesudahnya
  untuk item terkait dihitung ulang. Koreksi Jumlah Resep memakai resep yang tercatat saat
  prep itu dibuat.
- **Meluruskan stock dengan barang nyata** tidak dilakukan lewat koreksi, tetapi lewat
  Penyesuaian stock atau Stock opname (Bagian 5.7).

---

## 7. Akses, Role, dan Keamanan

### 7.1 Role

| Kemampuan | Staff | Pengelola (Head Kitchen, Manager) |
|---|---|---|
| Mengisi form Stock Inventory, Suhu, Prep List, Waste, dan form kustom yang aktif | Ya | Ya |
| Mengunduh laporan PDF per form | Ya | Ya |
| Meminta reset PIN (Lupa PIN) | Ya | Ya |
| Melihat riwayat semua form (menu Riwayat) | Ya | Ya |
| Melaporkan kekeliruan pada baris data | Ya | Ya |
| Memeriksa/mengesahkan data ("Diperiksa oleh") | Tidak | Ya |
| Menandai form "Tidak ada hari ini" (nihil) | Ya | Ya |
| Melihat daftar lewat masa simpan dan mencatatnya sebagai waste | Ya | Ya |
| Melihat pesanan ke pemasok yang belum datang dan mengisi Tambah masuk darinya (form Stock) | Ya | Ya |
| Mengoreksi data | Isiannya sendiri, 15 menit sesudah dikirim, selama belum diperiksa | Ya |
| Penyesuaian stock dan stock opname | Tidak | Ya |
| Melihat daftar belanja, mengirim pesanan ke pemasok lewat WhatsApp, dan menutup pesanan | Tidak | Ya |
| Melihat nilai rupiah stock dan rekap bulanan | Tidak | Ya |
| Melihat dashboard di aplikasi dan membuka dashboard di Google Sheets | Tidak | Ya |
| Membuat, mengubah, menyembunyikan, dan menghapus form (Pengaturan → Form) | Tidak | Ya |
| Mengganti nama outlet | Tidak | Ya |
| Mengelola staff dan PIN, termasuk menonaktifkan dan menghapus staff | Tidak | Ya |
| Mengatur penerima email | Tidak | Ya |
| Mengelola master data (item, resep, unit, kategori, satuan) dan konfigurasi | Tidak | Ya |
| Menandai dan menghapus hari libur (Pengaturan → Hari libur) | Tidak | Ya |
| Melihat HPP, food cost, dan harga jual menu; mengelola menu; mencatat penjualan | Tidak | Ya |
| Melihat nominal rupiah waste (harga satuan, estimasi kerugian) | Tidak | Ya |

Role diperiksa di **server** pada setiap permintaan, bukan hanya disembunyikan di tampilan.

### 7.2 Login PIN

- PIN terdiri dari 6 angka, dibuat dan direset oleh Manager/Head Kitchen dari halaman
  Pengaturan → Staff.
- **PIN yang terlalu mudah ditebak ditolak** saat PIN dibuat atau direset (termasuk pemasangan
  pertama dan pemulihan): enam angka sama (000000), berurutan naik atau turun (123456, 654321,
  890123), berulang tiap 2 atau 3 angka (121212, 123123), dan beberapa pola umum (112233,
  147258, 159753). PIN lama yang sudah terlanjur seperti itu tetap bisa dipakai login sampai
  direset.
- Staff memilih nama, memasukkan PIN, lalu server mengembalikan token sesi beserta role.
- PIN disimpan sebagai hash, bukan angka aslinya.
- Lima kali salah PIN berturut-turut mengunci akun staff tersebut selama 15 menit.
- **Kunci bertingkat.** Kunci yang ketiga dalam 24 jam berlangsung 24 jam, supaya PIN tidak bisa
  ditebak terus-menerus 5 kali tiap 15 menit. Setelah PIN salah sekali lagi akan mengunci 24 jam,
  layar Login memperingatkannya. Login yang benar menghapus hitungan. Reset PIN oleh Pengelola
  (atau "Pulihkan akses Pengelola") selalu langsung membuka kunci.
- **Akun terkunci terlihat oleh Pengelola**: sebagai pemberitahuan di Beranda dan butir Perlu
  perhatian di Dashboard selama masih terkunci (ketuk untuk membuat PIN baru), dan di email
  harian untuk akun yang terkunci dalam 24 jam terakhir. Akun yang terkunci berulang kali bisa
  berarti ada yang mencoba menebak PIN-nya.
- Token sesi berlaku paling lama 12 jam; setelah habis, staff login ulang.
- **Tombol "Keluar".** Tombol ini mengeluarkan pengguna saat ini dan kembali ke layar
  Login: token dihapus dari perangkat. Tombol tersedia untuk semua role di semua ukuran
  layar (letaknya di spesifikasi tampilan). Draft dan antrean kirim disimpan per pengguna.
  Tombol ini sebelumnya bernama "Ganti pengguna".
- **Keluar otomatis.** Jika aplikasi tidak dipakai selama 5 menit, aplikasi keluar sendiri
  dengan cara yang sama seperti tombol "Keluar", lalu layar Login menampilkan alasannya.
  Aturannya:
  - "Tidak dipakai" berarti tidak ada ketukan, klik, ketikan, atau guliran di aplikasi.
  - Dihitung di perangkat. Saat aplikasi dibuka lagi dari latar belakang atau layar HP
    dinyalakan lagi, aplikasi membandingkan jam sekarang dengan jam terakhir dipakai.
  - Berlaku untuk semua role, dengan atau tanpa sinyal.
  - Hitungan tidak berjalan selama aplikasi sedang mengirim isian atau membuat PDF, dan
    mulai lagi dari nol setelah proses itu selesai.
  - Isian yang sedang diketik tersimpan sebagai draft milik pengguna itu dan tampil lagi
    setelah ia login. Isian di antrean tetap menunggu sesuai aturan di bawah.
  - Lamanya disimpan di `M_Konfigurasi` dan bisa diubah Pengelola dari Pengaturan:
    5, 10, 15, atau 30 menit. Nilai awalnya 5 menit. Nilai ini ikut dikirim saat login
    dan disimpan di perangkat, supaya tetap berlaku saat offline.
- **Antrean dan sesi.** Isian di antrean selalu dikirim atas nama pengisinya. Jika sesinya
  sudah habis saat sinyal kembali, isian menunggu sampai pengguna itu login lagi, dan
  aplikasi menampilkan pengingatnya. Isian tidak pernah hilang karena sesi habis.
- Kode Pemasangan yang salah lima kali berturut-turut mengunci layar pemasangan dan
  pemulihan selama 15 menit.
- **Akun Pengelola pertama** dibuat lewat layar pemasangan di aplikasi, bukan diketik di
  Sheet, karena PIN disimpan sebagai hash. `setupSpreadsheet` membuat Kode Pemasangan
  acak di `M_Konfigurasi`, yang hanya terlihat pemilik Sheet. Saat belum ada akun
  Pengelola, aplikasi meminta kode itu, nama outlet, nama, role, dan PIN; server membuat
  akunnya lalu menghanguskan kodenya. Sesudah itu semua akun dikelola dari website.

**Lupa PIN:**

- Di layar Login, setelah memilih nama, ada tautan "Lupa PIN?". Mengetuknya mengirim
  permintaan reset untuk nama itu. Server mencatat waktunya di `M_Staff`.
- Permintaan muncul sebagai pemberitahuan di Beranda setiap Pengelola, misalnya
  "Rina meminta reset PIN". **Tidak ada email.**
- Pengelola mengetuk pemberitahuan itu, membuat PIN baru di Pengaturan → Staff, lalu
  menyampaikannya langsung ke staff. Permintaan otomatis ditandai selesai.
- Lupa PIN tidak mengubah dan tidak menampilkan PIN apa pun; hanya mengirim permintaan.
- Satu permintaan aktif per staff: mengetuk berulang kali tidak menambah pemberitahuan.
- Pemberitahuan terlihat saat Pengelola membuka aplikasi, dan (sejak 17 Oktober 2026) juga
  dikirim sebagai notifikasi ke HP Pengelola yang menyalakan notifikasi (Bagian 10.1).
- **Jika Pengelola yang lupa PIN:** Pengelola lain meresetnya dengan cara yang sama. Jika
  tidak ada Pengelola yang bisa masuk, pemilik Sheet menjalankan fungsi
  `buatKodePemasangan` di editor Apps Script. Kode baru muncul di `M_Konfigurasi` dan
  dipakai lewat "Pulihkan akses Pengelola" di layar Login untuk membuat PIN baru.

### 7.3 Pengamanan lain

- File Google Sheets dan folder Drive hanya dibagikan ke akun Google milik Head Kitchen
  dan Manager. Staff tidak punya akses langsung ke Sheet.
- Tombol "Buka dashboard di Google Sheets" hanya tampil untuk Pengelola. File itu juga
  hanya terbuka bagi akun Google yang diberi akses oleh pemilik, sehingga staff yang
  mendapat tautannya tetap tidak bisa membukanya.
- PIN adalah pengaman ringan, cukup untuk mencegah pengisian oleh orang luar dan
  membedakan staff. Jika kelak butuh keamanan lebih kuat, gunakan login akun Google.

---

## 8. Spreadsheet dan Dashboard

Seluruh isi spreadsheet dibuat otomatis oleh script dan tersusun mengikuti form. Tidak ada
tab, kolom, rumus, atau grafik yang dibuat dengan tangan. Hanya Pengelola yang punya akses
ke file ini (Bagian 7.3).

### 8.1 Dibuat otomatis

- Fungsi pemasangan (`setupSpreadsheet`) dijalankan sekali di Tahap 0. Fungsi ini membuat
  semua tab, judul kolom, format, pilihan dropdown, proteksi, rumus, dan grafik.
- Aman dijalankan ulang: hanya membuat atau memperbaiki yang belum ada, tidak menghapus data.
- Jika kolom sebuah form berubah, script diperbarui lalu dijalankan lagi, sehingga
  spreadsheet selalu sama dengan form di aplikasi.
- Tab dashboard dan tab harian langsung ada sejak pemasangan, dan terisi sendiri begitu
  data pertama masuk.

### 8.2 Susunan tab

| Urutan | Tab | Isi | Diisi oleh |
|---|---|---|---|
| 1 | `Dashboard` | Ringkasan dan grafik | Rumus |
| 2 | `Harian_Stock`, `Harian_Suhu`, `Harian_Prep`, `Harian_Waste` | Tampilan satu hari, tata letaknya sama dengan form | Rumus |
| 3 | `Stock_Harian` | Rekap stock, satu baris per tanggal dan item | Aplikasi (dihitung server) |
| 3 | `Data_Stock`, `Data_Suhu`, `Data_Prep`, `Data_PrepBahan`, `Data_Waste`, `Data_Penyesuaian`, `Data_Opname`, `Data_Nihil`, `Data_Penjualan`, `Data_PenjualanMenu`, `Data_Pesanan`, dan `Data_K_...` untuk tiap form kustom | Data lengkap, satu baris per item | Aplikasi |
| 4 | `M_Outlet`, `M_Unit`, `M_Pemasok`, `M_Staff`, `M_Item`, `M_HargaItem`, `M_Resep`, `M_ResepBahan`, `M_Menu`, `M_MenuBahan`, `M_Kategori`, `M_Satuan`, `M_Form`, `M_FormKolom`, `M_HariLibur`, `M_Konfigurasi` | Master data dan definisi form | Aplikasi (Pengaturan) |
| 5 | `Log_Perubahan` | Jejak koreksi | Aplikasi |

Tiap kelompok tab punya warna tab sendiri, supaya mudah dibedakan.

Di tab master yang punya kolom `Aktif` (item, resep, menu, pemasok, kategori, satuan, unit, staff,
form, dan kolom form), baris yang tidak aktif ditulis abu-abu dengan format bersyarat yang dipasang
`setupSpreadsheet` (30 Oktober 2026). Barisnya tidak dihapus, karena riwayat dan rekap memakainya.

### 8.3 Tab Harian: satu hari, sama seperti form

Satu tab per form. Tab ini menampilkan isian **satu tanggal** dengan tata letak form kertas.

- **Pilih tanggal** di sel paling atas. Jika dikosongkan, tab menampilkan hari ini.
- Isinya diambil otomatis dari tab Data. Tab ini hanya-baca dan siap dicetak.
- Warna judul kolom navy, seragam dengan website. Kode warnanya ada di
  `spesifikasi_tampilan_ui.md`, Bagian 2.

Susunan `Harian_Stock`:

| Bagian | Isi |
|---|---|
| Judul | Form Stock Inventory Harian |
| Kotak info | Nama Outlet, Tanggal (dipilih), Kategori (dipilih; kosong = semua kategori) |
| Sumber | `Stock_Harian` |
| Tabel | No, Nama Item, Stock Awal, Stock Masuk, Hasil Prep, Stock Keluar, Dipakai Prep, Waste, Penyesuaian, Stock Akhir, Satuan |
| Urutan baris | Dikelompokkan per kategori, tiap kelompok diawali baris judul kategori; di dalamnya urut Nama Item |
| Sorotan | Stock Akhir minus; Stock Akhir di bawah stok minimum |
| Bawah | Diisi oleh (nama, jam) dan Diperiksa oleh (nama, jam) |

Tab harian lainnya:

| Tab | Baris | Kolom |
|---|---|---|
| `Harian_Suhu` | Satu baris per unit | Nama Unit, Tipe, Opening, Middle, Closing, Cek ulang (suhu dan jam), Nama Staff, Tindakan Korektif. Suhu di luar standar disorot. |
| `Harian_Prep` | Satu baris per item prep | No, Item / Menu Prep, Nama Staff, Shift, Jumlah Resep, Hasil atau Qty, Satuan, Keterangan |
| `Harian_Waste` | Satu baris per item waste | No, Nama Staff, Shift, Item / Produk, Kategori Waste, Qty, Satuan, Alasan, Estimasi Kerugian (Rp). Baris total di bawah. |

**Mengapa bukan satu tab per hari:** setahun akan menghasilkan lebih dari 1.400 tab untuk
empat form. File menjadi lambat dan sulit dicari. Satu tab dengan pemilih tanggal memberi
tampilan yang sama untuk hari mana pun.

### 8.4 Tab Data: rapi dan konsisten

Tab Data adalah sumber semua tampilan lain, jadi kerapiannya dijaga oleh script:

- **Satu baris per item**, tanpa baris kosong, tanpa sel gabung, tanpa subtotal di tengah
  data. Ketiga hal itu merusak rumus dashboard.
- **Urutan otomatis** setelah setiap penulisan: tanggal terbaru di atas, lalu kategori,
  lalu nama item (untuk Suhu: unit, lalu waktu cek). Data yang masuk terlambat dari
  antrean offline tetap jatuh di tanggalnya.
- **Blok per hari terlihat jelas:** warna latar berselang tiap ganti tanggal.
- **Baris judul dibekukan** dan diberi filter.
- **Kolom form di kiri, kolom sistem di kanan.** Kolom sistem (ID, timestamp, status, dan
  lainnya) dikelompokkan dan dilipat, sehingga yang tampak pertama adalah kolom yang sama
  dengan form.
- **Format seragam:** tanggal, angka desimal, dan rupiah memakai format yang sama di semua tab.
- **Diproteksi.** Perubahan data dilakukan lewat aplikasi agar tercatat di `Log_Perubahan`.
- **Pertumbuhan data.** Satu outlet menghasilkan puluhan ribu baris per tahun. Supaya tetap
  cepat, data yang lebih tua dari tahun lalu dipindahkan ke berkas arsip (Bagian 8.6), dan
  hitung ulang stock hanya menyentuh item yang terkait, tidak seluruh tab.

### 8.5 Tab Dashboard

- Pemilih periode di atas: 7 hari, 30 hari, atau bulan berjalan.
- Blok tersusun dari atas ke bawah, satu blok per form, dengan judul blok:

| Blok | Isi |
|---|---|
| **Stock Inventory** | Stock akhir terkini per item (dikelompokkan per kategori), item di bawah stok minimum, pergerakan masuk dan keluar per item, item dengan Stock Akhir minus |
| **Nilai stock** | Nilai stock saat ini (Stock Akhir × Harga Satuan) per kategori dan totalnya; nilai bahan terpakai per periode |
| **Stock opname** | Tanggal opname terakhir, nilai selisih tiap opname, item yang paling sering berselisih |
| **Waste** | Total per kategori, tren per item, estimasi kerugian (Rp) per bulan, 5 item paling sering waste |
| **Suhu Chiller & Freezer** | Tren suhu per unit per hari, jumlah kejadian di luar standar |
| **Prep List** | Total resep dan hasil per item per minggu, pemakaian bahan untuk prep, beban kerja per staff/shift |
| **Kepatuhan** | Form yang belum diisi atau belum diperiksa per hari (termasuk form kustom), baris yang dilaporkan keliru. Pada hari libur kolom form yang belum diisi bertuliskan "Libur" (yang sebagian "Libur (3 dari 9)") dan tidak dihitung belum lengkap; ringkasan menyebut jumlah hari libur |

- Blok Stock Inventory aktif sejak Tahap 2. Blok form lain sudah ada sejak pemasangan dan
  terisi saat formnya mulai dipakai.
- **Menu Dashboard di aplikasi** (hanya Pengelola) memuat angka ringkas hari ini, dua
  grafik kecil, dan tombol untuk membuka tab ini.
  - Grafik pertama: estimasi kerugian waste per hari selama 7 hari terakhir.
  - Grafik kedua: semua pengecekan suhu hari ini per unit, termasuk cek ulang.
  - Server mengirim angka ringkas dan data kedua grafik dalam satu jawaban, supaya layar
    ini cukup memanggil server sekali.

**Cara menghitung nilai** (harga dari riwayat harga, Bagian 5.1):

- **Nilai stock pada tanggal T** = Stock Akhir pada T × harga yang berlaku pada T. Bukan harga
  saat barang dibeli: tidak ada FIFO atau harga rata-rata. Item yang belum punya harga pada T
  tidak dihitung dan dicantumkan dalam daftar "belum punya harga". Nilai stock saat ini memakai
  harga hari ini, yaitu Harga Satuan di `M_Item`.
- **Barang jadi tanpa harga satuan** (28 Oktober 2026): dinilai dengan harga dari resep aktifnya
  pada tanggal itu, yaitu harga bahan yang berlaku pada tanggal itu ÷ hasil per resep (cara yang
  sama dengan estimasi waste, Bagian 5.3). Berlaku untuk nilai stock (Dashboard dan rekap
  bulanan) serta nilai masuk dan penyesuaian barang jadi di rekap bulanan. Resep yang bahannya
  belum lengkap harganya membuat barang jadi itu tetap "belum punya harga". Barang jadi yang
  punya Harga Satuan sendiri tetap memakai harga itu. Blok Nilai stock di tab Dashboard Google
  Sheets tetap memakai Harga Satuan `M_Item` saja, jadi angkanya bisa lebih kecil dari aplikasi.
- **Nilai masuk, bahan terpakai, dan penyesuaian** = jumlah gerakan per hari × harga yang
  berlaku pada hari itu. Bahan terpakai = Stock Keluar + Dipakai Prep, hanya untuk item yang
  bukan hasil resep. Barang jadi tidak dihitung lagi, karena biayanya sudah terhitung saat
  bahannya dipakai.
- **Selisih karena perubahan harga:** untuk tiap item, setiap kali harga berlaku berganti dari
  h0 ke h1 pada tanggal D, selisih = Stock Akhir item pada D−1 × (h1 − h0). Positif berarti nilai
  stock naik karena harga naik. Perubahan dari "belum punya harga" ke harga pertama tidak
  dihitung sebagai selisih.
- Nilai waste dan nilai selisih opname dilaporkan terpisah, memakai nilai yang tercatat saat
  dicatat.

### 8.6 Arsip tahunan (keputusan pemilik 17 Oktober 2026)

- **Yang disimpan di tab:** tahun berjalan dan tahun lalu. Pada 2027, data sebelum 1 Januari 2026
  dipindah; pada 2028, data sebelum 1 Januari 2027, dan seterusnya.
- **Yang dipindah:** baris semua tab Data (termasuk form kustom), `Stock_Harian`, dan
  `Log_Perubahan` yang tanggalnya (Waktu, untuk `Log_Perubahan`) sebelum batas itu. Tab master,
  Harian, dan Dashboard tidak disentuh.
- **Stock tetap benar.** Stock Awal dihitung dari rekap terakhir sebelumnya, jadi rekap terakhir
  tiap item sebelum batas tetap di `Stock_Harian`. Rekap itu ikut dipindah tahun berikutnya jika
  sudah ada rekap yang lebih baru.
- **Ke mana:** satu berkas per tahun per tab di `Laporan Kitchen/{Nama Outlet}/Arsip/{Tahun}/`
  (`Arsip_{Tahun}_{Tab}_{batas}.json`), dan isinya juga ditulis ke Google Sheets
  "Arsip InventoryKu {Tahun}" di folder yang sama, satu tab per tab data, supaya bisa dibuka dan
  dicari seperti biasa. Di Supabase berkas disimpan di Storage, lalu disalin ke Drive dan ditulis ke
  Google Sheets oleh salinan 5 menit.
- **Kapan:** server memeriksa tiap jam. Selama tidak ada yang perlu dipindah, pemeriksaan itu tidak
  menulis apa pun. Di awal tahun, pemindahan berjalan bertahap (di Supabase satu tab per jam, paling
  banyak 20.000 baris sekali jalan, yang tertua dulu) sampai semua tab selesai; baru sesudah itu
  tanggal arsip dianggap tertutup. Selama bertahap, Riwayat untuk tahun yang sedang dipindah bisa
  terlihat belum lengkap.
- **Di aplikasi:** tanggal sebelum batas arsip tidak bisa dibuka atau diisi lagi (Riwayat, unduh PDF,
  rekap bulanan, HPP, isian, penjualan). Pesannya menyebut letak arsip di Drive.
- **Kegagalan** dicatat di `M_Konfigurasi` (`arsip_terakhir`), tampil di Beranda dan Dashboard
  Pengelola, dan dicoba lagi satu jam kemudian.
- **Tidak bisa dikembalikan dari aplikasi.** Memasukkan lagi data arsip ke aplikasi dilakukan pemilik
  dengan tangan, seperti memulihkan cadangan (Bagian 9.4).

---

## 9. Laporan, Daftar Belanja, dan Cadangan

### 9.1 Laporan harian PDF

PDF **tidak** dibuat pada setiap submit: lambat, file menumpuk, dan nama file bertabrakan.

1. **Otomatis sekali per hari setelah closing.** Jam closing 21:30; trigger dijadwalkan
   45 menit sesudahnya (sekitar 22:15) agar suhu Closing dan stock hari itu sempat
   diisi. Trigger berbasis waktu Apps Script punya toleransi sekitar ±15 menit, jadi
   laporan keluar antara kira-kira 22:00 dan 22:30. Hasilnya disimpan ke Drive dan
   dilampirkan ke email laporan harian. Pada hari libur (Bagian 5.8) email tidak dikirim,
   tetapi PDF form yang tetap berisian hari itu tetap disimpan ke Drive.
2. **Unduh oleh pengguna.** Staff dan Pengelola memilih tanggal dan form di menu Laporan,
   lalu menekan "Unduh PDF". Server mengirim isi PDF ke aplikasi. Tombol yang sama
   tersedia di menu Riwayat. Unduhan ini tidak menambah file baru di Drive.
   - **Stock per kategori.** Untuk form Stock, pengguna juga memilih kategori: "Semua
     kategori" atau satu kategori. Jika satu kategori dipilih, PDF hanya berisi item
     kategori itu. Daftar pilihannya adalah kategori yang aktif, menurut urutannya di
     `M_Kategori`. Tombol unduh di menu Riwayat selalu mengunduh semua kategori.
   - **Android, laptop, dan desktop:** browser langsung menyimpan PDF sebagai file di
     folder unduhan.
   - **iPhone dan iPad:** unduhan biasa (tautan unduh atau jendela baru) tidak dipakai.
     Di aplikasi yang terpasang ke layar utama, file yang diunduh biasa terbuka menutupi
     aplikasi dan tidak ada jalan kembali. Sebagai gantinya, setelah PDF siap, tombol
     berganti menjadi "Simpan PDF". Ketukan pada tombol itu membuka lembar bagikan
     (Web Share API dengan file), dan pengguna memilih "Save to Files" atau aplikasi lain.
   - **Dua langkah itu wajib.** iPhone hanya mengizinkan lembar bagikan dibuka langsung
     oleh ketukan. Jika aplikasi menunggu jawaban server dulu di dalam ketukan yang
     sama, iPhone bisa menolaknya. Karena itu PDF diambil lebih dulu, baru tombol
     "Simpan PDF" ditampilkan.
   - iPhone dan iPad dikenali dari perangkatnya, bukan dari lebar layar, termasuk iPad
     yang mengaku sebagai Mac. Aturan ini berlaku baik di Safari maupun di aplikasi
     yang terpasang.
   - **Jika berbagi file tidak didukung** (iPhone lama), aplikasi menampilkan pesan agar
     pengguna membuka alamat website di Safari dan mengunduh dari sana. Di Safari,
     unduhan biasa berjalan normal.
   - Nama file: `{YYYY-MM-DD}_{NamaForm}.pdf`. Untuk stock satu kategori:
     `{YYYY-MM-DD}_Stock_{NamaKategori}.pdf`.
   - Aturan ini berlaku untuk semua unduhan PDF: laporan harian, laporan selisih
     opname, daftar belanja, dan rekap bulanan.
3. **Simpan ulang ke Drive** (khusus Pengelola), dipakai setelah ada koreksi data.
4. **Cara dibuat:** template HTML yang meniru tata letak form Word, dengan warna navy
   menggantikan hijau (kode warna di `spesifikasi_tampilan_ui.md`, Bagian 2), diubah ke PDF dengan
   `Utilities.newBlob(html, 'text/html').getAs('application/pdf')`. Dukungan CSS-nya
   terbatas, jadi template dibuat sederhana (tabel biasa). PDF stock memakai rekap
   harian dan dikelompokkan per kategori. Form kustom memakai satu template umum: judul,
   kotak info, tabel sesuai kolomnya, dan baris "Diperiksa oleh".
   - **PDF stock semua kategori:** tiap kategori mulai di halaman baru, dengan judul
     laporan, tanggal, nama kategori, dan baris judul tabel diulang di halaman itu.
     Kategori yang tidak punya rekap pada tanggal itu dilewati.
   - Pemisah halaman dibuat dengan aturan CSS `page-break-before`. Dukungannya pada
     konversi ini belum dipastikan, jadi harus diuji saat dibangun. Jika tidak dipatuhi,
     PDF semua kategori tetap satu tabel bersambung dengan baris judul kategori, dan
     unduhan satu kategori menjadi cara untuk mendapat laporan terpisah.
   - **PDF stock satu kategori:** tata letaknya sama, hanya berisi kategori itu, dan nama
     kategorinya tertulis di kotak info.
   - **Item nonaktif** (30 Oktober 2026) tidak dimuat di PDF stock, sama dengan tab
     `Harian_Stock`, walau item itu bergerak pada tanggal laporan. Jika ada, catatan di bawah
     tabel menyebut jumlahnya: "2 item nonaktif yang bergerak pada tanggal ini tidak ditampilkan."
     Gerakannya tetap ada di `Stock_Harian` dan tab Data.
   - PDF harian otomatis (ke Drive dan lampiran email) tetap satu file Stock berisi semua
     kategori, supaya lampiran email tidak bertambah banyak.
5. **Lokasi di Drive:**
   `Laporan Kitchen/{Nama Outlet}/{Tahun}/{Bulan}/{YYYY-MM-DD}_{NamaForm}_{HHmm}.pdf`
   Format tanggal `YYYY-MM-DD` membuat file terurut. Jam di nama file mencegah tabrakan
   jika laporan disimpan ulang.

Unduh PDF tidak memakai link Drive, karena staff tidak punya akses ke folder Drive.

### 9.2 Daftar belanja (Pengelola)

- Berisi semua item aktif yang Stock Akhir-nya di bawah Stok Minimum, dikelompokkan **per pemasok**
  (21 Oktober 2026, keputusan pemilik): pemasok pesanan item itu yang masih menunggu, lalu pemasok
  barang masuk terakhirnya (Bagian 5.5). Item tanpa keduanya, atau yang pemasoknya sudah nonaktif,
  masuk kelompok "Belum ada pemasok". Di tiap kelompok item urut kategori, lalu nama.
- Tiap baris: nama item, stock sekarang, stok minimum, dan **saran order**.
- Saran order = Stok Maksimum − Stock Akhir. Jika item punya satuan besar, saran
  dibulatkan ke atas ke satuan besar, misalnya butuh 20 botol menjadi 2 dus.
- Jika Stok Maksimum kosong, item tetap masuk daftar tanpa saran jumlah.
- Kolom Order terisi saran, **kecuali** untuk item yang sudah dipesan dan belum datang, dan untuk
  item di kelompok "Belum ada pemasok": keduanya kosong sampai diisi, supaya tidak terpesan dua kali
  atau ke pemasok yang salah. Pengelola boleh mengubah jumlah di layar; perubahan itu tidak disimpan.
- **Tambah item** (29 Oktober 2026, permintaan pemilik): tiap kelompok bisa ditambah item aktif lain
  yang belum ada di daftar, berapa pun stock-nya (misalnya stock masih di atas minimum, atau item tanpa
  stok minimum), supaya ikut dipesan ke pemasok kelompok itu. Order item tambahan kosong sampai diisi,
  dan item itu bisa dikeluarkan lagi. Kelompok tanpa pemasok selalu ada di paling bawah (berjudul
  "Pemasok lain" jika tidak berisi item di bawah minimum), untuk pesanan ke pemasok yang belum punya
  kelompok: item ditambah di situ, lalu pemasoknya dipilih di "Pesan ke" (otomatis pemasok barang masuk
  terakhir item pertama yang ditambah, jika ada). Item tambahan hanya ada di layar (tidak disimpan);
  begitu dikirim ke WhatsApp ia tercatat sebagai pesanan seperti item lain, dan ikut tercetak di PDF
  (bertanda "ditambah di layar"). Item di luar daftar item (barang yang diketik bebas) tidak bisa
  ditambah, karena tidak bisa dicatat datang dan tidak punya stock.
- **Kirim ke WhatsApp** per kelompok: membuka chat WhatsApp ke nomor di Kontak pemasok (atau WhatsApp
  meminta memilih kontak jika Kontak tidak berisi nomor HP) dengan pesan berisi item yang Order-nya
  diisi. Kelompok "Belum ada pemasok" memilih pemasok di "Pesan ke"; tanpa pilihan, pesan tetap
  dibuka tetapi pesanannya tidak dicatat.
- **Pesanan tercatat:** ketukan itu juga mencatat pesanan di `Data_Pesanan` (satu baris per item:
  Tanggal, Pemasok, Nama Item, Kategori, Jumlah dan Satuan Order, Jumlah Dasar dan Satuan, Keadaan
  Menunggu/Datang/Diganti/Ditutup, Selesai Oleh, Selesai Pada, Kiriman Stock, dan kolom sistem). Tiap
  item paling banyak punya satu pesanan menunggu: memesan lagi item yang masih menunggu mengganti
  pesanan lamanya (Diganti). Pesanan dicatat di antrean HP lebih dulu, jadi tetap tercatat walau
  sinyal putus atau aplikasi tertutup saat WhatsApp terbuka. Yang dibandingkan adalah waktu tombol
  diketuk di HP: barang yang dicatat masuk di HP sejak tombol diketuk (dan belum menyelesaikan
  pesanan lain) langsung dianggap datang, dan pesanan yang sudah didahului pesanan menunggu yang
  diketuk sesudahnya tidak menggantikannya. Aplikasi tidak memeriksa apakah pesan WhatsApp benar
  terkirim: ketukan itulah yang mencatat, jadi pesanan yang tidak jadi dikirim ditutup lewat "Tutup
  pesanan".
- **Pesanan belum datang:** daftar semua pesanan yang masih menunggu (umur berapa pun), dengan "Tutup
  pesanan" untuk pesanan yang tidak dikirim pemasok atau sudah dicatat tanpa pesanan. Pesanan selesai
  sendiri saat barangnya dicatat masuk (Bagian 5.5). Ganti nama item atau pemasok ikut mengganti nama
  di `Data_Pesanan`; menghapus item menutup pesanannya yang masih menunggu.
- Bisa diunduh sebagai PDF dari menu Laporan, dikelompokkan per pemasok dengan Order seperti di layar
  (termasuk item tambahan, juga saat tidak ada item di bawah minimum);
  Order yang kosong dicetak "–" dengan sebabnya (sudah dipesan, belum ada pemasok) dan sarannya.
  Ringkasannya dan pesanan yang belum datang ikut di email harian.
- Nomor WhatsApp diambil dari Kontak pemasok; jika Kontak berisi beberapa nomor, nomor HP didahulukan.
- Daftar ini hanya saran; tidak ada persetujuan pembelian atau PO. Harga beli dicatat saat barang
  datang (Bagian 5.5), bukan saat memesan.

### 9.3 Rekap bulanan PDF (Pengelola)

Dibuat otomatis tiap tanggal 1 untuk bulan sebelumnya, disimpan ke Drive di
`Laporan Kitchen/{Nama Outlet}/{Tahun}/Rekap_{YYYY-MM}.pdf`, dan dikirim ke penerima email.
Bisa juga diunduh dari menu Laporan untuk bulan mana pun.

Nilai rupiah dihitung dengan cara Bagian 8.5 (harga yang berlaku pada tiap tanggal). Karena
itu angka rekap bulan yang sudah lewat tidak berubah lagi, kecuali riwayat harganya diubah,
atau hari libur ditandai atau dihapus (Bagian 5.8), untuk tanggal di bulan itu.

| Bagian | Isi |
|---|---|
| Stock | Total masuk, bahan terpakai, dan penyesuaian per kategori; selisih karena perubahan harga per kategori; nilai stock akhir bulan |
| Stock opname | Tanggal tiap opname dan nilai selisihnya; item yang paling sering berselisih |
| Waste | Total jumlah dan nilai (Rp) per kategori waste; sepuluh item dengan nilai waste terbesar |
| Prep | Total resep dan hasil per item; jika ada hasil aktual yang dicatat: hasil standar per item dan persentase hasil aktual terhadap resep |
| Suhu | Jumlah kejadian di luar standar per unit; pengecekan yang terlewat (hari libur tidak dihitung dan disebut tanggalnya) |
| Kepatuhan | Jumlah hari tiap form tidak lengkap; isian yang belum diperiksa; laporan kekeliruan. Hari libur tidak ditagih; hari yang dinilai menyebut jumlah dan tanggal hari libur |
| Pembelian (18 Oktober 2026) | Per pemasok: jumlah kiriman, item, nilai pembelian (stock masuk × harga beli), dan barang masuk tanpa harga beli; hanya jika bulan itu ada pemasok atau harga beli yang dicatat |
| HPP dan food cost | Pemakaian bahan dan rinciannya, penjualan, food cost dan target, pemakaian per kategori, pemakaian seharusnya (dari porsi terjual) vs nyata dengan 10 bahan berselisih terbesar (jika porsi per menu pernah dicatat), menu di atas target (HPP dengan harga hari terakhir bulan itu); Bagian 5.9 |

### 9.4 Cadangan otomatis mingguan

- Seminggu sekali, pada dini hari, server menyalin seluruh spreadsheet ke folder
  `Laporan Kitchen/Cadangan/` dengan nama yang memuat tanggalnya. Sejak pindah ke Supabase
  (Bagian 4.5) salinannya berupa satu berkas JSON berisi semua tab.
- Empat salinan terakhir disimpan; yang lebih lama dibuang ke tempat sampah Drive.
- Salinan hanya bisa dibuka pemilik dan akun yang punya akses ke folder itu.
- Memulihkan data dari cadangan dilakukan pemilik dari editor Apps Script, bukan dari aplikasi
  (aplikasi tidak punya tombol pulihkan). Sejak 19 Oktober 2026 (permintaan pemilik, dari usulan
  fitur SYS-04), untuk cadangan JSON di Supabase:
  - **Periksa** (`periksaCadangan`): cadangan dibaca dari Drive dan isinya per tab dicatat, tanpa
    mengubah apa pun.
  - **Uji sebulan sekali** (`ujiPemulihanCadangan`): isi sekarang dicadangkan, berkas itu dibaca
    lagi dari Drive dan dipulihkan, lalu jumlah baris tiap tab dicocokkan. Tidak ada isian yang hilang.
  - **Pulihkan** (`pulihkanCadangan`, nama berkas di Script Property `PULIHKAN_CADANGAN`): isi database
    diganti isi cadangan; isian sesudah cadangan itu dibuat hilang. Isi sebelum pemulihan selalu disimpan
    dulu sebagai "Cadangan sebelum pemulihan …", jadi pemulihan bisa dibatalkan. PIN, sesi, dan notifikasi
    HP tetap (tidak ikut cadangan).
  - Selama pemulihan, aplikasi ditutup: server menolak aksi dengan pesan "Server sedang dipulihkan…" dan
    HP memperlakukannya seperti tanpa sinyal (isian masuk antrean HP). Pemulihan yang berhenti di tengah
    membiarkan aplikasi tetap ditutup sampai dijalankan ulang dan berhasil.
  - Langkahnya, juga untuk project Supabase baru, ada di `supabase/PANDUAN.md`.
- Jika pembuatan cadangan gagal, kegagalannya dicatat dan disebut di email harian berikutnya.

---

## 10. Email Otomatis (Gmail)

Ada **dua email otomatis**: laporan harian, dan rekap bulanan sebulan sekali
(Bagian 9.3). Tidak ada email pada setiap submit, tidak ada alert instan lewat email, dan tidak
ada email pengingat terpisah; peringatan seketika dikirim sebagai notifikasi ke HP (Bagian 10.1).
Keterangan di bawah ini untuk laporan harian.

- **Kapan:** sekali sehari setelah closing, sekitar 22:15 (trigger yang sama dengan PDF harian).
- **Penerima:** daftar di Pengaturan → Penerima Email, diisi oleh Pengelola dari website.
- **Isi:**
  - Status setiap form aktif hari itu menurut aturan kelengkapan (Bagian 5.8): lengkap,
    nihil, atau **belum diisi**. Bagian ini adalah pengingat pengisian form.
  - Kejadian suhu di luar standar hari itu, beserta tindakan korektifnya
  - Total waste hari itu (qty dan estimasi Rp)
  - Ringkasan daftar belanja: item di bawah stok minimum dan saran ordernya
  - Pesanan ke pemasok yang belum datang (21 Oktober 2026)
  - Barang masuk hari itu (28 Oktober 2026): per pemasok (tanpa pemasok paling bawah), jumlah dan
    harga beli per item, nilai per pemasok dan totalnya dari harga beli yang dicatat, dan jumlah baris
    tanpa harga beli
  - Penjualan dan food cost (28 Oktober 2026), hanya jika penjualan pernah dicatat (Bagian 5.9):
    penjualan hari itu (atau "belum dicatat"), porsi terjual per menu jika porsi pernah dicatat, dan
    food cost bulan itu sampai tanggal laporan (tanggal laporan ikut dinilai karena email dikirim
    sesudah closing), atau food cost sementara selama penjualan belum lengkap
  - Item dengan Stock Akhir minus
  - Barang jadi dan barang masuk yang lewat masa simpan atau habis besok
  - Jumlah data yang belum diperiksa, baris yang dilaporkan keliru, dan permintaan reset PIN
  - Akun yang terkunci karena PIN salah dalam 24 jam terakhir
  - Pengingat stock opname jika sudah lewat jadwal
  - Tautan untuk membuka aplikasi
  - Lampiran: PDF laporan harian tiap form yang sudah diisi
- **Kuota:** batas akun Gmail biasa adalah 100 penerima per hari, dihitung per penerima.
  Satu email harian ke 2 atau 3 penerima hanya memakai 2 atau 3 dari batas itu.
- Jika email gagal terkirim, data tetap aman di Sheet dan kegagalannya dicatat agar
  terlihat oleh Pengelola.
- Email rekap bulanan memuat juga satu bagian HPP dan food cost (Bagian 5.9), termasuk pemakaian
  seharusnya vs nyata jika porsi per menu pernah dicatat.
- Sejak pindah ke Supabase (Bagian 4.5) email dikirim lewat Brevo, atau dari Gmail pemilik
  lewat Apps Script jika Brevo tidak dipasang.
- **Hari libur** (Bagian 5.8): laporan harian dari jadwal tidak mengirim email. PDF form yang tetap
  berisian hari itu tetap disimpan ke Drive, lalu catatan laporan terakhir bertuliskan "Dilewati …
  hari libur" (catatan "Gagal" hari sebelumnya tidak ditimpa, supaya tetap terlihat). Uji dari editor
  (`kirimLaporanSekarang`) tetap mengirim email, dengan keterangan hari libur. Peringatan "laporan
  belum terkirim" di Beranda Pengelola menganggap "Dilewati" sebagai laporan yang sudah berjalan;
  hari libur tanpa catatan itu berarti jadwalnya tidak berjalan dan tetap diperingatkan. Rekap
  bulanan tanggal 1 tetap dikirim walau tanggal itu hari libur.

### 10.1 Notifikasi ke HP (keputusan pemilik 17 Oktober 2026)

Notifikasi Web Push ke HP, juga saat aplikasi tertutup. Hanya dari server Supabase (Bagian 4.5);
Apps Script tidak bisa mengirimnya.

- **Menyalakan:** tiap pengguna menyalakannya sendiri di HP-nya (menu nama pengguna →
  Notifikasi), lalu mengizinkan notifikasi di HP. Satu HP satu orang: menyalakan di HP yang sudah
  menyala untuk orang lain memindahkannya ke pengguna sekarang. Keluar tidak mematikan notifikasi
  HP itu. Di iPhone dan iPad hanya untuk aplikasi yang dipasang di Layar Utama (iOS 16.4 ke atas).
- **Yang dikirim:**

| Notifikasi | Penerima | Kapan |
|---|---|---|
| Suhu di luar standar (unit, suhu, tindakan, pengisi) | HP Pengelola | Saat isian Suhu berisi suhu di luar standar diterima, atau suhu dikoreksi/dibetulkan menjadi di luar standar (28 Oktober 2026) |
| "Rina meminta reset PIN" | HP Pengelola | Saat Lupa PIN menghasilkan permintaan baru |
| "Rina terkunci karena PIN salah" | HP Pengelola | Saat akun terkunci (15 menit atau 24 jam, Bagian 7.2) |
| "Waktunya cek suhu Opening" dan unit yang belum diisi | Semua HP yang menyala | Pada jam pengingat, hanya jika waktu cek itu belum diisi untuk semua unit aktif, kecuali pada hari libur (Bagian 5.8) |
| "Stock hari ini: 1 minus, 3 di bawah minimum, 1 lewat masa simpan" dan nama itemnya (18 Oktober 2026) | HP Pengelola | Sekali sehari pada jam pengingat stock, hanya jika ada item aktif yang minus atau di bawah stok minimum, atau barang yang lewat masa simpan atau habis besok |
| "Closing 21.30: 3 form belum diisi" dan nama formnya (28 Oktober 2026) | Semua HP yang menyala | Sekian menit sebelum jam closing, hanya jika ada form wajib hari itu yang belum diisi atau belum lengkap (Bagian 5.8), kecuali pada hari libur |

- **Jam pengingat cek suhu** diatur Pengelola di Pengaturan → Outlet dan jadwal: Opening 08.00,
  Middle 14.00, Closing 21.00 (nilai awal); jam yang dikosongkan mematikan pengingat itu. Tidak ada
  pengingat jika form Suhu disembunyikan atau tidak ada unit aktif.
- **Jam pengingat stock** (18 Oktober 2026) juga diatur di Outlet dan jadwal: 07.00 (nilai awal);
  dikosongkan berarti mati. Isinya dihitung sama dengan Dashboard pada hari itu (stock menurut
  catatan, Bagian 5.8 dan 5.3); item yang minus tidak diulang di daftar di bawah minimum.
- **Pengingat sebelum closing** (28 Oktober 2026) juga diatur di Outlet dan jadwal sebagai menit
  sebelum jam closing: 15, 30 (nilai awal), atau 60 menit, atau mati. Karena berupa menit, jamnya ikut
  bergeser saat jam closing diubah (jam closing 21.30 dan 30 menit = 21.00; boleh mundur lewat tengah
  malam). Isinya: form wajib yang belum diisi, lalu yang belum lengkap (misalnya Suhu 6 dari 9
  pengecekan), dengan ajakan menandai "Tidak ada hari ini" untuk form selain Suhu yang memang kosong.
  Selama pengingat cek suhu Closing menyala, Suhu hanya disebut jika Opening atau Middle belum lengkap,
  supaya tidak ada dua notifikasi untuk hal yang sama; tanpa unit aktif Suhu tidak disebut. Pengingat
  yang berjalan sebelum 06.00 (jam closing lewat tengah malam) untuk hari kemarin, dan isinya menyebut
  tanggalnya.
- Hanya pengguna aktif yang punya PIN yang menerima; Pengelola menurut role saat notifikasi dikirim.
- Mengetuk notifikasi membuka layar yang sesuai (form Suhu, reset PIN staff itu, Dashboard untuk
  pengingat stock, atau Beranda untuk pengingat sebelum closing).
- Notifikasi tidak menggantikan apa pun: pemberitahuan di Beranda, Dashboard, dan email harian tetap.
- Pada hari libur pengingat cek suhu dan pengingat sebelum closing tidak dikirim. Notifikasi suhu di luar standar, reset
  PIN, akun terkunci, dan pengingat stock tetap dikirim (isian tetap diterima, dan barang tetap bisa
  lewat masa simpan saat dapur tutup).
- HP yang izinnya dicabut atau aplikasinya dihapus dibuang dari daftar saat layanan push menolaknya.

---

## 11. PWA dan Perilaku Offline

Tampilan (warna, huruf, tata letak per perangkat, layar, teks antarmuka) diatur di
`spesifikasi_tampilan_ui.md`. Bagian ini hanya mengatur perilaku.

- **Responsif:** satu aplikasi yang sama dipakai di HP, tablet, laptop, dan desktop.
  Arah layar tidak dikunci, jadi manifest tidak mengisi `orientation`.
- **Install:** di Android lewat Chrome ("Install app"), di iPhone lewat Safari
  ("Add to Home Screen"). iPhone tidak menawarkan pemasangan secara otomatis. Aplikasi tampil dengan nama **InventoryKu** dan ikon buku, dan
  terbuka layar penuh.
- **Bisa dibuka tanpa sinyal:** service worker menyimpan halaman aplikasi dan master data
  terakhir (item, resep, unit, kategori, susunan form), sehingga form tetap bisa dibuka dan diisi.
- **Tidak menunggu jaringan saat dibuka** (12 Oktober 2026): alamat API (`config.js`) dipakai dari
  salinan di HP dan diperbarui di latar, sehingga alamat API yang baru diganti pemilik terpakai
  pada pembukaan berikutnya. Hanya pembukaan pertama di sebuah HP yang mengambilnya dari jaringan.
- **Draft otomatis:** isian disimpan di HP selama mengisi, sehingga tidak hilang jika
  aplikasi tertutup.
- **Antrean submit saat offline:** submit tanpa sinyal masuk antrean di HP dengan tanda
  "menunggu kirim". Antrean dikirim saat aplikasi terbuka dan sinyal kembali. Staff bisa
  melihat mana yang sudah terkirim dan mana yang belum.
- **Anti submit ganda:** tombol kirim dinonaktifkan setelah ditekan, dan server menolak
  `submission_id` yang sudah pernah masuk. Ini juga mengamankan pengiriman ulang dari antrean.
- **Nilai otomatis dihitung di server.** Stock Awal, Hasil Prep, Dipakai Prep, Waste, harga, dan Stock Akhir
  dihitung ulang saat data diterima server, sehingga hasilnya benar walau HP mengisi saat offline.
- **Menu mengikuti role:** menu yang bukan hak pengguna tidak ditampilkan, dan server
  tetap menolak permintaannya (Bagian 7.1).
- **Unduh PDF di iPhone dan iPad** memakai lembar bagikan, bukan unduhan biasa
  (Bagian 9.1).

**Yang tetap butuh sinyal:** login, Lupa PIN, Riwayat, unduh PDF, dashboard, membuka daftar
belanja dan menutup pesanan, menyimpan stock opname, halaman Pengaturan, dan pemeriksaan data.
Pesanan yang dikirim lewat WhatsApp tanpa sinyal menunggu di antrean HP seperti isian lain.

---

## 12. Hal yang Masih Perlu Dikonfirmasi

Butir-butir berikut adalah pilihan yang diambil dokumen ini saat menafsirkan keputusan
4 Oktober 2026. Koreksi jika keliru.

**Stock dan resep**

- [ ] **Jadwal stock opname bawaan adalah mingguan.** Bisa diganti bulanan di Pengaturan.
- [ ] **Saran order** = Stok Maksimum − Stock Akhir, dibulatkan ke satuan besar.
- [ ] **Masa simpan diperkirakan**, bukan dilacak per wadah atau per kiriman: yang datang atau
      dibuat lebih dulu dianggap dipakai lebih dulu.
- [ ] **Hasil prep mengikuti resep, kecuali hasil aktual diisi** (Bagian 5.3, 18 Oktober 2026);
      jika hasil nyata sering berbeda, Pengelola memperbaiki angka di Master Resep.
- [ ] **Harga barang jadi** yang dikosongkan dihitung dari harga bahan resepnya.
- [ ] **Pesanan selesai saat barang dicatat masuk** dengan pemasok yang sama atau tanpa pemasok
      (21 Oktober 2026), berapa pun jumlah yang datang. Barang dari pemasok lain tidak
      menyelesaikannya. Pesanan yang tidak datang ditutup Pengelola.
- [x] **Harga item punya riwayat** (keputusan pemilik, 11 Oktober 2026). Nilai stock pada
      suatu tanggal memakai harga yang berlaku pada tanggal itu, bukan harga saat barang dibeli
      (tanpa FIFO atau rata-rata). Gerakan dinilai dengan harga hari gerakannya, dan selisih
      karena perubahan harga dilaporkan terpisah (Bagian 5.1 dan 8.5).

**Akses**

- [ ] **Staff boleh mengisi untuk hari ini dan kemarin.** Tanggal lebih lama hanya Pengelola.
- [ ] **PIN 6 angka dan sesi paling lama 12 jam.**
- [ ] **Keluar otomatis setelah 5 menit tidak dipakai**, untuk semua role. Staff perlu
      mengetik PIN lagi setiap kali HP sempat ditinggal. Jika terasa terlalu sering,
      Pengelola bisa menaikkannya menjadi 10, 15, atau 30 menit dari Pengaturan.
- [ ] **Menghapus staff** hanya menyembunyikan namanya dari aplikasi. Barisnya tetap ada
      di spreadsheet, dan pemulihannya hanya bisa dilakukan pemilik Sheet.
- [x] **Menghapus item** (permintaan pemilik 17 Oktober 2026) hanya untuk item nonaktif yang
      belum punya catatan apa pun. Barisnya benar-benar dihapus dari `M_Item`, bersama riwayat
      harganya (Bagian 5.1).
- [ ] **Hanya Pengelola** yang melihat nilai rupiah stock, daftar belanja, rekap bulanan,
      dan yang melakukan stock opname.
- [x] **Nominal waste (Rp) hanya terlihat Pengelola** (keputusan pemilik 17 Oktober 2026):
      disembunyikan dari Staff di form, Riwayat, dan PDF Waste (Bagian 5.4).
- [x] **HPP dan food cost** (keputusan pemilik 17 Oktober 2026, Bagian 5.9): penjualan dicatat
      per hari, harga jual dan penjualan tanpa pajak dan service, target food cost 35%, bahan
      kecil 3%, hasil bersih per baris bahan menu, biaya operasional tidak masuk HPP per porsi.
- [x] **Notifikasi ke HP** (keputusan pemilik 17 Oktober 2026, Bagian 10.1): suhu di luar standar,
      permintaan reset PIN, dan akun terkunci ke HP Pengelola; pengingat cek suhu ke semua HP yang
      menyalakan notifikasi.

**Form dan data**

- [x] **Arsip tahunan** (keputusan pemilik 17 Oktober 2026, Bagian 8.6): tab menyimpan tahun
      berjalan dan tahun lalu; yang lebih tua pindah ke berkas arsip per tahun di Drive, juga dalam
      bentuk Google Sheets. Riwayat dan rekap tahun yang sudah diarsip tidak dibuka dari aplikasi.
- [x] **Hari libur** (keputusan pemilik 22 Oktober 2026, Bagian 5.8): ditandai Pengelola per tanggal
      (hari ini, tanggal lewat, atau sampai setahun ke depan) dan bisa dihapus; tidak ada hari tutup
      tetap per minggu; tidak ada form yang ditagih dan tidak ada pengecekan suhu yang terlewat;
      penjualan tidak perlu dicatat; email harian dan pengingat cek suhu tidak dikirim.

- [ ] **Menghapus form kustom** berarti form hilang dari website, tetapi datanya tetap ada
      di spreadsheet dan bisa dipulihkan. Data tidak pernah dihapus permanen dari aplikasi.
- [ ] **Form bawaan** (Stock, Suhu, Prep List, Waste) hanya bisa diganti nama, diurutkan,
      dan disembunyikan. Kolomnya tidak bisa diubah, karena terikat pada hitungan otomatis.
- [ ] **Cadangan mingguan** menyimpan empat salinan terakhir.
- [ ] **Rekap bulanan** dikirim lewat email tiap tanggal 1.

---

## 13. Tahapan Implementasi

Google Form tidak dipakai sebagai tahap awal: tidak bisa tabel banyak baris, hitung
otomatis, role, maupun PWA, dan hasilnya harus dibuang saat pindah ke aplikasi.

0. **Tahap 0 — Fondasi**
   - Jalankan `setupSpreadsheet`: semua tab (Dashboard, Harian, Data, Master,
     `Log_Perubahan`) dibuat otomatis beserta format, rumus, dan proteksinya
   - Isi master awal langsung di Sheet (item, unit, kategori, satuan)
   - Buat kerangka API Apps Script (`doPost`), deploy
   - Siapkan repo dan GitHub Pages untuk frontend
   - **Uji panggilan API dari halaman di hosting, lewat HP sungguhan** (memastikan batasan CORS teratasi)
1. **Tahap 1 — Kerangka PWA dan akses:** manifest, service worker, layar pemasangan
   pertama (Kode Pemasangan, nama outlet), login PIN 6 angka, sesi 12 jam, tombol Keluar,
   keluar otomatis, Lupa PIN, role, deteksi zona waktu otomatis, halaman Pengaturan →
   Staff (buat/reset PIN, nonaktifkan, hapus)
   dan Pengaturan → Penerima Email. Tata letak untuk HP, tablet, dan desktop serta aturan
   gerak dibangun di tahap ini sebagai pola bersama untuk semua layar berikutnya.
2. **Tahap 2 — Form Stock Inventory Harian:** form responsif per kategori, catatan gerakan
   yang boleh dikirim berkali-kali, rekap `Stock_Harian`, satuan besar di Stock Masuk,
   penyesuaian stock dan stok pembuka, aturan tanggal isian, tanda nihil, draft, anti
   submit ganda, antrean offline. Kolom Hasil Prep, Dipakai Prep, dan Waste sudah ada dan
   bernilai nol sampai formnya dibangun. Uji coba beberapa hari.
3. **Tahap 3 — Riwayat, pemeriksaan, dan koreksi:** menu Riwayat untuk Stock Inventory
   (catatan gerakan, rekap harian, riwayat per item), Laporkan Kekeliruan, status
   Terkirim/Diperiksa, kunci data, koreksi berantai, `Log_Perubahan`
4. **Tahap 4 — Laporan dan email:** menu Laporan (Unduh PDF, termasuk pilihan kategori
   untuk stock dan cara simpan di iPhone), simpan ke Drive, trigger harian sekitar 22:15, email laporan harian, cadangan
   otomatis mingguan
5. **Tahap 5 — Form Waste dan Suhu:** Waste dulu (langsung mengurangi stock), lalu Suhu
   dengan cek ulang. Tiap form langsung masuk ke menu Riwayat, Laporan, dan email harian.
6. **Tahap 6 — Prep List dan resep:** Pengaturan → Resep, form Prep List dalam jumlah
   resep, gerakan stock otomatis (hasil bertambah, bahan berkurang), `Data_PrepBahan`,
   masa simpan barang jadi
7. **Tahap 7 — Dashboard di aplikasi dan pengelolaan master:** menu Dashboard di PWA
   dengan dua grafik kecil, nilai stock, penyempurnaan grafik di tab Dashboard, halaman kelola item (termasuk
   satuan besar dan stok maksimum), unit, kategori, dan satuan dari website
8. **Tahap 8 — Stock opname dan daftar belanja:** layar stock opname, laporan selisih,
   pengingat jadwal opname, daftar belanja dengan saran order dan PDF-nya
9. **Tahap 9 — Form kustom:** Pengaturan → Form (buat, ubah, sembunyikan, hapus form dan
   kolomnya, jadwal form), layar isi umum, tab data otomatis, dan sambungan ke Beranda,
   Riwayat, Laporan, PDF, serta email harian
10. **Tahap 10 — Rekap bulanan:** PDF rekap bulanan, trigger tanggal 1, email, dan unduhan
    dari menu Laporan
11. **Tahap 11 (opsional):** foto bukti waste, arsip data tahunan, penambahan outlet
12. **HPP dan food cost** (17 Oktober 2026): Pengaturan → Menu, layar HPP dan food cost dari
    Dashboard, penjualan harian, bagian HPP di rekap bulanan
13. **Penjualan per menu** (17 Oktober 2026): porsi terjual per menu di lembar Catat penjualan,
    pemakaian seharusnya vs nyata di layar HPP, rekap bulanan, dan email
14. **Notifikasi ke HP** (17 Oktober 2026): Web Push dari Supabase, lembar Notifikasi di HP ini,
    jam pengingat cek suhu di Outlet dan jadwal
15. **Arsip tahunan** (17 Oktober 2026): pemindahan otomatis tiap jam, berkas JSON dan Google Sheets
    per tahun di Drive, penolakan tanggal yang sudah diarsip
16. **Hari libur** (22 Oktober 2026): `M_HariLibur`, Pengaturan → Hari libur, penagihan form, laporan
    harian dan pengingat cek suhu yang dilewati, penjualan dan porsi, rekap bulanan, dan blok
    Kepatuhan di tab Dashboard

---

## 14. Perubahan dari v1

**Koreksi teknis**

| # | Bagian v1 | Masalah | Perbaikan di v2 |
|---|---|---|---|
| 1 | §3 diagram | Trigger `onFormSubmit / onEdit` tidak berlaku untuk Web App | Data masuk lewat `doPost`; trigger hanya untuk laporan harian (Bagian 4.2) |
| 2 | §3 kelebihan | "Otomatis responsif" tidak benar untuk HTML Service | Frontend statis dengan viewport HTML biasa (Bagian 4.1) |
| 3 | §8 | PWA tidak bisa di Apps Script HTML Service | Arsitektur diganti: frontend statis + Apps Script sebagai API (Bagian 4) |
| 4 | §7 | Email tiap submit menghabiskan kuota | Satu email laporan harian (Bagian 10) |
| 5 | §6 | PDF tiap submit; nama file bertabrakan; link Drive tidak terbuka bagi staff | PDF harian otomatis dan unduh langsung; nama dengan tanggal dan jam (Bagian 9) |
| 6 | §3 Opsi B | Gmail lewat Service Account tidak bisa di akun @gmail.com | Dicatat di Bagian 4.4 |

**Perbaikan struktur dan konsistensi**

- Judul disesuaikan dengan cakupan 4 form
- "Laporan harian" kini konsisten di Tujuan dan di Bagian 9
- Kolom sistem ditambahkan: ID submit, timestamp, pengisi, status, pemeriksa
- Aturan "satu submit = banyak baris" didefinisikan
- Master data didefinisikan (Bagian 5.1); pilihan memakai dropdown
- Form Suhu: satu record per pengecekan, Tipe Unit terpisah
- Form Waste: satuan dikunci ke master, harga disalin saat dicatat
- Form Stock: Stock Awal dan Stock Akhir dihitung otomatis, tersusun per kategori;
  hubungan dengan Waste ditetapkan
- Zona waktu ditetapkan: terdeteksi otomatis dan disimpan di konfigurasi
- Tahapan: Google Form dihapus, Tahap 0 ditambahkan

**Fitur baru**

- PWA dengan pengisian offline dan antrean submit (Bagian 11)
- Spreadsheet dibuat otomatis: tab harian per form, tab data yang terurut, dashboard per form (Bagian 8)
- Login PIN dan dua tingkat role (Bagian 7)
- Menu Riwayat: melihat isian semua form di hari sebelumnya, dengan filter, riwayat per
  item, dan sorotan kekeliruan (Bagian 6.1)
- Alur "Diperiksa oleh" (Bagian 6.2)
- Laporan kekeliruan oleh staff dan koreksi oleh Pengelola dengan jejak perubahan (Bagian 6.3)
- Halaman Pengaturan: staff dan PIN, penerima email, master data (Bagian 7, 13)
- Stock Awal otomatis dari hari sebelumnya (Bagian 5.5)
- Waste dan pemakaian bahan prep mengurangi stock secara otomatis (Bagian 5.5)
- Master Resep: Prep List dalam jumlah resep menggerakkan stock bahan dan barang jadi (Bagian 5.3)
- Satuan besar per item untuk barang datang, dan daftar satuan awal (Bagian 5.1)
- Tindakan korektif saat suhu di luar standar (Bagian 5.2)
- Daftar form belum diisi di laporan harian sebagai pengingat (Bagian 10)
- Lupa PIN dengan pemberitahuan di aplikasi Pengelola (Bagian 7.2)
- Form kustom yang dibuat Pengelola, dengan jadwal (Bagian 5.6)
- Catatan gerakan stock yang boleh dikirim berkali-kali, dengan rekap harian (Bagian 5.5)
- Penyesuaian stock, stok pembuka, dan stock opname berkala dengan laporan selisih (Bagian 5.7)
- Aturan kelengkapan form dan tanda nihil (Bagian 5.8)
- Cek ulang suhu setelah kejadian di luar standar (Bagian 5.2)
- Masa simpan barang jadi dengan pengingat (Bagian 5.3)
- Nilai stock dan nilai bahan terpakai di dashboard (Bagian 8.5)
- Daftar belanja otomatis dengan saran order (Bagian 9.2)
- Rekap bulanan PDF (Bagian 9.3) dan cadangan otomatis mingguan (Bagian 9.4)
- Aturan tanggal isian, PIN 6 angka, sesi 12 jam, dan tombol Keluar (Bagian 5.0, 7.2)
- Tampilan untuk tablet, kemajuan hari ini di Beranda, dan dua grafik kecil di Dashboard
  aplikasi (Bagian 5.8, 8.5, 11; rinciannya di spesifikasi tampilan)
- Unduh PDF di iPhone dan iPad lewat lembar bagikan (Bagian 9.1)
- Keluar otomatis setelah 5 menit tidak dipakai, dan tombol "Ganti pengguna" berganti nama
  menjadi "Keluar" (Bagian 7.2)
- Hapus staff yang sudah nonaktif, tanpa menghapus barisnya di spreadsheet (Bagian 5.1)
- PDF stock per kategori: unduh satu kategori, dan satu halaman per kategori (Bagian 9.1)
- Opsional: foto bukti waste, arsip tahunan
