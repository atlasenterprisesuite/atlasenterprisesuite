import type { EvidenceBoundaryInput } from './types';

export const POSSIBLE_CURE_RESEARCH_LABEL = 'POSSIBLE CURE — RESEARCH CANDIDATE' as const;

export type CureCandidateStage =
  | 'RESEARCH_CANDIDATE'
  | 'HUMAN_REVIEW_REQUIRED'
  | 'EXTERNAL_VALIDATION_REQUIRED'
  | 'REJECTED'
  | 'ARCHIVED';

export interface CureCandidateInput {
  candidateKey: string;
  diseaseKey: string;
  title: string;
  researchSummary: string;
  sourceReference: string;
  evidence: EvidenceBoundaryInput;
}

export interface CureCandidateRecord {
  candidateKey: string;
  diseaseKey: string;
  title: string;
  researchSummary: string;
  sourceReference: string;
  sourceEvidenceType: EvidenceBoundaryInput['evidenceType'];
  researchLabel: typeof POSSIBLE_CURE_RESEARCH_LABEL;
  stage: CureCandidateStage;
  targetCurabilityLevel: 'C5';
  clinicalActionAllowed: false;
  confirmedCure: false;
  externalValidationRequired: true;
}

function required(value: string, code: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function validateEvidence(evidence: EvidenceBoundaryInput): void {
  if (evidence.evidenceType === 'VALIDATED') {
    if (!evidence.sourceIdentifier.trim() || !evidence.confirmedAt || !evidence.provenanceKind) {
      throw new Error('cure_candidate_validated_evidence_requires_provenance');
    }
    return;
  }

  if (evidence.evidenceType === 'HYPOTHESIS' && !evidence.hypothesisId.trim()) {
    throw new Error('cure_candidate_hypothesis_reference_required');
  }

  if (evidence.evidenceType === 'SIMULATION' && (
    !evidence.simulationId.trim() ||
    evidence.watermark !== 'SIMULATION — NOT CLINICAL EVIDENCE'
  )) {
    throw new Error('cure_candidate_simulation_boundary_required');
  }
}

export function integratePossibleCureCandidate(input: CureCandidateInput): CureCandidateRecord {
  validateEvidence(input.evidence);

  const candidateKey = required(input.candidateKey, 'cure_candidate_key_required');
  const diseaseKey = required(input.diseaseKey, 'cure_candidate_disease_required');
  const title = required(input.title, 'cure_candidate_title_required');
  const researchSummary = required(input.researchSummary, 'cure_candidate_summary_required');
  const sourceReference = required(input.sourceReference, 'cure_candidate_source_reference_required');

  return {
    candidateKey,
    diseaseKey,
    title,
    researchSummary,
    sourceReference,
    sourceEvidenceType: input.evidence.evidenceType,
    researchLabel: POSSIBLE_CURE_RESEARCH_LABEL,
    stage: input.evidence.evidenceType === 'VALIDATED'
      ? 'HUMAN_REVIEW_REQUIRED'
      : 'RESEARCH_CANDIDATE',
    targetCurabilityLevel: 'C5',
    clinicalActionAllowed: false,
    confirmedCure: false,
    externalValidationRequired: true
  };
}
