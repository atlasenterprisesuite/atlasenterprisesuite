
import type { TaxMapping, TaxMappingResult } from './index';

type Jurisdiction = TaxMapping['jurisdiction'];

const hasAmount = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function addAmount(
  mappings: TaxMapping[],
  source: string,
  amount: number | undefined,
  destinationForm: string,
  destinationLine: string | undefined,
  destinationField: string,
  treatment: TaxMapping['treatment'],
  reason: string,
  reviewRequired = false,
  jurisdiction: Jurisdiction = 'federal'
) {
  if (!hasAmount(amount)) return;
  mappings.push({ source, amount, destinationForm, destinationLine, destinationField, treatment, reason, reviewRequired, jurisdiction });
}

function addValue(
  mappings: TaxMapping[],
  source: string,
  value: string | boolean | undefined,
  destinationForm: string,
  destinationLine: string | undefined,
  destinationField: string,
  treatment: TaxMapping['treatment'],
  reason: string,
  reviewRequired = false,
  jurisdiction: Jurisdiction = 'federal'
) {
  if (value === undefined || value === '') return;
  mappings.push({ source, value, destinationForm, destinationLine, destinationField, treatment, reason, reviewRequired, jurisdiction });
}

function finish(
  taxYear: number,
  sourceDocument: TaxMappingResult['sourceDocument'],
  mappings: TaxMapping[],
  extraFlags: string[] = []
): TaxMappingResult {
  return {
    taxYear,
    sourceDocument,
    mappings,
    activatedForms: Array.from(new Set(mappings.map((item) => item.destinationForm))),
    reviewFlags: Array.from(new Set([
      ...extraFlags,
      ...mappings.filter((item) => item.reviewRequired).map((item) => item.source + ': review required before filing.')
    ])),
    revisionStatus: taxYear <= 2025 ? 'final-destination' : 'destination-review-gated'
  };
}

export type Form1098Document = {
  taxYear: number;
  box1MortgageInterest?: number;
  box2OutstandingPrincipal?: number;
  box4RefundOfOverpaidInterest?: number;
  box6PointsPaidOnPurchase?: number;
  acquisitionDebtLimitReview?: boolean;
  sharedBorrowerReview?: boolean;
};

export function map1098ToReturn(document: Form1098Document): TaxMappingResult {
  const mappings: TaxMapping[] = [];
  const review = Boolean(document.acquisitionDebtLimitReview || document.sharedBorrowerReview);

  addAmount(
    mappings,
    '1098 box 1',
    document.box1MortgageInterest,
    'Schedule A (Form 1040)',
    '8a',
    'mortgageInterestReported1098',
    review ? 'review' : 'derived',
    'Mortgage interest reported on Form 1098 feeds Schedule A line 8a only to the extent deductible after qualified-home and debt-limit rules.',
    true
  );
  addAmount(
    mappings,
    '1098 box 2',
    document.box2OutstandingPrincipal,
    'Mortgage-interest limitation worksheet',
    undefined,
    'mortgageOutstandingPrincipal',
    'informational',
    'Outstanding mortgage principal is retained for qualified-home mortgage interest limitation analysis.',
    true
  );
  addAmount(
    mappings,
    '1098 box 4',
    document.box4RefundOfOverpaidInterest,
    'Schedule 1 (Form 1040) recovery workflow',
    '8z',
    'refundOfOverpaidMortgageInterest',
    'review',
    'Refunded mortgage interest is not simply netted against Schedule A; recovery/tax-benefit treatment requires review.',
    true
  );
  addAmount(
    mappings,
    '1098 box 6',
    document.box6PointsPaidOnPurchase,
    'Schedule A (Form 1040)',
    '8a',
    'mortgagePointsReported1098',
    'review',
    'Points reported on Form 1098 may be deductible on Schedule A, but current-year deductibility depends on the applicable points rules.',
    true
  );

  const flags: string[] = [];
  if (document.acquisitionDebtLimitReview) flags.push('Mortgage acquisition-debt limitation review is required.');
  if (document.sharedBorrowerReview) flags.push('Shared-borrower allocation review is required.');
  return finish(document.taxYear, '1098', mappings, flags);
}

export type Form1095AMonth = {
  month: number;
  enrollmentPremium?: number;
  slcspPremium?: number;
  advancePremiumTaxCredit?: number;
};

export type Form1095ADocument = {
  taxYear: number;
  corrected?: boolean;
  months: Form1095AMonth[];
  sharedPolicyAllocation?: boolean;
  alternativeMarriageCalculation?: boolean;
};

export function map1095AToReturn(document: Form1095ADocument): TaxMappingResult {
  const mappings: TaxMapping[] = [];
  const flags: string[] = [];

  for (const month of document.months) {
    if (!Number.isInteger(month.month) || month.month < 1 || month.month > 12) {
      flags.push('1095-A contains an invalid coverage month.');
      continue;
    }
    const monthKey = String(month.month).padStart(2, '0');
    addAmount(
      mappings,
      '1095-A month ' + monthKey + ' column A',
      month.enrollmentPremium,
      'Form 8962',
      String(11 + month.month),
      'ptcEnrollmentPremium.month' + monthKey,
      'derived',
      'Marketplace enrollment premiums must be preserved by month for Form 8962 premium-tax-credit calculation and reconciliation.',
      false
    );
    addAmount(
      mappings,
      '1095-A month ' + monthKey + ' column B',
      month.slcspPremium,
      'Form 8962',
      String(11 + month.month),
      'ptcSLCSPPremium.month' + monthKey,
      'derived',
      'Second-lowest-cost silver plan premiums feed the corresponding monthly Form 8962 calculation.',
      false
    );
    addAmount(
      mappings,
      '1095-A month ' + monthKey + ' column C',
      month.advancePremiumTaxCredit,
      'Form 8962',
      String(11 + month.month),
      'ptcAdvancePayment.month' + monthKey,
      'derived',
      'Advance PTC must be reconciled by month against the allowed premium tax credit.',
      false
    );
  }

  if (document.corrected) {
    addValue(
      mappings,
      '1095-A corrected indicator',
      true,
      'Form 8962 source control',
      undefined,
      'marketplaceStatementCorrected',
      'informational',
      'ATLAS must use the corrected Marketplace statement for the policy rather than the superseded original.'
    );
  }
  if (document.sharedPolicyAllocation) flags.push('Form 8962 shared-policy allocation (Part IV) review required.');
  if (document.alternativeMarriageCalculation) flags.push('Form 8962 alternative calculation for year of marriage (Part V) review required.');

  return finish(document.taxYear, '1095-A', mappings, flags);
}

export type SSA1099Document = {
  taxYear: number;
  box3BenefitsPaid?: number;
  box4BenefitsRepaid?: number;
  box5NetBenefits?: number;
  box6FederalWithholding?: number;
  lumpSumPriorYearPayment?: boolean;
  marriedFilingSeparatelyLivedWithSpouse?: boolean;
};

export function mapSSA1099ToReturn(document: SSA1099Document): TaxMappingResult {
  const mappings: TaxMapping[] = [];
  const flags: string[] = [];

  addAmount(
    mappings,
    'SSA-1099 box 5',
    document.box5NetBenefits,
    'Form 1040/1040-SR',
    '6a',
    'socialSecurityBenefitsGross',
    'direct',
    'Net Social Security benefits from all SSA-1099/RRB-1099 statements feed Form 1040 line 6a.'
  );
  if (hasAmount(document.box5NetBenefits)) {
    addValue(
      mappings,
      'SSA-1099 taxable benefits worksheet trigger',
      true,
      'Social Security Benefits Worksheet / Form 1040',
      '6b',
      'socialSecurityTaxableBenefitsCalculation',
      'review',
      'Taxable Social Security benefits are not copied directly from SSA-1099; ATLAS must calculate line 6b using the applicable worksheet and return facts.',
      true
    );
  }
  addAmount(
    mappings,
    'SSA-1099 box 6',
    document.box6FederalWithholding,
    'Form 1040/1040-SR',
    '25b',
    'federalWithholding1099',
    'direct',
    'Federal income tax withheld from Social Security benefits feeds Form 1040 line 25b.'
  );
  addAmount(
    mappings,
    'SSA-1099 box 3',
    document.box3BenefitsPaid,
    'Social Security Benefits Worksheet',
    undefined,
    'socialSecurityBenefitsPaid',
    'informational',
    'Gross benefits paid are retained for repayment and taxable-benefit worksheet exceptions.'
  );
  addAmount(
    mappings,
    'SSA-1099 box 4',
    document.box4BenefitsRepaid,
    'Social Security Benefits Worksheet / repayment workflow',
    undefined,
    'socialSecurityBenefitsRepaid',
    'review',
    'Benefit repayments affect the Social Security worksheet and special repayment rules when repayments exceed gross benefits.',
    true
  );

  if (document.lumpSumPriorYearPayment) flags.push('Lump-sum Social Security payment requires Publication 915 prior-year election workflow.');
  if (document.marriedFilingSeparatelyLivedWithSpouse) flags.push('MFS taxpayer who lived with spouse requires special Social Security taxable-benefit treatment.');
  return finish(document.taxYear, 'SSA-1099', mappings, flags);
}

export type Brokerage1099BTransaction = {
  transactionId: string;
  description?: string;
  dateAcquired?: string;
  dateSold?: string;
  proceeds?: number;
  basis?: number;
  basisReportedToIRS: boolean;
  term: 'short' | 'long' | 'unknown';
  washSaleLossDisallowed?: number;
  otherAdjustment?: number;
  adjustmentCode?: string;
};

export type Brokerage1099BDocument = {
  taxYear: number;
  transactions: Brokerage1099BTransaction[];
};

export function map1099BToReturn(document: Brokerage1099BDocument): TaxMappingResult {
  const mappings: TaxMapping[] = [];
  const flags: string[] = [];

  for (const tx of document.transactions) {
    const key = tx.transactionId.trim();
    if (!key) {
      flags.push('Brokerage transaction missing transactionId.');
      continue;
    }

    const formPart = tx.term === 'short' ? 'Form 8949 Part I' : tx.term === 'long' ? 'Form 8949 Part II' : 'Form 8949 term review';
    const boxClass = tx.term === 'short'
      ? (tx.basisReportedToIRS ? 'A' : 'B')
      : tx.term === 'long'
        ? (tx.basisReportedToIRS ? 'D' : 'E')
        : 'review';

    addAmount(
      mappings,
      '1099-B transaction ' + key + ' proceeds',
      tx.proceeds,
      formPart,
      undefined,
      'capitalTransaction.' + key + '.proceeds',
      'direct',
      'Broker proceeds feed Form 8949 column (d) unless a permitted Schedule D summary exception applies.',
      false
    );
    addAmount(
      mappings,
      '1099-B transaction ' + key + ' basis',
      tx.basis,
      formPart,
      undefined,
      'capitalTransaction.' + key + '.basis',
      tx.basisReportedToIRS ? 'direct' : 'review',
      tx.basisReportedToIRS
        ? 'Covered-security basis reported to the IRS feeds Form 8949 column (e).'
        : 'Noncovered or unreported basis requires taxpayer records and review before Form 8949 column (e).',
      !tx.basisReportedToIRS
    );
    addValue(
      mappings,
      '1099-B transaction ' + key + ' Form 8949 box',
      boxClass,
      formPart,
      undefined,
      'capitalTransaction.' + key + '.boxClass',
      tx.term === 'unknown' ? 'review' : 'informational',
      'Covered/noncovered and holding-period status determine the applicable Form 8949 reporting box.',
      tx.term === 'unknown'
    );
    addValue(
      mappings,
      '1099-B transaction ' + key + ' description',
      tx.description,
      formPart,
      undefined,
      'capitalTransaction.' + key + '.description',
      'informational',
      'Security description is retained with the transaction-level Form 8949 workpaper.'
    );
    addValue(
      mappings,
      '1099-B transaction ' + key + ' date acquired',
      tx.dateAcquired,
      formPart,
      undefined,
      'capitalTransaction.' + key + '.dateAcquired',
      'informational',
      'Acquisition date supports holding-period and Form 8949 reporting.'
    );
    addValue(
      mappings,
      '1099-B transaction ' + key + ' date sold',
      tx.dateSold,
      formPart,
      undefined,
      'capitalTransaction.' + key + '.dateSold',
      'informational',
      'Disposition date supports holding-period and Form 8949 reporting.'
    );
    addAmount(
      mappings,
      '1099-B transaction ' + key + ' wash sale',
      tx.washSaleLossDisallowed,
      formPart,
      undefined,
      'capitalTransaction.' + key + '.washSaleAdjustment',
      'derived',
      'Disallowed wash-sale loss is reported as a positive adjustment in Form 8949 column (g) with code W and must also feed replacement-property basis tracking.',
      true
    );
    addAmount(
      mappings,
      '1099-B transaction ' + key + ' other adjustment',
      tx.otherAdjustment,
      formPart,
      undefined,
      'capitalTransaction.' + key + '.otherAdjustment',
      'review',
      'Other Form 8949 adjustments require the applicable adjustment code and supporting evidence.',
      true
    );
    addValue(
      mappings,
      '1099-B transaction ' + key + ' adjustment code',
      tx.adjustmentCode,
      formPart,
      undefined,
      'capitalTransaction.' + key + '.adjustmentCode',
      'review',
      'Form 8949 adjustment code is retained with the transaction-level calculation.',
      Boolean(tx.adjustmentCode)
    );

    if (tx.term === 'unknown') flags.push('Transaction ' + key + ' requires short-term/long-term classification.');
    if (!tx.basisReportedToIRS && !hasAmount(tx.basis)) flags.push('Transaction ' + key + ' is missing reviewed basis.');
  }

  if (document.transactions.length > 0) {
    mappings.push({
      source: '1099-B transaction aggregation',
      value: true,
      destinationForm: 'Schedule D (Form 1040)',
      destinationField: 'capitalTransactionAggregation',
      jurisdiction: 'federal',
      treatment: 'derived',
      reason: 'Form 8949 transaction results roll into the appropriate short-term and long-term Schedule D lines after adjustments.',
      reviewRequired: true
    });
  }

  return finish(document.taxYear, '1099-B / Brokerage', mappings, flags);
}
