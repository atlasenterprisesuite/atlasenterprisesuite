import { describe, expect, it, vi } from 'vitest';
import { readAuthorizedHSeriesCatalog, type RoboticsAuthorizationProvider } from '../../packages/robotics/h-series-server-access';
const scope = { tenantId: 'tenant-a', organizationId: 'org-a' };
const session = { userId: 'verified-user', ...scope };
const provider = (overrides: Partial<RoboticsAuthorizationProvider> = {}): RoboticsAuthorizationProvider => ({
  verifiedSession: async () => session,
  canReadCatalog: async () => true,
  ...overrides
});
describe('F10 server-only catalog authorization', () => {
  it('F10-001 allows verified authorized session', async () => {
    expect((await readAuthorizedHSeriesCatalog(provider(), scope)).ok).toBe(true);
  });
  it('F10-002 denies missing session without authorization call', async () => {
    const canReadCatalog = vi.fn(async () => true);
    expect((await readAuthorizedHSeriesCatalog(provider({ verifiedSession: async () => null, canReadCatalog }), scope)).ok).toBe(false);
    expect(canReadCatalog).not.toHaveBeenCalled();
  });
  it('F10-003 denies cross tenant', async () => {
    expect((await readAuthorizedHSeriesCatalog(provider(), { ...scope, tenantId: 'other' })).ok).toBe(false);
  });
  it('F10-004 denies cross organization', async () => {
    expect((await readAuthorizedHSeriesCatalog(provider(), { ...scope, organizationId: 'other' })).ok).toBe(false);
  });
  it('F10-005 denies revoked membership / effective permission', async () => {
    expect((await readAuthorizedHSeriesCatalog(provider({ canReadCatalog: async () => false }), scope)).ok).toBe(false);
  });
  it('F10-006 fails closed on identity service outage', async () => {
    expect((await readAuthorizedHSeriesCatalog(provider({ verifiedSession: async () => { throw Error('offline'); } }), scope)).ok).toBe(false);
  });
  it('F10-007 fails closed on authorization outage', async () => {
    expect((await readAuthorizedHSeriesCatalog(provider({ canReadCatalog: async () => { throw Error('offline'); } }), scope)).ok).toBe(false);
  });
  it('F10-008 denies empty verified identity', async () => {
    expect((await readAuthorizedHSeriesCatalog(provider({ verifiedSession: async () => ({ ...session, userId: '' }) }), scope)).ok).toBe(false);
  });
});
