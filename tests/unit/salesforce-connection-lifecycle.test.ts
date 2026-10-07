import { describe, expect, it } from 'vitest';
import {
  completeSalesforceConnection,
  getSalesforceConnectionStatus,
  inventorySalesforceConnection,
  prepareSalesforceConnection,
  selectCanonicalSalesforceConnection,
  SalesforceLifecycleError,
  type SalesforceLifecycleDependencies
} from '../../supabase/functions/_shared/salesforce-connection-lifecycle';
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

const orgId = '11111111-1111-4111-8111-111111111111';
const key = new Uint8Array(32).fill(9);
const now = Date.parse('2026-10-07T12:00:00Z');

class MemoryStore implements SalesforceConnectionStore {
  readonly states = new Map<string, SalesforceOAuthStateRow & { nonce_hash: string }>();
  readonly credentials = new Map<string, SalesforceCredentialRow>();
  readonly connections = new Map<string, SalesforceConnectionRow>();
  readonly evidence: SalesforceEvidenceInput[] = [];
  readonly links: SalesforceExternalObjectLinkInput[] = [];
  private sequence = 0;

  async createOAuthState(input: {
    organizationId: string;
    userId: string;
    nonceHash: string;
    requestedPermissions: string[];
    expiresAt: string;
  }): Promise<void> {
    const id = `state-${++this.sequence}`;
    this.states.set(input.nonceHash, {
      id,
      nonce_hash: input.nonceHash,
      org_id: input.organizationId,
      user_id: input.userId,
      requested_permissions: [...input.requestedPermissions],
      expires_at: input.expiresAt,
      consumed_at: null
    });
  }

  async findOAuthState(nonceHash: string): Promise<SalesforceOAuthStateRow | null> {
    return this.states.get(nonceHash) ?? null;
  }

  async consumeOAuthState(id: string, consumedAt: string): Promise<boolean> {
    const row = [...this.states.values()].find((state) => state.id === id);
    if (!row || row.consumed_at) return false;
    row.consumed_at = consumedAt;
    return true;
  }

  async insertCredential(input: SalesforceStoredCredentialInput): Promise<SalesforceCredentialRow> {
    const row = { id: `credential-${++this.sequence}`, ...input };
    this.credentials.set(row.id, row);
    return row;
  }

  async updateCredential(
    id: string,
    organizationId: string,
    input: SalesforceStoredCredentialInput
  ): Promise<boolean> {
    const current = this.credentials.get(id);
    if (!current || current.org_id !== organizationId) return false;
    this.credentials.set(id, { id, ...input });
    return true;
  }

  async deleteCredential(id: string, organizationId: string): Promise<void> {
    const current = this.credentials.get(id);
    if (current?.org_id === organizationId) this.credentials.delete(id);
  }

  async getCredential(id: string, organizationId: string): Promise<SalesforceCredentialRow | null> {
    const current = this.credentials.get(id);
    return current?.org_id === organizationId ? current : null;
  }

  async upsertConnection(input: SalesforceConnectionUpsert): Promise<SalesforceConnectionRow> {
    const existing = [...this.connections.values()].find(
      (row) =>
        row.org_id === input.org_id &&
        row.provider === 'salesforce' &&
        row.connection_name === input.connection_name
    );
    const row: SalesforceConnectionRow = {
      id: existing?.id ?? `connection-${++this.sequence}`,
      org_id: input.org_id,
      provider: 'salesforce',
      connection_name: input.connection_name,
      state: input.state,
      authorized: input.state === 'connected',
      provider_verified: input.state === 'connected',
      provider_account_id: input.provider_account_id,
      provider_account_label: input.provider_account_label,
      granted_scopes: [...input.granted_scopes],
      credential_ref: input.credential_ref,
      endpoint_origin: input.endpoint_origin,
      metadata: { ...input.metadata },
      last_verified_at: input.last_verified_at,
      last_success_at: input.last_success_at,
      last_error_code: input.last_error_code,
      last_error_at: input.last_error_at,
      connected_by: input.connected_by,
      connected_at: input.connected_at,
      revoked_at: input.revoked_at
    };
    this.connections.set(row.id, row);
    return row;
  }

  async listConnections(organizationId: string): Promise<SalesforceConnectionRow[]> {
    return [...this.connections.values()].filter(
      (row) => row.org_id === organizationId && row.provider === 'salesforce'
    );
  }

  async getConnectionById(
    organizationId: string,
    connectionId: string
  ): Promise<SalesforceConnectionRow | null> {
    const row = this.connections.get(connectionId);
    return row?.org_id === organizationId ? row : null;
  }

  async getConnectionByProviderAccountId(
    organizationId: string,
    providerAccountId: string
  ): Promise<SalesforceConnectionRow | null> {
    return [...this.connections.values()].find(
      (row) => row.org_id === organizationId && row.provider_account_id === providerAccountId
    ) ?? null;
  }

  async updateConnectionById(
    organizationId: string,
    connectionId: string,
    patch: Partial<Omit<SalesforceConnectionRow, 'id' | 'org_id' | 'provider'>>
  ): Promise<SalesforceConnectionRow | null> {
    const current = this.connections.get(connectionId);
    if (!current || current.org_id !== organizationId) return null;
    const row: SalesforceConnectionRow = {
      ...current,
      ...patch,
      metadata: patch.metadata ? { ...patch.metadata } : current.metadata,
      authorized:
        patch.state === 'connected'
          ? true
          : ['expired', 'revoked', 'unconfigured'].includes(patch.state ?? '')
            ? false
            : current.authorized,
      provider_verified:
        patch.state === 'connected'
          ? true
          : ['expired', 'revoked', 'unconfigured'].includes(patch.state ?? '')
            ? false
            : current.provider_verified
    };
    this.connections.set(connectionId, row);
    return row;
  }

  async recordEvidence(input: SalesforceEvidenceInput): Promise<void> {
    this.evidence.push({ ...input });
  }

  async upsertObjectLinks(inputs: readonly SalesforceExternalObjectLinkInput[]): Promise<void> {
    this.links.push(...inputs.map((input) => ({ ...input })));
  }
}

function providerOrg(accessToken: string) {
  const second = accessToken.includes('org-b');
  return {
    organizationId: second ? '00D000000000002AAA' : '00D000000000001AAA',
    userId: second ? '005000000000002AAA' : '005000000000001AAA',
    name: second ? 'Atlas Enterprise Suite' : 'ATLAS ENTERPRISE SUITE',
    instance: second ? 'https://na222.salesforce.com' : 'https://na111.salesforce.com'
  };
}

function dependencies(store: MemoryStore): SalesforceLifecycleDependencies {
  return {
    store,
    clientId: 'client-id',
    clientSecret: 'client-secret',
    redirectUri: 'https://atlas.example/functions/v1/atlas-crm-salesforce',
    loginBaseUrl: 'https://login.salesforce.com',
    apiVersion: 'v68.0',
    credentialKey: key,
    now: () => now,
    randomBytes: (length) => new Uint8Array(length).fill(store.states.size + 1),
    fetchImpl: async (resource, init) => {
      const url = String(resource);
      if (url.endsWith('/services/oauth2/token')) {
        const body = new URLSearchParams(String(init?.body ?? ''));
        const code = body.get('code') ?? '';
        const suffix = code.includes('org-b') ? 'org-b' : 'org-a';
        const org = providerOrg(`access-${suffix}`);
        return new Response(JSON.stringify({
          access_token: `access-${suffix}`,
          refresh_token: `refresh-${suffix}`,
          token_type: 'Bearer',
          scope: 'api refresh_token',
          instance_url: org.instance,
          id: `https://login.salesforce.com/id/${org.organizationId}/${org.userId}`,
          issued_at: String(now)
        }), { status: 200 });
      }
      if (url.endsWith('/services/oauth2/introspect')) {
        const body = new URLSearchParams(String(init?.body ?? ''));
        const token = body.get('token') ?? '';
        return new Response(JSON.stringify({
          active: true,
          client_id: 'client-id',
          username: token.includes('org-b') ? 'b@example.test' : 'a@example.test',
          sub: token.includes('org-b') ? '005000000000002AAA' : '005000000000001AAA',
          scope: 'api refresh_token',
          exp: 1893456000
        }), { status: 200 });
      }
      throw new Error(`unexpected fetch ${url}`);
    },
    adapter: {
      async readiness(context) {
        const org = providerOrg(context.accessToken);
        return {
          ready: true,
          identity: {
            organizationId: org.organizationId,
            userId: org.userId,
            username: context.accessToken.includes('org-b') ? 'b@example.test' : 'a@example.test',
            displayName: 'ATLAS Owner',
            email: 'owner@example.test'
          },
          organization: {
            id: org.organizationId,
            name: org.name,
            organizationType: 'Enterprise Edition',
            instanceName: context.accessToken.includes('org-b') ? 'NA222' : 'NA111',
            isSandbox: false
          },
          error: null
        };
      },
      async inventory(context) {
        const org = providerOrg(context.accessToken);
        return {
          identity: {
            organizationId: org.organizationId,
            userId: org.userId,
            username: context.accessToken.includes('org-b') ? 'b@example.test' : 'a@example.test',
            displayName: 'ATLAS Owner',
            email: 'owner@example.test'
          },
          organization: {
            id: org.organizationId,
            name: org.name,
            organizationType: 'Enterprise Edition',
            instanceName: context.accessToken.includes('org-b') ? 'NA222' : 'NA111',
            isSandbox: false
          },
          instanceUrl: org.instance,
          apiVersion: 'v68.0',
          recordCounts: {
            Account: 5,
            Contact: 10,
            Lead: 3,
            Opportunity: 4,
            Case: 2,
            Task: 7,
            Event: 1
          },
          probedAt: '2026-10-07T12:00:00.000Z'
        };
      }
    }
  };
}

async function authorize(
  store: MemoryStore,
  deps: SalesforceLifecycleDependencies,
  code: 'org-a' | 'org-b'
) {
  const prepared = await prepareSalesforceConnection({
    organizationId: orgId,
    userId: 'user-a',
    deps
  });
  const state = new URL(prepared.authorizationUrl).searchParams.get('state');
  if (!state) throw new Error('state missing');
  return completeSalesforceConnection({ state, code, deps });
}

describe('Salesforce connection lifecycle', () => {
  it('treats one verified org as usable but fails closed when a second org is discovered', async () => {
    const store = new MemoryStore();
    const deps = dependencies(store);

    await authorize(store, deps, 'org-a');
    const single = await getSalesforceConnectionStatus({ organizationId: orgId, deps });
    expect(single.candidateCount).toBe(1);
    expect(single.canonicalRequired).toBe(false);
    expect(single.connection.providerAccountId).toBe('00D000000000001AAA');

    await authorize(store, deps, 'org-b');
    const duplicate = await getSalesforceConnectionStatus({ organizationId: orgId, deps });
    expect(duplicate.candidateCount).toBe(2);
    expect(duplicate.canonicalRequired).toBe(true);
    expect(duplicate.connection.state).toBe('unconfigured');
    expect([...store.connections.values()].every((row) => row.metadata.canonical !== true)).toBe(true);
  });

  it('requires inventory evidence for every candidate before canonical selection', async () => {
    const store = new MemoryStore();
    const deps = dependencies(store);
    await authorize(store, deps, 'org-a');
    await authorize(store, deps, 'org-b');
    const candidates = await store.listConnections(orgId);
    const first = candidates.find((row) => row.provider_account_id === '00D000000000001AAA')!;
    const second = candidates.find((row) => row.provider_account_id === '00D000000000002AAA')!;

    await expect(selectCanonicalSalesforceConnection({
      organizationId: orgId,
      actorUserId: 'user-a',
      connectionId: second.id,
      deps
    })).rejects.toMatchObject({ code: 'org_inventory_required' } satisfies Partial<SalesforceLifecycleError>);

    await inventorySalesforceConnection({
      organizationId: orgId,
      actorUserId: 'user-a',
      connectionId: first.id,
      deps
    });
    await inventorySalesforceConnection({
      organizationId: orgId,
      actorUserId: 'user-a',
      connectionId: second.id,
      deps
    });

    const selected = await selectCanonicalSalesforceConnection({
      organizationId: orgId,
      actorUserId: 'user-a',
      connectionId: second.id,
      deps
    });
    expect(selected.connection.providerAccountId).toBe('00D000000000002AAA');
    const finalRows = await store.listConnections(orgId);
    expect(finalRows.find((row) => row.id === second.id)?.metadata.classification).toBe('canonical');
    expect(finalRows.find((row) => row.id === first.id)?.metadata.classification).toBe('secondary-production');
  });
});
