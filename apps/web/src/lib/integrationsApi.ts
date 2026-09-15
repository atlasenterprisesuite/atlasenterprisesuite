import { authorizedAtlasFetch, getActiveAtlasOrganization } from './atlasSession';

export type BrowserIntegrationConnection = {
  id: string;
  providerKey: string;
  status: string;
  maskedIdentity: string | null;
  connectedAt: string | null;
  lastVerifiedAt: string | null;
  expiresAt: string | null;
  scopes: string[];
  connectorClass: 'user_oauth' | 'infrastructure';
  environment: string | null;
  lastErrorCode: string | null;
};

export type BrowserIntegrationGrant = {
  id: string;
  principalType: 'user' | 'role' | 'module';
  principalId: string;
  module: string;
  capability: string;
  grantedAt: string | null;
};

export type BrowserIntegrationActivity = {
  id: string;
  action: string;
  outcome: string;
  module: string | null;
  statusBefore: string | null;
  statusAfter: string | null;
  capability: string | null;
  createdAt: string | null;
};

type JsonRecord = Record<string, unknown>;

function recordOf(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function nullableText(value: unknown): string | null {
  const valueText = text(value);
  return valueText || null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => text(item)).filter(Boolean))];
}

export function normalizeIntegrationConnection(raw: unknown): BrowserIntegrationConnection {
  const row = recordOf(raw);
  const providerKey = text(row.provider_key) || text(row.provider);
  const connectorClass = text(row.connector_class) === 'infrastructure' ? 'infrastructure' : 'user_oauth';
  return {
    id: text(row.id),
    providerKey,
    status: text(row.status) || text(row.state) || 'not_connected',
    maskedIdentity: nullableText(row.masked_identity ?? row.provider_account_label),
    connectedAt: nullableText(row.connected_at),
    lastVerifiedAt: nullableText(row.last_verified_at),
    expiresAt: nullableText(row.expires_at),
    scopes: stringArray(row.scopes ?? row.granted_scopes),
    connectorClass,
    environment: nullableText(row.environment),
    lastErrorCode: nullableText(row.last_error_code)
  };
}

export function normalizeIntegrationGrant(raw: unknown): BrowserIntegrationGrant | null {
  const row = recordOf(raw);
  const principalType = text(row.principal_type);
  if (!['user', 'role', 'module'].includes(principalType)) return null;
  const id = text(row.id);
  const capability = text(row.capability);
  const module = text(row.module);
  const principalId = text(row.principal_id);
  if (!id || !capability || !module || !principalId) return null;
  return {
    id,
    principalType: principalType as BrowserIntegrationGrant['principalType'],
    principalId,
    module,
    capability,
    grantedAt: nullableText(row.granted_at)
  };
}

export function normalizeIntegrationActivity(raw: unknown): BrowserIntegrationActivity | null {
  const row = recordOf(raw);
  const id = text(row.id);
  const action = text(row.action);
  const outcome = text(row.outcome);
  if (!id || !action || !outcome) return null;
  const metadata = recordOf(row.metadata);
  return {
    id,
    action,
    outcome,
    module: nullableText(row.module),
    statusBefore: nullableText(row.status_before),
    statusAfter: nullableText(row.status_after),
    capability: nullableText(metadata.capability),
    createdAt: nullableText(row.created_at)
  };
}

async function parseJson(response: Response): Promise<JsonRecord> {
  let payload: unknown = {};
  try {
    payload = await response.json();
  } catch {
    throw new Error('integration_response_invalid');
  }
  const data = recordOf(payload);
  if (!response.ok || data.ok === false) {
    throw new Error(text(data.error) || `integration_request_failed_${response.status}`);
  }
  return data;
}

async function invokeIntegration(path: string, init: RequestInit = {}) {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch(`/functions/v1/${path}`, {
    ...init,
    headers: {
      'x-atlas-org-id': organization.id,
      ...(init.headers || {})
    }
  });
  return parseJson(response);
}

export async function listIntegrationConnections(): Promise<BrowserIntegrationConnection[]> {
  const data = await invokeIntegration('atlas-integrations?action=connections', { method: 'GET' });
  const rows = Array.isArray(data.connections) ? data.connections : [];
  return rows.map(normalizeIntegrationConnection).filter((row) => Boolean(row.providerKey));
}

export async function getIntegrationConnection(providerKey: string): Promise<BrowserIntegrationConnection | null> {
  const provider = encodeURIComponent(providerKey.trim().toLowerCase());
  const data = await invokeIntegration(`atlas-integrations?action=connection&provider=${provider}`, { method: 'GET' });
  return data.connection ? normalizeIntegrationConnection(data.connection) : null;
}

export async function beginIntegrationAuthorization(
  providerKey: string,
  capabilities: string[] = ['microsoft.profile.read']
): Promise<{ authorizationUrl: string; expiresIn: number }> {
  const provider = providerKey.trim().toLowerCase();
  const data = await invokeIntegration('atlas-integration-oauth?action=start', {
    method: 'POST',
    body: JSON.stringify({
      provider_key: provider,
      capabilities,
      return_to: `/settings/security/connected-apps/${encodeURIComponent(provider)}`
    })
  });
  const authorizationUrl = text(data.authorization_url);
  if (!/^https:\/\//i.test(authorizationUrl)) throw new Error('authorization_url_invalid');
  return { authorizationUrl, expiresIn: Number(data.expires_in) || 600 };
}

export async function verifyIntegration(providerKey: string): Promise<BrowserIntegrationConnection> {
  const data = await invokeIntegration('atlas-integrations?action=verify', {
    method: 'POST',
    body: JSON.stringify({ provider_key: providerKey.trim().toLowerCase() })
  });
  if (!data.connection) throw new Error('integration_connection_missing');
  return normalizeIntegrationConnection(data.connection);
}

export async function executeIntegrationCapability(
  providerKey: string,
  capability: string,
  module = 'settings'
): Promise<{ capability: string; data: JsonRecord }> {
  const result = await invokeIntegration('atlas-integrations?action=execute', {
    method: 'POST',
    body: JSON.stringify({ provider_key: providerKey.trim().toLowerCase(), capability, module })
  });
  return { capability: text(result.capability), data: recordOf(result.data) };
}

export async function listIntegrationGrants(providerKey: string): Promise<BrowserIntegrationGrant[]> {
  const provider = encodeURIComponent(providerKey.trim().toLowerCase());
  const data = await invokeIntegration(`atlas-integrations?action=grants&provider=${provider}`, { method: 'GET' });
  const rows = Array.isArray(data.grants) ? data.grants : [];
  return rows.map(normalizeIntegrationGrant).filter((row): row is BrowserIntegrationGrant => Boolean(row));
}

export async function grantIntegrationCapability(
  providerKey: string,
  capability: string,
  module = 'settings'
): Promise<BrowserIntegrationGrant> {
  const data = await invokeIntegration('atlas-integrations?action=grant', {
    method: 'POST',
    body: JSON.stringify({
      provider_key: providerKey.trim().toLowerCase(),
      capability,
      module,
      principal_type: 'user'
    })
  });
  const grant = normalizeIntegrationGrant(data.grant);
  if (!grant) throw new Error('integration_grant_invalid');
  return grant;
}

export async function revokeIntegrationGrant(providerKey: string, grantId: string): Promise<BrowserIntegrationGrant> {
  const data = await invokeIntegration('atlas-integrations?action=revoke-grant', {
    method: 'POST',
    body: JSON.stringify({ provider_key: providerKey.trim().toLowerCase(), grant_id: grantId })
  });
  const grant = normalizeIntegrationGrant(data.grant);
  if (!grant) throw new Error('integration_grant_invalid');
  return grant;
}

export async function listIntegrationActivity(providerKey: string): Promise<BrowserIntegrationActivity[]> {
  const provider = encodeURIComponent(providerKey.trim().toLowerCase());
  const data = await invokeIntegration(`atlas-integrations?action=audit&provider=${provider}`, { method: 'GET' });
  const rows = Array.isArray(data.events) ? data.events : [];
  return rows.map(normalizeIntegrationActivity).filter((row): row is BrowserIntegrationActivity => Boolean(row));
}

export async function revokeIntegration(providerKey: string): Promise<{
  connection: BrowserIntegrationConnection;
  providerManagementUrl: string | null;
}> {
  const data = await invokeIntegration('atlas-integrations?action=revoke', {
    method: 'POST',
    body: JSON.stringify({ provider_key: providerKey.trim().toLowerCase() })
  });
  if (!data.connection) throw new Error('integration_connection_missing');
  return {
    connection: normalizeIntegrationConnection(data.connection),
    providerManagementUrl: nullableText(data.provider_management_url)
  };
}
