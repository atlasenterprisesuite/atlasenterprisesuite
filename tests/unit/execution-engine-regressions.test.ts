import { describe, expect, it } from 'vitest';
import {
  ExecutionAdapterRegistry,
  ExecutionEngine,
  MemoryExecutionStore,
  type ExecutionActor,
  type ExecutionModuleAdapter,
  type ExecutionStep
} from '../../packages/execution/src';

const actor = (permissions: readonly string[]): ExecutionActor => ({
  userId: 'user-1',
  scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
  permissions
});

function successfulPayrollAdapter(): ExecutionModuleAdapter {
  return {
    module: 'payroll',
    canHandle: () => true,
    validate: async () => ({ ok: true, errors: [] }),
    authorize: async () => ({ ok: true, reason: null }),
    execute: async () => ({ ok: true, result: {} }),
    verify: async () => ({ ok: true, evidence: [] }),
    suggestNext: async () => 'Continue payroll workflow'
  };
}

describe('ExecutionEngine regressions', () => {
  it('blocks missing task-level permissions before resolving an adapter', async () => {
    const store = MemoryExecutionStore.seeded();
    const engine = new ExecutionEngine(store, new ExecutionAdapterRegistry([]));

    await expect(engine.continueTask('task-1', actor([]))).resolves.toEqual({
      state: 'blocked',
      reason: 'missing_task_permission:payroll.write'
    });
  });

  it('persists the next eligible step after a successful step', async () => {
    const store = MemoryExecutionStore.seeded();
    const step2: ExecutionStep = {
      id: 'step-2',
      taskId: 'task-1',
      sequence: 2,
      module: 'payroll',
      actionType: 'confirm_enrollment',
      actionPayload: { employeeId: 'employee-42' },
      status: 'pending',
      completionCriteria: ['enrollment confirmed'],
      permissionsRequired: ['payroll.write'],
      dependencyIds: ['step-1'],
      evidenceRequirement: [],
      startedAt: null,
      completedAt: null
    };
    store.putStep(step2);
    const engine = new ExecutionEngine(store, new ExecutionAdapterRegistry([successfulPayrollAdapter()]));

    await expect(engine.continueTask('task-1', actor(['payroll.write']))).resolves.toEqual({
      state: 'completed_step',
      stepId: 'step-1'
    });

    const persisted = await store.getTask('task-1');
    expect(persisted?.currentStepId).toBe('step-2');
    expect(persisted?.completedAt).toBeNull();
  });

  it('clears the current step and completes the task after its final step', async () => {
    const store = MemoryExecutionStore.seeded();
    const engine = new ExecutionEngine(store, new ExecutionAdapterRegistry([successfulPayrollAdapter()]));

    await expect(engine.continueTask('task-1', actor(['payroll.write']))).resolves.toEqual({
      state: 'completed_step',
      stepId: 'step-1'
    });

    const persisted = await store.getTask('task-1');
    expect(persisted?.currentStepId).toBeNull();
    expect(persisted?.status).toBe('completed');
    expect(persisted?.completedAt).not.toBeNull();
  });
});
