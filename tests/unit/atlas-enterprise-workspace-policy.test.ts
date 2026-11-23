import { describe, expect, it } from 'vitest';
import { evaluateEnterpriseWorkspacePolicy } from '../../packages/execution/src/enterprise-workspace-policy';

function fixture() {
  return {
    requestId: 'enterprise-request-1',
    contextSource: 'server' as const,
    targetScope: { tenantId: 'tenant-a', organizationId: 'org-a' },
    actor: {
      userId: 'user-a',
      scope: { tenantId: 'tenant-a', organizationId: 'org-a' },
      permissions: ['ai.code.write']
    },
    workspace: {
      id: 'workspace-a',
      scope: { tenantId: 'tenant-a', organizationId: 'org-a' }
    },
    membership: { userId: 'user-a', workspaceId: 'workspace-a', role: 'editor' as const, active: true },
    usage: { windowId: '2026-11', limitCredits: 12, consumedCredits: 4, requestedCredits: 2 },
    requiredPermissions: ['ai.code.write'],
    action: {
      autonomyLevel: 'guided' as const,
      sensitivity: 'low' as const,
      reversible: true,
      mutation: true,
      paidCost: 0,
      budgetLimit: 0,
      envelopeAllowed: true,
      regulated: false
    }
  };
}

describe('ATLAS enterprise workspace governance (isolated policy contract)', () => {
  it('allows a server-scoped member with permission and sufficient credits', () => {
    expect(evaluateEnterpriseWorkspacePolicy(fixture())).toMatchObject({
      outcome: 'allow', reason: 'guided_reversible_mutation_allowed', creditsRemaining: 8
    });
  });

  it('refuses client-sourced identity and usage claims', () => {
    expect(evaluateEnterpriseWorkspacePolicy({ ...fixture(), contextSource: 'client' })).toMatchObject({
      outcome: 'deny', reason: 'authoritative_context_required', creditsRemaining: null
    });
  });

  it('rejects cross-tenant and cross-organization access without disclosing credits', () => {
    const base = fixture();
    expect(evaluateEnterpriseWorkspacePolicy({
      ...base, actor: { ...base.actor, scope: { tenantId: 'tenant-b', organizationId: 'org-a' } }
    })).toMatchObject({ outcome: 'deny', reason: 'actor_scope_mismatch', creditsRemaining: null });
    expect(evaluateEnterpriseWorkspacePolicy({
      ...base, workspace: { ...base.workspace, scope: { tenantId: 'tenant-a', organizationId: 'org-b' } }
    })).toMatchObject({ outcome: 'deny', reason: 'workspace_scope_mismatch', creditsRemaining: null });
  });

  it('denies inactive membership, another user, or another workspace', () => {
    const base = fixture();
    for (const membership of [
      { ...base.membership, active: false },
      { ...base.membership, userId: 'user-b' },
      { ...base.membership, workspaceId: 'workspace-b' }
    ]) {
      expect(evaluateEnterpriseWorkspacePolicy({ ...base, membership })).toMatchObject({
        outcome: 'deny', reason: 'workspace_membership_denied'
      });
    }
  });

  it('does not let viewer role mutate even when the actor has a code permission', () => {
    const base = fixture();
    expect(evaluateEnterpriseWorkspacePolicy({
      ...base, membership: { ...base.membership, role: 'viewer' }
    })).toMatchObject({ outcome: 'deny', reason: 'workspace_role_read_only' });
  });

  it('enforces the existing permissions policy without widening roles', () => {
    const base = fixture();
    expect(evaluateEnterpriseWorkspacePolicy({
      ...base, actor: { ...base.actor, permissions: [] }
    })).toMatchObject({ outcome: 'deny', reason: 'permission_required' });
    expect(evaluateEnterpriseWorkspacePolicy({
      ...base, requiredPermissions: []
    })).toMatchObject({ outcome: 'deny', reason: 'required_permissions_missing' });
  });

  it('fails closed on missing or non-finite credit limits and usage', () => {
    const base = fixture();
    for (const usage of [
      { ...base.usage, limitCredits: Number.NaN },
      { ...base.usage, consumedCredits: Number.POSITIVE_INFINITY },
      { ...base.usage, requestedCredits: -1 },
      { ...base.usage, limitCredits: 3 },
      { ...base.usage, windowId: '' }
    ]) {
      expect(evaluateEnterpriseWorkspacePolicy({ ...base, usage })).toMatchObject({
        outcome: 'deny', reason: 'credit_state_invalid'
      });
    }
  });

  it('blocks credit overspend before calling the existing execution policy', () => {
    const base = fixture();
    expect(evaluateEnterpriseWorkspacePolicy({
      ...base, usage: { ...base.usage, requestedCredits: 9 }
    })).toMatchObject({ outcome: 'deny', reason: 'user_credit_limit_exceeded', creditsRemaining: 8 });
  });

  it('preserves approval gates for regulated mutations', () => {
    const base = fixture();
    expect(evaluateEnterpriseWorkspacePolicy({
      ...base, action: { ...base.action, regulated: true }
    })).toMatchObject({
      outcome: 'require_approval', reason: 'regulated_mutation_requires_approval',
      approvalRequired: true
    });
  });

  it('does not turn a policy decision into a credit debit or audit-write claim', () => {
    const base = fixture();
    const before = structuredClone(base);
    const result = evaluateEnterpriseWorkspacePolicy(base);
    expect(base).toEqual(before);
    expect(result).not.toHaveProperty('creditsDebited');
    expect(result).not.toHaveProperty('auditEventId');
  });
});
