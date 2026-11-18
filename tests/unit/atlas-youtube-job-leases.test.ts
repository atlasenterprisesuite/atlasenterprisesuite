import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  'supabase/migrations/20261118091500_atlas_youtube_direct_job_leases.sql',
  'utf8',
);

describe('ATLAS YouTube durable job lease P0 static preflight', () => {
  it('claims only due, authorized, media-ready jobs under an atomic row lock', () => {
    expect(sql).toContain('where j.org_id = p_org_id');
    expect(sql).toContain('and j.channel_id = p_channel_id');
    expect(sql).toContain("j.status = 'queued'");
    expect(sql).toContain('j.scheduled_for <= now()');
    expect(sql).toContain('j.attempts < j.max_attempts');
    expect(sql).toContain("c.status = 'connected'");
    expect(sql).toContain(
      "c.consent_expires_at > now() + make_interval(secs => p_lease_seconds)",
    );
    expect(sql).toContain(
      "'https://www.googleapis.com/auth/youtube.upload' = any(c.granted_scopes)",
    );
    expect(sql).toContain("d.media_status = 'ready'");
    expect(sql).toContain('for update of j skip locked');
    expect(sql).toContain('attempts = attempts + 1');
  });

  it('never treats timeout or lease expiry as permission to blindly repost', () => {
    expect(sql).toContain("set status = 'blocked'");
    expect(sql).toContain("'lease_expired_blocked'");
    expect(sql).toContain("'requires_reconciliation', true");
    expect(sql).not.toMatch(
      /lease_expires_at\s*<=\s*now\(\)[\s\S]{0,180}set\s+status\s*=\s*'queued'/i,
    );
  });

  it('requires explicit provider evidence before published or retry transitions', () => {
    expect(sql).toContain('youtube_provider_video_id_required');
    expect(sql).toContain("and status = 'leased'");
    expect(sql).toContain('and lease_owner = p_worker_id');
    expect(sql).toContain('p_provider_confirmed_absent is distinct from true');
    expect(sql).toContain('youtube_provider_absence_not_confirmed');
    expect(sql).toContain("event_type, correlation_id, detail");
  });

  it('keeps worker RPCs service-role-only', () => {
    for (const signature of [
      'atlas_youtube_claim_due_job(uuid, text, text, integer)',
      'atlas_youtube_confirm_published(uuid, text, uuid, text, text, uuid)',
      'atlas_youtube_requeue_after_confirmed_absence(uuid, text, uuid, text, boolean, uuid)',
      'atlas_youtube_quarantine_expired_leases()',
    ]) {
      expect(sql).toContain(
        `revoke all on function public.${signature}`,
      );
      expect(sql).toContain(
        `grant execute on function public.${signature} to service_role`,
      );
    }
  });
});
