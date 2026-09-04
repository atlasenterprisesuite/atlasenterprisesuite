import { describe, expect, it } from 'vitest';
import { isLiveSource } from '../../packages/health/src';

describe('Health source-state governance', () => {
  it('does not treat configured or demo sources as live', () => {
    expect(isLiveSource('configured')).toBe(false);
    expect(isLiveSource('demo')).toBe(false);
    expect(isLiveSource('unavailable')).toBe(false);
    expect(isLiveSource('live')).toBe(true);
  });
});
