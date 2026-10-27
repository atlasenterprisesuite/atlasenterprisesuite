import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const sql = readFileSync('supabase/migrations/20261025120000_execution_claim_runtime_job_777.sql', 'utf8');
const runtime = readFileSync('supabase/functions/atlas-execution/work-runtime.ts', 'utf8');
describe('ATLAS Executor 777 atomic claim contract', () => {
  it('serializes competing workers at database row level', () => {
    expect(sql).toMatch(/for update skip locked/i);
    expect(sql).toMatch(/update public\.execution_runtime_jobs/i);
    expect(sql).toMatch(/j\.state = 'queued'/);
  });
  it('restricts claim to matching organization tenant runtime kind and authorized runtime', () => {
    expect(sql).toContain('j.org_id = p_org_id');
    expect(sql).toContain('j.tenant_id = p_tenant_id');
    expect(sql).toContain('j.runtime_kind = p_runtime_kind');
    expect(sql).toContain("status <> 'revoked'");
  });
  it('does not expose privileged claim function to end users', () => {
    expect(sql).toContain('security invoker');
    expect(sql).toMatch(/revoke all on function .* from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function .* to service_role/i);
  });
  it('calls the atomic claim RPC rather than selecting a candidate in application code', () => {
    const claim = runtime.slice(runtime.indexOf('export async function claimWorkRuntimeJob'),runtime.indexOf('export async function completeWorkRuntimeJob'));
    expect(claim).toContain("admin.rpc('execution_claim_runtime_job_777'");
    expect(claim).not.toContain(".eq('state', 'queued')");
  });
});
