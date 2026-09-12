import { describe, expect, it } from 'vitest';
import type { AtlasWorkflow, AtlasWorkflowStep, ExecutionStore } from '../../packages/execution/src/index';
import { resumeWorkflow, summarizeRecoveryState } from '../../packages/execution/src/index';

const baseWorkflow: AtlasWorkflow = {
  taskId: 'task-1', workflowType: 'demo', module: 'core', tenantId: 'tenant-1', organizationId: 'org-1', ownerId: 'user-1',
  status: 'next', priority: 'normal', currentStep: null, nextAction: 'Continue', dependencies: [], blockedReason: null,
  permissionsRequired: [], evidenceIds: [], traceId: 'trace-1', createdAt: '2026-09-12T00:00:00Z', updatedAt: '2026-09-12T00:00:00Z', completedAt: null
};

function step(stepId: string, status: AtlasWorkflowStep['status'], nextAction: string | null = null): AtlasWorkflowStep {
  return {
    stepId, taskId: 'task-1', module: 'core', actionType: 'demo', executionClass: 'prepare', status, dependencies: [], permissionsRequired: [],
    retryPolicy: { maxAttempts: 1, backoffMs: 0 }, timeoutMs: 30000, idempotencyKey: null, inputRefs: [], resultRefs: [], evidenceRequirements: [],
    blockedReason: null, nextAction, createdAt: '2026-09-12T00:00:00Z', updatedAt: '2026-09-12T00:00:00Z'
  };
}

describe('workflow recovery', () => {
  it('prioritizes awaiting approval over next work', () => {
    const summary = summarizeRecoveryState(baseWorkflow, [step('ready-step', 'ready'), step('approval-step', 'awaiting_approval', 'Review approval')]);
    expect(summary.status).toBe('awaiting_approval');
    expect(summary.currentStep).toBe('approval-step');
    expect(summary.nextAction).toBe('Review approval');
  });

  it('preserves a workflow blocker and concrete next action', () => {
    const summary = summarizeRecoveryState({ ...baseWorkflow, status: 'blocked', blockedReason: 'provider_unavailable', nextAction: 'Retry provider probe' }, []);
    expect(summary.blockedReason).toBe('provider_unavailable');
    expect(summary.nextAction).toBe('Retry provider probe');
  });

  it('loads canonical state from the store when resuming', async () => {
    const store: ExecutionStore = {
      async getWorkflow() { return baseWorkflow; },
      async saveWorkflow() {},
      async listSteps() { return [step('approval-step', 'awaiting_approval', 'Approve or deny')]; },
      async appendEvent() {}
    };
    const resumed = await resumeWorkflow(store, { organizationId: 'org-1', taskId: 'task-1' });
    expect(resumed?.status).toBe('awaiting_approval');
    expect(resumed?.nextAction).toBe('Approve or deny');
  });
});
