import { describe, expect, it } from 'vitest';
import { runCarrierLab } from '../../supabase/functions/_shared/carrier-lab';

const base = {
  organizationId: 'org-test',
  actorId: 'actor-test',
  seed: 777,
  count: 100,
  channel: 'voice' as const,
  scenario: 'success' as const
};

describe('ATLAS Carrier Lab 777', () => {
  it('is deterministic and labels all results as synthetic', () => {
    const first = runCarrierLab(base);
    expect(runCarrierLab(base)).toEqual(first);
    expect(first.mode).toBe('simulation');
    expect(first.productionReady).toBe(false);
    expect(first.total).toBe(100);
    expect(first.passed).toBe(100);
    expect(first.events.every(e =>
      e.synthetic && e.realNumber === null &&
      e.esimProfile === null && e.providerEvidence === null
    )).toBe(true);
  });

  it('simulates provider outages without reporting a real call', () => {
    const result = runCarrierLab({ ...base, scenario: 'provider_unavailable' });
    expect(result.failed).toBe(100);
    expect(result.passed).toBe(0);
    expect(result.events.every(e => e.outcome === 'simulated_failure')).toBe(true);
  });

  it('supports all channels without provisioning', () => {
    for (const channel of ['voice', 'sms', 'data', 'esim'] as const) {
      const result = runCarrierLab({ ...base, channel });
      expect(result.events.every(e => e.channel === channel && e.synthetic)).toBe(true);
    }
  });

  it('rejects unbounded workloads, bad seeds and missing tenant identity', () => {
    expect(() => runCarrierLab({ ...base, count: 10001 })).toThrow('carrier_lab_count_invalid');
    expect(() => runCarrierLab({ ...base, count: 0 })).toThrow('carrier_lab_count_invalid');
    expect(() => runCarrierLab({ ...base, seed: -1 })).toThrow('carrier_lab_seed_invalid');
    expect(() => runCarrierLab({ ...base, organizationId: '' })).toThrow('carrier_lab_identity_required');
    expect(() => runCarrierLab({ ...base, actorId: '' })).toThrow('carrier_lab_identity_required');
  });
});
