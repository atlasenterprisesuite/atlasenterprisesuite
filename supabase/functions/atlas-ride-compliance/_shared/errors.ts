const headers = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer'
};

const ALLOWED_ORIGINS = new Set([
  'https://atlasenterprisesuite.com',
  'https://www.atlasenterprisesuite.com'
]);

const SAFE_CODES = new Set([
  'authentication_required',
  'invalid_session',
  'active_organization_required',
  'invalid_organization',
  'organization_membership_required',
  'authorization_denied',
  'requirement_not_found',
  'requirement_not_actionable',
  'unsupported_image_type',
  'image_too_large',
  'empty_image',
  'upload_failed',
  'state_conflict',
  'rejection_reason_required',
  'preview_unavailable',
  'invalid_request',
  'invalid_photo',
  'supabase_runtime_not_configured',
  'server_secret_not_configured'
]);

export class RideComplianceError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export function complianceError(code: string, status = 400) {
  return new RideComplianceError(code, status);
}

export function normalizeComplianceError(error: unknown) {
  if (error instanceof RideComplianceError) {
    return { code: SAFE_CODES.has(error.code) ? error.code : 'internal_error', status: error.status };
  }
  const message = error instanceof Error ? error.message : 'internal_error';
  if (!SAFE_CODES.has(message)) return { code: 'internal_error', status: 500 };
  if (message === 'authentication_required' || message === 'invalid_session') return { code: message, status: 401 };
  if (
    message === 'active_organization_required'
    || message === 'organization_membership_required'
    || message === 'authorization_denied'
  ) return { code: message, status: 403 };
  if (message === 'requirement_not_found') return { code: message, status: 404 };
  if (message === 'state_conflict' || message === 'requirement_not_actionable') return { code: message, status: 409 };
  if (message === 'supabase_runtime_not_configured' || message === 'server_secret_not_configured') {
    return { code: message, status: 503 };
  }
  return { code: message, status: 400 };
}

export function corsHeaders(origin: string | null) {
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'authorization, apikey, content-type, x-atlas-org-id',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-max-age': '86400',
    vary: 'Origin'
  };
}

export function optionsResponse(origin: string | null) {
  return new Response(null, { status: 204, headers: { ...headers, ...corsHeaders(origin) } });
}

export function withCors(response: Response, origin: string | null) {
  const nextHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(origin))) nextHeaders.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: nextHeaders });
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}

export function errorResponse(error: unknown) {
  const normalized = normalizeComplianceError(error);
  return json({ ok: false, error: normalized.code }, normalized.status);
}
