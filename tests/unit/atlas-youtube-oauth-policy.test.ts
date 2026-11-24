import { describe, expect, it } from 'vitest';
import {
  evaluateYouTubeOAuthCallback,
  type YouTubeOAuthSession,
  type YouTubeOAuthCallbackContext,
} from '../../packages/social/src/youtube-oauth-policy';

const UPLOAD = 'https://www.googleapis.com/auth/youtube.upload';
const session: YouTubeOAuthSession = {
  tenantId: 'tenant-a', userId: 'user-a', channelIntent: 'channel-a',
  nonce: 'random-server-nonce', expiresAt: 200000,
  requestedScopes: [UPLOAD], pkceChallenge: 'server-pkce-challenge', status: 'pending',
};
const callback: YouTubeOAuthCallbackContext = {
  tenantId: 'tenant-a', userId: 'user-a', channelIntent: 'channel-a',
  nonce: 'random-server-nonce', now: 100000, authenticated: true,
  hmacVerified: true, nonceConsumedAtomically: true, pkceVerifiedByProvider: true,
  returnedChannelId: 'channel-a', providerScopes: [UPLOAD],
};
describe('ATLAS YouTube OAuth callback P0 policy', () => {
  it('only gates storage, never claims credentials have been stored', () => {
    expect(evaluateYouTubeOAuthCallback(session, callback)).toEqual({
      allowed: true, status: 'eligible_to_store_encrypted_credentials',
    });
  });
  it.each([
    [{ authenticated: false }, 'identity_or_tenant_mismatch'],
    [{ tenantId: 'tenant-b' }, 'identity_or_tenant_mismatch'],
    [{ userId: 'user-b' }, 'identity_or_tenant_mismatch'],
    [{ returnedChannelId: 'channel-b' }, 'channel_not_verified'],
    [{ channelIntent: 'channel-b' }, 'channel_not_verified'],
    [{ hmacVerified: false }, 'state_signature_unverified'],
    [{ nonce: 'replayed-state' }, 'state_replay_or_revocation'],
    [{ nonceConsumedAtomically: false }, 'state_replay_or_revocation'],
    [{ now: 200000 }, 'state_expired_or_invalid_clock'],
    [{ now: Number.NaN }, 'state_expired_or_invalid_clock'],
    [{ pkceVerifiedByProvider: false }, 'pkce_not_verified'],
    [{ providerScopes: [] }, 'youtube_upload_scope_missing'],
  ] as const)('rejects callback mutation %j', (mutation, reason) => {
    const verdict = evaluateYouTubeOAuthCallback(session, { ...callback, ...mutation });
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) expect(verdict.reasons).toContain(reason);
  });
  it('rejects consumed/revoked state and missing server-side PKCE proof', () => {
    for (const change of [
      { status: 'consumed' }, { status: 'revoked' }, { pkceChallenge: '' },
      { requestedScopes: [] }, { tenantId: ' ' },
    ] as const) {
      expect(evaluateYouTubeOAuthCallback({ ...session, ...change }, callback).allowed).toBe(false);
    }
  });
});
