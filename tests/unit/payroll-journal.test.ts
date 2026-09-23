import { describe, expect, it } from 'vitest';
import { buildPayrollJournalContract } from '../../packages/payroll';

describe('payroll journal contract', () => {
  it('builds a balanced posting contract', () => {
    const journal=buildPayrollJournalContract({
      runId:'run-1',wageExpenseCents:200000,employerTaxExpenseCents:10000,
      employeeTaxLiabilityCents:20000,employerTaxLiabilityCents:10000,
      benefitsLiabilityCents:0,garnishmentLiabilityCents:0,netPayrollPayableCents:180000
    });
    expect(journal.totalDebitsCents).toBe(journal.totalCreditsCents);
    expect(journal.status).toBe('generated');
  });
  it('fails closed on an unbalanced contract', () => {
    expect(()=>buildPayrollJournalContract({
      runId:'run-2',wageExpenseCents:100,employerTaxExpenseCents:0,
      employeeTaxLiabilityCents:0,employerTaxLiabilityCents:0,
      benefitsLiabilityCents:0,garnishmentLiabilityCents:0,netPayrollPayableCents:99
    })).toThrow('unbalanced_payroll_journal');
  });
});
