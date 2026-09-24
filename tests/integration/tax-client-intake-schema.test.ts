import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ATLAS Tax client intake persistence', () => {
  const sql = readFileSync(process.cwd() + '/supabase/migrations/20260924132000_tax_client_intake_profile.sql', 'utf8');

  it('creates a one-to-one tax profile and repeatable household members', () => {
    expect(sql).toContain('create table if not exists public.tax_client_profiles');
    expect(sql).toContain('unique (org_id, client_id)');
    expect(sql).toContain('create table if not exists public.tax_client_household_members');
    expect(sql).toContain("relationship in (");
  });

  it('supports all individual filing statuses requested by the professional workflow', () => {
    for (const status of [
      'single',
      'married_filing_jointly',
      'married_filing_separately',
      'head_of_household',
      'qualifying_surviving_spouse',
      'undetermined'
    ]) expect(sql).toContain(status);
  });

  it('stores taxpayer identifiers as last4 plus secure-vault reference only', () => {
    expect(sql).toContain('taxpayer_id_last4');
    expect(sql).toContain('taxpayer_id_secret_reference');
    expect(sql).toContain("p_profile ? 'ssn'");
    expect(sql).toContain("p_profile ? 'social_security_number'");
    expect(sql).toContain('Raw taxpayer identifiers are prohibited');
    expect(sql).not.toMatch(/\bssn\s+text\b/i);
    expect(sql).not.toMatch(/social_security_number\s+text/i);
  });

  it('uses tax permissions and RLS for reads while keeping browser writes RPC-only', () => {
    expect(sql).toContain('enable row level security');
    expect(sql).toContain("has_identity_permission(org_id, 'tax.read')");
    expect(sql).toContain("has_identity_permission(v_org, 'tax.prepare')");
    expect(sql).toContain('revoke all on public.tax_client_profiles from anon, authenticated');
    expect(sql).toContain('tax_upsert_client_intake');
  });

  it('captures household facts needed by dependent and filing-status workflows', () => {
    for (const field of [
      'months_lived_with_taxpayer',
      'full_time_student',
      'permanently_disabled',
      'gross_income',
      'taxpayer_provided_support_percent',
      'childcare_expenses',
      'qualifying_child_candidate',
      'qualifying_relative_candidate'
    ]) expect(sql).toContain(field);
  });
});
