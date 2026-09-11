import { describe, expect, it } from 'vitest';
import { AtlasConfidenceEngine } from '../../apps/web/src/services/AtlasConfidenceEngine';

describe('AtlasConfidenceEngine', () => {
  it('allows autonomous execution only above 98 percent', () => {
    expect(AtlasConfidenceEngine.evaluate(0.99)).toEqual({
      level: 'high',
      actionRecommended: true,
      requiresConfirmation: false
    });
  });

  it('requires confirmation at 98 percent and throughout the medium band', () => {
    expect(AtlasConfidenceEngine.evaluate(0.98)).toMatchObject({ level: 'medium', actionRecommended: true, requiresConfirmation: true });
    expect(AtlasConfidenceEngine.evaluate(0.74)).toMatchObject({ level: 'medium', actionRecommended: true, requiresConfirmation: true });
  });

  it('blocks automated execution below 74 percent', () => {
    expect(AtlasConfidenceEngine.evaluate(0.739)).toEqual({
      level: 'low',
      actionRecommended: false,
      requiresConfirmation: true
    });
  });

  it('rejects confidence scores outside the normalized range', () => {
    expect(() => AtlasConfidenceEngine.evaluate(-0.01)).toThrow(/between 0 and 1/i);
    expect(() => AtlasConfidenceEngine.evaluate(1.01)).toThrow(/between 0 and 1/i);
    expect(() => AtlasConfidenceEngine.evaluate(Number.NaN)).toThrow(/between 0 and 1/i);
  });
});
