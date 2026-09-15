import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  'supabase/migrations/20260914170000_atlas_crm_hubspot_integration.sql',
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

  it('extends OAuth state support to HubSpot without rewriting the historical migration', () => {
    expect(sql).toMatch(/alter table public\.atlas_oauth_states[\s\S]*drop constraint if exists atlas_oauth_states_provider_check/i);
    expect(sql).toMatch(/provider in \('google', 'hubspot'\)/i);
  });

  it('creates the four organization-scoped P0 persistence tables', () => {
    expect(sql).toContain('atlas_integration_connections');
    expect(sql).toContain('atlas_integration_credentials');
    expect(sql).toContain('atlas_external_object_links');
    expect(sql).toContain('atlas_integration_sync_runs');
    expect(sql).toMatch(/unique \(org_id, provider\)/i);
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
});
