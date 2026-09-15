import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.95.0';
import { OTP_MAX_ATTEMPTS, VERIFICATION_GRANT_TTL_SECONDS } from '../../../../packages/insurance/verification.ts';
import { insuranceError } from './errors.ts';

export type ChallengeRecord = {
  id: string;
  org_id: string;
  user_id: string;
  scope: 'insurance_access' | 'member_policy';
  resource_id: string | null;
  code_hash: string;
  delivery_channel: 'email';
  delivery_target_masked: string;
  expires_at: string;
  consumed_at: string | null;
  attempt_count: number;
  resend_count: number;
  last_sent_at: string;
  created_at: string;
  updated_at: string;
};

export type NewChallenge = {
  id: string;
  orgId: string;
  userId: string;
  scope: ChallengeRecord['scope'];
  resourceId: string | null;
  codeHash: string;
  deliveryTargetMasked: string;
  expiresAt: string;
  lastSentAt: string;
};

const CHALLENGE_FIELDS = 'id,org_id,user_id,scope,resource_id,code_hash,delivery_channel,delivery_target_masked,expires_at,consumed_at,attempt_count,resend_count,last_sent_at,created_at,updated_at';

export async function createChallenge(admin: SupabaseClient, input: NewChallenge) {
  const { data, error } = await admin
    .from('insurance_verification_challenges')
    .insert({
      id: input.id,
      org_id: input.orgId,
      user_id: input.userId,
      scope: input.scope,
      resource_id: input.resourceId,
      code_hash: input.codeHash,
      delivery_channel: 'email',
      delivery_target_masked: input.deliveryTargetMasked,
      expires_at: input.expiresAt,
      attempt_count: 0,
      resend_count: 0,
      last_sent_at: input.lastSentAt
    })
    .select(CHALLENGE_FIELDS)
    .single();
  if (error || !data) throw insuranceError('persistence_failed', 500);
  return data as ChallengeRecord;
}

export async function deleteChallenge(admin: SupabaseClient, orgId: string, userId: string, challengeId: string) {
  const { error } = await admin
    .from('insurance_verification_challenges')
    .delete()
    .eq('id', challengeId)
    .eq('org_id', orgId)
    .eq('user_id', userId);
  if (error) throw insuranceError('persistence_failed', 500);
}

export async function loadChallenge(admin: SupabaseClient, orgId: string, userId: string, challengeId: string) {
  const { data, error } = await admin
    .from('insurance_verification_challenges')
    .select(CHALLENGE_FIELDS)
    .eq('id', challengeId)
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (error) throw insuranceError('persistence_failed', 500);
  if (!data) throw insuranceError('verification_required', 404);
  return data as ChallengeRecord;
}

export async function registerFailedAttempt(admin: SupabaseClient, challenge: ChallengeRecord) {
  const { error } = await admin.rpc('increment_insurance_verification_attempt', {
    p_challenge_id: challenge.id,
    p_org_id: challenge.org_id,
    p_user_id: challenge.user_id
  });
  if (error) throw insuranceError('persistence_failed', 500);
  return loadChallenge(admin, challenge.org_id, challenge.user_id, challenge.id);
}

export async function rotateChallenge(admin: SupabaseClient, challenge: ChallengeRecord, input: {
  codeHash: string;
  deliveryTargetMasked: string;
  expiresAt: string;
  lastSentAt: string;
  resendCount: number;
}) {
  const { data, error } = await admin
    .from('insurance_verification_challenges')
    .update({
      code_hash: input.codeHash,
      delivery_target_masked: input.deliveryTargetMasked,
      expires_at: input.expiresAt,
      last_sent_at: input.lastSentAt,
      resend_count: input.resendCount,
      attempt_count: 0,
      updated_at: input.lastSentAt
    })
    .eq('id', challenge.id)
    .eq('org_id', challenge.org_id)
    .eq('user_id', challenge.user_id)
    .eq('code_hash', challenge.code_hash)
    .eq('resend_count', challenge.resend_count)
    .is('consumed_at', null)
    .select(CHALLENGE_FIELDS)
    .maybeSingle();
  if (error) throw insuranceError('persistence_failed', 500);
  return data as ChallengeRecord | null;
}

export async function restoreChallengeRotation(admin: SupabaseClient, before: ChallengeRecord, rotated: ChallengeRecord) {
  const { error } = await admin
    .from('insurance_verification_challenges')
    .update({
      code_hash: before.code_hash,
      delivery_target_masked: before.delivery_target_masked,
      expires_at: before.expires_at,
      last_sent_at: before.last_sent_at,
      resend_count: before.resend_count,
      attempt_count: before.attempt_count,
      updated_at: new Date().toISOString()
    })
    .eq('id', rotated.id)
    .eq('org_id', rotated.org_id)
    .eq('user_id', rotated.user_id)
    .eq('code_hash', rotated.code_hash)
    .eq('resend_count', rotated.resend_count)
    .is('consumed_at', null);
  if (error) throw insuranceError('persistence_failed', 500);
}

export async function consumeChallengeAndCreateGrant(admin: SupabaseClient, challenge: ChallengeRecord) {
  const verifiedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + VERIFICATION_GRANT_TTL_SECONDS * 1000).toISOString();
  const { data, error } = await admin.rpc('finalize_insurance_verification_grant', {
    p_challenge_id: challenge.id,
    p_org_id: challenge.org_id,
    p_user_id: challenge.user_id,
    p_verified_at: verifiedAt,
    p_expires_at: expiresAt
  });

  if (error) throw insuranceError('persistence_failed', 500);
  const grant = Array.isArray(data) ? data[0] : data;
  if (grant) {
    return grant as {
      scope: ChallengeRecord['scope'];
      resource_id: string | null;
      verified_at: string;
      expires_at: string;
    };
  }

  const latest = await loadChallenge(admin, challenge.org_id, challenge.user_id, challenge.id);
  if (latest.consumed_at) throw insuranceError('challenge_consumed', 409);
  if (Number(latest.attempt_count) >= OTP_MAX_ATTEMPTS) throw insuranceError('challenge_locked', 423);
  if (new Date(latest.expires_at).getTime() <= Date.now()) throw insuranceError('challenge_expired', 410);
  throw insuranceError('persistence_failed', 500);
}

export async function writeInsuranceAudit(admin: SupabaseClient, input: {
  orgId: string;
  userId: string;
  challengeId: string | null;
  scope: ChallengeRecord['scope'];
  resourceId: string | null;
  action: 'issue' | 'resend' | 'verify_success' | 'verify_failure' | 'lockout' | 'delivery_configuration_failure' | 'delivery_failure';
  errorCode?: string | null;
}) {
  const { error } = await admin.from('insurance_verification_audit').insert({
    org_id: input.orgId,
    user_id: input.userId,
    challenge_id: input.challengeId,
    scope: input.scope,
    resource_id: input.resourceId,
    action: input.action,
    error_code: input.errorCode || null
  });
  if (error) throw insuranceError('persistence_failed', 500);
}
