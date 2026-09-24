import { describe, expect, it } from 'vitest';
import { summarizeIntegrity } from '../../scripts/verify-neural-integrity.mjs';

describe('ATLAS neural integrity status projection', () => {
  it('reports healthy only when every anatomical system passes', () => {
    expect(summarizeIntegrity({
      roots: true,
      trunk: true,
      brain: true,
      nerves: true,
      bark: true,
      senses: true,
    })).toEqual({ healthy: true, failed: [] });
  });

  it('reports every failed anatomical system in deterministic order', () => {
    expect(summarizeIntegrity({
      roots: true,
      trunk: true,
      brain: false,
      nerves: true,
      bark: true,
      senses: false,
    })).toEqual({ healthy: false, failed: ['brain', 'senses'] });
  });
});
