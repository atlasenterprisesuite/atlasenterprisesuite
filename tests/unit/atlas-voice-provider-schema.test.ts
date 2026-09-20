import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = () => readFileSync('supabase/migrations/20260920152000_atlas_voice_provider_native_verification.sql', 'utf8');

describe('ATLAS Voice provider/native verification schema', () => {
  it('stores provider lifecycle refs without exposing secrets', () => {
    const text = sql();
    expect(text).toContain('provider_consent_ref');
    expect(text).toContain('provider_kind');
    expect(text).toContain('provider_state');
    expect(text).toContain('provider_ref');
    expect(text).not.toContain('OPENAI_API_KEY');
  });

  it('creates self-scoped metadata-only native verification evidence', () => {
    const text = sql();
    expect(text).toContain('create table if not exists public.atlas_voice_native_verifications');
    expect(text).toContain('owner_user_id');
    expect(text).toContain('local_playback_verified');
    expect(text).toContain('personal_voice_count');
    expect(text).toContain('enable row level security');
    expect(text).toContain('auth.uid()');
  });

  it('keeps provider generation mutations server-controlled', () => {
    const text = sql();
    expect(text).toContain('revoke all on public.atlas_voice_generation_jobs from authenticated');
    expect(text).toContain('grant select on public.atlas_voice_generation_jobs to authenticated');
  });
});
