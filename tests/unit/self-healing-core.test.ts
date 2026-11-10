import { describe, expect, it } from 'vitest';
import { planSelfHealing, type HealingIncident } from '../../packages/core/src/selfHealingCore';

const sha = 'a'.repeat(40);
function valid(): HealingIncident {
  return {
    id: 'incident-1', tenantId: 'tenant-1', severity: 'p1',
    action: 'retry-transient', sourceSha: sha, expectedSha: sha, observedSha: sha,
    signalVerified: true, authorizationVerified: true, tenantScopeVerified: true,
    auditSinkAvailable: true, p0GatesPassed: true, attempts: 0, maxAttempts: 3,
    lastAttemptAt: null, now: 10000, cooldownMs: 1000
  };
}

describe('ATLAS Self-Healing Core fail-closed policy', () => {
  it('allows only bounded low-risk action with full evidence', () => {
    expect(planSelfHealing(valid())).toMatchObject({status: 'eligible', action: 'retry-transient'});
  });
  it.each(['signalVerified', 'authorizationVerified', 'tenantScopeVerified',
    'auditSinkAvailable', 'p0GatesPassed'] as const)('blocks when %s is absent', (key) => {
    expect(planSelfHealing({...valid(), [key]: false}).status).toBe('blocked');
  });
  it('blocks cross-version drift', () => {
    expect(planSelfHealing({...valid(), observedSha: 'b'.repeat(40)})).toMatchObject({
      status: 'blocked', reason: 'exact-sha-mismatch'
    });
  });
  it('blocks exhausted retries and cooling down', () => {
    expect(planSelfHealing({...valid(), attempts: 3}).status).toBe('blocked');
    expect(planSelfHealing({...valid(), lastAttemptAt: 9500}).status).toBe('blocked');
  });
  it('never autonomously rolls back or modifies verified configuration', () => {
    expect(planSelfHealing({...valid(), action: 'rollback'}).status).toBe('manual-review');
    expect(planSelfHealing({...valid(), action: 'restore-verified-config'}).status).toBe('manual-review');
  });
  it('never autonomously repairs p0 incidents', () => {
    expect(planSelfHealing({...valid(), severity: 'p0'}).status).toBe('manual-review');
  });
  it('rejects malformed clocks and identities', () => {
    expect(planSelfHealing({...valid(), now: NaN}).status).toBe('blocked');
    expect(planSelfHealing({...valid(), tenantId: '../other'}).status).toBe('blocked');
  });
});
