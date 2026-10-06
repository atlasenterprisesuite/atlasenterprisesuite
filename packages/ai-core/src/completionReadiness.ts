import type { AtlasTask } from '../../task-protocol/src';

export type CompletionReadinessReason =
  | 'missing_test_evidence'
  | 'failed_test'
  | 'approval_not_satisfied'
  | 'deployment_not_verified';

export interface CompletionReadiness {
  taskId: string;
  state: AtlasTask['state'];
  readyToComplete: boolean;
  reasons: CompletionReadinessReason[];
}

export function evaluateCompletionReadiness(task: AtlasTask): CompletionReadiness {
  const reasons: CompletionReadinessReason[] = [];

  if (task.tests.length === 0 || task.tests.some((test) => !test.evidence || !test.evidence.trim())) {
    reasons.push('missing_test_evidence');
  }
  if (task.tests.some((test) => test.status !== 'passed')) {
    reasons.push('failed_test');
  }
  if (task.approvals.length === 0 || task.approvals.some((approval) => approval.result !== 'approved')) {
    reasons.push('approval_not_satisfied');
  }
  if (!task.deployment || task.deployment.status !== 'verified') {
    reasons.push('deployment_not_verified');
  }

  return {
    taskId: task.taskId,
    state: task.state,
    readyToComplete: reasons.length === 0,
    reasons
  };
}

export function assertCompletionEvidence(task: AtlasTask): void {
  const readiness = evaluateCompletionReadiness(task);
  if (!readiness.readyToComplete) {
    throw new Error(`ATLAS completion evidence incomplete: ${readiness.reasons.join(',')}`);
  }
}
