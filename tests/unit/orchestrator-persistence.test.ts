import { describe, expect, it } from 'vitest';
import { InMemoryPersistence } from '../../packages/ai-core/src';
import type { AtlasTask } from '../../packages/task-protocol/src';

const scope = { tenantId: 'tenant-a', organizationId: 'org-a' };

function task(): AtlasTask {
  return {
    schemaVersion: 1,
    taskId: 'ATL-2026-000001',
    objective: 'Share governed ATLAS context across AI clients',
    requestedBy: 'user',
    scope,
    assignedAgents: [],
    state: 'draft',
    artifacts: [], findings: [], commits: [], tests: [], approvals: [], events: [],
    traceId: null, deployment: null,
    createdAt: '2026-09-06T00:00:00.000Z',
    updatedAt: '2026-09-06T00:00:00.000Z'
  };
}

describe('ATLAS orchestrator persistence', () => {
  it('is explicitly non-durable until a production adapter exists', () => {
    expect(new InMemoryPersistence().durable).toBe(false);
  });

  it('returns tasks only inside the matching tenant and organization', async () => {
    const persistence = new InMemoryPersistence();
    await persistence.createTask(task());

    expect((await persistence.getTask(scope, 'ATL-2026-000001'))?.taskId).toBe('ATL-2026-000001');
    expect(await persistence.getTask({ tenantId: 'tenant-b', organizationId: 'org-a' }, 'ATL-2026-000001')).toBeNull();
  });

  it('claims each GitHub delivery id once per tenant and organization', async () => {
    const persistence = new InMemoryPersistence();
    const delivery = {
      deliveryId: 'github-delivery-1',
      event: 'issues',
      action: 'opened',
      installationId: 42,
      repository: 'atlasenterprisesuite/atlasenterprisesuite',
      receivedAt: '2026-09-20T15:40:00.000Z',
    };

    await expect(persistence.claimGitHubWebhookDelivery(scope, delivery)).resolves.toBe(true);
    await expect(persistence.claimGitHubWebhookDelivery(scope, delivery)).resolves.toBe(false);
    await expect(persistence.claimGitHubWebhookDelivery(
      { tenantId: 'tenant-b', organizationId: 'org-a' },
      delivery,
    )).resolves.toBe(true);
  });

  it('returns defensive copies so callers cannot mutate canonical state', async () => {
    const persistence = new InMemoryPersistence();
    await persistence.createTask(task());
    const first = await persistence.getTask(scope, 'ATL-2026-000001');
    if (!first) throw new Error('expected task');
    first.state = 'completed';

    expect((await persistence.getTask(scope, 'ATL-2026-000001'))?.state).toBe('draft');
  });
});
