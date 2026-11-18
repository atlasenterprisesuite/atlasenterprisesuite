import { describe, expect, it } from 'vitest';
import {
  handleAtlasYouTubeDirect,
  type AtlasYouTubeDirectDependencies,
} from '../../supabase/functions/atlas-youtube-direct/index';
import type {
  YouTubeConnectionRow,
  YouTubeConnectionStore,
  YouTubeCredentialRow,
  YouTubeOAuthStateRow,
  YouTubeStoredCredentialInput,
} from '../../supabase/functions/_shared/youtube-connection-store';

const organizationId = '11111111-1111-4111-8111-111111111111';
const channelId = 'UC1234567890123456789012';
const token = 'fake-atlas-session-token';
const credentialKey = new Uint8Array(32).fill(11);
const UPLOAD = 'https://www.googleapis.com/auth/youtube.upload';

class MemoryStore implements YouTubeConnectionStore {
  state: YouTubeOAuthStateRow | null = null;
  credential: YouTubeCredentialRow | null = null;
  connection: YouTubeConnectionRow | null = null;

  async createOAuthState(input: Parameters<YouTubeConnectionStore['createOAuthState']>[0]) {
    this.state = {
      id: 'state-1',
      org_id: input.organizationId,
      user_id: input.userId,
      requested_permissions: [...input.requestedPermissions],
      expires_at: input.expiresAt,
      consumed_at: null,
      flow_context: input.flowContext,
      pkce_ciphertext: input.pkceCiphertext,
      pkce_iv: input.pkceIv,
      pkce_key_version: input.pkceKeyVersion,
    };
  }
  async findOAuthState() { return this.state; }
  async consumeOAuthState(id: string, consumedAt: string) {
    if (!this.state || this.state.id !== id || this.state.consumed_at) return false;
    this.state.consumed_at = consumedAt;
    return true;
  }
  async insertCredential(input: YouTubeStoredCredentialInput) {
    this.credential = { id: 'cred-1', ...input };
    return this.credential;
  }
  async deleteCredential(id: string) {
    if (this.credential?.id === id) this.credential = null;
  }
  async upsertConnection(input: Parameters<YouTubeConnectionStore['upsertConnection']>[0]) {
    this.connection = {
      id: 'connection-1',
      org_id: input.organizationId,
      provider: 'google',
      connection_name: `youtube:${input.channelId}`,
      state: 'connected',
      authorized: true,
      provider_verified: true,
      provider_account_id: input.channelId,
      provider_account_label: input.channelTitle,
      granted_scopes: [...input.grantedScopes],
      credential_ref: input.credentialRef,
      last_verified_at: input.timestamp,
      last_success_at: input.timestamp,
      last_error_code: null,
      connected_by: input.userId,
      connected_at: input.timestamp,
      revoked_at: null,
    };
    return this.connection;
  }
  async getConnection() { return this.connection; }
  async updateConnection() { return this.connection; }
  async recordEvidence() {}
}

function dependencies(input: {
  permissions?: readonly string[];
  sessionValid?: boolean;
  store?: MemoryStore;
} = {}): AtlasYouTubeDirectDependencies {
  const permissions = new Set(input.permissions ?? ['integrations.manage', 'integrations.read']);
  const store = input.store ?? new MemoryStore();
  return {
    store,
    lifecycle: {
      credentialKey,
      now: () => 1_800_000_000_000,
      exchangeCode: async ({ codeVerifier }) => {
        expect(codeVerifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
        return {
          accessToken: 'access-secret',
          refreshToken: 'refresh-secret',
          expiresIn: 3600,
          scopes: [UPLOAD],
          tokenType: 'Bearer',
        };
      },
      fetchChannel: async () => ({ id: channelId, title: 'ATLAS Test Channel' }),
    },
    env: (name) => ({
      SUPABASE_URL: 'https://atlas-test.supabase.co',
      SUPABASE_ANON_KEY: 'fake-publishable-key',
      SUPABASE_SERVICE_ROLE_KEY: 'fake-service-role',
      GOOGLE_CLIENT_ID: 'google-client-id',
      GOOGLE_CLIENT_SECRET: 'google-client-secret',
      GOOGLE_OAUTH_STATE_SECRET: 'atlas-youtube-state-secret-for-tests-32-bytes-minimum',
      ATLAS_ALLOWED_ORIGINS: 'https://atlasenterprisesuite.com',
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
        return new Response(JSON.stringify(permissions.has(body.p ?? '')), { status: 200 });
      }
      throw new Error(`Unexpected test fetch: ${url}`);
    },
  };
}

function postRequest(operation: string, body: Record<string, unknown>, auth = true) {
  const headers = new Headers({
    'Content-Type': 'application/json',
    Origin: 'https://atlasenterprisesuite.com',
  });
  if (auth) headers.set('Authorization', `Bearer ${token}`);
  return new Request('https://atlas-test.supabase.co/functions/v1/atlas-youtube-direct', {
    method: 'POST',
    headers,
    body: JSON.stringify({ operation, ...body }),
  });
}

describe('ATLAS YouTube Direct Edge Function', () => {
  it('enforces CORS, authentication and integration permission', async () => {
    const deniedOrigin = new Request(
      'https://atlas-test.supabase.co/functions/v1/atlas-youtube-direct',
      { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } },
    );
    expect((await handleAtlasYouTubeDirect(deniedOrigin, dependencies())).status).toBe(403);

    expect((await handleAtlasYouTubeDirect(
      postRequest('oauth.prepare', { organizationId, channelId }, false),
      dependencies(),
    )).status).toBe(401);

    expect((await handleAtlasYouTubeDirect(
      postRequest('oauth.prepare', { organizationId, channelId }),
      dependencies({ permissions: [] }),
    )).status).toBe(403);
  });

  it('prepares OAuth and completes the callback into the canonical Social Command Center', async () => {
    const store = new MemoryStore();
    const deps = dependencies({ store });
    const prepared = await handleAtlasYouTubeDirect(
      postRequest('oauth.prepare', { organizationId, channelId }),
      deps,
    );
    expect(prepared.status).toBe(200);
    const body = await prepared.json() as { authorizationUrl: string };
    const state = new URL(body.authorizationUrl).searchParams.get('state');
    expect(state).toBeTruthy();

    const callback = new Request(
      `https://atlas-test.supabase.co/functions/v1/atlas-youtube-direct?state=${encodeURIComponent(state!)}&code=code-1`,
      { method: 'GET' },
    );
    const completed = await handleAtlasYouTubeDirect(callback, deps);
    expect(completed.status).toBe(302);
    expect(completed.headers.get('location')).toBe(
      'https://atlasenterprisesuite.com/studio/social?youtube=connected',
    );
    expect(store.connection).toMatchObject({
      state: 'connected',
      provider_account_id: channelId,
      authorized: true,
      provider_verified: true,
    });
    expect(JSON.stringify(store.credential)).not.toContain('access-secret');
  });

  it('returns safe connection status without credential material', async () => {
    const store = new MemoryStore();
    store.connection = {
      id: 'c',
      org_id: organizationId,
      provider: 'google',
      connection_name: `youtube:${channelId}`,
      state: 'connected',
      authorized: true,
      provider_verified: true,
      provider_account_id: channelId,
      provider_account_label: 'ATLAS Channel',
      granted_scopes: [UPLOAD],
      credential_ref: 'cred-1',
      last_verified_at: '2027-01-15T08:00:00.000Z',
      last_success_at: '2027-01-15T08:00:00.000Z',
      last_error_code: null,
      connected_by: 'user-a',
      connected_at: '2027-01-15T08:00:00.000Z',
      revoked_at: null,
    };
    const response = await handleAtlasYouTubeDirect(
      postRequest('connection.status', { organizationId, channelId }),
      dependencies({ store }),
    );
    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body).toMatchObject({
      provider: 'youtube',
      channelId,
      state: 'connected',
      authorized: true,
      providerVerified: true,
      channelTitle: 'ATLAS Channel',
    });
    expect(JSON.stringify(body)).not.toMatch(/credential_ref|access-secret|refresh-secret/i);
  });

  it('blocks callback replay and redirects with a safe error code', async () => {
    const store = new MemoryStore();
    const deps = dependencies({ store });
    const prepared = await handleAtlasYouTubeDirect(
      postRequest('oauth.prepare', { organizationId, channelId }),
      deps,
    );
    const state = new URL(((await prepared.json()) as { authorizationUrl: string }).authorizationUrl)
      .searchParams.get('state')!;

    const callbackUrl =
      `https://atlas-test.supabase.co/functions/v1/atlas-youtube-direct?state=${encodeURIComponent(state)}&code=code-1`;
    expect((await handleAtlasYouTubeDirect(new Request(callbackUrl), deps)).status).toBe(302);
    const replay = await handleAtlasYouTubeDirect(new Request(callbackUrl), deps);
    expect(replay.status).toBe(302);
    expect(replay.headers.get('location')).toContain('youtube=error');
    expect(replay.headers.get('location')).toContain('code=oauth_state_consumed');
  });
});
