import { describe, expect, it } from 'vitest';
import {
  destroyCredentialPayload,
  openCredential,
  sealCredential,
  type ProviderCredentialPayload
} from '../../supabase/functions/_shared/integration-credential-vault';

const key = new Uint8Array(32).fill(7);

function credential(): ProviderCredentialPayload {
  return {
    accessToken: 'fake-access-token-for-tests',
    refreshToken: 'fake-refresh-token-for-tests',
    tokenType: 'bearer',
    scopes: ['crm.objects.contacts.read'],
    expiresAt: 1_900_000_000_000
  };
}

describe('ATLAS integration credential vault', () => {
  it('seals and opens provider credentials without exposing plaintext in the sealed record', async () => {
    const original = credential();
    const sealed = await sealCredential({
      organizationId: 'org-a',
      provider: 'hubspot',
      credential: original,
      key,
      keyVersion: 'test-v1'
    });

    expect(sealed.algorithm).toBe('AES-GCM-256');
    expect(sealed.keyVersion).toBe('test-v1');
    expect(JSON.stringify(sealed)).not.toContain(original.accessToken);
    expect(JSON.stringify(sealed)).not.toContain(original.refreshToken);
    expect(
      await openCredential({
        organizationId: 'org-a',
        provider: 'hubspot',
        sealed,
        key
      })
    ).toEqual(original);
  });

  it('binds ciphertext authentication to organization and provider', async () => {
    const sealed = await sealCredential({
      organizationId: 'org-a',
      provider: 'hubspot',
      credential: credential(),
      key
    });

    await expect(
      openCredential({ organizationId: 'org-b', provider: 'hubspot', sealed, key })
    ).rejects.toThrow(/decryption/i);
    await expect(
      openCredential({ organizationId: 'org-a', provider: 'google', sealed, key })
    ).rejects.toThrow(/decryption/i);
  });

  it('rejects malformed key and algorithm material', async () => {
    await expect(
      sealCredential({
        organizationId: 'org-a',
        provider: 'hubspot',
        credential: credential(),
        key: new Uint8Array(16)
      })
    ).rejects.toThrow(/32 bytes/i);

    const sealed = await sealCredential({
      organizationId: 'org-a',
      provider: 'hubspot',
      credential: credential(),
      key
    });

    await expect(
      openCredential({
        organizationId: 'org-a',
        provider: 'hubspot',
        sealed: { ...sealed, algorithm: 'AES-GCM-128' as 'AES-GCM-256' },
        key
      })
    ).rejects.toThrow(/algorithm/i);
  });

  it('performs best-effort in-memory payload destruction after persistence/revocation work', () => {
    const mutable = credential();
    destroyCredentialPayload(mutable);
    expect(mutable.accessToken).toBe('');
    expect(mutable.refreshToken).toBe('');
    expect(mutable.scopes).toEqual([]);
    expect(mutable.expiresAt).toBeNull();
  });
});
