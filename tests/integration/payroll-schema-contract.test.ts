import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql=readFileSync('supabase/migrations/20260923193000_payroll_core.sql','utf8');

describe('payroll schema contract',()=>{
  it('creates tenant-scoped core records and enables RLS',()=>{
    for(const table of ['payroll_workers','payroll_runs','payroll_billing_accounts','payroll_audit_events','payroll_tax_rule_sets']){
      expect(sql).toContain('create table if not exists public.'+table);
      expect(sql).toContain("'"+table+"'");
    }
    expect(sql).toContain('tenant_id uuid not null');
    expect(sql).toContain('organization_id uuid not null');
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('public.payroll_can_read');
    expect(sql).toContain('public.payroll_can_manage');
    expect(sql).toContain('public.payroll_can_create_run');
  });

  it('restricts internal comp and keeps sensitive provider data reference-only',()=>{
    expect(sql).toContain("billing_mode in ('customer','internal_comp')");
    expect(sql).toContain('platform.billing.internal_comp.manage');
    expect(sql).toContain('internal_comp_permission_required');
    expect(sql).toContain('account_last4');
    expect(sql).not.toContain('routing_number text');
    expect(sql).not.toContain('account_number text');
  });

  it('does not let browser RLS self-assert provider-verified states',()=>{
    expect(sql).toContain("ein_verification_status <> 'verified_external'");
    expect(sql).toContain("filing_status <> 'externally_verified'");
    expect(sql).toContain("verification_status <> 'verified'");
    expect(sql).not.toContain('payroll_scope_write_payroll_billing_accounts');
  });

  it('keeps tax rules validated, sourced and approval-backed',()=>{
    expect(sql).toContain('validated boolean not null default false');
    expect(sql).toContain('source_reference text');
    expect(sql).toContain('approved_by uuid');
    expect(sql).toContain('approved_at timestamptz');
    expect(sql).toContain("validated=false or (approved_by is not null and approved_at is not null and source_reference is not null)");
  });

  it('keeps historical configuration effective dated and audits sensitive mutations',()=>{
    expect(sql).toContain('effective_from date');
    expect(sql).toContain('effective_to date');
    expect(sql).toContain('payroll_audit_events');
    expect(sql).toContain('payroll_audit_sensitive_mutation');
    expect(sql).toContain("'billing_mode_change'");
  });
});
