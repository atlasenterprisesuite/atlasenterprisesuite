/**
 * ATLAS YouTube Direct — policy-only P0 preflight.
 * No network requests, secret material, or implicit permission grants.
 * A passing preflight is NOT evidence that an upload or publication occurred.
 */
export type YouTubePublicationInput = {
  tenantId: string;
  actorTenantId: string;
  channelId: string;
  authorizedChannelId: string;
  connectionStatus: 'connected' | 'pending' | 'revoked' | 'failed';
  grantedScopes: readonly string[];
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

export function evaluateYouTubePublication(input: YouTubePublicationInput): YouTubePublicationDecision {
  const reasons: string[] = [];
  if (!input.tenantId || !input.actorTenantId || input.tenantId !== input.actorTenantId) {
    reasons.push('tenant_access_denied');
  }
  if (!input.channelId || !input.authorizedChannelId || input.channelId !== input.authorizedChannelId) {
    reasons.push('channel_access_denied');
  }
  if (input.connectionStatus !== 'connected') reasons.push('connection_not_authorized');
  if (!input.grantedScopes.includes(YOUTUBE_UPLOAD_SCOPE)) reasons.push('upload_scope_missing');
  if (input.permission !== 'publish' && input.permission !== 'schedule') reasons.push('insufficient_role');
  if (input.mediaStatus !== 'ready') reasons.push('media_not_ready');
  if (!SHA256_HEX.test(input.contentSha256)) reasons.push('invalid_content_integrity');
  if (!input.publicationKey.trim()) reasons.push('missing_idempotency_key');
  const now = Date.parse(input.now);
  if (!Number.isFinite(now)) reasons.push('invalid_clock');
  if (input.scheduledAt !== undefined) {
    const scheduled = Date.parse(input.scheduledAt);
    if (!Number.isFinite(scheduled) || !Number.isFinite(now) || scheduled <= now) {
      reasons.push('invalid_schedule');
    }
  }
  return reasons.length
    ? { allowed: false, status: 'blocked', reasons }
    : { allowed: true, status: 'eligible_for_dispatch' };
}
