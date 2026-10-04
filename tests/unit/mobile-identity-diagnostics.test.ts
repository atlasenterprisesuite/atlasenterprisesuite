import { describe, expect, it } from 'vitest';
import {
  classifyIdentityDiagnostics,
  serializeIdentityDiagnostics
} from '../../apps/web/src/mobile/identityDiagnostics';

describe('ATLAS mobile identity diagnostics', () => {
  it('verifies only current authenticated session plus resolved organization', () => {
    expect(classifyIdentityDiagnostics({
      authenticated: true,
      organizationResolved: true,
      sessionState: 'current'
    })).toBe('verified');
  });

  it('marks an expired session expired even if stale flags are optimistic', () => {
    expect(classifyIdentityDiagnostics({
      authenticated: true,
      organizationResolved: true,
      sessionState: 'expired'
    })).toBe('expired');
  });

  it('fails unknown evidence closed to unverified', () => {
    expect(classifyIdentityDiagnostics({
      authenticated: null,
      organizationResolved: null,
      sessionState: 'unknown'
    })).toBe('unverified');
  });

  it('distinguishes unavailable and error states', () => {
    expect(classifyIdentityDiagnostics({
      authenticated: null,
      organizationResolved: null,
      sessionState: 'unavailable'
    })).toBe('unavailable');

    expect(classifyIdentityDiagnostics({
      authenticated: null,
      organizationResolved: null,
      sessionState: 'error'
    })).toBe('error');
  });

  it('serializes only safe metadata and never arbitrary secret-like fields', () => {
    const serialized = serializeIdentityDiagnostics({
      authenticated: true,
      organizationResolved: true,
      sessionState: 'current',
      identityProvider: 'supabase',
      role: 'owner',
      organizationId: 'org-123',
      rawToken: 'secret-token',
      cookie: 'secret-cookie',
      authorization: 'secret-header'
    } as never);

    expect(serialized).toEqual({
      state: 'verified',
      authenticated: true,
      organizationResolved: true,
      identityProvider: 'supabase',
      role: 'owner',
      organizationId: 'org-123'
    });
    expect(JSON.stringify(serialized)).not.toMatch(/secret|token|cookie|authorization/i);
  });
});
