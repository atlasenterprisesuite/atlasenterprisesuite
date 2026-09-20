import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationPath = 'supabase/migrations/20260920050000_atlas_personal_voice_activation.sql';

describe('ATLAS Personal Voice Supabase activation contract', () => {
  it('versions the private Voice persistence hardening migration', () => {
    expect(() => readFileSync(migrationPath, 'utf8')).not.toThrow();
  });

  it('parses Storage ownership from the object path, never from profile.name', () => {
    const migration = readFileSync(migrationPath, 'utf8');
    expect(migration).toContain("storage.foldername(storage.objects.name))[1]");
    expect(migration).toContain("storage.foldername(storage.objects.name))[2]");
    expect(migration).toContain("storage.foldername(storage.objects.name))[3]");
    expect(migration).not.toContain('storage.foldername(p.name)');
    expect(migration).not.toContain('storage.foldername(name)');
  });

  it('keeps Voice private and explicitly exposed only to authenticated users', () => {
    const migration = readFileSync(migrationPath, 'utf8');
    expect(migration).toContain('revoke all on public.atlas_voice_profiles from anon');
    expect(migration).toContain('revoke all on public.atlas_voice_samples from anon');
    expect(migration).toContain('grant select, insert on public.atlas_voice_profiles to authenticated');
    expect(migration).toContain('grant select, insert, delete on public.atlas_voice_samples to authenticated');
    expect(migration).toContain('grant select on public.atlas_voice_generation_jobs to authenticated');
    expect(migration).not.toContain('grant select, insert, update on public.atlas_voice_generation_jobs to authenticated');
  });

  it('keeps generation provider readiness fail-closed', () => {
    const migration = readFileSync(migrationPath, 'utf8');
    expect(migration).toContain("'generation_provider', 'not_configured'");
    expect(migration).toContain('drop policy if exists atlas_voice_generation_jobs_insert');
    expect(migration).toContain('drop policy if exists atlas_voice_generation_jobs_update');
  });
});
