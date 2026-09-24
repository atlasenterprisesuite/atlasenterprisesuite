import { describe, expect, it } from 'vitest';
import {
  ExecutionAdapterRegistry,
  ExecutionEngine,
  MemoryExecutionStore,
  type ExecutionActor,
  type ExecutionModuleAdapter,
  type ExecutionStep,
  type ExecutionTask
} from '../../packages/execution/src';

const sourceReference = { type: 'employee', id: 'employee-42' };
const now = '2026-09-12T12:00:00.000Z';

function task(input: Pick<ExecutionTask, 'id' | 'module' | 'title' | 'goal' | 'currentStepId' | 'nextAction' | 'permissionsRequired' | 'parentTaskId'>): ExecutionTask {
  return {
    id: input.id,
    scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
    module: input.module,
    ownerUserId: 'user-1',
    title: input.title,
    intent: 'Complete employee onboarding',
    goal: input.goal,
    status: 'now',
    priority: 'high',
    currentStepId: input.currentStepId,
    nextAction: input.nextAction,
    blockedReason: null,
    permissionsRequired: input.permissionsRequired,
    source: sourceReference,
    parentTaskId: input.parentTaskId,
    workflowId: 'workflow-1',
    version: 1,
    createdAt: now,
    updatedAt: now,
    completedAt: null
  };
}

function step(input: Pick<ExecutionStep, 'id' | 'taskId' | 'module' | 'actionType' | 'permissionsRequired' | 'evidenceRequirement'>): ExecutionStep {
  return {
    id: input.id,
    taskId: input.taskId,
    sequence: 1,
    module: input.module,
    actionType: input.actionType,
    actionPayload: { employeeId: sourceReference.id },
    status: 'pending',
    completionCriteria: ['domain result verified'],
    permissionsRequired: input.permissionsRequired,
    dependencyIds: [],
    evidenceRequirement: input.evidenceRequirement,
    startedAt: null,
    completedAt: null
  };
}

describe('ATLAS cross-module execution lineage', () => {
  it('preserves one HR employee reference while Payroll blocks and resumes', async () => {
    const store = new MemoryExecutionStore();
    store.putTask(task({
      id: 'hr-task',
      module: 'hr',
      title: 'Verify employee',
      goal: 'Verify the authoritative HR employee',
      currentStepId: 'hr-step',
      nextAction: 'Verify employee',
      permissionsRequired: [],
      parentTaskId: null
    }));
    store.putStep(step({
      id: 'hr-step',
      taskId: 'hr-task',
      module: 'hr',
      actionType: 'verify_employee',
      permissionsRequired: [],
      evidenceRequirement: ['employee_verified']
    }));
    store.putTask(task({
      id: 'payroll-task',
      module: 'payroll',
      title: 'Enroll employee in payroll',
      goal: 'Create payroll enrollment from the authoritative HR employee',
      currentStepId: 'payroll-step',
      nextAction: 'Enroll employee in payroll',
      permissionsRequired: ['payroll.write'],
      parentTaskId: 'hr-task'
    }));
    store.putStep(step({
      id: 'payroll-step',
      taskId: 'payroll-task',
      module: 'payroll',
      actionType: 'enroll_employee',
      permissionsRequired: ['payroll.write'],
      evidenceRequirement: ['payroll_record']
    }));

    const hrAdapter: ExecutionModuleAdapter = {
      module: 'hr',
      canHandle: (type) => type === 'verify_employee',
      validate: async () => ({ ok: true, errors: [] }),
      authorize: async () => ({ ok: true, reason: null }),
      execute: async () => ({ ok: true, result: { employeeId: sourceReference.id } }),
      verify: async () => ({
        ok: true,
        evidence: [{ kind: 'employee_verified', reference: sourceReference.id, verified: true }]
      }),
      suggestNext: async () => 'Enroll employee in payroll'
    };

    let payrollReady = false;
    const payrollAdapter: ExecutionModuleAdapter = {
      module: 'payroll',
      canHandle: (type) => type === 'enroll_employee',
      validate: async () => payrollReady
        ? ({ ok: true, errors: [] })
        : ({ ok: false, errors: ['payroll_configuration_required'] }),
      authorize: async (actor) => ({
        ok: actor.permissions.includes('payroll.write'),
        reason: 'payroll.write_required'
      }),
      execute: async () => ({ ok: true, result: { payrollEnrollmentId: 'payroll-77' } }),
      verify: async () => ({
        ok: true,
        evidence: [{ kind: 'payroll_record', reference: 'payroll-77', verified: true }]
      }),
      suggestNext: async () => 'Review benefits enrollment'
    };

    const engine = new ExecutionEngine(store, new ExecutionAdapterRegistry([hrAdapter, payrollAdapter]));
    const actor: ExecutionActor = {
      userId: 'user-1',
      scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
      permissions: ['payroll.write']
    };

    expect((await engine.continueTask('hr-task', actor)).state).toBe('completed_step');
    expect((await store.listEvidence('hr-task')).some((item) => item.reference === sourceReference.id)).toBe(true);

    const firstPayrollAttempt = await engine.continueTask('payroll-task', actor);
    expect(firstPayrollAttempt).toEqual({ state: 'blocked', reason: 'payroll_configuration_required' });
    expect((await store.listSteps('payroll-task'))[0]?.status).toBe('pending');

    payrollReady = true;
    expect((await engine.continueTask('payroll-task', actor)).state).toBe('completed_step');
    expect((await store.getTask('payroll-task'))?.source).toEqual(sourceReference);
    expect((await store.getTask('payroll-task'))?.parentTaskId).toBe('hr-task');
    expect(JSON.stringify(await store.getTask('payroll-task'))).not.toContain('employeeRecord');
    expect((await store.listEvidence('payroll-task')).some((item) => item.reference === 'payroll-77')).toBe(true);
  });
});
