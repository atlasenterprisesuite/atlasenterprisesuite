import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationPath='supabase/migrations/20261004203000_atlas_payroll_us_federal_tax_2026.sql';
const migration=existsSync(migrationPath)?readFileSync(migrationPath,'utf8'):'';

function ruleParams(){
  const match=migration.match(/\$atlas_rule\$(\{.*?\})\$atlas_rule\$/s);
  if(!match) return null;
  return JSON.parse(match[1]) as any;
}
function fit(params:any,args:{wages:number;frequency:string;status:string;step2?:boolean;credits?:number;otherIncome?:number;deductions?:number;extra?:number;exempt?:boolean}){
  if(args.exempt)return 0;
  const periods=params.pay_periods[args.frequency];
  const adjustment=args.step2?0:(args.status==='married_filing_jointly'?params.w4_adjustment.married_filing_jointly:params.w4_adjustment.other);
  const annualAdjusted=Math.max(0,args.wages*periods+(args.otherIncome||0)-(args.deductions||0)-adjustment);
  const table=params.annual_percentage_tables[args.step2?'step2_checkbox':'standard'][args.status];
  const row=table.find((r:any[])=>annualAdjusted>=r[0]&&(r[1]===null||annualAdjusted<r[1]));
  const annual=row[2]+(annualAdjusted-row[0])*row[3];
  return Math.round((Math.max(0,annual/periods-(args.credits||0)/periods)+(args.extra||0))*100)/100;
}

describe('ATLAS Payroll US federal tax determination Wave 2',()=>{
  it('adds authoritative versioned federal tax artifacts without claiming state/local coverage',()=>{
    expect(existsSync(migrationPath)).toBe(true);
    for(const token of [
      'payroll_federal_w4_elections','payroll_tax_determinations','payroll_calculate_us_federal_2026',
      'federal_standard_employee','full_us_payroll_tax','unsupported_w4_year','unsupported_nonresident_alien',
      'unsupported_wage_method','unsupported_special_tax_treatment','state_local_coverage_required'
    ]) expect(migration).toContain(token);
    expect(migration).toContain('https://www.irs.gov/publications/p15t');
    expect(migration).toContain('https://www.irs.gov/publications/p15');
    expect(migration).toContain('https://www.irs.gov/taxtopics/tc751');
    expect(migration).toContain('security invoker');
    expect(migration).toContain('enable row level security');
  });

  it('embeds an integrity-checksummed 2026 federal rule pack',()=>{
    const params=ruleParams();
    expect(params).not.toBeNull();
    expect(params.tax_year).toBe(2026);
    expect(params.coverage_level).toBe('federal_standard_employee');
    expect(params.pay_periods).toEqual({biweekly:26,monthly:12,semimonthly:24,weekly:52});
    const checksum=createHash('sha256').update(JSON.stringify(params)).digest('hex');
    expect(checksum).toBe('d12f065c13049b51362820958d48c94eca0334089d85f002444244725712656b');
  });

  it('matches 2026 IRS Worksheet 1A percentage-method regression vectors',()=>{
    const p=ruleParams(); expect(p).not.toBeNull();
    expect(fit(p,{wages:2000,frequency:'biweekly',status:'single_or_married_filing_separately'})).toBe(156.15);
    expect(fit(p,{wages:2000,frequency:'weekly',status:'married_filing_jointly'})).toBe(156.15);
    expect(fit(p,{wages:5000,frequency:'monthly',status:'head_of_household',step2:true})).toBe(582.83);
    expect(fit(p,{wages:5000,frequency:'monthly',status:'single_or_married_filing_separately',credits:1200,extra:50})).toBe(368.33);
    expect(fit(p,{wages:10000,frequency:'monthly',status:'single_or_married_filing_separately',exempt:true})).toBe(0);
  });

  it('encodes 2026 FICA/FUTA wage-base and threshold rules with FUTA credit fail-closed',()=>{
    const p=ruleParams(); expect(p).not.toBeNull();
    expect(p.fica.social_security_wage_base).toBe(184500);
    expect(p.fica.social_security_employee_rate).toBe(0.062);
    expect(p.fica.social_security_employer_rate).toBe(0.062);
    expect(p.fica.medicare_employee_rate).toBe(0.0145);
    expect(p.fica.medicare_employer_rate).toBe(0.0145);
    expect(p.fica.additional_medicare_employee_rate).toBe(0.009);
    expect(p.fica.additional_medicare_employer_threshold).toBe(200000);
    expect(p.futa.gross_rate).toBe(0.06);
    expect(p.futa.wage_base).toBe(7000);
    expect(p.futa.maximum_state_credit_rate).toBe(0.054);
    expect(p.futa.state_credit_requires_evidence).toBe(true);
    expect(migration).toContain("'futa_net_tax',null");
    expect(migration).toContain("'state_credit_status','evidence_required'");
  });

  it('persists a governed immutable determination bound to run, worker, W-4 and rule evidence',()=>{
    for(const token of [
      'payroll_determine_us_federal_2026','payroll_run_not_found','payroll_line_not_found',
      'w4_election_not_found','payroll_tax_determination_immutable','input_snapshot','output_snapshot',
      'input_hash','rule_checksum','w4_election_id'
    ]) expect(migration).toContain(token);
    expect(migration).toContain('select public.payroll_calculate_us_federal_2026');
    expect(migration).toContain("'w4_election_id',v_w4.id");
    expect(migration).toContain("'run_id',p_run_id");
    expect(migration).toContain('insert into public.payroll_tax_determinations');
    expect(migration).toContain('payroll_write_required');
  });

  it('keeps overall tax readiness blocked for a federal-only rule pack',()=>{
    expect(migration).toContain("parameters ->> 'coverage_level' = 'full_us_payroll_tax'");
    expect(migration).toContain('Federal 2026 determination is available, but required state/local payroll-tax coverage is not complete.');
  });
});
