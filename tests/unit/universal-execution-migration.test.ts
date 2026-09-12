import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync('supabase/migrations/20260912_universal_execution_core.sql', 'utf8');

const tables = [
  'atlas_workflows',
  'atlas_workflow_steps',
  'atlas_workflow_events',
  'atlas_approval_requests',
  'atlas_evidence',
  'atlas_provider_registry',
  'atlas_provider_probes',
  'atlas_usage_events',
  'atlas_document_sources',
  'atlas_document_fields'
];

describe('universal execution migration', () => {
  it('defines the canonical workflow tables', () => {
    for (const name of tables) expect(sql).toContain(`public.${name}`);
  });

  it('enforces active organization membership', () => {
    expect(sql).toContain('om.user_id = auth.uid()');
    expect(sql).toContain("om.status = 'active'");
  });

  it('enables RLS on every canonical table', () => {
    for (const name of tables) {
      expect(sql).toContain(`alter table public.${name} enable row level security`);
    }
  });

  it('keeps browser grants read-only', () => {
    for (const name of tables) {
      expect(sql).toContain(`revoke all on public.${name} from authenticated`);
      expect(sql).toContain(`grant select on public.${name} to authenticated`);
    }
  });
});
