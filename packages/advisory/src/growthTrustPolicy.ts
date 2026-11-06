/**
 * ATLAS Growth x Trust: a fail-closed decision boundary.
 * This is a pure policy function, not an API endpoint or an authorization substitute.
 * Server-side callers MUST validate identity, tenant scope, RBAC/RLS, evidence and approvals.
 */
export type GrowthTrustInput = {
  canonicalAuthorizationAllowed: boolean;
  tenantScopeVerified: boolean;
  providerConnectionVerified: boolean;
  organizationAuthorized: boolean;
  purpose: 'analytics' | 'ad_delivery' | 'personalization';
  consent: {
    subjectMatches: boolean;
    purposeMatches: boolean;
    granted: boolean;
    revoked: boolean;
    expired: boolean;
  } | null;
  campaign?: {
    approved: boolean;
    spendingLimitCents: number;
    spentCents: number;
    proposedSpendCents: number;
  };
};

export type GrowthTrustDecision =
  | { allowed: true }
  | { allowed: false; reason:
      'authorization_denied' | 'tenant_unverified' | 'provider_unverified' |
      'organization_not_authorized' | 'consent_required' |
      'campaign_not_approved' | 'invalid_spend' | 'budget_exceeded' };

export function evaluateGrowthTrust(input: GrowthTrustInput): GrowthTrustDecision {
  if (!input.canonicalAuthorizationAllowed) return { allowed: false, reason: 'authorization_denied' };
  if (!input.tenantScopeVerified) return { allowed: false, reason: 'tenant_unverified' };
  if (!input.providerConnectionVerified) return { allowed: false, reason: 'provider_unverified' };
  if (!input.organizationAuthorized) return { allowed: false, reason: 'organization_not_authorized' };

  const consent = input.consent;
  if (
    !consent || !consent.subjectMatches || !consent.purposeMatches ||
    !consent.granted || consent.revoked || consent.expired
  ) return { allowed: false, reason: 'consent_required' };

  if (input.purpose === 'ad_delivery') {
    const campaign = input.campaign;
    if (!campaign?.approved) return { allowed: false, reason: 'campaign_not_approved' };
    if (
      !Number.isSafeInteger(campaign.spendingLimitCents) ||
      !Number.isSafeInteger(campaign.spentCents) ||
      !Number.isSafeInteger(campaign.proposedSpendCents) ||
      campaign.spendingLimitCents < 0 || campaign.spentCents < 0 ||
      campaign.proposedSpendCents <= 0
    ) return { allowed: false, reason: 'invalid_spend' };
    if (
      campaign.spentCents > campaign.spendingLimitCents ||
      campaign.proposedSpendCents > campaign.spendingLimitCents - campaign.spentCents
    ) return { allowed: false, reason: 'budget_exceeded' };
  }

  return { allowed: true };
}
