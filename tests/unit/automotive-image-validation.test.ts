import { describe, expect, it } from 'vitest';
import { validateAutomotiveImageSignature } from '../../apps/web/src/modules/automotive/automotive-image';

describe('ATLAS Automotive image intake — local-only validation', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  const webp = new Uint8Array([82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 80]);

  it('accepts well-formed JPEG, PNG and WebP signatures', () => {
    expect(validateAutomotiveImageSignature('image/jpeg', jpeg, 1000)).toBeNull();
    expect(validateAutomotiveImageSignature('image/png', png, 1000)).toBeNull();
    expect(validateAutomotiveImageSignature('image/webp', webp, 1000)).toBeNull();
  });

  it('rejects image-type spoofing, SVG, empty and oversized files', () => {
    expect(validateAutomotiveImageSignature('image/jpeg', png, 1000)).toMatch(/signature/i);
    expect(validateAutomotiveImageSignature('image/svg+xml', jpeg, 1000)).toMatch(/type/i);
    expect(validateAutomotiveImageSignature('image/jpeg', jpeg, 0)).toMatch(/empty/i);
    expect(validateAutomotiveImageSignature('image/jpeg', jpeg, 8 * 1024 * 1024 + 1)).toMatch(/8 MB/i);
  });
});
