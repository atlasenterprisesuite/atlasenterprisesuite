import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const sql = readFileSync('supabase/migrations/20261102153000_atlas_owned_links_777.sql', 'utf8');
describe('ATLAS owned links SQL fail-closed structural contract', () => {
 it('uses existing organizations FK and explicit tenant scoping', () => {
  expect(sql).toMatch(/org_id\s+uuid\s+not\s+null\s+references\s+public\.organizations\(id\)/i);
  expect(sql).toMatch(/tenant_id\s+text\s+not\s+null/i);
  expect(sql).toMatch(/unique\s*\(org_id,\s*tenant_id,\s*slug\)/i);
 });
 it('forces RLS and revokes client table grants', () => {
  expect(sql).toMatch(/alter\s+table\s+public\.atlas_owned_links\s+enable\s+row\s+level\s+security/i);
  expect(sql).toMatch(/alter\s+table\s+public\.atlas_owned_links\s+force\s+row\s+level\s+security/i);
  expect(sql).toMatch(/revoke\s+all\s+on\s+public\.atlas_owned_links\s+from\s+public,\s*anon,\s*authenticated/i);
  expect(sql).not.toMatch(/create\s+policy\s+\w+\s+on\s+public\.atlas_owned_links/i);
 });
});
