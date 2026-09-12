import { describe, expect, it } from 'vitest';
import { canCompleteWorkflow, transitionWorkflow } from '../../packages/execution/src/index';

describe('ATLAS workflow state machine', () => {
  it('refuses completion when required evidence is missing', () => {
    expect(canCompleteWorkflow({ requiredEvidenceIds: ['ev-1'], verifiedEvidenceIds: [] })).toBe(false);
  });

  it('moves an approved workflow from awaiting_approval to now', () => {
    expect(transitionWorkflow('awaiting_approval', 'approval_granted')).toBe('now');
  });

  it('rejects invalid terminal transitions', () => {
    expect(() => transitionWorkflow('completed', 'resume')).toThrow('invalid_transition');
  });
});
