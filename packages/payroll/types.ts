export type PayrollRunStatus =
  | 'draft' | 'review' | 'awaiting_approval' | 'approved'
  | 'processing' | 'processed' | 'posted'
  | 'blocked' | 'failed' | 'cancelled' | 'reversed';

export type BillingMode = 'customer' | 'internal_comp';
export type BillingStatus =
  | 'not_configured' | 'trial' | 'active' | 'past_due'
  | 'grace_period' | 'suspended' | 'cancelled' | 'internal_comp';

export type PayrollEntitlement =
  | 'payroll.core' | 'payroll.time' | 'payroll.contractors'
  | 'payroll.benefits_admin' | 'payroll.tax_filing'
  | 'payroll.direct_deposit' | 'payroll.priority_support'
  | 'payroll.hr_resources';

export type PayrollCalculationInput = {
  workerId: string;
  periodStart: string;
  periodEnd: string;
  taxableEarningsCents: number;
  nonTaxableEarningsCents: number;
  reimbursementsCents: number;
  pretaxDeductionsCents: number;
  postTaxDeductionsCents: number;
  garnishmentsCents: number;
};

export type PayrollCalculationResult = {
  taxableWageBaseCents: number;
  employeeTaxesCents: number;
  employerTaxesCents: number;
  netPayCents: number;
  ruleVersion: string;
  checksum: string;
};

export type PayrollJournalStatus =
  | 'not_generated' | 'generated' | 'awaiting_posting_approval'
  | 'posted' | 'posting_failed';

export type PayrollJournalInput = {
  runId: string;
  wageExpenseCents: number;
  employerTaxExpenseCents: number;
  employeeTaxLiabilityCents: number;
  employerTaxLiabilityCents: number;
  benefitsLiabilityCents: number;
  garnishmentLiabilityCents: number;
  netPayrollPayableCents: number;
};
