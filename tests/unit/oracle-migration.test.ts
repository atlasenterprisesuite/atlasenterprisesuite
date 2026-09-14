import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationPath = 'supabase/migrations/20260914_private_oracle.sql';

describe('private oracle migration', () => {
  it('creates a dedicated private entitlement and owner-only RLS', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();
    expect(sql).toContain("'atlas.oracle.private'");
    expect(sql).toContain('auth.uid()');
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('oracle_entitlements');
    expect(sql).toContain('oracle_readings');
    expect(sql).toContain('oracle_reading_cards');
    expect(sql).toContain('oracle_notes');
    expect(sql).toContain('oracle_favorites');
  });

  it('snapshots current enabled platform admins without auto-granting future admins', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();
    expect(sql).toContain('insert into public.oracle_entitlements');
    expect(sql).toContain('from public.atlas_platform_admins');
    expect(sql).toContain('where enabled = true');
    expect(sql).not.toContain('create trigger oracle_entitlement');
  });

  it('reports the deck truthfully as incomplete at seven of forty-four cards', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();
    expect(sql).toContain('expected_card_count');
    expect(sql).toContain('verified_card_count');
    expect(sql).toContain('44');
    expect(sql).toContain('7');
    expect(sql).toContain('false');
  });

  it('does not grant reading access from organization role alone', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();
    expect(sql).toContain('(select auth.uid()) = user_id');
    expect(sql).not.toContain("role = 'admin'");
    expect(sql).not.toContain("role = 'owner'");
  });
});
