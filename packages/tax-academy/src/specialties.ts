import type { SpecialtyDecision, SpecialtyEvidence } from './types';

const INTERNAL: Readonly<Record<string,string>> = {
  family_credits: 'Family & Credits',
  small_business: 'Small Business / Schedule C',
  marketplace: 'Marketplace / Form 8962',
  retirement_ira: 'Retirement & IRA',
  investment_income: 'Investment Income',
  rental_real_estate: 'Rental Real Estate',
  depreciation_basis: 'Depreciation & Basis',
  international_individual: 'International Individual Tax',
  military_tax: 'Military Tax',
  multi_state: 'Multi-State Tax',
  notices_amendments: 'Notices & Amendments',
  review_quality: 'Tax Review & Quality',
};
const EXTERNAL: Readonly<Record<string,string>> = {
  EA:'EA Verified', CPA:'CPA Verified', Attorney:'Attorney Verified', AFSP:'AFSP Record of Completion Verified'
};

export function evaluateSpecialtyBadges(evidence: SpecialtyEvidence): SpecialtyDecision[] {
  const decisions: SpecialtyDecision[]=[];
  for (const [key,badge] of Object.entries(INTERNAL)) {
    if (evidence.specialtyScores?.[key] !== undefined) {
      decisions.push({ badge, granted: evidence.specialtyScores[key] >= 90, internal: true });
    }
  }
  for (const [key,badge] of Object.entries(EXTERNAL)) {
    const supplied=evidence.externalCredentials?.[key];
    if (supplied !== undefined) decisions.push({ badge, granted: supplied.externalCredentialVerified === true, internal: false });
  }
  return decisions;
}
