import { describe, expect, it } from 'vitest';
import { memoryIdempotencyKey, verifyMemorySource } from '../../packages/core/src/memoryArchiveContract';

const source = {
  tenantId: 'tenant-a', organizationId: 'org-a', sourceId: 'chat-1',
  content: 'ATLAS decision', consentActive: true,
  sha256: '3b6d9f9fd24a92f3c0c86dbacb8d3ab93d85fcb3bd0a0cc72e8db749c6c15aa7'
};

async function actualDigest(content: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content)));
  return [...bytes].map(x => x.toString(16).padStart(2, '0')).join('');
}

describe('memory archive fail-closed contract', () => {
  it('accepts matching SHA and tenant', async () => {
    const good = { ...source, sha256: await actualDigest(source.content) };
    await expect(verifyMemorySource(good, { tenantId: 'tenant-a', organizationId: 'org-a' })).resolves.toBe(true);
  });
  it('rejects tampering', async () => {
    const good = { ...source, sha256: await actualDigest(source.content), content: 'tampered' };
    await expect(verifyMemorySource(good, { tenantId: 'tenant-a', organizationId: 'org-a' })).rejects.toThrow('memory_integrity_mismatch');
  });
  it('rejects tenant and organization crossover', async () => {
    const good = { ...source, sha256: await actualDigest(source.content) };
    for (const scope of [{ tenantId: 'tenant-b', organizationId: 'org-a' }, { tenantId: 'tenant-a', organizationId: 'org-b' }]) {
      await expect(verifyMemorySource(good, scope)).rejects.toThrow('memory_scope_denied');
    }
  });
  it('rejects revoked consent and empty content', async () => {
    for (const candidate of [{ ...source, consentActive: false }, { ...source, content: '' }]) {
      await expect(verifyMemorySource(candidate, { tenantId: 'tenant-a', organizationId: 'org-a' })).rejects.toThrow();
    }
  });
  it('generates stable keys scoped to tenant, org, source and digest', () => {
    expect(memoryIdempotencyKey(source)).toBe(memoryIdempotencyKey({ ...source }));
    expect(memoryIdempotencyKey(source)).not.toBe(memoryIdempotencyKey({ ...source, tenantId: 'tenant-b' }));
    expect(memoryIdempotencyKey(source)).not.toBe(memoryIdempotencyKey({ ...source, sourceId: 'chat-2' }));
  });
});
