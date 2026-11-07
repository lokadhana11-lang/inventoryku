// Uji server: tempelMenu, banyak menu sekaligus dari tempelan Excel/Google Sheets (Code.gs v0.47, butir 482–483).
import * as H from '../alat/harness.mjs';
import { seed } from '../alat/seed.mjs';
let gagal = 0, lulus = 0;
const cek = (k, label, x) => { if (k) lulus++; else { gagal++; console.log('GAGAL:', label, x !== undefined ? JSON.stringify(x).slice(0, 600) : ''); } };
const s = seed();
const T = s.token;
const TR = H.aksi({ action: 'login', nama: 'Rina', pin: '730264' }).data.token;
const A = (action, b, tok = T) => H.aksi(Object.assign({ action, token: tok }, b));
const menu = (d, nama) => d.menu.find((m) => m.nama === nama);
const bahanDi = (nama) => H.ss.getSheetByName('M_MenuBahan').getDataRange().getValues().filter((x) => x[0] === nama).map((x) => x[1] + ' ' + x[2] + ' ' + x[3]);
const logMenu = () => H.ss.getSheetByName('Log_Perubahan').getDataRange().getValues().filter((r) => r.includes('M_Menu'));

// 1. Bentuk awal
{
  const d = A('daftarMenu', {}).data;
  cek(d.tempelSiap === true, 'daftarMenu.tempelSiap', d.tempelSiap);
}

// 2. Menu baru dan menu yang diganti
{
  const kirim = [
    { no: 2, ganti: false, nama: 'Nasi telur', hargaJual: 12000, bahan: [{ item: 'Telur', qty: 1 }, { item: 'Nasi putih', qty: 1 }] },
    { no: 4, ganti: false, nama: 'Ayam goreng', hargaJual: '25000', bahan: [{ item: 'Ayam fillet', qty: 0.15, hasilBersih: 90 }, { item: 'Minyak goreng', qty: 0.05, hasilBersih: '' }] },
    { no: 6, ganti: true, nama: 'ayam geprek', hargaJual: '', bahan: [{ item: 'Ayam fillet', qty: 0.2, hasilBersih: 85 }, { item: 'Sambal dasar', qty: 0.05 }] },
    { no: 8, ganti: true, nama: 'Telur balado', hargaJual: 16000, bahan: [{ item: 'Telur', qty: 2 }, { item: 'Sambal dasar', qty: 0.05 }, { item: 'Nasi putih', qty: 1 }] }
  ];
  let r = A('tempelMenu', { menu: kirim }, TR);
  cek(!r.ok, 'Staff tidak bisa tempelMenu');
  const logSebelum = logMenu().length;
  r = A('tempelMenu', { menu: kirim });
  cek(r.ok && JSON.stringify(r.data.tempel) === '{"baru":["Nasi telur","Ayam goreng"],"diganti":["Ayam geprek","Telur balado"]}', 'jawaban tempel', r.ok ? r.data.tempel : r.pesan);
  const d = r.data;
  const nt = menu(d, 'Nasi telur');
  cek(nt && nt.aktif && nt.hargaJual === 12000 && nt.bahan.length === 2, 'menu baru aktif dengan harga dan bahan', nt);
  cek(JSON.stringify(bahanDi('Ayam goreng')) === '["Ayam fillet 0.15 90","Minyak goreng 0.05 100"]', 'bahan dan hasil bersih (kosong = 100)', bahanDi('Ayam goreng'));
  const ag = menu(d, 'Ayam geprek');
  cek(ag && ag.hargaJual === 28000 && JSON.stringify(bahanDi('Ayam geprek')) === '["Ayam fillet 0.2 85","Sambal dasar 0.05 100"]', 'menu diganti: harga kosong tetap, bahan baru', [ag && ag.hargaJual, bahanDi('Ayam geprek')]);
  cek(!menu(d, 'ayam geprek'), 'nama menu lama tetap (huruf besar/kecil tempelan tidak mengganti nama)');
  cek(menu(d, 'Telur balado').hargaJual === 16000, 'harga jual diganti');
  const log = logMenu().slice(logSebelum);
  cek(log.length === 1 && log[0].includes('Telur balado') && log[0].map(String).includes('15000') && log[0].map(String).includes('16000'), 'perubahan harga tercatat di Log_Perubahan', log);
}

// 3. Menu nonaktif yang diganti tetap nonaktif
{
  A('aturMenuAktif', { nama: 'Nasi telur', aktif: false });
  const r = A('tempelMenu', { menu: [{ no: 2, ganti: true, nama: 'Nasi telur', hargaJual: '', bahan: [{ item: 'Telur', qty: 2 }] }] });
  cek(r.ok && menu(r.data, 'Nasi telur').aktif === false && menu(r.data, 'Nasi telur').hargaJual === 12000, 'menu nonaktif diganti tetap nonaktif', r.ok ? menu(r.data, 'Nasi telur') : r.pesan);
}

// 4. Penolakan: satu menu salah menolak semuanya
{
  const baik = { no: 2, ganti: false, nama: 'Telur ceplok', hargaJual: 5000, bahan: [{ item: 'Telur', qty: 1 }] };
  const ada = () => !!menu(A('daftarMenu', {}).data, 'Telur ceplok');
  let r = A('tempelMenu', { menu: [baik, { no: 5, ganti: false, nama: 'Mi goreng', hargaJual: 15000, bahan: [{ item: 'Mi', qty: 1 }] }] });
  cek(!r.ok && /^Menu Mi goreng \(baris 5\): Bahan Mi tidak ada/.test(r.pesan) && !ada(), 'bahan tidak ada: semua ditolak dengan nomor baris', r.pesan);
  r = A('tempelMenu', { menu: [{ no: 3, ganti: false, nama: 'Sup', hargaJual: '', bahan: [{ item: 'Tomat', qty: 0.1 }] }] });
  cek(!r.ok && /Menu Sup \(baris 3\): isi harga jual/.test(r.pesan), 'menu baru tanpa harga ditolak', r.pesan);
  r = A('tempelMenu', { menu: [baik, Object.assign({}, baik, { no: 9, nama: 'telur ceplok' })] });
  cek(!r.ok && /baris 9.*tertulis dua kali di tempelan/.test(r.pesan) && !ada(), 'menu dua kali ditolak', r.pesan);
  r = A('tempelMenu', { menu: [{ no: 3, ganti: false, nama: 'Ayam geprek', hargaJual: 30000, bahan: [{ item: 'Telur', qty: 1 }] }] });
  cek(!r.ok && /ternyata sudah ada/.test(r.pesan) && menu(A('daftarMenu', {}).data, 'Ayam geprek').hargaJual === 28000, 'menu yang sudah ada tanpa ganti ditolak', r.pesan);
  r = A('tempelMenu', { menu: [Object.assign({}, baik, { bahan: [{ item: 'Telur', qty: 1, hasilBersih: 120 }] })] });
  cek(!r.ok && /Hasil bersih Telur/.test(r.pesan), 'hasil bersih di atas 100 ditolak', r.pesan);
  r = A('tempelMenu', { menu: [Object.assign({}, baik, { hargaJual: 0 })] });
  cek(!r.ok && /Harga jual harus lebih dari 0/.test(r.pesan), 'harga 0 ditolak', r.pesan);
  r = A('tempelMenu', { menu: [Object.assign({}, baik, { bahan: [{ item: 'Telur', qty: 1 }, { item: 'telur', qty: 2 }] })] });
  cek(!r.ok && /tertulis dua kali/.test(r.pesan), 'bahan dua kali ditolak', r.pesan);
  r = A('tempelMenu', { menu: Array.from({ length: 51 }, (_, i) => Object.assign({}, baik, { no: i + 1, nama: 'Menu ' + i })) });
  cek(!r.ok && /Paling banyak 50 menu/.test(r.pesan), 'lebih dari 50 menu ditolak', r.pesan);
  r = A('tempelMenu', { menu: [] });
  cek(!r.ok && /Tidak ada menu/.test(r.pesan), 'tempelan kosong ditolak', r.pesan);
  r = A('tempelMenu', { menu: [baik] });
  cek(r.ok && menu(r.data, 'Telur ceplok').hargaJual === 5000, 'sesudah dibetulkan: tersimpan');
}

// 5. simpanMenu tetap sama sesudah dipecah (periksaIsianMenu_)
{
  let r = A('simpanMenu', { baru: true, nama: 'Teh manis', hargaJual: '', bahan: [{ item: 'Air mineral', qty: 1 }] });
  cek(!r.ok && r.pesan === 'Isi harga jual.', 'simpanMenu tanpa harga ditolak', r.pesan);
  r = A('simpanMenu', { baru: true, nama: 'Teh manis', hargaJual: 5000, bahan: [{ item: 'Air mineral', qty: 1 }] });
  cek(r.ok && menu(r.data, 'Teh manis').hargaJual === 5000, 'simpanMenu tetap jalan', r.pesan);
}

console.log('lulus', lulus, 'gagal', gagal);
