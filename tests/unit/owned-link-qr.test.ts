import { describe, expect, it } from 'vitest';
import { buildQrPayload } from '../../packages/core/src/owned-link-qr';
describe('ATLAS owned QR payload negative contract', () => {
  const scope = { organizationId: 'org-a', tenantId: 'tenant-a' };
  it('generates an HTTPS payload for a scoped, active link', () => {
    expect(buildQrPayload({ slug: 'launch', organizationId: 'org-a', tenantId: 'tenant-a', destination: 'https://example.com/', revoked: false }, scope, 'https://links.atlas.example', 10))
      .toBe('https://links.atlas.example/launch');
  });
  it('denies cross-tenant QR generation', () => {
    const link = { ...scope, slug: 'launch', destination: 'https://example.com', revoked: false };
    expect(() => buildQrPayload(link, { ...scope, tenantId: 'tenant-b' }, 'https://links.atlas.example', 10)).toThrow('link_scope_denied');
  });
  it.each(['http://links.atlas.example', 'https://localhost', 'https://links.atlas.example/base', 'https://user:pass@links.atlas.example'])('denies unsafe or non-root QR origins: %s', origin => {
    const link = { ...scope, slug: 'launch', destination: 'https://example.com', revoked: false };
    expect(() => buildQrPayload(link, scope, origin, 10)).toThrow('qr_origin_denied');
  });
  it('denies expired, revoked and invalid slugs', () => {
    const link = { ...scope, slug: 'launch', destination: 'https://example.com', revoked: false, expiresAt: 10 };
    expect(() => buildQrPayload(link, scope, 'https://links.atlas.example', 10)).toThrow('link_unavailable');
    expect(() => buildQrPayload({ ...link, expiresAt: 11, revoked: true }, scope, 'https://links.atlas.example', 10)).toThrow('link_unavailable');
    expect(() => buildQrPayload({ ...link, expiresAt: 11, slug: '../admin' }, scope, 'https://links.atlas.example', 10)).toThrow('link_slug_invalid');
  });
});
