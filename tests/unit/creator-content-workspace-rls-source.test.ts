import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260915170100_harden_creator_content_workspace_rls.sql'
);

describe('creator content workspace RLS boundary', () => {
  it('keeps browser roles denied while service-role creator persistence remains the only write path', () => {
    expect(existsSync(migrationPath)).toBe(true);
    if (!existsSync(migrationPath)) return;

    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();
    expect(sql).toContain('alter table public.creator_content_workspaces enable row level security');
    expect(sql).toContain('as restrictive');
    expect(sql).toContain('to anon, authenticated');
    expect(sql).toContain('using (false)');
    expect(sql).toContain('with check (false)');
  });
});
