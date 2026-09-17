import { describe, expect, it } from 'vitest';
import { SupabasePersistence } from '../../packages/ai-core/src';
import type { AtlasEvent, AtlasTask } from '../../packages/task-protocol/src';

const task: AtlasTask = {
  schemaVersion: 1,
  taskId: 'ATL-1',
  objective: 'Verify durable persistence',
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
  createdAt: '2026-09-16T00:00:00.000Z',
  updatedAt: '2026-09-16T00:00:00.000Z',
};

const event: AtlasEvent = {
  eventId: 'evt-123-textual',
  taskId: 'ATL-1',
  scope: { tenantId: 'tenant-a', organizationId: 'org-a' },
  type: 'task.created',
  actorId: 'user-1',
  agentId: null,
  providerId: null,
  outcome: 'success',
  correlationId: 'corr-1',
  payload: {},
  createdAt: '2026-09-16T00:00:01.000Z',
};

function recorder(responses: Response[] = []) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = (async (input: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(input), init });
    return responses.shift() ?? new Response(null, { status: 204 });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

function headers(init: RequestInit): Record<string, string> {
  return Object.fromEntries(new Headers(init.headers).entries());
}

describe('SupabasePersistence', () => {
  it('creates scoped tasks with server-only authorization', async () => {
    const { calls, fetchImpl } = recorder();
    const persistence = new SupabasePersistence({
      url: 'https://example.supabase.co',
      serviceRoleKey: 'service-role',
      fetchImpl,
    });

    expect(persistence.durable).toBe(true);
    await persistence.createTask(task);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://example.supabase.co/rest/v1/atlas_orchestrator_tasks');
    expect(headers(calls[0].init).authorization).toBe('Bearer service-role');
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({
      tenant_id: 'tenant-a',
      organization_id: 'org-a',
      task_id: 'ATL-1',
      schema_version: 1,
      state: 'draft',
      task_json: task,
    });
  });

  it('scopes task reads and updates by tenant, organization and task id', async () => {
    const { calls, fetchImpl } = recorder([
      new Response(JSON.stringify([{ task_json: task }]), { status: 200, headers: { 'content-type': 'application/json' } }),
      new Response(null, { status: 204 }),
    ]);
    const persistence = new SupabasePersistence({ url: 'https://example.supabase.co/', serviceRoleKey: 'service-role', fetchImpl });

    const loaded = await persistence.getTask(task.scope, task.taskId);
    expect(loaded).toEqual(task);
    expect(calls[0].url).toContain('tenant_id=eq.tenant-a');
    expect(calls[0].url).toContain('organization_id=eq.org-a');
    expect(calls[0].url).toContain('task_id=eq.ATL-1');

    await persistence.saveTask({ ...task, state: 'queued' });
    expect(calls[1].init.method).toBe('PATCH');
    expect(calls[1].url).toContain('tenant_id=eq.tenant-a');
    expect(calls[1].url).toContain('organization_id=eq.org-a');
    expect(calls[1].url).toContain('task_id=eq.ATL-1');
  });

  it('stores textual event ids and lists events in deterministic order', async () => {
    const { calls, fetchImpl } = recorder([
      new Response(null, { status: 204 }),
      new Response(JSON.stringify([{ event_json: event }]), { status: 200, headers: { 'content-type': 'application/json' } }),
    ]);
    const persistence = new SupabasePersistence({ url: 'https://example.supabase.co', serviceRoleKey: 'service-role', fetchImpl });

    await persistence.appendEvent(event);
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({ id: 'evt-123-textual', event_type: 'task.created' });

    const events = await persistence.listEvents(event.scope, event.taskId);
    expect(events).toEqual([event]);
    expect(calls[1].url).toContain('tenant_id=eq.tenant-a');
    expect(calls[1].url).toContain('organization_id=eq.org-a');
    expect(calls[1].url).toContain('task_id=eq.ATL-1');
    expect(calls[1].url).toContain('order=occurred_at.asc%2Cid.asc');
  });

  it('fails safely without leaking the service-role credential', async () => {
    const { fetchImpl } = recorder([new Response('forbidden', { status: 403 })]);
    const persistence = new SupabasePersistence({ url: 'https://example.supabase.co', serviceRoleKey: 'very-secret-role', fetchImpl });

    await expect(persistence.createTask(task)).rejects.toThrow('HTTP 403');
    await expect(persistence.createTask(task)).rejects.not.toThrow('very-secret-role');
  });
});
