# Uji InventoryKu

Uji otomatis untuk Code.gs dan aplikasi. Tidak menyentuh Google, Supabase, atau data sungguhan:
Code.gs asli dijalankan di Node di atas Spreadsheet tiruan dari `supabase/src` (di memori), dan
aplikasi dibuka di Chromium dengan API tiruan yang memanggil `doPost` Code.gs itu.

## Menjalankan

Dari akar repo, dengan Node 22:

```
node uji/jalankan.mjs              # semua uji server (sekitar 10 detik)
node uji/jalankan.mjs --layar      # uji server lalu uji layar di Chromium (sekitar 25 menit)
node uji/jalankan.mjs libur        # hanya uji yang namanya memuat "libur" (server dan layar)
node uji/server/pesanan.mjs        # satu berkas saja
```

Ringkasan per berkas ditulis "LULUS"/"GAGAL" dengan jumlah pemeriksaan, lalu baris yang gagal.
Kode keluar 1 jika ada yang gagal.

Uji layar butuh Playwright dan Chromium. Di lingkungan Claude Code keduanya sudah terpasang
(Playwright di `/opt/node22/lib/node_modules/`). Di tempat lain: `npm install playwright` lalu
`npx playwright install chromium`, atau isi `PLAYWRIGHT_DIR` dengan folder `node_modules` yang
memuat Playwright. Tidak ada `package.json` di repo, supaya frontend tetap tanpa langkah build.

## Isi

- `alat/harness.mjs`: Code.gs asli di atas `supabase/src/sheet.js` dan `layanan.js` dengan jam yang bisa
  digeser (`aturGeser`), penampung email, PDF, Drive, dan jadwal, serta server statis untuk uji layar
  (`layani(0)` = port kosong mana pun; `config.js` diganti alamat API tiruan).
- `alat/seed.mjs`: data contoh 12 hari: empat staff, 11 item, tiga unit, dua pemasok, resep Sambal dasar,
  menu Ayam geprek dan Telur balado, isian Stock, Suhu, Prep, Waste, dan penjualan tiap hari.
- `alat/peramban.mjs`: memuat Chromium dari Playwright.
- `server/`: uji aksi Code.gs (satu berkas per fitur).
- `layar/`: uji alur aplikasi di Chromium, termasuk delapan ukuran layar Bagian 4.6 spesifikasi tampilan.

Nama, PIN, nomor, dan alamat email di sini rekaan untuk uji (alamat memakai domain `contoh.invalid`
yang tidak pernah ada), bukan data outlet.

## Catatan

- Tiap berkas memulai data baru (`seed()`), jadi berkas boleh dijalankan dalam urutan apa pun.
- Data contoh dibuat mundur dari hari ini. Pada tanggal 1–12, sebagian datanya jatuh di bulan lalu,
  jadi pemeriksaan yang menghitung bulan berjalan (HPP, food cost sementara) bisa berbeda; jalankan
  ulang sesudah tanggal 12 jika itu yang gagal.
- Uji fitur yang lebih tua dari arsip ini (sebelum 19 Oktober 2026) dulu tidak disimpan; daftar ujinya
  ada di CLAUDE.md per tahap.
- Uji baru: salin pola berkas yang ada (fungsi `cek` yang menghitung lulus dan gagal, lalu `console.log('lulus', n, 'gagal', m)`
  di akhir), supaya `jalankan.mjs` bisa membaca hasilnya.
