import { describe, expect, it } from 'vitest';
import { resolveEntitlement } from '../../packages/hospitality/entitlements';

describe('Hospitality guest entitlements', () => {
  it('fails closed when an authoritative source is unavailable', () => {
    expect(resolveEntitlement({
      sourceAvailable: false,
      rules: []
    })).toEqual({ status: 'source_unavailable', reasonCode: 'source_unavailable' });
  });

  it('uses the most specific applicable configured rule', () => {
    expect(resolveEntitlement({
      sourceAvailable: true,
      rules: [
        { id: 'brand-rule', scope: 'brand', status: 'eligible', reasonCode: 'brand_policy', quantity: 1 },
        { id: 'property-rule', scope: 'property', status: 'eligible', reasonCode: 'property_package', quantity: 2 },
        { id: 'stay-rule', scope: 'stay', status: 'eligible', reasonCode: 'stay_override', quantity: 3 }
      ]
    })).toEqual({
      status: 'eligible',
      reasonCode: 'stay_override',
      ruleId: 'stay-rule',
      quantity: 3
    });
  });

  it('does not invent eligibility when no approved rule exists', () => {
    expect(resolveEntitlement({ sourceAvailable: true, rules: [] }))
      .toEqual({ status: 'manual_review', reasonCode: 'rule_not_found' });
  });

  it('keeps monetary and quantity entitlements explicit', () => {
    expect(resolveEntitlement({
      sourceAvailable: true,
      rules: [{ id: 'credit', scope: 'property', status: 'eligible', reasonCode: 'package_included', monetaryAmount: 30, currency: 'USD' }]
    })).toEqual({
      status: 'eligible',
      reasonCode: 'package_included',
      ruleId: 'credit',
      monetaryAmount: 30,
      currency: 'USD'
    });
  });
});
