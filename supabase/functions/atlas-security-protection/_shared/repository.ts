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
