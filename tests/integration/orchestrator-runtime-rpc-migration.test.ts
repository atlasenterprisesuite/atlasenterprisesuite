import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync('supabase/migrations/20260918091500_atlas_orchestrator_runtime_rpc.sql', 'utf8');

describe('ATLAS orchestrator production RPC persistence contract', () => {
  it('keeps raw orchestrator tables private while exposing only token-gated SECURITY DEFINER RPCs', () => {
    expect(sql).toContain("vault.decrypted_secrets");
    expect(sql).toContain("x-atlas-runtime-token");
    expect(sql).toContain("extensions.digest(provided_token, 'sha256')");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain("atlas_orchestrator_runtime_unauthorized");

    for (const name of [
      'atlas_orchestrator_create_task',
      'atlas_orchestrator_get_task',
      'atlas_orchestrator_save_task',
      'atlas_orchestrator_append_event',
      'atlas_orchestrator_list_events',
    ]) {
      expect(sql).toContain(`public.${name}`);
      expect(sql).toContain(`grant execute on function public.${name}`);
    }

    expect(sql).not.toMatch(/grant\s+(select|insert|update|delete)\s+on\s+public\.atlas_orchestrator_/i);
  });

  it('preserves tenant, organization and task predicates on every read or update path', () => {
    expect(sql.match(/tenant_id = p_tenant_id/g)?.length).toBeGreaterThanOrEqual(3);
    expect(sql.match(/organization_id = p_organization_id/g)?.length).toBeGreaterThanOrEqual(3);
    expect(sql.match(/task_id = p_task_id/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
