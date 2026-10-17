// InventoryKu di Supabase: notifikasi ke HP (Web Push, RFC 8030/8291/8292) tanpa library.
// - Kunci VAPID (ECDSA P-256) dibuat sekali dan disimpan di tabel inventoryku.info (kunci 'vapid'),
//   jadi pemilik tidak perlu memasang secret. Kunci publiknya dipakai HP saat berlangganan.
// - Isi notifikasi dienkripsi aes128gcm untuk kunci HP (p256dh, auth), lalu dikirim ke alamat
//   layanan push HP itu (Google, Apple, Mozilla) dengan tanda tangan VAPID (JWT ES256).
// Hanya WebCrypto (crypto.subtle), yang tersedia di Deno (Edge Function) dan Node.

const teks = new TextEncoder();

function b64url(bytes) {
  let s = '';
  const b = new Uint8Array(bytes);
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function dariB64url(s) {
  const t = String(s).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
  const hasil = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) hasil[i] = bin.charCodeAt(i);
  return hasil;
}

function gabung(...bagian) {
  const n = bagian.reduce((a, b) => a + b.length, 0);
  const hasil = new Uint8Array(n);
  let i = 0;
  for (const b of bagian) {
    hasil.set(b, i);
    i += b.length;
  }
  return hasil;
}

/**
 * o: { sql, subtle (crypto.subtle), fetch, kontak (https:// atau mailto: untuk klaim sub VAPID), Date }
 * → { kunciPublik(), kirim(langganan, isi) → status HTTP, kirimSemua([{ langganan, isi }]) → { hilang: [endpoint] } }
 */
export function buatPush(o) {
  const subtle = o.subtle || globalThis.crypto.subtle;
  const ambil = o.fetch || fetch;
  const KelasDate = o.Date || Date;
  let kunci = null; // { publik (b64url, 65 byte), privat (CryptoKey ECDSA) }
  const jwtSimpan = new Map(); // aud → { jwt, sampai }

  async function hmac(kunciMentah, data) {
    const k = await subtle.importKey('raw', kunciMentah, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return new Uint8Array(await subtle.sign('HMAC', k, data));
  }

  /** Kunci VAPID dari tabel info; dibuat sekali jika belum ada. */
  async function muatKunci() {
    if (kunci) return kunci;
    let r = await o.sql`select nilai from inventoryku.info where kunci = 'vapid'`;
    if (!r.length) {
      const pasangan = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
      const publik = b64url(await subtle.exportKey('raw', pasangan.publicKey));
      const privat = await subtle.exportKey('jwk', pasangan.privateKey);
      await o.sql`insert into inventoryku.info (kunci, nilai) values ('vapid', ${o.sql.json({ publik, privat })})
        on conflict (kunci) do nothing`;
      r = await o.sql`select nilai from inventoryku.info where kunci = 'vapid'`;
    }
    const v = r[0].nilai;
    const privat = await subtle.importKey('jwk', v.privat, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    kunci = { publik: v.publik, privat };
    return kunci;
  }

  async function kunciPublik() {
    return (await muatKunci()).publik;
  }

  /** JWT VAPID untuk satu layanan push (aud = origin alamatnya), berlaku 12 jam, disimpan 1 jam. */
  async function jwtUntuk(aud) {
    const kini = Math.floor(new KelasDate().getTime() / 1000);
    const ada = jwtSimpan.get(aud);
    if (ada && ada.sampai > kini + 3600) return ada.jwt;
    const k = await muatKunci();
    const kepala = b64url(teks.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
    const sampai = kini + 12 * 3600;
    const isi = b64url(teks.encode(JSON.stringify({ aud, exp: sampai, sub: o.kontak })));
    const tanda = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, k.privat, teks.encode(kepala + '.' + isi));
    const jwt = kepala + '.' + isi + '.' + b64url(tanda);
    jwtSimpan.set(aud, { jwt, sampai });
    return jwt;
  }

  /** Isi terenkripsi aes128gcm (RFC 8291) untuk kunci HP. */
  async function enkripsi(p256dh, auth, data) {
    const uaPublik = dariB64url(p256dh);
    const rahasiaAuth = dariB64url(auth);
    const lokal = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const asPublik = new Uint8Array(await subtle.exportKey('raw', lokal.publicKey));
    const uaKunci = await subtle.importKey('raw', uaPublik, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const ecdh = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: uaKunci }, lokal.privateKey, 256));
    const prkKunci = await hmac(rahasiaAuth, ecdh);
    const ikm = await hmac(prkKunci, gabung(teks.encode('WebPush: info\0'), uaPublik, asPublik, new Uint8Array([1])));
    const garam = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const prk = await hmac(garam, ikm);
    const cek = (await hmac(prk, gabung(teks.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
    const nonce = (await hmac(prk, gabung(teks.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
    const aes = await subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
    const sandi = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, gabung(data, new Uint8Array([2]))));
    const rs = new Uint8Array([0, 0, 16, 0]); // 4096
    return gabung(garam, rs, new Uint8Array([asPublik.length]), asPublik, sandi);
  }

  /** Mengirim satu notifikasi. isi: { judul, isi, url, tag, mendesak?, ttl? }. Mengembalikan status HTTP. */
  async function kirim(langganan, isi) {
    const k = await muatKunci();
    const alamat = new URL(langganan.endpoint);
    const body = await enkripsi(langganan.keys.p256dh, langganan.keys.auth, teks.encode(JSON.stringify(isi)));
    const r = await ambil(langganan.endpoint, {
      method: 'POST',
      headers: {
        TTL: String(isi.ttl || 86400),
        Urgency: isi.mendesak ? 'high' : 'normal',
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        Authorization: 'vapid t=' + (await jwtUntuk(alamat.origin)) + ', k=' + k.publik
      },
      body,
      signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined
    });
    return r.status;
  }

  /**
   * Mengirim semuanya bersamaan. Langganan yang sudah tidak berlaku (404 atau 410 dari layanan push:
   * izin dicabut, aplikasi dihapus) dikembalikan di hilang, supaya dibuang. Kegagalan lain dicatat saja.
   */
  async function kirimSemua(daftar, log) {
    const hilang = [];
    await Promise.all(daftar.map(async (x) => {
      try {
        const status = await kirim(x.langganan, x.isi);
        if (status === 404 || status === 410) hilang.push(x.langganan.endpoint);
        else if (status >= 300) (log || console).error('Notifikasi ditolak layanan push (' + status + ').');
      } catch (err) {
        (log || console).error('Notifikasi gagal dikirim: ' + (err && err.message ? err.message : err));
      }
    }));
    return { hilang: [...new Set(hilang)] };
  }

  return { kunciPublik, kirim, kirimSemua };
}
