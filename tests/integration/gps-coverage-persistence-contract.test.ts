import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const edge = readFileSync('supabase/functions/atlas-gps/index.ts', 'utf8');
const api = readFileSync('apps/web/src/modules/gps/gpsApi.ts', 'utf8');
const migration = readFileSync('supabase/migrations_legacy_pre_remote_sync/20260927001500_atlas_gps_coverage_progress.sql', 'utf8');

describe('ATLAS GPS resumable coverage persistence contract', () => {
  it('persists coverage state by organization, user and stable coverage key', () => {
    expect(migration).toContain('create table if not exists public.atlas_gps_coverage_runs');
    expect(migration).toContain('unique(org_id, user_id, coverage_key)');
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('organization_members');
    expect(migration).toContain('(select auth.uid())');
  });

  it('keeps terminal truth states distinct from verified imagery coverage', () => {
    expect(migration).toContain("status in ('pending', 'in-progress', 'complete', 'blocked')");
    expect(migration).toContain('progress_pct');
    expect(migration).toContain('last_probe_id');
    expect(migration).toContain('last_sector_id');
  });

  it('exposes authenticated list/save/delete coverage operations', () => {
    expect(edge).toContain("operation === 'coverage.list'");
    expect(edge).toContain("operation === 'coverage.save'");
    expect(edge).toContain("operation === 'coverage.delete'");
    expect(edge).toContain("onConflict: 'org_id,user_id,coverage_key'");
    expect(api).toContain('listGpsCoverageRuns');
    expect(api).toContain('saveGpsCoverageRun');
    expect(api).toContain('deleteGpsCoverageRun');
  });

  it('scopes privileged database writes to resolved tenant and user context', () => {
    expect(edge).toContain('org_id: context.orgId');
    expect(edge).toContain('user_id: context.userId');
    expect(edge).toContain(".eq('org_id', context.orgId)");
    expect(edge).toContain(".eq('user_id', context.userId)");
  });
});
