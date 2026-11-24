import { describe, expect, it } from 'vitest';
import {
  completeYouTubeConnection,
  prepareYouTubeConnection,
  type YouTubeLifecycleDependencies,
} from '../../supabase/functions/_shared/youtube-connection-lifecycle';
import type {
  YouTubeConnectionRow,
  YouTubeConnectionStore,
  YouTubeCredentialRow,
  YouTubeOAuthStateRow,
  YouTubeStoredCredentialInput,
} from '../../supabase/functions/_shared/youtube-connection-store';

const key = new Uint8Array(32).fill(9);
const stateSecret = 'atlas-youtube-oauth-state-secret-for-tests-32-bytes-minimum';
const UPLOAD = 'https://www.googleapis.com/auth/youtube.upload';

class MemoryStore implements YouTubeConnectionStore {
  state: YouTubeOAuthStateRow | null = null;
  credential: YouTubeCredentialRow | null = null;
  connection: YouTubeConnectionRow | null = null;
  evidence: string[] = [];

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

  async findOAuthState() {
    return this.state;
  }

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

  async getConnection() {
    return this.connection;
  }

  async updateConnection() {
    return this.connection;
  }

  async recordEvidence(input: Parameters<YouTubeConnectionStore['recordEvidence']>[0]) {
    this.evidence.push(`${input.operation}:${input.status}`);
  }
}

function deps(store: MemoryStore, overrides: Partial<YouTubeLifecycleDependencies> = {}): YouTubeLifecycleDependencies {
  return {
    store,
    clientId: 'google-client-id',
    clientSecret: 'google-client-secret',
    redirectUri: 'https://atlas.example/functions/v1/atlas-youtube',
    stateSecret,
    credentialKey: key,
    now: () => 1_800_000_000_000,
    ...overrides,
  };
}

describe('ATLAS YouTube OAuth lifecycle', () => {
  it('prepares signed state with PKCE while storing only encrypted verifier material', async () => {
    const store = new MemoryStore();
    const prepared = await prepareYouTubeConnection({
      organizationId: 'org-a',
      userId: 'user-a',
      channelId: 'UC123',
      deps: deps(store),
    });

    const url = new URL(prepared.authorizationUrl);
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('scope')).toBe(UPLOAD);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(store.state?.flow_context).toEqual({ kind: 'youtube', channelId: 'UC123' });
    expect(store.state?.pkce_ciphertext).toBeTruthy();
    expect(JSON.stringify(store.state)).not.toContain('codeVerifier');
    expect(store.evidence).toContain('youtube.oauth.prepare:completed');
  });

  it('consumes state once, verifies exact channel, encrypts credentials and connects canonically', async () => {
    const store = new MemoryStore();
    const prepared = await prepareYouTubeConnection({
      organizationId: 'org-a',
      userId: 'user-a',
      channelId: 'UC123',
      deps: deps(store),
    });
    const state = new URL(prepared.authorizationUrl).searchParams.get('state')!;

    let observedVerifier = '';
    const connection = await completeYouTubeConnection({
      state,
      code: 'authorization-code',
      deps: deps(store, {
        exchangeCode: async (input) => {
          observedVerifier = input.codeVerifier ?? '';
          return {
            accessToken: 'access-secret',
            refreshToken: 'refresh-secret',
            expiresIn: 3600,
            scopes: [UPLOAD],
            tokenType: 'Bearer',
          };
        },
        fetchChannel: async () => ({ id: 'UC123', title: 'ATLAS Test Channel' }),
      }),
    });

    expect(observedVerifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(store.state?.consumed_at).toBeTruthy();
    expect(connection).toMatchObject({
      state: 'connected',
      authorized: true,
      provider_verified: true,
      provider_account_id: 'UC123',
      credential_ref: 'cred-1',
    });
    expect(JSON.stringify(store.credential)).not.toContain('access-secret');
    expect(JSON.stringify(store.credential)).not.toContain('refresh-secret');
    expect(store.evidence).toContain('youtube.oauth.callback:completed');
  });

  it('fails closed on replay before any second provider exchange', async () => {
    const store = new MemoryStore();
    const prepared = await prepareYouTubeConnection({
      organizationId: 'org-a',
      userId: 'user-a',
      channelId: 'UC123',
      deps: deps(store),
    });
    const state = new URL(prepared.authorizationUrl).searchParams.get('state')!;
    let exchanges = 0;
    const lifecycleDeps = deps(store, {
      exchangeCode: async () => {
        exchanges += 1;
        return {
          accessToken: 'a',
          refreshToken: 'r',
          expiresIn: 3600,
          scopes: [UPLOAD],
          tokenType: 'Bearer',
        };
      },
      fetchChannel: async () => ({ id: 'UC123', title: 'Channel' }),
    });

    await completeYouTubeConnection({ state, code: 'code', deps: lifecycleDeps });
    await expect(
      completeYouTubeConnection({ state, code: 'code', deps: lifecycleDeps }),
    ).rejects.toMatchObject({ code: 'oauth_state_consumed' });
    expect(exchanges).toBe(1);
  });

  it('rejects a provider channel different from the intended channel and stores no credential', async () => {
    const store = new MemoryStore();
    const prepared = await prepareYouTubeConnection({
      organizationId: 'org-a',
      userId: 'user-a',
      channelId: 'UC123',
      deps: deps(store),
    });
    const state = new URL(prepared.authorizationUrl).searchParams.get('state')!;

    await expect(
      completeYouTubeConnection({
        state,
        code: 'code',
        deps: deps(store, {
          exchangeCode: async () => ({
            accessToken: 'a',
            refreshToken: 'r',
            expiresIn: 3600,
            scopes: [UPLOAD],
            tokenType: 'Bearer',
          }),
          fetchChannel: async () => ({ id: 'UC999', title: 'Wrong channel' }),
        }),
      }),
    ).rejects.toMatchObject({ code: 'oauth_channel_mismatch' });

    expect(store.credential).toBeNull();
    expect(store.connection).toBeNull();
    expect(store.evidence).toContain('youtube.oauth.callback:failed');
  });
});
