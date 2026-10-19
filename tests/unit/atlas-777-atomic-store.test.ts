import { describe, expect, it } from 'vitest';
import { enqueue, type Job } from '../../apps/web/src/lib/atlas777Executor';
import { claimPersisted, finishPersisted, type AtomicJobStore, type VersionedJob } from '../../apps/web/src/lib/atlas777AtomicStore';

const job = () => enqueue({
  id: 'job-1', sourceEventId: 'event-1', repository: 'atlasenterprisesuite/atlasenterprisesuite',
  targetSha: 'a'.repeat(40), action: 'inspect', maxAttempts: 2
}, 0);

function memoryStore(initial: Job): AtomicJobStore & { snapshot(): VersionedJob } {
  let current: VersionedJob = { job: initial, version: 0 };
  return {
    async get(id) { return id === current.job.id ? { ...current } : null; },
    async compareAndSwap(id, version, next) {
      if (id !== current.job.id || version !== current.version) return false;
      current = { job: next, version: current.version + 1 };
      return true;
    },
    snapshot() { return current; }
  };
}
describe('ATLAS 777 durable persistence boundary', () => {
  it('allows one winner when two workers race on the same snapshot', async () => {
    const store = memoryStore(job());
    const [a, b] = await Promise.all([
      claimPersisted(store, 'job-1', 'worker-a', 0, 1000),
      claimPersisted(store, 'job-1', 'worker-b', 0, 1000)
    ]);
    expect([a?.persisted, b?.persisted].filter(Boolean)).toHaveLength(1);
    expect(store.snapshot().job.attempts).toBe(1);
  });
  it('rejects stale lease owners and retains persisted state', async () => {
    const store = memoryStore(job());
    await claimPersisted(store, 'job-1', 'worker-a', 0, 1000);
    const rejected = await finishPersisted(store, 'job-1', 'worker-b', 10, 'completed');
    expect(rejected?.accepted).toBe(false);
    expect(store.snapshot().job.status).toBe('leased');
    const success = await finishPersisted(store, 'job-1', 'worker-a', 10, 'completed');
    expect(success?.persisted).toBe(true);
    expect(store.snapshot().job.status).toBe('completed');
  });
  it('does not execute unknown jobs', async () => {
    expect(await claimPersisted(memoryStore(job()), 'missing', 'worker-a', 0, 1000)).toBeNull();
  });
});
