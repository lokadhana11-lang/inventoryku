-- InventoryKu skema.sql v0.1 (pindah ke Supabase)
-- Tempel seluruh isi file ini di Supabase → SQL Editor, lalu Run. Aman dijalankan ulang.
-- Semua tabel berada di skema "inventoryku", yang TIDAK dibuka ke API publik Supabase:
-- hanya Edge Function "api" (lewat koneksi database langsung) yang membacanya.

create schema if not exists inventoryku;
revoke all on schema inventoryku from public, anon, authenticated;

-- Tab tiruan: satu tab Google Sheet = satu baris tab_meta + baris-barisnya di tab_baris.
create table if not exists inventoryku.tab_meta (
  nama    text primary key,
  urutan  integer not null default 0,
  meta    jsonb   not null default '{}'::jsonb,   -- maksBaris, maksKolom, beku, adaFilter, adaProteksi
  versi   bigint  not null default 1,             -- naik setiap tab berubah (dipakai salinan ke Sheets)
  diubah  timestamptz not null default now()
);

create table if not exists inventoryku.tab_baris (
  id     bigserial primary key,
  tab    text not null references inventoryku.tab_meta(nama) on update cascade on delete cascade,
  pos    double precision not null,               -- urutan baris di tab
  nilai  jsonb not null default '[]'::jsonb,      -- isi sel; tanggal ditulis { "$d": milidetik }
  rumus  jsonb                                    -- { "nomor kolom": "=RUMUS" } (hanya tab Harian/Dashboard)
);
create index if not exists tab_baris_tab_pos on inventoryku.tab_baris (tab, pos);

-- Pengganti Script Properties (sesi, hash rahasia PIN, hitungan salah PIN, dan lain-lain).
create table if not exists inventoryku.properti (
  kunci text primary key,
  nilai text not null
);

-- Pengaturan runtime: zona waktu spreadsheet, nama, alamat Sheets salinan, jadwal (trigger), dll.
create table if not exists inventoryku.info (
  kunci text primary key,
  nilai jsonb
);

-- Tab yang biasa dibutuhkan tiap aksi (dipelajari otomatis; boleh dikosongkan kapan saja).
create table if not exists inventoryku.aksi_tab (
  aksi text not null,
  tab  text not null,
  primary key (aksi, tab)
);

-- Pengganti Google Drive: folder dan berkas (laporan PDF, foto bukti waste, cadangan).
-- Isi berkas disimpan di Supabase Storage, bucket "arsip", dengan nama = id.
create table if not exists inventoryku.folder (
  jalur text primary key
);
create table if not exists inventoryku.berkas (
  id       text primary key,
  jalur    text not null,
  nama     text not null,
  mime     text,
  ukuran   integer,
  dibuat   timestamptz not null default now(),
  dibuang  boolean not null default false
);
create index if not exists berkas_jalur on inventoryku.berkas (jalur, nama);

revoke all on all tables in schema inventoryku from public, anon, authenticated;
revoke all on all sequences in schema inventoryku from public, anon, authenticated;

-- Bucket penyimpanan berkas (privat; dibaca lewat tautan sementara dari Edge Function).
insert into storage.buckets (id, name, public)
values ('arsip', 'arsip', false)
on conflict (id) do nothing;

-- Jadwal laporan harian, rekap bulanan, cadangan mingguan: pg_cron memanggil Edge Function lewat pg_net.
create extension if not exists pg_cron;
create extension if not exists pg_net;
