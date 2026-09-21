
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  process.cwd() + '/supabase/migrations/20260921201000_tax_productive_core.sql',
  'utf8'
);

describe('ATLAS Tax productive core schema', () => {
  const tables = [
    'tax_returns',
    'tax_return_steps',
    'tax_source_documents',
    'tax_facts',
    'tax_line_mappings',
    'tax_workpapers',
    'tax_diagnostics',
    'tax_carryforwards',
    'tax_return_snapshots',
    'tax_audit_events'
  ];

  it('creates the durable tax return ledger tables', () => {
    for (const table of tables) {
      expect(sql).toContain('create table if not exists public.' + table);
      expect(sql).toContain('alter table public.' + table + ' enable row level security');
    }
  });

  it('keeps browser mutation behind governed RPCs', () => {
    for (const table of tables) {
      expect(sql).toContain('revoke all on public.' + table + ' from anon, authenticated');
    }
    for (const fn of [
      'tax_create_return',
      'tax_set_step_state',
      'tax_register_source_document',
      'tax_record_fact',
      'tax_record_line_mapping',
      'tax_upsert_workpaper',
      'tax_open_diagnostic',
      'tax_resolve_diagnostic',
      'tax_create_carryforward',
      'tax_lock_return_snapshot'
    ]) {
      expect(sql).toContain('public.' + fn);
      expect(sql).toContain('grant execute on function public.' + fn);
    }
  });

  it('versions tax facts instead of overwriting provenance', () => {
    expect(sql).toContain('version integer not null default 1');
    expect(sql).toContain('is_current boolean not null default true');
    expect(sql).toContain('supersedes_fact_id uuid references public.tax_facts');
    expect(sql).toContain('tax_facts_current_key_idx');
    expect(sql).toContain('fact_version_created');
  });

  it('makes submission snapshots and tax audit immutable', () => {
    expect(sql).toContain('tax_snapshots_immutable');
    expect(sql).toContain('Tax return snapshots are immutable');
    expect(sql).toContain('tax_audit_immutable');
    expect(sql).toContain('Tax audit events are immutable');
  });

  it('requires review, client authorization and no blocking diagnostics before submission snapshot', () => {
    expect(sql).toContain("step_id = 'professional-review'");
    expect(sql).toContain("step_id = 'client-review'");
    expect(sql).toContain("d.status = 'open' and d.blocking");
    expect(sql).toContain('Authorization reference required for submission snapshot');
  });

  it('prevents mutation of locked and accepted returns', () => {
    expect(sql).toContain("v_return.locked_at is not null");
    expect(sql).toContain("'transmitted','accepted','closed','archived'");
    expect(sql).toContain('create an amendment or new revision');
  });
});
