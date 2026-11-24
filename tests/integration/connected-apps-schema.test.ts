import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const path = 'supabase/migrations/20261005130000_atlas_connected_apps_control_plane.sql';
const sql = readFileSync(path, 'utf8');

describe('Connected Apps persistence contract', () => {
  it('extends the canonical integration registry without replacing legacy connection state', () => {
    expect(sql).toContain('alter table public.atlas_integration_connections');
    expect(sql).toContain('add column if not exists expires_at');
    expect(sql).toContain('add column if not exists last_error_summary');
    expect(sql).toContain("unconfigured");
    expect(sql).not.toMatch(/drop\s+table\s+(if\s+exists\s+)?public\.atlas_integration_connections/i);
  });

  it('creates organization-scoped capability policy audit and retention tables', () => {
    for (const table of [
      'atlas_connected_app_capabilities',
      'atlas_connected_app_policies',
      'atlas_connected_app_access_events',
      'atlas_connected_app_data_ledger'
    ]) {
      expect(sql).toContain(`create table if not exists public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it('registers the nine namespaced permissions for owner and admin', () => {
    for (const permission of [
      'connected_apps.read', 'connected_apps.connect', 'connected_apps.manage',
      'connected_apps.disconnect', 'connected_apps.policy.read', 'connected_apps.policy.manage',
      'connected_apps.audit.read', 'connected_apps.retention.manage', 'connected_apps.agent.use'
    ]) {
      expect(sql).toContain(`'${permission}'`);
    }
    expect(sql).toContain("('owner', 'connected_apps.read')");
    expect(sql).toContain("('admin', 'connected_apps.manage')");
  });

  it('never grants browser roles access to provider credentials', () => {
    expect(sql).not.toMatch(/grant\s+(select|all|insert|update|delete)[\s\S]{0,120}atlas_integration_credentials[\s\S]{0,80}authenticated/i);
    expect(sql).toContain('service_role');
  });

  it('does not create cross-organization write policies', () => {
    expect(sql).toContain('org_id');
    expect(sql).toContain('has_identity_permission');
    expect(sql).not.toContain('using (true)');
    expect(sql).not.toContain('with check (true)');
  });
});
