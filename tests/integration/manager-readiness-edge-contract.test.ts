import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20260912_manager_readiness_execution.sql', 'utf8');
const edgeSource = readFileSync('supabase/functions/atlas-execution/index.ts', 'utf8');
const managerSource = readFileSync('supabase/functions/atlas-execution/manager-readiness.ts', 'utf8');

describe('Manager readiness Edge contract', () => {
  it('constrains one active readiness workflow per organization', () => {
    expect(migration).toContain('manager.infrastructure_readiness');
    expect(migration).toContain('create unique index');
    expect(migration).toContain("status not in ('completed','cancelled','discarded')");
  });

  it('registers audit and read-only manager sync operations', () => {
    expect(edgeSource).toContain("'get_audit'");
    expect(edgeSource).toContain("'sync_manager_readiness'");
    expect(edgeSource).toContain('execution.audit');
    expect(edgeSource).toContain('ATLAS_PLATFORM_TENANT_ID');
    expect(managerSource).toContain('/functions/v1/atlas-infra-status');
  });

  it('records provider-specific evidence and gates completion', () => {
    expect(managerSource).toContain('crypto.subtle.digest');
    expect(managerSource).toContain('infra_verification.github');
    expect(managerSource).toContain('infra_verification.supabase');
    expect(managerSource).toContain('infra_verification.cloudflare');
    expect(managerSource).toContain('infra_verification.production');
    expect(managerSource).toContain('evaluateTaskCompletion');
    expect(managerSource).toContain('execution.manager.readiness_synced');
    expect(managerSource).toContain("canTransitionTask('blocked', 'now')");
    expect(managerSource).toContain("canTransitionTask('now', 'completed')");
  });

  it('never embeds provider credentials in the readiness feature', () => {
    expect(managerSource).not.toContain('CLOUDFLARE_API_TOKEN');
    expect(managerSource).not.toContain('GITHUB_TOKEN');
    expect(managerSource).not.toContain('VERCEL_TOKEN');
  });
});
