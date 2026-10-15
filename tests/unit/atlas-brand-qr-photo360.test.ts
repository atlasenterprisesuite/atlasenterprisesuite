import { describe, expect, it } from 'vitest';
import { buildBrandQr, renderBrandQrSvg } from '../../packages/creator/brand_qr';
import {
  MAX_PHOTO360_FRAMES,
  photo360Readiness,
  nextPhoto360Frame,
  validatePhoto360Files
} from '../../packages/creator/brand_360';

describe('ATLAS offline QR security and matrix integrity', () => {
  it('fails closed on unsafe URLs including JS, HTTP, private networks and userinfo', () => {
    for (const unsafe of [
      'javascript:alert(1)', 'http://public.example.com/', 'https://localhost/x',
      'https://192.168.1.1/', 'https://alice:secret@public.example.com/',
      'https://[::1]/', 'data:text/html;base64,PHNjcmlwdD4='
    ]) expect(buildBrandQr(unsafe)).toBeNull();
  });

  it('encodes publicly readable UTF-8 HTTPS URL with a 4-module white quiet zone', () => {
    const qr = buildBrandQr('https://store.example.com/products/cloud?color=azul');
    expect(qr).not.toBeNull();
    expect(qr!.destination).toBe('https://store.example.com/products/cloud?color=azul');
    expect(qr!.size).toBe(17 + qr!.version * 4);
    expect(qr!.modules).toHaveLength(qr!.size);
    for (const row of qr!.modules) {
      expect(row).toHaveLength(qr!.size);
      expect(row.every(value => typeof value === 'boolean')).toBe(true);
    }
    const svg = renderBrandQrSvg(qr!);
    expect(svg).toContain('viewBox="0 0 ');
    expect(svg).toContain('fill="#fff"');
    expect(svg).toContain('fill="#000"');
    expect(svg).not.toContain(qr!.destination);
    expect(svg).not.toMatch(/<script|onload=|<image|href=/i);
  });

  it('covers lower and upper version bands without a QR provider', () => {
    const small = buildBrandQr('https://example.com/');
    const long = buildBrandQr('https://example.com/a/' + 'abc'.repeat(49));
    expect(small?.version).toBeLessThan(5);
    expect(long?.version).toBeGreaterThanOrEqual(7);
    expect(long?.version).toBeLessThanOrEqual(10);
    expect(buildBrandQr('https://example.com/a/' + 'x'.repeat(300))).toBeNull();
  });
});

describe('ATLAS photograph-based 360 readiness gates', () => {
  const frame = (n: number) => ({ name: `frame-${n}.jpg`, type: 'image/jpeg', size: 2_000_000 });
  it('does not mislabel multi-angle images as verified 3D/360', () => {
    expect(photo360Readiness(Array.from({ length: 6 }, (_, n) => frame(n)), true)).toBe('multi-angle');
    expect(photo360Readiness(Array.from({ length: 18 }, (_, n) => frame(n)), false)).toBe('multi-angle');
    expect(photo360Readiness(Array.from({ length: 18 }, (_, n) => frame(n)), true)).toBe('photo-360-confirmed');
  });
  it('limits files, types, sizes and duplicate names before using object URLs', () => {
    expect(validatePhoto360Files([frame(1), frame(1)])).not.toBeNull();
    expect(validatePhoto360Files([{ name: 'bad.svg', type: 'image/svg+xml', size: 2000 }])).not.toBeNull();
    expect(validatePhoto360Files([{ name: 'huge.jpg', type: 'image/jpeg', size: 20_000_000 }])).not.toBeNull();
    expect(validatePhoto360Files(Array.from({ length: MAX_PHOTO360_FRAMES + 1 }, (_, n) => frame(n)))).not.toBeNull();
    expect(validatePhoto360Files([frame(1), frame(2)])).toBeNull();
  });
  it('wraps keyboard and pointer-driven rotation consistently', () => {
    expect(nextPhoto360Frame(0, 12, -1)).toBe(11);
    expect(nextPhoto360Frame(11, 12, 1)).toBe(0);
    expect(nextPhoto360Frame(0, 0, 100)).toBe(0);
    expect(nextPhoto360Frame(3, 12, 25)).toBe(4);
  });
});
