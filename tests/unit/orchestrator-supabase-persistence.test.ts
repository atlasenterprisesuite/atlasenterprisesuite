import { describe, expect, it } from 'vitest';
import {
  SupabaseNightOperationsPersistence,
  SupabasePersistence,
  type AtlasFetch,
} from '../../packages/ai-core/src';
import type { AtlasEvent, AtlasTask, NightQueueItem } from '../../packages/task-protocol/src';

const scope = { tenantId: '11111111-1111-1111-1111-111111111111', organizationId: '22222222-2222-2222-2222-222222222222' };

function task(): AtlasTask {
  return {
    schemaVersion: 1,
    taskId: 'ATL-2026-NIGHT-1',
    objective: 'Process authorized overnight work',
    requestedBy: 'user',
    scope,
    assignedAgents: [],
    state: 'queued',
    artifacts: [], findings: [], commits: [], tests: [], approvals: [], events: [],
    traceId: null,
    deployment: null,
    createdAt: '2026-09-16T07:00:00.000Z',
    updatedAt: '2026-09-16T07:00:00.000Z',
  };
}

function queueRow() {
  return {
    queue_item_id: 'NQ-1', task_id: 'ATL-2026-NIGHT-1', source_thread_id: null,
    tenant_id: scope.tenantId, org_id: scope.organizationId, status: 'leased',
    priority: 10, attempt: 1, max_attempts: 5, lease_owner: 'worker-1',
    lease_expires_at: '2026-09-16T07:10:00.000Z', heartbeat_at: '2026-09-16T07:05:00.000Z',
    checkpoint_id: null, archive_policy: 'eligible_on_verified_completion', archive_eligible: false,
    next_eligible_at: null, created_at: '2026-09-16T07:00:00.000Z', updated_at: '2026-09-16T07:05:00.000Z',
  };
}

function response(status: number, body?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return body === undefined ? '' : JSON.stringify(body); },
  };
}

describe('Supabase durable orchestrator persistence', () => {
  it('persists and reads canonical AtlasTask through scoped backend REST calls', async () => {
    const calls: Array<{ url: string; method: string; body?: string }> = [];
    const canonical = task();
    const fetchImpl: AtlasFetch = async (url, init = {}) => {
      calls.push({ url, method: init.method ?? 'GET', body: init.body });
      if ((init.method ?? 'GET') === 'POST') return response(201);
      return response(200, [{ task: canonical }]);
    };
    const persistence = new SupabasePersistence({ url: 'https://atlas.supabase.test', serviceRoleKey: 'server-secret', fetchImpl });

    expect(persistence.durable).toBe(true);
    await persistence.createTask(canonical);
    const loaded = await persistence.getTask(scope, canonical.taskId);

    expect(loaded).toEqual(canonical);
    expect(calls[0]?.url).toContain('/rest/v1/atlas_orchestrator_tasks');
    expect(calls[1]?.url).toContain(`tenant_id=eq.${scope.tenantId}`);
    expect(calls[1]?.url).toContain(`org_id=eq.${scope.organizationId}`);
  });

  it('appends and lists canonical events without changing their payload', async () => {
    const event: AtlasEvent = {
      eventId: 'evt-1', taskId: 'ATL-2026-NIGHT-1', scope, type: 'task.created', actorId: 'service',
      agentId: null, providerId: null, outcome: 'success', correlationId: 'corr-1', payload: {},
      createdAt: '2026-09-16T07:00:00.000Z',
    };
    const fetchImpl: AtlasFetch = async (_url, init = {}) => {
      if ((init.method ?? 'GET') === 'POST') return response(201);
      return response(200, [{ event }]);
    };
    const persistence = new SupabasePersistence({ url: 'https://atlas.supabase.test', serviceRoleKey: 'server-secret', fetchImpl });
    await persistence.appendEvent(event);
    expect(await persistence.listEvents(scope, event.taskId)).toEqual([event]);
  });
});

describe('Supabase durable night persistence', () => {
  it('claims the next item through the atomic Supabase RPC and maps the lease', async () => {
    const calls: Array<{ url: string; body?: string }> = [];
    const fetchImpl: AtlasFetch = async (url, init = {}) => {
      calls.push({ url, body: init.body });
      return response(200, [queueRow()]);
    };
    const persistence = new SupabaseNightOperationsPersistence({
      url: 'https://atlas.supabase.test', serviceRoleKey: 'server-secret', fetchImpl,
    });

    expect(persistence.durable).toBe(true);
    const claimed = await persistence.claimNextNightItem(
      scope, 'worker-1', '2026-09-16T07:05:00.000Z', '2026-09-16T07:10:00.000Z',
    );

    expect(claimed?.queueItemId).toBe('NQ-1');
    expect(claimed?.status).toBe('leased');
    expect(claimed?.attempt).toBe(1);
    expect(calls[0]?.url).toContain('/rest/v1/rpc/atlas_claim_night_item');
    expect(calls[0]?.body).toContain('worker-1');
  });

  it('refuses cross-scope overwrite when a scoped save returns no row', async () => {
    const fetchImpl: AtlasFetch = async () => response(200, []);
    const persistence = new SupabaseNightOperationsPersistence({
      url: 'https://atlas.supabase.test', serviceRoleKey: 'server-secret', fetchImpl,
    });
    const item: NightQueueItem = {
      schemaVersion: 1, queueItemId: 'NQ-1', taskId: 'ATL-2026-NIGHT-1', sourceThreadId: null, scope,
      status: 'completed_autonomous', priority: 10, attempt: 1, maxAttempts: 5,
      leaseOwner: null, leaseExpiresAt: null, heartbeatAt: '2026-09-16T07:05:00.000Z', checkpointId: 'NCP-1',
      archivePolicy: 'eligible_on_verified_completion', archiveEligible: true, nextEligibleAt: null,
      createdAt: '2026-09-16T07:00:00.000Z', updatedAt: '2026-09-16T07:05:00.000Z',
    };

    await expect(persistence.saveNightItem(item)).rejects.toThrow(/not found in scope/i);
  });
});
