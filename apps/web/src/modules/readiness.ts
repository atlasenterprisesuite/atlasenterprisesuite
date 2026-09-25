export type AtlasProductionReadiness = 'production-verified' | 'pending-gate' | 'blocked';

export type AtlasReadinessGateStatus =
  | 'pending'
  | 'running'
  | 'passed'
  | 'failed'
  | 'blocked'
  | 'waived'
  | 'expired';

export type AtlasReadinessGateEvidence = {
  key: string;
  required: boolean;
  status: AtlasReadinessGateStatus;
  evidenceRef?: string | null;
  verifiedAt?: string | null;
  environment?: string | null;
  expectedSha?: string | null;
  deployedSha?: string | null;
  provider?: string | null;
  failureReason?: string | null;
};

export type AtlasProductionReadinessResult = {
  status: AtlasProductionReadiness;
  label: 'Production Verified' | 'Pending Gate' | 'Blocked';
  reasons: readonly string[];
};

const SATISFIED = new Set<AtlasReadinessGateStatus>(['passed', 'waived']);
const HARD_FAILURE = new Set<AtlasReadinessGateStatus>(['failed', 'blocked', 'expired']);

function normalize(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function deriveProductionReadiness(input: {
  gates: readonly AtlasReadinessGateEvidence[];
  requiredGateKeys?: readonly string[];
  expectedSha?: string | null;
  deployedSha?: string | null;
  requireExactSha?: boolean;
}): AtlasProductionReadinessResult {
  const requiredGateKeys = Array.from(new Set(input.requiredGateKeys ?? []));
  const byKey = new Map(input.gates.map((gate) => [gate.key, gate]));
  const requiredGates = requiredGateKeys.length
    ? requiredGateKeys.map((key) => byKey.get(key)).filter((gate): gate is AtlasReadinessGateEvidence => Boolean(gate))
    : input.gates.filter((gate) => gate.required);

  const missingGateKeys = requiredGateKeys.filter((key) => !byKey.has(key));
  const failedGates = requiredGates.filter((gate) => HARD_FAILURE.has(gate.status));
  const pendingGates = requiredGates.filter((gate) => !HARD_FAILURE.has(gate.status) && !SATISFIED.has(gate.status));

  const expectedSha = normalize(input.expectedSha);
  const deployedSha = normalize(input.deployedSha);
  const requireExactSha = input.requireExactSha !== false;

  if (expectedSha && deployedSha && expectedSha !== deployedSha) {
    return {
      status: 'blocked',
      label: 'Blocked',
      reasons: ['exact_runtime_sha_mismatch']
    };
  }

  if (failedGates.length) {
    return {
      status: 'blocked',
      label: 'Blocked',
      reasons: failedGates.map((gate) => gate.failureReason || `gate_failed:${gate.key}`)
    };
  }

  const reasons: string[] = [];
  if (!requiredGates.length) reasons.push('mandatory_gate_evidence_missing');
  if (missingGateKeys.length) reasons.push(...missingGateKeys.map((key) => `gate_missing:${key}`));
  if (pendingGates.length) reasons.push(...pendingGates.map((gate) => `gate_pending:${gate.key}`));
  if (requireExactSha && !expectedSha) reasons.push('expected_sha_missing');
  if (requireExactSha && !deployedSha) reasons.push('deployed_sha_missing');

  if (reasons.length) {
    return {
      status: 'pending-gate',
      label: 'Pending Gate',
      reasons
    };
  }

  return {
    status: 'production-verified',
    label: 'Production Verified',
    reasons: []
  };
}
