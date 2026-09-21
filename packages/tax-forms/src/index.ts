
export type MappingTreatment = 'direct' | 'derived' | 'informational' | 'jurisdiction' | 'review';

export type W2Box12Entry = { code: string; amount?: number };

export type W2Document = {
  taxYear: number;
  box1Wages?: number;
  box2FederalWithholding?: number;
  box3SocialSecurityWages?: number;
  box4SocialSecurityTax?: number;
  box5MedicareWages?: number;
  box6MedicareTax?: number;
  box7SocialSecurityTips?: number;
  box8AllocatedTips?: number;
  box10DependentCareBenefits?: number;
  box11NonqualifiedPlans?: number;
  box12?: W2Box12Entry[];
  box13StatutoryEmployee?: boolean;
  box13RetirementPlan?: boolean;
  box13ThirdPartySickPay?: boolean;
  box14Other?: string;
  box14TreasuryTippedOccupationCodes?: string;
  box15State?: string;
  box15EmployerStateId?: string;
  box16StateWages?: number;
  box17StateIncomeTax?: number;
  box18LocalWages?: number;
  box19LocalIncomeTax?: number;
  box20LocalityName?: string;
};

export type TaxMapping = {
  source: string;
  destinationForm: string;
  destinationLine?: string;
  destinationField: string;
  jurisdiction: 'federal' | 'state' | 'local';
  treatment: MappingTreatment;
  amount?: number;
  value?: string | boolean;
  reason: string;
  reviewRequired: boolean;
};

export type TaxMappingResult = {
  taxYear: number;
  sourceDocument: 'W-2' | '1099-INT' | '1099-DIV' | '1099-NEC' | 'K-1 (Form 1065)';
  mappings: TaxMapping[];
  activatedForms: string[];
  reviewFlags: string[];
  revisionStatus: 'final-destination' | 'destination-review-gated';
};

export type TaxFormCatalogItem = {
  id: string;
  title: string;
  audience: 'personal' | 'business' | 'both';
  category: string;
  parent?: string;
  purpose: string;
};

export const TAX_FORM_CATALOG: readonly TaxFormCatalogItem[] = [
  { id: '1040', title: 'Form 1040 / 1040-SR', audience: 'personal', category: 'Return', purpose: 'U.S. individual income tax return.' },
  { id: '1040-X', title: 'Form 1040-X', audience: 'personal', category: 'Amended return', purpose: 'Amend an individual income tax return.' },
  { id: 'schedule-1', title: 'Schedule 1', audience: 'personal', category: 'Income & adjustments', parent: '1040', purpose: 'Additional income and adjustments to income.' },
  { id: 'schedule-2', title: 'Schedule 2', audience: 'personal', category: 'Additional tax', parent: '1040', purpose: 'Additional taxes.' },
  { id: 'schedule-3', title: 'Schedule 3', audience: 'personal', category: 'Credits & payments', parent: '1040', purpose: 'Additional credits and payments.' },
  { id: 'schedule-a', title: 'Schedule A', audience: 'personal', category: 'Deductions', parent: '1040', purpose: 'Itemized deductions.' },
  { id: 'schedule-b', title: 'Schedule B', audience: 'personal', category: 'Investment income', parent: '1040', purpose: 'Interest and ordinary dividends.' },
  { id: 'schedule-c', title: 'Schedule C', audience: 'both', category: 'Business income', parent: '1040', purpose: 'Profit or loss from a sole proprietorship and statutory-employee routing when applicable.' },
  { id: 'schedule-d', title: 'Schedule D / Form 8949', audience: 'personal', category: 'Capital gains', parent: '1040', purpose: 'Capital gains and losses.' },
  { id: 'schedule-e', title: 'Schedule E', audience: 'both', category: 'Pass-through & rental', parent: '1040', purpose: 'Rental, royalty and pass-through income.' },
  { id: 'schedule-f', title: 'Schedule F', audience: 'both', category: 'Farm', parent: '1040', purpose: 'Profit or loss from farming.' },
  { id: 'schedule-h', title: 'Schedule H', audience: 'personal', category: 'Employment tax', parent: '1040', purpose: 'Household employment taxes.' },
  { id: 'schedule-se', title: 'Schedule SE', audience: 'personal', category: 'Self-employment tax', parent: '1040', purpose: 'Self-employment tax calculation.' },
  { id: '2441', title: 'Form 2441', audience: 'personal', category: 'Dependent care', parent: '1040', purpose: 'Child/dependent care expenses and dependent-care benefits.' },
  { id: '4137', title: 'Form 4137', audience: 'personal', category: 'Tips', parent: '1040', purpose: 'Social Security and Medicare tax on unreported tip income.' },
  { id: '8889', title: 'Form 8889', audience: 'personal', category: 'HSA', parent: '1040', purpose: 'Health Savings Account contributions and distributions.' },
  { id: '8959', title: 'Form 8959', audience: 'personal', category: 'Medicare', parent: '1040', purpose: 'Additional Medicare Tax.' },
  { id: '8962', title: 'Form 8962', audience: 'personal', category: 'Health credit', parent: '1040', purpose: 'Premium Tax Credit reconciliation.' },
  { id: '1065', title: 'Form 1065', audience: 'business', category: 'Partnership', purpose: 'U.S. return of partnership income.' },
  { id: '1120', title: 'Form 1120', audience: 'business', category: 'Corporation', purpose: 'U.S. corporation income tax return.' },
  { id: '1120-S', title: 'Form 1120-S', audience: 'business', category: 'S corporation', purpose: 'U.S. income tax return for an S corporation.' },
  { id: '1041', title: 'Form 1041', audience: 'business', category: 'Estate & trust', purpose: 'Income tax return for estates and trusts.' },
  { id: '990', title: 'Form 990 family', audience: 'business', category: 'Exempt organization', purpose: 'Exempt organization annual information returns.' },
  { id: '941', title: 'Form 941 / 941-X', audience: 'business', category: 'Payroll', purpose: 'Quarterly federal employment tax return and corrections.' },
  { id: '940', title: 'Form 940', audience: 'business', category: 'Payroll', purpose: 'Federal unemployment tax return.' },
  { id: 'W-2', title: 'Form W-2 / W-3', audience: 'both', category: 'Source document', purpose: 'Wage and tax statement and transmittal.' },
  { id: '1099', title: 'Forms 1099 / 1096', audience: 'both', category: 'Information returns', purpose: 'Information return family and transmittal.' },
  { id: 'K-1', title: 'Schedules K-1 / K-2 / K-3', audience: 'both', category: 'Pass-through', purpose: 'Owner and international pass-through reporting.' },
  { id: '4562', title: 'Form 4562', audience: 'both', category: 'Assets', purpose: 'Depreciation and amortization.' },
  { id: '4797', title: 'Form 4797', audience: 'both', category: 'Assets', purpose: 'Sales of business property.' },
  { id: '3115', title: 'Form 3115', audience: 'business', category: 'Accounting method', purpose: 'Application for change in accounting method.' },
  { id: '7004', title: 'Form 7004', audience: 'business', category: 'Extension', purpose: 'Automatic extension for certain business returns.' },
  { id: '5471', title: 'Form 5471', audience: 'both', category: 'International', purpose: 'Information return for certain U.S. persons with foreign corporations.' },
  { id: '5472', title: 'Form 5472', audience: 'business', category: 'International', purpose: 'Reportable transactions with related foreign parties.' },
  { id: '8858', title: 'Form 8858', audience: 'both', category: 'International', purpose: 'Information return for foreign disregarded entities and branches.' },
  { id: '8865', title: 'Form 8865', audience: 'both', category: 'International', purpose: 'Return of U.S. persons with respect to certain foreign partnerships.' }
] as const;

const hasAmount = (value: number | undefined): value is number => typeof value === 'number' && Number.isFinite(value);

function addAmount(
  mappings: TaxMapping[],
  source: string,
  amount: number | undefined,
  destinationForm: string,
  destinationLine: string | undefined,
  destinationField: string,
  treatment: MappingTreatment,
  reason: string,
  reviewRequired = false,
  jurisdiction: TaxMapping['jurisdiction'] = 'federal'
) {
  if (!hasAmount(amount)) return;
  mappings.push({ source, amount, destinationForm, destinationLine, destinationField, treatment, reason, reviewRequired, jurisdiction });
}

function addValue(
  mappings: TaxMapping[],
  source: string,
  value: string | boolean | undefined,
  destinationForm: string,
  destinationField: string,
  treatment: MappingTreatment,
  reason: string,
  reviewRequired = false,
  jurisdiction: TaxMapping['jurisdiction'] = 'federal'
) {
  if (value === undefined || value === '' || value === false) return;
  mappings.push({ source, value, destinationForm, destinationField, treatment, reason, reviewRequired, jurisdiction });
}

function mapBox12(mappings: TaxMapping[], entries: readonly W2Box12Entry[] | undefined) {
  for (const entry of entries ?? []) {
    const code = entry.code.trim().toUpperCase();
    if (!code) continue;
    const amount = hasAmount(entry.amount) ? entry.amount : undefined;

    if (code === 'W') {
      addAmount(mappings, 'W-2 box 12 code W', amount, 'Form 8889', undefined, 'employerHsaContributions', 'derived', 'HSA employer and salary-reduction contributions feed the Form 8889 workflow.');
    } else if (code === 'H') {
      addAmount(mappings, 'W-2 box 12 code H', amount, 'Schedule 1 (Form 1040)', '24f', 'section501c18ContributionDeduction', 'derived', 'Section 501(c)(18)(D) contributions can feed the Schedule 1 deduction, subject to limits.', true);
    } else if (['D', 'E', 'F', 'G', 'S', 'AA', 'BB', 'EE'].includes(code)) {
      addAmount(mappings, 'W-2 box 12 code ' + code, amount, 'Federal retirement rules', undefined, 'retirementContributionContext', 'informational', 'Retirement contribution codes feed limit, basis and eligibility checks and are not added again to wages.');
    } else if (code === 'DD') {
      addAmount(mappings, 'W-2 box 12 code DD', amount, 'Federal return metadata', undefined, 'employerSponsoredHealthCoverage', 'informational', 'Employer-sponsored health coverage cost is informational and is not additional taxable wage income solely because it is reported here.');
    } else {
      addAmount(mappings, 'W-2 box 12 code ' + code, amount, 'W-2 code review', undefined, 'box12_' + code, 'review', 'Unsupported Box 12 codes are preserved and routed to governed review instead of guessed.', true);
    }
  }
}

export function mapW2ToReturn(document: W2Document): TaxMappingResult {
  const mappings: TaxMapping[] = [];
  const reviewFlags: string[] = [];

  if (document.box13StatutoryEmployee) {
    addAmount(mappings, 'W-2 box 1', document.box1Wages, 'Schedule C (Form 1040)', '1', 'statutoryEmployeeGrossReceipts', 'direct', 'Statutory-employee box 1 wages route to Schedule C rather than being duplicated on Form 1040 line 1a.');
  } else {
    addAmount(mappings, 'W-2 box 1', document.box1Wages, 'Form 1040/1040-SR', '1a', 'w2Wages', 'direct', 'Total W-2 box 1 wages normally feed Form 1040 line 1a.');
    if (hasAmount(document.box11NonqualifiedPlans)) reviewFlags.push('Box 11 can require reclassification from box 1 to Schedule 1 line 8t. Verify the plan and distribution treatment.');
  }

  addAmount(mappings, 'W-2 box 2', document.box2FederalWithholding, 'Form 1040/1040-SR', '25a', 'federalIncomeTaxWithheldW2', 'direct', 'Federal income tax withheld from Forms W-2 feeds the W-2 withholding line.');
  addAmount(mappings, 'W-2 box 3', document.box3SocialSecurityWages, 'Federal payroll-tax reconciliation', undefined, 'socialSecurityWageBase', 'derived', 'Retained for Social Security wage-base and excess-withholding checks; it is not added to income again.');
  addAmount(mappings, 'W-2 box 4', document.box4SocialSecurityTax, 'Federal payroll-tax reconciliation', undefined, 'socialSecurityTaxWithheld', 'derived', 'Feeds Social Security tax reconciliation across all W-2s.');
  addAmount(mappings, 'W-2 box 5', document.box5MedicareWages, 'Form 8959', undefined, 'medicareWages', 'derived', 'Feeds Additional Medicare Tax threshold calculations when applicable.');
  addAmount(mappings, 'W-2 box 6', document.box6MedicareTax, 'Form 8959', undefined, 'medicareTaxWithheld', 'derived', 'Feeds Additional Medicare Tax reconciliation when applicable.');
  addAmount(mappings, 'W-2 box 7', document.box7SocialSecurityTips, 'Federal tip reconciliation', undefined, 'reportedSocialSecurityTips', 'informational', 'Reported tips are generally already included in box 1, so ATLAS prevents duplicate income.');
  addAmount(mappings, 'W-2 box 8', document.box8AllocatedTips, 'Form 4137 + Form 1040/1040-SR', '1c', 'allocatedAndUnreportedTips', 'derived', 'Allocated tips generally activate Form 4137 and unreported-tip income logic; taxpayer records can change the reportable amount.', true);
  addAmount(mappings, 'W-2 box 10', document.box10DependentCareBenefits, 'Form 2441', '12', 'dependentCareBenefits', 'direct', 'Dependent care benefits feed Form 2441 Part III; taxable excess may already be included in W-2 wages.');
  addAmount(mappings, 'W-2 box 11', document.box11NonqualifiedPlans, 'Schedule 1 (Form 1040)', '8t', 'nonqualifiedDeferredCompensation', 'review', 'Box 11 may identify an NQDC or nongovernmental 457 distribution; verify plan facts before reclassifying box 1.', true);

  mapBox12(mappings, document.box12);

  addValue(mappings, 'W-2 box 13 statutory employee', document.box13StatutoryEmployee, 'Schedule C routing rules', 'statutoryEmployee', 'derived', 'Changes the box 1 income-routing path.');
  addValue(mappings, 'W-2 box 13 retirement plan', document.box13RetirementPlan, 'IRA deduction eligibility', 'activeParticipant', 'derived', 'Active-participant status affects traditional IRA deduction eligibility and phaseout logic.');
  addValue(mappings, 'W-2 box 13 third-party sick pay', document.box13ThirdPartySickPay, 'Federal wage review', 'thirdPartySickPay', 'informational', 'Preserved for wage and withholding reconciliation.');
  addValue(mappings, 'W-2 box 14a other', document.box14Other, 'Jurisdiction/employer-specific review', 'box14Other', 'review', 'Box 14 content is employer- and jurisdiction-specific and must be classified before assigning a tax effect.', Boolean(document.box14Other));
  addValue(mappings, 'W-2 box 14b', document.box14TreasuryTippedOccupationCodes, 'Qualified tips rules', 'treasuryTippedOccupationCodes', 'derived', '2026 W-2 tipped-occupation codes feed qualified-tip eligibility and validation workflows.', Boolean(document.box14TreasuryTippedOccupationCodes));

  addValue(mappings, 'W-2 box 15 state', document.box15State, 'State return resolver', 'stateCode', 'jurisdiction', 'Selects the state localization pack.', false, 'state');
  addValue(mappings, 'W-2 box 15 employer state ID', document.box15EmployerStateId, 'State return resolver', 'employerStateId', 'jurisdiction', 'Preserves the state employer identifier for matching and e-file validation.', false, 'state');
  addAmount(mappings, 'W-2 box 16', document.box16StateWages, 'State income-tax return', undefined, 'stateWages', 'jurisdiction', 'Routes wages into the selected state return using that jurisdiction versioned line map.', false, 'state');
  addAmount(mappings, 'W-2 box 17', document.box17StateIncomeTax, 'State return + federal SALT pool', undefined, 'stateIncomeTaxWithheld', 'jurisdiction', 'Feeds state withholding and the federal SALT calculation pool when applicable.', false, 'state');
  addAmount(mappings, 'W-2 box 18', document.box18LocalWages, 'Local income-tax return', undefined, 'localWages', 'jurisdiction', 'Routes local wages to the locality selected by box 20.', false, 'local');
  addAmount(mappings, 'W-2 box 19', document.box19LocalIncomeTax, 'Local income-tax return', undefined, 'localIncomeTaxWithheld', 'jurisdiction', 'Routes local withholding to the locality selected by box 20.', false, 'local');
  addValue(mappings, 'W-2 box 20', document.box20LocalityName, 'Local return resolver', 'localityName', 'jurisdiction', 'Selects the local-tax mapping where a supported locality return exists.', false, 'local');

  const activatedForms = Array.from(new Set(mappings.map((mapping) => mapping.destinationForm)));
  for (const mapping of mappings) {
    if (mapping.reviewRequired) reviewFlags.push(mapping.source + ': review required before filing.');
  }

  return {
    taxYear: document.taxYear,
    sourceDocument: 'W-2',
    mappings,
    activatedForms,
    reviewFlags: Array.from(new Set(reviewFlags)),
    revisionStatus: document.taxYear <= 2025 ? 'final-destination' : 'destination-review-gated'
  };
}

export * from './sourceDocuments';
