import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sharedPath = 'supabase/functions/_shared/atlas-intelligence-auth.mjs';
const legacyPath = 'supabase/functions/atlas-copilot/atlas-intelligence-auth.mjs';

describe('ATLAS shared intelligence identity resolver', () => {
  it('preserves production default-organization and organization RBAC semantics', () => {
    expect(existsSync(sharedPath)).toBe(true);
    const source = readFileSync(sharedPath, 'utf8');
    expect(source).toContain('atlas_resolve_default_org');
    expect(source).toContain('organization_role_permissions');
    expect(source).toContain('intelligence.use');
    expect(source).toContain('x-atlas-org-id');
  });

  it('keeps the existing Copilot import compatible without duplicating auth logic', () => {
    expect(existsSync(legacyPath)).toBe(true);
    const source = readFileSync(legacyPath, 'utf8');
    expect(source).toContain("../_shared/atlas-intelligence-auth.mjs");
    expect(source).not.toContain('organization_members?select=');
  });
});
