# Spesifikasi Tampilan UI: Form Operasional Kitchen

> Dokumen pendamping `spesifikasi_web_inventory_harian_v2.md`.
> File sistem mengatur data, role, alur, dan arsitektur. File ini **hanya** mengatur
> tampilan: warna, huruf, tata letak, layar, dan teks antarmuka.
> Jika keduanya berbeda soal fungsi, yang berlaku adalah file sistem.
>
> Versi 1.6, 5 Oktober 2026. Semua keputusan tampilan sudah ditetapkan (Bagian 11).
> Perubahan sejak versi 1.5: tombol "Keluar" dan pesan keluar otomatis (Bagian 5.1 dan
> 5.2), hapus staff yang sudah nonaktif (Bagian 5.7), dan pilihan kategori saat mengunduh
> PDF stock (Bagian 5.5).
> Perubahan sejak versi 1.4: cara menyimpan PDF di iPhone dan iPad (Bagian 5.5).
> Perubahan sejak versi 1.3: tampilan untuk tablet dan aturan supaya layar tidak terpotong
> (Bagian 4.6), aturan gerak yang ringan (Bagian 8), rel tiket sebagai garis kemajuan
> (Bagian 5.2), dan dua grafik kecil di Dashboard (Bagian 5.6).
> Perubahan sejak versi 1.1: kartu stock tanpa hitung fisik, prep dalam jumlah resep, satuan
> besar, Lupa PIN, form kustom, Ganti pengguna, tanda nihil, cek ulang suhu, stock opname,
> daftar belanja, masa simpan, dan aturan keadaan memuat.

---

## 1. Arah Desain

**Nama aplikasi:** InventoryKu. **Ikon:** buku (Bagian 4.5).

**Permintaan pemilik:** sederhana, modern, minimalis, sinematik, ada bar navigasi berwarna
navy, tampilan bersih.

**Siapa yang memakai dan di mana:** 4 staff dapur dan Pengelola (Head Kitchen, Manager).
Sebagian besar lewat HP, di dapur: lampu terang, tangan basah atau berminyak, sambil
bekerja. Tugas utamanya mengisi angka dengan cepat dan benar.

Dari dua hal itu, lima keputusan desain:

1. **Sinematik di bingkai, bukan di form.** Kesan sinematik (navy pekat, huruf besar,
   kontras kuat) dipakai di layar Login, kepala Beranda, dan bar navigasi. Layar isi form
   tetap terang dan polos. Form bertema gelap sulit dibaca di bawah lampu dapur dan mudah
   silau di layar yang berminyak.
2. **Satu elemen khas: rel tiket.** Beranda menampilkan setiap form sebagai tiket yang
   tergantung di rel, seperti tiket pesanan di pass dapur. Tiap tiket menunjukkan status
   hari ini, sehingga staff langsung tahu apa yang belum diisi. Relnya sekaligus menjadi
   garis kemajuan: ruasnya menyala amber setiap kali satu form selesai. Hanya ini elemen
   yang "bergaya"; sisanya tenang.
3. **Satu warna aksen.** Amber hangat, seperti lampu pemanas di pass, dan hanya muncul di
   atas permukaan navy. Navy dingin dengan satu titik hangat itulah yang memberi kesan sinematik.
4. **HP dulu.** Setiap layar dirancang untuk HP, lalu dilebarkan untuk tablet, laptop,
   dan desktop (Bagian 4.6).
5. **Gerak sebagai jawaban, bukan hiasan.** Layar bergerak hanya untuk memberi tahu bahwa
   ketukan diterima, isian terkirim, atau layar berganti. Semua gerak singkat dan ringan
   (Bagian 8).

---

## 2. Warna

Rasio kontras sudah dihitung (standar WCAG: teks minimal 4,5; garis komponen minimal 3).

**Dasar**

| Nama | Hex | Dipakai untuk | Kontras |
|---|---|---|---|
| Navy Pass | `#0B1F3A` | Bar navigasi, kepala Beranda, layar Login | Teks putih di atasnya: 16,5 |
| Biru Malam | `#16335C` | Tombol utama, item navigasi aktif | Teks putih di atasnya: 12,6 |
| Lampu Pass | `#F2A93B` | Aksen tunggal: penanda menu aktif, ruas rel tiket yang sudah terisi, titik PIN. **Hanya di atas navy.** | Di atas Navy Pass: 8,3 |
| Baja | `#F3F5F8` | Latar halaman | |
| Kertas | `#FFFFFF` | Kartu, tiket, kolom isian | |
| Tinta | `#0F1B2D` | Teks utama | Di atas Kertas: 17,3 |
| Tinta Redup | `#4A5A72` | Teks sekunder, satuan, keterangan | Di atas Kertas: 7,0 |
| Teks di Navy | `#A9B8CF` | Teks sekunder di atas navy | Di atas Navy Pass: 8,2 |
| Rel Padam | `#5A6F8F` | Ruas rel tiket yang belum terisi | Di atas Navy Pass: 3,2 |
| Garis | `#C5CEDA` | Pemisah dan tepi kartu (dekoratif) | |
| Garis Isian | `#6F7E96` | Tepi kolom isian | Di atas Kertas: 4,1 |

**Makna status** (selalu disertai ikon dan kata, tidak pernah warna saja)

| Makna | Teks | Latar | Kontras | Contoh |
|---|---|---|---|---|
| Baik | `#067647` | `#ECFDF3` | 5,4 | Normal, Diperiksa, Terkirim |
| Masalah | `#B42318` | `#FEF3F2` | 6,1 | Suhu di luar standar, Stock Akhir minus, Lewat masa simpan, Gagal kirim |
| Perlu ditinjau | `#B54708` | `#FFFAEB` | 5,2 | Dilaporkan keliru, Perlu reorder, Stock bahan tidak cukup, Habis besok, Opname lewat jadwal |
| Menunggu | `#3B5374` | `#EEF2F7` | 7,0 | Menunggu kirim, Belum diisi, Nihil |

Aturan: tidak ada gradasi warna, tidak ada foto latar, tidak ada bayangan tebal. Kedalaman
ditunjukkan dengan garis tipis dan beda warna latar.

**Laporan PDF dan tab Harian di spreadsheet**

Keduanya memakai navy supaya seragam dengan website, menggantikan hijau tua di form Word.
Tata letaknya tetap mengikuti form Word. Di PDF stock yang berisi semua kategori, tiap
kategori mulai di halaman baru (aturannya di spesifikasi sistem, Bagian 9.1).

| Bagian | Di form Word (lama) | Di PDF dan tab Harian (baru) |
|---|---|---|
| Judul form | Hijau `#1F3D1F` | Navy Pass `#0B1F3A` |
| Baris judul tabel | Latar hijau `#2F5233`, teks putih | Latar Navy Pass `#0B1F3A`, teks putih |
| Garis di bawah judul | Hijau `#2F5233` | Navy Pass `#0B1F3A` |
| Teks kepala dan kaki halaman | Abu `#8A8A8A` | Tinta Redup `#4A5A72` |
| Garis tabel | Abu muda `#C9C9C9` | Garis `#C5CEDA` |
| Nilai bermasalah (Stock Akhir minus, suhu di luar standar) | Tidak ada | Teks Masalah `#B42318`, tebal |
| Baris judul kategori (laporan stock) | Tidak ada | Latar Baja `#F3F5F8`, teks Tinta tebal, rata kiri |

Aksen amber tidak dipakai di PDF maupun spreadsheet.

---

## 3. Huruf

Satu keluarga dengan dua lebar, supaya seragam tetapi judul tetap berkarakter:

| Peran | Huruf | Ukuran / tebal |
|---|---|---|
| Tanggal di kepala Beranda | Barlow Condensed | 40 px, 600 |
| Judul layar | Barlow Condensed | 28 px, 600 |
| Judul tiket dan kartu | Barlow | 18 px, 600 |
| Teks isi dan isian form | Barlow | 16 px, 400 |
| Angka yang diisi | Barlow | 20 px, 500 |
| Keterangan, satuan | Barlow | 14 px, 400 |

- Barlow dan Barlow Condensed adalah huruf bebas lisensi (OFL). File hurufnya disimpan
  bersama aplikasi, tidak diambil dari internet, supaya tetap tampil saat offline.
- Angka memakai lebar tetap (`font-variant-numeric: tabular-nums`) dan rata kanan di tabel,
  supaya kolom angka lurus.
- Isian form tidak boleh lebih kecil dari 16 px. Di bawah itu iPhone otomatis memperbesar
  layar saat kolom diketuk.
- Huruf kecil-besar biasa (sentence case). Tidak ada label huruf kapital semua.
- Desimal ditampilkan dengan koma (12,5). Isian menerima koma maupun titik.

---

## 4. Tata Letak dan Navigasi

### 4.1 Menu per role

| Menu | Staff | Pengelola |
|---|---|---|
| Beranda (isi form) | Ya | Ya |
| Riwayat | Ya | Ya |
| Laporan | Ya | Ya |
| Dashboard | Tidak | Ya |
| Pengaturan | Tidak | Ya |

Menu yang bukan haknya tidak ditampilkan sama sekali.

Untuk Pengelola, menu Laporan juga memuat Daftar belanja dan Rekap bulanan, dan menu
Dashboard memuat tombol Stock opname. Jumlah menu utama tetap lima.

### 4.2 HP dan tablet (di bawah 1.024 px)

Bar navigasi navy di **bawah**, supaya terjangkau ibu jari. Kepala layar navy tipis di atas.
Tablet ikut aturan ini karena sama-sama dipakai dengan jari.

```
┌──────────────────────────────┐
│▓ Riwayat            ● Online ▓│  kepala navy: judul layar + status sinyal
├──────────────────────────────┤
│                              │
│   isi layar, 1 kolom         │
│   latar Baja, kartu Kertas   │
│                              │
├──────────────────────────────┤
│▓ Beranda   Riwayat   Laporan ▓│  bar navigasi navy, ikon + kata
└──────────────────────────────┘
```

Menu aktif ditandai garis amber di atas ikonnya. Pengelola melihat 5 menu, staff 3.

| Lebar layar | Contoh perangkat | Susunan isi |
|---|---|---|
| Di bawah 600 px | HP tegak | Satu kolom. Tiap baris form menjadi satu kartu. Tiket Beranda dua per baris. |
| 600 sampai 1.023 px | Tablet tegak, HP dimiringkan, laptop kecil dengan skala layar besar | Kartu form berjajar dua kolom. Tiket Beranda tiga per baris. Lembar bawah dan kelompok menu di bar navigasi berada di tengah, lebar maksimal 600 px. |

### 4.3 Laptop dan desktop (1.024 px ke atas)

Bar navigasi navy di **atas**, selebar layar. Isi di tengah dengan lebar maksimal 1.200 px,
supaya tabel form tampil penuh. Tablet yang dimiringkan (lebar 1.024 px ke atas) ikut
aturan ini.

```
┌──────────────────────────────────────────────────────────────┐
│▓ InventoryKu   Beranda  Riwayat  Laporan  Dashboard  Pengaturan    Rina ▾ ▓│
├──────────────────────────────────────────────────────────────┤
│                                                              │
│        isi layar, tabel penuh, maksimal 1.200 px             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Di kiri bar: ikon buku dan nama aplikasi. Di kanan: nama pengguna. Klik nama itu untuk
membuka menu berisi satu pilihan, "Keluar". Karena bar ini ada di semua layar, tombol
"Keluar" bisa dicapai dari layar mana pun.

Titik lebar hanya dua: **600 px** (kartu form menjadi dua kolom) dan **1.024 px** (bar
navigasi pindah ke atas, tabel menggantikan kartu, dua kolom di Dashboard dan Riwayat).
Aturan untuk semua lebar layar ada di Bagian 4.6.

### 4.4 Jarak dan bentuk

- Kelipatan jarak: 4, 8, 12, 16, 24, 32 px. Tepi layar: 16 px di HP, 24 px di tablet dan
  desktop.
- Sudut: tiket 4 px (seperti kertas), kolom isian 8 px, tombol 10 px.
- Tinggi kolom isian dan tombol: 48 px. Jarak antar sasaran sentuh minimal 8 px.

### 4.5 Nama dan ikon aplikasi

- **Nama:** InventoryKu, ditulis menyambung dengan I dan K kapital. Nama ini tampil di
  bawah ikon setelah aplikasi di-install, di layar Login, dan di bar navigasi laptop/desktop.
- **Ikon:** buku sederhana bergaya garis, warna Kertas, di atas latar Navy Pass. Pembatas
  bukunya berwarna Lampu Pass (amber), satu-satunya aksen.
- Bentuk dibuat sederhana supaya tetap terbaca pada ukuran kecil: tanpa tulisan di dalam ikon.
- Ukuran yang disiapkan: 192 px dan 512 px untuk Android (termasuk versi *maskable* dengan
  gambar di dalam 80% bagian tengah), dan 180 px untuk iPhone.
- Warna bilah atas HP saat aplikasi terbuka: Navy Pass.

### 4.6 Lebar layar dan aturan supaya tampilan tidak terpotong

Aplikasi yang sama dipakai di HP, tablet, laptop, dan desktop. Aturan di bawah berlaku
untuk semua layar.

**Batas dan gulir**

- Lebar terkecil yang didukung: 320 px. Tidak ada lebar terbesar: di atas 1.200 px isi
  tetap di tengah dan bar navy tetap selebar layar.
- Halaman **tidak pernah bergulir ke samping**, pada lebar berapa pun.
- Tabel yang lebih lebar dari layar digulir ke samping **di dalam bingkainya sendiri**.
  Kolom pertama (nama item atau tanggal) tetap diam di kiri, dengan garis tepi kanan
  berwarna Garis Isian sebagai tanda bahwa tabel bisa digeser. Contohnya tabel riwayat
  per item di HP.
- Lembar bawah dan dialog tingginya paling banyak 90% tinggi layar. Isinya bergulir di
  dalam, dan tombol aksinya selalu terlihat.

**Teks**

- Nama item, nama form, dan nama staff yang panjang turun ke baris berikutnya, tidak
  dipotong.
- Angka dan satuannya tidak pernah terpisah baris: "12,5 kg" selalu utuh.
- Tulisan menu di bar navigasi selalu satu baris. Pada lebar di bawah 360 px ukurannya
  boleh turun dari 12 px ke 11 px.

**Tepi layar HP**

- Tinggi layar dihitung dari bagian yang benar-benar terlihat (satuan `dvh`, bukan `vh`),
  supaya bar bawah tidak tertutup bilah alamat browser.
- Jarak aman untuk poni, sudut bulat, dan garis home dipakai (`viewport-fit=cover` dan
  `env(safe-area-inset-*)`). Kepala layar, bar navigasi bawah, bilah kirim, dan lembar
  bawah menambah jarak itu, sehingga tidak ada tombol yang tertutup. Saat HP dimiringkan,
  jarak aman kiri dan kanan ikut dipakai.

**Papan ketik**

- Selama papan ketik terbuka, bar navigasi bawah disembunyikan supaya ruang isi tidak habis.
- Kolom yang sedang diisi selalu terlihat utuh di atas papan ketik, bersama labelnya.
- Bilah kirim tidak boleh menutupi kolom yang sedang diisi.

**Layar pendek** (tinggi di bawah 500 px, misalnya HP dimiringkan)

- Kepala layar dan bar navigasi menipis menjadi 48 px. Ikon dan tulisan menu sejajar.
- Kepala Beranda tidak lagi sepertiga layar: tanggal mengecil ke 28 px dan kepala cukup
  setinggi isinya.
- Layar Login menjadi dua kolom: nama dan judul di kiri, papan angka di kanan, tombol 48 px.

**Arah layar, skala, dan alat penunjuk**

- Arah layar tidak dikunci. Aplikasi mengikuti HP atau tablet yang diputar tanpa
  kehilangan isian.
- Tata letak mengikuti lebar yang tersisa, bukan jenis perangkat. Laptop Windows 1.366 px
  dengan skala layar 150% terbaca sekitar 911 px dan mendapat susunan tablet. Itu memang
  yang diinginkan.
- Zoom browser sampai 200% tetap tanpa gulir ke samping.
- Ukuran sasaran sentuh sama di semua lebar layar, karena banyak laptop berlayar sentuh.
- Efek saat kursor berada di atas tombol (hover) hanya untuk perangkat yang memakai mouse.

**Ukuran uji**

Setiap layar diperiksa pada delapan ukuran ini sebelum dianggap selesai:

| Ukuran (px) | Mewakili |
|---|---|
| 320 × 568 | HP kecil, batas terkecil |
| 360 × 800 | HP Android umum |
| 390 × 844 | iPhone |
| 844 × 390 | HP dimiringkan |
| 768 × 1.024 | Tablet tegak |
| 1.024 × 768 | Tablet dimiringkan |
| 1.366 × 768 | Laptop Windows |
| 1.920 × 1.080 | Monitor desktop |

Lulus jika: halaman tidak bergulir ke samping, tidak ada teks atau tombol yang terpotong
atau saling menimpa, semua tombol bisa dijangkau, dan tombol kirim terlihat.

---

## 5. Layar

### 5.1 Login

Satu-satunya layar yang sepenuhnya navy.

- Ikon buku dan nama "InventoryKu" dengan huruf Barlow Condensed besar, rata kiri, di
  sepertiga atas. Nama outlet di bawahnya dengan warna Teks di Navy.
- **Pilih nama:** nama staff tampil sebagai tombol besar (hanya ada beberapa orang, jadi
  tidak perlu dropdown atau mengetik).
- **PIN:** papan angka besar di layar, 3 kolom, tombol 64 px. Enam titik PIN terisi amber
  satu per satu; setelah angka keenam, login langsung diproses tanpa tombol tambahan.
- PIN salah: enam titik PIN bergoyang sekali (Bagian 8), tulisan "PIN salah. Sisa 4 percobaan."
- Terkunci: "Terkunci 15 menit. Minta Head Kitchen atau Manager mereset PIN."
- **Lupa PIN?** Tautan kecil di bawah papan angka, muncul setelah nama dipilih. Ketuk,
  lalu konfirmasi: "Kirim permintaan reset PIN untuk Rina?" Setelah terkirim:
  "Permintaan terkirim. Minta PIN baru ke Head Kitchen atau Manager."
- Jika permintaan untuk nama itu sudah ada: "Permintaan sudah dikirim pukul 08.10."
- **Pulihkan akses Pengelola:** tautan kecil di bagian paling bawah layar, hanya untuk
  keadaan darurat saat tidak ada Pengelola yang bisa masuk. Meminta Kode Pemasangan baru.
- **Setelah keluar otomatis:** di atas pilihan nama tampil satu baris keterangan: "Keluar
  otomatis karena 5 menit tidak dipakai. Isian yang belum dikirim tetap tersimpan."
  Angka menitnya mengikuti pengaturan. Keterangan hilang setelah sebuah nama dipilih.
  Tidak ada hitung mundur atau peringatan sebelum keluar.
- Di tablet dan desktop, isi layar Login berada di tengah dengan lebar maksimal 420 px.
  Latar navy tetap memenuhi layar.

### 5.2 Beranda (rel tiket)

```
┌──────────────────────────────┐
│▓                             ▓│
│▓ Sabtu, 3 Oktober            ▓│  tanggal, 40 px
│▓ Nama Outlet        ● Online ▓│
│▓ 1 dari 4 form terisi        ▓│  kemajuan hari ini
│▓ ┅┅┅┅┅┅ ┅┅┅┅┅┅ ━━━━━━ ┅┅┅┅┅┅ ▓│  rel: ruas terisi amber, sisanya padam
│ ┌────────────┐┌────────────┐ │
│ │Stock       ││Suhu        │ │  tiket menggantung dari rel
│ │Belum diisi ││Opening ✓   │ │
│ │            ││Middle  ✓   │ │
│ │            ││Closing –   │ │
│ └────────────┘└────────────┘ │
│ ┌────────────┐┌────────────┐ │
│ │Prep list   ││Waste       │ │
│ │Terkirim    ││Belum diisi │ │
│ │14.05, Rina ││            │ │
│ └────────────┘└────────────┘ │
│                              │
│ 1 isian menunggu kirim       │
├──────────────────────────────┤
│▓ Beranda   Riwayat   Laporan ▓│
└──────────────────────────────┘
```

- Kepala navy mengisi kira-kira sepertiga atas layar. Tiket Kertas menumpuk sebagian di
  atasnya, sehingga terlihat tergantung di rel.
- Tiap tiket: nama form, status hari ini, lalu siapa dan jam berapa terakhir mengisi.
  Status ditunjukkan dengan tanda status (ikon dan kata), tanpa strip warna di sisi tiket.
- Ketuk tiket untuk membuka form. Form yang sudah terkirim tetap bisa dibuka untuk
  menambah isian (misalnya kategori stock lain, barang datang berikutnya, atau waste berikutnya).
- **Rel sebagai garis kemajuan.** Rel terbagi menjadi ruas yang sama lebar, satu ruas per
  form yang wajib hari itu, dalam urutan tiket. Ruas menyala amber (Lampu Pass) saat
  formnya lengkap menurut aturan kelengkapan di spesifikasi sistem Bagian 5.8: terkirim,
  ditandai nihil, atau semua pengecekan suhu terisi. Ruas lain berwarna Rel Padam.
  Form berjadwal "Sewaktu-waktu", form di luar jadwalnya, dan form yang disembunyikan
  tidak punya ruas. Rel selalu satu garis; makin banyak form, makin pendek ruasnya.
- Di atas rel tertulis kemajuannya dengan warna Teks di Navy: "1 dari 4 form terisi".
  Warna rel tidak pernah menjadi satu-satunya tanda.
- **Momen selesai.** Saat form terakhir hari itu lengkap, seluruh rel menyala dan
  tulisannya berganti menjadi "Semua form hari ini sudah terisi", berwarna putih dengan
  ikon centang. Tidak ada efek lain.
- **Status di tiket** mengikuti aturan kelengkapan: "Belum diisi", "Terkirim", atau
  "Nihil" untuk form yang ditandai tidak ada hari ini. Tiket Suhu menampilkan kemajuan,
  misalnya "7 dari 9 pengecekan".
- **Nama pengguna dan Keluar.** Di kepala navy, di bawah nama outlet, tampil nama yang
  sedang masuk, dengan ikon panah kecil supaya terlihat bisa diketuk. Ketuk untuk membuka
  pilihan "Keluar". Jika masih ada isian di antrean: "2 isian Rina belum terkirim. Isian
  tetap tersimpan dan dikirim saat Rina masuk lagi." Tombol ini sebelumnya bernama
  "Ganti pengguna".
- **Masa simpan.** Di bawah tiket, untuk semua role: daftar "Lewat masa simpan" (tanda
  Masalah) dan "Habis besok" (tanda Perlu ditinjau), tiap baris dengan tombol "Catat
  sebagai waste". Daftar tidak tampil jika kosong.
- Di tablet tiket berjajar tiga per baris. Di laptop/desktop empat per baris.
- **Form kustom** tampil sebagai tiket tambahan dengan bentuk yang sama, mengikuti urutan
  yang diatur Pengelola. Form yang disembunyikan tidak tampil. Jika tiket lebih dari empat,
  layar digulir; rel dan kepala navy tetap di tempatnya.
- Pengelola melihat tambahan di bawah tiket: "3 isian belum diperiksa" dan
  "1 baris dilaporkan keliru", masing-masing membuka Riwayat dengan filter yang sesuai.
- **Permintaan reset PIN** tampil paling atas untuk Pengelola, dengan tanda Perlu
  ditinjau: "Rina meminta reset PIN". Ketuk untuk langsung membuka layar reset PIN staff itu.
- **Pengingat stock opname** untuk Pengelola jika sudah lewat jadwal: "Stock opname
  terakhir 9 hari lalu." Ketuk untuk membuka layar Stock opname.

### 5.3 Isi form

**Pola umum (semua form):**

- Kepala form: judul, lalu kotak info (tanggal, dan shift atau kategori bila ada).
- Di HP tiap baris form menjadi **satu kartu**. Di tablet kartu berjajar dua kolom. Di
  laptop/desktop menjadi tabel seperti form kertas.
- Nilai yang dihitung otomatis tampil sebagai teks biasa berwarna Tinta Redup, bukan kolom
  isian, supaya jelas mana yang harus diisi.
- Bilah bawah tetap: penghitung isian di kiri ("8 dari 12 item terisi"), tombol kirim di kanan.
- Draft tersimpan otomatis; tulisan kecil "Draft tersimpan 14.02" di bawah judul.
- Kolom angka memunculkan papan angka (`inputmode="decimal"`).
- **Tanggal** berupa dua tombol: "Hari ini" (terpilih) dan "Kemarin". Pengelola punya
  tombol ketiga, "Tanggal lain", yang membuka pemilih tanggal.
- **Tidak ada hari ini.** Di form Stock, Prep List, Waste, dan form kustom, selama belum
  ada isian untuk tanggal itu, tampil tombol kedua "Tidak ada hari ini". Setelah ditekan,
  layar menulis "Ditandai nihil oleh Rina, 21.10" dan form tetap bisa diisi jika ternyata ada.

**Stock Inventory** (kartu di HP):

```
┌──────────────────────────────┐
│ Tomat                     kg │
│ Awal 12                      │  otomatis
│ Hari ini: masuk 5, dipakai   │  otomatis: yang sudah tercatat
│ prep 1,5, waste 0,5          │
│ Tambah masuk [  ][kg▾]       │  diisi
│ Tambah keluar [  ]           │  diisi
│ Stock akhir 15               │  otomatis, berubah saat mengetik
└──────────────────────────────┘
```

- Staff hanya mengisi dua angka per item: barang datang dan pemakaian langsung. Tidak ada
  hitung fisik di form ini.
- **Form boleh dikirim berkali-kali sehari.** Karena itu kolomnya bernama "Tambah masuk"
  dan "Tambah keluar": angka yang diketik menambah yang sudah tercatat, tidak menggantinya.
- Baris "Hari ini" merangkum semua yang sudah tercatat pada tanggal itu: masuk, keluar,
  hasil prep, dipakai prep, waste, dan penyesuaian. Yang bernilai nol tidak ditulis.
- Prep dan waste tidak diketik di sini. Angkanya datang dari Prep List dan Form Waste.
- **Satuan besar:** jika item punya satuan besar, di samping kolom Tambah masuk ada pilihan
  satuan (misalnya botol atau dus). Saat staff mengetik 2 dus, di bawahnya tampil
  "= 24 botol".
- Pilih kategori di kotak info; kartu item kategori itu langsung tampil. Satu kategori
  diisi dan dikirim setiap kali.
- Stock akhir ditulis lebih besar dari angka otomatis lain (18 px, tebal), karena itulah
  hasil yang dicari.
- Stock akhir minus: angka dan kartu diberi tanda Masalah dengan tulisan
  "Stock akhir minus. Periksa angka yang diketik, atau minta Pengelola meluruskan stock."
- Stock akhir di bawah stok minimum: tanda Perlu ditinjau "Perlu reorder".
- Di laptop/desktop: tabel dengan kolom No, Nama Item, Stock Awal, Tercatat Hari Ini,
  Tambah Masuk, Tambah Keluar, Stock Akhir, Satuan. Kolom otomatis berlatar Baja.
- Di PDF dan tab Harian, item dikelompokkan di bawah baris judul kategorinya, dengan
  kolom lengkap: Awal, Masuk, Hasil Prep, Keluar, Dipakai Prep, Waste, Penyesuaian, Akhir.

**Suhu:**

- Pilih waktu cek (Opening, Middle, Closing) dengan tiga tombol besar; yang sudah diisi diberi centang.
- Satu kartu per unit: nama unit, tipe, batas normal ("Normal: 1 sampai 5 °C"), kolom suhu.
- **Tombol ± di samping kolom suhu.** Papan angka iPhone tidak punya tanda minus. Unit
  Freezer langsung terisi tanda minus.
- Di luar standar: kartu bertanda Masalah dan kolom "Tindakan korektif" muncul di
  bawahnya, wajib diisi sebelum bisa dikirim.
- **Cek ulang.** Setelah isian di luar standar terkirim, kartu unit itu menampilkan tombol
  "Catat cek ulang". Cek ulang juga bisa dipilih sebagai tombol waktu cek keempat. Hasil
  cek ulang tampil di bawah isian aslinya, dengan jamnya: "Cek ulang 15.40: 4 °C, normal".
- Unit yang waktu ceknya sudah diisi tampil sebagai teks, bukan kolom isian, supaya tidak
  diisi dua kali.

**Prep List:**

```
┌──────────────────────────────┐
│ Sauce bolognese        [hapus]│
│ Jumlah resep                 │
│ [ ½ ] [ 1 ] [ 1½ ] [ 2 ] [  ]│  tombol cepat + isian angka lain
│ Hasil 2,5 liter              │  otomatis
│ Bahan: tomat 1,5 kg, daging  │  otomatis
│ giling 0,5 kg, bawang 0,25 kg│
│ Keterangan [               ] │
└──────────────────────────────┘
```

- Tombol "Tambah item" membuka pencarian item; ketik beberapa huruf, pilih dari daftar.
- Item yang punya resep: jumlah resep dipilih lewat tombol ½, 1, 1½, 2, atau diketik di
  kolom terakhir. Hasil dan bahan yang terpakai langsung tampil di bawahnya.
- Item tanpa resep: kolom Qty biasa dengan satuannya, tanpa baris Hasil dan Bahan.
- Jika resep punya masa simpan, di bawah Hasil tampil "Baik sampai 7 Okt" dengan huruf
  tebal, untuk disalin ke label wadah. Tulisan yang sama muncul lagi di pesan setelah terkirim.
- Bahan yang stock-nya tidak cukup menurut catatan diberi tanda Perlu ditinjau:
  "Stock tomat tercatat 1 kg, resep ini butuh 1,5 kg." Prep tetap bisa dikirim.

**Waste:**

- Tombol "Tambah item" sama seperti Prep List.
- Satu kartu per item: kategori waste berupa pilihan tombol, qty, satuan (otomatis),
  alasan, estimasi kerugian (otomatis), dan foto bukti (opsional).
- Di HP, item yang sudah selesai diisi diringkas menjadi satu baris; hanya item yang
  sedang diisi yang terbuka.
- Geser kartu ke kiri atau ketuk ikon tempat sampah untuk menghapus baris sebelum dikirim.

**Form kustom:**

- Memakai pola umum yang sama: kolom kepala di kotak info, lalu satu kartu per baris di
  HP dan tablet, dan tabel di laptop/desktop. Tombol "Tambah baris" di bilah bawah.
- Tampilan tiap jenis kolom: Teks dan Angka sebagai kolom isian; Pilihan sebagai tombol
  berjajar jika pilihannya empat atau kurang, selebihnya dropdown; Ya/Tidak sebagai dua
  tombol; Item sebagai pencarian item; Jam sebagai pemilih waktu.
- Tombol kirim memakai nama form: "Kirim" diikuti nama form dalam huruf kecil.

### 5.4 Riwayat

- **Atas:** pilihan form (tombol berjajar; bisa digeser ke samping jika form lebih dari
  empat), lalu tanggal. Filter lain (kategori, item,
  unit, pengisi, status) ada di balik tombol "Filter".
- **Daftar:** dikelompokkan per tanggal, tanggal sebagai judul kelompok. Tiap baris: form,
  pengisi, jam, jumlah baris, tanda status.
- **Detail:** tata letak sama dengan layar isi form, tetapi semua nilai berupa teks.
  Baris yang pernah dikoreksi menampilkan nilai lama dicoret, diikuti nilai baru, nama
  pengoreksi, dan waktunya.
- **Riwayat Stock punya dua tampilan**, dipilih lewat dua tombol di atas daftar:
  "Catatan" (tiap kiriman: siapa, jam, item, masuk, keluar) dan "Rekap harian" (satu
  baris per item per hari, dikelompokkan per kategori).
- **Riwayat per item** (Stock): ketuk nama item, muncul lembar dari bawah berisi tabel
  7 rekap terakhir item itu (Awal, Masuk, Hasil Prep, Keluar, Dipakai Prep, Waste,
  Penyesuaian, Akhir). Hari dengan Stock Akhir minus diberi tanda Masalah. Stock Masuk
  yang diketik dalam satuan besar menampilkan angka aslinya: "24 botol (2 dus)". Di HP
  tabel ini digulir ke samping di dalam lembar, dengan kolom tanggal tetap diam (Bagian 4.6).
- **Sesuaikan stock** (Pengelola): tombol di lembar riwayat per item. Isinya satu kolom
  "Stock sebenarnya", pilihan alasan, dan catatan. Sebelum disimpan tampil
  "Tercatat 12 kg, sebenarnya 10 kg. Selisih −2 kg."
- Tanda nihil, penyesuaian, dan stock opname tampil di daftar pada tanggalnya, dengan
  ikon yang berbeda dari isian biasa.
- **Laporkan kekeliruan:** ikon bendera di tiap baris. Ketuk, tulis catatan, kirim.
  Baris lalu bertanda Perlu ditinjau.
- **Pengelola** melihat tombol tambahan di detail: "Koreksi" dan "Tandai diperiksa".
- Isian yang masih di antrean offline tampil paling atas dengan tanda Menunggu.

### 5.5 Laporan

- Pilih tanggal, pilih form, tombol "Unduh PDF".
- **Kategori (hanya untuk form Stock).** Begitu form Stock dipilih, muncul pilihan ketiga
  berlabel "Kategori". Nilai awalnya "Semua kategori"; di bawahnya daftar kategori yang
  aktif. Pilih satu kategori untuk mengunduh PDF yang hanya berisi kategori itu. Bentuk
  pilihannya sama dengan pilihan kategori di layar isi stock. Untuk form lain, pilihan
  ini tidak tampil.
- Saat PDF dibuat: tombol berubah menjadi "Membuat PDF…" dengan indikator putar.
- **Di Android, laptop, dan desktop:** begitu PDF siap, file langsung tersimpan ke folder
  unduhan dan muncul pesan "PDF diunduh."
- **Di iPhone dan iPad:** begitu PDF siap, tombol berganti menjadi **"Simpan PDF"**, dengan
  petunjuk di bawahnya: "Ketuk Simpan PDF, lalu pilih Save to Files." Ketukan pada tombol
  itu membuka lembar bagikan iPhone. Setelah lembar ditutup, tombol kembali menjadi
  "Unduh PDF".
  - Unduhan biasa tidak dipakai di iPhone dan iPad. Di aplikasi yang terpasang ke layar
    utama, file yang diunduh biasa terbuka menutupi aplikasi dan tidak ada jalan kembali.
  - Jika iPhone itu tidak mendukung berbagi file, tombol "Simpan PDF" tidak ditampilkan.
    Sebagai gantinya tampil pesan: "iPhone ini belum bisa menyimpan file dari aplikasi.
    Buka alamat website di Safari, lalu unduh dari sana."
- Aturan ini berlaku untuk semua tombol unduh PDF: laporan harian, laporan selisih opname,
  daftar belanja, dan rekap bulanan.
- Pengelola melihat tombol kedua: "Simpan ulang ke Drive".
- Pengelola juga melihat dua bagian tambahan di bawahnya: **Daftar belanja** (Bagian 5.9)
  dan **Rekap bulanan** (pilih bulan, lalu "Unduh PDF").

### 5.6 Dashboard (Pengelola)

- Angka ringkas hari ini dalam satu baris: form terisi, belum diperiksa, suhu di luar
  standar, item di bawah stok minimum, total waste (Rp), dan nilai stock (Rp).
- Tombol "Stock opname" di bagian atas, dengan tanggal opname terakhir di sampingnya.
- Di bawahnya daftar "Perlu perhatian", diurutkan dari yang paling mendesak.
- **Dua grafik kecil** di bawah daftar itu. Di laptop/desktop keduanya berada di kolom kanan.

```
┌──────────────────────────────┐
│ Waste 7 hari terakhir        │
│ Rp 1.240.000, tertinggi Kamis│
│                  █           │
│  █               █       ▄   │
│  █   ▄       ▄   █   ▄   █   │
│ Min Sen Sel Rab Kam Jum Sab  │
└──────────────────────────────┘
┌──────────────────────────────┐
│ Suhu hari ini                │
│ 1 pengecekan di luar standar │
│ Chiller 1  ░░●░●●░░     3 °C │
│ Chiller 2  ░░░●░░░░ ▲   7 °C │
│ Freezer 1  ░●●░░░░░   −20 °C │
└──────────────────────────────┘
  ░ batas normal   ● pengecekan   ▲ di luar standar
```

- **Waste 7 hari terakhir:** tujuh batang, satu per hari, hari ini paling kanan. Tinggi
  batang adalah estimasi kerugian (Rp) hari itu. Nama hari tertulis di bawah tiap batang.
  Hari tanpa waste tidak punya batang. Ketuk batang untuk melihat tanggal dan nilainya.
  Keadaan kosong: "Belum ada waste dalam 7 hari terakhir."
- **Suhu hari ini:** satu baris per unit aktif. Tiap baris berisi nama unit, pita batas
  normal, satu titik untuk tiap pengecekan hari ini (Opening, Middle, Closing, dan cek
  ulang) pada posisi suhunya, lalu suhu terakhir sebagai angka di kanan. Ketuk baris untuk
  melihat daftar jam dan suhunya. Keadaan kosong: "Belum ada pengecekan suhu hari ini."
  - Titik di luar pita memakai warna Masalah **dan** bentuk segitiga, sehingga tidak
    dibedakan dengan warna saja.
  - Skala tiap baris: batas normal tipe unit itu, dilebarkan 4 °C ke tiap sisi. Untuk
    Chiller (normal 1 sampai 5 °C) skalanya −3 sampai 9 °C. Freezer tidak punya batas
    bawah, jadi skalanya −30 sampai −14 °C. Suhu di luar skala ditaruh di tepi.
- **Aturan kedua grafik:**
  - Digambar aplikasi sendiri dengan SVG, tanpa library grafik.
  - Warna: batang dan titik Biru Malam, pita normal berlatar warna Baik, titik di luar
    standar berwarna Masalah. Amber tidak dipakai, karena amber hanya untuk permukaan navy.
  - Tiap grafik punya satu baris ringkasan teks di atasnya (total 7 hari dan hari
    tertinggi; jumlah pengecekan di luar standar), sehingga isinya terbaca tanpa melihat
    gambarnya.
  - Tampil langsung, tanpa animasi. Tinggi grafik waste 120 px; lebarnya mengikuti kartu.
  - Datanya datang bersama angka ringkas dalam satu panggilan ke server.
- Tombol "Buka dashboard di Google Sheets" untuk grafik lengkap dan pilihan periode.
- Layar ini tetap ringkasan: hanya dua grafik itu. Tren lain ada di spreadsheet.

### 5.7 Pengaturan (Pengelola)

- Daftar bagian: Staff dan PIN, Penerima email, Form, Item, Resep, Unit, Kategori dan
  satuan, Outlet dan jadwal (nama outlet, zona waktu, jam closing, jadwal stock opname).
- Tiap bagian berupa daftar dengan tombol "Tambah" di atas; ketuk baris untuk mengubah.
- Reset PIN meminta konfirmasi: "Reset PIN Rina? PIN lama langsung tidak berlaku."
- Staff yang meminta reset PIN diberi tanda Perlu ditinjau di daftar Staff.

**Pengaturan → Staff dan PIN:**

- Staff aktif tampil lebih dulu. Staff nonaktif tampil di bawahnya dengan tanda "Nonaktif"
  dan teks Tinta Redup.
- Layar ubah staff punya sakelar "Aktif" / "Nonaktif".
- **Hapus.** Tombol "Hapus" hanya tampil di layar ubah staff yang sudah nonaktif, di bagian
  paling bawah, berwarna Masalah, terpisah dari tombol simpan. Untuk staff yang masih
  aktif, di tempat itu tertulis: "Nonaktifkan dulu untuk bisa menghapus."
- Hapus meminta konfirmasi: "Hapus Rina dari daftar staff? Namanya tetap tampil di riwayat.
  Tindakan ini tidak bisa dibatalkan dari aplikasi." Tombolnya "Hapus" dan "Batal".
- Setelah dihapus, nama itu hilang dari daftar dan muncul pesan "Rina dihapus dari daftar
  staff."

**Pengaturan → Outlet dan jadwal:**

- Selain nama outlet, zona waktu, jam closing, dan jadwal stock opname, ada pilihan
  "Keluar otomatis setelah tidak dipakai": 5, 10, 15, atau 30 menit. Nilai awalnya 5 menit.
  Di bawahnya satu baris keterangan: "Berlaku untuk semua pengguna di semua perangkat."

**Pengaturan → Item:**

- Isian: nama, kategori, satuan, harga satuan, stok minimum, dan stok maksimum (opsional,
  dipakai untuk saran order).
- Item baru menampilkan ajakan setelah disimpan: "Isi stok pembuka sekarang?" yang membuka
  Sesuaikan stock dengan alasan Stok pembuka.
- Sakelar "Datang dalam kemasan besar". Jika dinyalakan, muncul dua isian: satuan besar
  dan isinya, ditulis sebagai kalimat: "1 [dus] berisi [12] botol".

**Pengaturan → Resep:**

- Daftar resep: nama barang jadi dan hasil per resep, misalnya "Sauce bolognese, 5 liter".
- Layar ubah resep: pilih item hasil, isi "Hasil per 1 resep" dan "Masa simpan (hari)"
  yang opsional, lalu daftar bahan. Tiap bahan satu baris: nama item, jumlah, dan
  satuannya (otomatis). Tombol "Tambah bahan".
- Resep yang melingkar ditolak dengan pesan yang menyebut itemnya: "Sauce dasar sudah
  memakai Sauce bolognese sebagai bahan."
- Di bawah daftar bahan tampil perkiraan biaya satu resep dan harga per satuan hasil,
  dihitung dari harga bahan.
- Mengubah resep menampilkan catatan: "Perubahan berlaku untuk prep berikutnya. Catatan
  lama tidak berubah."

**Pengaturan → Form:**

- Daftar semua form, bawaan dan kustom, dalam urutan Beranda. Tiap baris: nama form,
  tanda "Bawaan" atau "Kustom", sakelar tampil/sembunyi, dan pegangan untuk menggeser urutan.
- Tombol "Buat form" membuka layar susun form:

```
┌──────────────────────────────┐
│▓ ‹ Buat form                 ▓│
├──────────────────────────────┤
│ Nama form   [Checklist kebersihan]
│ Keterangan  [Diisi tiap closing ]
│                              │
│ Kolom kepala                 │
│  Area         Pilihan     ⋮  │
│  + Tambah kolom kepala       │
│                              │
│ Kolom baris                  │
│  Butir        Teks        ⋮  │
│  Bersih       Ya/Tidak    ⋮  │
│  Catatan      Teks        ⋮  │
│  + Tambah kolom baris        │
├──────────────────────────────┤
│ [Lihat pratinjau] [Simpan form]
└──────────────────────────────┘
```

- Di bawah Keterangan ada pilihan **Jadwal**: "Setiap hari", "Hari tertentu" (pilih
  harinya), atau "Sewaktu-waktu".
- "Tambah kolom" membuka lembar bawah: label, jenis kolom, pilihan (jika jenisnya
  Pilihan), dan sakelar wajib.
- "Lihat pratinjau" menampilkan layar isi form itu persis seperti yang akan dilihat staff.
- Menu titik tiga di tiap kolom: ubah, geser, hapus.
- Menghapus kolom atau form selalu meminta konfirmasi dan menyebut akibatnya:
  "Hapus form Checklist kebersihan? Form hilang dari aplikasi. Isian lamanya tetap
  tersimpan di spreadsheet."
- Form bawaan dibuka dengan layar yang sama, tetapi daftar kolomnya terkunci; hanya nama
  dan sakelar tampil/sembunyi yang bisa diubah.

### 5.8 Stock opname (Pengelola)

```
┌──────────────────────────────┐
│▓ ‹ Stock opname              ▓│
├──────────────────────────────┤
│ Kategori [Protein ▾]         │
│                              │
│ Ayam fillet               kg │
│ Tercatat 8,5   Hitung [    ] │
│                              │
│ Daging sapi slice         kg │
│ Tercatat 6,5   Hitung [ 6  ] │
│ Selisih −0,5                 │
├──────────────────────────────┤
│ 7 dari 12 dihitung  [Lanjut] │
└──────────────────────────────┘
```

- Satu baris per item: stock tercatat sebagai teks, lalu kolom "Hitung". Selisih muncul
  begitu angka diketik; selisih bukan nol memakai tanda Perlu ditinjau.
- Item yang dikosongkan tidak dihitung dan tidak diubah.
- "Lanjut" membuka ringkasan: jumlah item berselisih, daftar selisihnya, dan total nilai
  (Rp). Tombol utamanya "Simpan opname".
- Setelah disimpan: "Opname tersimpan. 3 item diluruskan." dengan tombol "Unduh laporan selisih".
- Isian tersimpan sebagai draft, sehingga hitungan bisa dilanjutkan jika terputus.

### 5.9 Daftar belanja (Pengelola)

- Daftar item di bawah stok minimum, dikelompokkan per kategori. Tiap baris: nama item,
  stock sekarang, stok minimum, dan kolom "Order" yang sudah terisi saran.
- Saran yang dibulatkan ke satuan besar ditulis lengkap: "2 dus (24 botol)".
- Angka Order bisa diubah sebelum diunduh. Di bawah daftar: "Perubahan di sini hanya untuk
  cetakan."
- Tombol utama "Unduh PDF". Jika tidak ada item di bawah minimum: "Semua stock di atas
  batas minimum."

---

## 6. Komponen

| Komponen | Aturan |
|---|---|
| Tombol utama | Latar Biru Malam, teks putih, tinggi 48 px. Satu per layar. |
| Tombol kedua | Latar Kertas, tepi Garis Isian, teks Tinta. |
| Tombol berbahaya | Teks Masalah, selalu dengan konfirmasi. |
| Kolom isian | Latar Kertas, tepi Garis Isian 1 px, tinggi 48 px. Saat aktif: tepi Biru Malam 2 px. |
| Kartu / tiket | Latar Kertas, tepi Garis 1 px, tanpa bayangan. |
| Keadaan tekan | Tombol, tiket, dan baris yang bisa diketuk sedikit menggelap dan mengecil saat ditekan (Bagian 8). Efek hover hanya untuk mouse. |
| Rel kemajuan | Garis 3 px di kepala Beranda, terbagi menjadi ruas dengan celah 4 px. Ruas terisi berwarna Lampu Pass, ruas lain Rel Padam. Selalu disertai tulisan kemajuannya (Bagian 5.2). |
| Tanda status | Kapsul kecil: ikon + kata, warna sesuai tabel makna status. |
| Pita sinyal | Muncul di bawah kepala layar saat offline: "Tidak ada sinyal. Isian disimpan di HP dan dikirim nanti." |
| Pesan singkat (toast) | Di atas bar navigasi, hilang setelah 4 detik. |
| Lembar bawah | Untuk filter, riwayat per item, laporkan kekeliruan, dan tambah kolom form di HP. Di tablet lebarnya maksimal 600 px, di tengah. Di desktop menjadi dialog. |
| Tabel lebar | Bergulir ke samping di dalam bingkainya sendiri; kolom pertama tetap diam (Bagian 4.6). |
| Grafik kecil | Digambar dengan SVG tanpa library, dengan ringkasan teks di atasnya (Bagian 5.6). |
| Sakelar | Untuk tampil/sembunyi form dan tanda wajib. Selalu disertai kata keadaannya ("Tampil" / "Disembunyikan"). |
| Keadaan memuat | Server bisa butuh beberapa detik. Layar menampilkan data yang tersimpan di HP lebih dulu, dengan tulisan kecil "Memperbarui…". Jika belum ada data tersimpan, tampil kerangka abu-abu berbentuk kartu, bukan layar kosong. |
| Tombol saat memproses | Tombol yang ditekan langsung nonaktif dan tulisannya berganti: "Mengirim…", "Membuat PDF…", "Menyimpan…". |
| Tombol unduh PDF | Di Android, laptop, dan desktop file langsung tersimpan. Di iPhone dan iPad tombol berganti menjadi "Simpan PDF" yang membuka lembar bagikan (Bagian 5.5). |
| Keadaan kosong | Satu kalimat yang menyebut apa yang kosong dan apa yang bisa dilakukan, misalnya "Belum ada resep. Ketuk Tambah untuk membuat resep pertama." |

---

## 7. Teks Antarmuka

Bahasa Indonesia sehari-hari, singkat, tanpa istilah sistem. Tombol menyebut apa yang
terjadi, dan pesan sesudahnya memakai kata yang sama.

| Tempat | Teks |
|---|---|
| Tombol kirim | "Kirim stock", "Kirim suhu", "Kirim prep list", "Kirim waste" |
| Setelah terkirim | "Stock terkirim." |
| Terkirim saat offline | "Tersimpan di HP. Dikirim saat ada sinyal." |
| Antrean berhasil dikirim | "2 isian terkirim." |
| Gagal kirim | "Belum terkirim. Periksa sinyal, lalu ketuk Kirim ulang." |
| Kolom wajib kosong | "Isi jumlah resep untuk Sauce bolognese." |
| Tombol kirim prep | "Kirim prep list" lalu "Prep list terkirim. Stock bahan dan barang jadi sudah diperbarui." |
| Lupa PIN terkirim | "Permintaan terkirim. Minta PIN baru ke Head Kitchen atau Manager." |
| Pemberitahuan untuk Pengelola | "Rina meminta reset PIN" |
| Form kustom tersimpan | "Form tersimpan dan sudah tampil di Beranda." |
| Sudah ada isian yang sama | "Suhu Opening Chiller 1 sudah diisi Rina pukul 07.10." |
| Tandai nihil | Tombol "Tidak ada hari ini", lalu "Waste ditandai nihil untuk hari ini." |
| Tawaran cek ulang | "Suhu Chiller 2 di luar standar. Catat cek ulang setelah tindakan korektif." |
| Masa simpan | "Sauce bolognese: sekitar 1,5 liter lewat masa simpan (baik sampai 4 Okt)." |
| Keluar | "Keluar dari akun Rina?" dengan tombol "Keluar" dan "Batal" |
| Keluar otomatis (di layar Login) | "Keluar otomatis karena 5 menit tidak dipakai. Isian yang belum dikirim tetap tersimpan." |
| Hapus staff | "Hapus Rina dari daftar staff? Namanya tetap tampil di riwayat. Tindakan ini tidak bisa dibatalkan dari aplikasi." |
| Staff dihapus | "Rina dihapus dari daftar staff." |
| Staff masih aktif | "Nonaktifkan dulu untuk bisa menghapus." |
| Pilihan kategori di Laporan | Label "Kategori", nilai awal "Semua kategori" |
| Tanggal ditolak | "Staff hanya bisa mengisi untuk hari ini dan kemarin. Minta Pengelola mengisi tanggal ini." |
| Opname tersimpan | "Opname tersimpan. 3 item diluruskan." |
| Kemajuan hari ini | "1 dari 4 form terisi" |
| Semua form lengkap | "Semua form hari ini sudah terisi" |
| Ringkasan grafik waste | "Rp 1.240.000, tertinggi Kamis" |
| Ringkasan grafik suhu | "1 pengecekan di luar standar", atau "Semua pengecekan normal" |
| Grafik waste kosong | "Belum ada waste dalam 7 hari terakhir." |
| Grafik suhu kosong | "Belum ada pengecekan suhu hari ini." |
| PDF terunduh | "PDF diunduh." |
| PDF siap di iPhone dan iPad | Tombol "Simpan PDF", dengan petunjuk "Ketuk Simpan PDF, lalu pilih Save to Files." |
| iPhone tidak mendukung berbagi file | "iPhone ini belum bisa menyimpan file dari aplikasi. Buka alamat website di Safari, lalu unduh dari sana." |
| Riwayat kosong | "Belum ada isian pada tanggal ini." |
| Tanda diperiksa | "Diperiksa Budi, 3 Okt 21.50" |
| Laporan kekeliruan terkirim | "Laporan terkirim ke Pengelola." |

Pesan kesalahan menyebut apa yang salah dan apa yang harus dilakukan. Tidak ada
permintaan maaf dan tidak ada kode teknis.

---

## 8. Gerak

Gerak punya satu tugas: memberi tahu bahwa sesuatu terjadi. Ketukan diterima, isian
terkirim, layar berganti. Tidak ada gerak yang hanya hiasan. Di dapur, layar sering
berminyak, jadi tanda "ketukan Anda masuk" lebih penting daripada keindahan.

### 8.1 Daftar gerak

| Gerak | Kapan | Bentuk | Lama |
|---|---|---|---|
| Pembuka | Sekali setiap aplikasi dibuka | Tanggal di kepala Beranda muncul perlahan, lalu tiket turun ke rel satu per satu | Tanggal 400 ms; tiap tiket 150 ms dengan jeda 50 ms; paling banyak 8 tiket yang bergerak, sisanya langsung tampil |
| Tekan | Tombol, tiket, baris daftar, atau tombol papan PIN ditekan | Latar sedikit menggelap dan ukurannya turun ke 98% | 100 ms |
| Cap terkirim | Tanda status berganti menjadi Terkirim, Nihil, atau Diperiksa | Tanda status muncul dari ukuran 115% ke 100% sambil menjadi jelas, seperti dicap | 150 ms |
| Ruas rel menyala | Satu form menjadi lengkap | Ruas rel berganti dari Rel Padam ke Lampu Pass dengan memudar | 200 ms |
| Momen selesai | Form terakhir hari itu lengkap | Ruas terakhir menyala dan tulisan kemajuan berganti dengan memudar | 300 ms, sekali |
| Penanda menu | Pindah menu | Garis amber bergeser ke menu yang baru | 200 ms |
| Ganti layar | Pindah layar | Isi layar baru memudar masuk; bingkai navy tetap diam | 120 ms |
| Lembar bawah dan dialog | Dibuka atau ditutup | Lembar naik dari bawah; dialog memudar | Buka 200 ms, tutup 150 ms |
| Pesan singkat dan pita sinyal | Muncul atau hilang | Bergeser 8 px sambil memudar | 200 ms |
| Titik PIN | Tiap angka PIN diketuk | Titik amber muncul dengan memudar | 100 ms |
| PIN salah | PIN ditolak | Enam titik PIN bergoyang ke kiri dan kanan sekali | 300 ms |
| Kerangka memuat | Menunggu data pertama | Kerangka abu-abu berdenyut pelan | 1,2 detik per denyut; berhenti saat data tiba |
| Indikator putar | Tombol sedang memproses | Lingkaran kecil berputar di dalam tombol | Selama memproses |

### 8.2 Aturan supaya tetap ringan

1. **Hanya CSS.** Semua gerak dibuat dengan `transition` dan `@keyframes`. Tanpa library
   animasi, dan tanpa animasi yang dihitung JavaScript tiap bingkai.
2. **Hanya dua sifat yang digerakkan:** `transform` (geser, skala, putar) dan `opacity`
   (jelas atau pudar). Keduanya paling ringan bagi HP. Yang tidak boleh digerakkan: lebar,
   tinggi, jarak, posisi, bayangan, dan blur. Satu pengecualian: warna latar pada keadaan
   tekan.
3. **Singkat.** Gerak yang terlihat berkali-kali sehari paling lama 200 ms. Gerak lain
   paling lama 300 ms. Hanya Pembuka yang boleh 400 ms. Kerangka memuat dan indikator
   putar diatur butir 6.
4. **Tanpa pantulan.** Gerak masuk melambat di akhir (`ease-out`), gerak keluar makin cepat
   (`ease-in`). Tidak ada efek memantul atau melenting.
5. **Tidak pernah menunda pekerjaan.** Kolom isian langsung bisa diketik, ketukan saat
   gerak berjalan tetap diterima, dan data tidak menunggu gerak selesai.
6. **Paling banyak satu gerak yang terus berjalan** di satu layar (kerangka memuat atau
   indikator putar), dan gerak itu berhenti begitu data tiba atau proses selesai.
7. **Grafik tampil langsung,** tanpa animasi.
8. **Kurangi gerak.** Jika perangkat diatur "kurangi gerak" (`prefers-reduced-motion`),
   semua gerak geser, skala, goyang, dan denyut dimatikan. Perubahan keadaan langsung
   jadi, dan pesan teksnya tetap tampil. Indikator putar tetap ada, karena ia memberi
   tahu bahwa proses masih berjalan.

### 8.3 Yang tidak dipakai

Animasi saat layar digulir, latar yang bergerak, angka yang berhitung naik, animasi masuk
di tiap kartu setiap kali layar dibuka, dan gerak hiasan yang berulang tanpa henti.

---

## 9. Aksesibilitas dan Batas Minimum

- Kontras teks minimal 4,5; tepi kolom isian minimal 3 (lihat Bagian 2).
- Sasaran sentuh minimal 44 × 44 px; kolom isian dan tombol 48 px.
- Makna tidak pernah disampaikan dengan warna saja: selalu ada ikon dan kata.
- Fokus papan ketik terlihat jelas (garis Biru Malam 2 px) di laptop/desktop.
- Semua kolom isian punya label yang selalu terlihat, bukan hanya teks contoh di dalam kolom.
- Layar tetap terbaca saat ukuran huruf perangkat diperbesar hingga 200%.
- Setiap layar lulus delapan ukuran uji di Bagian 4.6.
- Pengaturan "kurangi gerak" di perangkat dihormati (Bagian 8.2).
- Grafik selalu punya ringkasan teks. Nilai bermasalah dibedakan dengan bentuk, bukan
  hanya warna.

---

## 10. Yang Sengaja Tidak Dipakai

| Tidak dipakai | Alasan |
|---|---|
| Tema gelap di layar isi form | Sulit dibaca di bawah lampu dapur, silau di layar berminyak |
| Foto atau video latar | Memperlambat aplikasi dan mengganggu keterbacaan angka |
| Gradasi warna dan efek kaca | Tidak menambah informasi; membuat tampilan tidak bersih |
| Lebih dari satu warna aksen | Aksen akan berebut dengan warna makna status |
| Animasi masuk di setiap kartu, animasi saat menggulir, latar bergerak, angka berhitung naik | Memperlambat pengisian dan menyita tenaga HP |
| Library animasi dan library grafik | Menambah berat unduhan; CSS dan SVG sudah cukup |
| Mengunci arah layar | Tablet sering dipakai mendatar |

---

## 11. Keputusan yang Sudah Ditetapkan

Ditetapkan pemilik sistem pada 3 sampai 5 Oktober 2026. Tidak ada butir terbuka.

| Topik | Keputusan |
|---|---|
| Gaya sinematik | Hanya di bingkai: Login, kepala Beranda, bar navigasi. Layar isi form tetap terang. |
| Warna laporan PDF dan tab Harian | Navy, seragam dengan website (Bagian 2) |
| Nama aplikasi | InventoryKu |
| Ikon aplikasi | Buku (Bagian 4.5) |
| Bar navigasi di laptop/desktop | Di atas |
| Bar navigasi di HP | Di bawah |
| Bar navigasi di tablet | Di bawah sampai lebar 1.023 px; di atas mulai 1.024 px |
| Gerak | Ditambah secukupnya, hanya sebagai jawaban atas tindakan, dengan aturan ringan (Bagian 8) |
| Garis kemajuan hari ini | Digabung dengan rel tiket di kepala Beranda (Bagian 5.2) |
| Momen selesai | Rel menyala penuh dan tulisan "Semua form hari ini sudah terisi" |
| Grafik di Dashboard aplikasi | Dua grafik kecil: waste 7 hari terakhir dan suhu hari ini (Bagian 5.6) |
| Unduh PDF di iPhone dan iPad | Dua langkah: "Unduh PDF", lalu "Simpan PDF" lewat lembar bagikan (Bagian 5.5) |
| Tombol keluar | Bernama "Keluar", di menu nama pengguna: kepala Beranda di HP dan tablet, bar atas di desktop |
| Keluar otomatis | Setelah 5 menit tidak dipakai, tanpa peringatan, dengan keterangan di layar Login (Bagian 5.1) |
| Hapus staff | Hanya untuk staff nonaktif, dengan konfirmasi (Bagian 5.7) |
| PDF stock | Bisa diunduh per kategori; untuk semua kategori, satu halaman per kategori (Bagian 5.5) |
