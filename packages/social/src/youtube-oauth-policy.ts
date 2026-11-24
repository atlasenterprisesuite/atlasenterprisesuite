/**
 * ATLAS YouTube Direct — OAuth callback policy, no network or token operations.
 * The backend must authenticate the caller, verify the state HMAC using the
 * existing shared Google OAuth helper, consume the nonce atomically exactly once,
 * verify the PKCE challenge at Google's token endpoint, and verify channel
 * ownership with the YouTube API before saving encrypted credentials.
 */
export type YouTubeOAuthSession = {
  tenantId: string;
  userId: string;
  channelIntent: string;
  nonce: string;
  expiresAt: number;
  requestedScopes: readonly string[];
  pkceChallenge: string;
  status: 'pending' | 'consumed' | 'revoked';
};
export type YouTubeOAuthCallbackContext = {
  tenantId: string;
  userId: string;
  channelIntent: string;
  nonce: string;
  now: number;
  authenticated: boolean;
  hmacVerified: boolean;
  nonceConsumedAtomically: boolean;
  pkceVerifiedByProvider: boolean;
  returnedChannelId: string;
  providerScopes: readonly string[];
};
export type OAuthGate =
  | { allowed: true; status: 'eligible_to_store_encrypted_credentials' }
  | { allowed: false; status: 'blocked'; reasons: string[] };

const UPLOAD_SCOPE = 'https://www.googleapis.com/auth/youtube.upload';
const nonempty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

export function evaluateYouTubeOAuthCallback(
  session: YouTubeOAuthSession,
  callback: YouTubeOAuthCallbackContext,
): OAuthGate {
  const reasons: string[] = [];
  if (!callback.authenticated || !nonempty(session.tenantId) || !nonempty(session.userId)
    || session.tenantId !== callback.tenantId || session.userId !== callback.userId) {
    reasons.push('identity_or_tenant_mismatch');
  }
  if (!nonempty(session.channelIntent) || !nonempty(callback.channelIntent)
    || session.channelIntent !== callback.channelIntent
    || !nonempty(callback.returnedChannelId)
    || session.channelIntent !== callback.returnedChannelId) {
    reasons.push('channel_not_verified');
  }
  if (!callback.hmacVerified) reasons.push('state_signature_unverified');
  if (session.status !== 'pending' || !nonempty(session.nonce)
    || session.nonce !== callback.nonce || !callback.nonceConsumedAtomically) {
    reasons.push('state_replay_or_revocation');
  }
  if (!Number.isSafeInteger(session.expiresAt) || !Number.isSafeInteger(callback.now)
    || callback.now >= session.expiresAt || callback.now < 0) {
    reasons.push('state_expired_or_invalid_clock');
  }
  if (!nonempty(session.pkceChallenge) || !callback.pkceVerifiedByProvider) {
    reasons.push('pkce_not_verified');
  }
  if (!Array.isArray(session.requestedScopes)
    || !session.requestedScopes.includes(UPLOAD_SCOPE)
    || !Array.isArray(callback.providerScopes)
    || !callback.providerScopes.includes(UPLOAD_SCOPE)) {
    reasons.push('youtube_upload_scope_missing');
  }
  return reasons.length
    ? { allowed: false, status: 'blocked', reasons }
    : { allowed: true, status: 'eligible_to_store_encrypted_credentials' };
}
