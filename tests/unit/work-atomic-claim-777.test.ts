import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync('supabase/migrations/20261025_atlas_atomic_runtime_claim_777.sql', 'utf8');
const runtime = readFileSync('supabase/functions/atlas-execution/work-runtime.ts', 'utf8');

describe('ATLAS 777 atomic runtime claim contract', () => {
  it('locks a single tenant-scoped queued row in the database', () => {
    expect(sql).toMatch(/for update of j skip locked/i);
    expect(sql).toMatch(/limit 1/i);
    for (const key of ['j.org_id = p_org_id','j.tenant_id = p_tenant_id','j.runtime_kind = p_runtime_kind',"j.state = 'queued'"]) expect(sql).toContain(key);
  });
  it('limits execution to a recently active matching runtime and service role', () => {
    expect(sql).toContain("r.status = 'online'");
    expect(sql).toContain("r.last_seen_at > now() - interval '2 minutes'");
    expect(sql).toContain("auth.role() is distinct from 'service_role'");
    expect(sql).toMatch(/revoke all on function .* from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function .* to service_role/i);
  });
  it('uses the atomic RPC rather than selecting a candidate before update', () => {
    expect(runtime).toContain(".rpc('atlas_claim_execution_runtime_job'");
    expect(runtime).not.toContain("const { data: candidate, error: candidateError }");
  });
  it('finalizes jobs atomically with live lease and tenant guards', () => {
    expect(runtime).toContain(".rpc('atlas_complete_execution_runtime_job'");
    expect(runtime).not.toContain("const { data: current, error: loadError }");
    expect(sql).toContain('public.atlas_complete_execution_runtime_job');
    for (const guard of [
      'j.org_id = p_org_id',
      'j.tenant_id = p_tenant_id',
      'j.runtime_id = p_runtime_id',
      'j.lease_id = p_lease_id',
      'j.lease_expires_at > now()',
      "j.state in ('claimed', 'running')"
    ]) expect(sql).toContain(guard);
    expect(sql).toMatch(/revoke all on function public\.atlas_complete_execution_runtime_job\([\s\S]*? from public, anon, authenticated/i);
  });

});

describe('ATLAS 777 fail-closed reconciliation and single RPC contract', () => {
  it('quarantines expired claims without automatically requeueing external effects', () => {
    expect(sql).toContain('public.atlas_quarantine_expired_runtime_jobs');
    expect(sql).toMatch(/j\.lease_expires_at <= now\(\)/i);
    expect(sql).toMatch(/state = 'waiting_human'/i);
    expect(sql).not.toMatch(/state = 'queued'\s*,\s*lease_id/i);
    expect(sql).toMatch(/for update skip locked/i);
    expect(sql).toContain('p_limit > 500');
  });
  it('rejects stale lease completion and prevents a second competing claim RPC', () => {
    expect(sql).toContain('j.lease_expires_at > now()');
    expect(sql).toContain('j.lease_id = p_lease_id');
    expect(runtime).toContain(".rpc('atlas_claim_execution_runtime_job'");
    expect(runtime).not.toContain(".rpc('execution_claim_runtime_job_777'");
  });
});

describe('ATLAS 777 external-effect interruption fence', () => {
  it('does not allow an expired worker to complete or re-claim its interrupted external action', () => {
    expect(sql).toContain('j.lease_expires_at > now()');
    expect(sql).toContain("j.state = 'queued'");
    expect(sql).toContain("state = 'waiting_human'");
    expect(sql).toContain('lease_id = null');
  });
  it('requires explicit reconciliation evidence before any future automatic replay', () => {
    // The #913 recovery helper is decision-only; the #917 database intentionally
    // quarantines ambiguous external effects instead of trusting a client flag.
    expect(sql).toContain('External effects still require separate durable idempotency/reconciliation before retry.');
    expect(sql).not.toMatch(/update public\.execution_runtime_jobs j[\s\S]*?set state = 'queued'/i);
    expect(runtime).not.toContain(".rpc('execution_claim_runtime_job_777'");
  });
});
