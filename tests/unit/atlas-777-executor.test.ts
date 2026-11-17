import { describe, expect, it } from 'vitest';
import { claim, enqueue, finish } from '../../apps/web/src/lib/atlas777Executor';

const sha = 'a'.repeat(40);
const base = () => enqueue({ id: 'job-1', sourceEventId: 'event-1', repository: 'atlasenterprisesuite/atlasenterprisesuite', targetSha: sha, action: 'inspect', maxAttempts: 2 }, 0);

describe('ATLAS 777 executor fail-closed state machine', () => {
  it('rejects unverified SHA and unbounded retry limits', () => {
    expect(() => enqueue({ id: 'j', sourceEventId: 'e', repository: 'owner/repo', targetSha: 'main', action: 'inspect', maxAttempts: 2 }, 0)).toThrow();
    expect(() => enqueue({ id: 'j', sourceEventId: 'e', repository: 'owner/repo', targetSha: sha, action: 'inspect', maxAttempts: 999 }, 0)).toThrow();
  });
  it('rejects competing workers and stale completions', () => {
    const first = claim(base(), 'worker-a', 0, 1000);
    expect(first.accepted).toBe(true);
    expect(claim(first.job, 'worker-b', 500, 1000).accepted).toBe(false);
    expect(finish(first.job, 'worker-b', 500, 'completed').accepted).toBe(false);
    expect(finish(first.job, 'worker-a', 1000, 'completed').accepted).toBe(false);
    const recovered = claim(first.job, 'worker-b', 1000, 1000);
    expect(recovered.accepted).toBe(true);
    expect(finish(recovered.job, 'worker-a', 1001, 'completed').accepted).toBe(false);
    expect(finish(recovered.job, 'worker-b', 1001, 'completed').job.status).toBe('completed');
  });
  it('bounds retries and moves exhausted jobs to dead letter', () => {
    const first = claim(base(), 'worker-a', 0, 1000);
    const retry = finish(first.job, 'worker-a', 100, 'retry');
    expect(retry.job.status).toBe('queued');
    expect(claim(retry.job, 'worker-a', 500, 1000).accepted).toBe(false);
    const second = claim(retry.job, 'worker-a', 1100, 1000);
    expect(second.accepted).toBe(true);
    expect(finish(second.job, 'worker-a', 1200, 'retry').job.status).toBe('dead_letter');
  });
  it('blocks human-only action without treating it as successful', () => {
    const leased = claim(base(), 'worker-a', 0, 1000);
    expect(finish(leased.job, 'worker-a', 10, 'blocked').job.status).toBe('blocked');
    expect(claim(finish(leased.job, 'worker-a', 10, 'blocked').job, 'worker-b', 20, 1000).accepted).toBe(false);
  });
});
