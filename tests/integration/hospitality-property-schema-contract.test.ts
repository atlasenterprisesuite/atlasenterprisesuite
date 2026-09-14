import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260914_hospitality_us_property_core.sql'),
  'utf8'
).toLowerCase();

describe('Hospitality canonical property schema', () => {
  it('creates the U.S. hospitality property operating model additively', () => {
    for (const table of [
      'hospitality_portfolios',
      'hospitality_properties',
      'hospitality_business_entities',
      'hospitality_property_relationships',
      'hospitality_departments',
      'hospitality_property_memberships',
      'hospitality_department_memberships',
      'hospitality_rooms'
    ]) {
      expect(sql).toContain(`create table if not exists public.${table}`);
    }
  });

  it('gives properties a stable org-scoped property key', () => {
    expect(sql).toContain('unique (org_id, property_key)');
  });

  it('backfills canonical properties from existing Room Access property ids without inventing names', () => {
    expect(sql).toContain('from public.hospitality_provider_instances');
    expect(sql).toContain('property_id as property_key');
    expect(sql).toContain('display_name');
    expect(sql).toMatch(/select\s+distinct[\s\S]*null::text/);
  });

  it('does not destructively change existing Room Access property_id columns', () => {
    expect(sql).not.toMatch(/alter\s+table\s+public\.hospitality_provider_instances[\s\S]*alter\s+column\s+property_id\s+type/);
    expect(sql).not.toMatch(/drop\s+column\s+property_id/);
  });
});
