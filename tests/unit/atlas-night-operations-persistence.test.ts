import { describe, expect, it } from 'vitest';
import { InMemoryNightOperationsPersistence } from '../../packages/ai-core/src';
import type { NightQueueItem } from '../../packages/task-protocol/src';

const scope = { tenantId: 'tenant-1', organizationId: 'org-1' };

function item(overrides: Partial<NightQueueItem> = {}): NightQueueItem {
  return {
    schemaVersion: 1,
    queueItemId: 'NQ-1',
    taskId: 'ATL-1',
    sourceThreadId: null,
    scope,
    status: 'queued',
    priority: 100,
    attempt: 0,
    maxAttempts: 5,
    leaseOwner: null,
    leaseExpiresAt: null,
    heartbeatAt: null,
    checkpointId: null,
    archivePolicy: 'never',
    archiveEligible: false,
    nextEligibleAt: null,
    createdAt: '2026-09-16T03:00:00.000Z',
    updatedAt: '2026-09-16T03:00:00.000Z',
    ...overrides,
  };
}

describe('ATLAS Night Operations persistence', () => {
  it('allows exactly one worker to claim an eligible item', async () => {
    const store = new InMemoryNightOperationsPersistence();
    await store.enqueueNightItem(item());

    const [a, b] = await Promise.all([
      store.claimNextNightItem(scope, 'worker-a', '2026-09-16T03:01:00.000Z', '2026-09-16T03:06:00.000Z'),
      store.claimNextNightItem(scope, 'worker-b', '2026-09-16T03:01:00.000Z', '2026-09-16T03:06:00.000Z'),
    ]);

    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect((a ?? b)?.status).toBe('leased');
  });

  it('does not expose a queue item across tenant scope', async () => {
    const store = new InMemoryNightOperationsPersistence();
    await store.enqueueNightItem(item());

    const claimed = await store.claimNextNightItem(
      { tenantId: 'tenant-2', organizationId: 'org-1' },
      'worker-x',
      '2026-09-16T03:01:00.000Z',
      '2026-09-16T03:06:00.000Z',
    );

    expect(claimed).toBeNull();
  });

  it('allows recovery after an expired lease', async () => {
    const store = new InMemoryNightOperationsPersistence();
    await store.enqueueNightItem(item({
      status: 'leased',
      leaseOwner: 'dead-worker',
      leaseExpiresAt: '2026-09-16T03:00:30.000Z',
    }));

    const claimed = await store.claimNextNightItem(
      scope,
      'recovery-worker',
      '2026-09-16T03:01:00.000Z',
      '2026-09-16T03:06:00.000Z',
    );

    expect(claimed?.leaseOwner).toBe('recovery-worker');
    expect(claimed?.attempt).toBe(1);
  });
});