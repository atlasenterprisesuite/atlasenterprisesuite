import { describe, expect, it } from 'vitest';
import {
  sealCredential, openCredential, destroyCredentialPayload
} from '../../supabase/functions/_shared/integration-credential-vault';

// Pure in-memory AES-GCM test. No database, provider call, secrets or network.
describe('OAuth credential tenant isolation (offline)', () => {
  const key = new Uint8Array(32).fill(7);
  const credential = () => ({
    accessToken: 'offline-placeholder',
    refreshToken: 'offline-refresh',
    scopes: ['crm.objects.contacts.read']
  });

  it('rejects cross-tenant decryption with the same key', async () => {
    const sealed = await sealCredential({
      organizationId: 'org-a', provider: 'hubspot', credential: credential(), key
    });
    await expect(openCredential({
      organizationId: 'org-b', provider: 'hubspot', sealed, key
    })).rejects.toThrow('Credential decryption failed');
    await expect(openCredential({
      organizationId: 'org-a', provider: 'salesforce', sealed, key
    })).rejects.toThrow('Credential decryption failed');
    expect((await openCredential({
      organizationId: 'org-a', provider: 'hubspot', sealed, key
    })).scopes).toEqual(['crm.objects.contacts.read']);
  });

  it('rejects a tampered ciphertext', async () => {
    const sealed = await sealCredential({
      organizationId: 'org-a', provider: 'hubspot', credential: credential(), key
    });
    const tampered = { ...sealed, ciphertext: sealed.ciphertext.slice(0, -2) + 'AA' };
    await expect(openCredential({
      organizationId: 'org-a', provider: 'hubspot', sealed: tampered, key
    })).rejects.toThrow();
  });

  it('clears mutable token and scope fields on disposal', () => {
    const value = credential();
    destroyCredentialPayload(value);
    expect(value.accessToken).toBe('');
    expect(value.refreshToken).toBe('');
    expect(value.scopes).toEqual([]);
  });
});
