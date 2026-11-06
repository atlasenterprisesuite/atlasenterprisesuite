import { describe, expect, it } from 'vitest';
import { normalizePaidMediaEvidenceFromExistingTables } from '../../packages/advisory/src/growthEvidenceAdapters';
import { authorizeGovernedGrowthAdDelivery } from '../../packages/advisory/src/growthAdDeliveryGate';

const scope = { tenantId: 'tenant-a', organizationId: 'org-a' };
const connections = [
  {
    org_id: 'org-a', provider: 'provider-a', connection_name: 'advisory:paid_media:primary',
    state: 'connected', authorized: true, provider_verified: true,
    last_verified_at: '2026-10-20T11:00:00Z', revoked_at: null,
    metadata: { advisory_capability: 'paid_media' }
  },
  {
    org_id: 'org-b', provider: 'provider-b', connection_name: 'advisory:paid_media:other',
    state: 'connected', authorized: true, provider_verified: true,
    last_verified_at: '2026-10-20T11:00:00Z', revoked_at: null,
    metadata: { advisory_capability: 'paid_media' }
  }
];
const authorizations = [
  {
    org_id: 'org-a', firm_id: 'firm-a', capability: 'paid_media', authorized: true,
    authorized_at: '2026-10-19T11:00:00Z', revoked_at: null,
    authorization_reference: 'approval-a'
  },
  {
    org_id: 'org-a', firm_id: 'firm-b', capability: 'paid_media', authorized: true,
    authorized_at: '2026-10-19T11:00:00Z', revoked_at: null,
    authorization_reference: 'approval-b'
  },
  {
    org_id: 'org-b', firm_id: 'firm-a', capability: 'paid_media', authorized: true,
    authorized_at: '2026-10-19T11:00:00Z', revoked_at: null,
    authorization_reference: 'approval-foreign-org'
  }
];

describe('ATLAS existing provider table evidence adapter', () => {
  it('filters by canonical organization and firm', () => {
    const result = normalizePaidMediaEvidenceFromExistingTables({
      scope, firmId: 'firm-a', connections, authorizations
    });
    expect(result.connections).toHaveLength(1);
    expect(result.connections[0].provider).toBe('provider-a');
    expect(result.authorizations).toHaveLength(1);
    expect(result.authorizations[0].authorizationReference).toBe('approval-a');
  });

  it('retains revoked_at and last_verified_at without turning them into readiness', () => {
    const result = normalizePaidMediaEvidenceFromExistingTables({
      scope, firmId: 'firm-a',
      connections: [{ ...connections[0], revoked_at: '2026-10-19T21:00:00Z' }],
      authorizations
    });
    expect(result.connections[0].revokedAt).toBe('2026-10-19T21:00:00Z');
    expect(result.connections[0].lastVerifiedAt).toBe('2026-10-20T11:00:00Z');
  });

  it('maps the rows into the canonical deny-by-default preflight', () => {
    const evidence = normalizePaidMediaEvidenceFromExistingTables({
      scope, firmId: 'firm-a', connections, authorizations
    });
    const result = authorizeGovernedGrowthAdDelivery({
      actor: { scope, permissions: ['advisory.manage'] },
      actorId: 'operator-a', resourceScope: scope, subjectId: 'person-a',
      now: '2026-10-20T12:00:00Z',
      ...{
        providerConnections: evidence.connections,
        providerAuthorizations: evidence.authorizations
      },
      consent: {
        scope, subjectId: 'person-a', purpose: 'ad_delivery', status: 'granted',
        grantedAt: '2026-10-19T12:00:00Z',
        expiresAt: '2026-10-21T12:00:00Z', revokedAt: null
      },
      campaign: {
        id: 'campaign-a', scope, firmId: 'firm-a', provider: 'provider-a',
        approved: true, spendingLimitCents: 9000, spentCents: 5000, proposedSpendCents: 4000
      }
    });
    expect(result.allowed).toBe(true);
  });

  it('fails closed for unknown provider state or absent trusted scope', () => {
    expect(normalizePaidMediaEvidenceFromExistingTables({
      scope, firmId: 'firm-a',
      connections: [{ ...connections[0], state: 'unknown' }],
      authorizations
    }).connections).toEqual([]);
    expect(normalizePaidMediaEvidenceFromExistingTables({
      scope: { tenantId: '', organizationId: 'org-a' },
      firmId: 'firm-a', connections, authorizations
    })).toEqual({ connections: [], authorizations: [] });
  });
});
