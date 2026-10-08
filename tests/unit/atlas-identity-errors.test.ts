import { describe, expect, it } from 'vitest';
import { identityErrorMessage } from '../../apps/web/src/identity/identityErrors';

describe('ATLAS Identity safe error guidance', () => {
  it('distinguishes invalid credentials without revealing backend details', () => {
    expect(identityErrorMessage(new Error('Invalid login credentials'), 'sign_in'))
      .toBe('The email or password is incorrect.');
  });

  it('distinguishes missing organization access', () => {
    expect(identityErrorMessage(new Error('no_active_organization'), 'organization'))
      .toContain('no active ATLAS organization');
  });

  it('explains unconfirmed email and throttling', () => {
    expect(identityErrorMessage(new Error('Email not confirmed'), 'sign_in'))
      .toContain('Confirm your email');
    expect(identityErrorMessage(new Error('Too many requests'), 'sign_in'))
      .toContain('Too many sign-in attempts');
  });

  it('explains network failures for either authentication stage', () => {
    for (const phase of ['sign_in', 'organization'] as const) {
      expect(identityErrorMessage(new TypeError('Failed to fetch'), phase))
        .toContain('could not reach');
    }
  });

  it('does not leak raw Supabase or PostgREST errors to a browser user', () => {
    const sensitive = 'PGRST200 relation organizations schema cache internal';
    const message = identityErrorMessage(new Error(sensitive), 'organization');
    expect(message).toContain('organization');
    expect(message).not.toContain('PGRST200');
    expect(message).not.toContain('schema cache');
    expect(identityErrorMessage(new Error(sensitive), 'sign_in')).not.toContain('PGRST200');
  });

  it('preserves session-expiry guidance', () => {
    expect(identityErrorMessage(new Error('session_expired'), 'organization'))
      .toContain('session is no longer valid');
  });
});
