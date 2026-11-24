import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationsRoot = 'supabase/migrations';
const migrations = readdirSync(migrationsRoot)
  .filter((name) => name.endsWith('.sql'))
  .sort();

const readMigration = (name: string) =>
  readFileSync(`${migrationsRoot}/${name}`, 'utf8').toLowerCase();

describe('Supabase Preview historical baseline', () => {
  it('restores the production foundation before feature migrations reference it', () => {
    const core = '20260808183211_atlas_core_schema.sql';
    const identity = '20260809032705_atlas_identity_foundation.sql';
    const googleWorkspace = '20260906034500_google_workspace_integration.sql';

    expect(migrations).toContain(core);
    expect(migrations).toContain(identity);
    expect(migrations.indexOf(core)).toBeLessThan(migrations.indexOf(identity));
    expect(migrations.indexOf(identity)).toBeLessThan(migrations.indexOf(googleWorkspace));

    expect(readMigration(core)).toContain('create table if not exists public.organizations');
    expect(readMigration(core)).toContain('create table if not exists public.organization_members');
    expect(readMigration(identity)).toContain('create table if not exists public.identity_permissions');
    expect(readMigration(identity)).toContain('create table if not exists public.identity_role_permissions');
    expect(readMigration(identity)).toContain('create or replace function public.has_identity_permission');
  });

  it('keeps the accounting and infrastructure dependencies ahead of their hardening migrations', () => {
    const infraFoundation = '20260906181040_schedule_public_infra_verification.sql';
    const accounting = '20260818201734_atlas_autonomous_accounting_foundation.sql';
    const infraHardening = '20260910_harden_public_infra_verification.sql';
    const accountingHardening = '20260911192327_harden_accounting_period_close.sql';

    expect(migrations.indexOf(infraFoundation)).toBeLessThan(migrations.indexOf(infraHardening));
    expect(migrations.indexOf(accounting)).toBeLessThan(migrations.indexOf(accountingHardening));
    expect(readMigration(infraFoundation)).toContain('create or replace function public.atlas_run_public_infra_verification');
    expect(readMigration(accounting)).toContain('accounting_periods');
  });

  it('preserves the exact historical version boundary recovered from production', () => {
    const historical = migrations.filter((name) => name < '20260906034500_');

    expect(historical).toHaveLength(98);
    expect(historical[0]).toBe('20260808183211_atlas_core_schema.sql');
    expect(historical.at(-1)).toBe('20260904153041_govern_accounting_close_assets_settings.sql');
    expect(new Set(historical.map((name) => name.slice(0, 14))).size).toBe(historical.length);
  });
});
