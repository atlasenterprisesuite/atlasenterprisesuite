import { describe, expect, it } from 'vitest';
import { evaluateNativeRenderGate } from '../../packages/creator/native_policy';

describe('ATLAS native render policy', () => {
  it('blocks dirty drafts so generation cannot use a stale saved version', () => {
    const gate = evaluateNativeRenderGate({
      permissions: ['creator.generate'], dirty: true, validationStatus: 'pass',
      aspectRatio: '9:16', audioEnabled: true
    });
    expect(gate.allowed).toBe(false);
    expect(gate.reasons).toContain('unsaved_changes');
  });

  it('blocks callers without generation permission', () => {
    const gate = evaluateNativeRenderGate({
      permissions: ['creator.read'], dirty: false, validationStatus: 'pass',
      aspectRatio: '9:16', audioEnabled: true
    });
    expect(gate.allowed).toBe(false);
    expect(gate.reasons).toContain('generation_permission_required');
  });

  it('allows a saved validated narrated zero-cost render', () => {
    const gate = evaluateNativeRenderGate({
      permissions: ['creator.generate'], dirty: false, validationStatus: 'warning',
      aspectRatio: '9:16', audioEnabled: true
    });
    expect(gate.allowed).toBe(true);
    expect(gate.billingClass).toBe('zero-cost');
    expect(gate.humanApprovalRequired).toBe(true);
  });
});
