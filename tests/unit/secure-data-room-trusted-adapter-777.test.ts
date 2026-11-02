import { describe, expect, it, vi } from 'vitest';
import { authorizeTrustedDataRoomRead, type TrustedDataRoomSources } from '../../packages/security/secure-data-room-trusted-adapter';

const sources = (): TrustedDataRoomSources => ({
  authenticate: vi.fn(async () => ({ userId: 'user-a', sessionActive: true })),
  document: vi.fn(async () => ({ tenantId: 'org-a', organizationId: 'org-a', revoked: false })),
  membership: vi.fn(async () => ({ tenantId: 'org-a', active: true })),
  grant: vi.fn(async () => true)
});
const request = { bearerToken: 'token', documentId: 'doc-a' };

describe('Data Room trusted-source adapter', () => {
  it('allows verified actor, document, membership and grant', async () => {
    expect(await authorizeTrustedDataRoomRead(request, sources())).toEqual({ status: 200, allowed: true });
  });
  it('denies revoked sessions before reading documents', async () => {
    const s = sources();
    s.authenticate = vi.fn(async () => ({ userId: 'user-a', sessionActive: false }));
    expect(await authorizeTrustedDataRoomRead(request, s)).toEqual({ status: 403, allowed: false });
    expect(s.document).not.toHaveBeenCalled();
  });
  it('denies cross-tenant documents', async () => {
    const s = sources();
    s.document = vi.fn(async () => ({ tenantId: 'org-b', organizationId: 'org-a', revoked: false }));
    expect(await authorizeTrustedDataRoomRead(request, s)).toEqual({ status: 403, allowed: false });
  });
  it('denies removed membership', async () => {
    const s = sources();
    s.membership = vi.fn(async () => ({ tenantId: 'org-a', active: false }));
    expect(await authorizeTrustedDataRoomRead(request, s)).toEqual({ status: 403, allowed: false });
  });
  it('denies revoked documents and missing grants', async () => {
    const a = sources();
    a.document = vi.fn(async () => ({ tenantId: 'org-a', organizationId: 'org-a', revoked: true }));
    expect(await authorizeTrustedDataRoomRead(request, a)).toEqual({ status: 403, allowed: false });
    const b = sources();
    b.grant = vi.fn(async () => false);
    expect(await authorizeTrustedDataRoomRead(request, b)).toEqual({ status: 403, allowed: false });
  });
  it('does not consult grants after tenant mismatch', async () => {
    const s = sources();
    s.membership = vi.fn(async () => ({ tenantId: 'org-b', active: true }));
    expect(await authorizeTrustedDataRoomRead(request, s)).toEqual({ status: 403, allowed: false });
    expect(s.grant).not.toHaveBeenCalled();
  });
  it('does not consult grants after revoked document or inactive membership', async () => {
    const revoked = sources();
    revoked.document = vi.fn(async () => ({ tenantId: 'org-a', organizationId: 'org-a', revoked: true }));
    expect(await authorizeTrustedDataRoomRead(request, revoked)).toEqual({ status: 403, allowed: false });
    expect(revoked.membership).not.toHaveBeenCalled();
    expect(revoked.grant).not.toHaveBeenCalled();
    const inactive = sources();
    inactive.membership = vi.fn(async () => ({ tenantId: 'org-a', active: false }));
    expect(await authorizeTrustedDataRoomRead(request, inactive)).toEqual({ status: 403, allowed: false });
    expect(inactive.grant).not.toHaveBeenCalled();
  });
  it('denies when grant lookup fails and never converts the failure into access', async () => {
    const s = sources();
    s.grant = vi.fn(async () => { throw new Error('grant source unavailable'); });
    expect(await authorizeTrustedDataRoomRead(request, s)).toEqual({ status: 403, allowed: false });
  });
  it('denies when document or identity source is unavailable', async () => {
    const identity = sources();
    identity.authenticate = vi.fn(async () => { throw new Error('identity unavailable'); });
    expect(await authorizeTrustedDataRoomRead(request, identity)).toEqual({ status: 403, allowed: false });
    expect(identity.document).not.toHaveBeenCalled();
    const document = sources();
    document.document = vi.fn(async () => { throw new Error('document unavailable'); });
    expect(await authorizeTrustedDataRoomRead(request, document)).toEqual({ status: 403, allowed: false });
    expect(document.membership).not.toHaveBeenCalled();
    expect(document.grant).not.toHaveBeenCalled();
  });
  it('fails closed on upstream errors', async () => {
    const s = sources();
    s.membership = vi.fn(async () => { throw Error('db offline'); });
    expect(await authorizeTrustedDataRoomRead(request, s)).toEqual({ status: 403, allowed: false });
  });
});
