import type { SecurityRequestContext } from './context.ts';
import { SecurityProtectionError } from './errors.ts';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function bytesToPostgresBytea(bytes: Uint8Array): string {
  return `\\x${Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function postgresByteaToBytes(value: string): Uint8Array {
  const hex = value.startsWith('\\x') ? value.slice(2) : value;
  const bytes = new Uint8Array(Math.floor(hex.length / 2));
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

async function sha256Reference(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export type ChallengePurpose = 'registration' | 'authentication';

export async function createChallenge(
  context: SecurityRequestContext,
  purpose: ChallengePurpose,
  challenge: string,
  actionCode: string | null,
  deviceId: string | null
) {
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
  const { data, error } = await context.adminClient
    .from('security_webauthn_challenges')
    .insert({
      org_id: context.orgId,
      user_id: context.userId,
      purpose,
      challenge,
      expected_action: actionCode,
      device_id: deviceId,
      expires_at: expiresAt
    })
    .select('id,challenge,purpose,expected_action,device_id,expires_at,consumed_at')
    .single();

  if (error || !data) throw new SecurityProtectionError('security_operation_failed', 500);
  return data;
}

export async function consumeChallenge(
  context: SecurityRequestContext,
  purpose: ChallengePurpose,
  challengeId: string
) {
  const now = new Date().toISOString();
  const { data: existing, error: readError } = await context.adminClient
    .from('security_webauthn_challenges')
    .select('id,org_id,user_id,purpose,challenge,expected_action,device_id,expires_at,consumed_at')
    .eq('id', challengeId)
    .eq('org_id', context.orgId)
    .eq('user_id', context.userId)
    .eq('purpose', purpose)
    .is('consumed_at', null)
    .gt('expires_at', now)
    .maybeSingle();

  if (readError || !existing) throw new SecurityProtectionError('challenge_invalid_or_expired', 400);

  const { data, error } = await context.adminClient
    .from('security_webauthn_challenges')
    .update({ verification_attempted_at: now, consumed_at: now })
    .eq('id', challengeId)
    .eq('org_id', context.orgId)
    .eq('user_id', context.userId)
    .is('consumed_at', null)
    .select('id,challenge,expected_action,device_id')
    .single();

  if (error || !data) throw new SecurityProtectionError('challenge_invalid_or_expired', 400);
  return data;
}

export async function listActivePasskeys(context: SecurityRequestContext) {
  const { data, error } = await context.adminClient
    .from('security_passkeys')
    .select('id,credential_id,credential_public_key,counter,transports,device_type,backed_up,last_used_at')
    .eq('org_id', context.orgId)
    .eq('user_id', context.userId)
    .is('revoked_at', null)
    .order('created_at', { ascending: true });

  if (error) throw new SecurityProtectionError('security_operation_failed', 500);
  return data || [];
}

export async function getPasskeyByCredentialId(context: SecurityRequestContext, credentialId: string) {
  const { data, error } = await context.adminClient
    .from('security_passkeys')
    .select('id,credential_id,credential_public_key,counter,transports,device_type,backed_up,last_used_at')
    .eq('org_id', context.orgId)
    .eq('user_id', context.userId)
    .eq('credential_id', credentialId)
    .is('revoked_at', null)
    .maybeSingle();

  if (error || !data) throw new SecurityProtectionError('passkey_not_found', 404);
  return {
    ...data,
    credential_public_key_bytes: postgresByteaToBytes(String(data.credential_public_key || ''))
  };
}

export async function storeVerifiedPasskey(
  context: SecurityRequestContext,
  credential: {
    id: string;
    publicKey: Uint8Array;
    counter: number;
    transports?: string[];
    deviceType?: string;
    backedUp?: boolean;
  }
) {
  const { data, error } = await context.adminClient
    .from('security_passkeys')
    .insert({
      org_id: context.orgId,
      user_id: context.userId,
      credential_id: credential.id,
      credential_public_key: bytesToPostgresBytea(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports || [],
      device_type: credential.deviceType || null,
      backed_up: credential.backedUp === true,
      created_by: context.userId
    })
    .select('id,credential_id,counter,transports,device_type,backed_up,created_at')
    .single();

  if (error || !data) throw new SecurityProtectionError('security_operation_failed', 500);
  return data;
}

export async function updatePasskeyCounter(context: SecurityRequestContext, passkeyId: string, newCounter: number) {
  const { data, error } = await context.adminClient
    .from('security_passkeys')
    .update({ counter: newCounter, last_used_at: new Date().toISOString() })
    .eq('id', passkeyId)
    .eq('org_id', context.orgId)
    .eq('user_id', context.userId)
    .is('revoked_at', null)
    .select('id,counter,last_used_at')
    .single();

  if (error || !data) throw new SecurityProtectionError('security_operation_failed', 500);
  return data;
}

export async function recordRiskEventForStepUp(
  context: SecurityRequestContext,
  actionCode: string,
  deviceId: string | null
) {
  const { data, error } = await context.adminClient.rpc('record_security_risk_event', {
    organization_uuid: context.orgId,
    user_uuid: context.userId,
    device_uuid: deviceId,
    session_reference_value: null,
    action_code_value: actionCode,
    decision_value: 'allow',
    score_value: 0,
    reasons_value: ['passkey_verified'],
    signals_used_value: [{ signal: 'passkey', value: 'verified' }],
    signals_unknown_value: [],
    provider_evidence_value: { source: 'atlas-security-protection' },
    policy_version_value: 'security-protection-v1'
  });

  if (error || !data) throw new SecurityProtectionError('security_operation_failed', 500);
  return String(data);
}

export async function grantSecurityStepUp(
  context: SecurityRequestContext,
  actionCode: string,
  passkeyId: string,
  deviceId: string | null
) {
  const riskEventId = await recordRiskEventForStepUp(context, actionCode, deviceId);
  const { data, error } = await context.adminClient.rpc('grant_security_step_up', {
    organization_uuid: context.orgId,
    user_uuid: context.userId,
    device_uuid: deviceId,
    risk_event_uuid: riskEventId,
    passkey_uuid: passkeyId,
    action_code_value: actionCode
  });

  if (error || !data) throw new SecurityProtectionError('security_operation_failed', 500);
  return { grantId: String(data), riskEventId, expiresInSeconds: 10 * 60 };
}

export async function listSecurityDevices(context: SecurityRequestContext) {
  const { data, error } = await context.adminClient
    .from('security_devices')
    .select('id,org_id,user_id,display_name,platform_label,browser_label,status,first_seen_at,last_seen_at,trusted_at,trust_expires_at,revoked_at,compromised_at,trust_reason,evidence_json')
    .eq('org_id', context.orgId)
    .eq('user_id', context.userId)
    .order('last_seen_at', { ascending: false });
  if (error) throw new SecurityProtectionError('security_operation_failed', 500);
  return data || [];
}

export async function getSecurityDevice(context: SecurityRequestContext, deviceId: string) {
  const { data, error } = await context.adminClient
    .from('security_devices')
    .select('id,org_id,user_id,status,display_name,platform_label,browser_label,last_seen_at,evidence_json')
    .eq('id', deviceId)
    .eq('org_id', context.orgId)
    .eq('user_id', context.userId)
    .maybeSingle();
  if (error || !data) throw new SecurityProtectionError('invalid_request', 404);
  return data;
}

export async function trustSecurityDevice(context: SecurityRequestContext, deviceId: string, reason: string, grantId: string) {
  const { data, error } = await context.userClient.rpc('trust_security_device', {
    device_uuid: deviceId,
    reason_value: reason,
    grant_uuid: grantId
  });
  if (error || !data) throw new SecurityProtectionError('security_operation_failed', 400);
  return data;
}

export async function revokeSecurityDevice(context: SecurityRequestContext, deviceId: string, reason: string, grantId: string) {
  const { data, error } = await context.userClient.rpc('revoke_security_device', {
    device_uuid: deviceId,
    reason_value: reason,
    grant_uuid: grantId
  });
  if (error || !data) throw new SecurityProtectionError('security_operation_failed', 400);
  return data;
}

export async function hasValidStepUpGrant(
  context: SecurityRequestContext,
  grantId: string | null,
  actionCode: string,
  deviceId: string | null
): Promise<boolean> {
  if (!grantId) return false;
  let query = context.adminClient
    .from('security_step_up_grants')
    .select('id')
    .eq('id', grantId)
    .eq('org_id', context.orgId)
    .eq('user_id', context.userId)
    .eq('action_code', actionCode)
    .eq('method', 'passkey')
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString());
  if (deviceId) query = query.eq('device_id', deviceId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new SecurityProtectionError('security_operation_failed', 500);
  return Boolean(data?.id);
}

export async function recordRiskEvaluation(
  context: SecurityRequestContext,
  actionCode: string,
  deviceId: string | null,
  evaluation: {
    decision: string;
    score: number;
    reasons: string[];
    signalsUsed: string[];
    signalsUnknown: string[];
    policyVersion: string;
  }
) {
  const { data, error } = await context.adminClient.rpc('record_security_risk_event', {
    organization_uuid: context.orgId,
    user_uuid: context.userId,
    device_uuid: deviceId,
    session_reference_value: null,
    action_code_value: actionCode,
    decision_value: evaluation.decision,
    score_value: evaluation.score,
    reasons_value: evaluation.reasons,
    signals_used_value: evaluation.signalsUsed,
    signals_unknown_value: evaluation.signalsUnknown,
    provider_evidence_value: { network: 'unknown', location: 'unknown', sim: 'unknown' },
    policy_version_value: evaluation.policyVersion
  });
  if (error || !data) throw new SecurityProtectionError('security_operation_failed', 500);
  return String(data);
}

export async function authorizeProtectedAction(
  context: SecurityRequestContext,
  input: {
    actionCode: string;
    deviceId: string;
    grantId: string | null;
    riskEventId: string;
    targetReference?: string | null;
    configuredDelaySeconds?: number | null;
  }
) {
  const { data, error } = await context.userClient.rpc('authorize_security_protected_action', {
    action_code_value: input.actionCode,
    device_uuid: input.deviceId,
    grant_uuid: input.grantId,
    risk_event_uuid: input.riskEventId,
    target_reference_value: input.targetReference || null,
    configured_delay_seconds: input.configuredDelaySeconds || null
  });
  if (error || !data) throw new SecurityProtectionError('security_operation_failed', 400);
  return data;
}

export async function listSecurityDelays(context: SecurityRequestContext) {
  const { data, error } = await context.adminClient
    .from('security_action_delays')
    .select('id,org_id,user_id,action_code,target_reference,state,policy_version,created_at,not_before,expires_at,executed_at,cancelled_at,denied_at,transition_reason')
    .eq('org_id', context.orgId)
    .eq('user_id', context.userId)
    .order('created_at', { ascending: false });
  if (error) throw new SecurityProtectionError('security_operation_failed', 500);
  return data || [];
}

export async function cancelSecurityDelay(context: SecurityRequestContext, delayId: string, reason: string) {
  const { data, error } = await context.userClient.rpc('transition_security_action_delay', {
    delay_uuid: delayId,
    next_state: 'cancelled',
    reason_value: reason,
    downstream_success_evidence_value: null
  });
  if (error || !data) throw new SecurityProtectionError('security_operation_failed', 400);
  return data;
}

export async function getRecoveryStatus(context: SecurityRequestContext) {
  const { data, error } = await context.adminClient
    .from('security_recovery_events')
    .select('id,org_id,user_id,event_type,state,reason,created_at,evidence_json')
    .eq('org_id', context.orgId)
    .eq('user_id', context.userId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw new SecurityProtectionError('security_operation_failed', 500);
  const events = data || [];
  return {
    state: events[0]?.state || 'not_active',
    holdActive: events.some((event) => event.state === 'held' || event.state === 'verification_required'),
    events
  };
}

async function recordSessionRevocation(
  context: SecurityRequestContext,
  sessionReference: string,
  providerStatus: 'requested' | 'provider_succeeded' | 'provider_failed',
  reason: string,
  providerReference: string | null,
  failureCode: string | null
) {
  const { data, error } = await context.adminClient.rpc('record_security_session_revocation', {
    organization_uuid: context.orgId,
    user_uuid: context.userId,
    target_session_reference_value: sessionReference,
    provider_status_value: providerStatus,
    provider_reference_value: providerReference,
    failure_code_value: failureCode,
    reason_value: reason,
    requested_by_user_uuid: context.userId
  });
  if (error || !data) throw new SecurityProtectionError('security_operation_failed', 500);
  return String(data);
}

export async function revokeSecuritySession(
  context: SecurityRequestContext,
  input: { targetSessionToken: string; reason: string; grantId: string }
) {
  const validGrant = await hasValidStepUpGrant(context, input.grantId, 'session.revoke_others', null);
  if (!validGrant) throw new SecurityProtectionError('security_operation_failed', 403);
  if (!input.targetSessionToken) throw new SecurityProtectionError('invalid_request', 400);

  const digest = await sha256Reference(input.targetSessionToken);
  const sessionReference = `sha256:${digest}`;
  const requested = await context.adminClient.rpc('record_security_session_revocation', {
    organization_uuid: context.orgId,
    user_uuid: context.userId,
    target_session_reference_value: sessionReference,
    provider_status_value: 'requested',
    provider_reference_value: null,
    failure_code_value: null,
    reason_value: input.reason,
    requested_by_user_uuid: context.userId
  });
  if (requested.error) throw new SecurityProtectionError('security_operation_failed', 500);

  const { error: providerError } = await context.adminClient.auth.admin.signOut(input.targetSessionToken);
  if (providerError) {
    await context.adminClient.rpc('record_security_session_revocation', {
      organization_uuid: context.orgId,
      user_uuid: context.userId,
      target_session_reference_value: sessionReference,
      provider_status_value: 'provider_failed',
      provider_reference_value: null,
      failure_code_value: String(providerError.name || 'supabase_signout_failed'),
      reason_value: input.reason,
      requested_by_user_uuid: context.userId
    });
    return { providerStatus: 'provider_failed' as const, sessionReference };
  }

  const successId = await recordSessionRevocation(
    context,
    sessionReference,
    'provider_succeeded',
    input.reason,
    `supabase:${digest.slice(0, 16)}`,
    null
  );
  return { providerStatus: 'provider_succeeded' as const, sessionReference, evidenceId: successId };
}

export async function getSecuritySummary(context: SecurityRequestContext) {
  const [devices, passkeys, delays, recovery] = await Promise.all([
    listSecurityDevices(context),
    listActivePasskeys(context),
    listSecurityDelays(context),
    getRecoveryStatus(context)
  ]);
  return {
    devices,
    passkeys: passkeys.map(({ credential_public_key: _publicKey, ...passkey }) => passkey),
    delays,
    recovery,
    providerSignals: {
      networkReputation: 'unknown',
      locationConsistency: 'unknown',
      simEvidence: 'unknown'
    }
  };
}
