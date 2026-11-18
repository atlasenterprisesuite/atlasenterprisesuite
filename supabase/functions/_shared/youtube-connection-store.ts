export type YouTubeOAuthStateRow = {
  id: string;
  org_id: string;
  user_id: string;
  requested_permissions: string[];
  expires_at: string;
  consumed_at: string | null;
  flow_context: Record<string, unknown>;
  pkce_ciphertext: string | null;
  pkce_iv: string | null;
  pkce_key_version: string | null;
};

export type YouTubeCredentialRow = {
  id: string;
  org_id: string;
  provider: 'google';
  ciphertext: string;
  iv: string;
  algorithm: 'AES-GCM-256';
  key_version: string;
  expires_at: string | null;
};

export type YouTubeConnectionRow = {
  id: string;
  org_id: string;
  provider: 'google';
  connection_name: string;
  state: 'unconfigured' | 'authorizing' | 'connected' | 'degraded' | 'expired' | 'revoked' | 'error';
  authorized: boolean;
  provider_verified: boolean;
  provider_account_id: string | null;
  provider_account_label: string | null;
  granted_scopes: string[];
  credential_ref: string | null;
  last_verified_at: string | null;
  last_success_at: string | null;
  last_error_code: string | null;
  connected_by: string | null;
  connected_at: string | null;
  revoked_at: string | null;
};

export type YouTubeStoredCredentialInput = Omit<YouTubeCredentialRow, 'id'>;

export interface YouTubeConnectionStore {
  createOAuthState(input: {
    organizationId: string;
    userId: string;
    nonceHash: string;
    requestedPermissions: string[];
    expiresAt: string;
    flowContext: Record<string, unknown>;
    pkceCiphertext: string;
    pkceIv: string;
    pkceKeyVersion: string;
  }): Promise<void>;
  findOAuthState(nonceHash: string): Promise<YouTubeOAuthStateRow | null>;
  consumeOAuthState(id: string, consumedAt: string): Promise<boolean>;
  insertCredential(input: YouTubeStoredCredentialInput): Promise<YouTubeCredentialRow>;
  deleteCredential(id: string, organizationId: string): Promise<void>;
  upsertConnection(input: {
    organizationId: string;
    userId: string;
    channelId: string;
    channelTitle: string;
    grantedScopes: string[];
    credentialRef: string;
    timestamp: string;
  }): Promise<YouTubeConnectionRow>;
  getConnection(organizationId: string, channelId: string): Promise<YouTubeConnectionRow | null>;
  updateConnection(
    organizationId: string,
    channelId: string,
    patch: Partial<Pick<YouTubeConnectionRow,
      'state' | 'authorized' | 'provider_verified' | 'credential_ref' |
      'last_verified_at' | 'last_success_at' | 'last_error_code' | 'revoked_at'>>
  ): Promise<YouTubeConnectionRow | null>;
  recordEvidence(input: {
    org_id: string;
    operation: string;
    status: 'started' | 'completed' | 'failed' | 'denied' | 'rate_limited';
    started_by?: string | null;
    completed_at?: string | null;
    error_code?: string | null;
  }): Promise<void>;
}

type ServiceFetch = typeof fetch;

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function filter(value: string): string {
  return encodeURIComponent(value);
}

function connectionName(channelId: string): string {
  return `youtube:${required(channelId, 'YouTube channel ID')}`;
}

export class SupabaseYouTubeConnectionStore implements YouTubeConnectionStore {
  private readonly restRoot: string;
  private readonly serviceRoleKey: string;
  private readonly fetchImpl: ServiceFetch;

  constructor(input: { supabaseUrl: string; serviceRoleKey: string; fetchImpl?: ServiceFetch }) {
    this.restRoot = `${required(input.supabaseUrl, 'Supabase URL').replace(/\/$/, '')}/rest/v1`;
    this.serviceRoleKey = required(input.serviceRoleKey, 'Supabase service role key');
    this.fetchImpl = input.fetchImpl ?? fetch;
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.restRoot}/${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.serviceRoleKey}`,
          apikey: this.serviceRoleKey,
          ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(init.headers ?? {}),
        },
      });
    } catch {
      throw new Error('ATLAS YouTube storage is unavailable');
    }
    if (!response.ok) {
      throw new Error(`ATLAS YouTube storage request failed (${response.status})`);
    }
    return response;
  }

  private async rows<T>(response: Response): Promise<T[]> {
    try {
      const value = (await response.json()) as unknown;
      if (!Array.isArray(value)) throw new Error('not-array');
      return value as T[];
    } catch {
      throw new Error('ATLAS YouTube storage returned malformed data');
    }
  }

  async createOAuthState(input: Parameters<YouTubeConnectionStore['createOAuthState']>[0]): Promise<void> {
    await this.request('atlas_oauth_states', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        org_id: input.organizationId,
        user_id: input.userId,
        provider: 'google',
        nonce_hash: input.nonceHash,
        requested_permissions: input.requestedPermissions,
        expires_at: input.expiresAt,
        flow_context: input.flowContext,
        pkce_ciphertext: input.pkceCiphertext,
        pkce_iv: input.pkceIv,
        pkce_key_version: input.pkceKeyVersion,
      }),
    });
  }

  async findOAuthState(nonceHash: string): Promise<YouTubeOAuthStateRow | null> {
    const response = await this.request(
      `atlas_oauth_states?provider=eq.google&nonce_hash=eq.${filter(nonceHash)}&select=id,org_id,user_id,requested_permissions,expires_at,consumed_at,flow_context,pkce_ciphertext,pkce_iv,pkce_key_version&limit=1`,
    );
    return (await this.rows<YouTubeOAuthStateRow>(response))[0] ?? null;
  }

  async consumeOAuthState(id: string, consumedAt: string): Promise<boolean> {
    const response = await this.request(
      `atlas_oauth_states?id=eq.${filter(id)}&provider=eq.google&consumed_at=is.null`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ consumed_at: consumedAt }),
      },
    );
    return (await this.rows<YouTubeOAuthStateRow>(response)).length === 1;
  }

  async insertCredential(input: YouTubeStoredCredentialInput): Promise<YouTubeCredentialRow> {
    const response = await this.request('atlas_integration_credentials', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(input),
    });
    const row = (await this.rows<YouTubeCredentialRow>(response))[0];
    if (!row) throw new Error('ATLAS YouTube credential insert returned no row');
    return row;
  }

  async deleteCredential(id: string, organizationId: string): Promise<void> {
    await this.request(
      `atlas_integration_credentials?id=eq.${filter(id)}&org_id=eq.${filter(organizationId)}&provider=eq.google`,
      { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
    );
  }

  async upsertConnection(input: Parameters<YouTubeConnectionStore['upsertConnection']>[0]): Promise<YouTubeConnectionRow> {
    const response = await this.request(
      'atlas_integration_connections?on_conflict=org_id,provider,connection_name',
      {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({
          org_id: input.organizationId,
          provider: 'google',
          connection_name: connectionName(input.channelId),
          auth_kind: 'oauth2',
          endpoint_origin: 'https://www.googleapis.com',
          authorized: true,
          provider_verified: true,
          state: 'connected',
          provider_account_id: input.channelId,
          provider_account_label: input.channelTitle,
          granted_scopes: input.grantedScopes,
          credential_ref: input.credentialRef,
          last_verified_at: input.timestamp,
          last_success_at: input.timestamp,
          last_error_code: null,
          last_error_at: null,
          connected_by: input.userId,
          connected_at: input.timestamp,
          revoked_at: null,
          created_by: input.userId,
          updated_by: input.userId,
          metadata: { capability: 'youtube.upload' },
        }),
      },
    );
    const row = (await this.rows<YouTubeConnectionRow>(response))[0];
    if (!row) throw new Error('ATLAS YouTube connection upsert returned no row');
    return row;
  }

  async getConnection(organizationId: string, channelId: string): Promise<YouTubeConnectionRow | null> {
    const response = await this.request(
      `atlas_integration_connections?org_id=eq.${filter(organizationId)}&provider=eq.google&connection_name=eq.${filter(connectionName(channelId))}&select=id,org_id,provider,connection_name,state,authorized,provider_verified,provider_account_id,provider_account_label,granted_scopes,credential_ref,last_verified_at,last_success_at,last_error_code,connected_by,connected_at,revoked_at&limit=1`,
    );
    return (await this.rows<YouTubeConnectionRow>(response))[0] ?? null;
  }

  async updateConnection(
    organizationId: string,
    channelId: string,
    patch: Parameters<YouTubeConnectionStore['updateConnection']>[2],
  ): Promise<YouTubeConnectionRow | null> {
    const response = await this.request(
      `atlas_integration_connections?org_id=eq.${filter(organizationId)}&provider=eq.google&connection_name=eq.${filter(connectionName(channelId))}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(patch),
      },
    );
    return (await this.rows<YouTubeConnectionRow>(response))[0] ?? null;
  }

  async recordEvidence(input: Parameters<YouTubeConnectionStore['recordEvidence']>[0]): Promise<void> {
    await this.request('atlas_integration_sync_runs', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        org_id: input.org_id,
        provider: 'google',
        operation: input.operation,
        status: input.status,
        records_observed: 0,
        started_by: input.started_by ?? null,
        completed_at: input.completed_at ?? null,
        error_code: input.error_code ?? null,
      }),
    });
  }
}
