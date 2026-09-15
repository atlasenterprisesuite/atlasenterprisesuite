import { describe, expect, it, vi } from 'vitest';
import {
  createMicrosoftAdapter,
  microsoftDefaultScopes,
  scopesForCapabilities
} from '../../supabase/functions/_shared/integrations/providers/microsoft';

describe('Microsoft Connected Apps adapter', () => {
  it('uses least-privilege default scopes and expands only requested capabilities', () => {
    expect(microsoftDefaultScopes).toEqual(['openid', 'profile', 'email', 'offline_access', 'User.Read']);
    expect(scopesForCapabilities(['microsoft.mail.read'])).toContain('Mail.Read');
    expect(scopesForCapabilities(['microsoft.profile.read'])).not.toContain('Mail.Read');
  });

  it('builds Authorization Code + PKCE URLs without secrets', () => {
    const adapter = createMicrosoftAdapter({
      clientId: 'client-id',
      redirectUri: 'https://atlas.example.test/functions/v1/atlas-integration-oauth'
    });
    const url = new URL(adapter.authorizationUrl({
      state: 'one-time-state',
      codeChallenge: 'pkce-challenge',
      capabilities: ['microsoft.profile.read']
    }));
    expect(url.origin + url.pathname).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe('pkce-challenge');
    expect(url.searchParams.get('state')).toBe('one-time-state');
    expect(url.toString()).not.toContain('client_secret');
  });

  it('verifies Microsoft Graph identity and returns sanitized metadata only', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'subject-123',
      displayName: 'ATLAS User',
      userPrincipalName: 'winder@example.com',
      mail: 'winder@example.com'
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const adapter = createMicrosoftAdapter({
      clientId: 'client-id',
      redirectUri: 'https://atlas.example.test/callback'
    }, fetchFn);

    const result = await adapter.verify({
      accessToken: 'super-secret-access-token',
      scopes: ['User.Read']
    });

    expect(String(fetchFn.mock.calls[0][0])).toContain('/v1.0/me?$select=');
    expect(result.externalSubjectId).toBe('subject-123');
    expect(result.maskedIdentity).toMatch(/\*+/);
    expect(result.scopes).toEqual(['User.Read']);
    expect(JSON.stringify(result)).not.toContain('super-secret-access-token');
    expect(JSON.stringify(result)).not.toContain('winder@example.com');
  });

  it('executes the first acceptance capability and fails closed for later capability families', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'subject-123',
      displayName: 'ATLAS User',
      userPrincipalName: 'winder@example.com',
      mail: null
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const adapter = createMicrosoftAdapter({ clientId: 'client-id', redirectUri: 'https://atlas.example.test/callback' }, fetchFn);

    await expect(adapter.executeCapability({
      capability: 'microsoft.profile.read',
      accessToken: 'server-token',
      scopes: ['User.Read']
    })).resolves.toMatchObject({ externalSubjectId: 'subject-123' });

    await expect(adapter.executeCapability({
      capability: 'microsoft.mail.read',
      accessToken: 'server-token',
      scopes: ['Mail.Read', 'User.Read']
    })).rejects.toMatchObject({ code: 'capability_not_implemented', status: 409 });
  });

  it('maps provider/network failures without leaking token material', () => {
    const adapter = createMicrosoftAdapter({ clientId: 'client-id', redirectUri: 'https://atlas.example.test/callback' });
    const mapped = adapter.mapError(new Error('network failed with bearer super-secret-token'));
    expect(mapped).toMatchObject({ code: 'microsoft_provider_error' });
    expect(JSON.stringify(mapped)).not.toContain('super-secret-token');
  });
});
