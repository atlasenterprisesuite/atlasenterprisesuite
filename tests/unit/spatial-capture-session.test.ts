import { describe, expect, it } from 'vitest';
import { validateCaptureSession, type CaptureSessionDraft } from '../../../apps/web/src/modules/city/spatialCaptureSession';

const valid = (): CaptureSessionDraft => ({
  organizationId: 'tenant-a', siteId: 'building-1',
  consentToCapture: true, authorizedBySiteOwner: true,
  images: [{ name: 'entrance.jpg', bytes: 1024, mime: 'image/jpeg', lastModified: 1 }]
});
describe('spatial capture preflight fail closed', () => {
  it('accepts authorized photo metadata only as local preflight', () => {
    expect(validateCaptureSession(valid())).toEqual({
      ok: true, state: 'local-preflight-only', count: 1, totalBytes: 1024
    });
  });
  it('blocks absent consent or site authorization', () => {
    for (const field of ['consentToCapture', 'authorizedBySiteOwner'] as const) {
      expect(validateCaptureSession({ ...valid(), [field]: false })).toMatchObject({
        ok: false, state: 'blocked', reason: 'authorization_missing'
      });
    }
  });
  it('blocks missing scope and empty files', () => {
    expect(validateCaptureSession({ ...valid(), organizationId: '' })).toMatchObject({ ok: false });
    expect(validateCaptureSession({ ...valid(), siteId: '' })).toMatchObject({ ok: false });
    expect(validateCaptureSession({ ...valid(), images: [] })).toMatchObject({ ok: false });
  });
  it('blocks invalid mime, oversized files, unsafe sizes and timestamps', () => {
    for (const image of [
      { name: 'script.svg', bytes: 10, mime: 'image/svg+xml', lastModified: 1 },
      { name: 'huge.jpg', bytes: 26 * 1024 * 1024, mime: 'image/jpeg', lastModified: 1 },
      { name: 'nan.jpg', bytes: NaN, mime: 'image/jpeg', lastModified: 1 },
      { name: 'bad.jpg', bytes: 1, mime: 'image/jpeg', lastModified: -1 }
    ]) {
      expect(validateCaptureSession({ ...valid(), images: [image] })).toMatchObject({ ok: false, state: 'blocked' });
    }
  });
  it('rejects over 80 pictures and aggregate over 500 MiB', () => {
    expect(validateCaptureSession({ ...valid(), images: Array(81).fill(valid().images[0]) })).toMatchObject({ ok: false });
    const images = Array.from({ length: 25 }, (_, i) => ({ name: `p${i}.jpg`, bytes: 24 * 1024 * 1024, mime: 'image/jpeg', lastModified: 1 }));
    expect(validateCaptureSession({ ...valid(), images })).toMatchObject({ ok: false, reason: 'capture_limit_exceeded' });
  });
});
