import { authorizedAtlasFetch, getActiveAtlasOrganization } from './atlasSession';

type RecordLike = Record<string, any>;

const SECRET_KEY = /(authorization|token|secret|password|credential|cookie|ciphertext|\biv\b)/i;

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    const output: RecordLike = {};
    for (const [key, item] of Object.entries(value as RecordLike)) {
      if (SECRET_KEY.test(key)) continue;
      output[key] = sanitize(item);
    }
    if (output.state === 'unconfigured') output.state = 'disconnected';
    return output;
  }
  return value;
}

export function normalizeConnectedAppsResponse(value: unknown): unknown {
  return sanitize(value);
}

async function connectedAppsPost(operation: string, payload: RecordLike = {}): Promise<RecordLike> {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/functions/v1/atlas-connected-apps', {
    method: 'POST',
    body: JSON.stringify({ operation, organization_id: organization.id, ...payload })
  });
  const text = await response.text();
  let raw: RecordLike = {};
  try { raw = text ? JSON.parse(text) : {}; } catch { raw = { error: 'invalid_response' }; }
  const data = normalizeConnectedAppsResponse(raw) as RecordLike;
  if (!response.ok) throw new Error(String(data.error || `connected_apps_request_failed_${response.status}`));
  return data;
}

export async function listConnectedApps() {
  return connectedAppsPost('catalog.list');
}
export async function getConnectedApp(connectionId: string) {
  return connectedAppsPost('connection.get', { connection_id: connectionId });
}
export async function prepareConnectedAppAuth(providerId: string) {
  return connectedAppsPost('connection.prepare_auth', { provider_id: providerId });
}
export async function verifyConnectedApp(connectionId: string) {
  return connectedAppsPost('connection.verify', { connection_id: connectionId });
}
export async function reconnectConnectedApp(connectionId: string) {
  return connectedAppsPost('connection.reconnect', { connection_id: connectionId });
}
export async function disconnectConnectedApp(connectionId: string) {
  return connectedAppsPost('connection.disconnect', { connection_id: connectionId });
}
export async function listConnectedAppPolicies() {
  return connectedAppsPost('policy.list');
}
export async function upsertConnectedAppPolicy(input: RecordLike) {
  return connectedAppsPost('policy.upsert', input);
}
export async function listConnectedAppAudit() {
  return connectedAppsPost('audit.list');
}
export async function listConnectedAppRetention() {
  return connectedAppsPost('retention.list');
}
export async function requestConnectedAppDeletion(input: { ledgerId: string }) {
  return connectedAppsPost('retention.request_delete', { ledger_id: input.ledgerId });
}
export async function listAssistantConnectedApps() {
  return connectedAppsPost('assistant.apps');
}
export async function loadExternalAccess() {
  return connectedAppsPost('external_access.summary');
}
