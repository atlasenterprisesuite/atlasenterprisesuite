import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260918233500_health_cure_candidate_registry.sql'
);

function migrationSql(): string {
  expect(existsSync(migrationPath)).toBe(true);
  return readFileSync(migrationPath, 'utf8').toLowerCase();
}

describe('ATLAS Health possible-cure candidate persistence', () => {
  it('creates a tenant-scoped candidate registry that can never claim confirmed cure or clinical action', () => {
    const sql = migrationSql();

    expect(sql).toContain('create table if not exists public.health_cure_candidates');
    expect(sql).toContain("possible cure — research candidate");
    expect(sql).toContain("target_curability_level text not null default 'c5'");
    expect(sql).toContain('clinical_action_allowed boolean not null default false');
    expect(sql).toContain('check (clinical_action_allowed = false)');
    expect(sql).toContain('confirmed_cure boolean not null default false');
    expect(sql).toContain('check (confirmed_cure = false)');
    expect(sql).toContain('external_validation_required boolean not null default true');
  });

  it('keeps automatic candidate ingestion service-controlled while tenant users are read-only', () => {
    const sql = migrationSql();

    expect(sql).toContain('enable row level security');
    expect(sql).toContain('organization_members');
    expect(sql).toContain('has_identity_permission');
    expect(sql).toContain("'atlas.jm.sentinel.read'");
    expect(sql).toContain("'atlas.jm.sentinel.audit'");
    expect(sql).toContain('grant select on public.health_cure_candidates to authenticated');
    expect(sql).toContain('grant all on public.health_cure_candidates to service_role');
    expect(sql).not.toContain('grant insert on public.health_cure_candidates to authenticated');
  });
});
