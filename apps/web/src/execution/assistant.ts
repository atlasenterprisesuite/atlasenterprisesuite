import type { GuidedExecutionState } from './types';
import { activeStep, activeTask, stepBlockers } from './view-model';

const CONTINUE = new Set(['continue', 'continua', 'continuar', 'resume', 'reanudar']);
const NEXT = new Set(['what is next', "what's next", 'que sigue', 'qué sigue']);
const STOPPED = new Set(['where did we stop', 'donde paramos', 'dónde paramos']);

export type ExecutionAssistantSnapshot = {
  workflowId: string;
  status: string;
  currentTaskId: string | null;
  currentStepId: string | null;
  currentTaskTitle: string | null;
  currentAction: string | null;
  nextAction: string | null;
  blockedReason: string | null;
  pendingApprovalId: string | null;
  verifiedEvidenceCount: number;
};

type AssistantBaseResult = {
  message: string;
  executesExternalAction: false;
};

export type ExecutionAssistantResult =
  | (AssistantBaseResult & { kind: 'show_approval'; approvalId: string | null; taskId: string | null; stepId: string | null })
  | (AssistantBaseResult & { kind: 'show_blocker'; stepId: string | null; reason: string })
  | (AssistantBaseResult & { kind: 'show_failure'; stepId: string | null })
  | (AssistantBaseResult & { kind: 'completed'; nextAction: null })
  | (AssistantBaseResult & { kind: 'focus_step'; stepId: string })
  | (AssistantBaseResult & { kind: 'show_next_action'; stepId: string | null; nextAction: string | null })
  | (AssistantBaseResult & {
      kind: 'stopped';
      taskId: string | null;
      stepId: string | null;
      currentTaskTitle: string | null;
      currentAction: string | null;
    })
  | (AssistantBaseResult & { kind: 'unsupported' });

export function buildExecutionAssistantSnapshot(state: GuidedExecutionState): ExecutionAssistantSnapshot {
  const task = activeTask(state);
  const step = activeStep(state);
  const pendingApproval = state.approvals.find((approval) => approval.status === 'pending' && (!task || approval.taskId === task.id))
    ?? state.approvals.find((approval) => approval.status === 'pending')
    ?? null;
  const blocker = task?.blockedReason
    ?? (step ? stepBlockers(state, step.id)[0] ?? null : null);

  return {
    workflowId: state.workflow.id,
    status: task?.status ?? state.workflow.status,
    currentTaskId: task?.id ?? null,
    currentStepId: step?.id ?? task?.currentStepId ?? null,
    currentTaskTitle: task?.title ?? null,
    currentAction: step?.actionType ?? null,
    nextAction: task?.nextAction ?? null,
    blockedReason: blocker,
    pendingApprovalId: pendingApproval?.id ?? null,
    verifiedEvidenceCount: state.evidence.filter((evidence) => evidence.verified).length
  };
}

function completedResult(): ExecutionAssistantResult {
  return {
    kind: 'completed',
    nextAction: null,
    message: 'This workflow is completed. There is no persisted next action.',
    executesExternalAction: false
  };
}

function continueResult(state: GuidedExecutionState): ExecutionAssistantResult {
  const task = activeTask(state);
  const step = activeStep(state);
  const pendingApproval = state.approvals.find((approval) => approval.status === 'pending' && (!task || approval.taskId === task.id))
    ?? state.approvals.find((approval) => approval.status === 'pending')
    ?? null;

  if (pendingApproval || task?.status === 'awaiting_approval') {
    return {
      kind: 'show_approval',
      approvalId: pendingApproval?.id ?? null,
      taskId: pendingApproval?.taskId ?? task?.id ?? null,
      stepId: task?.currentStepId ?? step?.id ?? null,
      message: pendingApproval
        ? `Approval ${pendingApproval.id} is pending before this workflow can continue.`
        : 'This task is awaiting approval before it can continue.',
      executesExternalAction: false
    };
  }

  if (task?.status === 'blocked' || task?.blockedReason || (step && step.status === 'blocked')) {
    const reason = task?.blockedReason
      ?? (step ? stepBlockers(state, step.id)[0] : null)
      ?? 'Execution is blocked.';
    return {
      kind: 'show_blocker',
      stepId: step?.id ?? task?.currentStepId ?? null,
      reason,
      message: `Execution is blocked: ${reason}`,
      executesExternalAction: false
    };
  }

  if (step?.status === 'failed' || task?.status === 'failed') {
    return {
      kind: 'show_failure',
      stepId: step?.id ?? task?.currentStepId ?? null,
      message: step ? `The persisted step ${step.actionType} failed.` : 'The current execution task failed.',
      executesExternalAction: false
    };
  }

  if (state.workflow.status === 'completed') return completedResult();

  if (step && (step.status === 'ready' || step.status === 'running')) {
    return {
      kind: 'focus_step',
      stepId: step.id,
      message: `Continue at the persisted current step: ${step.actionType}.`,
      executesExternalAction: false
    };
  }

  return {
    kind: 'show_next_action',
    stepId: step?.id ?? task?.currentStepId ?? null,
    nextAction: task?.nextAction ?? null,
    message: task?.nextAction ? `Next persisted action: ${task.nextAction}.` : 'No executable next action is persisted for this task.',
    executesExternalAction: false
  };
}

export function resolveExecutionAssistantCommand(command: string, state: GuidedExecutionState): ExecutionAssistantResult {
  const normalized = command.trim().toLowerCase();
  if (CONTINUE.has(normalized)) return continueResult(state);

  if (NEXT.has(normalized)) {
    if (state.workflow.status === 'completed') return completedResult();
    const task = activeTask(state);
    const step = activeStep(state);
    return {
      kind: 'show_next_action',
      stepId: step?.id ?? task?.currentStepId ?? null,
      nextAction: task?.nextAction ?? null,
      message: task?.nextAction ? `Next persisted action: ${task.nextAction}.` : 'No next action is persisted for the current task.',
      executesExternalAction: false
    };
  }

  if (STOPPED.has(normalized)) {
    const snapshot = buildExecutionAssistantSnapshot(state);
    return {
      kind: 'stopped',
      taskId: snapshot.currentTaskId,
      stepId: snapshot.currentStepId,
      currentTaskTitle: snapshot.currentTaskTitle,
      currentAction: snapshot.currentAction,
      message: snapshot.currentTaskTitle
        ? `We stopped at ${snapshot.currentTaskTitle}${snapshot.currentAction ? ` — ${snapshot.currentAction}` : ''}.`
        : 'This workflow has no persisted current task.',
      executesExternalAction: false
    };
  }

  return {
    kind: 'unsupported',
    message: 'This execution command is not supported in the current workflow.',
    executesExternalAction: false
  };
}
