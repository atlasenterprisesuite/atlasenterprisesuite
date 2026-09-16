import { describe, expect, it } from 'vitest';
import {
  classifyNightFailure,
  computeRetryDelayMs,
  isArchiveEligible,
  isLeaseExpired,
  makeNightIdempotencyKey,
} from '../../packages/ai-core/src/nightOperationsPolicy';

describe('ATLAS Night Operations policy', () => {
  it('uses bounded exponential backoff and honors Retry-After', () => {
    expect(computeRetryDelayMs({ attempt: 0, baseMs: 1_000, maxMs: 60_000, random: () => 0.5 })).toBe(1_000);
    expect(computeRetryDelayMs({ attempt: 3, baseMs: 1_000, maxMs: 60_000, random: () => 0.5 })).toBe(8_000);
    expect(computeRetryDelayMs({ attempt: 20, baseMs: 1_000, maxMs: 60_000, random: () => 0.5 })).toBe(60_000);
    expect(computeRetryDelayMs({ attempt: 1, retryAfterMs: 12_345, random: () => 0 })).toBe(12_345);
  });

  it('classifies temporary provider and network failures as transient', () => {
    expect(classifyNightFailure({ httpStatus: 429 })).toBe('transient');
    expect(classifyNightFailure({ httpStatus: 503 })).toBe('transient');
    expect(classifyNightFailure({ code: 'ETIMEDOUT' })).toBe('transient');
    expect(classifyNightFailure({ code: 'HUMAN_APPROVAL_REQUIRED' })).toBe('human_required');
    expect(classifyNightFailure({ httpStatus: 403 })).toBe('permanent');
  });

  it('creates a stable idempotency key for the same logical operation', () => {
    const input = { queueItemId: 'NQ-1', taskId: 'ATL-1', operation: 'persist-evidence', stepKey: 'verify' };
    expect(makeNightIdempotencyKey(input)).toBe(makeNightIdempotencyKey(input));
    expect(makeNightIdempotencyKey(input)).not.toBe(makeNightIdempotencyKey({ ...input, stepKey: 'archive' }));
  });

  it('treats lease expiry and archive eligibility fail-closed', () => {
    expect(isLeaseExpired('2026-09-16T03:00:00.000Z', '2026-09-16T03:00:01.000Z')).toBe(true);
    expect(isLeaseExpired(null, '2026-09-16T03:00:01.000Z')).toBe(true);

    expect(isArchiveEligible({
      status: 'completed_autonomous',
      verificationPassed: true,
      openBlockers: 0,
      archivePolicy: 'eligible_on_verified_completion',
    })).toBe(true);

    expect(isArchiveEligible({
      status: 'completed_autonomous',
      verificationPassed: false,
      openBlockers: 0,
      archivePolicy: 'eligible_on_verified_completion',
    })).toBe(false);
  });
});