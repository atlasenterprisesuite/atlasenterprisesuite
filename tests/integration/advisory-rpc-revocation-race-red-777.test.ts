import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * RED gate: detects missing explicit serialization between Advisory membership
 * checks and writes. This is static source analysis, NOT concurrent PostgreSQL
 * execution. A GREEN result must be followed by transactional E2E evidence.
 */
const sql = readFileSync('supabase/migrations/20261028090000_aw_finance_advisory_rpc_firm_membership.sql', 'utf8');
const names = ['advisory_create_client', 'advisory_create_engagement', 'advisory_set_launch_evidence'];

function body(name: string): string {
  const begin = sql.indexOf('create or replace function public.' + name + '(');
  expect(begin).toBeGreaterThanOrEqual(0);
  const end = sql.indexOf('\n$$;', begin);
  expect(end).toBeGreaterThan(begin);
  return sql.slice(begin, end);
}

describe('P0 RED: Advisory RPC authorization/revocation race', () => {
  it.each(names)('%s must have an explicit authorization serialization point before mutation', name => {
    const source = body(name);
    expect(source).toMatch(/is_advisory_firm_member\s*\(/i);
    const check = source.indexOf('is_advisory_firm_member(');
    const mutation = source.search(/\b(?:insert\s+into|update\s+public\.|delete\s+from)\b/i);
    expect(mutation).toBeGreaterThan(check);

    // A mere membership SELECT at READ COMMITTED is not a revocation lock.
    // Require a documented common locking strategy; later E2E must prove
    // revocation uses the same lock and honors deterministic commit order.
    const beforeMutation = source.slice(0, mutation);
    expect(beforeMutation).toMatch(/\bFOR\s+(?:NO\s+KEY\s+)?UPDATE\b|\bFOR\s+SHARE\b|\bpg_advisory_xact_lock\s*\(/i);
  });
});
