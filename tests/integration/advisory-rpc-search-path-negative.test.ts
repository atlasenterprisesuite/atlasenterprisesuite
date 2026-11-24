import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync('supabase/migrations/20261028090000_aw_finance_advisory_rpc_firm_membership.sql', 'utf8');
const names = ['advisory_create_client', 'advisory_create_engagement', 'advisory_set_launch_evidence'];
describe('Advisory SECURITY DEFINER hardened search_path', () => {
  it.each(names)('%s pins trusted schema order and pg_temp last', name => {
    const start = sql.indexOf('create or replace function public.' + name + '(');
    expect(start).toBeGreaterThanOrEqual(0);
    const end = sql.indexOf('\n$$;', start);
    expect(end).toBeGreaterThan(start);
    const body = sql.slice(start, end);
    expect(body).toMatch(/security definer\s+set search_path = pg_catalog, public, pg_temp/i);
    expect(body).not.toMatch(/set search_path = public\s*\n/i);
  });
});
