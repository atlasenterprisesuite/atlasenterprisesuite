import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260915233000_health_jaque_mate_sentinel.sql'
);

function migrationSql(): string {
  expect(existsSync(migrationPath)).toBe(true);
  return readFileSync(migrationPath, 'utf8').toLowerCase();
}

describe('ATLAS Health Jaque Mate + Sentinel persistence contract', () => {
  it('creates four organization-scoped persistence surfaces without merging evidence layers', () => {
    const sql = migrationSql();

    expect(sql).toContain('create table if not exists public.health_evidence_validated');
    expect(sql).toContain('create table if not exists public.health_evidence_hypotheses');
    expect(sql).toContain('create table if not exists public.health_evidence_simulation');
    expect(sql).toContain('create table if not exists public.health_sentinel_config');
    expect(sql.match(/org_id uuid not null references public\.organizations\(id\)/g)?.length).toBe(4);
  });

  it('adds fine-grained permissions using canonical roles instead of inventing health roles', () => {
    const sql = migrationSql();

    for (const permission of [
      'atlas.jm.sentinel.read',
      'atlas.jm.sentinel.write',
      'atlas.jm.sentinel.audit'
    ]) {
      expect(sql).toContain(`'${permission}'`);
    }

    expect(sql).toContain("('owner', 'atlas.jm.sentinel.read')");
    expect(sql).toContain("('admin', 'atlas.jm.sentinel.write')");
    expect(sql).toContain("('owner', 'atlas.jm.sentinel.audit')");
    expect(sql).not.toContain('clinical_specialist');
    expect(sql).not.toContain('system_sentinel');
  });

  it('enables tenant-scoped RLS on all four tables using the existing identity permission system', () => {
    const sql = migrationSql();

    expect(sql.match(/enable row level security/g)?.length).toBe(4);
    expect(sql).toContain('organization_members');
    expect(sql).toContain('auth.uid()');
    expect(sql).toContain('has_identity_permission');
    expect(sql).toContain("'atlas.jm.sentinel.read'");
    expect(sql).toContain("'atlas.jm.sentinel.write'");
  });

  it('keeps validated evidence ingestion service-controlled while hypotheses and simulations remain permission-gated', () => {
    const sql = migrationSql();

    expect(sql).toContain('revoke all on public.health_evidence_validated from anon, authenticated');
    expect(sql).toContain('grant select on public.health_evidence_validated to authenticated');
    expect(sql).toContain('grant all on public.health_evidence_validated to service_role');
    expect(sql).not.toContain('grant insert on public.health_evidence_validated to authenticated');
    expect(sql).toContain('grant insert on public.health_evidence_hypotheses to authenticated');
    expect(sql).toContain('grant insert on public.health_evidence_simulation to authenticated');
  });

  it('hard-codes the simulation watermark but leaves Sentinel tuning unconfigured by default', () => {
    const sql = migrationSql();

    expect(sql).toContain('simulation — not clinical evidence');
    for (const key of [
      'sentinel.fitness.threshold',
      'sentinel.memory.pathological_depth',
      'sentinel.cost.surveillance_rate'
    ]) {
      expect(sql).toContain(`'${key}'`);
    }

    expect(sql).toContain('numeric_value numeric');
    expect(sql).not.toContain('default 0.75');
    expect(sql).not.toContain('default 3');
    expect(sql).not.toContain('default 1.0');
  });
});
