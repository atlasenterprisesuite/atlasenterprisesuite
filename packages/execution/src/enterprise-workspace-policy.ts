import { sameScope } from '../../core/src/scope';
import { evaluateAtlasPolicy, type AtlasPolicyEvaluation, type AtlasPolicyEvaluationInput } from './policy-fabric';
import type { ExecutionActor, ExecutionScope } from './types';

/**
 * Business/Enterprise workspace overlay for the existing ATLAS policy fabric.
 *
 * A server adapter MUST derive actor, membership, workspace scope, permissions
 * and usage from authenticated database records. The contextSource flag is
 * only an explicit contract boundary, not proof of authenticity by itself.
 * This pure function does not debit credits, persist members, or write audits.
 */
export type EnterpriseWorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer';

export type EnterpriseWorkspacePolicyInput = {
  requestId: string;
  contextSource: 'server' | 'client';
  targetScope: ExecutionScope;
  actor: ExecutionActor;
  workspace: { id: string; scope: ExecutionScope };
  membership: {
    userId: string;
    workspaceId: string;
    role: EnterpriseWorkspaceRole;
    active: boolean;
  };
  usage: {
    windowId: string;
    limitCredits: number;
    consumedCredits: number;
    requestedCredits: number;
  };
  requiredPermissions: readonly string[];
  action: AtlasPolicyEvaluationInput['action'];
  approval?: AtlasPolicyEvaluationInput['approval'];
  payloadVersion?: number | null;
  payloadDigest?: string | null;
};

export type EnterpriseWorkspacePolicyDecision = AtlasPolicyEvaluation & {
  /** Observed credits available BEFORE this decision; no debit occurs here. */
  creditsRemaining: number | null;
};

const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const validCredits = (value: number) =>
  Number.isSafeInteger(value) && value >= 0;

function deny(
  input: EnterpriseWorkspacePolicyInput,
  reason: string,
  creditsRemaining: number | null = null
): EnterpriseWorkspacePolicyDecision {
  return {
    requestId: nonEmpty(input?.requestId) ? input.requestId : '',
    outcome: 'deny',
    reason,
    permissionsRequired: [],
    approvalRequired: false,
    approvalSatisfied: false,
    creditsRemaining
  };
}

export function evaluateEnterpriseWorkspacePolicy(
  input: EnterpriseWorkspacePolicyInput
): EnterpriseWorkspacePolicyDecision {
  if (!nonEmpty(input?.requestId) || input.contextSource !== 'server') {
    return deny(input, 'authoritative_context_required');
  }

  const actor = input.actor;
  const workspace = input.workspace;
  if (
    !nonEmpty(actor?.userId) ||
    !nonEmpty(actor?.scope?.tenantId) ||
    !nonEmpty(actor?.scope?.organizationId) ||
    !nonEmpty(input.targetScope?.tenantId) ||
    !nonEmpty(input.targetScope?.organizationId) ||
    !Array.isArray(actor.permissions)
  ) {
    return deny(input, 'actor_identity_invalid');
  }

  if (!sameScope(actor.scope, input.targetScope)) {
    return deny(input, 'actor_scope_mismatch');
  }
  if (
    !nonEmpty(workspace?.id) ||
    !nonEmpty(workspace?.scope?.tenantId) ||
    !nonEmpty(workspace?.scope?.organizationId) ||
    !sameScope(workspace.scope, input.targetScope)
  ) {
    return deny(input, 'workspace_scope_mismatch');
  }

  const membership = input.membership;
  if (
    !membership?.active ||
    membership.userId !== actor.userId ||
    membership.workspaceId !== workspace.id
  ) {
    return deny(input, 'workspace_membership_denied');
  }
  if (!['owner', 'admin', 'editor', 'viewer'].includes(membership.role)) {
    return deny(input, 'workspace_role_invalid');
  }

  if (!Array.isArray(input.requiredPermissions) || !input.requiredPermissions.length ||
      input.requiredPermissions.some((permission) => !nonEmpty(permission))) {
    return deny(input, 'required_permissions_missing');
  }
  if (!input.action || typeof input.action.mutation !== 'boolean' ||
      !Number.isFinite(input.action.paidCost) || input.action.paidCost < 0 ||
      (input.action.budgetLimit !== null &&
        (!Number.isFinite(input.action.budgetLimit) || input.action.budgetLimit < 0))) {
    return deny(input, 'execution_cost_invalid');
  }
  if (membership.role === 'viewer' && input.action.mutation) {
    return deny(input, 'workspace_role_read_only');
  }

  const usage = input.usage;
  if (
    !nonEmpty(usage?.windowId) ||
    !validCredits(usage?.limitCredits) ||
    !validCredits(usage?.consumedCredits) ||
    !validCredits(usage?.requestedCredits) ||
    usage.consumedCredits > usage.limitCredits
  ) {
    return deny(input, 'credit_state_invalid');
  }

  const creditsRemaining = usage.limitCredits - usage.consumedCredits;
  if (usage.requestedCredits > creditsRemaining) {
    return deny(input, 'user_credit_limit_exceeded', creditsRemaining);
  }

  // Reuse the central ATLAS policy fabric. Membership and quota never
  // override permissions, execution envelopes, budget or approval gates.
  const policy = evaluateAtlasPolicy({
    requestId: input.requestId,
    permissions: actor.permissions,
    requiredPermissions: input.requiredPermissions,
    action: input.action,
    approval: input.approval,
    payloadVersion: input.payloadVersion,
    payloadDigest: input.payloadDigest
  });

  return {
    ...policy,
    creditsRemaining: policy.outcome === 'deny' ? null : creditsRemaining
  };
}
