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
