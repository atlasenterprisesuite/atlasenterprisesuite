import { describe, expect, it } from 'vitest';
import { boundedTimeoutMs, remainingBudgetMs } from '../../supabase/functions/_shared/runtime-verifier-budget';

describe('Runtime Verifier global wall-clock budget contract', () => {
  it('decreases across stages instead of resetting for each request', () => {
    expect(remainingBudgetMs(1000, 31000, 90000)).toBe(60000);
    expect(remainingBudgetMs(1000, 91000, 90000)).toBe(0);
  });
  it('caps requests by remaining time while reserving time for terminal persistence', () => {
    expect(boundedTimeoutMs(18000, 35000)).toBe(13000);
    expect(boundedTimeoutMs(30000, 12000)).toBe(12000);
  });
  it('fails closed before consuming the persistence reserve', () => {
    expect(() => boundedTimeoutMs(5000, 35000)).toThrow('verification_deadline_exceeded');
    expect(() => boundedTimeoutMs(0, 12000)).toThrow('verification_deadline_exceeded');
  });
  it('rejects malformed clocks and budgets', () => {
    expect(() => remainingBudgetMs(100, 99)).toThrow();
    expect(() => remainingBudgetMs(0, 1, 0)).toThrow();
    expect(() => boundedTimeoutMs(-1, 12000)).toThrow();
  });
});
