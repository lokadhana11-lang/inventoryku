// InventoryKu di Supabase: Spreadsheet tiruan yang isinya dari Postgres.
// Code.gs berjalan apa adanya di atas objek ini. Setiap tab dimuat utuh saat pertama kali isinya
// dibutuhkan; tab yang belum dimuat memicu galat TAB_BELUM_DIMUAT, lalu aksi diulang setelah
// tab itu dimuat (runtime.js). Perubahan dicatat per baris dan ditulis ke Postgres di akhir aksi.

/** Galat khusus: isi tab dibutuhkan tetapi belum dimuat. */
export const TAB_BELUM_DIMUAT = '__TAB_BELUM_DIMUAT__';

/** Objek serba-boleh: metode yang tidak dikenal (format, validasi, proteksi, grafik) tidak berbuat apa-apa. */
export function serba(nama, tambahan) {
  const dasar = Object.assign({}, tambahan || {});
  const p = new Proxy(dasar, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'then' || typeof k === 'symbol') return undefined;
      if (k === 'toString') return () => '[' + nama + ']';
      return function () { return p; };
    }
  });
  return p;
}

function bandingNilai(a, b) {
  const kosongA = a === '' || a == null;
  const kosongB = b === '' || b == null;
  if (kosongA && kosongB) return 0;
  if (kosongA) return 1;
  if (kosongB) return -1;
  const na = a instanceof Date ? a.getTime() : a;
  const nb = b instanceof Date ? b.getTime() : b;
  if (typeof na === 'number' && typeof nb === 'number') return na - nb;
  if (typeof na === 'boolean' || typeof nb === 'boolean') return String(na).localeCompare(String(nb));
  return String(na).toLowerCase().localeCompare(String(nb).toLowerCase());
}

function kosong(v) {
  return v === '' || v == null;
}

/** Mengurutkan baris[dari..] di tempat menurut daftar { column, ascending }, stabil (urutan lama untuk nilai sama). */
function urutkanBaris(baris, daftar, dari) {
  const bagian = baris.slice(dari).map((b, i) => ({ b, i }));
  const nilaiDi = (b, kol) => { const v = b.v[kol - 1]; return v === undefined ? '' : v; };
  bagian.sort((x, y) => {
    for (const s of daftar) {
      const va = nilaiDi(x.b, s.column);
      const vb = nilaiDi(y.b, s.column);
      const kosongA = kosong(va);
      const kosongB = kosong(vb);
      if (kosongA !== kosongB) return kosongA ? 1 : -1;
      const h = bandingNilai(va, vb);
      if (h) return s.ascending === false ? -h : h;
    }
    return x.i - y.i;
  });
  bagian.forEach((x, i) => { baris[dari + i] = x.b; });
}

/**
 * Satu tab. baris: [{ id (null untuk baris baru), v: [nilai], f: { kolom: rumus } | null, kotor }].
 * meta: { maksBaris, maksKolom, beku, urutan } dari tab_meta.
 */
export class Sheet {
  constructor(ss, nama, meta, data) {
    this.ss = ss;
    this.nama = nama;
    this.meta = Object.assign({ maksBaris: 1000, maksKolom: 26, beku: 0 }, meta || {});
    this.dimuat = !!data;
    this.baris = data ? data.map((b) => ({ id: b.id, pos: b.pos, v: b.v.slice(), f: b.f ? Object.assign({}, b.f) : null, kotor: false })) : [];
    this.dihapusId = [];
    this.strukturBerubah = false; // baris disisipkan di tengah atau dipindah (posisi di database harus ditulis ulang)
    // Tab yang pernah diurutkan seluruhnya (urutkanTabel_): aturannya disimpan dan diterapkan setiap dimuat.
    if (this.dimuat && this.meta.urutan) urutkanBaris(this.baris, this.meta.urutan, 1);
    this.metaBerubah = false;
    this.baru = false;
    this.namaLama = null;
  }
  periksaDimuat() {
    if (!this.dimuat) {
      this.ss.perluTab.add(this.nama);
      const e = new Error(TAB_BELUM_DIMUAT + this.nama);
      e.tabBelumDimuat = this.nama;
      throw e;
    }
  }
  tandaiUbah() {
    this.ss.diubah.add(this);
  }
  baca(r, c) {
    const b = this.baris[r - 1];
    if (!b) return '';
    const v = b.v[c - 1];
    return v === undefined ? '' : v;
  }
  pastikanBaris(r) {
    while (this.baris.length < r) this.baris.push({ id: null, v: [], f: null, kotor: true });
  }
  tulis(r, c, v) {
    this.pastikanBaris(r);
    const b = this.baris[r - 1];
    if (typeof v === 'string' && v.charAt(0) === "'") v = v.slice(1);
    while (b.v.length < c - 1) b.v.push('');
    b.v[c - 1] = v;
    if (b.f) delete b.f[c];
    b.kotor = true;
    this.tandaiUbah();
  }
  tulisRumus(r, c, rumus) {
    this.pastikanBaris(r);
    const b = this.baris[r - 1];
    b.f = b.f || {};
    if (rumus) b.f[c] = rumus;
    else delete b.f[c];
    while (b.v.length < c - 1) b.v.push('');
    b.v[c - 1] = '';
    b.kotor = true;
    this.tandaiUbah();
  }
  rumus(r, c) {
    const b = this.baris[r - 1];
    return (b && b.f && b.f[c]) || '';
  }
  _lastRow() {
    for (let r = this.baris.length; r >= 1; r--) {
      const b = this.baris[r - 1];
      if (b.v.some((x) => !kosong(x)) || (b.f && Object.keys(b.f).length)) return r;
    }
    return 0;
  }
  _lastCol() {
    let maks = 0;
    this.baris.forEach((b) => {
      for (let c = b.v.length; c >= 1; c--) {
        if (!kosong(b.v[c - 1])) { maks = Math.max(maks, c); break; }
      }
      if (b.f) Object.keys(b.f).forEach((c) => { maks = Math.max(maks, +c); });
    });
    return maks;
  }
  getName() { return this.nama; }
  getSheetName() { return this.nama; }
  setName(n) {
    if (!this.namaLama && !this.baru) this.namaLama = this.nama;
    this.nama = n;
    this.metaBerubah = true;
    this.tandaiUbah();
    return this;
  }
  getSheetId() { return this.meta.id || 0; }
  getIndex() { return this.ss.sheets.indexOf(this) + 1; }
  getLastRow() { this.periksaDimuat(); return this._lastRow(); }
  getLastColumn() { this.periksaDimuat(); return this._lastCol(); }
  // Seperti tab Google Sheets yang selalu punya baris kosong di bawah: tidak perlu menyisipkan baris untuk menulis di belakang.
  getMaxRows() { this.periksaDimuat(); return Math.max(this.meta.maksBaris, this.baris.length + 1000); }
  getMaxColumns() { return Math.max(this.meta.maksKolom, this.dimuat ? this._lastCol() : 0); }
  getRange(a, b, c, d) {
    if (typeof a === 'string') return serba('RangeA1', { getA1Notation: () => a, getRow: () => 1, getColumn: () => 1 });
    return new Range(this, a, b, c || 1, d || 1);
  }
  getDataRange() {
    this.periksaDimuat();
    return new Range(this, 1, 1, Math.max(1, this._lastRow()), Math.max(1, this._lastCol()));
  }
  insertRowsAfter(setelah, n) {
    this.periksaDimuat();
    // Menyisipkan di antara baris kosong di bawah data tidak memindahkan apa pun.
    if (setelah < this._lastRow()) {
      const isi = [];
      for (let i = 0; i < n; i++) isi.push({ id: null, v: [], f: null, kotor: true });
      this.baris.splice(setelah, 0, ...isi);
      this.strukturBerubah = true;
    }
    this.meta.maksBaris += n;
    this.metaBerubah = true;
    this.tandaiUbah();
    return this;
  }
  insertRowsBefore(sebelum, n) { return this.insertRowsAfter(sebelum - 1, n); }
  insertRowAfter(r) { return this.insertRowsAfter(r, 1); }
  insertRowBefore(r) { return this.insertRowsAfter(r - 1, 1); }
  insertColumnsAfter(setelah, n) {
    this.periksaDimuat();
    this.baris.forEach((b) => {
      if (b.v.length > setelah) {
        b.v.splice(setelah, 0, ...new Array(n).fill(''));
        b.kotor = true;
      }
      if (b.f) {
        const f = {};
        Object.keys(b.f).forEach((c) => { f[+c > setelah ? +c + n : +c] = b.f[c]; });
        b.f = f;
      }
    });
    this.meta.maksKolom += n;
    this.metaBerubah = true;
    this.tandaiUbah();
    return this;
  }
  insertColumnBefore(c) { return this.insertColumnsAfter(c - 1, 1); }
  insertColumnAfter(c) { return this.insertColumnsAfter(c, 1); }
  deleteRow(r) {
    this.periksaDimuat();
    const b = this.baris[r - 1];
    if (b) {
      if (b.id != null) this.dihapusId.push(b.id);
      this.baris.splice(r - 1, 1);
      this.tandaiUbah();
    }
    return this;
  }
  deleteRows(r, n) { for (let i = 0; i < n; i++) this.deleteRow(r); return this; }
  getFrozenRows() { return this.meta.beku || 0; }
  setFrozenRows(n) { this.meta.beku = n; this.metaBerubah = true; this.tandaiUbah(); return this; }
  getFilter() { return this.meta.adaFilter ? serba('Filter') : null; }
  getProtections() { return this.meta.adaProteksi ? [serba('Protection', { getEditors: () => [], canDomainEdit: () => false })] : []; }
  protect() {
    if (!this.meta.adaProteksi) { this.meta.adaProteksi = true; this.metaBerubah = true; this.tandaiUbah(); }
    return serba('Protection', { getEditors: () => [], canDomainEdit: () => false });
  }
  getColumnGroupDepth() { return 0; }
  getConditionalFormatRules() { return []; }
  getCharts() { return []; }
  newChart() {
    const b = serba('ChartBuilder', { build: () => serba('Chart', { getOptions: () => ({ get: () => null }) }) });
    return b;
  }
}
['setTabColor', 'setColumnWidths', 'setColumnWidth', 'setRowHeight', 'setRowHeights', 'hideColumns', 'showColumns', 'hideRows',
  'showRows', 'activate', 'clearConditionalFormatRules', 'autoResizeColumns', 'setHiddenGridlines', 'setConditionalFormatRules',
  'insertChart', 'removeChart', 'updateChart', 'setColumnGroupControlPosition'].forEach((m) => {
  Sheet.prototype[m] = function () { return this; };
});
Sheet.prototype.getColumnGroup = function () { return serba('Group'); };

export class Range {
  constructor(sheet, r, c, nr, nc) {
    if (r < 1 || c < 1 || nr < 1 || nc < 1) throw new Error('Rentang tidak sah ' + [r, c, nr, nc]);
    Object.assign(this, { sheet, r, c, nr, nc });
  }
  getRow() { return this.r; }
  getColumn() { return this.c; }
  getLastRow() { return this.r + this.nr - 1; }
  getLastColumn() { return this.c + this.nc - 1; }
  getNumRows() { return this.nr; }
  getNumColumns() { return this.nc; }
  getSheet() { return this.sheet; }
  getA1Notation() { return this.sheet.nama + '!R' + this.r + 'C' + this.c + ':' + this.nr + 'x' + this.nc; }
  getValues() {
    this.sheet.periksaDimuat();
    const h = [];
    for (let i = 0; i < this.nr; i++) {
      const b = [];
      for (let j = 0; j < this.nc; j++) {
        const v = this.sheet.baca(this.r + i, this.c + j);
        b.push(v instanceof Date ? new this.sheet.ss.Date(v.getTime()) : v);
      }
      h.push(b);
    }
    return h;
  }
  getDisplayValues() { return this.getValues().map((b) => b.map((v) => String(v))); }
  getValue() { return this.getValues()[0][0]; }
  getDisplayValue() { return String(this.getValue()); }
  getFormulas() {
    this.sheet.periksaDimuat();
    const h = [];
    for (let i = 0; i < this.nr; i++) {
      const b = [];
      for (let j = 0; j < this.nc; j++) b.push(this.sheet.rumus(this.r + i, this.c + j));
      h.push(b);
    }
    return h;
  }
  getFormula() { return this.getFormulas()[0][0]; }
  setValues(v) {
    this.sheet.periksaDimuat();
    if (v.length !== this.nr || v.some((b) => b.length !== this.nc)) {
      throw new Error('setValues: ukuran ' + v.length + 'x' + (v[0] || []).length + ' tidak sama dengan rentang ' + this.nr + 'x' + this.nc);
    }
    v.forEach((b, i) => b.forEach((x, j) => this.sheet.tulis(this.r + i, this.c + j, x)));
    return this;
  }
  setValue(x) {
    this.sheet.periksaDimuat();
    for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sheet.tulis(this.r + i, this.c + j, x);
    return this;
  }
  setFormula(f) {
    this.sheet.periksaDimuat();
    this.sheet.tulisRumus(this.r, this.c, f);
    return this;
  }
  setFormulas(daftar) {
    this.sheet.periksaDimuat();
    daftar.forEach((b, i) => b.forEach((f, j) => this.sheet.tulisRumus(this.r + i, this.c + j, f)));
    return this;
  }
  clearContent() {
    this.sheet.periksaDimuat();
    for (let i = 0; i < this.nr; i++) {
      const b = this.sheet.baris[this.r + i - 1];
      if (!b) continue;
      for (let j = 0; j < this.nc; j++) {
        const c = this.c + j;
        if (b.v[c - 1] !== undefined && b.v[c - 1] !== '') { b.v[c - 1] = ''; b.kotor = true; }
        if (b.f && b.f[c]) { delete b.f[c]; b.kotor = true; }
      }
    }
    this.sheet.tandaiUbah();
    return this;
  }
  clear() { return this.clearContent(); }
  /**
   * Urutkan baris (objek barisnya ikut pindah, jadi id tetap). Jika rentangnya seluruh isi tab di bawah judul
   * (urutkanTabel_), aturannya disimpan di meta tab dan diterapkan lagi setiap tab dimuat, sehingga posisi di
   * database tidak perlu ditulis ulang. Rentang lain dipindah sungguhan.
   */
  sort(spek) {
    const sh = this.sheet;
    sh.periksaDimuat();
    const daftar = (Array.isArray(spek) ? spek : [spek]).map((s) => (typeof s === 'number' ? { column: s, ascending: true } : s))
      .map((s) => ({ column: s.column, ascending: s.ascending !== false }));
    const seluruh = this.r === 2 && this.c === 1 && this.r + this.nr - 1 >= sh._lastRow();
    if (seluruh) {
      if (JSON.stringify(sh.meta.urutan || null) !== JSON.stringify(daftar)) {
        sh.meta.urutan = daftar;
        sh.metaBerubah = true;
        sh.tandaiUbah();
      }
      urutkanBaris(sh.baris, daftar, 1);
      return this;
    }
    sh.pastikanBaris(this.r + this.nr - 1);
    const sebelum = sh.baris.slice(this.r - 1, this.r - 1 + this.nr);
    const potong = sebelum.slice();
    urutkanBaris(potong, daftar, 0);
    if (potong.some((b, i) => b !== sebelum[i])) {
      sh.baris.splice(this.r - 1, this.nr, ...potong);
      sh.strukturBerubah = true;
      sh.tandaiUbah();
    }
    return this;
  }
  createFilter() {
    this.sheet.meta.adaFilter = true;
    this.sheet.metaBerubah = true;
    this.sheet.tandaiUbah();
    return serba('Filter');
  }
  getDataValidation() { return null; }
  getDataValidations() { return []; }
  getBackgrounds() { return [[]]; }
}
['setNumberFormat', 'setNumberFormats', 'setDataValidation', 'setDataValidations', 'setFontWeight', 'setFontColor', 'setBackground',
  'setVerticalAlignment', 'setHorizontalAlignment', 'setWrap', 'setFontStyle', 'setFontSize', 'setBorder', 'merge', 'breakApart',
  'setNote', 'clearDataValidations', 'clearFormat', 'setBackgrounds', 'setFontColors', 'setFontWeights', 'setWrapStrategy',
  'setFontFamily', 'setTextRotation', 'shiftColumnGroupDepth', 'shiftRowGroupDepth', 'activate', 'setBold', 'insertCheckboxes',
  'removeCheckboxes', 'setShowHyperlink', 'setFontLine', 'setHorizontalAlignments', 'setTextStyle', 'setRichTextValue',
  'clearNote', 'setVerticalText'].forEach((m) => {
  Range.prototype[m] = function () { return this; };
});

/**
 * Spreadsheet tiruan. tabMeta: [{ nama, urutan, meta }], dataTab: { nama: [baris] } untuk tab yang sudah dimuat.
 * Date: kelas tanggal yang dipakai Code.gs (bisa digeser jamnya untuk uji).
 */
export class Spreadsheet {
  constructor(opsi) {
    this.Date = opsi.Date || Date;
    this.perluTab = new Set();
    this.diubah = new Set();
    this.dihapus = [];
    this.info = opsi.info || {};
    this.sheets = (opsi.tabMeta || []).slice().sort((a, b) => a.urutan - b.urutan)
      .map((t) => new Sheet(this, t.nama, t.meta, opsi.dataTab[t.nama] || null));
    this.zona = opsi.zona || 'Asia/Jakarta';
    this.zonaBerubah = false;
    this.urutanBerubah = false;
  }
  getId() { return 'supabase'; }
  getName() { return this.info.nama || 'InventoryKu'; }
  getUrl() { return this.info.alamatSheet || ''; }
  getSpreadsheetTimeZone() { return this.zona; }
  setSpreadsheetTimeZone(z) { this.zona = z; this.zonaBerubah = true; return this; }
  getSpreadsheetLocale() { return 'id_ID'; }
  getSheetByName(n) { return this.sheets.find((s) => s.nama === n) || null; }
  getSheets() { return this.sheets.slice(); }
  insertSheet(n) {
    if (this.getSheetByName(n)) throw new Error('Sheet sudah ada: ' + n);
    const s = new Sheet(this, n, null, []);
    s.baru = true;
    s.metaBerubah = true;
    this.sheets.push(s);
    this.urutanBerubah = true;
    this.diubah.add(s);
    return s;
  }
  deleteSheet(s) {
    this.sheets = this.sheets.filter((x) => x !== s);
    this.diubah.delete(s);
    if (!s.baru) this.dihapus.push(s.namaLama || s.nama);
    this.urutanBerubah = true;
  }
  getRange(a1) { return serba('RangeA1', { getA1Notation: () => a1 }); }
  setActiveSheet(s) { this.aktif = s; return s; }
  moveActiveSheet(i) {
    if (!this.aktif) return;
    this.sheets = this.sheets.filter((x) => x !== this.aktif);
    this.sheets.splice(i - 1, 0, this.aktif);
    this.urutanBerubah = true;
  }
  copy() { return this; }
  toast() { return this; }
}
