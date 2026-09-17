import { describe, expect, it } from 'vitest';
import {
  handleAtlasCrmHubSpotRequest,
  type AtlasCrmHubSpotDependencies
} from '../../supabase/functions/atlas-crm-hubspot/index';
import type {
  HubSpotConnectionRow,
  HubSpotConnectionStore,
  HubSpotCredentialRow,
  HubSpotEvidenceInput,
  HubSpotOAuthStateRow,
  HubSpotStoredCredentialInput,
  HubSpotConnectionUpsert
} from '../../supabase/functions/_shared/hubspot-connection-store';

const organizationId = '11111111-1111-4111-8111-111111111111';
const validToken = 'fake-atlas-session-token';
const allowedOrigin = 'https://www.atlasenterprisesuite.com';
const credentialKey = new Uint8Array(32).fill(7);

class MemoryConnectionStore implements HubSpotConnectionStore {
  async createOAuthState(): Promise<void> {}
  async findOAuthState(): Promise<HubSpotOAuthStateRow | null> { return null; }
  async consumeOAuthState(): Promise<boolean> { return false; }
  async insertCredential(input: HubSpotStoredCredentialInput): Promise<HubSpotCredentialRow> {
    return { id: 'credential-1', ...input };
  }
  async updateCredential(): Promise<boolean> { return false; }
  async deleteCredential(): Promise<void> {}
  async getCredential(): Promise<HubSpotCredentialRow | null> { return null; }
  async upsertConnection(input: HubSpotConnectionUpsert): Promise<HubSpotConnectionRow> {
    return { id: 'connection-1', ...input };
  }
  async getConnection(): Promise<HubSpotConnectionRow | null> { return null; }
  async updateConnection(): Promise<HubSpotConnectionRow | null> { return null; }
  async recordEvidence(_input: HubSpotEvidenceInput): Promise<void> {}
}

function dependencies(input: {
  sessionValid?: boolean;
  permissions?: readonly string[];
  store?: HubSpotConnectionStore;
  onFetch?: (url: string, init?: RequestInit) => void;
} = {}): AtlasCrmHubSpotDependencies {
  const granted = new Set(input.permissions ?? []);
  return {
    connectionStore: input.store ?? new MemoryConnectionStore(),
    lifecycle: { credentialKey },
    env: (name) => ({
      SUPABASE_URL: 'https://atlas-test.supabase.co',
      SUPABASE_ANON_KEY: 'fake-publishable-key',
      HUBSPOT_CLIENT_ID: 'fake-client-id',
      HUBSPOT_CLIENT_SECRET: 'fake-client-secret',
      HUBSPOT_REDIRECT_URI: 'https://atlas.test/callback'
    } as Record<string, string>)[name],
    fetchImpl: async (resource, init) => {
      const url = String(resource);
      input.onFetch?.(url, init);
      if (url.endsWith('/auth/v1/user')) {
        return input.sessionValid === false
          ? new Response('{}', { status: 401 })
          : new Response(JSON.stringify({ id: 'user-a' }), { status: 200 });
      }
      if (url.endsWith('/rest/v1/rpc/has_identity_permission')) {
        const body = JSON.parse(String(init?.body)) as { p?: string };
        return new Response(JSON.stringify(granted.has(body.p ?? '')), { status: 200 });
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
}) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (input.origin !== null) headers.set('Origin', input.origin ?? allowedOrigin);
  if (input.token) headers.set('Authorization', `Bearer ${input.token}`);
  const method = input.method ?? 'POST';
  const request = new Request('https://atlas.test/functions/v1/atlas-crm-hubspot', {
    method,
    headers,
    body: method === 'POST' ? JSON.stringify({
      operation: input.operation,
      organizationId: input.organization ?? organizationId
    }) : undefined
  });
  return handleAtlasCrmHubSpotRequest(request, input.deps ?? dependencies());
}

describe('ATLAS CRM HubSpot Edge Function security boundary', () => {
  it('allows CORS preflight only for approved ATLAS origins', async () => {
    const allowed = await invoke({ method: 'OPTIONS', origin: allowedOrigin });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe(allowedOrigin);

    const denied = await invoke({ method: 'OPTIONS', origin: 'https://untrusted.example' });
    expect(denied.status).toBe(403);
  });

  it('requires bearer auth and a valid organization UUID', async () => {
    expect((await invoke({ operation: 'crm.list', token: null })).status).toBe(401);
    expect((await invoke({
      operation: 'crm.list',
      token: validToken,
      organization: 'not-a-uuid'
    })).status).toBe(400);
  });

  it('rejects invalid sessions and unknown operations before provider work', async () => {
    expect((await invoke({
      operation: 'crm.list',
      token: validToken,
      deps: dependencies({ sessionValid: false })
    })).status).toBe(401);

    let fetchCount = 0;
    const unknown = await invoke({
      operation: 'unknown',
      token: validToken,
      deps: dependencies({ onFetch: () => { fetchCount += 1; } })
    });
    expect(unknown.status).toBe(400);
    expect(fetchCount).toBe(0);
  });

  it('keeps integration-admin compatibility separate from CRM read permission', async () => {
    const status = await invoke({
      operation: 'connection.status',
      token: validToken,
      deps: dependencies({ permissions: ['integrations.manage'] })
    });
    expect(status.status).toBe(200);
    expect(await status.json()).toMatchObject({ connection: { state: 'unconfigured' } });

    const crm = await invoke({
      operation: 'crm.list',
      token: validToken,
      deps: dependencies({ permissions: ['integrations.manage'] })
    });
    expect(crm.status).toBe(403);
  });

  it('requires crm.sync for refresh operations', async () => {
    const denied = await invoke({
      operation: 'crm.refresh',
      token: validToken,
      deps: dependencies({ permissions: ['crm.read'] })
    });
    expect(denied.status).toBe(403);
  });
});
