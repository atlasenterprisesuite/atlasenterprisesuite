import { describe, expect, it } from 'vitest';
import {
  OTP_MAX_ATTEMPTS,
  OTP_MAX_RESENDS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_SECONDS,
  VERIFICATION_GRANT_TTL_SECONDS,
  canResend,
  challengeState,
  nextAttemptState
} from '../../packages/insurance/verification';

describe('ATLAS Insurance verification domain', () => {
  it('defines the approved verification timing and limit constants', () => {
    expect(OTP_TTL_SECONDS).toBe(600);
    expect(OTP_MAX_ATTEMPTS).toBe(5);
    expect(OTP_RESEND_COOLDOWN_SECONDS).toBe(60);
    expect(OTP_MAX_RESENDS).toBe(3);
    expect(VERIFICATION_GRANT_TTL_SECONDS).toBe(900);
  });

  it('classifies active, expired, consumed, and locked challenges deterministically', () => {
    const now = new Date('2026-09-15T17:10:01Z');
    expect(challengeState({ now, expiresAt: new Date('2026-09-15T17:20:00Z'), consumedAt: null, attemptCount: 0 })).toBe('active');
    expect(challengeState({ now, expiresAt: new Date('2026-09-15T17:10:00Z'), consumedAt: null, attemptCount: 0 })).toBe('expired');
    expect(challengeState({ now, expiresAt: new Date('2026-09-15T17:20:00Z'), consumedAt: new Date('2026-09-15T17:05:00Z'), attemptCount: 0 })).toBe('consumed');
    expect(challengeState({ now, expiresAt: new Date('2026-09-15T17:20:00Z'), consumedAt: null, attemptCount: 5 })).toBe('locked');
  });

  it('locks on the fifth failed attempt', () => {
    expect(nextAttemptState(0)).toEqual({ attemptCount: 1, locked: false });
    expect(nextAttemptState(4)).toEqual({ attemptCount: 5, locked: true });
    expect(nextAttemptState(5)).toEqual({ attemptCount: 5, locked: true });
  });

  it('enforces resend cooldown before resend limit', () => {
    expect(canResend({ elapsedSeconds: 59, resendCount: 0 })).toEqual({ allowed: false, reason: 'resend_cooldown' });
    expect(canResend({ elapsedSeconds: 60, resendCount: 0 })).toEqual({ allowed: true, reason: null });
    expect(canResend({ elapsedSeconds: 61, resendCount: 3 })).toEqual({ allowed: false, reason: 'resend_limit_reached' });
  });
});
