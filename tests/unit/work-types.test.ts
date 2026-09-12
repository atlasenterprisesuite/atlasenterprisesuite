import { expect, it } from 'vitest';
import { parseAtlasWorkContext } from '../../packages/execution/src/work-types';

it('normalizes safe Work metadata and drops unexpected secret-like keys', () => {
  expect(parseAtlasWorkContext({
    work: {
      executionMode: 'hybrid', autonomyLevel: 'guided', runtimePreference: 'auto',
      budgetLimit: 0, connectionRefs: ['conn-cloudflare'], token: 'must-not-survive'
    }
  })).toEqual({
    executionMode: 'hybrid', autonomyLevel: 'guided', runtimePreference: 'auto',
    budgetLimit: 0, connectionRefs: ['conn-cloudflare']
  });
});

it('preserves an explicit null budget and defaults malformed budgets to zero', () => {
  expect(parseAtlasWorkContext({ work: { budgetLimit: null } }).budgetLimit).toBeNull();
  expect(parseAtlasWorkContext({ work: { budgetLimit: 'bad' } }).budgetLimit).toBe(0);
});
