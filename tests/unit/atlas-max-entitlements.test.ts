import { describe, expect, it } from 'vitest';
import { evaluateEntitlement } from '../../apps/web/src/services/atlas-max/entitlements';

describe('ATLAS MAX entitlements', () => {
  const base = {
    tenantId: 'tenant-a',
    actorTenantId: 'tenant-a',
    userId: 'user-1',
    planId: 'max' as const,
    subscriptionState: 'active' as const,
    requestedFeature: 'persistent-operators',
    featureFlags: ['persistent-operators'],
    quotaRemaining: 10,
    policyAllowed: true,
    evidenceRef: 'evt-1',
  };

  it('allows a valid server-authoritative MAX entitlement', () => {
    expect(evaluateEntitlement(base)).toEqual({
      status: 'allowed',
      planId: 'max',
      evidenceRef: 'evt-1',
    });
  });

  it('ignores forged client plan input', () => {
    expect(evaluateEntitlement({ ...base, clientClaimedPlanId: 'max', planId: 'core' })).toMatchObject({
      status: 'denied',
      reason: 'feature_not_entitled',
    });
  });

  it('denies inactive subscriptions', () => {
    expect(evaluateEntitlement({ ...base, subscriptionState: 'past_due' })).toMatchObject({
      status: 'denied',
      reason: 'subscription_inactive',
    });
  });

  it('denies cross-tenant requests before feature evaluation', () => {
    expect(evaluateEntitlement({ ...base, actorTenantId: 'tenant-b' })).toMatchObject({
      status: 'denied',
      reason: 'tenant_mismatch',
    });
  });
});
