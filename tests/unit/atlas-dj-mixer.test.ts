import { describe, expect, it } from 'vitest';
import { crossfadeGains, formatDjTime, normalizeDjLevel } from '../../apps/web/src/modules/creator/dj/djMath';

describe('ATLAS DJ local mixer', () => {
  it('uses equal-power crossfading with a centered balanced output', () => {
    expect(crossfadeGains(-1)).toEqual({ a: 1, b: 0 });
    expect(crossfadeGains(1).a).toBeCloseTo(0, 10);
    expect(crossfadeGains(1).b).toBeCloseTo(1, 10);
    expect(crossfadeGains(0).a).toBeCloseTo(Math.SQRT1_2, 10);
    expect(crossfadeGains(0).b).toBeCloseTo(Math.SQRT1_2, 10);
  });

  it('clamps invalid and out-of-range controls', () => {
    expect(crossfadeGains(-20)).toEqual({ a: 1, b: 0 });
    expect(crossfadeGains(20).b).toBe(1);
    expect(crossfadeGains(Number.NaN)).toEqual(crossfadeGains(0));
    expect(normalizeDjLevel(-1)).toBe(0);
    expect(normalizeDjLevel(3)).toBe(1);
    expect(normalizeDjLevel(Number.NaN)).toBe(0);
  });

  it('formats valid times without inventing duration', () => {
    expect(formatDjTime(125.9)).toBe('02:05');
    expect(formatDjTime(0)).toBe('00:00');
    expect(formatDjTime(Infinity)).toBe('--:--');
    expect(formatDjTime(-1)).toBe('--:--');
  });
});
