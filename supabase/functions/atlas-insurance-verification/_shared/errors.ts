export const INSURANCE_ERROR_CODES = [
  'authentication_required',
  'no_active_organization',
  'invalid_scope',
  'invalid_resource',
  'invalid_code_format',
  'invalid_code',
  'challenge_expired',
  'challenge_consumed',
  'challenge_locked',
  'resend_cooldown',
  'resend_limit_reached',
  'delivery_not_configured',
  'delivery_failed',
  'verification_required',
  'verification_not_configured',
  'persistence_failed',
  'invalid_request',
  'internal_error'
] as const;

export type InsuranceErrorCode = (typeof INSURANCE_ERROR_CODES)[number];

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

export class InsuranceVerificationError extends Error {
  readonly code: InsuranceErrorCode;
  readonly status: number;
  readonly retryAfterSeconds: number | null;

  constructor(code: InsuranceErrorCode, status = 400, retryAfterSeconds: number | null = null) {
    super(code);
    this.name = 'InsuranceVerificationError';
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function insuranceError(code: InsuranceErrorCode, status = 400, retryAfterSeconds: number | null = null) {
  return new InsuranceVerificationError(code, status, retryAfterSeconds);
}

export function normalizeInsuranceError(error: unknown) {
  if (error instanceof InsuranceVerificationError) {
    return { code: error.code, status: error.status, retryAfterSeconds: error.retryAfterSeconds };
  }

  const message = error instanceof Error ? error.message : 'internal_error';
  if (message === 'authentication_required' || message === 'invalid_session') {
    return { code: 'authentication_required' as const, status: 401, retryAfterSeconds: null };
  }
  if (message === 'no_active_organization' || message === 'active_organization_required') {
    return { code: 'no_active_organization' as const, status: 403, retryAfterSeconds: null };
  }
  if (message === 'verification_not_configured' || message === 'supabase_runtime_not_configured' || message === 'server_secret_not_configured') {
    return { code: 'verification_not_configured' as const, status: 503, retryAfterSeconds: null };
  }
  if (message === 'delivery_not_configured') {
    return { code: 'delivery_not_configured' as const, status: 503, retryAfterSeconds: null };
  }
  if (message === 'delivery_failed') {
    return { code: 'delivery_failed' as const, status: 502, retryAfterSeconds: null };
  }
  return { code: 'internal_error' as const, status: 500, retryAfterSeconds: null };
}

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'authorization, apikey, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-max-age': '86400',
    vary: 'Origin'
  };
}

export function json(data: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, ...corsHeaders(origin) }
  });
}

export function optionsResponse(origin: string | null) {
  return new Response(null, {
    status: 204,
    headers: { ...headers, ...corsHeaders(origin) }
  });
}

export function errorResponse(error: unknown, origin: string | null = null) {
  const normalized = normalizeInsuranceError(error);
  return json({
    ok: false,
    code: normalized.code,
    error: normalized.code,
    message: normalized.code,
    ...(normalized.retryAfterSeconds == null ? {} : { retry_after_seconds: normalized.retryAfterSeconds })
  }, normalized.status, origin);
}
