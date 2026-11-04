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
UJI_JAM=2026-11-01T09:00:00+07:00 node uji/jalankan.mjs   # uji pada tanggal dan jam lain
UJI_JAM=sekarang node uji/jalankan.mjs                     # jam sebenarnya
```

Semua uji memakai **jam tetap**: Selasa 20 Oktober 2026 pukul 14.00 WIB (`uji/alat/jam.mjs`, butir 424–427),
apa pun tanggal uji dijalankan. Tiap berkas mulai tepat pada jam itu lalu jamnya berjalan seperti biasa. Jam yang
sama dipakai server tiruan, data contoh, berkas uji, dan halaman di Chromium, jadi hasilnya sama setiap hari.

Ringkasan per berkas ditulis "LULUS"/"GAGAL" dengan jumlah pemeriksaan, lalu baris yang gagal.
Kode keluar 1 jika ada yang gagal.

Uji layar butuh Playwright dan Chromium. Di lingkungan Claude Code keduanya sudah terpasang
(Playwright di `/opt/node22/lib/node_modules/`). Di tempat lain: `npm install playwright` lalu
`npx playwright install chromium`, atau isi `PLAYWRIGHT_DIR` dengan folder `node_modules` yang
memuat Playwright. Tidak ada `package.json` di repo, supaya frontend tetap tanpa langkah build.

## Isi

- `alat/jam.mjs`: jam uji tetap (diimpor paling awal oleh `harness.mjs`; `UJI_JAM` untuk tanggal lain) dan `namaBulan`.
- `alat/harness.mjs`: Code.gs asli di atas `supabase/src/sheet.js` dan `layanan.js` dengan jam yang bisa
  digeser (`aturGeser`), penampung email, PDF, Drive, dan jadwal, serta server statis untuk uji layar
  (`layani(0)` = port kosong mana pun; `config.js` diganti alamat API tiruan). `supabaseUji` adalah `SUPABASE_`
  untuk Code.gs: uji pemantauan mengisi `supabaseUji.statusSistem` seperti runtime.js (kontak Apps Script dan
  email yang menunggu) dan menghapusnya lagi di akhir.
- `alat/seed.mjs`: data contoh 12 hari: empat staff, 11 item, tiga unit, dua pemasok, resep Sambal dasar,
  menu Ayam geprek dan Telur balado, isian Stock, Suhu, Prep, Waste, dan penjualan tiap hari.
- `alat/peramban.mjs`: memuat Chromium dari Playwright; setiap konteks peramban memakai jam uji yang sama.
- `server/`: uji aksi Code.gs (satu berkas per fitur).
- `layar/`: uji alur aplikasi di Chromium, termasuk delapan ukuran layar Bagian 4.6 spesifikasi tampilan.

Nama, PIN, nomor, dan alamat email di sini rekaan untuk uji (alamat memakai domain `contoh.invalid`
yang tidak pernah ada), bukan data outlet.

## Catatan

- Tiap berkas memulai data baru (`seed()`), jadi berkas boleh dijalankan dalam urutan apa pun.
- Data contoh dibuat mundur 12 hari dari jam uji (8–19 Oktober 2026), jadi seluruhnya di bulan yang sama. Dengan
  `UJI_JAM` pada tanggal 1–12, sebagian data jatuh di bulan lalu dan pemeriksaan yang menghitung bulan berjalan
  (HPP, food cost sementara, rekap) memang berbeda; pakai tanggal 14 ke atas. Pada tanggal 13 `server/fc_sementara`
  juga berbeda: hanya tanggal 1 yang belum punya penjualan, jadi sesudah dicatat food cost sudah lengkap dan angka
  "sementara" memang hilang (diperiksa 2 November 2026 dengan `UJI_JAM` 13 dan 14 Januari 2027).
- Uji baru tidak menulis nama bulan atau tanggal tetap: hitung dari jam uji (`namaBulan(hari(0))`), supaya uji tetap
  benar jika jam uji diganti. Penjualan dan isian lain tidak bisa dicatat untuk tanggal yang belum datang, jadi
  majukan jam (`H.aturGeser`) lebih dulu.
- Uji fitur yang lebih tua dari arsip ini (sebelum 19 Oktober 2026) dulu tidak disimpan; daftar ujinya
  ada di catatan/status.md dan catatan/keputusan.md.
- Uji baru: salin pola berkas yang ada (fungsi `cek` yang menghitung lulus dan gagal, lalu `console.log('lulus', n, 'gagal', m)`
  di akhir), supaya `jalankan.mjs` bisa membaca hasilnya.
