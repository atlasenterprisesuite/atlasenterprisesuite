import { describe, expect, it } from 'vitest';
import { buildLocalMediaManifest } from '../../packages/core/src/localMediaManifest';
describe('Local-only media manifest', () => {
  it('classifies selected images, videos, audio and documents without uploading', () => {
    const result = buildLocalMediaManifest([
      { name: 'a.heic', type: 'image/heic', size: 12 },
      { name: 'b.mov', type: 'video/quicktime', size: 12 },
      { name: 'c.mp3', type: 'audio/mpeg', size: 12 },
      { name: 'd.pdf', type: 'application/pdf', size: 12 }
    ]);
    expect(result.rejected).toEqual([]);
    expect(result.accepted.map(x => x.kind)).toEqual(['image', 'video', 'audio', 'document']);
    expect(result.accepted.every(x => x.status === 'local_only')).toBe(true);
  });
  it('rejects unsupported and unsafe selections', () => {
    const result = buildLocalMediaManifest([
      { name: '../bad.jpg', type: 'image/jpeg', size: 10 },
      { name: 'empty.jpg', type: 'image/jpeg', size: 0 },
      { name: 'huge.mov', type: 'video/quicktime', size: 100 * 1024 * 1024 + 1 },
      { name: 'page.html', type: 'text/html', size: 10 }
    ]);
    expect(result.accepted).toEqual([]);
    expect(result.rejected.map(x => x.reason)).toEqual(['invalid_name', 'invalid_size', 'invalid_size', 'unsupported_type']);
  });
});
