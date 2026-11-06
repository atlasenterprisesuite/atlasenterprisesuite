import { describe, expect, it } from 'vitest';
import { previewNetworkCampaignAttribution } from '../../packages/advisory/src/growthAttributionPreview';
const scope = { tenantId: 't-a', organizationId: 'o-a' };
const row = { id: 'ref-1', org_id: 'o-a', customer_id: 'customer-1', campaign_id: 'campaign-1', policy_version: 'v1', status: 'converted', first_touch_at: '2026-10-01T00:00:00Z', converted_at: '2026-11-02T00:00:00Z' };
const input = () => ({ actor: { scope, permissions: ['analytics.read'] as const }, resourceScope: scope, campaignId: 'campaign-1', from: '2026-11-01T00:00:00Z', to: '2026-12-01T00:00:00Z', rows: [row] });
describe('existing network attribution preview boundary', () => {
  it('counts supplied converted referrals without claiming paid customers, complete coverage or financial evidence', () => {
    expect(previewNetworkCampaignAttribution(input())).toEqual({ convertedReferralsInProvidedRows: 1, paidCustomers: null, spendCents: null, attributedRevenueCents: null, reportingReady: false });
  });
  it('deduplicates identical rows and uses an exclusive end date', () => {
    const data = input();
    expect(previewNetworkCampaignAttribution({ ...data, rows: [row, { ...row }, { ...row, id: 'ref-2', customer_id: 'customer-2', converted_at: data.to }] }).convertedReferralsInProvidedRows).toBe(1);
  });
  it('counts neither pending, rejected nor reversed referrals as conversions', () => {
    for (const status of ['pending', 'qualified', 'rejected', 'reversed']) expect(previewNetworkCampaignAttribution({ ...input(), rows: [{ ...row, status }] }).convertedReferralsInProvidedRows).toBe(0);
  });
  it('returns no personal identifiers', () => {
    const output = JSON.stringify(previewNetworkCampaignAttribution(input()));
    expect(output).not.toContain(row.customer_id);
    expect(output).not.toContain(row.id);
  });
  it.each([{ organizationId: 'o-b', tenantId: 't-a' }, { organizationId: 'o-a', tenantId: 't-b' }, { organizationId: '', tenantId: '' }])('denies foreign or empty scope', resourceScope => {
    expect(() => previewNetworkCampaignAttribution({ ...input(), resourceScope })).toThrow();
  });
  it('requires analytics authorization even if advisory access exists', () => {
    expect(() => previewNetworkCampaignAttribution({ ...input(), actor: { scope, permissions: ['advisory.read'] } })).toThrow('attribution_access_denied');
  });
  it.each([{ org_id: 'o-b' }, { campaign_id: 'other' }, { campaign_id: null }, { policy_version: '' }, { id: '' }, { customer_id: '' }, { status: 'unknown' }, { converted_at: null }, { first_touch_at: '2026-11-03T00:00:00Z' }, { converted_at: 'invalid' }, { converted_at: '2026-11-31T00:00:00Z' }])('rejects contaminated or malformed source rows', change => {
    expect(() => previewNetworkCampaignAttribution({ ...input(), rows: [{ ...row, ...change }] })).toThrow();
  });
  it('rejects conflicting duplicate row IDs or conversion ownership', () => {
    expect(() => previewNetworkCampaignAttribution({ ...input(), rows: [row, { ...row, customer_id: 'other' }] })).toThrow('attribution_duplicate_conflict');
    expect(() => previewNetworkCampaignAttribution({ ...input(), rows: [row, { ...row, id: 'ref-2' }] })).toThrow('attribution_customer_conflict');
  });
  it('rejects missing, invalid or reversed reporting windows', () => {
    for (const from of ['', 'invalid', input().to]) expect(() => previewNetworkCampaignAttribution({ ...input(), from })).toThrow('attribution_window_invalid');
  });
});
