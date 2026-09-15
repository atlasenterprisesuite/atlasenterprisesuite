import { describe, expect, it } from 'vitest';
import {
  handleAtlasCrmHubSpotRequest,
  type AtlasCrmHubSpotDependencies
} from '../../supabase/functions/atlas-crm-hubspot/index';
import {
  refreshHubSpotConnectionCredential,
  type HubSpotLifecycleDependencies,
  type HubSpotLifecycleOAuth
} from '../../supabase/functions/_shared/hubspot-connection-lifecycle';
import {
  type HubSpotConnectionRow,
  type HubSpotConnectionStore,
  type HubSpotCredentialRow,
  type HubSpotEvidenceInput,
  type HubSpotOAuthStateRow,
  type HubSpotStoredCredentialInput,
  type HubSpotConnectionUpsert
} from '../../supabase/functions/_shared/hubspot-connection-store';
import { HubSpotOAuthError } from '../../supabase/functions/_shared/hubspot-oauth';

const organizationId = '11111111-1111-4111-8111-111111111111';
const otherOrganizationId = '22222222-2222-4222-8222-222222222222';
const validToken = 'fake-atlas-session-token';
const allowedOrigin = 'https://www.atlasenterprisesuite.com';
const credentialKey = new Uint8Array(32).fill(7);

class MemoryConnectionStore implements HubSpotConnectionStore {
  stateSequence = 0;
  credentialSequence = 0;
  connectionSequence = 0;
  readonly states = new Map<string, HubSpotOAuthStateRow>();
  readonly stateHashes = new Map<string, string>();
  readonly credentials = new Map<string, HubSpotCredentialRow>();
  readonly connections = new Map<string, HubSpotConnectionRow>();
  readonly evidence: HubSpotEvidenceInput[] = [];

  async createOAuthState(input: {
    organizationId: string;
    userId: string;
    nonceHash: string;
    requestedPermissions: string[];
    expiresAt: string;
  }): Promise<void> {
    const id = `state-${++this.stateSequence}`;
    this.states.set(id, {
      id,
      org_id: input.organizationId,
      user_id: input.userId,
      requested_permissions: [...input.requestedPermissions],
      expires_at: input.expiresAt,
      consumed_at: null
    });
    this.stateHashes.set(input.nonceHash, id);
  }

  async findOAuthState(nonceHash: string): Promise<HubSpotOAuthStateRow | null> {
    const id = this.stateHashes.get(nonceHash);
    return id ? this.states.get(id) ?? null : null;
  }

  async consumeOAuthState(id: string, consumedAt: string): Promise<boolean> {
    const row = this.states.get(id);
    if (!row || row.consumed_at) return false;
    row.consumed_at = consumedAt;
    return true;
  }

  async insertCredential(input: HubSpotStoredCredentialInput): Promise<HubSpotCredentialRow> {
    const row: HubSpotCredentialRow = {
      id: `credential-${++this.credentialSequence}`,
      ...input
    };
    this.credentials.set(row.id, row);
    return row;
  }

  async updateCredential(
    id: string,
    organization: string,
    input: HubSpotStoredCredentialInput
  ): Promise<boolean> {
    const row = this.credentials.get(id);
    if (!row || row.org_id !== organization) return false;
    this.credentials.set(id, { id, ...input });
    return true;
  }

  async deleteCredential(id: string, organization: string): Promise<void> {
    const row = this.credentials.get(id);
    if (row?.org_id === organization) this.credentials.delete(id);
  }

  async getCredential(id: string, organization: string): Promise<HubSpotCredentialRow | null> {
    const row = this.credentials.get(id);
    return row?.org_id === organization ? row : null;
  }

  async upsertConnection(input: HubSpotConnectionUpsert): Promise<HubSpotConnectionRow> {
    const existing = this.connections.get(input.org_id);
    const row: HubSpotConnectionRow = {
      id: existing?.id ?? `connection-${++this.connectionSequence}`,
      ...input
    };
    this.connections.set(input.org_id, row);
    return row;
  }

  async getConnection(organization: string): Promise<HubSpotConnectionRow | null> {
    return this.connections.get(organization) ?? null;
  }

  async updateConnection(
    organization: string,
    patch: Partial<Omit<HubSpotConnectionRow, 'id' | 'org_id' | 'provider'>>
  ): Promise<HubSpotConnectionRow | null> {
    const row = this.connections.get(organization);
    if (!row) return null;
    const updated = { ...row, ...patch };
    this.connections.set(organization, updated);
    return updated;
  }

  async recordEvidence(input: HubSpotEvidenceInput): Promise<void> {
    this.evidence.push({ ...input });
  }
}

type OAuthMode = {
  exchangeFails?: boolean;
  introspectionFails?: boolean;
  inactive?: boolean;
  refreshFails?: boolean;
  revokeFails?: boolean;
};

function fakeOAuth(mode: OAuthMode = {}): HubSpotLifecycleOAuth {
  return {
    buildAuthorizationUrl(input) {
      const url = new URL('https://app.hubspot.com/oauth/authorize');
      url.searchParams.set('client_id', input.clientId);
      url.searchParams.set('redirect_uri', input.redirectUri);
      url.searchParams.set('scope', input.scopes.join(' '));
      url.searchParams.set('state', input.state);
      return url.toString();
    },
    async exchangeCode() {
      if (mode.exchangeFails) {
        throw new HubSpotOAuthError({ code: 'invalid_grant', status: 400 });
      }
      return {
        accessToken: 'fake-provider-access-token',
        refreshToken: 'fake-provider-refresh-token',
        tokenType: 'Bearer',
        expiresIn: 1800,
        hubId: '247228429',
        userId: '98173214',
        scopes: ['oauth', 'crm.objects.contacts.read', 'crm.objects.companies.read', 'crm.objects.deals.read', 'tickets']
      };
    },
    async introspectToken() {
      if (mode.introspectionFails) {
        throw new HubSpotOAuthError({ code: 'upstream_unavailable', status: 503 });
      }
      return {
        active: mode.inactive !== true,
        hubId: '247228429',
        userId: '98173214',
        clientId: 'client-id',
        hubDomain: 'example.test',
        scopes: ['oauth', 'crm.objects.contacts.read', 'crm.objects.companies.read', 'crm.objects.deals.read', 'tickets'],
        tokenUse: 'access_token',
        tokenType: 'Bearer',
        expiresIn: 1700
      };
    },
    async refreshToken() {
      if (mode.refreshFails) {
        throw new HubSpotOAuthError({ code: 'invalid_grant', status: 400 });
      }
      return {
        accessToken: 'fake-provider-access-token-refreshed',
        refreshToken: 'fake-provider-refresh-token',
        tokenType: 'Bearer',
        expiresIn: 1800,
        hubId: '247228429',
        userId: '98173214',
        scopes: ['oauth', 'crm.objects.contacts.read']
      };
    },
    async revokeToken() {
      if (mode.revokeFails) {
        throw new HubSpotOAuthError({ code: 'upstream_unavailable', status: 503 });
      }
    }
  };
}

function fakeAdapter(input: { ready?: boolean; accountId?: string } = {}) {
  return {
    async readiness() {
      if (input.ready === false) {
        return {
          ready: false,
          account: null,
          error: { code: 'forbidden_scope' as const, message: 'forbidden' }
        };
      }
      return {
        ready: true,
        account: {
          id: input.accountId ?? '247228429',
          label: 'app-na2.hubspot.com',
          accountType: 'STANDARD',
          timeZone: 'US/Eastern',
          companyCurrency: 'USD',
          dataHostingLocation: 'na1'
        },
        error: null
      };
    }
  };
}

function dependencies(input: {
  sessionValid?: boolean;
  permissions?: readonly string[];
  onFetch?: (url: string, init?: RequestInit) => void;
  connectionStore?: HubSpotConnectionStore;
  oauth?: HubSpotLifecycleOAuth;
  adapter?: ReturnType<typeof fakeAdapter>;
  now?: () => number;
  randomBytes?: (length: number) => Uint8Array;
  configured?: boolean;
} = {}): AtlasCrmHubSpotDependencies {
  const granted = new Set(input.permissions ?? []);
  const configured = input.configured ?? true;
  return {
    env: (name) => {
      const values: Record<string, string> = {
        SUPABASE_URL: 'https://atlas-test.supabase.co',
        SUPABASE_ANON_KEY: 'fake-publishable-key',
        SUPABASE_SERVICE_ROLE_KEY: 'fake-service-role-must-not-be-used-by-request-gates',
        HUBSPOT_CLIENT_ID: configured ? 'client-id' : '',
        HUBSPOT_CLIENT_SECRET: configured ? 'fake-client-secret' : '',
        HUBSPOT_REDIRECT_URI: configured
          ? 'https://atlas-test.supabase.co/functions/v1/atlas-crm-hubspot'
          : '',
        ATLAS_INTEGRATION_CREDENTIAL_KEY_VERSION: 'test-v1'
      };
      return values[name];
    },
    connectionStore: input.connectionStore,
    lifecycle: {
      credentialKey,
      oauth: input.oauth ?? fakeOAuth(),
      adapter: input.adapter ?? fakeAdapter(),
      now: input.now,
      randomBytes:
        input.randomBytes ?? ((length) => new Uint8Array(length).fill(9))
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
  url?: string;
}) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (input.origin !== null) headers.set('Origin', input.origin ?? allowedOrigin);
  if (input.token) headers.set('Authorization', `Bearer ${input.token}`);
  const method = input.method ?? 'POST';
  const request = new Request(
    input.url ?? 'https://atlas-test.local/functions/v1/atlas-crm-hubspot',
    {
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
    }
  );
  return handleAtlasCrmHubSpotRequest(request, input.deps ?? dependencies());
}

async function prepareState(input: {
  store: MemoryConnectionStore;
  deps?: AtlasCrmHubSpotDependencies;
  organization?: string;
}) {
  const deps = input.deps ??
    dependencies({
      permissions: ['integrations.admin'],
      connectionStore: input.store
    });
  const response = await invoke({
    operation: 'oauth.prepare',
    token: validToken,
    organization: input.organization ?? organizationId,
    deps
  });
  expect(response.status).toBe(200);
  const body = (await response.json()) as { authorizationUrl: string };
  return {
    deps,
    state: new URL(body.authorizationUrl).searchParams.get('state')!
  };
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

  it('rejects GET except for OAuth callback parameters', async () => {
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
  });

  it('uses integrations.manage only as the deprecated integration-admin alias', async () => {
    const store = new MemoryConnectionStore();
    const integrationOperation = await invoke({
      operation: 'connection.status',
      token: validToken,
      deps: dependencies({
        permissions: ['integrations.manage'],
        connectionStore: store
      })
    });
    expect(integrationOperation.status).toBe(200);

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
  });
});

describe('ATLAS CRM HubSpot connection lifecycle', () => {
  it('creates one-time OAuth state and returns only a provider authorization URL', async () => {
    const store = new MemoryConnectionStore();
    const { state } = await prepareState({ store });
    expect(state).toBeTruthy();
    expect(store.states.size).toBe(1);
    expect(JSON.stringify([...store.states.values()])).not.toContain(state);
    expect([...store.states.values()][0].requested_permissions).toEqual(
      expect.arrayContaining(['crm.objects.contacts.read', 'crm.objects.companies.read'])
    );
  });

  it('accepts the real GET callback flow and reports connected only after introspection and CRM readiness', async () => {
    const store = new MemoryConnectionStore();
    const { deps, state } = await prepareState({ store });
    const response = await invoke({
      method: 'GET',
      origin: null,
      deps,
      url: `https://atlas-test.local/functions/v1/atlas-crm-hubspot?code=fake-code&state=${encodeURIComponent(state)}`
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      connection: {
        provider: 'hubspot',
        state: 'connected',
        providerAccountId: '247228429',
        providerAccountLabel: 'app-na2.hubspot.com'
      }
    });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('fake-provider-access-token');
    expect(serialized).not.toContain('fake-provider-refresh-token');
    expect(store.credentials.size).toBe(1);
    expect(store.connections.get(organizationId)?.state).toBe('connected');
    expect([...store.states.values()][0].consumed_at).not.toBeNull();
  });

  it('rejects expired and already-consumed OAuth states', async () => {
    let clock = Date.parse('2026-09-15T12:00:00Z');
    const store = new MemoryConnectionStore();
    const deps = dependencies({
      permissions: ['integrations.admin'],
      connectionStore: store,
      now: () => clock
    });
    const prepared = await prepareState({ store, deps });
    clock += 11 * 60 * 1000;
    const expired = await invoke({
      method: 'GET',
      origin: null,
      deps,
      url: `https://atlas-test.local/functions/v1/atlas-crm-hubspot?code=fake-code&state=${encodeURIComponent(prepared.state)}`
    });
    expect(expired.status).toBe(400);
    expect(await expired.json()).toMatchObject({ code: 'oauth_state_expired' });

    clock -= 11 * 60 * 1000;
    const secondStore = new MemoryConnectionStore();
    const second = await prepareState({ store: secondStore });
    const stateRow = [...secondStore.states.values()][0];
    stateRow.consumed_at = new Date(clock).toISOString();
    const consumed = await invoke({
      method: 'GET',
      origin: null,
      deps: second.deps,
      url: `https://atlas-test.local/functions/v1/atlas-crm-hubspot?code=fake-code&state=${encodeURIComponent(second.state)}`
    });
    expect(consumed.status).toBe(400);
    expect(await consumed.json()).toMatchObject({ code: 'oauth_state_consumed' });
  });

  it('binds callback completion to the organization stored in state rather than caller input', async () => {
    const store = new MemoryConnectionStore();
    const prepared = await prepareState({ store, organization: otherOrganizationId });
    const response = await invoke({
      method: 'GET',
      origin: null,
      deps: prepared.deps,
      url: `https://atlas-test.local/functions/v1/atlas-crm-hubspot?code=fake-code&state=${encodeURIComponent(prepared.state)}`
    });
    expect(response.status).toBe(200);
    expect(store.connections.has(otherOrganizationId)).toBe(true);
    expect(store.connections.has(organizationId)).toBe(false);
  });

  it('never reports connected when token exchange fails', async () => {
    const store = new MemoryConnectionStore();
    const deps = dependencies({
      permissions: ['integrations.admin'],
      connectionStore: store,
      oauth: fakeOAuth({ exchangeFails: true })
    });
    const prepared = await prepareState({ store, deps });
    const response = await invoke({
      method: 'GET',
      origin: null,
      deps,
      url: `https://atlas-test.local/functions/v1/atlas-crm-hubspot?code=fake-code&state=${encodeURIComponent(prepared.state)}`
    });
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: 'oauth_exchange_failed' });
    expect(store.connections.size).toBe(0);
    expect(store.credentials.size).toBe(0);
  });

  it('never reports connected when introspection or provider readiness fails', async () => {
    for (const variant of [
      { oauth: fakeOAuth({ inactive: true }), adapter: fakeAdapter() },
      { oauth: fakeOAuth(), adapter: fakeAdapter({ ready: false }) },
      { oauth: fakeOAuth(), adapter: fakeAdapter({ accountId: 'different-account' }) }
    ]) {
      const store = new MemoryConnectionStore();
      const deps = dependencies({
        permissions: ['integrations.admin'],
        connectionStore: store,
        oauth: variant.oauth,
        adapter: variant.adapter
      });
      const prepared = await prepareState({ store, deps });
      const response = await invoke({
        method: 'GET',
        origin: null,
        deps,
        url: `https://atlas-test.local/functions/v1/atlas-crm-hubspot?code=fake-code&state=${encodeURIComponent(prepared.state)}`
      });
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(store.connections.get(organizationId)?.state).not.toBe('connected');
      expect(store.credentials.size).toBe(0);
    }
  });

  it('transitions to expired when a refresh token is rejected', async () => {
    let clock = Date.parse('2026-09-15T12:00:00Z');
    const store = new MemoryConnectionStore();
    const oauth = fakeOAuth();
    const deps = dependencies({
      permissions: ['integrations.admin'],
      connectionStore: store,
      oauth,
      now: () => clock
    });
    const prepared = await prepareState({ store, deps });
    const connected = await invoke({
      method: 'GET',
      origin: null,
      deps,
      url: `https://atlas-test.local/functions/v1/atlas-crm-hubspot?code=fake-code&state=${encodeURIComponent(prepared.state)}`
    });
    expect(connected.status).toBe(200);

    clock += 31 * 60 * 1000;
    const lifecycle: HubSpotLifecycleDependencies = {
      store,
      clientId: 'client-id',
      clientSecret: 'fake-client-secret',
      redirectUri: 'https://atlas-test.local/callback',
      credentialKey,
      keyVersion: 'test-v1',
      oauth: fakeOAuth({ refreshFails: true }),
      adapter: fakeAdapter(),
      now: () => clock
    };
    await expect(
      refreshHubSpotConnectionCredential({
        organizationId,
        actorUserId: 'user-a',
        deps: lifecycle
      })
    ).rejects.toMatchObject({ code: 'credential_refresh_failed' });
    expect(store.connections.get(organizationId)?.state).toBe('expired');
  });

  it('disconnects locally even when remote revoke fails and never returns credential material', async () => {
    const store = new MemoryConnectionStore();
    const oauth = fakeOAuth();
    const deps = dependencies({
      permissions: ['integrations.admin'],
      connectionStore: store,
      oauth
    });
    const prepared = await prepareState({ store, deps });
    const connected = await invoke({
      method: 'GET',
      origin: null,
      deps,
      url: `https://atlas-test.local/functions/v1/atlas-crm-hubspot?code=fake-code&state=${encodeURIComponent(prepared.state)}`
    });
    expect(connected.status).toBe(200);
    expect(store.credentials.size).toBe(1);

    const disconnectDeps = dependencies({
      permissions: ['integrations.admin'],
      connectionStore: store,
      oauth: fakeOAuth({ revokeFails: true })
    });
    const disconnected = await invoke({
      operation: 'connection.disconnect',
      token: validToken,
      deps: disconnectDeps
    });
    expect(disconnected.status).toBe(200);
    const body = await disconnected.json();
    expect(body).toMatchObject({
      connection: { state: 'revoked', safeErrorCode: 'remote_revoke_failed' }
    });
    expect(JSON.stringify(body)).not.toMatch(/accessToken|refreshToken|fake-provider/i);
    expect(store.credentials.size).toBe(0);
    expect(store.connections.get(organizationId)?.credential_ref).toBeNull();
  });
});
