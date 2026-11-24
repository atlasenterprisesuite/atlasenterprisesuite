import { describe, expect, it } from 'vitest';
import { calculateCampaignEconomics, parseUsdCents } from '../../packages/advisory/src/campaignEconomics';

const scenario = { spendCents: 10000, clicks: 100, leads: 10, customers: 2, attributedRevenueCents: 30000 };
describe('campaign economics simulation', () => {
  it('distinguishes click, lead and customer costs from attributed revenue', () => {
    expect(calculateCampaignEconomics(scenario)).toEqual({ mode: 'simulation', cpcCents: 100, costPerLeadCents: 1000, adCostPerCustomerCents: 5000, roas: 3 });
  });
  it('does not fabricate ratios when denominators are zero', () => {
    expect(calculateCampaignEconomics({ spendCents: 0, clicks: 0, leads: 0, customers: 0, attributedRevenueCents: 0 })).toEqual({ mode: 'simulation', cpcCents: null, costPerLeadCents: null, adCostPerCustomerCents: null, roas: null });
  });
  it.each([-1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid amounts or counts: %s', value => {
    for (const field of Object.keys(scenario)) expect(() => calculateCampaignEconomics({ ...scenario, [field]: value })).toThrow('invalid_campaign_input');
  });
  it('allows zero advertising cost without treating it as unavailable', () => {
    expect(calculateCampaignEconomics({ ...scenario, spendCents: 0 }).costPerLeadCents).toBe(0);
  });
  it('parses USD exactly without binary rounding', () => {
    expect(parseUsdCents('0.29')).toBe(29);
    expect(parseUsdCents('100')).toBe(10000);
    expect(parseUsdCents('100.1')).toBe(10010);
  });
  it.each(['', '-1', '1.001', 'NaN', 'Infinity', '1e3', '9,00', '9007199254740992'])('rejects invalid money: %s', value => {
    expect(() => parseUsdCents(value)).toThrow('invalid_usd_amount');
  });
});
