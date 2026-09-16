import type { NightArchivePolicy, NightQueueStatus } from '../../task-protocol/src';

export type NightFailureClass = 'transient' | 'permanent' | 'human_required';

export function computeRetryDelayMs(options: {
  attempt: number;
  baseMs?: number;
  maxMs?: number;
  retryAfterMs?: number | null;
  random?: () => number;
}): number {
  if (options.retryAfterMs != null) return Math.max(0, options.retryAfterMs);
  const baseMs = options.baseMs ?? 1_000;
  const maxMs = options.maxMs ?? 60_000;
  const raw = Math.min(maxMs, baseMs * 2 ** Math.max(0, options.attempt));
  const random = options.random ?? Math.random;
  const jitterFactor = 0.5 + random();
  return Math.min(maxMs, Math.max(0, Math.round(raw * jitterFactor)));
}

export function classifyNightFailure(input: { httpStatus?: number | null; code?: string | null }): NightFailureClass {
  if (input.code === 'HUMAN_APPROVAL_REQUIRED' || input.code === 'CREDENTIAL_REQUIRED') return 'human_required';
  if (input.httpStatus === 429 || (input.httpStatus != null && input.httpStatus >= 500)) return 'transient';
  if (input.code && ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN'].includes(input.code)) return 'transient';
  return 'permanent';
}

export function isLeaseExpired(leaseExpiresAt: string | null, now: string): boolean {
  return !leaseExpiresAt || leaseExpiresAt <= now;
}

export function makeNightIdempotencyKey(input: {
  queueItemId: string;
  taskId: string;
  operation: string;
  stepKey: string;
}): string {
  return ['night', input.queueItemId, input.taskId, input.operation, input.stepKey]
    .map((part) => encodeURIComponent(part))
    .join(':');
}

export function isArchiveEligible(input: {
  status: NightQueueStatus;
  verificationPassed: boolean;
  openBlockers: number;
  archivePolicy: NightArchivePolicy;
}): boolean {
  return input.status === 'completed_autonomous'
    && input.verificationPassed
    && input.openBlockers === 0
    && input.archivePolicy === 'eligible_on_verified_completion';
}
