import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync('supabase/migrations/20260912_creator_director.sql', 'utf8');

describe('ATLAS Director schema contract', () => {
  it('creates four organization-scoped RLS tables', () => {
    for (const table of ['creator_productions', 'creator_provider_instances', 'creator_generation_jobs', 'creator_assets']) {
      expect(sql).toContain(`public.${table}`);
    }
    expect(sql.match(/enable row level security/g)?.length).toBe(4);
    expect(sql).toContain('organization_members');
    expect(sql).toContain('auth.uid()');
  });

  it('contains no provider-secret columns', () => {
    expect(sql).not.toMatch(/api_key|access_token|refresh_token|private_key|provider_secret/i);
  });
});
