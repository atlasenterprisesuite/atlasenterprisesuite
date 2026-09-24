import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync('supabase/migrations/20260912_creator_director.sql', 'utf8');
const hardeningPath = 'supabase/migrations/20260915094600_creator_director_hardening.sql';
const hardeningSql = existsSync(hardeningPath) ? readFileSync(hardeningPath, 'utf8') : '';

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

  it('hardens Creator RLS evaluation and foreign-key coverage incrementally', () => {
    expect(hardeningSql).toContain('drop policy if exists creator_productions_member_read');
    expect(hardeningSql).toContain('drop policy if exists creator_provider_instances_member_read');
    expect(hardeningSql).toContain('drop policy if exists creator_generation_jobs_member_read');
    expect(hardeningSql).toContain('drop policy if exists creator_assets_member_read');
    expect(hardeningSql.match(/\(select auth\.uid\(\)\)/g)?.length).toBe(4);

    expect(hardeningSql).toContain('creator_generation_jobs_production_id_idx');
    expect(hardeningSql).toContain('creator_assets_production_id_idx');
    expect(hardeningSql).toContain('creator_assets_generation_job_id_idx');
    expect(hardeningSql).not.toMatch(/api_key|access_token|refresh_token|private_key|provider_secret/i);
  });
});
