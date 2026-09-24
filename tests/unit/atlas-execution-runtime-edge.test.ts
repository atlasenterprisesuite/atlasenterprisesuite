import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const edgeSource = readFileSync('supabase/functions/atlas-execution/index.ts', 'utf8');
const runtimeSource = readFileSync('supabase/functions/atlas-execution/work-runtime.ts', 'utf8');
const connectionSource = readFileSync('supabase/functions/atlas-execution/work-connections.ts', 'utf8');

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

  it('leases jobs with runtime/org/tenant scope and sanitizes completion', () => {
    expect(runtimeSource).toContain("state: 'claimed'");
    expect(runtimeSource).toContain('lease_id');
    expect(runtimeSource).toContain('lease_expires_at');
    expect(runtimeSource).toContain(".eq('org_id', context.orgId)");
    expect(runtimeSource).toContain(".eq('tenant_id', context.tenantId)");
    expect(runtimeSource).toContain('sanitizeBrowserResult');
  });
});
