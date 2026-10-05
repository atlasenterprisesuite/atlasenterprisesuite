import type { CertificationEvidence, ProfessionalLevelDecision, ProfessionalLevelId } from './types';

const ORDER: readonly ProfessionalLevelId[] = ['A0','A1','A2','A3','A4','A5','A6','A7','A8'];

function clean(e: CertificationEvidence) {
  return (e.criticalFailures?.length ?? 0) === 0;
}
function atLeast(v: number | undefined, n: number) { return (v ?? -1) >= n; }

function qualifies(level: ProfessionalLevelId, e: CertificationEvidence): boolean {
  if (!clean(e)) return level === 'A0';
  switch (level) {
    case 'A0': return true;
    case 'A1': return atLeast(e.writtenScore,80) && atLeast(e.intakePracticalScore,90) && e.securityCriticalPassed === true;
    case 'A2': return atLeast(e.writtenScore,85) && atLeast(e.simpleReturnPracticalScore,90) && atLeast(e.filingStatusPracticalScore,90) && e.reviewerApproved === true;
    case 'A3': return atLeast(e.writtenScore,88) && atLeast(e.familyCreditsPracticalScore,92) && e.form8867CriticalPassed === true && (e.supervisedAcceptedReturns ?? 0) >= 3;
    case 'A4': return atLeast(e.writtenScore,90) && atLeast(e.businessPracticalScore,92) && e.criticalEvidenceGatesPassed === true && (e.supervisedA4Returns ?? 0) >= 5 && e.reviewerApproved === true;
    case 'A5': return atLeast(e.writtenScore,92) && atLeast(e.advancedPracticalScore,94) && (e.reviewedA4A5Returns ?? 0) >= 10 && e.reviewerApproved === true;
    case 'A6': return atLeast(e.writtenScore,94) && atLeast(e.capstoneScore,95) && atLeast(e.reviewerCalibrationScore,95) && e.criticalItemsPassed === true;
    case 'A7': return atLeast(e.writtenScore,96) && atLeast(e.capstoneScore,96) && atLeast(e.secondCapstoneScore,96) && e.annualRecertificationCurrent === true && e.taxDirectorApproved === true;
    case 'A8': return atLeast(e.writtenScore,97) && atLeast(e.masterPracticalScore,97) && e.criticalItemsPassed === true && (e.domainCompetencies ?? 0) >= 5 && e.annualRecertificationCurrent === true && (e.ceHours ?? 0) >= 32 && e.finalInternalApproval === true;
  }
}

const SCOPES: Record<ProfessionalLevelId,string[]> = {
  A0:['synthetic_practice'],
  A1:['intake','document_classification'],
  A2:['simple_individual'],
  A3:['simple_individual','family_credits'],
  A4:['simple_individual','family_credits','schedule_c_business','schedule_se','vehicle_mileage','home_office','routine_depreciation','qbi_supported'],
  A5:['a4_scope','marketplace','investments','rental','retirement_hsa_ira','common_amendments','review_a1_a3'],
  A6:['review_a1_a5','integrated_individual_review'],
  A7:['second_level_review','complex_supported_individual','mentoring','examiner'],
  A8:['senior_review','training_authority','golden_fixture_authority'],
};

function missingFor(next: ProfessionalLevelId, e: CertificationEvidence): string[] {
  if (qualifies(next,e)) return [];
  const out:string[]=[];
  if (!clean(e)) out.push('resolve_critical_failures');
  if (next !== 'A0') out.push('complete_'+next.toLowerCase()+'_requirements');
  return out;
}

export function evaluateProfessionalLevel(evidence: CertificationEvidence): ProfessionalLevelDecision {
  let current: ProfessionalLevelId='A0';
  for (const level of ORDER) if (qualifies(level,evidence)) current=level;
  const index=ORDER.indexOf(current);
  const next=index < ORDER.length-1 ? ORDER[index+1] : null;
  return {
    currentLevel: current,
    nextEligibleLevel: next,
    missingRequirements: next ? missingFor(next,evidence) : [],
    permittedReturnClasses: SCOPES[current],
    reviewerRequired: !['A6','A7','A8'].includes(current),
    productionAuthorized: ['A2','A3','A4','A5','A6','A7','A8'].includes(current) && clean(evidence),
  };
}
