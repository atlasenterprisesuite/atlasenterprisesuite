/**
 * ATLAS Sumeria — safe preflight for document intake.
 * Pure contract only: does not parse, persist, edit, or convert files.
 */
export const SUMERIA_MAX_FILE_BYTES = 20_000_000;
export type SumeriaDocumentFormat = 'pdf' | 'docx';
export type SumeriaPreflight =
  | { ok: true; format: SumeriaDocumentFormat; originalImmutable: true }
  | { ok: false; error: 'invalid_size' | 'unsupported_format' | 'signature_mismatch' | 'invalid_filename' };

export function sumeriaPreflight(input: {
  filename: string;
  mimeType: string;
  size: number;
  signature: readonly number[];
}): SumeriaPreflight {
  if (!Number.isSafeInteger(input.size) || input.size <= 0 || input.size > SUMERIA_MAX_FILE_BYTES) {
    return { ok: false, error: 'invalid_size' };
  }
  const name = input.filename.trim();
  if (!name || name.includes('/') || name.includes('\\') || name.includes('..') || /[\u0000-\u001f]/.test(name)) {
    return { ok: false, error: 'invalid_filename' };
  }
  const lower = name.toLowerCase();
  let format: SumeriaDocumentFormat;
  if (lower.endsWith('.pdf') && input.mimeType === 'application/pdf') format = 'pdf';
  else if (lower.endsWith('.docx') && input.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') format = 'docx';
  else return { ok: false, error: 'unsupported_format' };

  // Minimal signature screening; full parsing and archive-bomb defenses belong to the parser boundary.
  const expected = format === 'pdf' ? [0x25,0x50,0x44,0x46,0x2d] : [0x50,0x4b,0x03,0x04];
  if (expected.some((byte,index) => input.signature[index] !== byte)) return { ok: false, error: 'signature_mismatch' };
  return { ok: true, format, originalImmutable: true };
}
