/**
 * ATLAS YouTube Direct — policy-only P0 preflight.
 * Caller must supply server-verified authorization data, never client claims.
 * This is NOT authorization for an API call or evidence of publication.
 */
export type YouTubePublicationInput = {
  tenantId: string;
  actorTenantId: string;
  channelId: string;
  authorizedChannelId: string;
  connectionStatus: 'connected' | 'pending' | 'revoked' | 'failed';
  /** Scopes verified against the provider's server-side token record. */
  grantedScopes: readonly string[];
  /** Server-side grant expiry, not the OAuth access-token refresh deadline. */
  authorizationExpiresAt: string;
  permission: 'publish' | 'schedule' | 'read';
  mediaStatus: 'ready' | 'pending' | 'rejected';
  contentSha256: string;
  publicationKey: string;
  scheduledAt?: string;
  now: string;
};

export type YouTubePublicationDecision =
  | { allowed: true; status: 'eligible_for_dispatch' }
  | { allowed: false; status: 'blocked'; reasons: string[] };

const YOUTUBE_UPLOAD_SCOPE = 'https://www.googleapis.com/auth/youtube.upload';
const SHA256_HEX = /^[0-9a-f]{64}$/i;
// Require explicit timezone to avoid local-clock ambiguity.
const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

function timestamp(value: string): number {
  if (typeof value !== 'string' || !ISO_WITH_ZONE.test(value)) return NaN;
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : NaN;
}

function nonblank(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function evaluateYouTubePublication(input: YouTubePublicationInput): YouTubePublicationDecision {
  const reasons: string[] = [];
  if (!nonblank(input.tenantId) || !nonblank(input.actorTenantId) || input.tenantId !== input.actorTenantId) {
    reasons.push('tenant_access_denied');
  }
  if (!nonblank(input.channelId) || !nonblank(input.authorizedChannelId) || input.channelId !== input.authorizedChannelId) {
    reasons.push('channel_access_denied');
  }
  if (input.connectionStatus !== 'connected') reasons.push('connection_not_authorized');
  if (!Array.isArray(input.grantedScopes) || !input.grantedScopes.includes(YOUTUBE_UPLOAD_SCOPE)) reasons.push('upload_scope_missing');
  if (input.permission !== 'publish' && input.permission !== 'schedule') reasons.push('insufficient_role');
  if (input.mediaStatus !== 'ready') reasons.push('media_not_ready');
  if (typeof input.contentSha256 !== 'string' || !SHA256_HEX.test(input.contentSha256)) reasons.push('invalid_content_integrity');
  if (!nonblank(input.publicationKey)) reasons.push('missing_idempotency_key');
  const now = timestamp(input.now);
  if (!Number.isFinite(now)) reasons.push('invalid_clock');
  const expiresAt = timestamp(input.authorizationExpiresAt);
  if (!Number.isFinite(expiresAt) || !Number.isFinite(now) || expiresAt <= now) {
    reasons.push('authorization_expired');
  }
  if (input.scheduledAt !== undefined) {
    const scheduled = timestamp(input.scheduledAt);
    if (!Number.isFinite(scheduled) || !Number.isFinite(now) || scheduled <= now) {
      reasons.push('invalid_schedule');
    }
  }
  return reasons.length
    ? { allowed: false, status: 'blocked', reasons }
    : { allowed: true, status: 'eligible_for_dispatch' };
}
