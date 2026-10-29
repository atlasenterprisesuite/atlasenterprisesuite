import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Static regression guard; live revocation and tenant E2E tests remain required.
const sql = readFileSync('supabase/migrations/20261028090000_aw_finance_advisory_rpc_firm_membership.sql', 'utf8');
function functionBody(name: string): string {
  const start = sql.indexOf('create or replace function public.' + name + '(');
  expect(start, name + ' must exist in the corrective migration').toBeGreaterThanOrEqual(0);
  const end = sql.indexOf('\n$$;', start);
  expect(end, name + ' must have an explicit body').toBeGreaterThan(start);
  return sql.slice(start, end);
}

describe('AW Finance Cycle 02: SECURITY DEFINER firm membership regression', () => {
  it.each(['advisory_create_client', 'advisory_create_engagement', 'advisory_set_launch_evidence'])(
    '%s requires active firm membership in the corrective definition',
    (name) => {
      const body = functionBody(name);
      expect(body).toMatch(/if not public\.is_advisory_firm_member\s*\(v_org,\s*(?:p_firm_id|v_firm)\) then raise exception/i);
      expect(body).toContain('Active Advisory firm membership required');
      expect(body).toContain("has_identity_permission(v_org, 'advisory.manage')");
    }
  );
  it('resolves engagement firm before checking membership on evidence writes', () => {
    const body = functionBody('advisory_set_launch_evidence');
    expect(body.indexOf('if v_firm is null')).toBeLessThan(body.indexOf('is_advisory_firm_member(v_org, v_firm)'));
  });
});
