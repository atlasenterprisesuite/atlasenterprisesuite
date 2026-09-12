import { describe, expect, it } from 'vitest';
import { analyzeWeeklySocialMetrics, parseSocialMetrics } from '../../packages/social/src/analytics';

describe('social analytics', () => {
  it('rejects invalid imported metrics', () => {
    const result = parseSocialMetrics('instagram,2026-09-10T14:00:00Z,reel,Hook,-1,10,2,1');
    expect(result.ok).toBe(false);
  });

  it('rejects blank numeric fields instead of coercing them to zero', () => {
    const result = parseSocialMetrics('instagram,2026-09-10T14:00:00Z,reel,Hook,,10,2,1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/reach/i);
  });

  it('derives rankings from supplied metrics only', () => {
    const parsed = parseSocialMetrics([
      'instagram,2026-09-10T14:00:00Z,reel,Strong hook,1000,150,20,10',
      'instagram,2026-09-11T20:00:00Z,carousel,Other hook,1000,50,5,2'
    ].join('\n'));
    if (!parsed.ok) throw new Error(parsed.errors.join(', '));
    const analysis = analyzeWeeklySocialMetrics(parsed.posts);
    expect(analysis?.bestFormat).toBe('reel');
    expect(analysis?.worstFormat).toBe('carousel');
    expect(analysis?.bestHook).toBe('Strong hook');
    expect(analysis?.experiments).toHaveLength(3);
  });

  it('returns null for an empty week', () => {
    expect(analyzeWeeklySocialMetrics([])).toBeNull();
  });
});
