import { getPlanCatalog } from './catalog';
import type { AtlasCapability, AtlasPlanId, EntitlementDecision } from './contracts';

export type SubscriptionState = 'active' | 'past_due' | 'canceled' | 'inactive';

export interface EntitlementInput {
  tenantId: string;
  actorTenantId: string;
  userId: string;
  planId: AtlasPlanId;
  subscriptionState: SubscriptionState;
  requestedFeature: string;
  featureFlags: readonly string[];
  quotaRemaining: number;
  policyAllowed: boolean;
  evidenceRef?: string;
  clientClaimedPlanId?: AtlasPlanId;
}

export function evaluateEntitlement(input: EntitlementInput): EntitlementDecision {
  if (input.tenantId !== input.actorTenantId) {
    return { status: 'denied', reason: 'tenant_mismatch' };
  }

  if (input.subscriptionState !== 'active') {
    return { status: 'denied', reason: 'subscription_inactive' };
  }

  if (!input.policyAllowed) {
    return { status: 'denied', reason: 'policy_denied' };
  }

  if (input.quotaRemaining <= 0) {
    return { status: 'denied', reason: 'quota_exhausted' };
  }

  const plan = getPlanCatalog().find((candidate) => candidate.id === input.planId);
  const feature = input.requestedFeature as AtlasCapability;
  if (!plan || !plan.capabilities.includes(feature) || !input.featureFlags.includes(input.requestedFeature)) {
    return { status: 'denied', reason: 'feature_not_entitled' };
  }

  return {
    status: 'allowed',
    planId: input.planId,
    evidenceRef: input.evidenceRef,
  };
}
