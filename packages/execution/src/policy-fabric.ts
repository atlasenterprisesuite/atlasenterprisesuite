import { approvalMatchesPayload } from './approvals';
import { evaluateAgentMandate, type AgentMandateInput } from '../../governance/src/agent-mandates';
import {
  evaluateWorkActionPolicy,
  type WorkActionPolicyInput,
  type WorkActionPolicyDecision
} from './work-policy';

export type AtlasPolicyApproval = {
  status: string;
  payloadVersion: number;
  payloadDigest: string;
};

export type AtlasPolicyEvaluationInput = {
  requestId: string;
  permissions: readonly string[];
  requiredPermissions: readonly string[];
  action: Omit<WorkActionPolicyInput, 'permissionsSatisfied'>;
  approval?: AtlasPolicyApproval | null;
  payloadVersion?: number | null;
  payloadDigest?: string | null;
  /** Set true on agent action entrypoints: missing server-resolved mandate denies access. */
  requireAgentMandate?: boolean;
  /** Must be populated from trusted server-side identity and mandate records, not request bodies. */
  agentMandate?: AgentMandateInput | null;
};

export type AtlasPolicyEvaluation = WorkActionPolicyDecision & {
  requestId: string;
  permissionsRequired: string[];
  approvalRequired: boolean;
  approvalSatisfied: boolean;
};

function hasPermission(granted: readonly string[], required: string) {
  return granted.includes(required) || granted.includes('*') || granted.includes('execution.admin');
}

export function evaluateAtlasPolicy(input: AtlasPolicyEvaluationInput): AtlasPolicyEvaluation {
  const requestId = String(input.requestId ?? '').trim();
  if (!requestId) throw new Error('atlas_policy_request_id_required');

  const permissionsRequired = [...new Set(
    input.requiredPermissions.map((permission) => String(permission).trim()).filter(Boolean)
  )];
  const permissionsSatisfied = permissionsRequired.every((permission) =>
    hasPermission(input.permissions, permission)
  );

  if (input.requireAgentMandate || input.agentMandate) {
    const trust = input.agentMandate ? evaluateAgentMandate(input.agentMandate) : null;
    const cost = input.action.paidCost;
    const monetaryBindingMissing = !Number.isFinite(cost) || cost < 0 ||
      (cost > 0 && (input.agentMandate?.amount == null ||
        !Number.isFinite(input.agentMandate.amount) ||
        input.agentMandate.amount < cost));
    if (monetaryBindingMissing) {
      return {
        requestId,
        outcome: 'deny',
        reason: 'agent_mandate:spending_amount_unbound',
        permissionsRequired,
        approvalRequired: false,
        approvalSatisfied: false
      };
    }
    if (!trust?.allowed) {
      return {
        requestId,
        outcome: 'deny',
        reason: `agent_mandate:${trust?.reason ?? 'mandate_required'}`,
        permissionsRequired,
        approvalRequired: false,
        approvalSatisfied: false
      };
    }
  }

  const base = evaluateWorkActionPolicy({
    ...input.action,
    permissionsSatisfied
  });

  if (base.outcome !== 'require_approval') {
    return {
      requestId,
      ...base,
      permissionsRequired,
      approvalRequired: false,
      approvalSatisfied: false
    };
  }

  const version = Number(input.payloadVersion);
  const digest = String(input.payloadDigest ?? '').trim();
  const approvalSatisfied = Boolean(
    input.approval &&
    Number.isInteger(version) &&
    version > 0 &&
    digest &&
    approvalMatchesPayload(input.approval, version, digest)
  );

  if (approvalSatisfied) {
    return {
      requestId,
      outcome: 'allow',
      reason: `approval_satisfied:${base.reason}`,
      permissionsRequired,
      approvalRequired: false,
      approvalSatisfied: true
    };
  }

  return {
    requestId,
    ...base,
    permissionsRequired,
    approvalRequired: true,
    approvalSatisfied: false
  };
}
