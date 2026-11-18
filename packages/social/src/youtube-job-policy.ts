/**
 * ATLAS YouTube Direct — safe scheduler admission and worker lease policy.
 * Pure functions only; no uploads, token refresh, or database writes.
 * Persistence must enforce UNIQUE (tenant_id, channel_id, publication_key)
 * and atomically acquire leases before any effect.
 */
import { evaluateYouTubePublication, type YouTubePublicationInput } from './youtube-publication-guard';

export type YouTubeJob = {
  id: string;
  tenantId: string;
  channelId: string;
  publicationKey: string;
  contentSha256: string;
  status: 'queued' | 'leased' | 'published' | 'blocked' | 'failed';
  attempts: number;
  maxAttempts: number;
  runAt: string;
  leaseExpiresAt?: string;
};

export type JobGate =
  | { allowed: true; status: 'eligible_for_lease' }
  | { allowed: false; status: 'blocked'; reasons: string[] };

const DATE_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const parseTime = (s: string): number => DATE_WITH_ZONE.test(s) ? Date.parse(s) : NaN;

/** Re-evaluate authorization immediately before acquiring a worker lease. */
export function evaluateYouTubeJobLease(
  job: YouTubeJob,
  authorization: YouTubePublicationInput,
  now: string,
): JobGate {
  const reasons: string[] = [];
  const nowMs = parseTime(now);
  if (!Number.isFinite(nowMs)) reasons.push('invalid_clock');
  if (!job.id?.trim() || !job.publicationKey?.trim()) reasons.push('invalid_job_identity');
  if (!job.tenantId?.trim() || !job.channelId?.trim()
    || job.tenantId !== authorization.tenantId
    || job.channelId !== authorization.channelId
    || job.publicationKey !== authorization.publicationKey
    || job.contentSha256 !== authorization.contentSha256) {
    reasons.push('job_authorization_mismatch');
  }
  if (job.status !== 'queued') reasons.push('job_not_queued');
  if (!Number.isSafeInteger(job.attempts) || !Number.isSafeInteger(job.maxAttempts)
    || job.attempts < 0 || job.maxAttempts < 1 || job.attempts >= job.maxAttempts) {
    reasons.push('attempt_budget_exhausted');
  }
  const due = parseTime(job.runAt);
  if (!Number.isFinite(due) || !Number.isFinite(nowMs) || due > nowMs) reasons.push('job_not_due');
  const gate = evaluateYouTubePublication({ ...authorization, now, scheduledAt: undefined });
  if (!gate.allowed) reasons.push(...gate.reasons);
  return reasons.length > 0
    ? { allowed: false, status: 'blocked', reasons: [...new Set(reasons)] }
    : { allowed: true, status: 'eligible_for_lease' };
}

/**
 * A timeout after requesting an upload is indeterminate. Never blindly retry:
 * look up provider state using a stable correlation ID and reconcile first.
 */
export function nextYouTubeJobState(
  status: YouTubeJob['status'],
  outcome: 'confirmed_published' | 'confirmed_not_published' | 'unknown' | 'revoked',
): YouTubeJob['status'] {
  if (status !== 'leased') return status;
  if (outcome === 'confirmed_published') return 'published';
  if (outcome === 'confirmed_not_published') return 'queued';
  return 'blocked';
}
