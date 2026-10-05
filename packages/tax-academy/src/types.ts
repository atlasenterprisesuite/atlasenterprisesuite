export type ProfessionalLevelId =
  | 'A0'
  | 'A1'
  | 'A2'
  | 'A3'
  | 'A4'
  | 'A5'
  | 'A6'
  | 'A7'
  | 'A8';

export type CriticalFailureCode =
  | 'fabricated_evidence'
  | 'omitted_material_income'
  | 'unsupported_status_or_dependent'
  | 'stale_year_rule_after_diagnostic'
  | 'form_8867_bypass'
  | 'protected_taxpayer_data_exposure'
  | 'false_filed_or_accepted_claim';

export type WrittenExamQuestion = {
  id: string;
  correctAnswer: string;
  critical?: boolean;
};

export type WrittenExamBlueprint = {
  questions: readonly WrittenExamQuestion[];
};

export type WrittenExamSubmission = {
  answers: Readonly<Record<string, string>>;
  externalCredentialVerified?: boolean;
  instructor?: boolean;
};

export type WrittenExamScore = {
  score: number;
  correct: number;
  total: number;
  failedCriticalQuestionIds: string[];
};

export type PracticalScoreComponent = {
  id: string;
  weight: number;
  score: number;
};

export type PracticalScoreInput = {
  components: readonly PracticalScoreComponent[];
  criticalFailures?: readonly CriticalFailureCode[];
  passingScore: number;
};

export type PracticalScore = {
  weightedScore: number;
  criticalFailures: CriticalFailureCode[];
  passed: boolean;
};


export type CertificationEvidence = {
  writtenScore?: number;
  intakePracticalScore?: number;
  securityCriticalPassed?: boolean;
  simpleReturnPracticalScore?: number;
  filingStatusPracticalScore?: number;
  familyCreditsPracticalScore?: number;
  form8867CriticalPassed?: boolean;
  supervisedAcceptedReturns?: number;
  businessPracticalScore?: number;
  criticalEvidenceGatesPassed?: boolean;
  supervisedA4Returns?: number;
  advancedPracticalScore?: number;
  reviewedA4A5Returns?: number;
  capstoneScore?: number;
  secondCapstoneScore?: number;
  reviewerCalibrationScore?: number;
  criticalItemsPassed?: boolean;
  domainCompetencies?: number;
  annualRecertificationCurrent?: boolean;
  ceHours?: number;
  taxDirectorApproved?: boolean;
  finalInternalApproval?: boolean;
  masterPracticalScore?: number;
  reviewerApproved?: boolean;
  criticalFailures?: readonly CriticalFailureCode[];
};

export type ProfessionalLevelDecision = {
  currentLevel: ProfessionalLevelId;
  nextEligibleLevel: ProfessionalLevelId | null;
  missingRequirements: string[];
  permittedReturnClasses: string[];
  reviewerRequired: boolean;
  productionAuthorized: boolean;
};

export type SpecialtyEvidence = {
  specialtyScores?: Readonly<Record<string, number>>;
  externalCredentials?: Readonly<Record<string, { externalCredentialVerified: boolean }>>;
};

export type SpecialtyDecision = {
  badge: string;
  granted: boolean;
  internal: boolean;
};
