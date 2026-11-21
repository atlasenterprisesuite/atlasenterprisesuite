import { describe, expect, it } from 'vitest';
import { sumeriaPreflight, SUMERIA_MAX_FILE_BYTES } from '../../packages/core/src/sumeriaPreflight';

const pdf = () => ({
  filename: 'source.pdf',
  mimeType: 'application/pdf',
  size: 1024,
  signature: [0x25, 0x50, 0x44, 0x46, 0x2d],
});

describe('SUMERIA additional fail-closed preflight contracts (not parser certification)', () => {
  it('SUM-06 rejects zero and negative file sizes', () => {
    for (const size of [0, -1]) expect(sumeriaPreflight({ ...pdf(), size })).toEqual({ ok: false, error: 'invalid_size' });
  });
  it('SUM-07 rejects fractional and unsafe integer sizes', () => {
    for (const size of [1.5, Number.MAX_SAFE_INTEGER + 1, Infinity]) {
      expect(sumeriaPreflight({ ...pdf(), size })).toEqual({ ok: false, error: 'invalid_size' });
    }
  });
  it('SUM-08 accepts exact maximum size for screening only', () => {
    expect(sumeriaPreflight({ ...pdf(), size: SUMERIA_MAX_FILE_BYTES }).ok).toBe(true);
  });
  it('SUM-09 rejects incomplete PDF signatures', () => {
    expect(sumeriaPreflight({ ...pdf(), signature: [0x25, 0x50] })).toEqual({ ok: false, error: 'signature_mismatch' });
  });
  it('SUM-10 rejects path separators and control characters in filenames', () => {
    for (const filename of ['folder/source.pdf', 'folder\\source.pdf', 'source\u0000.pdf', 'source\n.pdf']) {
      expect(sumeriaPreflight({ ...pdf(), filename })).toEqual({ ok: false, error: 'invalid_filename' });
    }
  });
  it('SUM-11 rejects mismatched extension and MIME', () => {
    expect(sumeriaPreflight({ ...pdf(), filename: 'source.docx' })).toEqual({ ok: false, error: 'unsupported_format' });
  });
  it('SUM-12 returns only metadata, never an editable original buffer', () => {
    const result = sumeriaPreflight(pdf());
    expect(result).toEqual({ ok: true, format: 'pdf', originalImmutable: true });
    expect(result).not.toHaveProperty('sourceBuffer');
    expect(result).not.toHaveProperty('overwrite');
  });
});
