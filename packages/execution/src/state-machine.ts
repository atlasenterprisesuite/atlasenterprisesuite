import type { ApprovalStatus, ExecutionStatus, StepStatus } from './types';

const transitions: Record<ExecutionStatus, readonly ExecutionStatus[]> = {
  draft: ['now', 'next', 'delegated', 'automatable', 'discarded', 'cancelled'],
  now: ['next', 'blocked', 'awaiting_approval', 'failed', 'completed', 'cancelled'],
  next: ['now', 'blocked', 'awaiting_approval', 'cancelled'],
  blocked: ['now', 'next', 'awaiting_approval', 'cancelled'],
  awaiting_approval: ['now', 'blocked', 'discarded', 'cancelled'],
  completed: [],
  delegated: ['now', 'blocked', 'completed', 'cancelled'],
  automatable: ['now', 'blocked', 'awaiting_approval', 'failed', 'completed', 'cancelled'],
  discarded: [],
  failed: ['now', 'blocked', 'cancelled'],
  cancelled: []
};

export function canTransitionTask(from: ExecutionStatus, to: ExecutionStatus) {
  return transitions[from].includes(to);
}

export function assertTaskTransition(from: ExecutionStatus, to: ExecutionStatus) {
  if (!canTransitionTask(from, to)) {
    throw new Error(`invalid_execution_transition:${from}->${to}`);
  }
}

export function evaluateTaskCompletion(input: {
  steps: Array<{ id: string; status: StepStatus; evidenceRequirement: string[] }>;
  evidence: Array<{ id: string; kind: string; verified: boolean }>;
  approvals: Array<{ status: ApprovalStatus; payloadVersion: number; payloadDigest: string }>;
  unresolvedDependencies: string[];
}) {
  const reasons: string[] = [];

  for (const step of input.steps) {
    if (step.status !== 'completed' && step.status !== 'cancelled') {
      reasons.push(`incomplete_step:${step.id}`);
    }
    for (const kind of step.evidenceRequirement) {
      const match = input.evidence.find((item) => item.kind === kind);
      if (!match) reasons.push(`missing_evidence:${kind}`);
      else if (!match.verified) reasons.push(`unverified_evidence:${kind}`);
    }
  }

  if (input.approvals.some((approval) => approval.status !== 'approved')) {
    reasons.push('approval_not_satisfied');
  }
  for (const dependency of input.unresolvedDependencies) {
    reasons.push(`unresolved_dependency:${dependency}`);
  }

  return { eligible: reasons.length === 0, reasons };
}
