import type { CrmConnectionView } from '../../../packages/core/src/crm.ts';
import {
  destroyCredentialPayload,
  openCredential,
  sealCredential,
  type CredentialKey,
  type ProviderCredentialPayload
} from './integration-credential-vault.ts';
import {
  HubSpotOAuthError,
  buildHubSpotAuthorizationUrl,
  exchangeHubSpotCode,
  introspectHubSpotToken,
  refreshHubSpotToken,
  revokeHubSpotToken,
  type HubSpotFetch,
  type HubSpotTokenIntrospection,
  type HubSpotTokenResponse
} from './hubspot-oauth.ts';
import { HubSpotCrmAdapter, type CrmProviderReadiness } from './hubspot-crm.ts';
import type {
  HubSpotConnectionRow,
  HubSpotConnectionStore,
  HubSpotCredentialRow,
  HubSpotOAuthStateRow
} from './hubspot-connection-store.ts';

export const HUBSPOT_P0_SCOPES = [
  'oauth',
  'crm.objects.contacts.read',
  'crm.objects.companies.read',
  'crm.objects.deals.read',
  'tickets'
] as const;

export type HubSpotLifecycleErrorCode =
  | 'oauth_state_invalid'
  | 'oauth_state_expired'
  | 'oauth_state_consumed'
  | 'oauth_state_consumption_failed'
  | 'oauth_exchange_failed'
  | 'oauth_introspection_failed'
  | 'oauth_token_inactive'
  | 'oauth_scope_mismatch'
  | 'provider_probe_failed'
  | 'provider_account_mismatch'
  | 'connection_not_ready'
  | 'credential_missing'
  | 'credential_refresh_failed'
  | 'credential_storage_failed';

export class HubSpotLifecycleError extends Error {
  readonly code: HubSpotLifecycleErrorCode;
  readonly status: number;

  constructor(code: HubSpotLifecycleErrorCode, status: number) {
    super(`HubSpot connection lifecycle failed (${code})`);
    this.name = 'HubSpotLifecycleError';
    this.code = code;
    this.status = status;
  }
}

export type HubSpotLifecycleOAuth = {
  buildAuthorizationUrl: typeof buildHubSpotAuthorizationUrl;
  exchangeCode: typeof exchangeHubSpotCode;
  introspectToken: typeof introspectHubSpotToken;
  refreshToken: typeof refreshHubSpotToken;
  revokeToken: typeof revokeHubSpotToken;
};

export type HubSpotLifecycleAdapter = Pick<HubSpotCrmAdapter, 'readiness'>;

export type HubSpotLifecycleDependencies = {
  store: HubSpotConnectionStore;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  credentialKey: CredentialKey;
  keyVersion?: string;
  fetchImpl?: HubSpotFetch;
  now?: () => number;
  randomBytes?: (length: number) => Uint8Array;
  oauth?: HubSpotLifecycleOAuth;
  adapter?: HubSpotLifecycleAdapter;
};

const DEFAULT_OAUTH: HubSpotLifecycleOAuth = {
  buildAuthorizationUrl: buildHubSpotAuthorizationUrl,
  exchangeCode: exchangeHubSpotCode,
  introspectToken: introspectHubSpotToken,
  refreshToken: refreshHubSpotToken,
  revokeToken: revokeHubSpotToken
};

function nowMs(deps: HubSpotLifecycleDependencies): number {
  return deps.now?.() ?? Date.now();
}

function nowIso(deps: HubSpotLifecycleDependencies): string {
  return new Date(nowMs(deps)).toISOString();
}

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function randomBytes(length: number, deps: HubSpotLifecycleDependencies): Uint8Array {
  if (deps.randomBytes) {
    const value = deps.randomBytes(length);
    if (value.byteLength !== length) throw new Error('OAuth random source returned invalid length');
    return value;
  }
  return crypto.getRandomValues(new Uint8Array(length));
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

function assertStateFresh(row: HubSpotOAuthStateRow, now: number): void {
  if (row.consumed_at) throw new HubSpotLifecycleError('oauth_state_consumed', 400);
  const expiresAt = Date.parse(row.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    throw new HubSpotLifecycleError('oauth_state_expired', 400);
  }
}

function assertRequiredScopes(requiredScopes: readonly string[], grantedScopes: readonly string[]): void {
  const granted = new Set(grantedScopes.map((scope) => scope.trim()).filter(Boolean));
  if (requiredScopes.some((scope) => !granted.has(scope))) {
    throw new HubSpotLifecycleError('oauth_scope_mismatch', 403);
  }
}

function connectionView(row: HubSpotConnectionRow | null): CrmConnectionView {
  if (!row) {
    return {
      provider: 'hubspot',
      state: 'unconfigured',
      providerAccountId: null,
      providerAccountLabel: null,
      grantedScopes: [],
      lastVerifiedAt: null,
      lastSuccessAt: null,
      safeErrorCode: null
    };
  }
  return {
    provider: 'hubspot',
    state: row.state,
    providerAccountId: row.provider_account_id,
    providerAccountLabel: row.provider_account_label,
    grantedScopes: [...row.granted_scopes],
    lastVerifiedAt: row.last_verified_at,
    lastSuccessAt: row.last_success_at,
    safeErrorCode: row.last_error_code
  };
}

async function safeEvidence(
  deps: HubSpotLifecycleDependencies,
  input: Parameters<HubSpotConnectionStore['recordEvidence']>[0]
): Promise<void> {
  try {
    await deps.store.recordEvidence(input);
  } catch {
    // Evidence failure must not expose provider credentials or replace the operation result.
  }
}

async function validateProvider(
  accessToken: string,
  deps: HubSpotLifecycleDependencies
): Promise<{ introspection: HubSpotTokenIntrospection; readiness: CrmProviderReadiness }> {
  const oauth = deps.oauth ?? DEFAULT_OAUTH;
  let introspection: HubSpotTokenIntrospection;
  try {
    introspection = await oauth.introspectToken({
      clientId: required(deps.clientId, 'HubSpot client ID'),
      clientSecret: required(deps.clientSecret, 'HubSpot client secret'),
      token: accessToken,
      tokenTypeHint: 'access_token',
      fetchImpl: deps.fetchImpl
    });
  } catch {
    throw new HubSpotLifecycleError('oauth_introspection_failed', 502);
  }
  if (!introspection.active) {
    throw new HubSpotLifecycleError('oauth_token_inactive', 401);
  }

  const adapter = deps.adapter ?? new HubSpotCrmAdapter();
  let readiness: CrmProviderReadiness;
  try {
    readiness = await adapter.readiness({ accessToken, fetchImpl: deps.fetchImpl });
  } catch {
    throw new HubSpotLifecycleError('provider_probe_failed', 502);
  }
  if (!readiness.ready || !readiness.account) {
    throw new HubSpotLifecycleError('provider_probe_failed', 502);
  }
  if (!introspection.hubId || introspection.hubId !== readiness.account.id) {
    throw new HubSpotLifecycleError('provider_account_mismatch', 502);
  }
  return { introspection, readiness };
}

export async function prepareHubSpotConnection(input: {
  organizationId: string;
  userId: string;
  deps: HubSpotLifecycleDependencies;
}): Promise<{ authorizationUrl: string; expiresAt: string }> {
  const state = bytesToBase64Url(randomBytes(32, input.deps));
  const nonceHash = await sha256Base64Url(state);
  const expiresAt = new Date(nowMs(input.deps) + 10 * 60 * 1000).toISOString();
  const scopes = [...HUBSPOT_P0_SCOPES];

  await input.deps.store.createOAuthState({
    organizationId: input.organizationId,
    userId: input.userId,
    nonceHash,
    requestedPermissions: scopes,
    expiresAt
  });

  const authorizationUrl = (input.deps.oauth ?? DEFAULT_OAUTH).buildAuthorizationUrl({
    clientId: required(input.deps.clientId, 'HubSpot client ID'),
    redirectUri: required(input.deps.redirectUri, 'HubSpot redirect URI'),
    state,
    scopes
  });

  await safeEvidence(input.deps, {
    org_id: input.organizationId,
    provider: 'hubspot',
    operation: 'oauth.prepare',
    status: 'completed',
    started_by: input.userId,
    completed_at: nowIso(input.deps)
  });

  return { authorizationUrl, expiresAt };
}

export async function completeHubSpotConnection(input: {
  state: string;
  code: string;
  deps: HubSpotLifecycleDependencies;
}): Promise<CrmConnectionView> {
  const state = required(input.state, 'HubSpot OAuth state');
  const code = required(input.code, 'HubSpot authorization code');
  const nonceHash = await sha256Base64Url(state);
  const stateRow = await input.deps.store.findOAuthState(nonceHash);
  if (!stateRow) throw new HubSpotLifecycleError('oauth_state_invalid', 400);
  assertStateFresh(stateRow, nowMs(input.deps));

  // Claim the state atomically before any provider call. This prevents concurrent/replayed
  // callbacks from racing and corrupting an already-valid connection.
  const claimed = await input.deps.store.consumeOAuthState(stateRow.id, nowIso(input.deps));
  if (!claimed) {
    throw new HubSpotLifecycleError('oauth_state_consumption_failed', 409);
  }

  const oauth = input.deps.oauth ?? DEFAULT_OAUTH;
  let token: HubSpotTokenResponse;
  try {
    token = await oauth.exchangeCode({
      clientId: required(input.deps.clientId, 'HubSpot client ID'),
      clientSecret: required(input.deps.clientSecret, 'HubSpot client secret'),
      redirectUri: required(input.deps.redirectUri, 'HubSpot redirect URI'),
      code,
      fetchImpl: input.deps.fetchImpl
    });
  } catch {
    await safeEvidence(input.deps, {
      org_id: stateRow.org_id,
      provider: 'hubspot',
      operation: 'oauth.callback',
      status: 'failed',
      started_by: stateRow.user_id,
      completed_at: nowIso(input.deps),
      error_code: 'oauth_exchange_failed'
    });
    throw new HubSpotLifecycleError('oauth_exchange_failed', 502);
  }
  if (!token.refreshToken) {
    throw new HubSpotLifecycleError('oauth_exchange_failed', 502);
  }

  let providerCredential: ProviderCredentialPayload | null = null;
  let credentialRow: HubSpotCredentialRow | null = null;
  let connectionPersisted = false;
  try {
    const { introspection, readiness } = await validateProvider(token.accessToken, input.deps);
    const grantedScopes = introspection.scopes.length > 0 ? introspection.scopes : token.scopes;
    assertRequiredScopes(stateRow.requested_permissions, grantedScopes);

    const timestamp = nowIso(input.deps);
    const accessExpiresAtMs = nowMs(input.deps) + token.expiresIn * 1000;
    providerCredential = {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      tokenType: token.tokenType,
      scopes: [...grantedScopes],
      expiresAt: accessExpiresAtMs
    };
    const sealed = await sealCredential({
      organizationId: stateRow.org_id,
      provider: 'hubspot',
      credential: providerCredential,
      key: input.deps.credentialKey,
      keyVersion: input.deps.keyVersion ?? 'v1'
    });

    credentialRow = await input.deps.store.insertCredential({
      org_id: stateRow.org_id,
      provider: 'hubspot',
      ciphertext: sealed.ciphertext,
      iv: sealed.iv,
      algorithm: sealed.algorithm,
      key_version: sealed.keyVersion,
      expires_at: new Date(accessExpiresAtMs).toISOString()
    });

    const row = await input.deps.store.upsertConnection({
      org_id: stateRow.org_id,
      provider: 'hubspot',
      state: 'connected',
      provider_account_id: readiness.account.id,
      provider_account_label: readiness.account.label,
      granted_scopes: providerCredential.scopes ?? [],
      credential_ref: credentialRow.id,
      last_verified_at: timestamp,
      last_success_at: timestamp,
      last_error_code: null,
      last_error_at: null,
      connected_by: stateRow.user_id,
      connected_at: timestamp,
      revoked_at: null
    });
    connectionPersisted = true;

    await safeEvidence(input.deps, {
      org_id: stateRow.org_id,
      provider: 'hubspot',
      operation: 'oauth.callback',
      status: 'completed',
      started_by: stateRow.user_id,
      completed_at: timestamp
    });
    return connectionView(row);
  } catch (error) {
    if (credentialRow) {
      try {
        await input.deps.store.deleteCredential(credentialRow.id, stateRow.org_id);
      } catch {
        // Continue compensation even if secret-row cleanup needs operator repair.
      }
    }
    if (connectionPersisted) {
      try {
        await input.deps.store.updateConnection(stateRow.org_id, {
          state: 'error',
          credential_ref: null,
          last_error_code:
            error instanceof HubSpotLifecycleError ? error.code : 'credential_storage_failed',
          last_error_at: nowIso(input.deps)
        });
      } catch {
        // Do not replace the original lifecycle failure with compensation failure.
      }
    }
    await safeEvidence(input.deps, {
      org_id: stateRow.org_id,
      provider: 'hubspot',
      operation: 'oauth.callback',
      status: 'failed',
      started_by: stateRow.user_id,
      completed_at: nowIso(input.deps),
      error_code: error instanceof HubSpotLifecycleError ? error.code : 'credential_storage_failed'
    });
    if (error instanceof HubSpotLifecycleError) throw error;
    throw new HubSpotLifecycleError('credential_storage_failed', 500);
  } finally {
    if (providerCredential) destroyCredentialPayload(providerCredential);
  }
}

export async function getHubSpotConnectionStatus(input: {
  organizationId: string;
  deps: HubSpotLifecycleDependencies;
}): Promise<CrmConnectionView> {
  return connectionView(await input.deps.store.getConnection(input.organizationId));
}

export async function refreshHubSpotConnectionCredential(input: {
  organizationId: string;
  actorUserId: string;
  deps: HubSpotLifecycleDependencies;
}): Promise<ProviderCredentialPayload> {
  const connection = await input.deps.store.getConnection(input.organizationId);
  if (!connection || !connection.credential_ref || !['connected', 'degraded'].includes(connection.state)) {
    throw new HubSpotLifecycleError('connection_not_ready', 409);
  }
  const row = await input.deps.store.getCredential(connection.credential_ref, input.organizationId);
  if (!row) throw new HubSpotLifecycleError('credential_missing', 409);

  let credential: ProviderCredentialPayload;
  try {
    credential = await openCredential({
      organizationId: input.organizationId,
      provider: 'hubspot',
      sealed: {
        ciphertext: row.ciphertext,
        iv: row.iv,
        algorithm: row.algorithm,
        keyVersion: row.key_version
      },
      key: input.deps.credentialKey
    });
  } catch {
    await input.deps.store.updateConnection(input.organizationId, {
      state: 'error',
      last_error_code: 'credential_missing',
      last_error_at: nowIso(input.deps)
    });
    throw new HubSpotLifecycleError('credential_missing', 500);
  }

  const expiresAt = credential.expiresAt ?? 0;
  if (expiresAt > nowMs(input.deps) + 60_000) return credential;
  const refreshToken = credential.refreshToken?.trim();
  if (!refreshToken) {
    destroyCredentialPayload(credential);
    await input.deps.store.updateConnection(input.organizationId, {
      state: 'expired',
      last_error_code: 'credential_refresh_failed',
      last_error_at: nowIso(input.deps)
    });
    throw new HubSpotLifecycleError('credential_refresh_failed', 401);
  }

  const oauth = input.deps.oauth ?? DEFAULT_OAUTH;
  try {
    const refreshed = await oauth.refreshToken({
      clientId: required(input.deps.clientId, 'HubSpot client ID'),
      clientSecret: required(input.deps.clientSecret, 'HubSpot client secret'),
      refreshToken,
      fetchImpl: input.deps.fetchImpl
    });
    const nextExpiresAt = nowMs(input.deps) + refreshed.expiresIn * 1000;
    const nextCredential: ProviderCredentialPayload = {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? refreshToken,
      tokenType: refreshed.tokenType,
      scopes: refreshed.scopes.length > 0 ? refreshed.scopes : credential.scopes,
      expiresAt: nextExpiresAt
    };
    const sealed = await sealCredential({
      organizationId: input.organizationId,
      provider: 'hubspot',
      credential: nextCredential,
      key: input.deps.credentialKey,
      keyVersion: input.deps.keyVersion ?? row.key_version
    });
    const updated = await input.deps.store.updateCredential(row.id, input.organizationId, {
      org_id: input.organizationId,
      provider: 'hubspot',
      ciphertext: sealed.ciphertext,
      iv: sealed.iv,
      algorithm: sealed.algorithm,
      key_version: sealed.keyVersion,
      expires_at: new Date(nextExpiresAt).toISOString()
    });
    if (!updated) {
      destroyCredentialPayload(nextCredential);
      throw new HubSpotLifecycleError('credential_storage_failed', 500);
    }
    await input.deps.store.updateConnection(input.organizationId, {
      state: 'connected',
      last_success_at: nowIso(input.deps),
      last_error_code: null,
      last_error_at: null
    });
    destroyCredentialPayload(credential);
    return nextCredential;
  } catch (error) {
    destroyCredentialPayload(credential);
    const expired = error instanceof HubSpotOAuthError && error.code === 'invalid_grant';
    await input.deps.store.updateConnection(input.organizationId, {
      state: expired ? 'expired' : 'error',
      last_error_code: 'credential_refresh_failed',
      last_error_at: nowIso(input.deps)
    });
    await safeEvidence(input.deps, {
      org_id: input.organizationId,
      provider: 'hubspot',
      operation: 'credential.refresh',
      status: 'failed',
      started_by: input.actorUserId,
      completed_at: nowIso(input.deps),
      error_code: 'credential_refresh_failed'
    });
    if (error instanceof HubSpotLifecycleError) throw error;
    throw new HubSpotLifecycleError('credential_refresh_failed', expired ? 401 : 502);
  }
}

export async function disconnectHubSpotConnection(input: {
  organizationId: string;
  actorUserId: string;
  deps: HubSpotLifecycleDependencies;
}): Promise<CrmConnectionView> {
  const connection = await input.deps.store.getConnection(input.organizationId);
  if (!connection) return connectionView(null);

  let remoteRevokeFailed = false;
  if (connection.credential_ref) {
    const row = await input.deps.store.getCredential(connection.credential_ref, input.organizationId);
    if (row) {
      let credential: ProviderCredentialPayload | null = null;
      try {
        credential = await openCredential({
          organizationId: input.organizationId,
          provider: 'hubspot',
          sealed: {
            ciphertext: row.ciphertext,
            iv: row.iv,
            algorithm: row.algorithm,
            keyVersion: row.key_version
          },
          key: input.deps.credentialKey
        });
        if (credential.refreshToken?.trim()) {
          try {
            await (input.deps.oauth ?? DEFAULT_OAUTH).revokeToken({
              clientId: required(input.deps.clientId, 'HubSpot client ID'),
              clientSecret: required(input.deps.clientSecret, 'HubSpot client secret'),
              token: credential.refreshToken,
              tokenTypeHint: 'refresh_token',
              fetchImpl: input.deps.fetchImpl
            });
          } catch {
            remoteRevokeFailed = true;
          }
        }
      } catch {
        remoteRevokeFailed = true;
      } finally {
        if (credential) destroyCredentialPayload(credential);
        await input.deps.store.deleteCredential(row.id, input.organizationId);
      }
    }
  }

  const timestamp = nowIso(input.deps);
  const updated = await input.deps.store.updateConnection(input.organizationId, {
    state: 'revoked',
    credential_ref: null,
    revoked_at: timestamp,
    last_error_code: remoteRevokeFailed ? 'remote_revoke_failed' : null,
    last_error_at: remoteRevokeFailed ? timestamp : null
  });
  await safeEvidence(input.deps, {
    org_id: input.organizationId,
    provider: 'hubspot',
    operation: 'connection.disconnect',
    status: 'completed',
    started_by: input.actorUserId,
    completed_at: timestamp,
    error_code: remoteRevokeFailed ? 'remote_revoke_failed' : null
  });
  return connectionView(
    updated ?? {
      ...connection,
      state: 'revoked',
      credential_ref: null,
      revoked_at: timestamp,
      last_error_code: remoteRevokeFailed ? 'remote_revoke_failed' : null,
      last_error_at: remoteRevokeFailed ? timestamp : null
    }
  );
}
