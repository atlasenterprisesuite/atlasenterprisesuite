import { describe, expect, it } from 'vitest';
import {
  handleAtlasCrmSalesforceRequest,
  type AtlasCrmSalesforceDependencies
} from '../../supabase/functions/atlas-crm-salesforce/index';
import type {
  SalesforceConnectionRow,
  SalesforceConnectionStore,
  SalesforceCredentialRow,
  SalesforceEvidenceInput,
  SalesforceExternalObjectLinkInput,
  SalesforceOAuthStateRow,
  SalesforceStoredCredentialInput,
  SalesforceConnectionUpsert
} from '../../supabase/functions/_shared/salesforce-connection-store';

const organizationId = '11111111-1111-4111-8111-111111111111';
const token = 'fake-atlas-session';
const allowedOrigin = 'https://www.atlasenterprisesuite.com';

class Store implements SalesforceConnectionStore {
  oauthStates: Array<{
    organizationId: string;
    userId: string;
    nonceHash: string;
    requestedPermissions: string[];
    expiresAt: string;
  }> = [];

  async createOAuthState(input: {
    organizationId: string;
    userId: string;
    nonceHash: string;
    requestedPermissions: string[];
    expiresAt: string;
  }): Promise<void> {
    this.oauthStates.push({ ...input, requestedPermissions: [...input.requestedPermissions] });
  }
  async findOAuthState(): Promise<SalesforceOAuthStateRow | null> { return null; }
  async consumeOAuthState(): Promise<boolean> { return false; }
  async insertCredential(input: SalesforceStoredCredentialInput): Promise<SalesforceCredentialRow> {
    return { id: 'credential-1', ...input };
  }
  async updateCredential(): Promise<boolean> { return false; }
  async deleteCredential(): Promise<void> {}
  async getCredential(): Promise<SalesforceCredentialRow | null> { return null; }
  async upsertConnection(input: SalesforceConnectionUpsert): Promise<SalesforceConnectionRow> {
    return {
      id: 'connection-1',
      provider: 'salesforce',
      authorized: input.state === 'connected',
      provider_verified: input.state === 'connected',
      ...input
    };
  }
  async listConnections(): Promise<SalesforceConnectionRow[]> { return []; }
  async getConnectionById(): Promise<SalesforceConnectionRow | null> { return null; }
  async getConnectionByProviderAccountId(): Promise<SalesforceConnectionRow | null> { return null; }
  async updateConnectionById(): Promise<SalesforceConnectionRow | null> { return null; }
  async recordEvidence(_input: SalesforceEvidenceInput): Promise<void> {}
  async upsertObjectLinks(_inputs: readonly SalesforceExternalObjectLinkInput[]): Promise<void> {}
}

function dependencies(input: {
  permissions?: readonly string[];
  sessionValid?: boolean;
  store?: Store;
} = {}): AtlasCrmSalesforceDependencies {
  const granted = new Set(input.permissions ?? []);
  return {
    connectionStore: input.store ?? new Store(),
    lifecycle: {
      credentialKey: new Uint8Array(32).fill(7),
      now: () => Date.parse('2026-10-07T12:00:00Z'),
      randomBytes: (length) => new Uint8Array(length).fill(3)
    },
    env: (name) => ({
      SUPABASE_URL: 'https://atlas-test.supabase.co',
      SUPABASE_ANON_KEY: 'fake-publishable-key',
      SALESFORCE_CLIENT_ID: 'fake-client-id',
      SALESFORCE_CLIENT_SECRET: 'fake-client-secret',
      SALESFORCE_REDIRECT_URI: 'https://atlas-test.supabase.co/functions/v1/atlas-crm-salesforce',
      SALESFORCE_LOGIN_BASE_URL: 'https://login.salesforce.com',
      SALESFORCE_API_VERSION: 'v68.0'
    } as Record<string, string>)[name],
    fetchImpl: async (resource, init) => {
      const url = String(resource);
      if (url.endsWith('/auth/v1/user')) {
        return input.sessionValid === false
          ? new Response('{}', { status: 401 })
          : new Response(JSON.stringify({ id: 'user-a' }), { status: 200 });
      }
      if (url.endsWith('/rest/v1/rpc/has_identity_permission')) {
        const body = JSON.parse(String(init?.body)) as { p?: string };
        return new Response(JSON.stringify(granted.has(body.p ?? '')), { status: 200 });
      }
      throw new Error(`unexpected fetch ${url}`);
    }
  };
}

async function invoke(input: {
  operation?: string;
  method?: string;
  origin?: string | null;
  tokenValue?: string | null;
  organization?: unknown;
  deps?: AtlasCrmSalesforceDependencies;
  payload?: Record<string, unknown>;
  query?: Record<string, string>;
}) {
  const headers = new Headers();
  if (input.origin !== null) headers.set('Origin', input.origin ?? allowedOrigin);
  if (input.tokenValue !== null) headers.set('Authorization', `Bearer ${input.tokenValue ?? token}`);
  headers.set('Content-Type', 'application/json');
  const url = new URL('https://atlas-test.supabase.co/functions/v1/atlas-crm-salesforce');
  for (const [key, value] of Object.entries(input.query ?? {})) url.searchParams.set(key, value);
  const method = input.method ?? 'POST';
  const request = new Request(url, {
    method,
    headers,
    body: method === 'POST' ? JSON.stringify({
      operation: input.operation,
      organizationId: input.organization ?? organizationId,
      ...(input.payload ?? {})
    }) : undefined
  });
  return handleAtlasCrmSalesforceRequest(request, input.deps ?? dependencies());
}

describe('ATLAS CRM Salesforce Edge Function security boundary', () => {
  it('allows CORS only for approved ATLAS origins', async () => {
    const allowed = await invoke({ method: 'OPTIONS', origin: allowedOrigin });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe(allowedOrigin);

    const denied = await invoke({
      method: 'OPTIONS',
      origin: 'https://untrusted.example'
    });
    expect(denied.status).toBe(403);
  });

  it('requires an authenticated ATLAS session and organization-scoped permission', async () => {
    expect((await invoke({ operation: 'connection.status', tokenValue: null })).status).toBe(401);

    const invalid = await invoke({
      operation: 'connection.status',
      deps: dependencies({ sessionValid: false })
    });
    expect(invalid.status).toBe(401);

    const denied = await invoke({
      operation: 'connection.status',
      deps: dependencies({ permissions: [] })
    });
    expect(denied.status).toBe(403);
  });

  it('returns fail-closed unconfigured status when no verified Salesforce org exists', async () => {
    const response = await invoke({
      operation: 'connection.status',
      deps: dependencies({ permissions: ['integrations.read'] })
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      connection: { provider: 'salesforce', state: 'unconfigured' },
      candidateCount: 0,
      canonicalRequired: false
    });
  });

  it('prepares Salesforce authorization without exposing client secrets', async () => {
    const store = new Store();
    const response = await invoke({
      operation: 'oauth.prepare',
      deps: dependencies({ permissions: ['integrations.admin'], store })
    });
    expect(response.status).toBe(200);
    const body = await response.json() as { authorizationUrl: string };
    const url = new URL(body.authorizationUrl);
    expect(url.origin).toBe('https://login.salesforce.com');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.has('client_secret')).toBe(false);
    expect(store.oauthStates).toHaveLength(1);
    expect(store.oauthStates[0].requestedPermissions).toEqual(['api', 'refresh_token']);
  });

  it('returns OAuth callbacks to the canonical ATLAS Salesforce route on invalid state', async () => {
    const response = await invoke({
      method: 'GET',
      tokenValue: null,
      origin: null,
      query: { state: 'invalid-state', code: 'authorization-code' },
      deps: dependencies()
    });
    expect(response.status).toBe(303);
    const location = response.headers.get('location') ?? '';
    expect(location).toContain('https://www.atlasenterprisesuite.com/crm/integrations/salesforce');
    expect(location).toContain('oauth=error');
    expect(location).toContain('code=oauth_state_invalid');
  });
});
