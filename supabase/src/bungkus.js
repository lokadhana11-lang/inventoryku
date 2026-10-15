// InventoryKu di Supabase: membungkus isi Code.gs menjadi fungsi pembuat, supaya setiap aksi
// berjalan dengan variabel global yang baru (seperti satu eksekusi Apps Script) dan memakai
// layanan pengganti (layanan.js). Dipakai rakit.mjs (Edge Function) dan uji di Node.

export const NAMA_LAYANAN = ['SpreadsheetApp', 'DriveApp', 'MailApp', 'Utilities', 'ScriptApp', 'Session', 'PropertiesService',
  'CacheService', 'LockService', 'ContentService', 'Charts', 'console', 'Date', 'DI_SUPABASE', 'SUPABASE_'];

/** Isi fungsi buatKodeGs(G): Code.gs utuh, lalu objek berisi semua fungsi tingkat atasnya. */
export function bungkusKodeGs(teks) {
  const fungsi = [...teks.matchAll(/^function\s+([A-Za-z_$][\w$]*)\s*\(/gm)].map((m) => m[1]);
  return 'var ' + NAMA_LAYANAN.map((n) => n + ' = G.' + n).join(', ') + ';\n' +
    teks + '\n' +
    'return { ' + fungsi.join(', ') + ', __ambil: function (n) { return eval(n); } };\n';
}
