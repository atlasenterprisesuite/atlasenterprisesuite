import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260914_hospitality_entitlements.sql'),
  'utf8'
).toLowerCase();

describe('Hospitality entitlement persistence', () => {
  it('creates stay, rule, decision, and redemption records', () => {
    for (const table of [
      'hospitality_stay_contexts',
      'hospitality_entitlement_definitions',
      'hospitality_entitlement_rule_sets',
      'hospitality_entitlement_rules',
      'hospitality_entitlement_decisions',
      'hospitality_entitlement_redemptions'
    ]) expect(sql).toContain(`create table if not exists public.${table}`);
  });

  it('preserves the exact ruleset version used by a decision', () => {
    expect(sql).toContain('rule_set_version integer not null');
  });

  it('uses opaque guest/stay references rather than requiring duplicated guest PII', () => {
    expect(sql).toContain('external_guest_reference text');
    expect(sql).not.toContain('guest_ssn');
    expect(sql).not.toContain('payment_card_number');
  });

  it('enables property-scoped RLS for decisions and redemptions', () => {
    expect(sql).toContain('alter table public.hospitality_entitlement_decisions enable row level security');
    expect(sql).toContain('alter table public.hospitality_entitlement_redemptions enable row level security');
    expect(sql).toContain('hospitality_property_memberships');
  });
});
