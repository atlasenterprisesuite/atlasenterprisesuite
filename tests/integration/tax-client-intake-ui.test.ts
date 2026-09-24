import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ATLAS Tax client intake UI contract', () => {
  const intake = readFileSync(process.cwd() + '/apps/web/src/modules/tax/TaxClientIntake.tsx', 'utf8');
  const control = readFileSync(process.cwd() + '/apps/web/src/modules/tax/TaxControlCenter.tsx', 'utf8');
  const api = readFileSync(process.cwd() + '/apps/web/src/lib/taxApi.ts', 'utf8');

  it('adds the evaluation to the Tax Control Center', () => {
    expect(control).toContain("TaxClientIntake");
    expect(control).toContain("Add tax client");
    expect(control).toContain("Create a complete individual tax profile");
  });

  it('collects identity contact address and filing profile', () => {
    for (const label of [
      'First name *',
      'Last name *',
      'MPC number (optional)',
      'Date of birth *',
      'Phone',
      'Email',
      'Address line 1',
      'City',
      'State / region',
      'ZIP / postal code',
      'Social Security Number (SSN)',
      'Filing status',
      'Marital status'
    ]) expect(intake).toContain(label);
  });

  it('offers the supported filing statuses', () => {
    for (const label of [
      'Single',
      'Married filing jointly',
      'Married filing separately',
      'Head of household',
      'Qualifying surviving spouse'
    ]) expect(intake).toContain(label);
  });

  it('supports spouse and dependent evaluation facts', () => {
    expect(intake).toContain('Add household member');
    expect(intake).toContain('Months lived with taxpayer');
    expect(intake).toContain('Full-time student');
    expect(intake).toContain('Permanently disabled');
    expect(intake).toContain('Qualifying-child candidate');
    expect(intake).toContain('Qualifying-relative candidate');
  });

  it('never sends the full taxpayer identifier to persistence', () => {
    expect(intake).toContain("taxpayerIdLast4: draft.taxpayerIdFull ? last4(draft.taxpayerIdFull) : ''");
    expect(api).toContain('taxpayer_id_last4');
    expect(api).not.toContain('taxpayer_id_full');
    expect(api).not.toContain('social_security_number');
  });

  it('uses one organization-scoped RPC for client + profile + household persistence', () => {
    expect(api).toContain("tax_upsert_client_intake");
    expect(api).toContain('p_profile');
    expect(api).toContain('p_household');
  });
});
