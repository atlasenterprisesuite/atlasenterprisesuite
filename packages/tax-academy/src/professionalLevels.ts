import type {
  CertificationEvidence,
  ProfessionalLevelDecision,
  ProfessionalLevelId,
} from './types';

const ORDER: readonly ProfessionalLevelId[] = ['A0','A1','A2','A3','A4','A5','A6','A7','A8'];

const atLeast = (value: number | undefined, minimum: number) =>
  typeof value === 'number' && Number.isFinite(value) && value >= minimum;

const clean = (evidence: CertificationEvidence) =>
  (evidence.criticalFailures?.length ?? 0) === 0;

function directRequirements(level: ProfessionalLevelId, e: CertificationEvidence): string[] {
  const missing: string[] = [];
  const score = (value: number | undefined, minimum: number, label: string) => {
    if (!atLeast(value, minimum)) missing.push(`${label} >= ${minimum}%`);
  };
  const flag = (value: boolean | undefined, label: string) => {
    if (value !== true) missing.push(label);
  };
  const count = (value: number | undefined, minimum: number, label: string) => {
    if (!atLeast(value, minimum)) missing.push(`${label} >= ${minimum}`);
  };

  if (level === 'A0') return missing;
  if (!clean(e)) missing.push('resolve critical failures');

  if (level === 'A1') {
    score(e.writtenScore, 80, 'written score');
    score(e.intakePracticalScore, 90, 'intake practical');
    flag(e.securityCriticalPassed, 'privacy/security critical items passed');
  } else if (level === 'A2') {
    score(e.writtenScore, 85, 'written score');
    score(e.simpleReturnPracticalScore, 90, 'simple-return practical');
    score(e.filingStatusPracticalScore, 90, 'filing-status practical');
    flag(e.reviewerApproved, 'reviewer approval');
  } else if (level === 'A3') {
    score(e.writtenScore, 88, 'written score');
    score(e.familyCreditsPracticalScore, 92, 'family/credits practical');
    flag(e.form8867CriticalPassed, 'Form 8867 critical items passed');
    count(e.supervisedAcceptedReturns, 3, 'supervised accepted returns');
    if ((e.supervisedReturnMaterialCorrections ?? 0) > 0) {
      missing.push('no material supervised-return correction attributable to preparer negligence');
    }
  } else if (level === 'A4') {
    score(e.writtenScore, 90, 'written score');
    score(e.businessPracticalScore, 92, 'Schedule C/SE/QBI practical');
    flag(e.criticalEvidenceGatesPassed, 'critical evidence gates passed');
    count(e.supervisedA4Returns, 5, 'supervised A4-scope returns');
  } else if (level === 'A5') {
    score(e.writtenScore, 92, 'written score');
    score(e.advancedPracticalScore, 94, 'advanced practical');
    count(e.reviewedA4A5Returns, 10, 'reviewed A4/A5-scope returns');
  } else if (level === 'A6') {
    score(e.writtenScore, 94, 'written score');
    score(e.capstoneScore, 95, 'capstone practical');
    score(e.reviewerCalibrationScore, 95, 'reviewer calibration');
    flag(e.criticalItemsPassed, 'integrity/security/due-diligence critical items passed');
  } else if (level === 'A7') {
    score(e.writtenScore, 96, 'written score');
    score(e.capstoneScore, 96, 'first capstone');
    score(e.secondCapstoneScore, 96, 'second capstone');
    score(e.reviewerCalibrationScore, 96, 'reviewer calibration');
    flag(e.annualRecertificationCurrent, 'annual recertification current');
    flag(e.taxDirectorApproved, 'Tax Director approval');
  } else if (level === 'A8') {
    score(e.writtenScore, 97, 'Master written assessment');
    score(e.masterPracticalScore, 97, 'Master practical battery');
    count(e.domainCompetencies, 5, 'major-domain competencies');
    count(e.ceHours, 32, 'annual continuing-education hours');
    flag(e.annualRecertificationCurrent, 'annual recertification current');
    flag(e.finalInternalApproval, 'final Tax Director/Compliance approval');
  }

  return missing;
}

function cumulativeMissing(level: ProfessionalLevelId, evidence: CertificationEvidence): string[] {
  const levelIndex = ORDER.indexOf(level);
  const missing = new Set<string>();
  for (let index = 1; index <= levelIndex; index += 1) {
    for (const requirement of directRequirements(ORDER[index], evidence)) {
      missing.add(requirement);
    }
  }
  return [...missing];
}

const SCOPES: Record<ProfessionalLevelId, string[]> = {
  A0: ['synthetic_practice'],
  A1: ['intake', 'document_classification'],
  A2: ['simple_individual'],
  A3: ['simple_individual', 'family_credits'],
  A4: ['simple_individual', 'family_credits', 'schedule_c_business', 'schedule_se', 'vehicle_mileage', 'home_office', 'routine_depreciation', 'qbi_supported'],
  A5: ['a4_scope', 'marketplace', 'investments', 'rental', 'retirement_hsa_ira', 'common_amendments', 'review_a1_a3'],
  A6: ['review_a1_a5', 'integrated_individual_review'],
  A7: ['second_level_review', 'complex_supported_individual', 'mentoring', 'examiner'],
  A8: ['senior_review', 'training_authority', 'golden_fixture_authority'],
};

export function evaluateProfessionalLevel(
  evidence: CertificationEvidence
): ProfessionalLevelDecision {
  let currentLevel: ProfessionalLevelId = 'A0';

  for (const level of ORDER.slice(1)) {
    if (cumulativeMissing(level, evidence).length === 0) {
      currentLevel = level;
    } else {
      break;
    }
  }

  const index = ORDER.indexOf(currentLevel);
  const nextEligibleLevel = index < ORDER.length - 1 ? ORDER[index + 1] : null;
  const productionAuthorized =
    index >= ORDER.indexOf('A2') &&
    evidence.reviewerApproved === true &&
    evidence.annualRecertificationCurrent !== false &&
    clean(evidence);

  return {
    currentLevel,
    nextEligibleLevel,
    missingRequirements: nextEligibleLevel ? cumulativeMissing(nextEligibleLevel, evidence) : [],
    permittedReturnClasses: SCOPES[currentLevel],
    reviewerRequired: index >= ORDER.indexOf('A2') && index < ORDER.indexOf('A6'),
    productionAuthorized,
  };
}

export const PROFESSIONAL_LEVEL_IDS = ORDER;
