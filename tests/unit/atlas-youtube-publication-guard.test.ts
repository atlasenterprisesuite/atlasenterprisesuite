import { describe, expect, it } from 'vitest';
import { evaluateYouTubePublication, type YouTubePublicationInput } from '../../packages/social/src/youtube-publication-guard';

const valid: YouTubePublicationInput = {
  tenantId: 'tenant-a',
  actorTenantId: 'tenant-a',
  channelId: 'channel-a',
  authorizedChannelId: 'channel-a',
  connectionStatus: 'connected',
  grantedScopes: ['https://www.googleapis.com/auth/youtube.upload'],
  permission: 'schedule',
  mediaStatus: 'ready',
  contentSha256: 'a'.repeat(64),
  publicationKey: 'tenant-a:channel-a:post-001',
  now: '2026-11-18T12:00:00.000Z',
  scheduledAt: '2026-11-19T12:00:00.000Z'
};

describe('ATLAS YouTube Direct P0 publication preflight', () => {
  it('allows only an explicitly authorized ready request', () => {
    expect(evaluateYouTubePublication(valid)).toEqual({ allowed: true, status: 'eligible_for_dispatch' });
  });
  it.each([
    [{ actorTenantId: 'tenant-b' }, 'tenant_access_denied'],
    [{ channelId: 'channel-b' }, 'channel_access_denied'],
    [{ connectionStatus: 'revoked' }, 'connection_not_authorized'],
    [{ connectionStatus: 'pending' }, 'connection_not_authorized'],
    [{ grantedScopes: [] }, 'upload_scope_missing'],
    [{ permission: 'read' }, 'insufficient_role'],
    [{ mediaStatus: 'pending' }, 'media_not_ready'],
    [{ contentSha256: 'unsafe' }, 'invalid_content_integrity'],
    [{ publicationKey: '' }, 'missing_idempotency_key'],
    [{ now: 'not-a-date' }, 'invalid_clock'],
    [{ scheduledAt: '2026-11-17T12:00:00.000Z' }, 'invalid_schedule']
  ] as const)('fails closed for %j', (change, expected) => {
    const result = evaluateYouTubePublication({ ...valid, ...change } as YouTubePublicationInput);
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reasons).toContain(expected);
  });
});
