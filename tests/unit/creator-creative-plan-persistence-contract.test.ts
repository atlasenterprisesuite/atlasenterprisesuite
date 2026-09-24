import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('CreativePlan persistence contract', () => {
  it('defines tenant-scoped creative plan storage with active-member RLS', () => {
    const migration = read('supabase/migrations/20260918141000_creator_creative_plans.sql');
    expect(migration).toContain('create table if not exists public.creator_creative_plans');
    expect(migration).toContain('organization_id uuid not null');
    expect(migration).toContain('plan_json jsonb not null');
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('organization_members');
    expect(migration).toContain('grant select on public.creator_creative_plans to authenticated');
  });

  it('scopes repository reads and writes by organization and optimistic version', () => {
    const repository = read('supabase/functions/atlas-creator/_shared/repository.ts');
    expect(repository).toContain("from('creator_creative_plans')");
    expect(repository).toContain(".eq('organization_id', ctx.orgId)");
    expect(repository).toContain(".eq('version', expectedVersion)");
    expect(repository).toContain('saveCreativePlan');
  });

  it('gates creative plan routes with creator read/write permissions', () => {
    const edge = read('supabase/functions/atlas-creator/index.ts');
    expect(edge).toContain("api === 'creative-plans'");
    expect(edge).toContain("api === 'creative-plan'");
    expect(edge).toContain("api === 'creative-plan-save'");
    expect(edge).toContain("creatorContext(req, 'creator.read')");
    expect(edge).toContain("creatorContext(req, 'creator.write')");
  });
});
