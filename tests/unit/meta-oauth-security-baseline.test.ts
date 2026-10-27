import { describe, expect, it } from 'vitest';
import { buildHubSpotAuthorizationUrl } from '../../supabase/functions/_shared/hubspot-oauth';
import { buildSalesforceAuthorizationUrl } from '../../supabase/functions/_shared/salesforce-oauth';

// Offline-only regression tests. No authorization URL is fetched and no token is exchanged.
// These assert reusable provider URL construction, NOT Meta OAuth readiness.
describe('OAuth security baseline for future Meta adapter (offline)', () => {
  const redirectUri = 'https://atlas.example.test/oauth/callback';
  const state = 'isolated-state-placeholder';

  it('requires a CSRF state before building HubSpot authorization', () => {
    expect(() => buildHubSpotAuthorizationUrl({
      clientId: 'test-client', redirectUri, state: '', scopes: ['crm.objects.contacts.read']
    })).toThrow();
  });

  it('requires a CSRF state before building Salesforce authorization', () => {
    expect(() => buildSalesforceAuthorizationUrl({
      clientId: 'test-client', redirectUri, state: '', scopes: ['api']
    })).toThrow();
  });

  it('does not silently request an empty scope set', () => {
    expect(() => buildHubSpotAuthorizationUrl({
      clientId: 'test-client', redirectUri, state, scopes: []
    })).toThrow();
    expect(() => buildSalesforceAuthorizationUrl({
      clientId: 'test-client', redirectUri, state, scopes: []
    })).toThrow();
  });

  it('preserves the exact configured callback and state', () => {
    for (const build of [buildHubSpotAuthorizationUrl, buildSalesforceAuthorizationUrl]) {
      const url = new URL(build({ clientId: 'test-client', redirectUri, state, scopes: ['api'] }));
      expect(url.searchParams.get('redirect_uri')).toBe(redirectUri);
      expect(url.searchParams.get('state')).toBe(state);
    }
  });

  it('uses S256 for a Salesforce PKCE challenge when supplied', () => {
    const url = new URL(buildSalesforceAuthorizationUrl({
      clientId: 'test-client', redirectUri, state, scopes: ['api'],
      codeChallenge: 'offline-code-challenge'
    }));
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe('offline-code-challenge');
  });

  it('does not claim that an opaque Facebook authorization URL proves any granted permissions', () => {
    const url = new URL('https://m.facebook.com/v24.0/dialog/oauth?encrypted_query_string=opaque');
    expect(url.hostname).toBe('m.facebook.com');
    expect(url.searchParams.has('encrypted_query_string')).toBe(true);
    expect(url.searchParams.has('scope')).toBe(false);
    expect(url.searchParams.has('client_id')).toBe(false);
    expect(url.searchParams.has('redirect_uri')).toBe(false);
  });
});
