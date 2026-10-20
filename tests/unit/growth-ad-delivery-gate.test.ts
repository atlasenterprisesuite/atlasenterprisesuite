import { describe, expect, it } from 'vitest';
import {
  authorizeGovernedGrowthAdDelivery,
  type GovernedGrowthAdDeliveryInput
} from '../../packages/advisory/src/growthAdDeliveryGate';

const scope = { tenantId: 'tenant-a', organizationId: 'org-a' };
const otherScope = { tenantId: 'tenant-b', organizationId: 'org-b' };

function fixtures(): GovernedGrowthAdDeliveryInput {
  return {
    actor: { scope, permissions: ['advisory.manage'] },
    actorId: 'authorized-operator',
    resourceScope: scope,
    subjectId: 'subject-a',
    now: '2026-10-20T12:00:00Z',
    consent: {
      scope, subjectId: 'subject-a', purpose: 'ad_delivery', status: 'granted',
      grantedAt: '2026-10-19T12:00:00Z', expiresAt: '2026-10-21T12:00:00Z', revokedAt: null
    },
    providerConnections: [
      {
        scope, provider: 'example-ad-provider', connectionName: 'advisory:paid_media:primary',
        state: 'connected', authorized: true, providerVerified: true,
        lastVerifiedAt: '2026-10-20T11:00:00Z'
      }
    ],
    providerAuthorizations: [
      {
        scope, firmId: 'firm-a', capability: 'paid_media', authorized: true,
        authorizedAt: '2026-10-19T12:00:00Z', authorizationReference: 'approval-42'
      }
    ],
    campaign: {
      id: 'campaign-a', scope, firmId: 'firm-a', provider: 'example-ad-provider', approved: true,
      spendingLimitCents: 10000, spentCents: 5000, proposedSpendCents: 5000
    }
  };
}

function denied(input: GovernedGrowthAdDeliveryInput, reason: string) {
  const result = authorizeGovernedGrowthAdDelivery(input);
  expect(result).toMatchObject({ allowed: false, reason, audit: { result: 'denied' } });
  expect(result.audit.scope).toEqual(input.resourceScope);
  expect(result.audit).not.toHaveProperty('consent');
}

describe('Governed ATLAS Growth ad-delivery authorization', () => {
  it('allows only the complete scoped path and emits an authorization audit event', () => {
    const result = authorizeGovernedGrowthAdDelivery(fixtures());
    expect(result).toMatchObject({
      allowed: true,
      audit: {
        action: 'advisory.growth.ad_delivery.authorize',
        resource: 'growth-campaign:campaign-a',
        result: 'success'
      }
    });
  });

  it('denies actors missing the canonical advisory.manage permission', () => {
    const input = fixtures();
    input.actor = { scope, permissions: ['advisory.read'] };
    denied(input, 'authorization_denied');
  });

  it('denies mismatched actor tenant even with advisory.manage permission', () => {
    const input = fixtures();
    input.actor = { scope: otherScope, permissions: ['advisory.manage'] };
    denied(input, 'authorization_denied');
  });

  it('denies an unscoped/missing campaign', () => {
    const input = fixtures();
    input.campaign = null;
    denied(input, 'provider_unverified');
  });

  it('denies a campaign from another tenant', () => {
    const input = fixtures();
    input.campaign = { ...input.campaign!, scope: otherScope };
    denied(input, 'provider_unverified');
  });

  it('denies a connection belonging to another tenant', () => {
    const input = fixtures();
    input.providerConnections = input.providerConnections.map(item => ({ ...item, scope: otherScope }));
    denied(input, 'provider_unverified');
  });

  it('denies another advisory firm in the same organization', () => {
    const input = fixtures();
    input.campaign = { ...input.campaign!, firmId: 'firm-b' };
    denied(input, 'organization_not_authorized');
  });

  it('denies revoked approval despite authorized=true', () => {
    const input = fixtures();
    input.providerAuthorizations = input.providerAuthorizations.map(item => ({
      ...item, revokedAt: '2026-10-19T23:00:00Z'
    }));
    denied(input, 'organization_not_authorized');
  });

  it('denies stale or future provider verification and revoked provider connections', () => {
    for (const change of [
      { lastVerifiedAt: '2026-10-19T10:00:00Z' },
      { lastVerifiedAt: '2026-10-20T13:00:00Z' },
      { lastVerifiedAt: null },
      { revokedAt: '2026-10-19T23:00:00Z' }
    ]) {
      const input = fixtures();
      input.providerConnections = [{ ...input.providerConnections[0], ...change }];
      denied(input, 'provider_unverified');
    }
  });

  it('denies a connected provider for a different campaign provider', () => {
    const input = fixtures();
    input.campaign = { ...input.campaign!, provider: 'different-provider' };
    denied(input, 'provider_unverified');
  });

  it('denies disconnected, revoked or unverified provider connections', () => {
    for (const [state, verified] of [
      ['revoked', true], ['connected', false], ['authorizing', false]
    ] as const) {
      const input = fixtures();
      input.providerConnections = [{ ...input.providerConnections[0], state, providerVerified: verified }];
      denied(input, 'provider_unverified');
    }
  });

  it('denies authorization from a different tenant', () => {
    const input = fixtures();
    input.providerAuthorizations = input.providerAuthorizations.map(item => ({ ...item, scope: otherScope }));
    denied(input, 'organization_not_authorized');
  });

  it('denies when the organization has not separately authorized paid media', () => {
    const input = fixtures();
    input.providerAuthorizations = [];
    denied(input, 'organization_not_authorized');
  });

  it('denies consent owned by another person, purpose, or tenant', () => {
    for (const delta of [
      { subjectId: 'someone-else' },
      { scope: otherScope },
      { purpose: 'unrelated' as 'ad_delivery' }
    ]) {
      const input = fixtures();
      input.consent = { ...input.consent!, ...delta };
      denied(input, 'consent_required');
    }
  });

  it('denies no consent, revocation, denial, expiry, future grant or invalid timestamps', () => {
    const invalid = [
      null,
      { revokedAt: '2026-10-19T13:00:00Z' },
      { status: 'denied' as const },
      { expiresAt: '2026-10-20T12:00:00Z' },
      { grantedAt: '2026-10-21T12:00:00Z' },
      { expiresAt: 'not-a-date' }
    ];
    for (const change of invalid) {
      const input = fixtures();
      input.consent = change === null ? null : { ...input.consent!, ...change };
      denied(input, 'consent_required');
    }
    const input = fixtures();
    input.now = 'not-a-date';
    denied(input, 'consent_required');
  });

  it('denies an unapproved campaign or any over-limit, negative or non-integer spending', () => {
    for (const [change, reason] of [
      [{ approved: false }, 'campaign_not_approved'],
      [{ proposedSpendCents: 5001 }, 'budget_exceeded'],
      [{ proposedSpendCents: -1 }, 'invalid_spend'],
      [{ proposedSpendCents: 0.5 }, 'invalid_spend'],
      [{ proposedSpendCents: Number.POSITIVE_INFINITY }, 'invalid_spend'],
      [{ spentCents: -100 }, 'invalid_spend']
    ] as const) {
      const input = fixtures();
      input.campaign = { ...input.campaign!, ...change };
      denied(input, reason);
    }
  });

  it('does not mutate canonical evidence', () => {
    const input = fixtures();
    const original = JSON.stringify(input);
    authorizeGovernedGrowthAdDelivery(input);
    expect(JSON.stringify(input)).toBe(original);
  });
});
