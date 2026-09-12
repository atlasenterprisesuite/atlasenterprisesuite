import { describe, expect, it } from 'vitest';
import type { AtlasWorkflow, AtlasWorkflowEvent, AtlasWorkflowStep, ExecutionStore } from '../../packages/execution/src/index';
import { appendWorkflowEvent } from '../../packages/execution/src/index';

function workflow(): AtlasWorkflow {
  return {
    taskId: 'task-1', workflowType: 'demo', module: 'core', tenantId: 'tenant-1', organizationId: 'org-1', ownerId: 'user-1',
    status: 'next', priority: 'normal', currentStep: null, nextAction: 'Continue', dependencies: [], blockedReason: null,
    permissionsRequired: [], evidenceIds: [], traceId: 'trace-1', createdAt: '2026-09-12T00:00:00Z', updatedAt: '2026-09-12T00:00:00Z', completedAt: null
  };
}

describe('execution store contract', () => {
  it('only appends workflow events through the store contract', async () => {
    const events: AtlasWorkflowEvent[] = [];
    const store: ExecutionStore = {
      async getWorkflow() { return workflow(); },
      async saveWorkflow() {},
      async listSteps() { return [] as AtlasWorkflowStep[]; },
      async appendEvent(event) { events.push(event); }
    };
    const event: AtlasWorkflowEvent = {
      eventId: 'event-1', taskId: 'task-1', stepId: null, organizationId: 'org-1', traceId: 'trace-1',
      eventType: 'workflow_resumed', actorId: 'user-1', createdAt: '2026-09-12T00:00:00Z', metadata: {}
    };
    await appendWorkflowEvent(store, event);
    expect(events).toEqual([event]);
  });
});
