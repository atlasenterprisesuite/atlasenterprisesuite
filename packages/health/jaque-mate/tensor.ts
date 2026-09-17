import {
  JAQUE_MATE_SENTINEL_MODULE_ID,
  type EvidenceBoundaryInput,
  type TensorEvaluation,
  type TensorInput
} from './types';

const clampResearchDimension = (value: number): number => Math.min(100, Math.max(0, value));

function validateEvidenceBoundary(evidence: EvidenceBoundaryInput): void {
  if (evidence.evidenceType === 'VALIDATED') {
    const confirmedAt = Date.parse(evidence.confirmedAt);
    if (!evidence.sourceIdentifier.trim() || !Number.isFinite(confirmedAt) || !evidence.provenanceKind) {
      throw new Error('validated_evidence_requires_provenance');
    }
    return;
  }

  if (evidence.evidenceType === 'HYPOTHESIS') {
    if (!evidence.hypothesisId.trim() || !evidence.authoredBy.trim()) {
      throw new Error('hypothesis_metadata_required');
    }
    return;
  }

  if (!evidence.simulationId.trim() || evidence.watermark !== 'SIMULATION — NOT CLINICAL EVIDENCE') {
    throw new Error('simulation_watermark_required');
  }
}

export function evaluateTensor(input: TensorInput): TensorEvaluation {
  validateEvidenceBoundary(input.evidence);

  const dimensions = {
    seed: clampResearchDimension(input.seed),
    state: clampResearchDimension(input.state),
    niche: clampResearchDimension(input.niche),
    time: clampResearchDimension(input.time)
  };

  const rawScore = (dimensions.seed + dimensions.state + dimensions.niche + dimensions.time) / 4;
  const researchScore = Math.round(rawScore * 100) / 100;

  return {
    dimensions,
    researchScore,
    evidenceType: input.evidence.evidenceType,
    clinicalActionAllowed: false,
    moduleId: JAQUE_MATE_SENTINEL_MODULE_ID
  };
}
