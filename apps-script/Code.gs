// InventoryKu Code.gs v0.31 (pengingat sebelum closing)
/**
 * Backend InventoryKu: Apps Script yang menempel pada Google Sheet
 * (Extensions → Apps Script), dideploy sebagai Web App.
 *
 * Seluruh kode backend ada di file ini dan ditempel dengan tangan ke editor.
 * Setelah file ini berubah: tempel ulang, lalu Deploy → Manage deployments →
 * Edit → Version: New version (deployment yang sama, supaya URL tidak berubah).
 *
 * Isi:
 * - doPost(e)          : satu pintu masuk API, memilih aksi lewat field "action".
 * - doGet(e)           : membalas teks "InventoryKu API aktif".
 * - Tahap 0            : aksi "ping", setupSpreadsheet.
 * - Tahap 1            : akses (pemasangan pertama, login PIN, sesi 12 jam,
 *                        Lupa PIN, pemulihan akses), Beranda, Pengaturan →
 *                        Staff dan PIN, Pengaturan → Penerima email.
 * - Tahap 2            : form Stock Inventory Harian (catatan gerakan di
 *                        Data_Stock, rekap Stock_Harian, hitung ulang stock),
 *                        penyesuaian stock, tanda nihil, rumus Harian_Stock dan
 *                        blok Stock Inventory di Dashboard.
 * - Tahap 3            : Riwayat (catatan, rekap harian, riwayat per item),
 *                        Laporkan kekeliruan, Tandai diperiksa, buka kunci,
 *                        koreksi berantai, Log_Perubahan.
 * - Tahap 4            : laporan PDF (unduh, simpan ke Drive), email laporan
 *                        harian, cadangan mingguan, trigger.
 * - 5 Oktober 2026     : tombol Keluar dan keluar otomatis (lamanya di
 *                        M_Konfigurasi, Pengaturan → Outlet dan jadwal), hapus
 *                        staff nonaktif (kolom Dihapus di M_Staff), PDF stock
 *                        per kategori.
 * - Tahap 5            : form Waste dan Suhu.
 * - Tahap 6            : Pengaturan → Resep (M_Resep, M_ResepBahan, pengaman
 *                        resep melingkar), form Prep List (Data_Prep,
 *                        Data_PrepBahan, gerakan stock), masa simpan, rumus
 *                        Harian_Prep dan blok Prep List di Dashboard.
 * - Tahap 7            : menu Dashboard di aplikasi (angka ringkas, nilai
 *                        stock, Perlu perhatian, data dua grafik kecil),
 *                        Pengaturan → Item, Unit, Kategori dan satuan, Outlet
 *                        dan jadwal; blok Nilai stock dan Kepatuhan serta
 *                        grafik tiap blok di tab Dashboard.
 * - Tahap 8            : stock opname, laporan selisih, daftar belanja.
 * - Tahap 9            : form kustom (Pengaturan → Form, M_Form dan
 *                        M_FormKolom, tab Data_K_<ID Form>, layar isi umum,
 *                        jadwal form, Riwayat, PDF umum, email, Kepatuhan).
 * - Tahap 10           : rekap bulanan PDF (unduh dari menu Laporan, simpan ke
 *                        Drive, email tiap tanggal 1).
 * - Tahap 11           : foto bukti waste.
 * - 11 Oktober 2026    : riwayat harga item (M_HargaItem, aksi gantiHarga,
 *                        harga yang berlaku pada tanggal untuk semua nilai
 *                        rupiah, selisih karena perubahan harga).
 * - 17 Oktober 2026    : HPP dan food cost (M_Menu, M_MenuBahan, Data_Penjualan,
 *                        aksi hpp, daftarMenu, simpanMenu, aturMenuAktif,
 *                        simpanPenjualan); nominal rupiah waste hanya untuk
 *                        Pengelola.
 * - 17 Oktober 2026    : penjualan per menu (Data_PenjualanMenu, aksi
 *                        penjualanTanggal, porsi di simpanPenjualan) dan
 *                        pemakaian bahan seharusnya vs nyata (hpp.teoritis).
 * - 17 Oktober 2026    : notifikasi ke HP (Web Push, hanya di Supabase): aksi
 *                        infoNotifikasi, aturNotifikasi, ujiNotifikasi;
 *                        pengingatSuhuOpening/Middle/Closing (trigger harian).
 * - 17 Oktober 2026    : arsip tahunan (arsipTahunan, trigger tiap jam): data
 *                        sebelum tahun lalu dipindah ke berkas arsip di Drive.
 * - 18 Oktober 2026    : kartu stok per transaksi (riwayatItem.transaksi).
 * - 18 Oktober 2026    : pengingatStock (trigger harian, hanya Supabase): stock di
 *                        bawah minimum, minus, dan masa simpan ke HP Pengelola.
 * - 18 Oktober 2026    : pemasok dan harga beli (M_Pemasok, kolom Pemasok dan
 *                        Harga Beli di Data_Stock; aksi daftarPemasok, simpanPemasok,
 *                        aturPemasokAktif, abaikanHargaBeli).
 * - 18 Oktober 2026    : hasil prep aktual (kolom Hasil Aktual di Data_Prep;
 *                        kirimPrep baris[].hasilAktual).
 * - kirimLaporanHarian : dijalankan trigger harian (sekitar 22.15).
 * - buatCadangan       : dijalankan trigger mingguan.
 * - kirimRekapBulanan  : dijalankan trigger bulanan (tanggal 1).
 * - pasangTrigger      : dijalankan dari editor; memasang ketiga trigger.
 * - kirimLaporanSekarang : dijalankan dari editor untuk menguji email dan PDF.
 * - kirimRekapSekarang : dijalankan dari editor untuk menguji rekap bulanan.
 * - setupSpreadsheet   : dijalankan dari editor; menyimpan ID spreadsheet dan
 *                        membuat semua tab. Aman dijalankan ulang.
 * - buatKodePemasangan : dijalankan dari editor saat tidak ada Pengelola yang
 *                        bisa masuk; membuat Kode Pemasangan baru.
 * - ujiPemisahHalamanPdf : dijalankan dari editor; menguji apakah konversi PDF
 *                        mematuhi pemisah halaman (PDF stock per kategori).
 * - 15 Oktober 2026    : pindah ke Supabase (supabase/PANDUAN.md). File ini juga
 *                        dijalankan Supabase Edge Function (DI_SUPABASE_);
 *                        sesudah file ini berubah, jalankan node supabase/rakit.mjs
 *                        dan tempel ulang supabase/functions/api/index.ts.
 * - pindahKeSupabase   : dijalankan sekali dari editor; memindahkan data.
 * - sinkronDariSupabase : trigger tiap 5 menit; salinan ke Sheet dan Drive.
 * - 19 Oktober 2026    : masa simpan barang masuk (Masa Simpan di M_Item, Baik
 *                        Sampai di Data_Stock).
 * - 19 Oktober 2026    : pemulihan cadangan JSON (dari editor, sesudah pindah):
 *                        periksaCadangan, ujiPemulihanCadangan, pulihkanCadangan.
 * - 19 Oktober 2026    : tandai diperiksa sekaligus per tanggal di Riwayat
 *                        (aksi tandaiDiperiksaBanyak, riwayat.periksaBanyak).
 * - 20 Oktober 2026    : hitung sisa di form Stock (kirimStock.baris[].sisa;
 *                        keluar = stock tercatat + masuk - sisa, dihitung server).
 * - 21 Oktober 2026    : daftar belanja per pemasok dan pesanan ke pemasok
 *                        (Data_Pesanan; aksi catatPesanan, tutupPesanan;
 *                        formStock.pesanan; kirimStock menyelesaikan pesanan).
 * - 22 Oktober 2026    : hari libur (M_HariLibur; aksi daftarLibur, simpanLibur,
 *                        hapusLibur): tidak ada form yang ditagih, laporan harian
 *                        dan pengingat cek suhu dilewati, penjualan tidak perlu dicatat.
 * - 28 Oktober 2026    : pengingatClosing (trigger harian, hanya Supabase): form wajib
 *                        yang belum lengkap, ke semua HP, beberapa menit sebelum jam
 *                        closing (pengingat_closing_menit; Outlet dan jadwal).
 */

var VERSI_KODE = 'v0.31';

/**
 * Code.gs yang sama juga dijalankan Supabase Edge Function (supabase/, sejak v0.15): di sana
 * DI_SUPABASE diisi true oleh pembungkusnya. Di Apps Script variabel itu tidak ada.
 */
var DI_SUPABASE_ = typeof DI_SUPABASE !== 'undefined' && DI_SUPABASE === true;

/** Nama Script Property tempat ID spreadsheet disimpan oleh setupSpreadsheet. */
var PROP_ID_SPREADSHEET = 'SPREADSHEET_ID';

/* =========================================================================
 * API
 * ========================================================================= */

/**
 * Daftar aksi API. Tiap aksi menerima (body, pengguna) dan mengembalikan
 * objek "data". Untuk menolak permintaan, lempar galatPengguna_().
 * Semua aksi menuntut token sesi, kecuali yang bertanda tanpaToken
 * (spesifikasi sistem Bagian 4.2): daftar nama untuk layar Login, login,
 * Lupa PIN, pemasangan pertama, pemulihan akses, dan ping. "keluar" juga
 * tanpa token: ia hanya menghapus sesi yang dikirim, jika masih ada.
 * pengelola: true berarti hanya Head Kitchen dan Manager; pesan (opsional)
 * menggantikan pesan penolakan umum untuk Staff.
 */
var AKSI_ = {
  ping: { jalankan: aksiPing_, bacaSaja: true, tanpaToken: true },
  infoLogin: { jalankan: aksiInfoLogin_, bacaSaja: true, tanpaToken: true },
  login: { jalankan: aksiLogin_, tanpaToken: true },
  lupaPin: { jalankan: aksiLupaPin_, tanpaToken: true },
  pasang: { jalankan: aksiPasang_, tanpaToken: true },
  pulihkan: { jalankan: aksiPulihkan_, tanpaToken: true },
  keluar: { jalankan: aksiKeluar_, tanpaToken: true },
  beranda: { jalankan: aksiBeranda_, bacaSaja: true },
  daftarStaff: { jalankan: aksiDaftarStaff_, bacaSaja: true, pengelola: true },
  tambahStaff: { jalankan: aksiTambahStaff_, pengelola: true },
  ubahStaff: { jalankan: aksiUbahStaff_, pengelola: true },
  aturPin: { jalankan: aksiAturPin_, pengelola: true },
  hapusStaff: { jalankan: aksiHapusStaff_, pengelola: true,
    pesan: 'Menghapus staff hanya bisa dilakukan Head Kitchen atau Manager.' },
  bacaOutletJadwal: { jalankan: aksiBacaOutletJadwal_, bacaSaja: true, pengelola: true,
    pesan: 'Pengaturan outlet dan jadwal hanya untuk Head Kitchen dan Manager.' },
  simpanOutletJadwal: { jalankan: aksiSimpanOutletJadwal_, pengelola: true,
    pesan: 'Pengaturan outlet dan jadwal hanya bisa diubah Head Kitchen atau Manager.' },
  bacaPenerima: { jalankan: aksiBacaPenerima_, bacaSaja: true, pengelola: true },
  simpanPenerima: { jalankan: aksiSimpanPenerima_, pengelola: true },
  formStock: { jalankan: aksiFormStock_, bacaSaja: true },
  kirimStock: { jalankan: aksiKirimStock_ },
  tandaiNihil: { jalankan: aksiTandaiNihil_ },
  sesuaikanStock: { jalankan: aksiSesuaikanStock_, pengelola: true },
  formWaste: { jalankan: aksiFormWaste_, bacaSaja: true },
  kirimWaste: { jalankan: aksiKirimWaste_ },
  formSuhu: { jalankan: aksiFormSuhu_, bacaSaja: true },
  kirimSuhu: { jalankan: aksiKirimSuhu_ },
  formPrep: { jalankan: aksiFormPrep_, bacaSaja: true },
  kirimPrep: { jalankan: aksiKirimPrep_ },
  daftarResep: { jalankan: aksiDaftarResep_, bacaSaja: true, pengelola: true,
    pesan: 'Pengaturan resep hanya untuk Head Kitchen dan Manager.' },
  simpanResep: { jalankan: aksiSimpanResep_, pengelola: true,
    pesan: 'Resep hanya bisa diubah Head Kitchen atau Manager.' },
  aturResepAktif: { jalankan: aksiAturResepAktif_, pengelola: true,
    pesan: 'Resep hanya bisa diubah Head Kitchen atau Manager.' },
  aturItemAktif: { jalankan: aksiAturItemAktif_, pengelola: true,
    pesan: 'Item hanya bisa diubah Head Kitchen atau Manager.' },
  hapusItem: { jalankan: aksiHapusItem_, pengelola: true,
    pesan: 'Menghapus item hanya bisa dilakukan Head Kitchen atau Manager.' },
  daftarItem: { jalankan: aksiDaftarItem_, bacaSaja: true, pengelola: true,
    pesan: 'Pengaturan item hanya untuk Head Kitchen dan Manager.' },
  simpanItem: { jalankan: aksiSimpanItem_, pengelola: true,
    pesan: 'Item hanya bisa diubah Head Kitchen atau Manager.' },
  gantiHarga: { jalankan: aksiGantiHarga_, pengelola: true,
    pesan: 'Harga hanya bisa diganti Head Kitchen atau Manager.' },
  daftarKategoriSatuan: { jalankan: aksiDaftarKategoriSatuan_, bacaSaja: true, pengelola: true,
    pesan: 'Pengaturan kategori dan satuan hanya untuk Head Kitchen dan Manager.' },
  simpanKategori: { jalankan: aksiSimpanKategori_, pengelola: true,
    pesan: 'Kategori hanya bisa diubah Head Kitchen atau Manager.' },
  aturKategoriAktif: { jalankan: aksiAturKategoriAktif_, pengelola: true,
    pesan: 'Kategori hanya bisa diubah Head Kitchen atau Manager.' },
  urutKategori: { jalankan: aksiUrutKategori_, pengelola: true,
    pesan: 'Kategori hanya bisa diubah Head Kitchen atau Manager.' },
  simpanSatuan: { jalankan: aksiSimpanSatuan_, pengelola: true,
    pesan: 'Satuan hanya bisa diubah Head Kitchen atau Manager.' },
  aturSatuanAktif: { jalankan: aksiAturSatuanAktif_, pengelola: true,
    pesan: 'Satuan hanya bisa diubah Head Kitchen atau Manager.' },
  daftarUnit: { jalankan: aksiDaftarUnit_, bacaSaja: true, pengelola: true,
    pesan: 'Pengaturan unit hanya untuk Head Kitchen dan Manager.' },
  simpanUnit: { jalankan: aksiSimpanUnit_, pengelola: true,
    pesan: 'Unit hanya bisa diubah Head Kitchen atau Manager.' },
  aturUnitAktif: { jalankan: aksiAturUnitAktif_, pengelola: true,
    pesan: 'Unit hanya bisa diubah Head Kitchen atau Manager.' },
  daftarPemasok: { jalankan: aksiDaftarPemasok_, bacaSaja: true, pengelola: true,
    pesan: 'Pengaturan pemasok hanya untuk Head Kitchen dan Manager.' },
  simpanPemasok: { jalankan: aksiSimpanPemasok_, pengelola: true,
    pesan: 'Pemasok hanya bisa diubah Head Kitchen atau Manager.' },
  aturPemasokAktif: { jalankan: aksiAturPemasokAktif_, pengelola: true,
    pesan: 'Pemasok hanya bisa diubah Head Kitchen atau Manager.' },
  abaikanHargaBeli: { jalankan: aksiAbaikanHargaBeli_, pengelola: true,
    pesan: 'Harga hanya bisa diubah Head Kitchen atau Manager.' },
  daftarLibur: { jalankan: aksiDaftarLibur_, bacaSaja: true, pengelola: true,
    pesan: 'Hari libur hanya diatur Head Kitchen atau Manager.' },
  simpanLibur: { jalankan: aksiSimpanLibur_, pengelola: true,
    pesan: 'Hari libur hanya bisa ditandai Head Kitchen atau Manager.' },
  hapusLibur: { jalankan: aksiHapusLibur_, pengelola: true,
    pesan: 'Hari libur hanya bisa dihapus Head Kitchen atau Manager.' },
  dashboard: { jalankan: aksiDashboard_, bacaSaja: true, pengelola: true,
    pesan: 'Dashboard hanya untuk Head Kitchen dan Manager.' },
  riwayat: { jalankan: aksiRiwayat_, bacaSaja: true },
  detailKiriman: { jalankan: aksiDetailKiriman_, bacaSaja: true },
  riwayatItem: { jalankan: aksiRiwayatItem_, bacaSaja: true },
  laporkanKeliru: { jalankan: aksiLaporkanKeliru_ },
  tandaiDiperiksa: { jalankan: aksiTandaiDiperiksa_, pengelola: true,
    pesan: 'Tandai diperiksa hanya bisa dilakukan Head Kitchen atau Manager.' },
  tandaiDiperiksaBanyak: { jalankan: aksiTandaiDiperiksaBanyak_, pengelola: true,
    pesan: 'Tandai diperiksa hanya bisa dilakukan Head Kitchen atau Manager.' },
  bukaKunci: { jalankan: aksiBukaKunci_, pengelola: true,
    pesan: 'Buka kunci hanya bisa dilakukan Head Kitchen atau Manager.' },
  koreksi: { jalankan: aksiKoreksi_, pengelola: true,
    pesan: 'Koreksi hanya bisa dilakukan Head Kitchen atau Manager. Laporkan kekeliruan supaya Pengelola mengoreksinya.' },
  tutupLaporan: { jalankan: aksiTutupLaporan_, pengelola: true,
    pesan: 'Menutup laporan kekeliruan hanya bisa dilakukan Head Kitchen atau Manager.' },
  infoLaporan: { jalankan: aksiInfoLaporan_, bacaSaja: true },
  unduhPdf: { jalankan: aksiUnduhPdf_, bacaSaja: true },
  simpanPdfDrive: { jalankan: aksiSimpanPdfDrive_, pengelola: true,
    pesan: 'Simpan ulang ke Drive hanya bisa dilakukan Head Kitchen atau Manager.' },
  formOpname: { jalankan: aksiFormOpname_, bacaSaja: true, pengelola: true,
    pesan: 'Stock opname hanya untuk Head Kitchen dan Manager.' },
  simpanOpname: { jalankan: aksiSimpanOpname_, pengelola: true,
    pesan: 'Stock opname hanya bisa disimpan Head Kitchen atau Manager.' },
  detailOpname: { jalankan: aksiDetailOpname_, bacaSaja: true, pengelola: true,
    pesan: 'Rincian stock opname hanya untuk Head Kitchen dan Manager.' },
  unduhPdfOpname: { jalankan: aksiUnduhPdfOpname_, bacaSaja: true, pengelola: true,
    pesan: 'Laporan selisih opname hanya untuk Head Kitchen dan Manager.' },
  daftarBelanja: { jalankan: aksiDaftarBelanja_, bacaSaja: true, pengelola: true,
    pesan: 'Daftar belanja hanya untuk Head Kitchen dan Manager.' },
  unduhPdfBelanja: { jalankan: aksiUnduhPdfBelanja_, bacaSaja: true, pengelola: true,
    pesan: 'Daftar belanja hanya untuk Head Kitchen dan Manager.' },
  catatPesanan: { jalankan: aksiCatatPesanan_, pengelola: true,
    pesan: 'Pesanan ke pemasok hanya dicatat Head Kitchen atau Manager.' },
  tutupPesanan: { jalankan: aksiTutupPesanan_, pengelola: true,
    pesan: 'Pesanan hanya bisa ditutup Head Kitchen atau Manager.' },
  unduhPdfRekap: { jalankan: aksiUnduhPdfRekap_, bacaSaja: true, pengelola: true,
    pesan: 'Rekap bulanan hanya untuk Head Kitchen dan Manager.' },
  formKustom: { jalankan: aksiFormKustom_, bacaSaja: true },
  kirimKustom: { jalankan: aksiKirimKustom_ },
  daftarForm: { jalankan: aksiDaftarForm_, bacaSaja: true, pengelola: true,
    pesan: 'Pengaturan form hanya untuk Head Kitchen dan Manager.' },
  detailForm: { jalankan: aksiDetailForm_, bacaSaja: true, pengelola: true,
    pesan: 'Pengaturan form hanya untuk Head Kitchen dan Manager.' },
  simpanForm: { jalankan: aksiSimpanForm_, pengelola: true,
    pesan: 'Form hanya bisa dibuat dan diubah Head Kitchen atau Manager.' },
  aturFormTampil: { jalankan: aksiAturFormTampil_, pengelola: true,
    pesan: 'Form hanya bisa diubah Head Kitchen atau Manager.' },
  urutForm: { jalankan: aksiUrutForm_, pengelola: true,
    pesan: 'Form hanya bisa diubah Head Kitchen atau Manager.' },
  arsipkanForm: { jalankan: aksiArsipkanForm_, pengelola: true,
    pesan: 'Form hanya bisa dihapus Head Kitchen atau Manager.' },
  pulihkanForm: { jalankan: aksiPulihkanForm_, pengelola: true,
    pesan: 'Form hanya bisa dipulihkan Head Kitchen atau Manager.' },
  hpp: { jalankan: aksiHpp_, bacaSaja: true, pengelola: true,
    pesan: 'HPP dan food cost hanya untuk Head Kitchen dan Manager.' },
  daftarMenu: { jalankan: aksiDaftarMenu_, bacaSaja: true, pengelola: true,
    pesan: 'Pengaturan menu hanya untuk Head Kitchen dan Manager.' },
  simpanMenu: { jalankan: aksiSimpanMenu_, pengelola: true,
    pesan: 'Menu hanya bisa diubah Head Kitchen atau Manager.' },
  aturMenuAktif: { jalankan: aksiAturMenuAktif_, pengelola: true,
    pesan: 'Menu hanya bisa diubah Head Kitchen atau Manager.' },
  simpanPenjualan: { jalankan: aksiSimpanPenjualan_, pengelola: true,
    pesan: 'Penjualan hanya bisa dicatat Head Kitchen atau Manager.' },
  penjualanTanggal: { jalankan: aksiPenjualanTanggal_, bacaSaja: true, pengelola: true,
    pesan: 'Penjualan hanya bisa dicatat Head Kitchen atau Manager.' },
  infoNotifikasi: { jalankan: aksiInfoNotifikasi_, bacaSaja: true },
  aturNotifikasi: { jalankan: aksiAturNotifikasi_ },
  ujiNotifikasi: { jalankan: aksiUjiNotifikasi_ }
};

/**
 * Satu pintu masuk API. Frontend mengirim POST dengan body JSON
 * (Content-Type: text/plain) berisi field "action" dan, untuk aksi bertoken,
 * field "token".
 * Selalu membalas JSON:
 *   berhasil: { "ok": true,  "data": { ... } }
 *   gagal   : { "ok": false, "pesan": "Pesan berbahasa Indonesia." }
 *             ditambah "sesiBerakhir": true jika token tidak sah lagi.
 */
function doPost(e) {
  var hasil;
  var mulai = Date.now();
  var nama = '';
  SS_ = null;
  PENGGUNA_AKSI_ = null;
  resetMemoForm_();
  lupakanMemoTab_();
  MEMO_TAB_AKTIF_ = false;
  DALAM_KUNCI_ = 0;
  // Sesudah pindah ke Supabase: HP yang masih memakai alamat lama dialihkan ke alamat baru.
  if (sudahPindah_()) {
    return balasJson_({ ok: false, pesan: 'InventoryKu sudah pindah ke server baru. Tutup aplikasi, lalu buka lagi.',
      pindahKe: alamatSupabase_() });
  }
  try {
    var body = bacaBody_(e);
    nama = typeof body.action === 'string' ? body.action : '';
    if (!nama || !Object.prototype.hasOwnProperty.call(AKSI_, nama)) {
      throw galatPengguna_('Aksi tidak dikenal. Muat ulang aplikasi, lalu coba lagi.');
    }
    var aksi = AKSI_[nama];
    // Aksi yang hanya membaca (dan login): tiap tab dibaca sekali per permintaan (Code.gs v0.14).
    MEMO_TAB_AKTIF_ = !!aksi.bacaSaja || nama === 'login' || nama === 'keluar';
    var pengguna = null;
    if (!aksi.tanpaToken) {
      pengguna = periksaSesi_(body.token);
      if (aksi.pengelola && !pengguna.pengelola) {
        throw galatPengguna_(aksi.pesan || 'Menu ini hanya untuk Head Kitchen dan Manager.');
      }
    }
    PENGGUNA_AKSI_ = pengguna;
    hasil = { ok: true, data: aksi.jalankan(body, pengguna) || {} };
  } catch (err) {
    if (err && err.untukPengguna) {
      hasil = { ok: false, pesan: err.message };
      if (err.sesiBerakhir) hasil.sesiBerakhir = true;
    } else {
      console.error('doPost gagal: ' + (err && err.stack ? err.stack : err));
      hasil = { ok: false, pesan: 'Terjadi kesalahan di server. Coba lagi beberapa saat lagi.' };
    }
  }
  // Lama tiap aksi di log Eksekusi Apps Script, untuk melihat bagian yang lambat.
  console.log('Aksi ' + (nama || '?') + ': ' + (Date.now() - mulai) + ' ms' + (hasil.ok ? '' : ' (gagal)'));
  MEMO_TAB_AKTIF_ = false;
  lupakanMemoTab_();
  return balasJson_(hasil);
}

function doGet(e) {
  return ContentService.createTextOutput('InventoryKu API aktif')
    .setMimeType(ContentService.MimeType.TEXT);
}

/** Aksi "ping": memastikan API dan spreadsheet bisa dijangkau. Tanpa token. */
function aksiPing_(body) {
  var ss = bukaSpreadsheet_();
  return {
    namaSpreadsheet: ss.getName(),
    waktuServer: new Date().toISOString()
  };
}

function bacaBody_(e) {
  if (!e || !e.postData || typeof e.postData.contents !== 'string' || e.postData.contents === '') {
    throw galatPengguna_('Permintaan kosong. Muat ulang aplikasi, lalu coba lagi.');
  }
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    throw galatPengguna_('Format permintaan tidak dikenali. Muat ulang aplikasi, lalu coba lagi.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw galatPengguna_('Format permintaan tidak dikenali. Muat ulang aplikasi, lalu coba lagi.');
  }
  return body;
}

function balasJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Kesalahan yang pesannya aman dan berguna untuk ditampilkan ke pengguna. */
function galatPengguna_(pesan) {
  var err = new Error(pesan);
  err.untukPengguna = true;
  return err;
}

/** Token tidak sah lagi: frontend kembali ke layar Login. */
function galatSesi_() {
  var err = galatPengguna_('Sesi berakhir. Masuk lagi dengan PIN.');
  err.sesiBerakhir = true;
  return err;
}

/**
 * Membuka spreadsheet lewat ID di Script Properties. Saat berjalan sebagai
 * Web App, getActiveSpreadsheet() tidak tersedia, jadi semua kode memakai ini.
 */
function bukaSpreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty(PROP_ID_SPREADSHEET);
  if (!id) {
    throw galatPengguna_('Spreadsheet belum disiapkan. Jalankan setupSpreadsheet di editor Apps Script.');
  }
  try {
    return SpreadsheetApp.openById(id);
  } catch (err) {
    console.error('openById gagal: ' + (err && err.stack ? err.stack : err));
    throw galatPengguna_('Spreadsheet tidak bisa dibuka. Jalankan ulang setupSpreadsheet di editor Apps Script.');
  }
}

/** Spreadsheet untuk satu permintaan (dibuka sekali, lalu dipakai ulang). */
var SS_ = null;
/** Pengguna aksi yang sedang dijalankan doPost (null di trigger dan editor); dipakai barisRiwayat_ untuk tautan foto. */
var PENGGUNA_AKSI_ = null;
function ss_() {
  if (!SS_) SS_ = bukaSpreadsheet_();
  return SS_;
}

/* ---------- Membaca tab sekali per permintaan (Code.gs v0.14) ----------
 * Setiap baca ke Sheet adalah satu perjalanan ke server Google (puluhan sampai ratusan ms).
 * nilaiTab_ membaca seluruh isi tab dalam satu panggilan. Pada aksi yang hanya membaca
 * (AKSI_ bacaSaja, login, keluar) hasilnya disimpan selama permintaan itu, jadi tab yang
 * sama tidak dibaca berulang. Di dalam denganKunci_ (semua penulisan) simpanan dibuang
 * dan tidak dipakai, sehingga penulisan selalu membaca isi terbaru.
 */
var MEMO_TAB_ = {};
var MEMO_TAB_AKTIF_ = false;
var DALAM_KUNCI_ = 0;
var ZONA_SHEET_ = null;

function lupakanMemoTab_() {
  MEMO_TAB_ = {};
  ZONA_SHEET_ = null;
}

function memoTabDipakai_() {
  return MEMO_TAB_AKTIF_ && !DALAM_KUNCI_;
}

/** Seluruh isi tab (baris pertama = judul), [] untuk tab kosong. Salinan, jadi boleh diubah pemanggil. */
function nilaiTab_(sheet) {
  var pakai = memoTabDipakai_();
  var nama = sheet.getName();
  var nilai = pakai && Object.prototype.hasOwnProperty.call(MEMO_TAB_, nama) ? MEMO_TAB_[nama] : null;
  if (!nilai) {
    nilai = sheet.getDataRange().getValues();
    if (nilai.length === 1 && nilai[0].length === 1 && nilai[0][0] === '') nilai = [];
    if (pakai) MEMO_TAB_[nama] = nilai;
  }
  return pakai ? nilai.map(function (r) { return r.slice(); }) : nilai;
}

/** Judul kolom baris 1. Dari simpanan jika ada; jika tidak, hanya baris 1 yang dibaca. */
function judulTab_(sheet) {
  if (memoTabDipakai_()) return nilaiTab_(sheet)[0] || [];
  var lastCol = sheet.getLastColumn();
  return lastCol ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
}

/** Zona waktu spreadsheet, dibaca sekali per permintaan. */
function zonaSheet_() {
  if (!ZONA_SHEET_) ZONA_SHEET_ = ss_().getSpreadsheetTimeZone();
  return ZONA_SHEET_;
}

/* ---------- Simpanan jawaban Beranda di server (CacheService, Code.gs v0.14) ----------
 * Jawaban Beranda disimpan 2 menit per pengguna dan tanggal. Setiap penulisan lewat
 * denganKunci_ mengganti "versi data", jadi simpanan lama tidak terpakai lagi dan kiriman baru
 * langsung terlihat. Perubahan yang diketik langsung di Sheet terlihat paling lambat 2 menit.
 */
var LAMA_SIMPAN_BERANDA_DETIK = 120;

function versiData_() {
  try {
    var c = CacheService.getScriptCache();
    var v = c.get('versi_data');
    if (!v) {
      v = String(Date.now());
      c.put('versi_data', v, 21600);
    }
    return v;
  } catch (err) {
    return '';
  }
}

function tandaiDataBerubah_() {
  try {
    CacheService.getScriptCache().put('versi_data', String(Date.now()) + '-' + Math.floor(Math.random() * 1e6), 21600);
  } catch (err) {
    console.error('Versi data tidak bisa diganti: ' + err);
  }
}

function ambilTab_(nama) {
  var sheet = ss_().getSheetByName(nama);
  if (!sheet) {
    throw galatPengguna_('Tab ' + nama + ' tidak ada. Jalankan ulang setupSpreadsheet di editor Apps Script.');
  }
  return sheet;
}

/** Peta { kunci: nomor kolom } dari judul kolom di baris 1. */
function posisiKolom_(sheet, peta) {
  var judul = judulTab_(sheet);
  var hasil = {};
  Object.keys(peta).forEach(function (kunci) {
    var i = -1;
    for (var c = 0; c < judul.length; c++) {
      if (String(judul[c]).trim() === peta[kunci]) { i = c; break; }
    }
    if (i < 0) {
      throw galatPengguna_('Kolom ' + peta[kunci] + ' tidak ada di tab ' + sheet.getName() +
        '. Jalankan ulang setupSpreadsheet di editor Apps Script.');
    }
    hasil[kunci] = i + 1;
  });
  return hasil;
}

/** Seperti posisiKolom_, dari judul yang sudah dibaca. */
function posisiKolomJudul_(judul, peta, namaTab) {
  var hasil = {};
  Object.keys(peta).forEach(function (kunci) {
    var i = -1;
    for (var c = 0; c < judul.length; c++) {
      if (String(judul[c]).trim() === peta[kunci]) { i = c; break; }
    }
    if (i < 0) {
      throw galatPengguna_('Kolom ' + peta[kunci] + ' tidak ada di tab ' + namaTab +
        '. Jalankan ulang setupSpreadsheet di editor Apps Script.');
    }
    hasil[kunci] = i + 1;
  });
  return hasil;
}

/** Menjalankan fn di dalam kunci skrip, supaya dua permintaan tidak saling menimpa. */
/**
 * Menjalankan fn di dalam kunci skrip, supaya dua permintaan tidak saling menimpa.
 * Simpanan baca per permintaan tidak dipakai di dalamnya dan dibuang sesudahnya, dan
 * versi data diganti supaya simpanan Beranda di server tidak terpakai lagi.
 * tanpaUbahData: true untuk login (hanya menulis sesi di Script Properties).
 */
function denganKunci_(fn, tanpaUbahData) {
  var kunci = LockService.getScriptLock();
  if (!kunci.tryLock(15000)) {
    throw galatPengguna_('Server sedang sibuk. Coba lagi sebentar lagi.');
  }
  DALAM_KUNCI_++;
  lupakanMemoTab_();
  try {
    return fn();
  } finally {
    DALAM_KUNCI_--;
    lupakanMemoTab_();
    if (!tanpaUbahData) tandaiDataBerubah_();
    kunci.releaseLock();
  }
}

function rapikanTeks_(nilai) {
  return String(nilai == null ? '' : nilai).replace(/\s+/g, ' ').trim();
}

/** Teks untuk sel Sheet: yang diawali =, +, -, atau @ diberi kutip supaya tidak menjadi rumus. */
function teksAman_(teks) {
  return /^[=+\-@]/.test(teks) ? "'" + teks : teks;
}

function bacaJson_(teks) {
  if (!teks) return null;
  try {
    return JSON.parse(teks);
  } catch (err) {
    return null;
  }
}

function heks_(bytes) {
  return bytes.map(function (b) {
    return ('0' + (b & 0xff).toString(16)).slice(-2);
  }).join('');
}

function sha256Heks_(teks) {
  return heks_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, teks, Utilities.Charset.UTF_8));
}

/** Membandingkan dua teks dengan waktu tetap (tidak membocorkan letak beda). */
function samaTeks_(a, b) {
  a = String(a);
  b = String(b);
  var beda = a.length ^ b.length;
  for (var i = 0; i < Math.max(a.length, b.length); i++) {
    beda |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return beda === 0;
}

/* =========================================================================
 * Akses: staff, PIN, sesi, kunci percobaan (spesifikasi sistem Bagian 7)
 * ========================================================================= */

var ROLE_SEMUA = ['Staff', 'Head Kitchen', 'Manager'];
var ROLE_PENGELOLA = ['Head Kitchen', 'Manager'];
var BATAS_SALAH = 5;
var LAMA_KUNCI_MS = 15 * 60 * 1000;
// Kunci bertingkat (Code.gs v0.17): kunci ketiga dalam 24 jam berlangsung 24 jam, atau sampai PIN direset.
var JENDELA_KUNCI_MS = 24 * 60 * 60 * 1000;
var KUNCI_KE_PANJANG = 3;
var LAMA_KUNCI_PANJANG_MS = 24 * 60 * 60 * 1000;
var LAMA_SESI_MS = 12 * 60 * 60 * 1000;
var PANJANG_NAMA_MAKS = 40;
var PANJANG_OUTLET_MAKS = 60;

/** Script Properties: garam rahasia PIN, sesi, dan hitungan salah. */
var PROP_RAHASIA_PIN = 'PIN_RAHASIA';
var PROP_GAGAL_KODE = 'GAGAL_KODE';
var AWALAN_SESI = 'SESI_';
var AWALAN_GAGAL_PIN = 'GAGAL_PIN_';

var KOLOM_STAFF = {
  nama: 'Nama',
  role: 'Role',
  pin: 'PIN (hash)',
  aktif: 'Aktif',
  reset: 'Permintaan Reset PIN'
};

/**
 * Kolom Dihapus (waktu). Ditambahkan setupSpreadsheet sejak v0.5.1; selama
 * belum ada, semua staff dianggap belum dihapus dan aksi hapus menolak.
 */
var KOLOM_STAFF_DIHAPUS = 'Dihapus';

/** Nomor kolom berjudul tertentu, atau 0 jika belum ada. */
function posisiKolomOpsional_(sheet, judul) {
  var baris = judulTab_(sheet);
  for (var c = 0; c < baris.length; c++) {
    if (String(baris[c]).trim() === judul) return c + 1;
  }
  return 0;
}

/**
 * Membaca M_Staff: { sheet, kol, daftar: [{ baris, nama, role, hash, aktif, reset }] }.
 * Staff yang dihapus (kolom Dihapus berisi) tidak ikut di daftar: ia hilang dari
 * Login, Pengaturan, dan sesi, dan namanya boleh dipakai staff baru (Bagian 5.1).
 * Namanya tetap terbaca di Riwayat, PDF, dan Log_Perubahan karena di tab Data
 * nama disimpan sebagai teks. termasukDihapus: true hanya untuk pilihan
 * Pengisi di filter Riwayat.
 */
function bacaStaff_(termasukDihapus) {
  var sheet = ambilTab_('M_Staff');
  var nilai = nilaiTab_(sheet); // satu panggilan: judul dan isi
  var kol = posisiKolomJudul_(nilai[0] || [], KOLOM_STAFF, 'M_Staff');
  kol.dihapus = (nilai[0] || []).map(function (j) { return String(j).trim(); }).indexOf(KOLOM_STAFF_DIHAPUS) + 1;
  var daftar = [];
  if (nilai.length >= 2) {
    nilai.slice(1).forEach(function (r, i) {
      var nama = rapikanTeks_(r[kol.nama - 1]);
      if (!nama) return;
      if (!termasukDihapus && kol.dihapus && String(r[kol.dihapus - 1] == null ? '' : r[kol.dihapus - 1]).trim() !== '') return;
      var aktif = r[kol.aktif - 1];
      var reset = r[kol.reset - 1];
      daftar.push({
        baris: i + 2,
        nama: nama,
        role: rapikanTeks_(r[kol.role - 1]),
        hash: String(r[kol.pin - 1] || '').trim(),
        aktif: aktif === true || String(aktif).toUpperCase() === 'TRUE',
        reset: reset instanceof Date && !isNaN(reset.getTime()) ? reset : null
      });
    });
  }
  return { sheet: sheet, kol: kol, daftar: daftar };
}

function cariStaff_(daftar, nama) {
  var cari = rapikanTeks_(nama).toLowerCase();
  if (!cari) return null;
  for (var i = 0; i < daftar.length; i++) {
    if (daftar[i].nama.toLowerCase() === cari) return daftar[i];
  }
  return null;
}

function apakahPengelola_(role) {
  return ROLE_PENGELOLA.indexOf(role) >= 0;
}

/** Ada minimal satu Pengelola aktif yang punya PIN (pemasangan sudah selesai). */
function adaPengelolaSiap_(daftar) {
  return daftar.some(function (s) {
    return s.aktif && s.hash && apakahPengelola_(s.role);
  });
}

function dataPengguna_(staff) {
  return { nama: staff.nama, role: staff.role, pengelola: apakahPengelola_(staff.role) };
}

function samaNama_(a, b) {
  return rapikanTeks_(a).toLowerCase() === rapikanTeks_(b).toLowerCase();
}

/** Nama staff atau outlet: wajib, dibatasi panjangnya, dan tidak bisa menjadi rumus Sheet. */
function periksaNama_(nilai, label, maks) {
  var teks = rapikanTeks_(nilai);
  if (!teks) throw galatPengguna_('Isi ' + label.toLowerCase() + '.');
  if (teks.length > maks) throw galatPengguna_(label + ' paling panjang ' + maks + ' huruf.');
  if (/^[=+\-@]/.test(teks)) throw galatPengguna_(label + ' tidak boleh diawali tanda =, +, -, atau @.');
  return teks;
}

function periksaRole_(role) {
  if (ROLE_SEMUA.indexOf(role) < 0) throw galatPengguna_('Pilih role: Staff, Head Kitchen, atau Manager.');
  return role;
}

function periksaFormatPin_(pin) {
  if (typeof pin !== 'string' || !/^\d{6}$/.test(pin)) throw galatPengguna_('PIN harus 6 angka.');
  return pin;
}

/**
 * PIN baru (pemasangan, pemulihan, tambah staff, reset PIN): 6 angka dan tidak mudah ditebak.
 * Login tidak memakai ini, supaya PIN lama yang sudah terlanjur mudah tetap bisa masuk.
 */
function periksaPinBaru_(pin) {
  periksaFormatPin_(pin);
  if (pinLemah_(pin)) {
    throw galatPengguna_('PIN ini terlalu mudah ditebak (angka sama, berurutan, atau berulang). Pilih 6 angka lain.');
  }
  return pin;
}

/** PIN yang sering dipakai orang. Pola berulang dan berurutan dikenali pinLemah_. */
var PIN_LEMAH_LAIN = ['112233', '111222', '123321', '147258', '258369', '159753', '147852', '102030'];

/**
 * PIN yang mudah ditebak: berulang tiap 1, 2, atau 3 angka (000000, 121212, 123123), berurutan naik
 * atau turun (123456, 654321, 890123), atau ada di PIN_LEMAH_LAIN. Aturan yang sama ada di app.js (pinLemah).
 */
function pinLemah_(pin) {
  for (var p = 1; p <= 3; p++) {
    if (pin.slice(p) === pin.slice(0, pin.length - p)) return true;
  }
  var naik = true;
  var turun = true;
  for (var i = 1; i < pin.length; i++) {
    var beda = pin.charCodeAt(i) - pin.charCodeAt(i - 1);
    if (beda !== 1 && beda !== -9) naik = false;
    if (beda !== -1 && beda !== 9) turun = false;
  }
  return naik || turun || PIN_LEMAH_LAIN.indexOf(pin) >= 0;
}

/* ---------- PIN: hash bergaram ---------- */

/**
 * Rahasia tambahan untuk hash PIN, dibuat sekali dan hanya disimpan di
 * Script Properties (tidak di Sheet). Jika Sheet bocor tanpa rahasia ini,
 * PIN tidak bisa ditebak dari hash-nya.
 */
function rahasiaPin_() {
  var props = PropertiesService.getScriptProperties();
  var rahasia = props.getProperty(PROP_RAHASIA_PIN);
  if (!rahasia) {
    rahasia = sha256Heks_(Utilities.getUuid() + Utilities.getUuid() + Date.now());
    props.setProperty(PROP_RAHASIA_PIN, rahasia);
  }
  return rahasia;
}

/** Hash PIN: "h1$<garam>$<HMAC-SHA256(garam:pin, rahasia)>". */
function hashPin_(pin, garam) {
  var tanda = Utilities.computeHmacSha256Signature(garam + ':' + pin, rahasiaPin_(), Utilities.Charset.UTF_8);
  return 'h1$' + garam + '$' + heks_(tanda);
}

function buatHashPin_(pin) {
  return hashPin_(pin, sha256Heks_(Utilities.getUuid()).slice(0, 32));
}

function cocokPin_(pin, simpanan) {
  var bagian = String(simpanan || '').split('$');
  if (bagian.length !== 3 || bagian[0] !== 'h1' || !bagian[1]) return false;
  return samaTeks_(hashPin_(pin, bagian[1]), simpanan);
}

/** Sidik PIN di dalam sesi: sesi gugur jika PIN direset. */
function sidikPin_(hash) {
  return String(hash || '').slice(-12);
}

/* ---------- Sesi ---------- */

function kunciSesi_(token) {
  return AWALAN_SESI + sha256Heks_(token).slice(0, 40);
}

/** Membuat sesi 12 jam. Yang disimpan hanya hash token, bukan tokennya. */
function buatSesi_(staff) {
  var props = PropertiesService.getScriptProperties();
  bersihkanCatatanLama_(props);
  var token = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    Utilities.getUuid() + Utilities.getUuid() + Date.now())).replace(/=+$/, '');
  var sampai = Date.now() + LAMA_SESI_MS;
  props.setProperty(kunciSesi_(token), JSON.stringify({ n: staff.nama, s: sampai, p: sidikPin_(staff.hash) }));
  return {
    token: token,
    berlakuSampai: new Date(sampai).toISOString(),
    pengguna: dataPengguna_(staff),
    namaOutlet: namaOutlet_(),
    keluarOtomatisMenit: keluarOtomatisMenit_()
  };
}

/**
 * Memeriksa token pada setiap aksi. Role dan status aktif dibaca ulang dari
 * M_Staff, jadi perubahan role atau penonaktifan langsung berlaku.
 */
function periksaSesi_(token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) throw galatSesi_();
  var props = PropertiesService.getScriptProperties();
  var kunci = kunciSesi_(token);
  var sesi = bacaJson_(props.getProperty(kunci));
  if (!sesi || !(Date.now() < sesi.s)) {
    if (sesi) props.deleteProperty(kunci);
    throw galatSesi_();
  }
  var staff = cariStaff_(bacaStaff_().daftar, sesi.n);
  if (!staff || !staff.aktif || !staff.hash || sidikPin_(staff.hash) !== sesi.p) {
    props.deleteProperty(kunci);
    throw galatSesi_();
  }
  return dataPengguna_(staff);
}

/** Membuang sesi yang sudah habis dan kunci percobaan yang sudah lewat. */
function bersihkanCatatanLama_(props) {
  var semua = props.getProperties();
  var kini = Date.now();
  Object.keys(semua).forEach(function (kunci) {
    if (kunci.indexOf(AWALAN_SESI) !== 0 && kunci.indexOf(AWALAN_GAGAL_PIN) !== 0) return;
    var isi = bacaJson_(semua[kunci]);
    // Hitungan PIN yang kuncinya sudah habis tetap disimpan selama masih ada kunci dalam 24 jam terakhir.
    var habis = !isi ||
      (kunci.indexOf(AWALAN_SESI) === 0 && !(kini < isi.s)) ||
      (kunci.indexOf(AWALAN_GAGAL_PIN) === 0 && isi.s && kini >= isi.s && !keadaanGagal_(isi, kini).k.length);
    if (habis) props.deleteProperty(kunci);
  });
}

/* ---------- Hitungan salah dan kunci 15 menit ---------- */

function kunciGagalPin_(nama) {
  return AWALAN_GAGAL_PIN + sha256Heks_(rapikanTeks_(nama).toLowerCase()).slice(0, 24);
}

/**
 * Keadaan hitungan salah, tanpa menulis apa pun: { j: jumlah salah berturut-turut, s: terkunci sampai
 * (ms, 0 = tidak), k: waktu mulai tiap kunci dalam 24 jam terakhir (hanya PIN), p: kunci 24 jam }.
 */
function keadaanGagal_(g, kini) {
  g = g || {};
  var k = (Array.isArray(g.k) ? g.k : []).filter(function (t) {
    return typeof t === 'number' && kini - t < JENDELA_KUNCI_MS;
  });
  if (g.s && kini >= g.s) return { j: 0, s: 0, k: k, p: false };
  return { j: Number(g.j) || 0, s: Number(g.s) || 0, k: k, p: !!(g.s && g.p) };
}

function bacaGagal_(props, kunci) {
  var asli = bacaJson_(props.getProperty(kunci));
  var g = keadaanGagal_(asli, Date.now());
  if (asli && !g.j && !g.s && !g.k.length) props.deleteProperty(kunci);
  return g;
}

/**
 * Mencatat satu kali salah. Lima kali berturut-turut mengunci 15 menit. bertingkat (PIN): kunci yang
 * ketiga dalam 24 jam berlangsung 24 jam, supaya PIN tidak bisa ditebak terus-menerus 5 kali tiap 15 menit.
 */
function catatGagal_(props, kunci, g, bertingkat) {
  g.j += 1;
  if (g.j >= BATAS_SALAH) {
    var kini = Date.now();
    if (bertingkat) {
      g.k = (g.k || []).concat([kini]);
      g.p = g.k.length >= KUNCI_KE_PANJANG;
    }
    g.s = kini + (g.p ? LAMA_KUNCI_PANJANG_MS : LAMA_KUNCI_MS);
  }
  props.setProperty(kunci, JSON.stringify(g));
  return g;
}

function sisaMenit_(sampai) {
  return Math.max(1, Math.ceil((sampai - Date.now()) / 60000));
}

/** "12 menit" atau, untuk kunci 24 jam, "23 jam". */
function sisaWaktu_(sampai) {
  var menit = sisaMenit_(sampai);
  return menit <= 60 ? menit + ' menit' : Math.ceil(menit / 60) + ' jam';
}

/**
 * Akun aktif yang terkunci karena PIN salah (Code.gs v0.17), tanpa menulis apa pun:
 * [{ nama, sampai (ISO, null jika sudah terbuka), panjang, kali (jumlah kunci dalam 24 jam terakhir) }],
 * urut abjad. Beranda dan Dashboard memakai yang masih terkunci; email harian semuanya.
 */
function akunTerkunci_() {
  var semua = PropertiesService.getScriptProperties().getProperties();
  var kini = Date.now();
  var hasil = [];
  bacaStaff_().daftar.forEach(function (s) {
    if (!s.aktif || !s.hash) return;
    var g = keadaanGagal_(bacaJson_(semua[kunciGagalPin_(s.nama)]), kini);
    if (!g.s && !g.k.length) return;
    hasil.push({ nama: s.nama, sampai: g.s ? new Date(g.s).toISOString() : null, panjang: g.p, kali: g.k.length });
  });
  return hasil.sort(function (a, b) { return a.nama.localeCompare(b.nama, 'id'); });
}

/* ---------- Konfigurasi dan outlet ---------- */

function bacaKonfigurasi_() {
  var sheet = ambilTab_('M_Konfigurasi');
  var nilai = {};
  var baris = {};
  var isi = nilaiTab_(sheet);
  if (isi.length >= 2) {
    isi.slice(1).forEach(function (r, i) {
      var kunci = String(r[0]).trim().toLowerCase();
      if (kunci && !baris[kunci]) {
        baris[kunci] = i + 2;
        nilai[kunci] = r[1];
      }
    });
  }
  return { sheet: sheet, nilai: nilai, baris: baris };
}

/** Menulis Nilai (dan Keterangan, jika diberikan); baris dibuat jika belum ada. */
function tulisKonfigurasi_(kunci, nilai, keterangan) {
  var konf = bacaKonfigurasi_();
  var baris = konf.baris[kunci];
  if (baris) {
    konf.sheet.getRange(baris, 2).setValue(nilai);
    if (keterangan != null) konf.sheet.getRange(baris, 3).setValue(keterangan);
  } else {
    konf.sheet.getRange(barisBaruMaster_(konf.sheet, 1, 1), 1, 1, 3).setValues([[kunci, nilai, keterangan || '']]);
  }
}

/**
 * Keluar otomatis (spesifikasi sistem Bagian 7.2): lamanya dalam menit, dari
 * M_Konfigurasi baris keluar_otomatis_menit. Nilai yang kosong atau tidak sah
 * dibaca sebagai nilai awal 5 menit. Dihitung di perangkat; server hanya
 * menyimpan dan mengirimkannya saat login dan di Beranda.
 */
var PILIHAN_KELUAR_OTOMATIS = [5, 10, 15, 30];
var KELUAR_OTOMATIS_AWAL = 5;
var KETERANGAN_KELUAR_OTOMATIS = 'Aplikasi keluar sendiri setelah sekian menit tidak dipakai: 5, 10, 15, atau 30. ' +
  'Diubah Pengelola di Pengaturan → Outlet dan jadwal.';

function keluarOtomatisMenit_(nilai) {
  if (arguments.length === 0) nilai = bacaKonfigurasi_().nilai.keluar_otomatis_menit;
  var n = Number(String(nilai == null ? '' : nilai).trim());
  return PILIHAN_KELUAR_OTOMATIS.indexOf(n) >= 0 ? n : KELUAR_OTOMATIS_AWAL;
}

/** Zona waktu sistem: yang terdeteksi saat pemasangan, atau zona spreadsheet. */
function zonaWaktu_() {
  var zona = String(bacaKonfigurasi_().nilai.zona_waktu || '').trim();
  return zona || zonaSheet_() || Session.getScriptTimeZone();
}

/** Zona waktu IANA dari perangkat, misalnya "Asia/Jakarta". */
function zonaSah_(zona) {
  return typeof zona === 'string' && zona.length <= 64 &&
    /^[A-Za-z]+(\/[A-Za-z0-9_+\-]+){0,2}$/.test(zona);
}

function namaOutlet_() {
  var sheet = ambilTab_('M_Outlet');
  var isi = nilaiTab_(sheet);
  var c = posisiKolomJudul_(isi[0] || [], { nama: 'Nama Outlet' }, 'M_Outlet').nama;
  return rapikanTeks_(isi.length >= 2 ? isi[1][c - 1] : '');
}

/* ---------- Kode Pemasangan ---------- */

function rapikanKode_(kode) {
  return String(kode == null ? '' : kode).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Memeriksa Kode Pemasangan. Lima kali salah berturut-turut mengunci layar
 * pemasangan dan pemulihan selama 15 menit.
 */
function periksaKodePemasangan_(kode) {
  var props = PropertiesService.getScriptProperties();
  var g = bacaGagal_(props, PROP_GAGAL_KODE);
  if (g.s) {
    throw galatPengguna_('Layar ini terkunci karena Kode Pemasangan salah 5 kali. Coba lagi dalam ' +
      sisaMenit_(g.s) + ' menit.');
  }
  var simpanan = rapikanKode_(bacaKonfigurasi_().nilai.kode_pemasangan);
  if (!simpanan) {
    throw galatPengguna_('Belum ada Kode Pemasangan yang berlaku. Pemilik Sheet menjalankan buatKodePemasangan ' +
      'di editor Apps Script, lalu kodenya ada di tab M_Konfigurasi.');
  }
  if (!samaTeks_(rapikanKode_(kode), simpanan)) {
    g = catatGagal_(props, PROP_GAGAL_KODE, g);
    if (g.s) throw galatPengguna_('Kode Pemasangan salah 5 kali. Layar ini terkunci 15 menit.');
    throw galatPengguna_('Kode Pemasangan salah. Sisa ' + (BATAS_SALAH - g.j) + ' percobaan.');
  }
  props.deleteProperty(PROP_GAGAL_KODE);
}

/** Kode sekali pakai: dikosongkan setelah dipakai. */
function hanguskanKodePemasangan_() {
  tulisKonfigurasi_('kode_pemasangan', '',
    'Kode sudah dipakai ' + Utilities.formatDate(new Date(), zonaWaktu_(), 'yyyy-MM-dd HH:mm') +
    '. Untuk kode baru, jalankan buatKodePemasangan di editor Apps Script.');
}

/**
 * Jalankan dari editor Apps Script jika tidak ada Pengelola yang bisa masuk.
 * Kode baru tertulis di tab M_Konfigurasi (baris kode_pemasangan) dan dipakai
 * lewat "Pulihkan akses Pengelola" di layar Login. Kunci 15 menit akibat kode
 * salah ikut dibuka.
 */
function buatKodePemasangan() {
  if (sudahPindah_()) {
    teruskanKeSupabase_('buatKodePemasangan');
    return sinkronDariSupabase();
  }
  var kode = buatKodeAcak_(8);
  tulisKonfigurasi_('kode_pemasangan', kode,
    'Kode Pemasangan sekali pakai, dibuat ' + Utilities.formatDate(new Date(), zonaWaktu_(), 'yyyy-MM-dd HH:mm') +
    '. Dipakai lewat "Pulihkan akses Pengelola" di layar Login. Hangus setelah dipakai.');
  PropertiesService.getScriptProperties().deleteProperty(PROP_GAGAL_KODE);
  console.log('Kode Pemasangan baru sudah dibuat. Lihat tab M_Konfigurasi, baris kode_pemasangan.');
}

/* ---------- Baris baru: tepat di bawah baris terakhir yang kolom kuncinya terisi ---------- */

/*
 * Kotak centang yang tidak dicentang menyimpan FALSE, dan dropdown bisa berisi
 * pilihan tanpa baris itu punya data. getLastRow() menghitung keduanya sebagai
 * isi, sehingga baris baru dulu tertulis jauh di bawah. Karena itu setiap tab
 * yang ditulis aplikasi punya kolom kunci yang selalu terisi pada baris data:
 * Nama (M_Staff), Satuan (M_Satuan), ID Form (M_Form), Kunci (M_Konfigurasi),
 * Tanggal (Stock_Harian dan semua tab Data), Waktu (Log_Perubahan). Baris
 * yang kolom kuncinya kosong bukan data.
 */

function kunciTerisi_(v) {
  return v !== false && v != null && String(v).trim() !== '';
}

/** Nomor baris terakhir yang kolom kuncinya (nomor kolom) terisi; 1 = hanya baris judul. */
function barisKunciTerakhir_(sheet, kolomKunci) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 1;
  var nilai = sheet.getRange(2, kolomKunci, lastRow - 1, 1).getValues();
  for (var i = nilai.length - 1; i >= 0; i--) {
    if (kunciTerisi_(nilai[i][0])) return i + 2;
  }
  return 1;
}

/** Nomor baris untuk n baris baru di tab master; baris ditambah jika tab penuh. */
function barisBaruMaster_(sheet, kolomKunci, n) {
  var mulai = barisKunciTerakhir_(sheet, kolomKunci) + 1;
  var maks = sheet.getMaxRows();
  if (mulai + n - 1 > maks) sheet.insertRowsAfter(maks, mulai + n - 1 - maks);
  return mulai;
}

/**
 * Merapikan tab master: semua baris yang kolom kuncinya terisi dipindah ke
 * atas berurutan mulai baris 2, tanpa mengubah urutan dan isinya. Isi baris
 * lain (kolom kunci kosong: kotak centang FALSE, pilihan dropdown tanpa data)
 * dikosongkan; validasi dan format tetap. Mengembalikan { pindah, dibersihkan }:
 * jumlah baris data yang berpindah dan jumlah baris tanpa kunci yang berisi
 * sesuatu selain FALSE. Dipanggil di dalam kunci (atau dari setupSpreadsheet).
 */
function rapikanTabMaster_(sheet, kolomKunci) {
  var hasil = { pindah: 0, dibersihkan: 0 };
  var lastRow = sheet.getLastRow();
  var lebar = sheet.getLastColumn();
  if (lastRow < 2 || lebar < 1) return hasil;
  var semua = sheet.getRange(2, 1, lastRow - 1, lebar).getValues();
  var data = [];
  semua.forEach(function (b, i) {
    if (kunciTerisi_(b[kolomKunci - 1])) {
      if (i !== data.length) hasil.pindah++;
      data.push(b);
    } else if (b.some(function (v) { return v !== false && kunciTerisi_(v); })) {
      hasil.dibersihkan++;
    }
  });
  if (data.length === semua.length) return hasil; // sudah rapat, tanpa baris kosong
  if (hasil.pindah) sheet.getRange(2, 1, data.length, lebar).setValues(data);
  sheet.getRange(data.length + 2, 1, semua.length - data.length, lebar).clearContent();
  return hasil;
}

/** Kolom kunci tab master yang ditulis aplikasi (judul kolom). */
var KUNCI_MASTER = {
  M_Staff: 'Nama',
  M_Satuan: 'Satuan',
  M_Form: 'ID Form',
  M_FormKolom: 'ID Form',
  M_Konfigurasi: 'Kunci',
  M_Resep: 'Item Hasil',
  M_ResepBahan: 'Item Hasil',
  M_Item: 'Nama Item',
  M_HargaItem: 'Nama Item',
  M_Menu: 'Nama Menu',
  M_MenuBahan: 'Nama Menu',
  M_Kategori: 'Nama Kategori',
  M_Unit: 'Nama Unit',
  M_Pemasok: 'Nama Pemasok',
  M_HariLibur: 'Tanggal'
};

function kolomKunciMaster_(sheet) {
  var judul = KUNCI_MASTER[sheet.getName()];
  return posisiKolom_(sheet, { k: judul }).k;
}

/* ---------- Menulis M_Staff ---------- */

function tulisStaff_(info, staff, ubah) {
  Object.keys(ubah).forEach(function (kunci) {
    info.sheet.getRange(staff.baris, info.kol[kunci]).setValue(ubah[kunci]);
  });
}

/**
 * Staff baru ditulis tepat di bawah baris terakhir yang kolom Nama-nya terisi.
 * M_Staff dirapikan dulu, supaya staff lama yang tertulis jauh di bawah ikut
 * naik. Nomor baris di info tidak berlaku lagi sesudah ini (pemanggil membaca
 * ulang M_Staff).
 */
function tambahBarisStaff_(info, isi) {
  rapikanTabMaster_(info.sheet, info.kol.nama);
  var lebar = info.sheet.getLastColumn();
  var baris = [];
  for (var i = 0; i < lebar; i++) baris.push('');
  Object.keys(isi).forEach(function (kunci) {
    baris[info.kol[kunci] - 1] = isi[kunci];
  });
  var nomor = barisBaruMaster_(info.sheet, info.kol.nama, 1);
  info.sheet.getRange(nomor, 1, 1, lebar).setValues([baris]);
  return nomor;
}

/** Daftar staff untuk Pengaturan → Staff dan PIN: staff aktif lebih dulu, lalu yang nonaktif; masing-masing urut abjad. */
function ringkasStaff_(daftar) {
  var props = PropertiesService.getScriptProperties();
  return daftar.slice().sort(function (a, b) {
    return (b.aktif ? 1 : 0) - (a.aktif ? 1 : 0) || a.nama.localeCompare(b.nama, 'id');
  }).map(function (s) {
    var g = bacaGagal_(props, kunciGagalPin_(s.nama));
    return {
      nama: s.nama,
      role: s.role,
      pengelola: apakahPengelola_(s.role),
      aktif: s.aktif,
      punyaPin: !!s.hash,
      permintaanReset: s.reset ? s.reset.toISOString() : null,
      terkunci: !!g.s,
      terkunciSampai: g.s ? new Date(g.s).toISOString() : null,
      kunciPanjang: g.p
    };
  });
}

/* =========================================================================
 * Aksi: layar Login, pemasangan, pemulihan (tanpa token)
 * ========================================================================= */

/** Daftar nama untuk layar Login, nama outlet, dan apakah pemasangan pertama dibutuhkan. */
function aksiInfoLogin_() {
  var daftar = bacaStaff_().daftar;
  return {
    perluPemasangan: !adaPengelolaSiap_(daftar),
    namaOutlet: namaOutlet_(),
    staff: daftar.filter(function (s) { return s.aktif; })
      .sort(function (a, b) { return a.nama.localeCompare(b.nama, 'id'); })
      .map(function (s) {
        return { nama: s.nama, pengelola: apakahPengelola_(s.role), punyaPin: !!s.hash };
      })
  };
}

function aksiLogin_(body) {
  var nama = rapikanTeks_(body.nama);
  if (!nama) throw galatPengguna_('Pilih nama dulu.');
  var pin = periksaFormatPin_(body.pin);
  var sesi = denganKunci_(function () {
    var staff = cariStaff_(bacaStaff_().daftar, nama);
    if (!staff || !staff.aktif || !staff.hash) {
      throw galatPengguna_('Nama ' + nama + ' tidak bisa masuk. Muat ulang layar Login, atau minta Head Kitchen atau Manager memeriksa akunnya.');
    }
    var props = PropertiesService.getScriptProperties();
    var kunci = kunciGagalPin_(staff.nama);
    var g = bacaGagal_(props, kunci);
    if (g.s) {
      throw galatPengguna_('Terkunci. Coba lagi dalam ' + sisaWaktu_(g.s) +
        ', atau minta Head Kitchen atau Manager mereset PIN.');
    }
    if (cocokPin_(pin, staff.hash)) {
      props.deleteProperty(kunci);
      return buatSesi_(staff);
    }
    g = catatGagal_(props, kunci, g, true);
    if (g.s) {
      // Pemberitahuan "terkunci" di Beranda Pengelola langsung tampil (simpanan Beranda tidak dipakai lagi).
      tandaiDataBerubah_();
      kirimNotifikasi_('pengelola', { judul: staff.nama + ' terkunci karena PIN salah',
        isi: (g.p ? 'Salah berulang kali dalam 24 jam; mungkin ada yang mencoba menebaknya. ' : '') +
          'Terbuka sendiri ' + waktuPendekId_(new Date(g.s)) + '. Ketuk untuk membuat PIN baru.',
        url: '#/pengaturan/staff/' + encodeURIComponent(staff.nama) + '/pin', tag: 'kunci-' + staff.nama.toLowerCase(), mendesak: !!g.p });
      if (g.p) {
        throw galatPengguna_('PIN salah 5 kali lagi. Akun terkunci 24 jam, atau sampai Head Kitchen atau Manager mereset PIN.');
      }
      throw galatPengguna_('Terkunci 15 menit. Minta Head Kitchen atau Manager mereset PIN.');
    }
    var sisa = BATAS_SALAH - g.j;
    throw galatPengguna_('PIN salah. Sisa ' + sisa + ' percobaan.' +
      (sisa === 1 && g.k.length >= KUNCI_KE_PANJANG - 1 ? ' Jika salah lagi, akun terkunci 24 jam.' : ''));
  }, true);
  return lampirkanBeranda_(sesi, body);
}

/**
 * Login, pemasangan, dan pemulihan langsung membawa data Beranda (Code.gs v0.14), supaya HP
 * tidak perlu satu panggilan lagi sesudah PIN benar. Dihitung di luar kunci. Jika gagal,
 * login tetap berhasil dan HP memuat Beranda sendiri.
 */
function lampirkanBeranda_(sesi, body) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.tanggal || ''))) return sesi;
  try {
    PENGGUNA_AKSI_ = sesi.pengguna;
    sesi.beranda = aksiBeranda_(body, sesi.pengguna);
  } catch (err) {
    console.error('Beranda untuk login gagal: ' + (err && err.stack ? err.stack : err));
  }
  return sesi;
}

/** Lupa PIN: mencatat waktu permintaan. Satu permintaan aktif per staff. */
function aksiLupaPin_(body) {
  var nama = rapikanTeks_(body.nama);
  return denganKunci_(function () {
    var info = bacaStaff_();
    var staff = cariStaff_(info.daftar, nama);
    if (!staff || !staff.aktif) throw galatPengguna_('Nama tidak ditemukan. Muat ulang layar Login.');
    if (staff.reset) return { sudahAda: true, waktu: staff.reset.toISOString() };
    var kini = new Date();
    tulisStaff_(info, staff, { reset: kini });
    kirimNotifikasi_('pengelola', { judul: staff.nama + ' meminta reset PIN', isi: 'Ketuk untuk membuat PIN baru.',
      url: '#/pengaturan/staff/' + encodeURIComponent(staff.nama) + '/pin', tag: 'reset-' + staff.nama.toLowerCase() });
    return { sudahAda: false, waktu: kini.toISOString() };
  });
}

/**
 * Pemasangan pertama: hanya jika belum ada Pengelola. Memeriksa Kode
 * Pemasangan, menyimpan nama outlet, membuat akun Pengelola, menyimpan zona
 * waktu perangkat, lalu menghanguskan kode. Pengguna langsung masuk.
 */
function aksiPasang_(body) {
  var namaOutlet = periksaNama_(body.namaOutlet, 'Nama outlet', PANJANG_OUTLET_MAKS);
  var nama = periksaNama_(body.nama, 'Nama', PANJANG_NAMA_MAKS);
  if (ROLE_PENGELOLA.indexOf(body.role) < 0) throw galatPengguna_('Pilih role: Head Kitchen atau Manager.');
  var pin = periksaPinBaru_(body.pin);
  if (!rapikanKode_(body.kode)) throw galatPengguna_('Isi Kode Pemasangan.');
  var zona = zonaSah_(body.zonaWaktu) ? body.zonaWaktu : '';

  var sesi = denganKunci_(function () {
    var info = bacaStaff_();
    if (adaPengelolaSiap_(info.daftar)) {
      throw galatPengguna_('Pemasangan sudah selesai. Masuk dengan PIN di layar Login.');
    }
    periksaKodePemasangan_(body.kode);

    var outlet = ambilTab_('M_Outlet');
    outlet.getRange(2, posisiKolom_(outlet, { nama: 'Nama Outlet' }).nama).setValue(namaOutlet);

    var hash = buatHashPin_(pin);
    var staff = cariStaff_(info.daftar, nama);
    if (staff) {
      tulisStaff_(info, staff, { role: body.role, pin: hash, aktif: true, reset: '' });
    } else {
      staff = { nama: nama };
      staff.baris = tambahBarisStaff_(info, { nama: nama, role: body.role, pin: hash, aktif: true });
    }
    staff.role = body.role;
    staff.hash = hash;
    staff.aktif = true;
    PropertiesService.getScriptProperties().deleteProperty(kunciGagalPin_(staff.nama));

    if (zona) {
      tulisKonfigurasi_('zona_waktu', zona);
      try {
        ss_().setSpreadsheetTimeZone(zona);
        ZONA_SHEET_ = null;
      } catch (err) {
        console.error('Zona waktu spreadsheet tidak bisa diubah: ' + err);
      }
    }
    hanguskanKodePemasangan_();
    return buatSesi_(staff);
  });
  return lampirkanBeranda_(sesi, body);
}

/** Pulihkan akses Pengelola: Kode Pemasangan baru + PIN baru untuk seorang Pengelola. */
function aksiPulihkan_(body) {
  var nama = rapikanTeks_(body.nama);
  if (!nama) throw galatPengguna_('Pilih nama Head Kitchen atau Manager.');
  var pin = periksaPinBaru_(body.pin);
  if (!rapikanKode_(body.kode)) throw galatPengguna_('Isi Kode Pemasangan.');

  var sesi = denganKunci_(function () {
    var info = bacaStaff_();
    var staff = cariStaff_(info.daftar, nama);
    if (!staff || !staff.aktif || !apakahPengelola_(staff.role)) {
      throw galatPengguna_('Pilih nama Head Kitchen atau Manager yang aktif.');
    }
    periksaKodePemasangan_(body.kode);
    var hash = buatHashPin_(pin);
    tulisStaff_(info, staff, { pin: hash, reset: '' });
    staff.hash = hash;
    PropertiesService.getScriptProperties().deleteProperty(kunciGagalPin_(staff.nama));
    hanguskanKodePemasangan_();
    return buatSesi_(staff);
  });
  return lampirkanBeranda_(sesi, body);
}

/** Keluar (tombol Keluar dan keluar otomatis): menghapus sesi yang dikirim. Tidak gagal jika sesi sudah habis. */
function aksiKeluar_(body) {
  if (typeof body.token === 'string' && body.token.length >= 20 && body.token.length <= 100) {
    PropertiesService.getScriptProperties().deleteProperty(kunciSesi_(body.token));
  }
  return {};
}

/* =========================================================================
 * Aksi: Beranda (spesifikasi sistem Bagian 5.8, tampilan Bagian 5.2)
 * ========================================================================= */

/** Tab data tiap form bawaan; form kustom memakai Data_K_<ID Form> (Bagian 5.6). */
var TAB_DATA_FORM = {
  STOCK: 'Data_Stock',
  SUHU: 'Data_Suhu',
  PREP: 'Data_Prep',
  WASTE: 'Data_Waste'
};

var WAKTU_CEK_WAJIB = ['opening', 'middle', 'closing'];

/**
 * Data Beranda dalam satu panggilan: pengguna, nama outlet, status tiap
 * form yang tampil untuk tanggal perangkat, dan (khusus Pengelola)
 * permintaan reset PIN serta jumlah isian belum diperiksa dan baris
 * dilaporkan keliru (Tahap 3).
 */
function aksiBeranda_(body, pengguna) {
  var tanggal = /^\d{4}-\d{2}-\d{2}$/.test(String(body.tanggal || ''))
    ? body.tanggal
    : Utilities.formatDate(new Date(), zonaWaktu_(), 'yyyy-MM-dd');
  // Simpanan 2 menit di server (Code.gs v0.14): hanya selama tidak ada penulisan sejak itu.
  var kunciSimpan = 'beranda|' + versiData_() + '|' + tanggal + '|' + pengguna.nama.toLowerCase() + '|' + pengguna.role;
  var simpanan = bacaSimpananBeranda_(kunciSimpan);
  if (simpanan) {
    simpanan.h.pengguna = pengguna;
    if (pengguna.pengelola && body.alamatAplikasi && body.alamatAplikasi !== simpanan.a) simpanAlamatAplikasi_(body.alamatAplikasi);
    return simpanan.h;
  }
  var hasil = berandaBaru_(tanggal, body, pengguna);
  // Kunci dibuat ulang: simpanAlamatAplikasi_ bisa saja baru saja mengganti versi data.
  simpanBeranda_('beranda|' + versiData_() + '|' + tanggal + '|' + pengguna.nama.toLowerCase() + '|' + pengguna.role,
    { h: hasil, a: String(body.alamatAplikasi || '') });
  return hasil;
}

function bacaSimpananBeranda_(kunci) {
  try {
    var teks = CacheService.getScriptCache().get(kunci);
    return teks ? JSON.parse(teks) : null;
  } catch (err) {
    return null;
  }
}

function simpanBeranda_(kunci, isi) {
  try {
    var teks = JSON.stringify(isi);
    if (teks.length < 90000) CacheService.getScriptCache().put(kunci, teks, LAMA_SIMPAN_BERANDA_DETIK);
  } catch (err) {
    console.error('Simpanan Beranda gagal: ' + err);
  }
}

function berandaBaru_(tanggal, body, pengguna) {
  var hasil = {
    pengguna: pengguna,
    namaOutlet: namaOutlet_(),
    tanggal: tanggal,
    form: kelengkapanForm_(tanggal),
    // Hari libur (Code.gs v0.30): semua form.wajib false; status tetap dari isian.
    libur: liburUntukJawaban_(tanggal),
    // Besok hari libur: Pengelola melihatnya sehari sebelumnya (tanggal yang salah masih bisa dihapus), dan HP tanpa
    // sinyal esok hari tahu bahwa hari itu libur.
    liburBesok: liburUntukJawaban_(geserTanggal_(tanggal, 1)),
    // Lewat masa simpan dan Habis besok (Bagian 5.3), untuk semua role (Tahap 6).
    masaSimpan: masaSimpan_(tanggal),
    keluarOtomatisMenit: keluarOtomatisMenit_()
  };
  if (pengguna.pengelola) {
    hasil.permintaanReset = bacaStaff_().daftar.filter(function (s) {
      return s.aktif && s.reset;
    }).sort(function (a, b) {
      return a.reset.getTime() - b.reset.getTime();
    }).map(function (s) {
      return { nama: s.nama, waktu: s.reset.toISOString() };
    });
    // Akun yang sedang terkunci karena PIN salah (Code.gs v0.17).
    hasil.terkunci = akunTerkunci_().filter(function (a) { return a.sampai; }).map(function (a) {
      return { nama: a.nama, sampai: a.sampai, panjang: a.panjang };
    });
    hasil.pemeriksaan = ringkasPemeriksaan_();
    hasil.peringatanSistem = peringatanSistem_();
    // Pengingat stock opname (Bagian 5.7, Tahap 8).
    hasil.opname = statusOpname_();
    simpanAlamatAplikasi_(body.alamatAplikasi);
  }
  return hasil;
}

/**
 * Alamat aplikasi untuk tautan di email harian (Bagian 10), terdeteksi dari
 * HP Pengelola seperti zona waktu. Hanya ditulis jika berubah.
 */
function simpanAlamatAplikasi_(alamat) {
  alamat = String(alamat || '');
  if (!/^https:\/\/[^\s"'<>]{4,200}$/.test(alamat)) return;
  try {
    if (String(bacaKonfigurasi_().nilai.alamat_aplikasi || '') === alamat) return;
    denganKunci_(function () {
      tulisKonfigurasi_('alamat_aplikasi', alamat, 'Terisi otomatis saat Pengelola membuka aplikasi. Dipakai untuk tautan di email harian.');
    });
  } catch (err) {
    console.error('Alamat aplikasi tidak tersimpan: ' + err);
  }
}

/** Tab data satu form: Data_Stock dan seterusnya, atau Data_K_<ID Form> untuk form kustom. */
function tabDataForm_(idForm) {
  return TAB_DATA_FORM[idForm] || (AWALAN_TAB_KUSTOM + idForm);
}

/** Hari dalam seminggu untuk jadwal "hari tertentu", urut Senin sampai Minggu. */
var URUTAN_HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

/** Teks sel Hari ("Senin, Kamis") → ['Senin', 'Kamis'] dalam urutan URUTAN_HARI. */
function bacaHari_(teks) {
  var ada = String(teks == null ? '' : teks).toLowerCase().split(/[,;|]/).map(function (x) { return x.trim(); });
  return URUTAN_HARI.filter(function (h) { return ada.indexOf(h.toLowerCase()) >= 0; });
}

/** Nama hari tanggal "2026-10-05" → "Senin". */
function namaHari_(tanggal) {
  var p = String(tanggal).split('-');
  return HARI_ID[new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]))).getUTCDay()];
}

/**
 * Form di M_Form: [{ id, nama, jenis, keterangan, jadwal, hari, urutan,
 * aktif (tampil), diarsipkan (Date|null), baris }], urut menurut Urutan.
 * Form kustom yang diarsipkan (dihapus dari aplikasi, Bagian 5.6) hanya ikut
 * jika termasukArsip. Form bawaan selalu berjadwal harian.
 */
function bacaDaftarForm_(termasukArsip) {
  var kunciMemo = termasukArsip ? 'formArsip' : 'form';
  if (MEMO_FORM_[kunciMemo]) return MEMO_FORM_[kunciMemo].slice();
  var sheet = ambilTab_('M_Form');
  var kol = posisiKolom_(sheet, {
    id: 'ID Form', nama: 'Nama', jenis: 'Jenis', jadwal: 'Jadwal', urutan: 'Urutan', aktif: 'Aktif'
  });
  var kKet = posisiKolomOpsional_(sheet, 'Keterangan');
  var kHari = posisiKolomOpsional_(sheet, 'Hari');
  var kArsip = posisiKolomOpsional_(sheet, 'Diarsipkan');
  var daftar = [];
  var isi = nilaiTab_(sheet);
  if (isi.length >= 2) {
    isi.slice(1).forEach(function (r, i) {
      var id = rapikanTeks_(r[kol.id - 1]).toUpperCase();
      if (!id) return;
      var jenis = rapikanTeks_(r[kol.jenis - 1]).toLowerCase() === 'kustom' ? 'kustom' : 'bawaan';
      var jadwal = rapikanTeks_(r[kol.jadwal - 1]).toLowerCase();
      if (jenis === 'bawaan' || JADWAL_FORM.indexOf(jadwal) < 0) jadwal = 'harian';
      var arsip = kArsip ? r[kArsip - 1] : '';
      var diarsipkan = arsip instanceof Date ? arsip : (String(arsip == null ? '' : arsip).trim() ? new Date(0) : null);
      if (diarsipkan && jenis !== 'kustom') diarsipkan = null; // form bawaan tidak bisa dihapus
      if (diarsipkan && !termasukArsip) return;
      daftar.push({
        id: id,
        nama: rapikanTeks_(r[kol.nama - 1]) || id,
        jenis: jenis,
        keterangan: kKet ? rapikanTeks_(r[kKet - 1]) : '',
        jadwal: jadwal,
        hari: kHari ? bacaHari_(r[kHari - 1]) : [],
        urutan: Number(r[kol.urutan - 1]) || 999,
        aktif: benar_(r[kol.aktif - 1]),
        diarsipkan: diarsipkan,
        baris: i + 2
      });
    });
  }
  daftar.sort(function (a, b) { return a.urutan - b.urutan; });
  MEMO_FORM_[kunciMemo] = daftar;
  return daftar.slice();
}

/** Satu form menurut ID (termasuk yang diarsipkan), atau null. */
function cariForm_(idForm, termasukArsip) {
  var id = rapikanTeks_(idForm).toUpperCase();
  return bacaDaftarForm_(termasukArsip).filter(function (f) { return f.id === id; })[0] || null;
}

/**
 * Form ditagih (wajib) pada satu tanggal (Bagian 5.8): form yang tampil,
 * bawaan, atau kustom yang jadwalnya mengena tanggal itu. Sewaktu-waktu
 * tidak pernah ditagih.
 */
function wajibPada_(f, tanggal) {
  return !liburPada_(tanggal) && wajibMenurutJadwal_(f, tanggal); // hari libur: tidak ada form yang ditagih (Code.gs v0.30)
}

/** Ditagih menurut tampil dan jadwal form saja, tanpa hari libur (rekap membedakan "tidak dijadwalkan" dari "hari libur"). */
function wajibMenurutJadwal_(f, tanggal) {
  if (!f.aktif || f.diarsipkan) return false;
  if (f.jenis !== 'kustom') return true;
  if (f.jadwal === 'sewaktu-waktu') return false;
  if (f.jadwal === 'hari tertentu') return f.hari.indexOf(namaHari_(tanggal)) >= 0;
  return true;
}

/* ---------- Hari libur (Code.gs v0.30; spesifikasi sistem Bagian 5.8) ---------- */

var TAB_LIBUR = 'M_HariLibur';
var BATAS_LIBUR_DEPAN_HARI = 366;
var PANJANG_KET_LIBUR = 40;
/** Hari libur yang sudah dibaca dalam permintaan ini (dibuang resetMemoForm_ dan setelah tanda ditulis). */
var MEMO_LIBUR_ = null;

/**
 * M_HariLibur: { ada (tab ada), hari: { 'yyyy-mm-dd': { tanggal, keterangan, oleh, pada (Date|null) } } }.
 * Tab yang belum ada (sebelum setupSpreadsheet) = tanpa hari libur. Teks yang bukan tanggal dilewati;
 * dua baris bertanggal sama (diketik tangan): yang lebih atas dipakai.
 */
function bacaLibur_() {
  if (MEMO_LIBUR_) return MEMO_LIBUR_;
  var t = bacaTabel_(TAB_LIBUR);
  var hasil = { ada: !!t, hari: {} };
  if (t) {
    var zona = zonaSheet_();
    t.baris.forEach(function (b) {
      var tg = teksTanggal_(nilai_(t, b, 'Tanggal'), zona);
      if (!tanggalSah_(tg) || hasil.hari[tg]) return;
      var pada = nilai_(t, b, 'Dicatat Pada');
      hasil.hari[tg] = {
        tanggal: tg,
        keterangan: rapikanTeks_(nilai_(t, b, 'Keterangan')),
        oleh: rapikanTeks_(nilai_(t, b, 'Dicatat Oleh')),
        pada: pada instanceof Date && !isNaN(pada.getTime()) ? pada : null
      };
    });
  }
  MEMO_LIBUR_ = hasil;
  return hasil;
}

/** Tanda libur pada tanggal itu, atau null. Satu bacaan tab per permintaan. */
function liburPada_(tanggal) {
  return bacaLibur_().hari[tanggal] || null;
}

/** Bentuk untuk jawaban API: { tanggal, keterangan, oleh, waktu (ISO|null) } | null. */
function liburUntukJawaban_(tanggal) {
  var x = liburPada_(tanggal);
  return x ? { tanggal: x.tanggal, keterangan: x.keterangan, oleh: x.oleh, waktu: x.pada ? x.pada.toISOString() : null } : null;
}

/** Tanggal untuk menandai atau menghapus hari libur: hari ini, tanggal lewat yang belum diarsip, atau paling jauh setahun ke depan. */
function periksaTanggalLibur_(tanggal) {
  if (!tanggalSah_(tanggal)) throw galatPengguna_('Tanggal tidak terbaca. Pilih tanggal lagi.');
  if (tanggal > geserTanggal_(hariIni_(), BATAS_LIBUR_DEPAN_HARI)) {
    throw galatPengguna_('Hari libur paling jauh setahun ke depan. Pilih tanggal yang lebih dekat.');
  }
  periksaBelumDiarsip_(tanggal);
  return tanggal;
}

/** Jawaban Pengaturan → Hari libur: { siap, hariIni, batasDepan, arsipSampai, libur: [{ tanggal, keterangan, oleh, waktu }] } urut tanggal. */
function dataLibur_() {
  var b = bacaLibur_();
  var hari = hariIni_();
  var arsip = arsipSampai_();
  return {
    siap: b.ada,
    hariIni: hari,
    batasDepan: geserTanggal_(hari, BATAS_LIBUR_DEPAN_HARI),
    arsipSampai: arsip,
    // Tanggal yang sudah diarsip tidak dibaca lagi dan tidak bisa dihapus, jadi tidak ditampilkan.
    libur: Object.keys(b.hari).sort().filter(function (t) { return !arsip || t >= arsip; }).map(function (t) { return liburUntukJawaban_(t); })
  };
}

function aksiDaftarLibur_() {
  return dataLibur_();
}

/** Nomor baris (dari bawah) M_HariLibur yang tanggalnya sama dengan tanggal. */
function barisLibur_(t, tanggal) {
  var zona = zonaSheet_();
  return t.baris.map(function (b, i) { return teksTanggal_(nilai_(t, b, 'Tanggal'), zona) === tanggal ? i + 2 : 0; })
    .filter(function (n) { return n; })
    .sort(function (a, b) { return b - a; });
}

/**
 * Menandai satu tanggal sebagai hari libur (khusus Pengelola). body: { tanggal, keterangan }. Tanggal yang sudah libur
 * hanya diganti keterangannya (dicatat di Log_Perubahan). Jawaban dataLibur_ ditambah disimpan: { tanggal, keterangan,
 * baru, isian: [nama form yang sudah punya isian pada tanggal itu] }, supaya tanggal yang salah pilih langsung ketahuan.
 */
function aksiSimpanLibur_(body, pengguna) {
  var tanggal = periksaTanggalLibur_(body.tanggal);
  var ket = teksMaster_(body.keterangan, 'Keterangan', PANJANG_KET_LIBUR);
  return denganKunci_(function () {
    MEMO_LIBUR_ = null;
    var t = bacaTabel_(TAB_LIBUR);
    if (!t) throw galatPengguna_('Tab ' + TAB_LIBUR + ' belum ada. Minta pemilik Sheet menjalankan ulang setupSpreadsheet.');
    var lama = bacaLibur_().hari[tanggal];
    var kini = new Date();
    if (lama) {
      if (lama.keterangan !== ket) {
        tulisBarisMaster_(t, barisLibur_(t, tanggal).pop(), { 'Keterangan': teksAman_(ket) });
        catatLog_(TAB_LIBUR, tanggal, pengguna, kini, [['Keterangan', lama.keterangan, ket]]);
      }
    } else {
      tambahBarisMaster_(TAB_LIBUR, {
        'Tanggal': tanggalSel_(tanggal), 'Keterangan': teksAman_(ket), 'Dicatat Oleh': pengguna.nama, 'Dicatat Pada': kini
      });
    }
    MEMO_LIBUR_ = null;
    var hasil = dataLibur_();
    var isian = tanggal > hasil.hariIni ? [] : kelengkapanForm_(tanggal).filter(function (f) {
      return f.status !== 'belum';
    }).map(function (f) { return f.nama; });
    hasil.disimpan = { tanggal: tanggal, keterangan: ket, baru: !lama, isian: isian };
    return hasil;
  });
}

/**
 * Menghapus tanda hari libur (khusus Pengelola): semua baris bertanggal itu dihapus dan dicatat di Log_Perubahan.
 * Tanggal yang sudah bukan hari libur tidak galat (dua HP menghapus bersamaan): dihapus: null.
 */
function aksiHapusLibur_(body, pengguna) {
  if (!tanggalSah_(body.tanggal)) throw galatPengguna_('Tanggal tidak terbaca. Pilih tanggal lagi.');
  var tanggal = body.tanggal;
  periksaBelumDiarsip_(tanggal);
  return denganKunci_(function () {
    MEMO_LIBUR_ = null;
    var t = bacaTabel_(TAB_LIBUR);
    var lama = t ? bacaLibur_().hari[tanggal] : null;
    if (lama) {
      barisLibur_(t, tanggal).forEach(function (n) { t.sheet.deleteRow(n); });
      catatLog_(TAB_LIBUR, tanggal, pengguna, new Date(),
        [['Tanggal', tanggal + (lama.keterangan ? ' (' + lama.keterangan + ')' : ''), '(dihapus)']]);
    }
    MEMO_LIBUR_ = null;
    var hasil = dataLibur_();
    hasil.dihapus = lama ? tanggal : null;
    return hasil;
  });
}

/**
 * Status tiap form yang tampil (Aktif) pada satu tanggal, menurut aturan
 * kelengkapan Bagian 5.8.
 * wajib  : punya ruas di rel kemajuan (form bawaan, atau form kustom yang
 *          dijadwalkan pada tanggal itu; Tahap 9).
 * status : belum | sebagian (Suhu) | terkirim | nihil.
 */
function kelengkapanForm_(tanggal) {
  var zonaSheet = zonaSheet_();
  var nihil = bacaBarisTanggal_('Data_Nihil', tanggal, zonaSheet, ['ID Form']);
  return bacaDaftarForm_().filter(function (f) { return f.aktif; }).map(function (f) {
    var dasar = {
      id: f.id,
      nama: f.nama,
      jenis: f.jenis,
      jadwal: f.jadwal,
      hari: f.hari,
      wajib: wajibPada_(f, tanggal)
    };
    if (f.id === 'SUHU') return statusSuhu_(dasar, tanggal, zonaSheet);

    var kiriman = bacaBarisTanggal_(tabDataForm_(f.id), tanggal, zonaSheet, []);
    var tandaNihil = nihil.filter(function (n) {
      return rapikanTeks_(n['ID Form']).toUpperCase() === f.id;
    });
    // Tanda nihil batal sendiri jika ada kiriman untuk tanggal itu.
    dasar.status = kiriman.length ? 'terkirim' : (tandaNihil.length ? 'nihil' : 'belum');
    dasar.lengkap = dasar.status !== 'belum';
    dasar.detail = null;
    dasar.terakhir = barisTerakhir_(kiriman.length ? kiriman : tandaNihil);
    return dasar;
  });
}

/** Suhu lengkap jika semua unit aktif punya Opening, Middle, dan Closing. Cek ulang tidak dihitung. */
function statusSuhu_(dasar, tanggal, zonaSheet) {
  var unit = {};
  var jumlahUnit = 0;
  var sheet = ambilTab_('M_Unit');
  var isiUnit = nilaiTab_(sheet);
  var kol = posisiKolomJudul_(isiUnit[0] || [], { nama: 'Nama Unit', aktif: 'Aktif' }, 'M_Unit');
  if (isiUnit.length >= 2) {
    isiUnit.slice(1).forEach(function (r) {
      var nama = rapikanTeks_(r[kol.nama - 1]).toLowerCase();
      var aktif = r[kol.aktif - 1] === true || String(r[kol.aktif - 1]).toUpperCase() === 'TRUE';
      if (nama && aktif && !unit[nama]) {
        unit[nama] = true;
        jumlahUnit++;
      }
    });
  }
  var baris = bacaBarisTanggal_('Data_Suhu', tanggal, zonaSheet, ['Nama Unit', 'Waktu Cek']);
  var sudah = {};
  var jumlahSudah = 0;
  baris.forEach(function (b) {
    var namaUnit = rapikanTeks_(b['Nama Unit']).toLowerCase();
    var waktu = rapikanTeks_(b['Waktu Cek']).toLowerCase();
    var kunci = namaUnit + '|' + waktu;
    if (unit[namaUnit] && WAKTU_CEK_WAJIB.indexOf(waktu) >= 0 && !sudah[kunci]) {
      sudah[kunci] = true;
      jumlahSudah++;
    }
  });
  var total = jumlahUnit * WAKTU_CEK_WAJIB.length;
  dasar.lengkap = total > 0 && jumlahSudah >= total;
  dasar.status = dasar.lengkap ? 'terkirim' : (jumlahSudah > 0 ? 'sebagian' : 'belum');
  dasar.detail = jumlahSudah > 0 ? jumlahSudah + ' dari ' + total + ' pengecekan' : null;
  dasar.terakhir = barisTerakhir_(baris);
  return dasar;
}

/**
 * Baris sebuah tab Data pada satu tanggal: [{ oleh, waktu, <kolom lain> }].
 * Tab atau kolom yang belum ada dianggap belum berisi data.
 */
function bacaBarisTanggal_(namaTab, tanggal, zonaSheet, kolomLain) {
  var sheet = ss_().getSheetByName(namaTab);
  if (!sheet) return [];
  var isi = nilaiTab_(sheet); // satu panggilan: judul dan isi
  if (isi.length < 2) return [];
  var judul = isi[0].map(function (j) { return String(j).trim(); });
  var iTanggal = judul.indexOf('Tanggal');
  if (iTanggal < 0) return [];
  var iOleh = judul.indexOf('submitted_by');
  var iWaktu = judul.indexOf('timestamp_server');
  var hasil = [];
  isi.slice(1).forEach(function (r) {
    if (teksTanggal_(r[iTanggal], zonaSheet) !== tanggal) return;
    var baris = {
      oleh: iOleh >= 0 ? rapikanTeks_(r[iOleh]) : '',
      waktu: iWaktu >= 0 && r[iWaktu] instanceof Date ? r[iWaktu] : null
    };
    kolomLain.forEach(function (k) {
      var i = judul.indexOf(k);
      baris[k] = i >= 0 ? r[i] : '';
    });
    hasil.push(baris);
  });
  return hasil;
}

function teksTanggal_(nilai, zona) {
  if (nilai instanceof Date) {
    return isNaN(nilai.getTime()) ? '' : Utilities.formatDate(nilai, zona, 'yyyy-MM-dd');
  }
  return String(nilai == null ? '' : nilai).trim().slice(0, 10);
}

/** Siapa dan kapan terakhir mengisi: { oleh, waktu (ISO) } atau null. */
function barisTerakhir_(baris) {
  var terakhir = null;
  baris.forEach(function (b) {
    if (b.waktu && (!terakhir || b.waktu.getTime() > terakhir.waktu.getTime())) terakhir = b;
  });
  return terakhir ? { oleh: terakhir.oleh, waktu: terakhir.waktu.toISOString() } : null;
}

/* =========================================================================
 * Aksi: Pengaturan → Staff dan PIN, Penerima email (khusus Pengelola)
 * ========================================================================= */

function aksiDaftarStaff_() {
  return { staff: ringkasStaff_(bacaStaff_().daftar) };
}

/** Tambah staff baru beserta PIN-nya. */
function aksiTambahStaff_(body) {
  var nama = periksaNama_(body.nama, 'Nama', PANJANG_NAMA_MAKS);
  var role = periksaRole_(body.role);
  var pin = periksaPinBaru_(body.pin);
  return denganKunci_(function () {
    var info = bacaStaff_();
    var ada = cariStaff_(info.daftar, nama);
    if (ada) {
      throw galatPengguna_(ada.aktif
        ? 'Nama ' + ada.nama + ' sudah ada. Pakai nama lain, misalnya dengan inisial.'
        : 'Nama ' + ada.nama + ' sudah ada tetapi nonaktif. Buka ' + ada.nama + ' di daftar untuk mengaktifkannya lagi.');
    }
    tambahBarisStaff_(info, { nama: nama, role: role, pin: buatHashPin_(pin), aktif: true });
    return { staff: ringkasStaff_(bacaStaff_().daftar) };
  });
}

/**
 * Ubah role atau aktif/nonaktif. Akun sendiri tidak bisa diubah di sini, dan
 * Pengelola aktif yang terakhir tidak bisa dinonaktifkan atau dijadikan Staff,
 * supaya selalu ada yang bisa mengelola sistem (Bagian 5.1).
 */
function aksiUbahStaff_(body, pengguna) {
  return denganKunci_(function () {
    var info = bacaStaff_();
    var staff = cariStaff_(info.daftar, body.nama);
    if (!staff) throw galatPengguna_('Staff tidak ditemukan. Muat ulang daftar staff.');
    var ubah = {};
    if (body.role != null && periksaRole_(body.role) !== staff.role) ubah.role = body.role;
    if (typeof body.aktif === 'boolean' && body.aktif !== staff.aktif) ubah.aktif = body.aktif;
    var lepasPengelola = ubah.aktif === false || (ubah.role && !apakahPengelola_(ubah.role));
    if (lepasPengelola && staff.aktif && apakahPengelola_(staff.role)) {
      var adaLain = info.daftar.some(function (s) {
        return s !== staff && s.aktif && s.hash && apakahPengelola_(s.role);
      });
      if (!adaLain) {
        throw galatPengguna_(staff.nama + ' adalah Head Kitchen atau Manager aktif yang terakhir. ' +
          'Tambah atau aktifkan Head Kitchen atau Manager lain dulu, supaya selalu ada yang bisa mengelola sistem.');
      }
    }
    if (samaNama_(staff.nama, pengguna.nama)) {
      throw galatPengguna_('Role dan keadaan akunmu sendiri diubah oleh Head Kitchen atau Manager lain.');
    }
    tulisStaff_(info, staff, ubah);
    return { staff: ringkasStaff_(bacaStaff_().daftar) };
  });
}

/**
 * Hapus staff (Bagian 5.1): hanya staff yang sudah nonaktif. Barisnya tetap
 * ada di M_Staff: kolom Dihapus diisi waktunya, hash PIN dikosongkan, dan
 * permintaan reset PIN miliknya ditutup. Pemilik Sheet bisa memulihkannya
 * dengan mengosongkan kolom Dihapus (staff kembali nonaktif, PIN dibuat ulang).
 */
function aksiHapusStaff_(body, pengguna) {
  return denganKunci_(function () {
    var info = bacaStaff_();
    if (!info.kol.dihapus) {
      throw galatPengguna_('Kolom Dihapus belum ada di tab M_Staff. Jalankan ulang setupSpreadsheet di editor Apps Script.');
    }
    var staff = cariStaff_(info.daftar, body.nama);
    if (!staff) throw galatPengguna_('Staff tidak ditemukan. Muat ulang daftar staff.');
    if (staff.aktif || samaNama_(staff.nama, pengguna.nama)) {
      throw galatPengguna_('Nonaktifkan dulu untuk bisa menghapus.');
    }
    tulisStaff_(info, staff, { dihapus: new Date(), pin: '', reset: '' });
    PropertiesService.getScriptProperties().deleteProperty(kunciGagalPin_(staff.nama));
    return { staff: ringkasStaff_(bacaStaff_().daftar) };
  });
}

/**
 * Buat atau reset PIN. PIN lama langsung tidak berlaku, sesi lama staff itu
 * gugur, kunci karena PIN salah (15 menit atau 24 jam) dibuka beserta hitungannya, dan permintaan reset
 * ditandai selesai.
 */
function aksiAturPin_(body, pengguna) {
  var pin = periksaPinBaru_(body.pin);
  return denganKunci_(function () {
    var info = bacaStaff_();
    var staff = cariStaff_(info.daftar, body.nama);
    if (!staff) throw galatPengguna_('Staff tidak ditemukan. Muat ulang daftar staff.');
    var hash = buatHashPin_(pin);
    tulisStaff_(info, staff, { pin: hash, reset: '' });
    staff.hash = hash;
    PropertiesService.getScriptProperties().deleteProperty(kunciGagalPin_(staff.nama));
    var hasil = { staff: ringkasStaff_(bacaStaff_().daftar) };
    if (samaNama_(staff.nama, pengguna.nama)) {
      // PIN sendiri direset: sesi lama gugur, jadi kirim sesi baru.
      var sesi = buatSesi_(staff);
      hasil.sesiBaru = { token: sesi.token, berlakuSampai: sesi.berlakuSampai };
    }
    return hasil;
  });
}

function bacaDaftarEmail_() {
  var sheet = ambilTab_('M_Outlet');
  var kol = posisiKolom_(sheet, { email: 'Email Penerima Laporan' });
  return String(sheet.getRange(2, kol.email).getValue() || '').split(/[,;\s]+/).filter(function (e) {
    return e;
  });
}

function aksiBacaPenerima_() {
  return { email: bacaDaftarEmail_() };
}

/** Menyimpan seluruh daftar penerima (dipisah koma dalam satu sel M_Outlet). */
function aksiSimpanPenerima_(body) {
  if (!Array.isArray(body.email)) throw galatPengguna_('Daftar email tidak terbaca. Muat ulang layar, lalu coba lagi.');
  var bersih = [];
  var sudah = {};
  body.email.forEach(function (e) {
    var alamat = String(e == null ? '' : e).trim();
    if (!alamat) return;
    if (alamat.length > 254 || !/^[A-Za-z0-9][^\s@,;]*@[^\s@,;]+\.[^\s@,;]+$/.test(alamat)) {
      throw galatPengguna_('Alamat ' + alamat + ' tidak sah. Periksa penulisannya.');
    }
    if (!sudah[alamat.toLowerCase()]) {
      sudah[alamat.toLowerCase()] = true;
      bersih.push(alamat);
    }
  });
  return denganKunci_(function () {
    var sheet = ambilTab_('M_Outlet');
    var kol = posisiKolom_(sheet, { email: 'Email Penerima Laporan' });
    sheet.getRange(2, kol.email).setValue(bersih.join(', '));
    return { email: bersih };
  });
}


/* =========================================================================
 * Tahap 2: tabel data, tanggal isian, dan kolom sistem (dipakai semua form)
 * ========================================================================= */

/** Angka disimpan dengan paling banyak 3 angka di belakang koma. */
function bulat_(x) {
  return Math.round(Number(x) * 1000) / 1000;
}

/** Angka isian: kosong = 0; boleh "2,5" atau "2.5"; tidak boleh minus. */
function angkaIsian_(nilai, label) {
  if (nilai === '' || nilai == null) return 0;
  var n = typeof nilai === 'number' ? nilai : Number(String(nilai).trim().replace(',', '.'));
  if (String(nilai).trim() === '' || !isFinite(n) || n < 0) {
    throw galatPengguna_(label + ' harus angka 0 atau lebih, misalnya 2,5.');
  }
  if (n > 1e9) throw galatPengguna_(label + ' terlalu besar. Periksa angkanya.');
  return bulat_(n);
}

/** Angka untuk teks: 2.5 → "2,5". */
function teksAngka_(n) {
  return String(bulat_(n)).replace('.', ',');
}

/** "2026-10-04" + 1 hari → "2026-10-05" (tanpa zona waktu). */
function geserTanggal_(tanggal, hari) {
  var p = String(tanggal).split('-');
  return new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + hari)).toISOString().slice(0, 10);
}

function tanggalSah_(tanggal) {
  return typeof tanggal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(tanggal) && geserTanggal_(tanggal, 0) === tanggal;
}

/** Hari ini menurut zona waktu sistem (M_Konfigurasi). */
function hariIni_() {
  return Utilities.formatDate(new Date(), zonaWaktu_(), 'yyyy-MM-dd');
}

/**
 * Aturan tanggal isian (spesifikasi sistem Bagian 5.0): Staff hari ini dan
 * kemarin; Pengelola tanggal lain; tanggal masa depan ditolak.
 */
function periksaTanggalIsian_(tanggal, pengguna) {
  if (!tanggalSah_(tanggal)) throw galatPengguna_('Tanggal tidak terbaca. Pilih tanggal lagi.');
  var hari = hariIni_();
  if (tanggal > hari) throw galatPengguna_('Tanggal masa depan tidak bisa diisi.');
  if (!pengguna.pengelola && tanggal < geserTanggal_(hari, -1)) {
    throw galatPengguna_('Staff hanya bisa mengisi untuk hari ini dan kemarin. Minta Pengelola mengisi tanggal ini.');
  }
  periksaBelumDiarsip_(tanggal);
  return tanggal;
}

/** Tanggal untuk sel Sheet (tengah malam menurut zona waktu spreadsheet). */
function tanggalSel_(tanggal) {
  return Utilities.parseDate(tanggal, zonaSheet_(), 'yyyy-MM-dd');
}

function periksaSubmissionId_(sid) {
  if (typeof sid !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(sid)) {
    throw galatPengguna_('Isian tidak punya tanda pengenal. Muat ulang aplikasi, lalu kirim lagi.');
  }
  return sid;
}

/**
 * Membaca satu tab sebagai tabel: { nama, sheet, judul, kol: { judul: indeks },
 * baris: [[...]] }. null jika tab tidak ada.
 */
function bacaTabel_(nama) {
  var sheet = ss_().getSheetByName(nama);
  if (!sheet) return null;
  var semua = nilaiTab_(sheet); // satu panggilan (dulu tiga)
  if (!semua.length) semua = [[]];
  var judul = semua[0].map(function (j) { return String(j).trim(); });
  var kol = {};
  judul.forEach(function (j, i) {
    if (j && !(j in kol)) kol[j] = i;
  });
  return { nama: nama, sheet: sheet, judul: judul, kol: kol, baris: semua.slice(1) };
}

function wajibTabel_(nama) {
  var t = bacaTabel_(nama);
  if (!t) throw galatPengguna_('Tab ' + nama + ' tidak ada. Jalankan ulang setupSpreadsheet di editor Apps Script.');
  return t;
}

function nilai_(tabel, baris, judul) {
  var i = tabel.kol[judul];
  return i === undefined ? '' : baris[i];
}

/** Baris tabel (array) dari objek { judul: nilai }. */
/** Isi untuk kolom yang ditambahkan versi baru: hanya kunci yang kolomnya sudah ada di tab (sebelum setupSpreadsheet dijalankan ulang). */
function kolomAda_(tabel, isi) {
  var hasil = {};
  Object.keys(isi).forEach(function (judul) { if (tabel.kol[judul] !== undefined) hasil[judul] = isi[judul]; });
  return hasil;
}

function susunBaris_(tabel, isi) {
  var baris = [];
  for (var i = 0; i < tabel.judul.length; i++) baris.push('');
  Object.keys(isi).forEach(function (judul) {
    var i = tabel.kol[judul];
    if (i === undefined) {
      throw galatPengguna_('Kolom ' + judul + ' tidak ada di tab ' + tabel.nama +
        '. Jalankan ulang setupSpreadsheet di editor Apps Script.');
    }
    baris[i] = isi[judul];
  });
  return baris;
}

/**
 * Nomor baris pertama untuk menulis n baris baru di tab Data, Stock_Harian,
 * atau Log_Perubahan: tepat di bawah baris terakhir yang kolom A-nya (Tanggal,
 * atau Waktu di log) terisi. Tab baru hanya punya 1.000 baris; jika kurang,
 * baris ditambah di dalam rentang (sebelum baris terakhir), supaya format,
 * aturan warna, dan filter ikut melebar. Baris kosong yang tersisa di tengah
 * hilang saat tab diurutkan.
 */
function barisTulis_(sheet, n) {
  var akhirData = barisKunciTerakhir_(sheet, 1);
  var maks = sheet.getMaxRows();
  if (akhirData + n <= maks) return akhirData + 1;
  sheet.insertRowsAfter(Math.max(1, maks - 1), n + 500);
  return akhirData < maks ? akhirData + 1 : maks;
}

/** Menambah banyak baris sekaligus di bawah. */
function tambahBarisTabel_(tabel, daftarIsi) {
  if (!daftarIsi.length) return;
  var nilai = daftarIsi.map(function (isi) { return susunBaris_(tabel, isi); });
  tabel.sheet.getRange(barisTulis_(tabel.sheet, nilai.length), 1, nilai.length, tabel.judul.length).setValues(nilai);
}

/** Tanggal terbaru di atas, lalu kolom berikutnya (spesifikasi sistem Bagian 8.4). */
function urutkanTabel_(tabel, urutan) {
  // Di Supabase, Range.sort atas seluruh isi tab mencatat aturan urutan dan diterapkan setiap tab dimuat
  // (supabase/src/sheet.js), jadi tidak ada baris yang ditulis ulang.
  var sheet = tabel.sheet;
  var n = sheet.getLastRow() - 1;
  if (n < 2) return;
  var spek = urutan.filter(function (u) { return tabel.kol[u[0]] !== undefined; }).map(function (u) {
    return { column: tabel.kol[u[0]] + 1, ascending: u[1] };
  });
  sheet.getRange(2, 1, n, sheet.getLastColumn()).sort(spek);
}

/** Kiriman yang sama (submission_id) tidak ditulis dua kali. */
function adaSubmission_(tabel, sid) {
  var i = tabel.kol.submission_id;
  if (i === undefined) return false;
  return tabel.baris.some(function (b) { return String(b[i]) === sid; });
}

/** Kolom sistem Bagian 5.0 untuk satu baris baru. */
function isiSistem_(konteks) {
  return {
    submission_id: konteks.sid,
    row_id: Utilities.getUuid(),
    outlet: konteks.outlet,
    timestamp_server: konteks.kini,
    timestamp_device: konteks.waktuPerangkat,
    submitted_by: konteks.pengguna.nama,
    status: 'Terkirim'
  };
}

function konteksKiriman_(body, pengguna) {
  var perangkat = new Date(String(body.waktuPerangkat || ''));
  return {
    sid: periksaSubmissionId_(body.submissionId),
    outlet: namaOutlet_(),
    kini: new Date(),
    waktuPerangkat: isNaN(perangkat.getTime()) ? '' : perangkat,
    pengguna: pengguna
  };
}

function gabung_(a, b) {
  var hasil = {};
  [a, b].forEach(function (o) {
    Object.keys(o).forEach(function (k) { hasil[k] = o[k]; });
  });
  return hasil;
}

/* ---------- Master item dan kategori ---------- */

function benar_(v) {
  return v === true || String(v).toUpperCase() === 'TRUE';
}

function angkaAtauNull_(v) {
  if (v === '' || v == null) return null;
  var n = Number(v);
  return isFinite(n) ? n : null;
}

/** M_Item: { namaKecil: { nama, kategori, satuan, satuanBesar, isiSatuanBesar, harga, stokMin, stokMaks, aktif, masaSimpan } }. */
function bacaItem_() {
  var t = wajibTabel_('M_Item');
  var peta = {};
  t.baris.forEach(function (b) {
    var nama = rapikanTeks_(nilai_(t, b, 'Nama Item'));
    if (!nama || peta[nama.toLowerCase()]) return;
    var isi = angkaAtauNull_(nilai_(t, b, 'Isi per Satuan Besar'));
    var besar = rapikanTeks_(nilai_(t, b, 'Satuan Besar'));
    peta[nama.toLowerCase()] = {
      nama: nama,
      kategori: rapikanTeks_(nilai_(t, b, 'Kategori')),
      satuan: rapikanTeks_(nilai_(t, b, 'Satuan')),
      satuanBesar: besar && isi > 0 ? besar : '',
      isiSatuanBesar: besar && isi > 0 ? isi : null,
      harga: angkaAtauNull_(nilai_(t, b, 'Harga Satuan (Rp)')),
      stokMin: angkaAtauNull_(nilai_(t, b, 'Stok Minimum')),
      stokMaks: angkaAtauNull_(nilai_(t, b, 'Stok Maksimum')),
      aktif: benar_(nilai_(t, b, 'Aktif')),
      // Masa simpan barang masuk (Code.gs v0.25); null = tanpa masa simpan.
      masaSimpan: masaSimpanSel_(nilai_(t, b, 'Masa Simpan (hari)'))
    };
  });
  return peta;
}

/** Masa simpan dari sel (resep atau item): bilangan hari 0 atau lebih, selain itu null. */
function masaSimpanSel_(nilai) {
  var n = angkaAtauNull_(nilai);
  return n == null || n < 0 ? null : Math.round(n);
}

/** Isian masa simpan dari Pengaturan: '' → null; selain itu bilangan bulat 0–MASA_SIMPAN_MAKS. */
function masaSimpanIsian_(nilai) {
  var masa = String(nilai == null ? '' : nilai).trim();
  if (masa === '') return null;
  if (!/^\d+$/.test(masa) || Number(masa) > MASA_SIMPAN_MAKS) {
    throw galatPengguna_('Masa simpan diisi angka hari bulat, 0 sampai ' + MASA_SIMPAN_MAKS + ', atau dikosongkan.');
  }
  return Number(masa);
}

/**
 * Masa simpan barang masuk bisa dicatat (Code.gs v0.25): kolom Masa Simpan
 * (hari) di M_Item dan Baik Sampai di Data_Stock sudah dibuat setupSpreadsheet.
 */
function masaSimpanItemSiap_() {
  var i = bacaTabel_('M_Item');
  var s = bacaTabel_('Data_Stock');
  return !!i && !!s && i.kol['Masa Simpan (hari)'] !== undefined && s.kol['Baik Sampai'] !== undefined;
}

/** Hitung sisa (Code.gs v0.28): sisa yang diketik disimpan di Data_Stock kolom Sisa Dihitung (setupSpreadsheet). */
function sisaStockSiap_() {
  var s = bacaTabel_('Data_Stock');
  return !!s && s.kol['Sisa Dihitung'] !== undefined;
}

/** Kategori aktif, urut menurut Urutan lalu nama. */
function bacaKategori_() {
  var t = wajibTabel_('M_Kategori');
  var daftar = [];
  var sudah = {};
  t.baris.forEach(function (b) {
    var nama = rapikanTeks_(nilai_(t, b, 'Nama Kategori'));
    if (!nama || sudah[nama.toLowerCase()] || !benar_(nilai_(t, b, 'Aktif'))) return;
    sudah[nama.toLowerCase()] = true;
    daftar.push({ nama: nama, urutan: angkaAtauNull_(nilai_(t, b, 'Urutan')) });
  });
  return daftar.sort(function (a, b) {
    var ua = a.urutan == null ? 1e9 : a.urutan;
    var ub = b.urutan == null ? 1e9 : b.urutan;
    return ua - ub || a.nama.localeCompare(b.nama, 'id');
  });
}

/* =========================================================================
 * Riwayat harga item (11 Oktober 2026; spesifikasi sistem Bagian 5.1 dan 8.5)
 * ========================================================================= */

var TAB_HARGA = 'M_HargaItem';
var RIWAYAT_HARGA_TAMPIL = 10;
var OLEH_HARGA_AWAL = 'Harga awal';

/** Riwayat harga yang sudah dibaca dalam permintaan ini (dibuang resetMemoForm_ dan setelah harga ditulis). */
var MEMO_HARGA_ = null;

/**
 * M_HargaItem: { ada (tab ada), item: { namaKecil: [{ mulai ('' = sejak awal, atau
 * 'yyyy-mm-dd'), harga, oleh, pada (Date atau null), nomor }] } }, tiap item urut
 * Berlaku Mulai (kosong lebih dulu). Baris tanpa nama atau tanpa harga angka
 * dilewati. Dua baris item yang sama dengan Berlaku Mulai yang sama (diisi tangan):
 * yang lebih atas di Sheet dipakai, sama dengan rumus tab Dashboard.
 */
function bacaRiwayatHarga_() {
  if (MEMO_HARGA_) return MEMO_HARGA_;
  var t = bacaTabel_(TAB_HARGA);
  var hasil = { ada: !!t, item: {} };
  if (t) {
    var zona = zonaSheet_();
    t.baris.forEach(function (b, i) {
      var nama = rapikanTeks_(nilai_(t, b, 'Nama Item'));
      var harga = angkaAtauNull_(nilai_(t, b, 'Harga Satuan (Rp)'));
      if (!nama || harga == null) return;
      var mentah = nilai_(t, b, 'Berlaku Mulai');
      var mulai = mentah === '' || mentah == null ? '' : teksTanggal_(mentah, zona);
      if (mulai && !tanggalSah_(mulai)) return; // tanggal tidak terbaca
      var pada = nilai_(t, b, 'Dicatat Pada');
      var daftar = hasil.item[nama.toLowerCase()] = hasil.item[nama.toLowerCase()] || [];
      if (daftar.some(function (x) { return x.mulai === mulai; })) return;
      daftar.push({ mulai: mulai, harga: harga, oleh: rapikanTeks_(nilai_(t, b, 'Dicatat Oleh')),
        pada: pada instanceof Date ? pada : null, nomor: i + 2 });
    });
    Object.keys(hasil.item).forEach(function (k) {
      hasil.item[k].sort(function (a, b) { return a.mulai < b.mulai ? -1 : a.mulai > b.mulai ? 1 : 0; });
    });
  }
  return MEMO_HARGA_ = hasil;
}

/**
 * Harga satu item yang berlaku pada tanggal itu: baris dengan Berlaku Mulai
 * terbesar yang tidak melewati tanggal (kosong = sejak awal); null jika belum
 * ada. Item yang sama sekali belum punya riwayat (tab M_HargaItem belum dibuat,
 * atau item diisi tangan di Sheet) memakai Harga Satuan di M_Item untuk semua
 * tanggal. m: baris bacaItem_().
 */
function hargaPada_(m, tanggal) {
  var daftar = bacaRiwayatHarga_().item[m.nama.toLowerCase()];
  if (!daftar || !daftar.length) return m.hargaMItem !== undefined ? m.hargaMItem : m.harga;
  var h = null;
  daftar.forEach(function (x) { if (x.mulai <= tanggal) h = x.harga; });
  return h;
}

/** Baris riwayat yang berlaku pada tanggal itu (untuk "sejak"), atau null. */
function barisHargaPada_(nama, tanggal) {
  var daftar = bacaRiwayatHarga_().item[nama.toLowerCase()] || [];
  var x = null;
  daftar.forEach(function (d) { if (d.mulai <= tanggal) x = d; });
  return x;
}

/**
 * Salinan master item dengan harga yang berlaku pada tanggal itu (Bagian 5.1).
 * Harga Satuan M_Item tetap ada di hargaMItem. master opsional (bacaItem_()).
 */
function itemPadaTanggal_(tanggal, master) {
  master = master || bacaItem_();
  var hasil = {};
  Object.keys(master).forEach(function (k) {
    var m = gabung_(master[k], {});
    if (m.hargaMItem === undefined) m.hargaMItem = m.harga;
    m.harga = hargaPada_(m, tanggal);
    hasil[k] = m;
  });
  return hasil;
}

/**
 * Selisih karena perubahan harga (Bagian 8.5) untuk perubahan yang berlaku
 * mulai tanggal dari sampai sampai: tiap kali harga berlaku berganti dari h0 ke
 * h1 pada tanggal D, selisih = Stock Akhir pada D−1 × (h1 − h0). Perubahan dari
 * belum punya harga ke harga pertama tidak dihitung; harga baru yang sama dengan
 * harga lama bukan perubahan. Jawaban: { dari, sampai, total, item: [{ nama,
 * kategori, satuan, selisih, perubahan: [{ tanggal, dari, ke, stock, selisih }] }] }
 * (item urut nilai selisih terbesar, perubahan urut tanggal).
 */
function selisihHarga_(master, rekap, dari, sampai) {
  var riwayat = bacaRiwayatHarga_();
  var item = [];
  var total = 0;
  Object.keys(riwayat.item).forEach(function (k) {
    var m = master[k];
    if (!m) return;
    var daftar = riwayat.item[k];
    var perubahan = [];
    var jumlah = 0;
    for (var i = 1; i < daftar.length; i++) {
      var d = daftar[i];
      var h0 = daftar[i - 1].harga;
      if (!d.mulai || d.mulai < dari || d.mulai > sampai || d.harga === h0) continue;
      var stock = posisiStock_(rekap.item[k], geserTanggal_(d.mulai, -1)).akhir;
      var nilai = stock * (d.harga - h0);
      jumlah += nilai;
      perubahan.push({ tanggal: d.mulai, dari: h0, ke: d.harga, stock: stock, selisih: Math.round(nilai) });
    }
    if (!perubahan.length) return;
    total += jumlah;
    item.push({ nama: m.nama, kategori: m.kategori, satuan: m.satuan, selisih: Math.round(jumlah), perubahan: perubahan });
  });
  item.sort(function (a, b) { return Math.abs(b.selisih) - Math.abs(a.selisih) || a.nama.localeCompare(b.nama, 'id'); });
  return { dari: dari, sampai: sampai, total: Math.round(total), item: item };
}

/**
 * Riwayat harga satu item untuk Pengaturan → Item: harga sekarang, sejak
 * kapan ('' = sejak awal; null = belum punya riwayat), dan 10 perubahan
 * terakhir (terbaru dulu) dengan beda terhadap harga sebelumnya.
 */
function infoHargaItem_(m, hari) {
  var daftar = bacaRiwayatHarga_().item[m.nama.toLowerCase()] || [];
  var kini = barisHargaPada_(m.nama, hari);
  var riwayat = daftar.map(function (x, i) {
    return {
      berlakuMulai: x.mulai,
      harga: x.harga,
      beda: i ? Math.round((x.harga - daftar[i - 1].harga) * 100) / 100 : null,
      oleh: x.oleh,
      waktu: x.pada ? x.pada.toISOString() : null
    };
  }).reverse().slice(0, RIWAYAT_HARGA_TAMPIL);
  return {
    harga: daftar.length ? (kini ? kini.harga : null) : m.harga,
    hargaSejak: daftar.length ? (kini ? kini.mulai : null) : null,
    riwayatHarga: riwayat,
    jumlahRiwayatHarga: daftar.length
  };
}

/** Menyamakan Harga Satuan di M_Item dengan harga yang berlaku hari ini. Dipanggil di dalam kunci, setelah M_HargaItem ditulis. */
function samakanHargaMItem_(nama) {
  MEMO_HARGA_ = null;
  var t = wajibTabel_('M_Item');
  var nomor = barisMaster_(t, 'Nama Item', nama);
  if (!nomor) return;
  var m = bacaItem_()[nama.toLowerCase()];
  var kini = hargaPada_(m, hariIni_());
  if (kini !== m.harga) tulisBarisMaster_(t, nomor, { 'Harga Satuan (Rp)': kini == null ? '' : kini });
}

/** Satu baris baru M_HargaItem (di dalam kunci). mulai: '' (sejak awal) atau 'yyyy-mm-dd'. */
function tambahBarisHarga_(nama, mulai, harga, oleh, kini) {
  tambahBarisMaster_(TAB_HARGA, {
    'Nama Item': nama,
    'Berlaku Mulai': mulai ? tanggalSel_(mulai) : '',
    'Harga Satuan (Rp)': harga,
    'Dicatat Oleh': oleh,
    'Dicatat Pada': kini
  });
  MEMO_HARGA_ = null;
}

/**
 * Ganti harga (Bagian 5.1), khusus Pengelola. body: { nama, harga,
 * berlakuMulai: 'yyyy-mm-dd' (hari ini atau tanggal yang sudah lewat) }.
 * Menambah baris M_HargaItem; tanggal yang sudah punya baris untuk item itu
 * menggantikan harganya dan tercatat di Log_Perubahan. Item yang belum punya
 * riwayat tetapi sudah punya Harga Satuan di M_Item (diisi tangan) mendapat
 * baris harga awal dulu, supaya harga lamanya tetap berlaku sebelum tanggal ini.
 * Lalu Harga Satuan M_Item disamakan dengan harga hari ini. Data yang sudah
 * tersimpan (estimasi waste, nilai selisih) tidak dihitung ulang.
 * Jawaban: daftarItem ditambah hargaDisimpan: { nama, harga, berlakuMulai, mengganti }.
 */
function aksiGantiHarga_(body, pengguna) {
  var harga = angkaOpsional_(body.harga, 'Harga baru', 2);
  if (harga == null) throw galatPengguna_('Isi harga baru.');
  var mulai = String(body.berlakuMulai || '');
  if (!tanggalSah_(mulai)) throw galatPengguna_('Tanggal berlaku mulai tidak terbaca. Pilih tanggal lagi.');
  if (mulai > hariIni_()) throw galatPengguna_('Harga tidak bisa berlaku mulai tanggal yang belum tiba. Pilih hari ini atau tanggal yang sudah lewat.');

  return denganKunci_(function () {
    var m = bacaItem_()[rapikanTeks_(body.nama).toLowerCase()];
    if (!m) throw galatPengguna_('Item ' + rapikanTeks_(body.nama) + ' tidak ditemukan. Kembali ke daftar item.');
    var t = bacaTabel_(TAB_HARGA);
    if (!t) throw galatPengguna_('Tab ' + TAB_HARGA + ' belum ada. Minta pemilik Sheet menjalankan ulang setupSpreadsheet.');
    MEMO_HARGA_ = null;
    var kini = new Date();
    var daftar = bacaRiwayatHarga_().item[m.nama.toLowerCase()] || [];
    if (!daftar.length && m.harga != null) {
      tambahBarisHarga_(m.nama, '', m.harga, OLEH_HARGA_AWAL, kini);
      daftar = bacaRiwayatHarga_().item[m.nama.toLowerCase()] || [];
    }
    var sama = null;
    daftar.forEach(function (x) { if (x.mulai === mulai) sama = x; });
    if (sama) {
      if (sama.harga === harga) {
        throw galatPengguna_('Harga ' + m.nama + ' yang berlaku mulai ' + tanggalPendekId_(mulai) + ' sudah ' + rupiahId_(harga) + '.');
      }
      t = wajibTabel_(TAB_HARGA);
      tulisBarisMaster_(t, sama.nomor, { 'Harga Satuan (Rp)': harga, 'Dicatat Oleh': pengguna.nama, 'Dicatat Pada': kini });
      catatLog_(TAB_HARGA, m.nama + ' · ' + mulai, pengguna, kini, [['Harga Satuan (Rp)', String(sama.harga), String(harga)]]
        .concat(sama.oleh !== pengguna.nama ? [['Dicatat Oleh', sama.oleh, pengguna.nama]] : []));
      MEMO_HARGA_ = null;
    } else {
      tambahBarisHarga_(m.nama, mulai, harga, pengguna.nama, kini);
    }
    samakanHargaMItem_(m.nama);
    var data = dataItem_();
    data.hargaDisimpan = { nama: m.nama, harga: harga, berlakuMulai: mulai, mengganti: !!sama };
    return data;
  });
}

/** Mengganti Nama Item di semua baris M_HargaItem item itu (di dalam kunci). */
function gantiNamaRiwayatHarga_(namaLama, namaBaru) {
  var t = wajibTabel_(TAB_HARGA);
  var c = t.kol['Nama Item'];
  t.baris.forEach(function (b, i) {
    if (rapikanTeks_(b[c]).toLowerCase() === namaLama.toLowerCase()) t.sheet.getRange(i + 2, c + 1).setValue(namaBaru);
  });
  MEMO_HARGA_ = null;
}

/** "7 Okt" dari "2026-10-07". */
function tanggalPendekId_(tanggal) {
  var p = String(tanggal).split('-');
  return Number(p[2]) + ' ' + BULAN_ID[Number(p[1]) - 1].slice(0, 3);
}

/**
 * setupSpreadsheet: tiap item yang sudah punya Harga Satuan di M_Item tetapi
 * belum punya baris di M_HargaItem mendapat satu baris dengan Berlaku Mulai
 * kosong (berlaku sejak awal). Aman dijalankan ulang.
 */
function isiHargaAwal_(ss, catatan) {
  var tItem = ss.getSheetByName('M_Item');
  var tHarga = ss.getSheetByName(TAB_HARGA);
  if (!tItem || !tHarga || tItem.getLastRow() < 2) return;
  var kItem = posisiKolom_(tItem, { nama: 'Nama Item', harga: 'Harga Satuan (Rp)' });
  var kHarga = posisiKolom_(tHarga, { nama: 'Nama Item', mulai: 'Berlaku Mulai', harga: 'Harga Satuan (Rp)',
    oleh: 'Dicatat Oleh', pada: 'Dicatat Pada' });
  var ada = {};
  if (tHarga.getLastRow() >= 2) {
    tHarga.getRange(2, kHarga.nama, tHarga.getLastRow() - 1, 1).getValues().forEach(function (r) {
      var n = rapikanTeks_(r[0]).toLowerCase();
      if (n) ada[n] = true;
    });
  }
  var lebar = tHarga.getLastColumn();
  var kini = new Date();
  var baru = [];
  tItem.getRange(2, 1, tItem.getLastRow() - 1, tItem.getLastColumn()).getValues().forEach(function (r) {
    var nama = rapikanTeks_(r[kItem.nama - 1]);
    var harga = angkaAtauNull_(r[kItem.harga - 1]);
    if (!nama || harga == null || ada[nama.toLowerCase()]) return;
    ada[nama.toLowerCase()] = true;
    var baris = [];
    for (var i = 0; i < lebar; i++) baris.push('');
    baris[kHarga.nama - 1] = nama;
    baris[kHarga.harga - 1] = harga;
    baris[kHarga.oleh - 1] = OLEH_HARGA_AWAL;
    baris[kHarga.pada - 1] = kini;
    baru.push(baris);
  });
  if (!baru.length) return;
  tHarga.getRange(barisBaruMaster_(tHarga, kHarga.nama, baru.length), 1, baru.length, lebar).setValues(baru);
  catatan.push(TAB_HARGA + ': harga awal ' + baru.length + ' item ditambahkan (berlaku sejak awal)');
}

/* =========================================================================
 * Tahap 2: rekap stock (spesifikasi sistem Bagian 5.5)
 * ========================================================================= */

/** Kolom angka rekap Stock_Harian, dalam urutan rumus Stock Akhir. */
var KOLOM_REKAP = {
  awal: 'Stock Awal',
  masuk: 'Stock Masuk',
  hasilPrep: 'Hasil Prep',
  keluar: 'Stock Keluar',
  dipakaiPrep: 'Dipakai Prep',
  waste: 'Waste',
  penyesuaian: 'Penyesuaian',
  akhir: 'Stock Akhir'
};

/**
 * Sumber gerakan stock. Setiap gerakan dicatat sekali di form asalnya:
 * Stock (Tahap 2), Waste (Tahap 5), Prep List dan bahannya (Tahap 6, Hasil
 * kosong untuk prep tanpa resep), penyesuaian (Tahap 2).
 */
var SUMBER_STOCK = [
  { tab: 'Data_Stock', item: 'Nama Item', isi: { masuk: 'Stock Masuk', keluar: 'Stock Keluar' } },
  { tab: 'Data_Prep', item: 'Item / Menu Prep', isi: { hasilPrep: 'Hasil' } },
  { tab: 'Data_PrepBahan', item: 'Item Bahan', isi: { dipakaiPrep: 'Qty Terpakai' } },
  { tab: 'Data_Waste', item: 'Item / Produk', isi: { waste: 'Qty' } },
  { tab: 'Data_Penyesuaian', item: 'Nama Item', isi: { penyesuaian: 'Selisih' } }
];

function gerakanKosong_() {
  return { masuk: 0, hasilPrep: 0, keluar: 0, dipakaiPrep: 0, waste: 0, penyesuaian: 0 };
}

function hitungAkhir_(awal, g) {
  return bulat_(awal + g.masuk + g.hasilPrep - g.keluar - g.dipakaiPrep - g.waste + g.penyesuaian);
}

/** Rekap per item dari Stock_Harian: { tabel, item: { namaKecil: [{ nomor, tanggal, nama, kategori, satuan, awal, ..., akhir }] } }. */
function bacaRekap_() {
  var t = wajibTabel_('Stock_Harian');
  var zona = zonaSheet_();
  var item = {};
  t.baris.forEach(function (b, i) {
    var nama = rapikanTeks_(nilai_(t, b, 'Nama Item')).toLowerCase();
    var tanggal = teksTanggal_(nilai_(t, b, 'Tanggal'), zona);
    if (!nama || !tanggal) return;
    var r = {
      nomor: i + 2,
      tanggal: tanggal,
      nama: rapikanTeks_(nilai_(t, b, 'Nama Item')),
      kategori: rapikanTeks_(nilai_(t, b, 'Kategori')),
      satuan: rapikanTeks_(nilai_(t, b, 'Satuan'))
    };
    Object.keys(KOLOM_REKAP).forEach(function (k) {
      r[k] = Number(nilai_(t, b, KOLOM_REKAP[k])) || 0;
    });
    (item[nama] = item[nama] || []).push(r);
  });
  return { tabel: t, item: item };
}

/**
 * Stock satu item pada satu tanggal: rekap tanggal itu jika ada; jika tidak,
 * Stock Awal = Stock Akhir pada rekap terakhir sebelumnya (item baru: nol).
 */
function posisiStock_(rekapItem, tanggal) {
  var sebelum = null;
  var pada = null;
  (rekapItem || []).forEach(function (r) {
    if (r.tanggal === tanggal) pada = r;
    else if (r.tanggal < tanggal && (!sebelum || r.tanggal > sebelum.tanggal)) sebelum = r;
  });
  if (pada) {
    var hasil = {};
    Object.keys(KOLOM_REKAP).forEach(function (k) { hasil[k] = pada[k]; });
    return hasil;
  }
  var awal = sebelum ? sebelum.akhir : 0;
  return gabung_(gerakanKosong_(), { awal: awal, akhir: awal });
}

/** Gerakan per item per tanggal dari semua sumber, hanya untuk item yang diminta. */
function bacaGerakan_(itemKecil) {
  var zona = zonaSheet_();
  var hasil = {};
  SUMBER_STOCK.forEach(function (s) {
    var t = bacaTabel_(s.tab);
    if (!t || t.kol[s.item] === undefined || t.kol.Tanggal === undefined) return;
    t.baris.forEach(function (b) {
      var nama = rapikanTeks_(nilai_(t, b, s.item)).toLowerCase();
      if (!itemKecil[nama]) return;
      var tanggal = teksTanggal_(nilai_(t, b, 'Tanggal'), zona);
      if (!tanggal) return;
      var perItem = hasil[nama] = hasil[nama] || {};
      var g = perItem[tanggal] = perItem[tanggal] || gerakanKosong_();
      Object.keys(s.isi).forEach(function (k) {
        g[k] = bulat_(g[k] + (Number(nilai_(t, b, s.isi[k])) || 0));
      });
    });
  });
  return hasil;
}

/**
 * Hitung ulang rekap Stock_Harian. permintaan: [{ item, dari: 'yyyy-mm-dd' }].
 * Untuk tiap item: mulai dari tanggal "dari" sampai rekap terakhirnya, semua
 * sumber gerakan dibaca lagi dan rekapnya ditulis ulang sebagai angka. Hanya
 * baris item itu yang disentuh: rekap yang ada diperbarui di tempat, yang baru
 * ditambahkan, dan yang tidak punya gerakan lagi dihapus. Stock Awal tanggal
 * pertama = Stock Akhir rekap terakhir sebelum "dari".
 * Dipakai oleh kiriman Stock, penyesuaian, dan nanti oleh koreksi (Tahap 3),
 * Waste (Tahap 5), Prep (Tahap 6), dan stock opname (Tahap 8).
 * Harus dipanggil di dalam denganKunci_.
 */
function hitungUlangStock_(permintaan) {
  var minta = {};
  permintaan.forEach(function (p) {
    var k = rapikanTeks_(p.item).toLowerCase();
    if (!k || !tanggalSah_(p.dari)) return;
    if (!minta[k] || p.dari < minta[k].dari) minta[k] = { item: rapikanTeks_(p.item), dari: p.dari };
  });
  if (!Object.keys(minta).length) return;

  var gerakan = bacaGerakan_(minta);
  var rekap = bacaRekap_();
  var t = rekap.tabel;
  var master = bacaItem_();
  var outlet = namaOutlet_();
  var kini = new Date();
  var ubah = [];
  var tambah = [];
  var hapus = [];

  Object.keys(minta).forEach(function (k) {
    var dari = minta[k].dari;
    var m = master[k] || { nama: minta[k].item, kategori: '', satuan: '' };
    var lama = {};
    var awal = 0;
    var terakhirSebelum = '';
    (rekap.item[k] || []).forEach(function (r) {
      if (r.tanggal >= dari) {
        if (lama[r.tanggal]) hapus.push(r.nomor); // rekap ganda: buang
        else lama[r.tanggal] = r.nomor;
      } else if (r.tanggal > terakhirSebelum) {
        terakhirSebelum = r.tanggal;
        awal = r.akhir;
      }
    });
    var perTanggal = gerakan[k] || {};
    Object.keys(perTanggal).filter(function (tg) { return tg >= dari; }).sort().forEach(function (tg) {
      var g = perTanggal[tg];
      var akhir = hitungAkhir_(awal, g);
      var isi = {
        'Tanggal': tanggalSel_(tg),
        'Kategori': m.kategori,
        'Nama Item': m.nama,
        'Satuan': m.satuan,
        outlet: outlet,
        timestamp_server: kini
      };
      isi[KOLOM_REKAP.awal] = bulat_(awal);
      Object.keys(g).forEach(function (kk) { isi[KOLOM_REKAP[kk]] = g[kk]; });
      isi[KOLOM_REKAP.akhir] = akhir;
      var baris = susunBaris_(t, isi);
      if (lama[tg]) {
        ubah.push({ nomor: lama[tg], baris: baris });
        delete lama[tg];
      } else {
        tambah.push(baris);
      }
      awal = akhir;
    });
    Object.keys(lama).forEach(function (tg) { hapus.push(lama[tg]); });
  });

  var lebar = t.judul.length;
  ubah.forEach(function (u) {
    t.sheet.getRange(u.nomor, 1, 1, lebar).setValues([u.baris]);
  });
  hapus.sort(function (a, b) { return b - a; }).forEach(function (n) {
    t.sheet.deleteRow(n);
  });
  if (tambah.length) {
    t.sheet.getRange(barisTulis_(t.sheet, tambah.length), 1, tambah.length, lebar).setValues(tambah);
  }
  urutkanTabel_(t, [['Tanggal', false], ['Kategori', true], ['Nama Item', true]]);
}

/* =========================================================================
 * Tahap 2: aksi form Stock Inventory Harian
 * ========================================================================= */

var URUTAN_DATA = [['Tanggal', false], ['Kategori', true], ['Nama Item', true], ['timestamp_server', true]];

/**
 * Data layar isi stock dalam satu jawaban: kategori, item aktif beserta
 * stock pada tanggal itu (Awal, yang sudah tercatat, Akhir), jumlah kiriman,
 * dan tanda nihil.
 */
function dataFormStock_(tanggal) {
  var zona = zonaSheet_();
  var master = bacaItem_();
  var kategori = bacaKategori_();
  var namaKategori = {};
  kategori.forEach(function (k) { namaKategori[k.nama.toLowerCase()] = k.nama; });
  var rekap = bacaRekap_();
  var dipakai = {};
  var item = [];
  Object.keys(master).forEach(function (k) {
    var m = master[k];
    var kat = namaKategori[m.kategori.toLowerCase()];
    if (!m.aktif || !kat) return;
    dipakai[kat] = true;
    item.push(gabung_({
      nama: m.nama,
      kategori: kat,
      satuan: m.satuan,
      satuanBesar: m.satuanBesar,
      isiSatuanBesar: m.isiSatuanBesar,
      stokMin: m.stokMin,
      masaSimpan: m.masaSimpan
    }, posisiStock_(rekap.item[k], tanggal)));
  });
  item.sort(function (a, b) { return a.nama.localeCompare(b.nama, 'id'); });

  var kiriman = bacaBarisTanggal_('Data_Stock', tanggal, zona, ['submission_id']);
  var sid = {};
  kiriman.forEach(function (b) { sid[b.submission_id] = true; });
  var nihil = bacaBarisTanggal_('Data_Nihil', tanggal, zona, ['ID Form']).filter(function (n) {
    return rapikanTeks_(n['ID Form']).toUpperCase() === 'STOCK';
  });
  // Pemasok dan harga beli (Code.gs v0.23): hanya setelah setupSpreadsheet membuat tab dan kolomnya.
  var siap = pembelianSiap_();
  return {
    tanggal: tanggal,
    kategori: kategori.filter(function (k) { return dipakai[k.nama]; }).map(function (k) { return k.nama; }),
    item: item,
    kiriman: { jumlah: Object.keys(sid).length, terakhir: barisTerakhir_(kiriman) },
    nihil: kiriman.length ? null : barisTerakhir_(nihil),
    pembelianSiap: siap,
    pemasok: siap ? bacaPemasok_().filter(function (p) { return p.aktif; }).map(function (p) { return p.nama; }) : [],
    // Baik sampai barang masuk (Code.gs v0.25): hanya setelah setupSpreadsheet membuat kolomnya.
    masaSimpanSiap: masaSimpanItemSiap_(),
    // Hitung sisa (Code.gs v0.28): hanya setelah setupSpreadsheet membuat kolom Sisa Dihitung.
    sisaSiap: sisaStockSiap_(),
    // Pesanan ke pemasok yang belum datang (Code.gs v0.29): hanya setelah setupSpreadsheet membuat Data_Pesanan.
    pesananSiap: pesananSiap_(),
    pesanan: pesananForm_(tanggal)
  };
}

function aksiFormStock_(body) {
  if (!tanggalSah_(body.tanggal)) throw galatPengguna_('Tanggal tidak terbaca. Pilih tanggal lagi.');
  return dataFormStock_(body.tanggal);
}

/**
 * Kiriman form Stock: satu baris Data_Stock per item yang diisi. Tiap
 * kiriman menambah, tidak menimpa. submission_id yang sudah pernah masuk
 * tidak ditulis lagi (jawabannya sudahTerkirim: true, supaya antrean di HP
 * yang mengirim ulang menganggapnya selesai).
 *
 * Hitung sisa (Code.gs v0.28, spesifikasi sistem Bagian 5.5): baris boleh
 * membawa `sisa` (jumlah yang ada sekarang) menggantikan `keluar`. Stock
 * Keluar = stock tercatat pada tanggal itu saat kiriman diterima + masuk -
 * sisa, jadi kiriman lain yang masuk sebelumnya ikut dihitung dan Stock Akhir
 * saat itu sama dengan sisa; sisanya disimpan di Sisa Dihitung. Sisa yang sama
 * dengan stock tetap dicatat (keluar 0, tanda sudah dihitung). Sisa yang lebih
 * banyak dari stock tercatat + masuk tidak menolak kiriman (kiriman dari
 * antrean tidak boleh macet dan barang masuknya hilang): keluarnya tidak
 * dicatat dan itemnya dikembalikan di `sisaLebih`. Meluruskan stock tetap
 * lewat penyesuaian Pengelola.
 *
 * Pesanan ke pemasok (Code.gs v0.29): baris boleh membawa `pesanan` (id, dari
 * "Isi dari pesanan"). Barang masuk menyelesaikan pesanan menunggunya
 * (`pesananDatang`); Tambah masuk dari pesanan yang sudah dicatat datang tidak
 * dicatat lagi (`pesananSudahDatang`). Kiriman tidak pernah ditolak karena
 * pesanannya (barisPesananTertaut_).
 */
function aksiKirimStock_(body, pengguna) {
  var tanggal = periksaTanggalIsian_(body.tanggal, pengguna);
  var konteks = konteksKiriman_(body, pengguna);
  var masukan = Array.isArray(body.baris) ? body.baris : [];
  if (masukan.length > 500) throw galatPengguna_('Isian terlalu banyak untuk satu kiriman.');

  return denganKunci_(function () {
    var tabel = wajibTabel_('Data_Stock');
    if (adaSubmission_(tabel, konteks.sid)) {
      return { sudahTerkirim: true, jumlah: 0, form: dataFormStock_(tanggal) };
    }
    var master = bacaItem_();
    // Pemasok dan harga beli (tidak wajib): pemasok satu untuk seluruh kiriman, harga beli per item yang masuk.
    var adaHarga = masukan.some(function (b) { return b && b.hargaBeli !== '' && b.hargaBeli != null; });
    var pemasok = rapikanTeks_(body.pemasok);
    if ((pemasok || adaHarga) && !pembelianSiap_()) {
      throw galatPengguna_('Pemasok dan harga beli belum bisa dicatat. Minta pemilik Sheet menjalankan ulang setupSpreadsheet.');
    }
    var adaBaik = masukan.some(function (b) { return b && b.baikSampai !== '' && b.baikSampai != null; });
    var baikSiap = masaSimpanItemSiap_();
    if (adaBaik && !baikSiap) {
      throw galatPengguna_('Baik sampai belum bisa dicatat. Minta pemilik Sheet menjalankan ulang setupSpreadsheet.');
    }
    if (pemasok) {
      // Pemasok yang sudah dinonaktifkan tetap diterima (kiriman dari antrean di HP).
      var p = bacaPemasok_().filter(function (x) { return x.nama.toLowerCase() === pemasok.toLowerCase(); })[0];
      if (!p) throw galatPengguna_('Pemasok ' + pemasok + ' tidak ada di daftar pemasok. Muat ulang form.');
      pemasok = p.nama;
    }
    var baru = [];
    var adaSisa = false;
    var sisaLebih = [];
    var rekap = null;
    var dilihat = {};
    // Pesanan ke pemasok (Code.gs v0.29): barang masuk menyelesaikan pesanan yang menunggu.
    var pes = bacaPesanan_();
    var masukPesanan = [];
    var sudahDatang = [];
    if (masukan.some(function (b) { return b && b.sisa !== '' && b.sisa != null; }) && !sisaStockSiap_()) {
      throw galatPengguna_('Hitung sisa belum bisa dipakai. Minta pemilik Sheet menjalankan ulang setupSpreadsheet.');
    }
    masukan.forEach(function (b) {
      var m = master[rapikanTeks_(b && b.item).toLowerCase()];
      if (!m) throw galatPengguna_('Item ' + rapikanTeks_(b && b.item) + ' tidak ada di daftar item. Muat ulang form.');
      var kunci = m.nama.toLowerCase();
      var pakaiSisa = b.sisa !== '' && b.sisa != null;
      // Sisa dihitung dari stock sebelum kiriman ini, jadi item yang sama dua kali tidak bisa dihitung benar.
      if (dilihat[kunci] && (pakaiSisa || dilihat[kunci] === 'sisa')) {
        throw galatPengguna_(m.nama + ' ada dua kali di kiriman ini. Muat ulang form.');
      }
      dilihat[kunci] = pakaiSisa ? 'sisa' : 'keluar';
      var masuk = angkaIsian_(b.masuk, 'Tambah masuk ' + m.nama);
      var keluar = angkaIsian_(b.keluar, 'Tambah keluar ' + m.nama);
      var diketik = '';
      var besar = b.satuanMasuk === 'besar' && masuk;
      // Harga beli per satuan yang diketik (per dus jika masuk dalam satuan besar); disimpan per satuan dasar.
      var harga = masuk ? angkaOpsional_(b.hargaBeli, 'Harga beli ' + m.nama, 2) : null;
      if (besar) {
        if (!m.satuanBesar) throw galatPengguna_(m.nama + ' tidak punya satuan besar. Isi Tambah masuk dalam ' + m.satuan + '.');
        diketik = teksAngka_(masuk) + ' ' + m.satuanBesar;
        masuk = bulat_(masuk * m.isiSatuanBesar);
        if (harga != null) harga = Math.round(harga / m.isiSatuanBesar * 100) / 100;
      }
      // Barang masuk yang diisi dari pesanan yang sudah dicatat datang tidak dicatat lagi (keluar atau sisanya tetap).
      var tautan = masuk ? barisPesananTertaut_(pes, rapikanTeks_(b.pesanan), m.nama) : null;
      if (tautan && tautan.datang) {
        var dt = tautan.datang;
        sudahDatang.push({ item: m.nama, pemasok: dt.pemasok, oleh: dt.selesaiOleh, waktu: dt.selesaiMs ? new Date(dt.selesaiMs).toISOString() : '' });
        masuk = 0;
        diketik = '';
        harga = null;
      }
      var sisaDicatat = '';
      if (pakaiSisa) {
        if (keluar) throw galatPengguna_('Isi Tambah keluar atau sisa ' + m.nama + ', tidak keduanya.');
        var sisa = angkaIsian_(b.sisa, 'Sisa ' + m.nama);
        adaSisa = true;
        rekap = rekap || bacaRekap_();
        var tercatat = posisiStock_(rekap.item[kunci], tanggal).akhir;
        keluar = bulat_(tercatat + masuk - sisa);
        if (keluar < 0) {
          sisaLebih.push({ item: m.nama, sisa: sisa, tercatat: tercatat, masuk: masuk, satuan: m.satuan });
          keluar = 0;
        } else {
          sisaDicatat = sisa;
        }
      }
      // Item yang kedua kolomnya kosong tidak ikut terkirim; sisa yang sama dengan stock tetap dicatat.
      if (!masuk && !keluar && sisaDicatat === '') return;
      // Baik sampai barang masuk (Bagian 5.1): yang diketik, atau tanggal + masa simpan item.
      var baik = masuk && baikSiap ? baikSampaiMasuk_(b.baikSampai, tanggal, m) : '';
      if (masuk) masukPesanan.push({ item: m.nama, tertaut: tautan ? tautan.r : null });
      baru.push(gabung_(gabung_({
        'Tanggal': tanggalSel_(tanggal),
        'Kategori': m.kategori,
        'Nama Item': m.nama,
        'Stock Masuk': masuk,
        'Stock Keluar': keluar,
        'Satuan': m.satuan,
        'Masuk Diketik': diketik
      }, isiSistem_(konteks)), kolomAda_(tabel, {
        // Kolom Code.gs v0.23: hanya ditulis jika setupSpreadsheet sudah menambahkannya.
        'Pemasok': masuk ? pemasok : '',
        'Harga Beli (Rp)': harga == null ? '' : harga,
        'Baik Sampai': baik ? tanggalSel_(baik) : '',
        'Sisa Dihitung': sisaDicatat
      })));
    });
    if (!baru.length) {
      // Hanya sisa yang lebih banyak dari stock, atau barang masuk dari pesanan yang sudah datang: tidak ada yang dicatat,
      // tetapi kiriman tidak gagal (kiriman dari antrean tidak boleh macet).
      if (adaSisa || sudahDatang.length) {
        var kosong = { sudahTerkirim: false, jumlah: 0 };
        if (adaSisa) kosong.sisaLebih = sisaLebih;
        if (sudahDatang.length) kosong.pesananSudahDatang = sudahDatang;
        kosong.form = dataFormStock_(tanggal);
        return kosong;
      }
      throw galatPengguna_('Isi Tambah masuk atau Tambah keluar minimal untuk satu item.');
    }

    tambahBarisTabel_(tabel, baru);
    urutkanTabel_(tabel, URUTAN_DATA);
    hitungUlangStock_(baru.map(function (b) { return { item: b['Nama Item'], dari: tanggal }; }));
    var datang = selesaikanPesanan_(pes, masukPesanan, pemasok, tanggal, konteks);
    var hasil = { sudahTerkirim: false, jumlah: baru.length, form: dataFormStock_(tanggal) };
    if (adaSisa) hasil.sisaLebih = sisaLebih;
    if (datang.length) hasil.pesananDatang = datang;
    if (sudahDatang.length) hasil.pesananSudahDatang = sudahDatang;
    return hasil;
  });
}

/**
 * Baik sampai satu barang masuk (Code.gs v0.25): tanggal yang dikirim HP
 * (boleh diubah Staff), atau tanggal masuk + masa simpan item. Item tanpa
 * masa simpan dan tanpa tanggal yang dikirim: ''. Tanggal sebelum tanggal
 * masuk, atau lebih dari MASA_SIMPAN_MAKS hari sesudahnya, ditolak.
 */
function baikSampaiMasuk_(nilai, tanggal, m) {
  var teks = rapikanTeks_(nilai);
  if (!teks) return m.masaSimpan == null ? '' : geserTanggal_(tanggal, m.masaSimpan);
  if (!tanggalSah_(teks)) throw galatPengguna_('Baik sampai ' + m.nama + ' tidak terbaca. Pilih tanggal lagi.');
  if (teks < tanggal) throw galatPengguna_('Baik sampai ' + m.nama + ' tidak boleh sebelum tanggal barang masuk.');
  if (teks > geserTanggal_(tanggal, MASA_SIMPAN_MAKS)) {
    throw galatPengguna_('Baik sampai ' + m.nama + ' paling lama ' + MASA_SIMPAN_MAKS + ' hari sesudah tanggal barang masuk.');
  }
  return teks;
}

/**
 * Tanda nihil (spesifikasi sistem Bagian 5.8), untuk form mana pun kecuali
 * Suhu. Dicatat di Data_Nihil. Batal sendiri jika kemudian ada kiriman:
 * kelengkapan selalu mendahulukan kiriman.
 */
function aksiTandaiNihil_(body, pengguna) {
  var tanggal = periksaTanggalIsian_(body.tanggal, pengguna);
  var konteks = konteksKiriman_(body, pengguna);
  var idForm = rapikanTeks_(body.formId).toUpperCase();
  var form = null;
  bacaDaftarForm_().forEach(function (f) {
    if (f.id === idForm && f.aktif) form = f;
  });
  if (!form || idForm === 'SUHU') throw galatPengguna_('Form ini tidak bisa ditandai nihil.');

  return denganKunci_(function () {
    var zona = zonaSheet_();
    var tabel = wajibTabel_('Data_Nihil');
    var punyaForm = function (n) { return rapikanTeks_(n['ID Form']).toUpperCase() === idForm; };
    var ada = bacaBarisTanggal_('Data_Nihil', tanggal, zona, ['ID Form']).filter(punyaForm);
    if (!adaSubmission_(tabel, konteks.sid) && !ada.length) {
      if (bacaBarisTanggal_(tabDataForm_(idForm), tanggal, zona, []).length) {
        throw galatPengguna_(form.nama + ' sudah punya isian pada tanggal ini.');
      }
      tambahBarisTabel_(tabel, [gabung_({
        'Tanggal': tanggalSel_(tanggal),
        'ID Form': idForm,
        'Nama Form': form.nama
      }, isiSistem_(konteks))]);
      urutkanTabel_(tabel, [['Tanggal', false], ['ID Form', true], ['timestamp_server', true]]);
      ada = bacaBarisTanggal_('Data_Nihil', tanggal, zona, ['ID Form']).filter(punyaForm);
    }
    return { formId: idForm, tanggal: tanggal, nihil: barisTerakhir_(ada) };
  });
}

var ALASAN_PENYESUAIAN = ['Stok pembuka', 'Hasil hitung ulang', 'Lainnya'];

/**
 * Penyesuaian stock satu item (spesifikasi sistem Bagian 5.7), hanya
 * Pengelola. Selisih terhadap stock tercatat pada tanggal itu disimpan di
 * Data_Penyesuaian sebagai gerakan baru, lalu rekap dihitung ulang.
 * Dibuka dari lembar riwayat per item (Tahap 3). Jawabannya memuat riwayat
 * item itu yang sudah diperbarui.
 */
function aksiSesuaikanStock_(body, pengguna) {
  var tanggal = periksaTanggalIsian_(body.tanggal, pengguna);
  var konteks = konteksKiriman_(body, pengguna);
  var sebenarnya = angkaIsian_(body.stockSebenarnya, 'Stock sebenarnya');
  if (body.stockSebenarnya === '' || body.stockSebenarnya == null) throw galatPengguna_('Isi stock sebenarnya.');
  var alasan = String(body.alasan || '');
  if (ALASAN_PENYESUAIAN.indexOf(alasan) < 0) throw galatPengguna_('Pilih alasan penyesuaian.');
  var catatan = rapikanTeks_(body.catatan).slice(0, 200);
  if (alasan === 'Lainnya' && !catatan) throw galatPengguna_('Tulis catatan untuk alasan Lainnya.');
  catatan = teksAman_(catatan);

  return denganKunci_(function () {
    var tabel = wajibTabel_('Data_Penyesuaian');
    var m = bacaItem_()[rapikanTeks_(body.item).toLowerCase()];
    if (!m) throw galatPengguna_('Item tidak ada di daftar item. Muat ulang form.');
    if (adaSubmission_(tabel, konteks.sid)) {
      return { sudahTerkirim: true, form: dataFormStock_(tanggal), riwayatItem: dataRiwayatItem_(m.nama) };
    }
    var tercatat = posisiStock_(bacaRekap_().item[m.nama.toLowerCase()], tanggal).akhir;
    var selisih = bulat_(sebenarnya - tercatat);
    if (!selisih) {
      throw galatPengguna_('Stock ' + m.nama + ' tercatat ' + teksAngka_(tercatat) + ' ' + m.satuan +
        '. Tidak ada selisih yang perlu disimpan.');
    }
    // Nilai selisih memakai harga yang berlaku pada tanggal penyesuaian (Bagian 5.7), disalin saat dicatat.
    var harga = hargaPada_(m, tanggal);
    tambahBarisTabel_(tabel, [gabung_({
      'Tanggal': tanggalSel_(tanggal),
      'Kategori': m.kategori,
      'Nama Item': m.nama,
      'Stock Tercatat': tercatat,
      'Stock Sebenarnya': sebenarnya,
      'Selisih': selisih,
      'Satuan': m.satuan,
      'Nilai Selisih (Rp)': harga == null ? '' : Math.round(selisih * harga),
      'Alasan': alasan,
      'Catatan': catatan
    }, isiSistem_(konteks))]);
    urutkanTabel_(tabel, URUTAN_DATA);
    hitungUlangStock_([{ item: m.nama, dari: tanggal }]);
    return {
      sudahTerkirim: false, tercatat: tercatat, selisih: selisih,
      form: dataFormStock_(tanggal), riwayatItem: dataRiwayatItem_(m.nama)
    };
  });
}

/* =========================================================================
 * Tahap 5: form Waste (spesifikasi sistem Bagian 5.4) dan Suhu (Bagian 5.2)
 * ========================================================================= */

var KATEGORI_WASTE = ['Expired', 'Rusak', 'Sisa Produksi', 'Kesalahan Order', 'Lainnya'];
var SHIFT = ['Pagi', 'Siang', 'Malam'];
var URUTAN_WASTE = [['Tanggal', false], ['Item / Produk', true], ['timestamp_server', true]];

/** Estimasi kerugian = Qty × Harga Satuan (yang disalin saat dicatat), dibulatkan ke rupiah; kosong jika harga kosong. */
function estimasiWaste_(qty, harga) {
  if (harga === '' || harga == null || !isFinite(Number(harga))) return '';
  return Math.round(Number(qty) * Number(harga));
}

/** Kategori waste harus salah satu pilihan; alasan wajib jika kategori Lainnya. */
function periksaBarisWaste_(kategori, alasan, label) {
  if (KATEGORI_WASTE.indexOf(kategori) < 0) throw galatPengguna_('Pilih kategori waste untuk ' + label + '.');
  if (kategori === 'Lainnya' && !rapikanTeks_(alasan)) {
    throw galatPengguna_('Tulis alasan untuk ' + label + ', karena kategorinya Lainnya.');
  }
}

/**
 * Data layar isi Waste: item aktif (satuan dari M_Item; harga yang berlaku
 * pada tanggal waste, Bagian 5.4; harga barang jadi yang kosong dari resepnya
 * dengan harga bahan pada tanggal itu), pilihan
 * kategori waste dan shift, waste yang sudah tercatat pada tanggal itu, dan
 * tanda nihil.
 */
/**
 * Nominal rupiah waste (harga satuan, estimasi kerugian) hanya untuk Pengelola
 * (keputusan pemilik 17 Oktober 2026, Bagian 5.4). Tanpa pengguna (trigger
 * laporan harian, email, Drive) nominalnya tetap ada.
 */
function rupiahWasteTerlihat_() {
  return !PENGGUNA_AKSI_ || !!PENGGUNA_AKSI_.pengelola;
}

function dataFormWaste_(tanggal) {
  var zona = zonaSheet_();
  var rupiah = rupiahWasteTerlihat_();
  // Harga pada tanggal waste; barang jadi yang kosong dihitung dari resepnya (Bagian 5.3, Tahap 6).
  var master = lengkapiHargaResep_(itemPadaTanggal_(tanggal));
  var item = Object.keys(master).filter(function (k) { return master[k].aktif; }).map(function (k) {
    var m = master[k];
    return { nama: m.nama, kategori: m.kategori, satuan: m.satuan, harga: rupiah ? m.harga : undefined };
  }).sort(function (a, b) { return a.nama.localeCompare(b.nama, 'id'); });
  var kiriman = bacaBarisTanggal_('Data_Waste', tanggal, zona,
    ['submission_id', 'Item / Produk', 'Kategori Waste', 'Qty', 'Satuan', 'Estimasi Kerugian (Rp)']);
  var sid = {};
  var total = 0;
  var baris = kiriman.map(function (b) {
    sid[b.submission_id] = true;
    var rp = angkaAtauNull_(b['Estimasi Kerugian (Rp)']);
    total += rp || 0;
    return {
      item: rapikanTeks_(b['Item / Produk']),
      kategori: rapikanTeks_(b['Kategori Waste']),
      qty: Number(b.Qty) || 0,
      satuan: rapikanTeks_(b.Satuan),
      estimasi: rupiah ? rp : undefined,
      oleh: b.oleh,
      waktu: b.waktu ? b.waktu.toISOString() : null
    };
  }).sort(function (a, b) { return String(a.waktu).localeCompare(String(b.waktu)); });
  var nihil = bacaBarisTanggal_('Data_Nihil', tanggal, zona, ['ID Form']).filter(function (n) {
    return rapikanTeks_(n['ID Form']).toUpperCase() === 'WASTE';
  });
  return {
    tanggal: tanggal,
    kategoriWaste: KATEGORI_WASTE,
    shift: SHIFT,
    tanpaRupiah: rupiah ? undefined : true,
    item: item,
    kiriman: { jumlah: Object.keys(sid).length, terakhir: barisTerakhir_(kiriman), totalRp: rupiah ? Math.round(total) : undefined, baris: baris },
    nihil: kiriman.length ? null : barisTerakhir_(nihil)
  };
}

function aksiFormWaste_(body) {
  if (!tanggalSah_(body.tanggal)) throw galatPengguna_('Tanggal tidak terbaca. Pilih tanggal lagi.');
  return dataFormWaste_(body.tanggal);
}

/* ---------- Tahap 11: foto bukti waste (sistem Bagian 5.4) ---------- */

var BATAS_FOTO_BYTE = 2 * 1024 * 1024;           // per foto, setelah base64 dibuka
var BATAS_FOTO_KIRIMAN_BYTE = 15 * 1024 * 1024;  // semua foto dalam satu kiriman
var FOLDER_FOTO_WASTE = 'Foto waste';

/** "3,1 MB" */
function ukuranMb_(byte) {
  return (Math.round(byte / 104857.6) / 10).toString().replace('.', ',') + ' MB';
}

/**
 * Foto bukti satu baris waste dari kiriman (base64, boleh berawalan data URL):
 * null jika tidak ada; { bytes, mime, ext, ukuran } jika sah. Hanya JPEG, PNG,
 * atau WebP (dikenali dari isi file, bukan dari namanya), paling besar
 * BATAS_FOTO_BYTE.
 */
function bacaFotoWaste_(nilai, label) {
  if (nilai == null || nilai === '') return null;
  var teks = typeof nilai === 'string' ? nilai.replace(/^data:[^,]*,/, '').replace(/\s+/g, '') : '';
  var tidakTerbaca = 'Foto bukti ' + label + ' tidak terbaca. Hapus fotonya, lalu ambil lagi.';
  if (!teks || !/^[A-Za-z0-9+/_-]+=*$/.test(teks)) throw galatPengguna_(tidakTerbaca);
  var kiraan = Math.floor(teks.length * 3 / 4);
  if (kiraan > BATAS_FOTO_BYTE) {
    throw galatPengguna_('Foto bukti ' + label + ' terlalu besar (' + ukuranMb_(kiraan) + '). Batasnya ' +
      ukuranMb_(BATAS_FOTO_BYTE) + '. Hapus fotonya, lalu ambil lagi.');
  }
  var bytes;
  try {
    bytes = Utilities.base64Decode(teks.replace(/-/g, '+').replace(/_/g, '/'));
  } catch (err) {
    throw galatPengguna_(tidakTerbaca);
  }
  var b = function (i) { return bytes[i] & 255; };
  var jenis = null;
  if (b(0) === 0xFF && b(1) === 0xD8 && b(2) === 0xFF) jenis = { mime: 'image/jpeg', ext: 'jpg' };
  else if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4E && b(3) === 0x47) jenis = { mime: 'image/png', ext: 'png' };
  else if (b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 &&
    b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50) jenis = { mime: 'image/webp', ext: 'webp' };
  if (!jenis || bytes.length < 16) throw galatPengguna_(tidakTerbaca);
  return { bytes: bytes, mime: jenis.mime, ext: jenis.ext, ukuran: bytes.length };
}

/** Folder Laporan Kitchen/{Nama Outlet} (dipakai laporan PDF harian dan foto waste). */
function folderOutlet_() {
  var akar = cariAtauBuatFolder_(DriveApp.getRootFolder(), FOLDER_LAPORAN);
  return cariAtauBuatFolder_(akar, (namaOutlet_() || 'Outlet').replace(/[\\/]+/g, '-'));
}

/** Folder Laporan Kitchen/{Nama Outlet}/Foto waste/{YYYY}/{MM Bulan} untuk satu tanggal waste. */
function folderFotoWaste_(tanggal) {
  var p = tanggal.split('-');
  var tahun = cariAtauBuatFolder_(cariAtauBuatFolder_(folderOutlet_(), FOLDER_FOTO_WASTE), p[0]);
  return cariAtauBuatFolder_(tahun, p[1] + ' ' + BULAN_ID[Number(p[1]) - 1]);
}

/**
 * Menyimpan foto ke Drive: {tanggal}_{Item}_{8 huruf awal submissionId}-{no baris}.{ext}.
 * Nama itu tetap untuk kiriman yang sama, jadi kiriman yang diulang setelah
 * terputus di tengah jalan memakai file yang sudah ada (tidak tersimpan dua
 * kali). Mengembalikan { url, gagal: [nama item] }; foto yang gagal disimpan
 * tidak menggagalkan kiriman (waste tetap mengurangi stock), dan disebut di jawaban.
 */
function simpanFotoWaste_(tanggal, sid, daftar) {
  var gagal = [];
  if (!daftar.length) return gagal;
  var folder = null;
  try {
    folder = folderFotoWaste_(tanggal);
  } catch (err) {
    console.error('Folder foto waste gagal: ' + (err && err.stack ? err.stack : err));
  }
  daftar.forEach(function (x) {
    if (!folder) {
      gagal.push(x.baris['Item / Produk']);
      return;
    }
    var nama = tanggal + '_' + namaFileForm_(x.baris['Item / Produk']) + '_' + sid.slice(0, 8) + '-' + (x.no) + '.' + x.foto.ext;
    try {
      var file = null;
      var ada = folder.getFilesByName(nama);
      while (ada.hasNext()) {
        var f = ada.next();
        if (!f.isTrashed()) { file = f; break; }
      }
      if (!file) file = folder.createFile(Utilities.newBlob(x.foto.bytes, x.foto.mime, nama));
      x.baris['Foto Bukti'] = file.getUrl();
    } catch (err) {
      console.error('Foto waste gagal disimpan: ' + (err && err.stack ? err.stack : err));
      gagal.push(x.baris['Item / Produk']);
    }
  });
  return gagal;
}

/**
 * Kiriman form Waste: satu baris Data_Waste per item. Satuan disalin dari
 * M_Item, Harga Satuan dari harga yang berlaku pada tanggal waste (Bagian
 * 5.4), saat dicatat; Estimasi Kerugian dihitung server. Waste
 * langsung mengurangi stock: rekap Stock_Harian item itu pada tanggal itu
 * (dibuat jika belum ada) dan semua rekap sesudahnya dihitung ulang.
 * Foto bukti (opsional, satu per baris, base64 di `foto`) disimpan ke Drive
 * sebelum kunci diambil, supaya penulis lain tidak menunggu unggahan;
 * tautannya dicatat di kolom Foto Bukti. Kiriman ganda dikenali lebih dulu,
 * jadi fotonya tidak disimpan lagi.
 */
function aksiKirimWaste_(body, pengguna) {
  var tanggal = periksaTanggalIsian_(body.tanggal, pengguna);
  var konteks = konteksKiriman_(body, pengguna);
  var shift = String(body.shift || '');
  if (SHIFT.indexOf(shift) < 0) throw galatPengguna_('Pilih shift: Pagi, Siang, atau Malam.');
  var masukan = Array.isArray(body.baris) ? body.baris : [];
  if (masukan.length > 200) throw galatPengguna_('Isian terlalu banyak untuk satu kiriman.');
  if (adaSubmission_(wajibTabel_('Data_Waste'), konteks.sid)) {
    return { sudahTerkirim: true, jumlah: 0, form: dataFormWaste_(tanggal) };
  }

  var master = lengkapiHargaResep_(itemPadaTanggal_(tanggal));
  var foto = [];
  var totalFoto = 0;
  var baru = masukan.map(function (b, i) {
    var m = master[rapikanTeks_(b && b.item).toLowerCase()];
    if (!m) throw galatPengguna_('Item ' + rapikanTeks_(b && b.item) + ' tidak ada di daftar item. Muat ulang form.');
    var qty = angkaIsian_(b.qty, 'Qty ' + m.nama);
    if (!qty) throw galatPengguna_('Isi Qty ' + m.nama + ' lebih dari 0.');
    var kategori = String(b.kategori || '');
    var alasan = rapikanTeks_(b.alasan).slice(0, 200);
    periksaBarisWaste_(kategori, alasan, m.nama);
    var baris = gabung_({
      'Tanggal': tanggalSel_(tanggal),
      'Shift': shift,
      'Nama Staff': pengguna.nama,
      'Item / Produk': m.nama,
      'Kategori Waste': kategori,
      'Qty': qty,
      'Satuan': m.satuan,
      'Alasan / Keterangan': teksAman_(alasan),
      'Harga Satuan (Rp)': m.harga == null ? '' : m.harga,
      'Estimasi Kerugian (Rp)': estimasiWaste_(qty, m.harga),
      'Foto Bukti': ''
    }, isiSistem_(konteks));
    var f = bacaFotoWaste_(b.foto, m.nama);
    if (f) {
      totalFoto += f.ukuran;
      foto.push({ baris: baris, foto: f, no: i + 1 });
    }
    return baris;
  });
  if (!baru.length) throw galatPengguna_('Tambah minimal satu item waste.');
  if (totalFoto > BATAS_FOTO_KIRIMAN_BYTE) {
    throw galatPengguna_('Foto dalam satu kiriman terlalu banyak (' + ukuranMb_(totalFoto) + ', batasnya ' +
      ukuranMb_(BATAS_FOTO_KIRIMAN_BYTE) + '). Kirim sebagian item dulu.');
  }
  var fotoGagal = simpanFotoWaste_(tanggal, konteks.sid, foto);

  return denganKunci_(function () {
    var tabel = wajibTabel_('Data_Waste');
    if (adaSubmission_(tabel, konteks.sid)) {
      return { sudahTerkirim: true, jumlah: 0, form: dataFormWaste_(tanggal) };
    }
    tambahBarisTabel_(tabel, baru);
    urutkanTabel_(tabel, URUTAN_WASTE);
    hitungUlangStock_(baru.map(function (b) { return { item: b['Item / Produk'], dari: tanggal }; }));
    return { sudahTerkirim: false, jumlah: baru.length, foto: foto.length - fotoGagal.length, fotoGagal: fotoGagal,
      form: dataFormWaste_(tanggal) };
  });
}

var WAKTU_CEK = ['Opening', 'Middle', 'Closing', 'Cek ulang'];
var STATUS_SUHU_NORMAL = 'Normal';
var STATUS_SUHU_LUAR = 'Di Luar Standar';

/** Batas suhu dari M_Konfigurasi; nilai kosong atau tidak sah memakai nilai awal (1, 5, -18). */
function batasSuhu_() {
  var n = bacaKonfigurasi_().nilai;
  function angka(v, awal) {
    var t = String(v == null ? '' : v).trim().replace(',', '.').replace('−', '-');
    var x = Number(t);
    return t !== '' && isFinite(x) ? x : awal;
  }
  return {
    chillerMin: angka(n.suhu_chiller_min, 1),
    chillerMaks: angka(n.suhu_chiller_maks, 5),
    freezerMaks: angka(n.suhu_freezer_maks, -18)
  };
}

/** Chiller normal jika di antara batas bawah dan atas (termasuk); Freezer normal jika sama dengan atau lebih rendah dari batasnya. */
function statusSuhuNilai_(tipe, suhu, batas) {
  var normal = String(tipe).toLowerCase() === 'freezer'
    ? suhu <= batas.freezerMaks
    : suhu >= batas.chillerMin && suhu <= batas.chillerMaks;
  return normal ? STATUS_SUHU_NORMAL : STATUS_SUHU_LUAR;
}

/** Angka suhu: boleh minus dan desimal ("-18", "−18", "3,5"); wajib diisi. */
function angkaSuhu_(nilai, label) {
  var t = String(nilai == null ? '' : nilai).trim().replace(',', '.').replace('−', '-');
  var x = Number(t);
  if (t === '' || !isFinite(x)) throw galatPengguna_(label + ' harus angka, misalnya 3,5 atau -18.');
  if (x < -60 || x > 60) throw galatPengguna_(label + ' di luar jangkauan termometer. Periksa angkanya.');
  return bulat_(x);
}

/** M_Unit: [{ nama, tipe, aktif }] menurut urutan di Sheet (nama ganda dilewati). */
function bacaUnit_() {
  var t = wajibTabel_('M_Unit');
  var sudah = {};
  var hasil = [];
  t.baris.forEach(function (b) {
    var nama = rapikanTeks_(nilai_(t, b, 'Nama Unit'));
    if (!nama || sudah[nama.toLowerCase()]) return;
    sudah[nama.toLowerCase()] = true;
    var tipe = rapikanTeks_(nilai_(t, b, 'Tipe'));
    hasil.push({ nama: nama, tipe: tipe.toLowerCase() === 'freezer' ? 'Freezer' : 'Chiller', aktif: benar_(nilai_(t, b, 'Aktif')) });
  });
  return hasil;
}

/**
 * Data layar isi Suhu: unit aktif, batas suhu, dan semua pengecekan pada
 * tanggal itu (termasuk cek ulang), urut waktu kirim.
 */
function dataFormSuhu_(tanggal) {
  var zona = zonaSheet_();
  var isian = bacaBarisTanggal_('Data_Suhu', tanggal, zona,
    ['Waktu Cek', 'Nama Unit', 'Tipe Unit', 'Suhu (°C)', 'Status Suhu', 'Tindakan Korektif']).map(function (b) {
    return {
      unit: rapikanTeks_(b['Nama Unit']),
      tipe: rapikanTeks_(b['Tipe Unit']),
      waktuCek: rapikanTeks_(b['Waktu Cek']),
      suhu: angkaAtauNull_(b['Suhu (°C)']),
      status: rapikanTeks_(b['Status Suhu']),
      tindakan: rapikanTeks_(b['Tindakan Korektif']),
      oleh: b.oleh,
      waktu: b.waktu ? b.waktu.toISOString() : null
    };
  }).sort(function (a, b) { return String(a.waktu).localeCompare(String(b.waktu)); });
  return {
    tanggal: tanggal,
    waktuCek: WAKTU_CEK,
    batas: batasSuhu_(),
    unit: bacaUnit_().filter(function (u) { return u.aktif; }).map(function (u) { return { nama: u.nama, tipe: u.tipe }; }),
    isian: isian
  };
}

function aksiFormSuhu_(body) {
  if (!tanggalSah_(body.tanggal)) throw galatPengguna_('Tanggal tidak terbaca. Pilih tanggal lagi.');
  return dataFormSuhu_(body.tanggal);
}

/**
 * Kiriman form Suhu: satu baris Data_Suhu per unit untuk satu waktu cek.
 * Status dihitung server dari batas di M_Konfigurasi; tindakan korektif
 * wajib jika di luar standar. Opening, Middle, dan Closing hanya sekali per
 * unit per tanggal (kiriman kedua ditolak seluruhnya, dengan nama unit dan
 * pengisinya); Cek ulang boleh berkali-kali. Tidak ada email instan.
 */
function aksiKirimSuhu_(body, pengguna) {
  var tanggal = periksaTanggalIsian_(body.tanggal, pengguna);
  var konteks = konteksKiriman_(body, pengguna);
  var waktu = '';
  WAKTU_CEK.forEach(function (w) { if (w.toLowerCase() === rapikanTeks_(body.waktuCek).toLowerCase()) waktu = w; });
  if (!waktu) throw galatPengguna_('Pilih waktu cek: Opening, Middle, Closing, atau Cek ulang.');
  var masukan = Array.isArray(body.baris) ? body.baris : [];
  if (masukan.length > 100) throw galatPengguna_('Isian terlalu banyak untuk satu kiriman.');

  return denganKunci_(function () {
    var tabel = wajibTabel_('Data_Suhu');
    if (adaSubmission_(tabel, konteks.sid)) {
      return { sudahTerkirim: true, jumlah: 0, luarStandar: 0, form: dataFormSuhu_(tanggal) };
    }
    var unit = {};
    bacaUnit_().forEach(function (u) { unit[u.nama.toLowerCase()] = u; });
    var batas = batasSuhu_();
    var sudah = {};
    if (waktu !== 'Cek ulang') {
      bacaBarisTanggal_('Data_Suhu', tanggal, zonaSheet_(), ['Nama Unit', 'Waktu Cek']).forEach(function (b) {
        if (rapikanTeks_(b['Waktu Cek']).toLowerCase() === waktu.toLowerCase()) sudah[rapikanTeks_(b['Nama Unit']).toLowerCase()] = b;
      });
    }
    var dalamKiriman = {};
    var luar = 0;
    var daftarLuar = [];
    var baru = masukan.map(function (b) {
      var u = unit[rapikanTeks_(b && b.unit).toLowerCase()];
      if (!u) throw galatPengguna_('Unit ' + rapikanTeks_(b && b.unit) + ' tidak ada di daftar unit. Muat ulang form.');
      var kunci = u.nama.toLowerCase();
      if (waktu !== 'Cek ulang') {
        var ada = sudah[kunci];
        if (ada) {
          throw galatPengguna_('Suhu ' + waktu + ' ' + u.nama + ' sudah diisi ' + ada.oleh +
            (ada.waktu ? ' pukul ' + jamId_(ada.waktu) : '') + '.');
        }
        if (dalamKiriman[kunci]) throw galatPengguna_('Suhu ' + waktu + ' ' + u.nama + ' terisi dua kali. Periksa isiannya.');
        dalamKiriman[kunci] = true;
      }
      var suhu = angkaSuhu_(b.suhu, 'Suhu ' + u.nama);
      var status = statusSuhuNilai_(u.tipe, suhu, batas);
      var tindakan = rapikanTeks_(b.tindakan).slice(0, 200);
      if (status === STATUS_SUHU_LUAR) {
        luar++;
        daftarLuar.push(u.nama + ' ' + suhuId_(suhu) + (tindakan ? ' (' + tindakan + ')' : ''));
        if (!tindakan) {
          throw galatPengguna_('Suhu ' + u.nama + ' di luar standar. Tulis tindakan korektif sebelum mengirim.');
        }
      }
      return gabung_({
        'Tanggal': tanggalSel_(tanggal),
        'Waktu Cek': waktu,
        'Nama Unit': u.nama,
        'Tipe Unit': u.tipe,
        'Suhu (°C)': suhu,
        'Status Suhu': status,
        'Tindakan Korektif': teksAman_(tindakan),
        'Nama Staff': pengguna.nama
      }, isiSistem_(konteks));
    });
    if (!baru.length) throw galatPengguna_('Isi suhu minimal untuk satu unit.');

    tambahBarisTabel_(tabel, baru);
    urutkanSuhu_(tabel);
    // Notifikasi ke HP Pengelola (Code.gs v0.19): suhu di luar standar.
    if (luar) {
      kirimNotifikasi_('pengelola', {
        judul: 'Suhu di luar standar: ' + waktu + (tanggal === hariIni_() ? '' : ' ' + tanggalSedangId_(tanggal)),
        isi: daftarLuar.join(' · ') + '. Dicatat ' + pengguna.nama + '.',
        url: '#/suhu', tag: 'suhu-luar', mendesak: true
      });
    }
    return { sudahTerkirim: false, jumlah: baru.length, luarStandar: luar, form: dataFormSuhu_(tanggal) };
  });
}

/**
 * Urutan Data_Suhu (spesifikasi sistem Bagian 8.4): tanggal terbaru di atas,
 * lalu nama unit, lalu waktu cek Opening, Middle, Closing, Cek ulang; beberapa
 * cek ulang menurut waktu kirim. Range.sort tidak mengenal urutan waktu cek,
 * jadi baris diurutkan di memori lalu ditulis balik: hanya kolom yang ada,
 * hanya nilainya (format kolom dan format bersyarat tetap), dan hanya rentang
 * baris yang berpindah. Baris tanpa tanggal turun ke bawah seperti pada
 * Range.sort. Teks yang diawali =, +, -, atau @ ditulis lagi lewat teksAman_,
 * supaya tetap teks seperti saat pertama dicatat. Seluruh tab ikut diurutkan,
 * jadi data lama ikut rapi pada kiriman Suhu berikutnya.
 */
function urutkanSuhu_(tabel) {
  // Di Supabase tidak diurutkan: layar Suhu, grafik, PDF, dan email mengurutkan sendiri, dan salinan ke
  // Google Sheets mengurutkan tab ini (butir 151).
  if (DI_SUPABASE_) return;
  var sheet = tabel.sheet;
  var n = sheet.getLastRow() - 1;
  var lebar = sheet.getLastColumn();
  if (n < 2 || lebar < 1) return;
  var nilai = sheet.getRange(2, 1, n, lebar).getValues();
  var zona = zonaSheet_();
  var k = tabel.kol;
  var urutWaktu = {};
  WAKTU_CEK.forEach(function (w, i) { urutWaktu[w.toLowerCase()] = i; });
  var kunci = nilai.map(function (b, i) {
    var ts = k.timestamp_server === undefined ? null : b[k.timestamp_server];
    var w = k['Waktu Cek'] === undefined ? '' : rapikanTeks_(b[k['Waktu Cek']]).toLowerCase();
    return {
      i: i,
      tanggal: teksTanggal_(b[k.Tanggal], zona),
      unit: k['Nama Unit'] === undefined ? '' : rapikanTeks_(b[k['Nama Unit']]).toLowerCase(),
      waktu: w in urutWaktu ? urutWaktu[w] : WAKTU_CEK.length,
      ts: ts instanceof Date && !isNaN(ts.getTime()) ? ts.getTime() : Infinity
    };
  });
  kunci.sort(function (a, b) {
    if (!a.tanggal !== !b.tanggal) return a.tanggal ? -1 : 1;
    if (a.tanggal !== b.tanggal) return a.tanggal < b.tanggal ? 1 : -1;
    if (a.unit !== b.unit) return a.unit < b.unit ? -1 : 1;
    if (a.waktu !== b.waktu) return a.waktu - b.waktu;
    if (a.ts !== b.ts) return a.ts < b.ts ? -1 : 1;
    return a.i - b.i;
  });
  var awal = -1;
  var akhir = -1;
  kunci.forEach(function (x, posisi) {
    if (x.i === posisi) return;
    if (awal < 0) awal = posisi;
    akhir = posisi;
  });
  if (awal < 0) return; // sudah urut
  var tulis = kunci.slice(awal, akhir + 1).map(function (x) {
    return nilai[x.i].map(function (v) { return typeof v === 'string' ? teksAman_(v) : v; });
  });
  sheet.getRange(2 + awal, 1, tulis.length, lebar).setValues(tulis);
}

/* =========================================================================
 * Tahap 6: resep dan form Prep List (spesifikasi sistem Bagian 5.3)
 * ========================================================================= */

var MASA_SIMPAN_MAKS = 365;
var URUTAN_PREP = [['Tanggal', false], ['Item / Menu Prep', true], ['timestamp_server', true]];
var URUTAN_PREP_BAHAN = [['Tanggal', false], ['Item Hasil', true], ['Item Bahan', true], ['timestamp_server', true]];

/**
 * Resep dari M_Resep dan M_ResepBahan: { namaKecil: { itemHasil, hasil,
 * masaSimpan, aktif, nomor, bahan: [{ item, qty }] } }. Satu resep per item
 * hasil; bahan dihubungkan lewat kolom Item Hasil. Jika satu item hasil
 * tertulis dua kali (diisi tangan), baris yang aktif didahulukan.
 */
function bacaResep_() {
  var t = wajibTabel_('M_Resep');
  var tb = wajibTabel_('M_ResepBahan');
  var peta = {};
  t.baris.forEach(function (b, i) {
    var nama = rapikanTeks_(nilai_(t, b, 'Item Hasil'));
    if (!nama) return;
    var k = nama.toLowerCase();
    var aktif = benar_(nilai_(t, b, 'Aktif'));
    if (peta[k] && (peta[k].aktif || !aktif)) return;
    var masa = angkaAtauNull_(nilai_(t, b, 'Masa Simpan (hari)'));
    peta[k] = {
      itemHasil: nama,
      hasil: angkaAtauNull_(nilai_(t, b, 'Hasil per 1 Resep')),
      masaSimpan: masa == null || masa < 0 ? null : Math.round(masa),
      aktif: aktif,
      nomor: i + 2,
      bahan: []
    };
  });
  tb.baris.forEach(function (b) {
    var r = peta[rapikanTeks_(nilai_(tb, b, 'Item Hasil')).toLowerCase()];
    var item = rapikanTeks_(nilai_(tb, b, 'Item Bahan'));
    var qty = angkaAtauNull_(nilai_(tb, b, 'Qty per 1 Resep'));
    if (!r || !item || !(qty > 0)) return;
    r.bahan.push({ item: item, qty: qty });
  });
  return peta;
}

/** Resep aktif yang bisa dipakai prep (hasil lebih dari 0 dan punya bahan), atau null. */
function resepAktif_(resep, kecil) {
  var r = resep[kecil];
  return r && r.aktif && r.hasil > 0 && r.bahan.length ? r : null;
}

/** Biaya satu resep dari harga bahan: { biaya, lengkap, tanpaHarga: [nama] }. harga(namaKecil) → angka atau null. */
function biayaResep_(r, harga) {
  var hasil = { biaya: 0, lengkap: true, tanpaHarga: [] };
  r.bahan.forEach(function (b) {
    var h = harga(b.item.toLowerCase());
    if (h == null) {
      hasil.lengkap = false;
      hasil.tanpaHarga.push(b.item);
      return;
    }
    hasil.biaya += b.qty * h;
  });
  hasil.biaya = Math.round(hasil.biaya * 100) / 100;
  return hasil;
}

/**
 * Harga Satuan barang jadi yang kosong (Bagian 5.3): harga bahan satu resep
 * aktif dibagi hasil per resep. Bahan barang jadi lain ikut dihitung dari
 * resepnya. Jika ada bahan tanpa harga, harganya tetap kosong. Mengubah
 * master di tempat: harga terisi dan hargaDariResep = true.
 */
function lengkapiHargaResep_(master, resep) {
  resep = resep || bacaResep_();
  var sedang = {};
  var sudah = {};
  function harga(k) {
    var m = master[k];
    if (!m) return null;
    if (m.harga != null) return m.harga;
    if (sudah[k]) return null;
    var r = resepAktif_(resep, k);
    if (!r || sedang[k]) return null;
    sedang[k] = true;
    var b = biayaResep_(r, harga);
    sedang[k] = false;
    sudah[k] = true;
    if (!b.lengkap) return null;
    m.harga = Math.round(b.biaya / r.hasil * 100) / 100;
    m.hargaDariResep = true;
    return m.harga;
  }
  Object.keys(master).forEach(harga);
  return master;
}

/** Peta resep aktif { itemKecil: [bahanKecil] }, untuk pemeriksaan resep melingkar. */
function grafResep_(resep) {
  var graf = {};
  Object.keys(resep).forEach(function (k) {
    if (resep[k].aktif) graf[k] = resep[k].bahan.map(function (b) { return b.item.toLowerCase(); });
  });
  return graf;
}

/**
 * Resep tidak boleh melingkar (Bagian 5.3), langsung maupun lewat resep lain.
 * graf: resep aktif dengan resep yang sedang disimpan sudah dipasang. Melempar
 * galatPengguna_ dengan pesan yang menyebut itemnya.
 */
function periksaMelingkar_(graf, kecil, master) {
  var nama = function (k) { return master[k] ? master[k].nama : k; };
  (graf[kecil] || []).forEach(function (bahan) {
    if (bahan === kecil) throw galatPengguna_(nama(kecil) + ' tidak bisa menjadi bahan resepnya sendiri.');
    // Cari jalan dari bahan ini kembali ke item hasil.
    var dilihat = {};
    function cari(k, jalur) {
      if (dilihat[k]) return null;
      dilihat[k] = true;
      var anak = graf[k] || [];
      for (var i = 0; i < anak.length; i++) {
        if (anak[i] === kecil) return jalur;
        var j = cari(anak[i], jalur.concat([anak[i]]));
        if (j) return j;
      }
      return null;
    }
    var jalur = cari(bahan, []);
    if (jalur) {
      throw galatPengguna_(nama(bahan) + ' sudah memakai ' + nama(kecil) + ' sebagai bahan' +
        (jalur.length ? ', lewat ' + jalur.map(nama).join(', ') : '') + '.');
    }
  });
}

/** Resep untuk Pengaturan → Resep: satu baris per resep, biaya dari harga bahan. */
function ringkasResep_(r, master) {
  var m = master[r.itemHasil.toLowerCase()] || {};
  var masalah = [];
  if (m.nama && !m.aktif) masalah.push('Item ' + m.nama + ' nonaktif.');
  if (!m.nama) masalah.push('Item ' + r.itemHasil + ' tidak ada di daftar item.');
  var bahan = r.bahan.map(function (b) {
    var mb = master[b.item.toLowerCase()];
    if (!mb) masalah.push('Bahan ' + b.item + ' tidak ada di daftar item.');
    else if (!mb.aktif) masalah.push('Bahan ' + mb.nama + ' nonaktif.');
    return { item: mb ? mb.nama : b.item, qty: b.qty, satuan: mb ? mb.satuan : '', harga: mb ? mb.harga : null };
  });
  var b = biayaResep_(r, function (k) { return master[k] ? master[k].harga : null; });
  return {
    itemHasil: m.nama || r.itemHasil,
    satuan: m.satuan || '',
    hasil: r.hasil,
    masaSimpan: r.masaSimpan,
    aktif: r.aktif,
    bahan: bahan,
    biaya: b.lengkap ? b.biaya : null,
    hargaPerSatuan: b.lengkap && r.hasil > 0 ? Math.round(b.biaya / r.hasil * 100) / 100 : null,
    tanpaHarga: b.tanpaHarga,
    masalah: masalah
  };
}

/** Jawaban Pengaturan → Resep: semua resep (aktif dulu, abjad) dan daftar item dengan harga efektif. */
function dataResep_() {
  var resep = bacaResep_();
  var master = lengkapiHargaResep_(itemPadaTanggal_(hariIni_()), resep);
  var daftar = Object.keys(resep).map(function (k) { return ringkasResep_(resep[k], master); }).sort(function (a, b) {
    return (b.aktif ? 1 : 0) - (a.aktif ? 1 : 0) || a.itemHasil.localeCompare(b.itemHasil, 'id');
  });
  var item = Object.keys(master).map(function (k) {
    var m = master[k];
    return { nama: m.nama, kategori: m.kategori, satuan: m.satuan, harga: m.harga, hargaDariResep: !!m.hargaDariResep, aktif: m.aktif,
      punyaResep: !!resep[k] };
  }).sort(function (a, b) { return a.nama.localeCompare(b.nama, 'id'); });
  return { resep: daftar, item: item };
}

function aksiDaftarResep_() {
  return dataResep_();
}

/** Menulis ulang baris M_ResepBahan satu item hasil (baris item lain tetap, urutannya tidak berubah). */
function tulisBahanResep_(kecilLama, itemHasil, bahan) {
  var sheet = ambilTab_('M_ResepBahan');
  var kol = posisiKolom_(sheet, { hasil: 'Item Hasil', bahan: 'Item Bahan', qty: 'Qty per 1 Resep' });
  var lebar = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();
  var semua = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, lebar).getValues() : [];
  var tetap = semua.filter(function (b) {
    var k = rapikanTeks_(b[kol.hasil - 1]).toLowerCase();
    return kunciTerisi_(b[kol.hasil - 1]) && k !== kecilLama;
  });
  bahan.forEach(function (x) {
    var baris = [];
    for (var i = 0; i < lebar; i++) baris.push('');
    baris[kol.hasil - 1] = itemHasil;
    baris[kol.bahan - 1] = x.item;
    baris[kol.qty - 1] = x.qty;
    tetap.push(baris);
  });
  var perlu = tetap.length + 1;
  if (sheet.getMaxRows() < perlu) sheet.insertRowsAfter(sheet.getMaxRows(), perlu - sheet.getMaxRows());
  if (tetap.length) sheet.getRange(2, 1, tetap.length, lebar).setValues(tetap);
  if (semua.length > tetap.length) sheet.getRange(tetap.length + 2, 1, semua.length - tetap.length, lebar).clearContent();
}

/**
 * Simpan resep (Pengaturan → Resep), khusus Pengelola. body: { baru: bool,
 * itemHasil, hasil, masaSimpan ('' = tanpa), bahan: [{ item, qty }] }.
 * Resep baru langsung aktif; item hasil yang sudah punya resep (aktif atau
 * nonaktif) diubah lewat resep itu. Item hasil resep yang sudah ada tidak bisa
 * diganti. Bahan memakai satuan dasar tiap item. Catatan prep lama tidak
 * berubah, karena Data_PrepBahan menyimpan salinan resep saat prep dibuat.
 */
function aksiSimpanResep_(body) {
  var master = bacaItem_();
  var m = master[rapikanTeks_(body.itemHasil).toLowerCase()];
  if (!m) throw galatPengguna_('Pilih item hasil dari daftar item.');
  if (!m.aktif) throw galatPengguna_(m.nama + ' nonaktif. Pilih item hasil yang aktif.');
  var kecil = m.nama.toLowerCase();
  if (body.hasil === '' || body.hasil == null) throw galatPengguna_('Isi hasil per 1 resep.');
  var hasil = angkaIsian_(body.hasil, 'Hasil per 1 resep');
  if (!hasil) throw galatPengguna_('Hasil per 1 resep harus lebih dari 0.');
  var masa = String(body.masaSimpan == null ? '' : body.masaSimpan).trim();
  if (masa !== '' && (!/^\d+$/.test(masa) || Number(masa) > MASA_SIMPAN_MAKS)) {
    throw galatPengguna_('Masa simpan diisi angka hari bulat, 0 sampai ' + MASA_SIMPAN_MAKS + ', atau dikosongkan.');
  }
  var masukan = Array.isArray(body.bahan) ? body.bahan : [];
  if (!masukan.length) throw galatPengguna_('Tambah minimal satu bahan.');
  if (masukan.length > 40) throw galatPengguna_('Bahan terlalu banyak untuk satu resep.');
  var sudah = {};
  var bahan = masukan.map(function (b) {
    var mb = master[rapikanTeks_(b && b.item).toLowerCase()];
    if (!mb) throw galatPengguna_('Bahan ' + rapikanTeks_(b && b.item) + ' tidak ada di daftar item. Muat ulang layar ini.');
    if (!mb.aktif) throw galatPengguna_('Bahan ' + mb.nama + ' nonaktif. Pilih bahan yang aktif.');
    var k = mb.nama.toLowerCase();
    if (k === kecil) throw galatPengguna_(m.nama + ' tidak bisa menjadi bahan resepnya sendiri.');
    if (sudah[k]) throw galatPengguna_(mb.nama + ' tertulis dua kali. Gabungkan jumlahnya di satu baris.');
    sudah[k] = true;
    if (b.qty === '' || b.qty == null) throw galatPengguna_('Isi jumlah ' + mb.nama + ' per 1 resep.');
    var qty = angkaIsian_(b.qty, 'Jumlah ' + mb.nama);
    if (!qty) throw galatPengguna_('Jumlah ' + mb.nama + ' per 1 resep harus lebih dari 0.');
    return { item: mb.nama, qty: qty };
  });

  return denganKunci_(function () {
    var resep = bacaResep_();
    var ada = resep[kecil];
    if (body.baru && ada) {
      throw galatPengguna_(m.nama + ' sudah punya resep' + (ada.aktif ? '' : ' nonaktif') +
        '. Buka resep itu di daftar untuk mengubahnya.');
    }
    if (!body.baru && !ada) throw galatPengguna_('Resep ' + m.nama + ' tidak ditemukan. Kembali ke daftar resep.');
    var aktif = ada ? ada.aktif : true;
    if (aktif) {
      var graf = grafResep_(resep);
      graf[kecil] = bahan.map(function (b) { return b.item.toLowerCase(); });
      periksaMelingkar_(graf, kecil, master);
    }
    var sheet = ambilTab_('M_Resep');
    var kol = posisiKolom_(sheet, { hasil: 'Item Hasil', per1: 'Hasil per 1 Resep', masa: 'Masa Simpan (hari)', aktif: 'Aktif' });
    var nomor = ada ? ada.nomor : barisBaruMaster_(sheet, kol.hasil, 1);
    sheet.getRange(nomor, kol.hasil).setValue(m.nama);
    sheet.getRange(nomor, kol.per1).setValue(hasil);
    sheet.getRange(nomor, kol.masa).setValue(masa === '' ? '' : Number(masa));
    sheet.getRange(nomor, kol.aktif).setValue(aktif);
    tulisBahanResep_(kecil, m.nama, bahan);
    var data = dataResep_();
    data.disimpan = m.nama;
    return data;
  });
}

/**
 * Menonaktifkan atau mengaktifkan lagi satu resep. Satu item hasil hanya punya
 * satu resep aktif (satu baris M_Resep per item). Mengaktifkan memeriksa lagi
 * item yang nonaktif dan resep melingkar.
 */
function aksiAturResepAktif_(body) {
  var kecil = rapikanTeks_(body.itemHasil).toLowerCase();
  var aktif = body.aktif === true;
  return denganKunci_(function () {
    var resep = bacaResep_();
    var r = resep[kecil];
    if (!r) throw galatPengguna_('Resep tidak ditemukan. Kembali ke daftar resep.');
    var master = bacaItem_();
    if (aktif) {
      var m = master[kecil];
      if (!m || !m.aktif) throw galatPengguna_((m ? m.nama : r.itemHasil) + ' nonaktif. Aktifkan itemnya dulu.');
      r.bahan.forEach(function (b) {
        var mb = master[b.item.toLowerCase()];
        if (!mb || !mb.aktif) throw galatPengguna_('Bahan ' + b.item + ' nonaktif. Ganti bahannya dulu.');
      });
      var graf = grafResep_(resep);
      graf[kecil] = r.bahan.map(function (b) { return b.item.toLowerCase(); });
      periksaMelingkar_(graf, kecil, master);
    }
    var sheet = ambilTab_('M_Resep');
    sheet.getRange(r.nomor, posisiKolom_(sheet, { a: 'Aktif' }).a).setValue(aktif);
    return dataResep_();
  });
}

/**
 * Data layar isi Prep List: item aktif (dan bahan resep aktif) dengan stock
 * tercatat pada tanggal itu, resep aktif, prep yang sudah tercatat, dan tanda
 * nihil. Disimpan di HP supaya form bisa dibuka tanpa sinyal.
 */
function dataFormPrep_(tanggal) {
  var zona = zonaSheet_();
  var master = bacaItem_();
  var resep = bacaResep_();
  var rekap = bacaRekap_();
  var dipakai = {};
  var daftarResep = [];
  Object.keys(resep).forEach(function (k) {
    var r = resepAktif_(resep, k);
    if (!r || !master[k] || !master[k].aktif) return;
    daftarResep.push({
      item: master[k].nama,
      hasil: r.hasil,
      masaSimpan: r.masaSimpan,
      bahan: r.bahan.map(function (b) {
        var mb = master[b.item.toLowerCase()];
        dipakai[b.item.toLowerCase()] = true;
        return { item: mb ? mb.nama : b.item, qty: b.qty };
      })
    });
  });
  var item = Object.keys(master).filter(function (k) { return master[k].aktif || dipakai[k]; }).map(function (k) {
    var m = master[k];
    return { nama: m.nama, kategori: m.kategori, satuan: m.satuan, aktif: m.aktif, stock: posisiStock_(rekap.item[k], tanggal).akhir };
  }).sort(function (a, b) { return a.nama.localeCompare(b.nama, 'id'); });
  var kiriman = bacaBarisTanggal_('Data_Prep', tanggal, zona,
    ['submission_id', 'Item / Menu Prep', 'Jumlah Resep', 'Hasil per 1 Resep', 'Hasil', 'Hasil Aktual', 'Qty', 'Satuan', 'Baik Sampai']);
  var sid = {};
  var baris = kiriman.map(function (b) {
    sid[b.submission_id] = true;
    var per1 = angkaAtauNull_(b['Hasil per 1 Resep']);
    var jr = angkaAtauNull_(b['Jumlah Resep']);
    return {
      item: rapikanTeks_(b['Item / Menu Prep']),
      jumlahResep: jr,
      hasil: angkaAtauNull_(b['Hasil']),
      // Hasil aktual (Code.gs v0.24): hasil = hasil aktual jika diisi; hasilStandar = jumlah resep × hasil per resep.
      hasilAktual: angkaAtauNull_(b['Hasil Aktual']),
      hasilStandar: per1 != null && jr != null ? bulat_(jr * per1) : null,
      qty: angkaAtauNull_(b['Qty']),
      satuan: rapikanTeks_(b['Satuan']),
      baikSampai: teksTanggal_(b['Baik Sampai'], zona),
      oleh: b.oleh,
      waktu: b.waktu ? b.waktu.toISOString() : null
    };
  }).sort(function (a, b) { return String(a.waktu).localeCompare(String(b.waktu)); });
  var nihil = bacaBarisTanggal_('Data_Nihil', tanggal, zona, ['ID Form']).filter(function (n) {
    return rapikanTeks_(n['ID Form']).toUpperCase() === 'PREP';
  });
  return {
    tanggal: tanggal,
    shift: SHIFT,
    item: item,
    resep: daftarResep.sort(function (a, b) { return a.item.localeCompare(b.item, 'id'); }),
    kiriman: { jumlah: Object.keys(sid).length, terakhir: barisTerakhir_(kiriman), baris: baris },
    nihil: kiriman.length ? null : barisTerakhir_(nihil),
    hasilAktualSiap: hasilAktualSiap_()
  };
}

/** Hasil aktual bisa dicatat: kolom Hasil Aktual di Data_Prep sudah dibuat setupSpreadsheet (Code.gs v0.24). */
function hasilAktualSiap_() {
  var t = bacaTabel_('Data_Prep');
  return !!t && t.kol['Hasil Aktual'] !== undefined;
}

function aksiFormPrep_(body) {
  if (!tanggalSah_(body.tanggal)) throw galatPengguna_('Tanggal tidak terbaca. Pilih tanggal lagi.');
  return dataFormPrep_(body.tanggal);
}

/**
 * Kiriman Prep List (Bagian 5.3). Untuk item yang punya resep aktif: Hasil =
 * Jumlah Resep × Hasil per 1 Resep dan Baik Sampai = tanggal + masa simpan,
 * memakai resep yang berlaku saat kiriman diterima server; bahan yang
 * terpakai disalin per baris ke Data_PrepBahan (prep_row_id menunjuk baris
 * Data_Prep). Lalu rekap Stock_Harian item hasil (Hasil Prep) dan tiap bahan
 * (Dipakai Prep) dihitung ulang mulai tanggal itu (dibuat jika belum ada).
 * Item tanpa resep dicatat dengan Qty dan tidak menggerakkan stock. Stock
 * bahan yang menjadi minus tidak menolak kiriman; jawabannya memuat
 * peringatan. Kiriman yang sudah pernah masuk dijawab sudahTerkirim: true.
 */
function aksiKirimPrep_(body, pengguna) {
  var tanggal = periksaTanggalIsian_(body.tanggal, pengguna);
  var konteks = konteksKiriman_(body, pengguna);
  var shift = String(body.shift || '');
  if (SHIFT.indexOf(shift) < 0) throw galatPengguna_('Pilih shift: Pagi, Siang, atau Malam.');
  var masukan = Array.isArray(body.baris) ? body.baris : [];
  if (masukan.length > 100) throw galatPengguna_('Isian terlalu banyak untuk satu kiriman.');
  var kosong = function (v) { return v === '' || v == null; };

  return denganKunci_(function () {
    var tabel = wajibTabel_('Data_Prep');
    var tabelBahan = wajibTabel_('Data_PrepBahan');
    if (masukan.some(function (b) { return b && !kosong(b.hasilAktual); }) && !hasilAktualSiap_()) {
      throw galatPengguna_('Hasil aktual belum bisa dicatat. Minta pemilik Sheet menjalankan ulang setupSpreadsheet.');
    }
    if (adaSubmission_(tabel, konteks.sid)) {
      return { sudahTerkirim: true, jumlah: 0, form: dataFormPrep_(tanggal), baikSampai: [], peringatan: [] };
    }
    var master = bacaItem_();
    var resep = bacaResep_();
    var baru = [];
    var bahanBaru = [];
    var gerak = [];
    var baikSampai = [];
    var bahanKecil = {};
    masukan.forEach(function (b) {
      var m = master[rapikanTeks_(b && b.item).toLowerCase()];
      if (!m) throw galatPengguna_('Item ' + rapikanTeks_(b && b.item) + ' tidak ada di daftar item. Muat ulang form.');
      var r = resepAktif_(resep, m.nama.toLowerCase());
      var sistem = isiSistem_(konteks);
      var isi = {
        'Tanggal': tanggalSel_(tanggal),
        'Shift': shift,
        'Nama Staff': pengguna.nama,
        'Item / Menu Prep': m.nama,
        'Satuan': m.satuan,
        'Keterangan': teksAman_(rapikanTeks_(b.keterangan).slice(0, 200))
      };
      if (r) {
        if (kosong(b.jumlahResep)) {
          throw galatPengguna_(kosong(b.qty) ? 'Isi jumlah resep untuk ' + m.nama + '.'
            : m.nama + ' sekarang punya resep. Isi jumlah resep untuk ' + m.nama + ', lalu kirim lagi.');
        }
        var jr = angkaIsian_(b.jumlahResep, 'Jumlah resep ' + m.nama);
        if (!jr) throw galatPengguna_('Isi jumlah resep untuk ' + m.nama + '.');
        isi['Jumlah Resep'] = jr;
        isi['Hasil per 1 Resep'] = r.hasil;
        // Hasil aktual (tidak wajib): yang benar-benar jadi; jika diisi, itulah yang menambah stock.
        var aktual = angkaOpsional_(b.hasilAktual, 'Hasil aktual ' + m.nama, 3);
        if (tabel.kol['Hasil Aktual'] !== undefined) isi['Hasil Aktual'] = aktual == null ? '' : aktual;
        isi['Hasil'] = aktual == null ? bulat_(jr * r.hasil) : aktual;
        isi['Qty'] = '';
        isi['Baik Sampai'] = r.masaSimpan == null ? '' : tanggalSel_(geserTanggal_(tanggal, r.masaSimpan));
        if (r.masaSimpan != null) baikSampai.push({ item: m.nama, tanggal: geserTanggal_(tanggal, r.masaSimpan) });
        gerak.push({ item: m.nama, dari: tanggal });
        r.bahan.forEach(function (x) {
          var mb = master[x.item.toLowerCase()];
          var namaBahan = mb ? mb.nama : x.item;
          bahanKecil[namaBahan.toLowerCase()] = namaBahan;
          gerak.push({ item: namaBahan, dari: tanggal });
          bahanBaru.push(gabung_(gabung_({
            'Tanggal': tanggalSel_(tanggal),
            'Item Hasil': m.nama,
            'Item Bahan': namaBahan,
            'Jumlah Resep': jr,
            'Qty per 1 Resep': x.qty,
            'Qty Terpakai': bulat_(jr * x.qty),
            'Satuan': mb ? mb.satuan : ''
          }, isiSistem_(konteks)), { prep_row_id: sistem.row_id }));
        });
      } else {
        if (kosong(b.qty) && !kosong(b.jumlahResep)) {
          throw galatPengguna_(m.nama + ' tidak punya resep aktif. Isi Qty untuk ' + m.nama + ', lalu kirim lagi.');
        }
        var qty = angkaIsian_(b.qty, 'Qty ' + m.nama);
        if (!qty) throw galatPengguna_('Isi Qty ' + m.nama + ' lebih dari 0.');
        isi['Jumlah Resep'] = '';
        isi['Hasil per 1 Resep'] = '';
        isi['Hasil'] = '';
        isi['Qty'] = qty;
        isi['Baik Sampai'] = '';
      }
      baru.push(gabung_(isi, sistem));
    });
    if (!baru.length) throw galatPengguna_('Tambah minimal satu item prep.');

    tambahBarisTabel_(tabel, baru);
    urutkanTabel_(tabel, URUTAN_PREP);
    if (bahanBaru.length) {
      tambahBarisTabel_(tabelBahan, bahanBaru);
      urutkanTabel_(tabelBahan, URUTAN_PREP_BAHAN);
    }
    hitungUlangStock_(gerak);
    // Stock bahan tidak cukup menurut catatan: kiriman tetap masuk, Stock Akhir menjadi minus.
    var rekap = bacaRekap_();
    var peringatan = [];
    Object.keys(bahanKecil).sort().forEach(function (k) {
      var akhir = posisiStock_(rekap.item[k], tanggal).akhir;
      if (akhir < 0) peringatan.push({ item: bahanKecil[k], akhir: akhir, satuan: master[k] ? master[k].satuan : '' });
    });
    return { sudahTerkirim: false, jumlah: baru.length, form: dataFormPrep_(tanggal), baikSampai: baikSampai, peringatan: peringatan };
  });
}

/**
 * Masa simpan barang jadi (Bagian 5.3) dan barang masuk (Bagian 5.1, Code.gs
 * v0.25). Sistem tidak melacak wadah: yang datang atau dibuat lebih dulu
 * dianggap dipakai lebih dulu, jadi stock tersisa pada tanggal itu dianggap
 * berasal dari prep dan barang masuk paling baru. Bagian stock yang berasal
 * dari catatan dengan Baik Sampai sebelum tanggal itu masuk "Lewat masa
 * simpan"; yang Baik Sampai-nya tanggal itu (besok sudah tidak baik) masuk
 * "Habis besok". Catatan tanpa Baik Sampai (resep atau item tanpa masa
 * simpan) ikut dihitung sebagai stock tersisa. Per item satu baris: { item,
 * satuan, qty, baikSampai } (baikSampai: yang terbaru di antara bagian itu).
 */
function masaSimpan_(tanggal) {
  var hasil = { lewat: [], habisBesok: [] };
  var zona = zonaSheet_();
  var perItem = {};
  var adaMasa = {};
  [['Data_Prep', 'Item / Menu Prep', 'Hasil'], ['Data_Stock', 'Nama Item', 'Stock Masuk']].forEach(function (s) {
    var t = bacaTabel_(s[0]);
    if (!t || t.kol['Baik Sampai'] === undefined) return;
    t.baris.forEach(function (b) {
      var tg = teksTanggal_(nilai_(t, b, 'Tanggal'), zona);
      var jumlah = Number(nilai_(t, b, s[2])) || 0;
      var nama = rapikanTeks_(nilai_(t, b, s[1]));
      if (!tg || tg > tanggal || jumlah <= 0 || !nama) return;
      var k = nama.toLowerCase();
      var bs = teksTanggal_(nilai_(t, b, 'Baik Sampai'), zona);
      if (bs) adaMasa[k] = true;
      var w = nilai_(t, b, 'timestamp_server');
      (perItem[k] = perItem[k] || []).push({ tanggal: tg, waktu: w instanceof Date ? w.getTime() : 0, hasil: jumlah, baikSampai: bs,
        nama: nama, satuan: rapikanTeks_(nilai_(t, b, 'Satuan')) });
    });
  });
  var kunci = Object.keys(adaMasa);
  if (!kunci.length) return hasil;
  var rekap = bacaRekap_();
  var master = bacaItem_();
  kunci.sort().forEach(function (k) {
    var sisa = posisiStock_(rekap.item[k], tanggal).akhir;
    if (!(sisa > 0)) return;
    var lewat = { qty: 0, baikSampai: '' };
    var besok = { qty: 0, baikSampai: '' };
    perItem[k].sort(function (a, b) {
      return a.tanggal !== b.tanggal ? (a.tanggal < b.tanggal ? 1 : -1) : b.waktu - a.waktu;
    }).forEach(function (p) {
      if (sisa <= 0) return;
      var bagian = Math.min(sisa, p.hasil);
      sisa = bulat_(sisa - bagian);
      if (!p.baikSampai || p.baikSampai > tanggal) return;
      var tujuan = p.baikSampai < tanggal ? lewat : besok;
      tujuan.qty = bulat_(tujuan.qty + bagian);
      if (p.baikSampai > tujuan.baikSampai) tujuan.baikSampai = p.baikSampai;
    });
    var m = master[k] || { nama: perItem[k][0].nama, satuan: perItem[k][0].satuan };
    if (lewat.qty > 0) hasil.lewat.push({ item: m.nama, satuan: m.satuan, qty: lewat.qty, baikSampai: lewat.baikSampai });
    if (besok.qty > 0) hasil.habisBesok.push({ item: m.nama, satuan: m.satuan, qty: besok.qty, baikSampai: besok.baikSampai });
  });
  var urut = function (a, b) { return a.item.localeCompare(b.item, 'id'); };
  hasil.lewat.sort(urut);
  hasil.habisBesok.sort(urut);
  return hasil;
}

/**
 * Riwayat Prep: rincian bahan tiap baris dari Data_PrepBahan (salinan resep
 * saat prep dibuat). minus: Stock Akhir bahan itu pada tanggal prep minus.
 */
function rincianPrep_(kiriman) {
  var t = bacaTabel_('Data_PrepBahan');
  if (!t || !kiriman.length) return;
  var perBaris = {};
  t.baris.forEach(function (b) {
    var id = String(nilai_(t, b, 'prep_row_id') || '');
    if (!id) return;
    (perBaris[id] = perBaris[id] || []).push({
      item: rapikanTeks_(nilai_(t, b, 'Item Bahan')),
      qty: Number(nilai_(t, b, 'Qty Terpakai')) || 0,
      satuan: rapikanTeks_(nilai_(t, b, 'Satuan'))
    });
  });
  var rekap = null;
  kiriman.forEach(function (k) {
    k.baris.forEach(function (b) {
      var daftar = perBaris[b.rowId];
      if (!daftar) return;
      rekap = rekap || bacaRekap_();
      b.rincian = daftar.map(function (x) {
        var r = (rekap.item[x.item.toLowerCase()] || []).filter(function (y) { return y.tanggal === k.tanggal; })[0];
        return { item: x.item, qty: x.qty, satuan: x.satuan, minus: !!(r && r.akhir < 0) };
      });
    });
  });
}

/**
 * Koreksi Jumlah Resep (Bagian 6.3): baris Data_PrepBahan prep itu dihitung
 * ulang dengan Qty per 1 Resep yang tersalin saat prep dibuat (bukan resep
 * sekarang), tercatat di Log_Perubahan, lalu stock item hasil dan semua bahan
 * dihitung ulang mulai tanggal prep.
 */
function setelahKoreksiPrep_(baris, pengguna, kini) {
  var n = baris.nilai;
  var minta = [{ item: n['Item / Menu Prep'], dari: baris.tanggal }];
  if (n['Hasil per 1 Resep'] !== '' && n['Hasil per 1 Resep'] != null) {
    var t = wajibTabel_('Data_PrepBahan');
    var jr = Number(n['Jumlah Resep']) || 0;
    var rowId = String(n.row_id || '');
    t.baris.forEach(function (b, i) {
      if (!rowId || String(nilai_(t, b, 'prep_row_id') || '') !== rowId) return;
      var c = { t: t, b: b, nomor: i + 2 };
      var per1 = Number(nilai_(t, b, 'Qty per 1 Resep')) || 0;
      var lamaJr = nilai_(t, b, 'Jumlah Resep');
      var lamaQ = nilai_(t, b, 'Qty Terpakai');
      var baruQ = bulat_(jr * per1);
      var perubahan = [];
      if (Number(lamaJr) !== jr) perubahan.push(['Jumlah Resep', lamaJr, jr]);
      if (Number(lamaQ) !== baruQ) perubahan.push(['Qty Terpakai', lamaQ, baruQ]);
      minta.push({ item: nilai_(t, b, 'Item Bahan'), dari: baris.tanggal });
      if (!perubahan.length) return;
      tulisSel_(c, { 'Jumlah Resep': jr, 'Qty Terpakai': baruQ, updated_by: pengguna.nama, updated_at: kini });
      catatLog_('Data_PrepBahan', String(nilai_(t, b, 'row_id')), pengguna, kini, perubahan);
    });
  }
  hitungUlangStock_(minta);
}

/* =========================================================================
 * Tahap 7: pengelolaan master (spesifikasi sistem Bagian 5.1, tampilan
 * Bagian 5.7): Item, Unit, Kategori dan satuan, Outlet dan jadwal
 * ========================================================================= */

var PANJANG_ITEM_MAKS = 60;
var PANJANG_MASTER_MAKS = 40; // nama kategori dan unit
var PANJANG_SATUAN_MAKS = 20;
var JENIS_SATUAN = ['Berat', 'Isi', 'Hitungan', 'Kemasan'];
var TIPE_UNIT = ['Chiller', 'Freezer'];
var JADWAL_OPNAME = ['mingguan', 'bulanan'];
var JEDA_LAPORAN_MAKS = 240;
var KETERANGAN_PASANG_TRIGGER = 'Diisi otomatis. "Perlu dijalankan" setelah jam closing, jeda laporan, hari cadangan, atau zona waktu ' +
  'diubah dari Pengaturan; pemilik Sheet lalu menjalankan pasangTrigger di editor Apps Script.';

/** Nomor baris pertama di tab master yang kolom kuncinya sama dengan nama (huruf besar/kecil tidak dibedakan); 0 jika tidak ada. */
function barisMaster_(t, judulKunci, nama) {
  var kecil = rapikanTeks_(nama).toLowerCase();
  if (!kecil) return 0;
  for (var i = 0; i < t.baris.length; i++) {
    if (rapikanTeks_(nilai_(t, t.baris[i], judulKunci)).toLowerCase() === kecil) return i + 2;
  }
  return 0;
}

/** Menulis beberapa sel di satu baris tab master: isi { judul: nilai }. */
function tulisBarisMaster_(t, nomor, isi) {
  Object.keys(isi).forEach(function (judul) {
    var i = t.kol[judul];
    if (i === undefined) {
      throw galatPengguna_('Kolom ' + judul + ' tidak ada di tab ' + t.nama + '. Jalankan ulang setupSpreadsheet di editor Apps Script.');
    }
    t.sheet.getRange(nomor, i + 1).setValue(isi[judul]);
  });
}

/**
 * Baris baru di tab master (butir 79): tab dirapikan dulu, lalu baris ditulis
 * tepat di bawah baris terakhir yang kolom kuncinya terisi. Dipanggil di dalam kunci.
 */
function tambahBarisMaster_(nama, isi) {
  var t = wajibTabel_(nama);
  var kolKunci = t.kol[KUNCI_MASTER[nama]];
  if (kolKunci === undefined) {
    throw galatPengguna_('Kolom ' + KUNCI_MASTER[nama] + ' tidak ada di tab ' + nama + '. Jalankan ulang setupSpreadsheet di editor Apps Script.');
  }
  rapikanTabMaster_(t.sheet, kolKunci + 1);
  var baris = susunBaris_(t, isi);
  t.sheet.getRange(barisBaruMaster_(t.sheet, kolKunci + 1, 1), 1, 1, t.judul.length).setValues([baris]);
}

/** Angka opsional dari Pengaturan: kosong → null; boleh "2,5"; tidak boleh minus. desimal: angka di belakang koma yang disimpan. */
function angkaOpsional_(nilai, label, desimal) {
  if (nilai === '' || nilai == null) return null;
  var n = typeof nilai === 'number' ? nilai : Number(String(nilai).trim().replace(',', '.'));
  if (String(nilai).trim() === '' || !isFinite(n) || n < 0) throw galatPengguna_(label + ' harus angka 0 atau lebih, misalnya 2,5, atau dikosongkan.');
  if (n > 1e9) throw galatPengguna_(label + ' terlalu besar. Periksa angkanya.');
  var f = Math.pow(10, desimal);
  return Math.round(n * f) / f;
}

/**
 * Nama yang dipilih dari daftar master (kategori, satuan). Mengembalikan
 * tulisan di master. Pilihan yang nonaktif hanya boleh jika sama dengan nilai
 * lama (tidak berubah).
 */
function pilihMaster_(daftar, kunci, nilai, nilaiLama, label) {
  var kecil = rapikanTeks_(nilai).toLowerCase();
  var x = null;
  daftar.forEach(function (d) { if (!x && d[kunci].toLowerCase() === kecil) x = d; });
  if (!kecil || !x) throw galatPengguna_('Pilih ' + label + ' dari daftar.');
  if (!x.aktif && kecil !== rapikanTeks_(nilaiLama).toLowerCase()) {
    throw galatPengguna_(label.charAt(0).toUpperCase() + label.slice(1) + ' ' + x[kunci] + ' nonaktif. Pilih ' + label + ' yang aktif.');
  }
  return x[kunci];
}

/** Semua kategori di M_Kategori (aktif dan nonaktif): [{ nama, urutan, aktif }], urut menurut Urutan lalu nama. */
function bacaSemuaKategori_() {
  var t = wajibTabel_('M_Kategori');
  var daftar = [];
  var sudah = {};
  t.baris.forEach(function (b) {
    var nama = rapikanTeks_(nilai_(t, b, 'Nama Kategori'));
    if (!nama || sudah[nama.toLowerCase()]) return;
    sudah[nama.toLowerCase()] = true;
    daftar.push({ nama: nama, urutan: angkaAtauNull_(nilai_(t, b, 'Urutan')), aktif: benar_(nilai_(t, b, 'Aktif')) });
  });
  return daftar.sort(function (a, b) {
    var ua = a.urutan == null ? 1e9 : a.urutan;
    var ub = b.urutan == null ? 1e9 : b.urutan;
    return ua - ub || a.nama.localeCompare(b.nama, 'id');
  });
}

/** M_Satuan: [{ satuan, jenis, aktif }] menurut urutan di Sheet (nama ganda dilewati). */
function bacaSatuan_() {
  var t = wajibTabel_('M_Satuan');
  var hasil = [];
  var sudah = {};
  t.baris.forEach(function (b) {
    var s = rapikanTeks_(nilai_(t, b, 'Satuan'));
    if (!s || sudah[s.toLowerCase()]) return;
    sudah[s.toLowerCase()] = true;
    hasil.push({ satuan: s, jenis: rapikanTeks_(nilai_(t, b, 'Jenis')), aktif: benar_(nilai_(t, b, 'Aktif')) });
  });
  return hasil;
}

/** Nama (huruf kecil) yang tercatat di satu kolom sebuah tab. Tab atau kolom yang belum ada dianggap kosong. */
function namaDiKolom_(namaTab, judul, hasil) {
  var sheet = ss_().getSheetByName(namaTab);
  if (!sheet || sheet.getLastRow() < 2) return hasil;
  var c = posisiKolomOpsional_(sheet, judul);
  if (!c) return hasil;
  sheet.getRange(2, c, sheet.getLastRow() - 1, 1).getValues().forEach(function (r) {
    var n = rapikanTeks_(r[0]).toLowerCase();
    if (n) hasil[n] = true;
  });
  return hasil;
}

/**
 * Item yang sudah punya catatan stock (Bagian 5.1): rekap Stock_Harian, semua
 * sumber gerakan (termasuk prep tanpa resep di Data_Prep), dan Data_Opname.
 */
function itemBercatatan_() {
  var hasil = {};
  namaDiKolom_('Stock_Harian', 'Nama Item', hasil);
  SUMBER_STOCK.forEach(function (s) { namaDiKolom_(s.tab, s.item, hasil); });
  namaDiKolom_('Data_Opname', 'Nama Item', hasil);
  return hasil;
}

/* ---------- Pengaturan → Item ---------- */

/**
 * Jawaban Pengaturan → Item: semua item (aktif dan nonaktif) dengan stock
 * tercatat hari ini, apakah sudah punya catatan stock (satuan dasar terkunci),
 * apakah namanya masih bisa diganti, dan resep aktif yang memakainya; daftar
 * kategori dan satuan untuk pilihan.
 */
function dataItem_() {
  var master = bacaItem_();
  var resep = bacaResep_();
  var rekap = bacaRekap_();
  var catatan = itemBercatatan_();
  var hari = hariIni_();
  var menu = bacaMenu_().menu;
  var rujukan = rujukanItem_(catatan, resep, menu);
  var dipakai = {};
  var diResep = {};
  var diMenu = {};
  Object.keys(menu).forEach(function (k) {
    menu[k].bahan.forEach(function (b) { diMenu[b.item.toLowerCase()] = true; });
  });
  Object.keys(resep).forEach(function (k) {
    var r = resep[k];
    diResep[k] = true;
    r.bahan.forEach(function (b) {
      var kb = b.item.toLowerCase();
      diResep[kb] = true;
      if (r.aktif) (dipakai[kb] = dipakai[kb] || []).push(r.itemHasil);
    });
  });
  var item = Object.keys(master).map(function (k) {
    var m = master[k];
    var h = infoHargaItem_(m, hari);
    return {
      nama: m.nama,
      kategori: m.kategori,
      satuan: m.satuan,
      satuanBesar: m.satuanBesar,
      isiSatuanBesar: m.isiSatuanBesar,
      harga: h.harga,
      hargaSejak: h.hargaSejak,
      riwayatHarga: h.riwayatHarga,
      jumlahRiwayatHarga: h.jumlahRiwayatHarga,
      stokMin: m.stokMin,
      stokMaks: m.stokMaks,
      masaSimpan: m.masaSimpan,
      aktif: m.aktif,
      stock: posisiStock_(rekap.item[k], hari).akhir,
      punyaCatatan: !!catatan[k],
      bisaGantiNama: !catatan[k] && !diResep[k] && !diMenu[k],
      resepAktif: !!(resep[k] && resep[k].aktif),
      dipakaiResep: (dipakai[k] || []).sort(function (a, b) { return a.localeCompare(b, 'id'); }),
      dipakaiMenu: menuPemakai_(menu, k),
      sebabTidakBisaHapus: sebabTidakBisaHapus_(rujukan, k, m.nama)
    };
  }).sort(function (a, b) { return a.nama.localeCompare(b.nama, 'id'); });
  return {
    hariIni: hari,
    riwayatHargaSiap: bacaRiwayatHarga_().ada,
    masaSimpanSiap: masaSimpanItemSiap_(),
    item: item,
    kategori: bacaSemuaKategori_().map(function (k) { return { nama: k.nama, aktif: k.aktif }; }),
    satuan: bacaSatuan_()
  };
}

function aksiDaftarItem_() {
  return dataItem_();
}

/**
 * Tambah atau ubah item (Bagian 5.1). body: { baru, namaLama, nama, kategori,
 * satuan, satuanBesar, isiSatuanBesar, harga, stokMin, stokMaks }.
 * - Nama unik. Nama hanya bisa diganti selama item belum punya catatan stock
 *   dan belum dipakai resep (catatan lama menyimpan nama sebagai teks);
 *   mengganti huruf besar/kecil saja selalu boleh.
 * - Satuan dasar tidak bisa diganti setelah item punya catatan stock.
 * - Satuan besar opsional: berbeda dari satuan dasar, isinya lebih dari 0.
 *   Mengubah isinya tidak mengubah catatan lama.
 * - Item baru langsung aktif; stock-nya nol sampai stok pembuka diisi.
 * - Harga (riwayat harga, Bagian 5.1): hanya untuk item yang belum punya harga
 *   (item baru, atau item lama tanpa harga). Harga pertama ini berlaku sejak
 *   awal dan ditulis ke M_Item dan M_HargaItem. Item yang sudah punya harga
 *   mengganti harganya lewat aksi gantiHarga; harga yang dikirim di sini
 *   diabaikan jika sama dengan harga sekarang atau kosong, dan ditolak jika
 *   berbeda. Mengganti nama ikut mengganti nama di M_HargaItem.
 * - masaSimpan (Code.gs v0.25): hari, '' = tanpa masa simpan. Tidak dikirim
 *   (aplikasi lama) → tidak diubah.
 */
function aksiSimpanItem_(body, pengguna) {
  var nama = periksaNama_(body.nama, 'Nama item', PANJANG_ITEM_MAKS);
  var adaMasa = Object.prototype.hasOwnProperty.call(body, 'masaSimpan');
  var masa = adaMasa ? masaSimpanIsian_(body.masaSimpan) : null;
  var harga = angkaOpsional_(body.harga, 'Harga satuan', 2);
  var stokMin = angkaOpsional_(body.stokMin, 'Stok minimum', 3);
  var stokMaks = angkaOpsional_(body.stokMaks, 'Stok maksimum', 3);
  if (stokMin != null && stokMaks != null && stokMaks < stokMin) {
    throw galatPengguna_('Stok maksimum harus sama dengan atau lebih besar dari stok minimum.');
  }
  var besarDiketik = rapikanTeks_(body.satuanBesar);
  var isi = besarDiketik ? angkaOpsional_(body.isiSatuanBesar, 'Isi satuan besar', 3) : null;

  return denganKunci_(function () {
    var t = wajibTabel_('M_Item');
    var master = bacaItem_();
    var lama = null;
    if (!body.baru) {
      lama = master[rapikanTeks_(body.namaLama).toLowerCase()] || null;
      if (!lama) throw galatPengguna_('Item ' + rapikanTeks_(body.namaLama) + ' tidak ditemukan. Kembali ke daftar item.');
    }
    var ada = master[nama.toLowerCase()];
    if (ada && ada !== lama) {
      throw galatPengguna_('Item ' + ada.nama + ' sudah ada' + (ada.aktif ? '' : ' tetapi nonaktif') + '. ' +
        (ada.aktif ? 'Pakai nama lain.' : 'Buka ' + ada.nama + ' di daftar item untuk mengaktifkannya lagi.'));
    }
    var catatan = lama ? itemBercatatan_()[lama.nama.toLowerCase()] : false;
    if (lama && nama.toLowerCase() !== lama.nama.toLowerCase()) {
      var resep = bacaResep_();
      var diResep = !!resep[lama.nama.toLowerCase()] || Object.keys(resep).some(function (k) {
        return resep[k].bahan.some(function (b) { return b.item.toLowerCase() === lama.nama.toLowerCase(); });
      });
      var menuLama = bacaMenu_().menu;
      var diMenu = Object.keys(menuLama).some(function (k) {
        return menuLama[k].bahan.some(function (b) { return b.item.toLowerCase() === lama.nama.toLowerCase(); });
      });
      if (catatan || diResep || diMenu) {
        throw galatPengguna_('Nama ' + lama.nama + ' tidak bisa diganti karena item ini sudah ' +
          (catatan ? 'punya catatan stock' : diResep ? 'dipakai resep' : 'dipakai menu') + '. Catatan lama menyimpan nama ini.');
      }
    }
    var kategori = pilihMaster_(bacaSemuaKategori_(), 'nama', body.kategori, lama && lama.kategori, 'kategori');
    var daftarSatuan = bacaSatuan_();
    var satuan = pilihMaster_(daftarSatuan, 'satuan', body.satuan, lama && lama.satuan, 'satuan');
    if (lama && catatan && satuan.toLowerCase() !== lama.satuan.toLowerCase()) {
      throw galatPengguna_('Satuan dasar ' + lama.nama + ' tidak bisa diganti karena item ini sudah punya catatan stock. ' +
        'Jika satuannya memang berbeda, buat item baru.');
    }
    var besar = '';
    if (besarDiketik) {
      besar = pilihMaster_(daftarSatuan, 'satuan', besarDiketik, lama && lama.satuanBesar, 'satuan besar');
      if (besar.toLowerCase() === satuan.toLowerCase()) throw galatPengguna_('Satuan besar harus berbeda dari satuan dasar.');
      if (!(isi > 0)) throw galatPengguna_('Isi berapa ' + satuan + ' dalam 1 ' + besar + ', lebih dari 0.');
    }
    var riwayatLama = lama ? (bacaRiwayatHarga_().item[lama.nama.toLowerCase()] || []) : [];
    var punyaHarga = !!lama && (riwayatLama.length > 0 || lama.harga != null);
    var hargaAwal = !punyaHarga && harga != null;
    if (punyaHarga && harga != null && harga !== hargaPada_(lama, hariIni_())) {
      throw galatPengguna_('Harga ' + lama.nama + ' diganti lewat tombol Ganti harga, supaya harga lamanya tetap tercatat. ' +
        'Muat ulang aplikasi jika tombolnya belum ada.');
    }
    if (hargaAwal && !bacaRiwayatHarga_().ada) {
      throw galatPengguna_('Tab ' + TAB_HARGA + ' belum ada. Minta pemilik Sheet menjalankan ulang setupSpreadsheet.');
    }
    var nilai = {
      'Nama Item': nama,
      'Kategori': kategori,
      'Satuan': satuan,
      'Satuan Besar': besar,
      'Isi per Satuan Besar': besar ? isi : '',
      'Stok Minimum': stokMin == null ? '' : stokMin,
      'Stok Maksimum': stokMaks == null ? '' : stokMaks
    };
    if (!punyaHarga) nilai['Harga Satuan (Rp)'] = harga == null ? '' : harga;
    if (adaMasa) {
      if (t.kol['Masa Simpan (hari)'] !== undefined) nilai['Masa Simpan (hari)'] = masa == null ? '' : masa;
      else if (masa != null) throw galatPengguna_('Masa simpan item belum bisa dicatat. Minta pemilik Sheet menjalankan ulang setupSpreadsheet.');
    }
    if (lama) {
      tulisBarisMaster_(t, barisMaster_(t, 'Nama Item', lama.nama), nilai);
      if (nama !== lama.nama && riwayatLama.length) gantiNamaRiwayatHarga_(lama.nama, nama);
      if (nama !== lama.nama) gantiNamaPesanan_('Nama Item', lama.nama, nama);
    } else {
      nilai['Aktif'] = true;
      tambahBarisMaster_('M_Item', nilai);
    }
    if (hargaAwal) tambahBarisHarga_(nama, '', harga, pengguna ? pengguna.nama : OLEH_HARGA_AWAL, new Date());
    var data = dataItem_();
    data.disimpan = nama;
    return data;
  });
}

/**
 * Pengaman item (Bagian 5.1): item yang masih menjadi bahan atau hasil resep
 * aktif tidak bisa dinonaktifkan. Item yang stock-nya belum nol tetap boleh
 * dinonaktifkan; peringatannya tampil di layar sebelum disimpan (stock dari
 * daftarItem). Jawaban: daftarItem ditambah diubah: { nama, aktif }.
 */
function aksiAturItemAktif_(body) {
  var aktif = body.aktif === true;
  return denganKunci_(function () {
    var t = wajibTabel_('M_Item');
    var nomor = barisMaster_(t, 'Nama Item', body.nama);
    if (!nomor) throw galatPengguna_('Item tidak ada di daftar item.');
    var nama = rapikanTeks_(nilai_(t, t.baris[nomor - 2], 'Nama Item'));
    var kecil = nama.toLowerCase();
    if (!aktif) {
      var resep = bacaResep_();
      if (resep[kecil] && resep[kecil].aktif) {
        throw galatPengguna_(nama + ' masih punya resep aktif. Nonaktifkan resepnya dulu.');
      }
      var pemakai = Object.keys(resep).filter(function (k) {
        return resep[k].aktif && resep[k].bahan.some(function (b) { return b.item.toLowerCase() === kecil; });
      }).map(function (k) { return resep[k].itemHasil; });
      if (pemakai.length) {
        throw galatPengguna_(nama + ' masih dipakai resep ' + pemakai.join(', ') + '. Ubah atau nonaktifkan resepnya dulu.');
      }
      var menu = menuPemakai_(bacaMenu_().menu, kecil);
      if (menu.length) {
        throw galatPengguna_('Tidak bisa dinonaktifkan: masih dipakai menu ' + menu.join(', ') + '. Ubah atau nonaktifkan menunya dulu.');
      }
    }
    tulisBarisMaster_(t, nomor, { 'Aktif': aktif });
    var data = dataItem_();
    data.diubah = { nama: nama, aktif: aktif };
    return data;
  });
}

/**
 * Rujukan ke item (untuk hapus item): catatan stock (itemBercatatan_), semua
 * resep dan menu (aktif maupun nonaktif) yang memakai nama itu, dan form
 * kustom (termasuk yang diarsipkan) yang kolom Item-nya pernah berisi nama itu.
 * Kunci: nama item huruf kecil.
 */
function rujukanItem_(catatan, resep, menu) {
  var r = { catatan: catatan, punyaResep: {}, resep: {}, menu: {}, form: {} };
  function tambah(peta, kecil, nama) {
    var d = peta[kecil] = peta[kecil] || [];
    if (d.indexOf(nama) < 0) d.push(nama);
  }
  Object.keys(resep).forEach(function (k) {
    r.punyaResep[k] = true;
    resep[k].bahan.forEach(function (b) { tambah(r.resep, b.item.toLowerCase(), resep[k].itemHasil); });
  });
  Object.keys(menu).forEach(function (k) {
    menu[k].bahan.forEach(function (b) { tambah(r.menu, b.item.toLowerCase(), menu[k].nama); });
  });
  bacaDaftarForm_(true).forEach(function (f) {
    if (f.jenis !== 'kustom') return;
    kolomForm_(f.id).forEach(function (c) {
      if (c.jenis !== 'Item') return;
      var ada = namaDiKolom_(tabDataForm_(f.id), c.label, {});
      Object.keys(ada).forEach(function (kecil) { tambah(r.form, kecil, f.nama); });
    });
  });
  return r;
}

/** Kalimat mengapa item belum bisa dihapus, atau '' jika bisa (selain syarat nonaktif). */
function sebabTidakBisaHapus_(r, kecil, nama) {
  function daftar(d) { return d.slice().sort(function (a, b) { return a.localeCompare(b, 'id'); }).join(', '); }
  if (r.catatan[kecil]) return 'Tidak bisa dihapus karena ' + nama + ' sudah punya catatan stock. Riwayatnya tetap tersimpan selama item nonaktif.';
  if (r.punyaResep[kecil]) return 'Tidak bisa dihapus selama ' + nama + ' punya resep.';
  if (r.resep[kecil]) return 'Tidak bisa dihapus: masih menjadi bahan resep ' + daftar(r.resep[kecil]) + '.';
  if (r.menu[kecil]) return 'Tidak bisa dihapus: masih menjadi bahan menu ' + daftar(r.menu[kecil]) + '.';
  if (r.form[kecil]) return 'Tidak bisa dihapus karena sudah tercatat di form ' + daftar(r.form[kecil]) + '.';
  return '';
}

/**
 * Hapus item (Bagian 5.1), khusus Pengelola: hanya item nonaktif yang belum
 * punya catatan apa pun (sebabTidakBisaHapus_ kosong), misalnya item yang salah
 * dibuat. Baris M_Item dan semua baris M_HargaItem item itu dihapus, dan
 * Log_Perubahan mencatatnya. Nama itu lalu boleh dipakai item baru.
 * Jawaban: daftarItem ditambah dihapus: nama.
 */
function aksiHapusItem_(body, pengguna) {
  return denganKunci_(function () {
    var t = wajibTabel_('M_Item');
    var nomor = barisMaster_(t, 'Nama Item', body.nama);
    if (!nomor) throw galatPengguna_('Item ' + rapikanTeks_(body.nama) + ' tidak ditemukan. Kembali ke daftar item.');
    var m = bacaItem_()[rapikanTeks_(body.nama).toLowerCase()];
    var kecil = m.nama.toLowerCase();
    if (m.aktif) throw galatPengguna_('Nonaktifkan dulu untuk bisa menghapus.');
    var sebab = sebabTidakBisaHapus_(rujukanItem_(itemBercatatan_(), bacaResep_(), bacaMenu_().menu), kecil, m.nama);
    if (sebab) throw galatPengguna_(sebab);
    var th = bacaTabel_(TAB_HARGA);
    if (th) {
      var c = th.kol['Nama Item'];
      th.baris.map(function (b, i) { return rapikanTeks_(b[c]).toLowerCase() === kecil ? i + 2 : 0; })
        .filter(function (n) { return n; })
        .sort(function (a, b) { return b - a; })
        .forEach(function (n) { th.sheet.deleteRow(n); });
      MEMO_HARGA_ = null;
    }
    // Pesanan yang masih menunggu untuk item ini ditutup (Code.gs v0.29); riwayat pesanannya tetap.
    var pes = bacaPesanan_();
    pes.baris.forEach(function (r) {
      if (r.keadaan === KEADAAN_MENUNGGU && r.item.toLowerCase() === kecil) tandaiPesanan_(pes, r, 'Ditutup', pengguna.nama, new Date(), '');
    });
    t.sheet.deleteRow(nomor);
    catatLog_('M_Item', m.nama, pengguna, new Date(), [['Nama Item', m.nama, '(dihapus)']]);
    var data = dataItem_();
    data.dihapus = m.nama;
    return data;
  });
}

/* ---------- Pengaturan → Kategori dan satuan ---------- */

/** Jawaban Pengaturan → Kategori dan satuan: jumlah item (semua dan aktif) yang memakai tiap kategori dan satuan. */
function dataKategoriSatuan_() {
  var master = bacaItem_();
  var kat = {};
  var sat = {};
  function hitung(peta, nama, aktif) {
    var k = String(nama || '').toLowerCase();
    if (!k) return;
    var x = peta[k] = peta[k] || { semua: 0, aktif: 0 };
    x.semua++;
    if (aktif) x.aktif++;
  }
  Object.keys(master).forEach(function (k) {
    var m = master[k];
    hitung(kat, m.kategori, m.aktif);
    hitung(sat, m.satuan, m.aktif);
    if (m.satuanBesar && m.satuanBesar.toLowerCase() !== m.satuan.toLowerCase()) hitung(sat, m.satuanBesar, m.aktif);
  });
  var nol = { semua: 0, aktif: 0 };
  return {
    kategori: bacaSemuaKategori_().map(function (k) {
      var x = kat[k.nama.toLowerCase()] || nol;
      return { nama: k.nama, urutan: k.urutan, aktif: k.aktif, jumlahItem: x.semua, jumlahItemAktif: x.aktif };
    }),
    satuan: bacaSatuan_().map(function (s) {
      var x = sat[s.satuan.toLowerCase()] || nol;
      return { satuan: s.satuan, jenis: s.jenis, aktif: s.aktif, jumlahItem: x.semua, jumlahItemAktif: x.aktif };
    }),
    jenisSatuan: JENIS_SATUAN
  };
}

function aksiDaftarKategoriSatuan_() {
  return dataKategoriSatuan_();
}

/**
 * Tambah atau ganti nama kategori. Kategori baru aktif dan diletakkan paling
 * bawah. Nama hanya bisa diganti selama belum dipakai item (catatan lama
 * menyimpan nama kategori sebagai teks); huruf besar/kecil saja selalu boleh.
 */
function aksiSimpanKategori_(body) {
  var nama = periksaNama_(body.nama, 'Nama kategori', PANJANG_MASTER_MAKS);
  return denganKunci_(function () {
    var t = wajibTabel_('M_Kategori');
    var data = dataKategoriSatuan_();
    var cari = function (n) {
      return data.kategori.filter(function (k) { return k.nama.toLowerCase() === rapikanTeks_(n).toLowerCase(); })[0] || null;
    };
    var lama = body.baru ? null : cari(body.namaLama);
    if (!body.baru && !lama) throw galatPengguna_('Kategori tidak ditemukan. Muat ulang layar ini.');
    var ada = cari(nama);
    if (ada && ada !== lama) throw galatPengguna_('Kategori ' + ada.nama + ' sudah ada' + (ada.aktif ? '.' : ' tetapi nonaktif. Aktifkan lagi dari daftar.'));
    if (lama) {
      if (nama.toLowerCase() !== lama.nama.toLowerCase() && lama.jumlahItem) {
        throw galatPengguna_('Nama ' + lama.nama + ' tidak bisa diganti karena sudah dipakai ' + lama.jumlahItem + ' item.');
      }
      tulisBarisMaster_(t, barisMaster_(t, 'Nama Kategori', lama.nama), { 'Nama Kategori': nama });
    } else {
      var maks = 0;
      data.kategori.forEach(function (k) { if (k.urutan > maks) maks = k.urutan; });
      tambahBarisMaster_('M_Kategori', { 'Nama Kategori': nama, 'Urutan': Math.floor(maks) + 1, 'Aktif': true });
    }
    var hasil = dataKategoriSatuan_();
    hasil.disimpan = nama;
    return hasil;
  });
}

/** Kategori yang masih dipakai item aktif tidak bisa dinonaktifkan (item itu akan hilang dari form Stock). */
function aksiAturKategoriAktif_(body) {
  var aktif = body.aktif === true;
  return denganKunci_(function () {
    var t = wajibTabel_('M_Kategori');
    var k = dataKategoriSatuan_().kategori.filter(function (x) {
      return x.nama.toLowerCase() === rapikanTeks_(body.nama).toLowerCase();
    })[0];
    if (!k) throw galatPengguna_('Kategori tidak ditemukan. Muat ulang layar ini.');
    if (!aktif && k.jumlahItemAktif) {
      throw galatPengguna_('Kategori ' + k.nama + ' masih dipakai ' + k.jumlahItemAktif + ' item aktif. ' +
        'Pindahkan item itu ke kategori lain atau nonaktifkan dulu.');
    }
    tulisBarisMaster_(t, barisMaster_(t, 'Nama Kategori', k.nama), { 'Aktif': aktif });
    return dataKategoriSatuan_();
  });
}

/** Urutan kategori (form Stock, tab Harian, dan PDF tersusun menurut urutan ini). body.urutan: semua nama kategori, urut baru. */
function aksiUrutKategori_(body) {
  var urutan = Array.isArray(body.urutan) ? body.urutan.map(rapikanTeks_) : [];
  return denganKunci_(function () {
    var t = wajibTabel_('M_Kategori');
    var ada = bacaSemuaKategori_();
    var sudah = {};
    urutan.forEach(function (n) { sudah[n.toLowerCase()] = true; });
    var lengkap = urutan.length === ada.length && ada.every(function (k) { return sudah[k.nama.toLowerCase()]; });
    if (!lengkap) throw galatPengguna_('Daftar kategori sudah berubah. Muat ulang layar ini, lalu atur urutannya lagi.');
    urutan.forEach(function (n, i) {
      tulisBarisMaster_(t, barisMaster_(t, 'Nama Kategori', n), { 'Urutan': i + 1 });
    });
    return dataKategoriSatuan_();
  });
}

/** Tambah satuan, atau ubah satuan yang belum dipakai item. Jenis: Berat, Isi, Hitungan, Kemasan. */
function aksiSimpanSatuan_(body) {
  var satuan = periksaNama_(body.satuan, 'Satuan', PANJANG_SATUAN_MAKS);
  var jenis = String(body.jenis || '');
  if (JENIS_SATUAN.indexOf(jenis) < 0) throw galatPengguna_('Pilih jenis satuan: Berat, Isi, Hitungan, atau Kemasan.');
  return denganKunci_(function () {
    var t = wajibTabel_('M_Satuan');
    var data = dataKategoriSatuan_();
    var cari = function (n) {
      return data.satuan.filter(function (s) { return s.satuan.toLowerCase() === rapikanTeks_(n).toLowerCase(); })[0] || null;
    };
    var lama = body.baru ? null : cari(body.satuanLama);
    if (!body.baru && !lama) throw galatPengguna_('Satuan tidak ditemukan. Muat ulang layar ini.');
    var ada = cari(satuan);
    if (ada && ada !== lama) throw galatPengguna_('Satuan ' + ada.satuan + ' sudah ada' + (ada.aktif ? '.' : ' tetapi nonaktif. Aktifkan lagi dari daftar.'));
    if (lama) {
      if (satuan.toLowerCase() !== lama.satuan.toLowerCase() && lama.jumlahItem) {
        throw galatPengguna_('Satuan ' + lama.satuan + ' tidak bisa diganti karena sudah dipakai ' + lama.jumlahItem + ' item.');
      }
      tulisBarisMaster_(t, barisMaster_(t, 'Satuan', lama.satuan), { 'Satuan': satuan, 'Jenis': jenis });
    } else {
      tambahBarisMaster_('M_Satuan', { 'Satuan': satuan, 'Jenis': jenis, 'Aktif': true });
    }
    var hasil = dataKategoriSatuan_();
    hasil.disimpan = satuan;
    return hasil;
  });
}

/** Satuan yang masih dipakai item aktif (sebagai satuan dasar atau satuan besar) tidak bisa dinonaktifkan. */
function aksiAturSatuanAktif_(body) {
  var aktif = body.aktif === true;
  return denganKunci_(function () {
    var t = wajibTabel_('M_Satuan');
    var s = dataKategoriSatuan_().satuan.filter(function (x) {
      return x.satuan.toLowerCase() === rapikanTeks_(body.satuan).toLowerCase();
    })[0];
    if (!s) throw galatPengguna_('Satuan tidak ditemukan. Muat ulang layar ini.');
    if (!aktif && s.jumlahItemAktif) {
      throw galatPengguna_('Satuan ' + s.satuan + ' masih dipakai ' + s.jumlahItemAktif + ' item aktif.');
    }
    tulisBarisMaster_(t, barisMaster_(t, 'Satuan', s.satuan), { 'Aktif': aktif });
    return dataKategoriSatuan_();
  });
}

/* ---------- Pengaturan → Unit chiller dan freezer ---------- */

/** Jawaban Pengaturan → Unit: unit menurut urutan M_Unit, apakah sudah punya catatan suhu, dan batas suhu. */
function dataUnit_() {
  var catatan = namaDiKolom_('Data_Suhu', 'Nama Unit', {});
  return {
    unit: bacaUnit_().map(function (u) {
      return { nama: u.nama, tipe: u.tipe, aktif: u.aktif, punyaCatatan: !!catatan[u.nama.toLowerCase()] };
    }),
    batas: batasSuhu_()
  };
}

function aksiDaftarUnit_() {
  return dataUnit_();
}

/**
 * Tambah atau ubah unit. Unit baru aktif dan diletakkan paling bawah. Nama
 * hanya bisa diganti selama unit belum punya catatan suhu. Tipe boleh diganti;
 * catatan lama tetap menyimpan tipe dan status saat dicatat.
 */
function aksiSimpanUnit_(body) {
  var nama = periksaNama_(body.nama, 'Nama unit', PANJANG_MASTER_MAKS);
  var tipe = String(body.tipe || '');
  if (TIPE_UNIT.indexOf(tipe) < 0) throw galatPengguna_('Pilih tipe unit: Chiller atau Freezer.');
  return denganKunci_(function () {
    var t = wajibTabel_('M_Unit');
    var data = dataUnit_();
    var cari = function (n) {
      return data.unit.filter(function (u) { return u.nama.toLowerCase() === rapikanTeks_(n).toLowerCase(); })[0] || null;
    };
    var lama = body.baru ? null : cari(body.namaLama);
    if (!body.baru && !lama) throw galatPengguna_('Unit tidak ditemukan. Muat ulang layar ini.');
    var ada = cari(nama);
    if (ada && ada !== lama) throw galatPengguna_('Unit ' + ada.nama + ' sudah ada' + (ada.aktif ? '.' : ' tetapi nonaktif. Aktifkan lagi dari daftar.'));
    if (lama) {
      if (nama.toLowerCase() !== lama.nama.toLowerCase() && lama.punyaCatatan) {
        throw galatPengguna_('Nama ' + lama.nama + ' tidak bisa diganti karena unit ini sudah punya catatan suhu.');
      }
      tulisBarisMaster_(t, barisMaster_(t, 'Nama Unit', lama.nama), { 'Nama Unit': nama, 'Tipe': tipe });
    } else {
      tambahBarisMaster_('M_Unit', { 'Nama Unit': nama, 'Tipe': tipe, 'Aktif': true });
    }
    var hasil = dataUnit_();
    hasil.disimpan = nama;
    return hasil;
  });
}

/** Unit nonaktif tidak tampil di form Suhu dan tidak dihitung dalam kelengkapan Suhu. */
function aksiAturUnitAktif_(body) {
  var aktif = body.aktif === true;
  return denganKunci_(function () {
    var t = wajibTabel_('M_Unit');
    var nomor = barisMaster_(t, 'Nama Unit', body.nama);
    if (!nomor) throw galatPengguna_('Unit tidak ditemukan. Muat ulang layar ini.');
    tulisBarisMaster_(t, nomor, { 'Aktif': aktif });
    return dataUnit_();
  });
}

/* ---------- Pengaturan → Pemasok dan harga beli (Code.gs v0.23; spesifikasi sistem Bagian 5.1, 5.2, 9.3) ---------- */

var TAB_PEMASOK = 'M_Pemasok';
var PANJANG_KONTAK_MAKS = 60;
var PANJANG_CATATAN_PEMASOK_MAKS = 120;
var PROP_HARGA_BELI_DITINJAU = 'HARGA_BELI_DITINJAU';
/** Harga beli yang dibandingkan di Dashboard: pembelian terakhir tiap item dalam sekian hari. */
var HARI_HARGA_BELI = 31;

/** M_Pemasok: [{ nama, kontak, catatan, aktif }] menurut urutan di Sheet (nama ganda dilewati); [] jika tab belum ada. */
function bacaPemasok_() {
  var t = bacaTabel_(TAB_PEMASOK);
  var hasil = [];
  if (!t) return hasil;
  var sudah = {};
  t.baris.forEach(function (b) {
    var nama = rapikanTeks_(nilai_(t, b, 'Nama Pemasok'));
    if (!nama || sudah[nama.toLowerCase()]) return;
    sudah[nama.toLowerCase()] = true;
    hasil.push({ nama: nama, kontak: rapikanTeks_(nilai_(t, b, 'Kontak')), catatan: rapikanTeks_(nilai_(t, b, 'Catatan')),
      aktif: benar_(nilai_(t, b, 'Aktif')) });
  });
  return hasil;
}

/**
 * Waktu sebuah catatan dibuat di HP (ms): timestamp_device, tetapi tidak sesudah waktu diterima server (jam HP yang
 * terlalu cepat); tanpa timestamp_device: waktu diterima server.
 */
function waktuHp_(perangkat, ms) {
  var w = perangkat instanceof Date && !isNaN(perangkat.getTime()) ? perangkat.getTime() : 0;
  if (!w) return ms;
  return ms ? Math.min(w, ms) : w;
}

/** Pemasok dan harga beli bisa dicatat: tab M_Pemasok dan kolom Pemasok/Harga Beli di Data_Stock sudah dibuat setupSpreadsheet. */
function pembelianSiap_() {
  var t = bacaTabel_('Data_Stock');
  return !!bacaTabel_(TAB_PEMASOK) && !!t && t.kol['Pemasok'] !== undefined && t.kol['Harga Beli (Rp)'] !== undefined;
}

/**
 * Pembelian = baris Data_Stock dengan Stock Masuk > 0, dari dari sampai sampai: [{ tanggal, item, satuan,
 * masuk, hargaBeli (per satuan dasar, atau null), nilai (masuk × harga beli, dibulatkan; null tanpa harga),
 * pemasok, sid, ms (diterima server), tw (dicatat di HP, atau ms), oleh }].
 */
function bacaPembelian_(dari, sampai) {
  var t = bacaTabel_('Data_Stock');
  var hasil = [];
  if (!t) return hasil;
  var zona = zonaSheet_();
  t.baris.forEach(function (b) {
    var tg = teksTanggal_(nilai_(t, b, 'Tanggal'), zona);
    var masuk = Number(nilai_(t, b, 'Stock Masuk')) || 0;
    if (!tg || tg < dari || tg > sampai || masuk <= 0) return;
    var harga = angkaAtauNull_(nilai_(t, b, 'Harga Beli (Rp)'));
    var w = nilai_(t, b, 'timestamp_server');
    var wp = nilai_(t, b, 'timestamp_device');
    var ms = w instanceof Date && !isNaN(w.getTime()) ? w.getTime() : 0;
    hasil.push({
      tanggal: tg, item: rapikanTeks_(nilai_(t, b, 'Nama Item')), satuan: rapikanTeks_(nilai_(t, b, 'Satuan')), masuk: masuk,
      hargaBeli: harga, nilai: harga == null ? null : Math.round(masuk * harga), pemasok: rapikanTeks_(nilai_(t, b, 'Pemasok')),
      sid: String(nilai_(t, b, 'submission_id') || ''), ms: ms,
      tw: waktuHp_(wp, ms),
      oleh: rapikanTeks_(nilai_(t, b, 'submitted_by'))
    });
  });
  return hasil;
}

/**
 * Ringkasan pembelian per pemasok: { ada (ada pemasok atau harga beli yang dicatat), pemasok: [{ nama ('' = tanpa
 * pemasok), kiriman, item, baris, nilai, tanpaHarga }], total: { kiriman, item, baris, nilai, tanpaHarga } }.
 * Urut nilai terbesar, lalu nama; tanpa pemasok paling bawah. Baris tanpa harga beli tidak ikut nilai.
 */
function ringkasPembelian_(baris) {
  var peta = {};
  var semua = { kiriman: {}, item: {}, baris: 0, nilai: 0, tanpaHarga: 0 };
  var ada = false;
  baris.forEach(function (p) {
    if (p.pemasok || p.hargaBeli != null) ada = true;
    var k = p.pemasok.toLowerCase();
    var x = peta[k] = peta[k] || { nama: p.pemasok, kiriman: {}, item: {}, baris: 0, nilai: 0, tanpaHarga: 0 };
    [x, semua].forEach(function (y) {
      y.kiriman[p.sid] = true;
      y.item[p.item.toLowerCase()] = true;
      y.baris++;
      if (p.nilai == null) y.tanpaHarga++;
      else y.nilai += p.nilai;
    });
  });
  var hitung = function (x) {
    return { nama: x.nama, kiriman: Object.keys(x.kiriman).length, item: Object.keys(x.item).length, baris: x.baris, nilai: x.nilai,
      tanpaHarga: x.tanpaHarga };
  };
  var daftar = Object.keys(peta).map(function (k) { return hitung(peta[k]); }).sort(function (a, b) {
    if (!a.nama !== !b.nama) return a.nama ? -1 : 1;
    return b.nilai - a.nilai || a.nama.localeCompare(b.nama, 'id');
  });
  var total = hitung(semua);
  delete total.nama;
  return { ada: ada, pemasok: daftar, total: total };
}

/**
 * Jawaban Pengaturan → Pemasok: { siap, hariIni, dari (awal bulan), pemasok: [{ nama, kontak, catatan, aktif,
 * punyaCatatan, bulanIni: { kiriman, item, nilai, tanpaHarga } | null }], tanpaPemasok: ringkasan | null }.
 */
function dataPemasok_() {
  var siap = pembelianSiap_();
  var hari = hariIni_();
  var dari = hari.slice(0, 8) + '01';
  var r = ringkasPembelian_(siap ? bacaPembelian_(dari, hari) : []);
  var peta = {};
  r.pemasok.forEach(function (x) { peta[x.nama.toLowerCase()] = x; });
  var catatan = siap ? namaDiKolom_('Data_Stock', 'Pemasok', {}) : {};
  var bulan = function (x) { return x ? { kiriman: x.kiriman, item: x.item, nilai: x.nilai, tanpaHarga: x.tanpaHarga } : null; };
  return {
    siap: siap,
    hariIni: hari,
    dari: dari,
    pemasok: bacaPemasok_().map(function (p) {
      return { nama: p.nama, kontak: p.kontak, catatan: p.catatan, aktif: p.aktif, punyaCatatan: !!catatan[p.nama.toLowerCase()],
        bulanIni: bulan(peta[p.nama.toLowerCase()]) };
    }),
    tanpaPemasok: bulan(peta[''])
  };
}

function aksiDaftarPemasok_() {
  return dataPemasok_();
}

/** Teks bebas pendek untuk master (kontak, catatan): kosong boleh; paling panjang maks huruf. */
function teksMaster_(nilai, label, maks) {
  var teks = rapikanTeks_(nilai);
  if (teks.length > maks) throw galatPengguna_(label + ' paling panjang ' + maks + ' huruf.');
  return teks;
}

/**
 * Tambah atau ubah pemasok. Pemasok baru aktif dan diletakkan paling bawah. Nama hanya bisa
 * diganti selama pemasok itu belum tercatat di barang masuk (Data_Stock).
 */
function aksiSimpanPemasok_(body) {
  var nama = periksaNama_(body.nama, 'Nama pemasok', PANJANG_MASTER_MAKS);
  var kontak = teksMaster_(body.kontak, 'Kontak', PANJANG_KONTAK_MAKS);
  var catatan = teksMaster_(body.catatan, 'Catatan', PANJANG_CATATAN_PEMASOK_MAKS);
  return denganKunci_(function () {
    if (!pembelianSiap_()) throw galatPengguna_('Tab ' + TAB_PEMASOK + ' belum ada. Minta pemilik Sheet menjalankan ulang setupSpreadsheet.');
    var t = wajibTabel_(TAB_PEMASOK);
    var data = dataPemasok_();
    var cari = function (n) {
      return data.pemasok.filter(function (p) { return p.nama.toLowerCase() === rapikanTeks_(n).toLowerCase(); })[0] || null;
    };
    var lama = body.baru ? null : cari(body.namaLama);
    if (!body.baru && !lama) throw galatPengguna_('Pemasok tidak ditemukan. Muat ulang layar ini.');
    var ada = cari(nama);
    if (ada && ada !== lama) {
      throw galatPengguna_('Pemasok ' + ada.nama + ' sudah ada' + (ada.aktif ? '.' : ' tetapi nonaktif. Aktifkan lagi dari daftar.'));
    }
    var isi = { 'Nama Pemasok': nama, 'Kontak': teksAman_(kontak), 'Catatan': teksAman_(catatan) };
    if (lama) {
      if (nama !== lama.nama && nama.toLowerCase() !== lama.nama.toLowerCase() && lama.punyaCatatan) {
        throw galatPengguna_('Nama ' + lama.nama + ' tidak bisa diganti karena pemasok ini sudah tercatat di barang masuk.');
      }
      tulisBarisMaster_(t, barisMaster_(t, 'Nama Pemasok', lama.nama), isi);
      if (nama !== lama.nama) gantiNamaPesanan_('Pemasok', lama.nama, nama);
    } else {
      tambahBarisMaster_(TAB_PEMASOK, gabung_(isi, { 'Aktif': true }));
    }
    var hasil = dataPemasok_();
    hasil.disimpan = nama;
    return hasil;
  });
}

/** Pemasok nonaktif tidak tampil di pilihan form Stock; catatan lamanya tetap. */
function aksiAturPemasokAktif_(body) {
  var aktif = body.aktif === true;
  return denganKunci_(function () {
    var t = bacaTabel_(TAB_PEMASOK);
    var nomor = t ? barisMaster_(t, 'Nama Pemasok', body.nama) : 0;
    if (!nomor) throw galatPengguna_('Pemasok tidak ditemukan. Muat ulang layar ini.');
    tulisBarisMaster_(t, nomor, { 'Aktif': aktif });
    var hasil = dataPemasok_();
    hasil.diubah = { nama: rapikanTeks_(body.nama), aktif: aktif };
    return hasil;
  });
}

/**
 * Harga beli yang berbeda dari harga satuan (Dashboard, Perlu ditinjau): pembelian terakhir tiap item aktif dalam
 * HARI_HARGA_BELI hari sampai tanggal itu yang punya harga beli, dibanding harga satuan yang berlaku pada tanggal
 * pembelian itu (item tanpa harga juga). Yang sudah diabaikan Pengelola (sesudah pembelian itu dicatat) dilewati.
 * [{ nama, satuan, hargaBeli, harga (null = belum punya harga), tanggal, pemasok, oleh }], urut nama.
 */
function hargaBeliBerbeda_(tanggal, master) {
  if (!pembelianSiap_()) return [];
  master = master || bacaItem_();
  var terakhir = {};
  bacaPembelian_(geserTanggal_(tanggal, -(HARI_HARGA_BELI - 1)), tanggal).forEach(function (p) {
    if (p.hargaBeli == null) return;
    var k = p.item.toLowerCase();
    var x = terakhir[k];
    if (!x || p.tanggal > x.tanggal || (p.tanggal === x.tanggal && p.ms >= x.ms)) terakhir[k] = p;
  });
  var ditinjau = bacaJson_(PropertiesService.getScriptProperties().getProperty(PROP_HARGA_BELI_DITINJAU)) || {};
  var hasil = [];
  Object.keys(terakhir).forEach(function (k) {
    var p = terakhir[k];
    var m = master[k];
    if (!m || !m.aktif || (ditinjau[k] && ditinjau[k] >= p.ms)) return;
    var harga = hargaPada_(m, p.tanggal);
    if (harga != null && Math.abs(harga - p.hargaBeli) < 0.005) return;
    hasil.push({ nama: m.nama, satuan: m.satuan, hargaBeli: p.hargaBeli, harga: harga, tanggal: p.tanggal, pemasok: p.pemasok, oleh: p.oleh });
  });
  return hasil.sort(function (a, b) { return a.nama.localeCompare(b.nama, 'id'); });
}

/** "Abaikan" di Dashboard: harga beli item ini yang sudah tercatat tidak ditandai lagi; pembelian berikutnya dibandingkan lagi. */
function aksiAbaikanHargaBeli_(body) {
  var m = bacaItem_()[rapikanTeks_(body.nama).toLowerCase()];
  if (!m) throw galatPengguna_('Item ' + rapikanTeks_(body.nama) + ' tidak ditemukan. Muat ulang Dashboard.');
  return denganKunci_(function () {
    var props = PropertiesService.getScriptProperties();
    var ditinjau = bacaJson_(props.getProperty(PROP_HARGA_BELI_DITINJAU)) || {};
    var aktif = bacaItem_();
    // Item yang sudah tidak ada dibuang supaya catatan ini tidak tumbuh terus.
    Object.keys(ditinjau).forEach(function (k) { if (!aktif[k]) delete ditinjau[k]; });
    ditinjau[m.nama.toLowerCase()] = Date.now();
    props.setProperty(PROP_HARGA_BELI_DITINJAU, JSON.stringify(ditinjau));
    return { diabaikan: m.nama };
  });
}

/* =========================================================================
 * Notifikasi ke HP (Web Push, Code.gs v0.19; spesifikasi sistem Bagian 10.1).
 * Hanya di Supabase: layanan NotifikasiHp (supabase/src/layanan.js) menitipkan
 * notifikasi, dan runtime mengirimnya sesudah data tersimpan. Di Apps Script
 * NotifikasiHp tidak ada, jadi semua fungsi di sini diam saja.
 * Langganan per HP disimpan di Script Properties (PUSH_<hash alamat>), atas
 * nama pengguna yang menyalakannya. Pengelola menerima suhu di luar standar,
 * permintaan reset PIN, akun terkunci, dan pengingat stock pagi; semua HP menerima
 * pengingat cek suhu dan pengingat sebelum closing.
 * ========================================================================= */

var AWALAN_PUSH = 'PUSH_';
var LANGGANAN_PUSH_MAKS = 50;
/** Pengingat cek suhu: waktu cek, kunci M_Konfigurasi, fungsi trigger, jam awal, nama field Outlet dan jadwal. */
var PENGINGAT_SUHU = [
  { waktu: 'Opening', kunci: 'jam_cek_opening', fungsi: 'pengingatSuhuOpening', awal: '08:00', field: 'jamCekOpening' },
  { waktu: 'Middle', kunci: 'jam_cek_middle', fungsi: 'pengingatSuhuMiddle', awal: '14:00', field: 'jamCekMiddle' },
  { waktu: 'Closing', kunci: 'jam_cek_closing', fungsi: 'pengingatSuhuClosing', awal: '21:00', field: 'jamCekClosing' }
];
var KETERANGAN_JAM_CEK = 'Jam pengingat cek suhu ke HP (jj:mm), dikirim jika waktu cek itu belum lengkap. Kosong = tanpa pengingat. ' +
  'Diubah dari Pengaturan → Outlet dan jadwal.';
/** Pengingat stock pagi ke HP Pengelola (Code.gs v0.22); bentuknya sama dengan PENGINGAT_SUHU. */
var PENGINGAT_STOCK = {
  waktu: 'stock', kunci: 'jam_pengingat_stock', fungsi: 'pengingatStock', awal: '07:00', field: 'jamPengingatStock',
  keterangan: 'Jam pengingat stock ke HP Head Kitchen dan Manager (jj:mm): item di bawah stok minimum, stock minus, lewat masa ' +
    'simpan, dan habis besok; dikirim hanya jika ada. Kosong = tanpa pengingat. Diubah dari Pengaturan → Outlet dan jadwal.'
};
/** Semua pengingat berjam yang diatur di Outlet dan jadwal. */
var PENGINGAT_JAM = PENGINGAT_SUHU.concat([PENGINGAT_STOCK]);
/**
 * Pengingat sebelum closing ke semua HP (Code.gs v0.31): sekian menit sebelum jam closing, jika masih ada form wajib
 * yang belum lengkap. Disimpan sebagai menit (bukan jam), supaya ikut bergeser saat jam closing diubah. 0 = mati.
 */
var PENGINGAT_CLOSING = {
  kunci: 'pengingat_closing_menit', fungsi: 'pengingatClosing', awal: 30, field: 'pengingatClosingMenit',
  keterangan: 'Menit sebelum jam closing untuk pengingat form yang belum lengkap ke semua HP (0, 15, 30, atau 60; 0 = tanpa ' +
    'pengingat). Diubah dari Pengaturan → Outlet dan jadwal.'
};
var PILIHAN_PENGINGAT_CLOSING = [0, 15, 30, 60];

/** Menit pengingat sebelum closing: nilai M_Konfigurasi (kosong atau 0 = mati), atau 30 jika barisnya belum ada atau tidak terbaca. */
function menitPengingatClosing_(n) {
  if (!Object.prototype.hasOwnProperty.call(n, PENGINGAT_CLOSING.kunci)) return PENGINGAT_CLOSING.awal;
  var t = String(n[PENGINGAT_CLOSING.kunci] == null ? '' : n[PENGINGAT_CLOSING.kunci]).trim();
  if (t === '') return 0;
  var x = Number(t);
  return PILIHAN_PENGINGAT_CLOSING.indexOf(x) >= 0 ? x : PENGINGAT_CLOSING.awal;
}

/** Jam pengingat sebelum closing (jj:mm; jam closing dikurangi menitnya, boleh mundur lewat tengah malam), atau '' jika mati. */
function jamPengingatClosing_(n) {
  var menit = menitPengingatClosing_(n);
  if (!menit) return '';
  var jam = jamSah_(n.jam_closing) || '21:30';
  var m = ((Number(jam.slice(0, 2)) * 60 + Number(jam.slice(3)) - menit) % 1440 + 1440) % 1440;
  return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2);
}

/** Notifikasi bisa dikirim: berjalan di Supabase dan kunci VAPID sudah ada. */
function notifikasiTersedia_() {
  return typeof NotifikasiHp !== 'undefined' && !!NotifikasiHp.kunciPublik();
}

function kunciLanggananPush_(endpoint) {
  return AWALAN_PUSH + sha256Heks_(String(endpoint)).slice(0, 32);
}

/** Semua langganan: [{ kunci, endpoint, keys: { p256dh, auth }, nama, waktu }], terbaru dulu. */
function bacaLanggananPush_() {
  var semua = PropertiesService.getScriptProperties().getProperties();
  var hasil = [];
  Object.keys(semua).forEach(function (k) {
    if (k.indexOf(AWALAN_PUSH) !== 0) return;
    var l = bacaJson_(semua[k]);
    if (!l || !l.endpoint || !l.keys) return;
    l.kunci = k;
    hasil.push(l);
  });
  return hasil.sort(function (a, b) { return (b.waktu || 0) - (a.waktu || 0); });
}

/** Jam pengingat satu waktu cek: nilai M_Konfigurasi (kosong = mati), atau jam awal jika barisnya belum ada. */
function jamPengingat_(n, p) {
  if (!Object.prototype.hasOwnProperty.call(n, p.kunci)) return p.awal;
  return jamSah_(n[p.kunci]);
}

/**
 * Menitipkan notifikasi ke HP yang berlangganan. sasaran: 'pengelola' (HP yang
 * dinyalakan Head Kitchen atau Manager aktif) atau 'semua' (HP staff aktif mana pun).
 * isi: { judul, isi, url (alamat di aplikasi, misalnya '#/suhu'), tag, mendesak? }.
 * Mengembalikan jumlah HP yang dititipi.
 */
function kirimNotifikasi_(sasaran, isi) {
  if (!notifikasiTersedia_()) return 0;
  var staff = bacaStaff_().daftar;
  var n = 0;
  bacaLanggananPush_().forEach(function (l) {
    var s = cariStaff_(staff, l.nama);
    if (!s || !s.aktif || !s.hash) return;
    if (sasaran === 'pengelola' && !apakahPengelola_(s.role)) return;
    NotifikasiHp.kirim({ endpoint: l.endpoint, keys: l.keys }, isi);
    n++;
  });
  return n;
}

/** Dipanggil runtime Supabase: langganan yang ditolak layanan push (404/410) dibuang. */
function hapusLanggananPush_(daftarEndpoint) {
  var props = PropertiesService.getScriptProperties();
  (daftarEndpoint || []).forEach(function (e) { props.deleteProperty(kunciLanggananPush_(e)); });
}

/** Keadaan notifikasi untuk HP ini: { tersedia, kunciPublik, aktif, atasNama, pengelola, pengingat: [{ waktu, jam }] }. */
function dataNotifikasi_(endpoint, pengguna) {
  var n = bacaKonfigurasi_().nilai;
  var tersedia = notifikasiTersedia_();
  var l = null;
  if (endpoint) {
    var x = bacaJson_(PropertiesService.getScriptProperties().getProperty(kunciLanggananPush_(endpoint)));
    if (x && x.endpoint === endpoint) l = x;
  }
  return {
    tersedia: tersedia,
    kunciPublik: tersedia ? NotifikasiHp.kunciPublik() : '',
    aktif: !!l,
    atasNama: l ? l.nama : '',
    pengelola: !!pengguna.pengelola,
    pengingat: PENGINGAT_SUHU.map(function (p) { return { waktu: p.waktu, jam: jamPengingat_(n, p) }; }),
    pengingatStock: jamPengingat_(n, PENGINGAT_STOCK),
    pengingatClosing: jamPengingatClosing_(n)
  };
}

function periksaEndpoint_(e) {
  e = String(e == null ? '' : e);
  if (!/^https:\/\/[^\s"'<>]{8,1900}$/.test(e)) throw galatPengguna_('Langganan notifikasi tidak terbaca. Matikan lalu nyalakan lagi.');
  return e;
}

function aksiInfoNotifikasi_(body, pengguna) {
  return dataNotifikasi_(body.endpoint ? periksaEndpoint_(body.endpoint) : '', pengguna);
}

/**
 * Menyalakan atau mematikan notifikasi di HP ini. body: { aktif: true, langganan: { endpoint,
 * keys: { p256dh, auth } } } atau { aktif: false, endpoint }. Menyalakan mengganti pemilik
 * langganan HP itu menjadi pengguna sekarang. Paling banyak LANGGANAN_PUSH_MAKS HP; yang paling
 * lama dibuang.
 */
function aksiAturNotifikasi_(body, pengguna) {
  if (body.aktif === true) {
    if (!notifikasiTersedia_()) throw galatPengguna_('Notifikasi belum tersedia di server ini.');
    var l = body.langganan || {};
    var endpoint = periksaEndpoint_(l.endpoint);
    var keys = l.keys || {};
    var pola = /^[A-Za-z0-9_-]+={0,2}$/;
    if (!pola.test(String(keys.p256dh || '')) || String(keys.p256dh).length < 80 || String(keys.p256dh).length > 100 ||
      !pola.test(String(keys.auth || '')) || String(keys.auth).length < 16 || String(keys.auth).length > 32) {
      throw galatPengguna_('Langganan notifikasi tidak terbaca. Matikan lalu nyalakan lagi.');
    }
    return denganKunci_(function () {
      var props = PropertiesService.getScriptProperties();
      props.setProperty(kunciLanggananPush_(endpoint), JSON.stringify({
        endpoint: endpoint, keys: { p256dh: String(keys.p256dh), auth: String(keys.auth) }, nama: pengguna.nama, waktu: Date.now()
      }));
      bacaLanggananPush_().slice(LANGGANAN_PUSH_MAKS).forEach(function (x) { props.deleteProperty(x.kunci); });
      return dataNotifikasi_(endpoint, pengguna);
    });
  }
  var e = periksaEndpoint_(body.endpoint);
  return denganKunci_(function () {
    PropertiesService.getScriptProperties().deleteProperty(kunciLanggananPush_(e));
    return dataNotifikasi_(e, pengguna);
  });
}

/** Notifikasi uji ke HP ini saja (harus sudah berlangganan). */
function aksiUjiNotifikasi_(body, pengguna) {
  var e = periksaEndpoint_(body.endpoint);
  var l = bacaJson_(PropertiesService.getScriptProperties().getProperty(kunciLanggananPush_(e)));
  if (!l || l.endpoint !== e || !notifikasiTersedia_()) throw galatPengguna_('Notifikasi di HP ini belum menyala.');
  NotifikasiHp.kirim({ endpoint: l.endpoint, keys: l.keys },
    { judul: 'Notifikasi InventoryKu menyala', isi: 'HP ini akan menerima notifikasi untuk ' + l.nama + '.', url: '#/', tag: 'uji' });
  return { terkirim: true };
}

function pengingatSuhuOpening() { return pengingatSuhu_('Opening'); }
function pengingatSuhuMiddle() { return pengingatSuhu_('Middle'); }
function pengingatSuhuClosing() { return pengingatSuhu_('Closing'); }

/**
 * Pengingat cek suhu (trigger harian pada jam di Outlet dan jadwal): jika waktu cek itu
 * belum diisi untuk semua unit aktif hari ini, semua HP yang berlangganan diberi notifikasi.
 * Tidak dikirim jika form Suhu disembunyikan atau tidak ada unit aktif.
 */
function pengingatSuhu_(waktu) {
  if (!notifikasiTersedia_()) return console.log('Notifikasi tidak tersedia; pengingat ' + waktu + ' dilewati.');
  // Hari libur (Code.gs v0.30): tidak ada pengecekan yang ditagih. Diperiksa sebelum Data_Suhu dibaca.
  if (liburPada_(hariIni_())) return console.log('Hari libur; pengingat ' + waktu + ' dilewati.');
  var suhu = bacaDaftarForm_().filter(function (f) { return f.id === 'SUHU'; })[0];
  if (!suhu || !suhu.aktif) return console.log('Form Suhu disembunyikan; pengingat dilewati.');
  var unit = bacaUnit_().filter(function (u) { return u.aktif; });
  if (!unit.length) return console.log('Tidak ada unit aktif; pengingat dilewati.');
  var sudah = {};
  bacaBarisTanggal_('Data_Suhu', hariIni_(), zonaSheet_(), ['Nama Unit', 'Waktu Cek']).forEach(function (b) {
    if (rapikanTeks_(b['Waktu Cek']).toLowerCase() === waktu.toLowerCase()) sudah[rapikanTeks_(b['Nama Unit']).toLowerCase()] = true;
  });
  var kurang = unit.filter(function (u) { return !sudah[u.nama.toLowerCase()]; }).map(function (u) { return u.nama; });
  if (!kurang.length) return console.log('Suhu ' + waktu + ' sudah lengkap; pengingat tidak dikirim.');
  var n = kirimNotifikasi_('semua', {
    judul: 'Waktunya cek suhu ' + waktu,
    isi: 'Belum diisi: ' + daftarNamaSingkat_(kurang) + '.',
    url: '#/suhu', tag: 'pengingat-suhu', mendesak: true, ttl: 3 * 3600
  });
  console.log('Pengingat suhu ' + waktu + ' dikirim ke ' + n + ' HP.');
}

function pengingatStock() { return pengingatStock_(); }

/**
 * Pengingat stock (trigger harian pada jam di Outlet dan jadwal, bawaan 07:00): stock
 * hari ini menurut catatan (sama dengan Dashboard): item aktif yang minus, item di bawah
 * stok minimum, dan barang yang lewat masa simpan atau habis besok. Dikirim ke HP
 * Pengelola hanya jika ada salah satunya. Mengembalikan isi notifikasi (atau null).
 */
function pengingatStock_() {
  if (!notifikasiTersedia_()) {
    console.log('Notifikasi tidak tersedia; pengingat stock dilewati.');
    return null;
  }
  var isi = isiPengingatStock_(hariIni_());
  if (!isi) {
    console.log('Stock aman; pengingat stock tidak dikirim.');
    return null;
  }
  var n = kirimNotifikasi_('pengelola', isi);
  console.log('Pengingat stock dikirim ke ' + n + ' HP.');
  return isi;
}

/** Isi notifikasi pengingat stock pada tanggal itu: { judul, isi, url, tag, ttl }, atau null jika tidak ada yang perlu dikabarkan. */
function isiPengingatStock_(tanggal) {
  var stock = ringkasStockHari_(tanggal);
  var masa = masaSimpan_(tanggal);
  var nama = function (x) { return x.m.nama; };
  var minus = stock.minus.map(nama);
  var kecil = {};
  minus.forEach(function (x) { kecil[x.toLowerCase()] = true; });
  // Item minus sudah disebut sendiri; tidak diulang di bawah minimum.
  var bawah = stock.belanja.map(nama).filter(function (x) { return !kecil[x.toLowerCase()]; });
  var lewat = masa.lewat.map(function (x) { return x.item; });
  var besok = masa.habisBesok.map(function (x) { return x.item; });
  var judul = [];
  var baris = [];
  if (minus.length) {
    judul.push(minus.length + ' minus');
    baris.push('Minus: ' + daftarNamaSingkat_(minus) + '.');
  }
  if (bawah.length) {
    judul.push(bawah.length + ' di bawah minimum');
    baris.push('Di bawah minimum: ' + daftarNamaSingkat_(bawah) + '.');
  }
  if (lewat.length) {
    judul.push(lewat.length + ' lewat masa simpan');
    baris.push('Lewat masa simpan: ' + daftarNamaSingkat_(lewat) + '.');
  }
  if (besok.length) {
    judul.push(besok.length + ' habis besok');
    baris.push('Habis besok: ' + daftarNamaSingkat_(besok) + '.');
  }
  if (!judul.length) return null;
  return { judul: 'Stock hari ini: ' + judul.join(', '), isi: baris.join(' '), url: '#/dashboard', tag: 'pengingat-stock', ttl: 12 * 3600 };
}

function pengingatClosing() { return pengingatClosing_(); }

/**
 * Pengingat sebelum closing (Code.gs v0.31; trigger harian pada jam closing dikurangi pengingat_closing_menit): form wajib
 * hari itu yang belum diisi atau belum lengkap, ke semua HP yang berlangganan. Tidak dikirim jika semuanya lengkap atau
 * hari libur. Suhu tidak disebut selama pengingat cek suhu Closing menyala, karena pengingat itu sudah mengabarkannya.
 * Pengingat yang berjalan sebelum 06.00 (jam closing lewat tengah malam) untuk hari kemarin, seperti laporan harian.
 * Mengembalikan isi notifikasi (atau null).
 */
function pengingatClosing_() {
  if (!notifikasiTersedia_()) {
    console.log('Notifikasi tidak tersedia; pengingat closing dilewati.');
    return null;
  }
  var jam = Number(Utilities.formatDate(new Date(), zonaWaktu_(), 'H'));
  var tanggal = jam < 6 ? geserTanggal_(hariIni_(), -1) : hariIni_();
  if (liburPada_(tanggal)) {
    console.log('Hari libur; pengingat closing dilewati.');
    return null;
  }
  var isi = isiPengingatClosing_(tanggal, bacaKonfigurasi_().nilai);
  if (!isi) {
    console.log('Semua form wajib ' + tanggal + ' lengkap; pengingat closing tidak dikirim.');
    return null;
  }
  var n = kirimNotifikasi_('semua', isi);
  console.log('Pengingat closing ' + tanggal + ' dikirim ke ' + n + ' HP.');
  return isi;
}

/** Isi notifikasi pengingat sebelum closing pada tanggal itu: { judul, isi, url, tag, ttl }, atau null jika semua form wajib lengkap. */
function isiPengingatClosing_(tanggal, n) {
  var suhuSendiri = !!jamPengingat_(n, PENGINGAT_SUHU[2]);
  var form = kelengkapanForm_(tanggal).filter(function (f) {
    return f.wajib && (f.status === 'belum' || f.status === 'sebagian') && !(suhuSendiri && f.id === 'SUHU');
  });
  if (!form.length) return null;
  var belum = form.filter(function (f) { return f.status === 'belum'; }).map(function (f) { return f.nama; });
  var sebagian = form.filter(function (f) { return f.status === 'sebagian'; }).map(function (f) {
    return f.nama + (f.detail ? ' (' + f.detail + ')' : '');
  });
  var baris = [];
  if (belum.length) baris.push('Belum diisi: ' + daftarNamaSingkat_(belum) + '.');
  if (sebagian.length) baris.push('Belum lengkap: ' + daftarNamaSingkat_(sebagian) + '.');
  if (belum.length) baris.push('Jika memang tidak ada, ketuk Tidak ada hari ini di formnya.');
  var closing = (jamSah_(n.jam_closing) || '21:30').replace(':', '.');
  return {
    judul: 'Closing ' + closing + ': ' + form.length + ' form belum ' + (sebagian.length ? 'lengkap' : 'diisi'),
    isi: baris.join(' '), url: '#/', tag: 'pengingat-closing', ttl: 3 * 3600
  };
}

/* ---------- Pengaturan → Outlet dan jadwal ---------- */

/** "21:30" dari teks jj:mm atau jj.mm (atau nilai waktu Sheet); '' jika tidak sah. */
function jamSah_(nilai) {
  if (nilai instanceof Date && !isNaN(nilai.getTime())) {
    return Utilities.formatDate(nilai, zonaSheet_(), 'HH:mm');
  }
  var m = String(nilai == null ? '' : nilai).trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return '';
  return ('0' + Number(m[1])).slice(-2) + ':' + m[2];
}

/** Jeda laporan (menit, bilangan bulat 0–240), atau null jika tidak sah. */
function jedaSah_(nilai) {
  var t = String(nilai == null ? '' : nilai).trim();
  if (!/^\d{1,3}$/.test(t) || Number(t) > JEDA_LAPORAN_MAKS) return null;
  return Number(t);
}

/** Nama hari sesuai HARI_ID ("Minggu"), atau '' jika tidak dikenal. */
function hariSah_(nilai) {
  var k = rapikanTeks_(nilai).toLowerCase();
  var hasil = '';
  HARI_ID.forEach(function (h) { if (h.toLowerCase() === k) hasil = h; });
  if (!hasil && k === "jum'at") hasil = 'Jumat';
  return hasil;
}

/** Zona waktu yang dikenal Apps Script (dicoba lewat Utilities.formatDate). */
function zonaDikenal_(zona) {
  if (!zonaSah_(zona)) return false;
  try {
    Utilities.formatDate(new Date(), zona, 'yyyy-MM-dd');
    return true;
  } catch (err) {
    return false;
  }
}

/** Isi Pengaturan → Outlet dan jadwal (tampilan Bagian 5.7). */
function dataOutletJadwal_() {
  var n = bacaKonfigurasi_().nilai;
  var jeda = jedaSah_(n.jeda_laporan_menit);
  var opname = String(n.jadwal_opname || '').trim().toLowerCase();
  return {
    namaOutlet: namaOutlet_(),
    zonaWaktu: zonaWaktu_(),
    jamClosing: jamSah_(n.jam_closing) || '21:30',
    jedaLaporanMenit: jeda == null ? 45 : jeda,
    jadwalOpname: JADWAL_OPNAME.indexOf(opname) >= 0 ? opname : 'mingguan',
    hariCadangan: hariSah_(n.hari_cadangan) || 'Minggu',
    keluarOtomatisMenit: keluarOtomatisMenit_(n.keluar_otomatis_menit),
    targetFoodCost: targetFoodCost_(n),
    bahanKecilPersen: bahanKecilPersen_(n),
    jamCekOpening: jamPengingat_(n, PENGINGAT_SUHU[0]),
    jamCekMiddle: jamPengingat_(n, PENGINGAT_SUHU[1]),
    jamCekClosing: jamPengingat_(n, PENGINGAT_SUHU[2]),
    jamPengingatStock: jamPengingat_(n, PENGINGAT_STOCK),
    pengingatClosingMenit: menitPengingatClosing_(n),
    notifikasiTersedia: notifikasiTersedia_(),
    perluPasangTrigger: /^Perlu/.test(String(n.pasang_trigger || ''))
  };
}

function aksiBacaOutletJadwal_() {
  return dataOutletJadwal_();
}

/**
 * Menyimpan Outlet dan jadwal. Hanya field yang dikirim yang diperiksa dan
 * ditulis: namaOutlet, zonaWaktu, jamClosing, jedaLaporanMenit, jadwalOpname,
 * hariCadangan, keluarOtomatisMenit. Zona waktu baru juga dipasang sebagai
 * zona waktu spreadsheet (supaya TODAY() di tab Harian sama dengan server).
 * Perubahan zona waktu, jam closing, jeda laporan, atau hari cadangan baru
 * berlaku untuk trigger setelah pasangTrigger dijalankan lagi: M_Konfigurasi
 * pasang_trigger diisi "Perlu dijalankan …", yang tampil sebagai peringatan
 * di Beranda dan Dashboard Pengelola sampai pasangTrigger dijalankan.
 */
function aksiSimpanOutletJadwal_(body, pengguna) {
  var ada = function (k) { return Object.prototype.hasOwnProperty.call(body, k) && body[k] != null; };
  var baru = {};
  if (ada('namaOutlet')) baru.namaOutlet = periksaNama_(body.namaOutlet, 'Nama outlet', PANJANG_OUTLET_MAKS);
  if (ada('zonaWaktu')) {
    if (!zonaDikenal_(String(body.zonaWaktu))) throw galatPengguna_('Zona waktu tidak dikenal. Pilih dari daftar.');
    baru.zonaWaktu = String(body.zonaWaktu);
  }
  if (ada('jamClosing')) {
    baru.jamClosing = jamSah_(body.jamClosing);
    if (!baru.jamClosing) throw galatPengguna_('Isi jam closing dengan format jj:mm, misalnya 21:30.');
  }
  if (ada('jedaLaporanMenit')) {
    baru.jedaLaporanMenit = jedaSah_(body.jedaLaporanMenit);
    if (baru.jedaLaporanMenit == null) throw galatPengguna_('Jeda laporan diisi menit bulat, 0 sampai ' + JEDA_LAPORAN_MAKS + '.');
  }
  if (ada('jadwalOpname')) {
    baru.jadwalOpname = String(body.jadwalOpname).toLowerCase();
    if (JADWAL_OPNAME.indexOf(baru.jadwalOpname) < 0) throw galatPengguna_('Pilih jadwal stock opname: mingguan atau bulanan.');
  }
  if (ada('hariCadangan')) {
    baru.hariCadangan = hariSah_(body.hariCadangan);
    if (!baru.hariCadangan) throw galatPengguna_('Pilih hari cadangan.');
  }
  if (ada('keluarOtomatisMenit')) {
    baru.keluarOtomatisMenit = Number(body.keluarOtomatisMenit);
    if (PILIHAN_KELUAR_OTOMATIS.indexOf(baru.keluarOtomatisMenit) < 0) throw galatPengguna_('Pilih 5, 10, 15, atau 30 menit.');
  }
  if (ada('targetFoodCost')) {
    baru.targetFoodCost = persenIsian_(body.targetFoodCost, 1, 100);
    if (baru.targetFoodCost == null) throw galatPengguna_('Target food cost diisi persen 1 sampai 100, misalnya 35.');
  }
  if (ada('bahanKecilPersen')) {
    baru.bahanKecilPersen = persenIsian_(body.bahanKecilPersen, 0, BAHAN_KECIL_MAKS);
    if (baru.bahanKecilPersen == null) throw galatPengguna_('Bahan kecil diisi persen 0 sampai ' + BAHAN_KECIL_MAKS + ', misalnya 3.');
  }
  // Jam pengingat cek suhu dan stock: jj:mm, atau kosong untuk mematikan pengingat itu.
  PENGINGAT_JAM.forEach(function (p) {
    if (!ada(p.field)) return;
    var t = String(body[p.field]).trim();
    baru[p.field] = t === '' ? '' : jamSah_(t);
    if (t !== '' && !baru[p.field]) throw galatPengguna_('Jam pengingat ' + p.waktu + ' diisi jj:mm, misalnya 08:00, atau dikosongkan.');
  });
  if (ada(PENGINGAT_CLOSING.field)) {
    baru[PENGINGAT_CLOSING.field] = Number(body[PENGINGAT_CLOSING.field]);
    if (PILIHAN_PENGINGAT_CLOSING.indexOf(baru[PENGINGAT_CLOSING.field]) < 0) {
      throw galatPengguna_('Pilih pengingat sebelum closing: mati, 15, 30, atau 60 menit.');
    }
  }

  return denganKunci_(function () {
    var kini = dataOutletJadwal_();
    var berubah = function (k) { return k in baru && String(baru[k]) !== String(kini[k]); };
    if (berubah('namaOutlet')) {
      var outlet = ambilTab_('M_Outlet');
      outlet.getRange(2, posisiKolom_(outlet, { nama: 'Nama Outlet' }).nama).setValue(baru.namaOutlet);
    }
    if (berubah('zonaWaktu')) {
      tulisKonfigurasi_('zona_waktu', baru.zonaWaktu);
      try {
        ss_().setSpreadsheetTimeZone(baru.zonaWaktu);
        ZONA_SHEET_ = null;
      } catch (err) {
        console.error('Zona waktu spreadsheet tidak bisa diubah: ' + err);
      }
    }
    if (berubah('jamClosing')) tulisKonfigurasi_('jam_closing', baru.jamClosing);
    if (berubah('jedaLaporanMenit')) tulisKonfigurasi_('jeda_laporan_menit', String(baru.jedaLaporanMenit));
    if (berubah('jadwalOpname')) tulisKonfigurasi_('jadwal_opname', baru.jadwalOpname);
    if (berubah('hariCadangan')) tulisKonfigurasi_('hari_cadangan', baru.hariCadangan);
    if (berubah('keluarOtomatisMenit')) {
      tulisKonfigurasi_('keluar_otomatis_menit', String(baru.keluarOtomatisMenit), KETERANGAN_KELUAR_OTOMATIS);
    }
    if (berubah('targetFoodCost')) {
      tulisKonfigurasi_('target_food_cost', String(baru.targetFoodCost).replace('.', ','), KETERANGAN_TARGET_FOOD_COST);
    }
    if (berubah('bahanKecilPersen')) {
      tulisKonfigurasi_('bahan_kecil_persen', String(baru.bahanKecilPersen).replace('.', ','), KETERANGAN_BAHAN_KECIL);
    }
    var pengingatBerubah = false;
    PENGINGAT_JAM.forEach(function (p) {
      if (!berubah(p.field)) return;
      tulisKonfigurasi_(p.kunci, baru[p.field], p.keterangan || KETERANGAN_JAM_CEK);
      pengingatBerubah = true;
    });
    if (berubah(PENGINGAT_CLOSING.field)) {
      tulisKonfigurasi_(PENGINGAT_CLOSING.kunci, String(baru[PENGINGAT_CLOSING.field]), PENGINGAT_CLOSING.keterangan);
      pengingatBerubah = true;
    }
    // Pengingat hanya berjalan di Supabase; di sana jadwalnya langsung dipasang ulang.
    if (pengingatBerubah && DI_SUPABASE_ && !(berubah('zonaWaktu') || berubah('jamClosing') || berubah('jedaLaporanMenit') ||
      berubah('hariCadangan'))) {
      try {
        pasangTrigger();
      } catch (err) {
        console.error('Jadwal pengingat tidak bisa dipasang ulang: ' + err);
      }
    }
    var jadwalBerubah = berubah('zonaWaktu') || berubah('jamClosing') || berubah('jedaLaporanMenit') || berubah('hariCadangan');
    if (jadwalBerubah) {
      tulisKonfigurasi_('pasang_trigger', 'Perlu dijalankan: jadwal diubah ' + waktuSekarangId_() + ' oleh ' + pengguna.nama + '.',
        KETERANGAN_PASANG_TRIGGER);
      // Di Supabase jadwal langsung dipasang ulang (pg_cron), tanpa menjalankan pasangTrigger dari editor.
      if (DI_SUPABASE_) {
        try {
          pasangTrigger();
        } catch (err) {
          console.error('Jadwal tidak bisa dipasang ulang: ' + err);
        }
      }
    }
    var hasil = dataOutletJadwal_();
    hasil.jadwalBerubah = jadwalBerubah;
    return hasil;
  });
}

/* =========================================================================
 * Tahap 7: Dashboard di aplikasi (spesifikasi sistem Bagian 8.5, tampilan
 * Bagian 5.6). Satu panggilan: angka ringkas hari ini, nilai stock, daftar
 * "Perlu perhatian", dan data kedua grafik kecil.
 * ========================================================================= */

var HARI_GRAFIK_WASTE = 7;

/**
 * Nilai stock (Bagian 8.5): Stock Akhir pada tanggal itu × harga yang berlaku
 * pada tanggal itu (riwayat harga; untuk hari ini sama dengan Harga Satuan di
 * M_Item). Yang dihitung: item aktif, dan item nonaktif yang
 * stock-nya belum nol. Item tanpa harga tidak dihitung dan didaftar terpisah
 * (tanpaHarga). Harga barang jadi dari resep tidak dipakai di sini, supaya
 * angkanya sama dengan blok Nilai stock di tab Dashboard. Stock minus ikut
 * dihitung apa adanya (nilainya minus).
 */
function nilaiStock_(master, rekap, tanggal) {
  var urut = {};
  var namaKat = {};
  bacaSemuaKategori_().forEach(function (k, i) {
    urut[k.nama.toLowerCase()] = i;
    namaKat[k.nama.toLowerCase()] = k.nama;
  });
  var per = {};
  var total = 0;
  var jumlah = 0;
  var tanpa = [];
  Object.keys(master).forEach(function (k) {
    var m = master[k];
    var akhir = posisiStock_(rekap.item[k], tanggal).akhir;
    if (!m.aktif && !akhir) return;
    var kat = namaKat[m.kategori.toLowerCase()] || m.kategori || 'Tanpa kategori';
    var harga = hargaPada_(m, tanggal);
    if (harga == null) {
      tanpa.push({ nama: m.nama, kategori: kat, satuan: m.satuan, stock: akhir, aktif: m.aktif });
      return;
    }
    var nilai = akhir * harga;
    var x = per[kat.toLowerCase()] = per[kat.toLowerCase()] || { kategori: kat, nilai: 0, jumlahItem: 0 };
    x.nilai += nilai;
    x.jumlahItem++;
    total += nilai;
    jumlah++;
  });
  var posisi = function (kat) {
    var u = urut[kat.toLowerCase()];
    return u == null ? 1e6 : u;
  };
  var perKategori = Object.keys(per).map(function (k) {
    per[k].nilai = Math.round(per[k].nilai);
    return per[k];
  }).sort(function (a, b) {
    return posisi(a.kategori) - posisi(b.kategori) || a.kategori.localeCompare(b.kategori, 'id');
  });
  tanpa.sort(function (a, b) {
    return posisi(a.kategori) - posisi(b.kategori) || a.nama.localeCompare(b.nama, 'id');
  });
  return { total: Math.round(total), jumlahItem: jumlah, perKategori: perKategori, tanpaHarga: tanpa };
}

/** Grafik waste (tampilan Bagian 5.6): estimasi kerugian per hari selama 7 hari sampai tanggal itu, hari ini paling kanan. */
function grafikWaste_(tanggal, zona) {
  var hari = [];
  var peta = {};
  for (var i = HARI_GRAFIK_WASTE - 1; i >= 0; i--) {
    var tg = geserTanggal_(tanggal, -i);
    peta[tg] = { tanggal: tg, rp: 0, catatan: 0 };
    hari.push(peta[tg]);
  }
  var t = bacaTabel_('Data_Waste');
  if (t) {
    t.baris.forEach(function (b) {
      var x = peta[teksTanggal_(nilai_(t, b, 'Tanggal'), zona)];
      if (!x || !rapikanTeks_(nilai_(t, b, 'Item / Produk'))) return;
      x.catatan++;
      x.rp += Number(nilai_(t, b, 'Estimasi Kerugian (Rp)')) || 0;
    });
  }
  hari.forEach(function (x) { x.rp = Math.round(x.rp); });
  return { hari: hari };
}

/**
 * Grafik suhu (tampilan Bagian 5.6): semua pengecekan pada tanggal itu per
 * unit, termasuk cek ulang. Unit aktif menurut urutan M_Unit, ditambah unit
 * nonaktif yang punya isian hari itu. Status memakai yang tersimpan.
 */
function grafikSuhu_(tanggal, zona) {
  var daftar = [];
  var peta = {};
  bacaUnit_().forEach(function (u) {
    if (!u.aktif) return;
    peta[u.nama.toLowerCase()] = { nama: u.nama, tipe: u.tipe, cek: [] };
    daftar.push(peta[u.nama.toLowerCase()]);
  });
  var jumlah = 0;
  var luar = 0;
  bacaBarisTanggal_('Data_Suhu', tanggal, zona, ['Waktu Cek', 'Nama Unit', 'Tipe Unit', 'Suhu (°C)', 'Status Suhu', 'Tindakan Korektif'])
    .sort(function (a, b) { return (a.waktu ? a.waktu.getTime() : 0) - (b.waktu ? b.waktu.getTime() : 0); })
    .forEach(function (b) {
      var nama = rapikanTeks_(b['Nama Unit']);
      var suhu = angkaAtauNull_(b['Suhu (°C)']);
      if (!nama || suhu == null) return;
      var u = peta[nama.toLowerCase()];
      if (!u) {
        u = peta[nama.toLowerCase()] = {
          nama: nama, tipe: rapikanTeks_(b['Tipe Unit']).toLowerCase() === 'freezer' ? 'Freezer' : 'Chiller', cek: [], nonaktif: true
        };
        daftar.push(u);
      }
      var diLuar = rapikanTeks_(b['Status Suhu']) === STATUS_SUHU_LUAR;
      jumlah++;
      if (diLuar) luar++;
      u.cek.push({
        waktuCek: rapikanTeks_(b['Waktu Cek']),
        suhu: suhu,
        luar: diLuar,
        tindakan: rapikanTeks_(b['Tindakan Korektif']),
        oleh: b.oleh,
        waktu: b.waktu ? b.waktu.toISOString() : null
      });
    });
  return { batas: batasSuhu_(), unit: daftar, jumlah: jumlah, luar: luar };
}

/** "Tomat, Bawang, dan Cabai" untuk keterangan Perlu perhatian (paling banyak 3 nama, sisanya "dan 2 lainnya"). */
function daftarNamaSingkat_(nama) {
  if (nama.length === 1) return nama[0];
  if (nama.length === 2) return nama[0] + ' dan ' + nama[1];
  if (nama.length === 3) return nama[0] + ', ' + nama[1] + ', dan ' + nama[2];
  return nama.slice(0, 3).join(', ') + ', dan ' + (nama.length - 3) + ' lainnya';
}

/**
 * Daftar "Perlu perhatian" (tampilan Bagian 5.6), urut dari yang paling
 * mendesak: Masalah (suhu yang masih di luar standar, Stock Akhir minus, lewat
 * masa simpan, laporan atau cadangan gagal), lalu Perlu ditinjau (baris
 * dilaporkan keliru, permintaan reset PIN, di bawah stok minimum, habis besok,
 * jadwal yang perlu pasangTrigger, stock opname lewat jadwal), lalu Menunggu (form wajib yang belum
 * lengkap, isian belum diperiksa, item belum punya harga). Tiap butir:
 * { jenis, tingkat: masalah | tinjau | menunggu, judul, ket, data }.
 */
function perhatianDashboard_(d) {
  var hasil = [];
  function tambah(jenis, tingkat, judul, ket, data) {
    hasil.push({ jenis: jenis, tingkat: tingkat, judul: judul, ket: ket || '', data: data || null });
  }
  // Suhu: unit yang pengecekan terakhirnya hari ini masih di luar standar.
  d.suhu.unit.forEach(function (u) {
    var c = u.cek[u.cek.length - 1];
    if (!c || !c.luar) return;
    var jam = c.waktu ? jamId_(new Date(c.waktu)) : '';
    tambah('suhu', 'masalah', u.nama + ' di luar standar',
      suhuId_(c.suhu) + ' pada ' + c.waktuCek + (jam ? ' ' + jam : '') + '. ' +
      (c.waktuCek === 'Cek ulang' ? 'Cek ulang masih di luar standar.' : 'Belum ada cek ulang yang normal.'), { unit: u.nama });
  });
  if (d.stock.minus.length) {
    tambah('minus', 'masalah', d.stock.minus.length + ' item stock akhir minus',
      daftarNamaSingkat_(d.stock.minus.map(function (x) { return x.m.nama; })) + '. Periksa catatannya atau sesuaikan stock.',
      { item: d.stock.minus.map(function (x) { return { nama: x.m.nama, stock: x.akhir, satuan: x.m.satuan }; }) });
  }
  if (d.masaSimpan.lewat.length) {
    tambah('lewatMasaSimpan', 'masalah', d.masaSimpan.lewat.length + ' item lewat masa simpan',
      daftarNamaSingkat_(d.masaSimpan.lewat.map(function (x) { return x.item; })) + '.', { lewat: d.masaSimpan.lewat });
  }
  d.peringatan.forEach(function (p) {
    if (/^Jadwal:/.test(p)) return; // ditulis sebagai butir Perlu ditinjau di bawah
    tambah('sistem', 'masalah', 'Perlu perhatian', p + ' Rinciannya di tab M_Konfigurasi.');
  });
  if (d.pemeriksaan.dilaporkan) {
    tambah('dilaporkan', 'tinjau', d.pemeriksaan.dilaporkan + ' baris dilaporkan keliru', 'Periksa dan koreksi dari Riwayat.',
      { formId: d.pemeriksaan.formDilaporkan, dari: d.pemeriksaan.dari, sampai: d.pemeriksaan.sampai });
  }
  d.reset.forEach(function (s) {
    tambah('resetPin', 'tinjau', s.nama + ' meminta reset PIN', 'Buat PIN baru di Pengaturan → Staff dan PIN.', { nama: s.nama });
  });
  (d.terkunci || []).forEach(function (a) {
    tambah('terkunci', 'tinjau', a.nama + ' terkunci karena PIN salah',
      (a.panjang ? 'Salah berulang kali dalam 24 jam. ' : '') + 'Terbuka sendiri ' + waktuPendekId_(new Date(a.sampai)) +
      ', atau buat PIN baru di Pengaturan → Staff dan PIN.', { nama: a.nama });
  });
  if (d.stock.belanja.length) {
    tambah('bawahMinimum', 'tinjau', d.stock.belanja.length + ' item di bawah stok minimum',
      daftarNamaSingkat_(d.stock.belanja.map(function (x) { return x.m.nama; })) + '.',
      { item: d.stock.belanja.map(function (x) { return { nama: x.m.nama, stock: x.akhir, satuan: x.m.satuan, stokMin: x.m.stokMin, saran: x.saran }; }) });
  }
  if (d.hargaBeli && d.hargaBeli.length) {
    tambah('hargaBeli', 'tinjau', d.hargaBeli.length + ' harga beli berbeda dari harga satuan',
      daftarNamaSingkat_(d.hargaBeli.map(function (x) { return x.nama; })) + '. Pakai harga belinya atau abaikan.', { item: d.hargaBeli });
  }
  if (d.masaSimpan.habisBesok.length) {
    tambah('habisBesok', 'tinjau', d.masaSimpan.habisBesok.length + ' item habis besok',
      daftarNamaSingkat_(d.masaSimpan.habisBesok.map(function (x) { return x.item; })) + '.', { habisBesok: d.masaSimpan.habisBesok });
  }
  d.peringatan.forEach(function (p) {
    if (/^Jadwal:/.test(p)) tambah('jadwal', 'tinjau', 'Jadwal belum dipasang ulang', p.replace(/^Jadwal:\s*/, ''));
  });
  if (d.opname && d.opname.lewat) {
    tambah('opname', 'tinjau', teksPengingatOpname_(d.opname).replace(/\.$/, ''), 'Jadwal ' + d.opname.jadwal + '. Hitung barang nyata ' +
      'sebelum opening atau setelah closing.');
  }
  if (d.hpp && d.hpp.menuDiAtas.length) {
    tambah('menu', 'tinjau', d.hpp.menuDiAtas.length + ' menu di atas target food cost ' + persenId_(d.hpp.target),
      daftarNamaSingkat_(d.hpp.menuDiAtas.map(function (m) { return m.nama + ' ' + persenId_(m.foodCost); })) + '.');
  }
  var belum = d.form.filter(function (f) { return f.wajib && !f.lengkap; });
  if (belum.length) {
    tambah('formBelum', 'menunggu', belum.length + ' form belum lengkap hari ini', belum.map(function (f) {
      return f.nama + (f.status === 'sebagian' && f.detail ? ' ' + f.detail : ' belum diisi');
    }).join(' · ') + '.');
  }
  if (d.pemeriksaan.belumDiperiksa) {
    tambah('belumDiperiksa', 'menunggu', d.pemeriksaan.belumDiperiksa + ' isian belum diperiksa', BATAS_RIWAYAT_HARI + ' hari terakhir.',
      { formId: d.pemeriksaan.formBelum, dari: d.pemeriksaan.dari, sampai: d.pemeriksaan.sampai });
  }
  if (d.hpp && d.hpp.penjualanKurang.length) {
    var kurang = d.hpp.penjualanKurang;
    tambah('penjualan', 'menunggu', kurang.length === 1 && kurang[0] === d.hpp.kemarin ? 'Penjualan kemarin belum dicatat'
      : 'Penjualan ' + kurang.length + ' hari belum dicatat',
      (kurang.length > 5 ? 'Antara lain tanggal ' + teksHariBulan_(kurang.slice(-4)) : 'Tanggal ' + teksHariBulan_(kurang)) +
      ((d.hpp.porsiKurang || []).length ? ' (porsi per menu tanggal ' + teksHariBulan_(d.hpp.porsiKurang.slice(-4)) + ')' : '') +
      '. Food cost bulan ini dihitung setelah semua hari tercatat.', { tanggal: kurang[kurang.length - 1] });
  }
  if (d.nilai.tanpaHarga.length) {
    tambah('tanpaHarga', 'menunggu', d.nilai.tanpaHarga.length + ' item belum punya harga',
      'Tidak ikut nilai stock: ' + daftarNamaSingkat_(d.nilai.tanpaHarga.map(function (x) { return x.nama; })) + '.');
  }
  return hasil;
}

/** Alamat tab Dashboard di Google Sheets (hanya terbuka bagi akun yang diberi akses pemilik, Bagian 7.3). */
function alamatDashboardSheet_() {
  var ss = ss_();
  var tab = ss.getSheetByName('Dashboard');
  return ss.getUrl() + (tab ? '#gid=' + tab.getSheetId() : '');
}

/**
 * Menu Dashboard di aplikasi (khusus Pengelola): satu jawaban berisi angka
 * ringkas hari ini, nilai stock, Perlu perhatian, kedua grafik kecil, dan
 * alamat tab Dashboard. tanggal: tanggal perangkat (tidak boleh lewat hari ini).
 */
function aksiDashboard_(body) {
  var hari = hariIni_();
  var tanggal = tanggalSah_(body.tanggal) && body.tanggal <= hari ? body.tanggal : hari;
  var zona = zonaSheet_();
  var master = bacaItem_();
  var rekap = bacaRekap_();
  var form = kelengkapanForm_(tanggal);
  var wajib = form.filter(function (f) { return f.wajib; });
  var d = {
    form: form,
    stock: ringkasStockHari_(tanggal, master, rekap),
    nilai: nilaiStock_(master, rekap, tanggal),
    selisihHarga: selisihHarga_(master, rekap, tanggal.slice(0, 8) + '01', tanggal),
    waste: grafikWaste_(tanggal, zona),
    suhu: grafikSuhu_(tanggal, zona),
    masaSimpan: masaSimpan_(tanggal),
    pemeriksaan: ringkasPemeriksaan_(),
    reset: bacaStaff_().daftar.filter(function (s) { return s.aktif && s.reset; }).sort(function (a, b) {
      return a.reset.getTime() - b.reset.getTime();
    }),
    terkunci: akunTerkunci_().filter(function (a) { return a.sampai; }),
    peringatan: peringatanSistem_(),
    opname: statusOpname_(),
    hpp: ringkasHppDashboard_(tanggal),
    hargaBeli: hargaBeliBerbeda_(tanggal, master)
  };
  var hariIniWaste = d.waste.hari[d.waste.hari.length - 1];
  return {
    tanggal: tanggal,
    ringkas: {
      formLengkap: wajib.filter(function (f) { return f.lengkap; }).length,
      formWajib: wajib.length,
      belumDiperiksa: d.pemeriksaan.belumDiperiksa,
      suhuLuar: d.suhu.luar,
      bawahMinimum: d.stock.belanja.length,
      wasteRp: hariIniWaste.rp,
      wasteCatatan: hariIniWaste.catatan,
      nilaiStock: d.nilai.total
    },
    nilaiStock: gabung_(d.nilai, { selisihHarga: d.selisihHarga }),
    perhatian: perhatianDashboard_(d),
    grafikWaste: d.waste,
    grafikSuhu: d.suhu,
    opname: d.opname,
    hpp: { bulan: d.hpp.bulan, nama: d.hpp.nama, foodCost: d.hpp.foodCost, target: d.hpp.target },
    libur: liburUntukJawaban_(tanggal),
    alamatSheet: alamatDashboardSheet_()
  };
}

/* =========================================================================
 * HPP dan food cost (keputusan pemilik 17 Oktober 2026; spesifikasi sistem
 * Bagian 5.9, tampilan Bagian 5.10): menu dengan takaran per porsi, HPP per
 * porsi, penjualan harian, dan food cost per bulan. Semuanya khusus Pengelola.
 * ========================================================================= */

var TAB_MENU = 'M_Menu';
var TAB_MENU_BAHAN = 'M_MenuBahan';
var TAB_PENJUALAN = 'Data_Penjualan';
var PANJANG_MENU_MAKS = 60;
var MENU_BAHAN_MAKS = 40;
var TARGET_FOOD_COST_AWAL = 35;
var BAHAN_KECIL_AWAL = 3;
var BAHAN_KECIL_MAKS = 15;
var BULAN_GRAFIK_HPP = 6;
var URUTAN_PENJUALAN = [['Tanggal', false], ['timestamp_server', true]];
var KETERANGAN_TARGET_FOOD_COST = 'Target food cost (%). Menu dan bulan di atas angka ini ditandai. Diubah dari Pengaturan → Outlet dan jadwal.';
var KETERANGAN_BAHAN_KECIL = 'Bahan kecil (%): bumbu, minyak, dan garnish yang ditambahkan ke HPP semua menu. Diubah dari Pengaturan → Outlet dan jadwal.';

/** Persen dari M_Konfigurasi: angka di antara min dan maks (satu angka di belakang koma), selain itu nilai awal. */
function persenKonfigurasi_(nilai, awal, min, maks) {
  var t = String(nilai == null ? '' : nilai).trim().replace(',', '.');
  var n = Number(t);
  if (t === '' || !isFinite(n) || n < min || n > maks) return awal;
  return Math.round(n * 10) / 10;
}

function targetFoodCost_(n) {
  return persenKonfigurasi_((n || bacaKonfigurasi_().nilai).target_food_cost, TARGET_FOOD_COST_AWAL, 1, 100);
}

function bahanKecilPersen_(n) {
  return persenKonfigurasi_((n || bacaKonfigurasi_().nilai).bahan_kecil_persen, BAHAN_KECIL_AWAL, 0, BAHAN_KECIL_MAKS);
}

/** Persen dari isian Pengaturan: angka min sampai maks, satu angka di belakang koma; null jika salah. */
function persenIsian_(nilai, min, maks) {
  var t = String(nilai == null ? '' : nilai).trim().replace(',', '.');
  var n = Number(t);
  if (t === '' || !isFinite(n) || n < min || n > maks) return null;
  return Math.round(n * 10) / 10;
}

/** "35%" / "37,2%" */
function persenId_(n) {
  return n == null ? '–' : String(Math.round(n * 10) / 10).replace('.', ',') + '%';
}

/**
 * Menu dari M_Menu dan M_MenuBahan: { ada (kedua tab ada), menu: { namaKecil:
 * { nama, hargaJual, aktif, nomor, bahan: [{ item, qty, hasilBersih }] } } }.
 * Bahan dihubungkan lewat Nama Menu. Hasil Bersih kosong = 100%. Nama yang
 * tertulis dua kali (diisi tangan): baris yang lebih atas dipakai.
 */
function bacaMenu_() {
  var t = bacaTabel_(TAB_MENU);
  var tb = bacaTabel_(TAB_MENU_BAHAN);
  var hasil = { ada: !!(t && tb), menu: {} };
  if (!t || !tb) return hasil;
  t.baris.forEach(function (b, i) {
    var nama = rapikanTeks_(nilai_(t, b, 'Nama Menu'));
    if (!nama || hasil.menu[nama.toLowerCase()]) return;
    hasil.menu[nama.toLowerCase()] = {
      nama: nama,
      hargaJual: angkaAtauNull_(nilai_(t, b, 'Harga Jual (Rp)')),
      aktif: benar_(nilai_(t, b, 'Aktif')),
      nomor: i + 2,
      bahan: []
    };
  });
  tb.baris.forEach(function (b) {
    var m = hasil.menu[rapikanTeks_(nilai_(tb, b, 'Nama Menu')).toLowerCase()];
    var item = rapikanTeks_(nilai_(tb, b, 'Item Bahan'));
    var qty = angkaAtauNull_(nilai_(tb, b, 'Qty per Porsi'));
    if (!m || !item || !(qty > 0)) return;
    var hasilBersih = angkaAtauNull_(nilai_(tb, b, 'Hasil Bersih (%)'));
    m.bahan.push({ item: item, qty: qty, hasilBersih: hasilBersih > 0 && hasilBersih <= 100 ? hasilBersih : 100 });
  });
  return hasil;
}

/** Menu aktif yang memakai item itu sebagai bahan (nama menu, urut abjad). */
function menuPemakai_(menu, kecil) {
  return Object.keys(menu).filter(function (k) {
    return menu[k].aktif && menu[k].bahan.some(function (b) { return b.item.toLowerCase() === kecil; });
  }).map(function (k) { return menu[k].nama; }).sort(function (a, b) { return a.localeCompare(b, 'id'); });
}

/**
 * HPP satu menu (Bagian 5.9). master: item dengan harga yang berlaku pada
 * tanggal yang dinilai, barang jadi tanpa harga sudah diisi dari resepnya
 * (lengkapiHargaResep_). Bahan yang dibeli = takaran bersih ÷ hasil bersih;
 * HPP = biaya bahan × (1 + bahan kecil %). Jika satu bahan belum punya harga,
 * HPP tidak dihitung (lengkap: false). target dalam persen.
 */
function hppMenu_(menu, master, kecilPersen, target) {
  var masalah = [];
  var tanpaHarga = [];
  var biayaBahan = 0;
  var bahan = menu.bahan.map(function (b) {
    var m = master[b.item.toLowerCase()];
    if (!m) masalah.push('Bahan ' + b.item + ' tidak ada di daftar item.');
    else if (!m.aktif) masalah.push('Bahan ' + m.nama + ' nonaktif.');
    var harga = m ? m.harga : null;
    var beli = b.qty / (b.hasilBersih / 100);
    var biaya = harga == null ? null : beli * harga;
    if (harga == null) tanpaHarga.push(m ? m.nama : b.item);
    else biayaBahan += biaya;
    return {
      item: m ? m.nama : b.item, qty: b.qty, hasilBersih: b.hasilBersih, satuan: m ? m.satuan : '',
      harga: harga, hargaDariResep: !!(m && m.hargaDariResep), beli: bulat_(beli),
      biaya: biaya == null ? null : Math.round(biaya * 100) / 100
    };
  });
  var lengkap = !tanpaHarga.length && bahan.length > 0;
  var kecil = lengkap ? biayaBahan * kecilPersen / 100 : null;
  var hpp = lengkap ? biayaBahan + kecil : null;
  var jual = menu.hargaJual;
  var foodCost = hpp != null && jual > 0 ? Math.round(hpp / jual * 1000) / 10 : null;
  return {
    nama: menu.nama,
    hargaJual: jual,
    aktif: menu.aktif,
    bahan: bahan,
    biayaBahan: lengkap ? Math.round(biayaBahan * 100) / 100 : null,
    bahanKecil: kecil == null ? null : Math.round(kecil * 100) / 100,
    hpp: hpp == null ? null : Math.round(hpp * 100) / 100,
    foodCost: foodCost,
    margin: hpp != null && jual != null ? Math.round((jual - hpp) * 100) / 100 : null,
    hargaTarget: hpp != null ? Math.ceil(hpp / (target / 100) / 100) * 100 : null,
    diAtasTarget: foodCost != null && foodCost > target,
    lengkap: lengkap,
    tanpaHarga: tanpaHarga,
    masalah: masalah
  };
}

/** HPP semua menu (aktif saja jika hanyaAktif) dengan harga yang berlaku pada tanggal itu. */
function hppSemuaMenu_(tanggal, hanyaAktif, konf) {
  var data = bacaMenu_();
  var n = konf || bacaKonfigurasi_().nilai;
  var target = targetFoodCost_(n);
  var kecil = bahanKecilPersen_(n);
  var master = lengkapiHargaResep_(itemPadaTanggal_(tanggal));
  return Object.keys(data.menu).filter(function (k) { return !hanyaAktif || data.menu[k].aktif; }).map(function (k) {
    return hppMenu_(data.menu[k], master, kecil, target);
  });
}

/** Urutan Per menu: food cost tertinggi dulu; menu yang belum lengkap di bawah, abjad. */
function urutMenuFoodCost_(a, b) {
  var fa = a.foodCost == null ? -1 : a.foodCost;
  var fb = b.foodCost == null ? -1 : b.foodCost;
  return fb - fa || a.nama.localeCompare(b.nama, 'id');
}

/** Jawaban Pengaturan → Menu: semua menu (aktif dulu, abjad), daftar item dengan harga hari ini, target, dan bahan kecil. */
function dataMenu_() {
  var hari = hariIni_();
  var data = bacaMenu_();
  var n = bacaKonfigurasi_().nilai;
  var target = targetFoodCost_(n);
  var kecil = bahanKecilPersen_(n);
  var master = lengkapiHargaResep_(itemPadaTanggal_(hari));
  var menu = Object.keys(data.menu).map(function (k) {
    return hppMenu_(data.menu[k], master, kecil, target);
  }).sort(function (a, b) {
    return (b.aktif ? 1 : 0) - (a.aktif ? 1 : 0) || a.nama.localeCompare(b.nama, 'id');
  });
  var item = Object.keys(master).map(function (k) {
    var m = master[k];
    return { nama: m.nama, kategori: m.kategori, satuan: m.satuan, harga: m.harga, hargaDariResep: !!m.hargaDariResep, aktif: m.aktif };
  }).sort(function (a, b) { return a.nama.localeCompare(b.nama, 'id'); });
  return { siap: data.ada, hariIni: hari, menu: menu, item: item, target: target, bahanKecilPersen: kecil };
}

function aksiDaftarMenu_() {
  return dataMenu_();
}

function wajibTabMenu_() {
  if (!bacaMenu_().ada) {
    throw galatPengguna_('Tab ' + TAB_MENU + ' dan ' + TAB_MENU_BAHAN + ' belum ada. Minta pemilik Sheet menjalankan ulang setupSpreadsheet.');
  }
}

/** Menulis ulang baris M_MenuBahan satu menu (baris menu lain tetap, urutannya tidak berubah). */
function tulisBahanMenu_(kecilLama, nama, bahan) {
  var sheet = ambilTab_(TAB_MENU_BAHAN);
  var kol = posisiKolom_(sheet, { menu: 'Nama Menu', bahan: 'Item Bahan', qty: 'Qty per Porsi', hasil: 'Hasil Bersih (%)' });
  var lebar = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();
  var semua = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, lebar).getValues() : [];
  var tetap = semua.filter(function (b) {
    return kunciTerisi_(b[kol.menu - 1]) && rapikanTeks_(b[kol.menu - 1]).toLowerCase() !== kecilLama;
  });
  bahan.forEach(function (x) {
    var baris = [];
    for (var i = 0; i < lebar; i++) baris.push('');
    baris[kol.menu - 1] = nama;
    baris[kol.bahan - 1] = x.item;
    baris[kol.qty - 1] = x.qty;
    baris[kol.hasil - 1] = x.hasilBersih;
    tetap.push(baris);
  });
  var perlu = tetap.length + 1;
  if (sheet.getMaxRows() < perlu) sheet.insertRowsAfter(sheet.getMaxRows(), perlu - sheet.getMaxRows());
  if (tetap.length) sheet.getRange(2, 1, tetap.length, lebar).setValues(tetap);
  if (semua.length > tetap.length) sheet.getRange(tetap.length + 2, 1, semua.length - tetap.length, lebar).clearContent();
}

/**
 * Simpan menu (Pengaturan → Menu), khusus Pengelola. body: { baru, namaLama,
 * nama, hargaJual, bahan: [{ item, qty, hasilBersih }] }. Nama unik (huruf
 * besar/kecil tidak dibedakan) dan boleh diganti, karena menu tidak dirujuk
 * catatan mana pun. Bahan: item aktif, tidak ganda, takaran bersih lebih dari
 * 0 dalam satuan dasar, hasil bersih di atas 0 sampai 100 (kosong = 100).
 * Menu baru langsung aktif. Perubahan harga jual tercatat di Log_Perubahan.
 */
function aksiSimpanMenu_(body, pengguna) {
  var nama = periksaNama_(body.nama, 'Nama menu', PANJANG_MENU_MAKS);
  if (body.hargaJual === '' || body.hargaJual == null) throw galatPengguna_('Isi harga jual.');
  var jual = angkaOpsional_(body.hargaJual, 'Harga jual', 2);
  if (!(jual > 0)) throw galatPengguna_('Harga jual harus lebih dari 0.');
  var master = bacaItem_();
  var masukan = Array.isArray(body.bahan) ? body.bahan : [];
  if (!masukan.length) throw galatPengguna_('Tambah minimal satu bahan.');
  if (masukan.length > MENU_BAHAN_MAKS) throw galatPengguna_('Bahan terlalu banyak untuk satu menu.');
  var sudah = {};
  var bahan = masukan.map(function (b) {
    var mb = master[rapikanTeks_(b && b.item).toLowerCase()];
    if (!mb) throw galatPengguna_('Bahan ' + rapikanTeks_(b && b.item) + ' tidak ada di daftar item. Muat ulang layar ini.');
    if (!mb.aktif) throw galatPengguna_('Bahan ' + mb.nama + ' nonaktif. Pilih bahan yang aktif.');
    var k = mb.nama.toLowerCase();
    if (sudah[k]) throw galatPengguna_(mb.nama + ' tertulis dua kali. Gabungkan takarannya di satu baris.');
    sudah[k] = true;
    if (b.qty === '' || b.qty == null) throw galatPengguna_('Isi takaran ' + mb.nama + ' per porsi.');
    var qty = angkaIsian_(b.qty, 'Takaran ' + mb.nama);
    if (!qty) throw galatPengguna_('Takaran ' + mb.nama + ' per porsi harus lebih dari 0.');
    var hasil = b.hasilBersih === '' || b.hasilBersih == null ? 100 : persenIsian_(b.hasilBersih, 0.1, 100);
    if (hasil == null) throw galatPengguna_('Hasil bersih ' + mb.nama + ' diisi persen di atas 0 sampai 100, misalnya 85.');
    return { item: mb.nama, qty: qty, hasilBersih: hasil };
  });

  return denganKunci_(function () {
    wajibTabMenu_();
    var data = bacaMenu_();
    var lama = null;
    if (!body.baru) {
      lama = data.menu[rapikanTeks_(body.namaLama).toLowerCase()] || null;
      if (!lama) throw galatPengguna_('Menu ' + rapikanTeks_(body.namaLama) + ' tidak ditemukan. Kembali ke daftar menu.');
    }
    var ada = data.menu[nama.toLowerCase()];
    if (ada && ada !== lama) {
      throw galatPengguna_('Menu ' + ada.nama + ' sudah ada' + (ada.aktif ? '' : ' tetapi nonaktif') + '. ' +
        (ada.aktif ? 'Pakai nama lain.' : 'Buka ' + ada.nama + ' di daftar menu untuk mengaktifkannya lagi.'));
    }
    var t = wajibTabel_(TAB_MENU);
    if (lama) {
      tulisBarisMaster_(t, lama.nomor, { 'Nama Menu': nama, 'Harga Jual (Rp)': jual });
      var ubah = [];
      if (lama.nama !== nama) {
        ubah.push(['Nama Menu', lama.nama, nama]);
        gantiNamaMenuPenjualan_(lama.nama, nama);
      }
      if (lama.hargaJual !== jual) ubah.push(['Harga Jual (Rp)', lama.hargaJual == null ? '' : lama.hargaJual, jual]);
      if (ubah.length) catatLog_(TAB_MENU, nama, pengguna, new Date(), ubah);
    } else {
      tambahBarisMaster_(TAB_MENU, { 'Nama Menu': nama, 'Harga Jual (Rp)': jual, 'Aktif': true });
    }
    tulisBahanMenu_(lama ? lama.nama.toLowerCase() : nama.toLowerCase(), nama, bahan);
    var hasil = dataMenu_();
    hasil.disimpan = nama;
    return hasil;
  });
}

/** Menonaktifkan atau mengaktifkan lagi satu menu. Mengaktifkan memeriksa bahan yang nonaktif. */
function aksiAturMenuAktif_(body) {
  var aktif = body.aktif === true;
  return denganKunci_(function () {
    wajibTabMenu_();
    var m = bacaMenu_().menu[rapikanTeks_(body.nama).toLowerCase()];
    if (!m) throw galatPengguna_('Menu tidak ditemukan. Kembali ke daftar menu.');
    if (aktif) {
      var master = bacaItem_();
      m.bahan.forEach(function (b) {
        var mb = master[b.item.toLowerCase()];
        if (!mb || !mb.aktif) throw galatPengguna_('Bahan ' + b.item + ' nonaktif. Ganti bahannya dulu.');
      });
    }
    var t = wajibTabel_(TAB_MENU);
    tulisBarisMaster_(t, m.nomor, { 'Aktif': aktif });
    var hasil = dataMenu_();
    hasil.diubah = { nama: m.nama, aktif: aktif };
    return hasil;
  });
}

/* ---------- Penjualan harian ---------- */

/**
 * Data_Penjualan: { ada, tabel, hari: { 'yyyy-mm-dd': { nilai, catatan, nomor,
 * rowId, oleh, waktu } }, pertama: tanggal terawal }. Satu baris per tanggal;
 * jika satu tanggal tertulis dua kali (diisi tangan), baris yang lebih atas dipakai.
 */
function bacaPenjualan_() {
  var t = bacaTabel_(TAB_PENJUALAN);
  var hasil = { ada: !!t, tabel: t, hari: {}, pertama: '' };
  if (!t) return hasil;
  var zona = zonaSheet_();
  t.baris.forEach(function (b, i) {
    var tg = teksTanggal_(nilai_(t, b, 'Tanggal'), zona);
    var n = angkaAtauNull_(nilai_(t, b, 'Penjualan (Rp)'));
    if (!tg || n == null || hasil.hari[tg]) return;
    var w = nilai_(t, b, 'timestamp_server');
    hasil.hari[tg] = {
      nilai: n, catatan: rapikanTeks_(nilai_(t, b, 'Catatan')), nomor: i + 2, rowId: String(nilai_(t, b, 'row_id') || ''),
      oleh: rapikanTeks_(nilai_(t, b, 'updated_by')) || rapikanTeks_(nilai_(t, b, 'submitted_by')),
      waktu: isoAtauNull_(nilai_(t, b, 'updated_at')) || isoAtauNull_(w)
    };
    if (!hasil.pertama || tg < hasil.pertama) hasil.pertama = tg;
  });
  return hasil;
}

/**
 * Penjualan dari dari sampai sampai: { total, hari (tercatat), jumlahHari, kurang: [tanggal], libur: [tanggal] }.
 * Hari libur tanpa catatan penjualan (Code.gs v0.30) tidak perlu dicatat: dianggap Rp 0, tidak masuk jumlahHari
 * dan kurang, dan disebut di libur. Penjualan yang tetap dicatat pada hari libur dihitung seperti biasa.
 */
function penjualanRentang_(jual, dari, sampai) {
  var hasil = { total: 0, hari: 0, jumlahHari: 0, kurang: [], libur: [] };
  for (var d = dari; d <= sampai; d = geserTanggal_(d, 1)) {
    var x = jual.hari[d];
    if (!x && liburPada_(d)) {
      hasil.libur.push(d);
      continue;
    }
    hasil.jumlahHari++;
    if (x) {
      hasil.total += x.nilai;
      hasil.hari++;
    } else {
      hasil.kurang.push(d);
    }
  }
  hasil.total = Math.round(hasil.total);
  return hasil;
}

/**
 * Mencatat penjualan satu tanggal (khusus Pengelola). body: { tanggal,
 * penjualan, catatan, submissionId, porsi (opsional: [{ menu, porsi }], porsi
 * terjual per menu, sejak Code.gs v0.18), bulan (opsional: jawaban ditambah
 * hpp bulan itu) }. Hari ini atau tanggal yang sudah lewat. Tanggal yang sudah
 * punya catatan ditimpa dan perubahannya tercatat di Log_Perubahan.
 */
function aksiSimpanPenjualan_(body, pengguna) {
  if (!tanggalSah_(body.tanggal)) throw galatPengguna_('Tanggal tidak terbaca. Pilih tanggal lagi.');
  var tanggal = body.tanggal;
  if (tanggal > hariIni_()) throw galatPengguna_('Penjualan hanya bisa dicatat untuk hari ini atau tanggal yang sudah lewat.');
  periksaBelumDiarsip_(tanggal);
  if (body.penjualan === '' || body.penjualan == null) throw galatPengguna_('Isi penjualan. Isi 0 jika tidak ada penjualan.');
  var nilai = angkaOpsional_(body.penjualan, 'Penjualan', 2);
  var catatan = teksAman_(rapikanTeks_(body.catatan).slice(0, 200));
  var sid = typeof body.submissionId === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(body.submissionId) ? body.submissionId : Utilities.getUuid();
  var porsiMasuk = periksaPorsi_(body.porsi);

  return denganKunci_(function () {
    var jual = bacaPenjualan_();
    if (!jual.ada) throw galatPengguna_('Tab ' + TAB_PENJUALAN + ' belum ada. Minta pemilik Sheet menjalankan ulang setupSpreadsheet.');
    var t = jual.tabel;
    var lama = jual.hari[tanggal];
    var kini = new Date();
    // Porsi per menu lebih dulu: baris yang ditimpa ditulis menurut nomor barisnya, sebelum tab diurutkan.
    if (porsiMasuk.length) tulisPorsiMenu_(tanggal, porsiMasuk, pengguna, kini, sid);
    if (lama) {
      var ubah = [];
      if (lama.nilai !== nilai) ubah.push(['Penjualan (Rp)', lama.nilai, nilai]);
      if (lama.catatan !== catatan) ubah.push(['Catatan', lama.catatan, catatan]);
      if (ubah.length) {
        var baris = t.baris[lama.nomor - 2];
        ubah.forEach(function (u) { t.sheet.getRange(lama.nomor, t.kol[u[0]] + 1).setValue(u[2]); });
        if (t.kol.updated_by !== undefined) t.sheet.getRange(lama.nomor, t.kol.updated_by + 1).setValue(pengguna.nama);
        if (t.kol.updated_at !== undefined) t.sheet.getRange(lama.nomor, t.kol.updated_at + 1).setValue(kini);
        catatLog_(TAB_PENJUALAN, String(nilai_(t, baris, 'row_id') || tanggal), pengguna, kini, ubah);
      }
    } else {
      tambahBarisTabel_(t, [gabung_({
        'Tanggal': tanggalSel_(tanggal),
        'Penjualan (Rp)': nilai,
        'Catatan': catatan
      }, isiSistem_({ sid: sid, outlet: namaOutlet_(), kini: kini, waktuPerangkat: '', pengguna: pengguna }))]);
      urutkanTabel_(t, URUTAN_PENJUALAN);
    }
    var hasil = { tanggal: tanggal, penjualan: nilai, catatan: catatan, mengganti: lama ? lama.nilai : null, porsi: porsiMasuk.length };
    if (bulanSah_(body.bulan)) hasil.hpp = dataHpp_(body.bulan);
    return hasil;
  });
}

/* ---------- Penjualan per menu dan pemakaian seharusnya (Code.gs v0.18) ---------- */

var TAB_PENJUALAN_MENU = 'Data_PenjualanMenu';
var URUTAN_PENJUALAN_MENU = [['Tanggal', false], ['Nama Menu', true], ['timestamp_server', true]];
var PORSI_MAKS = 100000;

/**
 * Data_PenjualanMenu: { ada, tabel, hari: { 'yyyy-mm-dd': { menuKecil: { nama,
 * porsi, nomor, rowId } } }, pertama: tanggal terawal }. Satu baris per menu per
 * tanggal; jika tertulis dua kali (diisi tangan), baris yang lebih atas dipakai.
 */
function bacaPenjualanMenu_() {
  var t = bacaTabel_(TAB_PENJUALAN_MENU);
  var hasil = { ada: !!t, tabel: t, hari: {}, pertama: '' };
  if (!t) return hasil;
  var zona = zonaSheet_();
  t.baris.forEach(function (b, i) {
    var tg = teksTanggal_(nilai_(t, b, 'Tanggal'), zona);
    var nama = rapikanTeks_(nilai_(t, b, 'Nama Menu'));
    var porsi = angkaAtauNull_(nilai_(t, b, 'Porsi'));
    if (!tg || !nama || porsi == null) return;
    var hari = hasil.hari[tg] = hasil.hari[tg] || {};
    if (hari[nama.toLowerCase()]) return;
    hari[nama.toLowerCase()] = { nama: nama, porsi: porsi, nomor: i + 2, rowId: String(nilai_(t, b, 'row_id') || '') };
    if (!hasil.pertama || tg < hasil.pertama) hasil.pertama = tg;
  });
  return hasil;
}

/** Porsi dari HP: [{ menu, porsi }] dengan porsi bilangan bulat 0 sampai PORSI_MAKS; menu tidak boleh ganda. */
function periksaPorsi_(daftar) {
  if (daftar == null) return [];
  if (!Array.isArray(daftar) || daftar.length > 500) throw galatPengguna_('Porsi per menu tidak terbaca. Muat ulang layar, lalu coba lagi.');
  var sudah = {};
  return daftar.map(function (x) {
    var nama = rapikanTeks_(x && x.menu);
    if (!nama) throw galatPengguna_('Porsi per menu tidak terbaca. Muat ulang layar, lalu coba lagi.');
    if (sudah[nama.toLowerCase()]) throw galatPengguna_('Menu ' + nama + ' tertulis dua kali.');
    sudah[nama.toLowerCase()] = true;
    var v = x.porsi;
    var n = typeof v === 'number' ? v : Number(String(v == null ? '' : v).trim());
    if (v === '' || v == null || !isFinite(n) || n < 0 || Math.floor(n) !== n) {
      throw galatPengguna_('Porsi ' + nama + ' diisi bilangan bulat 0 atau lebih, misalnya 12.');
    }
    if (n > PORSI_MAKS) throw galatPengguna_('Porsi ' + nama + ' terlalu besar. Periksa angkanya.');
    return { menu: nama, porsi: n };
  });
}

/**
 * Menulis porsi per menu satu tanggal (di dalam kunci). Menu harus ada di M_Menu
 * (aktif atau nonaktif). Menu yang sudah punya baris pada tanggal itu ditimpa
 * (Log_Perubahan); menu yang tidak dikirim tidak berubah. Harga jual tersalin saat
 * baris dibuat, sebagai catatan.
 */
function tulisPorsiMenu_(tanggal, daftar, pengguna, kini, sid) {
  var pm = bacaPenjualanMenu_();
  if (!pm.ada) throw galatPengguna_('Tab ' + TAB_PENJUALAN_MENU + ' belum ada. Minta pemilik Sheet menjalankan ulang setupSpreadsheet.');
  var menu = bacaMenu_().menu;
  var t = pm.tabel;
  var hari = pm.hari[tanggal] || {};
  var baru = [];
  var outlet = namaOutlet_();
  daftar.forEach(function (x) {
    var k = x.menu.toLowerCase();
    var m = menu[k];
    if (!m) throw galatPengguna_('Menu ' + x.menu + ' tidak ada di daftar menu. Muat ulang layar ini.');
    var lama = hari[k];
    if (lama) {
      if (lama.porsi === x.porsi) return;
      t.sheet.getRange(lama.nomor, t.kol['Porsi'] + 1).setValue(x.porsi);
      if (t.kol.updated_by !== undefined) t.sheet.getRange(lama.nomor, t.kol.updated_by + 1).setValue(pengguna.nama);
      if (t.kol.updated_at !== undefined) t.sheet.getRange(lama.nomor, t.kol.updated_at + 1).setValue(kini);
      catatLog_(TAB_PENJUALAN_MENU, lama.rowId || tanggal + ' · ' + m.nama, pengguna, kini, [['Porsi', lama.porsi, x.porsi]]);
      return;
    }
    baru.push(gabung_({
      'Tanggal': tanggalSel_(tanggal),
      'Nama Menu': m.nama,
      'Porsi': x.porsi,
      'Harga Jual (Rp)': m.hargaJual == null ? '' : m.hargaJual
    }, isiSistem_({ sid: sid, outlet: outlet, kini: kini, waktuPerangkat: '', pengguna: pengguna })));
  });
  if (baru.length) {
    tambahBarisTabel_(t, baru);
    urutkanTabel_(t, URUTAN_PENJUALAN_MENU);
  }
}

/** Mengganti nama menu di Data_PenjualanMenu (menu diganti nama di Pengaturan → Menu; catatannya tetap milik menu itu). */
function gantiNamaMenuPenjualan_(namaLama, namaBaru) {
  var t = bacaTabel_(TAB_PENJUALAN_MENU);
  if (!t || t.kol['Nama Menu'] === undefined) return;
  var kecil = namaLama.toLowerCase();
  t.baris.forEach(function (b, i) {
    if (rapikanTeks_(nilai_(t, b, 'Nama Menu')).toLowerCase() === kecil) t.sheet.getRange(i + 2, t.kol['Nama Menu'] + 1).setValue(namaBaru);
  });
}

/**
 * Lembar Catat penjualan untuk satu tanggal (khusus Pengelola): penjualan yang
 * sudah tercatat, dan menu aktif (ditambah menu nonaktif yang punya porsi pada
 * tanggal itu) dengan porsinya. { tanggal, penjualan: { nilai, catatan } | null,
 * menu: [{ nama, hargaJual, aktif, porsi | null }], siap: { porsi }, pernahPorsi }.
 */
function aksiPenjualanTanggal_(body) {
  if (!tanggalSah_(body.tanggal)) throw galatPengguna_('Tanggal tidak terbaca. Pilih tanggal lagi.');
  var tanggal = body.tanggal;
  var jual = bacaPenjualan_();
  var pm = bacaPenjualanMenu_();
  var hari = pm.hari[tanggal] || {};
  var menu = bacaMenu_().menu;
  var daftar = Object.keys(menu).filter(function (k) { return menu[k].aktif || hari[k]; }).map(function (k) {
    var m = menu[k];
    return { nama: m.nama, hargaJual: m.hargaJual, aktif: m.aktif, porsi: hari[k] ? hari[k].porsi : null };
  }).sort(function (a, b) { return a.nama.localeCompare(b.nama, 'id'); });
  var j = jual.hari[tanggal];
  return {
    tanggal: tanggal,
    penjualan: j ? { nilai: j.nilai, catatan: j.catatan } : null,
    menu: daftar,
    siap: { porsi: pm.ada },
    pernahPorsi: !!pm.pertama,
    libur: liburUntukJawaban_(tanggal)
  };
}

/**
 * Hari dari..sampai yang belum punya porsi per menu. Hari dengan penjualan Rp 0 (tutup) tidak perlu, begitu juga
 * hari libur kecuali penjualannya tetap dicatat lebih dari 0 (Code.gs v0.30).
 */
function porsiKurang_(porsi, jual, dari, sampai) {
  var kurang = [];
  for (var d = dari; d <= sampai; d = geserTanggal_(d, 1)) {
    if (porsi.hari[d]) continue;
    var j = jual.hari[d];
    if (j && j.nilai === 0) continue;
    if (!j && liburPada_(d)) continue;
    kurang.push(d);
  }
  return kurang;
}

/**
 * Bahan mentah untuk satu porsi menu: { itemKecil: qty dalam satuan dasar }, yaitu
 * takaran bersih ÷ hasil bersih. Bahan barang jadi (punya resep aktif) dipecah
 * menjadi bahan resepnya (qty ÷ hasil per 1 resep × qty bahan), bertingkat, sama
 * seperti pemakaian nyata yang menghitung bahan saat dipakai prep. tidakBisa
 * diisi barang jadi yang resepnya tidak bisa dipakai (hasil 0, tanpa bahan, melingkar).
 */
function bahanMentahMenu_(menu, resep, tidakBisa) {
  var hasil = {};
  function tambah(kecil, qty, jejak) {
    var r = resep[kecil];
    if (!(r && r.aktif)) {
      hasil[kecil] = (hasil[kecil] || 0) + qty;
      return;
    }
    var ra = resepAktif_(resep, kecil);
    if (!ra || jejak.indexOf(kecil) >= 0) {
      tidakBisa[kecil] = true;
      return;
    }
    ra.bahan.forEach(function (b) { tambah(b.item.toLowerCase(), qty / ra.hasil * b.qty, jejak.concat([kecil])); });
  }
  menu.bahan.forEach(function (b) { tambah(b.item.toLowerCase(), b.qty / (b.hasilBersih / 100), []); });
  return hasil;
}

/**
 * Pemakaian bahan seharusnya (teoritis) dari..sampai: porsi terjual tiap hari × bahan
 * mentah per porsi (resep menu sekarang) × harga yang berlaku hari itu, ditambah
 * bahan kecil %. ctx: konteksHpp_ (porsi, menu, resep, master, kecilPersen).
 */
function pemakaianTeoritis_(ctx, dari, sampai) {
  var hasil = { bahan: 0, kecil: 0, total: 0, porsi: 0, perMenu: {}, perItem: {}, tanpaHarga: [], tidakBisa: [], menuTakDikenal: [] };
  var simpan = {};
  var tidakBisa = {};
  var tanpa = {};
  var takDikenal = {};
  for (var d = dari; d <= sampai; d = geserTanggal_(d, 1)) {
    var hari = ctx.porsi.hari[d];
    if (!hari) continue;
    Object.keys(hari).forEach(function (k) {
      var x = hari[k];
      if (!(x.porsi > 0)) return;
      var menu = ctx.menu.menu[k];
      var pm = hasil.perMenu[k] = hasil.perMenu[k] || { nama: menu ? menu.nama : x.nama, porsi: 0 };
      pm.porsi += x.porsi;
      hasil.porsi += x.porsi;
      if (!menu) {
        takDikenal[x.nama] = true;
        return;
      }
      var mentah = simpan[k] = simpan[k] || bahanMentahMenu_(menu, ctx.resep, tidakBisa);
      Object.keys(mentah).forEach(function (ik) {
        var m = ctx.master[ik];
        var qty = mentah[ik] * x.porsi;
        var it = hasil.perItem[ik] = hasil.perItem[ik] || { qty: 0, nilai: 0 };
        it.qty += qty;
        var h = m ? hargaPada_(m, d) : null;
        if (h == null) {
          tanpa[m ? m.nama : ik] = true;
          return;
        }
        it.nilai += qty * h;
        hasil.bahan += qty * h;
      });
    });
  }
  hasil.kecil = hasil.bahan * ctx.kecilPersen / 100;
  hasil.total = hasil.bahan + hasil.kecil;
  var nama = function (k) { return ctx.master[k] ? ctx.master[k].nama : k; };
  var abjad = function (a, b) { return a.localeCompare(b, 'id'); };
  hasil.tanpaHarga = Object.keys(tanpa).sort(abjad);
  hasil.tidakBisa = Object.keys(tidakBisa).map(nama).sort(abjad);
  hasil.menuTakDikenal = Object.keys(takDikenal).sort(abjad);
  return hasil;
}

/**
 * Seharusnya vs nyata untuk satu rentang HPP (Bagian 5.9): pemakaian bahan seharusnya
 * dari porsi terjual dibanding pemakaian nyata (pemakaianBahan_). Selisih = nyata −
 * seharusnya; plus berarti bahan terpakai lebih banyak dari porsi yang terjual (bocor,
 * porsi berlebih, waste, atau pencatatan keliru). Hanya dibandingkan jika setiap hari
 * punya porsi per menu (lengkap). pakai: hasil pemakaianBahan_; jual: penjualanRentang_.
 */
function bandingTeoritis_(ctx, r, pakai, jual) {
  var ada = r.sampai >= r.dari;
  var t = ada ? pemakaianTeoritis_(ctx, r.dari, r.sampai) : pemakaianTeoritis_(ctx, r.dari, geserTanggal_(r.dari, -1));
  var kurang = ada ? porsiKurang_(ctx.porsi, ctx.jual, r.dari, r.sampai) : [];
  var lengkap = ada && !kurang.length;
  var peta = pakai.peta || {};
  var nyataMenu = 0;
  var item = Object.keys(t.perItem).map(function (k) {
    var m = ctx.master[k];
    var x = t.perItem[k];
    var a = peta[k] || { qty: 0, nilai: 0 };
    nyataMenu += a.nilai;
    return {
      nama: m ? m.nama : k, satuan: m ? m.satuan : '',
      seharusnya: bulat_(x.qty), nyata: bulat_(a.qty), selisih: bulat_(a.qty - x.qty),
      nilaiSeharusnya: Math.round(x.nilai), nilaiNyata: Math.round(a.nilai), selisihRp: Math.round(a.nilai - x.nilai)
    };
  }).sort(function (a, b) { return Math.abs(b.selisihRp) - Math.abs(a.selisihRp) || a.nama.localeCompare(b.nama, 'id'); });
  var perMenu = Object.keys(t.perMenu).map(function (k) { return t.perMenu[k]; }).sort(function (a, b) {
    return b.porsi - a.porsi || a.nama.localeCompare(b.nama, 'id');
  });
  var total = Math.round(t.total);
  var nyata = pakai.total;
  var fcBisa = lengkap && jual.jumlahHari && !jual.kurang.length && jual.total > 0;
  return {
    siap: ctx.porsi.ada,
    pernah: !!ctx.porsi.pertama,
    lengkap: lengkap,
    kurang: kurang,
    porsi: t.porsi,
    kecilPersen: ctx.kecilPersen,
    perMenu: perMenu,
    seharusnya: { bahan: Math.round(t.bahan), kecil: Math.round(t.kecil), total: total },
    nyata: nyata,
    selisih: lengkap ? nyata - total : null,
    selisihPersen: lengkap && total > 0 ? Math.round((nyata - total) / total * 1000) / 10 : null,
    foodCostSeharusnya: fcBisa ? Math.round(t.total / jual.total * 1000) / 10 : null,
    bahanMenu: { seharusnya: Math.round(t.bahan), nyata: Math.round(nyataMenu) },
    bahanLain: { seharusnya: Math.round(t.kecil), nyata: Math.round(nyata - nyataMenu) },
    item: item.slice(0, 10),
    jumlahItem: item.length,
    tanpaHarga: t.tanpaHarga,
    tidakBisa: t.tidakBisa,
    menuTakDikenal: t.menuTakDikenal
  };
}

/* ---------- Food cost per bulan ---------- */

/**
 * Stok pembuka per item per tanggal dari Data_Penyesuaian (alasan "Stok
 * pembuka"): { 'namaKecil|yyyy-mm-dd': selisih }. Stok pembuka adalah barang
 * yang sudah ada sebelum dicatat, bukan selisih stock, jadi tidak mengurangi
 * pemakaian bahan.
 */
function stokPembuka_() {
  var t = bacaTabel_('Data_Penyesuaian');
  var hasil = {};
  if (!t) return hasil;
  var zona = zonaSheet_();
  t.baris.forEach(function (b) {
    if (rapikanTeks_(nilai_(t, b, 'Alasan')) !== ALASAN_PENYESUAIAN[0]) return;
    var tg = teksTanggal_(nilai_(t, b, 'Tanggal'), zona);
    var nama = rapikanTeks_(nilai_(t, b, 'Nama Item')).toLowerCase();
    if (!tg || !nama) return;
    var kunci = nama + '|' + tg;
    hasil[kunci] = (hasil[kunci] || 0) + (Number(nilai_(t, b, 'Selisih')) || 0);
  });
  return hasil;
}

/** Estimasi kerugian yang tercatat di Data_Waste: [{ tanggal, kecil (nama item huruf kecil), rp }]. */
function nilaiWasteTercatat_() {
  var t = bacaTabel_('Data_Waste');
  if (!t) return [];
  var zona = zonaSheet_();
  return t.baris.map(function (b) {
    return { tanggal: teksTanggal_(nilai_(t, b, 'Tanggal'), zona), kecil: rapikanTeks_(nilai_(t, b, 'Item / Produk')).toLowerCase(),
      rp: Number(nilai_(t, b, 'Estimasi Kerugian (Rp)')) || 0 };
  }).filter(function (x) { return x.tanggal && x.kecil; });
}

/**
 * Bahan yang dipakai pada satu periode (Bagian 5.9), dari rekap Stock_Harian:
 * untuk item yang bukan hasil resep aktif, tiap hari (Stock Keluar + Dipakai
 * Prep − Hasil Prep) + Waste − Penyesuaian, × harga yang berlaku hari itu.
 * Barang jadi tidak dihitung lagi (biayanya terhitung saat bahannya dipakai);
 * waste barang jadi hanya dilaporkan (estimasi yang tercatat). Stok pembuka tidak dihitung sebagai
 * selisih stock. Cek silang: nilai stock bahan awal + nilai masuk + stok
 * pembuka − nilai stock bahan akhir + selisih karena perubahan harga.
 * ctx: { master, rekap, resep, urutKat, namaKat, pembuka, waste }.
 */
function pemakaianBahan_(ctx, dari, sampai) {
  // peta: { itemKecil: { qty, nilai } } untuk setiap bahan, dipakai perbandingan seharusnya vs nyata.
  var hasil = { terpakai: 0, waste: 0, selisihStock: 0, total: 0, wasteBarangJadi: 0, masuk: 0, stokPembuka: 0,
    perKategori: [], bahanTerbesar: [], tanpaHarga: [], cek: null, peta: {} };
  if (sampai < dari) return hasil;
  var perKat = {};
  var perItem = [];
  var tanpa = {};
  var kunciBahan = {};
  var sebelum = geserTanggal_(dari, -1);
  var awal = 0;
  var akhir = 0;
  Object.keys(ctx.master).forEach(function (k) {
    var m = ctx.master[k];
    var bahan = !(ctx.resep[k] && ctx.resep[k].aktif);
    var rekapItem = ctx.rekap.item[k] || [];
    if (bahan) {
      kunciBahan[k] = true;
      var ha = hargaPada_(m, sebelum);
      var sa = posisiStock_(rekapItem, sebelum).akhir;
      if (ha != null) awal += sa * ha;
      var hz = hargaPada_(m, sampai);
      var sz = posisiStock_(rekapItem, sampai).akhir;
      if (hz != null) akhir += sz * hz;
    }
    var x = { nama: m.nama, satuan: m.satuan, kategori: m.kategori, qty: 0, nilai: 0 };
    if (bahan) hasil.peta[k] = x;
    rekapItem.forEach(function (r) {
      if (r.tanggal < dari || r.tanggal > sampai) return;
      if (!bahan) return;
      var h = hargaPada_(m, r.tanggal);
      var pakai = r.keluar + r.dipakaiPrep - r.hasilPrep;
      var pembuka = (ctx.pembuka || {})[k + '|' + r.tanggal] || 0;
      var lain = r.penyesuaian - pembuka;
      var qty = pakai + r.waste - lain;
      if (h == null) {
        if (qty || r.masuk) tanpa[m.nama] = true;
        return;
      }
      hasil.terpakai += pakai * h;
      hasil.waste += r.waste * h;
      hasil.selisihStock -= lain * h;
      hasil.masuk += r.masuk * h;
      hasil.stokPembuka += pembuka * h;
      x.qty += qty;
      x.nilai += qty * h;
    });
    if (!bahan || !x.nilai) return;
    var kat = ctx.namaKat[String(m.kategori).toLowerCase()] || m.kategori || 'Tanpa kategori';
    var g = perKat[kat.toLowerCase()] = perKat[kat.toLowerCase()] || { kategori: kat, nilai: 0 };
    g.nilai += x.nilai;
    perItem.push(x);
  });
  hasil.total = hasil.terpakai + hasil.waste + hasil.selisihStock;
  (ctx.waste || []).forEach(function (w) {
    if (w.tanggal >= dari && w.tanggal <= sampai && !kunciBahan[w.kecil] && ctx.master[w.kecil]) hasil.wasteBarangJadi += w.rp;
  });
  var selisih = selisihHarga_(ctx.master, ctx.rekap, dari, sampai);
  var sh = 0;
  var nSh = 0;
  selisih.item.forEach(function (s) {
    if (!kunciBahan[s.nama.toLowerCase()]) return;
    sh += s.selisih;
    nSh++;
  });
  var cekTotal = awal + hasil.masuk + hasil.stokPembuka - akhir + sh;
  hasil.cek = {
    awal: Math.round(awal), masuk: Math.round(hasil.masuk), stokPembuka: Math.round(hasil.stokPembuka), akhir: Math.round(akhir),
    selisihHarga: Math.round(sh),
    tanggalAwal: sebelum, tanggalAkhir: sampai,
    beda: Math.round(hasil.total - cekTotal),
    // Selisih harga dibulatkan per item, jadi beda beberapa rupiah masih dianggap sama.
    cocok: Math.abs(hasil.total - cekTotal) <= 1 + nSh
  };
  ['terpakai', 'waste', 'selisihStock', 'total', 'wasteBarangJadi', 'masuk', 'stokPembuka'].forEach(function (j) { hasil[j] = Math.round(hasil[j]); });
  var posisi = function (nama) {
    var u = ctx.urutKat[nama.toLowerCase()];
    return u == null ? 1e6 : u;
  };
  hasil.perKategori = Object.keys(perKat).map(function (k) {
    return { kategori: perKat[k].kategori, nilai: Math.round(perKat[k].nilai) };
  }).filter(function (x) { return x.nilai; }).sort(function (a, b) {
    return b.nilai - a.nilai || posisi(a.kategori) - posisi(b.kategori);
  });
  hasil.bahanTerbesar = perItem.sort(function (a, b) { return b.nilai - a.nilai; }).slice(0, 10).map(function (x) {
    return { nama: x.nama, satuan: x.satuan, qty: bulat_(x.qty), nilai: Math.round(x.nilai) };
  });
  hasil.tanpaHarga = Object.keys(tanpa).sort(function (a, b) { return a.localeCompare(b, 'id'); });
  return hasil;
}

/** Bahan yang dibaca sekali untuk beberapa bulan HPP. */
function konteksHpp_() {
  var urutKat = {};
  var namaKat = {};
  bacaSemuaKategori_().forEach(function (k, i) {
    urutKat[k.nama.toLowerCase()] = i;
    namaKat[k.nama.toLowerCase()] = k.nama;
  });
  return { master: bacaItem_(), rekap: bacaRekap_(), resep: bacaResep_(), urutKat: urutKat, namaKat: namaKat,
    pembuka: stokPembuka_(), waste: nilaiWasteTercatat_(), jual: bacaPenjualan_(), hari: hariIni_(),
    porsi: bacaPenjualanMenu_(), menu: bacaMenu_(), kecilPersen: bahanKecilPersen_() };
}

/** Rentang yang dinilai untuk satu bulan: bulan berjalan sampai kemarin (hari ini belum closing). */
function rentangHpp_(bulan, hari) {
  var dari = bulan + '-01';
  var akhir = akhirBulan_(bulan);
  var berjalan = akhir >= hari;
  return { dari: dari, sampai: berjalan ? geserTanggal_(hari, -1) : akhir, akhirBulan: akhir, berjalan: berjalan };
}

/** Food cost satu bulan: { pemakaian, penjualan, foodCost } (foodCost null jika penjualan belum lengkap atau 0). */
function foodCostBulan_(ctx, bulan) {
  var r = rentangHpp_(bulan, ctx.hari);
  var pakai = pemakaianBahan_(ctx, r.dari, r.sampai);
  var jual = r.sampai >= r.dari ? penjualanRentang_(ctx.jual, r.dari, r.sampai) : { total: 0, hari: 0, jumlahHari: 0, kurang: [], libur: [] };
  var fc = jual.jumlahHari && !jual.kurang.length && jual.total > 0 ? Math.round(pakai.total / jual.total * 1000) / 10 : null;
  return { rentang: r, pemakaian: pakai, penjualan: jual, foodCost: fc };
}

/**
 * Jawaban layar HPP dan food cost untuk satu bulan "yyyy-mm" (Bagian 5.9):
 * pemakaian bahan dan rinciannya, cek silang, penjualan, food cost, food
 * cost 6 bulan sampai bulan itu, dan HPP menu aktif (harga hari ini untuk
 * bulan berjalan, harga hari terakhir untuk bulan yang sudah lewat).
 */
function dataHpp_(bulan) {
  var ctx = konteksHpp_();
  if (!bulanSah_(bulan)) bulan = ctx.hari.slice(0, 7);
  if (bulan + '-01' > ctx.hari) throw galatPengguna_('Bulan ' + namaBulanId_(bulan) + ' belum dimulai. Pilih bulan lain.');
  periksaBelumDiarsip_(bulan + '-01');
  var n = bacaKonfigurasi_().nilai;
  var target = targetFoodCost_(n);
  var x = foodCostBulan_(ctx, bulan);
  var r = x.rentang;
  var grafik = [];
  for (var i = BULAN_GRAFIK_HPP - 1; i >= 0; i--) {
    var b = bulan;
    for (var j = 0; j < i; j++) b = bulanLalu_(b + '-01');
    var g = b === bulan ? x : foodCostBulan_(ctx, b);
    grafik.push({ bulan: b, foodCost: g.foodCost, pemakaian: g.pemakaian.total, penjualan: g.penjualan.total,
      lengkap: g.penjualan.jumlahHari > 0 && !g.penjualan.kurang.length });
  }
  var terakhir = Object.keys(ctx.jual.hari).sort().reverse().slice(0, 3).map(function (t) {
    var p = ctx.jual.hari[t];
    return { tanggal: t, nilai: p.nilai, catatan: p.catatan, oleh: p.oleh };
  });
  var dataMenu = ctx.menu;
  var banding = bandingTeoritis_(ctx, r, x.pemakaian, x.penjualan);
  var porsiMenu = {};
  banding.perMenu.forEach(function (m) { porsiMenu[m.nama.toLowerCase()] = m.porsi; });
  var menu = hppSemuaMenu_(r.berjalan ? ctx.hari : r.akhirBulan, true, n).sort(urutMenuFoodCost_);
  // Porsi terjual bulan itu per menu (null sebelum porsi per menu pernah dicatat).
  menu.forEach(function (m) { m.porsi = banding.pernah ? porsiMenu[m.nama.toLowerCase()] || 0 : null; });
  var p = x.pemakaian;
  return {
    bulan: bulan, nama: namaBulanId_(bulan), dari: r.dari, sampai: r.sampai, berjalan: r.berjalan, hariIni: ctx.hari,
    target: target, bahanKecilPersen: bahanKecilPersen_(n),
    pemakaian: { terpakai: p.terpakai, waste: p.waste, selisihStock: p.selisihStock, total: p.total, wasteBarangJadi: p.wasteBarangJadi,
      stokPembuka: p.stokPembuka },
    cekSilang: p.cek,
    penjualan: gabung_(x.penjualan, { terakhir: terakhir, pernah: !!ctx.jual.pertama }),
    foodCost: x.foodCost,
    perKategori: p.perKategori,
    bahanTerbesar: p.bahanTerbesar,
    tanpaHarga: p.tanpaHarga,
    grafik: grafik,
    menu: menu,
    teoritis: banding,
    siap: { menu: dataMenu.ada, penjualan: ctx.jual.ada, porsi: ctx.porsi.ada }
  };
}

function aksiHpp_(body) {
  return dataHpp_(String(body.bulan || ''));
}

/**
 * Ringkasan HPP untuk Dashboard: food cost bulan ini, penjualan yang belum
 * dicatat sejak penjualan pertama (untuk pengingat), dan menu di atas target.
 */
function ringkasHppDashboard_(tanggal) {
  var ctx = konteksHpp_();
  var bulan = ctx.hari.slice(0, 7);
  var x = foodCostBulan_(ctx, bulan);
  var n = bacaKonfigurasi_().nilai;
  var kurang = [];
  if (ctx.jual.pertama) {
    var mulai = ctx.jual.pertama > x.rentang.dari ? ctx.jual.pertama : x.rentang.dari;
    if (mulai <= x.rentang.sampai) kurang = penjualanRentang_(ctx.jual, mulai, x.rentang.sampai).kurang;
  }
  // Porsi per menu (sejak dipakai): hari yang belum punya porsi ikut diingatkan.
  var porsiKurang = [];
  if (ctx.porsi.pertama) {
    var mulaiPorsi = ctx.porsi.pertama > x.rentang.dari ? ctx.porsi.pertama : x.rentang.dari;
    if (mulaiPorsi <= x.rentang.sampai) porsiKurang = porsiKurang_(ctx.porsi, ctx.jual, mulaiPorsi, x.rentang.sampai);
  }
  var sudahKurang = {};
  kurang.forEach(function (t) { sudahKurang[t] = true; });
  var hanyaPorsi = porsiKurang.filter(function (t) { return !sudahKurang[t]; });
  kurang = kurang.concat(hanyaPorsi).sort();
  var diAtas = hppSemuaMenu_(tanggal, true, n).filter(function (m) { return m.diAtasTarget; }).sort(urutMenuFoodCost_);
  return {
    bulan: bulan, nama: namaBulanId_(bulan), foodCost: x.foodCost, target: targetFoodCost_(n),
    penjualanKurang: kurang, porsiKurang: hanyaPorsi, kemarin: geserTanggal_(ctx.hari, -1),
    menuDiAtas: diAtas.map(function (m) { return { nama: m.nama, foodCost: m.foodCost }; })
  };
}

/* =========================================================================
 * Tahap 8: stock opname (spesifikasi sistem Bagian 5.7, tampilan Bagian
 * 5.8) dan daftar belanja (sistem Bagian 9.2, tampilan Bagian 5.9)
 * ========================================================================= */

var ALASAN_OPNAME = 'Stock opname';
/** Opname lewat jadwal jika hari sejak opname terakhir lebih dari ini. */
var BATAS_HARI_OPNAME = { mingguan: 7, bulanan: 31 };
var URUTAN_OPNAME = [['Tanggal', false], ['Kategori', true], ['Nama Item', true], ['timestamp_server', true]];

/** Selisih hari antara dua tanggal yyyy-mm-dd (b − a). */
function selisihHari_(a, b) {
  var pa = String(a).split('-');
  var pb = String(b).split('-');
  return Math.round((Date.UTC(Number(pb[0]), Number(pb[1]) - 1, Number(pb[2])) -
    Date.UTC(Number(pa[0]), Number(pa[1]) - 1, Number(pa[2]))) / 86400000);
}

/**
 * Opname terakhir dan jadwalnya (Bagian 5.7): { terakhir: { id, tanggal, oleh,
 * waktu } | null, jadwal, batasHari, hariLalu, lewat }. lewat: belum pernah
 * ada opname, atau hari sejak opname terakhir lebih dari 7 (mingguan) atau
 * 31 (bulanan).
 */
function statusOpname_() {
  var jadwal = String(bacaKonfigurasi_().nilai.jadwal_opname || '').trim().toLowerCase();
  if (!BATAS_HARI_OPNAME[jadwal]) jadwal = 'mingguan';
  var hasil = { terakhir: null, jadwal: jadwal, batasHari: BATAS_HARI_OPNAME[jadwal], hariLalu: null, lewat: true };
  var t = bacaTabel_('Data_Opname');
  if (t) {
    var zona = zonaSheet_();
    t.baris.forEach(function (b) {
      var tg = teksTanggal_(nilai_(t, b, 'Tanggal'), zona);
      var w = nilai_(t, b, 'timestamp_server');
      var ms = w instanceof Date ? w.getTime() : 0;
      if (!tg) return;
      var x = hasil.terakhir;
      if (!x || tg > x.tanggal || (tg === x.tanggal && ms > x.ms)) {
        hasil.terakhir = { id: String(nilai_(t, b, 'submission_id') || ''), tanggal: tg, oleh: rapikanTeks_(nilai_(t, b, 'submitted_by')),
          waktu: ms ? new Date(ms).toISOString() : null, ms: ms };
      }
    });
  }
  if (hasil.terakhir) {
    delete hasil.terakhir.ms;
    hasil.hariLalu = Math.max(0, selisihHari_(hasil.terakhir.tanggal, hariIni_()));
    hasil.lewat = hasil.hariLalu > hasil.batasHari;
  }
  return hasil;
}

/** "Stock opname terakhir 9 hari lalu." atau "Belum ada stock opname." (tampilan Bagian 5.2). */
function teksPengingatOpname_(s) {
  if (!s.terakhir) return 'Belum ada stock opname.';
  return 'Stock opname terakhir ' + (s.hariLalu === 0 ? 'hari ini' : s.hariLalu + ' hari lalu') + '.';
}

/**
 * Data layar Stock opname: item aktif di kategori aktif (urut kategori, lalu
 * nama) dengan stock tercatat pada tanggal itu dan harga satuan (untuk nilai
 * selisih di ringkasan), serta opname terakhir. Stock tercatat ini hanya
 * untuk layar; selisih yang disimpan dihitung lagi saat opname disimpan.
 */
function dataFormOpname_(tanggal) {
  var master = bacaItem_();
  var kategori = bacaKategori_();
  var urut = {};
  kategori.forEach(function (k, i) { urut[k.nama.toLowerCase()] = { i: i, nama: k.nama }; });
  var rekap = bacaRekap_();
  var dipakai = {};
  var item = [];
  Object.keys(master).forEach(function (k) {
    var m = master[k];
    var kat = urut[m.kategori.toLowerCase()];
    if (!m.aktif || !kat) return;
    dipakai[kat.nama] = true;
    item.push({ nama: m.nama, kategori: kat.nama, satuan: m.satuan, harga: hargaPada_(m, tanggal),
      tercatat: posisiStock_(rekap.item[k], tanggal).akhir, _u: kat.i });
  });
  item.sort(function (a, b) { return a._u - b._u || a.nama.localeCompare(b.nama, 'id'); });
  item.forEach(function (it) { delete it._u; });
  return {
    tanggal: tanggal,
    kategori: kategori.filter(function (k) { return dipakai[k.nama]; }).map(function (k) { return k.nama; }),
    item: item,
    status: statusOpname_()
  };
}

function aksiFormOpname_(body) {
  if (!tanggalSah_(body.tanggal)) throw galatPengguna_('Tanggal tidak terbaca. Muat ulang layar ini.');
  return dataFormOpname_(body.tanggal > hariIni_() ? hariIni_() : body.tanggal);
}

/** Satu opname dari Data_Opname menurut submission_id: { id, tanggal, oleh, waktu, jumlah, berselisih, totalNilai, tanpaHarga, baris }. */
function ringkasOpname_(sid) {
  var t = wajibTabel_('Data_Opname');
  var zona = zonaSheet_();
  var urut = {};
  bacaSemuaKategori_().forEach(function (k, i) { urut[k.nama.toLowerCase()] = i; });
  var hasil = null;
  t.baris.forEach(function (b) {
    if (String(nilai_(t, b, 'submission_id') || '') !== sid) return;
    if (!hasil) {
      var w = nilai_(t, b, 'timestamp_server');
      hasil = { id: sid, tanggal: teksTanggal_(nilai_(t, b, 'Tanggal'), zona), oleh: rapikanTeks_(nilai_(t, b, 'submitted_by')),
        waktu: isoAtauNull_(w), jumlah: 0, berselisih: 0, totalNilai: 0, tanpaHarga: 0, baris: [] };
    }
    var selisih = Number(nilai_(t, b, 'Selisih')) || 0;
    var nilai = angkaAtauNull_(nilai_(t, b, 'Nilai Selisih (Rp)'));
    hasil.jumlah++;
    if (selisih) {
      hasil.berselisih++;
      if (nilai == null) hasil.tanpaHarga++;
    }
    hasil.totalNilai += nilai || 0;
    hasil.baris.push({
      item: rapikanTeks_(nilai_(t, b, 'Nama Item')),
      kategori: rapikanTeks_(nilai_(t, b, 'Kategori')),
      satuan: rapikanTeks_(nilai_(t, b, 'Satuan')),
      tercatat: Number(nilai_(t, b, 'Stock Tercatat')) || 0,
      hitung: Number(nilai_(t, b, 'Hasil Hitung')) || 0,
      selisih: selisih,
      nilai: nilai
    });
  });
  if (!hasil) return null;
  var posisi = function (k) { var u = urut[String(k).toLowerCase()]; return u == null ? 1e6 : u; };
  hasil.baris.sort(function (a, b) { return posisi(a.kategori) - posisi(b.kategori) || a.item.localeCompare(b.item, 'id'); });
  hasil.totalNilai = Math.round(hasil.totalNilai);
  return hasil;
}

/**
 * Simpan stock opname (Bagian 5.7), khusus Pengelola. body: { submissionId,
 * tanggal, waktuPerangkat, baris: [{ item, hitung }] }; item yang dikosongkan
 * tidak dikirim dan tidak diubah. Untuk tiap item, selisih = hasil hitung −
 * stock tercatat SAAT DISIMPAN (gerakan yang masuk sesudah layar dibuka ikut
 * dihitung). Semua hasil hitung dicatat di Data_Opname; item yang berselisih
 * juga mendapat baris Data_Penyesuaian beralasan "Stock opname" (submission_id
 * sama dengan opname), lalu rekap item itu dihitung ulang mulai tanggal opname,
 * sehingga Stock Akhir hari itu sama dengan hasil hitung. Nilai selisih =
 * selisih × harga yang berlaku pada tanggal opname (kosong jika belum punya harga). Opname yang
 * sudah pernah masuk dijawab sudahTerkirim: true.
 */
function aksiSimpanOpname_(body, pengguna) {
  var tanggal = periksaTanggalIsian_(body.tanggal, pengguna);
  var konteks = konteksKiriman_(body, pengguna);
  var masukan = Array.isArray(body.baris) ? body.baris : [];
  if (masukan.length > 1000) throw galatPengguna_('Isian terlalu banyak untuk satu opname.');
  var hitung = [];
  var sudah = {};
  masukan.forEach(function (b) {
    var nama = rapikanTeks_(b && b.item);
    if (b == null || b.hitung === '' || b.hitung == null) return;
    if (sudah[nama.toLowerCase()]) throw galatPengguna_(nama + ' terhitung dua kali. Muat ulang layar ini.');
    sudah[nama.toLowerCase()] = true;
    hitung.push({ nama: nama, hitung: angkaIsian_(b.hitung, 'Hasil hitung ' + nama) });
  });
  if (!hitung.length) throw galatPengguna_('Isi hasil hitung minimal untuk satu item.');

  return denganKunci_(function () {
    var tabel = wajibTabel_('Data_Opname');
    if (adaSubmission_(tabel, konteks.sid)) return gabung_({ sudahTerkirim: true }, ringkasOpname_(konteks.sid));
    var tabelSesuai = wajibTabel_('Data_Penyesuaian');
    var master = bacaItem_();
    var rekap = bacaRekap_();
    var barisOpname = [];
    var barisSesuai = [];
    hitung.forEach(function (h) {
      var m = master[h.nama.toLowerCase()];
      if (!m) throw galatPengguna_('Item ' + h.nama + ' tidak ada di daftar item. Muat ulang layar ini.');
      var tercatat = posisiStock_(rekap.item[m.nama.toLowerCase()], tanggal).akhir;
      var selisih = bulat_(h.hitung - tercatat);
      var harga = hargaPada_(m, tanggal);
      var nilai = harga == null ? '' : Math.round(selisih * harga);
      var dasar = { 'Tanggal': tanggalSel_(tanggal), 'Kategori': m.kategori, 'Nama Item': m.nama, 'Stock Tercatat': tercatat,
        'Selisih': selisih, 'Satuan': m.satuan, 'Nilai Selisih (Rp)': nilai };
      barisOpname.push(gabung_(gabung_(dasar, { 'Hasil Hitung': h.hitung }), isiSistem_(konteks)));
      if (selisih) {
        barisSesuai.push(gabung_(gabung_(dasar, { 'Stock Sebenarnya': h.hitung, 'Alasan': ALASAN_OPNAME, 'Catatan': '' }),
          isiSistem_(konteks)));
      }
    });
    tambahBarisTabel_(tabel, barisOpname);
    urutkanTabel_(tabel, URUTAN_OPNAME);
    if (barisSesuai.length) {
      tambahBarisTabel_(tabelSesuai, barisSesuai);
      urutkanTabel_(tabelSesuai, URUTAN_DATA);
      hitungUlangStock_(barisSesuai.map(function (b) { return { item: b['Nama Item'], dari: tanggal }; }));
    }
    return gabung_({ sudahTerkirim: false }, ringkasOpname_(konteks.sid));
  });
}

/** Rincian satu opname (Riwayat dan layar sesudah disimpan). */
function aksiDetailOpname_(body) {
  var o = ringkasOpname_(String(body.submissionId || ''));
  if (!o) throw galatPengguna_('Opname tidak ditemukan. Kembali ke Riwayat, lalu muat ulang.');
  return o;
}

/**
 * Laporan selisih satu opname (Bagian 5.7): stock tercatat, hasil hitung,
 * selisih, dan nilainya per item, dikelompokkan per kategori, dengan total
 * nilai selisih. Nama file {YYYY-MM-DD}_Selisih_opname_{HHmm}.pdf (jam opname,
 * supaya dua opname pada hari yang sama tidak bertabrakan).
 */
function aksiUnduhPdfOpname_(body) {
  var o = ringkasOpname_(String(body.submissionId || ''));
  if (!o) throw galatPengguna_('Opname tidak ditemukan. Kembali ke Riwayat, lalu muat ulang.');
  var jamOpname = o.waktu ? Utilities.formatDate(new Date(o.waktu), zonaWaktu_(), 'HHmm') : '0000';
  var kategori = [];
  o.baris.forEach(function (b) { if (kategori.indexOf(b.kategori) < 0) kategori.push(b.kategori); });
  var tabel = '<table class="data"><tr><th style="width:5%">No</th><th style="width:31%">Nama Item</th>' +
    '<th style="width:12%">Stock Tercatat</th><th style="width:12%">Hasil Hitung</th><th style="width:12%">Selisih</th>' +
    '<th style="width:10%">Satuan</th><th style="width:18%">Nilai Selisih (Rp)</th></tr>';
  var katKini = null;
  var no = 0;
  o.baris.forEach(function (b) {
    if (kategori.length > 1 && b.kategori !== katKini) {
      katKini = b.kategori;
      no = 0;
      tabel += '<tr class="kategori"><td colspan="7">' + escHtml_(b.kategori || 'Tanpa kategori') + '</td></tr>';
    }
    no++;
    var tanda = b.selisih ? ' akhir' : '';
    tabel += '<tr><td class="angka">' + no + '</td><td>' + escHtml_(b.item) + '</td>' +
      '<td class="angka">' + angkaId_(b.tercatat) + '</td><td class="angka">' + angkaId_(b.hitung) + '</td>' +
      '<td class="angka' + tanda + '">' + (b.selisih > 0 ? '+' : '') + angkaId_(b.selisih) + '</td>' +
      '<td>' + escHtml_(b.satuan) + '</td><td class="angka' + tanda + '">' + (b.nilai == null ? '–' : rupiahId_(b.nilai)) + '</td></tr>';
  });
  tabel += '<tr class="total"><td colspan="6">Total nilai selisih</td><td class="angka">' + rupiahId_(o.totalNilai) + '</td></tr></table>';
  var catatan = ['Selisih = hasil hitung − stock tercatat saat opname disimpan. Item yang berselisih diluruskan dengan penyesuaian beralasan Stock opname.',
    'Nilai selisih = selisih × harga satuan yang berlaku pada tanggal opname.' + (o.tanpaHarga ? ' ' + o.tanpaHarga + ' item berselisih belum punya harga (–), tidak ikut total.' : '')];
  var html = htmlLaporan_('', o.tanggal, {
    judul: 'Laporan Selisih Stock Opname',
    info: [['Kategori', kategori.length > 1 ? kategori.length + ' kategori' : (kategori[0] || '–')],
      ['Item dihitung', String(o.jumlah)], ['Item berselisih', String(o.berselisih)]],
    tabel: tabel,
    catatan: catatan,
    bawah: [['Dihitung oleh', o.oleh + (o.waktu ? ', ' + waktuPendekId_(new Date(o.waktu)) : '')]]
  });
  var namaFile = o.tanggal + '_Selisih_opname_' + jamOpname + '.pdf';
  var blob = Utilities.newBlob(html, 'text/html', namaFile + '.html').getAs('application/pdf').setName(namaFile);
  return { namaFile: namaFile, mime: 'application/pdf', data: Utilities.base64Encode(blob.getBytes()) };
}

/* ---------- Daftar belanja (Bagian 9.2) ---------- */

/**
 * Saran order dalam angka (Bagian 9.2): butuh = Stok Maksimum − Stock Akhir;
 * jika item punya satuan besar, dibulatkan ke atas ke satuan besar. null jika
 * Stok Maksimum kosong atau stock sudah mencapainya.
 * { jumlah (dalam satuan order), satuan (satuan besar atau dasar), dasar (dalam satuan dasar) }.
 */
function saranOrderAngka_(m, akhir) {
  if (m.stokMaks == null || !(m.stokMaks > akhir)) return null;
  var butuh = bulat_(m.stokMaks - akhir);
  if (m.satuanBesar && m.isiSatuanBesar > 0) {
    var besar = Math.ceil(bulat_(butuh / m.isiSatuanBesar) - 1e-9);
    return { jumlah: besar, satuan: m.satuanBesar, dasar: bulat_(besar * m.isiSatuanBesar) };
  }
  return { jumlah: butuh, satuan: m.satuan, dasar: butuh };
}

/** "2 dus (24 botol)" atau "5 kg" untuk jumlah order dalam satuan ordernya. */
function teksOrder_(m, jumlah) {
  if (m.satuanBesar && m.isiSatuanBesar > 0) {
    return angkaId_(jumlah) + ' ' + m.satuanBesar + ' (' + angkaId_(bulat_(jumlah * m.isiSatuanBesar)) + ' ' + m.satuan + ')';
  }
  return angkaId_(jumlah) + ' ' + m.satuan;
}

/** Satu item daftar belanja: { nama, satuan, satuanBesar, isiSatuanBesar, stock, stokMin, stokMaks, saran | null }. */
function itemBelanja_(m, akhir) {
  var s = saranOrderAngka_(m, akhir);
  return {
    nama: m.nama, satuan: m.satuan, satuanBesar: m.satuanBesar, isiSatuanBesar: m.isiSatuanBesar,
    stock: akhir, stokMin: m.stokMin, stokMaks: m.stokMaks,
    saran: s ? { jumlah: s.jumlah, satuan: s.satuan, dasar: s.dasar, teks: teksOrder_(m, s.jumlah) } : null
  };
}

/**
 * Daftar belanja hari ini: item aktif yang Stock Akhir-nya di bawah Stok
 * Minimum, dengan saran order.
 * - kategori: [{ nama, item: [item belanja] }] per kategori (urutan M_Kategori); dipakai aplikasi sebelum 0.29.
 * - pemasok (Code.gs v0.29): [{ nama ('' = belum ada pemasok), kontak, wa, item: [item belanja + kategori,
 *   terakhir: { pemasok, tanggal, nonaktif } | null, dipesan: pesanan menunggu item itu | null] }]. Item masuk
 *   kelompok pemasok pesanan yang masih menunggu, lalu pemasok barang masuk terakhirnya; pemasok yang nonaktif
 *   tidak punya kelompok. Kelompok urut nama, "belum ada pemasok" paling bawah; item urut kategori lalu nama.
 * - pilihanPemasok: [{ nama, wa }] pemasok aktif; menunggu: semua pesanan yang masih menunggu (umur berapa pun).
 */
function dataBelanja_() {
  var hari = hariIni_();
  var stock = ringkasStockHari_(hari);
  var urut = {};
  bacaSemuaKategori_().forEach(function (k, i) { urut[k.nama.toLowerCase()] = { i: i, nama: k.nama }; });
  var namaKategori = function (m) {
    var u = urut[m.kategori.toLowerCase()];
    return u ? u.nama : (m.kategori || 'Tanpa kategori');
  };
  var indeksKategori = function (nama) {
    var u = urut[nama.toLowerCase()];
    return u ? u.i : 1e6;
  };
  var grup = {};
  stock.belanja.forEach(function (x) {
    var nama = namaKategori(x.m);
    var g = grup[nama.toLowerCase()] = grup[nama.toLowerCase()] || { nama: nama, i: indeksKategori(nama), item: [] };
    g.item.push(itemBelanja_(x.m, x.akhir));
  });
  var kategori = Object.keys(grup).map(function (k) { return grup[k]; }).sort(function (a, b) {
    return a.i - b.i || a.nama.localeCompare(b.nama, 'id');
  });
  kategori.forEach(function (g) {
    delete g.i;
    g.item.sort(function (a, b) { return a.nama.localeCompare(b.nama, 'id'); });
  });

  // Per pemasok (Code.gs v0.29): pesanan yang masih menunggu, lalu pemasok barang masuk terakhir.
  var daftarPemasok = pembelianSiap_() ? bacaPemasok_() : [];
  var aktif = {};
  daftarPemasok.forEach(function (p) { if (p.aktif) aktif[p.nama.toLowerCase()] = p; });
  var terakhir = pemasokTerakhir_();
  var siap = pesananSiap_();
  var pes = siap ? bacaPesanan_() : { baris: [] };
  var dipesan = {};
  pes.baris.forEach(function (r) {
    if (r.keadaan !== KEADAAN_MENUNGGU) return;
    var k = r.item.toLowerCase();
    if (!dipesan[k] || r.ms > dipesan[k].ms) dipesan[k] = r;
  });
  var kelompok = {};
  stock.belanja.forEach(function (x) {
    var m = x.m;
    var k = m.nama.toLowerCase();
    var d = dipesan[k];
    var t = terakhir[k];
    var p = (d && aktif[d.pemasok.toLowerCase()]) || (t && aktif[t.pemasok.toLowerCase()]) || null;
    var kunci = p ? p.nama.toLowerCase() : '';
    var g = kelompok[kunci] = kelompok[kunci] || { nama: p ? p.nama : '', kontak: p ? p.kontak : '', wa: p ? nomorWa_(p.kontak) : '', item: [] };
    g.item.push(gabung_(itemBelanja_(m, x.akhir), {
      kategori: namaKategori(m),
      terakhir: t ? { pemasok: t.pemasok, tanggal: t.tanggal, nonaktif: !aktif[t.pemasok.toLowerCase()] } : null,
      dipesan: d ? bentukBarisPesanan_(d, true) : null
    }));
  });
  var pemasok = Object.keys(kelompok).map(function (k) { return kelompok[k]; }).sort(function (a, b) {
    if (!a.nama !== !b.nama) return a.nama ? -1 : 1;
    return a.nama.localeCompare(b.nama, 'id');
  });
  pemasok.forEach(function (g) {
    g.item.sort(function (a, b) {
      return indeksKategori(a.kategori) - indeksKategori(b.kategori) || a.kategori.localeCompare(b.kategori, 'id') ||
        a.nama.localeCompare(b.nama, 'id');
    });
  });
  return {
    tanggal: hari, jumlah: stock.belanja.length, kategori: kategori,
    outlet: namaOutlet_(),
    pembelianSiap: pembelianSiap_(),
    pesananSiap: siap,
    pemasok: pemasok,
    pilihanPemasok: daftarPemasok.filter(function (p) { return p.aktif; }).map(function (p) { return { nama: p.nama, wa: nomorWa_(p.kontak) }; }),
    menunggu: pesananMenunggu_(pes).map(bentukPesanan_)
  };
}

function aksiDaftarBelanja_() {
  return dataBelanja_();
}

/**
 * PDF daftar belanja (Bagian 9.2), dikelompokkan per pemasok seperti di layar. body.order: { namaItem: teks }
 * berisi jumlah Order di layar (dalam satuan order: satuan besar jika ada); aplikasi 0.29 mengirim semua item,
 * aplikasi lama hanya yang diubah. Item yang tidak ada di body.order memakai saran; teks kosong dicetak "–".
 */
function aksiUnduhPdfBelanja_(body, pengguna) {
  var d = dataBelanja_();
  if (!d.jumlah) throw galatPengguna_('Semua stock di atas batas minimum. Tidak ada daftar belanja untuk dicetak.');
  var order = body.order && typeof body.order === 'object' && !Array.isArray(body.order) ? body.order : {};
  var orderKecil = {};
  Object.keys(order).forEach(function (k) { orderKecil[rapikanTeks_(k).toLowerCase()] = order[k]; });
  var master = bacaItem_();
  var diubah = 0;
  var adaDipesan = false;
  var tabel = '<table class="data"><tr><th style="width:5%">No</th><th style="width:29%">Nama Item</th>' +
    '<th style="width:14%">Kategori</th><th style="width:14%">Stock Sekarang</th><th style="width:14%">Stok Minimum</th>' +
    '<th style="width:24%">Order</th></tr>';
  d.pemasok.forEach(function (g) {
    tabel += '<tr class="kategori"><td colspan="6">' + escHtml_(g.nama || 'Belum ada pemasok') +
      (g.kontak ? ' · ' + escHtml_(g.kontak) : '') + '</td></tr>';
    g.item.forEach(function (it, i) {
      var kecil = it.nama.toLowerCase();
      // Di layar, Order kosong untuk item yang sudah dipesan dan item yang belum punya pemasok.
      var bawaan = it.dipesan || !g.nama ? '' : (it.saran ? String(it.saran.jumlah) : '');
      // Item yang tidak dikirim (aplikasi 0.28 hanya mengirim yang diubah): saran, seperti dulu.
      var dikirim = Object.prototype.hasOwnProperty.call(orderKecil, kecil);
      var v = dikirim ? String(orderKecil[kecil] == null ? '' : orderKecil[kecil]).trim() : (it.saran ? String(it.saran.jumlah) : '');
      var teks = v === '' ? '–' : escHtml_(teksOrder_(master[kecil] || it, angkaIsian_(v, 'Order ' + it.nama)));
      if (dikirim && v.replace(',', '.') !== bawaan) diubah++;
      // Order kosong: sebabnya dan saran tetap tertulis kecil, supaya "–" tidak dibaca sebagai "tanpa saran".
      if (v === '') {
        var sebab = it.dipesan ? 'sudah dipesan' : !g.nama ? 'belum ada pemasok' : '';
        var saranKecil = it.saran ? 'saran ' + it.saran.teks : 'tanpa saran';
        teks += '<br><span class="kecil">' + escHtml_(sebab ? sebab + ' · ' + saranKecil : saranKecil) + '</span>';
      }
      if (it.dipesan) adaDipesan = true;
      tabel += '<tr><td class="angka">' + (i + 1) + '</td><td>' + escHtml_(it.nama) +
        (it.dipesan ? '<br><span class="kecil">dipesan ' + escHtml_(teksJumlahPesanan_(it.dipesan)) + ', ' +
          escHtml_(tanggalPendekId_(it.dipesan.tanggal)) + '</span>' : '') + '</td>' +
        '<td>' + escHtml_(it.kategori) + '</td>' +
        '<td class="angka' + (it.stock < 0 ? ' masalah' : '') + '">' + angkaId_(it.stock) + ' ' + escHtml_(it.satuan) + '</td>' +
        '<td class="angka">' + angkaId_(it.stokMin) + ' ' + escHtml_(it.satuan) + '</td>' +
        '<td class="akhir">' + teks + '</td></tr>';
    });
  });
  tabel += '</table>';
  var catatan = ['Saran order = stok maksimum dikurangi stock akhir, dibulatkan ke atas ke satuan besar jika item punya. ' +
    'Item tanpa stok maksimum tidak diberi saran. Order "–" berarti tidak ada jumlah yang diisi; sebab dan sarannya tertulis kecil di bawahnya.',
    'Item dikelompokkan menurut pemasok pesanan yang belum datang, atau pemasok barang masuk terakhirnya.'];
  if (adaDipesan) catatan.push('Item bertanda "dipesan" sudah dipesan dan belum dicatat datang.');
  if (diubah) catatan.push(diubah + ' jumlah order diubah di layar sebelum dicetak.');
  var html = htmlLaporan_('', d.tanggal, {
    judul: 'Daftar Belanja',
    info: [['Item di bawah stok minimum', String(d.jumlah)],
      ['Pemasok', String(d.pemasok.filter(function (g) { return g.nama; }).length)]],
    tabel: tabel,
    catatan: catatan,
    bawah: [['Dicetak oleh', pengguna.nama + ', ' + waktuPendekId_(new Date())]]
  });
  var namaFile = d.tanggal + '_Daftar_belanja.pdf';
  var blob = Utilities.newBlob(html, 'text/html', namaFile + '.html').getAs('application/pdf').setName(namaFile);
  return { namaFile: namaFile, mime: 'application/pdf', data: Utilities.base64Encode(blob.getBytes()) };
}

/* ---------- Pesanan ke pemasok (Code.gs v0.29, spesifikasi sistem Bagian 9.2) ---------- */

var TAB_PESANAN = 'Data_Pesanan';
var URUTAN_PESANAN = [['Tanggal', false], ['Pemasok', true], ['Nama Item', true], ['timestamp_server', true]];
var KEADAAN_MENUNGGU = 'Menunggu';
/** Pesanan yang tampil di form Stock: paling lama sekian hari sebelum tanggal form. */
var HARI_PESANAN_FORM = 14;
var BARIS_PESANAN_MAKS = 200;
/** Pesanan dari antrean HP: barang masuk yang dicatat sejak pesanan diketuk (paling lama sekian hari) dianggap sudah datang. */
var HARI_PESANAN_TERLAMBAT = 7;

/** Pesanan bisa dicatat: tab Data_Pesanan sudah dibuat setupSpreadsheet. */
function pesananSiap_() {
  return !!bacaTabel_(TAB_PESANAN);
}

/**
 * Data_Pesanan: { ada, tabel, baris: [{ nomor, b, id, tanggal, pemasok, item, kategori, jumlah, satuanOrder, dasar,
 * satuan, keadaan, oleh, ms, tw, selesaiOleh, selesaiMs, kiriman }] }. nomor = nomor baris di Sheet saat dibaca; ms = waktu
 * diterima server, tw = waktu diketuk di HP (timestamp_device, atau ms jika kosong); kiriman = Kiriman Stock.
 */
function bacaPesanan_() {
  var t = bacaTabel_(TAB_PESANAN);
  var hasil = { ada: !!t, tabel: t, baris: [] };
  if (!t) return hasil;
  var zona = zonaSheet_();
  var ms = function (w) { return w instanceof Date && !isNaN(w.getTime()) ? w.getTime() : 0; };
  t.baris.forEach(function (b, i) {
    var tg = teksTanggal_(nilai_(t, b, 'Tanggal'), zona);
    var item = rapikanTeks_(nilai_(t, b, 'Nama Item'));
    var id = String(nilai_(t, b, 'submission_id') || '');
    if (!tg || !item || !id) return;
    hasil.baris.push({
      nomor: i + 2, b: b, id: id, tanggal: tg, pemasok: rapikanTeks_(nilai_(t, b, 'Pemasok')), item: item,
      kategori: rapikanTeks_(nilai_(t, b, 'Kategori')), jumlah: Number(nilai_(t, b, 'Jumlah')) || 0,
      satuanOrder: rapikanTeks_(nilai_(t, b, 'Satuan Order')), dasar: Number(nilai_(t, b, 'Jumlah Dasar')) || 0,
      satuan: rapikanTeks_(nilai_(t, b, 'Satuan')), keadaan: rapikanTeks_(nilai_(t, b, 'Keadaan')),
      oleh: rapikanTeks_(nilai_(t, b, 'submitted_by')), ms: ms(nilai_(t, b, 'timestamp_server')),
      tw: waktuHp_(nilai_(t, b, 'timestamp_device'), ms(nilai_(t, b, 'timestamp_server'))),
      selesaiOleh: rapikanTeks_(nilai_(t, b, 'Selesai Oleh')), selesaiMs: ms(nilai_(t, b, 'Selesai Pada')),
      kiriman: String(nilai_(t, b, 'Kiriman Stock') || '')
    });
  });
  return hasil;
}

/** Pesanan yang masih menunggu, per id: [{ id, pemasok, tanggal, oleh, ms, item: [baris] }], terbaru dulu. */
function pesananMenunggu_(p) {
  var peta = {};
  var daftar = [];
  p.baris.forEach(function (r) {
    if (r.keadaan !== KEADAAN_MENUNGGU) return;
    var g = peta[r.id];
    if (!g) {
      g = peta[r.id] = { id: r.id, pemasok: r.pemasok, tanggal: r.tanggal, oleh: r.oleh, ms: r.ms, item: [] };
      daftar.push(g);
    }
    g.item.push(r);
  });
  daftar.forEach(function (g) { g.item.sort(function (a, b) { return a.item.localeCompare(b.item, 'id'); }); });
  return daftar.sort(function (a, b) { return b.ms - a.ms || b.tanggal.localeCompare(a.tanggal); });
}

/** Satu item pesanan untuk aplikasi: { nama, kategori, jumlah, satuanOrder, dasar, satuan } (+ id, pemasok, tanggal, oleh). */
function bentukBarisPesanan_(r, lengkap) {
  var x = { nama: r.item, kategori: r.kategori, jumlah: r.jumlah, satuanOrder: r.satuanOrder, dasar: r.dasar, satuan: r.satuan };
  if (lengkap) {
    x.id = r.id;
    x.pemasok = r.pemasok;
    x.tanggal = r.tanggal;
    x.oleh = r.oleh;
  }
  return x;
}

/** Satu pesanan untuk aplikasi: { id, pemasok, tanggal, oleh, waktu (ISO), item: [...] }. */
function bentukPesanan_(g) {
  return {
    id: g.id, pemasok: g.pemasok, tanggal: g.tanggal, oleh: g.oleh, waktu: g.ms ? new Date(g.ms).toISOString() : '',
    item: g.item.map(function (r) { return bentukBarisPesanan_(r, false); })
  };
}

/** "5 kg" atau "2 dus" (jumlah dalam satuan order). */
function teksJumlahPesanan_(x) {
  return angkaId_(x.jumlah) + ' ' + x.satuanOrder;
}

/**
 * Nomor WhatsApp dari Kontak pemasok (teks bebas): deret angka yang cukup panjang (boleh berisi spasi, -, titik,
 * kurung, dan + di depan). 0 di depan diganti 62 (Indonesia); 8xx dianggap nomor Indonesia tanpa 0. 10–15 angka.
 * Nomor HP Indonesia (628…) didahulukan, supaya telepon kantor yang ditulis lebih dulu tidak dipakai; tanpa nomor HP,
 * nomor pertama yang sah; selain itu ''.
 */
function nomorWa_(kontak) {
  var semua = String(kontak || '').match(/\+?\d[\d\s().-]{7,}\d/g) || [];
  var sah = semua.map(function (c) {
    var angka = c.replace(/\D/g, '');
    if (angka.charAt(0) === '0') angka = '62' + angka.replace(/^0+/, '');
    else if (angka.charAt(0) === '8') angka = '62' + angka;
    return angka.length >= 10 && angka.length <= 15 ? angka : '';
  }).filter(Boolean);
  return sah.filter(function (a) { return a.indexOf('628') === 0; })[0] || sah[0] || '';
}

/** Pemasok barang masuk terakhir tiap item (Data_Stock, Stock Masuk > 0, Pemasok berisi): { itemKecil: { pemasok, tanggal, ms } }. */
function pemasokTerakhir_() {
  var hasil = {};
  if (!pembelianSiap_()) return hasil;
  bacaPembelian_('0000-01-01', '9999-12-31').forEach(function (p) {
    if (!p.pemasok) return;
    var k = p.item.toLowerCase();
    var x = hasil[k];
    if (!x || p.tanggal > x.tanggal || (p.tanggal === x.tanggal && p.ms >= x.ms)) hasil[k] = { pemasok: p.pemasok, tanggal: p.tanggal, ms: p.ms };
  });
  return hasil;
}

/** Mengubah keadaan satu baris pesanan (di dalam kunci, sebelum tab diurutkan). */
function tandaiPesanan_(p, r, keadaan, oleh, waktu, kiriman) {
  var t = p.tabel;
  var isi = { 'Keadaan': keadaan, 'Selesai Oleh': oleh, 'Selesai Pada': waktu, 'Kiriman Stock': kiriman || '' };
  Object.keys(isi).forEach(function (judul) {
    var i = t.kol[judul];
    if (i === undefined) return;
    var v = isi[judul];
    t.sheet.getRange(r.nomor, i + 1).setValue(typeof v === 'string' ? teksAman_(v) : v);
    r.b[i] = v;
  });
  r.keadaan = keadaan;
  r.selesaiOleh = oleh;
  r.selesaiMs = waktu instanceof Date ? waktu.getTime() : 0;
  r.kiriman = kiriman || '';
}

/**
 * Catat pesanan (khusus Pengelola), dikirim saat "Kirim ke WhatsApp" diketuk:
 * { submissionId, tanggal, waktuPerangkat, pemasok, baris: [{ item, jumlah, satuanOrder: 'besar'|'dasar' }] }.
 * Satu baris Data_Pesanan per item, Keadaan Menunggu. Item yang masih punya pesanan menunggu (pemasok mana pun)
 * diganti pesanan ini (Diganti), supaya tiap item paling banyak punya satu pesanan menunggu. Waktu yang dibandingkan
 * adalah waktu diketuk di HP: pesanan dari antrean HP yang barangnya sudah dicatat masuk di HP sejak tombol diketuk
 * (pemasok sama atau tanpa pemasok, barang masuk yang belum menyelesaikan pesanan lain) langsung Datang (`sudahDatang`);
 * yang sudah didahului pesanan menunggu yang diketuk sesudahnya langsung Diganti (`lebihBaru`).
 */
function aksiCatatPesanan_(body, pengguna) {
  var tanggal = periksaTanggalIsian_(body.tanggal, pengguna);
  var konteks = konteksKiriman_(body, pengguna);
  var masukan = Array.isArray(body.baris) ? body.baris : [];
  if (masukan.length > BARIS_PESANAN_MAKS) throw galatPengguna_('Pesanan terlalu banyak untuk sekali kirim.');

  return denganKunci_(function () {
    var p = bacaPesanan_();
    if (!p.ada) throw galatPengguna_('Tab ' + TAB_PESANAN + ' belum ada. Minta pemilik Sheet menjalankan ulang setupSpreadsheet.');
    if (adaSubmission_(p.tabel, konteks.sid)) {
      return { sudahTerkirim: true, id: konteks.sid, jumlah: 0, diganti: [], sudahDatang: [], belanja: dataBelanja_() };
    }
    var nama = rapikanTeks_(body.pemasok);
    if (!nama) throw galatPengguna_('Pilih pemasok untuk pesanan ini.');
    // Pemasok yang sudah dinonaktifkan tetap diterima (pesanan dari antrean di HP).
    var pemasok = bacaPemasok_().filter(function (x) { return x.nama.toLowerCase() === nama.toLowerCase(); })[0];
    if (!pemasok) throw galatPengguna_('Pemasok ' + nama + ' tidak ada di daftar pemasok. Muat ulang Daftar belanja.');
    if (!masukan.length) throw galatPengguna_('Isi Order minimal untuk satu item.');
    var master = bacaItem_();
    var sudah = {};
    var baris = masukan.map(function (b) {
      var m = master[rapikanTeks_(b && b.item).toLowerCase()];
      if (!m) throw galatPengguna_('Item ' + rapikanTeks_(b && b.item) + ' tidak ada di daftar item. Muat ulang Daftar belanja.');
      if (sudah[m.nama.toLowerCase()]) throw galatPengguna_(m.nama + ' tertulis dua kali di pesanan ini.');
      sudah[m.nama.toLowerCase()] = true;
      var jumlah = angkaIsian_(b.jumlah, 'Order ' + m.nama);
      if (!(jumlah > 0)) throw galatPengguna_('Order ' + m.nama + ' harus lebih dari 0.');
      var besar = b.satuanOrder === 'besar';
      if (besar && !(m.satuanBesar && m.isiSatuanBesar > 0)) {
        throw galatPengguna_(m.nama + ' tidak punya satuan besar. Muat ulang Daftar belanja.');
      }
      return { m: m, jumlah: jumlah, satuanOrder: besar ? m.satuanBesar : m.satuan, dasar: besar ? bulat_(jumlah * m.isiSatuanBesar) : jumlah };
    });

    // Waktu tombol diketuk di HP; pesanan dari antrean bisa sampai jauh sesudahnya.
    var tw = waktuHp_(konteks.waktuPerangkat, konteks.kini.getTime());
    // Barang masuk yang sudah dicatat di HP sejak tombol diketuk (pesanan yang terlambat sampai dari antrean), dengan
    // pemasok yang sama atau tanpa pemasok, dan belum menyelesaikan pesanan lain.
    var datangSejak = {};
    if (tw < konteks.kini.getTime() && pembelianSiap_()) {
      var dipakai = {};
      p.baris.forEach(function (r) { if (r.keadaan === 'Datang' && r.kiriman) dipakai[r.kiriman + '|' + r.item.toLowerCase()] = true; });
      var batas = konteks.kini.getTime() - HARI_PESANAN_TERLAMBAT * 864e5;
      bacaPembelian_(tanggal, '9999-12-31').forEach(function (x) {
        if (x.tw < tw || x.ms < batas || (x.pemasok && x.pemasok.toLowerCase() !== pemasok.nama.toLowerCase())) return;
        var k = x.item.toLowerCase();
        if (dipakai[x.sid + '|' + k]) return;
        if (!datangSejak[k] || x.tw < datangSejak[k].tw) datangSejak[k] = x;
      });
    }

    // Pesanan menunggu untuk item yang sama: yang diketuk lebih dulu diganti pesanan ini; yang diketuk sesudahnya (pesanan ini
    // terlambat dari antrean) tetap, dan item pesanan ini langsung Diganti olehnya.
    var diganti = [];
    var lebihBaru = {};
    p.baris.forEach(function (r) {
      if (r.keadaan !== KEADAAN_MENUNGGU || !sudah[r.item.toLowerCase()]) return;
      if (r.tw > tw) {
        lebihBaru[r.item.toLowerCase()] = r;
        return;
      }
      tandaiPesanan_(p, r, 'Diganti', pengguna.nama, konteks.kini, '');
      diganti.push({ item: r.item, pemasok: r.pemasok, tanggal: r.tanggal, oleh: r.oleh });
    });

    var sudahDatang = [];
    var kalah = [];
    tambahBarisTabel_(p.tabel, baris.map(function (x) {
      var dt = datangSejak[x.m.nama.toLowerCase()];
      var lb = dt ? null : lebihBaru[x.m.nama.toLowerCase()];
      if (dt) sudahDatang.push(x.m.nama);
      if (lb) kalah.push({ item: lb.item, pemasok: lb.pemasok, tanggal: lb.tanggal, oleh: lb.oleh });
      return gabung_({
        'Tanggal': tanggalSel_(tanggal),
        'Pemasok': pemasok.nama,
        'Nama Item': x.m.nama,
        'Kategori': x.m.kategori,
        'Jumlah': x.jumlah,
        'Satuan Order': x.satuanOrder,
        'Jumlah Dasar': x.dasar,
        'Satuan': x.m.satuan,
        'Keadaan': dt ? 'Datang' : lb ? 'Diganti' : KEADAAN_MENUNGGU,
        'Selesai Oleh': dt ? dt.oleh : lb ? lb.oleh : '',
        'Selesai Pada': dt && dt.ms ? new Date(dt.ms) : lb ? konteks.kini : '',
        'Kiriman Stock': dt ? dt.sid : ''
      }, isiSistem_(konteks));
    }));
    urutkanTabel_(p.tabel, URUTAN_PESANAN);
    var hasil = {
      sudahTerkirim: false, id: konteks.sid, pemasok: pemasok.nama, jumlah: baris.length,
      diganti: diganti, sudahDatang: sudahDatang, belanja: dataBelanja_()
    };
    if (kalah.length) hasil.lebihBaru = kalah;
    return hasil;
  });
}

/**
 * Tutup pesanan (khusus Pengelola): item pesanan itu yang masih menunggu menjadi Ditutup (misalnya pemasok tidak
 * mengirim, atau barangnya dicatat tanpa pesanan). { id, tanggal? } → { ditutup, belanja, form? } (form = formStock
 * tanggal itu, jika dikirim dari form Stock).
 */
function aksiTutupPesanan_(body, pengguna) {
  var id = rapikanTeks_(body.id);
  return denganKunci_(function () {
    var p = bacaPesanan_();
    if (!p.ada) throw galatPengguna_('Tab ' + TAB_PESANAN + ' belum ada. Minta pemilik Sheet menjalankan ulang setupSpreadsheet.');
    var kini = new Date();
    var n = 0;
    p.baris.forEach(function (r) {
      if (r.id !== id || r.keadaan !== KEADAAN_MENUNGGU) return;
      tandaiPesanan_(p, r, 'Ditutup', pengguna.nama, kini, '');
      n++;
    });
    var hasil = { ditutup: n, belanja: dataBelanja_() };
    if (tanggalSah_(body.tanggal)) hasil.form = dataFormStock_(body.tanggal);
    return hasil;
  });
}

/**
 * Pesanan menunggu untuk form Stock (semua role): pemasok aktif, tanggal pesanan sampai tanggal form dan paling lama
 * HARI_PESANAN_FORM hari sebelumnya; terbaru dulu.
 */
function pesananForm_(tanggal) {
  if (!pesananSiap_()) return [];
  var aktif = {};
  bacaPemasok_().forEach(function (x) { if (x.aktif) aktif[x.nama.toLowerCase()] = true; });
  var dari = geserTanggal_(tanggal, -(HARI_PESANAN_FORM - 1));
  return pesananMenunggu_(bacaPesanan_()).filter(function (g) {
    return aktif[g.pemasok.toLowerCase()] && g.tanggal <= tanggal && g.tanggal >= dari;
  }).map(bentukPesanan_);
}

/**
 * Tautan baris kirimStock ke pesanan ("Isi dari pesanan" di form Stock): { r, datang }. Kiriman tidak pernah ditolak
 * karena tautannya, supaya kiriman dari antrean HP tidak macet ("Kirim ulang" mengirim isi yang sama).
 * - Pesanan itu masih menunggu untuk item itu: r = barisnya.
 * - Diganti: pesanan terbaru untuk item itu dari pemasok yang sama yang dibuat sesudahnya dipakai (masih menunggu: r;
 *   sudah datang: datang); diganti pesanan ke pemasok lain: tanpa tautan.
 * - Sudah dicatat datang (misalnya diisi juga dari HP lain): datang = barisnya. Tambah masuk baris kiriman ini tidak
 *   dicatat, supaya barang yang sama tidak masuk dua kali; itemnya dikembalikan di `pesananSudahDatang`.
 * - Ditutup atau id tidak dikenal: tanpa tautan (barang masuk dicatat seperti biasa; menutup pesanan berarti tidak
 *   ditunggu lagi, bukan barangnya tidak boleh dicatat).
 */
function barisPesananTertaut_(p, id, item) {
  var tanpa = { r: null, datang: null };
  if (!id || !p.ada) return tanpa;
  var kecil = item.toLowerCase();
  var asal = p.baris.filter(function (r) { return r.id === id && r.item.toLowerCase() === kecil; })[0];
  if (!asal) return tanpa;
  if (asal.keadaan === 'Diganti') {
    var pengganti = null;
    p.baris.forEach(function (r) {
      if (r.id === asal.id || r.item.toLowerCase() !== kecil || r.pemasok.toLowerCase() !== asal.pemasok.toLowerCase()) return;
      if (r.tw < asal.tw || r.keadaan === 'Diganti') return;
      if (!pengganti || r.tw > pengganti.tw) pengganti = r;
    });
    if (!pengganti) return tanpa;
    asal = pengganti;
  }
  if (asal.keadaan === KEADAAN_MENUNGGU) return { r: asal, datang: null };
  if (asal.keadaan === 'Datang') return { r: null, datang: asal };
  return tanpa;
}

/**
 * Sesudah kirimStock menulis baris (di dalam kunci): item dengan Stock Masuk > 0 menyelesaikan pesanan menunggunya
 * (Datang). Baris yang bertautan ke pesanan menyelesaikan pesanan itu; selain itu pesanan menunggu yang paling lama
 * untuk item itu dengan pemasok yang sama, atau pemasok mana pun jika kiriman tanpa pemasok, dengan tanggal pesanan
 * sampai tanggal kiriman dan diketuk sebelum barang itu dicatat di HP. Mengembalikan [{ pemasok, item }].
 */
function selesaikanPesanan_(p, masuk, pemasok, tanggal, konteks) {
  var hasil = [];
  if (!p.ada) return hasil;
  // Pesanan yang diketuk sesudah barang ini dicatat di HP (kiriman dari antrean) bukan pesanan untuk barang ini.
  var dicatat = waktuHp_(konteks.waktuPerangkat, konteks.kini.getTime());
  masuk.forEach(function (x) {
    var r = x.tertaut;
    if (!r) {
      var kecil = x.item.toLowerCase();
      p.baris.forEach(function (c) {
        if (c.keadaan !== KEADAAN_MENUNGGU || c.item.toLowerCase() !== kecil || c.tanggal > tanggal || c.tw > dicatat) return;
        if (pemasok && c.pemasok.toLowerCase() !== pemasok.toLowerCase()) return;
        if (!r || c.ms < r.ms) r = c;
      });
    }
    if (!r || r.keadaan !== KEADAAN_MENUNGGU) return;
    tandaiPesanan_(p, r, 'Datang', konteks.pengguna.nama, konteks.kini, konteks.sid);
    hasil.push({ pemasok: r.pemasok, item: r.item });
  });
  return hasil;
}

/** Mengganti nama item atau pemasok di semua baris Data_Pesanan (di dalam kunci). */
function gantiNamaPesanan_(judul, namaLama, namaBaru) {
  var t = bacaTabel_(TAB_PESANAN);
  if (!t || t.kol[judul] === undefined) return;
  var c = t.kol[judul];
  t.baris.forEach(function (b, i) {
    if (rapikanTeks_(b[c]).toLowerCase() === namaLama.toLowerCase()) t.sheet.getRange(i + 2, c + 1).setValue(teksAman_(namaBaru));
  });
}

/* =========================================================================
 * Tahap 9: form kustom (spesifikasi sistem Bagian 5.6 dan 5.8, tampilan
 * Bagian 5.3 dan 5.7). Definisi di M_Form dan M_FormKolom; data tiap form di
 * tab Data_K_<ID Form> (kolom form di kiri, kolom sistem di kanan).
 * ========================================================================= */

var BATAS_FORM_KUSTOM = 10;
var BATAS_KOLOM_FORM = 15;
var JENIS_KOLOM = ['Teks', 'Angka', 'Pilihan', 'Ya/Tidak', 'Item', 'Jam'];
var JADWAL_FORM = ['harian', 'hari tertentu', 'sewaktu-waktu'];
var AWALAN_TAB_KUSTOM = 'Data_K_';
var PANJANG_NAMA_FORM_MAKS = 40;
var PANJANG_KETERANGAN_FORM_MAKS = 120;
var PANJANG_LABEL_MAKS = 40;
var PANJANG_PILIHAN_MAKS = 40;
var JUMLAH_PILIHAN_MAKS = 20;
var PANJANG_TEKS_ISIAN_MAKS = 200;
var BARIS_KUSTOM_MAKS = 100;
var PEMISAH_PILIHAN = ' | ';
/** Kolom form yang selalu ada di tab Data_K_: tanggal, pengisi, dan nomor baris dalam satu kiriman. */
var KOLOM_TETAP_KUSTOM = ['Tanggal', 'Nama Staff', 'No'];
var URUTAN_KUSTOM = [['Tanggal', false], ['timestamp_server', true], ['No', true]];

/* ---------- Membaca definisi (memo per permintaan) ---------- */

var MEMO_FORM_ = {};

function resetMemoForm_() {
  MEMO_FORM_ = {};
  MEMO_HARGA_ = null;
  MEMO_LIBUR_ = null;
}

function normalJenisKolom_(nilai) {
  var t = rapikanTeks_(nilai).toLowerCase().replace(/\s+/g, '');
  for (var i = 0; i < JENIS_KOLOM.length; i++) {
    if (JENIS_KOLOM[i].toLowerCase().replace(/\s+/g, '') === t) return JENIS_KOLOM[i];
  }
  return 'Teks';
}

/** "Baik | Rusak" (atau satu pilihan per baris) → ['Baik', 'Rusak'], tanpa yang kosong atau ganda. */
function pisahPilihan_(nilai) {
  var daftar = Array.isArray(nilai) ? nilai : String(nilai == null ? '' : nilai).split(/\s*[|\n]\s*/);
  var sudah = {};
  var hasil = [];
  daftar.forEach(function (p) {
    var t = rapikanTeks_(p);
    if (!t || sudah[t.toLowerCase()]) return;
    sudah[t.toLowerCase()] = true;
    hasil.push(t);
  });
  return hasil;
}

/**
 * Semua kolom form di M_FormKolom: { ID_FORM: [{ id, urutan, label, jenis,
 * pilihan, wajib, bagian, aktif }] }, kolom kepala lebih dulu, lalu menurut
 * Urutan. Kolom yang Aktif-nya kosong sudah dihapus dari form (Bagian 5.6):
 * tidak tampil di layar isi, tetapi isian lamanya tetap terbaca.
 */
function bacaSemuaKolomForm_() {
  if (MEMO_FORM_.kolom) return MEMO_FORM_.kolom;
  var t = bacaTabel_('M_FormKolom');
  var hasil = {};
  if (t) {
    t.baris.forEach(function (b, i) {
      var idForm = rapikanTeks_(nilai_(t, b, 'ID Form')).toUpperCase();
      var label = rapikanTeks_(nilai_(t, b, 'Label'));
      if (!idForm || !label) return;
      var jenis = normalJenisKolom_(nilai_(t, b, 'Jenis Kolom'));
      var daftar = hasil[idForm] = hasil[idForm] || [];
      daftar.push({
        id: rapikanTeks_(nilai_(t, b, 'ID Kolom')).toUpperCase() || ('L' + (i + 2)),
        urutan: Number(nilai_(t, b, 'Urutan')) || 999,
        label: label,
        jenis: jenis,
        pilihan: jenis === 'Pilihan' ? pisahPilihan_(nilai_(t, b, 'Pilihan')) : (jenis === 'Ya/Tidak' ? ['Ya', 'Tidak'] : []),
        wajib: benar_(nilai_(t, b, 'Wajib')),
        bagian: rapikanTeks_(nilai_(t, b, 'Bagian')).toLowerCase() === 'kepala' ? 'kepala' : 'baris',
        aktif: benar_(nilai_(t, b, 'Aktif')),
        nomor: i + 2
      });
    });
  }
  Object.keys(hasil).forEach(function (k) {
    hasil[k].sort(function (a, b) {
      return (a.bagian === 'kepala' ? 0 : 1) - (b.bagian === 'kepala' ? 0 : 1) || a.urutan - b.urutan || a.nomor - b.nomor;
    });
  });
  MEMO_FORM_.kolom = hasil;
  return hasil;
}

/** Kolom satu form (aktif dan yang sudah dihapus). */
function kolomForm_(idForm) {
  return bacaSemuaKolomForm_()[rapikanTeks_(idForm).toUpperCase()] || [];
}

/** Kolom untuk layar isi dan Pengaturan: { id, bagian, label, jenis, pilihan, wajib, aktif }. */
function infoKolomForm_(c) {
  return { id: c.id, bagian: c.bagian, label: c.label, jenis: c.jenis, pilihan: c.pilihan, wajib: c.wajib, aktif: c.aktif };
}

/** Definisi form untuk aplikasi. semuaKolom: kolom yang sudah dihapus ikut (Pengaturan). */
function definisiForm_(f, semuaKolom) {
  return {
    id: f.id, nama: f.nama, jenis: f.jenis, keterangan: f.keterangan, jadwal: f.jadwal, hari: f.hari, aktif: f.aktif,
    kolom: f.jenis === 'kustom' ? kolomForm_(f.id).filter(function (c) { return semuaKolom || c.aktif; }).map(infoKolomForm_) : []
  };
}

/** Form kustom sudah punya isian (kiriman) di tab datanya. */
function adaIsianForm_(idForm) {
  var t = bacaTabel_(tabDataForm_(idForm));
  if (!t || t.kol.submission_id === undefined) return false;
  return t.baris.some(function (b) { return String(b[t.kol.submission_id] || '') !== ''; });
}

/** Kolom yang dibutuhkan form kustom sudah dipasang setupSpreadsheet (Tahap 9). */
function kolomFormSiap_() {
  return !!(posisiKolomOpsional_(ambilTab_('M_Form'), 'Hari') && posisiKolomOpsional_(ambilTab_('M_Form'), 'Diarsipkan') &&
    posisiKolomOpsional_(ambilTab_('M_FormKolom'), 'ID Kolom'));
}

function wajibKolomFormSiap_() {
  if (!kolomFormSiap_()) {
    throw galatPengguna_('Kolom form kustom belum dipasang di spreadsheet. Pemilik Sheet perlu menjalankan ulang setupSpreadsheet ' +
      'di editor Apps Script, lalu coba lagi.');
  }
}

/** Kolom yang terkunci di form bawaan (hanya untuk ditampilkan di Pengaturan → Form). */
function labelKolomBawaan_(idForm) {
  var def = RIWAYAT_FORM[idForm];
  if (!def) return [];
  return (def.kepala || []).map(function (k) { return k.label; }).concat(def.kolom.map(function (k) { return k.label; }));
}

/* ---------- Tab Data_K_<ID Form> ---------- */

function defKolomTabKustom_(c) {
  return k_(c.label, c.jenis === 'Angka' ? 'angka' : 'teks');
}

/** Kolom form tab Data_K_: Tanggal, Nama Staff, kolom kepala, No, kolom baris (termasuk yang sudah dihapus). */
function kolomTabKustom_(kolom) {
  return [k_('Tanggal', 'tanggal'), k_('Nama Staff')]
    .concat(kolom.filter(function (c) { return c.bagian === 'kepala'; }).map(defKolomTabKustom_))
    .concat([k_('No', 'bulat')])
    .concat(kolom.filter(function (c) { return c.bagian === 'baris'; }).map(defKolomTabKustom_));
}

/** Indeks (dari 0) untuk tab Data baru: tepat sesudah tab Data terakhir. */
function indeksTabDataBaru_(ss) {
  var indeks = 0;
  ss.getSheets().forEach(function (sheet, i) {
    var nama = sheet.getName();
    if (nama === 'Stock_Harian' || nama.indexOf('Data_') === 0) indeks = i + 1;
  });
  return indeks;
}

/** Tanda arsip di tab data form yang dihapus dari aplikasi: warna tab Garis dan catatan di A1. */
function tandaArsipTab_(sheet, f) {
  var sel = sheet.getRange(1, 1);
  if (f.diarsipkan) {
    sheet.setTabColor(WARNA.garis);
    sel.setNote('ARSIP: form ' + f.nama + ' dihapus dari aplikasi ' + Utilities.formatDate(f.diarsipkan, zonaWaktu_(), 'yyyy-MM-dd HH:mm') +
      '. Isian lama tetap di tab ini. Pengelola bisa memulihkannya dari Pengaturan → Form.');
  } else {
    sel.setNote('');
  }
}

/**
 * Membuat atau melengkapi tab Data_K_<ID Form> (Bagian 5.6): kolom form di
 * kiri, kolom sistem di kanan. Label yang diganti ditulis ulang di baris
 * judul (opsi.ganti: { idKolom: labelLama }); kolom baru disisipkan tepat
 * sebelum kolom sistem, sehingga isian lama kosong di kolom itu. Kolom yang
 * dihapus dari form tetap ada di tab. Dipakai aplikasi (simpan form) dan
 * setupSpreadsheet.
 */
function siapkanTabKustom_(ss, f, kolom, opsi) {
  opsi = opsi || {};
  var catatan = opsi.catatan || [];
  var namaTab = tabDataForm_(f.id);
  var sheet = ss.getSheetByName(namaTab);
  if (!sheet) {
    sheet = ss.insertSheet(namaTab, indeksTabDataBaru_(ss));
    catatan.push('Tab dibuat: ' + namaTab);
  }
  var form = kolomTabKustom_(kolom);
  var lebar = sheet.getLastColumn();
  if (lebar > 0) {
    var judul = sheet.getRange(1, 1, 1, lebar).getValues()[0].map(function (j) { return String(j).trim(); });
    // Label yang diganti: posisi dicari dulu semuanya, baru ditulis (dua label boleh bertukar).
    var tulis = [];
    Object.keys(opsi.ganti || {}).forEach(function (id) {
      var c = kolom.filter(function (x) { return x.id === id; })[0];
      var i = judul.indexOf(opsi.ganti[id]);
      if (c && i >= 0) tulis.push([i + 1, c.label]);
    });
    tulis.forEach(function (x) { sheet.getRange(1, x[0]).setValue(x[1]); });
    if (tulis.length) {
      judul = sheet.getRange(1, 1, 1, lebar).getValues()[0].map(function (j) { return String(j).trim(); });
    }
    var awalSistem = judul.indexOf(KOLOM_SISTEM[0].nama) + 1;
    form.forEach(function (k) {
      if (judul.indexOf(k.nama) >= 0) return;
      if (awalSistem > 0) {
        sheet.insertColumnBefore(awalSistem);
        sheet.getRange(1, awalSistem).setValue(k.nama);
        judul.splice(awalSistem - 1, 0, k.nama);
        awalSistem++;
      } else {
        pastikanJumlahKolom_(sheet, judul.length + 1);
        sheet.getRange(1, judul.length + 1).setValue(k.nama);
        judul.push(k.nama);
      }
      catatan.push('Kolom ditambahkan di ' + namaTab + ': ' + k.nama);
    });
  }
  siapkanTabTabel_(ss, sheet, { kolom: form }, {
    sistem: KOLOM_SISTEM,
    warnaTab: f.diarsipkan ? WARNA.garis : WARNA_TAB.data,
    proteksi: 'keras',
    pitaTanggal: true,
    catatan: catatan
  });
  tandaArsipTab_(sheet, f);
  return sheet;
}

/** Label kolom yang diganti ikut diganti di Log_Perubahan tab itu, supaya jejak koreksinya tetap terbaca di Riwayat. */
function gantiLabelLog_(namaTab, peta) {
  var t = bacaTabel_(TAB_LOG.nama);
  if (!t || t.kol.Kolom === undefined || t.kol.Tab === undefined || !t.baris.length) return;
  var berubah = false;
  var kolom = t.baris.map(function (b) {
    var v = b[t.kol.Kolom];
    if (rapikanTeks_(b[t.kol.Tab]) === namaTab && Object.prototype.hasOwnProperty.call(peta, rapikanTeks_(v))) {
      berubah = true;
      return [peta[rapikanTeks_(v)]];
    }
    return [v];
  });
  if (berubah) t.sheet.getRange(2, t.kol.Kolom + 1, kolom.length, 1).setValues(kolom);
}

/* ---------- Pengaturan → Form (khusus Pengelola) ---------- */

function ringkasFormPengaturan_(f) {
  return {
    id: f.id, nama: f.nama, jenis: f.jenis, keterangan: f.keterangan, jadwal: f.jadwal, hari: f.hari, aktif: f.aktif,
    urutan: f.urutan,
    jumlahKolom: f.jenis === 'kustom' ? kolomForm_(f.id).filter(function (c) { return c.aktif; }).length : null,
    diarsipkan: f.diarsipkan ? f.diarsipkan.toISOString() : null
  };
}

/** Daftar Pengaturan → Form: semua form dalam urutan Beranda, dan form kustom yang dihapus (diarsipkan). */
function dataPengaturanForm_() {
  resetMemoForm_();
  var semua = bacaDaftarForm_(true);
  var tampil = semua.filter(function (f) { return !f.diarsipkan; });
  return {
    form: tampil.map(ringkasFormPengaturan_),
    arsip: semua.filter(function (f) { return f.diarsipkan; }).map(ringkasFormPengaturan_),
    jumlahKustom: tampil.filter(function (f) { return f.jenis === 'kustom'; }).length,
    batasForm: BATAS_FORM_KUSTOM,
    batasKolom: BATAS_KOLOM_FORM,
    siap: kolomFormSiap_()
  };
}

function aksiDaftarForm_() {
  return dataPengaturanForm_();
}

/** Item aktif untuk kolom Item: [{ nama, kategori, satuan }], urut nama. */
function itemAktifRingkas_() {
  var master = bacaItem_();
  return Object.keys(master).map(function (k) { return master[k]; }).filter(function (m) { return m.aktif; })
    .map(function (m) { return { nama: m.nama, kategori: m.kategori, satuan: m.satuan }; })
    .sort(function (a, b) { return a.nama.localeCompare(b.nama, 'id'); });
}

/**
 * Layar susun form: definisi lengkap (termasuk kolom yang sudah dihapus),
 * apakah form sudah punya isian (jenis kolom terkunci), kolom terkunci form
 * bawaan, dan daftar item untuk pratinjau. formId kosong = form baru.
 */
function aksiDetailForm_(body) {
  var f = null;
  if (rapikanTeks_(body.formId)) {
    f = cariForm_(body.formId);
    if (!f) throw galatPengguna_('Form tidak ditemukan. Kembali ke daftar form.');
  }
  var daftar = bacaDaftarForm_();
  return {
    form: f ? definisiForm_(f, true) : null,
    adaIsian: f && f.jenis === 'kustom' ? adaIsianForm_(f.id) : false,
    kolomBawaan: f && f.jenis === 'bawaan' ? labelKolomBawaan_(f.id) : [],
    item: itemAktifRingkas_(),
    jumlahKustom: daftar.filter(function (x) { return x.jenis === 'kustom'; }).length,
    batasForm: BATAS_FORM_KUSTOM,
    batasKolom: BATAS_KOLOM_FORM,
    siap: kolomFormSiap_()
  };
}

/** ID form kustom dari namanya saat dibuat ("Checklist kebersihan" → CHECKLIST_KEBERSIHAN); tidak berubah lagi. */
function buatIdForm_(nama, semua) {
  var dasar = String(nama).toUpperCase();
  try {
    dasar = dasar.normalize('NFD').replace(/[̀-ͯ]/g, '');
  } catch (err) {
    /* tanpa normalize: huruf beraksen dibuang di bawah */
  }
  dasar = dasar.replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 20).replace(/_+$/, '');
  if (!dasar || /^\d/.test(dasar)) dasar = ('FORM_' + dasar).slice(0, 20).replace(/_+$/, '');
  var dipakai = {};
  semua.forEach(function (f) { dipakai[f.id] = true; });
  Object.keys(TAB_DATA_FORM).forEach(function (k) { dipakai[k] = true; });
  var id = dasar;
  var n = 2;
  while (dipakai[id] || ss_().getSheetByName(tabDataForm_(id))) {
    id = dasar.slice(0, 17) + '_' + n;
    n++;
  }
  return id;
}

function periksaPilihanKolom_(nilai, label) {
  var daftar = pisahPilihan_(nilai);
  if (daftar.length < 2) throw galatPengguna_('Kolom ' + label + ' butuh minimal dua pilihan.');
  if (daftar.length > JUMLAH_PILIHAN_MAKS) throw galatPengguna_('Kolom ' + label + ' paling banyak ' + JUMLAH_PILIHAN_MAKS + ' pilihan.');
  daftar.forEach(function (p) {
    if (p.length > PANJANG_PILIHAN_MAKS) throw galatPengguna_('Pilihan "' + p.slice(0, 20) + '…" terlalu panjang. Paling panjang ' + PANJANG_PILIHAN_MAKS + ' huruf.');
    if (/^[=+\-@]/.test(p)) throw galatPengguna_('Pilihan tidak boleh diawali tanda =, +, -, atau @.');
  });
  return daftar;
}

/**
 * Memeriksa susunan kolom yang dikirim layar susun form (aturan perubahan
 * Bagian 5.6). Kolom lama yang tidak dikirim lagi disembunyikan (Aktif
 * kosong), datanya tetap ada. Jenis kolom tidak bisa diganti setelah form
 * punya isian. Mengembalikan { semua: [kolom aktif..., kolom dihapus...],
 * ganti: { idKolom: labelLama } }.
 */
function periksaKolomForm_(masukan, lama, adaIsian) {
  masukan = Array.isArray(masukan) ? masukan : [];
  if (masukan.length > BATAS_KOLOM_FORM) {
    throw galatPengguna_('Paling banyak ' + BATAS_KOLOM_FORM + ' kolom per form. Hapus kolom yang tidak dipakai.');
  }
  var petaLama = {};
  var nomorTerbesar = 0;
  lama.forEach(function (c) {
    petaLama[c.id] = c;
    var m = /^K(\d+)$/.exec(c.id);
    if (m) nomorTerbesar = Math.max(nomorTerbesar, Number(m[1]));
  });
  var terlarang = KOLOM_TETAP_KUSTOM.concat(KOLOM_SISTEM.map(function (k) { return k.nama; })).map(function (x) { return x.toLowerCase(); });
  var dipakai = {};
  var sudahId = {};
  var ganti = {};
  var hasil = masukan.map(function (m) {
    m = m && typeof m === 'object' ? m : {};
    var bagian = m.bagian === 'kepala' ? 'kepala' : 'baris';
    var label = periksaNama_(m.label, 'Label kolom', PANJANG_LABEL_MAKS);
    var kecil = label.toLowerCase();
    if (terlarang.indexOf(kecil) >= 0) throw galatPengguna_('Label ' + label + ' sudah dipakai sistem. Pakai label lain.');
    if (dipakai[kecil]) throw galatPengguna_('Ada dua kolom berlabel ' + label + '. Pakai label yang berbeda.');
    dipakai[kecil] = true;
    var jenis = JENIS_KOLOM.indexOf(m.jenis) >= 0 ? m.jenis : '';
    if (!jenis) throw galatPengguna_('Pilih jenis kolom ' + label + '.');
    var id = rapikanTeks_(m.id).toUpperCase();
    var c = id && petaLama[id] && !sudahId[id] ? petaLama[id] : null;
    if (c) {
      sudahId[id] = true;
      if (c.bagian !== bagian) throw galatPengguna_('Kolom ' + c.label + ' tidak bisa dipindah antara kolom kepala dan kolom baris.');
      if (adaIsian && c.jenis !== jenis) {
        throw galatPengguna_('Jenis kolom ' + c.label + ' tidak bisa diganti karena form ini sudah punya isian. Hapus kolomnya, lalu buat kolom baru.');
      }
      if (c.label !== label) ganti[c.id] = c.label;
    } else {
      nomorTerbesar++;
      id = 'K' + nomorTerbesar;
    }
    return {
      id: id, bagian: bagian, label: label, jenis: jenis,
      pilihan: jenis === 'Pilihan' ? periksaPilihanKolom_(m.pilihan, label) : (jenis === 'Ya/Tidak' ? ['Ya', 'Tidak'] : []),
      wajib: m.wajib === true, aktif: true
    };
  });
  if (!hasil.some(function (c) { return c.bagian === 'baris'; })) throw galatPengguna_('Tambah minimal satu kolom baris.');
  lama.forEach(function (c) {
    if (sudahId[c.id]) return;
    if (dipakai[c.label.toLowerCase()]) {
      throw galatPengguna_('Label ' + c.label + ' masih dipakai kolom yang sudah dihapus dari form ini. Pakai label lain.');
    }
    hasil.push({ id: c.id, bagian: c.bagian, label: c.label, jenis: c.jenis, pilihan: c.pilihan, wajib: c.wajib, aktif: false });
  });
  return { semua: hasil, ganti: ganti };
}

/** Menulis ulang baris M_FormKolom satu form (baris form lain tetap, urutannya tidak berubah). */
function tulisKolomForm_(idForm, kolom) {
  var t = wajibTabel_('M_FormKolom');
  var lebar = t.judul.length;
  var tetap = t.baris.filter(function (b) {
    return kunciTerisi_(nilai_(t, b, 'ID Form')) && rapikanTeks_(nilai_(t, b, 'ID Form')).toUpperCase() !== idForm;
  });
  var urut = kolom.filter(function (c) { return c.aktif && c.bagian === 'kepala'; })
    .concat(kolom.filter(function (c) { return c.aktif && c.bagian === 'baris'; }))
    .concat(kolom.filter(function (c) { return !c.aktif; }));
  urut.forEach(function (c, i) {
    tetap.push(susunBaris_(t, {
      'ID Form': idForm,
      'Urutan': i + 1,
      'Label': c.label,
      'Jenis Kolom': c.jenis,
      'Pilihan': c.jenis === 'Pilihan' ? c.pilihan.join(PEMISAH_PILIHAN) : '',
      'Wajib': !!c.wajib,
      'Bagian': c.bagian,
      'Aktif': !!c.aktif,
      'ID Kolom': c.id
    }));
  });
  var sheet = t.sheet;
  var perlu = tetap.length + 1;
  if (sheet.getMaxRows() < perlu) sheet.insertRowsAfter(sheet.getMaxRows(), perlu - sheet.getMaxRows());
  if (tetap.length) sheet.getRange(2, 1, tetap.length, lebar).setValues(tetap);
  if (t.baris.length > tetap.length) sheet.getRange(tetap.length + 2, 1, t.baris.length - tetap.length, lebar).clearContent();
  resetMemoForm_();
}

/**
 * Simpan form (Pengaturan → Form). body: { baru, formId, nama, tampil,
 * keterangan, jadwal, hari: [nama hari], kolom: [{ id, bagian, label, jenis,
 * pilihan, wajib }] }. Form bawaan hanya bisa diganti nama dan
 * ditampilkan/disembunyikan; kolomnya terkunci. Form kustom baru mendapat ID
 * dari namanya dan tab Data_K_<ID> dibuat saat itu juga.
 */
function aksiSimpanForm_(body) {
  var baru = body.baru === true;
  var nama = periksaNama_(body.nama, 'Nama form', PANJANG_NAMA_FORM_MAKS);
  var tampil = body.tampil !== false;
  return denganKunci_(function () {
    resetMemoForm_();
    var semua = bacaDaftarForm_(true);
    var idMinta = rapikanTeks_(body.formId).toUpperCase();
    var f = baru ? null : semua.filter(function (x) { return x.id === idMinta && !x.diarsipkan; })[0];
    if (!baru && !f) throw galatPengguna_('Form tidak ditemukan. Kembali ke daftar form.');
    semua.forEach(function (x) {
      if (x === f || !samaNama_(x.nama, nama)) return;
      throw galatPengguna_(x.diarsipkan
        ? 'Nama ' + nama + ' dipakai form yang sudah dihapus. Pulihkan form itu dari daftar form, atau pakai nama lain.'
        : 'Sudah ada form bernama ' + x.nama + '. Pakai nama lain.');
    });
    var t = wajibTabel_('M_Form');
    if (f && f.jenis === 'bawaan') {
      tulisBarisMaster_(t, f.baris, { 'Nama': nama, 'Aktif': tampil });
      var dB = dataPengaturanForm_();
      dB.disimpan = { id: f.id, nama: nama, tampil: tampil };
      return dB;
    }
    wajibKolomFormSiap_();
    if (baru && semua.filter(function (x) { return x.jenis === 'kustom' && !x.diarsipkan; }).length >= BATAS_FORM_KUSTOM) {
      throw galatPengguna_('Paling banyak ' + BATAS_FORM_KUSTOM + ' form kustom. Hapus form yang tidak dipakai lagi dulu.');
    }
    var keterangan = rapikanTeks_(body.keterangan);
    if (keterangan.length > PANJANG_KETERANGAN_FORM_MAKS) {
      throw galatPengguna_('Keterangan paling panjang ' + PANJANG_KETERANGAN_FORM_MAKS + ' huruf.');
    }
    var jadwal = String(body.jadwal || '');
    if (JADWAL_FORM.indexOf(jadwal) < 0) throw galatPengguna_('Pilih jadwal form: Setiap hari, Hari tertentu, atau Sewaktu-waktu.');
    var hari = jadwal === 'hari tertentu' ? bacaHari_((Array.isArray(body.hari) ? body.hari : []).join(',')) : [];
    if (jadwal === 'hari tertentu' && !hari.length) throw galatPengguna_('Pilih minimal satu hari untuk jadwal Hari tertentu.');
    var lama = f ? kolomForm_(f.id) : [];
    var adaIsian = f ? adaIsianForm_(f.id) : false;
    var kolom = periksaKolomForm_(body.kolom, lama, adaIsian);
    var id = f ? f.id : buatIdForm_(nama, semua);
    if (f) {
      tulisBarisMaster_(t, f.baris, {
        'Nama': nama, 'Keterangan': teksAman_(keterangan), 'Jadwal': jadwal, 'Aktif': tampil, 'Hari': hari.join(', ')
      });
    } else {
      var urutan = 0;
      semua.forEach(function (x) { if (x.urutan < 999) urutan = Math.max(urutan, x.urutan); });
      tambahBarisMaster_('M_Form', {
        'ID Form': id, 'Nama': nama, 'Jenis': 'kustom', 'Keterangan': teksAman_(keterangan), 'Jadwal': jadwal,
        'Urutan': urutan + 1, 'Aktif': tampil, 'Hari': hari.join(', '), 'Diarsipkan': ''
      });
    }
    tulisKolomForm_(id, kolom.semua);
    resetMemoForm_();
    siapkanTabKustom_(ss_(), cariForm_(id, true), kolomForm_(id), { ganti: kolom.ganti });
    var petaLog = {};
    Object.keys(kolom.ganti).forEach(function (idKolom) {
      var c = kolom.semua.filter(function (x) { return x.id === idKolom; })[0];
      if (c) petaLog[kolom.ganti[idKolom]] = c.label;
    });
    if (Object.keys(petaLog).length) gantiLabelLog_(tabDataForm_(id), petaLog);
    var d = dataPengaturanForm_();
    d.disimpan = { id: id, nama: nama, tampil: tampil };
    return d;
  });
}

/** Sakelar tampil/sembunyi di daftar form (bawaan maupun kustom). */
function aksiAturFormTampil_(body) {
  var tampil = body.tampil === true;
  return denganKunci_(function () {
    var f = cariForm_(body.formId);
    if (!f) throw galatPengguna_('Form tidak ditemukan. Muat ulang daftar form.');
    tulisBarisMaster_(wajibTabel_('M_Form'), f.baris, { 'Aktif': tampil });
    return dataPengaturanForm_();
  });
}

/** Urutan form di Beranda: urutan berisi semua ID form yang belum dihapus. */
function aksiUrutForm_(body) {
  var urutan = (Array.isArray(body.urutan) ? body.urutan : []).map(function (x) { return rapikanTeks_(x).toUpperCase(); });
  return denganKunci_(function () {
    resetMemoForm_();
    var daftar = bacaDaftarForm_();
    var ada = {};
    daftar.forEach(function (f) { ada[f.id] = f; });
    var unik = {};
    urutan.forEach(function (id) { unik[id] = true; });
    if (urutan.length !== daftar.length || Object.keys(unik).length !== daftar.length || urutan.some(function (id) { return !ada[id]; })) {
      throw galatPengguna_('Daftar form berubah. Muat ulang layar ini, lalu atur urutannya lagi.');
    }
    var t = wajibTabel_('M_Form');
    urutan.forEach(function (id, i) {
      if (ada[id].urutan !== i + 1) tulisBarisMaster_(t, ada[id].baris, { 'Urutan': i + 1 });
    });
    return dataPengaturanForm_();
  });
}

/**
 * Hapus form kustom = arsipkan (Bagian 5.6): form hilang dari aplikasi; tab
 * datanya tetap ada dengan tanda arsip dan bisa dipulihkan Pengelola.
 */
function aksiArsipkanForm_(body) {
  return denganKunci_(function () {
    wajibKolomFormSiap_();
    var f = cariForm_(body.formId);
    if (!f) throw galatPengguna_('Form tidak ditemukan. Muat ulang daftar form.');
    if (f.jenis !== 'kustom') throw galatPengguna_('Form bawaan tidak bisa dihapus, hanya bisa disembunyikan.');
    var kini = new Date();
    tulisBarisMaster_(wajibTabel_('M_Form'), f.baris, { 'Diarsipkan': kini });
    var sheet = ss_().getSheetByName(tabDataForm_(f.id));
    if (sheet) {
      f.diarsipkan = kini;
      sheet.setTabColor(WARNA.garis);
      tandaArsipTab_(sheet, f);
    }
    return dataPengaturanForm_();
  });
}

/** Memulihkan form kustom yang diarsipkan: tampil lagi di urutan terakhir, dengan keadaan tampil seperti sebelum dihapus. */
function aksiPulihkanForm_(body) {
  return denganKunci_(function () {
    wajibKolomFormSiap_();
    resetMemoForm_();
    var semua = bacaDaftarForm_(true);
    var id = rapikanTeks_(body.formId).toUpperCase();
    var f = semua.filter(function (x) { return x.id === id && x.diarsipkan; })[0];
    if (!f) throw galatPengguna_('Form tidak ditemukan di daftar form yang dihapus. Muat ulang layar ini.');
    var aktif = semua.filter(function (x) { return !x.diarsipkan; });
    if (aktif.filter(function (x) { return x.jenis === 'kustom'; }).length >= BATAS_FORM_KUSTOM) {
      throw galatPengguna_('Sudah ada ' + BATAS_FORM_KUSTOM + ' form kustom. Hapus satu form dulu untuk memulihkan form ini.');
    }
    aktif.forEach(function (x) {
      if (samaNama_(x.nama, f.nama)) throw galatPengguna_('Sudah ada form bernama ' + x.nama + '. Ganti nama form itu dulu.');
    });
    var urutan = 0;
    aktif.forEach(function (x) { if (x.urutan < 999) urutan = Math.max(urutan, x.urutan); });
    tulisBarisMaster_(wajibTabel_('M_Form'), f.baris, { 'Diarsipkan': '', 'Urutan': urutan + 1 });
    f.diarsipkan = null;
    siapkanTabKustom_(ss_(), f, kolomForm_(f.id), {});
    return dataPengaturanForm_();
  });
}

/* ---------- Layar isi form kustom (semua role) ---------- */

/**
 * Nilai satu kolom form kustom untuk ditulis ke Sheet; '' jika kosong.
 * Angka: 0 atau lebih (butir 35). Pilihan dan Ya/Tidak: salah satu
 * pilihannya. Item: nama di M_Item. Jam: "07:30".
 */
function nilaiKolomKustom_(c, mentah, label, master) {
  if (mentah == null) return '';
  if (c.jenis === 'Angka') {
    if (String(mentah).trim() === '') return '';
    return angkaIsian_(mentah, label);
  }
  var t = rapikanTeks_(mentah);
  if (!t) return '';
  if (c.jenis === 'Pilihan' || c.jenis === 'Ya/Tidak') {
    var p = c.pilihan.filter(function (x) { return x.toLowerCase() === t.toLowerCase(); })[0];
    if (!p) throw galatPengguna_('Pilih ' + label + ' dari pilihannya.');
    return p;
  }
  if (c.jenis === 'Item') {
    var m = (master || bacaItem_())[t.toLowerCase()];
    if (!m) throw galatPengguna_('Item ' + t + ' di kolom ' + label + ' tidak ada di daftar item. Muat ulang form.');
    return m.nama;
  }
  if (c.jenis === 'Jam') {
    var j = /^(\d{1,2})[:.](\d{2})$/.exec(t);
    if (!j || Number(j[1]) > 23 || Number(j[2]) > 59) throw galatPengguna_(label + ' diisi jam, misalnya 07:30.');
    return ('0' + Number(j[1])).slice(-2) + ':' + j[2];
  }
  return t.slice(0, PANJANG_TEKS_ISIAN_MAKS);
}

/** Nilai yang tersimpan di Sheet, dalam bentuk yang sama dengan nilaiKolomKustom_. */
function nilaiTersimpanKustom_(c, v) {
  if (v === '' || v == null) return '';
  if (c.jenis === 'Angka') return isFinite(Number(v)) ? Number(v) : rapikanTeks_(v);
  if (c.jenis === 'Jam' && v instanceof Date) return Utilities.formatDate(v, zonaSheet_(), 'HH:mm');
  return rapikanTeks_(v);
}

function kataIsi_(c) {
  return c.jenis === 'Pilihan' || c.jenis === 'Ya/Tidak' || c.jenis === 'Item' ? 'Pilih ' : 'Isi ';
}

/**
 * Data layar isi form kustom: definisi (kolom aktif), item untuk kolom Item,
 * kiriman dan tanda nihil pada tanggal itu. Disimpan di HP supaya form bisa
 * dibuka tanpa sinyal.
 */
function dataFormKustom_(f, tanggal) {
  var zona = zonaSheet_();
  var def = definisiForm_(f, false);
  var kiriman = bacaBarisTanggal_(tabDataForm_(f.id), tanggal, zona, ['submission_id']);
  var sid = {};
  kiriman.forEach(function (b) { if (b.submission_id) sid[b.submission_id] = true; });
  var nihil = bacaBarisTanggal_('Data_Nihil', tanggal, zona, ['ID Form']).filter(function (n) {
    return rapikanTeks_(n['ID Form']).toUpperCase() === f.id;
  });
  return {
    formId: f.id,
    tanggal: tanggal,
    form: def,
    item: def.kolom.some(function (c) { return c.jenis === 'Item'; }) ? itemAktifRingkas_() : [],
    kiriman: { jumlah: Object.keys(sid).length, baris: kiriman.length, terakhir: barisTerakhir_(kiriman) },
    nihil: nihil.length ? barisTerakhir_(nihil) : null,
    wajib: wajibPada_(f, tanggal),
    libur: liburUntukJawaban_(tanggal)
  };
}

function aksiFormKustom_(body) {
  if (!tanggalSah_(body.tanggal)) throw galatPengguna_('Tanggal tidak terbaca. Pilih tanggal lagi.');
  var f = cariForm_(body.formId);
  if (!f || f.jenis !== 'kustom') throw galatPengguna_('Form ini tidak ditemukan. Mungkin sudah dihapus Pengelola.');
  if (!f.aktif) throw galatPengguna_('Form ini sedang disembunyikan. Pengelola bisa menampilkannya lagi dari Pengaturan → Form.');
  return dataFormKustom_(f, body.tanggal);
}

/**
 * Kiriman form kustom: satu baris Data_K_<ID> per baris isian, kolom kepala
 * diulang di tiap baris (Bagian 5.0). body: { formId, submissionId, tanggal,
 * waktuPerangkat, kepala: { idKolom: nilai }, baris: [{ idKolom: nilai }] }.
 * Baris yang semua kolomnya kosong dilewati. Kolom wajib diperiksa menurut
 * definisi saat server menerima kiriman; nilai kolom yang sudah dihapus tetap
 * ditulis (isian dari antrean tidak hilang).
 */
function aksiKirimKustom_(body, pengguna) {
  var tanggal = periksaTanggalIsian_(body.tanggal, pengguna);
  var konteks = konteksKiriman_(body, pengguna);
  resetMemoForm_();
  var f = cariForm_(body.formId, true);
  if (!f || f.jenis !== 'kustom') throw galatPengguna_('Form ini sudah tidak ada. Hapus isian ini dari HP.');
  var kolom = kolomForm_(f.id);
  var master = kolom.some(function (c) { return c.jenis === 'Item'; }) ? bacaItem_() : null;
  var isiKepala = body.kepala && typeof body.kepala === 'object' ? body.kepala : {};
  var masukan = Array.isArray(body.baris) ? body.baris : [];
  if (masukan.length > BARIS_KUSTOM_MAKS) throw galatPengguna_('Paling banyak ' + BARIS_KUSTOM_MAKS + ' baris untuk satu kiriman.');

  var kepala = {};
  kolom.filter(function (c) { return c.bagian === 'kepala'; }).forEach(function (c) {
    var v = nilaiKolomKustom_(c, isiKepala[c.id], c.label, master);
    if (v === '' && c.aktif && c.wajib) throw galatPengguna_(kataIsi_(c) + c.label + '.');
    if (v !== '') kepala[c.label] = typeof v === 'string' ? teksAman_(v) : v;
  });
  var kolomBaris = kolom.filter(function (c) { return c.bagian === 'baris'; });
  var baris = [];
  masukan.forEach(function (m, i) {
    m = m && typeof m === 'object' ? m : {};
    var isi = {};
    var ada = false;
    kolomBaris.forEach(function (c) {
      var v = nilaiKolomKustom_(c, m[c.id], c.label + ' di baris ' + (i + 1), master);
      if (v !== '') {
        ada = true;
        isi[c.label] = typeof v === 'string' ? teksAman_(v) : v;
      }
    });
    if (!ada) return;
    kolomBaris.forEach(function (c) {
      if (c.aktif && c.wajib && !Object.prototype.hasOwnProperty.call(isi, c.label)) {
        throw galatPengguna_(kataIsi_(c) + c.label + ' di baris ' + (i + 1) + '.');
      }
    });
    baris.push(isi);
  });
  if (!baris.length) throw galatPengguna_('Isi minimal satu baris.');

  return denganKunci_(function () {
    var namaTab = tabDataForm_(f.id);
    var tabel = bacaTabel_(namaTab);
    var perlu = kolomTabKustom_(kolom).map(function (k) { return k.nama; });
    if (!tabel || perlu.some(function (j) { return tabel.kol[j] === undefined; })) {
      siapkanTabKustom_(ss_(), f, kolom, {});
      tabel = wajibTabel_(namaTab);
    }
    if (adaSubmission_(tabel, konteks.sid)) {
      return { sudahTerkirim: true, jumlah: 0, form: dataFormKustom_(f, tanggal) };
    }
    var baru = baris.map(function (isi, i) {
      return gabung_(gabung_({ 'Tanggal': tanggalSel_(tanggal), 'Nama Staff': pengguna.nama, 'No': i + 1 }, kepala),
        gabung_(isi, isiSistem_(konteks)));
    });
    tambahBarisTabel_(tabel, baru);
    urutkanTabel_(tabel, URUTAN_KUSTOM);
    return { sudahTerkirim: false, jumlah: baru.length, form: dataFormKustom_(f, tanggal) };
  });
}

/* ---------- Riwayat dan PDF form kustom ---------- */

/** Kolom Riwayat dari satu kolom form kustom (Tahap 3: RIWAYAT_FORM). */
function kolomRiwayatKustom_(c, ambilMaster) {
  var jenis = c.jenis === 'Angka' ? 'angka' : (c.jenis === 'Item' ? 'item' : 'teks');
  var k = {
    judul: c.label,
    kunci: 'c' + c.id,
    label: c.label + (c.aktif ? '' : ' (dihapus)'),
    singkat: c.label.toLowerCase(),
    jenis: jenis,
    koreksi: c.aktif,
    opsional: !c.wajib,
    ubah: function (v, label) { return nilaiKolomKustom_(c, v, label, ambilMaster()); },
    normal: function (v) { return nilaiTersimpanKustom_(c, v); }
  };
  if (c.pilihan.length) k.pilihan = c.pilihan;
  if (c.jenis === 'Jam') k.waktu = true;
  // Kolom yang sudah dihapus: hanya tampil di baris yang berisi, dan tidak bisa dikoreksi.
  if (!c.aktif) k.jikaAda = true;
  return k;
}

/** Definisi Riwayat form kustom dari M_FormKolom, atau null. */
function defRiwayatKustom_(idForm) {
  var f = cariForm_(idForm, true);
  if (!f || f.jenis !== 'kustom') return null;
  var kolom = kolomForm_(f.id);
  var master = null;
  var ambilMaster = function () { return master || (master = bacaItem_()); };
  var item = kolom.filter(function (c) { return c.bagian === 'baris' && c.jenis === 'Item'; })[0];
  var wajib = kolom.filter(function (c) { return c.aktif && c.wajib && c.bagian === 'baris'; });
  return {
    tab: tabDataForm_(f.id),
    kustom: true,
    kepala: kolom.filter(function (c) { return c.bagian === 'kepala'; }).map(function (c) {
      return { judul: c.label, kunci: 'c' + c.id, label: c.label };
    }),
    kolom: kolom.filter(function (c) { return c.bagian === 'baris'; }).map(function (c) { return kolomRiwayatKustom_(c, ambilMaster); }),
    item: item ? item.label : '',
    kategoriDariItem: !!item,
    periksaKoreksi: function (n) {
      wajib.forEach(function (c) {
        if (n[c.label] === '' || n[c.label] == null) throw galatPengguna_(kataIsi_(c) + c.label + '. Kolom ini wajib.');
      });
    }
  };
}

/** Template PDF satu form: LAPORAN_PDF untuk form bawaan, template umum untuk form kustom (Bagian 9.1 butir 4). */
function laporanPdf_(idForm) {
  var id = rapikanTeks_(idForm).toUpperCase();
  if (LAPORAN_PDF[id]) return LAPORAN_PDF[id];
  var f = cariForm_(id, true);
  if (!f || f.jenis !== 'kustom') return null;
  return { judul: f.nama, isi: function (tanggal) { return isiPdfKustom_(f, tanggal); } };
}

/**
 * PDF form kustom (template umum): judul = nama form, kotak info (jumlah isian
 * dan baris), satu tabel sesuai kolomnya (No, Nama Staff, jam kirim, kolom
 * kepala, kolom baris), lalu Diisi oleh dan Diperiksa oleh. Kolom yang sudah
 * dihapus dari form hanya tampil jika ada isinya pada tanggal itu.
 */
function isiPdfKustom_(f, tanggal) {
  var kolom = kolomForm_(f.id);
  var baris = barisDataTanggal_(tabDataForm_(f.id), tanggal);
  var berisi = function (c) {
    return baris.some(function (b) { return nilaiTersimpanKustom_(c, b[c.label]) !== ''; });
  };
  var tampil = kolom.filter(function (c) { return c.aktif || berisi(c); });
  var urut = tampil.filter(function (c) { return c.bagian === 'kepala'; }).concat(tampil.filter(function (c) { return c.bagian === 'baris'; }));
  var sid = {};
  baris.forEach(function (b) { sid[String(b.submission_id)] = true; });
  var lebarSisa = urut.length ? (79 / urut.length).toFixed(1) : 79;
  var judul = ['No', 'Nama Staff', 'Jam'].concat(urut.map(function (c) { return c.label + (c.aktif ? '' : ' (dihapus)'); }));
  var isiBaris = baris.map(function (b, i) {
    return '<tr><td class="angka">' + (i + 1) + '</td><td>' + escHtml_(rapikanTeks_(b['Nama Staff'] || b.submitted_by)) + '</td>' +
      '<td class="tengah">' + escHtml_(b.timestamp_server instanceof Date ? jamId_(b.timestamp_server) : '') + '</td>' +
      urut.map(function (c) {
        var v = nilaiTersimpanKustom_(c, b[c.label]);
        if (c.jenis === 'Angka') return '<td class="angka">' + (v === '' ? '' : angkaId_(Number(v))) + '</td>';
        return '<td' + (c.jenis === 'Ya/Tidak' || c.jenis === 'Jam' ? ' class="tengah"' : '') + '>' + escHtml_(v) + '</td>';
      }).join('') + '</tr>';
  }).join('');
  var tabel = '<table class="data"><colgroup><col style="width:4%"><col style="width:11%"><col style="width:6%">' +
    urut.map(function () { return '<col style="width:' + lebarSisa + '%">'; }).join('') + '</colgroup><thead><tr>' +
    judul.map(function (j) { return '<th>' + escHtml_(j) + '</th>'; }).join('') + '</tr></thead><tbody>' +
    (isiBaris || '<tr><td colspan="' + judul.length + '">Belum ada isian.</td></tr>') + '</tbody></table>';
  var info = [];
  if (f.keterangan) info.push(['Keterangan', f.keterangan]);
  info.push(['Jumlah isian', String(Object.keys(sid).length)]);
  info.push(['Jumlah baris', String(baris.length)]);
  var catatan = [];
  if (urut.some(function (c) { return !c.aktif; })) {
    catatan.push('Kolom bertanda (dihapus) sudah dihapus dari form; isian lamanya tetap ditampilkan.');
  }
  return { ada: baris.length > 0, judul: f.nama, info: info, tabel: tabel, catatan: catatan };
}

/* =========================================================================
 * Tahap 3: Riwayat, pemeriksaan, dan koreksi (spesifikasi sistem Bagian 6)
 * ========================================================================= */

/** Sekali ambil Riwayat paling banyak 31 hari (Bagian 6.1). */
var BATAS_RIWAYAT_HARI = 31;

var STATUS_TERKIRIM = 'Terkirim';
var STATUS_DIPERIKSA = 'Diperiksa';

/**
 * Form yang punya Riwayat. Form lain cukup didaftarkan di sini: Waste dan
 * Suhu (Tahap 5), Prep List (Tahap 6). Form kustom (Tahap 9) dibuat dari
 * M_FormKolom di defRiwayat_.
 * tab      : tab Data form itu (kolom sistem Bagian 5.0 di kanan)
 * kepala   : kolom kepala, sama untuk satu kiriman (tampil sekali per kiriman)
 * kolom    : kolom baris, urut seperti di layar isi. jenis: teks | angka | item.
 *            singkat: label pendek untuk ringkasan di daftar Riwayat.
 *            koreksi: boleh dikoreksi Pengelola. satuan: angka memakai satuan
 *            baris (kolom def.satuan). asli: judul kolom angka asli yang
 *            diketik, dikosongkan saat angkanya dikoreksi.
 * satuan   : judul kolom satuan baris
 * item, kategori : kolom untuk filter Item dan Kategori
 * stock    : penyesuaian stock dan stock opname ikut tampil, dan Riwayat punya
 *            tampilan Rekap harian
 * setelahKoreksi(baris) : dijalankan di dalam kunci setelah satu baris
 *            dikoreksi; baris: { tanggal, nilai: { judul: nilai } }.
 * Tahap 5:
 * kolom.jenis juga rupiah (angka rupiah) dan status (Normal / Di Luar
 *            Standar, tampil sebagai tanda). kolom.minus: angka boleh minus
 *            (suhu). kolom.akhiran: satuan tetap di belakang angka ("°C").
 *            kolom.pilihan: koreksi memilih dari daftar ini. kolom.ringkas:
 *            false = tidak ikut ringkasan di daftar Riwayat.
 * kategoriDariItem : filter Kategori memakai kategori item di M_Item (tab
 *            data tidak punya kolom Kategori, misalnya Data_Waste)
 * itemDariUnit : filter Item berisi unit dari M_Unit, berlabel "Unit"
 * terlewat : pengecekan Opening/Middle/Closing yang tidak diisi ikut tampil
 * gerakStock : koreksi menghitung ulang stock (pesan di layar koreksi)
 * turunan(nilai) : kolom yang dihitung ulang saat koreksi { judul: nilai }
 * periksaKoreksi(nilai) : melempar galatPengguna_ jika hasil koreksi tidak sah
 *            (nilai: semua kolom baris sesudah koreksi dan turunannya)
 * Tahap 6:
 * kolom.jenis juga tanggal (yyyy-mm-dd). kolom.jikaAda: kolom hanya berlaku
 *            untuk baris yang berisi (Jumlah Resep untuk prep beresep, Qty
 *            untuk prep tanpa resep); kosong tampil "–" dan tidak dikoreksi.
 *            kolom.bantuan: keterangan di layar koreksi.
 * rincian(kiriman) : menambah b.rincian ke tiap baris (bahan prep)
 * setelahKoreksi(baris, pengguna, kini)
 */
var RIWAYAT_FORM = {
  STOCK: {
    tab: 'Data_Stock',
    kepala: [{ judul: 'Kategori', kunci: 'kategori', label: 'Kategori' }, { judul: 'Pemasok', kunci: 'pemasok', label: 'Pemasok' }],
    kolom: [
      { judul: 'Nama Item', kunci: 'item', label: 'Nama Item', jenis: 'item' },
      { judul: 'Stock Masuk', kunci: 'masuk', label: 'Stock Masuk', singkat: 'masuk', jenis: 'angka', koreksi: true, satuan: true, asli: 'Masuk Diketik' },
      { judul: 'Stock Keluar', kunci: 'keluar', label: 'Stock Keluar', singkat: 'keluar', jenis: 'angka', koreksi: true, satuan: true },
      // Harga beli per satuan dasar (Code.gs v0.23); tidak wajib, jadi boleh dikosongkan saat koreksi.
      { judul: 'Harga Beli (Rp)', kunci: 'hargaBeli', label: 'Harga beli', singkat: 'harga beli', jenis: 'rupiah', koreksi: true, opsional: true,
        jikaPositif: 'masuk', bantuan: 'Rupiah per satuan dasar (per kg, per botol). Kosongkan jika tidak ada.',
        normal: function (v) { var n = angkaAtauNull_(v); return n == null ? '' : n; },
        ubah: function (v, label) { var n = angkaOpsional_(v, label, 2); return n == null ? '' : n; } },
      // Baik sampai barang masuk (Code.gs v0.25); hanya tampil pada baris yang punya Stock Masuk.
      { judul: 'Baik Sampai', kunci: 'baikSampai', label: 'Baik sampai', singkat: 'baik sampai', jenis: 'tanggal', koreksi: true,
        opsional: true, jikaPositif: 'masuk', bantuan: 'Tanggal terakhir barang ini baik dipakai. Kosongkan jika tidak ada.',
        normal: function (v) { return teksTanggal_(v, zonaSheet_()); },
        ubah: function (v, label) {
          var t = rapikanTeks_(v);
          if (t && !tanggalSah_(t)) throw galatPengguna_(label + ' tidak terbaca. Pilih tanggal lagi.');
          return t;
        } },
      // Hitung sisa (Code.gs v0.28): sisa yang diketik; Stock Keluar baris ini dihitung darinya. Tidak dikoreksi langsung.
      { judul: 'Sisa Dihitung', kunci: 'sisa', label: 'Sisa dihitung', singkat: 'sisa dihitung', jenis: 'angka', satuan: true, jikaAda: true }
    ],
    // Baris hitung sisa: koreksi Stock Masuk menggeser Stock Keluar sebesar selisihnya, supaya Stock Akhir tetap sama
    // dengan sisa yang dihitung. Koreksi Stock Keluar langsung membuat baris itu bukan hasil hitung lagi (sisa dikosongkan).
    turunan: function (n, lama) {
      if (!lama || n['Sisa Dihitung'] === '' || n['Sisa Dihitung'] == null) return {};
      var keluarLama = Number(lama['Stock Keluar']) || 0;
      if ((Number(n['Stock Keluar']) || 0) !== keluarLama) return { 'Sisa Dihitung': '' };
      var beda = bulat_((Number(n['Stock Masuk']) || 0) - (Number(lama['Stock Masuk']) || 0));
      if (!beda) return {};
      var keluar = bulat_(keluarLama + beda);
      return keluar < 0 ? { 'Stock Keluar': 0, 'Sisa Dihitung': '' } : { 'Stock Keluar': keluar };
    },
    periksaKoreksi: function (g) {
      if (g['Harga Beli (Rp)'] !== '' && g['Harga Beli (Rp)'] != null && !(Number(g['Stock Masuk']) > 0)) {
        throw galatPengguna_('Harga beli hanya untuk barang masuk. Kosongkan harga beli, atau isi Stock Masuk.');
      }
      var zona = zonaSheet_();
      var baik = teksTanggal_(g['Baik Sampai'], zona);
      if (baik && baik < teksTanggal_(g['Tanggal'], zona)) {
        throw galatPengguna_('Baik sampai tidak boleh sebelum tanggal barang masuk.');
      }
    },
    satuan: 'Satuan',
    item: 'Nama Item',
    kategori: 'Kategori',
    stock: true,
    // Koreksi berantai (Bagian 6.3): rekap hari itu dan semua rekap sesudahnya dihitung ulang.
    setelahKoreksi: function (baris) {
      hitungUlangStock_([{ item: baris.nilai['Nama Item'], dari: baris.tanggal }]);
    },
    gerakStock: true
  },
  WASTE: {
    tab: 'Data_Waste',
    kepala: [{ judul: 'Shift', kunci: 'shift', label: 'Shift' }],
    kolom: [
      { judul: 'Item / Produk', kunci: 'item', label: 'Item / Produk', jenis: 'item' },
      { judul: 'Kategori Waste', kunci: 'kategoriWaste', label: 'Kategori waste', singkat: 'kategori', jenis: 'teks', koreksi: true, pilihan: KATEGORI_WASTE },
      { judul: 'Qty', kunci: 'qty', label: 'Qty', singkat: 'qty', jenis: 'angka', koreksi: true, satuan: true },
      { judul: 'Alasan / Keterangan', kunci: 'alasan', label: 'Alasan', singkat: 'alasan', jenis: 'teks', koreksi: true },
      { judul: 'Estimasi Kerugian (Rp)', kunci: 'estimasi', label: 'Estimasi kerugian', singkat: 'rugi', jenis: 'rupiah' }
    ],
    satuan: 'Satuan',
    item: 'Item / Produk',
    kategoriDariItem: true,
    gerakStock: true,
    // Foto bukti (Tahap 11): baris diberi tanda; tautannya hanya untuk Pengelola (barisRiwayat_).
    foto: 'Foto Bukti',
    // Estimasi memakai harga yang disalin saat waste dicatat (Bagian 5.4).
    turunan: function (n) {
      return { 'Estimasi Kerugian (Rp)': estimasiWaste_(n['Qty'], n['Harga Satuan (Rp)']) };
    },
    periksaKoreksi: function (n) {
      periksaBarisWaste_(rapikanTeks_(n['Kategori Waste']), n['Alasan / Keterangan'], rapikanTeks_(n['Item / Produk']));
    },
    // Waste mengurangi stock: rekap hari itu dan sesudahnya dihitung ulang (Bagian 5.5).
    setelahKoreksi: function (baris) {
      hitungUlangStock_([{ item: baris.nilai['Item / Produk'], dari: baris.tanggal }]);
    }
  },
  SUHU: {
    tab: 'Data_Suhu',
    kepala: [{ judul: 'Waktu Cek', kunci: 'waktuCek', label: 'Waktu cek' }],
    kolom: [
      { judul: 'Nama Unit', kunci: 'unit', label: 'Nama Unit', jenis: 'teks' },
      { judul: 'Tipe Unit', kunci: 'tipe', label: 'Tipe', jenis: 'teks', ringkas: false },
      { judul: 'Suhu (°C)', kunci: 'suhu', label: 'Suhu', singkat: 'suhu', jenis: 'angka', koreksi: true, minus: true, akhiran: '°C' },
      { judul: 'Status Suhu', kunci: 'status', label: 'Status', singkat: 'status', jenis: 'status' },
      { judul: 'Tindakan Korektif', kunci: 'tindakan', label: 'Tindakan korektif', singkat: 'tindakan', jenis: 'teks', koreksi: true }
    ],
    item: 'Nama Unit',
    itemDariUnit: true,
    terlewat: true,
    turunan: function (n) {
      return { 'Status Suhu': statusSuhuNilai_(n['Tipe Unit'], Number(n['Suhu (°C)']), batasSuhu_()) };
    },
    periksaKoreksi: function (n) {
      if (n['Status Suhu'] === STATUS_SUHU_LUAR && !rapikanTeks_(n['Tindakan Korektif'])) {
        throw galatPengguna_('Suhu ' + rapikanTeks_(n['Nama Unit']) + ' di luar standar. Tulis tindakan korektif.');
      }
    }
  },
  PREP: {
    tab: 'Data_Prep',
    kepala: [{ judul: 'Shift', kunci: 'shift', label: 'Shift' }],
    kolom: [
      { judul: 'Item / Menu Prep', kunci: 'item', label: 'Item / Menu Prep', jenis: 'item' },
      { judul: 'Jumlah Resep', kunci: 'jumlahResep', label: 'Jumlah resep', singkat: 'jumlah resep', jenis: 'angka', koreksi: true, jikaAda: true,
        bantuan: 'Hasil dan bahan dihitung ulang dengan resep yang tercatat saat prep dibuat.' },
      { judul: 'Hasil', kunci: 'hasil', label: 'Hasil', singkat: 'hasil', jenis: 'angka', satuan: true, jikaAda: true },
      // Hasil aktual (Code.gs v0.24): hanya untuk baris beresep (jikaKolom); kosong = hasil menurut resep.
      { judul: 'Hasil Aktual', kunci: 'hasilAktual', label: 'Hasil aktual', singkat: 'aktual', jenis: 'angka', koreksi: true, satuan: true,
        opsional: true, jikaKolom: 'jumlahResep', ringkas: false,
        bantuan: 'Hasil yang benar-benar jadi. Kosongkan untuk memakai hasil menurut resep.',
        normal: function (v) { var n = angkaAtauNull_(v); return n == null ? '' : n; },
        ubah: function (v, label) { var n = angkaOpsional_(v, label, 3); return n == null ? '' : n; } },
      { judul: 'Qty', kunci: 'qty', label: 'Qty', singkat: 'qty', jenis: 'angka', koreksi: true, satuan: true, jikaAda: true },
      { judul: 'Baik Sampai', kunci: 'baikSampai', label: 'Baik sampai', singkat: 'baik sampai', jenis: 'tanggal' },
      { judul: 'Keterangan', kunci: 'keterangan', label: 'Keterangan', singkat: 'ket', jenis: 'teks', koreksi: true }
    ],
    satuan: 'Satuan',
    item: 'Item / Menu Prep',
    kategoriDariItem: true,
    gerakStock: true,
    rincian: rincianPrep_,
    // Hasil = hasil aktual jika diisi, selain itu Jumlah Resep × Hasil per 1 Resep yang tercatat di baris itu
    // (resep saat prep dibuat).
    turunan: function (n) {
      var per1 = n['Hasil per 1 Resep'];
      if (per1 === '' || per1 == null) return {};
      var aktual = n['Hasil Aktual'];
      if (aktual !== '' && aktual != null) return { 'Hasil': Number(aktual) };
      return { 'Hasil': bulat_((Number(n['Jumlah Resep']) || 0) * Number(per1)) };
    },
    periksaKoreksi: function (n) {
      var nama = rapikanTeks_(n['Item / Menu Prep']);
      var beresep = n['Hasil per 1 Resep'] !== '' && n['Hasil per 1 Resep'] != null;
      if (!beresep && n['Hasil Aktual'] !== '' && n['Hasil Aktual'] != null) {
        throw galatPengguna_(nama + ' dicatat tanpa resep. Hasilnya sudah ditulis di Qty.');
      }
      if (beresep && Number(n['Qty'])) throw galatPengguna_(nama + ' dibuat dengan resep. Koreksi jumlah resepnya, bukan Qty.');
      if (!beresep && Number(n['Jumlah Resep'])) throw galatPengguna_(nama + ' dicatat tanpa resep. Koreksi Qty-nya.');
    },
    setelahKoreksi: setelahKoreksiPrep_
  }
};

/** Definisi Riwayat satu form, atau null jika Riwayat form itu belum dibangun. */
function defRiwayat_(idForm) {
  var id = rapikanTeks_(idForm).toUpperCase();
  var def = RIWAYAT_FORM[id] || (id ? defRiwayatKustom_(id) : null);
  // Harga beli dan pemasok baru ada setelah setupSpreadsheet (Code.gs v0.23).
  if (id === 'STOCK' && def && !pembelianSiap_()) {
    def = gabung_(def, {
      kepala: def.kepala.filter(function (k) { return k.kunci !== 'pemasok'; }),
      kolom: def.kolom.filter(function (k) { return k.kunci !== 'hargaBeli'; })
    });
  }
  // Baik sampai barang masuk baru ada setelah setupSpreadsheet (Code.gs v0.25).
  if (id === 'STOCK' && def && !masaSimpanItemSiap_()) {
    def = gabung_(def, { kolom: def.kolom.filter(function (k) { return k.kunci !== 'baikSampai'; }) });
  }
  // Sisa dihitung baru ada setelah setupSpreadsheet (Code.gs v0.28).
  if (id === 'STOCK' && def && !sisaStockSiap_()) {
    def = gabung_(def, { kolom: def.kolom.filter(function (k) { return k.kunci !== 'sisa'; }) });
  }
  // Hasil aktual prep baru ada setelah setupSpreadsheet (Code.gs v0.24).
  if (id === 'PREP' && def && !hasilAktualSiap_()) {
    def = gabung_(def, { kolom: def.kolom.filter(function (k) { return k.kunci !== 'hasilAktual'; }) });
  }
  // Estimasi kerugian waste tidak dikirim ke Staff (Bagian 5.4).
  if (id === 'WASTE' && def && !rupiahWasteTerlihat_()) {
    def = gabung_(def, { kolom: def.kolom.filter(function (k) { return k.jenis !== 'rupiah'; }) });
  }
  return def;
}

function wajibDefRiwayat_(idForm) {
  var def = defRiwayat_(idForm);
  if (!def) throw galatPengguna_('Riwayat form ini dibangun di tahap berikutnya.');
  return def;
}

function isoAtauNull_(nilai) {
  return nilai instanceof Date && !isNaN(nilai.getTime()) ? nilai.toISOString() : null;
}

/** Rentang tanggal Riwayat: bawaan 7 hari terakhir, paling banyak 31 hari. */
function rentangRiwayat_(body) {
  var hari = hariIni_();
  var sampai = tanggalSah_(body.sampai) ? body.sampai : hari;
  if (sampai > hari) sampai = hari;
  var dari = tanggalSah_(body.dari) ? body.dari : geserTanggal_(sampai, -6);
  if (dari > sampai) throw galatPengguna_('Tanggal awal harus sebelum atau sama dengan tanggal akhir.');
  if (geserTanggal_(dari, BATAS_RIWAYAT_HARI - 1) < sampai) {
    throw galatPengguna_('Riwayat paling banyak ' + BATAS_RIWAYAT_HARI + ' hari sekali ambil. Persempit rentang tanggalnya.');
  }
  periksaBelumDiarsip_(dari);
  return { dari: dari, sampai: sampai };
}

var STATUS_FILTER = ['terkirim', 'diperiksa', 'dilaporkan', 'dikoreksi'];

function filterRiwayat_(body) {
  return {
    kategori: rapikanTeks_(body.kategori).toLowerCase(),
    item: rapikanTeks_(body.item).toLowerCase(),
    pengisi: rapikanTeks_(body.pengisi).toLowerCase(),
    status: STATUS_FILTER.indexOf(body.status) >= 0 ? body.status : ''
  };
}

/**
 * Koreksi per baris dari Log_Perubahan untuk satu tab:
 * { row_id: { judulKolom: { lama, oleh, waktu } } }. lama = nilai sebelum
 * koreksi pertama (isian asli); oleh dan waktu = koreksi terakhir.
 */
function bacaLogKoreksi_(namaTab) {
  var t = bacaTabel_(TAB_LOG.nama);
  var hasil = {};
  if (!t) return hasil;
  t.baris.forEach(function (b) {
    if (rapikanTeks_(nilai_(t, b, 'Tab')) !== namaTab) return;
    var id = String(nilai_(t, b, 'row_id') || '');
    var kolom = rapikanTeks_(nilai_(t, b, 'Kolom'));
    if (!id || !kolom) return;
    var perBaris = hasil[id] = hasil[id] || {};
    var oleh = rapikanTeks_(nilai_(t, b, 'Oleh'));
    var waktu = isoAtauNull_(nilai_(t, b, 'Waktu'));
    if (!perBaris[kolom]) perBaris[kolom] = { lama: nilai_(t, b, 'Nilai Lama'), oleh: oleh, waktu: waktu };
    else {
      perBaris[kolom].oleh = oleh;
      perBaris[kolom].waktu = waktu;
    }
  });
  return hasil;
}

/** Menulis jejak koreksi: perubahan [[judulKolom, lama, baru]]. */
function catatLog_(namaTab, rowId, pengguna, kini, perubahan) {
  var log = wajibTabel_(TAB_LOG.nama);
  tambahBarisTabel_(log, perubahan.map(function (p) {
    return {
      'Waktu': kini,
      'Oleh': pengguna.nama,
      'Tab': namaTab,
      'row_id': rowId,
      'Kolom': p[0],
      'Nilai Lama': teksAman_(String(p[1] == null ? '' : p[1])),
      'Nilai Baru': teksAman_(String(p[2] == null ? '' : p[2]))
    };
  }));
}

/** Satu baris data untuk Riwayat. */
function barisRiwayat_(def, t, b, log) {
  var rowId = String(nilai_(t, b, 'row_id') || '');
  var logBaris = log[rowId] || {};
  var nilai = {};
  var asli = {};
  var koreksi = {};
  def.kolom.forEach(function (k) {
    var v = nilai_(t, b, k.judul);
    if (k.normal) v = k.normal(v);
    var angka = k.jenis === 'angka' || k.jenis === 'rupiah';
    nilai[k.kunci] = angka ? angkaAtauNull_(v) : (k.jenis === 'tanggal' ? teksTanggal_(v, zonaSheet_()) : rapikanTeks_(v));
    // Kolom "jikaAda" yang kosong (misalnya kolom form kustom yang sudah dihapus) tidak tampil di kartu.
    if (k.jikaAda && nilai[k.kunci] === '') nilai[k.kunci] = null;
    if (k.asli) {
      var a = rapikanTeks_(nilai_(t, b, k.asli));
      if (a) asli[k.kunci] = a;
    }
    var lg = logBaris[k.judul];
    if (lg) {
      koreksi[k.kunci] = {
        lama: angka ? angkaAtauNull_(lg.lama) : rapikanTeks_(lg.lama),
        oleh: lg.oleh,
        waktu: lg.waktu
      };
    }
  });
  var flagOleh = rapikanTeks_(nilai_(t, b, 'flagged_by'));
  var ubahOleh = rapikanTeks_(nilai_(t, b, 'updated_by'));
  var cekOleh = rapikanTeks_(nilai_(t, b, 'checked_by'));
  // Foto bukti: semua role melihat tandanya; tautan Drive hanya untuk Pengelola, karena
  // Staff tidak punya akses ke folder Drive (sistem Bagian 7.3 dan 9.1).
  var fotoUrl = def.foto ? rapikanTeks_(nilai_(t, b, def.foto)) : '';
  var tautanFoto = fotoUrl && /^https:\/\//.test(fotoUrl) && PENGGUNA_AKSI_ && PENGGUNA_AKSI_.pengelola ? fotoUrl : undefined;
  return {
    rowId: rowId,
    foto: def.foto ? !!fotoUrl : undefined,
    fotoUrl: tautanFoto,
    nilai: nilai,
    asli: asli,
    koreksi: koreksi,
    satuan: def.satuan ? rapikanTeks_(nilai_(t, b, def.satuan)) : '',
    status: rapikanTeks_(nilai_(t, b, 'status')) || STATUS_TERKIRIM,
    diperiksa: cekOleh ? { oleh: cekOleh, waktu: isoAtauNull_(nilai_(t, b, 'checked_at')) } : null,
    flag: flagOleh ? { oleh: flagOleh, catatan: rapikanTeks_(nilai_(t, b, 'flag_note')) } : null,
    dikoreksi: ubahOleh ? { oleh: ubahOleh, waktu: isoAtauNull_(nilai_(t, b, 'updated_at')) } : null
  };
}

/**
 * Baris dikelompokkan per kiriman (submission_id). Status kiriman Diperiksa
 * jika semua barisnya Diperiksa (pemeriksaan selalu per kiriman).
 */
function susunKiriman_(def, t, daftar, log, zona) {
  var peta = {};
  var urut = [];
  daftar.forEach(function (b) {
    var sid = String(nilai_(t, b, 'submission_id') || '');
    var k = peta[sid];
    if (!k) {
      k = peta[sid] = {
        id: sid,
        tanggal: teksTanggal_(nilai_(t, b, 'Tanggal'), zona),
        oleh: rapikanTeks_(nilai_(t, b, 'submitted_by')),
        waktu: isoAtauNull_(nilai_(t, b, 'timestamp_server')),
        waktuPerangkat: isoAtauNull_(nilai_(t, b, 'timestamp_device')),
        kepala: {},
        baris: []
      };
      urut.push(k);
    }
    (def.kepala || []).forEach(function (kp) {
      var v = rapikanTeks_(nilai_(t, b, kp.judul));
      var ada = k.kepala[kp.kunci];
      if (!ada) k.kepala[kp.kunci] = v;
      else if (v && (', ' + ada + ', ').indexOf(', ' + v + ', ') < 0) k.kepala[kp.kunci] = ada + ', ' + v;
    });
    k.baris.push(barisRiwayat_(def, t, b, log));
  });
  urut.forEach(function (k) {
    var semua = k.baris.every(function (b) { return b.status === STATUS_DIPERIKSA; });
    k.status = semua ? STATUS_DIPERIKSA : STATUS_TERKIRIM;
    k.diperiksa = null;
    if (semua) {
      k.baris.forEach(function (b) {
        if (b.diperiksa && (!k.diperiksa || String(b.diperiksa.waktu) > String(k.diperiksa.waktu))) k.diperiksa = b.diperiksa;
      });
    }
    k.jumlahBaris = k.baris.length;
    k.dilaporkan = k.baris.filter(function (b) { return b.flag; }).length;
    k.dikoreksi = k.baris.filter(function (b) { return b.dikoreksi; }).length;
  });
  if (def.rincian) def.rincian(urut);
  return urut;
}

function cocokStatus_(k, status) {
  if (status === 'terkirim') return k.status === STATUS_TERKIRIM;
  if (status === 'diperiksa') return k.status === STATUS_DIPERIKSA;
  if (status === 'dilaporkan') return k.dilaporkan > 0;
  if (status === 'dikoreksi') return k.dikoreksi > 0;
  return true;
}

function urutTerbaru_(a, b) {
  if (a.tanggal !== b.tanggal) return a.tanggal < b.tanggal ? 1 : -1;
  return String(b.waktu || '').localeCompare(String(a.waktu || ''));
}

/** Kiriman pada rentang tanggal, menurut filter kategori, item, pengisi, dan status. */
function kirimanRiwayat_(def, r, f) {
  var t = bacaTabel_(def.tab);
  if (!t) return [];
  var zona = zonaSheet_();
  var master = f.kategori && def.kategoriDariItem ? bacaItem_() : null;
  var pilih = t.baris.filter(function (b) {
    var tg = teksTanggal_(nilai_(t, b, 'Tanggal'), zona);
    if (!tg || tg < r.dari || tg > r.sampai) return false;
    if (!String(nilai_(t, b, 'submission_id') || '')) return false;
    if (f.kategori && def.kategori && rapikanTeks_(nilai_(t, b, def.kategori)).toLowerCase() !== f.kategori) return false;
    if (master) {
      var m = master[rapikanTeks_(nilai_(t, b, def.item)).toLowerCase()];
      if (!m || m.kategori.toLowerCase() !== f.kategori) return false;
    }
    if (f.item && def.item && rapikanTeks_(nilai_(t, b, def.item)).toLowerCase() !== f.item) return false;
    if (f.pengisi && rapikanTeks_(nilai_(t, b, 'submitted_by')).toLowerCase() !== f.pengisi) return false;
    return true;
  });
  return susunKiriman_(def, t, pilih, bacaLogKoreksi_(def.tab), zona).filter(function (k) {
    return cocokStatus_(k, f.status);
  }).sort(urutTerbaru_);
}

/** Satu kiriman lengkap (semua barisnya), atau null. */
function kirimanSatu_(def, sid) {
  var t = bacaTabel_(def.tab);
  if (!t || !sid) return null;
  var pilih = t.baris.filter(function (b) { return String(nilai_(t, b, 'submission_id') || '') === sid; });
  if (!pilih.length) return null;
  return susunKiriman_(def, t, pilih, bacaLogKoreksi_(def.tab), zonaSheet_())[0];
}

/**
 * Tanda nihil, penyesuaian stock, dan stock opname pada rentang tanggal
 * (Bagian 6.1: tampil pada tanggalnya). Penyesuaian dan opname hanya untuk
 * Riwayat Stock.
 */
function peristiwaRiwayat_(form, def, r, f) {
  var zona = zonaSheet_();
  var hasil = [];
  function dalam(t, b) {
    var tg = teksTanggal_(nilai_(t, b, 'Tanggal'), zona);
    if (!tg || tg < r.dari || tg > r.sampai) return '';
    if (f.pengisi && rapikanTeks_(nilai_(t, b, 'submitted_by')).toLowerCase() !== f.pengisi) return '';
    return tg;
  }
  function saringItem(t, b) {
    if (f.kategori && rapikanTeks_(nilai_(t, b, 'Kategori')).toLowerCase() !== f.kategori) return false;
    if (f.item && rapikanTeks_(nilai_(t, b, 'Nama Item')).toLowerCase() !== f.item) return false;
    return true;
  }

  var nihil = bacaTabel_('Data_Nihil');
  if (nihil) {
    nihil.baris.forEach(function (b) {
      var tg = dalam(nihil, b);
      if (!tg || rapikanTeks_(nilai_(nihil, b, 'ID Form')).toUpperCase() !== form.id) return;
      hasil.push({
        jenis: 'nihil',
        tanggal: tg,
        oleh: rapikanTeks_(nilai_(nihil, b, 'submitted_by')),
        waktu: isoAtauNull_(nilai_(nihil, b, 'timestamp_server'))
      });
    });
  }
  if (def.terlewat && !f.pengisi) hasil = hasil.concat(suhuTerlewat_(r, f));
  if (!def.stock) return hasil.sort(urutTerbaru_);

  var sesuai = bacaTabel_('Data_Penyesuaian');
  if (sesuai) {
    sesuai.baris.forEach(function (b) {
      var tg = dalam(sesuai, b);
      if (!tg || !saringItem(sesuai, b)) return;
      // Penyesuaian dari stock opname tampil lewat peristiwa opname-nya (Tahap 8).
      if (rapikanTeks_(nilai_(sesuai, b, 'Alasan')) === ALASAN_OPNAME) return;
      hasil.push({
        jenis: 'penyesuaian',
        tanggal: tg,
        oleh: rapikanTeks_(nilai_(sesuai, b, 'submitted_by')),
        waktu: isoAtauNull_(nilai_(sesuai, b, 'timestamp_server')),
        item: rapikanTeks_(nilai_(sesuai, b, 'Nama Item')),
        kategori: rapikanTeks_(nilai_(sesuai, b, 'Kategori')),
        satuan: rapikanTeks_(nilai_(sesuai, b, 'Satuan')),
        tercatat: angkaAtauNull_(nilai_(sesuai, b, 'Stock Tercatat')),
        sebenarnya: angkaAtauNull_(nilai_(sesuai, b, 'Stock Sebenarnya')),
        selisih: angkaAtauNull_(nilai_(sesuai, b, 'Selisih')),
        alasan: rapikanTeks_(nilai_(sesuai, b, 'Alasan')),
        catatan: rapikanTeks_(nilai_(sesuai, b, 'Catatan'))
      });
    });
  }

  var opname = bacaTabel_('Data_Opname');
  if (opname) {
    var peta = {};
    opname.baris.forEach(function (b) {
      var tg = dalam(opname, b);
      if (!tg || !saringItem(opname, b)) return;
      var sid = String(nilai_(opname, b, 'submission_id') || '') || tg;
      var o = peta[sid];
      if (!o) {
        o = peta[sid] = {
          jenis: 'opname',
          id: String(nilai_(opname, b, 'submission_id') || ''),
          tanggal: tg,
          oleh: rapikanTeks_(nilai_(opname, b, 'submitted_by')),
          waktu: isoAtauNull_(nilai_(opname, b, 'timestamp_server')),
          jumlahItem: 0,
          berselisih: 0,
          nilai: 0
        };
        hasil.push(o);
      }
      o.jumlahItem++;
      if (Number(nilai_(opname, b, 'Selisih'))) o.berselisih++;
      o.nilai += Number(nilai_(opname, b, 'Nilai Selisih (Rp)')) || 0;
    });
  }
  return hasil.sort(urutTerbaru_);
}

/**
 * Pengecekan suhu yang tidak diisi (Bagian 6.1: waktu cek yang tidak diisi
 * diberi tanda), per tanggal sebelum hari ini: unit aktif × Opening, Middle,
 * Closing yang tidak punya isian. Dimulai dari tanggal isian Suhu pertama,
 * supaya hari sebelum form Suhu dipakai tidak dianggap terlewat.
 * f.item: hanya unit itu.
 */
function suhuTerlewat_(r, f) {
  var t = bacaTabel_('Data_Suhu');
  if (!t) return [];
  var zona = zonaSheet_();
  var pertama = '';
  var ada = {};
  t.baris.forEach(function (b) {
    var tg = teksTanggal_(nilai_(t, b, 'Tanggal'), zona);
    if (!tg) return;
    if (!pertama || tg < pertama) pertama = tg;
    ada[tg + '|' + rapikanTeks_(nilai_(t, b, 'Nama Unit')).toLowerCase() + '|' +
      rapikanTeks_(nilai_(t, b, 'Waktu Cek')).toLowerCase()] = true;
  });
  if (!pertama) return [];
  var unit = bacaUnit_().filter(function (u) { return u.aktif && (!f.item || u.nama.toLowerCase() === f.item); });
  var hari = hariIni_();
  var hasil = [];
  for (var tg = r.dari < pertama ? pertama : r.dari; tg <= r.sampai && tg < hari; tg = geserTanggal_(tg, 1)) {
    if (liburPada_(tg)) continue; // hari libur: tidak ada pengecekan yang terlewat (Code.gs v0.30)
    var kurang = [];
    unit.forEach(function (u) {
      ['Opening', 'Middle', 'Closing'].forEach(function (w) {
        if (!ada[tg + '|' + u.nama.toLowerCase() + '|' + w.toLowerCase()]) kurang.push(u.nama + ' ' + w);
      });
    });
    if (kurang.length) {
      hasil.push({ jenis: 'terlewat', tanggal: tg, oleh: '', waktu: null, kurang: kurang, total: unit.length * 3 });
    }
  }
  return hasil;
}

/**
 * Stock Masuk yang diketik dalam satuan besar, per item per hari:
 * { 'namakecil|yyyy-mm-dd': '2 dus + 3 botol' }. Hari yang semua masuknya
 * dalam satuan dasar tidak dicatat.
 */
function masukAsliPerHari_(dari, sampai) {
  var t = bacaTabel_('Data_Stock');
  var hasil = {};
  if (!t) return hasil;
  var zona = zonaSheet_();
  var kumpul = {};
  t.baris.forEach(function (b) {
    var tg = teksTanggal_(nilai_(t, b, 'Tanggal'), zona);
    var masuk = Number(nilai_(t, b, 'Stock Masuk')) || 0;
    if (!tg || tg < dari || tg > sampai || !masuk) return;
    var kunci = rapikanTeks_(nilai_(t, b, 'Nama Item')).toLowerCase() + '|' + tg;
    var e = kumpul[kunci] = kumpul[kunci] || { bagian: [], besar: false };
    var diketik = rapikanTeks_(nilai_(t, b, 'Masuk Diketik'));
    if (diketik) e.besar = true;
    e.bagian.push(diketik || (teksAngka_(masuk) + ' ' + rapikanTeks_(nilai_(t, b, 'Satuan'))));
  });
  Object.keys(kumpul).forEach(function (k) {
    if (kumpul[k].besar) hasil[k] = kumpul[k].bagian.join(' + ');
  });
  return hasil;
}

function barisRekap_(r, master, asli) {
  var m = master[r.nama.toLowerCase()] || {};
  var hasil = {
    tanggal: r.tanggal,
    kategori: r.kategori || m.kategori || '',
    item: r.nama,
    satuan: r.satuan || m.satuan || '',
    stokMin: m.stokMin == null ? null : m.stokMin,
    masukAsli: asli[r.nama.toLowerCase() + '|' + r.tanggal] || null
  };
  Object.keys(KOLOM_REKAP).forEach(function (k) { hasil[k] = r[k]; });
  return hasil;
}

/** Rekap harian dari Stock_Harian (Bagian 6.1): satu baris per item per hari. */
function rekapRiwayat_(r, f) {
  var rekap = bacaRekap_();
  var master = bacaItem_();
  var urutKat = {};
  bacaKategori_().forEach(function (k, i) { urutKat[k.nama.toLowerCase()] = i; });
  var asli = masukAsliPerHari_(r.dari, r.sampai);
  var hasil = [];
  Object.keys(rekap.item).forEach(function (k) {
    if (f.item && k !== f.item) return;
    rekap.item[k].forEach(function (x) {
      if (x.tanggal < r.dari || x.tanggal > r.sampai) return;
      var baris = barisRekap_(x, master, asli);
      if (f.kategori && baris.kategori.toLowerCase() !== f.kategori) return;
      hasil.push(baris);
    });
  });
  return hasil.sort(function (a, b) {
    if (a.tanggal !== b.tanggal) return a.tanggal < b.tanggal ? 1 : -1;
    var ka = urutKat[a.kategori.toLowerCase()];
    var kb = urutKat[b.kategori.toLowerCase()];
    ka = ka == null ? 1e9 : ka;
    kb = kb == null ? 1e9 : kb;
    return ka - kb || a.kategori.localeCompare(b.kategori, 'id') || a.item.localeCompare(b.item, 'id');
  });
}

/** Pilihan untuk lembar Filter: kategori, item, dan nama pengisi. */
function pilihanFilter_(def) {
  var hasil = { kategori: [], item: [], pengisi: [], labelItem: 'Item' };
  if (def && (def.kategori || def.kategoriDariItem)) hasil.kategori = bacaKategori_().map(function (k) { return k.nama; });
  if (def && def.itemDariUnit) {
    hasil.labelItem = 'Unit';
    hasil.item = bacaUnit_().map(function (u) { return { nama: u.nama, kategori: '' }; });
  } else if (def && def.item) {
    var master = bacaItem_();
    hasil.item = Object.keys(master).map(function (k) {
      return { nama: master[k].nama, kategori: master[k].kategori };
    }).sort(function (a, b) { return a.nama.localeCompare(b.nama, 'id'); });
  }
  // Termasuk staff yang sudah dihapus: isian lamanya tetap ada di Riwayat.
  var sudah = {};
  hasil.pengisi = bacaStaff_(true).daftar.map(function (s) { return s.nama; }).filter(function (n) {
    if (sudah[n.toLowerCase()]) return false;
    sudah[n.toLowerCase()] = true;
    return true;
  }).sort(function (a, b) {
    return a.localeCompare(b, 'id');
  });
  return hasil;
}

/**
 * Riwayat satu form (Bagian 6.1). tampilan: catatan (kiriman, tanda nihil,
 * penyesuaian, opname) atau rekap (Stock_Harian, khusus Stock).
 */
function aksiRiwayat_(body) {
  // Form yang disembunyikan tetap ada di Riwayat: isian lamanya masih bisa dilihat (Tahap 9).
  var daftar = bacaDaftarForm_();
  var idForm = rapikanTeks_(body.formId).toUpperCase();
  var form = null;
  daftar.forEach(function (f) { if (f.id === idForm) form = f; });
  if (!form) {
    daftar.forEach(function (f) { if (!form && defRiwayat_(f.id)) form = f; });
  }
  if (!form) form = daftar[0] || null;
  var r = rentangRiwayat_(body);
  var f = filterRiwayat_(body);
  var def = form ? defRiwayat_(form.id) : null;
  var hasil = {
    formId: form ? form.id : '',
    dari: r.dari,
    sampai: r.sampai,
    tampilan: 'catatan',
    daftarForm: daftar.map(function (x) {
      var d = defRiwayat_(x.id);
      return { id: x.id, nama: x.nama, adaRiwayat: !!d, stock: !!(d || {}).stock, adaPdf: !!laporanPdf_(x.id), tampil: x.aktif };
    }),
    kepala: [],
    kolom: [],
    kiriman: [],
    peristiwa: [],
    rekap: null,
    pilihan: pilihanFilter_(def),
    // Aplikasi menampilkan "Tandai diperiksa (n)" per tanggal hanya jika server mengenal tandaiDiperiksaBanyak (v0.27).
    periksaBanyak: true
  };
  if (!def) return hasil;
  hasil.kepala = infoKepala_(def);
  hasil.kolom = infoKolom_(def);
  hasil.gerakStock = !!def.gerakStock;
  if (body.tampilan === 'rekap' && def.stock) {
    hasil.tampilan = 'rekap';
    hasil.rekap = rekapRiwayat_(r, f);
    return hasil;
  }
  hasil.kiriman = kirimanRiwayat_(def, r, f);
  hasil.peristiwa = f.status ? [] : peristiwaRiwayat_(form, def, r, f);
  return hasil;
}

/** Kolom untuk frontend: yang tampil, jenisnya, dan yang boleh dikoreksi. */
function infoKolom_(def) {
  return def.kolom.map(function (k) {
    var info = { kunci: k.kunci, label: k.label, singkat: k.singkat || k.label.toLowerCase(), jenis: k.jenis,
      koreksi: !!k.koreksi, satuan: !!k.satuan };
    if (k.minus) info.minus = true;
    if (k.akhiran) info.akhiran = k.akhiran;
    if (k.pilihan) info.pilihan = k.pilihan;
    if (k.ringkas === false) info.ringkas = false;
    if (k.jikaAda) info.jikaAda = true;
    if (k.jikaKolom) info.jikaKolom = k.jikaKolom;
    if (k.jikaPositif) info.jikaPositif = k.jikaPositif;
    if (k.bantuan) info.bantuan = k.bantuan;
    if (k.opsional) info.opsional = true;
    if (k.waktu) info.waktu = true;
    return info;
  });
}

function infoKepala_(def) {
  return (def.kepala || []).map(function (k) { return { kunci: k.kunci, label: k.label }; });
}

/** Satu kiriman lengkap untuk layar detail, beserta susunan kolomnya. */
function aksiDetailKiriman_(body) {
  var idForm = rapikanTeks_(body.formId).toUpperCase();
  var def = wajibDefRiwayat_(idForm);
  var k = kirimanSatu_(def, String(body.submissionId || ''));
  if (!k) throw galatPengguna_('Isian tidak ditemukan. Kembali ke Riwayat, lalu muat ulang.');
  var nama = idForm;
  bacaDaftarForm_().forEach(function (f) { if (f.id === idForm) nama = f.nama; });
  return { formId: idForm, namaForm: nama, adaPdf: !!laporanPdf_(idForm), kepala: infoKepala_(def), kolom: infoKolom_(def),
    gerakStock: !!def.gerakStock, kiriman: k };
}

/**
 * Riwayat per item (Bagian 6.1): 7 rekap terakhir sampai hari ini, terbaru
 * di atas, dan stock tercatat hari ini (untuk Sesuaikan stock).
 */
function dataRiwayatItem_(namaItem) {
  var kecil = rapikanTeks_(namaItem).toLowerCase();
  var master = bacaItem_();
  var m = master[kecil];
  if (!m) throw galatPengguna_('Item tidak ada di daftar item. Muat ulang Riwayat.');
  var hari = hariIni_();
  var semua = bacaRekap_().item[kecil] || [];
  var tujuh = semua.filter(function (r) { return r.tanggal <= hari; }).sort(function (a, b) {
    return a.tanggal < b.tanggal ? 1 : (a.tanggal > b.tanggal ? -1 : 0);
  }).slice(0, 7);
  var asli = tujuh.length ? masukAsliPerHari_(tujuh[tujuh.length - 1].tanggal, tujuh[0].tanggal) : {};
  return {
    item: {
      nama: m.nama, kategori: m.kategori, satuan: m.satuan, satuanBesar: m.satuanBesar,
      isiSatuanBesar: m.isiSatuanBesar, stokMin: m.stokMin, aktif: m.aktif
    },
    hariIni: hari,
    tercatat: posisiStock_(semua, hari).akhir,
    rekap: tujuh.map(function (r) { return barisRekap_(r, master, asli); }),
    transaksi: transaksiItem_(kecil, tujuh)
  };
}

/**
 * Kartu stok: setiap catatan yang menggerakkan stock satu item pada tanggal
 * rekapnya (sumber SUMBER_STOCK), urut tanggal lalu waktu diterima server,
 * dengan saldo sesudah tiap transaksi (mulai dari Stock Awal rekap hari itu).
 * Baris yang tidak menggerakkan stock (angka nol, prep tanpa resep) dilewati.
 * Hasil: [{ tanggal, waktu, jenis, formId, submissionId, rowId, oleh, dikoreksi,
 * masuk, keluar, saldo, ket }]. formId hanya untuk kiriman yang punya detail di
 * Riwayat (Stock, Prep, Waste); penyesuaian dan stock opname tidak.
 */
function transaksiItem_(kecil, rekap) {
  var awal = {};
  rekap.forEach(function (r) { awal[r.tanggal] = r.awal; });
  var zona = zonaSheet_();
  var daftar = [];
  var urut = 0;
  SUMBER_STOCK.forEach(function (s) {
    var t = bacaTabel_(s.tab);
    if (!t || t.kol[s.item] === undefined || t.kol.Tanggal === undefined) return;
    t.baris.forEach(function (b) {
      if (rapikanTeks_(nilai_(t, b, s.item)).toLowerCase() !== kecil) return;
      var tanggal = teksTanggal_(nilai_(t, b, 'Tanggal'), zona);
      if (!tanggal || !(tanggal in awal)) return;
      var angka = function (judul) { return Number(nilai_(t, b, judul)) || 0; };
      var x = { masuk: 0, keluar: 0, formId: null, ket: '' };
      if (s.tab === 'Data_Stock') {
        x.jenis = 'Stock';
        x.formId = 'STOCK';
        x.masuk = angka('Stock Masuk');
        x.keluar = angka('Stock Keluar');
        var diketik = rapikanTeks_(nilai_(t, b, 'Masuk Diketik'));
        var dari = rapikanTeks_(nilai_(t, b, 'Pemasok'));
        var beli = x.masuk ? angkaAtauNull_(nilai_(t, b, 'Harga Beli (Rp)')) : null;
        var baik = x.masuk ? teksTanggal_(nilai_(t, b, 'Baik Sampai'), zona) : '';
        var sisaH = angkaAtauNull_(nilai_(t, b, 'Sisa Dihitung'));
        x.ket = [diketik ? 'Masuk diketik ' + diketik : '', dari ? 'Dari ' + dari : '',
          beli != null ? 'Harga beli ' + rupiahId_(beli) + '/' + rapikanTeks_(nilai_(t, b, 'Satuan')) : '',
          baik ? 'Baik sampai ' + tanggalPendekId_(baik) : '',
          sisaH != null ? 'Keluar dihitung dari sisa ' + teksAngka_(sisaH) + ' ' + rapikanTeks_(nilai_(t, b, 'Satuan')) : '']
          .filter(Boolean).join(' · ');
      } else if (s.tab === 'Data_Prep') {
        x.jenis = 'Hasil prep';
        x.formId = 'PREP';
        x.masuk = angka('Hasil');
        var standar = bulat_(angka('Jumlah Resep') * angka('Hasil per 1 Resep'));
        var adaAktual = angkaAtauNull_(nilai_(t, b, 'Hasil Aktual')) != null;
        x.ket = [angka('Jumlah Resep') ? teksAngka_(angka('Jumlah Resep')) + ' resep' : '',
          adaAktual ? 'hasil aktual (standar ' + teksAngka_(standar) + ' ' + rapikanTeks_(nilai_(t, b, 'Satuan')) + ')' : '',
          rapikanTeks_(nilai_(t, b, 'Shift')) ? 'Shift ' + rapikanTeks_(nilai_(t, b, 'Shift')) : '']
          .filter(Boolean).join(' · ');
      } else if (s.tab === 'Data_PrepBahan') {
        x.jenis = 'Dipakai prep';
        x.formId = 'PREP';
        x.keluar = angka('Qty Terpakai');
        var hasil = rapikanTeks_(nilai_(t, b, 'Item Hasil'));
        if (hasil) x.ket = 'Untuk ' + hasil + (angka('Jumlah Resep') ? ' (' + teksAngka_(angka('Jumlah Resep')) + ' resep)' : '');
      } else if (s.tab === 'Data_Waste') {
        x.jenis = 'Waste';
        x.formId = 'WASTE';
        x.keluar = angka('Qty');
        x.ket = [rapikanTeks_(nilai_(t, b, 'Kategori Waste')), rapikanTeks_(nilai_(t, b, 'Alasan / Keterangan'))]
          .filter(Boolean).join(': ');
      } else {
        var alasan = rapikanTeks_(nilai_(t, b, 'Alasan'));
        var selisih = angka('Selisih');
        x.jenis = alasan === ALASAN_OPNAME ? 'Stock opname' : 'Penyesuaian';
        if (selisih > 0) x.masuk = selisih;
        else x.keluar = -selisih;
        x.ket = alasan === ALASAN_OPNAME ? '' : [alasan, rapikanTeks_(nilai_(t, b, 'Catatan'))].filter(Boolean).join(': ');
      }
      if (!x.masuk && !x.keluar) return;
      var w = nilai_(t, b, 'timestamp_server');
      x.tanggal = tanggal;
      x.ms = w instanceof Date && !isNaN(w.getTime()) ? w.getTime() : 0;
      x.waktu = isoAtauNull_(w);
      x.submissionId = String(nilai_(t, b, 'submission_id') || '');
      x.rowId = String(nilai_(t, b, 'row_id') || '');
      x.oleh = rapikanTeks_(nilai_(t, b, 'submitted_by'));
      x.dikoreksi = !!rapikanTeks_(nilai_(t, b, 'updated_by'));
      x.urut = urut++;
      daftar.push(x);
    });
  });
  daftar.sort(function (a, b) {
    if (a.tanggal !== b.tanggal) return a.tanggal < b.tanggal ? -1 : 1;
    return a.ms - b.ms || a.urut - b.urut;
  });
  var saldo = null;
  var hariIni = '';
  return daftar.map(function (x) {
    if (x.tanggal !== hariIni) {
      hariIni = x.tanggal;
      saldo = awal[x.tanggal];
    }
    saldo = bulat_(saldo + x.masuk - x.keluar);
    return {
      tanggal: x.tanggal, waktu: x.waktu, jenis: x.jenis, formId: x.formId,
      submissionId: x.formId ? x.submissionId : '', rowId: x.rowId, oleh: x.oleh, dikoreksi: x.dikoreksi,
      masuk: bulat_(x.masuk), keluar: bulat_(x.keluar), saldo: saldo, ket: x.ket
    };
  });
}

function aksiRiwayatItem_(body) {
  return dataRiwayatItem_(body.item);
}

/** Baris tab Data menurut row_id: { t, b, nomor } (nomor baris di Sheet). */
function cariBarisRiwayat_(def, rowId) {
  var id = String(rowId || '');
  var t = wajibTabel_(def.tab);
  var i = t.kol.row_id;
  if (id && i !== undefined) {
    for (var n = 0; n < t.baris.length; n++) {
      if (String(t.baris[n][i]) === id) return { t: t, b: t.baris[n], nomor: n + 2 };
    }
  }
  throw galatPengguna_('Baris tidak ditemukan. Kembali ke Riwayat, lalu muat ulang.');
}

/** Menulis beberapa sel satu baris: { judul: nilai }. Teks yang bisa menjadi rumus diberi kutip. */
function tulisSel_(c, ubah) {
  Object.keys(ubah).forEach(function (judul) {
    var i = c.t.kol[judul];
    if (i === undefined) {
      throw galatPengguna_('Kolom ' + judul + ' tidak ada di tab ' + c.t.nama +
        '. Jalankan ulang setupSpreadsheet di editor Apps Script.');
    }
    var v = ubah[judul];
    c.t.sheet.getRange(c.nomor, i + 1).setValue(typeof v === 'string' ? teksAman_(v) : v);
    c.b[i] = v;
  });
}

/** Baris satu kiriman: [{ t, b, nomor }]. */
function barisKiriman_(def, sid) {
  var t = wajibTabel_(def.tab);
  var i = t.kol.submission_id;
  var hasil = [];
  if (sid && i !== undefined) {
    t.baris.forEach(function (b, n) {
      if (String(b[i]) === sid) hasil.push({ t: t, b: b, nomor: n + 2 });
    });
  }
  if (!hasil.length) throw galatPengguna_('Isian tidak ditemukan. Kembali ke Riwayat, lalu muat ulang.');
  return hasil;
}

/**
 * Laporkan kekeliruan (Bagian 6.3), semua role: baris mendapat tanda
 * dilaporkan keliru. Laporan berikutnya pada baris yang sama ditambahkan.
 */
function aksiLaporkanKeliru_(body, pengguna) {
  var def = wajibDefRiwayat_(body.formId);
  var catatan = rapikanTeks_(body.catatan).slice(0, 200);
  if (!catatan) throw galatPengguna_('Tulis catatan singkat, misalnya "Stock Masuk seharusnya 5, bukan 50."');
  return denganKunci_(function () {
    var c = cariBarisRiwayat_(def, body.rowId);
    var olehLama = rapikanTeks_(nilai_(c.t, c.b, 'flagged_by'));
    var catatanLama = rapikanTeks_(nilai_(c.t, c.b, 'flag_note'));
    var oleh = olehLama ? olehLama.split(/\s*,\s*/) : [];
    if (!oleh.some(function (n) { return samaNama_(n, pengguna.nama); })) oleh.push(pengguna.nama);
    tulisSel_(c, {
      flagged_by: oleh.join(', '),
      flag_note: catatanLama ? catatanLama + ' / ' + pengguna.nama + ': ' + catatan : catatan
    });
    return { kiriman: kirimanSatu_(def, String(nilai_(c.t, c.b, 'submission_id'))) };
  });
}

/**
 * Tandai diperiksa (Bagian 6.2), khusus Pengelola: semua baris satu kiriman
 * berstatus Diperiksa dan terkunci. Ditolak jika ada baris yang dilaporkan
 * keliru dan belum ditangani.
 */
function aksiTandaiDiperiksa_(body, pengguna) {
  var def = wajibDefRiwayat_(body.formId);
  var sid = String(body.submissionId || '');
  return denganKunci_(function () {
    var daftar = barisKiriman_(def, sid);
    if (daftar.some(function (c) { return rapikanTeks_(nilai_(c.t, c.b, 'flagged_by')); })) {
      throw galatPengguna_('Ada baris yang dilaporkan keliru. Koreksi barisnya atau tutup laporannya dulu.');
    }
    var kini = new Date();
    daftar.forEach(function (c) {
      if (rapikanTeks_(nilai_(c.t, c.b, 'status')) === STATUS_DIPERIKSA) return;
      tulisSel_(c, { status: STATUS_DIPERIKSA, checked_by: pengguna.nama, checked_at: kini });
    });
    return { kiriman: kirimanSatu_(def, sid) };
  });
}

/** Paling banyak kiriman sekali Tandai diperiksa sekaligus (satu tanggal di Riwayat jauh di bawahnya). */
var BATAS_PERIKSA_BANYAK = 300;

/**
 * Tandai diperiksa sekaligus (19 Oktober 2026, Bagian 6.2), khusus Pengelola: kiriman yang tampil pada satu tanggal di
 * Riwayat ditandai Diperiksa dengan aturan yang sama dengan Tandai diperiksa satu per satu. Kiriman yang masih punya baris
 * dilaporkan keliru, atau yang sudah tidak ada, dilewati tanpa menggagalkan yang lain; yang sudah Diperiksa tidak ditulis lagi.
 * body.submissionId: [id]. Jawaban { diperiksa, sudah, dilewati: [{ id, sebab: dilaporkan|tidakAda }], kiriman: [lengkap] }.
 */
function aksiTandaiDiperiksaBanyak_(body, pengguna) {
  var def = wajibDefRiwayat_(body.formId);
  var sid = [];
  var ada = {};
  (Array.isArray(body.submissionId) ? body.submissionId : []).forEach(function (x) {
    var s = String(x == null ? '' : x);
    if (s && !Object.prototype.hasOwnProperty.call(ada, s)) {
      ada[s] = true;
      sid.push(s);
    }
  });
  if (!sid.length) throw galatPengguna_('Tidak ada isian yang dipilih. Muat ulang Riwayat.');
  if (sid.length > BATAS_PERIKSA_BANYAK) throw galatPengguna_('Terlalu banyak isian sekaligus. Tandai per tanggal.');
  return denganKunci_(function () {
    var t = wajibTabel_(def.tab);
    var i = t.kol.submission_id;
    var per = {};
    sid.forEach(function (s) { per[s] = []; });
    if (i !== undefined) {
      t.baris.forEach(function (b, n) {
        var s = String(b[i]);
        if (Object.prototype.hasOwnProperty.call(per, s)) per[s].push({ t: t, b: b, nomor: n + 2 });
      });
    }
    var kini = new Date();
    var hasil = { diperiksa: 0, sudah: 0, dilewati: [], kiriman: [] };
    var terpakai = [];
    sid.forEach(function (s) {
      var daftar = per[s];
      if (!daftar.length) {
        hasil.dilewati.push({ id: s, sebab: 'tidakAda' });
        return;
      }
      daftar.forEach(function (c) { terpakai.push(c.b); });
      if (daftar.some(function (c) { return rapikanTeks_(nilai_(c.t, c.b, 'flagged_by')); })) {
        hasil.dilewati.push({ id: s, sebab: 'dilaporkan' });
        return;
      }
      var ditulis = false;
      daftar.forEach(function (c) {
        if (rapikanTeks_(nilai_(c.t, c.b, 'status')) === STATUS_DIPERIKSA) return;
        tulisSel_(c, { status: STATUS_DIPERIKSA, checked_by: pengguna.nama, checked_at: kini });
        ditulis = true;
      });
      if (ditulis) hasil.diperiksa++;
      else hasil.sudah++;
    });
    if (terpakai.length) hasil.kiriman = susunKiriman_(def, t, terpakai, bacaLogKoreksi_(def.tab), zonaSheet_());
    return hasil;
  });
}

/** Buka kunci (Bagian 6.3), khusus Pengelola: status kembali Terkirim; tercatat di Log_Perubahan. */
function aksiBukaKunci_(body, pengguna) {
  var def = wajibDefRiwayat_(body.formId);
  var sid = String(body.submissionId || '');
  return denganKunci_(function () {
    var kini = new Date();
    barisKiriman_(def, sid).forEach(function (c) {
      if (rapikanTeks_(nilai_(c.t, c.b, 'status')) !== STATUS_DIPERIKSA) return;
      var lama = STATUS_DIPERIKSA + ' (' + rapikanTeks_(nilai_(c.t, c.b, 'checked_by')) + ')';
      tulisSel_(c, { status: STATUS_TERKIRIM, checked_by: '', checked_at: '' });
      catatLog_(def.tab, String(nilai_(c.t, c.b, 'row_id')), pengguna, kini, [['status', lama, STATUS_TERKIRIM]]);
    });
    return { kiriman: kirimanSatu_(def, sid) };
  });
}

/**
 * Koreksi satu baris (Bagian 6.3), khusus Pengelola. Yang dikoreksi adalah
 * catatan sumbernya, bukan rekap. Baris yang sudah Diperiksa terkunci sampai
 * dibuka. Tiap kolom yang berubah dicatat di Log_Perubahan; tanda dilaporkan
 * keliru hilang. Untuk Stock, rekap hari itu dan sesudahnya dihitung ulang.
 * body.nilai: { kunci: angka atau teks } untuk kolom yang boleh dikoreksi.
 */
function aksiKoreksi_(body, pengguna) {
  var def = wajibDefRiwayat_(body.formId);
  var baru = body.nilai && typeof body.nilai === 'object' ? body.nilai : {};
  return denganKunci_(function () {
    var c = cariBarisRiwayat_(def, body.rowId);
    if (rapikanTeks_(nilai_(c.t, c.b, 'status')) === STATUS_DIPERIKSA) {
      throw galatPengguna_('Isian ini sudah diperiksa dan terkunci. Ketuk Buka kunci dulu untuk mengoreksi.');
    }
    var namaBaris = def.item ? rapikanTeks_(nilai_(c.t, c.b, def.item)) : '';
    var ubah = {};
    var perubahan = [];
    def.kolom.forEach(function (k) {
      if (!k.koreksi || !Object.prototype.hasOwnProperty.call(baru, k.kunci)) return;
      var lama = nilai_(c.t, c.b, k.judul);
      var nilaiBaru;
      var label = k.label + (namaBaris ? ' ' + namaBaris : '');
      if (k.ubah) {
        // Form kustom (Tahap 9): aturan isian sama dengan saat dikirim; kosong boleh untuk kolom tidak wajib.
        nilaiBaru = k.ubah(baru[k.kunci], label);
        lama = k.normal ? k.normal(lama) : lama;
        if (String(nilaiBaru) === String(lama)) return;
      } else if (k.jenis === 'angka') {
        nilaiBaru = k.minus ? angkaSuhu_(baru[k.kunci], label) : angkaIsian_(baru[k.kunci], label);
        lama = Number(lama) || 0;
      } else {
        nilaiBaru = rapikanTeks_(baru[k.kunci]).slice(0, 200);
        lama = rapikanTeks_(lama);
        if (k.pilihan && k.pilihan.indexOf(nilaiBaru) < 0) throw galatPengguna_('Pilih ' + k.label.toLowerCase() + '.');
      }
      if (nilaiBaru === lama) return;
      // Kolom tanggal (baik sampai): log berisi yyyy-mm-dd, sel berisi tanggal.
      ubah[k.judul] = k.jenis === 'tanggal' && nilaiBaru ? tanggalSel_(nilaiBaru) : nilaiBaru;
      perubahan.push([k.judul, lama, nilaiBaru]);
      if (k.asli) {
        var asli = rapikanTeks_(nilai_(c.t, c.b, k.asli));
        if (asli) {
          ubah[k.asli] = '';
          perubahan.push([k.asli, asli, '']);
        }
      }
    });
    if (!perubahan.length) throw galatPengguna_('Tidak ada yang berubah.');
    // Kolom turunan (estimasi kerugian, status suhu) dan pemeriksaan hasil koreksi (Tahap 5).
    var gabungan = {};
    c.t.judul.forEach(function (j, i) { if (j) gabungan[j] = c.b[i]; });
    var sebelum = gabung_({}, gabungan);
    Object.keys(ubah).forEach(function (j) { gabungan[j] = ubah[j]; });
    if (def.turunan) {
      var turun = def.turunan(gabungan, sebelum);
      Object.keys(turun).forEach(function (j) {
        var lamaT = nilai_(c.t, c.b, j);
        gabungan[j] = turun[j];
        if (String(lamaT) === String(turun[j])) return;
        ubah[j] = turun[j];
        perubahan.push([j, lamaT, turun[j]]);
      });
    }
    if (def.periksaKoreksi) def.periksaKoreksi(gabungan);
    var kini = new Date();
    ubah.updated_by = pengguna.nama;
    ubah.updated_at = kini;
    if (rapikanTeks_(nilai_(c.t, c.b, 'flagged_by'))) {
      ubah.flagged_by = '';
      ubah.flag_note = '';
    }
    tulisSel_(c, ubah);
    var rowId = String(nilai_(c.t, c.b, 'row_id'));
    catatLog_(def.tab, rowId, pengguna, kini, perubahan);
    if (def.setelahKoreksi) {
      var nilai = {};
      c.t.judul.forEach(function (j, i) { if (j) nilai[j] = c.b[i]; });
      def.setelahKoreksi({
        tanggal: teksTanggal_(nilai_(c.t, c.b, 'Tanggal'), zonaSheet_()),
        nilai: nilai
      }, pengguna, kini);
    }
    return { kiriman: kirimanSatu_(def, String(nilai_(c.t, c.b, 'submission_id'))) };
  });
}

/** Tutup laporan kekeliruan tanpa koreksi (Bagian 6.3), khusus Pengelola. Tercatat di Log_Perubahan. */
function aksiTutupLaporan_(body, pengguna) {
  var def = wajibDefRiwayat_(body.formId);
  return denganKunci_(function () {
    var c = cariBarisRiwayat_(def, body.rowId);
    var oleh = rapikanTeks_(nilai_(c.t, c.b, 'flagged_by'));
    if (oleh) {
      var catatan = rapikanTeks_(nilai_(c.t, c.b, 'flag_note'));
      tulisSel_(c, { flagged_by: '', flag_note: '' });
      catatLog_(def.tab, String(nilai_(c.t, c.b, 'row_id')), pengguna, new Date(),
        [['flag_note', oleh + ': ' + catatan, '']]);
    }
    return { kiriman: kirimanSatu_(def, String(nilai_(c.t, c.b, 'submission_id'))) };
  });
}

/**
 * Untuk Beranda Pengelola (tampilan Bagian 5.2): jumlah kiriman belum
 * diperiksa dan baris dilaporkan keliru dalam 31 hari terakhir (rentang yang
 * bisa dibuka sekali di Riwayat), serta form pertama yang memilikinya.
 */
function ringkasPemeriksaan_() {
  var sampai = hariIni_();
  var dari = geserTanggal_(sampai, -(BATAS_RIWAYAT_HARI - 1));
  var hasil = { dari: dari, sampai: sampai, belumDiperiksa: 0, dilaporkan: 0, formBelum: '', formDilaporkan: '' };
  var zona = zonaSheet_();
  bacaDaftarForm_().forEach(function (f) {
    var def = f.aktif ? defRiwayat_(f.id) : null;
    var t = def ? bacaTabel_(def.tab) : null;
    if (!t) return;
    var belum = {};
    var nBelum = 0;
    var nLapor = 0;
    t.baris.forEach(function (b) {
      var tg = teksTanggal_(nilai_(t, b, 'Tanggal'), zona);
      var sid = String(nilai_(t, b, 'submission_id') || '');
      if (!tg || tg < dari || tg > sampai || !sid) return;
      if (rapikanTeks_(nilai_(t, b, 'status')) !== STATUS_DIPERIKSA && !belum[sid]) {
        belum[sid] = true;
        nBelum++;
      }
      if (rapikanTeks_(nilai_(t, b, 'flagged_by'))) nLapor++;
    });
    hasil.belumDiperiksa += nBelum;
    hasil.dilaporkan += nLapor;
    if (nBelum && !hasil.formBelum) hasil.formBelum = f.id;
    if (nLapor && !hasil.formDilaporkan) hasil.formDilaporkan = f.id;
  });
  return hasil;
}

/* =========================================================================
 * Tahap 4: laporan PDF, email harian, cadangan mingguan
 * (spesifikasi sistem Bagian 9.1, 9.4, 10; tampilan Bagian 2 dan 5.5)
 * ========================================================================= */

/** Folder induk di Drive pemilik script: Laporan Kitchen/{Outlet}/{Tahun}/{Bulan}/ dan Laporan Kitchen/Cadangan/. */
var FOLDER_LAPORAN = 'Laporan Kitchen';
var FOLDER_CADANGAN = 'Cadangan';
var JUMLAH_CADANGAN = 4;

/** Warna PDF (tampilan Bagian 2): navy menggantikan hijau form Word; amber tidak dipakai. */
var WARNA_PDF = {
  navy: '#0B1F3A',
  tinta: '#0F1B2D',
  tintaRedup: '#4A5A72',
  garis: '#C5CEDA',
  baja: '#F3F5F8',
  masalah: '#B42318'
};

var BULAN_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus',
  'September', 'Oktober', 'November', 'Desember'];
var HARI_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/**
 * Template PDF per form. Form lain (Waste, Suhu, Prep, form kustom) cukup
 * menambah satu entri: { judul, isi(tanggal, opsi) }. isi mengembalikan
 * { ada: bool (ada isian pada tanggal itu), pesanKosong (opsional),
 *   info: [[label, nilai]], tabel: html tabel, catatan: [teks] }, atau
 * bagian: [{ info, tabel }] untuk laporan yang tiap bagiannya mulai di
 * halaman baru dengan kepala diulang. Kepala, kotak info, baris "Diisi
 * oleh"/"Diperiksa oleh", dan kaki dibuat bersama oleh htmlLaporan_.
 * perKategori: true berarti form ini bisa diunduh untuk satu kategori.
 */
var LAPORAN_PDF = {
  STOCK: { judul: 'Form Stock Inventory Harian', isi: isiPdfStock_, perKategori: true },
  SUHU: { judul: 'Form Pengecekan Suhu Chiller & Freezer', isi: isiPdfSuhu_ },
  WASTE: { judul: 'Form Pencatatan Waste', isi: isiPdfWaste_ },
  PREP: { judul: 'Form Prep List', isi: isiPdfPrep_ }
};

/**
 * Pemisah halaman PDF (Bagian 9.1 butir 4). Dukungan page-break-before pada
 * Utilities.newBlob(html).getAs('application/pdf') belum dipastikan, jadi
 * bawaannya cadangan: PDF stock semua kategori satu tabel bersambung dengan
 * baris judul kategori. Jalankan ujiPemisahHalamanPdf di editor; jika
 * pemisah dipatuhi, Script Property PDF_PEMISAH_HALAMAN diisi "ya" dan tiap
 * kategori mulai di halaman baru dengan kepala laporan diulang.
 */
var PROP_PEMISAH_HALAMAN = 'PDF_PEMISAH_HALAMAN';

function pemisahHalamanPdf_() {
  // Di Supabase PDF dibuat supabase/src/pdf.js, yang selalu mematuhi pemisah halaman.
  if (DI_SUPABASE_) return true;
  return String(PropertiesService.getScriptProperties().getProperty(PROP_PEMISAH_HALAMAN) || '')
    .trim().toLowerCase() === 'ya';
}

function escHtml_(teks) {
  return String(teks == null ? '' : teks).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Angka format Indonesia untuk PDF dan email: 1250.5 → "1.250,5"; minus memakai tanda −. */
function angkaId_(n) {
  if (n == null || !isFinite(n)) return '–';
  var r = bulat_(n);
  var bagian = String(Math.abs(r)).split('.');
  var bulat = bagian[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (r < 0 ? '−' : '') + bulat + (bagian[1] ? ',' + bagian[1] : '');
}

/** "Minggu, 4 Oktober 2026" dari "2026-10-04". */
function tanggalPanjangId_(tanggal) {
  var p = String(tanggal).split('-');
  var d = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
  return HARI_ID[d.getUTCDay()] + ', ' + Number(p[2]) + ' ' + BULAN_ID[Number(p[1]) - 1] + ' ' + p[0];
}

function jamId_(tanggalWaktu) {
  return tanggalWaktu ? Utilities.formatDate(tanggalWaktu, zonaWaktu_(), 'HH.mm') : '';
}

/** "3 Okt 21.50" (seperti "Diperiksa Budi, 3 Okt 21.50" di aplikasi). */
function waktuPendekId_(tanggalWaktu) {
  var t = Utilities.formatDate(tanggalWaktu, zonaWaktu_(), 'yyyy-MM-dd HH.mm');
  return Number(t.slice(8, 10)) + ' ' + BULAN_ID[Number(t.slice(5, 7)) - 1].slice(0, 3) + ' ' + t.slice(11);
}

function namaFormDari_(idForm) {
  var nama = idForm;
  bacaDaftarForm_().forEach(function (f) { if (f.id === idForm) nama = f.nama; });
  return nama;
}

/** Nama form yang aman untuk nama file: "Prep list" → "Prep_list". */
function namaFileForm_(nama) {
  return String(nama).replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_') || 'Form';
}

/**
 * Diisi oleh dan Diperiksa oleh (Bagian 6.2) dari kiriman satu tanggal.
 * Semua kiriman diperiksa → pemeriksa terakhir dan waktunya; belum semua →
 * "2 dari 3 isian diperiksa". kategori (PDF stock satu kategori): hanya
 * kiriman kategori itu.
 */
function ringkasPengisian_(idForm, tanggal, kategori) {
  var def = defRiwayat_(idForm);
  var kiriman = def ? kirimanRiwayat_(def, { dari: tanggal, sampai: tanggal }, filterRiwayat_({})) : [];
  if (kategori) {
    kiriman = kiriman.filter(function (k) {
      return String(k.kepala.kategori || '').split(', ').some(function (x) { return samaNama_(x, kategori); });
    });
  }
  var hasil = { jumlah: kiriman.length, diisi: 'Belum ada isian', diperiksa: 'Belum ada isian' };
  if (!kiriman.length) return hasil;
  var nama = [];
  var terakhir = '';
  var diperiksa = 0;
  var cek = null;
  kiriman.slice().reverse().forEach(function (k) {
    if (nama.indexOf(k.oleh) < 0) nama.push(k.oleh);
    if (k.waktu && k.waktu > terakhir) terakhir = k.waktu;
    if (k.status === STATUS_DIPERIKSA) {
      diperiksa++;
      if (k.diperiksa && (!cek || String(k.diperiksa.waktu) > String(cek.waktu))) cek = k.diperiksa;
    }
  });
  hasil.diisi = nama.join(', ') + (terakhir ? ', terakhir ' + jamId_(new Date(terakhir)) : '');
  if (diperiksa === kiriman.length && cek) {
    hasil.diperiksa = cek.oleh + (cek.waktu ? ', ' + waktuPendekId_(new Date(cek.waktu)) : '');
  } else {
    hasil.diperiksa = diperiksa + ' dari ' + kiriman.length + ' isian diperiksa';
  }
  hasil.semuaDiperiksa = diperiksa === kiriman.length;
  return hasil;
}

/**
 * Isi PDF Stock (Bagian 9.1 butir 2 dan 4, tata letak Harian_Stock Bagian
 * 8.3): rekap Stock_Harian tanggal itu, dikelompokkan per kategori. Item
 * tanpa gerakan menampilkan Awal = Akhir = rekap terakhir sebelumnya.
 * opsi.kategori: nama satu kategori aktif (PDF hanya berisi kategori itu,
 * namanya di kotak info), atau kosong untuk semua kategori. Semua kategori:
 * kategori tanpa rekap pada tanggal itu dilewati; dengan pemisah halaman
 * tiap kategori satu bagian (halaman baru, kepala diulang), tanpa pemisah
 * satu tabel bersambung dengan baris judul kategori.
 */
function isiPdfStock_(tanggal, opsi) {
  opsi = opsi || {};
  var pilihKat = rapikanTeks_(opsi.kategori);
  var master = bacaItem_();
  var kategori = bacaKategori_();
  var rekap = bacaRekap_();
  var asli = masukAsliPerHari_(tanggal, tanggal);
  var adaRekap = false;
  var perKat = {};
  Object.keys(master).forEach(function (k) {
    var m = master[k];
    var r = (rekap.item[k] || []).filter(function (x) { return x.tanggal === tanggal; })[0];
    if (r) adaRekap = true;
    if (!m.aktif && !r) return; // item nonaktif hanya tampil jika bergerak hari itu
    var kat = (r && r.kategori) || m.kategori || 'Tanpa kategori';
    var grup = perKat[kat.toLowerCase()] = perKat[kat.toLowerCase()] || { nama: kat, item: [], adaRekap: false };
    if (r) grup.adaRekap = true;
    grup.item.push({ m: m, pos: posisiStock_(rekap.item[k], tanggal), asli: asli[k + '|' + tanggal] || '' });
  });
  var kiriman = bacaBarisTanggal_('Data_Stock', tanggal, zonaSheet_(), ['Kategori']);
  var urutKat = kategori.map(function (k) { return k.nama.toLowerCase(); });
  var kunciKat = Object.keys(perKat).filter(function (k) { return perKat[k].adaRekap; }).sort(function (a, b) {
    var ia = urutKat.indexOf(a);
    var ib = urutKat.indexOf(b);
    return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib) || a.localeCompare(b, 'id');
  });
  var ada = kiriman.length > 0 || adaRekap;
  if (pilihKat) {
    var kunci = pilihKat.toLowerCase();
    var grupPilih = perKat[kunci];
    ada = !!(grupPilih && grupPilih.adaRekap) || kiriman.some(function (x) { return samaNama_(x['Kategori'], pilihKat); });
    kunciKat = grupPilih ? [kunci] : [];
  }

  var adaMin = false;
  var sel = function (n) { return '<td class="angka">' + (n ? angkaId_(n) : '') + '</td>'; };
  function barisKategori(grup) {
    return grup.item.sort(function (a, b) { return a.m.nama.localeCompare(b.m.nama, 'id'); }).map(function (x, i) {
      var p = x.pos;
      var minus = p.akhir < 0;
      var diBawah = !minus && x.m.stokMin != null && p.akhir < x.m.stokMin;
      if (diBawah) adaMin = true;
      return '<tr>' +
        '<td class="angka">' + (i + 1) + '</td>' +
        '<td>' + escHtml_(x.m.nama) + '</td>' +
        '<td class="angka">' + angkaId_(p.awal) + '</td>' +
        '<td class="angka">' + (p.masuk ? angkaId_(p.masuk) : '') +
          (x.asli ? '<br><span class="kecil">(' + escHtml_(x.asli) + ')</span>' : '') + '</td>' +
        sel(p.hasilPrep) + sel(p.keluar) + sel(p.dipakaiPrep) + sel(p.waste) + sel(p.penyesuaian) +
        '<td class="angka akhir' + (minus ? ' masalah' : '') + '">' + angkaId_(p.akhir) + (diBawah ? ' *' : '') + '</td>' +
        '<td>' + escHtml_(x.m.satuan) + '</td>' +
        '</tr>';
    }).join('');
  }
  var judul = ['No', 'Nama Item', 'Stock Awal', 'Stock Masuk', 'Hasil Prep', 'Stock Keluar', 'Dipakai Prep',
    'Waste', 'Penyesuaian', 'Stock Akhir', 'Satuan'];
  function tabel(isiBaris, kosong) {
    return '<table class="data"><colgroup><col style="width:4%"><col style="width:18%">' +
      '<col span="8" style="width:9%"><col style="width:6%"></colgroup><thead><tr>' +
      judul.map(function (j) { return '<th>' + j + '</th>'; }).join('') + '</tr></thead><tbody>' +
      (isiBaris || '<tr><td colspan="11">' + kosong + '</td></tr>') + '</tbody></table>';
  }

  var bagian;
  if (pilihKat || pemisahHalamanPdf_()) {
    // Satu bagian per kategori; nama kategori di kotak info (tanpa baris judul kategori).
    bagian = kunciKat.map(function (k) {
      return { info: [['Kategori', perKat[k].nama]], tabel: tabel(barisKategori(perKat[k]), '') };
    });
  } else {
    // Cadangan: satu tabel bersambung dengan baris judul kategori.
    bagian = [{
      info: [['Kategori', 'Semua kategori']],
      tabel: tabel(kunciKat.map(function (k) {
        return '<tr class="kategori"><td colspan="11">' + escHtml_(perKat[k].nama) + '</td></tr>' + barisKategori(perKat[k]);
      }).join(''), 'Tidak ada gerakan stock pada tanggal ini.')
    }];
  }
  if (!bagian.length) {
    bagian = [{ info: [['Kategori', 'Semua kategori']], tabel: tabel('', 'Tidak ada gerakan stock pada tanggal ini.') }];
  }
  var catatan = [];
  if (adaMin) catatan.push('* Stock Akhir di bawah stok minimum.');
  catatan.push('Stock Akhir minus ditulis merah tebal. Angka dalam kurung: Stock Masuk yang diketik dalam satuan besar.');
  return {
    ada: ada,
    kategori: pilihKat,
    pesanKosong: pilihKat
      ? 'Belum ada isian Stock kategori ' + pilihKat + ' pada ' + tanggalPanjangId_(tanggal) + '. Pilih tanggal atau kategori lain.'
      : '',
    bagian: bagian,
    catatan: catatan
  };
}

/** Rupiah untuk PDF dan email: 45000 → "Rp 45.000"; kosong → "–". */
function rupiahId_(n) {
  if (n === '' || n == null || !isFinite(Number(n))) return '–';
  return 'Rp ' + angkaId_(Math.round(Number(n)));
}

/** Baris tab Data pada satu tanggal sebagai objek { judul: nilai }, urut waktu kirim. */
function barisDataTanggal_(namaTab, tanggal) {
  var t = bacaTabel_(namaTab);
  if (!t) return [];
  var zona = zonaSheet_();
  return t.baris.filter(function (b) {
    return teksTanggal_(nilai_(t, b, 'Tanggal'), zona) === tanggal && String(nilai_(t, b, 'submission_id') || '');
  }).map(function (b) {
    var o = {};
    t.judul.forEach(function (j, i) { if (j) o[j] = b[i]; });
    return o;
  }).sort(function (a, b) {
    var x = a.timestamp_server instanceof Date ? a.timestamp_server.getTime() : 0;
    var y = b.timestamp_server instanceof Date ? b.timestamp_server.getTime() : 0;
    return x - y;
  });
}

/**
 * Isi PDF Waste (tata letak Harian_Waste, Bagian 8.3): satu baris per item
 * waste, urut waktu kirim, dengan baris total estimasi kerugian.
 */
function isiPdfWaste_(tanggal) {
  var baris = barisDataTanggal_('Data_Waste', tanggal);
  // PDF yang diunduh Staff tanpa nominal rupiah (Bagian 5.4); email dan Drive tetap lengkap.
  var rupiah = rupiahWasteTerlihat_();
  var total = 0;
  var adaTanpaHarga = false;
  var isi = baris.map(function (b, i) {
    var rp = b['Estimasi Kerugian (Rp)'];
    if (rp === '' || rp == null) adaTanpaHarga = true;
    else total += Number(rp) || 0;
    return '<tr>' +
      '<td class="angka">' + (i + 1) + '</td>' +
      '<td>' + escHtml_(b['Nama Staff']) + '</td>' +
      '<td>' + escHtml_(b['Shift']) + '</td>' +
      '<td>' + escHtml_(b['Item / Produk']) +
        (rapikanTeks_(b['Foto Bukti']) ? '<br><span class="kecil">(ada foto bukti)</span>' : '') + '</td>' +
      '<td>' + escHtml_(b['Kategori Waste']) + '</td>' +
      '<td class="angka">' + angkaId_(Number(b['Qty']) || 0) + '</td>' +
      '<td>' + escHtml_(b['Satuan']) + '</td>' +
      '<td>' + escHtml_(b['Alasan / Keterangan']) + '</td>' +
      (rupiah ? '<td class="angka">' + rupiahId_(rp) + '</td>' : '') +
      '</tr>';
  });
  var judul = ['No', 'Nama Staff', 'Shift', 'Item / Produk', 'Kategori Waste', 'Qty', 'Satuan', 'Alasan'];
  if (rupiah) judul.push('Estimasi Kerugian (Rp)');
  var lebar = rupiah ? [4, 11, 7, 17, 12, 8, 7, 20, 14] : [4, 12, 8, 20, 14, 9, 8, 25];
  var tabel = '<table class="data"><colgroup>' + lebar.map(function (l) { return '<col style="width:' + l + '%">'; }).join('') +
    '</colgroup><thead><tr>' +
    judul.map(function (j) { return '<th>' + j + '</th>'; }).join('') + '</tr></thead><tbody>' +
    (isi.length ? isi.join('') : '<tr><td colspan="' + judul.length + '">Belum ada isian.</td></tr>') +
    (rupiah ? '<tr class="total"><td colspan="8">Total estimasi kerugian</td><td class="angka">' + rupiahId_(total) + '</td></tr>' : '') +
    '</tbody></table>';
  var catatan = rupiah ? ['Estimasi kerugian = Qty × Harga Satuan yang tercatat saat waste dicatat.'] : [];
  if (rupiah && adaTanpaHarga) catatan.push('Item tanpa harga satuan ditulis "–" dan tidak ikut dijumlahkan.');
  if (baris.some(function (b) { return rapikanTeks_(b['Foto Bukti']); })) {
    catatan.push('Foto bukti tersimpan di Google Drive, folder ' + FOLDER_LAPORAN + '/' + (namaOutlet_() || 'Outlet') + '/' +
      FOLDER_FOTO_WASTE + '; tautannya ada di kolom Foto Bukti tab Data_Waste.');
  }
  return { ada: baris.length > 0, info: [['Jumlah item', String(baris.length)]], tabel: tabel, catatan: catatan };
}

/** "7 Okt 2026" dari "2026-10-07". */
function tanggalSedangId_(tanggal) {
  var p = String(tanggal).split('-');
  return Number(p[2]) + ' ' + BULAN_ID[Number(p[1]) - 1].slice(0, 3) + ' ' + p[0];
}

/** Bahan tiap baris prep satu tanggal dari Data_PrepBahan: { prep_row_id: [{ item, qty, satuan }] }. */
function bahanPrepTanggal_(tanggal) {
  var hasil = {};
  barisDataTanggal_('Data_PrepBahan', tanggal).forEach(function (b) {
    var id = String(b.prep_row_id || '');
    if (!id) return;
    (hasil[id] = hasil[id] || []).push({ item: rapikanTeks_(b['Item Bahan']), qty: Number(b['Qty Terpakai']) || 0,
      satuan: rapikanTeks_(b['Satuan']) });
  });
  return hasil;
}

/**
 * Isi PDF Prep List (tata letak Harian_Prep, Bagian 8.3): satu baris per item
 * prep, urut waktu kirim. Bahan yang terpakai ditulis kecil di bawah nama
 * item; Hasil atau Qty dalam satuan item itu.
 */
function isiPdfPrep_(tanggal) {
  var baris = barisDataTanggal_('Data_Prep', tanggal);
  var bahan = bahanPrepTanggal_(tanggal);
  var zona = zonaSheet_();
  var isi = baris.map(function (b, i) {
    var beresep = b['Hasil per 1 Resep'] !== '' && b['Hasil per 1 Resep'] != null;
    var bs = teksTanggal_(b['Baik Sampai'], zona);
    var daftar = bahan[String(b.row_id || '')] || [];
    return '<tr>' +
      '<td class="angka">' + (i + 1) + '</td>' +
      '<td>' + escHtml_(b['Item / Menu Prep']) + (daftar.length ? '<br><span class="kecil">Bahan: ' + escHtml_(daftar.map(function (x) {
        return x.item + ' ' + angkaId_(x.qty) + ' ' + x.satuan;
      }).join(', ')) + '</span>' : '') + '</td>' +
      '<td>' + escHtml_(b['Nama Staff']) + '</td>' +
      '<td>' + escHtml_(b['Shift']) + '</td>' +
      '<td class="angka">' + (beresep ? angkaId_(Number(b['Jumlah Resep']) || 0) : '') + '</td>' +
      '<td class="angka">' + angkaId_(Number(beresep ? b['Hasil'] : b['Qty']) || 0) +
        (beresep && b['Hasil Aktual'] !== '' && b['Hasil Aktual'] != null
          ? '<br><span class="kecil">standar ' + angkaId_(bulat_((Number(b['Jumlah Resep']) || 0) * Number(b['Hasil per 1 Resep']))) + '</span>' : '') +
        '</td>' +
      '<td>' + escHtml_(b['Satuan']) + '</td>' +
      '<td>' + (bs ? escHtml_(tanggalSedangId_(bs)) : '') + '</td>' +
      '<td>' + escHtml_(b['Keterangan']) + '</td>' +
      '</tr>';
  });
  var judul = ['No', 'Item / Menu Prep', 'Nama Staff', 'Shift', 'Jumlah Resep', 'Hasil atau Qty', 'Satuan', 'Baik Sampai',
    'Keterangan'];
  var tabel = '<table class="data"><colgroup><col style="width:4%"><col style="width:26%"><col style="width:11%">' +
    '<col style="width:7%"><col style="width:8%"><col style="width:9%"><col style="width:7%"><col style="width:10%">' +
    '<col style="width:18%"></colgroup><thead><tr>' +
    judul.map(function (j) { return '<th>' + j + '</th>'; }).join('') + '</tr></thead><tbody>' +
    (isi.length ? isi.join('') : '<tr><td colspan="9">Belum ada isian.</td></tr>') + '</tbody></table>';
  return {
    ada: baris.length > 0,
    info: [['Jumlah item', String(baris.length)]],
    tabel: tabel,
    catatan: ['Hasil = hasil aktual jika dicatat (standar resep ditulis kecil di bawahnya), selain itu Jumlah Resep × Hasil per 1 Resep. ' +
      'Item tanpa resep ditulis dengan Qty dan tidak menggerakkan stock.',
      'Bahan: yang terpakai menurut resep saat prep dibuat.']
  };
}

/** "3,5 °C"; minus memakai tanda −. */
function suhuId_(n) {
  return angkaId_(n) + ' °C';
}

/**
 * Isi PDF Suhu (Bagian 5.2 dan 8.3): satu baris per unit dengan Opening,
 * Middle, dan Closing (suhu dan jam); cek ulang ditulis di bawah baris
 * unitnya dengan jamnya. Suhu di luar standar merah tebal dan bertanda *.
 * Unit aktif selalu tampil; unit nonaktif hanya jika punya isian hari itu.
 */
function isiPdfSuhu_(tanggal) {
  var data = barisDataTanggal_('Data_Suhu', tanggal);
  var batas = batasSuhu_();
  var unit = bacaUnit_().filter(function (u) {
    return u.aktif || data.some(function (b) { return samaNama_(b['Nama Unit'], u.nama); });
  });
  data.forEach(function (b) {
    var nama = rapikanTeks_(b['Nama Unit']);
    if (!unit.some(function (u) { return samaNama_(u.nama, nama); })) {
      unit.push({ nama: nama, tipe: rapikanTeks_(b['Tipe Unit']) || 'Chiller', aktif: false });
    }
  });
  var adaLuar = false;
  function sel(b) {
    if (!b) return '<td class="tengah kecil">belum diisi</td>';
    var luar = rapikanTeks_(b['Status Suhu']) === STATUS_SUHU_LUAR;
    if (luar) adaLuar = true;
    return '<td class="angka' + (luar ? ' masalah' : '') + '">' + suhuId_(Number(b['Suhu (°C)'])) + (luar ? ' *' : '') +
      (b.timestamp_server instanceof Date ? '<br><span class="kecil">' + jamId_(b.timestamp_server) + '</span>' : '') + '</td>';
  }
  var baris = [];
  unit.forEach(function (u) {
    var milik = data.filter(function (b) { return samaNama_(b['Nama Unit'], u.nama); });
    var per = {};
    milik.forEach(function (b) { var w = rapikanTeks_(b['Waktu Cek']); if (!per[w]) per[w] = b; });
    var utama = milik.filter(function (b) { return rapikanTeks_(b['Waktu Cek']) !== 'Cek ulang'; });
    var staf = [];
    var tindakan = [];
    utama.forEach(function (b) {
      var n = rapikanTeks_(b['Nama Staff']) || rapikanTeks_(b.submitted_by);
      if (n && staf.indexOf(n) < 0) staf.push(n);
      var tk = rapikanTeks_(b['Tindakan Korektif']);
      if (tk) tindakan.push(rapikanTeks_(b['Waktu Cek']) + ': ' + tk);
    });
    baris.push('<tr><td>' + escHtml_(u.nama) + '</td><td>' + escHtml_(u.tipe) + '</td>' +
      sel(per.Opening) + sel(per.Middle) + sel(per.Closing) +
      '<td>' + escHtml_(staf.join(', ')) + '</td><td>' + escHtml_(tindakan.join(' / ')) + '</td></tr>');
    milik.filter(function (b) { return rapikanTeks_(b['Waktu Cek']) === 'Cek ulang'; }).forEach(function (b) {
      var luar = rapikanTeks_(b['Status Suhu']) === STATUS_SUHU_LUAR;
      if (luar) adaLuar = true;
      baris.push('<tr class="cek-ulang"><td colspan="2">Cek ulang ' +
        (b.timestamp_server instanceof Date ? jamId_(b.timestamp_server) : '') + '</td>' +
        '<td colspan="3" class="' + (luar ? 'masalah' : '') + '">' + suhuId_(Number(b['Suhu (°C)'])) + (luar ? ' *' : '') +
        ', ' + escHtml_(rapikanTeks_(b['Status Suhu']).toLowerCase()) + '</td>' +
        '<td>' + escHtml_(rapikanTeks_(b['Nama Staff']) || rapikanTeks_(b.submitted_by)) + '</td>' +
        '<td>' + escHtml_(rapikanTeks_(b['Tindakan Korektif'])) + '</td></tr>');
    });
  });
  var judul = ['Nama Unit', 'Tipe', 'Opening', 'Middle', 'Closing', 'Nama Staff', 'Tindakan Korektif'];
  var tabel = '<table class="data"><colgroup><col style="width:16%"><col style="width:9%">' +
    '<col span="3" style="width:11%"><col style="width:15%"><col style="width:27%"></colgroup><thead><tr>' +
    judul.map(function (j) { return '<th>' + j + '</th>'; }).join('') + '</tr></thead><tbody>' +
    (baris.length ? baris.join('') : '<tr><td colspan="7">Belum ada unit aktif.</td></tr>') + '</tbody></table>';
  var catatan = [];
  if (adaLuar) catatan.push('* Di luar standar (ditulis merah tebal).');
  catatan.push('Jam di bawah suhu: waktu isian diterima. Cek ulang ditulis di bawah baris unitnya.');
  return {
    ada: data.length > 0,
    info: [['Batas normal', 'Chiller ' + angkaId_(batas.chillerMin) + ' sampai ' + suhuId_(batas.chillerMaks) +
      ' · Freezer ' + suhuId_(batas.freezerMaks) + ' atau lebih rendah']],
    tabel: tabel,
    catatan: catatan
  };
}

/**
 * Dokumen HTML lengkap satu laporan: kepala, kotak info, tabel, Diisi/Diperiksa
 * oleh, kaki. Laporan dengan isi.bagian: tiap bagian setelah yang pertama
 * mulai di halaman baru (page-break-before) dengan kepala, judul, dan kotak
 * info diulang; baris judul tabel ikut diulang karena tiap bagian punya tabel
 * sendiri. Diisi/Diperiksa oleh dan kaki hanya di akhir. Laporan yang bukan
 * form harian (Tahap 8: selisih opname, daftar belanja) memberi isi.judul dan
 * isi.bawah ([[label, nilai]]) sebagai pengganti Diisi/Diperiksa oleh.
 * Rekap bulanan (Tahap 10) memberi isi.infoDasar (pengganti baris Tanggal di
 * kotak info) dan memakai h2 sebagai judul tiap bagiannya.
 */
function htmlLaporan_(idForm, tanggal, isi) {
  var judul = isi.judul || laporanPdf_(idForm).judul;
  var outlet = namaOutlet_();
  var bawah = isi.bawah;
  if (!bawah) {
    var p = ringkasPengisian_(idForm, tanggal, isi.kategori);
    bawah = [['Diisi oleh', p.diisi], ['Diperiksa oleh', p.diperiksa]];
  }
  var w = WARNA_PDF;
  var dibuat = Utilities.formatDate(new Date(), zonaWaktu_(), 'yyyy-MM-dd HH.mm');
  var bagian = isi.bagian || [{ info: isi.info, tabel: isi.tabel }];
  var kepala = function (b) {
    var info = [['Nama Outlet', outlet]].concat(isi.infoDasar || [['Tanggal', tanggalPanjangId_(tanggal)]], b.info || []);
    return '<div class="kepala">InventoryKu · ' + escHtml_(outlet) + '</div>' +
      '<h1>' + escHtml_(judul) + '</h1>' +
      '<table class="info">' + info.map(function (r) {
        return '<tr><td class="label">' + escHtml_(r[0]) + '</td><td class="nilai">' + escHtml_(r[1]) + '</td></tr>';
      }).join('') + '</table>';
  };
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
    'body{font-family:Arial,Helvetica,sans-serif;font-size:9pt;color:' + w.tinta + ';margin:0}' +
    '.kepala,.kaki{color:' + w.tintaRedup + ';font-size:8pt}' +
    '.kepala{margin-bottom:6px}.kaki{margin-top:14px;border-top:1px solid ' + w.garis + ';padding-top:4px}' +
    'h1{font-size:15pt;color:' + w.navy + ';margin:0 0 8px 0;padding-bottom:4px;border-bottom:2px solid ' + w.navy + '}' +
    'table{border-collapse:collapse}' +
    'table.info{margin-bottom:10px}table.info td{padding:2px 14px 2px 0;vertical-align:top}' +
    'table.info td.label{color:' + w.tintaRedup + '}table.info td.nilai{font-weight:bold}' +
    'h2{font-size:11pt;color:' + w.navy + ';margin:16px 0 4px 0}h3{font-size:9pt;color:' + w.tinta + ';margin:10px 0 4px 0}' +
    'p.isi{margin:0 0 4px 0}' +
    'table.data{width:100%;table-layout:fixed}' +
    'table.data th{background:' + w.navy + ';color:#FFFFFF;font-weight:bold;padding:4px 3px;border:1px solid ' + w.garis +
      ';text-align:center;font-size:8pt}' +
    'table.data td{padding:3px;border:1px solid ' + w.garis + ';vertical-align:top;word-wrap:break-word}' +
    'td.angka{text-align:right}td.akhir{font-weight:bold}' +
    'tr.kategori td{background:' + w.baja + ';color:' + w.tinta + ';font-weight:bold;text-align:left}' +
    'tr.total td{background:' + w.baja + ';font-weight:bold}tr.cek-ulang td{color:' + w.tintaRedup + ';font-size:8pt}' +
    'td.tengah{text-align:center}' +
    '.masalah{color:' + w.masalah + ';font-weight:bold}.kecil{font-size:7pt;color:' + w.tintaRedup + '}' +
    'table.bawah{margin-top:12px}table.bawah td{padding:2px 14px 2px 0}table.bawah td.label{color:' + w.tintaRedup + '}' +
    '.catatan{color:' + w.tintaRedup + ';font-size:8pt;margin:6px 0 0 0}' +
    '.halaman-baru{page-break-before:always;break-before:page}' +
    '</style></head><body>' +
    bagian.map(function (b, i) {
      return (i ? '<div class="halaman-baru">' : '<div>') + kepala(b) + b.tabel + '</div>';
    }).join('') +
    (isi.catatan || []).map(function (c) { return '<p class="catatan">' + escHtml_(c) + '</p>'; }).join('') +
    '<table class="bawah">' + bawah.map(function (r) {
      return '<tr><td class="label">' + escHtml_(r[0]) + '</td><td>' + escHtml_(r[1]) + '</td></tr>';
    }).join('') + '</table>' +
    '<div class="kaki">Dibuat ' + escHtml_(dibuat) + ' · InventoryKu</div>' +
    '</body></html>';
}

/**
 * Membuat PDF satu form pada satu tanggal: { blob, namaFile, namaForm }.
 * Nama file {YYYY-MM-DD}_{NamaForm}.pdf; stock satu kategori
 * {YYYY-MM-DD}_Stock_{NamaKategori}.pdf (Bagian 9.1). opsi.kategori hanya
 * berlaku untuk form yang perKategori dan harus kategori aktif. Tanggal tanpa
 * isian ditolak dengan pesan yang bisa ditampilkan.
 */
function buatPdf_(idForm, tanggal, opsi) {
  idForm = rapikanTeks_(idForm).toUpperCase();
  var t = laporanPdf_(idForm);
  var namaForm = namaFormDari_(idForm);
  if (!t) throw galatPengguna_('Laporan PDF ' + namaForm + ' dibangun di tahap berikutnya, bersama formnya.');
  if (!tanggalSah_(tanggal)) throw galatPengguna_('Tanggal tidak terbaca. Pilih tanggal lagi.');
  if (tanggal > hariIni_()) throw galatPengguna_('Tanggal masa depan belum punya isian.');
  var kategori = t.perKategori ? rapikanTeks_(opsi && opsi.kategori) : '';
  if (kategori) {
    var cocok = bacaKategori_().filter(function (k) { return samaNama_(k.nama, kategori); })[0];
    if (!cocok) throw galatPengguna_('Kategori ' + kategori + ' tidak ada atau sudah nonaktif. Muat ulang layar Laporan.');
    kategori = cocok.nama;
  }
  var isi = t.isi(tanggal, { kategori: kategori });
  if (!isi.ada) {
    throw galatPengguna_(isi.pesanKosong || ('Belum ada isian ' + namaForm + ' pada ' + tanggalPanjangId_(tanggal) +
      '. Pilih tanggal lain.'));
  }
  var namaFile = tanggal + '_' + namaFileForm_(namaForm) + (kategori ? '_' + namaFileForm_(kategori) : '') + '.pdf';
  var blob = Utilities.newBlob(htmlLaporan_(idForm, tanggal, isi), 'text/html', namaFile + '.html')
    .getAs('application/pdf').setName(namaFile);
  return { blob: blob, namaFile: namaFile, namaForm: namaForm };
}

function cariAtauBuatFolder_(induk, nama) {
  var ada = induk.getFoldersByName(nama);
  return ada.hasNext() ? ada.next() : induk.createFolder(nama);
}

/** Folder Laporan Kitchen/{Nama Outlet}/{Tahun}/{MM Bulan} untuk satu tanggal. */
function folderLaporan_(tanggal) {
  var p = tanggal.split('-');
  var tahun = cariAtauBuatFolder_(folderOutlet_(), p[0]);
  return cariAtauBuatFolder_(tahun, p[1] + ' ' + BULAN_ID[Number(p[1]) - 1]);
}

/**
 * Menyimpan PDF ke Drive: {YYYY-MM-DD}_{NamaForm}_{HHmm}.pdf. Jam di nama file
 * mencegah tabrakan saat disimpan ulang (Bagian 9.1 butir 5).
 */
function simpanPdfKeDrive_(pdf, tanggal) {
  var folder = folderLaporan_(tanggal);
  var jam = Utilities.formatDate(new Date(), zonaWaktu_(), 'HHmm');
  var nama = pdf.namaFile.replace(/\.pdf$/, '') + '_' + jam + '.pdf';
  folder.createFile(pdf.blob.copyBlob().setName(nama));
  var p = tanggal.split('-');
  return {
    namaFile: nama,
    lokasi: [FOLDER_LAPORAN, namaOutlet_() || 'Outlet', p[0], p[1] + ' ' + BULAN_ID[Number(p[1]) - 1]].join('/')
  };
}

/**
 * Form untuk menu Laporan: form aktif, apakah laporan PDF-nya sudah dibangun,
 * dan (form yang bisa per kategori, yaitu Stock) daftar kategori aktif
 * menurut urutan M_Kategori.
 */
function aksiInfoLaporan_() {
  var kategori = null;
  return {
    hariIni: hariIni_(),
    // Form yang disembunyikan tetap bisa diunduh laporannya (Tahap 9).
    form: bacaDaftarForm_().map(function (f) {
      var t = laporanPdf_(f.id);
      var hasil = { id: f.id, nama: f.nama, adaPdf: !!t, tampil: f.aktif };
      if (t && t.perKategori) {
        kategori = kategori || bacaKategori_().map(function (k) { return k.nama; });
        hasil.kategori = kategori;
      }
      return hasil;
    })
  };
}

/**
 * Unduh PDF (semua role): isi PDF dikirim ke aplikasi sebagai base64. Tidak
 * menambah file di Drive. kategori (opsional, Stock): satu kategori saja.
 */
function aksiUnduhPdf_(body) {
  if (tanggalSah_(body.tanggal)) periksaBelumDiarsip_(body.tanggal);
  var pdf = buatPdf_(body.formId, String(body.tanggal || ''), { kategori: body.kategori });
  return {
    namaFile: pdf.namaFile,
    mime: 'application/pdf',
    data: Utilities.base64Encode(pdf.blob.getBytes())
  };
}

/** Simpan ulang ke Drive (khusus Pengelola), misalnya setelah ada koreksi. Selalu semua kategori, seperti PDF harian. */
function aksiSimpanPdfDrive_(body) {
  var tanggal = String(body.tanggal || '');
  if (tanggalSah_(tanggal)) periksaBelumDiarsip_(tanggal);
  var pdf = buatPdf_(body.formId, tanggal);
  return simpanPdfKeDrive_(pdf, tanggal);
}

/**
 * Jalankan dari editor Apps Script: menguji apakah konversi HTML ke PDF
 * mematuhi page-break-before. Membuat PDF uji 3 bagian (tiap bagian seharusnya
 * di halaman sendiri) di folder Laporan Kitchen, lalu menghitung halamannya.
 * 3 halaman: PDF_PEMISAH_HALAMAN = "ya" (PDF stock semua kategori satu
 * halaman per kategori). 1 halaman: "tidak" (cadangan, satu tabel
 * bersambung). Jumlah halaman tidak terbaca: buka file ujinya dan isi Script
 * Property itu sendiri (Project Settings → Script Properties).
 */
function ujiPemisahHalamanPdf() {
  if (sudahPindah_() || DI_SUPABASE_) return console.log('Di Supabase PDF selalu mematuhi pemisah halaman; uji ini tidak diperlukan.');
  var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
    'body{font-family:Arial,Helvetica,sans-serif}.halaman-baru{page-break-before:always;break-before:page}' +
    '</style></head><body>' +
    '<div><h1>Bagian 1 dari 3</h1><p>Uji pemisah halaman InventoryKu. Jika pemisah dipatuhi, tiap bagian ada di halaman sendiri.</p></div>' +
    '<div class="halaman-baru"><h1>Bagian 2 dari 3</h1></div>' +
    '<div class="halaman-baru"><h1>Bagian 3 dari 3</h1></div>' +
    '</body></html>';
  var nama = 'Uji pemisah halaman PDF.pdf';
  var pdf = Utilities.newBlob(html, 'text/html', 'uji.html').getAs('application/pdf').setName(nama);
  var halaman = (pdf.getDataAsString('ISO-8859-1').match(/\/Type\s*\/Page(?![A-Za-z])/g) || []).length;
  cariAtauBuatFolder_(DriveApp.getRootFolder(), FOLDER_LAPORAN).createFile(pdf);
  var props = PropertiesService.getScriptProperties();
  var lokasi = FOLDER_LAPORAN + '/' + nama;
  if (halaman === 3) {
    props.setProperty(PROP_PEMISAH_HALAMAN, 'ya');
    console.log('Pemisah halaman DIPATUHI (3 halaman). PDF stock semua kategori kini satu halaman per kategori. ' +
      'Periksa juga file ' + lokasi + ' di Drive.');
  } else if (halaman === 1) {
    props.setProperty(PROP_PEMISAH_HALAMAN, 'tidak');
    console.log('Pemisah halaman TIDAK dipatuhi (1 halaman). PDF stock semua kategori tetap satu tabel bersambung ' +
      'dengan baris judul kategori; unduh per kategori untuk laporan terpisah. File uji: ' + lokasi + '.');
  } else {
    console.log('Jumlah halaman tidak terbaca (' + halaman + '). Buka ' + lokasi + ' di Drive. Jika isinya 3 halaman, ' +
      'buka Project Settings → Script Properties dan tambahkan PDF_PEMISAH_HALAMAN dengan nilai ya.');
  }
  return halaman;
}

/* ---------- Catatan kegagalan (terlihat Pengelola di M_Konfigurasi dan Beranda) ---------- */

var KETERANGAN_LAPORAN_TERAKHIR = 'Diisi otomatis oleh laporan harian. Baris yang diawali "Gagal" juga tampil di Beranda Pengelola; ' +
  '"Dilewati" berarti hari libur.';

function waktuSekarangId_() {
  return Utilities.formatDate(new Date(), zonaWaktu_(), 'yyyy-MM-dd HH:mm');
}

function catatStatusSistem_(kunci, teks, keterangan) {
  try {
    tulisKonfigurasi_(kunci, teks, keterangan);
  } catch (err) {
    console.error('Status ' + kunci + ' tidak bisa dicatat: ' + err);
  }
}

/**
 * Supabase: email yang gagal dikirim sesudah datanya tersimpan (Brevo, atau Gmail lewat salinan ke Sheets)
 * dicatat seperti kegagalan email lain, sehingga tampil di Beranda Pengelola.
 */
function catatSurelGagal_(asal, pesan) {
  var kunci = /Rekap/.test(String(asal)) ? 'rekap_terakhir' : 'laporan_terakhir';
  catatStatusSistem_(kunci, 'Gagal ' + waktuSekarangId_() + ': email tidak terkirim (' + pesan + ').');
}

/**
 * Tanggal laporan harian terbaru yang seharusnya sudah terkirim, jika laporan_terakhir belum mencakupnya; '' jika tidak
 * terlambat. Menangkap jadwal yang tidak berjalan sama sekali dan karena itu tidak sempat menulis "Gagal" (misalnya pg_cron
 * yang gagal memanggil Supabase). Laporan untuk tanggal D dijadwalkan pada D + jam closing + jeda (boleh lewat tengah malam);
 * dianggap terlambat 60 menit sesudahnya. Kiriman yang tercatat lebih dari 30 menit sebelum jadwal (misalnya uji
 * kirimLaporanSekarang pagi hari) tidak mencakup tanggal itu. laporan_terakhir yang kosong (belum pernah ada laporan) tidak
 * dianggap terlambat. Hari libur (Code.gs v0.30): "Dilewati" dihitung sebagai laporan yang sudah berjalan. Hari libur
 * tetap diperiksa, karena jadwal yang berjalan selalu menulis "Dilewati"; tanpa catatan itu jadwalnya memang berhenti.
 */
function laporanTerlambat_(nilai, lap) {
  var m = String(lap).match(/^(?:Terkirim|Gagal|Dilewati) (\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})/);
  if (!m) return '';
  var jam = jamSah_(nilai.jam_closing) || '21:30';
  var jeda = jedaSah_(nilai.jeda_laporan_menit);
  if (jeda === null) jeda = 45;
  var jadwal = Number(jam.slice(0, 2)) * 60 + Number(jam.slice(3)) + jeda;
  var kini = waktuSekarangId_().match(/^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})/);
  var menitKini = Number(kini[2]) * 60 + Number(kini[3]);
  var mundur = 0;
  while (menitKini + mundur * 1440 < jadwal + 60) mundur++;
  var harus = geserTanggal_(kini[1], -mundur);
  var menitKirim = Math.round((Date.parse(m[1]) - Date.parse(harus)) / 864e5) * 1440 + Number(m[2]) * 60 + Number(m[3]);
  return menitKirim >= jadwal - 30 ? '' : harus;
}

/** Untuk Beranda Pengelola: email laporan, cadangan, atau rekap bulanan terakhir yang gagal atau tidak berjalan. */
function peringatanSistem_() {
  var nilai = bacaKonfigurasi_().nilai;
  var hasil = [];
  var lap = String(nilai.laporan_terakhir || '');
  var cad = String(nilai.cadangan_terakhir || '');
  var rek = String(nilai.rekap_terakhir || '');
  if (/^Gagal/.test(lap)) hasil.push('Laporan harian: ' + lap);
  var telat = /^Gagal/.test(lap) ? '' : laporanTerlambat_(nilai, lap);
  if (telat) {
    hasil.push('Laporan harian: ' + (liburPada_(telat)
      ? 'jadwal laporan tidak berjalan pada ' + tanggalPanjangId_(telat) + ' (hari libur, catatan Dilewati tidak ada)'
      : 'laporan untuk ' + tanggalPanjangId_(telat) + ' belum terkirim') + '. Jadwal otomatis mungkin ' +
      'berhenti. Pemilik Sheet perlu menjalankan pasangTrigger di editor Apps Script.');
  }
  if (/^Gagal/.test(cad)) hasil.push('Cadangan mingguan: ' + cad);
  if (/^Gagal/.test(rek)) hasil.push('Rekap bulanan: ' + rek);
  if (/^Gagal/.test(String(nilai.arsip_terakhir || ''))) hasil.push('Arsip tahunan: ' + nilai.arsip_terakhir);
  // Jadwal diubah dari Pengaturan → Outlet dan jadwal, trigger belum dipasang ulang (Tahap 7).
  if (/^Perlu/.test(String(nilai.pasang_trigger || ''))) {
    hasil.push('Jadwal: jam closing, jeda laporan, hari cadangan, atau zona waktu sudah diubah. ' +
      'Pemilik Sheet perlu menjalankan pasangTrigger di editor Apps Script supaya jadwal baru berlaku.');
  }
  return hasil;
}

/* ---------- Email laporan harian (Bagian 10) ---------- */

/** Saran order (Bagian 9.2): Stok Maksimum − Stock Akhir, dibulatkan ke atas ke satuan besar. */
function saranOrder_(m, akhir) {
  var s = saranOrderAngka_(m, akhir);
  return s ? teksOrder_(m, s.jumlah) : '';
}

/** Waste satu tanggal untuk email: qty per item dan kategori (dijumlah), estimasi kerugian total. */
function ringkasWasteHari_(tanggal) {
  var kumpul = {};
  var urut = [];
  var total = 0;
  barisDataTanggal_('Data_Waste', tanggal).forEach(function (b) {
    var item = rapikanTeks_(b['Item / Produk']);
    var kat = rapikanTeks_(b['Kategori Waste']);
    var k = item.toLowerCase() + '|' + kat;
    var x = kumpul[k];
    if (!x) {
      x = kumpul[k] = { item: item, kategori: kat, qty: 0, satuan: rapikanTeks_(b['Satuan']), estimasi: 0 };
      urut.push(x);
    }
    x.qty = bulat_(x.qty + (Number(b['Qty']) || 0));
    var rp = b['Estimasi Kerugian (Rp)'];
    if (rp === '' || rp == null) x.estimasi = x.estimasi === 0 ? '' : x.estimasi;
    else {
      x.estimasi = (Number(x.estimasi) || 0) + Number(rp);
      total += Number(rp);
    }
  });
  return { baris: urut, totalRp: Math.round(total) };
}

/** Suhu satu tanggal untuk email: jumlah pengecekan dan isian di luar standar beserta cek ulang unit itu. */
function ringkasSuhuHari_(tanggal) {
  var data = barisDataTanggal_('Data_Suhu', tanggal);
  var jam = function (b) { return b.timestamp_server instanceof Date ? jamId_(b.timestamp_server) : ''; };
  var luar = data.filter(function (b) {
    return rapikanTeks_(b['Waktu Cek']) !== 'Cek ulang' && rapikanTeks_(b['Status Suhu']) === STATUS_SUHU_LUAR;
  }).map(function (b) {
    var unit = rapikanTeks_(b['Nama Unit']);
    var mulai = b.timestamp_server instanceof Date ? b.timestamp_server.getTime() : 0;
    return {
      unit: unit,
      waktuCek: rapikanTeks_(b['Waktu Cek']),
      jam: jam(b),
      suhu: Number(b['Suhu (°C)']),
      tindakan: rapikanTeks_(b['Tindakan Korektif']),
      cekUlang: data.filter(function (c) {
        return rapikanTeks_(c['Waktu Cek']) === 'Cek ulang' && samaNama_(c['Nama Unit'], unit) &&
          (c.timestamp_server instanceof Date ? c.timestamp_server.getTime() : 0) >= mulai;
      }).map(function (c) {
        return { jam: jam(c), suhu: Number(c['Suhu (°C)']), status: rapikanTeks_(c['Status Suhu']) };
      })
    };
  });
  return { jumlah: data.length, luar: luar };
}

/** Prep satu tanggal untuk email: satu baris per item prep, urut waktu kirim. */
function ringkasPrepHari_(tanggal) {
  var zona = zonaSheet_();
  return barisDataTanggal_('Data_Prep', tanggal).map(function (b) {
    var beresep = b['Hasil per 1 Resep'] !== '' && b['Hasil per 1 Resep'] != null;
    return {
      item: rapikanTeks_(b['Item / Menu Prep']),
      jumlahResep: beresep ? Number(b['Jumlah Resep']) || 0 : null,
      jumlah: Number(beresep ? b['Hasil'] : b['Qty']) || 0,
      satuan: rapikanTeks_(b['Satuan']),
      baikSampai: teksTanggal_(b['Baik Sampai'], zona),
      oleh: rapikanTeks_(b['Nama Staff']) || rapikanTeks_(b.submitted_by),
      shift: rapikanTeks_(b['Shift'])
    };
  });
}

/** "Sauce bolognese: sekitar 1,5 liter lewat masa simpan (baik sampai 4 Okt)." (tampilan Bagian 7) */
function teksMasaSimpan_(x, lewat) {
  var p = String(x.baikSampai).split('-');
  return x.item + ': sekitar ' + angkaId_(x.qty) + ' ' + x.satuan + (lewat ? ' lewat masa simpan' : ' habis besok') +
    (x.baikSampai ? ' (baik sampai ' + Number(p[2]) + ' ' + BULAN_ID[Number(p[1]) - 1].slice(0, 3) + ')' : '') + '.';
}

/** Stock pada akhir tanggal itu: item minus dan item di bawah stok minimum (item aktif). master dan rekap opsional. */
function ringkasStockHari_(tanggal, master, rekap) {
  master = master || bacaItem_();
  rekap = rekap || bacaRekap_();
  var minus = [];
  var belanja = [];
  Object.keys(master).sort().forEach(function (k) {
    var m = master[k];
    if (!m.aktif) return;
    var akhir = posisiStock_(rekap.item[k], tanggal).akhir;
    if (akhir < 0) minus.push({ m: m, akhir: akhir });
    if (m.stokMin != null && akhir < m.stokMin) belanja.push({ m: m, akhir: akhir, saran: saranOrder_(m, akhir) });
  });
  var urut = function (a, b) {
    return a.m.kategori.localeCompare(b.m.kategori, 'id') || a.m.nama.localeCompare(b.m.nama, 'id');
  };
  return { minus: minus.sort(urut), belanja: belanja.sort(urut) };
}

function teksStatusForm_(f, libur) {
  if (f.status === 'terkirim') {
    return 'Terkirim' + (f.detail ? ' (' + f.detail + ')' : '') +
      (f.terakhir ? ', terakhir ' + f.terakhir.oleh + ' ' + jamId_(new Date(f.terakhir.waktu)) : '');
  }
  if (f.status === 'nihil') return 'Nihil (ditandai ' + (f.terakhir ? f.terakhir.oleh : '') + ')';
  if (f.status === 'sebagian') return 'Belum lengkap: ' + f.detail;
  if (f.wajib) return 'Belum diisi';
  if (libur) return 'Tidak ada isian (hari libur)';
  // Form kustom di luar jadwalnya tidak ditagih (Bagian 5.8).
  return f.jadwal === 'sewaktu-waktu' ? 'Tidak ada isian (sewaktu-waktu, tidak ditagih)' : 'Tidak ada isian (tidak dijadwalkan hari ini)';
}

/** Isi email laporan harian sebagai HTML sederhana (tanpa amber, Bagian 2). */
function htmlEmailHarian_(d) {
  var w = WARNA_PDF;
  var bagian = function (judul, isi) {
    return '<h2 style="font-size:15px;color:' + w.navy + ';margin:20px 0 6px;padding-bottom:4px;border-bottom:1px solid ' +
      w.garis + '">' + escHtml_(judul) + '</h2>' + isi;
  };
  var daftar = function (baris) {
    return '<ul style="margin:0;padding-left:18px">' + baris.map(function (b) {
      return '<li style="margin:2px 0">' + b + '</li>';
    }).join('') + '</ul>';
  };
  var html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:' + w.tinta + ';max-width:640px">' +
    '<div style="background:' + w.navy + ';color:#FFFFFF;padding:14px 16px">' +
      '<div style="font-size:18px;font-weight:bold">Laporan harian ' + escHtml_(d.outlet) + '</div>' +
      '<div style="color:#A9B8CF">' + escHtml_(tanggalPanjangId_(d.tanggal)) + '</div>' +
      // Hari libur (Code.gs v0.30): hanya terlihat lewat kirimLaporanSekarang, karena laporan dari jadwal dilewati.
      (d.libur ? '<div style="color:#A9B8CF">Hari libur' + (d.libur.keterangan ? ': ' + escHtml_(d.libur.keterangan) : '') + '</div>' : '') +
    '</div>';

  html += bagian('Form hari ini', daftar(d.form.map(function (f) {
    var belum = f.status === 'belum' || f.status === 'sebagian';
    var gaya = belum && f.wajib ? 'color:' + w.masalah + ';font-weight:bold' : '';
    return '<b>' + escHtml_(f.nama) + '</b>: <span style="' + gaya + '">' + escHtml_(teksStatusForm_(f, d.libur)) + '</span>';
  })));

  var stock = [];
  if (d.stock.minus.length) {
    stock.push('<p style="margin:6px 0 2px"><b style="color:' + w.masalah + '">Stock Akhir minus (' + d.stock.minus.length + ')</b></p>' +
      daftar(d.stock.minus.map(function (x) {
        return escHtml_(x.m.nama) + ': <span style="color:' + w.masalah + ';font-weight:bold">' +
          angkaId_(x.akhir) + ' ' + escHtml_(x.m.satuan) + '</span>';
      })));
  }
  if (d.stock.belanja.length) {
    // Ringkasan daftar belanja (Bagian 9.2 dan 10): item di bawah stok minimum dan saran ordernya.
    stock.push('<p style="margin:6px 0 2px"><b>Daftar belanja: ' + d.stock.belanja.length + ' item di bawah stok minimum</b></p>' +
      daftar(d.stock.belanja.map(function (x) {
        return escHtml_(x.m.nama) + ': ' + angkaId_(x.akhir) + ' ' + escHtml_(x.m.satuan) +
          ' (minimum ' + angkaId_(x.m.stokMin) + ')' + (x.saran ? ', saran order ' + escHtml_(x.saran) : ', tanpa saran (stok maksimum kosong)');
      })) +
      '<p style="margin:4px 0 0;color:' + w.tintaRedup + ';font-size:12px">Daftar lengkap dan PDF-nya ada di menu Laporan aplikasi.</p>');
  }
  if (!stock.length) stock.push('<p style="margin:0">Tidak ada Stock Akhir minus dan semua stock di atas batas minimum.</p>');
  if (d.pesanan && d.pesanan.length) {
    // Pesanan ke pemasok yang belum dicatat datang (Code.gs v0.29).
    stock.push('<p style="margin:6px 0 2px"><b>Pesanan belum datang (' + d.pesanan.length + ')</b></p>' +
      daftar(d.pesanan.map(function (g) {
        var umur = Math.max(0, selisihHari_(g.tanggal, d.tanggal));
        return '<b>' + escHtml_(g.pemasok) + '</b>: ' + escHtml_(g.item.map(function (r) { return r.item + ' ' + teksJumlahPesanan_(r); }).join(', ')) +
          ' (dipesan ' + escHtml_(g.oleh) + ' lewat WhatsApp, ' + escHtml_(tanggalPendekId_(g.tanggal)) + (umur ? ', ' + umur + ' hari lalu' : '') + ')';
      })));
  }
  html += bagian('Stock', stock.join(''));

  // Suhu di luar standar beserta tindakan korektif dan cek ulangnya (Bagian 10).
  var merah = 'color:' + w.masalah + ';font-weight:bold';
  html += bagian('Suhu', d.suhu.luar.length
    ? '<p style="margin:0 0 2px"><b style="color:' + w.masalah + '">Di luar standar (' + d.suhu.luar.length + ')</b></p>' +
      daftar(d.suhu.luar.map(function (x) {
        return escHtml_(x.unit) + ', ' + escHtml_(x.waktuCek) + (x.jam ? ' ' + x.jam : '') + ': <span style="' + merah + '">' +
          suhuId_(x.suhu) + '</span>. Tindakan: ' + escHtml_(x.tindakan || '–') +
          (x.cekUlang.length ? '. Cek ulang: ' + x.cekUlang.map(function (c) {
            return c.jam + ' ' + suhuId_(c.suhu) + ' (' + c.status.toLowerCase() + ')';
          }).join(', ') : '');
      }))
    : '<p style="margin:0">' + (d.suhu.jumlah ? 'Semua ' + d.suhu.jumlah + ' pengecekan normal.' : 'Belum ada pengecekan suhu.') + '</p>');

  // Total waste hari itu: qty per item dan estimasi kerugian (Bagian 10).
  html += bagian('Waste', d.waste.baris.length
    ? '<p style="margin:0 0 2px"><b>Total ' + d.waste.baris.length + ' item, estimasi kerugian ' + rupiahId_(d.waste.totalRp) + '</b></p>' +
      daftar(d.waste.baris.map(function (x) {
        return escHtml_(x.item) + ' (' + escHtml_(x.kategori) + '): ' + angkaId_(x.qty) + ' ' + escHtml_(x.satuan) +
          ', ' + rupiahId_(x.estimasi);
      }))
    : '<p style="margin:0">Tidak ada waste tercatat.</p>');

  // Prep List hari itu (Tahap 6).
  html += bagian('Prep list', d.prep.length
    ? daftar(d.prep.map(function (x) {
      return '<b>' + escHtml_(x.item) + '</b>: ' + (x.jumlahResep != null ? angkaId_(x.jumlahResep) + ' resep, hasil ' : '') +
        angkaId_(x.jumlah) + ' ' + escHtml_(x.satuan) +
        (x.baikSampai ? ' (baik sampai ' + escHtml_(tanggalSedangId_(x.baikSampai)) + ')' : '') +
        (x.oleh ? ', ' + escHtml_(x.oleh) + (x.shift ? ' ' + escHtml_(x.shift.toLowerCase()) : '') : '');
    }))
    : '<p style="margin:0">Tidak ada prep tercatat.</p>');

  // Barang jadi yang lewat masa simpan atau habis besok (Bagian 5.3 dan 10).
  var simpan = [];
  if (d.masaSimpan.lewat.length) {
    simpan.push('<p style="margin:6px 0 2px"><b style="color:' + w.masalah + '">Lewat masa simpan (' + d.masaSimpan.lewat.length + ')</b></p>' +
      daftar(d.masaSimpan.lewat.map(function (x) {
        return '<span style="color:' + w.masalah + '">' + escHtml_(teksMasaSimpan_(x, true)) + '</span>';
      })));
  }
  if (d.masaSimpan.habisBesok.length) {
    simpan.push('<p style="margin:6px 0 2px"><b>Habis besok (' + d.masaSimpan.habisBesok.length + ')</b></p>' +
      daftar(d.masaSimpan.habisBesok.map(function (x) { return escHtml_(teksMasaSimpan_(x, false)); })));
  }
  html += bagian('Masa simpan', simpan.length ? simpan.join('') +
    '<p style="margin:6px 0 0;color:' + w.tintaRedup + ';font-size:12px">Perkiraan: yang dibuat lebih dulu dianggap dipakai lebih dulu. ' +
    'Catat sebagai waste dari Beranda aplikasi.</p>'
    : '<p style="margin:0">Tidak ada barang yang lewat masa simpan atau habis besok.</p>');

  var periksa = [];
  if (d.pemeriksaan.belumDiperiksa) periksa.push(d.pemeriksaan.belumDiperiksa + ' isian belum diperiksa (31 hari terakhir)');
  if (d.pemeriksaan.dilaporkan) periksa.push(d.pemeriksaan.dilaporkan + ' baris dilaporkan keliru');
  d.reset.forEach(function (n) { periksa.push(escHtml_(n) + ' meminta reset PIN'); });
  // Akun yang terkunci karena PIN salah dalam 24 jam terakhir (Code.gs v0.17).
  (d.terkunci || []).forEach(function (a) {
    periksa.push(escHtml_(a.nama) + ' terkunci karena PIN salah' + (a.kali > 1 ? ' (' + a.kali + ' kali dalam 24 jam terakhir)' : '') +
      (a.sampai ? ', masih terkunci sampai ' + escHtml_(waktuPendekId_(new Date(a.sampai))) : '') + '.' +
      (a.kali > 1 ? ' Jika ' + escHtml_(a.nama) + ' tidak lupa PIN, mungkin ada yang mencoba menebaknya; buat PIN baru dari Pengaturan.' : ''));
  });
  // Pengingat stock opname jika sudah lewat jadwal (Bagian 5.7 dan 10).
  if (d.opname && d.opname.lewat) {
    periksa.push('<b>' + escHtml_(teksPengingatOpname_(d.opname)) + '</b> Jadwal ' + escHtml_(d.opname.jadwal) +
      '. Buka Dashboard → Stock opname.');
  }
  html += bagian('Untuk Head Kitchen dan Manager', periksa.length ? daftar(periksa) :
    '<p style="margin:0">Semua isian sudah diperiksa. Tidak ada laporan kekeliruan atau permintaan reset PIN. Stock opname sesuai jadwal.</p>');

  var lampiran = d.pdf.map(function (p) { return escHtml_(p.namaFile) + (p.drive ? '' : ' (gagal disimpan ke Drive)'); });
  html += bagian('Lampiran', lampiran.length ? daftar(lampiran) : '<p style="margin:0">Tidak ada form yang terisi hari ini, jadi tidak ada PDF.</p>');

  var masalah = d.masalah.slice();
  if (d.cadanganGagal) masalah.push('Cadangan mingguan: ' + d.cadanganGagal);
  if (masalah.length) {
    html += bagian('Perlu perhatian', daftar(masalah.map(function (m) {
      return '<span style="color:' + w.masalah + '">' + escHtml_(m) + '</span>';
    })));
  }
  html += '<p style="margin:20px 0 0">' + (d.alamat
    ? '<a href="' + escHtml_(d.alamat) + '" style="color:' + w.navy + ';font-weight:bold">Buka InventoryKu</a>'
    : 'Buka InventoryKu dari HP untuk melihat rinciannya.') + '</p>' +
    '<p style="color:' + w.tintaRedup + ';font-size:12px;margin:12px 0 0">Email otomatis dari InventoryKu, dikirim setelah closing.</p></div>';
  return html;
}

/**
 * Laporan harian (Bagian 9.1 butir 1 dan Bagian 10): PDF tiap form yang
 * terisi hari itu disimpan ke Drive, lalu satu email ke penerima di M_Outlet.
 * Suhu di luar standar dan total waste ikut sejak Tahap 5; Prep List dan
 * masa simpan sejak Tahap 6; pengingat stock opname dan ringkasan daftar belanja
 * sejak Tahap 8. PDF Suhu ikut juga saat pengecekannya baru sebagian. Hasil dan kegagalan
 * dicatat di M_Konfigurasi (laporan_terakhir).
 * Hari libur (Code.gs v0.30): laporan dari jadwal tidak dikirim. PDF form yang tetap berisian disimpan ke
 * Drive, lalu laporan_terakhir mencatat "Dilewati" (kecuali nilainya diawali "Gagal", supaya kegagalan hari
 * kerja sebelumnya tetap terlihat di Beranda). Uji dari editor (opsi.uji) tetap mengirim email.
 * opsi: { tanggal, uji: bool }.
 */
function jalankanLaporanHarian_(opsi) {
  SS_ = null;
  resetMemoForm_();
  opsi = opsi || {};
  var tanggal = opsi.tanggal || hariIni_();
  var masalah = [];
  var hasil = { tanggal: tanggal, pdf: [], penerima: [], terkirim: false };
  try {
    var libur = liburPada_(tanggal);
    var form = kelengkapanForm_(tanggal);
    form.forEach(function (f) {
      if ((f.status !== 'terkirim' && f.status !== 'sebagian') || !laporanPdf_(f.id)) return;
      try {
        var pdf = buatPdf_(f.id, tanggal);
        var x = { namaFile: pdf.namaFile, blob: pdf.blob, drive: false };
        try {
          simpanPdfKeDrive_(pdf, tanggal);
          x.drive = true;
        } catch (err) {
          console.error('PDF ' + f.id + ' gagal disimpan ke Drive: ' + (err && err.stack ? err.stack : err));
          masalah.push('PDF ' + pdf.namaFile + ' gagal disimpan ke Drive: ' + (err && err.message ? err.message : err));
        }
        hasil.pdf.push(x);
      } catch (err) {
        console.error('PDF ' + f.id + ' gagal dibuat: ' + (err && err.stack ? err.stack : err));
        masalah.push('PDF ' + f.nama + ' gagal dibuat: ' + (err && err.message ? err.message : err));
      }
    });

    if (libur && !opsi.uji) {
      hasil.dilewati = true;
      var keDrive = hasil.pdf.filter(function (p) { return p.drive; }).length;
      var teks = 'Dilewati ' + waktuSekarangId_() + ' untuk ' + tanggal + ': hari libur' +
        (libur.keterangan ? ' (' + libur.keterangan + ')' : '') + (keDrive ? '; ' + keDrive + ' PDF disimpan ke Drive' : '') +
        (masalah.length ? '. Masalah: ' + masalah.join('; ') : '') + '.';
      if (/^Gagal/.test(String(bacaKonfigurasi_().nilai.laporan_terakhir || ''))) {
        console.log(teks + ' laporan_terakhir tidak diganti karena berisi kegagalan sebelumnya.');
      } else {
        catatStatusSistem_('laporan_terakhir', teks, KETERANGAN_LAPORAN_TERAKHIR);
      }
      console.log('Laporan harian ' + tanggal + ' dilewati: hari libur.');
      return hasil;
    }

    var konf = bacaKonfigurasi_().nilai;
    var cadangan = String(konf.cadangan_terakhir || '');
    var data = {
      outlet: namaOutlet_() || 'Outlet',
      tanggal: tanggal,
      libur: libur,
      form: form,
      stock: ringkasStockHari_(tanggal),
      waste: ringkasWasteHari_(tanggal),
      suhu: ringkasSuhuHari_(tanggal),
      prep: ringkasPrepHari_(tanggal),
      masaSimpan: masaSimpan_(tanggal),
      pemeriksaan: ringkasPemeriksaan_(),
      reset: bacaStaff_().daftar.filter(function (s) { return s.aktif && s.reset; }).map(function (s) { return s.nama; }),
      terkunci: akunTerkunci_(),
      opname: statusOpname_(),
      pesanan: pesananSiap_() ? pesananMenunggu_(bacaPesanan_()) : [],
      pdf: hasil.pdf,
      masalah: masalah,
      cadanganGagal: /^Gagal/.test(cadangan) ? cadangan : '',
      alamat: /^https:\/\//.test(String(konf.alamat_aplikasi || '')) ? String(konf.alamat_aplikasi) : ''
    };
    var penerima = bacaDaftarEmail_();
    hasil.penerima = penerima;
    if (!penerima.length) throw new Error('belum ada penerima email. Tambahkan di Pengaturan → Penerima email.');
    var sisa = MailApp.getRemainingDailyQuota();
    if (sisa < penerima.length) throw new Error('kuota email harian Gmail habis (sisa ' + sisa + ').');
    hasil.html = htmlEmailHarian_(data);
    MailApp.sendEmail({
      to: penerima.join(','),
      subject: (opsi.uji ? '[Uji] ' : '') + 'Laporan harian ' + data.outlet + ', ' + tanggalPanjangId_(tanggal),
      htmlBody: hasil.html,
      name: 'InventoryKu',
      attachments: hasil.pdf.map(function (p) { return p.blob; })
    });
    hasil.terkirim = true;
    catatStatusSistem_('laporan_terakhir', 'Terkirim ' + waktuSekarangId_() + ' untuk ' + tanggal + ' ke ' +
      penerima.length + ' penerima, ' + hasil.pdf.length + ' PDF' + (masalah.length ? '. Masalah: ' + masalah.join('; ') : '') + '.',
      KETERANGAN_LAPORAN_TERAKHIR);
  } catch (err) {
    console.error('Laporan harian gagal: ' + (err && err.stack ? err.stack : err));
    hasil.galat = err && err.message ? err.message : String(err);
    catatStatusSistem_('laporan_terakhir', 'Gagal ' + waktuSekarangId_() + ' untuk ' + tanggal + ': ' + hasil.galat,
      KETERANGAN_LAPORAN_TERAKHIR);
  }
  return hasil;
}

/**
 * Dijalankan trigger harian (dipasang pasangTrigger). Jika trigger terlambat
 * sampai lewat tengah malam, laporan tetap untuk hari kemarin.
 */
function kirimLaporanHarian() {
  if (sudahPindah_()) return console.log('Sudah pindah ke Supabase: laporan harian dikirim dari sana.');
  SS_ = null;
  var jam = Number(Utilities.formatDate(new Date(), zonaWaktu_(), 'H'));
  var tanggal = jam < 6 ? geserTanggal_(hariIni_(), -1) : hariIni_();
  return jalankanLaporanHarian_({ tanggal: tanggal });
}

/**
 * Jalankan dari editor Apps Script untuk menguji email dan PDF tanpa
 * menunggu malam. Memakai data hari ini; subjek email diawali "[Uji]".
 * Hasilnya tertulis di log eksekusi.
 */
function kirimLaporanSekarang() {
  if (sudahPindah_()) return teruskanKeSupabase_('kirimLaporanSekarang');
  var h = jalankanLaporanHarian_({ tanggal: null, uji: true });
  console.log(h.terkirim
    ? 'Email terkirim ke ' + h.penerima.join(', ') + ' dengan ' + h.pdf.length + ' PDF (' +
      h.pdf.map(function (p) { return p.namaFile; }).join(', ') + ').'
    : 'Email gagal: ' + h.galat + '. Lihat baris laporan_terakhir di M_Konfigurasi.');
}

/* ---------- Cadangan mingguan (Bagian 9.4) ---------- */

/**
 * Menyalin seluruh spreadsheet ke Laporan Kitchen/Cadangan/ dengan tanggal di
 * namanya, menyimpan 4 salinan terakhir, dan membuang yang lebih lama ke
 * tempat sampah Drive. Hasil dicatat di M_Konfigurasi (cadangan_terakhir);
 * kegagalan disebut di email harian berikutnya.
 */
function buatCadangan() {
  if (sudahPindah_()) return console.log('Sudah pindah ke Supabase: cadangan dibuat dari sana.');
  SS_ = null;
  var ket = 'Diisi otomatis oleh cadangan mingguan. Baris yang diawali "Gagal" disebut di email harian dan Beranda Pengelola.';
  try {
    var ss = ss_();
    var folder = folderCadangan_();
    var awalan = 'Cadangan ' + ss.getName() + ' ';
    var nama = awalan + Utilities.formatDate(new Date(), zonaWaktu_(), 'yyyy-MM-dd HHmm');
    if (DI_SUPABASE_) {
      // Di Supabase: isi semua tab sebagai satu berkas JSON (disalin ke Drive bersama berkas lain).
      folder.createFile(Utilities.newBlob(isiCadanganJson_(ss), 'application/json', nama + '.json'));
    } else {
      DriveApp.getFileById(ss.getId()).makeCopy(nama, folder);
    }
    var salinan = [];
    var it = folder.getFiles();
    while (it.hasNext()) {
      var f = it.next();
      if (f.getName().indexOf(awalan) === 0) salinan.push(f);
    }
    salinan.sort(function (a, b) { return b.getDateCreated().getTime() - a.getDateCreated().getTime(); });
    var buang = salinan.slice(JUMLAH_CADANGAN);
    buang.forEach(function (f) { f.setTrashed(true); });
    catatStatusSistem_('cadangan_terakhir', 'Berhasil ' + waktuSekarangId_() + ': ' + nama +
      (buang.length ? '. ' + buang.length + ' salinan lama dibuang.' : '.'), ket);
    console.log('Cadangan dibuat: ' + nama);
  } catch (err) {
    console.error('Cadangan gagal: ' + (err && err.stack ? err.stack : err));
    catatStatusSistem_('cadangan_terakhir', 'Gagal ' + waktuSekarangId_() + ': ' + (err && err.message ? err.message : err), ket);
  }
}

function folderCadangan_() {
  return cariAtauBuatFolder_(cariAtauBuatFolder_(DriveApp.getRootFolder(), FOLDER_LAPORAN), FOLDER_CADANGAN);
}

var FORMAT_CADANGAN = 2;

/**
 * Cadangan di Supabase (format 2, Code.gs v0.26): { jenis, format, dibuat, versiKode, nama, tab: [{ nama, meta: { id, beku },
 * nilai: [[...]] }] }, tanggal ditulis { $d: ms } seperti aksi pemilik. Format 1 (sebelum v0.26) tanpa jenis, format, dan
 * meta, tanggal ditulis teks ISO; keduanya bisa dipulihkan (pulihkanCadangan).
 */
function isiCadanganJson_(ss) {
  return JSON.stringify({
    jenis: 'cadangan-inventoryku',
    format: FORMAT_CADANGAN,
    dibuat: new Date().toISOString(),
    versiKode: VERSI_KODE,
    nama: ss.getName(),
    tab: ss.getSheets().map(function (sheet) {
      var nilai = sheet.getLastRow() ? sheet.getDataRange().getValues() : [];
      return {
        nama: sheet.getName(),
        meta: { id: sheet.getSheetId(), beku: sheet.getFrozenRows() },
        nilai: nilai.map(function (b) { return b.map(nilaiKeSupabase_); })
      };
    })
  });
}

var AWALAN_SEBELUM_PULIH = 'Cadangan sebelum pemulihan ';

/**
 * Di Supabase, dipanggil pulihkanCadangan dan ujiPemulihanCadangan (editor Apps Script) sesudah aplikasi ditutup dan
 * sebelum isi database ditimpa: isi sekarang disimpan sebagai cadangan tersendiri (tidak ikut dibuang cadangan
 * mingguan), supaya pemulihan bisa dibatalkan dengan memulihkan berkas ini.
 */
function buatCadanganSebelumPulih() {
  if (!DI_SUPABASE_) throw new Error('buatCadanganSebelumPulih dijalankan di Supabase lewat pulihkanCadangan.');
  var folder = folderCadangan_();
  var ada = {};
  var it = folder.getFiles();
  while (it.hasNext()) ada[it.next().getName()] = true;
  var dasar = AWALAN_SEBELUM_PULIH + Utilities.formatDate(new Date(), zonaWaktu_(), 'yyyy-MM-dd HHmmss');
  var nama = dasar + '.json';
  for (var n = 2; ada[nama]; n++) nama = dasar + ' (' + n + ').json'; // nama unik: berkas dipilih menurut namanya
  folder.createFile(Utilities.newBlob(isiCadanganJson_(ss_()), 'application/json', nama));
  console.log('Cadangan sebelum pemulihan dibuat: ' + nama + '.');
  return { nama: nama };
}

/* =========================================================================
 * Tahap 10: rekap bulanan PDF (spesifikasi sistem Bagian 9.3 dan 10,
 * tampilan Bagian 5.5). Dibuat otomatis tiap tanggal 1 untuk bulan
 * sebelumnya (kirimRekapBulanan, dipasang pasangTrigger), disimpan ke Drive,
 * dan dikirim ke penerima email. Pengelola juga bisa mengunduhnya dari menu
 * Laporan untuk bulan mana pun (aksi unduhPdfRekap).
 * ========================================================================= */

var JAM_REKAP = 7; // tanggal 1, pagi: isian closing hari terakhir bulan lalu sudah sempat masuk
var ITEM_TERATAS_REKAP = 10;

function bulanSah_(bulan) {
  return typeof bulan === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(bulan);
}

/** "2026-09" → "September 2026". */
function namaBulanId_(bulan) {
  var p = String(bulan).split('-');
  return BULAN_ID[Number(p[1]) - 1] + ' ' + p[0];
}

/** Bulan sebelum bulan tanggal itu: "2026-10-01" → "2026-09". */
function bulanLalu_(tanggal) {
  return geserTanggal_(String(tanggal).slice(0, 8) + '01', -1).slice(0, 7);
}

/** Tanggal terakhir satu bulan: "2026-02" → "2026-02-28". */
function akhirBulan_(bulan) {
  var p = String(bulan).split('-');
  return new Date(Date.UTC(Number(p[0]), Number(p[1]), 0)).toISOString().slice(0, 10);
}

/**
 * Data rekap satu bulan (Bagian 9.3), dihitung dari tab Data, Stock_Harian,
 * dan master. Tiap tab dibaca sekali. Bulan berjalan: data sampai hari ini;
 * kelengkapan form dan pengecekan suhu terlewat dinilai sampai kemarin
 * (hari ini belum selesai). Kelengkapan dinilai mulai isian pertama di
 * aplikasi, supaya hari sebelum aplikasi dipakai tidak dihitung tidak lengkap.
 * Nilai rupiah stock memakai riwayat harga (Bagian 8.5): gerakan tiap hari ×
 * harga yang berlaku hari itu, nilai stock akhir bulan × harga pada tanggal
 * itu, dan selisih karena perubahan harga per kategori. Karena itu angka bulan
 * yang sudah lewat hanya berubah jika riwayat harganya diubah untuk tanggal di
 * bulan itu. Nilai selisih opname dan estimasi waste memakai nilai yang
 * tercatat saat itu.
 */
function dataRekapBulan_(bulan) {
  if (!bulanSah_(bulan)) throw galatPengguna_('Bulan tidak terbaca. Pilih bulan lagi.');
  var hari = hariIni_();
  var dari = bulan + '-01';
  var akhirBulan = akhirBulan_(bulan);
  if (dari > hari) throw galatPengguna_('Bulan ' + namaBulanId_(bulan) + ' belum dimulai. Pilih bulan lain.');
  var berjalan = akhirBulan >= hari;
  var sampai = berjalan ? hari : akhirBulan;
  var akhirNilai = berjalan ? geserTanggal_(hari, -1) : akhirBulan;
  var zona = zonaSheet_();
  var memo = {};
  function tabel(nama) {
    if (!Object.prototype.hasOwnProperty.call(memo, nama)) memo[nama] = bacaTabel_(nama);
    return memo[nama];
  }
  /** Tanggal baris jika jatuh di bulan itu (sampai hari ini), selain itu ''. */
  function dalam(t, b) {
    var tg = teksTanggal_(nilai_(t, b, 'Tanggal'), zona);
    return tg && tg >= dari && tg <= sampai ? tg : '';
  }
  var adaIsian = false;
  var hasil = {
    bulan: bulan, nama: namaBulanId_(bulan), dari: dari, sampai: sampai, akhirBulan: akhirBulan,
    berjalan: berjalan, akhirNilai: akhirNilai
  };

  /* ---------- Stock: masuk, bahan terpakai, penyesuaian per kategori; nilai stock akhir bulan ---------- */
  var master = bacaItem_();
  var rekap = bacaRekap_();
  var resep = bacaResep_();
  var urutKat = {};
  var namaKat = {};
  bacaSemuaKategori_().forEach(function (k, i) {
    urutKat[k.nama.toLowerCase()] = i;
    namaKat[k.nama.toLowerCase()] = k.nama;
  });
  var grupKat = {};
  function grup(kategori) {
    var nama = namaKat[String(kategori).toLowerCase()] || kategori || 'Tanpa kategori';
    var k = nama.toLowerCase();
    return grupKat[k] = grupKat[k] || { kategori: nama, item: 0, masuk: 0, terpakai: 0, penyesuaian: 0, selisihHarga: 0,
      nilaiAkhir: 0, adaHarga: false, adaAkhir: false, adaSelisih: false };
  }
  var tanpaHarga = [];
  var bergerak = 0;
  Object.keys(rekap.item).forEach(function (k) {
    var m = master[k];
    if (!m) return;
    var ada = false;
    var x = null;
    // Nilai bahan terpakai hanya untuk item yang bukan hasil resep (Bagian 8.5).
    var bahan = !(resep[k] && resep[k].aktif);
    rekap.item[k].forEach(function (r) {
      if (r.tanggal < dari || r.tanggal > sampai) return;
      if (!ada) {
        ada = true;
        x = grup(m.kategori);
        x.item++;
      }
      // Gerakan hari itu × harga yang berlaku hari itu (Bagian 8.5).
      var harga = hargaPada_(m, r.tanggal);
      if (harga == null) {
        if (tanpaHarga.indexOf(m.nama) < 0) tanpaHarga.push(m.nama);
        return;
      }
      x.adaHarga = true;
      x.masuk += r.masuk * harga;
      if (bahan) x.terpakai += (r.keluar + r.dipakaiPrep) * harga;
      x.penyesuaian += r.penyesuaian * harga;
    });
    if (!ada) return;
    adaIsian = true;
    bergerak++;
  });
  // Selisih karena perubahan harga yang berlaku mulai tanggal di bulan ini (Bagian 8.5).
  var selisih = selisihHarga_(master, rekap, dari, sampai);
  selisih.item.forEach(function (s) {
    var x = grup(s.kategori);
    x.selisihHarga += s.selisih;
    x.adaSelisih = true;
  });
  var nilai = nilaiStock_(master, rekap, sampai);
  nilai.perKategori.forEach(function (n) {
    var x = grup(n.kategori);
    x.nilaiAkhir = n.nilai;
    x.adaAkhir = true;
  });
  nilai.tanpaHarga.forEach(function (n) {
    if (n.stock && tanpaHarga.indexOf(n.nama) < 0) tanpaHarga.push(n.nama);
  });
  var posisiKat = function (nama) {
    var u = urutKat[nama.toLowerCase()];
    return u == null ? 1e6 : u;
  };
  var total = { item: 0, masuk: 0, terpakai: 0, penyesuaian: 0, selisihHarga: selisih.total, nilaiAkhir: nilai.total };
  var daftarKat = Object.keys(grupKat).map(function (k) { return grupKat[k]; }).filter(function (x) {
    return x.item || x.nilaiAkhir || x.adaSelisih;
  }).sort(function (a, b) {
    return posisiKat(a.kategori) - posisiKat(b.kategori) || a.kategori.localeCompare(b.kategori, 'id');
  });
  daftarKat.forEach(function (x) {
    ['masuk', 'terpakai', 'penyesuaian'].forEach(function (j) {
      x[j] = Math.round(x[j]);
      total[j] += x[j];
    });
    total.item += x.item;
    // Kategori yang semua itemnya belum punya harga: nilainya kosong (–), bukan Rp 0.
    if (!x.adaHarga) x.masuk = x.terpakai = x.penyesuaian = null;
    if (!x.adaAkhir) x.nilaiAkhir = null;
    x.selisihHarga = x.adaSelisih ? Math.round(x.selisihHarga) : null;
    delete x.adaHarga;
    delete x.adaAkhir;
    delete x.adaSelisih;
  });
  tanpaHarga.sort(function (a, b) { return a.localeCompare(b, 'id'); });
  hasil.stock = { kategori: daftarKat, total: total, bergerak: bergerak, tanpaHarga: tanpaHarga,
    perubahanHarga: selisih.item.length };

  /* ---------- Stock opname: tiap opname dan nilai selisihnya; item paling sering berselisih ---------- */
  var opname = {};
  var daftarOpname = [];
  var itemOpname = {};
  var tOp = tabel('Data_Opname');
  if (tOp) {
    tOp.baris.forEach(function (b) {
      var tg = dalam(tOp, b);
      var sid = String(nilai_(tOp, b, 'submission_id') || '');
      var nama = rapikanTeks_(nilai_(tOp, b, 'Nama Item'));
      if (!tg || !sid || !nama) return;
      adaIsian = true;
      var o = opname[sid];
      if (!o) {
        var w = nilai_(tOp, b, 'timestamp_server');
        o = opname[sid] = { tanggal: tg, oleh: rapikanTeks_(nilai_(tOp, b, 'submitted_by')), ms: w instanceof Date ? w.getTime() : 0,
          jumlah: 0, berselisih: 0, nilai: 0, tanpaHarga: 0 };
        daftarOpname.push(o);
      }
      var selisih = Number(nilai_(tOp, b, 'Selisih')) || 0;
      var rp = angkaAtauNull_(nilai_(tOp, b, 'Nilai Selisih (Rp)'));
      o.jumlah++;
      if (!selisih) return;
      o.berselisih++;
      if (rp == null) o.tanpaHarga++;
      o.nilai += rp || 0;
      var k = nama.toLowerCase();
      var it = itemOpname[k] = itemOpname[k] || { item: nama, satuan: rapikanTeks_(nilai_(tOp, b, 'Satuan')), kali: 0, selisih: 0,
        nilai: 0, adaNilai: false };
      it.kali++;
      it.selisih = bulat_(it.selisih + selisih);
      if (rp != null) {
        it.nilai += rp;
        it.adaNilai = true;
      }
    });
  }
  daftarOpname.sort(function (a, b) { return a.tanggal < b.tanggal ? -1 : (a.tanggal > b.tanggal ? 1 : a.ms - b.ms); });
  var totalOpname = 0;
  daftarOpname.forEach(function (o) {
    o.nilai = Math.round(o.nilai);
    totalOpname += o.nilai;
    delete o.ms;
  });
  var itemSelisih = Object.keys(itemOpname).map(function (k) { return itemOpname[k]; }).sort(function (a, b) {
    return b.kali - a.kali || Math.abs(b.nilai) - Math.abs(a.nilai) || a.item.localeCompare(b.item, 'id');
  }).slice(0, ITEM_TERATAS_REKAP);
  itemSelisih.forEach(function (x) {
    x.nilai = x.adaNilai ? Math.round(x.nilai) : null;
    delete x.adaNilai;
  });
  hasil.opname = { daftar: daftarOpname, totalNilai: totalOpname, item: itemSelisih };

  /* ---------- Waste: jumlah catatan dan nilai per kategori waste; 10 item dengan nilai terbesar ---------- */
  var perKatWaste = {};
  KATEGORI_WASTE.forEach(function (k) { perKatWaste[k.toLowerCase()] = { kategori: k, catatan: 0, nilai: 0, tanpaHarga: 0 }; });
  var itemWaste = {};
  var totalWaste = { catatan: 0, nilai: 0, tanpaHarga: 0 };
  var tW = tabel('Data_Waste');
  if (tW) {
    tW.baris.forEach(function (b) {
      var tg = dalam(tW, b);
      var nama = rapikanTeks_(nilai_(tW, b, 'Item / Produk'));
      if (!tg || !nama) return;
      adaIsian = true;
      var kat = rapikanTeks_(nilai_(tW, b, 'Kategori Waste')) || 'Lainnya';
      var x = perKatWaste[kat.toLowerCase()] = perKatWaste[kat.toLowerCase()] || { kategori: kat, catatan: 0, nilai: 0, tanpaHarga: 0 };
      var rp = angkaAtauNull_(nilai_(tW, b, 'Estimasi Kerugian (Rp)'));
      var k = nama.toLowerCase();
      var it = itemWaste[k] = itemWaste[k] || { item: nama, satuan: rapikanTeks_(nilai_(tW, b, 'Satuan')), qty: 0, catatan: 0, nilai: 0,
        adaNilai: false };
      it.qty = bulat_(it.qty + (Number(nilai_(tW, b, 'Qty')) || 0));
      it.catatan++;
      x.catatan++;
      totalWaste.catatan++;
      if (rp == null) {
        x.tanpaHarga++;
        totalWaste.tanpaHarga++;
        return;
      }
      it.nilai += rp;
      it.adaNilai = true;
      x.nilai += rp;
      totalWaste.nilai += rp;
    });
  }
  var katWaste = Object.keys(perKatWaste).map(function (k) { return perKatWaste[k]; });
  katWaste.forEach(function (x) { x.nilai = Math.round(x.nilai); });
  totalWaste.nilai = Math.round(totalWaste.nilai);
  // Item tanpa harga tidak punya nilai: diurutkan sesudah item yang punya nilai.
  var itemWasteTeratas = Object.keys(itemWaste).map(function (k) { return itemWaste[k]; }).sort(function (a, b) {
    if (a.adaNilai !== b.adaNilai) return a.adaNilai ? -1 : 1;
    return b.nilai - a.nilai || b.catatan - a.catatan || a.item.localeCompare(b.item, 'id');
  }).slice(0, ITEM_TERATAS_REKAP);
  itemWasteTeratas.forEach(function (x) {
    x.nilai = x.adaNilai ? Math.round(x.nilai) : null;
    delete x.adaNilai;
  });
  hasil.waste = { kategori: katWaste, total: totalWaste, item: itemWasteTeratas, jumlahItem: Object.keys(itemWaste).length };

  /* ---------- Prep: total resep dan hasil per item ---------- */
  var itemPrep = {};
  var catatanPrep = 0;
  var aktualPrep = { catatan: 0, aktual: 0, standar: 0 };
  var tP = tabel('Data_Prep');
  if (tP) {
    tP.baris.forEach(function (b) {
      var tg = dalam(tP, b);
      var nama = rapikanTeks_(nilai_(tP, b, 'Item / Menu Prep'));
      if (!tg || !nama) return;
      adaIsian = true;
      catatanPrep++;
      var beresep = nilai_(tP, b, 'Hasil per 1 Resep') !== '' && nilai_(tP, b, 'Hasil per 1 Resep') != null;
      var k = nama.toLowerCase();
      var it = itemPrep[k] = itemPrep[k] || { item: nama, satuan: rapikanTeks_(nilai_(tP, b, 'Satuan')), catatan: 0, resep: null, hasil: 0,
        standar: null, aktual: 0 };
      it.catatan++;
      if (beresep) {
        var jr = Number(nilai_(tP, b, 'Jumlah Resep')) || 0;
        it.resep = bulat_((it.resep || 0) + jr);
        it.standar = bulat_((it.standar || 0) + jr * (Number(nilai_(tP, b, 'Hasil per 1 Resep')) || 0));
        // Hasil aktual (Code.gs v0.24): dibandingkan dengan standar hanya pada catatan yang mengisinya.
        var akt = angkaAtauNull_(nilai_(tP, b, 'Hasil Aktual'));
        if (akt != null) {
          it.aktual++;
          aktualPrep.catatan++;
          aktualPrep.aktual = bulat_(aktualPrep.aktual + akt);
          aktualPrep.standar = bulat_(aktualPrep.standar + jr * (Number(nilai_(tP, b, 'Hasil per 1 Resep')) || 0));
        }
      }
      it.hasil = bulat_(it.hasil + (Number(nilai_(tP, b, beresep ? 'Hasil' : 'Qty')) || 0));
    });
  }
  hasil.prep = {
    aktual: aktualPrep,
    catatan: catatanPrep,
    item: Object.keys(itemPrep).map(function (k) { return itemPrep[k]; }).sort(function (a, b) { return a.item.localeCompare(b.item, 'id'); })
  };

  /* ---------- Suhu: kejadian di luar standar per unit; pengecekan terlewat ---------- */
  var unitAktif = bacaUnit_().filter(function (u) { return u.aktif; });
  var perUnit = {};
  var daftarUnit = [];
  unitAktif.forEach(function (u) {
    perUnit[u.nama.toLowerCase()] = { unit: u.nama, tipe: u.tipe, aktif: true, cek: 0, luar: 0, terlewat: 0 };
    daftarUnit.push(perUnit[u.nama.toLowerCase()]);
  });
  var adaSuhu = {};
  var suhuPertama = '';
  var tS = tabel('Data_Suhu');
  if (tS) {
    tS.baris.forEach(function (b) {
      var tgSemua = teksTanggal_(nilai_(tS, b, 'Tanggal'), zona);
      var nama = rapikanTeks_(nilai_(tS, b, 'Nama Unit'));
      if (!tgSemua || !nama) return;
      if (!suhuPertama || tgSemua < suhuPertama) suhuPertama = tgSemua;
      adaSuhu[tgSemua + '|' + nama.toLowerCase() + '|' + rapikanTeks_(nilai_(tS, b, 'Waktu Cek')).toLowerCase()] = true;
      if (!dalam(tS, b)) return;
      adaIsian = true;
      var u = perUnit[nama.toLowerCase()];
      if (!u) {
        u = perUnit[nama.toLowerCase()] = { unit: nama, tipe: rapikanTeks_(nilai_(tS, b, 'Tipe Unit')).toLowerCase() === 'freezer' ? 'Freezer' : 'Chiller',
          aktif: false, cek: 0, luar: 0, terlewat: null };
        daftarUnit.push(u);
      }
      u.cek++;
      if (rapikanTeks_(nilai_(tS, b, 'Status Suhu')) === STATUS_SUHU_LUAR) u.luar++;
    });
  }
  // Pengecekan terlewat (seperti Riwayat Suhu): unit aktif sekarang × Opening/Middle/Closing,
  // sejak isian Suhu pertama, sampai kemarin untuk bulan berjalan.
  var terlewat = [];
  var jumlahTerlewat = 0;
  var suhuLibur = [];
  if (suhuPertama) {
    for (var tg = dari < suhuPertama ? suhuPertama : dari; tg <= akhirNilai; tg = geserTanggal_(tg, 1)) {
      // Hari libur (Code.gs v0.30): tidak ada pengecekan yang terlewat; tanggalnya disebut di catatan PDF.
      if (liburPada_(tg)) {
        suhuLibur.push(tg);
        continue;
      }
      var kurang = [];
      unitAktif.forEach(function (u) {
        ['Opening', 'Middle', 'Closing'].forEach(function (w) {
          if (adaSuhu[tg + '|' + u.nama.toLowerCase() + '|' + w.toLowerCase()]) return;
          kurang.push(u.nama + ' ' + w);
          perUnit[u.nama.toLowerCase()].terlewat++;
        });
      });
      if (kurang.length) {
        terlewat.push({ tanggal: tg, kurang: kurang, total: unitAktif.length * 3 });
        jumlahTerlewat += kurang.length;
      }
    }
  }
  hasil.suhu = {
    unit: daftarUnit,
    cek: daftarUnit.reduce(function (n, u) { return n + u.cek; }, 0),
    luar: daftarUnit.reduce(function (n, u) { return n + u.luar; }, 0),
    terlewat: terlewat,
    jumlahTerlewat: jumlahTerlewat,
    libur: suhuLibur,
    mulai: suhuPertama
  };

  /* ---------- Kepatuhan: hari tiap form tidak lengkap (Bagian 5.8); isian belum diperiksa; laporan kekeliruan ---------- */
  var pertama = suhuPertama;
  var nihil = {};
  var tN = tabel('Data_Nihil');
  if (tN) {
    tN.baris.forEach(function (b) {
      var tg = teksTanggal_(nilai_(tN, b, 'Tanggal'), zona);
      if (!tg) return;
      if (!pertama || tg < pertama) pertama = tg;
      nihil[tg + '|' + rapikanTeks_(nilai_(tN, b, 'ID Form')).toUpperCase()] = true;
      if (tg >= dari && tg <= sampai) adaIsian = true;
    });
  }
  var formKepatuhan = bacaDaftarForm_().map(function (f) {
    var x = { id: f.id, nama: f.nama, tampil: f.aktif, jadwal: f.jadwal, ditagih: 0, tidakLengkap: [], kiriman: 0, belumDiperiksa: 0,
      dilaporkan: 0, _f: f, _tanggal: {}, _liburDitagih: 0 };
    var t = f.id === 'SUHU' ? tS : tabel(tabDataForm_(f.id));
    if (!t) return x;
    var sid = {};
    t.baris.forEach(function (b) {
      var tg = teksTanggal_(nilai_(t, b, 'Tanggal'), zona);
      var id = String(nilai_(t, b, 'submission_id') || '');
      if (!tg || !id) return;
      if (!pertama || tg < pertama) pertama = tg;
      x._tanggal[tg] = true;
      if (tg < dari || tg > sampai) return;
      adaIsian = true;
      if (!sid[id]) {
        sid[id] = { belum: false };
        x.kiriman++;
      }
      if (rapikanTeks_(nilai_(t, b, 'status')) !== STATUS_DIPERIKSA && !sid[id].belum) {
        sid[id].belum = true;
        x.belumDiperiksa++;
      }
      if (rapikanTeks_(nilai_(t, b, 'flagged_by'))) x.dilaporkan++;
    });
    return x;
  });
  function suhuLengkap(tg) {
    return unitAktif.length > 0 && unitAktif.every(function (u) {
      return WAKTU_CEK_WAJIB.every(function (w) { return adaSuhu[tg + '|' + u.nama.toLowerCase() + '|' + w]; });
    });
  }
  var mulaiNilai = pertama && pertama > dari ? pertama : dari;
  var hariDinilai = 0;
  var liburDinilai = [];
  if (pertama) {
    for (var d = mulaiNilai; d <= akhirNilai; d = geserTanggal_(d, 1)) {
      hariDinilai++;
      var libur = !!liburPada_(d);
      if (libur) liburDinilai.push(d); // wajibPada_ false untuk semua form pada hari libur
      formKepatuhan.forEach(function (x) {
        if (libur && wajibMenurutJadwal_(x._f, d)) x._liburDitagih++;
        if (!wajibPada_(x._f, d)) return;
        x.ditagih++;
        var lengkap = x.id === 'SUHU' ? suhuLengkap(d) : (x._tanggal[d] || nihil[d + '|' + x.id]);
        if (!lengkap) x.tidakLengkap.push(d);
      });
    }
  }
  var totalKepatuhan = { kiriman: 0, belumDiperiksa: 0, dilaporkan: 0, hariTidakLengkap: 0 };
  formKepatuhan.forEach(function (x) {
    // Hari yang ditagih menurut jadwal tetapi libur: "Hari libur, tidak ditagih" di PDF jika tidak ada hari lain yang ditagih.
    if (x._liburDitagih) x.liburDitagih = x._liburDitagih;
    delete x._liburDitagih;
    delete x._f;
    delete x._tanggal;
    totalKepatuhan.kiriman += x.kiriman;
    totalKepatuhan.belumDiperiksa += x.belumDiperiksa;
    totalKepatuhan.dilaporkan += x.dilaporkan;
    totalKepatuhan.hariTidakLengkap += x.tidakLengkap.length;
  });
  hasil.kepatuhan = {
    form: formKepatuhan,
    total: totalKepatuhan,
    hariDinilai: hariDinilai,
    libur: liburDinilai,
    mulai: pertama && hariDinilai ? mulaiNilai : '',
    akhir: akhirNilai
  };
  // Penyesuaian stock ikut menandai bulan yang punya isian.
  var tSesuai = tabel('Data_Penyesuaian');
  if (!adaIsian && tSesuai) adaIsian = tSesuai.baris.some(function (b) { return !!dalam(tSesuai, b); });
  hasil.adaIsian = adaIsian;

  /* ---------- HPP dan food cost (Bagian 5.9): pemakaian bahan, penjualan, menu di atas target ---------- */
  var konf = bacaKonfigurasi_().nilai;
  var ctxHpp = { master: master, rekap: rekap, resep: resep, urutKat: urutKat, namaKat: namaKat, pembuka: stokPembuka_(),
    waste: nilaiWasteTercatat_(), jual: bacaPenjualan_(), hari: hari, porsi: bacaPenjualanMenu_(), menu: bacaMenu_(),
    kecilPersen: bahanKecilPersen_(konf) };
  var fcb = foodCostBulan_(ctxHpp, bulan);
  var menuHpp = hppSemuaMenu_(fcb.rentang.berjalan ? hari : akhirBulan, true, konf);
  hasil.hpp = {
    dari: fcb.rentang.dari, sampai: fcb.rentang.sampai, target: targetFoodCost_(konf), pemakaian: fcb.pemakaian,
    penjualan: fcb.penjualan, foodCost: fcb.foodCost, jumlahMenu: menuHpp.length,
    menuDiAtas: menuHpp.filter(function (m) { return m.diAtasTarget; }).sort(urutMenuFoodCost_),
    teoritis: bandingTeoritis_(ctxHpp, fcb.rentang, fcb.pemakaian, fcb.penjualan)
  };

  /* ---------- Pembelian per pemasok (Code.gs v0.23): stock masuk × harga beli yang dicatat ---------- */
  hasil.pembelian = ringkasPembelian_(pembelianSiap_() ? bacaPembelian_(dari, sampai) : []);
  return hasil;
}

/** "1–30 September 2026" atau "1–6 Oktober 2026 (bulan berjalan)". */
function teksPeriodeRekap_(d) {
  var p = d.sampai.split('-');
  return '1–' + Number(p[2]) + ' ' + BULAN_ID[Number(p[1]) - 1] + ' ' + p[0] + (d.berjalan ? ' (bulan berjalan)' : '');
}

/** Seperti teksHariBulan_, tetapi lebih dari 8 tanggal ditulis "antara lain …" (daftar hari libur di rekap). */
function teksHariBulanSingkat_(tanggal) {
  return tanggal.length > 8 ? 'antara lain ' + teksHariBulan_(tanggal.slice(0, 8)) : teksHariBulan_(tanggal);
}

/** "3, 7, dan 12" (atau "5 dan 20") dari tanggal-tanggal satu bulan. */
function teksHariBulan_(tanggal) {
  var n = tanggal.map(function (t) { return String(Number(t.slice(8, 10))); });
  if (n.length < 2) return n.join('');
  if (n.length === 2) return n[0] + ' dan ' + n[1];
  return n.slice(0, -1).join(', ') + ', dan ' + n[n.length - 1];
}

/**
 * Tabel sederhana untuk rekap: kolom [{ judul, lebar (%), angka }], baris
 * [[html sel]] (sel boleh { html, kelas }), total (baris tebal di bawah,
 * opsional), kosong (teks jika tidak ada baris).
 */
function tabelRekap_(kolom, baris, total, kosong) {
  var sel = function (isi, i, tag) {
    var o = isi && typeof isi === 'object' ? isi : { html: isi };
    var kelas = [kolom[i] && kolom[i].angka ? 'angka' : '', o.kelas || ''].join(' ').trim();
    return '<' + tag + (kelas ? ' class="' + kelas + '"' : '') + '>' + (o.html == null ? '' : o.html) + '</' + tag + '>';
  };
  var html = '<table class="data"><colgroup>' + kolom.map(function (k) {
    return '<col style="width:' + k.lebar + '%">';
  }).join('') + '</colgroup><thead><tr>' + kolom.map(function (k) { return '<th>' + escHtml_(k.judul) + '</th>'; }).join('') +
    '</tr></thead><tbody>';
  if (!baris.length) {
    html += '<tr><td colspan="' + kolom.length + '">' + escHtml_(kosong || '') + '</td></tr>';
  } else {
    html += baris.map(function (b) { return '<tr>' + b.map(function (c, i) { return sel(c, i, 'td'); }).join('') + '</tr>'; }).join('');
    if (total) html += '<tr class="total">' + total.map(function (c, i) { return sel(c, i, 'td'); }).join('') + '</tr>';
  }
  return html + '</tbody></table>';
}

/** Bagian "HPP dan food cost" di rekap bulanan (Bagian 9.3 dan 5.9). */
function isiPdfRekapHpp_(h) {
  var e = escHtml_;
  var html = '<h2>HPP dan food cost</h2>';
  if (h.sampai < h.dari) {
    return html + '<p class="isi">Belum ada hari yang dinilai: hari pertama bulan ini belum selesai.</p>';
  }
  var p = h.pemakaian;
  var j = h.penjualan;
  var nLibur = (j.libur || []).length;
  var teksJual = j.hari + ' dari ' + j.jumlahHari + ' hari tercatat' + (nLibur ? ', ' + nLibur + ' hari libur' : '');
  html += tabelRekap_([{ judul: 'Uraian', lebar: 70 }, { judul: 'Nilai (Rp)', lebar: 30, angka: true }], [
    ['Bahan terpakai (keluar dan prep)', rupiahId_(p.terpakai)],
    ['Waste bahan', rupiahId_(p.waste)],
    ['Selisih stock (opname dan penyesuaian)', rupiahId_(p.selisihStock)],
    [{ html: '<b>Pemakaian bahan</b>' }, { html: '<b>' + rupiahId_(p.total) + '</b>' }],
    ['Penjualan (' + teksJual + ')', j.hari ? rupiahId_(j.total) : '–']
  ], [e('Food cost (target ' + persenId_(h.target) + ')'),
    { html: h.foodCost == null ? '–' : persenId_(h.foodCost) + (h.foodCost > h.target ? ' *' : ''),
      kelas: h.foodCost != null && h.foodCost > h.target ? 'akhir' : '' }], '');
  var catatanHpp = ['Pemakaian bahan = jumlah per hari × harga yang berlaku pada hari itu, hanya bahan mentah (barang jadi terhitung ' +
    'saat bahannya dipakai prep). Selisih stock: stock yang hilang menurut opname dan penyesuaian menambah pemakaian. Food cost = ' +
    'pemakaian bahan ÷ penjualan (sebelum pajak dan service).'];
  if (h.foodCost != null && h.foodCost > h.target) catatanHpp.push('* Di atas target.');
  if (h.foodCost == null && j.kurang.length) {
    catatanHpp.push('Food cost tidak dihitung: penjualan belum dicatat untuk ' + j.kurang.length + ' hari (' +
      (j.kurang.length > 8 ? 'antara lain ' + teksHariBulan_(j.kurang.slice(0, 8)) : teksHariBulan_(j.kurang)) + ').');
  }
  if (h.foodCost == null && !j.kurang.length && !j.jumlahHari && nLibur) {
    catatanHpp.push('Food cost tidak dihitung: semua hari yang dinilai hari libur.');
  }
  if (nLibur) catatanHpp.push('Hari libur (' + teksHariBulanSingkat_(j.libur) + ') tidak perlu catatan penjualan; pemakaian bahan pada hari itu tetap dihitung.');
  if (p.wasteBarangJadi) catatanHpp.push('Waste barang jadi ' + rupiahId_(p.wasteBarangJadi) + ' tidak ditambahkan, karena bahannya sudah terhitung saat prep.');
  if (p.tanpaHarga.length) catatanHpp.push(p.tanpaHarga.length + ' bahan belum punya harga pada sebagian hari dan tidak ikut dihitung: ' + daftarNamaSingkat_(p.tanpaHarga) + '.');
  if (p.stokPembuka) catatanHpp.push('Stok pembuka ' + rupiahId_(p.stokPembuka) + ' tidak dihitung sebagai selisih stock.');
  html += catatanHpp.map(function (c) { return '<p class="catatan">' + e(c) + '</p>'; }).join('');
  if (p.perKategori.length) {
    html += '<h3>Pemakaian bahan per kategori</h3>' + tabelRekap_([
      { judul: 'Kategori', lebar: 50 }, { judul: 'Pemakaian (Rp)', lebar: 30, angka: true }, { judul: 'Bagian', lebar: 20, angka: true }
    ], p.perKategori.map(function (x) {
      return [e(x.kategori), rupiahId_(x.nilai), p.total ? persenId_(x.nilai / p.total * 100) : '–'];
    }), null, '');
  }
  html += isiPdfRekapTeoritis_(h.teoritis, h.penjualan);
  html += '<h3>Menu di atas target</h3>' + tabelRekap_([
    { judul: 'Menu', lebar: 46 }, { judul: 'Harga jual (Rp)', lebar: 18, angka: true }, { judul: 'HPP (Rp)', lebar: 18, angka: true },
    { judul: 'Food cost', lebar: 18, angka: true }
  ], h.menuDiAtas.map(function (m) {
    return [e(m.nama), rupiahId_(m.hargaJual), rupiahId_(m.hpp), persenId_(m.foodCost)];
  }), null, h.jumlahMenu ? 'Semua menu aktif di bawah atau sama dengan target.' : 'Belum ada menu di Pengaturan → Menu.');
  if (h.menuDiAtas.length) {
    html += '<p class="catatan">' + e('HPP per porsi memakai harga bahan pada ' + tanggalSedangId_(h.sampai > h.dari ? h.sampai : h.dari) +
      ', termasuk bahan kecil.') + '</p>';
  }
  return html;
}

/** Bagian "Seharusnya vs nyata" di rekap bulanan: pemakaian dari porsi terjual dibanding pemakaian nyata, dan selisih per bahan. */
function isiPdfRekapTeoritis_(t, jual) {
  var e = escHtml_;
  if (!t || !t.pernah) return '';
  var html = '<h3>Pemakaian seharusnya (dari porsi terjual) dan nyata</h3>';
  if (!t.lengkap) {
    return html + '<p class="catatan">' + e('Belum dibandingkan: porsi per menu belum dicatat untuk ' + t.kurang.length + ' hari (' +
      (t.kurang.length > 8 ? 'antara lain ' + teksHariBulan_(t.kurang.slice(0, 8)) : teksHariBulan_(t.kurang)) + ').') + '</p>';
  }
  var tanda = function (n) { return (n > 0 ? '+' : '') + rupiahId_(n); };
  html += tabelRekap_([{ judul: 'Uraian', lebar: 46 }, { judul: 'Seharusnya (Rp)', lebar: 18, angka: true },
    { judul: 'Nyata (Rp)', lebar: 18, angka: true }, { judul: 'Selisih (Rp)', lebar: 18, angka: true }], [
    ['Bahan menu (' + t.porsi + ' porsi terjual)', rupiahId_(t.bahanMenu.seharusnya), rupiahId_(t.bahanMenu.nyata), tanda(t.bahanMenu.nyata - t.bahanMenu.seharusnya)],
    ['Bahan lain (seharusnya: bahan kecil ' + persenId_(t.kecilPersen) + ')', rupiahId_(t.bahanLain.seharusnya), rupiahId_(t.bahanLain.nyata), tanda(t.bahanLain.nyata - t.bahanLain.seharusnya)]
  ], [{ html: '<b>Pemakaian bahan</b>' }, { html: '<b>' + rupiahId_(t.seharusnya.total) + '</b>' }, { html: '<b>' + rupiahId_(t.nyata) + '</b>' },
    { html: '<b>' + tanda(t.selisih) + (t.selisihPersen != null ? ' (' + (t.selisihPersen > 0 ? '+' : '') + persenId_(t.selisihPersen) + ')' : '') + '</b>' }], '');
  var catatan = ['Seharusnya = porsi terjual tiap hari × bahan per porsi (takaran bersih ÷ hasil bersih; barang jadi dipecah menjadi bahan ' +
    'resepnya) × harga hari itu, ditambah bahan kecil. Selisih plus: bahan terpakai lebih banyak dari porsi yang terjual (bocor, porsi ' +
    'berlebih, waste, atau pencatatan keliru). Barang jadi yang belum terjual di akhir bulan ikut menambah selisih.'];
  if (t.foodCostSeharusnya != null) catatan.push('Food cost seharusnya ' + persenId_(t.foodCostSeharusnya) + '.');
  if (t.tanpaHarga.length) catatan.push('Belum punya harga pada sebagian hari: ' + daftarNamaSingkat_(t.tanpaHarga) + '.');
  if (t.menuTakDikenal.length) catatan.push('Porsi menu yang tidak ada lagi di daftar menu tidak dihitung: ' + daftarNamaSingkat_(t.menuTakDikenal) + '.');
  if (t.tidakBisa.length) catatan.push('Resep barang jadi yang tidak bisa dipecah (hasil kosong atau tanpa bahan): ' + daftarNamaSingkat_(t.tidakBisa) + '.');
  html += catatan.map(function (c) { return '<p class="catatan">' + e(c) + '</p>'; }).join('');
  if (t.item.length) {
    html += tabelRekap_([{ judul: 'Bahan', lebar: 28 }, { judul: 'Seharusnya', lebar: 15, angka: true }, { judul: 'Nyata', lebar: 15, angka: true },
      { judul: 'Selisih', lebar: 15, angka: true }, { judul: 'Satuan', lebar: 10 }, { judul: 'Selisih (Rp)', lebar: 17, angka: true }],
    t.item.map(function (x) {
      return [e(x.nama), angkaId_(x.seharusnya), angkaId_(x.nyata), (x.selisih > 0 ? '+' : '') + angkaId_(x.selisih), e(x.satuan), tanda(x.selisihRp)];
    }), null, '');
  }
  return html;
}

/** Isi HTML rekap bulanan (semua bagian Bagian 9.3), untuk htmlLaporan_. */
function isiPdfRekap_(d) {
  var e = escHtml_;
  var rp = function (n) { return n == null ? '–' : rupiahId_(n); };
  var html = '';
  var catatan = function (teks) { return '<p class="catatan">' + e(teks) + '</p>'; };

  // Stock
  var s = d.stock;
  var rpTanda = function (n) { return n == null ? '–' : (n > 0 ? '+' : '') + rupiahId_(n); };
  html += '<h2>Stock</h2>' + tabelRekap_([
    { judul: 'Kategori', lebar: 18 }, { judul: 'Item bergerak', lebar: 9, angka: true },
    { judul: 'Masuk (Rp)', lebar: 14, angka: true }, { judul: 'Bahan terpakai (Rp)', lebar: 15, angka: true },
    { judul: 'Penyesuaian (Rp)', lebar: 14, angka: true }, { judul: 'Selisih harga (Rp)', lebar: 13, angka: true },
    { judul: 'Nilai stock akhir bulan (Rp)', lebar: 17, angka: true }
  ], s.kategori.map(function (x) {
    return [e(x.kategori), x.item ? String(x.item) : '–', rp(x.masuk), rp(x.terpakai), rp(x.penyesuaian), rpTanda(x.selisihHarga),
      rp(x.nilaiAkhir)];
  }), ['Total', String(s.total.item), rp(s.total.masuk), rp(s.total.terpakai), rp(s.total.penyesuaian), rpTanda(s.total.selisihHarga),
    rp(s.total.nilaiAkhir)],
  'Tidak ada gerakan stock dan belum ada stock bernilai pada bulan ini.');
  html += catatan('Nilai masuk, bahan terpakai, dan penyesuaian = jumlah per hari × harga satuan yang berlaku pada hari itu ' +
    '(riwayat harga di daftar item). Bahan terpakai = stock keluar + dipakai prep, ' +
    'tanpa barang jadi hasil resep (biayanya sudah terhitung saat bahannya dipakai). Penyesuaian termasuk hasil stock opname. ' +
    'Selisih harga = stock akhir sehari sebelum harga baru berlaku × (harga baru − harga lama), untuk harga yang berganti pada bulan ini; ' +
    'positif berarti nilai stock naik karena harga naik. ' +
    'Nilai stock akhir bulan = stock akhir × harga satuan yang berlaku pada ' + tanggalSedangId_(d.sampai) + '.');
  if (s.tanpaHarga.length) {
    html += catatan(s.tanpaHarga.length + ' item belum punya harga (pada sebagian atau semua harinya) dan tidak ikut dihitung ' +
      'untuk hari tanpa harga: ' + daftarNamaSingkat_(s.tanpaHarga) + '.');
  }

  // Stock opname
  var o = d.opname;
  html += '<h2>Stock opname</h2>' + tabelRekap_([
    { judul: 'No', lebar: 6, angka: true }, { judul: 'Tanggal', lebar: 16 }, { judul: 'Dihitung oleh', lebar: 22 },
    { judul: 'Item dihitung', lebar: 16, angka: true }, { judul: 'Item berselisih', lebar: 16, angka: true },
    { judul: 'Nilai selisih (Rp)', lebar: 24, angka: true }
  ], o.daftar.map(function (x, i) {
    return [String(i + 1), e(tanggalSedangId_(x.tanggal)), e(x.oleh), String(x.jumlah), String(x.berselisih),
      rp(x.nilai) + (x.tanpaHarga ? ' *' : '')];
  }), [{ html: 'Total', kelas: '' }, '', '', '', '', rp(o.totalNilai)], 'Tidak ada stock opname pada bulan ini.');
  if (o.daftar.some(function (x) { return x.tanpaHarga; })) {
    html += catatan('* Ada item berselisih yang belum punya harga; nilainya tidak ikut dihitung.');
  }
  if (o.item.length) {
    html += '<h3>Item yang paling sering berselisih</h3>' + tabelRekap_([
      { judul: 'No', lebar: 6, angka: true }, { judul: 'Nama Item', lebar: 34 }, { judul: 'Kali berselisih', lebar: 14, angka: true },
      { judul: 'Total selisih', lebar: 14, angka: true }, { judul: 'Satuan', lebar: 10 }, { judul: 'Nilai selisih (Rp)', lebar: 22, angka: true }
    ], o.item.map(function (x, i) {
      return [String(i + 1), e(x.item), String(x.kali), (x.selisih > 0 ? '+' : '') + angkaId_(x.selisih), e(x.satuan), rp(x.nilai)];
    }));
  }

  // Waste
  var w = d.waste;
  html += '<h2>Waste</h2>' + tabelRekap_([
    { judul: 'Kategori waste', lebar: 40 }, { judul: 'Jumlah catatan', lebar: 25, angka: true },
    { judul: 'Estimasi kerugian (Rp)', lebar: 35, angka: true }
  ], w.total.catatan ? w.kategori.map(function (x) {
    var nilaiKat = !x.catatan ? '–' : (x.tanpaHarga === x.catatan ? '– *' : rp(x.nilai) + (x.tanpaHarga ? ' *' : ''));
    return [e(x.kategori), x.catatan ? String(x.catatan) : '–', nilaiKat];
  }) : [], ['Total', String(w.total.catatan), rp(w.total.nilai)], 'Tidak ada waste tercatat pada bulan ini.');
  if (w.total.tanpaHarga) {
    html += catatan('* ' + w.total.tanpaHarga + ' catatan waste tanpa harga satuan; estimasinya tidak ikut dihitung.');
  }
  if (w.item.length) {
    html += '<h3>' + (w.jumlahItem > ITEM_TERATAS_REKAP ? 'Sepuluh item dengan nilai waste terbesar' : 'Item dengan nilai waste terbesar') +
      '</h3>' + tabelRekap_([
      { judul: 'No', lebar: 6, angka: true }, { judul: 'Item / Produk', lebar: 36 }, { judul: 'Qty', lebar: 12, angka: true },
      { judul: 'Satuan', lebar: 10 }, { judul: 'Catatan', lebar: 12, angka: true }, { judul: 'Estimasi kerugian (Rp)', lebar: 24, angka: true }
    ], w.item.map(function (x, i) {
      return [String(i + 1), e(x.item), angkaId_(x.qty), e(x.satuan), String(x.catatan), rp(x.nilai)];
    }));
  }

  // Prep
  var p = d.prep;
  // Kolom Hasil standar hanya jika bulan itu ada hasil aktual yang dicatat (Code.gs v0.24); bulan lama tetap seperti dulu.
  var adaAktual = p.aktual && p.aktual.catatan > 0;
  html += '<h2>Prep</h2>' + tabelRekap_([
    { judul: 'No', lebar: 6, angka: true }, { judul: 'Item / Menu Prep', lebar: adaAktual ? 30 : 38 }, { judul: 'Catatan', lebar: adaAktual ? 10 : 12, angka: true },
    { judul: 'Jumlah resep', lebar: adaAktual ? 12 : 14, angka: true }]
    .concat(adaAktual ? [{ judul: 'Hasil standar', lebar: 14, angka: true }] : [])
    .concat([{ judul: 'Hasil atau Qty', lebar: adaAktual ? 14 : 16, angka: true }, { judul: 'Satuan', lebar: 14 }]),
  p.item.map(function (x, i) {
    return [String(i + 1), e(x.item), String(x.catatan), x.resep == null ? '–' : angkaId_(x.resep)]
      .concat(adaAktual ? [x.standar == null ? '–' : angkaId_(x.standar)] : [])
      .concat([angkaId_(x.hasil), e(x.satuan)]);
  }), null, 'Tidak ada prep tercatat pada bulan ini.');
  if (p.item.length) html += catatan('Item tanpa resep ditulis dengan Qty-nya; jumlah resep "–".' + (adaAktual
    ? ' Hasil memakai hasil aktual jika dicatat. Pada ' + p.aktual.catatan + ' catatan dengan hasil aktual, hasilnya ' +
      persenHasil_(p.aktual) + ' dari standar resep (' + angkaId_(p.aktual.aktual) + ' dari ' + angkaId_(p.aktual.standar) + ').' : ''));

  // Suhu
  var su = d.suhu;
  html += '<h2>Suhu</h2>' + tabelRekap_([
    { judul: 'Nama Unit', lebar: 32 }, { judul: 'Tipe', lebar: 14 }, { judul: 'Pengecekan', lebar: 16, angka: true },
    { judul: 'Di luar standar', lebar: 19, angka: true }, { judul: 'Terlewat', lebar: 19, angka: true }
  ], su.unit.map(function (u) {
    return [e(u.unit) + (u.aktif ? '' : ' <span class="kecil">(nonaktif)</span>'), e(u.tipe), String(u.cek),
      { html: String(u.luar), kelas: u.luar ? 'masalah' : '' }, u.terlewat == null ? '–' : String(u.terlewat)];
  }), su.unit.length ? ['Total', '', String(su.cek), String(su.luar), String(su.jumlahTerlewat)] : null,
  'Belum ada unit Chiller atau Freezer aktif dan belum ada pengecekan suhu.');
  html += catatan('Pengecekan termasuk cek ulang. Terlewat = Opening, Middle, atau Closing unit aktif yang tidak diisi' +
    (su.mulai ? ', dihitung sejak isian Suhu pertama (' + tanggalSedangId_(su.mulai) + ')' : '') +
    (d.berjalan ? ' sampai kemarin' : '') + '.' +
    (su.libur && su.libur.length ? ' Hari libur (' + teksHariBulanSingkat_(su.libur) + ') tidak dihitung.' : ''));
  if (su.terlewat.length) {
    html += '<h3>Pengecekan yang terlewat</h3>' + tabelRekap_([
      { judul: 'Tanggal', lebar: 16 }, { judul: 'Terlewat', lebar: 14, angka: true }, { judul: 'Pengecekan yang tidak diisi', lebar: 70 }
    ], su.terlewat.map(function (x) {
      return [e(tanggalSedangId_(x.tanggal)), x.kurang.length + ' dari ' + x.total, e(x.kurang.join(', '))];
    }));
  } else if (su.mulai && d.akhirNilai >= d.dari) {
    html += catatan('Tidak ada pengecekan Opening, Middle, atau Closing yang terlewat.');
  }

  // Kepatuhan
  var k = d.kepatuhan;
  html += '<h2>Kepatuhan</h2>';
  var nLibur = (k.libur || []).length;
  html += '<p class="isi">' + e(k.hariDinilai
    ? 'Hari yang dinilai: ' + tanggalSedangId_(k.mulai) + ' sampai ' + tanggalSedangId_(k.akhir) + ' (' + k.hariDinilai + ' hari' +
      (!nLibur ? '' : nLibur === k.hariDinilai ? ', semuanya hari libur' : ', termasuk ' + nLibur + ' hari libur: ' + teksHariBulanSingkat_(k.libur)) + ').'
    : (d.berjalan && d.akhirNilai < d.dari
      ? 'Belum ada hari yang dinilai: hari pertama bulan ini belum selesai.'
      : 'Belum ada hari yang dinilai: aplikasi belum dipakai pada bulan ini.')) + '</p>';
  html += tabelRekap_([
    { judul: 'Form', lebar: 20 }, { judul: 'Hari ditagih', lebar: 10, angka: true }, { judul: 'Hari tidak lengkap', lebar: 11, angka: true },
    { judul: 'Tanggal tidak lengkap', lebar: 26 }, { judul: 'Isian', lebar: 9, angka: true },
    { judul: 'Belum diperiksa', lebar: 12, angka: true }, { judul: 'Dilaporkan keliru', lebar: 12, angka: true }
  ], k.form.map(function (x) {
    var tanggal = x.tidakLengkap.length ? teksHariBulan_(x.tidakLengkap)
      : (!k.hariDinilai ? '–' : x.ditagih ? 'Semua lengkap' : (!x.tampil ? 'Disembunyikan, tidak ditagih' :
        (x.jadwal === 'sewaktu-waktu' ? 'Sewaktu-waktu, tidak ditagih' : (x.liburDitagih ? 'Hari libur, tidak ditagih' : 'Tidak ditagih'))));
    return [e(x.nama), String(x.ditagih), { html: String(x.tidakLengkap.length), kelas: x.tidakLengkap.length ? 'akhir' : '' }, e(tanggal),
      String(x.kiriman), String(x.belumDiperiksa), { html: String(x.dilaporkan), kelas: x.dilaporkan ? 'akhir' : '' }];
  }), ['Total', '', String(k.total.hariTidakLengkap), '', String(k.total.kiriman), String(k.total.belumDiperiksa), String(k.total.dilaporkan)],
  'Belum ada form.');
  html += catatan('Lengkap menurut aturan kelengkapan: ada kiriman atau ditandai nihil; Suhu lengkap jika semua unit aktif punya ' +
    'Opening, Middle, dan Closing. Isian = kiriman pada bulan ini; belum diperiksa dan dilaporkan keliru dihitung saat rekap dibuat.' +
    (nLibur ? ' Hari libur tidak ditagih.' : ''));

  // HPP dan food cost (Bagian 5.9)
  html += isiPdfRekapHpp_(d.hpp);
  html += isiPdfRekapPembelian_(d.pembelian);
  return html;
}

/** "96%": hasil aktual dibanding standar resep (satu angka di belakang koma jika perlu). */
function persenHasil_(a) {
  return a.standar ? persenId_(Math.round(a.aktual / a.standar * 1000) / 10) : '–';
}

/** Bagian Pembelian rekap bulanan; kosong jika bulan itu tidak ada pemasok atau harga beli yang dicatat. */
function isiPdfRekapPembelian_(p) {
  if (!p || !p.ada) return '';
  var e = escHtml_;
  var rp = function (n) { return rupiahId_(n); };
  var html = '<h2>Pembelian</h2>' + tabelRekap_([
    { judul: 'Pemasok', lebar: 34 }, { judul: 'Kiriman', lebar: 12, angka: true }, { judul: 'Item', lebar: 12, angka: true },
    { judul: 'Nilai pembelian (Rp)', lebar: 22, angka: true }, { judul: 'Tanpa harga beli', lebar: 20, angka: true }
  ], p.pemasok.map(function (x) {
    return [x.nama ? e(x.nama) : 'Tanpa pemasok', String(x.kiriman), String(x.item), rp(x.nilai), String(x.tanpaHarga)];
  }), ['Total', String(p.total.kiriman), String(p.total.item), rp(p.total.nilai), String(p.total.tanpaHarga)], 'Tidak ada barang masuk.');
  return html + '<p class="catatan">' + e('Nilai pembelian = stock masuk × harga beli yang dicatat saat barang masuk. Barang masuk ' +
    'tanpa harga beli dihitung di kolom terakhir dan tidak ikut dinilai. Nilai Masuk di bagian Stock memakai harga satuan, ' +
    'jadi bisa berbeda.') + '</p>';
}

/**
 * PDF rekap bulanan: { blob, namaFile }. Nama file Rekap_{YYYY-MM}.pdf
 * (Bagian 9.3). dibuatOleh: teks baris "Dibuat oleh".
 */
function buatPdfRekap_(d, dibuatOleh) {
  var info = [['Periode', teksPeriodeRekap_(d)]];
  if (!d.adaIsian) info.push(['Keterangan', 'Belum ada isian pada bulan ini.']);
  var html = htmlLaporan_('', d.sampai, {
    judul: 'Rekap Bulanan ' + d.nama,
    infoDasar: [['Bulan', d.nama]],
    info: info,
    tabel: isiPdfRekap_(d),
    bawah: [['Dibuat oleh', dibuatOleh]]
  });
  var namaFile = 'Rekap_' + d.bulan + '.pdf';
  var blob = Utilities.newBlob(html, 'text/html', namaFile + '.html').getAs('application/pdf').setName(namaFile);
  return { blob: blob, namaFile: namaFile, html: html };
}

/**
 * Menyimpan rekap ke Laporan Kitchen/{Nama Outlet}/{Tahun}/Rekap_{YYYY-MM}.pdf
 * (Bagian 9.3). Rekap bulan yang sama yang sudah ada di folder itu dipindah ke
 * tempat sampah Drive, supaya hanya ada satu file per bulan.
 */
function simpanRekapKeDrive_(pdf, bulan) {
  var tahun = bulan.slice(0, 4);
  var akar = cariAtauBuatFolder_(DriveApp.getRootFolder(), FOLDER_LAPORAN);
  var outlet = cariAtauBuatFolder_(akar, (namaOutlet_() || 'Outlet').replace(/[\\/]+/g, '-'));
  var folder = cariAtauBuatFolder_(outlet, tahun);
  var lama = folder.getFilesByName(pdf.namaFile);
  while (lama.hasNext()) lama.next().setTrashed(true);
  folder.createFile(pdf.blob.copyBlob().setName(pdf.namaFile));
  return { namaFile: pdf.namaFile, lokasi: [FOLDER_LAPORAN, namaOutlet_() || 'Outlet', tahun].join('/') };
}

/** Unduh rekap bulanan (khusus Pengelola): bulan "yyyy-mm". Tidak menambah file di Drive. */
function aksiUnduhPdfRekap_(body, pengguna) {
  var bulan = String(body.bulan || '');
  if (!bulanSah_(bulan)) throw galatPengguna_('Bulan tidak terbaca. Pilih bulan lagi.');
  periksaBelumDiarsip_(bulan + '-01');
  var pdf = buatPdfRekap_(dataRekapBulan_(bulan), pengguna.nama + ', ' + waktuPendekId_(new Date()));
  return { namaFile: pdf.namaFile, mime: 'application/pdf', data: Utilities.base64Encode(pdf.blob.getBytes()) };
}

/** Isi email rekap bulanan: ringkasan tiap bagian; rinciannya di PDF terlampir. */
function htmlEmailRekap_(d, x) {
  var w = WARNA_PDF;
  var e = escHtml_;
  var bagian = function (judul, baris) {
    return '<h2 style="font-size:15px;color:' + w.navy + ';margin:20px 0 6px;padding-bottom:4px;border-bottom:1px solid ' +
      w.garis + '">' + e(judul) + '</h2><ul style="margin:0;padding-left:18px">' + baris.map(function (b) {
      return '<li style="margin:2px 0">' + b + '</li>';
    }).join('') + '</ul>';
  };
  var s = d.stock;
  var k = d.kepatuhan;
  var html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:' + w.tinta + ';max-width:640px">' +
    '<div style="background:' + w.navy + ';color:#FFFFFF;padding:14px 16px">' +
      '<div style="font-size:18px;font-weight:bold">Rekap bulanan ' + e(x.outlet) + '</div>' +
      '<div style="color:#A9B8CF">' + e(d.nama) + ' · ' + e(teksPeriodeRekap_(d)) + '</div></div>';
  if (!d.adaIsian) html += '<p style="margin:16px 0 0">Belum ada isian pada bulan ini.</p>';
  html += bagian('Stock', [
    'Nilai stock akhir bulan: <b>' + rupiahId_(s.total.nilaiAkhir) + '</b>',
    'Masuk ' + rupiahId_(s.total.masuk) + ', bahan terpakai ' + rupiahId_(s.total.terpakai) + ', penyesuaian ' + rupiahId_(s.total.penyesuaian) +
      ' (' + s.bergerak + ' item bergerak)',
    s.perubahanHarga
      ? 'Selisih karena perubahan harga: ' + (s.total.selisihHarga > 0 ? '+' : '') + rupiahId_(s.total.selisihHarga) +
        ' (' + s.perubahanHarga + ' item berganti harga)'
      : 'Tidak ada perubahan harga pada bulan ini'
  ].concat(s.tanpaHarga.length ? [s.tanpaHarga.length + ' item belum punya harga, tidak ikut dihitung'] : []));
  html += bagian('Stock opname', [d.opname.daftar.length
    ? d.opname.daftar.length + ' kali, total nilai selisih ' + rupiahId_(d.opname.totalNilai)
    : 'Tidak ada stock opname pada bulan ini.']);
  html += bagian('Waste', [d.waste.total.catatan
    ? d.waste.total.catatan + ' catatan, estimasi kerugian <b>' + rupiahId_(d.waste.total.nilai) + '</b>' +
      (d.waste.item[0] ? '. Terbesar: ' + e(d.waste.item[0].item) + (d.waste.item[0].nilai != null ? ' ' + rupiahId_(d.waste.item[0].nilai) : '') : '')
    : 'Tidak ada waste tercatat pada bulan ini.']);
  html += bagian('Prep', [d.prep.catatan
    ? d.prep.catatan + ' catatan prep untuk ' + d.prep.item.length + ' item'
    : 'Tidak ada prep tercatat pada bulan ini.'].concat(d.prep.aktual && d.prep.aktual.catatan
    ? ['Hasil aktual ' + persenHasil_(d.prep.aktual) + ' dari standar resep (' + d.prep.aktual.catatan + ' catatan)'] : []));
  html += bagian('Suhu', [
    (d.suhu.luar ? '<b style="color:' + w.masalah + '">' + d.suhu.luar + ' pengecekan di luar standar</b>' : 'Tidak ada pengecekan di luar standar') +
      ' dari ' + d.suhu.cek + ' pengecekan',
    d.suhu.jumlahTerlewat ? d.suhu.jumlahTerlewat + ' pengecekan terlewat pada ' + d.suhu.terlewat.length + ' hari' : 'Tidak ada pengecekan yang terlewat'
  ]);
  var tidak = k.form.filter(function (f) { return f.tidakLengkap.length; }).map(function (f) {
    return e(f.nama) + ' ' + f.tidakLengkap.length + ' hari';
  });
  html += bagian('Kepatuhan', [
    k.hariDinilai ? (tidak.length ? 'Form tidak lengkap: ' + tidak.join(', ') : 'Semua form wajib lengkap selama ' + k.hariDinilai + ' hari yang dinilai' +
      ((k.libur || []).length ? ' (' + k.libur.length + ' hari libur)' : ''))
      : 'Belum ada hari yang dinilai',
    k.total.belumDiperiksa + ' isian belum diperiksa, ' + k.total.dilaporkan + ' baris dilaporkan keliru'
  ]);
  var h = d.hpp;
  html += bagian('HPP dan food cost', h.sampai < h.dari ? ['Belum ada hari yang dinilai.'] : [
    'Pemakaian bahan ' + rupiahId_(h.pemakaian.total) + (h.penjualan.hari ? ', penjualan ' + rupiahId_(h.penjualan.total) : ''),
    h.foodCost == null
      ? (!h.penjualan.jumlahHari && (h.penjualan.libur || []).length ? 'Food cost belum dihitung: semua hari yang dinilai hari libur'
        : 'Food cost belum dihitung: penjualan baru tercatat ' + h.penjualan.hari + ' dari ' + h.penjualan.jumlahHari + ' hari')
      : 'Food cost ' + e(d.nama.split(' ')[0]) + ' ' + (h.foodCost > h.target ? '<b style="color:' + w.masalah + '">' + persenId_(h.foodCost) + '</b>' :
        '<b>' + persenId_(h.foodCost) + '</b>') + ' (target ' + persenId_(h.target) + ')',
    h.menuDiAtas.length ? h.menuDiAtas.length + ' menu di atas target: ' + e(daftarNamaSingkat_(h.menuDiAtas.map(function (m) { return m.nama; })))
      : (h.jumlahMenu ? 'Semua menu aktif di bawah atau sama dengan target' : 'Belum ada menu di Pengaturan → Menu')
  ].concat(h.teoritis && h.teoritis.pernah ? [h.teoritis.lengkap
    ? 'Pemakaian seharusnya dari ' + h.teoritis.porsi + ' porsi terjual ' + rupiahId_(h.teoritis.seharusnya.total) + ', nyata ' +
      rupiahId_(h.teoritis.nyata) + ': selisih <b>' + (h.teoritis.selisih > 0 ? '+' : '') + rupiahId_(h.teoritis.selisih) + '</b>'
    : 'Seharusnya vs nyata belum dibandingkan: porsi per menu belum dicatat untuk ' + h.teoritis.kurang.length + ' hari'] : []));
  var pb = d.pembelian;
  if (pb && pb.ada) {
    var berpemasok = pb.pemasok.filter(function (y) { return y.nama; });
    html += bagian('Pembelian', [
      'Nilai pembelian <b>' + rupiahId_(pb.total.nilai) + '</b> dari ' + pb.total.kiriman + ' kiriman barang masuk' +
        (berpemasok.length ? ', ' + berpemasok.length + ' pemasok' : ''),
      berpemasok.length ? 'Terbesar: ' + e(berpemasok[0].nama) + ' ' + rupiahId_(berpemasok[0].nilai) : 'Belum ada pemasok yang dicatat'
    ].concat(pb.total.tanpaHarga ? [pb.total.tanpaHarga + ' barang masuk tanpa harga beli, tidak ikut dinilai'] : []));
  }
  html += bagian('Lampiran', [e(x.namaFile) + (x.drive ? ' (tersimpan di Drive: ' + e(x.lokasi) + ')' : ' (gagal disimpan ke Drive)')]);
  html += '<p style="margin:20px 0 0">' + (x.alamat
    ? '<a href="' + e(x.alamat) + '" style="color:' + w.navy + ';font-weight:bold">Buka InventoryKu</a>'
    : 'Buka InventoryKu dari HP untuk melihat rinciannya.') + '</p>' +
    '<p style="color:' + w.tintaRedup + ';font-size:12px;margin:12px 0 0">Email otomatis dari InventoryKu, dikirim tiap tanggal 1.</p></div>';
  return html;
}

/**
 * Rekap bulanan (Bagian 9.3 dan 10): PDF disimpan ke Drive, lalu satu email
 * berlampiran PDF ke penerima di M_Outlet. Hasil dan kegagalan dicatat di
 * M_Konfigurasi (rekap_terakhir); yang diawali "Gagal" tampil di Beranda dan
 * Dashboard Pengelola. opsi: { bulan, data (opsional, sudah dihitung), uji }.
 */
function jalankanRekapBulanan_(opsi) {
  var ket = 'Diisi otomatis oleh rekap bulanan. Baris yang diawali "Gagal" juga tampil di Beranda Pengelola.';
  var hasil = { bulan: opsi.bulan, penerima: [], terkirim: false, drive: false };
  try {
    var d = opsi.data || dataRekapBulan_(opsi.bulan);
    var pdf = buatPdfRekap_(d, opsi.uji ? 'Uji dari editor Apps Script, ' + waktuPendekId_(new Date()) : 'Otomatis, ' + waktuPendekId_(new Date()));
    hasil.namaFile = pdf.namaFile;
    var masalah = [];
    var x = { outlet: namaOutlet_() || 'Outlet', namaFile: pdf.namaFile, drive: false, lokasi: '' };
    try {
      x.lokasi = simpanRekapKeDrive_(pdf, d.bulan).lokasi;
      x.drive = hasil.drive = true;
    } catch (err) {
      console.error('Rekap gagal disimpan ke Drive: ' + (err && err.stack ? err.stack : err));
      masalah.push('PDF gagal disimpan ke Drive: ' + (err && err.message ? err.message : err));
    }
    var konf = bacaKonfigurasi_().nilai;
    x.alamat = /^https:\/\//.test(String(konf.alamat_aplikasi || '')) ? String(konf.alamat_aplikasi) : '';
    var penerima = bacaDaftarEmail_();
    hasil.penerima = penerima;
    if (!penerima.length) throw new Error('belum ada penerima email. Tambahkan di Pengaturan → Penerima email.');
    var sisa = MailApp.getRemainingDailyQuota();
    if (sisa < penerima.length) throw new Error('kuota email harian Gmail habis (sisa ' + sisa + ').');
    hasil.html = htmlEmailRekap_(d, x);
    MailApp.sendEmail({
      to: penerima.join(','),
      subject: (opsi.uji ? '[Uji] ' : '') + 'Rekap bulanan ' + x.outlet + ', ' + d.nama,
      htmlBody: hasil.html,
      name: 'InventoryKu',
      attachments: [pdf.blob]
    });
    hasil.terkirim = true;
    catatStatusSistem_('rekap_terakhir', 'Terkirim ' + waktuSekarangId_() + ' untuk ' + d.nama + ' ke ' + penerima.length + ' penerima' +
      (masalah.length ? '. Masalah: ' + masalah.join('; ') : '') + '.', ket);
  } catch (err) {
    console.error('Rekap bulanan gagal: ' + (err && err.stack ? err.stack : err));
    hasil.galat = err && err.message ? err.message : String(err);
    catatStatusSistem_('rekap_terakhir', 'Gagal ' + waktuSekarangId_() + ' untuk ' + namaBulanId_(opsi.bulan) + ': ' + hasil.galat, ket);
  }
  return hasil;
}

/** Dijalankan trigger bulanan tanggal 1 (dipasang pasangTrigger): rekap bulan sebelumnya. */
function kirimRekapBulanan() {
  if (sudahPindah_()) return console.log('Sudah pindah ke Supabase: rekap bulanan dikirim dari sana.');
  SS_ = null;
  resetMemoForm_();
  return jalankanRekapBulanan_({ bulan: bulanLalu_(hariIni_()) });
}

/**
 * Jalankan dari editor Apps Script untuk menguji rekap tanpa menunggu
 * tanggal 1: rekap bulan lalu, sama seperti trigger. Jika bulan lalu sama
 * sekali belum punya isian (aplikasi baru dipakai), rekap bulan berjalan
 * yang dibuat, supaya isinya bisa diperiksa. Subjek email diawali "[Uji]";
 * PDF juga disimpan ke Drive (rekap bulan itu yang dibuat sesudahnya
 * menggantikannya). Hasilnya tertulis di log eksekusi.
 */
function kirimRekapSekarang() {
  if (sudahPindah_()) return teruskanKeSupabase_('kirimRekapSekarang');
  SS_ = null;
  resetMemoForm_();
  var hari = hariIni_();
  var d = dataRekapBulan_(bulanLalu_(hari));
  if (!d.adaIsian) {
    console.log('Bulan lalu (' + d.nama + ') belum punya isian, jadi yang dibuat rekap bulan berjalan.');
    d = dataRekapBulan_(hari.slice(0, 7));
  }
  var h = jalankanRekapBulanan_({ bulan: d.bulan, data: d, uji: true });
  console.log(h.terkirim
    ? 'Rekap ' + d.nama + ' terkirim ke ' + h.penerima.join(', ') + ' dengan lampiran ' + h.namaFile +
      (h.drive ? '; tersimpan di Drive.' : '; GAGAL disimpan ke Drive (lihat rekap_terakhir di M_Konfigurasi).')
    : 'Rekap gagal: ' + h.galat + '. Lihat baris rekap_terakhir di M_Konfigurasi.');
}

/* ---------- Trigger ---------- */

var HARI_TRIGGER = {
  minggu: 'SUNDAY', senin: 'MONDAY', selasa: 'TUESDAY', rabu: 'WEDNESDAY',
  kamis: 'THURSDAY', jumat: 'FRIDAY', "jum'at": 'FRIDAY', sabtu: 'SATURDAY'
};
var JAM_CADANGAN = 3; // dini hari

/**
 * Jalankan dari editor Apps Script (sekali, dan setiap kali jam closing,
 * jeda laporan, hari cadangan, atau zona waktu diubah). Menghapus semua
 * trigger lama milik script ini, lalu memasang trigger harian (jam closing +
 * jeda dari M_Konfigurasi), trigger cadangan mingguan (hari_cadangan, pukul
 * 03.00), dan trigger rekap bulanan (tanggal 1, pukul 07.00; Tahap 10), dalam
 * zona waktu yang tersimpan.
 */
function pasangTrigger() {
  if (sudahPindah_()) {
    pasangSinkron_();
    return teruskanKeSupabase_('pasangTrigger');
  }
  SS_ = null;
  var konf = bacaKonfigurasi_().nilai;
  var zona = zonaWaktu_();
  var closing = String(konf.jam_closing || '21:30').match(/^(\d{1,2})[:.](\d{2})$/);
  if (!closing) throw new Error('jam_closing di M_Konfigurasi harus berbentuk jj:mm, misalnya 21:30.');
  var jeda = Number(konf.jeda_laporan_menit);
  if (!isFinite(jeda) || jeda < 0) jeda = 45;
  var menit = (Number(closing[1]) * 60 + Number(closing[2]) + jeda) % (24 * 60);
  var hari = HARI_TRIGGER[String(konf.hari_cadangan || 'Minggu').trim().toLowerCase()];
  if (!hari) throw new Error('hari_cadangan di M_Konfigurasi harus nama hari, misalnya Minggu.');

  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('kirimLaporanHarian').timeBased()
    .atHour(Math.floor(menit / 60)).nearMinute(menit % 60).everyDays(1).inTimezone(zona).create();
  ScriptApp.newTrigger('buatCadangan').timeBased()
    .onWeekDay(ScriptApp.WeekDay[hari]).atHour(JAM_CADANGAN).inTimezone(zona).create();
  ScriptApp.newTrigger('kirimRekapBulanan').timeBased()
    .onMonthDay(1).atHour(JAM_REKAP).inTimezone(zona).create();
  // Pengingat cek suhu (Code.gs v0.19) dan stock (v0.22) ke HP: hanya di Supabase, karena Apps Script tidak bisa
  // mengirim notifikasi.
  var pengingat = [];
  var jamStock = '';
  var jamClosingPengingat = '';
  if (DI_SUPABASE_) {
    PENGINGAT_JAM.forEach(function (p) {
      var jam = jamPengingat_(konf, p);
      if (!jam) return;
      ScriptApp.newTrigger(p.fungsi).timeBased()
        .atHour(Number(jam.slice(0, 2))).nearMinute(Number(jam.slice(3, 5))).everyDays(1).inTimezone(zona).create();
      if (p === PENGINGAT_STOCK) jamStock = jam;
      else pengingat.push(p.waktu + ' ' + jam);
    });
    // Pengingat sebelum closing (Code.gs v0.31): jam closing dikurangi menitnya, jadi ikut dipasang ulang saat jam closing berubah.
    jamClosingPengingat = jamPengingatClosing_(konf);
    if (jamClosingPengingat) {
      ScriptApp.newTrigger(PENGINGAT_CLOSING.fungsi).timeBased().atHour(Number(jamClosingPengingat.slice(0, 2)))
        .nearMinute(Number(jamClosingPengingat.slice(3, 5))).everyDays(1).inTimezone(zona).create();
    }
  }
  // Arsip tahunan (Code.gs v0.20): tiap jam, tanpa kerja kecuali ada data yang perlu dipindah.
  ScriptApp.newTrigger('arsipTahunan').timeBased().everyHours(1).create();
  var jamTeks = ('0' + Math.floor(menit / 60)).slice(-2) + ':' + ('0' + (menit % 60)).slice(-2);
  var rekapTeks = 'rekap bulanan tiap tanggal 1 sekitar ' + ('0' + JAM_REKAP).slice(-2) + ':00' +
    (pengingat.length ? ', pengingat cek suhu ' + pengingat.join(', ') : '') + (jamStock ? ', pengingat stock ' + jamStock : '') +
    (jamClosingPengingat ? ', pengingat sebelum closing ' + jamClosingPengingat : '') +
    ', arsip tahunan tiap jam';
  console.log('Trigger terpasang (zona ' + zona + '): laporan harian sekitar ' + jamTeks +
    ' (toleransi Google sekitar 15 menit), cadangan tiap ' + konf.hari_cadangan + ' sekitar 03:00, ' + rekapTeks + '.');
  catatStatusSistem_('pasang_trigger', 'Terpasang ' + waktuSekarangId_() + ' (zona ' + zona + '): laporan harian sekitar ' +
    jamTeks + ', cadangan tiap ' + konf.hari_cadangan + ' sekitar 03:00, ' + rekapTeks + '.', KETERANGAN_PASANG_TRIGGER);
}

/* =========================================================================
 * Arsip tahunan (Code.gs v0.20; spesifikasi sistem Bagian 8.6). Tahun berjalan
 * dan tahun lalu tetap di tab; baris yang lebih tua dipindah ke berkas arsip
 * Laporan Kitchen/{Outlet}/Arsip/{Tahun}/Arsip_{Tahun}_{Tab}_{batas}.json,
 * yang di Google Drive juga ditulis ke Google Sheets "Arsip InventoryKu
 * {Tahun}" (satu tab per tab data). Supaya stock tetap benar, rekap terakhir
 * tiap item sebelum batas tetap di Stock_Harian (Stock Awal sesudahnya
 * berasal darinya). arsipTahunan dijalankan trigger tiap jam: di Supabase satu
 * tab per jalan (batas CPU Edge Function), di Apps Script sebanyak mungkin
 * dalam 4 menit. Jalan yang tidak punya pekerjaan hanya membaca M_Konfigurasi.
 * ========================================================================= */

var ARSIP_TAHUN_DISIMPAN = 2; // tahun berjalan dan tahun lalu
var FOLDER_ARSIP = 'Arsip';
var PROP_ARSIP_PROSES = 'ARSIP_PROSES';
var NAMA_SHEETS_ARSIP = 'Arsip InventoryKu ';
// Di Supabase paling banyak sekian baris per jalan (yang tertua dulu), supaya tetap di bawah batas CPU Edge Function.
var BARIS_ARSIP_PER_JALAN = 20000;
var KETERANGAN_ARSIP = 'Diisi otomatis oleh arsip tahunan. arsip_sampai: data sebelum tanggal ini sudah dipindah ke arsip ' +
  '(Laporan Kitchen/<Outlet>/Arsip). Baris arsip_terakhir yang diawali "Gagal" tampil di Beranda Pengelola.';

/** Batas arsip hari ini: 1 Januari tahun lalu (baris sebelum tanggal ini dipindah). */
function batasArsip_() {
  return (Number(hariIni_().slice(0, 4)) - (ARSIP_TAHUN_DISIMPAN - 1)) + '-01-01';
}

/** Tanggal yang sudah selesai diarsipkan ('' jika belum pernah): data sebelum tanggal ini tidak ada lagi di tab. */
function arsipSampai_() {
  var t = String(bacaKonfigurasi_().nilai.arsip_sampai || '').trim();
  return tanggalSah_(t) ? t : '';
}

/** Menolak tanggal yang datanya sudah dipindah ke arsip (Riwayat, PDF, isian, HPP). */
function periksaBelumDiarsip_(tanggal) {
  var sampai = arsipSampai_();
  if (sampai && tanggal < sampai) {
    throw galatPengguna_('Data sebelum ' + tanggalPanjangId_(sampai).replace(/^[^,]+, /, '') + ' sudah dipindah ke arsip tahunan ' +
      '(Google Drive: ' + FOLDER_LAPORAN + '/' + (namaOutlet_() || 'Outlet') + '/' + FOLDER_ARSIP + '). Pilih tanggal yang lebih baru.');
  }
}

/** Tab yang diarsipkan, urut nama: semua tab Data_* (termasuk form kustom), Stock_Harian, dan Log_Perubahan. */
function tabArsip_() {
  return ss_().getSheets().map(function (sh) { return sh.getName(); }).filter(function (n) {
    return n.indexOf('Data_') === 0 || n === 'Stock_Harian' || n === TAB_LOG.nama;
  }).sort();
}

/** Nilai sel untuk berkas arsip: tanggal menjadi teks "yyyy-mm-dd hh:mm:ss" (atau "yyyy-mm-dd" jika jamnya 00.00). */
function nilaiArsip_(v, zona) {
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return '';
    var t = Utilities.formatDate(v, zona, 'yyyy-MM-dd HH:mm:ss');
    return t.slice(11) === '00:00:00' ? t.slice(0, 10) : t;
  }
  return v;
}

/**
 * Memindahkan baris satu tab yang tanggalnya (kolom Tanggal, atau Waktu di Log_Perubahan) sebelum
 * batas ke berkas arsip per tahun, lalu menghapusnya dari tab. Stock_Harian: rekap terakhir tiap item
 * sebelum batas tidak dipindah. Paling banyak maks baris (yang tertua dulu); sisanya pada jalan
 * berikutnya, dengan nomor bagian di nama berkas. Mengembalikan { jumlah, selesai }. Di dalam kunci.
 */
function arsipkanTab_(nama, batas, maks, bagian) {
  var kosong = { jumlah: 0, selesai: true };
  var sheet = ss_().getSheetByName(nama);
  if (!sheet) return kosong;
  var isi = nilaiTab_(sheet);
  if (isi.length < 2) return kosong;
  var judul = isi[0].map(function (j) { return String(j).trim(); });
  var kol = judul.indexOf('Tanggal');
  if (kol < 0) kol = judul.indexOf('Waktu');
  if (kol < 0) return kosong;
  var zona = zonaSheet_();
  var tanggal = isi.map(function (b, i) { return i ? teksTanggal_(b[kol], zona) : ''; });
  // Stock_Harian: rekap terakhir sebelum batas per item tetap di tab (titik awal stock sesudahnya).
  var tetap = {};
  if (nama === 'Stock_Harian') {
    var kItem = judul.indexOf('Nama Item');
    var terakhir = {};
    isi.forEach(function (b, i) {
      if (!i || !tanggalSah_(tanggal[i]) || tanggal[i] >= batas) return;
      var k = rapikanTeks_(b[kItem]).toLowerCase();
      if (!terakhir[k] || tanggal[i] > tanggal[terakhir[k]]) terakhir[k] = i;
    });
    Object.keys(terakhir).forEach(function (k) { tetap[terakhir[k]] = true; });
  }
  var calon = [];
  isi.forEach(function (b, i) {
    if (i && tanggalSah_(tanggal[i]) && tanggal[i] < batas && !tetap[i]) calon.push(i);
  });
  if (!calon.length) return kosong;
  var selesai = !(maks && calon.length > maks);
  if (!selesai) {
    calon.sort(function (a, b) { return tanggal[a] < tanggal[b] ? -1 : (tanggal[a] > tanggal[b] ? 1 : a - b); });
    calon = calon.slice(0, maks);
  }
  var pindah = calon.sort(function (a, b) { return a - b; });
  var perTahun = {};
  pindah.forEach(function (i) {
    var th = tanggal[i].slice(0, 4);
    (perTahun[th] = perTahun[th] || []).push(isi[i].map(function (v) { return nilaiArsip_(v, zona); }));
  });
  Object.keys(perTahun).sort().forEach(function (th) {
    var folder = cariAtauBuatFolder_(cariAtauBuatFolder_(folderOutlet_(), FOLDER_ARSIP), th);
    var namaBerkas = 'Arsip_' + th + '_' + nama + '_' + batas + (bagian > 1 ? '_' + bagian : '') + '.json';
    var ada = folder.getFilesByName(namaBerkas);
    while (ada.hasNext()) ada.next().setTrashed(true); // jalan ulang sesudah gagal: berkas lama diganti
    var teks = JSON.stringify({ jenis: 'arsip-inventoryku', tahun: th, tab: nama, batas: batas, dibuat: new Date().toISOString(),
      outlet: namaOutlet_(), judul: judul, baris: perTahun[th] });
    folder.createFile(Utilities.newBlob(teks, 'application/json', namaBerkas));
    // Di Apps Script (belum pindah) langsung ditulis ke Google Sheets arsip; di Supabase oleh salinan ke Drive.
    if (!DI_SUPABASE_) arsipJsonKeSheets_(teks, namaBerkas, folder);
  });
  // Hapus per rentang baris yang berurutan, dari bawah supaya nomor baris di atasnya tetap.
  var rentang = [];
  pindah.forEach(function (i) {
    var r = rentang[rentang.length - 1];
    if (r && r.akhir === i - 1) r.akhir = i;
    else rentang.push({ awal: i, akhir: i });
  });
  rentang.reverse().forEach(function (r) { sheet.deleteRows(r.awal + 1, r.akhir - r.awal + 1); });
  lupakanMemoTab_();
  return { jumlah: pindah.length, selesai: selesai };
}

/**
 * Trigger tiap jam. Jika batas arsip (1 Januari tahun lalu) belum diselesaikan, tab berikutnya
 * dipindah (Supabase: satu tab per jalan; Apps Script: sampai 4 menit). Kemajuan di Script Property
 * ARSIP_PROSES; sesudah semua tab, M_Konfigurasi arsip_sampai diisi batasnya dan arsip_terakhir hasilnya.
 */
function arsipTahunan() {
  if (sudahPindah_()) return console.log('Sudah pindah ke Supabase: arsip tahunan berjalan di sana.');
  SS_ = null;
  var batas = batasArsip_();
  if (arsipSampai_() >= batas) return console.log('Arsip sudah sampai ' + arsipSampai_() + '; tidak ada yang perlu dipindah.');
  var props = PropertiesService.getScriptProperties();
  var proses = bacaJson_(props.getProperty(PROP_ARSIP_PROSES)) || {};
  if (proses.batas !== batas) proses = { batas: batas, selesai: [], baris: 0, bagian: {} };
  proses.bagian = proses.bagian || {};
  var mulai = Date.now();
  try {
    var sisa = tabArsip_().filter(function (n) { return proses.selesai.indexOf(n) < 0; });
    for (var i = 0; i < sisa.length; i++) {
      var bagian = (proses.bagian[sisa[i]] || 0) + 1;
      var h = denganKunci_(function () { return arsipkanTab_(sisa[i], batas, DI_SUPABASE_ ? BARIS_ARSIP_PER_JALAN : 0, bagian); });
      if (h.selesai) proses.selesai.push(sisa[i]);
      else proses.bagian[sisa[i]] = bagian;
      proses.baris += h.jumlah;
      props.setProperty(PROP_ARSIP_PROSES, JSON.stringify(proses));
      console.log('Arsip ' + sisa[i] + ': ' + h.jumlah + ' baris dipindah' + (h.selesai ? '.' : ', sisanya pada jalan berikutnya.'));
      if (DI_SUPABASE_ || Date.now() - mulai > 4 * 60 * 1000) break;
    }
    if (tabArsip_().every(function (n) { return proses.selesai.indexOf(n) >= 0; })) {
      denganKunci_(function () {
        tulisKonfigurasi_('arsip_sampai', batas, KETERANGAN_ARSIP);
        catatStatusSistem_('arsip_terakhir', 'Berhasil ' + waktuSekarangId_() + ': data sebelum ' + batas + ' (' + proses.baris +
          ' baris) dipindah ke ' + FOLDER_LAPORAN + '/' + (namaOutlet_() || 'Outlet') + '/' + FOLDER_ARSIP + '.', KETERANGAN_ARSIP);
      });
      props.deleteProperty(PROP_ARSIP_PROSES);
    }
  } catch (err) {
    console.error('Arsip tahunan gagal: ' + (err && err.stack ? err.stack : err));
    catatStatusSistem_('arsip_terakhir', 'Gagal ' + waktuSekarangId_() + ': ' + (err && err.message ? err.message : err) +
      '. Dicoba lagi satu jam kemudian.', KETERANGAN_ARSIP);
  }
}

/**
 * Menulis isi berkas arsip ke Google Sheets "Arsip InventoryKu {Tahun}" di folder yang sama: satu tab
 * per tab data, baris ditambahkan di bawah. Tab "Keterangan" mencatat berkas yang sudah ditulis,
 * supaya berkas yang sama tidak ditulis dua kali. Hanya di Google (Apps Script).
 */
function arsipJsonKeSheets_(teks, namaBerkas, folder) {
  var d = JSON.parse(teks);
  if (!d || d.jenis !== 'arsip-inventoryku') return;
  var namaSs = NAMA_SHEETS_ARSIP + d.tahun;
  var ada = folder.getFilesByName(namaSs);
  var ss;
  if (ada.hasNext()) {
    ss = SpreadsheetApp.openById(ada.next().getId());
  } else {
    ss = SpreadsheetApp.create(namaSs);
    DriveApp.getFileById(ss.getId()).moveTo(folder);
    ss.getSheets()[0].setName('Keterangan').getRange(1, 1, 1, 3).setValues([['Berkas arsip', 'Ditulis', 'Baris']]);
  }
  var ket = ss.getSheetByName('Keterangan') || ss.insertSheet('Keterangan');
  var sudah = ket.getLastRow() > 1 ? ket.getRange(2, 1, ket.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
  if (sudah.indexOf(namaBerkas) >= 0) return;
  var sheet = ss.getSheetByName(d.tab);
  if (!sheet) {
    sheet = ss.insertSheet(d.tab);
    sheet.getRange(1, 1, 1, d.judul.length).setValues([d.judul]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  var lebar = d.judul.length;
  for (var i = 0; i < d.baris.length; i += 5000) {
    var potong = d.baris.slice(i, i + 5000).map(function (b) {
      var r = b.slice(0, lebar);
      while (r.length < lebar) r.push('');
      return r;
    });
    sheet.getRange(sheet.getLastRow() + 1, 1, potong.length, lebar).setValues(potong);
  }
  ket.getRange(ket.getLastRow() + 1, 1, 1, 3).setValues([[namaBerkas, new Date(), d.baris.length]]);
}

/* =========================================================================
 * Pindah ke Supabase (Code.gs v0.15, spesifikasi sistem Bagian 4.3).
 * Sesudah pindah, aplikasi memakai Supabase Edge Function (folder supabase/),
 * yang menjalankan file ini juga (DI_SUPABASE_). Yang tinggal di Apps Script:
 * - pindahKeSupabase    : dijalankan sekali dari editor; memindahkan semua isi
 *                         Sheet dan Script Properties ke Supabase, lalu memasang
 *                         trigger salinan tiap 5 menit.
 * - sinkronDariSupabase : trigger tiap 5 menit; menyalin tab yang berubah ke
 *                         Sheet ini (Sheet hanya untuk dicek: ketikan langsung
 *                         di Sheet tertimpa), menyalin laporan PDF, foto, dan
 *                         cadangan ke Drive, dan mengirim email dari Gmail jika
 *                         Brevo tidak dipasang di Supabase.
 * - fungsi editor lain (setupSpreadsheet, pasangTrigger, kirimLaporanSekarang,
 *   kirimRekapSekarang, buatKodePemasangan) diteruskan ke Supabase.
 * Alamat dan rahasia diisi pemilik di Project Settings → Script Properties
 * (SUPABASE_API, RAHASIA_SINKRON), tidak pernah ditulis di repo.
 * ========================================================================= */

var PROP_SUPABASE_API = 'SUPABASE_API';
var PROP_RAHASIA_SINKRON = 'RAHASIA_SINKRON';
var PROP_SUDAH_PINDAH = 'SUDAH_PINDAH';
var PROP_SINKRON_VERSI = 'SINKRON_VERSI';
var PROP_TIMPA_SUPABASE = 'TIMPA_SUPABASE';
var PROP_SINKRON_PENUH = 'SINKRON_PENUH'; // tanggal salinan penuh terakhir
var JAM_SINKRON_PENUH = 2; // sekali sehari sesudah jam ini semua tab disalin penuh (memperbaiki ketikan langsung di Sheet)
var BARIS_PER_KIRIMAN_IMPOR = 2000;
var MENIT_SINKRON = 5;
// Property yang tidak ikut pindah: milik Apps Script saja.
var PROP_TIDAK_DIPINDAH = [PROP_SUPABASE_API, PROP_RAHASIA_SINKRON, PROP_SUDAH_PINDAH, PROP_SINKRON_VERSI,
  PROP_TIMPA_SUPABASE, PROP_SINKRON_PENUH, 'SPREADSHEET_ID'];

/** true di Apps Script setelah pindahKeSupabase berhasil. */
function sudahPindah_() {
  if (DI_SUPABASE_) return false;
  return !!PropertiesService.getScriptProperties().getProperty(PROP_SUDAH_PINDAH);
}

function alamatSupabase_() {
  return String(PropertiesService.getScriptProperties().getProperty(PROP_SUPABASE_API) || '').trim();
}

/** Memanggil Edge Function sebagai pemilik (rahasia sinkron). Mengembalikan data jawaban atau melempar galat. */
function panggilSupabase_(aksi, isi) {
  var props = PropertiesService.getScriptProperties();
  var url = alamatSupabase_();
  var rahasia = String(props.getProperty(PROP_RAHASIA_SINKRON) || '').trim();
  if (!/^https?:\/\//.test(url) || !rahasia) {
    throw new Error('Isi dulu Script Properties SUPABASE_API (alamat Edge Function, diawali https://) dan RAHASIA_SINKRON ' +
      '(sama dengan secret RAHASIA_SINKRON di Supabase): Project Settings → Script Properties.');
  }
  var body = { action: aksi, rahasia: rahasia };
  Object.keys(isi || {}).forEach(function (k) { body[k] = isi[k]; });
  var r = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'text/plain;charset=utf-8', payload: JSON.stringify(body), muteHttpExceptions: true
  });
  var teks = r.getContentText();
  var j;
  try {
    j = JSON.parse(teks);
  } catch (err) {
    throw new Error('Supabase menjawab ' + r.getResponseCode() + ' yang bukan JSON: ' + teks.slice(0, 300));
  }
  if (!j || !j.ok) throw new Error('Supabase: ' + (j && j.pesan ? j.pesan : 'jawaban ' + r.getResponseCode()));
  return j.data;
}

/** Menjalankan fungsi Code.gs di Supabase dan menulis catatannya ke log editor ini. */
function teruskanKeSupabase_(nama, argumen) {
  console.log('Dijalankan di Supabase: ' + nama + '.');
  var h = panggilSupabase_('__fungsi', { nama: nama, argumen: argumen || [] });
  (h.catatan || []).forEach(function (c) { console.log(c); });
  return h.keluaran;
}

function nilaiKeSupabase_(v) {
  return v instanceof Date ? { $d: v.getTime() } : v;
}

function nilaiDariSupabase_(v) {
  return v && typeof v === 'object' && v.$d != null ? new Date(v.$d) : v;
}

/**
 * Jalankan SEKALI dari editor Apps Script setelah Supabase disiapkan (lihat supabase/PANDUAN.md). Selama berjalan
 * aplikasi menolak isian baru ("sudah pindah ke server baru"), supaya tidak ada isian yang tertinggal di Sheet.
 * Sesudahnya config.js diarahkan ke Supabase; HP yang masih memakai alamat lama dialihkan otomatis.
 */
function pindahKeSupabase() {
  if (DI_SUPABASE_) throw new Error('pindahKeSupabase dijalankan dari editor Apps Script, bukan di Supabase.');
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty(PROP_SUDAH_PINDAH)) {
    throw new Error('Sudah pindah ke Supabase pada ' + props.getProperty(PROP_SUDAH_PINDAH) + '. Menjalankan ulang akan ' +
      'menimpa data di Supabase dengan isi Sheet ini. Jika memang itu yang diinginkan: hapus Script Property SUDAH_PINDAH, ' +
      'isi TIMPA_SUPABASE dengan ya, lalu jalankan lagi.');
  }
  panggilSupabase_('ping', {});
  var ss = SpreadsheetApp.getActiveSpreadsheet() || bukaSpreadsheet_();
  var kunci = LockService.getScriptLock();
  kunci.waitLock(30000);
  props.setProperty(PROP_SUDAH_PINDAH, Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm'));
  try {
    var semua = props.getProperties();
    var properti = {};
    Object.keys(semua).forEach(function (k) { if (PROP_TIDAK_DIPINDAH.indexOf(k) < 0) properti[k] = semua[k]; });
    var sheets = ss.getSheets();
    panggilSupabase_('__impor', {
      langkah: 'mulai',
      timpa: String(props.getProperty(PROP_TIMPA_SUPABASE) || '').trim().toLowerCase() === 'ya',
      tab: sheets.map(function (sh, i) {
        return { nama: sh.getName(), urutan: i + 1,
          meta: { id: sh.getSheetId(), maksBaris: sh.getMaxRows(), maksKolom: sh.getMaxColumns(), beku: sh.getFrozenRows() } };
      }),
      properti: properti,
      info: { namaSpreadsheet: ss.getName(), alamatSheet: ss.getUrl(), zona: ss.getSpreadsheetTimeZone(),
        emailPemilik: Session.getEffectiveUser().getEmail() }
    });
    var jumlah = 0;
    sheets.forEach(function (sh) {
      var nama = sh.getName();
      if (/^Harian_/.test(nama) || nama === 'Dashboard' || !sh.getLastRow()) return;
      var nilai = sh.getDataRange().getValues();
      for (var dari = 0; dari < nilai.length; dari += BARIS_PER_KIRIMAN_IMPOR) {
        var potong = nilai.slice(dari, dari + BARIS_PER_KIRIMAN_IMPOR).map(function (b) { return b.map(nilaiKeSupabase_); });
        panggilSupabase_('__impor', { langkah: 'baris', nama: nama, dari: dari + 1, nilai: potong });
      }
      jumlah += nilai.length;
      console.log('Dipindah: ' + nama + ' (' + nilai.length + ' baris).');
    });
    var hasil = panggilSupabase_('__impor', { langkah: 'selesai' });
    props.setProperty(PROP_SINKRON_VERSI, JSON.stringify(hasil.versi || {}));
    props.deleteProperty(PROP_TIMPA_SUPABASE);
    console.log('Data pindah: ' + sheets.length + ' tab, ' + jumlah + ' baris.');
  } catch (err) {
    props.deleteProperty(PROP_SUDAH_PINDAH);
    throw err;
  } finally {
    kunci.releaseLock();
  }
  pasangSinkron_();
  teruskanKeSupabase_('pasangTrigger');
  sinkronDariSupabase();
  console.log('Selesai. Ubah config.js ke alamat Supabase, lalu buka aplikasi dari HP. Sheet ini kini salinan yang ' +
    'diperbarui tiap ' + MENIT_SINKRON + ' menit; perubahan yang diketik langsung di Sheet akan tertimpa.');
}

/* ---------- Pemulihan cadangan (Code.gs v0.26; spesifikasi sistem Bagian 9.4) ----------
 * Cadangan mingguan di Supabase berupa berkas JSON yang disalin ke Drive (Laporan Kitchen/Cadangan). Tiga fungsi editor:
 * - periksaCadangan       : membaca cadangan terbaru (atau yang namanya di Script Property PULIHKAN_CADANGAN) dari Drive
 *                           dan mencatat isinya per tab dibanding Sheet sekarang. Tidak mengubah apa pun.
 * - ujiPemulihanCadangan  : uji lengkap tanpa kehilangan data: aplikasi ditutup sebentar, isi sekarang dicadangkan,
 *                           berkas itu dibaca lagi dari Drive dan dipulihkan, lalu jumlah baris tiap tab dicocokkan.
 * - pulihkanCadangan      : memulihkan berkas yang namanya diisi di PULIHKAN_CADANGAN (isian sesudah cadangan itu hilang;
 *                           isi sebelum pemulihan tetap disimpan sebagai "Cadangan sebelum pemulihan …").
 * Selama pemulihan, Supabase menolak aksi aplikasi dengan cobaLagi (isian di HP masuk antrean).
 */

var PROP_PULIHKAN_CADANGAN = 'PULIHKAN_CADANGAN';
var TAB_WAJIB_CADANGAN = ['M_Staff', 'M_Konfigurasi', 'M_Item'];
var POLA_ISO_CADANGAN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

/** Berkas cadangan JSON di Drive (Laporan Kitchen/Cadangan), terbaru dulu: [{ berkas, nama, dibuat, ukuran }]. */
function daftarCadanganDrive_() {
  var daftar = [];
  var it = folderCadangan_().getFiles();
  while (it.hasNext()) {
    var f = it.next();
    if (f.isTrashed && f.isTrashed()) continue;
    if (!/^Cadangan .*\.json$/.test(f.getName())) continue;
    daftar.push({ berkas: f, nama: f.getName(), dibuat: f.getDateCreated(), ukuran: f.getSize() });
  }
  return daftar.sort(function (a, b) { return b.dibuat.getTime() - a.dibuat.getTime(); });
}

function catatDaftarCadangan_(daftar) {
  if (!daftar.length) return console.log('Belum ada cadangan JSON di Drive: ' + FOLDER_LAPORAN + '/' + FOLDER_CADANGAN + '.');
  console.log('Cadangan di Drive (' + FOLDER_LAPORAN + '/' + FOLDER_CADANGAN + '), terbaru dulu:');
  daftar.forEach(function (c) {
    console.log('- ' + c.nama + ' (' + Math.max(1, Math.round(c.ukuran / 1024)) + ' KB)');
  });
}

/** Membaca satu cadangan dari Drive (nama berkas, boleh tanpa .json; kosong = terbaru): { nama, data }. */
function bacaCadanganDrive_(nama) {
  var daftar = daftarCadanganDrive_();
  var cari = String(nama || '').trim();
  if (cari && !/\.json$/i.test(cari)) cari += '.json';
  var c = cari ? daftar.filter(function (x) { return x.nama === cari; })[0] : daftar[0];
  if (!c) {
    catatDaftarCadangan_(daftar);
    throw new Error(cari ? 'Cadangan ' + cari + ' tidak ada di ' + FOLDER_LAPORAN + '/' + FOLDER_CADANGAN + '. Salin namanya persis dari daftar di log.'
      : 'Belum ada cadangan JSON di Drive.');
  }
  var data;
  try {
    data = JSON.parse(c.berkas.getBlob().getDataAsString('UTF-8'));
  } catch (err) {
    throw new Error('Cadangan ' + c.nama + ' tidak bisa dibaca sebagai JSON: ' + (err && err.message ? err.message : err));
  }
  return { nama: c.nama, data: data };
}

/**
 * Memeriksa isi cadangan: { tab: [{ nama, baris }], baris, masalah: [teks], kurang: [nama tab] }. masalah = tidak bisa dipulihkan;
 * kurang = tab yang ada di Code.gs ini tetapi tidak ada di cadangan (dibuat lagi oleh setupSpreadsheet sesudah pemulihan).
 */
function periksaIsiCadangan_(data) {
  var hasil = { tab: [], baris: 0, masalah: [], kurang: [] };
  if (!data || typeof data !== 'object' || !Array.isArray(data.tab)) {
    hasil.masalah.push('Berkas ini bukan cadangan InventoryKu (tidak punya daftar tab).');
    return hasil;
  }
  if (data.format && data.format > FORMAT_CADANGAN) {
    hasil.masalah.push('Cadangan format ' + data.format + ' dibuat Code.gs yang lebih baru. Tempel Code.gs terbaru dulu.');
  }
  var ada = {};
  data.tab.forEach(function (t) {
    var nama = t && typeof t.nama === 'string' ? t.nama : '';
    if (!nama || ada[nama]) {
      hasil.masalah.push(nama ? 'Tab ' + nama + ' ada dua kali.' : 'Ada tab tanpa nama.');
      return;
    }
    ada[nama] = true;
    if (!Array.isArray(t.nilai) || t.nilai.some(function (b) { return !Array.isArray(b); })) {
      hasil.masalah.push('Isi tab ' + nama + ' rusak.');
      return;
    }
    hasil.tab.push({ nama: nama, baris: t.nilai.length });
    hasil.baris += t.nilai.length;
  });
  TAB_WAJIB_CADANGAN.forEach(function (n) {
    var t = data.tab.filter(function (x) { return x && x.nama === n; })[0];
    if (!t || !Array.isArray(t.nilai) || !t.nilai.length) hasil.masalah.push('Tab ' + n + ' tidak ada atau kosong.');
  });
  TAB_MASTER.concat(TAB_DATA).forEach(function (d) { if (!ada[d.nama]) hasil.kurang.push(d.nama); });
  return hasil;
}

/** Nilai sel cadangan untuk __impor: tanggal { $d } (format 2) tetap; teks ISO (format 1) menjadi { $d }. */
function nilaiCadangan_(v, format) {
  if (v && typeof v === 'object') return v.$d != null ? { $d: Number(v.$d) } : '';
  if (format < 2 && typeof v === 'string' && POLA_ISO_CADANGAN.test(v)) return { $d: new Date(v).getTime() };
  return v == null ? '' : v;
}

function keteranganCadangan_(c) {
  var d = c.data || {};
  return c.nama + (d.dibuat ? ', dibuat ' + Utilities.formatDate(new Date(d.dibuat), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') : '') +
    (d.versiKode ? ', Code.gs ' + d.versiKode : '') + ', format ' + (d.format || 1);
}

/**
 * Editor: memeriksa cadangan tanpa mengubah apa pun. Yang diperiksa: berkas terbaru di Drive, atau yang namanya diisi di
 * Script Property PULIHKAN_CADANGAN.
 */
function periksaCadangan() {
  if (DI_SUPABASE_) throw new Error('periksaCadangan dijalankan dari editor Apps Script.');
  var nama = String(PropertiesService.getScriptProperties().getProperty(PROP_PULIHKAN_CADANGAN) || '').trim();
  catatDaftarCadangan_(daftarCadanganDrive_());
  var c = bacaCadanganDrive_(nama);
  var cek = periksaIsiCadangan_(c.data);
  console.log('Diperiksa: ' + keteranganCadangan_(c) + '. ' + cek.tab.length + ' tab, ' + cek.baris + ' baris.');
  var ss = SpreadsheetApp.getActiveSpreadsheet() || bukaSpreadsheet_();
  cek.tab.forEach(function (t) {
    var sh = ss.getSheetByName(t.nama);
    console.log('- ' + t.nama + ': ' + t.baris + ' baris' + (sh && tabDisalin_(t.nama) ? ' (Sheet sekarang ' + sh.getLastRow() + ')' : ''));
  });
  if (cek.kurang.length) {
    console.log('Tab yang tidak ada di cadangan ini (dibuat lagi kosong oleh setupSpreadsheet sesudah pemulihan): ' + cek.kurang.join(', ') + '.');
  }
  if (cek.masalah.length) {
    console.error('Cadangan ini TIDAK bisa dipulihkan: ' + cek.masalah.join(' '));
    return { bisa: false, masalah: cek.masalah };
  }
  console.log('Cadangan bisa dibaca dan dipulihkan. Untuk memulihkannya: isi Script Property ' + PROP_PULIHKAN_CADANGAN + ' dengan "' +
    c.nama + '", lalu jalankan pulihkanCadangan. Isian sesudah cadangan ini dibuat akan hilang.');
  return { bisa: true, nama: c.nama, tab: cek.tab.length, baris: cek.baris };
}

/** Tab berumus milik Sheets tidak disalin dari Supabase (sama dengan tabDisalin di sinkron.js). */
function tabDisalin_(nama) {
  return !/^Harian_/.test(nama) && nama !== 'Dashboard';
}

/**
 * Editor: memulihkan cadangan yang namanya diisi di Script Property PULIHKAN_CADANGAN (salin dari log periksaCadangan).
 * Isi database Supabase diganti isi cadangan; isian sesudah cadangan itu dibuat hilang. Sebelum menimpa, isi sekarang
 * disimpan sebagai "Cadangan sebelum pemulihan …" (bisa dipulihkan dengan cara yang sama). PIN, sesi, dan notifikasi HP
 * tetap (Script Properties di Supabase tidak ikut cadangan).
 */
function pulihkanCadangan() {
  if (DI_SUPABASE_) throw new Error('pulihkanCadangan dijalankan dari editor Apps Script.');
  if (!sudahPindah_()) {
    throw new Error('Pemulihan ini untuk cadangan JSON dari Supabase. Sebelum pindah ke Supabase, cadangan berupa salinan ' +
      'spreadsheet di ' + FOLDER_LAPORAN + '/' + FOLDER_CADANGAN + ' yang dibuka langsung di Google Sheets.');
  }
  var props = PropertiesService.getScriptProperties();
  var nama = String(props.getProperty(PROP_PULIHKAN_CADANGAN) || '').trim();
  if (!nama) {
    catatDaftarCadangan_(daftarCadanganDrive_());
    console.log('Belum ada cadangan yang dipilih. Jalankan periksaCadangan dulu, lalu isi Script Property ' + PROP_PULIHKAN_CADANGAN +
      ' dengan nama berkas cadangan yang akan dipulihkan (misalnya dari daftar di atas), dan jalankan pulihkanCadangan lagi.');
    return null;
  }
  var hasil = jalankanPemulihan_(nama);
  props.deleteProperty(PROP_PULIHKAN_CADANGAN);
  console.log('Pemulihan selesai: ' + hasil.nama + ' (' + hasil.tab + ' tab, ' + hasil.baris + ' baris). Isi sebelum pemulihan disimpan ' +
    'sebagai ' + (hasil.sebelum || '(database kosong, tidak dicadangkan)') + '. Aplikasi sudah dibuka lagi.');
  return hasil;
}

/**
 * Editor: uji pemulihan tanpa kehilangan isian. Aplikasi ditutup sebentar (isian di HP masuk antrean), isi sekarang
 * dicadangkan ke Drive, berkas itu dibaca lagi dari Drive dan dipulihkan, lalu jumlah baris tiap tab dicocokkan.
 * Jalankan sebulan sekali, pada jam sepi.
 */
function ujiPemulihanCadangan() {
  if (DI_SUPABASE_) throw new Error('ujiPemulihanCadangan dijalankan dari editor Apps Script.');
  if (!sudahPindah_()) throw new Error('Uji pemulihan cadangan hanya untuk data di Supabase (sesudah pindahKeSupabase).');
  var hasil = jalankanPemulihan_(null);
  console.log('Uji pemulihan berhasil: ' + hasil.nama + ' dibaca dari Drive dan dipulihkan; ' + hasil.tab + ' tab, ' + hasil.baris +
    ' baris, jumlah baris tiap tab cocok. Aplikasi sudah dibuka lagi.');
  return hasil;
}

/**
 * Pemulihan bersama. nama: berkas di Drive, atau null (uji: berkas "Cadangan sebelum pemulihan" yang baru dibuat).
 * Langkah: tutup aplikasi → cadangan sebelum pemulihan (jika database berisi) → salin ke Drive → baca dan periksa →
 * __impor mulai/baris/selesai (Supabase mencocokkan jumlah baris) → setupSpreadsheet dan pasangTrigger → salinan ke Sheet.
 * Gagal sebelum isi database dihapus: aplikasi dibuka lagi. Gagal sesudahnya: aplikasi tetap ditutup sampai pemulihan
 * berhasil dijalankan ulang.
 */
function jalankanPemulihan_(nama) {
  var props = PropertiesService.getScriptProperties();
  // Tanpa ping: aksi aplikasi ditolak selama aplikasi ditutup (pemulihan yang berhenti di tengah dijalankan ulang).
  var kunci = LockService.getScriptLock();
  kunci.waitLock(30000);
  var mulai = false;
  var c;
  var sebelum = '';
  var harapan = {};
  try {
    var tutup = panggilSupabase_('__pulihkan', { langkah: 'tutup', berkas: nama || '(uji pemulihan)' });
    console.log('Aplikasi ditutup selama pemulihan. Isian dari HP menunggu di antrean HP.');
    if (tutup.setengah) {
      // Pemulihan sebelumnya berhenti di tengah: isi database belum lengkap, jadi tidak dicadangkan lagi.
      mulai = true;
      if (!nama) throw new Error('Pemulihan sebelumnya belum selesai. Jalankan pulihkanCadangan dulu, bukan uji.');
      console.log('Pemulihan sebelumnya belum selesai; isi database sekarang tidak dicadangkan lagi.');
    } else if (tutup.baris > 0) {
      sebelum = teruskanKeSupabase_('buatCadanganSebelumPulih').nama;
      salinBerkasKeDrive_();
    } else if (!nama) {
      throw new Error('Database Supabase masih kosong, jadi tidak ada yang bisa diuji.');
    }
    c = bacaCadanganDrive_(nama || sebelum);
    var cek = periksaIsiCadangan_(c.data);
    if (cek.masalah.length) throw new Error('Cadangan ' + c.nama + ' tidak bisa dipulihkan: ' + cek.masalah.join(' '));
    console.log('Dipulihkan: ' + keteranganCadangan_(c) + '.');
    var ss = SpreadsheetApp.getActiveSpreadsheet() || bukaSpreadsheet_();
    var format = Number(c.data.format) || 1;
    var tab = c.data.tab;
    mulai = true;
    panggilSupabase_('__impor', {
      langkah: 'mulai',
      timpa: true,
      pemulihan: true,
      tab: tab.map(function (t, i) { return { nama: t.nama, urutan: i + 1, meta: t.meta || {} }; }),
      info: { namaSpreadsheet: ss.getName(), alamatSheet: ss.getUrl(), zona: ss.getSpreadsheetTimeZone(),
        emailPemilik: Session.getEffectiveUser().getEmail() }
    });
    tab.forEach(function (t) {
      harapan[t.nama] = t.nilai.length;
      for (var dari = 0; dari < t.nilai.length; dari += BARIS_PER_KIRIMAN_IMPOR) {
        var potong = t.nilai.slice(dari, dari + BARIS_PER_KIRIMAN_IMPOR).map(function (b) {
          return b.map(function (v) { return nilaiCadangan_(v, format); });
        });
        panggilSupabase_('__impor', { langkah: 'baris', nama: t.nama, dari: dari + 1, nilai: potong });
      }
    });
    // Supabase mencocokkan jumlah baris tiap tab, lalu membuka aplikasi lagi. Salinan ke Sheet berikutnya menyalin semua tab penuh.
    panggilSupabase_('__impor', { langkah: 'selesai', pemulihan: true, harapan: harapan });
    props.setProperty(PROP_SINKRON_VERSI, '{}');
  } catch (err) {
    if (!mulai) {
      try {
        if (!panggilSupabase_('__pulihkan', { langkah: 'buka' }).dibuka) throw new Error('pemulihan sebelumnya belum selesai');
        console.error('Pemulihan dibatalkan sebelum isi database diubah; aplikasi dibuka lagi.');
      } catch (err2) {
        console.error('Aplikasi tidak bisa dibuka lagi: ' + err2 + '. Jalankan ulang fungsi ini.');
      }
    } else {
      console.error('Pemulihan berhenti di tengah. Aplikasi tetap ditutup supaya tidak ada isian yang masuk ke data yang belum ' +
        'lengkap. Jalankan ulang fungsi yang sama' + (sebelum ? ', atau pulihkan ' + sebelum + ' (isi sebelum pemulihan)' : '') + '.');
    }
    throw err;
  } finally {
    kunci.releaseLock();
  }
  // Kolom dan tab versi sekarang yang belum ada di cadangan lama, lalu jadwal (database di project baru belum punya jadwal).
  teruskanKeSupabase_('setupSpreadsheet');
  teruskanKeSupabase_('pasangTrigger');
  try {
    sinkronDariSupabase();
  } catch (err) {
    console.error('Salinan ke Sheet sesudah pemulihan belum selesai (dicoba lagi 5 menit kemudian): ' + err);
  }
  var baris = Object.keys(harapan).reduce(function (a, k) { return a + harapan[k]; }, 0);
  return { nama: c.nama, sebelum: sebelum, tab: Object.keys(harapan).length, baris: baris };
}

/** Menghapus semua trigger Apps Script (laporan, cadangan, rekap kini di Supabase) dan memasang salinan tiap 5 menit. */
function pasangSinkron_() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('sinkronDariSupabase').timeBased().everyMinutes(MENIT_SINKRON).create();
  console.log('Trigger salinan dari Supabase terpasang: tiap ' + MENIT_SINKRON + ' menit.');
}

/** Trigger tiap 5 menit (dipasang pindahKeSupabase atau pasangTrigger sesudah pindah). */
function sinkronDariSupabase() {
  if (!sudahPindah_()) return;
  var kunci = LockService.getScriptLock();
  if (!kunci.tryLock(5000)) return;
  var galat = [];
  var langkah = [
    ['berkas', salinBerkasKeDrive_],
    ['tab', salinTabKeSheet_],
    ['email', kirimSurelLewatGmail_]
  ];
  try {
    langkah.forEach(function (l) {
      try {
        l[1]();
      } catch (err) {
        console.error('Salinan ' + l[0] + ' gagal: ' + (err && err.stack ? err.stack : err));
        galat.push(l[0] + ': ' + (err && err.message ? err.message : err));
      }
    });
  } finally {
    kunci.releaseLock();
  }
  if (galat.length) throw new Error('Salinan dari Supabase belum lengkap. ' + galat.join(' | '));
}

/** Folder Drive dari jalur "Laporan Kitchen/Outlet/2026/10 Oktober". */
function folderDariJalur_(jalur) {
  var folder = DriveApp.getRootFolder();
  String(jalur || '').split('/').filter(function (x) { return x; }).forEach(function (n) {
    folder = cariAtauBuatFolder_(folder, n);
  });
  return folder;
}

function salinBerkasKeDrive_() {
  var mulai = Date.now();
  for (var putaran = 0; putaran < 10 && Date.now() - mulai < 90 * 1000; putaran++) {
    var d = panggilSupabase_('__berkas', {});
    var salin = [];
    d.salin.forEach(function (b) {
      try {
        var blob = UrlFetchApp.fetch(b.url).getBlob().setName(b.nama);
        if (b.mime) blob.setContentType(b.mime);
        var folder = folderDariJalur_(b.jalur);
        var f = folder.createFile(blob);
        // Berkas arsip tahunan (Code.gs v0.20) juga ditulis ke Google Sheets "Arsip InventoryKu {Tahun}".
        if (/^Arsip_\d{4}_.+\.json$/.test(b.nama)) {
          try {
            arsipJsonKeSheets_(blob.getDataAsString(), b.nama, folder);
          } catch (err) {
            console.error('Arsip ' + b.nama + ' tidak bisa ditulis ke Google Sheets: ' + err);
          }
        }
        salin.push({ id: b.id, driveId: f.getId(), url: f.getUrl() });
      } catch (err) {
        console.error('Berkas ' + b.jalur + '/' + b.nama + ' gagal disalin ke Drive: ' + err);
      }
    });
    var buang = [];
    d.buang.forEach(function (b) {
      try {
        DriveApp.getFileById(b.driveId).setTrashed(true);
      } catch (err) {
        console.error('Salinan berkas di Drive tidak bisa dibuang: ' + err);
      }
      buang.push(b.id);
    });
    if (salin.length || buang.length) panggilSupabase_('__berkasTersalin', { salin: salin, buang: buang });
    if (!salin.length && !buang.length) break;
    if (salin.length < d.salin.length) break; // ada yang gagal: dicoba lagi 5 menit kemudian
  }
}

/** Tab master dulu (dropdown di tab lain merujuknya), lalu tab lain menurut urutan di Supabase. */
function urutanSalinTab_(daftar) {
  var awal = ['M_Kategori', 'M_Satuan', 'M_Item', 'M_Unit', 'M_Form', 'M_FormKolom'];
  return daftar.slice().sort(function (a, b) {
    var ia = awal.indexOf(a.nama);
    var ib = awal.indexOf(b.nama);
    var ma = ia >= 0 ? ia : (/^M_/.test(a.nama) ? awal.length : awal.length + 1);
    var mb = ib >= 0 ? ib : (/^M_/.test(b.nama) ? awal.length : awal.length + 1);
    return ma - mb || (a.urutan || 0) - (b.urutan || 0);
  });
}

function salinTabKeSheet_() {
  var props = PropertiesService.getScriptProperties();
  var versi = JSON.parse(props.getProperty(PROP_SINKRON_VERSI) || '{}');
  var mulai = Date.now();
  var ss = SpreadsheetApp.getActiveSpreadsheet() || bukaSpreadsheet_();
  // Sekali sehari semua tab disalin penuh, supaya ketikan langsung di Sheet tertimpa dan salinan pasti sama.
  var zona = ss.getSpreadsheetTimeZone();
  var hari = Utilities.formatDate(new Date(), zona, 'yyyy-MM-dd');
  var penuh = props.getProperty(PROP_SINKRON_PENUH) !== hari && Number(Utilities.formatDate(new Date(), zona, 'H')) >= JAM_SINKRON_PENUH;
  if (penuh) versi = {};
  for (var putaran = 0; putaran < 20; putaran++) {
    var d = panggilSupabase_('__sinkron', { versi: versi });
    var ditulis = {};
    urutanSalinTab_(d.tab).forEach(function (t) {
      var sheet = ss.getSheetByName(t.nama) || buatTabSalinan_(ss, t.nama);
      if (!t.penuh && barisKunciTerakhir_(sheet, 1) !== t.barisLama) {
        // Isi Sheet tidak seperti yang dikira Supabase (baris diketik atau dihapus langsung): tab ini disalin penuh.
        console.log('Tab ' + t.nama + ' berbeda dari salinan terakhir; disalin penuh.');
        delete versi[t.nama];
        return;
      }
      if (t.penuh) tulisTabPenuh_(sheet, t.nilai, t.lebar);
      else jalankanLangkahSalin_(sheet, t.langkah, t.lebar);
      versi[t.nama] = t.versi;
      ditulis[t.nama] = t.versi;
      props.setProperty(PROP_SINKRON_VERSI, JSON.stringify(versi));
    });
    var ulangi = d.tab.some(function (t) { return !Object.prototype.hasOwnProperty.call(versi, t.nama); });
    if (Object.keys(ditulis).length) {
      SpreadsheetApp.flush();
      panggilSupabase_('__sinkronSelesai', { versi: ditulis });
      console.log('Disalin dari Supabase: ' + d.tab.filter(function (t) { return ditulis[t.nama]; }).map(function (t) {
        return t.nama + (t.penuh ? ' (penuh, ' + t.nilai.length + ' baris)' : ' (' + t.langkah.length + ' langkah)');
      }).join(', ') + '.');
    }
    if (d.selesai && !ulangi) {
      if (penuh) props.setProperty(PROP_SINKRON_PENUH, hari);
      break;
    }
    if (Date.now() - mulai > 4 * 60 * 1000) break;
  }
}

/** Tab yang belum ada di Sheet: tab form kustom dibuat lengkap dengan format; tab lain kosong. */
function buatTabSalinan_(ss, nama) {
  if (nama.indexOf(AWALAN_TAB_KUSTOM) === 0) {
    SS_ = null;
    resetMemoForm_();
    var id = nama.slice(AWALAN_TAB_KUSTOM.length);
    var f = cariForm_(id, true);
    if (f) {
      try {
        return siapkanTabKustom_(ss, f, kolomForm_(id), {});
      } catch (err) {
        console.error('Tab ' + nama + ' dibuat tanpa format: ' + err);
      }
    }
  }
  return ss.getSheetByName(nama) || ss.insertSheet(nama);
}

function barisSalin_(b, lebar) {
  var a = [];
  for (var i = 0; i < lebar; i++) a.push(i < b.length ? nilaiDariSupabase_(b[i]) : '');
  return a;
}

function tulisTabPenuh_(sheet, nilai, lebar) {
  var n = nilai.length;
  if (lebar < 1) lebar = 1;
  pastikanJumlahKolom_(sheet, lebar);
  if (sheet.getMaxRows() < n + 1) sheet.insertRowsAfter(sheet.getMaxRows(), n + 1 - sheet.getMaxRows());
  if (n) sheet.getRange(1, 1, n, lebar).setValues(nilai.map(function (b) { return barisSalin_(b, lebar); }));
  var akhir = sheet.getLastRow();
  if (akhir > n) sheet.getRange(n + 1, 1, akhir - n, sheet.getMaxColumns()).clearContent();
  var kanan = sheet.getLastColumn();
  if (n && kanan > lebar) sheet.getRange(1, lebar + 1, n, kanan - lebar).clearContent();
}

/** Langkah dari Supabase dijalankan berurutan: { hapus, jumlah } | { sisip, nilai } | { ubah, nilai } (nomor baris Sheet). */
function jalankanLangkahSalin_(sheet, langkah, lebar) {
  if (lebar < 1) lebar = 1;
  pastikanJumlahKolom_(sheet, lebar);
  langkah.forEach(function (l) {
    if (l.hapus != null) {
      sheet.deleteRows(l.hapus, l.jumlah);
      return;
    }
    var nilai = l.nilai.map(function (b) { return barisSalin_(b, lebar); });
    var baris = l.sisip != null ? l.sisip : l.ubah;
    if (l.sisip != null && baris <= sheet.getLastRow()) {
      sheet.insertRowsBefore(baris, nilai.length);
    } else if (baris + nilai.length - 1 > sheet.getMaxRows()) {
      sheet.insertRowsAfter(sheet.getMaxRows(), baris + nilai.length - 1 - sheet.getMaxRows());
    }
    sheet.getRange(baris, 1, nilai.length, lebar).setValues(nilai);
  });
}

function kirimSurelLewatGmail_() {
  var daftar = panggilSupabase_('__surel', {});
  if (!daftar.length) return;
  var hasil = daftar.map(function (s) {
    try {
      var opsi = {
        to: s.to, subject: s.subject, body: s.body || '', name: s.name || 'InventoryKu',
        attachments: (s.attachments || []).map(function (a) {
          return Utilities.newBlob(Utilities.base64Decode(a.data), a.mime, a.nama);
        })
      };
      if (s.htmlBody) opsi.htmlBody = s.htmlBody;
      MailApp.sendEmail(opsi);
      return { id: s.id };
    } catch (err) {
      return { id: s.id, galat: String(err && err.message ? err.message : err) };
    }
  });
  panggilSupabase_('__surelTerkirim', { hasil: hasil });
  console.log('Email dikirim dari Gmail: ' + hasil.filter(function (h) { return !h.galat; }).length + ' dari ' + hasil.length + '.');
}

/* =========================================================================
 * Susunan spreadsheet (spesifikasi sistem Bagian 5 dan 8)
 * ========================================================================= */

/** Warna dari spesifikasi tampilan Bagian 2. Amber tidak dipakai di spreadsheet. */
var WARNA = {
  navyPass: '#0B1F3A',
  biruMalam: '#16335C',
  baja: '#F3F5F8',
  kertas: '#FFFFFF',
  tinta: '#0F1B2D',
  tintaRedup: '#4A5A72',
  teksDiNavy: '#A9B8CF',
  relPadam: '#5A6F8F',
  garis: '#C5CEDA',
  garisIsian: '#6F7E96',
  masalah: '#B42318',
  tinjau: '#B54708'
};

/** Warna tab per kelompok (spesifikasi sistem Bagian 8.2). */
var WARNA_TAB = {
  dashboard: WARNA.navyPass,
  harian: WARNA.biruMalam,
  data: WARNA.relPadam,
  master: WARNA.teksDiNavy,
  log: WARNA.garis
};

/** Format seragam di semua tab (spesifikasi sistem Bagian 8.4). */
var FORMAT = {
  teks: '@',
  tanggal: 'yyyy-mm-dd',
  waktu: 'yyyy-mm-dd hh:mm:ss',
  angka: '#,##0.00',
  suhu: '0.0',
  rupiah: '"Rp "#,##0',
  bulat: '0'
};

/** Kolom sistem di setiap tab Data (spesifikasi sistem Bagian 5.0). */
var KOLOM_SISTEM = [
  { nama: 'submission_id', format: 'teks' },
  { nama: 'row_id', format: 'teks' },
  { nama: 'outlet', format: 'teks' },
  { nama: 'timestamp_server', format: 'waktu' },
  { nama: 'timestamp_device', format: 'waktu' },
  { nama: 'submitted_by', format: 'teks' },
  { nama: 'status', format: 'teks' },
  { nama: 'checked_by', format: 'teks' },
  { nama: 'checked_at', format: 'waktu' },
  { nama: 'updated_by', format: 'teks' },
  { nama: 'updated_at', format: 'waktu' },
  { nama: 'flagged_by', format: 'teks' },
  { nama: 'flag_note', format: 'teks' }
];

/** Definisi satu kolom. format null = tanpa format angka (misalnya kotak centang). */
function k_(nama, format, lain) {
  var kolom = { nama: nama, format: format === null ? null : (format || 'teks') };
  if (lain) {
    for (var kunci in lain) kolom[kunci] = lain[kunci];
  }
  return kolom;
}

/**
 * Tab Data dan Stock_Harian: kolom form di kiri, kolom sistem di kanan.
 * sistem: daftar kolom sistem (bawaan KOLOM_SISTEM).
 */
var TAB_DATA = [
  {
    nama: 'Stock_Harian',
    kolom: [
      k_('Tanggal', 'tanggal'), k_('Kategori'), k_('Nama Item'),
      k_('Stock Awal', 'angka'), k_('Stock Masuk', 'angka'), k_('Hasil Prep', 'angka'),
      k_('Stock Keluar', 'angka'), k_('Dipakai Prep', 'angka'), k_('Waste', 'angka'),
      k_('Penyesuaian', 'angka'), k_('Stock Akhir', 'angka'), k_('Satuan')
    ],
    sistem: [
      { nama: 'outlet', format: 'teks' },
      { nama: 'timestamp_server', format: 'waktu' }
    ]
  },
  {
    nama: 'Data_Stock',
    kolom: [
      k_('Tanggal', 'tanggal'), k_('Kategori'), k_('Nama Item'),
      k_('Stock Masuk', 'angka'), k_('Stock Keluar', 'angka'), k_('Satuan'),
      k_('Masuk Diketik'), k_('Pemasok'), k_('Harga Beli (Rp)', 'rupiah'), k_('Baik Sampai', 'tanggal'),
      k_('Sisa Dihitung', 'angka')
    ]
  },
  {
    nama: 'Data_Suhu',
    kolom: [
      k_('Tanggal', 'tanggal'), k_('Waktu Cek'), k_('Nama Unit'), k_('Tipe Unit'),
      k_('Suhu (°C)', 'suhu'), k_('Status Suhu'), k_('Tindakan Korektif'), k_('Nama Staff')
    ]
  },
  {
    nama: 'Data_Prep',
    kolom: [
      k_('Tanggal', 'tanggal'), k_('Shift'), k_('Nama Staff'), k_('Item / Menu Prep'),
      k_('Jumlah Resep', 'angka'), k_('Hasil per 1 Resep', 'angka'), k_('Hasil', 'angka'),
      k_('Qty', 'angka'), k_('Satuan'), k_('Baik Sampai', 'tanggal'), k_('Keterangan'), k_('Hasil Aktual', 'angka')
    ]
  },
  {
    nama: 'Data_PrepBahan',
    kolom: [
      k_('Tanggal', 'tanggal'), k_('Item Hasil'), k_('Item Bahan'),
      k_('Jumlah Resep', 'angka'), k_('Qty per 1 Resep', 'angka'), k_('Qty Terpakai', 'angka'),
      k_('Satuan')
    ],
    sistem: KOLOM_SISTEM.concat([{ nama: 'prep_row_id', format: 'teks' }])
  },
  {
    nama: 'Data_Waste',
    kolom: [
      k_('Tanggal', 'tanggal'), k_('Shift'), k_('Nama Staff'), k_('Item / Produk'),
      k_('Kategori Waste'), k_('Qty', 'angka'), k_('Satuan'), k_('Alasan / Keterangan'),
      k_('Harga Satuan (Rp)', 'rupiah'), k_('Estimasi Kerugian (Rp)', 'rupiah'), k_('Foto Bukti')
    ]
  },
  {
    nama: 'Data_Penyesuaian',
    kolom: [
      k_('Tanggal', 'tanggal'), k_('Kategori'), k_('Nama Item'),
      k_('Stock Tercatat', 'angka'), k_('Stock Sebenarnya', 'angka'), k_('Selisih', 'angka'),
      k_('Satuan'), k_('Nilai Selisih (Rp)', 'rupiah'), k_('Alasan'), k_('Catatan')
    ]
  },
  {
    nama: 'Data_Opname',
    kolom: [
      k_('Tanggal', 'tanggal'), k_('Kategori'), k_('Nama Item'),
      k_('Stock Tercatat', 'angka'), k_('Hasil Hitung', 'angka'), k_('Selisih', 'angka'),
      k_('Satuan'), k_('Nilai Selisih (Rp)', 'rupiah')
    ]
  },
  {
    nama: 'Data_Nihil',
    kolom: [k_('Tanggal', 'tanggal'), k_('ID Form'), k_('Nama Form')]
  },
  {
    nama: 'Data_Penjualan',
    kolom: [k_('Tanggal', 'tanggal'), k_('Penjualan (Rp)', 'rupiah'), k_('Catatan')]
  },
  {
    nama: 'Data_PenjualanMenu',
    kolom: [k_('Tanggal', 'tanggal'), k_('Nama Menu'), k_('Porsi', 'bulat'), k_('Harga Jual (Rp)', 'rupiah')]
  },
  {
    // Pesanan ke pemasok (Code.gs v0.29): satu baris per item per pesanan; submission_id = id pesanan.
    nama: 'Data_Pesanan',
    kolom: [
      k_('Tanggal', 'tanggal'), k_('Pemasok'), k_('Nama Item'), k_('Kategori'),
      k_('Jumlah', 'angka'), k_('Satuan Order'), k_('Jumlah Dasar', 'angka'), k_('Satuan'),
      k_('Keadaan'),
      k_('Selesai Oleh'), k_('Selesai Pada', 'waktu'), k_('Kiriman Stock')
    ]
  }
];

var DAFTAR_SATUAN = 'M_Satuan!A2:A';

/** Tab master (spesifikasi sistem Bagian 5.1). */
var TAB_MASTER = [
  {
    nama: 'M_Outlet',
    kolom: [k_('Nama Outlet'), k_('Email Penerima Laporan')]
  },
  {
    nama: 'M_Unit',
    kolom: [
      k_('Nama Unit'),
      k_('Tipe', 'teks', { pilihan: ['Chiller', 'Freezer'] }),
      k_('Aktif', null, { centang: true })
    ]
  },
  {
    nama: 'M_Pemasok',
    kolom: [k_('Nama Pemasok'), k_('Kontak'), k_('Catatan'), k_('Aktif', null, { centang: true })]
  },
  {
    nama: 'M_Staff',
    proteksiKeras: true,
    kolom: [
      k_('Nama'),
      k_('Role', 'teks', { pilihan: ['Staff', 'Head Kitchen', 'Manager'] }),
      k_('PIN (hash)'),
      k_('Aktif', null, { centang: true }),
      k_('Permintaan Reset PIN', 'waktu'),
      k_('Dihapus', 'waktu')
    ]
  },
  {
    nama: 'M_Item',
    kolom: [
      k_('Nama Item'),
      k_('Kategori', 'teks', { sumber: 'M_Kategori!A2:A' }),
      k_('Satuan', 'teks', { sumber: DAFTAR_SATUAN }),
      k_('Satuan Besar', 'teks', { sumber: DAFTAR_SATUAN }),
      k_('Isi per Satuan Besar', 'angka'),
      k_('Harga Satuan (Rp)', 'rupiah'),
      k_('Stok Minimum', 'angka'),
      k_('Stok Maksimum', 'angka'),
      k_('Aktif', null, { centang: true }),
      k_('Masa Simpan (hari)', 'bulat')
    ]
  },
  {
    nama: 'M_HargaItem',
    kolom: [
      k_('Nama Item', 'teks', { sumber: 'M_Item!A2:A' }),
      k_('Berlaku Mulai', 'tanggal'),
      k_('Harga Satuan (Rp)', 'rupiah'),
      k_('Dicatat Oleh'),
      k_('Dicatat Pada', 'waktu')
    ]
  },
  {
    nama: 'M_Resep',
    kolom: [
      k_('Item Hasil', 'teks', { sumber: 'M_Item!A2:A' }),
      k_('Hasil per 1 Resep', 'angka'),
      k_('Masa Simpan (hari)', 'bulat'),
      k_('Aktif', null, { centang: true })
    ]
  },
  {
    nama: 'M_ResepBahan',
    kolom: [
      k_('Item Hasil', 'teks', { sumber: 'M_Resep!A2:A' }),
      k_('Item Bahan', 'teks', { sumber: 'M_Item!A2:A' }),
      k_('Qty per 1 Resep', 'angka')
    ]
  },
  {
    nama: 'M_Menu',
    kolom: [
      k_('Nama Menu'),
      k_('Harga Jual (Rp)', 'rupiah'),
      k_('Aktif', null, { centang: true })
    ]
  },
  {
    nama: 'M_MenuBahan',
    kolom: [
      k_('Nama Menu', 'teks', { sumber: 'M_Menu!A2:A' }),
      k_('Item Bahan', 'teks', { sumber: 'M_Item!A2:A' }),
      k_('Qty per Porsi', 'angka'),
      k_('Hasil Bersih (%)', 'angka')
    ]
  },
  {
    nama: 'M_Kategori',
    kolom: [k_('Nama Kategori'), k_('Urutan', 'bulat'), k_('Aktif', null, { centang: true })]
  },
  {
    nama: 'M_Satuan',
    kolom: [
      k_('Satuan'),
      k_('Jenis', 'teks', { pilihan: ['Berat', 'Isi', 'Hitungan', 'Kemasan'] }),
      k_('Aktif', null, { centang: true })
    ]
  },
  {
    nama: 'M_Form',
    kolom: [
      k_('ID Form'), k_('Nama'),
      k_('Jenis', 'teks', { pilihan: ['bawaan', 'kustom'] }),
      k_('Keterangan'),
      k_('Jadwal', 'teks', { pilihan: ['harian', 'hari tertentu', 'sewaktu-waktu'] }),
      k_('Urutan', 'bulat'),
      k_('Aktif', null, { centang: true }),
      k_('Hari'),
      k_('Diarsipkan', 'waktu')
    ]
  },
  {
    nama: 'M_FormKolom',
    kolom: [
      k_('ID Form', 'teks', { sumber: 'M_Form!A2:A' }),
      k_('Urutan', 'bulat'),
      k_('Label'),
      k_('Jenis Kolom', 'teks', { pilihan: ['Teks', 'Angka', 'Pilihan', 'Ya/Tidak', 'Item', 'Jam'] }),
      k_('Pilihan'),
      k_('Wajib', null, { centang: true }),
      k_('Bagian', 'teks', { pilihan: ['kepala', 'baris'] }),
      k_('Aktif', null, { centang: true }),
      k_('ID Kolom')
    ]
  },
  {
    // Hari libur (Code.gs v0.30): satu baris per tanggal; dihapus saat tanda libur dihapus.
    nama: 'M_HariLibur',
    kolom: [k_('Tanggal', 'tanggal'), k_('Keterangan'), k_('Dicatat Oleh'), k_('Dicatat Pada', 'waktu')]
  },
  {
    nama: 'M_Konfigurasi',
    proteksiKeras: true,
    kolom: [k_('Kunci'), k_('Nilai'), k_('Keterangan')]
  }
];

var TAB_LOG = {
  nama: 'Log_Perubahan',
  kolom: [
    k_('Waktu', 'waktu'), k_('Oleh'), k_('Tab'), k_('row_id'),
    k_('Kolom'), k_('Nilai Lama'), k_('Nilai Baru')
  ]
};

/** Tab Harian (spesifikasi sistem Bagian 8.3). Rumus isinya dipasang di tahap formnya. */
var TAB_HARIAN = [
  {
    nama: 'Harian_Stock',
    judul: 'Form Stock Inventory Harian',
    pilihKategori: true,
    kolom: ['No', 'Nama Item', 'Stock Awal', 'Stock Masuk', 'Hasil Prep', 'Stock Keluar',
      'Dipakai Prep', 'Waste', 'Penyesuaian', 'Stock Akhir', 'Satuan']
  },
  {
    nama: 'Harian_Suhu',
    judul: 'Form Pengecekan Suhu Chiller & Freezer',
    kolom: ['Nama Unit', 'Tipe', 'Opening', 'Middle', 'Closing', 'Cek ulang', 'Nama Staff',
      'Tindakan Korektif']
  },
  {
    nama: 'Harian_Prep',
    judul: 'Form Prep List',
    kolom: ['No', 'Item / Menu Prep', 'Nama Staff', 'Shift', 'Jumlah Resep', 'Hasil atau Qty',
      'Satuan', 'Keterangan']
  },
  {
    nama: 'Harian_Waste',
    judul: 'Form Pencatatan Waste',
    kolom: ['No', 'Nama Staff', 'Shift', 'Item / Produk', 'Kategori Waste', 'Qty', 'Satuan',
      'Alasan', 'Estimasi Kerugian (Rp)']
  }
];

/** Letak sel di tab Harian; dipakai juga oleh rumus di tahap berikutnya. */
var HARIAN = {
  barisOutlet: 3,
  barisPilihTanggal: 4,   // B4: diisi Pengelola, kosong = hari ini
  barisTanggal: 5,        // B5: tanggal yang ditampilkan (rumus)
  barisPilihKategori: 6,  // B6: hanya Harian_Stock, kosong = semua kategori
  barisJudulTabel: 8
};

var BLOK_DASHBOARD = [
  'Stock Inventory', 'Nilai stock', 'Stock opname', 'Waste',
  'Suhu Chiller & Freezer', 'Prep List', 'Kepatuhan'
];

/** Urutan tab di spreadsheet (spesifikasi sistem Bagian 8.2). */
function urutanTab_(ss) {
  var nama = ['Dashboard'];
  TAB_HARIAN.forEach(function (t) { nama.push(t.nama); });
  TAB_DATA.forEach(function (t) { nama.push(t.nama); });
  // Tab data form kustom (Tahap 9) ikut kelompok tab Data, urut nama.
  if (ss) {
    ss.getSheets().map(function (sh) { return sh.getName(); }).filter(function (n) {
      return n.indexOf(AWALAN_TAB_KUSTOM) === 0;
    }).sort().forEach(function (n) { nama.push(n); });
  }
  TAB_MASTER.forEach(function (t) { nama.push(t.nama); });
  nama.push(TAB_LOG.nama);
  return nama;
}

/* ---------- Nilai awal ---------- */

var SATUAN_AWAL = [
  ['kg', 'Berat'], ['gr', 'Berat'],
  ['liter', 'Isi'], ['ml', 'Isi'],
  ['pcs', 'Hitungan'], ['butir', 'Hitungan'], ['buah', 'Hitungan'], ['ikat', 'Hitungan'],
  ['lembar', 'Hitungan'], ['ekor', 'Hitungan'], ['porsi', 'Hitungan'],
  ['pack', 'Kemasan'], ['botol', 'Kemasan'], ['kaleng', 'Kemasan'], ['sachet', 'Kemasan'],
  ['dus', 'Kemasan'], ['karung', 'Kemasan'], ['jerigen', 'Kemasan']
];

/** Empat form bawaan: ID Form, Nama, Jenis, Keterangan, Jadwal, Urutan, Aktif. */
var FORM_BAWAAN = [
  ['STOCK', 'Stock', 'bawaan', 'Form Stock Inventory Harian', 'harian', 1, true],
  ['SUHU', 'Suhu', 'bawaan', 'Form Pengecekan Suhu Chiller & Freezer', 'harian', 2, true],
  ['PREP', 'Prep list', 'bawaan', 'Form Prep List', 'harian', 3, true],
  ['WASTE', 'Waste', 'bawaan', 'Form Pencatatan Waste', 'harian', 4, true]
];

/** Isi awal M_Konfigurasi: Kunci, Nilai, Keterangan. Nilai disimpan sebagai teks. */
function konfigurasiAwal_() {
  return [
    ['kode_pemasangan', buatKodeAcak_(8),
      'Kode Pemasangan sekali pakai untuk membuat akun Pengelola pertama. Hangus setelah dipakai.'],
    ['zona_waktu', '',
      'Terisi otomatis dari perangkat Pengelola saat pemasangan pertama.'],
    ['jam_closing', '21:30', 'Jam closing outlet.'],
    ['jeda_laporan_menit', '45', 'Laporan harian dibuat sekian menit setelah closing.'],
    ['suhu_chiller_min', '1', 'Batas bawah suhu normal Chiller (°C).'],
    ['suhu_chiller_maks', '5', 'Batas atas suhu normal Chiller (°C).'],
    ['suhu_freezer_maks', '-18', 'Freezer normal jika suhunya sama dengan atau lebih rendah dari angka ini (°C).'],
    ['jadwal_opname', 'mingguan', 'Jadwal stock opname: mingguan atau bulanan.'],
    ['hari_cadangan', 'Minggu', 'Hari salinan cadangan mingguan dibuat (dini hari).'],
    ['keluar_otomatis_menit', String(KELUAR_OTOMATIS_AWAL), KETERANGAN_KELUAR_OTOMATIS],
    ['target_food_cost', String(TARGET_FOOD_COST_AWAL), KETERANGAN_TARGET_FOOD_COST],
    ['bahan_kecil_persen', String(BAHAN_KECIL_AWAL), KETERANGAN_BAHAN_KECIL]
  ];
}

/* =========================================================================
 * setupSpreadsheet: jalankan dari editor Apps Script
 * ========================================================================= */

/**
 * Menyiapkan spreadsheet: menyimpan ID ke Script Properties, membuat semua
 * tab beserta judul kolom, kolom sistem, format, baris judul beku, proteksi,
 * dan warna tab, lalu mengisi nilai awal.
 * Aman dijalankan ulang: hanya membuat atau melengkapi yang belum ada; tidak
 * menghapus atau menimpa data.
 */
function setupSpreadsheet() {
  // Sesudah pindah ke Supabase: susunan data disiapkan di Supabase dulu, lalu Sheet ini (format, rumus, grafik), lalu
  // Sheet disalin penuh dari Supabase supaya sama persis.
  var pindah = sudahPindah_();
  if (pindah) {
    // Edge Function yang belum diperbarui menyiapkan susunan data versi lamanya; Sheet ini lalu punya tab yang tidak pernah
    // ada di Supabase (Code.gs v0.30). Supabase menjawab versinya; versi yang berbeda dihentikan sebelum Sheet diubah.
    var versiSupabase = teruskanKeSupabase_('setupSpreadsheet');
    if (versiSupabase !== VERSI_KODE) {
      throw new Error('Edge Function di Supabase masih ' + (versiSupabase || 'Code.gs versi lama') + ', sedangkan Code.gs ini ' +
        VERSI_KODE + '. Tempel supabase/functions/api/index.ts ke Edge Function, Deploy, lalu jalankan setupSpreadsheet lagi.');
    }
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Jalankan setupSpreadsheet dari editor Apps Script yang menempel pada Google Sheet (Extensions → Apps Script).');
  }
  PropertiesService.getScriptProperties().setProperty(PROP_ID_SPREADSHEET, ss.getId());
  SS_ = null;
  resetMemoForm_();

  var kunci = LockService.getScriptLock();
  kunci.waitLock(30000);
  var catatan = [];
  try {
    // 1. Buat semua tab yang belum ada (dulu semua, supaya dropdown antar-tab bisa dipasang).
    var baru = {};
    urutanTab_().forEach(function (nama) {
      if (!ss.getSheetByName(nama)) {
        ss.insertSheet(nama);
        baru[nama] = true;
        catatan.push('Tab dibuat: ' + nama);
      }
    });

    // Cara menulis rumus yang diterima file ini (lokalitas berdesimal koma memakai titik koma).
    // Di Supabase rumus tidak pernah dihitung (tab Harian dan Dashboard hanya ada di Google Sheets).
    GAYA_RUMUS_ = DI_SUPABASE_ ? GAYA_RUMUS_ : deteksiGayaRumus_(ss, catatan);

    // 2. Susun tiap tab.
    siapkanDashboard_(ss, ss.getSheetByName('Dashboard'), catatan);
    TAB_HARIAN.forEach(function (def) {
      siapkanHarian_(ss, ss.getSheetByName(def.nama), def, catatan);
    });
    TAB_DATA.forEach(function (def) {
      siapkanTabTabel_(ss, ss.getSheetByName(def.nama), def, {
        sistem: def.sistem || KOLOM_SISTEM,
        warnaTab: WARNA_TAB.data,
        proteksi: 'keras',
        pitaTanggal: true,
        catatan: catatan
      });
    });
    TAB_MASTER.forEach(function (def) {
      siapkanTabTabel_(ss, ss.getSheetByName(def.nama), def, {
        sistem: [],
        warnaTab: WARNA_TAB.master,
        proteksi: def.proteksiKeras ? 'keras' : 'peringatan',
        catatan: catatan
      });
    });
    siapkanTabTabel_(ss, ss.getSheetByName(TAB_LOG.nama), TAB_LOG, {
      sistem: [],
      warnaTab: WARNA_TAB.log,
      proteksi: 'keras',
      catatan: catatan
    });

    // 3. Tab master yang ditulis aplikasi dirapikan: baris data yang tertulis jauh di bawah
    //    (di bawah kotak centang atau dropdown kosong) naik ke atas. Lalu nilai awal
    //    (hanya baris yang belum ada), tepat di bawah baris terakhir yang kuncinya terisi.
    Object.keys(KUNCI_MASTER).forEach(function (nama) {
      var tab = ss.getSheetByName(nama);
      var r = rapikanTabMaster_(tab, kolomKunciMaster_(tab));
      if (r.pindah) catatan.push(nama + ' dirapikan: ' + r.pindah + ' baris dipindah ke atas');
      if (r.dibersihkan) {
        catatan.push('Peringatan: ' + nama + ': ' + r.dibersihkan + ' baris tanpa ' + KUNCI_MASTER[nama] +
          ' (hanya kotak centang atau pilihan dropdown) dikosongkan');
      }
    });
    isiBarisAwal_(ss.getSheetByName('M_Satuan'), SATUAN_AWAL.map(function (s) {
      return [s[0], s[1], true];
    }), 'M_Satuan', catatan);
    isiBarisAwal_(ss.getSheetByName('M_Form'), FORM_BAWAAN, 'M_Form', catatan);
    isiKonfigurasiAwal_(ss.getSheetByName('M_Konfigurasi'), catatan);
    // Riwayat harga (11 Oktober 2026): harga awal untuk item yang belum punya riwayat.
    isiHargaAwal_(ss, catatan);

    // Tahap 9: tab data tiap form kustom (juga yang diarsipkan) dibuat atau dilengkapi.
    resetMemoForm_();
    bacaDaftarForm_(true).filter(function (f) { return f.jenis === 'kustom'; }).forEach(function (f) {
      siapkanTabKustom_(ss, f, kolomForm_(f.id), { catatan: catatan });
    });

    if (DI_SUPABASE_) {
      aturUrutanTab_(ss);
      console.log('InventoryKu ' + VERSI_KODE + ' setupSpreadsheet di Supabase:\n- ' +
        (catatan.length ? catatan.join('\n- ') : 'tidak ada yang berubah'));
      return VERSI_KODE;
    }

    // 4. Rumus Stock (Tahap 2): tab Harian_Stock dan blok Stock Inventory di Dashboard.
    pasangRumusHarianStock_(ss, catatan);
    pasangBlokStockDashboard_(ss, catatan);
    // Tahap 7: keadaan item (untuk grafik) dan blok Nilai stock, sebelum blok berikutnya diberi ruang.
    pasangRingkasStockDashboard_(ss, catatan);
    pasangBlokNilaiDashboard_(ss, catatan);
    // Tahap 8: blok Stock opname.
    pasangBlokOpnameDashboard_(ss, catatan);
    // Rumus Waste dan Suhu (Tahap 5): tab Harian dan bloknya di Dashboard.
    pasangRumusHarianWaste_(ss, catatan);
    pasangRumusHarianSuhu_(ss, catatan);
    pasangBlokWasteDashboard_(ss, catatan);
    pasangBlokSuhuDashboard_(ss, catatan);
    // Rumus Prep List (Tahap 6): tab Harian_Prep dan blok Prep List di Dashboard.
    pasangRumusHarianPrep_(ss, catatan);
    pasangBlokPrepDashboard_(ss, catatan);
    // Tahap 7: blok Kepatuhan dan grafik tiap blok di Dashboard (setelah semua blok punya tempat).
    pasangBlokKepatuhanDashboard_(ss, catatan);
    pasangGrafikDashboard_(ss, catatan);

    // 5. Urutkan tab dan buang lembar kosong bawaan Google Sheets.
    aturUrutanTab_(ss);
    hapusLembarBawaanKosong_(ss, catatan);

    SpreadsheetApp.flush();

    // 6. Baca kembali semua sel berumus dan catat yang galat.
    periksaSelRumus_(ss, catatan);
  } finally {
    kunci.releaseLock();
  }

  catatan.push('Selesai. ID spreadsheet tersimpan di Script Properties.');
  catatan.push('Kode Pemasangan ada di tab M_Konfigurasi (baris kode_pemasangan).');
  console.log('InventoryKu ' + VERSI_KODE + ' setupSpreadsheet:\n- ' + catatan.join('\n- '));
  if (pindah) {
    PropertiesService.getScriptProperties().deleteProperty(PROP_SINKRON_VERSI);
    console.log('Sheet disalin penuh dari Supabase (tab besar bisa berlanjut di salinan 5 menit berikutnya).');
    sinkronDariSupabase();
  }
}

/* ---------- Rumus sesuai lokalitas spreadsheet ---------- */

/**
 * Rumus di file ini ditulis dengan gaya en-US: pemisah argumen koma, desimal
 * titik, pemisah kolom array koma. Spreadsheet berlokalitas desimal koma
 * (misalnya Indonesia) mengurai rumus dari script dengan pemisah argumen titik
 * koma, desimal koma, dan pemisah kolom array "\", sehingga rumus gaya en-US
 * menjadi "Error mengurai formula". setupSpreadsheet menentukan gaya yang
 * diterima file dengan rumus uji, lalu semua rumus (sel dan format bersyarat)
 * ditulis lewat rumusLokal_. Lokalitas file tidak diubah.
 */
var GAYA_RUMUS_ = null; // 'koma' (en-US) atau 'titikKoma'
var PROP_GAYA_RUMUS = 'GAYA_RUMUS';

/** Rumus uji: argumen, angka desimal, dan array sekaligus. Hasilnya 3,5 jika terurai. */
var RUMUS_UJI_ = '=IF(TRUE,SUM(1.5,COLUMNS({1,2})),0)';

/** Nilai tampilan sel berumus yang dilaporkan pemeriksaan di akhir setupSpreadsheet. */
var GALAT_RUMUS_ = ['#ERROR!', '#NAME?', '#REF!'];

/**
 * Menulis rumus uji di tab sementara dengan gaya en-US, lalu gaya titik koma,
 * dan mengembalikan gaya pertama yang terurai. Tab sementara selalu dihapus.
 */
function deteksiGayaRumus_(ss, catatan) {
  var lokal = ss.getSpreadsheetLocale();
  var uji = ss.insertSheet('InventoryKu_uji_rumus_' + new Date().getTime());
  try {
    var sel = uji.getRange(1, 1);
    var gaya = ['koma', 'titikKoma'];
    for (var i = 0; i < gaya.length; i++) {
      sel.setFormula(ubahGayaRumus_(RUMUS_UJI_, gaya[i]));
      SpreadsheetApp.flush();
      if (sel.getValue() === 3.5) {
        PropertiesService.getScriptProperties().setProperty(PROP_GAYA_RUMUS, gaya[i]);
        catatan.push('Lokalitas spreadsheet ' + lokal + ': rumus ditulis dengan ' + (gaya[i] === 'koma'
          ? 'pemisah koma dan desimal titik'
          : 'pemisah titik koma, desimal koma, dan pemisah kolom array \\'));
        return gaya[i];
      }
    }
  } finally {
    ss.deleteSheet(uji);
  }
  catatan.push('Peringatan: lokalitas spreadsheet ' + lokal + ': rumus uji tidak terurai dengan pemisah koma ' +
    'maupun titik koma; rumus ditulis dengan pemisah koma. Lihat pemeriksaan rumus di bawah.');
  return 'koma';
}

/** Mengubah rumus gaya en-US ke gaya yang diterima file ini (lihat GAYA_RUMUS_). */
function rumusLokal_(rumus) {
  // Di luar setupSpreadsheet (misalnya tab form kustom dibuat dari aplikasi) dipakai gaya yang tercatat setupSpreadsheet.
  if (!GAYA_RUMUS_) GAYA_RUMUS_ = PropertiesService.getScriptProperties().getProperty(PROP_GAYA_RUMUS) || '';
  if (!GAYA_RUMUS_) GAYA_RUMUS_ = deteksiGayaRumus_(ss_(), []);
  return ubahGayaRumus_(rumus, GAYA_RUMUS_);
}

/**
 * Mengubah rumus gaya en-US ke gaya titik koma: koma pemisah argumen → ";",
 * koma di dalam array {…} → "\" (titik koma pemisah baris array tetap ";"),
 * titik desimal pada angka → ",". Teks di dalam "…" dan nama tab di dalam '…'
 * tidak diubah, begitu juga titik pada nama fungsi (misalnya T.TEST).
 */
function ubahGayaRumus_(rumus, gaya) {
  if (gaya !== 'titikKoma') return rumus;
  var hasil = '';
  var kutip = null;
  var array = 0;
  for (var i = 0; i < rumus.length; i++) {
    var c = rumus.charAt(i);
    if (kutip) {
      if (c === kutip) kutip = null; // "" dan '' di dalam kutip: tutup lalu buka lagi
      hasil += c;
      continue;
    }
    if (c === '"' || c === "'") {
      kutip = c;
    } else if (c === '{') {
      array++;
    } else if (c === '}') {
      array = Math.max(0, array - 1);
    } else if (c === ',') {
      c = array > 0 ? '\\' : ';';
    } else if (c === '.' && /[0-9]/.test(rumus.charAt(i + 1))) {
      // Titik desimal hanya jika angka di depannya tidak menempel pada nama (huruf, _, $).
      var j = i - 1;
      while (j >= 0 && /[0-9]/.test(rumus.charAt(j))) j--;
      if (j < 0 || !/[A-Za-z_$.]/.test(rumus.charAt(j))) c = ',';
    }
    hasil += c;
  }
  return hasil;
}

/**
 * Sel yang boleh diberi rumus oleh setupSpreadsheet: kosong, berumus, berisi
 * nilai galat, atau berisi teks bawaan tata letak. Teks lain tidak ditimpa.
 */
function bolehDiberiRumus_(sel, catatan, teksBawaan) {
  if (sel.getFormula()) return true;
  var nilai = sel.getDisplayValue();
  if (nilai === '' || nilai === teksBawaan || /^#(ERROR!|NAME\?|REF!|N\/A|VALUE!|DIV\/0!|NUM!|NULL!)$/.test(nilai)) {
    return true;
  }
  catatan.push('Peringatan: ' + sel.getSheet().getName() + '!' + sel.getA1Notation() +
    ' berisi teks lain; rumus tidak dipasang.');
  return false;
}

/**
 * Membaca kembali semua sel berumus di semua tab dan mencatat sel yang
 * menampilkan #ERROR!, #NAME?, atau #REF!.
 */
function periksaSelRumus_(ss, catatan) {
  var jumlah = 0;
  var galat = [];
  ss.getSheets().forEach(function (sheet) {
    if (sheet.getLastRow() === 0) return;
    var rentang = sheet.getDataRange();
    var rumus = rentang.getFormulas();
    var tampil = null;
    for (var b = 0; b < rumus.length; b++) {
      for (var k = 0; k < rumus[b].length; k++) {
        if (!rumus[b][k]) continue;
        jumlah++;
        tampil = tampil || rentang.getDisplayValues();
        if (GALAT_RUMUS_.indexOf(tampil[b][k]) >= 0) {
          galat.push(sheet.getName() + '!' + hurufKolom_(k + 1) + (b + 1) + ' ' + tampil[b][k]);
        }
      }
    }
  });
  if (galat.length) {
    catatan.push('Peringatan: ' + galat.length + ' dari ' + jumlah + ' sel berumus galat:\n    ' + galat.join('\n    '));
  } else {
    catatan.push('Pemeriksaan rumus: ' + jumlah + ' sel berumus, tidak ada yang menampilkan ' +
      GALAT_RUMUS_.join(', ') + '.');
  }
}

/* ---------- Tab berbentuk tabel (Data, Master, Log) ---------- */

/**
 * Memastikan judul kolom ada (kolom yang hilang ditambahkan di kanan), lalu
 * memasang format, dropdown, baris judul beku, filter, kelompok kolom sistem,
 * proteksi, dan warna tab.
 */
function siapkanTabTabel_(ss, sheet, def, opsi) {
  var semua = def.kolom.concat(opsi.sistem);
  var posisi = pastikanJudul_(sheet, semua.map(function (k) { return k.nama; }), opsi.catatan);
  var jumlahKolom = sheet.getLastColumn();
  var barisMaks = sheet.getMaxRows();
  var jumlahForm = def.kolom.length;

  // Gaya baris judul: kolom form navy, kolom sistem Tinta Redup.
  sheet.getRange(1, 1, 1, jumlahKolom)
    .setFontWeight('bold')
    .setFontColor(WARNA.kertas)
    .setBackground(WARNA.navyPass)
    .setVerticalAlignment('middle')
    .setWrap(true);
  opsi.sistem.forEach(function (k) {
    sheet.getRange(1, posisi[k.nama]).setBackground(WARNA.tintaRedup);
  });
  sheet.setRowHeight(1, 32);

  // Format dan dropdown per kolom (baris 2 sampai bawah).
  if (barisMaks > 1) {
    semua.forEach(function (k) {
      var rentang = sheet.getRange(2, posisi[k.nama], barisMaks - 1, 1);
      if (k.format) rentang.setNumberFormat(FORMAT[k.format]);
      var aturan = aturanValidasi_(ss, k);
      if (aturan) rentang.setDataValidation(aturan);
    });
  }

  if (sheet.getFrozenRows() < 1) sheet.setFrozenRows(1);
  if (!sheet.getFilter()) {
    sheet.getRange(1, 1, barisMaks, jumlahKolom).createFilter();
  }

  // Lebar kolom hanya diatur saat judul baru ditulis (tidak menimpa atur ulang manual).
  if (posisi._baru) {
    sheet.setColumnWidths(1, jumlahKolom, 140);
  }

  // Kolom sistem dikelompokkan dan dilipat.
  if (opsi.sistem.length) {
    var awalSistem = posisi[opsi.sistem[0].nama];
    if (awalSistem === jumlahForm + 1) {
      try {
        if (sheet.getColumnGroupDepth(awalSistem) === 0) {
          sheet.getRange(1, awalSistem, 1, opsi.sistem.length).shiftColumnGroupDepth(1);
          sheet.getColumnGroup(awalSistem, 1).collapse();
        }
      } catch (err) {
        opsi.catatan.push('Peringatan: kolom sistem ' + sheet.getName() + ' tidak bisa dilipat (' + err.message + ').');
      }
    }
  }

  lindungi_(sheet, opsi.proteksi, [], opsi.catatan);
  sheet.setTabColor(opsi.warnaTab);
  if (opsi.pitaTanggal) pasangPitaTanggal_(sheet);
}

/**
 * Warna latar berselang per hari di tab Data (spesifikasi sistem Bagian 8.4):
 * aturan format bersyarat, tanggal genap berlatar Baja. Karena data urut
 * tanggal, hari yang berurutan berganti warna.
 */
function pasangPitaTanggal_(sheet) {
  var rentang = sheet.getRange(2, 1, Math.max(1, sheet.getMaxRows() - 1), sheet.getMaxColumns());
  pasangAturanWarna_(sheet, [SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied(rumusLokal_('=AND(ISNUMBER($A2),ISEVEN(INT($A2)))'))
    .setBackground(WARNA.baja)
    .setRanges([rentang])
    .build()]);
}

/**
 * Memasang aturan format bersyarat tanpa menggandakan: aturan lama yang
 * rentangnya sama dengan aturan baru dibuang dulu. Aman dijalankan ulang.
 */
function pasangAturanWarna_(sheet, aturanBaru) {
  var milikBaru = {};
  aturanBaru.forEach(function (a) {
    a.getRanges().forEach(function (r) { milikBaru[r.getA1Notation()] = true; });
  });
  var tetap = sheet.getConditionalFormatRules().filter(function (a) {
    return !a.getRanges().some(function (r) { return milikBaru[r.getA1Notation()]; });
  });
  sheet.setConditionalFormatRules(tetap.concat(aturanBaru));
}

/**
 * Menulis judul kolom yang belum ada. Mengembalikan peta nama → nomor kolom.
 * Sheet kosong: semua judul ditulis berurutan. Sheet berisi: judul yang
 * hilang ditambahkan di kanan; judul dan data lama tidak diubah.
 */
function pastikanJudul_(sheet, judul, catatan) {
  var posisi = {};
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    pastikanJumlahKolom_(sheet, judul.length);
    sheet.getRange(1, 1, 1, judul.length).setValues([judul]);
    judul.forEach(function (j, i) { posisi[j] = i + 1; });
    posisi._baru = true;
    return posisi;
  }
  var ada = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  ada.forEach(function (j, i) {
    var nama = String(j).trim();
    if (nama && !posisi[nama]) posisi[nama] = i + 1;
  });
  var hilang = judul.filter(function (j) { return !posisi[j]; });
  if (hilang.length) {
    pastikanJumlahKolom_(sheet, lastCol + hilang.length);
    sheet.getRange(1, lastCol + 1, 1, hilang.length).setValues([hilang]);
    hilang.forEach(function (j, i) { posisi[j] = lastCol + 1 + i; });
    catatan.push('Kolom ditambahkan di ' + sheet.getName() + ': ' + hilang.join(', '));
  }
  return posisi;
}

function pastikanJumlahKolom_(sheet, jumlah) {
  var maks = sheet.getMaxColumns();
  if (maks < jumlah) sheet.insertColumnsAfter(maks, jumlah - maks);
}

function aturanValidasi_(ss, kolom) {
  if (kolom.centang) {
    return SpreadsheetApp.newDataValidation().requireCheckbox().build();
  }
  if (kolom.pilihan) {
    return SpreadsheetApp.newDataValidation()
      .requireValueInList(kolom.pilihan, true)
      .setAllowInvalid(false)
      .build();
  }
  if (kolom.sumber) {
    return SpreadsheetApp.newDataValidation()
      .requireValueInRange(ss.getRange(kolom.sumber), true)
      .setAllowInvalid(false)
      .build();
  }
  return null;
}

/**
 * Proteksi seluruh tab, sekali saja (tidak ditimpa saat dijalankan ulang).
 * keras     : hanya pemilik yang bisa mengubah. Script berjalan sebagai
 *             pemilik, jadi tetap bisa menulis.
 * peringatan: siapa pun yang punya akses bisa mengubah setelah peringatan
 *             (dipakai untuk master yang diisi langsung di Sheet di Tahap 0).
 */
function lindungi_(sheet, mode, kecuali, catatan) {
  if (sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).length > 0) return;
  var proteksi = sheet.protect().setDescription(
    mode === 'keras'
      ? 'InventoryKu: diisi oleh aplikasi. Ubah lewat aplikasi agar tercatat.'
      : 'InventoryKu: master data. Mulai Tahap 7 diubah lewat Pengaturan di aplikasi.'
  );
  if (mode === 'peringatan') {
    proteksi.setWarningOnly(true);
  } else {
    proteksi.addEditor(Session.getEffectiveUser());
    proteksi.removeEditors(proteksi.getEditors());
    if (proteksi.canDomainEdit()) proteksi.setDomainEdit(false);
  }
  if (kecuali && kecuali.length) proteksi.setUnprotectedRanges(kecuali);
  catatan.push('Proteksi dipasang: ' + sheet.getName() + ' (' + mode + ')');
}

/* ---------- Tab Harian ---------- */

function siapkanHarian_(ss, sheet, def, catatan) {
  var lebar = def.kolom.length;
  var pilihTanggal = sheet.getRange(HARIAN.barisPilihTanggal, 2);
  var pilihKategori = def.pilihKategori ? sheet.getRange(HARIAN.barisPilihKategori, 2) : null;

  // Tata letak hanya ditulis sekali, saat tab masih kosong.
  if (sheet.getLastRow() === 0) {
    pastikanJumlahKolom_(sheet, lebar);
    sheet.getRange(1, 1).setValue(def.judul)
      .setFontSize(14).setFontWeight('bold').setFontColor(WARNA.navyPass);
    sheet.getRange(1, 1, 1, lebar)
      .setBorder(null, null, true, null, null, null, WARNA.navyPass, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

    var info = [
      [HARIAN.barisOutlet, 'Nama Outlet'],
      [HARIAN.barisPilihTanggal, 'Pilih tanggal'],
      [HARIAN.barisTanggal, 'Tanggal']
    ];
    if (def.pilihKategori) info.push([HARIAN.barisPilihKategori, 'Kategori']);
    info.forEach(function (baris) {
      sheet.getRange(baris[0], 1).setValue(baris[1]).setFontColor(WARNA.tintaRedup);
    });

    sheet.getRange(HARIAN.barisOutlet, 2).setFontWeight('bold');
    sheet.getRange(HARIAN.barisTanggal, 2)
      .setNumberFormat(FORMAT.tanggal).setFontWeight('bold').setHorizontalAlignment('left');

    gayaSelPilihan_(pilihTanggal);
    pilihTanggal.setNumberFormat(FORMAT.tanggal).setHorizontalAlignment('left');
    sheet.getRange(HARIAN.barisPilihTanggal, 3).setValue('Kosongkan untuk hari ini')
      .setFontColor(WARNA.tintaRedup).setFontStyle('italic');
    if (pilihKategori) {
      gayaSelPilihan_(pilihKategori);
      sheet.getRange(HARIAN.barisPilihKategori, 3).setValue('Kosongkan untuk semua kategori')
        .setFontColor(WARNA.tintaRedup).setFontStyle('italic');
    }

    sheet.getRange(HARIAN.barisJudulTabel, 1, 1, lebar).setValues([def.kolom])
      .setFontWeight('bold').setFontColor(WARNA.kertas).setBackground(WARNA.navyPass)
      .setVerticalAlignment('middle').setWrap(true)
      .setBorder(true, true, true, true, true, true, WARNA.garis, SpreadsheetApp.BorderStyle.SOLID);
    sheet.setRowHeight(HARIAN.barisJudulTabel, 32);
    sheet.getRange(HARIAN.barisJudulTabel + 1, 1).setValue('Belum ada data.')
      .setFontColor(WARNA.tintaRedup).setFontStyle('italic');
    sheet.setColumnWidths(1, lebar, 120);
    catatan.push('Tata letak dibuat: ' + sheet.getName());
  }

  // Rumus kotak info ditulis ulang tiap kali (hanya jika selnya kosong, berumus, atau galat),
  // supaya rumus yang tidak sah untuk lokalitas file ikut diperbaiki.
  var selOutlet = sheet.getRange(HARIAN.barisOutlet, 2);
  if (bolehDiberiRumus_(selOutlet, catatan)) {
    selOutlet.setFormula(rumusLokal_('=IF(M_Outlet!A2="","",M_Outlet!A2)'));
  }
  var selTanggal = sheet.getRange(HARIAN.barisTanggal, 2);
  if (bolehDiberiRumus_(selTanggal, catatan)) {
    selTanggal.setFormula(rumusLokal_('=IF(B' + HARIAN.barisPilihTanggal + '="",TODAY(),B' + HARIAN.barisPilihTanggal + ')'));
  }

  // Dropdown pemilih (dipasang ulang tiap kali, tidak mengubah isi sel).
  pilihTanggal.setDataValidation(SpreadsheetApp.newDataValidation()
    .requireDate().setAllowInvalid(false)
    .setHelpText('Isi tanggal, atau kosongkan untuk menampilkan hari ini.').build());
  if (pilihKategori) {
    pilihKategori.setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInRange(ss.getRange('M_Kategori!A2:A'), true).setAllowInvalid(false)
      .setHelpText('Pilih kategori, atau kosongkan untuk semua kategori.').build());
  }

  if (sheet.getFrozenRows() < HARIAN.barisJudulTabel) sheet.setFrozenRows(HARIAN.barisJudulTabel);
  lindungi_(sheet, 'keras', pilihKategori ? [pilihTanggal, pilihKategori] : [pilihTanggal], catatan);
  sheet.setTabColor(WARNA_TAB.harian);
}

function gayaSelPilihan_(rentang) {
  rentang.setBackground(WARNA.baja)
    .setBorder(true, true, true, true, null, null, WARNA.garisIsian, SpreadsheetApp.BorderStyle.SOLID);
}

/* ---------- Tab Dashboard ---------- */

function siapkanDashboard_(ss, sheet, catatan) {
  var lebar = 8;
  var pilihPeriode = sheet.getRange(3, 2);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1).setValue('Dashboard InventoryKu')
      .setFontSize(16).setFontWeight('bold').setFontColor(WARNA.navyPass);
    sheet.getRange(1, 1, 1, lebar)
      .setBorder(null, null, true, null, null, null, WARNA.navyPass, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    sheet.getRange(3, 1).setValue('Periode').setFontColor(WARNA.tintaRedup);
    pilihPeriode.setValue('7 hari');
    gayaSelPilihan_(pilihPeriode);

    var baris = 5;
    BLOK_DASHBOARD.forEach(function (judul) {
      sheet.getRange(baris, 1, 1, lebar).setBackground(WARNA.navyPass);
      sheet.getRange(baris, 1).setValue(judul).setFontWeight('bold').setFontColor(WARNA.kertas);
      sheet.getRange(baris + 1, 1).setValue('Belum ada data.')
        .setFontColor(WARNA.tintaRedup).setFontStyle('italic');
      // Blok Stock Inventory punya ruang tetap untuk tabelnya (Tahap 2).
      baris += judul === 'Stock Inventory' ? 4 + TINGGI_BLOK_STOCK : 3;
    });
    sheet.setColumnWidths(1, lebar, 120);
    catatan.push('Tata letak dibuat: Dashboard');
  }

  pilihPeriode.setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(['7 hari', '30 hari', 'Bulan berjalan'], true).setAllowInvalid(false).build());
  if (sheet.getFrozenRows() < 3) sheet.setFrozenRows(3);
  lindungi_(sheet, 'keras', [pilihPeriode], catatan);
  sheet.setTabColor(WARNA_TAB.dashboard);
}

/* ---------- Nilai awal ---------- */

/* ---------- Tahap 2: rumus Harian_Stock dan blok Stock Inventory ---------- */

/** Tinggi tabel blok Stock Inventory di Dashboard (baris item + judul kategori). */
var TINGGI_BLOK_STOCK = 150;

function hurufKolom_(n) {
  var s = '';
  while (n > 0) {
    var m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Rentang satu kolom penuh (baris 2 ke bawah) menurut judulnya, misalnya Stock_Harian!$A$2:$A. */
function kolomRumus_(ss, tab, judul) {
  var sheet = ss.getSheetByName(tab);
  var ada = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (j) {
    return String(j).trim();
  });
  var i = ada.indexOf(judul);
  if (i < 0) throw new Error('Kolom ' + judul + ' tidak ada di tab ' + tab + '.');
  var h = hurufKolom_(i + 1);
  return tab + '!$' + h + '$2:$' + h;
}

function kosong_(n) {
  var s = [];
  for (var i = 0; i < n; i++) s.push('""');
  return s.join(',');
}

/** LET bersama: kolom Stock_Harian, M_Item, dan M_Kategori yang dipakai rumus stock. */
function letStock_(ss) {
  var K = function (tab, judul) { return kolomRumus_(ss, tab, judul); };
  return 'shT,' + K('Stock_Harian', 'Tanggal') + ',shI,' + K('Stock_Harian', 'Nama Item') + ',' +
    'iN,' + K('M_Item', 'Nama Item') + ',iK,' + K('M_Item', 'Kategori') + ',iS,' + K('M_Item', 'Satuan') + ',' +
    'iMin,' + K('M_Item', 'Stok Minimum') + ',iA,' + K('M_Item', 'Aktif') + ',' +
    'kN,' + K('M_Kategori', 'Nama Kategori') + ',kU,' + K('M_Kategori', 'Urutan') + ',kA,' + K('M_Kategori', 'Aktif') + ',';
}

/**
 * Rumus tab Harian_Stock (spesifikasi sistem Bagian 8.3), satu rumus di A9.
 * Semua item aktif, dikelompokkan per kategori (urut M_Kategori), tiap
 * kelompok diawali baris judul kategori; di dalamnya urut Nama Item. Item
 * yang punya rekap pada tanggal itu menampilkan gerakannya; item lain
 * menampilkan Stock Awal = Stock Akhir = rekap terakhir sebelumnya. Di bawah
 * tabel: Diisi oleh dan Diperiksa oleh.
 */
function rumusHarianStock_(ss) {
  var K = function (tab, judul) { return kolomRumus_(ss, tab, judul); };
  // Rekap satu item pada satu tanggal dicari dengan FILTER, bukan XLOOKUP(1,(…)*(…),…):
  // tanpa ARRAYFORMULA syarat ganda di XLOOKUP tidak dihitung sebagai larik dan hasilnya #N/A.
  var hari = function (judul) { return 'IFERROR(INDEX(FILTER(' + K('Stock_Harian', judul) + ',shI=x,shT=tgl),1),0)'; };
  var akhirSH = K('Stock_Harian', 'Stock Akhir');
  var baris =
    'LAMBDA(grp,x,LET(' +
      'lt,MAXIFS(shT,shI,x,shT,"<="&tgl),' +
      'ada,lt=tgl,' +
      'lalu,IF(lt=0,0,IFERROR(INDEX(FILTER(' + akhirSH + ',shI=x,shT=lt),1),0)),' +
      'VSTACK(grp,HSTACK(ROWS(grp),x,' +
        'IF(ada,' + hari('Stock Awal') + ',lalu),' +
        'IF(ada,' + hari('Stock Masuk') + ',""),' +
        'IF(ada,' + hari('Hasil Prep') + ',""),' +
        'IF(ada,' + hari('Stock Keluar') + ',""),' +
        'IF(ada,' + hari('Dipakai Prep') + ',""),' +
        'IF(ada,' + hari('Waste') + ',""),' +
        'IF(ada,' + hari('Penyesuaian') + ',""),' +
        'IF(ada,' + hari('Stock Akhir') + ',lalu),' +
        'XLOOKUP(x,iN,iS,"")))))';
  var grup =
    'LAMBDA(acc,k,LET(' +
      'it,SORT(FILTER(iN,iN<>"",iK=k,iA=TRUE)),' +
      'IF(OR(k="",ISERROR(INDEX(it,1,1))),acc,VSTACK(acc,REDUCE(HSTACK("",k,' + kosong_(9) + '),it,' + baris + ')))))';
  var pilihKat = 'kN<>"",kA=TRUE,(pk="")+(kN=pk)';
  var pilihIsi = '(dsT=tgl)*((pk="")+(dsK=pk))';
  return '=LET(tgl,$B$5,pk,$B$6,' + letStock_(ss) +
    'kat,IFERROR(SORT(FILTER(kN,' + pilihKat + '),FILTER(kU,' + pilihKat + '),TRUE),""),' +
    'isi,REDUCE(HSTACK(' + kosong_(11) + '),kat,' + grup + '),' +
    'n,ROWS(isi),' +
    'dsT,' + K('Data_Stock', 'Tanggal') + ',dsK,' + K('Data_Stock', 'Kategori') + ',' +
    'dsW,' + K('Data_Stock', 'timestamp_server') + ',dsBy,' + K('Data_Stock', 'submitted_by') + ',' +
    'dsC,' + K('Data_Stock', 'checked_by') + ',dsCA,' + K('Data_Stock', 'checked_at') + ',' +
    'olehIsi,IFERROR(TEXTJOIN(", ",TRUE,UNIQUE(FILTER(dsBy,' + pilihIsi + '))),""),' +
    'jamIsi,IFERROR(TEXT(MAX(FILTER(dsW,' + pilihIsi + ')),"hh:mm"),""),' +
    'olehCek,IFERROR(TEXTJOIN(", ",TRUE,UNIQUE(FILTER(dsC,' + pilihIsi + ',dsC<>""))),""),' +
    'jamCek,IFERROR(TEXT(MAX(FILTER(dsCA,' + pilihIsi + ',dsC<>"")),"hh:mm"),""),' +
    'bawah,VSTACK(HSTACK(' + kosong_(11) + '),' +
      'HSTACK("","Diisi oleh",IF(olehIsi="","Belum ada isian",olehIsi&", terakhir "&jamIsi),' + kosong_(8) + '),' +
      'HSTACK("","Diperiksa oleh",IF(olehCek="","Belum diperiksa",olehCek&", "&jamCek),' + kosong_(8) + ')),' +
    'IF(n<2,VSTACK(HSTACK("Belum ada data.",' + kosong_(10) + '),bawah),' +
      'VSTACK(CHOOSEROWS(isi,SEQUENCE(n-1,1,2)),bawah)))';
}

/**
 * Memasang rumus Harian_Stock di A9 (menggantikan tulisan "Belum ada data."
 * dari Tahap 0), format angka, dan sorotan: baris judul kategori (latar Baja,
 * tebal), Stock Akhir minus (teks Masalah, tebal), Stock Akhir di bawah stok
 * minimum (teks Perlu ditinjau, tebal). Aman dijalankan ulang.
 */
function pasangRumusHarianStock_(ss, catatan) {
  var sheet = ss.getSheetByName('Harian_Stock');
  var mulai = HARIAN.barisJudulTabel + 1;
  var sel = sheet.getRange(mulai, 1);
  if (!bolehDiberiRumus_(sel, catatan, 'Belum ada data.')) return;
  sel.setFormula(rumusLokal_(rumusHarianStock_(ss))).setFontStyle('normal').setFontColor(WARNA.tinta);
  var tinggi = Math.max(1, sheet.getMaxRows() - mulai + 1);
  sheet.getRange(mulai, 3, tinggi, 8).setNumberFormat(FORMAT.angka);
  sheet.getRange(mulai, 1, tinggi, 1).setNumberFormat(FORMAT.bulat).setHorizontalAlignment('right');

  var item = ss.getSheetByName('M_Item');
  var judulItem = item.getRange(1, 1, 1, item.getLastColumn()).getValues()[0].map(function (j) {
    return String(j).trim();
  });
  var kolNama = judulItem.indexOf('Nama Item') + 1;
  var kolMin = judulItem.indexOf('Stok Minimum') + 1;
  var cariMin = 'IFERROR(N(VLOOKUP($B' + mulai + ',INDIRECT("M_Item!' + hurufKolom_(kolNama) + '2:' +
    hurufKolom_(kolMin) + '"),' + (kolMin - kolNama + 1) + ',FALSE)),0)';
  var semua = sheet.getRange(mulai, 1, tinggi, 11);
  var akhir = sheet.getRange(mulai, 10, tinggi, 1);
  pasangAturanWarna_(sheet, [
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(rumusLokal_('=AND($A' + mulai + '="",$B' + mulai + '<>"",$C' + mulai + '="")'))
      .setBackground(WARNA.baja).setBold(true).setRanges([semua]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(rumusLokal_('=AND(ISNUMBER($A' + mulai + '),ISNUMBER($J' + mulai + '),$J' + mulai + '<0)'))
      .setFontColor(WARNA.masalah).setBold(true).setRanges([akhir]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(rumusLokal_('=AND(ISNUMBER($A' + mulai + '),ISNUMBER($J' + mulai + '),$J' + mulai + '>=0,$J' +
        mulai + '<' + cariMin + ')'))
      .setFontColor(WARNA.tinjau).setBold(true).setRanges([akhir]).build()
  ]);
  catatan.push('Rumus stock dipasang: Harian_Stock');
}

/**
 * Rumus blok Stock Inventory di Dashboard (spesifikasi sistem Bagian 8.5):
 * stock akhir terkini per item dikelompokkan per kategori, masuk dan keluar
 * selama periode pilihan (B3), dan keterangan "Stock akhir minus" atau
 * "Perlu reorder".
 */
function rumusDashboardStock_(ss) {
  var K = function (tab, judul) { return kolomRumus_(ss, tab, judul); };
  var periode = 'shT,">="&awalP,shT,"<="&TODAY()';
  var baris =
    'LAMBDA(grp,x,LET(' +
      'lt,MAXIFS(shT,shI,x),' +
      'akhir,IF(lt=0,0,IFERROR(INDEX(FILTER(' + K('Stock_Harian', 'Stock Akhir') + ',shI=x,shT=lt),1),0)),' +
      'mn,XLOOKUP(x,iN,iMin,""),' +
      'VSTACK(grp,HSTACK(x,akhir,XLOOKUP(x,iN,iS,""),' +
        'SUMIFS(' + K('Stock_Harian', 'Stock Masuk') + ',shI,x,' + periode + '),' +
        'SUMIFS(' + K('Stock_Harian', 'Stock Keluar') + ',shI,x,' + periode + '),' +
        'IF(akhir<0,"Stock akhir minus",IF(AND(ISNUMBER(mn),akhir<mn),"Perlu reorder",""))))))';
  var grup =
    'LAMBDA(acc,k,LET(' +
      'it,SORT(FILTER(iN,iN<>"",iK=k,iA=TRUE)),' +
      'IF(OR(k="",ISERROR(INDEX(it,1,1))),acc,VSTACK(acc,REDUCE(HSTACK(k,' + kosong_(5) + '),it,' + baris + ')))))';
  return '=LET(awalP,IF($B$3="30 hari",TODAY()-29,IF($B$3="Bulan berjalan",DATE(YEAR(TODAY()),MONTH(TODAY()),1),TODAY()-6)),' +
    letStock_(ss) +
    'kat,IFERROR(SORT(FILTER(kN,kN<>"",kA=TRUE),FILTER(kU,kN<>"",kA=TRUE),TRUE),""),' +
    'isi,REDUCE(HSTACK(' + kosong_(6) + '),kat,' + grup + '),' +
    'n,ROWS(isi),' +
    'IF(n<2,"Belum ada data.",ARRAY_CONSTRAIN(CHOOSEROWS(isi,SEQUENCE(n-1,1,2)),' + TINGGI_BLOK_STOCK + ',6)))';
}

/**
 * Blok Stock Inventory di Dashboard: baris 6 ringkasan, baris 7 judul tabel,
 * baris 8 rumus tabel dengan ruang TINGGI_BLOK_STOCK baris. Dashboard dari
 * Tahap 0 (blok berikutnya langsung di baris 8) diberi ruang dulu dengan
 * menyisipkan baris. Aman dijalankan ulang.
 */
function pasangBlokStockDashboard_(ss, catatan) {
  var sheet = ss.getSheetByName('Dashboard');
  if (String(sheet.getRange(5, 1).getValue()) !== 'Stock Inventory') {
    catatan.push('Peringatan: blok Stock Inventory di Dashboard tidak ditemukan di A5; rumus tidak dipasang.');
    return;
  }
  if (String(sheet.getRange(8, 1).getValue()) === 'Nilai stock') {
    sheet.insertRowsBefore(8, TINGGI_BLOK_STOCK + 1);
    catatan.push('Dashboard: ruang tabel blok Stock Inventory disisipkan');
  }
  var barisNilai = barisBlokDashboard_(sheet, 'Nilai stock');
  polosIsiBlokDashboard_(sheet, 5, barisNilai > 5 ? barisNilai - 1 : 8 + TINGGI_BLOK_STOCK);
  var akhirTabel = 7 + TINGGI_BLOK_STOCK;
  var rentangKet = '$F$8:$F$' + akhirTabel;
  sheet.getRange(6, 1).setFormula(rumusLokal_('="Di bawah stok minimum: "&COUNTIF(' + rentangKet + ',"Perlu reorder")&' +
    '" item · Stock akhir minus: "&COUNTIF(' + rentangKet + ',"Stock akhir minus")&" item · Masuk dan keluar: "&$B$3'))
    .setFontStyle('normal').setFontColor(WARNA.tinta);
  sheet.getRange(7, 1, 1, 6).setValues([['Item', 'Stock Akhir', 'Satuan', 'Masuk', 'Keluar', 'Keterangan']])
    .setFontWeight('bold').setFontColor(WARNA.tintaRedup).setBackground(WARNA.baja);
  sheet.getRange(8, 1).setFormula(rumusLokal_(rumusDashboardStock_(ss)));
  sheet.getRange(8, 2, TINGGI_BLOK_STOCK, 1).setNumberFormat(FORMAT.angka);
  sheet.getRange(8, 4, TINGGI_BLOK_STOCK, 2).setNumberFormat(FORMAT.angka);
  var tabel = sheet.getRange(8, 1, TINGGI_BLOK_STOCK, 6);
  pasangAturanWarna_(sheet, [
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(rumusLokal_('=AND($A8<>"",$B8="")'))
      .setBackground(WARNA.baja).setBold(true).setRanges([tabel]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(rumusLokal_('=$F8="Stock akhir minus"'))
      .setFontColor(WARNA.masalah).setBold(true).setRanges([tabel]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(rumusLokal_('=$F8="Perlu reorder"'))
      .setFontColor(WARNA.tinjau).setBold(true).setRanges([tabel]).build()
  ]);
  catatan.push('Rumus stock dipasang: Dashboard (blok Stock Inventory)');
}

/* ---------- Tahap 5: rumus Harian_Waste, Harian_Suhu, blok Waste dan Suhu ---------- */

/** Baris Diisi oleh dan Diperiksa oleh di bawah tabel Harian, untuk tab Data dengan kolom tanggal dT. */
function bawahHarian_(ss, tab, lebar) {
  var K = function (judul) { return kolomRumus_(ss, tab, judul); };
  var cocok = K('Tanggal') + '=tgl';
  return 'olehIsi,IFERROR(TEXTJOIN(", ",TRUE,UNIQUE(FILTER(' + K('submitted_by') + ',' + cocok + '))),""),' +
    'jamIsi,IFERROR(TEXT(MAX(FILTER(' + K('timestamp_server') + ',' + cocok + ')),"hh:mm"),""),' +
    'olehCek,IFERROR(TEXTJOIN(", ",TRUE,UNIQUE(FILTER(' + K('checked_by') + ',' + cocok + ',' + K('checked_by') + '<>""))),""),' +
    'jamCek,IFERROR(TEXT(MAX(FILTER(' + K('checked_at') + ',' + cocok + ',' + K('checked_by') + '<>"")),"hh:mm"),""),' +
    'bawah,VSTACK(HSTACK(' + kosong_(lebar) + '),' +
      'HSTACK("","Diisi oleh",IF(olehIsi="","Belum ada isian",olehIsi&", terakhir "&jamIsi),' + kosong_(lebar - 3) + '),' +
      'HSTACK("","Diperiksa oleh",IF(olehCek="","Belum diperiksa",olehCek&", "&jamCek),' + kosong_(lebar - 3) + ')),';
}

/** Sel A9 tab Harian: dipasang hanya jika masih kosong, "Belum ada data.", rumus, atau galat. */
function selRumusHarian_(sheet, catatan) {
  var mulai = HARIAN.barisJudulTabel + 1;
  var sel = sheet.getRange(mulai, 1);
  return bolehDiberiRumus_(sel, catatan, 'Belum ada data.') ? sel : null;
}

/**
 * Rumus tab Harian_Waste (spesifikasi sistem Bagian 8.3), satu rumus di A9:
 * satu baris per item waste pada tanggal itu, urut waktu kirim, lalu baris
 * total estimasi kerugian, Diisi oleh, dan Diperiksa oleh.
 */
function rumusHarianWaste_(ss) {
  var K = function (judul) { return kolomRumus_(ss, 'Data_Waste', judul); };
  var dT = K('Tanggal');
  var dI = K('Item / Produk');
  return '=LET(tgl,$B$5,' +
    'n,COUNTIFS(' + dT + ',tgl,' + dI + ',"<>"),' +
    'f,IF(n=0,"",SORT(FILTER(HSTACK(' + [K('Nama Staff'), K('Shift'), dI, K('Kategori Waste'), K('Qty'), K('Satuan'),
      K('Alasan / Keterangan'), K('Estimasi Kerugian (Rp)'), K('timestamp_server')].join(',') + '),' + dT + '=tgl,' + dI + '<>""),9,TRUE)),' +
    'tabel,IF(n=0,HSTACK("Belum ada data.",' + kosong_(8) + '),HSTACK(SEQUENCE(n),CHOOSECOLS(f,1,2,3,4,5,6,7,8))),' +
    'total,HSTACK(' + kosong_(7) + ',"Total estimasi kerugian",SUMIFS(' + K('Estimasi Kerugian (Rp)') + ',' + dT + ',tgl)),' +
    bawahHarian_(ss, 'Data_Waste', 9) +
    'VSTACK(tabel,total,bawah))';
}

function pasangRumusHarianWaste_(ss, catatan) {
  var sheet = ss.getSheetByName('Harian_Waste');
  var sel = selRumusHarian_(sheet, catatan);
  if (!sel) return;
  var mulai = sel.getRow();
  sel.setFormula(rumusLokal_(rumusHarianWaste_(ss))).setFontStyle('normal').setFontColor(WARNA.tinta);
  var tinggi = Math.max(1, sheet.getMaxRows() - mulai + 1);
  sheet.getRange(mulai, 1, tinggi, 1).setNumberFormat(FORMAT.bulat).setHorizontalAlignment('right');
  sheet.getRange(mulai, 6, tinggi, 1).setNumberFormat(FORMAT.angka);
  sheet.getRange(mulai, 9, tinggi, 1).setNumberFormat(FORMAT.rupiah);
  pasangAturanWarna_(sheet, [
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(rumusLokal_('=$H' + mulai + '="Total estimasi kerugian"'))
      .setBackground(WARNA.baja).setBold(true).setRanges([sheet.getRange(mulai, 1, tinggi, 9)]).build()
  ]);
  catatan.push('Rumus waste dipasang: Harian_Waste');
}

/**
 * Rumus tab Harian_Suhu (spesifikasi sistem Bagian 8.3), satu rumus di A9:
 * satu baris per unit (unit aktif menurut urutan M_Unit, ditambah unit yang
 * punya isian pada tanggal itu) dengan suhu Opening, Middle, dan Closing;
 * tiap cek ulang menjadi baris sendiri di bawah unitnya ("Cek ulang 15.40",
 * suhu di kolom Cek ulang). Kolom I sampai L (disembunyikan) berisi TRUE jika
 * suhu di kolom C, D, E, atau F di luar standar, untuk sorotan. Hasilnya tidak
 * bergantung pada urutan baris Data_Suhu: Nama Staff dan Tindakan Korektif
 * disusun Opening, Middle, Closing; cek ulang diurutkan menurut waktu kirim.
 */
function rumusHarianSuhu_(ss) {
  var K = function (judul) { return kolomRumus_(ss, 'Data_Suhu', judul); };
  var dT = K('Tanggal');
  var dU = K('Nama Unit');
  var dW = K('Waktu Cek');
  var dS = K('Suhu (°C)');
  var dSt = K('Status Suhu');
  var dN = K('Nama Staff');
  var dTk = K('Tindakan Korektif');
  var uN = kolomRumus_(ss, 'M_Unit', 'Nama Unit');
  var uT = kolomRumus_(ss, 'M_Unit', 'Tipe');
  var uA = kolomRumus_(ss, 'M_Unit', 'Aktif');
  var milik = dU + '=x,' + dT + '=tgl';
  var baris =
    'LAMBDA(acc,x,LET(' +
      'tp,IFERROR(INDEX(FILTER(' + uT + ',' + uN + '=x),1),IFERROR(INDEX(FILTER(' + K('Tipe Unit') + ',' + milik + '),1),"")),' +
      'v,LAMBDA(w,IFERROR(INDEX(FILTER(' + dS + ',' + milik + ',' + dW + '=w),1),"")),' +
      'st,LAMBDA(w,COUNTIFS(' + dU + ',x,' + dT + ',tgl,' + dW + ',w,' + dSt + ',"Di Luar Standar")>0),' +
      'nm,LAMBDA(w,IFERROR(INDEX(FILTER(' + dN + ',' + milik + ',' + dW + '=w),1),"")),' +
      'tk,LAMBDA(w,IFERROR(w&": "&INDEX(FILTER(' + dTk + ',' + milik + ',' + dW + '=w,' + dTk + '<>""),1),"")),' +
      'staf,IFERROR(TEXTJOIN(", ",TRUE,UNIQUE(VSTACK(nm("Opening"),nm("Middle"),nm("Closing")))),""),' +
      'tind,TEXTJOIN(" / ",TRUE,tk("Opening"),tk("Middle"),tk("Closing")),' +
      'utama,HSTACK(x,tp,v("Opening"),v("Middle"),v("Closing"),"",staf,tind,st("Opening"),st("Middle"),st("Closing"),FALSE),' +
      'nc,COUNTIFS(' + dU + ',x,' + dT + ',tgl,' + dW + ',"Cek ulang"),' +
      'm,IF(nc=0,"",SORT(FILTER(HSTACK(' + K('timestamp_server') + ',' + dS + ',' + dN + ',' + dTk + ',' + dSt + '),' + milik + ',' + dW + '="Cek ulang"),1,TRUE)),' +
      'kosong,LAMBDA(k,MAKEARRAY(nc,k,LAMBDA(r,c,""))),' +
      'cek,IF(nc=0,"",HSTACK(kosong(1),MAP(CHOOSECOLS(m,1),LAMBDA(t,"Cek ulang "&TEXT(t,"hh.mm"))),kosong(3),' +
        'CHOOSECOLS(m,2),CHOOSECOLS(m,3),CHOOSECOLS(m,4),MAKEARRAY(nc,3,LAMBDA(r,c,FALSE)),' +
        'MAP(CHOOSECOLS(m,5),LAMBDA(s,s="Di Luar Standar")))),' +
      'IF(nc=0,VSTACK(acc,utama),VSTACK(acc,utama,cek))))';
  return '=LET(tgl,$B$5,' +
    'a,VSTACK(IFERROR(FILTER(' + uN + ',' + uN + '<>"",' + uA + '=TRUE),""),IFERROR(FILTER(' + dU + ',' + dT + '=tgl),"")),' +
    'unit,IFERROR(UNIQUE(FILTER(a,a<>"")),""),' +
    'isi,IF(INDEX(unit,1,1)="",HSTACK(' + kosong_(12) + '),REDUCE(HSTACK(' + kosong_(12) + '),unit,' + baris + ')),' +
    'n,ROWS(isi),' +
    bawahHarian_(ss, 'Data_Suhu', 12) +
    'IF(n<2,VSTACK(HSTACK("Belum ada data.",' + kosong_(11) + '),bawah),VSTACK(CHOOSEROWS(isi,SEQUENCE(n-1,1,2)),bawah)))';
}

function pasangRumusHarianSuhu_(ss, catatan) {
  var sheet = ss.getSheetByName('Harian_Suhu');
  var sel = selRumusHarian_(sheet, catatan);
  if (!sel) return;
  var mulai = sel.getRow();
  sel.setFormula(rumusLokal_(rumusHarianSuhu_(ss))).setFontStyle('normal').setFontColor(WARNA.tinta);
  var tinggi = Math.max(1, sheet.getMaxRows() - mulai + 1);
  sheet.getRange(mulai, 3, tinggi, 4).setNumberFormat(FORMAT.suhu).setHorizontalAlignment('right');
  if (sheet.getMaxColumns() < 12) sheet.insertColumnsAfter(sheet.getMaxColumns(), 12 - sheet.getMaxColumns());
  sheet.hideColumns(9, 4);
  var aturan = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(rumusLokal_('=AND($A' + mulai + '="",LEFT($B' + mulai + ',9)="Cek ulang")'))
      .setFontColor(WARNA.tintaRedup).setRanges([sheet.getRange(mulai, 1, tinggi, 2)]).build()
  ];
  ['I', 'J', 'K', 'L'].forEach(function (bantu, i) {
    aturan.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(rumusLokal_('=$' + bantu + mulai + '=TRUE'))
      .setFontColor(WARNA.masalah).setBold(true).setRanges([sheet.getRange(mulai, 3 + i, tinggi, 1)]).build());
  });
  pasangAturanWarna_(sheet, aturan);
  catatan.push('Rumus suhu dipasang: Harian_Suhu');
}

/** Tinggi blok Waste dan Suhu di Dashboard: dari baris judul blok sampai sebelum judul blok berikutnya. */
var TINGGI_BLOK_WASTE = 17;
var TINGGI_BLOK_SUHU = 26;

/** Awal periode pilihan Dashboard (B3): 7 hari, 30 hari, atau bulan berjalan. */
var AWAL_PERIODE_ = 'awalP,IF($B$3="30 hari",TODAY()-29,IF($B$3="Bulan berjalan",DATE(YEAR(TODAY()),MONTH(TODAY()),1),TODAY()-6)),';

/**
 * Mencari baris judul blok di kolom A Dashboard dan memberi blok itu ruang
 * `tinggi` baris (menyisipkan baris sebelum blok berikutnya jika kurang).
 * Mengembalikan nomor baris judulnya, atau 0 jika tidak ditemukan.
 */
function ruangBlokDashboard_(sheet, judul, tinggi, catatan) {
  var akhir = sheet.getLastRow();
  if (akhir < 1) return 0;
  var kolA = sheet.getRange(1, 1, akhir, 1).getValues().map(function (r) { return String(r[0]); });
  var baris = 0;
  for (var i = 0; i < kolA.length; i++) if (kolA[i] === judul) { baris = i + 1; break; }
  if (!baris) {
    catatan.push('Peringatan: blok ' + judul + ' di Dashboard tidak ditemukan; rumus tidak dipasang.');
    return 0;
  }
  var urutan = BLOK_DASHBOARD.indexOf(judul);
  var berikut = BLOK_DASHBOARD[urutan + 1];
  var barisBerikut = 0;
  for (var j = baris; j < kolA.length && berikut; j++) if (kolA[j] === berikut) { barisBerikut = j + 1; break; }
  if (barisBerikut && barisBerikut - baris < tinggi) {
    var tambah = tinggi - (barisBerikut - baris);
    sheet.insertRowsBefore(barisBerikut, tambah);
    barisBerikut += tambah;
    catatan.push('Dashboard: ruang blok ' + judul + ' disisipkan');
  }
  polosIsiBlokDashboard_(sheet, baris, barisBerikut ? barisBerikut - 1 : baris + tinggi - 1);
  return baris;
}

/**
 * Mengembalikan isi satu blok Dashboard (baris di bawah judul blok sampai
 * barisAkhir, kolom A sampai H) ke latar polos dan teks biasa. Perlu karena
 * baris yang disisipkan insertRowsBefore mewarisi format baris di posisi sisip,
 * yaitu baris judul blok berikutnya: latar navy dan kolom A putih tebal,
 * sehingga isi blok tidak terbaca. Dijalankan setiap setupSpreadsheet, jadi
 * Dashboard yang sudah terlanjur navy ikut pulih. Pemanggil memasang lagi gaya
 * baris ringkasan dan baris judul tabel sesudahnya; format angka tidak diubah.
 */
function polosIsiBlokDashboard_(sheet, barisJudul, barisAkhir) {
  var akhir = Math.min(barisAkhir, sheet.getMaxRows());
  if (akhir <= barisJudul) return;
  sheet.getRange(barisJudul + 1, 1, akhir - barisJudul, 8)
    .setBackground(null).setFontColor(null).setFontWeight(null);
}

function judulTabelDashboard_(rentang, judul) {
  rentang.setValues([judul]).setFontWeight('bold').setFontColor(WARNA.tintaRedup).setBackground(WARNA.baja);
}

/**
 * Blok Waste di Dashboard (spesifikasi sistem Bagian 8.5) untuk periode B3:
 * ringkasan, total per kategori waste, 5 item paling sering waste, estimasi
 * kerugian per bulan (6 bulan terakhir), dan tren qty 5 item itu per minggu.
 */
function pasangBlokWasteDashboard_(ss, catatan) {
  var sheet = ss.getSheetByName('Dashboard');
  var h = ruangBlokDashboard_(sheet, 'Waste', TINGGI_BLOK_WASTE, catatan);
  if (!h) return;
  var K = function (judul) { return kolomRumus_(ss, 'Data_Waste', judul); };
  var wT = K('Tanggal'), wI = K('Item / Produk'), wK = K('Kategori Waste'), wQ = K('Qty'), wE = K('Estimasi Kerugian (Rp)');
  var wU = K('Satuan');
  var periode = wT + ',">="&awalP,' + wT + ',"<="&TODAY()';
  // 5 item paling sering waste dalam periode (jumlah catatan, lalu estimasi).
  var top = 'u,IFERROR(UNIQUE(FILTER(' + wI + ',' + wI + '<>"",' + wT + '>=awalP,' + wT + '<=TODAY())),""),' +
    'top,IF(INDEX(u,1,1)="","",ARRAY_CONSTRAIN(SORT(HSTACK(u,' +
      'MAP(u,LAMBDA(x,COUNTIFS(' + wI + ',x,' + periode + '))),' +
      'MAP(u,LAMBDA(x,SUMIFS(' + wQ + ',' + wI + ',x,' + periode + '))),' +
      'MAP(u,LAMBDA(x,SUMIFS(' + wE + ',' + wI + ',x,' + periode + ')))),2,FALSE,4,FALSE),5,4)),';

  sheet.getRange(h + 1, 1).setFormula(rumusLokal_('=LET(' + AWAL_PERIODE_ +
    '"Total estimasi kerugian: "&TEXT(SUMIFS(' + wE + ',' + periode + '),"""Rp ""#,##0")&" · "&' +
    'COUNTIFS(' + periode + ',' + wI + ',"<>")&" catatan · Periode: "&$B$3)'))
    .setFontStyle('normal').setFontColor(WARNA.tinta);

  judulTabelDashboard_(sheet.getRange(h + 2, 1, 1, 8),
    ['Kategori Waste', 'Catatan', 'Estimasi (Rp)', '', '5 item paling sering', 'Catatan', 'Qty', 'Estimasi (Rp)']);
  sheet.getRange(h + 3, 1).setFormula(rumusLokal_('=LET(' + AWAL_PERIODE_ +
    'k,VSTACK(' + KATEGORI_WASTE.map(function (x) { return '"' + x + '"'; }).join(',') + '),' +
    'HSTACK(k,MAP(k,LAMBDA(x,COUNTIFS(' + wK + ',x,' + periode + '))),MAP(k,LAMBDA(x,SUMIFS(' + wE + ',' + wK + ',x,' + periode + ')))))'));
  sheet.getRange(h + 3, 5).setFormula(rumusLokal_('=LET(' + AWAL_PERIODE_ + top +
    'IF(INDEX(u,1,1)="","Belum ada waste.",top))'));
  sheet.getRange(h + 3, 2, 5, 1).setNumberFormat(FORMAT.bulat);
  sheet.getRange(h + 3, 3, 5, 1).setNumberFormat(FORMAT.rupiah);
  sheet.getRange(h + 3, 6, 5, 1).setNumberFormat(FORMAT.bulat);
  sheet.getRange(h + 3, 7, 5, 1).setNumberFormat(FORMAT.angka);
  sheet.getRange(h + 3, 8, 5, 1).setNumberFormat(FORMAT.rupiah);

  judulTabelDashboard_(sheet.getRange(h + 9, 1, 1, 8),
    ['Bulan', 'Estimasi (Rp)', '', '', 'Qty per minggu', '7 hari terakhir', '8–14 hari lalu', '15–21 hari lalu']);
  sheet.getRange(h + 10, 1).setFormula(rumusLokal_('=LET(m,MAP(SEQUENCE(6),LAMBDA(i,EDATE(DATE(YEAR(TODAY()),MONTH(TODAY()),1),i-6))),' +
    'HSTACK(m,MAP(m,LAMBDA(x,SUMIFS(' + wE + ',' + wT + ',">="&x,' + wT + ',"<"&EDATE(x,1))))))'));
  sheet.getRange(h + 10, 1, 6, 1).setNumberFormat('mmm yyyy');
  sheet.getRange(h + 10, 2, 6, 1).setNumberFormat(FORMAT.rupiah);
  var minggu = function (a, b) {
    return 'MAP(CHOOSECOLS(top,1),LAMBDA(x,SUMIFS(' + wQ + ',' + wI + ',x,' + wT + ',">="&(TODAY()-' + b + '),' + wT + ',"<="&(TODAY()-' + a + '))))';
  };
  sheet.getRange(h + 10, 5).setFormula(rumusLokal_('=LET(' + AWAL_PERIODE_ + top +
    'IF(INDEX(u,1,1)="","Belum ada waste.",HSTACK(MAP(CHOOSECOLS(top,1),LAMBDA(x,x&" ("&XLOOKUP(x,' + wI + ',' + wU + ',"")&")")),' +
    minggu(0, 6) + ',' + minggu(7, 13) + ',' + minggu(14, 20) + ')))'));
  sheet.getRange(h + 10, 6, 5, 3).setNumberFormat(FORMAT.angka);
  catatan.push('Rumus waste dipasang: Dashboard (blok Waste)');
}

/**
 * Blok Suhu Chiller & Freezer di Dashboard (Bagian 8.5): ringkasan kejadian
 * di luar standar dalam periode B3; per unit aktif: jumlah cek, di luar
 * standar, rata-rata, terendah, tertinggi, dan suhu terakhir; lalu tren
 * rata-rata suhu per unit per hari selama 7 hari terakhir.
 */
function pasangBlokSuhuDashboard_(ss, catatan) {
  var sheet = ss.getSheetByName('Dashboard');
  var h = ruangBlokDashboard_(sheet, 'Suhu Chiller & Freezer', TINGGI_BLOK_SUHU, catatan);
  if (!h) return;
  var K = function (judul) { return kolomRumus_(ss, 'Data_Suhu', judul); };
  var sT = K('Tanggal'), sU = K('Nama Unit'), sS = K('Suhu (°C)'), sSt = K('Status Suhu'), sTs = K('timestamp_server');
  var uN = kolomRumus_(ss, 'M_Unit', 'Nama Unit'), uT = kolomRumus_(ss, 'M_Unit', 'Tipe'), uA = kolomRumus_(ss, 'M_Unit', 'Aktif');
  var periode = sT + ',">="&awalP,' + sT + ',"<="&TODAY()';
  var unit = 'u,IFERROR(ARRAY_CONSTRAIN(FILTER(' + uN + ',' + uN + '<>"",' + uA + '=TRUE),10,1),""),';

  sheet.getRange(h + 1, 1).setFormula(rumusLokal_('=LET(' + AWAL_PERIODE_ +
    'n,COUNTIFS(' + periode + ',' + sSt + ',"Di Luar Standar"),' +
    'IF(n=0,"Semua pengecekan normal","Pengecekan di luar standar: "&n)&" · "&COUNTIFS(' + periode + ',' + sU + ',"<>")&" pengecekan · Periode: "&$B$3)'))
    .setFontStyle('normal').setFontColor(WARNA.tinta);

  judulTabelDashboard_(sheet.getRange(h + 2, 1, 1, 8),
    ['Unit', 'Tipe', 'Pengecekan', 'Di luar standar', 'Rata-rata (°C)', 'Terendah (°C)', 'Tertinggi (°C)', 'Terakhir (°C)']);
  var per = function (rumus) { return 'MAP(u,LAMBDA(x,' + rumus + '))'; };
  var ada = 'COUNTIFS(' + sU + ',x,' + periode + ')';
  sheet.getRange(h + 3, 1).setFormula(rumusLokal_('=LET(' + AWAL_PERIODE_ + unit +
    'IF(INDEX(u,1,1)="","Belum ada unit aktif.",HSTACK(u,' +
      per('XLOOKUP(x,' + uN + ',' + uT + ',"")') + ',' +
      per(ada) + ',' +
      per('COUNTIFS(' + sU + ',x,' + periode + ',' + sSt + ',"Di Luar Standar")') + ',' +
      per('IF(' + ada + '=0,"",ROUND(AVERAGEIFS(' + sS + ',' + sU + ',x,' + periode + '),1))') + ',' +
      per('IF(' + ada + '=0,"",MINIFS(' + sS + ',' + sU + ',x,' + periode + '))') + ',' +
      per('IF(' + ada + '=0,"",MAXIFS(' + sS + ',' + sU + ',x,' + periode + '))') + ',' +
      per('IFERROR(INDEX(FILTER(' + sS + ',' + sU + '=x,' + sTs + '=MAXIFS(' + sTs + ',' + sU + ',x)),1),"")') + ')))'));
  sheet.getRange(h + 3, 3, 10, 2).setNumberFormat(FORMAT.bulat);
  sheet.getRange(h + 3, 5, 10, 4).setNumberFormat(FORMAT.suhu);

  sheet.getRange(h + 14, 1).setValue('Rata-rata per hari (°C)');
  sheet.getRange(h + 14, 2).setFormula(rumusLokal_('=MAP(SEQUENCE(1,7,-6),LAMBDA(i,TODAY()+i))'));
  sheet.getRange(h + 14, 1, 1, 8).setFontWeight('bold').setFontColor(WARNA.tintaRedup).setBackground(WARNA.baja);
  sheet.getRange(h + 14, 2, 1, 7).setNumberFormat('d mmm');
  sheet.getRange(h + 15, 1).setFormula(rumusLokal_('=LET(' + unit +
    'IF(INDEX(u,1,1)="","Belum ada unit aktif.",HSTACK(u,MAKEARRAY(ROWS(u),7,LAMBDA(r,c,' +
      'IFERROR(ROUND(AVERAGEIFS(' + sS + ',' + sU + ',INDEX(u,r,1),' + sT + ',TODAY()-7+c),1),""))))))'));
  sheet.getRange(h + 15, 2, 10, 7).setNumberFormat(FORMAT.suhu);
  pasangAturanWarna_(sheet, [
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(rumusLokal_('=AND(ISNUMBER($D' + (h + 3) + '),$D' + (h + 3) + '>0)'))
      .setFontColor(WARNA.masalah).setBold(true).setRanges([sheet.getRange(h + 3, 4, 10, 1)]).build()
  ]);
  catatan.push('Rumus suhu dipasang: Dashboard (blok Suhu Chiller & Freezer)');
}

/* ---------- Tahap 6: rumus Harian_Prep dan blok Prep List ---------- */

/**
 * Rumus tab Harian_Prep (spesifikasi sistem Bagian 8.3), satu rumus di A9:
 * satu baris per item prep pada tanggal itu, urut waktu kirim (No, Item /
 * Menu Prep, Nama Staff, Shift, Jumlah Resep, Hasil atau Qty, Satuan,
 * Keterangan), lalu Diisi oleh dan Diperiksa oleh.
 */
function rumusHarianPrep_(ss) {
  var K = function (judul) { return kolomRumus_(ss, 'Data_Prep', judul); };
  var dT = K('Tanggal');
  var dI = K('Item / Menu Prep');
  return '=LET(tgl,$B$5,' +
    'n,COUNTIFS(' + dT + ',tgl,' + dI + ',"<>"),' +
    'f,IF(n=0,"",SORT(FILTER(HSTACK(' + [dI, K('Nama Staff'), K('Shift'), K('Jumlah Resep'),
      'ARRAYFORMULA(IF(' + K('Hasil') + '<>"",' + K('Hasil') + ',' + K('Qty') + '))', K('Satuan'), K('Keterangan'),
      K('timestamp_server')].join(',') + '),' + dT + '=tgl,' + dI + '<>""),8,TRUE)),' +
    'tabel,IF(n=0,HSTACK("Belum ada data.",' + kosong_(7) + '),HSTACK(SEQUENCE(n),CHOOSECOLS(f,1,2,3,4,5,6,7))),' +
    bawahHarian_(ss, 'Data_Prep', 8) +
    'VSTACK(tabel,bawah))';
}

function pasangRumusHarianPrep_(ss, catatan) {
  var sheet = ss.getSheetByName('Harian_Prep');
  var sel = selRumusHarian_(sheet, catatan);
  if (!sel) return;
  var mulai = sel.getRow();
  sel.setFormula(rumusLokal_(rumusHarianPrep_(ss))).setFontStyle('normal').setFontColor(WARNA.tinta);
  var tinggi = Math.max(1, sheet.getMaxRows() - mulai + 1);
  sheet.getRange(mulai, 1, tinggi, 1).setNumberFormat(FORMAT.bulat).setHorizontalAlignment('right');
  sheet.getRange(mulai, 5, tinggi, 2).setNumberFormat(FORMAT.angka);
  catatan.push('Rumus prep dipasang: Harian_Prep');
}

/** Tinggi blok Prep List di Dashboard: dari baris judul blok sampai sebelum judul blok berikutnya. */
var TINGGI_BLOK_PREP = 26;

/**
 * Blok Prep List di Dashboard (spesifikasi sistem Bagian 8.5): ringkasan
 * periode B3; total resep dan hasil per item per minggu (7 hari terakhir,
 * 8–14, dan 15–21 hari lalu; hasil item tanpa resep = Qty); pemakaian bahan
 * untuk prep selama periode B3 (10 terbanyak); beban kerja per staff per
 * shift selama periode B3 (jumlah item prep).
 */
function pasangBlokPrepDashboard_(ss, catatan) {
  var sheet = ss.getSheetByName('Dashboard');
  var h = ruangBlokDashboard_(sheet, 'Prep List', TINGGI_BLOK_PREP, catatan);
  if (!h) return;
  var K = function (judul) { return kolomRumus_(ss, 'Data_Prep', judul); };
  var B = function (judul) { return kolomRumus_(ss, 'Data_PrepBahan', judul); };
  var pT = K('Tanggal'), pI = K('Item / Menu Prep'), pJ = K('Jumlah Resep'), pH = K('Hasil'), pQ = K('Qty');
  var pU = K('Satuan'), pN = K('Nama Staff'), pS = K('Shift');
  var bT = B('Tanggal'), bI = B('Item Bahan'), bQ = B('Qty Terpakai'), bU = B('Satuan');
  var periode = pT + ',">="&awalP,' + pT + ',"<="&TODAY()';
  var periodeB = bT + ',">="&awalP,' + bT + ',"<="&TODAY()';

  sheet.getRange(h + 1, 1).setFormula(rumusLokal_('=LET(' + AWAL_PERIODE_ +
    '"Prep: "&COUNTIFS(' + periode + ',' + pI + ',"<>")&" catatan · "&ROUND(SUMIFS(' + pJ + ',' + periode + '),2)&' +
    '" resep · Periode: "&$B$3)'))
    .setFontStyle('normal').setFontColor(WARNA.tinta);

  judulTabelDashboard_(sheet.getRange(h + 2, 1, 1, 8),
    ['Item (21 hari terakhir)', 'Satuan', 'Resep 7 hari terakhir', 'Hasil 7 hari terakhir', 'Resep 8–14 hari lalu',
      'Hasil 8–14 hari lalu', 'Resep 15–21 hari lalu', 'Hasil 15–21 hari lalu']);
  sheet.getRange(h + 2, 1, 1, 8).setWrap(true);
  var minggu = function (a, b) { return pT + ',">="&(TODAY()-' + b + '),' + pT + ',"<="&(TODAY()-' + a + ')'; };
  var resep = function (a, b) { return 'MAP(u,LAMBDA(x,SUMIFS(' + pJ + ',' + pI + ',x,' + minggu(a, b) + ')))'; };
  var hasil = function (a, b) {
    return 'MAP(u,LAMBDA(x,SUMIFS(' + pH + ',' + pI + ',x,' + minggu(a, b) + ')+SUMIFS(' + pQ + ',' + pI + ',x,' + minggu(a, b) + ')))';
  };
  sheet.getRange(h + 3, 1).setFormula(rumusLokal_('=LET(' +
    'u,IFERROR(SORT(UNIQUE(FILTER(' + pI + ',' + pI + '<>"",' + pT + '>=TODAY()-20,' + pT + '<=TODAY()))),""),' +
    'IF(INDEX(u,1,1)="","Belum ada prep dalam 21 hari terakhir.",ARRAY_CONSTRAIN(HSTACK(u,' +
      'MAP(u,LAMBDA(x,XLOOKUP(x,' + pI + ',' + pU + ',""))),' +
      resep(0, 6) + ',' + hasil(0, 6) + ',' + resep(7, 13) + ',' + hasil(7, 13) + ',' + resep(14, 20) + ',' + hasil(14, 20) +
    '),10,8)))'));
  sheet.getRange(h + 3, 3, 10, 6).setNumberFormat(FORMAT.angka);

  judulTabelDashboard_(sheet.getRange(h + 14, 1, 1, 8),
    ['Bahan terpakai untuk prep', 'Satuan', 'Qty terpakai', 'Catatan prep', 'Beban kerja per staff', 'Pagi', 'Siang', 'Malam']);
  sheet.getRange(h + 14, 1, 1, 8).setWrap(true);
  sheet.getRange(h + 15, 1).setFormula(rumusLokal_('=LET(' + AWAL_PERIODE_ +
    'u,IFERROR(UNIQUE(FILTER(' + bI + ',' + bI + '<>"",' + bT + '>=awalP,' + bT + '<=TODAY())),""),' +
    'IF(INDEX(u,1,1)="","Belum ada pemakaian bahan.",ARRAY_CONSTRAIN(SORT(HSTACK(u,' +
      'MAP(u,LAMBDA(x,XLOOKUP(x,' + bI + ',' + bU + ',""))),' +
      'MAP(u,LAMBDA(x,SUMIFS(' + bQ + ',' + bI + ',x,' + periodeB + '))),' +
      'MAP(u,LAMBDA(x,COUNTIFS(' + bI + ',x,' + periodeB + ')))),3,FALSE),10,4)))'));
  sheet.getRange(h + 15, 3, 10, 1).setNumberFormat(FORMAT.angka);
  sheet.getRange(h + 15, 4, 10, 1).setNumberFormat(FORMAT.bulat);
  sheet.getRange(h + 15, 5).setFormula(rumusLokal_('=LET(' + AWAL_PERIODE_ +
    'u,IFERROR(SORT(UNIQUE(FILTER(' + pN + ',' + pN + '<>"",' + pT + '>=awalP,' + pT + '<=TODAY()))),""),' +
    'c,LAMBDA(x,s,COUNTIFS(' + pN + ',x,' + pS + ',s,' + periode + ')),' +
    'IF(INDEX(u,1,1)="","Belum ada prep.",ARRAY_CONSTRAIN(HSTACK(u,' +
      'MAP(u,LAMBDA(x,c(x,"Pagi"))),MAP(u,LAMBDA(x,c(x,"Siang"))),MAP(u,LAMBDA(x,c(x,"Malam")))),10,4)))'));
  sheet.getRange(h + 15, 6, 10, 3).setNumberFormat(FORMAT.bulat);
  catatan.push('Rumus prep dipasang: Dashboard (blok Prep List)');
}

/* ---------- Tahap 7: blok Nilai stock dan Kepatuhan, grafik tiap blok di Dashboard ---------- */

/** Tinggi blok Nilai stock dan Kepatuhan di Dashboard (baris judul blok sampai sebelum blok berikutnya). */
var TINGGI_BLOK_NILAI = 20;
var BARIS_TABEL_NILAI = 15;
var TINGGI_BLOK_KEPATUHAN = 36;
var BARIS_TABEL_KEPATUHAN = 31; // periode terpanjang: bulan berjalan atau 30 hari

/** Nomor baris judul blok di kolom A Dashboard, atau 0. */
function barisBlokDashboard_(sheet, judul) {
  var akhir = sheet.getLastRow();
  if (akhir < 1) return 0;
  var kolA = sheet.getRange(1, 1, akhir, 1).getValues();
  for (var i = 0; i < kolA.length; i++) if (String(kolA[i][0]) === judul) return i + 1;
  return 0;
}

/**
 * Ringkasan keadaan item di samping tabel blok Stock Inventory (G7:H10): item
 * yang cukup, di bawah stok minimum, dan Stock Akhir minus. Sumber grafik blok ini.
 */
function pasangRingkasStockDashboard_(ss, catatan) {
  var sheet = ss.getSheetByName('Dashboard');
  if (String(sheet.getRange(5, 1).getValue()) !== 'Stock Inventory') return;
  var akhir = 7 + TINGGI_BLOK_STOCK;
  judulTabelDashboard_(sheet.getRange(7, 7, 1, 2), ['Keadaan item', 'Item']);
  sheet.getRange(8, 7, 3, 1).setValues([['Cukup'], ['Di bawah stok minimum'], ['Stock akhir minus']])
    .setFontColor(WARNA.tinta);
  sheet.getRange(8, 8).setFormula(rumusLokal_('=SUMPRODUCT(ISNUMBER($B$8:$B$' + akhir + ')*($F$8:$F$' + akhir + '=""))'));
  sheet.getRange(9, 8).setFormula(rumusLokal_('=COUNTIF($F$8:$F$' + akhir + ',"Perlu reorder")'));
  sheet.getRange(10, 8).setFormula(rumusLokal_('=COUNTIF($F$8:$F$' + akhir + ',"Stock akhir minus")'));
  sheet.getRange(8, 8, 3, 1).setNumberFormat(FORMAT.bulat);
  catatan.push('Rumus stock dipasang: Dashboard (keadaan item untuk grafik)');
}

/**
 * LET bersama blok Nilai stock (Bagian 8.5). Sama dengan nilaiStock_ di
 * aplikasi: Stock Akhir terkini × Harga Satuan di M_Item (= harga yang berlaku
 * hari ini); yang dihitung item aktif dan item nonaktif yang stock-nya belum
 * nol (ikut); item tanpa harga tidak dihitung. Bahan terpakai per periode B3 =
 * (Stock Keluar + Dipakai Prep) tiap hari × harga yang berlaku hari itu menurut
 * M_HargaItem, hanya untuk item yang tidak punya resep aktif.
 * Harga per hari (prH, satu nilai per baris Stock_Harian dalam periode): baris
 * M_HargaItem item itu dengan Berlaku Mulai terbesar yang tidak melewati
 * tanggalnya (MAXIFS; kosong = sejak awal: MAXIFS menjadi 0 dan sel kosong
 * sama dengan 0, jadi FILTER menemukan baris harga awal); item tanpa baris di
 * M_HargaItem memakai Harga Satuan M_Item; belum punya harga = 0. Tanpa LAMBDA
 * bersarang: satu MAP atas baris periode, lalu SUMPRODUCT per item.
 */
function letNilaiStock_(ss) {
  var K = function (tab, judul) { return kolomRumus_(ss, tab, judul); };
  return AWAL_PERIODE_ +
    'shT,' + K('Stock_Harian', 'Tanggal') + ',shI,' + K('Stock_Harian', 'Nama Item') + ',' +
    'shA,' + K('Stock_Harian', 'Stock Akhir') + ',shK,' + K('Stock_Harian', 'Stock Keluar') + ',' +
    'shD,' + K('Stock_Harian', 'Dipakai Prep') + ',' +
    'iN,' + K('M_Item', 'Nama Item') + ',' +
    'it,FILTER(iN,iN<>""),' +
    'ka,FILTER(' + K('M_Item', 'Kategori') + ',iN<>""),' +
    'sa,FILTER(' + K('M_Item', 'Satuan') + ',iN<>""),' +
    'hg,FILTER(' + K('M_Item', 'Harga Satuan (Rp)') + ',iN<>""),' +
    'ac,FILTER(' + K('M_Item', 'Aktif') + ',iN<>""),' +
    'kN,' + K('M_Kategori', 'Nama Kategori') + ',kU,' + K('M_Kategori', 'Urutan') + ',' +
    'rH,' + K('M_Resep', 'Item Hasil') + ',rA,' + K('M_Resep', 'Aktif') + ',' +
    'hgM,' + K('M_Item', 'Harga Satuan (Rp)') + ',' +
    'rwN,' + K('M_HargaItem', 'Nama Item') + ',rwT,' + K('M_HargaItem', 'Berlaku Mulai') + ',' +
    'rwH,' + K('M_HargaItem', 'Harga Satuan (Rp)') + ',' +
    'ak,MAP(it,LAMBDA(x,LET(lt,MAXIFS(shT,shI,x,shT,"<="&TODAY()),IF(lt=0,0,IFERROR(INDEX(FILTER(shA,shI=x,shT=lt),1),0))))),' +
    'ikut,ARRAYFORMULA(((ac=TRUE)+(ak<>0))>0),' +
    'ber,ARRAYFORMULA(ISNUMBER(hg)),' +
    'nv,ARRAYFORMULA(IF(ber,ak*hg,0)),' +
    'prS,ARRAYFORMULA((shI<>"")*(shT>=awalP)*(shT<=TODAY())),' +
    'prT,IFERROR(FILTER(shT,prS),""),' +
    'prI,IFERROR(FILTER(shI,prS),""),' +
    'prK,IFERROR(FILTER(shK,prS),0),' +
    'prD,IFERROR(FILTER(shD,prS),0),' +
    'prH,IF(INDEX(prT,1,1)="",0,MAP(prI,prT,LAMBDA(x,d,IF(COUNTIF(rwN,x)=0,IFERROR(N(XLOOKUP(x,iN,hgM)),0),' +
      'LET(rwM,MAXIFS(rwT,rwN,x,rwT,"<="&d),IFERROR(N(INDEX(FILTER(rwH,rwN=x,rwT=rwM),1)),0)))))),' +
    'bt,IF(INDEX(prT,1,1)="",MAP(it,LAMBDA(x,0)),MAP(it,LAMBDA(x,IF(COUNTIFS(rH,x,rA,TRUE)>0,0,' +
      'SUMPRODUCT((prI=x)*prK*prH)+SUMPRODUCT((prI=x)*prD*prH))))),' +
    'kt,ARRAYFORMULA(IF(ka="","Tanpa kategori",ka)),';
}

/**
 * Blok Nilai stock di Dashboard (Bagian 8.5): ringkasan (nilai stock saat
 * ini, jumlah item tanpa harga, bahan terpakai dalam periode B3); per
 * kategori: nilai stock dan bahan terpakai (urut M_Kategori); daftar item
 * yang belum punya harga.
 */
function pasangBlokNilaiDashboard_(ss, catatan) {
  var sheet = ss.getSheetByName('Dashboard');
  var h = ruangBlokDashboard_(sheet, 'Nilai stock', TINGGI_BLOK_NILAI, catatan);
  if (!h) return;
  var L = letNilaiStock_(ss);
  var rp = '"""Rp ""#,##0"';
  sheet.getRange(h + 1, 1).setFormula(rumusLokal_('=LET(' + L +
    '"Nilai stock saat ini: "&TEXT(SUMPRODUCT(nv*ikut),' + rp + ')&" · Belum punya harga: "&SUMPRODUCT(ikut*(ber=FALSE))&' +
    '" item · Bahan terpakai: "&TEXT(SUM(bt),' + rp + ')&" · Periode: "&$B$3)'))
    .setFontStyle('normal').setFontColor(WARNA.tinta);
  judulTabelDashboard_(sheet.getRange(h + 2, 1, 1, 8),
    ['Kategori', 'Nilai stock (Rp)', 'Bahan terpakai (Rp)', '', 'Belum punya harga', 'Kategori', 'Stock', 'Satuan']);
  sheet.getRange(h + 2, 1, 1, 8).setWrap(true);
  // Nama di LET tidak membedakan huruf besar dan kecil: "ku" bertabrakan dengan kU (Urutan
  // M_Kategori) dan rumusnya menjadi #NAME?. Karena itu nama di sini ditulis panjang.
  sheet.getRange(h + 3, 1).setFormula(rumusLokal_('=LET(' + L +
    'katAda,IFERROR(UNIQUE(FILTER(kt,((ikut*ber)+(bt<>0))>0)),""),' +
    'IF(INDEX(katAda,1,1)="","Belum ada item yang punya harga.",LET(' +
      'urut,MAP(katAda,LAMBDA(k,LET(u,IFERROR(XLOOKUP(k,kN,kU),""),IF(u="",999,u)))),' +
      'katUrut,SORT(katAda,urut,TRUE,katAda,TRUE),' +
      'ARRAY_CONSTRAIN(HSTACK(katUrut,MAP(katUrut,LAMBDA(k,SUMPRODUCT((kt=k)*ikut*nv))),' +
      'MAP(katUrut,LAMBDA(k,SUMPRODUCT((kt=k)*bt)))),' +
      BARIS_TABEL_NILAI + ',3))))'));
  sheet.getRange(h + 3, 5).setFormula(rumusLokal_('=LET(' + L +
    'n,SUMPRODUCT(ikut*(ber=FALSE)),' +
    'IF(n=0,"Semua item sudah punya harga.",ARRAY_CONSTRAIN(SORT(FILTER(HSTACK(it,kt,ak,sa),ikut,ber=FALSE),1,TRUE),' +
      BARIS_TABEL_NILAI + ',4)))'));
  sheet.getRange(h + 3, 2, BARIS_TABEL_NILAI, 2).setNumberFormat(FORMAT.rupiah);
  sheet.getRange(h + 3, 7, BARIS_TABEL_NILAI, 1).setNumberFormat(FORMAT.angka);
  catatan.push('Rumus nilai stock dipasang: Dashboard (blok Nilai stock)');
}

/**
 * Blok Kepatuhan di Dashboard (Bagian 8.5): satu baris per hari dalam periode
 * B3 (lama ke baru) dengan status tiap form bawaan menurut aturan kelengkapan
 * Bagian 5.8 (Terkirim, Nihil, Belum diisi; Suhu "x dari y" memakai unit
 * aktif sekarang; form yang disembunyikan "–"), jumlah form yang belum
 * lengkap, isian (kiriman) yang belum diperiksa, dan baris dilaporkan keliru.
 * Tahap 9: kolom I "Form kustom" ("1 dari 2", Terkirim, atau "–" jika tidak
 * ada form kustom yang dijadwalkan hari itu), dan form kustom ikut dihitung
 * di kolom F, G, H. Tab Data_K_<ID> dibaca lewat INDIRECT dari daftar form
 * kustom yang tampil di M_Form, jadi form baru langsung ikut tanpa
 * setupSpreadsheet. Form sewaktu-waktu dan form di luar jadwalnya tidak ditagih.
 * Hari libur (Code.gs v0.30, tanggal di M_HariLibur): kolom form yang belum
 * diisi bertuliskan "Libur" (yang sebagian "Libur (3 dari 9)") dan kolom F
 * bernilai 0; isian yang tetap dikirim tetap terlihat (Terkirim, Nihil) dan
 * tetap dihitung di kolom G dan H.
 */
function pasangBlokKepatuhanDashboard_(ss, catatan) {
  var sheet = ss.getSheetByName('Dashboard');
  var h = ruangBlokDashboard_(sheet, 'Kepatuhan', TINGGI_BLOK_KEPATUHAN, catatan);
  if (!h) return;
  var K = function (tab, judul) { return kolomRumus_(ss, tab, judul); };
  var tab = function (awalan, namaTab, kolItem) {
    return awalan + 'T,' + K(namaTab, 'Tanggal') + ',' + awalan + 'I,' + K(namaTab, kolItem) + ',' +
      awalan + 'S,' + K(namaTab, 'submission_id') + ',' + awalan + 'St,' + K(namaTab, 'status') + ',' +
      awalan + 'F,' + K(namaTab, 'flagged_by') + ',';
  };
  var fI = K('M_Form', 'ID Form');
  var fN = K('M_Form', 'Nama');
  var hlT = K(TAB_LIBUR, 'Tanggal');
  var awal = h + 3;
  var akhir = awal + BARIS_TABEL_KEPATUHAN - 1;
  var kolA = '$A$' + awal + ':$A$' + akhir;
  // Jumlah hari libur dihitung dari tanggal tabel (tanggal yang ditulis dua kali di M_HariLibur tetap satu hari).
  sheet.getRange(h + 1, 1).setFormula(rumusLokal_('=LET(hl,SUMPRODUCT((' + kolA + '<>"")*(COUNTIF(' + hlT + ',' + kolA + ')>0)),' +
    '"Hari dengan form belum lengkap: "&COUNTIF($F$' + awal + ':$F$' + akhir + ',">0")&' +
    '" dari "&COUNT(' + kolA + ')&" hari"&IF(hl>0," (termasuk "&hl&" hari libur)","")&' +
    '" · Isian belum diperiksa: "&SUM($G$' + awal + ':$G$' + akhir + ')&' +
    '" · Baris dilaporkan keliru: "&SUM($H$' + awal + ':$H$' + akhir + ')&" · Periode: "&$B$3)'))
    .setFontStyle('normal').setFontColor(WARNA.tinta);
  judulTabelDashboard_(sheet.getRange(h + 2, 1, 1, 9),
    ['Tanggal', 'Stock', 'Suhu', 'Prep list', 'Waste', 'Form belum lengkap', 'Isian belum diperiksa', 'Baris dilaporkan keliru',
      'Form kustom']);
  sheet.getRange(h + 2, 1, 1, 9).setWrap(true);
  [['STOCK', 'Stock'], ['SUHU', 'Suhu'], ['PREP', 'Prep list'], ['WASTE', 'Waste']].forEach(function (f, i) {
    sheet.getRange(h + 2, 2 + i).setFormula(rumusLokal_('=IFERROR(XLOOKUP("' + f[0] + '",' + fI + ',' + fN + '),"' + f[1] + '")'));
  });
  // Nama di LET tidak membedakan huruf besar dan kecil: "st" dan "ua" bertabrakan dengan sT
  // (Tanggal Data_Stock) dan uA (Aktif M_Unit), sehingga rumusnya #NAME?. Dipakai stForm dan unitAktif.
  // Nama untuk form kustom (Tahap 9) diawali "kf" dan "ku" supaya tidak bertabrakan dengan nama lain.
  var hariId = '"Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"';
  // Hari libur (lb = tanggal ada di M_HariLibur): status yang belum lengkap ditulis "Libur"; isian sebagian tetap
  // terlihat, misalnya "Libur (3 dari 9)", sama dengan Beranda aplikasi.
  var lib = function (x) {
    return 'IF(AND(lb,' + x + '<>"Terkirim",' + x + '<>"Nihil",' + x + '<>"–"),IF(OR(' + x + '="Belum diisi",' + x +
      '="Tidak ada unit",LEFT(' + x + ',2)="0 "),"Libur","Libur ("&' + x + '&")"),' + x + ')';
  };
  sheet.getRange(awal, 1).setFormula(rumusLokal_('=LET(' + AWAL_PERIODE_ +
    'fI,' + fI + ',fA,' + K('M_Form', 'Aktif') + ',hlT,' + hlT + ',' +
    'kfJenis,' + K('M_Form', 'Jenis') + ',kfJadwal,' + K('M_Form', 'Jadwal') + ',kfHari,' + K('M_Form', 'Hari') + ',' +
    'kfArsip,' + K('M_Form', 'Diarsipkan') + ',' +
    'nT,' + K('Data_Nihil', 'Tanggal') + ',nF,' + K('Data_Nihil', 'ID Form') + ',' +
    tab('s', 'Data_Stock', 'Nama Item') + tab('c', 'Data_Suhu', 'Nama Unit') + 'cW,' + K('Data_Suhu', 'Waktu Cek') + ',' +
    tab('p', 'Data_Prep', 'Item / Menu Prep') + tab('w', 'Data_Waste', 'Item / Produk') +
    'uN,' + K('M_Unit', 'Nama Unit') + ',uA,' + K('M_Unit', 'Aktif') + ',' +
    'nu,IFERROR(ROWS(FILTER(uN,uN<>"",uA=TRUE)),0),' +
    'unitAktif,IFERROR(FILTER(uN,uN<>"",uA=TRUE),""),' +
    'stForm,LAMBDA(id,dt,di,dd,IF(XLOOKUP(id,fI,fA,FALSE)<>TRUE,"–",IF(COUNTIFS(dt,dd,di,"<>")>0,"Terkirim",' +
      'IF(COUNTIFS(nT,dd,nF,id)>0,"Nihil","Belum diisi")))),' +
    'su,LAMBDA(dd,IF(XLOOKUP("SUHU",fI,fA,FALSE)<>TRUE,"–",IF(nu=0,"Tidak ada unit",LET(' +
      'n,IFERROR(ROWS(UNIQUE(FILTER(ARRAYFORMULA(cI&"|"&cW),cT=dd,(cW="Opening")+(cW="Middle")+(cW="Closing"),ISNUMBER(MATCH(cI,unitAktif,0))))),0),' +
      'IF(n>=nu*3,"Terkirim",IF(n=0,"Belum diisi",n&" dari "&nu*3)))))),' +
    'bp,LAMBDA(dt,ds,dst,dd,IFERROR(ROWS(UNIQUE(FILTER(ds,dt=dd,ds<>"",dst<>"Diperiksa"))),0)),' +
    // Form kustom yang tampil dan belum dihapus, dan satu kolom tab Data_K_<ID> menurut judulnya.
    'kfId,IFERROR(FILTER(fI,fI<>"",kfJenis="kustom",fA=TRUE,kfArsip=""),""),' +
    'kfKol,LAMBDA(kfX,kfJ,LET(kfTab,"' + AWALAN_TAB_KUSTOM + '"&kfX&"!",kfNo,MATCH(kfJ,INDIRECT(kfTab&"1:1"),0),' +
      'kfHuruf,SUBSTITUTE(ADDRESS(1,kfNo,4),"1",""),INDIRECT(kfTab&kfHuruf&"2:"&kfHuruf))),' +
    'kfWajib,LAMBDA(kfX,dd,LET(kfJw,XLOOKUP(kfX,fI,kfJadwal,""),IF(kfJw="sewaktu-waktu",0,IF(kfJw="hari tertentu",' +
      'IF(ISNUMBER(SEARCH(CHOOSE(WEEKDAY(dd),' + hariId + '),XLOOKUP(kfX,fI,kfHari,""))),1,0),1)))),' +
    'ku,LAMBDA(dd,IFERROR(IF(INDEX(kfId,1,1)="",HSTACK("–",0,0,0),LET(' +
      'kuW,MAP(kfId,LAMBDA(kfX,kfWajib(kfX,dd))),' +
      'kuT,MAP(kfId,LAMBDA(kfX,IF(IFERROR(COUNTIF(kfKol(kfX,"Tanggal"),dd),0)+COUNTIFS(nT,dd,nF,kfX)>0,1,0))),' +
      'kuB,MAP(kfId,LAMBDA(kfX,IFERROR(ROWS(UNIQUE(FILTER(kfKol(kfX,"submission_id"),kfKol(kfX,"Tanggal")=dd,' +
        'kfKol(kfX,"submission_id")<>"",kfKol(kfX,"status")<>"Diperiksa"))),0))),' +
      'kuF,MAP(kfId,LAMBDA(kfX,IFERROR(COUNTIFS(kfKol(kfX,"Tanggal"),dd,kfKol(kfX,"flagged_by"),"<>"),0))),' +
      'kuNw,SUM(kuW),kuNt,SUMPRODUCT(kuW,kuT),' +
      'HSTACK(IF(kuNw=0,"–",IF(kuNt>=kuNw,"Terkirim",kuNt&" dari "&kuNw)),kuNw-kuNt,SUM(kuB),SUM(kuF)))),HSTACK("–",0,0,0))),' +
    'hari,SEQUENCE(TODAY()-awalP+1,1,awalP,1),' +
    'isi,REDUCE(HSTACK(' + kosong_(9) + '),hari,LAMBDA(acc,d,LET(' +
      'a,stForm("STOCK",sT,sI,d),b,su(d),c,stForm("PREP",pT,pI,d),e,stForm("WASTE",wT,wI,d),g,ku(d),' +
      'lb,COUNTIF(hlT,d)>0,' +
      'VSTACK(acc,HSTACK(d,' + lib('a') + ',' + lib('b') + ',' + lib('c') + ',' + lib('e') + ',' +
        'IF(lb,0,(a="Belum diisi")+(b<>"Terkirim")*(b<>"–")+(c="Belum diisi")+(e="Belum diisi")+INDEX(g,1,2)),' +
        'bp(sT,sS,sSt,d)+bp(cT,cS,cSt,d)+bp(pT,pS,pSt,d)+bp(wT,wS,wSt,d)+INDEX(g,1,3),' +
        'COUNTIFS(sT,d,sF,"<>")+COUNTIFS(cT,d,cF,"<>")+COUNTIFS(pT,d,pF,"<>")+COUNTIFS(wT,d,wF,"<>")+INDEX(g,1,4),' +
        lib('INDEX(g,1,1)') + '))))),' +
    'CHOOSEROWS(isi,SEQUENCE(ROWS(isi)-1,1,2)))'));
  sheet.getRange(awal, 1, BARIS_TABEL_KEPATUHAN, 1).setNumberFormat('d mmm');
  sheet.getRange(awal, 6, BARIS_TABEL_KEPATUHAN, 3).setNumberFormat(FORMAT.bulat);
  pasangAturanWarna_(sheet, [
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(rumusLokal_('=AND(B' + awal + '<>"",B' + awal + '<>"Terkirim",B' + awal + '<>"Nihil",B' + awal + '<>"–",' +
        'LEFT(B' + awal + ',5)<>"Libur")'))
      .setFontColor(WARNA.tinjau).setBold(true).setRanges([sheet.getRange(awal, 2, BARIS_TABEL_KEPATUHAN, 4)]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(rumusLokal_('=AND(I' + awal + '<>"",I' + awal + '<>"Terkirim",I' + awal + '<>"–",LEFT(I' + awal + ',5)<>"Libur")'))
      .setFontColor(WARNA.tinjau).setBold(true).setRanges([sheet.getRange(awal, 9, BARIS_TABEL_KEPATUHAN, 1)]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(rumusLokal_('=AND(ISNUMBER($H' + awal + '),$H' + awal + '>0)'))
      .setFontColor(WARNA.tinjau).setBold(true).setRanges([sheet.getRange(awal, 8, BARIS_TABEL_KEPATUHAN, 1)]).build()
  ]);
  catatan.push('Rumus kepatuhan dipasang: Dashboard (blok Kepatuhan, termasuk form kustom)');
}

/* ---------- Tahap 8: blok Stock opname di Dashboard ---------- */

/** Tinggi blok Stock opname di Dashboard dan jumlah baris tabelnya (10 opname terbaru, 10 item). */
var TINGGI_BLOK_OPNAME = 15;
var BARIS_TABEL_OPNAME = 10;

/**
 * Blok Stock opname di Dashboard (spesifikasi sistem Bagian 5.7 dan 8.5):
 * ringkasan (tanggal opname terakhir, jumlah opname dan total nilai selisih
 * dalam periode B3); tiap opname dalam periode (paling banyak 10 terbaru, urut
 * lama ke baru): tanggal, item dihitung, item berselisih, nilai selisih; item
 * yang paling sering berselisih dalam periode (berapa kali, nilai selisihnya).
 * Satu opname = satu submission_id di Data_Opname.
 */
function pasangBlokOpnameDashboard_(ss, catatan) {
  var sheet = ss.getSheetByName('Dashboard');
  var h = ruangBlokDashboard_(sheet, 'Stock opname', TINGGI_BLOK_OPNAME, catatan);
  if (!h) return;
  var K = function (judul) { return kolomRumus_(ss, 'Data_Opname', judul); };
  var L = AWAL_PERIODE_ + 'oT,' + K('Tanggal') + ',oS,' + K('submission_id') + ',oSel,' + K('Selisih') + ',' +
    'oN,' + K('Nilai Selisih (Rp)') + ',oI,' + K('Nama Item') + ',oW,' + K('timestamp_server') + ',' +
    'sids,IFERROR(UNIQUE(FILTER(oS,oS<>"",oT>=awalP,oT<=TODAY())),""),';
  var periode = 'oT,">="&awalP,oT,"<="&TODAY()';
  sheet.getRange(h + 1, 1).setFormula(rumusLokal_('=LET(' + L + 'lt,MAX(oT),' +
    'jml,IF(INDEX(sids,1,1)="",0,ROWS(sids)),' +
    'IF(lt=0,"Belum ada stock opname.","Opname terakhir: "&YEAR(lt)&"-"&TEXT(MONTH(lt),"00")&"-"&TEXT(DAY(lt),"00")&' +
    '" ("&(TODAY()-lt)&" hari lalu) · Opname dalam periode: "&jml&" · Total nilai selisih: "&' +
    'TEXT(SUMIFS(oN,' + periode + '),"""Rp ""#,##0;-""Rp ""#,##0")&" · Periode: "&$B$3))'))
    .setFontStyle('normal').setFontColor(WARNA.tinta);
  judulTabelDashboard_(sheet.getRange(h + 2, 1, 1, 8),
    ['Tanggal opname', 'Item dihitung', 'Item berselisih', 'Nilai selisih (Rp)', '', 'Item paling sering berselisih', 'Kali', 'Nilai selisih (Rp)']);
  sheet.getRange(h + 2, 1, 1, 8).setWrap(true);
  sheet.getRange(h + 3, 1).setFormula(rumusLokal_('=LET(' + L +
    'IF(INDEX(sids,1,1)="","Belum ada stock opname dalam periode ini.",LET(' +
      'tgl,MAP(sids,LAMBDA(x,INDEX(FILTER(oT,oS=x),1))),' +
      'jam,MAP(sids,LAMBDA(x,MAX(FILTER(oW,oS=x)))),' +
      'tabel,HSTACK(tgl,MAP(sids,LAMBDA(x,COUNTIFS(oS,x))),MAP(sids,LAMBDA(x,COUNTIFS(oS,x,oSel,"<>0"))),' +
        'MAP(sids,LAMBDA(x,SUMIFS(oN,oS,x))),jam),' +
      'terbaru,ARRAY_CONSTRAIN(SORT(tabel,1,FALSE,5,FALSE),' + BARIS_TABEL_OPNAME + ',5),' +
      'CHOOSECOLS(SORT(terbaru,1,TRUE,5,TRUE),1,2,3,4))))'));
  sheet.getRange(h + 3, 6).setFormula(rumusLokal_('=LET(' + L +
    'u,IFERROR(UNIQUE(FILTER(oI,oI<>"",oSel<>0,oT>=awalP,oT<=TODAY())),""),' +
    'IF(INDEX(u,1,1)="","Belum ada item berselisih dalam periode ini.",' +
    'ARRAY_CONSTRAIN(SORT(HSTACK(u,MAP(u,LAMBDA(x,COUNTIFS(oI,x,oSel,"<>0",' + periode + '))),' +
      'MAP(u,LAMBDA(x,SUMIFS(oN,oI,x,' + periode + ')))),2,FALSE,3,TRUE),' + BARIS_TABEL_OPNAME + ',3)))'));
  sheet.getRange(h + 3, 1, BARIS_TABEL_OPNAME, 1).setNumberFormat(FORMAT.tanggal);
  sheet.getRange(h + 3, 2, BARIS_TABEL_OPNAME, 2).setNumberFormat(FORMAT.bulat);
  sheet.getRange(h + 3, 4, BARIS_TABEL_OPNAME, 1).setNumberFormat(FORMAT.rupiah);
  sheet.getRange(h + 3, 7, BARIS_TABEL_OPNAME, 1).setNumberFormat(FORMAT.bulat);
  sheet.getRange(h + 3, 8, BARIS_TABEL_OPNAME, 1).setNumberFormat(FORMAT.rupiah);
  catatan.push('Rumus stock opname dipasang: Dashboard (blok Stock opname)');
}

/** Judul grafik yang dibuat setupSpreadsheet; grafik berjudul sama dibuat ulang setiap kali dijalankan. */
var GRAFIK_DASHBOARD = {
  stock: 'Keadaan item stock',
  nilai: 'Nilai stock per kategori',
  opname: 'Nilai selisih tiap opname',
  waste: 'Estimasi kerugian waste per bulan',
  suhu: 'Rata-rata suhu per unit, 7 hari terakhir',
  prep: 'Jumlah resep per item, 7 hari terakhir',
  kepatuhan: 'Kepatuhan per hari'
};

/**
 * Grafik tiap blok di Dashboard (Bagian 8.5), di kanan tabel blok (kolom J),
 * dari tabel yang sudah dihitung rumus blok itu. Grafik lama berjudul sama
 * dibuang dulu, jadi aman dijalankan ulang. Warna navy (tanpa amber,
 * tampilan Bagian 2); keadaan item memakai warna makna status.
 */
function pasangGrafikDashboard_(ss, catatan) {
  var sheet = ss.getSheetByName('Dashboard');
  var milik = {};
  Object.keys(GRAFIK_DASHBOARD).forEach(function (k) { milik[GRAFIK_DASHBOARD[k]] = true; });
  sheet.getCharts().forEach(function (c) {
    var judul = '';
    try {
      judul = String(c.getOptions().get('title') || '');
    } catch (err) {
      judul = '';
    }
    if (milik[judul]) sheet.removeChart(c);
  });
  var jumlah = 0;
  function buat(jenis, rentang, baris, judul, opsi) {
    var b = sheet.newChart().setChartType(jenis).setPosition(baris, 10, 0, 0).setNumHeaders(1)
      .setOption('title', judul)
      .setOption('width', 560)
      .setOption('height', 300)
      .setOption('legend', { position: 'bottom' })
      .setOption('titleTextStyle', { color: WARNA.navyPass, fontSize: 14, bold: true })
      .setOption('colors', [WARNA.biruMalam, WARNA.relPadam, WARNA.garisIsian]);
    rentang.forEach(function (r) { b = b.addRange(r); });
    Object.keys(opsi || {}).forEach(function (k) { b = b.setOption(k, opsi[k]); });
    sheet.insertChart(b.build());
    jumlah++;
  }
  var h = barisBlokDashboard_(sheet, 'Stock Inventory');
  if (h) {
    buat(Charts.ChartType.PIE, [sheet.getRange(h + 2, 7, 4, 2)], h + 2, GRAFIK_DASHBOARD.stock,
      { colors: ['#067647', WARNA.tinjau, WARNA.masalah], legend: { position: 'right' } });
  }
  h = barisBlokDashboard_(sheet, 'Nilai stock');
  if (h) {
    buat(Charts.ChartType.BAR, [sheet.getRange(h + 2, 1, BARIS_TABEL_NILAI + 1, 2)], h + 1, GRAFIK_DASHBOARD.nilai,
      { legend: { position: 'none' } });
  }
  h = barisBlokDashboard_(sheet, 'Stock opname');
  if (h) {
    buat(Charts.ChartType.COLUMN, [sheet.getRange(h + 2, 1, BARIS_TABEL_OPNAME + 1, 1), sheet.getRange(h + 2, 4, BARIS_TABEL_OPNAME + 1, 1)],
      h + 1, GRAFIK_DASHBOARD.opname, { legend: { position: 'none' } });
  }
  h = barisBlokDashboard_(sheet, 'Waste');
  if (h) {
    buat(Charts.ChartType.COLUMN, [sheet.getRange(h + 9, 1, 7, 2)], h + 1, GRAFIK_DASHBOARD.waste,
      { legend: { position: 'none' } });
  }
  h = barisBlokDashboard_(sheet, 'Suhu Chiller & Freezer');
  if (h) {
    var b = sheet.getRange(h + 14, 1, 11, 8);
    var c = sheet.newChart().setChartType(Charts.ChartType.LINE).addRange(b).setPosition(h + 1, 10, 0, 0)
      .setTransposeRowsAndColumns(true).setNumHeaders(1)
      .setOption('title', GRAFIK_DASHBOARD.suhu)
      .setOption('width', 560)
      .setOption('height', 300)
      .setOption('legend', { position: 'bottom' })
      .setOption('titleTextStyle', { color: WARNA.navyPass, fontSize: 14, bold: true })
      .setOption('pointSize', 4)
      .build();
    sheet.insertChart(c);
    jumlah++;
  }
  h = barisBlokDashboard_(sheet, 'Prep List');
  if (h) {
    buat(Charts.ChartType.BAR, [sheet.getRange(h + 2, 1, 11, 1), sheet.getRange(h + 2, 3, 11, 1)], h + 1, GRAFIK_DASHBOARD.prep,
      { legend: { position: 'none' } });
  }
  h = barisBlokDashboard_(sheet, 'Kepatuhan');
  if (h) {
    buat(Charts.ChartType.COLUMN, [sheet.getRange(h + 2, 1, BARIS_TABEL_KEPATUHAN + 1, 1),
      sheet.getRange(h + 2, 6, BARIS_TABEL_KEPATUHAN + 1, 2)], h + 1, GRAFIK_DASHBOARD.kepatuhan, {});
  }
  catatan.push('Grafik Dashboard dipasang: ' + jumlah + ' grafik');
}

/** Menambahkan baris yang kunci kolom A-nya belum ada. Baris lama tidak disentuh. */
function isiBarisAwal_(sheet, baris, label, catatan) {
  var ada = kunciKolomA_(sheet);
  var tambah = baris.filter(function (b) {
    return !ada[String(b[0]).trim().toLowerCase()];
  });
  if (!tambah.length) return;
  sheet.getRange(barisBaruMaster_(sheet, kolomKunciMaster_(sheet), tambah.length), 1, tambah.length, tambah[0].length).setValues(tambah);
  catatan.push(label + ': ' + tambah.length + ' baris awal ditambahkan');
}

function isiKonfigurasiAwal_(sheet, catatan) {
  var ada = kunciKolomA_(sheet);
  var tambah = konfigurasiAwal_().filter(function (b) {
    return !ada[b[0].toLowerCase()];
  });
  if (!tambah.length) return;
  sheet.getRange(barisBaruMaster_(sheet, kolomKunciMaster_(sheet), tambah.length), 1, tambah.length, 3).setValues(tambah);
  catatan.push('M_Konfigurasi: ' + tambah.map(function (b) { return b[0]; }).join(', ') + ' ditambahkan');
}

function kunciKolomA_(sheet) {
  var ada = {};
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return ada;
  sheet.getRange(2, 1, lastRow - 1, 1).getValues().forEach(function (r) {
    var kunci = String(r[0]).trim().toLowerCase();
    if (kunci) ada[kunci] = true;
  });
  return ada;
}

/**
 * Kode acak tanpa huruf/angka yang mirip (0/O, 1/I/L). Sumber acaknya
 * Utilities.getUuid() (UUID versi 4) yang di-hash SHA-256.
 */
function buatKodeAcak_(panjang) {
  var huruf = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  var batas = Math.floor(256 / huruf.length) * huruf.length; // tolak sisa agar tidak berat sebelah
  var kode = '';
  while (kode.length < panjang) {
    var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
      Utilities.getUuid() + Utilities.getUuid() + Date.now());
    for (var i = 0; i < bytes.length && kode.length < panjang; i++) {
      var b = bytes[i] & 0xff;
      if (b < batas) kode += huruf.charAt(b % huruf.length);
    }
  }
  return kode;
}

/* ---------- Urutan dan kebersihan tab ---------- */

function aturUrutanTab_(ss) {
  urutanTab_(ss).forEach(function (nama, i) {
    var sheet = ss.getSheetByName(nama);
    if (sheet && sheet.getIndex() !== i + 1) {
      ss.setActiveSheet(sheet);
      ss.moveActiveSheet(i + 1);
    }
  });
  ss.setActiveSheet(ss.getSheetByName('Dashboard'));
}

/** Menghapus "Sheet1"/"Lembar1" bawaan hanya jika benar-benar kosong. */
function hapusLembarBawaanKosong_(ss, catatan) {
  var milikKita = {};
  urutanTab_(ss).forEach(function (n) { milikKita[n] = true; });
  ss.getSheets().forEach(function (sheet) {
    var nama = sheet.getName();
    if (milikKita[nama]) return;
    if (!/^(sheet|lembar|lembar kerja)\s?1$/i.test(nama)) return;
    if (sheet.getLastRow() === 0 && sheet.getLastColumn() === 0 && ss.getSheets().length > 1) {
      ss.deleteSheet(sheet);
      catatan.push('Lembar kosong bawaan dihapus: ' + nama);
    }
  });
}
