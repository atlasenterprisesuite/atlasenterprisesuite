import { describe, expect, it, vi } from 'vitest';
import { createDataRoomReadHandler } from '../../packages/security/secure-data-room-http';
import type { TrustedDataRoomSources } from '../../packages/security/secure-data-room-trusted-adapter';

const docId = '123e4567-e89b-42d3-a456-426614174000';
const sources = (): TrustedDataRoomSources => ({
  authenticate: vi.fn(async () => ({ userId: 'user-a', sessionActive: true })),
  document: vi.fn(async () => ({ tenantId: 'org-a', organizationId: 'org-a', revoked: false })),
  membership: vi.fn(async () => ({ tenantId: 'org-a', active: true })),
  grant: vi.fn(async () => true)
});
function request(documentId: string, token = 'Bearer example-token') {
  return new Request('https://example.invalid/read', {
    method: 'POST',
    headers: { authorization: token, 'content-type': 'application/json' },
    body: JSON.stringify({ documentId })
  });
}

describe('Secure Data Room HTTP access boundary', () => {
  it('denies missing credentials without invoking identity lookup', async () => {
    const trusted = sources();
    const response = await createDataRoomReadHandler(trusted)(request(docId, ''));
    expect(response.status).toBe(403);
    expect(trusted.authenticate).not.toHaveBeenCalled();
  });
  it('denies malformed document identifiers', async () => {
    const trusted = sources();
    const response = await createDataRoomReadHandler(trusted)(request('invalid-id'));
    expect(response.status).toBe(403);
    expect(trusted.authenticate).not.toHaveBeenCalled();
  });
  it('never exposes document content or signed URLs', async () => {
    const response = await createDataRoomReadHandler(sources())(request(docId));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).toBe('');
  });
  it('sets no-store for all rejected requests and unsupported methods', async () => {
    const handler = createDataRoomReadHandler(sources());
    const denied = [
      request(docId, ''),
      request('invalid-id'),
      new Request('https://example.invalid/read', { method: 'GET' }),
      new Request('https://example.invalid/read', { method: 'POST', headers: { authorization: 'Bearer token' }, body: '{invalid' })
    ];
    for (const req of denied) {
      const response = await handler(req);
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.text()).toBe('');
    }
  });
  it('denies a session revoked between consecutive requests', async () => {
    const trusted = sources();
    let active = true;
    trusted.authenticate = vi.fn(async () => ({ userId: 'user-a', sessionActive: active }));
    const handler = createDataRoomReadHandler(trusted);
    expect((await handler(request(docId))).status).toBe(200);
    active = false;
    expect((await handler(request(docId))).status).toBe(403);
    expect(trusted.authenticate).toHaveBeenCalledTimes(2);
  });
  it('denies cross-tenant membership even with a valid document grant', async () => {
    const trusted = sources();
    trusted.membership = vi.fn(async () => ({ tenantId: 'org-b', active: true }));
    expect((await createDataRoomReadHandler(trusted)(request(docId))).status).toBe(403);
  });
  it('denies membership revocation between requests', async () => {
    const trusted = sources();
    let active = true;
    trusted.membership = vi.fn(async () => ({ tenantId: 'org-a', active }));
    const handler = createDataRoomReadHandler(trusted);
    expect((await handler(request(docId))).status).toBe(200);
    active = false;
    expect((await handler(request(docId))).status).toBe(403);
  });
  it('denies document revocation between requests', async () => {
    const trusted = sources();
    let revoked = false;
    trusted.document = vi.fn(async () => ({ tenantId: 'org-a', organizationId: 'org-a', revoked }));
    const handler = createDataRoomReadHandler(trusted);
    expect((await handler(request(docId))).status).toBe(200);
    revoked = true;
    expect((await handler(request(docId))).status).toBe(403);
  });
  it('denies revoked access', async () => {
    const trusted = sources();
    trusted.grant = vi.fn(async () => false);
    expect((await createDataRoomReadHandler(trusted)(request(docId))).status).toBe(403);
  });
  it('denies unavailable authorization backend', async () => {
    const trusted = sources();
    trusted.membership = vi.fn(async () => { throw new Error('unavailable'); });
    expect((await createDataRoomReadHandler(trusted)(request(docId))).status).toBe(403);
  });
});
