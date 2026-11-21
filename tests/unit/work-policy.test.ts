import { expect, it } from 'vitest';
import { evaluateWorkActionPolicy } from '../../packages/execution/src/work-policy';

it('requires approval for DNS writes in guided mode', () => {
  expect(evaluateWorkActionPolicy({
    autonomyLevel: 'guided', sensitivity: 'high', reversible: true,
    mutation: true, paidCost: 0, budgetLimit: 0,
    permissionsSatisfied: true, envelopeAllowed: true, regulated: false
  }).outcome).toBe('require_approval');
});

it('treats null budget as zero and denies spend in autonomous mode', () => {
  expect(evaluateWorkActionPolicy({
    autonomyLevel: 'autonomous', sensitivity: 'low', reversible: true,
    mutation: true, paidCost: 1, budgetLimit: null,
    permissionsSatisfied: true, envelopeAllowed: true, regulated: false
  })).toMatchObject({ outcome: 'deny', reason: 'budget_exceeded' });
});

it('never lets autonomous bypass permissions or envelope', () => {
  expect(evaluateWorkActionPolicy({
    autonomyLevel: 'autonomous', sensitivity: 'low', reversible: true, mutation: true,
    paidCost: 0, budgetLimit: 100, permissionsSatisfied: false, envelopeAllowed: true, regulated: false
  }).reason).toBe('permission_required');
  expect(evaluateWorkActionPolicy({
    autonomyLevel: 'autonomous', sensitivity: 'low', reversible: true, mutation: true,
    paidCost: 0, budgetLimit: 100, permissionsSatisfied: true, envelopeAllowed: false, regulated: false
  }).reason).toBe('execution_envelope_denied');
});

it('allows permitted read-only work regardless of autonomy mode', () => {
  expect(evaluateWorkActionPolicy({
    autonomyLevel: 'manual', sensitivity: 'low', reversible: true, mutation: false,
    paidCost: 0, budgetLimit: 0, permissionsSatisfied: true, envelopeAllowed: true, regulated: false
  })).toMatchObject({ outcome: 'allow', reason: 'read_only_action_allowed' });
});

it('fails closed for unknown, negative or non-finite paid costs', () => {
  const base = {
    autonomyLevel: 'autonomous' as const, sensitivity: 'low' as const,
    reversible: true, mutation: true, budgetLimit: 0,
    permissionsSatisfied: true, envelopeAllowed: true, regulated: false
  };
  for (const paidCost of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1]) {
    expect(evaluateWorkActionPolicy({ ...base, paidCost })).toMatchObject({
      outcome: 'deny', reason: 'invalid_paid_cost'
    });
  }
});

it('fails closed when an invalid budget is supplied', () => {
  const base = {
    autonomyLevel: 'autonomous' as const, sensitivity: 'low' as const,
    reversible: true, mutation: true, paidCost: 0,
    permissionsSatisfied: true, envelopeAllowed: true, regulated: false
  };
  for (const budgetLimit of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1]) {
    expect(evaluateWorkActionPolicy({ ...base, budgetLimit })).toMatchObject({
      outcome: 'deny', reason: 'invalid_budget_limit'
    });
  }
});
