import { describe, expect, it } from 'vitest';
import {
  HubSpotOAuthError,
  buildHubSpotAuthorizationUrl,
  exchangeHubSpotCode,
  introspectHubSpotToken,
  refreshHubSpotToken,
  revokeHubSpotToken,
  type HubSpotFetch
} from '../../supabase/functions/_shared/hubspot-oauth';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) }
  });
}

const successToken = {
  access_token: 'fake-access-token',
  refresh_token: 'fake-refresh-token',
  token_type: 'Bearer',
  expires_in: 1800,
  hub_id: 247228429,
  user_id: 98173214,
  scopes: ['crm.objects.contacts.read']
};

describe('HubSpot OAuth 2026-03 client', () => {
  it('builds the unchanged HubSpot install URL with encoded state and scopes', () => {
    const url = new URL(
      buildHubSpotAuthorizationUrl({
        clientId: 'client',
        redirectUri: 'https://www.atlasenterprisesuite.com/api/integrations/hubspot/callback',
        state: 'state-1',
        scopes: ['crm.objects.contacts.read', 'crm.objects.contacts.read']
      })
    );

    expect(url.origin + url.pathname).toBe('https://app.hubspot.com/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('client');
    expect(url.searchParams.get('state')).toBe('state-1');
    expect(url.searchParams.get('scope')).toBe('crm.objects.contacts.read');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://www.atlasenterprisesuite.com/api/integrations/hubspot/callback'
    );
  });

  it('exchanges an authorization code using only form-encoded sensitive fields', async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    const fetchImpl: HubSpotFetch = async (input, init) => {
      seen.url = String(input);
      seen.init = init;
      return jsonResponse(successToken);
    };

    const token = await exchangeHubSpotCode({
      clientId: 'client-id',
      clientSecret: 'fake-client-secret',
      redirectUri: 'https://www.atlasenterprisesuite.com/api/integrations/hubspot/callback',
      code: 'fake-auth-code',
      fetchImpl
    });

    expect(seen.url).toBe('https://api.hubapi.com/oauth/2026-03/token');
    expect(seen.url).not.toContain('fake-client-secret');
    const body = new URLSearchParams(String(seen.init?.body));
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('client_secret')).toBe('fake-client-secret');
    expect(body.get('code')).toBe('fake-auth-code');
    expect(token).toMatchObject({
      accessToken: 'fake-access-token',
      refreshToken: 'fake-refresh-token',
      expiresIn: 1800,
      hubId: '247228429',
      userId: '98173214'
    });
  });

  it('refreshes tokens using the same date-based token endpoint', async () => {
    const fetchImpl: HubSpotFetch = async (input, init) => {
      expect(String(input)).toBe('https://api.hubapi.com/oauth/2026-03/token');
      const body = new URLSearchParams(String(init?.body));
      expect(body.get('grant_type')).toBe('refresh_token');
      expect(body.get('refresh_token')).toBe('fake-refresh-token');
      return jsonResponse({ ...successToken, access_token: 'fake-access-token-2' });
    };

    const token = await refreshHubSpotToken({
      clientId: 'client-id',
      clientSecret: 'fake-client-secret',
      refreshToken: 'fake-refresh-token',
      fetchImpl
    });
    expect(token.accessToken).toBe('fake-access-token-2');
  });

  it('introspects access tokens without placing the token in the URL', async () => {
    const fetchImpl: HubSpotFetch = async (input, init) => {
      expect(String(input)).toBe('https://api.hubapi.com/oauth/2026-03/token/introspect');
      expect(String(input)).not.toContain('fake-access-token');
      const body = new URLSearchParams(String(init?.body));
      expect(body.get('token')).toBe('fake-access-token');
      expect(body.get('token_type_hint')).toBe('access_token');
      return jsonResponse({
        active: true,
        hub_id: 247228429,
        user_id: 98173214,
        client_id: 'client-id',
        hub_domain: 'example.test',
        scopes: ['crm.objects.contacts.read'],
        token_use: 'access_token',
        token_type: 'Bearer',
        expires_in: 1700
      });
    };

    await expect(
      introspectHubSpotToken({
        clientId: 'client-id',
        clientSecret: 'fake-client-secret',
        token: 'fake-access-token',
        tokenTypeHint: 'access_token',
        fetchImpl
      })
    ).resolves.toMatchObject({
      active: true,
      hubId: '247228429',
      userId: '98173214',
      tokenUse: 'access_token'
    });
  });

  it('revokes refresh tokens through the date-based revoke endpoint', async () => {
    const fetchImpl: HubSpotFetch = async (input, init) => {
      expect(String(input)).toBe('https://api.hubapi.com/oauth/2026-03/token/revoke');
      const body = new URLSearchParams(String(init?.body));
      expect(body.get('token')).toBe('fake-refresh-token');
      expect(body.get('token_type_hint')).toBe('refresh_token');
      return new Response(null, { status: 204 });
    };

    await expect(
      revokeHubSpotToken({
        clientId: 'client-id',
        clientSecret: 'fake-client-secret',
        token: 'fake-refresh-token',
        fetchImpl
      })
    ).resolves.toBeUndefined();
  });

  it.each([
    [401, 'invalid_client'],
    [403, 'forbidden']
  ] as const)('maps HTTP %s to a safe typed error', async (status, code) => {
    const leakedToken = 'fake-token-must-not-leak';
    const fetchImpl: HubSpotFetch = async () =>
      jsonResponse(
        { error: code, error_description: `provider echoed ${leakedToken}` },
        { status }
      );

    try {
      await introspectHubSpotToken({
        clientId: 'client-id',
        clientSecret: 'fake-client-secret',
        token: leakedToken,
        tokenTypeHint: 'access_token',
        fetchImpl
      });
      throw new Error('Expected OAuth request to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(HubSpotOAuthError);
      expect((error as HubSpotOAuthError).code).toBe(code);
      expect(String(error)).not.toContain(leakedToken);
    }
  });

  it('preserves retry metadata for throttling without surfacing provider response bodies', async () => {
    const leakedToken = 'fake-rate-limit-token';
    const fetchImpl: HubSpotFetch = async () =>
      jsonResponse(
        { message: `do not expose ${leakedToken}` },
        { status: 429, headers: { 'retry-after': '9' } }
      );

    try {
      await refreshHubSpotToken({
        clientId: 'client-id',
        clientSecret: 'fake-client-secret',
        refreshToken: leakedToken,
        fetchImpl
      });
      throw new Error('Expected throttling error');
    } catch (error) {
      expect(error).toBeInstanceOf(HubSpotOAuthError);
      expect((error as HubSpotOAuthError).code).toBe('rate_limited');
      expect((error as HubSpotOAuthError).retryAfterSeconds).toBe(9);
      expect(String(error)).not.toContain(leakedToken);
    }
  });

  it('rejects malformed success responses rather than inventing token values', async () => {
    const fetchImpl: HubSpotFetch = async () => jsonResponse({ expires_in: 1800 });
    await expect(
      exchangeHubSpotCode({
        clientId: 'client-id',
        clientSecret: 'fake-client-secret',
        redirectUri: 'https://www.atlasenterprisesuite.com/callback',
        code: 'fake-code',
        fetchImpl
      })
    ).rejects.toMatchObject({ code: 'malformed_response' });
  });
});
