import { describe, expect, it } from 'vitest';
import { assessDurableClaim, type DurableClaimEvidence } from '../../apps/web/src/modules/device-os/atlasDurableClaimGuard';
const base: DurableClaimEvidence = {
  orgId: 'org-a', jobOrgId: 'org-a', tenantId: 'tenant-a', jobTenantId: 'tenant-a',
  runtimeId: 'runtime-a', claimedRuntimeId: 'runtime-a', leaseId: 'lease-a', claimedLeaseId: 'lease-a',
  leaseExpiresAtMs: 2000, nowMs: 1000, idempotencyKey: 'key-a', reservedIdempotencyKey: 'key-a',
  auditPersisted: true, auditAppendOnlyVerified: true, providerReceiptAuthenticated: true, p0Open: false
};
describe('ATLAS durable claim guard denies unverified external effects', () => {
  it('denies even apparently valid client evidence until atomic server verification exists', () => {
    expect(assessDurableClaim(base)).toEqual({ allowed: false, blockers: ['atomic_server_verification_not_implemented'] });
  });
  it.each([
    [{ jobOrgId: 'org-b' }, 'scope_mismatch'],
    [{ jobTenantId: 'tenant-b' }, 'scope_mismatch'],
    [{ claimedRuntimeId: 'runtime-b' }, 'lease_ownership_unverified'],
    [{ claimedLeaseId: 'lease-b' }, 'lease_ownership_unverified'],
    [{ leaseExpiresAtMs: 1000 }, 'lease_ownership_unverified'],
    [{ reservedIdempotencyKey: 'key-b' }, 'idempotency_unverified'],
    [{ auditPersisted: false }, 'audit_unverified'],
    [{ auditAppendOnlyVerified: false }, 'audit_unverified'],
    [{ providerReceiptAuthenticated: false }, 'provider_receipt_unverified'],
    [{ p0Open: true }, 'p0_open'],
  ] as const)('denies unsafe evidence %#', (patch, blocker) => {
    const result = assessDurableClaim({ ...base, ...patch });
    expect(result.allowed).toBe(false);
    expect(result.blockers).toContain(blocker);
  });
});
