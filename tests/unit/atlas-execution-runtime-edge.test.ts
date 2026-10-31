import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const edgeSource = readFileSync('supabase/functions/atlas-execution/index.ts', 'utf8');
const runtimeSource = readFileSync('supabase/functions/atlas-execution/work-runtime.ts', 'utf8');
const connectionSource = readFileSync('supabase/functions/atlas-execution/work-connections.ts', 'utf8');
const atomicSql = readFileSync('supabase/migrations/20261025_atlas_atomic_runtime_claim_777.sql', 'utf8');

describe('ATLAS Work runtime and connection Edge boundary', () => {
  it('declares separate runtime-token operations', () => {
    for (const operation of ['heartbeat_work_runtime', 'claim_work_runtime_job', 'complete_work_runtime_job']) {
      expect(edgeSource).toContain(`'${operation}'`);
    }
    expect(edgeSource).toContain('RUNTIME_OPERATIONS');
    expect(edgeSource).toContain('x-atlas-runtime-id');
    expect(edgeSource).toContain('resolveRuntimeContext');
  });

  it('registers user-session connection and runtime operations', () => {
    for (const operation of ['list_work_connections', 'register_work_connection_ref', 'revoke_work_connection_ref', 'list_work_runtimes', 'enroll_work_runtime', 'enqueue_work_runtime_job']) {
      expect(edgeSource).toContain(`'${operation}'`);
    }
    expect(edgeSource).toContain("requireExecutionPermission(context, 'execution.admin')");
  });

  it('uses opaque connection refs and never returns external_ref from list', () => {
    expect(connectionSource).toContain('external_ref');
    expect(connectionSource).toContain("select('id,provider,mechanism,status,capabilities,created_at,updated_at')");
    expect(connectionSource).not.toContain("select('*')");
  });

  it('enrolls one-time runtime tokens and persists only sha256 hash', () => {
    expect(runtimeSource).toContain('crypto.getRandomValues(new Uint8Array(32))');
    expect(runtimeSource).toContain("crypto.subtle.digest('SHA-256'");
    expect(runtimeSource).toContain('auth_token_hash');
    expect(runtimeSource).toContain('constantTimeEqual');
    expect(runtimeSource).toContain('runtimeToken');
  });

  it('leases jobs atomically with runtime/org/tenant scope and sanitizes completion', () => {
    expect(runtimeSource).toContain(".rpc('atlas_claim_execution_runtime_job'");
    expect(runtimeSource).toContain(".rpc('atlas_complete_execution_runtime_job'");
    expect(atomicSql).toContain("state = 'claimed'");
    expect(atomicSql).toContain('lease_id = gen_random_uuid()');
    expect(atomicSql).toContain("lease_expires_at = now() + interval '5 minutes'");
    expect(atomicSql).toContain('j.org_id = p_org_id');
    expect(atomicSql).toContain('j.tenant_id = p_tenant_id');
    expect(atomicSql).toContain('j.runtime_id = p_runtime_id');
    expect(atomicSql).toContain('j.lease_id = p_lease_id');
    expect(atomicSql).toContain('j.lease_expires_at > now()');
    expect(runtimeSource).toContain('sanitizeBrowserResult');
    expect(atomicSql).toMatch(/revoke all on function .* from public, anon, authenticated/i);
  });
});
