import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('ATLAS Web Launch persistence and API contract', () => {
  it('persists blueprints in a tenant-scoped RLS table', () => {
    const path = 'supabase/migrations/20260918153000_creator_web_launch_blueprints.sql';
    expect(existsSync(resolve(process.cwd(), path))).toBe(true);
    const sql = source(path);
    expect(sql).toContain('creator_web_launch_blueprints');
    expect(sql).toContain('organization_id uuid not null');
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('revoke all on public.creator_web_launch_blueprints from anon, authenticated');
  });

  it('uses organization-scoped repository operations with optimistic versioning', () => {
    const repository = source('supabase/functions/atlas-creator/_shared/repository.ts');
    expect(repository).toContain('listWebLaunchBlueprints');
    expect(repository).toContain('getWebLaunchBlueprint');
    expect(repository).toContain('saveWebLaunchBlueprint');
    expect(repository).toMatch(/from\('creator_web_launch_blueprints'\)[\s\S]*eq\('organization_id', orgId\)/);
    expect(repository).toContain("throw creatorError('version_conflict', 409)");
  });

  it('exposes permission-gated API routes and an audit write', () => {
    const edge = source('supabase/functions/atlas-creator/index.ts');
    expect(edge).toContain("'web-launch-blueprints'");
    expect(edge).toContain("'web-launch-blueprint'");
    expect(edge).toContain("'web-launch-save'");
    expect(edge).toContain("creatorContext(req, 'creator.read')");
    expect(edge).toContain("creatorContext(req, 'creator.write')");
    expect(edge).toContain("'creator.web_launch.saved'");
  });

  it('provides typed browser list/get/save functions', () => {
    const client = source('apps/web/src/lib/creatorApi.ts');
    expect(client).toContain('listWebLaunchBlueprints');
    expect(client).toContain('getWebLaunchBlueprint');
    expect(client).toContain('saveWebLaunchBlueprint');
  });
});
