/** Read-only recovery planner. No SQL mutations or external effects. */
export type RecoverySnapshot = Readonly<{
  orgId: string;
  jobOrgId: string;
  tenantId: string;
  jobTenantId: string;
  state: 'queued' | 'claimed' | 'running' | 'waiting_human' | 'completed' | 'failed';
  leaseExpiresAtMs: number | null;
  nowMs: number;
  externalEffectCount: number;
  p0Open: boolean;
}>;
export type RecoveryPlan = Readonly<{
  action: 'observe' | 'quarantine' | 'halt';
  reason: string;
}>;

/** A plan is NOT a DB authorization: a privileged atomic RPC must revalidate scope, lease and state. */
export function planRecovery(snapshot: RecoverySnapshot): RecoveryPlan {
  if (!snapshot.orgId || !snapshot.tenantId || snapshot.orgId !== snapshot.jobOrgId ||
      snapshot.tenantId !== snapshot.jobTenantId) return { action: 'halt', reason: 'scope_mismatch' };
  if (snapshot.p0Open) return { action: 'halt', reason: 'p0_open' };
  if (!Number.isFinite(snapshot.nowMs) || !Number.isSafeInteger(snapshot.externalEffectCount) ||
      snapshot.externalEffectCount < 0) return { action: 'halt', reason: 'invalid_evidence' };
  if (snapshot.state === 'completed' || snapshot.state === 'failed' || snapshot.state === 'waiting_human') {
    return { action: 'observe', reason: 'terminal_or_manual_state' };
  }
  if (snapshot.state === 'queued') return { action: 'observe', reason: 'await_atomic_claim' };
  if (snapshot.externalEffectCount > 0) {
    return { action: 'quarantine', reason: 'external_effect_must_not_replay' };
  }
  if (snapshot.leaseExpiresAtMs === null || !Number.isFinite(snapshot.leaseExpiresAtMs)) {
    return { action: 'quarantine', reason: 'missing_lease_evidence' };
  }
  if (snapshot.leaseExpiresAtMs <= snapshot.nowMs) {
    return { action: 'quarantine', reason: 'expired_lease_requires_atomic_rpc' };
  }
  return { action: 'observe', reason: 'active_lease' };
}
