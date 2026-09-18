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
    expect(sql).not.toMatch(/\bcredential\b/i);
    expect(sql).not.toMatch(/authorization_header/i);
  });

  it('keeps endpoint administration tenant-scoped and permission-gated', () => {
    expect(sql).toMatch(/atlas_local_network_endpoints_insert[\s\S]*device\.local\.admin/i);
    expect(sql).toMatch(/atlas_local_network_endpoints_update[\s\S]*device\.local\.admin/i);
    expect(sql).toMatch(/atlas_local_network_endpoints_delete[\s\S]*device\.local\.admin/i);
  });

  it('makes audit evidence append-only for authenticated clients', () => {
    expect(sql).toMatch(/grant select, insert on public\.atlas_local_network_events to authenticated/i);
    expect(sql).not.toMatch(/grant[^;]*(update|delete)[^;]*atlas_local_network_events[^;]*authenticated/i);
    expect(sql).toMatch(/actor_user_id = auth\.uid\(\)/i);
  });
});
