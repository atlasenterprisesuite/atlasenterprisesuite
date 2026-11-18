import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync('supabase/migrations/20261118090000_atlas_youtube_direct_private_foundation.sql', 'utf8');
const tables = [
  'atlas_youtube_connections',
  'atlas_youtube_drafts',
  'atlas_youtube_publication_jobs',
  'atlas_youtube_publication_events',
];
describe('ATLAS YouTube private schema P0 static preflight', () => {
  it('defines four private tenant-scoped entities with default-deny RLS', () => {
    for (const table of tables) {
      expect(sql).toContain(`create table if not exists public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`alter table public.${table} force row level security`);
      expect(sql).toContain(`revoke all on table public.${table} from public, anon, authenticated`);
      expect(sql).not.toMatch(new RegExp(`create policy .+ on public\\.${table}`, 'i'));
    }
  });
  it('requires channel-bound composite references and channel-scoped idempotency', () => {
    expect((sql.match(/foreign key \(org_id, channel_id, /g) || []).length).toBe(4);
    expect(sql).toContain('unique (org_id, channel_id, publication_key)');
    expect(sql).toContain('unique (org_id, channel_id, social_post_id)');
    expect(sql).toContain('foreign key (org_id, social_post_id)');
    expect(sql).toContain('references public.atlas_social_scheduled_posts (org_id, id)');
    expect(sql).toContain("check (status <> 'published' or provider_video_id is not null)");
    expect(sql).toContain('check (attempts >= 0)');
  });
  it('does not store OAuth tokens or auto-enable publication', () => {
    expect(sql).not.toMatch(/\b(access_token|refresh_token|client_secret|token_ciphertext)\b/i);
    expect(sql).not.toMatch(/\b(create policy|grant all on table|create trigger)\b/i);
  });
});
