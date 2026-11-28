import { approvalMatchesPayload, digestApprovalPayload } from './approvals';
import { resolveAtlasContext, type AtlasServerContextInput } from './context-engine';
import { reconcilePrivacyInventory } from './privacy-manifest.mjs';
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

/** Server-internal candidate evaluation only. The caller must resolve the authenticated
 * session, current membership/permissions, authoritative inventory and consent record
 * independently of request-body claims. Never use this result to dispatch or bypass RLS.
 * Transactional revalidation, revocation and audit remain mandatory. */
export type AtlasPrivacyConsentReceipt = {
  id: string;
  status: 'granted' | 'revoked';
  userId: string;
  tenantId: string;
  organizationId: string;
  sessionId: string;
  requestId: string;
  payloadVersion: number;
  payloadDigest: string;
  inventoryDigest: string;
  grantedAtMs: number;
  expiresAtMs: number;
  revokedAtMs: number | null;
};
export type AtlasPrivacyPreflightInput = {
  context: AtlasServerContextInput;
  policy: Omit<AtlasPolicyEvaluationInput,'requestId'|'permissions'>;
  inventory: string;
  consent: AtlasPrivacyConsentReceipt | null;
  nowMs: number;
};
export type AtlasPrivacyPreflightResult = {
  status:'blocked'|'eligible_for_transaction';
  reason:string;
  verified:false;
  authorization:'not_granted';
};
export async function evaluateAtlasPrivacyPreflight(input: AtlasPrivacyPreflightInput): Promise<AtlasPrivacyPreflightResult> {
  const deny=(reason:string):AtlasPrivacyPreflightResult=>({status:'blocked',reason,verified:false,authorization:'not_granted'});
  try {
    const context=resolveAtlasContext(input.context);
    const policy=input.policy;
    const consent=input.consent;
    const now=input.nowMs;
    if (!Number.isSafeInteger(now) || now<=0 ||
        !Number.isSafeInteger(policy.payloadVersion) || Number(policy.payloadVersion)<=0 ||
        typeof policy.payloadDigest!=='string' || !/^[a-f0-9]{64}$/.test(policy.payloadDigest) ||
        !Array.isArray(policy.requiredPermissions) || !policy.requiredPermissions.length ||
        policy.requiredPermissions.some(p=>typeof p!=='string'||!p.trim())) return deny('invalid_privacy_policy_input');
    if (reconcilePrivacyInventory(input.inventory).status!=='matched_metadata') return deny('privacy_inventory_incomplete');
    if (!consent || typeof consent.id!=='string' || !consent.id.trim() ||
        consent.status!=='granted' || consent.revokedAtMs!==null ||
        !Number.isSafeInteger(consent.grantedAtMs) || !Number.isSafeInteger(consent.expiresAtMs) ||
        consent.grantedAtMs<=0 || consent.grantedAtMs>now || consent.expiresAtMs<=now ||
        consent.expiresAtMs<=consent.grantedAtMs) return deny('privacy_consent_invalid');
    const actor=context.actor;
    if (consent.userId!==actor.userId || consent.tenantId!==actor.scope.tenantId ||
        consent.organizationId!==actor.scope.organizationId || consent.sessionId!==context.sessionId ||
        consent.requestId!==context.requestId || consent.payloadVersion!==policy.payloadVersion ||
        consent.payloadDigest!==policy.payloadDigest ||
        consent.inventoryDigest!==await digestApprovalPayload(input.inventory)) return deny('privacy_consent_scope_mismatch');
    const decision=evaluateAtlasPolicy({...policy,requestId:context.requestId,permissions:actor.permissions});
    if (decision.outcome!=='allow') return deny('privacy_policy_not_allowed');
    return {status:'eligible_for_transaction',reason:'metadata_preflight_only',verified:false,authorization:'not_granted'};
  } catch { return deny('privacy_preflight_failed'); }
}
