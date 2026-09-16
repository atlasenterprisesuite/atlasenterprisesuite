export type HospitalityRequestState =
  | 'new'
  | 'queued'
  | 'assigned'
  | 'accepted'
  | 'in_progress'
  | 'waiting'
  | 'blocked'
  | 'escalated'
  | 'completed'
  | 'verified'
  | 'cancelled'
  | 'failed';

const REQUEST_TRANSITIONS: Record<HospitalityRequestState, readonly HospitalityRequestState[]> = {
  new: ['queued', 'assigned', 'cancelled', 'failed'],
  queued: ['assigned', 'cancelled', 'failed'],
  assigned: ['accepted', 'queued', 'escalated', 'cancelled', 'failed'],
  accepted: ['in_progress', 'waiting', 'blocked', 'escalated', 'cancelled', 'failed'],
  in_progress: ['waiting', 'blocked', 'escalated', 'completed', 'cancelled', 'failed'],
  waiting: ['in_progress', 'blocked', 'escalated', 'cancelled', 'failed'],
  blocked: ['in_progress', 'waiting', 'escalated', 'cancelled', 'failed'],
  escalated: ['assigned', 'accepted', 'in_progress', 'waiting', 'blocked', 'completed', 'cancelled', 'failed'],
  completed: ['verified', 'in_progress'],
  verified: [],
  cancelled: [],
  failed: ['queued', 'cancelled']
};

export function transitionHospitalityRequest(
  current: HospitalityRequestState,
  next: HospitalityRequestState
): HospitalityRequestState {
  if (!REQUEST_TRANSITIONS[current]?.includes(next)) throw new Error('invalid_request_transition');
  return next;
}

export type HospitalityDispatchStrategy = 'manual' | 'round_robin' | 'least_loaded' | 'zone_based' | 'skill_based' | 'rule_based';

export type HospitalityDispatchCandidate = {
  userId: string;
  propertyId: string;
  departmentId: string;
  active: boolean;
  available: boolean;
  openAssignments: number;
  zone?: string | null;
  skills?: readonly string[];
};

export type HospitalityDispatchInput = {
  strategy: HospitalityDispatchStrategy;
  propertyId: string;
  departmentId: string;
  candidates: readonly HospitalityDispatchCandidate[];
  requestedUserId?: string | null;
  zone?: string | null;
  requiredSkill?: string | null;
};

export type HospitalityDispatchDecision =
  | { status: 'assigned'; userId: string }
  | { status: 'unassigned'; reason: 'no_eligible_candidate' | 'manual_assignment_required' };

export function selectDispatchCandidate(input: HospitalityDispatchInput): HospitalityDispatchDecision {
  let eligible = input.candidates.filter((candidate) =>
    candidate.active &&
    candidate.available &&
    candidate.propertyId === input.propertyId &&
    candidate.departmentId === input.departmentId
  );

  if (input.zone) eligible = eligible.filter((candidate) => candidate.zone === input.zone);
  if (input.requiredSkill) eligible = eligible.filter((candidate) => candidate.skills?.includes(input.requiredSkill!));

  if (input.strategy === 'manual') {
    if (!input.requestedUserId) return { status: 'unassigned', reason: 'manual_assignment_required' };
    const chosen = eligible.find((candidate) => candidate.userId === input.requestedUserId);
    return chosen ? { status: 'assigned', userId: chosen.userId } : { status: 'unassigned', reason: 'no_eligible_candidate' };
  }

  if (eligible.length === 0) return { status: 'unassigned', reason: 'no_eligible_candidate' };

  if (input.strategy === 'least_loaded') {
    const chosen = [...eligible].sort((a, b) => a.openAssignments - b.openAssignments || a.userId.localeCompare(b.userId))[0];
    return { status: 'assigned', userId: chosen.userId };
  }

  // Other strategies remain deterministic and fail within the already-authorized candidate set.
  const chosen = [...eligible].sort((a, b) => a.userId.localeCompare(b.userId))[0];
  return { status: 'assigned', userId: chosen.userId };
}
