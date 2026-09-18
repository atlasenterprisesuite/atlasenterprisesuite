import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationPath = `${process.cwd()}/supabase/migrations/20260912_universal_execution_engine.sql`;

async function migration() {
  return readFile(migrationPath, 'utf8');
}

const tables = [
  'execution_workflows',
  'execution_tasks',
  'execution_steps',
  'execution_dependencies',
  'execution_evidence',
  'execution_approvals',
  'execution_audit_events'
] as const;

describe('ATLAS Universal Execution Supabase schema', () => {
  it('creates the seven canonical execution tables with RLS', async () => {
    const sql = await migration();
    for (const table of tables) {
      expect(sql).toContain(`create table if not exists public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it('scopes member reads through active organization membership', async () => {
    const sql = await migration();
    expect(sql).toContain('from public.organization_members om');
    expect(sql).toContain("om.status = 'active'");
    expect(sql).toContain('om.user_id = (select auth.uid())');
  });

  it('does not grant direct authenticated mutation of execution state', async () => {
    const sql = await migration();
    for (const table of tables) {
      expect(sql).toContain(`revoke all on public.${table} from authenticated`);
      expect(sql).toContain(`grant select on public.${table} to authenticated`);
      expect(sql).not.toContain(`grant insert on public.${table} to authenticated`);
      expect(sql).not.toContain(`grant update on public.${table} to authenticated`);
      expect(sql).not.toContain(`grant delete on public.${table} to authenticated`);
    }
  });

  it('keeps tenant scope, lineage indexes, and append-only audit semantics explicit', async () => {
    const sql = await migration();
    expect(sql.match(/tenant_id text not null/g)?.length).toBe(7);
    for (const index of [
      'execution_tasks_org_status_owner_idx',
      'execution_tasks_org_module_idx',
      'execution_steps_task_sequence_idx',
      'execution_approvals_org_status_idx',
      'execution_audit_org_created_idx'
    ]) expect(sql).toContain(index);
    expect(sql).toContain('append-only execution audit events');
  });
});
