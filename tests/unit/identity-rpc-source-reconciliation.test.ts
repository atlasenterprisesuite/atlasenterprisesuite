import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260915170000_reconcile_identity_rpc_surface.sql'
);

describe('ATLAS Identity privileged RPC source reconciliation', () => {
  it('keeps the production identity RPC surface reproducible from canonical migrations', () => {
    expect(existsSync(migrationPath)).toBe(true);
    if (!existsSync(migrationPath)) return;

    const sql = readFileSync(migrationPath, 'utf8');
    for (const fn of [
      'accept_identity_invitation',
      'atlas_list_client_organizations',
      'atlas_provision_client_organization',
      'create_identity_invitation',
      'create_organization',
      'list_identity_invitations',
      'list_identity_members',
      'list_identity_security_events',
      'revoke_identity_invitation',
      'set_identity_member_role',
      'set_identity_member_status',
      'set_identity_role_permission'
    ]) {
      expect(sql).toContain(`FUNCTION public.${fn}`);
    }

    expect(sql).toContain("auth.jwt()->>'aal'");
    expect(sql).toContain("'aal2'");
    expect(sql).toContain('members.manage');
    expect(sql).toContain('identity.manage');
    expect(sql).toContain('REVOKE EXECUTE');
    expect(sql).toContain('GRANT EXECUTE');
  });
});
