import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration=readFileSync('supabase/migrations/20260923203000_atlas_payroll_core.sql','utf8');
const api=readFileSync('apps/web/src/modules/payroll/payrollApi.ts','utf8');
const routes=readFileSync('apps/web/src/modules/payroll/PayrollRoutes.tsx','utf8');
const registry=readFileSync('apps/web/src/modules/registry.ts','utf8');

describe('ATLAS Payroll governed core',()=>{
  it('persists schedules, runs and calculated worker lines under RLS and audit',()=>{
    for(const table of ['payroll_schedules','payroll_runs','payroll_run_lines']) expect(migration).toContain(`public.${table}`);
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('public.audit_row_change()');
    expect(migration).toContain("public.has_identity_permission(org_id,'payroll.read')");
  });

  it('computes gross and net server-side and prevents locked mutation',()=>{
    expect(migration).toContain("coalesce(p_overtime_hours,0)*p_hourly_rate*coalesce(p_overtime_multiplier,1.5)");
    expect(migration).toContain("v_net:=round(v_gross-coalesce(p_pretax_deductions,0)-coalesce(p_taxes_withheld,0)-coalesce(p_posttax_deductions,0),2)");
    expect(migration).toContain("locked_payroll_run_immutable");
    expect(migration).toContain("'direct_deposit_executed',false");
    expect(migration).toContain("'tax_filing_executed',false");
  });

  it('exposes governed run creation, line calculation and approval routes',()=>{
    for(const rpc of ['payroll_create_schedule','payroll_create_run','payroll_upsert_line','payroll_transition_run']) {
      expect(api).toContain(`'${rpc}'`);
      expect(migration).toContain(`function public.${rpc}`);
    }
    expect(routes).toContain('Create pay run');
    expect(routes).toContain('Add / update worker line');
    expect(routes).toContain('Calculate');
    expect(routes).toContain('Approve');
    expect(routes).toContain('Lock');
  });

  it('keeps external payment and tax rails truthfully gated',()=>{
    expect(routes).toContain('Tax determination & filing');
    expect(routes).toContain('Not configured');
    expect(routes).toContain('Direct deposit');
    expect(routes).toContain('No bank transfer is represented as paid');
    const start=registry.indexOf("id: 'payroll'");
    const block=registry.slice(start,registry.indexOf('\n  {',start+1));
    expect(block).toContain("readiness: 'external-gated'");
  });
});
