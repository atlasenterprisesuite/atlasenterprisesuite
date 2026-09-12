import { describe, expect, it } from 'vitest';
import { hasExecutionPermission, resolveExecutionContext } from '../../supabase/functions/atlas-execution/atlas-execution-auth.mjs';
import { createExecutionStore, redactExecutionMetadata } from '../../supabase/functions/atlas-execution/atlas-execution-store.mjs';

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER = '22222222-2222-4222-8222-222222222222';
const TRACE = '33333333-3333-4333-8333-333333333333';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

describe('ATLAS universal execution security boundaries', () => {
  it('rejects a requested organization when the authenticated user is not an active member', async () => {
    const request = new Request('https://example.test/functions/v1/atlas-execution?api=workflows', {
      headers: {
        authorization: 'Bearer test-token',
        'x-atlas-org-id': ORG_B
      }
    });

    const fetchFn = async (url: string | URL | Request) => {
      const value = String(url);
      if (value.includes('/auth/v1/user')) return jsonResponse({ id: USER });
      if (value.includes('/rest/v1/organization_members')) {
        return jsonResponse([{ org_id: ORG_A, role: 'member', status: 'active' }]);
      }
      if (value.includes('/rest/v1/identity_role_permissions')) {
        return jsonResponse([{ permission_code: 'workflow.read' }]);
      }
      return jsonResponse({}, 404);
    };

    await expect(resolveExecutionContext({
      request,
      supabaseUrl: 'https://supabase.test',
      publishableKey: 'publishable-test-key',
      fetchFn
    })).rejects.toMatchObject({ code: 'forbidden', status: 403 });
  });

  it('does not let a domain admin cross into workflow approval permissions', () => {
    expect(hasExecutionPermission({ permissions: ['accounting.admin'] }, 'accounting.post')).toBe(true);
    expect(hasExecutionPermission({ permissions: ['accounting.admin'] }, 'workflow.approve')).toBe(false);
  });

  it('scopes store reads to the authenticated organization instead of a foreign organization', async () => {
    const requests: string[] = [];
    const fetchFn = async (url: string | URL | Request) => {
      requests.push(String(url));
      return jsonResponse([]);
    };
    const store = createExecutionStore({
      supabaseUrl: 'https://supabase.test',
      serviceRoleKey: 'service-role-test-key',
      fetchFn
    });

    await expect(store.getWorkflow({ organization_id: ORG_A, user_id: USER }, 'task-from-org-b'))
      .rejects.toMatchObject({ message: 'workflow_not_found' });

    expect(requests).toHaveLength(1);
    expect(requests[0]).toContain(`org_id=eq.${encodeURIComponent(ORG_A)}`);
    expect(requests[0]).not.toContain(ORG_B);
  });

  it('redacts secrets recursively before execution audit metadata is persisted', async () => {
    const writes: any[] = [];
    const fetchFn = async (_url: string | URL | Request, init: RequestInit = {}) => {
      if (init.method === 'POST' && typeof init.body === 'string') writes.push(JSON.parse(init.body));
      return jsonResponse([{}], 201);
    };
    const store = createExecutionStore({
      supabaseUrl: 'https://supabase.test',
      serviceRoleKey: 'service-role-test-key',
      fetchFn
    });

    const unsafeMetadata = {
      safe: 'preserve-me',
      authorization: 'Bearer secret-token',
      service_role: 'service-secret',
      pan: '4111111111111111',
      cvv: '123',
      nested: {
        access_token: 'nested-token',
        refresh_token: 'refresh-token',
        allowed: true
      }
    };

    expect(redactExecutionMetadata(unsafeMetadata)).toEqual({
      safe: 'preserve-me',
      nested: { allowed: true }
    });

    await store.appendEvent(
      { organization_id: ORG_A, user_id: USER },
      {
        task_id: 'task-1',
        step_id: 'step-1',
        trace_id: TRACE,
        event_type: 'security_test',
        authorization_result: 'allowed',
        metadata: unsafeMetadata
      }
    );

    expect(writes).toHaveLength(1);
    expect(writes[0].metadata).toEqual({
      safe: 'preserve-me',
      nested: { allowed: true }
    });

    const serialized = JSON.stringify(writes[0]);
    for (const forbidden of [
      'Bearer secret-token',
      'service-secret',
      '4111111111111111',
      'nested-token',
      'refresh-token',
      '"cvv"',
      '"pan"',
      '"authorization"',
      '"service_role"',
      '"access_token"',
      '"refresh_token"'
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
