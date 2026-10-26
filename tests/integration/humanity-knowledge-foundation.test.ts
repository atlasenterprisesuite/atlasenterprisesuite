import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const api = readFileSync('apps/web/src/modules/knowledge/memoryApi.ts', 'utf8');
const routes = readFileSync('apps/web/src/extensions/resolveAtlasExtension.tsx', 'utf8');
const rls = readFileSync('supabase/migrations/20260922033000_atlas_memory_core.sql', 'utf8');
const spec = readFileSync('docs/knowledge/humanity-atlas/README.md', 'utf8');

describe('Humanity Knowledge 777 foundation safety contract #897', () => {
  it('reuses organization-scoped Knowledge Atlas instead of anonymous memory access', () => {
    expect(api).toContain('getActiveAtlasOrganization');
    expect(api).toContain('authorizedAtlasFetch');
    expect(api).toContain("'x-atlas-org-id'");
    expect(routes).toContain("<RequireAtlasIdentity><KnowledgeAtlasPage /></RequireAtlasIdentity>");
  });

  it('retains tenant RLS and no anonymous reads on organizational memory', () => {
    expect(rls).toContain('enable row level security');
    expect(rls).toContain('om.org_id = atlas_memory_records.organization_id');
    expect(rls).toContain('om.user_id = auth.uid()');
    expect(rls).toContain('revoke all on table public.atlas_memory_records from anon');
  });

  it('keeps imported chats in draft pending approval', () => {
    expect(rls).toContain('Imported chat content remains draft unless explicitly approved.');
    expect(api).toContain("'chat_import'");
    expect(api).toContain("status: AtlasMemoryStatus");
  });

  it('preserves scientific and theological truth-state separation', () => {
    expect(spec).toContain('Historical, scientific, theological, and faith claims must retain separate truth-state labels.');
    expect(spec).toContain('evidence strength / confidence');
  });
});
