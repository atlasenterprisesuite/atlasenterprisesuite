import { describe, expect, it } from 'vitest';
import { evaluateContinuity, type ContinuitySignal } from '../../packages/core/src';

const base: ContinuitySignal = {
  dependencyId: 'example-r2-read',
  dependencyVerified: true,
  operation: 'read',
  priority: 'P0',
  tenantAccess: 'verified',
  integrity: 'verified',
  probe: 'healthy',
  providerIncidentActive: true
};

const fallback: NonNullable<ContinuitySignal['fallback']> = {
  configured: true,
  tenantAccess: 'verified',
  probe: 'healthy',
  integrity: 'verified',
  sameObjectVersion: true
};

describe('ATLAS Continuity Fabric — deterministic policy and fail-closed boundaries', () => {
  it('does not treat provider headlines as proof of ATLAS dependency', () => {
    expect(evaluateContinuity({ ...base, dependencyVerified: false, probe: 'failed' }))
      .toMatchObject({ gate: 'none', action: 'observe', reason: 'dependency_not_verified' });
  });

  it('preserves a healthy and verified primary despite a provider-level incident', () => {
    expect(evaluateContinuity(base))
      .toMatchObject({ gate: 'none', action: 'primary', reason: 'primary_verified' });
  });

  it('refuses access denied or missing tenancy evidence', () => {
    for (const tenantAccess of ['denied', 'unverified'] as const) {
      expect(evaluateContinuity({ ...base, tenantAccess, fallback }))
        .toMatchObject({ gate: 'blocked', action: 'deny', priority: 'P0' });
    }
  });

  it('fails closed on primary checksum mismatch rather than switching to a secondary', () => {
    expect(evaluateContinuity({ ...base, integrity: 'failed', fallback }))
      .toMatchObject({ gate: 'blocked', action: 'deny', reason: 'integrity_mismatch' });
  });

  it('chooses a configured verified same-version read fallback on primary failure', () => {
    expect(evaluateContinuity({ ...base, probe: 'failed', fallback }))
      .toMatchObject({ gate: 'none', action: 'verified-read-fallback', reason: 'fallback_evidence_complete' });
  });

  it('refuses a stale or unauthorized read fallback even when it responds', () => {
    for (const candidate of [
      { ...fallback, sameObjectVersion: false },
      { ...fallback, tenantAccess: 'unverified' as const },
      { ...fallback, integrity: 'unverified' as const },
      { ...fallback, probe: 'unverified' as const }
    ]) {
      expect(evaluateContinuity({ ...base, probe: 'failed', fallback: candidate }))
        .toMatchObject({ gate: 'blocked', action: 'deny' });
    }
  });

  it('never automatically fails over writes, even with an otherwise healthy secondary', () => {
    expect(evaluateContinuity({ ...base, operation: 'write', probe: 'failed', fallback }))
      .toMatchObject({ gate: 'blocked', action: 'deny' });
  });

  it('degrades an optional feature without globally blocking it', () => {
    expect(evaluateContinuity({ ...base, priority: 'P1', probe: 'failed' }))
      .toMatchObject({ gate: 'warning', action: 'degrade', priority: 'P1' });
  });

  it('keeps critical operations blocked while verification is unknown', () => {
    expect(evaluateContinuity({ ...base, probe: 'unverified', integrity: 'unverified' }))
      .toMatchObject({ gate: 'blocked', action: 'deny', reason: 'primary_unverified' });
  });

  it('rejects blank dependency IDs', () => {
    expect(() => evaluateContinuity({ ...base, dependencyId: ' ' }))
      .toThrow('invalid_continuity_dependency_id');
  });
});
