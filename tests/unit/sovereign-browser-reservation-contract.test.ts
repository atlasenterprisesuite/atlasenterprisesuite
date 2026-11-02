import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const sql=readFileSync('supabase/migrations/20261102091000_atlas_browser_reserve_transaction_777.sql','utf8');
describe('ATLAS 777 reservation transaction negative contract',()=>{
 it('requires database-derived identity',()=>{expect(sql).toContain('auth.uid()');expect(sql).toContain('v_actor is null');});
 it('serializes against membership revocation',()=>{expect(sql).toContain("m.status = 'active'");expect(sql).toContain('for share');});
 it('rejects duplicate keys rather than replay',()=>{expect(sql).toContain('on conflict (org_id,tenant_id,idempotency_key) do nothing');expect(sql).toContain('browser_duplicate_or_indeterminate');});
 it('does not expose the function to API roles',()=>{expect(sql).toContain('security invoker');expect(sql).toMatch(/revoke all on function public\.atlas_browser_reserve_777[\s\S]*from public, anon, authenticated/);expect(sql).not.toMatch(/grant execute/i);});
});
