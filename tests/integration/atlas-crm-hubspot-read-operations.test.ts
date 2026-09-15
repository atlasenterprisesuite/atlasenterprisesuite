import { describe, expect, it } from 'vitest';
import { sealCredential } from '../../supabase/functions/_shared/integration-credential-vault';
import { HubSpotCrmError } from '../../supabase/functions/_shared/hubspot-crm';
import type { HubSpotCrmReadAdapter } from '../../supabase/functions/_shared/hubspot-crm-operations';
import type {
  HubSpotConnectionRow,
  HubSpotConnectionStore,
  HubSpotCredentialRow,
  HubSpotEvidenceInput,
  HubSpotExternalObjectLinkInput,
  HubSpotOAuthStateRow,
  HubSpotStoredCredentialInput,
  HubSpotConnectionUpsert
} from '../../supabase/functions/_shared/hubspot-connection-store';
import {
  handleAtlasCrmHubSpotRequest,
  type AtlasCrmHubSpotDependencies
} from '../../supabase/functions/atlas-crm-hubspot/index';

const orgA = '11111111-1111-4111-8111-111111111111';
const orgB = '22222222-2222-4222-8222-222222222222';
const providerAccountId = '123456789';
const token = 'fake-atlas-session';
const key = new Uint8Array(32).fill(3);
const now = Date.parse('2026-09-15T12:00:00Z');

class Store implements HubSpotConnectionStore {
  connection: HubSpotConnectionRow | null = null;
  credential: HubSpotCredentialRow | null = null;
  readonly evidence: HubSpotEvidenceInput[] = [];
  readonly links: HubSpotExternalObjectLinkInput[] = [];
  readonly credentialReads: string[] = [];

  async createOAuthState(): Promise<void> { throw new Error('unused'); }
  async findOAuthState(): Promise<HubSpotOAuthStateRow | null> { return null; }
  async consumeOAuthState(): Promise<boolean> { return false; }
  async insertCredential(input: HubSpotStoredCredentialInput): Promise<HubSpotCredentialRow> {
    this.credential = { id: 'credential-1', ...input }; return this.credential;
  }
  async updateCredential(id: string, organizationId: string, input: HubSpotStoredCredentialInput): Promise<boolean> {
    if (!this.credential || this.credential.id !== id || this.credential.org_id !== organizationId) return false;
    this.credential = { id, ...input }; return true;
  }
  async deleteCredential(): Promise<void> { this.credential = null; }
  async getCredential(id: string, organizationId: string): Promise<HubSpotCredentialRow | null> {
    this.credentialReads.push(organizationId);
    return this.credential?.id === id && this.credential.org_id === organizationId ? this.credential : null;
  }
  async upsertConnection(input: HubSpotConnectionUpsert): Promise<HubSpotConnectionRow> {
    this.connection = { id: 'connection-1', ...input }; return this.connection;
  }
  async getConnection(organizationId: string): Promise<HubSpotConnectionRow | null> {
    return this.connection?.org_id === organizationId ? this.connection : null;
  }
  async updateConnection(
    organizationId: string,
    patch: Partial<Omit<HubSpotConnectionRow, 'id' | 'org_id' | 'provider'>>
  ): Promise<HubSpotConnectionRow | null> {
    if (!this.connection || this.connection.org_id !== organizationId) return null;
    this.connection = { ...this.connection, ...patch }; return this.connection;
  }
  async recordEvidence(input: HubSpotEvidenceInput): Promise<void> { this.evidence.push({ ...input }); }
  async upsertObjectLinks(inputs: readonly HubSpotExternalObjectLinkInput[]): Promise<void> {
    this.links.push(...inputs.map((value) => ({ ...value })));
  }
}

class Adapter implements HubSpotCrmReadAdapter {
  listCalls = 0;
  searchCalls = 0;
  associationCalls = 0;
  lastCursor: string | null | undefined;
  rateLimit = false;

  async readiness() {
    return {
      ready: true,
      account: {
        id: providerAccountId, label: 'HubSpot Test', accountType: 'STANDARD', timeZone: 'US/Eastern',
        companyCurrency: 'USD', dataHostingLocation: 'na1'
      },
      error: null
    };
  }
  async listObjects(_context: unknown, request: { objectType: 'contact'; cursor?: string | null }) {
    this.listCalls += 1;
    this.lastCursor = request.cursor;
    if (this.rateLimit) throw new HubSpotCrmError({ code: 'rate_limited', status: 429, retryAfterSeconds: 7 });
    return {
      records: [{
        provider: 'hubspot' as const, objectType: request.objectType, providerId: '101',
        displayName: 'Example Contact', fields: { email: 'contact@example.test' },
        updatedAt: '2026-09-15T11:00:00Z'
      }],
      nextCursor: 'after-101'
    };
  }
  async searchObjects(_context: unknown, request: { objectType: 'contact'; query: string; cursor?: string | null }) {
    this.searchCalls += 1;
    this.lastCursor = request.cursor;
    return {
      records: [{
        provider: 'hubspot' as const, objectType: request.objectType, providerId: '202',
        displayName: request.query, fields: {}, updatedAt: null
      }],
      nextCursor: null
    };
  }
  async getObject(_context: unknown, request: { objectType: 'contact'; providerId: string }) {
    return {
      provider: 'hubspot' as const, objectType: request.objectType, providerId: request.providerId,
      displayName: 'Record', fields: {}, updatedAt: null
    };
  }
  async listAssociations(_context: unknown, request: { objectType: 'contact'; providerId: string; targetObjectType?: 'company'; cursor?: string | null }) {
    this.associationCalls += 1;
    this.lastCursor = request.cursor;
    return {
      associations: [{
        provider: 'hubspot' as const,
        fromObjectType: request.objectType,
        fromProviderId: request.providerId,
        toObjectType: request.targetObjectType ?? 'company',
        toProviderId: '301',
        associationType: 'contact_to_company'
      }],
      nextCursor: null
    };
  }
}

async function seededStore(organizationId = orgA) {
  const store = new Store();
  const sealed = await sealCredential({
    organizationId,
    provider: 'hubspot',
    credential: {
      accessToken: 'fake-provider-access', refreshToken: 'fake-provider-refresh',
      tokenType: 'Bearer', scopes: ['crm.objects.contacts.read'], expiresAt: now + 60 * 60 * 1000
    },
    key,
    keyVersion: 'test-v1'
  });
  store.credential = {
    id: 'credential-1', org_id: organizationId, provider: 'hubspot', ciphertext: sealed.ciphertext,
    iv: sealed.iv, algorithm: sealed.algorithm, key_version: sealed.keyVersion,
    expires_at: new Date(now + 60 * 60 * 1000).toISOString()
  };
  store.connection = {
    id: 'connection-1', org_id: organizationId, provider: 'hubspot', state: 'connected',
    provider_account_id: providerAccountId, provider_account_label: 'HubSpot Test',
    granted_scopes: ['crm.objects.contacts.read'], credential_ref: 'credential-1',
    last_verified_at: new Date(now).toISOString(), last_success_at: new Date(now).toISOString(),
    last_error_code: null, last_error_at: null, connected_by: 'user-a',
    connected_at: new Date(now).toISOString(), revoked_at: null
  };
  return store;
}

function deps(store: Store, adapter: Adapter, permissions: readonly string[] = ['crm.read']): AtlasCrmHubSpotDependencies {
  const granted = new Set(permissions);
  return {
    connectionStore: store,
    crmAdapter: adapter as unknown as HubSpotCrmReadAdapter,
    lifecycle: { credentialKey: key, now: () => now },
    env: (name) => ({
      SUPABASE_URL: 'https://atlas-test.supabase.co',
      SUPABASE_ANON_KEY: 'fake-publishable',
      HUBSPOT_CLIENT_ID: 'client',
      HUBSPOT_CLIENT_SECRET: 'fake-secret',
      HUBSPOT_REDIRECT_URI: 'https://atlas.test/callback'
    } as Record<string, string>)[name],
    fetchImpl: async (resource, init) => {
      const url = String(resource);
      if (url.endsWith('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'user-a' }), { status: 200 });
      }
      if (url.endsWith('/rest/v1/rpc/has_identity_permission')) {
        const body = JSON.parse(String(init?.body)) as { p: string };
        return new Response(JSON.stringify(granted.has(body.p)), { status: 200 });
      }
      throw new Error(`unexpected fetch ${url}`);
    }
  };
}

async function invoke(input: {
  store: Store; adapter: Adapter; operation: string; organizationId?: string;
  body?: Record<string, unknown>; permissions?: readonly string[];
}) {
  const request = new Request('https://atlas.test/functions/v1/atlas-crm-hubspot', {
    method: 'POST',
    headers: {
      Origin: 'https://www.atlasenterprisesuite.com',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      operation: input.operation,
      organizationId: input.organizationId ?? orgA,
      ...(input.body ?? {})
    })
  });
  return handleAtlasCrmHubSpotRequest(request, deps(input.store, input.adapter, input.permissions));
}

describe('ATLAS CRM HubSpot tenant-safe read operations', () => {
  it('passes opaque pagination to provider and persists only linkage/evidence metadata', async () => {
    const store = await seededStore();
    const adapter = new Adapter();
    const response = await invoke({
      store, adapter, operation: 'crm.list',
      body: { objectType: 'contact', cursor: 'opaque-after', limit: 25 }
    });
    expect(response.status).toBe(200);
    expect(adapter.lastCursor).toBe('opaque-after');
    expect(store.links).toHaveLength(1);
    expect(store.links[0]).toMatchObject({
      org_id: orgA, provider_account_id: providerAccountId,
      provider_object_type: 'contact', provider_object_id: '101'
    });
    expect(JSON.stringify(store.links)).not.toContain('contact@example.test');
    expect(store.evidence.at(-1)).toMatchObject({
      operation: 'crm.list', records_observed: 1,
      cursor_in: 'opaque-after', cursor_out: 'after-101'
    });
  });

  it('uses provider search instead of list-plus-client-filter', async () => {
    const store = await seededStore();
    const adapter = new Adapter();
    const response = await invoke({
      store, adapter, operation: 'crm.search',
      body: { objectType: 'contact', query: 'Example', cursor: 'search-after' }
    });
    expect(response.status).toBe(200);
    expect(adapter.searchCalls).toBe(1);
    expect(adapter.listCalls).toBe(0);
    expect(adapter.lastCursor).toBe('search-after');
  });

  it('never loads another organization credential', async () => {
    const store = await seededStore(orgB);
    const adapter = new Adapter();
    const response = await invoke({
      store, adapter, operation: 'crm.list', organizationId: orgA,
      body: { objectType: 'contact' }
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'connection_not_ready' });
    expect(store.credentialReads).not.toContain(orgB);
    expect(adapter.listCalls).toBe(0);
  });

  it('persists association references without business payloads', async () => {
    const store = await seededStore();
    const adapter = new Adapter();
    const response = await invoke({
      store, adapter, operation: 'crm.associations',
      body: { objectType: 'contact', providerId: '101', targetObjectType: 'company' }
    });
    expect(response.status).toBe(200);
    expect(adapter.associationCalls).toBe(1);
    expect(store.links.map((link) => `${link.provider_object_type}:${link.provider_object_id}`).sort())
      .toEqual(['company:301', 'contact:101']);
  });

  it('maps provider throttling to a safe 429 with retry metadata', async () => {
    const store = await seededStore();
    const adapter = new Adapter();
    adapter.rateLimit = true;
    const response = await invoke({
      store, adapter, operation: 'crm.list', body: { objectType: 'contact' }
    });
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: 'HubSpot CRM request failed', code: 'rate_limited', retryAfterSeconds: 7
    });
    expect(store.evidence.at(-1)).toMatchObject({ status: 'rate_limited', error_code: 'rate_limited' });
  });
});
