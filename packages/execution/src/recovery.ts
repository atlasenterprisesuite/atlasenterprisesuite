import type { AtlasWorkflow, AtlasWorkflowStatus, AtlasWorkflowStep } from './types';
import type { ExecutionScope, ExecutionStore } from './store';

export type RecoverySummary = {
  status: AtlasWorkflowStatus;
  currentStep: string | null;
  blockedReason: string | null;
  nextAction: string;
};

const terminalStatuses = new Set<AtlasWorkflowStatus>(['completed', 'failed', 'cancelled']);

function defaultNextAction(status: AtlasWorkflowStatus, blockedReason: string | null): string {
  switch (status) {
    case 'awaiting_approval': return 'Review pending approval';
    case 'blocked': return blockedReason ? `Resolve blocker: ${blockedReason}` : 'Resolve workflow blocker';
    case 'now': return 'Continue current step';
    case 'next': return 'Start next step';
    case 'failed': return 'Review failure';
    case 'cancelled': return 'No further action';
    case 'completed': return 'No further action';
  }
}

function firstByStatus(steps: readonly AtlasWorkflowStep[], status: AtlasWorkflowStep['status']) {
  return steps.find((step) => step.status === status) ?? null;
}

export function summarizeRecoveryState(
  workflow: AtlasWorkflow,
  steps: readonly AtlasWorkflowStep[]
): RecoverySummary {
  if (terminalStatuses.has(workflow.status)) {
    return {
      status: workflow.status,
      currentStep: workflow.currentStep,
      blockedReason: workflow.blockedReason,
      nextAction: workflow.nextAction ?? defaultNextAction(workflow.status, workflow.blockedReason)
    };
  }

  const awaiting = firstByStatus(steps, 'awaiting_approval');
  const blocked = firstByStatus(steps, 'blocked');
  const running = firstByStatus(steps, 'running');
  const next = firstByStatus(steps, 'ready') ?? firstByStatus(steps, 'pending');

  let status: AtlasWorkflowStatus = workflow.status;
  let selected: AtlasWorkflowStep | null = null;

  if (awaiting) {
    status = 'awaiting_approval';
    selected = awaiting;
  } else if (workflow.status === 'blocked' || blocked) {
    status = 'blocked';
    selected = blocked;
  } else if (running) {
    status = 'now';
    selected = running;
  } else if (next) {
    status = 'next';
    selected = next;
  }

  const blockedReason = selected?.blockedReason ?? workflow.blockedReason;
  const nextAction = selected?.nextAction ?? workflow.nextAction ?? defaultNextAction(status, blockedReason);

  return {
    status,
    currentStep: selected?.stepId ?? workflow.currentStep,
    blockedReason,
    nextAction
  };
}

export async function resumeWorkflow(
  store: ExecutionStore,
  scope: ExecutionScope
): Promise<AtlasWorkflow | null> {
  const workflow = await store.getWorkflow(scope);
  if (!workflow) return null;
  const steps = await store.listSteps(scope);
  const summary = summarizeRecoveryState(workflow, steps);
  return {
    ...workflow,
    status: summary.status,
    currentStep: summary.currentStep,
    blockedReason: summary.blockedReason,
    nextAction: summary.nextAction
  };
}
