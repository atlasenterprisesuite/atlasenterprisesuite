export type HubSpotOAuthStateRow = {
  id: string;
  org_id: string;
  user_id: string;
  requested_permissions: string[];
  expires_at: string;
  consumed_at: string | null;
};

export type HubSpotConnectionRow = {
  id: string;
  org_id: string;
  provider: 'hubspot';
  state: 'unconfigured' | 'authorizing' | 'connected' | 'degraded' | 'expired' | 'revoked' | 'error';
  provider_account_id: string | null;
  provider_account_label: string | null;
  granted_scopes: string[];
  credential_ref: string | null;
  last_verified_at: string | null;
  last_success_at: string | null;
  last_error_code: string | null;
  last_error_at: string | null;
  connected_by: string | null;
  connected_at: string | null;
  revoked_at: string | null;
};

export type HubSpotCredentialRow = {
  id: string;
  org_id: string;
  provider: 'hubspot';
  ciphertext: string;
  iv: string;
  algorithm: 'AES-GCM-256';
  key_version: string;
  expires_at: string | null;
};

export type HubSpotStoredCredentialInput = Omit<HubSpotCredentialRow, 'id'>;
export type HubSpotConnectionUpsert = Omit<HubSpotConnectionRow, 'id'>;

export type HubSpotHealthStatus = 'unknown' | 'healthy' | 'degraded' | 'error' | 'stale';

export type HubSpotHealthRow = {
  id: string;
  org_id: string;
  provider: 'hubspot';
  connection_name: 'default';
  status: HubSpotHealthStatus;
  last_probe_at: string | null;
  last_probe_success_at: string | null;
  last_refresh_verified_at: string | null;
  last_webhook_at: string | null;
  last_reconcile_at: string | null;
  consecutive_failures: number;
  last_error_code: string | null;
  object_checks: Record<string, unknown>;
  reconcile_summary: Record<string, unknown>;
};

export type HubSpotHealthPatch = Partial<Omit<
  HubSpotHealthRow,
  'id' | 'org_id' | 'provider' | 'connection_name'
>>;

export type HubSpotWebhookEventInput = {
  org_id: string;
  provider: 'hubspot';
  provider_account_id: string;
  event_key: string;
  provider_event_id?: string | null;
  subscription_type: string;
  provider_object_type?: string | null;
  provider_object_id?: string | null;
  property_name?: string | null;
  occurred_at?: string | null;
  processed_at?: string;
};

export type HubSpotEvidenceInput = {
  org_id: string;
  provider: 'hubspot';
  operation: string;
  object_type?: string | null;
  status: 'started' | 'completed' | 'failed' | 'denied' | 'rate_limited';
  cursor_in?: string | null;
  cursor_out?: string | null;
  records_observed?: number;
  started_by?: string | null;
  started_at?: string;
  completed_at?: string | null;
  error_code?: string | null;
  evidence_ref?: string | null;
};

export type HubSpotExternalObjectLinkInput = {
  org_id: string;
  provider: 'hubspot';
  provider_account_id: string;
  provider_object_type: string;
  provider_object_id: string;
  atlas_object_type?: string | null;
  atlas_object_id?: string | null;
  last_seen_at: string;
  source_updated_at?: string | null;
  source_fingerprint?: string | null;
};

export interface HubSpotConnectionStore {
  createOAuthState(input: {
    organizationId: string;
    userId: string;
    nonceHash: string;
    requestedPermissions: string[];
    expiresAt: string;
  }): Promise<void>;
  findOAuthState(nonceHash: string): Promise<HubSpotOAuthStateRow | null>;
  consumeOAuthState(id: string, consumedAt: string): Promise<boolean>;
  insertCredential(input: HubSpotStoredCredentialInput): Promise<HubSpotCredentialRow>;
  updateCredential(id: string, organizationId: string, input: HubSpotStoredCredentialInput): Promise<boolean>;
  deleteCredential(id: string, organizationId: string): Promise<void>;
  getCredential(id: string, organizationId: string): Promise<HubSpotCredentialRow | null>;
  upsertConnection(input: HubSpotConnectionUpsert): Promise<HubSpotConnectionRow>;
  getConnection(organizationId: string): Promise<HubSpotConnectionRow | null>;
  updateConnection(
    organizationId: string,
    patch: Partial<Omit<HubSpotConnectionRow, 'id' | 'org_id' | 'provider'>>
  ): Promise<HubSpotConnectionRow | null>;
  recordEvidence(input: HubSpotEvidenceInput): Promise<void>;
  upsertObjectLinks?(inputs: readonly HubSpotExternalObjectLinkInput[]): Promise<void>;
  getHealth?(organizationId: string): Promise<HubSpotHealthRow | null>;
  upsertHealth?(organizationId: string, patch: HubSpotHealthPatch): Promise<HubSpotHealthRow | null>;
  listMonitorConnections?(): Promise<HubSpotConnectionRow[]>;
  getConnectionByProviderAccountId?(providerAccountId: string): Promise<HubSpotConnectionRow | null>;
  insertWebhookEvents?(inputs: readonly HubSpotWebhookEventInput[]): Promise<number>;
}

type ServiceFetch = typeof fetch;

const HUBSPOT_CONNECTION_NAME = 'default';

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function filter(value: string): string {
  return encodeURIComponent(value);
}

function providerTruthForState(state: HubSpotConnectionRow['state'] | undefined) {
  if (state === 'connected') return { authorized: true, provider_verified: true };
  if (state === 'revoked' || state === 'expired') {
    return { authorized: false, provider_verified: false };
  }
  return {};
}

export class SupabaseHubSpotConnectionStore implements HubSpotConnectionStore {
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
          ...(init.headers ?? {})
        }
      });
    } catch {
      throw new Error('ATLAS integration storage is unavailable');
    }
    if (!response.ok) throw new Error(`ATLAS integration storage request failed (${response.status})`);
    return response;
  }

  private async rows<T>(response: Response): Promise<T[]> {
    try {
      const value = (await response.json()) as unknown;
      if (!Array.isArray(value)) throw new Error('not-array');
      return value as T[];
    } catch {
      throw new Error('ATLAS integration storage returned malformed data');
    }
  }

  async createOAuthState(input: {
    organizationId: string;
    userId: string;
    nonceHash: string;
    requestedPermissions: string[];
    expiresAt: string;
  }): Promise<void> {
    await this.request('atlas_oauth_states', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        org_id: input.organizationId,
        user_id: input.userId,
        provider: 'hubspot',
        nonce_hash: input.nonceHash,
        requested_permissions: input.requestedPermissions,
        expires_at: input.expiresAt
      })
    });
  }

  async findOAuthState(nonceHash: string): Promise<HubSpotOAuthStateRow | null> {
    const response = await this.request(
      `atlas_oauth_states?provider=eq.hubspot&nonce_hash=eq.${filter(nonceHash)}&select=id,org_id,user_id,requested_permissions,expires_at,consumed_at&limit=1`
    );
    return (await this.rows<HubSpotOAuthStateRow>(response))[0] ?? null;
  }

  async consumeOAuthState(id: string, consumedAt: string): Promise<boolean> {
    const response = await this.request(`atlas_oauth_states?id=eq.${filter(id)}&consumed_at=is.null`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ consumed_at: consumedAt })
    });
    return (await this.rows<HubSpotOAuthStateRow>(response)).length === 1;
  }

  async insertCredential(input: HubSpotStoredCredentialInput): Promise<HubSpotCredentialRow> {
    const response = await this.request('atlas_integration_credentials', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(input)
    });
    const row = (await this.rows<HubSpotCredentialRow>(response))[0];
    if (!row?.id) throw new Error('ATLAS integration credential insert returned no row');
    return row;
  }

  async updateCredential(id: string, organizationId: string, input: HubSpotStoredCredentialInput): Promise<boolean> {
    const response = await this.request(
      `atlas_integration_credentials?id=eq.${filter(id)}&org_id=eq.${filter(organizationId)}&provider=eq.hubspot`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(input)
      }
    );
    return (await this.rows<HubSpotCredentialRow>(response)).length === 1;
  }

  async deleteCredential(id: string, organizationId: string): Promise<void> {
    await this.request(
      `atlas_integration_credentials?id=eq.${filter(id)}&org_id=eq.${filter(organizationId)}&provider=eq.hubspot`,
      { method: 'DELETE', headers: { Prefer: 'return=minimal' } }
    );
  }

  async getCredential(id: string, organizationId: string): Promise<HubSpotCredentialRow | null> {
    const response = await this.request(
      `atlas_integration_credentials?id=eq.${filter(id)}&org_id=eq.${filter(organizationId)}&provider=eq.hubspot&select=id,org_id,provider,ciphertext,iv,algorithm,key_version,expires_at&limit=1`
    );
    return (await this.rows<HubSpotCredentialRow>(response))[0] ?? null;
  }

  async upsertConnection(input: HubSpotConnectionUpsert): Promise<HubSpotConnectionRow> {
    const actorId = required(input.connected_by ?? '', 'HubSpot connection actor');
    const response = await this.request(
      'atlas_integration_connections?on_conflict=org_id,provider,connection_name',
      {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({
          ...input,
          connection_name: HUBSPOT_CONNECTION_NAME,
          auth_kind: 'oauth2',
          ...providerTruthForState(input.state),
          created_by: actorId,
          updated_by: actorId
        })
      }
    );
    const row = (await this.rows<HubSpotConnectionRow>(response))[0];
    if (!row?.id) throw new Error('ATLAS integration connection upsert returned no row');
    return row;
  }

  async getConnection(organizationId: string): Promise<HubSpotConnectionRow | null> {
    const response = await this.request(
      `atlas_integration_connections?org_id=eq.${filter(organizationId)}&provider=eq.hubspot&connection_name=eq.${filter(HUBSPOT_CONNECTION_NAME)}&select=id,org_id,provider,state,provider_account_id,provider_account_label,granted_scopes,credential_ref,last_verified_at,last_success_at,last_error_code,last_error_at,connected_by,connected_at,revoked_at&limit=1`
    );
    return (await this.rows<HubSpotConnectionRow>(response))[0] ?? null;
  }

  async updateConnection(
    organizationId: string,
    patch: Partial<Omit<HubSpotConnectionRow, 'id' | 'org_id' | 'provider'>>
  ): Promise<HubSpotConnectionRow | null> {
    const response = await this.request(
      `atlas_integration_connections?org_id=eq.${filter(organizationId)}&provider=eq.hubspot&connection_name=eq.${filter(HUBSPOT_CONNECTION_NAME)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ ...patch, ...providerTruthForState(patch.state) })
      }
    );
    return (await this.rows<HubSpotConnectionRow>(response))[0] ?? null;
  }

  async recordEvidence(input: HubSpotEvidenceInput): Promise<void> {
    await this.request('atlas_integration_sync_runs', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ records_observed: 0, ...input })
    });
  }

  async upsertObjectLinks(inputs: readonly HubSpotExternalObjectLinkInput[]): Promise<void> {
    if (inputs.length === 0) return;
    await this.request(
      'atlas_external_object_links?on_conflict=org_id,provider,provider_account_id,provider_object_type,provider_object_id',
      {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(inputs)
      }
    );
  }

  async getHealth(organizationId: string): Promise<HubSpotHealthRow | null> {
    const response = await this.request(
      `atlas_integration_health?org_id=eq.${filter(organizationId)}&provider=eq.hubspot&connection_name=eq.${filter(HUBSPOT_CONNECTION_NAME)}&select=id,org_id,provider,connection_name,status,last_probe_at,last_probe_success_at,last_refresh_verified_at,last_webhook_at,last_reconcile_at,consecutive_failures,last_error_code,object_checks,reconcile_summary&limit=1`
    );
    return (await this.rows<HubSpotHealthRow>(response))[0] ?? null;
  }

  async upsertHealth(
    organizationId: string,
    patch: HubSpotHealthPatch
  ): Promise<HubSpotHealthRow | null> {
    const response = await this.request(
      'atlas_integration_health?on_conflict=org_id,provider,connection_name',
      {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({
          org_id: organizationId,
          provider: 'hubspot',
          connection_name: HUBSPOT_CONNECTION_NAME,
          ...patch,
          updated_at: new Date().toISOString()
        })
      }
    );
    return (await this.rows<HubSpotHealthRow>(response))[0] ?? null;
  }

  async listMonitorConnections(): Promise<HubSpotConnectionRow[]> {
    const response = await this.request(
      'atlas_integration_connections?provider=eq.hubspot&connection_name=eq.default&credential_ref=not.is.null&state=in.(connected,degraded)&select=id,org_id,provider,state,provider_account_id,provider_account_label,granted_scopes,credential_ref,last_verified_at,last_success_at,last_error_code,last_error_at,connected_by,connected_at,revoked_at'
    );
    return this.rows<HubSpotConnectionRow>(response);
  }

  async getConnectionByProviderAccountId(providerAccountId: string): Promise<HubSpotConnectionRow | null> {
    const response = await this.request(
      `atlas_integration_connections?provider=eq.hubspot&connection_name=eq.default&provider_account_id=eq.${filter(providerAccountId)}&select=id,org_id,provider,state,provider_account_id,provider_account_label,granted_scopes,credential_ref,last_verified_at,last_success_at,last_error_code,last_error_at,connected_by,connected_at,revoked_at&limit=1`
    );
    return (await this.rows<HubSpotConnectionRow>(response))[0] ?? null;
  }

  async insertWebhookEvents(inputs: readonly HubSpotWebhookEventInput[]): Promise<number> {
    if (inputs.length === 0) return 0;
    const response = await this.request(
      'atlas_integration_webhook_events?on_conflict=provider,provider_account_id,event_key',
      {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify(inputs)
      }
    );
    return (await this.rows<Record<string, unknown>>(response)).length;
  }
}
