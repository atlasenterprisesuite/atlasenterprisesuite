import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source=readFileSync('supabase/functions/atlas-payroll-run/index.ts','utf8');

describe('payroll run function contract',()=>{
  it('derives organization from authenticated membership and never accepts client totals',()=>{
    expect(source).toContain("from('organization_members')");
    expect(source).toContain("eq('user_id',userData.user.id)");
    expect(source).not.toContain('body.gross_pay_cents');
    expect(source).not.toContain('body.net_pay_cents');
  });
  it('fails closed without a validated sourced tax rule',()=>{
    expect(source).toContain("eq('validated',true)");
    expect(source).toContain("blocked:'tax_rule_unavailable'");
    expect(source).toContain('source_reference');
  });
  it('requires approval before processing and persists immutable calculation snapshots',()=>{
    expect(source).toContain("approved:['processing','cancelled']");
    expect(source).toContain("status:'processing'");
    expect(source).toContain("from('payroll_calculations').upsert");
    expect(source).toContain('immutable_input');
    expect(source).toContain('checksum');
  });
  it('locks approved time into the payroll run',()=>{
    expect(source).toContain('locked_by_run_id:run.id');
    expect(source).toContain("approval_status!=='approved'");
  });
});
