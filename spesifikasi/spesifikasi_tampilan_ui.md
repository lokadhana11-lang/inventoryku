# Spesifikasi Tampilan UI: Form Operasional Kitchen

> Dokumen pendamping `spesifikasi_web_inventory_harian_v2.md`.
> File sistem mengatur data, role, alur, dan arsitektur. File ini **hanya** mengatur
> tampilan: warna, huruf, tata letak, layar, dan teks antarmuka.
> Jika keduanya berbeda soal fungsi, yang berlaku adalah file sistem.
>
> Versi 1.12, 17 Oktober 2026. Semua keputusan tampilan sudah ditetapkan (Bagian 11).
> Tambahan 22 Oktober 2026 (keputusan pemilik, dari telaah aplikasi): hari libur, yaitu Pengaturan → Hari
> libur, kemajuan dan tiket Beranda pada hari libur, ubin Form terisi di Dashboard, form kustom, dan
> teks penjualan (Bagian 5.2, 5.3, 5.6, 5.7, 5.10, 5.11, 7, dan 11).
> Perubahan sejak versi 1.11 (dipilih pemilik dari pratinjau "Pratinjau Gerak InventoryKu", 17 Oktober
> 2026): perpindahan layar yang mulus (View Transitions) dengan nama tiket yang terbang ke judul
> layar form, dan angka utama yang berhitung naik dalam 0,9 detik (Bagian 8.1, 8.2, 8.3, 8.5, 10,
> dan 11). Pemilik juga mencabut larangan library animasi dan library grafik.
> Perubahan sejak versi 1.10 (dipilih pemilik dari pratinjau "Pilihan Pola InventoryKu", 17 Oktober
> 2026, pola C): permukaan navy tanpa garis, berupa cahaya lembut dan butiran halus, menggantikan
> tekstur garis; bar navigasi bawah dari kaca buram; kartu bertepi garis rambut dengan bayangan yang
> lebih tipis (Bagian 2, 4.2, 4.7, 6, 10, dan 11).
> Tambahan 18 Oktober 2026 (permintaan pemilik): kartu stok di lembar riwayat per item, yaitu
> pilihan "Rekap harian" / "Transaksi" (Bagian 5.4).
> Tambahan 18 Oktober 2026 (permintaan pemilik): kolom "Hasil aktual" di Prep List dan Riwayat Prep
> (Bagian 5.3 dan 5.4).
> Tambahan 18 Oktober 2026 (keputusan pemilik): pemasok dan harga beli, yaitu pilihan Pemasok dan
> kolom "Harga beli" di form Stock, Pengaturan → Pemasok, dan butir "harga beli berbeda" di Dashboard
> (Bagian 5.3, 5.4, 5.6, 5.7).
> Tambahan 18 Oktober 2026 (permintaan pemilik): kartu "Pengingat stock" di Outlet dan jadwal dan satu
> baris di lembar "Notifikasi di HP ini" untuk Pengelola (Bagian 5.7 dan 5.11).
> Tambahan 28 Oktober 2026 (permintaan pemilik, dari telaah aplikasi): kartu "Pengingat sebelum closing"
> di Outlet dan jadwal dan satu baris di lembar "Notifikasi di HP ini" untuk semua role (Bagian 5.7 dan 5.11).
> Tambahan 28 Oktober 2026 (permintaan pemilik, dari telaah aplikasi): tombol "Betulkan" dan tanda "Bisa
> dibetulkan sampai …" untuk Staff di Riwayat (Bagian 5.4 dan 7).
> Tambahan 28 Oktober 2026 (permintaan pemilik, dari telaah aplikasi): layar "Ganti harga beberapa item" dan
> "Tambah dari Excel/Sheets" dari Pengaturan → Item (Bagian 5.7 dan 7).
> Tambahan 28 Oktober 2026 (permintaan pemilik, dari telaah aplikasi): food cost sementara di layar HPP dan
> Dashboard selama penjualan belum lengkap (Bagian 5.6, 5.10, dan 7).
> Tambahan 28 Oktober 2026 (permintaan pemilik, dari telaah aplikasi): daftar Perlu perhatian di Dashboard
> dikelompokkan "Hari ini" dan "Rutin" (Bagian 5.6).
> Tambahan 28 Oktober 2026 (permintaan pemilik, dari telaah aplikasi): barang jadi yang dinilai dari resepnya
> di lembar Nilai stock dan Pengaturan → Item (Bagian 5.6 dan 5.7).
> Tambahan 29 Oktober 2026 (permintaan pemilik, dari telaah aplikasi): "Tambah menu" di form Waste untuk
> waste per porsi menu, tanda "Menu" di Riwayat, dan keterangannya di layar HPP (Bagian 5.3, 5.4, 5.10).
> Tambahan 29 Oktober 2026 (permintaan pemilik): "Tambah item" di tiap kelompok Daftar belanja dan
> kelompok "Pemasok lain" (Bagian 5.9).
> Tambahan 20 Oktober 2026 (permintaan pemilik, dari telaah aplikasi): form Stock punya pilihan "Semua
> kategori", kotak "Cari item", dan pilihan "Catat pemakaian: Tambah keluar / Hitung sisa"; layar Stock
> opname punya kotak "Cari item" (Bagian 5.3, 5.8, dan 7).
> Tambahan 19 Oktober 2026 (permintaan pemilik, dari telaah aplikasi): tombol "Tandai diperiksa (n)" di
> judul tiap tanggal di daftar Riwayat untuk Pengelola (Bagian 5.4 dan 7).
> Tambahan 21 Oktober 2026 (keputusan pemilik, dari telaah aplikasi): Daftar belanja per pemasok dengan
> "Kirim ke WhatsApp", "Pesan ke", dan "Pesanan belum datang"; kartu "Pesanan menunggu" dengan "Isi dari
> pesanan" di form Stock (Bagian 5.3, 5.9, dan 7).
> Tambahan 19 Oktober 2026 (permintaan pemilik, dari telaah aplikasi): di tabel Stock laptop/desktop,
> harga beli dan baik sampai pindah ke bawah angka Tambah Masuk seperti di kartu HP, supaya tabel muat
> dan Stock Akhir selalu terlihat (Bagian 5.3).
> Tambahan 19 Oktober 2026 (keputusan pemilik): masa simpan barang masuk, yaitu isian "Masa simpan
> (hari, tidak wajib)" di Pengaturan → Item dan "Baik sampai" yang terisi otomatis di form Stock dan
> bisa dikoreksi di Riwayat (Bagian 5.3, 5.4, 5.7).
> Tambahan 17 Oktober 2026 (permintaan pemilik): tombol "Hapus" di layar ubah item untuk item
> nonaktif yang belum punya catatan (Bagian 5.7, 7, dan 11).
> Tambahan 17 Oktober 2026 (permintaan pemilik): notifikasi ke HP, yaitu pilihan "Notifikasi" di menu
> nama pengguna, lembar "Notifikasi di HP ini", dan kartu "Pengingat cek suhu" di Outlet dan jadwal
> (Bagian 4.3, 5.2, 5.7, 5.11, dan 7).
> Tambahan 17 Oktober 2026 (permintaan pemilik): porsi terjual per menu di lembar Catat penjualan,
> kartu "Seharusnya vs nyata" dan food cost seharusnya di layar HPP, porsi terjual di Per menu
> (Bagian 5.10 dan 7).
> Tambahan 17 Oktober 2026 (permintaan pemilik, keamanan login): pesan kunci 24 jam di Login,
> pemberitahuan akun terkunci di Beranda dan Dashboard Pengelola, tanda kunci di Staff dan PIN, dan
> pesan PIN yang terlalu mudah ditebak (Bagian 5.1, 5.2, 5.7, dan 7).
> Perubahan sejak versi 1.9 (dipilih pemilik dari pratinjau "Rancangan HPP InventoryKu", 17 Oktober
> 2026): layar HPP dan food cost yang dibuka dari Dashboard (Bagian 5.6 dan 5.10), Pengaturan →
> Menu dan dua isian HPP di Outlet dan jadwal (Bagian 5.7), ringkasan kepala untuk keduanya (Bagian
> 4.7), nominal rupiah waste disembunyikan dari Staff (Bagian 5.3), teks baru (Bagian 7 dan 11).
> Perubahan sejak versi 1.8 (dipilih pemilik dari pratinjau Login 17 Oktober 2026, supaya Login
> lebih bersih): HP mengingat orang yang terakhir masuk, jadi Login langsung menyapanya ("Halo,
> Rina") dengan papan angka PIN; daftar nama berupa lingkaran inisial dan hanya tampil saat HP
> belum mengingat siapa pun atau "Ganti nama" diketuk (Bagian 5.1, 8.4, dan 11).
> Perubahan sejak versi 1.7 (permintaan pemilik 12 Oktober 2026: bar, logo, dan nama yang
> premium, dan tampilan penuh gerak supaya tidak monoton): bar navigasi bawah yang mengambang
> dengan pil menu aktif, bar atas dengan pil dan nama outlet (Bagian 4.2 dan 4.3), logo berupa
> lencana dan nama dua warna (Bagian 4.5), baris merek di kepala Beranda (Bagian 5.2), dan
> gerak yang jauh lebih banyak: isi layar naik bertahap, bagian yang muncul saat digulir, angka
> utama yang naik ke tempatnya, grafik yang tumbuh, dan cahaya pelan di permukaan navy (Bagian 8,
> 10, dan 11). Aturan ringannya tetap: hanya CSS, hanya `transform` dan `opacity`, dan semuanya
> mati saat perangkat diatur "kurangi gerak".
> Perubahan sejak versi 1.6 (arah premium, dipilih pemilik dari pratinjau 11 Oktober 2026):
> kepala navy berisi ringkasan di setiap layar (Bagian 4.2, 4.3, dan 4.7), bayangan lembut
> menggantikan garis tepi kartu, tekstur garis halus di permukaan navy, angka utama yang
> lebih besar, sudut baru (Bagian 2, 3, 4.4, dan 6), tiket berikon dengan potongan sobek
> (Bagian 5.2), nilai stock di kepala Dashboard dan ubin berikon (Bagian 5.6), grafik riwayat
> harga (Bagian 5.7), dan grafik kosong yang tetap menggambar sumbunya (Bagian 5.6).
> Diperbarui 11 Oktober 2026: riwayat harga item. Harga sekarang, lembar "Ganti harga", dan
> "Riwayat harga" di Pengaturan → Item (Bagian 5.7); baris selisih karena perubahan harga di
> lembar Nilai stock (Bagian 5.6).
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

**Nama aplikasi:** InventoryKu. **Ikon:** buku terbuka (Bagian 4.5).

**Permintaan pemilik:** sederhana, modern, minimalis, sinematik, ada bar navigasi berwarna
navy, tampilan bersih.

**Siapa yang memakai dan di mana:** 4 staff dapur dan Pengelola (Head Kitchen, Manager).
Sebagian besar lewat HP, di dapur: lampu terang, tangan basah atau berminyak, sambil
bekerja. Tugas utamanya mengisi angka dengan cepat dan benar.

Dari dua hal itu, lima keputusan desain:

1. **Sinematik di bingkai, bukan di form.** Kesan sinematik (navy pekat, huruf besar,
   kontras kuat) dipakai di layar Login, kepala navy setiap layar, dan bar navigasi. Kepala
   itu membawa judul dan angka utama layarnya (Bagian 4.7). Isian di bawahnya tetap terang:
   form bertema gelap sulit dibaca di bawah lampu dapur dan mudah silau di layar yang berminyak.
2. **Satu elemen khas: rel tiket.** Beranda menampilkan setiap form sebagai tiket yang
   tergantung di rel, seperti tiket pesanan di pass dapur. Tiap tiket menunjukkan status
   hari ini, sehingga staff langsung tahu apa yang belum diisi. Relnya sekaligus menjadi
   garis kemajuan: ruasnya menyala amber setiap kali satu form selesai. Hanya ini elemen
   yang "bergaya"; sisanya tenang.
3. **Satu warna aksen.** Amber hangat, seperti lampu pemanas di pass, dan hanya muncul di
   atas permukaan navy. Navy dingin dengan satu titik hangat itulah yang memberi kesan sinematik.
4. **HP dulu.** Setiap layar dirancang untuk HP, lalu dilebarkan untuk tablet, laptop,
   dan desktop (Bagian 4.6).
5. **Hidup, tetapi tidak pernah menghalangi.** Setiap layar masuk dengan gerak: kepala dan
   isinya naik bertahap, bagian yang digulir muncul saat terlihat, angka utama dan grafik
   naik ke tempatnya, dan permukaan navy punya cahaya yang bergeser pelan. Ketukan tetap
   dijawab seketika, isian langsung bisa diketik, dan semua gerak ringan (Bagian 8).

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
| Garis Halus | `#E3E8EF` | Pemisah di dalam kartu (dekoratif) | |
| Navy Dalam | `#071528` | Klip tiket di rel | |
| Navy Lapis | `#132B4D` | Permukaan di atas navy (kotak angka utama, chip di kepala) | Teks putih di atasnya: 13,6 |
| Garis Navy | `#24406A` | Tepi dan pemisah di atas navy | |

**Makna status** (selalu disertai ikon dan kata, tidak pernah warna saja)

| Makna | Teks | Latar | Kontras | Contoh |
|---|---|---|---|---|
| Baik | `#067647` | `#ECFDF3` | 5,4 | Normal, Diperiksa, Terkirim |
| Masalah | `#B42318` | `#FEF3F2` | 6,1 | Suhu di luar standar, Stock Akhir minus, Lewat masa simpan, Gagal kirim |
| Perlu ditinjau | `#B54708` | `#FFFAEB` | 5,2 | Dilaporkan keliru, Perlu reorder, Stock bahan tidak cukup, Habis besok, Opname lewat jadwal |
| Menunggu | `#3B5374` | `#EEF2F7` | 7,0 | Menunggu kirim, Belum diisi, Nihil |

Aturan: tidak ada gradasi warna dan tidak ada foto latar di layar isi. Kedalaman ditunjukkan
dengan bayangan lembut berlapis dan beda warna latar:

- **Kartu** (versi 1.11): garis rambut 1 px Navy Pass 7% di sekeliling kartu, ditambah bayangan
  `0 1px 2px` (4%) dan bayangan panjang yang tipis `0 12px 32px` menyusut 12 px (18%). Garis
  rambut hampir tidak terlihat, tetapi membuat tepi kartu tegas di atas Baja. Dipakai semua kartu,
  bingkai tabel, kartu form, dan menu kecil. Pemisah di dalam kartu tetap garis (Garis Halus).
- **Bayangan tiket** (tiket Beranda, kotak angka yang menggantung di kepala): `0 2px 4px` dan
  `0 14px 28px`, Navy Dalam 18% dan 16%, supaya terlihat tergantung.
- **Permukaan navy** (versi 1.11, menggantikan tekstur garis versi 1.7): kepala Beranda, kepala
  setiap layar, dan layar Login memakai Navy Pass dengan cahaya biru lembut di kanan atas
  (`#3A68AA`, 50%, memudar sampai 62% lebar), cahaya amber yang sangat samar di kiri tengah (8%),
  dan gradasi tegak dari `#0E2546` ke Navy Pass, sehingga tepi bawahnya tetap Navy Pass dan
  menyambung dengan pita di bawah rel. Di atasnya butiran halus (derau putih 22%, ubin 160 px,
  dicampur overlay), seperti kertas cetak; butiran juga mencegah gradasi tampak belang di layar
  HP. Pita di bawah rel dan bar atas desktop: Navy Pass dengan butiran yang sama. Semuanya gambar
  diam (CSS dan SVG kecil di dalam CSS), hanya di permukaan navy, tidak pernah di belakang teks
  isian.
- **Cahaya navy** (versi 1.8): satu bercak lingkaran Garis Navy yang memudar ke tepinya, bergeser
  pelan di belakang isi kepala navy dan layar Login (Bagian 8). Pengecualian kedua, juga hanya
  di permukaan navy. Kilau putih yang lewat sekali di rel saat momen selesai adalah gerak
  sesaat, bukan warna latar.

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
| Tanggal di kepala Beranda | Barlow Condensed | 44 px, 600 (hari ditulis terpisah di atasnya) |
| Judul layar (di kepala navy) | Barlow Condensed | 34 px, 600 (28 px di layar pendek) |
| Judul tiket dan kartu | Barlow | 18 px, 600 |
| Teks isi dan isian form | Barlow | 16 px, 400 |
| Angka yang diisi | Barlow | 20 px, 500 |
| Angka utama (nilai stock, stock dan harga di kepala, angka ubin Dashboard) | Barlow Condensed | 28 sampai 40 px, 600 |
| Hari di kepala Beranda | Barlow | 16 px, 600, Lampu Pass |
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

Bar navigasi navy di **bawah**, supaya terjangkau ibu jari. Kepala layar navy di atas
(Bagian 4.7). Tablet ikut aturan ini karena sama-sama dipakai dengan jari.

```
┌──────────────────────────────┐
│▓ ‹ Pengaturan       ● Online ▓│  kepala navy: kembali + status sinyal
│▓ Riwayat                     ▓│  judul layar, lalu ringkasan layar (jika ada)
├──────────────────────────────┤
│                              │
│   isi layar, 1 kolom         │
│   latar Baja, kartu Kertas   │
│                              │
├──────────────────────────────┤
│▓ Beranda   Riwayat   Laporan ▓│  bar navigasi navy, ikon + kata
└──────────────────────────────┘
```

**Bar bawah mengambang** (versi 1.8): kapsul Navy Pass bersudut 20 px, berjarak 12 px dari tepi
kiri dan kanan dan 8 px di atas jarak aman bawah (6 px di layar pendek), bertepi Garis Navy dan
berbayangan tiket. Sejak versi 1.11 kapsul ini **kaca buram**: Navy Pass 86% dengan buram 16 px
(isi layar di belakangnya terlihat samar), tepi putih kebiruan 16%, dan kilau 1 px di tepi atas.
86% dipilih supaya kata menu tetap kontras walau di belakangnya kartu putih; browser tanpa
dukungan buram menampilkan Navy Pass padat. Menu aktif ditandai **pil Navy Lapis** (versi 1.11:
bergradasi tipis dari `#1D3A66` dengan kilau di tepi atas) di belakang ikon dan katanya, ditambah
garis amber pendek di tepi atas kapsul; saat pindah menu, pil dan garis itu bergeser ke menu
yang baru dan ikonnya melonjak sedikit (Bagian 8). Isi layar diberi ruang di bawah supaya baris
terakhir tidak tertutup kapsul. Pengelola melihat 5 menu, staff 3.

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

Di kiri bar: logo lencana, nama aplikasi dua warna, dan nama outlet kecil di bawahnya (Bagian
4.5). Menu aktif ditandai pil Navy Lapis yang memudar di tempatnya dan garis amber di bawahnya;
bar bertepi bawah Garis Navy. Di kanan: nama pengguna. Klik nama itu untuk
membuka menu berisi dua pilihan, "Notifikasi" (Bagian 5.11) dan "Keluar". Karena bar ini ada di
semua layar, keduanya bisa dicapai dari layar mana pun. Panah atas/bawah berpindah di antara
keduanya.

Titik lebar hanya dua: **600 px** (kartu form menjadi dua kolom) dan **1.024 px** (bar
navigasi pindah ke atas, tabel menggantikan kartu, dua kolom di Dashboard dan Riwayat).
Aturan untuk semua lebar layar ada di Bagian 4.6.

Di bawah bar atas, kepala navy layar itu (Bagian 4.7) melebar selebar layar, dengan isinya
di tengah selebar isi layar.

### 4.7 Kepala navy setiap layar

- Setiap layar dibuka dengan kepala navy (permukaan navy dengan cahaya dan butiran, Bagian 2):
  tautan kembali (jika ada) dan, di HP dan tablet, status sinyal; judul layar 34 px; lalu
  ringkasan layar itu jika ada. Beranda memakai kepalanya sendiri (Bagian 5.2).
- **Ringkasan di kepala**, hanya untuk angka yang memang utama di layar itu:
  - Pengaturan → Item (ubah): kategori, satuan, dan keadaan sebagai chip, lalu dua angka
    berdampingan: "Stock hari ini" dan "Harga sekarang" (dengan "sejak 7 Okt").
  - Dashboard: kotak "Nilai stock" (Navy Lapis) berisi nilai, selisih karena perubahan harga
    bulan ini (Lampu Pass), dan jumlah item yang belum punya harga; ketuk untuk lembar Nilai
    stock.
  - HPP dan food cost: kotak Navy Lapis berisi food cost bulan itu (40 px) dengan targetnya, lalu
    pemakaian bahan dan penjualan berdampingan. Di bagian Per menu: jumlah menu di atas target.
  - Pengaturan → Menu (ubah): jumlah bahan, keadaan, dan tanda target sebagai chip, lalu "HPP per
    porsi" dan "Food cost" berdampingan; keduanya berubah saat isian diketik.
  - Layar lain: judul saja. Tombol "Tambah" di layar daftar ikut di kepala, di kanan judul.
- Di HP dan tablet kepala ini menggantikan judul di bar atas dan ikut bergulir bersama isi;
  bar navigasi bawah tetap. Di laptop dan desktop bar atas tetap di tempatnya dan kepala
  berada di bawahnya.
- **Kotak yang menggantung.** Di Dashboard, ubin angka ringkas menumpuk sebagian di tepi
  bawah kepala navy, seperti tiket di rel Beranda, dengan bayangan tiket.
- Pita sinyal (offline) tampil di atas kepala navy.
- Layar pendek (tinggi di bawah 500 px): judul 28 px dan ringkasan berjajar satu baris.

### 4.4 Jarak dan bentuk

- Kelipatan jarak: 4, 8, 12, 16, 24, 32 px. Tepi layar: 16 px di HP, 24 px di tablet dan
  desktop.
- Sudut: tiket 6 px (seperti kertas), kartu dan ubin 14 px, kolom isian dan tombol 10 px.
- Tinggi kolom isian dan tombol: 48 px. Jarak antar sasaran sentuh minimal 8 px.

### 4.5 Nama dan ikon aplikasi

- **Nama:** InventoryKu, ditulis menyambung dengan I dan K kapital. Nama ini tampil di
  bawah ikon setelah aplikasi di-install, di layar Login, dan di bar navigasi laptop/desktop.
- **Ikon: buku terbuka** (versi 1.8, dipilih pemilik dari pratinjau logo 12 Oktober 2026,
  pilihan B). Dua halaman berbentuk bidang padat yang melengkung dari tengah: halaman kiri
  Kertas dengan tiga garis tulisan Teks di Navy (seperti buku catatan dapur), halaman kanan Garis
  Halus, dan pita pembatas Lampu Pass (amber) yang tergantung di halaman kanan, satu-satunya
  aksen. Latar Navy Pass dengan cahaya lembut di kiri atas dan tekstur garis navy (Bagian 2).
  Bidang padat dipilih supaya tetap terbaca di 16–24 px; ikon garis versi 1.7 terlalu tipis di
  ukuran itu.
- **Logo di dalam aplikasi** (versi 1.8): buku terbuka di dalam **lencana** Navy Lapis bertepi
  Garis Navy dengan bayangan lembut. Ukuran: 72 px (sudut 20) di Login, 40 px (sudut 12) di bar
  atas, 32 px (sudut 10) di kepala Beranda HP dan tablet. Favicon: buku terbuka tanpa garis
  tulisan di atas Navy Pass. Saat pertama tampil, lencana membesar ke tempatnya, kedua halaman
  membuka dari tengah, garis tulisan muncul, lalu pita amber turun (Bagian 8).
- **Nama di dalam aplikasi** (versi 1.8): Barlow Condensed, "Inventory" berwarna Kertas dan "Ku"
  berwarna Lampu Pass. Dua warna ini hanya dipakai di atas navy (Login, bar atas, kepala Beranda).
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
- **HP mengingat pengguna terakhir** (versi 1.9). Setiap login yang berhasil di HP itu
  (termasuk pemasangan pertama dan pemulihan) menyimpan nama orangnya di HP. Login berikutnya
  langsung membuka langkah PIN untuk orang itu, tanpa daftar nama. Daftar nama tampil jika HP
  belum mengingat siapa pun, orang itu tidak bisa masuk lagi (nonaktif, dihapus, atau belum
  punya PIN), atau "Ganti nama" diketuk. Tombol "Keluar" dan keluar otomatis tidak menghapus
  ingatan ini.
- **Langkah PIN** (versi 1.9): merek diringkas menjadi satu baris (lencana 40 px, nama 26 px,
  outlet di bawahnya), lalu sapaan di tengah: inisial di lingkaran Biru Malam 64 px (huruf Lampu
  Pass, tepi Garis Navy, cincin amber tipis), "Halo, Rina" (26 px, tebal), dan "Masukkan PIN untuk
  masuk" (Teks di Navy); jika orang itu punya isian di HP: "2 isian menunggu kirim". Lalu enam
  titik PIN dan papan angka. Di bawah papan angka, dalam satu baris: "Bukan Rina? Ganti nama"
  (nama depan saja) di kiri dan "Lupa PIN?" di kanan. Pada layar setinggi di bawah 620 px dan
  pada layar mendatar yang pendek, lingkaran inisial tidak tampil supaya papan angka tetap muat.
- **Pilih nama** (versi 1.9): judul "Siapa yang masuk?" (20 px, Kertas), lalu nama staff sebagai
  lingkaran inisial 64 px (Navy Lapis, huruf Lampu Pass) dengan nama di bawahnya, tiga per baris
  (hanya ada beberapa orang, jadi tidak perlu dropdown atau mengetik). Orang yang terakhir masuk
  di HP itu bertepi Lampu Pass dengan keterangan kecil "Terakhir masuk"; isian yang menunggu
  ditulis "2 isian menunggu kirim". Seluruh lingkaran dan nama adalah satu tombol.
- **PIN:** papan angka besar di layar, 3 kolom, tombol 64 px. Enam titik PIN terisi amber
  satu per satu; setelah angka keenam, login langsung diproses tanpa tombol tambahan.
- PIN salah: enam titik PIN bergoyang sekali (Bagian 8), tulisan "PIN salah. Sisa 4 percobaan."
- Terkunci: "Terkunci 15 menit. Minta Head Kitchen atau Manager mereset PIN."
- Sebelum kunci 24 jam (spesifikasi sistem Bagian 7.2): "PIN salah. Sisa 1 percobaan. Jika salah
  lagi, akun terkunci 24 jam." Lalu: "PIN salah 5 kali lagi. Akun terkunci 24 jam, atau sampai
  Head Kitchen atau Manager mereset PIN." Saat masih terkunci: "Terkunci. Coba lagi dalam 23 jam,
  atau minta Head Kitchen atau Manager mereset PIN." (menit jika kurang dari satu jam).
- **Lupa PIN?** Tautan kecil di bawah papan angka, di langkah PIN. Ketuk,
  lalu konfirmasi: "Kirim permintaan reset PIN untuk Rina?" Setelah terkirim:
  "Permintaan terkirim. Minta PIN baru ke Head Kitchen atau Manager."
- Jika permintaan untuk nama itu sudah ada: "Permintaan sudah dikirim pukul 08.10."
- **Pulihkan akses Pengelola:** tautan kecil di bagian paling bawah layar, hanya untuk
  keadaan darurat saat tidak ada Pengelola yang bisa masuk. Meminta Kode Pemasangan baru.
- **Setelah keluar otomatis:** di atas sapaan (atau di atas pilihan nama jika HP belum
  mengingat siapa pun) tampil satu baris keterangan: "Keluar otomatis karena 5 menit tidak
  dipakai. Isian yang belum dikirim tetap tersimpan." Angka menitnya mengikuti pengaturan.
  Keterangan hilang setelah "Ganti nama" diketuk atau sebuah nama dipilih.
  Tidak ada hitung mundur atau peringatan sebelum keluar.
- Di tablet dan desktop, isi layar Login berada di tengah dengan lebar maksimal 420 px.
  Latar navy tetap memenuhi layar. Di laptop dan desktop (lebar 1.024 px ke atas, tinggi
  700 px ke atas) isinya berada di **panel** Navy Lapis tembus 72%, bersudut 24 px, bertepi
  Garis Navy, lebar maksimal 460 px, dengan bayangan dalam (versi 1.8).
- **Suasana Login** (versi 1.8, permintaan pemilik 12 Oktober 2026 supaya Login tidak
  sederhana dan monoton). Di belakang isi, hiasan yang tidak bisa disentuh dan tidak dibaca
  pembaca layar:
  - **Rel tiket** di tepi atas: garis Lampu Pass tipis yang berpendar, dengan lima tiket kecil
    Navy Lapis (klip, dua garis tulisan, garis sobek putus-putus) yang berayun pelan, di kiri
    dan kanan supaya tidak menutupi isi. Tidak tampil di layar setinggi di bawah 700 px.
  - **Uap dapur:** tujuh bercak putih sangat tipis yang naik pelan dari bawah lalu hilang.
  - **Cahaya:** cahaya navy (Bagian 2) dan cahaya hangat Lampu Pass yang sangat tipis di kanan
    bawah, bergeser berlawanan arah.
  - **Halo:** lingkar Lampu Pass tipis di sekitar lencana yang membesar dan memudar setiap
    3,4 detik, seperti lampu pemanas di pass.
- **Nama aplikasi** muncul huruf demi huruf saat pembuka. Pembaca layar membaca "InventoryKu"
  utuh.
- **Tombol nama** (versi 1.9): lingkaran inisial dengan nama di bawahnya (lihat Pilih nama di
  atas); versi 1.8 berupa kotak Navy Lapis dengan inisial di kiri dan nama di kanan. Tombol angka PIN: Navy Lapis bersudut
  16 px, bertepi Garis Navy.

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

- Kepala navy mengisi kira-kira sepertiga atas layar. Di HP dan tablet kepala dibuka baris
  merek: lencana 32 px dan nama dua warna 20 px (Bagian 4.5), di kiri atas; di laptop/desktop
  merek sudah ada di bar atas, jadi baris ini tidak tampil. Tiket Kertas menumpuk sebagian di
  atasnya, sehingga terlihat tergantung di rel. Tanggal ditulis dalam dua baris: nama hari
  (16 px, Lampu Pass) lalu tanggal (44 px). Kemajuan ditulis dengan angkanya diperbesar:
  "**1** dari 4 form terisi".
- Tiap tiket: ikon form dalam kotak kecil berlatar Baja (Stock: kotak, Suhu: termometer,
  Prep list: panci, Waste: tempat sampah, form kustom: lembar), nama form, dan status hari
  ini. Di bawahnya, dipisah garis putus-putus dengan dua takik setengah lingkaran di tepinya
  (potongan sobek seperti tiket pesanan), satu baris kecil: siapa dan jam berapa terakhir
  mengisi, atau "Wajib hari ini" / "Tidak ditagih hari ini" jika belum ada isian, dengan
  panah kecil. Klip Navy Dalam di tengah atas tiket. Bayangan tiket (Bagian 2), tanpa garis
  tepi. Status ditunjukkan dengan tanda status (ikon dan kata), tanpa strip warna di sisi tiket.
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
  pilihan "Notifikasi" (Bagian 5.11) dan "Keluar". Jika masih ada isian di antrean saat Keluar: "2 isian Rina belum terkirim. Isian
  tetap tersimpan dan dikirim saat Rina masuk lagi." Tombol ini sebelumnya bernama
  "Ganti pengguna".
- **Masa simpan.** Di bawah tiket, untuk semua role: daftar "Lewat masa simpan" (tanda
  Masalah) dan "Habis besok" (tanda Perlu ditinjau), tiap baris dengan tombol "Catat
  sebagai waste". Daftar tidak tampil jika kosong. Sejak 19 Oktober 2026 daftar ini memuat
  barang jadi dan barang masuk yang punya "Baik sampai".
- Di tablet tiket berjajar tiga per baris. Di laptop/desktop empat per baris.
- **Form kustom** tampil sebagai tiket tambahan dengan bentuk yang sama, mengikuti urutan
  yang diatur Pengelola. Form yang disembunyikan tidak tampil. Jika tiket lebih dari empat,
  layar digulir; rel dan kepala navy tetap di tempatnya.
- Pengelola melihat tambahan di bawah tiket: "3 isian belum diperiksa" dan
  "1 baris dilaporkan keliru", masing-masing membuka Riwayat dengan filter yang sesuai.
- **Permintaan reset PIN** tampil paling atas untuk Pengelola, dengan tanda Perlu
  ditinjau: "Rina meminta reset PIN". Ketuk untuk langsung membuka layar reset PIN staff itu.
- **Akun terkunci** tampil di bawahnya untuk Pengelola, juga bertanda Perlu ditinjau: "Rina
  terkunci karena PIN salah", keterangan "Terbuka sendiri pukul 12.54. Ketuk untuk membuat PIN
  baru." (kunci 24 jam diawali "Salah berulang kali dalam 24 jam."). Dashboard menampilkan butir
  Perlu perhatian yang sama dengan ikon kunci.
- **Pengingat stock opname** untuk Pengelola jika sudah lewat jadwal: "Stock opname
  terakhir 9 hari lalu." Ketuk untuk membuka layar Stock opname.
- **Hari libur** (22 Oktober 2026, spesifikasi sistem Bagian 5.8). Kemajuan diganti ikon kalender
  dan "Hari libur: Lebaran" (tanpa keterangan cukup "Hari libur"), warna Teks di Navy, dan rel
  tidak tampil. Tiket yang belum diisi bertanda Menunggu "Hari libur" dengan baris sobek "Tidak
  ditagih hari ini"; tiket yang tetap berisian tampil seperti biasa (Terkirim, Nihil, atau "3 dari 9
  pengecekan"). Momen selesai tidak terjadi saat hari libur dihapus. Pengelola melihat "Hari ini
  hari libur" (atau sehari sebelumnya "Besok hari libur") bertanda Menunggu, di bawah permintaan reset
  PIN dan akun terkunci, dengan keterangan "Lebaran. Ditandai Budi, 21 Okt 07.10. Email harian dan
  pengingat cek suhu tidak dikirim hari ini. Ketuk untuk mengubah atau menghapus."; ketukan membuka
  Pengaturan → Hari libur. Tanpa sinyal, Beranda dari data tersimpan kemarin memakai "besok hari
  libur" kemarin; data yang lebih lama tidak menebak hari libur dan menghitung tagihan dari jadwal form.

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

- Staff hanya mengisi dua angka per item: barang datang dan pemakaian langsung (atau, dengan
  Hitung sisa, jumlah yang ada sekarang).
- **Form boleh dikirim berkali-kali sehari.** Karena itu kolomnya bernama "Tambah masuk"
  dan "Tambah keluar": angka yang diketik menambah yang sudah tercatat, tidak menggantinya.
- Baris "Hari ini" merangkum semua yang sudah tercatat pada tanggal itu: masuk, keluar,
  hasil prep, dipakai prep, waste, dan penyesuaian. Yang bernilai nol tidak ditulis.
- Prep dan waste tidak diketik di sini. Angkanya datang dari Prep List dan Form Waste.
- **Satuan besar:** jika item punya satuan besar, di samping kolom Tambah masuk ada pilihan
  satuan (misalnya botol atau dus). Saat staff mengetik 2 dus, di bawahnya tampil
  "= 24 botol".
- Pilih kategori di kotak info; kartu item kategori itu langsung tampil. **Semua kategori**
  (20 Oktober 2026, pilihan pertama; bawaan jika HP belum menyimpan kategori, pengguna lama tetap di
  kategori terakhirnya) menampilkan
  semua item di bawah judul kategorinya (h2, nama item h3; di laptop/desktop satu tabel per
  kategori, nomor berlanjut). "Kirim stock" mengirim satu kiriman per kategori yang diisi, satu per
  satu; sesudahnya "3 kategori terkirim." Jika satu kategori ditolak server, yang lain tetap
  terkirim dan galatnya diawali nama kategori ("Bumbu: …"); isian kategori itu tetap di layar.
  Tanpa sinyal, tiap kategori menjadi satu isian di antrean ("Stock · Protein"). Selama kiriman
  berjalan, kotak info dan daftar item tidak bisa diubah.
- **Cari item** (20 Oktober 2026): kotak cari di kotak info menyaring kartu atau baris menurut nama
  (huruf besar/kecil tidak dibedakan) sambil mengetik. Di bawahnya "3 dari 11 item tampil." dan,
  jika ada isian yang tersembunyi, "2 item terisi yang tidak tampil tetap ikut dikirim." Tanpa
  hasil: "Tidak ada item dengan nama itu." Jika item yang angkanya salah sedang tersembunyi saat
  Kirim, pencarian dikosongkan supaya kolomnya bisa difokuskan. Mengetik di kotak cari tidak
  menghapus pesan kiriman.
- **Catat pemakaian** (20 Oktober 2026, tampil jika server sudah mendukung): tombol berjajar
  "Tambah keluar" (bawaan) dan "Hitung sisa", dengan keterangan "Ketik yang dipakai langsung, di
  luar prep dan waste." atau "Catat prep dan waste lebih dulu. Ketik jumlah yang ada sekarang; keluar
  dihitung dari stock tercatat + masuk − sisa." Pilihannya tersimpan di HP per pengguna.
  - Hanya untuk Hari ini: untuk Kemarin atau tanggal lain pilihannya nonaktif, form memakai Tambah
    keluar, dan keterangannya ditambah "Hitung sisa hanya untuk hari ini." (dan "1 sisa yang diketik
    untuk hari ini tidak ikut dikirim untuk tanggal ini." jika ada; sisa itu tetap di draft).
  - Pilihan hanya bisa diganti selama belum ada angka di kolom cara lama; jika ada: "Kirim atau
    kosongkan dulu angka Tambah keluar yang sudah diketik (3 item)." (angka tidak diubah ke cara
    lain, karena stock di HP bisa sudah basi).
  - Dengan Hitung sisa, kolom kedua kartu menjadi "Sisa sekarang" dengan keterangan di bawahnya:
    "Keluar 9 kg.", "Sama dengan stock tercatat, tidak ada yang keluar.", atau peringatan (kartu
    bertanda Masalah, tetap bisa dikirim) "Sisa lebih banyak dari stock tercatat 10 kg. Jika tetap
    dikirim, keluarnya tidak dicatat. Isi Tambah masuk jika ada barang datang, atau minta Pengelola
    meluruskan stock." (dengan Tambah masuk: "… stock tercatat ditambah masuk 12 kg. … Periksa
    hitungannya, atau minta Pengelola meluruskan stock."); Stock akhir = sisa. Di tabel kolomnya
    "Sisa Sekarang" dengan keterangan pendek "keluar 9" / "Lebih dari stock 10" / "Lebih dari stock
    + masuk 12".
  - Sesudah dikirim, sisa yang server tidak catat ditulis di pesan: "Sisa Ayam fillet 12 kg tidak
    dicatat: lebih banyak dari stock tercatat 10 kg. Periksa hitungannya, atau minta Pengelola
    meluruskan stock." (juga di pesan "1 isian terkirim." untuk antrean).
  - Sisa yang diketik pada hari lain dan belum dikirim dikosongkan saat form dibuka: "Sisa yang
    diketik 20 Okt sudah dikosongkan, karena sisa hanya berlaku saat dihitung. Hitung lagi untuk
    hari ini."
  - Riwayat menampilkan kolom "Sisa dihitung" pada baris itu ("keluar 9 kg, sisa dihitung 7,5 kg"),
    dan kartu stok menulis "Keluar dihitung dari sisa 7,5 kg".
- Stock akhir ditulis lebih besar dari angka otomatis lain (18 px, tebal), karena itulah
  hasil yang dicari.
- Stock akhir minus: angka dan kartu diberi tanda Masalah dengan tulisan
  "Stock akhir minus. Periksa angka yang diketik, atau minta Pengelola meluruskan stock."
- Stock akhir di bawah stok minimum: tanda Perlu ditinjau "Perlu reorder".
- **Pemasok dan harga beli** (18 Oktober 2026, tidak wajib, semua role): kotak info punya
  `<select>` "Pemasok (tidak wajib)" berisi "Tanpa pemasok" dan pemasok aktif, dengan keterangan
  "Berlaku untuk semua item yang masuk di kiriman ini."; sejak 21 Oktober 2026 pilihannya kembali
  "Tanpa pemasok" sesudah kiriman jika tidak ada lagi Tambah masuk di form. Jika daftarnya kosong: "Belum ada pemasok" (nonaktif) dan petunjuk ke Pengaturan →
  Pemasok. Di kartu HP/tablet, kolom "Harga beli per kg (tidak wajib)" dengan awalan "Rp" muncul di
  bawah Tambah masuk setelah Tambah masuk diisi; satuannya ikut pilihan satuan besar ("per dus").
  Di tabel laptop/desktop isian yang sama muncul di sel Tambah Masuk, di bawah angkanya, juga
  setelah Tambah masuk diisi (sejak 19 Oktober 2026; sebelumnya kolom sendiri). Titik di antara
  kelompok tiga angka dibaca pemisah ribuan ("16.000" = 16000). Galat: "Periksa harga beli Tomat.
  Isi rupiah, misalnya 15000 atau 15.000."
- **Pesanan menunggu** (21 Oktober 2026, semua role, hanya untuk tanggal hari ini): kartu di bawah
  kotak info, berjudul "Pesanan menunggu", dengan keterangan "Barang dari pesanan ini belum dicatat
  datang. Saat barangnya datang, ketuk Isi dari pesanan, periksa jumlahnya, lalu Kirim stock." Tiap
  pesanan: nama pemasok, item dan jumlahnya ("Tomat 5 kg, Air mineral 3 dus"), "Dipesan Budi lewat
  WhatsApp, 21 Okt" (ditambah "(kemarin)" atau "(3 hari lalu)"), tanda Menunggu kirim jika itemnya
  sudah ada di isian yang menunggu kirim, lalu tombol kedua "Isi dari pesanan" dan, untuk Pengelola,
  "Tutup pesanan" (konfirmasi). Nama tombol untuk pembaca layar memuat pemasok, tanggal, dan itemnya
  ("Isi dari pesanan Sumber Segar, 21 Okt: Tomat 5 kg"). Sesudah diisi, form pindah ke Semua kategori
  jika ada item pesanan di kategori lain, pencarian dikosongkan, pemasok terpilih, kolom pertama yang
  diisi mendapat fokus, dan kartu menulis "Tambah masuk Tomat dan Air mineral diisi dari pesanan Sumber
  Segar. Periksa jumlah yang datang, lalu Kirim stock." (ditambah "Dilewati: …" untuk item yang sudah
  diisi, menunggu kirim, tidak ada di form, atau berubah satuan). Form yang sudah berisi Tambah masuk
  dari pemasok lain: form pindah ke Semua kategori dengan pencarian kosong, dan kartu menulis "Form ini
  sudah berisi Tambah masuk Telur (Protein) tanpa pemasok. Kirim atau kosongkan dulu, supaya barang itu
  tidak tercatat dari Sumber Segar." (atau "… dari Toko Ayam Jaya. Kirim atau kosongkan dulu, supaya
  barang dari Sumber Segar tidak tercatat dari Toko Ayam Jaya."). Sesudah kiriman: "Pesanan Tomat dan
  Air mineral dari Sumber Segar tercatat datang." Barang dari pesanan yang ternyata sudah dicatat datang
  (misalnya dari HP lain): "Tambah masuk Tomat tidak dicatat: pesanan Sumber Segar sudah dicatat datang
  oleh Rina, 22 Okt 07.10. Jika ini kiriman lain, catat lagi Tambah masuk-nya tanpa Isi dari pesanan."
  (juga di pesan antrean). Tutup pesanan dari kartu ini mengosongkan Tambah masuk yang diisi dari
  pesanan itu (konfirmasi dan pesan singkat menyebutnya: "Pesanan Sumber Segar ditutup. Tambah masuk
  Tomat dikosongkan.").
- **Baik sampai** (19 Oktober 2026, hanya item yang punya masa simpan): di kartu HP/tablet, kolom
  "Baik sampai" (pemilih tanggal bawaan browser) muncul di bawah harga beli setelah Tambah masuk
  diisi, sudah terisi tanggal + masa simpan, dengan keterangan "Masa simpan 3 hari. Boleh diubah."
  atau, setelah diubah, "Diubah dari 22 Okt (masa simpan 3 hari)." Di tabel laptop/desktop
  "Baik sampai" muncul di sel Tambah Masuk di bawah harga beli, dengan aturan yang sama dengan kartu.
  Tanggal sebelum tanggal isian: "Periksa baik sampai Ayam. Pilih tanggal sejak 19 Okt."
- Di laptop/desktop: tabel dengan kolom No, Nama Item, Stock Awal, Tercatat Hari Ini,
  Tambah Masuk, Tambah Keluar, Stock Akhir, Satuan. Kolom otomatis berlatar Baja. Tabel muat
  tanpa digeser mulai 1.024 px, jadi Stock Akhir selalu terlihat: sel Tambah Masuk berlebar tetap
  (184 px, 240 px mulai 1.280 px) supaya kolom tidak melebar saat harga beli dan baik sampai
  muncul, dan tanda di kolom Stock Akhir boleh turun baris jika tabel sempit.
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
- **Hasil aktual** (18 Oktober 2026, item beresep, tidak wajib): baris Hasil menjadi "Hasil menurut
  resep 10 liter", lalu kolom "Hasil aktual (tidak wajib)" dengan satuannya dan keterangan "Yang
  benar-benar jadi. Kosongkan jika sama dengan hasil menurut resep." Setelah diisi, keterangannya
  menjadi "92% dari hasil menurut resep. Stock bertambah 9,2 liter." Tabel laptop/desktop punya kolom
  "Hasil aktual" (keterangan pendek "Kosong = hasil resep."). Galat: "Periksa hasil aktual Sauce
  bolognese. Isi angka, misalnya 7,5, atau kosongkan." Baris "Tercatat" menulis "2 resep (9,2 liter,
  resep 10)".

**Waste:**

- Tombol "Tambah item" sama seperti Prep List.
- Satu kartu per item: kategori waste berupa pilihan tombol, qty, satuan (otomatis),
  alasan, estimasi kerugian (otomatis), dan foto bukti (opsional).
- **Staff tidak melihat nominal rupiah** (versi 1.10): estimasi kerugian, harga di daftar Tambah
  item, total di status kiriman, kolom Estimasi kerugian di tabel laptop/desktop, dan kolom
  rupiah di Riwayat dan PDF Waste tidak tampil untuk Staff. Pengelola tetap melihat semuanya.
- Di HP, item yang sudah selesai diisi diringkas menjadi satu baris; hanya item yang
  sedang diisi yang terbuka.
- Geser kartu ke kiri atau ketuk ikon tempat sampah untuk menghapus baris sebelum dikirim.
- **Tambah menu** (29 Oktober 2026, spesifikasi sistem Bagian 5.4): tombol kedua di samping Tambah
  item, hanya jika server mengirim menu aktif. Lembar "Tambah menu waste" diawali "Untuk menu yang
  terbuang: salah order atau dikembalikan pelanggan. Dicatat per porsi. Bahannya tidak dikurangi
  lagi dari stock, karena sudah tercatat keluar saat dimasak.", lalu pencarian dan daftar menu
  ("HPP Rp 15.400 per porsi" untuk Pengelola, "Menu" untuk Staff). Kartu menu: nama dengan tanda
  kecil "Menu", kalimat yang sama tentang stock, kategori waste (Kesalahan Order terpilih), "Porsi"
  dengan satuan "porsi" dan papan angka bulat ("Isi jumlah porsi bilangan bulat, misalnya 2."),
  alasan, foto, dan estimasi (HPP × porsi; "HPP menu belum lengkap: ada bahan tanpa harga"). Di tabel
  laptop/desktop nama menu bertanda "Menu" dengan "Stock bahan tidak berubah" di bawahnya.

**Form kustom:**

- Memakai pola umum yang sama: kolom kepala di kotak info, lalu satu kartu per baris di
  HP dan tablet, dan tabel di laptop/desktop. Tombol "Tambah baris" di bilah bawah.
- Tampilan tiap jenis kolom: Teks dan Angka sebagai kolom isian; Pilihan sebagai tombol
  berjajar jika pilihannya empat atau kurang, selebihnya dropdown; Ya/Tidak sebagai dua
  tombol; Item sebagai pencarian item; Jam sebagai pemilih waktu.
- Tombol kirim memakai nama form: "Kirim" diikuti nama form dalam huruf kecil.
- Pada hari libur (22 Oktober 2026) keterangan jadwalnya "Jadwal: Setiap hari. Hari libur, tidak
  ditagih." Isian tetap bisa dikirim.

### 5.4 Riwayat

- **Atas:** pilihan form (tombol berjajar; bisa digeser ke samping jika form lebih dari
  empat), lalu tanggal. Filter lain (kategori, item,
  unit, pengisi, status) ada di balik tombol "Filter".
- **Daftar:** dikelompokkan per tanggal, tanggal sebagai judul kelompok. Tiap baris: form,
  pengisi, jam, jumlah baris, tanda status.
- **Detail:** tata letak sama dengan layar isi form, tetapi semua nilai berupa teks.
  Baris yang pernah dikoreksi menampilkan nilai lama dicoret, diikuti nilai baru, nama
  pengoreksi, dan waktunya.
- **Waste per porsi menu** (29 Oktober 2026): di daftar "Ayam geprek (menu): …", di detail nama menu
  bertanda "Menu" dan tidak membuka riwayat item (menu tidak punya kartu stok).
- **Riwayat Stock punya dua tampilan**, dipilih lewat dua tombol di atas daftar:
  "Catatan" (tiap kiriman: siapa, jam, item, masuk, keluar) dan "Rekap harian" (satu
  baris per item per hari, dikelompokkan per kategori).
- **Hasil aktual di Riwayat Prep** (18 Oktober 2026): baris beresep punya "Hasil aktual" ("–" jika
  kosong); Koreksi punya kolom "Hasil aktual (liter)" yang boleh dikosongkan. Baris tanpa resep tidak
  punya kolom ini. Nilai yang dikosongkan lewat koreksi ditulis "–" (nilai lamanya dicoret).
- **Pemasok dan harga beli di Riwayat Stock** (18 Oktober 2026): kepala kiriman "Sayur, dari
  Sumber Segar"; tiap baris punya "Harga beli Rp 16.000" (per satuan dasar). Lembar Koreksi
  Pengelola punya kolom "Harga beli (Rp per kg)" yang boleh dikosongkan. Kartu stok menulis
  "Dari Sumber Segar · Harga beli Rp 16.000/kg" di keterangan baris Stock.
- **Baik sampai di Riwayat Stock** (19 Oktober 2026): baris yang punya Stock Masuk menulis "Baik
  sampai 22 Okt" ("–" jika kosong); baris tanpa barang masuk tidak punya kolom ini, juga tidak
  punya harga beli. Lembar Koreksi Pengelola punya pemilih tanggal "Baik sampai" yang boleh
  dikosongkan. Kartu stok menambah "Baik sampai 22 Okt" di keterangan baris Stock.
- **Riwayat per item** (Stock): ketuk nama item, muncul lembar dari bawah berisi tabel
  7 rekap terakhir item itu (Awal, Masuk, Hasil Prep, Keluar, Dipakai Prep, Waste,
  Penyesuaian, Akhir). Hari dengan Stock Akhir minus diberi tanda Masalah. Stock Masuk
  yang diketik dalam satuan besar menampilkan angka aslinya: "24 botol (2 dus)". Di HP
  tabel ini digulir ke samping di dalam lembar, dengan kolom tanggal tetap diam (Bagian 4.6).
- **Kartu stok** (18 Oktober 2026): di atas isi lembar riwayat per item ada dua tombol
  "Rekap harian" (bawaan, tabel di atas) dan "Transaksi". Tanggal di tabel rekap bisa diketuk
  dan membuka Transaksi pada tanggal itu. Transaksi dikelompokkan per tanggal dengan judul
  "Minggu, 18 Oktober" dan "Awal 30 kg" di kanan. Tiap baris: "Waste · Rina, 14.10" (tanggal ikut
  jika dicatat di hari lain), keterangan di bawahnya ("Rusak", "Untuk Sauce bolognese (1,5
  resep)", "Pernah dikoreksi"), dan di kanan jumlahnya ("+2 kg" atau "−0,5 kg") serta "Saldo
  31,5" (Masalah jika minus). Masuk dan keluar dibedakan dengan tanda + dan −, bukan warna.
  Baris Stock, Prep List, dan Waste berupa tautan ke detail isiannya di Riwayat (ikon panah);
  penyesuaian dan stock opname tidak bisa diketuk. Di bawah daftar: "Urut menurut jam diterima
  server. Saldo = stock sesudah transaksi itu, dalam kg."
- **Sesuaikan stock** (Pengelola): tombol di lembar riwayat per item. Isinya satu kolom
  "Stock sebenarnya", pilihan alasan, dan catatan. Sebelum disimpan tampil
  "Tercatat 12 kg, sebenarnya 10 kg. Selisih −2 kg."
- Tanda nihil, penyesuaian, dan stock opname tampil di daftar pada tanggalnya, dengan
  ikon yang berbeda dari isian biasa.
- **Laporkan kekeliruan:** ikon bendera di tiap baris. Ketuk, tulis catatan, kirim.
  Baris lalu bertanda Perlu ditinjau.
- **Pengelola** melihat tombol tambahan di detail: "Koreksi" dan "Tandai diperiksa".
- **Staff membetulkan isiannya sendiri** (28 Oktober 2026, spesifikasi sistem Bagian 6.3): selama
  15 menit sesudah dikirim dan belum diperiksa, isiannya sendiri bertanda Menunggu "Bisa dibetulkan
  sampai 21.45" di daftar dan detail. Detail menulis "Salah ketik? Kamu bisa membetulkan isian ini
  sampai 21.45. Sesudah itu, laporkan kekeliruan." (ikon pensil), dan tiap baris punya tombol tautan
  "Betulkan" (ikon pensil) di samping Laporkan kekeliruan, kecuali baris yang sudah dikoreksi Head Kitchen
  atau Manager. Laporan kekeliruan rekan pada baris itu tetap tampil sesudah dibetulkan. Pengelola yang
  menandai diperiksa dari layar yang dimuat sebelum isian dibetulkan mendapat "Isian ini baru saja
  dibetulkan, jadi angka di layar sudah lama. Muat ulang, lalu periksa lagi." (sekaligus: "1 isian
  dilewati karena baru dibetulkan. Periksa lagi angkanya."). Lembarnya sama dengan Koreksi Pengelola,
  berjudul "Betulkan Tomat", dengan "Bisa dibetulkan sampai 21.45." dan tombol "Batal" dan "Simpan";
  sesudahnya "Isian dibetulkan. Stock dihitung ulang." (atau "Isian dibetulkan."). Lewat batas waktu
  saat lembar terbuka: pesan server di lembar ("Isian ini dikirim lebih dari 15 menit lalu, jadi
  tidak bisa dibetulkan lagi. Laporkan kekeliruan supaya Head Kitchen atau Manager mengoreksinya.").
- **Tandai diperiksa sekaligus** (Pengelola, 19 Oktober 2026): di kanan judul tanggal di daftar
  Catatan ada tombol kedua "Tandai diperiksa (3)", hanya jika tanggal itu punya isian yang belum
  diperiksa dan tidak dilaporkan keliru (angkanya jumlah isian itu), dan tidak ada selama filter
  Kategori atau Item dipakai (isian hanya tampil sebagian barisnya). Di HP yang sempit tombol turun
  ke bawah judul. Ketukan membuka konfirmasi "Tandai 3 isian diperiksa?" dengan kalimat "Isian Stock
  Minggu, 18 Oktober yang belum diperiksa ditandai diperiksa atas nama Budi, lalu terkunci sampai
  dibuka lagi." ("yang tampil dengan filter ini dan belum diperiksa" jika filter Pengisi atau Status
  dipakai; ditambah "1 isian yang punya baris dilaporkan keliru tidak ikut." jika ada), tombol
  "Batal" dan "Tandai diperiksa". Sesudahnya: "3 isian ditandai diperiksa.", tanda tiap isian menjadi
  Diperiksa, dan tombol tanggal itu hilang. Butuh sinyal, seperti Tandai diperiksa satu per satu.
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

- **Nilai stock** di kepala navy (Bagian 4.7): angka utama 40 px, selisih karena perubahan
  harga bulan ini, dan jumlah item yang belum punya harga. Ketuk untuk lembar Nilai stock.
- Angka ringkas hari ini sebagai ubin yang menggantung di tepi kepala: form terisi (dengan
  cincin kemajuan kecil berwarna Lampu Pass di atas jalur Garis Halus, selalu disertai
  angkanya), belum diperiksa, suhu di luar standar, item di bawah stok minimum, dan total
  waste (Rp). Tiap ubin punya ikon kecil di kanan labelnya dan angka Barlow Condensed 30 px.
  HP dan tablet: dua kolom, "Form terisi" selebar dua kolom. Laptop/desktop: satu baris.
  Pada hari libur (22 Oktober 2026) ubin "Form terisi" bertuliskan "Libur" dengan keterangan "tidak
  ada form yang ditagih", bukan "0 dari 0".
- Daftar "Perlu perhatian": tiap baris diawali ubin ikon (Bagian 6) berwarna makna statusnya.
- Tombol "Stock opname" di bagian atas, dengan tanggal opname terakhir di sampingnya.
- Di sampingnya (di bawahnya di HP dan tablet) tombol "HPP dan food cost" dengan food cost bulan
  ini dan targetnya ("Oktober 33,8% · target 35%"; bertanda Perlu ditinjau jika di atas target).
  Selama penjualan bulan ini belum lengkap: food cost sementara ("Oktober 33,8% sementara · target
  35%", juga bertanda Perlu ditinjau jika di atas target).
  Jumlah menu utama tetap lima.
- **Harga beli berbeda** (18 Oktober 2026): butir Perlu ditinjau "n harga beli berbeda dari harga
  satuan" (ikon truk). Ketukan membuka lembar: penjelasan "Pakai" dan "Abaikan", lalu per item nama
  (tautan ke layar item), "Dibeli Rp 16.000/kg pada 17 Okt dari Sumber Segar, dicatat Rina. Harga
  satuan Rp 15.000/kg (beli lebih mahal Rp 1.000)." dan dua tombol kedua "Pakai Rp 16.000" dan
  "Abaikan". Item yang selesai hilang dari lembar dengan pesan singkat; Dashboard dimuat ulang saat
  lembar ditutup.
- Perlu perhatian bertambah dua jenis: "n menu di atas target food cost 35%" (Perlu ditinjau,
  membuka HPP bagian Per menu) dan "Penjualan kemarin belum dicatat" / "Penjualan n hari belum
  dicatat" (Menunggu, membuka lembar Catat penjualan).
- Di bawahnya daftar "Perlu perhatian", diurutkan dari yang paling mendesak.
- **Hari ini dan Rutin** (28 Oktober 2026): daftar dibagi dua kelompok, masing-masing tetap urut dari
  yang paling mendesak. "Hari ini" (subjudul kecil) berisi yang perlu ditangani hari itu: suhu di luar
  standar, stock minus, di bawah stok minimum, lewat masa simpan, habis besok, laporan atau jadwal
  yang gagal, baris dilaporkan keliru, reset PIN, akun terkunci, form belum lengkap, dan penjualan
  belum dicatat; tanpa butir: "Tidak ada yang mendesak hari ini." "Rutin" berisi pekerjaan berkala:
  isian belum diperiksa, stock opname, harga beli berbeda, menu di atas target, dan item belum punya
  harga. Rutin bisa dilipat: baris "Rutin · 5 butir" dengan keterangan "Pemeriksaan isian, stock
  opname, harga, dan menu" dan panah; bawaannya terlipat selama ada butir Hari ini (terbuka jika
  tidak ada), dan pilihan pengguna diingat di HP itu. Jenis butir yang tidak dikenal masuk Hari ini.
  Tanpa butir sama sekali: kotak kosong seperti dulu.
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
  - **Grafik kosong** tetap menggambar bentuknya: grafik waste menampilkan sumbu dan nama
    hari dengan kalimat kosong di tengah; grafik suhu menampilkan pita batas normal unit aktif
    tanpa titik.
  - Datanya datang bersama angka ringkas dalam satu panggilan ke server.
- **Lembar Nilai stock** (dibuka dari angka ringkas nilai stock): nilai per kategori, total,
  daftar item yang belum punya harga, dan satu baris "Selisih karena perubahan harga bulan ini"
  (positif = nilai stock naik karena harga naik; cara hitung di spesifikasi sistem Bagian 8.5).
  Ketuk baris itu untuk rincian per item: tanggal berlaku, harga lama dan baru, stock saat itu,
  dan selisihnya.
  Sejak 28 Oktober 2026 kalimat pembukanya menambahkan "Barang jadi tanpa harga satuan memakai harga
  dari resepnya.", dan di atas "Belum punya harga" ada "Harga dari resep (n)": per barang jadi nama,
  "Barang jadi · stock 10 kg × Rp 45.875 per kg", nilainya, dan tautan ke resepnya. Barang jadi yang
  resepnya punya bahan tanpa harga tetap di "Belum punya harga" dengan "Ada bahan resep yang belum
  punya harga. Ketuk untuk membuka resepnya." (tautan ke resep, bukan ke item).
- Tombol "Buka dashboard di Google Sheets" untuk grafik lengkap dan pilihan periode.
- Layar ini tetap ringkasan: hanya dua grafik itu. Tren lain ada di spreadsheet.

### 5.7 Pengaturan (Pengelola)

- Daftar bagian: Staff dan PIN, Penerima email, Form, Item, Resep, Menu, Unit, Pemasok, Kategori
  dan satuan, Outlet dan jadwal (nama outlet, zona waktu, jam closing, jadwal stock opname, target
  food cost, bahan kecil), dan Hari libur (22 Oktober 2026).
- Tiap bagian berupa daftar dengan tombol "Tambah" di atas; ketuk baris untuk mengubah.
- Reset PIN meminta konfirmasi: "Reset PIN Rina? PIN lama langsung tidak berlaku."
- Staff yang meminta reset PIN diberi tanda Perlu ditinjau di daftar Staff.
- Staff yang terkunci diberi tanda Masalah "Terkunci" di daftar, dan di kartu PIN layar ubah
  staff "Terkunci karena PIN salah 5 kali, terbuka sendiri pukul 12.37" (kunci 24 jam: "Terkunci
  24 jam karena PIN salah berulang kali, …").
- PIN baru yang terlalu mudah ditebak ditolak di kolom PIN: "PIN ini terlalu mudah ditebak (angka
  sama, berurutan, atau berulang). Pilih 6 angka lain." (juga di pemasangan pertama dan pemulihan).

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

**Pengaturan → Menu** (versi 1.10, spesifikasi sistem Bagian 5.9):

- Daftar menu dengan pencarian: nama, harga jual, HPP, food cost, dan tanda target; menu
  nonaktif di bawah. Tombol "Tambah" di kepala.
- Layar ubah: nama menu, "Harga jual (Rp)" ("Harga di daftar menu, tanpa pajak dan service."),
  lalu "Bahan per porsi". Tiap bahan: nama dan ikon hapus; dua isian berdampingan "Takaran bersih"
  (satuan otomatis) dan "Hasil bersih" (%, kosong berarti 100); baris kecil "Dibeli 0,212 kg × Rp
  58.000 per kg" dengan biayanya di kanan. Barang jadi menulis "Hasil bersih: sudah di resep" dan
  "harga dari resep". "Tambah bahan" memakai lembar pencarian item yang sama dengan resep.
- Kartu "Perkiraan" yang berubah saat diketik: bahan, bahan kecil (persennya), HPP per porsi,
  food cost, margin kotor, dan harga jual untuk target, dengan tanda Di atas target / Sesuai target.
- Kartu "Keadaan menu": sakelar Aktif/Nonaktif (menonaktifkan meminta konfirmasi), lalu tombol
  kedua "Salin menu" untuk versi bungkus ("Chicken steak (bungkus)").
- Tombol utama "Simpan menu", lalu "Menu tersimpan." Draft tersimpan seperti resep.

**Pengaturan → Outlet dan jadwal:**

- Selain nama outlet, zona waktu, jam closing, dan jadwal stock opname, ada pilihan
  "Keluar otomatis setelah tidak dipakai": 5, 10, 15, atau 30 menit. Nilai awalnya 5 menit.
  Di bawahnya satu baris keterangan: "Berlaku untuk semua pengguna di semua perangkat."
- Keterangan jadwal: "Laporan harian dan cadangan mengikuti jam closing, jeda, hari cadangan, dan zona
  waktu ini. Pada hari libur laporan harian tidak dikirim."
- Kartu "HPP dan food cost" (versi 1.10): "Target food cost (%)" (1 sampai 100) dan "Bahan kecil (%)"
  (0 sampai 15), masing-masing dengan keterangan satu baris.
- Kartu "Pengingat cek suhu": keterangan "Notifikasi ke semua HP yang menyalakan notifikasi, jika
  waktu cek itu belum diisi untuk semua unit, kecuali pada hari libur. Kosongkan jam untuk mematikan
  pengingatnya.", lalu tiga
  pemilih jam "Pengingat Opening/Middle/Closing" (awal 08.00, 14.00, 21.00). Jika server belum bisa
  mengirim notifikasi: "Notifikasi belum tersedia di server ini, jadi pengingat belum terkirim."
  Disimpan bersama tombol Simpan yang sama; di Supabase jadwalnya langsung dipasang ulang.
- Kartu "Pengingat sebelum closing" (28 Oktober 2026), di bawah Pengingat cek suhu: keterangan
  "Notifikasi ke semua HP yang menyalakan notifikasi, jika masih ada form wajib yang belum diisi atau
  belum lengkap, kecuali pada hari libur. Selama pengingat cek suhu Closing menyala, Suhu hanya
  disebut jika Opening atau Middle belum lengkap.", lalu tombol berjajar "Kirim sebelum jam closing": Mati, 15 menit, 30 menit (awal), 60
  menit, dan di bawahnya jamnya, yang ikut berubah saat jam closing diketik: "Dikirim sekitar pukul
  21.00." (atau "Pengingat sebelum closing sedang dimatikan."). Kalimat yang sama jika server belum
  bisa mengirim notifikasi. Disimpan dengan tombol Simpan yang sama.
- Kartu "Pengingat stock" (18 Oktober 2026), di bawah Pengingat sebelum closing: keterangan "Notifikasi pagi
  ke HP Head Kitchen dan Manager yang menyalakan notifikasi, hanya jika ada item di bawah stok
  minimum, stock minus, atau barang yang lewat masa simpan atau habis besok. Kosongkan jam untuk
  mematikannya.", lalu pemilih jam "Jam pengingat stock" (awal 07.00) dan kalimat yang sama jika
  server belum bisa mengirim notifikasi. Disimpan dengan tombol Simpan yang sama.

**Pengaturan → Hari libur** (22 Oktober 2026, spesifikasi sistem Bagian 5.8):

- Kepala: judul "Hari libur" dan tombol utama "Tambah" (nonaktif sampai daftar termuat). Kalimat di
  bawahnya: "Tanggal dapur tutup. Pada hari libur tidak ada form yang ditagih, penjualan tidak perlu
  dicatat, dan email harian serta pengingat cek suhu tidak dikirim. Isian yang tetap dikirim diterima
  seperti biasa."
- Daftar dua kelompok: "Akan datang" (hari ini dan sesudahnya, urut naik; hari ini bertanda Menunggu
  "Hari ini") dan "Sudah lewat" (urut turun, 30 terakhir). Tiap baris: ikon kalender, tanggal ("Jumat,
  23 Oktober"), lalu "Lebaran · Ditandai Budi, 21 Okt 07.10". Kosong: "Belum ada hari libur. Ketuk
  Tambah untuk menandai tanggal dapur tutup." Tanggal yang sudah diarsip tidak ditampilkan.
- **Lembar "Tambah hari libur":** pilihan Tanggal "Hari ini, 23 Okt", "Besok, 24 Okt", "Tanggal lain"
  tanpa pilihan awal (supaya tidak salah menandai hari ini); "Tanggal lain" memunculkan pemilih tanggal
  "Tanggal libur" (paling jauh setahun ke depan). "Keterangan (tidak wajib)", paling panjang 40 huruf,
  dengan bantuan "Misalnya Lebaran atau renovasi." Kalimat akibat yang berubah saat tanggal dipilih,
  diawali tanggalnya: hari ini "Staff melihat Hari libur di Beranda; pengingat cek suhu dan email
  harian hari ini tidak dikirim.", tanggal ke depan "form tidak ditagih; email harian dan pengingat
  cek suhu hari itu tidak dikirim.", tanggal lewat "form tidak ditagih. Email dan rekap yang sudah
  terkirim tidak berubah; Kepatuhan, food cost, dan rekap yang diunduh sesudahnya mengikuti tanda
  ini.", lalu "Isian yang tetap dikirim diterima seperti biasa." (dan "Tanggal ini sudah hari libur;
  menyimpan mengganti keterangannya." bila perlu). Jika hari ini sudah ada isian: tanda Perlu ditinjau
  "Hari ini sudah ada isian Stock dan Suhu. Pastikan dapur memang tutup." Tombol "Batal" dan "Simpan
  hari libur". Sesudah tersimpan, Tambah berikutnya langsung memilih hari sesudahnya dengan keterangan
  yang sama (Lebaran beberapa hari).
- **Lembar ubah** (ketuk baris): judul tanggalnya, "Ditandai Budi, 21 Okt 07.10.", "Keterangan (tidak
  wajib)", lalu di bagian paling bawah "Hapus jika dapur ternyata buka. Form tanggal itu ditagih lagi."
  dan tombol bahaya "Hapus hari libur". Tombol "Tutup" dan "Simpan".
- Konfirmasi hapus: "Hapus hari libur Jumat, 23 Oktober?" dengan kalimat menurut tanggalnya (ke depan:
  "Form tanggal itu ditagih lagi seperti hari biasa."; hari ini: pengingat cek suhu yang jamnya sudah
  lewat tidak dikirim ulang; tanggal lewat: laporan harian tanggal itu tidak dikirim ulang). Tombol
  "Batal" dan "Hapus hari libur".
- Butuh sinyal (tidak masuk antrean). Hari ini dan besok mengikuti tanggal server.
- Sebelum pemilik menjalankan setupSpreadsheet: "Hari libur belum bisa dicatat. Pemilik Sheet perlu
  menjalankan ulang setupSpreadsheet sesudah Edge Function terbaru di-Deploy."

**Pengaturan → Pemasok** (18 Oktober 2026):

- Daftar (aktif dulu, lalu nonaktif bertanda "Nonaktif"): nama, kontak, dan "Bulan ini Rp 568.000
  dari 3 kiriman (1 item tanpa harga beli)" atau "Belum ada barang masuk bulan ini.". Di bawahnya
  barang masuk tanpa pemasok bulan ini. Tombol "Tambah" di kepala.
- Lembar ubah: "Nama pemasok" (terkunci jika sudah tercatat di barang masuk), "Kontak (tidak
  wajib)", "Catatan (tidak wajib)", lalu bagian Nonaktifkan (dengan konfirmasi) / Aktifkan lagi,
  seperti Unit.
- Sebelum pemilik menjalankan setupSpreadsheet: "Pemasok dan harga beli belum bisa dicatat. …"

**Pengaturan → Item:**

- Isian: nama, kategori, satuan, harga satuan, stok minimum, stok maksimum (opsional,
  dipakai untuk saran order), dan "Masa simpan (hari, tidak wajib)" (19 Oktober 2026), dengan
  keterangan "Berapa hari barang ini masih baik dipakai sejak datang, misalnya 3 untuk ayam. Baik
  sampai terisi otomatis saat Tambah masuk." (ditambah "Hasil prep memakai masa simpan resepnya."
  untuk item yang punya resep aktif). Item baru mengisi harga pertamanya di isian harga satuan.
- **Harga satuan punya riwayat** (spesifikasi sistem Bagian 5.1). Setelah item punya harga,
  isian harga diganti dengan tulisan "Harga sekarang Rp 15.000 (sejak 7 Okt)" dan tombol
  "Ganti harga". Harga awal yang berlaku sejak awal ditulis "Harga sekarang Rp 15.000".
- Tombol "Ganti harga" membuka lembar: "Harga baru", "Berlaku mulai" (Hari ini, atau tanggal
  lain yang sudah lewat, misalnya tanggal faktur), kalimat "Harga lama Rp 15.000 tetap dipakai
  untuk catatan sebelum tanggal ini.", dan tombol "Simpan harga". Tanggal yang sudah punya harga
  menggantikan harga tanggal itu, dengan kalimat "Harga Rp 15.000 yang berlaku mulai 7 Okt
  diganti." Setelah disimpan: "Harga Tomat tersimpan."
- Di atas daftar riwayat ada grafik tangga kecil (SVG, tanpa animasi): harga tiap perubahan
  dari yang paling lama sampai hari ini, titik di harga sekarang, dengan label harga terendah
  dan tertinggi. Tampil jika ada dua harga atau lebih.
- Di bawah harga sekarang tampil "Riwayat harga": 10 perubahan terakhir, terbaru di atas. Tiap
  baris: tanggal berlaku ("Sejak awal" untuk harga awal), harga, naik atau turun dibanding harga
  sebelumnya ditulis dengan kata dan panah ("↗ naik Rp 2.000" bertanda Perlu ditinjau, "↘ turun
  Rp 500" bertanda Baik), dan siapa yang mencatat, dalam garis waktu dengan titik di kiri.
- Harga sekarang dan stock hari ini juga tampil di kepala navy layar item (Bagian 4.7).
- Barang jadi tanpa harga satuan yang resepnya lengkap (28 Oktober 2026): di daftar item
  "Rp 45.875 per kg dari resep" tanpa tanda "Belum punya harga", dan di kepala layar item harga
  itu dengan "Dari resep". Harga satuan tetap bisa diisi; sesudah itu harga itulah yang dipakai.
- Item baru menampilkan ajakan setelah disimpan: "Isi stok pembuka sekarang?" yang membuka
  Sesuaikan stock dengan alasan Stok pembuka.
- Sakelar "Datang dalam kemasan besar". Jika dinyalakan, muncul dua isian: satuan besar
  dan isinya, ditulis sebagai kalimat: "1 [dus] berisi [12] botol".
- **Hapus** (spesifikasi sistem Bagian 5.1): bagian paling bawah layar ubah item, terpisah
  dengan garis, sama seperti hapus staff. Item nonaktif yang belum punya catatan: tombol
  "Hapus" berwarna Masalah. Item aktif yang belum punya catatan: "Item ini belum punya
  catatan. Nonaktifkan dulu untuk bisa menghapus." Item nonaktif yang tidak bisa dihapus:
  sebabnya, misalnya "Tidak bisa dihapus karena Tomat sudah punya catatan stock. Riwayatnya
  tetap tersimpan selama item nonaktif." Item aktif yang sudah punya catatan: bagian ini tidak
  tampil.
- Hapus meminta konfirmasi: "Hapus Tomat dari daftar item? Tomat belum punya catatan, jadi
  tidak ada riwayat yang hilang. Riwayat harganya ikut terhapus. Tindakan ini tidak bisa
  dibatalkan dari aplikasi." Tombolnya "Hapus" dan "Batal". Setelah dihapus, layar kembali ke
  daftar item dengan pesan "Tomat dihapus dari daftar item."
- **Ubah banyak item sekaligus** (28 Oktober 2026, spesifikasi sistem Bagian 5.1): di daftar item,
  di bawah kalimat pembuka, dua tombol kedua "Ganti harga beberapa item" dan "Tambah dari
  Excel/Sheets" (hanya jika server sudah mengenalnya).
- **Ganti harga beberapa item:** kalimat pembuka, kartu berisi "Berlaku mulai" (Hari ini / Tanggal
  lain dengan pemilih tanggal) dan "Cari item", lalu satu kartu per kategori (urutan kategori) berisi
  item aktif. Tiap baris: nama, "Sekarang Rp 15.000 per kg" (atau "Sekarang belum punya harga"), dan
  isian harga baru berawalan Rp di kanan (turun ke bawah nama pada layar di bawah 360 px). Di bawah
  isian: beda dengan harga yang berlaku pada tanggal berlaku ("Naik Rp 1.000.", "Turun Rp 500.",
  "Sama dengan harga sekarang, jadi tidak berubah."; untuk tanggal lain "Naik Rp 1.000 dari harga pada
  25 Okt (Rp 15.000)."), "Harga pertama, berlaku sejak awal.", atau galat ("Harga harus rupiah, misalnya
  15000 atau 15.000.", atau untuk "15,000" "Harga "15,000" bisa dibaca dua cara. …"). Bilah bawah: "3 item,
  1 angkanya salah." dan tombol utama "Simpan harga" (nonaktif selama daftar item belum dimuat atau belum
  ada harga baru). Harga yang tersembunyi
  karena pencarian tetap ikut dan disebut. Konfirmasi "Simpan harga 2 item?" dengan tanggal dan
  "Tomat: Rp 15.000 → Rp 16.000" (paling banyak 8, sisanya "dan n item lain"). Sesudahnya kembali ke
  daftar item dengan "Harga 2 item tersimpan, berlaku mulai 28 Okt." (ditambah item yang mendapat harga
  pertama dan yang tidak berubah), atau "Tidak ada harga yang berubah. …" jika semuanya sama. Isian
  tersimpan sebagai draft.
- **Tambah dari Excel/Sheets:** kotak tempel "Tempel baris item" dengan urutan kolom di bantuannya,
  kalimat bahwa kategori dan satuan harus sudah ada, lalu "Pratinjau": tiap baris "Baris 2 · Wortel",
  ringkasan "Sayur · kg · Rp 12.000 · minimum 1,5", dan tanda Baik "Siap ditambah" atau tanda Masalah
  berisi sebabnya ("Kategori "Buah" tidak ada."). Bilah bawah: "2 item siap, 1 baris salah." dan tombol
  utama "Tambah 2 item". Konfirmasi menyebut nama item dan "1 baris yang salah tidak ikut dan tetap di
  kotak tempel." Sesudahnya baris yang salah (dengan baris judulnya) tetap di kotak supaya bisa
  dibetulkan; jika semua berhasil, kembali ke daftar item dengan "8 item ditambahkan. Stock-nya 0
  sampai stok pembuka diisi di layar tiap item." Jika server menolak, pesannya menyebut nomor baris
  yang sama dengan pratinjau dan pratinjau dimuat ulang. Teks tempelan tersimpan sebagai draft.
  Nomor baris = baris di kotak tempel (sel berisi ganti baris membuat satu item memakai beberapa
  baris). Angka mengikuti tampilan spreadsheet: "15.000" dan "1.250.000" ribuan, "1.250,5" dan
  "1,250.5" berdesimal, "2,5" dan "0.250" desimal; koma lalu tepat tiga angka ("15,000") ditolak
  karena bisa dibaca dua cara.

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
  harinya), atau "Sewaktu-waktu". Keterangannya menyebut bahwa hari libur tidak ditagih ("Ditagih
  setiap hari di Beranda dan email harian, kecuali hari libur.").
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
- **Cari item** (20 Oktober 2026): kotak cari di kotak info, sama seperti form Stock. Hitungan item
  yang tidak tampil tetap ikut disimpan ("1 item terhitung yang tidak tampil tetap ikut disimpan.").
- Item yang dikosongkan tidak dihitung dan tidak diubah.
- "Lanjut" membuka ringkasan: jumlah item berselisih, daftar selisihnya, dan total nilai
  (Rp). Tombol utamanya "Simpan opname".
- Setelah disimpan: "Opname tersimpan. 3 item diluruskan." dengan tombol "Unduh laporan selisih".
- Isian tersimpan sebagai draft, sehingga hitungan bisa dilanjutkan jika terputus.

### 5.9 Daftar belanja (Pengelola)

- Daftar item di bawah stok minimum, dikelompokkan **per pemasok** (21 Oktober 2026; spesifikasi
  sistem Bagian 9.2). Tiap kelompok berjudul nama pemasok (h3) dengan "Kontak …" di bawahnya;
  kelompok "Belum ada pemasok" paling bawah, dengan keterangan "Item yang belum punya pemasok aktif
  dari barang masuk. Isi Order untuk yang dipesan, lalu pilih pemasoknya." dan `<select>` "Pesan ke"
  ("Tanpa pemasok (tidak dicatat)" dan pemasok aktif). Tiap baris: nama item, stock sekarang, stok
  minimum, saran, dan kolom "Order". Item yang sudah dipesan memakai tanda Menunggu "Dipesan 5 kg"
  ditambah "dari Sumber Segar, 21 Okt"; item yang pemasok terakhirnya nonaktif ditulis "Terakhir
  dari Toko Lama (nonaktif)".
- Order terisi saran, kecuali untuk item yang sudah dipesan, item di "Belum ada pemasok", dan item
  tambahan (kosong). Keterangan Order kosong: "Kosong: tidak ikut dipesan." atau "Kosong: sudah dipesan,
  tidak ikut dipesan lagi."
- **Tambah item** (29 Oktober 2026; spesifikasi sistem Bagian 9.2): tombol kedua berikon tambah di bawah
  daftar tiap kelompok (nama untuk pembaca layar "Tambah item ke pesanan Sumber Segar"). Lembar "Tambah
  item ke pesanan Sumber Segar" berisi "Cari item" dan item aktif yang belum ada di daftar ("Protein ·
  stock 4 kg", ditambah "· sudah dipesan" bila perlu), seperti Tambah item di form Waste. Item yang
  dipilih masuk di bawah item kelompok itu dengan Order kosong (kolomnya langsung difokus), keterangan
  "Stock 4 kg · minimum 3 kg" (tanpa minimum jika item tidak punya stok minimum) dan saran jika ada, serta
  ikon tempat sampah (48 px) sebelum kolom Order, sehingga kolom Order tetap sejajar ("Hapus Daging sapi
  dari pesanan Sumber Segar"; sesudah dihapus fokus kembali ke Tambah item dan pesan singkat "Daging sapi
  dihapus dari pesanan."). Kalimat pembuka kartu ditambah "Item lain bisa ditambah lewat Tambah item di
  tiap kelompok."
- **Pemasok lain:** kelompok tanpa pemasok selalu ada paling bawah. Jika tidak berisi item di bawah
  minimum, judulnya "Pemasok lain" dengan keterangan "Untuk pesanan ke pemasok lain: ketuk Tambah item,
  isi Order, lalu pilih pemasoknya di Pesan ke."; selama kosong hanya berisi keterangan dan Tambah item,
  dan "Pesan ke" serta Kirim ke WhatsApp muncul setelah ada item. "Pesan ke" yang masih kosong diisi
  pemasok barang masuk terakhir item pertama yang ditambah.
- Saran yang dibulatkan ke satuan besar ditulis lengkap: "2 dus (24 botol)".
- Di bawah tiap kelompok: tombol kedua **"Kirim ke WhatsApp"** (tautan yang membuka WhatsApp di tab
  atau aplikasi baru) dan keterangan "Pesan berisi 2 item." ditambah, bila perlu, "Kontak Toko Ayam
  Jaya belum berisi nomor HP, jadi WhatsApp meminta memilih kontak." atau "Tanpa pemasok, pesanannya
  tidak dicatat dan WhatsApp meminta memilih kontak." Tanpa Order yang berisi, tombol tampak nonaktif
  dan ketukannya menulis "Isi Order minimal untuk satu item." Isi pesan: "Halo Sumber Segar, kami dari
  Dapur Lokadhana mau pesan:" lalu satu baris "- Tomat 5 kg" per item, lalu "Terima kasih."
- Ketukan dan klik tengah (tab baru di laptop) sama-sama mencatat. Sesudahnya: "Mencatat pesanan…", lalu
  di atas kartu (yang mendapat fokus) "Pesanan ke Sumber Segar dicatat (2 item)." (ditambah "Pesanan
  Tomat sebelumnya (Toko Ayam Jaya, 20 Okt) diganti.", "Tomat sudah tercatat datang.", dan "Tomat tidak
  dicatat sebagai pesanan menunggu: sudah ada pesanan lebih baru ke Toko Ayam Jaya (Sari, 22 Okt)."
  bila ada). Tanpa sinyal: "Pesanan tersimpan di HP dan dicatat saat ada sinyal."; sesudah terkirim
  dari antrean, kartu diperbarui sendiri (juga saat aplikasi dibuka lagi, misalnya kembali dari
  WhatsApp). Ditolak server: "WhatsApp dibuka, tetapi pesanan tidak dicatat: …".
- Di atas kelompok, jika ada: "Pesanan belum datang" (h3), satu baris per pesanan (pemasok, item dan
  jumlahnya, "Dipesan Budi lewat WhatsApp, 21 Okt (kemarin)") dengan tombol kedua "Tutup pesanan"
  (konfirmasi "Tutup pesanan Sumber Segar, 21 Okt?"; lalu "Pesanan Sumber Segar, 21 Okt ditutup.", atau
  jika barangnya sudah dicatat datang di HP lain "Pesanan Sumber Segar sudah tidak menunggu: barangnya
  sudah dicatat datang, atau pesanannya sudah ditutup."). Nama tombol untuk pembaca layar memuat
  tanggal dan itemnya.
- Di bawah daftar: "Angka Order dipakai untuk pesan WhatsApp dan PDF, dan tidak disimpan. Ketukan
  Kirim ke WhatsApp mencatat pesanan ke pemasok itu; jika pesannya tidak jadi dikirim, ketuk Tutup
  pesanan."
- Tombol utama tetap satu: "Unduh PDF". Jika tidak ada item di bawah minimum: "Semua stock di atas
  batas minimum." (pesanan yang belum datang dan kelompok "Pemasok lain" tetap tampil di bawahnya;
  Unduh PDF aktif setelah ada item tambahan).
- Server lama (sebelum Code.gs v0.29): per kategori seperti dulu, tanpa WhatsApp, dengan "Perubahan
  di sini hanya untuk cetakan."

### 5.10 HPP dan food cost (Pengelola)

Versi 1.10 (spesifikasi sistem Bagian 5.9). Dibuka dari tombol di Dashboard (`#/hpp`; bagian Per
menu `#/hpp/menu`).

```
┌──────────────────────────────┐
│▓ ‹ Dashboard        ● Online ▓│
│▓ HPP dan food cost           ▓│
│▓ ┌ Food cost 1–16 Oktober ──┐ ▓│
│▓ │ 33,8%  target 35%        │ ▓│
│▓ └──────────────────────────┘ ▓│
│▓ Pemakaian bahan │ Penjualan  ▓│
│▓ Rp 541.000      │ Rp 1,6 jt  ▓│
├──────────────────────────────┤
│ Bulan [Oktober 2026 ▾]       │
│ [ Bulan ] [ Per menu ]       │
│ Pemakaian bahan              │
│ Cocok dengan nilai stock     │
│ Per kategori ▬▬▬▬▬▬          │
│ Food cost 6 bulan ▮ ▮ ▮      │
│ Penjualan  [Catat penjualan] │
└──────────────────────────────┘
```

- Pilihan "Bulan": bulan berjalan dan 23 bulan sebelumnya (seperti Rekap bulanan); pilihannya
  diingat. Dua tombol berjajar "Bulan" dan "Per menu".
- **Bulan:** kartu Pemakaian bahan (terpakai, waste bahan, selisih stock, total; keterangan waste
  barang jadi dan stok pembuka), kartu "Cocok dengan nilai stock" (stock bahan awal + barang masuk
  + stok pembuka − stock bahan akhir ± selisih harga = pemakaian, dengan tanda Baik "Sama dengan
  rincian di atas"), Per kategori (batang mendatar, nilai dan persen, "Bahan dengan pemakaian
  terbesar" yang bisa dibuka, dan bahan tanpa harga bertanda Perlu ditinjau), grafik "Food cost 6
  bulan" (SVG; batang Biru Malam, bulan di atas target berwarna Perlu ditinjau, angka tertulis di
  atas tiap batang, garis target putus-putus; bulan yang penjualannya belum lengkap memakai food cost
  sementara, digambar pucat bergaris putus dengan angka miring dan kalimat "Batang pucat: sementara,
  penjualan belum lengkap."; "–" untuk bulan tanpa penjualan tercatat atau semua harinya libur), dan kartu Penjualan (jumlah hari tercatat, "· 2 hari libur" jika ada hari libur
  tanpa catatan, atau "Semua hari pada periode ini hari libur.", tiga catatan terakhir, "Catat
  penjualan").
- **Penjualan belum lengkap:** kepala "Food cost sementara 1–16 Oktober" dengan angka sementara dan
  "Dari 14 dari 16 hari yang penjualannya tercatat" ("–" jika belum ada penjualan yang tercatat), dan
  di atas rincian kartu Menunggu "Penjualan belum dicatat untuk 2 hari: 9 dan 14 Okt. Food cost
  sementara 33,8% dihitung dari 14 hari yang sudah tercatat saja (pemakaian bahan hari-hari itu ÷
  penjualannya); angka tetapnya dihitung setelah semua hari tercatat. Hari dapur tutup bisa ditandai
  sebagai hari libur." dengan tombol utama "Catat penjualan 9 Okt".
- **Seharusnya vs nyata** (kartu kedua di kolom kiri, spesifikasi sistem Bagian 5.9): sebelum porsi
  per menu pernah dicatat, ajakan "Catat porsi terjual per menu saat mencatat penjualan. …" dengan
  tombol "Catat penjualan". Porsi belum lengkap: kartu Menunggu "Porsi per menu belum dicatat untuk
  1 hari: 16 Okt. …" dengan "Catat porsi 16 Okt". Lengkap: "50 porsi terjual.", tanda (Baik "Sesuai
  porsi terjual" jika selisih paling banyak 2% dari seharusnya; selain itu Perlu ditinjau "Terpakai
  lebih banyak dari porsi terjual" atau "… lebih sedikit …"), Seharusnya, Nyata, Selisih
  ("+Rp 42.000 (+6,4%)"), "Food cost seharusnya 43,9%, nyata 46,7%.", rincian yang bisa dibuka
  ("Bahan menu dan bahan lain", "Selisih per bahan": "Ayam · seharusnya 12,5 kg, nyata 13,5 kg
  +Rp 40.000", 10 terbesar), kalimat cara hitung, dan peringatan bahan tanpa harga, menu yang tidak
  ada lagi, atau resep yang tidak bisa dipakai. Kepala navy menulis "Seharusnya 43,9% menurut porsi
  terjual" di bawah food cost. Jika ada waste per porsi menu (29 Oktober 2026): "Termasuk di selisih:
  3 porsi terbuang (salah order atau dikembalikan), Rp 46.200. Selisih tanpa porsi terbuang
  −Rp 4.200." Kartu Pemakaian bahan menulis "Waste menu 3 porsi (Rp 46.200, salah order atau
  dikembalikan) sudah termasuk di Terpakai, karena bahannya tercatat keluar saat dimasak."
- **Per menu:** menu aktif urut food cost tertinggi. HP dan tablet: daftar (nama, "Harga jual Rp
  55.000 · HPP Rp 21.840 · 50 porsi terjual", tanda, persen di kanan); laptop/desktop: tabel (Menu,
  Terjual, Harga jual, HPP per porsi, Food cost, Margin kotor, Harga untuk 35%, Keadaan). Porsi
  terjual hanya tampil setelah porsi per menu pernah dicatat. Ketuk menu untuk membukanya di
  Pengaturan → Menu. Di bawahnya "Atur menu di Pengaturan".
- Laptop/desktop: bagian Bulan dua kolom (rincian kiri; grafik dan penjualan kanan).
- **Lembar "Catat penjualan":** tanggal (tombol berjajar "Kemarin, 16 Okt" dan "Tanggal lain" dengan
  pemilih tanggal, maksimal hari ini), "Penjualan (Rp)" ("Total penjualan makanan dan minuman dari
  kasir, sebelum pajak dan service. Dapur tutup tanggal itu? Tandai sebagai hari libur, atau isi 0."),
  "Sudah tercatat Rp 100.000. Menyimpan akan menggantinya." bila tanggal itu sudah ada (angka dan
  catatannya ikut terisi), "Hari libur (Lebaran). Penjualan tidak perlu dicatat." bila tanggal itu hari
  libur tanpa catatan (tetap bisa disimpan), atau tombol tautan "Tandai 21 Okt sebagai hari libur" yang
  membuka lembar Tambah hari libur dengan tanggal itu (22 Oktober 2026), "Catatan
  (tidak wajib)", lalu bagian "Porsi terjual per menu": "Dari laporan kasir. Kosong: belum dicatat.
  0: tidak terjual. …", satu baris per menu aktif (nama, harga jual kecil di bawahnya, kolom angka
  96 px di kanan; porsi yang sudah tercatat terisi), dan "Porsi × harga jual: Rp 900.000. Bisa
  berbeda dari kasir karena diskon atau promo.". Porsi yang bukan bilangan bulat: "Isi bilangan
  bulat 0 atau lebih, misalnya 12." di bawah kolomnya. Daftar menu dimuat dari server setiap tanggal
  diganti ("Memuat menu…"); jika gagal: "Daftar menu tidak termuat (…). Penjualan tetap bisa disimpan
  tanpa porsi." "Batal" dan "Simpan penjualan". Sesudahnya "Penjualan 16 Okt tersimpan, dengan porsi
  2 menu." dan angka di layar langsung diperbarui.

### 5.11 Notifikasi di HP ini (semua role)

Lembar (dialog di desktop) dari menu nama pengguna → "Notifikasi" (spesifikasi sistem Bagian 10.1).

- "Yang dikirim ke HP ini, juga saat aplikasi tertutup:" lalu daftar. Pengelola: Suhu di luar
  standar, Permintaan reset PIN, Akun yang terkunci karena PIN salah, dan "Pengingat cek suhu
  (Opening 08.00, Middle 14.00, Closing 21.00), jika belum lengkap, kecuali hari libur". Pengelola juga "Pengingat stock
  (07.00), jika ada item di bawah minimum, minus, atau lewat masa simpan" (atau "Pengingat stock
  (sedang dimatikan)"), di atas pengingat cek suhu. Staff: baris pengingat cek suhu. Semua role
  (28 Oktober 2026), di bawah pengingat cek suhu: "Pengingat sebelum closing (21.00), jika masih ada
  form yang belum lengkap, kecuali hari libur" (atau "Pengingat sebelum closing (sedang dimatikan)").
- Sakelar "Notifikasi di HP ini" dengan kata "Nyala"/"Mati". Menyalakan meminta izin HP lebih dulu;
  sesudahnya "Notifikasi menyala di HP ini." (Baik), "Menyala untuk Budi.", dan tombol kedua
  "Kirim notifikasi uji" ("Notifikasi uji dikirim. Jika tidak muncul dalam satu menit, periksa
  setelan notifikasi HP."). Mematikan: "Notifikasi di HP ini dimatikan."
- HP yang menyala untuk orang lain: "HP ini menerima notifikasi untuk Budi. Satu HP hanya untuk
  satu orang." dengan tombol "Terima untuk Rina".
- Izin diblokir: sakelar nonaktif dan "Notifikasi diblokir untuk InventoryKu di HP ini. Izinkan
  notifikasi untuk aplikasi ini di setelan HP atau browser, lalu buka lembar ini lagi." (Perlu ditinjau).
- iPhone yang belum memasang aplikasi di Layar Utama: "Di iPhone, notifikasi hanya bisa untuk aplikasi
  yang dipasang di Layar Utama. Buka alamat aplikasi di Safari, ketuk Bagikan, pilih Tambahkan ke
  Layar Utama, lalu buka InventoryKu dari ikonnya dan nyalakan notifikasi di sini." Browser lain
  tanpa dukungan: "Browser ini belum bisa menerima notifikasi. …". Server lama: "Notifikasi belum
  tersedia di server ini. …".
- Notifikasi memakai ikon aplikasi; judul dan isinya ditulis server (Bagian 7). Mengetuknya membuka
  aplikasi di layar tujuannya.

---

## 6. Komponen

| Komponen | Aturan |
|---|---|
| Tombol utama | Latar Biru Malam, teks putih, tinggi 48 px. Satu per layar. Di kepala navy (misalnya Tambah): latar Kertas, teks Navy Pass. |
| Tombol kedua | Latar Kertas, tepi Garis Isian, teks Tinta. |
| Tombol berbahaya | Teks Masalah, selalu dengan konfirmasi. |
| Kolom isian | Latar Kertas, tepi Garis Isian 1 px, tinggi 48 px. Saat aktif: tepi Biru Malam 2 px. |
| Kartu / tiket | Latar Kertas, garis rambut dan bayangan kartu, atau bayangan tiket (Bagian 2). Kartu bersudut 14 px, tiket 6 px. |
| Kepala navy | Di setiap layar: kembali, judul, ringkasan (Bagian 4.7). |
| Ubin ikon | Kotak 40 px bersudut 12 px berlatar warna makna status (atau Baja), berisi ikon. Dipakai di daftar Perlu perhatian dan di tiket; selalu disertai teks, jadi warnanya bukan satu-satunya tanda. |
| Keadaan tekan | Tombol, tiket, dan baris yang bisa diketuk sedikit menggelap dan mengecil saat ditekan (Bagian 8). Efek hover hanya untuk mouse. |
| Rel kemajuan | Garis 6 px bersudut bulat di kepala Beranda, terbagi menjadi ruas dengan celah 6 px. Ruas terisi berwarna Lampu Pass, ruas lain Rel Padam. Selalu disertai tulisan kemajuannya (Bagian 5.2). |
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
| Akun terkunci (untuk Pengelola) | "Rina terkunci karena PIN salah" |
| Seharusnya vs nyata | "Terpakai lebih banyak dari porsi terjual" / "Sesuai porsi terjual" |
| Notifikasi suhu (judul, isi) | "Suhu di luar standar: Opening", "Chiller 1 9 °C (Pintu ditutup). Dicatat Rina." |
| Notifikasi pengingat | "Waktunya cek suhu Middle", "Belum diisi: Chiller 1 dan Freezer 1." |
| Notifikasi reset PIN dan kunci | "Rina meminta reset PIN" / "Rina terkunci karena PIN salah", "… Ketuk untuk membuat PIN baru." |
| Notifikasi sebelum closing | "Closing 21.30: 3 form belum diisi", "Belum diisi: Stock, Prep list, dan Waste. Jika memang tidak ada, ketuk Tidak ada hari ini di formnya." |
| Staff membetulkan isiannya | "Bisa dibetulkan sampai 21.45", "Betulkan", "Isian dibetulkan." / "Isian ini dikirim lebih dari 15 menit lalu, jadi tidak bisa dibetulkan lagi. Laporkan kekeliruan supaya Head Kitchen atau Manager mengoreksinya." |
| PIN terlalu mudah | "PIN ini terlalu mudah ditebak (angka sama, berurutan, atau berulang). Pilih 6 angka lain." |
| Kunci 24 jam | "PIN salah 5 kali lagi. Akun terkunci 24 jam, atau sampai Head Kitchen atau Manager mereset PIN." |
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
| Hapus item | "Hapus Tomat dari daftar item? Tomat belum punya catatan, jadi tidak ada riwayat yang hilang. Riwayat harganya ikut terhapus. Tindakan ini tidak bisa dibatalkan dari aplikasi." |
| Item dihapus | "Tomat dihapus dari daftar item." |
| Item belum punya catatan dan masih aktif | "Item ini belum punya catatan. Nonaktifkan dulu untuk bisa menghapus." |
| Pilihan kategori di Laporan | Label "Kategori", nilai awal "Semua kategori" |
| Tanggal ditolak | "Staff hanya bisa mengisi untuk hari ini dan kemarin. Minta Pengelola mengisi tanggal ini." |
| Tanggal sudah diarsip | "Data sebelum 1 Januari 2026 sudah dipindah ke arsip tahunan (Google Drive: Laporan Kitchen/Dapur Pusat/Arsip). Pilih tanggal yang lebih baru." |
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
| Tandai diperiksa sekaligus | Tombol "Tandai diperiksa (3)", konfirmasi "Tandai 3 isian diperiksa?", lalu "3 isian ditandai diperiksa." (ditambah "1 isian dilewati karena ada baris dilaporkan keliru." jika ada) |
| Stock semua kategori | "3 kategori terkirim.", "1 kategori tersimpan di HP. Dikirim saat ada sinyal.", galat "Bumbu: …" |
| Hitung sisa | "Sisa sekarang", "Keluar 9 kg.", "Sisa Ayam fillet 12 kg tidak dicatat: lebih banyak dari stock tercatat 10 kg. Periksa hitungannya, atau minta Pengelola meluruskan stock.", "Hitung sisa hanya untuk hari ini." |
| Cari item | "3 dari 11 item tampil.", "Tidak ada item dengan nama itu." |
| Pesanan ke pemasok | "Kirim ke WhatsApp", "Pesanan ke Sumber Segar dicatat (2 item).", "Pesanan tersimpan di HP dan dicatat saat ada sinyal.", "Dipesan Budi lewat WhatsApp, 21 Okt", "Tutup pesanan", "Pesanan Sumber Segar, 21 Okt ditutup.", "Pesanan Sumber Segar sudah tidak menunggu: barangnya sudah dicatat datang, atau pesanannya sudah ditutup.", "Tambah item", "Tambah item ke pesanan Sumber Segar", "Pemasok lain", "Daging sapi dihapus dari pesanan." |
| Isi dari pesanan | "Isi dari pesanan", "Tambah masuk Tomat diisi dari pesanan Sumber Segar. Periksa jumlah yang datang, lalu Kirim stock.", "Pesanan Tomat dari Sumber Segar tercatat datang.", "Tambah masuk Tomat tidak dicatat: pesanan Sumber Segar sudah dicatat datang oleh Rina, 22 Okt 07.10. Jika ini kiriman lain, catat lagi Tambah masuk-nya tanpa Isi dari pesanan." |
| Laporan kekeliruan terkirim | "Laporan terkirim ke Pengelola." |
| Menu tersimpan | "Menu tersimpan." |
| Penjualan tersimpan | "Penjualan 16 Okt tersimpan." |
| Penjualan belum lengkap | "Penjualan belum dicatat untuk 2 hari: 9 dan 14 Okt. Food cost sementara 33,8% dihitung dari 14 hari yang sudah tercatat saja (pemakaian bahan hari-hari itu ÷ penjualannya); angka tetapnya dihitung setelah semua hari tercatat." |
| Bahan menu tanpa harga | "Garam belum punya harga, jadi HPP belum lengkap." |
| Item dipakai menu | "Tidak bisa dinonaktifkan: masih dipakai menu Ayam bakar. Ubah atau nonaktifkan menunya dulu." |
| Penjualan masa depan | "Penjualan hanya bisa dicatat untuk hari ini atau tanggal yang sudah lewat." |
| Penjualan kosong | "Isi penjualan. Isi 0 jika tidak ada penjualan." |
| Hari libur di Beranda | "Hari libur: Lebaran"; tiket "Hari libur" dengan "Tidak ditagih hari ini" |
| Hari libur tersimpan | "Hari libur Jumat, 23 Oktober tersimpan." (ditambah "Tanggal ini sudah punya isian Suhu; isiannya tetap tersimpan." jika ada) |
| Hapus hari libur | "Hapus hari libur Jumat, 23 Oktober?", lalu "Hari libur Jumat, 23 Oktober dihapus." ("… sudah dihapus." jika HP lain sudah menghapusnya) |
| Hari libur kosong | "Belum ada hari libur. Ketuk Tambah untuk menandai tanggal dapur tutup." |
| Hari libur terlalu jauh | "Hari libur paling jauh setahun ke depan. Pilih tanggal yang lebih dekat." |
| Hari libur di Catat penjualan | "Hari libur (Lebaran). Penjualan tidak perlu dicatat." |

Pesan kesalahan menyebut apa yang salah dan apa yang harus dilakukan. Tidak ada
permintaan maaf dan tidak ada kode teknis.

---

## 8. Gerak (penuh gerak)

Versi 1.8 (permintaan pemilik 12 Oktober 2026): **penuh gerak** ("full animasi"). Aplikasi terasa
hidup di setiap layar, bukan hanya saat mengetuk: setiap layar masuk dengan gerak, setiap bagian
yang digulir muncul dengan gerak, angka dan grafik naik ke tempatnya, dan permukaan navy tidak
pernah benar-benar diam. Bagian 8.1 mendaftar setiap gerak; Bagian 8.4 menunjukkan gerak apa yang
terlihat di tiap layar. Gerak tetap tidak boleh memperlambat pekerjaan: ketukan dijawab seketika,
isian langsung bisa diketik, dan data tidak menunggu gerak selesai. Semua gerak di bawah mati
saat perangkat diatur "kurangi gerak".

### 8.1 Daftar gerak

| Gerak | Kapan | Bentuk | Lama |
|---|---|---|---|
| Pembuka Login | Sekali setiap aplikasi dibuka | Rel tiket turun; lencana membesar ke tempatnya, dua halaman buku membuka dari tengah, garis tulisan muncul, pita amber turun; nama muncul huruf demi huruf; lalu outlet, pilihan nama, tombol nama, dan tautan bawah bertahap; di desktop panel naik | Rel 600 ms; lencana 480 ms; halaman 520 ms mulai 120 ms; pita 440 ms mulai 520 ms; huruf 520 ms, jeda 35 ms, mulai 200 ms; tombol nama 380 ms, jeda 50 ms, mulai 680 ms; tautan bawah mulai 1 detik; panel 600 ms |
| Langkah Login | Pilih nama, atau "Ganti nama" | Isi langkah baru masuk dari kanan; titik PIN muncul satu per satu; tombol angka muncul bertahap | Langkah 360 ms; titik 300 ms, jeda 40 ms; tombol angka 320 ms, jeda 28 ms; tombol nama jeda 45 ms |
| Suasana Login | Selama layar Login tampil | Tiket berayun ±3,5°; uap naik dan memudar; cahaya hangat bergeser; halo lencana membesar dan memudar | Ayun 4,6–7,4 detik bolak-balik; uap 10–18 detik; cahaya 20 detik; halo 3,4 detik |
| Pembuka Beranda | Sekali setiap aplikasi dibuka | Lencana, halaman, dan pita seperti di Login, tanggal muncul perlahan, ruas rel terbentang dari kiri | Tanggal 400 ms; rel 520 ms mulai 200 ms |
| Tiket turun | Setiap Beranda dibuka | Tiket turun ke rel satu per satu | Tiap tiket 360 ms, jeda 60 ms, paling banyak 8 tiket yang bergerak |
| Ganti layar | Pindah layar | Versi 1.12: perpindahan mulus (Bagian 8.5). Layar lama memudar, layar baru bergeser masuk searah menu, membesar masuk saat form dibuka dari tiket, atau memudar masuk; bar navigasi diam. Browser tanpa View Transitions: isi kepala navy dan bagian isi layar naik 14 px sambil menjadi jelas, satu per satu. Hanya isi pertama layar; data yang tiba sesudahnya tampil tanpa gerak | Lama 120–150 ms, baru 200–300 ms sesudahnya; tanpa View Transitions 340 ms, jeda 40 ms, paling banyak 8 bagian |
| Muncul saat digulir | Bagian yang berada di bawah layar saat layar dibuka masuk ke layar | Naik 18 px sambil menjadi jelas, sekali per bagian | 460 ms |
| Angka utama | Nilai stock, angka ubin Dashboard, angka di kepala layar, jumlah form terisi | Versi 1.12: berhitung dari 0 ke angkanya, melambat di akhir; angka sejajar supaya lebarnya tidak bergoyang. Hanya angka pertama ("2" pada "2 dari 4") | 900 ms |
| Grafik | Grafik pertama kali tampil | Batang waste tumbuh dari garis dasar satu per satu; titik suhu muncul membesar; cincin Form terisi berputar ke tempatnya; grafik harga naik | Batang 560 ms, jeda 50 ms; titik 340 ms, jeda 70 ms; cincin 640 ms |
| Cahaya navy | Selama kepala navy atau layar Login tampil | Satu bercak cahaya Garis Navy bergeser pelan di belakang isi | 16 detik, bolak-balik |
| Tekan | Tombol, tiket, baris daftar, atau tombol papan PIN ditekan | Latar sedikit menggelap dan ukurannya turun ke 98% | 100 ms |
| Arahan tetikus | Laptop/desktop, tetikus di atas tiket, ubin, atau kotak Nilai stock | Naik 3 px | 180 ms |
| Cap terkirim | Tanda status berganti menjadi Terkirim, Nihil, atau Diperiksa | Tanda status muncul dari ukuran 115% ke 100% sambil menjadi jelas, seperti dicap | 150 ms |
| Ruas rel menyala | Satu form menjadi lengkap | Ruas rel berganti dari Rel Padam ke Lampu Pass dengan memudar | 200 ms |
| Momen selesai | Form terakhir hari itu lengkap | Ruas terakhir menyala, tulisan kemajuan berganti dengan memudar, dan kilau putih lewat sekali di rel | 300 ms; kilau 900 ms, sekali |
| Menu | Pindah menu | Bar bawah: pil Navy Lapis dan garis amber bergeser ke menu baru, ikonnya melonjak sedikit. Bar atas: pil memudar di menu baru, garis amber bergeser | Pil 320 ms; garis 200 ms; ikon 380 ms |
| Lembar bawah dan dialog | Dibuka atau ditutup | Lembar naik dari bawah; dialog memudar | Buka 200 ms, tutup 150 ms |
| Pesan singkat dan pita sinyal | Muncul atau hilang | Bergeser 8 px sambil memudar | 200 ms |
| Titik PIN | Tiap angka PIN diketuk | Titik amber muncul dengan memudar | 100 ms |
| PIN salah | PIN ditolak | Enam titik PIN bergoyang ke kiri dan kanan sekali | 300 ms |
| Kerangka memuat | Menunggu data pertama | Kerangka abu-abu berdenyut pelan | 1,2 detik per denyut; berhenti saat data tiba |
| Indikator putar | Tombol sedang memproses | Lingkaran kecil berputar di dalam tombol | Selama memproses |

### 8.2 Aturan supaya tetap ringan

1. **CSS lebih dulu.** Gerak dibuat dengan `transition`, `@keyframes`, dan View Transitions;
   JavaScript memasang kelas dan nama transisi. Versi 1.12: angka utama berhitung lewat
   JavaScript (`requestAnimationFrame`, satu teks per angka). Sejak 17 Oktober 2026 library
   animasi dan library grafik boleh dipakai bila memberi gerak yang tidak bisa dibuat dengan CSS;
   berkasnya disimpan di repo seperti huruf, supaya aplikasi tetap jalan tanpa sinyal.
2. **Hanya dua sifat yang digerakkan:** `transform` (geser, skala, putar) dan `opacity`
   (jelas atau pudar). Keduanya paling ringan bagi HP. Yang tidak boleh digerakkan: lebar,
   tinggi, jarak, posisi, warna, bayangan, dan blur. Satu pengecualian: warna latar pada
   keadaan tekan.
3. **Cukup singkat.** Gerak yang menjawab ketukan paling lama 200 ms. Gerak masuk (layar, bagian,
   angka, grafik, pembuka) paling lama 640 ms termasuk jedanya tidak lebih dari 1 detik. Cahaya
   navy, kerangka memuat, dan indikator putar diatur butir 6.
4. **Ayunan.** Gerak masuk melambat di akhir (`ease-out` atau kurva yang setara), gerak keluar
   makin cepat (`ease-in`). Benda kecil (lencana, pembatas, pil menu, ikon menu, tiket, titik
   suhu) boleh sedikit melewati tempatnya lalu kembali; tidak ada pantulan berulang.
5. **Tidak pernah menunda pekerjaan.** Kolom isian langsung bisa diketik, ketukan saat
   gerak berjalan tetap diterima, dan data tidak menunggu gerak selesai. Isi yang digambar
   ulang karena data baru tidak bergerak lagi (kecuali angka dan grafik yang nilainya berubah).
6. **Gerak yang terus berjalan:** cahaya navy (sangat pelan, hanya `transform`), ditambah paling
   banyak satu lagi (kerangka memuat atau indikator putar) yang berhenti begitu data tiba atau
   proses selesai. Pengecualian: layar Login, yang tidak dipakai untuk bekerja, boleh punya
   suasana yang terus bergerak (rel tiket berayun, uap, cahaya hangat, halo lencana; Bagian
   5.1), semuanya pelan dan hanya `transform` dan `opacity`.
7. **Kurangi gerak.** Jika perangkat diatur "kurangi gerak" (`prefers-reduced-motion`),
   semua gerak masuk, geser, skala, goyang, denyut, cahaya, dan muncul saat digulir dimatikan.
   Semua bagian langsung tampil, perubahan keadaan langsung jadi, dan pesan teksnya tetap
   tampil. Indikator putar tetap ada, karena ia memberi tahu bahwa proses masih berjalan.

### 8.3 Yang tidak dipakai

Gerak yang menggerakkan ukuran, warna, atau bayangan, efek paralaks, dan gerak yang berulang
cepat tanpa henti. (Angka yang berhitung naik dipakai sejak versi 1.12, Bagian 8.5.)

### 8.4 Gerak per layar

Semua layar memakai pola bersama: **ganti layar** (isi kepala navy dan bagian isi naik satu per
satu), **muncul saat digulir** (bagian yang semula di bawah layar), **cahaya navy** di kepala, dan
gerak **menu**, **tekan**, **lembar**, serta **pesan singkat** (Bagian 8.1). Tambahan per layar:

| Layar | Gerak yang terlihat |
|---|---|
| Login | Pembuka Login sekali setiap aplikasi dibuka: rel tiket turun, lencana membesar dan bukunya membuka, nama muncul huruf demi huruf, lalu outlet, tombol nama, dan tautan bawah bertahap; di desktop panelnya naik sambil membesar dari 97%. Suasana yang terus bergerak (Bagian 5.1): tiket berayun, uap naik, dua cahaya bergeser, halo lencana. Pilih nama (atau Login yang langsung menyapa pengguna terakhir): sapaan masuk dari kanan, enam titik PIN muncul satu per satu, tombol angka muncul bertahap. "Ganti nama": tombol nama masuk lagi dari kanan. Titik PIN terisi; enam titik bergoyang saat PIN salah. Berganti langkah tidak mengulang pembuka. |
| Beranda | Pembuka sekali setiap aplikasi dibuka (lencana dan pembatas di baris merek, tanggal muncul, ruas rel terbentang); tiket turun ke rel setiap Beranda dibuka; jumlah form terisi naik; cap pada tiket yang baru Terkirim atau Nihil; ruas rel menyala; momen selesai dengan kilau di rel; pemberitahuan di bawah tiket naik bertahap. |
| Isi form (Stock, Suhu, Prep list, Waste, form kustom) | Kepala dan bagian layar naik bertahap; kartu item yang berada di bawah layar muncul saat digulir; bilah kirim di bawah tetap diam (tidak pernah tersembunyi); kartu Waste mengikuti jari saat digeser untuk dihapus. Kolom isian bisa diketik sejak layar tampil. |
| Riwayat | Pilihan dan daftar kiriman naik bertahap; kiriman di bawah layar muncul saat digulir; cap pada tanda Diperiksa setelah Tandai diperiksa. |
| Laporan | Kartu Laporan harian, Daftar belanja, dan Rekap bulanan naik bertahap. |
| Dashboard | Nilai stock di kepala naik; ubin menggantung naik bertahap dengan angkanya; cincin Form terisi berputar ke tempatnya; daftar Perlu perhatian dan grafik muncul saat digulir; batang waste tumbuh satu per satu; titik suhu muncul satu per satu. |
| Pengaturan | Daftar dan kartu naik bertahap; di layar item, Stock hari ini dan Harga sekarang di kepala naik dan grafik tangga harga naik. |
| Lembar dan dialog | Lembar naik dari bawah, dialog memudar; isinya tidak bergerak lagi supaya bisa langsung diisi. |

Isi yang digambar ulang karena data baru dari server tidak mengulang gerak masuk (Bagian 8.2
butir 5); hanya angka dan grafik yang nilainya berubah yang naik lagi. Saat perangkat diatur
"kurangi gerak", semua layar tampil langsung tanpa gerak apa pun dari tabel ini kecuali
indikator putar.

### 8.5 Perpindahan layar dan angka berhitung (versi 1.12)

- **Perpindahan layar** memakai View Transitions bawaan browser (Chrome Android, Safari iPhone iOS
  18 ke atas). Jenisnya ditentukan dari layar lama dan baru:
  - **Buka** (tiket Beranda → layar form): nama form di tiket terbang ke judul layar form; layar form
    membesar dari 97% sambil menjadi jelas.
  - **Tutup** (layar form → Beranda): judul terbang kembali ke tiketnya; Beranda memudar masuk. Tiket
    tidak turun lagi selama perpindahan ini.
  - **Maju / mundur:** menu di kanan / kiri menu lama, atau layar yang lebih dalam / dangkal di menu
    yang sama: layar bergeser 24 px searah itu sambil memudar.
  - **Ganti:** selain itu (misalnya Dashboard → Stock opname pada kedalaman sama): memudar.
  - Bar navigasi (bawah di HP dan tablet, atas di desktop) tidak ikut bergerak; pil menu tetap
    bergeser seperti Bagian 8.1.
  - Tidak ada perpindahan mulus untuk layar pertama sesudah login, layar yang digambar ulang di alamat
    yang sama, browser tanpa View Transitions (memakai gerak "ganti layar" lama), dan "kurangi gerak".
- **Angka berhitung:** angka utama yang muncul bersama isi pertama layar (0,9 detik pertama) berhitung
  dari 0 dalam 900 ms dengan kurva yang melambat di akhir. Format angka sama dengan angka akhirnya
  (pemisah ribuan titik, desimal koma, "Rp", "%"). Angka yang tiba sesudahnya, atau berubah saat
  mengetik, langsung tampil. Selama berhitung, pembaca layar membaca angka akhirnya.

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
| Gradasi warna dan efek kaca di layar isi | Tidak menambah informasi; membuat tampilan tidak bersih. Pengecualian (versi 1.11): cahaya, gradasi, dan butiran di permukaan navy, dan kaca buram bar navigasi bawah (Bagian 2 dan 4.2) |
| Lebih dari satu warna aksen | Aksen akan berebut dengan warna makna status |
| Paralaks, gerak yang menggerakkan ukuran, warna, atau bayangan | Butuh hitungan tiap bingkai dan menyita tenaga HP (versi 1.8 memakai gerak masuk, muncul saat digulir, dan cahaya pelan dengan aturan Bagian 8.2; versi 1.12 menambah angka berhitung, Bagian 8.5) |
| Mengunci arah layar | Tablet sering dipakai mendatar |

---

## 11. Keputusan yang Sudah Ditetapkan

Ditetapkan pemilik sistem pada 3 sampai 5 Oktober 2026. Tidak ada butir terbuka.

| Topik | Keputusan |
|---|---|
| Gaya sinematik | Hanya di bingkai: Login, kepala Beranda, bar navigasi. Layar isi form tetap terang. |
| Warna laporan PDF dan tab Harian | Navy, seragam dengan website (Bagian 2) |
| Nama aplikasi | InventoryKu |
| Ikon aplikasi | Buku terbuka dengan pita amber (pilihan B dari pratinjau logo 12 Oktober 2026, Bagian 4.5) |
| Bar navigasi di laptop/desktop | Di atas |
| Bar navigasi di HP | Di bawah |
| Bar navigasi di tablet | Di bawah sampai lebar 1.023 px; di atas mulai 1.024 px |
| Gerak | Versi 1.8 (12 Oktober 2026): penuh gerak ("full animasi") di setiap layar: masuk bertahap, muncul saat digulir, angka dan grafik naik, cahaya navy pelan. Tetap hanya CSS, hanya `transform` dan `opacity`, dan mati saat "kurangi gerak" (Bagian 8, daftar per layar di Bagian 8.4) |
| Garis kemajuan hari ini | Digabung dengan rel tiket di kepala Beranda (Bagian 5.2) |
| Momen selesai | Rel menyala penuh dan tulisan "Semua form hari ini sudah terisi" |
| Grafik di Dashboard aplikasi | Dua grafik kecil: waste 7 hari terakhir dan suhu hari ini (Bagian 5.6) |
| Unduh PDF di iPhone dan iPad | Dua langkah: "Unduh PDF", lalu "Simpan PDF" lewat lembar bagikan (Bagian 5.5) |
| Tombol keluar | Bernama "Keluar", di menu nama pengguna: kepala Beranda di HP dan tablet, bar atas di desktop |
| Keluar otomatis | Setelah 5 menit tidak dipakai, tanpa peringatan, dengan keterangan di layar Login (Bagian 5.1) |
| Login (17 Oktober 2026) | HP mengingat orang yang terakhir masuk: Login langsung menyapanya dengan papan angka PIN; daftar nama berupa lingkaran inisial hanya lewat "Ganti nama" atau saat HP belum mengingat siapa pun (Bagian 5.1). Login dengan PIN saja dan mengetik nama tidak dipilih. |
| Hapus staff | Hanya untuk staff nonaktif, dengan konfirmasi (Bagian 5.7) |
| Hapus item (17 Oktober 2026) | Hanya untuk item nonaktif yang belum punya catatan, dengan konfirmasi, di bagian paling bawah layar ubah item (Bagian 5.7) |
| Hari libur (22 Oktober 2026) | Ditandai di layar sendiri, Pengaturan → Hari libur, satu tanggal per tindakan; Beranda Pengelola menautkannya saat hari ini atau besok libur, dan lembar Catat penjualan menawarkannya untuk tanggal tanpa penjualan. Tidak ada tanda hari libur di Riwayat. Kata "Hapus" dipakai untuk membatalkan tanda (Bagian 5.2, 5.7, 5.10) |
| HPP dan food cost (17 Oktober 2026) | Layar sendiri dari tombol di Dashboard (menu utama tetap lima), Pengaturan → Menu dengan takaran bersih dan hasil bersih, lembar Catat penjualan; nominal rupiah waste tidak tampil untuk Staff (Bagian 5.3, 5.6, 5.7, 5.10) |
| PDF stock | Bisa diunduh per kategori; untuk semua kategori, satu halaman per kategori (Bagian 5.5) |
| Bar, logo, dan nama premium (12 Oktober 2026) | Bar bawah mengambang dengan pil menu aktif, bar atas dengan pil dan nama outlet, logo lencana buku terbuka, nama dua warna "Inventory" + "Ku" amber (Bagian 4.2, 4.3, dan 4.5) |
| Perpindahan layar dan angka berhitung (17 Oktober 2026) | Keduanya dipakai; angka berhitung dengan kecepatan sedang (0,9 detik). Larangan library animasi dan library grafik dicabut (Bagian 8.2 dan 8.5). |
| Pola navy, bar, dan kartu (17 Oktober 2026) | Pola C dari pratinjau: cahaya dan butiran menggantikan tekstur garis di semua permukaan navy, bar navigasi bawah kaca buram, kartu bertepi garis rambut (Bagian 2, 4.2, dan 6). Tanpa library dan tanpa gerak baru. |
| Arah premium (11 Oktober 2026) | Kepala navy berisi ringkasan di setiap layar, bayangan lembut menggantikan garis tepi kartu, tekstur garis halus di navy, angka utama Barlow Condensed yang besar, tiket berikon dengan potongan sobek. Layar isi tetap terang, amber tetap satu-satunya aksen. |
