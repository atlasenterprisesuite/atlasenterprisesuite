import { describe, expect, it } from 'vitest';
import { SupabaseHubSpotConnectionStore } from '../../supabase/functions/_shared/hubspot-connection-store';

type SeenRequest = { url: string; init: RequestInit };

function connectionRow() {
  return {
    id: 'connection-1',
    org_id: '00000000-0000-4000-8000-000000000001',
    provider: 'hubspot' as const,
    state: 'connected' as const,
    provider_account_id: '247228429',
    provider_account_label: 'Atlas Enterprise Suite',
    granted_scopes: ['crm.objects.contacts.read'],
    credential_ref: 'credential-1',
    last_verified_at: '2026-09-15T11:00:00.000Z',
    last_success_at: '2026-09-15T11:00:00.000Z',
    last_error_code: null,
    last_error_at: null,
    connected_by: '00000000-0000-4000-8000-000000000002',
    connected_at: '2026-09-15T11:00:00.000Z',
    revoked_at: null
  };
}

function makeStore(responseRows: unknown[] = [connectionRow()]) {
  const seen: SeenRequest[] = [];
  const fetchImpl: typeof fetch = async (input, init = {}) => {
    seen.push({ url: String(input), init });
    return new Response(JSON.stringify(responseRows), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };
  return {
    seen,
    store: new SupabaseHubSpotConnectionStore({
      supabaseUrl: 'https://example.supabase.co',
      serviceRoleKey: 'test-service-role-key',
      fetchImpl
    })
  };
}

describe('SupabaseHubSpotConnectionStore production registry compatibility', () => {
  it('upserts the canonical default HubSpot connection using the shared registry identity', async () => {
    const { store, seen } = makeStore();
    const row = connectionRow();

    await store.upsertConnection({
      org_id: row.org_id,
      provider: 'hubspot',
      state: row.state,
      provider_account_id: row.provider_account_id,
      provider_account_label: row.provider_account_label,
      granted_scopes: row.granted_scopes,
      credential_ref: row.credential_ref,
      last_verified_at: row.last_verified_at,
      last_success_at: row.last_success_at,
      last_error_code: row.last_error_code,
      last_error_at: row.last_error_at,
      connected_by: row.connected_by,
      connected_at: row.connected_at,
      revoked_at: row.revoked_at
    });

    expect(seen).toHaveLength(1);
    expect(seen[0].url).toContain(
      'atlas_integration_connections?on_conflict=org_id,provider,connection_name'
    );
    const body = JSON.parse(String(seen[0].init.body));
    expect(body).toMatchObject({
      connection_name: 'default',
      auth_kind: 'oauth2',
      authorized: true,
      provider_verified: true,
      created_by: row.connected_by,
      updated_by: row.connected_by
    });
  });

  it('reads only the canonical default HubSpot connection', async () => {
    const { store, seen } = makeStore([]);
    await store.getConnection('00000000-0000-4000-8000-000000000001');

    expect(seen).toHaveLength(1);
    expect(seen[0].url).toContain('provider=eq.hubspot');
    expect(seen[0].url).toContain('connection_name=eq.default');
  });

  it('updates only the canonical default HubSpot connection and clears provider truth on revoke', async () => {
    const { store, seen } = makeStore([connectionRow()]);
    await store.updateConnection('00000000-0000-4000-8000-000000000001', {
      state: 'revoked',
      credential_ref: null,
      revoked_at: '2026-09-15T11:30:00.000Z'
    });

    expect(seen).toHaveLength(1);
    expect(seen[0].url).toContain('connection_name=eq.default');
    const body = JSON.parse(String(seen[0].init.body));
    expect(body).toMatchObject({
      state: 'revoked',
      authorized: false,
      provider_verified: false
    });
  });
});
