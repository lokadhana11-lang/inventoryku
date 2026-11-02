// Jam uji yang tetap (butir 424). Semua uji memakai tanggal dan jam yang sama, apa pun hari uji dijalankan:
// data contoh 12 hari (seed.mjs) selalu berada di bulan yang sama, dan nama bulan di teks yang diperiksa tidak
// berubah. Diimpor paling awal oleh harness.mjs, jadi Date di Node (uji, seed, harness, Code.gs) sudah diganti
// sebelum isi berkas uji dijalankan. peramban.mjs memasang jam yang sama di Chromium dengan selisih yang sama.
//   UJI_JAM=2026-11-01T09:00:00+07:00 node uji/jalankan.mjs   uji pada tanggal lain (misalnya tanggal 1)
//   UJI_JAM=sekarang node uji/jalankan.mjs                     jam sebenarnya, seperti sebelum butir 424
// Tiap berkas uji adalah proses sendiri, jadi tiap berkas mulai tepat pada jam ini lalu berjalan seperti biasa.
export const JAM_AWAL = '2026-10-20T14:00:00+07:00'; // Selasa, pertengahan bulan

const pilihan = process.env.UJI_JAM || JAM_AWAL;
export const JAM_TETAP = pilihan !== 'sekarang';

/**
 * Mengganti Date dengan jam yang maju `selisih` ms dari jam sebenarnya. Timer tetap jam sebenarnya.
 * Dipakai di Node dan, lewat addInitScript, di setiap halaman Chromium (karena itu tanpa rujukan ke luar fungsi).
 */
function gantiDate(selisih) {
  const Asli = globalThis.Date;
  if (Asli.__ujiJam) return;
  class DateUji extends Asli {
    constructor(...a) {
      if (a.length === 0) super(Asli.now() + selisih);
      else super(...a);
    }
    static now() { return Asli.now() + selisih; }
    // Date bawaan (misalnya dari modul Node atau input tanggal) tetap dianggap Date.
    static [Symbol.hasInstance](x) { return x instanceof Asli; }
  }
  Object.defineProperty(DateUji, '__ujiJam', { value: true });
  // Date() tanpa new tetap mengembalikan teks, dengan jam uji.
  globalThis.Date = new Proxy(DateUji, { apply: () => new DateUji().toString() });
}

/** Selisih jam uji dari jam sebenarnya (ms); 0 dengan UJI_JAM=sekarang. */
export const SELISIH_MS = JAM_TETAP ? Date.parse(pilihan) - Date.now() : 0;
if (Number.isNaN(SELISIH_MS)) throw new Error('UJI_JAM tidak terbaca: ' + pilihan + ' (contoh: 2026-11-01T09:00:00+07:00)');
if (JAM_TETAP) gantiDate(SELISIH_MS);

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
/** Nama bulan dari tanggal 'yyyy-MM-dd' atau 'yyyy-MM': "Oktober". */
export function namaBulan(tanggal) { return BULAN[Number(String(tanggal).slice(5, 7)) - 1]; }

/**
 * Chromium dengan jam yang sama (dipanggil peramban.mjs untuk setiap konteks baru). Bukan ctx.clock: jam Playwright
 * dihitung dari Date.now() di Node, yang sudah diganti di atas, sehingga halaman tetap memakai jam sebenarnya.
 */
export async function pasangJamPeramban(ctx) {
  if (JAM_TETAP) await ctx.addInitScript(gantiDate, SELISIH_MS);
}
