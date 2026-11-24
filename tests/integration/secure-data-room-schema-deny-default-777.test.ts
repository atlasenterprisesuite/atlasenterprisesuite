import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const sql = readFileSync('supabase/migrations/20261102000100_atlas_data_room_deny_default.sql', 'utf8');

describe('Secure Data Room migration deny-default contract', () => {
  for (const table of ['atlas_data_room_documents', 'atlas_data_room_grants', 'atlas_data_room_access_events']) {
    it('enables and forces RLS on ' + table, () => {
      expect(sql).toContain('alter table public.' + table + ' enable row level security');
      expect(sql).toContain('alter table public.' + table + ' force row level security');
      expect(sql).toContain('revoke all on public.' + table + ' from public, anon, authenticated');
    });
  }
  it('binds document grants to the same organization and tenant', () => {
    expect(sql).toContain('foreign key (document_id, organization_id, tenant_id)');
    expect(sql).toContain('references public.atlas_data_room_documents(id, organization_id, tenant_id)');
  });
  it('does not create a permissive read policy or security-definer RPC', () => {
    expect(sql).not.toMatch(/create\s+policy\s/i);
    expect(sql).not.toMatch(/security\s+definer/i);
    expect(sql).not.toMatch(/grant\s+select\s+on/i);
  });
});
