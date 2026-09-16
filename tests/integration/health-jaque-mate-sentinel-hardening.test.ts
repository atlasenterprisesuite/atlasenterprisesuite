import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260916005000_health_jaque_mate_sentinel_hardening.sql'
);

const sql = readFileSync(migrationPath, 'utf8');

describe('ATLAS Health Jaque Mate + Sentinel database hardening', () => {
  it('adds covering indexes for user foreign keys reported by the production advisor', () => {
    expect(sql).toContain('health_evidence_hypotheses_created_by_idx');
    expect(sql).toContain('health_evidence_simulation_created_by_idx');
    expect(sql).toContain('health_sentinel_config_updated_by_idx');
  });

  it('uses init-plan-safe auth uid evaluation in every Sentinel RLS policy', () => {
    expect(sql).toContain('(select auth.uid())');
    expect(sql).not.toMatch(/(?<!select )auth\.uid\(\)/i);
  });

  it('preserves the simulation watermark and permission boundaries', () => {
    expect(sql).toContain('SIMULATION — NOT CLINICAL EVIDENCE');
    expect(sql).toContain('atlas.jm.sentinel.read');
    expect(sql).toContain('atlas.jm.sentinel.write');
    expect(sql).toContain('atlas.jm.sentinel.audit');
  });
});
