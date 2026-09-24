import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const hardening = readFileSync('supabase/migrations/20260924205000_atlas_knowledge_audit_hardening.sql', 'utf8');
const edge = readFileSync('supabase/functions/atlas-memory/index.ts', 'utf8');
const api = readFileSync('apps/web/src/modules/knowledge/memoryApi.ts', 'utf8');
const page = readFileSync('apps/web/src/modules/knowledge/KnowledgeAtlasPage.tsx', 'utf8');
const people = readFileSync('apps/web/src/modules/people/PeopleKnowledgePage.tsx', 'utf8');
const production = readFileSync('.github/workflows/global-production-verify.yml', 'utf8');

describe('Knowledge Atlas audit hardening', () => {
  it('does not leak restricted aggregate metadata to ordinary members', () => {
    expect(hardening).toContain("p_role in ('owner','admin','platform_admin') or a.sensitivity = 'organization'");
    expect(hardening).toContain("when p_role in ('owner','admin','platform_admin')");
    expect(hardening).toContain("else 0");
    expect(edge).toContain("rpc('atlas_library_stats'");
  });

  it('searches before pagination instead of filtering a truncated client-side window', () => {
    expect(hardening).toContain('create or replace function public.atlas_memory_search');
    expect(hardening).toContain('create or replace function public.atlas_library_search');
    expect(hardening).toContain('position(');
    expect(hardening).toContain('count(*) over() as total_count');
    expect(edge).toContain('p_limit: limit');
    expect(edge).toContain('p_offset: offset');
    expect(edge).not.toContain('.limit(250)');
    expect(edge).not.toContain('.limit(500)');
  });

  it('keeps search, pagination and cancellation on the canonical API boundary', () => {
    expect(api).toContain('limit?: number');
    expect(api).toContain('offset?: number');
    expect(api).toContain('signal?: AbortSignal');
    expect(api).toContain("params.set('offset'");
    expect(page).toContain('useDebouncedValue');
    expect(page).toContain('new AbortController()');
    expect(page).toContain('Load more assets');
    expect(page).toContain('Load more memory');
  });

  it('locks HR Knowledge to People while preserving the shared Knowledge Atlas store', () => {
    expect(people).toContain('moduleScope="people"');
    expect(page).toContain('const effectiveModule = moduleScope || moduleFilter');
    expect(page).toContain('<span>Module scope</span>');
    expect(page).toContain('aria-readonly="true"');
    expect(page).not.toContain('assets.slice(0, 120)');
  });

  it('uses accurate approval language and explicit accessible live states', () => {
    expect(page).toContain('Approved organizational knowledge');
    expect(page).not.toContain('Governed organizational truth');
    expect(page).toContain('aria-labelledby="knowledge-atlas-heading"');
    expect(page).toContain('aria-labelledby="atlas-library-heading"');
    expect(page).toContain('aria-live="polite"');
    expect(page).toContain('role="alert"');
    expect(page).toContain('role="status"');
  });

  it('keeps Knowledge Atlas in the fail-closed production verification contract', () => {
    expect(production).toContain('knowledge_route_reachable');
    expect(production).toContain('KNOWLEDGE_OK');
    expect(production).toContain('[ "$KNOWLEDGE_OK" = "true" ]');
  });

  it('keeps privileged search RPCs service-role only', () => {
    for (const fn of ['atlas_memory_search','atlas_memory_stats','atlas_library_search','atlas_library_stats']) {
      expect(hardening).toContain(`grant execute on function public.${fn}`);
    }
    expect(hardening).toContain('from public, anon, authenticated');
  });
});
