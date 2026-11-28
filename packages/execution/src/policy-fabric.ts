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
function validPrivacyAction(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return false;
  const keys = ['autonomyLevel','sensitivity','reversible','mutation','paidCost','budgetLimit','envelopeAllowed','regulated'];
  if (Reflect.ownKeys(value).length !== keys.length || !keys.every(key => {
    const d = Object.getOwnPropertyDescriptor(value,key);
    return d && d.enumerable && Object.hasOwn(d,'value');
  })) return false;
  const a = value as Record<string, unknown>;
  return ['manual','guided','autonomous'].includes(a.autonomyLevel as string) &&
    ['low','medium','high','critical'].includes(a.sensitivity as string) &&
    ['reversible','mutation','envelopeAllowed','regulated'].every(key => typeof a[key] === 'boolean') &&
    typeof a.paidCost === 'number' && Number.isFinite(a.paidCost) && a.paidCost >= 0 &&
    (a.budgetLimit === null || (typeof a.budgetLimit === 'number' && Number.isFinite(a.budgetLimit) && a.budgetLimit >= 0));
}

function validPrivacyPermissions(value: unknown): value is string[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value)!==Array.prototype ||
      Reflect.ownKeys(value).length!==value.length+1) return false;
  for (let i=0;i<value.length;i++) {
    const d=Object.getOwnPropertyDescriptor(value,String(i));
    if (!d || !d.enumerable || !Object.hasOwn(d,'value') ||
        typeof d.value!=='string' || !d.value.trim()) return false;
  }
  return true;
}
export async function evaluateAtlasPrivacyPreflight(input: AtlasPrivacyPreflightInput): Promise<AtlasPrivacyPreflightResult> {
  const deny=(reason:string):AtlasPrivacyPreflightResult=>({status:'blocked',reason,verified:false,authorization:'not_granted'});
  try {
    const rawContext=input.context;
    if (rawContext.source!=='server' ||
        ![rawContext.requestId,rawContext.sessionId,rawContext.userId,rawContext.tenantId,rawContext.organizationId].every(v=>typeof v==='string'&&v.trim()===v&&v.length>0) ||
        !validPrivacyPermissions(rawContext.permissions)) return deny('invalid_privacy_context');
    const context=resolveAtlasContext(rawContext);
    const policy=input.policy;
    const inventory=input.inventory;
    const consent=input.consent;
    const now=input.nowMs;
    if (!validPrivacyAction(policy.action) || !Number.isSafeInteger(now) || now<=0 ||
        !Number.isSafeInteger(policy.payloadVersion) || Number(policy.payloadVersion)<=0 ||
        typeof policy.payloadDigest!=='string' || !/^[a-f0-9]{64}$/.test(policy.payloadDigest) ||
        !validPrivacyPermissions(policy.requiredPermissions) || !policy.requiredPermissions.length) return deny('invalid_privacy_policy_input');
    if (reconcilePrivacyInventory(inventory).status!=='matched_metadata') return deny('privacy_inventory_incomplete');
    if (!consent || typeof consent.id!=='string' || !consent.id.trim() ||
        consent.status!=='granted' || consent.revokedAtMs!==null ||
        !Number.isSafeInteger(consent.grantedAtMs) || !Number.isSafeInteger(consent.expiresAtMs) ||
        consent.grantedAtMs<=0 || consent.grantedAtMs>now || consent.expiresAtMs<=now ||
        consent.expiresAtMs<=consent.grantedAtMs) return deny('privacy_consent_invalid');
    const actor=context.actor;
    if (consent.userId!==actor.userId || consent.tenantId!==actor.scope.tenantId ||
        consent.organizationId!==actor.scope.organizationId || consent.sessionId!==context.sessionId ||
        consent.requestId!==context.requestId || consent.payloadVersion!==policy.payloadVersion ||
        consent.payloadDigest!==policy.payloadDigest) return deny('privacy_consent_scope_mismatch');
    const inventoryDigest=consent.inventoryDigest;
    if (typeof inventoryDigest!=='string'||!/^[a-f0-9]{64}$/.test(inventoryDigest)) return deny('privacy_consent_scope_mismatch');
    // Finish reading mutable policy/context/receipt fields before the asynchronous digest.
    // This is a candidate snapshot only; execution still requires fresh transactional checks.
    const decision=evaluateAtlasPolicy({...policy,requestId:context.requestId,permissions:actor.permissions});
    if (decision.outcome!=='allow') return deny('privacy_policy_not_allowed');
    if (inventoryDigest!==await digestApprovalPayload(inventory)) return deny('privacy_consent_scope_mismatch');
    return {status:'eligible_for_transaction',reason:'metadata_preflight_only',verified:false,authorization:'not_granted'};
  } catch { return deny('privacy_preflight_failed'); }
}
