/**
 * ATLAS Protective Wear research dossier.
 * This is a concept-selection UI model; it is not a certification registry or PPE approval service.
 */
export type WearThreat = 'abrasion-cut' | 'stab' | 'ballistic';
export type WearUseCase = 'courier' | 'night-operations' | 'general-mobility';
export type WearProof = {
  threat: WearThreat;
  panelModelId: string;
  supplier: string;
  standardId: string;
  officialRegistryUrl: string;
  verifiedConfigurationId: string;
  reviewedBy: string;
  reviewedAt: string;
  reviewStatus: 'independently-reviewed' | 'supplier-only' | 'pending';
};

export const WEAR_STANDARDS: Readonly<Record<WearThreat, string | null>> = {
  'abrasion-cut': null,
  stab: 'NIJ 0115.00',
  ballistic: 'NIJ 0101.07'
};

export const PROTECTIVE_WEAR_CONCEPTS: Readonly<Record<WearUseCase, {
  label: string;
  primaryGoal: string;
  designPriorities: readonly string[];
  targetThreats: readonly WearThreat[];
}>> = {
  courier: {
    label: 'ATLAS Courier Shell',
    primaryGoal: 'Comfort and visibility for walking, cycling and building deliveries.',
    designPriorities: ['Breathability', 'Unrestricted arm movement', 'Reflective accents', 'Removable protection carrier'],
    targetThreats: ['abrasion-cut', 'stab']
  },
  'night-operations': {
    label: 'ATLAS Night Shift',
    primaryGoal: 'Visible, accessible and configurable protective workwear for night operations.',
    designPriorities: ['Reflective visibility', 'Emergency access', 'Weather resistance', 'Easy donning and removal'],
    targetThreats: ['abrasion-cut', 'stab', 'ballistic']
  },
  'general-mobility': {
    label: 'ATLAS Everyday Mobility',
    primaryGoal: 'Discreet, ergonomic carrier concept for independently tested components.',
    designPriorities: ['Low-profile fit', 'Size-inclusive design', 'Removable insert pockets', 'Care and traceability labels'],
    targetThreats: ['stab', 'ballistic']
  }
};

export type WearAssessment = {
  state: 'blocked' | 'documentation-review';
  reason: 'component_evidence_missing' | 'standard_mismatch' | 'source_unverified' | 'configuration_missing' | 'independent_review_required';
  mayAdvertiseProtectivePerformance: false;
};

/**
 * A document can support a review, never prove final-garment performance.
 * No client-side evidence produces a "certified" state. Final approval requires an
 * independently verified, configuration-specific evidence and product governance workflow.
 */
export function assessWearComponent(threat: WearThreat, proofs: readonly WearProof[]): WearAssessment {
  const evidence = proofs.find((item) => item.threat === threat);
  const blocked = (reason: WearAssessment['reason']): WearAssessment =>
    ({ state: 'blocked', reason, mayAdvertiseProtectivePerformance: false });
  if (!evidence) return blocked('component_evidence_missing');
  if (threat === 'abrasion-cut') return blocked('independent_review_required');
  if (evidence.standardId !== WEAR_STANDARDS[threat]) return blocked('standard_mismatch');
  if (!evidence.panelModelId.trim() || !evidence.verifiedConfigurationId.trim()) return blocked('configuration_missing');
  if (!/^https:\/\//.test(evidence.officialRegistryUrl) ||
      !evidence.officialRegistryUrl.startsWith('https://nij.ojp.gov/')) return blocked('source_unverified');
  if (evidence.reviewStatus !== 'independently-reviewed' || !evidence.reviewedBy.trim() ||
      !Number.isFinite(Date.parse(evidence.reviewedAt))) return blocked('independent_review_required');
  return { state: 'documentation-review', reason: 'independent_review_required', mayAdvertiseProtectivePerformance: false };
}
