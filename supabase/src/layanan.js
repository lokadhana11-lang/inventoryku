// InventoryKu di Supabase: pengganti layanan Apps Script yang dipakai Code.gs
// (Utilities, PropertiesService, LockService, CacheService, Session, ContentService,
// DriveApp, MailApp, ScriptApp, Charts). Semuanya sinkron; pekerjaan ke luar (unggah
// berkas, email, jadwal) dicatat lalu dijalankan runtime sesudah Code.gs selesai.

import { serba } from './sheet.js';

/** Alamat berkas di Code.gs; diganti tautan sementara bertanda tangan saat dikirim ke HP (runtime.js). */
export const PENANDA_BERKAS = 'https://berkas.inventoryku/';

// Selisih zona waktu disimpan per jam: membuat Intl.DateTimeFormat untuk setiap tanggal sangat lambat, padahal
// Code.gs memformat tanggal untuk setiap baris tab (Utilities.formatDate di Apps Script cepat).
const pemformat = new Map();
const selisihJam = new Map();
export function selisihMenit(ms, zona) {
  const kunci = zona + '|' + Math.floor(ms / 3600000);
  let m = selisihJam.get(kunci);
  if (m === undefined) {
    let f = pemformat.get(zona);
    if (!f) {
      f = new Intl.DateTimeFormat('en-GB', {
        timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
        hourCycle: 'h23'
      });
      pemformat.set(zona, f);
    }
    const o = {};
    f.formatToParts(new Date(ms)).forEach((x) => { o[x.type] = x.value; });
    const lokal = Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour, +o.minute, +o.second);
    m = Math.round((lokal - Math.floor(ms / 1000) * 1000) / 60000);
    if (selisihJam.size > 200000) selisihJam.clear();
    selisihJam.set(kunci, m);
  }
  return m;
}

const dua = (n) => (n < 10 ? '0' : '') + n;

function bagianZona(d, zona) {
  const ms = d.getTime();
  const t = new Date(ms + selisihMenit(ms, zona) * 60000);
  return {
    year: String(t.getUTCFullYear()).padStart(4, '0'), month: dua(t.getUTCMonth() + 1), day: dua(t.getUTCDate()),
    hour: dua(t.getUTCHours()), minute: dua(t.getUTCMinutes()), second: dua(t.getUTCSeconds())
  };
}

const NAMA_HARI_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Code.gs memformat tanggal yang sama berulang kali (setiap baris tab): hasilnya disimpan.
const simpananFormat = new Map();

/** Utilities.formatDate untuk pola yang dipakai Code.gs (yyyy MM dd HH mm ss, 'teks', E, u). */
export function formatTanggal(d, zona, pola) {
  if (!(d instanceof Date) || isNaN(d.getTime())) throw new Error('formatDate: bukan tanggal');
  const kunci = pola + '|' + zona + '|' + d.getTime();
  let h = simpananFormat.get(kunci);
  if (h === undefined) {
    if (simpananFormat.size > 100000) simpananFormat.clear();
    h = formatTanggalBaru(d, zona, pola);
    simpananFormat.set(kunci, h);
  }
  return h;
}

function formatTanggalBaru(d, zona, pola) {
  const o = bagianZona(d, zona || 'Asia/Jakarta');
  let hasil = '';
  for (let i = 0; i < pola.length;) {
    if (pola[i] === "'") {
      const j = pola.indexOf("'", i + 1);
      hasil += pola.slice(i + 1, j);
      i = j + 1;
      continue;
    }
    const tok = ['yyyy', 'MM', 'dd', 'HH', 'mm', 'ss', 'EEE', 'u'].find((t) => pola.startsWith(t, i));
    if (tok) {
      if (tok === 'EEE' || tok === 'u') {
        const hari = new Date(Date.UTC(+o.year, +o.month - 1, +o.day)).getUTCDay();
        hasil += tok === 'EEE' ? NAMA_HARI_EN[hari] : String(hari === 0 ? 7 : hari);
      } else {
        hasil += { yyyy: o.year, MM: o.month, dd: o.day, HH: o.hour, mm: o.minute, ss: o.second }[tok];
      }
      i += tok.length;
    } else {
      hasil += pola[i];
      i++;
    }
  }
  return hasil;
}

function offsetZonaMenit(utcMs, zona) {
  return selisihMenit(utcMs, zona);
}

export function parseTanggal(teks, zona, KelasDate) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(String(teks));
  if (!m) throw new Error('parseDate gagal: ' + teks);
  const utc = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  return new (KelasDate || Date)(utc - offsetZonaMenit(utc, zona || 'Asia/Jakarta') * 60000);
}

function iter(a) {
  let i = 0;
  return { hasNext: () => i < a.length, next: () => a[i++] };
}

/**
 * Membuat semua layanan untuk satu kali menjalankan Code.gs.
 * k: { ss, Date, props (objek kunci → nilai), zona(), info, crypto, Buffer, htmlKePdf, drive (data Drive atau null),
 *      jadwal (daftar trigger), surel (antrean email), log, perluTab (Set) }
 */
export function buatLayanan(k) {
  const { Buffer, crypto } = k;
  const bytesSigned = (buf) => Array.from(buf).map((b) => (b > 127 ? b - 256 : b));
  const bytesBuf = (arr) => {
    if (arr instanceof Uint8Array) return Buffer.from(arr);
    if (typeof arr === 'string') return Buffer.from(arr, 'utf8');
    return Buffer.from(arr.map((b) => b & 0xff));
  };

  function blob(data, mime, nama) {
    let bytes = typeof data === 'string' ? Buffer.from(data, 'utf8') : bytesBuf(data);
    const b = {
      getBytes: () => bytesSigned(bytes),
      bytesAsli: () => bytes,
      getDataAsString: () => bytes.toString('utf8'),
      getContentType: () => mime,
      getName: () => nama,
      setName: (n) => { nama = n; return b; },
      setContentType: (m) => { mime = m; return b; },
      getAs: (m) => {
        if (m === 'application/pdf' && mime !== 'application/pdf') {
          return blob(k.htmlKePdf(bytes.toString('utf8')), 'application/pdf', nama ? String(nama).replace(/\.html?$/i, '') + '.pdf' : nama);
        }
        return blob(bytes, m, nama);
      },
      copyBlob: () => blob(bytes, mime, nama)
    };
    return b;
  }

  /* ---------- Drive: folder dan berkas di tabel, isi berkas di Supabase Storage ---------- */
  function periksaDrive() {
    if (!k.drive) {
      k.perluTab.add('__drive');
      const e = new Error('__TAB_BELUM_DIMUAT____drive');
      e.tabBelumDimuat = '__drive';
      throw e;
    }
    return k.drive;
  }
  function berkasObj(b) {
    return {
      getId: () => b.id,
      getName: () => b.nama,
      getUrl: () => PENANDA_BERKAS + b.id,
      getSize: () => b.ukuran || 0,
      getDateCreated: () => new k.Date(b.dibuat || Date.now()),
      getMimeType: () => b.mime,
      setTrashed: (v) => { b.dibuang = !!v; b.kotor = true; return berkasObj(b); },
      isTrashed: () => !!b.dibuang,
      getBlob: () => { throw new Error('Isi berkas tidak bisa dibaca dari Code.gs di Supabase.'); }
    };
  }
  function folderObj(jalur) {
    const d = periksaDrive();
    const anak = (n) => (jalur ? jalur + '/' + n : n);
    return {
      getName: () => jalur.split('/').pop() || 'root',
      getId: () => 'folder:' + jalur,
      getUrl: () => 'sb://folder/' + jalur,
      getFoldersByName: (n) => iter(d.folder.has(anak(n)) ? [folderObj(anak(n))] : []),
      createFolder: (n) => { d.folder.add(anak(n)); d.folderBaru.add(anak(n)); return folderObj(anak(n)); },
      getFilesByName: (n) => iter(d.berkas.filter((b) => b.jalur === jalur && b.nama === n && !b.dibuang).map(berkasObj)),
      getFiles: () => iter(d.berkas.filter((b) => b.jalur === jalur && !b.dibuang).map(berkasObj)),
      createFile: (bl) => {
        const id = crypto.randomUUID();
        const bytes = bl.bytesAsli ? bl.bytesAsli() : bytesBuf(bl.getBytes());
        const b = { id, jalur, nama: bl.getName() || 'berkas', mime: bl.getContentType() || 'application/octet-stream',
          ukuran: bytes.length, dibuat: Date.now(), dibuang: false, baru: true, isi: bytes };
        d.berkas.push(b);
        return berkasObj(b);
      }
    };
  }
  const DriveApp = {
    getRootFolder: () => folderObj(''),
    getFileById: (id) => {
      const d = periksaDrive();
      const b = d.berkas.find((x) => x.id === id);
      if (!b) throw new Error('Berkas tidak ditemukan.');
      return berkasObj(b);
    },
    getFolderById: (id) => folderObj(String(id).replace(/^folder:/, ''))
  };

  /* ---------- Trigger: dicatat, lalu runtime memasangnya sebagai jadwal pg_cron ---------- */
  function triggerObj(t) {
    return { getHandlerFunction: () => t.fungsi, getUniqueId: () => t.id, getEventType: () => 'CLOCK', getTriggerSource: () => 'CLOCK' };
  }
  const ScriptApp = {
    newTrigger: (fungsi) => {
      const t = { id: crypto.randomUUID(), fungsi, zona: k.zona() };
      const b = {
        timeBased: () => b,
        everyDays: (n) => { t.setiapHari = n; return b; },
        everyHours: (n) => { t.setiapJam = n; return b; },
        everyMinutes: (n) => { t.setiapMenit = n; return b; },
        everyWeeks: (n) => { t.setiapMinggu = n; return b; },
        onWeekDay: (h) => { t.hariMinggu = h; return b; },
        onMonthDay: (h) => { t.tanggalBulan = h; return b; },
        atHour: (j) => { t.jam = j; return b; },
        nearMinute: (m) => { t.menit = m; return b; },
        inTimezone: (z) => { t.zona = z; return b; },
        create: () => { k.jadwal.daftar.push(t); k.jadwal.berubah = true; return triggerObj(t); }
      };
      return b;
    },
    getProjectTriggers: () => k.jadwal.daftar.map(triggerObj),
    deleteTrigger: (tr) => {
      k.jadwal.daftar = k.jadwal.daftar.filter((t) => t.id !== tr.getUniqueId());
      k.jadwal.berubah = true;
    },
    WeekDay: { MONDAY: 'MONDAY', TUESDAY: 'TUESDAY', WEDNESDAY: 'WEDNESDAY', THURSDAY: 'THURSDAY', FRIDAY: 'FRIDAY',
      SATURDAY: 'SATURDAY', SUNDAY: 'SUNDAY' },
    getService: () => serba('Service', { getUrl: () => k.info.alamatApi || '' })
  };

  const SpreadsheetApp = {
    openById: () => k.ss,
    getActiveSpreadsheet: () => k.ss,
    flush: () => {},
    newDataValidation: () => serba('DataValidationBuilder'),
    newConditionalFormatRule: () => {
      let rentang = [];
      const b = serba('CFBuilder', { setRanges: (r) => { rentang = r; return b; }, build: () => ({ getRanges: () => rentang }) });
      return b;
    },
    newRichTextValue: () => serba('RichText'),
    newTextStyle: () => serba('TextStyle'),
    ProtectionType: { SHEET: 'SHEET', RANGE: 'RANGE' },
    BorderStyle: { SOLID: 'SOLID', SOLID_MEDIUM: 'SOLID_MEDIUM', SOLID_THICK: 'SOLID_THICK', DOTTED: 'DOTTED', DASHED: 'DASHED' },
    WrapStrategy: { WRAP: 'WRAP', CLIP: 'CLIP', OVERFLOW: 'OVERFLOW' },
    DataValidationCriteria: serba('DataValidationCriteria'),
    BooleanCriteria: serba('BooleanCriteria')
  };

  const props = k.props;
  const PropertiesService = {
    getScriptProperties: () => ({
      getProperty: (n) => (Object.prototype.hasOwnProperty.call(props, n) ? props[n] : null),
      setProperty: (n, v) => { props[n] = String(v); },
      deleteProperty: (n) => { delete props[n]; },
      getProperties: () => Object.assign({}, props),
      getKeys: () => Object.keys(props),
      setProperties: (o) => { Object.keys(o).forEach((n) => { props[n] = String(o[n]); }); }
    })
  };

  const Utilities = {
    formatDate: formatTanggal,
    parseDate: (teks, zona) => parseTanggal(teks, zona, k.Date),
    getUuid: () => crypto.randomUUID(),
    DigestAlgorithm: { SHA_256: 'sha256', MD5: 'md5', SHA_1: 'sha1' },
    Charset: { UTF_8: 'utf8' },
    computeDigest: (alg, teks) => bytesSigned(crypto.createHash(alg).update(bytesBuf(teks)).digest()),
    computeHmacSha256Signature: (nilai, kunci) => bytesSigned(crypto.createHmac('sha256', bytesBuf(kunci)).update(bytesBuf(nilai)).digest()),
    base64Encode: (x) => bytesBuf(x).toString('base64'),
    base64Decode: (s) => bytesSigned(Buffer.from(String(s), 'base64')),
    base64EncodeWebSafe: (x) => bytesBuf(x).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
    base64DecodeWebSafe: (s) => bytesSigned(Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64')),
    newBlob: blob,
    sleep: () => {}
  };

  return {
    SpreadsheetApp,
    DriveApp,
    ScriptApp,
    PropertiesService,
    Utilities,
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {}, hasLock: () => true }) },
    CacheService: { getScriptCache: () => ({ get: () => null, put: () => {}, remove: () => {}, getAll: () => ({}), removeAll: () => {} }) },
    ContentService: {
      createTextOutput: (s) => ({ isi: s, setMimeType() { return this; }, getContent() { return this.isi; } }),
      MimeType: { JSON: 'JSON', TEXT: 'TEXT' }
    },
    Session: {
      getScriptTimeZone: () => k.zona(),
      getEffectiveUser: () => ({ getEmail: () => k.info.emailPemilik || '' }),
      getActiveUser: () => ({ getEmail: () => '' })
    },
    MailApp: {
      sendEmail: (a, b, c, d) => {
        const opsi = typeof a === 'object' ? a : Object.assign({ to: a, subject: b, body: c }, d || {});
        k.surel.push(opsi);
      },
      getRemainingDailyQuota: () => 300
    },
    Charts: { ChartType: serba('ChartType'), Position: serba('Position') },
    console: k.log
  };
}
