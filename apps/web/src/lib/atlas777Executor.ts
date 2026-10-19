// ATLAS 777: deterministic, side-effect-free job state transitions.
// Persistent storage, leases, authenticated event ingestion and workers are separate gates.
export type JobStatus = 'queued' | 'leased' | 'completed' | 'blocked' | 'dead_letter';
export type Job = Readonly<{
  id: string;
  sourceEventId: string;
  repository: string;
  targetSha: string;
  action: 'inspect' | 'test' | 'draft_pr';
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  leaseOwner: string | null;
  leaseUntilMs: number | null;
  nextAttemptMs: number;
}>;
export type Transition = { job: Job; accepted: boolean; reason: string };
const SHA = /^[a-f0-9]{40}$/i;
const ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const REPO = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
function valid(job: Job): boolean {
  return ID.test(job.id) && ID.test(job.sourceEventId) && REPO.test(job.repository)
    && SHA.test(job.targetSha) && Number.isSafeInteger(job.attempts)
    && Number.isSafeInteger(job.maxAttempts) && job.attempts >= 0
    && job.maxAttempts >= 1 && job.maxAttempts <= 10
    && Number.isSafeInteger(job.nextAttemptMs)
    && (job.leaseUntilMs === null || Number.isSafeInteger(job.leaseUntilMs))
    && (job.leaseOwner === null || ID.test(job.leaseOwner))
    && ['inspect', 'test', 'draft_pr'].includes(job.action);
}
function deny(job: Job, reason: string): Transition { return { job, accepted: false, reason }; }
export function enqueue(input: Omit<Job, 'status' | 'attempts' | 'leaseOwner' | 'leaseUntilMs' | 'nextAttemptMs'>, nowMs: number): Job {
  const job: Job = { ...input, status: 'queued', attempts: 0, leaseOwner: null, leaseUntilMs: null, nextAttemptMs: nowMs };
  if (!valid(job) || !Number.isSafeInteger(nowMs)) throw new RangeError('invalid_job');
  return job;
}
export function claim(job: Job, owner: string, nowMs: number, leaseMs: number): Transition {
  if (!valid(job) || !ID.test(owner) || !Number.isSafeInteger(nowMs)
    || !Number.isSafeInteger(leaseMs) || leaseMs < 1000 || leaseMs > 300000) return deny(job, 'invalid_claim');
  const expired = job.status === 'leased' && job.leaseUntilMs !== null && job.leaseUntilMs <= nowMs;
  if (job.status !== 'queued' && !expired) return deny(job, 'not_claimable');
  if (nowMs < job.nextAttemptMs) return deny(job, 'backoff');
  if (job.attempts >= job.maxAttempts) return { job: { ...job, status: 'dead_letter', leaseOwner: null, leaseUntilMs: null }, accepted: false, reason: 'retry_exhausted' };
  return { job: { ...job, status: 'leased', attempts: job.attempts + 1, leaseOwner: owner, leaseUntilMs: nowMs + leaseMs }, accepted: true, reason: 'claimed' };
}
export function finish(job: Job, owner: string, nowMs: number, outcome: 'completed' | 'blocked' | 'retry'): Transition {
  if (!valid(job) || !ID.test(owner) || !Number.isSafeInteger(nowMs)
    || job.status !== 'leased' || job.leaseOwner !== owner
    || job.leaseUntilMs === null || nowMs >= job.leaseUntilMs) return deny(job, 'stale_or_unauthorized_lease');
  if (outcome === 'completed' || outcome === 'blocked') {
    return { job: { ...job, status: outcome, leaseOwner: null, leaseUntilMs: null }, accepted: true, reason: outcome };
  }
  if (outcome !== 'retry') return deny(job, 'invalid_outcome');
  const exhausted = job.attempts >= job.maxAttempts;
  const delay = Math.min(300000, 1000 * 2 ** Math.min(job.attempts - 1, 8));
  return { job: { ...job, status: exhausted ? 'dead_letter' : 'queued', leaseOwner: null, leaseUntilMs: null, nextAttemptMs: nowMs + delay }, accepted: true, reason: exhausted ? 'retry_exhausted' : 'retry_scheduled' };
}
