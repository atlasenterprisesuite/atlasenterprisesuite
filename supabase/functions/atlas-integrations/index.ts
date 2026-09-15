import { evaluateCapabilityRequest } from '../../../packages/integrations/gateway.ts';
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
  updateConnection,
  deleteCredentialRecord,
  type IntegrationConnectionRow
} from '../_shared/integrations/repository.ts';
import { readCredentialSecret } from '../_shared/integrations/vault.ts';
import { writeIntegrationEvent } from '../_shared/integrations/audit.ts';
import { createMicrosoftAdapter } from '../_shared/integrations/providers/microsoft.ts';

const ALLOWED_ACTIONS = new Set(['connections', 'connection', 'verify', 'execute', 'revoke']);

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
    : code.includes('not_verified') || code.includes('grant') || code.includes('scope') ? 409
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

async function handleExecute(req: Request, context: IntegrationRequestContext, body: Record<string, unknown>) {
  requirePermission(context, 'integrations.use');
  const provider = providerKey(body.provider_key);
  const capability = String(body.capability || '').trim() as IntegrationCapability;
  const module = String(body.module || 'settings').trim() || 'settings';
  if (!capability) throw integrationError('capability_required', 422);
  const row = await getConnectionOrThrow(context, provider);
  const grantRow = await loadGrant(context, { connectionId: row.id, module, capability });
  const grant: IntegrationGrant | null = grantRow ? {
    connectionId: grantRow.connection_id,
    principalType: grantRow.principal_type,
    principalId: grantRow.principal_id,
    module: grantRow.module,
    capability: grantRow.capability as IntegrationCapability
  } : null;

  evaluateCapabilityRequest({
    actor: domainActor(context),
    connection: domainConnection(context, row),
    grant,
    request: { module, capability }
  });

  const tokens = await tokensFor(context, row);
  const adapter = microsoftAdapter();
  const data = await adapter.executeCapability({ capability, accessToken: tokens.accessToken, scopes: tokens.scopes });
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
  const updated = await updateConnection(context, row.id, {
    state: 'revoked',
    authorized: false,
    provider_verified: false,
    credential_ref: null,
    secret_ref: null,
    revoked_at: new Date().toISOString(),
    last_verified_at: null,
    updated_by: context.userId,
    updated_at: new Date().toISOString()
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
    connection: safeConnection(updated || { ...row, state: 'revoked', credential_ref: null, revoked_at: new Date().toISOString() }),
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
    if (req.method !== 'POST') throw integrationError('method_not_allowed', 405);
    const body = await bodyOf(req);
    if (action === 'verify') return await handleVerify(req, context, body);
    if (action === 'execute') return await handleExecute(req, context, body);
    if (action === 'revoke') return await handleRevoke(req, context, body);
    throw integrationError('unsupported_action', 404);
  } catch (error) {
    return safeError(req, error);
  }
});
