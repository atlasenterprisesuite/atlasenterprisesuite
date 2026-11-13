import { describe, expect, it } from 'vitest';
import { maskUsLineNumber, normalizeUsLineNumber } from '../../supabase/functions/_shared/atlas-wireless-line';

describe('ATLAS Wireless claimed-line boundary', () => {
  it('normalizes NANP phone inputs without declaring carrier ownership', () => {
    expect(normalizeUsLineNumber('(786) 555-0123')).toBe('+17865550123');
    expect(normalizeUsLineNumber('7865550123')).toBe('+17865550123');
    expect(normalizeUsLineNumber('17865550123')).toBe('+17865550123');
    expect(normalizeUsLineNumber('+17865550123')).toBe('+17865550123');
  });

  it('rejects malformed, overseas, and invalid-prefix inputs', () => {
    for (const value of ['', '123', '+447777777777', '0005550123', '7860550123', '7861110123', '7865550123x55', null, {}, '5'.repeat(1000)]) {
      expect(() => normalizeUsLineNumber(value)).toThrow('invalid_phone_number');
    }
  });

  it('masks the number before returning it to a client', () => {
    expect(maskUsLineNumber('+17865550123')).toBe('•••-•••-0123');
  });
});
