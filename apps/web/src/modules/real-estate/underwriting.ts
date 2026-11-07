/**
 * ATLAS Real Estate: transparent, non-binding financial scenario analysis.
 * No lender, MLS, title, tax, inspection or escrow connection is implied.
 * Data is supplied by the user; this function never approves an investment.
 */
export type RealEstateDealInput = {
  purchasePrice: number;
  units: number;
  rentPerUnitMonthly: number;
  otherIncomeMonthly: number;
  vacancyPercent: number;
  operatingExpensesMonthly: number;
  downPaymentPercent: number;
  interestRatePercent: number;
  amortizationYears: number;
  closingCosts: number;
  repairsBudget: number;
  annualPropertyTaxes?: number;
  annualInsurance?: number;
  monthlyAssociationFees?: number;
  monthlyCapitalReserve?: number;
  lenderFees?: number;
  cashReserves?: number;
};

export type RealEstateRisk = {
  id: 'negative-noi' | 'negative-cash-flow' | 'debt-coverage' |
      'unlevered' | 'no-operating-margin' | 'unpriced-tax' |
      'unpriced-insurance' | 'missing-repairs';
  level: 'critical' | 'review' | 'info';
  message: string;
};

export type RealEstateDealMetrics = {
  grossPotentialAnnual: number;
  effectiveGrossAnnual: number;
  operatingExpensesAnnual: number;
  noiAnnual: number;
  loanAmount: number;
  monthlyDebtService: number;
  annualDebtService: number;
  cashFlowAnnual: number;
  initialCashRequired: number;
  capRatePercent: number;
  cashOnCashPercent: number | null;
  dscr: number | null;
  expenseRatioPercent: number | null;
};

export type RealEstateEvaluation =
  | { ok: false; errors: string[] }
  | { ok: true; values: RealEstateDealMetrics; risks: RealEstateRisk[] };

export function evaluateRealEstateDeal(input: RealEstateDealInput): RealEstateEvaluation {
  const errors: string[] = [];
  const nonNegative: (keyof RealEstateDealInput)[] = [
    'rentPerUnitMonthly', 'otherIncomeMonthly', 'operatingExpensesMonthly',
    'closingCosts', 'repairsBudget', 'annualPropertyTaxes', 'annualInsurance',
    'monthlyAssociationFees', 'monthlyCapitalReserve', 'lenderFees', 'cashReserves'
  ];
  for (const field of nonNegative) {
    const value = input[field];
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      errors.push(`${field} must be a finite, non-negative number.`);
    }
  }
  if (!Number.isFinite(input.purchasePrice) || input.purchasePrice <= 0) errors.push('A positive purchase price is required.');
  if (!Number.isSafeInteger(input.units) || input.units < 1) errors.push('Units must be a positive whole number.');
  for (const field of ['vacancyPercent', 'downPaymentPercent'] as const) {
    if (!Number.isFinite(input[field]) || input[field] < 0 || input[field] > 100) {
      errors.push(`${field} must be between 0 and 100.`);
    }
  }
  if (!Number.isFinite(input.interestRatePercent) || input.interestRatePercent < 0 || input.interestRatePercent > 100) {
    errors.push('interestRatePercent must be between 0 and 100.');
  }
  if (!Number.isFinite(input.amortizationYears) || input.amortizationYears <= 0 || input.amortizationYears > 50) {
    errors.push('amortizationYears must be greater than 0 and no more than 50.');
  }
  if (errors.length > 0) return { ok: false, errors };

  const annualTaxes = input.annualPropertyTaxes ?? 0;
  const annualInsurance = input.annualInsurance ?? 0;
  const grossPotentialAnnual = (input.units * input.rentPerUnitMonthly + input.otherIncomeMonthly) * 12;
  const effectiveGrossAnnual = grossPotentialAnnual * (1 - input.vacancyPercent / 100);
  const operatingExpensesAnnual = input.operatingExpensesMonthly * 12 +
    annualTaxes + annualInsurance + (input.monthlyAssociationFees ?? 0) * 12;
  const noiAnnual = effectiveGrossAnnual - operatingExpensesAnnual;
  const loanAmount = input.purchasePrice * (1 - input.downPaymentPercent / 100);
  const n = Math.round(input.amortizationYears * 12);
  const monthlyRate = input.interestRatePercent / 1200;
  const monthlyDebtService = loanAmount === 0 ? 0 : monthlyRate === 0
    ? loanAmount / n
    : loanAmount * monthlyRate / (1 - Math.pow(1 + monthlyRate, -n));
  const annualDebtService = monthlyDebtService * 12;
  const cashFlowAnnual = noiAnnual - annualDebtService - (input.monthlyCapitalReserve ?? 0) * 12;
  const initialCashRequired = input.purchasePrice * (input.downPaymentPercent / 100) +
    input.closingCosts + input.repairsBudget + (input.lenderFees ?? 0) + (input.cashReserves ?? 0);
  const dscr = annualDebtService > 0 ? noiAnnual / annualDebtService : null;
  const values: RealEstateDealMetrics = {
    grossPotentialAnnual, effectiveGrossAnnual, operatingExpensesAnnual,
    noiAnnual, loanAmount, monthlyDebtService, annualDebtService, cashFlowAnnual,
    initialCashRequired, capRatePercent: noiAnnual / input.purchasePrice * 100,
    cashOnCashPercent: initialCashRequired > 0 ? cashFlowAnnual / initialCashRequired * 100 : null,
    dscr,
    expenseRatioPercent: effectiveGrossAnnual > 0 ? operatingExpensesAnnual / effectiveGrossAnnual * 100 : null
  };
  if (!Object.values(values).every((value) => value === null || Number.isFinite(value))) {
    return { ok: false, errors: ['Calculated values are outside safe numerical bounds.'] };
  }
  const risks: RealEstateRisk[] = [];
  if (noiAnnual < 0) risks.push({ id: 'negative-noi', level: 'critical', message: 'Negative NOI: operating income does not cover operating costs.' });
  if (cashFlowAnnual < 0) risks.push({ id: 'negative-cash-flow', level: 'critical', message: 'Negative annual cash flow after debt service and capital reserve.' });
  if (dscr !== null && dscr < 1.25) risks.push({
    id: 'debt-coverage', level: dscr < 1 ? 'critical' : 'review',
    message: 'Illustrative DSCR is below 1.25; actual lending standards vary.'
  });
  if (loanAmount === 0) risks.push({ id: 'unlevered', level: 'info', message: 'All-cash scenario: DSCR does not apply.' });
  if (effectiveGrossAnnual <= 0) risks.push({ id: 'no-operating-margin', level: 'critical', message: 'No effective gross revenue was modeled.' });
  if (annualTaxes === 0) risks.push({ id: 'unpriced-tax', level: 'review', message: 'Verify parcel taxes, delinquencies, and post-sale assessment; zero is not a verified tax quote.' });
  if (annualInsurance === 0) risks.push({ id: 'unpriced-insurance', level: 'review', message: 'Obtain a current insurance quote including relevant wind/flood coverage and deductibles.' });
  if (input.repairsBudget === 0) risks.push({ id: 'missing-repairs', level: 'review', message: 'No rehabilitation budget included; verify contractor and inspection estimates.' });
  return { ok: true, values, risks };
}
