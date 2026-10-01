import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const modulePath = '../../apps/web/src/modules/pay/payDomain';
const sourcePath = 'apps/web/src/modules/pay/payDomain.ts';
const domain = existsSync(sourcePath) ? await import(modulePath) : null;

describe('ATLAS Pay domain truthfulness', () => {
  it('normalizes unknown readiness conservatively', () => {
    expect(domain).not.toBeNull();
    expect(domain!.normalizePayReadiness('eligible')).toBe('eligible');
    expect(domain!.normalizePayReadiness('provider_verified')).toBe('provider_verified');
    expect(domain!.normalizePayReadiness('mystery_live')).toBe('unavailable');
    expect(domain!.normalizePayReadiness(null)).toBe('unavailable');
  });

  it('only treats provider-verified or eligible capability as operational', () => {
    expect(domain).not.toBeNull();
    const base = {
      id: 'cap-1',
      orgId: 'org-1',
      provider: 'provider-a',
      country: 'US',
      currency: 'USD',
      productType: 'account',
      operation: 'receive',
      eligibilityState: 'unconfigured',
      complianceTier: null,
      limits: {},
      unavailableReason: null,
      verifiedAt: null
    };
    expect(domain!.isOperationalPayCapability({ ...base, readinessState: 'provider_verified' })).toBe(true);
    expect(domain!.isOperationalPayCapability({ ...base, readinessState: 'eligible' })).toBe(true);
    expect(domain!.isOperationalPayCapability({ ...base, readinessState: 'provider_sandbox' })).toBe(false);
    expect(domain!.isOperationalPayCapability({ ...base, readinessState: 'restricted' })).toBe(false);
  });

  it('formats integer minor-unit balances without inventing null values', () => {
    expect(domain).not.toBeNull();
    expect(domain!.formatMinorAmount(null, 'USD')).toBeNull();
    expect(domain!.formatMinorAmount(145078, 'USD')).toBe('$1,450.78');
    expect(domain!.formatMinorAmount(98050, 'GBP')).toBe('£980.50');
  });

  it('marks missing, invalid, and older-than-24h balances stale', () => {
    expect(domain).not.toBeNull();
    const now = Date.parse('2026-09-29T16:00:00Z');
    expect(domain!.isBalanceStale(null, now)).toBe(true);
    expect(domain!.isBalanceStale('not-a-date', now)).toBe(true);
    expect(domain!.isBalanceStale('2026-09-28T15:59:59Z', now)).toBe(true);
    expect(domain!.isBalanceStale('2026-09-29T08:00:00Z', now)).toBe(false);
  });
});
