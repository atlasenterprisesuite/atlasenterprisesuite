/** Pure, fail-closed scheduler policy. No provider calls, claims or database writes. */
export type WorkerSnapshot = Readonly<{
  tenantId: string;
  runtimeTenantId: string;
  leaseId: string | null;
  leaseExpiresAtMs: number;
  nowMs: number;
  attempt: number;
  maxAttempts: number;
  p0Open: boolean;
  consent: 'active' | 'revoked' | 'unknown';
  effectStatus: 'none' | 'reserved' | 'unknown' | 'confirmed' | 'rejected';
  providerEvidenceVerified: boolean;
}>;

export type WorkerDecision =
  | { action: 'stop'; reason: string }
  | { action: 'wait_for_human'; reason: string }
  | { action: 'eligible_for_claim'; reason: 'safe_read_only_work_only' };

/** Eligibility is not authorization to execute; server RPC must recheck atomically. */
export function decideWorkerStep(snapshot: WorkerSnapshot): WorkerDecision {
  if (!snapshot.tenantId || snapshot.tenantId !== snapshot.runtimeTenantId) {
    return { action: 'stop', reason: 'tenant_mismatch' };
  }
  if (snapshot.p0Open) return { action: 'stop', reason: 'p0_open' };
  if (snapshot.consent !== 'active') return { action: 'stop', reason: 'consent_not_active' };
  if (!snapshot.leaseId || !Number.isFinite(snapshot.nowMs) ||
      !Number.isFinite(snapshot.leaseExpiresAtMs) || snapshot.leaseExpiresAtMs <= snapshot.nowMs) {
    return { action: 'stop', reason: 'lease_missing_or_expired' };
  }
  if (!Number.isSafeInteger(snapshot.attempt) || !Number.isSafeInteger(snapshot.maxAttempts) ||
      snapshot.attempt < 0 || snapshot.maxAttempts < 1 || snapshot.attempt >= snapshot.maxAttempts) {
    return { action: 'stop', reason: 'retry_budget_exhausted' };
  }
  if (snapshot.effectStatus !== 'none') {
    return { action: 'wait_for_human', reason: 'external_effect_requires_provider_reconciliation' };
  }
  if (snapshot.providerEvidenceVerified) {
    return { action: 'wait_for_human', reason: 'unexpected_provider_evidence' };
  }
  return { action: 'eligible_for_claim', reason: 'safe_read_only_work_only' };
}
