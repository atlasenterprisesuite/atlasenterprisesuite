import { describe, expect, it } from 'vitest';
import { SupabaseRpcPersistence } from '../../packages/ai-core/src';
import type { AtlasEvent, AtlasTask } from '../../packages/task-protocol/src';

const task: AtlasTask = {
  schemaVersion: 1,
  taskId: 'ATL-RPC-1',
  objective: 'Verify RPC persistence',
  requestedBy: 'user',
  scope: { tenantId: 'tenant-a', organizationId: 'org-a' },
  assignedAgents: [],
  state: 'draft',
  artifacts: [],
  findings: [],
  commits: [],
  tests: [],
  approvals: [],
  events: [],
  traceId: null,
  deployment: null,
  createdAt: '2026-09-18T00:00:00.000Z',
  updatedAt: '2026-09-18T00:00:00.000Z',
};

const event: AtlasEvent = {
  eventId: 'evt-rpc-1',
  taskId: task.taskId,
  scope: task.scope,
  type: 'task.created',
  actorId: 'user-1',
  agentId: null,
  providerId: null,
  outcome: 'success',
  correlationId: 'corr-rpc-1',
  payload: {},
  createdAt: '2026-09-18T00:00:01.000Z',
};

function recorder(responses: Response[] = []) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = (async (input: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(input), init });
    return responses.shift() ?? new Response(null, { status: 204 });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

describe('SupabaseRpcPersistence', () => {
  it('uses a server-only secret plus a dedicated runtime token', async () => {
    const { calls, fetchImpl } = recorder();
    const persistence = new SupabaseRpcPersistence({
      url: 'https://example.supabase.co',
      secretKey: 'sb_secret_server_only',
      runtimeToken: 'runtime-secret',
      fetchImpl,
    });

    await persistence.createTask(task);

    expect(persistence.durable).toBe(true);
    expect(calls[0].url).toBe('https://example.supabase.co/rest/v1/rpc/atlas_orchestrator_create_task');
    const h = new Headers(calls[0].init.headers);
    expect(h.get('apikey')).toBe('sb_secret_server_only');
    expect(h.get('x-atlas-runtime-token')).toBe('runtime-secret');
    expect(h.get('authorization')).toBeNull();
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({
      p_tenant_id: 'tenant-a',
      p_organization_id: 'org-a',
      p_task_id: 'ATL-RPC-1',
    });
  });

  it('round-trips task and event JSON through RPC responses', async () => {
    const { calls, fetchImpl } = recorder([
      new Response(JSON.stringify(task), { status: 200 }),
      new Response(null, { status: 204 }),
      new Response(null, { status: 204 }),
      new Response(JSON.stringify([event]), { status: 200 }),
    ]);
    const persistence = new SupabaseRpcPersistence({
      url: 'https://example.supabase.co/',
      secretKey: 'sb_secret_server_only',
      runtimeToken: 'runtime-secret',
      fetchImpl,
    });

    expect(await persistence.getTask(task.scope, task.taskId)).toEqual(task);
    await persistence.saveTask({ ...task, state: 'queued' });
    await persistence.appendEvent(event);
    expect(await persistence.listEvents(task.scope, task.taskId)).toEqual([event]);

    expect(calls.map((call) => call.url)).toEqual([
      'https://example.supabase.co/rest/v1/rpc/atlas_orchestrator_get_task',
      'https://example.supabase.co/rest/v1/rpc/atlas_orchestrator_save_task',
      'https://example.supabase.co/rest/v1/rpc/atlas_orchestrator_append_event',
      'https://example.supabase.co/rest/v1/rpc/atlas_orchestrator_list_events',
    ]);
  });

  it('does not leak the runtime token in failures', async () => {
    const { fetchImpl } = recorder([new Response('forbidden', { status: 403 })]);
    const persistence = new SupabaseRpcPersistence({
      url: 'https://example.supabase.co',
      secretKey: 'sb_secret_server_only',
      runtimeToken: 'runtime-secret-never-log',
      fetchImpl,
    });

    const error = await persistence.createTask(task).then(() => null, (caught: unknown) => caught);
    const message = error instanceof Error ? error.message : String(error);
    expect(message).toContain('HTTP 403');
    expect(message).not.toContain('runtime-secret-never-log');
  });
});
