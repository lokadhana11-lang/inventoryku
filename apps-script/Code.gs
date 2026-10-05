// InventoryKu Code.gs v0.5.1 (Tahap 4 + perubahan 5 Oktober 2026)
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

var VERSI_KODE = 'v0.5.1';

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
  bacaOutletJadwal: { jalankan: aksiBacaOutletJadwal_, pengelola: true },
  simpanOutletJadwal: { jalankan: aksiSimpanOutletJadwal_, pengelola: true,
    pesan: 'Pengaturan outlet dan jadwal hanya bisa diubah Head Kitchen atau Manager.' },
  bacaPenerima: { jalankan: aksiBacaPenerima_, pengelola: true },
  simpanPenerima: { jalankan: aksiSimpanPenerima_, pengelola: true },
  formStock: { jalankan: aksiFormStock_ },
  kirimStock: { jalankan: aksiKirimStock_ },
  tandaiNihil: { jalankan: aksiTandaiNihil_ },
  sesuaikanStock: { jalankan: aksiSesuaikanStock_, pengelola: true },
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
    pesan: 'Simpan ulang ke Drive hanya bisa dilakukan Head Kitchen atau Manager.' }
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
    konf.sheet.getRange(konf.sheet.getLastRow() + 1, 1, 1, 3).setValues([[kunci, nilai, keterangan || '']]);
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

/* ---------- Menulis M_Staff ---------- */

function tulisStaff_(info, staff, ubah) {
  Object.keys(ubah).forEach(function (kunci) {
    info.sheet.getRange(staff.baris, info.kol[kunci]).setValue(ubah[kunci]);
  });
}

function tambahBarisStaff_(info, isi) {
  var lebar = info.sheet.getLastColumn();
  var baris = [];
  for (var i = 0; i < lebar; i++) baris.push('');
  Object.keys(isi).forEach(function (kunci) {
    baris[info.kol[kunci] - 1] = isi[kunci];
  });
  var nomor = info.sheet.getLastRow() + 1;
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

/** Form di M_Form: [{ id, nama, jenis, jadwal, urutan, aktif }], urut menurut Urutan. */
function bacaDaftarForm_() {
  var sheet = ambilTab_('M_Form');
  var kol = posisiKolom_(sheet, {
    id: 'ID Form', nama: 'Nama', jenis: 'Jenis', jadwal: 'Jadwal', urutan: 'Urutan', aktif: 'Aktif'
  });
  var daftar = [];
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues().forEach(function (r) {
      var id = rapikanTeks_(r[kol.id - 1]).toUpperCase();
      if (!id) return;
      var aktif = r[kol.aktif - 1];
      daftar.push({
        id: id,
        nama: rapikanTeks_(r[kol.nama - 1]) || id,
        jenis: rapikanTeks_(r[kol.jenis - 1]).toLowerCase(),
        jadwal: rapikanTeks_(r[kol.jadwal - 1]).toLowerCase(),
        urutan: Number(r[kol.urutan - 1]) || 999,
        aktif: aktif === true || String(aktif).toUpperCase() === 'TRUE'
      });
    });
  }
  return daftar.sort(function (a, b) { return a.urutan - b.urutan; });
}

/**
 * Status tiap form yang tampil (Aktif) pada satu tanggal, menurut aturan
 * kelengkapan Bagian 5.8.
 * wajib  : punya ruas di rel kemajuan (form bawaan, atau form kustom harian).
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
      wajib: f.jenis === 'bawaan' || f.jadwal === 'harian'
    };
    if (f.id === 'SUHU') return statusSuhu_(dasar, tanggal, zonaSheet);

    var kiriman = bacaBarisTanggal_(TAB_DATA_FORM[f.id] || ('Data_K_' + f.id), tanggal, zonaSheet, []);
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

/* ---------- Outlet dan jadwal (baru berisi lama keluar otomatis) ---------- */

function aksiBacaOutletJadwal_() {
  return { keluarOtomatisMenit: keluarOtomatisMenit_() };
}

function aksiSimpanOutletJadwal_(body) {
  var n = Number(body.keluarOtomatisMenit);
  if (PILIHAN_KELUAR_OTOMATIS.indexOf(n) < 0) {
    throw galatPengguna_('Pilih 5, 10, 15, atau 30 menit.');
  }
  return denganKunci_(function () {
    tulisKonfigurasi_('keluar_otomatis_menit', String(n), KETERANGAN_KELUAR_OTOMATIS);
    return { keluarOtomatisMenit: n };
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
 * Nomor baris pertama untuk menulis n baris baru di bawah data. Tab baru
 * hanya punya 1.000 baris; jika kurang, baris ditambah di dalam rentang
 * (sebelum baris terakhir), supaya format, aturan warna, dan filter ikut
 * melebar. Baris kosong yang tersisa di tengah hilang saat tab diurutkan.
 */
function barisTulis_(sheet, n) {
  var akhirData = sheet.getLastRow();
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
 * Sumber gerakan stock. Setiap gerakan dicatat sekali di form asalnya.
 * Tab Prep, PrepBahan, dan Waste masih kosong sampai formnya dibangun
 * (Tahap 5 dan 6), jadi gerakannya bernilai nol.
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
      if (bacaBarisTanggal_(TAB_DATA_FORM[idForm] || ('Data_K_' + idForm), tanggal, zona, []).length) {
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
    }
  }
};

/** Definisi Riwayat satu form, atau null jika Riwayat form itu belum dibangun. */
function defRiwayat_(idForm) {
  return RIWAYAT_FORM[rapikanTeks_(idForm).toUpperCase()] || null;
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
    nilai[k.kunci] = k.jenis === 'angka' ? angkaAtauNull_(v) : rapikanTeks_(v);
    if (k.asli) {
      var a = rapikanTeks_(nilai_(t, b, k.asli));
      if (a) asli[k.kunci] = a;
    }
    var lg = logBaris[k.judul];
    if (lg) {
      koreksi[k.kunci] = {
        lama: k.jenis === 'angka' ? angkaAtauNull_(lg.lama) : rapikanTeks_(lg.lama),
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
  var pilih = t.baris.filter(function (b) {
    var tg = teksTanggal_(nilai_(t, b, 'Tanggal'), zona);
    if (!tg || tg < r.dari || tg > r.sampai) return false;
    if (!String(nilai_(t, b, 'submission_id') || '')) return false;
    if (f.kategori && def.kategori && rapikanTeks_(nilai_(t, b, def.kategori)).toLowerCase() !== f.kategori) return false;
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
  if (!def.stock) return hasil.sort(urutTerbaru_);

  var sesuai = bacaTabel_('Data_Penyesuaian');
  if (sesuai) {
    sesuai.baris.forEach(function (b) {
      var tg = dalam(sesuai, b);
      if (!tg || !saringItem(sesuai, b)) return;
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
          tanggal: tg,
          oleh: rapikanTeks_(nilai_(opname, b, 'submitted_by')),
          waktu: isoAtauNull_(nilai_(opname, b, 'timestamp_server')),
          jumlahItem: 0,
          berselisih: 0
        };
        hasil.push(o);
      }
      o.jumlahItem++;
      if (Number(nilai_(opname, b, 'Selisih'))) o.berselisih++;
    });
  }
  return hasil.sort(urutTerbaru_);
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
  var hasil = { kategori: [], item: [], pengisi: [] };
  if (def && def.kategori) hasil.kategori = bacaKategori_().map(function (k) { return k.nama; });
  if (def && def.item) {
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
  var daftar = bacaDaftarForm_().filter(function (f) { return f.aktif; });
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
      return { id: x.id, nama: x.nama, adaRiwayat: !!defRiwayat_(x.id), stock: !!(defRiwayat_(x.id) || {}).stock,
        adaPdf: !!LAPORAN_PDF[x.id] };
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
    return { kunci: k.kunci, label: k.label, singkat: k.singkat || k.label.toLowerCase(), jenis: k.jenis,
      koreksi: !!k.koreksi, satuan: !!k.satuan };
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
  return { formId: idForm, namaForm: nama, adaPdf: !!LAPORAN_PDF[idForm], kepala: infoKepala_(def), kolom: infoKolom_(def), kiriman: k };
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
      if (k.jenis === 'angka') {
        nilaiBaru = angkaIsian_(baru[k.kunci], k.label + (namaBaris ? ' ' + namaBaris : ''));
        lama = Number(lama) || 0;
      } else {
        nilaiBaru = rapikanTeks_(baru[k.kunci]).slice(0, 200);
        lama = rapikanTeks_(lama);
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
    if (!perubahan.length) throw galatPengguna_('Tidak ada angka yang berubah.');
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
      });
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
  STOCK: { judul: 'Form Stock Inventory Harian', isi: isiPdfStock_, perKategori: true }
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

/**
 * Dokumen HTML lengkap satu laporan: kepala, kotak info, tabel, Diisi/Diperiksa
 * oleh, kaki. Laporan dengan isi.bagian: tiap bagian setelah yang pertama
 * mulai di halaman baru (page-break-before) dengan kepala, judul, dan kotak
 * info diulang; baris judul tabel ikut diulang karena tiap bagian punya tabel
 * sendiri. Diisi/Diperiksa oleh dan kaki hanya di akhir.
 */
function htmlLaporan_(idForm, tanggal, isi) {
  var t = LAPORAN_PDF[idForm];
  var outlet = namaOutlet_();
  var p = ringkasPengisian_(idForm, tanggal, isi.kategori);
  var w = WARNA_PDF;
  var dibuat = Utilities.formatDate(new Date(), zonaWaktu_(), 'yyyy-MM-dd HH.mm');
  var bagian = isi.bagian || [{ info: isi.info, tabel: isi.tabel }];
  var kepala = function (b) {
    var info = [['Nama Outlet', outlet], ['Tanggal', tanggalPanjangId_(tanggal)]].concat(b.info || []);
    return '<div class="kepala">InventoryKu · ' + escHtml_(outlet) + '</div>' +
      '<h1>' + escHtml_(t.judul) + '</h1>' +
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
    '.masalah{color:' + w.masalah + ';font-weight:bold}.kecil{font-size:7pt;color:' + w.tintaRedup + '}' +
    'table.bawah{margin-top:12px}table.bawah td{padding:2px 14px 2px 0}table.bawah td.label{color:' + w.tintaRedup + '}' +
    '.catatan{color:' + w.tintaRedup + ';font-size:8pt;margin:6px 0 0 0}' +
    '.halaman-baru{page-break-before:always;break-before:page}' +
    '</style></head><body>' +
    bagian.map(function (b, i) {
      return (i ? '<div class="halaman-baru">' : '<div>') + kepala(b) + b.tabel + '</div>';
    }).join('') +
    (isi.catatan || []).map(function (c) { return '<p class="catatan">' + escHtml_(c) + '</p>'; }).join('') +
    '<table class="bawah">' +
      '<tr><td class="label">Diisi oleh</td><td>' + escHtml_(p.diisi) + '</td></tr>' +
      '<tr><td class="label">Diperiksa oleh</td><td>' + escHtml_(p.diperiksa) + '</td></tr>' +
    '</table>' +
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
  var t = LAPORAN_PDF[idForm];
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
    form: bacaDaftarForm_().filter(function (f) { return f.aktif; }).map(function (f) {
      var hasil = { id: f.id, nama: f.nama, adaPdf: !!LAPORAN_PDF[f.id] };
      if (LAPORAN_PDF[f.id] && LAPORAN_PDF[f.id].perKategori) {
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
  return hasil;
}

/* ---------- Email laporan harian (Bagian 10) ---------- */

/** Saran order (Bagian 9.2): Stok Maksimum − Stock Akhir, dibulatkan ke atas ke satuan besar. */
function saranOrder_(m, akhir) {
  if (m.stokMaks == null || !(m.stokMaks > akhir)) return '';
  var butuh = bulat_(m.stokMaks - akhir);
  if (m.satuanBesar && m.isiSatuanBesar > 0) {
    var besar = Math.ceil(butuh / m.isiSatuanBesar);
    return besar + ' ' + m.satuanBesar + ' (' + angkaId_(besar * m.isiSatuanBesar) + ' ' + m.satuan + ')';
  }
  return angkaId_(butuh) + ' ' + m.satuan;
}

/** Stock pada akhir tanggal itu: item minus dan item di bawah stok minimum (item aktif). */
function ringkasStockHari_(tanggal) {
  var master = bacaItem_();
  var rekap = bacaRekap_();
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
  return f.wajib ? 'Belum diisi' : 'Belum diisi (tidak wajib hari ini)';
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
    stock.push('<p style="margin:6px 0 2px"><b>Di bawah stok minimum (' + d.stock.belanja.length + ')</b></p>' +
      daftar(d.stock.belanja.map(function (x) {
        return escHtml_(x.m.nama) + ': ' + angkaId_(x.akhir) + ' ' + escHtml_(x.m.satuan) +
          ' (minimum ' + angkaId_(x.m.stokMin) + ')' + (x.saran ? ', saran order ' + escHtml_(x.saran) : '');
      })));
  }
  html += bagian('Stock', stock.length ? stock.join('') : '<p style="margin:0">Tidak ada Stock Akhir minus dan semua stock di atas batas minimum.</p>');

  var periksa = [];
  if (d.pemeriksaan.belumDiperiksa) periksa.push(d.pemeriksaan.belumDiperiksa + ' isian belum diperiksa (31 hari terakhir)');
  if (d.pemeriksaan.dilaporkan) periksa.push(d.pemeriksaan.dilaporkan + ' baris dilaporkan keliru');
  d.reset.forEach(function (n) { periksa.push(escHtml_(n) + ' meminta reset PIN'); });
  html += bagian('Untuk Head Kitchen dan Manager', periksa.length ? daftar(periksa) :
    '<p style="margin:0">Semua isian sudah diperiksa. Tidak ada laporan kekeliruan atau permintaan reset PIN.</p>');

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
 * Butir yang sumbernya belum dibangun (suhu di luar standar, waste, masa
 * simpan, pengingat opname) dilewati sampai tahapnya. Hasil dan kegagalan
 * dicatat di M_Konfigurasi (laporan_terakhir).
 * opsi: { tanggal, uji: bool }.
 */
function jalankanLaporanHarian_(opsi) {
  SS_ = null;
  opsi = opsi || {};
  var tanggal = opsi.tanggal || hariIni_();
  var masalah = [];
  var hasil = { tanggal: tanggal, pdf: [], penerima: [], terkirim: false };
  try {
    var form = kelengkapanForm_(tanggal);
    form.forEach(function (f) {
      if (f.status !== 'terkirim' || !LAPORAN_PDF[f.id]) return;
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
      pemeriksaan: ringkasPemeriksaan_(),
      reset: bacaStaff_().daftar.filter(function (s) { return s.aktif && s.reset; }).map(function (s) { return s.nama; }),
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
      k_('Aktif', null, { centang: true })
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
      k_('Aktif', null, { centang: true })
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
function urutanTab_() {
  var nama = ['Dashboard'];
  TAB_HARIAN.forEach(function (t) { nama.push(t.nama); });
  TAB_DATA.forEach(function (t) { nama.push(t.nama); });
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

    // 3. Nilai awal (hanya baris yang belum ada).
    isiBarisAwal_(ss.getSheetByName('M_Satuan'), SATUAN_AWAL.map(function (s) {
      return [s[0], s[1], true];
    }), 'M_Satuan', catatan);
    isiBarisAwal_(ss.getSheetByName('M_Form'), FORM_BAWAAN, 'M_Form', catatan);
    isiKonfigurasiAwal_(ss.getSheetByName('M_Konfigurasi'), catatan);

    // 4. Rumus Stock (Tahap 2): tab Harian_Stock dan blok Stock Inventory di Dashboard.
    pasangRumusHarianStock_(ss, catatan);
    pasangBlokStockDashboard_(ss, catatan);

    // 5. Urutkan tab dan buang lembar kosong bawaan Google Sheets.
    aturUrutanTab_(ss);
    hapusLembarBawaanKosong_(ss, catatan);

    SpreadsheetApp.flush();
  } finally {
    kunci.releaseLock();
  }

  catatan.push('Selesai. ID spreadsheet tersimpan di Script Properties.');
  catatan.push('Kode Pemasangan ada di tab M_Konfigurasi (baris kode_pemasangan).');
  console.log('InventoryKu ' + VERSI_KODE + ' setupSpreadsheet:\n- ' + catatan.join('\n- '));
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
    .whenFormulaSatisfied('=AND(ISNUMBER($A2),ISEVEN(INT($A2)))')
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

    sheet.getRange(HARIAN.barisOutlet, 2).setFormula('=IF(M_Outlet!A2="","",M_Outlet!A2)')
      .setFontWeight('bold');
    sheet.getRange(HARIAN.barisTanggal, 2)
      .setFormula('=IF(B' + HARIAN.barisPilihTanggal + '="",TODAY(),B' + HARIAN.barisPilihTanggal + ')')
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
  var hari = function (judul) { return 'XLOOKUP(1,cocok,' + K('Stock_Harian', judul) + ',0)'; };
  var akhirSH = K('Stock_Harian', 'Stock Akhir');
  var baris =
    'LAMBDA(grp,x,LET(' +
      'lt,MAXIFS(shT,shI,x,shT,"<="&tgl),' +
      'cocok,(shI=x)*(shT=tgl),' +
      'ada,lt=tgl,' +
      'lalu,IF(lt=0,0,XLOOKUP(1,(shI=x)*(shT=lt),' + akhirSH + ',0)),' +
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
  var isiLama = String(sel.getFormula() || sel.getValue() || '');
  if (isiLama && isiLama !== 'Belum ada data.' && isiLama.charAt(0) !== '=') {
    catatan.push('Peringatan: A' + mulai + ' di Harian_Stock berisi teks lain; rumus stock tidak dipasang.');
    return;
  }
  sel.setFormula(rumusHarianStock_(ss)).setFontStyle('normal').setFontColor(WARNA.tinta);
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
      .whenFormulaSatisfied('=AND($A' + mulai + '="",$B' + mulai + '<>"",$C' + mulai + '="")')
      .setBackground(WARNA.baja).setBold(true).setRanges([semua]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND(ISNUMBER($A' + mulai + '),ISNUMBER($J' + mulai + '),$J' + mulai + '<0)')
      .setFontColor(WARNA.masalah).setBold(true).setRanges([akhir]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND(ISNUMBER($A' + mulai + '),ISNUMBER($J' + mulai + '),$J' + mulai + '>=0,$J' +
        mulai + '<' + cariMin + ')')
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
      'akhir,IF(lt=0,0,XLOOKUP(1,(shI=x)*(shT=lt),' + K('Stock_Harian', 'Stock Akhir') + ',0)),' +
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
  var akhirTabel = 7 + TINGGI_BLOK_STOCK;
  var rentangKet = '$F$8:$F$' + akhirTabel;
  sheet.getRange(6, 1).setFormula('="Di bawah stok minimum: "&COUNTIF(' + rentangKet + ',"Perlu reorder")&' +
    '" item · Stock akhir minus: "&COUNTIF(' + rentangKet + ',"Stock akhir minus")&" item · Masuk dan keluar: "&$B$3')
    .setFontStyle('normal').setFontColor(WARNA.tinta);
  sheet.getRange(7, 1, 1, 6).setValues([['Item', 'Stock Akhir', 'Satuan', 'Masuk', 'Keluar', 'Keterangan']])
    .setFontWeight('bold').setFontColor(WARNA.tintaRedup).setBackground(WARNA.baja);
  sheet.getRange(8, 1).setFormula(rumusDashboardStock_(ss));
  sheet.getRange(8, 2, TINGGI_BLOK_STOCK, 1).setNumberFormat(FORMAT.angka);
  sheet.getRange(8, 4, TINGGI_BLOK_STOCK, 2).setNumberFormat(FORMAT.angka);
  var tabel = sheet.getRange(8, 1, TINGGI_BLOK_STOCK, 6);
  pasangAturanWarna_(sheet, [
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($A8<>"",$B8="")')
      .setBackground(WARNA.baja).setBold(true).setRanges([tabel]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$F8="Stock akhir minus"')
      .setFontColor(WARNA.masalah).setBold(true).setRanges([tabel]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$F8="Perlu reorder"')
      .setFontColor(WARNA.tinjau).setBold(true).setRanges([tabel]).build()
  ]);
  catatan.push('Rumus stock dipasang: Dashboard (blok Stock Inventory)');
}

/** Menambahkan baris yang kunci kolom A-nya belum ada. Baris lama tidak disentuh. */
function isiBarisAwal_(sheet, baris, label, catatan) {
  var ada = kunciKolomA_(sheet);
  var tambah = baris.filter(function (b) {
    return !ada[String(b[0]).trim().toLowerCase()];
  });
  if (!tambah.length) return;
  sheet.getRange(sheet.getLastRow() + 1, 1, tambah.length, tambah[0].length).setValues(tambah);
  catatan.push(label + ': ' + tambah.length + ' baris awal ditambahkan');
}

function isiKonfigurasiAwal_(sheet, catatan) {
  var ada = kunciKolomA_(sheet);
  var tambah = konfigurasiAwal_().filter(function (b) {
    return !ada[b[0].toLowerCase()];
  });
  if (!tambah.length) return;
  sheet.getRange(sheet.getLastRow() + 1, 1, tambah.length, 3).setValues(tambah);
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
  urutanTab_().forEach(function (nama, i) {
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
  urutanTab_().forEach(function (n) { milikKita[n] = true; });
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
