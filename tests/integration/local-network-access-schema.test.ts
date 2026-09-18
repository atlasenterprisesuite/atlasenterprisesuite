import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  'supabase/migrations/20260918210000_atlas_local_network_access.sql',
  'utf8'
);

describe('ATLAS Local Network Access schema contract', () => {
  it('registers separate read, use and admin permissions', () => {
    for (const permission of ['device.local.read', 'device.local.use', 'device.local.admin']) {
      expect(sql).toContain(`'${permission}'`);
    }
  });

  it('persists only explicit endpoint policy and safe evidence', () => {
    expect(sql).toContain('atlas_local_network_endpoints');
    expect(sql).toContain('atlas_local_network_events');
    expect(sql).not.toMatch(/\bpayload\b/i);
    expect(sql).not.toMatch(/\b(ciphertext|secret_ref|access_token|refresh_token|authorization_header)\b/i);
  });

  it('keeps endpoint administration tenant-scoped and permission-gated', () => {
    expect(sql).toMatch(/atlas_local_network_endpoints_insert[\s\S]*device\.local\.admin/i);
    expect(sql).toMatch(/atlas_local_network_endpoints_update[\s\S]*device\.local\.admin/i);
    expect(sql).toMatch(/atlas_local_network_endpoints_delete[\s\S]*device\.local\.admin/i);
  });

  it('sets update actor and timestamp in the database before policy evaluation', () => {
    expect(sql).toMatch(/create or replace function public\.atlas_touch_local_network_endpoint/i);
    expect(sql).toMatch(/new\.updated_by := auth\.uid\(\)/i);
    expect(sql).toMatch(/new\.updated_at := now\(\)/i);
    expect(sql).toContain('as $atlas_lna
  });

  it('makes audit evidence append-only for authenticated clients', () => {
    expect(sql).toMatch(/grant select, insert on public\.atlas_local_network_events to authenticated/i);
    expect(sql).not.toMatch(/grant[^;]*(update|delete)[^;]*atlas_local_network_events[^;]*authenticated/i);
    expect(sql).toMatch(/actor_user_id = auth\.uid\(\)/i);
  });
});
);
    expect(sql).toContain('$atlas_lna$;');
    expect(sql).toMatch(/new\.org_id is distinct from old\.org_id/i);
    expect(sql).toMatch(/new\.created_by is distinct from old\.created_by/i);
  });

  it('rejects cross-organization or origin-mismatched audit references', () => {
    expect(sql).toMatch(/create or replace function public\.atlas_validate_local_network_event/i);
    expect(sql).toMatch(/endpoint\.id = new\.endpoint_id/i);
    expect(sql).toMatch(/endpoint\.org_id = new\.org_id/i);
    expect(sql).toMatch(/endpoint\.origin = new\.origin/i);
    expect(sql).toMatch(/before insert on public\.atlas_local_network_events/i);
  });

  it('makes audit evidence append-only for authenticated clients', () => {
    expect(sql).toMatch(/grant select, insert on public\.atlas_local_network_events to authenticated/i);
    expect(sql).not.toMatch(/grant[^;]*(update|delete)[^;]*atlas_local_network_events[^;]*authenticated/i);
    expect(sql).toMatch(/actor_user_id = auth\.uid\(\)/i);
  });
});
