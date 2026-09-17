import type { SecurityRequestContext } from './context.ts';
import { SecurityProtectionError } from './errors.ts';
import { hasValidStepUpGrant } from './repository.ts';

function currentJwt(context: SecurityRequestContext) {
  const jwt = context.bearer.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) throw new SecurityProtectionError('invalid_session', 401);
  return jwt;
}

function currentSessionId(jwt: string) {
  try {
    const segment = jwt.split('.')[1] || '';
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(segment.length / 4) * 4, '=');
    const payload = JSON.parse(atob(base64));
    const sessionId = String(payload?.session_id || '').trim();
    if (!sessionId) throw new Error('session_id_missing');
    return sessionId;
  } catch {
    throw new SecurityProtectionError('invalid_session', 401);
  }
}

async function recordOutcome(
  context: SecurityRequestContext,
  providerStatus: 'requested' | 'provider_succeeded' | 'provider_failed',
  reason: string,
  providerReference: string | null,
  failureCode: string | null
) {
  const { data, error } = await context.adminClient.rpc('record_security_session_revocation', {
    organization_uuid: context.orgId,
    user_uuid: context.userId,
    target_session_reference_value: 'others',
    provider_status_value: providerStatus,
    provider_reference_value: providerReference,
    failure_code_value: failureCode,
    reason_value: reason,
    requested_by_user_uuid: context.userId
  });
  if (error || !data) throw new SecurityProtectionError('security_operation_failed', 500);
  return String(data);
}

export async function revokeOtherSecuritySessions(
  context: SecurityRequestContext,
  input: { reason: string; grantId: string }
) {
  const validGrant = await hasValidStepUpGrant(context, input.grantId, 'session.revoke_others', null);
  if (!validGrant) throw new SecurityProtectionError('security_operation_failed', 403);

  const jwt = currentJwt(context);
  const providerReference = currentSessionId(jwt);
  const requestEvidenceId = await recordOutcome(context, 'requested', input.reason, null, null);

  // Supabase Auth performs the provider operation. The browser never supplies another session token.
  const { error: providerError } = await context.adminClient.auth.admin.signOut(jwt, 'others');
  if (providerError) {
    const failureCode = String((providerError as { code?: string; status?: number }).code || providerError.status || 'supabase_signout_failed');
    const outcomeEvidenceId = await recordOutcome(context, 'provider_failed', input.reason, null, failureCode);
    return { providerStatus: 'provider_failed' as const, failureCode, requestEvidenceId, outcomeEvidenceId };
  }

  const outcomeEvidenceId = await recordOutcome(context, 'provider_succeeded', input.reason, providerReference, null);
  return { providerStatus: 'provider_succeeded' as const, providerReference, requestEvidenceId, outcomeEvidenceId };
}
