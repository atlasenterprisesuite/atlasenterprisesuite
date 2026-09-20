import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  'supabase/migrations/20260920154000_atlas_github_webhook_delivery_dedupe.sql',
  'utf8',
);

describe('ATLAS GitHub webhook delivery persistence', () => {
  it('deduplicates deliveries inside tenant and organization scope', () => {
    expect(sql).toContain('create table if not exists public.atlas_github_webhook_deliveries');
    expect(sql).toContain('primary key (tenant_id, organization_id, delivery_id)');
    expect(sql).toContain('on conflict (tenant_id, organization_id, delivery_id) do nothing');
    expect(sql).toContain('get diagnostics inserted_count = row_count');
  });

  it('keeps the table private and exposes only the token-gated claim RPC', () => {
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('revoke all on public.atlas_github_webhook_deliveries from anon, authenticated');
    expect(sql).toContain('private.atlas_orchestrator_runtime_authorized()');
    expect(sql).toContain('security definer');
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain('public.atlas_orchestrator_claim_github_delivery');
  });
});
