import { describe, expect, it } from 'vitest';
import { classifyAtlasExecutionFailure, planAtlasExecutionRecovery } from '../../packages/execution/src/retry-policy';

const input = {
  scope: { tenantId: 'tenant-a', organizationId: 'org-a' },
  taskScope: { tenantId: 'tenant-a', organizationId: 'org-a' },
  taskId: 'task-1',
  idempotencyKey: 'tenant-a:task-1:run-1',
  sourceSha: 'a'.repeat(40),
  evidenceSha: 'a'.repeat(40),
  evidenceRef: 'audit:run-1',
  errorCode: 'timeout',
  attempt: 1,
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 3000,
  authorized: true
} as const;

describe('ATLAS execution retry and dead-letter policy', () => {
  it('recognizes only explicitly classified transient errors', () => {
    expect(classifyAtlasExecutionFailure('rate_limited')).toBe('transient');
    expect(classifyAtlasExecutionFailure('timeout')).toBe('transient');
    expect(classifyAtlasExecutionFailure('permission_denied')).toBe('security');
    expect(classifyAtlasExecutionFailure('schema_validation_failed')).toBe('permanent');
    expect(classifyAtlasExecutionFailure('weird_backend_error')).toBe('unknown');
  });

  it('plans bounded deterministic backoff for an authorized transient error', () => {
    expect(planAtlasExecutionRecovery(input)).toEqual({
      outcome: 'retry_scheduled',
      classification: 'transient',
      reason: 'transient_retry',
      retryAfterMs: 1000
    });
    expect(planAtlasExecutionRecovery({ ...input, attempt: 2 }).retryAfterMs).toBe(2000);
    expect(planAtlasExecutionRecovery({ ...input, attempt: 2, baseDelayMs: 2000 }).retryAfterMs).toBe(3000);
    expect(planAtlasExecutionRecovery(input)).toEqual(planAtlasExecutionRecovery(input));
  });

  it('reaches DLQ after a bounded number of transient attempts', () => {
    expect(planAtlasExecutionRecovery({ ...input, attempt: 3 })).toEqual({
      outcome: 'dead_letter',
      classification: 'transient',
      reason: 'attempts_exhausted_manual_review',
      retryAfterMs: null
    });
  });

  it('dead-letters permanently invalid work without automated retry', () => {
    expect(planAtlasExecutionRecovery({ ...input, errorCode: 'invalid_argument' })).toEqual({
      outcome: 'dead_letter',
      classification: 'permanent',
      reason: 'permanent_error_manual_review',
      retryAfterMs: null
    });
  });

  it('blocks authorization and evidence failures without DLQ replay', () => {
    for (const errorCode of ['permission_denied', 'authentication_failed', 'tenant_scope_mismatch', 'approval_revoked', 'evidence_mismatch']) {
      expect(planAtlasExecutionRecovery({ ...input, errorCode })).toMatchObject({
        outcome: 'blocked',
        classification: 'security',
        retryAfterMs: null
      });
    }
  });

  it('unknown provider errors fail closed rather than being assumed transient', () => {
    expect(planAtlasExecutionRecovery({ ...input, errorCode: 'nonexistent_provider_message' })).toMatchObject({
      outcome: 'blocked', classification: 'unknown', retryAfterMs: null
    });
  });

  it('denies any task outside its trusted tenant and organization scope', () => {
    expect(planAtlasExecutionRecovery({
      ...input, taskScope: { tenantId: 'tenant-b', organizationId: 'org-a' }
    })).toMatchObject({ outcome: 'blocked', reason: 'scope_mismatch' });
    expect(planAtlasExecutionRecovery({
      ...input, taskScope: { tenantId: 'tenant-a', organizationId: 'org-b' }
    })).toMatchObject({ outcome: 'blocked', reason: 'scope_mismatch' });
  });

  it('requires authorization, exact SHA and an evidence reference before any recovery decision', () => {
    const invalid = [
      { authorized: false },
      { sourceSha: 'not-a-sha' },
      { evidenceSha: 'b'.repeat(40) },
      { evidenceRef: '' },
      { idempotencyKey: '' },
      { taskId: '' },
      { scope: { tenantId: '', organizationId: 'org-a' } },
    ];
    for (const patch of invalid) {
      expect(planAtlasExecutionRecovery({ ...input, ...patch }).outcome).toBe('blocked');
    }
  });

  it('refuses malformed retry bounds and unsafe numeric values', () => {
    for (const patch of [
      { attempt: 0 }, { attempt: 4 }, { attempt: Number.NaN },
      { maxAttempts: 0 }, { maxAttempts: 100 },
      { baseDelayMs: 0 }, { maxDelayMs: 200 },
      { maxDelayMs: Number.POSITIVE_INFINITY }, { baseDelayMs: -1 }
    ]) {
      expect(planAtlasExecutionRecovery({ ...input, ...patch }).outcome).toBe('blocked');
    }
  });
});
