import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationUrl = new URL('../../supabase/migrations/20260912_atlas_audit_ledger.sql', import.meta.url);

async function migrationSource() {
  return readFile(migrationUrl, 'utf8');
}

describe('ATLAS Audit Ledger schema contract', () => {
  it('creates the tenant-aware immutable ledger table', async () => {
    const sql = await migrationSource();
    expect(sql).toContain('create table if not exists public.audit_ledger_events');
    expect(sql).toContain('tenant_id text not null');
    expect(sql).toContain("payload_digest ~ '^[a-f0-9]{64}$'");
    expect(sql).toContain("previous_state_hash = 'GENESIS_BLOCK'");
    expect(sql).toContain('digest_version integer not null check (digest_version = 1)');
    expect(sql).toContain("jsonb_typeof(metadata) = 'object'");
    expect(sql).toContain('octet_length(metadata::text) <= 16384');
  });

  it('constrains actions to the source vocabulary or bounded execution namespace', async () => {
    const sql = await migrationSource();
    for (const action of [
      'TASK_STARTED',
      'GATE_EVALUATED',
      'EVIDENCE_RECORDED',
      'TASK_FAILED',
      'TASK_COMPLETED',
      'WORKFLOW_BLOCKED'
    ]) expect(sql).toContain(`'${action}'`);
    expect(sql).toContain("^execution\\.[a-z0-9_.-]{1,100}$");
  });

  it('enforces update/delete immutability at the database engine', async () => {
    const sql = (await migrationSource()).toLowerCase();
    expect(sql).toContain('create or replace function public.enforce_audit_ledger_immutability');
    expect(sql).toContain('before update or delete on public.audit_ledger_events');
    expect(sql).toContain("raise exception 'audit_ledger_immutable'");
  });

  it('gives authenticated users organization-scoped read-only access', async () => {
    const sql = (await migrationSource()).toLowerCase();
    expect(sql).toContain('alter table public.audit_ledger_events enable row level security');
    expect(sql).toContain("om.status = 'active'");
    expect(sql).toContain('om.org_id = audit_ledger_events.org_id');
    expect(sql).toContain('om.user_id = (select auth.uid())');
    expect(sql).toContain('revoke all on public.audit_ledger_events from authenticated');
    expect(sql).toContain('grant select on public.audit_ledger_events to authenticated');
    expect(sql).not.toMatch(/grant\s+(insert|update|delete|all)\s+on\s+public\.audit_ledger_events\s+to\s+authenticated/i);
  });

  it('serializes workflow appends and rejects stale or cross-scope heads', async () => {
    const sql = (await migrationSource()).toLowerCase();
    expect(sql).toContain('create or replace function public.append_audit_ledger_event');
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain('audit_ledger_stale_head');
    expect(sql).toContain('audit_ledger_invalid_scope');
    expect(sql).toContain('w.org_id = p_org_id');
    expect(sql).toContain('w.tenant_id = p_tenant_id');
    expect(sql).toContain('t.workflow_id = p_workflow_id');
    expect(sql).toContain('t.org_id = p_org_id');
    expect(sql).toContain('t.tenant_id = p_tenant_id');
  });

  it('does not expose the append rpc through default public/authenticated execute', async () => {
    const sql = (await migrationSource()).toLowerCase();
    expect(sql).toContain('revoke all on function public.append_audit_ledger_event');
    expect(sql).toContain('from public');
    expect(sql).toContain('from authenticated');
    expect(sql).toContain('grant execute on function public.append_audit_ledger_event');
    expect(sql).toContain('to service_role');
  });
});
