import type { IntegrationRequestContext } from './context';
import { integrationError } from './context';

type AdminDeps = {
  supabaseUrl?: string;
  serviceRoleKey?: string;
  fetchFn?: typeof fetch;
};

function runtimeValue(name: string) {
  const deno = (globalThis as any).Deno;
  return typeof deno?.env?.get === 'function' ? String(deno.env.get(name) || '') : '';
}

function esc(value: string) {
  return encodeURIComponent(value);
}

export type IntegrationAdminClient = {
  request(path: string, init?: RequestInit): Promise<Response>;
  rows<T>(path: string, init?: RequestInit): Promise<T[]>;
};

export function integrationAdminClient(deps: AdminDeps = {}): IntegrationAdminClient {
  const supabaseUrl = (deps.supabaseUrl || runtimeValue('SUPABASE_URL')).replace(/\/$/, '');
  const serviceRoleKey = deps.serviceRoleKey || runtimeValue('SUPABASE_SERVICE_ROLE_KEY');
  const fetchFn = deps.fetchFn || fetch;
  if (!supabaseUrl || !serviceRoleKey) throw integrationError('integration_storage_not_configured', 503);
  const restRoot = `${supabaseUrl}/rest/v1`;

  async function request(path: string, init: RequestInit = {}) {
    let response: Response;
    try {
      response = await fetchFn(`${restRoot}/${path}`, {
        ...init,
        headers: {
          apikey: serviceRoleKey,
          authorization: `Bearer ${serviceRoleKey}`,
          ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
          ...(init.headers || {})
        }
      });
    } catch {
      throw integrationError('integration_storage_unavailable', 503);
    }
    if (!response.ok) throw integrationError('integration_storage_error', response.status >= 500 ? 503 : 500);
    return response;
  }

  async function rows<T>(path: string, init: RequestInit = {}): Promise<T[]> {
    const response = await request(path, init);
    try {
      const value = await response.json();
      if (!Array.isArray(value)) throw new Error('not_array');
      return value as T[];
    } catch {
      throw integrationError('integration_storage_malformed', 502);
    }
  }

  return { request, rows };
}

export type IntegrationConnectionRow = {
  id: string;
  org_id: string;
  provider: string;
  connection_name: string;
  state: string;
  connector_class: string;
  environment: string | null;
  provider_account_id: string | null;
  provider_account_label: string | null;
  granted_scopes: string[];
  credential_ref: string | null;
  last_verified_at: string | null;
  last_error_code: string | null;
  connected_by: string | null;
  connected_at: string | null;
  revoked_at: string | null;
};

const connectionSelect = [
  'id','org_id','provider','connection_name','state','connector_class','environment',
  'provider_account_id','provider_account_label','granted_scopes','credential_ref',
  'last_verified_at','last_error_code','connected_by','connected_at','revoked_at'
].join(',');

export async function listConnections(
  context: IntegrationRequestContext,
  deps: AdminDeps = {}
): Promise<IntegrationConnectionRow[]> {
  return integrationAdminClient(deps).rows<IntegrationConnectionRow>(
    `atlas_integration_connections?org_id=eq.${esc(context.organizationId)}&select=${connectionSelect}&order=provider.asc,connection_name.asc`
  );
}

export async function loadConnection(
  context: IntegrationRequestContext,
  selector: { id?: string; providerKey?: string; connectionName?: string },
  deps: AdminDeps = {}
): Promise<IntegrationConnectionRow | null> {
  let path = `atlas_integration_connections?org_id=eq.${esc(context.organizationId)}`;
  if (selector.id) path += `&id=eq.${esc(selector.id)}`;
  if (selector.providerKey) path += `&provider=eq.${esc(selector.providerKey)}`;
  if (selector.connectionName) path += `&connection_name=eq.${esc(selector.connectionName)}`;
  path += `&select=${connectionSelect}&limit=1`;
  return (await integrationAdminClient(deps).rows<IntegrationConnectionRow>(path))[0] || null;
}

export type IntegrationGrantRow = {
  id: string;
  org_id: string;
  connection_id: string;
  principal_type: 'user' | 'role' | 'module';
  principal_id: string;
  module: string;
  capability: string;
  granted_by: string;
  granted_at: string;
  revoked_at: string | null;
};

export async function loadGrant(
  context: IntegrationRequestContext,
  input: { connectionId: string; module: string; capability: string },
  deps: AdminDeps = {}
): Promise<IntegrationGrantRow | null> {
  const rows = await integrationAdminClient(deps).rows<IntegrationGrantRow>(
    `atlas_integration_grants?org_id=eq.${esc(context.organizationId)}&connection_id=eq.${esc(input.connectionId)}&module=eq.${esc(input.module)}&capability=eq.${esc(input.capability)}&revoked_at=is.null&select=*&order=granted_at.desc`
  );
  return rows.find((grant) => {
    if (grant.principal_type === 'user') return grant.principal_id === context.userId;
    if (grant.principal_type === 'role') return grant.principal_id === context.role;
    return grant.principal_id === input.module;
  }) || null;
}

export type IntegrationCredentialRow = {
  id: string;
  org_id: string;
  provider: string;
  credential_kind: string;
  ciphertext: string;
  iv: string;
  algorithm: 'AES-GCM-256';
  key_version: string;
  expires_at: string | null;
};

export async function insertCredentialRecord(
  row: Omit<IntegrationCredentialRow, 'id'>,
  deps: AdminDeps = {}
): Promise<IntegrationCredentialRow> {
  const rows = await integrationAdminClient(deps).rows<IntegrationCredentialRow>('atlas_integration_credentials', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row)
  });
  if (!rows[0]?.id) throw integrationError('credential_store_failed', 500);
  return rows[0];
}

export async function loadCredentialRecord(
  context: IntegrationRequestContext | { organizationId: string },
  input: { id: string; provider: string },
  deps: AdminDeps = {}
): Promise<IntegrationCredentialRow | null> {
  const rows = await integrationAdminClient(deps).rows<IntegrationCredentialRow>(
    `atlas_integration_credentials?id=eq.${esc(input.id)}&org_id=eq.${esc(context.organizationId)}&provider=eq.${esc(input.provider)}&select=id,org_id,provider,credential_kind,ciphertext,iv,algorithm,key_version,expires_at&limit=1`
  );
  return rows[0] || null;
}

export async function deleteCredentialRecord(
  organizationId: string,
  input: { id: string; provider: string },
  deps: AdminDeps = {}
) {
  await integrationAdminClient(deps).request(
    `atlas_integration_credentials?id=eq.${esc(input.id)}&org_id=eq.${esc(organizationId)}&provider=eq.${esc(input.provider)}`,
    { method: 'DELETE', headers: { Prefer: 'return=minimal' } }
  );
}

export async function updateConnection(
  context: IntegrationRequestContext,
  connectionId: string,
  patch: Record<string, unknown>,
  deps: AdminDeps = {}
): Promise<IntegrationConnectionRow | null> {
  const rows = await integrationAdminClient(deps).rows<IntegrationConnectionRow>(
    `atlas_integration_connections?id=eq.${esc(connectionId)}&org_id=eq.${esc(context.organizationId)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(patch)
    }
  );
  return rows[0] || null;
}

export async function insertIntegrationEvent(
  row: Record<string, unknown>,
  deps: AdminDeps = {}
) {
  await integrationAdminClient(deps).request('atlas_integration_events', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(row)
  });
}
