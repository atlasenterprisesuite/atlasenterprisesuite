import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20260922033000_atlas_memory_core.sql', 'utf8');
const edge = readFileSync('supabase/functions/atlas-memory/index.ts', 'utf8');
const api = readFileSync('apps/web/src/modules/knowledge/memoryApi.ts', 'utf8');
const page = readFileSync('apps/web/src/modules/knowledge/KnowledgeAtlasPage.tsx', 'utf8');
const resolver = readFileSync('apps/web/src/extensions/resolveAtlasExtension.tsx', 'utf8');
const registry = readFileSync('apps/web/src/modules/registry.ts', 'utf8');
const production = readFileSync('data/ops/global-production-verification.json', 'utf8');

describe('ATLAS Memory / Knowledge Layer', () => {
  it('persists organization-scoped knowledge with RLS and no direct browser mutations', () => {
    expect(migration).toContain('create table if not exists public.atlas_memory_records');
    expect(migration).toContain('organization_members');
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('revoke insert, update, delete');
    expect(migration).toContain("om.role in ('owner','admin','platform_admin')");
    expect(migration).toContain("status in ('draft','approved','superseded')");
  });

  it('requires authenticated membership and audits server-side mutations', () => {
    expect(edge).toContain("req.headers.get('authorization')");
    expect(edge).toContain("from('organization_members')");
    expect(edge).toContain("from('audit_logs')");
    expect(edge).toContain("table_name: 'atlas_memory_records'");
    expect(edge).toContain("new Set(['owner','admin','platform_admin'])");
    expect(edge).toContain("query = query.eq('sensitivity', 'organization')");
    expect(edge).toContain('memory_restricted_role_required');
  });

  it('keeps chat imports fail-closed until explicit approval', () => {
    expect(edge).toContain("sourceType === 'chat_import'");
    expect(edge).toContain("status: 'draft'");
    expect(edge).toContain("input.approve === true");
    expect(page).toContain('Personal conversations are not ingested automatically');
    expect(page).toContain('Save draft');
  });

  it('uses the canonical authenticated API boundary', () => {
    expect(api).toContain('authorizedAtlasFetch');
    expect(api).toContain('getActiveAtlasOrganization');
    expect(api).toContain('/functions/v1/atlas-memory');
    expect(api).not.toContain("from('atlas_memory_records')");
  });

  it('registers protected Knowledge Atlas routing and production verification', () => {
    expect(resolver).toContain("pathname === '/knowledge'");
    expect(resolver).toContain('<RequireAtlasIdentity><KnowledgeAtlasPage /></RequireAtlasIdentity>');
    expect(registry).toContain("id: 'knowledge'");
    expect(registry).toContain("route: '/knowledge'");
    expect(production).toContain('"/knowledge"');
  });

  it('does not embed provider secrets or paid model configuration', () => {
    expect(edge).not.toMatch(/OPENAI_API_KEY|GEMINI_API_KEY|ANTHROPIC_API_KEY|STRIPE_SECRET/i);
  });
});
