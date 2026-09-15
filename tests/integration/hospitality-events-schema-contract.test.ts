import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260914_hospitality_events.sql'), 'utf8').toLowerCase();

describe('Hospitality Events / BEO persistence', () => {
  it('creates event, order, change, timeline, and vendor requirement records', () => {
    for (const table of [
      'hospitality_events',
      'hospitality_event_orders',
      'hospitality_event_changes',
      'hospitality_event_timeline_items',
      'hospitality_event_vendor_requirements'
    ]) expect(sql).toContain(`create table if not exists public.${table}`);
  });

  it('versions BEOs instead of overwriting them', () => {
    expect(sql).toContain('version integer not null');
    expect(sql).toContain('supersedes_id uuid');
    expect(sql).toContain('unique (event_id, version)');
  });

  it('links events to Universal Execution without taking over Accounting truth', () => {
    expect(sql).toContain('execution_workflow_id text');
    expect(sql).toContain('financial_handoff_reference text');
  });

  it('applies property-scoped RLS', () => {
    expect(sql).toContain('alter table public.hospitality_events enable row level security');
    expect(sql).toContain('hospitality_property_memberships');
  });
});
