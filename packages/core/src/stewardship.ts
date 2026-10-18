import type { TenantScope } from './scope';
import {
  authorize,
  type AtlasPermission,
  type AuthorizationContext
} from './permissions';

export type StewardshipAssurance = 'baseline' | 'verified' | 'elevated';
export type StewardshipRisk = 'R0' | 'R1' | 'R2' | 'R3';
export type StewardshipActorType =
  | 'human'
  | 'service'
  | 'agent'
  | 'automation'
  | 'provider';

export type StewardshipContext = {
  actorId: string;
  actorType: StewardshipActorType;
  purpose: string;
  assurance: StewardshipAssurance;
  evidenceRefs: readonly string[];
  correlationId: string;
};

export type StewardshipRequirement = {
  risk: StewardshipRisk;
  minimumAssurance: StewardshipAssurance;
  purpose?: string;
  evidenceRequired?: boolean;
  approvalRequired?: boolean;
  providerRequired?: boolean;
};

export type StewardshipRuntimeGates = {
  approvalGranted?: boolean;
  providerVerified?: boolean;
};

export type StewardshipDecisionReason =
  | 'allowed'
  | 'scope_mismatch'
  | 'permission_denied'
  | 'purpose_mismatch'
  | 'assurance_insufficient'
  | 'evidence_required'
  | 'approval_required'
  | 'provider_unverified';

export type StewardshipDecision = {
  allowed: boolean;
  reason: StewardshipDecisionReason;
  risk: StewardshipRisk;
  assurance: StewardshipAssurance;
  purpose: string;
  evidenceRefs: readonly string[];
  correlationId: string;
};

const ASSURANCE_ORDER: Record<StewardshipAssurance, number> = {
  baseline: 0,
  verified: 1,
  elevated: 2
};

const RISK_ASSURANCE_FLOOR: Record<StewardshipRisk, StewardshipAssurance> = {
  R0: 'baseline',
  R1: 'baseline',
  R2: 'verified',
  R3: 'elevated'
};

export function minimumAssuranceForRisk(
  risk: StewardshipRisk
): StewardshipAssurance {
  return RISK_ASSURANCE_FLOOR[risk];
}

function normalizeEvidenceRefs(values: readonly string[]): readonly string[] {
  return Object.freeze(
    [...new Set(values.map(value => String(value).trim()).filter(Boolean))]
  );
}

function stricterAssurance(
  left: StewardshipAssurance,
  right: StewardshipAssurance
): StewardshipAssurance {
  return ASSURANCE_ORDER[left] >= ASSURANCE_ORDER[right] ? left : right;
}

function decision(
  context: StewardshipContext,
  requirement: StewardshipRequirement,
  reason: StewardshipDecisionReason,
  evidenceRefs: readonly string[]
): StewardshipDecision {
  return Object.freeze({
    allowed: reason === 'allowed',
    reason,
    risk: requirement.risk,
    assurance: context.assurance,
    purpose: context.purpose.trim(),
    evidenceRefs,
    correlationId: context.correlationId.trim()
  });
}

export function evaluateStewardshipPolicy(
  context: StewardshipContext,
  requirement: StewardshipRequirement,
  gates: StewardshipRuntimeGates = {}
): StewardshipDecision {
  const evidenceRefs = normalizeEvidenceRefs(context.evidenceRefs ?? []);
  const actualPurpose = context.purpose.trim();
  const requiredPurpose = requirement.purpose?.trim();

  if (requiredPurpose && actualPurpose !== requiredPurpose) {
    return decision(context, requirement, 'purpose_mismatch', evidenceRefs);
  }

  const effectiveMinimum = stricterAssurance(
    minimumAssuranceForRisk(requirement.risk),
    requirement.minimumAssurance
  );
  if (ASSURANCE_ORDER[context.assurance] < ASSURANCE_ORDER[effectiveMinimum]) {
    return decision(context, requirement, 'assurance_insufficient', evidenceRefs);
  }

  if (requirement.evidenceRequired && evidenceRefs.length === 0) {
    return decision(context, requirement, 'evidence_required', evidenceRefs);
  }

  if (requirement.approvalRequired && gates.approvalGranted !== true) {
    return decision(context, requirement, 'approval_required', evidenceRefs);
  }

  if (requirement.providerRequired && gates.providerVerified !== true) {
    return decision(context, requirement, 'provider_unverified', evidenceRefs);
  }

  return decision(context, requirement, 'allowed', evidenceRefs);
}

export function authorizeGovernedAction(
  actor: AuthorizationContext,
  request: {
    scope: TenantScope;
    permission: AtlasPermission;
    stewardship: StewardshipRequirement;
  },
  context: StewardshipContext,
  gates: StewardshipRuntimeGates = {}
): StewardshipDecision {
  const canonical = authorize(actor, {
    scope: request.scope,
    permission: request.permission
  });

  if (!canonical.ok) {
    return decision(
      context,
      request.stewardship,
      canonical.reason,
      normalizeEvidenceRefs(context.evidenceRefs ?? [])
    );
  }

  return evaluateStewardshipPolicy(context, request.stewardship, gates);
}
