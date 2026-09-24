import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('ATLAS Content Intelligence persistence boundary', () => {
  it('stores workspaces in a tenant-scoped RLS table', () => {
    const sql = source('supabase/migrations/20260915043000_creator_content_intelligence.sql');
    expect(sql).toContain('create table if not exists public.creator_content_workspaces');
    expect(sql).toContain('organization_id uuid not null');
    expect(sql).toContain('state_json jsonb not null');
    expect(sql).toContain('version integer not null default 1');
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('creator_content_workspaces_org_updated_idx');
  });

  it('keeps list/get/save repository access organization scoped with optimistic versioning', () => {
    const repository = source('supabase/functions/atlas-creator/_shared/repository.ts');
    expect(repository).toContain('listContentWorkspaces');
    expect(repository).toContain('getContentWorkspace');
    expect(repository).toContain('saveContentWorkspace');
    expect(repository).toMatch(/from\('creator_content_workspaces'\)[\s\S]*eq\('organization_id', orgId\)/);
    expect(repository).toContain(".eq('organization_id', ctx.orgId)");
    expect(repository).toContain(".eq('version', expectedVersion)");
    expect(repository).toContain("creatorError('version_conflict', 409)");
  });

  it('exposes read/read/write Edge routes and audits successful saves', () => {
    const edge = source('supabase/functions/atlas-creator/index.ts');
    expect(edge).toContain("api === 'content-workspaces'");
    expect(edge).toContain("api === 'content-workspace'");
    expect(edge).toContain("api === 'content-save'");
    expect(edge).toContain("creatorContext(req, 'creator.read')");
    expect(edge).toContain("creatorContext(req, 'creator.write')");
    expect(edge).toContain("'creator.content.saved'");
  });

  it('provides typed web client wrappers for list, get and save', () => {
    const client = source('apps/web/src/lib/creatorApi.ts');
    expect(client).toContain('listContentWorkspaces');
    expect(client).toContain('getContentWorkspace');
    expect(client).toContain('saveContentWorkspace');
    expect(client).toContain("creatorRequest<{ ok: true; workspaces:");
    expect(client).toContain("creatorRequest<{ ok: true; workspace:");
    expect(client).toContain("'content-save'");
  });
});
