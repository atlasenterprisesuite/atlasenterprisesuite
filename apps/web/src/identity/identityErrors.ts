export type IdentityPhase = 'sign_in' | 'organization';

/**
 * Present actionable, low-information errors to the browser. Never render
 * raw auth/PostgREST messages (which may contain internal schema details).
 */
export function identityErrorMessage(cause: unknown, phase: IdentityPhase = 'sign_in'): string {
  const message = cause instanceof Error ? cause.message : String(cause || '');

  if (message === 'no_active_organization') {
    return 'Your account is authenticated but has no active ATLAS organization access.';
  }
  if (message === 'authentication_required' || message === 'session_expired' || message === 'invalid_session') {
    return 'Your ATLAS session is no longer valid. Sign in again.';
  }
  if (/invalid login credentials|invalid_credentials/i.test(message)) {
    return 'The email or password is incorrect.';
  }
  if (/email not confirmed|email_not_confirmed/i.test(message)) {
    return 'Confirm your email address before signing in to ATLAS.';
  }
  if (/too many requests|rate limit|over_request_rate_limit/i.test(message)) {
    return 'Too many sign-in attempts. Wait briefly before trying again.';
  }
  if (/failed to fetch|networkerror|network request failed|load failed|fetch failed|offline/i.test(message)) {
    return 'ATLAS Identity could not reach the authentication service. Check your connection and try again.';
  }
  if (phase === 'organization') {
    return 'ATLAS could not verify your active organization after sign-in. Try again or contact your ATLAS administrator.';
  }
  return 'ATLAS Identity could not complete sign-in. Try again or contact your ATLAS administrator.';
}
