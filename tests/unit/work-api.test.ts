import { describe, expect, it } from 'vitest';
import { normalizeWorkWorkflow, parseWorkResponse } from '../../apps/web/src/work/api';

describe('ATLAS Work web API', () => {
  it('whitelists workflow fields and drops secret-like raw context data', () => {
    const workflow = normalizeWorkWorkflow({
      id: 'wf-1',
      organization_id: 'org-1',
      owner_module: 'manager',
      status: 'now',
      current_task_id: 'task-1',
      current_module: 'manager',
      created_at: '2026-09-12T10:00:00Z',
      updated_at: '2026-09-12T10:05:00Z',
      completed_at: null,
      context: {
        token: 'outer-secret',
        work: {
          executionMode: 'hybrid', autonomyLevel: 'guided', runtimePreference: 'auto',
          budgetLimit: 0, connectionRefs: ['conn-cloudflare'], token: 'inner-secret'
        }
      },
      action_payload: { password: 'must-not-survive' }
    });

    expect(Object.keys(workflow).sort()).toEqual([
      'completedAt', 'createdAt', 'currentModule', 'currentTaskId', 'id',
      'organizationId', 'ownerModule', 'status', 'updatedAt', 'work'
    ]);
    expect(workflow.organizationId).toBe('org-1');
    expect(workflow.work).toEqual({
      executionMode: 'hybrid', autonomyLevel: 'guided', runtimePreference: 'auto',
      budgetLimit: 0, connectionRefs: ['conn-cloudflare']
    });
    expect(JSON.stringify(workflow)).not.toContain('secret');
    expect(JSON.stringify(workflow)).not.toContain('password');
  });

  it('preserves server error codes', async () => {
    const response = new Response(JSON.stringify({ error: 'permission_required' }), { status: 403 });
    await expect(parseWorkResponse(response)).rejects.toThrow('permission_required');
  });
});
