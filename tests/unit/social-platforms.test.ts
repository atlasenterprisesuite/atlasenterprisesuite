import { describe, expect, it } from 'vitest';
import { getPlatform, validateMedia } from '../../packages/social/src/platforms';

describe('social platform contracts', () => {
  it('exposes Instagram formats without claiming a live connection', () => {
    const instagram = getPlatform('instagram');
    expect(instagram.connectionStatus).toBe('not_configured');
    expect(instagram.formats.some((format) => format.aspectRatio === '9:16')).toBe(true);
  });

  it('rejects media that is incompatible with the selected format', () => {
    const format = getPlatform('tiktok').formats.find((item) => item.id === 'vertical-video')!;
    expect(validateMedia([{ type: 'image/png' }], format)).toContain('image/png is not supported for Vertical video.');
  });
});
