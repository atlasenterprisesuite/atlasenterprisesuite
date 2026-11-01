import { describe, expect, it, vi } from 'vitest';
import { createPersistentRoboticsRunStore } from '../../packages/robotics/persistent-run-store';

const scope = { tenantId: 'tenant-a', organizationId: '00000000-0000-4000-8000-000000000001' };
describe('robotics F6 persistent store bridge contract (mock only)', () => {
  it('F6-001 propagates tenant and organization to transaction executor', async () => {
    const transaction = vi.fn(async () => true);
    const store = createPersistentRoboticsRunStore(transaction);
    expect(await store.reserve(scope, 'run_1')).toBe(true);
    expect(transaction).toHaveBeenCalledWith({ command: 'reserve', tenantId: scope.tenantId, organizationId: scope.organizationId, runId: 'run_1' });
  });
  it('F6-002 denies invalid run identifiers before invoking storage', async () => {
    const transaction = vi.fn(async () => true);
    const store = createPersistentRoboticsRunStore(transaction);
    await expect(store.reserve(scope, '../unsafe')).rejects.toThrow('invalid_robotics_scope');
    expect(transaction).not.toHaveBeenCalled();
  });
  it('F6-003 denies completion when transaction reports false', async () => {
    const store = createPersistentRoboticsRunStore(async () => false);
    await expect(store.complete(scope, 'run_2')).rejects.toThrow('robotics_complete_denied');
  });
  it('F6-004 denies halt when transaction reports false', async () => {
    const store = createPersistentRoboticsRunStore(async () => false);
    await expect(store.halt(scope, 'run_3')).rejects.toThrow('robotics_halt_denied');
  });
  it('F6-005 propagates database failure instead of simulating success', async () => {
    const store = createPersistentRoboticsRunStore(async () => { throw Error('db_unavailable'); });
    await expect(store.isHalted(scope, 'run_4')).rejects.toThrow('db_unavailable');
  });
});
// PostgreSQL two-session tests are separate P0 requirements, NOT covered by these mocks.
