import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260914_hospitality_requests.sql'),
  'utf8'
).toLowerCase();

describe('Hospitality service-request schema', () => {
  it('creates SLA policies and service requests', () => {
    expect(sql).toContain('create table if not exists public.hospitality_sla_policies');
    expect(sql).toContain('create table if not exists public.hospitality_service_requests');
  });

  it('links requests to canonical properties and optional execution workflows', () => {
    expect(sql).toContain('references public.hospitality_properties(id)');
    expect(sql).toContain('execution_workflow_id text');
  });

  it('enables property-scoped RLS', () => {
    expect(sql).toContain('alter table public.hospitality_service_requests enable row level security');
    expect(sql).toContain('hospitality_property_memberships');
    expect(sql).toContain('hpm.user_id = auth.uid()');
  });
});
