import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260914_hospitality_us_property_core.sql'),
  'utf8'
).toLowerCase();

describe('Hospitality property-scoped RLS', () => {
  it('enables RLS on canonical property-scoped tables', () => {
    for (const table of [
      'hospitality_properties',
      'hospitality_departments',
      'hospitality_property_memberships',
      'hospitality_department_memberships',
      'hospitality_rooms'
    ]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it('requires active property membership for ordinary property reads', () => {
    expect(sql).toContain('hospitality_property_memberships');
    expect(sql).toContain('hpm.user_id = auth.uid()');
    expect(sql).toContain("hpm.status = 'active'");
  });

  it('keeps corporate scope explicit for owner/admin/platform_admin', () => {
    expect(sql).toContain("om.role in ('owner', 'admin', 'platform_admin')");
  });

  it('does not grant every active organization member every property', () => {
    const propertyPolicyStart = sql.indexOf('create policy hospitality_properties_member_read');
    expect(propertyPolicyStart).toBeGreaterThan(-1);
    const policy = sql.slice(propertyPolicyStart, propertyPolicyStart + 1800);
    expect(policy).toContain('hospitality_property_memberships');
  });
});
