import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationPath = 'supabase/migrations/20261004190000_atlas_payroll_control_plane.sql';
const settlementFixPath = 'supabase/migrations/20261004191500_atlas_payroll_settlement_guard.sql';
const apiPath = 'apps/web/src/modules/payroll/payrollApi.ts';
const routesPath = 'apps/web/src/modules/payroll/PayrollRoutes.tsx';
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';
const settlementFix = existsSync(settlementFixPath) ? readFileSync(settlementFixPath, 'utf8') : '';
const api = readFileSync(apiPath, 'utf8');
const routes = readFileSync(routesPath, 'utf8');

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

  it('requires immutable provider evidence before settled on insert or update', () => {
    expect(existsSync(settlementFixPath)).toBe(true);
    expect(settlementFix).toContain("tg_op = 'INSERT'");
    expect(settlementFix).toContain("e.normalized_state = 'settled'");
    expect(settlementFix).toContain("nullif(btrim(e.payload_hash),'') is not null");
    expect(settlementFix).toContain('before insert or update on public.payroll_execution_intents');
  });

  it('loads capability readiness from the governed RPC without inventing defaults', () => {
    expect(api).toContain('export type PayrollCapabilityState');
    expect(api).toContain('export type PayrollCapabilityReadiness');
    expect(api).toContain('readiness: PayrollCapabilityReadiness');
    expect(api).toContain("rpc/payroll_get_capability_readiness");
    expect(api).toContain('p_org_id: orgId');
  });

  it('renders the four backend readiness capabilities without manufacturing execution state', () => {
    expect(routes).toContain('d.readiness.capabilities');
    for (const label of ['Tax determination','Tax filing','Tax remittance','Direct deposit']) expect(routes).toContain(label);
    expect(routes).toContain("state.status==='ready'?'Ready':'Blocked'");
    expect(routes).toContain('{state.reason}');
    expect(routes).toContain('No money movement');
  });
});
