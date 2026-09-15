import { expect, it } from 'vitest';
import { compileWorkIntent } from '../../packages/execution/src/work-intent';

it('builds a reviewable draft without claiming execution', () => {
  const preview = compileWorkIntent({
    intent: 'Verify atlasenterprisesuite.com with OpenAI',
    ownerModule: 'manager',
    executionMode: 'hybrid',
    autonomyLevel: 'guided',
    runtimePreference: 'auto',
    budgetLimit: 0
  });

  expect(preview.status).toBe('draft');
  expect(preview.ownerModule).toBe('manager');
  expect(preview.successCriteria.length).toBeGreaterThan(0);
});

it('rejects an empty intent', () => {
  expect(() => compileWorkIntent({ intent: '   ', ownerModule: 'manager' })).toThrow('work_intent_required');
});
