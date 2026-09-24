
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

function finish(
  taxYear: number,
  sourceDocument: TaxMappingResult['sourceDocument'],
  mappings: TaxMapping[],
  extraFlags: string[] = []
): TaxMappingResult {
  const reviewFlags = [
    ...extraFlags,
    ...mappings.filter((item) => item.reviewRequired).map((item) => item.source + ': review required before filing.')
  ];
  return {
    taxYear,
    sourceDocument,
    mappings,
    activatedForms: Array.from(new Set(mappings.map((item) => item.destinationForm))),
    reviewFlags: Array.from(new Set(reviewFlags)),
    revisionStatus: taxYear <= 2025 ? 'final-destination' : 'destination-review-gated'
  };
}

export type Form1099INTDocument = {
  taxYear: number;
  box1InterestIncome?: number;
  box2EarlyWithdrawalPenalty?: number;
  box3USTreasuryInterest?: number;
  box4FederalWithholding?: number;
  box6ForeignTaxPaid?: number;
  box8TaxExemptInterest?: number;
  box11BondPremium?: number;
  state?: string;
  stateTaxWithheld?: number;
  stateIncome?: number;
};

export function map1099INTToReturn(document: Form1099INTDocument): TaxMappingResult {
  const mappings: TaxMapping[] = [];
  addAmount(mappings, '1099-INT box 1', document.box1InterestIncome, 'Form 1040/1040-SR', '2b', 'taxableInterest', 'direct', 'Taxable interest feeds Form 1040 line 2b; Schedule B rules are evaluated separately.');
  addAmount(mappings, '1099-INT box 2', document.box2EarlyWithdrawalPenalty, 'Schedule 1 (Form 1040)', undefined, 'earlyWithdrawalPenalty', 'derived', 'Early-withdrawal penalties feed the adjustment-to-income workflow.');
  addAmount(mappings, '1099-INT box 3', document.box3USTreasuryInterest, 'Form 1040/1040-SR + state resolver', '2b', 'usTreasuryInterest', 'derived', 'U.S. Treasury interest is federally taxable but requires state-level exemption logic where applicable.');
  addAmount(mappings, '1099-INT box 4', document.box4FederalWithholding, 'Form 1040/1040-SR', '25b', 'federalWithholding1099', 'direct', 'Backup withholding from information returns feeds Form 1040 line 25b.');
  addAmount(mappings, '1099-INT box 6', document.box6ForeignTaxPaid, 'Form 1116 / foreign tax credit workflow', undefined, 'foreignTaxPaid', 'review', 'Foreign tax paid may qualify for a credit or deduction and requires country/source context.', true);
  addAmount(mappings, '1099-INT box 8', document.box8TaxExemptInterest, 'Form 1040/1040-SR', '2a', 'taxExemptInterest', 'direct', 'Tax-exempt interest feeds Form 1040 line 2a while retaining AMT/state context.');
  addAmount(mappings, '1099-INT box 11', document.box11BondPremium, 'Schedule B / interest adjustment workflow', undefined, 'bondPremium', 'review', 'Bond premium treatment depends on instrument and taxpayer elections; ATLAS preserves it for governed interest adjustment.', true);
  addAmount(mappings, '1099-INT state withholding', document.stateTaxWithheld, 'State return resolver', undefined, 'stateTaxWithheld', 'jurisdiction', 'Routes withholding to the selected state localization pack.', false, 'state');
  addAmount(mappings, '1099-INT state income', document.stateIncome, 'State return resolver', undefined, 'stateInterestIncome', 'jurisdiction', 'Routes state-reported interest to the selected state localization pack.', false, 'state');
  return finish(document.taxYear, '1099-INT', mappings);
}

export type Form1099DIVDocument = {
  taxYear: number;
  box1aOrdinaryDividends?: number;
  box1bQualifiedDividends?: number;
  box2aCapitalGainDistributions?: number;
  box4FederalWithholding?: number;
  box5Section199ADividends?: number;
  box7ForeignTaxPaid?: number;
  box11ExemptInterestDividends?: number;
  stateTaxWithheld?: number;
  stateIncome?: number;
};

export function map1099DIVToReturn(document: Form1099DIVDocument): TaxMappingResult {
  const mappings: TaxMapping[] = [];
  addAmount(mappings, '1099-DIV box 1a', document.box1aOrdinaryDividends, 'Form 1040/1040-SR', '3b', 'ordinaryDividends', 'direct', 'Ordinary dividends feed Form 1040 line 3b; Schedule B threshold/nominee rules are evaluated separately.');
  addAmount(mappings, '1099-DIV box 1b', document.box1bQualifiedDividends, 'Form 1040/1040-SR', '3a', 'qualifiedDividends', 'direct', 'Qualified dividends feed Form 1040 line 3a and the qualified-dividend/capital-gain tax worksheet.');
  addAmount(mappings, '1099-DIV box 2a', document.box2aCapitalGainDistributions, 'Schedule D / capital gain workflow', undefined, 'capitalGainDistributions', 'derived', 'Capital gain distributions feed Schedule D or the permitted direct-reporting path depending on the taxpayer facts.', true);
  addAmount(mappings, '1099-DIV box 4', document.box4FederalWithholding, 'Form 1040/1040-SR', '25b', 'federalWithholding1099', 'direct', 'Backup withholding from information returns feeds Form 1040 line 25b.');
  addAmount(mappings, '1099-DIV box 5', document.box5Section199ADividends, 'Form 8995 / 8995-A', undefined, 'section199ADividends', 'derived', 'Section 199A dividends feed the qualified business income deduction workflow.');
  addAmount(mappings, '1099-DIV box 7', document.box7ForeignTaxPaid, 'Form 1116 / foreign tax credit workflow', undefined, 'foreignTaxPaid', 'review', 'Foreign tax paid requires source-country and limitation analysis.', true);
  addAmount(mappings, '1099-DIV box 11', document.box11ExemptInterestDividends, 'Form 1040/1040-SR', '2a', 'exemptInterestDividends', 'direct', 'Exempt-interest dividends feed Form 1040 line 2a with AMT/state context preserved.');
  addAmount(mappings, '1099-DIV state withholding', document.stateTaxWithheld, 'State return resolver', undefined, 'stateTaxWithheld', 'jurisdiction', 'Routes withholding to the selected state localization pack.', false, 'state');
  addAmount(mappings, '1099-DIV state income', document.stateIncome, 'State return resolver', undefined, 'stateDividendIncome', 'jurisdiction', 'Routes state dividend income to the selected state localization pack.', false, 'state');
  return finish(document.taxYear, '1099-DIV', mappings);
}

export type NecIncomeClassification =
  | 'self-employment'
  | 'farm'
  | 'not-self-employment'
  | 'employee-dispute'
  | 'unknown';

export type Form1099NECDocument = {
  taxYear: number;
  box1NonemployeeCompensation?: number;
  box3GoldenParachute?: number;
  box4FederalWithholding?: number;
  classification: NecIncomeClassification;
  stateTaxWithheld?: number;
  stateIncome?: number;
};

export function map1099NECToReturn(document: Form1099NECDocument): TaxMappingResult {
  const mappings: TaxMapping[] = [];
  const extraFlags: string[] = [];

  if (hasAmount(document.box1NonemployeeCompensation)) {
    if (document.classification === 'self-employment') {
      addAmount(mappings, '1099-NEC box 1', document.box1NonemployeeCompensation, 'Schedule C + Schedule SE', 'Schedule C line 1', 'nonemployeeBusinessReceipts', 'derived', 'Self-employment compensation feeds Schedule C gross receipts and the Schedule SE workflow.');
    } else if (document.classification === 'farm') {
      addAmount(mappings, '1099-NEC box 1', document.box1NonemployeeCompensation, 'Schedule F + Schedule SE', undefined, 'farmNonemployeeCompensation', 'derived', 'Farm nonemployee compensation routes to Schedule F and self-employment calculations.');
    } else if (document.classification === 'not-self-employment') {
      addAmount(mappings, '1099-NEC box 1', document.box1NonemployeeCompensation, 'Schedule 1 (Form 1040)', undefined, 'otherIncomeNonSE', 'review', 'Sporadic or hobby income is not automatically Schedule C; report through the applicable other-income path after classification.', true);
    } else if (document.classification === 'employee-dispute') {
      addAmount(mappings, '1099-NEC box 1', document.box1NonemployeeCompensation, 'Form 1040 + Form 8919', undefined, 'misclassifiedEmployeeCompensation', 'review', 'Potential employee misclassification requires Form 8919 and wage reporting review instead of automatic Schedule C treatment.', true);
    } else {
      addAmount(mappings, '1099-NEC box 1', document.box1NonemployeeCompensation, 'Income classification review', undefined, 'unclassified1099NECIncome', 'review', 'ATLAS will not decide Schedule C, Schedule F, other income, or employee-dispute treatment without classification context.', true);
      extraFlags.push('Classify the 1099-NEC activity before filing.');
    }
  }

  addAmount(mappings, '1099-NEC box 3', document.box3GoldenParachute, 'Form 1040 + excise tax workflow', undefined, 'excessGoldenParachute', 'review', 'Excess golden parachute payments can trigger a 20% excise-tax workflow and require specialized reporting.', true);
  addAmount(mappings, '1099-NEC box 4', document.box4FederalWithholding, 'Form 1040/1040-SR', '25b', 'federalWithholding1099', 'direct', 'Backup withholding from information returns feeds Form 1040 line 25b.');
  addAmount(mappings, '1099-NEC state withholding', document.stateTaxWithheld, 'State return resolver', undefined, 'stateTaxWithheld', 'jurisdiction', 'Routes withholding to the selected state localization pack.', false, 'state');
  addAmount(mappings, '1099-NEC state income', document.stateIncome, 'State return resolver', undefined, 'stateNonemployeeIncome', 'jurisdiction', 'Routes state compensation to the selected state localization pack.', false, 'state');

  return finish(document.taxYear, '1099-NEC', mappings, extraFlags);
}

export type PartnershipK1Document = {
  taxYear: number;
  box1OrdinaryBusinessIncome?: number;
  box2RentalRealEstateIncome?: number;
  box3OtherRentalIncome?: number;
  box4aGuaranteedPaymentsServices?: number;
  box4bGuaranteedPaymentsCapital?: number;
  box5InterestIncome?: number;
  box6aOrdinaryDividends?: number;
  box6bQualifiedDividends?: number;
  box7Royalties?: number;
  box8ShortTermCapitalGain?: number;
  box9aLongTermCapitalGain?: number;
  box10Section1231?: number;
  box14aSelfEmploymentEarnings?: number;
  hasK3?: boolean;
  isPubliclyTradedPartnership?: boolean;
};

export function mapPartnershipK1ToReturn(document: PartnershipK1Document): TaxMappingResult {
  const mappings: TaxMapping[] = [];
  const lossGateReason = 'Partnership income/loss must respect basis, at-risk, passive-activity and PTP limitations before final filing treatment.';

  addAmount(mappings, 'K-1 (1065) box 1', document.box1OrdinaryBusinessIncome, 'Schedule E (Form 1040)', '28', 'ordinaryBusinessIncome', 'derived', lossGateReason, true);
  addAmount(mappings, 'K-1 (1065) box 2', document.box2RentalRealEstateIncome, 'Schedule E (Form 1040)', '28', 'rentalRealEstateIncome', 'derived', lossGateReason, true);
  addAmount(mappings, 'K-1 (1065) box 3', document.box3OtherRentalIncome, 'Schedule E (Form 1040)', '28', 'otherRentalIncome', 'derived', lossGateReason, true);
  addAmount(mappings, 'K-1 (1065) box 4a', document.box4aGuaranteedPaymentsServices, 'Schedule E (Form 1040)', '28', 'guaranteedPaymentsServices', 'direct', 'Guaranteed payments for services generally feed Schedule E line 28 and can affect self-employment tax.');
  addAmount(mappings, 'K-1 (1065) box 4b', document.box4bGuaranteedPaymentsCapital, 'Schedule E (Form 1040)', '28', 'guaranteedPaymentsCapital', 'direct', 'Guaranteed payments for capital generally feed Schedule E line 28.');
  addAmount(mappings, 'K-1 (1065) box 5', document.box5InterestIncome, 'Form 1040/1040-SR', '2b', 'partnershipInterestIncome', 'direct', 'Partnership portfolio interest feeds Form 1040 line 2b.');
  addAmount(mappings, 'K-1 (1065) box 6a', document.box6aOrdinaryDividends, 'Form 1040/1040-SR', '3b', 'partnershipOrdinaryDividends', 'direct', 'Partnership ordinary dividends feed Form 1040 line 3b.');
  addAmount(mappings, 'K-1 (1065) box 6b', document.box6bQualifiedDividends, 'Form 1040/1040-SR', '3a', 'partnershipQualifiedDividends', 'direct', 'Partnership qualified dividends feed Form 1040 line 3a, subject to foreign-source/PTEP context.');
  addAmount(mappings, 'K-1 (1065) box 7', document.box7Royalties, 'Schedule E (Form 1040)', '4', 'partnershipRoyalties', 'direct', 'Partnership royalties feed Schedule E line 4.');
  addAmount(mappings, 'K-1 (1065) box 8', document.box8ShortTermCapitalGain, 'Schedule D (Form 1040)', '5', 'partnershipShortTermCapitalGain', 'direct', 'Net short-term capital gain or loss feeds Schedule D line 5.');
  addAmount(mappings, 'K-1 (1065) box 9a', document.box9aLongTermCapitalGain, 'Schedule D (Form 1040)', '12', 'partnershipLongTermCapitalGain', 'direct', 'Net long-term capital gain or loss feeds Schedule D line 12.');
  addAmount(mappings, 'K-1 (1065) box 10', document.box10Section1231, 'Form 4797 / Schedule D workflow', undefined, 'section1231GainLoss', 'review', 'Section 1231 gain/loss requires Form 4797 and prior-year recapture context.', true);
  addAmount(mappings, 'K-1 (1065) box 14 code A', document.box14aSelfEmploymentEarnings, 'Schedule SE (Form 1040)', undefined, 'selfEmploymentEarnings', 'derived', 'Self-employment earnings from the partnership feed Schedule SE subject to partner-type rules.', true);

  if (document.hasK3) {
    mappings.push({
      source: 'K-1 attached Schedule K-3',
      value: true,
      destinationForm: 'Schedule K-3 / international tax workflow',
      destinationField: 'internationalPassThroughItems',
      jurisdiction: 'federal',
      treatment: 'review',
      reason: 'Foreign-source, PTEP, foreign-tax-credit and other international items require K-3-aware routing.',
      reviewRequired: true
    });
  }

  const extraFlags = document.isPubliclyTradedPartnership
    ? ['Publicly traded partnership rules apply; passive-loss netting is activity-specific.']
    : [];

  return finish(document.taxYear, 'K-1 (Form 1065)', mappings, extraFlags);
}
