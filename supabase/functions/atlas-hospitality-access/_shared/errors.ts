const headers = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer'
};

const SAFE_DETAIL_KEYS = new Set([
  'provider_status',
  'provider_code',
  'blocker',
  'errors',
  'operation',
  'state'
]);

export class HospitalityError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(code: string, status = 400, details: Record<string, unknown> = {}) {
    super(code);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function hospitalityError(code: string, status = 400, details: Record<string, unknown> = {}) {
  return new HospitalityError(code, status, details);
}

function safeDetails(details: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(details).filter(([key]) => SAFE_DETAIL_KEYS.has(key))
  );
}

export function normalizeError(error: unknown) {
  if (error instanceof HospitalityError) {
    return { code: error.code, status: error.status, details: safeDetails(error.details) };
  }

  const message = error instanceof Error ? error.message : 'internal_error';
  if (message === 'authentication_required' || message === 'invalid_session') {
    return { code: message, status: 401, details: {} };
  }
  if (message === 'active_organization_required' || message === 'authorization_denied') {
    return { code: message, status: 403, details: {} };
  }
  if (message === 'supabase_runtime_not_configured' || message === 'server_secret_not_configured') {
    return { code: message, status: 503, details: {} };
  }
  return { code: 'internal_error', status: 500, details: {} };
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}

export function errorResponse(error: unknown) {
  const normalized = normalizeError(error);
  return json({ ok: false, error: normalized.code, ...normalized.details }, normalized.status);
}
