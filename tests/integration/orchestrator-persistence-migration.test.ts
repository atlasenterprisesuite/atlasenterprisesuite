import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const path = 'supabase/migrations/20260916232000_atlas_orchestrator_persistence.sql';

describe('ATLAS orchestrator durable persistence migration', () => {
  it('creates tenant-scoped task and event tables with locked-down RLS', () => {
    expect(existsSync(path)).toBe(true);
    const sql = existsSync(path) ? readFileSync(path, 'utf8') : '';
    expect(sql).toContain('create table if not exists public.atlas_orchestrator_tasks');
    expect(sql).toContain('primary key (tenant_id, organization_id, task_id)');
    expect(sql).toContain('create table if not exists public.atlas_orchestrator_events');
    expect(sql).toContain('id text primary key');
    expect(sql).toContain('foreign key (tenant_id, organization_id, task_id)');
    expect(sql).toContain('alter table public.atlas_orchestrator_tasks enable row level security');
    expect(sql).toContain('alter table public.atlas_orchestrator_events enable row level security');
    expect(sql).toContain('revoke all on public.atlas_orchestrator_tasks from anon, authenticated');
    expect(sql).toContain('revoke all on public.atlas_orchestrator_events from anon, authenticated');
  });
});
