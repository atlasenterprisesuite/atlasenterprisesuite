import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationPath = 'supabase/migrations/20261004190000_atlas_payroll_control_plane.sql';
const settlementFixPath = 'supabase/migrations/20261004191500_atlas_payroll_settlement_guard.sql';
const readinessFixPath = 'supabase/migrations/20261004193000_atlas_payroll_readiness_security.sql';
const providerGrantFixPath = 'supabase/migrations/20261004194500_atlas_payroll_provider_column_security.sql';
const leastPrivilegeFixPath = 'supabase/migrations/20261004195000_atlas_people_payroll_least_privilege.sql';
const apiPath = 'apps/web/src/modules/payroll/payrollApi.ts';
const routesPath = 'apps/web/src/modules/payroll/PayrollRoutes.tsx';
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';
const settlementFix = existsSync(settlementFixPath) ? readFileSync(settlementFixPath, 'utf8') : '';
const readinessFix = existsSync(readinessFixPath) ? readFileSync(readinessFixPath, 'utf8') : '';
const providerGrantFix = existsSync(providerGrantFixPath) ? readFileSync(providerGrantFixPath, 'utf8') : '';
const leastPrivilegeFix = existsSync(leastPrivilegeFixPath) ? readFileSync(leastPrivilegeFixPath, 'utf8') : '';
const normalizedProviderGrantFix = providerGrantFix.replace(/\s+/g, ' ').trim();
const normalizedLeastPrivilegeFix = leastPrivilegeFix.replace(/\s+/g, ' ').trim();
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

  it('hardens readiness to invoker rights and verified providers to server-side credentials', () => {
    expect(existsSync(readinessFixPath)).toBe(true);
    expect(readinessFix).toContain('alter function public.payroll_get_capability_readiness(uuid) security invoker');
    expect(readinessFix).toContain('payroll_provider_verified_evidence_check');
    expect(readinessFix).toContain("nullif(btrim(credentials_ref),'') is not null");
  });

  it('does not expose provider credential references to authenticated payroll readers', () => {
    expect(existsSync(providerGrantFixPath)).toBe(true);
    expect(normalizedProviderGrantFix).toContain('revoke select on public.payroll_provider_connections from authenticated');
    expect(normalizedProviderGrantFix).toContain('grant select ( id, org_id, provider_key, environment, status, capabilities, last_verified_at, created_at, updated_at ) on public.payroll_provider_connections to authenticated');
    expect(normalizedProviderGrantFix).not.toContain('grant select ( credentials_ref');
    expect(normalizedProviderGrantFix).not.toContain('grant select ( verification_evidence_hash');
  });

  it('removes inherited destructive table privileges from anonymous and authenticated roles', () => {
    expect(existsSync(leastPrivilegeFixPath)).toBe(true);
    expect(normalizedLeastPrivilegeFix).toContain('revoke all privileges on table public.people_workers');
    expect(normalizedLeastPrivilegeFix).toContain('revoke all privileges on table public.payroll_schedules');
    expect(normalizedLeastPrivilegeFix).toContain('from anon');
    expect(normalizedLeastPrivilegeFix).toContain('revoke truncate, references, trigger on table public.people_workers');
    expect(normalizedLeastPrivilegeFix).toContain('revoke truncate, references, trigger on table public.payroll_execution_evidence');
    expect(normalizedLeastPrivilegeFix).toContain('from authenticated');
    expect(normalizedLeastPrivilegeFix).toContain('grant select on table public.people_workers');
    expect(normalizedLeastPrivilegeFix).toContain('grant select on table public.payroll_execution_evidence');
    expect(normalizedLeastPrivilegeFix).toContain('grant select ( id, org_id, provider_key, environment, status, capabilities, last_verified_at, created_at, updated_at ) on table public.payroll_provider_connections');
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
