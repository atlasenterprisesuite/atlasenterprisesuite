import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('supabase/functions/atlas-mobile/index.ts', 'utf8');

describe('ATLAS mobile gateway auth boundary', () => {
  it('requires an explicit bearer token and resolves the authenticated user', () => {
    expect(source).toContain("req.headers.get('authorization')");
    expect(source).toMatch(/Bearer\\s\+\\S\+/);
    expect(source).toContain('/auth/v1/user');
    expect(source).toContain("error: 'authentication_required'");
  });

  it('derives active organization scope from server-verified membership', () => {
    expect(source).toContain('organization_members?select=org_id,role,status');
    expect(source).toContain('status=eq.active');
    expect(source).toContain("req.headers.get('x-atlas-org-id')");
    expect(source).toContain("error: 'organization_membership_required'");
  });

  it('returns only the authenticated organization and role in status', () => {
    expect(source).toContain("api === 'status'");
    expect(source).toContain('organization_id: ctx.orgId');
    expect(source).toContain('role: ctx.role');
    expect(source).toContain('runtime_policy');
    expect(source).toContain('feature_states');
    expect(source).not.toContain('SUPABASE_SERVICE_ROLE_KEY:');
  });

  it('uses a browser origin allowlist and no-store responses', () => {
    expect(source).toContain('https://atlasenterprisesuite.com');
    expect(source).toContain('https://www.atlasenterprisesuite.com');
    expect(source).toContain("'cache-control':'no-store'");
    expect(source).toContain("'access-control-allow-origin'");
  });
});
