// ATLAS multimodal intake: pure fail-closed envelope validation.
// No raw bytes, URLs, or provider credentials may enter persisted metadata.
export const MEDIA_TYPES = Object.freeze({
  image: ['image/jpeg', 'image/png', 'image/webp'],
  document: ['application/pdf', 'text/plain'],
  audio: ['audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/webm'],
  video: ['video/mp4', 'video/webm'],
});
export const MEDIA_LIMITS = Object.freeze({
  image: 20 * 1024 * 1024,
  document: 25 * 1024 * 1024,
  audio: 25 * 1024 * 1024,
  video: 100 * 1024 * 1024,
});
const reject = (code) => { const error = new Error(code); error.code = code; error.status = 400; throw error; };
export function validateMediaEnvelope(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) reject('invalid_media_envelope');
  const { kind, mime_type, byte_size, storage_ref, sha256, consent } = input;
  if (!Object.hasOwn(MEDIA_TYPES, kind)) reject('unsupported_media_kind');
  if (!MEDIA_TYPES[kind].includes(mime_type)) reject('unsupported_media_type');
  if (!Number.isSafeInteger(byte_size) || byte_size <= 0 || byte_size > MEDIA_LIMITS[kind]) reject('invalid_media_size');
  // Only opaque identifiers: the server must resolve storage_ref against the authenticated tenant.
  if (typeof storage_ref !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(storage_ref)) reject('invalid_storage_ref');
  if (typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(sha256)) reject('invalid_media_digest');
  if (consent !== true && (kind === 'audio' || kind === 'video')) reject('media_consent_required');
  return Object.freeze({ kind, mime_type, byte_size, storage_ref, sha256 });
}
