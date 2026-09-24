import { createGitHubOidcScope } from '../_shared/github-oidc-scope.ts';
import { getServerSecret } from '../_shared/server-secret-store.ts';
import {
  SupabaseHubSpotConnectionStore,
  type HubSpotCredentialRow
} from '../_shared/hubspot-connection-store.ts';
import {
  HUBSPOT_P0_SCOPES,
  refreshHubSpotConnectionCredential,
  type HubSpotLifecycleDependencies
} from '../_shared/hubspot-connection-lifecycle.ts';
import {
  introspectHubSpotToken,
  revokeHubSpotToken
} from '../_shared/hubspot-oauth.ts';
import { HubSpotCrmAdapter } from '../_shared/hubspot-crm.ts';
import {
  destroyCredentialPayload,
  openCredential
} from '../_shared/integration-credential-vault.ts';

const SERVICE = 'atlas-hubspot-live-verifier';
const VERSION = 1;
const AUDIENCE = 'atlas-hubspot-live-verifier';
const EXPECTED_OBJECT_TYPES = ['contact', 'company', 'deal', 'ticket'] as const;
const GITHUB_SCOPE = createGitHubOidcScope(['hubspot-live-production-gate.yml']);
const ALLOWED_WORKFLOWS = GITHUB_SCOPE.workflowRefs;
const JSON_HEADERS = {
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer'
};

type SafeFailureCode =
  | 'configuration_missing'
  | 'github_oidc_required'
  | 'invalid_github_oidc'
  | 'unsupported_github_oidc'
  | 'github_oidc_key_not_found'
  | 'github_oidc_verification_failed'
  | 'github_oidc_scope_denied'
  | 'connection_missing'
  | 'connection_not_connected'
  | 'credential_missing'
  | 'oauth_token_inactive'
  | 'oauth_scope_mismatch'
  | 'provider_account_mismatch'
  | 'provider_read_failed'
  | 'provider_data_truncated'
  | 'orphan_credential_required'
  | 'orphan_token_matches_active'
  | 'orphan_account_mismatch'
  | 'orphan_revoke_failed'
  | 'internal_authorization_failed';

type SafeObjectEvidence = {
  records_observed: number;
  pages: number;
  nextCursor: string | null;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });

function env(name: string): string {
  return Deno.env.get(name)?.trim() ?? '';
}

function base64UrlDecode(input: string): Uint8Array {
  let value = input.replace(/-/g, '+').replace(/_/g, '/');
  while (value.length % 4) value += '=';
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function decodeJwtPart(input: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(base64UrlDecode(input))) as Record<string, unknown>;
}

let jwksCache: { until: number; keys: Array<JsonWebKey & { kid?: string }> } | null = null;

async function githubKeys(): Promise<Array<JsonWebKey & { kid?: string }>> {
  if (jwksCache && jwksCache.until > Date.now()) return jwksCache.keys;
  const configuration = await fetch(
    'https://token.actions.githubusercontent.com/.well-known/openid-configuration',
    { cache: 'no-store' }
  ).then((response) => response.json()) as { jwks_uri?: string };
  if (!configuration.jwks_uri) throw new Error('github_oidc_configuration_unavailable');
  const body = await fetch(configuration.jwks_uri, { cache: 'no-store' }).then(
    (response) => response.json()
  ) as { keys?: Array<JsonWebKey & { kid?: string }> };
  const keys = Array.isArray(body.keys) ? body.keys : [];
  jwksCache = { until: Date.now() + 10 * 60 * 1000, keys };
  return keys;
}

async function verifyGitHubOidc(req: Request): Promise<
  | { ok: true; sha: string }
  | { ok: false; status: number; code: SafeFailureCode }
> {
  const raw = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const parts = raw.split('.');
  if (parts.length !== 3) return { ok: false, status: 401, code: 'github_oidc_required' };

  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = decodeJwtPart(parts[0]);
    payload = decodeJwtPart(parts[1]);
  } catch {
    return { ok: false, status: 401, code: 'invalid_github_oidc' };
  }

  if (header.alg !== 'RS256' || typeof header.kid !== 'string') {
    return { ok: false, status: 401, code: 'unsupported_github_oidc' };
  }

  const jwk = (await githubKeys()).find((candidate) => candidate.kid === header.kid);
  if (!jwk) return { ok: false, status: 401, code: 'github_oidc_key_not_found' };

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const signatureOk = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    base64UrlDecode(parts[2]),
    new TextEncoder().encode(parts[0] + '.' + parts[1])
  );

  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (
    !signatureOk ||
    payload.iss !== 'https://token.actions.githubusercontent.com' ||
    !audiences.includes(AUDIENCE) ||
    Number(payload.exp || 0) <= now ||
    Number(payload.nbf || 0) > now + 30
  ) {
    return { ok: false, status: 401, code: 'github_oidc_verification_failed' };
  }

  const workflowRef = String(payload.workflow_ref || '');
  const jobWorkflowRef = String(payload.job_workflow_ref || '');
  const workflowAllowed =
    ALLOWED_WORKFLOWS.has(workflowRef) ||
    ALLOWED_WORKFLOWS.has(jobWorkflowRef);

  if (
    !GITHUB_SCOPE.allowsRepository(payload.repository, payload.repository_owner) ||
    payload.ref !== 'refs/heads/main' ||
    !workflowAllowed
  ) {
    return { ok: false, status: 403, code: 'github_oidc_scope_denied' };
  }

  const sha = String(payload.sha || '');
  if (!/^[0-9a-f]{40}$/i.test(sha)) {
    return { ok: false, status: 401, code: 'invalid_github_oidc' };
  }
  return { ok: true, sha };
}

async function secret(name: string): Promise<string> {
  const supabaseUrl = env('SUPABASE_URL');
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) throw new Error('configuration_missing');
  return (await getServerSecret({
    supabaseUrl,
    serviceRoleKey,
    name
  }))?.trim() ?? '';
}

async function configuration() {
  const [clientId, clientSecret, credentialKey] = await Promise.all([
    secret('hubspot_oauth_client_id'),
    secret('hubspot_oauth_client_secret'),
    secret('atlas_integration_credential_key')
  ]);
  const supabaseUrl = env('SUPABASE_URL');
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!clientId || !clientSecret || !credentialKey || !supabaseUrl || !serviceRoleKey) {
    throw new Error('configuration_missing');
  }
  return { clientId, clientSecret, credentialKey, supabaseUrl, serviceRoleKey };
}

function scopeMismatch(granted: readonly string[]): boolean {
  const actual = new Set(granted.map((scope) => scope.trim()).filter(Boolean));
  return HUBSPOT_P0_SCOPES.some((scope) => !actual.has(scope));
}

function lifecycleDeps(
  store: SupabaseHubSpotConnectionStore,
  config: Awaited<ReturnType<typeof configuration>>
): HubSpotLifecycleDependencies {
  return {
    store,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.supabaseUrl.replace(/\/$/, '') + '/functions/v1/atlas-crm-hubspot',
    credentialKey: config.credentialKey
  };
}

async function readAllObjects(
  adapter: HubSpotCrmAdapter,
  token: string
): Promise<Record<string, SafeObjectEvidence>> {
  const evidence: Record<string, SafeObjectEvidence> = {};
  for (const objectType of EXPECTED_OBJECT_TYPES) {
    let nextCursor: string | null = null;
    let recordsObserved = 0;
    let pages = 0;
    do {
      const page = await adapter.listObjects(
        { accessToken: token },
        { objectType, limit: 100, cursor: nextCursor }
      );
      recordsObserved += page.records.length;
      pages += 1;
      nextCursor = page.nextCursor;
    } while (nextCursor && pages < 20);
    evidence[objectType] = {
      records_observed: recordsObserved,
      pages,
      nextCursor
    };
  }
  return evidence;
}

async function verifyLive(expectedAccountId: string | null) {
  const config = await configuration();
  const store = new SupabaseHubSpotConnectionStore({
    supabaseUrl: config.supabaseUrl,
    serviceRoleKey: config.serviceRoleKey
  });
  const connections = await store.listMonitorConnections();
  if (connections.length !== 1) {
    return { ok: false as const, status: 409, code: 'connection_missing' as SafeFailureCode };
  }
  const connection = connections[0];
  if (connection.state !== 'connected') {
    return { ok: false as const, status: 409, code: 'connection_not_connected' as SafeFailureCode };
  }
  if (!connection.credential_ref) {
    return { ok: false as const, status: 409, code: 'credential_missing' as SafeFailureCode };
  }
  if (expectedAccountId && connection.provider_account_id !== expectedAccountId) {
    return { ok: false as const, status: 409, code: 'provider_account_mismatch' as SafeFailureCode };
  }

  let credential: Awaited<ReturnType<typeof refreshHubSpotConnectionCredential>> | null = null;
  try {
    credential = await refreshHubSpotConnectionCredential({
      organizationId: connection.org_id,
      actorUserId: connection.connected_by ?? '',
      deps: lifecycleDeps(store, config),
      forceRefresh: true
    });

    const introspection = await introspectHubSpotToken({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      token: credential.accessToken,
      tokenTypeHint: 'access_token'
    });
    if (!introspection.active) {
      return { ok: false as const, status: 401, code: 'oauth_token_inactive' as SafeFailureCode };
    }
    if (!introspection.hubId || introspection.hubId !== connection.provider_account_id) {
      return { ok: false as const, status: 409, code: 'provider_account_mismatch' as SafeFailureCode };
    }
    const grantedScopes = introspection.scopes.length
      ? introspection.scopes
      : connection.granted_scopes;
    if (scopeMismatch(grantedScopes)) {
      return { ok: false as const, status: 403, code: 'oauth_scope_mismatch' as SafeFailureCode };
    }

    const adapter = new HubSpotCrmAdapter();
    const readiness = await adapter.readiness({ accessToken: credential.accessToken });
    if (!readiness.ready || !readiness.account || readiness.account.id !== introspection.hubId) {
      return { ok: false as const, status: 502, code: 'provider_account_mismatch' as SafeFailureCode };
    }

    let objects: Record<string, SafeObjectEvidence>;
    try {
      objects = await readAllObjects(adapter, credential.accessToken);
    } catch {
      return { ok: false as const, status: 502, code: 'provider_read_failed' as SafeFailureCode };
    }
    if (Object.values(objects).some((entry) => entry.nextCursor !== null)) {
      return { ok: false as const, status: 502, code: 'provider_data_truncated' as SafeFailureCode };
    }

    const recordsObserved = Object.values(objects)
      .reduce((sum, entry) => sum + entry.records_observed, 0);
    const completedAt = new Date().toISOString();
    await store.recordEvidence({
      org_id: connection.org_id,
      provider: 'hubspot',
      operation: 'production.live.verify',
      status: 'completed',
      started_by: connection.connected_by,
      completed_at: completedAt,
      records_observed: recordsObserved,
      evidence_ref: 'github-oidc'
    });

    return {
      ok: true as const,
      status: 200,
      report: {
        provider: 'hubspot',
        state: connection.state,
        provider_account_id: connection.provider_account_id,
        provider_account_label: readiness.account.label,
        oauth_active: true,
        introspection_verified: true,
        required_scopes_verified: true,
        granted_scopes: [...HUBSPOT_P0_SCOPES],
        objects,
        records_observed: recordsObserved,
        tenant_isolation_gate: 'operator-verified-rls',
        credential_storage: 'server-only-encrypted',
        secrets_returned: false
      }
    };
  } finally {
    if (credential) destroyCredentialPayload(credential);
  }
}

async function serviceRows<T>(
  config: Awaited<ReturnType<typeof configuration>>,
  path: string,
  init: RequestInit = {}
): Promise<T[]> {
  const response = await fetch(
    config.supabaseUrl.replace(/\/$/, '') + '/rest/v1/' + path,
    {
      ...init,
      headers: {
        Authorization: 'Bearer ' + config.serviceRoleKey,
        apikey: config.serviceRoleKey,
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(init.headers ?? {})
      }
    }
  );
  if (!response.ok) throw new Error('storage_request_failed_' + response.status);
  if (response.status === 204) return [];
  const value = await response.json() as unknown;
  return Array.isArray(value) ? value as T[] : [];
}

async function validateInternalMonitorToken(
  req: Request,
  serviceRoleKey: string,
  supabaseUrl: string
): Promise<boolean> {
  const token = req.headers.get('x-atlas-hubspot-monitor-token')?.trim() ?? '';
  if (!token) return false;
  const response = await fetch(
    supabaseUrl.replace(/\/$/, '') + '/rest/v1/rpc/validate_atlas_hubspot_monitor_trigger',
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + serviceRoleKey,
        apikey: serviceRoleKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_token: token })
    }
  );
  return response.ok && (await response.json()) === true;
}

async function revokeOrphan(req: Request) {
  const config = await configuration();
  if (!(await validateInternalMonitorToken(req, config.serviceRoleKey, config.supabaseUrl))) {
    return { ok: false as const, status: 403, code: 'internal_authorization_failed' as SafeFailureCode };
  }

  const store = new SupabaseHubSpotConnectionStore({
    supabaseUrl: config.supabaseUrl,
    serviceRoleKey: config.serviceRoleKey
  });
  const credentials = await serviceRows<HubSpotCredentialRow>(
    config,
    'atlas_integration_credentials?provider=eq.hubspot&select=id,org_id,provider,ciphertext,iv,algorithm,key_version,expires_at&order=created_at.asc'
  );

  let orphan: HubSpotCredentialRow | null = null;
  for (const candidate of credentials) {
    const references = await serviceRows<{ id: string }>(
      config,
      'atlas_integration_connections?credential_ref=eq.' +
        encodeURIComponent(candidate.id) +
        '&select=id&limit=1'
    );
    if (references.length === 0) {
      orphan = candidate;
      break;
    }
  }
  if (!orphan) {
    return { ok: false as const, status: 409, code: 'orphan_credential_required' as SafeFailureCode };
  }

  let orphanCredential: Awaited<ReturnType<typeof openCredential>> | null = null;
  let activeCredential: Awaited<ReturnType<typeof openCredential>> | null = null;
  try {
    orphanCredential = await openCredential({
      organizationId: orphan.org_id,
      provider: 'hubspot',
      sealed: {
        ciphertext: orphan.ciphertext,
        iv: orphan.iv,
        algorithm: orphan.algorithm,
        keyVersion: orphan.key_version
      },
      key: config.credentialKey
    });
    const orphanRefresh = orphanCredential.refreshToken?.trim() ?? '';
    if (!orphanRefresh) {
      return { ok: false as const, status: 409, code: 'orphan_credential_required' as SafeFailureCode };
    }

    const activeConnections = await serviceRows<{
      credential_ref: string | null;
      provider_account_id: string | null;
    }>(
      config,
      'atlas_integration_connections?provider=eq.hubspot&state=in.(connected,degraded)&credential_ref=not.is.null&select=credential_ref,provider_account_id'
    );

    for (const active of activeConnections) {
      if (!active.credential_ref) continue;
      const activeRows = await serviceRows<HubSpotCredentialRow>(
        config,
        'atlas_integration_credentials?id=eq.' +
          encodeURIComponent(active.credential_ref) +
          '&provider=eq.hubspot&select=id,org_id,provider,ciphertext,iv,algorithm,key_version,expires_at&limit=1'
      );
      const activeRow = activeRows[0];
      if (!activeRow) continue;
      activeCredential = await openCredential({
        organizationId: activeRow.org_id,
        provider: 'hubspot',
        sealed: {
          ciphertext: activeRow.ciphertext,
          iv: activeRow.iv,
          algorithm: activeRow.algorithm,
          keyVersion: activeRow.key_version
        },
        key: config.credentialKey
      });
      if (activeCredential.refreshToken?.trim() === orphanRefresh) {
        return { ok: false as const, status: 409, code: 'orphan_token_matches_active' as SafeFailureCode };
      }
      destroyCredentialPayload(activeCredential);
      activeCredential = null;
    }

    const before = await introspectHubSpotToken({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      token: orphanRefresh,
      tokenTypeHint: 'refresh_token'
    });
    const expectedAccount = activeConnections[0]?.provider_account_id ?? null;
    if (before.active && expectedAccount && before.hubId && before.hubId !== expectedAccount) {
      return { ok: false as const, status: 409, code: 'orphan_account_mismatch' as SafeFailureCode };
    }

    let remoteRevokeAttempted = false;
    if (before.active) {
      remoteRevokeAttempted = true;
      try {
        await revokeHubSpotToken({
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          token: orphanRefresh,
          tokenTypeHint: 'refresh_token'
        });
      } catch {
        return { ok: false as const, status: 502, code: 'orphan_revoke_failed' as SafeFailureCode };
      }
      const after = await introspectHubSpotToken({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        token: orphanRefresh,
        tokenTypeHint: 'refresh_token'
      });
      if (after.active) {
        return { ok: false as const, status: 502, code: 'orphan_revoke_failed' as SafeFailureCode };
      }
    }

    await store.deleteCredential(orphan.id, orphan.org_id);
    return {
      ok: true as const,
      status: 200,
      report: {
        orphan_credential_destroyed: true,
        provider_token_inactive: true,
        remote_revoke_attempted: remoteRevokeAttempted,
        active_connection_credential_preserved: true,
        secrets_returned: false
      }
    };
  } finally {
    if (activeCredential) destroyCredentialPayload(activeCredential);
    if (orphanCredential) destroyCredentialPayload(orphanCredential);
  }
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const api = url.searchParams.get('api');

  if (req.method === 'GET' && api === 'readiness') {
    return json({
      ok: true,
      service: SERVICE,
      version: VERSION,
      auth: 'github-oidc-or-internal-monitor',
      secrets_returned: false
    });
  }

  if (req.method !== 'POST') return json({ ok: false, code: 'not_found' }, 404);

  try {
    if (api === 'revoke-orphan') {
      const result = await revokeOrphan(req);
      return json(
        result.ok
          ? { ok: true, verifier_version: VERSION, ...result.report }
          : { ok: false, verifier_version: VERSION, code: result.code, secrets_returned: false },
        result.status
      );
    }

    if (api !== 'verify') return json({ ok: false, code: 'not_found' }, 404);
    const caller = await verifyGitHubOidc(req);
    if (!caller.ok) {
      return json(
        { ok: false, verifier_version: VERSION, code: caller.code, secrets_returned: false },
        caller.status
      );
    }

    let expectedAccountId: string | null = null;
    try {
      const body = await req.json() as { expectedAccountId?: unknown };
      expectedAccountId =
        typeof body.expectedAccountId === 'string' && body.expectedAccountId.trim()
          ? body.expectedAccountId.trim()
          : null;
    } catch {
      expectedAccountId = null;
    }

    const result = await verifyLive(expectedAccountId);
    return json(
      result.ok
        ? {
            ok: true,
            verifier_version: VERSION,
            target_sha: caller.sha,
            ...result.report
          }
        : {
            ok: false,
            verifier_version: VERSION,
            target_sha: caller.sha,
            code: result.code,
            secrets_returned: false
          },
      result.status
    );
  } catch (error) {
    const code =
      error instanceof Error && error.message === 'configuration_missing'
        ? 'configuration_missing'
        : 'provider_read_failed';
    return json({
      ok: false,
      verifier_version: VERSION,
      code,
      secrets_returned: false
    }, code === 'configuration_missing' ? 503 : 502);
  }
});
