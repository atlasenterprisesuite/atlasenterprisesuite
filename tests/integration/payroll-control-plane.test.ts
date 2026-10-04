import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationPath = 'supabase/migrations/20261004190000_atlas_payroll_control_plane.sql';
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';

describe('ATLAS Payroll control plane', () => {
  it('adds the evidence-driven payroll control-plane schema and readiness contract', () => {
    expect(existsSync(migrationPath)).toBe(true);

    for (const table of [
      'payroll_rule_packs',
      'payroll_provider_connections',
      'payroll_execution_intents',
      'payroll_execution_evidence'
    ]) {
      expect(migration).toContain(`public.${table}`);
    }

    expect(migration).toContain('enable row level security');
    expect(migration).toContain('public.audit_row_change()');
    expect(migration).toContain("public.has_identity_permission(p_org_id,'payroll.read')");
    expect(migration).toContain("public.has_identity_permission(p_org_id,'payroll.write')");
    expect(migration).toContain("status <> 'verified'");
    expect(migration).toContain("status <> 'active'");
    expect(migration).toContain('payroll_execution_evidence_immutable');
    expect(migration).toContain('settled_evidence_required');
    expect(migration).toContain('payroll_get_capability_readiness');
    expect(migration).toContain('P0_BLOCKER');
    expect(migration).toContain('tax_determination');
    expect(migration).toContain('tax_filing');
    expect(migration).toContain('tax_remittance');
    expect(migration).toContain('direct_deposit');
  });
});
