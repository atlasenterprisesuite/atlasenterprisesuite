import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration=readFileSync('supabase/migrations/20260924005000_atlas_library_ingestion.sql','utf8');
const edge=readFileSync('supabase/functions/atlas-memory/index.ts','utf8');
const api=readFileSync('apps/web/src/modules/knowledge/memoryApi.ts','utf8');
const page=readFileSync('apps/web/src/modules/knowledge/KnowledgeAtlasPage.tsx','utf8');

describe('ATLAS Library ingestion contract', () => {
  it('creates an organization-scoped RLS registry', () => {
    expect(migration).toContain('create table if not exists public.atlas_library_assets');
    expect(migration).toContain('organization_id uuid not null');
    expect(migration).toContain('enable row level security');
    expect(migration).toContain("sensitivity in ('organization','restricted')");
    expect(migration).toContain('unique (organization_id, source_system, source_file_id)');
  });

  it('exposes module-filtered assets through ATLAS Memory', () => {
    expect(edge).toContain("api === 'library'");
    expect(edge).toContain("api === 'library-stats'");
    expect(edge).toContain(".contains('module_ids', [moduleId])");
    expect(api).toContain('listAtlasLibraryAssets');
    expect(api).toContain('getAtlasLibraryStats');
    expect(page).toContain('ATLAS Library Registry');
  });

  it('keeps writes server-side and provenance-linked', () => {
    expect(migration).toContain('source_file_id text not null');
    expect(migration).toContain('source_library_file_id text');
    expect(migration).toContain('revoke insert, update, delete on public.atlas_library_assets from authenticated');
    expect(page).not.toContain('Create fake library asset');
  });
});
