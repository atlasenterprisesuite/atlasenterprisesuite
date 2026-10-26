/** Contract preflight only: never writes a ledger or authorizes a provider call. */
export type DurableClaimEvidence = Readonly<{
  orgId: string;
  jobOrgId: string;
  tenantId: string;
  jobTenantId: string;
  runtimeId: string;
  claimedRuntimeId: string;
  leaseId: string;
  claimedLeaseId: string;
  leaseExpiresAtMs: number;
  nowMs: number;
  idempotencyKey: string;
  reservedIdempotencyKey: string;
  auditPersisted: boolean;
  auditAppendOnlyVerified: boolean;
  providerReceiptAuthenticated: boolean;
  p0Open: boolean;
}>;
export function assessDurableClaim(e: DurableClaimEvidence): { allowed: false; blockers: string[] } {
  const blockers: string[] = [];
  if (!e.orgId || e.orgId !== e.jobOrgId || !e.tenantId || e.tenantId !== e.jobTenantId) blockers.push('scope_mismatch');
  if (!e.runtimeId || e.runtimeId !== e.claimedRuntimeId || !e.leaseId || e.leaseId !== e.claimedLeaseId ||
      !Number.isFinite(e.nowMs) || !Number.isFinite(e.leaseExpiresAtMs) || e.leaseExpiresAtMs <= e.nowMs) blockers.push('lease_ownership_unverified');
  if (!e.idempotencyKey || e.idempotencyKey !== e.reservedIdempotencyKey) blockers.push('idempotency_unverified');
  if (!e.auditPersisted || !e.auditAppendOnlyVerified) blockers.push('audit_unverified');
  if (!e.providerReceiptAuthenticated) blockers.push('provider_receipt_unverified');
  if (e.p0Open) blockers.push('p0_open');
  // Browser/client assertions cannot prove PostgreSQL transaction ownership or provider authenticity.
  blockers.push('atomic_server_verification_not_implemented');
  return { allowed: false, blockers };
}
