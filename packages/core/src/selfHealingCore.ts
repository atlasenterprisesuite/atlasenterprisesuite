/**
 * ATLAS Self-Healing Core: pure, fail-closed decision engine.
 * This module NEVER executes commands, deploys, grants permissions, or changes data.
 * Actions require a separate audited, least-privilege executor.
 */
export type HealingSeverity = 'p0' | 'p1' | 'p2';
export type HealingAction = 'retry-transient' | 'restart-ephemeral' | 'restore-verified-config' | 'rollback';
export type HealingDecision =
  | { status: 'blocked'; reason: string }
  | { status: 'manual-review'; reason: string }
  | { status: 'eligible'; action: HealingAction; incidentId: string; sourceSha: string; idempotencyKey: string };

export interface HealingIncident {
  id: string;
  tenantId: string;
  severity: HealingSeverity;
  action: HealingAction;
  sourceSha: string;
  expectedSha: string;
  observedSha: string;
  signalVerified: boolean;
  authorizationVerified: boolean;
  tenantScopeVerified: boolean;
  auditSinkAvailable: boolean;
  p0GatesPassed: boolean;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt: number | null;
  now: number;
  cooldownMs: number;
}

const SAFE_AUTOMATIC_ACTIONS = new Set<HealingAction>(['retry-transient', 'restart-ephemeral']);

export function planSelfHealing(incident: HealingIncident): HealingDecision {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(incident.id) ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(incident.tenantId)) {
    return { status: 'blocked', reason: 'invalid-identity' };
  }
  if (!/^[a-f0-9]{40}$/i.test(incident.sourceSha) ||
      !/^[a-f0-9]{40}$/i.test(incident.expectedSha) ||
      !/^[a-f0-9]{40}$/i.test(incident.observedSha) ||
      incident.sourceSha !== incident.expectedSha ||
      incident.observedSha !== incident.expectedSha) {
    return { status: 'blocked', reason: 'exact-sha-mismatch' };
  }
  if (!incident.signalVerified || !incident.authorizationVerified ||
      !incident.tenantScopeVerified || !incident.auditSinkAvailable ||
      !incident.p0GatesPassed) {
    return { status: 'blocked', reason: 'missing-security-or-evidence-gate' };
  }
  if (!Number.isSafeInteger(incident.attempts) ||
      !Number.isSafeInteger(incident.maxAttempts) ||
      incident.attempts < 0 || incident.maxAttempts < 1 ||
      incident.attempts >= incident.maxAttempts) {
    return { status: 'blocked', reason: 'retry-budget-exhausted-or-invalid' };
  }
  if (!Number.isFinite(incident.now) || incident.now < 0 ||
      !Number.isFinite(incident.cooldownMs) || incident.cooldownMs < 0 ||
      (incident.lastAttemptAt !== null &&
        (!Number.isFinite(incident.lastAttemptAt) ||
         incident.lastAttemptAt < 0 || incident.lastAttemptAt > incident.now ||
         incident.now - incident.lastAttemptAt < incident.cooldownMs))) {
    return { status: 'blocked', reason: 'cooldown-or-clock-invalid' };
  }
  if (!SAFE_AUTOMATIC_ACTIONS.has(incident.action) || incident.severity === 'p0') {
    return { status: 'manual-review', reason: 'protected-action-or-p0' };
  }
  return {
    status: 'eligible',
    action: incident.action,
    incidentId: incident.id,
    sourceSha: incident.sourceSha,
    idempotencyKey: [incident.tenantId, incident.id, incident.action, incident.sourceSha, incident.attempts].join(':')
  };
}
