import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import {
  evaluateConnectedAppAccess,
  sanitizeConnectedAppMetadata
} from '../_shared/connected-apps/access.ts';
import { getProviderManifest, listProviderManifests } from '../_shared/connected-apps/provider-registry.ts';

const URL = Deno.env.get('SUPABASE_URL') || '';
const PUBLISHABLE = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SECRET = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };

const OPERATIONS = [
  'catalog.list',
  'connection.list',
  'connection.get',
  'connection.prepare_auth',
  'connection.complete_auth',
  'connection.verify',
  'connection.reconnect',
  'connection.disconnect',
  'capability.list',
  'policy.list',
  'policy.upsert',
  'access.evaluate',
  'access.execute',
  'audit.list',
  'retention.list',
  'retention.request_delete',
  'external_access.summary',
  'assistant.apps'
] as const;

type Operation = (typeof OPERATIONS)[number];
type Json = Record<string, unknown>;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}
function fail(error: string, status = 400, extra: Json = {}) {
  return json({ ok: false, error, ...extra }, status);
}
function userClient(req: Request) {
  return createClient(URL, PUBLISHABLE, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: req.headers.get('authorization') || '' } }
  });
}
function adminClient() {
  if (!SECRET) throw new Error('server_secret_not_configured');
  return createClient(URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function actor(req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('authentication_required');
  const sb = userClient(req);
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw new Error('invalid_session');
  return { sb, user: data.user };
}
async function permitted(sb: ReturnType<typeof createClient>, orgId: string, permission: string) {
  const { data, error } = await sb.rpc('has_identity_permission', { o: orgId, p: permission });
  if (error) throw new Error('permission_check_failed');
  return data === true;
}
async function requirePermission(sb: ReturnType<typeof createClient>, orgId: string, permission: string) {
  if (!orgId || !await permitted(sb, orgId, permission)) throw new Error('permission_denied');
}

const SAFE_CONNECTION_FIELDS = 'id,org_id,provider,connection_name,auth_kind,endpoint_origin,authorized,provider_verified,state,provider_account_id,provider_account_label,granted_scopes,last_verified_at,last_success_at,last_error_code,last_error_at,connected_by,connected_at,revoked_at,expires_at,last_error_summary,metadata,created_at,updated_at';

function normalizeConnection(row: Json) {
  const state = row.state === 'unconfigured' ? 'disconnected' : row.state;
  return sanitizeConnectedAppMetadata({ ...row, state });
}

async function connectionById(admin: ReturnType<typeof createClient>, orgId: string, id: string) {
  const { data, error } = await admin.from('atlas_integration_connections')
    .select(SAFE_CONNECTION_FIELDS).eq('id', id).eq('org_id', orgId).maybeSingle();
  if (error) throw new Error('persistence_error');
  if (!data) throw new Error('connection_not_found');
  return data as Json;
}

async function hubSpotProxy(req: Request, operation: string, orgId: string, extra: Json = {}) {
  if (!URL) throw new Error('provider_unavailable');
  const response = await fetch(`${URL.replace(/\/$/, '')}/functions/v1/atlas-crm-hubspot`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: req.headers.get('authorization') || '',
      apikey: req.headers.get('apikey') || PUBLISHABLE
    },
    body: JSON.stringify({ operation, organization_id: orgId, ...extra })
  });
  let data: Json = {};
  try { data = await response.json(); } catch { data = { error: 'provider_request_failed' }; }
  if (!response.ok) throw new Error(String(data.error || 'provider_request_failed'));
  return sanitizeConnectedAppMetadata(data);
}

async function listConnections(admin: ReturnType<typeof createClient>, orgId: string) {
  const { data, error } = await admin.from('atlas_integration_connections')
    .select(SAFE_CONNECTION_FIELDS).eq('org_id', orgId).order('provider').order('connection_name');
  if (error) throw new Error('persistence_error');
  return (data || []).map((row) => normalizeConnection(row as Json));
}

async function catalogList(req: Request, orgId: string, sb: ReturnType<typeof createClient>) {
  await requirePermission(sb, orgId, 'connected_apps.read');
  const admin = adminClient();
  const connections = await listConnections(admin, orgId);
  const byProvider = new Map(connections.map((row: any) => [String(row.provider), row]));
  const apps = listProviderManifests().map((manifest) => {
    const connection: any = byProvider.get(manifest.providerId) || null;
    const granted = new Set(Array.isArray(connection?.granted_scopes) ? connection.granted_scopes.map(String) : []);
    return {
      providerId: manifest.providerId,
      displayName: manifest.displayName,
      runtimeStatus: manifest.runtimeStatus,
      connectionId: connection?.id || null,
      status: connection?.state || 'disconnected',
      accountLabel: connection?.provider_account_label || null,
      lastVerifiedAt: connection?.last_verified_at || null,
      capabilities: manifest.capabilities.map((capability) => {
        const missingScopes = capability.providerScopes.filter((scope) => !granted.has(scope));
        return { code: capability.code, accessLevel: capability.accessLevel, usable: connection?.state === 'connected' && missingScopes.length === 0, missingScopes };
      })
    };
  });
  return json({ ok: true, apps });
}

async function handleLifecycle(req: Request, operation: Operation, body: Json, orgId: string, sb: ReturnType<typeof createClient>, userId: string) {
  const admin = adminClient();
  if (operation === 'connection.list') {
    await requirePermission(sb, orgId, 'connected_apps.read');
    return json({ ok: true, connections: await listConnections(admin, orgId) });
  }
  if (operation === 'connection.get') {
    await requirePermission(sb, orgId, 'connected_apps.read');
    const connection = await connectionById(admin, orgId, String(body.connection_id || ''));
    return json({ ok: true, connection: normalizeConnection(connection) });
  }
  if (operation === 'capability.list') {
    await requirePermission(sb, orgId, 'connected_apps.read');
    const connection = await connectionById(admin, orgId, String(body.connection_id || ''));
    const manifest = getProviderManifest(String(connection.provider || ''));
    if (!manifest) return fail('capability_not_supported', 404);
    const granted = new Set(Array.isArray(connection.granted_scopes) ? connection.granted_scopes.map(String) : []);
    return json({ ok: true, capabilities: manifest.capabilities.map((capability) => ({
      ...capability,
      authorized: capability.providerScopes.every((scope) => granted.has(scope)),
      verified: connection.provider_verified === true
    })) });
  }

  if (operation === 'connection.prepare_auth' || operation === 'connection.reconnect') {
    await requirePermission(sb, orgId, operation === 'connection.prepare_auth' ? 'connected_apps.connect' : 'connected_apps.manage');
    const provider = operation === 'connection.prepare_auth'
      ? String(body.provider_id || '')
      : String((await connectionById(admin, orgId, String(body.connection_id || ''))).provider || '');
    const manifest = getProviderManifest(provider);
    if (!manifest || manifest.runtimeStatus !== 'ready') return fail('provider_unavailable', 409);
    if (provider !== 'hubspot') return fail('capability_not_supported', 409);
    const proxied = await hubSpotProxy(req, 'oauth.prepare', orgId);
    return json({ ok: true, provider, ...proxied });
  }

  if (operation === 'connection.complete_auth') {
    await requirePermission(sb, orgId, 'connected_apps.connect');
    const provider = String(body.provider_id || '');
    if (provider !== 'hubspot') return fail('capability_not_supported', 409);
    return fail('provider_callback_uses_existing_endpoint', 409, { provider, callback_owner: 'atlas-crm-hubspot' });
  }

  if (operation === 'connection.verify') {
    await requirePermission(sb, orgId, 'connected_apps.manage');
    const connection = await connectionById(admin, orgId, String(body.connection_id || ''));
    if (connection.provider !== 'hubspot') return fail('provider_unavailable', 409);
    const proxied = await hubSpotProxy(req, 'connection.health', orgId);
    return json({ ok: true, provider: 'hubspot', verification: proxied });
  }

  if (operation === 'connection.disconnect') {
    await requirePermission(sb, orgId, 'connected_apps.disconnect');
    const connection = await connectionById(admin, orgId, String(body.connection_id || ''));
    const disconnectedAt = new Date().toISOString();
    const { error: localError } = await admin.from('atlas_integration_connections').update({
      state: 'unconfigured', authorized: false, provider_verified: false, updated_by: userId,
      revoked_at: disconnectedAt, last_error_code: null, last_error_summary: null
    }).eq('id', String(connection.id)).eq('org_id', orgId);
    if (localError) throw new Error('persistence_error');

    let provider_revoked = false;
    let revocation_pending = false;
    if (connection.provider === 'hubspot') {
      try {
        await hubSpotProxy(req, 'connection.disconnect', orgId);
        provider_revoked = true;
      } catch {
        revocation_pending = true;
        await admin.from('atlas_integration_connections').update({
          last_error_code: 'provider_revoke_unverified',
          last_error_summary: 'Local access is disconnected; provider revocation remains unverified.'
        }).eq('id', String(connection.id)).eq('org_id', orgId);
      }
    } else {
      revocation_pending = true;
    }
    return json({ ok: true, state: 'disconnected', local_disconnected: true, provider_revoked, revocation_pending });
  }

  return fail('unsupported_operation', 400);
}

async function handleGovernance(operation: Operation, body: Json, orgId: string, sb: ReturnType<typeof createClient>, userId: string) {
  const admin = adminClient();
  if (operation === 'policy.list') {
    await requirePermission(sb, orgId, 'connected_apps.policy.read');
    const { data, error } = await admin.from('atlas_connected_app_policies')
      .select('id,org_id,connection_id,capability_pattern,effect,actor_kind,role_constraints,data_classification,enabled,created_at,updated_at')
      .eq('org_id', orgId).order('created_at');
    if (error) throw new Error('persistence_error');
    return json({ ok: true, policies: data || [] });
  }
  if (operation === 'policy.upsert') {
    await requirePermission(sb, orgId, 'connected_apps.policy.manage');
    const effect = String(body.effect || '');
    if (!['allow', 'approval_required', 'deny'].includes(effect)) return fail('invalid_policy_effect', 422);
    const actorKind = String(body.actor_kind || 'any');
    if (!['user', 'agent', 'workflow', 'any'].includes(actorKind)) return fail('invalid_actor_kind', 422);
    const row = {
      org_id: orgId,
      connection_id: body.connection_id || null,
      capability_pattern: String(body.capability_pattern || ''),
      effect,
      actor_kind: actorKind,
      enabled: body.enabled !== false,
      updated_by: userId,
      created_by: userId
    };
    if (!row.capability_pattern) return fail('capability_pattern_required', 422);
    const { data, error } = await admin.from('atlas_connected_app_policies')
      .upsert(row, { onConflict: 'org_id,connection_id,capability_pattern,actor_kind' })
      .select('id,org_id,connection_id,capability_pattern,effect,actor_kind,enabled,created_at,updated_at').single();
    if (error) throw new Error('persistence_error');
    return json({ ok: true, policy: data });
  }
  if (operation === 'audit.list') {
    await requirePermission(sb, orgId, 'connected_apps.audit.read');
    const { data, error } = await admin.from('atlas_connected_app_access_events')
      .select('id,connection_id,actor_user_id,actor_kind,source_ref,capability_code,provider_operation_class,target_resource_class,target_resource_id,decision,approval_ref,evidence_ref,safe_metadata,created_at')
      .eq('org_id', orgId).order('created_at', { ascending: false }).limit(200);
    if (error) throw new Error('persistence_error');
    return json({ ok: true, audit: data || [] });
  }
  if (operation === 'retention.list') {
    await requirePermission(sb, orgId, 'connected_apps.read');
    const { data, error } = await admin.from('atlas_connected_app_data_ledger')
      .select('id,connection_id,data_category,purpose,storage_mode,first_accessed_at,last_accessed_at,retention_policy_code,scheduled_deletion_at,deletion_request_state,deletion_requested_at,deletion_evidence_ref,updated_at')
      .eq('org_id', orgId).order('updated_at', { ascending: false });
    if (error) throw new Error('persistence_error');
    return json({ ok: true, retention: data || [] });
  }
  if (operation === 'retention.request_delete') {
    await requirePermission(sb, orgId, 'connected_apps.retention.manage');
    const ledgerId = String(body.ledger_id || '');
    if (!ledgerId) return fail('ledger_id_required', 422);
    const { data, error } = await admin.from('atlas_connected_app_data_ledger').update({
      deletion_request_state: 'requested', deletion_requested_at: new Date().toISOString(), deletion_requested_by: userId,
      updated_at: new Date().toISOString()
    }).eq('id', ledgerId).eq('org_id', orgId)
      .select('id,connection_id,data_category,storage_mode,deletion_request_state,deletion_requested_at').maybeSingle();
    if (error) throw new Error('persistence_error');
    if (!data) return fail('retention_record_not_found', 404);
    return json({ ok: true, deletion_requested: true, retention: data });
  }
  return fail('unsupported_operation', 400);
}

async function handleAccess(operation: Operation, body: Json, orgId: string, sb: ReturnType<typeof createClient>, userId: string) {
  const admin = adminClient();
  if (operation === 'assistant.apps') {
    await requirePermission(sb, orgId, 'connected_apps.agent.use');
    const connections = await listConnections(admin, orgId);
    const apps = [];
    for (const connection of connections as any[]) {
      if (connection.state !== 'connected' || connection.provider_verified !== true) continue;
      const manifest = getProviderManifest(String(connection.provider));
      if (!manifest) continue;
      const granted = new Set(Array.isArray(connection.granted_scopes) ? connection.granted_scopes.map(String) : []);
      apps.push({
        providerId: manifest.providerId,
        displayName: manifest.displayName,
        accountLabel: connection.provider_account_label || null,
        health: connection.state,
        verifiedAt: connection.last_verified_at || null,
        capabilities: manifest.capabilities
          .filter((capability) => capability.providerScopes.every((scope) => granted.has(scope)))
          .map((capability) => ({ code: capability.code, approvalRequired: capability.accessLevel === 'consequential' }))
      });
    }
    return json({ ok: true, apps });
  }

  if (operation === 'external_access.summary') {
    await requirePermission(sb, orgId, 'connected_apps.audit.read');
    const connections = await listConnections(admin, orgId);
    const { data: decisions } = await admin.from('atlas_connected_app_access_events')
      .select('id,connection_id,capability_code,decision,created_at').eq('org_id', orgId)
      .order('created_at', { ascending: false }).limit(50);
    const { data: retention } = await admin.from('atlas_connected_app_data_ledger')
      .select('id,connection_id,data_category,deletion_request_state,scheduled_deletion_at').eq('org_id', orgId)
      .neq('deletion_request_state', 'none').limit(50);
    return json({ ok: true, connections, recentDecisions: decisions || [], retentionExceptions: retention || [] });
  }

  if (operation === 'access.evaluate' || operation === 'access.execute') {
    await requirePermission(sb, orgId, 'connected_apps.read');
    const connection = await connectionById(admin, orgId, String(body.connection_id || ''));
    const manifest = getProviderManifest(String(connection.provider || ''));
    if (!manifest) return fail('capability_not_supported', 404);
    const { data: policies, error } = await admin.from('atlas_connected_app_policies')
      .select('connection_id,capability_pattern,effect,actor_kind,enabled').eq('org_id', orgId).eq('enabled', true);
    if (error) throw new Error('persistence_error');
    const decision = await evaluateConnectedAppAccess({
      actorPermission: true,
      activeMembership: true,
      organizationId: orgId,
      connectionOrganizationId: String(connection.org_id || ''),
      connectionState: String(connection.state || 'unconfigured'),
      authorized: connection.authorized === true,
      providerVerified: connection.provider_verified === true,
      grantedScopes: Array.isArray(connection.granted_scopes) ? connection.granted_scopes.map(String) : [],
      manifest,
      capabilityCode: String(body.capability_code || ''),
      actorKind: String(body.actor_kind || 'user') === 'agent' ? 'agent' : String(body.actor_kind || 'user') === 'workflow' ? 'workflow' : 'user',
      policies: (policies || []).map((policy: any) => ({
        connectionId: policy.connection_id,
        capabilityPattern: String(policy.capability_pattern),
        effect: policy.effect,
        actorKind: policy.actor_kind,
        enabled: policy.enabled === true
      })),
      owningModulePermission: body.owning_module_permission !== false
    });

    await admin.from('atlas_connected_app_access_events').insert({
      org_id: orgId,
      connection_id: String(connection.id),
      actor_user_id: userId,
      actor_kind: String(body.actor_kind || 'user'),
      source_ref: String(body.source_ref || ''),
      capability_code: String(body.capability_code || ''),
      provider_operation_class: operation,
      decision: decision.effect === 'allow' ? 'allowed' : decision.effect === 'approval_required' ? 'approval_required' : 'denied',
      safe_metadata: sanitizeConnectedAppMetadata({ reason: decision.reason })
    });

    if (operation === 'access.evaluate') return json({ ok: true, decision });
    if (decision.effect === 'deny') return fail(decision.reason, 403);
    if (decision.effect === 'approval_required') return fail('approval_required', 409, { approval_required: true });
    return fail('provider_execution_not_reconciled', 409);
  }
  return fail('unsupported_operation', 400);
}

export async function handleAtlasConnectedAppsRequest(req: Request): Promise<Response> {
  if (req.method !== 'POST') return fail('method_not_allowed', 405);
  let body: Json;
  try { body = await req.json(); } catch { return fail('invalid_json', 400); }
  const operation = String(body.operation || '') as Operation;
  if (!OPERATIONS.includes(operation)) return fail('unsupported_operation', 400);
  const orgId = String(body.organization_id || '');
  try {
    const { sb, user } = await actor(req);
    if (!orgId) return fail('organization_required', 422);
    if (operation === 'catalog.list') return await catalogList(req, orgId, sb);
    if (operation.startsWith('connection.') || operation === 'capability.list') {
      return await handleLifecycle(req, operation, body, orgId, sb, user.id);
    }
    if (operation.startsWith('policy.') || operation.startsWith('audit.') || operation.startsWith('retention.')) {
      return await handleGovernance(operation, body, orgId, sb, user.id);
    }
    return await handleAccess(operation, body, orgId, sb, user.id);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'internal_error';
    if (code === 'permission_denied') return fail(code, 403);
    if (code === 'connection_not_found') return fail(code, 404);
    if (code === 'authentication_required' || code === 'invalid_session') return fail(code, 401);
    return fail(['provider_unavailable','provider_request_failed','persistence_error','permission_check_failed'].includes(code) ? code : 'internal_error', 500);
  }
}

if (import.meta.main) Deno.serve(handleAtlasConnectedAppsRequest);
