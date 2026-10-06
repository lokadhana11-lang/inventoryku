// InventoryKu Code.gs v0.10 (Tahap 9: form kustom)
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
 * - kirimLaporanHarian : dijalankan trigger harian (sekitar 22.15).
 * - buatCadangan       : dijalankan trigger mingguan.
 * - pasangTrigger      : dijalankan dari editor; memasang kedua trigger.
 * - kirimLaporanSekarang : dijalankan dari editor untuk menguji email dan PDF.
 * - setupSpreadsheet   : dijalankan dari editor; menyimpan ID spreadsheet dan
 *                        membuat semua tab. Aman dijalankan ulang.
 * - buatKodePemasangan : dijalankan dari editor saat tidak ada Pengelola yang
 *                        bisa masuk; membuat Kode Pemasangan baru.
 * - ujiPemisahHalamanPdf : dijalankan dari editor; menguji apakah konversi PDF
 *                        mematuhi pemisah halaman (PDF stock per kategori).
 */

var VERSI_KODE = 'v0.10';

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
  ping: { jalankan: aksiPing_, tanpaToken: true },
  infoLogin: { jalankan: aksiInfoLogin_, tanpaToken: true },
  login: { jalankan: aksiLogin_, tanpaToken: true },
  lupaPin: { jalankan: aksiLupaPin_, tanpaToken: true },
  pasang: { jalankan: aksiPasang_, tanpaToken: true },
  pulihkan: { jalankan: aksiPulihkan_, tanpaToken: true },
  keluar: { jalankan: aksiKeluar_, tanpaToken: true },
  beranda: { jalankan: aksiBeranda_ },
  daftarStaff: { jalankan: aksiDaftarStaff_, pengelola: true },
  tambahStaff: { jalankan: aksiTambahStaff_, pengelola: true },
  ubahStaff: { jalankan: aksiUbahStaff_, pengelola: true },
  aturPin: { jalankan: aksiAturPin_, pengelola: true },
  hapusStaff: { jalankan: aksiHapusStaff_, pengelola: true,
    pesan: 'Menghapus staff hanya bisa dilakukan Head Kitchen atau Manager.' },
  bacaOutletJadwal: { jalankan: aksiBacaOutletJadwal_, pengelola: true,
    pesan: 'Pengaturan outlet dan jadwal hanya untuk Head Kitchen dan Manager.' },
  simpanOutletJadwal: { jalankan: aksiSimpanOutletJadwal_, pengelola: true,
    pesan: 'Pengaturan outlet dan jadwal hanya bisa diubah Head Kitchen atau Manager.' },
  bacaPenerima: { jalankan: aksiBacaPenerima_, pengelola: true },
  simpanPenerima: { jalankan: aksiSimpanPenerima_, pengelola: true },
  formStock: { jalankan: aksiFormStock_ },
  kirimStock: { jalankan: aksiKirimStock_ },
  tandaiNihil: { jalankan: aksiTandaiNihil_ },
  sesuaikanStock: { jalankan: aksiSesuaikanStock_, pengelola: true },
  formWaste: { jalankan: aksiFormWaste_ },
  kirimWaste: { jalankan: aksiKirimWaste_ },
  formSuhu: { jalankan: aksiFormSuhu_ },
  kirimSuhu: { jalankan: aksiKirimSuhu_ },
  formPrep: { jalankan: aksiFormPrep_ },
  kirimPrep: { jalankan: aksiKirimPrep_ },
  daftarResep: { jalankan: aksiDaftarResep_, pengelola: true,
    pesan: 'Pengaturan resep hanya untuk Head Kitchen dan Manager.' },
  simpanResep: { jalankan: aksiSimpanResep_, pengelola: true,
    pesan: 'Resep hanya bisa diubah Head Kitchen atau Manager.' },
  aturResepAktif: { jalankan: aksiAturResepAktif_, pengelola: true,
    pesan: 'Resep hanya bisa diubah Head Kitchen atau Manager.' },
  aturItemAktif: { jalankan: aksiAturItemAktif_, pengelola: true,
    pesan: 'Item hanya bisa diubah Head Kitchen atau Manager.' },
  daftarItem: { jalankan: aksiDaftarItem_, pengelola: true,
    pesan: 'Pengaturan item hanya untuk Head Kitchen dan Manager.' },
  simpanItem: { jalankan: aksiSimpanItem_, pengelola: true,
    pesan: 'Item hanya bisa diubah Head Kitchen atau Manager.' },
  daftarKategoriSatuan: { jalankan: aksiDaftarKategoriSatuan_, pengelola: true,
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
  daftarUnit: { jalankan: aksiDaftarUnit_, pengelola: true,
    pesan: 'Pengaturan unit hanya untuk Head Kitchen dan Manager.' },
  simpanUnit: { jalankan: aksiSimpanUnit_, pengelola: true,
    pesan: 'Unit hanya bisa diubah Head Kitchen atau Manager.' },
  aturUnitAktif: { jalankan: aksiAturUnitAktif_, pengelola: true,
    pesan: 'Unit hanya bisa diubah Head Kitchen atau Manager.' },
  dashboard: { jalankan: aksiDashboard_, pengelola: true,
    pesan: 'Dashboard hanya untuk Head Kitchen dan Manager.' },
  riwayat: { jalankan: aksiRiwayat_ },
  detailKiriman: { jalankan: aksiDetailKiriman_ },
  riwayatItem: { jalankan: aksiRiwayatItem_ },
  laporkanKeliru: { jalankan: aksiLaporkanKeliru_ },
  tandaiDiperiksa: { jalankan: aksiTandaiDiperiksa_, pengelola: true,
    pesan: 'Tandai diperiksa hanya bisa dilakukan Head Kitchen atau Manager.' },
  bukaKunci: { jalankan: aksiBukaKunci_, pengelola: true,
    pesan: 'Buka kunci hanya bisa dilakukan Head Kitchen atau Manager.' },
  koreksi: { jalankan: aksiKoreksi_, pengelola: true,
    pesan: 'Koreksi hanya bisa dilakukan Head Kitchen atau Manager. Laporkan kekeliruan supaya Pengelola mengoreksinya.' },
  tutupLaporan: { jalankan: aksiTutupLaporan_, pengelola: true,
    pesan: 'Menutup laporan kekeliruan hanya bisa dilakukan Head Kitchen atau Manager.' },
  infoLaporan: { jalankan: aksiInfoLaporan_ },
  unduhPdf: { jalankan: aksiUnduhPdf_ },
  simpanPdfDrive: { jalankan: aksiSimpanPdfDrive_, pengelola: true,
    pesan: 'Simpan ulang ke Drive hanya bisa dilakukan Head Kitchen atau Manager.' },
  formOpname: { jalankan: aksiFormOpname_, pengelola: true,
    pesan: 'Stock opname hanya untuk Head Kitchen dan Manager.' },
  simpanOpname: { jalankan: aksiSimpanOpname_, pengelola: true,
    pesan: 'Stock opname hanya bisa disimpan Head Kitchen atau Manager.' },
  detailOpname: { jalankan: aksiDetailOpname_, pengelola: true,
    pesan: 'Rincian stock opname hanya untuk Head Kitchen dan Manager.' },
  unduhPdfOpname: { jalankan: aksiUnduhPdfOpname_, pengelola: true,
    pesan: 'Laporan selisih opname hanya untuk Head Kitchen dan Manager.' },
  daftarBelanja: { jalankan: aksiDaftarBelanja_, pengelola: true,
    pesan: 'Daftar belanja hanya untuk Head Kitchen dan Manager.' },
  unduhPdfBelanja: { jalankan: aksiUnduhPdfBelanja_, pengelola: true,
    pesan: 'Daftar belanja hanya untuk Head Kitchen dan Manager.' },
  formKustom: { jalankan: aksiFormKustom_ },
  kirimKustom: { jalankan: aksiKirimKustom_ },
  daftarForm: { jalankan: aksiDaftarForm_, pengelola: true,
    pesan: 'Pengaturan form hanya untuk Head Kitchen dan Manager.' },
  detailForm: { jalankan: aksiDetailForm_, pengelola: true,
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
    pesan: 'Form hanya bisa dipulihkan Head Kitchen atau Manager.' }
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
  SS_ = null;
  resetMemoForm_();
  try {
    var body = bacaBody_(e);
    var nama = typeof body.action === 'string' ? body.action : '';
    if (!nama || !Object.prototype.hasOwnProperty.call(AKSI_, nama)) {
      throw galatPengguna_('Aksi tidak dikenal. Muat ulang aplikasi, lalu coba lagi.');
    }
    var aksi = AKSI_[nama];
    var pengguna = null;
    if (!aksi.tanpaToken) {
      pengguna = periksaSesi_(body.token);
      if (aksi.pengelola && !pengguna.pengelola) {
        throw galatPengguna_(aksi.pesan || 'Menu ini hanya untuk Head Kitchen dan Manager.');
      }
    }
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
function ss_() {
  if (!SS_) SS_ = bukaSpreadsheet_();
  return SS_;
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
  var lastCol = sheet.getLastColumn();
  var judul = lastCol ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
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

/** Menjalankan fn di dalam kunci skrip, supaya dua permintaan tidak saling menimpa. */
function denganKunci_(fn) {
  var kunci = LockService.getScriptLock();
  if (!kunci.tryLock(15000)) {
    throw galatPengguna_('Server sedang sibuk. Coba lagi sebentar lagi.');
  }
  try {
    return fn();
  } finally {
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
  var lastCol = sheet.getLastColumn();
  var baris = lastCol ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
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
  var kol = posisiKolom_(sheet, KOLOM_STAFF);
  kol.dihapus = posisiKolomOpsional_(sheet, KOLOM_STAFF_DIHAPUS);
  var daftar = [];
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues().forEach(function (r, i) {
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
    var habis = !isi ||
      (kunci.indexOf(AWALAN_SESI) === 0 && !(kini < isi.s)) ||
      (kunci.indexOf(AWALAN_GAGAL_PIN) === 0 && isi.s && kini >= isi.s);
    if (habis) props.deleteProperty(kunci);
  });
}

/* ---------- Hitungan salah dan kunci 15 menit ---------- */

function kunciGagalPin_(nama) {
  return AWALAN_GAGAL_PIN + sha256Heks_(rapikanTeks_(nama).toLowerCase()).slice(0, 24);
}

/** { j: jumlah salah berturut-turut, s: terkunci sampai (ms, 0 = tidak) }. */
function bacaGagal_(props, kunci) {
  var g = bacaJson_(props.getProperty(kunci)) || { j: 0, s: 0 };
  if (g.s && Date.now() >= g.s) {
    props.deleteProperty(kunci);
    g = { j: 0, s: 0 };
  }
  return g;
}

function catatGagal_(props, kunci, g) {
  g.j += 1;
  if (g.j >= BATAS_SALAH) g.s = Date.now() + LAMA_KUNCI_MS;
  props.setProperty(kunci, JSON.stringify(g));
  return g;
}

function sisaMenit_(sampai) {
  return Math.max(1, Math.ceil((sampai - Date.now()) / 60000));
}

/* ---------- Konfigurasi dan outlet ---------- */

function bacaKonfigurasi_() {
  var sheet = ambilTab_('M_Konfigurasi');
  var nilai = {};
  var baris = {};
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, 2).getValues().forEach(function (r, i) {
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
  return zona || ss_().getSpreadsheetTimeZone() || Session.getScriptTimeZone();
}

/** Zona waktu IANA dari perangkat, misalnya "Asia/Jakarta". */
function zonaSah_(zona) {
  return typeof zona === 'string' && zona.length <= 64 &&
    /^[A-Za-z]+(\/[A-Za-z0-9_+\-]+){0,2}$/.test(zona);
}

function namaOutlet_() {
  var sheet = ambilTab_('M_Outlet');
  return rapikanTeks_(sheet.getRange(2, posisiKolom_(sheet, { nama: 'Nama Outlet' }).nama).getValue());
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
  M_Kategori: 'Nama Kategori',
  M_Unit: 'Nama Unit'
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
    return {
      nama: s.nama,
      role: s.role,
      pengelola: apakahPengelola_(s.role),
      aktif: s.aktif,
      punyaPin: !!s.hash,
      permintaanReset: s.reset ? s.reset.toISOString() : null,
      terkunci: !!bacaGagal_(props, kunciGagalPin_(s.nama)).s
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
  return denganKunci_(function () {
    var staff = cariStaff_(bacaStaff_().daftar, nama);
    if (!staff || !staff.aktif || !staff.hash) {
      throw galatPengguna_('Nama ' + nama + ' tidak bisa masuk. Muat ulang layar Login, atau minta Head Kitchen atau Manager memeriksa akunnya.');
    }
    var props = PropertiesService.getScriptProperties();
    var kunci = kunciGagalPin_(staff.nama);
    var g = bacaGagal_(props, kunci);
    if (g.s) {
      throw galatPengguna_('Terkunci. Coba lagi dalam ' + sisaMenit_(g.s) +
        ' menit, atau minta Head Kitchen atau Manager mereset PIN.');
    }
    if (cocokPin_(pin, staff.hash)) {
      props.deleteProperty(kunci);
      return buatSesi_(staff);
    }
    g = catatGagal_(props, kunci, g);
    if (g.s) throw galatPengguna_('Terkunci 15 menit. Minta Head Kitchen atau Manager mereset PIN.');
    throw galatPengguna_('PIN salah. Sisa ' + (BATAS_SALAH - g.j) + ' percobaan.');
  });
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
  var pin = periksaFormatPin_(body.pin);
  if (!rapikanKode_(body.kode)) throw galatPengguna_('Isi Kode Pemasangan.');
  var zona = zonaSah_(body.zonaWaktu) ? body.zonaWaktu : '';

  return denganKunci_(function () {
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
      } catch (err) {
        console.error('Zona waktu spreadsheet tidak bisa diubah: ' + err);
      }
    }
    hanguskanKodePemasangan_();
    return buatSesi_(staff);
  });
}

/** Pulihkan akses Pengelola: Kode Pemasangan baru + PIN baru untuk seorang Pengelola. */
function aksiPulihkan_(body) {
  var nama = rapikanTeks_(body.nama);
  if (!nama) throw galatPengguna_('Pilih nama Head Kitchen atau Manager.');
  var pin = periksaFormatPin_(body.pin);
  if (!rapikanKode_(body.kode)) throw galatPengguna_('Isi Kode Pemasangan.');

  return denganKunci_(function () {
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
  var hasil = {
    pengguna: pengguna,
    namaOutlet: namaOutlet_(),
    tanggal: tanggal,
    form: kelengkapanForm_(tanggal),
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
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues().forEach(function (r, i) {
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
  if (!f.aktif || f.diarsipkan) return false;
  if (f.jenis !== 'kustom') return true;
  if (f.jadwal === 'sewaktu-waktu') return false;
  if (f.jadwal === 'hari tertentu') return f.hari.indexOf(namaHari_(tanggal)) >= 0;
  return true;
}

/**
 * Status tiap form yang tampil (Aktif) pada satu tanggal, menurut aturan
 * kelengkapan Bagian 5.8.
 * wajib  : punya ruas di rel kemajuan (form bawaan, atau form kustom yang
 *          dijadwalkan pada tanggal itu; Tahap 9).
 * status : belum | sebagian (Suhu) | terkirim | nihil.
 */
function kelengkapanForm_(tanggal) {
  var zonaSheet = ss_().getSpreadsheetTimeZone();
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
  var kol = posisiKolom_(sheet, { nama: 'Nama Unit', aktif: 'Aktif' });
  if (sheet.getLastRow() >= 2) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues().forEach(function (r) {
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
  if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 1) return [];
  var lebar = sheet.getLastColumn();
  var judul = sheet.getRange(1, 1, 1, lebar).getValues()[0].map(function (j) { return String(j).trim(); });
  var iTanggal = judul.indexOf('Tanggal');
  if (iTanggal < 0) return [];
  var iOleh = judul.indexOf('submitted_by');
  var iWaktu = judul.indexOf('timestamp_server');
  var hasil = [];
  sheet.getRange(2, 1, sheet.getLastRow() - 1, lebar).getValues().forEach(function (r) {
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
  var pin = periksaFormatPin_(body.pin);
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
 * gugur, kunci 15 menit dibuka, dan permintaan reset ditandai selesai.
 */
function aksiAturPin_(body, pengguna) {
  var pin = periksaFormatPin_(body.pin);
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
  return tanggal;
}

/** Tanggal untuk sel Sheet (tengah malam menurut zona waktu spreadsheet). */
function tanggalSel_(tanggal) {
  return Utilities.parseDate(tanggal, ss_().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
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
  var lebar = sheet.getLastColumn();
  var tinggi = sheet.getLastRow();
  var semua = lebar && tinggi ? sheet.getRange(1, 1, tinggi, lebar).getValues() : [[]];
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

/** M_Item: { namaKecil: { nama, kategori, satuan, satuanBesar, isiSatuanBesar, harga, stokMin, stokMaks, aktif } }. */
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
      aktif: benar_(nilai_(t, b, 'Aktif'))
    };
  });
  return peta;
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
  var zona = ss_().getSpreadsheetTimeZone();
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
  var zona = ss_().getSpreadsheetTimeZone();
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
  var zona = ss_().getSpreadsheetTimeZone();
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
      stokMin: m.stokMin
    }, posisiStock_(rekap.item[k], tanggal)));
  });
  item.sort(function (a, b) { return a.nama.localeCompare(b.nama, 'id'); });

  var kiriman = bacaBarisTanggal_('Data_Stock', tanggal, zona, ['submission_id']);
  var sid = {};
  kiriman.forEach(function (b) { sid[b.submission_id] = true; });
  var nihil = bacaBarisTanggal_('Data_Nihil', tanggal, zona, ['ID Form']).filter(function (n) {
    return rapikanTeks_(n['ID Form']).toUpperCase() === 'STOCK';
  });
  return {
    tanggal: tanggal,
    kategori: kategori.filter(function (k) { return dipakai[k.nama]; }).map(function (k) { return k.nama; }),
    item: item,
    kiriman: { jumlah: Object.keys(sid).length, terakhir: barisTerakhir_(kiriman) },
    nihil: kiriman.length ? null : barisTerakhir_(nihil)
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
    var baru = [];
    masukan.forEach(function (b) {
      var m = master[rapikanTeks_(b && b.item).toLowerCase()];
      if (!m) throw galatPengguna_('Item ' + rapikanTeks_(b && b.item) + ' tidak ada di daftar item. Muat ulang form.');
      var masuk = angkaIsian_(b.masuk, 'Tambah masuk ' + m.nama);
      var keluar = angkaIsian_(b.keluar, 'Tambah keluar ' + m.nama);
      if (!masuk && !keluar) return; // item yang kedua kolomnya kosong tidak ikut terkirim
      var diketik = '';
      if (b.satuanMasuk === 'besar' && masuk) {
        if (!m.satuanBesar) throw galatPengguna_(m.nama + ' tidak punya satuan besar. Isi Tambah masuk dalam ' + m.satuan + '.');
        diketik = teksAngka_(masuk) + ' ' + m.satuanBesar;
        masuk = bulat_(masuk * m.isiSatuanBesar);
      }
      baru.push(gabung_({
        'Tanggal': tanggalSel_(tanggal),
        'Kategori': m.kategori,
        'Nama Item': m.nama,
        'Stock Masuk': masuk,
        'Stock Keluar': keluar,
        'Satuan': m.satuan,
        'Masuk Diketik': diketik
      }, isiSistem_(konteks)));
    });
    if (!baru.length) throw galatPengguna_('Isi Tambah masuk atau Tambah keluar minimal untuk satu item.');

    tambahBarisTabel_(tabel, baru);
    urutkanTabel_(tabel, URUTAN_DATA);
    hitungUlangStock_(baru.map(function (b) { return { item: b['Nama Item'], dari: tanggal }; }));
    return { sudahTerkirim: false, jumlah: baru.length, form: dataFormStock_(tanggal) };
  });
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
    var zona = ss_().getSpreadsheetTimeZone();
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
    tambahBarisTabel_(tabel, [gabung_({
      'Tanggal': tanggalSel_(tanggal),
      'Kategori': m.kategori,
      'Nama Item': m.nama,
      'Stock Tercatat': tercatat,
      'Stock Sebenarnya': sebenarnya,
      'Selisih': selisih,
      'Satuan': m.satuan,
      'Nilai Selisih (Rp)': m.harga == null ? '' : Math.round(selisih * m.harga),
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
 * Data layar isi Waste: item aktif (satuan dan harga dari M_Item; harga
 * barang jadi yang kosong dari resepnya), pilihan
 * kategori waste dan shift, waste yang sudah tercatat pada tanggal itu, dan
 * tanda nihil.
 */
function dataFormWaste_(tanggal) {
  var zona = ss_().getSpreadsheetTimeZone();
  // Harga barang jadi yang kosong dihitung dari resepnya (Bagian 5.3, Tahap 6).
  var master = lengkapiHargaResep_(bacaItem_());
  var item = Object.keys(master).filter(function (k) { return master[k].aktif; }).map(function (k) {
    var m = master[k];
    return { nama: m.nama, kategori: m.kategori, satuan: m.satuan, harga: m.harga };
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
      estimasi: rp,
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
    item: item,
    kiriman: { jumlah: Object.keys(sid).length, terakhir: barisTerakhir_(kiriman), totalRp: Math.round(total), baris: baris },
    nihil: kiriman.length ? null : barisTerakhir_(nihil)
  };
}

function aksiFormWaste_(body) {
  if (!tanggalSah_(body.tanggal)) throw galatPengguna_('Tanggal tidak terbaca. Pilih tanggal lagi.');
  return dataFormWaste_(body.tanggal);
}

/**
 * Kiriman form Waste: satu baris Data_Waste per item. Satuan dan Harga Satuan
 * disalin dari M_Item saat dicatat; Estimasi Kerugian dihitung server. Waste
 * langsung mengurangi stock: rekap Stock_Harian item itu pada tanggal itu
 * (dibuat jika belum ada) dan semua rekap sesudahnya dihitung ulang.
 */
function aksiKirimWaste_(body, pengguna) {
  var tanggal = periksaTanggalIsian_(body.tanggal, pengguna);
  var konteks = konteksKiriman_(body, pengguna);
  var shift = String(body.shift || '');
  if (SHIFT.indexOf(shift) < 0) throw galatPengguna_('Pilih shift: Pagi, Siang, atau Malam.');
  var masukan = Array.isArray(body.baris) ? body.baris : [];
  if (masukan.length > 200) throw galatPengguna_('Isian terlalu banyak untuk satu kiriman.');

  return denganKunci_(function () {
    var tabel = wajibTabel_('Data_Waste');
    if (adaSubmission_(tabel, konteks.sid)) {
      return { sudahTerkirim: true, jumlah: 0, form: dataFormWaste_(tanggal) };
    }
    var master = lengkapiHargaResep_(bacaItem_());
    var baru = masukan.map(function (b) {
      var m = master[rapikanTeks_(b && b.item).toLowerCase()];
      if (!m) throw galatPengguna_('Item ' + rapikanTeks_(b && b.item) + ' tidak ada di daftar item. Muat ulang form.');
      var qty = angkaIsian_(b.qty, 'Qty ' + m.nama);
      if (!qty) throw galatPengguna_('Isi Qty ' + m.nama + ' lebih dari 0.');
      var kategori = String(b.kategori || '');
      var alasan = rapikanTeks_(b.alasan).slice(0, 200);
      periksaBarisWaste_(kategori, alasan, m.nama);
      return gabung_({
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
    });
    if (!baru.length) throw galatPengguna_('Tambah minimal satu item waste.');

    tambahBarisTabel_(tabel, baru);
    urutkanTabel_(tabel, URUTAN_WASTE);
    hitungUlangStock_(baru.map(function (b) { return { item: b['Item / Produk'], dari: tanggal }; }));
    return { sudahTerkirim: false, jumlah: baru.length, form: dataFormWaste_(tanggal) };
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
  var zona = ss_().getSpreadsheetTimeZone();
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
      bacaBarisTanggal_('Data_Suhu', tanggal, ss_().getSpreadsheetTimeZone(), ['Nama Unit', 'Waktu Cek']).forEach(function (b) {
        if (rapikanTeks_(b['Waktu Cek']).toLowerCase() === waktu.toLowerCase()) sudah[rapikanTeks_(b['Nama Unit']).toLowerCase()] = b;
      });
    }
    var dalamKiriman = {};
    var luar = 0;
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
    urutkanTabel_(tabel, [['Tanggal', false], ['Nama Unit', true], ['timestamp_server', true]]);
    return { sudahTerkirim: false, jumlah: baru.length, luarStandar: luar, form: dataFormSuhu_(tanggal) };
  });
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
  var master = lengkapiHargaResep_(bacaItem_(), resep);
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
  var zona = ss_().getSpreadsheetTimeZone();
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
    ['submission_id', 'Item / Menu Prep', 'Jumlah Resep', 'Hasil', 'Qty', 'Satuan', 'Baik Sampai']);
  var sid = {};
  var baris = kiriman.map(function (b) {
    sid[b.submission_id] = true;
    return {
      item: rapikanTeks_(b['Item / Menu Prep']),
      jumlahResep: angkaAtauNull_(b['Jumlah Resep']),
      hasil: angkaAtauNull_(b['Hasil']),
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
    nihil: kiriman.length ? null : barisTerakhir_(nihil)
  };
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
        isi['Hasil'] = bulat_(jr * r.hasil);
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
 * Masa simpan barang jadi (Bagian 5.3). Sistem tidak melacak wadah: yang
 * dibuat lebih dulu dianggap dipakai lebih dulu, jadi stock tersisa pada
 * tanggal itu dianggap berasal dari prep paling baru. Bagian stock yang
 * berasal dari prep dengan Baik Sampai sebelum tanggal itu masuk "Lewat masa
 * simpan"; yang Baik Sampai-nya tanggal itu (besok sudah tidak baik) masuk
 * "Habis besok". Prep tanpa Baik Sampai (resep tanpa masa simpan) ikut
 * dihitung sebagai stock tersisa. Per item satu baris: { item, satuan, qty,
 * baikSampai } (baikSampai: yang terbaru di antara bagian itu).
 */
function masaSimpan_(tanggal) {
  var hasil = { lewat: [], habisBesok: [] };
  var t = bacaTabel_('Data_Prep');
  if (!t || t.kol['Baik Sampai'] === undefined) return hasil;
  var zona = ss_().getSpreadsheetTimeZone();
  var perItem = {};
  var adaMasa = {};
  t.baris.forEach(function (b) {
    var tg = teksTanggal_(nilai_(t, b, 'Tanggal'), zona);
    var jumlah = Number(nilai_(t, b, 'Hasil')) || 0;
    var nama = rapikanTeks_(nilai_(t, b, 'Item / Menu Prep'));
    if (!tg || tg > tanggal || jumlah <= 0 || !nama) return;
    var k = nama.toLowerCase();
    var bs = teksTanggal_(nilai_(t, b, 'Baik Sampai'), zona);
    if (bs) adaMasa[k] = true;
    var w = nilai_(t, b, 'timestamp_server');
    (perItem[k] = perItem[k] || []).push({ tanggal: tg, waktu: w instanceof Date ? w.getTime() : 0, hasil: jumlah, baikSampai: bs,
      nama: nama, satuan: rapikanTeks_(nilai_(t, b, 'Satuan')) });
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
  var dipakai = {};
  var diResep = {};
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
    return {
      nama: m.nama,
      kategori: m.kategori,
      satuan: m.satuan,
      satuanBesar: m.satuanBesar,
      isiSatuanBesar: m.isiSatuanBesar,
      harga: m.harga,
      stokMin: m.stokMin,
      stokMaks: m.stokMaks,
      aktif: m.aktif,
      stock: posisiStock_(rekap.item[k], hari).akhir,
      punyaCatatan: !!catatan[k],
      bisaGantiNama: !catatan[k] && !diResep[k],
      resepAktif: !!(resep[k] && resep[k].aktif),
      dipakaiResep: (dipakai[k] || []).sort(function (a, b) { return a.localeCompare(b, 'id'); })
    };
  }).sort(function (a, b) { return a.nama.localeCompare(b.nama, 'id'); });
  return {
    hariIni: hari,
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
 */
function aksiSimpanItem_(body) {
  var nama = periksaNama_(body.nama, 'Nama item', PANJANG_ITEM_MAKS);
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
      if (catatan || diResep) {
        throw galatPengguna_('Nama ' + lama.nama + ' tidak bisa diganti karena item ini sudah ' +
          (catatan ? 'punya catatan stock' : 'dipakai resep') + '. Catatan lama menyimpan nama ini.');
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
    var nilai = {
      'Nama Item': nama,
      'Kategori': kategori,
      'Satuan': satuan,
      'Satuan Besar': besar,
      'Isi per Satuan Besar': besar ? isi : '',
      'Harga Satuan (Rp)': harga == null ? '' : harga,
      'Stok Minimum': stokMin == null ? '' : stokMin,
      'Stok Maksimum': stokMaks == null ? '' : stokMaks
    };
    if (lama) {
      tulisBarisMaster_(t, barisMaster_(t, 'Nama Item', lama.nama), nilai);
    } else {
      nilai['Aktif'] = true;
      tambahBarisMaster_('M_Item', nilai);
    }
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
    }
    tulisBarisMaster_(t, nomor, { 'Aktif': aktif });
    var data = dataItem_();
    data.diubah = { nama: nama, aktif: aktif };
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

/* ---------- Pengaturan → Outlet dan jadwal ---------- */

/** "21:30" dari teks jj:mm atau jj.mm (atau nilai waktu Sheet); '' jika tidak sah. */
function jamSah_(nilai) {
  if (nilai instanceof Date && !isNaN(nilai.getTime())) {
    return Utilities.formatDate(nilai, ss_().getSpreadsheetTimeZone(), 'HH:mm');
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
    var jadwalBerubah = berubah('zonaWaktu') || berubah('jamClosing') || berubah('jedaLaporanMenit') || berubah('hariCadangan');
    if (jadwalBerubah) {
      tulisKonfigurasi_('pasang_trigger', 'Perlu dijalankan: jadwal diubah ' + waktuSekarangId_() + ' oleh ' + pengguna.nama + '.',
        KETERANGAN_PASANG_TRIGGER);
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
 * Nilai stock (Bagian 8.5): Stock Akhir pada tanggal itu × Harga Satuan yang
 * berlaku sekarang di M_Item. Yang dihitung: item aktif, dan item nonaktif yang
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
    if (m.harga == null) {
      tanpa.push({ nama: m.nama, kategori: kat, satuan: m.satuan, stock: akhir, aktif: m.aktif });
      return;
    }
    var nilai = akhir * m.harga;
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
    tambah('lewatMasaSimpan', 'masalah', d.masaSimpan.lewat.length + ' barang jadi lewat masa simpan',
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
  if (d.stock.belanja.length) {
    tambah('bawahMinimum', 'tinjau', d.stock.belanja.length + ' item di bawah stok minimum',
      daftarNamaSingkat_(d.stock.belanja.map(function (x) { return x.m.nama; })) + '.',
      { item: d.stock.belanja.map(function (x) { return { nama: x.m.nama, stock: x.akhir, satuan: x.m.satuan, stokMin: x.m.stokMin, saran: x.saran }; }) });
  }
  if (d.masaSimpan.habisBesok.length) {
    tambah('habisBesok', 'tinjau', d.masaSimpan.habisBesok.length + ' barang jadi habis besok',
      daftarNamaSingkat_(d.masaSimpan.habisBesok.map(function (x) { return x.item; })) + '.', { habisBesok: d.masaSimpan.habisBesok });
  }
  d.peringatan.forEach(function (p) {
    if (/^Jadwal:/.test(p)) tambah('jadwal', 'tinjau', 'Jadwal belum dipasang ulang', p.replace(/^Jadwal:\s*/, ''));
  });
  if (d.opname && d.opname.lewat) {
    tambah('opname', 'tinjau', teksPengingatOpname_(d.opname).replace(/\.$/, ''), 'Jadwal ' + d.opname.jadwal + '. Hitung barang nyata ' +
      'sebelum opening atau setelah closing.');
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
  var zona = ss_().getSpreadsheetTimeZone();
  var master = bacaItem_();
  var rekap = bacaRekap_();
  var form = kelengkapanForm_(tanggal);
  var wajib = form.filter(function (f) { return f.wajib; });
  var d = {
    form: form,
    stock: ringkasStockHari_(tanggal, master, rekap),
    nilai: nilaiStock_(master, rekap, tanggal),
    waste: grafikWaste_(tanggal, zona),
    suhu: grafikSuhu_(tanggal, zona),
    masaSimpan: masaSimpan_(tanggal),
    pemeriksaan: ringkasPemeriksaan_(),
    reset: bacaStaff_().daftar.filter(function (s) { return s.aktif && s.reset; }).sort(function (a, b) {
      return a.reset.getTime() - b.reset.getTime();
    }),
    peringatan: peringatanSistem_(),
    opname: statusOpname_()
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
    nilaiStock: d.nilai,
    perhatian: perhatianDashboard_(d),
    grafikWaste: d.waste,
    grafikSuhu: d.suhu,
    opname: d.opname,
    alamatSheet: alamatDashboardSheet_()
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
    var zona = ss_().getSpreadsheetTimeZone();
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
    item.push({ nama: m.nama, kategori: kat.nama, satuan: m.satuan, harga: m.harga,
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
  var zona = ss_().getSpreadsheetTimeZone();
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
 * selisih × Harga Satuan di M_Item (kosong jika harga kosong). Opname yang
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
      var nilai = m.harga == null ? '' : Math.round(selisih * m.harga);
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
    'Nilai selisih = selisih × harga satuan saat opname.' + (o.tanpaHarga ? ' ' + o.tanpaHarga + ' item berselisih belum punya harga (–), tidak ikut total.' : '')];
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

/**
 * Daftar belanja hari ini: item aktif yang Stock Akhir-nya di bawah Stok
 * Minimum, dikelompokkan per kategori (urutan M_Kategori), dengan saran order.
 * { tanggal, jumlah, kategori: [{ nama, item: [{ nama, satuan, satuanBesar,
 * isiSatuanBesar, stock, stokMin, stokMaks, saran: { jumlah, satuan, dasar, teks } | null }] }] }.
 */
function dataBelanja_() {
  var hari = hariIni_();
  var stock = ringkasStockHari_(hari);
  var urut = {};
  bacaSemuaKategori_().forEach(function (k, i) { urut[k.nama.toLowerCase()] = { i: i, nama: k.nama }; });
  var grup = {};
  stock.belanja.forEach(function (x) {
    var m = x.m;
    var u = urut[m.kategori.toLowerCase()];
    var nama = u ? u.nama : (m.kategori || 'Tanpa kategori');
    var g = grup[nama.toLowerCase()] = grup[nama.toLowerCase()] || { nama: nama, i: u ? u.i : 1e6, item: [] };
    var s = saranOrderAngka_(m, x.akhir);
    g.item.push({
      nama: m.nama, satuan: m.satuan, satuanBesar: m.satuanBesar, isiSatuanBesar: m.isiSatuanBesar,
      stock: x.akhir, stokMin: m.stokMin, stokMaks: m.stokMaks,
      saran: s ? { jumlah: s.jumlah, satuan: s.satuan, dasar: s.dasar, teks: teksOrder_(m, s.jumlah) } : null
    });
  });
  var kategori = Object.keys(grup).map(function (k) { return grup[k]; }).sort(function (a, b) {
    return a.i - b.i || a.nama.localeCompare(b.nama, 'id');
  });
  kategori.forEach(function (g) {
    delete g.i;
    g.item.sort(function (a, b) { return a.nama.localeCompare(b.nama, 'id'); });
  });
  return { tanggal: hari, jumlah: stock.belanja.length, kategori: kategori };
}

function aksiDaftarBelanja_() {
  return dataBelanja_();
}

/**
 * PDF daftar belanja (Bagian 9.2). body.order: { namaItem: teks } berisi
 * jumlah order yang diubah Pengelola di layar (dalam satuan order: satuan
 * besar jika ada); hanya untuk cetakan, tidak disimpan. Item yang tidak ada di
 * body.order memakai saran; teks kosong dicetak "–".
 */
function aksiUnduhPdfBelanja_(body, pengguna) {
  var d = dataBelanja_();
  if (!d.jumlah) throw galatPengguna_('Semua stock di atas batas minimum. Tidak ada daftar belanja untuk dicetak.');
  var order = body.order && typeof body.order === 'object' && !Array.isArray(body.order) ? body.order : {};
  var orderKecil = {};
  Object.keys(order).forEach(function (k) { orderKecil[rapikanTeks_(k).toLowerCase()] = order[k]; });
  var master = bacaItem_();
  var diubah = 0;
  var tabel = '<table class="data"><tr><th style="width:6%">No</th><th style="width:36%">Nama Item</th>' +
    '<th style="width:16%">Stock Sekarang</th><th style="width:16%">Stok Minimum</th><th style="width:26%">Order</th></tr>';
  d.kategori.forEach(function (g) {
    tabel += '<tr class="kategori"><td colspan="5">' + escHtml_(g.nama) + '</td></tr>';
    g.item.forEach(function (it, i) {
      var kecil = it.nama.toLowerCase();
      var teks = it.saran ? it.saran.teks : '–';
      if (Object.prototype.hasOwnProperty.call(orderKecil, kecil)) {
        var v = String(orderKecil[kecil] == null ? '' : orderKecil[kecil]).trim();
        var asli = it.saran ? String(it.saran.jumlah) : '';
        if (v === '') teks = '–';
        else {
          var n = angkaIsian_(v, 'Order ' + it.nama);
          teks = teksOrder_(master[kecil] || it, n);
        }
        if (v.replace(',', '.') !== asli) diubah++;
      }
      tabel += '<tr><td class="angka">' + (i + 1) + '</td><td>' + escHtml_(it.nama) + '</td>' +
        '<td class="angka' + (it.stock < 0 ? ' masalah' : '') + '">' + angkaId_(it.stock) + ' ' + escHtml_(it.satuan) + '</td>' +
        '<td class="angka">' + angkaId_(it.stokMin) + ' ' + escHtml_(it.satuan) + '</td>' +
        '<td class="akhir">' + escHtml_(teks) + '</td></tr>';
    });
  });
  tabel += '</table>';
  var catatan = ['Saran order = stok maksimum dikurangi stock akhir, dibulatkan ke atas ke satuan besar jika item punya. ' +
    'Item tanpa stok maksimum tidak diberi saran (–).'];
  if (diubah) catatan.push(diubah + ' jumlah order diubah sebelum dicetak. Perubahan itu hanya untuk cetakan ini.');
  catatan.push('Daftar ini hanya saran. Aplikasi tidak memesan apa pun.');
  var html = htmlLaporan_('', d.tanggal, {
    judul: 'Daftar Belanja',
    info: [['Item di bawah stok minimum', String(d.jumlah)]],
    tabel: tabel,
    catatan: catatan,
    bawah: [['Dicetak oleh', pengguna.nama + ', ' + waktuPendekId_(new Date())]]
  });
  var namaFile = d.tanggal + '_Daftar_belanja.pdf';
  var blob = Utilities.newBlob(html, 'text/html', namaFile + '.html').getAs('application/pdf').setName(namaFile);
  return { namaFile: namaFile, mime: 'application/pdf', data: Utilities.base64Encode(blob.getBytes()) };
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
  if (c.jenis === 'Jam' && v instanceof Date) return Utilities.formatDate(v, ss_().getSpreadsheetTimeZone(), 'HH:mm');
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
  var zona = ss_().getSpreadsheetTimeZone();
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
    wajib: wajibPada_(f, tanggal)
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
    kepala: [{ judul: 'Kategori', kunci: 'kategori', label: 'Kategori' }],
    kolom: [
      { judul: 'Nama Item', kunci: 'item', label: 'Nama Item', jenis: 'item' },
      { judul: 'Stock Masuk', kunci: 'masuk', label: 'Stock Masuk', singkat: 'masuk', jenis: 'angka', koreksi: true, satuan: true, asli: 'Masuk Diketik' },
      { judul: 'Stock Keluar', kunci: 'keluar', label: 'Stock Keluar', singkat: 'keluar', jenis: 'angka', koreksi: true, satuan: true }
    ],
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
      { judul: 'Qty', kunci: 'qty', label: 'Qty', singkat: 'qty', jenis: 'angka', koreksi: true, satuan: true, jikaAda: true },
      { judul: 'Baik Sampai', kunci: 'baikSampai', label: 'Baik sampai', singkat: 'baik sampai', jenis: 'tanggal' },
      { judul: 'Keterangan', kunci: 'keterangan', label: 'Keterangan', singkat: 'ket', jenis: 'teks', koreksi: true }
    ],
    satuan: 'Satuan',
    item: 'Item / Menu Prep',
    kategoriDariItem: true,
    gerakStock: true,
    rincian: rincianPrep_,
    // Hasil = Jumlah Resep × Hasil per 1 Resep yang tercatat di baris itu (resep saat prep dibuat).
    turunan: function (n) {
      var per1 = n['Hasil per 1 Resep'];
      if (per1 === '' || per1 == null) return {};
      return { 'Hasil': bulat_((Number(n['Jumlah Resep']) || 0) * Number(per1)) };
    },
    periksaKoreksi: function (n) {
      var nama = rapikanTeks_(n['Item / Menu Prep']);
      var beresep = n['Hasil per 1 Resep'] !== '' && n['Hasil per 1 Resep'] != null;
      if (beresep && Number(n['Qty'])) throw galatPengguna_(nama + ' dibuat dengan resep. Koreksi jumlah resepnya, bukan Qty.');
      if (!beresep && Number(n['Jumlah Resep'])) throw galatPengguna_(nama + ' dicatat tanpa resep. Koreksi Qty-nya.');
    },
    setelahKoreksi: setelahKoreksiPrep_
  }
};

/** Definisi Riwayat satu form, atau null jika Riwayat form itu belum dibangun. */
function defRiwayat_(idForm) {
  var id = rapikanTeks_(idForm).toUpperCase();
  return RIWAYAT_FORM[id] || (id ? defRiwayatKustom_(id) : null);
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
    nilai[k.kunci] = angka ? angkaAtauNull_(v) : (k.jenis === 'tanggal' ? teksTanggal_(v, ss_().getSpreadsheetTimeZone()) : rapikanTeks_(v));
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
  return {
    rowId: rowId,
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
  var zona = ss_().getSpreadsheetTimeZone();
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
  return susunKiriman_(def, t, pilih, bacaLogKoreksi_(def.tab), ss_().getSpreadsheetTimeZone())[0];
}

/**
 * Tanda nihil, penyesuaian stock, dan stock opname pada rentang tanggal
 * (Bagian 6.1: tampil pada tanggalnya). Penyesuaian dan opname hanya untuk
 * Riwayat Stock.
 */
function peristiwaRiwayat_(form, def, r, f) {
  var zona = ss_().getSpreadsheetTimeZone();
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
  var zona = ss_().getSpreadsheetTimeZone();
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
  var zona = ss_().getSpreadsheetTimeZone();
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
    pilihan: pilihanFilter_(def)
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
    rekap: tujuh.map(function (r) { return barisRekap_(r, master, asli); })
  };
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
      ubah[k.judul] = nilaiBaru;
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
    Object.keys(ubah).forEach(function (j) { gabungan[j] = ubah[j]; });
    if (def.turunan) {
      var turun = def.turunan(gabungan);
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
        tanggal: teksTanggal_(nilai_(c.t, c.b, 'Tanggal'), ss_().getSpreadsheetTimeZone()),
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
  var zona = ss_().getSpreadsheetTimeZone();
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
  var kiriman = bacaBarisTanggal_('Data_Stock', tanggal, ss_().getSpreadsheetTimeZone(), ['Kategori']);
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
  var zona = ss_().getSpreadsheetTimeZone();
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
      '<td>' + escHtml_(b['Item / Produk']) + '</td>' +
      '<td>' + escHtml_(b['Kategori Waste']) + '</td>' +
      '<td class="angka">' + angkaId_(Number(b['Qty']) || 0) + '</td>' +
      '<td>' + escHtml_(b['Satuan']) + '</td>' +
      '<td>' + escHtml_(b['Alasan / Keterangan']) + '</td>' +
      '<td class="angka">' + rupiahId_(rp) + '</td>' +
      '</tr>';
  });
  var judul = ['No', 'Nama Staff', 'Shift', 'Item / Produk', 'Kategori Waste', 'Qty', 'Satuan', 'Alasan',
    'Estimasi Kerugian (Rp)'];
  var tabel = '<table class="data"><colgroup><col style="width:4%"><col style="width:11%"><col style="width:7%">' +
    '<col style="width:17%"><col style="width:12%"><col style="width:8%"><col style="width:7%"><col style="width:20%">' +
    '<col style="width:14%"></colgroup><thead><tr>' +
    judul.map(function (j) { return '<th>' + j + '</th>'; }).join('') + '</tr></thead><tbody>' +
    (isi.length ? isi.join('') : '<tr><td colspan="9">Belum ada isian.</td></tr>') +
    '<tr class="total"><td colspan="8">Total estimasi kerugian</td><td class="angka">' + rupiahId_(total) + '</td></tr>' +
    '</tbody></table>';
  var catatan = ['Estimasi kerugian = Qty × Harga Satuan yang tercatat saat waste dicatat.'];
  if (adaTanpaHarga) catatan.push('Item tanpa harga satuan ditulis "–" dan tidak ikut dijumlahkan.');
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
  var zona = ss_().getSpreadsheetTimeZone();
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
      '<td class="angka">' + angkaId_(Number(beresep ? b['Hasil'] : b['Qty']) || 0) + '</td>' +
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
    catatan: ['Hasil = Jumlah Resep × Hasil per 1 Resep. Item tanpa resep ditulis dengan Qty dan tidak menggerakkan stock.',
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
    var info = [['Nama Outlet', outlet], ['Tanggal', tanggalPanjangId_(tanggal)]].concat(b.info || []);
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
  var akar = cariAtauBuatFolder_(DriveApp.getRootFolder(), FOLDER_LAPORAN);
  var outlet = cariAtauBuatFolder_(akar, (namaOutlet_() || 'Outlet').replace(/[\\/]+/g, '-'));
  var tahun = cariAtauBuatFolder_(outlet, p[0]);
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

/** Untuk Beranda Pengelola: email laporan atau cadangan terakhir yang gagal. */
function peringatanSistem_() {
  var nilai = bacaKonfigurasi_().nilai;
  var hasil = [];
  var lap = String(nilai.laporan_terakhir || '');
  var cad = String(nilai.cadangan_terakhir || '');
  if (/^Gagal/.test(lap)) hasil.push('Laporan harian: ' + lap);
  if (/^Gagal/.test(cad)) hasil.push('Cadangan mingguan: ' + cad);
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
  var zona = ss_().getSpreadsheetTimeZone();
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

function teksStatusForm_(f) {
  if (f.status === 'terkirim') {
    return 'Terkirim' + (f.detail ? ' (' + f.detail + ')' : '') +
      (f.terakhir ? ', terakhir ' + f.terakhir.oleh + ' ' + jamId_(new Date(f.terakhir.waktu)) : '');
  }
  if (f.status === 'nihil') return 'Nihil (ditandai ' + (f.terakhir ? f.terakhir.oleh : '') + ')';
  if (f.status === 'sebagian') return 'Belum lengkap: ' + f.detail;
  if (f.wajib) return 'Belum diisi';
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
      '<div style="color:#A9B8CF">' + escHtml_(tanggalPanjangId_(d.tanggal)) + '</div></div>';

  html += bagian('Form hari ini', daftar(d.form.map(function (f) {
    var belum = f.status === 'belum' || f.status === 'sebagian';
    var gaya = belum && f.wajib ? 'color:' + w.masalah + ';font-weight:bold' : '';
    return '<b>' + escHtml_(f.nama) + '</b>: <span style="' + gaya + '">' + escHtml_(teksStatusForm_(f)) + '</span>';
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
  html += bagian('Stock', stock.length ? stock.join('') : '<p style="margin:0">Tidak ada Stock Akhir minus dan semua stock di atas batas minimum.</p>');

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
    : '<p style="margin:0">Tidak ada barang jadi yang lewat masa simpan atau habis besok.</p>');

  var periksa = [];
  if (d.pemeriksaan.belumDiperiksa) periksa.push(d.pemeriksaan.belumDiperiksa + ' isian belum diperiksa (31 hari terakhir)');
  if (d.pemeriksaan.dilaporkan) periksa.push(d.pemeriksaan.dilaporkan + ' baris dilaporkan keliru');
  d.reset.forEach(function (n) { periksa.push(escHtml_(n) + ' meminta reset PIN'); });
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

    var konf = bacaKonfigurasi_().nilai;
    var cadangan = String(konf.cadangan_terakhir || '');
    var data = {
      outlet: namaOutlet_() || 'Outlet',
      tanggal: tanggal,
      form: form,
      stock: ringkasStockHari_(tanggal),
      waste: ringkasWasteHari_(tanggal),
      suhu: ringkasSuhuHari_(tanggal),
      prep: ringkasPrepHari_(tanggal),
      masaSimpan: masaSimpan_(tanggal),
      pemeriksaan: ringkasPemeriksaan_(),
      reset: bacaStaff_().daftar.filter(function (s) { return s.aktif && s.reset; }).map(function (s) { return s.nama; }),
      opname: statusOpname_(),
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
      'Diisi otomatis oleh laporan harian. Baris yang diawali "Gagal" juga tampil di Beranda Pengelola.');
  } catch (err) {
    console.error('Laporan harian gagal: ' + (err && err.stack ? err.stack : err));
    hasil.galat = err && err.message ? err.message : String(err);
    catatStatusSistem_('laporan_terakhir', 'Gagal ' + waktuSekarangId_() + ' untuk ' + tanggal + ': ' + hasil.galat,
      'Diisi otomatis oleh laporan harian. Baris yang diawali "Gagal" juga tampil di Beranda Pengelola.');
  }
  return hasil;
}

/**
 * Dijalankan trigger harian (dipasang pasangTrigger). Jika trigger terlambat
 * sampai lewat tengah malam, laporan tetap untuk hari kemarin.
 */
function kirimLaporanHarian() {
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
  SS_ = null;
  var ket = 'Diisi otomatis oleh cadangan mingguan. Baris yang diawali "Gagal" disebut di email harian dan Beranda Pengelola.';
  try {
    var ss = ss_();
    var akar = cariAtauBuatFolder_(DriveApp.getRootFolder(), FOLDER_LAPORAN);
    var folder = cariAtauBuatFolder_(akar, FOLDER_CADANGAN);
    var awalan = 'Cadangan ' + ss.getName() + ' ';
    var nama = awalan + Utilities.formatDate(new Date(), zonaWaktu_(), 'yyyy-MM-dd HHmm');
    DriveApp.getFileById(ss.getId()).makeCopy(nama, folder);
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
 * jeda dari M_Konfigurasi) dan trigger cadangan mingguan (hari_cadangan,
 * pukul 03.00), dalam zona waktu yang tersimpan.
 */
function pasangTrigger() {
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
  var jamTeks = ('0' + Math.floor(menit / 60)).slice(-2) + ':' + ('0' + (menit % 60)).slice(-2);
  console.log('Trigger terpasang (zona ' + zona + '): laporan harian sekitar ' + jamTeks +
    ' (toleransi Google sekitar 15 menit), cadangan tiap ' + konf.hari_cadangan + ' sekitar 03:00.');
  catatStatusSistem_('pasang_trigger', 'Terpasang ' + waktuSekarangId_() + ' (zona ' + zona + '): laporan harian sekitar ' +
    jamTeks + ', cadangan tiap ' + konf.hari_cadangan + ' sekitar 03:00.', KETERANGAN_PASANG_TRIGGER);
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
      k_('Masuk Diketik')
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
      k_('Qty', 'angka'), k_('Satuan'), k_('Baik Sampai', 'tanggal'), k_('Keterangan')
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
      k_('Aktif', null, { centang: true })
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
    ['keluar_otomatis_menit', String(KELUAR_OTOMATIS_AWAL), KETERANGAN_KELUAR_OTOMATIS]
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
    GAYA_RUMUS_ = deteksiGayaRumus_(ss, catatan);

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

    // Tahap 9: tab data tiap form kustom (juga yang diarsipkan) dibuat atau dilengkapi.
    resetMemoForm_();
    bacaDaftarForm_(true).filter(function (f) { return f.jenis === 'kustom'; }).forEach(function (f) {
      siapkanTabKustom_(ss, f, kolomForm_(f.id), { catatan: catatan });
    });


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
 * suhu di kolom C, D, E, atau F di luar standar, untuk sorotan.
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
      'staf,IFERROR(TEXTJOIN(", ",TRUE,UNIQUE(FILTER(' + dN + ',' + milik + ',' + dW + '<>"Cek ulang"))),""),' +
      'tind,IFERROR(TEXTJOIN(" / ",TRUE,FILTER(' + dW + '&": "&' + dTk + ',' + milik + ',' + dW + '<>"Cek ulang",' + dTk + '<>"")),""),' +
      'utama,HSTACK(x,tp,v("Opening"),v("Middle"),v("Closing"),"",staf,tind,st("Opening"),st("Middle"),st("Closing"),FALSE),' +
      'nc,COUNTIFS(' + dU + ',x,' + dT + ',tgl,' + dW + ',"Cek ulang"),' +
      'm,IF(nc=0,"",FILTER(HSTACK(' + K('timestamp_server') + ',' + dS + ',' + dN + ',' + dTk + ',' + dSt + '),' + milik + ',' + dW + '="Cek ulang")),' +
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
 * aplikasi: Stock Akhir terkini × Harga Satuan di M_Item; yang dihitung item
 * aktif dan item nonaktif yang stock-nya belum nol (ikut); item tanpa harga
 * tidak dihitung. Bahan terpakai per periode B3 = (Stock Keluar + Dipakai
 * Prep) × Harga Satuan, hanya untuk item yang tidak punya resep aktif.
 */
function letNilaiStock_(ss) {
  var K = function (tab, judul) { return kolomRumus_(ss, tab, judul); };
  var periode = 'shT,">="&awalP,shT,"<="&TODAY()';
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
    'ak,MAP(it,LAMBDA(x,LET(lt,MAXIFS(shT,shI,x,shT,"<="&TODAY()),IF(lt=0,0,IFERROR(INDEX(FILTER(shA,shI=x,shT=lt),1),0))))),' +
    'ikut,ARRAYFORMULA(((ac=TRUE)+(ak<>0))>0),' +
    'ber,ARRAYFORMULA(ISNUMBER(hg)),' +
    'nv,ARRAYFORMULA(IF(ber,ak*hg,0)),' +
    'bt,MAP(it,hg,LAMBDA(x,h,IF(AND(ISNUMBER(h),COUNTIFS(rH,x,rA,TRUE)=0),' +
      '(SUMIFS(shK,shI,x,' + periode + ')+SUMIFS(shD,shI,x,' + periode + '))*h,0))),' +
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
  var awal = h + 3;
  var akhir = awal + BARIS_TABEL_KEPATUHAN - 1;
  sheet.getRange(h + 1, 1).setFormula(rumusLokal_('="Hari dengan form belum lengkap: "&COUNTIF($F$' + awal + ':$F$' + akhir + ',">0")&' +
    '" dari "&COUNT($A$' + awal + ':$A$' + akhir + ')&" hari · Isian belum diperiksa: "&SUM($G$' + awal + ':$G$' + akhir + ')&' +
    '" · Baris dilaporkan keliru: "&SUM($H$' + awal + ':$H$' + akhir + ')&" · Periode: "&$B$3'))
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
  sheet.getRange(awal, 1).setFormula(rumusLokal_('=LET(' + AWAL_PERIODE_ +
    'fI,' + fI + ',fA,' + K('M_Form', 'Aktif') + ',' +
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
      'VSTACK(acc,HSTACK(d,a,b,c,e,' +
        '(a="Belum diisi")+(b<>"Terkirim")*(b<>"–")+(c="Belum diisi")+(e="Belum diisi")+INDEX(g,1,2),' +
        'bp(sT,sS,sSt,d)+bp(cT,cS,cSt,d)+bp(pT,pS,pSt,d)+bp(wT,wS,wSt,d)+INDEX(g,1,3),' +
        'COUNTIFS(sT,d,sF,"<>")+COUNTIFS(cT,d,cF,"<>")+COUNTIFS(pT,d,pF,"<>")+COUNTIFS(wT,d,wF,"<>")+INDEX(g,1,4),' +
        'INDEX(g,1,1)))))),' +
    'CHOOSEROWS(isi,SEQUENCE(ROWS(isi)-1,1,2)))'));
  sheet.getRange(awal, 1, BARIS_TABEL_KEPATUHAN, 1).setNumberFormat('d mmm');
  sheet.getRange(awal, 6, BARIS_TABEL_KEPATUHAN, 3).setNumberFormat(FORMAT.bulat);
  pasangAturanWarna_(sheet, [
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(rumusLokal_('=AND(B' + awal + '<>"",B' + awal + '<>"Terkirim",B' + awal + '<>"Nihil",B' + awal + '<>"–")'))
      .setFontColor(WARNA.tinjau).setBold(true).setRanges([sheet.getRange(awal, 2, BARIS_TABEL_KEPATUHAN, 4)]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(rumusLokal_('=AND(I' + awal + '<>"",I' + awal + '<>"Terkirim",I' + awal + '<>"–")'))
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
