import { describe, expect, it } from 'vitest';
import { basisPointRuleSet, calculatePayroll } from '../../packages/payroll';

describe('payroll calculation', () => {
  it('is deterministic for immutable integer-cent inputs', () => {
    const input = {
      workerId:'worker-1',periodStart:'2026-09-01',periodEnd:'2026-09-15',
      taxableEarningsCents:200000,nonTaxableEarningsCents:0,reimbursementsCents:10000,
      pretaxDeductionsCents:20000,postTaxDeductionsCents:5000,garnishmentsCents:0
    };
    const ruleSet = basisPointRuleSet({jurisdiction:'TEST',version:'fixture-1',effectiveFrom:'2026-01-01',employeeTaxBps:1000,employerTaxBps:500});
    const first=calculatePayroll(input,ruleSet);
    expect(calculatePayroll(input,ruleSet)).toEqual(first);
    expect(first.netPayCents).toBe(167000);
    expect(first.checksum).toMatch(/^[a-f0-9]{64}$/);
  });
});
