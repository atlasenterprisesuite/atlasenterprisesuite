import { evaluateCapabilityRequest } from '../../../packages/integrations/gateway.ts';
import { requiredProviderScopes } from '../../../packages/integrations/provider-registry.ts';
import type {
  IntegrationActorContext,
  IntegrationCapability,
  IntegrationConnection,
  IntegrationGrant,
  IntegrationPermission
} from '../../../packages/integrations/types.ts';
import { resolveIntegrationContext, integrationError, IntegrationEdgeError, type IntegrationRequestContext } from '../_shared/integrations/context.ts';
import {
  listConnections,
  loadConnection,
  loadGrant,
  listGrants,
  createIntegrationGrant,
  revokeIntegrationGrant,
  listIntegrationEvents,
  updateConnection,
  deleteCredentialRecord,
  type IntegrationConnectionRow,
  type IntegrationGrantRow,
  type IntegrationEventRow
} from '../_shared/integrations/repository.ts';
import { readCredentialSecret, storeCredentialSecret } from '../_shared/integrations/vault.ts';
import { writeIntegrationEvent } from '../_shared/integrations/audit.ts';
import { createMicrosoftAdapter } from '../_shared/integrations/providers/microsoft.ts';

const ALLOWED_ACTIONS = new Set([
  'connections',
  'connection',
  'verify',
  'execute',
  'revoke',
  'grants',
  'grant',
  'revoke-grant',
  'audit'
]);

function env(name: string) {
  return String(Deno.env.get(name) || '').trim();
}

function cors(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowed = new Set([
    'https://atlasenterprisesuite.com',
    'https://www.atlasenterprisesuite.com',
    'http://localhost:5173',
    'http://127.0.0.1:5173'
  ]);
  return {
    'access-control-allow-origin': allowed.has(origin) ? origin : 'https://www.atlasenterprisesuite.com',
    'access-control-allow-headers': 'authorization, apikey, content-type, x-atlas-org-id, x-atlas-session-id, x-request-id',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'vary': 'Origin',
    'x-content-type-options': 'nosniff'
  };
}

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: cors(req) });
}

function safeError(req: Request, error: unknown) {
  if (error instanceof IntegrationEdgeError) return json(req, { ok: false, error: error.code }, error.status);
  const code = error instanceof Error && /^[a-z0-9_]+$/i.test(error.message) ? error.message : 'integration_gateway_failed';
  const status = code.includes('permission') || code.includes('authorization_denied') ? 403
    : code.includes('not_found') || code.includes('not_connected') ? 404
    : code.includes('not_verified') || code.includes('grant') || code.includes('scope') || code.includes('reconnect') ? 409
    : code.includes('required') || code.includes('unsupported') ? 422
    : 500;
  return json(req, { ok: false, error: code }, status);
}

async function bodyOf(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? body as Record<string, unknown> : {};
  } catch {
    throw integrationError('invalid_json', 400);
  }
}

function requirePermission(context: IntegrationRequestContext, permission: IntegrationPermission) {
  if (!context.permissions.includes(permission) && !context.permissions.includes('integrations.admin') && !context.permissions.includes('*')) {
    throw integrationError('permission_denied', 403, { permission });
  }
}

function providerKey(value: unknown) {
  const provider = String(value || 'microsoft').trim().toLowerCase();
  if (provider !== 'microsoft') throw integrationError('provider_not_supported', 422);
  return provider;
}

function safeIdentifier(value: unknown, fallback = '') {
  const text = String(value ?? '').trim();
  return text && text.length <= 160 && /^[a-zA-Z0-9_.:@/-]+$/.test(text) ? text : fallback;
}

function microsoftAdapter() {
  const clientId = env('MICROSOFT_CLIENT_ID');
  const redirectUri = env('MICROSOFT_REDIRECT_URI');
  if (!clientId || !redirectUri) throw integrationError('provider_not_configured', 503);
  return createMicrosoftAdapter({
    clientId,
    clientSecret: env('MICROSOFT_CLIENT_SECRET') || undefined,
    redirectUri
  });
}

function safeConnection(row: IntegrationConnectionRow) {
  return {
    id: row.id,
    provider_key: row.provider,
    connection_name: row.connection_name,
    status: row.state,
    connector_class: row.connector_class,
    environment: row.environment,
    masked_identity: row.provider_account_label,
    scopes: Array.isArray(row.granted_scopes) ? row.granted_scopes : [],
    connected_at: row.connected_at,
    last_verified_at: row.last_verified_at,
    revoked_at: row.revoked_at,
    last_error_code: row.last_error_code
  };
}

function safeGrant(row: IntegrationGrantRow) {
  return {
    id: row.id,
    principal_type: row.principal_type,
    principal_id: row.principal_id,
    module: row.module,
    capability: row.capability,
    granted_at: row.granted_at,
    revoked_at: row.revoked_at
  };
}

const secretKeyPattern = /token|secret|password|authorization|cookie|verifier|client[_-]?secret/i;

function safeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (secretKeyPattern.test(key)) continue;
    if (typeof item === 'string') result[key] = item.slice(0, 500);
    else if (typeof item === 'number' || typeof item === 'boolean' || item === null) result[key] = item;
    else if (Array.isArray(item)) result[key] = item.filter((entry) => ['string', 'number', 'boolean'].includes(typeof entry)).slice(0, 30);
  }
  return result;
}

function safeEvent(row: IntegrationEventRow) {
  return {
    id: row.id,
    action: row.action,
    status_before: row.status_before,
    status_after: row.status_after,
    requested_scopes: Array.isArray(row.requested_scopes) ? row.requested_scopes : [],
    module: row.module,
    environment: row.environment,
    approval_id: row.approval_id,
    correlation_id: row.correlation_id,
    outcome: row.outcome,
    provider_error_code: row.provider_error_code,
    metadata: safeMetadata(row.metadata),
    created_at: row.created_at
  };
}

type StoredMicrosoftTokens = {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string;
  scopes: string[];
  expiresAt: number | null;
};

async function tokensFor(context: IntegrationRequestContext, row: IntegrationConnectionRow): Promise<StoredMicrosoftTokens> {
  if (!row.credential_ref) throw integrationError('provider_not_connected', 404);
  const secret = await readCredentialSecret({
    organizationId: context.organizationId,
    provider: 'microsoft',
    credentialKind: 'oauth_tokens',
    credentialRef: row.credential_ref
  });
  let parsed: any;
  try { parsed = JSON.parse(secret); } catch { throw integrationError('credential_unreadable', 503); }
  if (!parsed?.accessToken || !Array.isArray(parsed?.scopes)) throw integrationError('credential_unreadable', 503);
  return {
    accessToken: String(parsed.accessToken),
    refreshToken: parsed.refreshToken ? String(parsed.refreshToken) : null,
    tokenType: String(parsed.tokenType || 'Bearer'),
    scopes: parsed.scopes.map((scope: unknown) => String(scope)).filter(Boolean),
    expiresAt: Number.isFinite(Number(parsed.expiresAt)) ? Number(parsed.expiresAt) : null
  };
}

async function getConnectionOrThrow(context: IntegrationRequestContext, provider: string) {
  const row = await loadConnection(context, { providerKey: provider, connectionName: 'default' });
  if (!row) throw integrationError('provider_not_connected', 404);
  return row;
}

async function handleConnections(req: Request, context: IntegrationRequestContext) {
  requirePermission(context, 'integrations.view');
  const rows = await listConnections(context);
  return json(req, { ok: true, connections: rows.map(safeConnection) });
}

async function handleConnection(req: Request, url: URL, context: IntegrationRequestContext) {
  requirePermission(context, 'integrations.view');
  const provider = providerKey(url.searchParams.get('provider'));
  const row = await loadConnection(context, { providerKey: provider, connectionName: 'default' });
  return json(req, { ok: true, connection: row ? safeConnection(row) : null });
}

async function handleVerify(req: Request, context: IntegrationRequestContext, body: Record<string, unknown>) {
  requirePermission(context, 'integrations.manage');
  const provider = providerKey(body.provider_key);
  const row = await getConnectionOrThrow(context, provider);
  const tokens = await tokensFor(context, row);
  const adapter = microsoftAdapter();

  try {
    const identity = await adapter.verify({ accessToken: tokens.accessToken, scopes: tokens.scopes });
    const updated = await updateConnection(context, row.id, {
      state: 'verified',
      authorized: true,
      provider_verified: true,
      provider_account_id: identity.externalSubjectId,
      provider_account_label: identity.maskedIdentity,
      granted_scopes: identity.scopes,
      last_verified_at: identity.verifiedAt,
      last_error_code: null,
      last_error_at: null,
      updated_by: context.userId,
      updated_at: new Date().toISOString()
    });
    await writeIntegrationEvent(context, {
      provider,
      connectionId: row.id,
      action: 'verification_succeeded',
      statusBefore: row.state,
      statusAfter: 'verified',
      requestedScopes: identity.scopes,
      module: 'settings',
      outcome: 'succeeded'
    });
    return json(req, { ok: true, connection: safeConnection(updated || { ...row, state: 'verified', provider_account_label: identity.maskedIdentity, granted_scopes: identity.scopes, last_verified_at: identity.verifiedAt }) });
  } catch (error) {
    const mapped = adapter.mapError(error);
    const nextState = mapped.code === 'microsoft_reconnect_required' ? 'reconnect_required' : 'degraded';
    await updateConnection(context, row.id, {
      state: nextState,
      provider_verified: false,
      last_error_code: mapped.code,
      last_error_at: new Date().toISOString(),
      updated_by: context.userId,
      updated_at: new Date().toISOString()
    }).catch(() => undefined);
    await writeIntegrationEvent(context, {
      provider,
      connectionId: row.id,
      action: 'verification_failed',
      statusBefore: row.state,
      statusAfter: nextState,
      module: 'settings',
      outcome: 'failed',
      providerErrorCode: mapped.code
    }).catch(() => undefined);
    throw integrationError(mapped.code, mapped.status);
  }
}

function domainActor(context: IntegrationRequestContext): IntegrationActorContext {
  return {
    tenantId: context.tenantId,
    organizationId: context.organizationId,
    userId: context.userId,
    role: context.role,
    permissions: context.permissions.filter((permission) => [
      'integrations.view',
      'integrations.use',
      'integrations.manage',
      'infrastructure.integrations.manage'
    ].includes(permission)) as IntegrationPermission[]
  };
}

function domainConnection(context: IntegrationRequestContext, row: IntegrationConnectionRow): IntegrationConnection {
  return {
    id: row.id,
    tenantId: context.tenantId,
    organizationId: row.org_id,
    userId: row.connected_by,
    providerKey: row.provider,
    connectorClass: row.connector_class as 'user_oauth' | 'infrastructure',
    environment: row.environment as any,
    status: row.state as any,
    grantedScopes: Array.isArray(row.granted_scopes) ? row.granted_scopes : [],
    maskedIdentity: row.provider_account_label,
    lastVerifiedAt: row.last_verified_at
  };
}

function domainGrant(row: IntegrationGrantRow | null): IntegrationGrant | null {
  return row ? {
    connectionId: row.connection_id,
    principalType: row.principal_type,
    principalId: row.principal_id,
    module: row.module,
    capability: row.capability as IntegrationCapability
  } : null;
}

function assertProviderScope(row: IntegrationConnectionRow, capability: IntegrationCapability) {
  const required = requiredProviderScopes(row.provider, capability);
  const scopes = new Set(Array.isArray(row.granted_scopes) ? row.granted_scopes : []);
  if (required.some((scope) => !scopes.has(scope))) {
    throw integrationError('integration_provider_scope_missing', 409, { capability });
  }
}

async function handleGrants(req: Request, url: URL, context: IntegrationRequestContext) {
  requirePermission(context, 'integrations.view');
  const provider = providerKey(url.searchParams.get('provider'));
  const row = await getConnectionOrThrow(context, provider);
  const grants = await listGrants(context, row.id);
  return json(req, { ok: true, grants: grants.map(safeGrant) });
}

async function handleAudit(req: Request, url: URL, context: IntegrationRequestContext) {
  requirePermission(context, 'integrations.view');
  const provider = providerKey(url.searchParams.get('provider'));
  const row = await getConnectionOrThrow(context, provider);
  const events = await listIntegrationEvents(context, row.id);
  return json(req, { ok: true, events: events.map(safeEvent) });
}

async function handleGrant(req: Request, context: IntegrationRequestContext, body: Record<string, unknown>) {
  requirePermission(context, 'integrations.manage');
  const provider = providerKey(body.provider_key);
  const row = await getConnectionOrThrow(context, provider);
  if (row.state !== 'verified') throw integrationError('integration_connection_not_verified', 409);
  const capability = String(body.capability || '').trim() as IntegrationCapability;
  const module = safeIdentifier(body.module, 'settings');
  if (!capability) throw integrationError('capability_required', 422);
  assertProviderScope(row, capability);

  const requestedType = String(body.principal_type || 'user').trim();
  if (!['user', 'role', 'module'].includes(requestedType)) throw integrationError('invalid_grant_principal', 422);
  const principalType = requestedType as 'user' | 'role' | 'module';
  const principalId = safeIdentifier(
    body.principal_id,
    principalType === 'user' ? context.userId : principalType === 'role' ? context.role : module
  );
  if (!principalId || !module) throw integrationError('invalid_grant_principal', 422);

  const grant = await createIntegrationGrant(context, {
    connectionId: row.id,
    principalType,
    principalId,
    module,
    capability
  });
  await writeIntegrationEvent(context, {
    provider,
    connectionId: row.id,
    action: 'grant_created',
    module,
    outcome: 'succeeded',
    metadata: { capability, principal_type: principalType }
  });
  return json(req, { ok: true, grant: safeGrant(grant) }, 201);
}

async function handleRevokeGrant(req: Request, context: IntegrationRequestContext, body: Record<string, unknown>) {
  requirePermission(context, 'integrations.manage');
  const provider = providerKey(body.provider_key);
  const row = await getConnectionOrThrow(context, provider);
  const grantId = safeIdentifier(body.grant_id);
  if (!grantId) throw integrationError('grant_id_required', 422);
  const revoked = await revokeIntegrationGrant(context, { grantId, connectionId: row.id });
  if (!revoked) throw integrationError('integration_grant_not_found', 404);
  await writeIntegrationEvent(context, {
    provider,
    connectionId: row.id,
    action: 'grant_revoked',
    module: revoked.module,
    outcome: 'succeeded',
    metadata: { capability: revoked.capability, principal_type: revoked.principal_type }
  });
  return json(req, { ok: true, grant: safeGrant(revoked) });
}

async function markReconnectRequired(
  context: IntegrationRequestContext,
  row: IntegrationConnectionRow,
  code: string,
  module: string
) {
  await updateConnection(context, row.id, {
    state: 'reconnect_required',
    provider_verified: false,
    last_error_code: code,
    last_error_at: new Date().toISOString(),
    updated_by: context.userId,
    updated_at: new Date().toISOString()
  }).catch(() => undefined);
  await writeIntegrationEvent(context, {
    provider: row.provider,
    connectionId: row.id,
    action: 'refresh_failed',
    statusBefore: row.state,
    statusAfter: 'reconnect_required',
    module,
    outcome: 'failed',
    providerErrorCode: code
  }).catch(() => undefined);
}

async function refreshMicrosoftCredential(
  context: IntegrationRequestContext,
  row: IntegrationConnectionRow,
  tokens: StoredMicrosoftTokens,
  capability: IntegrationCapability,
  module: string
): Promise<{ row: IntegrationConnectionRow; tokens: StoredMicrosoftTokens }> {
  if (!tokens.refreshToken) {
    await markReconnectRequired(context, row, 'reconnect_required', module);
    throw integrationError('reconnect_required', 409);
  }

  const adapter = microsoftAdapter();
  try {
    const fresh = await adapter.refresh({ refreshToken: tokens.refreshToken, capabilities: [capability] });
    const merged: StoredMicrosoftTokens = {
      accessToken: fresh.accessToken,
      refreshToken: fresh.refreshToken || tokens.refreshToken,
      tokenType: fresh.tokenType || 'Bearer',
      scopes: fresh.scopes,
      expiresAt: fresh.expiresAt
    };
    const identity = await adapter.verify({ accessToken: merged.accessToken, scopes: merged.scopes });
    const stored = await storeCredentialSecret({
      organizationId: context.organizationId,
      provider: 'microsoft',
      credentialKind: 'oauth_tokens',
      secretValue: JSON.stringify(merged),
      expiresAt: merged.expiresAt ? new Date(merged.expiresAt).toISOString() : null
    });
    const updated = await updateConnection(context, row.id, {
      state: 'verified',
      authorized: true,
      provider_verified: true,
      credential_ref: stored.credentialRef,
      secret_ref: stored.credentialRef,
      provider_account_id: identity.externalSubjectId,
      provider_account_label: identity.maskedIdentity,
      granted_scopes: identity.scopes,
      last_verified_at: identity.verifiedAt,
      last_error_code: null,
      last_error_at: null,
      updated_by: context.userId,
      updated_at: new Date().toISOString()
    });
    if (!updated) {
      await deleteCredentialRecord(context.organizationId, { id: stored.credentialRef, provider: 'microsoft' }).catch(() => undefined);
      throw integrationError('connection_update_failed', 500);
    }
    if (row.credential_ref && row.credential_ref !== stored.credentialRef) {
      await deleteCredentialRecord(context.organizationId, { id: row.credential_ref, provider: 'microsoft' }).catch(() => undefined);
    }
    await writeIntegrationEvent(context, {
      provider: row.provider,
      connectionId: row.id,
      action: 'refresh_succeeded',
      statusBefore: row.state,
      statusAfter: 'verified',
      requestedScopes: identity.scopes,
      module,
      outcome: 'succeeded',
      metadata: { capability }
    });
    return { row: updated, tokens: merged };
  } catch (error) {
    if (error instanceof IntegrationEdgeError) throw error;
    const mapped = adapter.mapError(error);
    if (mapped.status === 401 || mapped.code === 'microsoft_reconnect_required') {
      await markReconnectRequired(context, row, 'reconnect_required', module);
      throw integrationError('reconnect_required', 409);
    }
    throw integrationError(mapped.code, mapped.status);
  }
}

async function handleExecute(req: Request, context: IntegrationRequestContext, body: Record<string, unknown>) {
  requirePermission(context, 'integrations.use');
  const provider = providerKey(body.provider_key);
  const capability = String(body.capability || '').trim() as IntegrationCapability;
  const module = safeIdentifier(body.module, 'settings');
  if (!capability) throw integrationError('capability_required', 422);
  let row = await getConnectionOrThrow(context, provider);
  const grantRow = await loadGrant(context, { connectionId: row.id, module, capability });
  const grant = domainGrant(grantRow);

  evaluateCapabilityRequest({
    actor: domainActor(context),
    connection: domainConnection(context, row),
    grant,
    request: { module, capability }
  });

  let tokens = await tokensFor(context, row);
  let refreshed = false;
  if (tokens.expiresAt && tokens.expiresAt <= Date.now() + 30_000) {
    const result = await refreshMicrosoftCredential(context, row, tokens, capability, module);
    row = result.row;
    tokens = result.tokens;
    refreshed = true;
    evaluateCapabilityRequest({
      actor: domainActor(context),
      connection: domainConnection(context, row),
      grant,
      request: { module, capability }
    });
  }

  const adapter = microsoftAdapter();
  let data: unknown;
  try {
    data = await adapter.executeCapability({ capability, accessToken: tokens.accessToken, scopes: tokens.scopes });
  } catch (error) {
    const mapped = adapter.mapError(error);
    if (!refreshed && (mapped.status === 401 || mapped.code === 'microsoft_reconnect_required')) {
      const result = await refreshMicrosoftCredential(context, row, tokens, capability, module);
      row = result.row;
      tokens = result.tokens;
      evaluateCapabilityRequest({
        actor: domainActor(context),
        connection: domainConnection(context, row),
        grant,
        request: { module, capability }
      });
      try {
        data = await adapter.executeCapability({ capability, accessToken: tokens.accessToken, scopes: tokens.scopes });
      } catch (retryError) {
        const retryMapped = adapter.mapError(retryError);
        if (retryMapped.status === 401 || retryMapped.code === 'microsoft_reconnect_required') {
          await markReconnectRequired(context, row, 'reconnect_required', module);
          throw integrationError('reconnect_required', 409);
        }
        throw integrationError(retryMapped.code, retryMapped.status);
      }
    } else {
      throw integrationError(mapped.code, mapped.status);
    }
  }

  await writeIntegrationEvent(context, {
    provider,
    connectionId: row.id,
    action: 'capability_executed',
    module,
    outcome: 'succeeded',
    metadata: { capability }
  });
  return json(req, { ok: true, capability, data });
}

async function handleRevoke(req: Request, context: IntegrationRequestContext, body: Record<string, unknown>) {
  requirePermission(context, 'integrations.manage');
  const provider = providerKey(body.provider_key);
  const row = await getConnectionOrThrow(context, provider);
  const adapter = microsoftAdapter();
  const metadata = adapter.revokeLocalAuthorization();

  if (row.credential_ref) {
    await deleteCredentialRecord(context.organizationId, { id: row.credential_ref, provider });
  }
  const revokedAt = new Date().toISOString();
  const updated = await updateConnection(context, row.id, {
    state: 'revoked',
    authorized: false,
    provider_verified: false,
    credential_ref: null,
    secret_ref: null,
    revoked_at: revokedAt,
    last_verified_at: null,
    updated_by: context.userId,
    updated_at: revokedAt
  });
  await writeIntegrationEvent(context, {
    provider,
    connectionId: row.id,
    action: 'revoke_completed',
    statusBefore: row.state,
    statusAfter: 'revoked',
    module: 'settings',
    outcome: 'succeeded'
  });
  return json(req, {
    ok: true,
    connection: safeConnection(updated || { ...row, state: 'revoked', credential_ref: null, revoked_at: revokedAt }),
    provider_management_url: metadata.providerManagementUrl
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  const url = new URL(req.url);
  const action = String(url.searchParams.get('action') || '').trim();
  if (!ALLOWED_ACTIONS.has(action)) return json(req, { ok: false, error: 'unsupported_action' }, 404);

  try {
    const context = await resolveIntegrationContext(req);
    if (action === 'connections') {
      if (req.method !== 'GET') throw integrationError('method_not_allowed', 405);
      return await handleConnections(req, context);
    }
    if (action === 'connection') {
      if (req.method !== 'GET') throw integrationError('method_not_allowed', 405);
      return await handleConnection(req, url, context);
    }
    if (action === 'grants') {
      if (req.method !== 'GET') throw integrationError('method_not_allowed', 405);
      return await handleGrants(req, url, context);
    }
    if (action === 'audit') {
      if (req.method !== 'GET') throw integrationError('method_not_allowed', 405);
      return await handleAudit(req, url, context);
    }
    if (req.method !== 'POST') throw integrationError('method_not_allowed', 405);
    const body = await bodyOf(req);
    if (action === 'verify') return await handleVerify(req, context, body);
    if (action === 'execute') return await handleExecute(req, context, body);
    if (action === 'grant') return await handleGrant(req, context, body);
    if (action === 'revoke-grant') return await handleRevokeGrant(req, context, body);
    if (action === 'revoke') return await handleRevoke(req, context, body);
    throw integrationError('unsupported_action', 404);
  } catch (error) {
    return safeError(req, error);
  }
});
