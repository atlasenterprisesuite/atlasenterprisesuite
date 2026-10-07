import type { CrmConnectionView } from '../../../packages/core/src/crm.ts';
import {
  destroyCredentialPayload,
  openCredential,
  sealCredential,
  type CredentialKey,
  type ProviderCredentialPayload
} from './integration-credential-vault.ts';
import {
  SalesforceOAuthError,
  buildSalesforceAuthorizationUrl,
  exchangeSalesforceCode,
  introspectSalesforceToken,
  refreshSalesforceToken,
  revokeSalesforceToken,
  normalizeSalesforceLoginBaseUrl,
  type SalesforceFetch
} from './salesforce-oauth.ts';
import {
  SalesforceCrmAdapter,
  type SalesforceCrmContext,
  type SalesforceOrgInventory
} from './salesforce-crm.ts';
import type {
  SalesforceConnectionRow,
  SalesforceConnectionStore,
  SalesforceCredentialRow,
  SalesforceOAuthStateRow
} from './salesforce-connection-store.ts';

export const SALESFORCE_P0_SCOPES = ['api', 'refresh_token'] as const;

export type SalesforceLifecycleErrorCode =
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
  | 'canonical_org_required'
  | 'credential_missing'
  | 'credential_refresh_failed'
  | 'credential_storage_failed'
  | 'connection_not_found';

export class SalesforceLifecycleError extends Error {
  readonly code: SalesforceLifecycleErrorCode;
  readonly status: number;

  constructor(code: SalesforceLifecycleErrorCode, status: number) {
    super(`Salesforce connection lifecycle failed (${code})`);
    this.name = 'SalesforceLifecycleError';
    this.code = code;
    this.status = status;
  }
}

export type SalesforceLifecycleDependencies = {
  store: SalesforceConnectionStore;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  loginBaseUrl?: string;
  apiVersion?: string;
  credentialKey: CredentialKey;
  keyVersion?: string;
  fetchImpl?: SalesforceFetch;
  now?: () => number;
  randomBytes?: (length: number) => Uint8Array;
  adapter?: Pick<SalesforceCrmAdapter, 'readiness' | 'inventory'>;
};

function nowMs(deps: SalesforceLifecycleDependencies): number {
  return deps.now?.() ?? Date.now();
}

function nowIso(deps: SalesforceLifecycleDependencies): string {
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
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function randomBytes(length: number, deps: SalesforceLifecycleDependencies): Uint8Array {
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

function assertStateFresh(row: SalesforceOAuthStateRow, now: number): void {
  if (row.consumed_at) throw new SalesforceLifecycleError('oauth_state_consumed', 400);
  const expiresAt = Date.parse(row.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    throw new SalesforceLifecycleError('oauth_state_expired', 400);
  }
}

function assertRequiredScopes(requiredScopes: readonly string[], grantedScopes: readonly string[]): void {
  const granted = new Set(grantedScopes.map((scope) => scope.trim()).filter(Boolean));
  if (requiredScopes.some((scope) => !granted.has(scope))) {
    throw new SalesforceLifecycleError('oauth_scope_mismatch', 403);
  }
}

function connectionView(row: SalesforceConnectionRow | null): CrmConnectionView {
  if (!row) {
    return {
      provider: 'salesforce',
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
    provider: 'salesforce',
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
  deps: SalesforceLifecycleDependencies,
  input: Parameters<SalesforceConnectionStore['recordEvidence']>[0]
): Promise<void> {
  try {
    await deps.store.recordEvidence(input);
  } catch {
    // Evidence storage must never expose credentials or replace the primary result.
  }
}

function adapter(deps: SalesforceLifecycleDependencies) {
  return deps.adapter ?? new SalesforceCrmAdapter();
}

function contextFromCredential(
  credential: ProviderCredentialPayload,
  deps: SalesforceLifecycleDependencies
): SalesforceCrmContext {
  const instanceUrl = credential.secretValues?.instanceUrl?.trim();
  const identityUrl = credential.secretValues?.identityUrl?.trim();
  if (!instanceUrl || !identityUrl) {
    throw new SalesforceLifecycleError('credential_missing', 409);
  }
  return {
    accessToken: credential.accessToken,
    instanceUrl,
    identityUrl,
    apiVersion: deps.apiVersion,
    fetchImpl: deps.fetchImpl
  };
}

export async function prepareSalesforceConnection(input: {
  organizationId: string;
  userId: string;
  deps: SalesforceLifecycleDependencies;
}): Promise<{ authorizationUrl: string; expiresAt: string }> {
  const state = bytesToBase64Url(randomBytes(32, input.deps));
  const nonceHash = await sha256Base64Url(state);
  const expiresAt = new Date(nowMs(input.deps) + 10 * 60 * 1000).toISOString();
  const scopes = [...SALESFORCE_P0_SCOPES];

  await input.deps.store.createOAuthState({
    organizationId: input.organizationId,
    userId: input.userId,
    nonceHash,
    requestedPermissions: scopes,
    expiresAt
  });

  const authorizationUrl = buildSalesforceAuthorizationUrl({
    clientId: required(input.deps.clientId, 'Salesforce client ID'),
    redirectUri: required(input.deps.redirectUri, 'Salesforce redirect URI'),
    state,
    scopes,
    loginBaseUrl: input.deps.loginBaseUrl
  });

  await safeEvidence(input.deps, {
    org_id: input.organizationId,
    provider: 'salesforce',
    operation: 'oauth.prepare',
    status: 'completed',
    started_by: input.userId,
    completed_at: nowIso(input.deps)
  });

  return { authorizationUrl, expiresAt };
}

export async function completeSalesforceConnection(input: {
  state: string;
  code: string;
  deps: SalesforceLifecycleDependencies;
}): Promise<{ connection: CrmConnectionView; candidateCount: number; canonical: boolean }> {
  const state = required(input.state, 'Salesforce OAuth state');
  const code = required(input.code, 'Salesforce authorization code');
  const nonceHash = await sha256Base64Url(state);
  const stateRow = await input.deps.store.findOAuthState(nonceHash);
  if (!stateRow) throw new SalesforceLifecycleError('oauth_state_invalid', 400);
  assertStateFresh(stateRow, nowMs(input.deps));
  if (!(await input.deps.store.consumeOAuthState(stateRow.id, nowIso(input.deps)))) {
    throw new SalesforceLifecycleError('oauth_state_consumption_failed', 409);
  }

  let token;
  try {
    token = await exchangeSalesforceCode({
      clientId: required(input.deps.clientId, 'Salesforce client ID'),
      clientSecret: required(input.deps.clientSecret, 'Salesforce client secret'),
      redirectUri: required(input.deps.redirectUri, 'Salesforce redirect URI'),
      code,
      loginBaseUrl: input.deps.loginBaseUrl,
      fetchImpl: input.deps.fetchImpl
    });
  } catch {
    await safeEvidence(input.deps, {
      org_id: stateRow.org_id,
      provider: 'salesforce',
      operation: 'oauth.callback',
      status: 'failed',
      started_by: stateRow.user_id,
      completed_at: nowIso(input.deps),
      error_code: 'oauth_exchange_failed'
    });
    throw new SalesforceLifecycleError('oauth_exchange_failed', 502);
  }
  if (!token.refreshToken) throw new SalesforceLifecycleError('oauth_exchange_failed', 502);

  let providerCredential: ProviderCredentialPayload | null = null;
  let credentialRow: SalesforceCredentialRow | null = null;
  try {
    let introspection;
    try {
      introspection = await introspectSalesforceToken({
        clientId: input.deps.clientId,
        clientSecret: input.deps.clientSecret,
        token: token.accessToken,
        tokenTypeHint: 'access_token',
        loginBaseUrl: input.deps.loginBaseUrl,
        fetchImpl: input.deps.fetchImpl
      });
    } catch {
      throw new SalesforceLifecycleError('oauth_introspection_failed', 502);
    }
    if (!introspection.active) throw new SalesforceLifecycleError('oauth_token_inactive', 401);
    const grantedScopes = introspection.scopes.length ? introspection.scopes : token.scopes;
    assertRequiredScopes(stateRow.requested_permissions, grantedScopes);

    let readiness;
    try {
      readiness = await adapter(input.deps).readiness({
        accessToken: token.accessToken,
        instanceUrl: token.instanceUrl,
        identityUrl: token.identityUrl,
        apiVersion: input.deps.apiVersion,
        fetchImpl: input.deps.fetchImpl
      });
    } catch {
      throw new SalesforceLifecycleError('provider_probe_failed', 502);
    }
    if (!readiness.ready || !readiness.identity || !readiness.organization) {
      throw new SalesforceLifecycleError('provider_probe_failed', 502);
    }
    if (readiness.identity.organizationId !== readiness.organization.id) {
      throw new SalesforceLifecycleError('provider_account_mismatch', 502);
    }

    const existing = await input.deps.store.listConnections(stateRow.org_id);
    const activeExisting = existing.filter((candidate) => candidate.state !== 'revoked');
    const existingSame = activeExisting.find(
      (candidate) => candidate.provider_account_id === readiness.organization!.id
    );
    const distinctExisting = activeExisting.filter(
      (candidate) => candidate.provider_account_id !== readiness.organization!.id
    );
    const duplicateOrgDetected = distinctExisting.length > 0;
    const canonical = !duplicateOrgDetected && existingSame?.metadata?.canonical === true;
    const timestamp = nowIso(input.deps);

    // Discovery of a second immutable Salesforce Organization ID invalidates any
    // previous implicit/explicit canonical assumption until the operator compares
    // both inventories and selects one. This keeps duplicate-production handling
    // fail-closed instead of silently keeping the first org authoritative.
    if (duplicateOrgDetected) {
      for (const candidate of distinctExisting) {
        if (candidate.metadata?.canonical !== true && candidate.metadata?.classification === 'unknown') {
          continue;
        }
        await input.deps.store.updateConnectionById(stateRow.org_id, candidate.id, {
          metadata: {
            ...candidate.metadata,
            canonical: false,
            classification: 'unknown'
          },
          last_error_code: 'canonical_org_required',
          last_error_at: timestamp
        });
      }
    }

    providerCredential = {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      tokenType: token.tokenType,
      scopes: [...grantedScopes],
      expiresAt: introspection.expiresAt,
      secretValues: {
        instanceUrl: token.instanceUrl,
        identityUrl: token.identityUrl,
        loginBaseUrl: normalizeSalesforceLoginBaseUrl(input.deps.loginBaseUrl)
      }
    };
    const sealed = await sealCredential({
      organizationId: stateRow.org_id,
      provider: 'salesforce',
      credential: providerCredential,
      key: input.deps.credentialKey,
      keyVersion: input.deps.keyVersion ?? 'v1'
    });
    credentialRow = await input.deps.store.insertCredential({
      org_id: stateRow.org_id,
      provider: 'salesforce',
      ciphertext: sealed.ciphertext,
      iv: sealed.iv,
      algorithm: sealed.algorithm,
      key_version: sealed.keyVersion,
      expires_at: introspection.expiresAt ? new Date(introspection.expiresAt).toISOString() : null
    });

    const priorCredentialRef = existingSame?.credential_ref ?? null;
    const row = await input.deps.store.upsertConnection({
      org_id: stateRow.org_id,
      connection_name: `org:${readiness.organization.id}`,
      state: 'connected',
      provider_account_id: readiness.organization.id,
      provider_account_label: readiness.organization.name,
      granted_scopes: [...grantedScopes],
      credential_ref: credentialRow.id,
      endpoint_origin: token.instanceUrl,
      metadata: {
        ...(existingSame?.metadata ?? {}),
        canonical: duplicateOrgDetected ? false : canonical,
        classification: canonical && !duplicateOrgDetected ? 'canonical' : 'unknown',
        instanceUrl: token.instanceUrl,
        userId: readiness.identity.userId,
        username: readiness.identity.username,
        organizationType: readiness.organization.organizationType,
        instanceName: readiness.organization.instanceName,
        isSandbox: readiness.organization.isSandbox,
        apiVersion: input.deps.apiVersion ?? 'v68.0'
      },
      last_verified_at: timestamp,
      last_success_at: timestamp,
      last_error_code: duplicateOrgDetected ? 'canonical_org_required' : null,
      last_error_at: duplicateOrgDetected ? timestamp : null,
      connected_by: stateRow.user_id,
      connected_at: existingSame?.connected_at ?? timestamp,
      revoked_at: null
    });

    if (priorCredentialRef && priorCredentialRef !== credentialRow.id) {
      try {
        await input.deps.store.deleteCredential(priorCredentialRef, stateRow.org_id);
      } catch {
        // New verified credential remains authoritative; stale secret cleanup can be retried.
      }
    }

    const candidates = await input.deps.store.listConnections(stateRow.org_id);
    await safeEvidence(input.deps, {
      org_id: stateRow.org_id,
      provider: 'salesforce',
      operation: 'oauth.callback',
      status: 'completed',
      started_by: stateRow.user_id,
      completed_at: timestamp,
      records_observed: candidates.filter((candidate) => candidate.state !== 'revoked').length
    });
    return {
      connection: connectionView(row),
      candidateCount: candidates.filter((candidate) => candidate.state !== 'revoked').length,
      canonical: duplicateOrgDetected ? false : canonical
    };
  } catch (error) {
    if (credentialRow) {
      try {
        await input.deps.store.deleteCredential(credentialRow.id, stateRow.org_id);
      } catch {
        // Preserve original failure.
      }
    }
    await safeEvidence(input.deps, {
      org_id: stateRow.org_id,
      provider: 'salesforce',
      operation: 'oauth.callback',
      status: 'failed',
      started_by: stateRow.user_id,
      completed_at: nowIso(input.deps),
      error_code: error instanceof SalesforceLifecycleError ? error.code : 'credential_storage_failed'
    });
    if (error instanceof SalesforceLifecycleError) throw error;
    throw new SalesforceLifecycleError('credential_storage_failed', 500);
  } finally {
    if (providerCredential) destroyCredentialPayload(providerCredential);
  }
}

export async function listSalesforceCandidates(input: {
  organizationId: string;
  deps: SalesforceLifecycleDependencies;
}): Promise<SalesforceConnectionRow[]> {
  return (await input.deps.store.listConnections(input.organizationId))
    .filter((row) => row.state !== 'revoked');
}

export async function canonicalSalesforceConnection(input: {
  organizationId: string;
  deps: SalesforceLifecycleDependencies;
}): Promise<SalesforceConnectionRow> {
  const candidates = await listSalesforceCandidates(input);
  const canonical = candidates.find((row) => row.metadata?.canonical === true);
  if (canonical) return canonical;
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) throw new SalesforceLifecycleError('canonical_org_required', 409);
  throw new SalesforceLifecycleError('connection_not_ready', 409);
}

export async function getSalesforceConnectionStatus(input: {
  organizationId: string;
  deps: SalesforceLifecycleDependencies;
}): Promise<{
  connection: CrmConnectionView;
  candidateCount: number;
  canonicalRequired: boolean;
}> {
  const candidates = await listSalesforceCandidates(input);
  const canonical = candidates.find((row) => row.metadata?.canonical === true) ?? (candidates.length === 1 ? candidates[0] : null);
  return {
    connection: connectionView(canonical),
    candidateCount: candidates.length,
    canonicalRequired: candidates.length > 1 && !candidates.some((row) => row.metadata?.canonical === true)
  };
}

export async function loadSalesforceCredential(input: {
  organizationId: string;
  actorUserId: string;
  deps: SalesforceLifecycleDependencies;
  connection?: SalesforceConnectionRow;
  forceRefresh?: boolean;
}): Promise<{ connection: SalesforceConnectionRow; credential: ProviderCredentialPayload }> {
  const connection = input.connection ?? await canonicalSalesforceConnection(input);
  if (!connection.credential_ref || !['connected', 'degraded'].includes(connection.state)) {
    throw new SalesforceLifecycleError('connection_not_ready', 409);
  }
  const row = await input.deps.store.getCredential(connection.credential_ref, input.organizationId);
  if (!row) throw new SalesforceLifecycleError('credential_missing', 409);

  let credential: ProviderCredentialPayload;
  try {
    credential = await openCredential({
      organizationId: input.organizationId,
      provider: 'salesforce',
      sealed: {
        ciphertext: row.ciphertext,
        iv: row.iv,
        algorithm: row.algorithm,
        keyVersion: row.key_version
      },
      key: input.deps.credentialKey
    });
  } catch {
    await input.deps.store.updateConnectionById(input.organizationId, connection.id, {
      state: 'error',
      last_error_code: 'credential_missing',
      last_error_at: nowIso(input.deps)
    });
    throw new SalesforceLifecycleError('credential_missing', 500);
  }

  const expiresAt = credential.expiresAt ?? Number.POSITIVE_INFINITY;
  if (!input.forceRefresh && expiresAt > nowMs(input.deps) + 60_000) {
    return { connection, credential };
  }
  const refreshToken = credential.refreshToken?.trim();
  if (!refreshToken) {
    destroyCredentialPayload(credential);
    await input.deps.store.updateConnectionById(input.organizationId, connection.id, {
      state: 'expired',
      last_error_code: 'credential_refresh_failed',
      last_error_at: nowIso(input.deps)
    });
    throw new SalesforceLifecycleError('credential_refresh_failed', 401);
  }

  try {
    const refreshed = await refreshSalesforceToken({
      clientId: input.deps.clientId,
      clientSecret: input.deps.clientSecret,
      refreshToken,
      loginBaseUrl: credential.secretValues?.loginBaseUrl ?? input.deps.loginBaseUrl,
      fetchImpl: input.deps.fetchImpl
    });
    const introspection = await introspectSalesforceToken({
      clientId: input.deps.clientId,
      clientSecret: input.deps.clientSecret,
      token: refreshed.accessToken,
      tokenTypeHint: 'access_token',
      loginBaseUrl: credential.secretValues?.loginBaseUrl ?? input.deps.loginBaseUrl,
      fetchImpl: input.deps.fetchImpl
    });
    if (!introspection.active) throw new SalesforceLifecycleError('credential_refresh_failed', 401);
    const next: ProviderCredentialPayload = {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? refreshToken,
      tokenType: refreshed.tokenType,
      scopes: introspection.scopes.length ? introspection.scopes : credential.scopes,
      expiresAt: introspection.expiresAt,
      secretValues: {
        instanceUrl: refreshed.instanceUrl,
        identityUrl: refreshed.identityUrl,
        loginBaseUrl: credential.secretValues?.loginBaseUrl ?? normalizeSalesforceLoginBaseUrl(input.deps.loginBaseUrl)
      }
    };
    const sealed = await sealCredential({
      organizationId: input.organizationId,
      provider: 'salesforce',
      credential: next,
      key: input.deps.credentialKey,
      keyVersion: input.deps.keyVersion ?? row.key_version
    });
    const updated = await input.deps.store.updateCredential(row.id, input.organizationId, {
      org_id: input.organizationId,
      provider: 'salesforce',
      ciphertext: sealed.ciphertext,
      iv: sealed.iv,
      algorithm: sealed.algorithm,
      key_version: sealed.keyVersion,
      expires_at: introspection.expiresAt ? new Date(introspection.expiresAt).toISOString() : null
    });
    if (!updated) {
      destroyCredentialPayload(next);
      throw new SalesforceLifecycleError('credential_storage_failed', 500);
    }
    await input.deps.store.updateConnectionById(input.organizationId, connection.id, {
      state: 'connected',
      endpoint_origin: refreshed.instanceUrl,
      last_success_at: nowIso(input.deps),
      last_error_code: null,
      last_error_at: null
    });
    destroyCredentialPayload(credential);
    return { connection, credential: next };
  } catch (error) {
    destroyCredentialPayload(credential);
    const expired = error instanceof SalesforceOAuthError && error.code === 'invalid_grant';
    await input.deps.store.updateConnectionById(input.organizationId, connection.id, {
      state: expired ? 'expired' : 'error',
      last_error_code: 'credential_refresh_failed',
      last_error_at: nowIso(input.deps)
    });
    throw new SalesforceLifecycleError('credential_refresh_failed', expired ? 401 : 502);
  }
}

export async function inventorySalesforceConnection(input: {
  organizationId: string;
  actorUserId: string;
  connectionId?: string;
  deps: SalesforceLifecycleDependencies;
}): Promise<{ connection: CrmConnectionView; inventory: SalesforceOrgInventory }> {
  const connection = input.connectionId
    ? await input.deps.store.getConnectionById(input.organizationId, input.connectionId)
    : await canonicalSalesforceConnection(input);
  if (!connection) throw new SalesforceLifecycleError('connection_not_found', 404);

  const loaded = await loadSalesforceCredential({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    connection,
    deps: input.deps
  });
  try {
    const inventory = await adapter(input.deps).inventory(contextFromCredential(loaded.credential, input.deps));
    if (inventory.identity.organizationId !== connection.provider_account_id) {
      throw new SalesforceLifecycleError('provider_account_mismatch', 502);
    }
    const timestamp = nowIso(input.deps);
    const row = await input.deps.store.updateConnectionById(input.organizationId, connection.id, {
      state: 'connected',
      provider_account_label: inventory.organization.name,
      endpoint_origin: inventory.instanceUrl,
      metadata: {
        ...connection.metadata,
        instanceUrl: inventory.instanceUrl,
        userId: inventory.identity.userId,
        username: inventory.identity.username,
        organizationType: inventory.organization.organizationType,
        instanceName: inventory.organization.instanceName,
        isSandbox: inventory.organization.isSandbox,
        apiVersion: inventory.apiVersion,
        recordCounts: inventory.recordCounts,
        inventoryProbedAt: inventory.probedAt
      },
      last_verified_at: timestamp,
      last_success_at: timestamp,
      last_error_code: connection.metadata?.canonical ? null : connection.last_error_code,
      last_error_at: connection.metadata?.canonical ? null : connection.last_error_at
    });
    await safeEvidence(input.deps, {
      org_id: input.organizationId,
      provider: 'salesforce',
      operation: 'org.inventory',
      status: 'completed',
      records_observed: Object.values(inventory.recordCounts).filter((value) => value !== null).length,
      started_by: input.actorUserId,
      completed_at: timestamp
    });
    return { connection: connectionView(row ?? connection), inventory };
  } finally {
    destroyCredentialPayload(loaded.credential);
  }
}

export async function selectCanonicalSalesforceConnection(input: {
  organizationId: string;
  actorUserId: string;
  connectionId: string;
  deps: SalesforceLifecycleDependencies;
}): Promise<{ connection: CrmConnectionView; candidates: SalesforceConnectionRow[] }> {
  const candidates = await listSalesforceCandidates(input);
  const selected = candidates.find((row) => row.id === input.connectionId);
  if (!selected) throw new SalesforceLifecycleError('connection_not_found', 404);
  if (!selected.last_verified_at || !selected.provider_verified || selected.state !== 'connected') {
    throw new SalesforceLifecycleError('connection_not_ready', 409);
  }

  let selectedRow: SalesforceConnectionRow | null = null;
  for (const candidate of candidates) {
    const isSelected = candidate.id === selected.id;
    const classification = isSelected
      ? 'canonical'
      : candidate.metadata?.isSandbox
        ? 'test-misclassified-as-production'
        : 'secondary-production';
    const updated = await input.deps.store.updateConnectionById(input.organizationId, candidate.id, {
      metadata: { ...candidate.metadata, canonical: isSelected, classification },
      last_error_code: isSelected ? null : candidate.last_error_code,
      last_error_at: isSelected ? null : candidate.last_error_at
    });
    if (isSelected) selectedRow = updated;
  }
  await safeEvidence(input.deps, {
    org_id: input.organizationId,
    provider: 'salesforce',
    operation: 'org.select_canonical',
    status: 'completed',
    started_by: input.actorUserId,
    completed_at: nowIso(input.deps),
    evidence_ref: selected.provider_account_id ?? selected.id
  });
  return {
    connection: connectionView(selectedRow ?? selected),
    candidates: await listSalesforceCandidates(input)
  };
}

export async function disconnectSalesforceConnection(input: {
  organizationId: string;
  actorUserId: string;
  connectionId?: string;
  deps: SalesforceLifecycleDependencies;
}): Promise<CrmConnectionView> {
  const connection = input.connectionId
    ? await input.deps.store.getConnectionById(input.organizationId, input.connectionId)
    : await canonicalSalesforceConnection(input);
  if (!connection) return connectionView(null);

  let remoteRevokeFailed = false;
  if (connection.credential_ref) {
    const row = await input.deps.store.getCredential(connection.credential_ref, input.organizationId);
    if (row) {
      let credential: ProviderCredentialPayload | null = null;
      try {
        credential = await openCredential({
          organizationId: input.organizationId,
          provider: 'salesforce',
          sealed: {
            ciphertext: row.ciphertext,
            iv: row.iv,
            algorithm: row.algorithm,
            keyVersion: row.key_version
          },
          key: input.deps.credentialKey
        });
        const revokeToken = credential.refreshToken?.trim() || credential.accessToken;
        await revokeSalesforceToken({
          token: revokeToken,
          loginBaseUrl: credential.secretValues?.loginBaseUrl ?? input.deps.loginBaseUrl,
          fetchImpl: input.deps.fetchImpl
        });
      } catch {
        remoteRevokeFailed = true;
      } finally {
        if (credential) destroyCredentialPayload(credential);
        await input.deps.store.deleteCredential(row.id, input.organizationId);
      }
    }
  }

  const timestamp = nowIso(input.deps);
  const updated = await input.deps.store.updateConnectionById(input.organizationId, connection.id, {
    state: 'revoked',
    credential_ref: null,
    metadata: { ...connection.metadata, canonical: false },
    revoked_at: timestamp,
    last_error_code: remoteRevokeFailed ? 'remote_revoke_failed' : null,
    last_error_at: remoteRevokeFailed ? timestamp : null
  });
  await safeEvidence(input.deps, {
    org_id: input.organizationId,
    provider: 'salesforce',
    operation: 'connection.disconnect',
    status: remoteRevokeFailed ? 'failed' : 'completed',
    started_by: input.actorUserId,
    completed_at: timestamp,
    error_code: remoteRevokeFailed ? 'remote_revoke_failed' : null
  });
  return connectionView(updated ?? connection);
}
