/** ATLAS ChronoSeed v1 portable encrypted capsule format; no network or persistence. */
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const aad = encoder.encode('ATLAS-CHRONOSEED-V1');
const iterations = 310000;
const maxBytes = 2 * 1024 * 1024;
const maxEntries = 200;
const cryptoApi = () => {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) throw Error('chronoseed_webcrypto_required');
  return globalThis.crypto;
};
const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
const base64 = bytes => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
};
const fromBase64 = text => {
  if (typeof text !== 'string' || text.length > maxBytes * 2 || !/^[A-Za-z0-9+/]*={0,2}$/.test(text)) throw Error('chronoseed_invalid_base64');
  const raw = atob(text);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
};
const digest = async bytes => hex(new Uint8Array(await cryptoApi().subtle.digest('SHA-256', bytes)));
const validEntry = e => e && typeof e.title === 'string' && e.title.length > 0 && e.title.length <= 160 &&
  typeof e.content === 'string' && e.content.length > 0 && e.content.length <= 100000 &&
  typeof e.source === 'string' && e.source.length <= 500 && typeof e.timestamp === 'string' && e.timestamp.length < 40;
const validDate = x => typeof x === 'string' && x.length > 0 && x.length <= 40;
const validateEntries = entries => {
  if (!Array.isArray(entries) || !entries.length || entries.length > maxEntries || !entries.every(validEntry)) throw Error('chronoseed_invalid_entries');
};
async function derive(password, salt) {
  const subtle = cryptoApi().subtle;
  const base = await subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function createCapsule(entries, password, createdAt = new Date().toISOString()) {
  validateEntries(entries);
  if (typeof password !== 'string' || password.length < 12 || password.length > 4096) throw Error('chronoseed_invalid_password');
  if (!validDate(createdAt)) throw Error('chronoseed_invalid_date');
  const base = { schema: 'atlas-chronoseed/v1', createdAt, entries };
  const checksum = await digest(encoder.encode(JSON.stringify(base)));
  const payload = encoder.encode(JSON.stringify({ ...base, integrity: { algorithm: 'SHA-256', digest: checksum } }));
  if (payload.byteLength > maxBytes / 2) throw Error('chronoseed_payload_too_large');
  const salt = cryptoApi().getRandomValues(new Uint8Array(16));
  const iv = cryptoApi().getRandomValues(new Uint8Array(12));
  const key = await derive(password, salt);
  const ciphertext = new Uint8Array(await cryptoApi().subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, payload));
  const capsule = { format: 'ATLAS-CHRONOSEED', version: 1, createdAt,
    kdf: { name: 'PBKDF2-SHA256', iterations, salt: base64(salt) },
    cipher: { name: 'AES-256-GCM', iv: base64(iv), data: base64(ciphertext) } };
  const bytes = encoder.encode(JSON.stringify(capsule, null, 2));
  if (bytes.byteLength > maxBytes) throw Error('chronoseed_capsule_too_large');
  return { bytes, sha256: await digest(bytes) };
}
export async function openCapsule(bytes, password) {
  if (!(bytes instanceof Uint8Array) || !bytes.byteLength || bytes.byteLength > maxBytes) throw Error('chronoseed_file_limit');
  if (typeof password !== 'string' || !password) throw Error('chronoseed_password_required');
  let obj;
  try { obj = JSON.parse(decoder.decode(bytes)); } catch { throw Error('chronoseed_invalid_json'); }
  if (!obj || obj.format !== 'ATLAS-CHRONOSEED' || obj.version !== 1 ||
      obj.kdf?.name !== 'PBKDF2-SHA256' || obj.kdf?.iterations !== iterations || obj.cipher?.name !== 'AES-256-GCM') throw Error('chronoseed_unsupported_format');
  const salt = fromBase64(obj.kdf.salt);
  const iv = fromBase64(obj.cipher.iv);
  const data = fromBase64(obj.cipher.data);
  if (salt.length !== 16 || iv.length !== 12 || data.length < 17 || data.length > maxBytes) throw Error('chronoseed_corrupt_capsule');
  let plaintext;
  try {
    const key = await derive(password, salt);
    plaintext = await cryptoApi().subtle.decrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, data);
  } catch { throw Error('chronoseed_authentication_failed'); }
  let doc;
  try { doc = JSON.parse(decoder.decode(new Uint8Array(plaintext))); } catch { throw Error('chronoseed_invalid_payload'); }
  if (!doc || doc.schema !== 'atlas-chronoseed/v1' || !validDate(doc.createdAt)) throw Error('chronoseed_invalid_payload');
  validateEntries(doc.entries);
  const check = await digest(encoder.encode(JSON.stringify({ schema: doc.schema, createdAt: doc.createdAt, entries: doc.entries })));
  if (doc.integrity?.algorithm !== 'SHA-256' || doc.integrity?.digest !== check) throw Error('chronoseed_integrity_failed');
  return { entries: doc.entries, createdAt: doc.createdAt, sha256: await digest(bytes) };
}
