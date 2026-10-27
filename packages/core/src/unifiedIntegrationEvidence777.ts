/**
 * Read-only consistency gate for evidence from runtime (#917), certification (#928)
 * and repair (#931). NOT an authorization grant or transactional concurrency lock.
 * Callers must obtain trusted server-side fields and enforce atomic replay/lease
 * fencing in PostgreSQL before any side effect.
 */
export type UnifiedIntegrationEvidence777 = {
  organizationId: string;
  tenantId: string;
  actorOrganizationId: string;
  actorTenantId: string;
  actorRole: string;
  membershipActive: boolean;
  targetSha: string;
  observedSha: string;
  runtimeLeaseValid: boolean;
  certificationVerified: boolean;
  repairVerified: boolean;
  auditReceiptId: string;
  auditReceiptOrganizationId: string;
  auditReceiptTenantId: string;
  auditReceiptSha: string;
  idempotencyKey: string;
  receiptAlreadyConsumed: boolean;
  concurrentClaimCount: number;
};
export type UnifiedEvidenceDecision777 = {
  allowed: boolean;
  reason: string;
};
const SHA40 = /^[0-9a-f]{40}$/;
const deny = (reason: string): UnifiedEvidenceDecision777 => ({ allowed: false, reason });
export function evaluateUnifiedIntegrationEvidence777(e: UnifiedIntegrationEvidence777): UnifiedEvidenceDecision777 {
  if (!e.organizationId?.trim() || !e.tenantId?.trim() ||
      e.organizationId !== e.actorOrganizationId || e.tenantId !== e.actorTenantId ||
      e.organizationId !== e.auditReceiptOrganizationId || e.tenantId !== e.auditReceiptTenantId)
    return deny('scope_mismatch');
  if (!e.membershipActive || !['admin', 'owner'].includes(e.actorRole))
    return deny('rbac_denied');
  if (!SHA40.test(e.targetSha) || e.targetSha !== e.observedSha || e.targetSha !== e.auditReceiptSha)
    return deny('sha_mismatch');
  if (!e.runtimeLeaseValid || e.concurrentClaimCount !== 1)
    return deny('lease_or_concurrency_unverified');
  if (!e.certificationVerified || !e.repairVerified)
    return deny('verification_missing');
  if (!e.auditReceiptId?.trim() || !e.idempotencyKey?.trim() || e.receiptAlreadyConsumed)
    return deny('audit_or_replay_unverified');
  return { allowed: true, reason: 'evidence_consistent' };
}
