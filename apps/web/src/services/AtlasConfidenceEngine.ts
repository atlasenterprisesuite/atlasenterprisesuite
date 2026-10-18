export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type ConfidenceEvaluation = {
  level: ConfidenceLevel;
  actionRecommended: boolean;
  requiresConfirmation: boolean;
};

export class AtlasConfidenceEngine {
  static evaluate(score: number): ConfidenceEvaluation {
    if (!Number.isFinite(score) || score < 0 || score > 1) {
      throw new RangeError('Confidence score must be between 0 and 1.');
    }

    if (score >= 0.98) {
      return {
        level: 'high',
        actionRecommended: true,
        requiresConfirmation: false
      };
    }

    if (score >= 0.74) {
      return {
        level: 'medium',
        actionRecommended: true,
        requiresConfirmation: true
      };
    }

    return {
      level: 'low',
      actionRecommended: false,
      requiresConfirmation: true
    };
  }
}
