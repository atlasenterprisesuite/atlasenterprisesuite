/** Photographic rotation only. A user confirmation is not proof of a 3D mesh or automated 360 capture. */
export const MAX_PHOTO360_FRAMES = 36;
export const MAX_PHOTO360_BYTES = 6 * 1024 * 1024;
export const MAX_PHOTO360_TOTAL_BYTES = 96 * 1024 * 1024;
export const MIN_PHOTO360_FRAMES = 12;

export type Photo360File = { name: string; type: string; size: number };
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function validatePhoto360Files(files: readonly Photo360File[]): string | null {
  if (files.length > MAX_PHOTO360_FRAMES) return 'Maximum 36 photos.';
  const seen = new Set<string>();
  let total = 0;
  for (const file of files) {
    if (!TYPES.has(file.type)) return 'Only JPEG, PNG, or WebP photos are supported.';
    if (file.size <= 0 || file.size > MAX_PHOTO360_BYTES) return 'Each photo must be between 1 byte and 6 MB.';
    const name = file.name.trim().toLowerCase();
    if (!name || seen.has(name)) return 'Photos require unique filenames.';
    seen.add(name);
    total += file.size;
  }
  if (total > MAX_PHOTO360_TOTAL_BYTES) return 'Combined photos may not exceed 96 MB.';
  return null;
}

export function photo360Readiness(files: readonly Photo360File[], userConfirmed: boolean): 'multi-angle' | 'photo-360-confirmed' {
  return files.length >= MIN_PHOTO360_FRAMES && userConfirmed && validatePhoto360Files(files) === null
    ? 'photo-360-confirmed'
    : 'multi-angle';
}

export function nextPhoto360Frame(current: number, count: number, delta: number): number {
  if (count < 1) return 0;
  return ((Math.trunc(current + delta) % count) + count) % count;
}
