// InventoryKu di Supabase: HTML laporan (htmlLaporan_ di Code.gs) menjadi PDF.
// Pengganti Utilities.newBlob(html).getAs('application/pdf') milik Google. Hanya mengenal bagian HTML
// yang dibuat Code.gs: div (kepala, kaki, halaman-baru), h1–h3, p, table (info, data, bawah) dengan
// colgroup/thead/tbody, tr/th/td (colspan), span, b, br, ul/li. Gaya diambil dari kelasnya, sama dengan
// CSS di htmlLaporan_. Huruf Helvetica bawaan PDF (pengganti Arial), A4 tegak.

const WARNA = {
  navy: '#0B1F3A', tinta: '#0F1B2D', redup: '#4A5A72', garis: '#C5CEDA', baja: '#F3F5F8', masalah: '#B42318',
  putih: '#FFFFFF'
};
const PX = 0.75; // 1 px CSS = 0,75 pt
const TEPI = 36; // margin halaman (pt)
const TINGGI_BARIS = 1.18;

// Huruf di luar Latin-1 yang dipakai laporan, dipetakan ke kode WinAnsi (lebar menurut Helvetica).
const WINANSI = {
  '–': ['\x96', 0.556], '—': ['\x97', 1], '…': ['\x85', 1], '•': ['\x95', 0.35],
  '‘': ['\x91', 0.222], '’': ['\x92', 0.222], '“': ['\x93', 0.333], '”': ['\x94', 0.333],
  '€': ['\x80', 0.556], '‰': ['\x89', 1]
};
const GANTI = { '−': '-', '→': '->', '←': '<-', '≥': '>=', '≤': '<=', ' ': ' ', ' ': ' ',
  ' ': ' ', '≈': '~' };

function amankanTeks(t) {
  let h = '';
  for (const c of t) {
    if (WINANSI[c]) h += WINANSI[c][0];
    else if (GANTI[c] != null) h += GANTI[c];
    else if (c.charCodeAt(0) < 256) h += c;
    else h += '?';
  }
  return h;
}

const LEBAR_KHUSUS = {};
Object.keys(WINANSI).forEach((k) => { LEBAR_KHUSUS[WINANSI[k][0]] = WINANSI[k][1]; });

/* ---------- Pengurai HTML kecil ---------- */

const KOSONG = new Set(['br', 'col', 'meta', 'img', 'hr', 'link']);

function uraiEntitas(t) {
  return t.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (m, e) => {
    const k = e.toLowerCase();
    if (k[0] === '#') return String.fromCodePoint(k[1] === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10));
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[k];
  });
}

function uraiAtribut(s) {
  const a = {};
  const pola = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let m;
  while ((m = pola.exec(s))) a[m[1].toLowerCase()] = uraiEntitas(m[3] != null ? m[3] : m[4] != null ? m[4] : m[5]);
  return a;
}

export function uraiHtml(html) {
  const akar = { tag: 'akar', kelas: [], attr: {}, anak: [] };
  const tumpuk = [akar];
  const pola = /<!--[\s\S]*?-->|<!DOCTYPE[^>]*>|<(\/?)([a-zA-Z0-9]+)([^>]*)>|([^<]+)/gi;
  let m;
  let lewati = null;
  while ((m = pola.exec(html))) {
    if (m[2]) {
      const tag = m[2].toLowerCase();
      if (lewati) {
        if (m[1] && tag === lewati) lewati = null;
        continue;
      }
      if (tag === 'style' || tag === 'script' || tag === 'title') {
        if (!m[1]) lewati = tag;
        continue;
      }
      if (m[1]) {
        for (let i = tumpuk.length - 1; i > 0; i--) {
          if (tumpuk[i].tag === tag) { tumpuk.length = i; break; }
        }
        continue;
      }
      const attr = uraiAtribut(m[3]);
      const node = { tag, attr, kelas: (attr.class || '').split(/\s+/).filter(Boolean), anak: [] };
      // tr/td/th/li yang tidak ditutup: tutup saudara sebelumnya.
      if (tag === 'tr' || tag === 'td' || tag === 'th' || tag === 'li') {
        const induk = tag === 'tr' ? ['table', 'thead', 'tbody'] : tag === 'li' ? ['ul', 'ol'] : ['tr'];
        for (let i = tumpuk.length - 1; i > 0; i--) {
          if (induk.indexOf(tumpuk[i].tag) >= 0) { tumpuk.length = i + 1; break; }
        }
      }
      tumpuk[tumpuk.length - 1].anak.push(node);
      if (!KOSONG.has(tag) && !/\/\s*$/.test(m[3])) tumpuk.push(node);
    } else if (m[4] != null && !lewati) {
      tumpuk[tumpuk.length - 1].anak.push({ teks: uraiEntitas(m[4]) });
    }
  }
  return akar;
}

function cari(node, tag) {
  if (node.tag === tag) return node;
  for (const a of node.anak || []) {
    const h = a.tag ? cari(a, tag) : null;
    if (h) return h;
  }
  return null;
}

/* ---------- Gaya ---------- */

const punya = (n, k) => n && n.kelas && n.kelas.indexOf(k) >= 0;

// Gaya teks (diwariskan) untuk satu elemen, mengikuti CSS htmlLaporan_.
function gayaElemen(n, g, konteks) {
  const h = Object.assign({}, g);
  if (punya(n, 'kepala') || punya(n, 'kaki') || punya(n, 'catatan')) { h.warna = WARNA.redup; h.ukuran = 8; }
  if (n.tag === 'h1') Object.assign(h, { ukuran: 15, tebal: true, warna: WARNA.navy });
  if (n.tag === 'h2') Object.assign(h, { ukuran: 11, tebal: true, warna: WARNA.navy });
  if (n.tag === 'h3') Object.assign(h, { ukuran: 9, tebal: true, warna: WARNA.tinta });
  if (n.tag === 'b' || n.tag === 'strong') h.tebal = true;
  if (n.tag === 'th') Object.assign(h, { tebal: true, warna: WARNA.putih, ukuran: 8, rata: 'center' });
  if (n.tag === 'td') {
    if (konteks === 'info' && punya(n, 'label')) h.warna = WARNA.redup;
    if (konteks === 'info' && punya(n, 'nilai')) h.tebal = true;
    if (konteks === 'bawah' && punya(n, 'label')) h.warna = WARNA.redup;
    if (punya(n, 'angka')) h.rata = 'right';
    if (punya(n, 'tengah')) h.rata = 'center';
    if (punya(n, 'akhir')) h.tebal = true;
  }
  if (punya(n, 'masalah')) { h.warna = WARNA.masalah; h.tebal = true; }
  if (punya(n, 'kecil')) { h.ukuran = 7; h.warna = WARNA.redup; }
  return h;
}

// Isi sebaris (inline) menjadi daftar potongan { teks, gaya } dan { br: true }.
function potonganInline(node, g, konteks, hasil) {
  for (const a of node.anak) {
    if (a.teks != null) {
      const t = a.teks.replace(/\s+/g, ' ');
      if (t) hasil.push({ teks: t, gaya: g });
    } else if (a.tag === 'br') {
      hasil.push({ br: true });
    } else if (a.tag === 'li') {
      if (hasil.length) hasil.push({ br: true });
      hasil.push({ teks: '• ', gaya: g });
      potonganInline(a, gayaElemen(a, g, konteks), konteks, hasil);
    } else {
      potonganInline(a, gayaElemen(a, g, konteks), konteks, hasil);
    }
  }
  return hasil;
}

/* ---------- Penata halaman ---------- */

export function buatHtmlKePdf(jsPDF) {
  return function htmlKePdf(html) {
    const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait', compress: true });
    const lebarHal = doc.internal.pageSize.getWidth();
    const tinggiHal = doc.internal.pageSize.getHeight();
    const lebarIsi = lebarHal - 2 * TEPI;
    const bawahHal = tinggiHal - TEPI;
    let y = TEPI;
    let halamanKosong = true;

    function pasangHuruf(g) {
      doc.setFont('helvetica', g.tebal ? 'bold' : 'normal');
      doc.setFontSize(g.ukuran);
    }
    function lebarTeks(t, g) {
      pasangHuruf(g);
      let biasa = '';
      let khusus = 0;
      for (const c of t) {
        if (LEBAR_KHUSUS[c] != null) khusus += LEBAR_KHUSUS[c];
        else biasa += c;
      }
      return (doc.getStringUnitWidth(biasa) + khusus) * g.ukuran;
    }
    function halamanBaru() {
      doc.addPage();
      y = TEPI;
      halamanKosong = true;
    }
    function pastikanRuang(t) {
      if (y + t > bawahHal && !halamanKosong) halamanBaru();
    }

    // Membungkus potongan menjadi baris: [{ isi: [{ teks, gaya, lebar }], lebar, tinggi, naik }].
    function bungkus(potongan, lebar) {
      const baris = [];
      let kini = { isi: [], lebar: 0 };
      const tutup = () => {
        while (kini.isi.length && /^\s+$/.test(kini.isi[kini.isi.length - 1].teks)) {
          kini.lebar -= kini.isi.pop().lebar;
        }
        const uk = kini.isi.length ? Math.max(...kini.isi.map((p) => p.gaya.ukuran)) : (kini.ukuranKosong || 9);
        kini.tinggi = uk * TINGGI_BARIS;
        kini.naik = uk;
        baris.push(kini);
        kini = { isi: [], lebar: 0 };
      };
      const tambah = (teks, gaya) => {
        const w = lebarTeks(teks, gaya);
        const akhir = kini.isi[kini.isi.length - 1];
        if (akhir && akhir.gaya === gaya) { akhir.teks += teks; akhir.lebar += w; } else kini.isi.push({ teks, gaya, lebar: w });
        kini.lebar += w;
      };
      for (const p of potongan) {
        if (p.br) {
          kini.ukuranKosong = kini.ukuranKosong || 9;
          tutup();
          continue;
        }
        const teks = amankanTeks(p.teks);
        for (const kata of teks.split(/(\s+)/)) {
          if (!kata) continue;
          if (/^\s+$/.test(kata)) {
            if (kini.isi.length) tambah(' ', p.gaya);
            continue;
          }
          let w = lebarTeks(kata, p.gaya);
          if (kini.lebar + w > lebar + 0.01 && kini.isi.length) tutup();
          if (w > lebar) {
            // Kata lebih panjang dari kolom: dipotong per huruf.
            let sisa = kata;
            while (sisa) {
              let n = 1;
              while (n < sisa.length && lebarTeks(sisa.slice(0, n + 1), p.gaya) <= lebar - kini.lebar) n++;
              tambah(sisa.slice(0, n), p.gaya);
              sisa = sisa.slice(n);
              if (sisa) tutup();
            }
            continue;
          }
          tambah(kata, p.gaya);
          w = 0;
        }
      }
      if (kini.isi.length || !baris.length) tutup();
      return baris;
    }

    function tinggiBaris(baris) {
      return baris.reduce((s, b) => s + b.tinggi, 0);
    }

    function gambarBaris(baris, x, yAtas, lebar, rata) {
      let yy = yAtas;
      for (const b of baris) {
        let xx = x;
        if (rata === 'right') xx = x + lebar - b.lebar;
        else if (rata === 'center') xx = x + (lebar - b.lebar) / 2;
        const garisDasar = yy + b.naik * 0.92;
        for (const p of b.isi) {
          pasangHuruf(p.gaya);
          doc.setTextColor(p.gaya.warna);
          doc.text(p.teks, xx, garisDasar);
          xx += p.lebar;
        }
        yy += b.tinggi;
      }
    }

    function paragraf(node, g, opsi) {
      const o = opsi || {};
      const potongan = potonganInline(node, g, '', []);
      if (!potongan.some((p) => p.teks && p.teks.trim())) return;
      const baris = bungkus(potongan, lebarIsi);
      const t = tinggiBaris(baris);
      y += o.atas || 0;
      if (o.garisAtas) {
        pastikanRuang(t + o.garisAtas.jarak);
        doc.setDrawColor(o.garisAtas.warna);
        doc.setLineWidth(o.garisAtas.tebal);
        doc.line(TEPI, y, TEPI + lebarIsi, y);
        y += o.garisAtas.jarak;
      }
      // Paragraf panjang boleh terbelah antarhalaman, per baris.
      for (const b of baris) {
        pastikanRuang(b.tinggi);
        gambarBaris([b], TEPI, y, lebarIsi, g.rata);
        y += b.tinggi;
      }
      if (o.garisBawah) {
        y += o.garisBawah.jarak;
        doc.setDrawColor(o.garisBawah.warna);
        doc.setLineWidth(o.garisBawah.tebal);
        doc.line(TEPI, y, TEPI + lebarIsi, y);
      }
      y += o.bawah || 0;
      halamanKosong = false;
    }

    function lebarKolom(tabel, jumlah) {
      const lebar = [];
      const cg = (tabel.anak || []).find((a) => a.tag === 'colgroup');
      const persen = (s) => {
        const m = /width\s*:\s*([\d.]+)%/.exec(s || '');
        return m ? Number(m[1]) : null;
      };
      if (cg) {
        for (const c of cg.anak) {
          if (c.tag !== 'col') continue;
          const n = Number(c.attr.span || 1);
          for (let i = 0; i < n; i++) lebar.push(persen(c.attr.style));
        }
      } else {
        const tr = cari(tabel, 'tr');
        if (tr) {
          for (const c of tr.anak) {
            if (c.tag !== 'th' && c.tag !== 'td') continue;
            const n = Number(c.attr.colspan || 1);
            for (let i = 0; i < n; i++) lebar.push(n === 1 ? persen(c.attr.style) : null);
          }
        }
      }
      while (lebar.length < jumlah) lebar.push(null);
      lebar.length = jumlah;
      const diketahui = lebar.filter((w) => w != null).reduce((s, w) => s + w, 0);
      const kosong = lebar.filter((w) => w == null).length;
      const sisa = kosong ? Math.max(0, 100 - diketahui) / kosong : 0;
      const isi = lebar.map((w) => (w == null ? sisa : w));
      const total = isi.reduce((s, w) => s + w, 0) || 1;
      return isi.map((w) => (w / total) * lebarIsi);
    }

    function barisTabel(tabel) {
      const hasil = [];
      const jalan = (n, bagian) => {
        for (const a of n.anak || []) {
          if (a.tag === 'tr') hasil.push({ tr: a, kepala: bagian === 'thead' || a.anak.every((c) => !c.tag || c.tag === 'th') });
          else if (a.tag === 'thead' || a.tag === 'tbody' || a.tag === 'tfoot') jalan(a, a.tag);
        }
      };
      jalan(tabel, '');
      return hasil;
    }

    // Tabel data: lebar penuh, bergaris, judul kolom diulang di halaman baru.
    function tabelData(tabel, g) {
      const daftar = barisTabel(tabel);
      if (!daftar.length) return;
      const jumlah = Math.max(...daftar.map((r) => r.tr.anak.filter((c) => c.tag === 'td' || c.tag === 'th')
        .reduce((s, c) => s + Number(c.attr.colspan || 1), 0)));
      const lebar = lebarKolom(tabel, jumlah);
      const siap = daftar.map((r) => {
        const gayaTr = gayaTrData(r.tr, g);
        let kol = 0;
        const sel = [];
        for (const c of r.tr.anak) {
          if (c.tag !== 'td' && c.tag !== 'th') continue;
          const n = Number(c.attr.colspan || 1);
          const w = lebar.slice(kol, kol + n).reduce((s, x) => s + x, 0);
          const gs = gayaElemen(c, gayaTr.gaya, 'data');
          if (gayaTr.rata && !punya(c, 'angka') && !punya(c, 'tengah')) gs.rata = gayaTr.rata;
          const pad = c.tag === 'th' ? { v: 4 * PX, h: 3 * PX } : { v: 3 * PX, h: 3 * PX };
          if (c.tag === 'th') {
            // Judul kolom sempit ("Penyesuaian"): huruf diperkecil supaya kata tidak terpotong.
            const kata = amankanTeks(teksNode(c)).split(/\s+/).filter(Boolean);
            while (gs.ukuran > 6 && kata.some((k) => lebarTeks(k, gs) > w - 2 * pad.h)) gs.ukuran -= 0.5;
          }
          const baris = bungkus(potonganInline(c, gs, 'data', []), Math.max(4, w - 2 * pad.h));
          sel.push({ x: kol, w, baris, gaya: gs, pad, latar: c.tag === 'th' ? WARNA.navy : gayaTr.latar });
          kol += n;
        }
        const tinggi = Math.max(...sel.map((s) => tinggiBaris(s.baris) + 2 * s.pad.v), 8);
        return { sel, tinggi, kepala: r.kepala };
      });
      const kepala = [];
      for (const r of siap) { if (r.kepala) kepala.push(r); else break; }
      const tinggiKepala = kepala.reduce((s, r) => s + r.tinggi, 0);
      const gambarRow = (r) => {
        for (const s of r.sel) {
          const x = TEPI + lebar.slice(0, s.x).reduce((a, b) => a + b, 0);
          if (s.latar) {
            doc.setFillColor(s.latar);
            doc.rect(x, y, s.w, r.tinggi, 'F');
          }
          doc.setDrawColor(WARNA.garis);
          doc.setLineWidth(0.75);
          doc.rect(x, y, s.w, r.tinggi, 'S');
          gambarBaris(s.baris, x + s.pad.h, y + s.pad.v, s.w - 2 * s.pad.h, s.gaya.rata);
        }
        y += r.tinggi;
      };
      siap.forEach((r, i) => {
        // Judul kolom tidak boleh sendirian di bawah halaman: di awal tabel, judul dan baris isi pertama harus muat.
        const butuh = i === 0 && r.kepala
          ? tinggiKepala + (siap[kepala.length] ? siap[kepala.length].tinggi : 0)
          : r.kepala ? 0 : r.tinggi;
        if (y + butuh > bawahHal && !halamanKosong) {
          halamanBaru();
          if (!r.kepala) kepala.forEach(gambarRow);
        }
        gambarRow(r);
        halamanKosong = false;
      });
    }

    function gayaTrData(tr, g) {
      const h = { gaya: Object.assign({}, g), latar: null, rata: null };
      if (punya(tr, 'kategori')) { h.latar = WARNA.baja; h.gaya.tebal = true; h.gaya.warna = WARNA.tinta; h.rata = 'left'; }
      if (punya(tr, 'total')) { h.latar = WARNA.baja; h.gaya.tebal = true; }
      if (punya(tr, 'cek-ulang')) { h.gaya.warna = WARNA.redup; h.gaya.ukuran = 8; }
      return h;
    }

    // Tabel info dan bawah: dua kolom tanpa garis, kolom pertama selebar label terpanjang.
    function tabelPolos(tabel, g, jenis) {
      const daftar = barisTabel(tabel).map((r) => r.tr.anak.filter((c) => c.tag === 'td' || c.tag === 'th'));
      if (!daftar.length) return;
      const padKanan = 14 * PX;
      const padV = 2 * PX;
      const lebarLabel = Math.min(lebarIsi * 0.45, Math.max(...daftar.map((sel) => {
        if (!sel[0]) return 0;
        const gs = gayaElemen(sel[0], g, jenis);
        return lebarTeks(amankanTeks(teksNode(sel[0])), gs);
      })) + padKanan);
      for (const sel of daftar) {
        const kiri = sel[0] ? bungkus(potonganInline(sel[0], gayaElemen(sel[0], g, jenis), jenis, []), lebarLabel - padKanan) : [];
        const kanan = sel[1] ? bungkus(potonganInline(sel[1], gayaElemen(sel[1], g, jenis), jenis, []), lebarIsi - lebarLabel) : [];
        const t = Math.max(tinggiBaris(kiri), tinggiBaris(kanan)) + 2 * padV;
        pastikanRuang(t);
        gambarBaris(kiri, TEPI, y + padV, lebarLabel - padKanan, 'left');
        gambarBaris(kanan, TEPI + lebarLabel, y + padV, lebarIsi - lebarLabel, 'left');
        y += t;
        halamanKosong = false;
      }
    }

    function teksNode(n) {
      if (n.teks != null) return n.teks.replace(/\s+/g, ' ');
      return (n.anak || []).map(teksNode).join('');
    }

    function blok(node, g) {
      for (const a of node.anak) {
        if (a.teks != null) {
          if (a.teks.trim()) paragraf({ anak: [a] }, g);
          continue;
        }
        const ga = gayaElemen(a, g, '');
        switch (a.tag) {
          case 'html': case 'body': case 'akar': case 'section':
            blok(a, ga);
            break;
          case 'head':
            break;
          case 'div':
            if (punya(a, 'halaman-baru') && !halamanKosong) halamanBaru();
            if (punya(a, 'kepala')) paragraf(a, ga, { bawah: 6 * PX });
            else if (punya(a, 'kaki')) paragraf(a, ga, { atas: 14 * PX, garisAtas: { warna: WARNA.garis, tebal: 0.75, jarak: 4 * PX } });
            else if (a.anak.some((c) => c.tag && /^(div|h[1-6]|p|table|ul|ol)$/.test(c.tag))) blok(a, ga);
            else paragraf(a, ga);
            break;
          case 'h1':
            pastikanRuang(60);
            paragraf(a, ga, { bawah: 8 * PX, garisBawah: { warna: WARNA.navy, tebal: 1.5, jarak: 3 * PX } });
            break;
          case 'h2':
            pastikanRuang(70);
            paragraf(a, ga, { atas: halamanKosong ? 0 : 16 * PX, bawah: 4 * PX });
            break;
          case 'h3':
            pastikanRuang(50);
            paragraf(a, ga, { atas: halamanKosong ? 0 : 10 * PX, bawah: 4 * PX });
            break;
          case 'p':
            paragraf(a, ga, punya(a, 'catatan') ? { atas: 6 * PX } : { bawah: 4 * PX });
            break;
          case 'ul': case 'ol':
            paragraf(a, ga, { bawah: 4 * PX });
            break;
          case 'table':
            if (punya(a, 'data')) {
              tabelData(a, ga);
            } else {
              const jenis = punya(a, 'bawah') ? 'bawah' : 'info';
              if (jenis === 'bawah') y += 12 * PX;
              tabelPolos(a, ga, jenis);
              if (jenis === 'info') y += 10 * PX;
            }
            break;
          default:
            paragraf(a, ga);
        }
      }
    }

    blok(uraiHtml(html), { ukuran: 9, tebal: false, warna: WARNA.tinta, rata: 'left' });
    return new Uint8Array(doc.output('arraybuffer'));
  };
}
