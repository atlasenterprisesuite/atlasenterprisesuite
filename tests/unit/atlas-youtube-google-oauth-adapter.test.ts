import { describe, expect, it } from 'vitest';
import {
  destroyYouTubeTokenResponse,
  exchangeYouTubeAuthorizationCode,
  fetchAuthorizedYouTubeChannel,
} from '../../supabase/functions/_shared/youtube-google-oauth';

const UPLOAD = 'https://www.googleapis.com/auth/youtube.upload';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('ATLAS YouTube Google OAuth adapter', () => {
  it('exchanges a code using the official token endpoint and requires upload scope', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return jsonResponse({
        access_token: 'access-secret',
        refresh_token: 'refresh-secret',
        expires_in: 3600,
        scope: UPLOAD,
        token_type: 'Bearer',
      });
    }) as typeof fetch;

    const token = await exchangeYouTubeAuthorizationCode({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'https://atlas.example/oauth/callback',
      code: 'authorization-code',
      codeVerifier: 'pkce-verifier',
      fetchImpl,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://oauth2.googleapis.com/token');
    expect(calls[0].init?.method).toBe('POST');
    const body = new URLSearchParams(String(calls[0].init?.body));
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code_verifier')).toBe('pkce-verifier');
    expect(token.scopes).toEqual([UPLOAD]);
  });

  it('fails closed when refresh token or YouTube upload scope is absent', async () => {
    const noRefresh = (async () => jsonResponse({
      access_token: 'a',
      expires_in: 3600,
      scope: UPLOAD,
      token_type: 'Bearer',
    })) as typeof fetch;
    await expect(exchangeYouTubeAuthorizationCode({
      clientId: 'client-id', clientSecret: 'client-secret',
      redirectUri: 'https://atlas.example/callback', code: 'code', fetchImpl: noRefresh,
    })).rejects.toThrow(/incomplete/i);

    const noScope = (async () => jsonResponse({
      access_token: 'a',
      refresh_token: 'r',
      expires_in: 3600,
      scope: 'openid',
      token_type: 'Bearer',
    })) as typeof fetch;
    await expect(exchangeYouTubeAuthorizationCode({
      clientId: 'client-id', clientSecret: 'client-secret',
      redirectUri: 'https://atlas.example/callback', code: 'code', fetchImpl: noScope,
    })).rejects.toThrow(/scope/i);
  });

  it('verifies exactly one provider-authorized YouTube channel', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string | URL | Request) => {
      calls.push(String(url));
      return jsonResponse({ items: [{ id: 'UC123', snippet: { title: 'ATLAS Test' } }] });
    }) as typeof fetch;

    await expect(fetchAuthorizedYouTubeChannel({
      accessToken: 'access-secret',
      fetchImpl,
    })).resolves.toEqual({ id: 'UC123', title: 'ATLAS Test' });

    const url = new URL(calls[0]);
    expect(url.origin + url.pathname).toBe('https://www.googleapis.com/youtube/v3/channels');
    expect(url.searchParams.get('mine')).toBe('true');
  });

  it('rejects ambiguous channel authorization instead of guessing', async () => {
    for (const items of [[], [
      { id: 'UC1', snippet: { title: 'One' } },
      { id: 'UC2', snippet: { title: 'Two' } },
    ]]) {
      const fetchImpl = (async () => jsonResponse({ items })) as typeof fetch;
      await expect(fetchAuthorizedYouTubeChannel({
        accessToken: 'access-secret',
        fetchImpl,
      })).rejects.toThrow(/exactly one channel/i);
    }
  });

  it('destroys token material held by the adapter after persistence/use', () => {
    const token = {
      accessToken: 'a',
      refreshToken: 'r',
      expiresIn: 3600,
      scopes: [UPLOAD],
      tokenType: 'Bearer',
    };
    destroyYouTubeTokenResponse(token);
    expect(token).toEqual({
      accessToken: '',
      refreshToken: '',
      expiresIn: 0,
      scopes: [],
      tokenType: '',
    });
  });
});
