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

it('preserves an explicit null budget and defaults omitted budgets to zero', () => {
  expect(parseAtlasWorkContext({ work: { budgetLimit: null } }).budgetLimit).toBeNull();
  expect(parseAtlasWorkContext({ work: {} }).budgetLimit).toBe(0);
});

it('rejects explicitly invalid budgets without coercion', () => {
  for (const budgetLimit of ['bad', '0', '', false, {}, [], -1, NaN, Infinity, -Infinity]) {
    expect(() => parseAtlasWorkContext({ work: { budgetLimit } })).toThrow('invalid_budget_limit');
  }
  expect(parseAtlasWorkContext({ work: { budgetLimit: 0 } }).budgetLimit).toBe(0);
  expect(parseAtlasWorkContext({ work: { budgetLimit: 1.5 } }).budgetLimit).toBe(1.5);
});
