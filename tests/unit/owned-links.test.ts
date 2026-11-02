import { describe, expect, it } from 'vitest';
import { createShortLink, resolveShortLink, validateDestination } from '../../packages/core/src/owned-links';

const scope = { organizationId: 'org-a', tenantId: 'tenant-a' };
describe('ATLAS owned links tenant isolation and safe redirects', () => {
  it('creates a scoped short link with a safe HTTPS destination', () => {
    const link = createShortLink({ ...scope, slug: 'launch-2026', destination: 'https://example.com/product' });
    expect(resolveShortLink(link, scope, 100)).toBe('https://example.com/product');
  });
  it.each(['http://example.com', 'https://localhost/x', 'https://127.0.0.1/x', 'https://[::1]/', 'https://user:pass@example.com', 'javascript:alert(1)', 'https://example.com:444/x', 'https://metadata.google.internal'])('denies unsafe destination %s', destination => {
    expect(() => validateDestination(destination)).toThrow();
  });
  it('rejects lookalike tenant and organization scopes', () => {
    const link = createShortLink({ ...scope, slug: 'launch', destination: 'https://example.com' });
    expect(() => resolveShortLink(link, { organizationId: 'org-b', tenantId: scope.tenantId }, 100)).toThrow('link_scope_denied');
    expect(() => resolveShortLink(link, { organizationId: scope.organizationId, tenantId: 'tenant-b' }, 100)).toThrow('link_scope_denied');
  });
  it('rejects revoked and expired links', () => {
    const link = createShortLink({ ...scope, slug: 'launch', destination: 'https://example.com', expiresAt: 99 });
    expect(() => resolveShortLink(link, scope, 100)).toThrow('link_unavailable');
    expect(() => resolveShortLink({ ...link, revoked: true }, scope, 1)).toThrow('link_unavailable');
  });
  it.each(['../admin', 'a/b', 'a?b', '', 'UPPER', 'a'.repeat(65)])('rejects invalid slugs %s', slug => {
    expect(() => createShortLink({ ...scope, slug, destination: 'https://example.com' })).toThrow('link_slug_invalid');
  });
});
