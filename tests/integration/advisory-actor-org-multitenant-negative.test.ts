import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Static fail-closed contract. Transactional tests with two identities are still required.
const sql = readFileSync('supabase/migrations/20261028091000_advisory_actor_org_fail_closed.sql', 'utf8');
describe('Advisory actor organization: multi-org negative gate', () => {
  it('replaces the legacy resolver rather than selecting the first UUID', () => {
    expect(sql).toContain('create or replace function public.advisory_actor_org()');
    expect(sql).not.toMatch(/order by\s+om\.org_id/i);
    expect(sql).not.toMatch(/limit\s+1/i);
  });
  it('requires exactly one active organization and denies ambiguous or absent membership', () => {
    expect(sql).toMatch(/count\(\*\)\s*=\s*1/i);
    expect(sql).toMatch(/else\s+null::uuid/i);
    expect(sql).toMatch(/om\.status\s*=\s*'active'/i);
    expect(sql).toMatch(/om\.user_id\s*=\s*auth\.uid\(\)/i);
  });
  it('retains restricted execute permissions', () => {
    expect(sql).toMatch(/revoke all on function public\.advisory_actor_org\(\) from public/i);
    expect(sql).toMatch(/grant execute on function public\.advisory_actor_org\(\) to authenticated/i);
  });
});
