import type { IntegrationProvider } from '../../../../packages/core/src/integrations.ts';
import {
  openOpaqueSecret,
  sealOpaqueSecret,
  type CredentialKey
} from '../integration-credential-vault.ts';
import { integrationError } from './context';
import {
  insertCredentialRecord,
  loadCredentialRecord,
  type IntegrationCredentialRow
} from './repository';

type VaultDeps = {
  supabaseUrl?: string;
  serviceRoleKey?: string;
  encryptionKey?: CredentialKey;
  keyVersion?: string;
  fetchFn?: typeof fetch;
};

type CredentialKind = 'oauth_tokens' | 'oauth_pkce_verifier' | 'infrastructure_credential';

function runtimeValue(name: string) {
  const deno = (globalThis as any).Deno;
  return typeof deno?.env?.get === 'function' ? String(deno.env.get(name) || '') : '';
}

function config(deps: VaultDeps) {
  const supabaseUrl = deps.supabaseUrl || runtimeValue('SUPABASE_URL');
  const serviceRoleKey = deps.serviceRoleKey || runtimeValue('SUPABASE_SERVICE_ROLE_KEY');
  const encryptionKey = deps.encryptionKey || runtimeValue('ATLAS_INTEGRATION_CREDENTIAL_KEY');
  if (!supabaseUrl || !serviceRoleKey || !encryptionKey) {
    throw integrationError('credential_vault_not_configured', 503);
  }
  return {
    supabaseUrl,
    serviceRoleKey,
    encryptionKey,
    keyVersion: deps.keyVersion || runtimeValue('ATLAS_INTEGRATION_CREDENTIAL_KEY_VERSION') || 'v1',
    fetchFn: deps.fetchFn
  };
}

export async function storeCredentialSecret(
  input: {
    organizationId: string;
    provider: IntegrationProvider;
    credentialKind: CredentialKind;
    secretValue: string;
    expiresAt?: string | null;
  },
  deps: VaultDeps = {}
): Promise<{ credentialRef: string }> {
  const configured = config(deps);
  try {
    const sealed = await sealOpaqueSecret({
      organizationId: input.organizationId,
      provider: input.provider,
      kind: input.credentialKind,
      secretValue: input.secretValue,
      key: configured.encryptionKey,
      keyVersion: configured.keyVersion
    });
    const row = await insertCredentialRecord({
      org_id: input.organizationId,
      provider: input.provider,
      credential_kind: input.credentialKind,
      ciphertext: sealed.ciphertext,
      iv: sealed.iv,
      algorithm: sealed.algorithm,
      key_version: sealed.keyVersion,
      expires_at: input.expiresAt || null
    }, configured);
    return { credentialRef: row.id };
  } catch (error) {
    if ((error as any)?.code === 'credential_vault_not_configured') throw error;
    throw integrationError('credential_vault_unavailable', 503);
  }
}

export async function readCredentialSecret(
  input: {
    organizationId: string;
    provider: IntegrationProvider;
    credentialKind: CredentialKind;
    credentialRef: string;
  },
  deps: VaultDeps = {}
): Promise<string> {
  const configured = config(deps);
  let row: IntegrationCredentialRow | null;
  try {
    row = await loadCredentialRecord(
      { organizationId: input.organizationId },
      { id: input.credentialRef, provider: input.provider },
      configured
    );
  } catch {
    throw integrationError('credential_vault_unavailable', 503);
  }
  if (!row || row.credential_kind !== input.credentialKind) {
    throw integrationError('credential_not_found', 404);
  }
  try {
    return await openOpaqueSecret({
      organizationId: input.organizationId,
      provider: input.provider,
      kind: input.credentialKind,
      sealed: {
        ciphertext: row.ciphertext,
        iv: row.iv,
        algorithm: row.algorithm,
        keyVersion: row.key_version
      },
      key: configured.encryptionKey
    });
  } catch {
    throw integrationError('credential_unreadable', 503);
  }
}
