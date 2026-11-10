import { describe, expect, it } from 'vitest';
import { calculateRisk, riskBand } from '../../packages/trustpass/src';

describe('ATLAS TrustPass deterministic risk', () => {
  it('uses the approved score bands at exact boundaries', () => {
    expect(riskBand(0)).toBe('low');
    expect(riskBand(25)).toBe('low');
    expect(riskBand(26)).toBe('medium');
    expect(riskBand(55)).toBe('medium');
    expect(riskBand(56)).toBe('high');
    expect(riskBand(80)).toBe('high');
    expect(riskBand(81)).toBe('critical');
    expect(riskBand(100)).toBe('critical');
  });

  it('clamps scores to 0..100 and rounds to an integer', () => {
    expect(calculateRisk([{ code: 'negative', weight: -40 }]).score).toBe(0);
    expect(calculateRisk([{ code: 'fractional', weight: 26.6 }]).score).toBe(27);
    expect(calculateRisk([{ code: 'overflow', weight: 140 }]).score).toBe(100);
  });

  it('does not let duplicate non-repeatable reasons inflate a score', () => {
    const result = calculateRisk([
      { code: 'new_session', weight: 30 },
      { code: 'new_session', weight: 30 },
      { code: 'velocity', weight: 20 }
    ]);

    expect(result.score).toBe(50);
    expect(result.reasonCodes).toEqual(['new_session', 'velocity']);
    expect(result.band).toBe('medium');
  });

  it('allows explicitly repeatable reasons to contribute repeatedly', () => {
    const result = calculateRisk([
      { code: 'failed_step_up', weight: 35, repeatable: true },
      { code: 'failed_step_up', weight: 35, repeatable: true },
      { code: 'failed_step_up', weight: 35, repeatable: true }
    ]);

    expect(result.score).toBe(100);
    expect(result.band).toBe('critical');
    expect(result.reasonCodes).toEqual(['failed_step_up']);
  });
});
