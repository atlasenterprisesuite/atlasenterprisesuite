import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync('supabase/migrations/20260924211000_atlas_knowledge_advisor_cleanup.sql', 'utf8');

describe('Knowledge Atlas Supabase advisor cleanup', () => {
  it('covers Library foreign keys used by provenance links', () => {
    expect(sql).toContain('atlas_library_assets_duplicate_of_idx');
    expect(sql).toContain('atlas_library_assets_memory_record_id_idx');
    expect(sql).toContain('on public.atlas_library_assets(duplicate_of)');
    expect(sql).toContain('on public.atlas_library_assets(memory_record_id)');
  });

  it('uses initplan-safe authenticated identity checks in Knowledge RLS', () => {
    expect(sql).toContain('atlas_library_assets_org_read');
    expect(sql).toContain('"atlas_memory_org_read"');
    expect(sql.match(/om\.user_id = \(select auth\.uid\(\)\)/g)?.length).toBe(2);
  });

  it('preserves restricted visibility to owner/admin/platform_admin roles', () => {
    expect(sql.match(/om\.role in \('owner','admin','platform_admin'\)/g)?.length).toBe(2);
  });
});
