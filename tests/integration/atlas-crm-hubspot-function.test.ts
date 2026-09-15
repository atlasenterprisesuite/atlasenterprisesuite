import { describe, expect, it } from 'vitest';
import {
  handleAtlasCrmHubSpotRequest,
  type AtlasCrmHubSpotDependencies
} from '../../supabase/functions/atlas-crm-hubspot/index';

const organizationId = '11111111-1111-4111-8111-111111111111';
const validToken = 'fake-atlas-session-token';
const allowedOrigin = 'https://www.atlasenterprisesuite.com';

function dependencies(input: {
  sessionValid?: boolean;
  permissions?: readonly string[];
  onFetch?: (url: string, init?: RequestInit) => void;
} = {}): AtlasCrmHubSpotDependencies {
  const granted = new Set(input.permissions ?? []);
  return {
    env: (name) => {
      const values: Record<string, string> = {
        SUPABASE_URL: 'https://atlas-test.supabase.co',
        SUPABASE_ANON_KEY: 'fake-publishable-key',
        SUPABASE_SERVICE_ROLE_KEY: 'fake-service-role-must-not-be-used-by-request-gates'
      };
      return values[name];
    },
    fetchImpl: async (resource, init) => {
      const url = String(resource);
      input.onFetch?.(url, init);
      if (url.endsWith('/auth/v1/user')) {
        return input.sessionValid === false
          ? new Response(JSON.stringify({ message: 'invalid' }), { status: 401 })
          : new Response(JSON.stringify({ id: 'user-a' }), {
              status: 200,
              headers: { 'content-type': 'application/json' }
            });
      }
      if (url.endsWith('/rest/v1/rpc/has_identity_permission')) {
        const body = JSON.parse(String(init?.body)) as { p?: string };
        return new Response(JSON.stringify(granted.has(body.p ?? '')), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }
      throw new Error(`Unexpected test fetch: ${url}`);
    }
  };
}

async function invoke(input: {
  operation?: string;
  token?: string | null;
  organization?: unknown;
  method?: string;
  origin?: string | null;
  deps?: AtlasCrmHubSpotDependencies;
  body?: Record<string, unknown>;
}) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (input.origin !== null) headers.set('Origin', input.origin ?? allowedOrigin);
  if (input.token) headers.set('Authorization', `Bearer ${input.token}`);
  const method = input.method ?? 'POST';
  const request = new Request('https://atlas-test.local/functions/v1/atlas-crm-hubspot', {
    method,
    headers,
    body:
      method === 'POST'
        ? JSON.stringify({
            operation: input.operation,
            organizationId: input.organization ?? organizationId,
            ...(input.body ?? {})
          })
        : undefined
  });
  return handleAtlasCrmHubSpotRequest(request, input.deps ?? dependencies());
}

describe('ATLAS CRM HubSpot Edge Function security boundary', () => {
  it('responds to preflight only for an allowed ATLAS origin', async () => {
    const response = await invoke({ method: 'OPTIONS', origin: allowedOrigin });
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(allowedOrigin);
  });

  it('rejects disallowed origins before processing requests', async () => {
    const response = await invoke({
      operation: 'crm.list',
      token: validToken,
      origin: 'https://evil.example'
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Origin not allowed' });
  });

  it('rejects unsupported methods', async () => {
    const response = await invoke({ method: 'GET', token: validToken });
    expect(response.status).toBe(405);
  });

  it('rejects unknown operations before authentication work', async () => {
    let fetchCount = 0;
    const response = await invoke({
      operation: 'unknown',
      token: validToken,
      deps: dependencies({ onFetch: () => fetchCount++ })
    });
    expect(response.status).toBe(400);
    expect(fetchCount).toBe(0);
  });

  it('requires bearer authentication for authenticated operations', async () => {
    const response = await invoke({ operation: 'crm.list', token: null });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Authentication required' });
  });

  it('rejects invalid organization identifiers before session lookup', async () => {
    let fetchCount = 0;
    const response = await invoke({
      operation: 'crm.list',
      token: validToken,
      organization: 'not-a-uuid',
      deps: dependencies({ onFetch: () => fetchCount++ })
    });
    expect(response.status).toBe(400);
    expect(fetchCount).toBe(0);
  });

  it('rejects invalid or expired ATLAS sessions', async () => {
    const response = await invoke({
      operation: 'crm.list',
      token: validToken,
      deps: dependencies({ sessionValid: false })
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Invalid or expired ATLAS session' });
  });

  it('enforces CRM read permission for provider-backed reads', async () => {
    const denied = await invoke({
      operation: 'crm.list',
      token: validToken,
      deps: dependencies({ permissions: [] })
    });
    expect(denied.status).toBe(403);

    const allowed = await invoke({
      operation: 'crm.list',
      token: validToken,
      deps: dependencies({ permissions: ['crm.read'] })
    });
    expect(allowed.status).toBe(501);
    expect(await allowed.json()).toMatchObject({ operation: 'crm.list' });
  });

  it('accepts crm.admin as the CRM namespace admin permission', async () => {
    const response = await invoke({
      operation: 'crm.search',
      token: validToken,
      deps: dependencies({ permissions: ['crm.admin'] })
    });
    expect(response.status).toBe(501);
  });

  it('uses integrations.manage only as the deprecated integration-admin alias', async () => {
    const integrationOperation = await invoke({
      operation: 'oauth.prepare',
      token: validToken,
      deps: dependencies({ permissions: ['integrations.manage'] })
    });
    expect(integrationOperation.status).toBe(501);

    const crmOperation = await invoke({
      operation: 'crm.list',
      token: validToken,
      deps: dependencies({ permissions: ['integrations.manage'] })
    });
    expect(crmOperation.status).toBe(403);
  });

  it('requires crm.sync or crm.admin for manual refresh metadata operations', async () => {
    const denied = await invoke({
      operation: 'crm.refresh',
      token: validToken,
      deps: dependencies({ permissions: ['crm.read'] })
    });
    expect(denied.status).toBe(403);

    const allowed = await invoke({
      operation: 'crm.refresh',
      token: validToken,
      deps: dependencies({ permissions: ['crm.sync'] })
    });
    expect(allowed.status).toBe(501);
  });

  it('never sends the service-role key during browser request authentication gates', async () => {
    const seenAuthorization: string[] = [];
    const seenApiKeys: string[] = [];
    await invoke({
      operation: 'crm.list',
      token: validToken,
      deps: dependencies({
        permissions: ['crm.read'],
        onFetch: (_url, init) => {
          const headers = new Headers(init?.headers);
          seenAuthorization.push(headers.get('Authorization') ?? '');
          seenApiKeys.push(headers.get('apikey') ?? '');
        }
      })
    });

    expect(seenAuthorization.every((value) => value === `Bearer ${validToken}`)).toBe(true);
    expect(seenApiKeys.every((value) => value === 'fake-publishable-key')).toBe(true);
    expect(JSON.stringify({ seenAuthorization, seenApiKeys })).not.toContain(
      'fake-service-role-must-not-be-used-by-request-gates'
    );
  });

  it('reserves oauth.callback for one-time state validation without requiring a bearer session', async () => {
    const response = await invoke({ operation: 'oauth.callback', token: null });
    expect(response.status).toBe(501);
    expect(JSON.stringify(await response.json())).not.toMatch(/accessToken|refreshToken|client_secret/i);
  });
});
