import { approvalMatchesPayload } from './approvals';
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
