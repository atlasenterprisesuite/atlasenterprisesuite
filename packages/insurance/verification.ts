import type { InsuranceChallengeState, ResendDecision } from './types';

export const OTP_TTL_SECONDS = 600;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_MAX_RESENDS = 3;
export const VERIFICATION_GRANT_TTL_SECONDS = 900;

export function challengeState(input: {
  now: Date;
  expiresAt: Date;
  consumedAt: Date | null;
  attemptCount: number;
}): InsuranceChallengeState {
  if (input.consumedAt) return 'consumed';
  if (input.attemptCount >= OTP_MAX_ATTEMPTS) return 'locked';
  if (input.expiresAt.getTime() <= input.now.getTime()) return 'expired';
  return 'active';
}

export function nextAttemptState(attemptCount: number) {
  const normalized = Math.max(0, Math.min(OTP_MAX_ATTEMPTS, Math.trunc(attemptCount)));
  const next = Math.min(OTP_MAX_ATTEMPTS, normalized + 1);
  return {
    attemptCount: next,
    locked: next >= OTP_MAX_ATTEMPTS
  };
}

export function canResend(input: { elapsedSeconds: number; resendCount: number }): ResendDecision {
  if (input.resendCount >= OTP_MAX_RESENDS) {
    return { allowed: false, reason: 'resend_limit_reached' };
  }
  if (input.elapsedSeconds < OTP_RESEND_COOLDOWN_SECONDS) {
    return { allowed: false, reason: 'resend_cooldown' };
  }
  return { allowed: true, reason: null };
}
