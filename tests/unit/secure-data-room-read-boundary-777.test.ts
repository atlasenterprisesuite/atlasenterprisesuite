import { describe, expect, it, vi } from 'vitest';
import { resolveDataRoomRead } from '../../packages/security/secure-data-room-read-boundary';
import type { DataRoomReadContext } from '../../packages/security/secure-data-room-policy';

const valid: DataRoomReadContext = {
  actorId: 'user-a', tenantId: 'tenant-a', organizationId: 'org-a',
  documentTenantId: 'tenant-a', documentOrganizationId: 'org-a',
  membershipActive: true, sessionActive: true, grantActive: true,
  documentRevoked: false
};

const request = { bearerToken: 'server-validated-token-candidate', documentId: 'doc-a' };

describe('Data Room read boundary — negative authorization', () => {
  it('rejects missing bearer token without calling resolver', async () => {
    const resolver = vi.fn().mockResolvedValue(valid);
    expect(await resolveDataRoomRead({ documentId: 'doc-a' }, resolver)).toEqual({ status: 403, allowed: false });
    expect(resolver).not.toHaveBeenCalled();
  });

  it('rejects missing document id without calling resolver', async () => {
    const resolver = vi.fn().mockResolvedValue(valid);
    expect(await resolveDataRoomRead({ bearerToken: 'token' }, resolver)).toEqual({ status: 403, allowed: false });
    expect(resolver).not.toHaveBeenCalled();
  });

  it('denies unresolved, throwing or stale authorization', async () => {
    expect(await resolveDataRoomRead(request, async () => null)).toEqual({ status: 403, allowed: false });
    expect(await resolveDataRoomRead(request, async () => { throw Error('backend unavailable'); })).toEqual({ status: 403, allowed: false });
    expect(await resolveDataRoomRead(request, async () => ({ ...valid, sessionActive: false }))).toEqual({ status: 403, allowed: false });
  });

  it('denies cross-tenant, cross-org, revoked grant and removed membership', async () => {
    for (const change of [
      { documentTenantId: 'tenant-b' },
      { documentOrganizationId: 'org-b' },
      { grantActive: false },
      { membershipActive: false },
      { documentRevoked: true }
    ]) {
      expect(await resolveDataRoomRead(request, async () => ({ ...valid, ...change }))).toEqual({ status: 403, allowed: false });
    }
  });

  it('permits a fully trusted authorization context', async () => {
    expect(await resolveDataRoomRead(request, async () => valid)).toEqual({ status: 200, allowed: true });
  });
});
