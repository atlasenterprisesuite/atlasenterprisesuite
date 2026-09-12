import { describe, expect, it } from 'vitest';
import { approvalRequiredFor, assertApprovalSatisfied } from '../../packages/execution/src/index';

describe('approval policy', () => {
  it('does not require approval for observe', () => {
    expect(approvalRequiredFor({ executionClass: 'observe', risk: 'low', estimatedCost: 0 })).toBe(false);
  });

  it('requires approval for regulated execution', () => {
    expect(approvalRequiredFor({ executionClass: 'execute', risk: 'regulated', estimatedCost: 0 })).toBe(true);
  });

  it('requires approval when budget policy says spend exceeds threshold', () => {
    expect(approvalRequiredFor({ executionClass: 'execute', risk: 'moderate', estimatedCost: 25, approvalCostThreshold: 10 })).toBe(true);
  });

  it('accepts a valid approved request and rejects a pending one', () => {
    expect(() => assertApprovalSatisfied({ required: true, approval: { status: 'approved', expiresAt: null } })).not.toThrow();
    expect(() => assertApprovalSatisfied({ required: true, approval: { status: 'pending', expiresAt: null } })).toThrow('approval_required');
  });
});
