import type { FilingStatus2025 } from './individual1040Engine';

export type Line16Method2025 =
  | 'tax-table'
  | 'tax-computation-worksheet'
  | 'qualified-dividends-capital-gain-worksheet'
  | 'schedule-d-tax-worksheet'
  | 'form-8615'
  | 'schedule-j'
  | 'foreign-earned-income-tax-worksheet';

export type Line16MethodInputs2025 = {
  filingStatus: FilingStatus2025;
  taxableIncome: number;
  qualifiedDividends?: number;
  capitalGainDistributionsWithoutScheduleD?: number;
  scheduleDRequired?: boolean;
  scheduleDLine15?: number;
  scheduleDLine16?: number;
  scheduleDLine18?: number;
  scheduleDLine19?: number;
  form4952Line4g?: number;
  form8615Required?: boolean;
  scheduleJElected?: boolean;
  form2555Filed?: boolean;
};

export type Line16MethodResult2025 = {
  taxYear: 2025;
  method: Line16Method2025;
  reason: string;
  filingStatus: FilingStatus2025;
  taxableIncome: number;
  canCalculateWithCurrentCore: boolean;
  blockers: string[];
};

const n = (value: number | undefined) => Number.isFinite(value) ? Number(value) : 0;

export function resolveLine16Method2025(input: Line16MethodInputs2025): Line16MethodResult2025 {
  if (!Number.isFinite(input.taxableIncome) || input.taxableIncome < 0) throw new Error('invalid_line16_taxable_income');

  const base = {
    taxYear: 2025 as const,
    filingStatus: input.filingStatus,
    taxableIncome: input.taxableIncome,
    blockers: [] as string[]
  };

  if (input.form8615Required) {
    return { ...base, method: 'form-8615', reason: 'Form 8615 is required for the taxpayer facts and supersedes ordinary line 16 computation.', canCalculateWithCurrentCore: false };
  }

  if (input.form2555Filed) {
    return { ...base, method: 'foreign-earned-income-tax-worksheet', reason: 'Form 2555 requires the Foreign Earned Income Tax Worksheet for line 16.', canCalculateWithCurrentCore: false };
  }

  if (input.scheduleJElected) {
    return { ...base, method: 'schedule-j', reason: 'Taxpayer elected farm/fishing income averaging on Schedule J.', canCalculateWithCurrentCore: false };
  }

  const scheduleDGainConditions = Boolean(input.scheduleDRequired) && n(input.scheduleDLine15) > 0 && n(input.scheduleDLine16) > 0;
  if (
    (scheduleDGainConditions && (n(input.scheduleDLine18) > 0 || n(input.scheduleDLine19) > 0)) ||
    n(input.form4952Line4g) > 0
  ) {
    return {
      ...base,
      method: 'schedule-d-tax-worksheet',
      reason: 'Schedule D special-rate gain or Form 4952 investment-interest facts require the Schedule D Tax Worksheet.',
      canCalculateWithCurrentCore: false
    };
  }

  if (
    n(input.qualifiedDividends) > 0 ||
    (!input.scheduleDRequired && n(input.capitalGainDistributionsWithoutScheduleD) > 0) ||
    scheduleDGainConditions
  ) {
    return {
      ...base,
      method: 'qualified-dividends-capital-gain-worksheet',
      reason: 'Qualified dividends or eligible net capital gain require the Qualified Dividends and Capital Gain Tax Worksheet.',
      canCalculateWithCurrentCore: false
    };
  }

  if (input.taxableIncome < 100000) {
    return {
      ...base,
      method: 'tax-table',
      reason: '2025 Form 1040 line 16 uses the Tax Table when taxable income is below $100,000 and no special method applies.',
      canCalculateWithCurrentCore: false,
      blockers: ['Tax Table lookup engine is required for an exact filed line 16 amount below $100,000.']
    };
  }

  return {
    ...base,
    method: 'tax-computation-worksheet',
    reason: '2025 taxable income is $100,000 or more and no special line 16 method applies.',
    canCalculateWithCurrentCore: true
  };
}

const ZERO_RATE_THRESHOLD_2025: Record<FilingStatus2025, number> = {
  single: 48350,
  'married-filing-separately': 48350,
  'married-filing-jointly': 96700,
  'qualifying-surviving-spouse': 96700,
  'head-of-household': 64750
};

const FIFTEEN_RATE_CEILING_2025: Record<FilingStatus2025, number> = {
  single: 533400,
  'married-filing-separately': 300000,
  'married-filing-jointly': 600050,
  'qualifying-surviving-spouse': 600050,
  'head-of-household': 566700
};

export function calculateQualifiedDividendsCapitalGainWorksheet2025(input: {
  filingStatus: FilingStatus2025;
  taxableIncome: number;
  qualifiedDividends: number;
  scheduleDNetLongTermGainOrLine7aGain: number;
  ordinaryTax: (taxableIncome: number) => number;
}): { tax: number; lines: Record<string, number> } {
  const line1 = n(input.taxableIncome);
  const line2 = Math.max(0, n(input.qualifiedDividends));
  const line3 = Math.max(0, n(input.scheduleDNetLongTermGainOrLine7aGain));
  const line4 = line2 + line3;
  const line5 = Math.max(0, line1 - line4);
  const line6 = ZERO_RATE_THRESHOLD_2025[input.filingStatus];
  const line7 = Math.min(line1, line6);
  const line8 = Math.min(line5, line7);
  const line9 = Math.max(0, line7 - line8);
  const line10 = Math.min(line1, line4);
  const line11 = line9;
  const line12 = Math.max(0, line10 - line11);
  const line13 = FIFTEEN_RATE_CEILING_2025[input.filingStatus];
  const line14 = Math.min(line1, line13);
  const line15 = line5 + line9;
  const line16 = Math.max(0, line14 - line15);
  const line17 = Math.min(line12, line16);
  const line18 = line17 * 0.15;
  const line19 = line9 + line17;
  const line20 = Math.max(0, line10 - line19);
  const line21 = line20 * 0.20;
  const line22 = input.ordinaryTax(line5);
  const line23 = line18 + line21 + line22;
  const line24 = input.ordinaryTax(line1);
  const line25 = Math.min(line23, line24);

  return {
    tax: Number(line25.toFixed(2)),
    lines: Object.fromEntries(
      Object.entries({ line1,line2,line3,line4,line5,line6,line7,line8,line9,line10,line11,line12,line13,line14,line15,line16,line17,line18,line19,line20,line21,line22,line23,line24,line25 })
        .map(([key,value]) => [key, Number(value.toFixed(2))])
    )
  };
}
