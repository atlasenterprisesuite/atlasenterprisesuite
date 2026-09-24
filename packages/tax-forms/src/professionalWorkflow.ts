
export type TaxReturnKind = '1040' | '1065' | '1120-S' | '1120' | '1041';
export type TaxWorkflowStatus = 'not_started' | 'in_progress' | 'review' | 'blocked' | 'complete';
export type TaxStepGate = 'none' | 'data-complete' | 'professional-review' | 'taxpayer-signature' | 'efile-authorization';

export type TaxProfessionalStep = {
  id: string;
  order: number;
  title: string;
  shortTitle: string;
  description: string;
  appliesTo: TaxReturnKind[] | ['all'];
  gate: TaxStepGate;
  formLinks: string[];
  sourceLinks: string[];
  outputs: string[];
};

export type TaxReturnCase = {
  returnId: string;
  taxYear: number;
  returnKind: TaxReturnKind;
  clientDisplayName: string;
  preparerDisplayName: string;
  status: TaxWorkflowStatus;
  currentStepId: string;
  completedStepIds: string[];
  reviewStepIds: string[];
  blockedStepIds: string[];
  activatedForms: string[];
  missingItems: string[];
  diagnostics: string[];
};

export type TaxStepState = {
  step: TaxProfessionalStep;
  state: 'complete' | 'current' | 'review' | 'blocked' | 'available' | 'future';
};

const ALL: ['all'] = ['all'];

export const TAX_PROFESSIONAL_STEPS: readonly TaxProfessionalStep[] = [
  {
    id: 'engagement',
    order: 1,
    title: 'Engagement & preparer setup',
    shortTitle: 'Engagement',
    description: 'Confirm client, tax year, return type, preparer assignment, PTIN/firm context, engagement scope and filing responsibility.',
    appliesTo: ALL,
    gate: 'data-complete',
    formLinks: [],
    sourceLinks: ['Engagement letter', 'Prior-year return', 'Client authorization'],
    outputs: ['Return case', 'Preparer assignment', 'Tax year lock']
  },
  {
    id: 'identity',
    order: 2,
    title: 'Taxpayer / entity identity',
    shortTitle: 'Identity',
    description: 'Capture legal names, taxpayer IDs, addresses, entity classification, filing jurisdiction and identity-validation status.',
    appliesTo: ALL,
    gate: 'data-complete',
    formLinks: ['Form 1040', 'Form 1065', 'Form 1120-S', 'Form 1120', 'Form 1041'],
    sourceLinks: ['SSN/ITIN/EIN evidence', 'Prior-year return', 'Entity records'],
    outputs: ['Identity profile', 'Jurisdiction profile']
  },
  {
    id: 'household',
    order: 3,
    title: 'Household, dependents & filing status',
    shortTitle: 'Household',
    description: 'Resolve spouse, dependents, residency, support, custody and filing-status facts before calculating credits or deductions.',
    appliesTo: ['1040'],
    gate: 'professional-review',
    formLinks: ['Form 1040', 'Schedule 8812', 'Form 8867'],
    sourceLinks: ['Dependent documents', 'Residency/support evidence', 'Custody records'],
    outputs: ['Filing status', 'Dependent eligibility', 'Due-diligence triggers']
  },
  {
    id: 'income-documents',
    order: 4,
    title: 'Income documents',
    shortTitle: 'Income',
    description: 'Enter or import W-2, 1099, K-1 and other source documents. Every source value keeps a trace to its destination form/line.',
    appliesTo: ALL,
    gate: 'data-complete',
    formLinks: ['Form 1040', 'Schedule 1', 'Schedule B', 'Schedule C', 'Schedule D', 'Schedule E', 'Schedule F', 'Form 8949', 'Form 4797'],
    sourceLinks: ['W-2', '1099 family', 'K-1/K-2/K-3', 'SSA-1099', 'Broker statements'],
    outputs: ['Normalized income ledger', 'Source-to-form trace graph']
  },
  {
    id: 'business-activity',
    order: 5,
    title: 'Business, rental, farm & pass-through activity',
    shortTitle: 'Business',
    description: 'Build Schedule C/E/F or entity-return activity, basis and owner allocations from books, source documents and fixed-asset data.',
    appliesTo: ALL,
    gate: 'professional-review',
    formLinks: ['Schedule C', 'Schedule E', 'Schedule F', 'Form 4562', 'Form 4797', 'Form 8829', 'Form 1065', 'Form 1120-S', 'Form 1120'],
    sourceLinks: ['P&L', 'General ledger', 'Asset register', 'Mileage/home-office records', 'Partner/shareholder basis'],
    outputs: ['Activity statements', 'Basis limitations', 'Depreciation schedules']
  },
  {
    id: 'adjustments',
    order: 6,
    title: 'Adjustments to income',
    shortTitle: 'Adjustments',
    description: 'Resolve deductible IRA, HSA, student-loan interest, self-employed adjustments and other above-the-line items.',
    appliesTo: ['1040'],
    gate: 'professional-review',
    formLinks: ['Schedule 1', 'Form 8889', 'Form 8606'],
    sourceLinks: ['IRA/HSA records', '1098-E', 'Self-employed health/pension records'],
    outputs: ['Adjusted gross income inputs']
  },
  {
    id: 'deductions',
    order: 7,
    title: 'Standard or itemized deductions',
    shortTitle: 'Deductions',
    description: 'Compare standard deduction with itemized deductions and retain supporting documentation for the selected treatment.',
    appliesTo: ['1040'],
    gate: 'professional-review',
    formLinks: ['Schedule A'],
    sourceLinks: ['1098 mortgage interest', 'Taxes paid', 'Charitable records', 'Medical records when applicable'],
    outputs: ['Deduction method', 'Schedule A when activated']
  },
  {
    id: 'credits',
    order: 8,
    title: 'Credits & due diligence',
    shortTitle: 'Credits',
    description: 'Evaluate refundable and nonrefundable credits and activate preparer due-diligence workflows when required.',
    appliesTo: ['1040'],
    gate: 'professional-review',
    formLinks: ['Schedule 3', 'Schedule 8812', 'Form 2441', 'Form 8863', 'Form 8867', 'Form 8962'],
    sourceLinks: ['Education records', 'Child/dependent care', 'Marketplace 1095-A', 'Eligibility evidence'],
    outputs: ['Credit eligibility', 'Due-diligence checklist', 'Evidence notes']
  },
  {
    id: 'international',
    order: 9,
    title: 'Foreign & cross-border',
    shortTitle: 'International',
    description: 'Resolve foreign accounts, foreign income/taxes, foreign entities, K-2/K-3 items, treaty positions and cross-border disclosures.',
    appliesTo: ALL,
    gate: 'professional-review',
    formLinks: ['Form 1116', 'Form 2555', 'Form 8938', 'Form 5471', 'Form 5472', 'Form 8858', 'Form 8865', 'Schedules K-2/K-3'],
    sourceLinks: ['Foreign statements', 'K-2/K-3', 'Entity ownership records', 'Treaty position evidence'],
    outputs: ['International disclosures', 'Foreign-tax treatment', 'Treaty review']
  },
  {
    id: 'payments',
    order: 10,
    title: 'Payments, withholding & estimates',
    shortTitle: 'Payments',
    description: 'Reconcile withholding, estimates, extensions, prior-year overpayments and other payments before balance due/refund.',
    appliesTo: ALL,
    gate: 'data-complete',
    formLinks: ['Form 1040', 'Form 1040-ES', 'Form 4868', 'Form 7004'],
    sourceLinks: ['W-2/1099 withholding', 'Estimated tax confirmations', 'Extension payments'],
    outputs: ['Payment ledger', 'Refund/balance inputs']
  },
  {
    id: 'state-local',
    order: 11,
    title: 'State & local returns',
    shortTitle: 'State/Local',
    description: 'Resolve residency, apportionment, state/local source income, withholding, credits for taxes paid and locality-specific filing.',
    appliesTo: ALL,
    gate: 'professional-review',
    formLinks: ['State/local return packs'],
    sourceLinks: ['State W-2/1099 data', 'Residency facts', 'Apportionment/source records'],
    outputs: ['State/local return set', 'Jurisdiction diagnostics']
  },
  {
    id: 'diagnostics',
    order: 12,
    title: 'Diagnostics & missing information',
    shortTitle: 'Diagnostics',
    description: 'Run completeness, contradiction, carryforward, duplicate-document, limit, basis and tax-year revision diagnostics.',
    appliesTo: ALL,
    gate: 'data-complete',
    formLinks: [],
    sourceLinks: ['All return data'],
    outputs: ['Blocking diagnostics', 'Warnings', 'Missing-document list']
  },
  {
    id: 'professional-review',
    order: 13,
    title: 'Professional review',
    shortTitle: 'Review',
    description: 'Review every calculated form, election, override, diagnostic and source trace before client presentation.',
    appliesTo: ALL,
    gate: 'professional-review',
    formLinks: ['Full return set'],
    sourceLinks: ['Return comparison', 'Diagnostics', 'Source-to-line trace'],
    outputs: ['Reviewed return', 'Reviewer sign-off', 'Open-item list']
  },
  {
    id: 'client-review',
    order: 14,
    title: 'Client review & consent',
    shortTitle: 'Client',
    description: 'Present the return, explain refund/balance and elections, record client changes, and obtain required taxpayer authorizations.',
    appliesTo: ALL,
    gate: 'taxpayer-signature',
    formLinks: ['Form 8879 when applicable', 'Entity e-file authorization forms when applicable'],
    sourceLinks: ['Final return PDF', 'Client authorization'],
    outputs: ['Client approval', 'Signature authorization']
  },
  {
    id: 'efile',
    order: 15,
    title: 'E-file validation & transmission gate',
    shortTitle: 'E-file',
    description: 'Validate schema, preparer/provider authorization, taxpayer signature authorization, attachments and submission readiness. Transmission remains disabled without a verified filing rail.',
    appliesTo: ALL,
    gate: 'efile-authorization',
    formLinks: ['IRS MeF / applicable filing package'],
    sourceLinks: ['EFIN/provider state', 'Signed authorization', 'Final validated return'],
    outputs: ['Submission package', 'Transmission eligibility', 'Acknowledgment tracking']
  },
  {
    id: 'closeout',
    order: 16,
    title: 'Acknowledgment, billing & archive',
    shortTitle: 'Closeout',
    description: 'Track accepted/rejected status, resolve rejects, deliver final copies, retain compliance evidence, bill the engagement and archive the return.',
    appliesTo: ALL,
    gate: 'none',
    formLinks: [],
    sourceLinks: ['IRS/state acknowledgments', 'Final signed return', 'Engagement billing'],
    outputs: ['Filed/accepted status', 'Client delivery', 'Retention package', 'Billing handoff']
  }
];

export function stepsForReturn(returnKind: TaxReturnKind): TaxProfessionalStep[] {
  return TAX_PROFESSIONAL_STEPS
    .filter((step) => step.appliesTo[0] === 'all' || (step.appliesTo as TaxReturnKind[]).includes(returnKind))
    .sort((a, b) => a.order - b.order);
}

export function stepStates(returnCase: TaxReturnCase): TaxStepState[] {
  const steps = stepsForReturn(returnCase.returnKind);
  const currentIndex = Math.max(0, steps.findIndex((step) => step.id === returnCase.currentStepId));

  return steps.map((step, index) => {
    if (returnCase.completedStepIds.includes(step.id)) return { step, state: 'complete' };
    if (returnCase.blockedStepIds.includes(step.id)) return { step, state: 'blocked' };
    if (returnCase.reviewStepIds.includes(step.id)) return { step, state: 'review' };
    if (step.id === returnCase.currentStepId) return { step, state: 'current' };
    if (index < currentIndex) return { step, state: 'available' };
    return { step, state: 'future' };
  });
}

export function filingReadiness(returnCase: TaxReturnCase) {
  const requiredSteps = stepsForReturn(returnCase.returnKind).filter((step) => step.id !== 'closeout');
  const incomplete = requiredSteps.filter((step) => !returnCase.completedStepIds.includes(step.id));
  const blocking = returnCase.blockedStepIds.length > 0 || returnCase.missingItems.length > 0 || returnCase.diagnostics.length > 0;
  const signatureComplete = returnCase.completedStepIds.includes('client-review');
  const professionalReviewComplete = returnCase.completedStepIds.includes('professional-review');

  return {
    ready: incomplete.length === 0 && !blocking && signatureComplete && professionalReviewComplete,
    incompleteStepIds: incomplete.map((step) => step.id),
    blocking,
    signatureComplete,
    professionalReviewComplete
  };
}

export const TAX_PROFESSIONAL_SYSTEM_AREAS = [
  'Firm & preparer administration',
  'Client CRM / engagements',
  'Return work queue',
  'Interview / organizer',
  'Document intake + OCR/import adapters',
  'Source-to-form mapping engine',
  'Federal personal returns',
  'Federal business returns',
  'State/local localization packs',
  'International / treaty workflows',
  'Calculations / worksheets / carryforwards',
  'Diagnostics / validation',
  'Due diligence / Form 8867 evidence',
  'Reviewer / preparer sign-off',
  'Client portal / consent / signatures',
  'E-file provider adapters / acknowledgments',
  'Notices / amended returns / extensions',
  'Billing / payments handoff',
  'Document retention / audit trail',
  'Tax law monitor / versioned rule releases',
  'Reporting / firm analytics'
] as const;
