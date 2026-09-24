export const JAQUE_MATE_SENTINEL_MODULE_ID = 'atlas.health.jaque-mate-sentinel.v1' as const;

export type EvidenceType = 'VALIDATED' | 'HYPOTHESIS' | 'SIMULATION';
export type ValidatedProvenanceKind = 'LAB' | 'HARDWARE' | 'REGISTRY';

export interface ValidatedEvidence {
  evidenceType: 'VALIDATED';
  sourceIdentifier: string;
  confirmedAt: string;
  provenanceKind: ValidatedProvenanceKind;
}

export interface SimulationHypothesis {
  evidenceType: 'HYPOTHESIS';
  hypothesisId: string;
  authoredBy: string;
}

export interface EducationalPayload {
  evidenceType: 'SIMULATION';
  simulationId: string;
  watermark: 'SIMULATION — NOT CLINICAL EVIDENCE';
}

export type EvidenceBoundaryInput = ValidatedEvidence | SimulationHypothesis | EducationalPayload;

export interface TensorDimensions {
  seed: number;
  state: number;
  niche: number;
  time: number;
}

export interface TensorInput extends TensorDimensions {
  evidence: EvidenceBoundaryInput;
}

export interface TensorEvaluation {
  dimensions: TensorDimensions;
  researchScore: number;
  evidenceType: EvidenceType;
  clinicalActionAllowed: false;
  moduleId: typeof JAQUE_MATE_SENTINEL_MODULE_ID;
}
