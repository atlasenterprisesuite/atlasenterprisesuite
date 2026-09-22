import {
  buildPersonalLineRollup,
  type ProductiveTaxFact
} from './productiveCalculations';

export type FilingStatus2025 =
  | 'single'
  | 'married-filing-jointly'
  | 'married-filing-separately'
  | 'head-of-household'
  | 'qualifying-surviving-spouse';

export type StandardDeductionContext2025 = {
  filingStatus: FilingStatus2025;
  canBeClaimedAsDependent?: boolean;
  earnedIncome?: number;
  spouseItemizesSeparateReturn?: boolean;
  dualStatusAlien?: boolean;
  taxpayer65OrOlder?: boolean;
  taxpayerBlind?: boolean;
  spouse65OrOlder?: boolean;
  spouseBlind?: boolean;
};

export type StandardDeductionResult2025 = {
  amount: number | null;
  baseAmount: number;
  additionalAmount: number;
  status: 'calculated' | 'blocked';
  reviewFlags: string[];
};

export type Form1040CoreInputs2025 = {
  facts: readonly ProductiveTaxFact[];
  filingStatus: FilingStatus2025;
  standardDeductionContext: Omit<StandardDeductionContext2025, 'filingStatus'>;
  schedule1AdditionalIncome?: number;
  schedule1Adjustments?: number;
  taxableSocialSecurityBenefits?: number;
  scheduleDNetCapitalGainLoss?: number;
  pensionsAndAnnuitiesTaxable?: number;
  iraDistributionsTaxable?: number;
  otherCoreIncome?: number;
  itemizedDeductions?: number;
  itemizedDeductionsReviewed?: boolean;
  qbiDeduction?: number;
  qbiDeductionReviewed?: boolean;
  schedule1AAdditionalDeductions?: number;
  schedule1AReviewed?: boolean;
};

export type Form1040CoreResult2025 = {
  taxYear: 2025;
  filingStatus: FilingStatus2025;
  lines: {
    line1aW2Wages: number;
    line1cTips: number;
    line2aTaxExemptInterest: number;
    line2bTaxableInterest: number;
    line3aQualifiedDividends: number;
    line3bOrdinaryDividends: number;
    line5bTaxablePensionsAnnuities: number;
    line4bTaxableIraDistributions: number;
    line6aSocialSecurityBenefits: number;
    line6bTaxableSocialSecurityBenefits: number | null;
    line7CapitalGainLoss: number;
    line8Schedule1AdditionalIncome: number;
    line9TotalIncome: number | null;
    line10Schedule1Adjustments: number;
    line11bAdjustedGrossIncome: number | null;
    line12eStandardOrItemizedDeduction: number | null;
    line13aQbiDeduction: number;
    line13bSchedule1AAdditionalDeductions: number;
    line14TotalDeductions: number | null;
    line15TaxableIncome: number | null;
    line25aW2Withholding: number;
    line25bOtherWithholding: number;
  };
  deductionMethod: 'standard' | 'itemized' | 'blocked';
  standardDeduction: StandardDeductionResult2025;
  ordinaryRateScheduleTaxEstimate: number | null;
  line16Status: 'not-calculated' | 'rate-schedule-estimate-only';
  blockers: string[];
  reviewFlags: string[];
};

const BASE_STANDARD_DEDUCTION_2025: Record<FilingStatus2025, number> = {
  single: 15750,
  'married-filing-jointly': 31500,
  'married-filing-separately': 15750,
  'head-of-household': 23625,
  'qualifying-surviving-spouse': 31500
};

const BRACKETS_2025: Record<FilingStatus2025, Array<{ upTo: number; rate: number }>> = {
  single: [
    { upTo: 11925, rate: 0.10 },
    { upTo: 48475, rate: 0.12 },
    { upTo: 103350, rate: 0.22 },
    { upTo: 197300, rate: 0.24 },
    { upTo: 250525, rate: 0.32 },
    { upTo: 626350, rate: 0.35 },
    { upTo: Number.POSITIVE_INFINITY, rate: 0.37 }
  ],
  'married-filing-jointly': [
    { upTo: 23850, rate: 0.10 },
    { upTo: 96950, rate: 0.12 },
    { upTo: 206700, rate: 0.22 },
    { upTo: 394600, rate: 0.24 },
    { upTo: 501050, rate: 0.32 },
    { upTo: 751600, rate: 0.35 },
    { upTo: Number.POSITIVE_INFINITY, rate: 0.37 }
  ],
  'qualifying-surviving-spouse': [
    { upTo: 23850, rate: 0.10 },
    { upTo: 96950, rate: 0.12 },
    { upTo: 206700, rate: 0.22 },
    { upTo: 394600, rate: 0.24 },
    { upTo: 501050, rate: 0.32 },
    { upTo: 751600, rate: 0.35 },
    { upTo: Number.POSITIVE_INFINITY, rate: 0.37 }
  ],
  'married-filing-separately': [
    { upTo: 11925, rate: 0.10 },
    { upTo: 48475, rate: 0.12 },
    { upTo: 103350, rate: 0.22 },
    { upTo: 197300, rate: 0.24 },
    { upTo: 250525, rate: 0.32 },
    { upTo: 375800, rate: 0.35 },
    { upTo: Number.POSITIVE_INFINITY, rate: 0.37 }
  ],
  'head-of-household': [
    { upTo: 17000, rate: 0.10 },
    { upTo: 64850, rate: 0.12 },
    { upTo: 103350, rate: 0.22 },
    { upTo: 197300, rate: 0.24 },
    { upTo: 250500, rate: 0.32 },
    { upTo: 626350, rate: 0.35 },
    { upTo: Number.POSITIVE_INFINITY, rate: 0.37 }
  ]
};

function finiteOrZero(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function countAgeBlindBoxes(context: StandardDeductionContext2025): number {
  let boxes = 0;
  if (context.taxpayer65OrOlder) boxes += 1;
  if (context.taxpayerBlind) boxes += 1;
  if (
    context.filingStatus === 'married-filing-jointly' ||
    context.filingStatus === 'married-filing-separately' ||
    context.filingStatus === 'qualifying-surviving-spouse'
  ) {
    if (context.spouse65OrOlder) boxes += 1;
    if (context.spouseBlind) boxes += 1;
  }
  return boxes;
}

export function calculateStandardDeduction2025(
  context: StandardDeductionContext2025
): StandardDeductionResult2025 {
  const baseAmount = BASE_STANDARD_DEDUCTION_2025[context.filingStatus];
  const reviewFlags: string[] = [];

  if (context.spouseItemizesSeparateReturn) {
    return {
      amount: 0,
      baseAmount,
      additionalAmount: 0,
      status: 'calculated',
      reviewFlags: ['Spouse itemizes on a separate return; 2025 standard deduction is zero.']
    };
  }

  if (context.dualStatusAlien) {
    return {
      amount: null,
      baseAmount,
      additionalAmount: 0,
      status: 'blocked',
      reviewFlags: ['Dual-status alien standard-deduction treatment requires a dedicated residency/treaty workflow.']
    };
  }

  const boxes = countAgeBlindBoxes(context);
  const perBox =
    context.filingStatus === 'single' || context.filingStatus === 'head-of-household'
      ? 2000
      : 1600;
  const additionalAmount = boxes * perBox;

  let baseAllowed = baseAmount;
  if (context.canBeClaimedAsDependent) {
    const earnedIncome = finiteOrZero(context.earnedIncome);
    const dependentBase = Math.max(1350, earnedIncome + 450);
    baseAllowed = Math.min(baseAmount, dependentBase);
    reviewFlags.push('Dependent standard deduction calculated from the 2025 dependent worksheet.');
  }

  return {
    amount: baseAllowed + additionalAmount,
    baseAmount: baseAllowed,
    additionalAmount,
    status: 'calculated',
    reviewFlags
  };
}

export function calculateOrdinaryRateScheduleTax2025(
  taxableIncome: number,
  filingStatus: FilingStatus2025
): number {
  if (!Number.isFinite(taxableIncome) || taxableIncome < 0) {
    throw new Error('invalid_taxable_income');
  }
  if (taxableIncome === 0) return 0;

  let priorLimit = 0;
  let tax = 0;
  for (const bracket of BRACKETS_2025[filingStatus]) {
    const taxableInBracket = Math.max(0, Math.min(taxableIncome, bracket.upTo) - priorLimit);
    tax += taxableInBracket * bracket.rate;
    if (taxableIncome <= bracket.upTo) break;
    priorLimit = bracket.upTo;
  }
  return Number(tax.toFixed(2));
}

function sumFactsByPrefix(facts: readonly ProductiveTaxFact[], prefix: string): number {
  return facts.reduce((sum, fact) => {
    if (!fact.isCurrent || fact.reviewState === 'rejected' || !fact.taxFactKey.startsWith(prefix)) return sum;
    const raw = fact.value && typeof fact.value === 'object' && 'amount' in fact.value
      ? Number((fact.value as { amount?: unknown }).amount)
      : Number(fact.value);
    return Number.isFinite(raw) ? sum + raw : sum;
  }, 0);
}

export function buildForm1040Core2025(inputs: Form1040CoreInputs2025): Form1040CoreResult2025 {
  const rollup = buildPersonalLineRollup(inputs.facts);
  const blockers: string[] = [];
  const reviewFlags: string[] = [];

  const socialSecurityGross = sumFactsByPrefix(inputs.facts, 'socialSecurityBenefitsGross');
  const socialSecurityTaxable = inputs.taxableSocialSecurityBenefits;

  if (socialSecurityGross > 0 && !Number.isFinite(socialSecurityTaxable)) {
    blockers.push('Social Security benefits require an approved taxable-benefits worksheet before Form 1040 line 6b can be finalized.');
  }
  if (Number.isFinite(socialSecurityTaxable) && finiteOrZero(socialSecurityTaxable) > socialSecurityGross && socialSecurityGross > 0) {
    blockers.push('Taxable Social Security benefits cannot exceed gross benefits without a reviewed exception.');
  }

  const capitalGainLoss = finiteOrZero(inputs.scheduleDNetCapitalGainLoss);
  const schedule1AdditionalIncome = finiteOrZero(inputs.schedule1AdditionalIncome);
  const schedule1Adjustments = finiteOrZero(inputs.schedule1Adjustments);
  const pensions = finiteOrZero(inputs.pensionsAndAnnuitiesTaxable);
  const ira = finiteOrZero(inputs.iraDistributionsTaxable);
  const otherCoreIncome = finiteOrZero(inputs.otherCoreIncome);

  const line9 =
    blockers.length && socialSecurityGross > 0 && !Number.isFinite(socialSecurityTaxable)
      ? null
      : Number((
          rollup.line1aW2Wages +
          rollup.line1cTips +
          rollup.line2bTaxableInterest +
          rollup.line3bOrdinaryDividends +
          pensions +
          ira +
          finiteOrZero(socialSecurityTaxable) +
          capitalGainLoss +
          schedule1AdditionalIncome +
          otherCoreIncome
        ).toFixed(2));

  const line11b = line9 === null ? null : Number((line9 - schedule1Adjustments).toFixed(2));

  const standardDeduction = calculateStandardDeduction2025({
    filingStatus: inputs.filingStatus,
    ...inputs.standardDeductionContext
  });
  reviewFlags.push(...standardDeduction.reviewFlags);
  if (standardDeduction.status === 'blocked') blockers.push(...standardDeduction.reviewFlags);

  const itemized = finiteOrZero(inputs.itemizedDeductions);
  const hasItemized = itemized > 0;
  if (hasItemized && !inputs.itemizedDeductionsReviewed) {
    blockers.push('Itemized deduction amount must be reviewed before it can replace the standard deduction.');
  }

  let deductionMethod: Form1040CoreResult2025['deductionMethod'] = 'blocked';
  let line12e: number | null = null;
  if (standardDeduction.amount !== null && (!hasItemized || inputs.itemizedDeductionsReviewed)) {
    if (hasItemized && itemized > standardDeduction.amount) {
      deductionMethod = 'itemized';
      line12e = itemized;
    } else {
      deductionMethod = 'standard';
      line12e = standardDeduction.amount;
    }
  }

  const qbi = finiteOrZero(inputs.qbiDeduction);
  if (qbi > 0 && !inputs.qbiDeductionReviewed) {
    blockers.push('QBI deduction requires an approved Form 8995/8995-A calculation.');
  }

  const schedule1A = finiteOrZero(inputs.schedule1AAdditionalDeductions);
  if (schedule1A > 0 && !inputs.schedule1AReviewed) {
    blockers.push('Schedule 1-A additional deductions require an approved Schedule 1-A calculation.');
  }

  const line14 =
    line12e === null
      ? null
      : Number((line12e + qbi + schedule1A).toFixed(2));
  const line15 =
    line11b === null || line14 === null
      ? null
      : Math.max(0, Number((line11b - line14).toFixed(2)));

  const specialTaxMethodRequired =
    rollup.line3aQualifiedDividends > 0 ||
    capitalGainLoss > 0 ||
    inputs.facts.some((fact) =>
      fact.isCurrent &&
      (
        fact.taxFactKey.includes('section1231') ||
        fact.taxFactKey.includes('capitalGainDistributions') ||
        fact.taxFactKey.includes('foreignEarnedIncome')
      )
    );

  if (rollup.line3aQualifiedDividends > 0) {
    reviewFlags.push('Qualified dividends require the Qualified Dividends and Capital Gain Tax Worksheet or another applicable line 16 method.');
  }
  if (capitalGainLoss > 0) {
    reviewFlags.push('Positive net capital gain can require the Qualified Dividends and Capital Gain Tax Worksheet or Schedule D Tax Worksheet.');
  }
  if (line15 !== null && line15 < 100000) {
    reviewFlags.push('Form 1040 line 16 normally uses the 2025 Tax Table below $100,000; the rate-schedule result is informational only.');
  }

  const ordinaryRateScheduleTaxEstimate =
    line15 === null ? null : calculateOrdinaryRateScheduleTax2025(line15, inputs.filingStatus);

  if (specialTaxMethodRequired) {
    reviewFlags.push('A special line 16 tax method is required; ordinary rate-schedule tax cannot be promoted to the filed line 16 amount.');
  }

  return {
    taxYear: 2025,
    filingStatus: inputs.filingStatus,
    lines: {
      line1aW2Wages: rollup.line1aW2Wages,
      line1cTips: rollup.line1cTips,
      line2aTaxExemptInterest: rollup.line2aTaxExemptInterest,
      line2bTaxableInterest: rollup.line2bTaxableInterest,
      line3aQualifiedDividends: rollup.line3aQualifiedDividends,
      line3bOrdinaryDividends: rollup.line3bOrdinaryDividends,
      line5bTaxablePensionsAnnuities: pensions,
      line4bTaxableIraDistributions: ira,
      line6aSocialSecurityBenefits: socialSecurityGross,
      line6bTaxableSocialSecurityBenefits: Number.isFinite(socialSecurityTaxable) ? finiteOrZero(socialSecurityTaxable) : null,
      line7CapitalGainLoss: capitalGainLoss,
      line8Schedule1AdditionalIncome: schedule1AdditionalIncome,
      line9TotalIncome: line9,
      line10Schedule1Adjustments: schedule1Adjustments,
      line11bAdjustedGrossIncome: line11b,
      line12eStandardOrItemizedDeduction: line12e,
      line13aQbiDeduction: qbi,
      line13bSchedule1AAdditionalDeductions: schedule1A,
      line14TotalDeductions: line14,
      line15TaxableIncome: line15,
      line25aW2Withholding: rollup.line25aW2Withholding,
      line25bOtherWithholding: rollup.line25b1099Withholding
    },
    deductionMethod,
    standardDeduction,
    ordinaryRateScheduleTaxEstimate,
    line16Status: ordinaryRateScheduleTaxEstimate === null ? 'not-calculated' : 'rate-schedule-estimate-only',
    blockers: Array.from(new Set(blockers)),
    reviewFlags: Array.from(new Set(reviewFlags))
  };
}
