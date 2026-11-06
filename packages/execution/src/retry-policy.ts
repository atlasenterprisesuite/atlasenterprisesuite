import type { ExecutionScope } from './types';

export type AtlasExecutionFailureClass = 'transient' | 'permanent' | 'security' | 'unknown';
export type AtlasExecutionRecoveryOutcome = 'retry_scheduled' | 'dead_letter' | 'blocked';

export type AtlasExecutionRecoveryInput = {
  /** Authenticated scope, resolved on the server (never trusted from a queue payload). */
  scope: ExecutionScope;
  /** Scope persisted with the canonical ATLAS task, checked again on recovery. */
  taskScope: ExecutionScope;
  taskId: string;
  idempotencyKey: string;
  /** SHA of the immutable source being executed. */
  sourceSha: string;
  /** SHA on independently validated failure/audit evidence. */
  evidenceSha: string;
  evidenceRef: string;
  errorCode: string;
  /** One-based failed delivery attempt. */
  attempt: number;
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  /** Result from server-authoritative RBAC/approval evaluation, not client input. */
  authorized: boolean;
};

export type AtlasExecutionRecoveryDecision = {
  outcome: AtlasExecutionRecoveryOutcome;
  classification: AtlasExecutionFailureClass;
  reason: string;
  retryAfterMs: number | null;
};

/**
 * Deterministic decision only. This module DOES NOT enqueue, ACK, replay,
 * execute tasks or create a durable DLQ. Those effects belong to the
 * existing authorized ATLAS execution/persistence boundary.
 */
const TRANSIENT_CODES = new Set([
  'timeout', 'rate_limited', 'service_unavailable',
  'upstream_unavailable', 'connection_reset', 'temporary_network_failure'
]);
const PERMANENT_CODES = new Set([
  'invalid_argument', 'not_found', 'schema_validation_failed', 'unsupported_action'
]);
const SECURITY_CODES = new Set([
  'permission_denied', 'authentication_failed', 'tenant_scope_mismatch',
  'approval_revoked', 'evidence_mismatch'
]);

const SHA_40 = /^[a-f0-9]{40}$/;
const SAFE_KEY = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,127}$/;

export function classifyAtlasExecutionFailure(errorCode: unknown): AtlasExecutionFailureClass {
  if (typeof errorCode !== 'string') return 'unknown';
  if (TRANSIENT_CODES.has(errorCode)) return 'transient';
  if (PERMANENT_CODES.has(errorCode)) return 'permanent';
  if (SECURITY_CODES.has(errorCode)) return 'security';
  return 'unknown';
}

function blocked(reason: string, classification: AtlasExecutionFailureClass = 'unknown'): AtlasExecutionRecoveryDecision {
  return { outcome: 'blocked', classification, reason, retryAfterMs: null };
}

function validScope(scope: ExecutionScope | null | undefined): scope is ExecutionScope {
  return Boolean(
    scope && typeof scope.tenantId === 'string' && SAFE_KEY.test(scope.tenantId)
    && typeof scope.organizationId === 'string' && SAFE_KEY.test(scope.organizationId)
  );
}

export function planAtlasExecutionRecovery(input: AtlasExecutionRecoveryInput): AtlasExecutionRecoveryDecision {
  if (!input || !validScope(input.scope) || !validScope(input.taskScope)) {
    return blocked('scope_invalid');
  }
  if (
    input.scope.tenantId !== input.taskScope.tenantId
    || input.scope.organizationId !== input.taskScope.organizationId
  ) return blocked('scope_mismatch', 'security');

  if (input.authorized !== true) return blocked('authorization_required', 'security');
  if (
    typeof input.taskId !== 'string' || !SAFE_KEY.test(input.taskId)
    || typeof input.idempotencyKey !== 'string' || !SAFE_KEY.test(input.idempotencyKey)
    || typeof input.sourceSha !== 'string' || !SHA_40.test(input.sourceSha)
    || typeof input.evidenceSha !== 'string' || input.evidenceSha !== input.sourceSha
    || typeof input.evidenceRef !== 'string'
    || !input.evidenceRef.trim() || input.evidenceRef.length > 256
    || /[\r\n]/.test(input.evidenceRef)
  ) return blocked('identity_or_evidence_invalid');

  if (
    !Number.isSafeInteger(input.attempt) || input.attempt < 1
    || !Number.isSafeInteger(input.maxAttempts) || input.maxAttempts < 1
    || input.maxAttempts > 10 || input.attempt > input.maxAttempts
    || !Number.isSafeInteger(input.baseDelayMs)
    || input.baseDelayMs < 100 || input.baseDelayMs > 300_000
    || !Number.isSafeInteger(input.maxDelayMs)
    || input.maxDelayMs < input.baseDelayMs || input.maxDelayMs > 3_600_000
  ) return blocked('retry_policy_invalid');

  const classification = classifyAtlasExecutionFailure(input.errorCode);
  if (classification === 'security') return blocked('security_failure_requires_review', 'security');
  if (classification === 'unknown') return blocked('unknown_failure_requires_review');

  if (classification === 'permanent') {
    return {
      outcome: 'dead_letter', classification,
      reason: 'permanent_error_manual_review', retryAfterMs: null
    };
  }
  if (input.attempt === input.maxAttempts) {
    return {
      outcome: 'dead_letter', classification,
      reason: 'attempts_exhausted_manual_review', retryAfterMs: null
    };
  }
  return {
    outcome: 'retry_scheduled', classification,
    reason: 'transient_retry',
    retryAfterMs: Math.min(input.maxDelayMs, input.baseDelayMs * 2 ** (input.attempt - 1))
  };
}
