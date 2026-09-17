export type SecurityProtectionErrorCode =
  | 'authentication_required'
  | 'invalid_session'
  | 'active_organization_required'
  | 'security_runtime_not_configured'
  | 'webauthn_not_configured'
  | 'webauthn_verification_failed'
  | 'challenge_invalid_or_expired'
  | 'passkey_not_found'
  | 'invalid_operation'
  | 'invalid_request'
  | 'security_operation_failed';

export class SecurityProtectionError extends Error {
  readonly code: SecurityProtectionErrorCode;
  readonly status: number;

  constructor(code: SecurityProtectionErrorCode, status = 400, message = code) {
    super(message);
    this.name = 'SecurityProtectionError';
    this.code = code;
    this.status = status;
  }
}

export function securityErrorResponse(error: unknown): Response {
  const normalized = error instanceof SecurityProtectionError
    ? error
    : new SecurityProtectionError('security_operation_failed', 500);

  return new Response(JSON.stringify({ ok: false, error: normalized.code }), {
    status: normalized.status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer'
    }
  });
}
