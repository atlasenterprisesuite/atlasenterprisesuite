export type ResponseGateState = 'BLOCKED' | 'REVIEW_REQUIRED' | 'ELIGIBLE_FOR_HUMAN_REVIEW';

export interface ResponseGateInput {
  confidence: number;
  validatedEvidenceCount: number;
  threshold: number;
}

export interface ResponseGateResult {
  state: ResponseGateState;
  clinicalActionAllowed: false;
  reason: 'validated_evidence_required' | 'confidence_below_threshold' | 'human_review_required';
}

export function evaluateResponseGate(input: ResponseGateInput): ResponseGateResult {
  const { confidence, validatedEvidenceCount, threshold } = input;
  if (![confidence, threshold].every(Number.isFinite) || threshold < 0 || threshold > 1 || confidence < 0 || confidence > 1) {
    throw new Error('response_gate_invalid_input');
  }

  if (!Number.isInteger(validatedEvidenceCount) || validatedEvidenceCount <= 0) {
    return {
      state: 'BLOCKED',
      clinicalActionAllowed: false,
      reason: 'validated_evidence_required'
    };
  }

  if (confidence < threshold) {
    return {
      state: 'BLOCKED',
      clinicalActionAllowed: false,
      reason: 'confidence_below_threshold'
    };
  }

  return {
    state: 'ELIGIBLE_FOR_HUMAN_REVIEW',
    clinicalActionAllowed: false,
    reason: 'human_review_required'
  };
}
