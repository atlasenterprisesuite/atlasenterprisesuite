import { describe, expect, it } from 'vitest';
import {
  AtlasPayError,
  UnavailableIssuingAdapter,
  UnavailablePayoutAdapter,
  providerEligibility,
  quotePayout,
  resolveInstrumentEligibility,
  selectPayoutRoute,
  summarizeBalanceEvidence,
  type AtlasBalanceEvidence,
  type AtlasPayProviderReadiness
} from '../../packages/pay/src';

const readyProvider: AtlasPayProviderReadiness = {
  id: 'issuer-a',
  displayName: 'Verified issuer',
  kind: 'sponsor_bank',
  environment: 'sandbox',
  authorized: true,
  credentialsConfigured: true,
  regulatoryCoverageVerified: true,
  capabilities: ['wallet', 'card_issuing', 'standard_payout', 'instant_payout'],
  currencies: ['USD'],
  checkedAt: '2026-10-01T12:00:00Z'
};

describe('ATLAS Pay issuing and payout core', () => {
  it('fails closed when no issuing provider is configured', async () => {
    const adapter = new UnavailableIssuingAdapter();

    await expect(
      adapter.issue({
        organizationId: 'org-1',
        ownerReference: 'worker-1',
        kind: 'virtual_card',
        currency: 'USD',
        idempotencyKey: 'issue-1'
      })
    ).rejects.toMatchObject({ code: 'ATLAS_PAY_ISSUER_UNAVAILABLE' });
  });

  it('fails closed when no payout provider is configured', async () => {
    const adapter = new UnavailablePayoutAdapter();

    await expect(
      adapter.payout({
        organizationId: 'org-1',
        ownerReference: 'worker-1',
        amountMinor: 10000n,
        currency: 'USD',
        method: 'instant',
        destinationReference: 'external-account-token',
        idempotencyKey: 'payout-1'
      })
    ).rejects.toMatchObject({ code: 'ATLAS_PAY_PAYOUT_PROVIDER_UNAVAILABLE' });
  });

  it('requires authorization, credentials and regulatory coverage before capability use', () => {
    expect(providerEligibility({ ...readyProvider, authorized: false }, 'card_issuing', 'USD')).toMatchObject({
      eligible: false,
      code: 'PROVIDER_NOT_AUTHORIZED'
    });
    expect(providerEligibility({ ...readyProvider, credentialsConfigured: false }, 'card_issuing', 'USD')).toMatchObject({
      eligible: false,
      code: 'CREDENTIALS_REQUIRED'
    });
    expect(providerEligibility({ ...readyProvider, regulatoryCoverageVerified: false }, 'card_issuing', 'USD')).toMatchObject({
      eligible: false,
      code: 'REGULATORY_COVERAGE_REQUIRED'
    });
  });

  it('allows an instrument only when a verified provider supports its capability and currency', () => {
    expect(resolveInstrumentEligibility([], 'virtual_card', 'USD')).toEqual({
      eligible: false,
      providerId: null,
      code: 'PROVIDER_REQUIRED'
    });

    expect(resolveInstrumentEligibility([readyProvider], 'business_card', 'usd')).toEqual({
      eligible: true,
      providerId: 'issuer-a',
      code: null
    });
  });

  it('routes only through available and verified payout rails', () => {
    const routes = [
      {
        providerId: 'slow-cheap',
        rail: 'ach' as const,
        method: 'standard' as const,
        available: true,
        verified: true,
        feeMinor: 25n,
        estimatedArrivalSeconds: 86400
      },
      {
        providerId: 'fast',
        rail: 'provider_instant' as const,
        method: 'instant' as const,
        available: true,
        verified: true,
        feeMinor: 100n,
        estimatedArrivalSeconds: 60
      },
      {
        providerId: 'unverified',
        rail: 'fednow' as const,
        method: 'instant' as const,
        available: true,
        verified: false,
        feeMinor: 1n,
        estimatedArrivalSeconds: 5
      }
    ];

    expect(selectPayoutRoute(routes, 'fastest')?.providerId).toBe('fast');
    expect(selectPayoutRoute(routes, 'lowest_fee')?.providerId).toBe('slow-cheap');
  });

  it('discloses provider and ATLAS fees without allowing a non-positive net payout', () => {
    expect(quotePayout(10000n, 100n, 150n)).toEqual({
      amountMinor: 10000n,
      providerFeeMinor: 100n,
      atlasFeeMinor: 150n,
      netMinor: 9750n
    });

    expect(() => quotePayout(100n, 50n, 50n)).toThrowError(AtlasPayError);
  });

  it('keeps balance domains and currencies separate while using only latest source evidence', () => {
    const evidence: AtlasBalanceEvidence[] = [
      {
        id: 'old-wallet', accountId: 'acct-1', balanceKind: 'wallet', amountMinor: 1000n,
        currency: 'USD', state: 'available', sourceKind: 'external_provider', sourceReference: 'wallet-main',
        observedAt: '2026-10-06T10:00:00Z'
      },
      {
        id: 'new-wallet', accountId: 'acct-1', balanceKind: 'wallet', amountMinor: 1500n,
        currency: 'usd', state: 'available', sourceKind: 'external_provider', sourceReference: 'wallet-main',
        observedAt: '2026-10-06T11:00:00Z'
      },
      {
        id: 'earnings', accountId: 'acct-1', balanceKind: 'earnings', amountMinor: 700n,
        currency: 'USD', state: 'pending', sourceKind: 'external_provider', sourceReference: 'creator-earnings',
        observedAt: '2026-10-06T11:30:00Z'
      },
      {
        id: 'rewards-eur', accountId: 'acct-1', balanceKind: 'rewards', amountMinor: 300n,
        currency: 'EUR', state: 'available', sourceKind: 'external_provider', sourceReference: 'rewards',
        observedAt: '2026-10-06T12:00:00Z'
      },
      {
        id: 'unavailable-credit', accountId: 'acct-1', balanceKind: 'credits', amountMinor: 999n,
        currency: 'USD', state: 'unavailable', sourceKind: 'manual_evidence', sourceReference: 'credit-note',
        observedAt: '2026-10-06T12:30:00Z'
      }
    ];

    expect(summarizeBalanceEvidence(evidence)).toEqual([
      { balanceKind: 'earnings', currency: 'USD', state: 'pending', amountMinor: 700n, evidenceCount: 1 },
      { balanceKind: 'rewards', currency: 'EUR', state: 'available', amountMinor: 300n, evidenceCount: 1 },
      { balanceKind: 'wallet', currency: 'USD', state: 'available', amountMinor: 1500n, evidenceCount: 1 }
    ]);
  });
});
