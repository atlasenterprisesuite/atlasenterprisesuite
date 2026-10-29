import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const original = readFileSync('supabase/migrations/20260918031500_advisory_office_core.sql', 'utf8');
const hardening = readFileSync('supabase/migrations/20261028092000_advisory_remaining_definer_search_path.sql', 'utf8');
describe('Advisory remaining privileged function and table ACL negative contract', () => {
  it.each(['advisory_bootstrap_default_firm', 'advisory_log_audit'])('%s has a forward-only pinned search_path', name => {
    expect(hardening).toContain('alter function public.' + name + '()');
    expect(hardening).toMatch(new RegExp('alter function public\\.' + name + '\\(\\)\\s+set search_path = pg_catalog, public, pg_temp', 'i'));
  });
  it('does not grant authenticated users direct advisory table writes', () => {
    expect(original).toMatch(/revoke all on public\.advisory_clients from anon, authenticated/i);
    expect(original).toMatch(/grant select on public\.advisory_clients to authenticated/i);
    expect(original).not.toMatch(/grant (?:insert|update|delete|all) on public\.advisory_clients to authenticated/i);
  });
});
