import {
  authorize,
  createAuditEvent,
  type AuthorizationContext,
  type TenantScope
} from '../../core/src';
import {
  resolveAdvisoryProviderReadiness,
  type AdvisoryProviderAuthorizationEvidence,
  type AdvisoryProviderConnectionEvidence
} from './providerReadiness';
import {
  evaluateGrowthTrust,
  type GrowthTrustDecision
} from './growthTrustPolicy';

/**
 * Adapter for a trusted server-side caller, not an endpoint.
 * Consent, provider, budget and actor facts MUST be resolved from canonical
 * server-side stores within the active tenant. Never pass browser assertions.
 */
export type ScopedGrowthProviderConnection = AdvisoryProviderConnectionEvidence & {
  scope: TenantScope;
};
export type ScopedGrowthProviderAuthorization = AdvisoryProviderAuthorizationEvidence & {
  scope: TenantScope;
};
export type AdvertisingConsentEvidence = {
  scope: TenantScope;
  subjectId: string;
  purpose: 'ad_delivery';
  status: 'granted' | 'denied';
  grantedAt: string;
  expiresAt: string;
  revokedAt: string | null;
};
export type GrowthCampaignEvidence = {
  id: string;
  scope: TenantScope;
  provider: string;
  approved: boolean;
  spendingLimitCents: number;
  spentCents: number;
  proposedSpendCents: number;
};

export type GovernedGrowthAdDeliveryInput = {
  actor: AuthorizationContext;
  actorId: string;
  resourceScope: TenantScope;
  subjectId: string;
  now: string;
  consent: AdvertisingConsentEvidence | null;
  providerConnections: readonly ScopedGrowthProviderConnection[];
  providerAuthorizations: readonly ScopedGrowthProviderAuthorization[];
  campaign: GrowthCampaignEvidence | null;
};

function matchesScope(left: TenantScope, right: TenantScope): boolean {
  return Boolean(
    left?.tenantId?.trim() && left?.organizationId?.trim() &&
    right?.tenantId?.trim() && right?.organizationId?.trim() &&
    left.tenantId === right.tenantId &&
    left.organizationId === right.organizationId
  );
}

function parseTimestamp(value: string): number {
  if (typeof value !== 'string' || !/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return NaN;
  return Date.parse(value);
}

function consentIsCurrent(input: GovernedGrowthAdDeliveryInput): boolean {
  const consent = input.consent;
  const now = parseTimestamp(input.now);
  if (!consent || !Number.isFinite(now)) return false;
  const grantedAt = parseTimestamp(consent.grantedAt);
  const expiresAt = parseTimestamp(consent.expiresAt);
  return Boolean(
    matchesScope(consent.scope, input.resourceScope) &&
    typeof input.subjectId === 'string' && input.subjectId.trim() &&
    consent.subjectId === input.subjectId &&
    consent.purpose === 'ad_delivery' &&
    consent.status === 'granted' &&
    consent.revokedAt === null &&
    Number.isFinite(grantedAt) &&
    Number.isFinite(expiresAt) &&
    grantedAt <= now && now < expiresAt
  );
}

/**
 * The underlying ledger/budget transaction must still acquire a DB lock or
 * reserve the spend atomically before contacting any advertising provider.
 */
export function authorizeGovernedGrowthAdDelivery(input: GovernedGrowthAdDeliveryInput):
  GrowthTrustDecision & { audit: ReturnType<typeof createAuditEvent> } {
  const scopeMatches = matchesScope(input.actor.scope, input.resourceScope);
  const canonical = authorize(input.actor, {
    scope: input.resourceScope,
    permission: 'advisory.manage'
  });
  const campaign = input.campaign;
  const campaignInScope = Boolean(
    campaign && matchesScope(campaign.scope, input.resourceScope) &&
    typeof campaign.id === 'string' && campaign.id.trim() &&
    typeof campaign.provider === 'string' && campaign.provider.trim()
  );
  const matchingConnections = (input.providerConnections || []).filter(
    (item) => matchesScope(item.scope, input.resourceScope) &&
      campaignInScope && item.provider === campaign!.provider
  );
  const matchingAuthorizations = (input.providerAuthorizations || []).filter(
    (item) => matchesScope(item.scope, input.resourceScope)
  );
  const paidMedia = resolveAdvisoryProviderReadiness(
    matchingConnections,
    matchingAuthorizations
  ).find((item) => item.capability === 'paid_media');

  const currentConsent = consentIsCurrent(input);
  const decision = evaluateGrowthTrust({
    canonicalAuthorizationAllowed: canonical.ok,
    tenantScopeVerified: scopeMatches,
    providerConnectionVerified: campaignInScope && paidMedia?.status === 'connected',
    organizationAuthorized: paidMedia?.organizationAuthorized === true,
    purpose: 'ad_delivery',
    consent: {
      subjectMatches: currentConsent,
      purposeMatches: currentConsent,
      granted: currentConsent,
      revoked: !currentConsent,
      expired: !currentConsent
    },
    campaign: campaignInScope ? {
      approved: campaign!.approved,
      spendingLimitCents: campaign!.spendingLimitCents,
      spentCents: campaign!.spentCents,
      proposedSpendCents: campaign!.proposedSpendCents
    } : undefined
  });

  return {
    ...decision,
    audit: createAuditEvent({
      scope: input.resourceScope,
      actorId: input.actorId,
      action: 'advisory.growth.ad_delivery.authorize',
      resource: campaignInScope ? `growth-campaign:${campaign!.id}` : 'growth-campaign:unresolved',
      result: decision.allowed ? 'success' : 'denied',
      occurredAt: input.now
    })
  };
}
