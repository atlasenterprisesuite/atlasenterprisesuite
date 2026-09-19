import { describe, expect, it } from 'vitest';
import {
  completeHubSpotConnection,
  prepareHubSpotConnection,
  type HubSpotLifecycleDependencies,
  type HubSpotLifecycleOAuth
} from '../../supabase/functions/_shared/hubspot-connection-lifecycle';
import type {
  HubSpotConnectionRow,
  HubSpotConnectionStore,
  HubSpotCredentialRow,
  HubSpotEvidenceInput,
  HubSpotOAuthStateRow,
  HubSpotStoredCredentialInput,
  HubSpotConnectionUpsert
} from '../../supabase/functions/_shared/hubspot-connection-store';

const orgId = '11111111-1111-4111-8111-111111111111';
const providerAccountId = '123456789';
const key = new Uint8Array(32).fill(11);

class Store implements HubSpotConnectionStore {
  state: HubSpotOAuthStateRow | null = null;
  nonceHash = '';
  credential: HubSpotCredentialRow | null = null;
  connection: HubSpotConnectionRow | null = null;
  evidence: HubSpotEvidenceInput[] = [];

  async createOAuthState(input: { organizationId: string; userId: string; nonceHash: string; requestedPermissions: string[]; expiresAt: string }) {
    this.nonceHash = input.nonceHash;
    this.state = {
      id: 'state-1', org_id: input.organizationId, user_id: input.userId,
      requested_permissions: [...input.requestedPermissions], expires_at: input.expiresAt, consumed_at: null
    };
  }
  async findOAuthState(nonceHash: string) { return nonceHash === this.nonceHash ? this.state : null; }
  async consumeOAuthState(id: string, consumedAt: string) {
    if (!this.state || this.state.id !== id || this.state.consumed_at) return false;
    this.state.consumed_at = consumedAt;
    return true;
  }
  async insertCredential(input: HubSpotStoredCredentialInput) {
    this.credential = { id: 'credential-1', ...input };
    return this.credential;
  }
  async updateCredential(id: string, organizationId: string, input: HubSpotStoredCredentialInput) {
    if (!this.credential || this.credential.id !== id || this.credential.org_id !== organizationId) return false;
    this.credential = { id, ...input };
    return true;
  }
  async deleteCredential(id: string, organizationId: string) {
    if (this.credential?.id === id && this.credential.org_id === organizationId) this.credential = null;
  }
  async getCredential(id: string, organizationId: string) {
    return this.credential?.id === id && this.credential.org_id === organizationId ? this.credential : null;
  }
  async upsertConnection(input: HubSpotConnectionUpsert) {
    this.connection = { id: 'connection-1', ...input };
    return this.connection;
  }
  async getConnection(organizationId: string) {
    return this.connection?.org_id === organizationId ? this.connection : null;
  }
  async updateConnection(organizationId: string, patch: Partial<Omit<HubSpotConnectionRow, 'id' | 'org_id' | 'provider'>>) {
    if (!this.connection || this.connection.org_id !== organizationId) return null;
    this.connection = { ...this.connection, ...patch };
    return this.connection;
  }
  async recordEvidence(input: HubSpotEvidenceInput) { this.evidence.push(input); }
}

function oauth(scopes: string[]): HubSpotLifecycleOAuth {
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
      return {
        accessToken: 'fake-access', refreshToken: 'fake-refresh', tokenType: 'Bearer', expiresIn: 1800,
        hubId: providerAccountId, userId: 'user', scopes
      };
    },
    async introspectToken() {
      return {
        active: true, hubId: providerAccountId, userId: 'user', clientId: 'client', hubDomain: 'example.test',
        scopes, tokenUse: 'access_token', tokenType: 'Bearer', expiresIn: 1700
      };
    },
    async refreshToken() { throw new Error('not used'); },
    async revokeToken() {}
  };
}

function deps(store: Store, scopes: string[]): HubSpotLifecycleDependencies {
  return {
    store,
    clientId: 'client',
    clientSecret: 'fake-secret',
    redirectUri: 'https://atlas.test/callback',
    credentialKey: key,
    oauth: oauth(scopes),
    adapter: {
      async readiness() {
        return {
          ready: true,
          account: { id: providerAccountId, label: 'HubSpot Test', accountType: 'STANDARD', timeZone: null, companyCurrency: null, dataHostingLocation: null },
          error: null
        };
      }
    },
    now: () => Date.parse('2026-09-15T12:00:00Z'),
    randomBytes: (length) => new Uint8Array(length).fill(5)
  };
}

async function prepared(store: Store, lifecycle: HubSpotLifecycleDependencies) {
  const result = await prepareHubSpotConnection({ organizationId: orgId, userId: 'user-a', deps: lifecycle });
  return new URL(result.authorizationUrl).searchParams.get('state')!;
}

describe('HubSpot OAuth lifecycle hardening', () => {
  it('stores only the OAuth state hash and claims the state one time', async () => {
    const scopes = ['oauth', 'crm.objects.contacts.read', 'crm.objects.companies.read', 'crm.objects.deals.read', 'crm.objects.tickets.read'];
    const store = new Store();
    const lifecycle = deps(store, scopes);
    const state = await prepared(store, lifecycle);

    expect(JSON.stringify(store.state)).not.toContain(state);
    const first = await completeHubSpotConnection({ state, code: 'code-1', deps: lifecycle });
    expect(first.state).toBe('connected');
    expect(store.state?.consumed_at).not.toBeNull();

    await expect(completeHubSpotConnection({ state, code: 'code-2', deps: lifecycle }))
      .rejects.toMatchObject({ code: 'oauth_state_consumed' });
    expect(store.connection?.state).toBe('connected');
    expect(store.connection?.credential_ref).toBe('credential-1');
  });

  it('refuses connected state when required P0 scopes are missing', async () => {
    const store = new Store();
    const lifecycle = deps(store, ['oauth', 'crm.objects.contacts.read']);
    const state = await prepared(store, lifecycle);

    await expect(completeHubSpotConnection({ state, code: 'code-1', deps: lifecycle }))
      .rejects.toMatchObject({ code: 'oauth_scope_mismatch' });
    expect(store.connection?.state).not.toBe('connected');
    expect(store.credential).toBeNull();
  });

  it('never returns provider access or refresh tokens in connection view', async () => {
    const scopes = ['oauth', 'crm.objects.contacts.read', 'crm.objects.companies.read', 'crm.objects.deals.read', 'crm.objects.tickets.read'];
    const store = new Store();
    const lifecycle = deps(store, scopes);
    const state = await prepared(store, lifecycle);
    const view = await completeHubSpotConnection({ state, code: 'code-1', deps: lifecycle });
    expect(JSON.stringify(view)).not.toMatch(/fake-access|fake-refresh/);
  });
});
