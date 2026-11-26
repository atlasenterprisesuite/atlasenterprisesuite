import { describe, expect, it } from 'vitest';
import { AUTOMOTIVE_CLAIMS, AUTOMOTIVE_MODELS, resolveAutomotiveClaim } from '../../apps/web/src/modules/automotive/automotive-evidence';

describe('ATLAS Automotive Intelligence — manufacturer evidence', () => {
  const now = new Date('2026-11-26T20:00:00Z');

  it('keeps confirmed model information separate from any specific photographed VIN', () => {
    expect(AUTOMOTIVE_MODELS).toHaveLength(2);
    expect(AUTOMOTIVE_MODELS[0].id).toBe('mclaren-720s-spider');
    expect(AUTOMOTIVE_MODELS.every((model) => !('vin' in model))).toBe(true);
  });

  it('conflicts instead of silently choosing between official 2.8 and 2.9 second figures', () => {
    const result = resolveAutomotiveClaim(AUTOMOTIVE_CLAIMS, 'mclaren-720s-spider', 'zero_to_100_seconds', now);
    expect(result.status).toBe('conflict');
    expect(result.values).toEqual([2.8, 2.9]);
    expect(result.sources).toHaveLength(2);
  });

  it('verifies unchanged manufacturer claims with traceable sources', () => {
    const result = resolveAutomotiveClaim(AUTOMOTIVE_CLAIMS, 'mclaren-720s-spider', 'power_bhp', now);
    expect(result.status).toBe('verified');
    expect(result.values).toEqual([710]);
    expect(result.sources[0].url).toContain('cars.mclaren.com');
  });

  it('fails closed on unavailable fields and non-manufacturer sources', () => {
    expect(resolveAutomotiveClaim(AUTOMOTIVE_CLAIMS, 'unknown-model', 'power_bhp', now).status).toBe('unverified');
    expect(resolveAutomotiveClaim([
      { modelId: 'mclaren-720s-spider', key: 'power_bhp', value: 999, unit: 'bhp',
        source: { publisher: 'McLaren Automotive', url: 'https://mclaren.example.net/fake', section: 'Specs', checkedAt: '2026-11-26' } }
    ], 'mclaren-720s-spider', 'power_bhp', now).status).toBe('unverified');
  });

  it('rejects a forged value even when the attacker copies a real manufacturer URL', () => {
    const official = AUTOMOTIVE_CLAIMS.find((item) => item.modelId === 'mclaren-720s-spider' && item.key === 'power_bhp');
    expect(official).toBeDefined();
    const forged = { ...official!, value: 999 };
    const result = resolveAutomotiveClaim([forged], 'mclaren-720s-spider', 'power_bhp', now);
    expect(result.status).toBe('unverified');
    expect(result.values).toEqual([]);
  });

  it('fails closed when source verification is dated in the future', () => {
    const result = resolveAutomotiveClaim([
      { modelId: 'mclaren-720s-spider', key: 'power_bhp', value: 710, unit: 'bhp',
        source: { publisher: 'McLaren Automotive', url: 'https://cars.mclaren.com/gl_en/legacy/720s-spider', section: 'Overview', checkedAt: '2027-01-01' } }
    ], 'mclaren-720s-spider', 'power_bhp', now);
    expect(result.status).toBe('unverified');
  });
});
