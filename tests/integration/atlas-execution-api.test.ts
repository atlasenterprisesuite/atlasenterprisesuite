import { describe, expect, it } from 'vitest';
import { createAtlasExecutionHandler } from '../../supabase/functions/atlas-execution/index';
import type { ExecutionApiContext, ExecutionApiStore } from '../../supabase/functions/atlas-execution/index';

function responseJson(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const context = (permissions: string[] = ['workflow.read', 'workflow.manage', 'workflow.approve']): ExecutionApiContext => ({
  organization_id: '11111111-1111-4111-8111-111111111111',
  user_id: '22222222-2222-4222-8222-222222222222',
  permissions,
  roles: ['admin'],
  request_id: 'req-1'
});

function fakeStore(overrides: Partial<ExecutionApiStore> = {}): ExecutionApiStore {
  return {
    async listWorkflows() { return []; },
    async getWorkflow() { return { task_id: 'task-1', org_id: context().organization_id, status: 'next', trace_id: '33333333-3333-4333-8333-333333333333' }; },
    async createWorkflow() { return { task_id: 'task-1', org_id: context().organization_id, status: 'next', trace_id: '33333333-3333-4333-8333-333333333333' }; },
    async updateWorkflow(_ctx, _taskId, patch) { return { task_id: 'task-1', org_id: context().organization_id, trace_id: '33333333-3333-4333-8333-333333333333', ...patch }; },
    async appendEvent() {},
    async getApproval() { return { id: 'approval-1', task_id: 'task-1', status: 'pending' }; },
    async updateApproval(_ctx, _approvalId, patch) { return { id: 'approval-1', task_id: 'task-1', ...patch }; },
    async listProviders() { return []; },
    ...overrides
  };
}

describe('ATLAS execution Edge API', () => {
  it('returns unauthenticated for mutation when identity resolution fails', async () => {
    const handler = createAtlasExecutionHandler({
      resolveContext: async () => { throw Object.assign(new Error('unauthenticated'), { code: 'unauthenticated', status: 401 }); },
      store: fakeStore(),
      randomUUID: () => '33333333-3333-4333-8333-333333333333'
    });
    const response = await handler(new Request('https://example.test/functions/v1/atlas-execution?api=create', { method: 'POST' }));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ ok: false, error: 'unauthenticated' });
  });

  it('uses authenticated organization scope instead of body organization_id', async () => {
    let seenOrg = '';
    const store = fakeStore({
      async createWorkflow(ctx) {
        seenOrg = ctx.organization_id;
        return { task_id: 'task-1', org_id: ctx.organization_id, status: 'next', trace_id: '33333333-3333-4333-8333-333333333333' };
      }
    });
    const handler = createAtlasExecutionHandler({ resolveContext: async () => context(), store, randomUUID: () => '33333333-3333-4333-8333-333333333333' });
    const response = await handler(new Request('https://example.test/functions/v1/atlas-execution?api=create', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organization_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', workflow_type: 'demo', module: 'core' })
    }));
    expect(response.status).toBe(201);
    expect(seenOrg).toBe(context().organization_id);
  });

  it('requires workflow.approve for approve mutation', async () => {
    let updates = 0;
    const store = fakeStore({ async updateApproval() { updates += 1; return {}; } });
    const handler = createAtlasExecutionHandler({ resolveContext: async () => context(['workflow.read', 'workflow.manage']), store, randomUUID: crypto.randomUUID });
    const response = await handler(new Request('https://example.test/functions/v1/atlas-execution?api=approve', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ approval_id: 'approval-1' })
    }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ ok: false, error: 'forbidden' });
    expect(updates).toBe(0);
  });

  it('reports provider state exactly and never upgrades configured_unverified to verified', async () => {
    const store = fakeStore({ async listProviders() { return [{ provider_key: 'openai', state: 'configured_unverified', capabilities: ['reasoning'], last_verified_at: null }]; } });
    const handler = createAtlasExecutionHandler({ resolveContext: async () => context(), store, randomUUID: crypto.randomUUID });
    const response = await handler(new Request('https://example.test/functions/v1/atlas-execution?api=status', { headers: { authorization: 'Bearer test' } }));
    const body = await response.json();
    expect(body.providers).toEqual([{ provider_key: 'openai', state: 'configured_unverified', capabilities: ['reasoning'], last_verified_at: null }]);
    expect(JSON.stringify(body)).not.toContain('"state":"verified"');
  });

  it('never echoes authorization secrets in error payloads', async () => {
    const secret = 'Bearer super-secret-token';
    const handler = createAtlasExecutionHandler({
      resolveContext: async () => { throw Object.assign(new Error('identity_unavailable'), { code: 'identity_unavailable', status: 502, authorization: secret }); },
      store: fakeStore(), randomUUID: crypto.randomUUID
    });
    const response = await handler(new Request('https://example.test/functions/v1/atlas-execution?api=create', { method: 'POST', headers: { authorization: secret } }));
    const text = await response.text();
    expect(text).not.toContain('super-secret-token');
    expect(text).not.toContain('authorization');
  });
});
