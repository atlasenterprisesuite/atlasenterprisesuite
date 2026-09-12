import { describe, expect, it } from 'vitest';
import * as core from '../../packages/core/src/index';

type OAuthStatePayload = {
  version: 1;
  userId: string;
  organizationId: string;
  permissions: string[];
  nonce: string;
  expiresAt: number;
};

const secret = 'atlas-google-oauth-state-secret-for-tests-32-bytes-minimum';
const payload: OAuthStatePayload = {
  version: 1,
  userId: 'user-123',
  organizationId: 'org-456',
  permissions: ['google.gmail.read', 'google.calendar.read', 'google.drive.write'],
  nonce: 'nonce-789',
  expiresAt: 1_800_000_000_000
};

describe('ATLAS Google OAuth signed state', () => {
  it('round-trips a tenant-scoped state without exposing the signing secret', async () => {
    const signGoogleOAuthState = (core as Record<string, unknown>).signGoogleOAuthState as
      | ((input: { secret: string; payload: OAuthStatePayload }) => Promise<string>)
      | undefined;
    const verifyGoogleOAuthState = (core as Record<string, unknown>).verifyGoogleOAuthState as
      | ((input: { secret: string; state: string; now?: number }) => Promise<OAuthStatePayload>)
      | undefined;

    expect(signGoogleOAuthState).toBeTypeOf('function');
    expect(verifyGoogleOAuthState).toBeTypeOf('function');

    const state = await signGoogleOAuthState!({ secret, payload });
    expect(state.split('.')).toHaveLength(2);
    expect(state).not.toContain(secret);

    await expect(
      verifyGoogleOAuthState!({ secret, state, now: payload.expiresAt - 1 })
    ).resolves.toEqual(payload);
  });

  it('rejects a tampered state', async () => {
    const signGoogleOAuthState = (core as Record<string, unknown>).signGoogleOAuthState as
      | ((input: { secret: string; payload: OAuthStatePayload }) => Promise<string>)
      | undefined;
    const verifyGoogleOAuthState = (core as Record<string, unknown>).verifyGoogleOAuthState as
      | ((input: { secret: string; state: string; now?: number }) => Promise<OAuthStatePayload>)
      | undefined;

    expect(signGoogleOAuthState).toBeTypeOf('function');
    expect(verifyGoogleOAuthState).toBeTypeOf('function');

    const state = await signGoogleOAuthState!({ secret, payload });
    const [body, signature] = state.split('.');
    const tampered = `${body.replace(/.$/, body.endsWith('A') ? 'B' : 'A')}.${signature}`;

    await expect(
      verifyGoogleOAuthState!({ secret, state: tampered, now: payload.expiresAt - 1 })
    ).rejects.toThrow(/state|signature|invalid/i);
  });

  it('rejects expired state', async () => {
    const signGoogleOAuthState = (core as Record<string, unknown>).signGoogleOAuthState as
      | ((input: { secret: string; payload: OAuthStatePayload }) => Promise<string>)
      | undefined;
    const verifyGoogleOAuthState = (core as Record<string, unknown>).verifyGoogleOAuthState as
      | ((input: { secret: string; state: string; now?: number }) => Promise<OAuthStatePayload>)
      | undefined;

    expect(signGoogleOAuthState).toBeTypeOf('function');
    expect(verifyGoogleOAuthState).toBeTypeOf('function');

    const state = await signGoogleOAuthState!({ secret, payload });
    await expect(
      verifyGoogleOAuthState!({ secret, state, now: payload.expiresAt })
    ).rejects.toThrow(/expired/i);
  });

  it('rejects state containing non-Google or blanket admin permissions', async () => {
    const signGoogleOAuthState = (core as Record<string, unknown>).signGoogleOAuthState as
      | ((input: { secret: string; payload: OAuthStatePayload }) => Promise<string>)
      | undefined;

    expect(signGoogleOAuthState).toBeTypeOf('function');

    await expect(
      signGoogleOAuthState!({
        secret,
        payload: { ...payload, permissions: ['integrations.admin'] }
      })
    ).rejects.toThrow(/permission/i);
  });
});
