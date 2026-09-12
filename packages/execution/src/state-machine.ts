import type { AtlasWorkflowStatus, CompletionEvidenceState } from './types';

export type AtlasWorkflowTransitionEvent =
  | 'queue'
  | 'start'
  | 'block'
  | 'request_approval'
  | 'approval_granted'
  | 'approval_denied'
  | 'complete'
  | 'fail'
  | 'cancel'
  | 'resume';

const transitions: Record<AtlasWorkflowStatus, Partial<Record<AtlasWorkflowTransitionEvent, AtlasWorkflowStatus>>> = {
  now: {
    queue: 'next',
    block: 'blocked',
    request_approval: 'awaiting_approval',
    complete: 'completed',
    fail: 'failed',
    cancel: 'cancelled'
  },
  next: {
    start: 'now',
    block: 'blocked',
    request_approval: 'awaiting_approval',
    fail: 'failed',
    cancel: 'cancelled'
  },
  blocked: {
    resume: 'next',
    request_approval: 'awaiting_approval',
    fail: 'failed',
    cancel: 'cancelled'
  },
  awaiting_approval: {
    approval_granted: 'now',
    approval_denied: 'blocked',
    fail: 'failed',
    cancel: 'cancelled'
  },
  failed: {
    resume: 'next',
    cancel: 'cancelled'
  },
  completed: {},
  cancelled: {}
};

export function transitionWorkflow(
  current: AtlasWorkflowStatus,
  event: AtlasWorkflowTransitionEvent
): AtlasWorkflowStatus {
  const next = transitions[current][event];
  if (!next) throw new Error('invalid_transition');
  return next;
}

export function canCompleteWorkflow(state: CompletionEvidenceState): boolean {
  const verified = new Set(state.verifiedEvidenceIds);
  return state.requiredEvidenceIds.every((evidenceId) => verified.has(evidenceId));
}
