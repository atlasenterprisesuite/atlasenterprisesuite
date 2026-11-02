import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Static regression checks only. Runtime tenant-isolation and revocation tests
// MUST run against a disposable PostgreSQL instance before any P0 approval.
const root = process.cwd();
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');
const groups = [
  {path:'supabase/migrations/20261007081500_atlas_care_core.sql', names:['care_create_caregiver','care_create_participant','care_create_plan','care_create_time_entry','care_get_capability_readiness','care_transition_time_entry']},
  {path:'supabase/migrations/20260923203000_atlas_payroll_core.sql', names:['payroll_create_run','payroll_create_schedule','payroll_transition_run','payroll_upsert_line']},
  {path:'supabase/migrations/20260923201500_atlas_people_core.sql', names:['people_create_application','people_create_candidate','people_create_requisition','people_create_time_entry','people_create_worker','people_set_compensation','people_set_deduction','people_transition_application','people_transition_time_entry','people_update_worker']},
  {path:'supabase/migrations/20261004204500_atlas_payroll_us_federal_determination_persistence.sql',names:['payroll_determine_us_federal_2026']},
];
const w4 = 'supabase/migrations/20261004201500_atlas_payroll_us_federal_tax_2026.sql';

describe('ATLAS 777 privileged RPC static audit (not PostgreSQL certification)', () => {
  for (const group of groups) {
    it(`declares named privileged functions in ${group.path}`, () => {
      const sql = source(group.path).toLowerCase();
      for (const name of group.names) {
        expect(sql).toContain(`function public.${name}`);
        expect(sql).toContain('security definer');
        expect(sql).toContain('has_identity_permission');
      }
    });
  }
  it('checks caller identity and explicitly scopes privileged calls', () => {
    for (const group of groups) {
      const sql=source(group.path).toLowerCase();
      expect(sql).toContain('auth.uid()');
      expect(sql).toContain('p_org_id');
      expect(sql).toContain('revoke all on function');
      expect(sql).toContain('grant execute on function');
    }
  });
  it('requires runtime PostgreSQL tests before release (documentation gate)', () => {
    const contract=source('docs/security/atlas-777-supabase-definer-rls-audit-20261101.md');
    expect(contract).toContain('Concurrent revoke-vs-RPC');
    expect(contract).toContain('P0 remains NO-GO');
  });
});
