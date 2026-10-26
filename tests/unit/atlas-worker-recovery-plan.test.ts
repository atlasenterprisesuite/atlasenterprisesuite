import { describe, expect, it } from 'vitest';
import { planRecovery, type RecoverySnapshot } from '../../apps/web/src/modules/device-os/atlasWorkerRecoveryPlan';

const base: RecoverySnapshot = {
  orgId: 'org-a', jobOrgId: 'org-a', tenantId: 'tenant-a', jobTenantId: 'tenant-a',
  state: 'running', leaseExpiresAtMs: 2000, nowMs: 1000, externalEffectCount: 0, p0Open: false
};

describe('ATLAS recovery plan never replays provider effects', () => {
  it('observes active lease without mutating it', () => {
    expect(planRecovery(base)).toEqual({ action: 'observe', reason: 'active_lease' });
  });
  it.each([
    [{ jobOrgId: 'org-b' }, 'scope_mismatch'],
    [{ jobTenantId: 'tenant-b' }, 'scope_mismatch'],
    [{ p0Open: true }, 'p0_open'],
    [{ externalEffectCount: -1 }, 'invalid_evidence'],
  ] as const)('halts unsafe recovery %#', (patch, reason) => {
    expect(planRecovery({ ...base, ...patch })).toEqual({ action: 'halt', reason });
  });
  it.each([
    [{ externalEffectCount: 1 }, 'external_effect_must_not_replay'],
    [{ leaseExpiresAtMs: null }, 'missing_lease_evidence'],
    [{ leaseExpiresAtMs: 1000 }, 'expired_lease_requires_atomic_rpc'],
  ] as const)('quarantines uncertain recovery %#', (patch, reason) => {
    expect(planRecovery({ ...base, ...patch })).toEqual({ action: 'quarantine', reason });
  });
  it('never automatically reclaims queued or completed jobs', () => {
    expect(planRecovery({ ...base, state: 'queued' }).action).toBe('observe');
    expect(planRecovery({ ...base, state: 'completed' }).action).toBe('observe');
  });
});
