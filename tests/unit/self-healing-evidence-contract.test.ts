import { describe, expect, it } from 'vitest';
import { evaluateRepair, type RepairEvidence } from '../../packages/infra-control/recovery/repair-evidence-contract';
const sha = 'a'.repeat(40);
const good: RepairEvidence = { incidentId: 'inc-1', tenantId: 'tenant-a', targetSha: sha, observedSha: sha, isolated: true, authorized: true, testsPassed: true, securityPassed: true, auditReceiptId: 'receipt-1' };
describe('self-healing evidence gate', () => {
  it('accepts a fully evidenced isolated repair', () => expect(evaluateRepair(good).canClaimRepaired).toBe(true));
  it.each([
    [{ authorized: false }, 'authorization_or_isolation_missing'],
    [{ isolated: false }, 'authorization_or_isolation_missing'],
    [{ observedSha: 'b'.repeat(40) }, 'sha_mismatch'],
    [{ testsPassed: false }, 'verification_failed'],
    [{ securityPassed: false }, 'verification_failed'],
    [{ auditReceiptId: '' }, 'audit_receipt_missing'],
    [{ tenantId: '' }, 'invalid_identity_or_sha'],
    [{ targetSha: 'main' }, 'invalid_identity_or_sha'],
  ])('fails closed for %j', (patch, reason) => {
    expect(evaluateRepair({ ...good, ...patch })).toEqual({ state: 'blocked', reason, canClaimRepaired: false });
  });
});
