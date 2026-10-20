import { describe, expect, it } from 'vitest';
import { evaluateGrowthTrust, type GrowthTrustInput } from '../../packages/advisory/src/growthTrustPolicy';

const baseline: GrowthTrustInput = {
  canonicalAuthorizationAllowed: true,
  tenantScopeVerified: true,
  providerConnectionVerified: true,
  organizationAuthorized: true,
  purpose: 'ad_delivery',
  consent: { subjectMatches: true, purposeMatches: true, granted: true, revoked: false, expired: false },
  campaign: { approved: true, spendingLimitCents: 10000, spentCents: 4000, proposedSpendCents: 6000 }
};

describe('ATLAS Growth x Trust fail-closed boundary', () => {
  it('permits the fully authorized budget-bounded case', () => {
    expect(evaluateGrowthTrust(baseline)).toEqual({ allowed: true });
  });

  it.each([
    [{ canonicalAuthorizationAllowed: false }, 'authorization_denied'],
    [{ tenantScopeVerified: false }, 'tenant_unverified'],
    [{ providerConnectionVerified: false }, 'provider_unverified'],
    [{ organizationAuthorized: false }, 'organization_not_authorized'],
    [{ consent: null }, 'consent_required'],
    [{ consent: { ...baseline.consent!, revoked: true } }, 'consent_required'],
    [{ consent: { ...baseline.consent!, expired: true } }, 'consent_required'],
    [{ consent: { ...baseline.consent!, purposeMatches: false } }, 'consent_required'],
    [{ consent: { ...baseline.consent!, subjectMatches: false } }, 'consent_required'],
    [{ campaign: { ...baseline.campaign!, approved: false } }, 'campaign_not_approved'],
    [{ campaign: { ...baseline.campaign!, proposedSpendCents: 6001 } }, 'budget_exceeded'],
    [{ campaign: { ...baseline.campaign!, proposedSpendCents: NaN } }, 'invalid_spend'],
    [{ campaign: { ...baseline.campaign!, proposedSpendCents: -1 } }, 'invalid_spend']
  ] as const)('rejects invalid condition %#', (change, reason) => {
    expect(evaluateGrowthTrust({ ...baseline, ...change })).toEqual({ allowed: false, reason });
  });
});
