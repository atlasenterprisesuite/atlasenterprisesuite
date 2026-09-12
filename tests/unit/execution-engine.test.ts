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

    expect(result).toEqual({ state: 'blocked', reason: 'payroll.write_required' });
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
});
