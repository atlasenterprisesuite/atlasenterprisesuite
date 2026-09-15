import { describe, expect, it } from 'vitest';
import {
  ExecutionAdapterRegistry,
  ExecutionEngine,
  MemoryExecutionStore,
  type ExecutionModuleAdapter
} from '../../packages/execution/src';

const payrollAdapter: ExecutionModuleAdapter = {
  module: 'payroll',
  canHandle: (actionType) => actionType === 'enroll_employee',
  validate: async () => ({ ok: true, errors: [] }),
  authorize: async (actor) => ({ ok: actor.permissions.includes('payroll.write'), reason: 'payroll.write_required' }),
  execute: async () => ({ ok: true, result: { payrollEnrollmentId: 'payroll-77' } }),
  verify: async () => ({ ok: true, evidence: [{ kind: 'payroll_record', reference: 'payroll-77', verified: true }] }),
  suggestNext: async () => 'Review benefits enrollment'
};

describe('ATLAS ExecutionEngine', () => {
  it('blocks execution when actor authorization is missing', async () => {
    const store = MemoryExecutionStore.seeded();
    const registry = new ExecutionAdapterRegistry([payrollAdapter]);
    const engine = new ExecutionEngine(store, registry);

    const result = await engine.continueTask('task-1', {
      userId: 'user-1',
      scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
      permissions: []
    });

    expect(result).toEqual({ state: 'blocked', reason: 'missing_task_permission:payroll.write' });
  });

  it('executes, verifies, stores evidence, and advances the next action', async () => {
    const store = MemoryExecutionStore.seeded();
    const registry = new ExecutionAdapterRegistry([payrollAdapter]);
    const engine = new ExecutionEngine(store, registry);

    const result = await engine.continueTask('task-1', {
      userId: 'user-1',
      scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
      permissions: ['payroll.write']
    });

    expect(result.state).toBe('completed_step');
    expect((await store.listEvidence('task-1')).map((item) => item.reference)).toContain('payroll-77');
    expect((await store.getTask('task-1'))?.nextAction).toBe('Review benefits enrollment');
  });

  it('records an attempted adapter execution failure as failed rather than blocked', async () => {
    const failingAdapter: ExecutionModuleAdapter = {
      ...payrollAdapter,
      execute: async () => ({ ok: false, result: {}, errorCode: 'provider_rejected' })
    };
    const store = MemoryExecutionStore.seeded();
    const engine = new ExecutionEngine(store, new ExecutionAdapterRegistry([failingAdapter]));

    const result = await engine.continueTask('task-1', {
      userId: 'user-1',
      scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
      permissions: ['payroll.write']
    });

    expect(result).toEqual({ state: 'failed', reason: 'provider_rejected' });
    expect((await store.listSteps('task-1'))[0]?.status).toBe('failed');
  });

  it('records failed post-execution verification as failed rather than blocked', async () => {
    const verificationFailingAdapter: ExecutionModuleAdapter = {
      ...payrollAdapter,
      verify: async () => ({ ok: false, evidence: [], reason: 'provider_result_unverified' })
    };
    const store = MemoryExecutionStore.seeded();
    const engine = new ExecutionEngine(store, new ExecutionAdapterRegistry([verificationFailingAdapter]));

    const result = await engine.continueTask('task-1', {
      userId: 'user-1',
      scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
      permissions: ['payroll.write']
    });

    expect(result).toEqual({ state: 'failed', reason: 'provider_result_unverified' });
    expect((await store.listSteps('task-1'))[0]?.status).toBe('failed');
  });
});
