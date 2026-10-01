import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const migration = readFileSync(resolve(root, 'supabase/migrations/20261001014500_atlas_module_access_control.sql'), 'utf8');
const guard = readFileSync(resolve(root, 'apps/web/src/identity/RequireAtlasIdentity.tsx'), 'utf8');
const shell = readFileSync(resolve(root, 'apps/web/src/components/AtlasShell.tsx'), 'utf8');
const registry = readFileSync(resolve(root, 'apps/web/src/modules/registry.ts'), 'utf8');

describe('ATLAS canonical module access contract', () => {
  it('uses entitlement and RBAC together without granting browser write access', () => {
    expect(migration).toContain('atlas_module_entitlements');
    expect(migration).toContain('identity_role_permissions');
    expect(migration).toContain('atlas_module_access_snapshot');
    expect(migration).toContain("e.status in ('active','trial')");
    expect(migration).toContain('permission_ok');
    expect(migration).toContain("array['tax.read','tax.prepare','tax.review','tax.file','tax.admin']");
    expect(migration).toContain("array['frontier.read','frontier.play','frontier.manage']");
    expect(migration).toContain('revoke all on public.atlas_module_entitlements from public, anon, authenticated');
  });

  it('preserves existing organizations while new organizations are fail-closed', () => {
    expect(migration).toContain("'legacy_migration'");
    expect(migration).toContain('preserve_pre_entitlement_access');
    expect(migration).toContain("select o.id, r.module_id, 'active', 'legacy_migration'");
    expect(migration).toContain('from public.organizations o');
    expect(migration).not.toContain('after insert on public.organizations');
  });

  it('audits entitlement changes', () => {
    expect(migration).toContain('atlas_module_entitlement_audit');
    expect(migration).toContain('after insert or update or delete');
    expect(migration).toContain('actor_user_id');
    expect(migration).toContain('atlas_module_entitlement_audit_immutable');
    expect(migration).toContain('ATLAS module entitlement audit is immutable');
    expect(migration.indexOf('create trigger atlas_module_entitlements_audit')).toBeLessThan(migration.indexOf("select o.id, r.module_id, 'active', 'legacy_migration'"));
  });

  it('filters protected navigation and guards direct protected routes', () => {
    expect(registry).toContain('moduleId: module.id');
    expect(shell).toContain('getAtlasModuleAccessSnapshot');
    expect(shell).toContain('visibleNavItems');
    expect(shell).toContain('if (!organization) return !module.requiresAuth');
    expect(shell).toContain('accessibleModuleIds?.has(moduleId)');
    expect(shell).toContain("canSurfaceModule('assistant')");
    expect(shell).toContain("canSurfaceModule('connect')");
    expect(shell).toContain("canSurfaceModule('galaxy')");
    expect(guard).toContain('canAccessAtlasModule');
    expect(guard).toContain('if (module)');
    expect(guard).toContain("state === 'forbidden'");
  });
});
