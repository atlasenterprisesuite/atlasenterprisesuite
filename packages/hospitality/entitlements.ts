export type HospitalityEntitlementStatus =
  | 'eligible'
  | 'not_eligible'
  | 'manual_review'
  | 'source_unavailable'
  | 'expired'
  | 'invalid_context'
  | 'error';

export type HospitalityEntitlementScope = 'system' | 'brand' | 'portfolio' | 'property' | 'stay';

export type HospitalityEntitlementRuleDecision = {
  id: string;
  scope: HospitalityEntitlementScope;
  status: 'eligible' | 'not_eligible' | 'manual_review';
  reasonCode: string;
  quantity?: number;
  monetaryAmount?: number;
  currency?: string;
};

export type HospitalityEntitlementDecision = {
  status: HospitalityEntitlementStatus;
  reasonCode: string;
  ruleId?: string;
  quantity?: number;
  monetaryAmount?: number;
  currency?: string;
};

const SCOPE_PRIORITY: Record<HospitalityEntitlementScope, number> = {
  system: 0,
  brand: 1,
  portfolio: 2,
  property: 3,
  stay: 4
};

export function resolveEntitlement(input: {
  sourceAvailable: boolean;
  rules: readonly HospitalityEntitlementRuleDecision[];
}): HospitalityEntitlementDecision {
  if (!input.sourceAvailable) {
    return { status: 'source_unavailable', reasonCode: 'source_unavailable' };
  }

  if (input.rules.length === 0) {
    return { status: 'manual_review', reasonCode: 'rule_not_found' };
  }

  const selected = [...input.rules].sort((a, b) =>
    SCOPE_PRIORITY[b.scope] - SCOPE_PRIORITY[a.scope] || a.id.localeCompare(b.id)
  )[0];

  const decision: HospitalityEntitlementDecision = {
    status: selected.status,
    reasonCode: selected.reasonCode,
    ruleId: selected.id
  };
  if (selected.quantity !== undefined) decision.quantity = selected.quantity;
  if (selected.monetaryAmount !== undefined) decision.monetaryAmount = selected.monetaryAmount;
  if (selected.currency !== undefined) decision.currency = selected.currency;
  return decision;
}
