import { describe, expect, it } from 'vitest';
import * as core from '../../packages/core/src/index';

const stateSecret = 'atlas-google-oauth-state-secret-for-tests-32-bytes-minimum';

describe('ATLAS Google OAuth authorization preparation', () => {
  it('creates a short-lived signed state and matching Google authorization URL', async () => {
    const prepareGoogleOAuthAuthorization = (core as Record<string, unknown>)
      .prepareGoogleOAuthAuthorization as
      | ((input: {
          clientId: string;
          redirectUri: string;
          stateSecret: string;
          userId: string;
          organizationId: string;
          permissions: readonly string[];
          nonce: string;
          now: number;
          ttlMs?: number;
        }) => Promise<{ authorizationUrl: string; state: string; expiresAt: number }>)
      | undefined;
    const verifyGoogleOAuthState = (core as Record<string, unknown>).verifyGoogleOAuthState as
      | ((input: { secret: string; state: string; now?: number }) => Promise<{
          userId: string;
          organizationId: string;
          permissions: string[];
          nonce: string;
          expiresAt: number;
        }>)
      | undefined;

    expect(prepareGoogleOAuthAuthorization).toBeTypeOf('function');
    expect(verifyGoogleOAuthState).toBeTypeOf('function');

    const now = 1_800_000_000_000;
    const prepared = await prepareGoogleOAuthAuthorization!({
      clientId: 'atlas-google-client.apps.googleusercontent.com',
      redirectUri: 'https://atlas.example/functions/v1/atlas-google-callback',
      stateSecret,
      userId: 'user-123',
      organizationId: 'org-456',
      permissions: ['google.gmail.read', 'google.calendar.read', 'google.drive.write'],
      nonce: 'nonce-789',
      now
    });

    expect(prepared.expiresAt).toBe(now + 10 * 60 * 1000);
    const url = new URL(prepared.authorizationUrl);
    expect(url.searchParams.get('state')).toBe(prepared.state);

    await expect(
      verifyGoogleOAuthState!({ secret: stateSecret, state: prepared.state, now })
    ).resolves.toMatchObject({
      userId: 'user-123',
      organizationId: 'org-456',
      permissions: ['google.gmail.read', 'google.calendar.read', 'google.drive.write'],
      nonce: 'nonce-789',
      expiresAt: now + 10 * 60 * 1000
    });
  });

  it('honors a shorter explicit TTL but rejects non-positive TTLs', async () => {
    const prepareGoogleOAuthAuthorization = (core as Record<string, unknown>)
      .prepareGoogleOAuthAuthorization as
      | ((input: {
          clientId: string;
          redirectUri: string;
          stateSecret: string;
          userId: string;
          organizationId: string;
          permissions: readonly string[];
          nonce: string;
          now: number;
          ttlMs?: number;
        }) => Promise<{ authorizationUrl: string; state: string; expiresAt: number }>)
      | undefined;

    expect(prepareGoogleOAuthAuthorization).toBeTypeOf('function');

    const base = {
      clientId: 'atlas-google-client.apps.googleusercontent.com',
      redirectUri: 'https://atlas.example/functions/v1/atlas-google-callback',
      stateSecret,
      userId: 'user-123',
      organizationId: 'org-456',
      permissions: ['google.gmail.read'],
      nonce: 'nonce-789',
      now: 1_800_000_000_000
    };

    const prepared = await prepareGoogleOAuthAuthorization!({ ...base, ttlMs: 120_000 });
    expect(prepared.expiresAt).toBe(base.now + 120_000);

    await expect(
      prepareGoogleOAuthAuthorization!({ ...base, ttlMs: 0 })
    ).rejects.toThrow(/ttl|expiration/i);
  });

  it('rejects an empty nonce before generating an authorization URL', async () => {
    const prepareGoogleOAuthAuthorization = (core as Record<string, unknown>)
      .prepareGoogleOAuthAuthorization as
      | ((input: {
          clientId: string;
          redirectUri: string;
          stateSecret: string;
          userId: string;
          organizationId: string;
          permissions: readonly string[];
          nonce: string;
          now: number;
          ttlMs?: number;
        }) => Promise<{ authorizationUrl: string; state: string; expiresAt: number }>)
      | undefined;

    expect(prepareGoogleOAuthAuthorization).toBeTypeOf('function');

    await expect(
      prepareGoogleOAuthAuthorization!({
        clientId: 'atlas-google-client.apps.googleusercontent.com',
        redirectUri: 'https://atlas.example/functions/v1/atlas-google-callback',
        stateSecret,
        userId: 'user-123',
        organizationId: 'org-456',
        permissions: ['google.gmail.read'],
        nonce: '',
        now: 1_800_000_000_000
      })
    ).rejects.toThrow(/nonce/i);
  });
});
