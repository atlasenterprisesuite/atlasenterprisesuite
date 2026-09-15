import type { IntegrationCapability } from '../../../packages/integrations/types.ts';
import { resolveIntegrationContext, integrationError, IntegrationEdgeError, type IntegrationRequestContext } from '../_shared/integrations/context.ts';
import {
  createOAuthState,
  findOAuthStateByHash,
  consumeOAuthState,
  upsertMicrosoftConnection,
  updateConnection,
  deleteCredentialRecord
} from '../_shared/integrations/repository.ts';
import { writeIntegrationEvent } from '../_shared/integrations/audit.ts';
import { storeCredentialSecret, readCredentialSecret } from '../_shared/integrations/vault.ts';
import { createMicrosoftAdapter } from '../_shared/integrations/providers/microsoft.ts';

const ALLOWED_ACTIONS = new Set(['start', 'callback']);
const DEFAULT_RETURN_TO = '/settings/security/connected-apps/microsoft';
const OAUTH_TTL_MS = 10 * 60 * 1000;
const ALLOWED_CAPABILITIES = new Set<IntegrationCapability>([
  'microsoft.profile.read',
  'microsoft.mail.read',
  'microsoft.calendar.read',
  'microsoft.files.read'
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
  return json(req, { ok: false, error: 'integration_oauth_failed' }, 500);
}

async function bodyOf(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? body as Record<string, unknown> : {};
  } catch {
    throw integrationError('invalid_json', 400);
  }
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function randomOAuthSecret() {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function sha256Base64Url(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

function requirePermission(context: IntegrationRequestContext, permission: string) {
  if (!context.permissions.includes(permission) && !context.permissions.includes('integrations.admin') && !context.permissions.includes('*')) {
    throw integrationError('permission_denied', 403, { permission });
  }
}

function normalizeCapabilities(value: unknown): IntegrationCapability[] {
  if (!Array.isArray(value) || value.length === 0) return ['microsoft.profile.read'];
  const result = [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
  if (result.some((item) => !ALLOWED_CAPABILITIES.has(item as IntegrationCapability))) {
    throw integrationError('unsupported_integration_capability', 422);
  }
  return result as IntegrationCapability[];
}

function safeReturnTo(value: unknown) {
  const route = String(value || DEFAULT_RETURN_TO).trim();
  if (!route.startsWith('/') || route.startsWith('//') || route.includes('://') || route.length > 500) {
    throw integrationError('invalid_return_to', 422);
  }
  return route;
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

async function start(req: Request) {
  if (req.method !== 'POST') throw integrationError('method_not_allowed', 405);
  const context = await resolveIntegrationContext(req);
  requirePermission(context, 'integrations.manage');
  const body = await bodyOf(req);
  if (String(body.provider_key || '') !== 'microsoft') throw integrationError('provider_not_supported', 422);
  const capabilities = normalizeCapabilities(body.capabilities);
  const returnTo = safeReturnTo(body.return_to);
  const adapter = microsoftAdapter();

  const state = randomOAuthSecret();
  const codeVerifier = randomOAuthSecret();
  const [nonceHash, codeChallenge] = await Promise.all([
    sha256Base64Url(state),
    sha256Base64Url(codeVerifier)
  ]);

  const verifier = await storeCredentialSecret({
    organizationId: context.organizationId,
    provider: 'microsoft',
    credentialKind: 'oauth_pkce_verifier',
    secretValue: codeVerifier,
    expiresAt: new Date(Date.now() + OAUTH_TTL_MS).toISOString()
  });

  try {
    await createOAuthState({
      organizationId: context.organizationId,
      userId: context.userId,
      provider: 'microsoft',
      nonceHash,
      requestedPermissions: capabilities,
      expiresAt: new Date(Date.now() + OAUTH_TTL_MS).toISOString(),
      codeVerifierCredentialRef: verifier.credentialRef,
      returnTo
    });
  } catch (error) {
    await deleteCredentialRecord(context.organizationId, { id: verifier.credentialRef, provider: 'microsoft' }).catch(() => undefined);
    throw error;
  }

  await writeIntegrationEvent(context, {
    provider: 'microsoft',
    action: 'authorization_started',
    requestedScopes: capabilities,
    module: 'settings',
    outcome: 'started'
  });

  const authorizationUrl = adapter.authorizationUrl({ state, codeChallenge, capabilities });
  return json(req, { ok: true, authorization_url: authorizationUrl, expires_in: 600 });
}

function callbackContext(row: { org_id: string; user_id: string }): IntegrationRequestContext {
  const requestId = crypto.randomUUID();
  return {
    tenantId: row.org_id,
    organizationId: row.org_id,
    userId: row.user_id,
    role: 'oauth_callback',
    permissions: [],
    requestId,
    sessionId: requestId
  };
}

function redirectTo(route: string, status: 'success' | 'cancelled' | 'error', code?: string) {
  const target = new URL(route, 'https://www.atlasenterprisesuite.com');
  target.searchParams.set('oauth', status);
  if (code) target.searchParams.set('error_code', code.replace(/[^a-z0-9_-]/gi, '').slice(0, 80));
  return Response.redirect(target.toString(), 302);
}

async function cleanupVerifier(row: { org_id: string; code_verifier_credential_ref: string | null }) {
  if (!row.code_verifier_credential_ref) return;
  await deleteCredentialRecord(row.org_id, { id: row.code_verifier_credential_ref, provider: 'microsoft' }).catch(() => undefined);
}

async function callback(req: Request, url: URL) {
  if (req.method !== 'GET') throw integrationError('method_not_allowed', 405);
  const rawState = String(url.searchParams.get('state') || '').trim();
  if (!rawState) return redirectTo(DEFAULT_RETURN_TO, 'error', 'oauth_state_required');

  const nonceHash = await sha256Base64Url(rawState);
  const row = await findOAuthStateByHash('microsoft', nonceHash);
  if (!row || row.provider !== 'microsoft' || row.consumed_at) return redirectTo(DEFAULT_RETURN_TO, 'error', 'oauth_state_invalid');
  const returnTo = safeReturnTo(row.return_to || DEFAULT_RETURN_TO);
  if (!row.org_id || !row.user_id) return redirectTo(returnTo, 'error', 'oauth_state_binding_invalid');
  if (!row.expires_at || new Date(row.expires_at).getTime() <= Date.now()) {
    await consumeOAuthState(row.id).catch(() => undefined);
    await cleanupVerifier(row);
    return redirectTo(returnTo, 'error', 'oauth_state_expired');
  }

  const providerError = String(url.searchParams.get('error') || '').trim();
  if (providerError) {
    await consumeOAuthState(row.id).catch(() => undefined);
    await cleanupVerifier(row);
    return redirectTo(returnTo, providerError === 'access_denied' ? 'cancelled' : 'error', providerError === 'access_denied' ? undefined : 'provider_authorization_failed');
  }

  const code = String(url.searchParams.get('code') || '').trim();
  if (!code) return redirectTo(returnTo, 'error', 'authorization_code_required');
  if (!row.code_verifier_credential_ref) return redirectTo(returnTo, 'error', 'pkce_verifier_missing');

  const context = callbackContext(row);
  try {
    const codeVerifier = await readCredentialSecret({
      organizationId: row.org_id,
      provider: 'microsoft',
      credentialKind: 'oauth_pkce_verifier',
      credentialRef: row.code_verifier_credential_ref
    });
    const capabilities = normalizeCapabilities(row.requested_permissions);
    const adapter = microsoftAdapter();
    const tokens = await adapter.exchangeCode({ code, codeVerifier, capabilities });
    const credential = await storeCredentialSecret({
      organizationId: row.org_id,
      provider: 'microsoft',
      credentialKind: 'oauth_tokens',
      secretValue: JSON.stringify(tokens),
      expiresAt: tokens.expiresAt ? new Date(tokens.expiresAt).toISOString() : null
    });

    const connection = await upsertMicrosoftConnection(context, {
      credentialRef: credential.credentialRef,
      state: 'connected_unverified',
      providerVerified: false,
      grantedScopes: tokens.scopes
    });

    await writeIntegrationEvent(context, {
      provider: 'microsoft',
      connectionId: connection.id,
      action: 'connection_established',
      statusAfter: 'connected_unverified',
      requestedScopes: tokens.scopes,
      module: 'settings',
      outcome: 'succeeded'
    });

    const identity = await adapter.verify({ accessToken: tokens.accessToken, scopes: tokens.scopes });
    const verifiedConnection = await updateConnection(context, connection.id, {
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
    if (!verifiedConnection) throw integrationError('connection_update_failed', 500);

    await writeIntegrationEvent(context, {
      provider: 'microsoft',
      connectionId: connection.id,
      action: 'verification_succeeded',
      statusBefore: 'connected_unverified',
      statusAfter: 'verified',
      requestedScopes: identity.scopes,
      module: 'settings',
      outcome: 'succeeded'
    });

    await consumeOAuthState(row.id);
    await cleanupVerifier(row);
    return redirectTo(returnTo, 'success');
  } catch (error) {
    await consumeOAuthState(row.id).catch(() => undefined);
    await cleanupVerifier(row);
    const code = error instanceof IntegrationEdgeError ? error.code : 'oauth_callback_failed';
    await writeIntegrationEvent(context, {
      provider: 'microsoft',
      action: 'verification_failed',
      module: 'settings',
      outcome: 'failed',
      providerErrorCode: code
    }).catch(() => undefined);
    return redirectTo(returnTo, 'error', code);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  const url = new URL(req.url);
  const action = String(url.searchParams.get('action') || (req.method === 'GET' ? 'callback' : '')).trim();
  if (!ALLOWED_ACTIONS.has(action)) return json(req, { ok: false, error: 'unsupported_action' }, 404);
  try {
    if (action === 'start') return await start(req);
    if (action === 'callback') return await callback(req, url);
    throw integrationError('unsupported_action', 404);
  } catch (error) {
    return safeError(req, error);
  }
});
