/** Sovereign runner authorization contract. Pure policy only: no process execution. */
export type RunnerJob = {
  jobId: string;
  tenantId: string;
  requestedBy: string;
  repository: string;
  commitSha: string;
  kind: 'gps5d-synthetic-tdd';
  leaseId: string;
  attempt: number;
  isolationEvidenceId: string;
  dependencyEvidenceId: string;
};
export type RunnerGrant = {
  tenantId: string;
  principalId: string;
  activeMember: boolean;
  canExecuteTests: boolean;
  approved: boolean;
};
export type RunnerDecision = { allowed: boolean; reasons: string[] };
const SHA = /^[a-f0-9]{40}$/;
const IDENT = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;
const REPO = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;

/** Authorization is rechecked at claim AND immediately before execution. */
export function authorizeRunnerJob(job: unknown, grant: unknown): RunnerDecision {
  const reasons: string[] = [];
  if (!job || typeof job !== 'object' || Array.isArray(job)) return { allowed: false, reasons: ['invalid-job'] };
  const j = job as Partial<RunnerJob>;
  const g = grant && typeof grant === 'object' && !Array.isArray(grant) ? grant as Partial<RunnerGrant> : {};
  for (const key of ['jobId', 'tenantId', 'requestedBy', 'leaseId', 'isolationEvidenceId', 'dependencyEvidenceId'] as const) {
    if (typeof j[key] !== 'string' || !IDENT.test(j[key])) reasons.push('invalid-' + key);
  }
  if (typeof j.commitSha !== 'string' || !SHA.test(j.commitSha)) reasons.push('invalid-sha');
  if (typeof j.repository !== 'string' || !REPO.test(j.repository)) reasons.push('invalid-repository');
  if (j.kind !== 'gps5d-synthetic-tdd') reasons.push('unsupported-kind');
  if (!Number.isSafeInteger(j.attempt) || (j.attempt ?? 0) < 1) reasons.push('invalid-attempt');
  if (g.tenantId !== j.tenantId || g.principalId !== j.requestedBy || g.activeMember !== true ||
      g.canExecuteTests !== true || g.approved !== true) reasons.push('unauthorized');
  return { allowed: reasons.length === 0, reasons };
}

export type RunnerReceipt = {
  jobId: string;
  tenantId: string;
  commitSha: string;
  leaseId: string;
  attempt: number;
  status: 'passed' | 'failed' | 'cancelled';
  isolationVerified: boolean;
  dependenciesVerified: boolean;
  cleanupVerified: boolean;
  evidenceDigest: string;
};

/** A reported pass is not certified until independent evidence checks succeed. */
export function certifyRunnerReceipt(job: RunnerJob, receipt: RunnerReceipt | null): boolean {
  return !!receipt && receipt.jobId === job.jobId && receipt.tenantId === job.tenantId &&
    receipt.commitSha === job.commitSha && receipt.leaseId === job.leaseId &&
    receipt.attempt === job.attempt && receipt.status === 'passed' &&
    receipt.isolationVerified === true && receipt.dependenciesVerified === true &&
    receipt.cleanupVerified === true && /^[a-f0-9]{64}$/.test(receipt.evidenceDigest);
}

/** Cancellation requires the current lease, preventing stale workers from cancelling a new attempt. */
export function authorizeRunnerCancellation(job: RunnerJob, grant: RunnerGrant, leaseId: string): boolean {
  return leaseId === job.leaseId && authorizeRunnerJob(job, grant).allowed;
}
