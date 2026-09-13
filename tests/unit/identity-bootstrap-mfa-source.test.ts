import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260913_harden_atlas_bootstrap_owner_aal2.sql',
);

describe('ATLAS owner bootstrap source security', () => {
  it('requires an AAL2 guard in the canonical migration', () => {
    expect(existsSync(migrationPath)).toBe(true);

    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.atlas_bootstrap_owner');
    expect(sql).toContain("coalesce(auth.jwt()->>'aal','aal1') <> 'aal2'");
    expect(sql).toContain("raise exception 'mfa_aal2_required'");
  });
});
