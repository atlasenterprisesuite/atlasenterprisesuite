import { describe, expect, it, vi } from 'vitest';
import { completeHubSpotConnection } from '../../supabase/functions/_shared/hubspot-connection-lifecycle';
import { completeSalesforceConnection } from '../../supabase/functions/_shared/salesforce-connection-lifecycle';

// Mock-only regression tests against existing CRM OAuth lifecycle contracts.
// They do not authorize Meta, exchange a real code, or contact production.
const now = Date.parse('2026-10-26T12:00:00.000Z');
const stateRow = {
  id: 'state-1', org_id: 'org-a', user_id: 'user-a',
  requested_permissions: ['api'], consumed_at: null,
  expires_at: new Date(now + 60_000).toISOString()
};
function fixture(override: Record<string, unknown> | null = {}) {
  const findOAuthState = vi.fn().mockResolvedValue(override === null ? null : { ...stateRow, ...override });
  const consumeOAuthState = vi.fn().mockResolvedValue(true);
  const recordEvidence = vi.fn().mockResolvedValue(undefined);
  const exchangeCode = vi.fn();
  const store = { findOAuthState, consumeOAuthState, recordEvidence };
  const deps = {
    store, now: () => now, clientId: 'offline-client',
    clientSecret: 'offline-secret', redirectUri: 'https://atlas.example.test/callback',
    credentialKey: new Uint8Array(32), oauth: { exchangeCode }
  };
  return { deps, findOAuthState, consumeOAuthState, recordEvidence, exchangeCode };
}
describe('OAuth callback negative lifecycle contracts (offline)', () => {
  for (const [provider, complete] of [
    ['HubSpot', completeHubSpotConnection],
    ['Salesforce', completeSalesforceConnection]
  ] as const) {
    it(`${provider} rejects unknown state before token exchange`, async () => {
      const f = fixture(null);
      await expect(complete({ state: 'unknown', code: 'offline-code', deps: f.deps as never }))
        .rejects.toMatchObject({ code: 'oauth_state_invalid', status: 400 });
      expect(f.consumeOAuthState).not.toHaveBeenCalled();
      expect(f.exchangeCode).not.toHaveBeenCalled();
    });
    it(`${provider} rejects expired state before token exchange`, async () => {
      const f = fixture({ expires_at: new Date(now - 1).toISOString() });
      await expect(complete({ state: 'expired', code: 'offline-code', deps: f.deps as never }))
        .rejects.toMatchObject({ code: 'oauth_state_expired', status: 400 });
      expect(f.consumeOAuthState).not.toHaveBeenCalled();
      expect(f.exchangeCode).not.toHaveBeenCalled();
    });
    it(`${provider} rejects previously consumed state`, async () => {
      const f = fixture({ consumed_at: new Date(now - 1000).toISOString() });
      await expect(complete({ state: 'replay', code: 'offline-code', deps: f.deps as never }))
        .rejects.toMatchObject({ code: 'oauth_state_consumed', status: 400 });
      expect(f.exchangeCode).not.toHaveBeenCalled();
    });
    it(`${provider} fails closed when atomic claim loses a race`, async () => {
      const f = fixture();
      f.consumeOAuthState.mockResolvedValue(false);
      await expect(complete({ state: 'racing', code: 'offline-code', deps: f.deps as never }))
        .rejects.toMatchObject({ code: 'oauth_state_consumption_failed', status: 409 });
      expect(f.exchangeCode).not.toHaveBeenCalled();
    });
    it(`${provider} allows at most one concurrent callback past atomic claim`, async () => {
      const f = fixture();
      let consumed = false;
      f.consumeOAuthState.mockImplementation(async () => {
        if (consumed) return false;
        consumed = true;
        return true;
      });
      // First request will fail during offline exchange; second must fail at claim.
      const results = await Promise.allSettled([
        complete({ state: 'same', code: 'offline-code', deps: f.deps as never }),
        complete({ state: 'same', code: 'offline-code', deps: f.deps as never })
      ]);
      expect(results.every(r => r.status === 'rejected')).toBe(true);
      expect(f.consumeOAuthState).toHaveBeenCalledTimes(2);
      expect(f.exchangeCode).not.toHaveBeenCalled();
    });
  }
});
