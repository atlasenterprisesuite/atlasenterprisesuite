import type { GuidedExecutionState, GuidedStep, GuidedTask } from './types';

export type GuidedTaskGroup = {
  module: string;
  tasks: GuidedTask[];
};

export type StepAction =
  | { kind: 'execute'; label: 'Execute step'; executable: true }
  | { kind: 'resume'; label: 'Resume step'; executable: true }
  | { kind: 'refresh'; label: 'Refresh state'; executable: true }
  | { kind: 'request_approval'; label: 'Request approval'; executable: true }
  | { kind: 'review_approval'; label: 'Review approval'; executable: true }
  | { kind: 'view_evidence'; label: 'View evidence'; executable: true }
  | { kind: 'blocked'; label: 'Resolve blocker'; executable: false }
  | { kind: 'done'; label: 'Done'; executable: false }
  | { kind: 'unavailable'; label: 'Action unavailable'; executable: false };

export function groupTasks(state: GuidedExecutionState): GuidedTaskGroup[] {
  const byModule = new Map<string, GuidedTask[]>();
  for (const task of state.tasks) {
    const current = byModule.get(task.module) ?? [];
    current.push(task);
    byModule.set(task.module, current);
  }
  return [...byModule.entries()].map(([module, tasks]) => ({ module, tasks }));
}

export function workflowProgress(state: GuidedExecutionState) {
  const relevant = state.steps.filter((step) => step.status !== 'cancelled');
  const completed = relevant.filter((step) => step.status === 'completed').length;
  return {
    completed,
    total: relevant.length,
    percent: relevant.length === 0 ? 0 : Math.floor((completed / relevant.length) * 100)
  };
}

export function activeTask(state: GuidedExecutionState): GuidedTask | null {
  return state.tasks.find((task) => task.id === state.workflow.currentTaskId)
    ?? state.tasks.find((task) => !['completed', 'cancelled', 'discarded'].includes(task.status))
    ?? state.tasks[0]
    ?? null;
}

export function activeStep(state: GuidedExecutionState): GuidedStep | null {
  const task = activeTask(state);
  if (!task) return null;
  return state.steps.find((step) => step.id === task.currentStepId)
    ?? state.steps.filter((step) => step.taskId === task.id).sort((a, b) => a.sequence - b.sequence)
      .find((step) => !['completed', 'cancelled'].includes(step.status))
    ?? null;
}

export function stepBlockers(state: GuidedExecutionState, stepId: string): string[] {
  const step = state.steps.find((item) => item.id === stepId);
  if (!step) return ['step_not_found'];
  const task = state.tasks.find((item) => item.id === step.taskId);
  const blockers: string[] = [];

  if (task?.blockedReason) blockers.push(task.blockedReason);
  for (const dependency of state.dependencies) {
    if (dependency.resolvedAt) continue;
    if (dependency.stepId === stepId || (!dependency.stepId && dependency.taskId === step.taskId)) {
      if (dependency.dependsOnStepId) blockers.push(`Waiting for step ${dependency.dependsOnStepId}`);
      else if (dependency.dependsOnTaskId) blockers.push(`Waiting for task ${dependency.dependsOnTaskId}`);
      else blockers.push(`Dependency ${dependency.id} is unresolved`);
    }
  }
  if (step.status === 'failed') blockers.push('The last execution attempt failed.');
  return [...new Set(blockers)];
}

function pendingApprovalFor(state: GuidedExecutionState, step: GuidedStep) {
  return state.approvals.find((approval) => approval.taskId === step.taskId && approval.status === 'pending') ?? null;
}

function hasEvidenceFor(state: GuidedExecutionState, step: GuidedStep) {
  return state.evidence.some((evidence) => evidence.taskId === step.taskId && (evidence.stepId === step.id || evidence.stepId === null));
}

function approvalRequired(step: GuidedStep) {
  return step.status === 'awaiting_approval' || step.permissionsRequired.includes('execution.approve');
}

export function deriveStepAction(state: GuidedExecutionState, stepId: string): StepAction {
  const step = state.steps.find((item) => item.id === stepId);
  if (!step) return { kind: 'unavailable', label: 'Action unavailable', executable: false };

  if (state.workflow.status === 'completed') return { kind: 'done', label: 'Done', executable: false };
  const pilot = state.workflow.workflowType === 'manager.openai_domain_verification';
  const pendingApproval = pendingApprovalFor(state, step);
  if (pendingApproval) return { kind: 'review_approval', label: 'Review approval', executable: true };
  if (approvalRequired(step)) return { kind: 'request_approval', label: 'Request approval', executable: true };

  if (pilot) {
    if (step.status === 'ready') return { kind: 'execute', label: 'Execute step', executable: true };
    if (['running', 'blocked', 'failed'].includes(step.status)) return { kind: 'resume', label: 'Resume step', executable: true };
  }

  if (step.status === 'blocked' || step.status === 'failed' || stepBlockers(state, stepId).length > 0) {
    return { kind: 'blocked', label: 'Resolve blocker', executable: false };
  }
  if (step.status === 'completed' && hasEvidenceFor(state, step)) return { kind: 'view_evidence', label: 'View evidence', executable: true };
  if (step.status === 'completed') return { kind: 'done', label: 'Done', executable: false };
  if (step.status === 'ready' || step.status === 'running') return { kind: 'refresh', label: 'Refresh state', executable: true };
  return { kind: 'unavailable', label: 'Action unavailable', executable: false };
}
