export type TrustErrorCode =
  | 'authentication_required'
  | 'active_organization_required'
  | 'invalid_operation'
  | 'invalid_action_type'
  | 'invalid_action_class'
  | 'trust_policy_not_found'
  | 'trust_replay_detected'
  | 'trust_tenant_mismatch'
  | 'trust_session_mismatch'
  | 'trust_action_mismatch'
  | 'trust_rate_limited'
  | 'trust_temporarily_held'
  | 'trust_denied'
  | 'trust_not_configured';

export class TrustPassError extends Error {
  readonly code: TrustErrorCode;
  readonly status: number;

  constructor(code: TrustErrorCode, status: number) {
    super(code);
    this.name = 'TrustPassError';
    this.code = code;
    this.status = status;
  }
}

export function trustError(code: TrustErrorCode, status = 400) {
  return new TrustPassError(code, status);
}

export function trustErrorResponse(cause: unknown) {
  const error = cause instanceof TrustPassError
    ? cause
    : trustError('trust_not_configured', 503);

  return new Response(JSON.stringify({ ok: false, error: error.code }), {
    status: error.status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store'
    }
  });
}
