import type { FilingStatus2025 } from './individual1040Engine';

export type ScheduleAInputs2025 = {
  filingStatus: FilingStatus2025;
  adjustedGrossIncome: number;
  medicalAndDentalExpenses?: number;
  stateLocalIncomeOrSalesTaxes?: number;
  realEstateTaxes?: number;
  personalPropertyTaxes?: number;
  saltModifiedAgiAddbacks?: number;
  otherDeductibleTaxes?: number;
  deductibleMortgageInterestAndPoints?: number;
  mortgageInterestReviewed?: boolean;
  investmentInterest?: number;
  investmentInterestReviewed?: boolean;
  charitableContributions?: number;
  charitableContributionsReviewed?: boolean;
  casualtyTheftLoss?: number;
  casualtyTheftLossReviewed?: boolean;
  otherItemizedDeductions?: number;
  otherItemizedDeductionsReviewed?: boolean;
};

export type ScheduleAResult2025 = {
  taxYear: 2025;
  medical: {
    expenses: number;
    agiThreshold: number;
    deductible: number;
  };
  taxes: {
    line5dPreLimitSalt: number;
    modifiedAgiForSalt: number;
    saltLimit: number;
    line5eSaltDeduction: number;
    otherTaxes: number;
    totalDeductibleTaxes: number;
  };
  interest: {
    mortgageInterestAndPoints: number;
    investmentInterest: number;
  };
  charitableContributions: number;
  casualtyTheftLoss: number;
  otherItemizedDeductions: number;
  totalItemizedDeductions: number | null;
  status: 'calculated' | 'blocked';
  blockers: string[];
  reviewFlags: string[];
};

function amount(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function nonnegative(value: number, code: string): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(code);
  return value;
}

export function calculateSaltDeduction2025(input: {
  filingStatus: FilingStatus2025;
  stateLocalIncomeOrSalesTaxes: number;
  realEstateTaxes: number;
  personalPropertyTaxes: number;
  adjustedGrossIncome: number;
  modifiedAgiAddbacks?: number;
}) {
  const incomeOrSales = nonnegative(input.stateLocalIncomeOrSalesTaxes, 'invalid_salt_income_or_sales_tax');
  const realEstate = nonnegative(input.realEstateTaxes, 'invalid_salt_real_estate_tax');
  const personal = nonnegative(input.personalPropertyTaxes, 'invalid_salt_personal_property_tax');
  const agi = nonnegative(input.adjustedGrossIncome, 'invalid_salt_agi');
  const addbacks = nonnegative(amount(input.modifiedAgiAddbacks), 'invalid_salt_magi_addback');

  const line5d = Number((incomeOrSales + realEstate + personal).toFixed(2));
  const mfs = input.filingStatus === 'married-filing-separately';
  const threshold = mfs ? 250000 : 500000;
  const baseWorksheetLimit = 40000;
  const floorWorksheetLimit = 10000;
  const modifiedAgi = Number((agi + addbacks).toFixed(2));

  let worksheetLimit = baseWorksheetLimit;
  if (modifiedAgi > threshold) {
    worksheetLimit = Math.max(
      floorWorksheetLimit,
      baseWorksheetLimit - (modifiedAgi - threshold) * 0.30
    );
  }

  const filingStatusAdjustedLimit = mfs ? worksheetLimit / 2 : worksheetLimit;
  const saltDeduction = Math.min(line5d, filingStatusAdjustedLimit);

  return {
    line5dPreLimitSalt: line5d,
    modifiedAgiForSalt: modifiedAgi,
    saltLimit: Number(filingStatusAdjustedLimit.toFixed(2)),
    line5eSaltDeduction: Number(saltDeduction.toFixed(2))
  };
}

export function buildScheduleA2025(inputs: ScheduleAInputs2025): ScheduleAResult2025 {
  const agi = nonnegative(inputs.adjustedGrossIncome, 'invalid_schedule_a_agi');
  const medicalExpenses = nonnegative(amount(inputs.medicalAndDentalExpenses), 'invalid_medical_expenses');
  const medicalThreshold = Number((agi * 0.075).toFixed(2));
  const medicalDeduction = Math.max(0, Number((medicalExpenses - medicalThreshold).toFixed(2)));

  const salt = calculateSaltDeduction2025({
    filingStatus: inputs.filingStatus,
    stateLocalIncomeOrSalesTaxes: amount(inputs.stateLocalIncomeOrSalesTaxes),
    realEstateTaxes: amount(inputs.realEstateTaxes),
    personalPropertyTaxes: amount(inputs.personalPropertyTaxes),
    adjustedGrossIncome: agi,
    modifiedAgiAddbacks: inputs.saltModifiedAgiAddbacks
  });

  const blockers: string[] = [];
  const reviewFlags: string[] = [];

  const mortgage = nonnegative(amount(inputs.deductibleMortgageInterestAndPoints), 'invalid_mortgage_interest');
  if (mortgage > 0 && !inputs.mortgageInterestReviewed) {
    blockers.push('Mortgage interest and points require reviewed qualified-home/debt-limit treatment before Schedule A can be finalized.');
  }

  const investmentInterest = nonnegative(amount(inputs.investmentInterest), 'invalid_investment_interest');
  if (investmentInterest > 0 && !inputs.investmentInterestReviewed) {
    blockers.push('Investment interest requires reviewed Form 4952 treatment or documented exception.');
  }

  const charity = nonnegative(amount(inputs.charitableContributions), 'invalid_charitable_contributions');
  if (charity > 0 && !inputs.charitableContributionsReviewed) {
    blockers.push('Charitable contributions require eligibility, substantiation and limitation review.');
  }

  const casualty = nonnegative(amount(inputs.casualtyTheftLoss), 'invalid_casualty_loss');
  if (casualty > 0 && !inputs.casualtyTheftLossReviewed) {
    blockers.push('Casualty/theft loss requires reviewed Form 4684 treatment.');
  }

  const other = nonnegative(amount(inputs.otherItemizedDeductions), 'invalid_other_itemized_deductions');
  if (other > 0 && !inputs.otherItemizedDeductionsReviewed) {
    blockers.push('Other itemized deductions require reviewed Schedule A classification.');
  }

  const otherTaxes = nonnegative(amount(inputs.otherDeductibleTaxes), 'invalid_other_taxes');

  if (salt.modifiedAgiForSalt > (inputs.filingStatus === 'married-filing-separately' ? 250000 : 500000)) {
    reviewFlags.push('2025 SALT deduction phase-down applied using the official 30% worksheet formula.');
  }
  if (amount(inputs.saltModifiedAgiAddbacks) > 0) {
    reviewFlags.push('SALT modified AGI includes supplied foreign/Puerto Rico exclusion addbacks.');
  }

  const total =
    medicalDeduction +
    salt.line5eSaltDeduction +
    otherTaxes +
    mortgage +
    investmentInterest +
    charity +
    casualty +
    other;

  return {
    taxYear: 2025,
    medical: {
      expenses: medicalExpenses,
      agiThreshold: medicalThreshold,
      deductible: medicalDeduction
    },
    taxes: {
      ...salt,
      otherTaxes,
      totalDeductibleTaxes: Number((salt.line5eSaltDeduction + otherTaxes).toFixed(2))
    },
    interest: {
      mortgageInterestAndPoints: mortgage,
      investmentInterest
    },
    charitableContributions: charity,
    casualtyTheftLoss: casualty,
    otherItemizedDeductions: other,
    totalItemizedDeductions: blockers.length ? null : Number(total.toFixed(2)),
    status: blockers.length ? 'blocked' : 'calculated',
    blockers: Array.from(new Set(blockers)),
    reviewFlags: Array.from(new Set(reviewFlags))
  };
}
