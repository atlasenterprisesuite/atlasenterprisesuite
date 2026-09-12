import { describe, expect, it } from 'vitest';
import { getPlatform, validateMedia } from '../../packages/social/src/platforms';

describe('social publishing formats', () => {
  it('preserves native Instagram feed and story dimensions', () => {
    const instagram = getPlatform('instagram');
    expect(instagram.formats.find((format) => format.id === 'feed-portrait')).toMatchObject({ width: 1080, height: 1350, aspectRatio: '4:5' });
    expect(instagram.formats.find((format) => format.id === 'story-reel')).toMatchObject({ width: 1080, height: 1920, aspectRatio: '9:16' });
  });

  it('rejects incompatible media types and file counts', () => {
    const format = getPlatform('tiktok').formats.find((item) => item.id === 'vertical-video')!;
    const errors = validateMedia(
      [{ type: 'image/png' } as File, { type: 'video/mp4' } as File],
      format
    );
    expect(errors).toHaveLength(2);
  });
});
