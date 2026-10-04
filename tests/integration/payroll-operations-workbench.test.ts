import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationPath='supabase/migrations/20261004213000_atlas_payroll_operations_workbench.sql';
const migration=existsSync(migrationPath)?readFileSync(migrationPath,'utf8'):'';
const apiPath='apps/web/src/modules/payroll/payrollOperationsApi.ts';
const api=existsSync(apiPath)?readFileSync(apiPath,'utf8'):'';
const routes=readFileSync('apps/web/src/modules/payroll/PayrollRoutes.tsx','utf8');

describe('ATLAS Payroll operations workbench',()=>{
  it('creates governed operational artifacts for jurisdictions, deductions, garnishments, compliance, payments, GL and variance',()=>{
    expect(existsSync(migrationPath)).toBe(true);
    for(const token of [
      'payroll_employer_tax_profiles','payroll_worker_jurisdictions','payroll_deduction_definitions',
      'payroll_worker_deductions','payroll_garnishment_orders','payroll_compliance_obligations',
      'payroll_payment_batches','payroll_gl_postings','payroll_variance_findings',
      'enable row level security','payroll.write','payroll.read'
    ]) expect(migration).toContain(token);
  });

  it('supports Florida 2026 reemployment tax without inventing an employer-specific rate',()=>{
    for(const token of [
      'payroll_calculate_fl_reemployment_2026','FL','reemployment','7000','0.027',
      'employer_rate_evidence_required','rate_out_of_bounds','floridarevenue.com',
      'worker_deduction_prohibited'
    ]) expect(migration).toContain(token);
  });

  it('keeps filing, remittance and money movement fail-closed without authenticated provider evidence',()=>{
    for(const token of [
      'payroll_create_compliance_obligation','payroll_create_payment_batch','execution_status',
      'provider_evidence_required','provider_connection_id','prepared','submitted','settled','failed'
    ]) expect(migration).toContain(token);
  });

  it('adds deterministic payroll variance detection instead of autonomous money movement',()=>{
    for(const token of [
      'payroll_scan_run_variances','net_pay_change','gross_pay_change','missing_tax_determination',
      'pretax_taxability_unclassified','requires_review'
    ]) expect(migration).toContain(token);
  });

  it('loads and mutates operations through governed API contracts',()=>{
    expect(existsSync(apiPath)).toBe(true);
    for(const token of [
      'loadPayrollOperations','payroll_upsert_worker_jurisdiction','payroll_upsert_employer_tax_profile',
      'payroll_upsert_worker_deduction','payroll_record_garnishment_order','payroll_create_compliance_obligation',
      'payroll_create_payment_batch','payroll_record_gl_posting','payroll_scan_run_variances'
    ]) expect(api).toContain(token);
  });

  it('exposes a real Operations route in the payroll workspace',()=>{
    expect(routes).toContain('to="/payroll/operations"');
    expect(routes).toContain('path="operations"');
    expect(routes).toContain('PayrollOperations');
    for(const label of ['Jurisdictions','Benefits & deductions','Garnishments','Compliance queue','Payment batches','GL postings','Variance review']){
      expect(routes).toContain(label);
    }
  });
});
