import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20260914_private_oracle.sql', 'utf8').toLowerCase();
const shell = readFileSync('apps/web/src/components/AtlasShell.tsx', 'utf8');
const resolver = readFileSync('apps/web/src/extensions/resolveAtlasExtension.tsx', 'utf8');
const routes = readFileSync('apps/web/src/modules/oracle/OracleRoutes.tsx', 'utf8');

describe('ATLAS Private Oracle privacy invariants', () => {
  it('binds private content policies to auth.uid ownership, not tenant admin roles', () => {
    expect(migration).toContain('(select auth.uid()) = user_id');
    expect(migration).not.toContain("role = 'admin'");
    expect(migration).not.toContain("role = 'owner'");
    expect(migration).not.toContain('is_platform_admin()');
  });

  it('does not expose Oracle in the global enterprise sidebar', () => {
    expect(shell).not.toContain("label: 'Oracle'");
    expect(shell).not.toContain("to: '/assistant/oracle'");
  });

  it('requires both ATLAS Identity and the private Oracle entitlement', () => {
    expect(resolver).toContain("pathname.startsWith('/assistant/oracle')");
    expect(resolver).toContain('<RequireAtlasIdentity><OracleRoutes /></RequireAtlasIdentity>');
    expect(routes).toContain('<RequireOracleEntitlement>');
  });

  it('uses an unambiguous entitlement function parameter', () => {
    expect(migration).toContain('has_oracle_entitlement(entitlement_key_value text');
    expect(migration).toContain('e.entitlement_key = entitlement_key_value');
  });
});
