import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('Advisory firm-scope RLS hardening', () => {
  it('requires active firm membership in addition to organization permission', () => {
    const path = resolve(root, 'supabase/migrations/20260918033500_advisory_firm_scope_rls.sql');
    expect(existsSync(path)).toBe(true);
    const sql = readFileSync(path, 'utf8');

    expect(sql).toContain('public.is_advisory_firm_member');
    expect(sql).toContain('public.advisory_firm_memberships');
    expect(sql).toContain('om.user_id = auth.uid()');
    expect(sql).toContain("afm.status = 'active'");
    expect(sql).toContain("om.status = 'active'");

    for (const policy of [
      'advisory_firms_read',
      'advisory_clients_read',
      'advisory_engagements_read',
      'advisory_launch_read',
      'advisory_audit_read'
    ]) {
      expect(sql).toContain(policy);
    }

    expect(sql).toMatch(/advisory_clients_read[\s\S]*has_identity_permission\(org_id, 'advisory\.read'\)[\s\S]*is_advisory_firm_member\(org_id, firm_id\)/);
    expect(sql).toMatch(/advisory_engagements_read[\s\S]*has_identity_permission\(org_id, 'advisory\.read'\)[\s\S]*is_advisory_firm_member\(org_id, firm_id\)/);
    expect(sql).toMatch(/advisory_launch_read[\s\S]*has_identity_permission\(org_id, 'advisory\.read'\)[\s\S]*is_advisory_firm_member\(org_id, firm_id\)/);
  });
});
