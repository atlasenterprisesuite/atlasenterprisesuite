export type SalesforceOAuthStateRow = {
  id: string;
  org_id: string;
  user_id: string;
  requested_permissions: string[];
  expires_at: string;
  consumed_at: string | null;
};

export type SalesforceConnectionState =
  | 'unconfigured'
  | 'authorizing'
  | 'connected'
  | 'degraded'
  | 'expired'
  | 'revoked'
  | 'error';

export type SalesforceConnectionMetadata = {
  canonical?: boolean;
  classification?: 'canonical' | 'secondary-production' | 'legacy' | 'migration-source' | 'test-misclassified-as-production' | 'unknown';
  instanceUrl?: string;
  identityUrl?: string;
  userId?: string;
  username?: string | null;
  organizationType?: string | null;
  instanceName?: string | null;
  isSandbox?: boolean | null;
  apiVersion?: string;
  recordCounts?: Record<string, number | null>;
  inventoryProbedAt?: string;
};

export type SalesforceConnectionRow = {
  id: string;
  org_id: string;
  provider: 'salesforce';
  connection_name: string;
  state: SalesforceConnectionState;
  authorized: boolean;
  provider_verified: boolean;
  provider_account_id: string | null;
  provider_account_label: string | null;
  granted_scopes: string[];
  credential_ref: string | null;
  endpoint_origin: string | null;
  metadata: SalesforceConnectionMetadata;
  last_verified_at: string | null;
  last_success_at: string | null;
  last_error_code: string | null;
  last_error_at: string | null;
  connected_by: string | null;
  connected_at: string | null;
  revoked_at: string | null;
};

export type SalesforceCredentialRow = {
  id: string;
  org_id: string;
  provider: 'salesforce';
  ciphertext: string;
  iv: string;
  algorithm: 'AES-GCM-256';
  key_version: string;
  expires_at: string | null;
};

export type SalesforceStoredCredentialInput = Omit<SalesforceCredentialRow, 'id'>;

export type SalesforceConnectionUpsert = {
  org_id: string;
  connection_name: string;
  state: SalesforceConnectionState;
  provider_account_id: string | null;
  provider_account_label: string | null;
  granted_scopes: string[];
  credential_ref: string | null;
  endpoint_origin: string | null;
  metadata: SalesforceConnectionMetadata;
  last_verified_at: string | null;
  last_success_at: string | null;
  last_error_code: string | null;
  last_error_at: string | null;
  connected_by: string;
  connected_at: string | null;
  revoked_at: string | null;
};

export type SalesforceEvidenceInput = {
  org_id: string;
  provider: 'salesforce';
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

export type SalesforceExternalObjectLinkInput = {
  org_id: string;
  provider: 'salesforce';
  provider_account_id: string;
  provider_object_type: string;
  provider_object_id: string;
  atlas_object_type?: string | null;
  atlas_object_id?: string | null;
  last_seen_at: string;
  source_updated_at?: string | null;
  source_fingerprint?: string | null;
};

export interface SalesforceConnectionStore {
  createOAuthState(input: {
    organizationId: string;
    userId: string;
    nonceHash: string;
    requestedPermissions: string[];
    expiresAt: string;
  }): Promise<void>;
  findOAuthState(nonceHash: string): Promise<SalesforceOAuthStateRow | null>;
  consumeOAuthState(id: string, consumedAt: string): Promise<boolean>;
  insertCredential(input: SalesforceStoredCredentialInput): Promise<SalesforceCredentialRow>;
  updateCredential(id: string, organizationId: string, input: SalesforceStoredCredentialInput): Promise<boolean>;
  deleteCredential(id: string, organizationId: string): Promise<void>;
  getCredential(id: string, organizationId: string): Promise<SalesforceCredentialRow | null>;
  upsertConnection(input: SalesforceConnectionUpsert): Promise<SalesforceConnectionRow>;
  listConnections(organizationId: string): Promise<SalesforceConnectionRow[]>;
  getConnectionById(organizationId: string, connectionId: string): Promise<SalesforceConnectionRow | null>;
  getConnectionByProviderAccountId(organizationId: string, providerAccountId: string): Promise<SalesforceConnectionRow | null>;
  updateConnectionById(
    organizationId: string,
    connectionId: string,
    patch: Partial<Omit<SalesforceConnectionRow, 'id' | 'org_id' | 'provider'>>
  ): Promise<SalesforceConnectionRow | null>;
  recordEvidence(input: SalesforceEvidenceInput): Promise<void>;
  upsertObjectLinks(inputs: readonly SalesforceExternalObjectLinkInput[]): Promise<void>;
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

function providerTruth(state: SalesforceConnectionState | undefined) {
  if (state === 'connected') return { authorized: true, provider_verified: true };
  if (state === 'revoked' || state === 'expired' || state === 'unconfigured') {
    return { authorized: false, provider_verified: false };
  }
  return {};
}

const CONNECTION_SELECT = [
  'id',
  'org_id',
  'provider',
  'connection_name',
  'state',
  'authorized',
  'provider_verified',
  'provider_account_id',
  'provider_account_label',
  'granted_scopes',
  'credential_ref',
  'endpoint_origin',
  'metadata',
  'last_verified_at',
  'last_success_at',
  'last_error_code',
  'last_error_at',
  'connected_by',
  'connected_at',
  'revoked_at'
].join(',');

export class SupabaseSalesforceConnectionStore implements SalesforceConnectionStore {
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
        provider: 'salesforce',
        nonce_hash: input.nonceHash,
        requested_permissions: input.requestedPermissions,
        expires_at: input.expiresAt
      })
    });
  }

  async findOAuthState(nonceHash: string): Promise<SalesforceOAuthStateRow | null> {
    const response = await this.request(
      `atlas_oauth_states?provider=eq.salesforce&nonce_hash=eq.${filter(nonceHash)}&select=id,org_id,user_id,requested_permissions,expires_at,consumed_at&limit=1`
    );
    return (await this.rows<SalesforceOAuthStateRow>(response))[0] ?? null;
  }

  async consumeOAuthState(id: string, consumedAt: string): Promise<boolean> {
    const response = await this.request(`atlas_oauth_states?id=eq.${filter(id)}&consumed_at=is.null`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ consumed_at: consumedAt })
    });
    return (await this.rows<SalesforceOAuthStateRow>(response)).length === 1;
  }

  async insertCredential(input: SalesforceStoredCredentialInput): Promise<SalesforceCredentialRow> {
    const response = await this.request('atlas_integration_credentials', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(input)
    });
    const row = (await this.rows<SalesforceCredentialRow>(response))[0];
    if (!row?.id) throw new Error('ATLAS integration credential insert returned no row');
    return row;
  }

  async updateCredential(
    id: string,
    organizationId: string,
    input: SalesforceStoredCredentialInput
  ): Promise<boolean> {
    const response = await this.request(
      `atlas_integration_credentials?id=eq.${filter(id)}&org_id=eq.${filter(organizationId)}&provider=eq.salesforce`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(input)
      }
    );
    return (await this.rows<SalesforceCredentialRow>(response)).length === 1;
  }

  async deleteCredential(id: string, organizationId: string): Promise<void> {
    await this.request(
      `atlas_integration_credentials?id=eq.${filter(id)}&org_id=eq.${filter(organizationId)}&provider=eq.salesforce`,
      { method: 'DELETE', headers: { Prefer: 'return=minimal' } }
    );
  }

  async getCredential(id: string, organizationId: string): Promise<SalesforceCredentialRow | null> {
    const response = await this.request(
      `atlas_integration_credentials?id=eq.${filter(id)}&org_id=eq.${filter(organizationId)}&provider=eq.salesforce&select=id,org_id,provider,ciphertext,iv,algorithm,key_version,expires_at&limit=1`
    );
    return (await this.rows<SalesforceCredentialRow>(response))[0] ?? null;
  }

  async upsertConnection(input: SalesforceConnectionUpsert): Promise<SalesforceConnectionRow> {
    const actorId = required(input.connected_by, 'Salesforce connection actor');
    const response = await this.request(
      'atlas_integration_connections?on_conflict=org_id,provider,connection_name',
      {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({
          ...input,
          provider: 'salesforce',
          auth_kind: 'oauth2',
          ...providerTruth(input.state),
          created_by: actorId,
          updated_by: actorId
        })
      }
    );
    const row = (await this.rows<SalesforceConnectionRow>(response))[0];
    if (!row?.id) throw new Error('ATLAS integration connection upsert returned no row');
    return row;
  }

  async listConnections(organizationId: string): Promise<SalesforceConnectionRow[]> {
    const response = await this.request(
      `atlas_integration_connections?org_id=eq.${filter(organizationId)}&provider=eq.salesforce&select=${CONNECTION_SELECT}&order=updated_at.desc`
    );
    return this.rows<SalesforceConnectionRow>(response);
  }

  async getConnectionById(
    organizationId: string,
    connectionId: string
  ): Promise<SalesforceConnectionRow | null> {
    const response = await this.request(
      `atlas_integration_connections?id=eq.${filter(connectionId)}&org_id=eq.${filter(organizationId)}&provider=eq.salesforce&select=${CONNECTION_SELECT}&limit=1`
    );
    return (await this.rows<SalesforceConnectionRow>(response))[0] ?? null;
  }

  async getConnectionByProviderAccountId(
    organizationId: string,
    providerAccountId: string
  ): Promise<SalesforceConnectionRow | null> {
    const response = await this.request(
      `atlas_integration_connections?org_id=eq.${filter(organizationId)}&provider=eq.salesforce&provider_account_id=eq.${filter(providerAccountId)}&select=${CONNECTION_SELECT}&limit=1`
    );
    return (await this.rows<SalesforceConnectionRow>(response))[0] ?? null;
  }

  async updateConnectionById(
    organizationId: string,
    connectionId: string,
    patch: Partial<Omit<SalesforceConnectionRow, 'id' | 'org_id' | 'provider'>>
  ): Promise<SalesforceConnectionRow | null> {
    const response = await this.request(
      `atlas_integration_connections?id=eq.${filter(connectionId)}&org_id=eq.${filter(organizationId)}&provider=eq.salesforce`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ ...patch, ...providerTruth(patch.state) })
      }
    );
    return (await this.rows<SalesforceConnectionRow>(response))[0] ?? null;
  }

  async recordEvidence(input: SalesforceEvidenceInput): Promise<void> {
    await this.request('atlas_integration_sync_runs', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ records_observed: 0, ...input })
    });
  }

  async upsertObjectLinks(inputs: readonly SalesforceExternalObjectLinkInput[]): Promise<void> {
    if (!inputs.length) return;
    await this.request(
      'atlas_external_object_links?on_conflict=org_id,provider,provider_account_id,provider_object_type,provider_object_id',
      {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(inputs)
      }
    );
  }
}
