/**
 * Deterministic, side-effect-free planning only. NOT a worker, scheduler,
 * authorization grant, durable lock, or transactional lease fence.
 * Trusted backend must revalidate membership, leases and evidence atomically.
 */
export type MultipotencyDomain777 = 'intelligence' | 'development' | 'security' | 'verification' | 'recovery' | 'learning';
export type MultipotencyPriority777 = 'P0' | 'P1' | 'P2' | 'P3';
export type MultipotencyTask777 = {
  id: string; domain: MultipotencyDomain777; priority: MultipotencyPriority777;
  organizationId: string; tenantId: string; targetSha: string;
  idempotencyKey: string; leaseId: string; leaseValid: boolean;
  auditReceiptId: string; membershipActive: boolean; actorRole: string;
  evidenceVerified: boolean; dependsOn: string[];
};
export type MultipotencyScope777 = {
  organizationId: string; tenantId: string; sha: string;
  maxConcurrent: number; completedTaskIds?: string[];
};
const domains = new Set(['intelligence','development','security','verification','recovery','learning']);
const priorities: Record<MultipotencyPriority777, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
export function planMultipotency777(tasks: MultipotencyTask777[], scope: MultipotencyScope777): {
  ready: MultipotencyTask777[]; blocked: Array<{ id: string; reason: string }>;
} {
  const blocked: Array<{ id: string; reason: string }> = [];
  if (!Number.isSafeInteger(scope.maxConcurrent) || scope.maxConcurrent < 1 ||
      !/^[a-f0-9]{40}$/.test(scope.sha) || !scope.organizationId || !scope.tenantId)
    return { ready: [], blocked: tasks.map(t => ({ id: t.id, reason: 'invalid_scope_or_limit' })) };
  const counts = (values: string[]) => values.reduce((m, v) => m.set(v, (m.get(v) || 0) + 1), new Map<string, number>());
  const ids = counts(tasks.map(t => t.id));
  const keys = counts(tasks.map(t => t.idempotencyKey));
  const completed = new Set(scope.completedTaskIds || []);
  const eligible: MultipotencyTask777[] = [];
  for (const t of tasks) {
    let reason = '';
    if (!t.id || ids.get(t.id) !== 1 || !t.idempotencyKey || keys.get(t.idempotencyKey) !== 1)
      reason = 'duplicate_identity_or_idempotency';
    else if (!domains.has(t.domain) || !(t.priority in priorities))
      reason = 'invalid_domain_or_priority';
    else if (t.organizationId !== scope.organizationId || t.tenantId !== scope.tenantId ||
      t.targetSha !== scope.sha) reason = 'scope_or_sha_mismatch';
    else if (!t.membershipActive || !['admin','owner'].includes(t.actorRole))
      reason = 'rbac_denied';
    else if (!t.leaseValid || !t.leaseId || !t.auditReceiptId || !t.evidenceVerified)
      reason = 'unverified_lease_audit_or_evidence';
    else if (!Array.isArray(t.dependsOn) || t.dependsOn.some(dep => !completed.has(dep)))
      reason = 'dependency_unverified';
    if (reason) blocked.push({ id: t.id, reason }); else eligible.push(t);
  }
  eligible.sort((a,b) => priorities[a.priority] - priorities[b.priority] || a.id.localeCompare(b.id));
  return { ready: eligible.slice(0,scope.maxConcurrent), blocked: blocked.concat(
    eligible.slice(scope.maxConcurrent).map(t => ({ id:t.id, reason:'concurrency_limit' }))
  ) };
}
