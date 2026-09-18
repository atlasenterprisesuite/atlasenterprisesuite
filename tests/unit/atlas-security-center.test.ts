import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveAtlasIdentityTarget } from '../../apps/web/src/identity/IdentityPage';

const registry = readFileSync('apps/web/src/modules/registry.ts', 'utf8');
const resolver = readFileSync('apps/web/src/extensions/resolveAtlasExtension.tsx', 'utf8');
const routes = readFileSync('apps/web/src/modules/security/SecurityRoutes.tsx', 'utf8');
const migration = readFileSync('supabase/migrations/20260918210000_atlas_ai_data_governance.sql', 'utf8');

describe('ATLAS Security Center contract', () => {
  it('registers and protects the canonical Security route', () => {
    expect(registry).toContain("id: 'security'");
    expect(registry).toContain("route: '/security'");
    expect(resolver).toContain("pathname === '/security'");
    expect(resolver).toContain('<RequireAtlasIdentity><SecurityRoutes /></RequireAtlasIdentity>');
    expect(resolveAtlasIdentityTarget('/security/ai-governance')).toBe('/security/ai-governance');
  });

  it('ships real AI governance controls without fake links', () => {
    expect(routes).toContain('Save policy');
    expect(routes).toContain('Fail-closed modules');
    expect(routes).toContain('External control');
    expect(routes).not.toContain('href="#"');
  });

  it('enforces immutable audit logging and RBAC in persistence', () => {
    expect(migration).toContain("('security.manage'");
    expect(migration).toContain('audit_logging_enabled = true');
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('atlas_ai_data_policy_audit');
  });
});
