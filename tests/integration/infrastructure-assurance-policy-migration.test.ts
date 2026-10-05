import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationPath = 'supabase/migrations/20261005110000_infrastructure_assurance_policies.sql';

function readMigration() {
  return readFileSync(migrationPath, 'utf8');
}

describe('ATLAS Infrastructure Assurance policy persistence', () => {
  it('creates an organization-scoped policy table with explicit severity, freshness and blocking controls', () => {
    const sql = readMigration();

    expect(sql).toContain('create table if not exists public.atlas_infrastructure_assurance_policies');
    expect(sql).toContain('org_id uuid not null references public.organizations(id)');
    expect(sql).toContain("environment text not null check (environment in ('staging','production'))");
    expect(sql).toContain("severity text not null check (severity in ('P0','P1','P2'))");
    expect(sql).toContain('max_evidence_age_seconds');
    expect(sql).toContain('blocking boolean not null default false');
    expect(sql).toContain('unique (org_id, environment, domain, requirement)');
  });

  it('enables RLS and permits organization reads only through the existing identity permission boundary', () => {
    const sql = readMigration();

    expect(sql).toContain('alter table public.atlas_infrastructure_assurance_policies enable row level security');
    expect(sql).toContain('organization_members');
    expect(sql).toContain("public.has_identity_permission(org_id, 'releases.read')");
    expect(sql).toContain('to authenticated');
  });

  it('keeps anonymous and direct authenticated writes fail-closed', () => {
    const sql = readMigration();

    expect(sql).toContain('revoke all on table public.atlas_infrastructure_assurance_policies from anon');
    expect(sql).toContain('revoke insert, update, delete on table public.atlas_infrastructure_assurance_policies from authenticated');
    expect(sql).toContain('grant select on table public.atlas_infrastructure_assurance_policies to authenticated');
    expect(sql).not.toContain('grant insert on table public.atlas_infrastructure_assurance_policies to authenticated');
  });

  it('stores policy requirements only and does not seed fabricated provider observations', () => {
    const sql = readMigration();

    expect(sql).not.toContain('insert into public.atlas_infrastructure_assurance_policies');
    expect(sql).not.toContain('provider_state');
    expect(sql).not.toContain('observed_value');
  });
});
