import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Negative contract test: fail until SECURITY DEFINER writes validate firm membership.
// No database connection or production credentials are needed.
const sql = readFileSync('supabase/migrations/20260918031500_advisory_office_core.sql', 'utf8');
function functionBody(name: string): string {
  const start = sql.indexOf('create or replace function public.' + name + '(');
  expect(start, name + ' must exist').toBeGreaterThanOrEqual(0);
  const end = sql.indexOf('\nend\n$$;', start);
  expect(end, name + ' must have an explicit body').toBeGreaterThan(start);
  return sql.slice(start, end);
}

describe('AW Finance Cycle 02: SECURITY DEFINER negative contract', () => {
  it.each(['advisory_create_client', 'advisory_create_engagement', 'advisory_set_launch_evidence'])(
    '%s requires active firm membership, not organization permission alone',
    (name) => {
      const body = functionBody(name);
      expect(body).toMatch(/is_advisory_firm_member\s*\(/i);
    }
  );
});
