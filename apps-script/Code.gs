// InventoryKu Code.gs v0.2 (Tahap 1)
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
 * - setupSpreadsheet   : dijalankan dari editor; menyimpan ID spreadsheet dan
 *                        membuat semua tab. Aman dijalankan ulang.
 * - buatKodePemasangan : dijalankan dari editor saat tidak ada Pengelola yang
 *                        bisa masuk; membuat Kode Pemasangan baru.
 */

var VERSI_KODE = 'v0.2';

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
 * pengelola: true berarti hanya Head Kitchen dan Manager.
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
  bacaPenerima: { jalankan: aksiBacaPenerima_, pengelola: true },
  simpanPenerima: { jalankan: aksiSimpanPenerima_, pengelola: true }
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
        throw galatPengguna_('Menu ini hanya untuk Head Kitchen dan Manager.');
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

/** Membaca M_Staff: { sheet, kol, daftar: [{ baris, nama, role, hash, aktif, reset }] }. */
function bacaStaff_() {
  var sheet = ambilTab_('M_Staff');
  var kol = posisiKolom_(sheet, KOLOM_STAFF);
  var daftar = [];
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues().forEach(function (r, i) {
      var nama = rapikanTeks_(r[kol.nama - 1]);
      if (!nama) return;
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
    namaOutlet: namaOutlet_()
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

/** Daftar staff untuk Pengaturan → Staff dan PIN. */
function ringkasStaff_(daftar) {
  var props = PropertiesService.getScriptProperties();
  return daftar.slice().sort(function (a, b) {
    return a.nama.localeCompare(b.nama, 'id');
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

/** Ganti pengguna: menghapus sesi yang dikirim. Tidak gagal jika sesi sudah habis. */
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
 * permintaan reset PIN.
 */
function aksiBeranda_(body, pengguna) {
  var tanggal = /^\d{4}-\d{2}-\d{2}$/.test(String(body.tanggal || ''))
    ? body.tanggal
    : Utilities.formatDate(new Date(), zonaWaktu_(), 'yyyy-MM-dd');
  var hasil = {
    pengguna: pengguna,
    namaOutlet: namaOutlet_(),
    tanggal: tanggal,
    form: kelengkapanForm_(tanggal)
  };
  if (pengguna.pengelola) {
    hasil.permintaanReset = bacaStaff_().daftar.filter(function (s) {
      return s.aktif && s.reset;
    }).sort(function (a, b) {
      return a.reset.getTime() - b.reset.getTime();
    }).map(function (s) {
      return { nama: s.nama, waktu: s.reset.toISOString() };
    });
  }
  return hasil;
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

/** Ubah role atau aktif/nonaktif. Akun sendiri tidak bisa diubah di sini. */
function aksiUbahStaff_(body, pengguna) {
  return denganKunci_(function () {
    var info = bacaStaff_();
    var staff = cariStaff_(info.daftar, body.nama);
    if (!staff) throw galatPengguna_('Staff tidak ditemukan. Muat ulang daftar staff.');
    if (samaNama_(staff.nama, pengguna.nama)) {
      throw galatPengguna_('Role dan keadaan akunmu sendiri diubah oleh Head Kitchen atau Manager lain.');
    }
    var ubah = {};
    if (body.role != null && periksaRole_(body.role) !== staff.role) ubah.role = body.role;
    if (typeof body.aktif === 'boolean' && body.aktif !== staff.aktif) ubah.aktif = body.aktif;
    tulisStaff_(info, staff, ubah);
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
  garisIsian: '#6F7E96'
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
      k_('Permintaan Reset PIN', 'waktu')
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
    ['hari_cadangan', 'Minggu', 'Hari salinan cadangan mingguan dibuat (dini hari).']
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

    // 4. Urutkan tab dan buang lembar kosong bawaan Google Sheets.
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
      baris += 3;
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
