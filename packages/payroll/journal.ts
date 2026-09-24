import type { PayrollJournalInput, PayrollJournalStatus } from './types';

export type PayrollJournalLine = {
  account: string;
  debitCents: number;
  creditCents: number;
};

export type PayrollJournalContract = {
  runId: string;
  status: PayrollJournalStatus;
  lines: PayrollJournalLine[];
  totalDebitsCents: number;
  totalCreditsCents: number;
};

export function buildPayrollJournalContract(input: PayrollJournalInput): PayrollJournalContract {
  const lines: PayrollJournalLine[] = [
    { account: 'wage_expense', debitCents: input.wageExpenseCents, creditCents: 0 },
    { account: 'employer_tax_expense', debitCents: input.employerTaxExpenseCents, creditCents: 0 },
    { account: 'employee_tax_liability', debitCents: 0, creditCents: input.employeeTaxLiabilityCents },
    { account: 'employer_tax_liability', debitCents: 0, creditCents: input.employerTaxLiabilityCents },
    { account: 'benefits_liability', debitCents: 0, creditCents: input.benefitsLiabilityCents },
    { account: 'garnishment_liability', debitCents: 0, creditCents: input.garnishmentLiabilityCents },
    { account: 'net_payroll_payable', debitCents: 0, creditCents: input.netPayrollPayableCents }
  ].filter((line) => line.debitCents !== 0 || line.creditCents !== 0);

  for (const line of lines) {
    if (!Number.isSafeInteger(line.debitCents) || !Number.isSafeInteger(line.creditCents) || line.debitCents < 0 || line.creditCents < 0) {
      throw new Error('invalid_journal_amount');
    }
  }
  const totalDebitsCents = lines.reduce((sum, line) => sum + line.debitCents, 0);
  const totalCreditsCents = lines.reduce((sum, line) => sum + line.creditCents, 0);
  if (totalDebitsCents !== totalCreditsCents) throw new Error('unbalanced_payroll_journal');

  return { runId: input.runId, status: 'generated', lines, totalDebitsCents, totalCreditsCents };
}
