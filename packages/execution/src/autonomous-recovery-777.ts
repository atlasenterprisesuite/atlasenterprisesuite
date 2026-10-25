export type LeaseRecoveryInput = {
  state: 'queued' | 'claimed' | 'running' | 'waiting_human' | 'completed' | 'failed' | 'cancelled';
  leaseExpiresAt: string | null;
  now: string;
  idempotent: boolean;
  verifiedNoSideEffects: boolean;
  attempt: number;
  maxAttempts: number;
};
export type LeaseRecoveryDecision = 'ignore' | 'retry_eligible' | 'quarantine';
/**
 * Decision only: a database transaction must atomically compare-and-swap the lease
 * before requeueing. This function never mutates a job or executes its action.
 */
export function decideExpiredLeaseRecovery(input: LeaseRecoveryInput): LeaseRecoveryDecision {
  if (input.state !== 'claimed' && input.state !== 'running') return 'ignore';
  const expiry = input.leaseExpiresAt ? Date.parse(input.leaseExpiresAt) : NaN;
  const now = Date.parse(input.now);
  if (!Number.isFinite(expiry) || !Number.isFinite(now)) return 'quarantine';
  if (now < expiry) return 'ignore';
  if (!Number.isSafeInteger(input.attempt) || !Number.isSafeInteger(input.maxAttempts) || input.attempt < 0 || input.maxAttempts < 1 || input.attempt >= input.maxAttempts) return 'quarantine';
  // An expired lease does not prove that the remote action failed to execute.
  if (!input.idempotent || !input.verifiedNoSideEffects) return 'quarantine';
  return 'retry_eligible';
}
