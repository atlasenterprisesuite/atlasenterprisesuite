import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  'supabase/migrations/20260914170000_atlas_crm_hubspot_integration.sql',
  'utf8'
);
const crmPolicySql = readFileSync(
  'supabase/migrations/20260918191500_crm_integration_policy_consolidation.sql',
  'utf8'
);

describe('ATLAS CRM HubSpot schema contract', () => {
  it('registers canonical integration and CRM permissions', () => {
    for (const permission of [
      'integrations.read',
      'integrations.write',
      'integrations.admin',
      'crm.read',
      'crm.sync',
      'crm.admin'
    ]) {
      expect(sql).toContain(`'${permission}'`);
    }
  });

  it('bootstraps the OAuth state registry when historical Google schema is absent', () => {
    expect(sql).toMatch(/create table if not exists public\.atlas_oauth_states/i);
    expect(sql).toMatch(/provider text not null[\s\S]*provider in \('google', 'hubspot'\)/i);
    expect(sql).toMatch(/constraint atlas_oauth_states_provider_nonce_unique unique \(provider, nonce_hash\)/i);
  });

  it('keeps OAuth state support compatible with both Google and HubSpot', () => {
    expect(sql).toMatch(/alter table public\.atlas_oauth_states[\s\S]*drop constraint if exists atlas_oauth_states_provider_check/i);
    expect(sql).toMatch(/provider in \('google', 'hubspot'\)/i);
    expect(sql).toContain("'integrations.manage'");
  });

  it('extends the canonical shared integration registry instead of assuming a new table shape', () => {
    for (const column of [
      'provider_account_id',
      'provider_account_label',
      'granted_scopes',
      'credential_ref',
      'last_verified_at',
      'last_success_at',
      'last_error_code',
      'last_error_at',
      'connected_by',
      'connected_at',
      'revoked_at'
    ]) {
      expect(sql).toMatch(
        new RegExp(`alter table public\\.atlas_integration_connections[\\s\\S]*add column if not exists ${column}\\b`, 'i')
      );
    }
    expect(sql).not.toMatch(/constraint atlas_integration_connections_org_provider_key unique \(org_id, provider\)/i);
  });

  it('creates the remaining organization-scoped P0 persistence tables', () => {
    expect(sql).toContain('atlas_integration_credentials');
    expect(sql).toContain('atlas_external_object_links');
    expect(sql).toContain('atlas_integration_sync_runs');
    expect(sql).toMatch(/unique \([\s\S]*org_id,[\s\S]*provider,[\s\S]*provider_account_id,[\s\S]*provider_object_type,[\s\S]*provider_object_id[\s\S]*\)/i);
  });

  it('keeps encrypted credential rows service-only', () => {
    expect(sql).toMatch(/alter table public\.atlas_integration_credentials enable row level security/i);
    expect(sql).toMatch(/revoke all on public\.atlas_integration_credentials from anon, authenticated/i);
    expect(sql).toMatch(/grant all on public\.atlas_integration_credentials to service_role/i);
    expect(sql).not.toMatch(/create policy [^\n]*credential[^\n]*select/i);
  });

  it('allows authenticated users to select only safe metadata under organization-scoped RLS', () => {
    expect(sql).toMatch(/create policy atlas_integration_connections_select[\s\S]*has_identity_permission\(org_id, 'integrations\.read'\)/i);
    expect(sql).toMatch(/create policy atlas_external_object_links_select[\s\S]*has_identity_permission\(org_id, 'crm\.read'\)/i);
    expect(sql).toMatch(/create policy atlas_integration_sync_runs_select[\s\S]*has_identity_permission\(org_id, 'crm\.read'\)/i);
  });

  it('stores no CRM payload column in links or sync evidence tables', () => {
    expect(sql).not.toMatch(/atlas_external_object_links[\s\S]{0,1000}\bpayload\b/i);
    expect(sql).not.toMatch(/atlas_integration_sync_runs[\s\S]{0,800}\bpayload\b/i);
  });

  it('consolidates integration reads onto one canonical policy', () => {
    expect(crmPolicySql).toContain('drop policy if exists atlas_integration_connections_select');
    expect(crmPolicySql).toContain('drop policy if exists atlas_integration_connections_read');
    expect(crmPolicySql).toMatch(/create policy atlas_integration_connections_read[\s\S]*integrations\.read/i);
  });
});
