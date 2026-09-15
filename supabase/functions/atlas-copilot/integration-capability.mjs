const ALLOWED_CAPABILITIES = new Set(['microsoft.profile.read']);
const SECRET_KEY = /token|secret|password|authorization|cookie|verifier|client[_-]?secret/i;

function capabilityError(code, status = 400) {
  return Object.assign(new Error(code), { code, status });
}

function safeText(value, max = 160) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function containsSecretKey(value, depth = 0) {
  if (depth > 8 || !value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((item) => containsSecretKey(item, depth + 1));
  return Object.entries(value).some(([key, item]) => SECRET_KEY.test(key) || containsSecretKey(item, depth + 1));
}

function sanitize(value, depth = 0) {
  if (depth > 8) return null;
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return value.slice(0, 4000);
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitize(item, depth + 1));
  if (!value || typeof value !== 'object') return null;
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_KEY.test(key)) throw capabilityError('integration_secret_boundary_violation', 502);
    result[key] = sanitize(item, depth + 1);
  }
  return result;
}

export async function executeIntegrationCapability({
  request,
  organizationId,
  module = 'assistant',
  capability,
  fetchFn = fetch
}) {
  const requestedCapability = safeText(capability, 120);
  if (!ALLOWED_CAPABILITIES.has(requestedCapability)) {
    throw capabilityError('integration_capability_not_allowed', 403);
  }

  const orgId = safeText(organizationId, 160);
  if (!orgId) throw capabilityError('integration_organization_required', 400);
  const authorization = request.headers.get('authorization') || '';
  if (!/^Bearer\s+\S+/i.test(authorization)) throw capabilityError('authentication_required', 401);

  const requestOrg = safeText(request.headers.get('x-atlas-org-id'), 160);
  if (requestOrg && requestOrg !== orgId) throw capabilityError('integration_organization_mismatch', 403);

  const endpoint = new URL('/functions/v1/atlas-integrations?action=execute', request.url);
  const headers = new Headers({
    authorization,
    'content-type': 'application/json',
    'x-atlas-org-id': orgId
  });
  const apikey = request.headers.get('apikey');
  const requestId = request.headers.get('x-request-id');
  if (apikey) headers.set('apikey', apikey);
  if (requestId) headers.set('x-request-id', requestId);

  let response;
  try {
    response = await fetchFn(endpoint.toString(), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        provider_key: 'microsoft',
        capability: requestedCapability,
        module: safeText(module, 120) || 'assistant'
      })
    });
  } catch {
    throw capabilityError('integration_gateway_unavailable', 503);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw capabilityError('integration_gateway_invalid_response', 502);
  }

  if (containsSecretKey(payload)) throw capabilityError('integration_secret_boundary_violation', 502);
  const safePayload = sanitize(payload);
  if (!response.ok || safePayload?.ok === false) {
    return {
      ok: false,
      capability: requestedCapability,
      data: null,
      blocked_reason: safeText(safePayload?.error, 120) || `integration_gateway_${response.status}`,
      connection_state: safeText(safePayload?.connection_state, 80) || null
    };
  }

  if (safeText(safePayload?.capability, 120) !== requestedCapability) {
    throw capabilityError('integration_capability_response_mismatch', 502);
  }

  return {
    ok: true,
    capability: requestedCapability,
    data: safePayload?.data && typeof safePayload.data === 'object' ? safePayload.data : {},
    blocked_reason: null,
    connection_state: safeText(safePayload?.connection_state, 80) || null
  };
}
