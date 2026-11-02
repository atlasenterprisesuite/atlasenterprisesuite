import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Static source checks only. These do NOT prove effective catalog grants,
// tenant isolation, or READ COMMITTED revocation safety.
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const groups = [
  { path: 'supabase/migrations/20261007081500_atlas_care_core.sql',
    names: ['care_create_caregiver','care_create_participant','care_create_plan','care_create_time_entry','care_get_capability_readiness','care_transition_time_entry'] },
  { path: 'supabase/migrations/20260923203000_atlas_payroll_core.sql',
    names: ['payroll_create_run','payroll_create_schedule','payroll_transition_run','payroll_upsert_line'] },
  { path: 'supabase/migrations/20260923201500_atlas_people_core.sql',
    names: ['people_create_application','people_create_candidate','people_create_requisition','people_create_time_entry','people_create_worker','people_set_compensation','people_set_deduction','people_transition_application','people_transition_time_entry','people_update_worker'] },
  { path: 'supabase/migrations/20261004203000_atlas_payroll_us_federal_tax_2026.sql',
    names: ['payroll_record_federal_w4_election'] },
  { path: 'supabase/migrations/20261004204500_atlas_payroll_us_federal_determination_persistence.sql',
    names: ['payroll_determine_us_federal_2026'] },
] as const;
const expected = 22;
const regexEscape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('ATLAS 777: 22 privileged RPC source invariants (NOT runtime certification)', () => {
  it('has 22 distinct RPCs with no missing coverage', () => {
    const names = groups.flatMap(g => [...g.names]);
    expect(names).toHaveLength(expected);
    expect(new Set(names).size).toBe(expected);
  });
  for (const group of groups) {
    for (const name of group.names) {
      it(`${name}: checks identity, org permission and explicit grants in source`, () => {
        const sql = read(group.path);
        // Match each function's own body, not a different function in the file.
        const functionStart = new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${regexEscape(name)}\\s*\\(`, 'i');
        const start = sql.search(functionStart);
        expect(start).toBeGreaterThanOrEqual(0);
        const tail = sql.slice(start);
        const body = tail.match(/\bas\s+\$\$([\s\S]*?)\$\$\s*;/i);
        expect(body).not.toBeNull();
        const header = tail.slice(0, tail.indexOf('$$'));
        expect(header).toMatch(/security\s+definer/i);
        expect(body![1]).toMatch(/auth\.uid\s*\(\s*\)/i);
        expect(body![1]).toMatch(/has_identity_permission\s*\(\s*p_org_id\s*,/i);
        expect(sql).toMatch(new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${regexEscape(name)}\\s*\\(`, 'i'));
        expect(sql).toMatch(new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${regexEscape(name)}\\s*\\(`, 'i'));
      });
    }
  }
  it('keeps P0 blocked until isolated database concurrency tests exist', () => {
    const contract = read('docs/security/atlas-777-supabase-definer-rls-audit-20261101.md');
    expect(contract).toContain('Concurrent revoke-vs-RPC');
    expect(contract).toContain('P0 remains NO-GO');
  });
});
