export type AtlasEvidenceVerificationState = 'unverified' | 'verified' | 'rejected';

export type AtlasEvidence = {
  evidenceId: string;
  organizationId: string;
  taskId: string;
  stepId: string | null;
  evidenceType: string;
  sourceType: string;
  sourceReference: string | null;
  verificationState: AtlasEvidenceVerificationState;
  immutableDigest: string | null;
  createdAt: string;
};

export function verifyEvidenceRequirements(
  requiredTypes: readonly string[],
  evidence: readonly AtlasEvidence[]
): boolean {
  if (requiredTypes.length === 0) return true;
  const verifiedTypes = new Set(
    evidence
      .filter((record) => record.verificationState === 'verified')
      .map((record) => record.evidenceType)
  );
  return requiredTypes.every((type) => verifiedTypes.has(type));
}

export function verifiedEvidenceIds(evidence: readonly AtlasEvidence[]): string[] {
  return evidence
    .filter((record) => record.verificationState === 'verified')
    .map((record) => record.evidenceId);
}
