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
| Login | PIN 6 angka, dibuat oleh Manager/Head Kitchen. Sesi berlaku 12 jam. Ada tombol "Ganti pengguna" untuk HP yang dipakai bergantian. |
| Tanggal isian | Staff boleh mengisi untuk hari ini dan kemarin. Tanggal lebih lama hanya Pengelola. Tanggal masa depan ditolak. |
| PWA | Perlu |
| Jam closing | 21:30 |
| Laporan otomatis | Sekitar 22:15, yaitu 45 menit setelah closing |
| Zona waktu dan tanggal | Otomatis mengikuti perangkat (Bagian 4.2) |
| Batas jam pengisian form | Tidak ada |
| Batas suhu | Chiller 1°C sampai 5°C; Freezer −18°C atau lebih rendah. Tepat −18°C dianggap normal. |
| Suhu di luar standar | Tampil merah di layar dan Tindakan Korektif wajib diisi. Tanpa email instan. |
| Email alert instan | Tidak ada, baik untuk suhu maupun waste |
| Pengingat pengisian form | Bagian "belum diisi" di email laporan harian sekitar 22:15. Tidak ada email pengingat lain. |
| Penerima email | Ditambahkan dari halaman Pengaturan di website |
| Stock Inventory | Tanpa hitung fisik harian. Stock Akhir dihitung otomatis: Awal + Masuk + Hasil Prep − Keluar − Dipakai Prep − Waste + Penyesuaian. Form boleh dikirim berkali-kali sehari; tiap kiriman menambah, tidak menimpa. |
| Stock opname | Berkala, oleh Pengelola. Hasil hitung barang nyata meluruskan stock dan menghasilkan laporan selisih (Bagian 5.7). |
| Daftar belanja | Otomatis dari item di bawah stok minimum, dengan saran jumlah order. Hanya Pengelola. |
| Nilai stock | Nilai rupiah stock dan pemakaian bahan tampil di dashboard. Hanya Pengelola. |
| Masa simpan | Tiap resep bisa punya masa simpan. Aplikasi mengingatkan barang jadi yang lewat masa simpan. |
| Tanda nihil | Form yang memang kosong hari itu ditandai "Tidak ada hari ini", supaya tidak dilaporkan belum diisi (Bagian 5.8). |
| Cadangan data | Salinan spreadsheet otomatis tiap minggu; empat salinan terakhir disimpan |
| Rekap bulanan | PDF otomatis tiap awal bulan, dikirim lewat email. Hanya Pengelola. |
| Gerakan barang | Setiap gerakan dicatat sekali, di form asalnya: barang datang di Stock Masuk, prep di Prep List, barang terbuang di Form Waste, pemakaian langsung di Stock Keluar |
| Resep | Pengelola mengisi Master Resep. Prep List diisi dalam jumlah resep; stock barang jadi bertambah dan stock bahan berkurang otomatis (Bagian 5.3). |
| Satuan | Satu item satu satuan dasar, tanpa konversi umum (kg ke gr). Satuan besar opsional per item untuk barang datang, misalnya 1 dus = 12 botol (Bagian 5.1). |
| Kategori stock | Dikelola Pengelola. Form, tab Harian, dan PDF stock tersusun per kategori. |
| Nominal waste | Estimasi kerugian (Rp) = qty × harga satuan. Harga satuan diisi Pengelola di master Item. |
| Waste dan stock | Waste punya form sendiri dan langsung mengurangi stock. Stock Keluar yang diketik staff hanya pemakaian langsung, di luar prep dan waste. |
| Koreksi data | Hanya oleh Pengelola. Staff tidak bisa mengubah data setelah submit. |
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

---

## 5. Struktur Data

### 5.0 Prinsip umum

- **Satu submit = satu header + banyak baris.** Header berisi kotak info form (tanggal,
  shift, dan sejenisnya); baris berisi item. Disimpan datar di Sheet: satu baris Sheet per
  item, dengan header diulang di tiap baris.
- **Satu sheet data per form:** `Data_Suhu`, `Data_Prep`, `Data_Waste`, `Data_Stock`,
  dan satu sheet untuk tiap form kustom (Bagian 5.6).
- **Sheet pendukung:** `Data_PrepBahan` (bahan yang terpakai tiap prep), `Stock_Harian`
  (rekap stock per tanggal dan item), `Data_Penyesuaian`, `Data_Opname`, dan `Data_Nihil`.
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
| `M_Staff` | Nama, Role (Staff / Head Kitchen / Manager), PIN (tersimpan sebagai hash), Aktif, Permintaan Reset PIN (waktu) | Login, `submitted_by`, `checked_by`, pemberitahuan Lupa PIN |
| `M_Item` | Nama Item, Kategori, Satuan (dasar), Satuan Besar (opsional), Isi per Satuan Besar, Harga Satuan (Rp), Stok Minimum, Stok Maksimum (opsional), Aktif | Dropdown item, estimasi kerugian, tanda reorder, konversi barang datang |
| `M_Resep` | Item Hasil, Hasil per 1 Resep, Masa Simpan dalam hari (opsional), Aktif | Barang jadi yang dibuat lewat Prep List; pengingat masa simpan |
| `M_ResepBahan` | Item Hasil, Item Bahan, Qty per 1 Resep | Bahan yang dikurangi dari stock saat prep |
| `M_Kategori` | Nama Kategori, Urutan, Aktif | Dropdown kategori di Stock Inventory; urutan kelompok di tab Harian dan PDF |
| `M_Form` | ID Form, Nama, Jenis (bawaan / kustom), Keterangan, Jadwal (harian / hari tertentu / sewaktu-waktu), Urutan, Aktif | Daftar form yang tampil di Beranda, Riwayat, dan Laporan |
| `M_FormKolom` | ID Form, Urutan, Label, Jenis Kolom, Pilihan, Wajib, Bagian (kepala / baris), Aktif | Susunan kolom tiap form kustom |
| `M_Satuan` | Satuan, Jenis (Berat / Isi / Hitungan / Kemasan), Aktif | Daftar satuan yang sah |
| `M_Konfigurasi` | Kode Pemasangan (sekali pakai), zona waktu (terdeteksi otomatis), jam closing (21:30), jeda laporan setelah closing (45 menit), batas suhu Chiller (1 sampai 5), batas suhu Freezer (−18 atau lebih rendah), jadwal stock opname (mingguan atau bulanan), hari cadangan mingguan | Trigger terjadwal, validasi suhu, pengingat opname |

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
- Item tidak bisa dinonaktifkan selama masih menjadi bahan atau hasil resep yang aktif.
- Item yang stock-nya belum nol menampilkan peringatan saat dinonaktifkan.
- Satuan dasar sebuah item tidak bisa diganti setelah item itu punya catatan stock.

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

Contoh lain: resep Nasi putih, hasil 2,2 kg nasi, bahan beras 1 kg. Angka pada contoh
hanya ilustrasi; Pengelola mengisinya dari takaran dapur sendiri.

- Barang jadi boleh menjadi bahan resep lain, misalnya sauce dipakai di resep lain.
- Resep tidak boleh melingkar: jika A adalah bahan B, B tidak boleh menjadi bahan A, baik
  langsung maupun lewat resep lain. Server menolaknya.
- Satu item hasil hanya punya satu resep aktif.
- Jika Harga Satuan barang jadi dikosongkan, sistem menghitungnya dari harga bahan satu
  resep dibagi hasil per resep. Harga ini dipakai untuk estimasi kerugian waste.

**Form Prep List:**

| Field | Tipe | Keterangan |
|---|---|---|
| Tanggal | Date | Header, default hari ini |
| Shift | Dropdown | Header. Pagi / Siang / Malam |
| Nama Staff | Otomatis | Dari login PIN |
| Item / Menu Prep | Dropdown | Per baris, dari `M_Item` |
| Jumlah Resep | Number | Per baris, untuk item yang punya resep. Boleh pecahan: ½, 1, 1½, 2, dan seterusnya. |
| Hasil | Otomatis | Jumlah Resep × Hasil per 1 Resep, dalam satuan item hasil |
| Baik Sampai | Otomatis | Tanggal prep + masa simpan. Kosong jika resep tidak punya masa simpan. |
| Qty | Number | Hanya untuk item tanpa resep, dalam satuan item itu |
| Keterangan | Text (opsional) | Per baris |

**Yang terjadi saat Prep List dikirim (item yang punya resep):**

1. Stock item hasil **bertambah** sebesar Hasil. Ini tampil di kolom Hasil Prep pada Stock Inventory.
2. Stock tiap bahan **berkurang** sebesar Jumlah Resep × Qty per 1 Resep. Ini tampil di
   kolom Dipakai Prep.
3. Bahan yang terpakai dicatat per baris di `Data_PrepBahan`, memakai resep yang berlaku
   saat itu. Mengubah resep di kemudian hari tidak mengubah catatan lama.

Contoh: ½ resep Sauce bolognese menambah 2,5 liter sauce, dan mengurangi tomat 1,5 kg,
daging giling 0,5 kg, serta bawang 0,25 kg.

- **Item tanpa resep** tetap bisa dicatat di Prep List dengan Qty biasa. Stock tidak bergerak.
- **Stock bahan tidak cukup menurut catatan:** layar menampilkan peringatan, tetapi prep
  tetap bisa dikirim. Stock Akhir bahan itu menjadi minus dan ditandai di Riwayat.
- Hasil selalu mengikuti resep. Jika hasil nyata sering berbeda, Pengelola memperbaiki
  angka Hasil per 1 Resep di Master Resep.

**Masa simpan barang jadi:**

- Saat prep dikirim, layar menampilkan tanggal "Baik sampai", untuk ditulis di label wadah.
- Sistem tidak melacak tiap wadah. Ia memperkirakan dengan anggapan yang dibuat lebih dulu
  dipakai lebih dulu: stock yang tersisa dianggap berasal dari prep paling baru.
- Jika stock tersisa masih mencakup prep yang sudah lewat tanggal "Baik sampai", item itu
  masuk daftar **Lewat masa simpan**, lengkap dengan perkiraan jumlahnya. Prep yang habis
  masa simpannya besok masuk daftar **Habis besok**.
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
| Harga Satuan (Rp) | Otomatis | Disalin dari `M_Item` **saat dicatat**, agar perubahan harga tidak mengubah data lama |
| Estimasi Kerugian (Rp) | Otomatis | Qty × Harga Satuan |
| Foto Bukti | File (opsional) | Disimpan ke Drive, link dicatat di Sheet |

Waste tidak memicu email. Totalnya dimuat di laporan harian dan dashboard. Waste yang
dikirim **langsung mengurangi stock** item itu dan tampil di kolom Waste pada Stock Inventory.

### 5.5 Form Stock Inventory Harian

Stock tidak dihitung fisik setiap hari. Setiap gerakan barang dicatat sekali, di form
asalnya, dan Stock Akhir dihitung sistem. Kecocokannya dengan barang nyata dijaga lewat
stock opname berkala (Bagian 5.7).

**Yang diisi staff (catatan gerakan, disimpan di `Data_Stock`):**

| Field | Tipe | Keterangan |
|---|---|---|
| Tanggal | Date | Header. Hari ini atau kemarin (Bagian 5.0). |
| Kategori | Dropdown | Header, dari `M_Kategori`. Form diisi satu kategori setiap kali, supaya daftar item pendek dan sesuai jenisnya. |
| Nama Item | Otomatis | Semua item aktif di kategori itu tampil sebagai baris siap isi |
| Stock Masuk | Number | Barang datang. Boleh diketik dalam satuan besar jika item punya (Bagian 5.1). |
| Stock Keluar | Number | Pemakaian langsung saja, **di luar** prep dan waste |

- **Boleh dikirim berkali-kali sehari.** Tiap kiriman adalah catatan gerakan tersendiri dan
  **menambah**, tidak menimpa kiriman sebelumnya. Contoh: barang datang pagi 5 kg dan sore
  3 kg, lewat dua kiriman, menjadi Masuk 8 kg pada hari itu.
- Item yang Masuk dan Keluar-nya dikosongkan tidak ikut terkirim.
- Jika salah ketik, staff melaporkannya lewat Riwayat; Pengelola mengoreksi catatan
  gerakan itu (Bagian 6.3). Staff tidak mengirim angka minus untuk membatalkan.

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
- **Tersusun per kategori.** Di form, staff memilih satu kategori. Di tab Harian dan PDF,
  item dikelompokkan di bawah judul kategorinya. Kategori dikelola Pengelola.
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
meluruskannya. Keduanya hanya untuk Pengelola.

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
- **Suhu:** suhu di luar standar tampil merah; waktu cek yang tidak diisi diberi tanda.
- **Semua form:** baris yang pernah dikoreksi menampilkan nilai lama, siapa yang
  mengubah, dan kapan (diambil dari `Log_Perubahan`).

**Tombol di tampilan detail:**

| Tombol | Staff | Pengelola |
|---|---|---|
| Unduh PDF tanggal tersebut | Ya | Ya |
| Laporkan Kekeliruan | Ya | Ya |
| Koreksi | Tidak | Ya |
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

Satu hari bisa punya beberapa kiriman untuk form yang sama. Jika semuanya sudah diperiksa,
PDF mencantumkan pemeriksa terakhir dan waktunya. Jika belum, PDF menulis jumlahnya,
misalnya "2 dari 3 isian diperiksa".

### 6.3 Laporan kekeliruan dan koreksi

- **Staff tidak bisa mengubah data setelah submit.** Jika menemukan kekeliruan di Riwayat,
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
| Mengoreksi data | Tidak | Ya |
| Penyesuaian stock dan stock opname | Tidak | Ya |
| Melihat daftar belanja, nilai rupiah stock, dan rekap bulanan | Tidak | Ya |
| Melihat dashboard di aplikasi dan membuka dashboard di Google Sheets | Tidak | Ya |
| Membuat, mengubah, menyembunyikan, dan menghapus form (Pengaturan → Form) | Tidak | Ya |
| Mengganti nama outlet | Tidak | Ya |
| Mengelola staff dan PIN | Tidak | Ya |
| Mengatur penerima email | Tidak | Ya |
| Mengelola master data (item, resep, unit, kategori, satuan) dan konfigurasi | Tidak | Ya |

Role diperiksa di **server** pada setiap permintaan, bukan hanya disembunyikan di tampilan.

### 7.2 Login PIN

- PIN terdiri dari 6 angka, dibuat dan direset oleh Manager/Head Kitchen dari halaman
  Pengaturan → Staff.
- Staff memilih nama, memasukkan PIN, lalu server mengembalikan token sesi beserta role.
- PIN disimpan sebagai hash, bukan angka aslinya.
- Lima kali salah PIN berturut-turut mengunci akun staff tersebut selama 15 menit.
- Token sesi berlaku 12 jam; setelah habis, staff login ulang.
- **HP yang dipakai bergantian.** Tombol "Ganti pengguna" di Beranda mengeluarkan pengguna
  saat ini dan kembali ke layar Login. Draft dan antrean kirim disimpan per pengguna.
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
- Pemberitahuan terlihat saat Pengelola membuka aplikasi. Aplikasi tidak mengirim
  notifikasi ke HP yang aplikasinya sedang tertutup.
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
| 3 | `Data_Stock`, `Data_Suhu`, `Data_Prep`, `Data_PrepBahan`, `Data_Waste`, `Data_Penyesuaian`, `Data_Opname`, `Data_Nihil`, dan `Data_K_...` untuk tiap form kustom | Data lengkap, satu baris per item | Aplikasi |
| 4 | `M_Outlet`, `M_Unit`, `M_Staff`, `M_Item`, `M_Resep`, `M_ResepBahan`, `M_Kategori`, `M_Satuan`, `M_Form`, `M_FormKolom`, `M_Konfigurasi` | Master data dan definisi form | Aplikasi (Pengaturan) |
| 5 | `Log_Perubahan` | Jejak koreksi | Aplikasi |

Tiap kelompok tab punya warna tab sendiri, supaya mudah dibedakan.

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
  cepat, data tahun yang sudah lewat dipindahkan ke file arsip (Tahap 11), dan hitung
  ulang stock hanya menyentuh item yang terkait, tidak seluruh tab.

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
| **Kepatuhan** | Form yang belum diisi atau belum diperiksa per hari (termasuk form kustom), baris yang dilaporkan keliru |

- Blok Stock Inventory aktif sejak Tahap 2. Blok form lain sudah ada sejak pemasangan dan
  terisi saat formnya mulai dipakai.
- **Menu Dashboard di aplikasi** (hanya Pengelola) memuat angka ringkas hari ini, dua
  grafik kecil, dan tombol untuk membuka tab ini.
  - Grafik pertama: estimasi kerugian waste per hari selama 7 hari terakhir.
  - Grafik kedua: semua pengecekan suhu hari ini per unit, termasuk cek ulang.
  - Server mengirim angka ringkas dan data kedua grafik dalam satu jawaban, supaya layar
    ini cukup memanggil server sekali.

**Cara menghitung nilai:**

- Nilai stock memakai Harga Satuan yang berlaku sekarang di `M_Item`. Item tanpa harga
  tidak dihitung dan dicantumkan dalam daftar "belum punya harga".
- Nilai bahan terpakai = (Stock Keluar + Dipakai Prep) × Harga Satuan, hanya untuk item
  yang bukan hasil resep. Barang jadi tidak dihitung lagi, karena biayanya sudah terhitung
  saat bahannya dipakai.
- Nilai waste dan nilai selisih opname dilaporkan terpisah.

---

## 9. Laporan, Daftar Belanja, dan Cadangan

### 9.1 Laporan harian PDF

PDF **tidak** dibuat pada setiap submit: lambat, file menumpuk, dan nama file bertabrakan.

1. **Otomatis sekali per hari setelah closing.** Jam closing 21:30; trigger dijadwalkan
   45 menit sesudahnya (sekitar 22:15) agar suhu Closing dan stock hari itu sempat
   diisi. Trigger berbasis waktu Apps Script punya toleransi sekitar ±15 menit, jadi
   laporan keluar antara kira-kira 22:00 dan 22:30. Hasilnya disimpan ke Drive dan
   dilampirkan ke email laporan harian.
2. **Unduh oleh pengguna.** Staff dan Pengelola memilih tanggal dan form di menu Laporan,
   lalu menekan "Unduh PDF". Server mengirim isi PDF ke aplikasi. Tombol yang sama
   tersedia di menu Riwayat. Unduhan ini tidak menambah file baru di Drive.
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
   - Nama file: `{YYYY-MM-DD}_{NamaForm}.pdf`.
   - Aturan ini berlaku untuk semua unduhan PDF: laporan harian, laporan selisih
     opname, daftar belanja, dan rekap bulanan.
3. **Simpan ulang ke Drive** (khusus Pengelola), dipakai setelah ada koreksi data.
4. **Cara dibuat:** template HTML yang meniru tata letak form Word, dengan warna navy
   menggantikan hijau (kode warna di `spesifikasi_tampilan_ui.md`, Bagian 2), diubah ke PDF dengan
   `Utilities.newBlob(html, 'text/html').getAs('application/pdf')`. Dukungan CSS-nya
   terbatas, jadi template dibuat sederhana (tabel biasa). PDF stock memakai rekap
   harian dan dikelompokkan per kategori. Form kustom memakai satu template umum: judul,
   kotak info, tabel sesuai kolomnya, dan baris "Diperiksa oleh".
5. **Lokasi di Drive:**
   `Laporan Kitchen/{Nama Outlet}/{Tahun}/{Bulan}/{YYYY-MM-DD}_{NamaForm}_{HHmm}.pdf`
   Format tanggal `YYYY-MM-DD` membuat file terurut. Jam di nama file mencegah tabrakan
   jika laporan disimpan ulang.

Unduh PDF tidak memakai link Drive, karena staff tidak punya akses ke folder Drive.

### 9.2 Daftar belanja (Pengelola)

- Berisi semua item aktif yang Stock Akhir-nya di bawah Stok Minimum, dikelompokkan per kategori.
- Tiap baris: nama item, stock sekarang, stok minimum, dan **saran order**.
- Saran order = Stok Maksimum − Stock Akhir. Jika item punya satuan besar, saran
  dibulatkan ke atas ke satuan besar, misalnya butuh 20 botol menjadi 2 dus.
- Jika Stok Maksimum kosong, item tetap masuk daftar tanpa saran jumlah.
- Pengelola boleh mengubah jumlah di layar sebelum mengunduh. Perubahan itu hanya untuk
  cetakan dan tidak disimpan.
- Bisa diunduh sebagai PDF dari menu Laporan. Ringkasannya ikut di email harian.
- Daftar ini hanya saran. Aplikasi tidak memesan apa pun dan tidak mencatat pemasok.

### 9.3 Rekap bulanan PDF (Pengelola)

Dibuat otomatis tiap tanggal 1 untuk bulan sebelumnya, disimpan ke Drive di
`Laporan Kitchen/{Nama Outlet}/{Tahun}/Rekap_{YYYY-MM}.pdf`, dan dikirim ke penerima email.
Bisa juga diunduh dari menu Laporan untuk bulan mana pun.

| Bagian | Isi |
|---|---|
| Stock | Total masuk, bahan terpakai, dan penyesuaian per kategori; nilai stock akhir bulan |
| Stock opname | Tanggal tiap opname dan nilai selisihnya; item yang paling sering berselisih |
| Waste | Total jumlah dan nilai (Rp) per kategori waste; sepuluh item dengan nilai waste terbesar |
| Prep | Total resep dan hasil per item |
| Suhu | Jumlah kejadian di luar standar per unit; pengecekan yang terlewat |
| Kepatuhan | Jumlah hari tiap form tidak lengkap; isian yang belum diperiksa; laporan kekeliruan |

### 9.4 Cadangan otomatis mingguan

- Seminggu sekali, pada dini hari, server menyalin seluruh spreadsheet ke folder
  `Laporan Kitchen/Cadangan/` dengan nama yang memuat tanggalnya.
- Empat salinan terakhir disimpan; yang lebih lama dibuang ke tempat sampah Drive.
- Salinan hanya bisa dibuka pemilik dan akun yang punya akses ke folder itu.
- Memulihkan data dari cadangan dilakukan pemilik Sheet dengan tangan; aplikasi tidak
  punya tombol pulihkan.
- Jika pembuatan cadangan gagal, kegagalannya dicatat dan disebut di email harian berikutnya.

---

## 10. Email Otomatis (Gmail)

Ada **dua email otomatis**: laporan harian, dan rekap bulanan sebulan sekali
(Bagian 9.3). Tidak ada email pada setiap submit, tidak ada alert instan, dan tidak ada
email pengingat terpisah. Keterangan di bawah ini untuk laporan harian.

- **Kapan:** sekali sehari setelah closing, sekitar 22:15 (trigger yang sama dengan PDF harian).
- **Penerima:** daftar di Pengaturan → Penerima Email, diisi oleh Pengelola dari website.
- **Isi:**
  - Status setiap form aktif hari itu menurut aturan kelengkapan (Bagian 5.8): lengkap,
    nihil, atau **belum diisi**. Bagian ini adalah pengingat pengisian form.
  - Kejadian suhu di luar standar hari itu, beserta tindakan korektifnya
  - Total waste hari itu (qty dan estimasi Rp)
  - Ringkasan daftar belanja: item di bawah stok minimum dan saran ordernya
  - Item dengan Stock Akhir minus
  - Barang jadi yang lewat masa simpan atau habis besok
  - Jumlah data yang belum diperiksa, baris yang dilaporkan keliru, dan permintaan reset PIN
  - Pengingat stock opname jika sudah lewat jadwal
  - Tautan untuk membuka aplikasi
  - Lampiran: PDF laporan harian tiap form yang sudah diisi
- **Kuota:** batas akun Gmail biasa adalah 100 penerima per hari, dihitung per penerima.
  Satu email harian ke 2 atau 3 penerima hanya memakai 2 atau 3 dari batas itu.
- Jika email gagal terkirim, data tetap aman di Sheet dan kegagalannya dicatat agar
  terlihat oleh Pengelola.

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

**Yang tetap butuh sinyal:** login, Lupa PIN, Riwayat, unduh PDF, dashboard, daftar
belanja, menyimpan stock opname, halaman Pengaturan, dan pemeriksaan data.

---

## 12. Hal yang Masih Perlu Dikonfirmasi

Butir-butir berikut adalah pilihan yang diambil dokumen ini saat menafsirkan keputusan
4 Oktober 2026. Koreksi jika keliru.

**Stock dan resep**

- [ ] **Jadwal stock opname bawaan adalah mingguan.** Bisa diganti bulanan di Pengaturan.
- [ ] **Saran order** = Stok Maksimum − Stock Akhir, dibulatkan ke satuan besar.
- [ ] **Masa simpan diperkirakan**, bukan dilacak per wadah: yang dibuat lebih dulu
      dianggap dipakai lebih dulu.
- [ ] **Hasil prep selalu mengikuti resep.** Staff tidak mengetik hasil nyata; jika hasil
      nyata sering berbeda, Pengelola memperbaiki angka di Master Resep.
- [ ] **Harga barang jadi** yang dikosongkan dihitung dari harga bahan resepnya.
- [ ] **Nilai stock memakai harga yang berlaku sekarang**, bukan harga saat barang dibeli.

**Akses**

- [ ] **Staff boleh mengisi untuk hari ini dan kemarin.** Tanggal lebih lama hanya Pengelola.
- [ ] **PIN 6 angka dan sesi 12 jam.**
- [ ] **Hanya Pengelola** yang melihat nilai rupiah stock, daftar belanja, rekap bulanan,
      dan yang melakukan stock opname.
- [ ] **Nominal waste (Rp) terlihat oleh staff** di form waste. Jika harga sebaiknya hanya
      terlihat Pengelola, nominal disembunyikan dari staff.
- [ ] **Pemberitahuan Lupa PIN** baru terlihat saat Pengelola membuka aplikasi; tidak ada
      notifikasi ke HP yang aplikasinya tertutup.

**Form dan data**

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
   pertama (Kode Pemasangan, nama outlet), login PIN 6 angka, sesi 12 jam, Ganti pengguna,
   Lupa PIN, role, deteksi zona waktu otomatis, halaman Pengaturan → Staff (buat/reset PIN)
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
4. **Tahap 4 — Laporan dan email:** menu Laporan (Unduh PDF, termasuk cara simpan di
   iPhone), simpan ke Drive, trigger harian sekitar 22:15, email laporan harian, cadangan
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
- Aturan tanggal isian, PIN 6 angka, sesi 12 jam, dan Ganti pengguna (Bagian 5.0, 7.2)
- Tampilan untuk tablet, kemajuan hari ini di Beranda, dan dua grafik kecil di Dashboard
  aplikasi (Bagian 5.8, 8.5, 11; rinciannya di spesifikasi tampilan)
- Unduh PDF di iPhone dan iPad lewat lembar bagikan (Bagian 9.1)
- Opsional: foto bukti waste, arsip tahunan
