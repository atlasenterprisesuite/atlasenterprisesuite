import { describe, expect, it } from 'vitest';
import { evaluateYouTubeJobLease, nextYouTubeJobState, type YouTubeJob } from '../../packages/social/src/youtube-job-policy';
import type { YouTubePublicationInput } from '../../packages/social/src/youtube-publication-guard';

const auth: YouTubePublicationInput = {
  tenantId: 'tenant-a', actorTenantId: 'tenant-a', channelId: 'channel-a',
  authorizedChannelId: 'channel-a', connectionStatus: 'connected',
  grantedScopes: ['https://www.googleapis.com/auth/youtube.upload'],
  authorizationExpiresAt: '2026-12-19T12:00:00Z', permission: 'schedule',
  mediaStatus: 'ready', contentSha256: 'a'.repeat(64), publicationKey: 'key-a',
  now: '2026-11-19T12:00:00Z',
};
const job: YouTubeJob = {
  id: 'job-a', tenantId: 'tenant-a', channelId: 'channel-a',
  publicationKey: 'key-a', contentSha256: 'a'.repeat(64),
  status: 'queued', attempts: 0, maxAttempts: 3, runAt: '2026-11-19T11:00:00Z',
};
const now = '2026-11-19T12:00:00Z';

describe('ATLAS YouTube Direct P0 scheduler policy', () => {
  it('admits only an authorized due job for atomic leasing, not publication', () => {
    expect(evaluateYouTubeJobLease(job, auth, now)).toEqual({ allowed: true, status: 'eligible_for_lease' });
  });
  it.each([
    [{ tenantId: 'tenant-b' }, 'job_authorization_mismatch'],
    [{ channelId: 'channel-b' }, 'job_authorization_mismatch'],
    [{ publicationKey: 'key-b' }, 'job_authorization_mismatch'],
    [{ contentSha256: 'b'.repeat(64) }, 'job_authorization_mismatch'],
    [{ status: 'leased' }, 'job_not_queued'],
    [{ status: 'published' }, 'job_not_queued'],
    [{ attempts: 3 }, 'attempt_budget_exhausted'],
    [{ maxAttempts: 0 }, 'attempt_budget_exhausted'],
    [{ attempts: -1 }, 'attempt_budget_exhausted'],
    [{ runAt: '2026-11-20T12:00:00Z' }, 'job_not_due'],
    [{ runAt: '2026-11-19T11:00:00' }, 'job_not_due'],
    [{ id: '   ' }, 'invalid_job_identity'],
  ] as const)('fails closed for job change %j', (change, reason) => {
    const d = evaluateYouTubeJobLease({ ...job, ...change } as YouTubeJob, auth, now);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reasons).toContain(reason);
  });
  it('rejects revoked grant, expired grant and mismatched actor tenant', () => {
    for (const change of [
      { connectionStatus: 'revoked' },
      { authorizationExpiresAt: now },
      { actorTenantId: 'tenant-b' },
    ] as const) {
      expect(evaluateYouTubeJobLease(job, { ...auth, ...change }, now).allowed).toBe(false);
    }
  });
  it('blocks indeterminate upload and revocation rather than blind retry', () => {
    expect(nextYouTubeJobState('leased', 'unknown')).toBe('blocked');
    expect(nextYouTubeJobState('leased', 'revoked')).toBe('blocked');
    expect(nextYouTubeJobState('leased', 'confirmed_not_published')).toBe('queued');
    expect(nextYouTubeJobState('leased', 'confirmed_published')).toBe('published');
    expect(nextYouTubeJobState('published', 'confirmed_not_published')).toBe('published');
  });
});
