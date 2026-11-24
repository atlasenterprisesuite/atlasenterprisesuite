/**
 * ATLAS Photo Vault - privacy-first manifest validation and integrity gate.
 * No access to Google Photos, biometrics, device files or credentials.
 * Designed as a pure, portable core for the server-side ingest adapter.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { posix } from 'node:path';

const SHA256 = /^[a-f0-9]{64}$/;
export function safeRelativePath(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes('\\0')) return false;
  if (value.startsWith('/') || value.split('/').includes('..') || value.split('/').includes('.')) return false;
  return posix.normalize(value) === value;
}
export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
export function validateManifest(manifest) {
  if (!manifest || manifest.schema !== 1 || !Array.isArray(manifest.files)) throw new Error('INVALID_MANIFEST');
  const seen = new Set();
  let totalBytes = 0;
  for (const item of manifest.files) {
    if (!item || !safeRelativePath(item.path) || seen.has(item.path)) throw new Error('INVALID_PATH_OR_DUPLICATE');
    if (!SHA256.test(item.sha256) || !Number.isSafeInteger(item.bytes) || item.bytes < 0) throw new Error('INVALID_HASH_OR_SIZE');
    totalBytes += item.bytes;
    if (!Number.isSafeInteger(totalBytes)) throw new Error('INVALID_TOTAL_SIZE');
    seen.add(item.path);
  }
  return { files: seen.size, bytes: totalBytes };
}
export function verifyFile(item, bytes) {
  if (!item || !SHA256.test(item.sha256) || !Number.isSafeInteger(item.bytes)) return false;
  if (!Buffer.isBuffer(bytes)) return false;
  if (bytes.length !== item.bytes) return false;
  return timingSafeEqual(Buffer.from(sha256(bytes), 'hex'), Buffer.from(item.sha256, 'hex'));
}
export function authorizePhotoOperation({ authenticated, tenantId, resourceTenantId, consent, operation }) {
  if (authenticated !== true || !tenantId || !resourceTenantId || tenantId !== resourceTenantId) return false;
  if (!['import', 'backup', 'restore', 'face-detect'].includes(operation)) return false;
  return consent?.[operation] === true;
}
