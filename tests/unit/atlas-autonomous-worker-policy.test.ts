import { describe, expect, it } from 'vitest';
import { decideWorkerStep, type WorkerSnapshot } from '../../apps/web/src/modules/device-os/atlasAutonomousWorkerPolicy';

const valid: WorkerSnapshot = {
  tenantId: 'tenant-a', runtimeTenantId: 'tenant-a', leaseId: 'lease-a',
  leaseExpiresAtMs: 2000, nowMs: 1000, attempt: 0, maxAttempts: 3,
  p0Open: false, consent: 'active', effectStatus: 'none', providerEvidenceVerified: false
};

describe('ATLAS autonomous worker fail-closed eligibility', () => {
  it('permits only a read-only claim preflight for a valid snapshot', () => {
    expect(decideWorkerStep(valid)).toEqual({ action: 'eligible_for_claim', reason: 'safe_read_only_work_only' });
  });
  it.each([
    [{ runtimeTenantId: 'tenant-b' }, 'tenant_mismatch'],
    [{ p0Open: true }, 'p0_open'],
    [{ consent: 'revoked' }, 'consent_not_active'],
    [{ consent: 'unknown' }, 'consent_not_active'],
    [{ leaseId: null }, 'lease_missing_or_expired'],
    [{ leaseExpiresAtMs: 1000 }, 'lease_missing_or_expired'],
    [{ attempt: 3 }, 'retry_budget_exhausted'],
    [{ attempt: -1 }, 'retry_budget_exhausted'],
    [{ maxAttempts: 0 }, 'retry_budget_exhausted'],
  ] as const)('stops on unsafe snapshot %#', (patch, reason) => {
    expect(decideWorkerStep({ ...valid, ...patch })).toEqual({ action: 'stop', reason });
  });
  it.each(['reserved', 'unknown', 'confirmed', 'rejected'] as const)(
    'quarantines %s provider effect without replay', effectStatus => {
      expect(decideWorkerStep({ ...valid, effectStatus })).toEqual({
        action: 'wait_for_human', reason: 'external_effect_requires_provider_reconciliation'
      });
    }
  );
  it('quarantines unexpected provider evidence', () => {
    expect(decideWorkerStep({ ...valid, providerEvidenceVerified: true }).action).toBe('wait_for_human');
  });
});
