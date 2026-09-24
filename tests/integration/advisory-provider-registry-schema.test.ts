import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  'supabase/migrations/20260921082000_advisory_external_provider_registry.sql',
  'utf8'
);

describe('Advisory external provider registry schema', () => {
  it('keeps shared provider infrastructure extensible without naming fake connected providers', () => {
    for (const table of [
      'atlas_oauth_states',
      'atlas_integration_credentials',
      'atlas_external_object_links',
      'atlas_integration_sync_runs'
    ]) {
      expect(sql).toContain(`alter table public.${table}`);
    }
    expect(sql).toContain("provider ~ '^[a-z][a-z0-9_-]{1,63}$'");
  });

  it('requires firm-scoped capability metadata before Advisory can consume a connection', () => {
    expect(sql).toContain("advisory_capability");
    expect(sql).toContain("advisory_firm_id");
    expect(sql).toContain('advisory_provider_firm_required');
    expect(sql).toContain('advisory_provider_capability_invalid');
  });

  it('writes Advisory audit evidence when provider connection truth changes', () => {
    expect(sql).toContain('insert into public.advisory_audit_events');
    expect(sql).toContain("'integration_connection'");
    expect(sql).toContain('atlas_advisory_provider_connection_audit');
    expect(sql).toMatch(/after insert or update or delete[\s\S]*on public\.atlas_integration_connections/i);
  });
});
