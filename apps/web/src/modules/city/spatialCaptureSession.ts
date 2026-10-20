/**
 * ATLAS Spatial Capture 5D — governed browser-side preflight only.
 * Never uploads files, asserts geolocation accuracy, or verifies a physical twin.
 * Server-side tenant/RLS/storage/consent checks are required before persistence.
 */
export type CapturePhoto = {
  name: string;
  bytes: number;
  mime: string;
  lastModified: number;
};
export type CaptureSessionDraft = {
  organizationId: string;
  siteId: string;
  consentToCapture: boolean;
  authorizedBySiteOwner: boolean;
  images: CapturePhoto[];
};
export type CapturePreflight =
  | { ok: true; state: 'local-preflight-only'; totalBytes: number; count: number }
  | { ok: false; state: 'blocked'; reason: string };

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/heif']);
const MAX_FILES = 80;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_TOTAL_BYTES = 500 * 1024 * 1024;

export function validateCaptureSession(input: CaptureSessionDraft): CapturePreflight {
  if (!input.organizationId.trim() || !input.siteId.trim()) {
    return { ok: false, state: 'blocked', reason: 'organization_or_site_missing' };
  }
  if (!input.consentToCapture || !input.authorizedBySiteOwner) {
    return { ok: false, state: 'blocked', reason: 'authorization_missing' };
  }
  if (!input.images.length || input.images.length > MAX_FILES) {
    return { ok: false, state: 'blocked', reason: 'invalid_photo_count' };
  }
  let totalBytes = 0;
  for (const image of input.images) {
    if (!image.name.trim() || !ALLOWED.has(image.mime.toLowerCase())) {
      return { ok: false, state: 'blocked', reason: 'unsupported_image' };
    }
    if (!Number.isSafeInteger(image.bytes) || image.bytes <= 0 || image.bytes > MAX_FILE_BYTES) {
      return { ok: false, state: 'blocked', reason: 'invalid_image_size' };
    }
    if (!Number.isSafeInteger(image.lastModified) || image.lastModified < 0) {
      return { ok: false, state: 'blocked', reason: 'invalid_image_timestamp' };
    }
    totalBytes += image.bytes;
    if (totalBytes > MAX_TOTAL_BYTES) {
      return { ok: false, state: 'blocked', reason: 'capture_limit_exceeded' };
    }
  }
  return { ok: true, state: 'local-preflight-only', totalBytes, count: input.images.length };
}

export function captureFilesToMetadata(files: readonly File[]): CapturePhoto[] {
  return files.map(({ name, size, type, lastModified }) => ({
    name, bytes: size, mime: type.toLowerCase(), lastModified
  }));
}
