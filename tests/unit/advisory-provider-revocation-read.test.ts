import { describe, expect, it, vi } from 'vitest';
const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../../apps/web/src/lib/atlasSession', () => ({
  authorizedAtlasFetch: request,
  getActiveAtlasOrganization: async () => ({ id: 'org-a' })
}));
import { listAdvisoryProviderAuthorizations, listAdvisoryProviderConnections } from '../../apps/web/src/lib/advisoryApi';

describe('Advisory existing provider reads retain revocation evidence', () => {
  it('projects revoked_at for authorizations and explicitly selects it for connections', async () => {
    const revokedAt = '2026-11-05T12:00:00Z';
    request.mockImplementation(async (path: string) => ({
      ok: true,
      text: async () => JSON.stringify(path.includes('/rpc/') ? [{ id: 'firm-a', org_id: 'org-a' }] : path.includes('/advisory_provider_authorizations?') ? [{
        org_id: 'org-a', firm_id: 'firm-a', capability: 'paid_media', authorized: false,
        authorized_at: '2026-11-01T00:00:00Z', revoked_at: revokedAt
      }] : [{
        org_id: 'org-a', provider: 'media', connection_name: 'advisory:paid_media:primary',
        state: 'revoked', authorized: false, provider_verified: false, revoked_at: revokedAt,
        metadata: { advisory_capability: 'paid_media', advisory_firm_id: 'firm-a' }
      }])
    }));
    expect((await listAdvisoryProviderAuthorizations())[0].revokedAt).toBe(revokedAt);
    expect((await listAdvisoryProviderConnections())[0].revokedAt).toBe(revokedAt);
    const path = request.mock.calls.find(([url]) => url.includes('/atlas_integration_connections?'))?.[0];
    expect(path).toContain('revoked_at');
  });
});
