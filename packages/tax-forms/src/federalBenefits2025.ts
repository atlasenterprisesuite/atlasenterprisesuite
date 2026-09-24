export type FederalBenefitKind2025 =
  | 'credit'
  | 'deduction'
  | 'adjustment'
  | 'itemized-deduction'
  | 'tax-computation';

export type FederalBenefitRefundability =
  | 'refundable'
  | 'partially-refundable'
  | 'nonrefundable'
  | 'not-applicable'
  | 'mixed';

export type FederalBenefitSupport =
  | 'automatic'
  | 'worksheet-required'
  | 'review-required'
  | 'source-document-required';

export type FederalBenefit2025 = {
  id: string;
  name: string;
  kind: FederalBenefitKind2025;
  form: string;
  destination?: string;
  refundability: FederalBenefitRefundability;
  support: FederalBenefitSupport;
  maximum?: string;
  thresholds?: string;
  eligibility: string[];
  officialSource: string;
  notes?: string;
};

export const FEDERAL_BENEFITS_2025: readonly FederalBenefit2025[] = [
  {
    id: 'standard-deduction',
    name: 'Standard Deduction',
    kind: 'deduction',
    form: 'Form 1040 / 1040-SR',
    destination: 'line 12e',
    refundability: 'not-applicable',
    support: 'automatic',
    maximum: 'Single/MFS $15,750; MFJ/QSS $31,500; HOH $23,625, before age/blind/dependent adjustments.',
    eligibility: [
      'Filing status determines base amount.',
      'MFS cannot use standard deduction if spouse itemizes.',
      'Dependent and age/blind rules can change the amount.',
      'Nonresident/dual-status rules can disallow the deduction.'
    ],
    officialSource: 'https://www.irs.gov/credits-and-deductions-for-individuals'
  },
  {
    id: 'schedule-a-itemized',
    name: 'Schedule A Itemized Deductions',
    kind: 'itemized-deduction',
    form: 'Schedule A (Form 1040)',
    destination: 'Form 1040 line 12e',
    refundability: 'not-applicable',
    support: 'worksheet-required',
    maximum: 'Medical expenses above 7.5% AGI; 2025 SALT cap up to $40,000 ($20,000 MFS) before phase-down; other components depend on facts.',
    eligibility: [
      'Deductible medical/dental expenses are subject to the 7.5% AGI floor.',
      'SALT phase-down begins above MAGI $500,000 ($250,000 MFS).',
      'Mortgage interest, charitable contributions, casualty losses and investment interest require their own qualification rules.'
    ],
    officialSource: 'https://www.irs.gov/instructions/i1040sca'
  },
  {
    id: 'schedule-1a-tips',
    name: 'Qualified Tips Deduction',
    kind: 'deduction',
    form: 'Schedule 1-A',
    destination: 'Form 1040 line 13b',
    refundability: 'not-applicable',
    support: 'worksheet-required',
    maximum: 'Up to $25,000 per return for 2025.',
    thresholds: 'Phaseout begins above MAGI $150,000 ($300,000 MFJ).',
    eligibility: [
      'Qualified tips must be reported and from an IRS-listed tipped occupation.',
      'Valid employment SSN required.',
      'Married taxpayers must file jointly.'
    ],
    officialSource: 'https://www.irs.gov/newsroom/schedule-1-a-additional-deductions-what-to-know-about-the-new-form'
  },
  {
    id: 'schedule-1a-overtime',
    name: 'Qualified Overtime Deduction',
    kind: 'deduction',
    form: 'Schedule 1-A',
    destination: 'Form 1040 line 13b',
    refundability: 'not-applicable',
    support: 'worksheet-required',
    maximum: 'Up to $12,500; up to $25,000 MFJ for 2025.',
    thresholds: 'Subject to MAGI phaseout under Schedule 1-A.',
    eligibility: [
      'Qualified overtime compensation must satisfy applicable FLSA rules.',
      'Valid employment SSN required.',
      'Married taxpayers must file jointly.'
    ],
    officialSource: 'https://www.irs.gov/newsroom/schedule-1-a-additional-deductions-what-to-know-about-the-new-form'
  },
  {
    id: 'schedule-1a-car-loan-interest',
    name: 'Qualified Passenger Vehicle Loan Interest Deduction',
    kind: 'deduction',
    form: 'Schedule 1-A',
    destination: 'Form 1040 line 13b',
    refundability: 'not-applicable',
    support: 'worksheet-required',
    maximum: 'Up to $10,000 for 2025.',
    thresholds: 'Phaseout begins above MAGI $100,000 ($200,000 MFJ).',
    eligibility: [
      'Loan generally originated after December 31, 2024.',
      'Qualified passenger vehicle purchased for personal use.',
      'Vehicle and loan must satisfy Schedule 1-A requirements, including VIN reporting.'
    ],
    officialSource: 'https://www.irs.gov/newsroom/schedule-1-a-additional-deductions-what-to-know-about-the-new-form'
  },
  {
    id: 'schedule-1a-senior',
    name: 'Enhanced Senior Deduction',
    kind: 'deduction',
    form: 'Schedule 1-A',
    destination: 'Form 1040 line 13b',
    refundability: 'not-applicable',
    support: 'worksheet-required',
    maximum: '$6,000 per eligible taxpayer; up to $12,000 for two eligible spouses filing jointly.',
    thresholds: 'Phaseout begins above MAGI $75,000 ($150,000 MFJ).',
    eligibility: [
      'Taxpayer must be age 65 or older for the tax year.',
      'Valid SSN required.',
      'Married taxpayers must file jointly.'
    ],
    officialSource: 'https://www.irs.gov/newsroom/schedule-1-a-additional-deductions-what-to-know-about-the-new-form'
  },
  {
    id: 'qbi-199a',
    name: 'Qualified Business Income Deduction',
    kind: 'deduction',
    form: 'Form 8995 / 8995-A',
    destination: 'Form 1040 line 13a',
    refundability: 'not-applicable',
    support: 'worksheet-required',
    maximum: 'Generally up to 20% subject to taxable-income, W-2 wage, UBIA, SSTB and other limitations.',
    thresholds: 'Simplified Form 8995 threshold: $197,300; $394,600 MFJ. Phase-in upper range: $247,300; $494,600 MFJ.',
    eligibility: [
      'Requires qualified business income, REIT dividends, or qualified PTP income.',
      'Higher-income returns can require Form 8995-A and wage/property limitations.'
    ],
    officialSource: 'https://www.irs.gov/instructions/i8995'
  },
  {
    id: 'educator-expense',
    name: 'Educator Expense Deduction',
    kind: 'adjustment',
    form: 'Schedule 1',
    refundability: 'not-applicable',
    support: 'automatic',
    maximum: '$300 per eligible educator; $600 MFJ if both spouses qualify, limited to $300 each.',
    eligibility: [
      'Eligible K-12 teacher, instructor, counselor, principal or aide.',
      'At least 900 hours during the school year.',
      'Only qualifying unreimbursed expenses.'
    ],
    officialSource: 'https://www.irs.gov/taxtopics/tc458'
  },
  {
    id: 'student-loan-interest',
    name: 'Student Loan Interest Deduction',
    kind: 'adjustment',
    form: 'Schedule 1',
    refundability: 'not-applicable',
    support: 'worksheet-required',
    maximum: 'Up to $2,500.',
    thresholds: '2025 MAGI phaseout $85,000-$100,000; $170,000-$200,000 MFJ.',
    eligibility: [
      'Taxpayer must be legally obligated on a qualified student loan.',
      'MFS is not eligible.',
      'Taxpayer/spouse cannot be claimed as another taxpayer’s dependent.'
    ],
    officialSource: 'https://www.irs.gov/publications/p970'
  },
  {
    id: 'ira-deduction',
    name: 'Traditional IRA Deduction',
    kind: 'adjustment',
    form: 'Schedule 1',
    refundability: 'not-applicable',
    support: 'worksheet-required',
    maximum: 'Contribution limit generally $7,000; $8,000 if age 50 or older, subject to compensation and deduction phaseouts.',
    thresholds: 'Active participant: full/partial/no deduction ranges vary by filing status and workplace-plan coverage.',
    eligibility: [
      'Deduction depends on modified AGI and retirement-plan coverage.',
      'MFS special phaseout can apply.'
    ],
    officialSource: 'https://www.irs.gov/publications/p590a'
  },
  {
    id: 'hsa-deduction',
    name: 'HSA Deduction',
    kind: 'adjustment',
    form: 'Form 8889 / Schedule 1',
    refundability: 'not-applicable',
    support: 'worksheet-required',
    maximum: '$4,300 self-only; $8,550 family for 2025, plus $1,000 catch-up at age 55+.',
    eligibility: [
      'Requires HSA eligibility and qualifying HDHP coverage.',
      'Employer/Archer MSA contributions reduce available limit.',
      'Partial-year and last-month rules can change the allowed amount.'
    ],
    officialSource: 'https://www.irs.gov/instructions/i8889'
  },
  {
    id: 'ctc-actc',
    name: 'Child Tax Credit / Additional Child Tax Credit',
    kind: 'credit',
    form: 'Schedule 8812',
    destination: 'Form 1040 lines 19 / 28',
    refundability: 'partially-refundable',
    support: 'worksheet-required',
    maximum: 'CTC up to $2,200 per qualifying child; ACTC refundable portion up to $1,700 per qualifying child.',
    thresholds: 'Full CTC through $200,000 income; $400,000 MFJ, subject to phaseout above.',
    eligibility: [
      'Qualifying child generally under age 17.',
      'Valid employment SSN required for taxpayer/spouse and qualifying child as applicable.',
      'ACTC generally requires at least $2,500 earned income.'
    ],
    officialSource: 'https://www.irs.gov/credits-deductions/individuals/child-tax-credit'
  },
  {
    id: 'other-dependent-credit',
    name: 'Credit for Other Dependents',
    kind: 'credit',
    form: 'Schedule 8812',
    destination: 'Form 1040 line 19',
    refundability: 'nonrefundable',
    support: 'worksheet-required',
    maximum: '$500 per eligible dependent.',
    thresholds: 'Begins phasing out above $200,000; $400,000 MFJ.',
    eligibility: [
      'Dependent is not eligible for CTC.',
      'Valid SSN, ITIN or ATIN as allowed by IRS rules.'
    ],
    officialSource: 'https://www.irs.gov/credits-deductions/individuals/child-tax-credit'
  },
  {
    id: 'eitc',
    name: 'Earned Income Tax Credit',
    kind: 'credit',
    form: 'Form 1040 + EIC Worksheet / Schedule EIC when applicable',
    destination: 'Form 1040 line 27a',
    refundability: 'refundable',
    support: 'worksheet-required',
    maximum: '2025 maximum: $649 (0 children), $4,328 (1), $7,152 (2), $8,046 (3+).',
    thresholds: 'Investment income limit $11,950. AGI limits depend on filing status and number of qualifying children.',
    eligibility: [
      'Requires earned income and applicable AGI limits.',
      'Qualifying-child, age, residency, SSN and filing-status rules apply.',
      'Exact credit amount uses the 2025 EIC table/worksheet.'
    ],
    officialSource: 'https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit/earned-income-and-earned-income-tax-credit-eitc-tables'
  },
  {
    id: 'dependent-care-credit',
    name: 'Child and Dependent Care Credit',
    kind: 'credit',
    form: 'Form 2441',
    destination: 'Schedule 3 / Form 1040',
    refundability: 'nonrefundable',
    support: 'worksheet-required',
    maximum: 'Qualified expense base up to $3,000 for one qualifying person or $6,000 for two or more; credit percentage 20%-35%.',
    eligibility: [
      'Care generally must enable taxpayer/spouse to work or look for work.',
      'Qualifying-person and earned-income limits apply.',
      'Employer dependent-care benefits reduce the expense base.'
    ],
    officialSource: 'https://www.irs.gov/publications/p503'
  },
  {
    id: 'aotc',
    name: 'American Opportunity Tax Credit',
    kind: 'credit',
    form: 'Form 8863',
    destination: 'Form 1040 / Schedule 3',
    refundability: 'partially-refundable',
    support: 'worksheet-required',
    maximum: '$2,500 per eligible student; up to $1,000 refundable.',
    thresholds: 'MAGI limit reaches zero at $90,000; $180,000 MFJ.',
    eligibility: [
      'Generally first four years of postsecondary education.',
      'Eligible student, institution and qualified-expense rules apply.',
      'Form 1098-T generally required, subject to IRS exceptions.'
    ],
    officialSource: 'https://www.irs.gov/publications/p970'
  },
  {
    id: 'llc',
    name: 'Lifetime Learning Credit',
    kind: 'credit',
    form: 'Form 8863',
    destination: 'Schedule 3',
    refundability: 'nonrefundable',
    support: 'worksheet-required',
    maximum: '20% of first $10,000 qualified expenses; up to $2,000 per return.',
    thresholds: 'MAGI limit reaches zero at $90,000; $180,000 MFJ.',
    eligibility: [
      'Available for eligible higher-education and job-skill courses.',
      'Cannot claim more than one education benefit for the same expense.'
    ],
    officialSource: 'https://www.irs.gov/publications/p970'
  },
  {
    id: 'savers-credit',
    name: 'Retirement Savings Contributions Credit',
    kind: 'credit',
    form: 'Form 8880',
    destination: 'Schedule 3 line 4',
    refundability: 'nonrefundable',
    support: 'worksheet-required',
    maximum: 'Credit rate 10%, 20% or 50% of up to $2,000 eligible contributions per person; maximum $1,000 each.',
    thresholds: '2025 AGI ceiling $79,000 MFJ; $59,250 HOH; $39,500 single/MFS/QSS.',
    eligibility: [
      'Generally age 18+, not full-time student, and not another taxpayer’s dependent.',
      'Recent retirement distributions can reduce eligible contributions.'
    ],
    officialSource: 'https://www.irs.gov/publications/p590a'
  },
  {
    id: 'premium-tax-credit',
    name: 'Premium Tax Credit',
    kind: 'credit',
    form: 'Form 8962',
    destination: 'Schedule 3 / Form 1040',
    refundability: 'refundable',
    support: 'source-document-required',
    eligibility: [
      'Requires qualified Marketplace coverage.',
      'Form 1095-A monthly data drives Form 8962.',
      'Advance PTC must be reconciled against allowed PTC.'
    ],
    officialSource: 'https://www.irs.gov/instructions/i8962'
  },
  {
    id: 'foreign-tax-credit',
    name: 'Foreign Tax Credit',
    kind: 'credit',
    form: 'Form 1116 when required',
    destination: 'Schedule 3',
    refundability: 'nonrefundable',
    support: 'worksheet-required',
    eligibility: [
      'Generally requires qualifying foreign income taxes paid or accrued.',
      'Separate limitation categories can require separate Forms 1116.',
      'Treaty, sourcing and foreign-income rules apply.'
    ],
    officialSource: 'https://www.irs.gov/instructions/i1116'
  },
  {
    id: 'adoption-credit',
    name: 'Adoption Credit',
    kind: 'credit',
    form: 'Form 8839',
    destination: 'Schedule 3 / Form 1040',
    refundability: 'partially-refundable',
    support: 'worksheet-required',
    maximum: '$17,280 qualified adoption expenses per qualifying child; up to $5,000 refundable for 2025.',
    thresholds: '2025 eligibility subject to MAGI limits; IRS page states eligibility through MAGI $259,190 before further phaseout rules.',
    eligibility: [
      'Qualified adoption and expense timing rules apply.',
      'Special-needs and international adoption rules differ.'
    ],
    officialSource: 'https://www.irs.gov/credits-deductions/individuals/adoption-credit'
  },
  {
    id: 'energy-efficient-home',
    name: 'Energy Efficient Home Improvement Credit',
    kind: 'credit',
    form: 'Form 5695',
    destination: 'Schedule 3',
    refundability: 'nonrefundable',
    support: 'source-document-required',
    maximum: 'Generally up to $3,200 per year for 2025: $1,200 general annual limit plus up to $2,000 for certain heat pumps/water heaters/biomass property.',
    eligibility: [
      'Qualified existing U.S. main-home improvements.',
      '2025 qualified manufacturer identification requirements can apply.'
    ],
    officialSource: 'https://www.irs.gov/credits-deductions/energy-efficient-home-improvement-credit'
  },
  {
    id: 'residential-clean-energy',
    name: 'Residential Clean Energy Credit',
    kind: 'credit',
    form: 'Form 5695',
    destination: 'Schedule 3',
    refundability: 'nonrefundable',
    support: 'source-document-required',
    maximum: '30% of qualifying property costs placed in service through December 31, 2025.',
    eligibility: [
      'Qualified solar, wind, geothermal, fuel cell or battery-storage property.',
      'Unused eligible credit can generally carry forward.'
    ],
    officialSource: 'https://www.irs.gov/credits-deductions/residential-clean-energy-credit'
  },
  {
    id: 'clean-vehicle-new',
    name: 'New Clean Vehicle Credit',
    kind: 'credit',
    form: 'Form 8936 + Schedule A (Form 8936)',
    refundability: 'nonrefundable',
    support: 'source-document-required',
    maximum: 'Up to $7,500 for eligible vehicles.',
    thresholds: 'MAGI limits: $300,000 MFJ/QSS; $225,000 HOH; $150,000 other filers.',
    eligibility: [
      'Vehicle generally must have been acquired on or before September 30, 2025.',
      'Vehicle/manufacturer/battery/final-assembly and seller reporting requirements apply.'
    ],
    officialSource: 'https://www.irs.gov/credits-deductions/credits-for-new-clean-vehicles-purchased-in-2023-or-after'
  },
  {
    id: 'clean-vehicle-used',
    name: 'Previously-Owned Clean Vehicle Credit',
    kind: 'credit',
    form: 'Form 8936 + Schedule A (Form 8936)',
    refundability: 'nonrefundable',
    support: 'source-document-required',
    maximum: '30% of sale price up to $4,000.',
    thresholds: 'MAGI limits: $150,000 MFJ/QSS; $112,500 HOH; $75,000 other filers.',
    eligibility: [
      'Qualified used vehicle generally priced at $25,000 or less.',
      'Vehicle generally must have been acquired on or before September 30, 2025.',
      'Dealer and prior-credit rules apply.'
    ],
    officialSource: 'https://www.irs.gov/credits-deductions/used-clean-vehicle-credit'
  }
] as const;

export function federalBenefitsByKind2025(kind: FederalBenefitKind2025) {
  return FEDERAL_BENEFITS_2025.filter((benefit) => benefit.kind === kind);
}

export function federalBenefit2025(id: string) {
  return FEDERAL_BENEFITS_2025.find((benefit) => benefit.id === id) ?? null;
}
