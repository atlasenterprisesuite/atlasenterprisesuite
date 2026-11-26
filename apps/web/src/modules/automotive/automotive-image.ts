/**
 * First-pass local browser image intake. Signature checks are a browser UX guard,
 * not a replacement for server-side scanning if uploads are introduced later.
 */
export const MAX_AUTOMOTIVE_IMAGE_BYTES = 8 * 1024 * 1024;
export function validateAutomotiveImageSignature(
  mime: string,
  bytes: Uint8Array,
  size: number
): string | null {
  if (size <= 0) return 'The image file is empty.';
  if (size > MAX_AUTOMOTIVE_IMAGE_BYTES) return 'Images must be 8 MB or smaller.';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) return 'Unsupported image type. Use JPEG, PNG or WebP.';
  const jpeg = mime === 'image/jpeg' &&
    bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const png = mime === 'image/png' && bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  const webp = mime === 'image/webp' && bytes.length >= 12 &&
    [82, 73, 70, 70].every((value, index) => bytes[index] === value) &&
    [87, 69, 66, 80].every((value, index) => bytes[index + 8] === value);
  return jpeg || png || webp ? null : 'Image signature does not match its declared type.';
}
