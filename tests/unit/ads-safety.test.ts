import { describe, expect, it } from 'vitest';
import { adsSameScope, authorizeAdsDraft, authorizeAdsActivation, validateAdsCampaign, verifiedAdsMetric, adsIdempotencyKey } from '../../packages/ads/src/index';
const scope = { tenantId: 'tenant-a', organizationId: 'org-a' };
const campaign = { id: 'c1', scope, status: 'approved' as const, budgetMinor: 1000, reservedMinor: 0, currency: 'USD' };
const actor = { scope, permissions: ['ads.manage', 'ads.publish'] };
const ready = { authorized: true, providerVerified: true, state: 'connected' };
describe('ATLAS Ads negative safety contract', () => {
  it('ADS-01 denies cross-tenant drafts', () => expect(authorizeAdsDraft({ ...actor, scope: { ...scope, tenantId: 'tenant-b' } }, campaign)).toEqual({ ok: false, reason: 'scope_mismatch' }));
  it('ADS-02 denies missing publish permission', () => expect(authorizeAdsActivation({ ...actor, permissions: [] }, campaign, ready, 1)).toEqual({ ok: false, reason: 'permission_denied' }));
  it('ADS-03 denies unverified or revoked providers', () => { for (const state of ['revoked', 'expired', 'degraded']) expect(authorizeAdsActivation(actor, campaign, { ...ready, state }, 1)).toEqual({ ok: false, reason: 'provider_unavailable' }); });
  it('ADS-04 denies overspend', () => expect(authorizeAdsActivation(actor, campaign, ready, 1001)).toEqual({ ok: false, reason: 'budget_exceeded' }));
  it('ADS-05 denies revoked actor permissions on each call', () => expect(authorizeAdsActivation({ ...actor, permissions: [] }, campaign, ready, 1).ok).toBe(false));
  it('ADS-06 creates scoped deterministic idempotency keys', () => { expect(adsIdempotencyKey(scope, 'c1', 'req')).toBe(adsIdempotencyKey(scope, 'c1', 'req')); expect(adsIdempotencyKey(scope, 'c1', 'req')).not.toBe(adsIdempotencyKey(scope, 'c1', 'req2')); });
  it('ADS-07 never labels demo metrics verified', () => expect(verifiedAdsMetric({ value: 123, sourceState: 'demo' })).toBeNull());
  it('ADS-08 cannot activate externally even if all local guards pass', () => expect(authorizeAdsActivation(actor, campaign, ready, 1)).toEqual({ ok: false, reason: 'external_activation_disabled' }));
  it('ADS-09 rejects invalid reservations and unsafe numbers', () => { expect(validateAdsCampaign({ ...campaign, reservedMinor: 1001 }).ok).toBe(false); expect(validateAdsCampaign({ ...campaign, budgetMinor: Number.MAX_SAFE_INTEGER + 1 }).ok).toBe(false); });
  it('ADS-10 denies organization switching', () => expect(adsSameScope(scope, { ...scope, organizationId: 'org-b' })).toBe(false));
});
