import { describe, expect, it } from 'vitest';
import { transitionCycle, type DurableCycleStore, type VersionedCycle } from '../../packages/catchup/durable-cycle';
import type { CatchUpCycle } from '../../packages/catchup/lifecycle';

const initial: CatchUpCycle = { id: 'cycle-1', tenantId: 'tenant-a', commitments: [{ id: 'c1', state: 'pending' }], jobs: [] };
function store(): DurableCycleStore & { snapshot(): VersionedCycle } {
  let current: VersionedCycle = { cycle: structuredClone(initial), version: 0 };
  return {
    async read(tenant, id) {
      return tenant === current.cycle.tenantId && id === current.cycle.id
        ? structuredClone(current) : null;
    },
    async compareAndSwap(tenant, id, version, next) {
      if (tenant !== current.cycle.tenantId || id !== current.cycle.id || version !== current.version) return false;
      current = { cycle: structuredClone(next), version: version + 1 };
      return true;
    },
    snapshot: () => structuredClone(current),
  };
}
describe('CatchUp durable cycle contract (in-memory test double; not production DB)', () => {
  it('allows exactly one winner for concurrent updates on the same version', async () => {
    const db = store();
    const results = await Promise.all([
      transitionCycle(db, 'tenant-a', 'cycle-1', c => ({ ...c, status: 'open' })),
      transitionCycle(db, 'tenant-a', 'cycle-1', c => ({ ...c, status: 'complete' })),
    ]);
    expect(results.filter(r => r.accepted)).toHaveLength(1);
    expect(db.snapshot().version).toBe(1);
  });
  it('rejects cross-tenant reads and mutations', async () => {
    const db = store();
    expect((await transitionCycle(db, 'tenant-b', 'cycle-1', c => c)).accepted).toBe(false);
    expect(db.snapshot().version).toBe(0);
  });
  it('rejects tenant and cycle identity changes before persistence', async () => {
    const db = store();
    expect((await transitionCycle(db, 'tenant-a', 'cycle-1', c => ({ ...c, tenantId: 'tenant-b' }))).accepted).toBe(false);
    expect((await transitionCycle(db, 'tenant-a', 'cycle-1', c => ({ ...c, id: 'cycle-2' }))).accepted).toBe(false);
    expect(db.snapshot().version).toBe(0);
  });
  it('preserves state across new callers using the same store', async () => {
    const db = store();
    expect((await transitionCycle(db, 'tenant-a', 'cycle-1', c => ({ ...c, status: 'open' }))).accepted).toBe(true);
    const anotherWorker = await db.read('tenant-a', 'cycle-1');
    expect(anotherWorker?.cycle.status).toBe('open');
    expect(anotherWorker?.version).toBe(1);
  });
});
