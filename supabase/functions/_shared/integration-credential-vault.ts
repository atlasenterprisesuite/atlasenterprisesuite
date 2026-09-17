import type { IntegrationProvider } from '../../../packages/core/src/integrations.ts';

export type ProviderCredentialPayload = {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  scopes?: string[];
  expiresAt?: number | null;
};

export type SealedCredential = {
  ciphertext: string;
  iv: string;
  algorithm: 'AES-GCM-256';
  keyVersion: string;
};

export type CredentialKey = string | Uint8Array;

const ALGORITHM = 'AES-GCM-256' as const;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function normalizeKey(key: CredentialKey): Uint8Array {
  let bytes: Uint8Array;
  try {
    bytes = typeof key === 'string' ? base64UrlToBytes(key.trim()) : new Uint8Array(key);
  } catch {
    throw new Error('Credential key must be a valid 32-byte base64url value');
  }
  if (bytes.byteLength !== 32) {
    throw new Error('Credential key must be exactly 32 bytes');
  }
  return bytes;
}

function assertScope(organizationId: string, provider: IntegrationProvider): void {
  if (!organizationId.trim()) throw new Error('Credential organization is required');
  if (provider !== 'google' && provider !== 'hubspot') {
    throw new Error('Unsupported credential provider');
  }
}

function assertCredential(value: unknown): asserts value is ProviderCredentialPayload {
  if (!value || typeof value !== 'object') {
    throw new Error('Credential payload is invalid');
  }
  const credential = value as ProviderCredentialPayload;
  if (typeof credential.accessToken !== 'string' || !credential.accessToken.trim()) {
    throw new Error('Credential access token is required');
  }
  if (
    credential.refreshToken !== undefined &&
    typeof credential.refreshToken !== 'string'
  ) {
    throw new Error('Credential refresh token is invalid');
  }
  if (credential.scopes !== undefined) {
    if (!Array.isArray(credential.scopes) || credential.scopes.some((scope) => typeof scope !== 'string')) {
      throw new Error('Credential scopes are invalid');
    }
  }
}

function additionalData(organizationId: string, provider: IntegrationProvider): Uint8Array {
  return textEncoder.encode(`atlas:${organizationId}:${provider}`);
}

async function importAesKey(key: CredentialKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    normalizeKey(key),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function sealCredential(input: {
  organizationId: string;
  provider: IntegrationProvider;
  credential: ProviderCredentialPayload;
  key: CredentialKey;
  keyVersion?: string;
}): Promise<SealedCredential> {
  assertScope(input.organizationId, input.provider);
  assertCredential(input.credential);
  const keyVersion = input.keyVersion?.trim() || 'v1';
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey = await importAesKey(input.key);
  const plaintext = textEncoder.encode(JSON.stringify(input.credential));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: additionalData(input.organizationId, input.provider),
      tagLength: 128
    },
    cryptoKey,
    plaintext
  );

  return {
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
    iv: bytesToBase64Url(iv),
    algorithm: ALGORITHM,
    keyVersion
  };
}

export async function openCredential(input: {
  organizationId: string;
  provider: IntegrationProvider;
  sealed: SealedCredential;
  key: CredentialKey;
}): Promise<ProviderCredentialPayload> {
  assertScope(input.organizationId, input.provider);
  if (input.sealed.algorithm !== ALGORITHM) {
    throw new Error('Unsupported credential encryption algorithm');
  }
  if (!input.sealed.keyVersion?.trim()) {
    throw new Error('Credential key version is required');
  }

  let iv: Uint8Array;
  let ciphertext: Uint8Array;
  try {
    iv = base64UrlToBytes(input.sealed.iv);
    ciphertext = base64UrlToBytes(input.sealed.ciphertext);
  } catch {
    throw new Error('Sealed credential encoding is invalid');
  }
  if (iv.byteLength !== 12 || ciphertext.byteLength === 0) {
    throw new Error('Sealed credential payload is invalid');
  }

  const cryptoKey = await importAesKey(input.key);
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: additionalData(input.organizationId, input.provider),
        tagLength: 128
      },
      cryptoKey,
      ciphertext
    );
  } catch {
    throw new Error('Credential decryption failed');
  }

  let credential: unknown;
  try {
    credential = JSON.parse(textDecoder.decode(plaintext));
  } catch {
    throw new Error('Credential plaintext is invalid');
  }
  assertCredential(credential);
  return credential;
}

export function destroyCredentialPayload(credential: ProviderCredentialPayload): void {
  credential.accessToken = '';
  if (credential.refreshToken !== undefined) credential.refreshToken = '';
  if (credential.scopes) credential.scopes.splice(0, credential.scopes.length);
  credential.expiresAt = null;
}
