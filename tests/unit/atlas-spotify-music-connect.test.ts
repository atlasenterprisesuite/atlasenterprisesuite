import { describe, expect, it, vi } from 'vitest';
import { analyzeSpotifyLink } from '../../packages/creator/spotify/link';
import { createSpotifyPkceAuthorization, validateSpotifyCallback } from '../../packages/creator/spotify/oauth';
import { SpotifyApiError, SpotifyConnectClient } from '../../packages/creator/spotify/connect';

const id = '4iV5W9uYEdYUVa79Axb7Rh';
const clientId = '11111111111111111111111111111111';
const redirect = 'https://www.atlasenterprisesuite.com/oauth/spotify/callback';

describe('Spotify links: offline and fail-closed', () => {
  it('normalizes direct content without tracker query strings', () => {
    expect(analyzeSpotifyLink('https://open.spotify.com/track/' + id + '?si=tracking')).toEqual({
      kind: 'resource', resourceType: 'track', id, canonicalUrl: 'https://open.spotify.com/track/' + id
    });
  });
  it('recognizes localized album links', () => {
    expect(analyzeSpotifyLink('https://open.spotify.com/intl-es/album/' + id)).toMatchObject({ resourceType: 'album' });
  });
  it('never attributes a short link to invented music content', () => {
    expect(analyzeSpotifyLink('https://spotify.app.link/3dOvoRWr9ib?label=sp_cid')).toEqual({
      kind: 'short-link', code: '3dOvoRWr9ib', destinationVerified: false
    });
  });
  it.each([
    'http://open.spotify.com/track/' + id,
    'https://open.spotify.com.evil.invalid/track/' + id,
    'https://open.spotify.com/track/bad-id',
    'https://spotify.app.link/too/long',
    'https://evil.invalid/a',
    'not-a-url'
  ])('rejects untrusted or unsupported content %s', url => {
    expect(analyzeSpotifyLink(url).kind).toBe('unresolved');
  });
});

describe('Spotify authorization primitives (not a live connection)', () => {
  it('generates PKCE S256 challenge/state with minimal device permissions', async () => {
    const result = await createSpotifyPkceAuthorization(clientId, redirect);
    const url = new URL(result.authorizeUrl);
    expect(url.origin).toBe('https://accounts.spotify.com');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toHaveLength(43);
    expect(result.verifier.length).toBeGreaterThanOrEqual(43);
    expect(result.state.length).toBeGreaterThanOrEqual(20);
    expect(url.searchParams.get('scope')).toBe('user-read-playback-state user-modify-playback-state');
    expect(url.searchParams.has('client_secret')).toBe(false);
  });
  it('refuses excessive permissions and insecure redirects', async () => {
    await expect(createSpotifyPkceAuthorization(clientId, redirect, ['user-read-email'])).rejects.toThrow('scope');
    await expect(createSpotifyPkceAuthorization(clientId, 'http://example.com/callback')).rejects.toThrow('Redirect');
  });
  it('blocks CSRF, impostor host and duplicate callback parameters', () => {
    expect(() => validateSpotifyCallback(redirect + '?state=wrong&code=x', redirect, 'expected')).toThrow('state');
    expect(() => validateSpotifyCallback('https://evil.invalid/callback?state=s&code=x', redirect, 's')).toThrow('redirect');
    expect(() => validateSpotifyCallback(redirect + '?state=s&state=s&code=x', redirect, 's')).toThrow('state');
    expect(() => validateSpotifyCallback(redirect + '?state=s&code=x&code=y', redirect, 's')).toThrow('duplicate');
  });
  it('extracts code only on a verified callback', () => {
    expect(validateSpotifyCallback(redirect + '?state=s&code=abc', redirect, 's')).toBe('abc');
  });
});

describe('Spotify Connect transport requires separately authorized token injection', () => {
  it('lists devices with fixed Spotify origin and rejects redirects', async () => {
    const transport = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('https://api.spotify.com/v1/me/player/devices');
      expect(init?.redirect).toBe('error');
      expect((init?.headers as Record<string, string>).authorization).toBe('Bearer sample');
      return new Response(JSON.stringify({ devices: [{ id: 'd1', name: 'Phone', type: 'Smartphone', is_active: true, is_restricted: false }] }), { status: 200 });
    });
    const client = new SpotifyConnectClient(async () => 'sample', transport as typeof fetch);
    expect((await client.listDevices())[0].name).toBe('Phone');
  });
  it('transfers to one device with autoplay disabled by default', async () => {
    const transport = vi.fn(async (_: string | URL | Request, init?: RequestInit) => {
      expect(init?.method).toBe('PUT');
      expect(JSON.parse(String(init?.body))).toEqual({ device_ids: ['device-123'], play: false });
      return new Response(null, { status: 204 });
    });
    await new SpotifyConnectClient(async () => 'sample', transport as typeof fetch).transferPlayback('device-123');
  });
  it('fails closed on no token, bad device id or Premium/authorization errors', async () => {
    const unavailable = new SpotifyConnectClient(async () => '', vi.fn() as typeof fetch);
    await expect(unavailable.listDevices()).rejects.toThrow('unavailable');
    const forbidden = new SpotifyConnectClient(async () => 'sample', async () => new Response(null, { status: 403 }));
    await expect(forbidden.listDevices()).rejects.toBeInstanceOf(SpotifyApiError);
    await expect(forbidden.transferPlayback('bad\nid')).rejects.toThrow('Invalid Spotify device');
  });
});
