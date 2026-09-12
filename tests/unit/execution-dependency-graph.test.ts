import { describe, expect, it } from 'vitest';
import { validateDependencyGraph } from '../../packages/execution/src/index';

describe('ATLAS execution dependency graph', () => {
  it('rejects cycles', () => {
    expect(() => validateDependencyGraph([
      { stepId: 'step-a', dependencies: ['step-b'] },
      { stepId: 'step-b', dependencies: ['step-a'] }
    ])).toThrow('dependency_cycle');
  });

  it('returns a dependency-first order for an acyclic graph', () => {
    expect(validateDependencyGraph([
      { stepId: 'step-a', dependencies: [] },
      { stepId: 'step-b', dependencies: ['step-a'] },
      { stepId: 'step-c', dependencies: ['step-b'] }
    ])).toEqual(['step-a', 'step-b', 'step-c']);
  });
});
