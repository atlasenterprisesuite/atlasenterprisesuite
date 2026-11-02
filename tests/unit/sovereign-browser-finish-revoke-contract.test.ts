import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const sql=readFileSync(new URL('../../supabase/migrations/20261102092000_atlas_browser_finish_revoke_777.sql',import.meta.url),'utf8');
describe('ATLAS 777 browser finalization and revocation contract',()=>{
  it('derives finalization identity from authenticated database context',()=>{
    expect(sql).toContain('auth.uid()');
    expect(sql).toContain('b.actor_user_id = v_actor');
  });
  it('locks membership before reservation',()=>{
    const finish=sql.split('create or replace function public.atlas_browser_finish_777')[1].split('revoke all on function')[0];
    expect(finish.indexOf('from public.organization_members')).toBeLessThan(finish.indexOf('from public.execution_browser_idempotency'));
    expect(finish).toContain('for share');
    expect(finish).toContain('for update');
  });
  it('permits only reserved to terminal transition',()=>{
    expect(sql).toContain("p_state not in ('completed','indeterminate')");
    expect(sql).toContain("b.state = 'reserved'");
    expect(sql).toContain("where id = v_row and state = 'reserved'");
  });
  it('denies API execution of both functions',()=>{
    expect(sql).toContain('security invoker');
    expect(sql).toMatch(/revoke all on function public\.atlas_browser_finish_777[\s\S]*from public, anon, authenticated/);
    expect(sql).toMatch(/revoke all on function public\.atlas_browser_revoke_actor_777[\s\S]*from public, anon, authenticated/);
    expect(sql).not.toMatch(/grant execute/i);
  });
});
