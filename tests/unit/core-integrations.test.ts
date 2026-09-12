import { describe, expect, it } from 'vitest';
import { canReportConnected, validateIntegrationAuthPolicy } from '../../packages/core/src';

describe('integration policy', () => {
  it('accepts oauth2 by default', () => {
    expect(validateIntegrationAuthPolicy({ kind: 'oauth2' })).toEqual({ ok: true });
  });

  it('rejects password auth without an approved exception', () => {
    expect(validateIntegrationAuthPolicy({ kind: 'password' })).toEqual({
      ok: false,
      reason: 'legacy_auth_not_approved'
    });
  });

  it('requires provider verification before connected', () => {
    expect(canReportConnected({ authorized: true, providerVerified: false })).toBe(false);
    expect(canReportConnected({ authorized: true, providerVerified: true })).toBe(true);
  });
});
