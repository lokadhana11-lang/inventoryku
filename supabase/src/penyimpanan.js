// InventoryKu di Supabase: membaca dan menulis tab tiruan di Postgres (skema inventoryku).
// Satu baris tab = satu baris tabel tab_baris (nilai jsonb). Tanggal disimpan { "$d": ms }.

export function kodeNilai(v) {
  if (v instanceof Date) return { $d: v.getTime() };
  if (typeof v === 'number' && !isFinite(v)) return null;
  return v === undefined ? '' : v;
}

export function uraiNilai(v) {
  if (v && typeof v === 'object' && Object.prototype.hasOwnProperty.call(v, '$d')) return new Date(v.$d);
  return v == null ? '' : v;
}

function kodeBaris(v) {
  const a = v.map(kodeNilai);
  while (a.length && (a[a.length - 1] === '' || a[a.length - 1] == null)) a.pop();
  return a;
}

export function buatPenyimpanan() {
  // Simpanan isi tab di isolate Edge Function, dipakai lagi selama versinya sama.
  const cacheTab = new Map();

  async function muatMeta(tx) {
    return tx`select nama, urutan, meta, versi from inventoryku.tab_meta order by urutan, nama`;
  }

  async function muatTab(tx, nama, versi) {
    const c = cacheTab.get(nama);
    if (c && c.versi === versi) return c.baris;
    const rows = await tx`select id, pos, nilai, rumus from inventoryku.tab_baris where tab = ${nama} order by pos, id`;
    const baris = rows.map((r) => ({ id: Number(r.id), pos: r.pos, v: (r.nilai || []).map(uraiNilai), f: r.rumus || null }));
    cacheTab.set(nama, { versi, baris });
    return baris;
  }

  async function muatProperti(tx) {
    const rows = await tx`select kunci, nilai from inventoryku.properti`;
    const o = {};
    rows.forEach((r) => { o[r.kunci] = r.nilai; });
    return o;
  }

  async function muatInfo(tx) {
    const rows = await tx`select kunci, nilai from inventoryku.info`;
    const o = {};
    rows.forEach((r) => { o[r.kunci] = r.nilai; });
    return o;
  }

  async function muatDrive(tx) {
    const folder = await tx`select jalur from inventoryku.folder`;
    const berkas = await tx`select id, jalur, nama, mime, ukuran, dibuat, dibuang from inventoryku.berkas`;
    return {
      folder: new Set(folder.map((f) => f.jalur)),
      folderBaru: new Set(),
      berkas: berkas.map((b) => ({ id: b.id, jalur: b.jalur, nama: b.nama, mime: b.mime, ukuran: b.ukuran,
        dibuat: b.dibuat ? new Date(b.dibuat).getTime() : Date.now(), dibuang: b.dibuang }))
    };
  }

  async function tabAksi(tx, aksi) {
    const rows = await tx`select tab from inventoryku.aksi_tab where aksi = ${aksi}`;
    return rows.map((r) => r.tab);
  }

  async function catatTabAksi(tx, aksi, tabs) {
    for (const t of tabs) {
      await tx`insert into inventoryku.aksi_tab (aksi, tab) values (${aksi}, ${t}) on conflict do nothing`;
    }
  }

  /** Menulis semua perubahan satu kali menjalankan Code.gs. unggah(jalur, bytes, mime) untuk isi berkas baru. */
  async function tulis(tx, k, unggah) {
    const { ss } = k;
    const berubah = new Set();
    for (const nama of ss.dihapus) {
      await tx`delete from inventoryku.tab_meta where nama = ${nama}`;
      cacheTab.delete(nama);
    }
    for (const sh of ss.diubah) {
      if (!ss.sheets.includes(sh)) continue;
      if (sh.baru) {
        await tx`insert into inventoryku.tab_meta (nama, urutan, meta, versi) values (${sh.nama}, ${ss.sheets.indexOf(sh) + 1},
          ${tx.json(sh.meta)}, 1)`;
      } else if (sh.namaLama && sh.namaLama !== sh.nama) {
        await tx`update inventoryku.tab_meta set nama = ${sh.nama} where nama = ${sh.namaLama}`;
        cacheTab.delete(sh.namaLama);
      }
      if (sh.metaBerubah && !sh.baru) {
        await tx`update inventoryku.tab_meta set meta = ${tx.json(sh.meta)} where nama = ${sh.nama}`;
      }
      const n = sh._lastRow();
      const isi = sh.baris.slice(0, n);
      const hapus = sh.dihapusId.concat(sh.baris.slice(n).filter((b) => b.id != null).map((b) => b.id));
      if (hapus.length) await tx`delete from inventoryku.tab_baris where id = any(${hapus})`;
      // Tab berurutan tetap (meta.urutan): urutan di memori dihitung ulang saat dimuat, jadi baris baru cukup
      // ditaruh di belakang. Tab lain: baris baru di tengah membuat semua posisi ditulis ulang.
      let adaLama = false;
      let baruDiTengah = false;
      if (!sh.meta.urutan) {
        for (let i = isi.length - 1; i >= 0; i--) {
          if (isi[i].id != null) adaLama = true;
          else if (adaLama) { baruDiTengah = true; break; }
        }
      }
      const nomorUlang = sh.strukturBerubah || baruDiTengah;
      const ubah = [];
      const tambah = [];
      if (nomorUlang) {
        isi.forEach((b, i) => {
          const pos = i + 1;
          const data = { pos, nilai: kodeBaris(b.v), rumus: b.f && Object.keys(b.f).length ? b.f : null };
          if (b.id == null) tambah.push(data);
          else if (b.kotor || b.pos !== pos) ubah.push(Object.assign({ id: b.id }, data));
        });
      } else {
        let maks = 0;
        isi.forEach((b) => { if (b.id != null && b.pos > maks) maks = b.pos; });
        isi.forEach((b) => {
          const data = { nilai: kodeBaris(b.v), rumus: b.f && Object.keys(b.f).length ? b.f : null };
          if (b.id == null) tambah.push(Object.assign({ pos: ++maks }, data));
          else if (b.kotor) ubah.push(Object.assign({ id: b.id, pos: b.pos }, data));
        });
      }
      // Posisi akhir tiap baris, untuk memperbarui salinan tab di memori sesudah ditulis.
      const posAkhir = new Map();
      if (nomorUlang) isi.forEach((b, i) => posAkhir.set(b, i + 1));
      else {
        isi.forEach((b) => { if (b.id != null) posAkhir.set(b, b.pos); });
        tambah.forEach((t, i) => posAkhir.set(isi.filter((b) => b.id == null)[i], t.pos));
      }
      if (ubah.length) {
        await tx`update inventoryku.tab_baris t set pos = x.pos, nilai = x.nilai, rumus = x.rumus,
            diubah = case when t.nilai is distinct from x.nilai then nextval('inventoryku.urut_ubah') else t.diubah end
          from jsonb_to_recordset(${tx.json(ubah)}) as x(id bigint, pos float8, nilai jsonb, rumus jsonb)
          where t.id = x.id`;
      }
      const idBaru = new Map();
      if (tambah.length) {
        const r = await tx`insert into inventoryku.tab_baris (tab, pos, nilai, rumus)
          select ${sh.nama}, x.pos, x.nilai, x.rumus
          from jsonb_to_recordset(${tx.json(tambah)}) as x(pos float8, nilai jsonb, rumus jsonb)
          returning id, pos`;
        r.forEach((x) => idBaru.set(x.pos, Number(x.id)));
      }
      cacheTab.delete(sh.nama);
      if (sh.baru || hapus.length || ubah.length || tambah.length || sh.metaBerubah || sh.namaLama) {
        const v = await tx`update inventoryku.tab_meta set versi = versi + 1, diubah = now() where nama = ${sh.nama} returning versi`;
        berubah.add(sh.nama);
        // Salinan di memori untuk versi baru (dipakai jika transaksi ini berhasil; jika gagal, versinya tidak pernah ada).
        const baris = isi.map((b) => {
          const pos = posAkhir.get(b);
          return { id: b.id != null ? b.id : idBaru.get(pos), pos, v: kodeBaris(b.v).map(uraiNilai), f: b.f && Object.keys(b.f).length ? Object.assign({}, b.f) : null };
        }).sort((a, b) => a.pos - b.pos || a.id - b.id);
        if (v.length && baris.every((b) => b.id != null)) cacheTab.set(sh.nama, { versi: Number(v[0].versi), baris });
      }
    }
    if (ss.urutanBerubah) {
      const urutan = ss.sheets.map((s, i) => ({ nama: s.nama, urutan: i + 1 }));
      await tx`update inventoryku.tab_meta t set urutan = x.urutan
        from jsonb_to_recordset(${tx.json(urutan)}) as x(nama text, urutan int) where t.nama = x.nama`;
    }
    if (ss.zonaBerubah) {
      await tx`insert into inventoryku.info (kunci, nilai) values ('zona', ${tx.json(ss.zona)})
        on conflict (kunci) do update set nilai = excluded.nilai`;
    }
    // Properti
    const lama = k.propsAwal;
    const baru = k.props;
    for (const n of Object.keys(lama)) {
      if (!Object.prototype.hasOwnProperty.call(baru, n)) await tx`delete from inventoryku.properti where kunci = ${n}`;
    }
    for (const n of Object.keys(baru)) {
      if (lama[n] !== baru[n]) {
        await tx`insert into inventoryku.properti (kunci, nilai) values (${n}, ${baru[n]})
          on conflict (kunci) do update set nilai = excluded.nilai`;
      }
    }
    // Drive
    if (k.drive) {
      for (const j of k.drive.folderBaru) await tx`insert into inventoryku.folder (jalur) values (${j}) on conflict do nothing`;
      for (const b of k.drive.berkas) {
        if (b.baru) {
          await unggah(b);
          await tx`insert into inventoryku.berkas (id, jalur, nama, mime, ukuran, dibuang)
            values (${b.id}, ${b.jalur}, ${b.nama}, ${b.mime}, ${b.ukuran}, ${!!b.dibuang})`;
        } else if (b.kotor) {
          await tx`update inventoryku.berkas set dibuang = ${!!b.dibuang} where id = ${b.id}`;
        }
      }
    }
    if (k.jadwal.berubah) {
      await tx`insert into inventoryku.info (kunci, nilai) values ('jadwal', ${tx.json(k.jadwal.daftar)})
        on conflict (kunci) do update set nilai = excluded.nilai`;
    }
    return berubah;
  }

  return { muatMeta, muatTab, muatProperti, muatInfo, muatDrive, tabAksi, catatTabAksi, tulis, cacheTab };
}
