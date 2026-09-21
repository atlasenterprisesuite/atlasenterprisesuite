import type { ComplianceRequirement } from '../compliance/types';

export type RideReadinessState = 'eligible' | 'warning' | 'blocked' | 'unknown';

export type RideReadiness = {
  state: RideReadinessState;
  eligibleForNewTrips: boolean;
  blockingRequirementIds: string[];
  warningRequirementIds: string[];
  satisfiedRequirementIds: string[];
  evaluatedRequirementCount: number;
};

function satisfied(status: ComplianceRequirement['status']) {
  return status === 'approved' || status === 'waived';
}

export function calculateRideReadiness(requirements: ComplianceRequirement[]): RideReadiness {
  if (requirements.length === 0) {
    return {
      state: 'unknown',
      eligibleForNewTrips: false,
      blockingRequirementIds: [],
      warningRequirementIds: [],
      satisfiedRequirementIds: [],
      evaluatedRequirementCount: 0
    };
  }

  const blockingRequirementIds: string[] = [];
  const warningRequirementIds: string[] = [];
  const satisfiedRequirementIds: string[] = [];

  for (const requirement of requirements) {
    if (satisfied(requirement.status)) {
      satisfiedRequirementIds.push(requirement.id);
      continue;
    }

    if (requirement.status === 'expired' || requirement.eligibilityEffect === 'block_new_activity') {
      blockingRequirementIds.push(requirement.id);
      continue;
    }

    if (requirement.eligibilityEffect === 'warning') warningRequirementIds.push(requirement.id);
  }

  if (blockingRequirementIds.length > 0) {
    return {
      state: 'blocked',
      eligibleForNewTrips: false,
      blockingRequirementIds,
      warningRequirementIds,
      satisfiedRequirementIds,
      evaluatedRequirementCount: requirements.length
    };
  }

  if (warningRequirementIds.length > 0) {
    return {
      state: 'warning',
      eligibleForNewTrips: true,
      blockingRequirementIds,
      warningRequirementIds,
      satisfiedRequirementIds,
      evaluatedRequirementCount: requirements.length
    };
  }

  const unresolved = requirements.some((requirement) => !satisfied(requirement.status));
  return {
    state: unresolved ? 'unknown' : 'eligible',
    eligibleForNewTrips: !unresolved,
    blockingRequirementIds,
    warningRequirementIds,
    satisfiedRequirementIds,
    evaluatedRequirementCount: requirements.length
  };
}
