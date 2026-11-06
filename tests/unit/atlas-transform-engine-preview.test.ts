import { describe, expect, it } from 'vitest';
import { TRANSFORM_F3_SEQUENCE, validateTransformSequence } from '../../apps/web/src/modules/creator/director/motion/transform/TransformSpritePreview';

describe('ATLAS Transform Engine sequence guard', () => {
  it('accepts the nine-frame reference', () => {
    expect(validateTransformSequence(TRANSFORM_F3_SEQUENCE)).toBe(true);
  });
  it('rejects frame overflow', () => {
    expect(validateTransformSequence({ columns: 3, rows: 3, frames: 10, fps: 5 })).toBe(false);
  });
  it('rejects invalid and fractional frame rates', () => {
    expect(validateTransformSequence({ columns: 3, rows: 3, frames: 9, fps: 0 })).toBe(false);
    expect(validateTransformSequence({ columns: 3, rows: 3, frames: 9, fps: 2.5 })).toBe(false);
  });
  it('rejects unsafe grid sizes', () => {
    expect(validateTransformSequence({ columns: 0, rows: 3, frames: 9, fps: 5 })).toBe(false);
    expect(validateTransformSequence({ columns: 1000, rows: 1000, frames: 9, fps: 5 })).toBe(false);
  });
});
