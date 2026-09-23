export type TaxAuthorityRuleStatus = 'final' | 'proposed' | 'operational';

export type TaxAuthorityRule = {
  id: string;
  jurisdiction: string;
  authority: string;
  status: TaxAuthorityRuleStatus;
  publishedOn: string;
  effectiveOn?: string;
  taxYear?: number;
  modules: readonly string[];
  review: readonly string[];
  source: string;
  notes: string;
};

export const TAX_AUTHORITY_RULES_2026_09_23: readonly TaxAuthorityRule[] = [
  {
    id: 'US-IRC-6050AA-1098-VLI-2026',
    jurisdiction: 'US-FED',
    authority: 'Internal Revenue Service / U.S. Treasury',
    status: 'final',
    publishedOn: '2026-09-21',
    effectiveOn: '2026-11-09',
    taxYear: 2026,
    modules: ['Tax', 'Accounting', 'Information Returns'],
    review: ['forms', 'calculations', 'validation', 'e-file', 'reporting'],
    source: 'https://www.irs.gov/irb/2026-39_irb',
    notes: 'Register Form 1098-VLI and section 6050AA reporting. $600 reporting threshold. Passenger-vehicle-loan-interest deduction is governed by effective-dated federal calculation rules; do not infer eligibility from the form alone.'
  },
  {
    id: 'US-IRIS-ONLY-2027-FILING-SEASON',
    jurisdiction: 'US-FED',
    authority: 'Internal Revenue Service',
    status: 'final',
    publishedOn: '2026-09-22',
    taxYear: 2026,
    modules: ['Tax', 'Accounting', 'Information Returns'],
    review: ['e-file', 'validation', 'reporting'],
    source: 'https://www.irs.gov/publications/p1099',
    notes: 'For tax year 2026 / filing season 2027, IRIS is the information-return intake system. FIRE is retired. Provider acceptance remains fail-closed until authenticated acknowledgement.'
  },
  {
    id: 'US-REV-PROC-2026-32-FORM-3115',
    jurisdiction: 'US-FED',
    authority: 'Internal Revenue Service',
    status: 'final',
    publishedOn: '2026-09-21',
    taxYear: 2026,
    modules: ['Tax', 'Accounting'],
    review: ['forms', 'calculations', 'validation', 'deadlines'],
    source: 'https://www.irs.gov/pub/irs-irbs/irb26-39.pdf',
    notes: 'Form 3115 workflow must support Rev. Proc. 2026-32 transition rules and DCN 275 where applicable. Eligibility and section 481(a) treatment require governed fact validation.'
  },
  {
    id: 'US-NY-ALT-NICOTINE-2026',
    jurisdiction: 'US-NY',
    authority: 'New York State Department of Taxation and Finance',
    status: 'final',
    publishedOn: '2026-07-01',
    effectiveOn: '2026-09-01',
    taxYear: 2026,
    modules: ['Commerce', 'POS', 'Inventory', 'Tax', 'Accounting'],
    review: ['calculations', 'validation', 'forms', 'deadlines', 'localization', 'reporting'],
    source: 'https://www.tax.ny.gov/forms/n-notices/n-26-2.htm',
    notes: 'Alternative nicotine products are subject to New York tobacco products tax at 75% of wholesale price. Preserve New York-only scope. MT-200.5 floor-tax deadline was 2026-09-21; late cases require penalty/interest review rather than deadline substitution.'
  },
  {
    id: 'DE-KASSENPFLICHT-DRAFT-2028',
    jurisdiction: 'DE',
    authority: 'Bundesministerium der Finanzen',
    status: 'proposed',
    publishedOn: '2026-09-23',
    effectiveOn: '2028-01-01',
    modules: ['Commerce', 'POS', 'Accounting', 'Tax', 'Audit'],
    review: ['localization', 'validation', 'reporting', 'digital receipts'],
    source: 'https://www.bundesfinanzministerium.de/Content/DE/Standardartikel/Themen/Steuern/registrierkassenpflicht.html',
    notes: 'Cabinet-approved draft: planned electronic cash-register requirement above EUR 100,000 annual turnover and digital-receipt changes from 2028. Keep feature-gated as proposed; never enforce as enacted law until authoritative final promulgation is recorded.'
  }
] as const;

export function activeFinalTaxAuthorityRules(asOf: string) {
  return TAX_AUTHORITY_RULES_2026_09_23.filter((rule) =>
    rule.status === 'final' && (!rule.effectiveOn || rule.effectiveOn <= asOf)
  );
}

export function proposedTaxAuthorityRules() {
  return TAX_AUTHORITY_RULES_2026_09_23.filter((rule) => rule.status === 'proposed');
}
