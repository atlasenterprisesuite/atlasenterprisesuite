/** Fail-closed repair decision contract. Pure: no filesystem, network, or provider side effects. */
export type RepairState = 'detected' | 'diagnosed' | 'patch_proposed' | 'tests_passed' | 'verified' | 'blocked';
export type RepairEvidence = {
  incidentId: string;
  tenantId: string;
  targetSha: string;
  observedSha: string;
  isolated: boolean;
  authorized: boolean;
  testsPassed: boolean;
  securityPassed: boolean;
  auditReceiptId?: string;
};
export type RepairDecision = { state: RepairState; reason: string; canClaimRepaired: boolean };
const shaPattern = /^[a-f0-9]{40}$/i;
export function evaluateRepair(e: RepairEvidence): RepairDecision {
  if (!e.incidentId || !e.tenantId || !shaPattern.test(e.targetSha) || !shaPattern.test(e.observedSha))
    return { state: 'blocked', reason: 'invalid_identity_or_sha', canClaimRepaired: false };
  if (!e.authorized || !e.isolated)
    return { state: 'blocked', reason: 'authorization_or_isolation_missing', canClaimRepaired: false };
  if (e.targetSha !== e.observedSha)
    return { state: 'blocked', reason: 'sha_mismatch', canClaimRepaired: false };
  if (!e.testsPassed || !e.securityPassed)
    return { state: 'blocked', reason: 'verification_failed', canClaimRepaired: false };
  if (!e.auditReceiptId?.trim())
    return { state: 'blocked', reason: 'audit_receipt_missing', canClaimRepaired: false };
  return { state: 'verified', reason: 'evidence_complete', canClaimRepaired: true };
}
